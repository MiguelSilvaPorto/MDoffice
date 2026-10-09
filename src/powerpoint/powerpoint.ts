// Liga o motor de apresentações à tela: palco, fita, painel de formatação, notas, zoom e o editor de texto.
// O App só conversa com esta classe; o resto do motor fica dentro de src/powerpoint.
// (mesmo papel do src/word/host.ts)
import { marked } from "marked";
import DOMPurify from "dompurify";
import { $ } from "../util";
import { caixaCentrada, estiloDoDeck, GALERIA, novaCaixaDeTexto, novaForma, novaImagem, type EstiloDeck, type ItemGaleria } from "./edicao/criar";
import { ajustarCor, comAjuste, comLinha, comOpacidade, comPreenchimento, comRaioDeCanto, comSombra, gradiente, SOMBRAS_PRONTAS, solido, corPrincipal } from "./edicao/formato";
import { aspectSize, stageRatio } from "./schema";
import type { Dim } from "./edicao/geometria";
import { Historico } from "./edicao/historico";
import { migrarSlides, registrarMidia } from "./edicao/migrar";
import {
  agruparFormas,
  alinharFormas,
  colarFormas,
  comGrupos,
  desagruparFormas,
  distribuirFormas,
  duplicarFormas,
  espelharFormas,
  igualarTamanho,
  ordemDasFormas,
  patchFormas,
  removerFormas,
  type ModoAlinhar,
} from "./edicao/operacoes";
import { lerSelecao, restaurarSelecao, textoDaCaixa } from "./edicao/selecaoDom";
import { alternarMarcador, estadoDoTrecho, estiloDosParas, estiloNoIntervalo, mudarRecuo, mudarTamanhoRelativo, parasDaSelecao, type EstiloRun, type RunPatch } from "./edicao/texto";
import { DEFAULT_SETUP, deserialize, newSlide, serialize } from "./model";
import { NotesPanel } from "./notes";
import { deckFromMarkdown } from "./markdown";
import { openDeckView } from "./presenter";
import { aoCarregarFontes, fundoValor, htmlFormaRica, parasComEstilo, parasComTexto, registrarFontes, type CtxRender } from "./render/forma";
import { shapeText } from "./shapes";
import { clampIndex, duplicateSlide, insertSlide, moveSlide, removeSlide, replaceSlide, setLayout } from "./slides";
import { Stage, type Ferramenta } from "./stage";
import { THEMES, stageVars, themeOf } from "./themes";
import { Fita } from "./ui/fita";
import { Painel } from "./ui/painel";
import { abrirPopup, fecharPopup } from "./ui/popup";
import type { EstadoUI } from "./ui/estado";
import type { Deck, DeckSetup, Fill, Shape, ShapeBox, Slide, SlideLayout, TextAlign } from "./schema";

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
  /** pede uma imagem ao usuário; `destino` diz o que fazer com ela (inserir, preencher, fundo, trocar) */
  onPickImage?: (destino?: string) => void;
  onConfigure?: () => void;
  onDirty?: () => void;
}

function sanitize(html: string): string {
  return DOMPurify.sanitize(html, { ADD_ATTR: ["target", "rel"] });
}

/** Estado desfazível: as lâminas (imutáveis), a lâmina atual e a seleção. */
interface Estado {
  slides: Slide[];
  indice: number;
  selecao: string[];
}

/** Formas copiadas (valem entre abas de apresentação). */
let areaDeTransferencia: Shape[] = [];

const lerFlag = (chave: string, padrao: boolean): boolean => {
  try {
    const v = localStorage.getItem(chave);
    return v === null ? padrao : v === "1";
  } catch {
    return padrao;
  }
};
const gravarFlag = (chave: string, v: boolean): void => {
  try {
    localStorage.setItem(chave, v ? "1" : "0");
  } catch {
    /* sem armazenamento */
  }
};

export class PowerPointHost {
  private pane: HTMLElement;
  private opts: PowerPointHostOptions;

  private setup: DeckSetup = { ...DEFAULT_SETUP };
  private slides: Slide[] = [newSlide()];
  private indice = 0;
  private selecao: string[] = [];
  private editando: string | null = null;
  private ferramenta: Ferramenta = null;
  private fixas = false;
  private encaixe = lerFlag("mdc.pp.encaixe", true);
  private grade = lerFlag("mdc.pp.grade", false);
  private hist = new Historico<Estado>(100);
  private pendente: Estado | null = null;
  private antesEdicao: Estado | null = null;
  private destinoImagem = "inserir";
  private lateral: "formatar" | "notas" = "formatar";

  private strip!: HTMLElement;
  private canvas!: HTMLElement;
  private frame!: HTMLElement;
  private slideEl!: HTMLElement;
  private notesEl!: HTMLTextAreaElement;

  private fita!: Fita;
  private painel!: Painel;
  private stage: Stage;
  private notes = new NotesPanel();

  constructor(opts: PowerPointHostOptions) {
    this.opts = opts;
    this.pane = opts.pane;
    this.stage = new Stage({
      contexto: () => ({
        shapes: this.atual().shapes,
        dim: this.dim(),
        selecao: this.selecao,
        editando: this.editando,
        ferramenta: this.ferramenta,
        fixasSelecionaveis: this.fixas,
        comGrupos: (ids) => comGrupos(this.atual(), ids),
      }),
      aoSelecionar: (ids) => this.selecionar(ids),
      aoTransformar: (patches, fase) => this.aoTransformar(patches, fase),
      aoEditarTexto: (id) => this.entrarEdicao(id),
      aoCriar: (c) => this.aoCriar(c),
      aoDuplicarParaArrastar: () => this.duplicarParaArrastar(),
    });
    this.montar();
    // fonte da web carregou: as medidas de entrelinha mudam, então redesenha (sem derrubar quem está digitando)
    aoCarregarFontes(() => {
      if (!this.editando && !this.stage.arrastando) this.pintar();
    });
    document.addEventListener("keydown", (e) => this.aoTecla(e), true);
    document.addEventListener("paste", (e) => this.aoColarDoSistema(e));
    document.addEventListener("selectionchange", () => {
      if (this.editando) this.atualizarUI();
    });
  }

  // ------------------------------------------------------------------
  // montagem do DOM
  // ------------------------------------------------------------------

  private montar(): void {
    this.pane.innerHTML = `
      <div id="pp-ribbon" class="pp-ribbon ppr" role="toolbar" aria-label="Ferramentas da apresentação"></div>
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
          <div class="pp-side-tabs">
            <button type="button" class="on" data-lateral="formatar">Formatar</button>
            <button type="button" data-lateral="notas">Notas</button>
          </div>
          <div class="pp-side-corpo pp-painel" data-formatar></div>
          <div class="pp-side-corpo" data-notas-corpo hidden>
            <div class="pp-side-head"><span>Notas do apresentador</span><span class="pp-side-hint">não aparecem na lâmina</span></div>
            <textarea class="pp-notes" data-notes placeholder="O que falar nesta lâmina..."></textarea>
          </div>
        </aside>
      </div>
      <div class="pp-status">
        <span data-pos>Lâmina 1 / 1</span>
        <span class="spacer"></span>
        <span class="pp-zoom">
          <button type="button" class="btn small" data-zoom="out" title="Reduzir zoom" aria-label="Reduzir zoom">−</button>
          <input type="range" min="40" max="300" step="10" value="100" data-zoomrange aria-label="Zoom">
          <span class="pp-zoom-val" data-zoomval>100%</span>
          <button type="button" class="btn small" data-zoom="in" title="Ampliar zoom" aria-label="Ampliar zoom">+</button>
        </span>
      </div>`;

    this.strip = $("[data-strip]", this.pane);
    this.canvas = $("[data-canvas]", this.pane);
    this.frame = $("[data-frame]", this.pane);
    this.slideEl = $("[data-slide]", this.pane);
    this.notesEl = $<HTMLTextAreaElement>("[data-notes]", this.pane);

    this.fita = new Fita($("#pp-ribbon", this.pane), { estado: () => this.estadoUI(), run: (c, v) => this.run(c, v) });
    this.painel = new Painel($("[data-formatar]", this.pane), { estado: () => this.estadoUI(), run: (c, v) => this.run(c, v) });

    this.stage.attach(this.frame, this.slideEl);
    this.notes.attach(this.notesEl, (notes) => this.mudarNotas(notes));

    // abas do painel lateral
    for (const b of this.pane.querySelectorAll<HTMLElement>("[data-lateral]")) {
      b.addEventListener("click", () => this.mostrarLateral(b.dataset.lateral as "formatar" | "notas"));
    }

    // zoom
    for (const b of this.pane.querySelectorAll<HTMLElement>("[data-zoom]")) {
      b.addEventListener("click", () => this.run(b.dataset.zoom === "in" ? "zoom-in" : "zoom-out"));
    }
    const range = this.pane.querySelector<HTMLInputElement>("[data-zoomrange]");
    range?.addEventListener("input", () => this.setZoom(+range.value));

    // arrastar uma imagem do computador para a lâmina
    this.canvas.addEventListener("dragover", (e) => {
      if (e.dataTransfer?.types.includes("Files")) e.preventDefault();
    });
    this.canvas.addEventListener("drop", (e) => {
      const arq = Array.from(e.dataTransfer?.files ?? []).find((f) => f.type.startsWith("image/"));
      if (!arq) return;
      e.preventDefault();
      void this.lerArquivoDeImagem(arq).then((src) => this.insertImage(src));
    });
    // menu de contexto
    this.slideEl.addEventListener("contextmenu", (e) => this.menuDeContexto(e));

    this.pane.style.setProperty("--slide-ratio", String(stageRatio(this.setup)));
    this.pintar();
  }

  private mostrarLateral(qual: "formatar" | "notas"): void {
    this.lateral = qual;
    for (const b of this.pane.querySelectorAll<HTMLElement>("[data-lateral]")) b.classList.toggle("on", b.dataset.lateral === qual);
    this.pane.querySelector<HTMLElement>("[data-formatar]")!.hidden = qual !== "formatar";
    this.pane.querySelector<HTMLElement>("[data-notas-corpo]")!.hidden = qual !== "notas";
    if (qual === "notas") this.notes.focus();
    else this.painel.atualizar();
  }

  // ------------------------------------------------------------------
  // acesso ao estado
  // ------------------------------------------------------------------

  private get deck(): Deck {
    return { titulo: "", slides: this.slides };
  }

  private atual(): Slide {
    return this.slides[clampIndex(this.indice, this.slides.length)];
  }

  /** Tamanho da lâmina em pt. */
  private dim(): Dim {
    const { w, h } = aspectSize(this.setup);
    return { w: w * 72, h: h * 72 };
  }

  private formas(): Shape[] {
    return this.atual().shapes.filter((s) => this.selecao.includes(s.id));
  }

  private principal(): Shape | undefined {
    const f = this.formas();
    return f[f.length - 1];
  }

  private estilo(): EstiloDeck {
    return estiloDoDeck(this.slides, this.setup);
  }

  private estado(): Estado {
    return { slides: this.slides, indice: this.indice, selecao: this.selecao };
  }

  private restaurar(e: Estado): void {
    this.slides = e.slides;
    this.indice = clampIndex(e.indice, e.slides.length);
    const ids = new Set(this.atual().shapes.map((s) => s.id));
    this.selecao = e.selecao.filter((id) => ids.has(id));
    this.editando = null;
    this.markDirty();
    this.pintar();
  }

  private registrar(chave = ""): void {
    this.hist.registrar(this.estado(), chave);
  }

  private substituirSlide(slide: Slide): void {
    this.slides = replaceSlide(this.deck, this.indice, slide).slides;
  }

  /** Aplica uma edição à lâmina atual: guarda o desfazer, troca a lâmina e redesenha. */
  private editar(fn: (s: Slide) => Slide, chave = ""): void {
    const antes = this.atual();
    const depois = fn(antes);
    if (depois === antes) return;
    this.registrar(chave);
    this.substituirSlide(depois);
    this.markDirty();
    this.pintar();
  }

  // ------------------------------------------------------------------
  // desenho
  // ------------------------------------------------------------------

  private ctxRender(editavel: boolean): CtxRender {
    const { w, h } = this.dim();
    return { larguraPt: w, alturaPt: h, media: this.setup.media ?? {}, selecionada: null, editavel, editando: editavel ? this.editando : null };
  }

  /** redesenha tudo: miniaturas + lâmina + fita + painel */
  pintar(): void {
    const slide = this.atual();
    for (const [k, v] of Object.entries(stageVars(this.setup))) this.slideEl.style.setProperty(k, v);
    this.slideEl.className = `pp-slide layout-${slide.layout}${this.fixas ? " pp-fixas-on" : ""}`;
    this.slideEl.style.background = fundoValor(slide.bg, this.setup.media ?? {});
    this.pintarSlide(slide);
    this.pintarStrip();
    this.notes.setText(slide.notes);
    this.atualizarStatus();
    this.atualizarUI();
  }

  /** só a lâmina e a seleção (usado enquanto se arrasta, para não refazer as miniaturas a cada quadro) */
  private pintarRapido(): void {
    this.pintarSlide(this.atual());
    this.atualizarUI();
  }

  private atualizarUI(): void {
    this.fita.atualizar();
    this.painel.atualizar();
    this.stage.desenharSelecao();
  }

  /** desenha o conteúdo da lâmina atual (formas ou markdown) */
  private pintarSlide(slide: Slide): void {
    if (!slide.shapes.length) {
      // lâmina só com markdown (modo simples)
      const html = marked.parse(slide.md, { gfm: true, async: false }) as string;
      this.slideEl.innerHTML = `<div class="pp-md">${sanitize(html)}</div>`;
      const md = this.slideEl.querySelector<HTMLElement>(".pp-md")!;
      md.onclick = () => this.editarMarkdown();
      return;
    }
    const ctx = this.ctxRender(true);
    this.slideEl.innerHTML = slide.shapes.map((s) => htmlFormaRica(s, ctx)).join("") + (this.grade ? `<div class="pp-grade"></div>` : "");
    if (this.editando) this.ligarEdicao(this.editando);
  }

  /** miniaturas das lâminas */
  private pintarStrip(): void {
    this.strip.textContent = "";
    for (const [k, v] of Object.entries(stageVars(this.setup))) this.strip.style.setProperty(k, v);
    const ctx = this.ctxRender(false);
    this.slides.forEach((s, i) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = `pp-thumb${i === this.indice ? " active" : ""}`;
      btn.title = `Lâmina ${i + 1}`;
      const inner = document.createElement("div");
      inner.className = "pp-thumb-box";
      if (s.shapes.length) {
        inner.classList.add("pp-thumb-rica");
        inner.style.background = fundoValor(s.bg, this.setup.media ?? {}) || "var(--slide-bg, #fff)";
        inner.innerHTML = s.shapes.map((f) => htmlFormaRica(f, ctx)).join("");
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

      const del = document.createElement("button");
      del.type = "button";
      del.className = "pp-thumb-del";
      del.textContent = "×";
      del.title = "Excluir lâmina";
      del.addEventListener("click", (e) => {
        e.stopPropagation();
        this.indice = i;
        this.run("slide-del");
      });
      btn.append(del);
      this.strip.append(btn);
    });

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
  // estado para a fita e o painel
  // ------------------------------------------------------------------

  private cacheFontes: { slides: Slide[]; lista: string[] } | null = null;

  private fontesDoDeck(): string[] {
    if (this.cacheFontes?.slides === this.slides) return this.cacheFontes.lista;
    const m = new Map<string, number>();
    for (const sl of this.slides) for (const s of sl.shapes) for (const p of s.paras ?? []) for (const r of p.runs) m.set(r.font, (m.get(r.font) ?? 0) + r.text.length);
    for (const f of this.setup.fonts ?? []) m.set(f.family, m.get(f.family) ?? 1);
    const lista = [...m.entries()].sort((a, b) => b[1] - a[1]).map(([k]) => k);
    this.cacheFontes = { slides: this.slides, lista };
    return lista;
  }

  private rtEmEdicao(): HTMLElement | null {
    if (!this.editando) return null;
    return this.slideEl.querySelector<HTMLElement>(`[data-shape="${this.editando}"] .pp-rt`);
  }

  private estadoUI(): EstadoUI {
    const formas = this.formas();
    const forma = formas[formas.length - 1];
    let trecho: EstadoUI["trecho"] = null;
    let paragrafo: EstadoUI["paragrafo"];
    if (forma?.paras) {
      let ini = -1;
      let fim = -1;
      const rt = this.rtEmEdicao();
      const sel = rt ? lerSelecao(rt) : null;
      if (sel) {
        ini = sel.ini;
        fim = sel.fim;
      }
      trecho = estadoDoTrecho(forma.paras, ini, fim);
      const idx = parasDaSelecao(forma.paras, ini, fim);
      paragrafo = forma.paras[idx[0] ?? 0];
    }
    const d = this.dim();
    return {
      temLamina: this.slides.length > 0,
      indice: this.indice,
      total: this.slides.length,
      layout: this.atual().layout,
      formas,
      forma,
      editando: !!this.editando,
      trecho,
      paragrafo,
      podeDesfazer: this.hist.podeDesfazer,
      podeRefazer: this.hist.podeRefazer,
      temCopia: areaDeTransferencia.length > 0,
      zoom: this.stage.zoomAtual,
      ferramenta: this.ferramenta,
      fixas: this.fixas,
      encaixe: this.encaixe,
      grade: this.grade,
      paleta: this.estilo().paleta,
      fontes: this.fontesDoDeck(),
      setup: this.setup,
      bg: this.atual().bg,
      temGrupo: formas.some((s) => !!s.grupo),
      largura: forma ? (forma.box.w / 100) * d.w : 0,
      altura: forma ? (forma.box.h / 100) * d.h : 0,
    };
  }

  // ------------------------------------------------------------------
  // seleção e arraste
  // ------------------------------------------------------------------

  private selecionar(ids: string[]): void {
    const igual = ids.length === this.selecao.length && ids.every((x, i) => x === this.selecao[i]);
    if (igual) return;
    if (this.editando && !(ids.length === 1 && ids[0] === this.editando)) this.sairEdicao();
    this.selecao = ids;
    this.atualizarUI();
  }

  private aoTransformar(patches: Map<string, Partial<Shape>>, fase: "inicio" | "meio" | "fim"): void {
    if (fase === "inicio") {
      this.pendente = this.estado();
      return;
    }
    if (patches.size) {
      this.substituirSlide({ ...this.atual(), shapes: this.atual().shapes.map((s) => (patches.has(s.id) ? { ...s, ...patches.get(s.id)! } : s)) });
      this.markDirty();
      this.pintarRapido();
    }
    if (fase === "fim") {
      if (this.pendente && this.pendente.slides !== this.slides) this.hist.registrar(this.pendente);
      this.pendente = null;
      this.pintar();
    }
  }

  /** Ctrl+arrastar: duplica a seleção e passa a seleção para as cópias. */
  private duplicarParaArrastar(): string[] {
    const ids = this.selecao.slice();
    if (!ids.length) return [];
    this.pendente = this.estado();
    const r = duplicarFormas(this.atual(), ids, 0, 0);
    this.substituirSlide(r.slide);
    this.selecao = r.novos;
    this.markDirty();
    return r.novos;
  }

  // ------------------------------------------------------------------
  // criação de formas
  // ------------------------------------------------------------------

  private aoCriar(c: { box: ShapeBox; clique: boolean; x0: number; y0: number; x1: number; y1: number }): void {
    const f = this.ferramenta;
    this.ferramenta = null;
    if (!f) return;
    const est = this.estilo();
    const d = this.dim();
    let forma: Shape;
    if (f.tipo === "texto") {
      const box = c.clique ? caixaCentrada(c.x0, c.y0, 240, 40, d) : c.box;
      forma = novaCaixaDeTexto(box, est);
    } else {
      const item = GALERIA[Number(f.id)];
      forma = this.formaDoItem(item, c, est, d);
    }
    this.registrar();
    this.substituirSlide({ ...this.atual(), shapes: [...this.atual().shapes, forma] });
    this.selecao = [forma.id];
    this.markDirty();
    this.pintar();
    if (f.tipo === "texto") this.entrarEdicao(forma.id);
  }

  private formaDoItem(item: ItemGaleria, c: { box: ShapeBox; clique: boolean; x0: number; y0: number; x1: number; y1: number }, est: EstiloDeck, d: Dim): Shape {
    if (item.ehLinha) {
      let box: ShapeBox;
      let flipH = false;
      let flipV = false;
      if (c.clique) box = caixaCentrada(c.x0, c.y0, item.geom === "line" ? 200 : 160, item.geom === "line" ? 0 : 70, d);
      else {
        box = { x: Math.min(c.x0, c.x1), y: Math.min(c.y0, c.y1), w: Math.abs(c.x1 - c.x0), h: Math.abs(c.y1 - c.y0) };
        flipH = c.x1 < c.x0;
        flipV = c.y1 < c.y0;
      }
      const s = novaForma(item, box, est);
      if (flipH) s.flipH = true;
      if (flipV) s.flipV = true;
      return s;
    }
    const box = c.clique ? caixaCentrada(c.x0, c.y0, 180, item.geom === "ellipse" || item.geom === "star5" || item.geom === "heart" ? 180 : 110, d) : c.box;
    return novaForma(item, box, est);
  }

  // ------------------------------------------------------------------
  // edição de texto dentro das formas
  // ------------------------------------------------------------------

  private entrarEdicao(id: string): void {
    const s = this.atual().shapes.find((x) => x.id === id);
    if (!s || s.paras === undefined || s.bloqueada) return;
    this.antesEdicao = this.estado();
    this.editando = id;
    this.selecao = [id];
    this.pintar();
    const rt = this.rtEmEdicao();
    if (rt) {
      rt.focus();
      const fim = document.createRange();
      fim.selectNodeContents(rt);
      fim.collapse(false);
      const sel = window.getSelection();
      sel?.removeAllRanges();
      sel?.addRange(fim);
    }
  }

  private sairEdicao(): void {
    if (!this.editando) return;
    this.editando = null;
    if (this.antesEdicao && this.antesEdicao.slides !== this.slides) this.hist.registrar(this.antesEdicao);
    this.antesEdicao = null;
    window.getSelection()?.removeAllRanges();
    this.pintar();
  }

  /** Liga os eventos da caixa de texto em edição (depois de cada desenho da lâmina). */
  private ligarEdicao(id: string): void {
    const rt = this.rtEmEdicao();
    if (!rt) return;
    rt.addEventListener("input", () => this.aoDigitar(id, rt));
    rt.addEventListener("paste", (e) => {
      // cola sempre como texto puro: o formato de fora não entra
      e.preventDefault();
      e.stopPropagation();
      const t = e.clipboardData?.getData("text/plain") ?? "";
      if (t) document.execCommand("insertText", false, t);
    });
    rt.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        this.sairEdicao();
      }
    });
  }

  private estiloDeDigitacao(s: Shape): EstiloRun {
    return { size: s.fontSize, bold: s.bold, italic: s.italic, underline: false, strike: false, color: s.color || "000000", font: s.fontFamily || "Arial" };
  }

  private aoDigitar(id: string, rt: HTMLElement): void {
    const s = this.atual().shapes.find((x) => x.id === id);
    if (!s || !s.paras) return;
    const texto = textoDaCaixa(rt);
    const paras = parasComTexto(s.paras, texto, this.estiloDeDigitacao(s));
    if (paras === s.paras) return;
    // não redesenha: o cursor precisa continuar onde está
    this.substituirSlide({ ...this.atual(), shapes: this.atual().shapes.map((x) => (x.id === id ? { ...x, paras, text: texto } : x)) });
    this.markDirty();
    this.fita.atualizar();
  }

  /** Aplica um estilo ao trecho selecionado (ou a todo o texto das formas selecionadas). */
  private estiloDoTexto(patch: RunPatch): void {
    const rt = this.rtEmEdicao();
    const sel = rt ? lerSelecao(rt) : null;
    const ini = sel ? sel.ini : -1;
    const fim = sel ? sel.fim : -1;
    const ids = this.editando ? [this.editando] : this.selecao;
    this.editar(
      (sl) =>
        patchFormas(sl, ids, (s) => {
          if (!s.paras) return {};
          const extra: Partial<Shape> = {};
          if (ini < 0 || ini === fim) {
            if (patch.font !== undefined) extra.fontFamily = patch.font;
            if (patch.size !== undefined) extra.fontSize = patch.size;
            if (patch.color !== undefined) extra.color = patch.color;
            if (patch.bold !== undefined) extra.bold = patch.bold;
            if (patch.italic !== undefined) extra.italic = patch.italic;
          }
          return { paras: estiloNoIntervalo(s.paras, ini, fim, patch), ...extra };
        }),
      "estilo-texto"
    );
    this.refocar(sel);
  }

  private mudarTamanhoTexto(sobe: boolean): void {
    const rt = this.rtEmEdicao();
    const sel = rt ? lerSelecao(rt) : null;
    const ini = sel ? sel.ini : -1;
    const fim = sel ? sel.fim : -1;
    const ids = this.editando ? [this.editando] : this.selecao;
    this.editar((sl) => patchFormas(sl, ids, (s) => (s.paras ? { paras: mudarTamanhoRelativo(s.paras, ini, fim, sobe) } : {})), "tamanho-texto");
    this.refocar(sel);
  }

  /** Depois de redesenhar durante a edição: devolve o foco e a seleção do texto. */
  private refocar(sel: { ini: number; fim: number } | null): void {
    if (!this.editando) return;
    const rt = this.rtEmEdicao();
    if (!rt) return;
    rt.focus();
    if (sel) restaurarSelecao(rt, sel.ini, sel.fim);
  }

  /** Propriedades de parágrafo nas formas selecionadas (ou só nos parágrafos tocados pela seleção de texto). */
  private estiloDosParagrafos(fn: (paras: NonNullable<Shape["paras"]>, idx: number[]) => NonNullable<Shape["paras"]>): void {
    const rt = this.rtEmEdicao();
    const sel = rt ? lerSelecao(rt) : null;
    const ids = this.editando ? [this.editando] : this.selecao;
    this.editar(
      (sl) =>
        patchFormas(sl, ids, (s) => {
          if (!s.paras) return {};
          const idx = sel ? parasDaSelecao(s.paras, sel.ini, sel.fim) : s.paras.map((_, i) => i);
          return { paras: fn(s.paras, idx) };
        }),
      "paragrafo"
    );
    this.refocar(sel);
  }

  // ------------------------------------------------------------------
  // comandos da fita e do painel
  // ------------------------------------------------------------------

  private run(cmd: string, value?: string): void {
    const sl = this.atual();
    const ids = this.selecao;
    const d = this.dim();
    const principal = this.principal();

    // ---- comandos com valor no nome ----
    if (cmd.startsWith("grad-cor:") || cmd.startsWith("grad-pos:")) return this.gradienteParada(cmd, value);
    if (cmd.startsWith("ajuste:")) {
      const chave = cmd.slice(7);
      this.editar((s) => patchFormas(s, ids, (f) => comAjuste(f, chave, Number(value))), `ajuste-${chave}`);
      return;
    }
    if (cmd.startsWith("marg:")) {
      const i = Number(cmd.slice(5));
      this.editar(
        (s) =>
          patchFormas(s, ids, (f) => {
            const ins = [...(f.ins ?? [7.2, 3.6, 7.2, 3.6])] as [number, number, number, number];
            ins[i] = Math.max(0, (Number(value) / 2.54) * 72);
            return { ins };
          }),
        "margem"
      );
      return;
    }
    if (cmd.startsWith("crop:")) {
      const i = Number(cmd.slice(5));
      this.editar(
        (s) =>
          patchFormas(s, ids, (f) => {
            const c = [...(f.crop ?? [0, 0, 0, 0])] as [number, number, number, number];
            c[i] = Math.max(0, Math.min(95, Number(value) || 0));
            return { crop: c };
          }),
        "recorte"
      );
      return;
    }
    if (cmd.startsWith("bg-grad-cor:")) {
      const i = Number(cmd.slice(12));
      const f = sl.bg;
      if (f?.kind !== "gradient" || !f.stops) return;
      const stops = f.stops.map((p, k) => ((i === 0 && k === 0) || (i === 1 && k === f.stops!.length - 1) ? { ...p, color: String(value) } : p));
      this.editar((s) => ({ ...s, bg: { ...f, stops } }), "fundo");
      return;
    }

    switch (cmd) {
      // ---- lâmina ----
      case "slide-new": {
        this.registrar();
        const r = insertSlide(this.deck, this.indice);
        this.slides = r.deck.slides;
        this.indice = r.index;
        this.selecao = [];
        this.editando = null;
        this.markDirty();
        this.pintar();
        return;
      }
      case "slide-dup": {
        this.registrar();
        const r = duplicateSlide(this.deck, this.indice);
        this.slides = r.deck.slides;
        this.indice = r.index;
        this.selecao = [];
        this.markDirty();
        this.pintar();
        return;
      }
      case "slide-del": {
        this.registrar();
        const r = removeSlide(this.deck, this.indice);
        this.slides = r.deck.slides;
        this.indice = r.index;
        this.selecao = [];
        this.editando = null;
        this.markDirty();
        this.pintar();
        return;
      }
      case "slide-up":
        return this.moverLamina(-1);
      case "slide-down":
        return this.moverLamina(1);
      case "layout":
      case "layout-sel": {
        this.registrar();
        this.slides = setLayout(this.deck, this.indice, (value ?? "conteudo") as SlideLayout).slides;
        this.markDirty();
        this.pintar();
        return;
      }
      case "theme":
        if (value && THEMES.some((t) => t.id === value)) this.setSetup({ theme: value as DeckSetup["theme"] });
        return;
      case "present":
        return this.present();
      case "configure":
        return void this.opts.onConfigure?.();
      case "notes":
        this.mostrarLateral("notas");
        return;

      // ---- desfazer, refazer, área de transferência ----
      case "desfazer": {
        const e = this.editando ? null : this.hist.desfazer(this.estado());
        if (e) this.restaurar(e);
        else if (this.editando) document.execCommand("undo");
        return;
      }
      case "refazer": {
        const e = this.editando ? null : this.hist.refazer(this.estado());
        if (e) this.restaurar(e);
        else if (this.editando) document.execCommand("redo");
        return;
      }
      case "copiar":
        return this.copiar();
      case "recortar":
        this.copiar();
        return this.run("excluir");
      case "colar":
        return this.colar();
      case "duplicar": {
        if (!ids.length) return;
        this.registrar();
        const r = duplicarFormas(sl, comGrupos(sl, ids));
        this.substituirSlide(r.slide);
        this.selecao = r.novos;
        this.markDirty();
        this.pintar();
        return;
      }
      case "excluir":
        if (!ids.length) return;
        this.registrar();
        this.substituirSlide(removerFormas(sl, ids));
        this.selecao = [];
        this.markDirty();
        this.pintar();
        return;
      case "sel-tudo":
        this.selecionar(sl.shapes.filter((s) => !s.fixa || this.fixas).map((s) => s.id));
        return;

      // ---- inserir ----
      case "forma-inserir":
        this.ferramenta = { tipo: "forma", id: String(value ?? "5") };
        this.stage.desenharSelecao();
        this.fita.atualizar();
        return;
      case "ferramenta":
        this.ferramenta = value === "texto" ? (this.ferramenta?.tipo === "texto" ? null : { tipo: "texto" }) : null;
        this.stage.desenharSelecao();
        this.fita.atualizar();
        return;
      case "image":
        this.destinoImagem = "inserir";
        return void this.opts.onPickImage?.("inserir");
      case "preench-imagem":
      case "imagem-trocar":
      case "fundo-imagem":
        this.destinoImagem = cmd === "preench-imagem" ? "preencher" : cmd === "imagem-trocar" ? "trocar" : "fundo";
        return void this.opts.onPickImage?.(this.destinoImagem);

      // ---- texto ----
      case "fonte":
        return this.estiloDoTexto({ font: String(value) });
      case "tamanho":
        return this.estiloDoTexto({ size: Math.max(1, Number(String(value).replace(",", "."))) });
      case "maior":
        return this.mudarTamanhoTexto(true);
      case "menor":
        return this.mudarTamanhoTexto(false);
      case "negrito":
      case "italico":
      case "sublinhado":
      case "tachado": {
        const est = this.estadoUI().trecho;
        const chave = cmd === "negrito" ? "bold" : cmd === "italico" ? "italic" : cmd === "sublinhado" ? "underline" : "strike";
        const ligado = est ? est[chave] === true : false;
        return this.estiloDoTexto({ [chave]: !ligado } as RunPatch);
      }
      case "cor-texto":
        return this.estiloDoTexto({ color: String(value) });
      case "marcadores":
        return this.estiloDosParagrafos((p, idx) => alternarMarcador(p, idx, "marcador"));
      case "numeracao":
        return this.estiloDosParagrafos((p, idx) => alternarMarcador(p, idx, "numeracao"));
      case "recuo-mais":
        return this.estiloDosParagrafos((p, idx) => mudarRecuo(p, idx, 1));
      case "recuo-menos":
        return this.estiloDosParagrafos((p, idx) => mudarRecuo(p, idx, -1));
      case "entrelinha":
        return this.estiloDosParagrafos((p, idx) => estiloDosParas(p, idx, { lnSpc: { pct: Number(value) } }));
      case "alinhar-esquerda":
      case "alinhar-centro":
      case "alinhar-direita":
      case "alinhar-justificado": {
        const mapa: Record<string, TextAlign> = { "alinhar-esquerda": "esquerda", "alinhar-centro": "centro", "alinhar-direita": "direita", "alinhar-justificado": "justificado" };
        return this.estiloDosParagrafos((p, idx) => estiloDosParas(p, idx, { align: mapa[cmd] }));
      }
      case "v-topo":
      case "v-meio":
      case "v-base":
      case "anchor": {
        const a = cmd === "v-topo" ? "t" : cmd === "v-meio" ? "ctr" : cmd === "v-base" ? "b" : (value as "t" | "ctr" | "b");
        this.editar((s) => patchFormas(s, ids, (f) => (f.paras ? { anchor: a } : {})));
        return;
      }
      case "vert":
        this.editar((s) => patchFormas(s, ids, { vert: (value || undefined) as Shape["vert"] }));
        return;
      case "wrap":
        this.editar((s) => patchFormas(s, ids, { wrap: value === "1" }));
        return;

      // ---- preenchimento ----
      case "preench": {
        if (!ids.length) return;
        const fill: Fill | undefined = value === "none" ? { kind: "none" } : solido(String(value));
        this.editar((s) => patchFormas(s, ids, (f) => comPreenchimento(f, fill)));
        return;
      }
      case "pf-tipo": {
        const base = corPrincipal(principal?.fillX) ?? this.estilo().acento;
        if (value === "image") return this.run("preench-imagem");
        const fill: Fill | undefined = value === "none" ? { kind: "none" } : value === "solid" ? solido(base) : gradiente(ajustarCor(base, 1.3), ajustarCor(base, 0.75), 90);
        this.editar((s) => patchFormas(s, ids, (f) => comPreenchimento(f, fill)));
        return;
      }
      case "pf-cor":
        this.editar((s) => patchFormas(s, ids, (f) => (f.fillX?.kind === "solid" ? comPreenchimento(f, { ...f.fillX, color: String(value) }) : comPreenchimento(f, solido(String(value))))), "pf-cor");
        return;
      case "pf-transp":
        this.editar((s) => patchFormas(s, ids, (f) => (f.fillX && f.fillX.kind !== "none" ? comPreenchimento(f, { ...f.fillX, alpha: 1 - Math.max(0, Math.min(100, Number(value))) / 100 }) : {})), "pf-transp");
        return;
      case "gradiente": {
        const base = corPrincipal(principal?.fillX) ?? this.estilo().acento;
        const c1 = ajustarCor(base, 1.3);
        const c2 = ajustarCor(base, 0.75);
        const dir = String(value);
        const ang: Record<string, number> = { baixo: 90, cima: 270, direita: 0, esquerda: 180, diagonal: 45 };
        const fill: Fill = dir === "radial" ? { ...gradiente(c1, c2), radial: true, angle: undefined } : gradiente(c1, c2, ang[dir] ?? 90);
        this.editar((s) => patchFormas(s, ids, (f) => comPreenchimento(f, fill)));
        return;
      }
      case "grad-tipo":
        this.editar((s) => patchFormas(s, ids, (f) => (f.fillX?.kind === "gradient" ? comPreenchimento(f, { ...f.fillX, radial: value === "radial", angle: value === "radial" ? undefined : (f.fillX.angle ?? 90) }) : {})));
        return;
      case "grad-angulo":
        this.editar((s) => patchFormas(s, ids, (f) => (f.fillX?.kind === "gradient" ? comPreenchimento(f, { ...f.fillX, angle: Number(value) }) : {})), "grad-angulo");
        return;
      case "grad-add":
        this.editar((s) =>
          patchFormas(s, ids, (f) => {
            const fx = f.fillX;
            if (fx?.kind !== "gradient" || !fx.stops) return {};
            const st = [...fx.stops].sort((a, b) => a.pos - b.pos);
            const meio = { pos: (st[st.length - 2].pos + st[st.length - 1].pos) / 2, color: st[st.length - 1].color, alpha: 1 };
            return comPreenchimento(f, { ...fx, stops: [...st.slice(0, -1), meio, st[st.length - 1]] });
          })
        );
        return;
      case "grad-del":
        this.editar((s) =>
          patchFormas(s, ids, (f) => {
            const fx = f.fillX;
            if (fx?.kind !== "gradient" || !fx.stops || fx.stops.length <= 2) return {};
            return comPreenchimento(f, { ...fx, stops: fx.stops.filter((_, i) => i !== Number(value)) });
          })
        );
        return;
      case "grad-inverter":
        this.editar((s) =>
          patchFormas(s, ids, (f) => {
            const fx = f.fillX;
            if (fx?.kind !== "gradient" || !fx.stops) return {};
            return comPreenchimento(f, { ...fx, stops: [...fx.stops].reverse().map((p) => ({ ...p, pos: 100 - p.pos })) });
          })
        );
        return;

      // ---- linha ----
      case "contorno":
        this.editar((s) => patchFormas(s, ids, (f) => (value === "none" ? comLinha(f, null) : comLinha(f, { color: String(value) }))));
        return;
      case "ln-tipo":
        this.editar((s) => patchFormas(s, ids, (f) => (value === "none" ? comLinha(f, null) : comLinha(f, f.ln ?? { color: ajustarCor(corPrincipal(f.fillX) ?? "4F46E5", 0.7), w: 1 }))));
        return;
      case "ln-cor":
        this.editar((s) => patchFormas(s, ids, (f) => comLinha(f, { color: String(value) })), "ln-cor");
        return;
      case "ln-w":
      case "espessura":
        this.editar((s) => patchFormas(s, ids, (f) => comLinha(f, { w: Math.max(0, Number(String(value).replace(",", "."))) })), "ln-w");
        return;
      case "ln-transp":
        this.editar((s) => patchFormas(s, ids, (f) => comLinha(f, { alpha: 1 - Math.max(0, Math.min(100, Number(value))) / 100 })), "ln-transp");
        return;
      case "ln-dash":
      case "traco":
        this.editar((s) => patchFormas(s, ids, (f) => comLinha(f, { dash: value as never })));
        return;
      case "ln-head":
      case "ponta-ini":
        this.editar((s) => patchFormas(s, ids, (f) => comLinha(f, { head: (value || undefined) as never })));
        return;
      case "ln-tail":
      case "ponta-fim":
        this.editar((s) => patchFormas(s, ids, (f) => comLinha(f, { tail: (value || undefined) as never })));
        return;
      case "ln-cap":
        this.editar((s) => patchFormas(s, ids, (f) => comLinha(f, { cap: value as never })));
        return;

      // ---- efeitos ----
      case "sombra-pronta":
        this.editar((s) => patchFormas(s, ids, (f) => comSombra(f, SOMBRAS_PRONTAS[Number(value)]?.sombra ?? null)));
        return;
      case "sd-on":
        this.editar((s) => patchFormas(s, ids, (f) => comSombra(f, value === "1" ? {} : null)));
        return;
      case "sd-cor":
        this.editar((s) => patchFormas(s, ids, (f) => comSombra(f, { color: String(value) })), "sd");
        return;
      case "sd-transp":
        this.editar((s) => patchFormas(s, ids, (f) => comSombra(f, { alpha: 1 - Math.max(0, Math.min(100, Number(value))) / 100 })), "sd");
        return;
      case "sd-blur":
        this.editar((s) => patchFormas(s, ids, (f) => comSombra(f, { blur: Math.max(0, Number(value)) })), "sd");
        return;
      case "sd-dist":
        this.editar((s) => patchFormas(s, ids, (f) => comSombra(f, { dist: Math.max(0, Number(value)) })), "sd");
        return;
      case "sd-dir":
        this.editar((s) => patchFormas(s, ids, (f) => comSombra(f, { dir: Number(value) })), "sd");
        return;
      case "opac":
        this.editar((s) => patchFormas(s, ids, (f) => comOpacidade(f, Math.max(0, Math.min(100, Number(value))) / 100)), "opac");
        return;
      case "canto":
        this.editar((s) => patchFormas(s, ids, (f) => comRaioDeCanto(f, Number(value))), "canto");
        return;
      case "estilo":
        return this.estiloRapido(String(value));

      // ---- tamanho, posição, giro ----
      case "tamanho-w":
      case "pos-w":
        this.editar((s) => patchFormas(s, ids, (f) => ({ box: { ...f.box, w: ((cmd === "pos-w" ? (Number(value) / 2.54) * 72 : Number(value)) / d.w) * 100 } })), "tam");
        return;
      case "tamanho-h":
      case "pos-h":
        this.editar((s) => patchFormas(s, ids, (f) => ({ box: { ...f.box, h: ((cmd === "pos-h" ? (Number(value) / 2.54) * 72 : Number(value)) / d.h) * 100 } })), "tam");
        return;
      case "pos-x":
        this.editar((s) => patchFormas(s, ids, (f) => ({ box: { ...f.box, x: (((Number(value) / 2.54) * 72) / d.w) * 100 } })), "pos");
        return;
      case "pos-y":
        this.editar((s) => patchFormas(s, ids, (f) => ({ box: { ...f.box, y: (((Number(value) / 2.54) * 72) / d.h) * 100 } })), "pos");
        return;
      case "rot":
        this.editar((s) => patchFormas(s, ids, { rot: ((Number(value) % 360) + 360) % 360 }), "rot");
        return;
      case "girar":
        this.editar((s) => patchFormas(s, ids, (f) => ({ rot: (((f.rot + Number(value)) % 360) + 360) % 360 })));
        return;
      case "espelhar":
        this.editar((s) => espelharFormas(s, ids, value === "v" ? "v" : "h"));
        return;
      case "bloquear":
        this.editar((s) => patchFormas(s, ids, (f) => ({ bloqueada: !f.bloqueada })));
        return;
      case "bloquear-forma":
        this.editar((s) => patchFormas(s, ids, { bloqueada: value === "1" }));
        return;
      case "img-forma":
        this.editar((s) => patchFormas(s, ids, { geom: String(value), adj: undefined }));
        return;
      case "crop-reset":
        this.editar((s) => patchFormas(s, ids, { crop: undefined }));
        return;

      // ---- organizar ----
      case "z-topo":
        return this.editar((s) => ordemDasFormas(s, comGrupos(s, ids), "topo"));
      case "z-fundo":
        return this.editar((s) => ordemDasFormas(s, comGrupos(s, ids), "fundo"));
      case "z-frente":
        return this.editar((s) => ordemDasFormas(s, comGrupos(s, ids), "frente"));
      case "z-tras":
        return this.editar((s) => ordemDasFormas(s, comGrupos(s, ids), "tras"));
      case "agrupar":
        return this.editar((s) => agruparFormas(s, ids));
      case "desagrupar":
        return this.editar((s) => desagruparFormas(s, ids));
      case "alinhar":
        return this.editar((s) => alinharFormas(s, ids, String(value) as ModoAlinhar, d));
      case "distribuir":
        return this.editar((s) => distribuirFormas(s, ids, value === "v" ? "v" : "h", d));
      case "igualar":
        return this.editar((s) => igualarTamanho(s, ids, value === "altura" ? "altura" : value === "largura" ? "largura" : "ambos"));

      // ---- fundo da lâmina ----
      case "bg-tipo": {
        if (value === "tema") return this.editar((s) => ({ ...s, bg: undefined }));
        if (value === "image") return this.run("fundo-imagem");
        const t = themeOf(this.setup.theme);
        const atual = sl.bg?.kind === "solid" ? sl.bg.color! : t.bg;
        const bg: Fill = value === "solid" ? solido(atual) : gradiente(ajustarCor(atual, 1.1), ajustarCor(atual, 0.8), 90);
        return this.editar((s) => ({ ...s, bg }));
      }
      case "fundo-cor":
      case "bg-cor":
        return this.editar((s) => ({ ...s, bg: value === "tema" ? undefined : solido(String(value)) }), "fundo");
      case "fundo-grad": {
        const base = sl.bg?.kind === "solid" ? sl.bg.color! : this.estilo().acento;
        const ang: Record<string, number> = { baixo: 90, cima: 270, direita: 0, esquerda: 180, diagonal: 45 };
        const bg: Fill = value === "radial" ? { ...gradiente(ajustarCor(base, 1.3), ajustarCor(base, 0.75)), radial: true, angle: undefined } : gradiente(ajustarCor(base, 1.3), ajustarCor(base, 0.75), ang[String(value)] ?? 90);
        return this.editar((s) => ({ ...s, bg }));
      }
      case "bg-grad-angulo":
        return this.editar((s) => (s.bg?.kind === "gradient" ? { ...s, bg: { ...s.bg, angle: Number(value) } } : s), "fundo");
      case "fundo-todas": {
        const bg = sl.bg;
        this.registrar();
        this.slides = this.slides.map((x) => ({ ...x, bg }));
        this.markDirty();
        this.pintar();
        return;
      }

      // ---- exibição ----
      case "zoom-in":
        return this.setZoom(this.stage.zoomAtual + 10);
      case "zoom-out":
        return this.setZoom(this.stage.zoomAtual - 10);
      case "zoom-reset":
        return this.setZoom(100);
      case "alt-encaixe":
        this.encaixe = !this.encaixe;
        gravarFlag("mdc.pp.encaixe", this.encaixe);
        return this.atualizarUI();
      case "alt-grade":
        this.grade = !this.grade;
        gravarFlag("mdc.pp.grade", this.grade);
        return this.pintar();
      case "alt-fixas":
        this.fixas = !this.fixas;
        if (!this.fixas) this.selecao = this.selecao.filter((id) => !this.atual().shapes.find((s) => s.id === id)?.fixa);
        return this.pintar();
    }
  }

  private gradienteParada(cmd: string, value?: string): void {
    const i = Number(cmd.split(":")[1]);
    const campo = cmd.startsWith("grad-cor") ? "color" : "pos";
    this.editar(
      (s) =>
        patchFormas(s, this.selecao, (f) => {
          const fx = f.fillX;
          if (fx?.kind !== "gradient" || !fx.stops) return {};
          const stops = fx.stops.map((p, k) => (k === i ? (campo === "color" ? { ...p, color: String(value) } : { ...p, pos: Math.max(0, Math.min(100, Number(value))) }) : p));
          if (campo === "pos") stops.sort((a, b) => a.pos - b.pos);
          return comPreenchimento(f, { ...fx, stops });
        }),
      "grad-parada"
    );
  }

  /** Estilos prontos da aba Formato (aplicam preenchimento, linha, sombra e cor do texto de uma vez). */
  private estiloRapido(nome: string): void {
    const est = this.estilo();
    const acento = est.acento;
    const claro = (h: string) => {
      const c = h.padEnd(6, "0");
      return 0.299 * parseInt(c.slice(0, 2), 16) + 0.587 * parseInt(c.slice(2, 4), 16) + 0.114 * parseInt(c.slice(4, 6), 16) > 150;
    };
    const aplicar = (f: Shape): Shape => {
      let n: Shape = { ...f };
      const ehLinha = f.geom === "line" || !!f.geom?.endsWith("Connector3");
      if (ehLinha) return comLinha(n, { color: acento, w: 2.25 });
      let corTexto = "1C212B";
      if (nome === "cheio") {
        n = comPreenchimento(n, solido(acento));
        n = comLinha(n, { color: ajustarCor(acento, 0.7), w: 1 });
        n = comSombra(n, null);
        corTexto = claro(acento) ? "1C212B" : "FFFFFF";
      } else if (nome === "contorno") {
        n = comPreenchimento(n, { kind: "none" });
        n = comLinha(n, { color: acento, w: 2.25 });
        n = comSombra(n, null);
        corTexto = acento;
      } else if (nome === "gradiente") {
        n = comPreenchimento(n, gradiente(ajustarCor(acento, 1.3), ajustarCor(acento, 0.7), 90));
        n = comLinha(n, null);
        n = comSombra(n, SOMBRAS_PRONTAS[1].sombra);
        corTexto = "FFFFFF";
      } else if (nome === "cartao") {
        n = comPreenchimento(n, solido("FFFFFF"));
        n = comLinha(n, { color: "E5E7EB", w: 0.75 });
        n = comSombra(n, SOMBRAS_PRONTAS[1].sombra);
      } else if (nome === "escuro") {
        n = comPreenchimento(n, solido("0F2738"));
        n = comLinha(n, null);
        n = comSombra(n, null);
        corTexto = "FFFFFF";
      } else if (nome === "suave") {
        n = comPreenchimento(n, solido(ajustarCor(acento, 1.85)));
        n = comLinha(n, { color: acento, w: 1 });
        n = comSombra(n, null);
        corTexto = ajustarCor(acento, 0.55);
      }
      if (n.paras) n = { ...n, color: corTexto, paras: parasComEstilo(n.paras, { color: corTexto }) };
      return n;
    };
    this.editar((s) => patchFormas(s, this.selecao, aplicar));
  }

  // ------------------------------------------------------------------
  // copiar e colar
  // ------------------------------------------------------------------

  private copiar(): void {
    const ids = comGrupos(this.atual(), this.selecao);
    const formas = this.atual().shapes.filter((s) => ids.includes(s.id));
    if (!formas.length) return;
    areaDeTransferencia = formas.map((s) => JSON.parse(JSON.stringify(s)) as Shape);
    // também no sistema, para colar em outra janela do app
    try {
      void navigator.clipboard?.writeText(`mdc-formas:${JSON.stringify(areaDeTransferencia)}`);
    } catch {
      /* sem acesso à área de transferência */
    }
    this.atualizarUI();
  }

  private colar(): void {
    if (!areaDeTransferencia.length) return;
    this.registrar();
    const r = colarFormas(this.atual(), areaDeTransferencia);
    this.substituirSlide(r.slide);
    this.selecao = r.novos;
    this.markDirty();
    this.pintar();
  }

  private aoColarDoSistema(e: ClipboardEvent): void {
    if (!this.ativo()) return;
    const alvo = e.target as HTMLElement | null;
    if (alvo && (alvo.closest("textarea, input, select") || (alvo.isContentEditable && this.editando))) return;
    const dt = e.clipboardData;
    if (!dt) return;
    const img = Array.from(dt.files).find((f) => f.type.startsWith("image/"));
    if (img) {
      e.preventDefault();
      void this.lerArquivoDeImagem(img).then((src) => this.insertImage(src));
      return;
    }
    const texto = dt.getData("text/plain");
    if (texto.startsWith("mdc-formas:")) {
      try {
        const formas = JSON.parse(texto.slice(11)) as Shape[];
        if (Array.isArray(formas) && formas.length) {
          e.preventDefault();
          areaDeTransferencia = formas;
          this.colar();
          return;
        }
      } catch {
        /* texto comum */
      }
    }
    if (texto.trim()) {
      // texto solto vira uma caixa de texto
      e.preventDefault();
      const d = this.dim();
      const caixa = novaCaixaDeTexto(caixaCentrada(50, 50, Math.min(d.w * 0.6, 420), 60, d), this.estilo());
      caixa.paras = parasComTexto(caixa.paras ?? [], texto.trim(), this.estiloDeDigitacao(caixa));
      caixa.text = texto.trim();
      this.registrar();
      this.substituirSlide({ ...this.atual(), shapes: [...this.atual().shapes, caixa] });
      this.selecao = [caixa.id];
      this.markDirty();
      this.pintar();
    } else if (areaDeTransferencia.length) {
      e.preventDefault();
      this.colar();
    }
  }

  private lerArquivoDeImagem(arq: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result));
      r.onerror = () => reject(r.error);
      r.readAsDataURL(arq);
    });
  }

  // ------------------------------------------------------------------
  // teclado
  // ------------------------------------------------------------------

  /** A tela de apresentação está à vista? */
  private ativo(): boolean {
    const c = document.body.classList;
    return c.contains("ppt-open") && !c.contains("home-open") && !c.contains("settings-open") && !c.contains("apresentando") && this.pane.offsetParent !== null;
  }

  private aoTecla(e: KeyboardEvent): void {
    if (!this.ativo() || e.defaultPrevented) return;
    const alvo = e.target as HTMLElement;
    const digitando = !!alvo.closest("input, textarea, select") || (alvo.isContentEditable && !!this.editando);
    const ctrl = e.ctrlKey || e.metaKey;
    const k = e.key.toLowerCase();

    // dentro de uma caixa de texto em edição: só os atalhos de formatação são nossos (o resto é do navegador)
    if (this.editando && alvo.isContentEditable) {
      if (ctrl && !e.shiftKey && (k === "b" || k === "i" || k === "u")) {
        e.preventDefault();
        this.run(k === "b" ? "negrito" : k === "i" ? "italico" : "sublinhado");
      } else if (ctrl && !e.shiftKey && (k === "l" || k === "e" || k === "r" || k === "j")) {
        e.preventDefault();
        this.run(k === "l" ? "alinhar-esquerda" : k === "e" ? "alinhar-centro" : k === "r" ? "alinhar-direita" : "alinhar-justificado");
      } else if (ctrl && e.shiftKey && (e.key === ">" || e.key === ".")) {
        e.preventDefault();
        this.run("maior");
      } else if (ctrl && e.shiftKey && (e.key === "<" || e.key === ",")) {
        e.preventDefault();
        this.run("menor");
      }
      return;
    }
    if (digitando) return;

    if (ctrl && k === "z" && !e.shiftKey) return this.consumir(e, () => this.run("desfazer"));
    if (ctrl && (k === "y" || (k === "z" && e.shiftKey))) return this.consumir(e, () => this.run("refazer"));
    if (ctrl && k === "c") return this.consumir(e, () => this.copiar());
    if (ctrl && k === "x") return this.consumir(e, () => this.run("recortar"));
    if (ctrl && k === "v") return; // quem cola é o evento "paste"
    if (ctrl && k === "d") return this.consumir(e, () => this.run("duplicar"));
    if (ctrl && k === "a") return this.consumir(e, () => this.run("sel-tudo"));
    if (ctrl && k === "g") return this.consumir(e, () => this.run(e.shiftKey ? "desagrupar" : "agrupar"));
    if (ctrl && !e.shiftKey && (k === "b" || k === "i" || k === "u") && this.selecao.length) return this.consumir(e, () => this.run(k === "b" ? "negrito" : k === "i" ? "italico" : "sublinhado"));

    if (e.key === "Escape") {
      if (this.ferramenta) this.consumir(e, () => this.run("ferramenta", ""));
      else if (this.selecao.length) this.consumir(e, () => this.selecionar([]));
      return;
    }
    if (e.key === "Delete" || e.key === "Backspace") {
      if (this.selecao.length) this.consumir(e, () => this.run("excluir"));
      return;
    }
    if ((e.key === "Enter" || e.key === "F2") && this.selecao.length === 1) return this.consumir(e, () => this.entrarEdicao(this.selecao[0]));
    if (e.key === "Tab" && this.atual().shapes.length) {
      const lista = this.atual().shapes.filter((s) => !s.fixa || this.fixas);
      const i = lista.findIndex((s) => s.id === this.selecao[this.selecao.length - 1]);
      const prox = lista[(i + (e.shiftKey ? -1 : 1) + lista.length) % lista.length];
      if (prox) this.consumir(e, () => this.selecionar([prox.id]));
      return;
    }
    if (e.key.startsWith("Arrow")) {
      if (this.selecao.length) {
        const passo = e.shiftKey ? 1 : e.altKey ? 0.05 : 0.2;
        const d = this.dim();
        const dx = e.key === "ArrowLeft" ? -passo : e.key === "ArrowRight" ? passo : 0;
        const dy = e.key === "ArrowUp" ? -passo : e.key === "ArrowDown" ? passo : 0;
        return this.consumir(e, () => {
          this.registrar("setas");
          const ids = comGrupos(this.atual(), this.selecao);
          this.substituirSlide({ ...this.atual(), shapes: this.atual().shapes.map((s) => (ids.includes(s.id) && !s.bloqueada ? { ...s, box: { ...s.box, x: s.box.x + dx, y: s.box.y + dy * (d.w / d.h) } } : s)) });
          this.markDirty();
          this.pintar();
        });
      }
      if (e.key === "ArrowRight" || e.key === "ArrowDown") this.consumir(e, () => this.irPara(this.indice + 1));
      if (e.key === "ArrowLeft" || e.key === "ArrowUp") this.consumir(e, () => this.irPara(this.indice - 1));
    }
  }

  private consumir(e: KeyboardEvent, fn: () => void): void {
    e.preventDefault();
    e.stopPropagation();
    fn();
  }

  // ------------------------------------------------------------------
  // menu de contexto
  // ------------------------------------------------------------------

  private menuDeContexto(e: MouseEvent): void {
    e.preventDefault();
    const alvo = e.target as HTMLElement;
    const formaEl = alvo.closest<HTMLElement>(".pp-shape[data-shape]");
    const id = formaEl?.dataset.shape;
    if (id && !this.selecao.includes(id)) this.selecionar(comGrupos(this.atual(), [id]));
    const tem = this.selecao.length > 0;
    const itens: [string, string, boolean][] = tem
      ? [
          ["editar-texto", "Editar texto", this.selecao.length === 1 && !!this.principal()?.paras],
          ["recortar", "Recortar", true],
          ["copiar", "Copiar", true],
          ["colar", "Colar", areaDeTransferencia.length > 0],
          ["duplicar", "Duplicar", true],
          ["excluir", "Excluir", true],
          ["z-topo", "Trazer para a frente", true],
          ["z-fundo", "Enviar para trás", true],
          ["agrupar", "Agrupar", this.selecao.length > 1],
          ["desagrupar", "Desagrupar", this.formas().some((s) => !!s.grupo)],
        ]
      : [
          ["colar", "Colar", areaDeTransferencia.length > 0],
          ["sel-tudo", "Selecionar tudo", true],
        ];
    const ancora = document.createElement("span");
    ancora.style.cssText = `position:fixed;left:${e.clientX}px;top:${e.clientY}px;width:1px;height:1px`;
    document.body.append(ancora);
    const el = abrirPopup(ancora, itens.map(([c, n, ok]) => `<button type="button" class="pp-pop-item" data-c="${c}"${ok ? "" : " disabled"}>${n}</button>`).join(""), { classe: "pp-pop-menu", aoFechar: () => ancora.remove() });
    el.addEventListener("click", (ev) => {
      const b = (ev.target as HTMLElement).closest<HTMLButtonElement>("[data-c]");
      if (!b || b.disabled) return;
      fecharPopup();
      const c = b.dataset.c!;
      if (c === "editar-texto") this.entrarEdicao(this.selecao[0]);
      else this.run(c);
    });
  }

  // ------------------------------------------------------------------
  // outras ações
  // ------------------------------------------------------------------

  private moverLamina(delta: number): void {
    this.registrar();
    const r = moveSlide(this.deck, this.indice, this.indice + delta);
    this.slides = r.deck.slides;
    this.indice = r.index;
    this.markDirty();
    this.pintar();
  }

  /** Insere (ou aplica) uma imagem; `destino` vem do pedido feito à fita/painel. */
  insertImage(src: string, destino?: string): void {
    const como = destino ?? this.destinoImagem;
    this.destinoImagem = "inserir";
    const ref = registrarMidia(this.setup, src);
    const img = new Image();
    img.onload = () => {
      const w = img.naturalWidth;
      const h = img.naturalHeight;
      if (como === "fundo") {
        this.editar((s) => ({ ...s, bg: { kind: "image", src: ref } }));
      } else if (como === "preencher" && this.selecao.length) {
        this.editar((s) => patchFormas(s, this.selecao, (f) => comPreenchimento(f, { kind: "image", src: ref })));
      } else if (como === "trocar" && this.principal()?.kind === "imagem") {
        this.editar((s) => patchFormas(s, this.selecao, (f) => (f.kind === "imagem" ? { src: ref } : {})));
      } else {
        const forma = novaImagem(ref, w, h, this.dim(), this.estilo());
        this.registrar();
        this.substituirSlide({ ...this.atual(), shapes: [...this.atual().shapes, forma] });
        this.selecao = [forma.id];
        this.markDirty();
        this.pintar();
      }
    };
    img.onerror = () => {
      /* imagem inválida: ignora */
    };
    img.src = src;
  }

  private mudarNotas(notes: string): void {
    this.substituirSlide({ ...this.atual(), notes });
    this.markDirty();
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
      md.innerHTML = marked.parse(this.atual().md, { gfm: true, async: false }) as string;
    };
    md.onkeydown = (e) => {
      if (e.key === "Escape") md.blur();
    };
  }

  private setZoom(z: number): void {
    this.stage.setZoom(z);
    this.atualizarStatus();
    this.fita.atualizar();
  }

  private markDirty(): void {
    this.opts.onDirty?.();
  }

  // ------------------------------------------------------------------
  // API pública (o App chama)
  // ------------------------------------------------------------------

  /** Deck de exemplo que "Novo" abre: 3 lâminas montadas com caixas de texto posicionadas. */
  private modeloInicial(setup: DeckSetup): Slide[] {
    const t = themeOf(setup.theme);
    const est: EstiloDeck = { fonte: setup.fontFamily || "Segoe UI", tamanho: 18, corTexto: t.fg, acento: t.accent, paleta: [] };
    const txt = (text: string, box: ShapeBox, size: number, extra: { bold?: boolean; align?: TextAlign; color?: string } = {}): Shape => {
      const s = novaCaixaDeTexto(box, est);
      const cor = extra.color ?? t.fg;
      s.paras = text.split("\n").map((l) => ({
        runs: l ? [{ text: l, size, bold: !!extra.bold, italic: false, underline: false, strike: false, color: cor, font: est.fonte }] : [],
        align: extra.align ?? "esquerda",
        lvl: 0,
        marL: 0,
        indent: 0,
        spcBef: 0,
        spcAft: 0,
        endSize: size,
      }));
      s.text = text;
      s.fontSize = size;
      s.color = cor;
      s.bold = !!extra.bold;
      s.anchor = "ctr";
      return s;
    };
    return [
      {
        md: "",
        layout: "titulo",
        notes: "Abertura: cumprimente e diga o tema da apresentação em uma frase.",
        shapes: [
          txt("Sua apresentação", { x: 8, y: 30, w: 84, h: 22 }, 54, { bold: true, align: "centro" }),
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
    const slides = deck?.slides.length ? deck.slides : this.modeloInicial(setup);
    return { setup, slides: migrarSlides(slides, setup), indice: 0, selecionada: null };
  }

  /** Aba a partir de um deck já pronto (importado de .pptx): preserva as formas, os fundos e a mídia. */
  createTabFromDeck(deck: Deck, setupInicial: DeckSetup): PowerPointTabData {
    const setup = { ...DEFAULT_SETUP, ...setupInicial };
    const slides = deck.slides.length ? deck.slides.map((x) => ({ ...x, notes: x.notes ?? "", shapes: x.shapes ?? [] })) : this.modeloInicial(setup);
    return { setup, slides: migrarSlides(slides, setup), indice: 0, selecionada: null };
  }

  load(data: PowerPointTabData): void {
    this.setup = { ...DEFAULT_SETUP, ...data.setup };
    const slides = data.slides?.length ? data.slides.map((s) => ({ ...s, notes: s.notes ?? "", shapes: s.shapes ?? [] })) : [newSlide()];
    this.slides = migrarSlides(slides, this.setup);
    this.indice = clampIndex(data.indice ?? 0, this.slides.length);
    this.selecao = data.selecionada ? [data.selecionada] : [];
    this.editando = null;
    this.ferramenta = null;
    this.hist.limpar();
    this.pane.style.setProperty("--slide-ratio", String(stageRatio(this.setup)));
    this.stage.zoomReset();
    this.pintar();
    // fontes embutidas do .pptx: ao carregarem, redesenha com as métricas certas
    if (this.setup.fonts?.length) void registrarFontes(this.setup.fonts).then(() => this.pintar());
  }

  snapshot(): PowerPointTabData {
    return {
      setup: { ...this.setup },
      slides: this.slides,
      indice: this.indice,
      selecionada: this.selecao[this.selecao.length - 1] ?? null,
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
    this.slides = migrarSlides(deck.slides.length ? deck.slides : [newSlide()], this.setup);
    this.indice = 0;
    this.selecao = [];
    this.editando = null;
    this.hist.limpar();
    this.pintar();
  }

  /** Restaura a partir de um estado serializado (histórico e cópia de backup). */
  restoreSerialized(serialized: string): void {
    const snap = deserialize(serialized);
    if (!snap) return;
    const midia = this.setup.media;
    const fontes = this.setup.fonts;
    const brutas = this.setup.fontsRaw;
    this.setup = { ...DEFAULT_SETUP, ...snap.setup, media: snap.setup.media ?? midia, fonts: snap.setup.fonts ?? fontes, fontsRaw: snap.setup.fontsRaw ?? brutas };
    this.slides = migrarSlides(snap.slides.length ? snap.slides : [newSlide()], this.setup);
    this.indice = 0;
    this.selecao = [];
    this.editando = null;
    this.hist.limpar();
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
    if (this.editando) this.sairEdicao();
    const ctx = this.ctxRender(false);
    openDeckView(this.deck, this.setup, "Apresentação", (slide) => slide.shapes.map((f) => htmlFormaRica(f, ctx)).join(""));
  }

  irPara(i: number): void {
    const novo = clampIndex(i, this.slides.length);
    if (novo === this.indice) return;
    if (this.editando) this.sairEdicao();
    this.indice = novo;
    this.selecao = [];
    this.pintar();
  }

  /** Reordena lâminas por ids (arrastar na faixa). */
  reordenar(ids: string[]): void {
    void ids;
  }

  /** Distribui formas (usado pelo botão da fita). */
  distribuir(eixo: "h" | "v"): void {
    this.run("distribuir", eixo);
  }
}
