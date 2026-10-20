// Abas: abrir, fechar, trocar, reordenar, menus e sessão (reabre as abas ao iniciar).

import type { App } from "./app";
import { fileIcon, kindOfPath } from "../fileIcons";
import { teclaVisivel } from "./keymap";
import { rememberDocument } from "../broker/ghost/memory";
import * as files from "../files";
import { newTab, tabLabel, type DocTab } from "../tabs";
import { plainText } from "../word/schema";
import { deckToMarkdown } from "../powerpoint/markdown";
import type { PowerPointTabData } from "../powerpoint/powerpoint";
import type { ExcelTabData } from "../excel/host";
import { revealItemInDir } from "@tauri-apps/plugin-opener";
import { $, h, toast, baseName, docDirOf, stripExt, copyText, loadJSON, saveJSON, fmtTime, fmtAgo } from "../util";
import { abrirEmNovaJanela } from "./novaJanela";
import type { PedidoDeJanela } from "./docNaUrl";

export const tabsMethods = {
  /** Reabre as abas da sessão anterior; sem sessão, o app fica no Início (o Hub). */
  async restoreSession(this: App): Promise<void> {
    // No NAVEGADOR não há caminhos de arquivo: a sessão anterior é o TEXTO das abas
    // guardado no localStorage pelo autosave. Sem isso, recarregar a página perdia
    // todos os documentos abertos (o relato dos 3 documentos).
    if (!files.emTauri()) {
      const salvo = loadJSON<{ abas: { texto: string; status?: string }[]; ativa: number } | null>("mdc.browser.session", null);
      const abas = (salvo?.abas ?? []).filter((a) => a.texto.trim() !== "");
      if (abas.length) {
        for (const a of abas) {
          const t = this.addTabFor(null, a.texto);
          t.statusSaved = a.status ?? "Salvo neste navegador";
        }
        this.dropPristineStartTab();
        const idx = Math.max(0, Math.min(salvo?.ativa ?? 0, this.tabs.length - 1));
        await this.activate(this.tabs[idx] ?? this.tabs[this.tabs.length - 1]);
        toast(`${abas.length} documento${abas.length === 1 ? "" : "s"} da sessão do navegador reaberto${abas.length === 1 ? "" : "s"}.`, "info", 3600);
        return;
      }
    }
    const saved = loadJSON<{ paths: string[]; active: string | null; drafts: string[] } | null>("mdc.session", null);
    let restored = 0;
    if (saved && Array.isArray(saved.paths)) {
      let activateTab: DocTab | null = null;
      for (const p of saved.paths) {
        try {
          const wasDraft = saved.drafts?.includes(p) ?? false;
          const tab = /\.docx$/i.test(p)
            ? await this.addDocxTab(p, wasDraft)
            : /\.pptx$/i.test(p)
              ? await this.addPptxTab(p, wasDraft)
              : /\.xlsx$/i.test(p) || /\.xlsm$/i.test(p)
                ? await this.addXlsxTab(p, wasDraft)
                : this.addTabFor(p, await files.loadDoc(p), wasDraft);
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
    // Nada para reabrir: o app fica no INÍCIO (o Hub) — como quando se fecha a última aba — em vez
    // de abrir sozinho o último rascunho (o relato: "não tem nada aberto e ele abre…"). Os
    // rascunhos continuam guardados e à mão em **Recentes ▸ "Rascunhos guardados no app"**.
    this.showHome();
    // E sem "Sem título" na fileira: o documento de trabalho fica solto (o editor começa vazio) e
    // a primeira aba nasce quando a pessoa criar ou abrir um arquivo.
    if (!this.path && !this.dirty && this.tabs.length === 1 && this.tabs[0] === this.tab) {
      this.tabs = [];
      this.afterTabChange();
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
    // O editor ainda mostra a aba vazia que saiu: carrega a que virou ativa para o
    // próximo snapshot não gravar o vazio por cima do texto dela (o primeiro documento
    // da sessão reaberta perdia o texto ao ativar outra aba em seguida).
    this.editor.loadState(this.tab.state, this.tab.scrollTop);
  },

  textOf(this: App, tab: DocTab): string {
    if (tab.kind === "word") return tab === this.tab ? this.wordHost.text() : plainText(tab.word!.state.doc);
    if (tab.kind === "ppt") return tab === this.tab ? this.pptHost.text() : pptMarkdown(tab.ppt!);
    if (tab.kind === "xlsx") return tab === this.tab ? this.excelHost.text() : planilhaTexto(tab.xlsx!);
    return tab === this.tab ? this.editor.getText() : tab.state.doc.toString();
  },

  /** Guarda o estado da aba ativa (texto/undo/rolagem) antes de sair dela. */
  snapshotTab(this: App): void {
    if (this.tab.kind === "word") {
      this.wordHost.snapshot(this.tab.word!);
    } else if (this.tab.kind === "ppt") {
      this.tab.ppt = this.pptHost.snapshot();
    } else if (this.tab.kind === "xlsx") {
      this.tab.xlsx = this.excelHost.snapshot();
    } else {
      this.tab.state = this.editor.getState();
      this.tab.scrollTop = this.editor.scrollTop();
    }
    // a sugestão de palavras aprende com o que foi escrito (fica só neste computador)
    if (this.tab.kind !== "settings" && this.copilot) rememberDocument(this.tab.id, this.textOf(this.tab));
  },

  /** Torna a aba indicada a ativa e redesenha tudo que depende do documento. */
  async activate(this: App, target: DocTab): Promise<void> {
    const antes = this.tab;
    if (target !== this.tab) {
      this.snapshotTab();
      this.tab = target;
    }
    if (antes !== target) this.animarConteudoDaAba(antes, target);
    if (target.kind === "word") {
      this.leavePpt();
      this.leaveXlsx();
      this.enterWord(target);
      return;
    }
    if (target.kind === "ppt") {
      this.leaveWord();
      this.leaveXlsx();
      this.enterPpt(target);
      return;
    }
    if (target.kind === "xlsx") {
      this.leaveWord();
      this.leavePpt();
      this.enterXlsx(target);
      return;
    }
    this.leaveWord();
    this.leavePpt();
    this.leaveXlsx();
    this.editor.loadState(target.state, target.scrollTop);
    this.outline?.useCollapsed(target.outlineCollapsed);
    this.outline?.setCursorLine(target.cursor.line);
    this.setPreviewPath(target.path);
    this.afterTabChange();
    this.editor.setIssues(target.issues);
    this.updateWritingBadge();
    this.checkWritingSoon();
    this.translationDocChanged(true);
    // o log de alterações começa do texto que está abrindo (senão a primeira tecla
    // viraria um patch gigante entre dois documentos diferentes)
    this.markText(this.editor.getText());
    await this.preview.render(this.editor.getText());
    this.editor.focus();
  },

  /**
   * A troca de abas ganha vida: o documento desliza do lado de onde a aba veio.
   * A classe é reaplicada com um reflow porque o render das abas recria os elementos
   * (e o painel pode já estar com a classe da troca anterior).
   */
  animarConteudoDaAba(this: App, de: DocTab, para: DocTab): void {
    const iDe = this.tabs.indexOf(de);
    const iPara = this.tabs.indexOf(para);
    const dir = iDe >= 0 && iPara >= 0 && iPara < iDe ? "esq" : "dir";
    const seletor =
      para.kind === "word" ? "#word-pane" : para.kind === "xlsx" ? "#excel-pane" : para.kind === "ppt" ? "#powerpoint-pane" : "#editor-wrap";
    const alvo = document.querySelector<HTMLElement>(seletor);
    if (!alvo) return;
    alvo.classList.remove("troca-conteudo-dir", "troca-conteudo-esq");
    void alvo.offsetWidth; // reinicia a animação mesmo quando a classe já estava
    alvo.classList.add(`troca-conteudo-${dir}`);
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
    // janela de um documento só (aba arrastada para fora): ela não manda na sessão das outras
    if (this.janelaDeDocumento) return;
    const withPath = this.tabs.filter((t) => t.path);
    saveJSON("mdc.session", {
      paths: withPath.map((t) => t.path!),
      drafts: withPath.filter((t) => t.isDraft).map((t) => t.path!),
      active: this.tab.path,
    });
    this.saveBrowserTabs();
  },

  /**
   * Sessão do NAVEGADOR: sem arquivos, guarda o TEXTO de todas as abas Markdown no
   * localStorage a cada edição/ troca de aba. É o que faz um reload não perder os
   * documentos abertos (no Tauri as abas têm caminho e a sessão normal resolve).
   */
  saveBrowserTabs(this: App): boolean {
    if (files.emTauri()) return true;
    const abas: { texto: string; status?: string }[] = [];
    let ativa = 0;
    for (const t of this.tabs) {
      if (t.kind && t.kind !== "doc") continue;
      const texto = this.textOf(t);
      if (!texto.trim() && !t.path) continue; // aba inicial vazia não entra na sessão
      if (t === this.tab) ativa = abas.length;
      abas.push({ texto, status: t.statusSaved });
    }
    // Só a aba inicial vazia: é o começo do app — não apaga a sessão anterior.
    if (!abas.length && this.tabs.length <= 1) return true;
    // Sem passar pelo saveJSON: aqui a falha importa (o selo precisa saber se gravou).
    try {
      localStorage.setItem("mdc.browser.session", JSON.stringify({ abas, ativa, at: Date.now() }));
      return true;
    } catch {
      return false; // cota cheia/armazenamento indisponível: o autosave marca "não salvo"
    }
  },

  /**
   * Abre a aba numa janela própria — o gesto de arrastar a aba para fora da janela e o item
   * "Abrir em nova janela" do menu. O documento é persistido ANTES (é do disco/rascunho que a
   * janela nova lê); só depois a aba sai daqui. Cancelar o "salvar?" não move nada.
   */
  async detachTab(this: App, id: string): Promise<void> {
    const tab = this.tabs.find((t) => t.id === id);
    if (!tab || tab.kind === "settings" || this.switching) return;
    // 1) persiste como no fechar: arquivos seus perguntam; rascunhos são gravados
    if (tab.kind === "word") {
      if (!(await this.prepareCloseWord(tab))) return;
    } else if (tab.kind === "ppt") {
      if (!(await this.prepareClosePpt(tab))) return;
    } else if (tab.kind === "xlsx") {
      if (!(await this.prepareCloseExcel(tab))) return;
    } else if (tab === this.tab) {
      if (tab.dirty && !tab.path && !(await this.ensureSaved())) return;
      if (tab.dirty && tab.path) {
        try {
          await files.saveDoc(tab.path, this.editor.getText());
          tab.dirty = false;
        } catch {
          return; // sem gravar, a janela nova abriria uma versão velha
        }
      }
    } else if (tab.dirty && tab.path) {
      try {
        await files.saveDoc(tab.path, this.textOf(tab));
        tab.dirty = false;
      } catch {
        return;
      }
    }
    // 2) a janela nova precisa de um caminho para abrir
    if (!tab.path) {
      toast("Salve o documento antes de abrir em outra janela.", "info", 5000);
      return;
    }
    // 3) abre a janela e só então tira a aba daqui (já está gravada: não pergunta de novo)
    if (!abrirEmNovaJanela({ path: tab.path, draft: tab.isDraft }, tabLabel(tab))) return;
    await this.closeTab(id);
  },

  /** Janela própria: abre só o documento pedido na URL — não restaura a sessão das outras. */
  async abrirNaJanela(this: App, pedido: PedidoDeJanela): Promise<void> {
    try {
      const p = pedido.path;
      let novo: DocTab | null = null;
      if (/\.docx$/i.test(p)) novo = await this.addDocxTab(p, pedido.draft);
      else if (/\.pptx$/i.test(p)) novo = await this.addPptxTab(p, pedido.draft);
      else if (/\.xlsx$/i.test(p) || /\.xlsm$/i.test(p)) novo = await this.addXlsxTab(p, pedido.draft);
      else novo = this.addTabFor(p, await files.loadDoc(p), pedido.draft);
      if (novo) {
        await this.switchTo(novo.id);
        // a aba inicial vazia não fica numa janela de um documento só
        this.dropPristineStartTab();
        this.renderTabs();
      }
    } catch {
      toast("Não consegui abrir o documento nesta janela.", "err", 6000);
    }
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
    // Trocar de aba com um aviso de salvar aberto cancela o aviso: ele é do documento
    // que ia ser fechado e não deve aparecer sobre a aba nova. (Antes ele ia junto; depois
    // travamos a troca, mas o usuário precisa poder consultar outro documento.)
    this.cancelarAvisoSalvar?.();
    this.switching = true;
    try {
      // lê o "sujo" ANTES do autosave (ele limpa a marca)
      const tinhaAlteracoes = this.dirty;
      await this.autosave(); // grava a aba de onde estamos saindo
      // cópia em disco ao sair de um documento com alterações
      this.backupOnLeave(this.path, tinhaAlteracoes);
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
    } else if (tab.kind === "ppt") {
      if (!(await this.prepareClosePpt(tab))) return;
    } else if (tab.kind === "xlsx") {
      if (!(await this.prepareCloseExcel(tab))) return;
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
    // guarda uma cópia em disco do que foi alterado nesta aba antes de ela sair
    if (tab.path) void this.backupNow(tab.path, "fechar aba");
    const index = this.tabs.indexOf(tab);
    this.tabs = this.tabs.filter((t) => t !== tab);
    // Fechou o último documento: o app fica no Início, SEM um "Sem título" na fileira. O
    // documento de trabalho continua existindo "solto" (é o estado que o editor segura), mas
    // não é uma aba — a primeira nasce quando a pessoa criar ou abrir um arquivo.
    const fechouTudo = !this.tabs.length;
    if (fechouTudo) this.tab = newTab(this.editor.createState(""));
    if (isCurrent) {
      this.switching = true;
      try {
        await this.activate(this.tabs[Math.min(index, this.tabs.length - 1)] ?? this.tab);
      } finally {
        this.switching = false;
      }
    } else {
      this.afterTabChange();
    }
    // depois de ativar: `activate` mexe na tela e o Início tem que ficar por cima
    if (fechouTudo) this.showHome();
  },

  /** Fecha TODAS as abas de uma vez (o app fica no Início, sem "Sem título" na fileira). */
  async closeAll(this: App): Promise<void> {
    if (!this.tabs.length) {
      toast("Nenhum documento aberto.", "info", 2600);
      return;
    }
    const quantas = this.tabs.length;
    // de trás para frente: a última passa pelo fluxo normal, que já leva ao Início
    for (const t of [...this.tabs].reverse()) await this.closeTab(t.id);
    const fechadas = quantas - this.tabs.length;
    if (fechadas) toast(`${fechadas} aba${fechadas === 1 ? "" : "s"} fechada${fechadas === 1 ? "" : "s"}.`, "ok", 2600);
  },

  /**
   * Sem nenhum documento aberto (a fileira vazia e o Início à vista): os comandos de documento
   * avisam em vez de agir num documento que não está à vista. Devolve `true` quando avisou.
   */
  semDocumento(this: App): boolean {
    if (this.tabs.length) return false;
    toast("Nenhum documento aberto — crie ou abra um no Início.", "info", 3400);
    return true;
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
      { label: "Renomear", hint: teclaVisivel("renomear"), run: () => this.tabBar.beginRename(id) },
      { label: "Duplicar aba", run: () => void this.duplicateTab(tab) },
      { label: "Abrir em nova janela", run: () => void this.detachTab(id) },
    ];
    if (tab.path) {
      items.push(
        { label: "Mostrar na pasta", run: () => void revealItemInDir(tab.path!).catch(() => {}) },
        { label: "Copiar caminho", run: () => void copyText(tab.path!) }
      );
    }
    items.push(
      { label: "Fechar", hint: teclaVisivel("fechar-aba"), run: () => void this.closeTab(id), sep: true },
      { label: "Fechar as outras", run: () => void this.closeOthers(tab) },
      { label: "Fechar as da direita", run: () => void this.closeOthers(tab, true) },
      { label: "Fechar todos", hint: teclaVisivel("fechar-tudo"), run: () => void this.closeAll() }
    );
    this.openMenuAt(x, y, items);
  },

  async duplicateTab(this: App, tab: DocTab): Promise<void> {
    const copy = this.addTabFor(null, this.textOf(tab));
    copy.title = `${tabLabel(tab)} (cópia)`;
    copy.dirty = true;
    await this.switchTo(copy.id);
  },

  /** Menu do "+" das abas: escolher o tipo de arquivo novo (documento, planilha ou apresentação). */
  openNewMenu(this: App, anchor: HTMLElement): void {
    const criar = (rotulo: string, texto: string) => {
      this.closeMenus();
      const tab = newTab(this.editor.createState(texto), { path: null, isDraft: false, statusSaved: "Novo arquivo" });
      this.tabs.push(tab);
      this.selectTab(tab.id);
      toast(`${rotulo} criada — use Ctrl+Shift+S para salvar numa pasta sua.`, "ok", 3800);
    };
    const modeloDeck = [
      "# Capa",
      "",
      "Nome da empresa",
      "",
      "Seu nome · data",
      "",
      "> [notas] Abertura: cumprimente e apresente o tema.",
      "",
      "---",
      "",
      "## O que vamos ver",
      "",
      "- Primeiro ponto",
      "- Segundo ponto",
      "- Terceiro ponto",
      "",
      "> [notas] Leve um slide por ideia.",
      "",
      "---",
      "",
      "## Próximos passos",
      "",
      "- Ação e responsável",
      "- Prazo",
      "",
      "> [notas] Combine o próximo passo com a equipe.",
    ].join("\n");
    this.openMenu(anchor, (menu) => {
      menu.classList.add("recents-menu");
      this.ddItem(menu, { iconHtml: fileIcon("md"), label: "Documento Markdown", hint: ".md", onPick: () => void this.newDoc() });
      this.ddItem(menu, { iconHtml: fileIcon("word"), label: "Documento Word (.docx)", hint: "páginas, fontes, tabelas", onPick: () => void this.newWordDoc() });
      this.ddItem(menu, { iconHtml: fileIcon("excel"), label: "Planilha", hint: "Excel (.xlsx)", onPick: () => void this.newExcelDoc() });
      this.ddItem(menu, { iconHtml: fileIcon("ppt"), label: "Apresentação", hint: "PowerPoint (slides, F5)", onPick: () => void this.newPowerPointDoc() });
    });
  },

  /** Menu "Recentes": arquivos recentes que não estão abertos e rascunhos guardados no app. */
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

      // O corpo rola (a lista pode passar da tela); o rodapé de ações fica fixo embaixo.
      const body = h("div", { class: "rc-body" });
      const foot = h("div", { class: "rc-foot" });
      menu.append(body, foot);

      // Uma linha: ícone do tipo, nome com o "há quanto tempo" ao lado e, embaixo,
      // onde está (pasta ou "Rascunho do app"). Ao passar o mouse, o tempo dá lugar
      // ao × de tirar da lista.
      const row = (p: string, sub: string, when: number, forget: (() => void) | null) => {
        const btn = h("button", { class: "rc-item", type: "button", title: p });
        btn.innerHTML = fileIcon(kindOfPath(p));
        btn.append(
          h("span", { class: "rc-main" }, [
            h("span", { class: "rc-line" }, [
              h("span", { class: "rc-name", text: stripExt(baseName(p)) }),
              h("span", { class: "rc-time", text: fmtAgo(when) }),
            ]),
            h("span", { class: "rc-sub", text: sub, title: p }),
          ])
        );
        btn.addEventListener("click", () => {
          this.closeMenus();
          void this.openPath(p);
        });
        const wrap = h("div", { class: "rc-row" }, [btn]);
        if (forget) {
          const x = h("button", { class: "rc-x", type: "button", title: "Tirar da lista" });
          x.innerHTML = '<svg class="ic"><use href="#i-close"/></svg>';
          x.addEventListener("click", (e) => {
            e.stopPropagation();
            forget();
            wrap.remove();
          });
          wrap.append(x);
        }
        body.append(wrap);
      };

      const recents = this.recents.filter((r) => !open.has(r.path.toLowerCase()));
      body.append(h("div", { class: "dd-title", text: "Arquivos recentes" }));
      if (!recents.length) {
        const vazio = h("div", { class: "rc-empty" });
        vazio.innerHTML = '<svg class="ic"><use href="#i-clock"/></svg><span>Nenhum arquivo recente fora das abas abertas.</span>';
        body.append(vazio);
      }
      for (const r of recents) {
        row(r.path, docDirOf(r.path), r.at, () => {
          this.recents = this.recents.filter((x) => x.path !== r.path);
          saveJSON("mdc.recents", this.recents);
        });
      }
      if (drafts.length) {
        this.ddSep(body);
        body.append(h("div", { class: "dd-title", text: "Rascunhos guardados no app" }));
        for (const d of drafts) row(d.path, "Rascunho do app", d.modified_ms, null);
      }

      this.ddItem(foot, { icon: "i-open", label: "Abrir arquivo…", hint: teclaVisivel("abrir"), onPick: () => void this.openDocDialog() });
      if (this.closedTabs.length) {
        this.ddItem(foot, { icon: "i-undo", label: "Reabrir aba fechada", hint: teclaVisivel("reabrir-aba"), onPick: () => void this.reopenClosedTab() });
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
    // No navegador não há pasta padrão (nem Tauri para gravar): a aba fica como documento
    // novo e o autosave guarda o texto na sessão do navegador.
    if (!files.emTauri()) {
      tab.statusSaved = "Novo documento (navegador)";
      this.setSaveState();
      return;
    }
    // nasce salvo na pasta padrão do app (Documentos/mdOffice/Markdown), sem perguntar nada
    await this.nascerNoPadrao("md");
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

/** Projeção em texto de uma aba de apresentação (histórico, IA, corretor). */
function pptMarkdown(data: PowerPointTabData): string {
  return deckToMarkdown({ titulo: "", slides: data.slides });
}

/** Projeção em texto de uma aba de planilha (histórico, IA, corretor). */
function planilhaTexto(data: ExcelTabData): string {
  const linhas: string[] = [];
  for (const f of data.livro.folhas) {
    linhas.push(`## ${f.nome}`);
    const preenchidas = Object.entries(f.celulas).filter(([, c]) => !!c.texto);
    if (!preenchidas.length) {
      linhas.push("(aba vazia)", "");
      continue;
    }
    const largura = Math.max(...preenchidas.map(([r]) => r.replace(/\d/g, "").length));
    const primeiro = preenchidas[0][1].texto;
    linhas.push(primeiro);
    linhas.push("---");
    for (const [, c] of preenchidas.slice(1)) linhas.push(c.texto);
    linhas.push("");
    void largura;
  }
  return linhas.join("\n");
}
