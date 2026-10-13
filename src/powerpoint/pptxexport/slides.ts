// Monta uma lâmina do .pptx a partir do modelo: formas posicionadas quando existem,
// senão converte o Markdown em blocos de texto (título, listas, parágrafos).
import { marked } from "marked";
import DOMPurify from "dompurify";
import { aspectSize, type DeckSetup, type Slide } from "../schema";
import { escreverForma } from "./shapes";
import { coresTema } from "./theme";

type PptxSlide = {
  addText: Function;
  addImage: Function;
  addShape: Function;
  shapes?: Record<string, unknown>;
  /** cor de fundo da lâmina (aceita pelo PptxGenJS) */
  background?: { color: string };
  /** oculta na apresentação: o PptxGenJS grava `show="0"` no `p:sld` da lâmina */
  hidden?: boolean;
  /** nome interno da lâmina (o PptxGenJS grava no `name` do p:cSld; vazio = sem nome) */
  _name?: string;
};

/** Uma linha de texto com o estilo que ela herda do markdown. */
interface Bloco {
  texto: string;
  tamanho: number;
  negrito: boolean;
  bullet: boolean;
}

/** Converte o Markdown da lâmina em blocos (título, item de lista, parágrafo). */
export function markdownEmBlocos(md: string): Bloco[] {
  if (!md.trim()) return [];
  const html = DOMPurify.sanitize(marked.parse(md, { gfm: true, async: false }) as string);
  const caixa = document.createElement("div");
  caixa.innerHTML = html;
  const saida: Bloco[] = [];
  const andar = (no: Element, tamanho: number, negrito: boolean) => {
    for (const filho of Array.from(no.children)) {
      const tag = filho.tagName.toLowerCase();
      if (tag === "ul" || tag === "ol") {
        for (const li of Array.from(filho.children)) {
          const texto = (li.textContent ?? "").trim();
          if (texto) saida.push({ texto, tamanho, negrito, bullet: true });
        }
      } else if (tag === "h1" || tag === "h2" || tag === "h3") {
        const texto = (filho.textContent ?? "").trim();
        const n = tag === "h1" ? 34 : tag === "h2" ? 26 : 20;
        if (texto) saida.push({ texto, tamanho: n, negrito: true, bullet: false });
      } else if (tag === "pre") {
        const texto = (filho.textContent ?? "").trim();
        if (texto) saida.push({ texto, tamanho: 14, negrito: false, bullet: false });
      } else {
        const texto = (filho.textContent ?? "").trim();
        if (texto) saida.push({ texto, tamanho, negrito, bullet: false });
      }
    }
    // markdown só com texto solto (sem tags)
    if (!no.children.length) {
      const texto = (no.textContent ?? "").trim();
      if (texto) saida.push({ texto, tamanho, negrito, bullet: false });
    }
  };
  andar(caixa, 18, false);
  return saida;
}

/** Desenha a lâmina no slide do .pptx. */
export function escreverLamina(slide: PptxSlide, s: Slide, setup: DeckSetup): void {
  const cores = coresTema(setup);
  const { w: lw, h: lh } = aspectSize(setup);

  // fundo da lâmina
  slide.background = { color: cores.bg };

  // 1) formas posicionadas — o caminho "PowerPoint de verdade"
  if (s.shapes.length) {
    for (const forma of s.shapes) escreverForma(slide, forma, setup, cores.fg);
    return;
  }

  // 2) sem formas: converte o markdown em blocos empilhados
  const blocos = markdownEmBlocos(s.md);
  if (!blocos.length) return;
  const margem = 0.06;
  const largura = lw * (1 - margem * 2);
  let y = lh * margem;
  // a capa/seção fica centralizada
  const centralizado = s.layout === "titulo" || s.layout === "secao";
  if (centralizado) y = (lh - blocos.reduce((a, b) => a + b.tamanho / 72, 0) * 1.3) / 2;

  for (const b of blocos) {
    // 1 pt de altura ≈ 1/72 pol; damos 1,3 de entrelinha
    const altura = Math.max(0.32, (b.tamanho / 72) * 1.3);
    if (y + altura > lh * 0.94) break; // não estoura a lâmina
    slide.addText(
      [{ text: b.texto, options: { fontSize: b.tamanho, bold: b.negrito, bullet: b.bullet ? true : undefined } }],
      {
        x: lw * margem,
        y,
        w: largura,
        h: altura,
        fontFace: setup.fontFamily.replace(/["']/g, ""),
        color: b.negrito ? cores.fg : cores.muted,
        align: centralizado ? "center" : "left",
        valign: "middle",
      }
    );
    y += altura * (b.bullet ? 1.05 : 1.15);
  }
}

/**
 * Passa para a lâmina do PptxGenJS o que o modelo sabe e ele não: se está oculta
 * (ele grava `show="0"` no `p:sld` — é o que o PowerPoint lê) e se tem nome próprio.
 * O nome vai depois, na pós-processagem do pacote: o PptxGenJS não escapa `&` nem
 * aspas no `name`, e o padrão "Slide N" dele não é nome escolhido e sujaria o round-trip.
 */
export function marcarLamina(slide: PptxSlide, s: Slide): void {
  slide.hidden = s.show === false;
  slide._name = "";
}

/** Põe o nome da lâmina no `name` do `p:cSld` do XML (substitui o valor que já existir). */
export function comNomeDaCld(xml: string, nome: string): string {
  const esc = nome.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return xml.replace(/<p:cSld\b[^>]*>/, (tag) => (/\bname="/.test(tag) ? tag.replace(/\bname="[^"]*"/, () => `name="${esc}"`) : tag.replace("<p:cSld", () => `<p:cSld name="${esc}"`)));
}

/**
 * Põe `show="0"` no `p:sld` da lâmina oculta. O PptxGenJS já faz isso nas lâminas que
 * escreve; este é para as lâminas ricas, cujo XML é trocado pelo do Escritor.
 */
export function comOcultaNoSld(xml: string): string {
  return xml.replace(/<p:sld\b[^>]*>/, (tag) => (/\bshow=/.test(tag) ? tag : tag.replace(/(\/?>)$/, (fim) => ` show="0"${fim}`)));
}

/**
 * Marca `show="0"` nos `p:sldId` (na ordem das lâminas) das lâminas ocultas.
 * O `p:sldId` é o lugar combinado com o importador; o `show="0"` do `p:sld`
 * (que o PptxGenJS já grava) continua sendo o que o PowerPoint lê.
 */
export function comOcultasNoSldId(pres: string, ocultas: number[]): string {
  if (!ocultas.length) return pres;
  let i = 0;
  return pres.replace(/<p:sldId\b[^>]*>/g, (tag) => {
    if (!ocultas.includes(i++) || /\bshow=/.test(tag)) return tag;
    return tag.replace(/(\/?>)$/, (fim) => ` show="0"${fim}`);
  });
}
