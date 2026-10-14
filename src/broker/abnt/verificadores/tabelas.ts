// Verificadores de TABELAS e FIGURAS (normas IBGE e NBR 14724).
//
// Regras que usam este arquivo: T01 (título acima da tabela / "Fonte:" abaixo),
// T02 (figura: legenda acima, fonte abaixo), E11 (listas só com itens existentes).
//
// Contrato em ./tipos.ts. Documento, âncoras e parâmetros: docs/abnt-como-escrever-regras.md.
// Preencha o mapa abaixo; não mexa em ./index.ts.

import type { Verificador } from "./tipos";

export const VERIFICADORES: Record<string, Verificador> = {};
