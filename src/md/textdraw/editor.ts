// Editor embutido do desenho em letras (barra de ferramentas e ciclo de vida).

import { h, toast } from "../../util";
import { type TraceStyle, type TextDrawDoc, type TextTool } from "./model";
import { R, L } from "./glyphs";
import { TextBoard } from "./board";

export type TextEditorResult = { kind: "save"; text: string } | { kind: "cancel" } | { kind: "remove" };

export interface TextEditorOptions {
  doc?: TextDrawDoc | null;
  /** Chamado enquanto você desenha, para o texto ir aparecendo no editor em tempo real. */
  onLiveChange?: (text: string) => void;
  onDone: (result: TextEditorResult) => void | Promise<void>;
}

export interface TextEditorHandle {
  el: HTMLElement;
  focus(): void;
  dispose(): void;
  /** Recarrega o desenho a partir do texto (quando você edita o bloco no editor). */
  applyText(text: string): void;
}

export const TOOLS: { id: TextTool; label: string; title: string }[] = [
  { id: "select", label: "⌖", title: "Selecionar área (V) — arraste marcando o retângulo e apague com Del" },
  { id: "pen", label: "✏", title: "Mão livre — traços viram linhas alinhadas (P)" },
  { id: "line", label: "─", title: "Linha (L)" },
  { id: "rect", label: "▭", title: "Caixa (R)" },
  { id: "text", label: "T", title: "Caixa de texto (T) — Enter quebra linha, dá para escrever várias linhas" },
  { id: "field", label: "[ ]", title: "Campo selecionável, ex.: [ ] tarefa (C)" },
  { id: "table", label: "▦", title: "Tabela de letras e símbolos (B)" },
  { id: "eraser", label: "⌫", title: "Borracha (E)" },
];

export function tracePref(): TraceStyle {
  try {
    const value = localStorage.getItem("mdc.texttrace");
    if (value === "double" || value === "ascii") return value;
  } catch {
    /* ignora */
  }
  return "single";
}

export function createTextDrawEditor(opts: TextEditorOptions): TextEditorHandle {
  const panel = h("div", { class: "draw-inline text-draw", tabindex: "-1" });
  const style = opts.doc?.style ?? tracePref();

  panel.innerHTML = `
    <div class="dr-toolbar">
      <div class="dr-group">
        ${TOOLS.map((t) => `<button class="tbtn dr-tool" data-tool="${t.id}" title="${t.title}">${t.label}</button>`).join("")}
      </div>
      <span class="tsep"></span>
      <div class="dr-group">
        <label class="dr-check" title="Estilo do traço">Traço
          <select class="txt-trace">
            <option value="single">Simples ┌─┐</option>
            <option value="double">Duplo ╔═╗</option>
            <option value="ascii">ASCII +-|</option>
          </select>
        </label>
      </div>
      <div class="dr-group">
        <button class="tbtn wide" data-act="templates" title="Modelos prontos: caixa, fluxo, tabela">Modelos ▾</button>
      </div>
      <span class="tsep"></span>
      <div class="dr-group">
        <button class="btn icon" data-act="undo" title="Desfazer (Ctrl+Z)"><svg class="ic"><use href="#i-undo"/></svg></button>
        <button class="btn icon" data-act="redo" title="Refazer (Ctrl+Y)"><svg class="ic"><use href="#i-redo"/></svg></button>
        <button class="btn icon" data-act="del" title="Apagar a área selecionada (Del)"><svg class="ic"><use href="#i-trash"/></svg></button>
        <button class="tbtn wide" data-act="clear" title="Limpar tudo para começar de novo">Limpar</button>
        <button class="tbtn wide" data-act="fit-box" title="Ajustar o texto selecionado para caber dentro da caixa">Ajustar à caixa</button>
      </div>
      <span class="tsep"></span>
      <div class="dr-group">
        <button class="btn icon" data-act="zoom-out" title="Diminuir zoom (Ctrl + roda do mouse)">−</button>
        <button class="tbtn wide dr-zoom" data-act="zoom-reset" title="Voltar ao tamanho que cabe na tela">100%</button>
        <button class="btn icon" data-act="zoom-in" title="Aumentar zoom (Ctrl + roda do mouse)">+</button>
      </div>
      <span class="dr-spacer"></span>
      <span class="muted txt-hint">Desenhe com caixas, textos, campos [ ] e tabelas</span>
    </div>
    <div class="draw-canvas-wrap"><canvas class="dr-canvas" tabindex="0"></canvas></div>
    <div class="di-foot">
      <span class="muted">⌖ arraste para selecionar a área e <b>Del</b> apaga · botão direito apaga linha/rótulo · o texto aparece no editor enquanto você desenha</span>
      <span class="dr-spacer"></span>
      <button class="btn" data-act="remove" title="Remover este desenho do documento">Remover</button>
      <button class="btn" data-act="cancel">Cancelar</button>
      <button class="btn primary" data-act="done">Concluir</button>
    </div>`;

  const canvas = panel.querySelector<HTMLCanvasElement>(".dr-canvas")!;
  const wrap = panel.querySelector<HTMLElement>(".draw-canvas-wrap")!;
  const board = new TextBoard(canvas, wrap, { doc: opts.doc ?? null });
  // gancho de depuração/teste (mesmo padrão do window.__mdcreator.app)
  (window as unknown as { __mdcreatorTextBoard?: TextBoard }).__mdcreatorTextBoard = board;

  const traceSelect = panel.querySelector<HTMLSelectElement>(".txt-trace")!;
  traceSelect.value = style;
  traceSelect.addEventListener("change", () => {
    board.setStyle(traceSelect.value as TraceStyle);
    try {
      localStorage.setItem("mdc.texttrace", traceSelect.value);
    } catch {
      /* ignora */
    }
    refresh();
  });

  let busy = false;
  let stopped = false;
  let liveTimer: number | undefined;
  let livePending = false;
  const notifyLive = () => {
    if (!opts.onLiveChange || stopped) return;
    livePending = true;
    if (liveTimer !== undefined) return;
    liveTimer = window.setTimeout(() => {
      liveTimer = undefined;
      if (!livePending || stopped) return;
      livePending = false;
      opts.onLiveChange?.(board.toText());
    }, 140);
  };
  const finish = async (result: TextEditorResult) => {
    if (busy) return;
    busy = true;
    stopped = true;
    if (liveTimer !== undefined) {
      window.clearTimeout(liveTimer);
      liveTimer = undefined;
    }
    panel.querySelectorAll<HTMLButtonElement>("button").forEach((b) => (b.disabled = true));
    try {
      await opts.onDone(result);
    } catch (error) {
      toast("Não foi possível salvar o desenho: " + error, "err");
      panel.querySelectorAll<HTMLButtonElement>("button").forEach((b) => (b.disabled = false));
    } finally {
      busy = false;
    }
  };

  panel.querySelectorAll<HTMLElement>(".dr-tool").forEach((btn) => {
    btn.addEventListener("click", () => {
      board.setTool((btn.dataset.tool as TextTool) ?? "pen");
      refresh();
    });
  });

  // modelos prontos (jeito simples de montar caixas, fluxos e tabelas)
  panel.querySelector<HTMLElement>('[data-act="templates"]')!.addEventListener("click", () => {
    wrap.querySelector(".txt-popover")?.remove();
    const pop = h("div", { class: "txt-popover" });
    pop.innerHTML = `
      <div class="txt-popover-title">Modelos prontos</div>
      <button class="btn" data-model="box">Caixa com título e campo [ ]</button>
      <button class="btn" data-model="flow">Fluxo  A ▶ B</button>
      <button class="btn" data-model="table">Tabela 3 × 2</button>`;
    pop.style.left = "14px";
    pop.style.top = "52px";
    wrap.append(pop);
    const close = () => pop.remove();
    pop.querySelectorAll<HTMLElement>("[data-model]").forEach((b) =>
      b.addEventListener("click", () => {
        board.insertTemplate(b.dataset.model as "box" | "flow" | "table");
        close();
      })
    );
    pop.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        close();
      }
    });
    pop.querySelector<HTMLElement>("[data-model]")?.focus();
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
  act("del", () => board.eraseSelection());
  act("clear", () => board.clearAll());
  act("fit-box", () => board.fitSelectionToBox());

  // ---- zoom (ajuste fino) ----
  const zoomLabel = panel.querySelector<HTMLElement>('[data-act="zoom-reset"]')!;
  const updateZoom = () => {
    zoomLabel.textContent = `${Math.round(board.getZoom() * 100)}%`;
  };
  act("zoom-in", () => {
    board.setZoom(board.getZoom() + 0.25);
    updateZoom();
  });
  act("zoom-out", () => {
    board.setZoom(board.getZoom() - 0.25);
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
      board.setZoom(board.getZoom() + (e.deltaY < 0 ? 0.25 : -0.25));
      updateZoom();
    },
    { passive: false }
  );
  act("cancel", () => void finish({ kind: "cancel" }));
  act("remove", () => void finish({ kind: "remove" }));
  act("done", () => {
    const text = board.toText();
    if (!text.trim()) {
      toast("Desenhe algo antes de concluir.", "info");
      return;
    }
    void finish({ kind: "save", text });
  });

  const refresh = () => {
    panel.querySelectorAll<HTMLElement>(".dr-tool").forEach((b) => b.classList.toggle("active", b.dataset.tool === board.tool));
    panel.querySelector<HTMLButtonElement>('[data-act="undo"]')!.disabled = !board.canUndo();
    panel.querySelector<HTMLButtonElement>('[data-act="redo"]')!.disabled = !board.canRedo();
    panel.querySelector<HTMLButtonElement>('[data-act="clear"]')!.disabled = board.isEmpty();
    panel.querySelector<HTMLButtonElement>('[data-act="del"]')!.disabled = !board.hasSelection();
    panel.querySelector<HTMLButtonElement>('[data-act="fit-box"]')!.disabled = !board.hasSelection();
  };
  board.onChange = () => {
    refresh();
    notifyLive();
  };

  panel.addEventListener("keydown", (e) => {
    const target = e.target as HTMLElement;
    if (target instanceof HTMLInputElement || target instanceof HTMLSelectElement || target instanceof HTMLTextAreaElement) return;
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
      } else if (k === "enter") {
        e.preventDefault();
        panel.querySelector<HTMLElement>('[data-act="done"]')!.click();
      }
      return;
    }
    if (e.key === "Delete" || e.key === "Backspace") {
      if (board.hasSelection()) {
        e.preventDefault();
        board.eraseSelection();
        refresh();
      }
      return;
    }
    if (e.key === "Escape") {
      e.preventDefault();
      if (board.hasSelection()) {
        board.clearSelection();
        refresh();
        return;
      }
      void finish({ kind: "cancel" });
      return;
    }
    const map: Record<string, TextTool> = { v: "select", p: "pen", l: "line", r: "rect", t: "text", c: "field", b: "table", e: "eraser" };
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
    applyText: (text: string) => {
      if (stopped) return;
      board.applyText(text);
    },
  };
}
