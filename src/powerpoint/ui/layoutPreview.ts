// Miniatura de um layout de lâmina (a galeria do "Nova lâmina" e do "Layout").
//
// Sai dos MESMOS dados dos espaços (`caixasDoLayout`): cada espaço vira uma silhueta cinza
// (a área + onde o texto cai — barra do título, linhas do corpo), e a proporção acompanha
// o deck (16:9 ou 4:3). Mudou um layout, a miniatura acompanha sozinha.

import { caixasDoLayout, ORDEM_LAYOUTS, ROTULOS_LAYOUT, type Caixa } from "../edicao/layouts";
import { stageRatio, type DeckSetup, type SlideLayout } from "../schema";
import { abrirPopup, fecharPopup } from "./popup";

const LARGURA = 160; // unidades do desenho (o tamanho em tela vem do CSS)

const f = (n: number): string => (Math.round(n * 100) / 100).toString();

/** Um espaço reservado: a área como silhueta + as marcações de onde o texto vai cair. */
function silhueta(c: Caixa, l: number, a: number): string {
  const x = (c.box.x / 100) * l;
  const y = (c.box.y / 100) * a;
  const w = (c.box.w / 100) * l;
  const h = (c.box.h / 100) * a;
  const partes = [`<rect x="${f(x)}" y="${f(y)}" width="${f(w)}" height="${f(h)}" rx="${f(Math.min(2.5, h * 0.25))}" fill="#eef1f6"/>`];
  if (c.negrito) {
    // título: uma barra mais grossa, no lado em que o texto encosta (a âncora)
    const bh = Math.min(4, Math.max(3, h * 0.22));
    const by = c.anchor === "b" ? y + h - bh - 1.6 : c.anchor === "ctr" ? y + (h - bh) / 2 : y + 1.6;
    partes.push(`<rect x="${f(x + 2)}" y="${f(by)}" width="${f(Math.max(6, Math.min(w - 4, w * 0.6)))}" height="${f(bh)}" rx="1.2" fill="#b6bfcd"/>`);
  } else if (c.suave) {
    // subtítulo: uma linha fina no lugar do texto
    const by = c.anchor === "b" ? y + h - 3.2 : c.anchor === "ctr" ? y + h / 2 - 1.7 : y + 1.6;
    partes.push(`<rect x="${f(x + 2)}" y="${f(by)}" width="${f(Math.max(6, Math.min(w - 4, w * 0.5)))}" height="1.7" rx="0.8" fill="#c6cddb"/>`);
  } else {
    // corpo: até 3 linhas de texto
    const n = h > 12 ? 3 : 1;
    for (let i = 0; i < n; i++) {
      const ly = y + 2 + i * 3.8;
      const lw = w - 4 - (i === n - 1 ? w * 0.35 : 0);
      partes.push(`<rect x="${f(x + 2)}" y="${f(ly)}" width="${f(Math.max(5, lw))}" height="1.7" rx="0.8" fill="#c6cddb"/>`);
    }
  }
  return partes.join("");
}

/** Miniatura (SVG) de um layout: os espaços como silhuetas cinzas. */
export function miniaturaDeLayout(layout: SlideLayout, setup: DeckSetup): string {
  const l = LARGURA;
  const a = l / stageRatio(setup);
  const desenho = caixasDoLayout(layout)
    .map((c) => silhueta(c, l, a))
    .join("");
  return (
    `<svg class="pp-mini" viewBox="0 0 ${l} ${f(a)}" width="120" height="${Math.round((120 * a) / l)}" aria-hidden="true">` +
    `<rect width="${l}" height="${f(a)}" fill="#ffffff"/>${desenho}</svg>`
  );
}

/** A galeria em grade dos layouts (o mesmo visual no "Nova lâmina" e no "Layout"). */
export function galeriaDeLayouts(setup: DeckSetup, atual?: SlideLayout): string {
  const itens = ORDEM_LAYOUTS.map((id) => {
    const rotulo = ROTULOS_LAYOUT[id];
    return (
      `<button type="button" class="pp-lay${id === atual ? " on" : ""}" data-lay="${id}" title="${rotulo}" aria-label="${rotulo}">` +
      `${miniaturaDeLayout(id, setup)}<span>${rotulo}</span></button>`
    );
  }).join("");
  return `<div class="pp-pop-rot">${atual ? "Layout da lâmina" : "Nova lâmina"}</div><div class="pp-lays">${itens}</div>`;
}

/**
 * Abre a galeria de layouts ancorada num elemento; `aoEscolher` recebe o layout clicado. É o mesmo
 * popup no **card do fim da faixa** ("+ Nova lâmina") e no botão **Layout** da fita — uma
 * implementação só.
 */
export function abrirGaleriaDeLayouts(ancora: HTMLElement, setup: DeckSetup, aoEscolher: (l: SlideLayout) => void, atual?: SlideLayout): void {
  const el = abrirPopup(ancora, galeriaDeLayouts(setup, atual), { classe: "pp-pop-galeria pp-pop-layouts" });
  el.addEventListener("click", (ev) => {
    const b = (ev.target as HTMLElement).closest<HTMLElement>("[data-lay]");
    if (!b) return;
    fecharPopup();
    aoEscolher(b.dataset.lay as SlideLayout);
  });
}
