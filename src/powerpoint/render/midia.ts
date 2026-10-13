// Desenho e reprodução de áudio/vídeo: o cartão de capa, a captura do primeiro quadro do vídeo
// e o elemento que toca no editor (controles nativos) e na apresentação (auto/loop/corte/volume).
import type { Deck, DeckSetup, Midia, Shape } from "../schema";
import { MIDIA_ROTULOS, extDeMime, extDoNome, trechoDaMidia } from "../edicao/midia";
import { urlDaMidia, type CtxRender } from "./forma";

const esc = (t: string) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const n3 = (n: number) => (Math.round(n * 1000) / 1000).toString();

const COR_CARTAO = "#1F2430";
const COR_TEXTO = "#E7E9EE";

/** Nome curto do arquivo (para o cartão da capa). */
function nomeCurto(m: Midia): string {
  const nome = m.nome || `Arquivo de ${MIDIA_ROTULOS[m.tipo].toLowerCase()}`;
  return nome.length > 34 ? `${nome.slice(0, 33)}…` : nome;
}

/** Cartão de capa em SVG (data URL): usado quando a mídia ainda não tem uma capa de verdade. */
export function cartaoSvg(m: Midia): string {
  const icone =
    m.tipo === "video"
      ? `<path d="M46 34 L74 50 L46 66 Z" fill="${COR_TEXTO}"/>`
      : `<path d="M52 30 v32 M52 34 a7 7 0 0 0 14 0" stroke="${COR_TEXTO}" stroke-width="4" fill="none" stroke-linecap="round"/>`;
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 180">` +
    `<rect width="320" height="180" rx="8" fill="${COR_CARTAO}"/>` +
    `<circle cx="60" cy="50" r="26" fill="#2C3446"/>${icone}` +
    `<text x="96" y="46" font-family="sans-serif" font-size="15" font-weight="700" fill="${COR_TEXTO}">${esc(MIDIA_ROTULOS[m.tipo])}</text>` +
    `<text x="96" y="66" font-family="sans-serif" font-size="12" fill="#AAB2C0">${esc(nomeCurto(m))}</text>` +
    `</svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

/** Capa da mídia para a tela: a do modelo ou o cartão em SVG. */
export function posterDaMidia(s: Shape): string {
  return s.midia?.poster || cartaoSvg(s.midia!);
}

/**
 * Cartão de capa rasterizado (PNG), para o .pptx e para a inserção — o arquivo precisa de
 * uma imagem de verdade (SVG no `blip` só funciona em PowerPoint recente).
 */
export function cartaoParaPng(m: Midia, largura = 640, altura = 360): string | null {
  if (typeof document === "undefined") return null;
  const canvas = document.createElement("canvas");
  canvas.width = largura;
  canvas.height = altura;
  const c = canvas.getContext("2d");
  if (!c) return null;
  const escala = largura / 320;
  c.fillStyle = COR_CARTAO;
  if (typeof c.roundRect === "function") {
    c.beginPath();
    c.roundRect(0, 0, largura, altura, 8 * escala);
    c.fill();
  } else {
    c.fillRect(0, 0, largura, altura);
  }
  c.fillStyle = "#2C3446";
  c.beginPath();
  c.arc(60 * escala, 50 * escala, 26 * escala, 0, Math.PI * 2);
  c.fill();
  c.fillStyle = COR_TEXTO;
  if (m.tipo === "video") {
    c.beginPath();
    c.moveTo(46 * escala, 34 * escala);
    c.lineTo(74 * escala, 50 * escala);
    c.lineTo(46 * escala, 66 * escala);
    c.closePath();
    c.fill();
  } else {
    c.lineWidth = 4 * escala;
    c.strokeStyle = COR_TEXTO;
    c.lineCap = "round";
    c.beginPath();
    c.moveTo(52 * escala, 30 * escala);
    c.lineTo(52 * escala, 62 * escala);
    c.stroke();
    c.beginPath();
    c.arc(59 * escala, 34 * escala, 7 * escala, 0, Math.PI, true);
    c.stroke();
  }
  c.textBaseline = "alphabetic";
  c.font = `700 ${15 * escala}px sans-serif`;
  c.fillText(MIDIA_ROTULOS[m.tipo], 96 * escala, 46 * escala);
  c.fillStyle = "#AAB2C0";
  c.font = `${12 * escala}px sans-serif`;
  c.fillText(nomeCurto(m), 96 * escala, 66 * escala);
  try {
    return canvas.toDataURL("image/png");
  } catch {
    return null;
  }
}

/** Captura o primeiro quadro do vídeo como PNG (capa). null quando o navegador não consegue. */
export async function capturarQuadro(url: string, tempo = 0.1): Promise<string | null> {
  if (typeof document === "undefined") return null;
  const video = document.createElement("video");
  video.muted = true;
  video.playsInline = true;
  video.preload = "auto";
  video.src = url;
  try {
    await new Promise<void>((ok, erro) => {
      const limite = setTimeout(() => erro(new Error("tempo esgotado")), 6000);
      video.onloadeddata = () => {
        clearTimeout(limite);
        ok();
      };
      video.onerror = () => {
        clearTimeout(limite);
        erro(new Error("não carregou"));
      };
    });
    const alvo = Math.min(tempo, Math.max(0, (video.duration || 1) / 2));
    if (alvo > 0.01) {
      await new Promise<void>((ok) => {
        const limite = setTimeout(ok, 2500);
        video.onseeked = () => {
          clearTimeout(limite);
          ok();
        };
        try {
          video.currentTime = alvo;
        } catch {
          clearTimeout(limite);
          ok();
        }
      });
    }
    const w = Math.min(1280, video.videoWidth || 640);
    const h = Math.max(2, Math.round((w * (video.videoHeight || 360)) / (video.videoWidth || 640)));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const c = canvas.getContext("2d");
    if (!c) return null;
    c.drawImage(video, 0, 0, w, h);
    return canvas.toDataURL("image/png");
  } catch {
    return null;
  } finally {
    video.removeAttribute("src");
    video.load();
  }
}

/** HTML da mídia na lâmina: player no editor, reprodução na apresentação, capa nas miniaturas. */
export function htmlMidia(s: Shape, ctx: CtxRender): string {
  const m = s.midia;
  if (!m) return "";
  const est = [`left:${n3(s.box.x)}%`, `top:${n3(s.box.y)}%`, `width:${n3(s.box.w)}%`, `height:${n3(s.box.h)}%`];
  if (s.rot) est.push(`transform:rotate(${n3(s.rot)}deg)`);
  if (s.opacity !== undefined && s.opacity < 1) est.push(`opacity:${n3(s.opacity)}`);
  const classes =
    `pp-shape pp-rica pp-midia-box${ctx.selecionada === s.id ? " selected" : ""}${s.fixa ? " pp-fixa" : ""}` +
    `${ctx.editando === s.id ? " pp-editando" : ""}${s.bloqueada ? " pp-bloqueada" : ""}`;
  const url = urlDaMidia(s.src, ctx.media);
  const poster = posterDaMidia(s);
  const base = `width:100%;height:100%;object-fit:contain;display:block;background:#000;border-radius:2px`;
  const trecho = trechoDaMidia(m);

  if (ctx.apresentando) {
    const dados =
      ` data-midia-id="${s.id}" data-tipo="${m.tipo}" data-auto="${m.auto ? "1" : "0"}" data-continuar="${m.continuar ? "1" : "0"}"` +
      ` data-vol="${n3(m.volume ?? 1)}" data-ini="${n3(trecho.inicio)}" data-fim="${trecho.fim === null ? "" : n3(trecho.fim)}"`;
    const el =
      m.tipo === "video"
        ? `<video class="pp-midia-el" src="${esc(url)}" poster="${esc(poster)}" preload="auto" playsinline${m.controles ? " controls" : ""}${m.loop && trecho.fim === null ? " loop" : ""} style="${base}"></video>`
        : `<audio class="pp-midia-el" src="${esc(url)}" preload="auto"${m.controles ? " controls" : ""}${m.loop && trecho.fim === null ? " loop" : ""} style="width:100%"></audio>`;
    return `<div class="${classes}" data-shape="${s.id}" data-kind="imagem" style="${est.join(";")}"${dados}>${el}</div>`;
  }

  if (ctx.editavel) {
    const el =
      m.tipo === "video"
        ? `<video data-player src="${esc(url)}" poster="${esc(poster)}" preload="metadata" controls style="${base}"></video>`
        : `<audio data-player src="${esc(url)}" preload="metadata" controls style="width:100%"></audio>`;
    const capa = m.tipo === "video" ? "" : `<img class="pp-midia-capa" src="${esc(poster)}" alt="" draggable="false"/>`;
    return `<div class="${classes}" data-shape="${s.id}" data-kind="imagem" style="${est.join(";")}">${capa}<div class="pp-midia-player">${el}</div></div>`;
  }

  return `<div class="${classes}" data-shape="${s.id}" data-kind="imagem" style="${est.join(";")}"><img src="${esc(poster)}" alt="" draggable="false" style="width:100%;height:100%;object-fit:cover;display:block"/></div>`;
}

/**
 * Antes de gravar o .pptx: garante que cada mídia tenha uma capa rasterizada (o `blip` do
 * arquivo precisa de uma imagem).
 */
export async function prepararMidia(deck: Deck, _setup: DeckSetup): Promise<Deck> {
  if (!deck.slides.some((sl) => sl.shapes.some((s) => s.midia))) return deck;
  const slides = await Promise.all(
    deck.slides.map(async (sl) => {
      if (!sl.shapes.some((s) => s.midia)) return sl;
      const shapes = await Promise.all(
        sl.shapes.map(async (s): Promise<Shape> => {
          if (!s.midia || s.midia.poster) return s;
          const png = cartaoParaPng(s.midia);
          return png ? { ...s, midia: { ...s.midia, poster: png } } : s;
        })
      );
      return { ...sl, shapes };
    })
  );
  return { ...deck, slides };
}

/** Extensão do arquivo da mídia (para nomear em ppt/media e para o MIME do round-trip). */
export function extDaMidia(src: string, m: Midia): string {
  const mime = /^data:([^;,]+)/.exec(src)?.[1];
  if (mime) return extDeMime(mime, m.nome);
  return extDoNome(m.nome ?? "") || (m.tipo === "video" ? "mp4" : "mp3");
}
