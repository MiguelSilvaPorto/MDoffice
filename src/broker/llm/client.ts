// Cliente da IA local: cria o worker só quando precisa, fala com ele e o encerra depois de um tempo parado
// (isso devolve a memória do computador). Se o modelo não estiver no app, tudo continua funcionando sem a IA.
import { LIBERAR_APOS_MS, MODELO_DIR, MODELO_DTYPE, llmEnabled, llmUseGpu } from "./config";

let worker: Worker | null = null;
let seq = 0;
let releaseTimer: number | undefined;
let present: Promise<boolean> | null = null;
const pending = new Map<number, { ok: (m: Record<string, unknown>) => void; fail: (e: Error) => void }>();
/** onde o modelo está rodando agora ("webgpu" ou "wasm"), para mostrar nas Configurações */
let lastDevice = "";

/** O modelo está no app? (Numa cópia sem o download, não está.) */
export function llmAvailable(): Promise<boolean> {
  present ??= fetch(`/modelos/${MODELO_DIR}/onnx/model_${MODELO_DTYPE}.onnx`, { method: "HEAD" })
    .then((r) => r.ok && !(r.headers.get("content-type") ?? "").includes("text/html"))
    .catch(() => false);
  return present;
}

let lastTiming = { forward: 0, after: 0, tokens: 0, calls: 0 };
export const llmDevice = (): string => lastDevice;
/** tempo acumulado no modelo e no pós-processamento (diagnóstico) */
export const llmTiming = (): typeof lastTiming => lastTiming;

function ensure(): Worker {
  if (worker) return worker;
  const w = new Worker(new URL("./llm.worker.ts", import.meta.url), { type: "module" });
  w.onmessage = (e: MessageEvent) => {
    const m = e.data as { id: number; type: string; message?: string; device?: string; timing?: typeof lastTiming };
    if (m.device) lastDevice = m.device;
    if (m.timing) lastTiming = m.timing;
    const p = pending.get(m.id);
    if (!p) return;
    pending.delete(m.id);
    if (m.type === "error") p.fail(new Error(m.message));
    else p.ok(m as unknown as Record<string, unknown>);
  };
  w.onerror = (e) => {
    for (const p of pending.values()) p.fail(new Error(e.message));
    pending.clear();
    release();
  };
  worker = w;
  return w;
}

/** Encerra o worker e libera a memória do modelo. */
export function release(): void {
  window.clearTimeout(releaseTimer);
  worker?.terminate();
  worker = null;
  for (const p of pending.values()) p.fail(new Error("IA local encerrada"));
  pending.clear();
}

function call(type: string, extra: Record<string, unknown> = {}): Promise<Record<string, unknown>> {
  window.clearTimeout(releaseTimer);
  const id = ++seq;
  const w = ensure();
  return new Promise<Record<string, unknown>>((ok, fail) => {
    pending.set(id, { ok, fail });
    w.postMessage({ type, id, dir: MODELO_DIR, dtype: MODELO_DTYPE, gpu: llmUseGpu(), ...extra });
  }).finally(() => {
    // parado por um tempo: devolve a memória
    window.clearTimeout(releaseTimer);
    releaseTimer = window.setTimeout(release, LIBERAR_APOS_MS);
  });
}

/** Sem WebGPU (ou com a GPU desligada) não adianta tentar de novo a cada chamada: lembra até a configuração mudar. */
let blockedFor: boolean | null = null;
export const llmBlocked = (): boolean => blockedFor !== null && blockedFor === llmUseGpu();

/** Pontuação (log-probabilidade) de cada frase: maior = mais natural. Devolve null se a IA não estiver disponível. */
export async function scoreSentences(texts: string[]): Promise<number[] | null> {
  if (!llmEnabled() || llmBlocked() || !(await llmAvailable())) return null;
  try {
    const r = await call("score", { texts });
    return r.scores as number[];
  } catch (e) {
    if (/WebGPU|GPU desligada/.test(String(e))) blockedFor = llmUseGpu();
    else console.warn("IA local falhou:", e);
    return null;
  }
}
