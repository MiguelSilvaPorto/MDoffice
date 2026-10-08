// Abas de documentos (estilo Chrome): uma fileira horizontal, uma aba por documento.
import type { EditorState } from "@codemirror/state";
import type { CursorPos } from "./editor";
import type { WritingIssue } from "./writing";
import { baseName, h, stripExt, uid } from "./util";

/** Tudo o que pertence a UM documento aberto. */
export interface DocTab {
  id: string;
  /** "settings" é a aba de Configurações (não tem texto); o resto são documentos. */
  kind?: "doc" | "settings" | "word";
  /** Dados do documento Word (só nas abas kind "word"). */
  word?: import("./word/host").WordTabData;
  path: string | null;
  title: string | null;
  isDraft: boolean;
  dirty: boolean;
  statusSaved: string;
  autoFixArmed: boolean;
  ignoredHere: Set<string>;
  issues: WritingIssue[];
  /** Estado do CodeMirror: texto, seleção e histórico de desfazer só desta aba. */
  state: EditorState;
  scrollTop: number;
  cursor: CursorPos;
  /** Seções recolhidas no painel Estrutura deste documento. */
  outlineCollapsed: Set<string>;
}

export function newTab(state: EditorState, init: Partial<DocTab> = {}): DocTab {
  return {
    id: uid(),
    path: null,
    title: null,
    isDraft: false,
    dirty: false,
    statusSaved: "Novo documento",
    autoFixArmed: false,
    ignoredHere: new Set(),
    issues: [],
    state,
    scrollTop: 0,
    cursor: { line: 1, col: 1 },
    outlineCollapsed: new Set(),
    ...init,
  };
}

/** Nome mostrado na aba (sem a extensão .md). */
export function tabLabel(t: DocTab): string {
  if (t.kind === "settings") return "Configurações";
  return t.path ? stripExt(baseName(t.path)) : t.title ?? "Sem título";
}

export interface TabBarHooks {
  onSelect: (id: string) => void;
  onClose: (id: string) => void;
  onNew: () => void;
  /** Abre o menu do "+" (escolher o tipo de arquivo novo). */
  onNewMenu: (anchor: HTMLElement) => void;
  onRename: (id: string, value: string) => void;
  /** Nova ordem das abas (ids), depois de arrastar. */
  onReorder: (ids: string[]) => void;
  onContext: (id: string, x: number, y: number) => void;
  onRecents: (anchor: HTMLElement) => void;
}

export class TabBar {
  readonly el: HTMLElement;
  private strip: HTMLElement;
  private hooks: TabBarHooks;
  private renaming = false;

  constructor(host: HTMLElement, hooks: TabBarHooks) {
    this.hooks = hooks;
    this.el = host;
    this.strip = h("div", { class: "tab-strip", role: "tablist" });
    const plus = h("button", { class: "tab-new", type: "button", title: "Novo (Ctrl+T) — documento, planilha ou apresentação", "aria-label": "Novo" });
    plus.innerHTML = '<svg class="ic"><use href="#i-plus"/></svg>';
    plus.addEventListener("click", () => hooks.onNewMenu(plus));
    const recents = h("button", { class: "tab-recents", type: "button", title: "Recentes e rascunhos" });
    recents.innerHTML = '<svg class="ic"><use href="#i-clock"/></svg><span>Recentes</span>';
    recents.addEventListener("click", () => hooks.onRecents(recents));
    this.el.append(this.strip, plus, h("span", { class: "tab-fill" }), recents);

    // roda do mouse rola a fileira de abas quando há muitas
    this.strip.addEventListener(
      "wheel",
      (e) => {
        if (this.strip.scrollWidth <= this.strip.clientWidth) return;
        this.strip.scrollLeft += e.deltaY || e.deltaX;
        e.preventDefault();
      },
      { passive: false }
    );
  }

  render(tabs: DocTab[], activeId: string): void {
    if (this.renaming) return;
    this.strip.textContent = "";
    for (const t of tabs) this.strip.append(this.buildTab(t, t.id === activeId, tabs.length));
    this.el.classList.toggle("single", tabs.length === 1);
    this.strip.querySelector<HTMLElement>(".tab.active")?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }

  private buildTab(t: DocTab, active: boolean, total: number): HTMLElement {
    const label = tabLabel(t);
    const settings = t.kind === "settings";
    const el = h("div", {
      class: `tab${active ? " active" : ""}${!settings && t.dirty ? " dirty" : ""}${!settings && (t.isDraft || !t.path) ? " draft" : ""}${settings ? " special" : ""}`,
      "data-kind": t.kind ?? "doc",
      role: "tab",
      "aria-selected": String(active),
      "data-id": t.id,
      title: t.path ? `${t.path}\nDuplo clique ou F2 para renomear` : `${label} (ainda não salvo)\nDuplo clique ou F2 para renomear`,
    });
    const icon = h("span", { class: "tab-ic" });
    icon.innerHTML = `<svg class="ic"><use href="#${settings ? "i-gear" : t.kind === "word" ? "i-word" : "i-doc"}"/></svg>`;
    const name = h("span", { class: "tab-name", text: label });
    const dot = h("span", { class: "tab-dot", title: "Alterações ainda não gravadas" });
    const close = h("button", { class: "tab-x", type: "button", title: "Fechar aba (Ctrl+W)", "aria-label": `Fechar ${label}` });
    close.innerHTML = '<svg class="ic"><use href="#i-close"/></svg>';
    close.addEventListener("mousedown", (e) => e.stopPropagation());
    close.addEventListener("click", (e) => {
      e.stopPropagation();
      this.hooks.onClose(t.id);
    });
    el.append(icon, name, dot, close);

    el.addEventListener("dblclick", (e) => {
      if (settings || (e.target as HTMLElement).closest(".tab-x")) return;
      this.beginRename(t.id);
    });
    el.addEventListener("auxclick", (e) => {
      if (e.button === 1) {
        e.preventDefault();
        this.hooks.onClose(t.id);
      }
    });
    el.addEventListener("contextmenu", (e) => {
      e.preventDefault();
      this.hooks.onContext(t.id, e.clientX, e.clientY);
    });
    this.enableDrag(el, t.id, total);
    return el;
  }

  /** Arrastar a aba muda a ordem; um clique simples só seleciona. */
  private enableDrag(el: HTMLElement, id: string, total: number): void {
    el.addEventListener("pointerdown", (e) => {
      if (e.button !== 0 || (e.target as HTMLElement).closest(".tab-x") || this.renaming) return;
      const startX = e.clientX;
      let dragging = false;
      let baseLeft = 0;
      const selectNow = () => this.hooks.onSelect(id);
      if (!el.classList.contains("active")) selectNow();
      if (total < 2) return;

      const move = (ev: PointerEvent) => {
        const dx = ev.clientX - startX;
        if (!dragging) {
          if (Math.abs(dx) < 5) return;
          dragging = true;
          baseLeft = el.getBoundingClientRect().left;
          el.classList.add("dragging");
          try {
            el.setPointerCapture(ev.pointerId);
          } catch {
            /* ignora */
          }
        }
        const siblings = Array.from(this.strip.querySelectorAll<HTMLElement>(".tab"));
        el.style.transform = `translateX(${ev.clientX - startX}px)`;
        const myCenter = el.getBoundingClientRect().left + el.getBoundingClientRect().width / 2;
        for (const other of siblings) {
          if (other === el) continue;
          const r = other.getBoundingClientRect();
          const mid = r.left + r.width / 2;
          const idxMe = siblings.indexOf(el);
          const idxOther = siblings.indexOf(other);
          if ((idxOther > idxMe && myCenter > mid) || (idxOther < idxMe && myCenter < mid)) {
            if (idxOther > idxMe) other.after(el);
            else other.before(el);
            // compensa o salto do layout para a aba continuar embaixo do ponteiro
            const now = el.getBoundingClientRect().left;
            el.style.transform = `translateX(${ev.clientX - startX - (now - baseLeft)}px)`;
            break;
          }
        }
      };
      const up = (ev: PointerEvent) => {
        el.removeEventListener("pointermove", move);
        el.removeEventListener("pointerup", up);
        el.removeEventListener("pointercancel", up);
        try {
          el.releasePointerCapture(ev.pointerId);
        } catch {
          /* ignora */
        }
        if (!dragging) return;
        el.classList.remove("dragging");
        el.style.transform = "";
        const ids = Array.from(this.strip.querySelectorAll<HTMLElement>(".tab")).map((x) => x.dataset.id!);
        this.hooks.onReorder(ids);
      };
      el.addEventListener("pointermove", move);
      el.addEventListener("pointerup", up);
      el.addEventListener("pointercancel", up);
    });
  }

  /** Troca o nome da aba por um campo de texto (Enter confirma, Esc cancela). */
  beginRename(id: string): void {
    const el = this.strip.querySelector<HTMLElement>(`.tab[data-id="${id}"]`);
    const nameEl = el?.querySelector<HTMLElement>(".tab-name");
    if (!el || !nameEl || this.renaming || el.dataset.kind === "settings") return;
    const current = nameEl.textContent || "";
    this.renaming = true;
    const input = h("input", { class: "tab-input", type: "text", value: current, spellcheck: "false" });
    input.title = "Enter confirma · Esc cancela";
    nameEl.replaceWith(input);
    input.focus();
    input.select();
    let settled = false;
    const finish = (keep: boolean) => {
      if (settled) return;
      settled = true;
      const value = input.value.trim();
      this.renaming = false;
      const label = h("span", { class: "tab-name", text: current });
      input.replaceWith(label);
      if (keep && value && value !== current) this.hooks.onRename(id, value);
    };
    input.addEventListener("blur", () => finish(true));
    input.addEventListener("keydown", (e) => {
      e.stopPropagation();
      if (e.key === "Enter") {
        e.preventDefault();
        finish(true);
      } else if (e.key === "Escape") {
        e.preventDefault();
        finish(false);
      }
    });
    input.addEventListener("pointerdown", (e) => e.stopPropagation());
    input.addEventListener("dblclick", (e) => e.stopPropagation());
  }
}
