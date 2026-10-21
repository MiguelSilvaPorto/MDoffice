// Popups flutuantes da fita e do painel (cores, galeria de formas, menus). Um de cada vez, fecham ao clicar fora ou com Esc.
// A âncora fica guardada: é o que deixa o MESMO botão recolher o que abriu (ver `ancoraDoPopup`).
let aberto: { el: HTMLElement; ancora: HTMLElement; fechar: () => void } | null = null;

export function fecharPopup(): void {
  aberto?.fechar();
  aberto = null;
}

/**
 * A âncora (o botão) que abriu o popup que está aberto — `null` se não há popup. Quem despacha
 * o clique do botão compara com isto: clicar de novo no MESMO botão recolhe o que ele abriu.
 */
export function ancoraDoPopup(): HTMLElement | null {
  return aberto?.ancora ?? null;
}

export interface OpcoesPopup {
  /** classes extras do popup */
  classe?: string;
  /** chamado ao fechar */
  aoFechar?: () => void;
  /** alinha a borda direita do popup com a da âncora */
  alinharDireita?: boolean;
  /** submenu: abre AO LADO da âncora (à direita; à esquerda quando não cabe) */
  aoLado?: boolean;
}

/** Caixa da âncora (o `getBoundingClientRect()` do botão) e janela útil. */
export interface Caixa {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

/** Margem das bordas da janela e o vão entre a âncora e o menu. */
const MARGEM = 8;
const VAO = 4;
/** Abaixo disso o menu não é útil nem rolando: prefere o lado com mais espaço. */
const MINIMO = 160;

/**
 * Onde abre um SUBMENU (o "Organizar" do menu de contexto): **ao lado** da âncora, à
 * direita dela e, quando não couber, à esquerda. O topo acompanha o item e só sobe o
 * suficiente para o menu inteiro caber na janela — nunca vai para o canto da tela.
 * Se nem assim couber na altura, encolhe com rolagem interna.
 */
export function posicaoDoSubmenu(
  r: Caixa,
  largura: number,
  altura: number,
  janela: { w: number; h: number }
): { left: number; top: number; maxAltura: number | null } {
  let left = r.right + VAO;
  if (left + largura > janela.w - MARGEM) left = r.left - VAO - largura;
  left = Math.max(MARGEM, Math.min(left, janela.w - largura - MARGEM));
  const alturaUtil = Math.min(altura, janela.h - 2 * MARGEM);
  const top = Math.max(MARGEM, Math.min(r.top, janela.h - MARGEM - alturaUtil));
  return { left, top, maxAltura: alturaUtil < altura ? alturaUtil : null };
}

/**
 * Onde o menu abre: logo abaixo da âncora — e **nunca por cima dela**. Quando não cabe embaixo,
 * o menu encolhe (com rolagem interna) em vez de subir: subir tapava o próprio botão e o clique
 * seguinte (o de reabrir/fechar) caía no menu em vez do botão. Só vai para cima quando lá há
 * mais espaço, e aí termina ANTES da âncora (`top + maxAltura = topo da âncora - VAO`).
 */
export function posicaoDoPopup(
  r: Caixa,
  largura: number,
  altura: number,
  janela: { w: number; h: number },
  alinharDireita = false,
  aoLado = false
): { left: number; top: number; maxAltura: number | null } {
  if (aoLado) return posicaoDoSubmenu(r, largura, altura, janela);
  let left = alinharDireita ? r.right - largura : r.left;
  left = Math.max(MARGEM, Math.min(left, janela.w - largura - MARGEM));
  const abaixo = Math.max(0, janela.h - (r.bottom + VAO) - MARGEM);
  const acima = Math.max(0, r.top - VAO - MARGEM);
  if (altura <= abaixo) return { left, top: r.bottom + VAO, maxAltura: null };
  if (acima > Math.max(abaixo, MINIMO)) {
    const maxAltura = acima;
    return { left, top: Math.max(MARGEM, r.top - VAO - Math.min(altura, maxAltura)), maxAltura };
  }
  return { left, top: r.bottom + VAO, maxAltura: Math.max(MINIMO, abaixo) };
}

/** Abre um popup logo abaixo do elemento âncora. Devolve o elemento raiz. */
export function abrirPopup(ancora: HTMLElement, html: string, op: OpcoesPopup = {}): HTMLElement {
  // A caixa da âncora é medida ANTES de fechar o popup aberto: o item que abre um submenu
  // (o "Organizar" do menu de contexto) está DENTRO do popup que vai fechar. Depois de
  // removido, `getBoundingClientRect()` devolve tudo zero — era isso que jogava o submenu
  // no extremo do canto superior esquerdo (a posição virava só a margem).
  const r = ancora.getBoundingClientRect();
  fecharPopup();
  const el = document.createElement("div");
  el.className = `pp-popup ${op.classe ?? ""}`;
  el.innerHTML = html;
  document.body.append(el);
  const p = posicaoDoPopup(r, el.offsetWidth, el.offsetHeight, { w: window.innerWidth, h: window.innerHeight }, op.alinharDireita, op.aoLado);
  if (p.maxAltura !== null) el.style.maxHeight = `${p.maxAltura}px`;
  el.style.left = `${p.left}px`;
  el.style.top = `${p.top}px`;

  const fora = (e: Event) => {
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
  setTimeout(() => {
    document.addEventListener("pointerdown", fora, true);
    document.addEventListener("mousedown", fora, true);
  }, 0);
  document.addEventListener("keydown", tecla, true);
  aberto = {
    el,
    ancora,
    fechar: () => {
      document.removeEventListener("pointerdown", fora, true);
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
