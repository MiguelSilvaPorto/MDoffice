// Motor offline: modelo de tradução rodando no PC, em segundo plano (translate.worker.ts).

import type { Provider } from "./providers";

export interface OfflineStatus {
  state: "idle" | "loading" | "ready" | "error";
  /** 0–100 enquanto baixa o modelo. */
  progress: number;
  message: string;
}

const OFFLINE_KEY = "mdc.tr-offline-ready";

export class OfflineEngine {
  private worker: Worker | null = null;
  private nextId = 1;
  private waiting = new Map<number, { ok: (v: string[]) => void; fail: (e: Error) => void }>();
  private files = new Map<string, number>();
  status: OfflineStatus = { state: "idle", progress: 0, message: "" };
  onStatus: ((s: OfflineStatus) => void) | null = null;

  /** O modelo já foi baixado neste computador alguma vez? */
  get downloaded(): boolean {
    try {
      return localStorage.getItem(OFFLINE_KEY) === "1";
    } catch {
      return false;
    }
  }

  private set(s: Partial<OfflineStatus>): void {
    this.status = { ...this.status, ...s };
    this.onStatus?.(this.status);
  }

  private ensure(): Worker {
    if (this.worker) return this.worker;
    const w = new Worker(new URL("./translate.worker.ts", import.meta.url), { type: "module" });
    w.onmessage = (e: MessageEvent) => {
      const m = e.data as { type: string; id?: number; out?: string[]; message?: string; p?: { status?: string; file?: string; progress?: number } };
      if (m.type === "progress" && m.p) {
        if (this.status.state === "error") return;
        if (m.p.status === "progress" && m.p.file) {
          this.files.set(m.p.file, m.p.progress ?? 0);
          const vals = [...this.files.values()];
          const pct = vals.reduce((a, b) => a + b, 0) / Math.max(1, vals.length);
          this.set({ state: "loading", progress: Math.round(pct), message: `Baixando o modelo de tradução… ${Math.round(pct)}%` });
        } else if (m.p.status === "ready" || m.p.status === "done") {
          this.set({ state: "loading", message: "Preparando o modelo…" });
        }
      } else if (m.type === "ready") {
        try {
          localStorage.setItem(OFFLINE_KEY, "1");
        } catch {
          /* ignora */
        }
        this.set({ state: "ready", progress: 100, message: "Modelo offline pronto." });
      } else if (m.type === "result" && m.id !== undefined) {
        this.waiting.get(m.id)?.ok(m.out ?? []);
        this.waiting.delete(m.id);
      } else if (m.type === "error") {
        const err = new Error(m.message ?? "Falha no tradutor offline.");
        this.set({ state: "error", message: `Tradutor offline falhou: ${m.message ?? ""}` });
        if (m.id !== undefined) {
          this.waiting.get(m.id)?.fail(err);
          this.waiting.delete(m.id);
        } else for (const w of this.waiting.values()) w.fail(err);
      }
    };
    w.onerror = (ev) => {
      this.set({ state: "error", message: `Tradutor offline falhou: ${ev.message}` });
    };
    this.worker = w;
    return w;
  }

  /** Começa a baixar/carregar o modelo (pode demorar na primeira vez). */
  warmUp(): void {
    if (this.status.state === "loading" || this.status.state === "ready") return;
    this.set({ state: "loading", progress: 0, message: "Preparando o tradutor offline…" });
    this.ensure().postMessage({ type: "load" });
  }

  provider(): Provider {
    return {
      id: "offline",
      label: "Offline (no seu PC)",
      translate: (texts, signal) => {
        if (this.status.state !== "ready") this.warmUp();
        const id = this.nextId++;
        return new Promise<string[]>((ok, fail) => {
          this.waiting.set(id, { ok, fail });
          signal.addEventListener("abort", () => {
            this.waiting.delete(id);
            fail(new DOMException("cancelado", "AbortError"));
          });
          this.ensure().postMessage({ type: "translate", id, texts });
        });
      },
    };
  }
}
