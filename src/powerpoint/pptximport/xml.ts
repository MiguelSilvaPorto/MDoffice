// Leitura de .pptx: mini-parser de OOXML (o "docx/xml.ts" das apresentações).
// Um .pptx é um ZIP; dentro, cada lâmina é um XML em ppt/slides/slideN.xml.
// Não usamos DOMParser porque ele não existe igual em todo WebView — regex é
// suficiente para extrair texto e metadados.

export interface PptxPart {
  /** caminho interno no zip (ex.: ppt/slides/slide1.xml") */
  name: string;
  xml: string;
}

/** Texto de todos os runs <a:t> de um XML de lâmina, na ordem. */
export function textosDe(xml: string): string[] {
  const out: string[] = [];
  const re = /<a:t(?:\s[^>]*)?>([\s\S]*?)<\/a:t>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml))) out.push(destrair(m[1]));
  return out;
}

/** Texto dos runs de um tipo de parágrafo (título, corpo, etc.). */
export function paragrafos(xml: string): { nivel: number; texto: string; bullet: boolean }[] {
  const out: { nivel: number; texto: string; bullet: boolean }[] = [];
  const re = /<a:p>([\s\S]*?)<\/a:p>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml))) {
    const bloco = m[1];
    const texto = textosDe(bloco).join("").trim();
    if (!texto) continue;
    const nivel = /lvl="(\d+)"/.exec(bloco)?.[1];
    const bullet = /<a:buChar/.test(bloco) || /<a:buAutoNum/.test(bloco);
    out.push({ nivel: nivel ? +nivel : 0, texto, bullet });
  }
  return out;
}

/** Um parágrafo é título quando o tamanho da fonte é grande. */
export function nivelDoParagrafo(p: { texto: string }): number {
  return /^(#{1,6})\s/.test(p.texto) ? 1 : 0;
}

/** Desfaz as entidades XML mais comuns. */
export function destrair(s: string): string {
  return s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n));
}

/** Escapa o texto para XML (usado se um dia gerarmos XML à mão). */
export function escapar(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/** Ordem numérica dos slides (slide2 antes de slide10). */
export function numeroDoSlide(nome: string): number {
  return /slide(\d+)\.xml$/.exec(nome)?.[1] ? +/slide(\d+)\.xml$/.exec(nome)![1] : 0;
}