// Editor Markdown baseado no CodeMirror 6.
import { EditorView, keymap, lineNumbers, drawSelection, highlightActiveLine, highlightActiveLineGutter, placeholder, Decoration, type DecorationSet } from "@codemirror/view";
import { EditorState, Compartment, Prec, StateEffect, StateField, type Extension } from "@codemirror/state";
import { defaultKeymap, history, historyKeymap, indentWithTab, insertNewlineAndIndent } from "@codemirror/commands";
import { markdown, markdownLanguage } from "@codemirror/lang-markdown";
import { languages } from "@codemirror/language-data";
import { syntaxHighlighting, HighlightStyle, indentOnInput, bracketMatching } from "@codemirror/language";
import { tags as t } from "@lezer/highlight";
import { clamp } from "./util";
import { synonymsFor, type WritingIssue } from "./writing";
import { createGhostTextExtension, setGhostEffect } from "./autocomplete";

export interface CursorPos {
  line: number;
  col: number;
}

// ---------- avisos de escrita (ortografia/estilo) ----------

const setIssuesEffect = StateEffect.define<WritingIssue[]>();

const issueField = StateField.define<{ issues: WritingIssue[]; deco: DecorationSet }>({
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

const mono = `ui-monospace, "Cascadia Code", "JetBrains Mono", Consolas, monospace`;

function baseTheme(dark: boolean): Extension {
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

const lightHL = HighlightStyle.define([
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

const darkHL = HighlightStyle.define([
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

export class MdEditor {
  readonly view: EditorView;
  private themeComp = new Compartment();
  private hlComp = new Compartment();
  private extensions: Extension[];
  private onDocChange: () => void;
  private onCursor: (pos: CursorPos) => void;
  private dark = false;
  private ghostTextEnabled = true;

  constructor(
    parent: HTMLElement,
    onDocChange: () => void,
    onCursor: (pos: CursorPos) => void,
    ghostTextEnabled = true
  ) {
    this.onDocChange = onDocChange;
    this.onCursor = onCursor;
    this.ghostTextEnabled = ghostTextEnabled;
    this.extensions = this.buildExtensions();

    this.view = new EditorView({
      state: EditorState.create({ doc: "", extensions: this.extensions }),
      parent,
    });
    // ao rolar ou mudar o texto, o popup de sugestões some (as posições mudam)
    this.view.scrollDOM.addEventListener("scroll", () => this.closeIssuesPopup(), { passive: true });
    // clicar fora (menu, painel, preview) também fecha o popup
    document.addEventListener(
      "mousedown",
      (event) => {
        if (!this.popup) return;
        const alvo = event.target as Node | null;
        if (alvo && (this.popup.contains(alvo) || this.view.dom.contains(alvo))) return;
        this.closeIssuesPopup();
      },
      true
    );
  }

  /** Extensões do editor com o tema ATUAL (recriadas ao trocar de tema/documento). */
  private buildExtensions(): Extension[] {
    return [
      lineNumbers(),
      highlightActiveLineGutter(),
      highlightActiveLine(),
      drawSelection(),
      history(),
      indentOnInput(),
      bracketMatching(),
      markdown({ base: markdownLanguage, codeLanguages: languages }),
      EditorView.lineWrapping,
      createGhostTextExtension({
        getEnabled: () => this.ghostTextEnabled,
      }),
      Prec.high(
        keymap.of([
          { key: "Enter", run: (v) => this.continueList(v) },
          // Shift+Enter continua a lista igual ao Enter (1. → 2.); num item vazio, encerra a lista
          { key: "Shift-Enter", run: (v) => this.continueList(v) || insertNewlineAndIndent(v) },
        ])
      ),
      keymap.of([...defaultKeymap, ...historyKeymap, indentWithTab]),
      placeholder("Escreva seu Markdown aqui… use a barra acima para tabelas, desenhos e imagens."),
      EditorView.updateListener.of((u) => {
        if (u.docChanged) {
          this.closeIssuesPopup();
          this.onDocChange();
        }
        if (u.selectionSet || u.docChanged) {
          const sel = u.state.selection.main;
          const line = u.state.doc.lineAt(sel.head);
          this.onCursor({ line: line.number, col: sel.head - line.from + 1 });
        }
      }),
      this.themeComp.of(baseTheme(this.dark)),
      this.hlComp.of(syntaxHighlighting(this.dark ? darkHL : lightHL)),
      issueField,
      EditorView.domEventHandlers({
        mousedown: (event) => this.handleIssueMouseDown(event),
        mouseup: (event, view) => this.handleIssueMouseUp(event, view),
      }),
    ];
  }

  setGhostTextEnabled(enabled: boolean): void {
    this.ghostTextEnabled = enabled;
    if (!enabled) {
      this.view.dispatch({ effects: setGhostEffect.of(null) });
    }
  }

  isGhostTextEnabled(): boolean {
    return this.ghostTextEnabled;
  }

  // ---------- conteúdo ----------


  getText(): string {
    return this.view.state.doc.toString();
  }

  setText(text: string, resetHistory = true): void {
    if (resetHistory) {
      // recria as extensões com o tema atual (senão o tema voltaria ao claro)
      this.extensions = this.buildExtensions();
      this.view.setState(EditorState.create({ doc: text, extensions: this.extensions }));
      this.view.dispatch({ selection: { anchor: 0 } });
    } else {
      this.view.dispatch({
        changes: { from: 0, to: this.view.state.doc.length, insert: text },
        selection: { anchor: 0 },
      });
    }
    this.view.focus();
  }

  focus(): void {
    this.view.focus();
  }

  /** Estado completo do editor (texto, seleção e histórico de desfazer) — usado pelas abas. */
  getState(): EditorState {
    return this.view.state;
  }

  /** Cria um estado novo (com histórico próprio) para o documento de uma aba. */
  createState(text: string): EditorState {
    return EditorState.create({ doc: text, extensions: this.buildExtensions() });
  }

  /** Troca o documento inteiro por outro estado salvo, mantendo tema e rolagem da aba. */
  loadState(state: EditorState, scrollTop = 0): void {
    this.view.setState(state);
    this.setTheme(this.dark);
    this.view.scrollDOM.scrollTop = scrollTop;
    this.view.requestMeasure();
  }

  scrollTop(): number {
    return this.view.scrollDOM.scrollTop;
  }

  /**
   * Alinhamento estilo Word: envolve as linhas tocadas pela seleção em `<div align="…">`.
   * Se a seleção for só uma PARTE de um bloco já alinhado, o resto do bloco mantém o
   * alinhamento antigo — só o trecho selecionado muda.
   */
  setAlignment(kind: "left" | "center" | "right" | "justify"): void {
    const { state } = this.view;
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

    this.view.dispatch({
      changes: {
        from: wrapperFrom > 0 ? state.doc.line(wrapperFrom).from : limiteFrom,
        to: wrapperFrom > 0 ? state.doc.line(wrapperTo).to : limiteTo,
        insert: partes.join("\n\n"),
      },
    });
    this.view.focus();
  }

  /** Foca a linha mais próxima de um clique em qualquer ponto da área do editor. */
  focusAt(clientX: number, clientY: number): void {
    const pos = this.view.posAtCoords({ x: clientX, y: clientY });
    if (pos !== null) this.view.dispatch({ selection: { anchor: pos } });
    this.view.focus();
  }

  // ---------- assistente de escrita ----------

  /** Avisos a mostrar (sublinhados). */
  setIssues(issues: WritingIssue[]): void {
    this.view.dispatch({ effects: setIssuesEffect.of(issues) });
  }

  /** Chamado quando algo muda por causa de uma sugestão (para revisar de novo). */
  onIssuesChanged: (() => void) | null = null;

  /** Chamado quando o usuário manda ignorar uma palavra NESTE texto (temporário). */
  onIgnoreHere: ((word: string) => void) | null = null;

  /** Chamado quando o usuário manda ignorar uma palavra (dicionário pessoal, para sempre). */
  onIgnoreWord: ((word: string) => void) | null = null;

  /** Seleciona e mostra um trecho (usado pelo painel de revisão). */
  gotoRange(from: number, to: number): void {
    const docLen = this.view.state.doc.length;
    const start = clamp(from, 0, docLen);
    const end = clamp(to, start, docLen);
    this.view.dispatch({ selection: { anchor: start, head: end }, effects: EditorView.scrollIntoView(start, { y: "center" }) });
    this.view.focus();
  }

  closeIssuesPopup(): void {
    this.popup?.remove();
    this.popup = null;
  }

  private popup: HTMLElement | null = null;

  /**
   * Clique na palavra sublinhada: NUNCA intercepta o mouse — é o que permite clicar no meio
   * da palavra, arrastar e selecionar normalmente. Só fecha o popup que estiver aberto.
   */
  private handleIssueMouseDown(event: MouseEvent): boolean {
    if (event.button !== 0) return false;
    this.closeIssuesPopup();
    return false;
  }

  /** Abre o popup do corretor quando o clique/seleção termina numa palavra sublinhada. */
  private handleIssueMouseUp(event: MouseEvent, view: EditorView): boolean {
    if (event.button !== 0) return false;
    const issues = view.state.field(issueField).issues;
    const sel = view.state.selection.main;

    if (!sel.empty) {
      // selecionou pedaço de uma palavra sublinhada (ex.: clique duplo) → mostra as sugestões
      const dentro = issues.find((i) => sel.from >= i.from && sel.to <= i.to && i.to - i.from <= 60);
      if (!dentro) return false;
      this.showIssuePopup(dentro, view);
      return false;
    }

    const pos = view.posAtCoords({ x: event.clientX, y: event.clientY });
    if (pos === null) return false;
    // palavra errada primeiro (o clique nela deve mostrar as sugestões)
    const issue =
      issues.find((i) => i.kind === "spell" && pos >= i.from && pos <= i.to) ??
      issues.find((i) => pos >= i.from && pos <= i.to);
    if (!issue) return false;
    this.showIssuePopup(issue, view);
    return false;
  }

  private showIssuePopup(issue: WritingIssue, view: EditorView): void {
    this.closeIssuesPopup();
    const pop = document.createElement("div");
    pop.className = "cm-issue-popup";

    const title = document.createElement("div");
    title.className = "cm-issue-title";
    title.textContent = issue.message;
    pop.append(title);

    const addChip = (row: HTMLElement, text: string, onClick: () => void, ghost = false) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = ghost ? "cm-issue-chip ghost" : "cm-issue-chip";
      b.textContent = text;
      b.addEventListener("click", (e) => {
        e.preventDefault();
        onClick();
      });
      row.append(b);
    };

    if (issue.suggestions.length) {
      const row = document.createElement("div");
      row.className = "cm-issue-row";
      const label = document.createElement("span");
      label.className = "cm-issue-label";
      label.textContent = "Trocar por:";
      row.append(label);
      for (const s of issue.suggestions.slice(0, 6)) {
        addChip(row, s, () => {
          view.dispatch({ changes: { from: issue.from, to: issue.to, insert: s } });
          this.closeIssuesPopup();
          this.onIssuesChanged?.();
        });
      }
      pop.append(row);
    }

    const otherWords = synonymsFor(issue.word);
    if (otherWords.length) {
      const row = document.createElement("div");
      row.className = "cm-issue-row";
      const label = document.createElement("span");
      label.className = "cm-issue-label";
      label.textContent = "Outras palavras:";
      row.append(label);
      for (const s of otherWords.slice(0, 5)) {
        addChip(row, s, () => {
          view.dispatch({ changes: { from: issue.from, to: issue.to, insert: s } });
          this.closeIssuesPopup();
          this.onIssuesChanged?.();
        });
      }
      pop.append(row);
    }

    const actions = document.createElement("div");
    actions.className = "cm-issue-row";
    addChip(
      actions,
      "Ignorar palavra",
      () => {
        this.onIgnoreHere?.(issue.word);
        this.closeIssuesPopup();
      },
      true
    );
    addChip(
      actions,
      "Adicionar ao dicionário",
      () => {
        this.onIgnoreWord?.(issue.word);
        this.closeIssuesPopup();
      },
      true
    );
    pop.append(actions);

    // camada fixa da página: não é cortada pelo editor nem atrapalha o texto por baixo
    const coords = view.coordsAtPos(issue.from);
    document.body.append(pop);
    pop.style.position = "fixed";
    const width = pop.offsetWidth;
    const height = pop.offsetHeight;
    const left = (coords?.left ?? 0) - 10;
    pop.style.left = `${Math.max(8, Math.min(left, window.innerWidth - width - 12))}px`;
    const abaixo = (coords?.bottom ?? 0) + 6;
    const acima = (coords?.top ?? 0) - height - 6;
    pop.style.top = `${abaixo + height > window.innerHeight - 6 && acima > 6 ? acima : abaixo}px`;
    this.popup = pop;
  }

  /** Insere texto; o marcador $0 define onde o cursor fica. */
  insert(snippet: string): void {
    const { state } = this.view;
    const sel = state.selection.main;
    const marker = snippet.indexOf("$0");
    const body = marker >= 0 ? snippet.replace("$0", "") : snippet;
    const anchor = marker >= 0 ? sel.from + marker : sel.from + body.length;
    this.view.dispatch({
      changes: { from: sel.from, to: sel.to, insert: body },
      selection: { anchor },
    });
    this.view.focus();
  }

  insertAt(pos: number, text: string): void {
    const docLen = this.view.state.doc.length;
    const from = clamp(pos, 0, docLen);
    this.view.dispatch({
      changes: { from, to: from, insert: text },
      selection: { anchor: from + text.length },
    });
    this.view.focus();
  }

  /** Substitui um intervalo do documento (usado para atualizar desenhos de letras). */
  replaceRange(from: number, to: number, insert: string): void {
    const docLen = this.view.state.doc.length;
    const f = clamp(from, 0, docLen);
    const t = clamp(to, f, docLen);
    this.view.dispatch({ changes: { from: f, to: t, insert } });
  }

  /** Substitui vários intervalos numa só transação (uma única ação de desfazer). */
  replaceRanges(changes: { from: number; to: number; insert: string }[], cursorAssoc: -1 | 1 = 1): void {
    if (!changes.length) return;
    const docLen = this.view.state.doc.length;
    const list = changes
      .map((c) => ({ from: clamp(c.from, 0, docLen), to: clamp(c.to, 0, docLen), insert: c.insert }))
      .filter((c) => c.from <= c.to)
      .sort((a, b) => a.from - b.from);
    // nunca deixa intervalos sobrepostos (o CodeMirror recusaria a transação);
    // quando dois se sobrepõem, fica o maior (costuma ser a correção mais completa)
    const safe: { from: number; to: number; insert: string }[] = [];
    for (const c of list) {
      const last = safe[safe.length - 1];
      if (last && c.from < last.to) {
        if (c.to - c.from > last.to - last.from) safe[safe.length - 1] = c;
        continue;
      }
      safe.push(c);
    }
    if (!safe.length) return;
    // cursorAssoc -1 mantém o cursor ANTES do texto inserido (usado ao acrescentar o ponto
    // final: se o usuário continuar a frase, o texto entra antes do ponto)
    const sel = this.view.state.selection.main;
    const mapped = this.view.state.changes(safe);
    this.view.dispatch({
      changes: safe,
      selection: { anchor: mapped.mapPos(sel.anchor, cursorAssoc), head: mapped.mapPos(sel.head, cursorAssoc) },
    });
  }

  selectionPos(): { from: number; to: number } {
    const sel = this.view.state.selection.main;
    return { from: sel.from, to: sel.to };
  }

  /** Acha o par de marcas que envolve a seleção (ex.: a seleção está dentro de **…**). */
  private findWrapper(
    from: number,
    to: number,
    before: string,
    after: string
  ): { from: number; to: number; innerFrom: number; innerTo: number } | null {
    const { state } = this.view;
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
  wrapSelection(before: string, after: string, ph: string): void {
    const { state } = this.view;
    const sel = state.selection.main;
    const text = state.sliceDoc(sel.from, sel.to);

    if (sel.empty) {
      this.view.dispatch({
        changes: { from: sel.from, to: sel.to, insert: before + ph + after },
        selection: { anchor: sel.from + before.length, head: sel.from + before.length + ph.length },
      });
      this.view.focus();
      return;
    }

    if (text.startsWith(before) && text.endsWith(after) && text.length >= before.length + after.length) {
      const inner = text.slice(before.length, text.length - after.length);
      this.view.dispatch({
        changes: { from: sel.from, to: sel.to, insert: inner },
        selection: { anchor: sel.from, head: sel.from + inner.length },
      });
      this.view.focus();
      return;
    }

    const wrapper = this.findWrapper(sel.from, sel.to, before, after);
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
      this.view.dispatch({
        changes: { from: wrapper.from, to: wrapper.to, insert: novo },
        selection: { anchor: inicioSelecao, head: inicioSelecao + selecao.length },
      });
      this.view.focus();
      return;
    }

    this.view.dispatch({
      changes: { from: sel.from, to: sel.to, insert: before + text + after },
      selection: { anchor: sel.from + before.length, head: sel.from + before.length + text.length },
    });
    this.view.focus();
  }

  /** Adiciona/remove prefixo em todas as linhas da seleção (listas, citações…). */
  toggleLinePrefix(prefix: string): void {
    const { state } = this.view;
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
    if (changes.length) this.view.dispatch({ changes });
    this.view.focus();
  }

  /** Cicla títulos: nenhum → # → ## → ### → nenhum. */
  cycleHeading(): void {
    const { state } = this.view;
    const line = state.doc.lineAt(state.selection.main.head);
    const m = /^(#{1,6})\s+/.exec(line.text);
    if (!m) {
      this.view.dispatch({ changes: { from: line.from, to: line.from, insert: "# " } });
    } else if (m[1].length >= 3) {
      this.view.dispatch({ changes: { from: line.from, to: line.from + m[0].length, insert: "" } });
    } else {
      this.view.dispatch({ changes: { from: line.from, to: line.from + m[0].length, insert: "#".repeat(m[1].length + 1) + " " } });
    }
    this.view.focus();
  }

  gotoLine(n: number): void {
    const line = this.view.state.doc.line(clamp(n, 1, this.view.state.doc.lines));
    this.view.dispatch({
      selection: { anchor: line.from },
      effects: EditorView.scrollIntoView(line.from, { y: "start" }),
    });
    this.view.focus();
  }

  onScroll(cb: () => void): void {
    this.view.scrollDOM.addEventListener("scroll", cb, { passive: true });
  }

  setTheme(dark: boolean): void {
    this.dark = dark;
    this.view.dispatch({
      effects: [
        this.themeComp.reconfigure(baseTheme(dark)),
        this.hlComp.reconfigure(syntaxHighlighting(dark ? darkHL : lightHL)),
      ],
    });
  }

  /** Continuação automática de listas ao pressionar Enter. */
  private continueList(view: EditorView): boolean {
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
}
