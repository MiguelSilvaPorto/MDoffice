// Entende a estrutura do Markdown e separa o que se traduz (texto) do que não se traduz (código, HTML, tabelas de separação).

export type Piece = { lit: string } | { seg: number };

interface PlanLine {
  parts: Piece[];
  /** Linha absorvida por um parágrafo mesclado (some na saída traduzida). */
  skip?: boolean;
  /** Original em português desta linha. */
  src: string;
  block: number;
}

export interface Plan {
  lines: PlanLine[];
  /** Texto (inline Markdown, em português) de cada trecho traduzível. */
  segs: string[];
}

const HAS_LETTER = /\p{L}/u;

/** Divide as células de uma linha de tabela (ignora `|` dentro de código ou escapado). */
function splitCells(line: string): string[] {
  const cells: string[] = [];
  let cur = "";
  let code = 0;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === "\\" && line[i + 1] === "|") {
      cur += "\\|";
      i++;
    } else if (c === "`") {
      let n = 1;
      while (line[i + n] === "`") n++;
      cur += "`".repeat(n);
      i += n - 1;
      code = code === n ? 0 : code === 0 ? n : code;
    } else if (c === "|" && !code) {
      cells.push(cur);
      cur = "";
    } else cur += c;
  }
  cells.push(cur);
  return cells;
}

const RX_FENCE = /^\s*(`{3,}|~{3,})/;
const RX_HTML_LINE = /^\s*(<\/?[a-zA-Z][^>]*>|<!--.*-->)\s*$/;
const RX_HR = /^\s{0,3}([-*_])(\s*\1){2,}\s*$/;
const RX_SETEXT = /^\s{0,3}(=+|-+)\s*$/;
const RX_TABLE_SEP = /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/;
const RX_REFDEF = /^\s{0,3}\[[^\]]+\]:\s+\S+/;
const RX_QUOTE = /^(\s*(?:>\s?)+)/;
const RX_LIST = /^(\s*(?:[-*+]|\d+[.)])\s+(?:\[[ xX]\]\s+)?)/;
const RX_HEADING = /^(\s{0,3}#{1,6}\s+)/;

export function planMarkdown(markdown: string): Plan {
  const src = markdown.replace(/\r\n/g, "\n").split("\n");
  const plan: Plan = { lines: [], segs: [] };
  let block = 0;
  let inFence: { ch: string; len: number } | null = null;
  let inFront = false;
  let inTable = false;
  let afterList = false;
  let prevBlank = true;
  /** Parágrafo aberto que pode receber a próxima linha. */
  let open: { seg: number; pre: string } | null = null;

  const push = (parts: Piece[], line: string) => plan.lines.push({ parts, src: line, block });
  const addSeg = (text: string): number => plan.segs.push(text) - 1;

  for (let i = 0; i < src.length; i++) {
    const line = src[i];
    const blank = line.trim() === "";
    const endPara = () => {
      open = null;
    };

    if (i === 0 && line.trim() === "---" && src.slice(1).some((l) => l.trim() === "---")) {
      inFront = true;
      push([{ lit: line }], line);
      continue;
    }
    if (inFront) {
      push([{ lit: line }], line);
      if (line.trim() === "---" || line.trim() === "...") inFront = false;
      continue;
    }

    const fence = RX_FENCE.exec(line);
    if (inFence) {
      push([{ lit: line }], line);
      if (fence && fence[1][0] === inFence.ch && fence[1].length >= inFence.len && line.trim() === fence[1]) inFence = null;
      continue;
    }
    if (fence) {
      if (prevBlank === false && !open) block++;
      endPara();
      inFence = { ch: fence[1][0], len: fence[1].length };
      push([{ lit: line }], line);
      continue;
    }

    if (blank) {
      endPara();
      inTable = false;
      afterList = false;
      block++;
      push([{ lit: line }], line);
      prevBlank = true;
      continue;
    }

    const wasBlank = prevBlank;
    prevBlank = false;

    // literais: HTML puro, linha divisória, referência, código indentado
    if (
      RX_HTML_LINE.test(line) ||
      RX_REFDEF.test(line) ||
      (RX_HR.test(line) && !open) ||
      (/^( {4}|\t)/.test(line) && wasBlank && !afterList)
    ) {
      endPara();
      push([{ lit: line }], line);
      continue;
    }
    if (RX_SETEXT.test(line) && open) {
      endPara();
      push([{ lit: line }], line);
      continue;
    }

    // tabelas: a linha seguinte é o separador (|---|---|) ou já estamos dentro de uma
    if (RX_TABLE_SEP.test(line) && line.includes("-") && (line.includes("|") || inTable)) {
      endPara();
      push([{ lit: line }], line);
      continue;
    }
    const next = src[i + 1] ?? "";
    if (line.includes("|") && (inTable || (RX_TABLE_SEP.test(next) && next.includes("|")))) {
      endPara();
      inTable = true;
      const cells = splitCells(line);
      const parts: Piece[] = [];
      cells.forEach((cell, k) => {
        if (k) parts.push({ lit: "|" });
        const t = cell.trim();
        if (!t || !HAS_LETTER.test(t)) {
          parts.push({ lit: cell });
          return;
        }
        const lead = cell.slice(0, cell.length - cell.trimStart().length);
        const trail = cell.slice(cell.trimEnd().length);
        parts.push({ lit: lead }, { seg: addSeg(t) }, { lit: trail });
      });
      push(parts, line);
      continue;
    }
    inTable = false;

    // prefixos: citação, lista, título
    let rest = line;
    let prefix = "";
    const quote = RX_QUOTE.exec(rest);
    if (quote) {
      prefix += quote[1];
      rest = rest.slice(quote[1].length);
    }
    const list = RX_LIST.exec(rest);
    const heading = !list ? RX_HEADING.exec(rest) : null;
    const marker = list ?? heading;
    if (marker) {
      prefix += marker[1];
      rest = rest.slice(marker[1].length);
    }
    const text = rest.trim();
    if (!text || !HAS_LETTER.test(text)) {
      endPara();
      afterList = !!list || (afterList && !!quote);
      push([{ lit: line }], line);
      continue;
    }

    const plain = !marker;
    // continuação do parágrafo anterior (linhas soltas viram uma frase só: melhor contexto)
    if (plain && open && open.pre === prefix) {
      plan.segs[open.seg] += " " + text;
      plan.lines.push({ parts: [], skip: true, src: line, block });
      if (/( {2,}|\\)$/.test(line)) endPara();
      continue;
    }
    afterList = !!list || (afterList && plain && /^\s+/.test(line));
    const seg = addSeg(text);
    const trail = rest.slice(rest.trimEnd().length);
    push([{ lit: prefix }, { seg }, { lit: heading ? "" : trail }], line);
    open = plain && !/( {2,}|\\)$/.test(line) ? { seg, pre: prefix } : null;
  }
  return plan;
}

/** Monta o Markdown final trocando cada trecho pela tradução (ou pelo original). */
export function renderPlan(plan: Plan, pick: (seg: number) => string): string {
  return plan.lines
    .filter((l) => !l.skip)
    .map((l) => l.parts.map((p) => ("lit" in p ? p.lit : pick(p.seg))).join(""))
    .join("\n");
}

/** Blocos (parágrafos, listas, tabelas…) em PT e EN, alinhados — base do modo bilíngue. */
export function planBlocks(plan: Plan, pick: (seg: number) => string): { pt: string; en: string }[] {
  const out = new Map<number, { pt: string[]; en: string[] }>();
  for (const l of plan.lines) {
    const entry = out.get(l.block) ?? { pt: [], en: [] };
    entry.pt.push(l.src);
    if (!l.skip) entry.en.push(l.parts.map((p) => ("lit" in p ? p.lit : pick(p.seg))).join(""));
    out.set(l.block, entry);
  }
  return [...out.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([, v]) => ({ pt: v.pt.join("\n").trim(), en: v.en.join("\n").trim() }))
    .filter((b) => b.pt || b.en);
}
