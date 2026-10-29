// Texto da célula <-> valor: números em português (1.234,56), datas, moeda e
// porcentagem. Também sabe formatar o valor como o Excel mostra na tela.

import type { ConfigPlanilha, Estilo, FormatoNumero } from "./schema";

/** Valor de uma célula dentro do motor: número, texto, booleano ou vazio. */
export type Valor = number | string | boolean | null;

/** Erros que o Excel também mostra dentro da célula (#DIV/0!, #VALOR!…). */
export class ErroFormula {
  readonly codigo: string;
  constructor(codigo: string) {
    this.codigo = codigo;
  }
  toString(): string {
    return this.codigo;
  }
}

export const ehErro = (v: unknown): v is ErroFormula => v instanceof ErroFormula;

const RE_DATA_BR = /^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/;
const RE_DATA_HORA = /^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?$/;
const RE_DATA_ISO = /^(\d{4})-(\d{1,2})-(\d{1,2})$/;
const RE_NUMERO_LIMPO = /^[+\-]?\d+(\.\d+)?$/;
const RE_MOEDA = /^(?:R\$|US\$|\$|€|£)\s*/i;
const RE_MOEDA_FIM = /\s*(?:R\$|US\$|\$|€|£)$/i;

/**
 * Converte o que o usuário digitou em número, ou devolve null quando não é número.
 * Aceita o jeito do Excel em português: "R$ 1.234,56", "15%", "1.234", "-12,5".
 *
 * A regra é **estrita**: o texto inteiro precisa ser um número (com moeda, %, ou
 * parênteses de negativo). Antes a função arrancava qualquer letra em volta, e
 * "Item 1" virava 1, "01/01/2026" virava 1012026 e "1/2" virava 12 — datas e
 * textos apareciam como números na grade.
 */
export function numeroDe(texto: string): number | null {
  let s = texto.trim();
  if (!s) return null;

  // (100) é a forma contábil de -100
  const parenteses = /^\((.*)\)$/.exec(s);
  let sinal = 1;
  if (parenteses) {
    s = parenteses[1].trim();
    sinal = -1;
  }

  if (/%\s*$/.test(s)) s = s.replace(/%\s*$/, "").trim();
  // "-R$ 10" também é moeda: o sinal vem antes do símbolo
  s = s.replace(/^([+-]?)\s*(?:R\$|US\$|\$|€|£)\s*/i, "$1").trim();
  s = s.replace(RE_MOEDA, "").trim();
  s = s.replace(RE_MOEDA_FIM, "").trim();
  if (!s || !/\d/.test(s)) return null;
  // só dígitos, sinais, separadores e espaços de milhar: qualquer letra, "/" ou ":"
  // significa que é texto/data, não número
  if (!/^[+\-]?[\d.,\s]+$/.test(s) || /[\/:]/.test(s)) return null;
  s = s.replace(/\s+/g, "");

  const temPonto = s.includes(".");
  const temVirgula = s.includes(",");
  let normal: string;
  if (temPonto && temVirgula) {
    // o separador que aparece por último é o decimal: 1.234,56 ou 1,234.56
    normal =
      s.lastIndexOf(",") > s.lastIndexOf(".")
        ? s.replace(/\./g, "").replace(",", ".")
        : s.replace(/,/g, "");
  } else if (temVirgula) {
    // vírgula é o decimal; mais de uma vírgula só pode ser milhar (raro)
    const partes = s.split(",");
    normal = partes.length > 2 ? `${partes.slice(0, -1).join("")}.${partes[partes.length - 1]}` : s.replace(",", ".");
  } else if (temPonto) {
    const partes = s.split(".");
    const inteiro = partes[0].replace(/^[+\-]/, "");
    const ultimo = partes[partes.length - 1] ?? "";
    // "1.234" é milhar; "0.125" e "1.23" são decimais (o Excel aceita o ponto)
    normal =
      partes.length > 2 || (partes.length === 2 && ultimo.length === 3 && inteiro !== "" && inteiro !== "0")
        ? s.replace(/\./g, "")
        : s;
  } else {
    normal = s;
  }

  if (!RE_NUMERO_LIMPO.test(normal)) return null;
  const n = Number(normal);
  return Number.isFinite(n) ? n * sinal : null;
}

/** true quando o texto é uma data que o Excel reconhece (dd/mm/aaaa ou aaaa-mm-dd). */
export function dataDe(texto: string): Date | null {
  const s = texto.trim();
  let m = RE_DATA_HORA.exec(s);
  if (m) {
    const d = montarData(+m[3], +m[2], +m[1]);
    if (!d) return null;
    d.setUTCHours(Math.min(23, +m[4]), Math.min(59, +m[5]), m[6] ? +m[6] : 0, 0);
    return d;
  }
  m = RE_DATA_BR.exec(s);
  if (m) return montarData(+m[3], +m[2], +m[1]);
  m = RE_DATA_ISO.exec(s);
  if (m) return montarData(+m[1], +m[2], +m[3]);
  return null;
}

/** Ano de 2 dígitos vira 20xx quando pequeno (o Excel faz o mesmo). */
function montarData(ano: number, mes: number, dia: number): Date | null {
  let a = ano;
  if (a < 100) a += a < 30 ? 2000 : 1900;
  if (mes < 1 || mes > 12 || dia < 1 || dia > 31) return null;
  const d = new Date(Date.UTC(a, mes - 1, dia));
  // "31/02" não existe: confere se o dia não estourou o mês
  if (d.getUTCDate() !== dia || d.getUTCMonth() !== mes - 1) return null;
  return d;
}

/** true quando o texto termina em % (o Excel guarda 0,15 e mostra 15%). */
export const ehPercentual = (texto: string): boolean =>
  /^(?:R\$|US\$|\$|€|£)?\s*[+-]?[\d][\d.,\s]*%\s*$/i.test(texto.trim());

/**
 * Número vindo do XML do .xlsx (sempre com ponto decimal, sem milhar) para a
 * representação interna em português. Sem isso, "0.125" era lido como 125 pela
 * regra pt-BR e "1.234" virava mil duzentos e trinta e quatro.
 */
export function numeroDoXml(bruto: string): string {
  const n = Number(bruto.trim());
  if (!Number.isFinite(n)) return bruto;
  return n.toLocaleString("pt-BR", { maximumFractionDigits: 10, useGrouping: false });
}

/** true quando o texto começa com o símbolo da moeda. */
export const ehMoeda = (texto: string, moeda: string): boolean => {
  const s = texto.trim().replace(/^[+-]\s*/, "");
  return moeda.length > 0 && s.toUpperCase().startsWith(moeda.toUpperCase());
};

/** true quando o texto é VERDADEIRO/FALSO (o Excel em português). */
export function booleanoDe(texto: string): boolean | null {
  const s = texto.trim().toUpperCase();
  if (s === "VERDADEIRO" || s === "TRUE") return true;
  if (s === "FALSO" || s === "FALSE") return false;
  return null;
}

// ---------- serial de data (o mesmo dos dias desde 1899-12-30 que o Excel usa) ----------

const DIA_MS = 86_400_000;
const BASE_EPOCA_ZERO = Date.UTC(1899, 11, 30);
const BASE_EPOCA_UM = Date.UTC(1899, 11, 31);

/** Data -> número que o Excel grava na célula (a formatação "data" mostra como data). */
export function dataParaSerial(d: Date): number {
  const dias = (Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) - BASE_EPOCA_ZERO) / DIA_MS;
  // Antes de 1900-03-01 o Excel desconta o dia 29/02/1900 que ele finge existir.
  const base = Math.round(dias >= 61 ? dias : dias - 1);
  // a hora vira a fração do dia (o Excel guarda data e hora no mesmo serial)
  const frac = (d.getUTCHours() * 3600 + d.getUTCMinutes() * 60 + d.getUTCSeconds()) / 86_400;
  return base + frac;
}

/** Número do Excel -> Date (o serial 60 é o 29/02/1900 que não existe). */
export function serialParaData(serial: number): Date | null {
  if (!Number.isFinite(serial)) return null;
  const n = Math.floor(serial);
  if (n === 60) return new Date(Date.UTC(1900, 1, 28));
  return new Date((n >= 61 ? BASE_EPOCA_ZERO : BASE_EPOCA_UM) + n * DIA_MS);
}

/** Serial com parte de hora: dia inteiro + fração do dia. */
export function serialParaDataHora(serial: number): Date | null {
  const d = serialParaData(Math.floor(serial));
  if (!d) return null;
  const frac = serial - Math.floor(serial);
  d.setUTCHours(0, 0, 0, 0);
  d.setTime(d.getTime() + Math.round(frac * DIA_MS));
  return d;
}

// ---------- formatação (como o Excel mostra na tela) ----------

/** Casas decimais: as da célula ou, na falta, as da configuração do livro. */
export function casasDe(estilo: Estilo | undefined, cfg: ConfigPlanilha): number {
  const n = estilo?.casas;
  return typeof n === "number" && n >= 0 && n <= 10 ? n : cfg.casas;
}

const comCasas = (n: number, c: number): string =>
  n.toLocaleString("pt-BR", { minimumFractionDigits: c, maximumFractionDigits: c });

const dataEmTexto = (serial: number, comHora: boolean): string => {
  const d = serialParaDataHora(serial);
  if (!d) return "";
  const dia = String(d.getUTCDate()).padStart(2, "0");
  const mes = String(d.getUTCMonth() + 1).padStart(2, "0");
  const base = `${dia}/${mes}/${d.getUTCFullYear()}`;
  if (!comHora) return base;
  return `${base} ${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`;
};

/** Formata um número conforme o formato da célula. */
export function formatarNumero(n: number, formato: FormatoNumero, c: number, moeda: string): string {
  switch (formato) {
    case "decimal":
      return comCasas(n, c);
    case "moeda":
      return `${moeda} ${comCasas(n, c)}`.trim();
    case "porcento":
      return `${comCasas(n * 100, c)}%`;
    case "data":
      return n % 1 === 0 ? dataEmTexto(n, false) : dataEmTexto(n, true);
    default:
      // "geral": inteiros sem casas, fracionários com o que tiver (até 10 casas)
      return Number.isInteger(n)
        ? n.toLocaleString("pt-BR", { maximumFractionDigits: 0 })
        : n.toLocaleString("pt-BR", { maximumFractionDigits: 10 });
  }
}

/** Texto que aparece dentro da célula (diferente do texto cru que se edita). */
export function valorParaTexto(v: Valor, estilo: Estilo | undefined, cfg: ConfigPlanilha): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "boolean") return v ? "VERDADEIRO" : "FALSO";
  if (typeof v === "number") return formatarNumero(v, estilo?.numero ?? "geral", casasDe(estilo, cfg), cfg.moeda);
  return v;
}