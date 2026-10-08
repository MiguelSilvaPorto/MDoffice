// Construtor de diagramas Mermaid: campos simples + pré-visualização ao vivo (clique nos passos para editar).

import { h, toast, debounce, copyText, clamp } from "../../util";
import { type FlowStep, type SeqMessage, type StateTransition, buildFlowchart, buildSequence, buildState, detectKind } from "./build";
import { renderMermaidInto } from "./mermaid";
import { builderHtml } from "./template";

/** Extrai o id do nó a partir do id que o Mermaid coloca no SVG (ex.: dg-xxx-flowchart-A-0). */
export function parseNodeId(raw: string): string | null {
  const m = /(?:^|-)(?:flowchart|state|sequence)-([A-Za-z0-9_]+)-\d+$/.exec(raw ?? "");
  return m ? m[1] : null;
}

/** Converte o id do nó (A, B… Z, A1…) de volta para o índice da lista. */
export function nodeIdToIndex(id: string): number | null {
  const m = /^([A-Z])(\d*)$/.exec(id);
  if (!m) return null;
  const letter = m[1].charCodeAt(0) - 65;
  const round = m[2] ? Number(m[2]) : 0;
  return round * 26 + letter;
}

export interface DiagramBuilderOptions {
  /** Código existente: abre em modo código (editar o diagrama atual). */
  initialCode?: string;
  dark?: boolean;
  onInsert: (code: string) => void;
}

export const SHAPES: { value: FlowStep["shape"]; label: string }[] = [
  { value: "start", label: "Início / Fim" },
  { value: "process", label: "Processo" },
  { value: "decision", label: "Decisão" },
  { value: "end", label: "Fim do fluxo" },
];

export function openDiagramBuilder(opts: DiagramBuilderOptions): void {
  const dark = opts.dark ?? document.documentElement.dataset.theme === "dark";
  const backdrop = h("div", { class: "modal-backdrop" });
  const modal = h("div", { class: "modal dg-modal" });
  const mode: "form" | "code" = opts.initialCode ? "code" : "form";
  let seqCounter = 0;

  modal.innerHTML = builderHtml(mode);
  backdrop.append(modal);
  document.body.append(backdrop);

  const fieldsHost = modal.querySelector<HTMLElement>(".dg-fields")!;
  const kindSelect = modal.querySelector<HTMLSelectElement>(".dg-kind")!;
  const titleInput = modal.querySelector<HTMLInputElement>(".dg-title")!;
  const codeBox = modal.querySelector<HTMLTextAreaElement>(".dg-code")!;
  const previewHost = modal.querySelector<HTMLElement>(".dg-canvas")!;
  const errorEl = modal.querySelector<HTMLElement>(".dg-error")!;
  const formHost = modal.querySelector<HTMLElement>(".dg-form")!;
  const noteEl = modal.querySelector<HTMLElement>(".dg-note")!;
  const codeToggle = modal.querySelector<HTMLElement>("[data-code-toggle]")!;
  const nodeBar = modal.querySelector<HTMLElement>(".dg-node-bar")!;
  const quickBox = modal.querySelector<HTMLElement>(".dg-quick")!;

  if (opts.initialCode) {
    codeBox.value = opts.initialCode;
    kindSelect.value = detectKind(opts.initialCode);
  }

  let rows: { id: number; el: HTMLElement }[] = [];
  let nextId = 1;
  /** true = o usuário está escrevendo o código à mão (os campos ficam pausados). */
  let manual = false;

  const setManual = (on: boolean) => {
    manual = on;
    formHost.toggleAttribute("inert", on);
    formHost.classList.toggle("dg-paused", on);
    noteEl.hidden = !on;
  };

  const autoGrow = () => {
    codeBox.style.height = "auto";
    codeBox.style.height = `${Math.min(320, Math.max(110, codeBox.scrollHeight + 6))}px`;
  };

  const readFlow = (): FlowStep[] =>
    rows.map((row) => ({
      shape: (row.el.querySelector<HTMLSelectElement>(".dg-shape")?.value ?? "process") as FlowStep["shape"],
      label: row.el.querySelector<HTMLInputElement>(".dg-label")?.value ?? "",
      next: (() => {
        const v = row.el.querySelector<HTMLSelectElement>(".dg-next")?.value ?? "";
        return v === "" ? null : Number(v);
      })(),
      edgeLabel: row.el.querySelector<HTMLInputElement>(".dg-edge")?.value ?? "",
    }));

  const readSeq = (): { participants: string[]; messages: SeqMessage[] } => {
    const participants = (modal.querySelector<HTMLInputElement>(".dg-participants")?.value ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const messages = rows.map((row) => ({
      from: row.el.querySelector<HTMLSelectElement>(".dg-from")?.value ?? "",
      to: row.el.querySelector<HTMLSelectElement>(".dg-to")?.value ?? "",
      text: row.el.querySelector<HTMLInputElement>(".dg-text")?.value ?? "",
      dashed: row.el.querySelector<HTMLInputElement>(".dg-dashed")?.checked ?? false,
    }));
    return { participants, messages };
  };

  const readState = (): { states: string[]; transitions: StateTransition[] } => {
    const states = (modal.querySelector<HTMLInputElement>(".dg-states")?.value ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const transitions = rows.map((row) => ({
      from: row.el.querySelector<HTMLSelectElement>(".dg-st-from")?.value ?? "",
      to: row.el.querySelector<HTMLSelectElement>(".dg-st-to")?.value ?? "",
      label: row.el.querySelector<HTMLInputElement>(".dg-st-label")?.value ?? "",
    }));
    return { states, transitions };
  };

  const currentCode = (): string => {
    if (manual) return codeBox.value.trim();
    const title = titleInput.value;
    if (kindSelect.value === "sequence") {
      const { participants, messages } = readSeq();
      return buildSequence(title, participants, messages);
    }
    if (kindSelect.value === "state") {
      const { states, transitions } = readState();
      return buildState(title, states, transitions);
    }
    return buildFlowchart(title, readFlow());
  };

  const renderPreview = debounce(() => {
    const code = currentCode();
    if (!code) {
      previewHost.innerHTML = "";
      errorEl.hidden = true;
      return;
    }
    void renderMermaidInto(previewHost, code, dark).then((err) => {
      errorEl.hidden = !err;
      errorEl.textContent = err ? `Ajuste algo: ${err.split("\n")[0]}` : "";
      if (!err) decoratePreview();
    });
  }, 260);

  const sync = () => {
    if (!manual) codeBox.value = currentCode();
    autoGrow();
    renderPreview();
  };

  const refreshNextOptions = () => {
    if (kindSelect.value !== "flow") return;
    const options = rows.map((row, i) => `<option value="${i}">${i + 1}. ${(readFlow()[i].label || "(sem texto)").slice(0, 22)}</option>`).join("");
    rows.forEach((row, i) => {
      const sel = row.el.querySelector<HTMLSelectElement>(".dg-next");
      if (!sel) return;
      const current = sel.value;
      sel.innerHTML = `<option value="">(nenhum)</option>${options}`;
      sel.value = current && Number(current) < rows.length ? current : "";
      void i;
    });
  };

  const refreshSeqOptions = () => {
    if (kindSelect.value !== "sequence") return;
    const list = (modal.querySelector<HTMLInputElement>(".dg-participants")?.value ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const options = list.map((p) => `<option value="${p}">${p}</option>`).join("");
    rows.forEach((row) => {
      for (const cls of [".dg-from", ".dg-to"]) {
        const sel = row.el.querySelector<HTMLSelectElement>(cls);
        if (!sel) continue;
        const current = sel.value;
        sel.innerHTML = options;
        if (list.includes(current)) sel.value = current;
      }
    });
  };

  const refreshStateOptions = () => {
    if (kindSelect.value !== "state") return;
    const list = (modal.querySelector<HTMLInputElement>(".dg-states")?.value ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const options = ["[*]", ...list].map((p) => `<option value="${p}">${p}</option>`).join("");
    rows.forEach((row) => {
      for (const cls of [".dg-st-from", ".dg-st-to"]) {
        const sel = row.el.querySelector<HTMLSelectElement>(cls);
        if (!sel) continue;
        const current = sel.value;
        sel.innerHTML = options;
        if (current) sel.value = current;
      }
    });
  };

  const addRow = (values?: Record<string, string>) => {
    const kind = kindSelect.value;
    const id = nextId++;
    const row = h("div", { class: "dg-row" });
    row.dataset.id = String(id);
    if (kind === "flow") {
      row.innerHTML = `
        <select class="dg-shape">${SHAPES.map((s) => `<option value="${s.value}">${s.label}</option>`).join("")}</select>
        <input type="text" class="dg-label" placeholder="Ex.: Conferir dados" />
        <span class="dg-arrow">→</span>
        <select class="dg-next"><option value="">(nenhum)</option>${rows.map((r, i) => `<option value="${i}">${i + 1}</option>`).join("")}</select>
        <input type="text" class="dg-edge" placeholder="rótulo da seta (Sim/Não)" />
        <button class="dg-del" title="Remover linha">✕</button>`;
      if (values?.label) row.querySelector<HTMLInputElement>(".dg-label")!.value = values.label;
    } else if (kind === "sequence") {
      row.innerHTML = `
        <select class="dg-from"></select>
        <span class="dg-arrow">→</span>
        <select class="dg-to"></select>
        <input type="text" class="dg-text" placeholder="Mensagem" />
        <label class="dg-check"><input type="checkbox" class="dg-dashed" /> tracejada</label>
        <button class="dg-del" title="Remover linha">✕</button>`;
      if (values?.text) row.querySelector<HTMLInputElement>(".dg-text")!.value = values.text;
    } else {
      row.innerHTML = `
        <select class="dg-st-from"></select>
        <span class="dg-arrow">→</span>
        <select class="dg-st-to"></select>
        <input type="text" class="dg-st-label" placeholder="quando… (opcional)" />
        <button class="dg-del" title="Remover linha">✕</button>`;
      if (values?.label) row.querySelector<HTMLInputElement>(".dg-st-label")!.value = values.label;
    }
    row.querySelector<HTMLElement>(".dg-del")!.addEventListener("click", () => {
      rows = rows.filter((r) => r.id !== id);
      row.remove();
      refreshNextOptions();
      sync();
    });
    row.querySelectorAll("input,select").forEach((el) => {
      el.addEventListener("input", () => {
        if (el.classList.contains("dg-label")) refreshNextOptions();
        sync();
      });
      el.addEventListener("change", () => {
        if (el.classList.contains("dg-label")) refreshNextOptions();
        sync();
      });
      // Enter num campo de texto já cria a próxima linha (escrita rápida)
      if (el instanceof HTMLInputElement && el.type === "text") {
        el.addEventListener("keydown", (e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            const created = addRow();
            refreshNextOptions();
            refreshSeqOptions();
            refreshStateOptions();
            sync();
            created.querySelector<HTMLInputElement>("input[type=text]")?.focus();
          }
        });
      }
    });
    fieldsHost.append(row);
    rows.push({ id, el: row });
    return row;
  };

  const rebuildFields = () => {
    fieldsHost.innerHTML = "";
    rows = [];
    seqCounter = 0;
    const kind = kindSelect.value;
    quickBox.hidden = kind !== "flow";
    nodeBar.hidden = true;
    selectedIndex = null;
    if (kind === "sequence") {
      fieldsHost.append(
        h("div", { class: "dg-line" }, [
          h("label", { class: "dg-grow" }, [
            (() => {
              const span = document.createElement("span");
              span.textContent = "Participantes (separe por vírgula)";
              return span;
            })(),
            (() => {
              const input = document.createElement("input");
              input.type = "text";
              input.className = "dg-participants";
              input.placeholder = "Ex.: Cliente, Sistema, Banco de dados";
              input.value = "Cliente, Sistema";
              input.addEventListener("input", () => {
                refreshSeqOptions();
                sync();
              });
              return input;
            })(),
          ]),
        ])
      );
      addRow({ text: "Envia o pedido" });
      addRow({ text: "Responde com o resultado" });
      refreshSeqOptions();
      if (rows.length >= 2) {
        const sels = rows.map((r) => ({
          from: r.el.querySelector<HTMLSelectElement>(".dg-from")!,
          to: r.el.querySelector<HTMLSelectElement>(".dg-to")!,
        }));
        if (sels[0].from.options.length > 0) sels[0].from.value = sels[0].from.options[0].value;
        if (sels[0].to.options.length > 1) sels[0].to.value = sels[0].to.options[1].value;
        if (sels[1].to.options.length > 0) sels[1].to.value = sels[1].to.options[0].value;
        if (sels[1].from.options.length > 1) sels[1].from.value = sels[1].from.options[1].value;
      }
    } else if (kind === "state") {
      fieldsHost.append(
        h("div", { class: "dg-line" }, [
          h("label", { class: "dg-grow" }, [
            (() => {
              const span = document.createElement("span");
              span.textContent = "Estados (separe por vírgula) — use [*] para início/fim";
              return span;
            })(),
            (() => {
              const input = document.createElement("input");
              input.type = "text";
              input.className = "dg-states";
              input.value = "Aguardando, Em análise, Aprovado";
              input.addEventListener("input", () => {
                refreshStateOptions();
                sync();
              });
              return input;
            })(),
          ]),
        ])
      );
      addRow({ label: "inicia" });
      addRow({ label: "aprova" });
      refreshStateOptions();
      const set = (idx: number, cls: string, value: string) => {
        const sel = rows[idx]?.el.querySelector<HTMLSelectElement>(cls);
        if (sel && Array.from(sel.options).some((o) => o.value === value)) sel.value = value;
      };
      set(0, ".dg-st-from", "[*]");
      set(0, ".dg-st-to", "Aguardando");
      set(1, ".dg-st-from", "Aguardando");
      set(1, ".dg-st-to", "Aprovado");
    } else {
      addRow({ label: "Recebe o pedido" });
      addRow({ label: "Valida os dados" });
      refreshNextOptions();
      const first = rows[0]?.el.querySelector<HTMLSelectElement>(".dg-next");
      if (first && first.options.length > 2) first.value = "1";
      const shapes = rows.map((r) => r.el.querySelector<HTMLSelectElement>(".dg-shape"));
      if (shapes[0] && shapes[0].options.length > 0) shapes[0].value = "start";
    }
    refreshNextOptions();
    refreshSeqOptions();
    refreshStateOptions();
    sync();
  };

  // ---------- fluxo "quase desenhado": clique nos passos do diagrama ----------
  let selectedIndex: number | null = null;

  const renderFlowRows = (steps: FlowStep[]) => {
    fieldsHost.innerHTML = "";
    rows = [];
    steps.forEach((step) => {
      const row = addRow({ label: step.label });
      row.querySelector<HTMLSelectElement>(".dg-shape")!.value = step.shape;
      row.querySelector<HTMLInputElement>(".dg-edge")!.value = step.edgeLabel;
      row.dataset.next = step.next === null ? "" : String(step.next);
    });
    refreshNextOptions();
    rows.forEach((r) => {
      const sel = r.el.querySelector<HTMLSelectElement>(".dg-next");
      const saved = r.el.dataset.next ?? "";
      if (sel && saved !== "" && Number(saved) < rows.length) sel.value = saved;
      delete r.el.dataset.next;
    });
    sync();
  };

  const insertStepAfter = (idx: number, shape: FlowStep["shape"] = "process") => {
    const steps = readFlow();
    const label = shape === "decision" ? "Decisão?" : shape === "end" ? "Fim" : "Novo passo";
    if (!steps.length) {
      renderFlowRows([{ shape, label, next: null, edgeLabel: "" }]);
      selectedIndex = 0;
      return;
    }
    const anchor = clamp(idx, 0, steps.length - 1);
    const oldNext = steps[anchor].next;
    // o alvo antigo anda uma casa quando está depois do ponto de inserção
    const shiftedNext = oldNext === null ? null : oldNext > anchor ? oldNext + 1 : oldNext;
    steps.forEach((s) => {
      if (s.next !== null && s.next > anchor) s.next += 1;
    });
    steps[anchor].next = anchor + 1;
    steps.splice(anchor + 1, 0, { shape, label, next: shiftedNext, edgeLabel: "" });
    renderFlowRows(steps);
    selectedIndex = anchor + 1;
  };

  const removeStepAt = (idx: number) => {
    const steps = readFlow();
    if (idx < 0 || idx >= steps.length) return;
    // mantém o fluxo ligado: quem apontava para o passo removido passa a apontar para o próximo dele
    const removedNext = steps[idx].next;
    const relink = removedNext === null ? null : removedNext > idx ? removedNext - 1 : removedNext;
    steps.splice(idx, 1);
    steps.forEach((s) => {
      if (s.next === idx) s.next = relink;
      else if (s.next !== null && s.next > idx) s.next -= 1;
    });
    renderFlowRows(steps);
    selectedIndex = null;
    nodeBar.hidden = true;
  };

  const renameStep = (index: number) => {
    const input = rows[index]?.el.querySelector<HTMLInputElement>(".dg-label");
    if (!input) return;
    input.focus();
    input.select();
    fieldsHost.scrollIntoView({ block: "nearest", behavior: "smooth" });
  };

  const selectNode = (index: number, g?: SVGGElement) => {
    selectedIndex = index;
    previewHost.querySelectorAll(".dg-selected").forEach((el) => el.classList.remove("dg-selected"));
    g?.classList.add("dg-selected");
    nodeBar.hidden = false;
    const name = nodeBar.querySelector<HTMLElement>(".dg-node-name");
    if (name) name.textContent = `Passo ${index + 1}`;
    if (g) {
      const rect = g.getBoundingClientRect();
      const parent = (nodeBar.offsetParent as HTMLElement) ?? previewHost;
      const parentRect = parent.getBoundingClientRect();
      nodeBar.style.left = `${Math.max(8, Math.min(rect.left - parentRect.left + rect.width / 2 - 130, Math.max(8, parentRect.width - 300)))}px`;
      nodeBar.style.top = `${rect.bottom - parentRect.top + 8}px`;
    }
  };

  const decoratePreview = () => {
    if (kindSelect.value !== "flow") {
      nodeBar.hidden = true;
      return;
    }
    const svg = previewHost.querySelector("svg");
    if (!svg) return;
    svg.querySelectorAll<SVGGElement>("g.node").forEach((g) => {
      const id = parseNodeId(g.id);
      if (!id) return;
      const index = nodeIdToIndex(id);
      if (index === null) return;
      g.style.cursor = "pointer";
      g.addEventListener("click", (e) => {
        e.stopPropagation();
        selectNode(index, g);
      });
      g.addEventListener("dblclick", (e) => {
        e.stopPropagation();
        renameStep(index);
      });
      if (selectedIndex === index) g.classList.add("dg-selected");
    });
    if (selectedIndex !== null) {
      const current = Array.from(svg.querySelectorAll<SVGGElement>("g.node")).find((n) => {
        const id = parseNodeId(n.id);
        return id !== null && nodeIdToIndex(id) === selectedIndex;
      });
      if (current) selectNode(selectedIndex, current);
      else nodeBar.hidden = true;
    }
  };

  kindSelect.addEventListener("change", () => rebuildFields());
  titleInput.addEventListener("input", () => sync());
  codeBox.addEventListener("input", () => {
    if (!manual) setManual(true);
    autoGrow();
    renderPreview();
  });
  // Ctrl+Enter na caixa de código insere no documento
  codeBox.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      modal.querySelector<HTMLElement>("[data-insert]")!.click();
    }
  });
  modal.querySelector<HTMLElement>("[data-resume]")!.addEventListener("click", () => {
    setManual(false);
    if (!fieldsHost.children.length) rebuildFields();
    else sync();
    toast("Código regenerado a partir dos campos.", "info", 2600);
  });
  modal.querySelector<HTMLElement>("[data-copy-code]")!.addEventListener("click", () => {
    void copyText(codeBox.value).then((ok) => toast(ok ? "Código copiado." : "Não consegui copiar.", ok ? "ok" : "err", 2200));
  });

  // adicionar passos clicando (quase desenhar o fluxo)
  modal.querySelectorAll<HTMLElement>("[data-quick]").forEach((b) =>
    b.addEventListener("click", () => {
      const shape = (b.dataset.quick ?? "process") as FlowStep["shape"];
      if (kindSelect.value !== "flow") {
        kindSelect.value = "flow";
        rebuildFields();
        insertStepAfter(rows.length - 1, shape);
        return;
      }
      insertStepAfter(selectedIndex ?? rows.length - 1, shape);
    })
  );
  modal.querySelectorAll<HTMLElement>("[data-node]").forEach((b) =>
    b.addEventListener("click", () => {
      if (selectedIndex === null) return;
      const action = b.dataset.node;
      if (action === "after") insertStepAfter(selectedIndex, "process");
      else if (action === "rename") renameStep(selectedIndex);
      else if (action === "remove") removeStepAt(selectedIndex);
    })
  );
  previewHost.addEventListener("click", () => {
    selectedIndex = null;
    nodeBar.hidden = true;
    previewHost.querySelectorAll(".dg-selected").forEach((el) => el.classList.remove("dg-selected"));
  });
  codeToggle.addEventListener("click", () => {
    const hidden = codeBox.hidden;
    codeBox.hidden = !hidden;
    if (!hidden) codeBox.value = currentCode();
  });
  modal.querySelector<HTMLElement>("[data-add]")!.addEventListener("click", () => {
    addRow();
    refreshNextOptions();
    refreshSeqOptions();
    refreshStateOptions();
    sync();
  });
  modal.querySelector<HTMLElement>("[data-example]")!.addEventListener("click", () => {
    titleInput.value = "Fluxo de exemplo";
    if (kindSelect.value !== "flow") {
      kindSelect.value = "flow";
      rebuildFields();
      return;
    }
    fieldsHost.innerHTML = "";
    rows = [];
    addRow({ label: "Recebe o pedido" });
    addRow({ label: "Está completo?" });
    addRow({ label: "Solicita os dados" });
    refreshNextOptions();
    const set = (idx: number, shape: string, next: string, edge: string) => {
      const row = rows[idx]?.el;
      if (!row) return;
      row.querySelector<HTMLSelectElement>(".dg-shape")!.value = shape;
      row.querySelector<HTMLSelectElement>(".dg-next")!.value = next;
      row.querySelector<HTMLInputElement>(".dg-edge")!.value = edge;
    };
    set(0, "start", "1", "");
    set(1, "decision", "2", "Não");
    set(2, "process", "1", "");
    sync();
  });

  const close = () => {
    document.removeEventListener("keydown", onKey, true);
    backdrop.remove();
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.key === "Escape" && !(e.target instanceof HTMLTextAreaElement) && !(e.target instanceof HTMLInputElement)) {
      e.preventDefault();
      e.stopPropagation();
      close();
    }
  };
  document.addEventListener("keydown", onKey, true);
  backdrop.addEventListener("mousedown", (e) => {
    if (e.target === backdrop) close();
  });
  modal.querySelectorAll<HTMLElement>("[data-close]").forEach((b) => b.addEventListener("click", close));
  modal.querySelector<HTMLElement>("[data-insert]")!.addEventListener("click", () => {
    const code = currentCode();
    if (!code.trim()) {
      toast("Preencha os campos para gerar o diagrama.", "info");
      return;
    }
    opts.onInsert(code);
    close();
  });

  if (mode === "code") {
    setManual(true);
    autoGrow();
    renderPreview();
  } else {
    rebuildFields();
  }
}
