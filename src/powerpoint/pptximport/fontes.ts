// Fontes embutidas no .pptx (ppt/fonts/*.fntdata): são arquivos EOT (Embedded OpenType). Aqui extraímos o
// TrueType de dentro deles para a tela usar a mesma fonte do autor (sem depender de ela estar instalada).
import type { EmbeddedFont, FontRaw } from "../schema";
import { paraDataUrl, Pacote, type Relacao } from "./pacote";
import { descomprimirMtx } from "./mtx";
import { filho, filhos, type No } from "./xmltree";

/** Famílias para as quais não há perda visual quando o EOT não é decodificado (o app as traz ou o sistema já tem). */
const FAMILIAS_INCLUIDAS = new Set([
  // vêm com o app
  "montserrat", "roboto", "open sans", "inter",
  // vêm com o Windows/macOS/Office: o sistema já tem a original
  "arial", "arial black", "arial narrow", "calibri", "cambria", "candara", "consolas", "constantia", "corbel", "courier new", "georgia",
  "impact", "lucida sans", "segoe ui", "tahoma", "times new roman", "trebuchet ms", "verdana", "aptos", "century gothic", "franklin gothic",
]);

function baseDaFamilia(nome: string): string {
  return nome.replace(/\s+(Thin|Hairline|ExtraLight|UltraLight|Light|Regular|Normal|Medium|SemiBold|DemiBold|ExtraBold|UltraBold|Black|Heavy|Bold)$/i, "").trim().toLowerCase();
}

const FLAG_COMPRIMIDO = 0x4;
const FLAG_XOR = 0x10000000;

/** Extrai o arquivo de fonte (TrueType/OpenType) de dentro de um EOT. null quando não foi possível. */
export function eotParaFonte(bytes: Uint8Array): Uint8Array | null {
  if (bytes.length < 82) return null;
  const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const tamEot = v.getUint32(0, true);
  const tamFonte = v.getUint32(4, true);
  const flags = v.getUint32(12, true);
  if (tamFonte <= 0 || tamFonte > bytes.length) return null;
  const inicio = Math.min(tamEot, bytes.length) - tamFonte;
  if (inicio < 0) return null;
  let dados = bytes.subarray(inicio, inicio + tamFonte);
  if (flags & FLAG_XOR) dados = dados.map((b) => b ^ 0x50);
  if (flags & FLAG_COMPRIMIDO) {
    const r = descomprimirMtx(dados);
    return r;
  }
  return dados;
}

/** Lê as fontes embutidas listadas em presentation.xml. */
export async function carregarFontes(pac: Pacote, pres: No | undefined, rels: Map<string, Relacao>, avisos: Set<string>): Promise<{ fonts: EmbeddedFont[]; raw: FontRaw[] }> {
  const out: EmbeddedFont[] = [];
  const raw: FontRaw[] = [];
  const semLeitura = new Set<string>();
  for (const ef of filhos(filho(pres, "embeddedFontLst"), "embeddedFont")) {
    const familia = filho(ef, "font")?.a.typeface;
    if (!familia) continue;
    const variantes: [string, number, boolean][] = [
      ["regular", 400, false],
      ["bold", 700, false],
      ["italic", 400, true],
      ["boldItalic", 700, true],
    ];
    for (const [tag, peso, italico] of variantes) {
      const rid = filho(ef, tag)?.a["r:id"];
      const rel = rid ? rels.get(rid) : undefined;
      if (!rel) continue;
      const bytes = await pac.bytes(rel.alvo);
      if (!bytes) continue;
      raw.push({ attrs: { ...(filho(ef, "font")?.a ?? {}) }, slot: tag as FontRaw["slot"], data: paraDataUrl(bytes, "application/x-fontdata").split(",")[1] });
      let fonte: Uint8Array | null = null;
      try {
        fonte = eotParaFonte(bytes);
      } catch {
        fonte = null;
      }
      if (!fonte) {
        if (!FAMILIAS_INCLUIDAS.has(baseDaFamilia(familia))) semLeitura.add(familia);
        continue;
      }
      const sfnt = fonte.length > 4 && fonte[0] === 0x4f && fonte[1] === 0x54 ? "font/otf" : "font/ttf";
      out.push({ family: familia, weight: peso, italic: italico, src: paraDataUrl(fonte, sfnt) });
    }
  }
  if (semLeitura.size) avisos.add(`Fonte(s) embutida(s) que o app não consegue exibir (${[...semLeitura].slice(0, 4).join(", ")}): na tela vale a mais parecida instalada; o arquivo mantém as originais ao salvar`);
  return { fonts: out, raw };
}
