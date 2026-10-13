// Tela do Histórico: três abas.
//
//  · Versões   — cópias completas guardadas dentro do app (a cada 5 min e ao salvar)
//  · Alterações — linha do tempo dos commits: o patch de cada mudança, com o diff
//  · Backup    — as cópias reais em disco, que sobrevivem a limpar os dados do app
import { diffLines, listVersions, removeVersion, snapshot, type Version } from "./history";
import * as backup from "./backup";
import { applyOps, listCommits, removeCommit, type Commit } from "./snapshots";
import { copyText, h, toast } from "./util";

export interface HistoryHooks {
  doc: string;
  title: string;
  getText: () => string;
  /** Converte o texto guardado numa versão em texto legível (documentos Word guardam JSON). */
  project?: (text: string) => string;
  max: number;
  /** Troca o texto do editor pela versão escolhida (uma ação só, dá para desfazer com Ctrl+Z). */
  restore: (text: string) => void;
  /**
   * O arquivo em disco mudou por fora do editor (restauração de uma cópia de backup).
   * Recarrega o documento aberto, senão o salvamento automático sobrescreveria a cópia.
   */
  reloadFromDisk?: () => Promise<void>;
  /** Aba que abre à frente (as Configurações levam direto para a aba certa). */
  abaInicial?: AbaHistorico;
}

/** As três camadas do histórico: cópias no app, log de mudanças e cópias em disco. */
export type AbaHistorico = "versoes" | "alteracoes" | "backup";

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

/** Data/hora a partir do carimbo do nome do arquivo (`2026-10-09_10-42-13`). */
function whenStamp(stamp: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})_(\d{2})-(\d{2})-(\d{2})/.exec(stamp);
  if (!m) return stamp;
  return `${m[3]}/${m[2]}/${m[1]} às ${m[4]}:${m[5]}`;
}

/** Escreve o diff colorido (vermelho saiu / verde entrou) num elemento. */
function pintarDiff(el: HTMLElement, antigo: string, novo: string, vazio: string): void {
  const lines = diffLines(antigo, novo);
  const changed = lines.filter((l) => l.kind !== "same").length;
  el.textContent = "";
  if (!changed) {
    el.append(h("div", { class: "df skip", text: vazio }));
    return;
  }
  // mostra só o que mudou, com um pouco de contexto
  const keep = new Set<number>();
  lines.forEach((l, i) => {
    if (l.kind !== "same") for (let k = Math.max(0, i - 2); k <= Math.min(lines.length - 1, i + 2); k++) keep.add(k);
  });
  let gap = false;
  lines.forEach((l, i) => {
    if (!keep.has(i)) {
      if (!gap) el.append(h("div", { class: "df skip", text: "⋯" }));
      gap = true;
      return;
    }
    gap = false;
    el.append(h("div", { class: `df ${l.kind}`, text: (l.kind === "add" ? "+ " : l.kind === "del" ? "− " : "  ") + (l.text || " ") }));
  });
}

export function openHistoryDialog(hooks: HistoryHooks): void {
  if (document.querySelector(".history-modal")) return;
  const backdrop = h("div", { class: "modal-backdrop" });
  const modal = h("div", { class: "modal history-modal" });
  modal.innerHTML = `
    <header class="wm-head">
      <svg class="ic"><use href="#i-clock"/></svg>
      <h2>Histórico — ${hooks.title.replace(/[<&]/g, "")}</h2>
      <div class="hi-tabs">
        <button class="hi-tab active" data-tab="versoes">Versões</button>
        <button class="hi-tab" data-tab="alteracoes">Alterações</button>
        <button class="hi-tab" data-tab="backup">Backup</button>
      </div>
      <button class="btn icon" data-close title="Fechar (Esc)"><svg class="ic"><use href="#i-close"/></svg></button>
    </header>
    <div class="hi-body">
      <aside class="hi-list">
        <div class="hi-save" data-pane="versoes">
          <input type="text" data-name placeholder="Nome da versão (opcional)" spellcheck="false" />
          <button class="btn small primary" data-save>Salvar versão agora</button>
        </div>
        <div class="hi-items" data-items></div>
      </aside>
      <section class="hi-view">
        <div class="hi-head" data-head><span class="muted">Escolha uma versão para ver o que mudou.</span></div>
        <div class="hi-info" data-info hidden></div>
        <div class="hi-diff" data-diff></div>
      </section>
    </div>
    <footer class="wm-foot">
      <span class="muted" data-legend></span>
      <span class="dr-spacer"></span>
      <button class="btn" data-copy disabled>Copiar texto</button>
      <button class="btn" data-del disabled>Excluir</button>
      <button class="btn primary" data-restore disabled>Restaurar</button>
    </footer>`;
  backdrop.append(modal);
  document.body.append(backdrop);

  const q = <T extends HTMLElement>(s: string) => modal.querySelector<T>(s)!;
  const items = q("[data-items]");
  const diffEl = q("[data-diff]");
  const head = q("[data-head]");
  const info = q("[data-info]");
  const legend = q("[data-legend]");
  const btn = {
    copy: q<HTMLButtonElement>("[data-copy]"),
    del: q<HTMLButtonElement>("[data-del]"),
    restore: q<HTMLButtonElement>("[data-restore]"),
    save: q<HTMLButtonElement>("[data-save]"),
  };
  const view = hooks.project ?? ((t: string) => t);
  type Aba = AbaHistorico;
  let atual: Aba = hooks.abaInicial ?? "versoes";
  let versions: Version[] = [];
  let commits: Commit[] = [];
  let arquivosBackup: backup.BackupEntry | null = null;
  let selecionadoId: number | null = null;
  let selecionadaCopia: backup.BackupFile | null = null;

  const pararBotoes = () => {
    btn.copy.disabled = btn.del.disabled = btn.restore.disabled = true;
  };

  // ---------- abas ----------

  const trocarAba = (nome: Aba) => {
    atual = nome;
    selecionadoId = null;
    selecionadaCopia = null;
    pararBotoes();
    diffEl.textContent = "";
    info.hidden = true;
    modal.querySelectorAll<HTMLElement>(".hi-tab").forEach((b) => b.classList.toggle("active", b.dataset.tab === nome));
    q("[data-pane]").hidden = nome !== "versoes";
    legend.textContent = "";
    void carregar();
  };
  modal.querySelectorAll<HTMLElement>(".hi-tab").forEach((b) =>
    b.addEventListener("click", () => trocarAba(b.dataset.tab as Aba))
  );

  // ---------- versões ----------

  const pintarVersoes = () => {
    items.textContent = "";
    if (!versions.length) {
      items.append(
        h("div", { class: "sb-note", text: "Ainda não há versões deste documento. Elas aparecem sozinhas conforme você escreve e salva." })
      );
      return;
    }
    for (const v of versions) {
      const row = h("button", { class: "hi-item", type: "button", "data-id": String(v.id) });
      row.append(
        h("span", { class: "hi-t", text: v.label || (v.manual ? "Versão marcada" : "Automática") }),
        h("span", { class: "hi-s", text: `${when(v.at)} · ${ago(v.at)}` })
      );
      if (v.manual) row.classList.add("manual");
      row.addEventListener("click", () => mostrarVersao(v));
      items.append(row);
    }
  };

  const mostrarVersao = (v: Version) => {
    selecionadoId = v.id ?? null;
    const atualTexto = view(hooks.getText());
    pintarDiff(diffEl, view(v.text), atualTexto, "Esta versão é igual ao texto atual.");
    head.textContent = "";
    head.append(
      h("b", { text: v.label || (v.manual ? "Versão marcada" : "Versão automática") }),
      h("span", { class: "muted", text: ` · ${when(v.at)} (${ago(v.at)}) · ${view(v.text).length} caracteres` })
    );
    legend.textContent = "Vermelho: estava nesta versão e saiu · Verde: entrou depois";
    btn.copy.disabled = btn.del.disabled = btn.restore.disabled = false;
    items.querySelectorAll<HTMLElement>(".hi-item").forEach((e) => e.classList.toggle("active", e.dataset.id === String(v.id)));
  };

  const carregarVersoes = async () => {
    versions = await listVersions(hooks.doc);
    pintarVersoes();
    const pick = versions.find((v) => v.id === selecionadoId) ?? versions[0];
    if (pick) mostrarVersao(pick);
    else head.innerHTML = `<span class="muted">Escolha uma versão para ver o que mudou.</span>`;
  };

  // ---------- alterações (commits) ----------

  /** Texto do documento tal como estava num commit (aplica os patches desde a âncora). */
  const textoDoCommit = (indice: number): string => {
    let base = "";
    let j = indice;
    while (j >= 0) {
      if (commits[j].text !== undefined) {
        base = commits[j].text!;
        break;
      }
      j--;
    }
    if (j < 0) {
      for (let k = indice + 1; k < commits.length; k++) if (commits[k].text !== undefined) return commits[k].text!;
      return "";
    }
    let texto = base;
    for (let k = j + 1; k <= indice; k++) texto = applyOps(texto, commits[k].ops);
    return texto;
  };

  const pintarCommits = () => {
    items.textContent = "";
    if (!commits.length) {
      items.append(
        h("div", { class: "sb-note", text: "Ainda não há alterações registradas. Cada tecla que mudar o texto aparece aqui como uma linha do tempo." })
      );
      return;
    }
    // do mais novo para o mais antigo; âncora marcada
    for (let i = commits.length - 1; i >= 0; i--) {
      const c = commits[i];
      const row = h("button", { class: "hi-item", type: "button", "data-id": String(c.id) });
      row.append(
        h("span", { class: "hi-t", text: c.text !== undefined ? "📌 Marco do documento" : c.summary }),
        h("span", { class: "hi-s", text: `${when(c.at)} · ${ago(c.at)}` })
      );
      if (c.text !== undefined) row.classList.add("manual");
      row.addEventListener("click", () => mostrarCommit(i));
      items.append(row);
    }
  };

  const mostrarCommit = (i: number) => {
    const c = commits[i];
    selecionadoId = c.id ?? null;
    // mostra o diff entre o commit anterior e este
    const anterior = i > 0 ? textoDoCommit(i - 1) : "";
    const este = textoDoCommit(i);
    pintarDiff(diffEl, view(anterior), view(este), "Este marco guarda o documento inteiro.");
    head.textContent = "";
    head.append(
      h("b", { text: c.text !== undefined ? "📌 Marco do documento" : "Alteração" }),
      h("span", { class: "muted", text: ` · ${when(c.at)} (${ago(c.at)}) · ${c.text !== undefined ? "texto completo" : c.summary}` })
    );
    legend.textContent = "Vermelho: saiu nesta alteração · Verde: entrou nela";
    btn.copy.disabled = false;
    btn.del.disabled = c.id === undefined;
    btn.restore.disabled = false;
    items.querySelectorAll<HTMLElement>(".hi-item").forEach((e) => e.classList.toggle("active", e.dataset.id === String(c.id)));
  };

  const carregarCommits = async () => {
    commits = await listCommits(hooks.doc);
    pintarCommits();
    if (commits.length) mostrarCommit(commits.length - 1);
    else head.innerHTML = `<span class="muted">Escolha uma alteração para ver o que mudou.</span>`;
  };

  // ---------- backup em disco ----------

  const pintarBackup = () => {
    items.textContent = "";
    const copias = arquivosBackup?.copies ?? [];
    if (!copias.length) {
      items.append(
        h("div", {
          class: "sb-note",
          text: "Ainda não há cópias em disco deste documento. Elas são gravadas ao salvar, ao trocar de aba e uma vez por dia.",
        })
      );
      return;
    }
    for (const c of copias) {
      const row = h("button", { class: "hi-item", type: "button", "data-name": c.name });
      row.append(
        h("span", { class: "hi-t", text: c.protection ? "Cópia de proteção" : "Cópia" }),
        h("span", { class: "hi-s", text: `${whenStamp(c.stamp)} · ${backup.tamanhoLegivel(c.bytes)}` })
      );
      if (c.protection) row.classList.add("manual");
      row.addEventListener("click", () => mostrarCopia(c));
      items.append(row);
    }
  };

  const mostrarCopia = (c: backup.BackupFile) => {
    selecionadaCopia = c;
    head.textContent = "";
    head.append(
      h("b", { text: c.protection ? "Cópia de proteção" : "Cópia em disco" }),
      h("span", { class: "muted", text: ` · ${whenStamp(c.stamp)} · ${backup.tamanhoLegivel(c.bytes)}` })
    );
    // o conteúdo não é lido aqui (é binário no caso do Word): mostra as informações
    info.hidden = false;
    info.textContent = "";
    info.append(
      h("div", { class: "bk-linha" }, [
        h("span", { class: "bk-rotulo", text: "Arquivo" }),
        h("code", { text: c.name }),
      ]),
      h("div", { class: "bk-linha" }, [
        h("span", { class: "bk-rotulo", text: "Pasta" }),
        h("code", { text: c.root }),
      ]),
      h("div", { class: "bk-linha" }, [
        h("span", { class: "bk-rotulo", text: "Tamanho" }),
        h("span", { text: backup.tamanhoLegivel(c.bytes) }),
      ])
    );
    diffEl.textContent = "";
    diffEl.append(
      h("div", {
        class: "df skip",
        text: "Restaurar devolve esta cópia para o arquivo original. O que está lá agora é guardado antes, então nada se perde.",
      })
    );
    legend.textContent = "As cópias ficam espelhadas na pasta que você escolheu e na pasta do próprio app";
    btn.copy.disabled = true;
    btn.del.disabled = false;
    btn.restore.disabled = false;
    items.querySelectorAll<HTMLElement>(".hi-item").forEach((e) => e.classList.toggle("active", e.dataset.name === c.name));
  };

  const carregarBackup = async () => {
    arquivosBackup = await backup.listar(hooks.doc);
    pintarBackup();
    if (arquivosBackup.copies.length) mostrarCopia(arquivosBackup.copies[0]);
    else head.innerHTML = `<span class="muted">Escolha uma cópia para ver os detalhes.</span>`;
    const total = backup.tamanhoLegivel(arquivosBackup.bytes);
    legend.textContent = arquivosBackup.copies.length
      ? `${arquivosBackup.copies.length} cópia(s) · ${total} guardado(s)`
      : "";
  };

  // ---------- carga geral ----------

  const carregar = async () => {
    if (atual === "versoes") await carregarVersoes();
    else if (atual === "alteracoes") await carregarCommits();
    else await carregarBackup();
  };
  // abre já na aba pedida (as Configurações levam direto para Versões, Alterações ou Backup)
  trocarAba(atual);

  // ---------- ações ----------

  q("[data-save]").addEventListener("click", async () => {
    const input = q<HTMLInputElement>("[data-name]");
    const text = hooks.getText();
    const ok = await snapshot(hooks.doc, text, { manual: true, label: input.value.trim() || undefined, max: hooks.max });
    toast(ok ? "Versão salva no histórico." : "Esse texto já está salvo no histórico.", ok ? "ok" : "info", 2600);
    input.value = "";
    await carregarVersoes();
  });

  btn.restore.addEventListener("click", async () => {
    if (atual === "versoes") {
      const v = versions.find((x) => x.id === selecionadoId);
      if (!v) return;
      // guarda o texto de agora antes de trocar, para nunca perder nada
      await snapshot(hooks.doc, hooks.getText(), { manual: true, label: "Antes de restaurar", max: hooks.max, force: true });
      hooks.restore(v.text);
      toast("Versão restaurada. Ctrl+Z desfaz.", "ok", 3600);
      close();
      return;
    }
    if (atual === "alteracoes") {
      const i = commits.findIndex((x) => x.id === selecionadoId);
      if (i < 0) return;
      await snapshot(hooks.doc, hooks.getText(), { manual: true, label: "Antes de restaurar", max: hooks.max, force: true });
      hooks.restore(textoDoCommit(i));
      toast("Alteração restaurada. Ctrl+Z desfaz.", "ok", 3600);
      close();
      return;
    }
    if (atual === "backup" && selecionadaCopia) {
      try {
        await backup.restaurar(hooks.doc, selecionadaCopia.root, selecionadaCopia.name);
        // o arquivo em disco agora é o da cópia: recarrega para o editor não sobrescrevê-lo
        if (hooks.reloadFromDisk) await hooks.reloadFromDisk();
        toast("Cópia restaurada no arquivo original.", "ok", 3600);
        close();
      } catch (e) {
        toast("Não foi possível restaurar: " + e, "err", 6000);
      }
    }
  });

  btn.copy.addEventListener("click", async () => {
    if (atual === "versoes") {
      const v = versions.find((x) => x.id === selecionadoId);
      if (v) toast((await copyText(view(v.text))) ? "Texto da versão copiado." : "Não foi possível copiar.", "info", 2200);
      return;
    }
    if (atual === "alteracoes") {
      const i = commits.findIndex((x) => x.id === selecionadoId);
      if (i >= 0) toast((await copyText(view(textoDoCommit(i)))) ? "Texto copiado." : "Não foi possível copiar.", "info", 2200);
    }
  });

  btn.del.addEventListener("click", async () => {
    if (atual === "versoes" && selecionadoId !== null) {
      await removeVersion(selecionadoId);
      selecionadoId = null;
      pararBotoes();
      await carregarVersoes();
      return;
    }
    if (atual === "alteracoes" && selecionadoId !== null) {
      const c = commits.find((x) => x.id === selecionadoId);
      if (!c || c.text !== undefined) {
        toast("Os marcos de documento não são apagados.", "info", 3000);
        return;
      }
      await removeCommit(selecionadoId);
      selecionadoId = null;
      pararBotoes();
      await carregarCommits();
      return;
    }
    if (atual === "backup" && selecionadaCopia) {
      try {
        await backup.apagarCopia(hooks.doc, selecionadaCopia.root, selecionadaCopia.name);
        selecionadaCopia = null;
        pararBotoes();
        await carregarBackup();
        toast("Cópia apagada.", "info", 2400);
      } catch (e) {
        toast("Não foi possível apagar: " + e, "err", 5000);
      }
    }
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
