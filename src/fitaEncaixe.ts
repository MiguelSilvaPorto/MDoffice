// O ENCAIXE da faixa de opções: decide, só com números, o que a fita mostra na largura que tem.
//
// Os quatro degraus, do mais folgado ao mais apertado:
//
//   1. "cheio"       — tudo aberto, as métricas em 1;
//   2. "compacto"    — as métricas encolhem (a fonte tem piso no CSS) até caber;
//   3. "menu"        — com as métricas no piso, os grupos que não couberem viram um BOTÃO com menu,
//                      do ÚLTIMO grupo para o primeiro (os primeiros da fita é que ficam abertos —
//                      é o que se usa o tempo todo que continua à vista);
//   4. "faixa-unica" — no modo recolhido TODOS os grupos viram botão: uma faixa só, que acompanha a
//                      aba ativa, com os grupos separados e o menu de cada um ("mais" por grupo).
//
// A função é PURA (largura disponível × largura dos grupos) para o teste poder medir o encaixe sem
// abrir o app; quem aplica o plano no DOM é o `ligarEncaixeFita` do `fita.ts`.
//
// Nada de barra de rolagem: o plano é a garantia de que a fita caiba — com o último degrau (todos
// os grupos em botão) a linha fica curta o bastante para qualquer janela em que o app abre.

/** Escala das métricas (a mesma da alça de altura): 1 = cheio. */
export const AJUSTE_MIN = 0.7;

/** Largura do botão que substitui um grupo colapsado (o nome do grupo + a setinha). */
export const LARGURA_BOTAO = 78;

export type DegrauFita = "cheio" | "compacto" | "menu" | "faixa-unica";

export interface OpcoesEncaixe {
  /** escala das métricas já aplicada pela alça de altura (0,7 a 1,5); multiplica as larguras */
  escala?: number;
  /** piso da escala das métricas no degrau compacto */
  ajusteMin?: number;
  /** largura do botão que substitui um grupo colapsado (na escala 1) */
  larguraBotao?: number;
  /** espaço entre dois grupos (o `gap` do painel), contado entre cada par */
  gap?: number;
  /** modo recolhido: a fita vira uma faixa só, com todos os grupos em botão */
  faixaUnica?: boolean;
}

export interface PlanoFita {
  degrau: DegrauFita;
  /** escala das métricas deste plano (1 = cheio; nunca abaixo do piso) */
  ajuste: number;
  /** índices dos grupos que ficam ABERTOS, na ordem em que aparecem */
  abertos: number[];
  /** índices dos grupos que viram botão com menu, na ordem em que aparecem */
  noMenu: number[];
  /** o que sobra da largura com o plano aplicado (negativo = nem o último degrau cobre) */
  sobra: number;
}

/**
 * O plano da fita para uma largura.
 *
 * `grupos` são as larguras NATURAIS de cada grupo (na escala 1, do começo para o fim, na ordem em
 * que aparecem na aba); `opcoes.escala` multiplica todas (a alça de altura pode estar em 0,7 ou
 * 1,5). O que não couber vira botão, sempre de trás para a frente.
 */
export function encaixarFita(disponivel: number, grupos: number[], opcoes: OpcoesEncaixe = {}): PlanoFita {
  const escala = opcoes.escala && opcoes.escala > 0 ? opcoes.escala : 1;
  const ajusteMin = opcoes.ajusteMin && opcoes.ajusteMin > 0 ? opcoes.ajusteMin : AJUSTE_MIN;
  const larguraBotao = opcoes.larguraBotao && opcoes.larguraBotao > 0 ? opcoes.larguraBotao : LARGURA_BOTAO;
  const gap = opcoes.gap && opcoes.gap > 0 ? opcoes.gap : 0;
  const larguras = grupos.map((g) => Math.max(0, g) * escala);
  const todos = grupos.map((_, i) => i);
  // o espaço entre os grupos não encolhe com as métricas nem some ao colapsar: o botão ocupa o
  // lugar do grupo, então o número de vãos é o mesmo (n - 1)
  const vaos = Math.max(0, grupos.length - 1) * gap;

  // degrau 4: recolhida, a fita é uma faixa só — todos os grupos em botão (não depende da largura;
  // é o modo, não o aperto). Sem grupos, não há o que mostrar.
  if (opcoes.faixaUnica) {
    const largura = grupos.length * larguraBotao + vaos;
    return { degrau: "faixa-unica", ajuste: 1, abertos: [], noMenu: todos, sobra: disponivel - largura };
  }

  const natural = larguras.reduce((a, b) => a + b, 0) + vaos;

  // degrau 1: a aba cabe inteira
  if (natural <= disponivel) return { degrau: "cheio", ajuste: 1, abertos: todos, noMenu: [], sobra: disponivel - natural };

  // degrau 2: encolher as métricas. O quanto falta é `disponivel / natural`; se o piso não alcança,
  // o plano continua no degrau 3 com as métricas JÁ no piso (encolher mais não é opção).
  const preciso = natural > 0 ? disponivel / natural : 1;
  const ajuste = Math.max(ajusteMin, Math.min(1, preciso));
  if (preciso >= ajusteMin) {
    return { degrau: "compacto", ajuste, abertos: todos, noMenu: [], sobra: disponivel - natural * ajuste };
  }

  // degrau 3: colapsar do ÚLTIMO para o primeiro até caber (cada grupo colapsado vira um botão)
  const colapsados: number[] = [];
  const medir = () => {
    const abertos = todos.filter((i) => !colapsados.includes(i));
    const soma = abertos.reduce((acc, i) => acc + larguras[i], 0) * ajuste + colapsados.length * larguraBotao + vaos;
    return { abertos, soma };
  };
  for (let i = grupos.length - 1; i >= 0; i--) {
    if (medir().soma <= disponivel) break;
    colapsados.push(i);
  }
  const { abertos, soma } = medir();
  return {
    degrau: abertos.length === grupos.length ? "compacto" : "menu",
    ajuste,
    abertos,
    noMenu: [...colapsados].sort((a, b) => a - b),
    sobra: disponivel - soma,
  };
}
