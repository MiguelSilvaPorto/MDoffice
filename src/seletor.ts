// O `<select>` nativo abre a lista do SISTEMA: cinza, com a fonte do Windows e fora do tema.
// Este módulo dá ao select a cara do app e troca a lista aberta pelo MESMO menu suspenso do
// ⋯, sem tirar o select do DOM: ele continua sendo a fonte da verdade (value, options,
// disabled e o evento `change` continuam valendo para todo o código que já existe).
//
// Uso: depois de montar uma tela/painel, chame `melhorarSelects(raiz)`.
import { h } from "./util";

interface MenuAberto {
  select: HTMLSelectElement;
  face: HTMLElement;
  menu: HTMLElement;
}

let aberto: MenuAberto | null = null;
const melhorados = new WeakSet<HTMLSelectElement>();

/** O rótulo que o controle mostra (a opção escolhida). */
function rotuloDe(select: HTMLSelectElement): string {
  const op = select.selectedOptions[0] ?? null;
  return op ? (op.label || op.textContent || "").trim() : "";
}

/** A cara do controle acompanha o estado atual do select (vazio = em branco, como o nativo). */
export function sincronizarSeletor(select: HTMLSelectElement): void {
  const rot = select.closest<HTMLElement>(".sel-wrap")?.querySelector<HTMLElement>("[data-sel-rotulo]");
  if (rot) rot.textContent = rotuloDe(select);
}

function fecharMenu(animar = true): void {
  if (!aberto) return;
  const { face, menu } = aberto;
  aberto = null;
  face.setAttribute("aria-expanded", "false");
  if (!animar) menu.classList.add("sem-despedida");
  menu.remove();
}

// Listeners registrados UMA vez, na carga do módulo: assim rodam ANTES dos que as janelas
// registram depois (a fase de captura segue a ordem de registro) — o Esc fecha só a lista,
// sem fechar o diálogo por baixo.
document.addEventListener(
  "keydown",
  (e) => {
    if (!aberto) return;
    if (e.key === "Escape") {
      // as janelas escutam Esc no mesmo nó (document, captura): só o "immediate" impede
      // que o diálogo por baixo também feche
      e.preventDefault();
      e.stopImmediatePropagation();
      const face = aberto.face;
      fecharMenu();
      face.focus();
    }
  },
  true
);

document.addEventListener(
  "mousedown",
  (e) => {
    if (!aberto) return;
    const alvo = e.target as Node;
    // clicar na própria cara é alternância (o clique fecha): não fecha aqui
    if (!aberto.menu.contains(alvo) && !aberto.face.contains(alvo)) fecharMenu();
  },
  true
);

function abrirMenu(select: HTMLSelectElement, face: HTMLElement): void {
  if (aberto?.select === select) {
    fecharMenu();
    return;
  }
  fecharMenu(false);
  const atual = select.value;
  const menu = h("div", { class: "dropdown sel-menu" }) as HTMLElement;
  for (const op of Array.from(select.options)) {
    if (op.disabled) continue;
    const item = h("button", { class: "dd-item", type: "button" });
    item.append(h("span", { text: (op.label || op.textContent || "").trim() }));
    if (op.value === atual) item.insertAdjacentHTML("beforeend", '<svg class="ic dd-check"><use href="#i-check"/></svg>');
    item.addEventListener("click", () => {
      const mudou = select.value !== op.value;
      fecharMenu();
      face.focus();
      if (!mudou) return;
      select.value = op.value; // o setter interceptado sincroniza a cara
      select.dispatchEvent(new Event("change", { bubbles: true }));
    });
    menu.append(item);
  }
  document.body.append(menu);
  const r = face.getBoundingClientRect();
  const w = menu.offsetWidth;
  const hh = menu.offsetHeight;
  let top = r.bottom + 4;
  if (top + hh > window.innerHeight - 8) top = Math.max(8, r.top - hh - 4);
  menu.style.left = `${Math.max(8, Math.min(r.right - w, window.innerWidth - w - 8))}px`;
  menu.style.top = `${top}px`;
  face.setAttribute("aria-expanded", "true");
  aberto = { select, face, menu };
}

/** Melhora UM select (idempotente). */
export function melhorarSeletor(select: HTMLSelectElement): void {
  if (melhorados.has(select) || select.closest(".sel-wrap")) return;
  melhorados.add(select);

  // o wrapper herda as classes do select para cada contexto continuar estilizando igual
  const wrap = document.createElement("span");
  wrap.className = `${select.className} sel-wrap`;
  select.classList.add("sel-oculto");
  select.before(wrap);
  wrap.append(select);

  const face = document.createElement("button");
  face.type = "button";
  face.className = "sel-face";
  face.setAttribute("aria-haspopup", "menu");
  face.setAttribute("aria-expanded", "false");
  if (select.title) face.title = select.title;
  const aria = select.getAttribute("aria-label");
  if (aria) face.setAttribute("aria-label", aria);
  face.innerHTML = `<span data-sel-rotulo></span><svg class="ic"><use href="#i-chevron"/></svg>`;
  wrap.append(face);

  face.addEventListener("click", () => {
    if (select.disabled) return;
    abrirMenu(select, face);
  });

  // `value` programático não gera mutação no DOM: intercepta o setter para a cara acompanhar
  const desc = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value")!;
  Object.defineProperty(select, "value", {
    configurable: true,
    get(this: HTMLSelectElement) {
      return desc.get!.call(this) as string;
    },
    set(this: HTMLSelectElement, v: string) {
      desc.set!.call(this, v);
      sincronizarSeletor(this);
    },
  });

  // opções reconstruídas, `selected` e `disabled` mudam por mutação: o observador sincroniza
  new MutationObserver(() => sincronizarSeletor(select)).observe(select, {
    childList: true,
    subtree: true,
    attributes: true,
  });

  sincronizarSeletor(select);
}

/** Melhora todos os `<select>` de um contêiner (chame depois de montar a tela). */
export function melhorarSelects(raiz: ParentNode): void {
  raiz.querySelectorAll<HTMLSelectElement>("select").forEach((s) => melhorarSeletor(s));
}

/**
 * Fecha a lista aberta quando o select que a abriu está dentro de `raiz`
 * (usado antes de redesenhar um painel: sem isso a lista fica presa a um controle que sumiu).
 */
export function fecharSeletor(raiz?: ParentNode): void {
  if (aberto && (!raiz || raiz.contains(aberto.select))) fecharMenu();
}
