// As VARIANTES da apresentação: o mesmo desenho com outra família de cor (Esmeralda, Oceano,
// Ameixa, Âmbar, Rubi e Grafite), montadas das receitas do "Estilo de cor" (estilos.ts).
//
// Cada variante é um MODELO — a mesma estrutura do Template e das Ideias —, então a prévia do
// cartão é o próprio `aplicarModelo` rodado na lâmina atual: o cartão mostra exatamente o que o
// clique aplica, sem um segundo desenho para manter em dia.
import type { ModeloPPT } from "./modelos";
import type { FamiliaEstilo } from "../schema";
import { FAMILIAS, FAMILIAS_ORDEM, hexParaHsl, hslParaHex, rampaDeTons } from "./estilos";

/** As famílias que viram variante ("Da sua cor" não tem cor própria: fica fora da galeria). */
export const FAMILIAS_VARIANTE: FamiliaEstilo[] = FAMILIAS_ORDEM.filter((f) => f !== "propria");

/**
 * O modelo de uma variante: a rampa da família dá o fundo, o acento e a cor secundária, e o
 * Estilo de Cor segue a família (o fundo das lâminas nasce com o gradiente da rampa).
 * A Grafite é a variante escura — é a família sem cor própria, então é ela que faz o par
 * claro/escuro da galeria, como o Office tem nas variantes.
 */
export function modeloDaVariante(familia: FamiliaEstilo, fonte: string): ModeloPPT {
  const rec = FAMILIAS[familia];
  const { h, s } = hexParaHsl(rec.base);
  const rampa = rampaDeTons(rec.base, "media", rec.desvio);
  const escuro = familia === "grafite";
  // O fundo é um tom PASTEL da família: o "claro" da rampa fica no meio da escala e o texto
  // branco não contrastaria com ele. A luz alta dá o fundo claro das variantes e a tinta sai do
  // mesmo matiz, bem escura (na Grafite, o par inverte: fundo profundo e tinta clara).
  const bg = escuro ? hslParaHex(h, 0.26, 0.14) : hslParaHex(h, Math.min(0.5, s * 0.6), 0.94);
  const fg = escuro ? hslParaHex(h, 0.14, 0.95) : hslParaHex(h, 0.45, 0.16);
  return {
    id: `variante-${familia}`,
    nome: rec.nome,
    descricao: escuro ? "a apresentação no tom escuro da família" : "a apresentação nesta família de cor",
    tema: escuro ? "escuro" : "claro",
    bg,
    fonte,
    cores: { bg, fg, accent: rampa.cor, muted: escuro ? rampa.claro : rampa.escuro },
    estilo: { familia, intensidade: "media", brilho: "nada" },
  };
}

/**
 * Todas as variantes, na ordem da galeria. A `fonte` é a fonte atual do deck: a variante troca a
 * COR, não a tipografia — quem quiser outra fonte tem os Temas e as Ideias de design.
 */
export function modelosDasVariantes(fonte: string): ModeloPPT[] {
  return FAMILIAS_VARIANTE.map((f) => modeloDaVariante(f, fonte));
}
