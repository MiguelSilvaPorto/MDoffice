// Protege trechos que não se traduzem (código, URLs, HTML, glossário) e devolve tudo no lugar depois.

export interface GlossaryEntry {
  /** Termo em português como aparece no texto. */
  pt: string;
  /** Tradução fixa; vazio = manter igual (não traduzir). */
  en: string;
}

interface Atom {
  text: string;
  kind: "atom" | "open" | "close";
  /** Havia espaço antes/depois do trecho no texto original? */
  sb: boolean;
  sa: boolean;
}

export interface Masked {
  masked: string;
  atoms: Atom[];
}

const escapeRx = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Troca código, URLs e HTML por códigos curtos (ZQ0Z, ZQ1Z…).
 * No modo leve (padrão), negrito/itálico e o texto dos links seguem no texto — os tradutores
 * respeitam bem esses marcadores. No modo estrito, até os marcadores viram códigos.
 */
export function maskInline(text: string, glossary: GlossaryEntry[] = [], nested = false, strict = false): Masked {
  const atoms: Atom[] = [];
  let out = "";
  const emp: Record<string, boolean> = {};
  const gl = glossary.filter((g) => g.pt.trim()).sort((a, b) => b.pt.length - a.pt.length);
  const glRx = gl.length
    ? new RegExp(`^(?:${gl.map((g) => escapeRx(g.pt.trim())).join("|")})(?![\\p{L}\\p{N}_])`, "iu")
    : null;
  const isWord = (c: string | undefined) => !!c && /[\p{L}\p{N}]/u.test(c);

  const put = (t: string, kind: Atom["kind"] = "atom", at = i, len = t.length, bare = false) => {
    const before = at === 0 ? !nested : /\s/.test(text[at - 1]);
    const afterCh = text[at + len];
    const after = afterCh === undefined ? !nested : /\s/.test(afterCh);
    atoms.push({ text: t, kind, sb: before, sa: after });
    out += bare ? `ZQ${atoms.length - 1}Z` : ` ZQ${atoms.length - 1}Z `;
  };
  let i = 0;
  while (i < text.length) {
    const rest = text.slice(i);
    let m: RegExpExecArray | null;
    if ((m = /^(`+)(?:(?!\1)[\s\S])*?\1/.exec(rest))) {
      put(m[0]);
      i += m[0].length;
    } else if ((m = /^!\[[^\]]*\]\([^)]*\)/.exec(rest))) {
      put(m[0]);
      i += m[0].length;
    } else if (!strict && (m = /^\[([^\]]+)\]\(([^)]*)\)/.exec(rest))) {
      const inner = maskInline(m[1], glossary, true, false);
      const base = atoms.length;
      for (const a of inner.atoms) atoms.push(a);
      out += "[" + inner.masked.replace(/ZQ(\d+)Z/g, (_, n) => `ZQ${base + Number(n)}Z`) + "](";
      put(m[2], "atom", i + 3 + m[1].length, m[2].length, true);
      out += ")";
      i += m[0].length;
    } else if ((m = /^\[([^\]]+)\]\(([^)]*)\)/.exec(rest))) {
      put("[", "open", i, 1);
      const inner = maskInline(m[1], glossary, true);
      const base = atoms.length;
      for (const a of inner.atoms) atoms.push(a);
      out += " " + inner.masked.replace(/ZQ(\d+)Z/g, (_, n) => `ZQ${base + Number(n)}Z`) + " ";
      put(`](${m[2]})`, "close", i + 1 + m[1].length, m[2].length + 3);
      i += m[0].length;
    } else if ((m = /^<\/?[a-zA-Z][^>]*>/.exec(rest))) {
      put(m[0]);
      i += m[0].length;
    } else if ((m = /^(?:https?:\/\/|www\.)[^\s)>\]]+/.exec(rest))) {
      put(m[0]);
      i += m[0].length;
    } else if (strict && ((m = /^(\*\*|__|~~|\*)/.exec(rest)) || (rest[0] === "_" && (m = /^_/.exec(rest)) && !(isWord(text[i - 1]) && isWord(text[i + 1]))))) {
      const key = m![0];
      const opening = !emp[key];
      emp[key] = opening;
      put(key, opening ? "open" : "close");
      i += key.length;
    } else if (glRx && !isWord(text[i - 1]) && (m = glRx.exec(rest))) {
      const hit = gl.find((g) => g.pt.trim().toLowerCase() === m![0].toLowerCase());
      put(hit && hit.en.trim() ? hit.en.trim() : m[0]);
      i += m[0].length;
    } else {
      out += text[i];
      i++;
    }
  }
  return { masked: out.replace(/ {2,}/g, " ").trim(), atoms };
}

/** Devolve os trechos protegidos. `null` se algum código se perdeu na tradução. */
export function unmaskInline(translated: string, atoms: Atom[]): string | null {
  const rx = /\s*ZQ\s*(\d+)\s*Z\s*/gi;
  const chunks: string[] = [];
  const ids: number[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = rx.exec(translated))) {
    chunks.push(translated.slice(last, m.index));
    ids.push(Number(m[1]));
    last = m.index + m[0].length;
  }
  chunks.push(translated.slice(last));
  if (ids.length !== atoms.length || new Set(ids).size !== atoms.length || ids.some((n) => !atoms[n])) return null;

  let out = chunks[0];
  ids.forEach((id, k) => {
    const a = atoms[id];
    const next = chunks[k + 1];
    out = out.replace(/\s+$/, "");
    if (a.sb && out) out += " ";
    out += a.text;
    if (a.sa && next && !/^[.,;:!?)\]]/.test(next.trimStart())) out += " ";
    out += next.replace(/^\s+/, "");
  });
  return out.replace(/ {2,}/g, " ").trim();
}

// ---------- melhora do inglês depois de traduzir ----------

export function polishEnglish(text: string): string {
  return text
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\s+([,.;:!?])/g, "$1")
    .replace(/([,;:!?])(?=[A-Za-z])/g, "$1 ")
    .replace(/^([a-z])/, (c) => c.toUpperCase())
    .replace(/([.!?]\s+)([a-z])/g, (_m, p: string, c: string) => p + c.toUpperCase())
    .trim();
}
