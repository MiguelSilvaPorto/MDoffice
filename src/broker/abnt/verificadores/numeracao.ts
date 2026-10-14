// Verificadores de SUMÁRIO e NUMERAÇÃO (NBR 6027 e NBR 6024).
//
// Regras que usam este arquivo: S01 (sumário bate com os títulos), S02 (pré-textuais
// fora do sumário), S03 (numeração decimal progressiva), S04 (sem seção filha única).
//
// Contrato em ./tipos.ts. Documento, âncoras e parâmetros: docs/abnt-como-escrever-regras.md.
// Preencha o mapa abaixo; não mexa em ./index.ts.

import type { Verificador } from "./tipos";

export const VERIFICADORES: Record<string, Verificador> = {};
