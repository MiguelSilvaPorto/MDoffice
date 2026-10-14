// Gera o `<p:timing>` das animações de forma na estrutura que o PowerPoint entende —
// a mesma que o DeckCraft escreve (validada contra arquivos reais): grupos de clique,
// lotes "com/depois do anterior" (com o atraso acumulado) e os comportamentos de cada efeito.
// O que a lâmina trouxe cru (`timingXml`) volta como veio, sem passar por aqui.
import type { Animacao, AnimacaoDirecao, Shape } from "../schema";
import { atrasoDe, direcaoDeAnimacao, duracaoEfetiva, inicioDe } from "../edicao/animacao";

/** presetID/presetClass de cada tipo (aparecer = 1; surgir/sumir = fade = 10; ênfase: pulsar = 26, ampliar = 6, girar = 8, transparência = 9; trajetória em linha = 64). */
const PRESET: Record<Animacao["tipo"], { id: number; classe: "entr" | "emph" | "exit" | "path" }> = {
  aparecer: { id: 1, classe: "entr" },
  surgir: { id: 10, classe: "entr" },
  pulsar: { id: 26, classe: "emph" },
  ampliar: { id: 6, classe: "emph" },
  girar: { id: 8, classe: "emph" },
  transparencia: { id: 9, classe: "emph" },
  desaparecer: { id: 1, classe: "exit" },
  sumir: { id: 10, classe: "exit" },
  trajetoria: { id: 64, classe: "path" },
};

/** presetSubtype das direções da trajetória (os do PowerPoint: cima 1, direita 2, baixo 4, esquerda 8). */
const SUB_DIRECAO: Record<AnimacaoDirecao, number> = { cima: 1, direita: 2, baixo: 4, esquerda: 8 };

/** Caminho de uma linha reta de 25% da lâmina, na direção pedida (o mesmo dos presets "Linhas"). */
const CAMINHO_LINHA: Record<AnimacaoDirecao, string> = {
  direita: "M 0 0 L 0.25 0 E",
  esquerda: "M 0 0 L -0.25 0 E",
  baixo: "M 0 0 L 0 0.25 E",
  cima: "M 0 0 L 0 -0.25 E",
};

interface Efeito {
  a: Animacao;
  spid: number;
  grp: number;
  nodeType: "clickEffect" | "withEffect" | "afterEffect";
}

/** Duração do efeito em ms (0 nos instantâneos). */
const durMs = (a: Animacao): number => Math.round(duracaoEfetiva(a) * 1000);

/** Atraso do efeito em ms. */
const atrasoMs = (a: Animacao): number => Math.round(atrasoDe(a) * 1000);

/**
 * Agrupa os efeitos em grupos de clique; dentro de cada grupo, os "depois do anterior"
 * viram lotes em sequência (o lote acumula o atraso) e os "com o anterior" entram no lote.
 */
function agrupar(efeitos: Efeito[]): { auto: boolean; lotes: Efeito[][] }[] {
  const clicks: { auto: boolean; lotes: Efeito[][] }[] = [];
  for (const e of efeitos) {
    const inicio = inicioDe(e.a);
    const ultimo = clicks[clicks.length - 1];
    if (inicio === "clicar") clicks.push({ auto: false, lotes: [[e]] });
    else if (inicio === "com") {
      if (ultimo) ultimo.lotes[ultimo.lotes.length - 1].push(e);
      else clicks.push({ auto: true, lotes: [[e]] });
    } else if (ultimo) ultimo.lotes.push([e]);
    else clicks.push({ auto: true, lotes: [[e]] });
  }
  return clicks;
}

/** XML do `<p:timing>`; vazio quando não há animação para escrever. */
export function xmlTiming(animacoes: Animacao[] | undefined, ids: Record<string, number>, shapes: Shape[] = []): string {
  const efeitos: Efeito[] = [];
  const grpPorSpid = new Map<number, number>();
  for (const a of animacoes ?? []) {
    const spid = ids[a.forma];
    if (!spid) continue; // forma que não entrou no XML (não deve acontecer)
    const grp = grpPorSpid.get(spid) ?? 0;
    grpPorSpid.set(spid, grp + 1);
    const inicio = inicioDe(a);
    efeitos.push({ a, spid, grp, nodeType: inicio === "clicar" ? "clickEffect" : inicio === "com" ? "withEffect" : "afterEffect" });
  }
  if (!efeitos.length) return "";

  let n = 0;
  const id = (): number => ++n;

  /** Um comportamento (`p:cBhvr`): alvo, duração e, se pedido, atraso; `extras` vai no próprio cTn. */
  const cbhvr = (e: Efeito, dur: number, delay: number | null, attrs: string[], extras = ""): string => {
    const ctn =
      delay === null
        ? `<p:cTn id="${id()}" dur="${Math.max(1, dur)}" fill="hold"${extras}/>`
        : `<p:cTn id="${id()}" dur="${Math.max(1, dur)}" fill="hold"${extras}><p:stCondLst><p:cond delay="${delay}"/></p:stCondLst></p:cTn>`;
    const nomes = attrs.length ? `<p:attrNameLst>${attrs.map((a) => `<p:attrName>${a}</p:attrName>`).join("")}</p:attrNameLst>` : "";
    return `<p:cBhvr>${ctn}<p:tgtEl><p:spTgt spid="${e.spid}"/></p:tgtEl>${nomes}</p:cBhvr>`;
  };
  const setVis = (e: Efeito, delay: number, visivel: boolean): string =>
    `<p:set>${cbhvr(e, 1, delay, ["style.visibility"])}<p:to><p:strVal val="${visivel ? "visible" : "hidden"}"/></p:to></p:set>`;
  const animEffect = (e: Efeito, saida: boolean, dur: number): string =>
    `<p:animEffect transition="${saida ? "out" : "in"}" filter="fade">${cbhvr(e, dur, null, [])}</p:animEffect>`;
  /** Escala (pulsar e ampliar): `by` em milésimos de porcentagem; o pulsar volta sozinho (`autoRev`). */
  const animScale = (e: Efeito, dur: number, escala: number, autoRev: boolean): string =>
    `<p:animScale>${cbhvr(e, dur, null, [], autoRev ? ' autoRev="1"' : "")}<p:by x="${escala}" y="${escala}"/></p:animScale>`;

  /** Os comportamentos de cada tipo: entrada/saída por visibilidade e fade; ênfase por escala/rotação/opacidade; trajetória por movimento. */
  const comportamentos = (e: Efeito): string => {
    const dur = durMs(e.a);
    if (e.a.tipo === "aparecer") return setVis(e, 0, true);
    if (e.a.tipo === "desaparecer") return setVis(e, 0, false);
    if (e.a.tipo === "surgir") return setVis(e, 0, true) + animEffect(e, false, dur);
    if (e.a.tipo === "sumir") return animEffect(e, true, dur) + setVis(e, Math.max(0, dur - 1), false);
    if (e.a.tipo === "pulsar") return animScale(e, dur, 105000, true);
    if (e.a.tipo === "ampliar") return animScale(e, dur, 150000, false);
    if (e.a.tipo === "girar") return `<p:animRot by="21600000">${cbhvr(e, dur, null, [])}</p:animRot>`;
    if (e.a.tipo === "trajetoria") {
      const caminho = CAMINHO_LINHA[direcaoDeAnimacao(e.a)];
      return `<p:animMotion origin="layout" path="${caminho}" pathEditMode="relative" ptsTypes="">${cbhvr(e, dur, null, ["ppt_x", "ppt_y"])}</p:animMotion>`;
    }
    // transparência: opacidade para 0,50 (fica assim)
    return `<p:set>${cbhvr(e, dur, null, ["style.opacity"])}<p:to><p:strVal val="0.50"/></p:to></p:set>`;
  };

  const effectPar = (e: Efeito): string => {
    const { id: preset, classe } = PRESET[e.a.tipo];
    const sub = e.a.tipo === "trajetoria" ? SUB_DIRECAO[direcaoDeAnimacao(e.a)] : 0;
    return (
      `<p:par><p:cTn id="${id()}" presetID="${preset}" presetClass="${classe}" presetSubtype="${sub}" fill="hold" grpId="${e.grp}" nodeType="${e.nodeType}">` +
      `<p:stCondLst><p:cond delay="${atrasoMs(e.a)}"/></p:stCondLst><p:childTnLst>${comportamentos(e)}</p:childTnLst></p:cTn></p:par>`
    );
  };

  const clickPars = (clicks: { auto: boolean; lotes: Efeito[][] }[]): string => {
    let out = "";
    for (const c of clicks) {
      // o grupo começa no clique; os grupos "auto" (com/depois do anterior sem clique antes)
      // começam junto com a sequência da lâmina (o `p:tn` 2 é o id do mainSeq)
      const auto = c.auto ? `<p:cond evt="onBegin" delay="0"><p:tn>2</p:tn></p:cond>` : "";
      out += `<p:par><p:cTn id="${id()}" fill="hold"><p:stCondLst><p:cond delay="indefinite"/>${auto}</p:stCondLst><p:childTnLst>`;
      let atraso = 0;
      for (const lote of c.lotes) {
        out += `<p:par><p:cTn id="${id()}" fill="hold"><p:stCondLst><p:cond delay="${atraso}"/></p:stCondLst><p:childTnLst>`;
        for (const e of lote) out += effectPar(e);
        out += `</p:childTnLst></p:cTn></p:par>`;
        // o próximo lote ("depois do anterior") começa quando o último efeito deste termina
        atraso += Math.max(0, ...lote.map((e) => atrasoMs(e.a) + durMs(e.a)));
      }
      out += `</p:childTnLst></p:cTn></p:par>`;
    }
    return out;
  };

  const clicks = agrupar(efeitos);
  // formas com texto animadas entram no `p:bldLst` (animBg: o fundo da forma anima junto)
  const porId = new Map(shapes.map((s) => [s.id, s]));
  const bld: string[] = [];
  for (const e of efeitos) {
    const s = porId.get(e.a.forma);
    const temTexto = !!s && ((s.paras?.length ?? 0) > 0 || !!s.text?.trim());
    if (temTexto && !bld.some((b) => b.includes(`spid="${e.spid}" `))) {
      bld.push(`<p:bldP spid="${e.spid}" grpId="${e.grp}" animBg="1"/>`);
    }
  }

  return (
    `<p:timing><p:tnLst><p:par><p:cTn id="${id()}" dur="indefinite" restart="never" nodeType="tmRoot"><p:childTnLst>` +
    `<p:seq concurrent="1" nextAc="seek"><p:cTn id="${id()}" dur="indefinite" nodeType="mainSeq"><p:childTnLst>${clickPars(clicks)}</p:childTnLst></p:cTn>` +
    `<p:prevCondLst><p:cond evt="onPrev" delay="0"><p:tgtEl><p:sldTgt/></p:tgtEl></p:cond></p:prevCondLst>` +
    `<p:nextCondLst><p:cond evt="onNext" delay="0"><p:tgtEl><p:sldTgt/></p:tgtEl></p:cond></p:nextCondLst>` +
    `</p:seq></p:childTnLst></p:cTn></p:par></p:tnLst>` +
    (bld.length ? `<p:bldLst>${bld.join("")}</p:bldLst>` : "") +
    `</p:timing>`
  );
}

/**
 * Insere o `<p:timing>` no XML da lâmina, na ordem do esquema: depois do `p:transition`
 * (a transição já entrou quando esta função roda) e antes do `p:extLst`/`</p:sld>`.
 */
export function inserirTiming(xml: string, animacoes: Animacao[] | undefined, timingXml: string | undefined, ids: Record<string, number>, shapes: Shape[] = []): string {
  const novo = timingXml ?? xmlTiming(animacoes, ids, shapes);
  if (!novo) return xml;
  const base = xml.replace(/<p:timing\b[\s\S]*?<\/p:timing>/, ""); // idempotente
  // a transição crua vem dentro de mc:AlternateContent: o timing entra depois do bloco inteiro
  const fimAlt = base.indexOf("</mc:AlternateContent>");
  if (fimAlt >= 0) {
    const pos = fimAlt + "</mc:AlternateContent>".length;
    return base.slice(0, pos) + novo + base.slice(pos);
  }
  const fimTrans = base.indexOf("</p:transition>");
  if (fimTrans >= 0) {
    const pos = fimTrans + "</p:transition>".length;
    return base.slice(0, pos) + novo + base.slice(pos);
  }
  const ext = base.indexOf("<p:extLst");
  if (ext >= 0) return base.slice(0, ext) + novo + base.slice(ext);
  const fimClr = base.indexOf("</p:clrMapOvr>");
  if (fimClr >= 0) {
    const pos = fimClr + "</p:clrMapOvr>".length;
    return base.slice(0, pos) + novo + base.slice(pos);
  }
  return base.replace("</p:sld>", () => novo + "</p:sld>");
}
