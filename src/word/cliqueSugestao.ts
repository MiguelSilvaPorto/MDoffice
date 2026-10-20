// A regra do clique que abre as sugestões do corretor no Word.
//
// O popup é da PALAVRA (ou da frase, no aviso de estilo) — nunca de uma imagem. As imagens
// são inline no documento: ocupam UMA posição, e o fim da faixa do problema é exatamente o
// começo da imagem que vem logo depois. Por isso o clique na imagem caía "na palavra" e
// abria a sugestão dela (o print do usuário: a imagem selecionada e o popup de um "Awdaw").
// Pior: a aplicação da sugestão substitui a faixa inteira, então um problema que ATRAVESSA
// uma imagem apagaria a imagem (no texto projetado ela é só um espaço).
//
// Aqui a regra fica isolada e testável sem DOM: o alvo é qualquer coisa com `closest` e o
// documento é qualquer coisa com `nodesBetween`.

/** O mínimo de um elemento do clique (dá para testar sem DOM). */
export interface ElementoDoClique {
  closest?: (seletor: string) => unknown;
}

/**
 * A marca do problema (`.wd-issue`) sob o clique — ou `null` quando o clique **não** é no
 * texto marcado: imagem, espaço da linha, margem ou área vazia.
 */
export function marcaSobClique(alvo: ElementoDoClique | null | undefined): ElementoDoClique | null {
  if (!alvo || typeof alvo.closest !== "function") return null;
  if (alvo.closest("img")) return null; // imagem não tem palavra para corrigir
  const marca = alvo.closest(".wd-issue");
  return (marca as ElementoDoClique | null) ?? null;
}

/** O mínimo do documento (ProseMirror) que a checagem usa. */
export interface DocumentoComInline {
  nodesBetween: (
    de: number,
    ate: number,
    f: (node: { isInline?: boolean; isText?: boolean }, pos: number) => boolean | void
  ) => void;
}

/**
 * A faixa do problema atravessa algo que **não é texto** (imagem, quebra de linha)? A
 * sugestão substitui a faixa inteira — atravessar uma imagem apagaria a imagem —, então
 * esses problemas ficam de fora (como no Word, que sublinha o texto, não a imagem).
 */
export function atravessaNaoTexto(doc: DocumentoComInline, de: number, ate: number): boolean {
  let achou = false;
  doc.nodesBetween(de, ate, (node) => {
    if (node.isInline && !node.isText) {
      achou = true;
      return false;
    }
    return true;
  });
  return achou;
}
