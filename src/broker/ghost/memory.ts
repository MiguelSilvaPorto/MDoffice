// Memória pessoal da sugestão: aprende com os textos que a pessoa escreveu nos outros documentos.
// Guarda no próprio computador (localStorage) o começo dos últimos documentos e reconstrói um índice com eles.
// Nada sai do aparelho. Quem escreve sempre sobre os mesmos assuntos recebe sugestões cada vez mais certeiras.

import { DocumentIndex } from "./documentIndex";
import { learnDocument, forgetProfile } from "../personal/profile";

const KEY = "mdc.ghost.memory";
const MAX_DOCS = 24;
const MAX_CHARS = 40000;
const MIN_CHARS = 200;

interface Entry {
  t: string;
  at: number;
}

let store: Record<string, Entry> = load();
let timer: number | undefined;

/** Índice com tudo que foi lembrado (usado como segunda fonte pelo preditor). */
export const personalIndex = new DocumentIndex();
personalIndex.update(joined());

function load(): Record<string, Entry> {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Record<string, Entry>) : {};
  } catch {
    return {};
  }
}

function joined(): string {
  return Object.values(store)
    .map((e) => e.t)
    .join("\n\n");
}

function schedule(): void {
  window.clearTimeout(timer);
  timer = window.setTimeout(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(store));
    } catch {
      /* sem espaço: segue só em memória */
    }
    personalIndex.update(joined());
  }, 2500);
}

/** Lembra (ou atualiza) o texto de um documento. Chame ao salvar, trocar de aba ou fechar. */
export function rememberDocument(id: string, text: string): void {
  if (text.trim().length < MIN_CHARS) return;
  const prev = store[id];
  const cut = text.slice(0, MAX_CHARS);
  if (prev && prev.t === cut) return;
  store[id] = { t: cut, at: Date.now() };
  learnDocument(id, text); // o perfil de estilo aprende junto
  const ids = Object.keys(store);
  if (ids.length > MAX_DOCS) {
    ids.sort((a, b) => store[a].at - store[b].at);
    for (const old of ids.slice(0, ids.length - MAX_DOCS)) delete store[old];
  }
  schedule();
}

/** Esquece um documento (ex.: foi excluído). */
export function forgetDocument(id: string): void {
  if (!store[id]) return;
  delete store[id];
  schedule();
}

/** Apaga toda a memória pessoal. */
export function clearGhostMemory(): void {
  store = {};
  forgetProfile();
  schedule();
}
