// Markdown → texto simples (sem formatação).

import { marked, type Token, type Tokens } from "marked";

export function inlineText(tokens: Token[] | undefined): string {
  return (tokens ?? [])
    .map((t) => {
      switch (t.type) {
        case "link": {
          const l = t as Tokens.Link;
          const txt = inlineText(l.tokens);
          return /^https?:/i.test(l.href) && txt !== l.href ? `${txt} (${l.href})` : txt;
        }
        case "image":
          return `[imagem: ${(t as Tokens.Image).text || "sem legenda"}]`;
        case "codespan":
          return (t as Tokens.Codespan).text;
        case "br":
          return "\n";
        case "html":
          return "";
        default: {
          const x = t as Tokens.Text & { tokens?: Token[] };
          return x.tokens ? inlineText(x.tokens) : x.text ?? (t as { raw?: string }).raw ?? "";
        }
      }
    })
    .join("");
}

export function textBlocks(tokens: Token[], indent = ""): string[] {
  const out: string[] = [];
  for (const t of tokens) {
    switch (t.type) {
      case "heading": {
        const x = t as Tokens.Heading;
        const txt = inlineText(x.tokens);
        out.push(x.depth === 1 ? `${txt.toUpperCase()}\n${"=".repeat(Math.min(60, txt.length))}` : x.depth === 2 ? `${txt}\n${"-".repeat(Math.min(60, txt.length))}` : txt);
        break;
      }
      case "paragraph":
      case "text":
        out.push(indent + inlineText((t as Tokens.Paragraph).tokens ?? [t]).replace(/\n/g, `\n${indent}`));
        break;
      case "list": {
        const list = t as Tokens.List;
        const lines: string[] = [];
        list.items.forEach((item, i) => {
          const mark = item.task ? (item.checked ? "[x]" : "[ ]") : list.ordered ? `${(Number(list.start) || 1) + i}.` : "•";
          const head = item.tokens.filter((k) => k.type !== "list");
          lines.push(`${indent}${mark} ${head.map((k) => inlineText((k as Tokens.Paragraph).tokens ?? [k])).join(" ")}`);
          for (const sub of item.tokens.filter((k) => k.type === "list")) lines.push(...textBlocks([sub], indent + "   "));
        });
        out.push(lines.join("\n"));
        break;
      }
      case "blockquote":
        out.push(textBlocks((t as Tokens.Blockquote).tokens).join("\n\n").replace(/^/gm, `${indent}> `));
        break;
      case "code":
        out.push((t as Tokens.Code).text.replace(/^/gm, `${indent}    `));
        break;
      case "table": {
        const tb = t as Tokens.Table;
        const row = (cells: Tokens.TableCell[]) => cells.map((c) => inlineText(c.tokens)).join("  |  ");
        out.push([row(tb.header), ...tb.rows.map(row)].join("\n"));
        break;
      }
      case "hr":
        out.push("────────────────────");
        break;
      default:
        break;
    }
  }
  return out;
}

export function markdownToText(md: string): string {
  return textBlocks(marked.lexer(md)).join("\n\n") + "\n";
}
