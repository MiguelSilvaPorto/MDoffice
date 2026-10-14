// Animação da lâmina no .pptx (`p:timing`): lê os efeitos que o modelo representa
// (aparecer/surgir/desaparecer/sumir, início ao clicar/com o anterior/depois do anterior)
// e devolve o resto cru. O molde é o `lerTransicao`: { animacoes?, bruta?, avisos }.
//
// A regra é tudo-ou-nada por lâmina: se qualquer efeito (ou detalhe: ênfase, trajetória,
// por parágrafo, gatilho, atraso, repetição…) ficar fora do modelo, a lâmina inteira fica
// com o XML original e volta como veio na exportação — nada se perde no round-trip.
import type { Animacao, AnimacaoDirecao, AnimacaoInicio, AnimacaoTipo } from "../schema";
import { normalizarAnimacao } from "../edicao/animacao";
import { caminho, filho, filhos, lerXml, type No } from "./xmltree";

/** Resultado da leitura do `<p:timing>` de uma lâmina. */
export interface TimingLido {
  /** efeitos modelados, na ordem do arquivo */
  animacoes?: Animacao[];
  /** `<p:timing>` original quando a lâmina tem animações que o modelo não representa */
  bruta?: string;
  avisos: string[];
}

const RE_TIMING = /<p:timing\b[\s\S]*?<\/p:timing>/;

/** Preset do PowerPoint -> tipo do modelo (aparecer = 1; surgir/sumir = fade = 10; ênfase: pulsar = 26, ampliar = 6, girar = 8, transparência = 9; trajetória em linha = 64). */
const PRESETS: Record<string, Record<string, AnimacaoTipo>> = {
  entr: { "1": "aparecer", "10": "surgir" },
  emph: { "26": "pulsar", "6": "ampliar", "8": "girar", "9": "transparencia" },
  exit: { "1": "desaparecer", "10": "sumir" },
  path: { "64": "trajetoria" },
};

/** Subtypes aceitos na trajetória (as quatro direções do preset "Linhas"; 0 aparece em arquivos antigos). */
const SUB_TRAJETORIA = ["0", "1", "2", "4", "8"];

/** Linha reta de 25% da lâmina (`M 0 0 L x y E`) -> direção; qualquer outro caminho fica fora do modelo. */
function direcaoDaLinha(caminhoTexto: string): AnimacaoDirecao | undefined {
  const m = /^M\s+0\s+0\s+L\s+(-?[\d.]+)\s+(-?[\d.]+)\s+E$/.exec(caminhoTexto.trim());
  if (!m) return undefined;
  const x = Number(m[1]);
  const y = Number(m[2]);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return undefined;
  if (Math.abs(y) < 1e-6 && Math.abs(Math.abs(x) - 0.25) < 1e-6) return x > 0 ? "direita" : "esquerda";
  if (Math.abs(x) < 1e-6 && Math.abs(Math.abs(y) - 0.25) < 1e-6) return y > 0 ? "baixo" : "cima";
  return undefined;
}

const INICIO_POR_NODE: Record<string, AnimacaoInicio> = {
  clickEffect: "clicar",
  withEffect: "com",
  afterEffect: "depois",
};

/** Acha o primeiro descendente com o nome dado. */
function achar(no: No, nome: string): No | undefined {
  for (const f of no.c) {
    if (f.n === nome) return f;
    const r = achar(f, nome);
    if (r) return r;
  }
  return undefined;
}

/** Maior `dur` (> 1) dentro do subárvore do efeito, em ms. */
function maxDur(no: No, prof = 0): number {
  if (prof > 64) return 0;
  let maior = 0;
  for (const f of no.c) {
    const d = Number(f.a.dur);
    if (f.n === "cTn" && Number.isFinite(d) && d > maior) maior = d;
    maior = Math.max(maior, maxDur(f, prof + 1));
  }
  return maior;
}

interface EfeitoLido {
  ctn: No;
  tipo: AnimacaoTipo;
  inicio: AnimacaoInicio;
  spid: string;
  grp: string;
  duracao?: number;
  atraso?: number;
  direcao?: AnimacaoDirecao;
  /** índice do parágrafo alvo (nos builds "por parágrafo") */
  paragrafo?: number;
}

/** O atributo que um `p:set` mexe (style.visibility, style.opacity…). */
function atributoDoSet(set: No): string {
  return achar(set, "attrName")?.t ?? "";
}

/** Lê um efeito (cTn com presetClass). undefined = fora do modelo. */
function lerEfeito(ctn: No, seqInterativa: boolean): EfeitoLido | undefined {
  if (seqInterativa) return undefined; // gatilho por clique numa forma: não é modelado
  const classe = ctn.a.presetClass ?? "";
  const preset = ctn.a.presetID ?? "0";
  const tipo = PRESETS[classe]?.[preset];
  if (!tipo) return undefined;
  const sub = ctn.a.presetSubtype ?? "0";
  if (tipo !== "trajetoria" && sub !== "0") return undefined;
  if (tipo === "trajetoria" && !SUB_TRAJETORIA.includes(sub)) return undefined;
  // repetição, reversão e suavização do próprio efeito: fora do modelo
  if (ctn.a.repeatCount !== undefined || ctn.a.autoRev !== undefined || ctn.a.accel !== undefined || ctn.a.decel !== undefined) return undefined;
  // o atraso do efeito é modelado (o XML usa milissegundos); gatilho por evento não
  const cond = caminho(ctn, "stCondLst/cond");
  if (cond?.a.evt !== undefined) return undefined;
  const atrasoMs = cond?.a.delay !== undefined && cond.a.delay !== "0" ? Number(cond.a.delay) : 0;
  if (!Number.isFinite(atrasoMs) || atrasoMs < 0) return undefined;

  // alvo: uma forma inteira ou UM parágrafo (builds); trechos (st ≠ end) ficam de fora
  const tgt = achar(ctn, "spTgt");
  if (!tgt?.a.spid) return undefined;
  const rg = caminho(tgt, "txEl/pRg") ?? achar(tgt, "pRg");
  let paragrafo: number | undefined;
  if (rg) {
    const st = Number(rg.a.st);
    const end = Number(rg.a.end ?? rg.a.st);
    if (!Number.isInteger(st) || st < 0 || st !== end) return undefined;
    paragrafo = st;
  }
  const grp = ctn.a.grpId ?? "0";

  // comportamentos esperados de cada tipo (qualquer outro elemento = fora do modelo)
  const comportamentos = filho(ctn, "childTnLst")?.c ?? [];
  const so = (...aceitos: string[]): boolean => comportamentos.every((b) => aceitos.includes(b.n));
  const animEff = comportamentos.find((b) => b.n === "animEffect");
  const set = comportamentos.find((b) => b.n === "set");
  const instantaneo = tipo === "aparecer" || tipo === "desaparecer";
  let direcao: AnimacaoDirecao | undefined;
  if (instantaneo) {
    if (!so("set") || atributoDoSet(set!) !== "style.visibility") return undefined;
  } else if (tipo === "surgir" || tipo === "sumir") {
    if (!so("set", "animEffect") || atributoDoSet(set!) !== "style.visibility") return undefined;
    if (!animEff || animEff.a.filter !== "fade" || animEff.a.transition !== (tipo === "surgir" ? "in" : "out")) return undefined;
  } else if (tipo === "pulsar" || tipo === "ampliar") {
    if (!so("animScale")) return undefined;
  } else if (tipo === "girar") {
    if (!so("animRot")) return undefined;
  } else if (tipo === "trajetoria") {
    if (!so("animMotion")) return undefined;
    const motion = comportamentos.find((b) => b.n === "animMotion");
    direcao = motion?.a.path ? direcaoDaLinha(motion.a.path) : undefined;
    if (!direcao) return undefined;
  } else {
    // transparência: um set de opacidade
    if (!so("set") || atributoDoSet(set!) !== "style.opacity") return undefined;
  }

  const dur = maxDur(ctn, 0);
  if (instantaneo && dur > 1) return undefined; // instantâneo com duração: fora do modelo

  return {
    ctn,
    tipo,
    inicio: INICIO_POR_NODE[ctn.a.nodeType ?? ""] ?? "com",
    spid: tgt.a.spid,
    grp,
    ...(!instantaneo && dur > 1 ? { duracao: dur / 1000 } : {}),
    ...(atrasoMs > 0 ? { atraso: atrasoMs / 1000 } : {}),
    ...(direcao ? { direcao } : {}),
    ...(paragrafo !== undefined ? { paragrafo } : {}),
  };
}

/** Parágrafos de cada forma no arquivo (para reconhecer o build "por parágrafo"). */
export interface ParasDaForma {
  /** quantos parágrafos o texto tem (contando os vazios, como o `pRg`) */
  total: number;
  /** índices dos parágrafos NÃO vazios (os que o build anima, em ordem) */
  naoVazios: number[];
}

/**
 * Lê o `<p:timing>` de uma lâmina. `spids` mapeia o id da forma no arquivo (cNvPr) para o
 * id interno do modelo — sem ele não dá para amarrar o efeito à forma. `parasInfo` (opcional)
 * diz quantos parágrafos cada forma tem, para reconhecer o build "por parágrafo".
 */
export function lerTiming(xml: string, spids: Map<string, string>, parasInfo?: Map<string, ParasDaForma>): TimingLido {
  const m = RE_TIMING.exec(xml);
  if (!m) return { avisos: [] };
  const bruta = m[0];
  // `lerXml` devolve o primeiro elemento do trecho — que já é o próprio `p:timing`
  const raiz = lerXml(bruta);
  const timing = raiz.n === "timing" ? raiz : achar(raiz, "timing");
  if (!timing) return { avisos: [] };

  const lidos: EfeitoLido[] = [];
  let foraDoModelo = false;
  const visitar = (no: No, seqInterativa: boolean): void => {
    if (foraDoModelo) return;
    // mídia com tempo próprio (tocar/pausar no tempo): fora do modelo — preserva o XML inteiro
    if (no.n === "cmd" || no.n === "audio" || no.n === "video") {
      foraDoModelo = true;
      return;
    }
    if (no.n === "seq") {
      const ctn = filho(no, "cTn");
      if (ctn?.a.nodeType === "interactiveSeq") seqInterativa = true;
    }
    if (no.n === "cTn" && no.a.presetClass !== undefined) {
      const efeito = lerEfeito(no, seqInterativa);
      if (!efeito) foraDoModelo = true;
      else lidos.push(efeito);
      return; // não desce dentro do efeito (os cTn de dentro são comportamentos)
    }
    for (const f of no.c) visitar(f, seqInterativa);
  };
  visitar(timing, false);

  const avisoFora = "Animações desta lâmina foram mantidas como vieram (o modelo ainda não representa todos os efeitos).";
  if (foraDoModelo) return { bruta, avisos: [avisoFora] };
  // sem nenhum efeito de animação (ex.: só mídia com tempo próprio): preserva o XML, sem aviso
  if (!lidos.length) return { bruta, avisos: [] };

  /** O `p:bldLst` tem um build "por parágrafo" para este alvo? (é o que fecha o padrão) */
  const temBuild = (spid: string, grp: string): boolean => {
    const lista = filho(timing, "bldLst");
    return !!lista && filhos(lista, "bldP").some((p) => p.a.spid === spid && (p.a.grpId ?? "0") === grp && p.a.build === "p");
  };

  // agrupa por forma no arquivo: um efeito = caso simples; vários = build "por parágrafo"
  const porSpid = new Map<string, EfeitoLido[]>();
  for (const e of lidos) {
    const grupo = porSpid.get(e.spid) ?? [];
    grupo.push(e);
    porSpid.set(e.spid, grupo);
  }

  const animacoes: Animacao[] = [];
  const vistos = new Set<string>();
  for (const [spid, grupo] of porSpid) {
    const forma = spids.get(spid);
    if (!forma || vistos.has(forma)) return { bruta, avisos: [avisoFora] };
    vistos.add(forma);

    // caso simples: um efeito mirando a forma inteira
    if (grupo.length === 1 && grupo[0].paragrafo === undefined) {
      const e = grupo[0];
      const n = normalizarAnimacao({ forma, tipo: e.tipo, inicio: e.inicio, duracao: e.duracao, atraso: e.atraso, direcao: e.direcao });
      if (!n) return { bruta, avisos: [] };
      animacoes.push(n);
      continue;
    }

    // build "por parágrafo": um efeito por parágrafo não vazio, na ordem, com o encadeamento padrão
    const base = grupo[0];
    const info = parasInfo?.get(spid);
    const indices = grupo.map((e) => e.paragrafo);
    const mesmoEfeito = grupo.every(
      (e) => e.tipo === base.tipo && e.duracao === base.duracao && e.atraso === base.atraso && e.direcao === base.direcao && e.grp === base.grp
    );
    const esperado = base.inicio === "clicar" ? "clicar" : "depois";
    const encadeado = grupo.slice(1).every((e) => e.inicio === esperado);
    const cobre = !!info && JSON.stringify(indices) === JSON.stringify(info.naoVazios);
    if (!mesmoEfeito || !encadeado || !cobre || !temBuild(spid, base.grp)) return { bruta, avisos: [avisoFora] };

    const n = normalizarAnimacao({
      forma,
      tipo: base.tipo,
      inicio: base.inicio,
      duracao: base.duracao,
      atraso: base.atraso,
      direcao: base.direcao,
      porParagrafo: true,
    });
    if (!n) return { bruta, avisos: [] };
    animacoes.push(n);
  }
  return { animacoes, avisos: [] };
}
