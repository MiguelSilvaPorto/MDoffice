// ABNT — o registro dos verificadores, montado por grupo.
//
// Cada grupo tem o seu arquivo (quem escreve os verificadores mexe SÓ no seu); este
// agrega. O nome usado no TOML (`verifica = "…"`) precisa existir aqui — e a carga
// recusa a regra quando não existe, com a lista dos nomes conhecidos.

import { VERIFICADORES as estrutura } from "./estrutura";
import { VERIFICADORES as numeracao } from "./numeracao";
import { VERIFICADORES as resumo } from "./resumo";
import { VERIFICADORES as citacoes } from "./citacoes";
import { VERIFICADORES as referencias } from "./referencias";
import { VERIFICADORES as referenciasTipos } from "./referencias-tipos";
import { VERIFICADORES as tabelas } from "./tabelas";
import type { Verificador } from "./tipos";

export const VERIFICADORES: Record<string, Verificador> = {
  ...estrutura,
  ...numeracao,
  ...resumo,
  ...citacoes,
  ...referencias,
  ...referenciasTipos,
  ...tabelas,
};

/** O verificador pedido — erro com a lista dos conhecidos quando não existe. */
export function verificador(nome: string): Verificador {
  const impl = VERIFICADORES[nome];
  if (!impl) {
    const conhecidos = Object.keys(VERIFICADORES);
    throw new Error(`verificador desconhecido: ${nome} (conhecidos: ${conhecidos.join(", ") || "nenhum"})`);
  }
  return impl;
}

export type { Aviso, Verificador } from "./tipos";
