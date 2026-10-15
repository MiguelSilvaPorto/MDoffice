// Fita de ferramentas do documento Word (Início, Inserir, Tabela, Página) e janela "Configurar página".
import type { WordEditor, FormatState } from "./editor";
import { FONT_FAMILIES, FONT_SIZES } from "./schema";
import { DEFAULT_SETUP, type PageSetup } from "./model";
import { h, toast } from "../util";
import { melhorarSelects } from "../seletor";
import { ligarAjusteAlturaFita, ligarRecolherFita, ligarRodaHorizontal } from "../fita";

export interface RibbonHooks {
  editor: WordEditor;
  /** Abre o seletor de imagem do computador. */
  pickImage: () => void;
  /** A configuração da página foi alterada. */
  setSetup: (setup: PageSetup) => void;
  /** Pergunta o endereço do link. Devolve null se cancelou. */
  askLink: (current: string | null) => Promise<string | null>;
  /** Busca e substituição */
  onFind?: () => void;
  onReplace?: () => void;
  /** Painel lateral / editor de revisão */
  onReview?: () => void;
  /** Formalizar o texto com prévia antes/depois */
  onFormalizar?: () => void;
  /** Suplementos / extensões */
  onAddons?: () => void;
}

const COLORS = ["#000000", "#434343", "#999999", "#d9d9d9", "#ffffff", "#c00000", "#ff0000", "#ff9900", "#ffd966", "#00b050", "#00b0f0", "#0070c0", "#7030a0", "#ff66cc"];
const HIGHLIGHTS = ["#ffff00", "#00ff00", "#00ffff", "#ff99cc", "#ffc000", "#c9daf8", "#d9ead3", "#f4cccc"];

const icon = (name: string) => `<svg class="ic"><use href="#${name}"/></svg>`;

/** Botão da fita (não rouba o foco do documento). */
const btn = (cmd: string, label: string, title: string, extra = "") =>
  `<button type="button" class="rb ${extra}" data-cmd="${cmd}" title="${title}" aria-label="${title}">${label}</button>`;

/** Estilos de parágrafo da galeria (id do bloco, nome, legenda). */
const STYLES: [string, string, string][] = [
  ["paragraph", "Normal", "Calibri, 11"],
  ["h1", "Título 1", "Calibri Light, 16"],
  ["h2", "Título 2", "Calibri Light, 13"],
  ["h3", "Título 3", "Calibri, 12"],
  ["quote", "Citação", "Calibri, 11"],
  ["code", "Código", "Consolas, 10"],
];

/** Grupo da fita: conteúdo em cima, nome embaixo (como no Word). */
const group = (label: string, body: string, cls = "", hidden = false) =>
  `<div class="rb-group ${cls}"${hidden ? " hidden" : ""}><div class="rb-body">${body}</div><div class="rb-glabel">${label}</div></div>`;

export class Ribbon {
  readonly el: HTMLElement;
  private hooks: RibbonHooks;
  private pop: HTMLElement | null = null;
  /** o botão que abriu o popup aberto (para o mesmo botão recolhê-lo — ver `run`/`place`) */
  private ancoraDoPop: HTMLElement | null = null;
  /** Pincel de formatação: desligado, para uma seleção ("once") ou fixo ("sticky"). */
  private painter: "off" | "once" | "sticky" = "off";
  private showParaMarks = false;
  private activeTab = "home";

  constructor(host: HTMLElement, hooks: RibbonHooks) {
    this.el = host;
    this.hooks = hooks;
    host.innerHTML = `
      <div class="wd-ribbon-tabs" role="tablist" aria-label="Guias da Faixa de Opções">
        <button type="button" class="wd-rtab active" data-tab="home" role="tab" aria-selected="true">Início</button>
        <button type="button" class="wd-rtab" data-tab="insert" role="tab" aria-selected="false">Inserir</button>
        <button type="button" class="wd-rtab" data-tab="layout" role="tab" aria-selected="false">Layout</button>
        <button type="button" class="wd-rtab" data-tab="review" role="tab" aria-selected="false">Revisão</button>
        <button type="button" class="wd-rtab wd-rtab-contextual" data-tab="table" role="tab" aria-selected="false" hidden>Tabela</button>
      </div>
      <div class="wd-ribbon-panels">
        <button type="button" class="wd-ribbon-nav prev" title="Rolar para esquerda" hidden aria-label="Rolar para esquerda">
          <svg class="ic" viewBox="0 0 24 24"><path d="M15 18l-6-6 6-6"/></svg>
        </button>
        <button type="button" class="wd-ribbon-nav next" title="Rolar para direita" hidden aria-label="Rolar para direita">
          <svg class="ic" viewBox="0 0 24 24"><path d="M9 18l6-6-6-6"/></svg>
        </button>
        <div class="wd-rpanel active" data-panel="home">
          ${group("Desfazer", `
            <div class="rb-col">
              ${btn("undo", icon("i-undo"), "Desfazer (Ctrl+Z)")}
              ${btn("redo", icon("i-redo"), "Refazer (Ctrl+Y)")}
            </div>`)}
          ${group("Área de Transferência", `
            ${btn("paste", icon("i-paste") + "<span>Colar</span>", "Colar (Ctrl+V)", "big")}
            <div class="rb-col">
              <div class="rb-row">
                ${btn("cut", icon("i-cut"), "Recortar (Ctrl+X)")}
                ${btn("copy", icon("i-copy"), "Copiar (Ctrl+C)")}
              </div>
              <div class="rb-row">
                ${btn("format-painter", icon("i-brush"), "Pincel de Formatação (copiar e aplicar estilo)")}
              </div>
            </div>`)}
          ${group("Fonte", `
            <div class="rb-rows">
              <div class="rb-row">
                <select class="rb-select font" data-sel="font" data-editavel title="Fonte" aria-label="Fonte">
                  ${FONT_FAMILIES.map((f) => `<option value="${f}" style="font-family:'${f}'">${f}</option>`).join("")}
                </select>
                <select class="rb-select size" data-sel="size" data-editavel data-num data-min="1" data-max="1638" title="Tamanho da letra" aria-label="Tamanho da letra">
                  ${FONT_SIZES.map((s) => `<option value="${s}">${s}</option>`).join("")}
                </select>
                ${btn("size-up", "A<sup>▲</sup>", "Aumentar tamanho da fonte")}
                ${btn("size-down", "A<sub>▼</sub>", "Diminuir tamanho da fonte")}
                ${btn("change-case", "Aa ▾", "Maiúsculas / Minúsculas")}
                ${btn("clear", icon("i-clear-format"), "Limpar formatação")}
              </div>
              <div class="rb-row">
                ${btn("bold", "<b>N</b>", "Negrito (Ctrl+B)")}
                ${btn("italic", "<i>I</i>", "Itálico (Ctrl+I)")}
                ${btn("underline", "<u>S</u>", "Sublinhado (Ctrl+U)")}
                ${btn("strike", "<s>ab</s>", "Tachado")}
                ${btn("sub", "x<small>₂</small>", "Subscrito (Ctrl+,)")}
                ${btn("sup", "x<small>²</small>", "Sobrescrito (Ctrl+.)")}
                ${btn("highlight", `<span class="rb-a hl">ab</span><span class="rb-bar" data-bar="highlight"></span>`, "Cor do Realce do Texto", "colorbtn")}
                ${btn("color", `<span class="rb-a">A</span><span class="rb-bar" data-bar="color"></span>`, "Cor da Fonte", "colorbtn")}
              </div>
            </div>`)}
          ${group("Parágrafo", `
            <div class="rb-rows">
              <div class="rb-row">
                ${btn("bullet", icon("i-list"), "Marcadores (Ctrl+Shift+L)")}
                ${btn("ordered", icon("i-list-num"), "Numeração (1, 2, 3)")}
                ${btn("multilevel", icon("i-list-multi"), "Lista de Vários Níveis")}
                ${btn("outdent", icon("i-outdent"), "Diminuir Recuo")}
                ${btn("indent", icon("i-indent"), "Aumentar Recuo")}
                ${btn("para-marks", icon("i-pilcrow"), "Mostrar/Ocultar Marcas de Parágrafo (¶)")}
              </div>
              <div class="rb-row">
                ${btn("align-left", icon("i-align-left"), "Alinhar à Esquerda (Ctrl+L)")}
                ${btn("align-center", icon("i-align-center"), "Centralizar (Ctrl+E)")}
                ${btn("align-right", icon("i-align-right"), "Alinhar à Direita (Ctrl+R)")}
                ${btn("align-justify", icon("i-align-justify"), "Justificar (Ctrl+J)")}
                ${btn("line-spacing", icon("i-line-spacing") + "<small>▾</small>", "Espaçamento de Linha e Parágrafo")}
                ${btn("shading", icon("i-bucket"), "Sombreamento do Parágrafo", "colorbtn")}
                ${btn("border-bottom", icon("i-border"), "Bordas")}
              </div>
            </div>`)}
          ${group("Estilos", `
            <div class="rb-styles">
              ${STYLES.map(([k, name, sub]) => `<button type="button" class="rb-style st-${k}" data-cmd="style:${k}" data-block="${k}" title="${name}"><span>${name}</span><small>${sub}</small></button>`).join("")}
            </div>`)}
          ${group("Editando", `
            <div class="rb-col">
              ${btn("find", icon("i-search") + "<span>Localizar</span>", "Localizar texto (Ctrl+F)")}
              ${btn("replace", icon("i-replace") + "<span>Substituir</span>", "Substituir texto (Ctrl+H)")}
              ${btn("select-all", "<span>Selecionar ▾</span>", "Selecionar Tudo (Ctrl+A)")}
            </div>`)}
          ${group("Voz", `
            ${btn("dictate", icon("i-mic") + "<span>Ditar</span>", "Ditar texto por voz", "big")}`)}
        </div>

        <div class="wd-rpanel" data-panel="insert" hidden>
          ${group("Páginas", `
            ${btn("pagebreak", icon("i-pagebreak") + "<span>Quebra</span>", "Quebra de página (Ctrl+Enter)", "big")}`)}
          ${group("Tabelas", `
            ${btn("table", icon("i-grid") + "<span>Tabela</span>", "Inserir tabela", "big")}`)}
          ${group("Ilustrações", `
            ${btn("image", icon("i-image") + "<span>Imagem</span>", "Inserir imagem deste computador (Ctrl+V cola direto)", "big")}`)}
          ${group("Links", `
            ${btn("link", icon("i-link") + "<span>Link</span>", "Inserir link da web", "big")}`)}
          ${group("Divisões", `
            ${btn("rule", icon("i-hr") + "<span>Linha</span>", "Linha horizontal divisória", "big")}`)}
        </div>

        <div class="wd-rpanel" data-panel="layout" hidden>
          ${group("Configurar Página", `
            ${btn("page", icon("i-doc") + "<span>Página</span>", "Tamanho do papel, margens, orientação, cabeçalho e rodapé", "big")}`)}
        </div>

        <div class="wd-rpanel" data-panel="review" hidden>
          ${group("Revisão de Texto", `
            ${btn("editor-panel", icon("i-feather") + "<span>Editor</span>", "Editor de ortografia e escrita", "big")}
            ${btn("formalizar", icon("i-spark") + "<span>Formalizar</span>", "Formalizar o texto (prévia antes/depois) — Ctrl+Alt+F", "big")}`)}
          ${group("Voz", `
            ${btn("dictate", icon("i-mic") + "<span>Ditar</span>", "Ditar texto por voz", "big")}`)}
          ${group("Suplementos", `
            ${btn("addons", icon("i-addons") + "<span>Suplementos</span>", "Suplementos do Office", "big")}`)}
        </div>

        <div class="wd-rpanel" data-panel="table" hidden>
          ${group("Linhas", `
            <div class="rb-col">
              <div class="rb-row">
                ${btn("t-row-before", icon("i-table-row-add") + "<span>Acima</span>", "Inserir linha acima")}
                ${btn("t-row-after", icon("i-table-row-add") + "<span>Abaixo</span>", "Inserir linha abaixo")}
              </div>
              <div class="rb-row">
                ${btn("t-row-del", icon("i-table-row-del") + "<span>Excluir</span>", "Excluir linha")}
              </div>
            </div>`)}
          ${group("Colunas", `
            <div class="rb-col">
              <div class="rb-row">
                ${btn("t-col-before", icon("i-table-col-add") + "<span>Esquerda</span>", "Inserir coluna à esquerda")}
                ${btn("t-col-after", icon("i-table-col-add") + "<span>Direita</span>", "Inserir coluna à direita")}
              </div>
              <div class="rb-row">
                ${btn("t-col-del", icon("i-table-col-del") + "<span>Excluir</span>", "Excluir coluna")}
              </div>
            </div>`)}
          ${group("Mesclar e Sombrear", `
            <div class="rb-col">
              <div class="rb-row">
                ${btn("t-merge", icon("i-table-merge") + "<span>Mesclar</span>", "Mesclar células selecionadas")}
                ${btn("t-split", icon("i-table-split") + "<span>Dividir</span>", "Dividir célula")}
              </div>
              <div class="rb-row">
                ${btn("t-shade", icon("i-bucket") + "<span>Sombrear</span>", "Sombrear célula")}
              </div>
            </div>`)}
          ${group("Excluir", `
            ${btn("t-del", icon("i-trash") + "<span>Excluir Tabela</span>", "Excluir tabela inteira", "big")}`)}
        </div>
      </div>
    `;

    // os <select> da fita abrem a lista do app (não a cinza do sistema)
    melhorarSelects(host);

    host.querySelectorAll<HTMLButtonElement>(".wd-rtab").forEach((tabBtn) => {
      tabBtn.addEventListener("click", () => {
        if (tabBtn.dataset.tab) this.switchTab(tabBtn.dataset.tab);
      });
    });

    host.addEventListener("mousedown", (e) => {
      const t = e.target as HTMLElement;
      // botões não tiram o foco do documento (selects precisam do foco para abrir)
      if (t.closest("button")) e.preventDefault();
    });
    // pincel: duplo clique deixa ligado até apertar Esc ou clicar de novo
    host.addEventListener("dblclick", (e) => {
      if (!(e.target as HTMLElement).closest("[data-cmd=format-painter]")) return;
      this.hooks.editor.copyFormat();
      this.setPainter("sticky");
    });
    // com o pincel ligado, a próxima seleção com o mouse recebe o formato
    this.hooks.editor.view.dom.addEventListener("mouseup", () => {
      if (this.painter === "off") return;
      setTimeout(() => {
        if (this.painter === "off" || !this.hooks.editor.applyFormat()) return;
        if (this.painter === "once") this.setPainter("off");
      }, 0);
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && this.painter !== "off") this.setPainter("off");
    });
    host.addEventListener("click", (e) => {
      const b = (e.target as HTMLElement).closest<HTMLElement>("[data-cmd]");
      if (b) void this.run(b.dataset.cmd!, b);
    });
    host.addEventListener("change", (e) => {
      const s = (e.target as HTMLElement).closest<HTMLSelectElement>("[data-sel]");
      if (!s) return;
      const ed = this.hooks.editor;
      switch (s.dataset.sel) {
        case "font":
          ed.setMark("font_family", { name: s.value });
          break;
        case "size":
          ed.setMark("font_size", { size: +s.value });
          break;
        case "lh":
          ed.lineHeight(s.value ? +s.value : null);
          break;
      }
    });

    // A rolagem horizontal com a roda do mouse é feita pelo `ligarRodaHorizontal` (fita.ts),
    // ligado nos próprios trechos que rolam (a galeria de Estilos e os painéis) — um handler
    // só, que respeita o trecho de dentro.
    const panelsContainer = host.querySelector<HTMLElement>(".wd-ribbon-panels");

    // Botões de navegação lateral (< e >)
    const prevBtn = host.querySelector<HTMLButtonElement>(".wd-ribbon-nav.prev");
    const nextBtn = host.querySelector<HTMLButtonElement>(".wd-ribbon-nav.next");
    prevBtn?.addEventListener("click", () => {
      const activePanel = host.querySelector<HTMLElement>(".wd-rpanel:not([hidden])");
      if (activePanel) {
        activePanel.scrollBy({ left: -240, behavior: "smooth" });
        setTimeout(() => this.updateNavButtons(), 250);
      }
    });
    nextBtn?.addEventListener("click", () => {
      const activePanel = host.querySelector<HTMLElement>(".wd-rpanel:not([hidden])");
      if (activePanel) {
        activePanel.scrollBy({ left: 240, behavior: "smooth" });
        setTimeout(() => this.updateNavButtons(), 250);
      }
    });

    host.querySelectorAll<HTMLElement>(".wd-rpanel").forEach((panel) => {
      panel.addEventListener("scroll", () => this.updateNavButtons(), { passive: true });
    });
    window.addEventListener("resize", () => this.updateNavButtons());
    setTimeout(() => this.updateNavButtons(), 80);

    // recolher a faixa: botão no canto das abas, duplo clique numa aba ou Ctrl+F1
    const tabsEl = host.querySelector<HTMLElement>(".wd-ribbon-tabs");
    if (tabsEl && panelsContainer) ligarRecolherFita({ el: host, abas: tabsEl, paineis: panelsContainer });
    // ajustar o tamanho da faixa arrastando a borda de baixo
    ligarAjusteAlturaFita({ el: host, modo: "metricas" });
    // a roda anda de lado no que passa da largura: a galeria de Estilos e os painéis da fita
    host.querySelectorAll<HTMLElement>(".rb-styles, .wd-rpanel").forEach(ligarRodaHorizontal);
  }

  private setPainter(mode: "off" | "once" | "sticky"): void {
    this.painter = mode;
    this.el.querySelector("[data-cmd=format-painter]")?.classList.toggle("active-btn", mode !== "off");
    this.hooks.editor.view.dom.classList.toggle("painting", mode !== "off");
    if (mode === "off") this.hooks.editor.clearCopiedFormat();
  }

  switchTab(tab: string): void {
    this.activeTab = tab;
    this.el.querySelectorAll<HTMLButtonElement>(".wd-rtab").forEach((b) => {
      const active = b.dataset.tab === tab;
      b.classList.toggle("active", active);
      b.setAttribute("aria-selected", String(active));
    });
    this.el.querySelectorAll<HTMLElement>(".wd-rpanel").forEach((p) => {
      p.hidden = p.dataset.panel !== tab;
    });
    this.updateNavButtons();
  }

  private updateNavButtons(): void {
    const panels = this.el.querySelector<HTMLElement>(".wd-ribbon-panels");
    if (!panels) return;
    const panel = panels.querySelector<HTMLElement>(".wd-rpanel:not([hidden])");
    const prevBtn = panels.querySelector<HTMLButtonElement>(".wd-ribbon-nav.prev");
    const nextBtn = panels.querySelector<HTMLButtonElement>(".wd-ribbon-nav.next");
    if (!panel || !prevBtn || !nextBtn) return;
    const maxScroll = panel.scrollWidth - panel.clientWidth;
    prevBtn.hidden = panel.scrollLeft <= 5;
    nextBtn.hidden = panel.scrollLeft >= maxScroll - 5 || maxScroll <= 2;
  }

  // ---------- estado visual ----------

  update(): void {
    const st = this.hooks.editor.query();
    const on = (cmd: string, active: boolean) =>
      this.el.querySelectorAll(`[data-cmd="${cmd}"]`).forEach((b) => b.classList.toggle("active", active));
    on("bold", st.bold);
    on("italic", st.italic);
    on("underline", st.underline);
    on("strike", st.strike);
    on("sub", st.sub);
    on("sup", st.sup);
    on("align-left", !st.align || st.align === "left");
    on("align-center", st.align === "center");
    on("align-right", st.align === "right");
    on("align-justify", st.align === "justify");
    on("bullet", st.list === "bullet");
    on("ordered", st.list === "ordered");
    const dis = (cmd: string, d: boolean) =>
      this.el.querySelectorAll<HTMLButtonElement>(`[data-cmd="${cmd}"]`).forEach((b) => (b.disabled = d));
    dis("undo", !st.canUndo);
    dis("redo", !st.canRedo);
    const sel = (name: string, v: string) => {
      this.el.querySelectorAll<HTMLSelectElement>(`[data-sel="${name}"]`).forEach((s) => {
        if (v === "") {
          s.value = v;
          return;
        }
        // valor que a lista não conhece (fonte/tamanho de um .docx importado): vira opção
        // para o campo mostrar o que o documento tem, como no Word
        if (![...s.options].some((o) => o.value === v)) {
          const op = document.createElement("option");
          op.value = v;
          op.textContent = v;
          s.append(op);
        }
        s.value = v;
      });
    };
    this.el.querySelectorAll<HTMLElement>("[data-block]").forEach((b) => b.classList.toggle("active", b.dataset.block === st.block));
    sel("font", st.fontFamily ?? this.hooks.editor.setup.defaultFont);
    sel("size", String(st.fontSize ?? this.hooks.editor.setup.defaultSize));
    sel("lh", st.lineHeight ? String(st.lineHeight) : "");
    const bar = (n: string, c: string | null, fallback: string) => {
      this.el.querySelectorAll<HTMLElement>(`[data-bar="${n}"]`).forEach((e) => {
        e.style.background = c ?? fallback;
      });
    };
    bar("color", st.color, "currentColor");
    bar("highlight", st.highlight, "#ffff00");

    const tableTab = this.el.querySelector<HTMLButtonElement>('.wd-rtab[data-tab="table"]');
    if (tableTab) {
      tableTab.hidden = !st.inTable;
      if (!st.inTable && this.activeTab === "table") {
        this.switchTab("home");
      }
    }
    this.updateNavButtons();
  }

  // ---------- comandos ----------

  private async run(cmd: string, anchor: HTMLElement): Promise<void> {
    const ed = this.hooks.editor;
    // O MESMO botão de novo recolhe o que ele abriu (a paleta de cor, a grade da tabela): quem
    // abriu foi ele — o popup guarda a âncora. Sem isto, o clique no próprio botão é ignorado
    // pelo "fecha ao clicar fora" e o comando roda de novo, reabrindo o popup.
    if (this.pop && this.ancoraDoPop === anchor) {
      this.closePop();
      return;
    }
    this.closePop();
    if (cmd.startsWith("style:")) return ed.setBlock(cmd.slice(6));
    switch (cmd) {
      case "paste":
        return void navigator.clipboard
          .readText()
          .then((t) => t && ed.insertPlainText(t))
          .catch(() => {});
      case "cut":
      case "copy":
        ed.focus();
        document.execCommand(cmd);
        return;
      case "undo":
        return ed.undo();
      case "redo":
        return ed.redo();
      case "bold":
      case "italic":
      case "underline":
      case "strike":
      case "sub":
      case "sup":
        return ed.toggle(cmd);
      case "clear":
        return ed.clearFormatting();
      case "size-up":
        return ed.stepFontSize(1);
      case "size-down":
        return ed.stepFontSize(-1);
      case "align-left":
      case "align-center":
      case "align-right":
      case "align-justify":
        return ed.align(cmd.slice(6) as "left");
      case "indent":
        return ed.indent(1);
      case "outdent":
        return ed.indent(-1);
      case "bullet":
      case "ordered":
        return ed.list(cmd);
      case "color":
        return this.palette(anchor, COLORS, true, (c) => ed.setMark("text_color", c ? { color: c } : null), "Automático");
      case "highlight":
        return this.palette(anchor, HIGHLIGHTS, false, (c) => ed.setMark("highlight", c ? { color: c } : null), "Sem destaque");
      case "table":
        return this.tablePicker(anchor);
      case "image":
        return this.hooks.pickImage();
      case "link": {
        const cur = ed.query().link;
        const href = await this.hooks.askLink(cur);
        if (href === null) return;
        return ed.setLink(href.trim() || null);
      }
      case "pagebreak":
        return ed.insertPageBreak();
      case "rule":
        return ed.insertRule();
      case "t-row-before":
        return ed.table("addRowBefore");
      case "t-row-after":
        return ed.table("addRowAfter");
      case "format-painter": {
        if (this.painter !== "off") this.setPainter("off");
        else {
          ed.copyFormat();
          this.setPainter("once");
        }
        return;
      }
      case "change-case": {
        return this.caseMenu(anchor);
      }
      case "para-marks": {
        this.showParaMarks = !this.showParaMarks;
        anchor.classList.toggle("active-btn", this.showParaMarks);
        this.el.closest("#word-pane")?.classList.toggle("show-para-marks", this.showParaMarks);
        return;
      }
      case "multilevel": {
        return ed.list("ordered");
      }
      case "line-spacing": {
        return this.lineSpacingMenu(anchor);
      }
      case "shading": {
        return this.palette(anchor, COLORS, true, (c) => ed.paragraphShading(c), "Sem sombreamento");
      }
      case "border-bottom": {
        return ed.toggleParagraphBorder();
      }
      case "find": {
        if (this.hooks.onFind) this.hooks.onFind();
        else window.dispatchEvent(new KeyboardEvent("keydown", { key: "f", ctrlKey: true }));
        return;
      }
      case "replace": {
        if (this.hooks.onReplace) this.hooks.onReplace();
        else window.dispatchEvent(new KeyboardEvent("keydown", { key: "h", ctrlKey: true }));
        return;
      }
      case "select-all": {
        ed.focus();
        document.execCommand("selectAll");
        return;
      }
      case "dictate": {
        return this.startDictation(anchor);
      }
      case "editor-panel": {
        this.hooks.onReview?.();
        return;
      }
      case "formalizar": {
        this.hooks.onFormalizar?.();
        return;
      }
      case "addons": {
        this.hooks.onAddons?.();
        return;
      }
      case "t-row-del":
        return ed.table("deleteRow");
      case "t-col-before":
        return ed.table("addColumnBefore");
      case "t-col-after":
        return ed.table("addColumnAfter");
      case "t-col-del":
        return ed.table("deleteColumn");
      case "t-merge":
        return ed.table("merge");
      case "t-split":
        return ed.table("split");
      case "t-del":
        return ed.table("delete");
      case "t-shade":
        return this.palette(anchor, ["#f3f4f6", "#fde68a", "#bbf7d0", "#bfdbfe", "#fbcfe8", "#e5e7eb", "#fecaca"], false, (c) => ed.table("shade", c), "Sem cor");
      case "page":
        return this.pageDialog();
    }
  }

  private caseMenu(anchor: HTMLElement): void {
    const pop = h("div", { class: "wd-pal wd-menu-pop" });
    const items: [string, "upper" | "lower" | "title"][] = [
      ["Primeira letra da frase em maiúscula", "title"],
      ["minúsculas", "lower"],
      ["MAIÚSCULAS", "upper"],
    ];
    for (const [label, mode] of items) {
      const b = h("button", { class: "wd-menu-item", type: "button", text: label });
      b.addEventListener("mousedown", (e) => e.preventDefault());
      b.addEventListener("click", () => {
        this.closePop();
        this.hooks.editor.changeCase(mode);
      });
      pop.append(b);
    }
    this.place(pop, anchor);
  }

  private lineSpacingMenu(anchor: HTMLElement): void {
    const pop = h("div", { class: "wd-pal wd-menu-pop" });
    const current = this.hooks.editor.query().lineHeight || 1.15;
    const options: [number, string][] = [
      [1.0, "1,0"],
      [1.15, "1,15 (Padrão)"],
      [1.5, "1,5"],
      [2.0, "2,0"],
      [2.5, "2,5"],
      [3.0, "3,0"],
    ];
    for (const [val, label] of options) {
      const isSelected = Math.abs(current - val) < 0.05;
      const b = h("button", { class: `wd-menu-item${isSelected ? " active" : ""}`, type: "button" });
      b.innerHTML = `<span style="width:16px;display:inline-block;color:var(--accent);font-weight:bold">${isSelected ? "✓" : ""}</span><span>${label}</span>`;
      b.addEventListener("mousedown", (e) => e.preventDefault());
      b.addEventListener("click", () => {
        this.closePop();
        this.hooks.editor.lineHeight(val === 1.15 ? null : val);
      });
      pop.append(b);
    }
    this.place(pop, anchor);
  }

  private startDictation(anchor: HTMLElement): void {
    const SpeechRecognition = (window as unknown as { SpeechRecognition?: any; webkitSpeechRecognition?: any }).SpeechRecognition ||
      (window as unknown as { SpeechRecognition?: any; webkitSpeechRecognition?: any }).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      toast("O reconhecimento de voz pelo navegador (Web Speech API) não está disponível no sistema atual.", "info", 5600);
      return;
    }
    const rec = new SpeechRecognition();
    rec.lang = "pt-BR";
    rec.continuous = false;
    rec.interimResults = false;
    anchor.classList.add("active-btn");
    rec.onresult = (ev: any) => {
      const text = ev.results?.[0]?.[0]?.transcript;
      if (text) this.hooks.editor.insertPlainText(" " + text);
    };
    rec.onend = () => {
      anchor.classList.remove("active-btn");
    };
    rec.onerror = () => {
      anchor.classList.remove("active-btn");
    };
    rec.start();
  }

  private closePop(): void {
    this.pop?.remove();
    this.pop = null;
    this.ancoraDoPop = null;
  }

  private place(pop: HTMLElement, anchor: HTMLElement): void {
    // `app-popup`: marca de "popup do app" — a fita (fita.ts) não recolhe enquanto se clica aqui
    // dentro (o popup vive no body e o clique nele seria contado como "fora").
    pop.classList.add("app-popup");
    document.body.append(pop);
    const r = anchor.getBoundingClientRect();
    pop.style.left = `${Math.max(8, Math.min(r.left, window.innerWidth - pop.offsetWidth - 8))}px`;
    pop.style.top = `${r.bottom + 4}px`;
    this.pop = pop;
    // Guarda quem abriu: é o que deixa o MESMO botão recolher o que abriu (ver `run`).
    this.ancoraDoPop = anchor;
    const off = (e: MouseEvent) => {
      if (!pop.contains(e.target as Node) && !anchor.contains(e.target as Node)) {
        this.closePop();
        document.removeEventListener("mousedown", off, true);
      }
    };
    document.addEventListener("mousedown", off, true);
  }

  private palette(anchor: HTMLElement, colors: string[], custom: boolean, pick: (c: string | null) => void, resetLabel: string): void {
    const pop = h("div", { class: "wd-pal" });
    const grid = h("div", { class: "wd-pal-grid" });
    for (const c of colors) {
      const b = h("button", { class: "wd-sw", type: "button", title: c });
      b.style.background = c;
      b.addEventListener("mousedown", (e) => e.preventDefault());
      b.addEventListener("click", () => {
        this.closePop();
        pick(c);
      });
      grid.append(b);
    }
    pop.append(grid);
    const reset = h("button", { class: "wd-pal-reset", type: "button", text: resetLabel });
    reset.addEventListener("mousedown", (e) => e.preventDefault());
    reset.addEventListener("click", () => {
      this.closePop();
      pick(null);
    });
    pop.append(reset);
    if (custom) {
      const lab = h("label", { class: "wd-pal-custom", text: "Outra cor… " });
      const input = h("input", { type: "color" });
      input.addEventListener("input", () => pick(input.value));
      lab.append(input);
      pop.append(lab);
    }
    this.place(pop, anchor);
  }

  private tablePicker(anchor: HTMLElement): void {
    const pop = h("div", { class: "wd-tbl" });
    const label = h("div", { class: "wd-tbl-label", text: "Inserir tabela" });
    const grid = h("div", { class: "wd-tbl-grid" });
    const ROWS = 8;
    const COLS = 8;
    const cells: HTMLElement[] = [];
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const cell = h("button", { class: "wd-tbl-cell", type: "button", "data-r": String(r + 1), "data-c": String(c + 1) });
        cell.addEventListener("mousedown", (e) => e.preventDefault());
        cell.addEventListener("mouseenter", () => {
          label.textContent = `${r + 1} × ${c + 1}`;
          cells.forEach((x) => x.classList.toggle("on", +x.dataset.r! <= r + 1 && +x.dataset.c! <= c + 1));
        });
        cell.addEventListener("click", () => {
          this.closePop();
          this.hooks.editor.insertTable(r + 1, c + 1);
        });
        cells.push(cell);
        grid.append(cell);
      }
    }
    pop.append(label, grid);
    this.place(pop, anchor);
  }

  // ---------- configurar página ----------

  private pageDialog(): void {
    const ed = this.hooks.editor;
    const s: PageSetup = JSON.parse(JSON.stringify(ed.setup));
    const backdrop = h("div", { class: "modal-backdrop" });
    const modal = h("div", { class: "modal tr-modal page-modal" });
    modal.innerHTML = `
      <header class="wm-head"><svg class="ic"><use href="#i-doc"/></svg><h2>Configurar página</h2>
        <button class="btn icon" data-close title="Fechar (Esc)"><svg class="ic"><use href="#i-close"/></svg></button></header>
      <div class="wm-body tr-body">
        <section>
          <h4>Papel</h4>
          <div class="pg-row">
            <label class="st-field">Tamanho<select data-k="size" class="st-select"><option value="A4">A4 (21 × 29,7 cm)</option><option value="Letter">Carta (21,6 × 27,9 cm)</option></select></label>
            <label class="st-field">Orientação<select data-k="landscape" class="st-select"><option value="0">Retrato</option><option value="1">Paisagem</option></select></label>
          </div>
        </section>
        <section>
          <h4>Margens (cm)</h4>
          <div class="pg-row">
            ${(["top", "bottom", "left", "right"] as const).map((k) => `<label class="st-field">${{ top: "Superior", bottom: "Inferior", left: "Esquerda", right: "Direita" }[k]}<input type="number" step="0.1" min="0.5" max="8" data-m="${k}"></label>`).join("")}
          </div>
        </section>
        <section>
          <h4>Texto padrão</h4>
          <div class="pg-row">
            <label class="st-field">Fonte<select data-k="font" class="st-select">${FONT_FAMILIES.map((f) => `<option>${f}</option>`).join("")}</select></label>
            <label class="st-field">Tamanho<select data-k="fsize" class="st-select">${FONT_SIZES.map((n) => `<option>${n}</option>`).join("")}</select></label>
          </div>
        </section>
        <section>
          <h4>Cabeçalho e rodapé</h4>
          <label class="st-field">Cabeçalho (aparece no alto de cada página)<input type="text" data-k="header" placeholder="Ex.: Relatório trimestral"></label>
          <label class="st-field">Rodapé<input type="text" data-k="footer" placeholder="Ex.: Empresa Ltda."></label>
          <label class="tr-opt"><input type="checkbox" data-k="pn"> <span>Mostrar “Página X de Y” no rodapé</span></label>
        </section>
      </div>
      <footer class="wm-foot"><button class="btn" data-reset>Restaurar padrão</button><span class="dr-spacer"></span><button class="btn" data-close>Cancelar</button><button class="btn primary" data-ok>Aplicar</button></footer>`;
    backdrop.append(modal);
    document.body.append(backdrop);
    melhorarSelects(modal);
    const q = <T extends HTMLElement>(sel: string) => modal.querySelector<T>(sel)!;
    /** Valor vindo do documento que a lista não conhece (fonte/tamanho do .docx): vira opção. */
    const porValor = (sel: HTMLSelectElement, v: string) => {
      if (v && ![...sel.options].some((o) => o.value === v)) {
        const op = document.createElement("option");
        op.value = v;
        op.textContent = v;
        sel.append(op);
      }
      sel.value = v;
    };
    const fill = () => {
      q<HTMLSelectElement>('[data-k="size"]').value = s.size;
      q<HTMLSelectElement>('[data-k="landscape"]').value = s.landscape ? "1" : "0";
      for (const k of ["top", "bottom", "left", "right"] as const) q<HTMLInputElement>(`[data-m="${k}"]`).value = String(s.margins[k]);
      porValor(q<HTMLSelectElement>('[data-k="font"]'), s.defaultFont);
      porValor(q<HTMLSelectElement>('[data-k="fsize"]'), String(s.defaultSize));
      q<HTMLInputElement>('[data-k="header"]').value = s.header;
      q<HTMLInputElement>('[data-k="footer"]').value = s.footer;
      q<HTMLInputElement>('[data-k="pn"]').checked = s.pageNumbers;
    };
    fill();
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
    modal.querySelectorAll("[data-close]").forEach((b) => b.addEventListener("click", close));
    q("[data-reset]").addEventListener("click", () => {
      Object.assign(s, JSON.parse(JSON.stringify(DEFAULT_SETUP)));
      fill();
    });
    q("[data-ok]").addEventListener("click", () => {
      const num = (k: string, d: number) => {
        const v = parseFloat(q<HTMLInputElement>(`[data-m="${k}"]`).value);
        return Number.isFinite(v) ? Math.min(8, Math.max(0.5, v)) : d;
      };
      const next: PageSetup = {
        size: q<HTMLSelectElement>('[data-k="size"]').value === "Letter" ? "Letter" : "A4",
        landscape: q<HTMLSelectElement>('[data-k="landscape"]').value === "1",
        margins: { top: num("top", s.margins.top), bottom: num("bottom", s.margins.bottom), left: num("left", s.margins.left), right: num("right", s.margins.right) },
        defaultFont: q<HTMLSelectElement>('[data-k="font"]').value,
        defaultSize: +q<HTMLSelectElement>('[data-k="fsize"]').value || 11,
        header: q<HTMLInputElement>('[data-k="header"]').value,
        footer: q<HTMLInputElement>('[data-k="footer"]').value,
        pageNumbers: q<HTMLInputElement>('[data-k="pn"]').checked,
      };
      close();
      this.hooks.setSetup(next);
    });
  }

  /** Para quem quiser saber o formato atual sem a fita (barra de status). */
  state(): FormatState {
    return this.hooks.editor.query();
  }
}
