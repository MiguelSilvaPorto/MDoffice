// Alinhamento estilo Word: envolve as linhas da seleção em <div align="…"> (só o trecho escolhido muda).

import type { EditorView } from "@codemirror/view";

/**
 * Alinhamento estilo Word: envolve as linhas tocadas pela seleção em `<div align="…">`.
 * Se a seleção for só uma PARTE de um bloco já alinhado, o resto do bloco mantém o
 * alinhamento antigo — só o trecho selecionado muda.
 */
export function setAlignment(view: EditorView, kind: "left" | "center" | "right" | "justify"): void {
  const { state } = view;
  const sel = state.selection.main;
  const openRx = /^<div align="(left|center|right|justify)">$/;
  const isBlank = (n: number) => state.doc.line(n).text.trim() === "";

  const selFirst = state.doc.lineAt(sel.from).number;
  const selLast = state.doc.lineAt(sel.to).number;

  // ---------- existe um invólucro em volta? ----------
  let wrapperFrom = -1;
  let wrapperTo = -1;
  let current: string | null = null;

  const openAt = (n: number): string | null => {
    const m = openRx.exec(state.doc.line(n).text.trim());
    return m ? m[1] : null;
  };

  const proprio = openAt(selFirst);
  if (proprio) {
    // a própria seleção começa no invólucro
    current = proprio;
    wrapperFrom = selFirst;
  } else {
    // procura subindo, atravessando o conteúdo do bloco (pode haver vários parágrafos)
    for (let n = selFirst - 1; n >= 1; n--) {
      const txt = state.doc.line(n).text.trim();
      if (txt === "</div>") break; // já estamos fora de qualquer bloco
      const m = openRx.exec(txt);
      if (m) {
        current = m[1];
        wrapperFrom = n;
        break;
      }
    }
  }
  if (wrapperFrom > 0) {
    for (let n = Math.max(selLast, wrapperFrom) + 1; n <= state.doc.lines; n++) {
      const txt = state.doc.line(n).text.trim();
      if (openRx.test(txt)) break; // entrou em outro bloco
      if (txt === "</div>") {
        wrapperTo = n;
        break;
      }
    }
    if (wrapperTo < 0) {
      // abriu mas não fechou: trata como bloco comum
      current = null;
      wrapperFrom = -1;
    }
  }

  // ---------- o que muda: exatamente o trecho selecionado ----------
  const limpo = (s: string) => s.replace(/^\s+|\s+$/g, "");
  let limiteFrom: number; // região que pode ser reescrita (conteúdo do bloco ou parágrafo)
  let limiteTo: number;
  let alinhamentoFora: string | null = null;

  if (wrapperFrom > 0) {
    limiteFrom = state.doc.line(wrapperFrom).to;
    limiteTo = state.doc.line(wrapperTo).from;
    alinhamentoFora = current;
  } else {
    // sem invólucro: o antes/depois é o resto do parágrafo em volta da seleção
    let primeira = selFirst;
    while (primeira > 1 && !isBlank(primeira - 1)) primeira--;
    let ultima = selLast;
    while (ultima < state.doc.lines && !isBlank(ultima + 1)) ultima++;
    limiteFrom = state.doc.line(primeira).from;
    limiteTo = state.doc.line(ultima).to;
  }

  let meioFrom = sel.from;
  let meioTo = sel.to;
  if (sel.empty) {
    // sem seleção: o alvo é o parágrafo inteiro (como no Word)
    let primeira = selFirst;
    while (primeira > 1 && primeira - 1 > Math.max(0, wrapperFrom) && !isBlank(primeira - 1)) primeira--;
    let ultima = selLast;
    while (ultima < state.doc.lines && (wrapperTo < 0 || ultima + 1 < wrapperTo) && !isBlank(ultima + 1)) ultima++;
    meioFrom = state.doc.line(primeira).from;
    meioTo = state.doc.line(ultima).to;
  }

  const antes = limpo(state.sliceDoc(limiteFrom, meioFrom));
  const depois = limpo(state.sliceDoc(meioTo, limiteTo));
  const meio = limpo(state.sliceDoc(meioFrom, meioTo));
  if (!meio) return;

  const comFora = (texto: string) => (alinhamentoFora ? `<div align="${alinhamentoFora}">\n\n${texto}\n\n</div>` : texto);
  const partes: string[] = [];
  if (antes) partes.push(comFora(antes));
  partes.push(kind === alinhamentoFora ? meio : `<div align="${kind}">\n\n${meio}\n\n</div>`);
  if (depois) partes.push(comFora(depois));

  view.dispatch({
    changes: {
      from: wrapperFrom > 0 ? state.doc.line(wrapperFrom).from : limiteFrom,
      to: wrapperFrom > 0 ? state.doc.line(wrapperTo).to : limiteTo,
      insert: partes.join("\n\n"),
    },
  });
  view.focus();
}
