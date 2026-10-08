// Tradução offline (PT → EN) rodando no PC, em segundo plano, sem travar a digitação.
// O modelo (≈120 MB) é baixado uma única vez e fica guardado pelo navegador.
import { pipeline, env } from "@huggingface/transformers";

env.allowLocalModels = false;
env.useBrowserCache = true;
// os arquivos do motor ficam locais (public/ort) para funcionar sem internet
const wasm = env.backends.onnx.wasm;
if (wasm) {
  wasm.wasmPaths = "/ort/";
  wasm.numThreads = 1;
}

const MODEL = "Xenova/opus-mt-ROMANCE-en";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let translator: any = null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let loading: Promise<any> | null = null;

function load() {
  if (translator) return Promise.resolve(translator);
  if (!loading) {
    loading = pipeline("translation", MODEL, {
      dtype: "q8",
      progress_callback: (p: unknown) => self.postMessage({ type: "progress", p }),
    }).then((t) => {
      translator = t;
      self.postMessage({ type: "ready" });
      return t;
    });
    loading.catch(() => {
      loading = null;
    });
  }
  return loading;
}

// uma tarefa por vez: o motor não é reentrante
let queue: Promise<void> = Promise.resolve();
self.onmessage = (e: MessageEvent) => {
  queue = queue.then(() => handle(e));
};

async function handle(e: MessageEvent): Promise<void> {
  const msg = e.data as { type: string; id?: number; texts?: string[] };
  try {
    if (msg.type === "load") {
      await load();
    } else if (msg.type === "translate") {
      const t = await load();
      const out: string[] = [];
      // um texto por vez: frases longas não competem por memória
      for (const text of msg.texts ?? []) {
        const r = await t(text, { max_new_tokens: 512, num_beams: 2 });
        out.push(String(Array.isArray(r) ? r[0].translation_text : r.translation_text));
      }
      self.postMessage({ type: "result", id: msg.id, out });
    }
  } catch (err) {
    self.postMessage({ type: "error", id: msg.id, message: String(err) });
  }
}
