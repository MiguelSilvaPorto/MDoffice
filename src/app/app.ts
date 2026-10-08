// mdCreator — o app: guarda o estado (abas, editor, painéis) e liga as peças.
// O trabalho de cada assunto está nos arquivos ao lado (tabs, documents, wordDocs, assistant…).
import { loadLanguageModel } from "../broker/ghost/model";
import { MdEditor, type CursorPos } from "../md/editor";
import { Preview } from "../md/preview";
import * as files from "../files";
import { setTone } from "../broker/writing";
import { warmUpSpell, onSpellReady, type WritingIssue } from "../broker/writing";
import { type ReviewHandle } from "../broker/review";
import { TabBar, newTab, tabLabel, type DocTab } from "../tabs";
import { Sidebar } from "../sidebar";
import { OutlinePanel } from "../outline";
import { Translation } from "../translate/controller";
import { WordHost } from "../word/host";
import { loadSettings, type AppSettings } from "../settings";
import { revealItemInDir } from "@tauri-apps/plugin-opener";
import { $, toast, debounce, copyText, loadJSON, toBase64Utf8 } from "../util";
import { type Recent, type LinkedFolder } from "./types";
import { tabsMethods } from "./tabs";
import { pagesMethods } from "./pages";
import { homeContextMethods } from "./homeContext";
import { documentsMethods } from "./documents";
import { wordDocsMethods } from "./wordDocs";
import { assistantMethods } from "./assistant";
import { dictionaryMethods } from "./dictionary";
import { mdToolsMethods } from "./mdTools";
import { historySearchMethods } from "./historySearch";
import { mediaMethods } from "./media";
import { drawingMethods } from "./drawing";
import { aiContextMethods } from "./aiContext";
import { menusMethods } from "./menus";
import { toolbarMethods } from "./toolbar";
import { windowControlsMethods } from "./windowControls";
import { commandsMethods } from "./commands";
import { keysMethods } from "./keys";
import { layoutMethods } from "./layout";
import { deepReviewMethods } from "./deepReview";

export class App {
  editor!: MdEditor;
  preview!: Preview;
  settings: AppSettings = loadSettings();
  tabBar!: TabBar;
  /** Aba de Configurações (fica fora de this.tabs, que só tem documentos). */
  settingsTab: DocTab | null = null;
  showingSettings = false;
  showingHome = false;
  sidebar!: Sidebar;
  outline!: OutlinePanel;
  wordHost!: WordHost;
  docxNotice = false;
  translation!: Translation;
  /** Todas as abas abertas (na ordem da fileira) e a que está ativa. */
  tabs: DocTab[] = [];
  tab!: DocTab;
  closedTabs: string[] = [];
  switching = false;
  recents: Recent[] = [];
  linkedFolders: LinkedFolder[] = [];
  ignoreWords = new Set<string>(loadJSON<string[]>("mdc.ignore-words", []));

  // O documento "atual" é o da aba ativa: estes atalhos evitam repetir `this.tab.` por todo lado.
  get path(): string | null {
    return this.tab.path;
  }
  set path(v: string | null) {
    this.tab.path = v;
  }
  get dirty(): boolean {
    return this.tab.dirty;
  }
  set dirty(v: boolean) {
    this.tab.dirty = v;
  }
  get statusSaved(): string {
    return this.tab.statusSaved;
  }
  set statusSaved(v: string) {
    this.tab.statusSaved = v;
  }
  get title(): string | null {
    return this.tab.title;
  }
  set title(v: string | null) {
    this.tab.title = v;
  }
  get isDraft(): boolean {
    return this.tab.isDraft;
  }
  set isDraft(v: boolean) {
    this.tab.isDraft = v;
  }
  /** Palavras ignoradas só neste documento (voltam nos outros). */
  get ignoredHere(): Set<string> {
    return this.tab.ignoredHere;
  }
  get issues(): WritingIssue[] {
    return this.tab.issues;
  }
  set issues(v: WritingIssue[]) {
    this.tab.issues = v;
  }
  get autoFixArmed(): boolean {
    return this.tab.autoFixArmed;
  }
  set autoFixArmed(v: boolean) {
    this.tab.autoFixArmed = v;
  }
  /** Correção automática de estilo ligada (ponto, vírgulas, maiúsculas…). */
  autoFix = loadJSON<boolean>("mdc.autofix", true);
  /** Sugestões inline e previsão de palavras (estilo Copilot) ligadas. */
  copilot = loadJSON<boolean>("mdc.copilot", true);
  reviewHandle: ReviewHandle | null = null;
  /** Revisão inteligente (palavras repetidas): tela aberta, análise em andamento e a última guardada. */
  deepHandle: { close(): void } | null = null;
  deepRunning = false;
  deepDirty = false;
  deepLastAccepted = 0;
  deepCache: { key: string; result: import("../broker/deep/analyze").DeepResult } | null = null;
  get cursor(): CursorPos {
    return this.tab.cursor;
  }
  set cursor(v: CursorPos) {
    this.tab.cursor = v;
  }

  async start(): Promise<void> {
    void loadLanguageModel(); // modelo de idioma da sugestão de palavras (arquivo local)
    this.preview = new Preview($("#preview"), {
      onOpenLocalDoc: (p) => void this.openPath(p),
      onSaveDrawing: async (rel, png, json) => {
        if (!this.path) throw new Error("Salve o documento antes de editar desenhos.");
        await files.updateAsset(this.path, rel, png);
        await files.updateAsset(this.path, `${rel}.draw.json`, toBase64Utf8(json));
        this.setPreviewPath(this.path);
        this.preview.invalidateAsset(rel);
        toast("Desenho atualizado no documento.", "ok");
      },
      onRemoveDrawing: async (rel) => {
        this.removeDrawingReference(rel);
      },
      onSaveTextBlock: (oldText, newText) => this.replaceTextBlock(oldText, newText),
      onRemoveTextBlock: (oldText) => {
        this.removeTextBlock(oldText);
      },
      onEditMermaid: (code) => this.editDiagram(code),
      onToggleTask: (index) => this.toggleTask(index),
    });
    this.editor = new MdEditor(
      $("#editor"),
      () => this.onDocChange(),
      (pos) => {
        this.cursor = pos;
        this.outline?.setCursorLine(pos.line);
        $("#st-cursor").textContent = `Ln ${pos.line}, Col ${pos.col}`;
      },
      this.copilot
    );
    this.translation = new Translation({
      polishPt: (t) => this.polishForTranslation(t),
      getMarkdown: () => this.editor.getText(),
    });
    this.tab = newTab(this.editor.getState());
    this.tabs = [this.tab];
    this.tabBar = new TabBar($("#tabbar"), {
      onSelect: (id) => this.selectTab(id),
      onClose: (id) => void this.closeTab(id),
      onNew: () => void this.newDoc(),
      onNewMenu: (anchor) => this.openNewMenu(anchor),
      onRename: (id, value) => void this.renameTab(id, value),
      onReorder: (ids) => this.reorderTabs(ids),
      onContext: (id, x, y) => this.openTabMenu(id, x, y),
      onRecents: (anchor) => void this.openRecentsMenu(anchor),
    });

    this.recents = loadJSON<Recent[]>("mdc.recents", []);
    this.linkedFolders = loadJSON<LinkedFolder[]>("mdc.linked-folders", []);
    this.sidebar = new Sidebar({
      openPath: (p) => void this.openPath(p),
      activateTab: (id) => void this.switchTo(id),
      openDocs: () =>
        this.tabs.map((t) => ({ id: t.id, path: t.path, label: tabLabel(t), dirty: t.dirty, active: t === this.tab })),
      recents: () => this.recents.map((r) => r.path),
      pickFolders: () => files.pickFolders(),
      defaultDir: () => files.defaultDocsDir(),
      newDocIn: (dir) => void this.newDocIn(dir),
      reveal: (p) => void revealItemInDir(p).catch(() => {}),
      outlineFilter: (q) => this.outline?.setFilter(q),
      searchContent: (q, roots) => this.searchContent(q, roots),
      openAt: (p, line) => void this.openAt(p, line),
      contextMenu: (x, y, items) => this.openMenuAt(x, y, items),
      onHome: () => this.toggleHome(),
    });
    this.outline = new OutlinePanel($("#outline"), {
      getText: () => (this.tab.kind === "word" ? this.wordHost.outline().text : this.editor.getText()),
      goto: (line) => (this.tab.kind === "word" ? this.wordHost.gotoLine(line) : this.editor.gotoLine(line)),
      edit: (from, to, insert) => {
        if (this.tab.kind === "word") toast("Reorganizar seções ainda não funciona em documentos Word.", "info", 3200);
        else this.editor.replaceRange(from, to, insert);
      },
      copy: (text) => void copyText(text).then((ok) => toast(ok ? "Texto da seção copiado." : "Não foi possível copiar.", ok ? "ok" : "err", 2200)),
      notify: (msg) => toast(msg, "info", 3000),
      openMenu: (x, y, items) => this.openMenuAt(x, y, items),
    });
    this.outline.useCollapsed(this.tab.outlineCollapsed);
    this.wordHost = new WordHost({
      pane: $("#word-pane"),
      getIgnore: () => new Set([...this.ignoreWords, ...this.tab.ignoredHere]),
      ignoreHere: (w) => {
        this.tab.ignoredHere.add(w.toLowerCase());
        this.wordHost.recheckSpelling();
        toast(`“${w}” ignorada neste texto.`, "info", 2600);
      },
      addToDictionary: (w) => this.ignoreWord(w),
      spellEnabled: () => true,
      ghostEnabled: () => this.copilot,
      onChange: () => this.onWordChange(),
      onStatus: () => this.wordStatus(),
      onFind: () => this.sidebar.focusSearch(),
      onReplace: () => {
        toast("Use a busca lateral ou atalhos para substituir em lote.", "info", 2600);
        this.sidebar.focusSearch();
      },
      onReview: () => this.openReview(),
      onAddons: () => toast("Painel de Suplementos do mdOffice.", "info", 2400),
    });
    $("#ol-collapse").addEventListener("click", () => this.outline.collapseAll(true));
    $("#ol-expand").addEventListener("click", () => this.outline.collapseAll(false));
    $("#ctx-add").addEventListener("click", () => void this.chooseFolders());
    if (loadJSON<boolean>("mdc.no-sidebar", false)) document.body.classList.add("no-sidebar");
    if (loadJSON<boolean>("mdc.no-preview", false)) document.body.classList.add("no-preview");

    this.renderLinkedFolders();
    this.renderOutline();
    this.applyTheme(this.initialDark(), false);
    this.setupToolbar();
    this.setupWindowControls();
    this.setupSplitter();
    this.setupKeys();
    this.setupEditorInteractions();
    this.editor.onScroll(() => this.syncPreviewScroll());
    this.editor.view.contentDOM.addEventListener("paste", (e) => void this.onPaste(e as ClipboardEvent));
    this.editor.onIssuesChanged = () => this.checkWritingSoon();
    this.editor.onIgnoreWord = (word) => this.ignoreWord(word);
    this.editor.onIgnoreHere = (word) => {
      this.ignoredHere.add(word.toLowerCase());
      toast(`“${word}” ignorada neste texto (nos outros documentos ela continua sendo verificada).`, "info", 3600);
      void this.runWritingCheck();
    };
    document.querySelector("#st-writing")?.addEventListener("click", () => this.openReview());
    document.querySelector("#st-deep")?.addEventListener("click", () => this.openDeepReview());
    this.startDeepWatcher();
    setTone(this.settings.tone);
    $("#st-history").addEventListener("click", () => void this.openHistory());
    $("#st-path").addEventListener("click", () => {
      if (this.path) void revealItemInDir(this.path).catch(() => {});
    });
    window.addEventListener("blur", () => void this.autosave());
    window.addEventListener("beforeunload", () => void this.autosave());
    await this.setupDragDrop();

    this.refreshTitle();
    this.refreshPath();
    this.setSaveState();
    this.updateStats();
    void this.sidebar.init();
    void this.preview.render("");
    this.editor.focus();
    void this.restoreSession();
    // carrega o dicionário em segundo plano (worker) e revisa quando ficar pronto
    window.setTimeout(() => warmUpSpell(), 2000);
    onSpellReady(() => {
      this.checkWritingSoon();
      this.wordHost.recheckSpelling();
    });
  }

  checkWritingSoon = debounce(() => void this.runWritingCheck(), 900);

  autoFixSoon = debounce(() => this.runAutoFix(), 700);

  // Alguns segundos depois de você parar de digitar, as correções "de fim de frase"
  // (ponto final, vírgulas) são aplicadas sozinhas — o cursor fica ANTES do ponto, então
  // se você continuar escrevendo o texto entra no lugar certo.
  idleFixSoon = debounce(() => this.runIdleFix(), 3500);

  /** Dicionário pessoal: palavras (nomes, termos técnicos…) que não devem ser marcadas. */

  updatePreview = debounce(() => {
    void this.preview.render(this.editor.getText());
    this.translationDocChanged();
  }, 180);
  statsSoon = debounce(() => this.updateStats(), 260);
  outlineSoon = debounce(() => this.renderOutline(), 400);
  autosaveSoon = debounce(() => void this.autosave(), 2000);

}

// Os métodos ficam em arquivos próprios (um por assunto) e são colados na classe aqui.
type TabsMethodsType = typeof tabsMethods;
type PagesMethodsType = typeof pagesMethods;
type HomeContextMethodsType = typeof homeContextMethods;
type DocumentsMethodsType = typeof documentsMethods;
type WordDocsMethodsType = typeof wordDocsMethods;
type AssistantMethodsType = typeof assistantMethods;
type DictionaryMethodsType = typeof dictionaryMethods;
type MdToolsMethodsType = typeof mdToolsMethods;
type HistorySearchMethodsType = typeof historySearchMethods;
type MediaMethodsType = typeof mediaMethods;
type DrawingMethodsType = typeof drawingMethods;
type AiContextMethodsType = typeof aiContextMethods;
type MenusMethodsType = typeof menusMethods;
type ToolbarMethodsType = typeof toolbarMethods;
type WindowControlsMethodsType = typeof windowControlsMethods;
type CommandsMethodsType = typeof commandsMethods;
type KeysMethodsType = typeof keysMethods;
type LayoutMethodsType = typeof layoutMethods;
type DeepReviewMethodsType = typeof deepReviewMethods;
export interface App extends TabsMethodsType, PagesMethodsType, HomeContextMethodsType, DocumentsMethodsType, WordDocsMethodsType, AssistantMethodsType, DictionaryMethodsType, MdToolsMethodsType, HistorySearchMethodsType, MediaMethodsType, DrawingMethodsType, AiContextMethodsType, MenusMethodsType, ToolbarMethodsType, WindowControlsMethodsType, CommandsMethodsType, KeysMethodsType, LayoutMethodsType, DeepReviewMethodsType {}
Object.assign(App.prototype, tabsMethods, pagesMethods, homeContextMethods, documentsMethods, wordDocsMethods, assistantMethods, dictionaryMethods, mdToolsMethods, historySearchMethods, mediaMethods, drawingMethods, aiContextMethods, menusMethods, toolbarMethods, windowControlsMethods, commandsMethods, keysMethods, layoutMethods, deepReviewMethods);
