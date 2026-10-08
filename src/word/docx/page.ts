// Cabeçalho e rodapé do .docx.

import { type El, kids, attr, parseXml } from "./xml";
import { type Ctx } from "./context";

export async function readHeaderFooter(ctx: Ctx, sect: El | null, kind: "header" | "footer"): Promise<{ text: string; page: boolean }> {
  const ref = kids(sect, kind === "header" ? "w:headerReference" : "w:footerReference").find((r) => (attr(r, "w:type") ?? "default") === "default");
  const rid = attr(ref, "r:id");
  const rel = rid ? ctx.rels.get(rid) : null;
  if (!rel) return { text: "", page: false };
  const file = ctx.zip.file(`word/${rel.target.replace(/^\.\//, "")}`);
  if (!file) return { text: "", page: false };
  const doc = parseXml(await file.async("string"));
  let page = false;
  const lines: string[] = [];
  for (const p of Array.from(doc.getElementsByTagName("w:p"))) {
    let text = "";
    for (const n of Array.from(p.getElementsByTagName("*"))) {
      if (n.nodeName === "w:t") text += n.textContent ?? "";
      else if (n.nodeName === "w:tab") text += " ";
      else if (n.nodeName === "w:instrText" && /\bPAGE\b/i.test(n.textContent ?? "")) page = true;
      else if (n.nodeName === "w:fldSimple" && /\bPAGE\b/i.test(n.getAttribute("w:instr") ?? "")) page = true;
    }
    if (text.trim()) lines.push(text.trim());
  }
  let text = lines.join(" · ");
  if (page) {
    // "Página 3 de 10": o número vem do campo; sobram só as palavras soltas
    text = text.replace(/(?:[\s·|-]*)(?:p[áa]gina|p[áa]g\.?|page)?\s*(?:de|of|\/)?\s*$/i, "").trim();
  }
  return { text, page };
}
