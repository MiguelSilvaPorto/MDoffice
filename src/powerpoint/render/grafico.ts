// Desenho dos gráficos em SVG. O mesmo código serve para a TELA (medidas em `cqw`, que
// acompanham o zoom da lâmina) e para a EXPORTAÇÃO (medidas em pt, que o canvas rasteriza
// para PNG antes de gravar o .pptx — o motor não escreve `c:chart` nativo).
import type { Deck, DeckSetup, Fill, Grafico, Shape } from "../schema";
import { aspectSize } from "../schema";
import { escalaDeValores, paletaDeSeries, type Escala } from "../edicao/grafico";
import { cq, rgba, type CtxRender } from "./forma";

const esc = (t: string) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const n3 = (n: number) => (Math.round(n * 1000) / 1000).toString();
const hex = (c: string) => (c || "000000").replace(/^#/, "").toUpperCase().padEnd(6, "0").slice(0, 6);

/** Cores fixas do desenho (como no Office): fundo branco, texto e eixos em cinza. */
const COR_FUNDO = "FFFFFF";
const COR_TITULO = "404040";
const COR_TEXTO = "595959";
const COR_GRADE = "E3E3E3";
const COR_EIXO = "BFBFBF";

type Modo = "tela" | "export";

/**
 * SVG do gráfico da forma. `modo` escolhe a unidade das medidas:
 * "tela" acompanha o zoom (cqw) e "export" sai em pt para a rasterização.
 */
export function svgDoGrafico(s: Shape, ctx: CtxRender, modo: Modo = "tela"): string {
  const g = s.grafico;
  if (!g) return "";
  const u = (pt: number) => (modo === "tela" ? cq(pt, ctx) : n3(pt));
  const W = Math.max(1, (s.box.w / 100) * ctx.larguraPt);
  const H = Math.max(1, (s.box.h / 100) * ctx.alturaPt);

  const pad = 7;
  const temTitulo = !!g.titulo;
  const nSeries = Math.max(1, g.series.length);
  const temLegenda = g.legenda ?? nSeries > 1;
  const redondo = g.tipo === "pizza" || g.tipo === "rosca";
  const altTitulo = temTitulo ? 17 : 0;
  const altLegenda = temLegenda ? 15 : 0;
  const largEixoY = redondo ? 0 : 30;
  const altEixoX = redondo ? 0 : 14;
  const x0 = pad + largEixoY;
  const y0 = pad + altTitulo;
  const x1 = W - pad;
  const y1 = H - pad - altLegenda - altEixoX;

  const paleta = paletaDeSeries(nSeries, undefined, g.cores);
  const escala = escalaDeValores(g);
  const v2y = (v: number) => y1 - ((v - escala.min) / (escala.max - escala.min || 1)) * (y1 - y0);

  const partes: string[] = [fundoXml(s, W, H, u)];
  if (temTitulo) {
    partes.push(
      `<text x="${u(W / 2)}" y="${u(pad + 11.5)}" text-anchor="middle" font-family="sans-serif" font-size="${u(12)}" font-weight="700" fill="#${COR_TITULO}">${esc(g.titulo ?? "")}</text>`
    );
  }

  if (redondo) {
    partes.push(pizzaXml(g, x0, y0, x1, y1, paleta, u));
  } else {
    partes.push(eixosXml(g, escala, x0, y0, x1, y1, u, v2y));
    partes.push(seriesXml(g, escala, paleta, x0, y0, x1, y1, u, v2y));
  }

  if (temLegenda) {
    const itens = redondo
      ? g.categorias.map((c, i) => ({ cor: paleta[i % paleta.length], nome: c }))
      : g.series.map((serie, i) => ({ cor: paleta[i % paleta.length], nome: serie.nome }));
    partes.push(legendaXml(itens, W, H - pad - 4, u));
  }

  const estilo = modo === "tela" ? ` style="width:${u(W)};height:${u(H)}"` : ` width="${n3(W)}" height="${n3(H)}"`;
  return `<svg class="pp-grafico" viewBox="0 0 ${n3(W)} ${n3(H)}"${estilo} xmlns="http://www.w3.org/2000/svg" aria-hidden="true">${partes.join("")}</svg>`;
}

/** Container do gráfico na lâmina (mesmas classes das outras formas ricas, para o palco achar e selecionar). */
export function htmlGrafico(s: Shape, ctx: CtxRender): string {
  const sel = ctx.selecionada === s.id;
  const est = [`left:${n3(s.box.x)}%`, `top:${n3(s.box.y)}%`, `width:${n3(s.box.w)}%`, `height:${n3(s.box.h)}%`];
  if (s.rot) est.push(`transform:rotate(${n3(s.rot)}deg)`);
  if (s.opacity !== undefined && s.opacity < 1) est.push(`opacity:${n3(s.opacity)}`);
  const classes =
    `pp-shape pp-rica pp-grafico-box${sel ? " selected" : ""}${s.fixa ? " pp-fixa" : ""}` +
    `${ctx.editando === s.id ? " pp-editando" : ""}${s.bloqueada ? " pp-bloqueada" : ""}`;
  const sombra = s.shadow
    ? `filter:drop-shadow(${cq((Math.cos((s.shadow.dir * Math.PI) / 180) * s.shadow.dist), ctx)} ${cq((Math.sin((s.shadow.dir * Math.PI) / 180) * s.shadow.dist), ctx)} ${cq(s.shadow.blur / 2, ctx)} ${rgba(s.shadow.color, s.shadow.alpha)});`
    : "";
  return `<div class="${classes}" data-shape="${s.id}" data-kind="forma" style="${est.join(";")}"><div class="pp-grafico-moldura" style="${sombra}">${svgDoGrafico(s, ctx, "tela")}</div></div>`;
}

// ---------------------------------------------------------------------------
// pedaços
// ---------------------------------------------------------------------------

function fundoXml(s: Shape, W: number, H: number, u: (pt: number) => string): string {
  const rect = `<rect x="0" y="0" width="${u(W)}" height="${u(H)}" rx="${u(4)}"`;
  const fill: Fill | undefined = s.fillX;
  if (fill?.kind === "none") return `${rect} fill="none"/>`;
  if (fill?.kind === "solid") return `${rect} fill="${rgba(fill.color ?? COR_FUNDO, fill.alpha ?? 1)}"/>`;
  if (fill?.kind === "gradient" && fill.stops?.length) {
    const id = `gf${s.id}`;
    const rad = ((fill.angle ?? 90) * Math.PI) / 180;
    const cx = Math.cos(rad) / 2;
    const cy = Math.sin(rad) / 2;
    const stops = fill.stops
      .map((p) => `<stop offset="${n3(Math.max(0, Math.min(100, p.pos)))}%" stop-color="#${hex(p.color)}" stop-opacity="${n3(p.alpha ?? 1)}"/>`)
      .join("");
    const def =
      `<linearGradient id="${id}" x1="${n3(0.5 - cx)}" y1="${n3(0.5 - cy)}" x2="${n3(0.5 + cx)}" y2="${n3(0.5 + cy)}">${stops}</linearGradient>`;
    return `<defs>${def}</defs>${rect} fill="url(#${id})"/>`;
  }
  return `${rect} fill="#${COR_FUNDO}"/>`;
}

function eixosXml(
  g: Grafico,
  escala: Escala,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  u: (pt: number) => string,
  v2y: (v: number) => number
): string {
  const partes: string[] = [];
  // grade horizontal + rótulos do eixo de valor
  for (const t of escala.ticks) {
    const y = v2y(t);
    partes.push(`<line x1="${u(x0)}" y1="${u(y)}" x2="${u(x1)}" y2="${u(y)}" stroke="#${COR_GRADE}" stroke-width="${u(0.8)}"/>`);
    partes.push(
      `<text x="${u(x0 - 4)}" y="${u(y + 3)}" text-anchor="end" font-family="sans-serif" font-size="${u(8.5)}" fill="#${COR_TEXTO}">${esc(formatarValor(t))}</text>`
    );
  }
  // eixos
  partes.push(`<line x1="${u(x0)}" y1="${u(y0)}" x2="${u(x0)}" y2="${u(y1)}" stroke="#${COR_EIXO}" stroke-width="${u(1)}"/>`);
  partes.push(`<line x1="${u(x0)}" y1="${u(y1)}" x2="${u(x1)}" y2="${u(y1)}" stroke="#${COR_EIXO}" stroke-width="${u(1)}"/>`);
  // categorias (rotaciona quando a banda é estreita demais)
  const banda = (x1 - x0) / Math.max(1, g.categorias.length);
  const rotaciona = banda < 34;
  g.categorias.forEach((c, i) => {
    const cx = x0 + banda * (i + 0.5);
    if (rotaciona) {
      partes.push(
        `<text x="${u(cx)}" y="${u(y1 + 9)}" text-anchor="end" transform="rotate(-35 ${u(cx)} ${u(y1 + 9)})" font-family="sans-serif" font-size="${u(8.5)}" fill="#${COR_TEXTO}">${esc(encurtar(c, 14))}</text>`
      );
    } else {
      partes.push(
        `<text x="${u(cx)}" y="${u(y1 + 10)}" text-anchor="middle" font-family="sans-serif" font-size="${u(8.5)}" fill="#${COR_TEXTO}">${esc(encurtar(c, Math.max(6, Math.floor(banda / 5))))}</text>`
      );
    }
  });
  return partes.join("");
}

function seriesXml(
  g: Grafico,
  escala: Escala,
  paleta: string[],
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  u: (pt: number) => string,
  v2y: (v: number) => number
): string {
  const partes: string[] = [];
  const nCat = Math.max(1, g.categorias.length);
  const plotW = x1 - x0;
  const plotH = y1 - y0;
  const v2x = (v: number) => x0 + ((v - escala.min) / (escala.max - escala.min || 1)) * plotW;
  const empilhado = !!g.empilhado && (g.tipo === "colunas" || g.tipo === "barras" || g.tipo === "area");

  if (g.tipo === "colunas" || g.tipo === "barras") {
    const vertical = g.tipo === "colunas";
    const banda = (vertical ? plotW : plotH) / nCat;
    const grupo = banda * 0.72;
    const barra = grupo / Math.max(1, g.series.length);
    const acumulado = g.categorias.map(() => 0);
    g.series.forEach((serie, k) => {
      const cor = paleta[k % paleta.length];
      g.categorias.forEach((_, j) => {
        const v = Number(serie.valores[j]) || 0;
        if (vertical) {
          const cx = x0 + banda * (j + 0.5);
          const bx = empilhado ? cx - grupo / 2 : cx - grupo / 2 + barra * k;
          const bw = empilhado ? grupo : barra * 0.86;
          const base = empilhado ? v2y(acumulado[j]) : v2y(0);
          const topo = empilhado ? v2y(acumulado[j] + v) : v2y(v);
          const y = Math.min(base, topo);
          const h = Math.max(0.5, Math.abs(base - topo));
          partes.push(`<rect x="${u(bx)}" y="${u(y)}" width="${u(bw)}" height="${u(h)}" fill="#${hex(cor)}" rx="${u(0.6)}"/>`);
          if (g.rotulos && h > 10) partes.push(rotuloValor(v, bx + bw / 2, y - 2.5, u));
        } else {
          const cy = y0 + banda * (j + 0.5);
          const by = empilhado ? cy - grupo / 2 : cy - grupo / 2 + barra * k;
          const bh = empilhado ? grupo : barra * 0.86;
          const base = empilhado ? v2x(acumulado[j]) : v2x(0);
          const fim = empilhado ? v2x(acumulado[j] + v) : v2x(v);
          const x = Math.min(base, fim);
          const w = Math.max(0.5, Math.abs(fim - base));
          partes.push(`<rect x="${u(x)}" y="${u(by)}" width="${u(w)}" height="${u(bh)}" fill="#${hex(cor)}" rx="${u(0.6)}"/>`);
          if (g.rotulos && w > 16) partes.push(rotuloValor(v, x + w + 2, by + bh / 2 + 3, u, "start"));
        }
        acumulado[j] += v;
      });
    });
    return partes.join("");
  }

  if (g.tipo === "linhas" || g.tipo === "area" || g.tipo === "dispersao") {
    const banda = plotW / nCat;
    const acumulado = g.categorias.map(() => 0);
    g.series.forEach((serie, k) => {
      const cor = paleta[k % paleta.length];
      const pontos = g.categorias.map((_, j) => {
        const v = Number(serie.valores[j]) || 0;
        const yv = empilhado ? acumulado[j] + v : v;
        acumulado[j] += v;
        return { x: x0 + banda * (j + 0.5), y: v2y(yv), v: yv };
      });
      const lista = pontos.map((p) => `${n3(p.x)},${n3(p.y)}`).join(" ");
      if (g.tipo === "area") {
        const primeiro = pontos[0];
        const ultimo = pontos[pontos.length - 1];
        const fecho = `${n3(ultimo?.x ?? x0)},${n3(y1)} ${n3(primeiro?.x ?? x0)},${n3(y1)}`;
        partes.push(`<polygon points="${lista} ${fecho}" fill="#${hex(cor)}" fill-opacity="0.32"/>`);
        partes.push(`<polyline points="${lista}" fill="none" stroke="#${hex(cor)}" stroke-width="${u(1.6)}" stroke-linejoin="round"/>`);
      } else {
        const d = pontos.map((p, i) => `${i === 0 ? "M" : "L"}${n3(p.x)} ${n3(p.y)}`).join(" ");
        partes.push(`<path d="${d}" fill="none" stroke="#${hex(cor)}" stroke-width="${u(1.8)}" stroke-linejoin="round" stroke-linecap="round"/>`);
      }
      for (const p of pontos) {
        partes.push(`<circle cx="${u(p.x)}" cy="${u(p.y)}" r="${u(g.tipo === "dispersao" ? 3 : 2.2)}" fill="#${hex(cor)}"/>`);
        if (g.rotulos) partes.push(rotuloValor(p.v, p.x, p.y - 4, u));
      }
    });
    return partes.join("");
  }

  return partes.join("");
}

function pizzaXml(
  g: Grafico,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  paleta: string[],
  u: (pt: number) => string
): string {
  const cx = (x0 + x1) / 2;
  const cy = (y0 + y1) / 2;
  const r = Math.max(4, Math.min(x1 - x0, y1 - y0) / 2 - 2);
  const serie = g.series[0];
  const valores = (serie?.valores ?? []).map((v) => Math.abs(Number(v) || 0));
  const total = valores.reduce((a, v) => a + v, 0);
  if (!total) return `<circle cx="${u(cx)}" cy="${u(cy)}" r="${u(r)}" fill="#${COR_GRADE}"/>`;
  const furo = g.tipo === "rosca" ? r * 0.55 : 0;
  const partes: string[] = [];
  let ang = -Math.PI / 2;
  valores.forEach((v, i) => {
    const fatia = (v / total) * Math.PI * 2;
    const a0 = ang;
    const a1 = ang + fatia;
    const cor = hex(paleta[i % paleta.length]);
    const grande = fatia > Math.PI ? 1 : 0;
    const p = (raio: number, a: number) => `${n3(cx + Math.cos(a) * raio)} ${n3(cy + Math.sin(a) * raio)}`;
    let d: string;
    if (furo) {
      d =
        `M${p(r, a0)} A${n3(r)} ${n3(r)} 0 ${grande} 1 ${p(r, a1)} L${p(furo, a1)} ` +
        `A${n3(furo)} ${n3(furo)} 0 ${grande} 0 ${p(furo, a0)} Z`;
    } else {
      d = `M${n3(cx)} ${n3(cy)} L${p(r, a0)} A${n3(r)} ${n3(r)} 0 ${grande} 1 ${p(r, a1)} Z`;
    }
    partes.push(`<path d="${d}" fill="#${cor}" stroke="#${COR_FUNDO}" stroke-width="${u(1)}"/>`);
    if (g.rotulos && fatia > 0.28) {
      const meio = (a0 + a1) / 2;
      const raioTxt = furo ? (r + furo) / 2 : r * 0.65;
      partes.push(
        `<text x="${u(cx + Math.cos(meio) * raioTxt)}" y="${u(cy + Math.sin(meio) * raioTxt + 3)}" text-anchor="middle" font-family="sans-serif" font-size="${u(8.5)}" font-weight="700" fill="#${COR_FUNDO}">${Math.round((v / total) * 100)}%</text>`
      );
    }
    ang = a1;
  });
  return partes.join("");
}

function rotuloValor(v: number, x: number, y: number, u: (pt: number) => string, anchor = "middle"): string {
  return `<text x="${u(x)}" y="${u(y)}" text-anchor="${anchor}" font-family="sans-serif" font-size="${u(8.5)}" font-weight="600" fill="#${COR_TEXTO}">${esc(formatarValor(v))}</text>`;
}

function legendaXml(itens: { cor: string; nome: string }[], W: number, y: number, u: (pt: number) => string): string {
  if (!itens.length) return "";
  const larguraItem = Math.min(120, Math.max(46, W / Math.max(1, itens.length)));
  const largura = itens.length * larguraItem;
  const xIni = Math.max(2, (W - largura) / 2);
  return itens
    .map((it, i) => {
      const x = xIni + i * larguraItem;
      return (
        `<rect x="${u(x)}" y="${u(y - 6)}" width="${u(6)}" height="${u(6)}" rx="${u(1.5)}" fill="#${hex(it.cor)}"/>` +
        `<text x="${u(x + 9)}" y="${u(y)}" font-family="sans-serif" font-size="${u(8.5)}" fill="#${COR_TEXTO}">${esc(encurtar(it.nome, 16))}</text>`
      );
    })
    .join("");
}

function formatarValor(v: number): string {
  const arredondado = Math.round(v * 100) / 100;
  if (Math.abs(arredondado) >= 10000) return `${Math.round(arredondado / 1000)}k`;
  return String(arredondado).replace(".", ",");
}

function encurtar(t: string, max: number): string {
  const s = String(t ?? "");
  return s.length > max ? s.slice(0, Math.max(1, max - 1)) + "…" : s;
}

// ---------------------------------------------------------------------------
// exportação: gráfico -> PNG (o .pptx recebe a imagem; reabrir mostra o desenho)
// ---------------------------------------------------------------------------

/** Rasteriza o gráfico para um data URL PNG (2x para ficar nítido no arquivo). */
export async function graficoParaPng(s: Shape, larguraPt: number, alturaPt: number): Promise<string | null> {
  if (!s.grafico || typeof document === "undefined") return null;
  const W = (s.box.w / 100) * larguraPt;
  const H = (s.box.h / 100) * alturaPt;
  if (W < 1 || H < 1) return null;
  const ctx: CtxRender = { larguraPt, alturaPt, media: {}, editavel: false };
  const svg = svgDoGrafico(s, ctx, "export");
  const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
  try {
    const img = new Image();
    await new Promise<void>((ok, erro) => {
      img.onload = () => ok();
      img.onerror = () => erro(new Error("não foi possível desenhar o gráfico"));
      img.src = url;
    });
    const escala = 2;
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(2, Math.round(W * escala));
    canvas.height = Math.max(2, Math.round(H * escala));
    const c = canvas.getContext("2d");
    if (!c) return null;
    c.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/png");
  } catch {
    return null;
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * Troca cada gráfico por uma imagem PNG antes de gravar o .pptx (o escritor já sabe
 * gravar imagens; o arquivo mantém o desenho em vez de perder o gráfico).
 */
export async function prepararGraficos(deck: Deck, setup: DeckSetup): Promise<Deck> {
  if (!deck.slides.some((sl) => sl.shapes.some((s) => s.grafico))) return deck;
  const { w, h } = aspectSize(setup);
  const larguraPt = w * 72;
  const alturaPt = h * 72;
  const slides = await Promise.all(
    deck.slides.map(async (sl) => {
      if (!sl.shapes.some((s) => s.grafico)) return sl;
      const shapes = await Promise.all(
        sl.shapes.map(async (s): Promise<Shape> => {
          if (!s.grafico) return s;
          const png = await graficoParaPng(s, larguraPt, alturaPt);
          if (!png) {
            // sem canvas (ambiente inesperado): um retângulo com o título, em vez de o gráfico sumir do arquivo
            const texto = s.grafico.titulo || "Gráfico";
            const fallback: Shape = {
              ...s,
              paras: [{ runs: [{ text: texto, size: 16, bold: true, italic: false, underline: false, strike: false, color: "404040", font: s.fontFamily }], align: "centro", lvl: 0, marL: 0, indent: 0, spcBef: 0, spcAft: 0, endSize: 16 }],
              anchor: "ctr",
              geom: "rect",
            };
            delete fallback.grafico;
            delete fallback.fillX;
            delete fallback.ln;
            return fallback;
          }
          const imagem: Shape = { ...s, kind: "imagem", src: png, geom: "rect", name: s.name || "Gráfico" };
          delete imagem.grafico;
          delete imagem.fillX;
          delete imagem.ln;
          return imagem;
        })
      );
      return { ...sl, shapes };
    })
  );
  return { ...deck, slides };
}
