// Ligações entre formas (PowerPoint): a ferramenta "Conectar" prende uma forma na outra por
// pontos das bordas e o conector é DERIVADO — ao mover ou redimensionar qualquer lado ele se
// redesenha. A cor acompanha as caixas em TRANSIÇÃO: o traço é UMA forma só, com o gradiente que
// sai da cor da ORIGEM e chega na cor do DESTINO (o ângulo é a reta entre as duas bordas) — o
// corte seco de antes (uma metade de cada cor) virou a passagem suave. A geometria reaproveita a
// ideia do Fluxo do Mermaid: cantos de 90° com curva.
import { uid } from "../../util";
import type { GradStop, Lado, Liga, LineGrad, Shape, ShapeBox, Slide } from "../schema";
import type { EstiloDeck } from "./criar";
import { ajustarCor } from "./formato";
import { paraPt, type Dim, type Ret } from "./geometria";

/** Raio das curvas dos cantos (o mesmo do fluxo do Mermaid). */
const RAIO = 9;
/** Espessura do traço da ligação. */
const TRACO = 1.75;
/** Folga da caixa do conector em volta do caminho (o traço não encosta na borda). */
const PAD = 4;

export interface Pto {
  x: number;
  y: number;
}

const r2 = (v: number) => Math.round(v * 100) / 100;
const dist = (a: Pto, b: Pto) => Math.hypot(b.x - a.x, b.y - a.y);
const uni = (a: Pto, b: Pto): Pto => {
  const d = dist(a, b) || 1;
  return { x: (b.x - a.x) / d, y: (b.y - a.y) / d };
};

/** Ponto da borda (no meio do lado), em pt. */
export function pontoDaBorda(r: Ret, lado: Lado): Pto {
  const cx = r.x + r.w / 2;
  const cy = r.y + r.h / 2;
  if (lado === "topo") return { x: cx, y: r.y };
  if (lado === "base") return { x: cx, y: r.y + r.h };
  if (lado === "esq") return { x: r.x, y: cy };
  return { x: r.x + r.w, y: cy };
}

/**
 * A **bolinha** sob o ponteiro (o lado da borda), se houver: a da caixa de cima vence. As
 * bolinhas ficam no meio de cada lado; `rx`/`ry` são o raio do círculo em % de cada eixo (o %
 * da lâmina não é quadrado).
 */
export function bolinhaDaConexao(
  formas: { id: string; box: ShapeBox }[],
  ponteiro: Pto,
  rx: number,
  ry: number
): { id: string; lado: Lado } | null {
  const noCirculo = (x: number, y: number): boolean => {
    const dx = (ponteiro.x - x) / rx;
    const dy = (ponteiro.y - y) / ry;
    return dx * dx + dy * dy <= 1;
  };
  for (let i = formas.length - 1; i >= 0; i--) {
    const b = formas[i].box;
    const cx = b.x + b.w / 2;
    const cy = b.y + b.h / 2;
    const lados: [Lado, number, number][] = [
      ["topo", cx, b.y],
      ["base", cx, b.y + b.h],
      ["esq", b.x, cy],
      ["dir", b.x + b.w, cy],
    ];
    for (const [lado, x, y] of lados) if (noCirculo(x, y)) return { id: formas[i].id, lado };
  }
  return null;
}

/**
 * A forma sob o ponteiro no modo Conectar. A ordem dos passos existe por um defeito real:
 *
 *  1. a **bolinha** manda (ver `bolinhaDaConexao`) — o ponteiro sobre ela é da forma dela,
 *     mesmo que a caixa de baixo esteja ali embaixo;
 *  2. depois a **caixa**: a de CIMA vence (a lista vem na ordem de pintura — a última é a
 *     que está por cima), como no PowerPoint;
 *  3. por fim a **histerese**: sem nada embaixo do ponteiro, mantém a forma atual enquanto o
 *     ponteiro estiver perto dela. A bolinha fica ~6 px PARA FORA da caixa: sem essa folga, a
 *     fresta em volta da caixa pertence à forma de baixo e o alvo fica alternando entre as
 *     duas — as bolinhas piscam e a ligação sai na caixa errada (relato do usuário).
 *
 * `margemX`/`margemY` são a folga da histerese. Quem chama deixa os CONECTORES de fora: a linha
 * da ligação é uma faixa fina que atravessa a lâmina e roubaria o ponteiro no meio do caminho.
 */
export function alvoDaConexao(
  formas: { id: string; box: ShapeBox }[],
  ponteiro: Pto,
  atual: string | null,
  rx: number,
  ry: number,
  margemX: number,
  margemY: number
): string | null {
  const bolinha = bolinhaDaConexao(formas, ponteiro, rx, ry);
  if (bolinha) return bolinha.id;
  for (let i = formas.length - 1; i >= 0; i--) {
    const b = formas[i].box;
    if (ponteiro.x >= b.x && ponteiro.x <= b.x + b.w && ponteiro.y >= b.y && ponteiro.y <= b.y + b.h) return formas[i].id;
  }
  if (atual) {
    const s = formas.find((f) => f.id === atual);
    if (s) {
      const b = s.box;
      if (ponteiro.x >= b.x - margemX && ponteiro.x <= b.x + b.w + margemX && ponteiro.y >= b.y - margemY && ponteiro.y <= b.y + b.h + margemY) return atual;
    }
  }
  return null;
}

/** Rota ortogonal entre as duas bordas (2 a 4 pontos): reta quando dá, "Z" ou "L" quando não. */
export function rotaDaLigacao(a: Pto, ladoDe: Lado, b: Pto, ladoPara: Lado): Pto[] {
  const vertA = ladoDe === "topo" || ladoDe === "base";
  const vertB = ladoPara === "topo" || ladoPara === "base";
  if (vertA && vertB) {
    if (Math.abs(b.x - a.x) < 0.5) return [a, b];
    const meio = (a.y + b.y) / 2;
    return [a, { x: a.x, y: meio }, { x: b.x, y: meio }, b];
  }
  if (!vertA && !vertB) {
    if (Math.abs(b.y - a.y) < 0.5) return [a, b];
    const meio = (a.x + b.x) / 2;
    return [a, { x: meio, y: a.y }, { x: meio, y: b.y }, b];
  }
  return vertA ? [a, { x: a.x, y: b.y }, b] : [a, { x: b.x, y: a.y }, b];
}

/**
 * O caminho em comandos (M/L/Q) com os cantos de 90° arredondados. A ligação é UMA forma, então
 * o caminho sai inteiro: o corte que existia aqui servia só para dar uma cor a cada metade.
 */
export function caminhoDaLigacao(pts: Pto[]): (string | number)[] {
  const cmds: (string | number)[] = ["M", r2(pts[0].x), r2(pts[0].y)];
  for (let i = 1; i < pts.length - 1; i++) {
    const p0 = pts[i - 1];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const r = Math.max(1, Math.min(RAIO, dist(p0, p1) / 2, dist(p1, p2) / 2));
    const d1 = uni(p0, p1);
    const d2 = uni(p1, p2);
    cmds.push("L", r2(p1.x - d1.x * r), r2(p1.y - d1.y * r));
    cmds.push("Q", r2(p1.x), r2(p1.y), r2(p1.x + d2.x * r), r2(p1.y + d2.y * r));
  }
  cmds.push("L", r2(pts[pts.length - 1].x), r2(pts[pts.length - 1].y));
  return cmds;
}

const quaseBranco = (hex: string): boolean => {
  const c = hex.padEnd(6, "0");
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(c.slice(i, i + 2), 16));
  return 0.299 * r + 0.587 * g + 0.114 * b > 228;
};

/** A parada que representa a cor do gradiente: a mais próxima do MEIO (numa rampa de 3 tons é a
 *  cor-base; num gradiente de duas paradas, o empate fica com a primeira — o comportamento de
 *  sempre). É o que faz o conector de uma caixa com Estilo de Cor sair na cor da caixa, e não no
 *  tom claro da ponta. */
const corDoGradiente = (stops: readonly GradStop[]): string | undefined =>
  [...stops].sort((a, b) => Math.abs(a.pos - 50) - Math.abs(b.pos - 50) || a.pos - b.pos)[0]?.color;

/** Cor "do ramo" da forma (o preenchimento com cor; senão o contorno); vazio quando é branca/clara. */
export function corDaForma(s: Shape): string {
  const fundo = s.fillX?.kind === "solid" ? s.fillX.color : s.fillX?.kind === "gradient" ? corDoGradiente(s.fillX.stops ?? []) : s.fill;
  for (const c of [fundo, s.ln?.color]) if (c && !quaseBranco(c)) return c;
  return "";
}

/**
 * Ângulo do gradiente da ligação: a direção do TRECHO MAIS LONGO da rota, no sentido do fluxo
 * (origem → destino), na convenção do preenchimento (0 = esquerda→direita; 90 = cima→baixo).
 * Normalizado em 0..360 porque o `a:lin` do `.pptx` não aceita ângulo negativo.
 *
 * Numa ligação reta dá no mesmo que a reta origem→destino. Num COTOVELO, a reta origem→destino é
 * uma diagonal que não corresponde ao caminho: o trecho comprido já começa no meio da mistura e a
 * transição se concentra no fim (relato: "o degradê só acontece do B → A, não do A → B, e se
 * encontra no meio"). Com o eixo no trecho mais longo, a cor anda ao longo do caminho: sai da
 * origem com a cor da origem, atravessa o trecho principal e chega no destino com a do destino.
 */
export function anguloDaLigacao(rota: readonly Pto[]): number {
  const a = rota[0];
  const b = rota[rota.length - 1];
  let maior = -1;
  let dx = b.x - a.x;
  let dy = b.y - a.y;
  for (let i = 1; i < rota.length; i++) {
    const ex = rota[i].x - rota[i - 1].x;
    const ey = rota[i].y - rota[i - 1].y;
    const comp = Math.hypot(ex, ey);
    if (comp > maior) {
      maior = comp;
      dx = ex;
      dy = ey;
    }
  }
  // o sentido é o do fluxo: o eixo precisa apontar da origem para o destino
  if (dx * (b.x - a.x) + dy * (b.y - a.y) < 0) {
    dx = -dx;
    dy = -dy;
  }
  const g = (Math.atan2(dy, dx) * 180) / Math.PI;
  return (g + 360) % 360;
}

/** O gradiente da ligação: cor da origem (0%) → cor do destino (100%). Cores iguais (ou uma sem
 *  cor) devolvem `undefined`: o traço sai sólido e o arquivo não carrega um gradiente à toa. */
export function gradienteDaLigacao(corDe: string, corPara: string, rota: readonly Pto[]): LineGrad | undefined {
  if (!corDe || !corPara || corDe.toUpperCase() === corPara.toUpperCase()) return undefined;
  return {
    stops: [
      { pos: 0, color: corDe, alpha: 1 },
      { pos: 100, color: corPara, alpha: 1 },
    ],
    angle: anguloDaLigacao(rota),
  };
}

/** Comandos -> forma do conector (geometria livre; caixa = caminho + folga). O traço é o gradiente
 *  da ligação; `cor` é a do DESTINO — é ela que pinta a seta (um marcador não usa o gradiente). */
function formaDa(cmds: (string | number)[], cor: string, grad: LineGrad | undefined, liga: Liga, d: Dim, est: EstiloDeck): Shape {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (let i = 1; i < cmds.length; ) {
    const c = cmds[i] as string;
    const q = c === "M" || c === "L" ? 2 : c === "Q" ? 4 : 0;
    for (let k = 0; k < q; k += 2) {
      const x = cmds[i + 1 + k] as number;
      const y = cmds[i + 2 + k] as number;
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
    }
    i += 1 + q;
  }
  const x0 = minX - PAD;
  const y0 = minY - PAD;
  const w = Math.max(maxX - minX + PAD * 2, 0.01);
  const h = Math.max(maxY - minY + PAD * 2, 0.01);
  const locais: (string | number)[] = [];
  for (let i = 0; i < cmds.length; ) {
    const c = cmds[i++] as string;
    locais.push(c);
    const q = c === "M" || c === "L" ? 2 : c === "Q" ? 4 : 0;
    for (let k = 0; k < q; k += 2) locais.push(r2((cmds[i + k] as number) - x0), r2((cmds[i + k + 1] as number) - y0));
    i += q;
  }
  const box: ShapeBox = { x: (x0 / d.w) * 100, y: (y0 / d.h) * 100, w: (w / d.w) * 100, h: (h / d.h) * 100 };
  return {
    id: uid(),
    kind: "forma",
    box,
    text: "",
    fontFamily: est.fonte,
    fontSize: est.tamanho,
    color: est.corTexto,
    bold: false,
    italic: false,
    align: "centro",
    fill: "",
    src: "",
    rot: 0,
    name: "Ligação",
    geom: "custom",
    paths: [{ w: r2(w), h: r2(h), cmds: locais }],
    ln: {
      color: cor,
      alpha: 1,
      w: TRACO,
      dash: "solid",
      join: "round",
      cap: "round",
      tail: "triangle" as const,
      ...(grad ? { grad } : {}),
    },
    fillX: { kind: "none" },
    grupo: liga.grupo,
    liga,
  };
}

const ligaDe = (de: string, ladoDe: Lado, para: string, ladoPara: Lado, grupo: string): Liga => ({
  de,
  ladoDe,
  para,
  ladoPara,
  grupo,
});

/** Cria a forma da ligação entre duas formas: um traço só, com o gradiente da origem ao destino. */
export function ligacaoParaFormas(de: Shape, ladoDe: Lado, para: Shape, ladoPara: Lado, d: Dim, est: EstiloDeck): Shape[] {
  const a = pontoDaBorda(paraPt(de.box, d), ladoDe);
  const b = pontoDaBorda(paraPt(para.box, d), ladoPara);
  const rota = rotaDaLigacao(a, ladoDe, b, ladoPara);
  const cmds = caminhoDaLigacao(rota);
  const corPadrao = ajustarCor(est.acento, 0.9);
  const corDe = corDaForma(de) || corPadrao;
  const corPara = corDaForma(para) || corDe;
  return [formaDa(cmds, corPara, gradienteDaLigacao(corDe, corPara, rota), ligaDe(de.id, ladoDe, para.id, ladoPara, uid()), d, est)];
}

/** Recalcula a ligação a partir das caixas atuais (mantendo id e nome da forma). */
function recomputar(s: Shape, de: Shape, para: Shape, d: Dim, destaque: string): Shape {
  const l = s.liga!;
  const a = pontoDaBorda(paraPt(de.box, d), l.ladoDe);
  const b = pontoDaBorda(paraPt(para.box, d), l.ladoPara);
  const rota = rotaDaLigacao(a, l.ladoDe, b, l.ladoPara);
  const cmds = caminhoDaLigacao(rota);
  const corPadrao = ajustarCor(destaque, 0.9);
  const corDe = corDaForma(de) || corPadrao;
  const corPara = corDaForma(para) || corDe;
  const est: EstiloDeck = { fonte: s.fontFamily, tamanho: s.fontSize, corTexto: s.color, acento: destaque, paleta: [] };
  const nova = formaDa(cmds, corPara, gradienteDaLigacao(corDe, corPara, rota), l, d, est);
  nova.id = s.id;
  nova.name = s.name;
  return nova;
}

/**
 * Recalcula todas as ligações da lâmina: mover/redimensionar qualquer lado redesenha o traço, e
 * a caixa apagada leva a ligação junto. É chamada a cada mudança da lâmina (no `substituirSlide`).
 *
 * Uma ligação = UMA forma: as metades antigas (documento salvo antes do gradiente) se juntam aqui
 * — fica a **primeira** do `grupo` (a espinha, que já estava por baixo) e a outra sai. É também o
 * que mantém o desenho coerente quando a rota fica reta (antes a espinha desaparecia e sobrava só
 * a descida).
 */
export function atualizarLigacoes(slide: Slide, d: Dim, destaque: string): Slide {
  if (!slide.shapes.some((s) => s.liga)) return slide;
  const porId = new Map(slide.shapes.map((s) => [s.id, s]));
  const saida: Shape[] = [];
  const vistas = new Set<string>();
  for (const s of slide.shapes) {
    if (!s.liga) {
      saida.push(s);
      continue;
    }
    if (vistas.has(s.liga.grupo)) continue;
    vistas.add(s.liga.grupo);
    const de = porId.get(s.liga.de);
    const para = porId.get(s.liga.para);
    if (!de || !para) continue;
    saida.push(recomputar(s, de, para, d, destaque));
  }
  return { ...slide, shapes: saida };
}
