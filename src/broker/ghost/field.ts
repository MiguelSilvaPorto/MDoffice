// Widget visual, estado do CodeMirror 6 e atalhos (Tab, Esc, Seta para a direita, Alt+Seta, Ctrl+Seta).

import { EditorView, WidgetType, Decoration, type DecorationSet, keymap } from "@codemirror/view";
import { StateField, StateEffect, Facet, Prec, type Text, type EditorState } from "@codemirror/state";
import { type GhostSuggestion } from "./types";
import { consumeTyped, cycleSuggestion, altLabel, outcomeOf, parDaCorrecao, aceiteDoTab, aceiteDaPalavra, type Aceite } from "./suggestion";
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
  constructor(readonly text: string, readonly label: string | null = null, readonly fix = false, readonly extra = "") {
    super();
  }

  toDOM(): HTMLElement {
    const span = document.createElement("span");
    span.className = "cm-ghost-text";
    span.textContent = this.text;
    span.setAttribute("aria-hidden", "true");
    if (this.label) span.dataset.alts = this.label;
    if (this.fix) span.classList.add("cm-ghost-fix");
    // o palpite das próximas palavras, mais claro (a seta para a direita aceita uma por vez)
    if (this.extra) {
      const palpite = document.createElement("span");
      palpite.className = "cm-ghost-extra";
      palpite.textContent = this.extra;
      span.append(palpite);
    }
    return span;
  }

  eq(other: GhostTextWidget): boolean {
    return other.text === this.text && other.label === this.label && other.fix === this.fix && other.extra === this.extra;
  }
}

export const setGhostEffect = StateEffect.define<GhostSuggestion | null>();

/**
 * Quem calcula a sugestão para o cursor. O campo chama na própria transação da tecla (a previsão
 * custa ~0,2 ms): antes ela esperava um relógio de 45 ms que reiniciava a cada tecla e, digitando
 * rápido, nunca chegava a fechar — a sugestão só aparecia nas pausas.
 */
export const ghostPredictor = Facet.define<(state: EditorState) => GhostSuggestion | null, ((state: EditorState) => GhostSuggestion | null) | null>({
  combine: (fns) => fns[0] ?? null,
});

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
    let explicit = false;

    for (const effect of tr.effects) {
      if (effect.is(setGhostEffect)) {
        suggestion = effect.value;
        changed = true;
        explicit = true;
      }
    }

    if (tr.docChanged && !explicit) {
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
    } else if (tr.selection && !explicit) {
      // Se apenas o cursor moveu e saiu da posição da sugestão, limpa imediatamente
      if (suggestion && tr.state.selection.main.head !== suggestion.pos) {
        suggestion = null;
        changed = true;
      }
    }

    // sem sugestão viva depois da tecla (ou do Tab que aceitou tudo): calcula a nova agora mesmo
    if (!suggestion && (tr.docChanged || (tr.selection && !explicit))) {
      const predict = tr.state.facet(ghostPredictor);
      if (predict && tr.state.selection.main.empty) {
        suggestion = predict(tr.state);
        changed = true;
      }
    }

    if (!changed) return val;

    if (!suggestion || (!suggestion.text && !suggestion.extra?.trim())) {
      return { suggestion: null, decorations: Decoration.none };
    }

    const deco = Decoration.set([
      Decoration.widget({
        widget: new GhostTextWidget(suggestion.text, altLabel(suggestion), !!suggestion.replace, suggestion.extra ?? ""),
        side: 1,
      }).range(suggestion.pos),
    ]);

    return { suggestion, decorations: deco };
  },
  provide: (field) => EditorView.decorations.from(field, (v) => v.decorations),
});

// ---------- atalhos de teclado (Tab / Esc / Seta para a direita / Alt+Seta / Ctrl+Seta) ----------

/** A sugestão que está na tela (parte firme ou só o palpite das próximas palavras). */
function sugestaoViva(view: EditorView): GhostSuggestion | null {
  const cur = view.state.field(ghostTextField, false)?.suggestion;
  return cur && (cur.text || cur.extra?.trim()) ? cur : null;
}

/** Insere o que foi aceito e deixa na tela o que sobrou da sugestão. */
function aplicarAceite(view: EditorView, cur: GhostSuggestion, aceite: Aceite): boolean {
  const o = outcomeOf(cur);
  if (o && aceite.primeiraInteira) accepted(o);
  // correção do fantasma aceita: vira troca aprendida para o corretor também
  const par = parDaCorrecaoNoDoc(cur, view.state.doc);
  if (par) registrarCorrecao(par[0], par[1]);
  const from = cur.pos - (cur.replace ?? 0); // correção: troca o que foi digitado
  const nextPos = from + aceite.insert.length;
  view.dispatch({
    changes: { from, to: cur.pos, insert: aceite.insert },
    selection: { anchor: nextPos },
    effects: setGhostEffect.of(aceite.rest ? { ...aceite.rest, pos: nextPos } : null),
    scrollIntoView: true,
  });
  return true;
}

/** Tab: aceita a parte firme da sugestão (o palpite das próximas palavras continua na tela). */
export function acceptGhostText(view: EditorView): boolean {
  const cur = sugestaoViva(view);
  const aceite = cur && aceiteDoTab(cur);
  return cur && aceite ? aplicarAceite(view, cur, aceite) : false;
}

/** Aceita apenas a próxima palavra da sugestão (Seta para a direita / Alt+Seta / Ctrl+Seta). */
export function acceptGhostWord(view: EditorView): boolean {
  const cur = sugestaoViva(view);
  const aceite = cur && aceiteDaPalavra(cur);
  return cur && aceite ? aplicarAceite(view, cur, aceite) : false;
}

/**
 * A seta para a direita SEM modificador só aceita no fim da linha: no meio do texto ela continua
 * andando com o cursor, como sempre.
 */
function acceptGhostWordAtLineEnd(view: EditorView): boolean {
  const { head, empty } = view.state.selection.main;
  if (!empty || head !== view.state.doc.lineAt(head).to) return false;
  return acceptGhostWord(view);
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
      key: "ArrowRight",
      run: (view) => acceptGhostWordAtLineEnd(view),
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
