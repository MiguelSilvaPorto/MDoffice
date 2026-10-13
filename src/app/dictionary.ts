// Janela do dicionário pessoal (palavras que o corretor deve ignorar).

import type { App } from "./app";
import { $, h, toast, saveJSON } from "../util";

export const dictionaryMethods = {
  showDictionary(this: App): void {
    const backdrop = h("div", { class: "modal-backdrop" });
    const modal = h("div", { class: "modal" });
    modal.innerHTML = `
      <header class="wm-head">
        <svg class="ic"><use href="#i-check"/></svg>
        <h2>Dicionário pessoal</h2>
        <button class="btn icon" data-close title="Fechar (Esc)"><svg class="ic"><use href="#i-close"/></svg></button>
      </header>
      <div class="wm-body">
        <p>As palavras desta lista <b>não são mais marcadas</b> como erro — nomes, marcas, termos técnicos…</p>
        <div class="dict-add">
          <input type="text" class="dict-input" placeholder="digite uma palavra (ex.: mdOffice)" />
          <button class="btn primary" data-add>Adicionar</button>
        </div>
        <div class="dict-list"></div>
      </div>`;
    backdrop.append(modal);
    document.body.append(backdrop);

    const input = modal.querySelector<HTMLInputElement>(".dict-input")!;
    const lista = modal.querySelector<HTMLElement>(".dict-list")!;
    const desenhar = () => {
      const palavras = Array.from(this.ignoreWords).sort((a, b) => a.localeCompare(b, "pt-BR"));
      lista.innerHTML = "";
      if (!palavras.length) {
        lista.append(h("p", { class: "muted", text: "Nenhuma palavra adicionada ainda." }));
        return;
      }
      for (const w of palavras) {
        const linha = h("div", { class: "dict-row" });
        linha.append(h("span", { text: w }));
        const b = h("button", { class: "btn icon", type: "button", title: "Remover do dicionário" });
        b.textContent = "×";
        b.addEventListener("click", () => {
          this.ignoreWords.delete(w);
          saveJSON("mdc.ignore-words", Array.from(this.ignoreWords));
          desenhar();
          void this.runWritingCheck();
          toast(`“${w}” voltou a ser verificada.`, "info", 2600);
        });
        linha.append(b);
        lista.append(linha);
      }
    };
    const adicionar = () => {
      const valor = input.value.trim().toLowerCase();
      if (!valor) return;
      this.ignoreWords.add(valor);
      saveJSON("mdc.ignore-words", Array.from(this.ignoreWords));
      input.value = "";
      desenhar();
      void this.runWritingCheck();
      toast(`“${valor}” adicionada ao dicionário pessoal.`, "ok", 3000);
    };
    modal.querySelector<HTMLElement>("[data-add]")!.addEventListener("click", adicionar);
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        adicionar();
      }
    });
    const close = () => {
      document.removeEventListener("keydown", onKey, true);
      backdrop.remove();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        close();
      }
    };
    document.addEventListener("keydown", onKey, true);
    backdrop.addEventListener("mousedown", (e) => {
      if (e.target === backdrop) close();
    });
    modal.querySelectorAll<HTMLElement>("[data-close]").forEach((b) => b.addEventListener("click", close));
    desenhar();
    input.focus();
  },
};
