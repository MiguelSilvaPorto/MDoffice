// Verificadores da FORMA de cada tipo de referência (NBR 6023) — R03 a R10.
//
// A maior parte de R03–R10 são regras de TEXTO no bloco `referencias` (ver
// `src/broker/abnt/regras/`); este arquivo é para o que precisar do documento (por
// exemplo, olhar a entrada inteira de um tipo e cobrar os dados que faltam).
//
// Contrato em ./tipos.ts. Documento, âncoras e parâmetros: docs/abnt-como-escrever-regras.md.
// Preencha o mapa abaixo; não mexa em ./index.ts.
//
// Atenção: o arquivo ./referencias.ts é de outro trabalho (R01, R02, R11, R12).

import type { Verificador } from "./tipos";

export const VERIFICADORES: Record<string, Verificador> = {};
