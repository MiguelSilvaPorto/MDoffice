// A prévia de um documento para a tela Início — no navegador.
//
// No app nativo ela é feita pelo Rust (que abre o zip do pacote OOXML e tira o texto do XML
// principal). No navegador o mesmo papel é do **JSZip**, que o app já traz: o `.docx`, o
// `.pptx` e o `.xlsx` são pacotes (zips) e o texto mora num XML dentro deles.
//
// O arquivo **não** é carregado no app inteiro: só o começo do texto sai daqui, e o zip é lido
// do próprio arquivo (sem trazer os bytes para a memória do lado do editor).

import JSZip from "jszip";

/** Quantos caracteres a prévia devolve (o cartão mostra bem menos; a folga cobre a quebra). */
export const PREVIA_CHARS = 320;

/** Quantas linhas e colunas a grade da prévia mostra (o cartão é pequeno). */
const GRADE_LINHAS = 6;
const GRADE_COLUNAS = 5;

export interface Previa {
  /** o formato reconhecido: "md", "docx", "pptx", "xlsx" ou "outro" */
  tipo: string;
  /** as primeiras linhas do documento (vazio quando não dá para ler) */
  texto: string;
}

/** Tira o texto de um XML do OOXML: o conteúdo fica em `<w:t>`/`<a:t>`/`<t>`, e o fim de cada
 * trecho/parágrafo vira um espaço — sem isso as palavras de parágrafos vizinhos grudariam. */
export function textoDeXml(bruto: string): string {
  let out = "";
  let tag = "";
  let dentro = false;
  for (const c of bruto) {
    if (c === "<") {
      dentro = true;
      tag = "";
    } else if (c === ">") {
      dentro = false;
      if (tag.startsWith("/")) {
        const nome = tag.replace(/^\/+/, "");
        if (nome === "w:p" || nome === "a:p") out += "\n"; // fim de parágrafo
        else if (nome === "w:t" || nome === "a:t" || nome === "t") out += " "; // fim de trecho
      }
    } else if (dentro) tag += c;
    else out += c;
  }
  return out;
}

/** Arruma as linhas (o XML vem indentado) e corta no tamanho da prévia. */
export function limparPrevia(bruto: string): string {
  const linhas: string[] = [];
  let total = 0;
  for (const linha of bruto.split("\n")) {
    const out: string[] = [];
    let espaco = false;
    for (const c of linha) {
      if (/\s/.test(c)) {
        espaco = out.length > 0;
        continue;
      }
      if (espaco) {
        out.push(" ");
        espaco = false;
      }
      out.push(c);
    }
    const limpa = out.join("").trim();
    if (!limpa) continue; // linha em branco: a prévia é apertada
    total += limpa.length + 1;
    linhas.push(limpa);
    if (total >= PREVIA_CHARS) break;
  }
  return linhas.join("\n").slice(0, PREVIA_CHARS);
}

/** Limpa um pedaço de célula (os espaços viram um só), preservando o TAB entre as células. */
function limparCelula(bruto: string): string {
  const out: string[] = [];
  let espaco = false;
  for (const c of bruto) {
    if (/\s/.test(c)) {
      espaco = out.length > 0;
      continue;
    }
    if (espaco) {
      out.push(" ");
      espaco = false;
    }
    out.push(c);
  }
  return out.join("");
}

/** Como o `limparPrevia`, mas preservando o TAB entre as células (a grade do cartão). */
export function limparGrade(bruto: string): string {
  const linhas: string[] = [];
  let total = 0;
  for (const linha of bruto.split("\n")) {
    const celulas = linha.split("\t").map(limparCelula);
    if (celulas.every((c) => !c)) continue;
    const limpa = celulas.join("\t");
    total += limpa.length + 1;
    linhas.push(limpa);
    if (total >= PREVIA_CHARS) break;
  }
  return linhas.join("\n");
}

/** O conteúdo de uma entrada do pacote (string). */
async function textoDoArquivo(zi: JSZip, nome: string): Promise<string> {
  const arquivo = zi.file(nome);
  if (!arquivo) return "";
  try {
    return await arquivo.async("string");
  } catch {
    return "";
  }
}

/** Os textos de `xl/sharedStrings.xml` (as células de texto apontam para eles por índice). */
function textosCompartilhados(bruto: string): string[] {
  return bruto
    .split("<si>")
    .slice(1)
    .map((pedaco) => textoDeXml(`<x>${pedaco.split("</si>")[0] ?? ""}</x>`).trim());
}

/** A posição de uma célula pelo `r` do XML ("B3" → linha 3, coluna 2). */
function refDaCelula(tag: string): { linha: number; coluna: number } | null {
  const i = tag.indexOf('r="');
  if (i < 0) return null;
  const inicio = i + 3;
  const fim = tag.indexOf('"', inicio);
  if (fim < 0) return null;
  const referencia = tag.slice(inicio, fim);
  const letras = referencia.split("").filter((c) => /[a-zA-Z]/.test(c))[0] ?? "";
  const numeros = referencia.split("").filter((c) => /[0-9]/.test(c)).join("");
  let coluna = 0;
  for (const c of letras.toUpperCase()) coluna = coluna * 26 + (c.charCodeAt(0) - 64);
  return { linha: Number(numeros) || 0, coluna };
}

/** O valor de uma célula: `t="s"` aponta para a lista de textos; o resto é o valor cru. */
function valorDaCelula(corpo: string, strings: string[]): string {
  if (corpo.includes('t="s"')) {
    const bruto = corpo.split("<v>")[1]?.split("</v>")[0]?.trim() ?? "";
    const indice = Number(bruto);
    return strings[indice] ?? "";
  }
  if (corpo.includes("<is>")) {
    const dentro = corpo.split("<is>")[1]?.split("</is>")[0] ?? "";
    return textoDeXml(`<x>${dentro}</x>`).trim();
  }
  return corpo.split("<v>")[1]?.split("</v>")[0]?.trim() ?? "";
}

/** A prévia da planilha: as primeiras linhas com as células separadas por TAB. */
function valoresDaPlanilha(bruto: string, strings: string[]): string {
  const linhas: string[][] = [];
  for (const celula of bruto.split("<c ").slice(1)) {
    const corpo = celula.split("</c>")[0] ?? "";
    const ref = refDaCelula(corpo);
    if (!ref) continue;
    if (ref.linha === 0 || ref.coluna === 0 || ref.linha > GRADE_LINHAS || ref.coluna > GRADE_COLUNAS) continue;
    while (linhas.length < ref.linha) linhas.push([]);
    const alvo = linhas[ref.linha - 1];
    const valor = valorDaCelula(corpo, strings);
    while (alvo.length < ref.coluna) alvo.push("");
    alvo[ref.coluna - 1] = valor;
  }
  return linhas.map((l) => l.join("\t")).join("\n");
}

/** A prévia de um documento (o cartão da Início mostra um papel com o começo do texto). */
export async function previaDoArquivo(nome: string, bytes: Uint8Array): Promise<Previa> {
  const ext = (nome.split(".").pop() ?? "").toLowerCase();
  const tipo =
    ext === "md" || ext === "markdown" || ext === "txt"
      ? "md"
      : ext === "docx"
        ? "docx"
        : ext === "pptx"
          ? "pptx"
          : ext === "xlsx"
            ? "xlsx"
            : "outro";
  if (tipo === "md") {
    const texto = new TextDecoder().decode(bytes.slice(0, PREVIA_CHARS * 4));
    return { tipo, texto: limparPrevia(texto) };
  }
  if (tipo === "outro") return { tipo, texto: "" };
  try {
    const zi = await JSZip.loadAsync(bytes);
    if (tipo === "docx") return { tipo, texto: limparPrevia(textoDeXml(await textoDoArquivo(zi, "word/document.xml"))) };
    if (tipo === "pptx") return { tipo, texto: limparPrevia(textoDeXml(await textoDoArquivo(zi, "ppt/slides/slide1.xml"))) };
    // a planilha vem em LINHAS de células separadas por TAB: o cartão desenha a grade com as
    // posições do XML (o `sharedStrings` sozinho só daria a lista de textos, sem linha/coluna)
    const strings = textosCompartilhados(await textoDoArquivo(zi, "xl/sharedStrings.xml"));
    return { tipo, texto: limparGrade(valoresDaPlanilha(await textoDoArquivo(zi, "xl/worksheets/sheet1.xml"), strings)) };
  } catch {
    return { tipo, texto: "" };
  }
}
