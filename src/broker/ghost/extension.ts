// Gerenciador do assistente (ViewPlugin com debounce) que liga tudo ao editor.

import { EditorView, ViewPlugin, type ViewUpdate } from "@codemirror/view";
import { type Extension } from "@codemirror/state";
import { DocumentIndex } from "./documentIndex";
import { predictCompletion } from "./predict";
import { setGhostEffect, ghostTextField, ghostTextKeymap, ghostPredictor } from "./field";
import { refineSuggestion, REFINE } from "./refine";

export interface GhostOptions {
  getEnabled: () => boolean;
}

export function createGhostTextExtension(options: GhostOptions): Extension {
  const docIndex = new DocumentIndex();
  let indexTimer: number | null = null;
  let llmTimer: number | null = null;

  /** Depois de uma pausa no meio de uma palavra, a IA local escolhe entre os candidatos (se estiver ligada). */
  const refineLater = (view: EditorView, retry = true): void => {
    if (llmTimer) window.clearTimeout(llmTimer);
    llmTimer = window.setTimeout(async () => {
      if (!options.getEnabled()) return;
      const doc = view.state.doc;
      const sel = view.state.selection.main;
      if (!sel.empty) return;
      const line = doc.lineAt(sel.head);
      const before = line.text.slice(0, sel.head - line.from);
      if (/^[\p{L}0-9_-]/u.test(line.text.slice(sel.head - line.from))) return;
      const current = view.state.field(ghostTextField, false)?.suggestion ?? null;
      const r = await refineSuggestion(before, sel.head, docIndex, current);
      if (!r) return;
      // a pessoa continuou digitando enquanto a IA pensava: o resultado já não vale; pede de novo uma vez
      if (view.state.doc !== doc || view.state.selection.main.head !== sel.head) {
        if (retry) refineLater(view, false);
        return;
      }
      view.dispatch({ effects: setGhostEffect.of(r) });
    }, REFINE.pauseMs);
  };

  const plugin = ViewPlugin.fromClass(
    class {
      constructor(readonly view: EditorView) {
        docIndex.update(view.state.doc.toString());
      }

      update(update: ViewUpdate): void {
        if (!options.getEnabled()) {
          return;
        }

        // Se o documento mudou, agenda re-indexação do documento (800ms debounce)
        if (update.docChanged) {
          if (indexTimer) window.clearTimeout(indexTimer);
          indexTimer = window.setTimeout(() => {
            docIndex.update(update.view.state.doc.toString());
          }, 800);
        }

        // A sugestão em si já saiu na transação da tecla (ghostPredictor); aqui só fica a IA local,
        // que espera uma pausa.
        if (!update.view.state.selection.main.empty) return;
        if (update.docChanged || update.selectionSet) refineLater(update.view);
      }

      destroy(): void {
        if (indexTimer) window.clearTimeout(indexTimer);
        if (llmTimer) window.clearTimeout(llmTimer);
      }
    }
  );

  const predictor = ghostPredictor.of((state) => (options.getEnabled() ? predictCompletion(state.doc, state.selection.main.head, docIndex) : null));

  return [predictor, ghostTextField, ghostTextKeymap, plugin];
}
