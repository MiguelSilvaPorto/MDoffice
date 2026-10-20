// A prévia REAL de uma lâmina de .pptx: o documento é importado e as formas são desenhadas com o
// MESMO renderizador do palco e da apresentação — tema, posições, textos e imagens. O HTML usa
// porcentagem e `cqw`, então o cartão só precisa de um palco com a proporção da lâmina: ela
// encolhe sozinha, sem uma "reconstrução" de texto que parece um cartão genérico.
//
// Módulo puro (sem DOM): a tela Início injeta o HTML no cartão.

import { aspectSize, THEME_COLORS, type Deck, type DeckSetup } from "./powerpoint/schema";
import { DEFAULT_SETUP } from "./powerpoint/model";
import { pptxToDeck } from "./powerpoint/pptximport";
import { fundoValor, htmlFormaRica, type CtxRender } from "./powerpoint/render/forma";

/** O HTML da primeira lâmina do deck (null = deck vazio). */
export function htmlDaLaminaDoDeck(deck: Deck, setup: DeckSetup): string | null {
  const slide = deck.slides[0];
  if (!slide) return null;
  const { w, h } = aspectSize(setup);
  const ctx: CtxRender = {
    larguraPt: w * 72,
    alturaPt: h * 72,
    media: setup.media ?? {},
    selecionada: null,
    editavel: false,
    editando: null,
    celulaEdit: null,
  };
  // o fundo da lâmina; sem fundo próprio, o do tema do deck (senão o texto claro sumiria no branco)
  const fundo = fundoValor(slide.bg, setup.media ?? {}) || `#${THEME_COLORS[setup.theme]?.bg ?? "FFFFFF"}`;
  const formas = slide.shapes.map((f) => htmlFormaRica(f, ctx)).join("");
  return `<span class="home-prev home-prev-lamina-real" style="background:${fundo};aspect-ratio:${w} / ${h}"><span class="home-prev-lamina-palco">${formas}</span></span>`;
}

/** O HTML da primeira lâmina a partir dos bytes do .pptx (null = não deu para ler). */
export async function htmlDaLaminaDeBytes(bytes: Uint8Array): Promise<string | null> {
  try {
    const { deck, setup } = await pptxToDeck(bytes, DEFAULT_SETUP);
    return htmlDaLaminaDoDeck(deck, setup);
  } catch {
    return null;
  }
}
