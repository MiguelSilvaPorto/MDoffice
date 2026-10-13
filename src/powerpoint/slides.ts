// Operações sobre LÂMINAS: criar, duplicar, mover, excluir, reordenar.
// Separado do host (como o Word separa host de editor) para o host só orquestrar.
import { uid } from "../util";
import { newSlide } from "./model";
import type { Deck, Shape, Slide, SlideLayout } from "./schema";

/**
 * Prende o índice da lâmina ao intervalo válido.
 * `total` é o NÚMERO de lâminas (não o último índice) — todos os chamadores
 * passam `slides.length`, nunca `length - 1`.
 */
export function clampIndex(atual: number, total: number): number {
  if (total <= 0) return 0;
  return Math.min(Math.max(0, atual), total - 1);
}

/** Cria uma lâmina inserida logo depois da atual. */
export function insertSlide(deck: Deck, at: number, layout: SlideLayout = "conteudo"): { deck: Deck; index: number } {
  const slides = deck.slides.slice();
  const index = clampIndex(at, slides.length) + 1;
  slides.splice(index, 0, newSlide(layout));
  return { deck: { ...deck, slides }, index };
}

/** Duplica a lâmina (conteúdo + formas + notas). */
export function duplicateSlide(deck: Deck, at: number): { deck: Deck; index: number } {
  const slides = deck.slides.slice();
  const original = slides[clampIndex(at, slides.length)];
  if (!original) return { deck, index: at };
  const copia: Slide = {
    md: original.md,
    layout: original.layout,
    notes: original.notes,
    // a cópia entra como a original (a transição e o que veio cru do .pptx acompanham)
    ...(original.transicao ? { transicao: original.transicao } : {}),
    ...(original.transicaoXml ? { transicaoXml: original.transicaoXml } : {}),
    // formas ganham id novo para não compartilhar seleção
    shapes: original.shapes.map((s) => ({ ...s, id: uid() })),
    // a cópia nasce com o mesmo nome e o mesmo estado de exibição da original
    ...(original.show === false ? { show: false } : {}),
    ...(original.nome ? { nome: original.nome } : {}),
  };
  const index = at + 1;
  slides.splice(index, 0, copia);
  return { deck: { ...deck, slides }, index };
}

/** Move a lâmina de `de` para `para` (a lista final é reordenada). */
export function moveSlide(deck: Deck, de: number, para: number): { deck: Deck; index: number } {
  const slides = deck.slides.slice();
  if (de < 0 || de >= slides.length) return { deck, index: de };
  const alvo = Math.min(Math.max(0, para), slides.length - 1);
  const [movida] = slides.splice(de, 1);
  slides.splice(alvo, 0, movida);
  return { deck: { ...deck, slides }, index: alvo };
}

/** Exclui a lâmina. Devolve o deck e o índice para onde o cursor deve ficar. */
export function removeSlide(deck: Deck, at: number): { deck: Deck; index: number } {
  const slides = deck.slides.slice();
  if (!slides.length) return { deck, index: 0 };
  const i = clampIndex(at, slides.length);
  slides.splice(i, 1);
  // nunca deixa o deck vazio: o PowerPoint sempre tem no mínimo uma lâmina
  if (!slides.length) slides.push(newSlide());
  return { deck: { ...deck, slides }, index: clampIndex(i, slides.length) };
}

/** Aplica o layout pedido à lâmina atual. */
export function setLayout(deck: Deck, at: number, layout: SlideLayout): Deck {
  const i = clampIndex(at, deck.slides.length);
  const alvo = deck.slides[i];
  if (!alvo || alvo.layout === layout) return deck;
  const slides = deck.slides.slice();
  slides[i] = { ...alvo, layout };
  return { ...deck, slides };
}

/**
 * Redefine a lâmina: tira as formas próprias (as decorações `fixa` do layout/mestre ficam)
 * e devolve as caixas do layout atual. Quem chama passa as caixas já prontas
 * (`formasDoLayout`) para não acoplar este módulo ao estilo do deck.
 */
export function resetSlide(deck: Deck, at: number, caixas: Shape[]): Deck {
  const i = clampIndex(at, deck.slides.length);
  const alvo = deck.slides[i];
  if (!alvo) return deck;
  const slides = deck.slides.slice();
  slides[i] = { ...alvo, shapes: [...alvo.shapes.filter((f) => f.fixa), ...caixas] };
  return { ...deck, slides };
}

/** Substitui a lâmina inteira (usado pelo editor e pela importação). */
export function replaceSlide(deck: Deck, at: number, patch: Partial<Slide>): Deck {
  const i = clampIndex(at, deck.slides.length);
  const alvo = deck.slides[i];
  if (!alvo) return deck;
  const slides = deck.slides.slice();
  slides[i] = { ...alvo, ...patch };
  return { ...deck, slides };
}

/** Todas as formas do deck — usado pela exportação para achatar os índices. */
export function todasFormas(deck: Deck): { slide: number; shape: Shape }[] {
  const out: { slide: number; shape: Shape }[] = [];
  deck.slides.forEach((s, i) => s.shapes.forEach((shape) => out.push({ slide: i, shape })));
  return out;
}