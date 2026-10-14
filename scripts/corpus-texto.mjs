// O HTML de um artigo da Wikipédia vira texto para o corpus dos n-gramas.
//
// Fica num módulo próprio (e não dentro do `baixar-corpus.mjs`) porque o script é um CLI:
// importá-lo para testar executaria o download inteiro. Aqui é só a função pura.
//
// A regra: fica a PROSA; saem tabela (infobox é tabela), figura, nota de rodapé, nota de
// edição, marcação e o rabo de referências/bibliografia (lista, não texto corrido). Linhas
// curtas demais (legenda órfã, título solto) também saem — elas só poluiriam as contagens.

/** O HTML do artigo vira texto de prosa. */
export function textoDoHtml(html) {
  // tabela aninhada (infobox dentro de infobox) precisa de mais de uma passada: a remoção
  // não-gulosa de `<table>…</table>` fecha na PRIMEIRA, e o resto vazaria como texto.
  let limpo = html;
  for (let i = 0; i < 8; i++) {
    const antes = limpo;
    limpo = limpo
      .replace(/<table[\s\S]*?<\/table>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<figure[\s\S]*?<\/figure>/gi, " ")
      .replace(/<gallery[\s\S]*?<\/gallery>/gi, " ");
    if (limpo === antes) break;
  }
  limpo = limpo
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<span[^>]*class="[^"]*mw-editsection[^"]*"[\s\S]*?<\/span>/gi, " ")
    .replace(/<sup[\s\S]*?<\/sup>/gi, " ")
    // bloco fecha linha — é o que separa parágrafo de parágrafo (e acha o título de seção)
    .replace(/<\/(p|h[1-6]|li|div|section|blockquote|dd|dt)>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, " e ")
    .replace(/&quot;|&#34;|&#39;|&apos;/g, " ")
    .replace(/&lt;|&gt;|&#\d+;/g, " ")
    .replace(/&[a-z]+;/gi, " ")
    .replace(/[ \t\u00a0]+/g, " ")
    .replace(/ ?\n ?/g, "\n")
    .replace(/\n{2,}/g, "\n");
  // corta o rabo de referências/bibliografia, que é lista, não prosa
  const corte = limpo.search(/^\s*(Referências|Referências bibliográficas|Bibliografia|Ver também|Ligações externas|Notas|Notas e referências)\s*$/im);
  const prosa = (corte > 200 ? limpo.slice(0, corte) : limpo).trim();
  // tira as linhas curtas demais (títulos de seção soltos, legendas órfãs) e as que ainda
  // parecem marcação (sobra de tabela malformada, entidade solta)
  return prosa
    .split("\n")
    .filter((l) => l.trim().length > 25 && !/(?:<\/|\/>|&[a-z]{2,8};)/.test(l))
    .join("\n")
    .trim();
}
