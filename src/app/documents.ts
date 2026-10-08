// Documento Markdown: abrir, salvar, salvar sozinho, renomear e título.

import type { App } from "./app";
import * as files from "../files";
import { checkStyle } from "../broker/writing";
import { type DocTab } from "../tabs";
import { moveHistory } from "../history";
import { $, toast, baseName, docDirOf, joinPath, saveJSON, fmtTime, slugify } from "../util";

export const documentsMethods = {
  onDocChange(this: App): void {
    const wasDirty = this.dirty;
    this.dirty = true;
    // a correção automática só age depois que você digita (não mexe em documento aberto)
    this.autoFixArmed = true;
    if (!wasDirty) this.refreshTitle();
    this.setSaveState();
    this.updatePreview();
    this.statsSoon();
    this.outlineSoon();
    this.autosaveSoon();
    this.checkWritingSoon();
    if (this.autoFix) this.autoFixSoon();
    if (this.autoFix) this.idleFixSoon();
    // mantém o desenho de letras aberto em sincronia com o texto do editor
    this.preview.syncTextEditorWith(this.editor.getText());
  },

  /** Avisa a tradução ao vivo que o texto (ou a aba) mudou. */
  translationDocChanged(this: App, immediate = false): void {
    this.translation?.docChanged(this.editor.getText(), immediate);
  },

  /** Arruma o português (pontuação, maiúsculas, formalidade) antes de mandar traduzir. */
  polishForTranslation(this: App, text: string): string {
    try {
      const fixes = checkStyle(text)
        .filter((i) => i.fix !== undefined)
        .sort((a, b) => b.from - a.from);
      let out = text;
      let limit = Infinity;
      for (const i of fixes) {
        if (i.to > limit) continue;
        out = out.slice(0, i.from) + i.fix + out.slice(i.to);
        limit = i.from;
      }
      return out;
    } catch {
      return text;
    }
  },

  setPreviewPath(this: App, p: string | null): void {
    this.preview.setDocPath(p);
    this.translation?.setDocPath(p);
  },

  async autosave(this: App): Promise<void> {
    if (this.tab.kind === "word") return this.autosaveWord();
    const tab = this.tab;
    if (!tab.dirty) return;
    const text = this.editor.getText();
    // Documento novo (sem arquivo ainda): cria o rascunho e passa a salvar nele — é o
    // "salva conforme eu escrevo". Se não houver acesso a arquivos (navegador), cai
    // no servidor de desenvolvimento, que grava em temp/rascunho.md do projeto.
    if (!tab.path) {
      try {
        if (await this.ensureSaved()) return;
      } catch {
        /* sem arquivos: segue para o salvamento pelo servidor */
      }
      const salvou = await files.saveDraftFallback("rascunho", text);
      if (salvou) {
        tab.dirty = false;
        tab.statusSaved = `Salvo automaticamente em temp/ às ${fmtTime()}`;
        this.afterSave(tab);
      }
      return;
    }
    try {
      await files.saveDoc(tab.path, text);
      this.recordVersion(tab.path, text);
      // se o texto mudou enquanto gravava, continua "sujo" (o próximo autosave pega)
      if (tab !== this.tab || this.editor.getText() === text) tab.dirty = false;
      tab.statusSaved = tab.isDraft ? `Rascunho atualizado às ${fmtTime()}` : `Salvo automaticamente às ${fmtTime()}`;
      this.afterSave(tab);
    } catch {
      // não conseguiu gravar pelo app (navegador): guarda em temp/ do projeto
      await files.saveDraftFallback("rascunho", text);
    }
  },

  /** Redesenha o que depende do estado "salvo" — só se a aba ainda for a ativa. */
  afterSave(this: App, tab: DocTab): void {
    if (tab === this.tab) {
      this.refreshTitle();
      this.setSaveState();
    } else {
      this.renderTabs();
    }
    this.sidebar?.render();
  },

  async save(this: App, saveAs = false): Promise<boolean> {
    if (this.tab.kind === "word") return this.saveWord(saveAs);
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
      if (previousPath && previousPath !== this.path) void moveHistory(previousPath, this.path);
      this.recordVersion(this.path, content, true);

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
      this.setPreviewPath(this.path);
      if (!this.isDraft) this.addRecent(this.path);
      this.afterTabChange();

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
  },

  async openDocDialog(this: App): Promise<void> {
    const picked = await files.pickOpenDoc();
    if (picked) await this.openPath(picked);
  },

  /** Abre o arquivo numa aba (se já estiver aberto, só vai até ela). */
  async openPath(this: App, path: string): Promise<boolean> {
    const already = this.tabs.find((t) => t.path && t.path.toLowerCase() === path.toLowerCase());
    if (already) {
      await this.switchTo(already.id);
      return true;
    }
    if (/\.docx$/i.test(path)) return await this.openDocx(path);
    if (/\.doc$/i.test(path)) {
      toast("O formato antigo .doc não é aceito. Abra no Word e salve como .docx.", "info", 5500);
      return false;
    }
    try {
      const content = await files.loadDoc(path);
      const tab = this.addTabFor(path, content);
      this.addRecent(path);
      // abrir a partir de uma aba vazia e sem nome ocupa o lugar dela
      const current = this.tab;
      const reuse = !current.path && !current.dirty && this.textOf(current).length === 0;
      await this.switchTo(tab.id);
      if (reuse && this.tab === tab) {
        this.tabs = this.tabs.filter((t) => t !== current);
        this.afterTabChange();
      }
      return true;
    } catch (e) {
      toast("Não foi possível abrir o arquivo: " + e, "err");
      return false;
    }
  },

  /**
   * Garante que o documento tenha um arquivo, sem interromper o usuário:
   * salva automaticamente em Documentos/mdCreator (com aviso no rodapé/toast).
   * Funciona mesmo com backends antigos (não depende de comandos novos).
   */
  async ensureSaved(this: App): Promise<boolean> {
    const tab = this.tab;
    if (tab.path) return true;
    const text = this.editor.getText();
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
      await files.saveDoc(target, text);
      tab.path = target;
      tab.isDraft = true;
      tab.dirty = this.tab === tab ? this.editor.getText() !== text : false;
      tab.statusSaved = "Rascunho guardado no app";
      if (this.tab === tab) {
        this.setPreviewPath(target);
        this.refreshPath();
      }
      this.afterSave(tab);
      this.saveSession();
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
  },

  /** Nome sugerido para o arquivo: o título que você definiu ou o primeiro título (#). */
  docTitleForFileName(this: App): string {
    if (this.title) return this.title;
    const match = /^#\s+(.+)$/m.exec(this.editor.getText());
    const base = (match ? match[1] : "documento").replace(/\s+/g, " ").trim();
    return base.slice(0, 60) || "documento";
  },

  /** Aplica o novo nome: renomeia o arquivo (se já salvo) ou guarda para o próximo salvamento. */
  async applyTitle(this: App, value: string): Promise<void> {
    if (!this.path) {
      this.title = value;
      this.afterTabChange();
      toast(`Nome definido: "${value}". Ele será usado quando o documento for salvo.`, "ok", 3600);
      return;
    }
    const target = /\.[a-zA-Z0-9]+$/.test(value) ? value : `${value}${this.tab.kind === "word" ? ".docx" : ".md"}`;
    try {
      const previous = this.path;
      const newPath = await files.renameFile(this.path, target);
      void moveHistory(this.path, newPath);
      this.path = newPath;
      this.recents = this.recents.map((r) => (r.path === previous ? { ...r, path: newPath } : r));
      saveJSON("mdc.recents", this.recents);
      this.setPreviewPath(newPath);
      this.afterTabChange();
      toast(`Documento renomeado para ${baseName(newPath)}.`, "ok", 3200);
    } catch (e) {
      toast("Não foi possível renomear: " + e, "err", 6000);
    }
  },
};
