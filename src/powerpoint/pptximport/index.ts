// Entrada da importação: bytes de .pptx -> Deck do motor, com as lâminas fiéis ao original
// (formas posicionadas, fundos, imagens, cores do tema, texto formatado). O que ainda não é
// suportado (tabelas, gráficos, SmartArt) vira um aviso, nunca some em silêncio.
import type { Deck, DeckSetup, Fill, Shape, Slide } from "../schema";
import { DEFAULT_SETUP } from "../model";
import { lerTema, MAPA_PADRAO, type Tema } from "./cores";
import { lerArvore, lerPreenchimento, type CtxForma } from "./formas";
import { paragrafosDe } from "../edicao/animacao";
import { Pacote, type Relacao } from "./pacote";
import { lerTransicao } from "./slides";
import { lerTiming, type ParasDaForma } from "./timing";
import { caminho, filho, filhos, num, type No } from "./xmltree";
import { carregarFontes } from "./fontes";
import { laminasDoPresentation, nomeDaCld } from "./slides";

export interface ResultadoImport {
  deck: Deck;
  setup: DeckSetup;
  /** limitações encontradas (o que não pôde ser reproduzido) */
  avisos: string[];
  /** formas lidas mas não desenhadas (sem nada visível), por lâmina — para diagnóstico */
  descartes: string[][];
}

interface Modelo {
  raiz: No | undefined;
  rels: Map<string, Relacao>;
  parte: string;
}

const EMU_POL = 914400;

/** Fundo declarado em <p:bg> (bgPr com preenchimento, ou bgRef para os fundos do tema). */
async function lerFundo(bg: No | undefined, c: CtxForma): Promise<Fill | undefined> {
  if (!bg) return undefined;
  const pr = filho(bg, "bgPr");
  if (pr) return await lerPreenchimento(pr, c);
  const ref = filho(bg, "bgRef");
  if (ref) {
    const idx = num(ref, "idx");
    const est = c.tema.fundos[idx - 1001];
    const cor = (await import("./cores")).resolverCor(ref.c[0], { tema: c.tema, mapa: c.mapa });
    if (est) return await lerPreenchimento({ n: "x", a: {}, c: [est], t: "" }, c, cor);
  }
  return undefined;
}

/** Mapa de cores do slide: o do mestre, com a substituição do layout e do slide quando existir. */
function mapaDeCores(mestre: No | undefined, layout: No | undefined, slide: No | undefined): Record<string, string> {
  const m = { ...MAPA_PADRAO, ...(filho(mestre, "clrMap")?.a ?? {}) };
  for (const fonte of [layout, slide]) {
    const ov = caminho(filho(fonte, "clrMapOvr"), "overrideClrMapping");
    if (ov) Object.assign(m, ov.a);
  }
  return m;
}

/** Texto das notas do apresentador: o corpo (placeholder "body") da página de notas. */
async function lerNotas(pac: Pacote, partSlide: string): Promise<string> {
  const rel = await pac.relacaoDoTipo(partSlide, "notesSlide");
  if (!rel) return "";
  const raiz = await pac.xml(rel.alvo);
  const arvore = caminho(raiz, "cSld/spTree");
  const linhas: string[] = [];
  for (const sp of filhos(arvore, "sp")) {
    if (caminho(sp, "nvSpPr/nvPr/ph")?.a.type !== "body") continue;
    for (const p of filhos(filho(sp, "txBody"), "p")) {
      let t = "";
      for (const e of p.c) {
        if (e.n === "r" || e.n === "fld") t += filho(e, "t")?.t ?? "";
        else if (e.n === "br") t += "\n";
      }
      linhas.push(t);
    }
  }
  return linhas.join("\n").trim();
}

/** Texto-fonte da lâmina em Markdown, na ordem de leitura (o título vira "#"). */
function markdownDe(shapes: Shape[]): string {
  const textos = shapes
    .filter((s) => !s.fixa && s.paras && s.text.trim())
    .sort((a, b) => (Math.abs(a.box.y - b.box.y) < 1.5 ? a.box.x - b.box.x : a.box.y - b.box.y));
  const linhas: string[] = [];
  textos.forEach((s, i) => {
    const t = s.text.trim();
    if (i === 0 && !t.includes("\n") && t.length < 120) linhas.push(`# ${t}`);
    else linhas.push(...t.split("\n").filter((l) => l.trim()).map((l) => (s.paras?.some((p) => p.bullet) ? `- ${l.trim()}` : l.trim())));
  });
  return linhas.join("\n\n");
}

/** Lê um .pptx e devolve o deck pronto para o motor. */
export async function pptxToDeck(bytes: Uint8Array, setupBase: DeckSetup = DEFAULT_SETUP): Promise<ResultadoImport> {
  const pac = await Pacote.abrir(bytes);
  const avisos = new Set<string>();

  const pres = await pac.xml("ppt/presentation.xml");
  const sz = filho(pres, "sldSz");
  const larg = num(sz, "cx", 12192000);
  const alt = num(sz, "cy", 6858000);
  const relPres = await pac.relacoes("ppt/presentation.xml");

  // ordem real das lâminas (e quais estão ocultas: show="0" no p:sldId)
  const partes: string[] = [];
  const ocultas = new Set<string>();
  for (const { rId, oculta } of laminasDoPresentation(pres)) {
    const r = relPres.get(rId);
    if (r && pac.existe(r.alvo)) {
      partes.push(r.alvo);
      if (oculta) ocultas.add(r.alvo);
    }
  }
  if (!partes.length) {
    partes.push(
      ...pac
        .nomes()
        .filter((n) => /^ppt\/slides\/slide\d+\.xml$/.test(n))
        .sort((a, b) => Number(/(\d+)\.xml$/.exec(a)![1]) - Number(/(\d+)\.xml$/.exec(b)![1]))
    );
  }

  const midiaIds = new Map<string, string>();
  const midia: Record<string, string> = {};
  const temas = new Map<string, Tema>();
  const modelos = new Map<string, Modelo>();
  const carregar = async (parte: string): Promise<Modelo> => {
    let m = modelos.get(parte);
    if (!m) {
      m = { raiz: await pac.xml(parte), rels: await pac.relacoes(parte), parte };
      modelos.set(parte, m);
    }
    return m;
  };
  const textoPadrao = filho(pres, "defaultTextStyle");
  const seq = { n: 0 };
  const descartesPorLamina: string[][] = [];

  const slides: Slide[] = [];
  for (let i = 0; i < partes.length; i++) {
    const parte = partes[i];
    const sl = await carregar(parte);
    const relLayout = [...sl.rels.values()].find((r) => r.tipo === "slideLayout");
    const layout = relLayout ? await carregar(relLayout.alvo) : undefined;
    const relMestre = layout ? [...layout.rels.values()].find((r) => r.tipo === "slideMaster") : undefined;
    const mestre = relMestre ? await carregar(relMestre.alvo) : undefined;
    const relTema = mestre ? [...mestre.rels.values()].find((r) => r.tipo === "theme") : undefined;
    let tema = relTema ? temas.get(relTema.alvo) : undefined;
    if (!tema) {
      tema = lerTema(relTema ? await pac.xml(relTema.alvo) : undefined);
      if (relTema) temas.set(relTema.alvo, tema);
    }

    const mapa = mapaDeCores(mestre?.raiz, layout?.raiz, sl.raiz);
    const treeSlide = caminho(sl.raiz, "cSld/spTree");
    const treeLayout = caminho(layout?.raiz, "cSld/spTree");
    const treeMestre = caminho(mestre?.raiz, "cSld/spTree");
    const spids = new Map<string, string>();
    const base: CtxForma = {
      pac,
      tema,
      mapa,
      larg,
      alt,
      midiaIds,
      midia,
      avisos,
      textoPadrao,
      mestre: mestre?.raiz,
      layoutTree: treeLayout,
      mestreTree: treeMestre,
      parte,
      rels: sl.rels,
      numeroSlide: i + 1,
      seq,
      spids,
      descartes: [],
    };
    descartesPorLamina.push(base.descartes);

    // decorações do mestre e do layout (embaixo), a menos que o slide/layout peça para escondê-las
    const shapes: Shape[] = [];
    const slideEscondeTudo = sl.raiz?.a.showMasterSp === "0";
    const layoutEscondeMestre = layout?.raiz?.a.showMasterSp === "0";
    if (mestre && treeMestre && !slideEscondeTudo && !layoutEscondeMestre) {
      shapes.push(...(await lerArvore(treeMestre, { ...base, parte: mestre.parte, rels: mestre.rels }, true)));
    }
    if (layout && treeLayout && !slideEscondeTudo) {
      shapes.push(...(await lerArvore(treeLayout, { ...base, parte: layout.parte, rels: layout.rels }, true)));
    }
    if (treeSlide) shapes.push(...(await lerArvore(treeSlide, base, false)));

    // fundo: slide > layout > mestre
    let bg = await lerFundo(caminho(sl.raiz, "cSld/bg"), base);
    if (!bg && layout) bg = await lerFundo(caminho(layout.raiz, "cSld/bg"), { ...base, parte: layout.parte, rels: layout.rels });
    if (!bg && mestre) bg = await lerFundo(caminho(mestre.raiz, "cSld/bg"), { ...base, parte: mestre.parte, rels: mestre.rels });

    const md = markdownDe(shapes);
    const nome = nomeDaCld(sl.raiz);
    // oculta: o show="0" costuma vir no p:sldId (presentation.xml); aceitamos também
    // o show="0" no p:sld, que é o lugar do esquema e o que outros programas gravam
    const oculta = ocultas.has(parte) || sl.raiz?.a.show === "0";
    // transição de entrada: o que o modelo não representa volta cru (e vira aviso)
    const textoSlide = (await pac.texto(parte)) ?? "";
    const transicao = lerTransicao(textoSlide);
    for (const a of transicao.avisos) avisos.add(a);
    // animações da lâmina (`p:timing`): modeladas quando dá; senão, cru (e vira aviso).
    // O mapa de parágrafos por forma é o que deixa reconhecer o build "por parágrafo".
    const parasInfo = new Map<string, ParasDaForma>();
    for (const [fileId, interno] of spids) {
      const f = shapes.find((x) => x.id === interno);
      if (!f?.paras?.length) continue;
      parasInfo.set(fileId, { total: f.paras.length, naoVazios: paragrafosDe(f) });
    }
    const timing = lerTiming(textoSlide, spids, parasInfo);
    for (const a of timing.avisos) avisos.add(a);
    slides.push({
      md,
      layout: i === 0 ? "titulo" : "conteudo",
      notes: await lerNotas(pac, parte),
      shapes,
      ...(bg ? { bg } : {}),
      ...(oculta ? { show: false } : {}),
      ...(nome ? { nome } : {}),
      ...(transicao.transicao ? { transicao: transicao.transicao } : {}),
      ...(transicao.bruta ? { transicaoXml: transicao.bruta } : {}),
      ...(timing.animacoes ? { animacoes: timing.animacoes } : {}),
      ...(timing.bruta ? { timingXml: timing.bruta } : {}),
    });
  }

  if (!slides.length) slides.push({ md: "", layout: "conteudo", notes: "", shapes: [] });

  const widthIn = larg / EMU_POL;
  const heightIn = alt / EMU_POL;
  const { fonts, raw } = await carregarFontes(pac, pres, relPres, avisos);
  const setup: DeckSetup = {
    ...setupBase,
    aspect: Math.abs(widthIn / heightIn - 16 / 9) < Math.abs(widthIn / heightIn - 4 / 3) ? "16:9" : "4:3",
    theme: "claro",
    showNumber: false,
    footer: "",
    bg: "",
    widthIn,
    heightIn,
    media: midia,
    fonts,
    fontsRaw: raw,
  };
  const titulo = slides[0].md.match(/^#\s+(.+)$/m)?.[1]?.trim() ?? "Apresentação";
  return { deck: { titulo, slides }, setup, avisos: [...avisos], descartes: descartesPorLamina };
}

export { deckParaMarkdown } from "./slides-md";
export { xmlParaMarkdown, notasDoSlide, ordemDosSlides, lerTransicao } from "./slides";
export { lerTiming } from "./timing";
export type { TransicaoLida } from "./slides";
export type { TimingLido } from "./timing";
export { textosDe, paragrafos } from "./xml";
