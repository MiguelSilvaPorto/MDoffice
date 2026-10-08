// “a gente” + verbo → “nós” + verbo na 1ª pessoa do plural.

/**
 * “a gente” + verbo: a forma da 1ª pessoa do plural, para a frase continuar com o mesmo sentido.
 * Só verbos de forma inequívoca entram aqui (nada de “para”, “como”, que viram confusão).
 */
export const A_GENTE_VERBS: Record<string, string> = {
  // presente
  é: "somos", está: "estamos", tá: "estamos", tem: "temos", vai: "vamos", faz: "fazemos",
  pode: "podemos", quer: "queremos", precisa: "precisamos", sabe: "sabemos", diz: "dizemos",
  vê: "vemos", dá: "damos", fica: "ficamos", fala: "falamos", chega: "chegamos", passa: "passamos",
  leva: "levamos", deixa: "deixamos", usa: "usamos", ajuda: "ajudamos", trabalha: "trabalhamos",
  começa: "começamos", pensa: "pensamos", termina: "terminamos", revisa: "revisamos",
  manda: "mandamos", envia: "enviamos", mostra: "mostramos", compra: "compramos", olha: "olhamos",
  gosta: "gostamos", consegue: "conseguimos", entende: "entendemos", escreve: "escrevemos",
  lê: "lemos", vende: "vendemos", recebe: "recebemos", paga: "pagamos", chama: "chamamos",
  encontra: "encontramos", acha: "achamos", lembra: "lembramos", espera: "esperamos",
  mora: "moramos", estuda: "estudamos", anda: "andamos", corre: "corremos", come: "comemos",
  abre: "abrimos", decide: "decidimos", repete: "repetimos", pede: "pedimos", perde: "perdemos",
  sente: "sentimos", dorme: "dormimos", assiste: "assistimos", permite: "permitimos",
  acaba: "acabamos",
  // passado (perfeito)
  foi: "fomos", fez: "fizemos", teve: "tivemos", esteve: "estivemos", disse: "dissemos",
  viu: "vimos", deu: "demos", pôde: "pudemos", quis: "quisemos", soube: "soubemos",
  veio: "viemos", chegou: "chegamos", falou: "falamos", passou: "passamos", ficou: "ficamos",
  levou: "levamos", deixou: "deixamos", usou: "usamos", ajudou: "ajudamos",
  trabalhou: "trabalhamos", começou: "começamos", pensou: "pensamos", terminou: "terminamos",
  revisou: "revisamos", mandou: "mandamos", enviou: "enviamos", mostrou: "mostramos",
  comprou: "compramos", gostou: "gostamos", conseguiu: "conseguimos", entendeu: "entendemos",
  escreveu: "escrevemos", vendeu: "vendemos", recebeu: "recebemos", pagou: "pagamos",
  achou: "achamos", esperou: "esperamos", precisou: "precisamos", acabou: "acabamos",
  // imperfeito
  era: "éramos", estava: "estávamos", tinha: "tínhamos", ia: "íamos", fazia: "fazíamos",
  podia: "podíamos", queria: "queríamos", sabia: "sabíamos", dizia: "dizíamos", via: "víamos",
  dava: "dávamos", ficava: "ficávamos", falava: "falávamos", usava: "usávamos",
  precisava: "precisávamos", ajudava: "ajudávamos", gostava: "gostávamos", acabava: "acabávamos",
  // futuro e condicional
  será: "seremos", estará: "estaremos", terá: "teremos", irá: "iremos", fará: "faremos",
  poderá: "poderemos", quererá: "quereremos", dirá: "diremos", virá: "viremos", dará: "daremos",
  saberá: "saberemos", precisará: "precisaremos", ficará: "ficaremos", falará: "falaremos",
  seria: "seríamos", estaria: "estaríamos", teria: "teríamos", iria: "iríamos", faria: "faríamos",
  poderia: "poderíamos", gostaria: "gostaríamos", precisaria: "precisaríamos", ficaria: "ficaríamos",
};

/**
 * Corrige a frase “a gente + verbo” inteira: troca por “nós” e ajusta o verbo
 * (é o que faz o sentido continuar o mesmo, ex.: “a gente vai fazer” → “nós vamos fazer”).
 * Quando o verbo não está na lista, devolve só a sugestão para não errar.
 */
export function aGenteFix(verb: string): string | null {
  const plural = A_GENTE_VERBS[verb.toLowerCase()];
  return plural || null;
}
