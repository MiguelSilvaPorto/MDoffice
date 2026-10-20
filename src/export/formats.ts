// Formatos disponíveis na tela Exportar e a chave onde as escolhas ficam guardadas.

import { type ExportFormat } from "./types";

export const PREFS_KEY = "mdc.export";

export const FORMATS: { id: ExportFormat; icon: string; title: string; desc: string; ext: string; label: string }[] = [
  { id: "html", icon: "i-web", title: "Página web", desc: "Um único arquivo .html com imagens embutidas.", ext: "html", label: "Página web" },
  { id: "pdf", icon: "i-pdf", title: "PDF", desc: "Documento pronto para imprimir ou enviar.", ext: "pdf", label: "PDF" },
  { id: "docx", icon: "i-word", title: "Documento (.docx)", desc: "Arquivo .docx editável, com tabelas e imagens.", ext: "docx", label: "Documento (.docx)" },
  { id: "md", icon: "i-code", title: "Markdown", desc: "O texto puro em .md, sem alterações de formato.", ext: "md", label: "Markdown" },
  { id: "txt", icon: "i-text", title: "Texto simples", desc: "Sem formatação, para colar em qualquer lugar.", ext: "txt", label: "Texto" },
  { id: "zip", icon: "i-zip", title: "Pacote para IA", desc: "ZIP com o texto, as imagens e instruções.", ext: "zip", label: "Pacote ZIP" },
  { id: "copy", icon: "i-copy", title: "Copiar formatado", desc: "Cola direto no seu editor, no Google Docs ou no e-mail.", ext: "", label: "" },
];
