// Editor Markdown baseado no CodeMirror 6.
import { EditorView, keymap, lineNumbers, drawSelection, highlightActiveLineGutter, placeholder, Decoration, ViewPlugin, type DecorationSet, type ViewUpdate } from "@codemirror/view";
import { EditorState, Compartment, Prec, StateEffect, StateField, type Extension } from "@codemirror/state";
import { defaultKeymap, history, historyKeymap, indentWithTab, insertNewlineAndIndent } from "@codemirror/commands";
import { markdown, markdownLanguage } from "@codemirror/lang-markdown";
import { languages } from "@codemirror/language-data";
import { syntaxHighlighting, HighlightStyle, indentOnInput, bracketMatching } from "@codemirror/language";
import { tags as t } from "@lezer/highlight";
import { clamp } from "../util";
import { baseTheme, lightHL, darkHL } from "./editor/theme";
import { issueField, setIssuesEffect } from "./editor/issues";
import { setAlignment } from "./editor/alignment";
import { wrapSelection, toggleLinePrefix, cycleHeading, continueList } from "./editor/formatting";
import { partesDaTroca } from "./diffTroca";
import { synonymsFor, type WritingIssue } from "../broker/writing";
import { createGhostTextExtension, setGhostEffect } from "../broker/autocomplete";

export interface CursorPos {
  line: number;
  col: number;
}

/**
 * Destaque da linha do cursor — só quando a seleção está VAZIA. Com uma seleção,
 * o destaque do `highlightActiveLine` caía por cima dela, somando as duas cores
 * e parecendo "duas coisas selecionadas".
 */
const linhaDoCursor = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;
    constructor(view: EditorView) {
      this.decorations = this.marcar(view);
    }
    update(update: ViewUpdate): void {
      if (update.docChanged || update.selectionSet) this.decorations = this.marcar(update.view);
    }
    marcar(view: EditorView): DecorationSet {
      const linhas = view.state.selection.ranges
        .filter((r) => r.empty)
        .map((r) => Decoration.line({ class: "cm-activeLine" }).range(view.state.doc.lineAt(r.head).from));
      return Decoration.set(linhas);
    }
  }
);

// ---------- avisos de escrita (ortografia/estilo) ----------

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
    // ao rolar (ou redimensionar), o popup do corretor ACOMPANHA o trecho: antes ele sumia a
    // cada rolagem, porque as posições mudam — e a pessoa perdia a mensagem no meio da leitura.
    // Um quadro por rolagem, como nos outros gestos da tela.
    let quadroDoPopup = 0;
    const acompanhar = () => {
      if (!this.popup || quadroDoPopup) return;
      quadroDoPopup = requestAnimationFrame(() => {
        quadroDoPopup = 0;
        this.reposicionarPopup();
      });
    };
    this.view.scrollDOM.addEventListener("scroll", acompanhar, { passive: true });
    window.addEventListener("resize", acompanhar);
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
      linhaDoCursor,
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
          { key: "Enter", run: (v) => continueList(v) },
          // Shift+Enter continua a lista igual ao Enter (1. → 2.); num item vazio, encerra a lista
          { key: "Shift-Enter", run: (v) => continueList(v) || insertNewlineAndIndent(v) },
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

  /** Alinhamento estilo Word (ver alignment.ts). */
  setAlignment(kind: "left" | "center" | "right" | "justify"): void {
    setAlignment(this.view, kind);
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

  /** Chamado quando o usuário manda ignorar um AVISO DE ESTILO neste texto (ex.: frase comprida). */
  onIgnoreStyle: ((issue: WritingIssue) => void) | null = null;

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
    this.popupIssue = null;
    this.popupView = null;
  }

  private popup: HTMLElement | null = null;
  /** o aviso e a visão do popup aberto: é o que deixa ele ACOMPANHAR o trecho ao rolar */
  private popupIssue: WritingIssue | null = null;
  private popupView: EditorView | null = null;

  /** Põe o popup na posição atual do trecho (clampado na janela). */
  private posicionarPopup(coords: { left: number; top: number; bottom: number }): void {
    const pop = this.popup;
    if (!pop) return;
    const width = pop.offsetWidth;
    const height = pop.offsetHeight;
    const left = coords.left - 10;
    pop.style.left = `${Math.max(8, Math.min(left, window.innerWidth - width - 12))}px`;
    const abaixo = coords.bottom + 6;
    const acima = coords.top - height - 6;
    pop.style.top = `${abaixo + height > window.innerHeight - 6 && acima > 6 ? acima : abaixo}px`;
  }

  /**
   * Recoloca o popup do aviso onde o trecho está AGORA. Antes, rolar o texto fechava o cartão (as
   * posições mudam) — a pessoa perdia a mensagem no meio da leitura ("some a cada movimento"). Ele
   * só fecha quando o trecho sai da janela do editor (não há onde ancorar) ou quando o texto muda
   * (aí a correção ficaria velha e aplicaria no lugar errado).
   */
  private reposicionarPopup(): void {
    if (!this.popup || !this.popupIssue || !this.popupView) return;
    const coords = this.popupView.coordsAtPos(this.popupIssue.from);
    const janela = this.popupView.scrollDOM.getBoundingClientRect();
    if (!coords || coords.bottom < janela.top || coords.top > janela.bottom) {
      this.closeIssuesPopup();
      return;
    }
    this.posicionarPopup(coords);
  }

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

  /**
   * Trecho do aviso para o chip "Corrigir", em partes: o contexto fica neutro e a troca ganha
   * cor — o que sai (vermelho, riscado) e o que entra (verde). Quando só um lado muda, o comum
   * fica neutro ("pronto" + verde "."); quando os dois mudam, mostra os trechos inteiros
   * ("responsavo" riscado → "responsável" verde).
   */
  private fixPreviewParts(view: EditorView, issue: WritingIssue): { tipo: "texto" | "rem" | "add"; texto: string }[] {
    return this.previewParts(view, issue.from, issue.to, issue.fix ?? "");
  }

  /** O mesmo preview, para um trecho qualquer — os chips de "Dividir:" e "Encurtar:". */
  private previewParts(view: EditorView, de: number, ate: number, insert: string): { tipo: "texto" | "rem" | "add"; texto: string }[] {
    const doc = view.state.doc;
    const from = Math.max(0, de - 30);
    const to = Math.min(doc.length, ate + 36);
    const velho = doc.sliceString(de, ate);
    const antes = doc.sliceString(from, de).replace(/\s+/g, " ").trimStart();
    const depois = doc.sliceString(ate, to).replace(/\s+/g, " ").trimEnd();
    // só o miolo que muda de verdade fica colorido (prefixo/sufixo comuns ficam neutros)
    const partes: { tipo: "texto" | "rem" | "add"; texto: string }[] = [];
    if (from > 0) partes.push({ tipo: "texto", texto: "…" });
    if (antes) partes.push({ tipo: "texto", texto: antes });
    partes.push(...partesDaTroca(velho, insert));
    if (depois) partes.push({ tipo: "texto", texto: depois });
    if (to < doc.length) partes.push({ tipo: "texto", texto: "…" });
    return partes;
  }

  private showIssuePopup(issue: WritingIssue, view: EditorView): void {
    this.closeIssuesPopup();
    const pop = document.createElement("div");
    pop.className = "cm-issue-popup";

    const title = document.createElement("div");
    title.className = "cm-issue-title";
    title.textContent = issue.message;
    pop.append(title);

    const spanTexto = (classe: string, texto: string) => {
      const s = document.createElement("span");
      if (classe) s.className = classe;
      s.textContent = texto;
      return s;
    };
    /** Chip com o conteúdo montado à mão (para colorir o diff); `titulo` é a dica com o texto todo. */
    const addChipDom = (row: HTMLElement, montar: (b: HTMLButtonElement) => void, titulo: string, onClick: () => void, ghost = false) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = ghost ? "cm-issue-chip ghost" : "cm-issue-chip";
      montar(b);
      b.title = titulo; // o chip pode encurtar com "…"; a dica mostra o texto todo
      b.addEventListener("click", (e) => {
        e.preventDefault();
        onClick();
      });
      row.append(b);
    };
    const addChip = (row: HTMLElement, text: string, onClick: () => void, ghost = false) => {
      addChipDom(row, (b) => { b.textContent = text; }, text, onClick, ghost);
    };

    if (issue.suggestions.length) {
      const row = document.createElement("div");
      row.className = "cm-issue-row";
      const label = document.createElement("span");
      label.className = "cm-issue-label";
      label.textContent = "Trocar por:";
      row.append(label);
      const removido = view.state.doc.sliceString(issue.from, issue.to).replace(/\s+/g, " ").trim();
      for (const s of issue.suggestions.slice(0, 6)) {
        addChipDom(
          row,
          (b) => {
            if (removido && removido !== s) b.append(spanTexto("cm-issue-rem", removido), spanTexto("cm-issue-seta", "→"));
            b.append(spanTexto("cm-issue-add", s));
          },
          removido && removido !== s ? `${removido} → ${s}` : s,
          () => {
            view.dispatch({ changes: { from: issue.from, to: issue.to, insert: s } });
            this.closeIssuesPopup();
            this.onIssuesChanged?.();
          }
        );
      }
      pop.append(row);
    }

    // Aviso de estilo com correção calculada e sem lista de trocas (ex.: quebrar frase comprida):
    // mostra o trecho com o diff colorido — o que sai em vermelho (riscado), o que entra em verde.
    if (!issue.suggestions.length && issue.kind === "style" && issue.fix !== undefined) {
      const row = document.createElement("div");
      row.className = "cm-issue-row";
      const label = document.createElement("span");
      label.className = "cm-issue-label";
      label.textContent = "Corrigir:";
      row.append(label);
      const partes = this.fixPreviewParts(view, issue);
      addChipDom(
        row,
        (b) => {
          for (const p of partes) b.append(spanTexto(p.tipo === "rem" ? "cm-issue-rem" : p.tipo === "add" ? "cm-issue-add" : "", p.texto));
        },
        partes.map((p) => p.texto).join(""),
        () => {
          view.dispatch({ changes: { from: issue.from, to: issue.to, insert: issue.fix! } });
          this.closeIssuesPopup();
          this.onIssuesChanged?.();
        }
      );
      pop.append(row);
    }

    // Candidatos para DIVIDIR o trecho comprido: cada chip mostra o resultado e aplica no
    // próprio trecho — nada entra sozinho.
    if (issue.divisores?.length) {
      const row = document.createElement("div");
      row.className = "cm-issue-row";
      const label = document.createElement("span");
      label.className = "cm-issue-label";
      label.textContent = "Dividir:";
      row.append(label);
      for (const d of issue.divisores) {
        const partes = this.previewParts(view, d.from, d.to, d.insert);
        addChipDom(
          row,
          (b) => {
            for (const p of partes) b.append(spanTexto(p.tipo === "rem" ? "cm-issue-rem" : p.tipo === "add" ? "cm-issue-add" : "", p.texto));
          },
          d.rotulo,
          () => {
            view.dispatch({ changes: { from: d.from, to: d.to, insert: d.insert } });
            this.closeIssuesPopup();
            this.onIssuesChanged?.();
          }
        );
      }
      pop.append(row);
    }

    // Trocas que ENCURTAM o trecho mantendo o nexo — cada uma no próprio trecho.
    if (issue.trocas?.length) {
      const row = document.createElement("div");
      row.className = "cm-issue-row";
      const label = document.createElement("span");
      label.className = "cm-issue-label";
      label.textContent = "Encurtar:";
      row.append(label);
      for (const t of issue.trocas) {
        addChip(row, t.rotulo, () => {
          view.dispatch({ changes: { from: t.from, to: t.to, insert: t.para } });
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
    if (issue.kind === "spell") {
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
    } else {
      // aviso de estilo não vive de dicionário: a ação certa é sumir com ele NESTE texto
      addChip(
        actions,
        "Ignorar neste texto",
        () => {
          this.onIgnoreStyle?.(issue);
          this.closeIssuesPopup();
        },
        true
      );
    }
    pop.append(actions);

    // camada fixa da página: não é cortada pelo editor nem atrapalha o texto por baixo
    const coords = view.coordsAtPos(issue.from);
    document.body.append(pop);
    pop.style.position = "fixed";
    this.popup = pop;
    this.popupIssue = issue;
    this.popupView = view;
    if (coords) this.posicionarPopup(coords);
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

  /** Envolve a seleção com marcas (ex.: **negrito**) ou tira a formatação do pedaço (ver formatting.ts). */
  wrapSelection(before: string, after: string, ph: string): void {
    wrapSelection(this.view, before, after, ph);
  }

  /** Adiciona/remove prefixo em todas as linhas da seleção (ver formatting.ts). */
  toggleLinePrefix(prefix: string): void {
    toggleLinePrefix(this.view, prefix);
  }

  /** Cicla títulos: nenhum → # → ## → ### → nenhum. */
  cycleHeading(): void {
    cycleHeading(this.view);
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

}
