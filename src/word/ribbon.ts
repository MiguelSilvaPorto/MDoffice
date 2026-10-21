// Fita de ferramentas do documento Word (Início, Inserir, Tabela, Página) e janela "Configurar página".
import type { WordEditor, FormatState } from "./editor";
import { FONT_FAMILIES, FONT_SIZES } from "./schema";
import { DEFAULT_SETUP, PAPER_SIZES, papel, CM_TO_PX, type PageSetup, type PaperSize } from "./model";
import { itensDoContexto } from "./contexto";
import { LADOS_DA_QUEBRA, MODOS_DE_QUEBRA, type LadosDaQuebra, type WrapImagem } from "./imagemFlutuante";
import { h, toast } from "../util";
import { melhorarSelects } from "../seletor";
import { ligarAjusteAlturaFita, ligarEncaixeFita, ligarRecolherFita, ligarRodaHorizontal } from "../fita";

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
  // ---------- aba Exibir ----------
  /** Troca o modo de exibição da folha (impressão, rascunho, leitura, livro). */
  setModo?: (modo: "impressao" | "rascunho" | "leitura" | "livro") => void;
  /** Liga/desliga a régua. */
  alternarRegua?: () => void;
  /** O zoom da vista. */
  setZoom?: (z: number) => void;
  /** Ajusta a folha à largura da janela. */
  zoomFit?: () => void;
  /** Mostra a página inteira. */
  zoomPage?: () => void;
  /** O que está ligado (a fita marca os botões). */
  estadoExibicao?: () => { modo: string; regua: boolean; zoom: number };
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
  /** tira as escutas do popup (o menu de contexto escuta clique fora e Esc — ver `placeEm`) */
  private limparPop: (() => void) | null = null;
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
        <button type="button" class="wd-rtab" data-tab="view" role="tab" aria-selected="false">Exibir</button>
        <button type="button" class="wd-rtab wd-rtab-contextual" data-tab="table" role="tab" aria-selected="false" hidden>Tabela</button>
        <button type="button" class="wd-rtab wd-rtab-contextual" data-tab="image" role="tab" aria-selected="false" hidden>Imagem</button>
      </div>
      <div class="wd-ribbon-panels">
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
            ${btn("page-size", icon("i-doc") + "<span>Tamanho ▾</span>", "Tamanho do papel: A5, A4, A3, A2 ou Carta", "big")}
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

        <div class="wd-rpanel" data-panel="view" hidden>
          ${group("Modos de Exibição", `
            <div class="rb-row">
              ${btn("view-print", icon("i-doc") + "<span>Impressão</span>", "Layout de impressão: a folha com as páginas de verdade", "big")}
              ${btn("view-draft", icon("i-text") + "<span>Rascunho</span>", "Rascunho: o texto contínuo, sem a folha nem as quebras de página", "big")}
              ${btn("view-reading", icon("i-eye") + "<span>Leitura</span>", "Leitura: uma coluna confortável, sem as bordas do papel", "big")}
              ${btn("view-book", icon("i-columns") + "<span>Livro</span>", "Livro: a folha aberta, com duas páginas lado a lado e a lombada no meio", "big")}
            </div>`)}
          ${group("Mostrar", `
            <div class="rb-col">
              <div class="rb-row">
                ${btn("ruler", icon("i-regua") + "<span>Régua</span>", "Mostrar a régua (horizontal e vertical, com as margens)", "big")}
              </div>
            </div>`)}
          ${group("Zoom", `
            <div class="rb-col">
              <div class="rb-row">
                ${btn("zoom-menu", icon("i-focus") + "<span>Zoom ▾</span>", "Zoom da vista: 50% a 200%", "big")}
              </div>
              <div class="rb-row">
                ${btn("zoom-fit", "<span>Ajustar</span>", "Ajustar a folha à largura da janela (só a vista muda)", "big")}
                ${btn("zoom-page", "<span>Página inteira</span>", "Mostrar a página inteira", "big")}
              </div>
            </div>`)}
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

        <div class="wd-rpanel" data-panel="image" hidden>
          ${group("Quebra de Texto", `
            ${btn("img-wrap", icon("i-flow") + "<span>Quebra ▾</span>", "Como o texto se organiza em volta da imagem", "big")}`)}
          ${group("Posição", `
            <div class="rb-col">
              <div class="rb-row">
                ${btn("img-left", icon("i-align-left"), "Alinhar à esquerda")}
                ${btn("img-center", icon("i-align-center"), "Centralizar")}
                ${btn("img-right", icon("i-align-right"), "Alinhar à direita")}
              </div>
              <div class="rb-row">
                ${btn("img-pos", icon("i-grid") + "<span>Posição ▾</span>", "Posição exata: deslocamentos, distância do texto e mover com o texto", "txt")}
              </div>
            </div>`)}
          ${group("Ajustar", `
            <div class="rb-col">
              <div class="rb-row">
                ${btn("img-fit", icon("i-columns"), "Ajustar à largura do texto")}
                ${btn("img-original", icon("i-refresh"), "Proporção original")}
              </div>
            </div>`)}
          ${group("Imagem", `
            <div class="rb-col">
              <div class="rb-row">
                ${btn("img-alt", icon("i-text") + "<span>Alt</span>", "Texto alternativo da imagem")}
              </div>
              <div class="rb-row">
                ${btn("img-inline", icon("i-doc") + "<span>Remover do fluxo</span>", "Voltar a alinhar a imagem com o texto")}
              </div>
            </div>`)}
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

    const panelsContainer = host.querySelector<HTMLElement>(".wd-ribbon-panels");

    // recolher a faixa: botão no canto das abas, duplo clique numa aba ou Ctrl+F1
    const tabsEl = host.querySelector<HTMLElement>(".wd-ribbon-tabs");
    if (tabsEl && panelsContainer) ligarRecolherFita({ el: host, abas: tabsEl, paineis: panelsContainer });
    // ajustar a ALTURA arrastando a borda de baixo (com o teto de um terço da janela)
    ligarAjusteAlturaFita({ el: host, modo: "metricas" });
    // os quatro degraus da LARGURA: o grupo que não couber vira botão com menu (nada de rolagem)
    ligarEncaixeFita({ el: host, painel: ".wd-rpanel", grupo: ".rb-group", corpo: ".rb-body", rotulo: ".rb-glabel" });
    // a roda anda de lado na galeria de Estilos (que é uma galeria, não a fita)
    host.querySelectorAll<HTMLElement>(".rb-styles").forEach(ligarRodaHorizontal);
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
    // a aba "Imagem" só existe com uma imagem SELECIONADA (como no Word)
    const imageTab = this.el.querySelector<HTMLButtonElement>('.wd-rtab[data-tab="image"]');
    if (imageTab) {
      imageTab.hidden = !st.imagem;
      if (!st.imagem && this.activeTab === "image") {
        this.switchTab("home");
      }
      if (st.imagem) {
        on("img-left", st.imagem.hAlign === "left");
        on("img-center", st.imagem.hAlign === "center");
        on("img-right", st.imagem.hAlign === "right");
      }
    }
    // aba Exibir: o modo de exibição e a régua ficam marcados quando estão ligados
    const ex = this.hooks.estadoExibicao?.();
    if (ex) {
      // os modos e a régua são botões de "ligado/desligado": entram com o desenho de pressionado
      const marcado = (cmd: string, ativo: boolean) =>
        this.el.querySelectorAll(`[data-cmd="${cmd}"]`).forEach((b) => b.classList.toggle("active-btn", ativo));
      marcado("view-print", ex.modo === "impressao");
      marcado("view-draft", ex.modo === "rascunho");
      marcado("view-reading", ex.modo === "leitura");
      marcado("view-book", ex.modo === "livro");
      marcado("ruler", ex.regua);
    }
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
      case "img-del":
        ed.deleteImage();
        return;
      case "img-wrap":
        return this.wrapMenu(anchor);
      case "img-pos":
        return this.posicaoPopup(anchor);
      case "img-left":
        return ed.setAlinhamentoImagem("left");
      case "img-center":
        return ed.setAlinhamentoImagem("center");
      case "img-right":
        return ed.setAlinhamentoImagem("right");
      case "img-fit":
        return ed.ajustarLargura();
      case "img-original":
        return void ed.proporcaoOriginal();
      case "img-alt":
        return this.altTextPopup(anchor);
      case "img-inline":
        return ed.setQuebraDeTexto("alinhado");
      case "t-shade":
        return this.palette(anchor, ["#f3f4f6", "#fde68a", "#bbf7d0", "#bfdbfe", "#fbcfe8", "#e5e7eb", "#fecaca"], false, (c) => ed.table("shade", c), "Sem cor");
      case "page":
        return this.pageDialog();
      case "page-size":
        return this.sizeMenu(anchor);
      // ---------- aba Exibir ----------
      case "view-print":
        return this.hooks.setModo?.("impressao");
      case "view-draft":
        return this.hooks.setModo?.("rascunho");
      case "view-reading":
        return this.hooks.setModo?.("leitura");
      case "view-book":
        return this.hooks.setModo?.("livro");
      case "ruler":
        return this.hooks.alternarRegua?.();
      case "zoom-menu":
        return this.zoomMenu(anchor);
      case "zoom-fit":
        return this.hooks.zoomFit?.();
      case "zoom-page":
        return this.hooks.zoomPage?.();
    }
  }

  /**
   * Menu do **Zoom** (aba Exibir): as porcentagens fixas, o "Ajustar" (a folha cabe na
   * largura) e a "Página inteira" — as três coisas que a vista oferece no Word.
   */
  private zoomMenu(anchor: HTMLElement): void {
    const pop = h("div", { class: "wd-pal wd-menu-pop" });
    const atual = Math.round(this.hooks.estadoExibicao?.().zoom ?? 1) * 100;
    for (const p of [50, 75, 100, 150, 200]) {
      const marcado = p === atual;
      const b = h("button", { class: `wd-menu-item${marcado ? " active" : ""}`, type: "button" });
      b.innerHTML =
        `<span style="width:16px;display:inline-block;color:var(--accent);font-weight:bold">${marcado ? "✓" : ""}</span>` +
        `<span>${p}%</span>`;
      b.addEventListener("mousedown", (e) => e.preventDefault());
      b.addEventListener("click", () => {
        this.closePop();
        this.hooks.setZoom?.(p / 100);
      });
      pop.append(b);
    }
    pop.append(h("div", { class: "wd-menu-sep" }));
    const ajustar = h("button", { class: "wd-menu-item", type: "button", text: "Ajustar à largura" });
    ajustar.addEventListener("mousedown", (e) => e.preventDefault());
    ajustar.addEventListener("click", () => {
      this.closePop();
      this.hooks.zoomFit?.();
    });
    pop.append(ajustar);
    const pagina = h("button", { class: "wd-menu-item", type: "button", text: "Página inteira" });
    pagina.addEventListener("mousedown", (e) => e.preventDefault());
    pagina.addEventListener("click", () => {
      this.closePop();
      this.hooks.zoomPage?.();
    });
    pop.append(pagina);
    this.place(pop, anchor);
  }

  /**
   * Menu **Quebra de Texto** da aba Imagem: como o texto se organiza em volta da imagem.
   * É a lista do Word — quadrado, contorno, topo e base, através, atrás e à frente — e cada
   * item explica o que faz (o contorno é o que deixa o texto seguir o desenho do PNG).
   */
  private wrapMenu(anchor: HTMLElement): void {
    this.place(this.criaMenuDeQuebra(), anchor);
  }

  /** O mesmo menu de quebra, mas ancorado no PONTO (o clique direito na imagem). */
  private wrapMenuEm(x: number, y: number): void {
    this.placeEm(this.criaMenuDeQuebra(), x, y);
  }

  private criaMenuDeQuebra(): HTMLElement {
    const pop = h("div", { class: "wd-pal wd-menu-pop wd-wrap-pop" });
    const img = this.hooks.editor.query().imagem;
    const atual = img?.wrap ?? "alinhado";
    for (const modo of MODOS_DE_QUEBRA) {
      const marcado = modo.id === atual;
      const b = h("button", { class: `wd-menu-item${marcado ? " active" : ""}`, type: "button" });
      b.innerHTML =
        `<span style="width:16px;display:inline-block;color:var(--accent);font-weight:bold">${marcado ? "✓" : ""}</span>` +
        `<span>${modo.nome}</span>`;
      b.title = modo.dica;
      b.addEventListener("mousedown", (e) => e.preventDefault());
      b.addEventListener("click", () => {
        this.closePop();
        this.hooks.editor.setQuebraDeTexto(modo.id as WrapImagem);
      });
      pop.append(b);
    }
    // Os LADOS da quebra (o Word tem no mesmo menu): de que lado o texto passa.
    // Só faz sentido quando a imagem flutua e o texto a contorna.
    const flutua =
      atual === "quadrado" || atual === "contorno" || atual === "topo-base" || atual === "atravessar";
    if (flutua) {
      pop.append(h("div", { class: "wd-menu-sep" }));
      pop.append(h("div", { class: "wd-menu-sub", text: "Lados da quebra" }));
      const ladosAtual = img?.lados ?? "maior";
      for (const lado of LADOS_DA_QUEBRA) {
        const marcado = lado.id === ladosAtual;
        const b = h("button", { class: `wd-menu-item${marcado ? " active" : ""}`, type: "button" });
        b.innerHTML =
          `<span style="width:16px;display:inline-block;color:var(--accent);font-weight:bold">${marcado ? "✓" : ""}</span>` +
          `<span>${lado.nome}</span>`;
        b.title = lado.dica;
        b.addEventListener("mousedown", (e) => e.preventDefault());
        b.addEventListener("click", () => {
          this.closePop();
          this.hooks.editor.setLadosDaQuebra(lado.id as LadosDaQuebra);
        });
        pop.append(b);
      }
    }
    return pop;
  }

  /**
   * Popup **Posição** da aba Imagem: os deslocamentos exatos da imagem (em cm), a
   * distância do texto e "Mover com o texto" × "Fixar na página".
   *
   * É o painel do Word numa caixa só: o arrasto continua sendo o jeito rápido, e
   * aqui a pessoa ajusta o número fino (e escolhe se a imagem anda com o texto).
   */
  private posicaoPopup(anchor: HTMLElement): void {
    const d = this.hooks.editor.query().imagem;
    if (!d) return;
    const ed = this.hooks.editor;
    const pop = h("div", { class: "wd-pal wd-menu-pop wd-pos-pop" });
    const cm = (v: number) => (v / CM_TO_PX).toFixed(2).replace(".", ",");
    const paraPx = (s: string) => {
      const n = Number(String(s).replace(/\./g, "").replace(",", "."));
      return Number.isFinite(n) ? Math.round(n * CM_TO_PX) : 0;
    };
    const linha = (rotulo: string, ...filhos: HTMLElement[]) => {
      const l = h("div", { class: "wd-pos-linha" });
      l.append(h("span", { class: "wd-pos-rotulo", text: rotulo }), ...filhos);
      return l;
    };
    const campo = (valor: number, aoMudar: (px: number) => void, dica: string) => {
      const inp = h("input", { class: "wd-pos-campo", type: "text", value: cm(valor), title: dica, "aria-label": dica });
      const aplicar = () => {
        const px = paraPx(inp.value);
        inp.value = cm(px);
        aoMudar(px);
      };
      inp.addEventListener("mousedown", (e) => e.stopPropagation());
      inp.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          aplicar();
        }
      });
      inp.addEventListener("blur", aplicar);
      return inp;
    };

    pop.append(h("div", { class: "wd-menu-sub", text: "Posição" }));

    // alinhamento (o lado em que a imagem fica)
    const alinhamento = h("div", { class: "wd-pos-seg" });
    const opcoes: [string, "left" | "center" | "right", string][] = [
      ["Esquerda", "left", "i-align-left"],
      ["Centro", "center", "i-align-center"],
      ["Direita", "right", "i-align-right"],
    ];
    for (const [nome, valor, icone] of opcoes) {
      const b = h("button", {
        class: `wd-pos-seg-btn${d.hAlign === valor ? " on" : ""}`,
        type: "button",
        title: `Alinhar à ${nome.toLowerCase()}`,
      });
      b.innerHTML = `<svg class="ic"><use href="#${icone}"/></svg><span>${nome}</span>`;
      b.addEventListener("mousedown", (e) => e.preventDefault());
      b.addEventListener("click", () => {
        ed.setAlinhamentoImagem(valor);
        this.closePop();
        this.posicaoPopup(anchor);
      });
      alinhamento.append(b);
    }
    pop.append(linha("Horizontal", alinhamento));

    // os deslocamentos (o mesmo que o arrasto grava, agora em cm). Cada campo lê o
    // valor ATUAL do outro eixo: mexer num não pode desfazer o que o outro acabou
    // de mudar (a caixa foi montada com os valores da abertura).
    const atual = () => ed.query().imagem;
    pop.append(
      linha("Deslocamento", campo(d.hOffset, (px) => ed.setDeslocamentos(px, atual()?.vOffset ?? 0), "Deslocamento horizontal, em cm (a partir da margem)"))
    );
    pop.append(
      linha("Vertical", campo(d.vOffset, (px) => ed.setDeslocamentos(atual()?.hOffset ?? 0, px), "Deslocamento vertical, em cm (a partir do parágrafo)"))
    );
    pop.append(
      linha("Distância do texto", campo(d.shapeMargin, (px) => ed.setDistanciaDoTexto(px), "Distância entre a imagem e o texto, em cm"))
    );

    // "Mover com o texto" × "Fixar na página" (o do Word)
    pop.append(h("div", { class: "wd-menu-sep" }));
    const escolha = (rotulo: string, fixa: boolean, dica: string) => {
      const b = h("button", { class: `wd-menu-item${(d.fixa === fixa) ? " active" : ""}`, type: "button" });
      b.innerHTML =
        `<span style="width:16px;display:inline-block;color:var(--accent);font-weight:bold">${d.fixa === fixa ? "✓" : ""}</span>` +
        `<span>${rotulo}</span>`;
      b.title = dica;
      b.addEventListener("mousedown", (e) => e.preventDefault());
      b.addEventListener("click", () => {
        ed.setFixaNaPagina(fixa);
        this.closePop();
      });
      return b;
    };
    pop.append(escolha("Mover com o texto", false, "A imagem anda junto com o parágrafo (o de sempre)"));
    pop.append(escolha("Fixar na página", true, "A imagem fica na mesma altura da página quando o texto acima muda"));

    this.place(pop, anchor);
  }

  /** Texto alternativo da imagem (o "alt"): a caixa de texto com o botão de aplicar. */
  private altTextPopup(anchor: HTMLElement): void {
    const alvo = this.hooks.editor.imagemEmFoco();
    if (!alvo) return;
    const pop = h("div", { class: "wd-pal wd-menu-pop" });
    const input = h("input", { class: "wd-alt-input", type: "text" });
    input.placeholder = "Descreva a imagem";
    input.value = String(alvo.node.attrs.alt ?? "");
    const aplicar = h("button", { class: "wd-pal-reset", type: "button", text: "Aplicar" });
    aplicar.addEventListener("mousedown", (e) => e.preventDefault());
    aplicar.addEventListener("click", () => {
      this.closePop();
      this.hooks.editor.setTextoAlternativo(input.value.trim());
    });
    pop.append(input, aplicar);
    this.place(pop, anchor);
    input.focus();
    input.select();
  }

  /**
   * Menu do botão **Tamanho** (aba Layout): troca o papel da folha inteira de uma vez. O tamanho
   * atual vem marcado e cada item mostra as medidas em cm — o mesmo formato do Configurar Página.
   */
  private sizeMenu(anchor: HTMLElement): void {
    const pop = h("div", { class: "wd-pal wd-menu-pop" });
    const atual = this.hooks.editor.setup.size;
    for (const p of PAPER_SIZES) {
      const isSelected = p.id === atual;
      const b = h("button", { class: `wd-menu-item${isSelected ? " active" : ""}`, type: "button" });
      const cm = (v: number) => String(v).replace(".", ",");
      b.innerHTML =
        `<span style="width:16px;display:inline-block;color:var(--accent);font-weight:bold">${isSelected ? "✓" : ""}</span>` +
        `<span>${p.rotulo}</span><small style="margin-left:auto;color:var(--muted)">${cm(p.w)} × ${cm(p.h)} cm</small>`;
      b.addEventListener("mousedown", (e) => e.preventDefault());
      b.addEventListener("click", () => {
        this.closePop();
        this.hooks.setSetup({ ...this.hooks.editor.setup, size: p.id });
      });
      pop.append(b);
    }
    this.place(pop, anchor);
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
    this.limparPop?.();
    this.limparPop = null;
    this.pop?.remove();
    this.pop = null;
    this.ancoraDoPop = null;
  }

  /**
   * Menu do clique direito DENTRO do documento.
   *
   * Antes o clique direito caía no menu nativo do WebView2 ("Emoji", "Colar como texto sem
   * formatação", "Inspecionar"…) — que não conhece tabela. O "Excluir tabela" só existia na aba
   * contextual Tabela, e quem tentava pelo clique direito (o caminho natural) não achava nada.
   * Com o cursor em tabela, os comandos de tabela vêm primeiro e "Excluir tabela" abre a lista.
   */
  menuDeContexto(e: MouseEvent): void {
    e.preventDefault();
    this.closePop();
    const dentroDeTabela = this.hooks.editor.cursorNoPonto(e.clientX, e.clientY);
    // o alvo do clique diz quando é uma IMAGEM (o cursor fica encostado no nó atômico; o próprio
    // elemento <img> é o sinal direto) — o menu abre com "Excluir imagem"
    const sobImagem = !!(e.target as HTMLElement | null)?.closest?.("img");
    const pop = h("div", { class: "wd-pal wd-menu-pop wd-menu-contexto" });
    for (const item of itensDoContexto(dentroDeTabela, sobImagem)) {
      if (item.tipo === "separador") {
        pop.append(h("div", { class: "wd-menu-sep" }));
        continue;
      }
      const b = h("button", { class: "wd-menu-item", type: "button", text: item.rotulo });
      // o botão não rouba o foco/seleção do documento — o comando age nela
      b.addEventListener("mousedown", (ev) => ev.preventDefault());
      b.addEventListener("click", () => {
        // a quebra de texto abre o MESMO menu, no ponto do clique (o item some com o menu)
        if (item.comando === "img-wrap") {
          this.closePop();
          this.wrapMenuEm(e.clientX, e.clientY);
          return;
        }
        this.closePop();
        void this.run(item.comando, b);
      });
      pop.append(b);
    }
    this.placeEm(pop, e.clientX, e.clientY);
  }

  /** Abre o popup com o canto no ponto do clique (menu de contexto), sempre dentro da janela. */
  private placeEm(pop: HTMLElement, x: number, y: number): void {
    document.body.append(pop);
    pop.style.left = `${Math.max(8, Math.min(x, window.innerWidth - pop.offsetWidth - 8))}px`;
    pop.style.top = `${Math.max(8, Math.min(y, window.innerHeight - pop.offsetHeight - 8))}px`;
    this.pop = pop;
    // sem âncora: não existe "o mesmo botão" para recolher um menu de contexto
    this.ancoraDoPop = null;
    const off = (ev: MouseEvent) => {
      if (pop.contains(ev.target as Node)) return;
      this.closePop();
    };
    const tecla = (ev: KeyboardEvent) => {
      if (ev.key !== "Escape") return;
      ev.preventDefault();
      ev.stopPropagation();
      this.closePop();
    };
    this.limparPop = () => {
      document.removeEventListener("mousedown", off, true);
      document.removeEventListener("keydown", tecla, true);
    };
    document.addEventListener("mousedown", off, true);
    document.addEventListener("keydown", tecla, true);
  }

  private place(pop: HTMLElement, anchor: HTMLElement): void {
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
            <label class="st-field">Tamanho<select data-k="size" class="st-select">${PAPER_SIZES.map((p) => `<option value="${p.id}">${p.rotulo} (${String(p.w).replace(".", ",")} × ${String(p.h).replace(".", ",")} cm)</option>`).join("")}</select></label>
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
        size: (PAPER_SIZES.find((p) => p.id === q<HTMLSelectElement>('[data-k="size"]').value)?.id ?? "A4") as PaperSize,
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
