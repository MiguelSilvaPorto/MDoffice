// Esconde trechos que não devem ser corrigidos (código, links, HTML, front-matter).

/** Esconde trechos que não devem ser corrigidos (código, links, front-matter). */
const MASCA = "·";
const mascara = (n: number) => MASCA.repeat(Math.max(0, n));

export function maskNonProse(text: string): string {
  const lines = text.split("\n");
  let inFence = false;
  const masked = lines.map((line, index) => {
    const fence = /^\s*(```|~~~)/.test(line);
    if (fence) {
      inFence = !inFence;
      return mascara(line.length);
    }
    if (inFence) return mascara(line.length);
    if (index === 0 && /^---\s*$/.test(line)) return mascara(line.length);
    let out = line;
    // links/imagens: mantém só o rótulo, no lugar certo e com o mesmo comprimento
    out = out.replace(/!\[([^\]]*)\]\(([^)]*)\)/g, (_m, label: string, url: string) => `${mascara(2)}${label}${mascara(3 + url.length)}`);
    out = out.replace(/\[([^\]]*)\]\(([^)]*)\)/g, (_m, label: string, url: string) => `${mascara(1)}${label}${mascara(3 + url.length)}`);
    // html
    out = out.replace(/<[^>]+>/g, (m) => mascara(m.length));
    // código embutido
    out = out.replace(/`[^`]*`/g, (m) => mascara(m.length));
    // URLs soltas
    out = out.replace(/https?:\/\/\S+/g, (m) => mascara(m.length));
    return out;
  });
  let result = masked.join("\n");
  // front-matter (--- no topo)
  if (/^---\s*\n/.test(text)) {
    const end = result.indexOf(`\n${MASCA}---`, 3);
    if (end > 0) {
      result = mascara(end + 4) + result.slice(end + 4);
    }
  }
  return result;
}

export function isInsideMask(text: string, from: number, to: number): boolean {
  const pedaco = maskNonProse(text).slice(from, to);
  return /^[·\s]*$/.test(pedaco) && pedaco.includes(MASCA) && text.slice(from, to).trim() !== "";
}
