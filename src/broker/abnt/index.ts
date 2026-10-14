// ABNT — carrega as regras em TOML e as entrega como `Rule` para o motor de estilo.
//
// A ordem da lista importa (o motor para na primeira regra que avisa um trecho), e é
// a mesma ordem em que as funções estavam antes: a conversão para dado não muda
// comportamento — o teste de ouro é quem garante.

import type { Rule } from "../style/types";
import { CLASSES, LISTAS, PREDICADOS, type RegraCrua, type RegraToml } from "./esquema";
import { conferirRegra } from "./lint";
import { regraDeToml } from "./interpretador";
import { lerToml } from "./toml";

import horas from "./regras/horas.toml?raw";
import abntBase from "./perfis/abnt.toml?raw";
import horasComDoisPontos from "./regras/horas-com-dois-pontos.toml?raw";
import unidades from "./regras/unidades.toml?raw";
import meses from "./regras/meses.toml?raw";
import siglasPlural from "./regras/siglas-plural.toml?raw";
import citacaoAutorData from "./regras/citacao-autor-data.toml?raw";
import pagina from "./regras/pagina.toml?raw";
import etAl from "./regras/et-al.toml?raw";
import travessao from "./regras/travessao.toml?raw";
import latinismos from "./regras/latinismos.toml?raw";
import s01 from "./regras/s01.toml?raw";
import s02 from "./regras/s02.toml?raw";
import s03 from "./regras/s03.toml?raw";
import s04 from "./regras/s04.toml?raw";
import e09ResumoExtensao from "./regras/e09-resumo-extensao.toml?raw";
import e10Abstract from "./regras/e10-abstract.toml?raw";
import a01ResumoExtensao from "./regras/a01-resumo-extensao.toml?raw";
import a02PalavrasChave from "./regras/a02-palavras-chave.toml?raw";
import a03ResumoCitacao from "./regras/a03-resumo-sem-citacao.toml?raw";

const FONTES: { nome: string; texto: string }[] = [
  { nome: "horas.toml", texto: horas },
  { nome: "horas-com-dois-pontos.toml", texto: horasComDoisPontos },
  { nome: "unidades.toml", texto: unidades },
  { nome: "meses.toml", texto: meses },
  { nome: "siglas-plural.toml", texto: siglasPlural },
  { nome: "citacao-autor-data.toml", texto: citacaoAutorData },
  { nome: "pagina.toml", texto: pagina },
  { nome: "et-al.toml", texto: etAl },
  { nome: "travessao.toml", texto: travessao },
  { nome: "latinismos.toml", texto: latinismos },
  { nome: "s01.toml", texto: s01 },
  { nome: "s02.toml", texto: s02 },
  { nome: "s03.toml", texto: s03 },
  { nome: "s04.toml", texto: s04 },
  { nome: "e09-resumo-extensao.toml", texto: e09ResumoExtensao },
  { nome: "e10-abstract.toml", texto: e10Abstract },
  { nome: "a01-resumo-extensao.toml", texto: a01ResumoExtensao },
  { nome: "a02-palavras-chave.toml", texto: a02PalavrasChave },
  { nome: "a03-resumo-sem-citacao.toml", texto: a03ResumoCitacao },
];

/** Perfil institucional: sobrescreve versão de norma e o que fazer com cada regra. */
export interface Perfil {
  nome: string;
  /** perfil de onde este herda (o `abnt-base`, por exemplo) */
  estende?: string;
  /** versões de norma adotadas pela instituição */
  norma?: Record<string, string>;
  /**
   * Por regra: `off` (não usa), `soft` (vira sugestão, nunca automática) ou
   * `hard` (vira erro). É o que o catálogo chama de `Config`: as instituições
   * divergem, e a divergência é dado, não código.
   */
  regras?: Record<string, "off" | "soft" | "hard">;
}

/**
 * Lê e confere as regras. Um arquivo que não passa no lint **derruba a carga** —
 * regra pela metade não entra em silêncio.
 */
export function carregarRegras(fontes: { nome: string; texto: string }[] = FONTES): RegraToml[] {
  const regras: RegraToml[] = [];
  const problemas: string[] = [];
  for (const fonte of fontes) {
    const cru = lerToml(fonte.texto) as RegraCrua;
    const regra = conferirRegra(cru, (erro) => problemas.push(`${fonte.nome}: ${erro}`));
    if (regra) regras.push(regra);
  }
  if (problemas.length) {
    throw new Error("regras ABNT com problema:\n  " + problemas.join("\n  "));
  }
  return regras;
}

/** Aplica um perfil: tira o que é `off`, rebaixa o `soft`, sobe o `hard`. */
export function aplicarPerfil(regras: RegraToml[], perfil: Perfil): RegraToml[] {
  if (!perfil.regras) return regras;
  const out: RegraToml[] = [];
  for (const regra of regras) {
    const escolha = perfil.regras[regra.id];
    if (escolha === "off") continue;
    if (escolha === "soft") out.push({ ...regra, severidade: "suggestion", auto: false });
    else if (escolha === "hard") out.push({ ...regra, severidade: "error" });
    else out.push(regra);
  }
  return out;
}

/** As regras ABNT prontas para o motor de estilo, na ordem original. */
export const REGRAS_ABNT: Rule[] = carregarRegras().map((regra) => regraDeToml(regra));

/**
 * Lê o perfil base que embarca no app.
 *
 * O perfil institucional (da universidade de quem escreve) e o seletor na tela são
 * outro passo: hoje o que existe é o formato fechado e o base aplicado, que não muda
 * nada — serve para o dia em que houver o que sobrescrever.
 */
export function perfilBase(): Perfil {
  const cru = lerToml(abntBase) as unknown as Perfil;
  if (!cru.nome) throw new Error("perfil ABNT sem nome");
  if (cru.regras) {
    const conhecidos = new Set(carregarRegras().map((r) => r.id));
    for (const id of Object.keys(cru.regras)) {
      if (!conhecidos.has(id)) throw new Error(`perfil ABNT cita regra que não existe: ${id}`);
    }
  }
  return cru;
}

export { CLASSES, LISTAS, PREDICADOS, BLOCOS, normalizarTitulo, tituloCasa } from "./esquema";
export { regraDeToml };
export type { RegraToml };

// O modelo do documento e os verificadores: é o que as regras de contexto e de
// estrutura usam, e o que quem escreve regra nova precisa alcançar para testar.
export { documentoDe, ancoraNoFim, ancoraNoInicio, contarPalavras } from "./documento";
export type { Documento, Secao, Paragrafo, Linha, Faixa } from "./documento";
export { VERIFICADORES, verificador } from "./verificadores";
export type { Aviso, Verificador } from "./verificadores";
