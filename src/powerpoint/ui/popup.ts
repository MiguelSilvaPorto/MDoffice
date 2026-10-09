// Popups flutuantes da fita e do painel (cores, galeria de formas, menus). Um de cada vez, fecham ao clicar fora ou com Esc.
let aberto: { el: HTMLElement; fechar: () => void } | null = null;

export function fecharPopup(): void {
  aberto?.fechar();
  aberto = null;
}

export interface OpcoesPopup {
  /** classes extras do popup */
  classe?: string;
  /** chamado ao fechar */
  aoFechar?: () => void;
  /** alinha a borda direita do popup com a da âncora */
  alinharDireita?: boolean;
}

/** Abre um popup logo abaixo do elemento âncora. Devolve o elemento raiz. */
export function abrirPopup(ancora: HTMLElement, html: string, op: OpcoesPopup = {}): HTMLElement {
  fecharPopup();
  const el = document.createElement("div");
  el.className = `pp-popup ${op.classe ?? ""}`;
  el.innerHTML = html;
  document.body.append(el);
  const r = ancora.getBoundingClientRect();
  const w = el.offsetWidth;
  const h = el.offsetHeight;
  let left = op.alinharDireita ? r.right - w : r.left;
  left = Math.max(8, Math.min(left, window.innerWidth - w - 8));
  let top = r.bottom + 4;
  if (top + h > window.innerHeight - 8) top = Math.max(8, r.top - h - 4);
  el.style.left = `${left}px`;
  el.style.top = `${top}px`;

  const fora = (e: MouseEvent) => {
    const t = e.target as Node;
    if (el.contains(t) || ancora.contains(t)) return;
    fecharPopup();
  };
  const tecla = (e: KeyboardEvent) => {
    if (e.key === "Escape") {
      e.stopPropagation();
      fecharPopup();
    }
  };
  setTimeout(() => document.addEventListener("mousedown", fora, true), 0);
  document.addEventListener("keydown", tecla, true);
  aberto = {
    el,
    fechar: () => {
      document.removeEventListener("mousedown", fora, true);
      document.removeEventListener("keydown", tecla, true);
      el.remove();
      op.aoFechar?.();
    },
  };
  return el;
}

/** Está um popup aberto? */
export function popupAberto(): boolean {
  return aberto !== null;
}
