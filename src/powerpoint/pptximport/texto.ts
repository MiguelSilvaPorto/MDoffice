// Texto do .pptx com a herança do PowerPoint resolvida na importação:
//   formatação do trecho  >  estilo da forma (lstStyle)  >  placeholder do layout  >  placeholder do mestre
//   >  estilos de texto do mestre (título/corpo/outros)  >  padrão da apresentação.
// O resultado são parágrafos com TODOS os valores já explícitos (tamanho, cor, fonte...), prontos para desenhar.
import type { Bullet, Para, Run, TextAlign } from "../schema";
import { resolverCor, type ContextoCor, type CorResolvida } from "./cores";
import { caminho, filho, filhos, num, type No } from "./xmltree";

export interface RProps {
  sz?: number;
  b?: boolean;
  i?: boolean;
  u?: boolean;
  strike?: boolean;
  cor?: CorResolvida;
  font?: string;
  caps?: boolean;
  spc?: number;
  baseline?: number;
  link?: string;
}

interface Esp {
  pct?: number;
  pts?: number;
}

interface BuProps {
  tipo?: "none" | "char" | "auto";
  char?: string;
  auto?: string;
  startAt?: number;
  font?: string;
  cor?: CorResolvida;
  sizePct?: number;
}

export interface PProps {
  marL?: number;
  indent?: number;
  algn?: TextAlign;
  lnSpc?: Esp;
  spcBef?: Esp;
  spcAft?: Esp;
  bu?: BuProps;
  def: RProps;
}

const EMU_PT = 12700;

function fonteDe(typeface: string | undefined, ctx: ContextoCor): string | undefined {
  if (!typeface) return undefined;
  if (typeface === "+mj-lt") return ctx.tema.fonteMaior;
  if (typeface === "+mn-lt") return ctx.tema.fonteMenor;
  if (typeface.startsWith("+")) return undefined; // +mj-ea, +mn-cs...: não usamos
  return typeface;
}

export function lerRProps(no: No | undefined, ctx: ContextoCor): RProps {
  const r: RProps = {};
  if (!no) return r;
  if (no.a.sz) r.sz = num(no, "sz") / 100;
  if (no.a.b !== undefined) r.b = no.a.b === "1" || no.a.b === "true";
  if (no.a.i !== undefined) r.i = no.a.i === "1" || no.a.i === "true";
  if (no.a.u !== undefined) r.u = no.a.u !== "none";
  if (no.a.strike !== undefined) r.strike = no.a.strike !== "noStrike";
  if (no.a.cap !== undefined) r.caps = no.a.cap === "all";
  if (no.a.spc) r.spc = num(no, "spc") / 100;
  if (no.a.baseline) r.baseline = num(no, "baseline") / 1000;
  const fill = filho(no, "solidFill");
  if (fill) {
    for (const c of fill.c) {
      const cor = resolverCor(c, ctx);
      if (cor) {
        r.cor = cor;
        break;
      }
    }
  }
  const latin = filho(no, "latin");
  const font = fonteDe(latin?.a.typeface, ctx);
  if (font) r.font = font;
  return r;
}

function lerEsp(no: No | undefined): Esp | undefined {
  const f = no?.c[0];
  if (!f) return undefined;
  if (f.n === "spcPct") return { pct: num(f, "val") / 100000 };
  if (f.n === "spcPts") return { pts: num(f, "val") / 100 };
  return undefined;
}

export function lerPProps(no: No | undefined, ctx: ContextoCor): PProps {
  const p: PProps = { def: {} };
  if (!no) return p;
  if (no.a.marL !== undefined) p.marL = num(no, "marL") / EMU_PT;
  if (no.a.indent !== undefined) p.indent = num(no, "indent") / EMU_PT;
  const al = no.a.algn;
  if (al) p.algn = al === "ctr" ? "centro" : al === "r" ? "direita" : al === "just" || al === "dist" ? "justificado" : "esquerda";
  p.lnSpc = lerEsp(filho(no, "lnSpc"));
  p.spcBef = lerEsp(filho(no, "spcBef"));
  p.spcAft = lerEsp(filho(no, "spcAft"));
  const bu: BuProps = {};
  let temBu = false;
  for (const c of no.c) {
    if (c.n === "buNone") {
      bu.tipo = "none";
      temBu = true;
    } else if (c.n === "buChar") {
      bu.tipo = "char";
      bu.char = c.a.char ?? "•";
      temBu = true;
    } else if (c.n === "buAutoNum") {
      bu.tipo = "auto";
      bu.auto = c.a.type ?? "arabicPeriod";
      if (c.a.startAt) bu.startAt = num(c, "startAt");
      temBu = true;
    } else if (c.n === "buFont") {
      bu.font = fonteDe(c.a.typeface, ctx) ?? c.a.typeface;
      temBu = true;
    } else if (c.n === "buClr") {
      bu.cor = resolverCor(c.c[0], ctx);
      temBu = true;
    } else if (c.n === "buSzPct") {
      bu.sizePct = num(c, "val") / 1000;
      temBu = true;
    }
  }
  if (temBu) p.bu = bu;
  p.def = lerRProps(filho(no, "defRPr"), ctx);
  return p;
}

function mesclarR(base: RProps, topo: RProps): RProps {
  const out: RProps = { ...base };
  for (const k of Object.keys(topo) as (keyof RProps)[]) if (topo[k] !== undefined) (out as Record<string, unknown>)[k] = topo[k];
  return out;
}

export function mesclarP(base: PProps, topo: PProps): PProps {
  return {
    marL: topo.marL ?? base.marL,
    indent: topo.indent ?? base.indent,
    algn: topo.algn ?? base.algn,
    lnSpc: topo.lnSpc ?? base.lnSpc,
    spcBef: topo.spcBef ?? base.spcBef,
    spcAft: topo.spcAft ?? base.spcAft,
    bu: topo.bu ? { ...(base.bu ?? {}), ...topo.bu } : base.bu,
    def: mesclarR(base.def, topo.def),
  };
}

/** Propriedades de um nível (lvl1pPr...lvl9pPr) dentro de um lstStyle/txStyles. */
export function nivelDe(lista: No | undefined, lvl: number, ctx: ContextoCor): PProps {
  return lerPProps(filho(lista, `lvl${lvl + 1}pPr`), ctx);
}

export interface OpcoesTexto {
  /** camadas de estilo em ordem crescente de prioridade (padrão da apresentação, estilos do mestre, lstStyle...) */
  camadas: (No | undefined)[];
  /** propriedades de texto vindas de <p:style><a:fontRef> (cor/fonte padrão da forma) */
  fontRef?: RProps;
  /** fator do autoajuste (normAutofit fontScale) e redução de espaçamento (lnSpcReduction) */
  escala?: number;
  reducaoEsp?: number;
  /** número da lâmina, para campos de número de página */
  numeroSlide?: number;
}

/** Converte o corpo de texto (txBody) em parágrafos com tudo explícito. */
export function lerParagrafos(corpo: No | undefined, ctx: ContextoCor, op: OpcoesTexto): Para[] {
  if (!corpo) return [];
  const padraoCor = resolverCor({ n: "schemeClr", a: { val: "tx1" }, c: [], t: "" }, ctx) ?? { hex: "000000", alpha: 1 };
  const escala = op.escala ?? 1;
  const paras: Para[] = [];
  // numeração automática: contador por nível
  const contadores: number[] = [];
  for (const p of filhos(corpo, "p")) {
    const pPr = filho(p, "pPr");
    const lvl = Math.max(0, Math.min(8, num(pPr, "lvl", 0)));
    let efetivo: PProps = { def: op.fontRef ? { ...op.fontRef } : {} };
    for (const camada of op.camadas) efetivo = mesclarP(efetivo, nivelDe(camada, lvl, ctx));
    efetivo = mesclarP(efetivo, lerPProps(pPr, ctx));

    const runs: Run[] = [];
    const base = efetivo.def;
    const montar = (rp: RProps, texto: string, br = false): Run => {
      const m = mesclarR(base, rp);
      const cor = m.cor ?? padraoCor;
      const run: Run = {
        text: texto,
        size: Math.round((m.sz ?? 18) * escala * 100) / 100,
        bold: !!m.b,
        italic: !!m.i,
        underline: !!m.u,
        strike: !!m.strike,
        color: cor.hex,
        font: m.font ?? ctx.tema.fonteMenor,
      };
      if (cor.alpha < 1) run.alpha = cor.alpha;
      if (m.caps) run.caps = true;
      if (m.spc) run.spc = m.spc;
      if (m.baseline) run.baseline = m.baseline;
      if (m.link) run.link = m.link;
      if (br) run.br = true;
      return run;
    };

    for (const e of p.c) {
      if (e.n === "r") {
        const t = filho(e, "t");
        if (t && t.t !== "") runs.push(montar(lerRProps(filho(e, "rPr"), ctx), t.t));
      } else if (e.n === "br") {
        runs.push(montar(lerRProps(filho(e, "rPr"), ctx), "\n", true));
      } else if (e.n === "fld") {
        const tipo = e.a.type ?? "";
        const texto = /slidenum/i.test(tipo) && op.numeroSlide ? String(op.numeroSlide) : (filho(e, "t")?.t ?? "");
        if (texto) runs.push(montar(lerRProps(filho(e, "rPr"), ctx), texto));
      }
    }

    const fim = mesclarR(base, lerRProps(filho(p, "endParaRPr"), ctx));
    const endSize = Math.round((fim.sz ?? base.sz ?? 18) * escala * 100) / 100;

    // marcador
    let bullet: Bullet | undefined;
    const bu = efetivo.bu;
    if (bu && bu.tipo && bu.tipo !== "none" && runs.some((r) => r.text.trim() !== "")) {
      if (bu.tipo === "char") bullet = { char: bu.char ?? "•" };
      else {
        const nivel = lvl;
        contadores.length = nivel + 1;
        contadores[nivel] = (contadores[nivel] ?? (bu.startAt ?? 1) - 1) + 1;
        bullet = { auto: bu.auto ?? "arabicPeriod", startAt: contadores[nivel] };
      }
      if (bu.cor) bullet.color = bu.cor.hex;
      if (bu.sizePct) bullet.sizePct = bu.sizePct;
      if (bu.font) bullet.font = bu.font;
    } else {
      contadores.length = 0;
    }

    const esp = efetivo.lnSpc;
    const redu = op.reducaoEsp ?? 0;
    const lnSpc = esp ? (esp.pct !== undefined ? { pct: Math.max(0.5, esp.pct - redu) } : { pts: (esp.pts ?? 0) * escala }) : undefined;
    const tam = runs[0]?.size ?? endSize;
    const espPts = (e: Esp | undefined): number => (e ? (e.pts !== undefined ? e.pts : (e.pct ?? 0) * tam * 1.2) : 0);

    paras.push({
      runs,
      align: efetivo.algn ?? "esquerda",
      lvl,
      marL: efetivo.marL ?? 0,
      indent: efetivo.indent ?? 0,
      bullet,
      lnSpc,
      spcBef: espPts(efetivo.spcBef),
      spcAft: espPts(efetivo.spcAft),
      endSize,
    });
  }
  return paras;
}

/** Texto puro dos parágrafos (para o campo `text` da forma, a IA e o markdown). */
export function textoPuro(paras: Para[]): string {
  return paras.map((p) => p.runs.map((r) => r.text).join("")).join("\n");
}

/** Estilo de texto do mestre para um tipo de placeholder. */
export function estiloDoMestre(mestre: No | undefined, tipoPh: string | undefined): No | undefined {
  const tx = filho(mestre, "txStyles");
  if (!tx) return undefined;
  if (tipoPh === "title" || tipoPh === "ctrTitle") return filho(tx, "titleStyle");
  if (tipoPh === "dt" || tipoPh === "ftr" || tipoPh === "sldNum" || tipoPh === "hdr") return filho(tx, "otherStyle");
  return filho(tx, "bodyStyle");
}

export { caminho };
