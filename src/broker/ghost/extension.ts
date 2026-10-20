// Liga a sugestão ao editor: o preditor (na transação da tecla) e a reindexação do documento.

import { EditorView, ViewPlugin, type ViewUpdate } from "@codemirror/view";
import { type Extension } from "@codemirror/state";
import { DocumentIndex } from "./documentIndex";
import { predictCompletion } from "./predict";
import { ghostTextField, ghostTextKeymap, ghostPredictor } from "./field";

export interface GhostOptions {
  getEnabled: () => boolean;
}

export function createGhostTextExtension(options: GhostOptions): Extension {
  const docIndex = new DocumentIndex();
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
      }

      destroy(): void {
        if (indexTimer) window.clearTimeout(indexTimer);
      }
    }
  );

  const predictor = ghostPredictor.of((state) => (options.getEnabled() ? predictCompletion(state.doc, state.selection.main.head, docIndex) : null));

  return [predictor, ghostTextField, ghostTextKeymap, plugin];
}
