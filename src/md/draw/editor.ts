// Editor de desenho EMBUTIDO (aparece no lugar da imagem, dentro do documento).

import { h, toast, dataUrlPayload } from "../../util";
import { type DrEl, type DrawDoc, type Tool, FONT_STACK } from "./model";
import { Board } from "./board";

export type DrawEditorResult =
  | { kind: "save"; pngBase64: string; json: string }
  | { kind: "cancel" }
  | { kind: "remove" };

export interface DrawEditorOptions {
  doc: DrawDoc;
  onDone: (result: DrawEditorResult) => void | Promise<void>;
}

export interface DrawEditorHandle {
  el: HTMLElement;
  focus(): void;
  dispose(): void;
}

export const SWATCHES = ["#1f2937", "#ef4444", "#f59e0b", "#10b981", "#3b82f6", "#8b5cf6", "#ec4899"];

export const TOOLS: { id: Tool; label: string; title: string }[] = [
  { id: "select", label: "⌖", title: "Selecionar / mover (V)" },
  { id: "pen", label: "✏", title: "Caneta — traços ficam retos, suaves ou em onda regular (P)" },
  { id: "line", label: "╱", title: "Linha reta (L)" },
  { id: "arrow", label: "↗", title: "Seta (A)" },
  { id: "rect", label: "▭", title: "Retângulo (R)" },
  { id: "ellipse", label: "◯", title: "Elipse (O)" },
  { id: "text", label: "T", title: "Caixa de texto (T) — Enter quebra linha, duplo clique edita" },
  { id: "eraser", label: "⌫", title: "Borracha (E)" },
];

export function assistPref(): boolean {
  try {
    return localStorage.getItem("mdc.assist") !== "0";
  } catch {
    return true;
  }
}

export function createDrawEditor(opts: DrawEditorOptions): DrawEditorHandle {
  const panel = h("div", { class: "draw-inline", tabindex: "-1" });
  const assist = assistPref();

  panel.innerHTML = `
    <div class="dr-toolbar">
      <div class="dr-group">
        ${TOOLS.map((t) => `<button class="tbtn dr-tool" data-tool="${t.id}" title="${t.title}">${t.label}</button>`).join("")}
      </div>
      <span class="tsep"></span>
      <div class="dr-group">
        ${SWATCHES.map((c) => `<button class="swatch" data-color="${c}" style="background:${c}" title="${c}"></button>`).join("")}
        <input type="color" class="color-input" value="#1f2937" title="Cor personalizada" />
      </div>
      <span class="tsep"></span>
      <div class="dr-group">
        <input type="range" class="dr-range" min="1" max="24" step="1" value="3" title="Espessura" />
        <span class="dr-w">3</span>
      </div>
      <div class="dr-group">
        <button class="tbtn dr-fill" title="Preencher formas">Preencher</button>
        <button class="tbtn dr-assist${assist ? " active" : ""}" title="Desenho assistido: alinha traços e formas automaticamente">✨ Assistido</button>
      </div>
      <span class="tsep"></span>
      <div class="dr-group">
        <button class="btn icon" data-act="undo" title="Desfazer (Ctrl+Z)"><svg class="ic"><use href="#i-undo"/></svg></button>
        <button class="btn icon" data-act="redo" title="Refazer (Ctrl+Y)"><svg class="ic"><use href="#i-redo"/></svg></button>
        <button class="btn icon" data-act="dup" title="Duplicar objeto (Ctrl+D)"><svg class="ic"><use href="#i-dup"/></svg></button>
        <button class="btn icon" data-act="del" title="Apagar objeto selecionado (Del)"><svg class="ic"><use href="#i-trash"/></svg></button>
      </div>
      <span class="dr-spacer"></span>
      <div class="dr-group">
        <button class="btn icon" data-act="zoom-out" title="Diminuir zoom (Ctrl + roda do mouse)">−</button>
        <button class="tbtn wide dr-zoom" data-act="zoom-reset" title="Voltar ao tamanho que cabe na tela">100%</button>
        <button class="btn icon" data-act="zoom-in" title="Aumentar zoom (Ctrl + roda do mouse)">+</button>
      </div>
      <span class="dr-spacer"></span>
      <div class="dr-group">
        <label class="dr-check"><input type="checkbox" class="dr-bg" checked /> Fundo branco</label>
        <button class="tbtn wide" data-act="clear" title="Apagar tudo para começar de novo">Limpar</button>
      </div>
    </div>
    <div class="draw-canvas-wrap"><div class="dr-sheet"><canvas class="dr-canvas" tabindex="0"></canvas></div></div>
    <div class="di-foot">
      <span class="muted">Assistido: endireita linhas, regulariza ondulações e liga as formas · Shift = exato</span>
      <span class="muted">Arraste para mover · <b>Alt+arrastar</b> copia · Ctrl+C/V copia e cola · setas ajustam</span>
      <span class="dr-spacer"></span>
      <button class="btn" data-act="remove" title="Remover este desenho do documento">Remover</button>
      <button class="btn" data-act="cancel">Cancelar</button>
      <button class="btn primary" data-act="done">Concluir</button>
    </div>`;

  const canvas = panel.querySelector<HTMLCanvasElement>(".dr-canvas")!;
  const wrap = panel.querySelector<HTMLElement>(".draw-canvas-wrap")!;
  const board = new Board(canvas, wrap, {
    w: opts.doc.w || 1600,
    h: opts.doc.h || 1000,
    fit: true,
    assist,
  });
  loadElements(board, opts.doc.elements ?? []);
  // gancho de depuração/teste (mesmo padrão do window.__mdoffice.app e do quadro de letras)
  (window as unknown as { __mdofficeDrawBoard?: Board }).__mdofficeDrawBoard = board;

  let busy = false;
  const finish = async (result: DrawEditorResult) => {
    if (busy) return;
    busy = true;
    panel.querySelectorAll<HTMLButtonElement>("button").forEach((b) => (b.disabled = true));
    try {
      await opts.onDone(result);
      board.dispose();
    } catch (error) {
      toast("Não foi possível salvar o desenho: " + error, "err");
      panel.querySelectorAll<HTMLButtonElement>("button").forEach((b) => (b.disabled = false));
    } finally {
      busy = false;
    }
  };

  // ---- ferramentas ----
  panel.querySelectorAll<HTMLElement>(".dr-tool").forEach((btn) => {
    btn.addEventListener("click", () => {
      board.setTool((btn.dataset.tool as Tool) ?? "pen");
      refresh();
    });
  });

  const colorInput = panel.querySelector<HTMLInputElement>(".color-input")!;
  const setColor = (c: string) => {
    board.setColor(c);
    colorInput.value = c;
    refresh();
  };
  panel.querySelectorAll<HTMLElement>(".swatch").forEach((sw) => sw.addEventListener("click", () => setColor(sw.dataset.color!)));
  colorInput.addEventListener("input", () => setColor(colorInput.value));

  const range = panel.querySelector<HTMLInputElement>(".dr-range")!;
  const wLabel = panel.querySelector<HTMLElement>(".dr-w")!;
  range.addEventListener("input", () => {
    board.setWidth(Number(range.value));
    wLabel.textContent = range.value;
  });

  let fillEnabled = false;
  const fillBtn = panel.querySelector<HTMLElement>(".dr-fill")!;
  fillBtn.addEventListener("click", () => {
    fillEnabled = !fillEnabled;
    board.setFillEnabled(fillEnabled);
    fillBtn.classList.toggle("active", fillEnabled);
  });

  const assistBtn = panel.querySelector<HTMLElement>(".dr-assist")!;
  assistBtn.addEventListener("click", () => {
    board.setAssist(!board.assist);
    assistBtn.classList.toggle("active", board.assist);
    try {
      localStorage.setItem("mdc.assist", board.assist ? "1" : "0");
    } catch {
      /* ignora */
    }
  });

  panel.querySelector<HTMLInputElement>(".dr-bg")!.addEventListener("change", (e) => {
    board.setWhiteBg((e.target as HTMLInputElement).checked);
  });

  const act = (name: string, fn: () => void) => {
    panel.querySelectorAll<HTMLElement>(`[data-act="${name}"]`).forEach((b) =>
      b.addEventListener("click", () => {
        fn();
        refresh();
      })
    );
  };
  act("undo", () => board.undo());
  act("redo", () => board.redo());
  act("dup", () => board.duplicateSelected());
  act("del", () => board.deleteSelected());
  act("clear", () => board.clearAll());

  // ---- zoom (passos finos embaixo, maiores em cima: 800% sem vinte cliques) ----
  const passoZoom = (z: number) => (z < 2 ? 0.25 : z < 4 ? 0.5 : 1);
  const zoomLabel = panel.querySelector<HTMLElement>('[data-act="zoom-reset"]')!;
  const updateZoom = () => {
    zoomLabel.textContent = `${Math.round(board.getZoom() * 100)}%`;
  };
  act("zoom-in", () => {
    board.setZoom(board.getZoom() + passoZoom(board.getZoom()));
    updateZoom();
  });
  act("zoom-out", () => {
    board.setZoom(board.getZoom() - passoZoom(board.getZoom()));
    updateZoom();
  });
  act("zoom-reset", () => {
    board.setZoom(1);
    updateZoom();
  });
  updateZoom();
  canvas.addEventListener(
    "wheel",
    (e) => {
      if (!e.ctrlKey) return;
      e.preventDefault();
      const z = board.getZoom();
      board.setZoom(z + (e.deltaY < 0 ? passoZoom(z) : -passoZoom(z)), { x: e.clientX, y: e.clientY });
      updateZoom();
    },
    { passive: false }
  );
  act("cancel", () => void finish({ kind: "cancel" }));
  act("remove", () => void finish({ kind: "remove" }));
  act("done", () => {
    if (board.isEmpty()) {
      toast("Faça um desenho antes de concluir.", "info");
      return;
    }
    const dataUrl = board.toPngDataUrl();
    const payload = dataUrl ? dataUrlPayload(dataUrl) : null;
    if (!payload) {
      toast("Não foi possível exportar o desenho.", "err");
      return;
    }
    void finish({ kind: "save", pngBase64: payload.b64, json: board.serialize() });
  });

  const refresh = () => {
    panel.querySelectorAll<HTMLElement>(".dr-tool").forEach((b) => b.classList.toggle("active", b.dataset.tool === board.tool));
    panel.querySelectorAll<HTMLElement>(".swatch").forEach((b) => {
      b.classList.toggle("active", b.dataset.color?.toLowerCase() === board.color.toLowerCase());
    });
    const undoBtn = panel.querySelector<HTMLButtonElement>('[data-act="undo"]')!;
    const redoBtn = panel.querySelector<HTMLButtonElement>('[data-act="redo"]')!;
    undoBtn.disabled = !board.canUndo();
    redoBtn.disabled = !board.canRedo();
    const hasSel = board.hasSelection();
    panel.querySelector<HTMLButtonElement>('[data-act="del"]')!.disabled = !hasSel;
    panel.querySelector<HTMLButtonElement>('[data-act="dup"]')!.disabled = !hasSel;
  };
  board.onChange = refresh;

  // ---- teclado (só quando o foco está no quadro) ----
  panel.addEventListener("keydown", (e) => {
    const target = e.target as HTMLElement;
    if (target.closest(".draw-text-input") || target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) return;
    const k = e.key.toLowerCase();
    if (e.ctrlKey || e.metaKey) {
      if (k === "z") {
        e.preventDefault();
        if (e.shiftKey) board.redo();
        else board.undo();
        refresh();
      } else if (k === "y") {
        e.preventDefault();
        board.redo();
        refresh();
      } else if (k === "d") {
        e.preventDefault();
        board.duplicateSelected();
        refresh();
      } else if (k === "c") {
        e.preventDefault();
        board.copySelected();
        refresh();
      } else if (k === "v") {
        e.preventDefault();
        board.pasteClipboard();
        refresh();
      }
      return;
    }
    if (e.key.startsWith("Arrow")) {
      const step = e.shiftKey ? 10 : 1;
      const dx = e.key === "ArrowLeft" ? -step : e.key === "ArrowRight" ? step : 0;
      const dy = e.key === "ArrowUp" ? -step : e.key === "ArrowDown" ? step : 0;
      if (dx || dy) {
        e.preventDefault();
        board.nudgeSelected(dx, dy);
        refresh();
      }
      return;
    }
    if (e.key === "Delete" || e.key === "Backspace") {
      e.preventDefault();
      board.deleteSelected();
      refresh();
      return;
    }
    if (e.key === "Escape") {
      e.preventDefault();
      void finish({ kind: "cancel" });
      return;
    }
    const map: Record<string, Tool> = { v: "select", p: "pen", l: "line", a: "arrow", r: "rect", o: "ellipse", t: "text", e: "eraser" };
    if (map[k]) {
      board.setTool(map[k]);
      refresh();
    }
  });

  refresh();
  return {
    el: panel,
    focus: () => canvas.focus({ preventScroll: true }),
    dispose: () => board.dispose(),
  };
}

/** Carrega os elementos salvos no quadro (usado ao reabrir um desenho). */
export function loadElements(board: Board, elements: DrEl[]): void {
  for (const el of elements) {
    // valida minimamente para não quebrar com json antigo/estranho
    if (!el || typeof el !== "object" || typeof el.type !== "string") continue;
    board.addElement(structuredClone(el));
  }
}

/** Gera um PNG "vazio" (usado como placeholder ao criar um desenho novo). */
export function placeholderDataUrl(w: number, h: number): string {
  const dpr = 2;
  const c = document.createElement("canvas");
  c.width = Math.round(w * dpr);
  c.height = Math.round(h * dpr);
  const ctx = c.getContext("2d")!;
  ctx.scale(dpr, dpr);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = "#c7ccd6";
  ctx.lineWidth = 3;
  ctx.setLineDash([14, 10]);
  ctx.strokeRect(14, 14, w - 28, h - 28);
  ctx.setLineDash([]);
  ctx.fillStyle = "#98a2b3";
  ctx.font = `600 46px ${FONT_STACK}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("Desenhe aqui", w / 2, h / 2);
  return c.toDataURL("image/png");
}
