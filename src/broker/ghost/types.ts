// Tipos da sugestão inline (ghost text).

export interface GhostSuggestion {
  text: string;
  pos: number;
  /** Opções, da mais para a menos provável (a primeira é `text`). */
  alts?: string[];
  /** Se for uma correção: quantas letras digitadas antes do cursor ela substitui. */
  replace?: number;
  /** Qual das opções está aparecendo (0 = a principal). */
  alt?: number;
  /** A palavra (inteira, minúscula) de cada opção, na mesma ordem de `alts` — usada para aprender com o uso. */
  altWords?: string[];
  /** Palavra anterior e tipo de sugestão (para aprender com o uso). */
  prev?: string;
  mode?: "next" | "prefix";
}
