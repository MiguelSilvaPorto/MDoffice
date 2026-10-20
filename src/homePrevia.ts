// A prévia do cartão da tela Início: a "versão do documento pré-carregada".
//
// O Rust lê o começo do arquivo (`preview_file`: o XML principal, no caso dos formatos do Office)
// e devolve o TIPO e o TEXTO; aqui o texto vira a ESTRUTURA de cada cartão, para o desenho ser o
// do documento — e não um papel genérico que parece slide:
//
// - **Word (.docx)**: uma **página** (o primeiro parágrafo vira o título);
// - **Markdown**: uma **página** com o markdown renderizado (quem renderiza é a tela Início);
// - **PowerPoint (.pptx)**: uma **lâmina** (o primeiro texto é o título e o resto o corpo);
// - **Excel (.xlsx)**: a **grade** com os primeiros valores (as células vêm na linha, por TAB);
// - o resto (ou sem texto): **vazia** — o cartão fica com o ícone do formato.
//
// Módulo puro (sem DOM): o desenho e a sanitação do HTML ficam na tela.

export type FormaPrevia = "pagina" | "pagina-md" | "lamina" | "grade" | "vazia";

export interface PreviaEstruturada {
  forma: FormaPrevia;
  /** o texto bruto do documento (o markdown usa ele inteiro) */
  bruto: string;
  /** o título: a primeira linha com texto */
  titulo: string;
  /** o corpo: as linhas seguintes (limitadas ao que o cartão mostra) */
  linhas: string[];
  /** a grade do Excel: as linhas de células (vazia nas outras formas) */
  grade: string[][];
}

/** Quantas linhas de corpo a página mostra (o cartão é pequeno, mas a página tem de parecer cheia). */
export const LINHAS_PAGINA = 16;
/** Quantas linhas de corpo a lâmina mostra. */
export const LINHAS_LAMINA = 5;
/** Quantas linhas e colunas a grade do Excel mostra. */
export const LINHAS_GRADE = 6;
export const COLUNAS_GRADE = 5;

/** A estrutura da prévia a partir do tipo e do texto que o Rust devolve. */
export function estruturarPrevia(tipo: string, texto: string): PreviaEstruturada {
  const bruto = texto.replace(/\r\n?/g, "\n").trim();
  const linhas = bruto.split("\n").map((l) => l.trim());
  if (!bruto) return { forma: "vazia", bruto, titulo: "", linhas: [], grade: [] };
  if (tipo === "xlsx") return { forma: "grade", bruto, titulo: "", linhas: [], grade: gradeDoTexto(linhas) };
  const comTexto = linhas.filter((l) => l);
  if (!comTexto.length) return { forma: "vazia", bruto, titulo: "", linhas: [], grade: [] };
  const titulo = comTexto[0];
  const corpo = comTexto.slice(1);
  if (tipo === "pptx") return { forma: "lamina", bruto, titulo, linhas: corpo.slice(0, LINHAS_LAMINA), grade: [] };
  // Markdown: a tela renderiza o texto inteiro (as linhas não são usadas)
  if (tipo === "md") return { forma: "pagina-md", bruto, titulo, linhas: [], grade: [] };
  // Word (e o que mais trouxe texto): parágrafos numa página
  return { forma: "pagina", bruto, titulo, linhas: corpo.slice(0, LINHAS_PAGINA), grade: [] };
}

/**
 * As células da planilha: uma linha por linha da prévia, as células separadas por TAB (é o que o
 * `preview_file` devolve no modo grade), cortadas no que o cartão mostra; linha vazia não entra.
 */
export function gradeDoTexto(linhas: string[]): string[][] {
  const grade: string[][] = [];
  for (const linha of linhas) {
    if (grade.length >= LINHAS_GRADE) break;
    const celulas = linha.split("\t").map((c) => c.trim().replace(/\s+/g, " ")).slice(0, COLUNAS_GRADE);
    if (celulas.some((c) => c)) grade.push(celulas);
  }
  return grade;
}
