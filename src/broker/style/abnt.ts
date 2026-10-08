// Regras da ABNT e tipografia brasileira.

import type { RuleCtx } from "./types";

export function abntHours({ mask, push }: RuleCtx): void {
  let m: RegExpExecArray | null;
  // 1. Horas no padrão ABNT (14h, 14h30)
  const horasHsRx = /(?<![\p{L}\d])(\d{1,2})\s*(hs|hrs)(?![\p{L}\d])/giu;
  while ((m = horasHsRx.exec(mask)) !== null) {
    const hora = m[1];
    push(
      m.index,
      m.index + m[0].length,
      `[ABNT] O símbolo de horas é apenas “h” (use “${hora}h”, evite “${m[2]}”)`,
      `${hora}h`,
      [`${hora}h`],
      true
    );
  }
}

export function abntHoursColon({ mask, push }: RuleCtx): void {
  let m: RegExpExecArray | null;
  const horasDoisPontosRx = /(?<![\p{L}\d])(\d{1,2}):(\d{2})\s*(?:hs?|hrs)(?![\p{L}\d])/giu;
  while ((m = horasDoisPontosRx.exec(mask)) !== null) {
    const fix = `${m[1]}h${m[2]}`;
    push(
      m.index,
      m.index + m[0].length,
      `[ABNT] No padrão brasileiro use “${fix}”`,
      fix,
      [fix],
      true
    );
  }
}

export function abntUnits({ mask, push }: RuleCtx): void {
  let m: RegExpExecArray | null;
  // 2. Espaço obrigatório entre número e unidade de medida (ABNT / IBGE)
  const unidadesRx = /(?<![\p{L}\d#])(\d+(?:[.,]\d+)?)(km|kg|cm|mm|mg|ml|min|kb|mb|gb|tb|khz|mhz|ghz|[º°]c)\b/giu;
  while ((m = unidadesRx.exec(mask)) !== null) {
    const num = m[1];
    let unit = m[2];
    if (/[º°]c/i.test(unit)) unit = "°C";
    const fix = `${num} ${unit}`;
    push(
      m.index,
      m.index + m[0].length,
      `[ABNT/IBGE] Espaço obrigatório entre número e unidade: “${fix}”`,
      fix,
      [fix],
      true
    );
  }
}

export function abntMonths({ mask, push }: RuleCtx): void {
  let m: RegExpExecArray | null;
  // 3. Meses com letra minúscula em datas (ABNT / Gramática pt-BR)
  const dataMesRx = /(?<![\p{L}])(\d{1,2})\s+de\s+(Janeiro|Fevereiro|Março|Abril|Maio|Junho|Julho|Agosto|Setembro|Outubro|Novembro|Dezembro)(?![\p{L}])/gu;
  while ((m = dataMesRx.exec(mask)) !== null) {
    const dia = m[1];
    const mesMin = m[2].toLowerCase();
    const fix = `${dia} de ${mesMin}`;
    push(
      m.index,
      m.index + m[0].length,
      `[ABNT] Meses do ano são grafados com inicial minúscula: “${mesMin}”`,
      fix,
      [fix],
      true
    );
  }
}

export function abntAcronymPlural({ mask, push }: RuleCtx): void {
  let m: RegExpExecArray | null;
  // 4. Plural de siglas em português (sem apóstrofo)
  const siglasPluralRx = /(?<![\p{L}])([A-ZÁÉÍÓÚ]{2,})'s(?![\p{L}])/gu;
  while ((m = siglasPluralRx.exec(mask)) !== null) {
    const fix = `${m[1]}s`;
    push(
      m.index,
      m.index + m[0].length,
      `[ABNT] Plural de sigla em português não leva apóstrofo: “${fix}”`,
      fix,
      [fix],
      true
    );
  }
}

export function abntCitation({ mask, push }: RuleCtx): void {
  let m: RegExpExecArray | null;
  // 5. Citações autor-data (ABNT NBR 10520)
  const citacaoAutorRx = /\(([A-ZÁÉÍÓÚa-záéíóúçãõâêô]+(?:\s*;\s*[A-ZÁÉÍÓÚa-záéíóúçãõâêô]+)*),\s*(\d{4}(?:,\s*p\.\s*\d+)?)\)/gu;
  while ((m = citacaoAutorRx.exec(mask)) !== null) {
    const autor = m[1];
    const resto = m[2];
    if (autor !== autor.toUpperCase() && autor.length >= 3) {
      const autorUpper = autor.toUpperCase();
      const fix = `(${autorUpper}, ${resto})`;
      push(
        m.index,
        m.index + m[0].length,
        `[ABNT NBR 10520] Sobrenome do autor entre parênteses deve estar em maiúsculas: “${autorUpper}”`,
        fix,
        [fix],
        false
      );
    }
  }
}

export function abntPage({ mask, push }: RuleCtx): void {
  let m: RegExpExecArray | null;
  // Indicação de página: pág. 15 / pag 15 / pg 15 -> p. 15
  const pagRx = /(?<![\p{L}])(p[áa]g|pag|pg)\.?\s*(\d+)(?![\p{L}])/giu;
  while ((m = pagRx.exec(mask)) !== null) {
    const num = m[2];
    const fix = `p. ${num}`;
    push(
      m.index,
      m.index + m[0].length,
      `[ABNT] A abreviatura padrão de página é “p. ${num}”`,
      fix,
      [fix],
      true
    );
  }
}

export function abntEtAl({ mask, push }: RuleCtx): void {
  let m: RegExpExecArray | null;
  // "et al." com ponto em al. (et. al. ou et al sem ponto)
  const etAlRx = /(?<![\p{L}])(et\.?\s*al)(?!\.)(?![\p{L}])/giu;
  while ((m = etAlRx.exec(mask)) !== null) {
    push(
      m.index,
      m.index + m[0].length,
      `[ABNT] A expressão latina correta é “et al.” (com ponto no final)`,
      "et al.",
      ["et al."],
      true
    );
  }
}

export function abntDash({ mask, push }: RuleCtx): void {
  let m: RegExpExecArray | null;
  // 6. Travessão para orações intercaladas (incisos) em vez de hífen duplo "--"
  const travessaoRx = /(?<=\S)\s+--\s+(?=\S)/g;
  while ((m = travessaoRx.exec(mask)) !== null) {
    push(
      m.index,
      m.index + m[0].length,
      `[ABNT/Tipografia] Use travessão “ — ” para orações intercaladas (incisos)`,
      " — ",
      [" — "],
      true
    );
  }
}

export function abntLatin({ text, mask, push }: RuleCtx): void {
  let m: RegExpExecArray | null;
  // 7. Expressões em latim que devem vir em itálico
  const latimRx = /(?<![\p{L}*_])\b(a priori|a posteriori|ad hoc|in loco|in vitro|in vivo|stricto sensu|lato sensu|ipsis litteris|apud)\b(?![\p{L}*_])/giu;
  while ((m = latimRx.exec(mask)) !== null) {
    const termo = m[1];
    const antes = text.slice(Math.max(0, m.index - 1), m.index);
    const depois = text.slice(m.index + m[0].length, m.index + m[0].length + 1);
    if (antes === "*" || antes === "_" || depois === "*" || depois === "_") continue;
    const fix = `*${termo}*`;
    push(
      m.index,
      m.index + m[0].length,
      `[ABNT] Termos em latim devem ser destacados em itálico: “*${termo}*”`,
      fix,
      [fix],
      true
    );
  }
}
