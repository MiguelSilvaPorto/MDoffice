// mdCreator — integra editor, pré-visualização, desenho, imagens e arquivos.
import { MdEditor, type CursorPos } from "./editor";
import { Preview, welcomeHtml } from "./preview";
import * as files from "./files";
import { createDrawEditor, placeholderDataUrl, type DrawDoc } from "./draw";
import { TEXT_DRAW_PLACEHOLDER } from "./textdraw";
import { openDiagramBuilder } from "./diagram";
import { setTone, type Tone } from "./writing";
import { checkText, checkStyle, stats as writingStats, warmUpSpell, onSpellReady, spellIsReady, spellHasFailed, type WritingIssue } from "./writing";
import { openReviewModal, type ReviewHandle } from "./review";
import { TabBar, newTab, tabLabel, type DocTab } from "./tabs";
import { Sidebar } from "./sidebar";
import { OutlinePanel } from "./outline";
import { Translation } from "./translation";
import { openExportDialog, type ExportFormat } from "./export";
import { openPalette, type PaletteItem } from "./palette";
import { snapshot, moveHistory, listVersions, clearHistory } from "./history";
import { openHistoryDialog } from "./historyUi";
import { loadSettings, type AppSettings } from "./settings";
import { openPresentation } from "./slides";
import { renderSettingsPage, type SettingsSection } from "./settingsPage";
import { getCurrentWebview } from "@tauri-apps/api/webview";
import { getCurrentWindow } from "@tauri-apps/api/window";

import { revealItemInDir } from "@tauri-apps/plugin-opener";
import mdCss from "./markdown.css?raw";
import "./styles.css";
import {
  $,
  $$,
  h,
  toast,
  debounce,
  baseName,
  docDirOf,
  joinPath,
  stripExt,
  isImagePath,
  isMarkdownPath,
  blobToBase64,
  copyText,
  loadJSON,
  saveJSON,
  fmtTime,
  clamp,
  slugify,
  toBase64Utf8,
} from "./util";

const TABLE_SNIPPET = ["", "| Coluna A | Coluna B |", "| --- | --- |", "| $0 |  |", ""].join("\n");

const MERMAID_SNIPPET = [
  "",
  "```mermaid",
  "flowchart TD",
  "  A[Início] --> B{Decisão}",
  "  B -->|Sim| C[Ação]",
  "  B -->|Não| D[Fim]",
  "```",
  "",
  "$0",
].join("\n");

const AI_TEMPLATE = [
  "",
  "# Título do pedido",
  "",
  "## Objetivo",
  "Escreva em uma frase o resultado esperado.",
  "",
  "## Contexto",
  "- Ambiente / stack: ",
  "- Restrições: ",
  "",
  "## Requisitos",
  "- [ ] $0",
  "- [ ] ",
  "",
  "## Exemplos / referências",
  "",
  "## Formato da resposta",
  "- Passo a passo numerado, com código comentado e exemplos.",
  "",
].join("\n");

interface Recent {
  path: string;
  at: number;
}

interface LinkedFolder {
  path: string;
  name: string;
}

class App {
  private editor!: MdEditor;
  private preview!: Preview;
  private settings: AppSettings = loadSettings();
  private tabBar!: TabBar;
  /** Aba de Configurações (fica fora de this.tabs, que só tem documentos). */
  private settingsTab: DocTab | null = null;
  private showingSettings = false;
  private sidebar!: Sidebar;
  private outline!: OutlinePanel;
  private translation!: Translation;
  /** Todas as abas abertas (na ordem da fileira) e a que está ativa. */
  private tabs: DocTab[] = [];
  private tab!: DocTab;
  private closedTabs: string[] = [];
  private switching = false;
  private recents: Recent[] = [];
  private linkedFolders: LinkedFolder[] = [];
  private ignoreWords = new Set<string>(loadJSON<string[]>("mdc.ignore-words", []));

  // O documento "atual" é o da aba ativa: estes atalhos evitam repetir `this.tab.` por todo lado.
  private get path(): string | null {
    return this.tab.path;
  }
  private set path(v: string | null) {
    this.tab.path = v;
  }
  private get dirty(): boolean {
    return this.tab.dirty;
  }
  private set dirty(v: boolean) {
    this.tab.dirty = v;
  }
  private get statusSaved(): string {
    return this.tab.statusSaved;
  }
  private set statusSaved(v: string) {
    this.tab.statusSaved = v;
  }
  private get title(): string | null {
    return this.tab.title;
  }
  private set title(v: string | null) {
    this.tab.title = v;
  }
  private get isDraft(): boolean {
    return this.tab.isDraft;
  }
  private set isDraft(v: boolean) {
    this.tab.isDraft = v;
  }
  /** Palavras ignoradas só neste documento (voltam nos outros). */
  private get ignoredHere(): Set<string> {
    return this.tab.ignoredHere;
  }
  private get issues(): WritingIssue[] {
    return this.tab.issues;
  }
  private set issues(v: WritingIssue[]) {
    this.tab.issues = v;
  }
  private get autoFixArmed(): boolean {
    return this.tab.autoFixArmed;
  }
  private set autoFixArmed(v: boolean) {
    this.tab.autoFixArmed = v;
  }
  /** Correção automática de estilo ligada (ponto, vírgulas, maiúsculas…). */
  private autoFix = loadJSON<boolean>("mdc.autofix", true);
  /** Sugestões inline e previsão de palavras (estilo Copilot) ligadas. */
  private copilot = loadJSON<boolean>("mdc.copilot", true);
  private reviewHandle: ReviewHandle | null = null;
  private get cursor(): CursorPos {
    return this.tab.cursor;
  }
  private set cursor(v: CursorPos) {
    this.tab.cursor = v;
  }

  async start(): Promise<void> {
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
    });
    this.outline = new OutlinePanel($("#outline"), {
      getText: () => this.editor.getText(),
      goto: (line) => this.editor.gotoLine(line),
      edit: (from, to, insert) => this.editor.replaceRange(from, to, insert),
      copy: (text) => void copyText(text).then((ok) => toast(ok ? "Texto da seção copiado." : "Não foi possível copiar.", ok ? "ok" : "err", 2200)),
      notify: (msg) => toast(msg, "info", 3000),
      openMenu: (x, y, items) => this.openMenuAt(x, y, items),
    });
    this.outline.useCollapsed(this.tab.outlineCollapsed);
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
    onSpellReady(() => this.checkWritingSoon());
  }

  /** Reabre as abas da sessão anterior; sem sessão, cai no rascunho mais recente. */
  private async restoreSession(): Promise<void> {
    const saved = loadJSON<{ paths: string[]; active: string | null; drafts: string[] } | null>("mdc.session", null);
    let restored = 0;
    if (saved && Array.isArray(saved.paths)) {
      let activateTab: DocTab | null = null;
      for (const p of saved.paths) {
        try {
          const content = await files.loadDoc(p);
          const tab = this.addTabFor(p, content, saved.drafts?.includes(p) ?? false);
          restored++;
          if (p === saved.active) activateTab = tab;
        } catch {
          /* arquivo sumiu: ignora */
        }
      }
      if (restored) {
        // se o usuário já começou a digitar na aba inicial, ela continua existindo
        this.dropPristineStartTab();
        await this.activate(activateTab ?? this.tabs[this.tabs.length - 1]);
        toast(`${restored} aba${restored === 1 ? "" : "s"} da sessão anterior reaberta${restored === 1 ? "" : "s"}.`, "info", 3600);
        return;
      }
    }
    await this.restoreLegacyDraft();
  }

  /** Antes das abas, o app guardava só o último rascunho; ainda recuperamos ele. */
  private async restoreLegacyDraft(): Promise<void> {
    try {
      const drafts = await files.listDrafts();
      const latest = drafts[0];
      if (!latest || this.dirty || this.path) return;
      const content = await files.loadDoc(latest.path);
      if (!content.trim()) return;
      this.path = latest.path;
      this.isDraft = true;
      this.autoFixArmed = false;
      this.editor.setText(content);
      this.tab.state = this.editor.getState();
      this.dirty = false;
      this.statusSaved = "Rascunho guardado no app";
      this.setPreviewPath(latest.path);
      this.afterTabChange();
      await this.preview.render(content);
      toast(
        `Rascunho da sessão anterior restaurado (${baseName(latest.path)}). Use "Salvar como" para guardar numa pasta sua.`,
        "info",
        7500
      );
    } catch {
      /* sem rascunhos do app */
    }
    // Navegador (dev) ou sem rascunho do app: recupera o temp/rascunho.md do projeto.
    if (this.dirty || this.path) return;
    try {
      const texto = await files.loadDraftFallback();
      if (!texto || !texto.trim()) return;
      this.autoFixArmed = false;
      this.editor.setText(texto);
      this.tab.state = this.editor.getState();
      this.dirty = false;
      this.statusSaved = "Salvo automaticamente em temp/";
      this.afterTabChange();
      await this.preview.render(texto);
      toast("Texto recuperado do salvamento automático (temp/rascunho.md).", "info", 6500);
    } catch {
      /* sem salvamento automático */
    }
  }

  // ---------- abas ----------

  /** Cria uma aba (sem ativá-la) para um arquivo já lido. */
  private addTabFor(path: string | null, content: string, isDraft = false): DocTab {
    const tab = newTab(this.editor.createState(content), {
      path,
      isDraft,
      statusSaved: isDraft ? "Rascunho guardado no app" : `Aberto às ${fmtTime()}`,
    });
    this.tabs.push(tab);
    return tab;
  }

  /** A aba inicial vazia some quando outras abas assumem o lugar dela. */
  private dropPristineStartTab(): void {
    const first = this.tabs[0];
    if (!first || this.tabs.length < 2 || first !== this.tab) return;
    if (first.path || first.dirty || this.textOf(first).length > 0) return;
    this.tabs = this.tabs.filter((t) => t !== first);
    this.tab = this.tabs[0];
  }

  private textOf(tab: DocTab): string {
    return tab === this.tab ? this.editor.getText() : tab.state.doc.toString();
  }

  /** Guarda o estado da aba ativa (texto/undo/rolagem) antes de sair dela. */
  private snapshotTab(): void {
    this.tab.state = this.editor.getState();
    this.tab.scrollTop = this.editor.scrollTop();
  }

  /** Torna a aba indicada a ativa e redesenha tudo que depende do documento. */
  private async activate(target: DocTab): Promise<void> {
    if (target !== this.tab) {
      this.snapshotTab();
      this.tab = target;
    }
    this.editor.loadState(target.state, target.scrollTop);
    this.outline?.useCollapsed(target.outlineCollapsed);
    this.outline?.setCursorLine(target.cursor.line);
    this.setPreviewPath(target.path);
    this.afterTabChange();
    this.editor.setIssues(target.issues);
    this.updateWritingBadge();
    this.checkWritingSoon();
    this.translationDocChanged(true);
    await this.preview.render(this.editor.getText());
    this.editor.focus();
  }

  /** Atualiza título, barra de abas, rodapé, contagens e estrutura. */
  private afterTabChange(): void {
    this.refreshTitle();
    this.refreshPath();
    this.setSaveState();
    this.updateStats();
    this.renderOutline();
    this.saveSession();
    this.sidebar?.render();
  }

  private saveSession(): void {
    const withPath = this.tabs.filter((t) => t.path);
    saveJSON("mdc.session", {
      paths: withPath.map((t) => t.path!),
      drafts: withPath.filter((t) => t.isDraft).map((t) => t.path!),
      active: this.tab.path,
    });
  }

  /** Desenha a fileira de abas (documentos + Configurações, se aberta). */
  private renderTabs(): void {
    if (!this.tabBar) return;
    const list = this.settingsTab ? [...this.tabs, this.settingsTab] : this.tabs;
    this.tabBar.render(list, this.showingSettings && this.settingsTab ? this.settingsTab.id : this.tab.id);
  }

  private activeTabId(): string {
    return this.showingSettings && this.settingsTab ? this.settingsTab.id : this.tab.id;
  }

  private selectTab(id: string): void {
    if (this.settingsTab && id === this.settingsTab.id) {
      this.showSettings();
      return;
    }
    void this.switchTo(id);
  }

  /** Abre a aba de Configurações (uma só): mostra a página no lugar do editor. */
  private showSettings(section: SettingsSection = "escrita"): void {
    if (!this.settingsTab) this.settingsTab = newTab(this.tab.state, { kind: "settings" });
    this.showingSettings = true;
    document.body.classList.add("settings-open");
    this.closeMenus();
    renderSettingsPage($("#settings-page"), this.settingsContext(), section);
    $("#settings-page").hidden = false;
    this.renderTabs();
  }

  private hideSettings(): void {
    if (!this.showingSettings) return;
    this.showingSettings = false;
    document.body.classList.remove("settings-open");
    $("#settings-page").hidden = true;
    this.renderTabs();
  }

  private closeSettings(): void {
    this.hideSettings();
    this.settingsTab = null;
    this.renderTabs();
    this.editor.focus();
  }

  private settingsContext(): import("./settingsPage").SettingsCtx {
    return {
      settings: () => this.settings,
      patch: (p) => {
        this.settings = { ...this.settings, ...p };
        saveJSON("mdc.settings", this.settings);
        if (p.tone) {
          setTone(p.tone);
          void this.runWritingCheck();
          this.translationDocChanged(true);
        }
      },
      translation: this.translation,
      autoFix: () => this.autoFix,
      setAutoFix: (on) => this.setAutoFix(on),
      copilot: () => this.copilot,
      setCopilot: (on) => this.setCopilot(on),
      dictionaryCount: () => this.ignoreWords.size,
      openDictionary: () => this.showDictionary(),
      dark: () => document.documentElement.dataset.theme === "dark",
      setDark: (dark) => this.applyTheme(dark),
      flag: (cls) => document.body.classList.contains(cls),
      toggleFlag: (cls) => this.toggle(cls),
      drawStyle: () => (loadJSON<string>("mdc.drawstyle", "image") === "text" ? "text" : "image"),
      setDrawStyle: (style) => this.setDrawStyle(style),
      historyCount: async () => (this.path ? (await listVersions(this.path)).length : 0),
      clearHistory: async () => {
        if (this.path) await clearHistory(this.path);
        toast("Histórico deste documento apagado.", "info", 2400);
      },
      openHistory: () => void this.openHistory(),
    };
  }

  private async switchTo(id: string): Promise<void> {
    this.hideSettings();
    const target = this.tabs.find((t) => t.id === id);
    if (!target || target === this.tab || this.switching) return;
    this.switching = true;
    try {
      await this.autosave(); // grava a aba de onde estamos saindo
      await this.activate(target);
    } finally {
      this.switching = false;
    }
  }

  private async switchRelative(step: number): Promise<void> {
    if (this.tabs.length < 2) return;
    const i = this.tabs.indexOf(this.tab);
    await this.switchTo(this.tabs[(i + step + this.tabs.length) % this.tabs.length].id);
  }

  private reorderTabs(ids: string[]): void {
    const byId = new Map(this.tabs.map((t) => [t.id, t]));
    const next = ids.map((id) => byId.get(id)).filter((t): t is DocTab => !!t);
    if (next.length === this.tabs.length) this.tabs = next;
    this.saveSession();
  }

  /** Fecha a aba. Nada de perguntas: o que não está salvo vira rascunho e fica em "Recentes". */
  private async closeTab(id: string): Promise<void> {
    if (this.settingsTab && id === this.settingsTab.id) {
      this.closeSettings();
      return;
    }
    const tab = this.tabs.find((t) => t.id === id);
    if (!tab || this.switching) return;
    const isCurrent = tab === this.tab;
    if (isCurrent) await this.autosave();
    else if (tab.dirty && tab.path) {
      try {
        await files.saveDoc(tab.path, this.textOf(tab));
        tab.dirty = false;
      } catch {
        /* segue: o rascunho da sessão já tem o texto */
      }
    }
    // rascunho vazio não vale a pena guardar
    if (tab.isDraft && tab.path && !this.textOf(tab).trim()) void files.deleteDraft(tab.path).catch(() => {});
    else if (tab.path) this.closedTabs.push(tab.path);
    const index = this.tabs.indexOf(tab);
    this.tabs = this.tabs.filter((t) => t !== tab);
    if (!this.tabs.length) this.tabs.push(newTab(this.editor.createState("")));
    if (isCurrent) {
      this.switching = true;
      try {
        await this.activate(this.tabs[Math.min(index, this.tabs.length - 1)]);
      } finally {
        this.switching = false;
      }
    } else {
      this.afterTabChange();
    }
  }

  private async reopenClosedTab(): Promise<void> {
    while (this.closedTabs.length) {
      const p = this.closedTabs.pop()!;
      if (this.tabs.some((t) => t.path === p)) continue;
      if (await this.openPath(p)) return;
    }
    toast("Nenhuma aba fechada para reabrir.", "info", 2200);
  }

  private async closeOthers(keep: DocTab, onlyRight = false): Promise<void> {
    const start = this.tabs.indexOf(keep);
    const victims = this.tabs.filter((t, i) => t !== keep && (!onlyRight || i > start));
    if (victims.includes(this.tab)) await this.switchTo(keep.id);
    for (const v of victims) await this.closeTab(v.id);
  }

  private async renameTab(id: string, value: string): Promise<void> {
    const tab = this.tabs.find((t) => t.id === id);
    if (!tab) return;
    if (tab !== this.tab) await this.switchTo(id);
    await this.applyTitle(value);
  }

  /** Menu suspenso solto (botão direito) numa posição da tela. */
  private openMenuAt(x: number, y: number, items: { label: string; hint?: string; run: () => void; sep?: boolean }[]): void {
    this.closeMenus();
    const menu = h("div", { class: "dropdown" });
    for (const it of items) {
      if (it.sep) this.ddSep(menu);
      this.ddItem(menu, { label: it.label, hint: it.hint, onPick: it.run });
    }
    document.body.append(menu);
    menu.style.left = `${Math.max(8, Math.min(x, window.innerWidth - menu.offsetWidth - 8))}px`;
    menu.style.top = `${Math.max(8, Math.min(y, window.innerHeight - menu.offsetHeight - 8))}px`;
    const dismiss = (ev: MouseEvent) => {
      if (!menu.contains(ev.target as Node)) {
        this.closeMenus();
        document.removeEventListener("mousedown", dismiss, true);
      }
    };
    document.addEventListener("mousedown", dismiss, true);
  }

  private openTabMenu(id: string, x: number, y: number): void {
    const tab = this.tabs.find((t) => t.id === id);
    if (!tab) return;
    const items: { label: string; hint?: string; run: () => void; sep?: boolean }[] = [
      { label: "Renomear", hint: "F2", run: () => this.tabBar.beginRename(id) },
      { label: "Duplicar aba", run: () => void this.duplicateTab(tab) },
    ];
    if (tab.path) {
      items.push(
        { label: "Mostrar na pasta", run: () => void revealItemInDir(tab.path!).catch(() => {}) },
        { label: "Copiar caminho", run: () => void copyText(tab.path!) }
      );
    }
    items.push(
      { label: "Fechar", hint: "Ctrl+W", run: () => void this.closeTab(id), sep: true },
      { label: "Fechar as outras", run: () => void this.closeOthers(tab) },
      { label: "Fechar as da direita", run: () => void this.closeOthers(tab, true) }
    );
    this.openMenuAt(x, y, items);
  }

  private async duplicateTab(tab: DocTab): Promise<void> {
    const copy = this.addTabFor(null, this.textOf(tab));
    copy.title = `${tabLabel(tab)} (cópia)`;
    copy.dirty = true;
    await this.switchTo(copy.id);
  }

  /** Menu "Recentes": arquivos recentes que não estão abertos e rascunhos guardados no app. */
  /** Menu do "+" das abas: escolher o tipo de arquivo novo (documento, planilha ou apresentação). */
  private openNewMenu(anchor: HTMLElement): void {
    const criar = (rotulo: string, texto: string) => {
      this.closeMenus();
      const tab = newTab(this.editor.createState(texto), { path: null, isDraft: false, statusSaved: "Novo arquivo" });
      this.tabs.push(tab);
      this.selectTab(tab.id);
      toast(`${rotulo} criada — use Ctrl+Shift+S para salvar numa pasta sua.`, "ok", 3800);
    };
    const modeloPlanilha = [
      "# Planilha",
      "",
      "| Item | Valor | Quantidade | Total |",
      "| --- | ---: | ---: | ---: |",
      "| Exemplo | 10,00 | 2 | 20,00 |",
      "|  |  |  |  |",
      "",
      "> Dica: as colunas com `---:` ficam alinhadas à direita, como número de planilha.",
    ].join("\n");
    const modeloDeck = [
      "# Apresentação",
      "",
      "## Subtítulo da capa",
      "",
      "Seu nome · data",
      "",
      "---",
      "",
      "## Slide 2",
      "",
      "- Primeiro ponto",
      "- Segundo ponto",
      "",
      "---",
      "",
      "## Slide 3",
      "",
      "Fim — aperte F5 para apresentar.",
    ].join("\n");
    this.openMenu(anchor, (menu) => {
      menu.classList.add("recents-menu");
      this.ddItem(menu, { icon: "i-doc", label: "Documento", hint: "md / Word", onPick: () => void this.newDoc() });
      this.ddItem(menu, { icon: "i-grid", label: "Planilha", hint: "Excel (tabela)", onPick: () => criar("Planilha", modeloPlanilha) });
      this.ddItem(menu, { icon: "i-eye", label: "Apresentação", hint: "PowerPoint (slides, F5)", onPick: () => criar("Apresentação", modeloDeck) });
    });
  }

  private async openRecentsMenu(anchor: HTMLElement): Promise<void> {
    const open = new Set(this.tabs.map((t) => (t.path ?? "").toLowerCase()));
    let drafts: files.DraftInfo[] = [];
    try {
      drafts = (await files.listDrafts()).filter((d) => !open.has(d.path.toLowerCase())).slice(0, 6);
    } catch {
      /* sem rascunhos (navegador) */
    }
    this.openMenu(anchor, (menu) => {
      menu.classList.add("recents-menu");
      const recents = this.recents.filter((r) => !open.has(r.path.toLowerCase()));
      const row = (p: string, forget: (() => void) | null) => {
        const btn = h("button", { class: "dd-item two-line", type: "button", title: p });
        btn.append(h("span", { class: "tl-name", text: stripExt(baseName(p)) }), h("span", { class: "tl-dir", text: docDirOf(p) }));
        btn.addEventListener("click", () => {
          this.closeMenus();
          void this.openPath(p);
        });
        const wrap = h("div", { class: "dd-row" }, [btn]);
        if (forget) {
          const x = h("button", { class: "dd-x", type: "button", title: "Tirar da lista", text: "×" });
          x.addEventListener("click", (e) => {
            e.stopPropagation();
            forget();
            wrap.remove();
          });
          wrap.append(x);
        }
        menu.append(wrap);
      };
      menu.append(h("div", { class: "dd-title", text: "Arquivos recentes" }));
      if (!recents.length) this.ddNote(menu, "Nenhum arquivo recente fora das abas abertas.");
      for (const r of recents) {
        row(r.path, () => {
          this.recents = this.recents.filter((x) => x.path !== r.path);
          saveJSON("mdc.recents", this.recents);
        });
      }
      if (drafts.length) {
        this.ddSep(menu);
        menu.append(h("div", { class: "dd-title", text: "Rascunhos guardados no app" }));
        for (const d of drafts) row(d.path, null);
      }
      this.ddSep(menu);
      this.ddItem(menu, { icon: "i-open", label: "Abrir arquivo…", hint: "Ctrl+O", onPick: () => void this.openDocDialog() });
      if (this.closedTabs.length) {
        this.ddItem(menu, { icon: "i-undo", label: "Reabrir aba fechada", hint: "Ctrl+Shift+T", onPick: () => void this.reopenClosedTab() });
      }
    });
  }

  // ---------- fluxo de documento ----------

  private onDocChange(): void {
    const wasDirty = this.dirty;
    this.dirty = true;
    // a correção automática só age depois que você digita (não mexe em documento aberto)
    this.autoFixArmed = true;
    if (!wasDirty) this.refreshTitle();
    this.setSaveState();
    this.updatePreview();
    this.statsSoon();
    this.outlineSoon();
    this.autosaveSoon();
    this.checkWritingSoon();
    if (this.autoFix) this.autoFixSoon();
    if (this.autoFix) this.idleFixSoon();
    // mantém o desenho de letras aberto em sincronia com o texto do editor
    this.preview.syncTextEditorWith(this.editor.getText());
  }

  // ---------- assistente de escrita ----------

  private checkWritingSoon = debounce(() => void this.runWritingCheck(), 900);

  private autoFixSoon = debounce(() => this.runAutoFix(), 700);

  // Alguns segundos depois de você parar de digitar, as correções "de fim de frase"
  // (ponto final, vírgulas) são aplicadas sozinhas — o cursor fica ANTES do ponto, então
  // se você continuar escrevendo o texto entra no lugar certo.
  private idleFixSoon = debounce(() => this.runIdleFix(), 3500);

  private runIdleFix(): void {
    if (!this.autoFix || !this.autoFixArmed) return;
    const view = this.editor.view;
    const doc = view.state.doc;
    const pos = view.state.selection.main.head;
    const line = doc.lineAt(pos);
    if (line.text.trim() === "") return; // linha vazia: o gatilho do parágrafo cuida
    // parágrafo em que o cursor está (linhas seguidas não vazias)
    let first = line.number;
    while (first > 1 && doc.line(first - 1).text.trim() !== "") first--;
    let last = line.number;
    while (last < doc.lines && doc.line(last + 1).text.trim() !== "") last++;
    const from = doc.line(first).from;
    const to = doc.line(last).to;
    const fresh = checkStyle(doc.toString()).filter((i) => i.fix && i.from >= from && i.to <= to);
    if (!fresh.length) return;
    this.editor.replaceRanges(
      fresh.map((i) => ({ from: i.from, to: i.to, insert: i.fix! })),
      -1
    );
  }

  /** Correção automática: não depende do dicionário, roda logo depois de você pausar. */
  private runAutoFix(): void {
    if (!this.autoFix || !this.autoFixArmed) return;
    let typed = 0;
    let ended = 0;
    // repete algumas vezes porque uma correção pode abrir caminho para outra
    // (ex.: maiúscula no começo e depois “a gente vai” → “Nós vamos”)
    for (let i = 0; i < 3; i++) {
      const t = this.autoFixSafe();
      const e = this.autoFixFinishedParagraph();
      typed += t;
      ended += e;
      if (!t && !e) break;
    }
    if (typed + ended > 0) void this.runWritingCheck();
    if (ended) toast(`Correção automática: ${ended} ajuste${ended === 1 ? "" : "s"}.`, "ok", 2400);
  }

  private async runWritingCheck(): Promise<void> {
    const text = this.editor.getText();
    try {
      this.issues = await checkText(text, new Set([...this.ignoreWords, ...this.ignoredHere]));
    } catch {
      this.issues = [];
    }
    this.editor.setIssues(this.issues);
    this.updateWritingBadge();
    this.reviewHandle?.refresh(this.issues, writingStats(text));
    // com o resultado da ortografia em mãos, a correção automática ganha o que fazer
    if (this.autoFix && this.autoFixArmed) this.autoFixSoon();
  }

  /** Liga/desliga a correção automática (guardada entre sessões). */
  private setAutoFix(on: boolean): void {
    this.autoFix = on;
    saveJSON("mdc.autofix", on);
    toast(
      on
        ? "Correção automática ligada: ponto, vírgulas, maiúsculas e trocas formais entram sozinhos."
        : "Correção automática desligada.",
      "info",
      3400
    );
  }

  /** Liga/desliga sugestões inline estilo Copilot (guardadas entre sessões). */
  private setCopilot(on: boolean): void {
    this.copilot = on;
    saveJSON("mdc.copilot", on);
    this.editor.setGhostTextEnabled(on);
    toast(
      on
        ? "Sugestões inline ligadas (estilo Copilot): use Tab para aceitar ou Alt+Seta para palavra por palavra."
        : "Sugestões inline desativadas.",
      "ok",
      2800
    );
  }


  /** Substituição de um aviso: estilo usa `fix`; ortografia usa `auto` (correção confiável). */
  private replacementFor(issue: WritingIssue): string | undefined {
    return issue.kind === "spell" ? issue.auto : issue.fix;
  }

  /** Aplica as correções disponíveis numa só ação (um único desfazer). */
  private applyFixes(issues: WritingIssue[]): number {
    const aplicaveis = issues.filter((i) => this.replacementFor(i) !== undefined);
    if (!aplicaveis.length) return 0;
    this.editor.replaceRanges(
      aplicaveis.map((i) => ({ from: i.from, to: i.to, insert: this.replacementFor(i)! }))
    );
    return aplicaveis.length;
  }

  /** Primeira coluna do parágrafo que contém a posição. */
  private paragraphStartAt(pos: number): number {
    const doc = this.editor.view.state.doc;
    let line = doc.lineAt(pos);
    while (line.number > 1 && doc.line(line.number - 1).text.trim() !== "") line = doc.line(line.number - 1);
    return line.from;
  }

  /**
   * Corrige sozinho as palavras erradas em que dá para confiar ("responsavo" → "responsável").
   * Nunca mexe na palavra em que o cursor está (ela pode estar pela metade) e confere se o
   * texto naquele ponto continua igual antes de trocar.
   */
  private autoFixWords(from: number, to: number, soDepoisDoCursor = true): number {
    const view = this.editor.view;
    const doc = view.state.doc;
    const pos = view.state.selection.main.head;
    const alvos = this.issues.filter(
      (i) =>
        i.kind === "spell" &&
        i.auto &&
        i.from >= from &&
        i.to <= to &&
        (!soDepoisDoCursor || pos > i.to) &&
        doc.sliceString(i.from, i.to) === i.word
    );
    return this.applyFixes(alvos);
  }

  /** Enquanto se digita: aplica só o que é seguro (maiúsculas, espaços, abreviações) + palavras. */
  private autoFixSafe(): number {
    const view = this.editor.view;
    const doc = view.state.doc;
    const pos = view.state.selection.main.head;
    const line = doc.lineAt(pos);
    // recalcula na hora: as posições antigas podem ter mudado
    const fresh = checkStyle(doc.toString()).filter((i) => i.safe && i.from >= line.from && i.to <= line.to);
    const parFrom = this.paragraphStartAt(pos);
    return this.applyFixes(fresh) + this.autoFixWords(parFrom, pos);
  }

  /**
   * Correção automática de parágrafo: quando o cursor está numa linha vazia e existe uma
   * linha em branco antes (parágrafo concluído), corrige o parágrafo que ficou para trás.
   */
  private autoFixFinishedParagraph(): number {
    const view = this.editor.view;
    const doc = view.state.doc;
    const line = doc.lineAt(view.state.selection.main.head);
    const texto = line.text.trim();
    // Linha vazia (parágrafo terminado) OU já começando um bloco novo (imagem, título,
    // lista, tabela, citação, cerca de código): nos dois casos o parágrafo de cima acabou.
    const vazia = texto === "";
    const bloco = /^(#|!\[|\||```|>|[-*+]\s|\d+\.\s)/.test(texto);
    if (!vazia && !bloco) return 0;
    const ultimaAcima = vazia ? line.number - 2 : line.number - 1;
    if (ultimaAcima < 1) return 0;
    if (vazia && doc.line(ultimaAcima).text.trim() !== "") return 0;
    let first = ultimaAcima;
    while (first > 1 && doc.line(first - 1).text.trim() !== "") first--;
    const from = doc.line(first).from;
    const to = doc.line(ultimaAcima).to;
    const fresh = checkStyle(doc.toString()).filter((i) => i.from >= from && i.to <= to);
    return this.applyFixes(fresh) + this.autoFixWords(from, to);
  }

  private updateWritingBadge(): void {
    const btn = document.querySelector<HTMLButtonElement>("#st-writing");
    if (!btn) return;
    const count = this.issues.length;
    const loading = !spellIsReady() && !spellHasFailed();
    if (!count && !loading) {
      btn.hidden = true;
      return;
    }
    const spell = this.issues.filter((i) => i.kind === "spell").length;
    const parts = [count ? `${count} aviso${count === 1 ? "" : "s"}` : "nenhum aviso"];
    if (spell) parts.push(`${spell} de escrita`);
    btn.hidden = false;
    btn.textContent = `Revisar: ${parts.join(" · ")}${loading ? " · carregando dicionário…" : ""}`;
  }

  private ignoreWord(word: string): void {
    this.ignoreWords.add(word.toLowerCase());
    saveJSON("mdc.ignore-words", Array.from(this.ignoreWords));
    toast(`“${word}” foi adicionada ao dicionário pessoal.`, "ok", 3000);
    void this.runWritingCheck();
  }

  /** Dicionário pessoal: palavras (nomes, termos técnicos…) que não devem ser marcadas. */
  // ---------- histórico de versões, configurações e busca no conteúdo ----------

  /** Guarda uma versão do texto (automática, no máximo uma a cada 5 min — ou sempre, ao salvar). */
  private recordVersion(path: string, text: string, force = false): void {
    if (!this.settings.historyOn) return;
    void snapshot(path, text, { max: this.settings.historyMax, force });
  }

  private async openHistory(): Promise<void> {
    if (!this.path && !(await this.ensureSaved())) return;
    const path = this.path;
    if (!path) return;
    // garante que o estado de agora já esteja no histórico
    await snapshot(path, this.editor.getText(), { max: this.settings.historyMax });
    openHistoryDialog({
      doc: path,
      title: tabLabel(this.tab),
      max: this.settings.historyMax,
      getText: () => this.editor.getText(),
      restore: (text) => this.editor.replaceRange(0, this.editor.getText().length, text),
    });
  }

  private async saveVersionNow(): Promise<void> {
    if (!this.path && !(await this.ensureSaved())) return;
    if (!this.path) return;
    const ok = await snapshot(this.path, this.editor.getText(), { manual: true, max: this.settings.historyMax });
    toast(ok ? "Versão salva no histórico." : "Esse texto já está no histórico.", ok ? "ok" : "info", 2400);
  }

  private setTonePref(tone: Tone): void {
    this.settings = { ...this.settings, tone };
    saveJSON("mdc.settings", this.settings);
    setTone(tone);
    void this.runWritingCheck();
    toast(`Tom do texto: ${tone}.`, "ok", 2200);
  }

  /** Busca no conteúdo: arquivos dos projetos (disco) + o que está nas abas abertas (mesmo sem salvar). */
  private async searchContent(query: string, roots: string[]): Promise<files.ContentHit[]> {
    const fold = (s: string) => Array.from(s, (c) => c.normalize("NFD")[0].toLowerCase()).join("");
    const needle = fold(query.trim());
    if (needle.length < 2) return [];
    const open = new Map<string, files.ContentHit[]>();
    for (const t of this.tabs) {
      if (!t.path) continue;
      const hits: files.ContentHit[] = [];
      this.textOf(t)
        .split("\n")
        .some((line, i) => {
          const pos = fold(line).indexOf(needle);
          if (pos < 0) return false;
          const from = Math.max(0, pos - 50);
          hits.push({
            path: t.path!,
            name: baseName(t.path!),
            line: i + 1,
            text: line.slice(from, pos + needle.length + 90),
            start: pos - from,
            end: pos - from + needle.length,
          });
          return hits.length >= 5;
        });
      open.set(t.path.toLowerCase(), hits);
    }
    let disk: files.ContentHit[] = [];
    if (roots.length) {
      try {
        disk = await files.searchMarkdown(roots, query);
      } catch {
        disk = [];
      }
    }
    const merged = disk.filter((h) => !open.has(h.path.toLowerCase()));
    for (const hits of open.values()) merged.push(...hits);
    return merged.sort((a, b) => a.path.localeCompare(b.path) || a.line - b.line);
  }

  private async openAt(path: string, line: number): Promise<void> {
    if (await this.openPath(path)) window.setTimeout(() => this.editor.gotoLine(line), 80);
  }

  private showDictionary(): void {
    const backdrop = h("div", { class: "modal-backdrop" });
    const modal = h("div", { class: "modal" });
    modal.innerHTML = `
      <header class="wm-head">
        <svg class="ic"><use href="#i-check"/></svg>
        <h2>Dicionário pessoal</h2>
        <button class="btn icon" data-close title="Fechar (Esc)"><svg class="ic"><use href="#i-close"/></svg></button>
      </header>
      <div class="wm-body">
        <p>As palavras desta lista <b>não são mais marcadas</b> como erro — nomes, marcas, termos técnicos…</p>
        <div class="dict-add">
          <input type="text" class="dict-input" placeholder="digite uma palavra (ex.: mdCreator)" />
          <button class="btn primary" data-add>Adicionar</button>
        </div>
        <div class="dict-list"></div>
      </div>`;
    backdrop.append(modal);
    document.body.append(backdrop);

    const input = modal.querySelector<HTMLInputElement>(".dict-input")!;
    const lista = modal.querySelector<HTMLElement>(".dict-list")!;
    const desenhar = () => {
      const palavras = Array.from(this.ignoreWords).sort((a, b) => a.localeCompare(b, "pt-BR"));
      lista.innerHTML = "";
      if (!palavras.length) {
        lista.append(h("p", { class: "muted", text: "Nenhuma palavra adicionada ainda." }));
        return;
      }
      for (const w of palavras) {
        const linha = h("div", { class: "dict-row" });
        linha.append(h("span", { text: w }));
        const b = h("button", { class: "btn icon", type: "button", title: "Remover do dicionário" });
        b.textContent = "×";
        b.addEventListener("click", () => {
          this.ignoreWords.delete(w);
          saveJSON("mdc.ignore-words", Array.from(this.ignoreWords));
          desenhar();
          void this.runWritingCheck();
          toast(`“${w}” voltou a ser verificada.`, "info", 2600);
        });
        linha.append(b);
        lista.append(linha);
      }
    };
    const adicionar = () => {
      const valor = input.value.trim().toLowerCase();
      if (!valor) return;
      this.ignoreWords.add(valor);
      saveJSON("mdc.ignore-words", Array.from(this.ignoreWords));
      input.value = "";
      desenhar();
      void this.runWritingCheck();
      toast(`“${valor}” adicionada ao dicionário pessoal.`, "ok", 3000);
    };
    modal.querySelector<HTMLElement>("[data-add]")!.addEventListener("click", adicionar);
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        adicionar();
      }
    });
    const close = () => {
      document.removeEventListener("keydown", onKey, true);
      backdrop.remove();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        close();
      }
    };
    document.addEventListener("keydown", onKey, true);
    backdrop.addEventListener("mousedown", (e) => {
      if (e.target === backdrop) close();
    });
    modal.querySelectorAll<HTMLElement>("[data-close]").forEach((b) => b.addEventListener("click", close));
    desenhar();
    input.focus();
  }

  /**
   * Repara os blocos de alinhamento: remove `</div>` que sobrou e fecha os `<div align>`
   * que ficaram abertos (o bug antigo de aninhamento deixava os dois casos).
   */
  private repairAlignments(): void {
    const texto = this.editor.getText();
    const abrirRx = /^<div align="(left|center|right|justify)">$/;
    const saida: string[] = [];
    let abertos = 0;
    let removidos = 0;
    let emCodigo = false;

    for (const linha of texto.split("\n")) {
      const t = linha.trim();
      if (t.startsWith("```")) {
        emCodigo = !emCodigo;
        saida.push(linha);
        continue;
      }
      if (!emCodigo && abrirRx.test(t)) {
        abertos++;
        saida.push(linha);
        continue;
      }
      if (!emCodigo && t === "</div>") {
        if (abertos === 0) {
          removidos++; // fechamento sobrando
          continue;
        }
        abertos--;
        saida.push(linha);
        continue;
      }
      saida.push(linha);
    }

    let fechados = 0;
    if (abertos > 0) {
      if (saida.length && saida[saida.length - 1].trim() !== "") saida.push("");
      for (let i = 0; i < abertos; i++) {
        saida.push("</div>");
        saida.push("");
      }
      fechados = abertos;
    }

    if (!removidos && !fechados) {
      toast("Os alinhamentos já estão certos — nada para reparar.", "info", 2800);
      return;
    }
    this.editor.replaceRange(0, texto.length, saida.join("\n"));
    const partes = [];
    if (removidos) partes.push(`${removidos} fechamento(s) sobrando`);
    if (fechados) partes.push(`${fechados} bloco(s) sem fechar`);
    toast(`Alinhamentos reparados: ${partes.join(" e ")}.`, "ok", 4200);
  }

  /** Módulo de apresentações: mostra o documento como slides (cada slide após uma linha ---). */
  private openSlides(): void {
    openPresentation(this.editor.getText(), this.title ?? "Apresentação");
  }

  private openReview(): void {
    if (this.reviewHandle) return;
    this.reviewHandle = openReviewModal({
      issues: this.issues,
      stats: writingStats(this.editor.getText()),
      onGoTo: (issue) => {
        this.editor.gotoRange(issue.from, issue.to);
        this.reviewHandle?.close();
      },
      onFix: (issue) => {
        const replacement = issue.fix ?? issue.suggestions[0];
        if (!replacement) return;
        this.editor.replaceRange(issue.from, issue.to, replacement);
        this.checkWritingSoon();
      },
      onFixAllStyle: () => {
        const count = this.applyFixes(this.issues);
        if (!count) {
          toast("Nenhuma correção automática de estilo disponível.", "info", 2600);
          return;
        }
        toast(`${count} correção(ões) de estilo aplicada(s).`, "ok", 3200);
        this.checkWritingSoon();
      },
      onIgnore: (word) => this.ignoreWord(word),
      onRecheck: () => void this.runWritingCheck(),
      onClose: () => {
        this.reviewHandle = null;
      },
    });
  }

  /** Avisa a tradução ao vivo que o texto (ou a aba) mudou. */
  private translationDocChanged(immediate = false): void {
    this.translation?.docChanged(this.editor.getText(), immediate);
  }

  /** Arruma o português (pontuação, maiúsculas, formalidade) antes de mandar traduzir. */
  private polishForTranslation(text: string): string {
    try {
      const fixes = checkStyle(text)
        .filter((i) => i.fix !== undefined)
        .sort((a, b) => b.from - a.from);
      let out = text;
      let limit = Infinity;
      for (const i of fixes) {
        if (i.to > limit) continue;
        out = out.slice(0, i.from) + i.fix + out.slice(i.to);
        limit = i.from;
      }
      return out;
    } catch {
      return text;
    }
  }

  private setPreviewPath(p: string | null): void {
    this.preview.setDocPath(p);
    this.translation?.setDocPath(p);
  }

  private updatePreview = debounce(() => {
    void this.preview.render(this.editor.getText());
    this.translationDocChanged();
  }, 180);
  private statsSoon = debounce(() => this.updateStats(), 260);
  private outlineSoon = debounce(() => this.renderOutline(), 400);
  private autosaveSoon = debounce(() => void this.autosave(), 2000);

  private async autosave(): Promise<void> {
    const tab = this.tab;
    if (!tab.dirty) return;
    const text = this.editor.getText();
    // Documento novo (sem arquivo ainda): cria o rascunho e passa a salvar nele — é o
    // "salva conforme eu escrevo". Se não houver acesso a arquivos (navegador), cai
    // no servidor de desenvolvimento, que grava em temp/rascunho.md do projeto.
    if (!tab.path) {
      try {
        if (await this.ensureSaved()) return;
      } catch {
        /* sem arquivos: segue para o salvamento pelo servidor */
      }
      const salvou = await files.saveDraftFallback("rascunho", text);
      if (salvou) {
        tab.dirty = false;
        tab.statusSaved = `Salvo automaticamente em temp/ às ${fmtTime()}`;
        this.afterSave(tab);
      }
      return;
    }
    try {
      await files.saveDoc(tab.path, text);
      this.recordVersion(tab.path, text);
      // se o texto mudou enquanto gravava, continua "sujo" (o próximo autosave pega)
      if (tab !== this.tab || this.editor.getText() === text) tab.dirty = false;
      tab.statusSaved = tab.isDraft ? `Rascunho atualizado às ${fmtTime()}` : `Salvo automaticamente às ${fmtTime()}`;
      this.afterSave(tab);
    } catch {
      // não conseguiu gravar pelo app (navegador): guarda em temp/ do projeto
      await files.saveDraftFallback("rascunho", text);
    }
  }

  /** Redesenha o que depende do estado "salvo" — só se a aba ainda for a ativa. */
  private afterSave(tab: DocTab): void {
    if (tab === this.tab) {
      this.refreshTitle();
      this.setSaveState();
    } else {
      this.renderTabs();
    }
    this.sidebar?.render();
  }

  /** Cria um documento novo dentro da pasta de um projeto e abre numa aba. */
  private async newDocIn(dir: string): Promise<void> {
    try {
      const target = await files.uniqueMdPath(dir, "novo-documento");
      await files.saveDoc(target, "");
      await this.openPath(target);
      void this.sidebar.refresh();
      this.tabBar.beginRename(this.tab.id);
    } catch (e) {
      toast("Não consegui criar o documento: " + e, "err", 5000);
    }
  }

  private async save(saveAs = false): Promise<boolean> {
    try {
      const previousPath = this.path;
      const wasDraft = this.isDraft;
      if (saveAs || !this.path) {
        const suggested = this.isDraft || !this.path ? `${this.docTitleForFileName()}.md` : baseName(this.path);
        let defaultPath = suggested;
        try {
          defaultPath = joinPath(await files.defaultDocsDir(), suggested);
        } catch {
          /* usa apenas o nome do arquivo */
        }
        const picked = await files.pickSaveDoc(defaultPath);
        if (!picked) return false;
        this.path = /\.[a-zA-Z0-9]+$/.test(picked) ? picked : `${picked}.md`;
        this.isDraft = false;
      }

      // correção automática: ponto, vírgulas, maiúsculas, trocas formais e palavras erradas
      if (this.autoFix) {
        const count =
          this.applyFixes(checkStyle(this.editor.getText())) +
          this.autoFixWords(0, this.editor.getText().length, false);
        if (count) toast(`Correção automática: ${count} ajuste${count === 1 ? "" : "s"} antes de salvar.`, "ok", 2600);
      }

      const content = this.editor.getText();
      await files.saveDoc(this.path, content);
      if (previousPath && previousPath !== this.path) void moveHistory(previousPath, this.path);
      this.recordVersion(this.path, content, true);

      // saiu do rascunho para uma pasta do usuário: leva as imagens junto
      if (wasDraft && previousPath && docDirOf(this.path) !== docDirOf(previousPath)) {
        try {
          const copied = await files.copyAssets(previousPath, this.path);
          if (copied > 0) toast(`${copied} imagem(ns) copiada(s) junto para a pasta assets/.`, "ok", 4200);
        } catch {
          /* sem imagens para copiar */
        }
        void files.deleteDraft(previousPath).catch(() => {});
      }

      this.dirty = false;
      this.statusSaved = `Salvo às ${fmtTime()}`;
      this.setPreviewPath(this.path);
      if (!this.isDraft) this.addRecent(this.path);
      this.afterTabChange();

      if (previousPath && !wasDraft && docDirOf(this.path) !== docDirOf(previousPath) && /\]\(assets\//.test(content)) {
        toast("Salvo em outra pasta: as imagens de assets/ continuam na pasta antiga.", "info", 7000);
      } else if (saveAs) {
        toast(`Documento salvo em ${baseName(this.path)}`, "ok");
      }
      return true;
    } catch (e) {
      toast("Erro ao salvar: " + e, "err");
      return false;
    }
  }

  private async newDoc(): Promise<void> {
    // já existe uma aba vazia e sem nome? só vai até ela (como o Chrome faz com a página nova)
    const empty = this.tabs.find((t) => !t.path && !t.dirty && this.textOf(t).length === 0);
    if (empty) {
      if (empty !== this.tab) await this.switchTo(empty.id);
      this.editor.focus();
      return;
    }
    const tab = newTab(this.editor.createState(""));
    this.tabs.push(tab);
    await this.switchTo(tab.id);
  }

  private async openDocDialog(): Promise<void> {
    const picked = await files.pickOpenDoc();
    if (picked) await this.openPath(picked);
  }

  /** Abre o arquivo numa aba (se já estiver aberto, só vai até ela). */
  private async openPath(path: string): Promise<boolean> {
    const already = this.tabs.find((t) => t.path && t.path.toLowerCase() === path.toLowerCase());
    if (already) {
      await this.switchTo(already.id);
      return true;
    }
    try {
      const content = await files.loadDoc(path);
      const tab = this.addTabFor(path, content);
      this.addRecent(path);
      // abrir a partir de uma aba vazia e sem nome ocupa o lugar dela
      const current = this.tab;
      const reuse = !current.path && !current.dirty && this.textOf(current).length === 0;
      await this.switchTo(tab.id);
      if (reuse && this.tab === tab) {
        this.tabs = this.tabs.filter((t) => t !== current);
        this.afterTabChange();
      }
      return true;
    } catch (e) {
      toast("Não foi possível abrir o arquivo: " + e, "err");
      return false;
    }
  }

  /**
   * Garante que o documento tenha um arquivo, sem interromper o usuário:
   * salva automaticamente em Documentos/mdCreator (com aviso no rodapé/toast).
   * Funciona mesmo com backends antigos (não depende de comandos novos).
   */
  private async ensureSaved(): Promise<boolean> {
    const tab = this.tab;
    if (tab.path) return true;
    const text = this.editor.getText();
    try {
      const base = slugify(this.docTitleForFileName()) || "documento";
      let target: string | null = null;
      try {
        // rascunho na pasta do próprio app (não espalha arquivos em Documentos)
        target = await files.draftPath(base);
      } catch {
        target = null; // backend mais antigo: cai na pasta de documentos
      }
      if (!target) {
        const dir = await files.defaultDocsDir();
        target = joinPath(dir, `${base}.md`);
        for (let i = 1; i <= 40 && (await files.existsText(target)); i++) {
          target = joinPath(dir, `${base}-${i}.md`);
        }
      }
      await files.saveDoc(target, text);
      tab.path = target;
      tab.isDraft = true;
      tab.dirty = this.tab === tab ? this.editor.getText() !== text : false;
      tab.statusSaved = "Rascunho guardado no app";
      if (this.tab === tab) {
        this.setPreviewPath(target);
        this.refreshPath();
      }
      this.afterSave(tab);
      this.saveSession();
      toast(
        "Rascunho guardado na pasta do app (não é a versão final). Use Ctrl+Shift+S quando quiser salvar numa pasta sua.",
        "info",
        6500
      );
      return true;
    } catch (e) {
      toast("Não consegui guardar o rascunho: " + e, "err", 7000);
      return false;
    }
  }

  /** Nome sugerido para o arquivo: o título que você definiu ou o primeiro título (#). */
  private docTitleForFileName(): string {
    if (this.title) return this.title;
    const match = /^#\s+(.+)$/m.exec(this.editor.getText());
    const base = (match ? match[1] : "documento").replace(/\s+/g, " ").trim();
    return base.slice(0, 60) || "documento";
  }

  /** Aplica o novo nome: renomeia o arquivo (se já salvo) ou guarda para o próximo salvamento. */
  private async applyTitle(value: string): Promise<void> {
    if (!this.path) {
      this.title = value;
      this.afterTabChange();
      toast(`Nome definido: "${value}". Ele será usado quando o documento for salvo.`, "ok", 3600);
      return;
    }
    const target = /\.[a-zA-Z0-9]+$/.test(value) ? value : `${value}.md`;
    try {
      const previous = this.path;
      const newPath = await files.renameFile(this.path, target);
      void moveHistory(this.path, newPath);
      this.path = newPath;
      this.recents = this.recents.map((r) => (r.path === previous ? { ...r, path: newPath } : r));
      saveJSON("mdc.recents", this.recents);
      this.setPreviewPath(newPath);
      this.afterTabChange();
      toast(`Documento renomeado para ${baseName(newPath)}.`, "ok", 3200);
    } catch (e) {
      toast("Não foi possível renomear: " + e, "err", 6000);
    }
  }

  // ---------- imagens ----------

  private insertImageMd(rel: string, alt: string): void {
    const { from } = this.editor.selectionPos();
    this.editor.insertAt(from, `![${alt}](${rel})\n`);
    this.updatePreview();
  }

  private async insertImageFromDialog(): Promise<void> {
    const src = await files.pickImageFile();
    if (!src) return;
    if (!(await this.ensureSaved())) return;
    try {
      const rel = await files.copyAsset(this.path!, src);
      this.insertImageMd(rel, stripExt(baseName(src)));
      toast(`Imagem salva em ${rel}`, "ok");
    } catch (e) {
      toast("Falha ao copiar a imagem: " + e, "err");
    }
  }

  private async onPaste(e: ClipboardEvent): Promise<void> {
    const dt = e.clipboardData;
    if (!dt) return;
    const imgs = Array.from(dt.files || []).filter((f) => f.type.startsWith("image/"));
    if (!imgs.length) return;
    e.preventDefault();
    if (!(await this.ensureSaved())) return;

    for (const f of imgs) {
      const ext = (f.type.split("/")[1] || "png").replace("jpeg", "jpg");
      const name = `imagem-${Date.now().toString(36)}.${ext}`;
      try {
        const b64 = await blobToBase64(f);
        const rel = await files.writeAsset(this.path!, name, b64);
        this.insertImageMd(rel, "imagem");
        toast(`Imagem colada e salva em ${rel}`, "ok");
      } catch (err) {
        toast("Falha ao salvar a imagem colada: " + err, "err");
      }
    }
  }

  private async setupDragDrop(): Promise<void> {
    try {
      await getCurrentWebview().onDragDropEvent(async (event) => {
        if (event.payload.type !== "drop") return;
        await this.handleDropped(event.payload.paths as string[]);
      });
    } catch (e) {
      console.warn("Drag & drop indisponível:", e);
    }
  }

  private async handleDropped(paths: string[]): Promise<void> {
    const mdPath = paths.find(isMarkdownPath);
    const images = paths.filter(isImagePath);
    if (mdPath) await this.openPath(mdPath);
    if (!images.length) return;
    if (!(await this.ensureSaved())) return;
    for (const p of images) {
      try {
        const rel = await files.copyAsset(this.path!, p);
        this.insertImageMd(rel, stripExt(baseName(p)));
        toast(`Imagem salva em ${rel}`, "ok");
      } catch (err) {
        toast("Falha ao copiar a imagem: " + err, "err");
      }
    }
  }

  // ---------- desenho ----------

  /** Já existe um quadro de desenho aberto dentro do documento? */
  private drawingEditorOpen(): boolean {
    return !!document.querySelector("#preview .draw-inline");
  }

  private async openDraw(): Promise<void> {
    if (this.drawingEditorOpen()) {
      toast("Finalize o desenho que já está aberto (Concluir ou Cancelar) antes de criar outro.", "info", 4200);
      return;
    }
    if (loadJSON<string>("mdc.drawstyle", "image") === "text") {
      this.newTextDrawing();
      return;
    }
    if (document.body.classList.contains("no-preview")) {
      this.toggle("no-preview");
      toast("Mostrei a pré-visualização: é nela que o quadro abre, dentro do documento.", "info", 3600);
    }
    const sel = this.editor.selectionPos();
    if (!(await this.ensureSaved())) return;
    try {
      const name = `desenho-${Date.now().toString(36)}.png`;
      const png = placeholderDataUrl(1600, 1000);
      const rel = await files.writeAsset(this.path!, name, png.split(",", 2)[1]);
      const initial: DrawDoc = { version: 1, w: 1600, h: 1000, elements: [] };
      await files.updateAsset(this.path!, `${rel}.draw.json`, toBase64Utf8(JSON.stringify(initial)));
      this.editor.insertAt(sel.from, `![Desenho](${rel})\n`);
      await this.preview.render(this.editor.getText());
      if (!this.preview.openEditorForRel(rel, true)) {
        // Desfaz para não deixar uma linha solta no Markdown.
        this.removeDrawingReference(rel);
        await this.preview.render(this.editor.getText());
        toast("Não consegui abrir o quadro aqui — a linha foi desfeita. Tente de novo.", "err", 6000);
        return;
      }
      toast("Desenhe direto no documento; clique em Concluir para salvar.", "info", 4200);
    } catch (e) {
      toast("Não foi possível criar o desenho: " + e, "err");
    }
  }

  private newTextDrawing(): void {
    if (document.body.classList.contains("no-preview")) {
      this.toggle("no-preview");
      toast("Mostrei a pré-visualização: é nela que o desenho abre, dentro do documento.", "info", 3600);
    }
    const sel = this.editor.selectionPos();
    const block = `\n\`\`\`text\n${TEXT_DRAW_PLACEHOLDER}\n\`\`\`\n`;
    this.editor.insertAt(sel.from, block);
    void this.preview.render(this.editor.getText()).then(() => {
      if (!this.preview.openTextEditorForContent(TEXT_DRAW_PLACEHOLDER)) {
        this.removeTextBlock(TEXT_DRAW_PLACEHOLDER);
        toast("Não consegui abrir o quadro de letras aqui — o bloco foi desfeito. Tente de novo.", "err", 6000);
        return;
      }
      toast("Desenhe com o mouse: caixas, textos, campos [ ] e tabelas.", "info", 4200);
    });
  }

  /** Remove um bloco ```text que contenha o texto indicado (usado para desfazer/remover). */
  private removeTextBlock(needle: string): boolean {
    const lines = this.editor.getText().split("\n");
    const offsetOf = (index: number) => lines.slice(0, index).reduce((n, l) => n + l.length + 1, 0);
    const target = needle.trim();
    let fallback: { from: number; to: number } | null = null;
    let i = 0;
    while (i < lines.length) {
      const fence = /^([ \t]*)(`{3,}|~{3,})[ \t]*([a-zA-Z0-9_-]*)[ \t]*$/.exec(lines[i]);
      if (!fence || !/^(text|txt)$/i.test(fence[3] || "")) {
        i++;
        continue;
      }
      const bodyStart = i + 1;
      let j = bodyStart;
      while (j < lines.length && !/^[ \t]*(`{3,}|~{3,})[ \t]*$/.test(lines[j])) j++;
      const body = lines.slice(bodyStart, j).join("\n");
      const from = offsetOf(i);
      const to = Math.min(offsetOf(Math.min(j + 1, lines.length)), this.editor.getText().length);
      const trimmed = body.trim();
      if (trimmed === target || (target === "" && trimmed === "")) {
        this.editor.replaceRange(from, to, "");
        this.updatePreview();
        return true;
      }
      if (!fallback && target !== "" && trimmed.includes(target)) fallback = { from, to };
      i = j + 1;
    }
    if (fallback) {
      this.editor.replaceRange(fallback.from, fallback.to, "");
      this.updatePreview();
      return true;
    }
    return false;
  }

  /** Atualiza o bloco ```text correspondente ao desenho de letras editado. */
  private replaceTextBlock(oldText: string, newText: string): boolean {
    const lines = this.editor.getText().split("\n");
    const needle = oldText.trim();
    let i = 0;
    while (i < lines.length) {
      const fence = /^([ \t]*)(`{3,}|~{3,})[ \t]*([a-zA-Z0-9_-]*)[ \t]*$/.exec(lines[i]);
      if (!fence || !/^(text|txt)$/i.test(fence[3] || "")) {
        i++;
        continue;
      }
      const bodyStartLine = i + 1;
      let j = bodyStartLine;
      while (j < lines.length && !/^[ \t]*(`{3,}|~{3,})[ \t]*$/.test(lines[j])) j++;
      const body = lines.slice(bodyStartLine, j).join("\n");
      if (body.trim() === needle) {
        const bodyOffset = lines.slice(0, bodyStartLine).reduce((n, l) => n + l.length + 1, 0);
        this.editor.replaceRange(bodyOffset, bodyOffset + body.length, newText);
        this.updatePreview();
        return true;
      }
      i = j + 1;
    }
    return false;
  }

  /** Liga/desliga o campo selecionável (- [ ]) indicado na pré-visualização. */
  private toggleTask(index: number): void {
    const text = this.editor.getText();
    const rx = /^([ \t]*(?:[-*+]|\d+\.)[ \t]+\[)([ xX])(\])/gm;
    let match: RegExpExecArray | null;
    let n = 0;
    while ((match = rx.exec(text)) !== null) {
      if (n === index) {
        const pos = match.index + match[1].length;
        this.editor.replaceRange(pos, pos + 1, match[2] === " " ? "x" : " ");
        this.statsSoon();
        return;
      }
      n++;
    }
  }

  private removeDrawingReference(rel: string): void {
    const text = this.editor.getText();
    const escaped = rel.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    // 1) linha inteira só com a imagem → remove a linha
    const wholeLine = new RegExp(`^[ \\t]*!\\[[^\\]]*\\]\\(${escaped}(?:\\s+"[^"]*")?\\)[ \\t]*\\r?\\n?`, "m");
    let next = text.replace(wholeLine, "");
    if (next === text) {
      // 2) imagem no meio de um texto → remove só a referência
      const inline = new RegExp(`!\\[[^\\]]*\\]\\(${escaped}(?:\\s+"[^"]*")?\\)`, "g");
      next = text.replace(inline, "");
    }
    if (next !== text) this.editor.setText(next, false);
    this.updatePreview();
  }

  // ---------- pastas de contexto para IA ----------

  private async chooseFolders(cursor?: number): Promise<void> {
    try {
      const paths = await files.pickFolders();
      if (!paths.length) return;
      await this.showFolderContext(paths, "", cursor);
    } catch (e) {
      toast("Não foi possível abrir o seletor de pastas: " + e, "err");
    }
  }

  private async showFolderContext(paths: string[], initialPrompt = "", cursor?: number): Promise<void> {
    try {
      const snapshots = await files.inspectFolders(paths);
      const backdrop = h("div", { class: "modal-backdrop" });
      const modal = h("div", { class: "modal folder-modal" });
      modal.innerHTML = `
        <header class="wm-head">
          <svg class="ic"><use href="#i-folder"/></svg>
          <h2>Pastas de contexto para IA</h2>
          <button class="btn icon" data-close title="Fechar (Esc)"><svg class="ic"><use href="#i-close"/></svg></button>
        </header>
        <div class="folder-modal-body">
          <p class="folder-note">Confira a estrutura selecionada e diga o que você quer pedir à IA. O mdCreator inclui caminhos e nomes no Markdown; não lê o conteúdo dos arquivos.</p>
          <div class="folder-snapshots"></div>
          <label class="folder-prompt-label" for="folder-prompt">O que você quer falar/pedir quando selecionar estas pastas?</label>
          <textarea id="folder-prompt" placeholder="Ex.: Analise a organização deste projeto e sugira onde implementar autenticação…"></textarea>
        </div>
        <footer class="wm-foot">
          <span class="muted">A estrutura será inserida no ponto atual do cursor.</span>
          <span class="dr-spacer"></span>
          <button class="btn" data-cancel>Cancelar</button>
          <button class="btn primary" data-insert>Inserir no Markdown</button>
        </footer>`;
      backdrop.append(modal);
      document.body.append(backdrop);

      const treeHost = modal.querySelector<HTMLElement>(".folder-snapshots")!;
      for (const snap of snapshots) {
        const card = h("section", { class: "folder-snapshot" });
        const title = h("div", { class: "folder-snapshot-title" });
        title.append(
          h("span", { class: "folder-emoji", text: "📁" }),
          h("strong", { text: snap.root })
        );
        const pre = h("pre", { class: "folder-tree", text: this.folderTreeText(snap) });
        card.append(title, pre);
        if (snap.truncated) card.append(h("div", { class: "folder-truncated", text: "Estrutura limitada: a pasta tem muitos itens ou níveis." }));
        treeHost.append(card);
      }

      const textarea = modal.querySelector<HTMLTextAreaElement>("#folder-prompt")!;
      textarea.value = initialPrompt;
      const close = () => {
        document.removeEventListener("keydown", onKey, true);
        backdrop.remove();
      };
      const onKey = (e: KeyboardEvent) => {
        if (e.key === "Escape") {
          e.preventDefault();
          e.stopPropagation();
          close();
        }
        if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
          e.preventDefault();
          modal.querySelector<HTMLButtonElement>("[data-insert]")!.click();
        }
      };
      document.addEventListener("keydown", onKey, true);
      backdrop.addEventListener("mousedown", (e) => {
        if (e.target === backdrop) close();
      });
      modal.querySelectorAll<HTMLElement>("[data-close], [data-cancel]").forEach((b) => b.addEventListener("click", close));
      modal.querySelector<HTMLButtonElement>("[data-insert]")!.addEventListener("click", () => {
        const prompt = textarea.value.trim();
        if (!prompt) {
          textarea.focus();
          toast("Escreva o que você quer pedir para a IA sobre estas pastas.", "info");
          return;
        }
        const snippet = this.folderMarkdown(snapshots, prompt);
        if (cursor === undefined) this.editor.insert(snippet);
        else this.editor.insertAt(cursor, snippet);
        this.linkFolders(paths);
        close();
        toast("Estrutura e instrução inseridas no Markdown.", "ok");
      });
      textarea.focus();
    } catch (e) {
      toast("Não foi possível ler a estrutura das pastas: " + e, "err");
    }
  }

  private folderTreeText(snapshot: files.FolderSnapshot): string {
    if (!snapshot.entries.length) return "(pasta vazia ou sem itens acessíveis)";
    return snapshot.entries.map((entry) => {
      const depth = entry.relative.split("/").length - 1;
      const indent = "  ".repeat(depth);
      return `${indent}├── ${entry.name}${entry.directory ? "/" : ""}`;
    }).join("\n");
  }

  private folderMarkdown(snapshots: files.FolderSnapshot[], prompt: string): string {
    const chunks = ["", "## Contexto de pastas para a IA", "", `**O que preciso:** ${prompt.replace(/\r?\n/g, "\n> ")}`, "", "> Abaixo estão os caminhos e nomes encontrados. Os arquivos não foram lidos; use estes diretórios como referência no projeto/contexto fornecido.", ""];
    for (const snap of snapshots) {
      chunks.push(`### Pasta: \`${snap.root.replace(/`/g, "'")}\``, "", "````text", this.folderTreeText(snap), "````", "");
    }
    return chunks.join("\n");
  }

  private linkFolders(paths: string[]): void {
    const map = new Map(this.linkedFolders.map((f) => [f.path.toLowerCase(), f]));
    for (const path of paths) {
      const name = path.replace(/[\\/]+$/, "").split(/[\\/]/).pop() || path;
      map.set(path.toLowerCase(), { path, name });
    }
    this.linkedFolders = Array.from(map.values()).slice(-20);
    saveJSON("mdc.linked-folders", this.linkedFolders);
    this.renderLinkedFolders();
  }

  private renderLinkedFolders(): void {
    const host = document.getElementById("linked-folders-list");
    if (!host) return; // agora as pastas ficam no menu "⋯"
    host.innerHTML = "";
    if (!this.linkedFolders.length) {
      host.append(h("div", { class: "side-empty", text: "Nenhuma pasta vinculada" }));
      return;
    }
    for (const folder of this.linkedFolders) {
      const row = h("div", { class: "recent linked-folder" });
      const open = h("button", { class: "recent-btn", title: folder.path });
      open.append(h("span", { class: "recent-name", text: folder.name }), h("span", { class: "recent-dir", text: folder.path }));
      open.addEventListener("click", () => void this.showFolderContext([folder.path]));
      const remove = h("button", { class: "recent-x", text: "×", title: "Desvincular pasta" });
      remove.addEventListener("click", (e) => {
        e.stopPropagation();
        this.linkedFolders = this.linkedFolders.filter((x) => x.path !== folder.path);
        saveJSON("mdc.linked-folders", this.linkedFolders);
        this.renderLinkedFolders();
      });
      row.append(open, remove);
      host.append(row);
    }
  }

  private setupEditorInteractions(): void {
    const editorHost = $("#editor");
    editorHost.addEventListener("click", (e) => {
      const target = e.target as HTMLElement;
      if (target.closest(".cm-content") || target.closest(".cm-gutters")) return;
      this.editor.focusAt(e.clientX, e.clientY);
    });
    editorHost.addEventListener("contextmenu", (e) => {
      e.preventDefault();
      const cursor = this.editor.selectionPos().from;
      document.querySelector(".editor-context-menu")?.remove();
      const menu = h("div", { class: "editor-context-menu" });
      const folderButton = h("button", { class: "context-menu-item" });
      folderButton.innerHTML = '<svg class="ic"><use href="#i-folder"/></svg><span>Pasta</span><kbd>contexto</kbd>';
      folderButton.addEventListener("click", () => {
        menu.remove();
        void this.chooseFolders(cursor);
      });
      menu.append(folderButton);
      for (const folder of this.linkedFolders.slice(-3).reverse()) {
        const quick = h("button", { class: "context-menu-item", title: folder.path });
        quick.innerHTML = '<svg class="ic"><use href="#i-folder"/></svg>';
        quick.append(h("span", { text: folder.name }));
        quick.addEventListener("click", () => {
          menu.remove();
          void this.showFolderContext([folder.path]);
        });
        menu.append(quick);
      }
      document.body.append(menu);
      const x = Math.min(e.clientX, window.innerWidth - menu.offsetWidth - 8);
      const y = Math.min(e.clientY, window.innerHeight - menu.offsetHeight - 8);
      menu.style.left = `${Math.max(8, x)}px`;
      menu.style.top = `${Math.max(8, y)}px`;
      const dismiss = (ev: MouseEvent) => {
        if (!menu.contains(ev.target as Node)) {
          menu.remove();
          document.removeEventListener("mousedown", dismiss, true);
        }
      };
      document.addEventListener("mousedown", dismiss, true);
    });
  }

  // ---------- diagramas (Mermaid) ----------

  /** Abre o construtor de diagramas (campos simples + pré-visualização). */
  private newDiagram(): void {
    openDiagramBuilder({
      dark: document.documentElement.dataset.theme === "dark",
      onInsert: (code) => {
        this.editor.insert("\n```mermaid\n" + code + "\n```\n");
        this.updatePreview();
        toast("Diagrama inserido no documento.", "ok", 2600);
      },
    });
  }

  /** Reabre um diagrama existente no construtor (substituindo o bloco). */
  private editDiagram(code: string): void {
    const range = this.findFencedBlock("mermaid", code);
    openDiagramBuilder({
      initialCode: code,
      dark: document.documentElement.dataset.theme === "dark",
      onInsert: (newCode) => {
        const block = "```mermaid\n" + newCode + "\n```\n";
        if (range) this.editor.replaceRange(range.from, range.to, block);
        else this.editor.insert("\n" + block + "\n");
        this.updatePreview();
        toast("Diagrama atualizado no documento.", "ok", 2600);
      },
    });
  }

  /** Localiza um bloco ```lang com esse conteúdo e devolve os deslocamentos no documento. */
  private findFencedBlock(lang: string, body: string): { from: number; to: number } | null {
    const text = this.editor.getText();
    const lines = text.split("\n");
    const offsetOf = (index: number) => lines.slice(0, index).reduce((n, l) => n + l.length + 1, 0);
    const target = body.replace(/\s+$/, "").trim();
    let i = 0;
    while (i < lines.length) {
      const fence = /^([ \t]*)(`{3,}|~{3,})[ \t]*([a-zA-Z0-9_-]*)[ \t]*$/.exec(lines[i]);
      if (!fence || (fence[3] || "").toLowerCase() !== lang) {
        i++;
        continue;
      }
      const bodyStart = i + 1;
      let j = bodyStart;
      while (j < lines.length && !/^[ \t]*(`{3,}|~{3,})[ \t]*$/.test(lines[j])) j++;
      const inner = lines.slice(bodyStart, j).join("\n");
      if (inner.trim() === target) {
        return { from: offsetOf(i), to: Math.min(offsetOf(Math.min(j + 1, lines.length)), text.length) };
      }
      i = j + 1;
    }
    return null;
  }

  // ---------- IA / exportação ----------

  private async copyForAI(): Promise<void> {
    const text = this.editor.getText();
    if (!text.trim()) {
      toast("Nada para copiar ainda.", "info");
      return;
    }
    const ok = await copyText(text);
    const hasImages = /!\[[^\]]*\]\(([^)]*assets\/|[^)]*\.(png|jpe?g|gif|webp|svg))/i.test(text);
    if (!ok) {
      toast("Não foi possível copiar.", "err");
      return;
    }
    toast(
      hasImages
        ? "Markdown copiado. Para enviar as imagens junto, use Pacote IA e anexe o ZIP."
        : "Markdown copiado para a área de transferência.",
      "ok",
      hasImages ? 6500 : 3200
    );
  }

  /** Abre a tela de exportação (HTML, PDF, Word, Markdown, texto, pacote para IA ou cópia). */
  private openExport(format?: ExportFormat): void {
    if (document.querySelector(".export-modal")) return;
    openExportDialog(
      {
        getMarkdown: () => this.editor.getText(),
        docPath: () => this.path,
        docName: () => (this.path ? stripExt(baseName(this.path)) : slugify(this.docTitleForFileName()) || "documento"),
        isDark: () => document.documentElement.dataset.theme === "dark",
        translation: this.translation,
        mdCss,
        ensureFile: async () => {
          if (!this.path) return await this.save(true);
          if (this.dirty) return await this.save(false);
          return true;
        },
        reveal: (p) => void revealItemInDir(p).catch(() => {}),
      },
      format
    );
  }

  // ---------- boas-vindas ----------

  private showWelcome(): void {
    const backdrop = h("div", { class: "modal-backdrop" });
    const modal = h("div", { class: "modal welcome-modal" });
    modal.innerHTML = `
      <header class="wm-head">
        <svg class="ic"><use href="#i-help"/></svg>
        <h2>Boas-vindas</h2>
        <button class="btn icon" data-close title="Fechar (Esc)"><svg class="ic"><use href="#i-close"/></svg></button>
      </header>
      <div class="wm-body">${welcomeHtml()}</div>
      <footer class="wm-foot">
        <span class="muted">Dica: F1 abre esta tela a qualquer momento.</span>
        <span class="dr-spacer"></span>
        <button class="btn" data-open>Abrir arquivo…</button>
        <button class="btn primary" data-start>Começar a escrever</button>
      </footer>`;
    backdrop.append(modal);
    document.body.append(backdrop);

    const close = () => {
      document.removeEventListener("keydown", onKey, true);
      backdrop.remove();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        close();
      }
    };
    document.addEventListener("keydown", onKey, true);
    backdrop.addEventListener("mousedown", (e) => {
      if (e.target === backdrop) close();
    });
    modal.querySelectorAll<HTMLElement>("[data-close]").forEach((b) => b.addEventListener("click", close));
    modal.querySelector<HTMLElement>("[data-start]")!.addEventListener("click", () => {
      close();
      this.editor.focus();
    });
    modal.querySelector<HTMLElement>("[data-open]")!.addEventListener("click", () => {
      close();
      void this.openDocDialog();
    });
  }

  // ---------- barra de ferramentas ----------

  private act(name: string): void {
    switch (name) {
      case "heading":
        this.editor.cycleHeading();
        break;
      case "bold":
        this.editor.wrapSelection("**", "**", "texto");
        break;
      case "italic":
        this.editor.wrapSelection("*", "*", "texto");
        break;
      case "strike":
        this.editor.wrapSelection("~~", "~~", "texto");
        break;
      case "code":
        this.editor.wrapSelection("`", "`", "código");
        break;
      case "codeblock":
        this.editor.insert("\n```\n$0\n```\n");
        break;
      case "quote":
        this.editor.toggleLinePrefix("> ");
        break;
      case "list":
        this.editor.toggleLinePrefix("- ");
        break;
      case "olist":
        this.editor.toggleLinePrefix("1. ");
        break;
      case "task":
        this.editor.toggleLinePrefix("- [ ] ");
        break;
      case "link":
        this.editor.wrapSelection("[", "](https://)", "texto do link");
        break;
      case "align-left":
        this.editor.setAlignment("left");
        break;
      case "align-center":
        this.editor.setAlignment("center");
        break;
      case "align-right":
        this.editor.setAlignment("right");
        break;
      case "align-justify":
        this.editor.setAlignment("justify");
        break;
      case "mark":
        this.editor.wrapSelection("<mark>", "</mark>", "destaque");
        break;
      case "small":
        // letras menores (Markdown não tem tamanho de fonte; <small> é HTML seguro e simples)
        this.editor.wrapSelection("<small>", "</small>", "texto menor");
        break;
      case "table":
        this.editor.insert(TABLE_SNIPPET);
        break;
      case "hr":
        this.editor.insert("\n---\n");
        break;
      case "mermaid":
        this.newDiagram();
        break;
      case "ai-template":
        this.editor.insert(AI_TEMPLATE);
        break;
      case "image":
        void this.insertImageFromDialog();
        break;
      case "draw":
        this.openDraw();
        break;
      case "translate-toggle":
        this.toggleTranslation();
        break;
      case "translate-settings":
        this.showSettings("traducao");
        break;
      case "export":
        this.openExport();
        break;
      case "palette":
        this.openPalette();
        break;
    }
  }

  // ---------- menus suspensos ("⋯") ----------

  private closeMenus(): void {
    document.querySelectorAll(".dropdown").forEach((m) => m.remove());
  }

  private openMenu(anchor: HTMLElement, build: (menu: HTMLElement) => void): void {
    const wasOpen = !!document.querySelector(".dropdown");
    this.closeMenus();
    if (wasOpen) return;
    const menu = h("div", { class: "dropdown" });
    build(menu);
    document.body.append(menu);
    const r = anchor.getBoundingClientRect();
    const w = menu.offsetWidth;
    const left = Math.max(8, Math.min(r.right - w, window.innerWidth - w - 8));
    menu.style.left = `${left}px`;
    menu.style.top = `${Math.min(r.bottom + 6, window.innerHeight - menu.offsetHeight - 8)}px`;
    const dismiss = (ev: MouseEvent) => {
      if (!menu.contains(ev.target as Node)) {
        this.closeMenus();
        document.removeEventListener("mousedown", dismiss, true);
      }
    };
    document.addEventListener("mousedown", dismiss, true);
  }

  private ddItem(
    menu: HTMLElement,
    opts: { icon?: string; label: string; hint?: string; checked?: boolean; onPick: () => void }
  ): void {
    const btn = h("button", { class: "dd-item", type: "button" });
    if (opts.icon) btn.innerHTML = `<svg class="ic"><use href="#${opts.icon}"/></svg>`;
    btn.append(h("span", { text: opts.label }));
    if (opts.hint) btn.append(h("span", { class: "dd-hint", text: opts.hint }));
    if (opts.checked) btn.insertAdjacentHTML("beforeend", '<svg class="ic dd-check"><use href="#i-check"/></svg>');
    btn.addEventListener("click", () => {
      this.closeMenus();
      opts.onPick();
    });
    menu.append(btn);
  }

  private ddSep(menu: HTMLElement): void {
    menu.append(h("div", { class: "dd-sep" }));
  }

  private ddNote(menu: HTMLElement, text: string): void {
    menu.append(h("div", { class: "dd-note", text }));
  }

  private buildMoreMenu(menu: HTMLElement): void {
    this.ddItem(menu, { icon: "i-saveas", label: "Salvar como…", hint: "Ctrl+Shift+S", onPick: () => void this.save(true) });
    this.ddSep(menu);
    this.ddItem(menu, { icon: "i-copy", label: "Copiar para a IA", hint: "Ctrl+Shift+C", onPick: () => void this.copyForAI() });
    this.ddItem(menu, { icon: "i-export", label: "Exportar…", hint: "Ctrl+Shift+E", onPick: () => this.openExport() });
    this.ddItem(menu, { icon: "i-zip", label: "Pacote para IA (.zip)", hint: "tudo junto", onPick: () => this.openExport("zip") });
    this.ddItem(menu, {
      icon: "i-globe",
      label: "Tradução automática",
      hint: "Ctrl+Alt+T",
      checked: this.translation.settings.enabled,
      onPick: () => this.toggleTranslation(),
    });
    this.ddSep(menu);
    this.ddItem(menu, { icon: "i-folder", label: "Vincular pastas (contexto)…", onPick: () => void this.chooseFolders() });
    for (const folder of this.linkedFolders.slice(-3).reverse()) {
      this.ddItem(menu, { label: folder.name, hint: folder.path, onPick: () => void this.showFolderContext([folder.path]) });
    }
    this.ddSep(menu);
    this.ddItem(menu, { icon: "i-clock", label: "Histórico de versões", onPick: () => void this.openHistory() });
    this.ddItem(menu, { icon: "i-spark", label: "Configurações", hint: `tom ${this.settings.tone}`, onPick: () => this.showSettings() });
    this.ddItem(menu, { icon: "i-check", label: "Revisar texto", hint: "F7", onPick: () => this.openReview() });
    this.ddItem(menu, { icon: "i-eye", label: "Apresentar (slides)", hint: "F5", onPick: () => this.openSlides() });
    this.ddItem(menu, {
      icon: "i-check",
      label: "Dicionário pessoal…",
      hint: `${this.ignoreWords.size} palavra(s)`,
      onPick: () => this.showDictionary(),
    });
    this.ddItem(menu, {
      icon: "i-align-left",
      label: "Reparar alinhamentos",
      hint: "conserta <div> sobrando",
      onPick: () => this.repairAlignments(),
    });
    this.ddItem(menu, {
      icon: "i-check",
      label: "Correção automática",
      hint: "ao terminar o parágrafo e ao salvar",
      checked: this.autoFix,
      onPick: () => this.setAutoFix(!this.autoFix),
    });
    this.ddItem(menu, {
      icon: "i-check",
      label: "Sugestões inline (estilo Copilot)",
      hint: "Tab aceita, Alt+Seta palavra",
      checked: this.copilot,
      onPick: () => this.setCopilot(!this.copilot),
    });

    this.ddSep(menu);
    this.ddItem(menu, {
      icon: "i-sidebar",
      label: "Painel lateral",
      checked: !document.body.classList.contains("no-sidebar"),
      onPick: () => this.toggle("no-sidebar"),
    });
    this.ddItem(menu, {
      icon: "i-eye",
      label: "Pré-visualização",
      checked: !document.body.classList.contains("no-preview"),
      onPick: () => this.toggle("no-preview"),
    });
    const dark = document.documentElement.dataset.theme === "dark";
    this.ddItem(menu, { icon: dark ? "i-sun" : "i-moon", label: "Tema escuro", checked: dark, onPick: () => this.applyTheme(!dark) });
    this.ddSep(menu);
    this.ddItem(menu, { icon: "i-help", label: "Boas-vindas e ajuda", hint: "F1", onPick: () => this.showWelcome() });
  }

  private buildDrawStyleMenu(menu: HTMLElement): void {
    const current = loadJSON<string>("mdc.drawstyle", "image") === "text" ? "text" : "image";
    this.ddItem(menu, {
      icon: "i-image",
      label: "Imagem (PNG)",
      checked: current === "image",
      onPick: () => this.setDrawStyle("image"),
    });
    this.ddItem(menu, {
      icon: "i-draw",
      label: "Letras e símbolos",
      hint: "texto puro",
      checked: current === "text",
      onPick: () => this.setDrawStyle("text"),
    });
    this.ddNote(menu, "Imagem guarda um PNG em assets/. Letras vira texto no próprio Markdown — ideal para mandar à IA.");
  }

  private setDrawStyle(style: "image" | "text"): void {
    saveJSON("mdc.drawstyle", style);
    toast(
      style === "text"
        ? "Desenho em letras e símbolos: entra direto no Markdown."
        : "Desenho em imagem: vira PNG na pasta assets/.",
      "info",
      2600
    );
  }

  private setupToolbar(): void {
    $$("[data-act]").forEach((btn) => {
      const name = btn.dataset.act!;
      btn.addEventListener("click", () => {
        switch (name) {
          case "new":
            void this.newDoc();
            break;
          case "open":
            void this.openDocDialog();
            break;
          case "save":
            void this.save(false);
            break;
          case "save-as":
            void this.save(true);
            break;
          case "copy-ai":
            void this.copyForAI();
            break;
          case "welcome":
            this.showWelcome();
            break;
          case "folders":
            void this.chooseFolders();
            break;
          case "export-html":
            this.openExport("html");
            break;
          case "export-bundle":
            this.openExport("zip");
            break;
          case "toggle-more": {
            const box = document.querySelector<HTMLElement>("#toolbar-more");
            if (box) {
              const show = box.hidden;
              box.hidden = !show;
              saveJSON("mdc.toolbar-more", show);
              btn.classList.toggle("active", show);
            }
            break;
          }
          case "toggle-sidebar":
            this.toggle("no-sidebar");
            break;
          case "toggle-preview":
            this.toggle("no-preview");
            break;
          case "theme":
            this.applyTheme(document.documentElement.dataset.theme !== "dark");
            break;
          default:
            this.act(name);
            break;
        }
      });
    });

    // menus "⋯"
    $$("[data-menu]").forEach((btn) => {
      const which = btn.dataset.menu!;
      btn.addEventListener("click", () => {
        if (which === "more") this.openMenu(btn, (m) => this.buildMoreMenu(m));
        else if (which === "draw-style") this.openMenu(btn, (m) => this.buildDrawStyleMenu(m));
      });
    });

    // estado da barra de formatação expandida
    const moreBox = document.querySelector<HTMLElement>("#toolbar-more");
    if (moreBox && loadJSON<boolean>("mdc.toolbar-more", false)) {
      moreBox.hidden = false;
      document.querySelector("#tb-more")?.classList.add("active");
    }
  }

  /** Controles de janela integrados (minimizar, maximizar/restaurar, fechar e arrastar). */
  private setupWindowControls(): void {
    const btnMin = document.getElementById("win-min");
    const btnMax = document.getElementById("win-max");
    const btnClose = document.getElementById("win-close");
    const topbar = document.getElementById("topbar");

    // Remove barra branca nativa no Tauri e ativa sombra
    try {
      const win = getCurrentWindow();
      void win.setDecorations(false);
      void win.setShadow(true);
    } catch {
      /* ambiente web/preview */
    }

    const updateMaxIcon = async () => {
      try {
        const isMax = await getCurrentWindow().isMaximized();
        if (btnMax) {
          const use = btnMax.querySelector("use");
          if (use) {
            use.setAttribute("href", isMax ? "#i-win-restore" : "#i-win-max");
          }
          btnMax.title = isMax ? "Restaurar tamanho" : "Maximizar";
          btnMax.setAttribute("aria-label", btnMax.title);
        }
      } catch {
        /* ambiente sem janela nativa (preview no navegador) */
      }
    };

    btnMin?.addEventListener("click", () => {
      try {
        void getCurrentWindow().minimize();
      } catch {}
    });

    btnMax?.addEventListener("click", async () => {
      try {
        await getCurrentWindow().toggleMaximize();
        await updateMaxIcon();
      } catch {}
    });

    btnClose?.addEventListener("click", async () => {
      try {
        await this.autosave();
        await getCurrentWindow().close();
      } catch {}
    });

    // Duplo clique na barra superior alterna maximizar
    topbar?.addEventListener("dblclick", (e) => {
      const target = e.target as HTMLElement;
      if (!target.closest("button, input, a, .win-btn, .btn, .split-btn, .palette-btn")) {
        try {
          void getCurrentWindow().toggleMaximize().then(updateMaxIcon);
        } catch {}
      }
    });

    // Arrastar janela com o mouse (fallback seguro para além do data-tauri-drag-region)
    topbar?.addEventListener("mousedown", (e) => {
      if (e.button !== 0) return;
      const target = e.target as HTMLElement;
      if (!target.closest("button, input, a, .win-btn, .btn, .split-btn, .palette-btn")) {
        try {
          void getCurrentWindow().startDragging();
        } catch {}
      }
    });

    // Sincroniza ícone de maximizar ao redimensionar
    window.addEventListener("resize", () => {
      void updateMaxIcon();
    });

    void updateMaxIcon();
  }

  /** Modo foco: só o texto, sem painéis nem barras (Esc ou Ctrl+Shift+F para sair). */
  private toggleFocus(force?: boolean): void {
    const on = force ?? !document.body.classList.contains("focus-mode");
    document.body.classList.toggle("focus-mode", on);
    if (on) toast("Modo foco: Esc para sair.", "info", 2200);
    this.editor.focus();
  }

  /** Busca de comandos (Ctrl+K). */
  private openPalette(): void {
    const items: PaletteItem[] = [];
    const add = (group: string, label: string, run: () => void, hint?: string, keywords?: string) =>
      items.push({ group, label, run, hint, keywords });

    add("Documento", "Novo documento (nova aba)", () => void this.newDoc(), "Ctrl+T", "criar");
    add("Documento", "Abrir arquivo…", () => void this.openDocDialog(), "Ctrl+O");
    add("Documento", "Salvar", () => void this.save(false), "Ctrl+S");
    add("Documento", "Salvar como…", () => void this.save(true), "Ctrl+Shift+S");
    add("Documento", "Renomear documento", () => this.tabBar.beginRename(this.tab.id), "F2", "nome título");
    add("Documento", "Histórico de versões", () => void this.openHistory(), undefined, "versoes restaurar voltar anterior");
    add("Documento", "Salvar versão agora", () => void this.saveVersionNow(), undefined, "historico marcar");
    add("Buscar", "Buscar no conteúdo dos documentos", () => this.sidebar.focusSearch(), undefined, "procurar texto pesquisar projetos");
    add("Configurações", "Abrir configurações", () => this.showSettings(), undefined, "preferencias ajustes tom historico");
    add("Configurações", "Tom do texto: formal", () => this.setTonePref("formal"));
    add("Configurações", "Tom do texto: neutro", () => this.setTonePref("neutro"));
    add("Configurações", "Tom do texto: informal", () => this.setTonePref("informal"));
    add("Documento", "Fechar aba", () => void this.closeTab(this.activeTabId()), "Ctrl+W");
    add("Documento", "Reabrir aba fechada", () => void this.reopenClosedTab(), "Ctrl+Shift+T");

    add("Exportar", "Exportar…", () => this.openExport(), "Ctrl+Shift+E");
    add("Exportar", "Exportar como PDF", () => this.openExport("pdf"), undefined, "imprimir");
    add("Exportar", "Exportar como Word (.docx)", () => this.openExport("docx"), undefined, "doc");
    add("Exportar", "Exportar como página web (.html)", () => this.openExport("html"), undefined, "site");
    add("Exportar", "Exportar Markdown", () => this.openExport("md"));
    add("Exportar", "Exportar texto simples", () => this.openExport("txt"), undefined, "txt");
    add("Exportar", "Pacote para IA (.zip)", () => this.openExport("zip"), undefined, "zip");
    add("Exportar", "Copiar formatado (colar no Word)", () => this.openExport("copy"));
    add("Exportar", "Copiar Markdown para a IA", () => void this.copyForAI(), "Ctrl+Shift+C");

    const tr = this.translation;
    add("Tradução", tr.settings.enabled ? "Desligar tradução automática" : "Ligar tradução automática (PT-BR → inglês)", () => this.toggleTranslation(), "Ctrl+Alt+T", "traduzir english");
    add("Tradução", "Ajustes da tradução (offline, glossário…)", () => this.showSettings("traducao"), undefined, "motor modelo glossario");
    add("Tradução", "Ver só português", () => this.showLanguage("pt"));
    add("Tradução", "Ver só inglês", () => this.showLanguage("en"));
    add("Tradução", "Ver português e inglês juntos", () => this.showLanguage("both"));

    add("Escrever", "Revisar texto", () => this.openReview(), "F7", "ortografia gramática");
    add("Escrever", "Apresentar (slides)", () => this.openSlides(), "F5", "apresentação slides powerpoint deck");
    add("Escrever", "Modo foco", () => this.toggleFocus(), "Ctrl+Shift+F", "concentrar zen");
    add("Escrever", "Desenhar", () => void this.openDraw(), "Ctrl+Shift+D");
    add("Escrever", "Inserir imagem", () => void this.insertImageFromDialog());
    add("Escrever", "Inserir tabela", () => this.act("table"));
    add("Escrever", "Inserir diagrama", () => this.act("mermaid"));
    add("Escrever", "Inserir modelo para IA", () => this.act("ai-template"));
    add("Escrever", "Dicionário pessoal…", () => this.showDictionary());

    add("Ver", "Alternar tema claro/escuro", () => this.applyTheme(document.documentElement.dataset.theme !== "dark"), undefined, "escuro dark");
    add("Ver", "Mostrar/ocultar painel lateral", () => this.toggle("no-sidebar"));
    add("Ver", "Mostrar/ocultar pré-visualização", () => this.toggle("no-preview"));
    add("Ver", "Painel: Projetos", () => this.openSidePanel("projects"));
    add("Ver", "Painel: Início (abertos e recentes)", () => this.openSidePanel("home"));
    add("Ver", "Painel: Estrutura do documento", () => this.openSidePanel("outline"));
    add("Ver", "Boas-vindas e ajuda", () => this.showWelcome(), "F1");

    this.tabs.forEach((t, i) => {
      if (t !== this.tab) add("Ir para a aba", tabLabel(t), () => void this.switchTo(t.id), i < 9 ? `Ctrl+${i + 1}` : undefined);
    });
    this.recents.slice(0, 8).forEach((r) => add("Recentes", stripExt(baseName(r.path)), () => void this.openPath(r.path), docDirOf(r.path)));
    openPalette(items);
  }

  private showLanguage(view: "pt" | "en" | "both"): void {
    if (!this.translation.settings.enabled) this.toggleTranslation();
    this.translation.setView(view);
  }

  private openSidePanel(panel: "home" | "projects" | "outline" | "context"): void {
    document.body.classList.remove("no-sidebar");
    this.sidebar.show(panel);
  }

  private toggleTranslation(): void {
    const on = !this.translation.settings.enabled;
    if (on && document.body.classList.contains("no-preview")) document.body.classList.remove("no-preview");
    this.translation.setEnabled(on);
    if (on && !loadJSON<boolean>("mdc.tr-intro", false)) {
      saveJSON("mdc.tr-intro", true);
      toast("Você escreve em português; o inglês aparece ao lado e acompanha o que você digita. Ajustes: botão “Ajustes” acima da pré-visualização.", "info", 7000);
    }
  }

  private toggle(cls: string): void {
    const on = document.body.classList.toggle(cls);
    saveJSON(`mdc.${cls}`, on);
    if (cls === "no-preview" || cls === "no-sidebar") {
      this.editor?.view?.requestMeasure();
    }
  }

  private setupKeys(): void {
    window.addEventListener("keydown", (e) => {
      if (e.key === "F1") {
        e.preventDefault();
        this.showWelcome();
        return;
      }
      if (e.key === "F5") {
        // apresentar: o documento vira uma sequência de slides (separados por ---)
        e.preventDefault();
        this.openSlides();
        return;
      }
      if (e.key === "F7") {
        e.preventDefault();
        this.openReview();
        return;
      }
      if (e.key === "Escape" && document.body.classList.contains("focus-mode") && !document.querySelector(".modal-backdrop")) {
        this.toggleFocus(false);
        return;
      }
      if (e.key === "F2" && !document.querySelector(".modal-backdrop")) {
        e.preventDefault();
        this.tabBar.beginRename(this.tab.id);
        return;
      }
      const ctrl = e.ctrlKey || e.metaKey;
      if (!ctrl) return;
      const k = e.key.toLowerCase();
      const inModal = !!document.querySelector(".modal-backdrop");
      if (k === "s") {
        e.preventDefault();
        if (!inModal) void this.save(e.shiftKey);
        return;
      }
      if (inModal) return;
      if (k === "k" && !e.shiftKey && !e.altKey) {
        e.preventDefault();
        this.openPalette();
      } else if (e.shiftKey && k === "f") {
        e.preventDefault();
        this.toggleFocus();
      } else if (e.key === "Tab") {
        e.preventDefault();
        void this.switchRelative(e.shiftKey ? -1 : 1);
      } else if (k === "w") {
        e.preventDefault();
        void this.closeTab(this.activeTabId());
      } else if (k === "t" && e.shiftKey) {
        e.preventDefault();
        void this.reopenClosedTab();
      } else if (k === "t" && !e.altKey) {
        e.preventDefault();
        void this.newDoc();
      } else if (/^[1-9]$/.test(k) && !e.shiftKey && !e.altKey) {
        e.preventDefault();
        const target = k === "9" ? this.tabs[this.tabs.length - 1] : this.tabs[Number(k) - 1];
        if (target) void this.switchTo(target.id);
      } else if (k === "o") {
        e.preventDefault();
        void this.openDocDialog();
      } else if (k === "n") {
        e.preventDefault();
        void this.newDoc();
      } else if (e.altKey && k === "t") {
        e.preventDefault();
        this.toggleTranslation();
      } else if (e.shiftKey && k === "d") {
        e.preventDefault();
        void this.openDraw();
      } else if (e.shiftKey && k === "c") {
        e.preventDefault();
        void this.copyForAI();
      } else if (e.shiftKey && k === "e") {
        e.preventDefault();
        this.openExport();
      } else if (k === "b") {
        e.preventDefault();
        this.act("bold");
      } else if (k === "i") {
        e.preventDefault();
        this.act("italic");
      }
    });
  }

  // ---------- painel lateral / status ----------

  private addRecent(path: string): void {
    this.recents = [{ path, at: Date.now() }, ...this.recents.filter((r) => r.path.toLowerCase() !== path.toLowerCase())].slice(0, 12);
    saveJSON("mdc.recents", this.recents);
  }

  private renderOutline(): void {
    this.outline?.render();
  }

  private updateStats(): void {
    const text = this.editor.getText();
    const words = (text.match(/[\p{L}\p{N}_'-]+/gu) || []).length;
    const lines = text ? text.split("\n").length : 1;
    $("#st-words").textContent = `${words} ${words === 1 ? "palavra" : "palavras"}`;
    $("#st-chars").textContent = `${text.length} caracteres`;
    $("#st-lines").textContent = `${lines} ${lines === 1 ? "linha" : "linhas"}`;
    $("#st-cursor").textContent = `Ln ${this.cursor.line}, Col ${this.cursor.col}`;
  }

  private setSaveState(): void {
    const el = $("#save-state");
    el.textContent = this.dirty
      ? "Alterações não salvas"
      : this.isDraft
        ? "Rascunho (no app)"
        : this.statusSaved;
    el.classList.toggle("dirty", this.dirty);
  }

  private refreshTitle(): void {
    const name = this.path ? baseName(this.path) : `${this.title ?? "Sem título"}.md`;
    this.renderTabs();
    const title = `${this.dirty ? "• " : ""}${name} — mdCreator`;
    document.title = title;
    // Fora do Tauri (ex.: preview no navegador) a API não existe: seguimos em silêncio.
    try {
      void getCurrentWindow()
        .setTitle(title)
        .catch(() => {});
    } catch {
      /* sem janela nativa */
    }
  }

  private refreshPath(): void {
    const btn = $("#st-path") as HTMLButtonElement;
    if (!this.path) {
      btn.hidden = true;
      return;
    }
    btn.hidden = false;
    btn.textContent = this.isDraft ? "Rascunho do app" : docDirOf(this.path);
    btn.title = this.isDraft
      ? `Rascunho guardado em: ${docDirOf(this.path)} (clique para abrir a pasta)`
      : `Mostrar ${baseName(this.path)} na pasta`;
  }

  // ---------- tema / layout ----------

  private initialDark(): boolean {
    const saved = localStorage.getItem("mdc.theme");
    if (saved === "dark") return true;
    if (saved === "light") return false;
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  }

  private applyTheme(dark: boolean, rerender = true): void {
    document.documentElement.dataset.theme = dark ? "dark" : "light";
    localStorage.setItem("mdc.theme", dark ? "dark" : "light");
    this.editor?.setTheme(dark);
    this.preview?.setDark(dark);
    this.translation?.setDark(dark);
    const btn = document.querySelector<HTMLElement>("#btn-theme");
    if (btn) btn.innerHTML = `<svg class="ic"><use href="#${dark ? "i-sun" : "i-moon"}"/></svg>`;
    if (rerender && this.editor) {
      void this.preview.render(this.editor.getText());
      this.translationDocChanged(true);
    }
  }

  private setupSplitter(): void {
    const sp = $("#splitter");
    const body = $("#body");
    const editorPane = $("#editor-wrap");
    const previewPane = $("#preview-wrap");

    // A largura distribuível exclui o divisor físico. Os limites mínimos
    // preservam espaço para o editor e para o cartão de boas-vindas do preview.
    const region = () => {
      const r = body.getBoundingClientRect();
      const sidebarHidden = document.body.classList.contains("no-sidebar");
      const left = sidebarHidden ? r.left : $("#sidebar").getBoundingClientRect().right;
      const divider = sp.getBoundingClientRect().width;
      const free = Math.max(1, r.right - left - divider);
      const minEditor = Math.min(280, free * 0.36);
      const minPreview = Math.min(300, free * 0.44);
      editorPane.style.minWidth = `${minEditor}px`;
      previewPane.style.minWidth = `${minPreview}px`;
      return {
        left,
        divider,
        free,
        minRatio: minEditor / free,
        maxRatio: 1 - minPreview / free,
      };
    };

    const applyRatio = (raw: number) => {
      const bounds = region();
      const x = clamp(raw, bounds.minRatio, bounds.maxRatio);
      body.style.setProperty("--lg", String(x));
      body.style.setProperty("--rg", String(1 - x));
      return x;
    };

    region();
    const saved = Number(localStorage.getItem("mdc.split"));
    if (Number.isFinite(saved) && saved > 0 && saved < 1) applyRatio(saved);

    let dragging = false;
    let grabOffset = 0;
    sp.addEventListener("pointerdown", (e) => {
      dragging = true;
      const rect = sp.getBoundingClientRect();
      grabOffset = e.clientX - (rect.left + rect.width / 2);
      try {
        sp.setPointerCapture(e.pointerId);
      } catch {
        /* ignora */
      }
      document.body.classList.add("resizing");
      e.preventDefault();
    });
    sp.addEventListener("pointermove", (e) => {
      if (!dragging) return;
      const bounds = region();
      const center = e.clientX - grabOffset;
      const ratio = (center - bounds.left - bounds.divider / 2) / bounds.free;
      applyRatio(ratio);
    });
    const stop = (e: PointerEvent) => {
      if (!dragging) return;
      dragging = false;
      try {
        if (sp.hasPointerCapture(e.pointerId)) sp.releasePointerCapture(e.pointerId);
      } catch {
        /* ignora */
      }
      document.body.classList.remove("resizing");
      const v = body.style.getPropertyValue("--lg");
      if (v) localStorage.setItem("mdc.split", v);
    };
    sp.addEventListener("pointerup", stop);
    sp.addEventListener("pointercancel", stop);
    sp.addEventListener("dblclick", () => {
      body.style.removeProperty("--lg");
      body.style.removeProperty("--rg");
      localStorage.removeItem("mdc.split");
    });
    window.addEventListener("resize", () => {
      region();
      const current = Number(body.style.getPropertyValue("--lg"));
      if (Number.isFinite(current) && current > 0 && current < 1) applyRatio(current);
    });
  }

  private syncPreviewScroll(): void {
    const sc = this.editor.view.scrollDOM;
    const max = sc.scrollHeight - sc.clientHeight;
    if (max <= 0) return;
    const p = sc.scrollTop / max;
    const pv = $("#preview-wrap");
    pv.scrollTop = p * (pv.scrollHeight - pv.clientHeight);
  }
}

const app = new App();
// gancho de depuração (útil para inspecionar/testar o app em execução)
(window as unknown as Record<string, unknown>).__mdcreator = { app };
void app.start().catch((e) => {
  console.error(e);
  toast("Erro ao iniciar o mdCreator: " + e, "err", 8000);
});
