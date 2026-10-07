// mdCreator — integra editor, pré-visualização, desenho, imagens e arquivos.
import { MdEditor, type CursorPos } from "./editor";
import { Preview, getExportHtml, welcomeHtml } from "./preview";
import * as files from "./files";
import { createDrawEditor, placeholderDataUrl, type DrawDoc } from "./draw";
import { TEXT_DRAW_PLACEHOLDER } from "./textdraw";
import { openDiagramBuilder } from "./diagram";
import { checkText, checkStyle, stats as writingStats, warmUpSpell, onSpellReady, spellIsReady, spellHasFailed, type WritingIssue } from "./writing";
import { openReviewModal, type ReviewHandle } from "./review";
import { getCurrentWebview } from "@tauri-apps/api/webview";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { ask } from "@tauri-apps/plugin-dialog";
import { revealItemInDir } from "@tauri-apps/plugin-opener";
import mdCss from "./markdown.css?raw";
import "./styles.css";
import {
  $,
  $$,
  h,
  toast,
  debounce,
  baseName,
  docDirOf,
  joinPath,
  stripExt,
  isImagePath,
  isMarkdownPath,
  blobToBase64,
  copyText,
  loadJSON,
  saveJSON,
  fmtTime,
  clamp,
  slugify,
  toBase64Utf8,
} from "./util";

const TABLE_SNIPPET = ["", "| Coluna A | Coluna B |", "| --- | --- |", "| $0 |  |", ""].join("\n");

const MERMAID_SNIPPET = [
  "",
  "```mermaid",
  "flowchart TD",
  "  A[Início] --> B{Decisão}",
  "  B -->|Sim| C[Ação]",
  "  B -->|Não| D[Fim]",
  "```",
  "",
  "$0",
].join("\n");

const AI_TEMPLATE = [
  "",
  "# Título do pedido",
  "",
  "## Objetivo",
  "Escreva em uma frase o resultado esperado.",
  "",
  "## Contexto",
  "- Ambiente / stack: ",
  "- Restrições: ",
  "",
  "## Requisitos",
  "- [ ] $0",
  "- [ ] ",
  "",
  "## Exemplos / referências",
  "",
  "## Formato da resposta",
  "- Passo a passo numerado, com código comentado e exemplos.",
  "",
].join("\n");

interface Recent {
  path: string;
  at: number;
}

interface LinkedFolder {
  path: string;
  name: string;
}

class App {
  private editor!: MdEditor;
  private preview!: Preview;
  private path: string | null = null;
  private dirty = false;
  private statusSaved = "Novo documento";
  private recents: Recent[] = [];
  private linkedFolders: LinkedFolder[] = [];
  private title: string | null = null;
  private isDraft = false;
  private ignoreWords = new Set<string>(loadJSON<string[]>("mdc.ignore-words", []));
  private issues: WritingIssue[] = [];
  /** Correção automática de estilo ligada (ponto, vírgulas, maiúsculas…). */
  private autoFix = loadJSON<boolean>("mdc.autofix", true);
  /** Só corrige depois que o usuário edita este documento (não mexe no que foi aberto). */
  private autoFixArmed = false;
  private reviewHandle: ReviewHandle | null = null;
  private cursor: CursorPos = { line: 1, col: 1 };

  async start(): Promise<void> {
    this.preview = new Preview($("#preview"), {
      onOpenLocalDoc: (p) => void this.openPath(p),
      onSaveDrawing: async (rel, png, json) => {
        if (!this.path) throw new Error("Salve o documento antes de editar desenhos.");
        await files.updateAsset(this.path, rel, png);
        await files.updateAsset(this.path, `${rel}.draw.json`, toBase64Utf8(json));
        this.preview.setDocPath(this.path);
        this.preview.invalidateAsset(rel);
        toast("Desenho atualizado no documento.", "ok");
      },
      onRemoveDrawing: async (rel) => {
        this.removeDrawingReference(rel);
      },
      onSaveTextBlock: (oldText, newText) => this.replaceTextBlock(oldText, newText),
      onRemoveTextBlock: (oldText) => {
        this.removeTextBlock(oldText);
      },
      onEditMermaid: (code) => this.editDiagram(code),
      onToggleTask: (index) => this.toggleTask(index),
    });
    this.editor = new MdEditor(
      $("#editor"),
      () => this.onDocChange(),
      (pos) => {
        this.cursor = pos;
        $("#st-cursor").textContent = `Ln ${pos.line}, Col ${pos.col}`;
      }
    );

    this.recents = loadJSON<Recent[]>("mdc.recents", []);
    this.linkedFolders = loadJSON<LinkedFolder[]>("mdc.linked-folders", []);
    // clicar no título permite renomear o documento
    const titleEl = $("#doc-title");
    titleEl.title = "Clique para renomear o documento";
    titleEl.addEventListener("click", () => this.startTitleEdit());
    if (loadJSON<boolean>("mdc.no-sidebar", false)) document.body.classList.add("no-sidebar");
    if (loadJSON<boolean>("mdc.no-preview", false)) document.body.classList.add("no-preview");

    this.renderRecents();
    this.renderLinkedFolders();
    this.renderOutline();
    this.applyTheme(this.initialDark(), false);
    this.setupToolbar();
    this.setupSplitter();
    this.setupKeys();
    this.setupEditorInteractions();
    this.editor.onScroll(() => this.syncPreviewScroll());
    this.editor.view.contentDOM.addEventListener("paste", (e) => void this.onPaste(e as ClipboardEvent));
    this.editor.onIssuesChanged = () => this.checkWritingSoon();
    this.editor.onIgnoreWord = (word) => this.ignoreWord(word);
    document.querySelector("#st-writing")?.addEventListener("click", () => this.openReview());
    $("#st-path").addEventListener("click", () => {
      if (this.path) void revealItemInDir(this.path).catch(() => {});
    });
    window.addEventListener("blur", () => void this.autosave());
    await this.setupDragDrop();

    this.refreshTitle();
    this.refreshPath();
    this.setSaveState();
    this.updateStats();
    void this.preview.render("");
    this.editor.focus();
    void this.restoreDrafts();
    // carrega o dicionário em segundo plano (worker) e revisa quando ficar pronto
    window.setTimeout(() => warmUpSpell(), 2000);
    onSpellReady(() => this.checkWritingSoon());
  }

  /** Restaura o rascunho mais recente guardado na pasta do app. */
  private async restoreDrafts(): Promise<void> {
    try {
      const drafts = await files.listDrafts();
      const latest = drafts[0];
      if (!latest || this.dirty || this.path) return;
      const content = await files.loadDoc(latest.path);
      if (!content.trim()) return;
      this.path = latest.path;
      this.isDraft = true;
      this.autoFixArmed = false;
      this.editor.setText(content);
      this.dirty = false;
      this.statusSaved = "Rascunho guardado no app";
      this.preview.setDocPath(latest.path);
      this.refreshTitle();
      this.refreshPath();
      this.setSaveState();
      this.updateStats();
      this.renderOutline();
      await this.preview.render(content);
      toast(
        `Rascunho da sessão anterior restaurado (${baseName(latest.path)}). Use "Salvar como" para guardar numa pasta sua.`,
        "info",
        7500
      );
    } catch {
      /* sem rascunhos do app */
    }
    // Navegador (dev) ou sem rascunho do app: recupera o temp/rascunho.md do projeto.
    if (this.dirty || this.path) return;
    try {
      const texto = await files.loadDraftFallback();
      if (!texto || !texto.trim()) return;
      this.autoFixArmed = false;
      this.editor.setText(texto);
      this.dirty = false;
      this.statusSaved = "Salvo automaticamente em temp/";
      this.refreshTitle();
      this.refreshPath();
      this.setSaveState();
      this.updateStats();
      this.renderOutline();
      await this.preview.render(texto);
      toast("Texto recuperado do salvamento automático (temp/rascunho.md).", "info", 6500);
    } catch {
      /* sem salvamento automático */
    }
  }

  // ---------- fluxo de documento ----------

  private onDocChange(): void {
    this.dirty = true;
    // a correção automática só age depois que você digita (não mexe em documento aberto)
    this.autoFixArmed = true;
    this.refreshTitle();
    this.setSaveState();
    this.updatePreview();
    this.statsSoon();
    this.outlineSoon();
    this.autosaveSoon();
    this.checkWritingSoon();
    if (this.autoFix) this.autoFixSoon();
    // mantém o desenho de letras aberto em sincronia com o texto do editor
    this.preview.syncTextEditorWith(this.editor.getText());
  }

  // ---------- assistente de escrita ----------

  private checkWritingSoon = debounce(() => void this.runWritingCheck(), 900);

  private autoFixSoon = debounce(() => this.runAutoFix(), 700);

  /** Correção automática: não depende do dicionário, roda logo depois de você pausar. */
  private runAutoFix(): void {
    if (!this.autoFix || !this.autoFixArmed) return;
    let typed = 0;
    let ended = 0;
    // repete algumas vezes porque uma correção pode abrir caminho para outra
    // (ex.: maiúscula no começo e depois “a gente vai” → “Nós vamos”)
    for (let i = 0; i < 3; i++) {
      const t = this.autoFixSafe();
      const e = this.autoFixFinishedParagraph();
      typed += t;
      ended += e;
      if (!t && !e) break;
    }
    if (typed + ended > 0) void this.runWritingCheck();
    if (ended) toast(`Correção automática: ${ended} ajuste${ended === 1 ? "" : "s"}.`, "ok", 2400);
  }

  private async runWritingCheck(): Promise<void> {
    const text = this.editor.getText();
    try {
      this.issues = await checkText(text, this.ignoreWords);
    } catch {
      this.issues = [];
    }
    this.editor.setIssues(this.issues);
    this.updateWritingBadge();
    this.reviewHandle?.refresh(this.issues, writingStats(text));
    // com o resultado da ortografia em mãos, a correção automática ganha o que fazer
    if (this.autoFix && this.autoFixArmed) this.autoFixSoon();
  }

  /** Liga/desliga a correção automática (guardada entre sessões). */
  private setAutoFix(on: boolean): void {
    this.autoFix = on;
    saveJSON("mdc.autofix", on);
    toast(
      on
        ? "Correção automática ligada: ponto, vírgulas, maiúsculas e trocas formais entram sozinhos."
        : "Correção automática desligada.",
      "info",
      3400
    );
  }

  /** Substituição de um aviso: estilo usa `fix`; ortografia usa `auto` (correção confiável). */
  private replacementFor(issue: WritingIssue): string | undefined {
    return issue.kind === "spell" ? issue.auto : issue.fix;
  }

  /** Aplica as correções disponíveis numa só ação (um único desfazer). */
  private applyFixes(issues: WritingIssue[]): number {
    const aplicaveis = issues.filter((i) => this.replacementFor(i) !== undefined);
    if (!aplicaveis.length) return 0;
    this.editor.replaceRanges(
      aplicaveis.map((i) => ({ from: i.from, to: i.to, insert: this.replacementFor(i)! }))
    );
    return aplicaveis.length;
  }

  /** Primeira coluna do parágrafo que contém a posição. */
  private paragraphStartAt(pos: number): number {
    const doc = this.editor.view.state.doc;
    let line = doc.lineAt(pos);
    while (line.number > 1 && doc.line(line.number - 1).text.trim() !== "") line = doc.line(line.number - 1);
    return line.from;
  }

  /**
   * Corrige sozinho as palavras erradas em que dá para confiar ("responsavo" → "responsável").
   * Nunca mexe na palavra em que o cursor está (ela pode estar pela metade) e confere se o
   * texto naquele ponto continua igual antes de trocar.
   */
  private autoFixWords(from: number, to: number, soDepoisDoCursor = true): number {
    const view = this.editor.view;
    const doc = view.state.doc;
    const pos = view.state.selection.main.head;
    const alvos = this.issues.filter(
      (i) =>
        i.kind === "spell" &&
        i.auto &&
        i.from >= from &&
        i.to <= to &&
        (!soDepoisDoCursor || pos > i.to) &&
        doc.sliceString(i.from, i.to) === i.word
    );
    return this.applyFixes(alvos);
  }

  /** Enquanto se digita: aplica só o que é seguro (maiúsculas, espaços, abreviações) + palavras. */
  private autoFixSafe(): number {
    const view = this.editor.view;
    const doc = view.state.doc;
    const pos = view.state.selection.main.head;
    const line = doc.lineAt(pos);
    // recalcula na hora: as posições antigas podem ter mudado
    const fresh = checkStyle(doc.toString()).filter((i) => i.safe && i.from >= line.from && i.to <= line.to);
    const parFrom = this.paragraphStartAt(pos);
    return this.applyFixes(fresh) + this.autoFixWords(parFrom, pos);
  }

  /**
   * Correção automática de parágrafo: quando o cursor está numa linha vazia e existe uma
   * linha em branco antes (parágrafo concluído), corrige o parágrafo que ficou para trás.
   */
  private autoFixFinishedParagraph(): number {
    const view = this.editor.view;
    const doc = view.state.doc;
    const line = doc.lineAt(view.state.selection.main.head);
    if (line.text.trim() !== "" || line.number < 3) return 0;
    // só um Enter: o parágrafo continua na próxima linha — não mexe
    if (doc.line(line.number - 1).text.trim() !== "") return 0;
    let first = line.number - 2;
    while (first > 1 && doc.line(first - 1).text.trim() !== "") first--;
    const from = doc.line(first).from;
    const to = doc.line(line.number - 2).to;
    const fresh = checkStyle(doc.toString()).filter((i) => i.from >= from && i.to <= to);
    return this.applyFixes(fresh) + this.autoFixWords(from, to);
  }

  private updateWritingBadge(): void {
    const btn = document.querySelector<HTMLButtonElement>("#st-writing");
    if (!btn) return;
    const count = this.issues.length;
    const loading = !spellIsReady() && !spellHasFailed();
    if (!count && !loading) {
      btn.hidden = true;
      return;
    }
    const spell = this.issues.filter((i) => i.kind === "spell").length;
    const parts = [count ? `${count} aviso${count === 1 ? "" : "s"}` : "nenhum aviso"];
    if (spell) parts.push(`${spell} de escrita`);
    btn.hidden = false;
    btn.textContent = `Revisar: ${parts.join(" · ")}${loading ? " · carregando dicionário…" : ""}`;
  }

  private ignoreWord(word: string): void {
    this.ignoreWords.add(word.toLowerCase());
    saveJSON("mdc.ignore-words", Array.from(this.ignoreWords));
    toast(`Não vou mais avisar sobre “${word}”.`, "info", 2600);
    void this.runWritingCheck();
  }

  /**
   * Repara os blocos de alinhamento: remove `</div>` que sobrou e fecha os `<div align>`
   * que ficaram abertos (o bug antigo de aninhamento deixava os dois casos).
   */
  private repairAlignments(): void {
    const texto = this.editor.getText();
    const abrirRx = /^<div align="(left|center|right|justify)">$/;
    const saida: string[] = [];
    let abertos = 0;
    let removidos = 0;
    let emCodigo = false;

    for (const linha of texto.split("\n")) {
      const t = linha.trim();
      if (t.startsWith("```")) {
        emCodigo = !emCodigo;
        saida.push(linha);
        continue;
      }
      if (!emCodigo && abrirRx.test(t)) {
        abertos++;
        saida.push(linha);
        continue;
      }
      if (!emCodigo && t === "</div>") {
        if (abertos === 0) {
          removidos++; // fechamento sobrando
          continue;
        }
        abertos--;
        saida.push(linha);
        continue;
      }
      saida.push(linha);
    }

    let fechados = 0;
    if (abertos > 0) {
      if (saida.length && saida[saida.length - 1].trim() !== "") saida.push("");
      for (let i = 0; i < abertos; i++) {
        saida.push("</div>");
        saida.push("");
      }
      fechados = abertos;
    }

    if (!removidos && !fechados) {
      toast("Os alinhamentos já estão certos — nada para reparar.", "info", 2800);
      return;
    }
    this.editor.replaceRange(0, texto.length, saida.join("\n"));
    const partes = [];
    if (removidos) partes.push(`${removidos} fechamento(s) sobrando`);
    if (fechados) partes.push(`${fechados} bloco(s) sem fechar`);
    toast(`Alinhamentos reparados: ${partes.join(" e ")}.`, "ok", 4200);
  }

  private openReview(): void {
    if (this.reviewHandle) return;
    this.reviewHandle = openReviewModal({
      issues: this.issues,
      stats: writingStats(this.editor.getText()),
      onGoTo: (issue) => {
        this.editor.gotoRange(issue.from, issue.to);
        this.reviewHandle?.close();
      },
      onFix: (issue) => {
        const replacement = issue.fix ?? issue.suggestions[0];
        if (!replacement) return;
        this.editor.replaceRange(issue.from, issue.to, replacement);
        this.checkWritingSoon();
      },
      onFixAllStyle: () => {
        const count = this.applyFixes(this.issues);
        if (!count) {
          toast("Nenhuma correção automática de estilo disponível.", "info", 2600);
          return;
        }
        toast(`${count} correção(ões) de estilo aplicada(s).`, "ok", 3200);
        this.checkWritingSoon();
      },
      onIgnore: (word) => this.ignoreWord(word),
      onRecheck: () => void this.runWritingCheck(),
      onClose: () => {
        this.reviewHandle = null;
      },
    });
  }

  private updatePreview = debounce(() => void this.preview.render(this.editor.getText()), 180);
  private statsSoon = debounce(() => this.updateStats(), 260);
  private outlineSoon = debounce(() => this.renderOutline(), 400);
  private autosaveSoon = debounce(() => void this.autosave(), 2000);

  private async autosave(): Promise<void> {
    if (!this.dirty) return;
    // Sem caminho (ex.: app rodando no navegador): o texto vai para temp/rascunho.md do projeto.
    if (!this.path) {
      const salvou = await files.saveDraftFallback("rascunho", this.editor.getText());
      if (salvou) {
        this.dirty = false;
        this.statusSaved = `Salvo automaticamente em temp/ às ${fmtTime()}`;
        this.refreshTitle();
        this.setSaveState();
      }
      return;
    }
    try {
      await files.saveDoc(this.path, this.editor.getText());
      this.dirty = false;
      this.statusSaved = this.isDraft
        ? `Rascunho atualizado às ${fmtTime()}`
        : `Salvo automaticamente às ${fmtTime()}`;
      this.refreshTitle();
      this.setSaveState();
    } catch {
      // não conseguiu gravar pelo app (navegador): guarda em temp/ do projeto
      await files.saveDraftFallback("rascunho", this.editor.getText());
    }
  }

  private async save(saveAs = false): Promise<boolean> {
    try {
      const previousPath = this.path;
      const wasDraft = this.isDraft;
      if (saveAs || !this.path) {
        const suggested = this.isDraft || !this.path ? `${this.docTitleForFileName()}.md` : baseName(this.path);
        let defaultPath = suggested;
        try {
          defaultPath = joinPath(await files.defaultDocsDir(), suggested);
        } catch {
          /* usa apenas o nome do arquivo */
        }
        const picked = await files.pickSaveDoc(defaultPath);
        if (!picked) return false;
        this.path = /\.[a-zA-Z0-9]+$/.test(picked) ? picked : `${picked}.md`;
        this.isDraft = false;
      }

      // correção automática: ponto, vírgulas, maiúsculas, trocas formais e palavras erradas
      if (this.autoFix) {
        const count =
          this.applyFixes(checkStyle(this.editor.getText())) +
          this.autoFixWords(0, this.editor.getText().length, false);
        if (count) toast(`Correção automática: ${count} ajuste${count === 1 ? "" : "s"} antes de salvar.`, "ok", 2600);
      }

      const content = this.editor.getText();
      await files.saveDoc(this.path, content);

      // saiu do rascunho para uma pasta do usuário: leva as imagens junto
      if (wasDraft && previousPath && docDirOf(this.path) !== docDirOf(previousPath)) {
        try {
          const copied = await files.copyAssets(previousPath, this.path);
          if (copied > 0) toast(`${copied} imagem(ns) copiada(s) junto para a pasta assets/.`, "ok", 4200);
        } catch {
          /* sem imagens para copiar */
        }
        void files.deleteDraft(previousPath).catch(() => {});
      }

      this.dirty = false;
      this.statusSaved = `Salvo às ${fmtTime()}`;
      this.preview.setDocPath(this.path);
      if (!this.isDraft) this.addRecent(this.path);
      this.refreshTitle();
      this.refreshPath();
      this.setSaveState();

      if (previousPath && !wasDraft && docDirOf(this.path) !== docDirOf(previousPath) && /\]\(assets\//.test(content)) {
        toast("Salvo em outra pasta: as imagens de assets/ continuam na pasta antiga.", "info", 7000);
      } else if (saveAs) {
        toast(`Documento salvo em ${baseName(this.path)}`, "ok");
      }
      return true;
    } catch (e) {
      toast("Erro ao salvar: " + e, "err");
      return false;
    }
  }

  private async newDoc(): Promise<void> {
    if (!(await this.confirmDiscard())) return;
    this.path = null;
    this.title = null;
    this.isDraft = false;
    this.statusSaved = "Novo documento";
    this.autoFixArmed = false;
    this.editor.setText("");
    this.dirty = false;
    this.preview.setDocPath(null);
    this.refreshTitle();
    this.refreshPath();
    this.setSaveState();
    this.updateStats();
    this.renderOutline();
    void this.preview.render("");
  }

  private async openDocDialog(): Promise<void> {
    const picked = await files.pickOpenDoc();
    if (picked) await this.openPath(picked);
  }

  private async openPath(path: string): Promise<boolean> {
    if (!(await this.confirmDiscard())) return false;
    try {
      const content = await files.loadDoc(path);
      this.path = path;
      this.title = null;
      this.isDraft = false;
      this.autoFixArmed = false;
      this.editor.setText(content);
      this.dirty = false;
      this.statusSaved = `Aberto às ${fmtTime()}`;
      this.preview.setDocPath(path);
      this.refreshTitle();
      this.refreshPath();
      this.setSaveState();
      this.updateStats();
      this.renderOutline();
      this.addRecent(path);
      await this.preview.render(content);
      return true;
    } catch (e) {
      toast("Não foi possível abrir o arquivo: " + e, "err");
      return false;
    }
  }

  private async confirmDiscard(): Promise<boolean> {
    if (!this.dirty) return true;
    return await ask("Há alterações não salvas. Descartar?", {
      title: "mdCreator",
      kind: "warning",
      okLabel: "Descartar",
      cancelLabel: "Manter",
    });
  }

  /**
   * Garante que o documento tenha um arquivo, sem interromper o usuário:
   * salva automaticamente em Documentos/mdCreator (com aviso no rodapé/toast).
   * Funciona mesmo com backends antigos (não depende de comandos novos).
   */
  private async ensureSaved(): Promise<boolean> {
    if (this.path) return true;
    try {
      const base = slugify(this.docTitleForFileName()) || "documento";
      let target: string | null = null;
      try {
        // rascunho na pasta do próprio app (não espalha arquivos em Documentos)
        target = await files.draftPath(base);
      } catch {
        target = null; // backend mais antigo: cai na pasta de documentos
      }
      if (!target) {
        const dir = await files.defaultDocsDir();
        target = joinPath(dir, `${base}.md`);
        for (let i = 1; i <= 40 && (await files.existsText(target)); i++) {
          target = joinPath(dir, `${base}-${i}.md`);
        }
      }
      await files.saveDoc(target, this.editor.getText());
      this.path = target;
      this.isDraft = true;
      this.dirty = false;
      this.statusSaved = "Rascunho guardado no app";
      this.preview.setDocPath(target);
      this.refreshTitle();
      this.refreshPath();
      this.setSaveState();
      toast(
        "Rascunho guardado na pasta do app (não é a versão final). Use Ctrl+Shift+S quando quiser salvar numa pasta sua.",
        "info",
        6500
      );
      return true;
    } catch (e) {
      toast("Não consegui guardar o rascunho: " + e, "err", 7000);
      return false;
    }
  }

  /** Nome sugerido para o arquivo: o título que você definiu ou o primeiro título (#). */
  private docTitleForFileName(): string {
    if (this.title) return this.title;
    const match = /^#\s+(.+)$/m.exec(this.editor.getText());
    const base = (match ? match[1] : "documento").replace(/\s+/g, " ").trim();
    return base.slice(0, 60) || "documento";
  }

  /** Edição do nome do documento direto no cabeçalho. */
  private startTitleEdit(): void {
    const host = $("#doc-title");
    if (host.querySelector("input")) return;
    const current = this.path ? stripExt(baseName(this.path)) : this.title ?? "";
    const input = document.createElement("input");
    input.type = "text";
    input.className = "title-input";
    input.value = current;
    input.placeholder = "Nome do documento";
    input.title = "Enter confirma · Esc cancela";
    host.textContent = "";
    host.append(input);
    input.focus();
    input.select();

    let settled = false;
    const done = async (keep: boolean) => {
      if (settled) return;
      settled = true;
      const value = input.value.trim();
      input.remove();
      this.refreshTitle();
      if (keep && value && value !== current) await this.applyTitle(value);
    };
    input.addEventListener("blur", () => void done(true));
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        void done(true);
      } else if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        void done(false);
      }
    });
  }

  /** Aplica o novo nome: renomeia o arquivo (se já salvo) ou guarda para o próximo salvamento. */
  private async applyTitle(value: string): Promise<void> {
    if (!this.path) {
      this.title = value;
      this.refreshTitle();
      toast(`Nome definido: "${value}". Ele será usado quando o documento for salvo.`, "ok", 3600);
      return;
    }
    const target = /\.[a-zA-Z0-9]+$/.test(value) ? value : `${value}.md`;
    try {
      const previous = this.path;
      const newPath = await files.renameFile(this.path, target);
      this.path = newPath;
      this.recents = this.recents.map((r) => (r.path === previous ? { ...r, path: newPath } : r));
      saveJSON("mdc.recents", this.recents);
      this.renderRecents();
      this.preview.setDocPath(newPath);
      this.refreshTitle();
      this.refreshPath();
      this.setSaveState();
      toast(`Documento renomeado para ${baseName(newPath)}.`, "ok", 3200);
    } catch (e) {
      toast("Não foi possível renomear: " + e, "err", 6000);
    }
  }

  // ---------- imagens ----------

  private insertImageMd(rel: string, alt: string): void {
    const { from } = this.editor.selectionPos();
    this.editor.insertAt(from, `![${alt}](${rel})\n`);
    this.updatePreview();
  }

  private async insertImageFromDialog(): Promise<void> {
    const src = await files.pickImageFile();
    if (!src) return;
    if (!(await this.ensureSaved())) return;
    try {
      const rel = await files.copyAsset(this.path!, src);
      this.insertImageMd(rel, stripExt(baseName(src)));
      toast(`Imagem salva em ${rel}`, "ok");
    } catch (e) {
      toast("Falha ao copiar a imagem: " + e, "err");
    }
  }

  private async onPaste(e: ClipboardEvent): Promise<void> {
    const dt = e.clipboardData;
    if (!dt) return;
    const imgs = Array.from(dt.files || []).filter((f) => f.type.startsWith("image/"));
    if (!imgs.length) return;
    e.preventDefault();
    if (!(await this.ensureSaved())) return;

    for (const f of imgs) {
      const ext = (f.type.split("/")[1] || "png").replace("jpeg", "jpg");
      const name = `imagem-${Date.now().toString(36)}.${ext}`;
      try {
        const b64 = await blobToBase64(f);
        const rel = await files.writeAsset(this.path!, name, b64);
        this.insertImageMd(rel, "imagem");
        toast(`Imagem colada e salva em ${rel}`, "ok");
      } catch (err) {
        toast("Falha ao salvar a imagem colada: " + err, "err");
      }
    }
  }

  private async setupDragDrop(): Promise<void> {
    try {
      await getCurrentWebview().onDragDropEvent(async (event) => {
        if (event.payload.type !== "drop") return;
        await this.handleDropped(event.payload.paths as string[]);
      });
    } catch (e) {
      console.warn("Drag & drop indisponível:", e);
    }
  }

  private async handleDropped(paths: string[]): Promise<void> {
    const mdPath = paths.find(isMarkdownPath);
    const images = paths.filter(isImagePath);
    if (mdPath) await this.openPath(mdPath);
    if (!images.length) return;
    if (!(await this.ensureSaved())) return;
    for (const p of images) {
      try {
        const rel = await files.copyAsset(this.path!, p);
        this.insertImageMd(rel, stripExt(baseName(p)));
        toast(`Imagem salva em ${rel}`, "ok");
      } catch (err) {
        toast("Falha ao copiar a imagem: " + err, "err");
      }
    }
  }

  // ---------- desenho ----------

  /** Já existe um quadro de desenho aberto dentro do documento? */
  private drawingEditorOpen(): boolean {
    return !!document.querySelector("#preview .draw-inline");
  }

  private async openDraw(): Promise<void> {
    if (this.drawingEditorOpen()) {
      toast("Finalize o desenho que já está aberto (Concluir ou Cancelar) antes de criar outro.", "info", 4200);
      return;
    }
    if (loadJSON<string>("mdc.drawstyle", "image") === "text") {
      this.newTextDrawing();
      return;
    }
    if (document.body.classList.contains("no-preview")) {
      this.toggle("no-preview");
      toast("Mostrei a pré-visualização: é nela que o quadro abre, dentro do documento.", "info", 3600);
    }
    const sel = this.editor.selectionPos();
    if (!(await this.ensureSaved())) return;
    try {
      const name = `desenho-${Date.now().toString(36)}.png`;
      const png = placeholderDataUrl(1600, 1000);
      const rel = await files.writeAsset(this.path!, name, png.split(",", 2)[1]);
      const initial: DrawDoc = { version: 1, w: 1600, h: 1000, elements: [] };
      await files.updateAsset(this.path!, `${rel}.draw.json`, toBase64Utf8(JSON.stringify(initial)));
      this.editor.insertAt(sel.from, `![Desenho](${rel})\n`);
      await this.preview.render(this.editor.getText());
      if (!this.preview.openEditorForRel(rel, true)) {
        // Desfaz para não deixar uma linha solta no Markdown.
        this.removeDrawingReference(rel);
        await this.preview.render(this.editor.getText());
        toast("Não consegui abrir o quadro aqui — a linha foi desfeita. Tente de novo.", "err", 6000);
        return;
      }
      toast("Desenhe direto no documento; clique em Concluir para salvar.", "info", 4200);
    } catch (e) {
      toast("Não foi possível criar o desenho: " + e, "err");
    }
  }

  private newTextDrawing(): void {
    if (document.body.classList.contains("no-preview")) {
      this.toggle("no-preview");
      toast("Mostrei a pré-visualização: é nela que o desenho abre, dentro do documento.", "info", 3600);
    }
    const sel = this.editor.selectionPos();
    const block = `\n\`\`\`text\n${TEXT_DRAW_PLACEHOLDER}\n\`\`\`\n`;
    this.editor.insertAt(sel.from, block);
    void this.preview.render(this.editor.getText()).then(() => {
      if (!this.preview.openTextEditorForContent(TEXT_DRAW_PLACEHOLDER)) {
        this.removeTextBlock(TEXT_DRAW_PLACEHOLDER);
        toast("Não consegui abrir o quadro de letras aqui — o bloco foi desfeito. Tente de novo.", "err", 6000);
        return;
      }
      toast("Desenhe com o mouse: caixas, textos, campos [ ] e tabelas.", "info", 4200);
    });
  }

  /** Remove um bloco ```text que contenha o texto indicado (usado para desfazer/remover). */
  private removeTextBlock(needle: string): boolean {
    const lines = this.editor.getText().split("\n");
    const offsetOf = (index: number) => lines.slice(0, index).reduce((n, l) => n + l.length + 1, 0);
    const target = needle.trim();
    let fallback: { from: number; to: number } | null = null;
    let i = 0;
    while (i < lines.length) {
      const fence = /^([ \t]*)(`{3,}|~{3,})[ \t]*([a-zA-Z0-9_-]*)[ \t]*$/.exec(lines[i]);
      if (!fence || !/^(text|txt)$/i.test(fence[3] || "")) {
        i++;
        continue;
      }
      const bodyStart = i + 1;
      let j = bodyStart;
      while (j < lines.length && !/^[ \t]*(`{3,}|~{3,})[ \t]*$/.test(lines[j])) j++;
      const body = lines.slice(bodyStart, j).join("\n");
      const from = offsetOf(i);
      const to = Math.min(offsetOf(Math.min(j + 1, lines.length)), this.editor.getText().length);
      const trimmed = body.trim();
      if (trimmed === target || (target === "" && trimmed === "")) {
        this.editor.replaceRange(from, to, "");
        this.updatePreview();
        return true;
      }
      if (!fallback && target !== "" && trimmed.includes(target)) fallback = { from, to };
      i = j + 1;
    }
    if (fallback) {
      this.editor.replaceRange(fallback.from, fallback.to, "");
      this.updatePreview();
      return true;
    }
    return false;
  }

  /** Atualiza o bloco ```text correspondente ao desenho de letras editado. */
  private replaceTextBlock(oldText: string, newText: string): boolean {
    const lines = this.editor.getText().split("\n");
    const needle = oldText.trim();
    let i = 0;
    while (i < lines.length) {
      const fence = /^([ \t]*)(`{3,}|~{3,})[ \t]*([a-zA-Z0-9_-]*)[ \t]*$/.exec(lines[i]);
      if (!fence || !/^(text|txt)$/i.test(fence[3] || "")) {
        i++;
        continue;
      }
      const bodyStartLine = i + 1;
      let j = bodyStartLine;
      while (j < lines.length && !/^[ \t]*(`{3,}|~{3,})[ \t]*$/.test(lines[j])) j++;
      const body = lines.slice(bodyStartLine, j).join("\n");
      if (body.trim() === needle) {
        const bodyOffset = lines.slice(0, bodyStartLine).reduce((n, l) => n + l.length + 1, 0);
        this.editor.replaceRange(bodyOffset, bodyOffset + body.length, newText);
        this.updatePreview();
        return true;
      }
      i = j + 1;
    }
    return false;
  }

  /** Liga/desliga o campo selecionável (- [ ]) indicado na pré-visualização. */
  private toggleTask(index: number): void {
    const text = this.editor.getText();
    const rx = /^([ \t]*(?:[-*+]|\d+\.)[ \t]+\[)([ xX])(\])/gm;
    let match: RegExpExecArray | null;
    let n = 0;
    while ((match = rx.exec(text)) !== null) {
      if (n === index) {
        const pos = match.index + match[1].length;
        this.editor.replaceRange(pos, pos + 1, match[2] === " " ? "x" : " ");
        this.statsSoon();
        return;
      }
      n++;
    }
  }

  private removeDrawingReference(rel: string): void {
    const text = this.editor.getText();
    const escaped = rel.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    // 1) linha inteira só com a imagem → remove a linha
    const wholeLine = new RegExp(`^[ \\t]*!\\[[^\\]]*\\]\\(${escaped}(?:\\s+"[^"]*")?\\)[ \\t]*\\r?\\n?`, "m");
    let next = text.replace(wholeLine, "");
    if (next === text) {
      // 2) imagem no meio de um texto → remove só a referência
      const inline = new RegExp(`!\\[[^\\]]*\\]\\(${escaped}(?:\\s+"[^"]*")?\\)`, "g");
      next = text.replace(inline, "");
    }
    if (next !== text) this.editor.setText(next, false);
    this.updatePreview();
  }

  // ---------- pastas de contexto para IA ----------

  private async chooseFolders(cursor?: number): Promise<void> {
    try {
      const paths = await files.pickFolders();
      if (!paths.length) return;
      await this.showFolderContext(paths, "", cursor);
    } catch (e) {
      toast("Não foi possível abrir o seletor de pastas: " + e, "err");
    }
  }

  private async showFolderContext(paths: string[], initialPrompt = "", cursor?: number): Promise<void> {
    try {
      const snapshots = await files.inspectFolders(paths);
      const backdrop = h("div", { class: "modal-backdrop" });
      const modal = h("div", { class: "modal folder-modal" });
      modal.innerHTML = `
        <header class="wm-head">
          <svg class="ic"><use href="#i-folder"/></svg>
          <h2>Pastas de contexto para IA</h2>
          <button class="btn icon" data-close title="Fechar (Esc)"><svg class="ic"><use href="#i-close"/></svg></button>
        </header>
        <div class="folder-modal-body">
          <p class="folder-note">Confira a estrutura selecionada e diga o que você quer pedir à IA. O mdCreator inclui caminhos e nomes no Markdown; não lê o conteúdo dos arquivos.</p>
          <div class="folder-snapshots"></div>
          <label class="folder-prompt-label" for="folder-prompt">O que você quer falar/pedir quando selecionar estas pastas?</label>
          <textarea id="folder-prompt" placeholder="Ex.: Analise a organização deste projeto e sugira onde implementar autenticação…"></textarea>
        </div>
        <footer class="wm-foot">
          <span class="muted">A estrutura será inserida no ponto atual do cursor.</span>
          <span class="dr-spacer"></span>
          <button class="btn" data-cancel>Cancelar</button>
          <button class="btn primary" data-insert>Inserir no Markdown</button>
        </footer>`;
      backdrop.append(modal);
      document.body.append(backdrop);

      const treeHost = modal.querySelector<HTMLElement>(".folder-snapshots")!;
      for (const snap of snapshots) {
        const card = h("section", { class: "folder-snapshot" });
        const title = h("div", { class: "folder-snapshot-title" });
        title.append(
          h("span", { class: "folder-emoji", text: "📁" }),
          h("strong", { text: snap.root })
        );
        const pre = h("pre", { class: "folder-tree", text: this.folderTreeText(snap) });
        card.append(title, pre);
        if (snap.truncated) card.append(h("div", { class: "folder-truncated", text: "Estrutura limitada: a pasta tem muitos itens ou níveis." }));
        treeHost.append(card);
      }

      const textarea = modal.querySelector<HTMLTextAreaElement>("#folder-prompt")!;
      textarea.value = initialPrompt;
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
        if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
          e.preventDefault();
          modal.querySelector<HTMLButtonElement>("[data-insert]")!.click();
        }
      };
      document.addEventListener("keydown", onKey, true);
      backdrop.addEventListener("mousedown", (e) => {
        if (e.target === backdrop) close();
      });
      modal.querySelectorAll<HTMLElement>("[data-close], [data-cancel]").forEach((b) => b.addEventListener("click", close));
      modal.querySelector<HTMLButtonElement>("[data-insert]")!.addEventListener("click", () => {
        const prompt = textarea.value.trim();
        if (!prompt) {
          textarea.focus();
          toast("Escreva o que você quer pedir para a IA sobre estas pastas.", "info");
          return;
        }
        const snippet = this.folderMarkdown(snapshots, prompt);
        if (cursor === undefined) this.editor.insert(snippet);
        else this.editor.insertAt(cursor, snippet);
        this.linkFolders(paths);
        close();
        toast("Estrutura e instrução inseridas no Markdown.", "ok");
      });
      textarea.focus();
    } catch (e) {
      toast("Não foi possível ler a estrutura das pastas: " + e, "err");
    }
  }

  private folderTreeText(snapshot: files.FolderSnapshot): string {
    if (!snapshot.entries.length) return "(pasta vazia ou sem itens acessíveis)";
    return snapshot.entries.map((entry) => {
      const depth = entry.relative.split("/").length - 1;
      const indent = "  ".repeat(depth);
      return `${indent}├── ${entry.name}${entry.directory ? "/" : ""}`;
    }).join("\n");
  }

  private folderMarkdown(snapshots: files.FolderSnapshot[], prompt: string): string {
    const chunks = ["", "## Contexto de pastas para a IA", "", `**O que preciso:** ${prompt.replace(/\r?\n/g, "\n> ")}`, "", "> Abaixo estão os caminhos e nomes encontrados. Os arquivos não foram lidos; use estes diretórios como referência no projeto/contexto fornecido.", ""];
    for (const snap of snapshots) {
      chunks.push(`### Pasta: \`${snap.root.replace(/`/g, "'")}\``, "", "````text", this.folderTreeText(snap), "````", "");
    }
    return chunks.join("\n");
  }

  private linkFolders(paths: string[]): void {
    const map = new Map(this.linkedFolders.map((f) => [f.path.toLowerCase(), f]));
    for (const path of paths) {
      const name = path.replace(/[\\/]+$/, "").split(/[\\/]/).pop() || path;
      map.set(path.toLowerCase(), { path, name });
    }
    this.linkedFolders = Array.from(map.values()).slice(-20);
    saveJSON("mdc.linked-folders", this.linkedFolders);
    this.renderLinkedFolders();
  }

  private renderLinkedFolders(): void {
    const host = document.getElementById("linked-folders-list");
    if (!host) return; // agora as pastas ficam no menu "⋯"
    host.innerHTML = "";
    if (!this.linkedFolders.length) {
      host.append(h("div", { class: "side-empty", text: "Nenhuma pasta vinculada" }));
      return;
    }
    for (const folder of this.linkedFolders) {
      const row = h("div", { class: "recent linked-folder" });
      const open = h("button", { class: "recent-btn", title: folder.path });
      open.append(h("span", { class: "recent-name", text: folder.name }), h("span", { class: "recent-dir", text: folder.path }));
      open.addEventListener("click", () => void this.showFolderContext([folder.path]));
      const remove = h("button", { class: "recent-x", text: "×", title: "Desvincular pasta" });
      remove.addEventListener("click", (e) => {
        e.stopPropagation();
        this.linkedFolders = this.linkedFolders.filter((x) => x.path !== folder.path);
        saveJSON("mdc.linked-folders", this.linkedFolders);
        this.renderLinkedFolders();
      });
      row.append(open, remove);
      host.append(row);
    }
  }

  private setupEditorInteractions(): void {
    const editorHost = $("#editor");
    editorHost.addEventListener("click", (e) => {
      const target = e.target as HTMLElement;
      if (target.closest(".cm-content") || target.closest(".cm-gutters")) return;
      this.editor.focusAt(e.clientX, e.clientY);
    });
    editorHost.addEventListener("contextmenu", (e) => {
      e.preventDefault();
      const cursor = this.editor.selectionPos().from;
      document.querySelector(".editor-context-menu")?.remove();
      const menu = h("div", { class: "editor-context-menu" });
      const folderButton = h("button", { class: "context-menu-item" });
      folderButton.innerHTML = '<svg class="ic"><use href="#i-folder"/></svg><span>Pasta</span><kbd>contexto</kbd>';
      folderButton.addEventListener("click", () => {
        menu.remove();
        void this.chooseFolders(cursor);
      });
      menu.append(folderButton);
      for (const folder of this.linkedFolders.slice(-3).reverse()) {
        const quick = h("button", { class: "context-menu-item", title: folder.path });
        quick.innerHTML = '<svg class="ic"><use href="#i-folder"/></svg>';
        quick.append(h("span", { text: folder.name }));
        quick.addEventListener("click", () => {
          menu.remove();
          void this.showFolderContext([folder.path]);
        });
        menu.append(quick);
      }
      document.body.append(menu);
      const x = Math.min(e.clientX, window.innerWidth - menu.offsetWidth - 8);
      const y = Math.min(e.clientY, window.innerHeight - menu.offsetHeight - 8);
      menu.style.left = `${Math.max(8, x)}px`;
      menu.style.top = `${Math.max(8, y)}px`;
      const dismiss = (ev: MouseEvent) => {
        if (!menu.contains(ev.target as Node)) {
          menu.remove();
          document.removeEventListener("mousedown", dismiss, true);
        }
      };
      document.addEventListener("mousedown", dismiss, true);
    });
  }

  // ---------- diagramas (Mermaid) ----------

  /** Abre o construtor de diagramas (campos simples + pré-visualização). */
  private newDiagram(): void {
    openDiagramBuilder({
      dark: document.documentElement.dataset.theme === "dark",
      onInsert: (code) => {
        this.editor.insert("\n```mermaid\n" + code + "\n```\n");
        this.updatePreview();
        toast("Diagrama inserido no documento.", "ok", 2600);
      },
    });
  }

  /** Reabre um diagrama existente no construtor (substituindo o bloco). */
  private editDiagram(code: string): void {
    const range = this.findFencedBlock("mermaid", code);
    openDiagramBuilder({
      initialCode: code,
      dark: document.documentElement.dataset.theme === "dark",
      onInsert: (newCode) => {
        const block = "```mermaid\n" + newCode + "\n```\n";
        if (range) this.editor.replaceRange(range.from, range.to, block);
        else this.editor.insert("\n" + block + "\n");
        this.updatePreview();
        toast("Diagrama atualizado no documento.", "ok", 2600);
      },
    });
  }

  /** Localiza um bloco ```lang com esse conteúdo e devolve os deslocamentos no documento. */
  private findFencedBlock(lang: string, body: string): { from: number; to: number } | null {
    const text = this.editor.getText();
    const lines = text.split("\n");
    const offsetOf = (index: number) => lines.slice(0, index).reduce((n, l) => n + l.length + 1, 0);
    const target = body.replace(/\s+$/, "").trim();
    let i = 0;
    while (i < lines.length) {
      const fence = /^([ \t]*)(`{3,}|~{3,})[ \t]*([a-zA-Z0-9_-]*)[ \t]*$/.exec(lines[i]);
      if (!fence || (fence[3] || "").toLowerCase() !== lang) {
        i++;
        continue;
      }
      const bodyStart = i + 1;
      let j = bodyStart;
      while (j < lines.length && !/^[ \t]*(`{3,}|~{3,})[ \t]*$/.test(lines[j])) j++;
      const inner = lines.slice(bodyStart, j).join("\n");
      if (inner.trim() === target) {
        return { from: offsetOf(i), to: Math.min(offsetOf(Math.min(j + 1, lines.length)), text.length) };
      }
      i = j + 1;
    }
    return null;
  }

  // ---------- IA / exportação ----------

  private async copyForAI(): Promise<void> {
    const text = this.editor.getText();
    if (!text.trim()) {
      toast("Nada para copiar ainda.", "info");
      return;
    }
    const ok = await copyText(text);
    const hasImages = /!\[[^\]]*\]\(([^)]*assets\/|[^)]*\.(png|jpe?g|gif|webp|svg))/i.test(text);
    if (!ok) {
      toast("Não foi possível copiar.", "err");
      return;
    }
    toast(
      hasImages
        ? "Markdown copiado. Para enviar as imagens junto, use Pacote IA e anexe o ZIP."
        : "Markdown copiado para a área de transferência.",
      "ok",
      hasImages ? 6500 : 3200
    );
  }

  private async exportHtml(): Promise<void> {
    const text = this.editor.getText();
    if (!text.trim()) {
      toast("Documento vazio — nada para exportar.", "info");
      return;
    }
    const base = this.path ? stripExt(baseName(this.path)) : "documento";
    const target = await files.pickSaveHtml(`${base}.html`);
    if (!target) return;
    try {
      await this.preview.render(text);
      const html = getExportHtml($("#preview"), base, mdCss);
      await files.saveDoc(target, html);
      toast(`HTML exportado: ${baseName(target)}`, "ok");
      void revealItemInDir(target).catch(() => {});
    } catch (e) {
      toast("Falha ao exportar: " + e, "err");
    }
  }

  private async exportPortableBundle(): Promise<void> {
    if (!this.path) {
      if (!(await this.save(true))) return;
    } else if (this.dirty && !(await this.save(false))) {
      return;
    }
    if (!this.path) return;

    const suggested = `${stripExt(baseName(this.path))}-para-ia.zip`;
    const target = await files.pickSaveBundle(joinPath(docDirOf(this.path), suggested));
    if (!target) return;
    try {
      const count = await files.exportPortableBundle(this.path, this.editor.getText(), target);
      toast(
        `Pacote criado com o Markdown e ${count} imagem(ns) local(is). Envie o ZIP inteiro para a IA. URLs externas precisam de internet.`,
        "ok",
        6500
      );
      void revealItemInDir(target).catch(() => {});
    } catch (e) {
      toast("Não foi possível criar o pacote: " + e, "err", 7000);
    }
  }

  // ---------- boas-vindas ----------

  private showWelcome(): void {
    const backdrop = h("div", { class: "modal-backdrop" });
    const modal = h("div", { class: "modal welcome-modal" });
    modal.innerHTML = `
      <header class="wm-head">
        <svg class="ic"><use href="#i-help"/></svg>
        <h2>Boas-vindas</h2>
        <button class="btn icon" data-close title="Fechar (Esc)"><svg class="ic"><use href="#i-close"/></svg></button>
      </header>
      <div class="wm-body">${welcomeHtml()}</div>
      <footer class="wm-foot">
        <span class="muted">Dica: F1 abre esta tela a qualquer momento.</span>
        <span class="dr-spacer"></span>
        <button class="btn" data-open>Abrir arquivo…</button>
        <button class="btn primary" data-start>Começar a escrever</button>
      </footer>`;
    backdrop.append(modal);
    document.body.append(backdrop);

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
    modal.querySelectorAll<HTMLElement>("[data-close]").forEach((b) => b.addEventListener("click", close));
    modal.querySelector<HTMLElement>("[data-start]")!.addEventListener("click", () => {
      close();
      this.editor.focus();
    });
    modal.querySelector<HTMLElement>("[data-open]")!.addEventListener("click", () => {
      close();
      void this.openDocDialog();
    });
  }

  // ---------- barra de ferramentas ----------

  private act(name: string): void {
    switch (name) {
      case "heading":
        this.editor.cycleHeading();
        break;
      case "bold":
        this.editor.wrapSelection("**", "**", "texto");
        break;
      case "italic":
        this.editor.wrapSelection("*", "*", "texto");
        break;
      case "strike":
        this.editor.wrapSelection("~~", "~~", "texto");
        break;
      case "code":
        this.editor.wrapSelection("`", "`", "código");
        break;
      case "codeblock":
        this.editor.insert("\n```\n$0\n```\n");
        break;
      case "quote":
        this.editor.toggleLinePrefix("> ");
        break;
      case "list":
        this.editor.toggleLinePrefix("- ");
        break;
      case "olist":
        this.editor.toggleLinePrefix("1. ");
        break;
      case "task":
        this.editor.toggleLinePrefix("- [ ] ");
        break;
      case "link":
        this.editor.wrapSelection("[", "](https://)", "texto do link");
        break;
      case "align-left":
        this.editor.setAlignment("left");
        break;
      case "align-center":
        this.editor.setAlignment("center");
        break;
      case "align-right":
        this.editor.setAlignment("right");
        break;
      case "align-justify":
        this.editor.setAlignment("justify");
        break;
      case "mark":
        this.editor.wrapSelection("<mark>", "</mark>", "destaque");
        break;
      case "small":
        // letras menores (Markdown não tem tamanho de fonte; <small> é HTML seguro e simples)
        this.editor.wrapSelection("<small>", "</small>", "texto menor");
        break;
      case "table":
        this.editor.insert(TABLE_SNIPPET);
        break;
      case "hr":
        this.editor.insert("\n---\n");
        break;
      case "mermaid":
        this.newDiagram();
        break;
      case "ai-template":
        this.editor.insert(AI_TEMPLATE);
        break;
      case "image":
        void this.insertImageFromDialog();
        break;
      case "draw":
        this.openDraw();
        break;
    }
  }

  // ---------- menus suspensos ("⋯") ----------

  private closeMenus(): void {
    document.querySelectorAll(".dropdown").forEach((m) => m.remove());
  }

  private openMenu(anchor: HTMLElement, build: (menu: HTMLElement) => void): void {
    const wasOpen = !!document.querySelector(".dropdown");
    this.closeMenus();
    if (wasOpen) return;
    const menu = h("div", { class: "dropdown" });
    build(menu);
    document.body.append(menu);
    const r = anchor.getBoundingClientRect();
    const w = menu.offsetWidth;
    const left = Math.max(8, Math.min(r.right - w, window.innerWidth - w - 8));
    menu.style.left = `${left}px`;
    menu.style.top = `${Math.min(r.bottom + 6, window.innerHeight - menu.offsetHeight - 8)}px`;
    const dismiss = (ev: MouseEvent) => {
      if (!menu.contains(ev.target as Node)) {
        this.closeMenus();
        document.removeEventListener("mousedown", dismiss, true);
      }
    };
    document.addEventListener("mousedown", dismiss, true);
  }

  private ddItem(
    menu: HTMLElement,
    opts: { icon?: string; label: string; hint?: string; checked?: boolean; onPick: () => void }
  ): void {
    const btn = h("button", { class: "dd-item", type: "button" });
    if (opts.icon) btn.innerHTML = `<svg class="ic"><use href="#${opts.icon}"/></svg>`;
    btn.append(h("span", { text: opts.label }));
    if (opts.hint) btn.append(h("span", { class: "dd-hint", text: opts.hint }));
    if (opts.checked) btn.insertAdjacentHTML("beforeend", '<svg class="ic dd-check"><use href="#i-check"/></svg>');
    btn.addEventListener("click", () => {
      this.closeMenus();
      opts.onPick();
    });
    menu.append(btn);
  }

  private ddSep(menu: HTMLElement): void {
    menu.append(h("div", { class: "dd-sep" }));
  }

  private ddNote(menu: HTMLElement, text: string): void {
    menu.append(h("div", { class: "dd-note", text }));
  }

  private buildMoreMenu(menu: HTMLElement): void {
    this.ddItem(menu, { icon: "i-saveas", label: "Salvar como…", hint: "Ctrl+Shift+S", onPick: () => void this.save(true) });
    this.ddSep(menu);
    this.ddItem(menu, { icon: "i-copy", label: "Copiar para a IA", hint: "Ctrl+Shift+C", onPick: () => void this.copyForAI() });
    this.ddItem(menu, { icon: "i-export", label: "Exportar HTML", hint: "Ctrl+Shift+E", onPick: () => void this.exportHtml() });
    this.ddItem(menu, { icon: "i-folder", label: "Pacote IA (.zip)", hint: "tudo junto", onPick: () => void this.exportPortableBundle() });
    this.ddSep(menu);
    this.ddItem(menu, { icon: "i-folder", label: "Vincular pastas (contexto)…", onPick: () => void this.chooseFolders() });
    for (const folder of this.linkedFolders.slice(-3).reverse()) {
      this.ddItem(menu, { label: folder.name, hint: folder.path, onPick: () => void this.showFolderContext([folder.path]) });
    }
    this.ddSep(menu);
    this.ddItem(menu, { icon: "i-check", label: "Revisar texto", hint: "F7", onPick: () => this.openReview() });
    this.ddItem(menu, {
      icon: "i-align-left",
      label: "Reparar alinhamentos",
      hint: "conserta <div> sobrando",
      onPick: () => this.repairAlignments(),
    });
    this.ddItem(menu, {
      icon: "i-check",
      label: "Correção automática",
      hint: "ao terminar o parágrafo e ao salvar",
      checked: this.autoFix,
      onPick: () => this.setAutoFix(!this.autoFix),
    });
    this.ddSep(menu);
    this.ddItem(menu, {
      icon: "i-sidebar",
      label: "Painel lateral",
      checked: !document.body.classList.contains("no-sidebar"),
      onPick: () => this.toggle("no-sidebar"),
    });
    this.ddItem(menu, {
      icon: "i-eye",
      label: "Pré-visualização",
      checked: !document.body.classList.contains("no-preview"),
      onPick: () => this.toggle("no-preview"),
    });
    const dark = document.documentElement.dataset.theme === "dark";
    this.ddItem(menu, { icon: dark ? "i-sun" : "i-moon", label: "Tema escuro", checked: dark, onPick: () => this.applyTheme(!dark) });
    this.ddSep(menu);
    this.ddItem(menu, { icon: "i-help", label: "Boas-vindas e ajuda", hint: "F1", onPick: () => this.showWelcome() });
  }

  private buildDrawStyleMenu(menu: HTMLElement): void {
    const current = loadJSON<string>("mdc.drawstyle", "image") === "text" ? "text" : "image";
    this.ddItem(menu, {
      icon: "i-image",
      label: "Imagem (PNG)",
      checked: current === "image",
      onPick: () => this.setDrawStyle("image"),
    });
    this.ddItem(menu, {
      icon: "i-draw",
      label: "Letras e símbolos",
      hint: "texto puro",
      checked: current === "text",
      onPick: () => this.setDrawStyle("text"),
    });
    this.ddNote(menu, "Imagem guarda um PNG em assets/. Letras vira texto no próprio Markdown — ideal para mandar à IA.");
  }

  private setDrawStyle(style: "image" | "text"): void {
    saveJSON("mdc.drawstyle", style);
    toast(
      style === "text"
        ? "Desenho em letras e símbolos: entra direto no Markdown."
        : "Desenho em imagem: vira PNG na pasta assets/.",
      "info",
      2600
    );
  }

  private setupToolbar(): void {
    $$("[data-act]").forEach((btn) => {
      const name = btn.dataset.act!;
      btn.addEventListener("click", () => {
        switch (name) {
          case "new":
            void this.newDoc();
            break;
          case "open":
            void this.openDocDialog();
            break;
          case "save":
            void this.save(false);
            break;
          case "save-as":
            void this.save(true);
            break;
          case "copy-ai":
            void this.copyForAI();
            break;
          case "welcome":
            this.showWelcome();
            break;
          case "folders":
            void this.chooseFolders();
            break;
          case "export-html":
            void this.exportHtml();
            break;
          case "export-bundle":
            void this.exportPortableBundle();
            break;
          case "toggle-more": {
            const box = document.querySelector<HTMLElement>("#toolbar-more");
            if (box) {
              const show = box.hidden;
              box.hidden = !show;
              saveJSON("mdc.toolbar-more", show);
              btn.classList.toggle("active", show);
            }
            break;
          }
          case "toggle-sidebar":
            this.toggle("no-sidebar");
            break;
          case "toggle-preview":
            this.toggle("no-preview");
            break;
          case "theme":
            this.applyTheme(document.documentElement.dataset.theme !== "dark");
            break;
          default:
            this.act(name);
            break;
        }
      });
    });

    // menus "⋯"
    $$("[data-menu]").forEach((btn) => {
      const which = btn.dataset.menu!;
      btn.addEventListener("click", () => {
        if (which === "more") this.openMenu(btn, (m) => this.buildMoreMenu(m));
        else if (which === "draw-style") this.openMenu(btn, (m) => this.buildDrawStyleMenu(m));
      });
    });

    // estado da barra de formatação expandida
    const moreBox = document.querySelector<HTMLElement>("#toolbar-more");
    if (moreBox && loadJSON<boolean>("mdc.toolbar-more", false)) {
      moreBox.hidden = false;
      document.querySelector("#tb-more")?.classList.add("active");
    }
  }

  private toggle(cls: string): void {
    const on = document.body.classList.toggle(cls);
    saveJSON(`mdc.${cls}`, on);
  }

  private setupKeys(): void {
    window.addEventListener("keydown", (e) => {
      if (e.key === "F1") {
        e.preventDefault();
        this.showWelcome();
        return;
      }
      if (e.key === "F7") {
        e.preventDefault();
        this.openReview();
        return;
      }
      const ctrl = e.ctrlKey || e.metaKey;
      if (!ctrl) return;
      const k = e.key.toLowerCase();
      const inModal = !!document.querySelector(".modal-backdrop");
      if (k === "s") {
        e.preventDefault();
        if (!inModal) void this.save(e.shiftKey);
        return;
      }
      if (inModal) return;
      if (k === "o") {
        e.preventDefault();
        void this.openDocDialog();
      } else if (k === "n") {
        e.preventDefault();
        void this.newDoc();
      } else if (e.shiftKey && k === "d") {
        e.preventDefault();
        void this.openDraw();
      } else if (e.shiftKey && k === "c") {
        e.preventDefault();
        void this.copyForAI();
      } else if (e.shiftKey && k === "e") {
        e.preventDefault();
        void this.exportHtml();
      } else if (k === "b") {
        e.preventDefault();
        this.act("bold");
      } else if (k === "i") {
        e.preventDefault();
        this.act("italic");
      }
    });
  }

  // ---------- painel lateral / status ----------

  private addRecent(path: string): void {
    this.recents = [{ path, at: Date.now() }, ...this.recents.filter((r) => r.path.toLowerCase() !== path.toLowerCase())].slice(0, 8);
    saveJSON("mdc.recents", this.recents);
    this.renderRecents();
  }

  private renderRecents(): void {
    const host = $("#recents-list");
    host.innerHTML = "";
    if (!this.recents.length) {
      host.append(h("div", { class: "side-empty", text: "Nenhum arquivo aberto ainda" }));
      return;
    }
    for (const r of this.recents) {
      const item = h("div", { class: "recent" });
      const btn = h("button", { class: "recent-btn", title: r.path });
      btn.append(
        h("span", { class: "recent-name", text: baseName(r.path) }),
        h("span", { class: "recent-dir", text: docDirOf(r.path) })
      );
      btn.addEventListener("click", () => void this.openPath(r.path));
      const rm = h("button", { class: "recent-x", text: "×", title: "Remover da lista" });
      rm.addEventListener("click", (e) => {
        e.stopPropagation();
        this.recents = this.recents.filter((x) => x.path !== r.path);
        saveJSON("mdc.recents", this.recents);
        this.renderRecents();
      });
      item.append(btn, rm);
      host.append(item);
    }
  }

  private renderOutline(): void {
    const host = $("#outline");
    const lines = this.editor.getText().split("\n");
    let inFence = false;
    const items: { level: number; text: string; line: number }[] = [];
    lines.forEach((l, i) => {
      if (/^\s*(```|~~~)/.test(l)) {
        inFence = !inFence;
        return;
      }
      if (inFence) return;
      const m = /^(#{1,6})\s+(.+)$/.exec(l);
      if (m) items.push({ level: m[1].length, text: m[2].replace(/\s+#+\s*$/, "").trim(), line: i + 1 });
    });

    host.innerHTML = "";
    if (!items.length) {
      host.append(h("div", { class: "side-empty", text: "Sem títulos ainda" }));
      return;
    }
    for (const it of items) {
      const btn = h("button", { class: `outline-item lv${it.level}`, title: `Ir para a linha ${it.line}`, text: it.text });
      btn.addEventListener("click", () => this.editor.gotoLine(it.line));
      host.append(btn);
    }
  }

  private updateStats(): void {
    const text = this.editor.getText();
    const words = (text.match(/[\p{L}\p{N}_'-]+/gu) || []).length;
    const lines = text ? text.split("\n").length : 1;
    $("#st-words").textContent = `${words} ${words === 1 ? "palavra" : "palavras"}`;
    $("#st-chars").textContent = `${text.length} caracteres`;
    $("#st-lines").textContent = `${lines} ${lines === 1 ? "linha" : "linhas"}`;
    $("#st-cursor").textContent = `Ln ${this.cursor.line}, Col ${this.cursor.col}`;
  }

  private setSaveState(): void {
    const el = $("#save-state");
    el.textContent = this.dirty
      ? "Alterações não salvas"
      : this.isDraft
        ? "Rascunho (no app)"
        : this.statusSaved;
    el.classList.toggle("dirty", this.dirty);
  }

  private refreshTitle(): void {
    const name = this.path ? baseName(this.path) : `${this.title ?? "Sem título"}.md`;
    $("#doc-title").textContent = name;
    const dot = $("#dirty-dot");
    dot.hidden = !this.dirty;
    const title = `${this.dirty ? "• " : ""}${name} — mdCreator`;
    document.title = title;
    // Fora do Tauri (ex.: preview no navegador) a API não existe: seguimos em silêncio.
    try {
      void getCurrentWindow()
        .setTitle(title)
        .catch(() => {});
    } catch {
      /* sem janela nativa */
    }
  }

  private refreshPath(): void {
    const btn = $("#st-path") as HTMLButtonElement;
    if (!this.path) {
      btn.hidden = true;
      return;
    }
    btn.hidden = false;
    btn.textContent = this.isDraft ? "Rascunho do app" : docDirOf(this.path);
    btn.title = this.isDraft
      ? `Rascunho guardado em: ${docDirOf(this.path)} (clique para abrir a pasta)`
      : `Mostrar ${baseName(this.path)} na pasta`;
  }

  // ---------- tema / layout ----------

  private initialDark(): boolean {
    const saved = localStorage.getItem("mdc.theme");
    if (saved === "dark") return true;
    if (saved === "light") return false;
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  }

  private applyTheme(dark: boolean, rerender = true): void {
    document.documentElement.dataset.theme = dark ? "dark" : "light";
    localStorage.setItem("mdc.theme", dark ? "dark" : "light");
    this.editor?.setTheme(dark);
    this.preview?.setDark(dark);
    const btn = document.querySelector<HTMLElement>("#btn-theme");
    if (btn) btn.innerHTML = `<svg class="ic"><use href="#${dark ? "i-sun" : "i-moon"}"/></svg>`;
    if (rerender && this.editor) void this.preview.render(this.editor.getText());
  }

  private setupSplitter(): void {
    const sp = $("#splitter");
    const body = $("#body");
    const editorPane = $("#editor-wrap");
    const previewPane = $("#preview-wrap");

    // A largura distribuível exclui o divisor físico. Os limites mínimos
    // preservam espaço para o editor e para o cartão de boas-vindas do preview.
    const region = () => {
      const r = body.getBoundingClientRect();
      const sidebarHidden = document.body.classList.contains("no-sidebar");
      const left = sidebarHidden ? r.left : $("#sidebar").getBoundingClientRect().right;
      const divider = sp.getBoundingClientRect().width;
      const free = Math.max(1, r.right - left - divider);
      const minEditor = Math.min(280, free * 0.36);
      const minPreview = Math.min(300, free * 0.44);
      editorPane.style.minWidth = `${minEditor}px`;
      previewPane.style.minWidth = `${minPreview}px`;
      return {
        left,
        divider,
        free,
        minRatio: minEditor / free,
        maxRatio: 1 - minPreview / free,
      };
    };

    const applyRatio = (raw: number) => {
      const bounds = region();
      const x = clamp(raw, bounds.minRatio, bounds.maxRatio);
      body.style.setProperty("--lg", String(x));
      body.style.setProperty("--rg", String(1 - x));
      return x;
    };

    region();
    const saved = Number(localStorage.getItem("mdc.split"));
    if (Number.isFinite(saved) && saved > 0 && saved < 1) applyRatio(saved);

    let dragging = false;
    let grabOffset = 0;
    sp.addEventListener("pointerdown", (e) => {
      dragging = true;
      const rect = sp.getBoundingClientRect();
      grabOffset = e.clientX - (rect.left + rect.width / 2);
      try {
        sp.setPointerCapture(e.pointerId);
      } catch {
        /* ignora */
      }
      document.body.classList.add("resizing");
      e.preventDefault();
    });
    sp.addEventListener("pointermove", (e) => {
      if (!dragging) return;
      const bounds = region();
      const center = e.clientX - grabOffset;
      const ratio = (center - bounds.left - bounds.divider / 2) / bounds.free;
      applyRatio(ratio);
    });
    const stop = (e: PointerEvent) => {
      if (!dragging) return;
      dragging = false;
      try {
        if (sp.hasPointerCapture(e.pointerId)) sp.releasePointerCapture(e.pointerId);
      } catch {
        /* ignora */
      }
      document.body.classList.remove("resizing");
      const v = body.style.getPropertyValue("--lg");
      if (v) localStorage.setItem("mdc.split", v);
    };
    sp.addEventListener("pointerup", stop);
    sp.addEventListener("pointercancel", stop);
    sp.addEventListener("dblclick", () => {
      body.style.removeProperty("--lg");
      body.style.removeProperty("--rg");
      localStorage.removeItem("mdc.split");
    });
    window.addEventListener("resize", () => {
      region();
      const current = Number(body.style.getPropertyValue("--lg"));
      if (Number.isFinite(current) && current > 0 && current < 1) applyRatio(current);
    });
  }

  private syncPreviewScroll(): void {
    const sc = this.editor.view.scrollDOM;
    const max = sc.scrollHeight - sc.clientHeight;
    if (max <= 0) return;
    const p = sc.scrollTop / max;
    const pv = $("#preview-wrap");
    pv.scrollTop = p * (pv.scrollHeight - pv.clientHeight);
  }
}

const app = new App();
// gancho de depuração (útil para inspecionar/testar o app em execução)
(window as unknown as Record<string, unknown>).__mdcreator = { app };
void app.start().catch((e) => {
  console.error(e);
  toast("Erro ao iniciar o mdCreator: " + e, "err", 8000);
});
