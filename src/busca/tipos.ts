// Os tipos da busca de funções (o Ctrl+K virou uma barra na parte de cima).
//
// Um "comando" aqui é qualquer botão do app que a pessoa pode acionar: os do
// catálogo do app (salvar, exportar, tema…) e os das fitas dos módulos (negrito,
// AutoSoma, mesclar células, animações…), que são coletados do próprio DOM.

/** Os módulos de documento — cada um tem a sua fita e as suas funções. */
export type Modulo = "md" | "word" | "xlsx" | "ppt";

export interface Comando {
  /** o que a pessoa lê na lista */
  label: string;
  /** onde o comando mora: "Início · Parágrafo", "Exportar", "Formatação"… */
  grupo: string;
  /** símbolo do sprite (index.html) com o ícone do botão */
  icone?: string;
  /** glifo de texto no lugar do ícone (o botão é um "B", um "N", um "Σ") */
  glifo?: string;
  /** html pronto (o ícone de arquivo dos documentos) */
  iconeHtml?: string;
  /** atalho mostrado à direita do rótulo */
  atalho?: string;
  /** palavras extras que também encontram o comando */
  palavras?: string;
  /** módulos em que o comando vale; sem a lista, vale em todos */
  modulos?: Modulo[];
  /** o que o comando faz */
  run: () => void;
  /** o botão está desabilitado agora (aparece esmaecido) */
  indisponivel?: boolean;
}

/** Como cada módulo se chama na interface (rótulo da busca e da etiqueta). */
export const MODULOS: Record<Modulo, { nome: string; curto: string; icone: string }> = {
  md: { nome: "Markdown", curto: "Markdown", icone: "i-doc" },
  word: { nome: "Documento (.docx)", curto: "Documento", icone: "i-word" },
  xlsx: { nome: "Planilha (.xlsx)", curto: "Planilha", icone: "i-grid" },
  ppt: { nome: "Apresentação (.pptx)", curto: "Apresentação", icone: "i-eye" },
};

/**
 * O módulo do documento que está aberto agora.
 *
 * `null` quando não há documento à vista (a tela de Início ou as Configurações
 * estão abertos): aí a busca mostra tudo, porque não há um contexto para filtrar.
 */
export function moduloAtivo(): Modulo | null {
  const c = document.body.classList;
  if (c.contains("home-open") || c.contains("settings-open")) return null;
  if (c.contains("word-open")) return "word";
  if (c.contains("xlsx-open")) return "xlsx";
  if (c.contains("ppt-open")) return "ppt";
  return "md";
}
