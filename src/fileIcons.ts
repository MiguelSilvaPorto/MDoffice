// Ícone de cada TIPO de arquivo (Markdown, Word, Excel, PowerPoint): uma folha de papel na cor do tipo, com a
// marca daquele formato dentro (M↓, W, grade, pizza), para dar para reconhecer o que é cada documento só olhando
// (nas abas, no painel lateral, no Início, nos menus e nas buscas). A folha lembra "documento"; a marca diz qual.
// Vale o tipo REAL do arquivo (pela extensão ou pelo tipo da aba), nunca um palpite pelo nome.

export type FileKind = "md" | "word" | "excel" | "ppt" | "settings" | "other";

/** Nome do tipo, para dicas ao passar o mouse. */
export const FILE_KIND_LABEL: Record<FileKind, string> = {
  md: "Documento Markdown (.md)",
  word: "Documento Word (.docx)",
  excel: "Planilha Excel (.xlsx)",
  ppt: "Apresentação PowerPoint (.pptx)",
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
 * silhueta em todos os tipos, para ler como "arquivo"; o que muda é a cor (CSS) e a marca.
 */
const FOLHA =
  `<path class="fi-tile" d="M6.4 1.8h7l6.4 6.4V20.6a1.6 1.6 0 0 1-1.6 1.6H6.4a1.6 1.6 0 0 1-1.6-1.6V3.4a1.6 1.6 0 0 1 1.6-1.6Z"/>` +
  `<path class="fi-fold" d="M13.4 1.8l6.4 6.4h-6.4z"/>`;

/**
 * A marca (branca) dentro da folha, por tipo — não só uma letra, para ser reconhecível pela forma:
 *  - Markdown: a marca "M↓" (M com seta para baixo);
 *  - Word: um W desenhado com traço;
 *  - Excel: a planilha (cabeçalho cheio e grade);
 *  - PowerPoint: o gráfico de pizza.
 * O desenho vive abaixo da dobra (y ≳ 9.6), senão encosta no canto dobrado.
 */
const GLYPH: Record<Exclude<FileKind, "settings" | "other">, string> = {
  md:
    `<path class="fi-line" d="M7 19.2v-8.4l2.9 4 2.9-4v8.4"/>` +
    `<path class="fi-line" d="M15.9 10.8v6.6M13.7 15.1l2.2 2.3 2.2-2.3"/>`,
  word: `<path class="fi-line" d="M6.8 10.9l2.6 8.2 3.3-6.4 3.3 6.4 2.6-8.2"/>`,
  excel:
    `<rect class="fi-line" x="6.6" y="10.2" width="11.4" height="9.2" rx="1.5"/>` +
    `<path class="fi-solid" d="M6.6 11.7a1.5 1.5 0 0 1 1.5-1.5h8.4a1.5 1.5 0 0 1 1.5 1.5v1.9H6.6z"/>` +
    `<path class="fi-line fi-thin" d="M10.4 13.6v5.8M14.2 13.6v5.8M6.6 16.55h11.4"/>`,
  ppt:
    `<circle class="fi-line" cx="12.3" cy="14.9" r="5"/>` +
    `<path class="fi-solid" d="M12.3 14.9V9.9a5 5 0 0 1 5 5z"/>`,
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
