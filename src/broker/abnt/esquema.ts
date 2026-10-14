// ABNT — o vocabulário fechado do schema das regras.
//
// As regras ABNT são DADOS (arquivos `.toml` em `regras/`). O que mora aqui é o
// vocabulário que esses dados podem usar, e ele é fechado de propósito:
//
// - shorthand de regex (`\d`, `\s`, `\w`, `\b`) tem significado diferente em cada
//   motor — ASCII no JavaScript, Unicode no Rust — e some daqui para o texto das
//   regras não poder carregar essa ambiguidade;
// - tudo o que o schema aceita é verificável: as classes por code point, os
//   predicados pela definição declarada.

/**
 * Conjuntos de caracteres, guardados pelo CONTEÚDO e sem os colchetes.
 *
 * Sem colchetes porque a referência (`<<nome>>`) entra dentro de outra classe
 * (`[0-9<<espaco>>]`) ou vira o complemento de um predicado — as duas coisas
 * precisam do conteúdo, não da classe montada.
 */
export const CLASSES: Record<string, string> = {
  // o `\s` do JavaScript, code point a code point. `\u000B` (tabulação vertical)
  // está aqui porque o teste gerado confere contra `/\s/u` — a lista não é escrita
  // de memória.
  espaco: "\\t\\n\\u000B\\f\\r \\u00A0\\u1680\\u2000-\\u200A\\u2028\\u2029\\u202F\\u205F\\u3000\\uFEFF",
  digito: "0-9",
  // o `\w` do JavaScript: ASCII, mesmo com a flag `u`. É o que o `\b` das regras
  // originais queria dizer depois da unidade ("10 km", "10 kmz").
  palavra_ascii: "A-Za-z0-9_",
};

/**
 * Listas de valores usadas pelo texto das regras (`<<latinas>>`, `<<meses>>`).
 *
 * Uma referência resolve para uma classe quando o valor é string e para uma
 * alternação quando é lista — mesma sintaxe, dois tipos de dado.
 */
export const LISTAS: Record<string, string[]> = {
  meses: [
    "Janeiro",
    "Fevereiro",
    "Março",
    "Abril",
    "Maio",
    "Junho",
    "Julho",
    "Agosto",
    "Setembro",
    "Outubro",
    "Novembro",
    "Dezembro",
  ],
  latinismo: [
    "a priori",
    "a posteriori",
    "ad hoc",
    "in loco",
    "in vitro",
    "in vivo",
    "stricto sensu",
    "lato sensu",
    "ipsis litteris",
    "apud",
  ],
};

/**
 * Predicados de borda: a alternativa sem lookaround.
 *
 * Cada um é a NEGAÇÃO de um conjunto — e é verdadeiro nas bordas do texto (não há
 * caractere antes do começo), que é o que faz o antigo `(?<!...)` continuar valendo
 * sem o lookbehind.
 *
 * As chaves saem do que as regras originais usavam, uma a uma:
 * - `[\p{L}\d]` → `nao_letra_nem_digito`
 * - `[\p{L}\d#]` → `nao_letra_nem_digito_nem_cerquilha`
 * - `\b` (o `\w` do JS) → `nao_palavra_ascii`
 * - `[\p{L}]` → `nao_letra`
 * - `[\p{L}*_]` com `\b` → `nao_letra_nem_digito_nem_asterisco_nem_sublinhado`
 * - `[.\p{L}]` → `nao_ponto_nem_letra`
 * - `\S` → `nao_espaco`
 */
export const PREDICADOS: Record<string, string> = {
  nao_letra_nem_digito: "[^\\p{L}0-9]",
  nao_letra_nem_digito_nem_cerquilha: "[^\\p{L}0-9#]",
  nao_palavra_ascii: "[^A-Za-z0-9_]",
  nao_letra: "[^\\p{L}]",
  nao_letra_nem_digito_nem_asterisco_nem_sublinhado: "[^\\p{L}0-9*_]",
  nao_ponto_nem_letra: "[^.\\p{L}]",
  nao_espaco: `[^${CLASSES.espaco}]`,
};

/** Formatações de captura aceitas em `{nome:formato}`. */
export const FORMATOS = ["minusculo", "mapa"] as const;
export type Formato = (typeof FORMATOS)[number];

/** Transformadores: o julgamento que não cabe em dado (um só, por enquanto). */
export const TRANSFORMADORES = ["caixa_mista_autor"] as const;
export type Transformador = (typeof TRANSFORMADORES)[number];

/** Uma regra como ela está no TOML. */
export interface RegraToml {
  id: string;
  /** versão de norma que a regra segue: `nbr14724:2024`, `nbr10520:2023`, `tipografia`… */
  norma: string;
  grupo: string;
  severidade: "error" | "warning" | "suggestion";
  /** `auto` = pode ser aplicada sozinha (o antigo `safe`) */
  auto?: boolean;
  regex: string;
  /** intenção, não sintaxe: o motor liga `i` por conta disso */
  ignorar_caixa?: boolean;
  /** de qual grupo nomeado do regex sai o trecho que o aviso cobre e a troca substitui */
  trecho: string;
  antes?: string;
  depois?: string;
  /** não acusa quando a troca ficaria igual ao que já está escrito */
  pular_se_igual?: boolean;
  substituir?: string;
  mensagem: string;
  transformar?: Transformador;
  /**
   * Mapa usado por `{captura:mapa}` — a normalização de unidade, por exemplo
   * (`"ºc" = "°C"`). Chaves em minúscula, comparadas sem diferenciar caixa.
   */
  mapa?: Record<string, string>;
}

/** O tipo de dado cru que sai do TOML, antes do lint. */
export type RegraCrua = Partial<RegraToml> & { id?: string };
