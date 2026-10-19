// Gerenciador do assistente (ViewPlugin com debounce) que liga tudo ao editor.

import { EditorView, ViewPlugin, type ViewUpdate } from "@codemirror/view";
import { type Extension } from "@codemirror/state";
import { DocumentIndex } from "./documentIndex";
import { predictCompletion } from "./predict";
import { setGhostEffect, ghostTextField, ghostTextKeymap } from "./field";
import { refineSuggestion, REFINE } from "./refine";

export interface GhostOptions {
  getEnabled: () => boolean;
}

export function createGhostTextExtension(options: GhostOptions): Extension {
  const docIndex = new DocumentIndex();
  let debounceTimer: number | null = null;
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

        // Se a seleção não estiver vazia, não agenda predição
        const sel = update.view.state.selection.main;
        if (!sel.empty) {
          return;
        }

        // Se o documento mudou ou a seleção mudou, agenda cálculo com debounce curto: a previsão
        // custa ~0,4 ms, então 45 ms já mostram a sugestão entre uma tecla e outra — antes eram
        // 90 ms e, digitando rápido, o relógio nunca fechava (a sugestão só aparecia nas pausas).
        if (update.docChanged || update.selectionSet) {
          if (debounceTimer) window.clearTimeout(debounceTimer);
          debounceTimer = window.setTimeout(() => {
            if (!options.getEnabled()) return;
            const head = update.view.state.selection.main.head;
            const pred = predictCompletion(update.view.state.doc, head, docIndex);
            update.view.dispatch({
              effects: setGhostEffect.of(pred),
            });
            refineLater(update.view);
          }, 45);
        }
      }

      destroy(): void {
        if (debounceTimer) window.clearTimeout(debounceTimer);
        if (indexTimer) window.clearTimeout(indexTimer);
        if (llmTimer) window.clearTimeout(llmTimer);
      }
    }
  );

  return [ghostTextField, ghostTextKeymap, plugin];
}
