// "Formalizar texto": a prévia antes/depois do registro informal → formal.
//
// O comando pega a SELEÇÃO; sem seleção, o documento inteiro. Quem monta a janela é o
// `src/formalizar.ts` (broker + interface); aqui é a ponte com cada editor:
//   • Markdown — troca o trecho de uma vez (uma transação, Ctrl+Z desfaz tudo);
//   • Word — o documento é ProseMirror: cada troca entra no lugar dela pelo mapa da
//     projeção (`word/project.ts`), e o formato do resto fica em paz.

import type { TrocaAplicada } from "../broker/formalizar";
import { abrirFormalizar } from "../formalizar";
import { toast } from "../util";
import { projectRange, transacaoDasTrocas, type BlockMap } from "../word/project";
import type { App } from "./app";

export const formalizarMethods = {
  /** O comando único (Ctrl+Alt+F): decide o editor pela aba ativa. */
  openFormalizar(this: App): void {
    if (this.semDocumento()) return;
    if (this.tab.kind === "word") {
      this.openFormalizarWord();
      return;
    }
    const tipo = this.tab.kind;
    if (tipo === "ppt" || tipo === "xlsx" || tipo === "settings") {
      toast("A formalização com prévia está disponível no Markdown e em documentos (.docx).", "info", 3400);
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

  /** Formalizar no documento Word (fita → Revisão → Formalizar, ou Ctrl+Alt+F). */
  openFormalizarWord(this: App): void {
    const view = this.wordHost.editor.view;
    const sel = view.state.selection;
    const temSelecao = !sel.empty;
    const { texto, blocos } = projectRange(view.state.doc, temSelecao ? sel.from : 0, temSelecao ? sel.to : view.state.doc.content.size);
    if (!texto.trim()) {
      toast("Não há texto para formalizar.", "info", 2600);
      return;
    }
    abrirFormalizar({
      texto,
      origem: temSelecao ? "seleção do documento" : "documento (.docx)",
      aplicar: (novo, aplicadas) => {
        const quantas = this.aplicarFormalizacaoWord(blocos, novo, aplicadas);
        if (!quantas) {
          toast("Nada mudou no documento.", "info", 2400);
          return;
        }
        this.wordHost.recheckSpelling();
        toast(`Formalizado: ${quantas} troca(s) no documento. Ctrl+Z desfaz.`, "ok", 3800);
      },
    });
  },

  /**
   * Cada troca entra no lugar dela, numa transação só (o formato do resto fica em paz).
   * Quem monta a transação é o `word/project.ts`; aqui é só despachar e contar.
   */
  aplicarFormalizacaoWord(this: App, blocos: BlockMap[], novo: string, aplicadas: TrocaAplicada[]): number {
    const view = this.wordHost.editor.view;
    const tr = transacaoDasTrocas(view.state, blocos, novo, aplicadas);
    if (!tr) return 0;
    view.dispatch(tr);
    return tr.steps.length;
  },
};
