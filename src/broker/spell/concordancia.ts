// Concordância de número: a frase pede plural, a candidata responde no plural?
//
// O corretor escolhe a forma pela frequência e pelo contexto de n-gramas; quando o erro produz
// uma forma que também existe ("segurass" → "segura" ou "seguras"), é a CONCORDÂNCIA que decide:
// se a frase já tem marca de plural ("as notas … segurass"), a forma plural é a certa. É regra
// estrutural, não palpite de frequência — e foi o que o corpus mediu faltar ("segurass" →
// seguras, "porcentajens" → porcentagens, "diagramass" → diagramas).
//
// Conservadora de propósito, em duas frentes:
//   • só o PLURAL é acusado (o caminho medido); o singular não vira sinal, porque palavra
//     singular terminada em "s" ("país", "lápis", "ônibus") confundiria;
//   • o pedido vem de um DETERMINANTE/numeral conhecido, não de qualquer palavra.
//
// Puro: sem DOM, sem worker, sem modelo — dá para testar no Node.

export type Numero = "sg" | "pl";

/** Determinantes e numerais que marcam o número (e o gênero, que fica informativo). */
const DETERMINANTES: Record<string, { numero: Numero; genero: "m" | "f" }> = {
  o: { numero: "sg", genero: "m" },
  a: { numero: "sg", genero: "f" },
  um: { numero: "sg", genero: "m" },
  uma: { numero: "sg", genero: "f" },
  este: { numero: "sg", genero: "m" },
  esta: { numero: "sg", genero: "f" },
  esse: { numero: "sg", genero: "m" },
  essa: { numero: "sg", genero: "f" },
  aquele: { numero: "sg", genero: "m" },
  aquela: { numero: "sg", genero: "f" },
  meu: { numero: "sg", genero: "m" },
  minha: { numero: "sg", genero: "f" },
  seu: { numero: "sg", genero: "m" },
  sua: { numero: "sg", genero: "f" },
  nosso: { numero: "sg", genero: "m" },
  nossa: { numero: "sg", genero: "f" },
  os: { numero: "pl", genero: "m" },
  as: { numero: "pl", genero: "f" },
  uns: { numero: "pl", genero: "m" },
  umas: { numero: "pl", genero: "f" },
  dois: { numero: "pl", genero: "m" },
  duas: { numero: "pl", genero: "f" },
  estes: { numero: "pl", genero: "m" },
  estas: { numero: "pl", genero: "f" },
  esses: { numero: "pl", genero: "m" },
  essas: { numero: "pl", genero: "f" },
  aqueles: { numero: "pl", genero: "m" },
  aquelas: { numero: "pl", genero: "f" },
  meus: { numero: "pl", genero: "m" },
  minhas: { numero: "pl", genero: "f" },
  seus: { numero: "pl", genero: "m" },
  suas: { numero: "pl", genero: "f" },
  nossos: { numero: "pl", genero: "m" },
  nossas: { numero: "pl", genero: "f" },
  alguns: { numero: "pl", genero: "m" },
  algumas: { numero: "pl", genero: "f" },
  vários: { numero: "pl", genero: "m" },
  várias: { numero: "pl", genero: "f" },
  muitos: { numero: "pl", genero: "m" },
  muitas: { numero: "pl", genero: "f" },
  ambos: { numero: "pl", genero: "m" },
  ambas: { numero: "pl", genero: "f" },
};

/** O número que a frase pede, pelo determinante IMEDIATO (antes; sem ele, o de depois).
 *  Janela curta de propósito: determinante a três palavras pode pertencer a outro substantivo
 *  ("os relatórios de venda") — a medição do harness mostrou que a janela larga promovia errado. */
export function pedidoDoContexto(prev: string[], next: string | null): Numero | null {
  const antes = prev.length ? DETERMINANTES[prev[prev.length - 1].toLowerCase()] : undefined;
  if (antes) return antes.numero;
  if (next) {
    const d = DETERMINANTES[next.toLowerCase()];
    if (d) return d.numero;
  }
  return null;
}

/** As duas formas são a MESMA palavra no outro número ("segura" × "seguras")? */
export { parDeNumero } from "./parDeNumero";

/**
 * O candidato concorda com o número que a frase pede?
 *   +1 concorda (plural pedido + forma plural, ou singular pedido + forma singular);
 *   −1 discorda do plural (o caso medido: a frase pede plural e a forma é singular);
 *    0 sem pedido claro ou sem risco de erro (o singular não é acusado).
 */
export function concordanciaDeNumero(pedido: Numero | null, candidato: string): number {
  if (pedido !== "pl") return 0;
  return parecePlural(candidato) ? 1 : -1;
}

/** A forma da palavra parece plural? (pelo final — o mesmo teste que o resto do app usa) */
export function parecePlural(palavra: string): boolean {
  const p = palavra.toLowerCase();
  return /(?:s|ns|is|es|ãos|ães|ões)$/u.test(p);
}
