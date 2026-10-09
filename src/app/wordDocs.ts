// Documentos Word (.docx) dentro do app: criar, abrir, salvar e fechar com segurança.

import type { App } from "./app";
import * as files from "../files";
import { newTab, tabLabel, type DocTab } from "../tabs";
import { moveHistory } from "../history";
import { moveCommits } from "../snapshots";
import { type WordTabData } from "../word/host";
import { importDocx } from "../word/docxImport";
import { exportDocx } from "../word/docxExport";
import { deserialize as wordDeserialize, serialize as wordSerialize, type PageSetup } from "../word/model";
import { plainText } from "../word/schema";
import { type Node as PMNode } from "prosemirror-model";
import { bytesToBase64 } from "../util";
import { $, h, toast, baseName, joinPath, fmtTime, slugify } from "../util";

export const wordDocsMethods = {
  /** Cria uma aba de documento Word (sem ativá-la). */
  addWordTab(this: App, data: WordTabData, init: Partial<DocTab> = {}): DocTab {
    const tab = newTab(this.editor.createState(""), { kind: "word", word: data, title: "Documento", statusSaved: "Novo documento Word", ...init });
    this.tabs.push(tab);
    return tab;
  },

  async newWordDoc(this: App): Promise<void> {
    const tab = this.addWordTab(this.wordHost.createTab());
    await this.switchTo(tab.id);
    this.wordHost.focus();
  },

  async readDocx(this: App, path: string): Promise<{ doc: PMNode; setup: PageSetup }> {
    const url = await files.readDataUrl(path);
    const bin = atob(url.slice(url.indexOf(",") + 1));
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return await importDocx(bytes);
  },

  async addDocxTab(this: App, path: string, isDraft = false): Promise<DocTab> {
    const { doc, setup } = await this.readDocx(path);
    return this.addWordTab(this.wordHost.createTab(doc, setup), {
      path,
      isDraft,
      title: null,
      statusSaved: isDraft ? "Rascunho guardado no app" : `Aberto às ${fmtTime()}`,
    });
  },

  async openDocx(this: App, path: string): Promise<boolean> {
    try {
      const tab = await this.addDocxTab(path);
      this.addRecent(path);
      const current = this.tab;
      const reuse = current.kind !== "word" && !current.path && !current.dirty && this.textOf(current).length === 0;
      await this.switchTo(tab.id);
      if (reuse && this.tab === tab) {
        this.tabs = this.tabs.filter((t) => t !== current);
        this.afterTabChange();
      }
      return true;
    } catch (e) {
      toast("Não foi possível abrir o documento do Word: " + e, "err", 7000);
      return false;
    }
  },

  enterWord(this: App, target: DocTab): void {
    document.body.classList.add("word-open");
    $("#word-pane").hidden = false;
    this.wordHost.load(target.word!);
    this.outline?.useCollapsed(target.outlineCollapsed);
    this.afterTabChange();
    // o log de alterações começa do texto que está abrindo
    this.markText(this.wordSerialized(target));
    this.wordHost.focus();
  },

  leaveWord(this: App): void {
    document.body.classList.remove("word-open");
  },

  onWordChange(this: App): void {
    if (this.tab.kind !== "word") return;
    const was = this.dirty;
    this.dirty = true;
    if (!was) this.refreshTitle();
    this.setSaveState();
    this.outlineSoon();
    this.autosaveSoon();
    // log de alterações: o Word também é serializado em texto, então o patch serve
    this.recordSerializedChange(this.wordSerialized(this.tab));
  },

  /** Contagens do documento Word mudaram: rodapé e destaque da seção atual. */
  wordStatus(this: App): void {
    if (this.tab.kind !== "word") return;
    this.updateStats();
    this.outline?.setCursorLine(this.wordHost.cursorLine());
  },

  wordProjection(this: App, serialized: string): string {
    const r = wordDeserialize(serialized);
    return r ? plainText(r.doc) : serialized;
  },

  /** Grava o .docx de uma aba (a ativa lê do editor; as outras, do estado guardado). */
  async writeDocx(this: App, tab: DocTab, path: string): Promise<void> {
    const live = tab === this.tab;
    const doc = live ? this.wordHost.doc() : tab.word!.state.doc;
    const setup = live ? this.wordHost.setup() : tab.word!.setup;
    const bytes = await exportDocx(doc, setup, tabLabel(tab));
    await files.saveBinary(path, bytesToBase64(bytes));
  },

  wordSerialized(this: App, tab: DocTab): string {
    return tab === this.tab ? this.wordHost.serialized() : wordSerialize(tab.word!.state.doc, tab.word!.setup);
  },

  /** Documento novo ainda sem arquivo: cria o rascunho (.docx) na pasta do app. */
  async ensureWordFile(this: App): Promise<boolean> {
    const tab = this.tab;
    if (tab.path) return true;
    try {
      tab.path = await files.draftPath(slugify(tabLabel(tab)) || "documento", "docx");
      tab.isDraft = true;
      await this.writeDocx(tab, tab.path);
      tab.dirty = false;
      tab.statusSaved = "Rascunho guardado no app";
      this.afterSave(tab);
      this.saveSession();
      return true;
    } catch (e) {
      toast("Não consegui guardar o rascunho: " + e, "err", 6000);
      return false;
    }
  },

  /**
   * Salvamento automático do Word. Rascunhos do app são regravados sempre; arquivos SEUS só
   * são gravados em Salvar — o motor pode simplificar recursos que ainda não entende
   * (comentários, revisões, campos). O histórico guarda cópias de qualquer jeito.
   */
  async autosaveWord(this: App): Promise<void> {
    if (!this.settings.autosaveOn) return;
    const tab = this.tab;
    if (tab.kind !== "word" || !tab.dirty) return;
    if (tab.path && !tab.isDraft) {
      this.recordVersion(tab.path, this.wordHost.serialized());
      return;
    }
    try {
      if (!tab.path) {
        tab.path = await files.draftPath(slugify(tabLabel(tab)) || "documento", "docx");
        tab.isDraft = true;
      }
      await this.writeDocx(tab, tab.path);
      tab.dirty = false;
      tab.statusSaved = `Rascunho atualizado às ${fmtTime()}`;
      this.recordVersion(tab.path, this.wordSerialized(tab));
      // uma cópia em disco por dia, mesmo sem salvar (cobre o "esqueci de salvar")
      this.backupOnceADay(tab.path);
      this.afterSave(tab);
      this.saveSession();
    } catch {
      /* sem acesso a arquivos (navegador): segue sem salvar */
    }
  },

  async saveWord(this: App, saveAs: boolean): Promise<boolean> {
    const tab = this.tab;
    try {
      const previous = tab.path;
      const wasDraft = tab.isDraft;
      if (saveAs || !tab.path || wasDraft) {
        const suggested = `${tabLabel(tab)}.docx`;
        let defaultPath = suggested;
        try {
          defaultPath = joinPath(await files.defaultDocsDir(), suggested);
        } catch {
          /* só o nome */
        }
        const picked = await files.pickSaveAny(defaultPath, "Documento do Word", ["docx"]);
        if (!picked) return false;
        tab.path = /\.docx$/i.test(picked) ? picked : `${picked.replace(/\.[a-zA-Z0-9]+$/, "")}.docx`;
        tab.isDraft = false;
        tab.title = null;
      }
      await this.writeDocx(tab, tab.path!);
      if (wasDraft && previous && previous !== tab.path) void files.deleteDraft(previous).catch(() => {});
      if (previous && previous !== tab.path) {
        void moveHistory(previous, tab.path!);
        void moveCommits(previous, tab.path!);
      }
      tab.dirty = false;
      tab.statusSaved = `Salvo às ${fmtTime()}`;
      this.recordVersion(tab.path!, this.wordSerialized(tab), true);
      // cópia real em disco (o .docx é binário: a cópia é do arquivo inteiro)
      void this.backupNow(tab.path!, "salvar");
      void this.exportLog(tab.path!);
      this.addRecent(tab.path!);
      this.setPreviewPath(tab.path);
      this.afterTabChange();
      if (!this.docxNotice) {
        this.docxNotice = true;
        toast("Salvo como .docx. Se o arquivo veio do Word, recursos que o mdOffice ainda não entende (comentários, revisões, campos) podem ser simplificados.", "info", 7500);
      } else toast(`Documento salvo em ${baseName(tab.path!)}`, "ok", 2600);
      return true;
    } catch (e) {
      toast("Erro ao salvar: " + e, "err", 7000);
      return false;
    }
  },

  /** Antes de fechar uma aba Word: rascunhos ficam guardados; arquivos seus perguntam. */
  async prepareCloseWord(this: App, tab: DocTab): Promise<boolean> {
    if (!tab.dirty) return true;
    if (tab.isDraft || !tab.path) {
      try {
        if (tab === this.tab) await this.autosaveWord();
        else {
          if (!tab.path) {
            tab.path = await files.draftPath(slugify(tabLabel(tab)) || "documento", "docx");
            tab.isDraft = true;
          }
          await this.writeDocx(tab, tab.path);
        }
      } catch {
        /* segue: nada a fazer sem acesso a arquivos */
      }
      return true;
    }
    const choice = await this.askSaveChanges(tabLabel(tab));
    if (choice === "cancel") return false;
    if (choice === "save") {
      if (tab !== this.tab) {
        await this.switchTo(tab.id);
        if (this.tab !== tab) return false;
      }
      if (!(await this.saveWord(false))) return false;
    }
    return true;
  },

  askSaveChanges(this: App, name: string): Promise<"save" | "discard" | "cancel"> {
    return new Promise((resolve) => {
      const backdrop = h("div", { class: "modal-backdrop" });
      const modal = h("div", { class: "modal tr-modal link-modal" });
      modal.innerHTML = `
        <header class="wm-head"><h2>Salvar alterações?</h2></header>
        <div class="wm-body tr-body"><p>O documento <b></b> tem alterações que ainda não foram salvas no arquivo.</p></div>
        <footer class="wm-foot">
          <button class="btn" data-cancel>Cancelar</button>
          <span class="dr-spacer"></span>
          <button class="btn" data-discard>Não salvar</button>
          <button class="btn primary" data-save>Salvar</button>
        </footer>`;
      modal.querySelector("b")!.textContent = name;
      backdrop.append(modal);
      document.body.append(backdrop);
      const done = (v: "save" | "discard" | "cancel") => {
        document.removeEventListener("keydown", onKey, true);
        backdrop.remove();
        resolve(v);
      };
      const onKey = (e: KeyboardEvent) => {
        if (e.key === "Escape") {
          e.preventDefault();
          e.stopPropagation();
          done("cancel");
        }
      };
      document.addEventListener("keydown", onKey, true);
      modal.querySelector("[data-cancel]")!.addEventListener("click", () => done("cancel"));
      modal.querySelector("[data-discard]")!.addEventListener("click", () => done("discard"));
      modal.querySelector("[data-save]")!.addEventListener("click", () => done("save"));
      modal.querySelector<HTMLElement>("[data-save]")!.focus();
    });
  },
};
