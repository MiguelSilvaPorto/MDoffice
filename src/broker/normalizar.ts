// Normalização do texto antes de qualquer regra.
//
// Duas coisas que mudam o resultado das regras e passariam em silêncio:
//
// 1. **NFC.** Texto colado do macOS (e de PDF, muito comum) vem em NFD: "é" é "e" mais
//    uma marca solta. A marca não é `\p{L}`, então fronteira de palavra e classe com
//    acento literal (`[A-ZÁÉÍÓÚ]`, da regra das siglas) erram — e erram nos dois motores,
//    igual. Normalizar é conserto, não seguro de portabilidade.
// 2. **CRLF.** A regra que casa fim de linha não deve depender de qual fim de linha o
//    documento trouxe.
//
// Como as duas mudam o comprimento do texto, o mapa devolve o aviso para o texto
// original. O span que sai daqui é sempre índice de CARACTERE do original — a unidade
// do schema (o editor trabalha em UTF-16 e o Rust em byte UTF-8; cada borda converte).

/** Marcas que se juntam ao caractere anterior (acentos soltos, NFD). */
const MARCA = /^\p{M}$/u;

export interface Normalizado {
  /** texto em NFC e com fim de linha LF */
  texto: string;
  /**
   * `mapa[i]` é a posição no texto original correspondente à posição `i` do
   * normalizado. Tem uma entrada a mais que o texto, para a borda final.
   */
  mapa: number[];
  /** o texto já estava normalizado? (evita trabalho quando não há o que fazer) */
  mudou: boolean;
}

/**
 * Normaliza em NFC e troca CRLF (e CR sozinho) por LF, guardando o mapa de posições.
 *
 * O trabalho é feito por "grupos": um caractere base mais as marcas que o seguem (ou
 * um `\r\n`), que é exatamente a unidade em que a NFC compõe. Assim cada grupo vira
 * texto no seu tamanho final e o mapa sai exato — sem reconstruir posição por
 * heurística.
 */
export function normalizarTexto(bruto: string): Normalizado {
  const pontos = [...bruto];
  const chars: string[] = [];
  const indices: number[] = []; // posição no original de cada caractere normalizado
  let mudou = false;
  let i = 0;

  const empurrar = (pedaco: string, de: number) => {
    const normalizado = pedaco.normalize("NFC");
    if (normalizado !== pedaco) mudou = true;
    for (const c of normalizado) {
      chars.push(c);
      indices.push(de);
    }
  };

  while (i < pontos.length) {
    const c = pontos[i];

    // \r\n (ou um \r sozinho) vira um \n
    if (c === "\r") {
      mudou = true;
      const dois = pontos[i + 1] === "\n";
      chars.push("\n");
      indices.push(i);
      i += dois ? 2 : 1;
      continue;
    }

    // base + marcas que a seguem: é a unidade em que a NFC compõe
    let fim = i + 1;
    while (fim < pontos.length && MARCA.test(pontos[fim])) fim++;
    empurrar(pontos.slice(i, fim).join(""), i);
    i = fim;
  }

  // uma entrada a mais que o texto: a borda final aponta para o fim do original
  return { texto: chars.join(""), mapa: [...indices, bruto.length], mudou };
}

/** Leva uma posição do texto normalizado para o original. */
export function paraOriginal(norm: Normalizado, posicao: number): number {
  const i = Math.max(0, Math.min(posicao, norm.mapa.length - 1));
  return norm.mapa[i];
}
