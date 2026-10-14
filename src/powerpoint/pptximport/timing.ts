// Animação da lâmina no .pptx (`p:timing`): lê os efeitos que o modelo representa
// (aparecer/surgir/desaparecer/sumir, início ao clicar/com o anterior/depois do anterior)
// e devolve o resto cru. O molde é o `lerTransicao`: { animacoes?, bruta?, avisos }.
//
// A regra é tudo-ou-nada por lâmina: se qualquer efeito (ou detalhe: ênfase, trajetória,
// por parágrafo, gatilho, atraso, repetição…) ficar fora do modelo, a lâmina inteira fica
// com o XML original e volta como veio na exportação — nada se perde no round-trip.
import type { Animacao, AnimacaoInicio, AnimacaoTipo } from "../schema";
import { normalizarAnimacao } from "../edicao/animacao";
import { caminho, filho, lerXml, type No } from "./xmltree";

/** Resultado da leitura do `<p:timing>` de uma lâmina. */
export interface TimingLido {
  /** efeitos modelados, na ordem do arquivo */
  animacoes?: Animacao[];
  /** `<p:timing>` original quando a lâmina tem animações que o modelo não representa */
  bruta?: string;
  avisos: string[];
}

const RE_TIMING = /<p:timing\b[\s\S]*?<\/p:timing>/;

/** Preset do PowerPoint -> tipo do modelo (aparecer = 1; surgir/sumir = fade = 10). */
const PRESETS: Record<string, Record<string, AnimacaoTipo>> = {
  entr: { "1": "aparecer", "10": "surgir" },
  exit: { "1": "desaparecer", "10": "sumir" },
};

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
  duracao?: number;
}

/** Lê um efeito (cTn com presetClass). undefined = fora do modelo. */
function lerEfeito(ctn: No, seqInterativa: boolean): EfeitoLido | undefined {
  if (seqInterativa) return undefined; // gatilho por clique numa forma: não é modelado
  const classe = ctn.a.presetClass ?? "";
  const preset = ctn.a.presetID ?? "0";
  const tipo = PRESETS[classe]?.[preset];
  if (!tipo) return undefined;
  if ((ctn.a.presetSubtype ?? "0") !== "0") return undefined;
  // atraso, repetição, reversão e suavização do próprio efeito: fora do modelo
  const cond = caminho(ctn, "stCondLst/cond");
  if (cond && (cond.a.evt !== undefined || (cond.a.delay !== undefined && cond.a.delay !== "0"))) return undefined;
  if (ctn.a.repeatCount !== undefined || ctn.a.autoRev !== undefined || ctn.a.accel !== undefined || ctn.a.decel !== undefined) return undefined;

  // alvo: uma forma inteira (por parágrafo/trecho fica de fora)
  const tgt = achar(ctn, "spTgt");
  if (!tgt?.a.spid) return undefined;
  if (caminho(tgt, "txEl/pRg") || achar(tgt, "pRg")) return undefined;

  // comportamentos esperados de cada tipo (qualquer outro elemento = fora do modelo)
  const comportamentos = filho(ctn, "childTnLst")?.c ?? [];
  const soEsperados = comportamentos.every((b) => b.n === "set" || b.n === "animEffect");
  if (!soEsperados) return undefined;
  const animEff = comportamentos.find((b) => b.n === "animEffect");
  const suave = tipo === "surgir" || tipo === "sumir";
  if (suave) {
    if (!animEff || animEff.a.filter !== "fade" || animEff.a.transition !== (tipo === "surgir" ? "in" : "out")) return undefined;
  } else if (animEff) {
    return undefined; // aparecer/desaparecer são instantâneos: sem efeito animado
  }

  const dur = maxDur(ctn, 0);
  if (!suave && dur > 1) return undefined; // instantâneo com duração: fora do modelo

  return {
    ctn,
    tipo,
    inicio: INICIO_POR_NODE[ctn.a.nodeType ?? ""] ?? "com",
    spid: tgt.a.spid,
    ...(suave && dur > 1 ? { duracao: dur / 1000 } : {}),
  };
}

/**
 * Lê o `<p:timing>` de uma lâmina. `spids` mapeia o id da forma no arquivo (cNvPr) para o
 * id interno do modelo — sem ele não dá para amarrar o efeito à forma.
 */
export function lerTiming(xml: string, spids: Map<string, string>): TimingLido {
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

  // efeito fora do modelo (ênfase, trajetória, por parágrafo, gatilho, atraso…): preserva cru e avisa
  if (foraDoModelo) {
    return {
      bruta,
      avisos: ["Animações desta lâmina foram mantidas como vieram (o modelo ainda não representa todos os efeitos)."],
    };
  }
  // sem nenhum efeito de animação (ex.: só mídia com tempo próprio): preserva o XML, sem aviso
  if (!lidos.length) return { bruta, avisos: [] };

  const animacoes: Animacao[] = [];
  const vistos = new Set<string>();
  for (const e of lidos) {
    const forma = spids.get(e.spid);
    if (!forma || vistos.has(forma)) {
      return {
        bruta,
        avisos: ["Animações desta lâmina foram mantidas como vieram (há efeitos que o modelo ainda não representa)."],
      };
    }
    vistos.add(forma);
    const n = normalizarAnimacao({ forma, tipo: e.tipo, inicio: e.inicio, duracao: e.duracao });
    if (!n) return { bruta, avisos: [] };
    animacoes.push(n);
  }
  return { animacoes, avisos: [] };
}
