// Verificadores de CITAÇÕES (NBR 10520).
//
// Regras que usam este arquivo: C04 (citação direta longa em bloco). C01, C03 e C06 são
// regras de texto (TOML); aqui entra só o que precisa do documento.
//
// Contrato em ./tipos.ts. Documento, âncoras e parâmetros: docs/abnt-como-escrever-regras.md.
// Preencha o mapa abaixo; não mexa em ./index.ts.

import type { Verificador } from "./tipos";

export const VERIFICADORES: Record<string, Verificador> = {};
