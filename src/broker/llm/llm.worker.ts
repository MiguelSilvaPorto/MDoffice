// IA local (modelo de linguagem pequeno) rodando num worker: é a ÚNICA thread de cálculo (1 thread no motor).
// Só calcula quando a página manda, uma tarefa por vez, e a página pode encerrar o worker para liberar a memória.
// Usa a GPU (WebGPU) quando existe e a pessoa deixa; senão, CPU. Nada sai do computador (o modelo vem do próprio app).
import { AutoTokenizer, AutoModelForCausalLM, Tensor, env } from "@huggingface/transformers";

env.allowRemoteModels = false;
env.allowLocalModels = true;
env.localModelPath = "/modelos/";
env.useBrowserCache = false;
const wasm = env.backends.onnx.wasm;
if (wasm) {
  wasm.wasmPaths = "/ort/";
  wasm.numThreads = 1; // nunca mais de uma thread de cálculo
}

type Tok = Awaited<ReturnType<typeof AutoTokenizer.from_pretrained>>;
type Model = Awaited<ReturnType<typeof AutoModelForCausalLM.from_pretrained>>;
let tok: Tok | null = null;
let model: Model | null = null;
let loading: Promise<void> | null = null;
let device = "wasm";

async function hasWebGpu(): Promise<boolean> {
  const gpu = (navigator as unknown as { gpu?: { requestAdapter: () => Promise<unknown> } }).gpu;
  if (!gpu) return false;
  return !!(await gpu.requestAdapter().catch(() => null));
}

async function load(dir: string, dtype: string, gpu: boolean): Promise<void> {
  if (model) return;
  loading ??= (async () => {
    // a IA local só roda na GPU (WebGPU): o motor de CPU do navegador não tem o operador dos modelos em 4 bits
    if (!gpu) throw new Error("GPU desligada nas configurações");
    if (!(await hasWebGpu())) throw new Error("este computador não tem WebGPU");
    tok = await AutoTokenizer.from_pretrained(dir);
    model = await AutoModelForCausalLM.from_pretrained(dir, { dtype: dtype as "q4f16", device: "webgpu" });
    device = "webgpu";
  })();
  try {
    await loading;
  } catch (e) {
    loading = null;
    throw e;
  }
}

/** tempo gasto no modelo e no pós-processamento (para diagnóstico) */
const timing = { forward: 0, after: 0, tokens: 0, calls: 0 };

/** Limites de um lote: o resultado do modelo tem (frases × tokens × 262 mil) números, então não pode crescer sem fim. */
const LOTE_MAX_FRASES = 8;
const LOTE_MAX_TOKENS = 240;

/**
 * Pontua várias frases juntas. Cada chamada ao modelo custa ~150 ms fixos (despacho para a GPU), então juntar frases
 * num lote gasta bem menos CPU do que uma chamada por frase. Frases curtas e longas ficam em lotes separados (padding à direita:
 * como o modelo só olha para trás, o preenchimento não muda a nota das frases).
 */
async function score(texts: string[]): Promise<number[]> {
  const encs = texts.map((t) => Array.from(tok!(t).input_ids.data as BigInt64Array, Number));
  const out = new Array<number>(texts.length).fill(0);
  const ordem = texts.map((_, i) => i).sort((x, y) => encs[x].length - encs[y].length);
  const pad = BigInt((tok as unknown as { pad_token_id?: number }).pad_token_id ?? 0);
  for (let i = 0; i < ordem.length; ) {
    // monta o lote: até LOTE_MAX_FRASES, com (frases × tamanho da maior) <= LOTE_MAX_TOKENS
    const lote: number[] = [];
    let maior = 0;
    while (i < ordem.length && lote.length < LOTE_MAX_FRASES) {
      const len = encs[ordem[i]].length;
      if (lote.length && Math.max(maior, len) * (lote.length + 1) > LOTE_MAX_TOKENS) break;
      lote.push(ordem[i++]);
      maior = Math.max(maior, len);
    }
    const B = lote.length;
    const T = maior;
    const ids = new BigInt64Array(B * T).fill(pad);
    const mask = new BigInt64Array(B * T);
    lote.forEach((k, r) => {
      encs[k].forEach((id, c) => {
        ids[r * T + c] = BigInt(id);
        mask[r * T + c] = 1n;
      });
    });
    const t0 = performance.now();
    const res = await model!({ input_ids: new Tensor("int64", ids, [B, T]), attention_mask: new Tensor("int64", mask, [B, T]) });
    const t1 = performance.now();
    const V = res.logits.dims[2];
    const L = res.logits.data as Float32Array;
    lote.forEach((k, r) => {
      const toks = encs[k];
      let sum = 0;
      for (let t = 0; t + 1 < toks.length; t++) {
        const off = (r * T + t) * V;
        let mx = -Infinity;
        for (let v = 0; v < V; v++) if (L[off + v] > mx) mx = L[off + v];
        // soma só os termos que pesam (a até 18 do máximo): o resto soma menos que 0,5% e custaria 262 mil exp por token
        const corte = mx - 18;
        let z = 0;
        for (let v = 0; v < V; v++) {
          const x = L[off + v];
          if (x > corte) z += Math.exp(x - mx);
        }
        sum += L[off + toks[t + 1]] - mx - Math.log(z);
      }
      out[k] = sum;
      timing.tokens += toks.length;
    });
    timing.forward += t1 - t0;
    timing.after += performance.now() - t1;
    timing.calls++;
  }
  return out;
}

// uma tarefa por vez: o motor não é reentrante
let queue: Promise<void> = Promise.resolve();
self.onmessage = (e: MessageEvent) => {
  queue = queue.then(() => handle(e));
};

async function handle(e: MessageEvent): Promise<void> {
  const msg = e.data as { type: string; id: number; dir: string; dtype: string; gpu?: boolean; texts?: string[] };
  try {
    await load(msg.dir, msg.dtype, !!msg.gpu);
    if (msg.type === "load") self.postMessage({ type: "ready", id: msg.id, device });
    else if (msg.type === "score") self.postMessage({ type: "scores", id: msg.id, scores: await score(msg.texts ?? []), device, timing });
  } catch (err) {
    self.postMessage({ type: "error", id: msg.id, message: String(err) });
  }
}
