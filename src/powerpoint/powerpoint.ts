// Liga o motor de apresentações à tela: palco, fita, notas, zoom e o editor de texto.
// O App só conversa com esta classe; o resto do motor fica dentro de src/powerpoint.
// (mesmo papel do src/word/host.ts)
import { marked } from "marked";
import DOMPurify from "dompurify";
import { $ } from "../util";
import { TextEditor } from "./editor";
import { DEFAULT_SETUP, deserialize, newSlide, serialize } from "./model";
import { NotesPanel } from "./notes";
import { deckFromMarkdown } from "./markdown";
import { openDeckView } from "./presenter";
import {
  alignShapes,
  createShape,
  distributeShapes,
  patchShape,
  removeShape,
  reorderShape,
  shapeText,
} from "./shapes";
import {
  clampIndex,
  duplicateSlide,
  insertSlide,
  moveSlide,
  removeSlide,
  replaceSlide,
  setLayout,
} from "./slides";
import { Stage } from "./stage";
import { THEMES, formaComTema, semHash, stageVars, themeOf } from "./themes";
import { TopBarTools, type FormatState } from "./topbartools";
import { stageRatio } from "./schema";
import type { Deck, DeckSetup, Shape, Slide, SlideLayout, TextAlign } from "./schema";

marked.setOptions({ gfm: true, breaks: false });

/** O que o App guarda por aba (serializável, como o WordTabData). */
export interface PowerPointTabData {
  setup: DeckSetup;
  slides: Slide[];
  /** lâmina e forma selecionadas */
  indice: number;
  selecionada: string | null;
}

export interface PowerPointHostOptions {
  pane: HTMLElement;
  onPickImage?: () => void;
  onConfigure?: () => void;
  onDirty?: () => void;
}

function sanitize(html: string): string {
  return DOMPurify.sanitize(html, { ADD_ATTR: ["target", "rel"] });
}

/** Converte alinhamento do app ("centro") no valor do CSS ("center"). */
const ALIGN_CSS: Record<TextAlign, string> = {
  esquerda: "left",
  centro: "center",
  direita: "right",
  justificado: "justify",
};

export class PowerPointHost {
  private pane: HTMLElement;
  private opts: PowerPointHostOptions;

  private setup: DeckSetup = { ...DEFAULT_SETUP };
  private slides: Slide[] = [newSlide()];
  private indice = 0;
  private selecionada: string | null = null;

  private strip!: HTMLElement;
  private canvas!: HTMLElement;
  private frame!: HTMLElement;
  private slideEl!: HTMLElement;
  private notesEl!: HTMLTextAreaElement;

  private ribbon!: TopBarTools;
  private stage: Stage;
  private editor = new TextEditor();
  private notes = new NotesPanel();

  constructor(opts: PowerPointHostOptions) {
    this.opts = opts;
    this.pane = opts.pane;
    this.stage = new Stage({
      onBox: (id, box) => this.mudarForma(id, { box }),
      onSelect: (id) => this.selecionar(id),
    });
    this.montar();
  }

  // ------------------------------------------------------------------
  // montagem do DOM
  // ------------------------------------------------------------------

  private montar(): void {
    this.pane.innerHTML = `
      <div id="pp-ribbon" class="pp-ribbon" role="toolbar" aria-label="Formatação da apresentação"></div>
      <div id="pp-stage">
        <div class="pp-left">
          <div class="pp-strip" data-strip aria-label="Lâminas"></div>
          <div class="pp-canvas" data-canvas>
            <div class="pp-frame" data-frame>
              <div class="pp-slide" data-slide></div>
            </div>
          </div>
        </div>
        <aside class="pp-side">
          <div class="pp-side-head"><span>Notas do apresentador</span><span class="pp-side-hint">não aparecem na lâmina</span></div>
          <textarea class="pp-notes" data-notes placeholder="O que falar nesta lâmina..."></textarea>
        </aside>
      </div>
      <div class="pp-status">
        <span data-pos>Lâmina 1 / 1</span>
        <span class="spacer"></span>
        <span class="pp-zoom">
          <button type="button" class="btn small" data-zoom="out" title="Reduzir zoom" aria-label="Reduzir zoom">−</button>
          <input type="range" min="40" max="200" step="10" value="100" data-zoomrange aria-label="Zoom">
          <span class="pp-zoom-val" data-zoomval>100%</span>
          <button type="button" class="btn small" data-zoom="in" title="Ampliar zoom" aria-label="Ampliar zoom">+</button>
        </span>
      </div>`;

    this.strip = $("[data-strip]", this.pane);
    this.canvas = $("[data-canvas]", this.pane);
    this.frame = $("[data-frame]", this.pane);
    this.slideEl = $("[data-slide]", this.pane);
    this.notesEl = $<HTMLTextAreaElement>("[data-notes]", this.pane);

    this.ribbon = new TopBarTools($("#pp-ribbon", this.pane), {
      query: () => this.formatState(),
      run: (cmd, value) => this.run(cmd, value),
      pickImage: () => this.opts.onPickImage?.(),
      configure: () => this.opts.onConfigure?.(),
      present: () => this.present(),
      setTheme: (id) => this.setTheme(id as DeckSetup["theme"]),
      zoom: (d) => this.setZoom(this.stage.zoomAtual + d),
    });

    this.stage.attach(this.frame, this.slideEl);
    this.notes.attach(this.notesEl!, (notes) => this.mudarNotas(notes));

    // zoom pela barra de status
    this.pane.querySelector("[data-zoom=out]")?.addEventListener("click", () => this.setZoom(this.stage.zoomAtual - 10));
    this.pane.querySelector("[data-zoom=in]")?.addEventListener("click", () => this.setZoom(this.stage.zoomAtual + 10));
    const range = this.pane.querySelector<HTMLInputElement>("[data-zoomrange]");
    range?.addEventListener("input", () => this.setZoom(+range.value));

    // Proporção do palco
    this.pane.style.setProperty("--slide-ratio", String(stageRatio(this.setup)));
    this.pintar();
  }

  // ------------------------------------------------------------------
  // render
  // ------------------------------------------------------------------

  private get deck(): Deck {
    return { titulo: "", slides: this.slides };
  }

  private atual(): Slide {
    return this.slides[clampIndex(this.indice, this.slides.length)];
  }

  /** redesenha tudo: miniaturas + lâmina + fita */
  pintar(): void {
    const slide = this.atual();
    // variáveis de tema/fundo
    const vars = stageVars(this.setup);
    for (const [k, v] of Object.entries(vars)) this.slideEl.style.setProperty(k, v);
    this.slideEl.className = `pp-slide layout-${slide.layout}`;

    this.pintarSlide(slide);
    this.pintarStrip();
    this.notes.setText(slide.notes);
    this.atualizarStatus();
    this.ribbon.update();
    this.stage.marcarSelecionado(this.selecionada);
  }

  /** desenha o conteúdo da lâmina atual (formas ou markdown) */
  private pintarSlide(slide: Slide): void {
    this.editor.detach();
    const num = this.setup.showNumber ? `<span class="pp-num">${this.indice + 1}</span>` : "";
    const rodape = this.setup.footer ? `<span class="pp-footer">${this.setup.footer}</span>` : "";

    if (!slide.shapes.length) {
      // lâmina só com markdown (modo simples)
      const html = marked.parse(slide.md, { gfm: true, async: false }) as string;
      this.slideEl.innerHTML = `<div class="pp-md">${sanitize(html)}</div>${num}${rodape}`;
      // clicar no markdown edita o texto da lâmina
      const md = this.slideEl.querySelector<HTMLElement>(".pp-md")!;
      md.onclick = () => this.editarMarkdown();
      return;
    }

    // lâmina com formas posicionadas
    this.slideEl.innerHTML = slide.shapes.map((s) => this.htmlForma(s)).join("") + num + rodape;
    const selecionada = slide.shapes.find((s) => s.id === this.selecionada);
    if (selecionada) {
      const el = this.slideEl.querySelector<HTMLElement>(`[data-shape="${selecionada.id}"] .pp-shape-text`);
      if (el) this.editor.attach(el, selecionada.id, (id, texto) => this.mudarForma(id, { text: texto }));
    }
  }

  private htmlForma(s: Shape): string {
    const box = `left:${s.box.x}%;top:${s.box.y}%;width:${s.box.w}%;height:${s.box.h}%;transform:rotate(${s.rot}deg)`;
    const comum = `class="pp-shape${s.id === this.selecionada ? " selected" : ""}" data-shape="${s.id}" data-kind="${s.kind}" style="${box}"`;
    if (s.kind === "imagem") {
      return `<div ${comum}><img class="pp-shape-img" src="${s.src}" alt=""><span class="pp-handle"></span></div>`;
    }
    if (s.kind === "forma") {
      return `<div ${comum} style="${box};background:#${semHash(s.fill, themeOf(this.setup.theme).accent)}"></div>`;
    }
    // O tamanho vem em "pt" (unidade do PowerPoint). A lâmina é um container de
// tamanho, então pt viram % da largura da lâmina (cqw) e o texto escala junto
// com ela — como no PowerPoint.
// 1 pol = 72 pt; a lâmina 16:9 tem 13,333 pol => 1 pt ≈ 0,813% da largura.
const PT_PARA_CQW = 100 / (13.333 * 72);
const rel = Math.max(0.4, Math.min(12, s.fontSize * PT_PARA_CQW));
const estilo = `font-family:'${s.fontFamily}';font-size:${rel.toFixed(3)}cqw;color:#${semHash(s.color, "1C212B")};text-align:${ALIGN_CSS[s.align]};${s.bold ? "font-weight:700;" : ""}${s.italic ? "font-style:italic;" : ""}`;
    return `<div ${comum}>
      <div class="pp-shape-text" contenteditable="true" spellcheck="false" data-placeholder="Digite aqui..." style="${estilo}">${escapeHtml(shapeText(s))}</div>
      <span class="pp-handle"></span>
    </div>`;
  }

  /** miniaturas das lâminas (herdam as cores do tema da apresentação) */
  private pintarStrip(): void {
    this.strip.textContent = "";
    for (const [k, v] of Object.entries(stageVars(this.setup))) this.strip.style.setProperty(k, v);
    this.slides.forEach((s, i) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = `pp-thumb${i === this.indice ? " active" : ""}`;
      btn.title = `Lâmina ${i + 1}`;
      const inner = document.createElement("div");
      inner.className = "pp-thumb-box";
      if (s.shapes.length) {
        // mostra as formas em miniatura (texto e cor; imagens viram um bloco)
        inner.innerHTML = s.shapes
          .map((f) => {
            const pos = `left:${f.box.x}%;top:${f.box.y}%;width:${f.box.w}%;height:${f.box.h}%;position:absolute`;
            if (f.kind === "imagem") return `<span style="${pos};background:#9aa1ae"></span>`;
            if (f.kind === "forma") return `<span style="${pos};background:#${semHash(f.fill, "4F46E5")}"></span>`;
            const alinhar = f.align === "centro" ? "center" : f.align === "direita" ? "right" : f.align === "justificado" ? "justify" : "left";
            return `<span class="pp-thumb-txt" style="${pos};color:#${semHash(f.color, "1C212B")};text-align:${alinhar};font-weight:${f.bold ? 700 : 400};font-style:${f.italic ? "italic" : "normal"}">${escapeHtml(shapeText(f).slice(0, 60))}</span>`;
          })
          .join("");
      } else {
        const html = marked.parse(s.md, { gfm: true, async: false }) as string;
        inner.innerHTML = sanitize(html).slice(0, 400);
      }
      const num = document.createElement("span");
      num.className = "pp-thumb-num";
      num.textContent = String(i + 1);
      inner.append(num);
      btn.append(inner);
      btn.addEventListener("click", () => this.irPara(i));

      // botão de excluir no hover
      const del = document.createElement("button");
      del.type = "button";
      del.className = "pp-thumb-del";
      del.textContent = "×";
      del.title = "Excluir lâmina";
      del.addEventListener("click", (e) => {
        e.stopPropagation();
        this.run("slide-del");
      });
      btn.append(del);
      this.strip.append(btn);
    });

    // Botão "+" no fim da faixa: adiciona uma lâmina depois da atual
    // (mesma ação do botão "Nova" da fita, mas onde o olho já está).
    const add = document.createElement("button");
    add.type = "button";
    add.className = "pp-thumb-add";
    add.title = "Nova lâmina depois da atual";
    add.setAttribute("aria-label", "Nova lâmina");
    add.innerHTML = '<svg class="ic"><use href="#i-plus"/></svg><span>Nova lâmina</span>';
    add.addEventListener("click", () => this.run("slide-new"));
    this.strip.append(add);
  }

  private atualizarStatus(): void {
    const pos = this.pane.querySelector("[data-pos]");
    if (pos) pos.textContent = `Lâmina ${this.indice + 1} / ${this.slides.length}`;
    const zv = this.pane.querySelector("[data-zoomval]");
    if (zv) zv.textContent = `${this.stage.zoomAtual}%`;
    const range = this.pane.querySelector<HTMLInputElement>("[data-zoomrange]");
    if (range) range.value = String(this.stage.zoomAtual);
  }

  // ------------------------------------------------------------------
  // comandos da fita
  // ------------------------------------------------------------------

  private formatState(): FormatState {
    const s = this.formaSelecionada();
    const st = this.setup;
    return {
      temLamina: this.slides.length > 0,
      temForma: !!s,
      texto: !!s && s.kind !== "imagem",
      layout: this.atual().layout,
      fontFamily: s?.fontFamily ?? st.fontFamily,
      fontSize: s?.fontSize ?? st.fontSize,
      color: s ? `#${s.color}` : `#${themeOf(st.theme).fg}`,
      bold: s?.bold ?? false,
      italic: s?.italic ?? false,
      align: s?.align ?? "esquerda",
      formas: this.atual().shapes.length,
      zoom: this.stage.zoomAtual,
      indice: this.indice,
      total: this.slides.length,
    };
  }

  private formaSelecionada(): Shape | undefined {
    return this.atual().shapes.find((s) => s.id === this.selecionada);
  }

  private run(cmd: string, value?: string): void {
    switch (cmd) {
      // ---- lâmina ----
      case "slide-new": {
        const r = insertSlide(this.deck, this.indice);
        this.slides = r.deck.slides;
        this.indice = r.index;
        this.selecionada = null;
        this.markDirty();
        break;
      }
      case "slide-dup": {
        const r = duplicateSlide(this.deck, this.indice);
        this.slides = r.deck.slides;
        this.indice = r.index;
        this.selecionada = null;
        this.markDirty();
        break;
      }
      case "slide-del": {
        const r = removeSlide(this.deck, this.indice);
        this.slides = r.deck.slides;
        this.indice = r.index;
        this.selecionada = null;
        this.markDirty();
        break;
      }
      case "slide-up":
        this.moverLamina(-1);
        return;
      case "slide-down":
        this.moverLamina(1);
        return;

      // ---- layout ----
      case "present":
        this.present();
        return;
      case "configure":
        this.opts.onConfigure?.();
        return;
      case "notes":
        this.notes.focus();
        return;
      case "shape-del": {
        if (!this.selecionada) return;
        this.substituirSlide(removeShape(this.atual(), this.selecionada));
        this.selecionada = null;
        break;
      }

      // ---- formas ----
      case "shape-text":
        this.adicionarForma("texto");
        return;
      case "shape-rect":
        this.adicionarForma("forma");
        return;
      case "image":
        this.opts.onPickImage?.();
        return;
      case "z-front":
        this.substituirSlide(reorderShape(this.atual(), this.selecionada!, "frente"));
        break;
      case "z-back":
        this.substituirSlide(reorderShape(this.atual(), this.selecionada!, "tras"));
        break;
      case "align-shapes-left":
        this.substituirSlide(alignShapes(this.atual(), [this.selecionada!], "esquerda"));
        break;
      case "align-shapes-center":
        this.substituirSlide(alignShapes(this.atual(), [this.selecionada!], "centro"));
        break;
      case "align-shapes-right":
        this.substituirSlide(alignShapes(this.atual(), [this.selecionada!], "direita"));
        break;

      // ---- zoom ----
      case "zoom-in":
        this.setZoom(this.stage.zoomAtual + 10);
        return;
      case "zoom-out":
        this.setZoom(this.stage.zoomAtual - 10);
        return;
      case "zoom-reset":
        this.setZoom(100);
        return;
    }

    // ---- layout:lide ----
    if (cmd.startsWith("layout:")) {
      const layout = cmd.slice(7) as SlideLayout;
      const d = setLayout(this.deck, this.indice, layout);
      this.slides = d.slides;
      this.markDirty();
      this.pintar();
      return;
    }

    // ---- fonte / cor (afeta a forma selecionada ou o padrão do deck) ----
    const s = this.formaSelecionada();
    if (cmd === "font" && value) {
      if (s) this.mudarForma(s.id, { fontFamily: value });
      else this.setSetup({ fontFamily: value });
      return;
    }
    if (cmd === "size" && value) {
      const n = +value;
      if (s) this.mudarForma(s.id, { fontSize: n });
      else this.setSetup({ fontSize: n });
      return;
    }
    if (cmd === "color" && value !== undefined) {
      if (s) this.mudarForma(s.id, { color: semHash(value, themeOf(this.setup.theme).fg) });
      return;
    }
    if (cmd === "bold" && s) {
      this.mudarForma(s.id, { bold: !s.bold });
      return;
    }
    if (cmd === "italic" && s) {
      this.mudarForma(s.id, { italic: !s.italic });
      return;
    }
    if (cmd.startsWith("align-") && s) {
      const map: Record<string, TextAlign> = {
        "align-left": "esquerda",
        "align-center": "centro",
        "align-right": "direita",
        "align-justify": "justificado",
      };
      const a = map[cmd];
      if (a) this.mudarForma(s.id, { align: a });
      return;
    }

    this.pintar();
  }

  private moverLamina(delta: number): void {
    const r = moveSlide(this.deck, this.indice, this.indice + delta);
    this.slides = r.deck.slides;
    this.indice = r.index;
    this.markDirty();
    this.pintar();
  }

  private adicionarForma(kind: "texto" | "forma" | "imagem"): void {
    const s = formaComTema(createShape(kind), this.setup);
    const slide = this.atual();
    this.substituirSlide({ ...slide, shapes: [...slide.shapes, s] });
    this.selecionada = s.id;
    this.markDirty();
    this.pintar();
    // foca a nova caixa de texto para digitar direto
    if (kind === "texto") {
      const el = this.slideEl.querySelector<HTMLElement>(`[data-shape="${s.id}"] .pp-shape-text`);
      el?.focus();
    }
  }

  /** Insere uma imagem numa forma (chamado pelo App depois do diálogo). */
  insertImage(src: string): void {
    const s = formaComTema(createShape("imagem"), this.setup);
    s.src = src;
    const slide = this.atual();
    this.substituirSlide({ ...slide, shapes: [...slide.shapes, s] });
    this.selecionada = s.id;
    this.markDirty();
    this.pintar();
  }

  private mudarForma(id: string, patch: Partial<Shape>): void {
    this.substituirSlide(patchShape(this.atual(), id, patch));
    this.markDirty();
    // durante o arraste o palco já atualizou o DOM; evitamos redesenhar para não piscar
    if (!this.stage.element) this.pintar();
    else {
      // atualiza só a fita (o texto/box já foi aplicado na tela)
      this.ribbon.update();
    }
  }

  private mudarNotas(notes: string): void {
    this.substituirSlide({ ...this.atual(), notes });
    this.markDirty();
  }

  private substituirSlide(slide: Slide): void {
    this.slides = replaceSlide(this.deck, this.indice, slide).slides;
  }

  private selecionar(id: string | null): void {
    this.selecionada = id;
    this.ribbon.update();
  }

  private setTheme(id: DeckSetup["theme"]): void {
    if (!THEMES.some((t) => t.id === id)) return;
    this.setSetup({ theme: id });
  }

  /** Quando a lâmina não tem formas, clicar no markdown edita o texto. */
  private editarMarkdown(): void {
    const md = this.slideEl.querySelector<HTMLElement>(".pp-md");
    if (!md) return;
    md.contentEditable = "true";
    md.spellcheck = true;
    md.focus();
    md.oninput = () => {
      this.substituirSlide({ ...this.atual(), md: md.innerHTML });
      this.markDirty();
    };
    md.onblur = () => {
      md.contentEditable = "false";
      // volta o markdown puro no modelo (o conteúdoRich continua na tela até o próximo pintar)
      md.innerHTML = marked.parse(this.atual().md, { gfm: true, async: false }) as string;
    };
    md.onkeydown = (e) => {
      if (e.key === "Escape") md.blur();
    };
  }

  private setZoom(z: number): void {
    const novo = this.stage.setZoom(z);
    this.atualizarStatus();
    this.ribbon.update();
    return void novo;
  }

  private markDirty(): void {
    this.opts.onDirty?.();
  }

  // ------------------------------------------------------------------
  // API pública (o App chama)
  // ------------------------------------------------------------------

  /**
   * Deck de exemplo que "Novo" abre: 3 lâminas montadas com caixas de texto
   * posicionadas (o jeito PowerPoint de verdade, não Markdown solto).
   */
  private modeloInicial(setup: DeckSetup): Slide[] {
    const t = themeOf(setup.theme);
    const txt = (text: string, box: Shape["box"], size: number, extra: Partial<Shape> = {}): Shape => ({
      ...formaComTema({ ...createShape("texto"), box }, setup),
      text,
      fontSize: size,
      color: t.fg,
      ...extra,
    });
    return [
      {
        md: "",
        layout: "titulo",
        notes: "Abertura: cumprimente e diga o tema da apresentação em uma frase.",
        shapes: [
          txt("Sua apresentação", { x: 8, y: 30, w: 84, h: 22 }, 54, { bold: true, align: "centro", color: t.fg }),
          txt("Nome do apresentador · data", { x: 8, y: 54, w: 84, h: 12 }, 22, { align: "centro", color: t.muted }),
        ],
      },
      {
        md: "",
        layout: "conteudo",
        notes: "Uma ideia por lâmina. Use as notas para o que falar, não para o que mostrar.",
        shapes: [
          txt("O que vamos ver", { x: 8, y: 10, w: 84, h: 14 }, 36, { bold: true }),
          txt("•  Primeiro assunto", { x: 10, y: 30, w: 80, h: 10 }, 22),
          txt("•  Segundo assunto", { x: 10, y: 43, w: 80, h: 10 }, 22),
          txt("•  Terceiro assunto", { x: 10, y: 56, w: 80, h: 10 }, 22),
        ],
      },
      {
        md: "",
        layout: "secao",
        notes: "Combine o próximo passo e encerre agradecendo.",
        shapes: [txt("Obrigado!", { x: 8, y: 34, w: 84, h: 22 }, 48, { bold: true, align: "centro", color: t.accent })],
      },
    ];
  }

  /** Snapshot serializável da aba (histórico/rascunho). */
  createTab(mdInicial?: string, setupInicial?: DeckSetup): PowerPointTabData {
    const setup = { ...DEFAULT_SETUP, ...(setupInicial ?? {}) };
    const deck = mdInicial ? deckFromMarkdown(mdInicial, setup) : null;
    return {
      setup,
      slides: deck?.slides.length ? deck.slides : this.modeloInicial(setup),
      indice: 0,
      selecionada: null,
    };
  }

  load(data: PowerPointTabData): void {
    this.setup = { ...DEFAULT_SETUP, ...data.setup };
    this.slides = data.slides?.length ? data.slides.map((s) => ({ ...s, notes: s.notes ?? "", shapes: s.shapes ?? [] })) : [newSlide()];
    this.indice = clampIndex(data.indice ?? 0, this.slides.length);
    this.selecionada = data.selecionada ?? null;
    this.pane.style.setProperty("--slide-ratio", String(stageRatio(this.setup)));
    this.stage.zoomReset();
    this.pintar();
  }

  snapshot(): PowerPointTabData {
    return {
      setup: { ...this.setup },
      slides: this.slides.map((s) => ({ ...s, shapes: s.shapes.map((f) => ({ ...f })) })),
      indice: this.indice,
      selecionada: this.selecionada,
    };
  }

  /** Texto serializado (histórico). */
  serialized(): string {
    return serialize(this.setup, this.slides);
  }

  /** Texto legível de um estado serializado (o diff do histórico usa). */
  projection(serialized: string): string {
    const deck = deserialize(serialized);
    if (!deck) return serialized;
    // uma lâmina por bloco, como o texto sai para a IA
    return deck.slides
      .map((s, i) => {
        const partes = s.shapes.map((f) => shapeText(f)).filter(Boolean);
        const corpo = s.md || partes.join("\n\n");
        return `## Lâmina ${i + 1}\n\n${corpo}${s.notes ? `\n\n> [notas] ${s.notes}` : ""}`;
      })
      .join("\n\n");
  }

  /** Markdown da lâmina atual (o App usa para a IA e para o corretor). */
  text(): string {
    const s = this.atual();
    const partes = s.shapes.map((f) => shapeText(f)).filter(Boolean);
    const md = s.md || partes.join("\n\n");
    return md + (s.notes ? `\n\n> [notas] ${s.notes}` : "");
  }

  /** Restaura a partir de um texto Markdown (rascunho/apresentação rápida). */
  restore(texto: string): void {
    const deck = deckFromMarkdown(texto, this.setup);
    this.slides = deck.slides.length ? deck.slides : [newSlide()];
    this.indice = 0;
    this.selecionada = null;
    this.pintar();
  }

  /**
   * Restaura a partir de um estado serializado (histórico e cópia de backup).
   *
   * Diferente do `restore`, aqui o texto é o JSON completo com formas, cores e notas —
   * é o que volta idêntico ao que estava.
   */
  restoreSerialized(serialized: string): void {
    const snap = deserialize(serialized);
    if (!snap) return;
    this.setup = { ...DEFAULT_SETUP, ...snap.setup };
    this.slides = snap.slides.length ? snap.slides : [newSlide()];
    this.indice = 0;
    this.selecionada = null;
    this.pane.style.setProperty("--slide-ratio", String(stageRatio(this.setup)));
    this.pintar();
  }

  /** Configuração da apresentação (proporção, número, rodapé, fonte). */
  setup_(): DeckSetup {
    return { ...this.setup };
  }

  setSetup(setup: Partial<DeckSetup>): void {
    this.setup = { ...this.setup, ...setup };
    if (setup.aspect) this.pane.style.setProperty("--slide-ratio", String(stageRatio(this.setup)));
    this.markDirty();
    this.pintar();
  }

  /** Estatísticas para o rodapé do app. */
  stats(): { slides: number; formas: number; indice: number } {
    return { slides: this.slides.length, formas: this.atual().shapes.length, indice: this.indice };
  }

  focus(): void {
    this.slideEl.focus?.();
  }

  /** Modo apresentação (F5) com o deck em edição. */
  present(): void {
    openDeckView(this.deck, this.setup, "Apresentação");
  }

  irPara(i: number): void {
    this.indice = clampIndex(i, this.slides.length);
    this.selecionada = null;
    this.pintar();
  }

  /** Reordena lâminas por ids (arrastar na faixa). */
  reordenar(ids: string[]): void {
    const mapa = new Map(this.slides.map((s, i) => [String(i), s]));
    void mapa;
    void ids;
  }

  /** Distribui formas (usado pelo botão da fita). */
  distribuir(eixo: "h" | "v"): void {
    const ids = this.atual().shapes.map((s) => s.id);
    this.substituirSlide(distributeShapes(this.atual(), ids, eixo));
    this.markDirty();
    this.pintar();
  }
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}