// Páginas que ocupam o lugar do editor: Configurações, Início e boas-vindas.

import type { App } from "./app";
import { welcomeHtml } from "../md/preview";
import { setTone } from "../broker/writing";
import { newTab } from "../tabs";
import { listVersions, clearHistory } from "../history";
import { openPresentation } from "../powerpoint/presenter";
import { renderSettingsPage, type SettingsSection } from "../settingsPage";
import { renderHomePage } from "../homePage";
import { $, h, toast, loadJSON, saveJSON } from "../util";

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
      repairAlignments: () => this.repairAlignments(),
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
