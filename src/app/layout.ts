// Rodapé, título da janela, estrutura, tema e divisor entre editor e pré-visualização.

import type { App } from "./app";
import { getCurrentWindow } from "@tauri-apps/api/window";
import type { FormatoCantos, NivelAnimacao } from "../settingsPage";
import { modoDoSelo } from "./seloAutosave";
import { $, baseName, docDirOf, clamp, loadJSON, toast, saveJSON } from "../util";

export const layoutMethods = {
  renderOutline(this: App): void {
    this.outline?.render();
  },

  updateStats(this: App): void {
    // Sem nenhum documento aberto (a fileira vazia, o Início à vista): a barra de status
    // não fala de um documento que não existe.
    if (!this.tabs.length) {
      $("#st-words").textContent = "Nenhum documento aberto";
      $("#st-chars").textContent = "";
      $("#st-lines").textContent = "";
      $("#st-cursor").textContent = "";
      const badge = document.querySelector<HTMLElement>("#st-writing");
      if (badge) badge.hidden = true;
      return;
    }
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
    if (!this.tabs.length) {
      el.textContent = "Nenhum documento aberto";
      el.classList.remove("dirty");
      this.updateAutosaveUI();
      return;
    }
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

    // Com um arquivo SEU do Office, o autosave não escreve o arquivo — o selo precisa dizer
    // a verdade ("Não salvo") e não fingir uma gravação que nunca chega ao fim.
    const modo = modoDoSelo({
      ligado: on,
      kind: this.tab.kind,
      temPath: !!this.path,
      rascunho: this.isDraft,
      sujo: this.dirty,
      salvando: this.saving,
    });

    badge.classList.toggle("is-on", on);
    badge.classList.toggle("is-off", !on);
    badge.classList.toggle("is-dirty", modo === "salvando" && this.dirty);
    badge.classList.toggle("is-pendente", modo === "nao-salvo");

    if (modo === "desligado") {
      btn.title = "Salvamento Automático: Desativado (clique para ligar)";
      badge.title = "Salvamento Automático desligado. Pressione Ctrl+S para salvar.";
      text.textContent = "Desativado";
      if (iconUse) iconUse.setAttribute("href", "#i-cloud-off");
    } else if (modo === "nao-salvo") {
      btn.title = "Salvamento Automático: Ativado (clique para desligar)";
      badge.title =
        `Alterações não salvas em ${this.path ? baseName(this.path) : "documento"}: o salvamento automático ` +
        "não reescreve arquivos do Word, PowerPoint e Excel — recursos que o app ainda não entende podem " +
        "se perder. Salve com Ctrl+S.";
      text.textContent = "Não salvo";
      if (iconUse) iconUse.setAttribute("href", "#i-save");
    } else if (modo === "salvando") {
      btn.title = "Salvamento Automático: Ativado (clique para desligar)";
      badge.title = this.saving ? "Salvando documento…" : "Salvando alterações pendentes…";
      text.textContent = "Salvando…";
      if (iconUse) iconUse.setAttribute("href", "#i-cloud");
    } else {
      btn.title = "Salvamento Automático: Ativado (clique para desligar)";
      badge.title = this.statusSaved || "Todas as alterações foram salvas";
      text.textContent = "Salvo";
      if (iconUse) iconUse.setAttribute("href", "#i-check");
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
    // sem documento, a janela é só o app (nada de "Sem título.md")
    const name = this.path ? baseName(this.path) : `${this.title ?? "Sem título"}.md`;
    this.renderTabs();
    const title = this.tabs.length ? `${this.dirty ? "• " : ""}${name} — mdOffice` : "mdOffice";
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
      // Exibe na topbar à direita quando salvo ou quando tem caminho do arquivo. Com um arquivo
      // do Office pendente o caminho FICA à vista: o autosave não vai gravar (o selo diz
      // "Não salvo") e o chip é o atalho para mostrar o arquivo na pasta.
      const modo = modoDoSelo({
        ligado: this.settings.autosaveOn,
        kind: this.tab.kind,
        temPath: !!this.path,
        rascunho: this.isDraft,
        sujo: this.dirty,
        salvando: this.saving,
      });
      topBtn.hidden = modo === "salvando";
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

  /** Nível de animação guardado (sem valor salvo = padrão). */
  initialAnimacao(this: App): NivelAnimacao {
    const salvo = loadJSON<string>("mdc.animacao", "padrao");
    return salvo === "discreta" || salvo === "completa" ? salvo : "padrao";
  },

  /** Formato dos cantos guardado (sem valor salvo = redondo). */
  initialCantos(this: App): FormatoCantos {
    return loadJSON<string>("mdc.cantos", "redondos") === "quadrados" ? "quadrados" : "redondos";
  },

  /** Aplica o nível de animação no <html> (as regras ficam em styles/movimento.css). */
  applyAnimacao(this: App, nivel: NivelAnimacao): void {
    const el = document.documentElement;
    el.classList.toggle("anim-discreta", nivel === "discreta");
    el.classList.toggle("anim-completa", nivel === "completa");
    saveJSON("mdc.animacao", nivel);
  },

  /** Aplica o formato dos cantos no <html> (as regras ficam em styles/cantos.css). */
  applyCantos(this: App, cantos: FormatoCantos): void {
    const el = document.documentElement;
    // "redondos" é o desenho original do app: não leva classe nenhuma, para não
    // mexer no que já estava certo (botões-pílula, o botão Desenhar, os cartões)
    el.classList.toggle("cantos-quadrados", cantos === "quadrados");
    el.classList.remove("cantos-redondos");
    saveJSON("mdc.cantos", cantos);
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
    // Arrastar para além do limite da direita fecha a pré-visualização em vez de travar
    // no mínimo. O "além" é medido em pixels depois do limite, para encostar no mínimo
    // continuar sendo só redimensionar.
    const FECHAR_APOS = 40;
    let fechando = false;
    const fecharPreview = (pointerId: number) => {
      if (fechando) return;
      fechando = true;
      dragging = false;
      try {
        if (sp.hasPointerCapture(pointerId)) sp.releasePointerCapture(pointerId);
      } catch {
        /* ignora */
      }
      document.body.classList.remove("resizing");
      // guarda a largura mínima: ao reabrir, a prévia volta do tamanho que estava
      const v = body.style.getPropertyValue("--lg");
      if (v) localStorage.setItem("mdc.split", v);
      let feito = false;
      const concluir = () => {
        if (feito) return;
        feito = true;
        window.clearTimeout(relogio);
        previewPane.removeEventListener("animationend", aoTerminar);
        document.body.classList.remove("preview-saindo");
        if (!document.body.classList.contains("no-preview")) this.toggle("no-preview");
        fechando = false;
        toast("Pré-visualização fechada. Para reabrir, puxe a borda direita para a esquerda (ou Configurações → Aparência → Pré-visualização).", "info", 4200);
      };
      const aoTerminar = (ev: AnimationEvent) => {
        if (ev.target === previewPane) concluir();
      };
      let relogio = 0;
      if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
        concluir();
        return;
      }
      document.body.classList.add("preview-saindo");
      previewPane.addEventListener("animationend", aoTerminar);
      relogio = window.setTimeout(concluir, 320);
    };
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
      if ((ratio - bounds.maxRatio) * bounds.free > FECHAR_APOS) {
        fecharPreview(e.pointerId);
        return;
      }
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

    // ---------- puxar a pré-visualização de volta ----------
    //
    // Fechada a prévia (arrastando o divisor para além do limite), sobra a faixa
    // `#preview-puxa` na direita. Clicar nela traz a prévia de volta no tamanho em que
    // estava; arrastar para a esquerda aumenta, como se fosse o próprio divisor.
    //
    // Quem escuta o movimento é a JANELA, não a alça: no instante em que a prévia volta
    // a alça sai da tela (o `display: none` do CSS) e não receberia mais nada.
    //
    // O arrasto é medido pelo DESLOCAMENTO do dedo, não pela posição dele: a alça fica
    // na beirada, e ler a posição faria a prévia pular para o mínimo no primeiro
    // movimento — o contrário de puxar.
    const puxa = $("#preview-puxa");
    let puxando = false;
    let puxaInicioX = 0;
    let puxaInicioRatio = 0.5;
    puxa.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      const atual = Number(body.style.getPropertyValue("--lg"));
      puxaInicioRatio = Number.isFinite(atual) && atual > 0 && atual < 1 ? atual : 0.5;
      puxaInicioX = e.clientX;
      puxando = true;
      document.body.classList.add("resizing");
      // a prévia volta JÁ, no tamanho em que estava: quem só quer trazê-la de volta
      // basta clicar (sem mover, o deslocamento é zero e a largura não muda)
      if (document.body.classList.contains("no-preview")) this.toggle("no-preview");
      applyRatio(puxaInicioRatio);
    });
    const aoMoverPuxa = (e: PointerEvent) => {
      if (!puxando) return;
      const bounds = region();
      applyRatio(puxaInicioRatio + (e.clientX - puxaInicioX) / bounds.free);
    };
    const aoSoltarPuxa = () => {
      if (!puxando) return;
      puxando = false;
      document.body.classList.remove("resizing");
      const v = body.style.getPropertyValue("--lg");
      if (v) localStorage.setItem("mdc.split", v);
    };
    window.addEventListener("pointermove", aoMoverPuxa);
    window.addEventListener("pointerup", aoSoltarPuxa);
    window.addEventListener("pointercancel", aoSoltarPuxa);
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
