// Ícone de cada TIPO de arquivo (Markdown, Word, Excel, PowerPoint): uma folha de papel na cor do tipo, com a
// marca daquele formato dentro (M↓, W, grade, pizza), para dar para reconhecer o que é cada documento só olhando
// (nas abas, no painel lateral, no Início, nos menus e nas buscas). A folha lembra "documento"; a marca diz qual.
// Vale o tipo REAL do arquivo (pela extensão ou pelo tipo da aba), nunca um palpite pelo nome.

export type FileKind = "md" | "word" | "excel" | "ppt" | "settings" | "other";

/** Nome do tipo, para dicas ao passar o mouse. */
export const FILE_KIND_LABEL: Record<FileKind, string> = {
  md: "Documento Markdown (.md)",
  word: "Documento (.docx)",
  excel: "Planilha (.xlsx)",
  ppt: "Apresentação (.pptx)",
  settings: "Configurações",
  other: "Arquivo",
};

/** Tipo pelo caminho/nome do arquivo (pela extensão). */
export function kindOfPath(path: string | null | undefined): FileKind {
  const ext = (path ?? "").toLowerCase().split(".").pop() ?? "";
  if (ext === "docx" || ext === "doc" || ext === "dotx") return "word";
  if (ext === "xlsx" || ext === "xls" || ext === "xlsm" || ext === "csv") return "excel";
  if (ext === "pptx" || ext === "ppt") return "ppt";
  return "md";
}

/** Tipo de uma aba: o tipo da aba manda; o resto é Markdown. */
export function kindOfTab(kind: "doc" | "settings" | "word" | "ppt" | "xlsx" | undefined): FileKind {
  if (kind === "word") return "word";
  if (kind === "ppt") return "ppt";
  if (kind === "xlsx") return "excel";
  if (kind === "settings") return "settings";
  return "md";
}

/**
 * A folha clássica de documento (retângulo com o canto superior direito dobrado) — a mesma
 * silhueta em todos os tipos. Agora em CONTORNO (o estilo adotado para os ícones): o traço
 * vem da cor do tipo (CSS), o interior é vazio e o que muda entre os tipos é a marca.
 */
const FOLHA =
  `<path class="fi-sheet" d="M6 2h9l4.5 4.5v14.6a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1Z"/>` +
  `<path class="fi-sheet" d="M15 2v3.5a1 1 0 0 0 1 1h3.5"/>`;

/**
 * A marca (na cor do tipo) dentro da folha, por tipo — o desenho é o do conjunto adotado:
 *  - Markdown: o "#" do formato;
 *  - Word: as linhas de texto (a última mais curta);
 *  - Excel: a planilha (faixa de cabeçalho cheia e grade);
 *  - PowerPoint: o gráfico de colunas com a seta.
 * O desenho vive abaixo da dobra (y ≥ 9.4), senão encosta no canto dobrado.
 */
const GLYPH: Record<Exclude<FileKind, "settings" | "other">, string> = {
  md: `<path class="fi-mark" d="M10.8 10.1 9.9 17M13.6 10.1 12.7 17M8 12.3h8.4M7.8 15h8.4"/>`,
  word: `<path class="fi-mark" d="M7.4 10.2h9.2M7.4 12.4h9.2M7.4 14.6h9.2M7.4 16.8h4.4"/>`,
  excel:
    `<rect class="fi-mark" x="7.2" y="9.8" width="9.6" height="7.6" rx="0.9"/>` +
    `<path class="fi-fill" d="M7.2 10.7a0.9 0.9 0 0 1 0.9-0.9h7.8a0.9 0.9 0 0 1 0.9 0.9v1.5H7.2z"/>` +
    `<path class="fi-mark fi-thin" d="M11.5 12.3v5.1M14.9 12.3v5.1M7.2 14.9h9.6"/>`,
  ppt:
    `<rect class="fi-mark" x="7.2" y="9.4" width="9.6" height="6.2" rx="0.9"/>` +
    `<path class="fi-mark fi-bar" d="M9.9 14.2v-1.6M12 14.2v-3M14.1 14.2v-4.3"/>` +
    `<path class="fi-mark fi-thin" d="M12 16.6v2.8M10.2 19.6h3.6"/>`,
};

/**
 * O ícone como SVG (a cor vem do CSS: styles/fileicons.css). `extra` acrescenta classes (para o lugar onde entra).
 * Para "settings" devolve a engrenagem do app.
 */
export function fileIcon(kind: FileKind, extra = ""): string {
  if (kind === "settings") return `<svg class="ic ${extra}"><use href="#i-gear"/></svg>`;
  if (kind === "other") return `<svg class="ic ${extra}"><use href="#i-doc"/></svg>`;
  return (
    `<svg class="fi fi-${kind} ${extra}" viewBox="0 0 24 24" aria-hidden="true">` +
    FOLHA +
    GLYPH[kind] +
    `</svg>`
  );
}
