// Menus suspensos (⋯, clique direito) e seus itens.

import type { App } from "./app";
import { $, h } from "../util";

export const menusMethods = {
  /** Menu suspenso solto (botão direito) numa posição da tela. */
  openMenuAt(this: App, x: number, y: number, items: { label: string; hint?: string; run: () => void; sep?: boolean }[]): void {
    this.closeMenus();
    const menu = h("div", { class: "dropdown" });
    for (const it of items) {
      if (it.sep) this.ddSep(menu);
      this.ddItem(menu, { label: it.label, hint: it.hint, onPick: it.run });
    }
    document.body.append(menu);
    menu.style.left = `${Math.max(8, Math.min(x, window.innerWidth - menu.offsetWidth - 8))}px`;
    menu.style.top = `${Math.max(8, Math.min(y, window.innerHeight - menu.offsetHeight - 8))}px`;
    const dismiss = (ev: MouseEvent) => {
      if (!menu.contains(ev.target as Node)) {
        this.closeMenus();
        document.removeEventListener("mousedown", dismiss, true);
      }
    };
    document.addEventListener("mousedown", dismiss, true);
  },

  closeMenus(this: App): void {
    document.querySelectorAll(".dropdown").forEach((m) => m.remove());
  },

  openMenu(this: App, anchor: HTMLElement, build: (menu: HTMLElement) => void): void {
    const wasOpen = !!document.querySelector(".dropdown");
    this.closeMenus();
    if (wasOpen) return;
    const menu = h("div", { class: "dropdown" });
    build(menu);
    document.body.append(menu);
    const r = anchor.getBoundingClientRect();
    const w = menu.offsetWidth;
    const left = Math.max(8, Math.min(r.right - w, window.innerWidth - w - 8));
    menu.style.left = `${left}px`;
    menu.style.top = `${Math.min(r.bottom + 6, window.innerHeight - menu.offsetHeight - 8)}px`;
    const dismiss = (ev: MouseEvent) => {
      if (!menu.contains(ev.target as Node)) {
        this.closeMenus();
        document.removeEventListener("mousedown", dismiss, true);
      }
    };
    document.addEventListener("mousedown", dismiss, true);
  },

  ddItem(this: App, 
    menu: HTMLElement,
    opts: { icon?: string; label: string; hint?: string; checked?: boolean; onPick: () => void }
  ): void {
    const btn = h("button", { class: "dd-item", type: "button" });
    if (opts.icon) btn.innerHTML = `<svg class="ic"><use href="#${opts.icon}"/></svg>`;
    btn.append(h("span", { text: opts.label }));
    if (opts.hint) btn.append(h("span", { class: "dd-hint", text: opts.hint }));
    if (opts.checked) btn.insertAdjacentHTML("beforeend", '<svg class="ic dd-check"><use href="#i-check"/></svg>');
    btn.addEventListener("click", () => {
      this.closeMenus();
      opts.onPick();
    });
    menu.append(btn);
  },

  ddSep(this: App, menu: HTMLElement): void {
    menu.append(h("div", { class: "dd-sep" }));
  },

  ddNote(this: App, menu: HTMLElement, text: string): void {
    menu.append(h("div", { class: "dd-note", text }));
  },
};
