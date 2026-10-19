// Regime de escrita do documento: o texto já usa acentos?
//
// É o que separa "esqueci o acento" de "estou escrevendo sem acento de propósito".
// Num documento que não usa acento nenhum (informal, áudio transcrito, legenda), a
// correção automática fica quieta: ela não "conserta" o regime — no máximo sugere.
// A correção explícita ("Formatar texto") continua disponível e restaura os acentos.

/** Letras acentuadas do latim (inclui ç, ã, õ, á, é, í, ó, ú, â, ê, ô, à). */
const COM_DIACRITICO = /[\u00C0-\u024F\u1E00-\u1EFF]/;

/** Palavras de duas letras ou mais (o que dá para acentuar). */
const PALAVRA = /[\p{Letter}]{2,}/gu;

/**
 * O documento dá sinal de escrita com acento?
 *
 * Um texto em português normal tem uma boa fatia de palavras acentuadas (mais de
 * 10%); um texto sem acento por escolha tem zero. O corte de 1% separa os dois sem
 * depender de uma palavra isolada ("não" perdido no meio de 800 palavras não liga a
 * correção automática num texto que é todo sem acento). Sem nenhuma palavra acentuada,
 * o padrão é NÃO mexer: uma frase curta sem acento pode ser só uma frase curta, e
 * corrigir por conta própria é pior do que esperar.
 */
export function usaAcentos(texto: string): boolean {
  const palavras = texto.match(PALAVRA) ?? [];
  if (!palavras.length) return false;
  let comAcento = 0;
  for (const p of palavras) {
    if (COM_DIACRITICO.test(p)) comAcento++;
  }
  return comAcento > 0 && comAcento / palavras.length >= 0.01;
}
