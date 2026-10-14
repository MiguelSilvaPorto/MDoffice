// Verificadores da FORMA de cada tipo de referência (NBR 6023:2025) — R03 a R10.
//
// As oito regras são de CONFERÊNCIA: a violação é um dado ESSENCIAL que falta
// (local/editora do livro, "In:" do capítulo, periódico do artigo, "Acesso em" do
// site, órgão da lei, instituição da tese, ano do evento, número da patente). Regex
// acha PRESENÇA, não ausência — por isso o julgamento mora aqui, sobre a ENTRADA
// inteira do bloco `referencias`, e o TOML fica sendo só a declaração (id, norma,
// severidade, `verifica`).
//
// Precisão manda (falso positivo é pior que falso negativo): cada verificador só
// entra quando a entrada tem marca forte do tipo — e nenhuma marca de outro tipo,
// quando a confusão seria possível — e cada um documenta o que NÃO distingue.
// Nenhum devolve `fix`: o dado que falta não é conhecido.
//
// Contrato em ./tipos.ts. Documento, âncoras e parâmetros: docs/abnt-como-escrever-regras.md.

import type { Documento } from "../documento";
import type { Aviso, Verificador } from "./tipos";

// ---------------------------------------------------------------- as entradas

interface Entrada {
  /** onde a referência começa no ORIGINAL (o título da seção, se colado, fica fora) */
  from: number;
  to: number;
  texto: string;
}

const cacheEntradas = new WeakMap<Documento, Entrada[]>();

/**
 * As entradas do bloco `referencias`: um parágrafo por referência, sem a linha do
 * título da seção (quando a entrada vem colada nele, sem linha vazia).
 *
 * O modelo já dá os parágrafos; o que falta é recortar ao bloco e achar a primeira
 * linha — o ponteiro anda junto porque parágrafos e linhas estão em ordem.
 */
function entradas(doc: Documento): Entrada[] {
  const guardadas = cacheEntradas.get(doc);
  if (guardadas) return guardadas;

  const out: Entrada[] = [];
  const regioes = doc.regioesDeBlocos(["referencias"]);
  if (regioes.length) {
    let linha = 0;
    for (const p of doc.paragrafos) {
      if (!regioes.some((f) => p.from >= f.from && p.to <= f.to)) continue;
      while (linha < doc.linhas.length && doc.linhas[linha].from < p.from) linha++;
      const primeira = doc.linhas[linha];
      if (!primeira) continue;
      let from = p.from;
      if (primeira.tipo === "titulo") {
        if (primeira.to >= p.to) continue; // o parágrafo é só o título da seção
        from = primeira.to + 1; // "# REFERÊNCIAS" colado na primeira entrada
      }
      if (from < p.to) out.push({ from, to: p.to, texto: doc.texto.slice(from, p.to) });
    }
  }

  cacheEntradas.set(doc, out);
  return out;
}

/** Aviso preso a um trecho da entrada, em posição do original. */
function avisoDe(entrada: Entrada, indice: number, tamanho: number, mensagem: string): Aviso {
  return { from: entrada.from + indice, to: entrada.from + indice + tamanho, mensagem };
}

// ---------------------------------------------------------------- marcas comuns

/** O ano da publicação em qualquer ponto da entrada. */
const ANO = /(?:19|20)\d\d/;

/** "In:" nas grafias usuais, inclusive com destaque ("*In:*", "**In:**") e "In SILVA". */
const RE_IN = /(?:^|[^\p{L}\d])(?:\*{1,2}|_{1,2})?[Ii][Nn](?:\*{1,2}|_{1,2})?(?:\s*:|\s+(?=[A-ZÁÉÍÓÚÂÊÔÃÕÇ]))/iu;

/** "Local: Editora, ano" — o par que caracteriza a obra completa (e o livro). */
const LOCAL_EDITORA = /:[^\n,;:]{2,80},\s*(?:19|20)\d\d/;

/** Meses por extenso e abreviados — a data de periódico que um livro não tem. */
const MESES =
  /\b(?:janeiro|fevereiro|mar[çc]o|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro)\b|\b(?:jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez)\./i;

/** O último ano da entrada (é onde "Local: Editora, ano" entraria). */
function ultimoAno(texto: string): RegExpExecArray | null {
  const rx = /(?:19|20)\d\d/g;
  let achado: RegExpExecArray | null = null;
  for (let m = rx.exec(texto); m !== null; m = rx.exec(texto)) achado = m;
  return achado;
}

// ---------------------------------------------------------------- R03 — livro

/**
 * R03 — livro: autor. Título. Local: Editora, ano.
 *
 * Só julga quando a entrada tem ano e NENHUMA marca de outro tipo: "In:", fonte
 * online, fascículo (v./n.), data de periódico (mês), lei, tese, patente, evento.
 * Aí, se não há "…: Editora, ano", falta local/editora.
 *
 * NÃO distingue: livro de e-book (mesma forma); uma entrada de artigo sem v./n.
 * pode ser acusada com o conselho de livro (por isso a mensagem manda conferir o
 * tipo); livro com local escrito sem dois-pontos ("São Paulo, 2020") é acusado —
 * pela norma o par "Local: Editora" é o elemento.
 */
const MARCA_OUTRO_TIPO: RegExp[] = [
  RE_IN,
  /\bdispon[íi]vel\s+em\b/i,
  /\bacesso\s+em\b/i,
  /\bacessad[oa]\s+em\b/i,
  /https?:\/\//i,
  /\bn\.\s*\d/i, // fascículo (n. 3)
  MESES,
  /\b(?:lei|decreto|medida provisória|resolução|portaria|instrução normativa|emenda constitucional|constituição|código|diário oficial)\b/i,
  /\b(?:tese|dissertação|monografia|tcc)\b/i,
  /\btrabalhos?\s+de\s+conclusão\s+de\s+curso\b/i,
  /\bpatentes?\b/i,
  /\b(?:anais|atas|proceedings|congresso|simpósio|seminário|encontro|workshop|conferência|jornada|colóquio|fórum)\b/i,
];

const referenciaLivro: Verificador = (doc) => {
  const avisos: Aviso[] = [];
  for (const entrada of entradas(doc)) {
    const t = entrada.texto;
    if (!ANO.test(t)) continue;
    if (MARCA_OUTRO_TIPO.some((re) => re.test(t))) continue;
    if (LOCAL_EDITORA.test(t)) continue;
    const ano = ultimoAno(t);
    if (!ano) continue;
    avisos.push(
      avisoDe(
        entrada,
        ano.index,
        ano[0].length,
        "[ABNT NBR 6023:2025] Referência sem local e editora: em livro, complete “Local: Editora, ano” (ex.: “São Paulo: Atlas, 2020”); se for outro tipo, confira os elementos dele"
      )
    );
  }
  return avisos;
};

// ---------------------------------------------------------------- R04 — capítulo

/** Páginas da parte dentro da obra ("p. 15-30"): o rastro do capítulo. */
const PAGINA_DE_PARTE = /\bpp?\.\s*\d+\s*[-–—]\s*\d+/i;

/** Um segundo autor em caixa alta depois de um ponto ("… superior. COSTA, Maria"): a obra completa. */
const SEGUNDO_AUTOR = /\.\s*(?:\*+|_+)?([A-ZÁÉÍÓÚÂÊÔÃÕÇ][A-ZÁÉÍÓÚÂÊÔÃÕÇ'’-]{1,}),\s/;

/**
 * R04 — capítulo: "In:" com a obra completa.
 *
 * Um capítulo sem "In:" parece livro; o que o denuncia é o rastro da PARTE: páginas
 * "p. 15-30" ou um segundo autor/título ("… . COSTA, Maria, …") — e a obra completa
 * com "Local: Editora, ano". Sem esse rastro o verificador fica quieto (livro é
 * livro). "In" em qualquer forma (inclusive "in the" de título em inglês) cala a
 * regra: não vale acusar em cima de dúvida.
 *
 * NÃO distingue: capítulo sem os dois rastros (páginas e segundo autor) passa em
 * silêncio; um livro com título todo em caixa alta depois de ponto ("… . MEC, …")
 * pode ser acusado.
 */
const referenciaCapitulo: Verificador = (doc) => {
  const avisos: Aviso[] = [];
  for (const entrada of entradas(doc)) {
    const t = entrada.texto;
    if (RE_IN.test(t)) continue;
    if (/\b(?:v|vol)\.\s*\d/i.test(t) && /\bn\.\s*\d/i.test(t)) continue; // é artigo
    if (!LOCAL_EDITORA.test(t)) continue;
    const pagina = PAGINA_DE_PARTE.exec(t);
    const segundo = SEGUNDO_AUTOR.exec(t);
    if (!pagina && !segundo) continue;
    const mensagem =
      "[ABNT NBR 6023:2025] Referência de capítulo (ou parte) sem “In:”: acrescente “In:” antes da obra completa, com o autor, o título, o local, a editora e o ano dela";
    if (pagina) {
      avisos.push(avisoDe(entrada, pagina.index, pagina[0].length, mensagem));
    } else if (segundo) {
      const inicio = segundo.index + segundo[0].indexOf(segundo[1]);
      avisos.push(avisoDe(entrada, inicio, segundo[1].length, mensagem));
    }
  }
  return avisos;
};

// ---------------------------------------------------------------- R05 — artigo

/**
 * R05 — artigo: título do periódico + v./n./p.
 *
 * Dois sinais, independentes:
 * 1. o fascículo começa depois de um PONTO ("… do discurso. v. 12, n. 3…"): falta o
 *    título do periódico, que viria no lugar (a forma correta tem vírgula antes do
 *    "v.": "Revista Brasileira de Educação, v. 12");
 * 2. havendo "v." e "n." com ano, sem nenhum "p.", faltam as páginas.
 *
 * Entrada com "In:" não é julgada (capítulo/evento, não artigo).
 *
 * NÃO distingue: periódico escrito depois de ponto ("Rev. Bras. Enferm.. v. 71")
 * pode ser acusado; artigo sem "v." nem "n." passa em silêncio.
 */
const referenciaArtigo: Verificador = (doc) => {
  const avisos: Aviso[] = [];
  for (const entrada of entradas(doc)) {
    const t = entrada.texto;
    if (RE_IN.test(t)) continue;
    const volume = /\b(?:v|vol)\.\s*\d/.exec(t);
    if (!volume) continue;
    if (!ANO.test(t)) continue;
    const antes = t.slice(0, volume.index).replace(/[\s*_"'”’)\]]+$/, "");
    if (antes.endsWith(".")) {
      avisos.push(
        avisoDe(
          entrada,
          volume.index,
          volume[0].length,
          "[ABNT NBR 6023:2025] Referência de artigo sem o título do periódico: ele vem antes de “v. …, n. …” (ex.: “Revista Brasileira de Educação, v. 12, n. 3, p. 45-67, 2020”)"
        )
      );
      continue;
    }
    if (/\bn\.\s*\d/.test(t) && !/\bpp?\.\s*\d/i.test(t)) {
      const ano = ultimoAno(t);
      if (ano) {
        avisos.push(
          avisoDe(
            entrada,
            ano.index,
            ano[0].length,
            "[ABNT NBR 6023:2025] Referência de artigo sem as páginas: acrescente “p. 45-67” depois do fascículo (“…, v. 12, n. 3, p. 45-67, 2020”)"
          )
        );
      }
    }
  }
  return avisos;
};

// ---------------------------------------------------------------- R06 — site

/**
 * R06 — site: "Disponível em: endereço. Acesso em: data."
 *
 * A checagem é sobre os RÓTULOS (a máscara esconde a URL das regras de texto, mas
 * aqui o texto é o original): endereço sem "Acesso em" (ou sem os dois rótulos), e
 * "Disponível em" sem "Acesso em". "Acessado em" é acusado como rótulo fora da norma.
 *
 * NÃO distingue: endereço dentro de obra impressa (DOI citado no meio do texto)
 * entra na mesma checagem; "Acesso em" no meio de outra frase conta como rótulo.
 */
const referenciaSite: Verificador = (doc) => {
  const avisos: Aviso[] = [];
  for (const entrada of entradas(doc)) {
    const t = entrada.texto;
    const achado = /https?:\/\/[^\s]+/.exec(t);
    // o ponto final da frase não faz parte do endereço (o aviso fica no endereço)
    let url: { index: number; length: number } | null = null;
    if (achado) {
      let comprimento = achado[0].length;
      while (comprimento > 0 && ".,;)]}”’\"".includes(achado[0][comprimento - 1])) comprimento--;
      url = { index: achado.index, length: comprimento };
    }
    const disponivel = /\bdispon[íi]vel\s+em\b/i.exec(t);
    const acesso = /\bacesso\s+em\b/i.test(t);
    const acessado = /\bacessad[oa]\s+em\b/i.exec(t);
    if (url) {
      if (!disponivel && !acesso) {
        avisos.push(
          avisoDe(
            entrada,
            url.index,
            url.length,
            "[ABNT NBR 6023:2025] Endereço sem os rótulos da NBR 6023: use “Disponível em: <endereço>. Acesso em: dia mês ano.”"
          )
        );
      } else if (!disponivel) {
        avisos.push(
          avisoDe(
            entrada,
            url.index,
            url.length,
            "[ABNT NBR 6023:2025] Falta o rótulo “Disponível em:” antes do endereço (“Disponível em: <endereço>. Acesso em: dia mês ano.”)"
          )
        );
      } else if (!acesso) {
        avisos.push(
          avisoDe(
            entrada,
            disponivel.index,
            disponivel[0].length,
            acessado
              ? "[ABNT NBR 6023:2025] O rótulo previsto na NBR 6023 é “Acesso em: dia mês ano” — não “Acessado em”"
              : "[ABNT NBR 6023:2025] Referência online sem “Acesso em”: acrescente “Acesso em: dia mês ano” depois do “Disponível em”"
          )
        );
      }
    } else if (disponivel && !acesso) {
      avisos.push(
        avisoDe(
          entrada,
          disponivel.index,
          disponivel[0].length,
          "[ABNT NBR 6023:2025] Referência online sem “Acesso em”: acrescente “Acesso em: dia mês ano” depois do “Disponível em”"
        )
      );
    } else if (acessado && !acesso) {
      avisos.push(
        avisoDe(
          entrada,
          acessado.index,
          acessado[0].length,
          "[ABNT NBR 6023:2025] O rótulo previsto na NBR 6023 é “Acesso em: dia mês ano” — não “Acessado em”"
        )
      );
    }
  }
  return avisos;
};

// ---------------------------------------------------------------- R07 — lei

/** A referência de lei que COMEÇA pelo tipo (sem o órgão emissor antes). */
const LEI_INICIO =
  /^(?:Lei Complementar|Lei|Decreto-Lei|Decreto|Medida Provisória|Resolução|Portaria|Instrução Normativa|Emenda Constitucional)\b/i;

/** Onde o texto começa, pulando marcação de lista/título/citação e numeração. */
function inicioSemMarcacao(t: string): number {
  const semMarcas = t.replace(/^[\s>*_–—-]+/, "");
  const semNumero = semMarcas.replace(/^\d{1,3}[.)]\s+/, "");
  return t.length - semNumero.length;
}

/**
 * R07 — lei: número, data, órgão, publicação.
 *
 * O órgão emissor é o primeiro elemento ("BRASIL. Lei n. 8.112…"). O verificador
 * acusa a entrada que começa PELO TIPO ("Lei n. 8.112…"): o órgão ficou de fora.
 * Entrada que começa por outra palavra (o órgão, provavelmente) não é julgada.
 *
 * NÃO distingue: órgão presente mas incompleto ("Brasil. Lei…" sem ponto) passa;
 * número e data ausentes não são checados (o catálogo pede "sem órgão").
 */
const referenciaLei: Verificador = (doc) => {
  const avisos: Aviso[] = [];
  for (const entrada of entradas(doc)) {
    const t = entrada.texto;
    const inicio = inicioSemMarcacao(t);
    const m = LEI_INICIO.exec(t.slice(inicio));
    if (!m) continue;
    avisos.push(
      avisoDe(
        entrada,
        inicio + m.index,
        m[0].length,
        "[ABNT NBR 6023:2025] Referência de legislação sem o órgão emissor: ela começa pelo órgão (ex.: “BRASIL. Lei n. 8.112, de 11 de dezembro de 1990…”, “SÃO PAULO. Lei n. …”)"
      )
    );
  }
  return avisos;
};

// ---------------------------------------------------------------- R08 — tese/dissertação

/** O tipo do trabalho acadêmico: "Tese (Doutorado)", "TCC", "Trabalho de Conclusão de Curso". */
const TIPO_TRABALHO =
  /\b(?:tese|dissertação|monografia)\s*\(|\btrabalhos?\s+de\s+conclusão\s+de\s+curso\b|\btcc\b/i;

/** A instituição por palavra ("Universidade", "Faculdade", "Instituto"…). */
const INSTITUICAO = /universidad|faculdad|institut[oe]|escola|centro\s+universitário|cefet/i;

/** A instituição por sigla depois de travessão ou vírgula ("– UFPE,", ", USP,"). */
const SIGLA_INSTITUICAO = /(?:[–—]|,)\s*[A-ZÁÉÍÓÚÂÊÔÃÕÇ]{2,8}(?=[,.\s;)])/;

/**
 * R08 — tese/dissertação: tipo, instituição, ano.
 *
 * Entra pelo TIPO (comumente "Tese (Doutorado)", "Dissertação (Mestrado)", "TCC") e
 * cobra a instituição — e, com ela presente, o ano. Instituição por palavra ou por
 * sigla depois de travessão/vírgula ("– UFPE,"), que é como os manuais escrevem.
 *
 * NÃO distingue: "Tese" sem parênteses ("Tese de Doutorado") passa em silêncio; um
 * capítulo com "IFPE," de cidade/estado conta como instituição (falso negativo).
 */
const referenciaTese: Verificador = (doc) => {
  const avisos: Aviso[] = [];
  for (const entrada of entradas(doc)) {
    const t = entrada.texto;
    const tipo = TIPO_TRABALHO.exec(t);
    if (!tipo) continue;
    const temInstituicao = INSTITUICAO.test(t) || SIGLA_INSTITUICAO.test(t);
    if (!temInstituicao) {
      avisos.push(
        avisoDe(
          entrada,
          tipo.index,
          tipo[0].length,
          "[ABNT NBR 6023:2025] Referência de tese/dissertação sem a instituição: acrescente “– Universidade …” depois do tipo (“Tese (Doutorado) – Universidade Federal de …”)"
        )
      );
      continue;
    }
    if (!ANO.test(t)) {
      avisos.push(
        avisoDe(
          entrada,
          tipo.index,
          tipo[0].length,
          "[ABNT NBR 6023:2025] Referência de tese/dissertação sem o ano: acrescente o ano de defesa"
        )
      );
    }
  }
  return avisos;
};

// ---------------------------------------------------------------- R09 — evento

/** A publicação do evento: sem "In:" + Anais/Atas não há o que cobrar (e vira dúvida). */
const PUBLICACAO_EVENTO = /\b(?:anais|atas|proceedings)\b/i;

/**
 * R09 — evento: nome, ano, local; "In:" ata/anais.
 *
 * Entra pelo par "In:" + publicação (Anais/Atas), que é o trabalho APRESENTADO em
 * evento, e cobra o ano: a referência sem ano nenhum ("…, 10., São Paulo. Anais …")
 * não deixa o leitor achar o evento.
 *
 * NÃO distingue: evento sem a publicação (só "In: CONGRESSO…") passa em silêncio; o
 * ano da edição e o da publicação não são conferidos separadamente.
 */
const referenciaEvento: Verificador = (doc) => {
  const avisos: Aviso[] = [];
  for (const entrada of entradas(doc)) {
    const t = entrada.texto;
    if (!RE_IN.test(t)) continue;
    const publicacao = PUBLICACAO_EVENTO.exec(t);
    if (!publicacao) continue;
    if (ANO.test(t)) continue;
    avisos.push(
      avisoDe(
        entrada,
        publicacao.index,
        publicacao[0].length,
        "[ABNT NBR 6023:2025] Referência de trabalho em evento sem o ano: acrescente o ano do evento (“…, 10., 2020, São Paulo”) e o ano da publicação"
      )
    );
  }
  return avisos;
};

// ---------------------------------------------------------------- R10 — patente

/** A referência de patente: a palavra + um campo típico dela. */
const PATENTE = /\bpatentes?\b/i;
const CAMPO_PATENTE = /\b(?:depositante|dep[óo]sito|classificaç[ãa]o|registro|concess[ãa]o|procurador|int\.?\s*cl)/i;

/** Número de registro com cara de número ("PI 0604759-3", "US 4.295.282", "10 2019 012345"). */
const NUMERO_PATENTE = /\d[\d.\-/ ]{5,}\d/;

/**
 * R10 — patente: número, classificação, data.
 *
 * Entra pela palavra "patente" + um campo da forma ("Depositante:", "Classificação",
 * "Depósito:", "N. do registro:") e cobra o NÚMERO do registro. Sem a palavra e o
 * campo juntos, não julga: título de livro sobre patentes não vira acusação.
 *
 * NÃO distingue: depósito escrito como data ("Depósito: 12.10.2020") parece número e
 * cala a regra; classificação e data não são checadas separadamente.
 */
const referenciaPatente: Verificador = (doc) => {
  const avisos: Aviso[] = [];
  for (const entrada of entradas(doc)) {
    const t = entrada.texto;
    const patente = PATENTE.exec(t);
    if (!patente || !CAMPO_PATENTE.test(t)) continue;
    if (NUMERO_PATENTE.test(t)) continue;
    avisos.push(
      avisoDe(
        entrada,
        patente.index,
        patente[0].length,
        "[ABNT NBR 6023:2025] Referência de patente sem o número do registro: acrescente “N. do registro: …” e confira a classificação e a data do depósito"
      )
    );
  }
  return avisos;
};

export const VERIFICADORES: Record<string, Verificador> = {
  "referencia-livro": referenciaLivro,
  "referencia-capitulo": referenciaCapitulo,
  "referencia-artigo": referenciaArtigo,
  "referencia-site": referenciaSite,
  "referencia-lei": referenciaLei,
  "referencia-tese": referenciaTese,
  "referencia-evento": referenciaEvento,
  "referencia-patente": referenciaPatente,
};
