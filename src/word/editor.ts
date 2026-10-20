// Motor de edição do documento Word (ProseMirror): comandos de formatação, listas, tabelas,
// imagens, atalhos de teclado. A tela (fita, páginas) fica em ribbon.ts / host.ts.
import { baseKeymap, chainCommands, createParagraphNear, liftEmptyBlock, newlineInCode, splitBlock, toggleMark } from "prosemirror-commands";
import { dropCursor } from "prosemirror-dropcursor";
import { gapCursor } from "prosemirror-gapcursor";
import { history, redo, undo } from "prosemirror-history";
import { keymap } from "prosemirror-keymap";
import { Fragment, type MarkType, type Node as PMNode, type NodeType } from "prosemirror-model";
import { liftListItem, sinkListItem, splitListItem, wrapInList } from "prosemirror-schema-list";
import { EditorState, Plugin, TextSelection, type Command, type Transaction } from "prosemirror-state";
import {
  addColumnAfter,
  addColumnBefore,
  addRowAfter,
  addRowBefore,
  columnResizing,
  deleteColumn,
  deleteRow,
  deleteTable,
  goToNextCell,
  mergeCells,
  setCellAttr,
  splitCell,
  tableEditing,
  isInTable,
} from "prosemirror-tables";
import { EditorView } from "prosemirror-view";
import { FONT_SIZES, emptyDoc, schema, type Align } from "./schema";
import { DEFAULT_SETUP, type PageSetup } from "./model";
import { ImagemView } from "./imagem";

export interface FormatState {
  bold: boolean;
  italic: boolean;
  underline: boolean;
  strike: boolean;
  sup: boolean;
  sub: boolean;
  fontFamily: string | null;
  fontSize: number | null;
  color: string | null;
  highlight: string | null;
  link: string | null;
  /** "paragraph" | "h1".."h6" | "quote" | "code" */
  block: string;
  align: Align | null;
  lineHeight: number | null;
  list: "bullet" | "ordered" | null;
  inTable: boolean;
  canUndo: boolean;
  canRedo: boolean;
}

export interface WordEditorHooks {
  /** O documento mudou (texto ou formato). */
  onChange: () => void;
  /** A seleção/cursor mudou (atualiza a fita). */
  onSelection: () => void;
  /** Plugins extras (paginação, corretor). */
  plugins?: () => Plugin[];
  /** Plugins que precisam tratar o teclado ANTES dos atalhos do editor (ex.: Tab da sugestão). */
  earlyPlugins?: () => Plugin[];
  /** Imagem colada ou arrastada (data URL). */
  onImage?: (dataUrl: string) => void;
}

const PARA_TYPES = ["paragraph", "heading"];
/** Atributos de parágrafo que o pincel de formatação leva junto. */
const PAINTER_PARA_ATTRS = ["align", "lineHeight", "spaceBefore", "spaceAfter", "indentLeft", "indentFirst"];

export class WordEditor {
  readonly view: EditorView;
  setup: PageSetup = { ...DEFAULT_SETUP, margins: { ...DEFAULT_SETUP.margins } };
  private hooks: WordEditorHooks;
  private copiedMarks: readonly import("prosemirror-model").Mark[] | null = null;
  private copiedPara: Record<string, unknown> | null = null;

  constructor(host: HTMLElement, hooks: WordEditorHooks) {
    this.hooks = hooks;
    this.view = new EditorView(host, {
      state: this.createState(emptyDoc()),
      attributes: { spellcheck: "false", class: "wd-doc", "aria-label": "Documento" },
      dispatchTransaction: (tr) => {
        const next = this.view.state.apply(tr);
        this.view.updateState(next);
        if (tr.docChanged) this.hooks.onChange();
        if (tr.docChanged || tr.selectionSet || tr.storedMarksSet) this.hooks.onSelection();
      },
      handlePaste: (_v, event) => this.handleFiles(event.clipboardData?.files),
      // `moved` = o arrasto começou DENTRO deste editor. Aí o ProseMirror já move o trecho
      // sozinho; o WebView2 entrega a própria imagem arrastada na lista de arquivos e o
      // `handleFiles` inseria uma SEGUNDA cópia (o relato "arrasto a imagem e ela duplica").
      // Arquivo de fora (do Explorer, de outra janela) continua entrando por aqui.
      handleDrop: (_v, event, _slice, moved) => (moved ? false : this.handleFiles((event as DragEvent).dataTransfer?.files)),
      nodeViews: {
        // a imagem tem alças de redimensionar e de arrastar (src/word/imagem.ts)
        image: (node, view, getPos) => new ImagemView(node, view, getPos),
      },
    });
  }

  private handleFiles(files: FileList | null | undefined): boolean {
    const img = Array.from(files ?? []).find((f) => f.type.startsWith("image/"));
    if (!img) return false;
    const fr = new FileReader();
    fr.onload = () => this.hooks.onImage?.(String(fr.result));
    fr.readAsDataURL(img);
    return true;
  }

  // ---------- estado ----------

  /** Cria um estado novo (com histórico próprio) para uma aba. */
  createState(doc: PMNode): EditorState {
    return EditorState.create({ doc, plugins: this.plugins() });
  }

  private plugins(): Plugin[] {
    const tabOrIndent: Command = (state, dispatch) => {
      if (isInTable(state)) return goToNextCell(1)(state, dispatch);
      if (sinkListItem(schema.nodes.list_item)(state, dispatch)) return true;
      if (dispatch) dispatch(state.tr.insertText("\t"));
      return true;
    };
    const shiftTab: Command = (state, dispatch) => {
      if (isInTable(state)) return goToNextCell(-1)(state, dispatch);
      return liftListItem(schema.nodes.list_item)(state, dispatch);
    };
    const mark = (n: string): Command => toggleMark(schema.marks[n]);
    return [
      ...(this.hooks.earlyPlugins?.() ?? []),
      history(),
      keymap({
        "Mod-z": undo,
        "Mod-y": redo,
        "Mod-Shift-z": redo,
        "Mod-b": mark("bold"),
        "Mod-i": mark("italic"),
        "Mod-u": mark("underline"),
        "Mod-,": mark("sub"),
        "Mod-.": mark("sup"),
        "Mod-l": this.alignCmd("left"),
        "Mod-e": this.alignCmd("center"),
        "Mod-r": this.alignCmd("right"),
        "Mod-j": this.alignCmd("justify"),
        "Mod-Alt-0": this.blockCmd("paragraph"),
        "Mod-Alt-1": this.blockCmd("h1"),
        "Mod-Alt-2": this.blockCmd("h2"),
        "Mod-Alt-3": this.blockCmd("h3"),
        "Mod-Shift-l": this.listCmd("bullet"),
        "Mod-Shift-7": this.listCmd("ordered"),
        "Mod-Enter": (state, dispatch) => {
          if (dispatch) dispatch(state.tr.replaceSelectionWith(schema.nodes.page_break.create()).scrollIntoView());
          return true;
        },
        Tab: tabOrIndent,
        "Shift-Tab": shiftTab,
        Enter: chainCommands(newlineInCode, splitListItem(schema.nodes.list_item), createParagraphNear, liftEmptyBlock, splitBlock),
        "Shift-Enter": (state, dispatch) => {
          if (dispatch) dispatch(state.tr.replaceSelectionWith(schema.nodes.hard_break.create()).scrollIntoView());
          return true;
        },
      }),
      keymap(baseKeymap),
      // o documento sempre termina num parágrafo (depois de tabela, quebra de página ou linha)
      new Plugin({
        appendTransaction(_trs, _old, state) {
          const last = state.doc.lastChild;
          if (last && ["table", "page_break", "horizontal_rule"].includes(last.type.name)) {
            return state.tr.insert(state.doc.content.size, schema.nodes.paragraph.create());
          }
          return null;
        },
      }),
      columnResizing(),
      tableEditing(),
      dropCursor({ color: "#4f46e5" }),
      gapCursor(),
      ...(this.hooks.plugins?.() ?? []),
    ];
  }

  getDoc(): PMNode {
    return this.view.state.doc;
  }

  /** Troca o documento inteiro por outro estado (outra aba). */
  loadState(state: EditorState, setup: PageSetup): void {
    this.setup = setup;
    this.view.updateState(state);
    this.hooks.onSelection();
  }

  loadDoc(doc: PMNode, setup: PageSetup): void {
    this.setup = setup;
    this.view.updateState(this.createState(doc));
    this.hooks.onSelection();
  }

  focus(): void {
    this.view.focus();
  }

  /** Substitui todo o conteúdo mantendo o histórico de desfazer (usado ao restaurar versões). */
  replaceAll(doc: PMNode): void {
    const tr = this.view.state.tr.replaceWith(0, this.view.state.doc.content.size, doc.content);
    this.view.dispatch(tr.scrollIntoView());
  }

  // ---------- consulta (a fita mostra o que está ativo) ----------

  query(): FormatState {
    const state = this.view.state;
    const { from, to, empty, $from } = state.selection;
    const marksAt = (): readonly import("prosemirror-model").Mark[] => state.storedMarks ?? $from.marks();
    const has = (t: MarkType): boolean => {
      if (empty) return !!t.isInSet(marksAt());
      return state.doc.rangeHasMark(from, to, t);
    };
    const attrOf = (t: MarkType, key: string): string | number | null => {
      const m = empty ? t.isInSet(marksAt()) : null;
      if (empty) return m ? (m.attrs[key] as string | number) : null;
      let found: string | number | null | undefined;
      let mixed = false;
      state.doc.nodesBetween(from, to, (n) => {
        if (!n.isText) return;
        const mk = t.isInSet(n.marks);
        const v = mk ? (mk.attrs[key] as string | number) : null;
        if (found === undefined) found = v;
        else if (found !== v) mixed = true;
      });
      return mixed ? null : found ?? null;
    };

    // bloco atual
    let block = "paragraph";
    let align: Align | null = null;
    let lineHeight: number | null = null;
    let list: FormatState["list"] = null;
    for (let d = $from.depth; d >= 0; d--) {
      const n = $from.node(d);
      const t = n.type.name;
      if (t === "heading" && block === "paragraph") block = `h${n.attrs.level}`;
      if (t === "code_block") block = "code";
      if (t === "blockquote" && block === "paragraph") block = "quote";
      if (PARA_TYPES.includes(t) && align === null) {
        align = n.attrs.align ?? null;
        lineHeight = n.attrs.lineHeight ?? null;
      }
      if ((t === "bullet_list" || t === "ordered_list") && !list) list = t === "bullet_list" ? "bullet" : "ordered";
    }

    return {
      bold: has(schema.marks.bold),
      italic: has(schema.marks.italic),
      underline: has(schema.marks.underline),
      strike: has(schema.marks.strike),
      sup: has(schema.marks.sup),
      sub: has(schema.marks.sub),
      fontFamily: attrOf(schema.marks.font_family, "name") as string | null,
      fontSize: attrOf(schema.marks.font_size, "size") as number | null,
      color: attrOf(schema.marks.text_color, "color") as string | null,
      highlight: attrOf(schema.marks.highlight, "color") as string | null,
      link: attrOf(schema.marks.link, "href") as string | null,
      block,
      align,
      lineHeight,
      list,
      inTable: isInTable(state),
      canUndo: undo(state),
      canRedo: redo(state),
    };
  }

  // ---------- marcas ----------

  toggle(name: "bold" | "italic" | "underline" | "strike" | "sup" | "sub" | "code"): void {
    toggleMark(schema.marks[name])(this.view.state, this.view.dispatch);
    this.view.focus();
  }

  /** Define uma marca com valor (fonte, tamanho, cor, destaque, link). `null` remove. */
  setMark(name: "font_family" | "font_size" | "text_color" | "highlight" | "link", attrs: Record<string, unknown> | null): void {
    const type = schema.marks[name];
    const { state } = this.view;
    const { empty, ranges } = state.selection;
    let tr: Transaction = state.tr;
    if (empty) {
      tr = attrs ? tr.addStoredMark(type.create(attrs)) : tr.removeStoredMark(type);
    } else {
      for (const r of ranges) {
        tr = attrs ? tr.addMark(r.$from.pos, r.$to.pos, type.create(attrs)) : tr.removeMark(r.$from.pos, r.$to.pos, type);
      }
    }
    this.view.dispatch(tr);
    this.view.focus();
  }

  /** A+ / A−: anda na lista de tamanhos. */
  stepFontSize(dir: 1 | -1): void {
    const cur = this.query().fontSize ?? this.setup.defaultSize;
    let idx = FONT_SIZES.findIndex((s) => s >= cur);
    if (idx < 0) idx = FONT_SIZES.length - 1;
    if (dir > 0) idx = FONT_SIZES[idx] > cur ? idx : Math.min(FONT_SIZES.length - 1, idx + 1);
    else idx = Math.max(0, FONT_SIZES[idx] >= cur ? idx - 1 : idx);
    this.setMark("font_size", { size: FONT_SIZES[idx] });
  }

  clearFormatting(): void {
    const { state } = this.view;
    const { from, to } = state.selection;
    let tr = state.tr;
    tr = tr.removeMark(from, to);
    state.doc.nodesBetween(from, to, (node, pos) => {
      if (PARA_TYPES.includes(node.type.name)) {
        tr = tr.setNodeMarkup(pos, node.type, { ...node.attrs, align: null, spaceBefore: null, spaceAfter: null, lineHeight: null, indentLeft: null, indentFirst: null, bg: null, borderBottom: null });
      }
    });
    this.view.dispatch(tr.setStoredMarks([]));
    this.view.focus();
  }

  /** Pincel de formatação: copia as marcas (menos link) e o formato do parágrafo do cursor. */
  copyFormat(): boolean {
    const state = this.view.state;
    const { $from } = state.selection;
    this.copiedMarks = (state.storedMarks ?? $from.marks()).filter((m) => m.type !== schema.marks.link);
    const para: Record<string, unknown> = {};
    for (let d = $from.depth; d >= 0; d--) {
      const n = $from.node(d);
      if (!PARA_TYPES.includes(n.type.name)) continue;
      for (const k of PAINTER_PARA_ATTRS) para[k] = n.attrs[k] ?? null;
      break;
    }
    this.copiedPara = para;
    return true;
  }

  /** Pincel de formatação: aplica o formato copiado à seleção (troca a formatação de letra existente). */
  applyFormat(): boolean {
    if (!this.copiedMarks) return false;
    const state = this.view.state;
    const { from, to, empty } = state.selection;
    if (empty) return false;
    let tr = state.tr;
    for (const t of Object.values(schema.marks)) if (t !== schema.marks.link) tr = tr.removeMark(from, to, t);
    for (const m of this.copiedMarks) tr = tr.addMark(from, to, m);
    const para = this.copiedPara;
    if (para) {
      state.doc.nodesBetween(from, to, (node, pos) => {
        if (!PARA_TYPES.includes(node.type.name)) return true;
        const patch: Record<string, unknown> = {};
        for (const k of PAINTER_PARA_ATTRS) if (k in node.type.spec.attrs!) patch[k] = para[k];
        tr = tr.setNodeMarkup(pos, node.type, { ...node.attrs, ...patch });
        return false;
      });
    }
    this.view.dispatch(tr);
    this.view.focus();
    return true;
  }

  /** Esquece o formato copiado. */
  clearCopiedFormat(): void {
    this.copiedMarks = null;
    this.copiedPara = null;
  }

  hasCopiedFormat(): boolean {
    return !!this.copiedMarks;
  }

  // ---------- blocos e parágrafo ----------

  private mapTextblocks(fn: (node: PMNode) => Record<string, unknown> | null): Command {
    return (state, dispatch) => {
      const { from, to } = state.selection;
      let tr = state.tr;
      let changed = false;
      state.doc.nodesBetween(from, to, (node, pos) => {
        if (!PARA_TYPES.includes(node.type.name)) return true;
        const patch = fn(node);
        if (patch) {
          tr = tr.setNodeMarkup(pos, node.type, { ...node.attrs, ...patch });
          changed = true;
        }
        return false;
      });
      if (changed && dispatch) dispatch(tr);
      return changed;
    };
  }

  alignCmd(a: Align): Command {
    return this.mapTextblocks(() => ({ align: a === "left" ? null : a }));
  }

  align(a: Align): void {
    this.alignCmd(a)(this.view.state, this.view.dispatch);
    this.view.focus();
  }

  lineHeight(v: number | null): void {
    this.mapTextblocks(() => ({ lineHeight: v }))(this.view.state, this.view.dispatch);
    this.view.focus();
  }

  paragraphSpacing(patch: { spaceBefore?: number | null; spaceAfter?: number | null }): void {
    this.mapTextblocks(() => patch)(this.view.state, this.view.dispatch);
    this.view.focus();
  }

  paragraphShading(color: string | null): void {
    this.mapTextblocks(() => ({ bg: color }))(this.view.state, this.view.dispatch);
    this.view.focus();
  }

  toggleParagraphBorder(): void {
    this.mapTextblocks((n) => ({ borderBottom: !n.attrs.borderBottom }))(this.view.state, this.view.dispatch);
    this.view.focus();
  }

  /** Alterna maiúsculas/minúsculas no texto selecionado. */
  changeCase(mode: "upper" | "lower" | "title"): void {
    const { from, to } = this.view.state.selection;
    if (from === to) return;
    const text = this.view.state.doc.textBetween(from, to);
    let transformed = text;
    if (mode === "upper") transformed = text.toUpperCase();
    else if (mode === "lower") transformed = text.toLowerCase();
    else if (mode === "title") transformed = text.replace(/(^|\s)\S/g, (c) => c.toUpperCase());
    this.view.dispatch(this.view.state.tr.insertText(transformed, from, to));
    this.view.focus();
  }

  indent(dir: 1 | -1): void {
    const inList = this.query().list;
    if (inList) {
      (dir > 0 ? sinkListItem : liftListItem)(schema.nodes.list_item)(this.view.state, this.view.dispatch);
      this.view.focus();
      return;
    }
    this.mapTextblocks((n) => {
      const cur = (n.attrs.indentLeft as number | null) ?? 0;
      const next = Math.max(0, cur + dir * 36);
      return { indentLeft: next || null };
    })(this.view.state, this.view.dispatch);
    this.view.focus();
  }

  /** Estilo do bloco: parágrafo, título 1–6, citação, código. */
  blockCmd(kind: string): Command {
    return (state, dispatch) => {
      const { from, to } = state.selection;
      if (kind === "quote") {
        const r = state.selection.$from.blockRange(state.selection.$to);
        if (!r) return false;
        if (dispatch) {
          const wrapped = state.selection.$from.node(r.depth).type === schema.nodes.blockquote;
          if (wrapped) {
            dispatch(state.tr.lift(r, r.depth - 1));
          } else dispatch(state.tr.wrap(r, [{ type: schema.nodes.blockquote }]));
        }
        return true;
      }
      let tr = state.tr;
      let changed = false;
      state.doc.nodesBetween(from, to, (node, pos) => {
        if (!node.isTextblock) return true;
        const keep = {
          align: node.attrs.align ?? null,
          spaceBefore: null,
          spaceAfter: null,
          lineHeight: node.attrs.lineHeight ?? null,
          indentLeft: node.attrs.indentLeft ?? null,
          indentFirst: node.attrs.indentFirst ?? null,
        };
        if (kind === "paragraph") tr = tr.setNodeMarkup(pos, schema.nodes.paragraph, keep);
        else if (kind === "code") tr = tr.setNodeMarkup(pos, schema.nodes.code_block, null).removeMark(pos, pos + node.nodeSize, undefined);
        else if (/^h[1-6]$/.test(kind)) tr = tr.setNodeMarkup(pos, schema.nodes.heading, { ...keep, level: +kind[1] });
        changed = true;
        return false;
      });
      if (changed && dispatch) dispatch(tr);
      return changed;
    };
  }

  setBlock(kind: string): void {
    this.blockCmd(kind)(this.view.state, this.view.dispatch);
    this.view.focus();
  }

  listCmd(kind: "bullet" | "ordered"): Command {
    const type: NodeType = kind === "bullet" ? schema.nodes.bullet_list : schema.nodes.ordered_list;
    return (state, dispatch) => {
      const cur = this.query().list;
      if (cur === kind) return liftListItem(schema.nodes.list_item)(state, dispatch);
      if (cur) {
        // troca o tipo da lista em que o cursor está
        const { $from } = state.selection;
        for (let d = $from.depth; d > 0; d--) {
          const n = $from.node(d);
          if (n.type.name === "bullet_list" || n.type.name === "ordered_list") {
            if (dispatch) dispatch(state.tr.setNodeMarkup($from.before(d), type, type === schema.nodes.ordered_list ? { order: 1 } : null));
            return true;
          }
        }
      }
      return wrapInList(type)(state, dispatch);
    };
  }

  list(kind: "bullet" | "ordered"): void {
    this.listCmd(kind)(this.view.state, this.view.dispatch);
    this.view.focus();
  }

  // ---------- inserir ----------

  insertImage(src: string, width: number | null = null, height: number | null = null, alt: string | null = null): void {
    const node = schema.nodes.image.create({ src, alt, width, height });
    this.view.dispatch(this.view.state.tr.replaceSelectionWith(node).scrollIntoView());
    this.view.focus();
  }

  insertTable(rows: number, cols: number): void {
    const cell = () => schema.nodes.table_cell.createAndFill()!;
    const trs = Array.from({ length: rows }, () => schema.nodes.table_row.create(null, Array.from({ length: cols }, cell)));
    const table = schema.nodes.table.create(null, trs);
    const before = this.view.state.selection.from;
    let tr = this.view.state.tr.replaceSelectionWith(table);
    // cursor na primeira célula da tabela recém-criada (a primeira tabela a partir de onde estava o cursor)
    let tablePos = -1;
    tr.doc.descendants((n, p) => {
      if (tablePos >= 0) return false;
      if (n.type.name === "table" && p + n.nodeSize > before) {
        tablePos = p;
        return false;
      }
      return true;
    });
    if (tablePos >= 0) {
      try {
        tr = tr.setSelection(TextSelection.near(tr.doc.resolve(tablePos + 4), 1));
      } catch {
        /* mantém a seleção */
      }
    }
    this.view.dispatch(tr.scrollIntoView());
    this.view.focus();
  }

  insertPageBreak(): void {
    this.view.dispatch(this.view.state.tr.replaceSelectionWith(schema.nodes.page_break.create()).scrollIntoView());
    this.view.focus();
  }

  insertRule(): void {
    this.view.dispatch(this.view.state.tr.replaceSelectionWith(schema.nodes.horizontal_rule.create()).scrollIntoView());
    this.view.focus();
  }

  /**
   * Leva o cursor para o ponto clicado — o clique direito abre o menu do app ALI, como o menu
   * nativo fazia (sem isto, o menu abriria longe do que se clicou). Devolve `true` quando o ponto
   * caiu dentro de uma tabela: é o sinal que faz o menu mostrar "Excluir tabela".
   */
  cursorNoPonto(x: number, y: number): boolean {
    const achado = this.view.posAtCoords({ left: x, top: y });
    if (achado) {
      const { state } = this.view;
      const pos = Math.max(0, Math.min(achado.pos, state.doc.content.size));
      try {
        this.view.dispatch(state.tr.setSelection(TextSelection.near(state.doc.resolve(pos))));
      } catch {
        /* posição no limite do documento: fica a seleção que estava */
      }
    }
    this.view.focus();
    return isInTable(this.view.state);
  }

  /** Aplica (ou tira, com `null`) um link no texto selecionado. */
  setLink(href: string | null): void {
    this.setMark("link", href ? { href } : null);
  }

  table(action: "addRowBefore" | "addRowAfter" | "deleteRow" | "addColumnBefore" | "addColumnAfter" | "deleteColumn" | "merge" | "split" | "delete" | "shade", value?: string | null): void {
    const cmds: Record<string, Command> = {
      addRowBefore,
      addRowAfter,
      deleteRow,
      addColumnBefore,
      addColumnAfter,
      deleteColumn,
      merge: mergeCells,
      split: splitCell,
      delete: deleteTable,
      shade: setCellAttr("background", value ?? null),
    };
    cmds[action](this.view.state, this.view.dispatch);
    this.view.focus();
  }

  undo(): void {
    undo(this.view.state, this.view.dispatch);
    this.view.focus();
  }

  redo(): void {
    redo(this.view.state, this.view.dispatch);
    this.view.focus();
  }

  /** Rola até uma posição do documento (usado pela Estrutura e pela busca). */
  scrollToPos(pos: number): void {
    const p = Math.max(0, Math.min(pos, this.view.state.doc.content.size));
    this.view.dispatch(this.view.state.tr.setSelection(TextSelection.near(this.view.state.doc.resolve(p))).scrollIntoView());
    this.view.focus();
  }

  /** Insere texto puro no cursor (usado por Colar na fita). */
  insertPlainText(text: string): void {
    this.view.dispatch(this.view.state.tr.insertText(text).scrollIntoView());
    this.view.focus();
  }

  /** Substitui um trecho (usado pelas sugestões do corretor). */
  replaceText(from: number, to: number, text: string): void {
    const { state } = this.view;
    this.view.dispatch(state.tr.replaceWith(from, to, text ? Fragment.from(schema.text(text, state.doc.resolve(from).marks())) : Fragment.empty));
    this.view.focus();
  }
}
