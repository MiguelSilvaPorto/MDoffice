// Gera os bytes de um .xlsx a partir do Livro do motor.
//
// Um .xlsx é um ZIP com XML dentro (o mesmo formato do .docx e do .pptx). As
// partes escritas são as mínimas que o Excel e o LibreOffice precisam:
//
//   [Content_Types].xml        o que existe dentro do pacote
//   _rels/.rels                liga o pacote ao xl/workbook.xml
//   xl/workbook.xml            a lista de abas
//   xl/_rels/workbook.xml.rels liga cada aba ao seu XML
//   xl/worksheets/sheetN.xml   as células de cada aba
//   xl/styles.xml              fontes, cores, alinhamentos e formatos de número
//   xl/sharedStrings.xml       os textos repetidos
//   docProps/core.xml, app.xml metadados
//
// Usa o JSZip (já dependência do app, como no pptximport) para fechar o ZIP.

import type { Celula, Estilo, Folha, Livro } from "../schema";
import { dataDe, dataParaSerial, ehErro, ehPercentual, ErroFormula, numeroDe } from "../values";
import { calcular, ehFormula, formulaParaXlsx, type Contexto, type Operando } from "../formula";
import { intervalo, nomeColuna, partes as partesRef, percorrer, ref } from "../refs";
import { CONFIG_PADRAO } from "../model";

export interface OpcoesXlsx {
  /** título do documento (vai nos metadados) */
  titulo?: string;
  /** autor dos metadados */
  autor?: string;
  /** mostrar as linhas da grade ao abrir */
  grade?: boolean;
  /** casas decimais padrão do livro */
  casas?: number;
}

// ---------- texto ----------

/** Escapa texto e remove os caracteres de controle que o XML não aceita. */
function escapar(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;")
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "");
}

/** Cor de 6 dígitos (RRGGBB) ou null. */
function corHex(cor?: string): string | null {
  if (!cor) return null;
  const limpo = cor.replace(/^#/, "").toUpperCase();
  return /^[0-9A-F]{6}$/.test(limpo) ? limpo : null;
}

const isoAgora = (): string => new Date().toISOString().replace(/\.\d+Z$/, "Z");

// ---------- tabela de estilos ----------

/**
 * O .xlsx guarda estilos por índice (o atributo s="3" da célula). Esta função
 * percorre todas as células e monta a lista de estilos sem repetição, na ordem
 * em que aparecem (o índice 0 é sempre o padrão, como o Excel espera).
 */
interface TabelaEstilos {
  /** índice de cada estilo próprio usado */
  indice: Map<string, number>;
  /** o estilo de cada índice (posição 0 é o padrão) */
  xfs: Estilo[];
}

function chaveEstilo(e: Estilo | undefined): string {
  if (!e) return "-";
  return [
    e.negrito ? 1 : 0,
    e.italico ? 1 : 0,
    e.fonte ?? "",
    e.tamanho ?? "",
    corHex(e.cor) ?? "",
    corHex(e.fundo) ?? "",
    e.alinhamento ?? "",
    e.numero ?? "",
    e.casas ?? "",
  ].join("|");
}

function montarEstilos(livro: Livro): TabelaEstilos {
  const xfs: Estilo[] = [{}]; // índice 0 = padrão
  const indice = new Map<string, number>([["-", 0]]);
  for (const f of livro.folhas) {
    for (const c of Object.values(f.celulas)) {
      const k = chaveEstilo(c.estilo);
      if (indice.has(k)) continue;
      indice.set(k, xfs.length);
      xfs.push(c.estilo ?? {});
    }
  }
  return { indice, xfs };
}

/** numFmtId do Excel: abaixo de 164 são padrões; -1 pede um id novo (164, 165…). */
function numFmt(e: Estilo | undefined, casasPadrao: number): { id: number; codigo?: string } {
  if (!e?.numero || e.numero === "geral") return { id: 0 };
  const casas = Number.isInteger(e.casas) ? (e.casas as number) : casasPadrao;
  const zeros = "0".repeat(Math.max(0, Math.min(10, casas)));
  switch (e.numero) {
    case "decimal":
      if (casas === 0) return { id: 1 }; // "0"
      if (casas === 2) return { id: 2 }; // "0.00"
      return { id: -1, codigo: `#,##0${casas ? `.${zeros}` : ""}` };
    case "moeda":
      return { id: -1, codigo: `"R$" #,##0${casas ? `.${zeros}` : ""}` };
    case "porcento":
      if (casas === 0) return { id: 9 }; // "0%"
      if (casas === 2) return { id: 10 }; // "0.00%"
      return { id: -1, codigo: `0.${zeros}%` };
    case "data":
      return { id: -1, codigo: "dd/mm/yyyy" };
    default:
      return { id: 0 };
  }
}

/** Gera xl/styles.xml. */
function estilosXml(tab: TabelaEstilos, casasPadrao: number): string {
  // cada código distinto ganha um id próprio: antes TODOS os formatos personalizados
  // usavam 164, e o último sobrescrevia os outros no mapa (moeda virava data etc.)
  const formatos = new Map<number, string>();
  const idPorCodigo = new Map<string, number>();
  let proximoId = 164;
  const resolverId = (f: { id: number; codigo?: string }): number => {
    if (f.id >= 0) return f.id;
    const codigo = f.codigo ?? "0";
    const existente = idPorCodigo.get(codigo);
    if (existente !== undefined) return existente;
    const id = proximoId++;
    idPorCodigo.set(codigo, id);
    formatos.set(id, codigo);
    return id;
  };
  const ids = tab.xfs.map((e) => resolverId(numFmt(e, casasPadrao)));

  // fontes e preenchimentos. No XML o Excel exige que as DUAS primeiras
  // entradas de <fills> sejam "none" e "gray125"; por isso um preenchimento
  // próprio começa no índice 2 (e o índice 0 é "sem preenchimento").
  const fontes: { b: boolean; i: boolean; cor: string | null; nome: string; tamanho: number }[] = [
    { b: false, i: false, cor: null, nome: "Calibri", tamanho: 11 },
  ];
  const indiceFonte = new Map<string, number>([["0||Calibri|11", 0]]);
  const preenchimentos: string[] = [];
  const indicePreench = new Map<string, number>([["", 0]]);

  const registrarFonte = (e: Estilo | undefined): number => {
    const cor = corHex(e?.cor);
    const nome = (e?.fonte ?? "Calibri").trim() || "Calibri";
    const tamanho = Number.isFinite(e?.tamanho) ? Math.max(6, Math.min(96, e!.tamanho!)) : 11;
    const k = `${e?.negrito ? 1 : 0}|${e?.italico ? 1 : 0}|${cor ?? ""}|${nome}|${tamanho}`;
    const ja = indiceFonte.get(k);
    if (ja !== undefined) return ja;
    const i = fontes.length;
    fontes.push({ b: !!e?.negrito, i: !!e?.italico, cor, nome, tamanho });
    indiceFonte.set(k, i);
    return i;
  };
  const registrarPreench = (e: Estilo | undefined): number => {
    const cor = corHex(e?.fundo);
    if (!cor) return 0;
    const ja = indicePreench.get(cor);
    if (ja !== undefined) return ja;
    preenchimentos.push(cor);
    const i = preenchimentos.length + 1; // o XML já tem "none" e "gray125" antes
    indicePreench.set(cor, i);
    return i;
  };

  const xfXml: string[] = [];
  for (let i = 0; i < tab.xfs.length; i++) {
    const e = tab.xfs[i];
    const id = ids[i];
    const fontId = registrarFonte(e);
    const fillId = registrarPreench(e);
    const partes = [
      `numFmtId="${id}"`,
      `fontId="${fontId}"`,
      `fillId="${fillId}"`,
      'borderId="0"',
      'xfId="0"',
    ];
    if (id) partes.push('applyNumberFormat="1"');
    if (fontId) partes.push('applyFont="1"');
    if (fillId) partes.push('applyFill="1"');
    if (e?.alinhamento) {
      // o XML do Excel usa os nomes em inglês (left/center/right/justify)
      const css =
        e.alinhamento === "esquerda"
          ? "left"
          : e.alinhamento === "direita"
            ? "right"
            : e.alinhamento === "justificado"
              ? "justify"
              : "center";
      partes.push('applyAlignment="1"');
      xfXml.push(
        `<xf ${partes.join(" ")}><alignment horizontal="${css}" vertical="center"/></xf>`
      );
    } else {
      xfXml.push(`<xf ${partes.join(" ")}/>`);
    }
  }

  const numFmtsXml = formatos.size
    ? `<numFmts count="${formatos.size}">${[...formatos.entries()]
        .map(([id, codigo]) => `<numFmt numFmtId="${id}" formatCode="${escapar(codigo)}"/>`)
        .join("")}</numFmts>`
    : "";

  const fontsXml = `<fonts count="${fontes.length}">${fontes
    .map((f) => {
      const p = [f.b ? "<b/>" : "", f.i ? "<i/>" : "", `<sz val="${f.tamanho}"/>`];
      if (f.cor) p.push(`<color rgb="FF${f.cor}"/>`);
      p.push(`<name val="${escapar(f.nome)}"/>`);
      return `<font>${p.filter(Boolean).join("")}</font>`;
    })
    .join("")}</fonts>`;

  const fillsXml = `<fills count="${preenchimentos.length + 2}"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill>${preenchimentos
    .map(
      (cor) =>
        `<fill><patternFill patternType="solid"><fgColor rgb="FF${cor}"/><bgColor indexed="64"/></patternFill></fill>`
    )
    .join("")}</fills>`;

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">${numFmtsXml}${fontsXml}${fillsXml}<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="${xfXml.length}">${xfXml.join("")}</cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`;
}

// ---------- textos compartilhados ----------

/** Textos repetidos vão para xl/sharedStrings.xml (é assim que o Excel guarda). */
function sharedStrings(livro: Livro): { indice: Map<string, number>; xml: string } {
  const ordem: string[] = [];
  const indice = new Map<string, number>();
  const ehTexto = (c: Celula): boolean => {
    if (c.formula || ehFormula(c.texto)) return false;
    if (ehBooleano(c)) return false;
    if (numeroDe(c.texto) !== null && !ehPercentual(c.texto)) return false;
    if (ehPercentual(c.texto)) return false; // porcentagem é número no Excel
    if (serialDe(c.texto) !== null) return false; // data também é número (serial)
    return true;
  };
  for (const f of livro.folhas) {
    for (const c of Object.values(f.celulas)) {
      if (!ehTexto(c)) continue;
      if (indice.has(c.texto)) continue;
      indice.set(c.texto, ordem.length);
      ordem.push(c.texto);
    }
  }
  const corpo = ordem.map((t) => `<si><t xml:space="preserve">${escapar(t)}</t></si>`).join("");
  return {
    indice,
    xml: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="${ordem.length}" uniqueCount="${ordem.length}">${corpo}</sst>`,
  };
}

// ---------- valores ----------

/** Reconhece dd/mm/aaaa, aaaa-mm-dd e data com hora; devolve o serial do Excel. */
function serialDe(texto: string): number | null {
  const d = dataDe(texto);
  return d ? dataParaSerial(d) : null;
}

/** O número que o Excel deve gravar para esta célula (ou null se for texto). */
function numeroDaCelula(c: Celula): number | null {
  const s = c.texto.trim();
  if (s === "VERDADEIRO" || s === "TRUE") return 1;
  if (s === "FALSO" || s === "FALSE") return 0;
  // data primeiro: "01/01/2026" não é número, é serial
  const data = serialDe(s);
  if (data !== null) return data;
  const pct = ehPercentual(s);
  const n = numeroDe(s);
  if (n !== null) return pct ? n / 100 : n;
  return null;
}

/** Códigos de erro do motor (português) para os códigos que o OOXML aceita. */
const ERRO_XLSX: Record<string, string> = {
  "#VALOR!": "#VALUE!",
  "#NÚM!": "#NUM!",
  "#NOME?": "#NAME?",
  "#CIRC!": "#REF!",
  "#ERRO!": "#VALUE!",
  "#REF!": "#REF!",
  "#DIV/0!": "#DIV/0!",
};

function codigoErroXlsx(codigo: string): string {
  const limpo = codigo.replace(/\s*\(.*\)$/, "");
  return ERRO_XLSX[limpo] ?? limpo;
}

const ehBooleano = (c: Celula): boolean => {
  const s = c.texto.trim().toUpperCase();
  return s === "VERDADEIRO" || s === "TRUE" || s === "FALSO" || s === "FALSE";
};

/** Contexto de cálculo para gravar o resultado em cache junto da fórmula. */
function contextoDaFolha(f: Folha): Contexto {
  const vistos = new Set<string>();
  const calc = (refA1: string): Operando => {
    const c = f.celulas[refA1];
    if (!c || !c.texto) return null;
    if (vistos.has(refA1)) return new ErroFormula("#CIRC!");
    vistos.add(refA1);
    try {
      if (c.formula || ehFormula(c.texto)) {
        return calcular(c.texto, {
          valorDe: (alvo) => calc(alvo),
          faixaAlvo: (alvo) => {
            const out: Operando[] = [];
            for (const { linha, col } of percorrer(alvo)) out.push(calc(ref(linha, col)));
            return out;
          },
        });
      }
      const n = numeroDaCelula(c);
      return n === null ? c.texto : n;
    } finally {
      vistos.delete(refA1);
    }
  };
  return {
    valorDe: (alvo) => calc(alvo),
    faixaAlvo: (alvo) => {
      const out: Operando[] = [];
      for (const { linha, col } of percorrer(alvo)) out.push(calc(ref(linha, col)));
      return out;
    },
  };
}

/** <c> de uma célula: o atributo s traz o índice do estilo. */
function celulaXml(refA1: string, c: Celula, estiloId: number, f: Folha, ss: Map<string, number>): string {
  const s = estiloId ? ` s="${estiloId}"` : "";
  const formula = c.formula || ehFormula(c.texto);

  if (formula) {
    // a fórmula grava o texto sem o "=" e o resultado já calculado em <v>; o
    // formato do arquivo é inglês (SUM, IF…) e usa vírgula entre argumentos
    const corpo = escapar(formulaParaXlsx(c.texto));
    const resultado = calcular(c.texto, contextoDaFolha(f));
    if (ehErro(resultado)) {
      return `<c r="${refA1}"${s} t="e"><f>${corpo}</f><v>${escapar(codigoErroXlsx(resultado.codigo))}</v></c>`;
    }
    if (typeof resultado === "number") return `<c r="${refA1}"${s}><f>${corpo}</f><v>${resultado}</v></c>`;
    if (typeof resultado === "boolean") {
      return `<c r="${refA1}"${s} t="b"><f>${corpo}</f><v>${resultado ? 1 : 0}</v></c>`;
    }
    const t = String(resultado ?? "");
    const idx = ss.get(t);
    return idx === undefined
      ? `<c r="${refA1}"${s} t="inlineStr"><f>${corpo}</f><is><t>${escapar(t)}</t></is></c>`
      : `<c r="${refA1}"${s} t="s"><f>${corpo}</f><v>${idx}</v></c>`;
  }

  const n = numeroDaCelula(c);
  if (ehBooleano(c)) return `<c r="${refA1}"${s} t="b"><v>${n}</v></c>`;
  if (n !== null) return `<c r="${refA1}"${s}><v>${n}</v></c>`;
  const idx = ss.get(c.texto);
  return idx === undefined
    ? `<c r="${refA1}"${s} t="inlineStr"><is><t xml:space="preserve">${escapar(c.texto)}</t></is></c>`
    : `<c r="${refA1}"${s} t="s"><v>${idx}</v></c>`;
}

// ---------- medidas ----------

/** Converte largura/altura em px (do motor) para as unidades do Excel. */
const pxParaLargura = (px: number): string => String(Math.max(2, Math.round(px / 7)));

/** Altura em px do motor -> pontos do Excel. */
const pxParaAltura = (px: number): string => String(Math.max(12, Math.round((px / 96) * 72)));

// ---------- aba ----------

/** Gera xl/worksheets/sheetN.xml de uma aba. */
function abaXml(f: Folha, tab: TabelaEstilos, ss: Map<string, number>, config: { grade: boolean }): string {
  const porLinha = new Map<number, { ref: string; c: Celula }[]>();
  let maxL = 0;
  let maxC = 0;
  for (const [refA1, c] of Object.entries(f.celulas)) {
    const p = partesRef(refA1);
    if (!p) continue;
    const lista = porLinha.get(p.linha);
    if (lista) lista.push({ ref: refA1, c });
    else porLinha.set(p.linha, [{ ref: refA1, c }]);
    maxL = Math.max(maxL, p.linha);
    maxC = Math.max(maxC, p.col);
  }
  for (const m of f.mesclas) {
    const r = intervalo(m);
    if (!r) continue;
    maxL = Math.max(maxL, r.l2);
    maxC = Math.max(maxC, r.c2);
  }

  // colunas com largura ajustada
  const cols: string[] = [];
  for (const [i, px] of Object.entries(f.colunas)) {
    const n = Number(i);
    if (!Number.isInteger(n) || !px || px <= 0) continue;
    cols.push(`<col min="${n + 1}" max="${n + 1}" width="${pxParaLargura(px)}" customWidth="1"/>`);
  }

  // linhas (com as células agrupadas por número de linha)
  const linhasXml: string[] = [];
  for (let l = 0; l <= maxL; l++) {
    const celulas = porLinha.get(l);
    const altura = f.linhas[l];
    const hAttr = altura && altura > 0 ? ` ht="${pxParaAltura(altura)}" customHeight="1"` : "";
    const conteudo = (celulas ?? [])
      .map((x) => celulaXml(x.ref, x.c, tab.indice.get(chaveEstilo(x.c.estilo)) ?? 0, f, ss))
      .filter(Boolean)
      .join("");
    if (!conteudo && !hAttr) continue;
    linhasXml.push(`<row r="${l + 1}" spans="1:${maxC + 1}"${hAttr}>${conteudo}</row>`);
  }

  // painéis congelados
  const cong = f.congelado;
  let pane = "";
  if (cong && (cong.colunas > 0 || cong.linhas > 0)) {
    const partes: string[] = [];
    if (cong.colunas > 0) partes.push(`xSplit="${cong.colunas}"`);
    if (cong.linhas > 0) partes.push(`ySplit="${cong.linhas}"`);
    const topLeft = `${nomeColuna(Math.min(cong.colunas, maxC + 1))}${Math.min(cong.linhas, maxL + 1) + 1}`;
    pane = `<pane ${partes.join(" ")} topLeftCell="${topLeft}" activePane="bottomRight" state="frozen"/>`;
  }

  const merges = f.mesclas.length
    ? `<mergeCells count="${f.mesclas.length}">${f.mesclas.map((m) => `<mergeCell ref="${escapar(m)}"/>`).join("")}</mergeCells>`
    : "";

  const dimension = `A1:${ref(Math.max(0, maxL), Math.max(0, maxC))}`;
  const showGrid = config.grade ? 1 : 0;

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><dimension ref="${dimension}"/><sheetViews><sheetView showGridLines="${showGrid}" workbookViewId="0">${pane}<selection activeCell="A1" sqref="A1"/></sheetView></sheetViews><sheetFormatPr defaultRowHeight="15"/>${
    cols.length ? `<cols>${cols.join("")}</cols>` : ""
  }<sheetData>${linhasXml.join("")}</sheetData>${merges}</worksheet>`;
}

// ---------- pacote completo ----------

/** Gera os bytes do arquivo .xlsx a partir do livro. */
export async function livroParaXlsx(livro: Livro, opcoes: OpcoesXlsx = {}): Promise<Uint8Array> {
  const { default: JSZip } = await import("jszip");
  const zip = new JSZip();

  const config = {
    casas: opcoes.casas ?? CONFIG_PADRAO.casas,
    grade: opcoes.grade ?? CONFIG_PADRAO.grade,
  };
  const titulo = opcoes.titulo || "Planilha";
  const autor = opcoes.autor || "mdOffice";
  const agora = isoAgora();

  const tab = montarEstilos(livro);
  const ss = sharedStrings(livro);

  // abas numeradas de 1 (o nome do arquivo segue a ordem)
  const folhas = livro.folhas.map((f, i) => ({
    indice: i,
    nome: f.nome || `Planilha${i + 1}`,
    xml: abaXml(f, tab, ss.indice, config),
  }));

  const sheetsXml = folhas
    .map((f) => `<sheet name="${escapar(f.nome)}" sheetId="${f.indice + 1}" r:id="rId${f.indice + 1}"/>`)
    .join("");
  const rels = folhas
    .map(
      (f) =>
        `<Relationship Id="rId${f.indice + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${f.indice + 1}.xml"/>`
    )
    .join("");
  const ridStyles = `rId${folhas.length + 1}`;
  const ridStrings = `rId${folhas.length + 2}`;

  zip.file(
    "[Content_Types].xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>${folhas
      .map(
        (f) =>
          `<Override PartName="/xl/worksheets/sheet${f.indice + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`
      )
      .join("")}<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/><Override PartName="/xl/sharedStrings.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/><Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/></Types>`
  );

  zip.file(
    "_rels/.rels",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/></Relationships>`
  );

  zip.file(
    "xl/workbook.xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${sheetsXml}</sheets><calcPr calcId="0" fullCalcOnLoad="1"/></workbook>`
  );

  // fullCalcOnLoad acima faz o Excel recalcular as fórmulas ao abrir, mesmo que
  // o valor em cache que gravamos esteja desatualizado.

  zip.file(
    "xl/_rels/workbook.xml.rels",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${rels}<Relationship Id="${ridStyles}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/><Relationship Id="${ridStrings}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/sharedStrings" Target="sharedStrings.xml"/></Relationships>`
  );

  zip.file("xl/styles.xml", estilosXml(tab, config.casas));
  zip.file("xl/sharedStrings.xml", ss.xml);
  folhas.forEach((f) => zip.file(`xl/worksheets/sheet${f.indice + 1}.xml`, f.xml));

  zip.file(
    "docProps/core.xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>${escapar(titulo)}</dc:title><dc:creator>${escapar(autor)}</dc:creator><cp:lastModifiedBy>${escapar(autor)}</cp:lastModifiedBy><dcterms:created xsi:type="dcterms:W3CDTF">${agora}</dcterms:created><dcterms:modified xsi:type="dcterms:W3CDTF">${agora}</dcterms:modified></cp:coreProperties>`
  );

  zip.file(
    "docProps/app.xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes"><Application>mdOffice</Application><DocSecurity>0</DocSecurity></Properties>`
  );

  return await zip.generateAsync({
    type: "uint8array",
    compression: "DEFLATE",
    compressionOptions: { level: 6 },
  });
}