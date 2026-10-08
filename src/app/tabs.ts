// Abas: abrir, fechar, trocar, reordenar, menus e sessão (reabre as abas ao iniciar).

import type { App } from "./app";
import { rememberDocument } from "../broker/ghost/memory";
import * as files from "../files";
import { newTab, tabLabel, type DocTab } from "../tabs";
import { plainText } from "../word/schema";
import { revealItemInDir } from "@tauri-apps/plugin-opener";
import { $, h, toast, baseName, docDirOf, stripExt, copyText, loadJSON, saveJSON, fmtTime } from "../util";

export const tabsMethods = {
  /** Reabre as abas da sessão anterior; sem sessão, cai no rascunho mais recente. */
  async restoreSession(this: App): Promise<void> {
    const saved = loadJSON<{ paths: string[]; active: string | null; drafts: string[] } | null>("mdc.session", null);
    let restored = 0;
    if (saved && Array.isArray(saved.paths)) {
      let activateTab: DocTab | null = null;
      for (const p of saved.paths) {
        try {
          const wasDraft = saved.drafts?.includes(p) ?? false;
          const tab = /\.docx$/i.test(p) ? await this.addDocxTab(p, wasDraft) : this.addTabFor(p, await files.loadDoc(p), wasDraft);
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
  },

  /** Antes das abas, o app guardava só o último rascunho; ainda recuperamos ele. */
  async restoreLegacyDraft(this: App): Promise<void> {
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
  },

  /** Cria uma aba (sem ativá-la) para um arquivo já lido. */
  addTabFor(this: App, path: string | null, content: string, isDraft = false): DocTab {
    const tab = newTab(this.editor.createState(content), {
      path,
      isDraft,
      statusSaved: isDraft ? "Rascunho guardado no app" : `Aberto às ${fmtTime()}`,
    });
    this.tabs.push(tab);
    return tab;
  },

  /** A aba inicial vazia some quando outras abas assumem o lugar dela. */
  dropPristineStartTab(this: App): void {
    const first = this.tabs[0];
    if (!first || this.tabs.length < 2 || first !== this.tab) return;
    if (first.path || first.dirty || this.textOf(first).length > 0) return;
    this.tabs = this.tabs.filter((t) => t !== first);
    this.tab = this.tabs[0];
  },

  textOf(this: App, tab: DocTab): string {
    if (tab.kind === "word") return tab === this.tab ? this.wordHost.text() : plainText(tab.word!.state.doc);
    return tab === this.tab ? this.editor.getText() : tab.state.doc.toString();
  },

  /** Guarda o estado da aba ativa (texto/undo/rolagem) antes de sair dela. */
  snapshotTab(this: App): void {
    if (this.tab.kind === "word") {
      this.wordHost.snapshot(this.tab.word!);
    } else {
      this.tab.state = this.editor.getState();
      this.tab.scrollTop = this.editor.scrollTop();
    }
    // a sugestão de palavras aprende com o que foi escrito (fica só neste computador)
    if (this.tab.kind !== "settings" && this.copilot) rememberDocument(this.tab.id, this.textOf(this.tab));
  },

  /** Torna a aba indicada a ativa e redesenha tudo que depende do documento. */
  async activate(this: App, target: DocTab): Promise<void> {
    if (target !== this.tab) {
      this.snapshotTab();
      this.tab = target;
    }
    if (target.kind === "word") {
      this.enterWord(target);
      return;
    }
    this.leaveWord();
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
  },

  /** Atualiza título, barra de abas, rodapé, contagens e estrutura. */
  afterTabChange(this: App): void {
    this.refreshTitle();
    this.refreshPath();
    this.setSaveState();
    this.updateStats();
    this.renderOutline();
    this.saveSession();
    this.sidebar?.render();
  },

  saveSession(this: App): void {
    const withPath = this.tabs.filter((t) => t.path);
    saveJSON("mdc.session", {
      paths: withPath.map((t) => t.path!),
      drafts: withPath.filter((t) => t.isDraft).map((t) => t.path!),
      active: this.tab.path,
    });
  },

  /** Desenha a fileira de abas (documentos + Configurações, se aberta). */
  renderTabs(this: App): void {
    if (!this.tabBar) return;
    const list = this.settingsTab ? [...this.tabs, this.settingsTab] : this.tabs;
    this.tabBar.render(list, this.showingSettings && this.settingsTab ? this.settingsTab.id : this.tab.id);
  },

  activeTabId(this: App): string {
    return this.showingSettings && this.settingsTab ? this.settingsTab.id : this.tab.id;
  },

  selectTab(this: App, id: string): void {
    if (this.settingsTab && id === this.settingsTab.id) {
      this.showSettings();
      return;
    }
    this.hideHome();
    void this.switchTo(id);
  },

  async switchTo(this: App, id: string): Promise<void> {
    this.hideSettings();
    this.hideHome();
    const target = this.tabs.find((t) => t.id === id);
    if (!target || target === this.tab || this.switching) return;
    this.switching = true;
    try {
      await this.autosave(); // grava a aba de onde estamos saindo
      await this.activate(target);
    } finally {
      this.switching = false;
    }
  },

  async switchRelative(this: App, step: number): Promise<void> {
    if (this.tabs.length < 2) return;
    const i = this.tabs.indexOf(this.tab);
    await this.switchTo(this.tabs[(i + step + this.tabs.length) % this.tabs.length].id);
  },

  reorderTabs(this: App, ids: string[]): void {
    const byId = new Map(this.tabs.map((t) => [t.id, t]));
    const next = ids.map((id) => byId.get(id)).filter((t): t is DocTab => !!t);
    if (next.length === this.tabs.length) this.tabs = next;
    this.saveSession();
  },

  /** Fecha a aba. Nada de perguntas: o que não está salvo vira rascunho e fica em "Recentes". */
  async closeTab(this: App, id: string): Promise<void> {
    if (this.settingsTab && id === this.settingsTab.id) {
      this.closeSettings();
      return;
    }
    const tab = this.tabs.find((t) => t.id === id);
    if (!tab || this.switching) return;
    const isCurrent = tab === this.tab;
    if (tab.kind === "word") {
      if (!(await this.prepareCloseWord(tab))) return;
    } else if (isCurrent) await this.autosave();
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
  },

  async reopenClosedTab(this: App): Promise<void> {
    while (this.closedTabs.length) {
      const p = this.closedTabs.pop()!;
      if (this.tabs.some((t) => t.path === p)) continue;
      if (await this.openPath(p)) return;
    }
    toast("Nenhuma aba fechada para reabrir.", "info", 2200);
  },

  async closeOthers(this: App, keep: DocTab, onlyRight = false): Promise<void> {
    const start = this.tabs.indexOf(keep);
    const victims = this.tabs.filter((t, i) => t !== keep && (!onlyRight || i > start));
    if (victims.includes(this.tab)) await this.switchTo(keep.id);
    for (const v of victims) await this.closeTab(v.id);
  },

  async renameTab(this: App, id: string, value: string): Promise<void> {
    const tab = this.tabs.find((t) => t.id === id);
    if (!tab) return;
    if (tab !== this.tab) await this.switchTo(id);
    await this.applyTitle(value);
  },

  openTabMenu(this: App, id: string, x: number, y: number): void {
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
  },

  async duplicateTab(this: App, tab: DocTab): Promise<void> {
    const copy = this.addTabFor(null, this.textOf(tab));
    copy.title = `${tabLabel(tab)} (cópia)`;
    copy.dirty = true;
    await this.switchTo(copy.id);
  },

  /** Menu "Recentes": arquivos recentes que não estão abertos e rascunhos guardados no app. */
  /** Menu do "+" das abas: escolher o tipo de arquivo novo (documento, planilha ou apresentação). */
  openNewMenu(this: App, anchor: HTMLElement): void {
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
      this.ddItem(menu, { icon: "i-doc", label: "Documento Markdown", hint: ".md", onPick: () => void this.newDoc() });
      this.ddItem(menu, { icon: "i-word", label: "Documento Word (.docx)", hint: "páginas, fontes, tabelas", onPick: () => void this.newWordDoc() });
      this.ddItem(menu, { icon: "i-grid", label: "Planilha", hint: "Excel (tabela)", onPick: () => criar("Planilha", modeloPlanilha) });
      this.ddItem(menu, { icon: "i-eye", label: "Apresentação", hint: "PowerPoint (slides, F5)", onPick: () => criar("Apresentação", modeloDeck) });
    });
  },

  async openRecentsMenu(this: App, anchor: HTMLElement): Promise<void> {
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
  },

  async newDoc(this: App): Promise<void> {
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
  },

  /** Cria um documento novo dentro da pasta de um projeto e abre numa aba. */
  async newDocIn(this: App, dir: string): Promise<void> {
    try {
      const target = await files.uniqueMdPath(dir, "novo-documento");
      await files.saveDoc(target, "");
      await this.openPath(target);
      void this.sidebar.refresh();
      this.tabBar.beginRename(this.tab.id);
    } catch (e) {
      toast("Não consegui criar o documento: " + e, "err", 5000);
    }
  },

  addRecent(this: App, path: string): void {
    this.recents = [{ path, at: Date.now() }, ...this.recents.filter((r) => r.path.toLowerCase() !== path.toLowerCase())].slice(0, 12);
    saveJSON("mdc.recents", this.recents);
  },
};
