// "Formalizar texto": a prévia antes/depois do registro informal → formal.
//
// O comando pega a SELEÇÃO; sem seleção, o documento inteiro. Quem monta a janela é o
// `src/formalizar.ts` (broker + interface); aqui é só a ponte com o editor: ler o alvo,
// entregar o texto e aplicar o resultado numa transação única (Ctrl+Z desfaz tudo).

import { abrirFormalizar } from "../formalizar";
import { toast } from "../util";
import type { App } from "./app";

export const formalizarMethods = {
  openFormalizar(this: App): void {
    const tipo = this.tab.kind;
    if (tipo === "word" || tipo === "ppt" || tipo === "xlsx" || tipo === "settings") {
      toast("A formalização com prévia está disponível no editor Markdown.", "info", 3400);
      return;
    }
    const view = this.editor.view;
    const sel = view.state.selection.main;
    const temSelecao = sel.from !== sel.to;
    const from = temSelecao ? sel.from : 0;
    const to = temSelecao ? sel.to : view.state.doc.length;
    const texto = view.state.doc.sliceString(from, to);
    if (!texto.trim()) {
      toast("Não há texto para formalizar.", "info", 2600);
      return;
    }
    abrirFormalizar({
      texto,
      origem: temSelecao ? "seleção" : "documento inteiro",
      aplicar: (novo) => {
        this.editor.replaceRange(from, to, novo);
        this.checkWritingSoon();
        toast("Texto formalizado. Ctrl+Z desfaz.", "ok", 3800);
      },
    });
  },
};
