// Lê os bytes de um .xlsx do disco e devolve o Livro do motor.
//
// Um .xlsx é um ZIP; dentro, cada aba é um XML em xl/worksheets/sheetN.xml.
// Não usamos DOMParser (não existe igual em todo WebView, como o .pptx e o
// .docx também não usam) — regex é suficiente para extrair células e estilos.
//
// O que este leitor NÃO recupera (e o app avisa ao salvar de volta):
//   • gráficos, imagens, tabelas dinâmicas e formatação condicional
//   • fórmulas entre abas (o texto da fórmula é lido, mas o motor mostra #REF!)
//   • comentários, validação de dados e quebras de página

import type { Celula, Estilo, Folha, FormatoNumero, Livro } from "../schema";
import { CONFIG_PADRAO } from "../model";

/** Desfaz as entidades XML mais comuns (o mesmo do pptximport/xml.ts). */
function destrair(s: string): string {
  return s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/&amp;/g, "&");
}

/** Lista de textos de xl/sharedStrings.xml. */
function textosCompartilhados(xml: string): string[] {
  const out: string[] = [];
  const re = /<si\b[^>]*>([\s\S]*?)<\/si>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml))) {
    // cada <t> dentro do <si> é um pedaço do texto (formatação rica separa em vários)
    const partes: string[] = [];
    const reT = /<t\b[^>]*>([\s\S]*?)<\/t>/g;
    let mt: RegExpExecArray | null;
    while ((mt = reT.exec(m[1]))) partes.push(destrair(mt[1]));
    out.push(partes.join(""));
  }
  return out;
}

/** Formatos de número declarados pelo autor (id -> código). */
function formatosCustomizados(xml: string): Map<number, string> {
  const out = new Map<number, string>();
  const re = /<numFmt\b[^>]*numFmtId="(\d+)"[^>]*formatCode="([^"]*)"[^>]*\/>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml))) out.set(+m[1], destrair(m[2]));
  return out;
}

/** Formatos embutidos que o motor entende (só os que importam aqui). */
const FORMATO_PADRAO = (id: number): FormatoNumero | null => {
  if (id === 0) return "geral";
  if (id === 1 || id === 2 || id === 3 || id === 4 || id === 37 || id === 38 || id === 39 || id === 40) return "decimal";
  if (id === 9 || id === 10) return "porcento";
  if (id >= 14 && id <= 22) return "data";
  if (id === 44 || id === 42 || id === 164) return "moeda"; // 164 só se o código tiver R$
  return null;
};

/** Interpreta o formatCode do Excel como o formato do motor. */
function formatoDoCodigo(codigo: string): { numero: FormatoNumero; casas: number } | null {
  const c = codigo.replace(/\[[^\]]*\]/g, ""); // ignora [R$] etc
  const ehData = /d{1,2}m{1,2}|m{1,2}d{1,2}|yyyy|dd\/mm|hh/i.test(c) && !/[#0]/.test(c.replace(/[dmyhs]/gi, ""));
  if (ehData) return { numero: "data", casas: 0 };
  const temMoeda = /R\$|["']R\$|\\R/i.test(codigo);
  if (temMoeda) {
    const casas = (c.match(/\.(0+)/)?.[1].length ?? 2) as number;
    return { numero: "moeda", casas };
  }
  if (c.includes("%")) {
    const casas = (c.match(/\.(0+)/)?.[1].length ?? 0) as number;
    return { numero: "porcento", casas };
  }
  if (/[#0]/.test(c)) {
    const casas = (c.match(/\.(0+)/)?.[1].length ?? 0) as number;
    return { numero: "decimal", casas };
  }
  return null;
}

/** Lê xl/styles.xml: a lista é lida na ordem, porque o atributo s="N" indexa. */
function lerEstilos(xml: string): Estilo[] {
  // o primeiro <xf> já é o estilo 0 (o padrão) — não acrescentamos nada na frente
  const out: Estilo[] = [];

  // fontes
  const fontes: { negrito: boolean; italico: boolean; cor?: string }[] = [];
  const blocoFontes = /<fonts\b[^>]*>([\s\S]*?)<\/fonts>/.exec(xml)?.[1] ?? "";
  const reFonte = /<font\b[^>]*>([\s\S]*?)<\/font>/g;
  let mf: RegExpExecArray | null;
  while ((mf = reFonte.exec(blocoFontes))) {
    const b = mf[1];
    const cor = /<color\b[^>]*rgb="([0-9A-Fa-f]{8})"/.exec(b)?.[1];
    fontes.push({
      negrito: /<b\b\s*\/?>/.test(b),
      italico: /<i\b\s*\/?>/.test(b),
      cor: cor ? cor.slice(2, 8).toUpperCase() : undefined,
    });
  }

  // preenchimentos: os dois primeiros do XML são sempre "none" e "gray125", e a
  // lista guarda todas as entradas para o índice bater com o fillId
  const preenchimentos: string[] = [];
  const blocoPreench = /<fills\b[^>]*>([\s\S]*?)<\/fills>/.exec(xml)?.[1] ?? "";
  const rePreench = /<fill\b[^>]*>([\s\S]*?)<\/fill>/g;
  let mp: RegExpExecArray | null;
  while ((mp = rePreench.exec(blocoPreench))) {
    const solid = /patternType="solid"/.test(mp[1]);
    const cor = /<fgColor\b[^>]*rgb="([0-9A-Fa-f]{8})"/.exec(mp[1])?.[1];
    preenchimentos.push(solid && cor ? cor.slice(2, 8).toUpperCase() : "");
  }

  const formatos = formatosCustomizados(xml);

  // estilos de célula (cellXfs). A lista já vem na ordem do índice s="N", então
  // o primeiro <xf> É o estilo 0 — não acrescentamos um padrão na frente.
  const blocoXfs = /<cellXfs\b[^>]*>([\s\S]*?)<\/cellXfs>/.exec(xml)?.[1] ?? "";
  const reXf = /<xf\b([^>]*?)(?:\/>|>([\s\S]*?)<\/xf>)/g;
  let mx: RegExpExecArray | null;
  while ((mx = reXf.exec(blocoXfs))) {
    const attrs = mx[1] ?? "";
    const corpo = mx[2] ?? "";
    const numAttr = (nome: string): number => Number(new RegExp(`${nome}="(\\d+)"`).exec(attrs)?.[1] ?? 0);

    const estilo: Estilo = {};
    const fonte = fontes[numAttr("fontId")];
    if (fonte?.negrito) estilo.negrito = true;
    if (fonte?.italico) estilo.italico = true;
    if (fonte?.cor && fonte.cor !== "000000") estilo.cor = fonte.cor;
    const fundo = preenchimentos[numAttr("fillId")];
    if (fundo) estilo.fundo = fundo;

    const alinhar = /horizontal="(left|center|right|justify)"/.exec(corpo)?.[1];
    if (alinhar) {
      estilo.alinhamento =
        alinhar === "left" ? "esquerda" : alinhar === "right" ? "direita" : alinhar === "justify" ? "justificado" : "centro";
    }

    const numFmtId = numAttr("numFmtId");
    const padrao = FORMATO_PADRAO(numFmtId);
    if (padrao) {
      estilo.numero = padrao;
      if (padrao === "moeda" && numFmtId === 164) {
        const codigo = formatos.get(numFmtId);
        const casas = codigo ? (codigo.match(/\.(0+)/)?.[1].length ?? 2) : 2;
        estilo.casas = casas;
      }
      if (numFmtId >= 164) {
        const codigo = formatos.get(numFmtId);
        const interpretado = codigo ? formatoDoCodigo(codigo) : null;
        if (interpretado) {
          estilo.numero = interpretado.numero;
          if (interpretado.numero !== "data") estilo.casas = interpretado.casas;
        }
      }
    }
    out.push(Object.keys(estilo).length ? estilo : {});
  }
  return out;
}

/** Descobre o nome de cada aba na ordem do workbook.xml. */
function ordemDasAbas(xml: string): { nome: string; relId: string }[] {
  const out: { nome: string; relId: string }[] = [];
  const re = /<sheet\b([^>]*)\/>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml))) {
    const nome = destrair(/name="([^"]*)"/.exec(m[1])?.[1] ?? "Planilha");
    // o atributo de relação vem com prefixo r:id
    const relId = /r:id="([^"]*)"/.exec(m[1])?.[1] ?? "";
    out.push({ nome, relId });
  }
  return out;
}

/** xl/_rels/workbook.xml.rels: relação (rIdNNN) -> caminho de worksheets/sheetN.xml. */
function mapaDeRelacoes(xml: string): Map<string, string> {
  const out = new Map<string, string>();
  const re = /<Relationship\b([^>]*)\/>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml))) {
    const id = /Id="([^"]*)"/.exec(m[1])?.[1];
    const alvo = /Target="([^"]*)"/.exec(m[1])?.[1];
    if (id && alvo) out.set(id, alvo.replace(/^\/?(xl\/)?/, ""));
  }
  return out;
}

/** Converte o texto da célula para o que o motor guarda (número, texto, data). */
function textoDaCelula(tipo: string, valorBruto: string, inline: string, formatos: Map<number, string>): string {
  const bruto = destrair(valorBruto);
  switch (tipo) {
    case "s": {
      // índice numérico: o texto de verdade está em sharedStrings (tratado antes)
      return bruto;
    }
    case "inlineStr":
      return destrair(inline);
    case "b":
      return bruto === "1" ? "VERDADEIRO" : "FALSO";
    case "e":
      return bruto; // erro (#DIV/0! etc.) — o motor mostra como texto
    case "str":
      return bruto;
    default:
      return bruto;
  }
}

/** Lê uma aba (xl/worksheets/sheetN.xml) e monta a Folha do motor. */
function lerAba(xml: string, estilos: Estilo[], compartilhados: string[], formatos: Map<number, string>): Folha {
  const folha: Folha = { nome: "Planilha1", celulas: {}, colunas: {}, linhas: {}, mesclas: [] };

  // linhas com altura personalizada
  const reRow = /<row\b([^>]*?)(?:\/>|>([\s\S]*?)<\/row>)/g;
  let mr: RegExpExecArray | null;
  while ((mr = reRow.exec(xml))) {
    const r = Number(/\br="(\d+)"/.exec(mr[1])?.[1] ?? 0);
    const ht = /\bht="([\d.]+)"/.exec(mr[1])?.[1];
    if (r > 0 && ht) folha.linhas[r - 1] = Math.max(12, Math.round((+ht / 72) * 96));

    const corpo = mr[2] ?? "";
    // células da linha
    const reC = /<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g;
    let mc: RegExpExecArray | null;
    while ((mc = reC.exec(corpo))) {
      const attrs = mc[1] ?? "";
      const dentro = mc[2] ?? "";
      const refA1 = /r="([A-Z]+\d+)"/.exec(attrs)?.[1];
      if (!refA1) continue;
      const tipo = /\bt="([^"]*)"/.exec(attrs)?.[1] ?? "";
      const sIdx = Number(/\bs="(\d+)"/.exec(attrs)?.[1] ?? 0);

      const valorBruto = /<v\b[^>]*>([\s\S]*?)<\/v>/.exec(dentro)?.[1] ?? "";
      const inline = /<t\b[^>]*>([\s\S]*?)<\/t>/.exec(dentro)?.[1] ?? "";
      const formula = /<f\b[^>]*>([\s\S]*?)<\/f>/.exec(dentro)?.[1];

      let texto: string;
      if (formula !== undefined) {
        // a fórmula vem sem o "="; devolvemos com o "=" que o motor usa
        texto = `=${destrair(formula)}`;
      } else if (tipo === "s") {
        texto = compartilhados[Number(valorBruto)] ?? "";
      } else {
        texto = textoDaCelula(tipo, valorBruto, inline, formatos);
        // um número puro fica como o motor escreve ("1.234,5" continua aceito)
        if (tipo === "" && texto && !/^-?[\d.,]+$/.test(texto)) {
          // pode ser uma data gravada como número com formato "data"
        }
      }

      const estilo = estilos[sIdx];
      const cel: Celula = { texto };
      if (formula !== undefined) cel.formula = true;
      if (estilo && Object.keys(estilo).length) {
        // o formato de data grava um serial; o motor mostra o texto dd/mm/aaaa
        if (estilo.numero === "data" && /^-?[\d.]+$/.test(texto.trim())) {
          cel.texto = serialParaBr(texto.trim());
          cel.estilo = estilo;
        } else {
          cel.estilo = estilo;
        }
      }
      if (cel.texto === "" && !cel.estilo) continue; // célula vazia não entra
      folha.celulas[refA1] = cel;
    }
  }

  // colunas com largura personalizada
  const reCol = /<col\b([^>]*)\/>/g;
  let mc2: RegExpExecArray | null;
  while ((mc2 = reCol.exec(xml))) {
    const min = Number(/\bmin="(\d+)"/.exec(mc2[1])?.[1] ?? 0);
    const max = Number(/\bmax="(\d+)"/.exec(mc2[1])?.[1] ?? 0);
    const largura = Number(/\bwidth="([\d.]+)"/.exec(mc2[1])?.[1] ?? 0);
    if (min > 0 && largura > 0) {
      const px = Math.max(24, Math.round(largura * 7));
      for (let c = min; c <= max; c++) folha.colunas[c - 1] = px;
    }
  }

  // células mescladas
  const blocoMerge = /<mergeCells\b[^>]*>([\s\S]*?)<\/mergeCells>/.exec(xml)?.[1] ?? "";
  const reMerge = /<mergeCell\b[^>]*ref="([^"]*)"[^>]*\/>/g;
  let mm: RegExpExecArray | null;
  while ((mm = reMerge.exec(blocoMerge))) folha.mesclas.push(mm[1]);

  // painéis congelados
  const pane = /<pane\b([^>]*)\/>/.exec(xml)?.[1];
  if (pane) {
    const xSplit = Number(/xSplit="(\d+)"/.exec(pane)?.[1] ?? 0);
    const ySplit = Number(/ySplit="(\d+)"/.exec(pane)?.[1] ?? 0);
    if (xSplit > 0 || ySplit > 0) folha.congelado = { colunas: xSplit, linhas: ySplit };
  }

  void formatos;
  return folha;
}

/** Serial do Excel -> "dd/mm/aaaa" (o motor guarda datas assim). */
function serialParaBr(serial: string): string {
  const n = Number(serial);
  if (!Number.isFinite(n)) return serial;
  const base = Date.UTC(1899, 11, 30);
  const dias = Math.floor(n);
  const frac = n - dias;
  // antes de 1900-03-01 o Excel tem o dia 29/02/1900 que não existe
  const ms = dias >= 61 ? base + dias * 86_400_000 : base + (dias + 1) * 86_400_000;
  const d = new Date(ms);
  const dia = String(d.getUTCDate()).padStart(2, "0");
  const mes = String(d.getUTCMonth() + 1).padStart(2, "0");
  const ano = d.getUTCFullYear();
  if (frac === 0) return `${dia}/${mes}/${ano}`;
  const hh = String(Math.floor(frac * 24)).padStart(2, "0");
  const mm = String(Math.floor((frac * 24 * 60) % 60)).padStart(2, "0");
  return `${dia}/${mes}/${ano} ${hh}:${mm}`;
}

/** Lê um .xlsx e devolve o livro pronto para o motor. */
export async function xlsxParaLivro(bytes: Uint8Array): Promise<{ livro: Livro; grade: boolean }> {
  const { default: JSZip } = await import("jszip");
  const zip = await JSZip.loadAsync(bytes);

  const workbookXml = await zip.file("xl/workbook.xml")?.async("string");
  if (!workbookXml) throw new Error("Este arquivo não parece ser uma planilha (.xlsx).");

  const estilosXml = await zip.file("xl/styles.xml")?.async("string");
  const estilos = estilosXml ? lerEstilos(estilosXml) : [{}];
  const formatos = estilosXml ? formatosCustomizados(estilosXml) : new Map<number, string>();

  const ssXml = await zip.file("xl/sharedStrings.xml")?.async("string");
  const compartilhados = ssXml ? textosCompartilhados(ssXml) : [];

  const relsXml = await zip.file("xl/_rels/workbook.xml.rels")?.async("string");
  const relacoes = relsXml ? mapaDeRelacoes(relsXml) : new Map<string, string>();

  const abas = ordemDasAbas(workbookXml);
  const folhas: Folha[] = [];

  for (const [i, aba] of abas.entries()) {
    const alvo = relacoes.get(aba.relId);
    const caminho = alvo ? `xl/${alvo}` : `xl/worksheets/sheet${i + 1}.xml`;
    const arq = zip.file(caminho) ?? zip.file(`xl/worksheets/sheet${i + 1}.xml`);
    if (!arq) continue;
    const folha = lerAba(await arq.async("string"), estilos, compartilhados, formatos);
    folha.nome = aba.nome || `Planilha${i + 1}`;
    folhas.push(folha);
  }

  // a primeira aba tem showGridLines no seu sheetView
  const primeiraXml = await (async () => {
    if (!abas.length) return null;
    const alvo = relacoes.get(abas[0].relId);
    const caminho = alvo ? `xl/${alvo}` : "xl/worksheets/sheet1.xml";
    const arq = zip.file(caminho) ?? zip.file("xl/worksheets/sheet1.xml");
    return arq ? await arq.async("string") : null;
  })();
  const grade = /showGridLines="0"/.test(primeiraXml ?? "") ? false : CONFIG_PADRAO.grade;

  if (!folhas.length) folhas.push({ nome: "Planilha1", celulas: {}, colunas: {}, linhas: {}, mesclas: [] });

  return { livro: { folhas, ativa: 0 }, grade };
}