// Operações sobre FORMAS (caixas de texto, imagens, formas geométricas) dentro
// de uma lâmina: criar, mover, redimensionar, alinhar, reordenar em camadas.
import { uid } from "../util";
import type { Shape, ShapeBox, ShapeKind, Slide, TextAlign } from "./schema";

/** Margem padrão (em % da lâmina) ao criar uma forma. */
const MARGEM = 6;

function formaBase(kind: ShapeKind, box: ShapeBox): Shape {
  return {
    id: uid(),
    kind,
    box,
    text: "",
    fontFamily: "Segoe UI",
    fontSize: 18,
    color: "1C212B",
    bold: false,
    italic: false,
    align: "esquerda",
    fill: "",
    src: "",
    rot: 0,
  };
}

/** Cria uma forma já posicionada dentro dos limites da lâmina. */
export function createShape(kind: ShapeKind): Shape {
  const box: ShapeBox = { x: MARGEM, y: MARGEM, w: 100 - MARGEM * 2, h: 100 - MARGEM * 2 };
  const s = formaBase(kind, box);
  if (kind === "forma") s.fill = "4F46E5";
  if (kind === "imagem") s.box = { x: MARGEM, y: MARGEM, w: 60, h: 50 };
  return s;
}

/** Mantém a forma dentro da lâmina (0-100) e com tamanho mínimo. */
export function clampBox(box: ShapeBox): ShapeBox {
  const MIN = 4;
  const w = Math.min(Math.max(box.w, MIN), 100);
  const h = Math.min(Math.max(box.h, MIN), 100);
  return {
    x: Math.min(Math.max(box.x, 0), 100 - w),
    y: Math.min(Math.max(box.y, 0), 100 - h),
    w,
    h,
  };
}

/** Aplica uma mudança na forma selecionada. */
export function patchShape(slide: Slide, id: string, patch: Partial<Shape>): Slide {
  let mudou = false;
  const shapes = slide.shapes.map((s) => {
    if (s.id !== id) return s;
    mudou = true;
    return { ...s, ...patch, box: patch.box ? clampBox(patch.box) : s.box };
  });
  return mudou ? { ...slide, shapes } : slide;
}

/** Insere ou substitui uma forma pelo id. */
export function putShape(slide: Slide, shape: Shape): Slide {
  const existe = slide.shapes.some((s) => s.id === shape.id);
  const shapes = existe ? slide.shapes.map((s) => (s.id === shape.id ? shape : s)) : [...slide.shapes, shape];
  return { ...slide, shapes };
}

export function removeShape(slide: Slide, id: string): Slide {
  const shapes = slide.shapes.filter((s) => s.id !== id);
  return shapes.length === slide.shapes.length ? slide : { ...slide, shapes };
}

/** Leva a forma para a frente ou para trás no empilhamento. */
export function reorderShape(slide: Slide, id: string, dir: "frente" | "tras" | "topo" | "fundo"): Slide {
  const i = slide.shapes.findIndex((s) => s.id === id);
  if (i < 0) return slide;
  const shapes = slide.shapes.slice();
  const [s] = shapes.splice(i, 1);
  if (dir === "topo") shapes.push(s);
  else if (dir === "fundo") shapes.unshift(s);
  else if (dir === "frente") shapes.splice(Math.min(i + 1, shapes.length), 0, s);
  else shapes.splice(Math.max(i - 1, 0), 0, s);
  return { ...slide, shapes };
}

/** Formas alinhadas a uma borda ou distribuídas. */
export function alignShapes(slide: Slide, ids: string[], modo: "esquerda" | "centro" | "direita" | "topo" | "meio" | "base"): Slide {
  const alvo = slide.shapes.filter((s) => ids.includes(s.id));
  if (!alvo.length) return slide;
  const x0 = Math.min(...alvo.map((s) => s.box.x));
  const x1 = Math.max(...alvo.map((s) => s.box.x + s.box.w));
  const y0 = Math.min(...alvo.map((s) => s.box.y));
  const y1 = Math.max(...alvo.map((s) => s.box.y + s.box.h));
  const cx = (x0 + x1) / 2;
  const cy = (y0 + y1) / 2;
  const shapes = slide.shapes.map((s) => {
    if (!ids.includes(s.id)) return s;
    const b = { ...s.box };
    if (modo === "esquerda") b.x = x0;
    if (modo === "direita") b.x = x1 - b.w;
    if (modo === "centro") b.x = cx - b.w / 2;
    if (modo === "topo") b.y = y0;
    if (modo === "base") b.y = y1 - b.h;
    if (modo === "meio") b.y = cy - b.h / 2;
    return { ...s, box: clampBox(b) };
  });
  return { ...slide, shapes };
}

/** Distribui as formas selecionadas em espaços iguais. */
export function distributeShapes(slide: Slide, ids: string[], eixo: "h" | "v"): Slide {
  const alvo = slide.shapes.filter((s) => ids.includes(s.id)).sort((a, b) => (eixo === "h" ? a.box.x - b.box.x : a.box.y - b.box.y));
  if (alvo.length < 3) return slide;
  const de = eixo === "h" ? (s: Shape) => s.box.x : (s: Shape) => s.box.y;
  const dim = eixo === "h" ? (s: Shape) => s.box.w : (s: Shape) => s.box.h;
  const inicio = de(alvo[0]);
  const fim = de(alvo[alvo.length - 1]) + dim(alvo[alvo.length - 1]);
  const passo = (fim - inicio) / (alvo.length - 1);
  const pos = new Map<string, number>();
  alvo.forEach((s, i) => pos.set(s.id, inicio + passo * i));
  const shapes = slide.shapes.map((s) => {
    const p = pos.get(s.id);
    if (p === undefined) return s;
    const b = { ...s.box };
    if (eixo === "h") b.x = p;
    else b.y = p;
    return { ...s, box: clampBox(b) };
  });
  return { ...slide, shapes };
}

/** Texto de uma forma como linhas (o .pptx e a IA preferem texto puro). */
export function shapeText(s: Shape): string {
  return s.text;
}

/** Próximo alinhamento, para o ciclo do botão da fita. */
export function cicloAlinhamento(atual: TextAlign): TextAlign {
  const ordem: TextAlign[] = ["esquerda", "centro", "direita", "justificado"];
  const i = ordem.indexOf(atual);
  return ordem[(i + 1) % ordem.length];
}

/** Posiciona o cursor na forma (o editor de texto precisa disso ao criar). */
export function elementoDaForma(slide: Slide, id: string): HTMLElement | null {
  return slide && document.querySelector<HTMLElement>(`[data-shape="${id}"]`);
}