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
  pertoDaBorda,
  redimensionar,
  seCruzam,
  type Alca,
  type Dim,
  type Guia,
} from "./edicao/geometria";
import type { Animacao, Lado, Shape, ShapeBox } from "./schema";
import { CANTO_ROTULO, CANTOS, cantosDe, valoresComSelecao, type Canto } from "./edicao/formato";
import { alvoDaConexao, bolinhaDaConexao } from "./edicao/ligacoes";
import { textoAltura, textoGiro, textoLargura, textoX, textoY } from "./edicao/medida";
import { temTexto } from "./edicao/texto";
import { pontosDoDesenhoLivre, svgPathDePontos, type PontoTraco } from "./edicao/desenho";

const ZOOM_MIN = 40;
/** Até 800%: a lâmina é HTML (vetorial), então ampliar não perde nitidez. */
const ZOOM_MAX = 800;
const ZOOM_PASSO = 10;
/** Faixa (px na tela) da beirada da forma que agarra para mover: por dentro dela, o clique é do texto. */
const BANDA_BEIRADA_PX = 6;
/**
 * Tudo o que o palco desenha POR CIMA da lâmina (overlay): a seleção, as guias, o traço, a medida…
 * Some inteiro a cada redesenho (`desenharSelecao`). Ao acrescentar um elemento novo, ele entra
 * aqui: fora da lista, as cópias se **empilham** a cada quadro do arrasto (foi o leque da curva).
 */
const SELETOR_DO_OVERLAY = ".pp-sel, .pp-guia, .pp-marquee, .pp-celsel, .pp-selo, .pp-lig-ponto, .pp-traco, .pp-no-curva, .pp-medida, .pp-giro";

/**
 * Passo do zoom por clique/roda/atalho: cresce com o nível, como nas pranchetas de
 * desenho já fazem. Sem isso, atravessar a faixa nova (100% → 800%) custaria 70 cliques
 * no "+"; com ele, ~17. O slider continua com o passo fino (`ZOOM_PASSO`), porque lá o
 * ponteiro não paga o custo de cada passo.
 */
export function passoZoom(atual: number): number {
  if (atual < 150) return 10;
  if (atual < 250) return 25;
  if (atual < 500) return 50;
  return 100;
}

const r1 = (v: number) => Math.round(v * 10) / 10;
const r2 = (v: number) => Math.round(v * 100) / 100;

/** Ferramenta ativa: desenhar arrastando, o lápis do "Draw", o "Conectar", a "Curva" por pontos ou o pincel de formatação. */
export type Ferramenta = { tipo: "forma"; id: string } | { tipo: "texto" } | { tipo: "desenho" } | { tipo: "conectar" } | { tipo: "curva" } | { tipo: "pincel" } | { tipo: "borracha" } | null;

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
  /** cantos escolhidos para a edição (as alças de canto do palco) */
  cantosSel: Canto[];
  /** animações da lâmina, na ordem — viram selos numerados sobre as formas (aba Animações) */
  animacoes: Animacao[];
  /** estilo do lápis (só no modo desenho): cor e espessura do traço ao vivo */
  pincel: { cor: string; w: number; assistente?: boolean } | null;
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
  /** duplo clique numa forma (entrar no texto); `ponto` = onde o ponteiro clicou (o caret vai lá) */
  aoEditarTexto: (id: string, ponto?: { x: number; y: number }) => void;
  /** sai da edição de texto mantendo a forma escolhida (a beirada da forma vira alça de mover) */
  aoSairEdicao: () => void;
  /** terminou de arrastar com uma ferramenta de criação */
  aoCriar: (criacao: { box: ShapeBox; clique: boolean; x0: number; y0: number; x1: number; y1: number }) => void;
  /** Ctrl+arrastar: duplica a seleção e devolve os ids das cópias */
  aoDuplicarParaArrastar: () => string[];
  /** clique ou arraste sobre células de uma tabela (null = limpar) */
  aoCelulas: (sel: CelulasSel | null) => void;
  /** os cantos escolhidos para a edição mudaram (alças de canto do palco) */
  aoSelecionarCantos: (cantos: Canto[]) => void;
  /** terminou um traço à mão (pontos em pt da lâmina) */
  aoTraco: (t: { pontos: { x: number; y: number }[] }) => void;
  /** o traço em andamento mudou (para a dica na tela) */
  aoTracoAndamento: (pontos: { x: number; y: number }[]) => void;
  /** modo conectar: a bolinha de origem e a de destino foram escolhidas */
  aoLigar: (l: { de: string; ladoDe: Lado; para: string; ladoPara: Lado }) => void;
  /** pincel de formatação: a forma clicada recebe o formato copiado (null = clique no vazio) */
  aoPincelar: (id: string | null) => void;
  /** terminou ou fechou uma curva por pontos de parada */
  aoCurva?: (c: { pontos: { x: number; y: number; reto?: boolean }[]; fechado: boolean }) => void;
  /** borracha: apagar o traço de tinta com este id (o host confere se é tinta) */
  aoApagarTinta: (id: string) => void;
}

type Modo =
  | { t: "mover"; ids: string[]; inicial: Map<string, ShapeBox>; x0: number; y0: number; moveu: boolean; duplicou: boolean; clicouEm: string }
  | { t: "redim"; ids: string[]; alca: Alca; inicial: Map<string, { box: ShapeBox; rot: number }>; x0: number; y0: number; moldura: ShapeBox }
  | { t: "girar"; ids: string[]; inicial: Map<string, { box: ShapeBox; rot: number }>; centro: { x: number; y: number }; angulo0: number; delta: number }
  | { t: "retangulo"; x0: number; y0: number; soma: boolean; base: string[] }
  | { t: "criar"; x0: number; y0: number }
  | { t: "canto"; ids: string[]; alvo: Canto; sel: Canto[]; colapsar: boolean; mexeu: boolean; partida: { x: number; y: number }; ref: { box: ShapeBox; rot: number }; inicial: Map<string, [number, number, number, number]> }
  | { t: "traco"; pontos: { x: number; y: number }[]; partida: { x: number; y: number }; moveu: boolean }
  | { t: "borracha" }
  | { t: "celulas"; id: string; r0: number; c0: number }
  | {
      /** botão direito pressionado: move a TELA (panorama) em vez de mexer na lâmina */
      t: "panorama";
      caixa: HTMLElement;
      x0: number;
      y0: number;
      esquerda: number;
      topo: number;
      moveu: boolean;
    };

export class Stage {
  private frame: HTMLElement | null = null;
  private slideEl: HTMLElement | null = null;
  private hooks: StageHooks;
  private zoom = 100;
  private modo: Modo | null = null;
  /** o último clique direito foi um arrasto de panorama? (o menu de contexto pergunta e consome) */
  private panMoveu = false;
  private guias: Guia[] = [];
  private rect: ShapeBox | null = null;
  /** traço à mão em andamento (em % da lâmina), só no modo desenho */
  private traco: { x: number; y: number }[] | null = null;
  /** pontos fixos de parada da curva em andamento (em % da lâmina) */
  private pontosCurva: { x: number; y: number; reto?: boolean }[] = [];
  /** último clique do modo Pontos: o par próximo (<350 ms e <6 px) TERMINA a curva aberta */
  private ultimoToqueCurva = { t: 0, x: 0, y: 0 };
  /** o cursor está perto do ponto inicial (clique fecha a forma)? */
  private pertoDoInicio = false;
  /** modo do desenho no Draw: "livre" (arrasto) ou "pontos" (cliques de parada) */
  private modoDesenho: "livre" | "pontos" = "livre";
  /** modo conectar: a forma sob o mouse (as bolinhas seguem ela) e a bolinha de origem escolhida */
  private ligHover: string | null = null;
  private ligOrigem: { id: string; lado: Lado } | null = null;
  private quadro = 0;
  private ultimo: PointerEvent | null = null;
  /** aviso flutuante do arrasto de canto ("22% · 3 cantos"), desenhado junto da seleção */
  private hudCanto: string | null = null;
  /** último clique parado numa alça de canto (para o duplo clique "deixar quadrado") */
  private cliqueCanto: { id: Canto; t: number } | null = null;

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
    const caixa = this.canvasDe(frame);
    caixa?.addEventListener("pointerdown", (e) => {
      if (e.button === 2 && !slideEl.contains(e.target as Node)) this.aoPressionar(e);
    });
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
   * A diferença importa: `transform` não afeta o layout, então no zoom alto a lâmina
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
    return this.setZoom(this.zoom + passoZoom(this.zoom), ancora);
  }

  zoomOut(ancora?: { x: number; y: number }): number {
    return this.setZoom(this.zoom - passoZoom(this.zoom), ancora);
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
    el.querySelectorAll(SELETOR_DO_OVERLAY).forEach((n) => n.remove());
    const ctx = this.hooks.contexto();
    const sel = ctx.shapes.filter((s) => ctx.selecao.includes(s.id));
    // O cursor do texto: com UMA forma escolhida e com texto, o clique no texto é do texto (ver
    // aoPressionar) — e o cursor diz isso; sem escolha ou com várias, pegar a forma é mover.
    el.classList.toggle("pp-texto-um", sel.length === 1 && temTexto(sel[0].paras) && !sel[0].bloqueada);
    this.marcarEscolhidas(el, ctx);
    const html: string[] = [];
    const caixa = (b: ShapeBox, rot: number, extra: string, alcas: boolean, dentro = "", dono?: string) => {
      // `dono`: as alças pertencem a UMA forma (as 4 de canto, menores) — arrastar
      // redimensiona só ela. Sem dono, são as 8 da seleção/quadro do grupo.
      const data = dono ? ` data-dono="${dono}"` : "";
      const alca = (a: string) => `<span class="pp-alca"${data} data-alca="${a}"></span>`;
      const gira = alcas && !dono ? `<span class="pp-gira" data-gira="1"></span><span class="pp-gira-haste"></span>` : "";
      const pontos = dono ? ["nw", "ne", "se", "sw"] : ["nw", "n", "ne", "e", "se", "s", "sw", "w"];
      const handles = alcas ? pontos.map(alca).join("") : "";
      html.push(
        `<div class="pp-sel ${extra}" style="left:${b.x}%;top:${b.y}%;width:${b.w}%;height:${b.h}%;${rot ? `transform:rotate(${rot}deg);` : ""}">${handles}${gira}${dentro}</div>`
      );
    };
    // alças de canto: cada uma senta no próprio arco; em raio 0 fica um tico para dentro,
    // para não cobrir a alça de redimensionar que fica exatamente no canto.
    // Vale na forma única e no quadro do grupo (aí a posição usa o maior raio de cada canto).
    const alcasDeCanto = (b: ShapeBox, valores: [number, number, number, number] | null): string => {
      if (!valores) return "";
      const bw = (b.w / 100) * ctx.dim.w;
      const bh = (b.h / 100) * ctx.dim.h;
      const ss = Math.min(bw, bh);
      const recuo = (v: number) => 0.2929 * (v / 100) * ss + this.afastamentoPt(ctx.dim);
      const pctX = (v: number) => r2((recuo(v) / bw) * 100);
      const pctY = (v: number) => r2((recuo(v) / bh) * 100);
      const pos: Record<Canto, [number, number]> = {
        tl: [pctX(valores[0]), pctY(valores[0])],
        tr: [100 - pctX(valores[1]), pctY(valores[1])],
        br: [100 - pctX(valores[2]), 100 - pctY(valores[2])],
        bl: [pctX(valores[3]), 100 - pctY(valores[3])],
      };
      const alca = (id: Canto) => {
        const escolhido = ctx.cantosSel.includes(id);
        const n = ctx.cantosSel.length;
        const valor = r1(valores[CANTOS.indexOf(id)]);
        const acao = escolhido && n > 1 ? `Arraste arredonda os ${n} cantos escolhidos` : "Arraste para arredondar";
        return (
          `<span class="pp-canto${escolhido ? " on" : ""}" data-canto="${id}" aria-label="Canto ${CANTO_ROTULO[id]} — ${valor}%" style="left:${pos[id][0]}%;top:${pos[id][1]}%">` +
          `<span class="pp-canto-dica"><span class="pp-canto-nome">Canto ${CANTO_ROTULO[id]} · <b>${valor}%</b></span><small>${acao} · Shift+clique soma ou tira</small></span>` +
          `</span>`
        );
      };
      return CANTOS.map(alca).join("") + (this.hudCanto ? `<span class="pp-canto-hud">${this.hudCanto}</span>` : "");
    };
    /** O maior raio de cada canto entre as formas escolhidas (posição das alças do grupo). */
    const cantosDoGrupo = (formas: Shape[]): [number, number, number, number] | null => {
      const lista = formas.map((s) => (s.bloqueada ? null : cantosDe(s))).filter((c): c is [number, number, number, number] => !!c);
      if (!lista.length) return null;
      return [0, 1, 2, 3].map((i) => Math.max(...lista.map((c) => c[i]))) as [number, number, number, number];
    };
    if (sel.length === 1 && !ctx.editando) {
      const s = sel[0];
      caixa(s.box, s.rot, s.bloqueada ? "bloqueada" : "", !s.bloqueada, s.bloqueada ? "" : alcasDeCanto(s.box, cantosDe(s)));
      if (s.tabela) html[html.length - 1] = html[html.length - 1].replace(/<\/div>$/, `<span class="pp-mover" data-mover title="Mover a tabela">✥</span></div>`);
    } else if (sel.length === 1 && ctx.editando === sel[0].id) {
      caixa(sel[0].box, sel[0].rot, "editando", false);
    } else if (sel.length > 1) {
      // Cada forma escolhida ganha as PRÓPRIAS 4 alças de canto (menores, com
      // `data-dono`): dá para redimensionar uma forma só sem desfazer a seleção.
      // O quadro do grupo continua com as 8, para mexer em todas de uma vez.
      for (const s of sel) caixa(s.box, s.rot, "item", !s.bloqueada, "", s.bloqueada ? undefined : s.id);
      const m = envolventeDe(sel, ctx.dim)!;
      caixa(m, 0, "multi", sel.some((s) => !s.bloqueada), alcasDeCanto(m, cantosDoGrupo(sel)));
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
    // selos numerados das formas animadas (o número é a ordem dos efeitos na lâmina)
    ctx.animacoes.forEach((a, i) => {
      const forma = ctx.shapes.find((s) => s.id === a.forma);
      if (!forma) return;
      html.push(`<div class="pp-selo" style="left:${forma.box.x}%;top:${forma.box.y}%" title="Animação ${i + 1} — ${a.tipo}">${i + 1}</div>`);
    });
    for (const g of this.guias) {
      html.push(g.eixo === "v" ? `<div class="pp-guia v" style="left:${g.pos}%"></div>` : `<div class="pp-guia h" style="top:${g.pos}%"></div>`);
    }
    // A prévia do traço e da curva é o MESMO desenho do que vai ficar: os pontos viram o caminho
    // suave no espaço em pt da lâmina (antes eram uma polilinha em % com `non-scaling-stroke`, que
    // no zoom alto saía fina e serrilhada enquanto o traço final era grosso e curvo). Com o
    // assistente ligado, a prévia do traço já mostra o encaixe nos eixos — o mesmo
    // `pontosDoDesenhoLivre` do final.
    const paraPt = (pts: PontoTraco[]) =>
      pts.map((p) => ({ x: (p.x / 100) * ctx.dim.w, y: (p.y / 100) * ctx.dim.h, ...(p.reto ? { reto: true } : {}) }));
    if (this.traco && this.traco.length > 1) {
      const d = svgPathDePontos(pontosDoDesenhoLivre(paraPt(this.traco), !!ctx.pincel?.assistente));
      html.push(
        `<svg class="pp-traco" viewBox="0 0 ${ctx.dim.w} ${ctx.dim.h}" aria-hidden="true">` +
          `<path d="${d}" fill="none" stroke="#${ctx.pincel?.cor ?? "888888"}" stroke-width="${ctx.pincel?.w ?? 2}" stroke-linecap="round" stroke-linejoin="round"/></svg>`
      );
    }
    if (this.pontosCurva.length > 0) {
      // a prévia mostra SÓ os pontos marcados: o trecho até o cursor (elástico) seguia o mouse sem
      // parar entre os cliques e atrapalhava (relato do usuário) — o halo do ponto inicial continua,
      // que é o que avisa que o clique fecha a forma
      const pts = [...this.pontosCurva];
      const cor = ctx.pincel?.cor ?? "888888";
      const w = ctx.pincel?.w ?? 2;
      const fechando = this.pertoDoInicio && this.pontosCurva.length >= 3;
      const d = svgPathDePontos(paraPt(pts), fechando);
      html.push(
        `<svg class="pp-traco pp-curva-preview" viewBox="0 0 ${ctx.dim.w} ${ctx.dim.h}" aria-hidden="true">` +
          `<path d="${d}" fill="${fechando ? "#" + cor : "none"}" fill-opacity="${fechando ? "0.15" : "0"}" stroke="#${cor}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/>` +
        `</svg>`
      );
      for (let i = 0; i < this.pontosCurva.length; i++) {
        const pt = this.pontosCurva[i];
        const ehInicio = i === 0;
        const aceso = ehInicio && this.pertoDoInicio;
        const cls = `pp-no-curva${ehInicio ? " inicio" : ""}${aceso ? " fecha" : ""}${pt.reto ? " reto" : ""}`;
        html.push(
          `<span class="${cls}" style="left:${pt.x.toFixed(2)}%;top:${pt.y.toFixed(2)}%" title="${ehInicio ? (aceso ? "Clique para fechar a forma" : "Ponto inicial") : `Ponto ${i + 1}`}"></span>`
        );
      }
    }
    if (this.rect) {
      const b = this.rect;
      html.push(`<div class="pp-marquee" style="left:${b.x}%;top:${b.y}%;width:${b.w}%;height:${b.h}%"></div>`);
    }
    if (
      ctx.ferramenta?.tipo !== "curva" &&
      !(ctx.ferramenta?.tipo === "desenho" && this.modoDesenho === "pontos")
    ) {
      this.pontosCurva = [];
    }
    // modo conectar: as bolinhas nas bordas da forma sob o mouse (a de origem fica acesa)
    if (ctx.ferramenta?.tipo !== "conectar") {
      this.ligOrigem = null;
      this.ligHover = null;
    } else if (this.ligHover) {
      const alvo = ctx.shapes.find((s) => s.id === this.ligHover);
      if (alvo) {
        const cx = alvo.box.x + alvo.box.w / 2;
        const cy = alvo.box.y + alvo.box.h / 2;
        const pontos: [Lado, number, number][] = [
          ["topo", cx, alvo.box.y],
          ["base", cx, alvo.box.y + alvo.box.h],
          ["esq", alvo.box.x, cy],
          ["dir", alvo.box.x + alvo.box.w, cy],
        ];
        for (const [lado, x, y] of pontos) {
          const on = this.ligOrigem?.id === alvo.id && this.ligOrigem.lado === lado;
          html.push(
            `<button type="button" class="pp-lig-ponto${on ? " on" : ""}" data-lig-lado="${lado}" data-lig-id="${alvo.id}" style="left:${r2(x)}%;top:${r2(y)}%" title="Ligar aqui" aria-label="Ligar aqui"></button>`
          );
        }
      }
    }
    // Fita métrica: a medida MORA NAS LINHAS do gesto (ver `medida.ts`). Ao mover, a linha em pé
    // marca o x e a deitada o y — o rótulo viaja na própria linha, junto do canto; ao
    // redimensionar/desenhar, a linha de baixo mostra a largura e a da direita a altura. A caixa
    // sai do estado ATUAL — o host já aplicou o quadro do arrasto —, então vale para os três
    // gestos, e some ao soltar (o modo deixa de ser um deles).
    const gesto = this.modo?.t;
    if (gesto === "mover" || gesto === "redim" || gesto === "criar") {
      const alvo = gesto === "criar" ? this.rect : sel.length === 1 ? sel[0].box : sel.length > 1 ? envolventeDe(sel, ctx.dim) : null;
      if (alvo) {
        if (gesto === "mover") {
          html.push(`<div class="pp-guia v" style="left:${r2(alvo.x)}%"></div>`);
          html.push(`<div class="pp-guia h" style="top:${r2(alvo.y)}%"></div>`);
          // sem espaço acima/à esquerda do canto, o rótulo vira para o outro lado do ponto
          html.push(
            `<span class="pp-medida ${alvo.y < 8 ? "abaixo" : "acima"}" style="left:${r2(alvo.x)}%;top:${r2(alvo.y)}%">${textoX(alvo, ctx.dim)}</span>`
          );
          html.push(
            `<span class="pp-medida ${alvo.x < 12 ? "direita" : "esquerda"}" style="left:${r2(alvo.x)}%;top:${r2(alvo.y)}%">${textoY(alvo, ctx.dim)}</span>`
          );
        } else {
          // a largura vai na linha de baixo (no meio do quadro) e a altura na da direita (no meio da altura)
          const xDir = alvo.x + alvo.w;
          const yBaixo = alvo.y + alvo.h;
          html.push(`<div class="pp-guia v" style="left:${r2(xDir)}%"></div>`);
          html.push(`<div class="pp-guia h" style="top:${r2(yBaixo)}%"></div>`);
          html.push(
            `<span class="pp-medida ${yBaixo > 92 ? "acima" : "abaixo"}" style="left:${r2(alvo.x + alvo.w / 2)}%;top:${r2(yBaixo)}%">${textoLargura(alvo, ctx.dim)}</span>`
          );
          html.push(
            `<span class="pp-medida ${xDir > 88 ? "esquerda" : "direita"}" style="left:${r2(xDir)}%;top:${r2(alvo.y + alvo.h / 2)}%">${textoAltura(alvo, ctx.dim)}</span>`
          );
        }
      }
    }
    // Giro: o ângulo aparece junto da alça. O rótulo NÃO entra na caixa girada (ali
    // ele giraria junto e ficaria torto): a posição é calculada no espaço da lâmina,
    // como a própria alça. Uma forma mostra o ângulo que ela tem AGORA (o mesmo do
    // campo Rotação); várias mostram o quanto a seleção girou, porque cada uma pode
    // ter partido de um ângulo próprio.
    if (gesto === "girar" && this.modo?.t === "girar" && sel.length) {
      const modo = this.modo;
      const um = sel.length === 1 ? sel[0] : null;
      const b = um ? um.box : envolventeDe(sel, ctx.dim);
      if (b) {
        const rot = um ? um.rot : 0;
        const bh = (b.h / 100) * ctx.dim.h;
        const cb = { x: ((b.x + b.w / 2) / 100) * ctx.dim.w, y: ((b.y + b.h / 2) / 100) * ctx.dim.h };
        // a bolinha de giro vive ~32 px acima do topo, no espaço LOCAL da caixa; + 4 px
        // de folga. `pxEmPt` mantém a distância igual em qualquer zoom, como a alça.
        const off = bh / 2 + this.pxEmPt(ctx.dim, 36);
        const rad = (rot * Math.PI) / 180;
        const x = ((cb.x + Math.sin(rad) * off) / ctx.dim.w) * 100;
        const y = ((cb.y - Math.cos(rad) * off) / ctx.dim.h) * 100;
        // a volta completa é normalizada: "+370°" na tela seria o mesmo que "+10°"
        const curto = normalizarAngulo(modo.delta + 180) - 180;
        const texto = um ? textoGiro(um.rot) : textoGiro(curto, true);
        // de que lado da bolinha o balão cai: ele sai para FORA da caixa (o "para cima"
        // local aponta para cima na tela em 0° e para baixo em 180°); perto da borda
        // da lâmina o lado da tela vence, para o número não sair do quadro
        const cima = -Math.cos(rad);
        const lado = Math.abs(cima) > 0.2 ? (cima < 0 ? "acima" : "abaixo") : y < 10 ? "abaixo" : "acima";
        html.push(
          `<span class="pp-medida pp-giro ${lado}" style="left:${r2(Math.max(5, Math.min(95, x)))}%;top:${r2(Math.max(2, Math.min(98, y)))}%">${texto}</span>`
        );
      }
    }
    el.insertAdjacentHTML("beforeend", html.join(""));
    // o pincel de formatação não é uma ferramenta de desenhar: o ponteiro vira o "copiar" (cursor de
    // cruz fica para quem cria/rabisca)
    el.classList.toggle("criando", !!ctx.ferramenta && ctx.ferramenta.tipo !== "pincel");
    el.classList.toggle("pincel-fmt", ctx.ferramenta?.tipo === "pincel");
  }

  /**
   * A ESCOLHA no DOM das formas.
   *
   * A lâmina é redesenhada quando o CONTEÚDO muda — a escolha muda o tempo todo, e sem isto as
   * classes nasciam desatualizadas: a forma escolhida não dizia que o vazio dela podia ser
   * arrastado (`pp-pega`, que também vira área de arrasto) e o cursor do texto nunca aparecia.
   * Como o desenho da lâmina é caro, quem marca a escolha é o palco, a cada `desenharSelecao`.
   *
   * - `pp-escolhida`: a forma está escolhida (o cursor do miolo é o de mover);
   * - `pp-pega`: forma **sem preenchimento** escolhida — o miolo inteiro vira área de arrasto
   *   (fora da edição: com o texto em edição quem manda é o cursor de texto).
   */
  private marcarEscolhidas(el: HTMLElement, ctx: ContextoPalco): void {
    const ids = new Set(ctx.selecao);
    for (const n of el.querySelectorAll<HTMLElement>(".pp-shape[data-shape]")) {
      const escolhida = ids.has(n.dataset.shape ?? "");
      n.classList.toggle("pp-escolhida", escolhida);
      n.classList.toggle("pp-pega", escolhida && !ctx.editando && n.classList.contains("pp-sem-fundo"));
    }
  }

  // ------------------------------------------------------------------
  // ponteiro
  // ------------------------------------------------------------------

  private pontoEmPct(e: { clientX: number; clientY: number }): { x: number; y: number } {
    const r = this.slideEl!.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * 100, y: ((e.clientY - r.top) / r.height) * 100 };
  }

  /**
   * O último clique direito foi um arrasto (panorama)? Consome a marca.
   *
   * Quem pergunta é o menu de contexto: botão direito + arrastar move a TELA (e não abre o
   * menu); clique parado continua abrindo. O navegador dispara `contextmenu` logo depois do
   * `pointerup`, então a marca precisa sobreviver de um evento para o outro — e o arrasto
   * só conta depois de passar a zona morta de 3 px (clique tremido não vira arrasto).
   */
  consumirPanorama(): boolean {
    const moveu = this.panMoveu;
    this.panMoveu = false;
    return moveu;
  }

  private aoPressionar(e: PointerEvent): void {
    if (!this.slideEl) return;

    // botão direito pressionado: arrastar move a tela (panorama). Sem arrasto, o clique
    // segue para o menu de contexto (ver `consumirPanorama`).
    if (e.button === 2) {
      const caixa = this.canvasDe(this.frame);
      if (!caixa) return;
      if (!this.hooks.contexto().editando) window.getSelection()?.removeAllRanges();
      try {
        this.slideEl.setPointerCapture(e.pointerId);
      } catch {
        /* ponteiro fora da lâmina ou sintético */
      }
      this.modo = {
        t: "panorama",
        caixa,
        x0: e.clientX,
        y0: e.clientY,
        esquerda: caixa.scrollLeft,
        topo: caixa.scrollTop,
        moveu: false,
      };
      this.frame?.classList.add("pp-panorama"); // cursor de "agarrando" em toda a moldura
      e.preventDefault();
      return;
    }

    if (e.button !== 0) return;
    const alvo = e.target as HTMLElement;
    const ctx = this.hooks.contexto();
    const p = this.pontoEmPct(e);

    // Texto em edição: o clique é do cursor de TEXTO — menos na BEIRADA da forma (que é a
    // alça de mover) e menos na parte VAZIA da box (que também deve pegar a box: sair do
    // texto e arrastar a forma, como no PowerPoint). O `contenteditable` cobre a caixa
    // inteira (o padding incluso), então sem isto o clique no vazio era engolido pelo
    // texto — ou limpava a seleção, quando caía fora do elemento da forma.
    if (ctx.editando && !ctx.ferramenta) {
      const emEdicao = ctx.shapes.find((s) => s.id === ctx.editando);
      if (emEdicao && !emEdicao.bloqueada) {
        const ponto = this.pontoEmPt(e, ctx.dim);
        const naBeirada = pertoDaBorda(paraPt(emEdicao.box, ctx.dim), ponto, this.pxEmPt(ctx.dim, BANDA_BEIRADA_PX));
        if (naBeirada) {
          this.hooks.aoSairEdicao();
        } else if (this.dentroDaBox(emEdicao, e) && !this.sobreOTexto(emEdicao.id, e)) {
          // a parte vazia da box: sai do texto, a box fica escolhida e o arrasto a move
          this.hooks.aoSairEdicao();
          const grupo = ctx.comGrupos([emEdicao.id]);
          this.hooks.aoSelecionar(grupo);
          const moviveis = ctx.shapes.filter((s) => grupo.includes(s.id) && !s.bloqueada);
          if (!moviveis.length) return;
          try {
            this.slideEl.setPointerCapture(e.pointerId);
          } catch {
            /* ponteiro sintético */
          }
          this.modo = {
            t: "mover",
            ids: moviveis.map((s) => s.id),
            inicial: new Map(moviveis.map((s) => [s.id, { ...s.box }])),
            x0: p.x,
            y0: p.y,
            moveu: false,
            duplicou: false,
            clicouEm: emEdicao.id,
          };
          e.preventDefault();
          return;
        } else if (alvo.closest(`[data-shape="${ctx.editando}"] [data-editando]`)) {
          return; // é o cursor de texto
        }
      }
    }
    window.getSelection()?.removeAllRanges();

    // controles da mídia (player de áudio/vídeo): o clique é do player, não do palco
    if (alvo.closest("[data-player]")) return;

    // modo conectar: as bolinhas das bordas ligam uma forma na outra. O alvo é geométrico e
    // com folga (~8 px): a bolinha é pequena e a caixa de baixo não pode roubar o clique
    if (ctx.ferramenta?.tipo === "conectar") {
      const r = this.slideEl.getBoundingClientRect();
      const px = (n: number, total: number, reserva: number) => (total > 0 ? (n / total) * 100 : reserva);
      const bolinha = bolinhaDaConexao(ctx.shapes.filter((s) => !s.liga), p, px(8, r.width, 0.9), px(8, r.height, 1.5));
      if (bolinha) {
        if (!this.ligOrigem) this.ligOrigem = { id: bolinha.id, lado: bolinha.lado };
        else {
          const origem = this.ligOrigem;
          this.ligOrigem = null;
          this.hooks.aoLigar({ de: origem.id, ladoDe: origem.lado, para: bolinha.id, ladoPara: bolinha.lado });
        }
        this.desenharSelecao();
      } else if (this.ligOrigem) {
        this.ligOrigem = null; // clique fora das bolinhas cancela a origem
        this.desenharSelecao();
      }
      e.preventDefault();
      return;
    }

    // pincel de formatação: o clique entrega a forma sob o ponteiro (o vazio não tem o que pintar;
    // a seleção e as alças ficam paradas — o pincel está armado até aplicar, desligar ou Esc)
    if (ctx.ferramenta?.tipo === "pincel") {
      const formaEl = alvo.closest<HTMLElement>(".pp-shape[data-shape]");
      const id = formaEl?.dataset.shape;
      const forma = id ? ctx.shapes.find((s) => s.id === id) : undefined;
      this.hooks.aoPincelar(forma && (!forma.fixa || ctx.fixasSelecionaveis) ? forma.id : null);
      e.preventDefault();
      return;
    }

    // ferramenta de criação ativa: começa a desenhar (ou a rabiscar, no modo desenho)
    if (ctx.ferramenta) {
      this.slideEl.setPointerCapture(e.pointerId);
      if (ctx.ferramenta.tipo === "borracha") {
        // borracha: apaga os traços de tinta sob o ponteiro (e segue apagando no arrasto)
        this.modo = { t: "borracha" };
        this.apagarEm(e);
        e.preventDefault();
        return;
      }
      if (ctx.ferramenta.tipo === "curva" || (ctx.ferramenta.tipo === "desenho" && this.modoDesenho === "pontos")) {
        const pSnap = this.pontoComSnap(e, ctx);
        if (this.pertoDoInicio && this.pontosCurva.length >= 3) {
          this.hooks.aoCurva?.({ pontos: [...this.pontosCurva], fechado: true });
          this.limparCurva();
          e.preventDefault();
          return;
        }
        // duplo clique TERMINA a curva aberta: o `preventDefault` do pointerdown corta o `dblclick`
        // de compatibilidade (o mesmo caso do duplo clique da alça de canto), então o par é contado
        // aqui — o primeiro clique marcou o ponto, o segundo fecha a curva (sem ponto repetido).
        const agora = Date.now();
        const duplo =
          agora - this.ultimoToqueCurva.t < 350 &&
          Math.hypot(pSnap.x - this.ultimoToqueCurva.x, pSnap.y - this.ultimoToqueCurva.y) < 6;
        if (duplo && this.pontosCurva.length >= 2) {
          this.finalizarCurva();
          e.preventDefault();
          return;
        }
        this.ultimoToqueCurva = { t: agora, x: pSnap.x, y: pSnap.y };
        this.pontosCurva.push(pSnap);
        this.desenharSelecao();
        e.preventDefault();
        return;
      }
      if (ctx.ferramenta.tipo === "desenho") {
        this.modo = { t: "traco", pontos: [p], partida: p, moveu: false };
        this.traco = this.modo.pontos;
        this.desenharSelecao();
      } else {
        this.modo = { t: "criar", x0: p.x, y0: p.y };
        this.rect = null;
      }
      e.preventDefault();
      return;
    }

    // alça de canto: clique escolhe SÓ aquele canto (Shift liga/desliga sem arrastar); arrastar
    // muda os escolhidos — inclusive com várias formas selecionadas (aí vale para todas)
    const cantoEl = alvo.closest<HTMLElement>("[data-canto]");
    if (cantoEl && ctx.selecao.length) {
      const escolhidas = ctx.shapes.filter((x) => ctx.selecao.includes(x.id) && !x.bloqueada);
      const comCanto = escolhidas.filter((s) => cantosDe(s));
      if (comCanto.length) {
        const id = cantoEl.dataset.canto as Canto;
        if (e.shiftKey || e.ctrlKey || e.metaKey) {
          const novo = ctx.cantosSel.includes(id)
            ? ctx.cantosSel.length > 1
              ? ctx.cantosSel.filter((c) => c !== id)
              : ctx.cantosSel
            : [...ctx.cantosSel, id];
          this.hooks.aoSelecionarCantos(novo);
          e.preventDefault();
          return;
        }
        // duplo clique na alça (detectado aqui, sem depender do evento nativo: o overlay é
        // reconstruído entre os cliques e o navegador perde o par): aquele canto volta a quadrado
        if (this.cliqueCanto?.id === id && performance.now() - this.cliqueCanto.t < 450) {
          this.cliqueCanto = null;
          const patches = new Map<string, Partial<Shape>>();
          for (const sh of comCanto) {
            const base = cantosDe(sh);
            if (base) patches.set(sh.id, { cantos: valoresComSelecao(base, [id], 0), geom: "roundRect", adj: undefined });
          }
          if (patches.size) {
            this.hooks.aoSelecionarCantos([id]);
            this.hooks.aoTransformar(new Map(), "inicio");
            this.hooks.aoTransformar(patches, "fim");
          }
          e.preventDefault();
          return;
        }
        // clique num canto já escolhido mantém o grupo para o arrasto; sem arrasto, colapsa nele
        const colapsar = ctx.cantosSel.includes(id) && ctx.cantosSel.length > 1;
        const selC: Canto[] = colapsar ? ctx.cantosSel : [id];
        this.hooks.aoSelecionarCantos(selC);
        const inicial = new Map<string, [number, number, number, number]>();
        for (const sh of comCanto) inicial.set(sh.id, cantosDe(sh)!);
        const ref =
          escolhidas.length === 1
            ? { box: { ...escolhidas[0].box }, rot: escolhidas[0].rot }
            : { box: envolventeDe(escolhidas, ctx.dim) ?? { ...escolhidas[0].box }, rot: 0 };
        this.slideEl.setPointerCapture(e.pointerId);
        this.slideEl.classList.add("pp-arrastando-canto");
        this.hooks.aoTransformar(new Map(), "inicio");
        this.hudCanto = null;
        this.modo = { t: "canto", ids: [...inicial.keys()], alvo: id, sel: selC, colapsar, mexeu: false, partida: p, ref, inicial };
        e.preventDefault();
        return;
      }
    }

    const alca = alvo.closest<HTMLElement>("[data-alca]");
    const gira = alvo.closest<HTMLElement>("[data-gira]");
    if ((alca || gira) && ctx.selecao.length) {
      // Alça com dono (múltipla seleção): redimensiona SÓ aquela forma, sem
      // desfazer a seleção; sem dono, quem manda é a seleção inteira (quadro do grupo).
      const dono = alca?.dataset.dono;
      const sel = ctx.shapes.filter((s) => (dono ? s.id === dono : ctx.selecao.includes(s.id)) && !s.bloqueada);
      if (!sel.length) return;
      this.slideEl.setPointerCapture(e.pointerId);
      const inicial = new Map(sel.map((s) => [s.id, { box: { ...s.box }, rot: s.rot }]));
      const ids = sel.map((s) => s.id);
      this.hooks.aoTransformar(new Map(), "inicio");
      if (gira) {
        const m = envolventeDe(sel, ctx.dim)!;
        const c = centro(paraPt(m, ctx.dim));
        const pt = this.pontoEmPt(e, ctx.dim);
        this.modo = { t: "girar", ids, inicial, centro: c, angulo0: anguloDoPonteiro(pt.x, pt.y, c.x, c.y), delta: 0 };
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
      // Fora de qualquer forma, mas sobre o TEXTO da forma escolhida (o texto pode passar do
      // quadro: `overflow: visible`): o gesto ainda é do texto — entra na edição em vez de
      // largar a escolha. É o vazio ao lado/embaixo do texto que PARECE da caixa.
      const um = ctx.selecao.length === 1 ? ctx.shapes.find((s) => s.id === ctx.selecao[0]) : undefined;
      if (um && this.gestoDoTexto(um, ctx, e) && this.noTextoPintado(um.id, e)) {
        this.hooks.aoEditarTexto(um.id, { x: e.clientX, y: e.clientY });
        return;
      }
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

    // Clique no TEXTO de uma forma já escolhida: o gesto é do texto — entra na edição e o
    // arrasto seleciona (sem preventDefault, para o navegador seguir com a seleção nativa).
    // É o que faltava: sem isso, arrastar por cima do texto movia a forma e o texto ficava
    // inalcançável (a edição só abria por duplo clique, e o duplo clique nativo não sobrevive
    // ao preventDefault daqui). O mover fica na BEIRADA da forma (`BANDA_BEIRADA_PX`) e, com
    // várias formas escolhidas, o arrasto continua movendo o conjunto.
    if (!e.shiftKey && !e.ctrlKey && !e.metaKey && this.gestoDoTexto(forma, ctx, e) && alvo.closest(".pp-shape-text")) {
      this.hooks.aoEditarTexto(forma.id, { x: e.clientX, y: e.clientY });
      return;
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

  /**
   * O gesto é do TEXTO da forma? Uma forma escolhida (sozinha), com texto, e o ponto fora da
   * BEIRADA dela — na beirada quem manda é o mover (ver `aoPressionar`).
   */
  private gestoDoTexto(forma: Shape, ctx: ContextoPalco, e: { clientX: number; clientY: number }): boolean {
    return (
      ctx.selecao.length === 1 &&
      ctx.selecao[0] === forma.id &&
      !forma.bloqueada &&
      temTexto(forma.paras) &&
      !pertoDaBorda(paraPt(forma.box, ctx.dim), this.pontoEmPt(e, ctx.dim), this.pxEmPt(ctx.dim, BANDA_BEIRADA_PX))
    );
  }

  /**
   * O ponto cai sobre o texto PINTADO da forma: a caixa do texto e o que **transborda** dela.
   * O texto pode passar do quadro (`overflow: visible`) — e o vazio ao lado/embaixo do texto,
   * que parece da caixa, fica FORA do quadro: sem esta conta, o clique ali largaria a escolha.
   */
  private noTextoPintado(id: string, e: { clientX: number; clientY: number }): boolean {
    const div = this.slideEl?.querySelector<HTMLElement>(`[data-shape="${id}"] .pp-shape-text`);
    if (!div) return false;
    const partes = [div, ...Array.from(div.querySelectorAll<HTMLElement>("*"))];
    const r = partes.map((n) => n.getBoundingClientRect());
    const folga = BANDA_BEIRADA_PX; // a mesma folga do gesto, agora em px de tela
    return (
      e.clientX >= Math.min(...r.map((x) => x.left)) - folga &&
      e.clientX <= Math.max(...r.map((x) => x.right)) + folga &&
      e.clientY >= Math.min(...r.map((x) => x.top)) - folga &&
      e.clientY <= Math.max(...r.map((x) => x.bottom)) + folga
    );
  }

  /** `px` na tela -> pt da lâmina (a lâmina encolhe com o zoom, então 1 pt não é 1 px). */
  private pxEmPt(dim: Dim, px: number): number {
    const larguraPx = this.slideEl?.getBoundingClientRect().width ?? 0;
    return larguraPx > 0 ? (px * dim.w) / larguraPx : px / 1.5;
  }

  /** O ponto do ponteiro está dentro da CAIXA da forma (medida em pt)? */
  private dentroDaBox(s: Shape, e: { clientX: number; clientY: number }): boolean {
    const ctx = this.hooks.contexto();
    const r = paraPt(s.box, ctx.dim);
    const p = this.pontoEmPt(e, ctx.dim);
    return p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h;
  }

  /**
   * O ponteiro está sobre o TEXTO desenhado (uma letra de verdade)? O `contenteditable`
   * cobre a caixa inteira, então é pelas caixas das LINHAS que se sabe se o clique caiu
   * em cima do texto ou no vazio da box.
   */
  private sobreOTexto(id: string, e: { clientX: number; clientY: number }): boolean {
    const div = this.slideEl?.querySelector<HTMLElement>(`[data-shape="${id}"] .pp-shape-text`);
    if (!div) return false;
    const walker = document.createTreeWalker(div, NodeFilter.SHOW_TEXT);
    let no: Node | null = walker.nextNode();
    while (no) {
      if ((no.textContent ?? "").trim()) {
        const faixa = document.createRange();
        faixa.selectNodeContents(no);
        for (const r of Array.from(faixa.getClientRects())) {
          if (e.clientX >= r.left - 2 && e.clientX <= r.right + 2 && e.clientY >= r.top - 2 && e.clientY <= r.bottom + 2) return true;
        }
      }
      no = walker.nextNode();
    }
    return false;
  }

  /** Afastamento das alças de canto, em pt: ~9 px na tela, igual em qualquer zoom. */
  private afastamentoPt(dim: Dim): number {
    return this.pxEmPt(dim, 9);
  }

  /** Pontos em % da lâmina -> pt (para o reconhecimento e a forma). */
  private pontosEmPt(pontos: { x: number; y: number }[], dim: Dim): { x: number; y: number }[] {
    return pontos.map((p) => ({ x: (p.x / 100) * dim.w, y: (p.y / 100) * dim.h }));
  }

  private aoMover(e: PointerEvent): void {
    if (!this.modo) {
      const ctx = this.hooks.contexto();
      this.marcarBeiradaDeEdicao(ctx, e);
      if (ctx.ferramenta?.tipo === "curva" || this.pontosCurva.length > 0) {
        // só para o halo do ponto inicial (`pertoDoInicio`), que avisa que o clique fecha a forma
        this.pontoComSnap(e, ctx);
        this.desenharSelecao();
        return;
      }
      // modo conectar: as bolinhas seguem a forma sob o ponteiro. O alvo é GEOMÉTRICO (bolinha
      // manda, depois a caixa de cima, com histerese): pelo DOM, a fresta de ~6 px da bolinha
      // pertence à caixa de baixo e o alvo alterna — as bolinhas piscam e a ligação sai errada
      if (ctx.ferramenta?.tipo === "conectar") {
        const p = this.pontoEmPct(e);
        const r = this.slideEl!.getBoundingClientRect();
        const px = (n: number, total: number, reserva: number) => (total > 0 ? (n / total) * 100 : reserva);
        const rx = px(8, r.width, 0.9); // raio do círculo da bolinha (~8 px)
        const ry = px(8, r.height, 1.5);
        const mx = px(14, r.width, 1.5); // folga da histerese (~14 px)
        const my = px(14, r.height, 2.6);
        const id = alvoDaConexao(ctx.shapes.filter((s) => !s.liga), p, this.ligHover, rx, ry, mx, my);
        if (id !== this.ligHover) {
          this.ligHover = id;
          this.desenharSelecao();
        }
      }
      return;
    }
    this.ultimo = e;
    if (this.quadro) return;
    this.quadro = requestAnimationFrame(() => {
      this.quadro = 0;
      if (this.ultimo) this.aplicar(this.ultimo);
    });
  }

  /**
   * Com o texto em edição, a beirada da forma é a alça de mover: o cursor avisa. Sem isto o
   * ponteiro fica com o cursor de texto até na borda (o `.pp-rt` cobre a caixa inteira) e o
   * gesto existe sem ninguém descobrir.
   */
  private marcarBeiradaDeEdicao(ctx: ContextoPalco, e: { clientX: number; clientY: number }): void {
    let na = false;
    let vazio = false;
    if (ctx.editando && !ctx.ferramenta) {
      const s = ctx.shapes.find((x) => x.id === ctx.editando);
      if (s && !s.bloqueada) {
        na = pertoDaBorda(paraPt(s.box, ctx.dim), this.pontoEmPt(e, ctx.dim), this.pxEmPt(ctx.dim, BANDA_BEIRADA_PX));
        // o vazio da box também pega a forma: o cursor avisa que ali se arrasta
        vazio = !na && this.dentroDaBox(s, e) && !this.sobreOTexto(s.id, e);
      }
    }
    this.slideEl?.classList.toggle("pp-borda-edicao", na);
    this.slideEl?.classList.toggle("pp-vazio-edicao", vazio);
  }

  private aplicar(e: PointerEvent): void {
    const modo = this.modo;
    if (!modo || !this.slideEl) return;

    // panorama: o quanto o ponteiro andou é o quanto a caixa rola (ao contrário)
    if (modo.t === "panorama") {
      const dx = e.clientX - modo.x0;
      const dy = e.clientY - modo.y0;
      if (!modo.moveu && Math.abs(dx) + Math.abs(dy) > 3) modo.moveu = true;
      if (!modo.moveu) return;
      modo.caixa.scrollLeft = modo.esquerda - dx;
      modo.caixa.scrollTop = modo.topo - dy;
      return;
    }

    const ctx = this.hooks.contexto();
    const p = this.pontoEmPct(e);

    if (modo.t === "canto") {
      // zona morta: um clique parado não pode mexer no valor (só o arrasto de verdade)
      if (Math.abs(p.x - modo.partida.x) + Math.abs(p.y - modo.partida.y) > 0.25) modo.mexeu = true;
      if (!modo.mexeu) return;
      const b = paraPt(modo.ref.box, ctx.dim);
      const pt = this.pontoEmPt(e, ctx.dim);
      // ponto no espaço local (desfaz a rotação em volta do centro — a referência do grupo não gira)
      const c0 = centro(b);
      const rad = (-modo.ref.rot * Math.PI) / 180;
      const dx = pt.x - c0.x;
      const dy = pt.y - c0.y;
      const lx = c0.x + dx * Math.cos(rad) - dy * Math.sin(rad);
      const ly = c0.y + dx * Math.sin(rad) + dy * Math.cos(rad);
      const ofs = this.afastamentoPt(ctx.dim);
      const ox = (modo.alvo === "tl" || modo.alvo === "bl" ? lx - b.x : b.x + b.w - lx) - ofs;
      const oy = (modo.alvo === "tl" || modo.alvo === "tr" ? ly - b.y : b.y + b.h - ly) - ofs;
      const ss = Math.min(b.w, b.h);
      let pct = ((Math.max(0, ox) + Math.max(0, oy)) / 0.5858 / (ss || 1)) * 100;
      pct = Math.max(0, Math.min(50, pct));
      pct = e.altKey ? Math.round(pct * 10) / 10 : Math.round(pct * 2) / 2;
      const patches = new Map<string, Partial<Shape>>();
      for (const id of modo.ids) {
        const base = modo.inicial.get(id);
        if (!base) continue;
        patches.set(id, { cantos: valoresComSelecao(base, modo.sel, pct), geom: "roundRect", adj: undefined });
      }
      this.hudCanto = `${r1(pct).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}% · ${modo.sel.length} canto${modo.sel.length > 1 ? "s" : ""}`;
      this.hooks.aoTransformar(patches, "meio");
      this.desenharSelecao();
      return;
    }

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
      modo.delta = delta;
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

    if (modo.t === "borracha") {
      this.apagarEm(e);
      return;
    }

    if (modo.t === "traco") {
      if (Math.hypot(p.x - modo.partida.x, p.y - modo.partida.y) >= 0.5) {
        modo.moveu = true;
      }
      const ult = modo.pontos[modo.pontos.length - 1];
      if (Math.hypot(p.x - ult.x, p.y - ult.y) >= 0.12) modo.pontos.push(p);
      this.desenharSelecao();
      this.hooks.aoTracoAndamento(this.pontosEmPt(modo.pontos, ctx.dim));
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

    // panorama: a marca fica para o menu de contexto decidir se abre (arrasto não abre)
    if (modo.t === "panorama") {
      this.panMoveu = modo.moveu;
      this.frame?.classList.remove("pp-panorama");
      return;
    }

    const ctx = this.hooks.contexto();
    if (modo.t === "borracha") {
      this.desenharSelecao();
      return;
    }
    if (modo.t === "traco") {
      this.traco = null;
      if (modo.moveu) {
        const pontos = this.pontosEmPt(modo.pontos, ctx.dim);
        this.desenharSelecao();
        if (pontos.length > 1) this.hooks.aoTraco({ pontos });
      }
      // clique sem arrastar no modo Livre não faz NADA: era ele que ligava o modo Pontos sem
      // querer (um clique qualquer virava o "primeiro ponto de parada" — relato do usuário)
      return;
    }
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
    if (modo.t === "canto" && !modo.mexeu) this.cliqueCanto = { id: modo.alvo, t: performance.now() };
    if (modo.t === "canto" && modo.colapsar && !modo.mexeu) this.hooks.aoSelecionarCantos([modo.alvo]);
    this.slideEl.classList.remove("pp-arrastando-canto");
    this.guias = [];
    this.hudCanto = null;
    this.hooks.aoTransformar(new Map(), "fim");
    this.desenharSelecao();
  }

  temPontosCurva(): boolean {
    return this.pontosCurva.length > 0;
  }

  definirModoDesenho(modo: "livre" | "pontos"): void {
    // trocar de modo abandona a curva em andamento: os pontos pendentes do modo Pontos não podem
    // "pegar" o próximo clique no modo Livre (o clique virava um ponto de parada sem querer).
    if (modo !== this.modoDesenho) this.limparCurva();
    this.modoDesenho = modo;
    this.desenharSelecao();
  }

  obterModoDesenho(): "livre" | "pontos" {
    return this.modoDesenho;
  }

  /**
   * As formas sob um ponto da tela, de CIMA para baixo — a "pilha" que o clique de uma forma só
   * entrega pela de cima. Usa o mesmo critério do clique (o que o ponteiro alcança: o DOM, e não a
   * caixa do modelo), então uma forma coberta por outra só entra se o ponto estiver na parte dela
   * que está à vista; as **decorações do layout** (fixas) entram só com o "Editar elementos do
   * layout" ligado, como no clique. É o que serve o "Selecionar tudo neste ponto" do menu.
   */
  formasNoPonto(clientX: number, clientY: number): string[] {
    const ctx = this.hooks.contexto();
    const ids = document
      .elementsFromPoint(clientX, clientY)
      .map((el) => (el as HTMLElement).closest?.(".pp-shape[data-shape]") as HTMLElement | null)
      .map((el) => el?.dataset.shape)
      .filter((id): id is string => !!id);
    const vistos = [...new Set(ids)];
    return vistos.filter((id) => {
      const s = ctx.shapes.find((f) => f.id === id);
      return !!s && (!s.fixa || ctx.fixasSelecionaveis);
    });
  }

  finalizarCurva(): void {
    if (this.pontosCurva.length >= 2) {
      this.hooks.aoCurva?.({ pontos: [...this.pontosCurva], fechado: false });
    }
    this.limparCurva();
  }

  cancelarCurva(): void {
    this.limparCurva();
  }

  removerUltimoPontoCurva(): void {
    if (this.pontosCurva.length > 0) {
      this.pontosCurva.pop();
      this.desenharSelecao();
    }
  }

  limparCurva(): void {
    this.pontosCurva = [];
    this.pertoDoInicio = false;
    this.ultimoToqueCurva = { t: 0, x: 0, y: 0 };
    this.desenharSelecao();
  }

  pontosEmPtComReto(pontos: { x: number; y: number; reto?: boolean }[], dim: Dim): (PontoTraco & { reto?: boolean })[] {
    return pontos.map((p) => ({ x: (p.x / 100) * dim.w, y: (p.y / 100) * dim.h, reto: p.reto }));
  }

  /** Ponto em % com snap (ao início, ao ângulo de 45° com Shift, e a bordas de formas existentes). */
  /**
   * Borracha: apaga o traço de tinta sob o ponteiro. O alvo é o DOM (`elementFromPoint`): o
   * caminho da forma livre é desenhado com `pointer-events: visiblePainted`, então só o traço
   * pintado pega o clique — igual a uma borracha de verdade. Uma folga de ~4 px em volta do
   * ponteiro ajuda quem mira no traço fino (a caneta de 1 pt quase não tem área).
   */
  private apagarEm(e: PointerEvent): void {
    const perto = [
      [0, 0],
      [-4, 0],
      [4, 0],
      [0, -4],
      [0, 4],
      [-3, -3],
      [3, 3],
      [-3, 3],
      [3, -3],
    ];
    for (const [dx, dy] of perto) {
      const el = document.elementFromPoint(e.clientX + dx, e.clientY + dy) as HTMLElement | null;
      const forma = el?.closest<HTMLElement>(".pp-shape[data-shape]");
      const id = forma?.dataset.shape;
      if (id) {
        this.hooks.aoApagarTinta(id);
        return;
      }
    }
  }

  private pontoComSnap(e: PointerEvent, ctx: ContextoPalco): { x: number; y: number; reto?: boolean } {
    const raw = this.pontoEmPct(e);
    const r = this.slideEl?.getBoundingClientRect();
    const wPx = r?.width ?? 960;
    const hPx = r?.height ?? 540;

    // 1) Perto do ponto inicial? Fecha a forma
    if (this.pontosCurva.length >= 3) {
      const p0 = this.pontosCurva[0];
      const d0 = Math.hypot(((raw.x - p0.x) / 100) * wPx, ((raw.y - p0.y) / 100) * hPx);
      if (d0 < 14) {
        this.pertoDoInicio = true;
        return { x: p0.x, y: p0.y, reto: e.altKey };
      }
    }
    this.pertoDoInicio = false;

    // 2) Shift trava em múltiplos de 45°
    if (e.shiftKey && this.pontosCurva.length > 0) {
      const prev = this.pontosCurva[this.pontosCurva.length - 1];
      const dxPt = ((raw.x - prev.x) / 100) * ctx.dim.w;
      const dyPt = ((raw.y - prev.y) / 100) * ctx.dim.h;
      const len = Math.hypot(dxPt, dyPt);
      if (len > 1) {
        const ang = Math.atan2(dyPt, dxPt);
        const step = Math.PI / 4;
        const snapped = Math.round(ang / step) * step;
        raw.x = prev.x + ((Math.cos(snapped) * len) / ctx.dim.w) * 100;
        raw.y = prev.y + ((Math.sin(snapped) * len) / ctx.dim.h) * 100;
      }
      return { x: raw.x, y: raw.y, reto: e.altKey };
    }

    // 3) Encaixe magnético em bordas e centros de formas existentes
    const tolX = (10 / wPx) * 100;
    const tolY = (10 / hPx) * 100;
    for (const s of ctx.shapes) {
      if (s.rot && Math.abs(s.rot % 360) > 0.5) continue;
      const b = s.box;
      const alvosX = [b.x, b.x + b.w, b.x + b.w / 2];
      const alvosY = [b.y, b.y + b.h, b.y + b.h / 2];
      for (const tx of alvosX) {
        if (Math.abs(raw.x - tx) <= tolX) {
          raw.x = tx;
          break;
        }
      }
      for (const ty of alvosY) {
        if (Math.abs(raw.y - ty) <= tolY) {
          raw.y = ty;
          break;
        }
      }
    }

    return { x: raw.x, y: raw.y, reto: e.altKey };
  }

  private aoDuploClique(e: MouseEvent): void {
    if (this.pontosCurva.length >= 2) {
      const n = this.pontosCurva.length;
      if (n >= 3 && Math.hypot(this.pontosCurva[n - 1].x - this.pontosCurva[n - 2].x, this.pontosCurva[n - 1].y - this.pontosCurva[n - 2].y) < 1.0) {
        this.pontosCurva.pop();
      }
      this.finalizarCurva();
      e.preventDefault();
      return;
    }
    const alvo = e.target as HTMLElement;
    // (o duplo clique nas alças de canto é detectado no aoPressionar: o overlay é reconstruído
    // entre os cliques e o evento nativo se perde)
    const formaEl = alvo.closest<HTMLElement>(".pp-shape[data-shape]");
    if (!formaEl) return;
    const id = formaEl.dataset.shape!;
    const ctx = this.hooks.contexto();
    // pincel de formatação armado: o duplo clique continua sendo um clique de pintura, não abre o texto
    if (ctx.ferramenta?.tipo === "pincel") return;
    const s = ctx.shapes.find((x) => x.id === id);
    if (!s || (s.fixa && !ctx.fixasSelecionaveis)) return;
    // Já está no texto dessa forma: o duplo clique aqui é para escolher a palavra — redesenhar
    // agora (com outra entrada na edição) apagaria a seleção que o navegador acabou de fazer.
    if (ctx.editando === id) return;
    this.hooks.aoEditarTexto(id, { x: e.clientX, y: e.clientY });
  }
}
