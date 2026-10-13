// Menus suspensos (⋯, clique direito) e seus itens.

import type { App } from "./app";
import { revealItemInDir } from "@tauri-apps/plugin-opener";
import { $, copyText, h } from "../util";
import { teclaVisivel } from "./keymap";

export const menusMethods = {
  /** Menu suspenso solto (botão direito) numa posição da tela. */
  openMenuAt(this: App, x: number, y: number, items: { label: string; hint?: string; run: () => void; sep?: boolean }[]): void {
    this.openMenuPos(x, y, (menu) => {
      for (const it of items) {
        if (it.sep) this.ddSep(menu);
        this.ddItem(menu, { label: it.label, hint: it.hint, onPick: it.run });
      }
    });
  },

  /** Menu suspenso numa posição da tela, montado por quem chama (clique direito). */
  openMenuPos(this: App, x: number, y: number, build: (menu: HTMLElement) => void): void {
    this.closeMenus(false);
    const menu = h("div", { class: "dropdown" });
    build(menu);
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

  /**
   * Itens do menu de um documento da barra lateral — o MESMO menu no botão "⋯" e no
   * clique direito, para alcançar por teclado/toque. "Mover para a lixeira" é o último
   * item: não apaga nada na hora, o arquivo fica guardado por 30 dias.
   */
  fileMenuBuild(this: App, path: string): (menu: HTMLElement) => void {
    return (menu) => {
      const aberto = this.tabs.some((t) => (t.path ?? "").toLowerCase() === path.toLowerCase());
      this.ddItem(menu, { icon: "i-open", label: "Abrir", onPick: () => void this.openPath(path) });
      this.ddSep(menu);
      this.ddItem(menu, { icon: "i-folder", label: "Mostrar na pasta", onPick: () => void revealItemInDir(path).catch(() => {}) });
      this.ddItem(menu, { icon: "i-copy", label: "Copiar caminho", onPick: () => void copyText(path) });
      if (aberto) {
        this.ddSep(menu);
        this.ddItem(menu, {
          icon: "i-doc",
          label: "Renomear",
          hint: teclaVisivel("renomear"),
          onPick: () => {
            const alvo = this.tabs.find((t) => (t.path ?? "").toLowerCase() === path.toLowerCase());
            if (alvo) this.tabBar.beginRename(alvo.id);
          },
        });
      }
      this.ddSep(menu);
      this.ddItem(menu, { icon: "i-trash", label: "Mover para a lixeira", danger: true, onPick: () => void this.moveToTrash(path) });
    };
  },

  /** Menu do arquivo ancorado (botão "⋯" da barra lateral). */
  openFileMenu(this: App, anchor: HTMLElement, path: string): void {
    this.openMenu(anchor, this.fileMenuBuild(path));
  },

  /** Menu do arquivo na posição do clique direito (mesmos itens do botão "⋯"). */
  openFileMenuAt(this: App, x: number, y: number, path: string): void {
    this.openMenuPos(x, y, this.fileMenuBuild(path));
  },

  closeMenus(this: App, animar = true): void {
    document.querySelectorAll(".dropdown").forEach((m) => {
      // ao trocar de menu, o antigo some na hora (a despedida animada é para quando só se fecha)
      if (!animar) m.classList.add("sem-despedida");
      m.remove();
    });
  },

  openMenu(this: App, anchor: HTMLElement, build: (menu: HTMLElement) => void): void {
    const wasOpen = !!document.querySelector(".dropdown");
    this.closeMenus(false);
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
    opts: { icon?: string; iconHtml?: string; label: string; hint?: string; checked?: boolean; danger?: boolean; onPick: () => void }
  ): void {
    const btn = h("button", { class: `dd-item${opts.danger ? " danger" : ""}`, type: "button" });
    if (opts.iconHtml) btn.innerHTML = opts.iconHtml;
    else if (opts.icon) btn.innerHTML = `<svg class="ic"><use href="#${opts.icon}"/></svg>`;
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
