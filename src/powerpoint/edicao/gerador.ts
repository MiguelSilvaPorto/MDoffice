// Gerador de designs (Ideias de design): em vez de só combinar o catálogo, o app CRIA uma paleta
// nova a cada fornada — matiz de partida pelo ângulo de ouro (espalha as paletas sem repetir
// vizinhas), esquema harmônico (análogo, complementar ou triádico), fundo claro ou escuro
// alternado e uma fonte que combina. Tudo no computador e determinístico: a semente `n` sempre
// devolve o mesmo design, e é isso que permite a prévia do cartão ser exatamente o que o clique
// aplica (o id `gerado-N` volta pela mesma função).
import type { ModeloPPT } from "./modelos";

/** As fontes que o gerador combina (as mesmas que o catálogo usa). */
const FONTES = ["Inter", "Poppins", "Lato", "Open Sans", "Nunito Sans", "Roboto", "Merriweather", "Georgia"];

/** Os esquemas harmônicos: onde a cor secundária cai em relação à principal. */
export type Esquema = "análogo" | "complementar" | "triádico";

/** O nome da faixa de cor, pelo começo dela (o rótulo que o usuário lê). */
const NOMES_COR: Array<[number, string]> = [
  [15, "Vermelho"],
  [40, "Laranja"],
  [65, "Âmbar"],
  [95, "Verde-limão"],
  [150, "Verde"],
  [190, "Teal"],
  [235, "Azul"],
  [270, "Índigo"],
  [305, "Roxo"],
  [340, "Magenta"],
  [360, "Vermelho"],
];

/** HSL (h 0-360, s/l 0-1) para hex sem #. */
function hsl(h: number, s: number, l: number): string {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  const hex = (v: number) => Math.max(0, Math.min(255, Math.round((v + m) * 255)))
    .toString(16)
    .padStart(2, "0")
    .toUpperCase();
  return `${hex(r)}${hex(g)}${hex(b)}`;
}

/** A matiz de partida da semente: o ângulo de ouro espalha as paletas sem repetir vizinhas. */
export function matizDaSemente(n: number): number {
  return (Math.abs(n) * 137.508) % 360;
}

/** O esquema da semente (gira entre os três). */
export function esquemaDe(n: number): Esquema {
  return (["análogo", "complementar", "triádico"] as const)[Math.abs(Math.floor(n)) % 3];
}

/** O nome da cor de uma matiz. */
export function nomeDaCor(h: number): string {
  const faixa = ((h % 360) + 360) % 360;
  return NOMES_COR.find(([ate]) => faixa < ate)?.[1] ?? "Cor";
}

/** O nome do design ("Verde análogo"). */
export function nomeDoDesign(n: number): string {
  return `${nomeDaCor(matizDaSemente(n))} ${esquemaDe(n)}`;
}

/**
 * O design da semente: paleta harmônica, fundo claro ou escuro (alterna) e fonte combinando. A
 * mesma semente devolve sempre o mesmo design — o "Gerar mais" avança a semente, então cada
 * fornada traz paletas inéditas.
 */
export function gerarDesign(n: number): ModeloPPT {
  const semente = Math.abs(Math.floor(n));
  const h = matizDaSemente(semente);
  const esquema = esquemaDe(semente);
  const escuro = semente % 2 === 1;
  const h2 = (h + (esquema === "análogo" ? 28 : esquema === "complementar" ? 180 : 120)) % 360;
  const accent = hsl(h, escuro ? 0.62 : 0.72, escuro ? 0.62 : 0.42);
  const muted = hsl(h2, 0.45, escuro ? 0.7 : 0.5);
  const bg = escuro ? hsl(h, 0.32, 0.09) : hsl(h, 0.32, 0.96);
  const fg = escuro ? hsl(h, 0.12, 0.96) : hsl(h, 0.3, 0.14);
  const fonte = FONTES[(semente + (esquema === "triádico" ? 3 : 1)) % FONTES.length];
  return {
    id: `gerado-${semente}`,
    nome: nomeDoDesign(semente),
    descricao: "design criado na hora pelo app",
    tema: escuro ? "escuro" : "claro",
    bg,
    fonte,
    cores: { bg, fg, accent, muted },
    gerado: true,
  };
}
