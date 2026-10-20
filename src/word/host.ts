// Liga o motor do Word à tela: folha (página), fita, zoom, contagem de páginas e corretor.
// O App só conversa com esta classe; o resto do motor fica dentro de src/word.
import type { EditorState } from "prosemirror-state";
import type { Node as PMNode } from "prosemirror-model";
import { WordEditor } from "./editor";
import { Ribbon } from "./ribbon";
import { ghostPlugin } from "./ghost";
import { paginationPlugin, requestPagination, GAP_PX } from "./pagination";
import { spellPlugin } from "./spell";
import { emptyDoc, plainText } from "./schema";
import { CM_TO_PX, DEFAULT_SETUP, deserialize, pageSizeCm, pageSizePx, serialize, type PageSetup } from "./model";
import { outlineSource, type WordOutlineSource } from "./markdown";
import { h, toast, copyText } from "../util";

/** O que cada aba de documento Word guarda (texto, desfazer, página e rolagem). */
export interface WordTabData {
  state: EditorState;
  setup: PageSetup;
  scrollTop: number;
}

export interface WordHostOpts {
  pane: HTMLElement;
  getIgnore: () => Set<string>;
  ignoreHere: (word: string) => void;
  addToDictionary: (word: string) => void;
  spellEnabled: () => boolean;
  /** Sugestão de próximas palavras (texto fantasma) ligada? */
  ghostEnabled: () => boolean;
  /** O texto/formato mudou. */
  onChange: () => void;
  /** Contagens (palavras, páginas, página atual) mudaram. */
  onStatus: () => void;
  onFind?: () => void;
  onReplace?: () => void;
  onReview?: () => void;
  /** Formalizar o texto (prévia antes/depois) — a fita chama em Revisão → Formalizar. */
  onFormalizar?: () => void;
  onAddons?: () => void;
}

export interface WordStats {
  words: number;
  chars: number;
  pages: number;
  page: number;
  issues: number;
}

export class WordHost {
  readonly editor: WordEditor;
  private ribbon: Ribbon;
  private opts: WordHostOpts;
  private sheet: HTMLElement;
  private stage: HTMLElement;
  private holder: HTMLElement;
  private zoomEl: HTMLElement;
  private firstHeader: HTMLElement;
  private zoom = 1;
  private pages = 1;
  private issues = 0;
  private statusTimer = 0;
  private spell: ReturnType<typeof spellPlugin> | null = null;

  constructor(opts: WordHostOpts) {
    this.opts = opts;
    const q = <T extends HTMLElement>(sel: string) => opts.pane.querySelector<T>(sel)!;
    this.sheet = q("#wd-sheet");
    this.stage = q("#wd-stage");
    this.holder = q("#wd-holder");
    this.zoomEl = q("#wd-zoom");
    this.firstHeader = q(".wd-hdr-first");

    this.editor = new WordEditor(q("#word-editor"), {
      onChange: () => {
        this.opts.onChange();
        this.statusSoon();
      },
      onSelection: () => {
        this.ribbon?.update();
        this.statusSoon();
      },
      onImage: (url) => void this.insertImageData(url),
      earlyPlugins: () => [ghostPlugin({ enabled: () => this.opts.ghostEnabled() })],
      plugins: () => {
        this.spell = spellPlugin({
          getIgnore: () => this.opts.getIgnore(),
          ignoreHere: (w) => this.opts.ignoreHere(w),
          addToDictionary: (w) => this.opts.addToDictionary(w),
          enabled: () => this.opts.spellEnabled(),
          onCount: (n) => {
            this.issues = n;
            this.statusSoon();
          },
        });
        return [
          paginationPlugin({
            getSetup: () => this.editor.setup,
            onPages: (n) => {
              this.pages = n;
              this.statusSoon();
            },
          }),
          this.spell,
        ];
      },
    });

    // O clique direito NÃO abre o menu do navegador (Emoji, Inspecionar, Direção da escrita): o
    // Word usa o menu do app, como o editor MD*. Sem seleção não há o que oferecer — o nativo fica
    // suprimido de qualquer jeito (o relato com print mostrava o menu do WebView2).
    q("#word-editor").addEventListener("contextmenu", (e) => {
      e.preventDefault();
      const { from, to } = this.editor.view.state.selection;
      if (from === to) return;
      document.querySelector(".editor-context-menu")?.remove();
      const menu = h("div", { class: "editor-context-menu" });
      const copiar = h("button", { class: "context-menu-item" });
      copiar.innerHTML = '<svg class="ic"><use href="#i-copy"/></svg><span>Copiar</span><kbd>Ctrl+C</kbd>';
      copiar.addEventListener("click", () => {
        menu.remove();
        const trecho = this.editor.view.state.doc.textBetween(from, to, "\n");
        void copyText(trecho).then((ok) => {
          if (!ok) toast("Não foi possível copiar.", "err", 3000);
        });
      });
      menu.append(copiar);
      document.body.append(menu);
      const x = Math.min(e.clientX, window.innerWidth - menu.offsetWidth - 8);
      const y = Math.min(e.clientY, window.innerHeight - menu.offsetHeight - 8);
      menu.style.left = `${Math.max(8, x)}px`;
      menu.style.top = `${Math.max(8, y)}px`;
      const sair = (ev: MouseEvent) => {
        if (!menu.contains(ev.target as Node)) {
          menu.remove();
          document.removeEventListener("mousedown", sair, true);
        }
      };
      document.addEventListener("mousedown", sair, true);
    });

    this.ribbon = new Ribbon(q("#word-ribbon"), {
      editor: this.editor,
      pickImage: () => void this.pickImage(),
      setSetup: (s) => this.setSetup(s),
      askLink: (cur) => this.askLink(cur),
      onFind: () => this.opts.onFind?.(),
      onReplace: () => this.opts.onReplace?.(),
      onReview: () => this.opts.onReview?.(),
      onFormalizar: () => this.opts.onFormalizar?.(),
      onAddons: () => this.opts.onAddons?.(),
    });

    // zoom: escala a folha e ajusta a área de rolagem
    const range = q<HTMLInputElement>("#wd-zoom-range");
    range.addEventListener("input", () => this.setZoom(+range.value / 100));
    const ro = new ResizeObserver(() => this.fitHolder());
    ro.observe(this.zoomEl);
    this.stage.addEventListener(
      "wheel",
      (e) => {
        if (!e.ctrlKey) return;
        e.preventDefault();
        this.setZoom(this.zoom + (e.deltaY < 0 ? 0.1 : -0.1));
      },
      { passive: false }
    );
    q("#wd-zoom-out").addEventListener("click", () => this.setZoom(this.zoom - 0.1));
    q("#wd-zoom-in").addEventListener("click", () => this.setZoom(this.zoom + 0.1));
    // "Ajustar": a folha cabe na largura da janela (o jeito de ver a página inteira quando ela não
    // cabe em 100% — antes só dava para caçar o valor no controle deslizante)
    q("#wd-zoom-fit").addEventListener("click", () => this.fitToWidth());
    // o número do zoom é o botão do "voltar a 100%"
    q("#wd-zoom-val").addEventListener("click", () => this.setZoom(1));
    this.applySetup();
    this.ribbon.update();
  }

  // ---------- abas ----------

  createTab(doc: PMNode = emptyDoc(), setup: PageSetup = { ...DEFAULT_SETUP, margins: { ...DEFAULT_SETUP.margins } }): WordTabData {
    return { state: this.editor.createState(doc), setup, scrollTop: 0 };
  }

  load(data: WordTabData): void {
    this.editor.loadState(data.state, data.setup);
    this.applySetup();
    this.stage.scrollTop = data.scrollTop;
    this.statusSoon();
  }

  /** Guarda o estado atual de volta na aba (antes de trocar de aba). */
  snapshot(data: WordTabData): void {
    data.state = this.editor.view.state;
    data.setup = this.editor.setup;
    data.scrollTop = this.stage.scrollTop;
  }

  focus(): void {
    this.editor.focus();
  }

  // ---------- página ----------

  setSetup(next: PageSetup): void {
    this.editor.setup = next;
    this.applySetup();
    this.opts.onChange();
  }

  /** Aplica tamanho, margens e fonte padrão à folha. */
  applySetup(): void {
    const s = this.editor.setup;
    const { w, h: ph } = pageSizePx(s);
    const st = this.sheet.style;
    st.setProperty("--pg-w", `${w}px`);
    st.setProperty("--pg-h", `${ph}px`);
    st.setProperty("--mt", `${Math.round(s.margins.top * CM_TO_PX)}px`);
    st.setProperty("--mb", `${Math.round(s.margins.bottom * CM_TO_PX)}px`);
    st.setProperty("--ml", `${Math.round(s.margins.left * CM_TO_PX)}px`);
    st.setProperty("--mr", `${Math.round(s.margins.right * CM_TO_PX)}px`);
    st.setProperty("--wd-font", `'${s.defaultFont}', 'Segoe UI', sans-serif`);
    st.setProperty("--wd-size", `${s.defaultSize}pt`);
    this.zoomEl.style.width = `${w}px`;
    // o TAMANHO DO PAPEL à vista (o papel é fixo: A4/Carta; o que muda de tamanho na tela é a vista —
    // o usuário leu a folha pequena do zoom como "o papel mudou" e este rótulo responde a pergunta)
    const cm = pageSizeCm(s);
    const num = (v: number) => String(v).replace(".", ",");
    const rotulo = `${s.size} · ${num(cm.w)} × ${num(cm.h)} cm`;
    const papel = this.opts.pane.querySelector<HTMLElement>("#wd-pagesize");
    if (papel) {
      papel.textContent = rotulo;
      papel.title = `Tamanho do papel: ${s.size} (${s.landscape ? "paisagem" : "retrato"}) · ${num(cm.w)} × ${num(cm.h)} cm — a vista (zoom) não muda o papel`;
    }
    this.firstHeader.textContent = s.header.replace(/\{pagina\}/gi, "1").replace(/\{total\}/gi, String(this.pages));
    this.firstHeader.hidden = !s.header.trim();
    this.printStyle(s);
    requestPagination(this.editor.view);
    this.fitHolder();
  }

  /** Na impressão o navegador pagina de verdade: @page leva tamanho, margens, cabeçalho e rodapé. */
  private printStyle(s: PageSetup): void {
    let el = document.getElementById("wd-print-style") as HTMLStyleElement | null;
    if (!el) {
      el = document.createElement("style");
      el.id = "wd-print-style";
      document.head.append(el);
    }
    const q = (t: string) => JSON.stringify(t.replace(/\{pagina\}|\{total\}/gi, "").trim());
    const boxes: string[] = [];
    if (s.header.trim()) boxes.push(`@top-center { content: ${q(s.header)}; font: 9pt 'Segoe UI', sans-serif; color: #6b7280; }`);
    const foot = s.footer.trim() ? `${q(s.footer)} "   ·   "` : "";
    if (s.pageNumbers) boxes.push(`@bottom-center { content: ${foot}"Página " counter(page) " de " counter(pages); font: 9pt 'Segoe UI', sans-serif; color: #6b7280; }`);
    else if (foot) boxes.push(`@bottom-center { content: ${q(s.footer)}; font: 9pt 'Segoe UI', sans-serif; color: #6b7280; }`);
    const m = s.margins;
    el.textContent = `@media print { @page { size: ${s.size === "A4" ? "A4" : "letter"} ${s.landscape ? "landscape" : "portrait"}; margin: ${m.top}cm ${m.right}cm ${m.bottom}cm ${m.left}cm; ${boxes.join(" ")} } }`;
  }

  private setZoom(z: number): void {
    this.zoom = Math.min(2, Math.max(0.5, Math.round(z * 10) / 10));
    this.zoomEl.style.transform = `scale(${this.zoom})`;
    const range = this.opts.pane.querySelector<HTMLInputElement>("#wd-zoom-range")!;
    range.value = String(Math.round(this.zoom * 100));
    this.opts.pane.querySelector("#wd-zoom-val")!.textContent = `${Math.round(this.zoom * 100)}%`;
    this.fitHolder();
  }

  /**
   * O zoom que faz a FOLHA caber na largura da janela (com uma folga de 32 px para a sombra e o ar).
   * É um atalho de VISTA: a página continua A4 — só passa a ser vista inteira, sem rolar de lado.
   * Nunca AUMENTA além de 100%: "caber" é para quando não cabe.
   */
  private fitToWidth(): void {
    const { w } = pageSizePx(this.editor.setup);
    const disponivel = this.stage.clientWidth - 32;
    if (disponivel > 0 && w > 0) this.setZoom(Math.min(1, disponivel / w));
  }

  private fitHolder(): void {
    const { w } = pageSizePx(this.editor.setup);
    this.holder.style.width = `${Math.round(w * this.zoom)}px`;
    this.holder.style.height = `${Math.round(this.zoomEl.offsetHeight * this.zoom)}px`;
  }

  // ---------- inserir ----------

  /** Abre o seletor de imagem do computador. */
  pickImageDialog(): void {
    void this.pickImage();
  }

  private async pickImage(): Promise<void> {
    const input = h("input", { type: "file", accept: "image/*" });
    input.addEventListener("change", () => {
      const f = input.files?.[0];
      if (!f) return;
      const fr = new FileReader();
      fr.onload = () => void this.insertImageData(String(fr.result), f.name.replace(/\.[^.]+$/, ""));
      fr.readAsDataURL(f);
    });
    input.click();
  }

  /** Insere uma imagem já em data URL, encolhendo se for mais larga que a página. */
  async insertImageData(src: string, alt: string | null = null): Promise<void> {
    let w = 0;
    let hh = 0;
    try {
      const im = new Image();
      im.src = src;
      await im.decode();
      w = im.naturalWidth;
      hh = im.naturalHeight;
    } catch {
      /* sem dimensões: o navegador decide */
    }
    const s = this.editor.setup;
    const max = pageSizePx(s).w - Math.round((s.margins.left + s.margins.right) * CM_TO_PX);
    if (w > max) {
      hh = Math.round((hh * max) / w);
      w = max;
    }
    this.editor.insertImage(src, w || null, hh || null, alt);
  }

  private askLink(current: string | null): Promise<string | null> {
    return new Promise((resolve) => {
      const backdrop = h("div", { class: "modal-backdrop" });
      const modal = h("div", { class: "modal tr-modal link-modal" });
      modal.innerHTML = `
        <header class="wm-head"><h2>Link</h2></header>
        <div class="wm-body tr-body"><label class="st-field">Endereço (deixe vazio para remover o link)
          <input type="text" data-url placeholder="https://" spellcheck="false" autocomplete="off"></label></div>
        <footer class="wm-foot"><span class="dr-spacer"></span><button class="btn" data-cancel>Cancelar</button><button class="btn primary" data-ok>OK</button></footer>`;
      backdrop.append(modal);
      document.body.append(backdrop);
      const input = modal.querySelector<HTMLInputElement>("[data-url]")!;
      input.value = current ?? "";
      input.focus();
      input.select();
      const done = (v: string | null) => {
        document.removeEventListener("keydown", onKey, true);
        backdrop.remove();
        resolve(v);
      };
      const onKey = (e: KeyboardEvent) => {
        if (e.key === "Escape") {
          e.preventDefault();
          e.stopPropagation();
          done(null);
        } else if (e.key === "Enter") {
          e.preventDefault();
          e.stopPropagation();
          done(input.value);
        }
      };
      document.addEventListener("keydown", onKey, true);
      modal.querySelector("[data-cancel]")!.addEventListener("click", () => done(null));
      modal.querySelector("[data-ok]")!.addEventListener("click", () => done(input.value));
      backdrop.addEventListener("mousedown", (e) => {
        if (e.target === backdrop) done(null);
      });
    });
  }

  // ---------- consultas ----------

  doc(): PMNode {
    return this.editor.getDoc();
  }

  setup(): PageSetup {
    return this.editor.setup;
  }

  text(): string {
    return plainText(this.editor.getDoc());
  }

  /** Os trechos de texto corrido do documento, com a posição de cada um (para a revisão inteligente). */
  deepSegments(): { text: string; base: number }[] {
    const out: { text: string; base: number }[] = [];
    this.editor.getDoc().descendants((node, pos) => {
      if (!node.isTextblock) return true;
      let run = "";
      let base = -1;
      const flush = () => {
        if (run) out.push({ text: run, base });
        run = "";
        base = -1;
      };
      node.forEach((child, offset) => {
        if (child.isText) {
          if (base < 0) base = pos + 1 + offset;
          run += child.text;
        } else flush();
      });
      flush();
      return false;
    });
    return out;
  }

  /** Texto (JSON) do documento inteiro, para histórico e rascunhos. */
  serialized(): string {
    return serialize(this.editor.getDoc(), this.editor.setup);
  }

  /** Volta a uma versão guardada (uma ação só no desfazer). */
  restore(serializedText: string): boolean {
    const r = deserialize(serializedText);
    if (!r) return false;
    this.editor.replaceAll(r.doc);
    this.setSetup(r.setup);
    return true;
  }

  stats(): WordStats {
    const text = this.text();
    const words = (text.match(/[\p{L}\p{N}_'-]+/gu) ?? []).length;
    return { words, chars: text.replace(/\n/g, "").length, pages: this.pages, page: this.currentPage(), issues: this.issues };
  }

  private currentPage(): number {
    try {
      const view = this.editor.view;
      const box = (view.dom as HTMLElement).getBoundingClientRect();
      const scale = box.width / (view.dom as HTMLElement).offsetWidth || 1;
      const padTop = parseFloat(getComputedStyle(view.dom).paddingTop) || 0;
      const c = view.coordsAtPos(view.state.selection.head);
      const y = (c.top - box.top) / scale - padTop;
      const stride = pageSizePx(this.editor.setup).h + GAP_PX;
      return Math.min(this.pages, Math.max(1, Math.floor((y + 4) / stride) + 1));
    } catch {
      return 1;
    }
  }

  private statusSoon(): void {
    window.clearTimeout(this.statusTimer);
    this.statusTimer = window.setTimeout(() => {
      const el = this.opts.pane.querySelector("#wd-pageinfo");
      if (el) el.textContent = `Página ${this.currentPage()} de ${this.pages}`;
      this.firstHeader.textContent = this.editor.setup.header.replace(/\{pagina\}/gi, "1").replace(/\{total\}/gi, String(this.pages));
      this.opts.onStatus();
    }, 120);
  }

  /** Linha (no painel Estrutura) do bloco onde está o cursor. */
  cursorLine(): number {
    const { positions } = this.outline();
    const head = this.editor.view.state.selection.head;
    let line = 1;
    positions.forEach((p, i) => {
      if (p <= head) line = i + 1;
    });
    return line;
  }

  /** Imprime a folha como está (o usuário escolhe "Salvar como PDF"). */
  print(): void {
    this.applySetup();
    window.setTimeout(() => window.print(), 60);
  }

  recheckSpelling(): void {
    this.spell?.recheck(this.editor.view);
  }

  /** Títulos do documento no formato que o painel Estrutura entende. */
  outline(): WordOutlineSource {
    return outlineSource(this.editor.getDoc());
  }

  /** Navega diretamente para um parágrafo por ID (data-pid / pid). */
  gotoParagraph(pid: string): boolean {
    let targetPos: number | null = null;
    this.editor.getDoc().descendants((node, pos) => {
      if (node.attrs.pid === pid) {
        targetPos = pos + 1;
        return false;
      }
      return true;
    });

    if (targetPos === null) return false;
    this.editor.scrollToPos(targetPos);
    this.centerStageOnPos(targetPos);
    return true;
  }

  private centerStageOnPos(pos: number): void {
    window.setTimeout(() => {
      try {
        const c = this.editor.view.coordsAtPos(pos);
        const box = this.stage.getBoundingClientRect();
        this.stage.scrollTop += c.top - box.top - box.height * 0.25;
      } catch {
        /* sem posição */
      }
    }, 30);
  }

  gotoLine(line: number): void {
    const { positions } = this.outline();
    const pos = positions[line - 1];
    if (pos === undefined) return;
    this.editor.scrollToPos(pos);
    this.centerStageOnPos(pos);
  }

  /**
   * Barramento unificado de comandos (Shell ↔ Canvas).
   * Despacha comandos de formatação, navegação e inserção de forma desacoplada.
   */
  dispatchCommand(command: string, payload?: unknown): boolean {
    const ed = this.editor;
    if (command.startsWith("style:")) {
      ed.setBlock(command.slice(6));
      return true;
    }
    switch (command) {
      case "undo":
        ed.undo();
        return true;
      case "redo":
        ed.redo();
        return true;
      case "bold":
      case "italic":
      case "underline":
      case "strike":
      case "sub":
      case "sup":
        ed.toggle(command);
        return true;
      case "clear":
        ed.clearFormatting();
        return true;
      case "size-up":
        ed.stepFontSize(1);
        return true;
      case "size-down":
        ed.stepFontSize(-1);
        return true;
      case "align-left":
      case "align-center":
      case "align-right":
      case "align-justify":
        ed.align(command.slice(6) as "left");
        return true;
      case "indent":
        ed.indent(1);
        return true;
      case "outdent":
        ed.indent(-1);
        return true;
      case "bullet":
      case "ordered":
        ed.list(command as "bullet" | "ordered");
        return true;
      case "font-family":
        ed.setMark("font_family", payload ? { name: String(payload) } : null);
        return true;
      case "font-size":
        ed.setMark("font_size", payload ? { size: Number(payload) || 12 } : null);
        return true;
      case "text-color":
        ed.setMark("text_color", payload ? { color: String(payload) } : null);
        return true;
      case "highlight-color":
        ed.setMark("highlight", payload ? { color: String(payload) } : null);
        return true;
      case "set-link":
        ed.setLink(payload ? String(payload) : null);
        return true;
      case "print":
        this.print();
        return true;
      case "zoom":
        this.setZoom(Number(payload) || 1);
        return true;
      case "goto-paragraph":
        return this.gotoParagraph(String(payload));
      case "goto-line":
        this.gotoLine(Number(payload) || 1);
        return true;
      default:
        return false;
    }
  }
}
