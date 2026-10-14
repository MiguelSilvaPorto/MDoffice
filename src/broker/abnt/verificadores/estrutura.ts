// Verificadores de ESTRUTURA do trabalho (NBR 14724 e NBR 15287).
//
// Regras que usam este arquivo: E01 (elementos pré-textuais obrigatórios), E02 (ordem
// pré-textual → textual → pós-textual), E03 (introdução/desenvolvimento/conclusão) e
// P01 (seções do projeto de pesquisa).
//
// Os dois verificadores são GENÉRICOS — quem diz o que cobrar é o TOML:
//
// `secoes-obrigatorias`:
// - `obrigatorias` (obrigatória): o que precisa existir. Cada item é um nome de bloco
//   conhecido (`resumo`, `sumario`… — ver `BLOCOS` em esquema.ts), um título de seção
//   (comparado com o título normalizado, por palavra inteira no começo — "REFERÊNCIAS"
//   casa "Referências bibliográficas"), uma lista de alternativas (qualquer uma serve)
//   ou `{ rotulo = "…", nomes = [ … ] }` quando o aviso deve nomear o item de um jeito
//   (a lista de alternativas do desenvolvimento, por exemplo, não cabe na mensagem).
// - `indicios` (opcional): seções que mostram que o documento é DESSE tipo (o corpo do
//   trabalho). Declarado, a regra só fala se pelo menos um existir — um resumo solto
//   não vira "falta o sumário".
// - `minimo` (opcional, padrão 2): quantos itens reconhecidos (entre `obrigatorias` e
//   `indicios`) o documento precisa ter para a regra falar. Um texto qualquer não é um
//   TCC: sem essa evidência mínima, o verificador é silêncio.
// - `nivel` (opcional, padrão 1): o nível das seções consideradas.
// - `falta` (opcional, padrão "elementos obrigatórios"): como o aviso nomeia o que falta.
//
// `secoes-em-ordem`:
// - `fases` (obrigatória): as fases na ordem certa; cada fase é a lista de nomes (bloco
//   ou título) que a identificam.
// - `fases_nomes` (opcional): como a mensagem nomeia as fases ("pré-textuais"…).
// - `nivel` (opcional, padrão 1).
//
// Aviso de "falta isto" ancora em `ancoraNoFim` (é onde o elemento entraria, e o motor
// descarta aviso de trecho vazio); a mensagem diz POR QUE a regra conclui que o documento
// é um trabalho acadêmico — falso positivo é pior que falso negativo.

import { ancoraNoFim, type Documento, type Secao } from "../documento";
import { BLOCOS, normalizarTitulo, tituloCasa, type RegraToml } from "../esquema";
import { opcaoNumero, opcaoTexto, type Aviso, type Verificador } from "./tipos";

/** Um item exigido (ou um indício): um ou mais nomes aceitos, e o rótulo do aviso. */
interface Item {
  nomes: string[];
  rotulo: string;
}

/** "nbr14724:2024" → "[ABNT NBR 14724:2024]"; o que não é NBR fica "[ABNT]". */
function etiqueta(norma: string): string {
  const m = /^nbr(\d+):(\d{4})$/i.exec(norma);
  return m ? `[ABNT NBR ${m[1]}:${m[2]}]` : "[ABNT]";
}

/** O nome que a mensagem usa para o tipo de documento — sai da norma declarada na regra. */
function universoDe(norma: string): string {
  const m = /^nbr(\d+)/i.exec(norma);
  if (m?.[1] === "14724") return "trabalho acadêmico";
  if (m?.[1] === "15287") return "projeto de pesquisa";
  return "documento acadêmico";
}

/** Bloco vira o primeiro sinônimo acentuado ("SUMÁRIO"); título fica como foi declarado. */
function nomeExibido(nome: string): string {
  const sinonimos = BLOCOS[nome];
  return sinonimos ? sinonimos[0] : nome;
}

/** Lista legível: “A”, “B” e “C”. */
function listar(nomes: string[]): string {
  const aspas = nomes.map((nome) => `“${nome}”`);
  if (aspas.length <= 1) return aspas[0] ?? "";
  return `${aspas.slice(0, -1).join(", ")} e ${aspas[aspas.length - 1]}`;
}

/** Lê um item: string, lista de alternativas ou `{ rotulo, nomes }`. */
function lerItem(regra: RegraToml, nomeOpcao: string, bruto: unknown): Item {
  if (typeof bruto === "string") return { nomes: [bruto], rotulo: nomeExibido(bruto) };
  if (Array.isArray(bruto) && bruto.length && bruto.every((x) => typeof x === "string")) {
    const nomes = (bruto as string[]).map((n) => n);
    return { nomes, rotulo: listar(nomes.map(nomeExibido)) };
  }
  if (bruto && typeof bruto === "object" && !Array.isArray(bruto)) {
    const objeto = bruto as { rotulo?: unknown; nomes?: unknown };
    if (
      typeof objeto.rotulo === "string" &&
      Array.isArray(objeto.nomes) &&
      objeto.nomes.length &&
      objeto.nomes.every((x) => typeof x === "string")
    ) {
      return { nomes: objeto.nomes as string[], rotulo: objeto.rotulo };
    }
  }
  throw new Error(
    `regra ${regra.id}: item inválido em \`${nomeOpcao}\` — use título, ["alternativa 1", "alternativa 2"] ou { rotulo = "…", nomes = [ … ] }`
  );
}

/** Lê uma lista de itens; `obrigatoria` decide entre reclamar e devolver vazio. */
function lerItens(regra: RegraToml, nomeOpcao: string, obrigatoria: boolean): Item[] {
  const cru = regra.opcoes?.[nomeOpcao];
  if (cru === undefined) {
    if (obrigatoria) throw new Error(`regra ${regra.id}: a opção "${nomeOpcao}" é obrigatória e não veio`);
    return [];
  }
  if (!Array.isArray(cru)) throw new Error(`regra ${regra.id}: a opção "${nomeOpcao}" precisa ser uma lista`);
  return cru.map((entrada) => lerItem(regra, nomeOpcao, entrada));
}

/** Lista de textos opcional (as fases da ordem, por exemplo). */
function lerNomes(regra: RegraToml, nomeOpcao: string): string[] {
  const cru = regra.opcoes?.[nomeOpcao];
  if (cru === undefined) return [];
  if (!Array.isArray(cru) || !cru.every((x) => typeof x === "string")) {
    throw new Error(`regra ${regra.id}: a opção "${nomeOpcao}" precisa ser uma lista de textos`);
  }
  return cru as string[];
}

/** A seção casa com o nome: bloco conhecido (pelos sinônimos de `BLOCOS`) ou título. */
function casaNome(doc: Documento, secao: Secao, nome: string): boolean {
  if (nome in BLOCOS) return (doc.blocos[nome] ?? []).includes(secao);
  return tituloCasa(normalizarTitulo(secao.titulo), nome);
}

/** A primeira seção (no nível pedido) que satisfaz o item — ou null. */
function reconhece(doc: Documento, item: Item, nivel: number): Secao | null {
  for (const secao of doc.secoes) {
    if (secao.nivel !== nivel) continue;
    if (item.nomes.some((nome) => casaNome(doc, secao, nome))) return secao;
  }
  return null;
}

/**
 * `secoes-obrigatorias` — o documento tem os elementos exigidos?
 *
 * Um aviso único (e não um por item que falta): ele ancora no fim do documento, e o
 * motor mantém o primeiro aviso do mesmo trecho — um por item faria os outros sumirem.
 */
const secoesObrigatorias: Verificador = (doc, regra) => {
  const nivel = opcaoNumero(regra, "nivel", 1);
  const obrigatorias = lerItens(regra, "obrigatorias", true);
  const indicios = lerItens(regra, "indicios", false);
  const minimo = opcaoNumero(regra, "minimo", 2);

  const reconhecidos = [...obrigatorias, ...indicios].filter((item) => reconhece(doc, item, nivel) !== null);
  if (reconhecidos.length < minimo) return [];

  // Com indícios declarados, o documento precisa ter cara do tipo certo — e não só
  // "dois itens quaisquer" (era o resumo executivo de outra coisa, por exemplo).
  if (indicios.length && !indicios.some((item) => reconhece(doc, item, nivel) !== null)) return [];

  const faltando = obrigatorias.filter((item) => reconhece(doc, item, nivel) === null);
  if (!faltando.length) return [];

  const ancora = ancoraNoFim(doc);
  const amostra = reconhecidos.slice(0, 2).map((item) => item.rotulo);
  const outras = reconhecidos.length > 2 ? " (entre outras seções)" : "";
  const falta = opcaoTexto(regra, "falta", "elementos obrigatórios");
  const aviso: Aviso = {
    from: ancora.from,
    to: ancora.to,
    mensagem:
      `${etiqueta(regra.norma)} O documento tem cara de ${universoDe(regra.norma)} — tem ${listar(amostra)}${outras} —, ` +
      `mas faltam ${falta}: ${listar(faltando.map((item) => item.rotulo))}. ` +
      `Inclua o que falta como uma seção de nível ${nivel}; se este arquivo é só uma parte do trabalho, reúna as partes num documento só.`,
  };
  return [aviso];
};

/** Lê as fases da ordem: lista de listas de nomes. */
function lerFases(regra: RegraToml): string[][] {
  const cru = regra.opcoes?.fases;
  if (cru === undefined) throw new Error(`regra ${regra.id}: a opção "fases" é obrigatória e não veio`);
  if (!Array.isArray(cru) || !cru.length) throw new Error(`regra ${regra.id}: a opção "fases" precisa ser uma lista de fases`);
  return cru.map((fase) => {
    if (typeof fase === "string") return [fase];
    if (Array.isArray(fase) && fase.length && fase.every((x) => typeof x === "string")) return fase as string[];
    throw new Error(`regra ${regra.id}: cada fase de "fases" é uma lista de nomes (ex.: ["RESUMO", "SUMÁRIO"])`);
  });
}

/**
 * `secoes-em-ordem` — as seções reconhecidas aparecem na ordem das fases?
 *
 * A ordem é relativa: só a seção que QUEBRA a ordem é acusada (o exemplo da NBR
 * 14724 é "referências antes da conclusão" — a conclusão é que está fora de lugar).
 * O aviso aponta o título (trecho visível) e manda mover para antes da seção de fase
 * posterior que já tinha aparecido.
 */
const secoesEmOrdem: Verificador = (doc, regra) => {
  const nivel = opcaoNumero(regra, "nivel", 1);
  const fases = lerFases(regra);
  const nomesDasFases = lerNomes(regra, "fases_nomes");
  if (nomesDasFases.length && nomesDasFases.length !== fases.length) {
    throw new Error(
      `regra ${regra.id}: "fases_nomes" tem ${nomesDasFases.length} nomes para ${fases.length} fases`
    );
  }

  const avisos: Aviso[] = [];
  let maior = -1;
  let donoDoMaior: Secao | null = null;

  for (const secao of doc.secoes) {
    if (secao.nivel !== nivel) continue;
    const fase = fases.findIndex((nomes) => nomes.some((nome) => casaNome(doc, secao, nome)));
    if (fase < 0) continue;

    if (fase < maior && donoDoMaior) {
      const ordem = nomesDasFases.length ? ` A ordem dos elementos é ${nomesDasFases.join(" → ")}.` : "";
      avisos.push({
        from: secao.tituloFrom,
        to: secao.tituloTo,
        mensagem:
          `${etiqueta(regra.norma)} “${secao.titulo}” está fora de ordem: aparece depois de “${donoDoMaior.titulo}”.${ordem} ` +
          `Mova “${secao.titulo}” para antes de “${donoDoMaior.titulo}”.`,
      });
      continue; // cada seção fora de ordem acusa uma vez; a fase maior não regride
    }
    if (fase > maior) {
      maior = fase;
      donoDoMaior = secao;
    }
  }
  return avisos;
};

export const VERIFICADORES: Record<string, Verificador> = {
  "secoes-obrigatorias": secoesObrigatorias,
  "secoes-em-ordem": secoesEmOrdem,
};
