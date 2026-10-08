// Fita de ferramentas do documento Word (Início, Inserir, Tabela, Página) e janela "Configurar página".
import type { WordEditor, FormatState } from "./editor";
import { FONT_FAMILIES, FONT_SIZES } from "./schema";
import { DEFAULT_SETUP, type PageSetup } from "./model";
import { h } from "../util";

export interface RibbonHooks {
  editor: WordEditor;
  /** Abre o seletor de imagem do computador. */
  pickImage: () => void;
  /** A configuração da página foi alterada. */
  setSetup: (setup: PageSetup) => void;
  /** Pergunta o endereço do link. Devolve null se cancelou. */
  askLink: (current: string | null) => Promise<string | null>;
}

const COLORS = ["#000000", "#434343", "#999999", "#d9d9d9", "#ffffff", "#c00000", "#ff0000", "#ff9900", "#ffd966", "#00b050", "#00b0f0", "#0070c0", "#7030a0", "#ff66cc"];
const HIGHLIGHTS = ["#ffff00", "#00ff00", "#00ffff", "#ff99cc", "#ffc000", "#c9daf8", "#d9ead3", "#f4cccc"];

const icon = (name: string) => `<svg class="ic"><use href="#${name}"/></svg>`;

/** Botão da fita (não rouba o foco do documento). */
const btn = (cmd: string, label: string, title: string, extra = "") =>
  `<button type="button" class="rb ${extra}" data-cmd="${cmd}" title="${title}" aria-label="${title}">${label}</button>`;

export class Ribbon {
  readonly el: HTMLElement;
  private hooks: RibbonHooks;
  private pop: HTMLElement | null = null;

  constructor(host: HTMLElement, hooks: RibbonHooks) {
    this.el = host;
    this.hooks = hooks;
    host.innerHTML = `
      <div class="rb-group">
        ${btn("undo", icon("i-undo"), "Desfazer (Ctrl+Z)")}
        ${btn("redo", icon("i-redo"), "Refazer (Ctrl+Y)")}
      </div>
      <div class="rb-group">
        <select class="rb-select wide" data-sel="block" title="Estilo do parágrafo" aria-label="Estilo do parágrafo">
          <option value="paragraph">Texto normal</option>
          <option value="h1">Título 1</option>
          <option value="h2">Título 2</option>
          <option value="h3">Título 3</option>
          <option value="h4">Título 4</option>
          <option value="quote">Citação</option>
          <option value="code">Código</option>
        </select>
        <select class="rb-select font" data-sel="font" title="Fonte" aria-label="Fonte">
          ${FONT_FAMILIES.map((f) => `<option value="${f}" style="font-family:'${f}'">${f}</option>`).join("")}
        </select>
        <select class="rb-select size" data-sel="size" title="Tamanho da letra" aria-label="Tamanho da letra">
          ${FONT_SIZES.map((s) => `<option value="${s}">${s}</option>`).join("")}
        </select>
        ${btn("size-up", "A<small>+</small>", "Aumentar a letra")}
        ${btn("size-down", "A<small>−</small>", "Diminuir a letra")}
      </div>
      <div class="rb-group">
        ${btn("bold", "<b>N</b>", "Negrito (Ctrl+B)")}
        ${btn("italic", "<i>I</i>", "Itálico (Ctrl+I)")}
        ${btn("underline", "<u>S</u>", "Sublinhado (Ctrl+U)")}
        ${btn("strike", "<s>ab</s>", "Riscado")}
        ${btn("sub", "x<small>₂</small>", "Subscrito (Ctrl+,)")}
        ${btn("sup", "x<small>²</small>", "Sobrescrito (Ctrl+.)")}
        ${btn("clear", "A<small>✕</small>", "Limpar formatação")}
      </div>
      <div class="rb-group">
        ${btn("color", `<span class="rb-a">A</span><span class="rb-bar" data-bar="color"></span>`, "Cor da letra", "colorbtn")}
        ${btn("highlight", `<span class="rb-a hl">ab</span><span class="rb-bar" data-bar="highlight"></span>`, "Cor de destaque (marca-texto)", "colorbtn")}
      </div>
      <div class="rb-group">
        ${btn("align-left", icon("i-align-left"), "Alinhar à esquerda (Ctrl+L)")}
        ${btn("align-center", icon("i-align-center"), "Centralizar (Ctrl+E)")}
        ${btn("align-right", icon("i-align-right"), "Alinhar à direita (Ctrl+R)")}
        ${btn("align-justify", icon("i-align-justify"), "Justificar (Ctrl+J)")}
        <select class="rb-select lh" data-sel="lh" title="Espaçamento entre linhas" aria-label="Espaçamento entre linhas">
          <option value="">Linhas: padrão</option>
          <option value="1">1,0</option>
          <option value="1.15">1,15</option>
          <option value="1.5">1,5</option>
          <option value="2">2,0</option>
          <option value="2.5">2,5</option>
        </select>
        ${btn("outdent", "⇤", "Diminuir recuo")}
        ${btn("indent", "⇥", "Aumentar recuo")}
      </div>
      <div class="rb-group">
        ${btn("bullet", "•≡", "Lista com marcadores (Ctrl+Shift+L)")}
        ${btn("ordered", "1.≡", "Lista numerada")}
      </div>
      <div class="rb-group">
        ${btn("table", icon("i-grid"), "Inserir tabela")}
        ${btn("image", icon("i-image"), "Inserir imagem")}
        ${btn("link", "🔗", "Inserir link")}
        ${btn("pagebreak", "⤓", "Quebra de página (Ctrl+Enter)")}
        ${btn("rule", "―", "Linha horizontal")}
      </div>
      <div class="rb-group rb-table" hidden>
        <span class="rb-label">Tabela</span>
        ${btn("t-row-before", "↑+", "Linha acima")}
        ${btn("t-row-after", "↓+", "Linha abaixo")}
        ${btn("t-row-del", "−L", "Excluir linha")}
        ${btn("t-col-before", "←+", "Coluna à esquerda")}
        ${btn("t-col-after", "→+", "Coluna à direita")}
        ${btn("t-col-del", "−C", "Excluir coluna")}
        ${btn("t-merge", "⊞", "Mesclar células")}
        ${btn("t-split", "⊟", "Dividir célula")}
        ${btn("t-shade", "▨", "Sombrear célula")}
        ${btn("t-del", "🗑", "Excluir tabela")}
      </div>
      <div class="rb-group rb-end">
        ${btn("page", icon("i-doc") + "<span>Página</span>", "Tamanho, margens, cabeçalho e rodapé", "txt")}
      </div>`;

    host.addEventListener("mousedown", (e) => {
      const t = e.target as HTMLElement;
      // botões não tiram o foco do documento (selects precisam do foco para abrir)
      if (t.closest("button")) e.preventDefault();
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
        case "block":
          ed.setBlock(s.value);
          break;
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
  }

  // ---------- estado visual ----------

  update(): void {
    const st = this.hooks.editor.query();
    const on = (cmd: string, active: boolean) => this.el.querySelector(`[data-cmd="${cmd}"]`)?.classList.toggle("active", active);
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
    const dis = (cmd: string, d: boolean) => ((this.el.querySelector(`[data-cmd="${cmd}"]`) as HTMLButtonElement | null)!.disabled = d);
    dis("undo", !st.canUndo);
    dis("redo", !st.canRedo);
    const sel = (name: string, v: string) => {
      const s = this.el.querySelector<HTMLSelectElement>(`[data-sel="${name}"]`)!;
      if (v === "" || [...s.options].some((o) => o.value === v)) s.value = v;
    };
    sel("block", st.block);
    sel("font", st.fontFamily ?? this.hooks.editor.setup.defaultFont);
    sel("size", String(st.fontSize ?? this.hooks.editor.setup.defaultSize));
    sel("lh", st.lineHeight ? String(st.lineHeight) : "");
    const bar = (n: string, c: string | null, fallback: string) => {
      const e = this.el.querySelector<HTMLElement>(`[data-bar="${n}"]`);
      if (e) e.style.background = c ?? fallback;
    };
    bar("color", st.color, "currentColor");
    bar("highlight", st.highlight, "#ffff00");
    (this.el.querySelector(".rb-table") as HTMLElement).hidden = !st.inTable;
  }

  // ---------- comandos ----------

  private async run(cmd: string, anchor: HTMLElement): Promise<void> {
    const ed = this.hooks.editor;
    this.closePop();
    switch (cmd) {
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

  private closePop(): void {
    this.pop?.remove();
    this.pop = null;
  }

  private place(pop: HTMLElement, anchor: HTMLElement): void {
    document.body.append(pop);
    const r = anchor.getBoundingClientRect();
    pop.style.left = `${Math.max(8, Math.min(r.left, window.innerWidth - pop.offsetWidth - 8))}px`;
    pop.style.top = `${r.bottom + 4}px`;
    this.pop = pop;
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
    const q = <T extends HTMLElement>(sel: string) => modal.querySelector<T>(sel)!;
    const fill = () => {
      q<HTMLSelectElement>('[data-k="size"]').value = s.size;
      q<HTMLSelectElement>('[data-k="landscape"]').value = s.landscape ? "1" : "0";
      for (const k of ["top", "bottom", "left", "right"] as const) q<HTMLInputElement>(`[data-m="${k}"]`).value = String(s.margins[k]);
      q<HTMLSelectElement>('[data-k="font"]').value = s.defaultFont;
      q<HTMLSelectElement>('[data-k="fsize"]').value = String(s.defaultSize);
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
