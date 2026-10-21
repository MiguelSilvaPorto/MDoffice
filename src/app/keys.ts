// Atalhos de teclado do app.
//
// O que cada tecla faz mora em `keymap.ts` — aqui só se escuta o teclado e se
// despacha para o atalho que casar. É isso que permite trocar as teclas na aba
// Atalhos das Configurações.

import type { App } from "./app";
import { atalhoDoEvento, emCaptura } from "./keymap";

export const keysMethods = {
  setupKeys(this: App): void {
    // Tab com sugestão fantasma na tela: aceita, antes do navegador usar a tecla para passar o
    // foco ao próximo botão (no app de desktop não havia essa disputa). Escuta na captura, então
    // chega primeiro, inclusive quando o foco saiu do texto (um clique na barra) e a sugestão
    // continuou à vista — era o "aperto Tab e ele pula do Desenhar para o Exportar".
    window.addEventListener(
      "keydown",
      (e) => {
        if (e.key !== "Tab" || e.shiftKey || e.ctrlKey || e.altKey || e.metaKey || e.isComposing) return;
        if (emCaptura() || document.querySelector(".modal-backdrop")) return;
        // outro campo de texto (busca, Configurações, caixa do PowerPoint): o Tab é dele
        const alvo = e.target as HTMLElement | null;
        const editorDom = this.tab.kind === "word" ? this.wordHost.editorDom() : this.tab.kind === "doc" || !this.tab.kind ? this.editor.view.dom : null;
        if (!editorDom || !editorDom.isConnected || editorDom.offsetParent === null) return;
        if (alvo?.closest?.("input, textarea, select, [contenteditable]") && !editorDom.contains(alvo)) return;
        const aceitou = this.tab.kind === "word" ? this.wordHost.aceitarSugestao() : this.editor.aceitarSugestao();
        if (!aceitou) return;
        e.preventDefault();
        e.stopPropagation();
      },
      true
    );

    window.addEventListener("keydown", (e) => {
      // A aba Atalhos está esperando a próxima tecla para trocar um atalho: quem
      // manda lá é ela, e o resto do app fica quieto.
      if (emCaptura()) return;

      // A busca de funções (Ctrl+K) está aberta: a digitação é dela. Só passa a
      // troca de aba (Ctrl+1…9) — o resto dos atalhos ficaria quieto para não
      // salvar o documento nem aplicar negrito no meio da busca.
      const alvo = e.target as HTMLElement | null;
      if (alvo?.closest?.("#busca")) {
        if ((e.ctrlKey || e.metaKey) && /^[1-9]$/.test(e.key)) return;
        return;
      }

      // Em qualquer outro campo (a busca da barra lateral, a barra de fórmulas da
      // planilha, os campos das Configurações), o atalho do app não dispara: a
      // pessoa está digitando. Os editores (Markdown e Word) são contenteditable,
      // então continuam recebendo os atalhos.
      if (alvo?.closest?.("input, textarea")) return;

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
