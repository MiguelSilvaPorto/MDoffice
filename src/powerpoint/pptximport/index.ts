// Entrada da importação: bytes de .pptx -> Deck do motor.
// Usa o JSZip (já dependencia do app, como no docxImport) para abrir o ZIP e
// ler o XML das lâminas. Testado de ponta a ponta no teste T6.

import type { Deck, DeckSetup, Slide } from "../schema";
import { DEFAULT_SETUP } from "../model";
import { notasDoSlide, ordemDosSlides, xmlParaMarkdown } from "./slides";

/** Extrai o tamanho da lâmina (em polegadas) de ppt/presentation.xml. */
async function tamanhoDoSlide(zip: any): Promise<{ w: number; h: number }> {
  const pres = await zip.file("ppt/presentation.xml")?.async("string");
  const m = pres ? /<p:sldSz[^>]*cx="(\d+)"[^>]*cy="(\d+)"/.exec(pres) : null;
  // EMU -> polegadas (914400 EMU = 1 pol)
  if (!m) return { w: 13.333, h: 7.5 };
  return { w: +m[1] / 914400, h: +m[2] / 914400 };
}

/** Lê um .pptx e devolve o deck pronto para o motor. */
export async function pptxToDeck(bytes: Uint8Array, setupBase: DeckSetup = DEFAULT_SETUP): Promise<{ deck: Deck; setup: DeckSetup }> {
  const { default: JSZip } = await import("jszip");
  const zip = await JSZip.loadAsync(bytes);

  const { w, h } = await tamanhoDoSlide(zip);
  const setup: DeckSetup = { ...setupBase, aspect: Math.abs(w / h - 16 / 9) < 0.02 ? "16:9" : "4:3" };

  const ordem = await ordemDosSlides(zip);
  const slides: Slide[] = [];
  for (let i = 0; i < ordem.length; i++) {
    const arq = zip.file(ordem[i]);
    if (!arq) continue;
    const md = xmlParaMarkdown(await arq.async("string"));
    if (!md.trim()) continue;
    const soTitulo = /^\s*#\s+[^\n]+$/.test(md);
    slides.push({
      md,
      layout: slides.length === 0 ? "titulo" : soTitulo ? "secao" : "conteudo",
      notes: await notasDoSlide(zip, i + 1),
      shapes: [],
    });
  }

  if (!slides.length) slides.push({ md: "", layout: "conteudo", notes: "", shapes: [] });
  const titulo = slides[0].md.match(/^#\s+(.+)$/m)?.[1]?.trim() ?? "Apresentação";
  return { deck: { titulo, slides }, setup };
}

export { deckParaMarkdown } from "./slides-md";
export { xmlParaMarkdown, notasDoSlide, ordemDosSlides } from "./slides";
export { textosDe, paragrafos } from "./xml";