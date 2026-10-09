// Revisão inteligente: procura palavras repetidas no documento todo e mostra as trocas sugeridas como diff, com o motivo.
// Funciona em Markdown e em Word. Roda em segundo plano, em fatias, só com o computador ocioso (broker/deep/scheduler.ts).

import type { App } from "./app";
import { maskNonProse } from "../broker/mask";
import { analyzeDeep, type DeepResult, type Proposal, type Segment } from "../broker/deep/analyze";
import { runSliced } from "../broker/deep/scheduler";
import { loadThesaurus } from "../broker/deep/thesaurus";
import { openDeepPanel } from "../broker/deep/panel";
import { refineWithLm } from "../broker/deep/refine";
import { acceptedTotal } from "../broker/personal/feedback";
import { getLanguageModel, loadLanguageModel } from "../broker/ghost/model";
import { toast } from "../util";

/** Aceitou quantas sugestões de palavras desde a última revisão para o app oferecer uma nova. */
const OFFER_AFTER_ACCEPTS = 12;
const MIN_WORDS_AUTO = 250;
const TICK_MS = 60_000;

/** Impressão digital barata do texto (para saber se a análise guardada ainda vale). */
function fingerprint(text: string): string {
  let h = 0;
  for (let i = 0; i < text.length; i += 7) h = (h * 31 + text.charCodeAt(i)) | 0;
  return `${text.length}:${h}`;
}

export const deepReviewMethods = {
  /** Os trechos de texto do documento aberto, com a posição de cada um. */
  deepSegments(this: App): Segment[] {
    if (this.tab.kind === "word") return this.wordHost.deepSegments();
    return [{ text: maskNonProse(this.editor.getText()), base: 0 }];
  },

  /** Faz (ou reaproveita) a análise do documento aberto. `background`: espera a pessoa ficar parada. */
  async computeDeep(this: App, broad: boolean, background = false): Promise<DeepResult | null> {
    await Promise.all([loadLanguageModel(), loadThesaurus()]);
    if (!getLanguageModel()) return null;
    const segments = this.deepSegments();
    const key = `${this.tab.id}|${broad}|${fingerprint(segments.map((s) => s.text).join("\n"))}`;
    if (this.deepCache?.key === key) return this.deepCache.result;
    const job = runSliced(analyzeDeep(segments, { includeBroad: broad }), { background });
    const result = await job.promise;
    // segunda opinião da IA local (só na GPU; sem ela, as trocas ficam como as regras propuseram)
    if (result) await refineWithLm(result, { background });
    if (result) this.deepCache = { key, result };
    return result;
  },

  /** Abre a tela da revisão inteligente. */
  openDeepReview(this: App): void {
    if (this.deepHandle) return;
    if (this.tab.kind === "settings") {
      toast("Abra um documento para fazer a revisão inteligente.", "info", 2800);
      return;
    }
    const isWord = this.tab.kind === "word";
    this.deepHandle = openDeepPanel({
      compute: (broad) => this.computeDeep(broad),
      check: (p: Proposal) => (isWord ? this.wordHost.editor.getDoc().textBetween(p.from, p.to) : this.editor.getText().slice(p.from, p.to)) === p.original,
      apply: (p: Proposal) => {
        if (isWord) this.wordHost.editor.replaceText(p.from, p.to, p.replacement);
        else this.editor.replaceRange(p.from, p.to, p.replacement);
      },
      goTo: (p: Proposal) => {
        if (isWord) this.wordHost.editor.scrollToPos(p.from);
        else this.editor.gotoRange(p.from, p.to);
      },
      onClose: () => {
        this.deepHandle = null;
        this.deepDirty = true;
        this.updateDeepBadge(0);
      },
    });
    this.deepLastAccepted = acceptedTotal();
  },

  /** Mostra (ou esconde) o aviso discreto "Revisão inteligente: N sugestões" na barra de baixo. */
  updateDeepBadge(this: App, n: number): void {
    const el = document.querySelector<HTMLButtonElement>("#st-deep");
    if (!el) return;
    el.hidden = n <= 0;
    el.textContent = n > 0 ? `Revisão inteligente: ${n} ${n === 1 ? "sugestão" : "sugestões"}` : "";
  },

  /**
   * De minuto em minuto: se a pessoa já aceitou várias sugestões de palavras e o texto está grande, analisa o documento
   * em segundo plano (só com o computador parado) e avisa, sem interromper, que há sugestões de revisão.
   */
  startDeepWatcher(this: App): void {
    setInterval(() => void this.deepTick(), TICK_MS);
  },

  async deepTick(this: App): Promise<void> {
    if (!this.copilot || this.deepHandle || this.deepRunning || this.tab.kind === "settings") return;
    const accepted = acceptedTotal();
    if (accepted - this.deepLastAccepted < OFFER_AFTER_ACCEPTS) return;
    const text = this.tab.kind === "word" ? this.wordHost.text() : this.editor.getText();
    if (text.split(/\s+/).length < MIN_WORDS_AUTO) return;
    this.deepRunning = true;
    try {
      const result = await this.computeDeep(false, true);
      this.deepLastAccepted = accepted;
      const n = result?.groups.reduce((a, g) => a + g.proposals.length, 0) ?? 0;
      this.updateDeepBadge(n);
    } finally {
      this.deepRunning = false;
    }
  },
};
