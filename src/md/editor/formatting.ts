// Comandos de formatação do Markdown (negrito, listas, títulos…) como funções que recebem o editor.

import type { EditorView } from "@codemirror/view";
import { clamp } from "../../util";

/** Acha o par de marcas que envolve a seleção (ex.: a seleção está dentro de **…**). */
function findWrapper(
  view: EditorView,
  from: number,
  to: number,
  before: string,
  after: string
): { from: number; to: number; innerFrom: number; innerTo: number } | null {
  const { state } = view;
  const lineStart = state.doc.lineAt(from).from;
  const lineEnd = state.doc.lineAt(to).to;
  const antes = state.sliceDoc(lineStart, from);
  let startIdx = antes.lastIndexOf(before);
  // o "*" do itálico não pode ser um pedaço do "**" do negrito
  while (startIdx >= 0 && before === "*") {
    const abs = lineStart + startIdx;
    const prev = state.sliceDoc(Math.max(0, abs - 1), abs);
    const next = state.sliceDoc(abs + 1, abs + 2);
    if (prev !== "*" && next !== "*") break;
    startIdx = antes.lastIndexOf(before, startIdx - 1);
  }
  if (startIdx < 0) return null;
  const depois = state.sliceDoc(to, lineEnd);
  const endIdx = depois.indexOf(after);
  if (endIdx < 0) return null;
  const openFrom = lineStart + startIdx;
  const openTo = openFrom + before.length;
  const closeFrom = to + endIdx;
  const closeTo = closeFrom + after.length;
  if (openTo > closeFrom) return null;
  return { from: openFrom, to: closeTo, innerFrom: openTo, innerTo: closeFrom };
}

/**
 * Envolve a seleção com marcas (ex.: **negrito**). Se a seleção for só um pedaço de um
 * trecho já formatado igual, ele TIRA a formatação somente desse pedaço — o resto continua
 * como estava (ex.: “**Um texto** todo **em negrito**”).
 */
export function wrapSelection(view: EditorView, before: string, after: string, ph: string): void {
  const { state } = view;
  const sel = state.selection.main;
  const text = state.sliceDoc(sel.from, sel.to);

  if (sel.empty) {
    view.dispatch({
      changes: { from: sel.from, to: sel.to, insert: before + ph + after },
      selection: { anchor: sel.from + before.length, head: sel.from + before.length + ph.length },
    });
    view.focus();
    return;
  }

  if (text.startsWith(before) && text.endsWith(after) && text.length >= before.length + after.length) {
    const inner = text.slice(before.length, text.length - after.length);
    view.dispatch({
      changes: { from: sel.from, to: sel.to, insert: inner },
      selection: { anchor: sel.from, head: sel.from + inner.length },
    });
    view.focus();
    return;
  }

  const wrapper = findWrapper(view, sel.from, sel.to, before, after);
  if (wrapper) {
    // já está formatado assim: tira a formatação só do pedaço selecionado
    const antesBruto = state.sliceDoc(wrapper.innerFrom, sel.from);
    const depoisBruto = state.sliceDoc(sel.to, wrapper.innerTo);
    const antes = antesBruto.replace(/\s+$/, "");
    const depois = depoisBruto.replace(/^\s+/, "");
    const espacoAntes = antesBruto.length > antes.length;
    const espacoDepois = depoisBruto.length > depois.length;
    const selecao = text.replace(/^\s+|\s+$/g, "") || text;

    const partes: { txt: string; espacoAntes: boolean; selecao?: boolean }[] = [];
    if (antes) partes.push({ txt: before + antes + after, espacoAntes: false });
    partes.push({ txt: selecao, espacoAntes: antes ? espacoAntes : false, selecao: true });
    if (depois) partes.push({ txt: before + depois + after, espacoAntes: espacoDepois });

    let novo = "";
    let inicioSelecao = 0;
    for (const p of partes) {
      if (novo && p.espacoAntes) novo += " ";
      if (p.selecao) inicioSelecao = novo.length;
      novo += p.txt;
    }
    view.dispatch({
      changes: { from: wrapper.from, to: wrapper.to, insert: novo },
      selection: { anchor: inicioSelecao, head: inicioSelecao + selecao.length },
    });
    view.focus();
    return;
  }

  view.dispatch({
    changes: { from: sel.from, to: sel.to, insert: before + text + after },
    selection: { anchor: sel.from + before.length, head: sel.from + before.length + text.length },
  });
  view.focus();
}

/** Adiciona/remove prefixo em todas as linhas da seleção (listas, citações…). */
export function toggleLinePrefix(view: EditorView, prefix: string): void {
  const { state } = view;
  const sel = state.selection.main;
  const start = state.doc.lineAt(sel.from);
  const end = state.doc.lineAt(sel.to);
  const changes: { from: number; to: number; insert: string }[] = [];
  const lines = [];
  for (let n = start.number; n <= end.number; n++) lines.push(state.doc.line(n));
  const all = lines.every((l) => l.text.startsWith(prefix));
  for (const l of lines) {
    if (all) changes.push({ from: l.from, to: l.from + prefix.length, insert: "" });
    else if (!l.text.startsWith(prefix)) changes.push({ from: l.from, to: l.from, insert: prefix });
  }
  if (changes.length) view.dispatch({ changes });
  view.focus();
}

/** Cicla títulos: nenhum → # → ## → ### → nenhum. */
export function cycleHeading(view: EditorView): void {
  const { state } = view;
  const line = state.doc.lineAt(state.selection.main.head);
  const m = /^(#{1,6})\s+/.exec(line.text);
  if (!m) {
    view.dispatch({ changes: { from: line.from, to: line.from, insert: "# " } });
  } else if (m[1].length >= 3) {
    view.dispatch({ changes: { from: line.from, to: line.from + m[0].length, insert: "" } });
  } else {
    view.dispatch({ changes: { from: line.from, to: line.from + m[0].length, insert: "#".repeat(m[1].length + 1) + " " } });
  }
  view.focus();
}

/** Continuação automática de listas ao pressionar Enter. */
export function continueList(view: EditorView): boolean {
  const { state } = view;
  const sel = state.selection.main;
  if (!sel.empty) return false;
  const line = state.doc.lineAt(sel.from);
  if (sel.from !== line.to) return false;

  const m = /^(\s*)(?:([-*+])\s+(\[[ xX]\]\s+)?|(\d+)([.)])\s+)/.exec(line.text);
  if (!m) return false;

  const indent = m[1] ?? "";
  const content = line.text.slice(m[0].length);

  // Item vazio → encerra a lista: tira o marcador, deixa uma linha em branco
  // e põe o cursor na linha seguinte (assim o texto vira um parágrafo normal).
  if (content.trim() === "") {
    view.dispatch({
      changes: { from: line.from, to: line.to, insert: "\n" },
      selection: { anchor: line.from + 1 },
      scrollIntoView: true,
    });
    return true;
  }

  let insertText = "\n" + indent;
  if (m[2]) {
    insertText += `${m[2]} `;
    if (m[3]) insertText += "[ ] ";
  } else if (m[4]) {
    insertText += `${parseInt(m[4], 10) + 1}${m[5]} `;
  }

  view.dispatch({
    changes: { from: sel.from, to: sel.from, insert: insertText },
    selection: { anchor: sel.from + insertText.length },
    scrollIntoView: true,
  });
  return true;
}
