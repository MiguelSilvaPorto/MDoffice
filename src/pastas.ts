// Pastas padrão dos documentos: cada tipo tem a sua debaixo de `Documentos/mdOffice`.
//
// A ideia é o usuário nunca precisar escolher pasta: o documento novo nasce salvo na subpasta
// do próprio tipo (Markdown, Documentos, Planilhas, Apresentações) e a raiz vira um projeto na
// barra lateral — as subpastas aparecem como pastas normais na árvore. Quem salva em outro lugar
// escolhe "Salvar como…" e pronto. Os nomes são descritivos (o formato, não a marca): a pasta é
// o que o usuário vê no disco e na árvore.
//
// Puro (sem DOM e sem Tauri): o que é regra fica aqui e é testado no Node; quem fala com o
// disco é `files.ts`.

import type { FileKind } from "./fileIcons";

/** Os tipos que têm pasta própria (Configurações e "outros" não têm). */
export type TipoComPasta = Exclude<FileKind, "settings" | "other">;

/** O nome da subpasta de cada tipo — é o que o usuário vê no disco e na árvore de projetos. */
export const PASTA_DO_TIPO: Record<TipoComPasta, string> = {
  md: "Markdown",
  word: "Documentos",
  excel: "Planilhas",
  ppt: "Apresentações",
};

/** A extensão com que cada tipo nasce (sem ponto). */
export const EXTENSAO_DO_TIPO: Record<TipoComPasta, string> = {
  md: "md",
  word: "docx",
  excel: "xlsx",
  ppt: "pptx",
};

/** O nome do arquivo novo, sem colidir com o que já existe: "Documento", "Documento-2", … */
export function nomeLivre(usados: Iterable<string>, ext: string, base = "Documento"): string {
  const tomados = new Set<string>();
  for (const n of usados) tomados.add(n.toLowerCase());
  const primeiro = `${base}.${ext}`;
  if (!tomados.has(primeiro.toLowerCase())) return primeiro;
  for (let i = 2; i < 1000; i++) {
    const nome = `${base}-${i}.${ext}`;
    if (!tomados.has(nome.toLowerCase())) return nome;
  }
  return `${base}-${Date.now()}.${ext}`;
}

/** Junta a pasta com o separador certo do sistema (a barra que o usuário tem no caminho). */
export function juntarPasta(raiz: string, sub: string): string {
  const sep = raiz.includes("\\") ? "\\" : "/";
  return `${raiz.replace(/[\\/]+$/, "")}${sep}${sub}`;
}

/** A raiz padrão, a partir do que o sistema informa (o Tauri entrega `…/Documentos/mdOffice`). */
export function comRaizPadrao(raiz: string, tipo: TipoComPasta): string {
  return juntarPasta(raiz, PASTA_DO_TIPO[tipo]);
}
