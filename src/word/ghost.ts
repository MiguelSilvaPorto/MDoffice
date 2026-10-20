// Sugestão de próximas palavras (texto fantasma, estilo Copilot) dentro do documento Word.
// Usa o mesmo preditor do editor Markdown (broker/ghost): palavras do próprio texto + português comum.
// Tab aceita tudo, Alt+Seta / Ctrl+Seta aceita palavra por palavra, Esc descarta.
import { Plugin, PluginKey, TextSelection, type EditorState } from "prosemirror-state";
import { Decoration, DecorationSet, type EditorView } from "prosemirror-view";
import { DocumentIndex } from "../broker/ghost/documentIndex";
import { predictFromLine } from "../broker/ghost/predict";
import type { GhostSuggestion } from "../broker/ghost/types";
import { consumeTyped, cycleSuggestion, altLabel, outcomeOf, parDaCorrecao } from "../broker/ghost/suggestion";
import { accepted, rejected } from "../broker/personal/feedback";
import { registrarCorrecao, registrarRecusaDeSugestao } from "../broker/aprendizado";

export interface WordGhostHooks {
  enabled: () => boolean;
}

const key = new PluginKey<GhostSuggestion | null>("word-ghost");

/** O par "o que estava escrito → o que o app propôs" da sugestão de correção, lido do documento. */
function parDaCorrecaoDoc(s: GhostSuggestion, doc: { textBetween(from: number, to: number, bloco?: string | null): string }): [string, string] | null {
  if (!s.replace) return null;
  const from = s.pos - s.replace;
  if (from < 0) return null;
  return parDaCorrecao(s, doc.textBetween(from, s.pos, " "));
}

/** Recusa a correção que o fantasma mostrou (o par fica anotado no aprendizado). */
function recusarCorrecao(s: GhostSuggestion, doc: { textBetween(from: number, to: number, bloco?: string | null): string }): void {
  const par = parDaCorrecaoDoc(s, doc);
  if (par) registrarRecusaDeSugestao(par[1], par[0]);
}

/** Texto do parágrafo até o cursor / depois dele (objetos como imagem viram um caractere neutro). */
function around(state: EditorState): { before: string; after: string } | null {
  const sel = state.selection;
  if (!sel.empty || !sel.$from.parent.isTextblock) return null;
  const $p = sel.$from;
  return {
    before: $p.parent.textBetween(0, $p.parentOffset, undefined, "￼"),
    after: $p.parent.textBetween($p.parentOffset, $p.parent.content.size, undefined, "￼"),
  };
}

function setSuggestion(view: EditorView, s: GhostSuggestion | null): void {
  view.dispatch(view.state.tr.setMeta(key, { set: s }));
}

function accept(view: EditorView, wordOnly: boolean): boolean {
  const cur = key.getState(view.state);
  if (!cur || !cur.text) return false;
  const m = wordOnly && !cur.replace ? /^(\S+\s*)/.exec(cur.text) : null;
  const o = outcomeOf(cur);
  if (o && (!m || m[1].trim() === cur.text.split(" ")[0])) accepted(o);
  const insert = m ? m[1] : cur.text;
  const rest = cur.text.slice(insert.length);
  const pos = cur.pos - (cur.replace ?? 0); // correção: troca o que foi digitado
  // correção do fantasma aceita: vira troca aprendida para o corretor também
  const par = parDaCorrecaoDoc(cur, view.state.doc);
  if (par) registrarCorrecao(par[0], par[1]);
  const tr = view.state.tr.insertText(insert, pos, cur.pos);
  tr.setSelection(TextSelection.create(tr.doc, pos + insert.length));
  tr.setMeta(key, { set: rest ? { text: rest, pos: pos + insert.length } : null });
  view.dispatch(tr.scrollIntoView());
  return true;
}

export function ghostPlugin(hooks: WordGhostHooks): Plugin {
  const index = new DocumentIndex();
  let indexTimer: number | undefined;
  const reindex = (state: EditorState): void => index.update(state.doc.textBetween(0, state.doc.content.size, "\n", " "));

  /**
   * A sugestão para o cursor, calculada na própria transação da tecla (custa ~0,2 ms). Antes ela
   * esperava um relógio de 90 ms que reiniciava a cada tecla: digitando a 10 letras por segundo o
   * relógio quase nunca fechava e a sugestão só aparecia nas pausas (de tantas em tantas palavras).
   */
  const predict = (state: EditorState): GhostSuggestion | null => {
    if (!hooks.enabled()) return null;
    const ctx = around(state);
    return ctx ? predictFromLine(ctx.before, ctx.after, state.selection.head, index) : null;
  };

  return new Plugin<GhostSuggestion | null>({
    key,
    state: {
      init: () => null,
      apply(tr, cur, _old, state) {
        const meta = tr.getMeta(key) as { set: GhostSuggestion | null } | undefined;
        // Tab que aceitou tudo: a próxima sugestão já vem junto
        if (meta) return meta.set ?? (tr.docChanged ? predict(state) : null);
        if (!tr.docChanged && !tr.selectionSet) return cur;
        if (!cur) return predict(state);
        if (tr.docChanged) {
          // digitou exatamente o começo da sugestão: consome sem esperar o próximo cálculo
          let typed = "";
          let at = -1;
          let pure = true;
          tr.steps.forEach((st) => {
            const j = st.toJSON() as { stepType: string; from?: number; to?: number; slice?: { content?: { text?: string }[] } };
            const txt = j.slice?.content?.map((c) => c.text ?? "").join("") ?? "";
            if (j.stepType !== "replace" || j.from !== j.to || !txt) pure = false;
            else {
              typed += txt;
              if (at < 0) at = j.from!;
            }
          });
          if (pure && at === cur.pos) {
            const bate = cur.text.toLowerCase().startsWith(typed.toLowerCase());
            if (!bate) {
              const o = outcomeOf(cur);
              if (o) rejected(o, false); // digitou outra coisa: essa sugestão não serviu
            }
            // correção do fantasma: digitar por cima (ou começar a digitar o que ela
            // propunha) sem aceitar conta como recusa do par
            if (cur.replace) recusarCorrecao(cur, tr.before);
            return consumeTyped(cur, typed) ?? predict(state);
          }
          return predict(state);
        }
        if (tr.selection.head !== cur.pos) return predict(state);
        return cur;
      },
    },
    props: {
      decorations(state) {
        const s = key.getState(state);
        if (!s || !s.text || !hooks.enabled()) return null;
        const w = document.createElement("span");
        w.className = "wd-ghost";
        w.textContent = s.text;
        w.setAttribute("aria-hidden", "true");
        if (s.replace) w.classList.add("wd-ghost-fix");
        const label = altLabel(s);
        if (label) w.dataset.alts = label;
        return DecorationSet.create(state.doc, [Decoration.widget(s.pos, w, { side: 1, key: `ghost-${s.pos}-${s.text}-${s.alt ?? 0}` })]);
      },
      handleKeyDown(view, e) {
        if (!hooks.enabled() || !key.getState(view.state)) return false;
        if (e.key === "Tab" && !e.shiftKey && !e.ctrlKey && !e.altKey) return accept(view, false);
        if (e.key === "ArrowRight" && (e.altKey || e.ctrlKey) && !e.shiftKey) return accept(view, true);
        if (e.altKey && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
          const cur = key.getState(view.state)!;
          if (!cur.alts || cur.alts.length < 2) return false;
          setSuggestion(view, cycleSuggestion(cur, e.key === "ArrowDown" ? 1 : -1));
          return true;
        }
        if (e.key === "Escape") {
          const cur = key.getState(view.state)!;
          const o = outcomeOf(cur);
          if (o) rejected(o, true);
          // Esc numa correção do fantasma: a pessoa recusou a troca de forma explícita
          if (cur.replace) recusarCorrecao(cur, view.state.doc);
          setSuggestion(view, null);
          return true;
        }
        return false;
      },
    },
    view(view) {
      reindex(view.state);
      return {
        update(v, prev) {
          if (!hooks.enabled()) return;
          const changed = prev.doc !== v.state.doc;
          if (changed) {
            window.clearTimeout(indexTimer);
            indexTimer = window.setTimeout(() => reindex(v.state), 800);
          }
        },
        destroy() {
          window.clearTimeout(indexTimer);
        },
      };
    },
  });
}
