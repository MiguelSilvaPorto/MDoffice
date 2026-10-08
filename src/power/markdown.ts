// Deck ↔ Markdown: um deck é um documento Markdown normal, com os slides separados
// por uma linha de três traços (---). Assim ele continua editável, corrigível e
// amigável para a IA — e a conversão é reversível.
import { DEFAULT_SETUP } from "./model";
import type { Deck, DeckSetup, Slide } from "./schema";

const SEPARADOR = /^\s*-{3,}\s*$/m;
const NOTAS = /^>\s?\[notas\]\s*([\s\S]*)$/im;

/** Quebra o texto nos slides crus (sem interpretar). */
export function splitSlides(texto: string): string[] {
  return texto
    .replace(/\r\n/g, "\n")
    .split(SEPARADOR)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

/** O primeiro título vira o nome do deck. */
function tituloDe(md: string): string {
  const m = /^\s*#\s+(.+)$/m.exec(md);
  return m ? m[1].trim() : "Apresentação";
}

/** Monta o modelo do deck a partir do Markdown do documento. */
export function deckFromMarkdown(texto: string, setup: DeckSetup = DEFAULT_SETUP): Deck {
  const slides: Slide[] = splitSlides(texto).map((bruto, i) => {
    const notas = NOTAS.exec(bruto);
    const md = notas ? bruto.replace(NOTAS, "").trim() : bruto;
    // heurística simples de papel: só título = capa; começa com ## = seção
    const soTitulo = /^\s*#\s+[^\n]+$/.test(md);
    const layout = i === 0 || soTitulo ? (i === 0 ? "titulo" : "secao") : "conteudo";
    return { md, layout, notes: notas ? notas[1].trim() : "" };
  });
  return { titulo: tituloDe(texto), slides };
}

/** Volta o deck para Markdown (mesmo separador), preservando as notas. */
export function deckToMarkdown(deck: Deck): string {
  return deck.slides
    .map((s) => (s.notes ? `${s.md}\n\n> [notas] ${s.notes.replace(/\n/g, "\n> ")}` : s.md))
    .join("\n\n---\n\n");
}

export { DEFAULT_SETUP };
export type { Deck, DeckSetup, Slide };
