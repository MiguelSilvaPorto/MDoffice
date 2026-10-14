// O .docx EXPORTADO, conferido por dentro — NBR 14724:2024 (itens E04–E08 e E12).
//
// O motor ABNT (`src/broker/abnt/`) julga o TEXTO: ele não vê papel, margem, fonte nem
// paginação. Este módulo fecha a lacuna: abre o .docx com JSZip, varre o XML e executa
// as regras `tipo = "docx"` declaradas em `src/md/regras-docx/*.toml`, resolvendo o
// `verifica` de cada uma no mapa daqui. As regras NÃO entram em `src/broker/abnt/index.ts`
// — é outro pipeline, com outra carga (quem as executa é `verificarDocx`).
//
// O XML é lido por um varredor de tags, sem DOMParser: o validador também roda no Node
// dos testes, onde DOMParser não existe — e o que se lê são elementos planos e conhecidos
// (`w:sectPr`/`w:pgMar`/`w:pgSz`, `w:rFonts`/`w:sz`, `w:spacing`, `w:pgNumType`, `w:br`,
// `w:pageBreakBefore`, estilos de título). O que este leitor NÃO cobre está no fim do
// arquivo, para o relatório nunca dar falsa sensação de "tudo certo".

import JSZip from "jszip";
import { carregarRegras, type RegraToml } from "../broker/abnt";
import { opcaoNumero } from "../broker/abnt/verificadores/tipos";

import margensToml from "./regras-docx/margens.toml?raw";
import fonteToml from "./regras-docx/fonte.toml?raw";
import entrelinhaToml from "./regras-docx/entrelinha.toml?raw";
import papelToml from "./regras-docx/pagina.toml?raw";
import paginacaoToml from "./regras-docx/paginacao.toml?raw";
import secoesToml from "./regras-docx/secoes.toml?raw";

// ---------------------------------------------------------------- tipos

/** Um achado do arquivo: a regra que o produziu e a leitura que a violou. */
export interface AchadoDocx {
  id: string;
  norma: string;
  severidade: "error" | "warning" | "suggestion";
  mensagem: string;
}

/** Margens da seção em twips (só os lados declarados no `w:pgMar`). */
export interface MargensLidas {
  top?: number;
  right?: number;
  bottom?: number;
  left?: number;
}

export interface SecaoLida {
  margens: MargensLidas;
  /** `w:pgSz` em twips, ou `null` quando a seção não declara tamanho. */
  papel: { w: number; h: number } | null;
  /** atributos do `w:pgNumType` (vazio = elemento mudo, não numera nada). */
  paginacao: Record<string, string>;
  /** `w:type` da seção (`nextPage`, `continuous`…); ausente vale `nextPage`. */
  tipo: string;
}

/** Um run de texto com o que ele sobrescreve (`w:rPr`), se sobrescrever. */
export interface RunLido {
  fonte: string | null;
  tamanho: number | null;
  comprimento: number;
}

export interface ParagrafoLido {
  dentroDeTabela: boolean;
  estilo: string | null;
  espacamento: { linha: number | null; regra: string | null };
  pageBreakBefore: boolean;
  /** `w:type` da seção que termina neste parágrafo (`w:sectPr` no `w:pPr`), ou `null`. */
  sectPr: string | null;
  /** há `w:br w:type="page"` em qualquer ponto do parágrafo. */
  quebraPagina: boolean;
  /** a quebra de página vem antes de qualquer texto do parágrafo. */
  quebraAntesDoTexto: boolean;
  texto: string;
  runs: RunLido[];
}

export interface EstiloLido {
  nome: string | null;
  fonte: string | null;
  tamanho: number | null;
  linha: number | null;
  regraLinha: string | null;
}

/** O arquivo já lido: o que os verificadores de `tipo = "docx"` têm em mãos. */
export interface DocumentoDocx {
  secoes: SecaoLida[];
  paragrafos: ParagrafoLido[];
  estilos: Map<string, EstiloLido>;
  /** id do estilo → nível de título (1–6), do `styles.xml` (nome "Heading 1"/"Título 1"). */
  titulos: Map<string, number>;
  /** fonte/tamanho/entrelinha herdados (`w:docDefaults`, com o estilo Normal de reserva). */
  padrao: EstiloLido;
  /** há campo PAGE (ou `w:pgNum`) em documento, cabeçalho ou rodapé? */
  campoPagina: boolean;
}

// ---------------------------------------------------------------- XML

interface TagXml {
  nome: string;
  attrs: Record<string, string>;
  fechando: boolean;
  auto: boolean;
  inicio: number;
  fim: number;
  idx: number;
}

interface BlocoXml {
  attrs: Record<string, string>;
  conteudo: string;
}

/** Varre as tags do XML (sem parser de DOM), pulando comentários, PI e doctype. */
function varrerXml(xml: string): TagXml[] {
  const tags: TagXml[] = [];
  let i = 0;
  while (i < xml.length) {
    const lt = xml.indexOf("<", i);
    if (lt < 0) break;
    const seguinte = xml[lt + 1] ?? "";
    if (seguinte === "!" || seguinte === "?") {
      const fim = xml.indexOf(">", lt);
      i = fim < 0 ? xml.length : fim + 1;
      continue;
    }
    let j = lt + 1;
    let aspa = "";
    while (j < xml.length) {
      const c = xml[j];
      if (aspa) {
        if (c === aspa) aspa = "";
      } else if (c === '"' || c === "'") aspa = c;
      else if (c === ">") break;
      j++;
    }
    if (j >= xml.length) break;
    let corpo = xml.slice(lt + 1, j);
    i = j + 1;
    const fechando = corpo.startsWith("/");
    if (fechando) corpo = corpo.slice(1);
    let auto = false;
    if (corpo.endsWith("/")) {
      auto = true;
      corpo = corpo.slice(0, -1);
    }
    const nome = /^[A-Za-z_][\w:.-]*/.exec(corpo)?.[0];
    if (!nome) continue;
    const attrs: Record<string, string> = {};
    const re = /([A-Za-z_][\w:.-]*)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(corpo))) attrs[m[1]] = m[2] ?? m[3] ?? "";
    tags.push({ nome, attrs, fechando, auto, inicio: lt, fim: j, idx: tags.length });
  }
  return tags;
}

/** O conteúdo entre a tag e o seu fechamento (ou `""` numa tag auto-fechada). */
function conteudoDe(xml: string, tag: TagXml, tags: TagXml[]): BlocoXml {
  if (tag.auto) return { attrs: tag.attrs, conteudo: "" };
  let prof = 1;
  for (let k = tag.idx + 1; k < tags.length; k++) {
    const u = tags[k];
    if (u.nome !== tag.nome) continue;
    if (u.fechando) {
      prof--;
      if (!prof) return { attrs: tag.attrs, conteudo: xml.slice(tag.fim + 1, u.inicio) };
    } else if (!u.auto) prof++;
  }
  return { attrs: tag.attrs, conteudo: xml.slice(tag.fim + 1) };
}

/** O primeiro bloco do elemento `nome` dentro do XML (com os atributos dele). */
function blocoEm(xml: string, nome: string): BlocoXml | null {
  const tags = varrerXml(xml);
  const t = tags.find((x) => x.nome === nome && !x.fechando);
  return t ? conteudoDe(xml, t, tags) : null;
}

/** Todos os blocos do elemento `nome`, na ordem do arquivo. */
function blocosEm(xml: string, nome: string): BlocoXml[] {
  const tags = varrerXml(xml);
  const out: BlocoXml[] = [];
  for (const t of tags) {
    if (t.nome !== nome || t.fechando) continue;
    out.push(conteudoDe(xml, t, tags));
  }
  return out;
}

function textoDe(xml: string): string {
  let out = "";
  const re = /<w:t(?:\s[^>]*)?>([^<]*)<\/w:t>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml))) out += m[1];
  return out;
}

const inteiro = (v: string | undefined | null): number | null => {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? Math.round(n) : null;
};

const desligado = (v: string | undefined): boolean => v === "0" || v === "false" || v === "off";

// ---------------------------------------------------------------- leitura

function lerRuns(conteudo: string): RunLido[] {
  const tags = varrerXml(conteudo);
  const out: RunLido[] = [];
  for (const t of tags) {
    if (t.nome !== "w:r" || t.fechando) continue;
    const bloco = conteudoDe(conteudo, t, tags);
    const rPr = blocoEm(bloco.conteudo, "w:rPr");
    const rFonts = rPr ? blocoEm(rPr.conteudo, "w:rFonts") : null;
    const sz = rPr ? blocoEm(rPr.conteudo, "w:sz") : null;
    const fonte = rFonts ? rFonts.attrs["w:ascii"] ?? rFonts.attrs["w:hAnsi"] ?? rFonts.attrs["w:cs"] ?? null : null;
    const tamanho = sz ? inteiro(sz.attrs["w:val"]) : null;
    const comprimento = textoDe(bloco.conteudo).length;
    out.push({ fonte, tamanho, comprimento });
  }
  return out;
}

function lerParagrafo(conteudo: string, dentroDeTabela: boolean): ParagrafoLido {
  const pPr = blocoEm(conteudo, "w:pPr");
  const pPrTxt = pPr?.conteudo ?? "";
  const estilo = blocoEm(pPrTxt, "w:pStyle")?.attrs["w:val"] ?? null;
  const espac = blocoEm(pPrTxt, "w:spacing");
  const sect = blocoEm(pPrTxt, "w:sectPr");
  const sectTipo = sect ? blocoEm(sect.conteudo, "w:type")?.attrs["w:val"] ?? "nextPage" : null;
  const pbb = blocoEm(pPrTxt, "w:pageBreakBefore");

  let texto = "";
  let primeiroTexto = -1;
  const re = /<w:t(?:\s[^>]*)?>([^<]*)<\/w:t>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(conteudo))) {
    texto += m[1];
    if (primeiroTexto < 0 && m[1].trim()) primeiroTexto = m.index;
  }
  let quebra = false;
  let quebraAntes = false;
  for (const t of varrerXml(conteudo)) {
    if (t.nome !== "w:br" || t.fechando) continue;
    if ((t.attrs["w:type"] ?? "textWrapping") !== "page") continue;
    quebra = true;
    if (primeiroTexto < 0 || t.inicio < primeiroTexto) quebraAntes = true;
  }

  return {
    dentroDeTabela,
    estilo,
    espacamento: { linha: espac ? inteiro(espac.attrs["w:line"]) : null, regra: espac?.attrs["w:lineRule"] ?? null },
    pageBreakBefore: pbb !== null && !desligado(pbb.attrs["w:val"]),
    sectPr: sectTipo,
    quebraPagina: quebra,
    quebraAntesDoTexto: quebraAntes,
    texto,
    runs: lerRuns(conteudo),
  };
}

function lerSecao(conteudo: string): SecaoLida {
  const pgMar = blocoEm(conteudo, "w:pgMar");
  const margens: MargensLidas = {};
  if (pgMar) {
    for (const lado of ["top", "right", "bottom", "left"] as const) {
      const v = inteiro(pgMar.attrs[`w:${lado}`]);
      if (v != null) margens[lado] = v;
    }
  }
  const pgSz = blocoEm(conteudo, "w:pgSz");
  const w = pgSz ? inteiro(pgSz.attrs["w:w"]) : null;
  const h = pgSz ? inteiro(pgSz.attrs["w:h"]) : null;
  const pgNum = blocoEm(conteudo, "w:pgNumType");
  return {
    margens,
    papel: w != null && h != null ? { w, h } : null,
    paginacao: pgNum ? { ...pgNum.attrs } : {},
    tipo: blocoEm(conteudo, "w:type")?.attrs["w:val"] ?? "nextPage",
  };
}

function lerCorpo(xml: string): { paragrafos: ParagrafoLido[]; secoes: SecaoLida[] } {
  const tags = varrerXml(xml);
  const paragrafos: ParagrafoLido[] = [];
  const secoes: SecaoLida[] = [];
  let profTabela = 0;
  for (const t of tags) {
    if (t.nome === "w:tbl") {
      if (t.fechando) profTabela = Math.max(0, profTabela - 1);
      else if (!t.auto) profTabela++;
      continue;
    }
    if (t.fechando) continue;
    if (t.nome === "w:sectPr") secoes.push(lerSecao(conteudoDe(xml, t, tags).conteudo));
    else if (t.nome === "w:p") paragrafos.push(lerParagrafo(conteudoDe(xml, t, tags).conteudo, profTabela > 0));
  }
  return { paragrafos, secoes };
}

function fonteDe(rPr: string | null): string | null {
  if (!rPr) return null;
  const b = blocoEm(rPr, "w:rFonts");
  return b ? b.attrs["w:ascii"] ?? b.attrs["w:hAnsi"] ?? b.attrs["w:cs"] ?? null : null;
}

function tamanhoDe(rPr: string | null): number | null {
  const b = rPr ? blocoEm(rPr, "w:sz") : null;
  return b ? inteiro(b.attrs["w:val"]) : null;
}

function nivelDeTitulo(id: string, nome: string | null): number | null {
  const casar = (texto: string): number | null => {
    const m = /(?:heading|t[íi]tulo|ttulo)\s*([1-6])(?![0-9])/i.exec(texto);
    return m ? Number(m[1]) : null;
  };
  return (nome ? casar(nome) : null) ?? casar(id);
}

function lerEstilos(xml: string): { estilos: Map<string, EstiloLido>; titulos: Map<string, number>; padrao: EstiloLido } {
  const estilos = new Map<string, EstiloLido>();
  const titulos = new Map<string, number>();
  for (const b of blocosEm(xml, "w:style")) {
    const id = b.attrs["w:styleId"];
    if (!id) continue;
    const nome = blocoEm(b.conteudo, "w:name")?.attrs["w:val"] ?? null;
    const rPr = blocoEm(b.conteudo, "w:rPr")?.conteudo ?? null;
    const pPr = blocoEm(b.conteudo, "w:pPr")?.conteudo ?? null;
    const espac = pPr ? blocoEm(pPr, "w:spacing") : null;
    estilos.set(id, {
      nome,
      fonte: fonteDe(rPr),
      tamanho: tamanhoDe(rPr),
      linha: espac ? inteiro(espac.attrs["w:line"]) : null,
      regraLinha: espac?.attrs["w:lineRule"] ?? null,
    });
    const nivel = nivelDeTitulo(id, nome);
    if (nivel) titulos.set(id, nivel);
  }

  const dd = blocoEm(xml, "w:docDefaults")?.conteudo ?? "";
  const rPr = blocoEm(blocoEm(dd, "w:rPrDefault")?.conteudo ?? "", "w:rPr")?.conteudo ?? null;
  const pPr = blocoEm(blocoEm(dd, "w:pPrDefault")?.conteudo ?? "", "w:pPr")?.conteudo ?? null;
  const espac = pPr ? blocoEm(pPr, "w:spacing") : null;
  const padrao: EstiloLido = {
    nome: null,
    fonte: fonteDe(rPr),
    tamanho: tamanhoDe(rPr),
    linha: espac ? inteiro(espac.attrs["w:line"]) : null,
    regraLinha: espac?.attrs["w:lineRule"] ?? null,
  };
  const normal = estilos.get("Normal");
  if (normal) {
    if (padrao.fonte === null) padrao.fonte = normal.fonte;
    if (padrao.tamanho === null) padrao.tamanho = normal.tamanho;
    if (padrao.linha === null) {
      padrao.linha = normal.linha;
      padrao.regraLinha = normal.regraLinha;
    }
  }
  return { estilos, titulos, padrao };
}

/** Campo PAGE (ou o elemento `w:pgNum`) — a marca de que a página é numerada. */
function temNumeracao(xml: string): boolean {
  if (/<w:pgNum\b/.test(xml)) return true;
  for (const m of xml.matchAll(/<w:instrText[^>]*>([^<]*)<\/w:instrText>/g)) if (/\bPAGE\b/i.test(m[1])) return true;
  for (const m of xml.matchAll(/<w:fldSimple[^>]*>/g)) {
    const instr = /w:instr="([^"]*)"/.exec(m[0]);
    if (instr && /\bPAGE\b/i.test(instr[1])) return true;
  }
  return false;
}

async function bytesDe(entrada: Uint8Array | ArrayBuffer | string): Promise<Uint8Array> {
  if (typeof entrada === "string") {
    // Caminho só existe fora do navegador: a importação é dinâmica e opaca para o bundler.
    const modulo = "node:fs/promises";
    const fs = (await import(/* @vite-ignore */ modulo)) as { readFile(caminho: string): Promise<Uint8Array> };
    return new Uint8Array(await fs.readFile(entrada));
  }
  return entrada instanceof Uint8Array ? entrada : new Uint8Array(entrada);
}

/** Abre o .docx e devolve o que os verificadores leem (sem julgar nada). */
export async function lerDocx(entrada: Uint8Array | ArrayBuffer | string): Promise<DocumentoDocx> {
  const zip = await JSZip.loadAsync(await bytesDe(entrada));
  const arquivo = zip.file("word/document.xml");
  if (!arquivo) throw new Error("Este arquivo não parece ser um .docx (falta word/document.xml).");
  const xmlDocumento = await arquivo.async("string");
  const xmlEstilos = (await zip.file("word/styles.xml")?.async("string")) ?? "";
  const { paragrafos, secoes } = lerCorpo(xmlDocumento);
  const { estilos, titulos, padrao } = lerEstilos(xmlEstilos);
  let campoPagina = temNumeracao(xmlDocumento);
  if (!campoPagina) {
    for (const nome of Object.keys(zip.files)) {
      if (!/^word\/(header|footer)\d*\.xml$/.test(nome)) continue;
      const parte = zip.file(nome);
      if (parte && temNumeracao(await parte.async("string"))) {
        campoPagina = true;
        break;
      }
    }
  }
  return { secoes, paragrafos, estilos, titulos, padrao, campoPagina };
}

// ---------------------------------------------------------------- julgamento

type Verificacao = (doc: DocumentoDocx, regra: RegraToml) => string[];

const TWIPS_POR_CM = 566.93;
const FONTES_ABNT = ["arial", "times new roman"];
/** 1,5 de entrelinha no Word: `w:line` em vigésimos de ponto, com `lineRule="auto"`. */
const LINHA_1_5 = 360;
/** Folga aceita em twips (≈ 0,05 cm) para não acusar arredondamento de conversão. */
const TOLERANCIA = 28;

function formatarCm(twips: number): string {
  const cm = Math.round((twips / TWIPS_POR_CM) * 10) / 10;
  return `${String(cm).replace(".", ",")} cm`;
}

function formatarPontos(meiosPontos: number): string {
  const pt = meiosPontos / 2;
  return `${String(Number.isInteger(pt) ? pt : pt.toFixed(1)).replace(".", ",")} pt`;
}

function formatarEntrelinha(linha: number): string {
  const v = Math.round((linha / 240) * 100) / 100;
  return String(v).replace(".", ",");
}

/** A chave de maior peso (empate: a primeira na ordem em que entrou). */
function maior<K>(mapa: Map<K, number>): { chave: K; peso: number } | null {
  let melhor: { chave: K; peso: number } | null = null;
  for (const [chave, peso] of mapa) if (!melhor || peso > melhor.peso) melhor = { chave, peso };
  return melhor;
}

function ehTitulo(doc: DocumentoDocx, p: ParagrafoLido): boolean {
  if (!p.estilo) return false;
  return doc.titulos.has(p.estilo) || /^(?:heading|t[íi]tulo|ttulo)\s*[1-6]$/i.test(p.estilo);
}

function nivelDoParagrafo(doc: DocumentoDocx, p: ParagrafoLido): number | null {
  if (!p.estilo) return null;
  return doc.titulos.get(p.estilo) ?? nivelDeTitulo(p.estilo, null);
}

/**
 * Os parágrafos que valem como "corpo": fora de tabela, sem estilo de título, com texto.
 * Prefere os longos (≥ `minimo` caracteres) — legenda e rótulo curto podem ter formatação
 * própria legítima; se não houver nenhum longo, cai para todos.
 */
function paragrafosDoCorpo(doc: DocumentoDocx, minimo: number): ParagrafoLido[] {
  const todos = doc.paragrafos.filter((p) => !p.dentroDeTabela && !ehTitulo(doc, p) && p.texto.trim().length > 0);
  const longos = todos.filter((p) => p.texto.trim().length >= minimo);
  return longos.length ? longos : todos;
}

function verificacaoMargens(doc: DocumentoDocx, regra: RegraToml): string[] {
  const tol = opcaoNumero(regra, "tolerancia", TOLERANCIA);
  const minimos: [keyof MargensLidas, number, string][] = [
    ["top", 1701, "superior"],
    ["left", 1701, "esquerda"],
    ["bottom", 1134, "inferior"],
    ["right", 1134, "direita"],
  ];
  const problemas = new Set<string>();
  let viu = false;
  for (const s of doc.secoes) {
    for (const [lado, min, nome] of minimos) {
      const v = s.margens[lado];
      if (v == null) continue;
      viu = true;
      if (v < min - tol) problemas.add(`${nome} = ${formatarCm(v)}`);
    }
  }
  if (!viu || !problemas.size) return [];
  return [
    `[ABNT NBR 14724:2024] Margens fora do padrão 3-2-3-2: ${[...problemas].join("; ")} ` +
      `(o mínimo é 3 cm na esquerda e no topo, 2 cm na direita e na base). Ajuste a configuração de página.`,
  ];
}

function verificacaoFonte(doc: DocumentoDocx): string[] {
  const porFonte = new Map<string, number>();
  const porTamanho = new Map<number, number>();
  for (const p of paragrafosDoCorpo(doc, 40)) {
    const estilo = p.estilo ? doc.estilos.get(p.estilo) ?? null : null;
    for (const r of p.runs) {
      if (!r.comprimento) continue;
      const fonte = r.fonte ?? estilo?.fonte ?? doc.padrao.fonte ?? null;
      const tamanho = r.tamanho ?? estilo?.tamanho ?? doc.padrao.tamanho ?? null;
      if (fonte) porFonte.set(fonte, (porFonte.get(fonte) ?? 0) + r.comprimento);
      if (tamanho != null) porTamanho.set(tamanho, (porTamanho.get(tamanho) ?? 0) + r.comprimento);
    }
  }
  const principalFonte = maior(porFonte);
  const principalTamanho = maior(porTamanho);
  const partes: string[] = [];
  if (principalFonte && !FONTES_ABNT.includes(principalFonte.chave.trim().toLowerCase())) {
    partes.push(`a fonte é ${principalFonte.chave} (o padrão é Arial ou Times New Roman)`);
  }
  if (principalTamanho && principalTamanho.chave !== 24) {
    partes.push(`o tamanho é ${formatarPontos(principalTamanho.chave)} (o padrão é 12 pt)`);
  }
  if (!partes.length) return [];
  return [`[ABNT NBR 14724:2024] No texto corrido, ${partes.join(" e ")}. Ajuste a fonte do corpo do trabalho.`];
}

function verificacaoEntrelinha(doc: DocumentoDocx): string[] {
  const porLinha = new Map<number, number>();
  for (const p of paragrafosDoCorpo(doc, 40)) {
    const estilo = p.estilo ? doc.estilos.get(p.estilo) ?? null : null;
    const linha = p.espacamento.linha ?? estilo?.linha ?? doc.padrao.linha ?? null;
    const regra = p.espacamento.regra ?? estilo?.regraLinha ?? doc.padrao.regraLinha ?? null;
    if (linha == null) continue;
    // "exata"/"no mínimo" não é o mesmo que 1,5: sem como julgar, silêncio.
    if (regra && regra !== "auto") continue;
    porLinha.set(linha, (porLinha.get(linha) ?? 0) + p.texto.trim().length);
  }
  const principal = maior(porLinha);
  if (!principal || principal.chave === LINHA_1_5) return [];
  return [
    `[ABNT NBR 14724:2024] O texto corrido está com entrelinha ${formatarEntrelinha(principal.chave)} ` +
      `(o padrão é 1,5). Espaçamento simples vale para citações longas, notas, legendas e tabelas.`,
  ];
}

function verificacaoPapel(doc: DocumentoDocx): string[] {
  const problemas = new Set<string>();
  let viu = false;
  for (const s of doc.secoes) {
    if (!s.papel) continue;
    viu = true;
    const { w, h } = s.papel;
    const retrato = Math.abs(w - 11906) <= TOLERANCIA && Math.abs(h - 16838) <= TOLERANCIA;
    const paisagem = Math.abs(w - 16838) <= TOLERANCIA && Math.abs(h - 11906) <= TOLERANCIA;
    if (retrato || paisagem) continue;
    if (Math.abs(w - 12240) <= TOLERANCIA && Math.abs(h - 15840) <= TOLERANCIA) problemas.add("Carta (Letter), 21,6 × 27,9 cm");
    else problemas.add(`${formatarCm(w)} × ${formatarCm(h)}`);
  }
  if (!viu || !problemas.size) return [];
  return [
    `[ABNT NBR 14724:2024] O papel do documento não é A4 (21 × 29,7 cm): a seção usa ${[...problemas].join("; ")}. ` +
      `Ajuste o tamanho da página.`,
  ];
}

function verificacaoPaginacao(doc: DocumentoDocx): string[] {
  // `w:pgNumType` com atributo (formato/início) já é sinal de numeração — a favor do
  // arquivo; o que acusa é a ausência total (elemento mudo, sem campo PAGE em parte alguma).
  const configurada = doc.secoes.some((s) => Object.keys(s.paginacao).length > 0);
  if (doc.campoPagina || configurada) return [];
  return [
    "[ABNT NBR 14724:2024] O documento não tem paginação: não há campo PAGE no cabeçalho/rodapé nem numeração " +
      "configurada na seção. A NBR pede o número no canto superior direito, a partir da introdução, contando desde a folha de rosto.",
  ];
}

function nomeCurto(texto: string): string {
  const t = texto.replace(/\s+/g, " ").trim();
  return t.length > 48 ? `${t.slice(0, 47)}…` : t;
}

function verificacaoSecoes(doc: DocumentoDocx): string[] {
  const primarias = doc.paragrafos
    .map((p, i) => ({ p, i, nivel: nivelDoParagrafo(doc, p) }))
    .filter((x) => x.nivel === 1);
  if (primarias.length < 2) return [];
  const semQuebra: string[] = [];
  for (const { p, i } of primarias) {
    const viuConteudo = doc.paragrafos.slice(0, i).some((x) => x.texto.trim().length > 0);
    if (!viuConteudo) continue; // a seção que abre o documento já começa na página 1
    const naPropria = p.pageBreakBefore || p.quebraAntesDoTexto || (p.sectPr !== null && p.sectPr !== "continuous");
    const anterior = doc.paragrafos[i - 1];
    const naAnterior = anterior
      ? anterior.quebraPagina || (anterior.sectPr !== null && anterior.sectPr !== "continuous" && !anterior.dentroDeTabela)
      : false;
    if (!naPropria && !naAnterior) semQuebra.push(nomeCurto(p.texto));
  }
  if (!semQuebra.length) return [];
  const lista =
    semQuebra.slice(0, 4).map((n) => `“${n}”`).join(", ") + (semQuebra.length > 4 ? ` e mais ${semQuebra.length - 4}` : "");
  return [
    `[ABNT NBR 14724:2024] Estas seções primárias não começam em página nova: ${lista}. ` +
      `Insira quebra de página (ou de seção) antes de cada seção primária.`,
  ];
}

/** `verifica` do TOML → julgamento. Um verificador devolve as violações que encontra. */
export const VERIFICACOES_DOCX: Record<string, Verificacao> = {
  margens: verificacaoMargens,
  "fonte-corpo": verificacaoFonte,
  "entrelinha-corpo": verificacaoEntrelinha,
  "papel-a4": verificacaoPapel,
  paginacao: verificacaoPaginacao,
  "secoes-em-pagina-nova": verificacaoSecoes,
};

/** As regras do arquivo exportado (mesmo `carregarRegras` do motor, fontes próprias). */
export const REGRAS_DOCX: RegraToml[] = carregarRegras([
  { nome: "margens.toml", texto: margensToml },
  { nome: "fonte.toml", texto: fonteToml },
  { nome: "entrelinha.toml", texto: entrelinhaToml },
  { nome: "pagina.toml", texto: papelToml },
  { nome: "paginacao.toml", texto: paginacaoToml },
  { nome: "secoes.toml", texto: secoesToml },
]);

/**
 * Confere o .docx exportado contra as regras `tipo = "docx"` (padrão: `REGRAS_DOCX`).
 *
 * Aceita bytes (`Uint8Array`/`Buffer`/`ArrayBuffer`) ou caminho do arquivo — o caminho
 * só funciona fora do navegador. Devolve os achados; arquivo sem `word/document.xml`
 * derruba (não é um .docx). Regra `docx` com `verifica` desconhecido também derruba:
 * regra pela metade não passa em silêncio.
 */
export async function verificarDocx(
  entrada: Uint8Array | ArrayBuffer | string,
  regras: RegraToml[] = REGRAS_DOCX
): Promise<AchadoDocx[]> {
  const doc = await lerDocx(entrada);
  const achados: AchadoDocx[] = [];
  for (const regra of regras) {
    if ((regra.tipo ?? "texto") !== "docx") continue;
    if (!regra.verifica) throw new Error(`regra ${regra.id}: tipo "docx" sem verifica`);
    const executa = VERIFICACOES_DOCX[regra.verifica];
    if (!executa) throw new Error(`regra ${regra.id}: verificador de .docx desconhecido: ${regra.verifica}`);
    for (const mensagem of executa(doc, regra)) {
      achados.push({ id: regra.id, norma: regra.norma, severidade: regra.severidade, mensagem });
    }
  }
  return achados.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : a.mensagem.localeCompare(b.mensagem)));
}

// Limites honestos deste leitor (para o relatório não prometer o que não entrega):
// - não resolve cadeia de estilos (`basedOn`, `w:rStyle`, tabela de estilos do documento
//   inteiro): lê run → estilo do parágrafo → docDefaults/Normal; formatação direta é lida,
//   herança profunda não;
// - recuos (`w:ind`), legendas, citações longas e notas não são julgados aqui: as regras
//   deste grupo (E04–E08/E12) não os pedem;
// - paginação só acusa a AUSÊNCIA total; posição (canto), formato e página inicial não
//   são conferidos — confiança média, como manda o catálogo (E08);
// - quebra de seção primária depende de o arquivo usar estilo de título (Heading 1/Título 1);
//   título formatado "na mão" (negrito + tamanho, sem estilo) não é visto (E12).
