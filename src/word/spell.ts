// Corretor de português dentro do documento Word: sublinha o que está errado (vermelho: palavra,
// amarelo: estilo) e abre sugestões ao clicar. Usa o mesmo assistente do editor Markdown.
import { Plugin, PluginKey } from "prosemirror-state";
import { Decoration, DecorationSet, type EditorView } from "prosemirror-view";
import type { Node as PMNode } from "prosemirror-model";
import { checkText, type WritingIssue } from "../broker/writing";
import { project, toPm } from "./project";

export interface WordSpellHooks {
  /** Palavras que o usuário mandou ignorar (dicionário pessoal + só neste texto). */
  getIgnore: () => Set<string>;
  ignoreHere: (word: string) => void;
  addToDictionary: (word: string) => void;
  /** Contagem de problemas (para o rodapé). */
  onCount?: (n: number) => void;
  enabled: () => boolean;
}

interface Found {
  from: number;
  to: number;
  issue: WritingIssue;
}

interface SState {
  deco: DecorationSet;
  found: Found[];
}

const key = new PluginKey<SState>("word-spell");

let popup: HTMLElement | null = null;

export function closeSpellPopup(): void {
  popup?.remove();
  popup = null;
}

function showPopup(view: EditorView, f: Found, anchor: DOMRect, hooks: WordSpellHooks, refresh: () => void): void {
  closeSpellPopup();
  const issue = f.issue;
  const box = document.createElement("div");
  box.className = "wd-pop";
  const msg = document.createElement("div");
  msg.className = "wd-pop-msg";
  msg.textContent = issue.message;
  box.append(msg);

  const options = [...new Set([issue.fix, ...issue.suggestions].filter((x): x is string => !!x))].slice(0, 6);
  const apply = (text: string) => {
    closeSpellPopup();
    const { state } = view;
    view.dispatch(state.tr.insertText(text, f.from, f.to));
    view.focus();
  };
  for (const o of options) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "wd-pop-item";
    b.textContent = o;
    b.addEventListener("mousedown", (e) => e.preventDefault());
    b.addEventListener("click", () => apply(o));
    box.append(b);
  }
  if (!options.length) {
    const none = document.createElement("div");
    none.className = "wd-pop-none";
    none.textContent = "Sem sugestões";
    box.append(none);
  }
  const sep = document.createElement("div");
  sep.className = "wd-pop-sep";
  box.append(sep);
  const word = issue.word.trim();
  const act = (label: string, run: () => void) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "wd-pop-item sub";
    b.textContent = label;
    b.addEventListener("mousedown", (e) => e.preventDefault());
    b.addEventListener("click", () => {
      closeSpellPopup();
      run();
      refresh();
    });
    box.append(b);
  };
  if (issue.kind === "spell") {
    act("Ignorar neste texto", () => hooks.ignoreHere(word));
    act("Adicionar ao dicionário", () => hooks.addToDictionary(word));
  }
  document.body.append(box);
  const w = box.offsetWidth;
  const h = box.offsetHeight;
  box.style.left = `${Math.max(8, Math.min(anchor.left, window.innerWidth - w - 8))}px`;
  const below = anchor.bottom + 6;
  box.style.top = `${below + h > window.innerHeight - 8 ? Math.max(8, anchor.top - h - 6) : below}px`;
  popup = box;
  const off = (e: MouseEvent) => {
    if (!box.contains(e.target as Node)) {
      closeSpellPopup();
      document.removeEventListener("mousedown", off, true);
    }
  };
  document.addEventListener("mousedown", off, true);
}

export function spellPlugin(hooks: WordSpellHooks): Plugin<SState> & { recheck: (view: EditorView) => void } {
  let recheckFn: ((view: EditorView) => void) | null = null;
  const plugin = new Plugin<SState>({
    key,
    state: {
      init: () => ({ deco: DecorationSet.empty, found: [] }),
      apply(tr, value) {
        const meta = tr.getMeta(key) as SState | undefined;
        if (meta) return meta;
        if (!tr.docChanged) return value;
        return {
          deco: value.deco.map(tr.mapping, tr.doc),
          found: value.found
            .map((f) => ({ ...f, from: tr.mapping.map(f.from), to: tr.mapping.map(f.to) }))
            .filter((f) => f.to > f.from),
        };
      },
    },
    props: {
      decorations: (state) => key.getState(state)?.deco ?? DecorationSet.empty,
      handleClick(view, pos, event) {
        const st = key.getState(view.state);
        const f = st?.found.find((x) => pos >= x.from && pos <= x.to);
        if (!f) return false;
        const target = (event.target as HTMLElement).closest(".wd-issue") as HTMLElement | null;
        const rect = (target ?? (event.target as HTMLElement)).getBoundingClientRect();
        showPopup(view, f, rect, hooks, () => recheckFn?.(view));
        return false;
      },
    },
    view(view) {
      let timer = 0;
      let token = 0;
      let lastDoc: PMNode | null = null;

      const run = async () => {
        if (!hooks.enabled()) return;
        const doc = view.state.doc;
        const my = ++token;
        const { texto: text, blocos: blocks } = project(doc);
        let issues: WritingIssue[] = [];
        try {
          issues = text.trim() ? await checkText(text, hooks.getIgnore()) : [];
        } catch {
          issues = [];
        }
        if (my !== token || view.state.doc !== doc) return; // o texto mudou enquanto verificava
        const found: Found[] = [];
        for (const issue of issues) {
          const a = toPm(blocks, issue.from);
          const b = toPm(blocks, Math.max(issue.from, issue.to - 1));
          if (!a || !b || a.bloco !== b.bloco) continue;
        const to = b.pos + 1;
          if (to <= a.pos) continue;
          found.push({ from: a.pos, to, issue });
        }
        const decos = found.map((f) => Decoration.inline(f.from, f.to, { class: `wd-issue ${f.issue.kind === "spell" ? "spell" : "style"}` }));
        hooks.onCount?.(found.length);
        view.dispatch(view.state.tr.setMeta(key, { deco: DecorationSet.create(doc, decos), found }).setMeta("addToHistory", false));
      };
      const schedule = (delay = 900) => {
        window.clearTimeout(timer);
        timer = window.setTimeout(() => void run(), delay);
      };
      recheckFn = () => schedule(60);
      schedule(300);
      return {
        update(v) {
          if (lastDoc !== v.state.doc) {
            lastDoc = v.state.doc;
            schedule();
          }
        },
        destroy() {
          window.clearTimeout(timer);
          closeSpellPopup();
        },
      };
    },
  }) as Plugin<SState> & { recheck: (view: EditorView) => void };
  plugin.recheck = (view) => recheckFn?.(view);
  return plugin;
}
