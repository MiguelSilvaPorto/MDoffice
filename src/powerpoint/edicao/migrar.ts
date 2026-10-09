// Formas antigas (criadas antes do editor completo: só texto, retângulo ou imagem simples) viram formas "ricas",
// que são as únicas que o editor novo e a exportação fiel conhecem. Idempotente: quem já é rica passa direto.
import type { DeckSetup, Para, Run, Shape, Slide } from "../schema";

/** Registra uma imagem em data URL na mídia do deck e devolve `media:ID`. */
export function registrarMidia(setup: DeckSetup, dataUrl: string): string {
  const midia = (setup.media ??= {});
  for (const [id, v] of Object.entries(midia)) if (v === dataUrl) return `media:${id}`;
  let n = Object.keys(midia).length + 1;
  while (midia[`m${n}`]) n++;
  midia[`m${n}`] = dataUrl;
  return `media:m${n}`;
}

function parasDoTexto(s: Shape): Para[] {
  const linhas = (s.text || "").split("\n");
  const base: Omit<Run, "text"> = {
    size: s.fontSize,
    bold: s.bold,
    italic: s.italic,
    underline: false,
    strike: false,
    color: s.color || "000000",
    font: (s.fontFamily || "Arial").replace(/["']/g, ""),
  };
  return linhas.map((l) => ({
    runs: l ? [{ ...base, text: l }] : [],
    align: s.align,
    lvl: 0,
    marL: 0,
    indent: 0,
    spcBef: 0,
    spcAft: 0,
    endSize: s.fontSize,
  }));
}

export function migrarForma(s: Shape, setup: DeckSetup): Shape {
  if (s.geom !== undefined) return s;
  const n: Shape = { ...s, geom: "rect", ins: [7.2, 3.6, 7.2, 3.6], anchor: "t" };
  if (s.kind === "imagem") {
    if (s.src.startsWith("data:")) n.src = registrarMidia(setup, s.src);
    return n;
  }
  if (s.kind === "forma") {
    n.fillX = { kind: "solid", color: s.fill || "4F46E5", alpha: 1 };
    n.paras = s.text ? parasDoTexto(s) : [{ runs: [], align: "centro", lvl: 0, marL: 0, indent: 0, spcBef: 0, spcAft: 0, endSize: s.fontSize }];
    n.anchor = "ctr";
    return n;
  }
  n.paras = parasDoTexto(s);
  return n;
}

export function migrarSlides(slides: Slide[], setup: DeckSetup): Slide[] {
  let mudou = false;
  const out = slides.map((sl) => {
    if (sl.shapes.every((f) => f.geom !== undefined)) return sl;
    mudou = true;
    return { ...sl, shapes: sl.shapes.map((f) => migrarForma(f, setup)) };
  });
  return mudou ? out : slides;
}
