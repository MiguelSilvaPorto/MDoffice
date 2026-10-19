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
 * Basta uma palavra acentuada para valer (quem escreve "não" ou "você" está no
 * regime normal). Sem nenhuma, o padrão é NÃO mexer: uma frase curta sem acento
 * pode ser só uma frase curta, e corrigir por conta própria é pior do que esperar.
 */
export function usaAcentos(texto: string): boolean {
  const palavras = texto.match(PALAVRA) ?? [];
  if (!palavras.length) return false;
  let comAcento = 0;
  for (const p of palavras) {
    if (COM_DIACRITICO.test(p)) comAcento++;
    // duas já bastam: não precisa varrer um texto enorme
    if (comAcento >= 2) return true;
  }
  return comAcento > 0 && comAcento / palavras.length >= 0.005;
}
