// Edição do texto das formas: formatação por TRECHO selecionado (negrito, cor, tamanho...) e por parágrafo
// (alinhamento, entrelinha, espaçamento, marcadores). Trabalha em "posições" do texto da forma: os parágrafos
// juntos com "\n" entre eles (uma quebra de linha dentro do parágrafo também conta 1). Funções puras.
import type { Bullet, Para, Run, TextAlign } from "../schema";

export type EstiloRun = Omit<Run, "text" | "br">;

export type RunPatch = Partial<Pick<Run, "size" | "bold" | "italic" | "underline" | "strike" | "color" | "font" | "caps" | "spc" | "baseline" | "alpha">>;

export interface ParaPatch {
  align?: TextAlign;
  lnSpc?: Para["lnSpc"] | null;
  spcBef?: number;
  spcAft?: number;
  marL?: number;
  indent?: number;
  lvl?: number;
  bullet?: Bullet | null;
}

const tamanhoPara = (p: Para) => p.runs.reduce((a, r) => a + r.text.length, 0);

/** Texto puro dos parágrafos, como a edição o enxerga. */
export function textoDosParas(paras: Para[]): string {
  return paras.map((p) => p.runs.map((r) => r.text).join("")).join("\n");
}

/** Parágrafo vazio com o estilo de digitação dado (é o que uma caixa nova tem). */
export function paraVazio(estilo: Pick<EstiloRun, "size">, align: TextAlign = "esquerda"): Para {
  return { runs: [], align, lvl: 0, marL: 0, indent: 0, spcBef: 0, spcAft: 0, endSize: estilo.size };
}

/** Run novo de texto com o estilo dado. */
export function runDe(texto: string, e: EstiloRun): Run {
  return { ...e, text: texto };
}

/** Faixa [ini, fim) de posições de cada parágrafo no texto inteiro. */
function faixasDosParas(paras: Para[]): { ini: number; fim: number }[] {
  const out: { ini: number; fim: number }[] = [];
  let off = 0;
  for (const p of paras) {
    const len = tamanhoPara(p);
    out.push({ ini: off, fim: off + len });
    off += len + 1;
  }
  return out;
}

/** Índices dos parágrafos tocados por uma seleção (ou todos quando não há seleção). */
export function parasDaSelecao(paras: Para[], ini: number, fim: number): number[] {
  const faixas = faixasDosParas(paras);
  if (ini === fim && ini < 0) return faixas.map((_, i) => i);
  const a = Math.min(ini, fim);
  const b = Math.max(ini, fim);
  const out: number[] = [];
  faixas.forEach((f, i) => {
    // seleção vazia (cursor): o parágrafo que contém o cursor
    if (a === b ? a >= f.ini && a <= f.fim : a <= f.fim && b >= f.ini) out.push(i);
  });
  return out.length ? out : [faixas.length - 1];
}

function aplicarNoRun(r: Run, patch: RunPatch): Run {
  const n: Run = { ...r };
  for (const k of Object.keys(patch) as (keyof RunPatch)[]) {
    const v = patch[k];
    if (v === undefined) continue;
    (n as unknown as Record<string, unknown>)[k] = v;
  }
  return n;
}

/**
 * Aplica um estilo ao trecho [ini, fim) dos parágrafos. Com `ini < 0` (ou seleção vazia, `ini === fim`) vale para todo
 * o texto da forma, como no PowerPoint quando a forma inteira está selecionada.
 */
export function estiloNoIntervalo(paras: Para[], ini: number, fim: number, patch: RunPatch): Para[] {
  const todos = ini < 0 || ini === fim;
  let off = 0;
  return paras.map((p) => {
    const runs: Run[] = [];
    for (const r of p.runs) {
      const rs = off;
      const re = off + r.text.length;
      off = re;
      if (r.br) {
        runs.push(r);
        continue;
      }
      const a = todos ? rs : Math.max(rs, ini);
      const b = todos ? re : Math.min(re, fim);
      if (todos || (b > a && a < re && b > rs)) {
        if (todos || (a === rs && b === re)) runs.push(aplicarNoRun(r, patch));
        else {
          // divide o trecho em até três partes: antes, dentro e depois da seleção
          if (a > rs) runs.push({ ...r, text: r.text.slice(0, a - rs) });
          runs.push(aplicarNoRun({ ...r, text: r.text.slice(a - rs, b - rs) }, patch));
          if (b < re) runs.push({ ...r, text: r.text.slice(b - rs) });
        }
      } else runs.push(r);
    }
    off += 1; // separador de parágrafo
    const endSize = patch.size !== undefined && (todos || p.runs.length === 0) ? patch.size : p.endSize;
    return { ...p, runs: juntarIguais(runs), endSize };
  });
}

/** Junta trechos vizinhos com o mesmo estilo (mantém o texto limpo depois de muitas edições). */
export function juntarIguais(runs: Run[]): Run[] {
  const out: Run[] = [];
  for (const r of runs) {
    const ult = out[out.length - 1];
    if (ult && !ult.br && !r.br && igualEstilo(ult, r)) ult.text += r.text;
    else out.push({ ...r });
  }
  return out;
}

function igualEstilo(a: Run, b: Run): boolean {
  return (
    a.size === b.size &&
    a.bold === b.bold &&
    a.italic === b.italic &&
    a.underline === b.underline &&
    a.strike === b.strike &&
    a.color === b.color &&
    a.font === b.font &&
    (a.alpha ?? 1) === (b.alpha ?? 1) &&
    !!a.caps === !!b.caps &&
    (a.spc ?? 0) === (b.spc ?? 0) &&
    (a.baseline ?? 0) === (b.baseline ?? 0) &&
    a.link === b.link
  );
}

/** Estado do estilo no trecho: valor comum, ou "misto" quando há diferença (a fita mostra assim). */
export interface EstadoTrecho {
  bold: boolean | "misto";
  italic: boolean | "misto";
  underline: boolean | "misto";
  strike: boolean | "misto";
  size: number | "misto";
  font: string | "misto";
  color: string | "misto";
}

export function estadoDoTrecho(paras: Para[], ini: number, fim: number): EstadoTrecho | null {
  const todos = ini < 0 || ini === fim;
  const runs: Run[] = [];
  let off = 0;
  for (const p of paras) {
    for (const r of p.runs) {
      const rs = off;
      const re = off + r.text.length;
      off = re;
      if (r.br) continue;
      if (todos || (re > ini && rs < fim)) runs.push(r);
    }
    off += 1;
  }
  // cursor dentro de um trecho: o estilo dele (e não o de todos)
  if (ini >= 0 && ini === fim) {
    off = 0;
    let achado: Run | undefined;
    for (const p of paras) {
      for (const r of p.runs) {
        const rs = off;
        const re = off + r.text.length;
        off = re;
        if (!r.br && ini >= rs && ini <= re && !(ini === rs && achado)) achado = r;
      }
      off += 1;
    }
    if (achado) {
      return { bold: achado.bold, italic: achado.italic, underline: achado.underline, strike: achado.strike, size: achado.size, font: achado.font, color: achado.color };
    }
  }
  if (!runs.length) return null;
  const comum = <T>(f: (r: Run) => T): T | "misto" => (runs.every((r) => f(r) === f(runs[0])) ? f(runs[0]) : "misto");
  return {
    bold: comum((r) => r.bold),
    italic: comum((r) => r.italic),
    underline: comum((r) => r.underline),
    strike: comum((r) => r.strike),
    size: comum((r) => r.size),
    font: comum((r) => r.font),
    color: comum((r) => r.color),
  };
}

/** Aumenta ou diminui o tamanho do texto selecionado (pula para os tamanhos "redondos" do PowerPoint). */
const DEGRAUS = [8, 9, 10, 10.5, 11, 12, 14, 16, 18, 20, 24, 28, 32, 36, 40, 44, 48, 54, 60, 66, 72, 80, 88, 96];
export function proximoTamanho(atual: number, sobe: boolean): number {
  if (sobe) return DEGRAUS.find((d) => d > atual + 0.01) ?? Math.round(atual + 8);
  const menores = DEGRAUS.filter((d) => d < atual - 0.01);
  return menores.length ? menores[menores.length - 1] : Math.max(1, Math.round(atual - 1));
}

export function mudarTamanhoRelativo(paras: Para[], ini: number, fim: number, sobe: boolean): Para[] {
  // cada trecho vai para o seu próprio próximo degrau
  const todos = ini < 0 || ini === fim;
  let off = 0;
  return paras.map((p) => {
    const runs = p.runs.map((r) => {
      const rs = off;
      const re = off + r.text.length;
      off = re;
      return { r, rs, re };
    });
    off += 1;
    const saida: Run[] = [];
    for (const { r, rs, re } of runs) {
      const dentro = todos || (re > ini && rs < fim);
      if (r.br || !dentro) {
        saida.push(r);
        continue;
      }
      const novo = proximoTamanho(r.size, sobe);
      if (todos || (rs >= ini && re <= fim)) saida.push({ ...r, size: novo });
      else {
        const a = Math.max(rs, ini);
        const b = Math.min(re, fim);
        if (a > rs) saida.push({ ...r, text: r.text.slice(0, a - rs) });
        saida.push({ ...r, text: r.text.slice(a - rs, b - rs), size: novo });
        if (b < re) saida.push({ ...r, text: r.text.slice(b - rs) });
      }
    }
    const primeiro = saida.find((x) => !x.br);
    return { ...p, runs: juntarIguais(saida), endSize: p.runs.length ? (primeiro?.size ?? p.endSize) : proximoTamanho(p.endSize, sobe) };
  });
}

/** Aplica propriedades de parágrafo aos parágrafos de índice dado. */
export function estiloDosParas(paras: Para[], idx: number[], patch: ParaPatch): Para[] {
  return paras.map((p, i) => {
    if (!idx.includes(i)) return p;
    const n: Para = { ...p };
    if (patch.align !== undefined) n.align = patch.align;
    if (patch.lnSpc !== undefined) {
      if (patch.lnSpc === null) delete n.lnSpc;
      else n.lnSpc = patch.lnSpc;
    }
    if (patch.spcBef !== undefined) n.spcBef = patch.spcBef;
    if (patch.spcAft !== undefined) n.spcAft = patch.spcAft;
    if (patch.marL !== undefined) n.marL = patch.marL;
    if (patch.indent !== undefined) n.indent = patch.indent;
    if (patch.lvl !== undefined) n.lvl = patch.lvl;
    if (patch.bullet !== undefined) {
      if (patch.bullet === null) delete n.bullet;
      else n.bullet = patch.bullet;
    }
    return n;
  });
}

export type TipoMarcador = "marcador" | "numeracao" | null;

/** Liga ou desliga marcadores/numeração (com o recuo pendente que o PowerPoint usa). */
export function alternarMarcador(paras: Para[], idx: number[], tipo: TipoMarcador): Para[] {
  const jaTem = idx.every((i) => {
    const b = paras[i]?.bullet;
    return tipo === "marcador" ? !!b?.char : tipo === "numeracao" ? !!b?.auto : false;
  });
  return paras.map((p, i) => {
    if (!idx.includes(i)) return p;
    if (tipo === null || jaTem) {
      const { bullet: _b, ...resto } = p;
      void _b;
      return { ...resto, marL: 0, indent: 0 };
    }
    const tam = p.runs[0]?.size ?? p.endSize;
    const recuo = Math.max(14, Math.round(tam * 1.1));
    const bullet: Bullet = tipo === "marcador" ? { char: "•" } : { auto: "arabicPeriod", startAt: 1 };
    return { ...p, bullet, marL: recuo, indent: -recuo };
  });
}

/** Aumenta/diminui o recuo (nível) dos parágrafos. */
export function mudarRecuo(paras: Para[], idx: number[], delta: number): Para[] {
  return paras.map((p, i) => {
    if (!idx.includes(i)) return p;
    const lvl = Math.max(0, Math.min(8, p.lvl + delta));
    const passo = 27; // pt por nível (0,95 cm)
    const base = p.bullet ? Math.max(0, p.marL + delta * passo) : Math.max(0, p.marL + delta * passo);
    return { ...p, lvl, marL: base };
  });
}

// ---------------------------------------------------------------------------
// o que o usuário digita: o texto novo da caixa vira parágrafos, mexendo só no trecho que mudou
// ---------------------------------------------------------------------------

interface Celula {
  c: string;
  /** de onde o caractere herda o estilo */
  run: Run;
}

function celulasDoPara(p: Para): Celula[] {
  const out: Celula[] = [];
  for (const r of p.runs) {
    if (r.br) out.push({ c: "\n", run: r });
    else for (const ch of r.text) out.push({ c: ch, run: r });
  }
  return out;
}

function runsDasCelulas(celulas: Celula[]): Run[] {
  const runs: Run[] = [];
  for (const cel of celulas) {
    if (cel.run.br) {
      runs.push({ ...cel.run, text: "\n" });
      continue;
    }
    const ult = runs[runs.length - 1];
    if (ult && !ult.br && igualEstilo(ult, cel.run)) ult.text += cel.c;
    else runs.push({ ...cel.run, text: cel.c });
  }
  return runs;
}

/**
 * O texto da caixa mudou (o usuário digitou, apagou ou colou): devolve os parágrafos novos. Só o trecho alterado é
 * mexido — o texto novo herda o estilo do caractere vizinho, e o resto da formatação continua como estava. Quebras de
 * linha criam parágrafos que herdam as propriedades do parágrafo onde foram feitas (marcador, alinhamento...).
 */
export function aplicarTextoDigitado(paras: Para[], texto: string, estiloNovo: EstiloRun): Para[] {
  const antigo = textoDosParas(paras);
  if (antigo === texto) return paras;
  let p = 0;
  while (p < antigo.length && p < texto.length && antigo[p] === texto[p]) p++;
  let q = 0;
  while (q < antigo.length - p && q < texto.length - p && antigo[antigo.length - 1 - q] === texto[texto.length - 1 - q]) q++;
  const removidos = antigo.length - p - q;
  const inserido = texto.slice(p, texto.length - q);

  const base: Para[] = paras.length ? paras : [paraVazio({ size: estiloNovo.size })];
  const props = base.map((x) => ({ ...x, runs: [] as Run[] }));
  const celulas = base.map(celulasDoPara);

  // posição (parágrafo, deslocamento) de um ponto do texto
  const achar = (pos: number): { pi: number; off: number } => {
    let acc = 0;
    for (let i = 0; i < celulas.length; i++) {
      const len = celulas[i].length;
      if (pos <= acc + len) return { pi: i, off: pos - acc };
      acc += len + 1;
    }
    return { pi: celulas.length - 1, off: celulas[celulas.length - 1].length };
  };

  let { pi, off } = achar(p);
  // 1) apaga
  for (let k = 0; k < removidos; k++) {
    if (off < celulas[pi].length) celulas[pi].splice(off, 1);
    else if (pi + 1 < celulas.length) {
      // apagou a quebra entre dois parágrafos: junta o seguinte neste
      celulas[pi].push(...celulas[pi + 1]);
      celulas.splice(pi + 1, 1);
      props.splice(pi + 1, 1);
    }
  }
  // 2) insere
  const estiloVizinho = (): Run => {
    const viz = celulas[pi][off - 1]?.run ?? celulas[pi][off]?.run;
    if (viz) {
      const { br: _b, ...resto } = viz;
      void _b;
      return { ...resto, text: "" };
    }
    // parágrafo vazio: herda o estilo do último trecho do parágrafo anterior (Enter no fim da linha),
    // ou o de digitação da forma
    for (let i = pi - 1; i >= 0; i--) {
      const ultimo = celulas[i].filter((c) => !c.run.br).pop();
      if (ultimo) {
        const { br: _b, ...resto } = ultimo.run;
        void _b;
        return { ...resto, text: "" };
      }
    }
    return { ...estiloNovo, text: "" };
  };
  for (const ch of inserido) {
    if (ch === "\n") {
      const resto = celulas[pi].splice(off);
      celulas.splice(pi + 1, 0, resto);
      props.splice(pi + 1, 0, { ...props[pi] });
      pi++;
      off = 0;
    } else {
      celulas[pi].splice(off, 0, { c: ch, run: estiloVizinho() });
      off++;
    }
  }
  return props.map((pr, i) => ({ ...pr, runs: runsDasCelulas(celulas[i]) }));
}
