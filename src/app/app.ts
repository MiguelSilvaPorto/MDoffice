// mdOffice — o app: guarda o estado (abas, editor, painéis) e liga as peças.
// O trabalho de cada assunto está nos arquivos ao lado (tabs, documents, wordDocs, assistant…).
import { loadLanguageModel } from "../broker/ghost/model";
import { kindOfTab } from "../fileIcons";
import { MdEditor, type CursorPos } from "../md/editor";
import { Preview } from "../md/preview";
import * as files from "../files";
import { setTone } from "../broker/writing";
import { warmUpSpell, onSpellReady, ritmoDePausa, type WritingIssue } from "../broker/writing";
import { aoPromoverTermo, sinalizarTermo } from "../broker/personal/termos";
import { type ReviewHandle } from "../broker/review";
import { TabBar, newTab, tabLabel, type DocTab } from "../tabs";
import { Sidebar } from "../sidebar";
import { OutlinePanel } from "../outline";
import { Translation } from "../translate/controller";
import { WordHost } from "../word/host";
import { PowerPointHost } from "../powerpoint/powerpoint";
import { ExcelHost } from "../excel/host";
import { loadSettings, type AppSettings } from "../settings";
import * as backup from "../backup";

/** Caixa nativa de escolher pasta (usada pelo diálogo do backup). */
const pickFoldersNative = () => files.pickFolders();
import { revealItemInDir } from "@tauri-apps/plugin-opener";
import { $, toast, debounce, copyText, loadJSON, toBase64Utf8, h, saveJSON } from "../util";
import { type Recent, type LinkedFolder } from "./types";
import { tabsMethods } from "./tabs";
import { pagesMethods } from "./pages";
import { homeContextMethods } from "./homeContext";
import { documentsMethods } from "./documents";
import { wordDocsMethods } from "./wordDocs";
import { powerpointDocsMethods } from "./powerpointDocs";
import { excelDocsMethods } from "./excelDocs";
import { assistantMethods } from "./assistant";
import { formalizarMethods } from "./formalizar";
import { aplicarIconeApp } from "./appIcon";
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
import { trashMethods } from "./trash";
import { criarFilaSalvamento } from "./saveQueue";

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
  pptHost!: PowerPointHost;
  excelHost!: ExcelHost;
  docxNotice = false;
  pptxNotice = false;
  xlsxNotice = false;
  translation!: Translation;
  /** Todas as abas abertas (na ordem da fileira) e a que está ativa. */
  tabs: DocTab[] = [];
  tab!: DocTab;
  closedTabs: string[] = [];
  /** Estado do backup em disco, mostrado na barra inferior. */
  backupState: "ok" | "degradado" | "perigo" = "ok";
  /** true enquanto o salvamento automático está gravando (espelho da fila, para a interface). */
  saving = false;
  /**
   * Fila do salvamento automático: uma gravação por vez e **nenhum pedido descartado**.
   *
   * Em pasta de rede uma gravação leva segundos; o pedido que chega nesse meio-tempo
   * vira uma nova gravação com o estado mais recente assim que a atual termina (antes
   * ele era simplesmente ignorado e a última parte do texto ficava sem salvar).
   * O estado da fila alimenta o indicador "Salvando…" da barra.
   */
  saveQueue = criarFilaSalvamento({
    gravar: () => this.salvarAgora(),
    aoMudarEstado: (salvando) => {
      this.saving = salvando;
      this.updateAutosaveUI();
    },
  });
  backupDetail = "";
  /** Documentos com backup cujo original sumiu do disco. */
  missingBackups: backup.BackupEntry[] = [];
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
  /** Temporizador da varredura da correção automática (reagendado a cada pausa, com o ritmo aprendido). */
  private idleTimer: number | undefined;
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
        this.tabs.map((t) => ({ id: t.id, path: t.path, label: tabLabel(t), dirty: t.dirty, active: t === this.tab, kind: kindOfTab(t.kind) })),
      recents: () => this.recents.map((r) => r.path),
      pickFolders: () => files.pickFolders(),
      defaultDir: () => files.defaultDocsDir(),
      newDocIn: (dir) => void this.newDocIn(dir),
      reveal: (p) => void revealItemInDir(p).catch(() => {}),
      outlineFilter: (q) => this.outline?.setFilter(q),
      searchContent: (q, roots) => this.searchContent(q, roots),
      openAt: (p, line) => void this.openAt(p, line),
      contextMenu: (x, y, items) => this.openMenuAt(x, y, items),
      fileMenu: (anchor, path) => this.openFileMenu(anchor, path),
      fileMenuAt: (x, y, path) => this.openFileMenuAt(x, y, path),
      onHome: () => this.toggleHome(),
    });
    this.outline = new OutlinePanel($("#outline"), {
      getText: () => (this.tab.kind === "word" ? this.wordHost.outline().text : this.editor.getText()),
      goto: (line) =>
        this.tab.kind === "word"
          ? this.wordHost.gotoLine(line)
          : this.tab.kind === "xlsx"
            ? toast("A estrutura de títulos não se aplica a planilhas.", "info", 2600)
            : this.editor.gotoLine(line),
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
      onFormalizar: () => this.openFormalizar(),
      onAddons: () => toast("Painel de Suplementos do mdOffice.", "info", 2400),
    });
    this.pptHost = new PowerPointHost({
      pane: $("#powerpoint-pane"),
      onDirty: () => this.onPptChange(),
      onPickImage: (destino) => void this.pickPptImage(destino),
      onPickMedia: (tipo) => void this.pickPptMedia(tipo),
      onConfigure: () => void this.configurePpt(),
    });
    this.excelHost = new ExcelHost({
      pane: $("#excel-pane"),
      onDirty: () => this.onExcelChange(),
      onStatus: () => this.excelStatus(),
      onConfigure: () => void this.configureExcel(),
    });
    $("#ol-collapse").addEventListener("click", () => this.outline.collapseAll(true));
    $("#ol-expand").addEventListener("click", () => this.outline.collapseAll(false));
    $("#ctx-add").addEventListener("click", () => void this.chooseFolders());
    if (loadJSON<boolean>("mdc.no-sidebar", false)) document.body.classList.add("no-sidebar");
    if (loadJSON<boolean>("mdc.no-preview", false)) document.body.classList.add("no-preview");

    this.renderLinkedFolders();
    this.renderOutline();
    this.applyTheme(this.initialDark(), false);
    this.applyAnimacao(this.initialAnimacao());
    this.applyCantos(this.initialCantos());
    void aplicarIconeApp(); // ícone da janela escolhido em Configurações > Aparência
    this.setupToolbar();
    this.setupWindowControls();
    this.setupSplitter();
    this.setupKeys();
    this.setupEditorInteractions();
    this.editor.onScroll(() => this.syncPreviewScroll());
    this.editor.view.contentDOM.addEventListener("paste", (e) => void this.onPaste(e as ClipboardEvent));
    this.editor.onIssuesChanged = () => this.checkWritingSoon();
    this.editor.onIgnoreWord = (word) => this.ignoreWord(word);
    this.editor.onIgnoreStyle = (issue) => this.ignoreStyleIssue(issue);
    this.editor.onIgnoreHere = (word) => {
      // F4: "Ignorar neste texto" é o sinal de "este termo está certo" — com histerese, o app
      // acaba adicionando sozinho ao dicionário (o aviso conta o que aconteceu).
      sinalizarTermo(word);
      this.ignoredHere.add(word.toLowerCase());
      toast(`“${word}” ignorada neste texto (nos outros documentos ela continua sendo verificada).`, "info", 3600);
      void this.runWritingCheck();
    };
    // F4: o termo aprendido sozinho entra no dicionário pessoal na hora
    aoPromoverTermo((palavra) => this.adotarTermo(palavra));
    document.querySelector("#st-writing")?.addEventListener("click", () => this.openReview());
    document.querySelector("#st-deep")?.addEventListener("click", () => this.openDeepReview());
    this.startDeepWatcher();
    setTone(this.settings.tone);
    $("#st-history").addEventListener("click", () => void this.openHistory());
    // backup em disco: configuração no Rust, indicador na barra e checagem de originais
    void this.setupBackup();
    // lixeira: apaga de vez o que passou dos 30 dias (silencioso)
    void this.purgeTrash();
    document.querySelector("#st-backup")?.addEventListener("click", () => {
      // vermelho: arquivos que só existem no backup; fora disso, o histórico do documento
      if (this.backupState === "perigo") this.openMissingBackups();
      else void this.openHistory();
    });
    $("#st-path").addEventListener("click", () => {
      if (this.path) void revealItemInDir(this.path).catch(() => {});
    });
    document.querySelector("#tb-saved-path")?.addEventListener("click", () => {
      if (this.path) void revealItemInDir(this.path).catch(() => {});
    });
    window.addEventListener("blur", () => void this.autosave());
    window.addEventListener("beforeunload", () => {
      void this.autosave();
      // última cópia em disco antes de fechar (o async pode não terminar, mas o
      // salvamento automático já gravou o arquivo; isto é a rede de segurança)
      if (this.dirty) void this.backupNow(this.path, "fechar");
    });
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

  /** Manda a configuração atual do backup para o Rust (é ele quem grava). */
  async syncBackupConfig(): Promise<void> {
    const s = this.settings;
    const numeros = backup.numerosDoPerfil(s.backupProfile, s.backupCopies, s.backupDays);
    try {
      await backup.gravarConfig({
        enabled: s.backupOn,
        protect: true,
        user_root: s.backupRoot || null,
        max_copies: numeros.copias,
        max_days: numeros.dias,
      });
    } catch {
      /* sem acesso ao backend (navegador): o backup em disco não existe lá */
    }
  }

  /**
   * Coloca o backup em dia: manda a configuração para o Rust, mostra o indicador na
   * barra inferior, pergunta na primeira execução e procura originais que sumiram.
   */
  async setupBackup(): Promise<void> {
    // no navegador (desenvolvimento) não existe pasta para gravar: desliga em silêncio
    if (!backup.temBackend()) {
      const el = document.querySelector<HTMLElement>("#st-backup");
      if (el) el.hidden = true;
      return;
    }
    await this.syncBackupConfig();

    // pergunta uma única vez, na primeira execução
    if (!this.settings.backupAsked) await this.askBackup();
    // relê: a resposta acima pode ter mudado a configuração
    this.setBackupState("ok", "");
    if (this.settings.backupOn) {
      await this.checkMissing();
      // e de novo de tempos em tempos, para pegar quem apagou por fora
      window.setInterval(() => void this.checkMissing(), 30 * 60 * 1000);
    }
  }

  /**
   * Primeira execução: pergunta se quer ativar o backup e onde guardar.
   *
   * Só aparece uma vez. O botão "Agora não" desliga — nada é gravado fora do
   * histórico de dentro do app, e dá para ligar depois em Configurações.
   */
  async askBackup(this: App): Promise<void> {
    const backdrop = h("div", { class: "modal-backdrop" });
    const modal = h("div", { class: "modal bk-ask" });
    modal.innerHTML = `
      <header class="wm-head">
        <svg class="ic"><use href="#i-shield"/></svg>
        <h2>Guardar cópia de segurança dos seus arquivos?</h2>
      </header>
      <div class="bk-ask-body">
        <p>O <b>mdOffice</b> pode guardar uma cópia de cada documento que você escrever,
        em uma pasta do seu computador. Assim, mesmo se apagar o arquivo sem querer,
        fechar o app com força ou perder o documento, o texto continua lá.</p>
        <ul class="bk-ask-list">
          <li><b>Cópia a cada salvamento</b> e uma por dia, mesmo que você esqueça de salvar.</li>
          <li><b>Antes de sobrescrever</b> qualquer arquivo, o app guarda a versão anterior.</li>
          <li><b>Vale para Word, PowerPoint e Excel</b> também — não só Markdown.</li>
          <li>Você escolhe quanto tempo guardar e pode apagar quando quiser.</li>
        </ul>
        <p class="bk-ask-pasta">Onde guardar?</p>
        <div class="bk-ask-choose">
          <span class="muted" data-pasta>Nenhuma pasta escolhida (só a pasta do próprio app)</span>
          <button class="btn small" data-escolher>Escolher pasta…</button>
        </div>
      </div>
      <footer class="wm-foot">
        <span class="muted">Dá para mudar isso depois em <b>⋯ → Configurações</b>.</span>
        <span class="dr-spacer"></span>
        <button class="btn" data-nao>Agora não</button>
        <button class="btn primary" data-sim>Ativar backup</button>
      </footer>`;
    backdrop.append(modal);
    document.body.append(backdrop);

    const q = <T extends HTMLElement>(s: string) => modal.querySelector<T>(s)!;
    let raiz = this.settings.backupRoot;
    const pintar = () => {
      q("[data-pasta]").textContent = raiz || "Nenhuma pasta escolhida (só a pasta do próprio app)";
    };
    pintar();

    const fechar = () => {
      document.removeEventListener("keydown", onKey, true);
      backdrop.remove();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        fechar();
      }
    };
    document.addEventListener("keydown", onKey, true);
    backdrop.addEventListener("mousedown", (e) => {
      if (e.target === backdrop) fechar();
    });

    q("[data-escolher]").addEventListener("click", async () => {
      try {
        const escolhida = await pickFoldersNative();
        if (!escolhida.length) return;
        raiz = await backup.prepararPasta(escolhida[0]);
        pintar();
      } catch {
        toast("Não foi possível usar essa pasta.", "err");
      }
    });

    const gravar = async (ligado: boolean) => {
      this.settings = {
        ...this.settings,
        backupOn: ligado,
        backupRoot: ligado ? raiz : "",
        backupAsked: true,
      };
      saveJSON("mdc.settings", this.settings);
      fechar();
      if (!ligado) {
        // avisa o Rust para ele não proteger arquivos nem gravar cópias
        await this.syncBackupConfig();
        toast("Backup em disco desligado. O histórico de versões continua funcionando.", "info", 5000);
        return;
      }
      await this.setupBackup();
      toast("Backup ativado. As cópias ficam nas duas pastas, mesmo que uma falhe.", "ok", 5000);
    };

    q("[data-sim]").addEventListener("click", () => void gravar(true));
    q("[data-nao]").addEventListener("click", () => void gravar(false));
  }

  autoFixSoon = debounce(() => this.runAutoFix(), 700);

  // Depois que você para de digitar, a varredura aplica sozinha a pontuação e a limpeza
  // (ponto final, vírgulas, pontos a mais, frases coladas). O tempo de espera é o do ritmo
  // aprendido (correção desfeita faz esperar mais; mantida, pode agir mais cedo) — o cursor
  // fica ANTES do ponto, então continuar escrevendo entra no lugar certo.
  idleFixSoon = (): void => {
    window.clearTimeout(this.idleTimer);
    this.idleTimer = window.setTimeout(() => this.runIdleFix(), ritmoDePausa());
  };

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
type PowerPointDocsMethodsType = typeof powerpointDocsMethods;
type ExcelDocsMethodsType = typeof excelDocsMethods;
type AssistantMethodsType = typeof assistantMethods;
type FormalizarMethodsType = typeof formalizarMethods;
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
type TrashMethodsType = typeof trashMethods;
export interface App extends TabsMethodsType, PagesMethodsType, HomeContextMethodsType, DocumentsMethodsType, WordDocsMethodsType, PowerPointDocsMethodsType, ExcelDocsMethodsType, AssistantMethodsType, FormalizarMethodsType, DictionaryMethodsType, MdToolsMethodsType, HistorySearchMethodsType, MediaMethodsType, DrawingMethodsType, AiContextMethodsType, MenusMethodsType, ToolbarMethodsType, WindowControlsMethodsType, CommandsMethodsType, KeysMethodsType, LayoutMethodsType, DeepReviewMethodsType, TrashMethodsType {}
Object.assign(App.prototype, tabsMethods, pagesMethods, homeContextMethods, documentsMethods, wordDocsMethods, powerpointDocsMethods, excelDocsMethods, assistantMethods, formalizarMethods, dictionaryMethods, mdToolsMethods, historySearchMethods, mediaMethods, drawingMethods, aiContextMethods, menusMethods, toolbarMethods, windowControlsMethods, commandsMethods, keysMethods, layoutMethods, deepReviewMethods, trashMethods);
