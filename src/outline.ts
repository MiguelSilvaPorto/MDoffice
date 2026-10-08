// Painel "Estrutura": árvore de títulos do documento com seções que recolhem, destaque da seção
// atual, contagem de palavras/tarefas e ações (mover, promover/rebaixar, copiar, excluir).
import { h } from "./util";

interface Section {
  level: number;
  text: string;
  /** Linha do título (1-based). */
  line: number;
  /** Intervalo da seção inteira em caracteres (título + conteúdo + subseções). */
  start: number;
  end: number;
  words: number;
  tasksDone: number;
  tasksTotal: number;
  hasChildren: boolean;
  key: string;
}

export interface MenuEntry {
  label: string;
  hint?: string;
  run: () => void;
  sep?: boolean;
}

export interface OutlineHooks {
  getText: () => string;
  goto: (line: number) => void;
  edit: (from: number, to: number, insert: string) => void;
  copy: (text: string) => void;
  notify: (msg: string) => void;
  openMenu: (x: number, y: number, items: MenuEntry[]) => void;
}

const FENCE = /^\s*(```|~~~)/;

/** Lê os títulos (fora de blocos de código) e calcula o intervalo e as contagens de cada seção. */
export function parse(text: string): Section[] {
  const lines = text.split("\n");
  const offsets: number[] = [];
  let acc = 0;
  for (const l of lines) {
    offsets.push(acc);
    acc += l.length + 1;
  }
  offsets.push(text.length);

  const heads: { level: number; text: string; idx: number }[] = [];
  let fence = false;
  lines.forEach((l, i) => {
    if (FENCE.test(l)) {
      fence = !fence;
      return;
    }
    if (fence) return;
    const m = /^(#{1,6})\s+(.+?)\s*#*\s*$/.exec(l);
    if (m) heads.push({ level: m[1].length, text: m[2].trim(), idx: i });
  });

  const seen = new Map<string, number>();
  return heads.map((hd, n) => {
    // a seção vai até o próximo título de nível igual ou menor
    let endIdx = lines.length;
    for (let k = n + 1; k < heads.length; k++) {
      if (heads[k].level <= hd.level) {
        endIdx = heads[k].idx;
        break;
      }
    }
    let words = 0;
    let done = 0;
    let total = 0;
    let inFence = false;
    for (let i = hd.idx; i < endIdx; i++) {
      const l = lines[i];
      if (FENCE.test(l)) {
        inFence = !inFence;
        continue;
      }
      if (inFence) continue;
      if (i > hd.idx || true) words += (l.replace(/^#{1,6}\s+/, "").match(/[\p{L}\p{N}_'-]+/gu) ?? []).length;
      const t = /^\s*[-*+]\s+\[([ xX])\]/.exec(l);
      if (t) {
        total++;
        if (t[1] !== " ") done++;
      }
    }
    const base = `${hd.level}:${hd.text}`;
    const c = (seen.get(base) ?? 0) + 1;
    seen.set(base, c);
    return {
      level: hd.level,
      text: hd.text,
      line: hd.idx + 1,
      start: offsets[hd.idx],
      end: endIdx >= lines.length ? text.length : offsets[endIdx],
      words,
      tasksDone: done,
      tasksTotal: total,
      hasChildren: n + 1 < heads.length && heads[n + 1].level > hd.level,
      key: `${base}#${c}`,
    };
  });
}

export class OutlinePanel {
  private host: HTMLElement;
  private hooks: OutlineHooks;
  private sections: Section[] = [];
  private collapsed = new Set<string>();
  private cursorLine = 1;
  private filter = "";

  constructor(host: HTMLElement, hooks: OutlineHooks) {
    this.host = host;
    this.hooks = hooks;
  }

  /** Memória de recolhido/aberto é por documento: a aba nova começa limpa. */
  useCollapsed(set: Set<string>): void {
    this.collapsed = set;
  }

  setFilter(q: string): void {
    this.filter = q.trim().toLowerCase();
    this.paint();
  }

  setCursorLine(line: number): void {
    if (line === this.cursorLine) return;
    this.cursorLine = line;
    this.markCurrent();
  }

  collapseAll(on: boolean): void {
    this.collapsed.clear();
    if (on) for (const s of this.sections) if (s.hasChildren) this.collapsed.add(s.key);
    this.paint();
  }

  render(): void {
    this.sections = parse(this.hooks.getText());
    this.paint();
  }

  // ---------- desenho ----------

  private currentIndex(): number {
    let cur = -1;
    this.sections.forEach((s, i) => {
      if (s.line <= this.cursorLine) cur = i;
    });
    return cur;
  }

  private markCurrent(): void {
    const cur = this.currentIndex();
    const rows = this.host.querySelectorAll<HTMLElement>(".ol-row");
    let target: HTMLElement | null = null;
    rows.forEach((r) => {
      const on = Number(r.dataset.i) === cur;
      r.classList.toggle("current", on);
      if (on) target = r;
    });
    (target as HTMLElement | null)?.scrollIntoView({ block: "nearest" });
  }

  private paint(): void {
    const host = this.host;
    host.textContent = "";
    if (!this.sections.length) {
      host.append(h("div", { class: "side-empty", text: "Sem títulos ainda. Comece uma linha com # para criar uma seção." }));
      return;
    }
    const minLevel = Math.min(...this.sections.map((s) => s.level));
    const q = this.filter;
    let hideBelow = Infinity; // nível a partir do qual as linhas estão escondidas por um pai recolhido
    this.sections.forEach((s, i) => {
      if (q) {
        if (!s.text.toLowerCase().includes(q)) return;
      } else {
        if (s.level > hideBelow) return;
        hideBelow = Infinity;
        if (s.hasChildren && this.collapsed.has(s.key)) hideBelow = s.level;
      }
      host.append(this.row(s, i, minLevel, !!q));
    });
    if (!host.childElementCount) host.append(h("div", { class: "sb-note", text: "Nenhum título encontrado." }));
    this.markCurrent();
  }

  private row(s: Section, i: number, minLevel: number, flat: boolean): HTMLElement {
    const row = h("div", { class: `ol-row lv${Math.min(6, s.level)}`, "data-i": String(i), title: `Linha ${s.line} · ${s.words} palavra(s)` });
    row.style.paddingLeft = `${6 + (flat ? 0 : (s.level - minLevel) * 14)}px`;

    const chev = h("button", { class: `ol-chev${s.hasChildren && !flat ? "" : " empty"}`, type: "button", tabindex: "-1", "aria-label": "Recolher ou abrir" });
    if (s.hasChildren && !flat) {
      const open = !this.collapsed.has(s.key);
      chev.innerHTML = `<svg class="ic ${open ? "open" : ""}"><use href="#i-chevron-r"/></svg>`;
      chev.addEventListener("click", (e) => {
        e.stopPropagation();
        if (this.collapsed.has(s.key)) this.collapsed.delete(s.key);
        else this.collapsed.add(s.key);
        this.paint();
      });
    }
    const name = h("span", { class: "ol-name", text: s.text });
    row.append(chev, name);

    if (s.tasksTotal) {
      const full = s.tasksDone === s.tasksTotal;
      row.append(h("span", { class: `ol-badge${full ? " done" : ""}`, text: `${s.tasksDone}/${s.tasksTotal}`, title: "Tarefas concluídas nesta seção" }));
    }
    row.append(h("span", { class: "ol-words", text: s.words >= 1000 ? `${(s.words / 1000).toFixed(1)}k` : String(s.words) }));
    const more = h("button", { class: "ol-more", type: "button", title: "Ações da seção", "aria-label": "Ações da seção" });
    more.innerHTML = '<svg class="ic"><use href="#i-more"/></svg>';
    more.addEventListener("click", (e) => {
      e.stopPropagation();
      const r = more.getBoundingClientRect();
      this.menu(s, r.left, r.bottom + 4);
    });
    row.append(more);

    row.addEventListener("click", () => this.hooks.goto(s.line));
    row.addEventListener("contextmenu", (e) => {
      e.preventDefault();
      this.menu(s, e.clientX, e.clientY);
    });
    return row;
  }

  // ---------- ações ----------

  private siblingBefore(s: Section): Section | null {
    const i = this.sections.indexOf(s);
    for (let k = i - 1; k >= 0; k--) {
      if (this.sections[k].level < s.level) return null;
      if (this.sections[k].level === s.level) return this.sections[k];
    }
    return null;
  }

  private siblingAfter(s: Section): Section | null {
    const i = this.sections.indexOf(s);
    for (let k = i + 1; k < this.sections.length; k++) {
      if (this.sections[k].level < s.level) return null;
      if (this.sections[k].level === s.level) return this.sections[k];
    }
    return null;
  }

  /** Troca a seção de lugar com a vizinha (uma única edição: Ctrl+Z desfaz). */
  private swap(first: Section, second: Section): void {
    const text = this.hooks.getText();
    let a = text.slice(first.start, first.end);
    let b = text.slice(second.start, second.end);
    if (!b.endsWith("\n")) {
      b += "\n";
      a = a.replace(/\n$/, "");
    }
    this.hooks.edit(first.start, second.end, b + a);
  }

  private move(s: Section, dir: -1 | 1): void {
    const other = dir < 0 ? this.siblingBefore(s) : this.siblingAfter(s);
    if (!other) {
      this.hooks.notify(dir < 0 ? "Esta já é a primeira seção desse nível." : "Esta já é a última seção desse nível.");
      return;
    }
    if (dir < 0) this.swap(other, s);
    else this.swap(s, other);
  }

  /** Sobe ou desce o nível do título e de todas as subseções (## → #). */
  private shift(s: Section, delta: -1 | 1): void {
    const text = this.hooks.getText();
    const block = text.slice(s.start, s.end);
    const inner = parse(block);
    if (inner.some((x) => x.level + delta < 1 || x.level + delta > 6)) {
      this.hooks.notify(delta < 0 ? "Já está no nível mais alto." : "Já está no nível mais baixo (######).");
      return;
    }
    const lines = block.split("\n");
    let fence = false;
    const out = lines.map((l) => {
      if (FENCE.test(l)) {
        fence = !fence;
        return l;
      }
      if (fence) return l;
      return l.replace(/^(#{1,6})(\s+)/, (_m, hashes: string, sp: string) => "#".repeat(hashes.length + delta) + sp);
    });
    this.hooks.edit(s.start, s.end, out.join("\n"));
  }

  private remove(s: Section): void {
    this.hooks.edit(s.start, s.end, "");
    this.hooks.notify(`Seção “${s.text}” excluída. Ctrl+Z desfaz.`);
  }

  private addChild(s: Section): void {
    const text = this.hooks.getText();
    const level = Math.min(6, s.level + 1);
    const head = `${"#".repeat(level)} Nova seção`;
    let insertAt = s.end;
    let prefix = "";
    if (insertAt >= text.length && !text.endsWith("\n")) prefix = "\n";
    this.hooks.edit(insertAt, insertAt, `${prefix}\n${head}\n\n`);
  }

  private menu(s: Section, x: number, y: number): void {
    const before = this.siblingBefore(s);
    const after = this.siblingAfter(s);
    const items: MenuEntry[] = [
      { label: "Ir para a seção", run: () => this.hooks.goto(s.line) },
      { label: "Mover para cima", run: () => this.move(s, -1), hint: before ? "" : "primeira" },
      { label: "Mover para baixo", run: () => this.move(s, 1), hint: after ? "" : "última" },
      { label: "Promover (## → #)", run: () => this.shift(s, -1), sep: true },
      { label: "Rebaixar (# → ##)", run: () => this.shift(s, 1) },
      { label: "Adicionar subseção", run: () => this.addChild(s), sep: true },
      {
        label: "Copiar o texto da seção",
        run: () => this.hooks.copy(this.hooks.getText().slice(s.start, s.end).replace(/\n+$/, "")),
      },
      { label: "Excluir a seção", run: () => this.remove(s), sep: true },
    ];
    this.hooks.openMenu(x, y, items);
  }
}
