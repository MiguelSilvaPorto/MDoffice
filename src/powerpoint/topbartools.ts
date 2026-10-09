// A fita de ferramentas da apresentação (fonte, cor, layout, lâmina, inserir).
// Mesmo desenho da fita do Word (src/word/ribbon.ts): recebe o elemento pronto do
// index.html, escreve um template string e despacha tudo por `data-cmd`.
import { h } from "../util";
import type { Shape, SlideLayout, TextAlign } from "./schema";

/** O que a fita precisa saber e fazer (o host implementa). */
export interface TopBarHooks {
  /** Estado para acender/desacender os botões. */
  query: () => FormatState;
  /** Executa um comando da fita. */
  run: (cmd: string, value?: string) => void;
  /** Abre o seletor de imagem do computador. */
  pickImage: () => void;
  /** Abre o diálogo "Configurar apresentação". */
  configure: () => void;
  /** Abre o modo apresentação. */
  present: () => void;
  /** Altera o tema (claro/escuro/contraste). */
  setTheme: (id: string) => void;
  /** Zoom do palco. */
  zoom: (delta: number) => void;
}

export interface FormatState {
  /** existe lâmina selecionada */
  temLamina: boolean;
  /** existe forma selecionada */
  temForma: boolean;
  /** é uma forma de texto (habilita fonte/negrito/etc.) */
  texto: boolean;
  layout: SlideLayout;
  fontFamily: string;
  fontSize: number;
  color: string;
  bold: boolean;
  italic: boolean;
  align: TextAlign;
  /** número de formas na lâmina (habilita alinhar/distribuir) */
  formas: number;
  zoom: number;
  indice: number;
  total: number;
}

const CORES = [
  "#000000", "#434343", "#6b7280", "#9ca3af", "#d9d9d9", "#ffffff",
  "#dc2626", "#f97316", "#f59e0b", "#fde047", "#22c55e", "#0ea5e9", "#4f46e5", "#a855f7",
];

const FONTES = ["Segoe UI", "Calibri", "Arial", "Georgia", "Times New Roman", "Verdana", "Consolas", "Courier New"];
const TAMANHOS = [8, 10, 12, 14, 18, 20, 24, 28, 32, 40, 48, 60, 72];

const LAYOUTS: [SlideLayout, string][] = [
  ["titulo", "Capa"],
  ["secao", "Seção"],
  ["conteudo", "Conteúdo"],
  ["vazio", "Vazio"],
];

const icon = (name: string) => `<svg class="ic"><use href="#${name}"/></svg>`;

/** Botão da fita. */
const btn = (cmd: string, label: string, title: string, extra = "") =>
  `<button type="button" class="pt ${extra}" data-cmd="${cmd}" title="${title}" aria-label="${title}">${label}</button>`;

/** Grupo da fita: conteúdo em cima, nome embaixo (como no Word). */
const group = (label: string, body: string, cls = "", hidden = false) =>
  `<div class="pt-group ${cls}"${hidden ? " hidden" : ""}><div class="pt-body">${body}</div><div class="pt-glabel">${label}</div></div>`;

/** Miniatura de um layout de lâmina. */
const layoutMini = (id: SlideLayout, title: string) => `
  <button type="button" class="pt-layout" data-cmd="layout:${id}" data-layout="${id}" title="${title}">
    <span class="pt-layout-mini"><span></span><span></span><span></span></span>
    <small>${title}</small>
  </button>`;

export class TopBarTools {
  readonly el: HTMLElement;
  private hooks: TopBarHooks;
  private pop: HTMLElement | null = null;

  constructor(host: HTMLElement, hooks: TopBarHooks) {
    this.el = host;
    this.hooks = hooks;
    host.innerHTML = `
      ${group("Lâmina", `
        ${btn("slide-new", icon("i-plus") + "<span>Nova</span>", "Nova lâmina depois da atual", "big")}
        <div class="pt-col">
          <div class="pt-row">
            ${btn("slide-dup", icon("i-dup"), "Duplicar lâmina")}
            ${btn("slide-del", icon("i-trash"), "Excluir lâmina")}
          </div>
          <div class="pt-row">
            ${btn("slide-up", "↑", "Mover lâmina para cima")}
            ${btn("slide-down", "↓", "Mover lâmina para baixo")}
          </div>
        </div>`)}
      ${group("Layout", `<div class="pt-layouts">${LAYOUTS.map(([id, t]) => layoutMini(id, t)).join("")}</div>`)}
      ${group("Fonte", `
        <div class="pt-rows">
          <div class="pt-row">
            <select class="pt-select font" data-sel="font" title="Fonte" aria-label="Fonte">
              ${FONTES.map((f) => `<option value="${f}" style="font-family:'${f}'">${f}</option>`).join("")}
            </select>
            <select class="pt-select size" data-sel="size" title="Tamanho" aria-label="Tamanho">
              ${TAMANHOS.map((s) => `<option value="${s}">${s}</option>`).join("")}
            </select>
          </div>
          <div class="pt-row">
            ${btn("bold", "<b>N</b>", "Negrito (Ctrl+B)")}
            ${btn("italic", "<i>I</i>", "Itálico (Ctrl+I)")}
            ${btn("color", `<span class="pt-a">A</span><span class="pt-bar" data-bar="color"></span>`, "Cor da fonte", "colorbtn")}
          </div>
        </div>`)}
      ${group("Parágrafo", `
        <div class="pt-col">
          <div class="pt-row">
            ${btn("align-left", icon("i-align-left"), "Alinhar à esquerda")}
            ${btn("align-center", icon("i-align-center"), "Centralizar")}
            ${btn("align-right", icon("i-align-right"), "Alinhar à direita")}
            ${btn("align-justify", icon("i-align-justify"), "Justificar")}
          </div>
        </div>`)}
      ${group("Inserir", `
        ${btn("shape-text", icon("i-doc") + "<span>Texto</span>", "Inserir caixa de texto", "big")}
        ${btn("shape-rect", "▭", "Inserir forma")}
        <div class="pt-col">
          ${btn("image", icon("i-image"), "Inserir imagem")}
          ${btn("shape-del", icon("i-trash"), "Excluir forma selecionada")}
        </div>`)}
      ${group("Organizar", `
        <div class="pt-rows">
          <div class="pt-row">
            ${btn("align-shapes-left", "⇤", "Alinhar à esquerda")}
            ${btn("align-shapes-center", "⇔", "Centralizar horizontalmente")}
            ${btn("align-shapes-right", "⇥", "Alinhar à direita")}
          </div>
          <div class="pt-row">
            ${btn("z-front", "▲", "Trazer para frente")}
            ${btn("z-back", "▼", "Enviar para trás")}
          </div>
        </div>`, "", true)}
      ${group("Apresentar", `
        <div class="pt-stack">
          ${btn("present", icon("i-eye") + "<span>Apresentar</span>", "Modo apresentação (F5)", "big")}
          ${btn("notes", icon("i-doc") + "<span>Notas</span>", "Focar o painel de notas", "big")}
        </div>
      `)}
      ${group("Tema", `
        <div class="pt-row">
          ${btn("theme:claro", "◐", "Tema claro")}
          ${btn("theme:escuro", "◑", "Tema escuro")}
          ${btn("theme:contraste", "◕", "Alto contraste")}
        </div>`)}
      ${group("Apresentação", btn("configure", icon("i-gear") + "<span>Configurar</span>", "Proporção, número, rodapé", "big"), "pt-end")}
    `;

    // botões não tiram o foco da forma em edição
    host.addEventListener("mousedown", (e) => {
      if ((e.target as HTMLElement).closest("button")) e.preventDefault();
    });

    // clique num botão (data-cmd) ou numa barra de cor (data-bar)
    host.addEventListener("click", (e) => {
      const t = e.target as HTMLElement;
      const barra = t.closest<HTMLElement>("[data-bar]");
      if (barra) {
        e.preventDefault();
        this.abrirCores(barra);
        return;
      }
      const b = t.closest<HTMLElement>("[data-cmd]");
      if (!b) return;
      const cmd = b.dataset.cmd!;
      if (cmd.startsWith("theme:")) {
        this.hooks.setTheme(cmd.slice(6));
        return;
      }
      this.hooks.run(cmd);
    });

    // <select> de fonte/tamanho
    host.addEventListener("change", (e) => {
      const s = (e.target as HTMLElement).closest<HTMLSelectElement>("[data-sel]");
      if (!s) return;
      if (s.dataset.sel === "font") this.hooks.run("font", s.value);
      else if (s.dataset.sel === "size") this.hooks.run("size", s.value);
    });
  }

  /** Paleta de cores flutuante (ancorada no botão que abriu). */
  private abrirCores(ancora: HTMLElement): void {
    this.fecharPop();
    const pop = h("div", { class: "pp-pop" });
    pop.innerHTML = `
      <div class="pp-swatches">
        <button type="button" class="pp-sw none" data-cor="" title="Sem cor"></button>
        ${CORES.map((c) => `<button type="button" class="pp-sw" data-cor="${c}" style="background:${c}" title="${c}"></button>`).join("")}
      </div>`;
    document.body.append(pop);
    const r = ancora.getBoundingClientRect();
    pop.style.left = `${Math.min(r.left, window.innerWidth - 200)}px`;
    pop.style.top = `${r.bottom + 6}px`;
    pop.addEventListener("click", (e) => {
      const sw = (e.target as HTMLElement).closest<HTMLElement>("[data-cor]");
      if (!sw) return;
      this.hooks.run("color", sw.dataset.cor ?? "");
      this.fecharPop();
    });
    this.pop = pop;
    // fecha ao clicar fora
    setTimeout(() => {
      document.addEventListener("mousedown", this.foraPop, true);
    }, 0);
  }

  private foraPop = (e: MouseEvent) => {
    const t = e.target as HTMLElement;
    if (this.pop && !this.pop.contains(t) && !t.closest("[data-bar]")) this.fecharPop();
  };

  fecharPop(): void {
    this.pop?.remove();
    this.pop = null;
    document.removeEventListener("mousedown", this.foraPop, true);
  }

  /** Reflete o estado nos botões (liga/desliga, acende o ativo). */
  update(): void {
    const st = this.hooks.query();
    const on = (cmd: string, active: boolean) => this.el.querySelector(`[data-cmd="${cmd}"]`)?.classList.toggle("active", active);
    const dis = (cmd: string, d: boolean) => {
      const b = this.el.querySelector<HTMLButtonElement>(`[data-cmd="${cmd}"]`);
      if (b) b.disabled = d;
    };
    const sel = (nome: string, valor: string) => {
      const s = this.el.querySelector<HTMLSelectElement>(`[data-sel="${nome}"]`);
      if (s && s.value !== valor) s.value = valor;
    };

    // lâmina
    on("slide-up", false);
    dis("slide-up", st.indice <= 0);
    dis("slide-down", st.indice >= st.total - 1);
    dis("slide-del", st.total <= 1);
    dis("slide-new", !st.temLamina);

    // layout
    this.el.querySelectorAll<HTMLElement>("[data-layout]").forEach((b) => b.classList.toggle("active", b.dataset.layout === st.layout));

    // fonte / texto (só quando há forma de texto selecionada)
    on("bold", st.bold);
    on("italic", st.italic);
    on("align-left", st.align === "esquerda");
    on("align-center", st.align === "centro");
    on("align-right", st.align === "direita");
    on("align-justify", st.align === "justificado");
    sel("font", st.fontFamily);
    sel("size", String(st.fontSize));

    // barra de cor da fonte
    const barra = this.el.querySelector<HTMLElement>('[data-bar="color"]');
    if (barra) barra.style.background = st.color || "transparent";

    // inserir
    dis("shape-text", !st.temLamina);
    dis("shape-rect", !st.temLamina);
    dis("image", !st.temLamina);
    dis("shape-del", !st.temForma);

    // organizar (só quando há forma)
    const org = this.el.querySelector<HTMLElement>('[data-cmd="z-front"]')?.closest<HTMLElement>(".pt-group");
    if (org) org.hidden = !st.temForma;

    // o zoom mora na barra de status do palco (não na fita) — nada a refletir aqui
  }
}