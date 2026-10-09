// Texto do .pptx → Markdown. É a volta do caminho de markdownEmBlocos
// (pptxexport/slides.ts): mantém o documento editável no editor do app.

/** Um parágrafo lido do .pptx. */
export interface Paragrafo {
  nivel: number;
  texto: string;
  bullet: boolean;
}

/** Converte parágrafos em Markdown legível. */
export function textoParaMarkdown(paragrafos: Paragrafo[]): string {
  // Detecta a linha de título: primeiro parágrafo curto, sem bullet, em slide de abertura.
  const primeiro = paragrafos[0];
  const temTitulo =
    !!primeiro && !primeiro.bullet && primeiro.texto.trim().length < 90 && paragrafos.length > 1;
  let jaUsouTitulo = false;
  return paragrafos
    .map((p) => {
      const t = p.texto.trim();
      if (!t) return "";
      // item de lista (com indentação vira sublista)
      if (p.bullet) {
        const recuo = "  ".repeat(Math.max(0, p.nivel));
        return `${recuo}- ${t}`;
      }
      // o título da lâmina vira # (só o primeiro, e uma vez)
      if (temTitulo && !jaUsouTitulo) {
        jaUsouTitulo = true;
        return `# ${t}`;
      }
      // texto curto e sozinho na lâmina costuma ser subtítulo/seção
      if (!jaUsouTitulo && p.nivel === 0 && paragrafos.length === 1 && t.length < 90) return `# ${t}`;
      return t;
    })
    .filter(Boolean)
    .join("\n\n");
}

/** Deck inteiro -> um documento Markdown com as lâminas separadas por ---. */
export function deckParaMarkdown(listas: { md: string; notes: string }[]): string {
  return listas
    .map((s) => s.md + (s.notes ? `\n\n> [notas] ${s.notes.replace(/\n/g, "\n> ")}` : ""))
    .join("\n\n---\n\n");
}