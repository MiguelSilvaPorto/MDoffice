// Tradução automática ao vivo: o texto continua em português no editor, e a pré-visualização
// ganha uma versão em inglês que acompanha a digitação (só os trechos alterados são re-traduzidos).
import { Preview } from "./preview";
import {
  OfflineEngine,
  QuotaError,
  TranslationCache,
  maskInline,
  myMemoryProvider,
  planBlocks,
  planMarkdown,
  polishEnglish,
  renderPlan,
  unmaskInline,
  type GlossaryEntry,
  type Plan,
  type Provider,
} from "./translate";
import { $, debounce, h, loadJSON, saveJSON, toast } from "./util";

export type ViewMode = "pt" | "en" | "both";
export type ProviderChoice = "auto" | "online" | "offline";

export interface TrSettings {
  enabled: boolean;
  view: ViewMode;
  layout: "cols" | "rows";
  provider: ProviderChoice;
  /** E-mail opcional: sobe o limite gratuito do tradutor online de 5 mil para 50 mil letras por dia. */
  email: string;
  /** Arruma o português (pontuação, formalidade) antes de traduzir. */
  polish: boolean;
  glossary: GlossaryEntry[];
}

const SETTINGS_KEY = "mdc.tr-settings";

const DEFAULTS: TrSettings = {
  enabled: false,
  view: "both",
  layout: "cols",
  provider: "auto",
  email: "",
  polish: true,
  glossary: [],
};

interface Prepared {
  key: string;
  masked: string;
  atoms: ReturnType<typeof maskInline>["atoms"];
  needs: boolean;
  /** O português ganhou um ponto final só para dar contexto; some da tradução. */
  stripPeriod: boolean;
  source: string;
  /** Português já arrumado (base do modo estrito). */
  polished: string;
}

/** Contagem dos marcadores Markdown: se mudar na tradução, ela perdeu negrito/link/etc. */
function markupSignature(s: string): string {
  const count = (rx: RegExp) => (s.match(rx) ?? []).length;
  const noBold = s.replace(/\*\*/g, "");
  return [count(/\*\*/g), count(/~~/g), (noBold.match(/\*/g) ?? []).length, count(/\]\(/g), count(/__/g)].join(",");
}

export interface TranslatedDoc {
  plan: Plan;
  pick: (seg: number) => string;
  markdown: string;
  /** Algum trecho ficou sem tradução (erro de rede, limite…). */
  incomplete: boolean;
}

export class Translation {
  readonly offline = new OfflineEngine();
  readonly previewEn: Preview;
  settings: TrSettings = { ...DEFAULTS, ...loadJSON<Partial<TrSettings>>(SETTINGS_KEY, {}) };
  private cache = new TranslationCache();
  private online: Provider;
  private run = 0;
  private abort: AbortController | null = null;
  private lastSegs: string[] = [];
  private lastPick: string[] = [];
  private lastMd = "";
  private error = "";
  private polishPt: (t: string) => string;

  constructor(opts: { polishPt: (t: string) => string; getMarkdown: () => string }) {
    this.polishPt = opts.polishPt;
    this.getMarkdown = opts.getMarkdown;
    this.online = myMemoryProvider(() => this.settings.email);
    this.previewEn = new Preview(
      $("#preview-en"),
      {
        onOpenLocalDoc: () => {},
        onSaveDrawing: async () => {},
        onRemoveDrawing: async () => {},
        onSaveTextBlock: () => false,
        onRemoveTextBlock: () => {},
        onEditMermaid: () => {},
        onToggleTask: () => {},
      },
      { readOnly: true }
    );
    this.offline.onStatus = () => this.updateStatus();
    this.bindUi();
    this.applyView();
  }

  private getMarkdown: () => string;

  // ---------- interface ----------

  private bindUi(): void {
    document.querySelectorAll<HTMLElement>("[data-lang-view]").forEach((b) =>
      b.addEventListener("click", () => this.setView(b.dataset.langView as ViewMode))
    );
    $("#tr-layout").addEventListener("click", () => {
      this.settings.layout = this.settings.layout === "cols" ? "rows" : "cols";
      this.save();
      this.applyView();
    });
  }

  private save(): void {
    saveJSON(SETTINGS_KEY, this.settings);
  }

  setView(v: ViewMode): void {
    this.settings.view = v;
    this.save();
    this.applyView();
  }

  setEnabled(on: boolean): void {
    this.settings.enabled = on;
    this.save();
    this.applyView();
    if (on) {
      if (this.provider().id === "offline" && this.offline.status.state === "idle") this.offline.warmUp();
      this.docChanged(this.getMarkdown(), true);
    } else {
      this.abort?.abort();
      this.run++;
    }
  }

  private applyView(): void {
    const s = this.settings;
    const b = document.body;
    b.classList.toggle("tr-on", s.enabled);
    b.classList.toggle("tr-rows", s.layout === "rows");
    for (const v of ["pt", "en", "both"]) b.classList.toggle(`tr-view-${v}`, s.enabled && s.view === v);
    $("#preview-bar").hidden = !s.enabled;
    $("#pv-en").hidden = !s.enabled || s.view === "pt";
    $("#pv-pt").hidden = s.enabled && s.view === "en";
    document.querySelectorAll<HTMLElement>(".pv-label").forEach((l) => (l.hidden = !(s.enabled && s.view === "both")));
    document.querySelectorAll<HTMLElement>("[data-lang-view]").forEach((x) => x.classList.toggle("active", x.dataset.langView === s.view));
    const btn = $("#btn-translate");
    btn.setAttribute("aria-pressed", String(s.enabled));
    btn.classList.toggle("on", s.enabled);
    this.updateStatus();
  }

  private setStatus(text: string, kind: "idle" | "busy" | "ok" | "err" = "idle"): void {
    const el = $("#tr-status");
    el.textContent = text;
    el.dataset.kind = kind;
  }

  private updateStatus(): void {
    if (!this.settings.enabled) return;
    const o = this.offline.status;
    if (this.provider().id === "offline" && o.state === "loading") this.setStatus(o.message, "busy");
    else if (this.error) this.setStatus(this.error, "err");
  }

  setDocPath(p: string | null): void {
    this.previewEn.setDocPath(p);
  }

  setDark(dark: boolean): void {
    this.previewEn.setDark(dark);
  }

  // ---------- motor ----------

  /** Provedor em uso agora (no modo automático: offline se o modelo já foi baixado). */
  private provider(): Provider {
    const c = this.settings.provider;
    if (c === "offline" || (c === "auto" && this.offline.downloaded)) return this.offline.provider();
    return this.online;
  }

  private fallbackProvider(current: Provider): Provider | null {
    if (this.settings.provider !== "auto") return null;
    if (current.id === "online") return this.offline.provider();
    return this.online;
  }

  private glossaryTag(): string {
    const g = this.settings.glossary.map((e) => `${e.pt}=${e.en}`).join(";");
    return `${this.settings.polish ? "p" : "n"}|${g}`;
  }

  private prepMemo = new Map<string, Prepared>();

  private prepare(text: string, provider: Provider): Prepared {
    const memoKey = `${provider.id}|${this.glossaryTag()}|${text}`;
    const hit = this.prepMemo.get(memoKey);
    if (hit) return hit;
    const made = this.prepareFresh(text, provider);
    if (this.prepMemo.size > 4000) this.prepMemo.clear();
    this.prepMemo.set(memoKey, made);
    return made;
  }

  private prepareFresh(text: string, provider: Provider): Prepared {
    const polished = this.settings.polish ? this.polishPt(text) : text;
    const stripPeriod = polished !== text && /\.$/.test(polished) && !/[.!?…:;]$/.test(text);
    const { masked, atoms } = maskInline(polished, this.settings.glossary);
    const needs = /\p{L}/u.test(masked.replace(/ZQ\d+Z/g, ""));
    return { key: `${provider.id}|${this.glossaryTag()}|${text}`, masked, atoms, needs, stripPeriod, source: text, polished };
  }

  private finish(p: Prepared, translated: string): string | null {
    const restored = unmaskInline(translated, p.atoms);
    if (restored === null) return null;
    // negrito, itálico ou link se perderam? usa o modo estrito (traduz só os pedaços de texto)
    const expected = unmaskInline(p.masked, p.atoms);
    if (expected !== null && markupSignature(expected) !== markupSignature(restored)) return null;
    let out = polishEnglish(restored);
    if (p.stripPeriod) out = out.replace(/\.$/, "");
    return out;
  }

  /** Quando a tradução perde um código protegido, traduz só os pedaços de texto e remonta. */
  private async translateByPieces(p: Prepared, provider: Provider, signal: AbortSignal): Promise<string> {
    const strict = maskInline(p.polished, this.settings.glossary, false, true);
    const pieces = strict.masked.split(/(ZQ\d+Z)/);
    const texts: number[] = [];
    pieces.forEach((s, i) => {
      if (!/^ZQ\d+Z$/.test(s) && /\p{L}/u.test(s)) texts.push(i);
    });
    const done = texts.length ? await provider.translate(texts.map((i) => pieces[i].trim()), signal) : [];
    texts.forEach((i, k) => (pieces[i] = ` ${done[k]} `));
    const out = unmaskInline(pieces.join(" ").replace(/ {2,}/g, " "), strict.atoms);
    const en = polishEnglish(out ?? p.source);
    return p.stripPeriod ? en.replace(/\.$/, "") : en;
  }

  /** Garante a tradução de tudo que falta; chama `onProgress` a cada lote concluído. */
  private async ensure(md: string, signal: AbortSignal, onProgress?: (done: number, total: number) => void): Promise<TranslatedDoc> {
    const plan = planMarkdown(md);
    let provider = this.provider();
    let prepared = plan.segs.map((t) => this.prepare(t, provider));
    const results = new Map<string, string>();
    const lookup = () => {
      for (const p of prepared) {
        if (!p.needs) continue;
        const hit = this.cache.get(p.key);
        if (hit !== undefined) results.set(p.key, hit);
      }
    };
    lookup();
    let incomplete = false;
    const pending = () => {
      const seen = new Set<string>();
      return prepared.filter((p) => p.needs && !results.has(p.key) && !seen.has(p.key) && seen.add(p.key));
    };
    let todo = pending();
    const total = todo.length;
    let done = 0;
    onProgress?.(0, total);

    while (todo.length) {
      if (signal.aborted) throw new DOMException("cancelado", "AbortError");
      const batch = todo.slice(0, provider.id === "offline" ? 4 : 6);
      try {
        const out = await provider.translate(batch.map((p) => p.masked), signal);
        for (let k = 0; k < batch.length; k++) {
          const p = batch[k];
          let en = this.finish(p, out[k] ?? "");
          if (en === null) en = await this.translateByPieces(p, provider, signal);
          results.set(p.key, en);
          this.cache.set(p.key, en);
        }
        this.error = "";
      } catch (e) {
        if ((e as Error).name === "AbortError") throw e;
        const alt = this.fallbackProvider(provider);
        if (alt) {
          this.setStatus(e instanceof QuotaError ? "Limite do tradutor online — passando para o modo offline…" : "Trocando de tradutor…", "busy");
          provider = alt;
          if (alt.id === "offline") this.offline.warmUp();
          prepared = plan.segs.map((t) => this.prepare(t, provider));
          lookup();
          todo = pending();
          continue;
        }
        this.error = e instanceof QuotaError ? `${e.message} Abra Ajustes e use o modo offline.` : (e as Error).message;
        incomplete = true;
        break;
      }
      done += batch.length;
      onProgress?.(Math.min(done, total), total);
      todo = pending();
    }

    const pickFn = (i: number): string => {
      const p = prepared[i];
      if (!p.needs) return plan.segs[i];
      return results.get(p.key) ?? plan.segs[i];
    };
    const unresolved = prepared.some((p) => p.needs && !results.has(p.key));
    return { plan, pick: pickFn, markdown: renderPlan(plan, pickFn), incomplete: incomplete || unresolved };
  }

  // ---------- tempo real ----------

  private debounced = debounce((md: string) => void this.live(md), 650);

  /** O texto em português mudou (ou a aba trocou): atualiza o inglês. */
  docChanged(md: string, immediate = false): void {
    if (!this.settings.enabled) return;
    this.lastMd = md;
    // mostra já o que dá (cache + tradução anterior) — a atualização vem logo depois
    this.paintInstant(md);
    if (immediate) void this.live(md);
    else this.debounced(md);
  }

  /** Desenha na hora o melhor inglês disponível sem chamar a rede. */
  private paintInstant(md: string): void {
    const plan = planMarkdown(md);
    const provider = this.provider();
    const same = plan.segs.length === this.lastSegs.length;
    const pick = (i: number): string => {
      const p = this.prepare(plan.segs[i], provider);
      if (!p.needs) return plan.segs[i];
      const hit = this.cache.get(p.key);
      if (hit !== undefined) return hit;
      return same && this.lastPick[i] !== undefined ? this.lastPick[i] : plan.segs[i];
    };
    void this.previewEn.render(renderPlan(plan, pick));
  }

  private async live(md: string): Promise<void> {
    if (!this.settings.enabled) return;
    this.abort?.abort();
    const ctrl = new AbortController();
    this.abort = ctrl;
    const my = ++this.run;
    this.setStatus("Traduzindo…", "busy");
    try {
      const doc = await this.ensure(md, ctrl.signal, (d, t) => {
        if (my !== this.run || !t) return;
        this.setStatus(`Traduzindo… ${d}/${t}`, "busy");
      });
      if (my !== this.run) return;
      this.lastSegs = doc.plan.segs;
      this.lastPick = doc.plan.segs.map((_, i) => doc.pick(i));
      void this.previewEn.render(doc.markdown);
      if (doc.incomplete && this.error) this.setStatus(this.error, "err");
      else this.setStatus(this.provider().id === "offline" ? "Inglês atualizado · offline" : "Inglês atualizado", "ok");
    } catch (e) {
      if ((e as Error).name !== "AbortError") this.setStatus((e as Error).message, "err");
    }
  }

  // ---------- exportação ----------

  /** Tradução completa do documento (espera terminar) — usada pelo exportador. */
  async translateDocument(md: string, onProgress?: (done: number, total: number) => void): Promise<TranslatedDoc> {
    const ctrl = new AbortController();
    return await this.ensure(md, ctrl.signal, onProgress);
  }

  /** Blocos PT/EN alinhados para o modo bilíngue. */
  blocks(doc: TranslatedDoc): { pt: string; en: string }[] {
    return planBlocks(doc.plan, doc.pick);
  }

  clearCache(): void {
    this.cache.clear();
    this.lastSegs = [];
    this.lastPick = [];
    toast("Memória de traduções limpa.", "info", 2400);
    if (this.settings.enabled) this.docChanged(this.getMarkdown(), true);
  }

  // ---------- ajustes ----------

  openSettings(): void {
    const s = this.settings;
    const backdrop = h("div", { class: "modal-backdrop" });
    const modal = h("div", { class: "modal tr-modal" });
    const off = this.offline;
    modal.innerHTML = `
      <header class="wm-head">
        <svg class="ic"><use href="#i-globe"/></svg>
        <h2>Tradução automática</h2>
        <button class="btn icon" data-close title="Fechar (Esc)"><svg class="ic"><use href="#i-close"/></svg></button>
      </header>
      <div class="wm-body tr-body">
        <section>
          <h4>Como traduzir</h4>
          <label class="tr-opt"><input type="radio" name="prov" value="auto"> <span><b>Automático</b> — usa o modo offline se ele já estiver instalado; senão o online.</span></label>
          <label class="tr-opt"><input type="radio" name="prov" value="online"> <span><b>Online (grátis)</b> — MyMemory. Rápido para começar, mas tem limite diário e qualidade média.</span></label>
          <label class="tr-opt"><input type="radio" name="prov" value="offline"> <span><b>Offline</b> — modelo rodando no seu PC, sem limite e sem internet (baixa ≈120 MB uma vez).</span></label>
          <div class="tr-offline">
            <button class="btn small" data-dl></button>
            <span class="muted" data-dl-status></span>
          </div>
          <label class="tr-field">E-mail para ampliar o limite do modo online (opcional)
            <input type="email" data-email placeholder="voce@exemplo.com" autocomplete="off" spellcheck="false">
          </label>
        </section>
        <section>
          <h4>Qualidade</h4>
          <label class="tr-opt"><input type="checkbox" data-polish> <span><b>Melhorar o português antes de traduzir</b> — corrige pontuação, maiúsculas, “a gente → nós” e linguagem informal para a tradução sair mais clara.</span></label>
        </section>
        <section>
          <h4>Glossário</h4>
          <p class="muted">Um termo por linha. <code>mdCreator</code> mantém o nome igual; <code>rascunho = draft</code> força a tradução.</p>
          <textarea data-gloss rows="6" spellcheck="false" placeholder="mdCreator&#10;rascunho = draft"></textarea>
        </section>
      </div>
      <footer class="wm-foot">
        <button class="btn" data-clear title="Apaga o que o app já traduziu e guardou">Limpar memória de traduções</button>
        <span class="dr-spacer"></span>
        <button class="btn primary" data-ok>Salvar</button>
      </footer>`;
    backdrop.append(modal);
    document.body.append(backdrop);

    modal.querySelectorAll<HTMLInputElement>('input[name="prov"]').forEach((r) => (r.checked = r.value === s.provider));
    (modal.querySelector("[data-email]") as HTMLInputElement).value = s.email;
    (modal.querySelector("[data-polish]") as HTMLInputElement).checked = s.polish;
    (modal.querySelector("[data-gloss]") as HTMLTextAreaElement).value = s.glossary.map((g) => (g.en ? `${g.pt} = ${g.en}` : g.pt)).join("\n");

    const dl = modal.querySelector<HTMLButtonElement>("[data-dl]")!;
    const dlStatus = modal.querySelector<HTMLElement>("[data-dl-status]")!;
    const paintOffline = () => {
      const st = off.status;
      if (st.state === "ready" || (off.downloaded && st.state === "idle")) {
        dl.textContent = "Modelo offline instalado";
        dl.disabled = true;
        dlStatus.textContent = "Pronto para usar sem internet.";
      } else if (st.state === "loading") {
        dl.textContent = "Baixando…";
        dl.disabled = true;
        dlStatus.textContent = st.message;
      } else {
        dl.textContent = "Baixar modelo offline";
        dl.disabled = false;
        dlStatus.textContent = st.state === "error" ? st.message : "Ainda não instalado.";
      }
    };
    paintOffline();
    const prev = off.onStatus;
    off.onStatus = (st) => {
      prev?.(st);
      paintOffline();
    };
    dl.addEventListener("click", () => {
      off.warmUp();
      paintOffline();
    });

    const close = () => {
      off.onStatus = prev;
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
    modal.querySelector("[data-close]")!.addEventListener("click", close);
    modal.querySelector("[data-clear]")!.addEventListener("click", () => this.clearCache());
    modal.querySelector("[data-ok]")!.addEventListener("click", () => {
      s.provider = (modal.querySelector('input[name="prov"]:checked') as HTMLInputElement)?.value as ProviderChoice;
      s.email = (modal.querySelector("[data-email]") as HTMLInputElement).value.trim();
      s.polish = (modal.querySelector("[data-polish]") as HTMLInputElement).checked;
      s.glossary = (modal.querySelector("[data-gloss]") as HTMLTextAreaElement).value
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean)
        .map((l) => {
          const i = l.indexOf("=");
          return i < 0 ? { pt: l, en: "" } : { pt: l.slice(0, i).trim(), en: l.slice(i + 1).trim() };
        })
        .filter((g) => g.pt);
      this.save();
      if (s.provider === "offline") off.warmUp();
      close();
      if (s.enabled) this.docChanged(this.getMarkdown(), true);
    });
  }
}
