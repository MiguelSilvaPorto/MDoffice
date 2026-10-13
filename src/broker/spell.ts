// Cliente do dicionário (worker): carrega em segundo plano e responde as palavras erradas.

import { aoAprender, correcoesConfiadas } from "./aprendizado";

export interface SpellHit {
  word: string;
  suggestions: string[];
  glued?: boolean;
  /** correção em que dá para confiar (aplicada sozinha pela correção automática) */
  best?: string;
  /**
   * Colagem DEDUZIDA: o dicionário aceita a palavra, mas a família dela não aparece em
   * texto escrito ("oira" é forma do verbo "oirar"). É pergunta, não certeza — por isso
   * não vem com `best`, e a correção fica só como disponível.
   */
  duvida?: boolean;
}

let spellWorker: Worker | null = null;
let spellReady = false;
let spellFailed = false;
let spellId = 1;
const spellPending = new Map<number, (hits: SpellHit[]) => void>();

/** Começa a carregar o dicionário em segundo plano (não trava a interface). */
export function warmUpSpell(): void {
  ensureSpellWorker();
}

export function spellIsReady(): boolean {
  return spellReady;
}

export function spellHasFailed(): boolean {
  return spellFailed;
}

const spellReadyCallbacks: (() => void)[] = [];

/** Chama o callback quando o dicionário terminar de carregar. */
export function onSpellReady(cb: () => void): void {
  if (spellReady) {
    cb();
    return;
  }
  spellReadyCallbacks.push(cb);
}

function ensureSpellWorker(): Worker | null {
  if (spellWorker || spellFailed) return spellWorker;
  try {
    spellWorker = new Worker(new URL("./spell.worker.ts", import.meta.url), { type: "module" });
  } catch (err) {
    spellFailed = true;
    console.warn("Corretor indisponível:", err);
    return null;
  }
  spellWorker.addEventListener("message", (event: MessageEvent) => {
    const data = event.data as { type: string; id?: number; hits?: SpellHit[]; error?: string };
    if (data.type === "ready") {
      spellReady = true;
      enviarAprendizado();
      for (const cb of spellReadyCallbacks.splice(0)) cb();
      return;
    }
    if (data.type === "failed") {
      spellFailed = true;
      console.warn("Dicionário pt-BR indisponível:", data.error);
      for (const resolve of spellPending.values()) resolve([]);
      spellPending.clear();
      return;
    }
    if (data.type === "result" && data.id !== undefined) {
      const resolve = spellPending.get(data.id);
      spellPending.delete(data.id);
      resolve?.(data.hits ?? []);
    }
  });
  spellWorker.postMessage({ type: "init", base: document.baseURI });
  return spellWorker;
}

/** Manda para o worker as trocas já aprendidas (ele não lê localStorage). */
function enviarAprendizado(): void {
  if (!spellWorker || !spellReady) return;
  spellWorker.postMessage({ type: "aprender", correcoes: correcoesConfiadas() });
}

// Sempre que uma correção nova é aceita, o corretor passa a conhecê-la.
aoAprender(enviarAprendizado);

/** Aguarda o dicionário ficar pronto (espera curta: o resto roda em segundo plano). */async function waitForSpell(timeoutMs = 3000): Promise<boolean> {
  if (spellReady) return true;
  if (spellFailed) return false;
  const started = Date.now();
  while (!spellReady && !spellFailed && Date.now() - started < timeoutMs) {
    await new Promise((r) => window.setTimeout(r, 200));
  }
  return spellReady;
}

export async function checkWords(words: string[]): Promise<Map<string, SpellHit>> {
  const worker = ensureSpellWorker();
  if (!worker || spellFailed || !words.length) return new Map();
  if (!(await waitForSpell())) return new Map();
  const hits = await new Promise<SpellHit[]>((resolve) => {
    const id = spellId++;
    spellPending.set(id, resolve);
    worker.postMessage({ type: "check", id, words });
  });
  return new Map(hits.map((h) => [h.word, h]));
}
