// Agendador de baixo consumo para trabalhos em segundo plano (a revisão profunda).
// Regras: no máximo UM trabalho por vez, tudo na MESMA thread da página (nada de threads extras), em fatias de poucos
// milissegundos, só quando o computador está ocioso, e o trabalho PARA se a pessoa digitar, a aba sumir ou o navegador
// precisar da vez. Mesmo rodando, ocupa no máximo uns 20% do tempo (pausa entre as fatias).
// (Se um dia entrar um modelo neural, ele deve usar a GPU como preferência e ceder a vez do mesmo jeito.)

const SLICE_MS = 6; // tempo máximo de uma fatia
const REST_MS = 24; // pausa entre fatias: ~20% de uso no máximo
const CALM_MS = 1800; // tempo sem mexer no teclado/mouse para o trabalho em segundo plano começar

let lastInput = typeof performance !== "undefined" ? performance.now() : 0;
let listening = false;
let current: { cancel: () => void } | null = null;

function listen(): void {
  if (listening || typeof window === "undefined") return;
  listening = true;
  const touch = () => (lastInput = performance.now());
  for (const ev of ["keydown", "pointerdown", "wheel", "touchstart"]) window.addEventListener(ev, touch, { capture: true, passive: true });
}

interface SchedulerInput {
  isInputPending?: () => boolean;
}

const idle = (cb: () => void): void => {
  const ric = (globalThis as unknown as { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => void }).requestIdleCallback;
  if (ric) ric(cb, { timeout: 1500 });
  else setTimeout(cb, REST_MS);
};

export interface Job<T> {
  promise: Promise<T | null>;
  cancel: () => void;
}

/**
 * Roda o gerador em fatias.
 * `background`: espera a pessoa ficar parada (CALM_MS) e pausa se ela voltar a digitar; sem isso (pedido explícito na tela),
 * roda em fatias mesmo assim para a página nunca travar.
 */
export function runSliced<T>(gen: Generator<void, T>, opts: { background?: boolean } = {}): Job<T> {
  listen();
  current?.cancel(); // só um trabalho por vez
  let cancelled = false;
  let resolveFn!: (v: T | null) => void;
  const promise = new Promise<T | null>((res) => (resolveFn = res));
  const finish = (v: T | null) => {
    if (current === job) current = null;
    resolveFn(v);
  };
  const step = () => {
    if (cancelled) return finish(null);
    const hidden = typeof document !== "undefined" && document.hidden;
    const busy = opts.background && performance.now() - lastInput < CALM_MS;
    if (hidden || busy) return void setTimeout(() => idle(step), opts.background ? 400 : REST_MS);
    const t0 = performance.now();
    const sched = (navigator as unknown as { scheduling?: SchedulerInput }).scheduling;
    for (;;) {
      const r = gen.next();
      if (r.done) return finish(r.value);
      // cede a vez: fatia acabou, ou o navegador avisa que há entrada da pessoa esperando
      if (performance.now() - t0 >= SLICE_MS || sched?.isInputPending?.()) break;
    }
    setTimeout(() => idle(step), REST_MS);
  };
  const job: Job<T> = {
    promise,
    cancel: () => {
      cancelled = true;
    },
  };
  current = job;
  idle(step);
  return job;
}
