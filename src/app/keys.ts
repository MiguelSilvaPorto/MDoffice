// Atalhos de teclado do app.
//
// O que cada tecla faz mora em `keymap.ts` — aqui só se escuta o teclado e se
// despacha para o atalho que casar. É isso que permite trocar as teclas na aba
// Atalhos das Configurações.

import type { App } from "./app";
import { atalhoDoEvento, emCaptura } from "./keymap";

export const keysMethods = {
  setupKeys(this: App): void {
    window.addEventListener("keydown", (e) => {
      // A aba Atalhos está esperando a próxima tecla para trocar um atalho: quem
      // manda lá é ela, e o resto do app fica quieto.
      if (emCaptura()) return;

      // Esc sai do modo foco. Fica de fora da lista configurável de propósito: é a
      // tecla universal de "cancelar", não uma escolha do app.
      if (e.key === "Escape" && document.body.classList.contains("focus-mode") && !document.querySelector(".modal-backdrop")) {
        this.toggleFocus(false);
        return;
      }

      const atalho = atalhoDoEvento(this, e);
      if (!atalho) return;
      e.preventDefault();
      atalho.acao?.(this, e);
    });
  },
};
