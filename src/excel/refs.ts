// Referências A1 <-> (linha, coluna). É o mesmo esquema do Excel: colunas em
// letras (A..Z, depois AA, AB…), linhas começando em 1. Tudo que precisa falar
// "célula B4" — a grade, as fórmulas e o .xlsx — passa por aqui.

import { COLUNA_PX, LINHA_PX, LIMITE_COLUNAS, LIMITE_LINHAS } from "./schema";

/** 0 -> "A", 25 -> "Z", 26 -> "AA". */
export function nomeColuna(i: number): string {
  let s = "";
  let n = Math.max(0, Math.floor(i));
  for (;;) {
    s = String.fromCharCode(65 + (n % 26)) + s;
    n = Math.floor(n / 26) - 1;
    if (n < 0) break;
  }
  return s;
}

/** "A" -> 0, "Z" -> 25, "AA" -> 26. Devolve -1 quando o nome não é válido. */
export function indiceColuna(nome: string): number {
  const limpo = nome.toUpperCase().replace(/[^A-Z]/g, "");
  if (!limpo || limpo.length > 3) return -1;
  let n = 0;
  for (const ch of limpo) {
    const c = ch.charCodeAt(0) - 64;
    if (c < 1 || c > 26) return -1;
    n = n * 26 + c;
  }
  return n - 1;
}

/** (linha, coluna) 0-based -> "B4". */
export function ref(linha: number, col: number): string {
  return `${nomeColuna(col)}${linha + 1}`;
}

/** "B4" -> { linha: 3, col: 1 }; null quando não é uma referência. */
export function partes(refA1: string): { linha: number; col: number } | null {
  const m = /^([A-Za-z]{1,3})(\d{1,7})$/.exec(refA1.trim());
  if (!m) return null;
  const col = indiceColuna(m[1]);
  const linha = parseInt(m[2], 10) - 1;
  // XFE1 (coluna 16385) existe na regex, mas não na planilha do Excel
  if (col < 0 || col >= LIMITE_COLUNAS || linha < 0 || linha >= LIMITE_LINHAS) return null;
  return { linha, col };
}

/** Retângulo de células, sempre normalizado (linha/coluna iniciais menores que as finais). */
export interface Intervalo {
  l1: number;
  c1: number;
  l2: number;
  c2: number;
}

/** "A1:C5" (ou só "A1") -> retângulo normalizado. */
export function intervalo(refOuFaixa: string): Intervalo | null {
  const partesFaixa = refOuFaixa.split(":");
  const a = partes(partesFaixa[0]);
  if (!a) return null;
  const b = partes(partesFaixa[1] ?? partesFaixa[0]);
  if (!b) return null;
  return {
    l1: Math.min(a.linha, b.linha),
    c1: Math.min(a.col, b.col),
    l2: Math.max(a.linha, b.linha),
    c2: Math.max(a.col, b.col),
  };
}

/** Junta duas células num retângulo que as cobre. */
export function junta(a: Intervalo, b: Intervalo): Intervalo {
  return {
    l1: Math.min(a.l1, b.l1),
    c1: Math.min(a.c1, b.c1),
    l2: Math.max(a.l2, b.l2),
    c2: Math.max(a.c2, b.c2),
  };
}

/** "A1:C5" (a partir de dois cantos) — o que aparece na barra de fórmulas. */
export function faixa(a: Intervalo): string {
  const ini = ref(a.l1, a.c1);
  const fim = ref(a.l2, a.c2);
  return a.l1 === a.l2 && a.c1 === a.c2 ? ini : `${ini}:${fim}`;
}

/** Verifica se a célula está dentro do retângulo. */
export function dentro(a: Intervalo, linha: number, col: number): boolean {
  return linha >= a.l1 && linha <= a.l2 && col >= a.c1 && col <= a.c2;
}

/** Percorre o retângulo linha a linha (a ordem que o Excel entrega ao Ctrl+C). */
export function* percorrer(a: Intervalo): Generator<{ linha: number; col: number }> {
  for (let l = a.l1; l <= a.l2; l++) for (let c = a.c1; c <= a.c2; c++) yield { linha: l, col: c };
}

// ---------- medidas (px) ----------

/** Largura da coluna: a que foi ajustada na aba ou a padrão. */
export function larguraColuna(colunas: Record<number, number>, col: number, padrao: number): number {
  const w = colunas[col];
  return w && w > 0 ? w : padrao;
}

/** Altura da linha: a que foi ajustada na aba ou a padrão. */
export function alturaLinha(linhas: Record<number, number>, linha: number, padrao: number): number {
  const h = linhas[linha];
  return h && h > 0 ? h : padrao;
}

/** Soma das larguras das colunas de 0 até `ate` (inclusivo). */
export function somaLarguras(colunas: Record<number, number>, ate: number, padrao: number): number {
  return somaMedidas(colunas, ate, padrao);
}

/** Soma das alturas das linhas de 0 até `ate` (inclusivo). */
export function somaAlturas(linhas: Record<number, number>, ate: number, padrao: number): number {
  return somaMedidas(linhas, ate, padrao);
}

/**
 * Soma de medidas (largura ou altura) de 0 até `ate`.
 *
 * Como a grade é "infinita", varrer linha a linha seria impensável: quase tudo usa
 * o tamanho padrão e só algumas linhas/colunas foram ajustadas à mão. Por isso o
 * cálculo é `quantidade × padrão` mais a diferença das medidas personalizadas —
 * proporcional a quantas linhas/colunas você ajustou, não ao tamanho da grade.
 */
function somaMedidas(medidas: Record<number, number>, ate: number, padrao: number): number {
  if (ate < 0) return 0;
  let total = (ate + 1) * padrao;
  for (const chave of Object.keys(medidas)) {
    const i = Number(chave);
    if (i <= ate && i >= 0) {
      const v = medidas[i];
      if (v > 0 && v !== padrao) total += v - padrao;
    }
  }
  return total;
}

/**
 * Índice da linha/coluna que contém a posição `pos` (em px, sem zoom).
 * Busca binária sobre a soma esparsa — funciona na grade infinita sem varrer tudo.
 */
export function indiceEm(medidas: Record<number, number>, pos: number, padrao: number, max: number): number {
  if (pos <= 0) return 0;
  let lo = 0;
  let hi = Math.max(0, max - 1);
  while (lo < hi) {
    const meio = (lo + hi + 1) >> 1;
    if (somaMedidas(medidas, meio - 1, padrao) <= pos) lo = meio;
    else hi = meio - 1;
  }
  return lo;
}

/** Índice (em px) da coluna — usado para posicionar a seleção sobre a grade. */
export function xColuna(colunas: Record<number, number>, col: number, padrao: number): number {
  return somaLarguras(colunas, col - 1, padrao);
}

/** Índice (em px) da linha. */
export function yLinha(linhas: Record<number, number>, linha: number, padrao: number): number {
  return somaAlturas(linhas, linha - 1, padrao);
}

/**
 * Desloca as referências RELATIVAS de uma fórmula (o que o Excel faz quando se
 * arrasta a alça de preenchimento). As referências com "$" ficam presas:
 *   "=C2*D$1" andando uma linha para baixo -> "=C3*D$1"
 * O texto entre aspas é preservado como está.
 */
export function deslocarFormula(formula: string, dLinha: number, dCol: number): string {
  if (!dLinha && !dCol) return formula;
  return mapearReferencias(formula, (col, lin, colFixa, linFixa) => {
    const novaCol = colFixa ? col : col + dCol;
    const novaLin = linFixa ? lin : lin + dLinha;
    if (novaCol < 0 || novaLin < 0) return "#REF!";
    return `${colFixa ? "$" : ""}${nomeColuna(novaCol)}${linFixa ? "$" : ""}${novaLin + 1}`;
  });
}

/**
 * Ajusta as referências quando uma linha/coluna é inserida ou excluída.
 * `inicio` e `qtd` são 0-based; `modo` decide se as referências a partir de
 * `inicio` descem (inserir) ou se as que estavam na faixa viram `#REF!` (excluir).
 */
export function ajustarFormula(
  formula: string,
  eixo: "linha" | "coluna",
  inicio: number,
  qtd: number,
  modo: "inserir" | "excluir"
): string {
  return mapearReferencias(formula, (col, lin, colFixa, linFixa) => {
    let nc = col;
    let nl = lin;
    const alvo = eixo === "linha" ? lin : col;
    if (modo === "inserir") {
      if (alvo >= inicio) {
        if (eixo === "linha") nl += qtd;
        else nc += qtd;
      }
    } else if (alvo >= inicio && alvo < inicio + qtd) {
      return "#REF!";
    } else if (alvo >= inicio + qtd) {
      if (eixo === "linha") nl -= qtd;
      else nc -= qtd;
    }
    if (nc < 0 || nl < 0) return "#REF!";
    return `${colFixa ? "$" : ""}${nomeColuna(nc)}${linFixa ? "$" : ""}${nl + 1}`;
  });
}

/** Percorre as referências A1 de uma fórmula (fora de texto entre aspas) e troca cada uma. */
function mapearReferencias(
  formula: string,
  trocar: (col: number, lin: number, colFixa: boolean, linFixa: boolean) => string
): string {
  let saida = "";
  let i = 0;
  while (i < formula.length) {
    const c = formula[i];
    // texto entre aspas: copia inteiro, sem mexer nas referências de dentro
    if (c === '"') {
      let j = i + 1;
      while (j < formula.length) {
        if (formula[j] === '"') {
          if (formula[j + 1] === '"') {
            j += 2;
            continue;
          }
          break;
        }
        j++;
      }
      saida += formula.slice(i, Math.min(j + 1, formula.length));
      i = Math.min(j + 1, formula.length);
      continue;
    }
    // referência: $A$1, A$1, $A1, A1 (mas não o nome de uma função como LOG10()
    const m = /^(\$?)([A-Za-z]{1,3})(\$?)(\d{1,7})/.exec(formula.slice(i));
    const depois = formula[i + (m?.[0].length ?? 0)] ?? "";
    if (m && depois !== "(" && !/[A-Za-z0-9_$]/.test(formula[i - 1] ?? "")) {
      const colFixa = m[1] === "$";
      const linFixa = m[3] === "$";
      const col = indiceColuna(m[2]);
      const lin = parseInt(m[4], 10) - 1;
      if (col >= 0 && lin >= 0) {
        saida += trocar(col, lin, colFixa, linFixa);
        i += m[0].length;
        continue;
      }
    }
    saida += c;
    i++;
  }
  return saida;
}

export { COLUNA_PX, LINHA_PX };