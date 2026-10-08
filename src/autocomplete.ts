// Assistência de escrita e previsão de palavras inline (estilo Copilot / Ghost Text).
// 100% offline e local: usa n-gramas curados do português, vocabulário do documento atual
// e frequência de palavras, com latência zero e suporte ao Tab / Alt+Seta para aceitar.

import { EditorView, WidgetType, Decoration, type DecorationSet, ViewPlugin, type ViewUpdate, keymap } from "@codemirror/view";
import { StateField, StateEffect, Prec, type Extension, type Text } from "@codemirror/state";
import { PALAVRAS_LISTA } from "./palavras";

export interface GhostSuggestion {
  text: string;
  pos: number;
}

// ---------- base curada de n-gramas em português ----------

/**
 * Trigramas curados: dadas duas palavras anteriores (em minúsculas), qual é a continuação natural.
 * Exemplo: "de acordo" -> "com"
 */
const CURATED_TRIGRAMS: Record<string, string[]> = {
  "de acordo": ["com"],
  "de acordo com": ["o", "a", "os", "as"],
  "por causa": ["de", "do", "da"],
  "a fim": ["de"],
  "com o": ["objetivo", "intuito", "propósito"],
  "com o objetivo": ["de"],
  "com o intuito": ["de"],
  "com o proposito": ["de"],
  "com o propósito": ["de"],
  "no entanto": ["é", "não", "podemos"],
  "alem disso": ["é", "o", "a", "não"],
  "além disso": ["é", "o", "a", "não"],
  "por outro": ["lado"],
  "por outro lado": ["é", "não", "o"],
  "tendo em": ["vista"],
  "tendo em vista": ["que", "o", "a"],
  "em relacao": ["a", "ao", "à"],
  "em relação": ["a", "ao", "à"],
  "do ponto": ["de vista"],
  "do ponto de": ["vista"],
  "com base": ["em", "no", "na"],
  "na verdade": ["não", "é", "o"],
  "por exemplo": ["o", "a", "um", "uma"],
  "ao mesmo": ["tempo"],
  "a partir": ["de", "do", "da"],
  "com certeza": ["que", "é"],
  "vale ressaltar": ["que"],
  "vale notar": ["que"],
  "vale lembrar": ["que"],
  "e importante": ["destacar", "ressaltar", "notar", "lembrar"],
  "é importante": ["destacar", "ressaltar", "notar", "lembrar"],
  "importante destacar": ["que"],
  "importante ressaltar": ["que"],
  "importante notar": ["que"],
  "como resultado": ["de", "disso"],
  "dessa forma": ["o", "a", "é", "podemos"],
  "desse modo": ["o", "a", "é"],
  "em primeiro": ["lugar"],
  "muito obrigado": ["pela", "pelo", "por"],
  "muito obrigada": ["pela", "pelo", "por"],
  "por favor": ["verifique", "confira", "envie", "avise"],
  "nao apenas": ["mas também"],
  "não apenas": ["mas também"],
  "nao so": ["como também"],
  "não só": ["como também"],
  "banco de": ["dados"],
  "desenvolvimento de": ["software"],
  "interface de": ["usuário"],
  "tempo de": ["execução", "resposta"],
  "linha de": ["comando"],
  "passo a": ["passo"],
  "dia a": ["dia"],
  "mais ou": ["menos"],
  "um dos": ["principais", "maiores", "melhores"],
  "uma das": ["principais", "maiores", "melhores"],
  "para que": ["seja", "possamos", "o"],
  "no caso": ["de", "do", "da"],
  "por meio": ["de", "do", "da"],
  "atraves de": ["um", "uma", "meio"],
  "através de": ["um", "uma", "meio"],
  "em vez": ["de"],
  "ao inves": ["de"],
  "ao invés": ["de"],
  "com relacao": ["a", "ao", "à"],
  "com relação": ["a", "ao", "à"],
  "a respeito": ["de", "do", "da"],
  "de forma": ["que", "clara", "simples", "direta"],
  "de modo": ["que", "geral"],
  "no sentido": ["de"],
  "sem duvida": ["alguma"],
  "sem dúvida": ["alguma"],
  "desde ja": ["agradeço"],
  "desde já": ["agradeço"],
  "se voce": ["precisar", "quiser", "tiver"],
  "se você": ["precisar", "quiser", "tiver"],
  "caso voce": ["precise", "queira", "tenha"],
  "caso você": ["precise", "queira", "tenha"],
  "estou a": ["disposição"],
  "estou à": ["disposição"],
  "a disposicao": ["para ajudar"],
  "à disposição": ["para ajudar"],
  "qualquer duvida": ["estou à disposição"],
  "qualquer dúvida": ["estou à disposição"],
};

/**
 * Bigramas curados: dada uma palavra anterior (em minúsculas), palavras seguintes muito comuns.
 */
const CURATED_BIGRAMS: Record<string, string[]> = {
  acordo: ["com"],
  apesar: ["de", "disso"],
  alem: ["disso"],
  além: ["disso"],
  devido: ["ao", "à", "a"],
  diante: ["disso"],
  depois: ["de", "do", "da"],
  antes: ["de", "do", "da"],
  afim: ["de"],
  entanto: ["não", "é"],
  exemplo: ["o", "a", "um"],
  favor: ["verifique", "avise"],
  graças: ["a", "ao", "à"],
  gracas: ["a", "ao", "à"],
  junto: ["com", "ao", "à"],
  medida: ["que"],
  obrigado: ["pela", "pelo"],
  obrigada: ["pela", "pelo"],
  quanto: ["a", "ao", "às"],
  respeito: ["de", "do", "da"],
  relação: ["a", "ao", "à"],
  relacao: ["a", "ao", "à"],
  trata: ["de", "do", "da"],
  tratam: ["de", "do", "da"],
  visto: ["que"],
  vista: ["que", "disso"],
  banco: ["de dados"],
  linha: ["de comando"],
  sistema: ["operacional"],
  código: ["fonte"],
  codigo: ["fonte"],
};

// ---------- indexador do documento (aprendizado local em tempo real) ----------

export class DocumentIndex {
  /** Mapa de frequência de palavras no documento: normalizado -> contagem */
  readonly wordFreq = new Map<string, number>();
  /** Grafia original da palavra encontrada (preserva CamelCase e acentos) */
  readonly originalCase = new Map<string, string>();
  /** Bigramas do documento: palavra1 -> { palavra2: contagem } */
  readonly bigrams = new Map<string, Map<string, number>>();
  /** Trigramas do documento: "palavra1 palavra2" -> { palavra3: contagem } */
  readonly trigrams = new Map<string, Map<string, number>>();

  update(text: string): void {
    this.wordFreq.clear();
    this.originalCase.clear();
    this.bigrams.clear();
    this.trigrams.clear();

    const rx = /[a-zA-ZÀ-ÿ0-9_-]+/g;
    let match: RegExpExecArray | null;
    const tokens: string[] = [];

    while ((match = rx.exec(text)) !== null) {
      tokens.push(match[0]);
    }

    for (let i = 0; i < tokens.length; i++) {
      const orig = tokens[i];
      const norm = orig.toLowerCase();

      this.wordFreq.set(norm, (this.wordFreq.get(norm) ?? 0) + 1);
      if (!this.originalCase.has(norm)) {
        this.originalCase.set(norm, orig);
      }

      // Bigrama
      if (i > 0) {
        const prev = tokens[i - 1].toLowerCase();
        let bMap = this.bigrams.get(prev);
        if (!bMap) {
          bMap = new Map();
          this.bigrams.set(prev, bMap);
        }
        bMap.set(orig, (bMap.get(orig) ?? 0) + 1);
      }

      // Trigrama
      if (i > 1) {
        const p1 = tokens[i - 2].toLowerCase();
        const p2 = tokens[i - 1].toLowerCase();
        const key = `${p1} ${p2}`;
        let tMap = this.trigrams.get(key);
        if (!tMap) {
          tMap = new Map();
          this.trigrams.set(key, tMap);
        }
        tMap.set(orig, (tMap.get(orig) ?? 0) + 1);
      }
    }
  }

  getBestTrigram(p1: string, p2: string): string | null {
    const key = `${p1.toLowerCase()} ${p2.toLowerCase()}`;
    const map = this.trigrams.get(key);
    if (!map || map.size === 0) return null;
    let bestWord: string | null = null;
    let max = -1;
    for (const [w, count] of map.entries()) {
      if (count > max) {
        max = count;
        bestWord = w;
      }
    }
    return bestWord;
  }

  getBestBigram(p: string, prefixFilter = ""): string | null {
    const map = this.bigrams.get(p.toLowerCase());
    if (!map || map.size === 0) return null;
    let bestWord: string | null = null;
    let max = -1;
    const filterNorm = prefixFilter.toLowerCase();
    for (const [w, count] of map.entries()) {
      if (filterNorm && !w.toLowerCase().startsWith(filterNorm)) continue;
      if (count > max) {
        max = count;
        bestWord = w;
      }
    }
    return bestWord;
  }

  getWordByPrefix(prefix: string): string | null {
    const norm = prefix.toLowerCase();
    let bestWord: string | null = null;
    let max = -1;
    for (const [w, count] of this.wordFreq.entries()) {
      if (w.startsWith(norm) && w.length > norm.length) {
        if (count > max) {
          max = count;
          bestWord = this.originalCase.get(w) ?? w;
        }
      }
    }
    return bestWord;
  }
}

// ---------- lógica de predição do ghost text ----------

/**
 * Analisa a linha e a posição do cursor e devolve a sugestão de ghost text, se houver.
 */
export function predictCompletion(
  doc: Text,
  pos: number,
  index: DocumentIndex
): GhostSuggestion | null {
  const line = doc.lineAt(pos);
  const col = pos - line.from;
  const before = line.text.slice(0, col);
  const after = line.text.slice(col);

  // Se o cursor estiver no meio de caracteres alfanuméricos (ex: pa|lavra), não atrapalha
  if (/^[a-zA-ZÀ-ÿ0-9_-]/u.test(after)) {
    return null;
  }

  // Linha em branco ou apenas espaços: nada para prever
  if (before.trim() === "") {
    return null;
  }

  // Não sugerir em linhas de cerca de código markdown (```)
  if (before.trim().startsWith("```")) {
    return null;
  }

  // --- Caso 1: Usuário está digitando letras no final (prefixo de palavra) ---
  const prefixMatch = /([a-zA-ZÀ-ÿ0-9_-]+)$/.exec(before);
  if (prefixMatch) {
    const prefix = prefixMatch[1];
    if (prefix.length < 2) return null;

    const textBeforePrefix = before.slice(0, -prefix.length);
    const wordsBefore = textBeforePrefix.trim().split(/\s+/);
    const prevWord = wordsBefore.length > 0 ? wordsBefore[wordsBefore.length - 1] : "";

    let candidate: string | null = null;

    // 1. Tenta achar bigrama no documento onde a palavra anterior se conecta com este prefixo
    if (prevWord) {
      candidate = index.getBestBigram(prevWord, prefix);
    }

    // 2. Tenta nos bigramas curados de português
    if (!candidate && prevWord) {
      const curList = CURATED_BIGRAMS[prevWord.toLowerCase()];
      if (curList) {
        const found = curList.find((w) => w.toLowerCase().startsWith(prefix.toLowerCase()));
        if (found) candidate = found;
      }
    }

    // 3. Tenta palavras mais usadas do próprio documento atual
    if (!candidate) {
      candidate = index.getWordByPrefix(prefix);
    }

    // 4. Tenta nas palavras mais frequentes da língua portuguesa
    if (!candidate) {
      const pNorm = prefix.toLowerCase();
      for (const w of PALAVRAS_LISTA) {
        if (w.toLowerCase().startsWith(pNorm) && w.length > pNorm.length) {
          candidate = w;
          break;
        }
      }
    }

    if (candidate && candidate.toLowerCase().startsWith(prefix.toLowerCase())) {
      let suffix = candidate.slice(prefix.length);
      if (prefix[0] === prefix[0].toUpperCase() && suffix.length > 0) {
        if (prefix === prefix.toUpperCase()) {
          suffix = suffix.toUpperCase();
        }
      }
      if (suffix.length > 0) {
        return { text: suffix, pos };
      }
    }

    return null;
  }

  // --- Caso 2: Usuário terminou uma palavra e deu espaço (prever próxima palavra) ---
  const spaceMatch = /\s+$/.exec(before);
  if (spaceMatch) {
    const trimmed = before.trim();
    if (!trimmed) return null;

    const words = trimmed.split(/[\s,;:!?—\-]+/);
    const lastWord = words[words.length - 1];
    const secondLastWord = words.length > 1 ? words[words.length - 2] : "";

    let nextWords: string | null = null;

    // 1. Trigrama no documento atual
    if (secondLastWord && lastWord) {
      nextWords = index.getBestTrigram(secondLastWord, lastWord);
    }

    // 2. Trigrama curado da língua portuguesa
    if (!nextWords && secondLastWord && lastWord) {
      const key = `${secondLastWord.toLowerCase()} ${lastWord.toLowerCase()}`;
      const list = CURATED_TRIGRAMS[key];
      if (list && list.length > 0) {
        nextWords = list[0];
      }
    }

    // 3. Bigrama no documento atual
    if (!nextWords && lastWord) {
      nextWords = index.getBestBigram(lastWord);
    }

    // 4. Bigrama curado da língua portuguesa
    if (!nextWords && lastWord) {
      const list = CURATED_BIGRAMS[lastWord.toLowerCase()];
      if (list && list.length > 0) {
        nextWords = list[0];
      }
    }

    if (nextWords && nextWords.trim().length > 0) {
      if (nextWords.toLowerCase() === lastWord.toLowerCase()) return null;
      if (after.trim().startsWith(nextWords)) return null;

      return { text: nextWords, pos };
    }
  }

  return null;
}

// ---------- widget visual e campo de estado CodeMirror 6 ----------

class GhostTextWidget extends WidgetType {
  constructor(readonly text: string) {
    super();
  }

  toDOM(): HTMLElement {
    const span = document.createElement("span");
    span.className = "cm-ghost-text";
    span.textContent = this.text;
    span.setAttribute("aria-hidden", "true");
    return span;
  }

  eq(other: GhostTextWidget): boolean {
    return other.text === this.text;
  }
}

export const setGhostEffect = StateEffect.define<GhostSuggestion | null>();

export const ghostTextField = StateField.define<{
  suggestion: GhostSuggestion | null;
  decorations: DecorationSet;
}>({
  create() {
    return { suggestion: null, decorations: Decoration.none };
  },
  update(val, tr) {
    let suggestion = val.suggestion;
    let changed = false;

    for (const effect of tr.effects) {
      if (effect.is(setGhostEffect)) {
        suggestion = effect.value;
        changed = true;
      }
    }

    if (tr.docChanged) {
      if (suggestion) {
        // Se o usuário digitou exatamente o caractere inicial da sugestão, fatia em 0ms
        let matched = false;
        if (!tr.changes.empty) {
          let insertedText = "";
          let insertedFrom = -1;
          tr.changes.iterChanges((fromA, toA, fromB, toB, inserted) => {
            insertedText += inserted.toString();
            if (insertedFrom === -1) insertedFrom = fromA;
          });

          if (
            insertedFrom === suggestion.pos &&
            insertedText.length > 0 &&
            suggestion.text.toLowerCase().startsWith(insertedText.toLowerCase())
          ) {
            const remaining = suggestion.text.slice(insertedText.length);
            const newPos = suggestion.pos + insertedText.length;
            suggestion = remaining.length > 0 ? { text: remaining, pos: newPos } : null;
            matched = true;
            changed = true;
          }
        }

        if (!matched) {
          suggestion = null;
          changed = true;
        }
      }
    } else if (tr.selection) {
      // Se apenas o cursor moveu e saiu da posição da sugestão, limpa imediatamente
      if (suggestion && tr.state.selection.main.head !== suggestion.pos) {
        suggestion = null;
        changed = true;
      }
    }

    if (!changed) return val;

    if (!suggestion || !suggestion.text) {
      return { suggestion: null, decorations: Decoration.none };
    }

    const deco = Decoration.set([
      Decoration.widget({
        widget: new GhostTextWidget(suggestion.text),
        side: 1,
      }).range(suggestion.pos),
    ]);

    return { suggestion, decorations: deco };
  },
  provide: (field) => EditorView.decorations.from(field, (v) => v.decorations),
});

// ---------- atalhos de teclado (Tab / Esc / Alt+Seta / Ctrl+Seta) ----------

/** Aceita toda a sugestão de ghost text atual */
export function acceptGhostText(view: EditorView): boolean {
  const fieldVal = view.state.field(ghostTextField, false);
  const cur = fieldVal?.suggestion;
  if (!cur || !cur.text) return false;

  const insert = cur.text;
  view.dispatch({
    changes: { from: cur.pos, to: cur.pos, insert },
    selection: { anchor: cur.pos + insert.length },
    effects: setGhostEffect.of(null),
    scrollIntoView: true,
  });
  return true;
}

/** Aceita apenas a próxima palavra da sugestão (estilo Alt+Seta / Ctrl+Seta do Copilot) */
export function acceptGhostWord(view: EditorView): boolean {
  const fieldVal = view.state.field(ghostTextField, false);
  const cur = fieldVal?.suggestion;
  if (!cur || !cur.text) return false;

  const m = /^(\S+\s*)/.exec(cur.text);
  if (!m) return false;

  const word = m[1];
  const remaining = cur.text.slice(word.length);
  const nextPos = cur.pos + word.length;

  view.dispatch({
    changes: { from: cur.pos, to: cur.pos, insert: word },
    selection: { anchor: nextPos },
    effects: setGhostEffect.of(remaining.length > 0 ? { text: remaining, pos: nextPos } : null),
    scrollIntoView: true,
  });
  return true;
}

/** Descarta a sugestão de ghost text atual */
export function clearGhostText(view: EditorView): boolean {
  const fieldVal = view.state.field(ghostTextField, false);
  if (fieldVal?.suggestion) {
    view.dispatch({ effects: setGhostEffect.of(null) });
    return true;
  }
  return false;
}

export const ghostTextKeymap = Prec.highest(
  keymap.of([
    {
      key: "Tab",
      run: (view) => acceptGhostText(view),
    },
    {
      key: "Escape",
      run: (view) => clearGhostText(view),
    },
    {
      key: "Alt-ArrowRight",
      run: (view) => acceptGhostWord(view),
    },
    {
      key: "Ctrl-ArrowRight",
      run: (view) => acceptGhostWord(view),
    },
  ])
);

// ---------- gerenciador do assistente (ViewPlugin com debounce) ----------

export interface GhostOptions {
  getEnabled: () => boolean;
}

export function createGhostTextExtension(options: GhostOptions): Extension {
  const docIndex = new DocumentIndex();
  let debounceTimer: number | null = null;
  let indexTimer: number | null = null;

  const plugin = ViewPlugin.fromClass(
    class {
      constructor(readonly view: EditorView) {
        docIndex.update(view.state.doc.toString());
      }

      update(update: ViewUpdate): void {
        if (!options.getEnabled()) {
          return;
        }

        // Se o documento mudou, agenda re-indexação do documento (800ms debounce)
        if (update.docChanged) {
          if (indexTimer) window.clearTimeout(indexTimer);
          indexTimer = window.setTimeout(() => {
            docIndex.update(update.view.state.doc.toString());
          }, 800);
        }

        // Se a seleção não estiver vazia, não agenda predição
        const sel = update.view.state.selection.main;
        if (!sel.empty) {
          return;
        }

        // Se o documento mudou ou a seleção mudou, agenda cálculo com debounce rápido (90ms)
        if (update.docChanged || update.selectionSet) {
          if (debounceTimer) window.clearTimeout(debounceTimer);
          debounceTimer = window.setTimeout(() => {
            if (!options.getEnabled()) return;
            const head = update.view.state.selection.main.head;
            const pred = predictCompletion(update.view.state.doc, head, docIndex);
            update.view.dispatch({
              effects: setGhostEffect.of(pred),
            });
          }, 90);
        }
      }

      destroy(): void {
        if (debounceTimer) window.clearTimeout(debounceTimer);
        if (indexTimer) window.clearTimeout(indexTimer);
      }
    }
  );

  return [ghostTextField, ghostTextKeymap, plugin];
}
