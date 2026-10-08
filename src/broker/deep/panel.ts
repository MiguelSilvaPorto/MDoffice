// Tela da Revisão inteligente: mostra, palavra por palavra, o que o sistema sugere como diff (antes/depois, em contexto)
// e POR QUE. Nada é trocado sozinho: cada troca (ou grupo) só entra quando a pessoa aceita.
import { h } from "../../util";
import type { DeepResult, Group, Proposal } from "./analyze";

export interface DeepPanelOptions {
  /** gera (ou lê do cache) a análise; `broad` inclui sinônimos de confiança média */
  compute: (broad: boolean) => Promise<DeepResult | null>;
  /** o texto ainda é o que foi analisado nesta posição? */
  check: (p: Proposal) => boolean;
  /** troca no documento */
  apply: (p: Proposal) => void;
  /** posiciona o cursor na palavra */
  goTo: (p: Proposal) => void;
  onClose?: () => void;
}

export interface DeepPanelHandle {
  close(): void;
}

type State = "pending" | "applied" | "ignored" | "stale";

export function openDeepPanel(opts: DeepPanelOptions): DeepPanelHandle {
  const backdrop = h("div", { class: "modal-backdrop" });
  const modal = h("div", { class: "modal dp-modal" });
  modal.innerHTML = `
    <header class="wm-head">
      <svg class="ic"><use href="#i-check"/></svg>
      <h2>Revisão inteligente</h2>
      <span class="muted rv-sub">Palavras repetidas, com a troca sugerida e o motivo</span>
      <button class="btn icon" data-close title="Fechar (Esc)"><svg class="ic"><use href="#i-close"/></svg></button>
    </header>
    <div class="dp-body">
      <div class="dp-sum"></div>
      <div class="dp-list"></div>
    </div>
    <footer class="wm-foot">
      <label class="dp-opt"><input type="checkbox" data-broad> Incluir sugestões menos certas</label>
      <span class="dr-spacer"></span>
      <button class="btn" data-accept-all>Aceitar todas (alta confiança)</button>
      <button class="btn primary" data-close>Fechar</button>
    </footer>`;
  backdrop.append(modal);
  document.body.append(backdrop);

  const sum = modal.querySelector<HTMLElement>(".dp-sum")!;
  const list = modal.querySelector<HTMLElement>(".dp-list")!;
  const broadBox = modal.querySelector<HTMLInputElement>("[data-broad]")!;
  const acceptAll = modal.querySelector<HTMLButtonElement>("[data-accept-all]")!;

  let result: DeepResult | null = null;
  const state = new Map<string, State>();
  let loading = true;
  let seq = 0;

  const close = () => {
    document.removeEventListener("keydown", onKey, true);
    backdrop.remove();
    opts.onClose?.();
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      close();
    }
  };
  document.addEventListener("keydown", onKey, true);
  modal.addEventListener("click", (e) => {
    if ((e.target as HTMLElement).closest("[data-close]")) close();
  });
  backdrop.addEventListener("mousedown", (e) => {
    if (e.target === backdrop) close();
  });

  const st = (p: Proposal): State => state.get(p.id) ?? "pending";

  /** troca uma sugestão e corrige as posições das outras (o texto mudou de tamanho) */
  const applyOne = (p: Proposal): boolean => {
    if (st(p) !== "pending") return false;
    if (!opts.check(p)) {
      state.set(p.id, "stale");
      return false;
    }
    opts.apply(p);
    state.set(p.id, "applied");
    const d = p.replacement.length - (p.to - p.from);
    for (const g of result?.groups ?? []) for (const o of g.proposals) if (o !== p && o.from > p.from) (o.from += d), (o.to += d);
    p.to = p.from + p.replacement.length;
    return true;
  };

  const pendingOf = (g: Group) => g.proposals.filter((p) => st(p) === "pending");

  function renderRow(g: Group, p: Proposal): HTMLElement {
    const s = st(p);
    const row = h("div", { class: `dp-row dp-${s}` });
    const diff = h("div", { class: "dp-diff" });
    diff.append(
      h("span", { class: "dp-ctx", text: p.before }),
      h("del", { text: p.original }),
      h("ins", { text: p.replacement }),
      h("span", { class: "dp-ctx", text: p.after })
    );
    row.append(diff);
    row.append(h("div", { class: "dp-why", text: `Por quê: ${p.reason}` }));
    const bar = h("div", { class: "dp-bar" });
    bar.append(h("span", { class: `dp-conf dp-conf-${p.confidence === "alta" ? "hi" : "mid"}`, text: `confiança ${p.confidence}` }));
    if (s === "pending") {
      bar.append(
        h("button", { class: "btn small primary", text: "Aceitar", onClick: () => (applyOne(p), render()) }),
        h("button", { class: "btn small", text: "Ignorar", onClick: () => (state.set(p.id, "ignored"), render()) }),
        h("button", { class: "btn small", text: "Ver no texto", onClick: () => (opts.goTo(p), close()) })
      );
    } else {
      bar.append(h("span", { class: "muted", text: { applied: "trocada", ignored: "ignorada", stale: "o texto mudou — rode de novo", pending: "" }[s] }));
    }
    row.append(bar);
    void g;
    return row;
  }

  function render(): void {
    list.textContent = "";
    if (loading) {
      sum.textContent = "Analisando o texto em segundo plano…";
      acceptAll.disabled = true;
      return;
    }
    if (!result || !result.groups.length) {
      sum.textContent = result && result.words < 120 ? "Texto curto demais para uma revisão profunda (precisa de pelo menos ~120 palavras)." : "Nenhuma palavra se repete demais neste texto — nada a sugerir. 👍";
      acceptAll.disabled = true;
      return;
    }
    const total = result.groups.reduce((a, g) => a + g.proposals.length, 0);
    const done = result.groups.reduce((a, g) => a + g.proposals.filter((p) => st(p) === "applied").length, 0);
    sum.textContent = `${total} sugestões de troca em ${result.groups.length} palavras repetidas (texto de ${result.words} palavras)${done ? ` — ${done} aplicada(s)` : ""}. Nada muda sem você aceitar.`;
    acceptAll.disabled = !result.groups.some((g) => g.proposals.some((p) => st(p) === "pending" && p.confidence === "alta"));
    for (const g of result.groups) {
      const card = h("section", { class: "dp-group" });
      const head = h("div", { class: "dp-ghead" });
      head.append(h("strong", { text: `“${g.shown}” × ${g.count}` }), h("span", { class: "muted", text: `uma a cada ${g.every} palavras` }));
      const pend = pendingOf(g);
      if (pend.length) {
        head.append(
          h("button", {
            class: "btn small",
            text: `Aceitar as ${pend.length}`,
            onClick: () => {
              for (const p of [...pend].sort((a, b) => b.from - a.from)) applyOne(p);
              render();
            },
          })
        );
      }
      card.append(head, h("p", { class: "dp-gwhy", text: g.why }));
      for (const p of g.proposals) card.append(renderRow(g, p));
      list.append(card);
    }
  }

  async function load(): Promise<void> {
    const my = ++seq;
    loading = true;
    state.clear();
    render();
    const r = await opts.compute(broadBox.checked);
    if (my !== seq) return;
    result = r;
    loading = false;
    render();
  }

  broadBox.addEventListener("change", () => void load());
  acceptAll.addEventListener("click", () => {
    if (!result) return;
    const all = result.groups.flatMap((g) => g.proposals).filter((p) => st(p) === "pending" && p.confidence === "alta");
    for (const p of all.sort((a, b) => b.from - a.from)) applyOne(p);
    render();
  });
  void load();
  return { close };
}
