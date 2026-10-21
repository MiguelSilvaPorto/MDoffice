// Documentos de apresentação (.pptx) dentro do app: criar, abrir, salvar e fechar
// com segurança. Espelha src/app/wordDocs.ts (mesmos nomes, mesma ordem).

import type { App } from "./app";
import * as files from "../files";
import { newTab, tabLabel, type DocTab } from "../tabs";
import { moveHistory } from "../history";
import { moveCommits } from "../snapshots";
import { avisoOfficeSemAutosave } from "./seloAutosave";
import { type PowerPointTabData } from "../powerpoint/powerpoint";
import { deckToPptx } from "../powerpoint/pptxexport";
import { pptxToDeck } from "../powerpoint/pptximport";
import { serialize } from "../powerpoint/model";
import { DEFAULT_SETUP } from "../powerpoint/model";
import type { Deck, DeckSetup } from "../powerpoint/schema";
import { bytesToBase64 } from "../util";
import { $, h, toast, baseName, joinPath, fmtTime, slugify, docDirOf } from "../util";

export const powerpointDocsMethods = {
  /** Cria uma aba de apresentação (sem ativá-la). */
  addPptTab(this: App, data: PowerPointTabData, init: Partial<DocTab> = {}): DocTab {
    const tab = newTab(this.editor.createState(""), {
      kind: "ppt",
      ppt: data,
      title: "Apresentação",
      statusSaved: "Nova apresentação",
      ...init,
    });
    this.tabs.push(tab);
    return tab;
  },

  async newPowerPointDoc(this: App): Promise<void> {
    const tab = this.addPptTab(this.pptHost.createTab());
    await this.switchTo(tab.id);
    this.pptHost.focus();
    // nasce salva na pasta padrão do app (Documentos/mdOffice/PowerPoint), sem perguntar nada
    await this.nascerNoPadrao("ppt");
  },

  /** Lê os bytes de um .pptx do disco (data URL -> Uint8Array). */
  async readPptx(this: App, path: string): Promise<{ deck: Deck; setup: DeckSetup; avisos?: string[] }> {
    const url = await files.readDataUrl(path);
    const bin = atob(url.slice(url.indexOf(",") + 1));
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return await pptxToDeck(bytes, DEFAULT_SETUP);
  },

  async addPptxTab(this: App, path: string, isDraft = false): Promise<DocTab> {
    const { deck, setup, avisos } = await this.readPptx(path);
    const tab = this.addPptTab(this.pptHost.createTabFromDeck(deck, setup), {
      path,
      isDraft,
      title: null,
      statusSaved: isDraft ? "Rascunho guardado no app" : `Aberto às ${fmtTime()}`,
    });
    // o que o motor ainda não reproduz (tabelas, gráficos...) é dito, nunca escondido
    if (avisos?.length) toast(`Aberto com limitações: ${avisos.slice(0, 3).join("; ")}${avisos.length > 3 ? "…" : ""}`, "info", 9000);
    return tab;
  },

  async openPptx(this: App, path: string): Promise<boolean> {
    try {
      const tab = await this.addPptxTab(path);
      this.addRecent(path);
      const current = this.tab;
      const reuse = current.kind !== "ppt" && current.kind !== "word" && !current.path && !current.dirty && this.textOf(current).length === 0;
      await this.switchTo(tab.id);
      if (reuse && this.tab === tab) {
        this.tabs = this.tabs.filter((t) => t !== current);
        this.afterTabChange();
      }
      return true;
    } catch (e) {
      toast("Não foi possível abrir a apresentação: " + e, "err", 7000);
      return false;
    }
  },

  enterPpt(this: App, target: DocTab): void {
    document.body.classList.add("ppt-open");
    $("#powerpoint-pane").hidden = false;
    this.pptHost.load(target.ppt!);
    this.outline?.useCollapsed(target.outlineCollapsed);
    this.afterTabChange();
    // o log de alterações começa do texto que está abrindo
    this.markText(this.pptSerialized(target));
  },

  leavePpt(this: App): void {
    document.body.classList.remove("ppt-open");
  },

  /** Inicia a apresentação da aba ativa (o botão "Apresentar" da barra superior). */
  presentActive(this: App): void {
    if (this.semDocumento()) return;
    if (this.tab.kind === "ppt") this.pptHost.present();
  },

  onPptChange(this: App): void {
    if (this.tab.kind !== "ppt") return;
    const was = this.dirty;
    this.dirty = true;
    if (!was) this.refreshTitle();
    this.setSaveState();
    this.autosaveSoon();
    // log de alterações (a apresentação também serializa em texto)
    this.recordSerializedChange(this.pptSerialized(this.tab));
  },

  /** Grava o .pptx de uma aba (a ativa lê do motor; as outras, do estado guardado). */
  async writePptx(this: App, tab: DocTab, path: string): Promise<void> {
    const live = tab === this.tab;
    const data = live ? this.pptHost.snapshot() : tab.ppt!;
    const deck: Deck = { titulo: tabLabel(tab), slides: data.slides };
    const bytes = await deckToPptx(deck, data.setup, tabLabel(tab));
    await files.saveBinary(path, bytesToBase64(bytes));
  },

  pptSerialized(this: App, tab: DocTab): string {
    return tab === this.tab ? this.pptHost.serialized() : serialize(tab.ppt!.setup, tab.ppt!.slides);
  },

  /** Documento novo ainda sem arquivo: cria o rascunho (.pptx) na pasta do app. */
  async ensurePptFile(this: App): Promise<boolean> {
    const tab = this.tab;
    if (tab.path) return true;
    try {
      tab.path = await files.draftPath(slugify(tabLabel(tab)) || "apresentacao", "pptx");
      tab.isDraft = true;
      await this.writePptx(tab, tab.path);
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
   * Salvamento automático. Mesma regra do Word: rascunhos do app são regravados
   * sempre; arquivos SEUS só são gravados em Salvar — o motor converte a
   * apresentação em caixas de texto e recursos que ele ainda não entende podem
   * ser simplificados. O histórico guarda cópias de qualquer jeito, o selo da barra
   * mostra "Não salvo" e um aviso (uma vez por arquivo) explica o Ctrl+S.
   */
  async autosavePpt(this: App): Promise<void> {
    const tab = this.tab;
    if (tab.kind !== "ppt" || !tab.dirty) return;
    if (tab.path && !tab.isDraft) {
      this.recordVersion(tab.path, this.pptHost.serialized());
      if (this.avisosOffice.primeiraVez(tab.path)) toast(avisoOfficeSemAutosave("ppt"), "info", 9000);
      return;
    }
    try {
      if (!tab.path) {
        tab.path = await files.draftPath(slugify(tabLabel(tab)) || "apresentacao", "pptx");
        tab.isDraft = true;
      }
      await this.writePptx(tab, tab.path);
      tab.dirty = false;
      tab.statusSaved = `Rascunho atualizado às ${fmtTime()}`;
      this.recordVersion(tab.path, this.pptSerialized(tab));
      // uma cópia em disco por dia, mesmo sem salvar
      this.backupOnceADay(tab.path);
      this.afterSave(tab);
      this.saveSession();
    } catch {
      /* sem acesso a arquivos (navegador): segue sem salvar */
    }
  },

  async savePpt(this: App, saveAs: boolean): Promise<boolean> {
    const tab = this.tab;
    try {
      const previous = tab.path;
      const wasDraft = tab.isDraft;
      // Rascunho NÃO é motivo para perguntar onde salvar: ele JÁ tem arquivo (o da pasta de
      // rascunhos, escolhida em Configurações). O Ctrl+S grava nele; "Salvar como…" é que
      // escolhe uma pasta do usuário.
      if (saveAs || !tab.path) {
        const suggested = `${tabLabel(tab)}.pptx`;
        let defaultPath = suggested;
        try {
          defaultPath = joinPath(await this.pastaPadraoDoTipo("ppt"), suggested);
        } catch {
          /* só o nome */
        }
        const picked = await files.pickSaveAny(defaultPath, "Apresentação (.pptx)", ["pptx"]);
        if (!picked) return false;
        tab.path = /\.pptx$/i.test(picked) ? picked : `${picked.replace(/\.[a-zA-Z0-9]+$/, "")}.pptx`;
        tab.isDraft = false;
        tab.title = null;
      }
      await this.writePptx(tab, tab.path!);
      if (wasDraft && previous && previous !== tab.path) void files.deleteDraft(previous).catch(() => {});
      if (previous && previous !== tab.path) {
        void moveHistory(previous, tab.path!);
        void moveCommits(previous, tab.path!);
      }
      tab.dirty = false;
      tab.statusSaved = tab.isDraft ? `Rascunho atualizado às ${fmtTime()}` : `Salvo às ${fmtTime()}`;
      this.recordVersion(tab.path!, this.pptSerialized(tab), true);
      // cópia real em disco
      void this.backupNow(tab.path!, "salvar");
      void this.exportLog(tab.path!);
      if (!tab.isDraft) this.addRecent(tab.path!);
      this.setPreviewPath(tab.path);
      this.afterTabChange();
      // No rascunho, quem avisa é o selo ("Rascunho atualizado") — não um toast a cada Ctrl+S.
      if (!tab.isDraft) {
        if (!this.pptxNotice) {
          this.pptxNotice = true;
          toast("Salvo como .pptx. A apresentação vira caixas de texto posicionadas; animações e efeitos que o mdOffice ainda não entende não são exportados.", "info", 7500);
        } else toast(`Apresentação salva em ${baseName(tab.path!)}`, "ok", 2600);
      }
      return true;
    } catch (e) {
      toast("Erro ao salvar: " + e, "err", 7000);
      return false;
    }
  },

  /** Antes de fechar uma aba de apresentação: rascunhos ficam guardados; arquivos seus perguntam. */
  async prepareClosePpt(this: App, tab: DocTab): Promise<boolean> {
    if (!tab.dirty) return true;
    if (tab.isDraft || !tab.path) {
      try {
        if (tab === this.tab) await this.autosavePpt();
        else {
          if (!tab.path) {
            tab.path = await files.draftPath(slugify(tabLabel(tab)) || "apresentacao", "pptx");
            tab.isDraft = true;
          }
          await this.writePptx(tab, tab.path);
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
      if (!(await this.savePpt(false))) return false;
    }
    return true;
  },

  /** Escolhe uma imagem do computador e a insere na lâmina atual. */
  async pickPptImage(this: App, destino?: string): Promise<void> {
    try {
      const picked = await files.pickImageFile();
      if (!picked) return;
      let src = await files.readDataUrl(picked);
      // mantém a imagem dentro da pasta assets/ do documento (o mesmo do Word)
      if (this.tab.path) {
        try {
          const rel = await files.copyAsset(this.tab.path, picked);
          if (rel) src = await files.readDataUrl(`${docDirOf(this.tab.path)}/${rel}`);
        } catch {
          /* sem pasta: usa o data URL mesmo assim */
        }
      }
      this.pptHost.insertImage(src, destino);
    } catch (e) {
      toast("Não consegui abrir a imagem: " + e, "err", 5000);
    }
  },

  /** Escolhe um áudio/vídeo do computador e o insere na lâmina atual (ou troca o da mídia selecionada). */
  async pickPptMedia(this: App, tipo?: string): Promise<void> {
    try {
      const picked = await files.pickMediaFile();
      if (!picked) return;
      const nome = picked.split(/[\\/]/).pop() ?? "";
      let src = await files.readDataUrl(picked);
      // mantém o arquivo dentro da pasta assets/ do documento (o mesmo das imagens)
      if (this.tab.path) {
        try {
          const rel = await files.copyAsset(this.tab.path, picked);
          if (rel) src = await files.readDataUrl(`${docDirOf(this.tab.path)}/${rel}`);
        } catch {
          /* sem pasta: usa o data URL mesmo assim */
        }
      }
      if (src.length > 80 * 1024 * 1024) toast("O arquivo de mídia é grande — o .pptx exportado vai ficar pesado.", "err", 5000);
      await this.pptHost.insertMedia(src, tipo, nome);
    } catch (e) {
      toast("Não consegui abrir a mídia: " + e, "err", 5000);
    }
  },
};