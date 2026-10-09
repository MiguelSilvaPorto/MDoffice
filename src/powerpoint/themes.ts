// Temas visuais do deck: cor de fundo, texto, acento e a fonte padrão de cada tema.
// Espelha a paleta do app (tokens.css) para o palco e o .pptx usarem as mesmas cores.

import { THEME_COLORS, type DeckSetup, type Shape, type ThemeId } from "./schema";

export interface Theme {
  id: ThemeId;
  title: string;
  /** fundo e cor do texto da lâmina (hex sem #) */
  bg: string;
  fg: string;
  accent: string;
  muted: string;
  /** fonte padrão sugerida pela fita quando o tema muda */
  font: string;
}

export const THEMES: Theme[] = [
  { id: "claro", title: "Claro", ...THEME_COLORS.claro, font: "Segoe UI" },
  { id: "escuro", title: "Escuro", ...THEME_COLORS.escuro, font: "Segoe UI" },
  { id: "contraste", title: "Alto contraste", ...THEME_COLORS.contraste, font: "Arial" },
];

export function themeOf(id: ThemeId): Theme {
  return THEMES.find((t) => t.id === id) ?? THEMES[0];
}

/**
 * Estilo calculado do palco: o CSS da lâmina consome essas variáveis.
 * O fundo do deck-setup tem prioridade sobre o tema (personalização fina).
 */
export function stageVars(setup: DeckSetup): Record<string, string> {
  const t = themeOf(setup.theme);
  const bg = setup.bg || t.bg;
  return {
    "--slide-bg": `#${bg}`,
    "--slide-fg": `#${t.fg}`,
    "--slide-accent": `#${t.accent}`,
    "--slide-muted": `#${t.muted}`,
    // contraste do palco em relação à lâmina
    "--slide-shadow": bg.toUpperCase() === "000000" ? "0 0 0 1px #333, 0 8px 28px rgba(0,0,0,.5)" : "0 8px 28px rgba(15,23,42,.18)",
  };
}

/**
 * Aplica a paleta do tema à forma (nova forma nasce com a cor do tema ativo,
 * não com o preto fixo). Só mexe em cor/fonte quando o usuário não mexeu antes.
 */
export function formaComTema(s: Shape, setup: DeckSetup): Shape {
  const t = themeOf(setup.theme);
  return {
    ...s,
    fontFamily: setup.fontFamily || t.font,
    fontSize: setup.fontSize,
    color: t.fg,
    fill: s.kind === "forma" ? t.accent : s.fill,
  };
}

/** O .pptx não aceita '#' nas cores — normaliza. */
export function semHash(cor: string, padrao = "000000"): string {
  const limpo = cor.replace(/^#/, "").trim();
  if (!limpo) return padrao;
  return limpo.length === 3
    ? limpo.split("").map((c) => c + c).join("")
    : limpo.slice(0, 6).toUpperCase();
}