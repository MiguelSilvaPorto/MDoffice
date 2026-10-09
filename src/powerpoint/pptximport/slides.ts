// Lê as lâminas de um .pptx: cada ppt/slides/slideN.xml vira um Slide do modelo.
// O texto volta como Markdown (título vira #, item de lista vira "-").

import { newSlide } from "../model";
import { textoParaMarkdown } from "./slides-md";
import { paragrafos } from "./xml";

/** Converte os parágrafos de um XML de lâmina em Markdown. */
export function xmlParaMarkdown(xml: string): string {
  return textoParaMarkdown(paragrafos(xml));
}

/** Descobre a ordem real dos slides pela ordem em que aparecem no presentation.xml. */
export async function ordemDosSlides(zip: any): Promise<string[]> {
  const pres = await zip.file("ppt/presentation.xml")?.async("string");
  if (!pres) return Object.keys(zip.files).filter((n) => /^ppt\/slides\/slide\d+\.xml$/.test(n)).sort();
  const rels = await zip.file("ppt/_rels/presentation.xml.rels")?.async("string");
  if (!rels) return [];
  // mapa rId -> alvo
  const mapa = new Map<string, string>();
  for (const m of rels.matchAll(/<Relationship\s+Id="([^"]+)"[^>]*Target="([^"]+)"/g)) mapa.set(m[1], m[2]);
  const ordem: string[] = [];
  for (const m of pres.matchAll(/<p:sldId[^>]*r:id="([^"]+)"/g)) {
    const alvo = mapa.get(m[1]);
    if (alvo) ordem.push("ppt/" + alvo.replace(/^\.\.\//, "").replace(/^\//, ""));
  }
  return ordem.length ? ordem : Object.keys(zip.files).filter((n) => /^ppt\/slides\/slide\d+\.xml$/.test(n)).sort();
}

/** Lê as notas (notesSlide) de uma lâmina pelo número dela. */
export async function notasDoSlide(zip: any, indice: number): Promise<string> {
  const arq = zip.file(`ppt/notesSlides/notesSlide${indice}.xml`);
  if (!arq) return "";
  const xml = await arq.async("string");
  // a nota costuma terminar com o número da lâmina; tira esse ruído
  return paragrafos(xml)
    .map((p) => p.texto)
    .filter((t) => t !== String(indice))
    .join("\n")
    .trim();
}

export { newSlide };