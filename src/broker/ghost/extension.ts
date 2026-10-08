// Gerenciador do assistente (ViewPlugin com debounce) que liga tudo ao editor.

import { EditorView, ViewPlugin, type ViewUpdate } from "@codemirror/view";
import { type Extension } from "@codemirror/state";
import { DocumentIndex } from "./documentIndex";
import { predictCompletion } from "./predict";
import { setGhostEffect, ghostTextField, ghostTextKeymap } from "./field";

export interface GhostOptions {
  getEnabled: () => boolean;
}

export function createGhostTextExtension(options: GhostOptions): Extension {
  const docIndex = new DocumentIndex();
  let debounceTimer: number | null = null;
  let indexTimer: number | null = null;

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

        // Se a seleção não estiver vazia, não agenda predição
        const sel = update.view.state.selection.main;
        if (!sel.empty) {
          return;
        }

        // Se o documento mudou ou a seleção mudou, agenda cálculo com debounce rápido (90ms)
        if (update.docChanged || update.selectionSet) {
          if (debounceTimer) window.clearTimeout(debounceTimer);
          debounceTimer = window.setTimeout(() => {
            if (!options.getEnabled()) return;
            const head = update.view.state.selection.main.head;
            const pred = predictCompletion(update.view.state.doc, head, docIndex);
            update.view.dispatch({
              effects: setGhostEffect.of(pred),
            });
          }, 90);
        }
      }

      destroy(): void {
        if (debounceTimer) window.clearTimeout(debounceTimer);
        if (indexTimer) window.clearTimeout(indexTimer);
      }
    }
  );

  return [ghostTextField, ghostTextKeymap, plugin];
}
