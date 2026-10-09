// Aplica o tema e a proporção do deck ao PptxGenJS antes de criar as lâminas.
// O .pptx não aceita '#' nas cores e usa polegadas, não pixels — é aqui que a
// conversão acontece (aspectSize() do schema já devolve as polegadas).

import { aspectSize, type DeckSetup } from "../schema";
import { semHash, themeOf } from "../themes";

/** Tipo mínimo do PptxGenJS — evita importar os tipos da lib aqui. */
type Pptx = { defineLayout: (o: { name: string; width: number; height: number }) => void; layout: string };

/**
 * Define o layout customizado (13,333 x 7,5 pol para 16:9 — o padrão do
 * PowerPoint) e devolve o nome dele, para o deck ser criado já no tamanho certo.
 */
export function aplicarTema(pptx: Pptx, setup: DeckSetup): string {
  const nome = `MDR_${setup.aspect.replace(":", "x")}`;
  const { w, h } = aspectSize(setup);
  pptx.defineLayout({ name: nome, width: w, height: h });
  pptx.layout = nome;
  return nome;
}

/** As cores do tema já sem '#' (o formato que o .pptx usa). */
export function coresTema(setup: DeckSetup): { bg: string; fg: string; accent: string; muted: string } {
  const t = themeOf(setup.theme);
  return {
    bg: semHash(setup.bg || t.bg, "FFFFFF"),
    fg: semHash(t.fg, "1C212B"),
    accent: semHash(t.accent, "4F46E5"),
    muted: semHash(t.muted, "6B7280"),
  };
}

/** Fonte padrão do deck, já sem aspas que o .pptx não aceita. */
export function fonteTema(setup: DeckSetup): string {
  const t = themeOf(setup.theme);
  return (setup.fontFamily || t.font).replace(/["']/g, "").trim() || "Arial";
}