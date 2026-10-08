// Painel de revisão do texto: ortografia, estilo, sinônimos e estatísticas.
import { h } from "../util";
import { synonymsFor, type WritingIssue, type WritingStats } from "./writing";

export interface ReviewOptions {
  issues: WritingIssue[];
  stats: WritingStats;
  onGoTo: (issue: WritingIssue) => void;
  onFix: (issue: WritingIssue) => void;
  onFixAllStyle: () => void;
  onIgnore: (word: string) => void;
  onRecheck: () => void;
  onClose?: () => void;
}

export interface ReviewHandle {
  close(): void;
  refresh(issues: WritingIssue[], stats: WritingStats): void;
}

export function openReviewModal(opts: ReviewOptions): ReviewHandle {
  const backdrop = h("div", { class: "modal-backdrop" });
  const modal = h("div", { class: "modal rv-modal" });
  modal.innerHTML = `
    <header class="wm-head">
      <svg class="ic"><use href="#i-check"/></svg>
      <h2>Revisar texto</h2>
      <span class="muted rv-sub">Corretor de português + sugestões de palavras</span>
      <button class="btn icon" data-close title="Fechar (Esc)"><svg class="ic"><use href="#i-close"/></svg></button>
    </header>
    <div class="rv-body">
      <div class="rv-stats"></div>
      <div class="rv-words"></div>
      <div class="rv-list"></div>
    </div>
    <footer class="wm-foot">
      <button class="btn" data-recheck>Revisar de novo</button>
      <span class="dr-spacer"></span>
      <button class="btn" data-fix-all>Corrigir tudo</button>
      <button class="btn primary" data-close>Fechar</button>
    </footer>`;
  backdrop.append(modal);
  document.body.append(backdrop);

  const statsHost = modal.querySelector<HTMLElement>(".rv-stats")!;
  const wordsHost = modal.querySelector<HTMLElement>(".rv-words")!;
  const listHost = modal.querySelector<HTMLElement>(".rv-list")!;

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
  backdrop.addEventListener("mousedown", (e) => {
    if (e.target === backdrop) close();
  });
  modal.querySelectorAll<HTMLElement>("[data-close]").forEach((b) => b.addEventListener("click", close));
  modal.querySelector<HTMLElement>("[data-recheck]")!.addEventListener("click", () => opts.onRecheck());
  modal.querySelector<HTMLElement>("[data-fix-all]")!.addEventListener("click", () => opts.onFixAllStyle());

  const chip = (text: string, title: string, onClick: () => void, ghost = false): HTMLElement => {
    const b = h("button", { class: ghost ? "cm-issue-chip ghost" : "cm-issue-chip", type: "button", text, title });
    b.addEventListener("click", (e) => {
      e.stopPropagation();
      onClick();
    });
    return b;
  };

  const render = (issues: WritingIssue[], stats: WritingStats) => {
    // resumo
    statsHost.innerHTML = "";
    const cards: [string, string][] = [
      ["Palavras", String(stats.words)],
      ["Frases", String(stats.sentences)],
      ["Média por frase", `${stats.avgWordsPerSentence} palavras`],
      ["Frases longas", String(stats.longSentences)],
      ["Avisos", String(issues.length)],
    ];
    for (const [label, value] of cards) {
      statsHost.append(h("div", { class: "rv-card" }, [h("span", { class: "rv-card-value", text: value }), h("span", { class: "rv-card-label", text: label })]));
    }

    // palavras repetidas (com sinônimos)
    wordsHost.innerHTML = "";
    const repeated = stats.repeated.filter((r) => synonymsFor(r.word).length || r.count >= 6);
    if (repeated.length) {
      wordsHost.append(h("h3", { text: "Palavras repetidas — que tal variar?" }));
      for (const item of repeated) {
        const row = h("div", { class: "rv-word-row" });
        row.append(h("span", { class: "rv-word", text: `${item.word} (${item.count}×)` }));
        for (const syn of synonymsFor(item.word).slice(0, 4)) {
          row.append(
            chip(syn, `Trocar a primeira ocorrência de “${item.word}”`, () =>
              opts.onFix({ from: item.from, to: item.to, word: item.word, kind: "style", message: "", suggestions: [], fix: syn })
            )
          );
        }
        wordsHost.append(row);
      }
    }

    // lista de avisos
    listHost.innerHTML = "";
    if (!issues.length) {
      listHost.append(h("div", { class: "rv-empty", text: "Nada encontrado — texto limpo! 🎉" }));
      return;
    }
    const spell = issues.filter((i) => i.kind === "spell");
    const style = issues.filter((i) => i.kind === "style");
    const section = (title: string, list: WritingIssue[], kind: string) => {
      if (!list.length) return;
      const head = h("h3", { class: "rv-section", text: `${title} (${list.length})` });
      listHost.append(head);
      for (const issue of list.slice(0, 60)) {
        const row = h("div", { class: `rv-item ${kind}` });
        const text = h("div", { class: "rv-item-text" });
        text.append(h("b", { text: issue.word }));
        text.append(h("span", { text: ` — ${issue.message}` }));
        row.append(text);
        const actions = h("div", { class: "rv-item-actions" });
        if (issue.fix) {
          actions.append(chip(`Corrigir: ${issue.fix}`, "Aplicar a correção", () => opts.onFix(issue)));
        }
        for (const s of issue.suggestions.slice(0, issue.fix ? 0 : 4)) {
          actions.append(chip(s, `Trocar por “${s}”`, () => opts.onFix({ ...issue, fix: s })));
        }
        actions.append(chip("Ir", "Ir para o trecho no editor", () => opts.onGoTo(issue), true));
        if (issue.kind === "spell") {
          actions.append(chip("Ignorar", "Não avisar mais sobre esta palavra", () => opts.onIgnore(issue.word), true));
        }
        row.append(actions);
        listHost.append(row);
      }
    };
    section("Ortografia", spell, "spell");
    section("Estilo e gramática", style, "style");
  };

  render(opts.issues, opts.stats);

  return {
    close,
    refresh: (issues, stats) => render(issues, stats),
  };
}
