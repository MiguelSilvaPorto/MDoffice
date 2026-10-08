// Widget visual, estado do CodeMirror 6 e atalhos (Tab, Esc, Alt+Seta, Ctrl+Seta).

import { EditorView, WidgetType, Decoration, type DecorationSet, keymap } from "@codemirror/view";
import { StateField, StateEffect, Prec } from "@codemirror/state";
import { type GhostSuggestion } from "./types";

export class GhostTextWidget extends WidgetType {
  constructor(readonly text: string) {
    super();
  }

  toDOM(): HTMLElement {
    const span = document.createElement("span");
    span.className = "cm-ghost-text";
    span.textContent = this.text;
    span.setAttribute("aria-hidden", "true");
    return span;
  }

  eq(other: GhostTextWidget): boolean {
    return other.text === this.text;
  }
}

export const setGhostEffect = StateEffect.define<GhostSuggestion | null>();

export const ghostTextField = StateField.define<{
  suggestion: GhostSuggestion | null;
  decorations: DecorationSet;
}>({
  create() {
    return { suggestion: null, decorations: Decoration.none };
  },
  update(val, tr) {
    let suggestion = val.suggestion;
    let changed = false;

    for (const effect of tr.effects) {
      if (effect.is(setGhostEffect)) {
        suggestion = effect.value;
        changed = true;
      }
    }

    if (tr.docChanged) {
      if (suggestion) {
        // Se o usuário digitou exatamente o caractere inicial da sugestão, fatia em 0ms
        let matched = false;
        if (!tr.changes.empty) {
          let insertedText = "";
          let insertedFrom = -1;
          tr.changes.iterChanges((fromA, toA, fromB, toB, inserted) => {
            insertedText += inserted.toString();
            if (insertedFrom === -1) insertedFrom = fromA;
          });

          if (
            insertedFrom === suggestion.pos &&
            insertedText.length > 0 &&
            suggestion.text.toLowerCase().startsWith(insertedText.toLowerCase())
          ) {
            const remaining = suggestion.text.slice(insertedText.length);
            const newPos = suggestion.pos + insertedText.length;
            suggestion = remaining.length > 0 ? { text: remaining, pos: newPos } : null;
            matched = true;
            changed = true;
          }
        }

        if (!matched) {
          suggestion = null;
          changed = true;
        }
      }
    } else if (tr.selection) {
      // Se apenas o cursor moveu e saiu da posição da sugestão, limpa imediatamente
      if (suggestion && tr.state.selection.main.head !== suggestion.pos) {
        suggestion = null;
        changed = true;
      }
    }

    if (!changed) return val;

    if (!suggestion || !suggestion.text) {
      return { suggestion: null, decorations: Decoration.none };
    }

    const deco = Decoration.set([
      Decoration.widget({
        widget: new GhostTextWidget(suggestion.text),
        side: 1,
      }).range(suggestion.pos),
    ]);

    return { suggestion, decorations: deco };
  },
  provide: (field) => EditorView.decorations.from(field, (v) => v.decorations),
});

// ---------- atalhos de teclado (Tab / Esc / Alt+Seta / Ctrl+Seta) ----------

/** Aceita toda a sugestão de ghost text atual */
export function acceptGhostText(view: EditorView): boolean {
  const fieldVal = view.state.field(ghostTextField, false);
  const cur = fieldVal?.suggestion;
  if (!cur || !cur.text) return false;

  const insert = cur.text;
  view.dispatch({
    changes: { from: cur.pos, to: cur.pos, insert },
    selection: { anchor: cur.pos + insert.length },
    effects: setGhostEffect.of(null),
    scrollIntoView: true,
  });
  return true;
}

/** Aceita apenas a próxima palavra da sugestão (estilo Alt+Seta / Ctrl+Seta do Copilot) */
export function acceptGhostWord(view: EditorView): boolean {
  const fieldVal = view.state.field(ghostTextField, false);
  const cur = fieldVal?.suggestion;
  if (!cur || !cur.text) return false;

  const m = /^(\S+\s*)/.exec(cur.text);
  if (!m) return false;

  const word = m[1];
  const remaining = cur.text.slice(word.length);
  const nextPos = cur.pos + word.length;

  view.dispatch({
    changes: { from: cur.pos, to: cur.pos, insert: word },
    selection: { anchor: nextPos },
    effects: setGhostEffect.of(remaining.length > 0 ? { text: remaining, pos: nextPos } : null),
    scrollIntoView: true,
  });
  return true;
}

/** Descarta a sugestão de ghost text atual */
export function clearGhostText(view: EditorView): boolean {
  const fieldVal = view.state.field(ghostTextField, false);
  if (fieldVal?.suggestion) {
    view.dispatch({ effects: setGhostEffect.of(null) });
    return true;
  }
  return false;
}

export const ghostTextKeymap = Prec.highest(
  keymap.of([
    {
      key: "Tab",
      run: (view) => acceptGhostText(view),
    },
    {
      key: "Escape",
      run: (view) => clearGhostText(view),
    },
    {
      key: "Alt-ArrowRight",
      run: (view) => acceptGhostWord(view),
    },
    {
      key: "Ctrl-ArrowRight",
      run: (view) => acceptGhostWord(view),
    },
  ])
);
