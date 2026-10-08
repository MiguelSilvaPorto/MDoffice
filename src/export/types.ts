// Tipos da tela Exportar.

import { type Translation } from "../translate/controller";

export type ExportFormat = "html" | "pdf" | "docx" | "md" | "txt" | "zip" | "copy";
export type Lang = "pt" | "en" | "both";
export type Theme = "light" | "dark" | "paper";

export interface ExportPrefs {
  format: ExportFormat;
  lang: Lang;
  theme: Theme;
  size: "A4" | "Letter";
  toc: boolean;
}

export interface ExportCtx {
  getMarkdown: () => string;
  docPath: () => string | null;
  docName: () => string;
  isDark: () => boolean;
  translation: Translation;
  mdCss: string;
  /** Documento Word aberto: gera o .docx direto do motor (sem passar por Markdown). */
  nativeDocx?: () => Promise<Uint8Array>;
  /** Documento Word aberto: gera o .docx a partir de Markdown (versão traduzida). */
  docxFromMarkdown?: (md: string) => Promise<Uint8Array>;
  /** Documento Word aberto: imprime a própria folha (PDF fiel à tela). */
  printNative?: () => void;
  /** Garante um arquivo em disco (o pacote ZIP precisa do .md salvo ao lado das imagens). */
  ensureFile: () => Promise<boolean>;
  reveal: (path: string) => void;
}
