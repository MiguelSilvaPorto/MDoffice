// Botões minimizar, maximizar e fechar da janela sem moldura.

import type { App } from "./app";
import { getCurrentWindow } from "@tauri-apps/api/window";

export const windowControlsMethods = {
  /** Controles de janela integrados (minimizar, maximizar/restaurar, fechar e arrastar). */
  setupWindowControls(this: App): void {
    const btnMin = document.getElementById("win-min");
    const btnMax = document.getElementById("win-max");
    const btnClose = document.getElementById("win-close");
    const topbar = document.getElementById("topbar");

    // Remove barra branca nativa no Tauri e ativa sombra
    try {
      const win = getCurrentWindow();
      void win.setDecorations(false);
      void win.setShadow(true);
    } catch {
      /* ambiente web/preview */
    }

    const updateMaxIcon = async () => {
      try {
        const isMax = await getCurrentWindow().isMaximized();
        if (btnMax) {
          const use = btnMax.querySelector("use");
          if (use) {
            use.setAttribute("href", isMax ? "#i-win-restore" : "#i-win-max");
          }
          btnMax.title = isMax ? "Restaurar tamanho" : "Maximizar";
          btnMax.setAttribute("aria-label", btnMax.title);
        }
      } catch {
        /* ambiente sem janela nativa (preview no navegador) */
      }
    };

    btnMin?.addEventListener("click", () => {
      try {
        void getCurrentWindow().minimize();
      } catch {}
    });

    btnMax?.addEventListener("click", async () => {
      try {
        await getCurrentWindow().toggleMaximize();
        await updateMaxIcon();
      } catch {}
    });

    btnClose?.addEventListener("click", async () => {
      try {
        await this.autosave();
        await getCurrentWindow().close();
      } catch {}
    });

    // Duplo clique na barra superior alterna maximizar
    topbar?.addEventListener("dblclick", (e) => {
      const target = e.target as HTMLElement;
      if (!target.closest("button, input, a, .win-btn, .btn, .split-btn, .busca")) {
        try {
          void getCurrentWindow().toggleMaximize().then(updateMaxIcon);
        } catch {}
      }
    });

    // Arrastar janela com o mouse (fallback seguro para além do data-tauri-drag-region)
    topbar?.addEventListener("mousedown", (e) => {
      if (e.button !== 0) return;
      const target = e.target as HTMLElement;
      if (!target.closest("button, input, a, .win-btn, .btn, .split-btn, .busca")) {
        try {
          void getCurrentWindow().startDragging();
        } catch {}
      }
    });

    // Sincroniza ícone de maximizar ao redimensionar
    window.addEventListener("resize", () => {
      void updateMaxIcon();
    });

    void updateMaxIcon();
  },
};
