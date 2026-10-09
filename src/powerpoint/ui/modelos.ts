// Galeria do botão Template (fita): cartões com a prévia de cada modelo — fundo, texto, acento e fonte.
import { MODELOS, type ModeloPPT } from "../edicao/modelos";
import { themeOf } from "../themes";
import { abrirPopup, fecharPopup } from "./popup";

const esc = (t: string) => t.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c] ?? c);

/** Abre a galeria de modelos; `aoEscolher` recebe o modelo clicado. */
export function abrirModelos(ancora: HTMLElement, aoEscolher: (m: ModeloPPT) => void): void {
  const cartoes = MODELOS.map((m, i) => {
    const t = themeOf(m.tema);
    const bg = m.bg || t.bg;
    return `<button type="button" class="pp-tpl" data-i="${i}" title="${esc(m.nome)} — ${esc(m.descricao)}">
      <span class="pp-tpl-previa" style="background:#${bg};color:#${t.fg}">
        <span class="pp-tpl-aa" style="font-family:'${esc(m.fonte)}'">Aa</span>
        <span class="pp-tpl-linhas">
          <span style="background:#${t.fg}"></span>
          <span style="background:#${t.muted}"></span>
          <span style="background:#${t.accent}"></span>
        </span>
      </span>
      <span class="pp-tpl-nome">${esc(m.nome)}</span>
    </button>`;
  }).join("");
  const el = abrirPopup(ancora, `<div class="pp-pop-t">Modelos de apresentação</div><div class="pp-tpls">${cartoes}</div>`, { classe: "pp-pop-modelos", alinharDireita: true });
  el.addEventListener("click", (e) => {
    const b = (e.target as HTMLElement).closest<HTMLElement>("[data-i]");
    if (!b) return;
    fecharPopup();
    aoEscolher(MODELOS[Number(b.dataset.i)]);
  });
}
