// Tema do editor (claro e escuro) e cores do realce de sintaxe do Markdown.

import { EditorView } from "@codemirror/view";
import { type Extension } from "@codemirror/state";
import { HighlightStyle } from "@codemirror/language";
import { tags as t } from "@lezer/highlight";

export const mono = `ui-monospace, "Cascadia Code", "JetBrains Mono", Consolas, monospace`;

export function baseTheme(dark: boolean): Extension {
  const c = dark
    ? {
        fg: "#e6e8ee",
        caret: "#a5b4fc",
        gutter: "#68707f",
        gutterActive: "#a5b4fc",
        activeLine: "rgba(129,140,248,0.08)",
        selection: "rgba(129,140,248,0.28)",
        bracket: "rgba(129,140,248,0.35)",
      }
    : {
        fg: "#111827",
        caret: "#4f46e5",
        gutter: "#9aa3b2",
        gutterActive: "#4f46e5",
        activeLine: "rgba(79,70,229,0.055)",
        selection: "rgba(79,70,229,0.2)",
        bracket: "rgba(79,70,229,0.3)",
      };

  return EditorView.theme(
    {
      "&": { color: c.fg, backgroundColor: "transparent", height: "100%", fontSize: "14.5px" },
      ".cm-scroller": { fontFamily: mono, lineHeight: "1.7", overflow: "auto" },
      ".cm-content": { padding: "20px 24px", caretColor: c.caret },
      ".cm-gutters": { backgroundColor: "transparent", color: c.gutter, border: "none", paddingRight: "4px" },
      ".cm-activeLineGutter": { backgroundColor: "transparent", color: c.gutterActive },
      ".cm-activeLine": { backgroundColor: c.activeLine },
      ".cm-cursor, .cm-dropCursor": { borderLeftColor: c.caret, borderLeftWidth: "2px" },
      "&.cm-focused .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection": {
        backgroundColor: `${c.selection} !important`,
      },
      ".cm-matchingBracket, .cm-nonmatchingBracket": { backgroundColor: c.bracket },
      "&.cm-focused": { outline: "none" },
      ".cm-line": { padding: "0 2px" },
      ".cm-tooltip": {
        backgroundColor: dark ? "#1b1e26" : "#ffffff",
        border: `1px solid ${dark ? "#2b303b" : "#e5e7eb"}`,
        borderRadius: "8px",
      },
      ".cm-tooltip-autocomplete ul li[aria-selected]": {
        backgroundColor: dark ? "#2b303b" : "#eef2ff",
        color: dark ? "#e6e8ee" : "#111827",
      },
    },
    { dark }
  );
}

export const lightHL = HighlightStyle.define([
  { tag: t.heading, color: "#1d4ed8", fontWeight: "700" },
  { tag: t.strong, fontWeight: "700", color: "#0f172a" },
  { tag: t.emphasis, fontStyle: "italic", color: "#9d174d" },
  { tag: t.strikethrough, textDecoration: "line-through", color: "#94a3b8" },
  { tag: t.link, color: "#2563eb", textDecoration: "underline" },
  { tag: t.url, color: "#7c3aed" },
  { tag: t.monospace, color: "#be185d", background: "rgba(219,39,119,0.08)" },
  { tag: t.quote, color: "#64748b", fontStyle: "italic" },
  { tag: t.list, color: "#ea580c" },
  { tag: t.contentSeparator, color: "#94a3b8" },
  { tag: [t.keyword, t.operatorKeyword], color: "#7c3aed" },
  { tag: t.string, color: "#047857" },
  { tag: t.number, color: "#b45309" },
  { tag: [t.comment, t.blockComment], color: "#94a3b8", fontStyle: "italic" },
]);

export const darkHL = HighlightStyle.define([
  { tag: t.heading, color: "#93c5fd", fontWeight: "700" },
  { tag: t.strong, fontWeight: "700", color: "#f1f5f9" },
  { tag: t.emphasis, fontStyle: "italic", color: "#f9a8d4" },
  { tag: t.strikethrough, textDecoration: "line-through", color: "#6b7280" },
  { tag: t.link, color: "#60a5fa", textDecoration: "underline" },
  { tag: t.url, color: "#c4b5fd" },
  { tag: t.monospace, color: "#f9a8d4", background: "rgba(244,114,182,0.12)" },
  { tag: t.quote, color: "#9ca3af", fontStyle: "italic" },
  { tag: t.list, color: "#fdba74" },
  { tag: t.contentSeparator, color: "#6b7280" },
  { tag: [t.keyword, t.operatorKeyword], color: "#c4b5fd" },
  { tag: t.string, color: "#6ee7b7" },
  { tag: t.number, color: "#fcd34d" },
  { tag: [t.comment, t.blockComment], color: "#6b7280", fontStyle: "italic" },
]);
