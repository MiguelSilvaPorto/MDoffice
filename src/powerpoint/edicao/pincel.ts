// Pincel de formatação ("Copiar formatação"): leva a PINTURA de uma forma para outra — preenchimento,
// contorno, sombra, transparência, a receita do estilo vivo e o formato do texto —, sem tocar no que é
// do alvo: geometria, caixa, giro, texto, mídia e tabela continuam como estavam (como no Pincel de
// Formatação do PowerPoint, que copia o formato, não o conteúdo nem o lugar).
import type { EstiloForma, Fill, Line, Para, Run, Shadow, Shape } from "../schema";
import { comLinha, comOpacidade, comPreenchimento, comSombra } from "./formato";

/** O formato de um trecho de texto, sem o texto em si. */
type FormatoTrecho = Pick<Run, "size" | "bold" | "italic" | "underline" | "strike" | "color" | "font" | "caps" | "spc" | "baseline" | "highlight" | "alpha">;

/** O formato de um parágrafo, sem os trechos (listas, recuos, espaçamentos). */
type FormatoParagrafo = Pick<Para, "align" | "lvl" | "marL" | "indent" | "bullet" | "lnSpc" | "spcBef" | "spcAft" | "endSize">;

/** O que o pincel leva de uma forma para a outra. */
export interface FormatoPincel {
  fill: Fill;
  ln: Line | null;
  shadow: Shadow | null;
  opacity: number;
  /** a receita do estilo vivo; sem ela o alvo solta o estilo e a pintura fica dona */
  estilo?: EstiloForma;
  /** o formato que o texto novo herda (fonte, tamanho, cor, negrito/itálico e alinhamento) */
  texto: Pick<Shape, "fontFamily" | "fontSize" | "color" | "bold" | "italic" | "align">;
  /** o formato do texto já escrito (o primeiro trecho é o modelo) */
  trecho?: FormatoTrecho;
  /** o formato do primeiro parágrafo (o modelo dos demais) */
  paragrafo?: FormatoParagrafo;
}

/** Cópia profunda: o formato copiado não pode ser mexido depois pela forma de origem. */
const copia = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

/** O preenchimento da forma: o campo rico quando existe; senão o simples (`fill` vazio = sem preenchimento). */
function preenchimento(f: Shape): Fill {
  if (f.fillX) return copia(f.fillX);
  return f.fill ? { kind: "solid", color: f.fill } : { kind: "none" };
}

/** Copia o formato da forma (a origem do pincel). */
export function copiarFormato(f: Shape): FormatoPincel {
  const runs = f.paras?.flatMap((p) => p.runs).filter((r) => !r.br) ?? [];
  const run = runs[0];
  const para = f.paras?.[0];
  return {
    fill: preenchimento(f),
    ln: f.ln ? copia(f.ln) : null,
    shadow: f.shadow ? copia(f.shadow) : null,
    opacity: f.opacity ?? 1,
    estilo: f.estilo ? copia(f.estilo) : undefined,
    texto: { fontFamily: f.fontFamily, fontSize: f.fontSize, color: f.color, bold: f.bold, italic: f.italic, align: f.align },
    trecho: run
      ? {
          size: run.size,
          bold: run.bold,
          italic: run.italic,
          underline: run.underline,
          strike: run.strike,
          color: run.color,
          font: run.font,
          caps: run.caps,
          spc: run.spc,
          baseline: run.baseline,
          highlight: run.highlight,
          alpha: run.alpha,
        }
      : undefined,
    paragrafo: para
      ? {
          align: para.align,
          lvl: para.lvl,
          marL: para.marL,
          indent: para.indent,
          bullet: para.bullet ? copia(para.bullet) : undefined,
          lnSpc: para.lnSpc ? copia(para.lnSpc) : undefined,
          spcBef: para.spcBef,
          spcAft: para.spcAft,
          endSize: para.endSize,
        }
      : undefined,
  };
}

/**
 * O texto do alvo veste o formato copiado: cada parágrafo recebe o modelo do primeiro e cada trecho
 * recebe o do primeiro trecho — as quebras de linha ficam (são do texto, não do formato).
 */
function textoComFormato(paras: Para[], fmt: FormatoPincel): Para[] {
  return paras.map((p) => ({
    ...p,
    ...fmt.paragrafo,
    runs: p.runs.map((r) => (r.br ? r : { ...r, ...fmt.trecho })),
  }));
}

/**
 * Aplica o formato copiado à forma alvo. O que é do alvo fica: a caixa, o giro, o texto, os links, a
 * mídia e a tabela. Sem uma receita de estilo na cópia, o estilo vivo do alvo é solto (a pintura fica
 * dona, como nas outras pinturas manuais) e a dobra derivada dele sai junto.
 */
export function aplicarFormato(alvo: Shape, fmt: FormatoPincel): Shape {
  let n = comPreenchimento(alvo, copia(fmt.fill));
  n = comLinha(n, null);
  if (fmt.ln) n = comLinha(n, copia(fmt.ln));
  n = comSombra(n, fmt.shadow ? copia(fmt.shadow) : null);
  n = comOpacidade(n, fmt.opacity);
  n = { ...n, ...fmt.texto, paras: alvo.paras ? textoComFormato(alvo.paras, fmt) : alvo.paras };
  if (fmt.estilo) n.estilo = copia(fmt.estilo);
  else {
    delete n.estilo;
    delete n.capa;
  }
  return n;
}
