// Arte do Designer: o app DESENHA a decoração da lâmina — ondas de seda, facetas, mosaico de
// losangos e brilhos — em vetor, no computador, com a paleta do modelo. É o que o Designer do
// Office faz com a biblioteca de imagens dele; aqui a arte nasce de curvas e gradientes com
// transparência (formas livres do próprio app), então sai no .pptx como forma editável.
//
// Tudo é determinístico: a mesma `semente` devolve a mesma arte (é o que deixa a prévia do cartão
// ser exatamente o que o clique aplica). Cada estilo vale para os dois TONS — a paleta escura
// ganha uma arte luminosa sobre fundo profundo; a clara, uma arte suave sobre fundo claro — e tem
// duas versões: a da CAPA (arte grande, com o texto recomposto) e a do MIOLO (só nas bordas, sem
// tocar nas caixas de texto do layout).
//
// Funções puras; o que muda na lâmina (fundo, texto) fica em `designer.ts`.
import { uid } from "../../util";
import type { Fill, GradStop, Shape, ShapeBox, SlideLayout } from "../schema";

export type ArteId = "ondas" | "facetas" | "mosaico" | "orbes";

export const ARTES: { id: ArteId; nome: string }[] = [
  { id: "ondas", nome: "Ondas" },
  { id: "facetas", nome: "Facetas" },
  { id: "mosaico", nome: "Mosaico" },
  { id: "orbes", nome: "Brilhos" },
];

/** As cores com que a arte é pintada (hex sem #) — as quatro do modelo. */
export interface PaletaArte {
  bg: string;
  fg: string;
  accent: string;
  muted: string;
}

/** O id do desenho de uma arte ("arte-ondas-12"): é o que vai no `name` das formas e no modelo. */
export type DesenhoArte = `arte-${ArteId}-${number}`;

export const desenhoDeArte = (id: ArteId, semente: number): DesenhoArte => `arte-${id}-${Math.abs(Math.floor(semente))}` as DesenhoArte;

/** Lê "arte-ondas-12" (ou nada, se não for uma arte). */
export function lerDesenhoArte(desenho: string): { id: ArteId; semente: number } | null {
  const m = /^arte-(ondas|facetas|mosaico|orbes)-(\d+)$/.exec(desenho);
  return m ? { id: m[1] as ArteId, semente: Number(m[2]) } : null;
}

// ---------------------------------------------------------------- cor

const canal = (h: string, i: number): number => parseInt(h.slice(i * 2, i * 2 + 2), 16);
const hex2 = (n: number): string => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, "0").toUpperCase();
const rgb = (r: number, g: number, b: number): string => `${hex2(r)}${hex2(g)}${hex2(b)}`;

/** Mistura duas cores: `p` é quanto da segunda entra. */
export function misturar(a: string, b: string, p: number): string {
  return rgb(canal(a, 0) * (1 - p) + canal(b, 0) * p, canal(a, 1) * (1 - p) + canal(b, 1) * p, canal(a, 2) * (1 - p) + canal(b, 2) * p);
}

const clara = (c: string, p: number): string => misturar(c, "FFFFFF", p);
const escura = (c: string, p: number): string => misturar(c, "000000", p);

/** Gira a matiz de uma cor (graus): é o que dá a segunda cor viva da arte sem sair da família. */
export function girarMatiz(c: string, graus: number): string {
  const r = canal(c, 0) / 255;
  const g = canal(c, 1) / 255;
  const b = canal(c, 2) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  if (d === 0) return c; // cinza: não há matiz para girar
  const s = d / (1 - Math.abs(2 * l - 1));
  let h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  h = (((h * 60 + graus) % 360) + 360) % 360;
  const k = (1 - Math.abs(2 * l - 1)) * s;
  const x = k * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - k / 2;
  const [r1, g1, b1] = h < 60 ? [k, x, 0] : h < 120 ? [x, k, 0] : h < 180 ? [0, k, x] : h < 240 ? [0, x, k] : h < 300 ? [x, 0, k] : [k, 0, x];
  return rgb((r1 + m) * 255, (g1 + m) * 255, (b1 + m) * 255);
}

/** Luminância relativa (WCAG) de uma cor hex sem #. */
function luminancia(c: string): number {
  const v = [0, 1, 2].map((i) => {
    const x = canal(c, i) / 255;
    return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2];
}

/** Contraste entre duas cores (WCAG: de 1 a 21). */
export function contraste(a: string, b: string): number {
  const la = luminancia(a);
  const lb = luminancia(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/** A paleta é escura? (o fundo dela está abaixo de ~0,15 de luminância relativa) */
export const ehEscura = (p: PaletaArte): boolean => luminancia(p.bg) < 0.15;

// ---------------------------------------------------------------- acaso (determinístico)

/** Gerador pseudoaleatório com semente (mulberry32): a mesma semente, a mesma arte. */
function acaso(semente: number): () => number {
  let a = (Math.abs(Math.floor(semente)) * 2654435761 + 1013904223) >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------------------------------------------------------------- formas

const solido = (color: string, alpha = 1): Fill => ({ kind: "solid", color, alpha });
const gradiente = (angle: number, stops: GradStop[]): Fill => ({ kind: "gradient", angle, stops });
const parada = (pos: number, color: string, alpha = 1): GradStop => ({ pos, color, alpha });

interface Ctx {
  desenho: DesenhoArte;
  paleta: PaletaArte;
  ratio: number;
}

/** Uma forma de arte: fixa, sem texto, marcada `tpl:` (é por isso que trocar de modelo as troca). */
function forma(c: Ctx, box: ShapeBox, extra: Partial<Shape>): Shape {
  const { paleta: p } = c;
  return {
    id: uid(),
    kind: "forma",
    box,
    text: "",
    fontFamily: "",
    fontSize: 12,
    color: p.fg,
    bold: false,
    italic: false,
    align: "esquerda",
    fill: "",
    src: "",
    rot: 0,
    name: `tpl:${c.desenho}:${p.bg}:${p.fg}:${p.accent}:${p.muted}`,
    fixa: true,
    ...extra,
  };
}

/** Uma forma livre: `cmds` no espaço 1000 × 1000 da caixa. */
function livre(c: Ctx, box: ShapeBox, cmds: (string | number)[], pintura: { fill?: Fill; ln?: { cor: string; w: number; alpha: number } }): Shape {
  const s = forma(c, box, { geom: "rect", paths: [{ w: 1000, h: 1000, cmds, fill: pintura.fill ? "norm" : "none", stroke: !!pintura.ln }] });
  if (pintura.fill) {
    s.fillX = pintura.fill;
    if (pintura.fill.kind === "solid") s.fill = pintura.fill.color ?? "";
  }
  if (pintura.ln) s.ln = { color: pintura.ln.cor, alpha: pintura.ln.alpha, w: pintura.ln.w, dash: "solid", cap: "round", join: "round" };
  return s;
}

const r1 = (n: number): number => Math.round(n * 10) / 10;

/** Uma curva suave que passa pelos pontos (Catmull-Rom → Bézier cúbica): é o que dá a "seda". */
function curva(pontos: [number, number][]): (string | number)[] {
  const cmds: (string | number)[] = ["M", r1(pontos[0][0]), r1(pontos[0][1])];
  for (let i = 0; i < pontos.length - 1; i++) {
    const p0 = pontos[Math.max(0, i - 1)];
    const p1 = pontos[i];
    const p2 = pontos[i + 1];
    const p3 = pontos[Math.min(pontos.length - 1, i + 2)];
    cmds.push("C", r1(p1[0] + (p2[0] - p0[0]) / 6), r1(p1[1] + (p2[1] - p0[1]) / 6), r1(p2[0] - (p3[0] - p1[0]) / 6), r1(p2[1] - (p3[1] - p1[1]) / 6), r1(p2[0]), r1(p2[1]));
  }
  return cmds;
}

// ---------------------------------------------------------------- o que cada arte devolve

/** A arte de uma lâmina: o fundo, as formas e (na capa) onde o texto vai sentar. */
export interface ComposicaoArte {
  fundo: Fill;
  formas: Shape[];
  /** a capa: as zonas do título e do subtítulo, e o alinhamento — o miolo não move texto */
  texto?: { titulo: ShapeBox; subtitulo: ShapeBox; align: "esquerda" | "centro" };
  /** a cor de fundo na zona do texto (é com ela que o texto escolhe a cor legível) */
  fundoDoTexto: string;
}

const eCapa = (layout: SlideLayout): boolean => layout === "titulo" || layout === "secao";

/** O fundo da lâmina: o do modelo, com um gradiente suave na direção da arte. */
function fundoBase(p: PaletaArte, angulo: number): { fill: Fill; meio: string } {
  const escuro = ehEscura(p);
  const fim = escuro ? misturar(p.bg, p.accent, 0.3) : misturar(p.bg, p.accent, 0.14);
  return { fill: gradiente(angulo, [parada(0, p.bg), parada(100, fim)]), meio: misturar(p.bg, fim, 0.35) };
}

// ---------------------------------------------------------------- ondas

function ondas(c: Ctx, capa: boolean, semente: number): ComposicaoArte {
  const p = c.paleta;
  const escuro = ehEscura(p);
  const rnd = acaso(semente);
  const { fill, meio } = fundoBase(p, 120);
  const viva = girarMatiz(p.accent, 38);
  const cores = escuro ? [clara(p.accent, 0.25), viva, p.muted, girarMatiz(p.accent, -34)] : [clara(p.accent, 0.55), p.accent, clara(p.muted, 0.35), clara(viva, 0.45)];
  const formas: Shape[] = [];
  const bandas = capa ? 5 : 3;
  const topo0 = capa ? 52 : 93; // onde a primeira onda nasce (em % da lâmina)
  const passo = capa ? 8 : 2.4;
  const fase = rnd() * Math.PI * 2;
  for (let i = 0; i < bandas; i++) {
    const topo = topo0 + i * passo;
    const alto = 100 - topo + 2;
    const amp = (capa ? 120 : 160) * (0.7 + rnd() * 0.7);
    const n = 7;
    const base = capa ? 230 - i * 30 : 380;
    const pts: [number, number][] = [];
    for (let k = 0; k <= n; k++) pts.push([(1000 / n) * k, base + amp * Math.sin(fase + k * 0.95 + i * 0.8) + (rnd() - 0.5) * amp * 0.4]);
    const alfa = escuro ? 0.5 + i * 0.1 : 0.4 + i * 0.1;
    const cor = cores[i % cores.length];
    const cor2 = cores[(i + 1) % cores.length];
    const pintura = gradiente(0, [parada(0, cor, alfa * 0.4), parada(45, cor2, Math.min(0.92, alfa)), parada(100, cor, alfa * 0.5)]);
    formas.push(livre(c, { x: -2, y: topo, w: 104, h: alto }, [...curva(pts), "L", 1000, 1000, "L", 0, 1000, "Z"], { fill: pintura }));
    // um fio de luz na crista de duas ondas: é ele que faz parecer seda
    if (i === 1 || i === bandas - 2) {
      formas.push(livre(c, { x: -2, y: topo, w: 104, h: alto }, curva(pts), { ln: { cor: escuro ? clara(cor, 0.5) : escura(cor, 0.1), w: 1.25, alpha: escuro ? 0.55 : 0.4 } }));
    }
  }
  return capa
    ? {
        fundo: fill,
        formas,
        fundoDoTexto: meio,
        texto: { titulo: { x: 7, y: 15, w: 72, h: 27 }, subtitulo: { x: 7, y: 43, w: 62, h: 9 }, align: "esquerda" },
      }
    : { fundo: fill, formas, fundoDoTexto: meio };
}

// ---------------------------------------------------------------- facetas

function facetas(c: Ctx, capa: boolean, semente: number): ComposicaoArte {
  const p = c.paleta;
  const escuro = ehEscura(p);
  const rnd = acaso(semente);
  const espelho = semente % 2 === 1; // a arte à esquerda ou à direita
  const ex = (x: number): number => (espelho ? 1000 - x : x);
  const { fill, meio } = fundoBase(p, espelho ? 60 : 120);
  const tons = escuro ? [p.accent, girarMatiz(p.accent, 32), p.muted, clara(p.accent, 0.3), misturar(p.bg, p.accent, 0.5)] : [p.accent, escura(p.accent, 0.18), clara(p.accent, 0.35), clara(p.muted, 0.2), clara(p.accent, 0.6)];
  const formas: Shape[] = [];
  const regiao: ShapeBox = capa ? { x: espelho ? 0 : 44, y: 0, w: 56, h: 100 } : { x: espelho ? 0 : 94.5, y: 0, w: 5.5, h: 14 };
  const n = capa ? 7 : 3;
  // pontos no perímetro da região: os vértices das facetas
  const perimetro = (t: number): [number, number] => {
    const q = (((t % 4) + 4) % 4) * 1000;
    if (q < 1000) return [q, 0];
    if (q < 2000) return [1000, q - 1000];
    if (q < 3000) return [3000 - q, 1000];
    return [0, 4000 - q];
  };
  for (let i = 0; i < n; i++) {
    const a = perimetro(rnd() * 4);
    const b = perimetro(rnd() * 4);
    const d = perimetro(rnd() * 4);
    const area = Math.abs((b[0] - a[0]) * (d[1] - a[1]) - (d[0] - a[0]) * (b[1] - a[1])) / 2;
    if (area < 90000) continue; // facetas minúsculas só sujam
    const cor = tons[i % tons.length];
    const alfa = 0.3 + rnd() * 0.55;
    formas.push(livre(c, regiao, ["M", ex(a[0]), a[1], "L", ex(b[0]), b[1], "L", ex(d[0]), d[1], "Z"], { fill: solido(cor, alfa) }));
  }
  if (capa) {
    // a lasca do lado oposto: equilibra a composição (como nos temas de facetas do Office)
    const lasca: ShapeBox = { x: espelho ? 90 : 0, y: 0, w: 10, h: 100 };
    formas.push(livre(c, lasca, ["M", ex(0), 0, "L", ex(700), 0, "L", ex(0), 880, "Z"], { fill: solido(p.accent, 0.85) }));
    // dois fios finos cruzando, como as linhas de construção do desenho
    formas.push(livre(c, regiao, ["M", ex(380), 0, "L", ex(700), 1000], { ln: { cor: p.muted, w: 0.75, alpha: 0.6 } }));
  }
  return capa
    ? {
        fundo: fill,
        formas,
        fundoDoTexto: meio,
        texto: { titulo: { x: espelho ? 44 : 7, y: 26, w: 49, h: 26 }, subtitulo: { x: espelho ? 44 : 7, y: 53, w: 45, h: 10 }, align: "esquerda" },
      }
    : { fundo: fill, formas, fundoDoTexto: meio };
}

// ---------------------------------------------------------------- mosaico

function mosaico(c: Ctx, capa: boolean, semente: number): ComposicaoArte {
  const p = c.paleta;
  const escuro = ehEscura(p);
  const rnd = acaso(semente);
  const espelho = semente % 2 === 1;
  const { fill, meio } = fundoBase(p, espelho ? 60 : 120);
  const tons = escuro
    ? [clara(p.accent, 0.35), p.accent, misturar(p.accent, p.bg, 0.4), misturar(p.accent, p.bg, 0.65), misturar(p.bg, p.accent, 0.2)]
    : [escura(p.accent, 0.3), p.accent, misturar(p.accent, p.muted, 0.45), clara(p.accent, 0.5), clara(p.accent, 0.82)];
  const largura = capa ? 42 : 4.2;
  const cols = capa ? 9 : 2;
  // as células são quadradas na lâmina de verdade: `rows` acompanha a proporção da região
  const rows = Math.max(2, Math.round((cols * 100) / (largura * c.ratio)));
  const cw = 1000 / cols;
  const ch = 1000 / rows;
  const baldes: (string | number)[][] = tons.map(() => []);
  for (let j = 0; j <= rows; j++) {
    for (let i = 0; i <= cols; i++) {
      if ((i + j) % 2 !== 0) continue;
      // a distância até a borda de dentro decide o tom (a mancha some em direção ao texto) + ruído
      const dist = espelho ? i / cols : 1 - i / cols;
      const v = Math.max(0, Math.min(0.999, dist * 0.85 + (rnd() - 0.5) * 0.45 + (j / rows) * 0.1));
      const balde = baldes[Math.floor(v * tons.length)];
      const cx = i * cw;
      const cy = j * ch;
      const hw = cw * 0.93;
      const hh = ch * 0.93;
      balde.push("M", r1(cx - hw), r1(cy), "L", r1(cx), r1(cy - hh), "L", r1(cx + hw), r1(cy), "L", r1(cx), r1(cy + hh), "Z");
    }
  }
  const regiao: ShapeBox = { x: espelho ? 100 - largura : 0, y: 0, w: largura, h: 100 };
  const formas = baldes.map((cmds, k) => (cmds.length ? livre(c, regiao, cmds, { fill: solido(tons[k], escuro ? 0.92 : 1) }) : null)).filter((s): s is Shape => !!s);
  return capa
    ? {
        fundo: fill,
        formas,
        fundoDoTexto: meio,
        texto: { titulo: { x: espelho ? 6 : 48, y: 28, w: 46, h: 27 }, subtitulo: { x: espelho ? 6 : 48, y: 56, w: 44, h: 10 }, align: "esquerda" },
      }
    : { fundo: fill, formas, fundoDoTexto: meio };
}

// ---------------------------------------------------------------- brilhos

function orbes(c: Ctx, capa: boolean, semente: number): ComposicaoArte {
  const p = c.paleta;
  const escuro = ehEscura(p);
  const rnd = acaso(semente);
  const { fill, meio } = fundoBase(p, 135);
  const viva = girarMatiz(p.accent, escuro ? 42 : 28);
  const cores = escuro ? [p.accent, viva, p.muted, girarMatiz(p.accent, -40)] : [clara(p.accent, 0.3), clara(viva, 0.4), clara(p.muted, 0.35), clara(p.accent, 0.55)];
  const formas: Shape[] = [];
  const brilho = (cx: number, cy: number, w: number, cor: string, alfa: number): Shape => {
    const h = w * c.ratio;
    return forma(c, { x: cx - w / 2, y: cy - h / 2, w, h }, {
      geom: "ellipse",
      fillX: { kind: "gradient", radial: true, stops: [parada(0, cor, alfa), parada(55, cor, alfa * 0.4), parada(100, cor, 0)] },
    });
  };
  if (capa) {
    formas.push(brilho(72 + rnd() * 14, 12 + rnd() * 10, 66, cores[0], escuro ? 0.95 : 0.7));
    formas.push(brilho(4 + rnd() * 12, 62 + rnd() * 14, 56, cores[1], escuro ? 0.85 : 0.6));
    formas.push(brilho(34 + rnd() * 22, 96 + rnd() * 6, 46, cores[2], escuro ? 0.8 : 0.55));
    formas.push(brilho(92 - rnd() * 8, 78 + rnd() * 8, 30, cores[3], escuro ? 0.7 : 0.5));
    // um pó de pontos de luz (só no escuro: no claro eles sujariam)
    if (escuro) {
      for (let i = 0; i < 9; i++) {
        const w = 0.35 + rnd() * 0.7;
        formas.push(forma(c, { x: rnd() * 98, y: rnd() * 96, w, h: w * c.ratio }, { geom: "ellipse", fillX: solido("FFFFFF", 0.35 + rnd() * 0.5) }));
      }
    }
  } else {
    formas.push(brilho(99, 98, 26, cores[0], escuro ? 0.9 : 0.6));
    formas.push(brilho(2, 2, 14, cores[1], escuro ? 0.75 : 0.5));
  }
  return capa
    ? { fundo: fill, formas, fundoDoTexto: meio, texto: { titulo: { x: 8, y: 29, w: 84, h: 24 }, subtitulo: { x: 12, y: 55, w: 76, h: 10 }, align: "centro" } }
    : { fundo: fill, formas, fundoDoTexto: meio };
}

// ---------------------------------------------------------------- a porta de entrada

const GERADORES: Record<ArteId, (c: Ctx, capa: boolean, semente: number) => ComposicaoArte> = { ondas, facetas, mosaico, orbes };

/**
 * A arte de uma lâmina para o layout dela. A capa e a seção ganham a arte grande (e a zona onde o
 * texto vai sentar); os demais layouts, só a arte de borda. O layout "vazio" não ganha nada.
 */
export function comporArte(id: ArteId, semente: number, layout: SlideLayout, paleta: PaletaArte, ratio = 16 / 9): ComposicaoArte | null {
  if (layout === "vazio") return null;
  const ctx: Ctx = { desenho: desenhoDeArte(id, semente), paleta, ratio };
  return GERADORES[id](ctx, eCapa(layout), Math.abs(Math.floor(semente)));
}

/** Só as formas (é o que o `desenhos.ts` coloca na lâmina, como as outras decorações do modelo). */
export function formasDeArte(id: ArteId, semente: number, layout: SlideLayout, paleta: PaletaArte, ratio = 16 / 9): Shape[] {
  return comporArte(id, semente, layout, paleta, ratio)?.formas ?? [];
}
