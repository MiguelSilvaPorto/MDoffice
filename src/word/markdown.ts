// Ponte entre o documento Word e o Markdown: usada para tradução, exportação (HTML, texto, ZIP…)
// e para mostrar a Estrutura. Formatação de fonte/cor/tamanho não existe em Markdown e se perde aqui.
import { marked, type Token, type Tokens } from "marked";
import type { Mark, Node as PMNode } from "prosemirror-model";
import { schema } from "./schema";

// ---------- documento → Markdown ----------

const esc = (s: string) => s.replace(/([\\`*_[\]])/g, "\\$1");

function inlineMd(node: PMNode): string {
  let out = "";
  node.forEach((child) => {
    if (child.type.name === "hard_break") {
      out += "  \n";
      return;
    }
    if (child.type.name === "image") {
      out += `![${esc(String(child.attrs.alt ?? ""))}](${child.attrs.src})`;
      return;
    }
    if (!child.isText) return;
    let t = child.text ?? "";
    const has = (n: string) => child.marks.some((m: Mark) => m.type.name === n);
    const lead = /^\s*/.exec(t)![0];
    const trail = /\s*$/.exec(t)![0];
    let core = t.trim();
    if (!core) {
      out += t;
      return;
    }
    core = has("code") ? "`" + core + "`" : esc(core);
    if (has("bold")) core = `**${core}**`;
    if (has("italic")) core = `*${core}*`;
    if (has("strike")) core = `~~${core}~~`;
    if (has("underline")) core = `<u>${core}</u>`;
    if (has("sub")) core = `<sub>${core}</sub>`;
    if (has("sup")) core = `<sup>${core}</sup>`;
    if (has("highlight")) core = `<mark>${core}</mark>`;
    const link = child.marks.find((m: Mark) => m.type.name === "link");
    if (link) core = `[${core}](${link.attrs.href})`;
    t = lead + core + trail;
    out += t;
  });
  return out;
}

function blocksMd(parent: PMNode, indent = ""): string[] {
  const out: string[] = [];
  parent.forEach((node) => {
    switch (node.type.name) {
      case "paragraph": {
        const t = inlineMd(node).replace(/^(#|>|-|\+|\d+\.)(\s)/, "\\$1$2");
        if (t.trim()) out.push(indent + t);
        break;
      }
      case "heading":
        out.push(`${indent}${"#".repeat(Number(node.attrs.level))} ${inlineMd(node)}`);
        break;
      case "blockquote":
        out.push(blocksMd(node).join("\n\n").replace(/^/gm, `${indent}> `));
        break;
      case "code_block":
        out.push(`${indent}\`\`\`\n${node.textContent}\n${indent}\`\`\``);
        break;
      case "horizontal_rule":
      case "page_break":
        out.push(`${indent}---`);
        break;
      case "bullet_list":
      case "ordered_list": {
        const lines: string[] = [];
        let n = Number(node.attrs.order) || 1;
        node.forEach((item) => {
          const marker = node.type.name === "bullet_list" ? "- " : `${n++}. `;
          const parts = blocksMd(item, "");
          const first = parts.shift() ?? "";
          lines.push(indent + marker + first.split("\n").join("\n" + indent + " ".repeat(marker.length)));
          for (const p of parts) lines.push(p.split("\n").map((l) => indent + " ".repeat(marker.length) + l).join("\n"));
        });
        out.push(lines.join("\n"));
        break;
      }
      case "table": {
        const rows: string[][] = [];
        node.forEach((tr) => {
          const cells: string[] = [];
          tr.forEach((td) => {
            const text = blocksMd(td).join(" ").replace(/\n+/g, " ").replace(/\|/g, "\\|");
            cells.push(text);
            for (let k = 1; k < (Number(td.attrs.colspan) || 1); k++) cells.push("");
          });
          rows.push(cells);
        });
        if (rows.length) {
          const cols = Math.max(...rows.map((r) => r.length));
          const norm = rows.map((r) => [...r, ...Array(cols - r.length).fill("")]);
          const line = (r: string[]) => `${indent}| ${r.join(" | ")} |`;
          out.push([line(norm[0]), `${indent}| ${Array(cols).fill("---").join(" | ")} |`, ...norm.slice(1).map(line)].join("\n"));
        }
        break;
      }
      default:
        break;
    }
  });
  return out;
}

export function toMarkdown(doc: PMNode): string {
  return blocksMd(doc).join("\n\n") + "\n";
}

// ---------- Markdown → documento ----------

function marksOf(stack: { name: string; attrs?: Record<string, unknown> }[]): Mark[] {
  return stack.map((m) => schema.marks[m.name].create(m.attrs ?? null));
}

function inlinesFrom(tokens: Token[] | undefined, stack: { name: string; attrs?: Record<string, unknown> }[] = [], state = { u: false, mark: false, sub: false, sup: false }): PMNode[] {
  const out: PMNode[] = [];
  for (const t of tokens ?? []) {
    const extra = [...stack];
    if (state.u) extra.push({ name: "underline" });
    if (state.mark) extra.push({ name: "highlight" });
    if (state.sub) extra.push({ name: "sub" });
    if (state.sup) extra.push({ name: "sup" });
    switch (t.type) {
      case "text":
      case "escape": {
        const x = t as Tokens.Text;
        if (x.tokens?.length) out.push(...inlinesFrom(x.tokens, stack, state));
        else if (x.text) out.push(schema.text(decode(x.text), marksOf(extra)));
        break;
      }
      case "strong":
        out.push(...inlinesFrom((t as Tokens.Strong).tokens, [...stack, { name: "bold" }], state));
        break;
      case "em":
        out.push(...inlinesFrom((t as Tokens.Em).tokens, [...stack, { name: "italic" }], state));
        break;
      case "del":
        out.push(...inlinesFrom((t as Tokens.Del).tokens, [...stack, { name: "strike" }], state));
        break;
      case "codespan":
        out.push(schema.text(decode((t as Tokens.Codespan).text), marksOf([...extra, { name: "code" }])));
        break;
      case "link":
        out.push(...inlinesFrom((t as Tokens.Link).tokens, [...stack, { name: "link", attrs: { href: (t as Tokens.Link).href } }], state));
        break;
      case "image": {
        const im = t as Tokens.Image;
        out.push(schema.nodes.image.create({ src: im.href, alt: im.text || null }));
        break;
      }
      case "br":
        out.push(schema.nodes.hard_break.create());
        break;
      case "html": {
        const tag = (t as Tokens.HTML).text.trim().toLowerCase();
        if (tag === "<u>") state.u = true;
        else if (tag === "</u>") state.u = false;
        else if (tag === "<mark>") state.mark = true;
        else if (tag === "</mark>") state.mark = false;
        else if (tag === "<sub>") state.sub = true;
        else if (tag === "</sub>") state.sub = false;
        else if (tag === "<sup>") state.sup = true;
        else if (tag === "</sup>") state.sup = false;
        else if (/^<br\s*\/?>$/.test(tag)) out.push(schema.nodes.hard_break.create());
        break;
      }
      default: {
        const raw = (t as { raw?: string }).raw;
        if (raw) out.push(schema.text(raw, marksOf(extra)));
      }
    }
  }
  return out;
}

function decode(s: string): string {
  return s.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'");
}

function blocksFrom(tokens: Token[]): PMNode[] {
  const out: PMNode[] = [];
  for (const t of tokens) {
    switch (t.type) {
      case "heading": {
        const x = t as Tokens.Heading;
        out.push(schema.nodes.heading.create({ level: Math.min(6, x.depth) }, inlinesFrom(x.tokens)));
        break;
      }
      case "paragraph":
        out.push(schema.nodes.paragraph.create(null, inlinesFrom((t as Tokens.Paragraph).tokens)));
        break;
      case "text":
        out.push(schema.nodes.paragraph.create(null, inlinesFrom((t as Tokens.Text).tokens ?? [t])));
        break;
      case "blockquote": {
        const inner = blocksFrom((t as Tokens.Blockquote).tokens);
        if (inner.length) out.push(schema.nodes.blockquote.create(null, inner));
        break;
      }
      case "code":
        out.push(schema.nodes.code_block.create(null, (t as Tokens.Code).text ? [schema.text((t as Tokens.Code).text)] : []));
        break;
      case "hr":
        out.push(schema.nodes.horizontal_rule.create());
        break;
      case "list": {
        const l = t as Tokens.List;
        const items = l.items.map((it) => {
          const inner = blocksFrom(it.tokens);
          const firstIsPara = inner[0]?.type.name === "paragraph";
          const kids = firstIsPara ? inner : [schema.nodes.paragraph.create(), ...inner];
          return schema.nodes.list_item.create(null, kids);
        });
        if (items.length) out.push(l.ordered ? schema.nodes.ordered_list.create({ order: Number(l.start) || 1 }, items) : schema.nodes.bullet_list.create(null, items));
        break;
      }
      case "table": {
        const tb = t as Tokens.Table;
        const cell = (c: Tokens.TableCell) => schema.nodes.table_cell.create(null, [schema.nodes.paragraph.create(null, inlinesFrom(c.tokens))]);
        const rows = [tb.header, ...tb.rows].map((r) => schema.nodes.table_row.create(null, r.map(cell)));
        if (rows.length) out.push(schema.nodes.table.create(null, rows));
        break;
      }
      default:
        break;
    }
  }
  return out;
}

export function fromMarkdown(md: string): PMNode {
  const blocks = blocksFrom(marked.lexer(md));
  return schema.nodes.doc.create(null, blocks.length ? blocks : [schema.nodes.paragraph.create()]);
}

// ---------- Estrutura (títulos) ----------

export interface WordOutlineSource {
  text: string;
  positions: number[];
  pids: (string | null)[];
}

/** Texto estilo Markdown só com os títulos e o texto de cada bloco + a posição de cada linha no documento e IDs. */
export function outlineSource(doc: PMNode): WordOutlineSource {
  const lines: string[] = [];
  const positions: number[] = [];
  const pids: (string | null)[] = [];
  doc.descendants((node, pos) => {
    if (node.type.name === "heading") {
      lines.push(`${"#".repeat(Number(node.attrs.level))} ${node.textContent}`);
      positions.push(pos + 1);
      pids.push(node.attrs.pid ?? null);
      return false;
    }
    if (node.isTextblock) {
      lines.push(node.textContent);
      positions.push(pos + 1);
      pids.push(node.attrs.pid ?? null);
      return false;
    }
    return true;
  });
  return { text: lines.join("\n"), positions, pids };
}
