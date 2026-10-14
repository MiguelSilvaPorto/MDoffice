// Verificadores da LISTA de referências (NBR 6023) — a lista como um todo.
//
// Regras que usam este arquivo: R01 (a lista existe), R02 (ordem alfabética pela chave
// do primeiro sobrenome), R11 (citação ↔ referência, o cruzamento), R12 (destaque
// tipográfico uniforme no mesmo campo).
//
// Contrato em ./tipos.ts. Documento, âncoras e parâmetros: docs/abnt-como-escrever-regras.md.
// Preencha o mapa abaixo; não mexa em ./index.ts.
//
// Atenção: o arquivo ./referencias-tipos.ts é de outro trabalho (as regras R03–R10,
// que olham a FORMA de cada tipo de referência). Não misture os dois.

import type { Verificador } from "./tipos";

export const VERIFICADORES: Record<string, Verificador> = {};
