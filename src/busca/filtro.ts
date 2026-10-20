// A busca que decide o que aparece na lista.
//
// Duas coisas acontecem aqui: o texto digitado é pontuado contra cada comando
// (para o mais próximo do que a pessoa quer subir para o topo) e o resultado é
// agrupado (pela aba e pelo grupo da fita), sem misturar os módulos.

import type { Comando, Modulo } from "./tipos";

/** Sem acento, minúsculo, sem sobra nas pontas — para comparar texto. */
export const norm = (s: string): string =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

/** O termo começa uma palavra? ("ali" em "alinhar" vale mais do que em "final") */
const inicioDePalavra = (n: string, i: number): boolean => i === 0 || /[\s\-_/·.]/.test(n[i - 1]);

/** A melhor pontuação do termo em um conjunto de campos (rótulo, grupo, palavras). */
function melhorCampo(campos: string[], termo: string): number {
  let melhor = 0;
  for (const campo of campos) {
    const n = norm(campo);
    if (!n) continue;
    const i = n.indexOf(termo);
    if (i < 0) continue;
    let s = 40;
    if (i === 0) s = 90;
    if (inicioDePalavra(n, i)) s += 20;
    if (n === termo) s += 70;
    if (s > melhor) melhor = s;
  }
  return melhor;
}

/**
 * A pontuação do comando para o que foi digitado.
 *
 * `-1` quando algum termo não aparece em lugar nenhum — o comando não entra na
 * lista. Sem termo nenhum, todo comando vale 0 (a lista abre mostrando tudo).
 */
export function pontuar(c: Comando, termos: string[]): number {
  if (!termos.length) return 0;
  let total = 0;
  for (const termo of termos) {
    const noRotulo = melhorCampo([c.label], termo);
    const noGrupo = melhorCampo([c.grupo], termo);
    const nasPalavras = melhorCampo((c.palavras ?? "").split(/\s+/), termo);
    const melhor = Math.max(noRotulo, noGrupo, nasPalavras);
    if (!melhor) return -1;
    total += melhor;
  }
  // o rótulo inteiro casou: esse comando sobe para o topo da lista
  const rotulo = norm(c.label);
  const tudo = norm(termos.join(" "));
  if (rotulo === tudo) total += 200;
  else if (rotulo.startsWith(tudo)) total += 60;
  return total;
}

/** O comando vale no módulo que está aberto? */
export function valeNoModulo(c: Comando, modulo: Modulo | null): boolean {
  if (!modulo || !c.modulos?.length) return true;
  return c.modulos.includes(modulo);
}

export interface GrupoResultado {
  titulo: string;
  comandos: Comando[];
}

export interface Resultado {
  /** os grupos, na ordem em que aparecem (pela pontuação do melhor de cada um) */
  grupos: GrupoResultado[];
  /** quantos comandos casaram no módulo aberto */
  doModulo: number;
  /** quantos casaram em outros módulos */
  deOutros: number;
  /** os comandos de outros módulos entraram na lista? */
  mostrandoOutros: boolean;
}

/**
 * Monta a lista de resultados.
 *
 * Por padrão a lista traz só o módulo aberto e os comandos gerais. Se a pessoa
 * digitou algo que **não existe no módulo aberto** — mas existe em outro —, os
 * outros entram também (numa seção separada, com a etiqueta do módulo): assim a
 * busca nunca é um beco sem saída sem virar uma lista com tudo misturado.
 */
export function montarResultado(
  comandos: Comando[],
  termos: string[],
  modulo: Modulo | null,
  mostrandoTodos: boolean
): Resultado {
  const casados: { c: Comando; s: number }[] = [];
  for (const c of comandos) {
    const s = pontuar(c, termos);
    if (s >= 0) casados.push({ c, s });
  }
  casados.sort((a, b) => b.s - a.s);

  const doModulo = casados.filter((x) => valeNoModulo(x.c, modulo));
  const deOutros = casados.filter((x) => !valeNoModulo(x.c, modulo));

  // quando não há nada do módulo atual, mas há de outro, os outros entram
  const temDoModulo = doModulo.some((x) => x.c.modulos?.length);
  const mostrandoOutros =
    mostrandoTodos || (termos.length > 0 && !temDoModulo && deOutros.length > 0);

  const lista = mostrandoOutros ? casados : doModulo;

  // agrupa mantendo a ordem da pontuação (o grupo do comando mais bem pontuado
  // vem primeiro) e sem quebrar o grupo no meio
  const ordem: string[] = [];
  const porGrupo = new Map<string, Comando[]>();
  for (const { c } of lista) {
    const chave = c.grupo;
    if (!porGrupo.has(chave)) {
      porGrupo.set(chave, []);
      ordem.push(chave);
    }
    porGrupo.get(chave)!.push(c);
  }

  return {
    grupos: ordem.map((titulo) => ({ titulo, comandos: porGrupo.get(titulo)! })),
    doModulo: doModulo.length,
    deOutros: deOutros.length,
    mostrandoOutros,
  };
}
