// Atalhos de teclado do app.

import type { App } from "./app";
import { $ } from "../util";

export const keysMethods = {
  setupKeys(this: App): void {
    window.addEventListener("keydown", (e) => {
      if (e.key === "F1") {
        e.preventDefault();
        this.showWelcome();
        return;
      }
      if (e.key === "F5") {
        // apresentar: o documento vira uma sequência de slides (separados por ---)
        e.preventDefault();
        this.openSlides();
        return;
      }
      if (e.key === "F7") {
        e.preventDefault();
        this.openReview();
        return;
      }
      if (e.key === "Escape" && document.body.classList.contains("focus-mode") && !document.querySelector(".modal-backdrop")) {
        this.toggleFocus(false);
        return;
      }
      if (e.key === "F2" && !document.querySelector(".modal-backdrop")) {
        e.preventDefault();
        this.tabBar.beginRename(this.tab.id);
        return;
      }
      const ctrl = e.ctrlKey || e.metaKey;
      if (!ctrl) return;
      const k = e.key.toLowerCase();
      const inModal = !!document.querySelector(".modal-backdrop");
      if (k === "s") {
        e.preventDefault();
        if (!inModal) void this.save(e.shiftKey);
        return;
      }
      if (inModal) return;
      if (k === "k" && !e.shiftKey && !e.altKey) {
        e.preventDefault();
        this.openPalette();
      } else if (e.shiftKey && k === "f") {
        e.preventDefault();
        this.toggleFocus();
      } else if (e.key === "Tab") {
        e.preventDefault();
        void this.switchRelative(e.shiftKey ? -1 : 1);
      } else if (k === "w") {
        e.preventDefault();
        void this.closeTab(this.activeTabId());
      } else if (k === "t" && e.shiftKey) {
        e.preventDefault();
        void this.reopenClosedTab();
      } else if (k === "t" && !e.altKey) {
        e.preventDefault();
        void this.newDoc();
      } else if (/^[1-9]$/.test(k) && !e.shiftKey && !e.altKey) {
        e.preventDefault();
        const target = k === "9" ? this.tabs[this.tabs.length - 1] : this.tabs[Number(k) - 1];
        if (target) void this.switchTo(target.id);
      } else if (k === "o") {
        e.preventDefault();
        void this.openDocDialog();
      } else if (k === "n") {
        e.preventDefault();
        void this.newDoc();
      } else if (e.altKey && k === "t") {
        e.preventDefault();
        this.toggleTranslation();
      } else if (e.shiftKey && k === "d") {
        e.preventDefault();
        void this.openDraw();
      } else if (e.shiftKey && k === "c") {
        e.preventDefault();
        void this.copyForAI();
      } else if (e.shiftKey && k === "e") {
        e.preventDefault();
        this.openExport();
      } else if (k === "b" && this.tab.kind !== "word" && this.tab.kind !== "xlsx") {
        e.preventDefault();
        this.act("bold");
      } else if (k === "i" && this.tab.kind !== "word" && this.tab.kind !== "xlsx") {
        e.preventDefault();
        this.act("italic");
      }
    });
  },
};
