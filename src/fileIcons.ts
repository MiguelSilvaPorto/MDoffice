// Ícone de cada TIPO de arquivo (Markdown, Word, Excel, PowerPoint): um quadradinho com a cor e a letra do tipo, para dar
// para reconhecer o que é cada documento só olhando (nas abas, no painel lateral, no Início e nas buscas).
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
 * O desenho (branco) dentro do quadradinho de cada tipo — não só uma letra, para ser reconhecível pela forma:
 *  - Markdown: a marca "M↓" (M com seta para baixo);
 *  - Word: um W desenhado com traço;
 *  - Excel: uma tabela (cabeçalho cheio e grade);
 *  - PowerPoint: um gráfico de pizza.
 */
const GLYPH: Record<Exclude<FileKind, "settings" | "other">, string> = {
  md:
    `<path class="fi-line" d="M4.8 16V8.2l2.9 3.6 2.9-3.6V16"/>` +
    `<path class="fi-line" d="M16.6 8.2v6.8M14.1 12.7l2.5 2.6 2.5-2.6"/>`,
  word: `<path class="fi-line" d="M5.6 8.2l2.7 8.4 3.7-6.9 3.7 6.9 2.7-8.4"/>`,
  excel:
    `<rect class="fi-line" x="5.5" y="6" width="13" height="12" rx="1.6"/>` +
    `<path class="fi-solid" d="M5.5 7.6a1.6 1.6 0 0 1 1.6-1.6h9.8a1.6 1.6 0 0 1 1.6 1.6v2.6h-13z"/>` +
    `<path class="fi-line fi-thin" d="M10 10.2V18M14.2 10.2V18M5.5 14h13"/>`,
  ppt:
    `<circle class="fi-line" cx="12" cy="12" r="6"/>` +
    `<path class="fi-solid" d="M12 12V6a6 6 0 0 1 6 6z"/>`,
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
    `<rect class="fi-tile" x="2" y="2" width="20" height="20" rx="5"/>` +
    GLYPH[kind] +
    `</svg>`
  );
}
