// Rodapé, título da janela, estrutura, tema e divisor entre editor e pré-visualização.

import type { App } from "./app";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { $, baseName, docDirOf, clamp, toast, saveJSON } from "../util";

export const layoutMethods = {
  renderOutline(this: App): void {
    this.outline?.render();
  },

  updateStats(this: App): void {
    if (this.tab.kind === "xlsx") {
      this.excelStatus();
      return;
    }
    if (this.tab.kind === "word") {
      const w = this.wordHost.stats();
      $("#st-words").textContent = `${w.words} ${w.words === 1 ? "palavra" : "palavras"}`;
      $("#st-chars").textContent = `${w.chars} caracteres`;
      $("#st-lines").textContent = `${w.pages} ${w.pages === 1 ? "página" : "páginas"}`;
      $("#st-cursor").textContent = `Página ${w.page}`;
      const badge = document.querySelector<HTMLElement>("#st-writing");
      if (badge) {
        badge.hidden = w.issues === 0;
        badge.textContent = `${w.issues} aviso${w.issues === 1 ? "" : "s"} de escrita`;
      }
      return;
    }
    const text = this.editor.getText();
    const words = (text.match(/[\p{L}\p{N}_'-]+/gu) || []).length;
    const lines = text ? text.split("\n").length : 1;
    $("#st-words").textContent = `${words} ${words === 1 ? "palavra" : "palavras"}`;
    $("#st-chars").textContent = `${text.length} caracteres`;
    $("#st-lines").textContent = `${lines} ${lines === 1 ? "linha" : "linhas"}`;
    $("#st-cursor").textContent = `Ln ${this.cursor.line}, Col ${this.cursor.col}`;
  },

  setSaveState(this: App): void {
    const el = $("#save-state");
    const autosaveOn = this.settings.autosaveOn;
    if (!autosaveOn) {
      el.textContent = this.dirty
        ? "Alterações não salvas (Auto-salvar desligado)"
        : "Salvo (Auto-salvar desligado)";
    } else {
      el.textContent = this.dirty
        ? "Alterações não salvas"
        : this.isDraft
          ? "Rascunho (no app)"
          : this.statusSaved;
    }
    el.classList.toggle("dirty", this.dirty);
    this.updateAutosaveUI();
  },

  updateAutosaveUI(this: App): void {
    const btn = document.querySelector<HTMLButtonElement>("#tb-autosave-btn");
    const badge = document.querySelector<HTMLElement>("#tb-autosave-badge");
    const text = document.querySelector<HTMLElement>("#tb-autosave-text");
    const iconUse = document.querySelector<SVGUseElement>("#tb-autosave-ic use");
    if (!btn || !badge || !text) return;

    const on = this.settings.autosaveOn;
    btn.setAttribute("aria-checked", on ? "true" : "false");
    btn.classList.toggle("is-active", on);

    badge.classList.toggle("is-on", on);
    badge.classList.toggle("is-off", !on);
    badge.classList.toggle("is-dirty", on && this.dirty);

    if (!on) {
      btn.title = "Salvamento Automático: Desativado (clique para ligar)";
      badge.title = "Salvamento Automático desligado. Pressione Ctrl+S para salvar.";
      text.textContent = "Desativado";
      if (iconUse) iconUse.setAttribute("href", "#i-cloud-off");
    } else {
      btn.title = "Salvamento Automático: Ativado (clique para desligar)";
      if (this.saving || this.dirty) {
        badge.title = this.saving ? "Salvando documento…" : "Salvando alterações pendentes…";
        text.textContent = "Salvando…";
        if (iconUse) iconUse.setAttribute("href", "#i-cloud");
      } else {
        badge.title = this.statusSaved || "Todas as alterações foram salvas";
        text.textContent = "Salvo";
        if (iconUse) iconUse.setAttribute("href", "#i-check");
      }
    }
    this.refreshPath();
  },

  toggleAutosave(this: App, force?: boolean): void {
    const next = force !== undefined ? force : !this.settings.autosaveOn;
    this.settings.autosaveOn = next;
    saveJSON("mdc.settings", this.settings);
    this.setSaveState();
    if (next) {
      toast("Salvamento automático ativado", "ok", 2400);
      if (this.dirty) {
        void this.autosave();
      }
    } else {
      toast("Salvamento automático desativado. Salve com Ctrl+S.", "info", 2800);
    }
  },

  refreshTitle(this: App): void {
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
  },

  refreshPath(this: App): void {
    const btn = $("#st-path") as HTMLButtonElement | null;
    const topBtn = document.querySelector<HTMLButtonElement>("#tb-saved-path");
    const topText = document.querySelector<HTMLElement>("#tb-saved-path-text");

    if (!this.path) {
      if (btn) btn.hidden = true;
      if (topBtn) topBtn.hidden = true;
      return;
    }

    const dirText = this.isDraft ? "Rascunho do app" : docDirOf(this.path);
    const fullTitle = this.isDraft
      ? `Rascunho guardado em: ${docDirOf(this.path)} (clique para abrir a pasta)`
      : `${this.path} (clique para mostrar na pasta)`;

    if (btn) {
      btn.hidden = false;
      btn.textContent = dirText;
      btn.title = this.isDraft
        ? `Rascunho guardado em: ${docDirOf(this.path)} (clique para abrir a pasta)`
        : `Mostrar ${baseName(this.path)} na pasta`;
    }

    if (topBtn && topText) {
      // Exibe na topbar à direita quando salvo ou quando tem caminho do arquivo
      const on = this.settings.autosaveOn;
      const isSaving = on && (this.saving || this.dirty);
      topBtn.hidden = isSaving;
      topText.textContent = dirText || baseName(this.path);
      topBtn.title = fullTitle;
    }
  },

  initialDark(this: App): boolean {
    const saved = localStorage.getItem("mdc.theme");
    if (saved === "dark") return true;
    if (saved === "light") return false;
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  },

  applyTheme(this: App, dark: boolean, rerender = true): void {
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
  },

  setupSplitter(this: App): void {
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
  },

  syncPreviewScroll(this: App): void {
    const sc = this.editor.view.scrollDOM;
    const max = sc.scrollHeight - sc.clientHeight;
    if (max <= 0) return;
    const p = sc.scrollTop / max;
    const pv = $("#preview-wrap");
    pv.scrollTop = p * (pv.scrollHeight - pv.clientHeight);
  },
};
