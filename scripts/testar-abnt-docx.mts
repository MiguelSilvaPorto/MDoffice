// Teste do validador do .docx EXPORTADO — NBR 14724:2024, itens E04–E08 e E12.
//
// Três partes:
//  1. ARQUIVO MONTADO À MÃO — cada regra com os DOIS lados: o .docx que viola (e é
//     acusado) e o que está na norma (e fica em silêncio). O zip é montado com os XMLs
//     mínimos de propósito: aqui se testa o LEITOR (o que cada elemento diz), sem depender
//     de recurso novo da biblioteca `docx`.
//  2. EXPORTADORES DO APP — o .docx real que eles geram hoje. O estado atual é ACHADO,
//     não bug: os exportadores ainda não têm perfil ABNT (margens 2 cm, Calibri 11,
//     entrelinha 1,25, sem paginação/quebra de seção). O teste registra esse estado; a
//     tarefa que der perfil ABNT ao export vem atualizar os números aqui.
//  3. BORDAS — caminho de arquivo, arquivo que não é .docx, subconjunto de regras e
//     `verifica` desconhecido (derruba, como manda o contrato).
//
// Roda com: node scripts/testar-abnt-docx.mts
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import JSZip from "jszip";
import { checa, empacotar, fim } from "./abnt/ferramentas.mts";

const V = await empacotar("src/md/docxcheck.ts");

const CABECALHO = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
const NS =
  'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" ' +
  'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"';

const ids = (achados: any[]): string[] => achados.map((a) => a.id);

function titulo(texto: string, pPrExtra = ""): string {
  return `<w:p><w:pPr><w:pStyle w:val="Heading1"/>${pPrExtra}</w:pPr><w:r><w:t xml:space="preserve">${texto}</w:t></w:r></w:p>`;
}

function paragrafo(texto: string, pPrExtra = ""): string {
  const pPr = pPrExtra ? `<w:pPr>${pPrExtra}</w:pPr>` : "";
  return `<w:p>${pPr}<w:r><w:t xml:space="preserve">${texto}</w:t></w:r></w:p>`;
}

const TEXTO_CORPO = "Texto do corpo com bastante conteúdo para contar como texto corrido do trabalho acadêmico.";
const TEXTO_SILVA = "SILVA, João. Livro de referência. São Paulo: Editora, 2020. (parágrafo de corpo)";

const CORPO_CONFORME = [
  titulo("1 INTRODUÇÃO"),
  paragrafo(TEXTO_CORPO),
  titulo("2 DESENVOLVIMENTO", "<w:pageBreakBefore/>"),
  paragrafo(TEXTO_CORPO),
  titulo("REFERÊNCIAS", "<w:pageBreakBefore/>"),
  paragrafo(TEXTO_SILVA),
].join("");

const CORPO_SEM_QUEBRA = [
  titulo("1 INTRODUÇÃO"),
  paragrafo(TEXTO_CORPO),
  titulo("2 DESENVOLVIMENTO"),
  paragrafo(TEXTO_CORPO),
  titulo("REFERÊNCIAS"),
  paragrafo(TEXTO_SILVA),
].join("");

interface OpcoesDocx {
  largura?: number;
  altura?: number;
  margens?: { top?: number; right?: number; bottom?: number; left?: number };
  fonte?: string | null;
  tamanho?: number | null;
  linha?: number | null;
  regraLinha?: string | null;
  /** docDefaults sem fonte/tamanho: força o fallback no estilo Normal */
  semDocDefaults?: boolean;
  normalFonte?: string;
  normalTamanho?: number;
  corpo?: string;
  paginacao?: "footer" | "pgNumType" | "nenhuma";
}

/** Monta um .docx mínimo (só os XMLs que o validador lê) com os valores pedidos. */
async function docxMinimo(opcoes: OpcoesDocx = {}): Promise<Uint8Array> {
  const o = {
    largura: 11906,
    altura: 16838,
    margens: { top: 1701, right: 1134, bottom: 1134, left: 1701 },
    fonte: "Arial" as string | null,
    tamanho: 24 as number | null,
    linha: 360 as number | null,
    regraLinha: "auto" as string | null,
    semDocDefaults: false,
    normalFonte: "Arial",
    normalTamanho: 24,
    corpo: CORPO_CONFORME,
    paginacao: "footer" as "footer" | "pgNumType" | "nenhuma",
    ...opcoes,
  };
  const m = o.margens;
  const pgMar = `<w:pgMar w:top="${m.top}" w:right="${m.right}" w:bottom="${m.bottom}" w:left="${m.left}" w:header="708" w:footer="708" w:gutter="0"/>`;
  const pgNum = o.paginacao === "pgNumType" ? '<w:pgNumType w:start="1"/>' : "<w:pgNumType/>";
  const refFooter = o.paginacao === "footer" ? '<w:footerReference w:type="default" r:id="rId1"/>' : "";
  const sectPr = `<w:sectPr>${refFooter}<w:type w:val="nextPage"/><w:pgSz w:w="${o.largura}" w:h="${o.altura}"/>${pgMar}${pgNum}<w:docGrid w:linePitch="360"/></w:sectPr>`;
  const document = `${CABECALHO}<w:document ${NS}><w:body>${o.corpo}${sectPr}</w:body></w:document>`;

  const rFonts = o.fonte ? `<w:rFonts w:ascii="${o.fonte}" w:hAnsi="${o.fonte}" w:cs="${o.fonte}"/>` : "";
  const sz = o.tamanho != null ? `<w:sz w:val="${o.tamanho}"/><w:szCs w:val="${o.tamanho}"/>` : "";
  const line = o.linha != null ? ` w:line="${o.linha}"` : "";
  const rule = o.regraLinha ? ` w:lineRule="${o.regraLinha}"` : "";
  const docDefaults = o.semDocDefaults
    ? "<w:docDefaults><w:rPrDefault><w:rPr/></w:rPrDefault><w:pPrDefault><w:pPr/></w:pPrDefault></w:docDefaults>"
    : `<w:docDefaults><w:rPrDefault><w:rPr>${rFonts}${sz}</w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="0"${line}${rule}/></w:pPr></w:pPrDefault></w:docDefaults>`;
  const estilos = [
    `${CABECALHO}<w:styles ${NS}>`,
    docDefaults,
    `<w:style w:type="paragraph" w:styleId="Normal" w:default="1"><w:name w:val="Normal"/><w:rPr><w:rFonts w:ascii="${o.normalFonte}" w:hAnsi="${o.normalFonte}"/><w:sz w:val="${o.normalTamanho}"/></w:rPr></w:style>`,
    '<w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:basedOn w:val="Normal"/></w:style>',
    "</w:styles>",
  ].join("");

  const zip = new JSZip();
  zip.file(
    "[Content_Types].xml",
    `${CABECALHO}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/word/footer1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/></Types>`
  );
  zip.file(
    "_rels/.rels",
    `${CABECALHO}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`
  );
  zip.file("word/document.xml", document);
  zip.file("word/styles.xml", estilos);
  if (o.paginacao === "footer") {
    zip.file(
      "word/footer1.xml",
      `${CABECALHO}<w:ftr ${NS}><w:p><w:pPr><w:jc w:val="right"/></w:pPr><w:r><w:fldChar w:fldCharType="begin"/><w:instrText xml:space="preserve">PAGE</w:instrText><w:fldChar w:fldCharType="separate"/><w:fldChar w:fldCharType="end"/></w:r></w:p></w:ftr>`
    );
    zip.file(
      "word/_rels/document.xml.rels",
      `${CABECALHO}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer" Target="footer1.xml"/></Relationships>`
    );
  }
  return zip.generateAsync({ type: "uint8array" });
}

console.log("regras de arquivo carregam pelo lint");
{
  checa("seis regras `tipo = docx`", V.REGRAS_DOCX.length === 6, String(V.REGRAS_DOCX.length));
  checa(
    "todas com `tipo = docx` e `verifica`",
    V.REGRAS_DOCX.every((r: any) => r.tipo === "docx" && r.verifica),
    JSON.stringify(V.REGRAS_DOCX.map((r: any) => r.id))
  );
  checa(
    "ids do catálogo: E04–E08 e E12",
    JSON.stringify(ids(V.REGRAS_DOCX as any[])) === JSON.stringify(["abnt.e04", "abnt.e05", "abnt.e06", "abnt.e07", "abnt.e08", "abnt.e12"]),
    JSON.stringify(V.REGRAS_DOCX.map((r: any) => r.id))
  );
}

console.log("\nE04–E08/E12 — arquivo montado à mão, os dois lados");
{
  const conforme = await V.verificarDocx(await docxMinimo());
  checa("arquivo na norma: nenhum achado", conforme.length === 0, JSON.stringify(conforme));

  const fora = await V.verificarDocx(
    await docxMinimo({
      largura: 12240,
      altura: 15840,
      margens: { top: 1134, right: 1134, bottom: 1134, left: 1134 },
      fonte: "Calibri",
      tamanho: 22,
      linha: 276,
      paginacao: "nenhuma",
      corpo: CORPO_SEM_QUEBRA,
    })
  );
  const esperado = ["abnt.e04", "abnt.e05", "abnt.e06", "abnt.e07", "abnt.e08", "abnt.e12"];
  checa("arquivo fora da norma: acusa as seis, uma vez cada", JSON.stringify(ids(fora)) === JSON.stringify(esperado), JSON.stringify(ids(fora)));
  checa("achado tem id/norma/severidade/mensagem", fora.every((a: any) => a.id && a.norma === "nbr14724:2024" && a.severidade && a.mensagem.length > 40), JSON.stringify(fora[0]));
  const severidade = Object.fromEntries(fora.map((a: any) => [a.id, a.severidade]));
  checa(
    "severidade: aviso nas regras duras, sugestão nas de confiança média",
    severidade["abnt.e04"] === "warning" &&
      severidade["abnt.e05"] === "warning" &&
      severidade["abnt.e06"] === "warning" &&
      severidade["abnt.e07"] === "warning" &&
      severidade["abnt.e08"] === "suggestion" &&
      severidade["abnt.e12"] === "suggestion",
    JSON.stringify(severidade)
  );
  checa("mensagens citam a norma", fora.every((a: any) => a.mensagem.includes("[ABNT NBR 14724:2024]")), JSON.stringify(fora.map((a: any) => a.mensagem)));

  // E04 — só o lado errado é citado; margem maior que o mínimo passa (encadernação)
  const e04Topo = await V.verificarDocx(await docxMinimo({ margens: { top: 1134, right: 1134, bottom: 1134, left: 1701 } }));
  checa("E04: topo de 2 cm acusa só o topo", ids(e04Topo).join() === "abnt.e04" && e04Topo[0].mensagem.includes("superior = 2 cm"), JSON.stringify(e04Topo));
  const e04Esq = await V.verificarDocx(await docxMinimo({ margens: { top: 1701, right: 1134, bottom: 1134, left: 1134 } }));
  checa("E04: esquerda de 2 cm acusa a esquerda", ids(e04Esq).join() === "abnt.e04" && e04Esq[0].mensagem.includes("esquerda = 2 cm"), JSON.stringify(e04Esq));
  const e04Maior = await V.verificarDocx(await docxMinimo({ margens: { top: 2268, right: 1134, bottom: 1134, left: 2268 } }));
  checa("E04: margem maior que o mínimo não acusa", e04Maior.length === 0, JSON.stringify(e04Maior));

  // E05 — fonte e tamanho, e a formatação direta no run
  const e05Fonte = await V.verificarDocx(await docxMinimo({ fonte: "Calibri" }));
  checa("E05: Calibri 12 acusa a fonte", ids(e05Fonte).join() === "abnt.e05" && e05Fonte[0].mensagem.includes("Calibri"), JSON.stringify(e05Fonte));
  const e05Tamanho = await V.verificarDocx(await docxMinimo({ fonte: "Times New Roman", tamanho: 22 }));
  checa("E05: Times 11 acusa o tamanho", ids(e05Tamanho).join() === "abnt.e05" && e05Tamanho[0].mensagem.includes("11 pt"), JSON.stringify(e05Tamanho));
  const corpoRunDireto = paragrafo(
    "Texto com a formatação direta no run e comprimento suficiente para valer como corpo do trabalho.",
    ""
  ).replace(
    /<w:r>/,
    '<w:r><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman"/><w:sz w:val="24"/></w:rPr>'
  );
  const e05Run = await V.verificarDocx(await docxMinimo({ fonte: "Calibri", tamanho: 22, corpo: corpoRunDireto }));
  checa("E05: run com Times 12 por cima do padrão passa (formatação direta é lida)", e05Run.length === 0, JSON.stringify(e05Run));
  const e05Normal = await V.verificarDocx(await docxMinimo({ semDocDefaults: true, normalFonte: "Arial", normalTamanho: 24 }));
  checa("E05: sem docDefaults, cai no estilo Normal (Arial 12) e passa", e05Normal.length === 0, JSON.stringify(e05Normal));

  // E06 — entrelinha declarada por parágrafo, regra exata e fallback
  const e06Paragrafo = await V.verificarDocx(
    await docxMinimo({ corpo: paragrafo(TEXTO_CORPO, '<w:spacing w:line="300" w:lineRule="auto"/>') })
  );
  checa("E06: parágrafo com 1,25 acusa", ids(e06Paragrafo).join() === "abnt.e06" && e06Paragrafo[0].mensagem.includes("1,25"), JSON.stringify(e06Paragrafo));
  const e06Exata = await V.verificarDocx(await docxMinimo({ linha: 360, regraLinha: "exact" }));
  checa("E06: espaçamento exato não é julgado (silêncio)", e06Exata.length === 0, JSON.stringify(e06Exata));
  const e06SemLinha = await V.verificarDocx(await docxMinimo({ linha: null, regraLinha: null }));
  checa("E06: sem entrelinha declarada em lugar nenhum, não adivinha", e06SemLinha.length === 0, JSON.stringify(e06SemLinha));

  // E07 — Carta, A4 paisagem e um tamanho qualquer
  const e07Carta = await V.verificarDocx(await docxMinimo({ largura: 12240, altura: 15840 }));
  checa("E07: Carta acusa", ids(e07Carta).join() === "abnt.e07" && e07Carta[0].mensagem.includes("Carta"), JSON.stringify(e07Carta));
  const e07Paisagem = await V.verificarDocx(await docxMinimo({ largura: 16838, altura: 11906 }));
  checa("E07: A4 paisagem passa (ainda é A4)", e07Paisagem.length === 0, JSON.stringify(e07Paisagem));
  const e07Outro = await V.verificarDocx(await docxMinimo({ largura: 10000, altura: 14173 }));
  checa("E07: tamanho fora do A4 acusa com as medidas", ids(e07Outro).join() === "abnt.e07" && e07Outro[0].mensagem.includes("17,6 cm"), JSON.stringify(e07Outro));

  // E08 — ausência, rodapé com PAGE e pgNumType configurado
  const e08Sem = await V.verificarDocx(await docxMinimo({ paginacao: "nenhuma" }));
  checa("E08: sem campo PAGE e sem numeração acusa (sugestão)", ids(e08Sem).join() === "abnt.e08" && e08Sem[0].severidade === "suggestion", JSON.stringify(e08Sem));
  const e08PgNum = await V.verificarDocx(await docxMinimo({ paginacao: "pgNumType" }));
  checa("E08: numeração configurada na seção passa (conservador)", e08PgNum.length === 0, JSON.stringify(e08PgNum));

  // E12 — quebra de seção, parágrafo só com quebra e quebra contínua
  const quebraSoltar = `<w:p><w:r><w:br w:type="page"/></w:r></w:p>`;
  const corpoQuebraSolta = [titulo("1 INTRODUÇÃO"), paragrafo(TEXTO_CORPO), quebraSoltar, titulo("2 DESENVOLVIMENTO"), paragrafo(TEXTO_CORPO), quebraSoltar, titulo("REFERÊNCIAS"), paragrafo(TEXTO_SILVA)].join("");
  const e12Solta = await V.verificarDocx(await docxMinimo({ corpo: corpoQuebraSolta }));
  checa("E12: parágrafo com quebra de página antes da seção passa", e12Solta.length === 0, JSON.stringify(e12Solta));

  const secaoSoltar = `<w:p><w:pPr><w:sectPr><w:type w:val="nextPage"/></w:sectPr></w:pPr><w:r><w:t xml:space="preserve">${TEXTO_CORPO}</w:t></w:r></w:p>`;
  const corpoSecao = [titulo("1 INTRODUÇÃO"), paragrafo(TEXTO_CORPO), secaoSoltar, titulo("2 DESENVOLVIMENTO"), paragrafo(TEXTO_CORPO), secaoSoltar, titulo("REFERÊNCIAS"), paragrafo(TEXTO_SILVA)].join("");
  const e12Secao = await V.verificarDocx(await docxMinimo({ corpo: corpoSecao }));
  checa("E12: quebra de seção (nextPage) antes da seção passa", e12Secao.length === 0, JSON.stringify(e12Secao));

  const secaoContinua = `<w:p><w:pPr><w:sectPr><w:type w:val="continuous"/></w:sectPr></w:pPr><w:r><w:t xml:space="preserve">${TEXTO_CORPO}</w:t></w:r></w:p>`;
  const corpoContinua = [titulo("1 INTRODUÇÃO"), paragrafo(TEXTO_CORPO), secaoContinua, titulo("2 DESENVOLVIMENTO"), paragrafo(TEXTO_CORPO)].join("");
  const e12Continua = await V.verificarDocx(await docxMinimo({ corpo: corpoContinua }));
  checa('E12: seção "continuous" não conta como página nova', ids(e12Continua).join() === "abnt.e12", JSON.stringify(e12Continua));

  const e12SemQuebra = await V.verificarDocx(await docxMinimo({ corpo: CORPO_SEM_QUEBRA }));
  checa(
    "E12: lista as seções sem quebra na mensagem",
    e12SemQuebra.length === 1 && e12SemQuebra[0].mensagem.includes("“2 DESENVOLVIMENTO”") && e12SemQuebra[0].mensagem.includes("“REFERÊNCIAS”"),
    JSON.stringify(e12SemQuebra)
  );

  const corpoTtulo1 = [titulo("1 INTRODUÇÃO"), paragrafo(TEXTO_CORPO), titulo("2 DESENVOLVIMENTO"), paragrafo(TEXTO_CORPO)].join("").replaceAll('w:val="Heading1"', 'w:val="Ttulo1"');
  const e12Ttulo1 = await V.verificarDocx(await docxMinimo({ corpo: corpoTtulo1 }));
  checa("E12: estilo Ttulo1 (Word pt-BR) também é reconhecido", ids(e12Ttulo1).join() === "abnt.e12", JSON.stringify(e12Ttulo1));
}

console.log("\nbordas do validador");
{
  const pasta = mkdtempSync(join(tmpdir(), "abnt-docx-"));
  const caminho = join(pasta, "conforme.docx");
  writeFileSync(caminho, await docxMinimo());
  const porCaminho = await V.verificarDocx(caminho);
  checa("aceita caminho do arquivo (Node)", porCaminho.length === 0, JSON.stringify(porCaminho));

  let erro = "";
  try {
    await V.verificarDocx(new TextEncoder().encode("isto não é um zip"));
  } catch (e) {
    erro = String(e);
  }
  checa("arquivo que não é .docx derruba", erro.length > 0, erro);

  const fora = await docxMinimo({ fonte: "Calibri", tamanho: 22, linha: 276 });
  const soMargens = await V.verificarDocx(fora, [V.REGRAS_DOCX[0]]);
  checa("subconjunto de regras: só a regra passada roda", soMargens.length === 0, JSON.stringify(soMargens));
  const soFonte = await V.verificarDocx(fora, [V.REGRAS_DOCX[1]]);
  checa("subconjunto de regras: a fonte acusa", ids(soFonte).join() === "abnt.e05", JSON.stringify(soFonte));

  let desconhecido = "";
  try {
    await V.verificarDocx(fora, [{ ...V.REGRAS_DOCX[0], verifica: "nao-existe" }]);
  } catch (e) {
    desconhecido = String(e);
  }
  checa("`verifica` desconhecido derruba (regra pela metade não passa)", desconhecido.includes("nao-existe"), desconhecido);
}

console.log("\nexportador do app — Markdown → .docx (estado atual)");
{
  const D = await empacotar("src/md/docx.ts");
  const bytes = await D.buildDocx({
    markdown: [
      "# CAPA",
      "",
      "# 1 INTRODUÇÃO",
      "",
      "Texto corrido do trabalho, longo o suficiente para o validador julgar fonte e entrelinha do corpo.",
      "",
      "# 2 DESENVOLVIMENTO",
      "",
      "Outro parágrafo de corpo, também longo, para confirmar o modo das medidas do texto corrido.",
      "",
      "# REFERÊNCIAS",
      "",
      "SILVA, João. Livro. São Paulo: Editora, 2020.",
    ].join("\n"),
    title: "teste",
    docPath: null,
    pageSize: "A4",
  });
  const achados = await V.verificarDocx(bytes);
  checa(
    "exportador do Markdown acusa E04, E05, E06, E08 e E12 (e o papel A4 está certo)",
    JSON.stringify(ids(achados)) === JSON.stringify(["abnt.e04", "abnt.e05", "abnt.e06", "abnt.e08", "abnt.e12"]),
    JSON.stringify(ids(achados))
  );
  checa(
    "as mensagens descrevem o que o exportador faz hoje",
    achados.some((a: any) => a.mensagem.includes("Calibri")) &&
      achados.some((a: any) => a.mensagem.includes("1,25")) &&
      achados.some((a: any) => a.mensagem.includes("superior = 2 cm")),
    JSON.stringify(achados.map((a: any) => a.mensagem))
  );
  console.log("  achados reais (estado atual, não bug):");
  for (const a of achados) console.log(`    ${a.id} [${a.severidade}] ${a.mensagem}`);
}

console.log("\nexportador do app — sessão Word → .docx (estado atual)");
{
  const S = await empacotar("src/word/schema.ts");
  const M = await empacotar("src/word/model.ts");
  const W = await empacotar("src/word/docxExport.ts");

  const corpo = (comQuebra: boolean) => [
    S.schema.node("heading", { level: 1 }, [S.schema.text("1 INTRODUÇÃO")]),
    S.schema.node("paragraph", comQuebra ? { lineHeight: 1.5 } : {}, [S.schema.text("Texto corrido do trabalho, longo o suficiente para o validador julgar fonte e entrelinha do corpo.")]),
    ...(comQuebra ? [S.schema.node("page_break")] : []),
    S.schema.node("heading", { level: 1 }, [S.schema.text("REFERÊNCIAS")]),
    S.schema.node("paragraph", comQuebra ? { lineHeight: 1.5 } : {}, [S.schema.text("SILVA, João. Livro. São Paulo: Editora, 2020. (referência)")]),
  ];

  const padrao = await W.exportDocx(S.schema.node("doc", null, corpo(false)), M.DEFAULT_SETUP, "teste");
  const achadosPadrao = await V.verificarDocx(padrao);
  checa(
    "setup padrão (2,5/3 cm, Calibri 11, entrelinha 1,15, sem quebra) acusa E04, E05, E06 e E12",
    JSON.stringify(ids(achadosPadrao)) === JSON.stringify(["abnt.e04", "abnt.e05", "abnt.e06", "abnt.e12"]),
    JSON.stringify(ids(achadosPadrao))
  );
  checa("setup padrão pagina (rodapé com PAGE) — E08 não acusa", !ids(achadosPadrao).includes("abnt.e08"), JSON.stringify(ids(achadosPadrao)));

  const abnt = { ...M.DEFAULT_SETUP, margins: { top: 3, bottom: 2, left: 3, right: 2 }, defaultFont: "Arial", defaultSize: 12 };
  const comPerfil = await W.exportDocx(S.schema.node("doc", null, corpo(true)), abnt, "teste");
  const achadosPerfil = await V.verificarDocx(comPerfil);
  checa(
    "mesmo exportador, configurado em ABNT (3-2-3-2, Arial 12, 1,5, quebra) não acusa nada",
    achadosPerfil.length === 0,
    JSON.stringify(achadosPerfil)
  );
  console.log("  achados reais do setup padrão (estado atual, não bug):");
  for (const a of achadosPadrao) console.log(`    ${a.id} [${a.severidade}] ${a.mensagem}`);
}

fim();
