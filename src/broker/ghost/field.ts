// Widget visual, estado do CodeMirror 6 e atalhos (Tab, Esc, Alt+Seta, Ctrl+Seta).

import { EditorView, WidgetType, Decoration, type DecorationSet, keymap } from "@codemirror/view";
import { StateField, StateEffect, Prec, type Text } from "@codemirror/state";
import { type GhostSuggestion } from "./types";
import { consumeTyped, cycleSuggestion, altLabel, outcomeOf, parDaCorrecao } from "./suggestion";
import { accepted, rejected } from "../personal/feedback";
import { registrarCorrecao, registrarRecusaDeSugestao } from "../aprendizado";

/**
 * A sugestão de correção do fantasma ("resultdo" → "resultado") é o mesmo par que o
 * corretor aprende: aceitar conta como aceite e digitar por cima conta como recusa.
 */
function parDaCorrecaoNoDoc(s: GhostSuggestion, doc: Text): [string, string] | null {
  if (!s.replace) return null;
  const from = s.pos - s.replace;
  if (from < 0 || s.pos > doc.length) return null;
  return parDaCorrecao(s, doc.sliceString(from, s.pos));
}

/** Recusa a correção que o fantasma mostrou (o par fica anotado no aprendizado). */
function recusarCorrecao(s: GhostSuggestion, doc: Text): void {
  const par = parDaCorrecaoNoDoc(s, doc);
  if (par) registrarRecusaDeSugestao(par[1], par[0]);
}

export class GhostTextWidget extends WidgetType {
  constructor(readonly text: string, readonly label: string | null = null, readonly fix = false) {
    super();
  }

  toDOM(): HTMLElement {
    const span = document.createElement("span");
    span.className = "cm-ghost-text";
    span.textContent = this.text;
    span.setAttribute("aria-hidden", "true");
    if (this.label) span.dataset.alts = this.label;
    if (this.fix) span.classList.add("cm-ghost-fix");
    return span;
  }

  eq(other: GhostTextWidget): boolean {
    return other.text === this.text && other.label === this.label && other.fix === this.fix;
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

          if (insertedFrom === suggestion.pos && insertedText.length > 0) {
            const next = consumeTyped(suggestion, insertedText);
            if (next || suggestion.text.toLowerCase().startsWith(insertedText.toLowerCase())) {
              // digitou a primeira letra do que a correção propunha: a sugestão sai de
              // cena sem ser aceita — a correção do fantasma fica anotada como recusa
              if (!next && suggestion.replace && tr.isUserEvent("input.type")) recusarCorrecao(suggestion, tr.startState.doc);
              suggestion = next;
              matched = true;
              changed = true;
            }
          }
        }

        if (!matched) {
          // a pessoa digitou outra coisa no lugar: aprende que essa sugestão não serviu
          if (tr.isUserEvent("input.type")) {
            const o = suggestion ? outcomeOf(suggestion) : null;
            if (o) rejected(o, false);
            // correção do fantasma recusada (digitou por cima): o par perde valor
            if (suggestion) recusarCorrecao(suggestion, tr.startState.doc);
          }
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
        widget: new GhostTextWidget(suggestion.text, altLabel(suggestion), !!suggestion.replace),
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

  const o = outcomeOf(cur);
  if (o) accepted(o);
  // correção do fantasma aceita: vira troca aprendida para o corretor também
  const par = parDaCorrecaoNoDoc(cur, view.state.doc);
  if (par) registrarCorrecao(par[0], par[1]);
  const insert = cur.text;
  const from = cur.pos - (cur.replace ?? 0); // correção: troca o que foi digitado
  view.dispatch({
    changes: { from, to: cur.pos, insert },
    selection: { anchor: from + insert.length },
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

  if (cur.replace) return acceptGhostText(view);
  const m = /^(\S+\s*)/.exec(cur.text);
  if (!m) return false;

  const o = outcomeOf(cur);
  if (o && m[1].trim() === cur.text.split(" ")[0]) accepted(o);
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

/** Troca a sugestão pela próxima/anterior opção (Alt+Seta para baixo/cima). */
export function cycleGhostText(view: EditorView, dir: 1 | -1): boolean {
  const cur = view.state.field(ghostTextField, false)?.suggestion;
  if (!cur || !cur.alts || cur.alts.length < 2) return false;
  view.dispatch({ effects: setGhostEffect.of(cycleSuggestion(cur, dir)) });
  return true;
}

/** Descarta a sugestão de ghost text atual */
export function clearGhostText(view: EditorView): boolean {
  const fieldVal = view.state.field(ghostTextField, false);
  if (fieldVal?.suggestion) {
    const o = outcomeOf(fieldVal.suggestion);
    if (o) rejected(o, true);
    // Esc numa correção do fantasma: a pessoa recusou a troca de forma explícita
    recusarCorrecao(fieldVal.suggestion, view.state.doc);
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
      key: "Alt-ArrowDown",
      run: (view) => cycleGhostText(view, 1),
    },
    {
      key: "Alt-ArrowUp",
      run: (view) => cycleGhostText(view, -1),
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
