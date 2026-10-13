// Páginas que ocupam o lugar do editor: Configurações, Início e boas-vindas.

import type { App } from "./app";
import { welcomeHtml } from "../md/preview";
import { setTone } from "../broker/writing";
import { newTab } from "../tabs";
import { listVersions, clearHistory } from "../history";
import { listCommits, clearCommits } from "../snapshots";
import * as backup from "../backup";
import { openPresentation } from "../powerpoint/presenter";
import { renderSettingsPage, type SettingsSection, type HistoricoVisao, type CopiaDiscoResumo } from "../settingsPage";
import { renderHomePage } from "../homePage";
import { appIconAtual, definirIconeApp } from "./appIcon";
import { $, h, toast, loadJSON, saveJSON, baseName } from "../util";

export const pagesMethods = {
  /** Abre a aba de Configurações (uma só): mostra a página no lugar do editor. */
  showSettings(this: App, section: SettingsSection = "escrita"): void {
    if (this.showingHome) this.hideHome();
    if (!this.settingsTab) this.settingsTab = newTab(this.tab.state, { kind: "settings" });
    this.showingSettings = true;
    document.body.classList.add("settings-open");
    this.closeMenus();
    renderSettingsPage($("#settings-page"), this.settingsContext(), section);
    $("#settings-page").hidden = false;
    this.renderTabs();
  },

  hideSettings(this: App): void {
    if (!this.showingSettings) return;
    this.showingSettings = false;
    document.body.classList.remove("settings-open");
    $("#settings-page").hidden = true;
    this.renderTabs();
  },

  closeSettings(this: App): void {
    this.hideSettings();
    this.settingsTab = null;
    this.renderTabs();
    this.editor.focus();
  },

  settingsContext(this: App): import("../settingsPage").SettingsCtx {
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
        if (p.autosaveOn !== undefined) {
          this.setSaveState();
        }
        // mudou algo do backup: o Rust passa a valer com a nova política
        if (
          p.backupOn !== undefined ||
          p.backupRoot !== undefined ||
          p.backupProfile !== undefined ||
          p.backupCopies !== undefined ||
          p.backupDays !== undefined
        ) {
          void this.syncBackupConfig();
        }
        if (p.backupWarnMissing !== undefined || p.backupOn !== undefined) {
          this.setBackupState("ok", "");
          if (this.settings.backupOn) void this.checkMissing();
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
      animacao: () => this.initialAnimacao(),
      setAnimacao: (nivel) => this.applyAnimacao(nivel),
      cantos: () => this.initialCantos(),
      setCantos: (formato) => this.applyCantos(formato),
      flag: (cls) => document.body.classList.contains(cls),
      toggleFlag: (cls) => this.toggle(cls),
      drawStyle: () => (loadJSON<string>("mdc.drawstyle", "image") === "text" ? "text" : "image"),
      setDrawStyle: (style) => this.setDrawStyle(style),
      historicoVisao: async (): Promise<HistoricoVisao> => {
        const path = this.path;
        const versoes = path ? await listVersions(path) : [];
        const commits = path ? await listCommits(path) : [];
        const ultima = versoes[0];
        const ultimoCommit = commits[commits.length - 1];
        const entry = path ? await backup.listar(path) : null;
        const raizApp = backup.temBackend() ? await backup.pastaDoApp().catch(() => "") : "";
        const raizUsuario = this.settings.backupRoot ?? "";
        const indice = await backup.indice();
        const local = (raizDaCopia: string): CopiaDiscoResumo["local"] => {
          const r = raizDaCopia.toLowerCase();
          if (raizUsuario && r === raizUsuario.toLowerCase()) return "usuario";
          if (raizApp && r === raizApp.toLowerCase()) return "app";
          return "outra";
        };
        return {
          doc: path,
          nome: path ? baseName(path) : "",
          versoes: {
            total: versoes.length,
            marcadas: versoes.filter((v) => v.manual).length,
            ultimaEm: ultima?.at ?? null,
            ultimoNome: ultima ? ultima.label || (ultima.manual ? "marcada à mão" : "automática") : "",
            ultimoTam: ultima?.text.length ?? 0,
          },
          alteracoes: {
            total: commits.length,
            ultimaEm: ultimoCommit?.at ?? null,
            ultimoResumo: ultimoCommit ? (ultimoCommit.text !== undefined ? "marco do documento" : ultimoCommit.summary) : "",
            ancora: ultimoCommit?.text !== undefined,
          },
          copias: {
            total: entry?.copies.length ?? 0,
            bytes: entry?.bytes ?? 0,
            ultimaEm: entry?.copies[0]?.at ?? null,
          },
          copiasDetalhe: (entry?.copies ?? []).map((c) => ({
            root: c.root,
            name: c.name,
            stamp: c.stamp,
            bytes: c.bytes,
            at: c.at,
            protection: c.protection,
            local: local(c.root),
          })),
          outros: indice.files
            .filter((f) => f.original.toLowerCase() !== (path ?? "").toLowerCase())
            .sort((a, b) => b.newest - a.newest)
            .map((f) => ({ original: f.original, copias: f.copies, bytes: f.bytes, newest: f.newest })),
          sumidos: (await backup.sumidos()).length,
          raizApp,
        };
      },
      apagarHistoricoDoDoc: async () => {
        if (!this.path) return;
        const path = this.path;
        await clearHistory(path);
        await clearCommits(path);
        await backup.apagarLog(path);
        toast("Versões e alterações deste documento apagadas. As cópias em disco ficaram.", "info", 3800);
      },
      restaurarCopia: (path, root, name) => this.restaurarCopia(path, root, name),
      abrirRecuperacao: () => this.openMissingBackups(),
      openHistory: (aba) => void this.openHistory(aba),
      repairAlignments: () => this.repairAlignments(),
      appIcon: () => appIconAtual(),
      setAppIcon: (v) => definirIconeApp(v),
      menu: (ancora, opcoes) =>
        this.openMenu(ancora, (menu) => {
          for (const o of opcoes) this.ddItem(menu, { label: o.rotulo, checked: o.ativo, onPick: o.escolher });
        }),
    };
  },

  /** Abre o Início (Hub de documentos: Word, Excel, Markdown, PowerPoint, recentes e modelos). */
  showHome(this: App): void {
    if (this.showingSettings) this.hideSettings();
    this.showingHome = true;
    document.body.classList.add("home-open");
    this.closeMenus();
    this.sidebar?.setHomeActive(true);
    renderHomePage($("#home-page"), this.homeContext());
    $("#home-page").hidden = false;
  },

  hideHome(this: App): void {
    if (!this.showingHome) return;
    this.showingHome = false;
    document.body.classList.remove("home-open");
    this.sidebar?.setHomeActive(false);
    $("#home-page").hidden = true;
    this.editor?.focus();
  },

  toggleHome(this: App): void {
    if (this.showingHome) {
      this.hideHome();
    } else {
      this.showHome();
    }
  },

  showWelcome(this: App): void {
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
  },

  /** Módulo de apresentações: mostra o documento como slides (cada slide após uma linha ---). */
  openSlides(this: App): void {
    openPresentation(this.editor.getText(), this.title ?? "Apresentação");
  },
};
