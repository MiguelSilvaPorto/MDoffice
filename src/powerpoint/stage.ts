// O palco: onde a lâmina é desenhada e mexida com o mouse. Cuida de zoom, seleção (várias formas), mover com guias
// de encaixe, redimensionar pelas 8 alças (com a forma girada), girar, selecionar por retângulo e criar formas
// arrastando. Não conhece o deck: pede o que precisa ao host (contexto) e devolve as mudanças como "patches".
import {
  anguloDoPonteiro,
  caixaDeDuasPontas,
  centro,
  dePt,
  encaixar,
  envolvente,
  envolventeDe,
  normalizarAngulo,
  paraPt,
  redimensionar,
  seCruzam,
  type Alca,
  type Dim,
  type Guia,
} from "./edicao/geometria";
import type { Shape, ShapeBox } from "./schema";

const ZOOM_MIN = 40;
/** Até 400%: a lâmina é HTML (vetorial), então ampliar não perde nitidez. */
const ZOOM_MAX = 400;
const ZOOM_PASSO = 10;

/** Ferramenta de criação ativa (arrastar na lâmina para desenhar). */
export type Ferramenta = { tipo: "forma"; id: string } | { tipo: "texto" } | null;

export interface ContextoPalco {
  shapes: Shape[];
  dim: Dim;
  selecao: string[];
  editando: string | null;
  ferramenta: Ferramenta;
  /** os elementos do layout/mestre (fixos) podem ser escolhidos com o mouse */
  fixasSelecionaveis: boolean;
  /** expande ids para incluir o grupo de cada um */
  comGrupos: (ids: string[]) => string[];
  /** células selecionadas de uma tabela */
  celulas: CelulasSel | null;
}

export interface CelulasSel {
  id: string;
  r0: number;
  c0: number;
  r1: number;
  c1: number;
}

export interface StageHooks {
  contexto: () => ContextoPalco;
  /** a seleção mudou por clique ou retângulo */
  aoSelecionar: (ids: string[]) => void;
  /** formas mudaram de caixa/rotação; `final` = soltou o mouse; `inicio` = guarda o estado anterior para desfazer */
  aoTransformar: (patches: Map<string, Partial<Shape>>, fase: "inicio" | "meio" | "fim") => void;
  /** duplo clique numa forma (entrar no texto) */
  aoEditarTexto: (id: string) => void;
  /** terminou de arrastar com uma ferramenta de criação */
  aoCriar: (criacao: { box: ShapeBox; clique: boolean; x0: number; y0: number; x1: number; y1: number }) => void;
  /** Ctrl+arrastar: duplica a seleção e devolve os ids das cópias */
  aoDuplicarParaArrastar: () => string[];
  /** clique ou arraste sobre células de uma tabela (null = limpar) */
  aoCelulas: (sel: CelulasSel | null) => void;
}

type Modo =
  | { t: "mover"; ids: string[]; inicial: Map<string, ShapeBox>; x0: number; y0: number; moveu: boolean; duplicou: boolean; clicouEm: string }
  | { t: "redim"; ids: string[]; alca: Alca; inicial: Map<string, { box: ShapeBox; rot: number }>; x0: number; y0: number; moldura: ShapeBox }
  | { t: "girar"; ids: string[]; inicial: Map<string, { box: ShapeBox; rot: number }>; centro: { x: number; y: number }; angulo0: number }
  | { t: "retangulo"; x0: number; y0: number; soma: boolean; base: string[] }
  | { t: "criar"; x0: number; y0: number }
  | { t: "celulas"; id: string; r0: number; c0: number };

export class Stage {
  private frame: HTMLElement | null = null;
  private slideEl: HTMLElement | null = null;
  private hooks: StageHooks;
  private zoom = 100;
  private modo: Modo | null = null;
  private guias: Guia[] = [];
  private rect: ShapeBox | null = null;
  private quadro = 0;
  private ultimo: PointerEvent | null = null;

  constructor(hooks: StageHooks) {
    this.hooks = hooks;
  }

  /** Liga o palco aos elementos do HTML (o pane já existe no index.html). */
  attach(frame: HTMLElement, slideEl: HTMLElement): void {
    this.frame = frame;
    this.slideEl = slideEl;
    slideEl.addEventListener("pointerdown", (e) => this.aoPressionar(e));
    slideEl.addEventListener("pointermove", (e) => this.aoMover(e));
    slideEl.addEventListener("pointerup", (e) => this.aoSoltar(e));
    slideEl.addEventListener("pointercancel", (e) => this.aoSoltar(e));
    slideEl.addEventListener("dblclick", (e) => this.aoDuploClique(e));
  }

  get element(): HTMLElement | null {
    return this.frame;
  }

  get zoomAtual(): number {
    return this.zoom;
  }

  /** Está arrastando algo agora? (o host não deve recriar o DOM por outros motivos nesse meio tempo) */
  get arrastando(): boolean {
    return this.modo !== null;
  }

  /**
   * Aplica o zoom pela LARGURA do quadro (não por `transform: scale`).
   * A diferença importa: `transform` não afeta o layout, então a 400% a lâmina
   * extrapolaria sem criar área de rolagem — não daria para ver o resto dela.
   * Mexendo na largura, o palco rola de verdade.
   *
   * `ancora` é o ponto (em coordenadas da tela) que deve PERMANECER parado
   * durante o zoom — normalmente o ponteiro do mouse. Sem ela, o zoom ancora
   * no centro do que está visível, que é o esperado para os botões e o slider.
   */
  setZoom(valor: number, ancora?: { x: number; y: number }): number {
    const novo = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Math.round(valor)));
    if (novo === this.zoom) return this.zoom;

    const frame = this.frame;
    const caixa = this.canvasDe(frame);
    const foco = ancora ?? (caixa ? this.centroVisivel(caixa) : null);

    // posição do ponto de referência DENTRO da lâmina, em fração (0..1)
    let fx = 0.5;
    let fy = 0.5;
    if (frame && foco) {
      const antes = frame.getBoundingClientRect();
      if (antes.width > 0 && antes.height > 0) {
        fx = (foco.x - antes.left) / antes.width;
        fy = (foco.y - antes.top) / antes.height;
      }
    }

    this.zoom = novo;
    frame?.style.setProperty("--pp-zoom", String(this.zoom / 100));

    // desloca a rolagem para o mesmo ponto continuar debaixo da referência
    if (frame && caixa && foco) {
      const depois = frame.getBoundingClientRect();
      if (depois.width > 0) {
        const alvoX = depois.left + fx * depois.width;
        const alvoY = depois.top + fy * depois.height;
        caixa.scrollLeft += alvoX - foco.x;
        caixa.scrollTop += alvoY - foco.y;
      }
    }
    return this.zoom;
  }

  /** O elemento que rola o palco (o quadro pode estar dentro de um wrapper). */
  private canvasDe(frame: HTMLElement | null): HTMLElement | null {
    if (!frame) return null;
    return frame.closest<HTMLElement>(".pp-canvas") ?? frame.parentElement;
  }

  private centroVisivel(caixa: HTMLElement): { x: number; y: number } {
    const r = caixa.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  }

  zoomIn(ancora?: { x: number; y: number }): number {
    return this.setZoom(this.zoom + ZOOM_PASSO, ancora);
  }

  zoomOut(ancora?: { x: number; y: number }): number {
    return this.setZoom(this.zoom - ZOOM_PASSO, ancora);
  }

  zoomReset(): number {
    return this.setZoom(100);
  }

  /** Limites do zoom, para o controle da barra de status se montar sozinho. */
  static get limites(): { min: number; max: number; passo: number } {
    return { min: ZOOM_MIN, max: ZOOM_MAX, passo: ZOOM_PASSO };
  }

  // ------------------------------------------------------------------
  // desenho da seleção (por cima da lâmina)
  // ------------------------------------------------------------------

  /** Redesenha molduras, alças, guias e o retângulo de seleção. O host chama depois de cada desenho da lâmina. */
  desenharSelecao(): void {
    const el = this.slideEl;
    if (!el) return;
    el.querySelectorAll(".pp-sel, .pp-guia, .pp-marquee, .pp-celsel").forEach((n) => n.remove());
    const ctx = this.hooks.contexto();
    const sel = ctx.shapes.filter((s) => ctx.selecao.includes(s.id));
    const html: string[] = [];
    const caixa = (b: ShapeBox, rot: number, extra: string, alcas: boolean) => {
      const alca = (a: string) => `<span class="pp-alca" data-alca="${a}"></span>`;
      const gira = alcas ? `<span class="pp-gira" data-gira="1"></span><span class="pp-gira-haste"></span>` : "";
      const handles = alcas ? ["nw", "n", "ne", "e", "se", "s", "sw", "w"].map(alca).join("") : "";
      html.push(
        `<div class="pp-sel ${extra}" style="left:${b.x}%;top:${b.y}%;width:${b.w}%;height:${b.h}%;${rot ? `transform:rotate(${rot}deg);` : ""}">${handles}${gira}</div>`
      );
    };
    if (sel.length === 1 && !ctx.editando) {
      const s = sel[0];
      caixa(s.box, s.rot, s.bloqueada ? "bloqueada" : "", !s.bloqueada);
      if (s.tabela) html[html.length - 1] = html[html.length - 1].replace(/<\/div>$/, `<span class="pp-mover" data-mover title="Mover a tabela">✥</span></div>`);
    } else if (sel.length === 1 && ctx.editando === sel[0].id) {
      caixa(sel[0].box, sel[0].rot, "editando", false);
    } else if (sel.length > 1) {
      for (const s of sel) caixa(s.box, s.rot, "item", false);
      const m = envolventeDe(sel, ctx.dim)!;
      caixa(m, 0, "multi", sel.some((s) => !s.bloqueada));
    }
    if (ctx.celulas) {
      const cs = ctx.celulas;
      const raiz = el.getBoundingClientRect();
      const a = el.querySelector<HTMLElement>(`[data-shape="${cs.id}"] td[data-r="${cs.r0}"][data-c="${cs.c0}"]`);
      const z = el.querySelector<HTMLElement>(`[data-shape="${cs.id}"] td[data-r="${cs.r1}"][data-c="${cs.c1}"]`) ?? a;
      if (a && z) {
        const ra = a.getBoundingClientRect();
        const rz = z.getBoundingClientRect();
        const x0 = Math.min(ra.left, rz.left);
        const y0 = Math.min(ra.top, rz.top);
        const x1 = Math.max(ra.right, rz.right);
        const y1 = Math.max(ra.bottom, rz.bottom);
        html.push(`<div class="pp-celsel" style="left:${((x0 - raiz.left) / raiz.width) * 100}%;top:${((y0 - raiz.top) / raiz.height) * 100}%;width:${((x1 - x0) / raiz.width) * 100}%;height:${((y1 - y0) / raiz.height) * 100}%"></div>`);
      }
    }
    for (const g of this.guias) {
      html.push(g.eixo === "v" ? `<div class="pp-guia v" style="left:${g.pos}%"></div>` : `<div class="pp-guia h" style="top:${g.pos}%"></div>`);
    }
    if (this.rect) {
      const b = this.rect;
      html.push(`<div class="pp-marquee" style="left:${b.x}%;top:${b.y}%;width:${b.w}%;height:${b.h}%"></div>`);
    }
    el.insertAdjacentHTML("beforeend", html.join(""));
    el.classList.toggle("criando", !!ctx.ferramenta);
  }

  // ------------------------------------------------------------------
  // ponteiro
  // ------------------------------------------------------------------

  private pontoEmPct(e: { clientX: number; clientY: number }): { x: number; y: number } {
    const r = this.slideEl!.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * 100, y: ((e.clientY - r.top) / r.height) * 100 };
  }

  private aoPressionar(e: PointerEvent): void {
    if (!this.slideEl || e.button !== 0) return;
    const alvo = e.target as HTMLElement;
    const ctx = this.hooks.contexto();
    const p = this.pontoEmPct(e);

    // texto em edição: o clique é do cursor de texto
    if (ctx.editando && alvo.closest(`[data-shape="${ctx.editando}"] [data-editando]`)) return;

    // controles da mídia (player de áudio/vídeo): o clique é do player, não do palco
    if (alvo.closest("[data-player]")) return;

    // ferramenta de criação ativa: começa a desenhar
    if (ctx.ferramenta) {
      this.slideEl.setPointerCapture(e.pointerId);
      this.modo = { t: "criar", x0: p.x, y0: p.y };
      this.rect = null;
      e.preventDefault();
      return;
    }

    const alca = alvo.closest<HTMLElement>("[data-alca]");
    const gira = alvo.closest<HTMLElement>("[data-gira]");
    if ((alca || gira) && ctx.selecao.length) {
      const sel = ctx.shapes.filter((s) => ctx.selecao.includes(s.id) && !s.bloqueada);
      if (!sel.length) return;
      this.slideEl.setPointerCapture(e.pointerId);
      const inicial = new Map(sel.map((s) => [s.id, { box: { ...s.box }, rot: s.rot }]));
      const ids = sel.map((s) => s.id);
      this.hooks.aoTransformar(new Map(), "inicio");
      if (gira) {
        const m = envolventeDe(sel, ctx.dim)!;
        const c = centro(paraPt(m, ctx.dim));
        const pt = this.pontoEmPt(e, ctx.dim);
        this.modo = { t: "girar", ids, inicial, centro: c, angulo0: anguloDoPonteiro(pt.x, pt.y, c.x, c.y) };
      } else {
        const moldura = sel.length === 1 ? { ...sel[0].box } : envolventeDe(sel, ctx.dim)!;
        this.modo = { t: "redim", ids, alca: alca!.dataset.alca as Alca, inicial, x0: p.x, y0: p.y, moldura };
      }
      e.preventDefault();
      return;
    }

    // alça ✥ de uma tabela: arrasta a seleção inteira
    if (alvo.closest("[data-mover]") && ctx.selecao.length) {
      const mover = ctx.shapes.filter((s) => ctx.selecao.includes(s.id) && !s.bloqueada);
      if (mover.length) {
        this.slideEl.setPointerCapture(e.pointerId);
        this.modo = { t: "mover", ids: mover.map((s) => s.id), inicial: new Map(mover.map((s) => [s.id, { ...s.box }])), x0: p.x, y0: p.y, moveu: false, duplicou: false, clicouEm: mover[0].id };
        e.preventDefault();
        return;
      }
    }
    const formaEl = alvo.closest<HTMLElement>(".pp-shape[data-shape]");
    const id = formaEl?.dataset.shape;
    const forma = id ? ctx.shapes.find((s) => s.id === id) : undefined;
    const clicavel = forma && (!forma.fixa || ctx.fixasSelecionaveis);
    if (!clicavel || !forma) {
      // vazio: começa um retângulo de seleção (e, sem Shift, limpa a seleção)
      this.slideEl.setPointerCapture(e.pointerId);
      const soma = e.shiftKey || e.ctrlKey || e.metaKey;
      this.modo = { t: "retangulo", x0: p.x, y0: p.y, soma, base: soma ? [...ctx.selecao] : [] };
      if (!soma && ctx.selecao.length) this.hooks.aoSelecionar([]);
      e.preventDefault();
      return;
    }

    // clique numa célula de tabela: seleciona a tabela e a célula (arrastar escolhe várias); mover a tabela é pela alça ✥
    const td = alvo.closest<HTMLElement>("td[data-r]");
    if (forma.tabela && td && !alvo.closest("[data-mover]") && !e.ctrlKey && !e.metaKey) {
      const r = Number(td.dataset.r);
      const c = Number(td.dataset.c);
      if (ctx.selecao.length !== 1 || ctx.selecao[0] !== forma.id) this.hooks.aoSelecionar([forma.id]);
      this.slideEl.setPointerCapture(e.pointerId);
      if (e.shiftKey && ctx.celulas?.id === forma.id) {
        this.hooks.aoCelulas({ id: forma.id, r0: Math.min(ctx.celulas.r0, r), c0: Math.min(ctx.celulas.c0, c), r1: Math.max(ctx.celulas.r1, r), c1: Math.max(ctx.celulas.c1, c) });
        this.modo = { t: "celulas", id: forma.id, r0: ctx.celulas.r0, c0: ctx.celulas.c0 };
      } else {
        this.hooks.aoCelulas({ id: forma.id, r0: r, c0: c, r1: r, c1: c });
        this.modo = { t: "celulas", id: forma.id, r0: r, c0: c };
      }
      e.preventDefault();
      return;
    }

    // clique numa forma
    let ids = ctx.selecao.slice();
    const jaSelecionada = ids.includes(forma.id);
    if (e.shiftKey || e.ctrlKey || e.metaKey) {
      const grupo = ctx.comGrupos([forma.id]);
      ids = jaSelecionada ? ids.filter((x) => !grupo.includes(x)) : [...ids, ...grupo.filter((x) => !ids.includes(x))];
      this.hooks.aoSelecionar(ids);
      if (jaSelecionada) {
        e.preventDefault();
        return;
      }
    } else if (!jaSelecionada) {
      ids = ctx.comGrupos([forma.id]);
      this.hooks.aoSelecionar(ids);
    }
    // começa a arrastar tudo que está selecionado
    const ctx2 = this.hooks.contexto();
    const mover = ctx2.shapes.filter((s) => ctx2.selecao.includes(s.id) && !s.bloqueada);
    if (!mover.length) return;
    this.slideEl.setPointerCapture(e.pointerId);
    this.modo = {
      t: "mover",
      ids: mover.map((s) => s.id),
      inicial: new Map(mover.map((s) => [s.id, { ...s.box }])),
      x0: p.x,
      y0: p.y,
      moveu: false,
      duplicou: false,
      clicouEm: forma.id,
    };
    e.preventDefault();
  }

  private pontoEmPt(e: { clientX: number; clientY: number }, dim: Dim): { x: number; y: number } {
    const p = this.pontoEmPct(e);
    return { x: (p.x / 100) * dim.w, y: (p.y / 100) * dim.h };
  }

  private aoMover(e: PointerEvent): void {
    if (!this.modo) return;
    this.ultimo = e;
    if (this.quadro) return;
    this.quadro = requestAnimationFrame(() => {
      this.quadro = 0;
      if (this.ultimo) this.aplicar(this.ultimo);
    });
  }

  private aplicar(e: PointerEvent): void {
    const modo = this.modo;
    if (!modo || !this.slideEl) return;
    const ctx = this.hooks.contexto();
    const p = this.pontoEmPct(e);

    if (modo.t === "mover") {
      let dx = p.x - modo.x0;
      let dy = p.y - modo.y0;
      if (!modo.moveu && Math.abs(dx) + Math.abs(dy) < 0.25) return;
      if (!modo.moveu) {
        modo.moveu = true;
        // Ctrl+arrastar: arrasta cópias, deixando as originais no lugar
        if ((e.ctrlKey || e.metaKey) && !modo.duplicou) {
          const novos = this.hooks.aoDuplicarParaArrastar();
          if (novos.length) {
            const novosCtx = this.hooks.contexto();
            modo.ids = novos;
            modo.inicial = new Map(novosCtx.shapes.filter((s) => novos.includes(s.id)).map((s) => [s.id, { ...s.box }]));
            modo.duplicou = true;
          }
        } else this.hooks.aoTransformar(new Map(), "inicio");
      }
      if (e.shiftKey) {
        if (Math.abs(dx) > Math.abs(dy)) dy = 0;
        else dx = 0;
      }
      // encaixe (Alt desliga): usa o retângulo que envolve tudo que está sendo movido
      this.guias = [];
      if (!e.altKey) {
        const movidos = ctx.shapes.filter((s) => modo.ids.includes(s.id));
        const fixos = movidos.map((s) => ({ ...s, box: { ...modo.inicial.get(s.id)! } }));
        const m = envolventeDe(fixos, ctx.dim);
        if (m) {
          const r = this.slideEl.getBoundingClientRect();
          const limiar = (6 / r.width) * 100;
          const candidatos = ctx.shapes.filter((s) => !modo.ids.includes(s.id) && !s.fixa).map((s) => envolvente(s, ctx.dim));
          const enc = encaixar({ ...m, x: m.x + dx, y: m.y + dy }, candidatos, limiar);
          dx += enc.dx;
          dy += enc.dy;
          this.guias = enc.guias;
        }
      }
      const patches = new Map<string, Partial<Shape>>();
      for (const id of modo.ids) {
        const b = modo.inicial.get(id)!;
        patches.set(id, { box: { ...b, x: b.x + dx, y: b.y + dy } });
      }
      this.hooks.aoTransformar(patches, "meio");
      return;
    }

    if (modo.t === "redim") {
      const dxPt = ((p.x - modo.x0) / 100) * ctx.dim.w;
      const dyPt = ((p.y - modo.y0) / 100) * ctx.dim.h;
      const patches = new Map<string, Partial<Shape>>();
      if (modo.ids.length === 1) {
        const id = modo.ids[0];
        const i = modo.inicial.get(id)!;
        const box = redimensionar(i.box, i.rot, modo.alca, dxPt, dyPt, ctx.dim, { proporcao: e.shiftKey, doCentro: e.altKey });
        patches.set(id, { box });
      } else {
        // várias formas: escala tudo dentro da moldura que as envolve
        const m0 = paraPt(modo.moldura, ctx.dim);
        const nova = paraPt(redimensionar(modo.moldura, 0, modo.alca, dxPt, dyPt, ctx.dim, { proporcao: e.shiftKey, doCentro: e.altKey }), ctx.dim);
        const sx = m0.w ? nova.w / m0.w : 1;
        const sy = m0.h ? nova.h / m0.h : 1;
        for (const id of modo.ids) {
          const i = modo.inicial.get(id)!;
          const r = paraPt(i.box, ctx.dim);
          const rr = { x: nova.x + (r.x - m0.x) * sx, y: nova.y + (r.y - m0.y) * sy, w: r.w * sx, h: r.h * sy };
          patches.set(id, { box: dePt(rr, ctx.dim) });
        }
      }
      this.hooks.aoTransformar(patches, "meio");
      return;
    }

    if (modo.t === "girar") {
      const pt = this.pontoEmPt(e, ctx.dim);
      let delta = anguloDoPonteiro(pt.x, pt.y, modo.centro.x, modo.centro.y) - modo.angulo0;
      const patches = new Map<string, Partial<Shape>>();
      if (modo.ids.length === 1) {
        const i = modo.inicial.get(modo.ids[0])!;
        let rot = i.rot + delta;
        if (e.shiftKey) rot = Math.round(rot / 15) * 15;
        patches.set(modo.ids[0], { rot: normalizarAngulo(rot) });
      } else {
        if (e.shiftKey) delta = Math.round(delta / 15) * 15;
        const a = (delta * Math.PI) / 180;
        for (const id of modo.ids) {
          const i = modo.inicial.get(id)!;
          const c = centro(paraPt(i.box, ctx.dim));
          const dx = c.x - modo.centro.x;
          const dy = c.y - modo.centro.y;
          const nx = modo.centro.x + dx * Math.cos(a) - dy * Math.sin(a);
          const ny = modo.centro.y + dx * Math.sin(a) + dy * Math.cos(a);
          const r = paraPt(i.box, ctx.dim);
          patches.set(id, { box: dePt({ x: nx - r.w / 2, y: ny - r.h / 2, w: r.w, h: r.h }, ctx.dim), rot: normalizarAngulo(i.rot + delta) });
        }
      }
      this.hooks.aoTransformar(patches, "meio");
      return;
    }

    if (modo.t === "retangulo") {
      this.rect = caixaDeDuasPontas(modo.x0, modo.y0, p.x, p.y);
      const dentro = ctx.shapes
        .filter((s) => (!s.fixa || ctx.fixasSelecionaveis) && seCruzam(envolvente(s, ctx.dim), this.rect!))
        .filter((s) => {
          const b = envolvente(s, ctx.dim);
          // o PowerPoint seleciona o que está inteiro dentro do retângulo
          return b.x >= this.rect!.x - 0.01 && b.y >= this.rect!.y - 0.01 && b.x + b.w <= this.rect!.x + this.rect!.w + 0.01 && b.y + b.h <= this.rect!.y + this.rect!.h + 0.01;
        })
        .map((s) => s.id);
      const ids = ctx.comGrupos([...new Set([...modo.base, ...dentro])]);
      this.hooks.aoSelecionar(ids);
      this.desenharSelecao();
      return;
    }

    if (modo.t === "celulas") {
      const sob = document.elementFromPoint(e.clientX, e.clientY)?.closest<HTMLElement>("td[data-r]");
      const dono = sob?.closest<HTMLElement>(".pp-shape[data-shape]");
      if (sob && dono?.dataset.shape === modo.id) {
        const r = Number(sob.dataset.r);
        const c = Number(sob.dataset.c);
        this.hooks.aoCelulas({ id: modo.id, r0: Math.min(modo.r0, r), c0: Math.min(modo.c0, c), r1: Math.max(modo.r0, r), c1: Math.max(modo.c0, c) });
        this.desenharSelecao();
      }
      return;
    }

    if (modo.t === "criar") {
      let x1 = p.x;
      let y1 = p.y;
      if (e.shiftKey) {
        // quadrado/círculo: lados iguais em pt
        const dxPt = ((x1 - modo.x0) / 100) * ctx.dim.w;
        const dyPt = ((y1 - modo.y0) / 100) * ctx.dim.h;
        const lado = Math.max(Math.abs(dxPt), Math.abs(dyPt));
        x1 = modo.x0 + (Math.sign(dxPt || 1) * lado * 100) / ctx.dim.w;
        y1 = modo.y0 + (Math.sign(dyPt || 1) * lado * 100) / ctx.dim.h;
      }
      this.rect = caixaDeDuasPontas(modo.x0, modo.y0, x1, y1);
      this.desenharSelecao();
    }
  }

  private aoSoltar(e: PointerEvent): void {
    const modo = this.modo;
    if (!modo || !this.slideEl) return;
    if (this.quadro) {
      cancelAnimationFrame(this.quadro);
      this.quadro = 0;
    }
    this.aplicar(e);
    this.modo = null;
    try {
      this.slideEl.releasePointerCapture(e.pointerId);
    } catch {
      /* já liberado */
    }
    const ctx = this.hooks.contexto();
    if (modo.t === "criar") {
      const p = this.pontoEmPct(e);
      let x1 = p.x;
      let y1 = p.y;
      const box = this.rect;
      if (box) {
        // com Shift o retângulo já está quadrado: reaproveita os cantos dele
        x1 = modo.x0 === box.x ? box.x + box.w : box.x;
        y1 = modo.y0 === box.y ? box.y + box.h : box.y;
      }
      const pequeno = !box || (box.w / 100) * ctx.dim.w < 6 && (box.h / 100) * ctx.dim.h < 6;
      this.rect = null;
      this.hooks.aoCriar({ box: box ?? { x: modo.x0, y: modo.y0, w: 0, h: 0 }, clique: pequeno, x0: modo.x0, y0: modo.y0, x1, y1 });
      return;
    }
    if (modo.t === "retangulo") {
      this.rect = null;
      this.desenharSelecao();
      return;
    }
    if (modo.t === "celulas") {
      this.desenharSelecao();
      return;
    }
    this.guias = [];
    this.hooks.aoTransformar(new Map(), "fim");
    this.desenharSelecao();
  }

  private aoDuploClique(e: MouseEvent): void {
    const alvo = e.target as HTMLElement;
    const formaEl = alvo.closest<HTMLElement>(".pp-shape[data-shape]");
    if (!formaEl) return;
    const id = formaEl.dataset.shape!;
    const ctx = this.hooks.contexto();
    const s = ctx.shapes.find((x) => x.id === id);
    if (!s || (s.fixa && !ctx.fixasSelecionaveis)) return;
    this.hooks.aoEditarTexto(id);
  }
}
