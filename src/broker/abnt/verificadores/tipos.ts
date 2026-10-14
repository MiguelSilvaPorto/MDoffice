// ABNT — o contrato dos verificadores: as regras que olham o documento, não um padrão.
//
// Regra de `texto` responde "onde casa este padrão"; o verificador responde "o documento
// está assim?" (a ordem das seções, a numeração, a extensão do resumo, a ordem
// alfabética da lista de referências). O que os dois têm em comum é a SAÍDA: avisos com
// trecho, mensagem e (quando souber) a correção — e é isso que o app mostra.
//
// O verificador é o julgamento que não cabe em dado; a DECLARAÇÃO da regra (id, norma,
// severidade, parâmetros) continua sendo dado, no TOML, com `tipo = "estrutura"`.

import type { Documento } from "../documento";
import type { RegraToml } from "../esquema";

export interface Aviso {
  /** trecho acusado — precisa ter conteúdo: aviso de trecho vazio é descartado pelo motor */
  from: number;
  to: number;
  mensagem: string;
  fix?: string;
  sugestoes?: string[];
  /** sobrepõe o `auto` da regra quando o verificador sabe de algum caso particular */
  auto?: boolean;
}

export type Verificador = (doc: Documento, regra: RegraToml) => Aviso[];

/** Um parâmetro de `opcoes` que veio do TOML, com o tipo conferido. */
export function opcaoTexto(regra: RegraToml, nome: string, padrao?: string): string {
  const valor = regra.opcoes?.[nome];
  if (typeof valor === "string") return valor;
  if (padrao !== undefined) return padrao;
  throw new Error(`regra ${regra.id}: a opção "${nome}" é obrigatória e não veio`);
}

export function opcaoLista(regra: RegraToml, nome: string, padrao?: string[]): string[] {
  const valor = regra.opcoes?.[nome];
  if (Array.isArray(valor) && valor.every((x) => typeof x === "string")) return valor as string[];
  if (padrao !== undefined) return padrao;
  throw new Error(`regra ${regra.id}: a opção "${nome}" é obrigatória e não veio`);
}

export function opcaoNumero(regra: RegraToml, nome: string, padrao?: number): number {
  const valor = regra.opcoes?.[nome];
  if (typeof valor === "number") return valor;
  if (padrao !== undefined) return padrao;
  throw new Error(`regra ${regra.id}: a opção "${nome}" é obrigatória e não veio`);
}
