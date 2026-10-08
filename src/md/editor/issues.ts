// Campo do CodeMirror que guarda e sublinha os avisos do assistente de escrita.

import { EditorView, Decoration, type DecorationSet } from "@codemirror/view";
import { StateEffect, StateField } from "@codemirror/state";
import { type WritingIssue } from "../../broker/writing";

export const setIssuesEffect = StateEffect.define<WritingIssue[]>();

export const issueField = StateField.define<{ issues: WritingIssue[]; deco: DecorationSet }>({
  create: () => ({ issues: [], deco: Decoration.none }),
  update(value, tr) {
    let issues = value.issues;
    let changed = false;
    for (const effect of tr.effects) {
      if (effect.is(setIssuesEffect)) {
        issues = effect.value;
        changed = true;
      }
    }
    if (tr.docChanged) {
      // Os avisos precisam ANDAR junto com o texto: sem isso, digitar acima de uma palavra
      // sublinhada deixa o sublinhado preso na posição antiga (parece que ele "sobe").
      issues = issues
        .map((i) => {
          const from = tr.changes.mapPos(i.from, 1);
          const to = tr.changes.mapPos(i.to, -1);
          return to > from ? { ...i, from, to } : null;
        })
        .filter((i): i is WritingIssue => i !== null);
      changed = true;
    }
    if (!changed) return value;
    const ranges = [];
    const docLen = tr.state.doc.length;
    for (const issue of issues) {
      const from = Math.min(issue.from, docLen);
      const to = Math.min(issue.to, docLen);
      if (from >= to) continue;
      ranges.push(
        Decoration.mark({
          class: issue.kind === "spell" ? "cm-issue-spell" : "cm-issue-style",
        }).range(from, to)
      );
    }
    return { issues, deco: Decoration.set(ranges, true) };
  },
  provide: (field) => EditorView.decorations.from(field, (value) => value.deco),
});
