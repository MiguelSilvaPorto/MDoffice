// Galeria de formas (Inserir > Formas): miniaturas desenhadas pelo mesmo motor de geometria das lâminas.
import { GALERIA, type ItemGaleria } from "../edicao/criar";
import { tracadoDoPreset } from "../render/presets";
import { abrirPopup, fecharPopup } from "./popup";

/** Miniatura SVG de uma forma da galeria. */
export function iconeDeForma(item: ItemGaleria, tam = 26): string {
  const w = 22;
  const h = item.ehLinha ? 12 : 16;
  const tr = tracadoDoPreset(item.geom, w, h, item.adj);
  const seta = (item.linha?.tail ? 1 : 0) + (item.linha?.head ? 1 : 0);
  const caminhos = tr
    .map((t) => `<path d="${t.d}" fill="${t.preenche ? "currentColor" : "none"}" fill-opacity="${t.preenche ? 0.18 : 0}" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round" stroke-linecap="round"${t.evenodd ? ' fill-rule="evenodd"' : ""}/>`)
    .join("");
  let setas = "";
  if (item.ehLinha && seta) {
    if (item.linha?.tail) setas += `<path d="M${w - 5} ${h - 3.5}L${w} ${h}L${w - 3.5} ${h - 5}Z" fill="currentColor"/>`;
    if (item.linha?.head) setas += `<path d="M5 3.5L0 0L3.5 5Z" fill="currentColor"/>`;
  }
  const oy = (22 - h) / 2;
  return `<svg viewBox="-2 ${-oy - 2} ${w + 4} ${22 + 4 - oy * 0}" width="${tam}" height="${tam}" aria-hidden="true"><g transform="translate(0 ${oy})">${caminhos}${setas}</g></svg>`;
}

/** Abre a galeria; `aoEscolher` recebe o item clicado e `aoDesenhar` é o "Draw" (desenho à mão). */
export function abrirGaleria(ancora: HTMLElement, aoEscolher: (item: ItemGaleria) => void, aoDesenhar?: () => void): void {
  const grupos = [...new Set(GALERIA.map((g) => g.grupo))];
  const html =
    grupos
      .map((g) => {
        const itens = GALERIA.filter((x) => x.grupo === g);
        return `<div class="pp-pop-t">${g}</div><div class="pp-galeria">${itens
          .map((it) => `<button type="button" class="pp-gal-item" data-i="${GALERIA.indexOf(it)}" title="${it.rotulo}" aria-label="${it.rotulo}">${iconeDeForma(it)}</button>`)
          .join("")}</div>`;
      })
      .join("") +
    `<div class="pp-pop-t">Desenho</div><div class="pp-galeria">
      <button type="button" class="pp-gal-item pp-gal-draw" data-desenhar title="Draw — desenho à mão: rabisque na lâmina e o app ajusta a forma" aria-label="Draw (desenho à mão)">${iconeDoLapis()}</button>
    </div>`;
  const el = abrirPopup(ancora, html, { classe: "pp-pop-galeria" });
  el.addEventListener("click", (e) => {
    const alvo = e.target as HTMLElement;
    if (alvo.closest("[data-desenhar]")) {
      fecharPopup();
      aoDesenhar?.();
      return;
    }
    const b = alvo.closest<HTMLElement>("[data-i]");
    if (!b) return;
    const item = GALERIA[Number(b.dataset.i)];
    fecharPopup();
    aoEscolher(item);
  });
}

/** Lápis do "Draw" (mesma linguagem de traço das formas). */
function iconeDoLapis(): string {
  return (
    `<svg viewBox="0 0 22 22" width="26" height="26" aria-hidden="true">` +
    `<path d="M3.5 18.5l1-3.6L15.2 4.2a1.7 1.7 0 0 1 2.4 0l.2.2a1.7 1.7 0 0 1 0 2.4L7.1 17.5l-3.6 1Z" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/>` +
    `<path d="M13.6 5.8l2.6 2.6" stroke="currentColor" stroke-width="1.4"/>` +
    `</svg>`
  );
}
