// Movimento de saída das superfícies flutuantes (modais, menus, popups).
//
// Os fechamentos do app removem o elemento direto do body (backdrop.remove()).
// Em vez de pedir que cada fechamento saiba de animação, um MutationObserver
// percebe a remoção e devolve o elemento por um instante com a classe "saindo":
// o CSS (styles/movimento.css) faz a despedida e o elemento some de verdade.
// Com "menos movimento" no sistema, nada disso acontece.

/** Classes que ganham a animação de saída. */
const SUPERFICIES = [
  "modal-backdrop",
  "dropdown",
  "pp-popup",
  "wd-menu-pop",
  "xl-menu",
  "cm-issue-popup",
  "editor-context-menu",
];

/** Rede de segurança: se a animação não rodar, o elemento some mesmo assim. */
const LIMITE = 420;

export function ligarMovimentoDeSaida(): void {
  if (typeof MutationObserver === "undefined" || !document.body) return;

  new MutationObserver((lote) => {
    for (const mutacao of lote) {
      for (const no of Array.from(mutacao.removedNodes)) {
        if (!(no instanceof HTMLElement)) continue;
        if (no.classList.contains("saindo") || no.classList.contains("sem-despedida")) continue;
        if (!SUPERFICIES.some((classe) => no.classList.contains(classe))) continue;
        if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) continue;
        despedir(no);
      }
    }
  }).observe(document.body, { childList: true });
}

/** Devolve o elemento ao body com a classe "saindo" e o remove quando a animação acabar. */
function despedir(el: HTMLElement): void {
  el.classList.add("saindo");
  document.body.append(el);
  let feito = false;
  const fim = () => {
    if (feito) return;
    feito = true;
    el.remove();
  };
  el.addEventListener("animationend", fim, { once: true });
  window.setTimeout(fim, LIMITE);
}
