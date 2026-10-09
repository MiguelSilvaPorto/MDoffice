// Operações sobre VÁRIAS formas de uma lâmina (o que a fita e o teclado fazem): duplicar, agrupar, ordem das
// camadas, alinhar, distribuir, espelhar, mover e colar. Funções puras: recebem a lâmina e devolvem outra.
import { uid } from "../../util";
import type { Shape, Slide } from "../schema";
import { envolvente, envolventeDe, type Dim } from "./geometria";

export type ModoAlinhar = "esquerda" | "centro" | "direita" | "topo" | "meio" | "base";

const mudou = (a: Slide, b: Shape[]): Slide => ({ ...a, shapes: b });

/** Inclui na lista as formas que estão no mesmo grupo das escolhidas. */
export function comGrupos(slide: Slide, ids: string[]): string[] {
  const grupos = new Set(slide.shapes.filter((s) => ids.includes(s.id) && s.grupo).map((s) => s.grupo!));
  if (!grupos.size) return ids;
  const out = new Set(ids);
  for (const s of slide.shapes) if (s.grupo && grupos.has(s.grupo)) out.add(s.id);
  return slide.shapes.filter((s) => out.has(s.id)).map((s) => s.id);
}

export function removerFormas(slide: Slide, ids: string[]): Slide {
  if (!ids.length) return slide;
  return mudou(slide, slide.shapes.filter((s) => !ids.includes(s.id)));
}

/** Copia as formas (ids novos, grupos remapeados) deslocando-as um pouco. Devolve a lâmina e os ids novos. */
export function duplicarFormas(slide: Slide, ids: string[], dx = 1.5, dy = 2.5): { slide: Slide; novos: string[] } {
  const alvo = slide.shapes.filter((s) => ids.includes(s.id));
  const copias = clonarFormas(alvo, dx, dy);
  return { slide: mudou(slide, [...slide.shapes, ...copias]), novos: copias.map((c) => c.id) };
}

/** Clona formas com ids e grupos novos (usado por duplicar e colar). */
export function clonarFormas(alvo: Shape[], dx = 0, dy = 0): Shape[] {
  const grupos = new Map<string, string>();
  return alvo.map((s) => {
    const g = s.grupo ? (grupos.get(s.grupo) ?? (grupos.set(s.grupo, uid()), grupos.get(s.grupo)!)) : undefined;
    const c: Shape = { ...structuredCloneSeguro(s), id: uid(), box: { ...s.box, x: s.box.x + dx, y: s.box.y + dy } };
    if (g) c.grupo = g;
    else delete c.grupo;
    delete c.fixa;
    return c;
  });
}

function structuredCloneSeguro<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T;
}

/** Cola formas copiadas (ids novos) na lâmina. */
export function colarFormas(slide: Slide, copiadas: Shape[], dx = 1.5, dy = 2.5): { slide: Slide; novos: string[] } {
  const novas = clonarFormas(copiadas, dx, dy);
  return { slide: mudou(slide, [...slide.shapes, ...novas]), novos: novas.map((n) => n.id) };
}

/** Agrupa: as formas passam a ter o mesmo id de grupo e ficam juntas na ordem das camadas. */
export function agruparFormas(slide: Slide, ids: string[]): Slide {
  if (ids.length < 2) return slide;
  const g = uid();
  const lista = slide.shapes;
  const membros = lista.filter((s) => ids.includes(s.id)).map((s) => ({ ...s, grupo: g }));
  // o grupo ocupa o lugar da forma que estava mais à frente
  const ultimo = lista.reduce((acc, s, i) => (ids.includes(s.id) ? i : acc), -1);
  const antes = lista.slice(0, ultimo + 1).filter((s) => !ids.includes(s.id));
  const depois = lista.slice(ultimo + 1);
  return mudou(slide, [...antes, ...membros, ...depois]);
}

export function desagruparFormas(slide: Slide, ids: string[]): Slide {
  const grupos = new Set(slide.shapes.filter((s) => ids.includes(s.id) && s.grupo).map((s) => s.grupo!));
  if (!grupos.size) return slide;
  return mudou(
    slide,
    slide.shapes.map((s) => {
      if (!s.grupo || !grupos.has(s.grupo)) return s;
      const { grupo: _g, ...resto } = s;
      void _g;
      return resto;
    })
  );
}

export type DirOrdem = "frente" | "tras" | "topo" | "fundo";

/** Muda a ordem das camadas de várias formas, mantendo a ordem relativa entre elas. */
export function ordemDasFormas(slide: Slide, ids: string[], dir: DirOrdem): Slide {
  const lista = slide.shapes.slice();
  const idx = lista.map((s, i) => (ids.includes(s.id) ? i : -1)).filter((i) => i >= 0);
  if (!idx.length) return slide;
  if (dir === "topo") {
    const sel = idx.map((i) => lista[i]);
    return mudou(slide, [...lista.filter((s) => !ids.includes(s.id)), ...sel]);
  }
  if (dir === "fundo") {
    const sel = idx.map((i) => lista[i]);
    return mudou(slide, [...sel, ...lista.filter((s) => !ids.includes(s.id))]);
  }
  if (dir === "frente") {
    // cada forma sobe uma posição, da frente para trás, sem passar por outra selecionada
    for (let k = idx.length - 1; k >= 0; k--) {
      const i = idx[k];
      if (i < lista.length - 1 && !ids.includes(lista[i + 1].id)) {
        [lista[i], lista[i + 1]] = [lista[i + 1], lista[i]];
      }
    }
  } else {
    for (let k = 0; k < idx.length; k++) {
      const i = idx[k];
      if (i > 0 && !ids.includes(lista[i - 1].id)) {
        [lista[i], lista[i - 1]] = [lista[i - 1], lista[i]];
      }
    }
  }
  return mudou(slide, lista);
}

/** Move várias formas (deslocamento em % da lâmina). */
export function moverFormas(slide: Slide, ids: string[], dx: number, dy: number): Slide {
  return mudou(slide, slide.shapes.map((s) => (ids.includes(s.id) && !s.bloqueada ? { ...s, box: { ...s.box, x: s.box.x + dx, y: s.box.y + dy } } : s)));
}

/**
 * Alinha as formas escolhidas: entre si quando são várias; à lâmina quando é uma só.
 * A rotação conta (alinha a borda visível, não a caixa sem girar).
 */
export function alinharFormas(slide: Slide, ids: string[], modo: ModoAlinhar, d: Dim): Slide {
  const alvo = slide.shapes.filter((s) => ids.includes(s.id) && !s.bloqueada);
  if (!alvo.length) return slide;
  const ref = alvo.length === 1 ? { x: 0, y: 0, w: 100, h: 100 } : envolventeDe(alvo, d)!;
  return mudou(
    slide,
    slide.shapes.map((s) => {
      if (!alvo.includes(s)) return s;
      const e = envolvente(s, d);
      let dx = 0;
      let dy = 0;
      if (modo === "esquerda") dx = ref.x - e.x;
      if (modo === "direita") dx = ref.x + ref.w - (e.x + e.w);
      if (modo === "centro") dx = ref.x + ref.w / 2 - (e.x + e.w / 2);
      if (modo === "topo") dy = ref.y - e.y;
      if (modo === "base") dy = ref.y + ref.h - (e.y + e.h);
      if (modo === "meio") dy = ref.y + ref.h / 2 - (e.y + e.h / 2);
      return { ...s, box: { ...s.box, x: s.box.x + dx, y: s.box.y + dy } };
    })
  );
}

/** Distribui (3 ou mais) com espaços iguais entre as formas, da primeira à última. */
export function distribuirFormas(slide: Slide, ids: string[], eixo: "h" | "v", d: Dim): Slide {
  const alvo = slide.shapes.filter((s) => ids.includes(s.id) && !s.bloqueada);
  if (alvo.length < 3) return slide;
  const caixas = alvo.map((s) => ({ s, e: envolvente(s, d) }));
  caixas.sort((a, b) => (eixo === "h" ? a.e.x - b.e.x : a.e.y - b.e.y));
  const ini = eixo === "h" ? caixas[0].e.x : caixas[0].e.y;
  const ult = caixas[caixas.length - 1];
  const fim = eixo === "h" ? ult.e.x + ult.e.w : ult.e.y + ult.e.h;
  const total = caixas.reduce((a, c) => a + (eixo === "h" ? c.e.w : c.e.h), 0);
  const vao = (fim - ini - total) / (caixas.length - 1);
  const desloc = new Map<string, number>();
  let cursor = ini;
  for (const c of caixas) {
    const atual = eixo === "h" ? c.e.x : c.e.y;
    desloc.set(c.s.id, cursor - atual);
    cursor += (eixo === "h" ? c.e.w : c.e.h) + vao;
  }
  return mudou(
    slide,
    slide.shapes.map((s) => {
      const dd = desloc.get(s.id);
      if (dd === undefined) return s;
      return { ...s, box: eixo === "h" ? { ...s.box, x: s.box.x + dd } : { ...s.box, y: s.box.y + dd } };
    })
  );
}

/** Espelha na horizontal ou na vertical (cada forma, sobre o próprio centro). */
export function espelharFormas(slide: Slide, ids: string[], eixo: "h" | "v"): Slide {
  return mudou(
    slide,
    slide.shapes.map((s) => {
      if (!ids.includes(s.id) || s.bloqueada) return s;
      return eixo === "h" ? { ...s, flipH: !s.flipH } : { ...s, flipV: !s.flipV };
    })
  );
}

/** Mesma largura/altura da primeira forma escolhida. */
export function igualarTamanho(slide: Slide, ids: string[], qual: "largura" | "altura" | "ambos"): Slide {
  const ref = slide.shapes.find((s) => ids.includes(s.id));
  if (!ref) return slide;
  return mudou(
    slide,
    slide.shapes.map((s) => {
      if (!ids.includes(s.id) || s === ref || s.bloqueada) return s;
      return { ...s, box: { ...s.box, w: qual === "altura" ? s.box.w : ref.box.w, h: qual === "largura" ? s.box.h : ref.box.h } };
    })
  );
}

/** Aplica um patch a várias formas. */
export function patchFormas(slide: Slide, ids: string[], patch: Partial<Shape> | ((s: Shape) => Partial<Shape>)): Slide {
  return mudou(slide, slide.shapes.map((s) => (ids.includes(s.id) ? { ...s, ...(typeof patch === "function" ? patch(s) : patch) } : s)));
}
