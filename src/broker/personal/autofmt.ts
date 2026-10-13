// Ritmo da correção automática: aprende, com o uso, o momento certo de agir.
// Não é IA nem modelo: é uma média móvel. Correção desfeita logo depois (Ctrl+Z) = recusa →
// espera mais antes de agir; correção que fica até a próxima pausa = aceite → pode agir mais cedo.
// Tudo local (localStorage); pode ser zerado em Configurações.

const KEY = "mdc.autofmt.ritmo";
/** pausa inicial, em ms */
const BASE = 3500;
const MIN = 1500;
const MAX = 8000;

interface Estado {
  /** confiança 0..1 (0,5 = neutro) */
  conf: number;
  /** decisões observadas */
  n: number;
  /** última varredura aplicada, ainda sem veredito */
  pendente: { antes: string } | null;
}

function fresh(): Estado {
  return { conf: 0.5, n: 0, pendente: null };
}

let st: Estado = load();

function load(): Estado {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? { ...fresh(), ...(JSON.parse(raw) as Estado) } : fresh();
  } catch {
    return fresh();
  }
}

function save(): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(st));
  } catch {
    /* sem armazenamento: continua só em memória */
  }
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/** Ajusta a confiança (recusar pesa mais que aceitar, como no aprendizado das sugestões). */
function ajustar(d: number): void {
  st.conf = clamp(st.conf + d, 0, 1);
  st.n++;
  save();
}

/** Pausa (ms) que a varredura espera antes de agir, conforme o uso. */
export function ritmoDePausa(): number {
  const f = clamp(1.6 - 1.2 * st.conf, 0.55, 1.9);
  return Math.round(clamp(BASE * f, MIN, MAX));
}

/** Anota uma varredura aplicada; o veredito vem no próximo evento (desfeita ou mantida). */
export function marcarAplicacao(antes: string): void {
  if (st.pendente) ajustar(0.05); // ficou de pé até a próxima pausa: valeu
  st.pendente = { antes };
  save();
}

/** O texto mudou: se voltou exatamente ao que era antes da varredura, ela foi desfeita. */
export function observarEdicao(texto: string): void {
  if (!st.pendente) return;
  if (texto !== st.pendente.antes) return;
  ajustar(-0.12);
  st.pendente = null;
  save();
}

/** Há veredito pendente? (evita comparar o texto à toa a cada tecla) */
export function temPendenteRitmo(): boolean {
  return st.pendente !== null;
}

/** Zera o aprendizado (Configurações). */
export function limparRitmo(): void {
  st = fresh();
  save();
}

/** Resumo do ritmo (Configurações e testes). */
export function resumoRitmo(): { pausa: number; decisoes: number; confianca: number } {
  return { pausa: ritmoDePausa(), decisoes: st.n, confianca: st.conf };
}
