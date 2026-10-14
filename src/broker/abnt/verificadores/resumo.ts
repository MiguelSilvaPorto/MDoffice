// Verificadores do RESUMO e do ABSTRACT (NBR 6028 e NBR 14724).
//
// Regras que usam este arquivo: E09 (extensão do resumo), E10 (abstract presente),
// A01 (extensão 150–500 palavras), A02 (palavras-chave), A03 (resumo sem citação).
//
// Contrato em ./tipos.ts. Documento, âncoras e parâmetros: docs/abnt-como-escrever-regras.md.
// Preencha o mapa abaixo; não mexa em ./index.ts.

import type { Verificador } from "./tipos";

export const VERIFICADORES: Record<string, Verificador> = {};
