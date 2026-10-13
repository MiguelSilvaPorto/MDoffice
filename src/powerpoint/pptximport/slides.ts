// Lê as lâminas de um .pptx: cada ppt/slides/slideN.xml vira um Slide do modelo.
// O texto volta como Markdown (título vira #, item de lista vira "-") e a transição de entrada
// (`p:transition`) volta como `transicao` — o que o modelo não representa fica guardado cru.

import { aceitaDirecao, DIRECAO_PADRAO, duracaoDe } from "../edicao/transicao";
import { newSlide } from "../model";
import type { Transicao, TransicaoDirecao, TransicaoTipo } from "../schema";
import { textoParaMarkdown } from "./slides-md";
import { paragrafos } from "./xml";
import { filho, filhos, type No } from "./xmltree";

/** Converte os parágrafos de um XML de lâmina em Markdown. */
export function xmlParaMarkdown(xml: string): string {
  return textoParaMarkdown(paragrafos(xml));
}

/**
 * Lâminas declaradas no `p:sldIdLst` do presentation.xml, na ordem: o `r:id` de cada
 * relação e se ela está oculta (`show="0"`).
 */
export function laminasDoPresentation(pres: No | undefined): { rId: string; oculta: boolean }[] {
  return filhos(filho(pres, "sldIdLst"), "sldId").map((id) => ({ rId: id.a["r:id"] ?? "", oculta: id.a.show === "0" }));
}

/**
 * Nome próprio da lâmina gravado no `p:cSld` ("" quando o arquivo não tem).
 * O "Slide N" é o nome padrão que o PptxGenJS dá a toda lâmina — não é nome escolhido
 * pelo usuário e não deve virar nome na importação.
 */
export function nomeDaCld(raiz: No | undefined): string {
  const nome = (filho(raiz, "cSld")?.a.name ?? "").trim();
  return /^Slide \d+$/.test(nome) ? "" : nome;
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

// ---------------------------------------------------------------------------
// transição de entrada da lâmina
// ---------------------------------------------------------------------------

/** O que a leitura da transição devolveu. */
export interface TransicaoLida {
  /** transição modelada (fade, push, wipe, split, cover ou uncover) */
  transicao?: Transicao;
  /** XML original, guardado quando o efeito não é representado por inteiro: volta como veio */
  bruta?: string;
  /** o que não pôde ser reproduzido (o importador mostra) */
  avisos: string[];
}

/** Efeitos do `p:transition` que o modelo conhece (`pull` é o "Uncover" da interface do PowerPoint). */
const EFEITOS: Record<string, TransicaoTipo> = { fade: "fade", push: "push", wipe: "wipe", split: "split", cover: "cover", pull: "uncover" };

/** Direções do OOXML (l/u/r/d) no vocabulário do modelo. */
const DIRECOES: Record<string, TransicaoDirecao> = { l: "esquerda", r: "direita", u: "cima", d: "baixo" };

/** Duração de cada `spd` quando o arquivo não traz a duração exata (`p14:dur`). */
const SPD_SEGUNDOS: Record<string, number> = { fast: 0.5, med: 0.75, slow: 1 };

const RE_TRANSICAO = /<p:transition\b[^>]*(?:\/>|>[\s\S]*?<\/p:transition>)/;

/** Atributos de uma tag (nome sem o prefixo do namespace → valor). */
function atributos(tag: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const m of tag.matchAll(/(?:[A-Za-z_][\w.-]*:)?([A-Za-z_][\w.-]*)\s*=\s*"([^"]*)"/g)) out[m[1]] = m[2];
  return out;
}

/** XML que representa a transição inteira: o `<p:transition>` e, quando houver, o mc:AlternateContent em volta. */
function xmlDaTransicao(xml: string, m: RegExpExecArray): string {
  const ini = xml.lastIndexOf("<mc:AlternateContent", m.index);
  if (ini >= 0 && !xml.slice(ini, m.index).includes("</mc:AlternateContent>")) {
    const fim = xml.indexOf("</mc:AlternateContent>", m.index);
    if (fim >= 0) return xml.slice(ini, fim + "</mc:AlternateContent>".length);
  }
  return m[0];
}

/**
 * Lê a transição de uma lâmina a partir do XML cru dela.
 * O que o modelo representa vira `transicao`; o resto (efeito desconhecido, som, extensões, avanço
 * automático, variações do split) fica em `bruta` — para voltar ao arquivo como veio — e num aviso.
 */
export function lerTransicao(xml: string): TransicaoLida {
  const m = RE_TRANSICAO.exec(xml);
  if (!m) return { avisos: [] };
  const bruta = xmlDaTransicao(xml, m);
  const attrs = atributos(m[0].slice(0, m[0].indexOf(">") + 1));
  const corpo = m[0].replace(/^<p:transition\b[^>]*\/?>/, "").replace(/<\/p:transition>$/, "");
  const ef = /<(?:p:)?([A-Za-z0-9]+)\b([^>]*)\/?>/.exec(corpo);
  const tipo = ef ? EFEITOS[ef[1]] : undefined;

  // sem efeito nenhum = troca direta; com efeito que o modelo não conhece = guarda o XML inteiro
  if (!tipo) {
    if (!ef) return { avisos: [] };
    return { bruta, avisos: [`transição "${ef[1]}" não é reproduzida: mantida como veio no arquivo`] };
  }

  const efAttrs = atributos(ef![0]);
  const perdidos: string[] = [];
  if (/<(?:p:)?sndAc\b/.test(corpo)) perdidos.push("som");
  if (/<(?:p:)?extLst\b/.test(corpo)) perdidos.push("extensões");
  if (attrs.advTm !== undefined) perdidos.push("avanço automático");
  if (tipo === "split" && ((efAttrs.orient && efAttrs.orient !== "horz") || (efAttrs.dir && efAttrs.dir !== "out"))) perdidos.push("orientação do split");
  if (efAttrs.dir && !DIRECOES[efAttrs.dir]) perdidos.push("direção de canto");
  if (perdidos.length) return { bruta, avisos: [`transição com ${perdidos.join(", ")} não é reproduzida: mantida como veio no arquivo`] };

  const transicao: Transicao = { tipo };
  // o OOXML assume dir="l" quando o atributo não vem
  if (aceitaDirecao(tipo)) transicao.direcao = DIRECOES[efAttrs.dir ?? "l"] ?? DIRECAO_PADRAO;
  const dur = attrs.dur !== undefined ? Number(attrs.dur) / 1000 : attrs.spd ? SPD_SEGUNDOS[attrs.spd] : undefined;
  if (dur !== undefined && Number.isFinite(dur) && dur > 0) transicao.duracao = duracaoDe({ tipo, duracao: dur });
  return { transicao, avisos: [] };
}

export { newSlide };
