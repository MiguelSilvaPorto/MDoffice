// Aprendizado pelo uso: cada vez que a pessoa aceita (Tab), descarta (Esc) ou ignora uma sugestão, o sistema anota.
//  - palavras aceitas depois de certo contexto sobem na lista; as recusadas descem;
//  - se a pessoa aceita pouco, a sugestão fica mais exigente (aparece menos e mais certeira); se aceita muito, relaxa.
// Tudo fica só neste computador (localStorage) e pode ser apagado em Configurações.

export interface Outcome {
  /** palavra que veio antes (minúscula) ou "<s>" no começo da frase */
  prev: string;
  /** a palavra sugerida (minúscula, inteira) */
  word: string;
  /** "next" = próxima palavra; "prefix" = completar a que está sendo digitada */
  mode: "next" | "prefix";
}

interface State {
  /** "anterior palavra" -> pontuação (aceitou = +, recusou = −) */
  c: Record<string, number>;
  /** palavra -> pontuação geral */
  w: Record<string, number>;
  /** taxa de aceitação recente (média móvel) de cada modo */
  accNext: number;
  accPrefix: number;
  /** quantas decisões já foram observadas */
  n: number;
}

const KEY = "mdc.ghost.feedback";
const MAX_ENTRIES = 6000;

let st: State = load();
let timer: number | undefined;

function fresh(): State {
  return { c: {}, w: {}, accNext: 0.5, accPrefix: 0.5, n: 0 };
}

function load(): State {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? { ...fresh(), ...(JSON.parse(raw) as State) } : fresh();
  } catch {
    return fresh();
  }
}

function save(): void {
  if (typeof window === "undefined") return;
  window.clearTimeout(timer);
  timer = window.setTimeout(() => {
    try {
      // guarda só o que importa: descarta as pontuações perto de zero quando passa do limite
      const total = Object.keys(st.c).length + Object.keys(st.w).length;
      if (total > MAX_ENTRIES) {
        for (const m of [st.c, st.w]) for (const k of Object.keys(m)) if (Math.abs(m[k]) < 0.5) delete m[k];
      }
      localStorage.setItem(KEY, JSON.stringify(st));
    } catch {
      /* sem espaço: continua só em memória */
    }
  }, 1500);
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

function bump(m: Record<string, number>, k: string, d: number): void {
  m[k] = clamp((m[k] ?? 0) + d, -4, 6);
}

function observe(o: Outcome, accepted: boolean): void {
  const key = o.mode === "next" ? "accNext" : "accPrefix";
  st[key] = 0.96 * st[key] + 0.04 * (accepted ? 1 : 0);
  st.n++;
}

/** A pessoa aceitou a sugestão (Tab, ou Alt+Seta para a primeira palavra). */
/** Quantas sugestões foram aceitas desde que o app abriu (a revisão inteligente usa isso para se oferecer). */
let sessionAccepted = 0;
export function acceptedTotal(): number {
  return sessionAccepted;
}

export function accepted(o: Outcome): void {
  sessionAccepted++;
  bump(st.c, `${o.prev} ${o.word}`, 1);
  bump(st.w, o.word, 0.3);
  observe(o, true);
  save();
}

/** A pessoa descartou (Esc, `explicit`) ou digitou outra coisa no lugar. */
export function rejected(o: Outcome, explicit: boolean): void {
  bump(st.c, `${o.prev} ${o.word}`, explicit ? -0.8 : -0.4);
  bump(st.w, o.word, explicit ? -0.25 : -0.1);
  observe(o, false);
  save();
}

/** Multiplicador (0,35–1,3: recusar pesa mais que aceitar, para não inflar palavras comuns) para a chance de `word` depois de `prev`, segundo o histórico de uso. */
export function preference(prev: string, word: string): number {
  const s = (st.c[`${prev} ${word}`] ?? 0) + (st.w[word] ?? 0);
  if (!s) return 1;
  return clamp(Math.exp(0.3 * s), 0.35, 1.3);
}

export type GhostMode = "discreto" | "equilibrado" | "agressivo";
const MODE_KEY = "mdc.ghost.mode";
const MODE_SCALE: Record<GhostMode, number> = { discreto: 1.4, equilibrado: 1, agressivo: 0.75 };

/** Intensidade escolhida nas Configurações: discreto mostra menos e mais certeiro; agressivo mostra mais. */
export function getGhostMode(): GhostMode {
  try {
    const v = localStorage.getItem(MODE_KEY);
    if (v === "discreto" || v === "agressivo") return v;
  } catch {
    /* sem armazenamento */
  }
  return "equilibrado";
}

export function setGhostMode(m: GhostMode): void {
  try {
    localStorage.setItem(MODE_KEY, m);
  } catch {
    /* sem armazenamento */
  }
}

/** Fator para os limiares de confiança: >1 deixa a sugestão mais exigente; <1, mais solta. */
export function thresholdScale(mode: "next" | "prefix"): number {
  const base = MODE_SCALE[getGhostMode()];
  if (st.n < 30) return base; // pouca experiência ainda
  const acc = mode === "next" ? st.accNext : st.accPrefix;
  return base * clamp(1 + 0.8 * (0.4 - acc), 1, 1.3); // só aperta (aceita pouco → mostra menos e mais certeiro); nunca solta além do padrão
}

/** Resumo para mostrar nas Configurações. */
export function feedbackSummary(): { decisions: number; acceptNext: number; acceptPrefix: number } {
  return { decisions: st.n, acceptNext: st.accNext, acceptPrefix: st.accPrefix };
}

export function clearFeedback(): void {
  st = fresh();
  save();
}
