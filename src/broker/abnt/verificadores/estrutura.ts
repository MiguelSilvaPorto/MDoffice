// Verificadores de ESTRUTURA do trabalho (NBR 14724 e 15287).
//
// Regras que usam este arquivo: E01 (pré-textuais obrigatórios), E02 (ordem
// pré → textual → pós), E03 (introdução/desenvolvimento/conclusão), P01 (seções do
// projeto de pesquisa).
//
// Contrato em ./tipos.ts. Documento, âncoras e parâmetros: docs/abnt-como-escrever-regras.md.
// Preencha o mapa abaixo; não mexa em ./index.ts.

import type { Verificador } from "./tipos";

export const VERIFICADORES: Record<string, Verificador> = {};
