// Tela do histórico: lista de versões à esquerda, o que mudou à direita, e restaurar com um clique.
import { diffLines, listVersions, removeVersion, snapshot, type Version } from "./history";
import { copyText, h, toast } from "./util";

export interface HistoryHooks {
  doc: string;
  title: string;
  getText: () => string;
  max: number;
  /** Troca o texto do editor pela versão escolhida (uma ação só, dá para desfazer com Ctrl+Z). */
  restore: (text: string) => void;
}

function ago(at: number): string {
  const s = Math.round((Date.now() - at) / 1000);
  if (s < 45) return "agora há pouco";
  const m = Math.round(s / 60);
  if (m < 60) return `há ${m} min`;
  const hr = Math.round(m / 60);
  if (hr < 24) return `há ${hr} h`;
  const d = Math.round(hr / 24);
  return d === 1 ? "ontem" : `há ${d} dias`;
}

const when = (at: number) =>
  new Date(at).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

export function openHistoryDialog(hooks: HistoryHooks): void {
  if (document.querySelector(".history-modal")) return;
  const backdrop = h("div", { class: "modal-backdrop" });
  const modal = h("div", { class: "modal history-modal" });
  modal.innerHTML = `
    <header class="wm-head">
      <svg class="ic"><use href="#i-clock"/></svg>
      <h2>Histórico — ${hooks.title.replace(/[<&]/g, "")}</h2>
      <button class="btn icon" data-close title="Fechar (Esc)"><svg class="ic"><use href="#i-close"/></svg></button>
    </header>
    <div class="hi-body">
      <aside class="hi-list">
        <div class="hi-save">
          <input type="text" data-name placeholder="Nome da versão (opcional)" spellcheck="false" />
          <button class="btn small primary" data-save>Salvar versão agora</button>
        </div>
        <div class="hi-items" data-items></div>
      </aside>
      <section class="hi-view">
        <div class="hi-head" data-head><span class="muted">Escolha uma versão para ver o que mudou.</span></div>
        <div class="hi-diff" data-diff></div>
      </section>
    </div>
    <footer class="wm-foot">
      <span class="muted" data-legend></span>
      <span class="dr-spacer"></span>
      <button class="btn" data-copy disabled>Copiar texto</button>
      <button class="btn" data-del disabled>Excluir</button>
      <button class="btn primary" data-restore disabled>Restaurar esta versão</button>
    </footer>`;
  backdrop.append(modal);
  document.body.append(backdrop);

  const q = <T extends HTMLElement>(s: string) => modal.querySelector<T>(s)!;
  const items = q("[data-items]");
  const diffEl = q("[data-diff]");
  const head = q("[data-head]");
  const btn = { copy: q<HTMLButtonElement>("[data-copy]"), del: q<HTMLButtonElement>("[data-del]"), restore: q<HTMLButtonElement>("[data-restore]") };
  let versions: Version[] = [];
  let selected: Version | null = null;

  const showDiff = (v: Version) => {
    selected = v;
    const current = hooks.getText();
    const lines = diffLines(v.text, current);
    const changed = lines.filter((l) => l.kind !== "same").length;
    head.textContent = "";
    head.append(
      h("b", { text: v.label || (v.manual ? "Versão marcada" : "Versão automática") }),
      h("span", { class: "muted", text: ` · ${when(v.at)} (${ago(v.at)}) · ${v.text.length} caracteres` })
    );
    q("[data-legend]").textContent = changed ? "Vermelho: estava nesta versão e saiu · Verde: entrou depois" : "Esta versão é igual ao texto atual.";
    diffEl.textContent = "";
    // mostra só as linhas que mudaram, com um pouco de contexto
    const keep = new Set<number>();
    lines.forEach((l, i) => {
      if (l.kind !== "same") for (let k = Math.max(0, i - 2); k <= Math.min(lines.length - 1, i + 2); k++) keep.add(k);
    });
    let gap = false;
    lines.forEach((l, i) => {
      if (changed && !keep.has(i)) {
        if (!gap) diffEl.append(h("div", { class: "df skip", text: "⋯" }));
        gap = true;
        return;
      }
      gap = false;
      diffEl.append(h("div", { class: `df ${l.kind}`, text: (l.kind === "add" ? "+ " : l.kind === "del" ? "− " : "  ") + (l.text || " ") }));
    });
    if (!changed) diffEl.append(h("div", { class: "df skip", text: "Nenhuma diferença." }));
    btn.copy.disabled = btn.del.disabled = btn.restore.disabled = false;
    items.querySelectorAll<HTMLElement>(".hi-item").forEach((e) => e.classList.toggle("active", e.dataset.id === String(v.id)));
  };

  const paintList = () => {
    items.textContent = "";
    if (!versions.length) {
      items.append(h("div", { class: "sb-note", text: "Ainda não há versões deste documento. Elas aparecem sozinhas conforme você escreve e salva." }));
      return;
    }
    for (const v of versions) {
      const row = h("button", { class: "hi-item", type: "button", "data-id": String(v.id) });
      row.append(
        h("span", { class: "hi-t", text: v.label || (v.manual ? "Versão marcada" : "Automática") }),
        h("span", { class: "hi-s", text: `${when(v.at)} · ${ago(v.at)}` })
      );
      if (v.manual) row.classList.add("manual");
      row.addEventListener("click", () => showDiff(v));
      items.append(row);
    }
  };

  const reload = async (select?: number) => {
    versions = await listVersions(hooks.doc);
    paintList();
    const pick = versions.find((v) => v.id === select) ?? versions[0];
    if (pick) showDiff(pick);
  };
  void reload();

  q("[data-save]").addEventListener("click", async () => {
    const input = q<HTMLInputElement>("[data-name]");
    const text = hooks.getText();
    const ok = await snapshot(hooks.doc, text, { manual: true, label: input.value.trim() || undefined, max: hooks.max });
    toast(ok ? "Versão salva no histórico." : "Esse texto já está salvo no histórico.", ok ? "ok" : "info", 2600);
    input.value = "";
    await reload();
  });
  btn.restore.addEventListener("click", async () => {
    if (!selected) return;
    // guarda o texto de agora antes de trocar, para nunca perder nada
    await snapshot(hooks.doc, hooks.getText(), { manual: true, label: "Antes de restaurar", max: hooks.max, force: true });
    hooks.restore(selected.text);
    toast("Versão restaurada. Ctrl+Z desfaz.", "ok", 3600);
    close();
  });
  btn.copy.addEventListener("click", async () => {
    if (selected) toast((await copyText(selected.text)) ? "Texto da versão copiado." : "Não foi possível copiar.", "info", 2200);
  });
  btn.del.addEventListener("click", async () => {
    if (!selected?.id) return;
    await removeVersion(selected.id);
    selected = null;
    btn.copy.disabled = btn.del.disabled = btn.restore.disabled = true;
    diffEl.textContent = "";
    await reload();
  });

  const close = () => {
    document.removeEventListener("keydown", onKey, true);
    backdrop.remove();
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      close();
    }
  };
  document.addEventListener("keydown", onKey, true);
  backdrop.addEventListener("mousedown", (e) => {
    if (e.target === backdrop) close();
  });
  modal.querySelectorAll("[data-close]").forEach((b) => b.addEventListener("click", close));
}
