// Pequenos utilitários compartilhados pelo app.

export function $<T extends HTMLElement = HTMLElement>(sel: string, root: ParentNode = document): T {
  const found = root.querySelector(sel);
  if (!found) throw new Error(`Elemento não encontrado: ${sel}`);
  return found as T;
}

export function $$<T extends HTMLElement = HTMLElement>(sel: string, root: ParentNode = document): T[] {
  return Array.from(root.querySelectorAll(sel)) as T[];
}

/** Cria um elemento com atributos/props de forma concisa. */
export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Record<string, unknown> = {},
  children: (Node | string)[] = []
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === null || v === undefined || v === false) continue;
    if (k === "class") node.className = String(v);
    else if (k === "html") node.innerHTML = String(v);
    else if (k === "text") node.textContent = String(v);
    else if (k.startsWith("on") && typeof v === "function") {
      node.addEventListener(k.slice(2).toLowerCase(), v as EventListener);
    } else if (v === true) node.setAttribute(k, "");
    else node.setAttribute(k, String(v));
  }
  for (const c of children) node.append(c);
  return node;
}

export function debounce<A extends unknown[]>(fn: (...args: A) => void, ms: number): (...args: A) => void {
  let t: number | undefined;
  return (...args: A) => {
    if (t !== undefined) window.clearTimeout(t);
    t = window.setTimeout(() => fn(...args), ms);
  };
}

export const uid = (): string => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

export const clamp = (n: number, min: number, max: number): number => Math.max(min, Math.min(max, n));

export function fmtTime(d: Date = new Date()): string {
  return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

/** "Há quanto tempo", em forma curta, para listas (Recentes e rascunhos). */
export function fmtAgo(at: number): string {
  if (!Number.isFinite(at) || at <= 0) return "";
  const s = Math.round((Date.now() - at) / 1000);
  if (s < 60) return "agora";
  const m = Math.floor(s / 60);
  if (m < 60) return `há ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `há ${h} h`;
  const d = Math.floor(h / 24);
  return d === 1 ? "ontem" : `há ${d} dias`;
}

export function toast(msg: string, kind: "info" | "ok" | "err" = "info", ms = 3600): void {
  const root = document.getElementById("toasts");
  if (!root) return;
  const t = h("div", { class: `toast ${kind}`, text: msg });
  root.append(t);
  requestAnimationFrame(() => t.classList.add("show"));
  window.setTimeout(() => {
    t.classList.remove("show");
    window.setTimeout(() => t.remove(), 250);
  }, ms);
}

// ---------- caminhos (Windows-friendly) ----------

export function baseName(p: string): string {
  const i = Math.max(p.lastIndexOf("/"), p.lastIndexOf("\\"));
  return i >= 0 ? p.slice(i + 1) : p;
}

export function docDirOf(p: string): string {
  const i = Math.max(p.lastIndexOf("/"), p.lastIndexOf("\\"));
  return i > 0 ? p.slice(0, i) : "";
}

export function joinPath(dir: string, rel: string): string {
  return dir.replace(/[\\/]+$/, "") + "\\" + rel.replace(/\//g, "\\");
}

export function stripExt(name: string): string {
  return name.replace(/\.[^./\\]+$/, "");
}

export function extOf(name: string): string {
  const m = /\.([a-zA-Z0-9]+)$/.exec(name);
  return m ? m[1].toLowerCase() : "";
}

export function isImagePath(p: string): boolean {
  return /\.(png|jpe?g|gif|webp|svg|bmp|avif|ico)$/i.test(p);
}

export function isMarkdownPath(p: string): boolean {
  return /\.(md|markdown|mdx|txt)$/i.test(p);
}

export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => {
    const map: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
    return map[c];
  });
}

/** Nome de arquivo simples e seguro (sem acentos, espaços ou símbolos). */
export function slugify(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

// ---------- base64 / clipboard ----------

export function bytesToBase64(bytes: Uint8Array): string {
  let bin = "";
  const chunk = 0x4000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(bin);
}

export function toBase64Utf8(s: string): string {
  return bytesToBase64(new TextEncoder().encode(s));
}

export async function blobToBase64(b: Blob): Promise<string> {
  return bytesToBase64(new Uint8Array(await b.arrayBuffer()));
}

export function dataUrlPayload(dataUrl: string): { mime: string; b64: string } | null {
  const m = /^data:([^;,]+);base64,(.*)$/s.exec(dataUrl);
  if (!m) return null;
  return { mime: m[1], b64: m[2] };
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.append(ta);
      ta.select();
      const ok = document.execCommand("copy");
      ta.remove();
      return ok;
    } catch {
      return false;
    }
  }
}

// ---------- arrastar pop-up ----------

/**
 * Deixa um pop-up arrastável pela barra de título.
 *
 * O modal continua centralizado pelo `.modal-backdrop` (flex); o arrasto é só um
 * `translate`, então o layout não muda e o pop-up volta ao centro com duplo clique na
 * barra. O movimento fica limitado à janela (não dá para jogar o pop-up para fora e
 * perder os botões).
 */
export function tornarArrastavel(modal: HTMLElement, seletorAlca = ".wm-head"): void {
  const alca = modal.querySelector<HTMLElement>(seletorAlca);
  if (!alca) return;
  alca.classList.add("arrastavel");
  let deslocX = 0;
  let deslocY = 0;
  let inicio: { x: number; y: number; dx: number; dy: number; base: { left: number; top: number; width: number; height: number } } | null = null;

  const aplicar = () => {
    modal.style.transform = deslocX || deslocY ? `translate(${deslocX}px, ${deslocY}px)` : "";
  };
  const soltar = (e: PointerEvent) => {
    if (!inicio) return;
    inicio = null;
    modal.classList.remove("arrastando");
    try {
      if (alca.hasPointerCapture(e.pointerId)) alca.releasePointerCapture(e.pointerId);
    } catch {
      /* sem captura */
    }
  };

  alca.addEventListener("pointerdown", (e) => {
    if (e.button !== 0) return;
    // botões e campos na barra continuam clicáveis
    if ((e.target as HTMLElement).closest("button, a, input, select, textarea")) return;
    e.preventDefault();
    const r = modal.getBoundingClientRect();
    inicio = {
      x: e.clientX,
      y: e.clientY,
      dx: deslocX,
      dy: deslocY,
      base: { left: r.left - deslocX, top: r.top - deslocY, width: r.width, height: r.height },
    };
    modal.classList.add("arrastando");
    try {
      alca.setPointerCapture(e.pointerId);
    } catch {
      /* ponteiro sintético (teste) não tem captura */
    }
  });

  alca.addEventListener("pointermove", (e) => {
    if (!inicio) return;
    const margem = 8;
    const { base } = inicio;
    const limitar = (v: number, min: number, max: number) => (max < min ? (min + max) / 2 : Math.min(max, Math.max(min, v)));
    deslocX = limitar(inicio.dx + (e.clientX - inicio.x), margem - base.left, window.innerWidth - margem - (base.left + base.width));
    deslocY = limitar(inicio.dy + (e.clientY - inicio.y), margem - base.top, window.innerHeight - margem - (base.top + base.height));
    aplicar();
  });

  alca.addEventListener("pointerup", soltar);
  alca.addEventListener("pointercancel", soltar);
  alca.addEventListener("dblclick", (e) => {
    if ((e.target as HTMLElement).closest("button, a, input, select, textarea")) return;
    deslocX = 0;
    deslocY = 0;
    aplicar();
  });
}

// ---------- localStorage ----------

export function loadJSON<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function saveJSON(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* ignora */
  }
}
