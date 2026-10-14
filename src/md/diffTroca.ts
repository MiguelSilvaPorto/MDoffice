// Diff mínimo de uma troca de texto: separa o que muda (o que sai e o que entra) do que é
// comum às duas versões. É o que deixa o popup do aviso colorir só o trecho que muda —
// "pronto" → "pronto." colore só o ponto final, não a palavra inteira.

export interface Troca {
  /** prefixo comum às duas versões (fica neutro) */
  comumIni: string;
  /** o que sai (vermelho, riscado) */
  rem: string;
  /** o que entra (verde) */
  add: string;
  /** sufixo comum às duas versões (fica neutro) */
  comumFim: string;
}

export function diffDaTroca(velho: string, fix: string): Troca {
  let i = 0;
  while (i < velho.length && i < fix.length && velho[i] === fix[i]) i++;
  let j = 0;
  while (j < velho.length - i && j < fix.length - i && velho[velho.length - 1 - j] === fix[fix.length - 1 - j]) j++;
  return {
    comumIni: velho.slice(0, i),
    rem: velho.slice(i, velho.length - j),
    add: fix.slice(i, fix.length - j),
    comumFim: velho.slice(velho.length - j),
  };
}

export type ParteTroca = { tipo: "texto" | "rem" | "add"; texto: string };

/**
 * Partes prontas para exibir, na ordem: o que sai (vermelho) e o que entra (verde).
 * Quando os DOIS lados mudam, mostra os trechos inteiros ("responsavo" → "responsável") —
 * repetir só o miolo leria como "responsavoável". Quando muda um lado só, o comum fica
 * neutro ("pronto" + verde ".").
 */
export function partesDaTroca(velho: string, fix: string): ParteTroca[] {
  const { comumIni, rem, add, comumFim } = diffDaTroca(velho, fix);
  if (rem && add) {
    return [
      { tipo: "rem", texto: velho },
      { tipo: "add", texto: fix },
    ];
  }
  const partes: ParteTroca[] = [];
  if (comumIni) partes.push({ tipo: "texto", texto: comumIni });
  if (rem) partes.push({ tipo: "rem", texto: rem });
  if (add) partes.push({ tipo: "add", texto: add });
  if (comumFim) partes.push({ tipo: "texto", texto: comumFim });
  return partes;
}
