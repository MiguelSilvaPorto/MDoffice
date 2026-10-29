// Documento Markdown: abrir, salvar, salvar sozinho, renomear e título.

import type { App } from "./app";
import * as files from "../files";
import { checkStyle, observarEdicao, temPendenteRitmo } from "../broker/writing";
import { registrarDesfazerAplicadas } from "../broker/aprendizado";
import { registrarDesfeitaSePendente } from "../broker/spell/decisao";
import { enviarLimiar } from "../broker/spell";
import { type DocTab } from "../tabs";
import { moveHistory } from "../history";
import { moveCommits } from "../snapshots";
import { ID_RASCUNHOS, PREFIXO_RASCUNHO } from "../disco/registro";
import { $, h, toast, baseName, docDirOf, joinPath, saveJSON, fmtTime, slugify } from "../util";

/** Avisa uma vez por sessão que o rascunho não tem onde ser gravado (o autosave tenta de novo a cada rodada). */
let avisouSemPasta = false;
/** A pergunta "onde salvar?" já está aberta (não abre uma por cima da outra). */
let pedidoDePastaAberto = false;

export const documentsMethods = {
  onDocChange(this: App): void {
    const wasDirty = this.dirty;
    this.dirty = true;
    // a correção automática só age depois que você digita (não mexe em documento aberto)
    this.autoFixArmed = true;
    // uma varredura automática desfeita (Ctrl+Z) ensina o ritmo a esperar mais antes de
    // agir, desconta o que o corretor aprendeu com as trocas que ela aplicou sozinha e
    // fecha o veredito de confiança (o limiar sobe: menos auto-aplicações daqui pra frente)
    if (temPendenteRitmo() && observarEdicao(this.editor.getText())) {
      registrarDesfazerAplicadas();
      registrarDesfeitaSePendente();
      enviarLimiar();
    }
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
    // log de alterações: guarda a instrução da mudança (o texto antigo → o novo)
    this.recordChange();
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

  /**
   * Salvamento automático: passa pela fila (uma gravação por vez).
   *
   * O pedido que chega durante uma gravação **não é descartado**: a fila grava de
   * novo ao terminar, com o texto mais recente — em pasta de rede, onde cada
   * gravação leva segundos, era isso que perdia a última parte do que foi digitado.
   * Quem faz `await` (fechar a janela, trocar de aba) espera a fila esvaziar.
   */
  async autosave(this: App): Promise<void> {
    // as Configurações não são um documento: não há o que gravar (e o gatilho de esconder
    // a janela chama o autosave sem olhar a aba que está à vista)
    if (this.tab.kind === "settings") return;
    // cada documento tem o seu salvamento automático (o botão do topo liga/desliga o que
    // está à vista)
    if (!this.autosaveLigado) return;
    return this.saveQueue.pedir();
  },

  /** O miolo do salvamento automático, executado pela fila (um por vez). */
  async salvarAgora(this: App): Promise<void> {
    if (this.tab.kind === "word") return await this.autosaveWord();
    if (this.tab.kind === "ppt") return await this.autosavePpt();
    if (this.tab.kind === "xlsx") return await this.autosaveExcel();
    const tab = this.tab;
    if (!tab.dirty) return;
    const text = this.editor.getText();
    // Navegador SEM acesso a disco (Firefox/Safari): a sessão inteira vai para o
    // localStorage — é o único salvamento possível ali, e o reload reabre tudo. No
    // Chromium (`npm run app`) o disco existe: o autosave grava o arquivo de verdade.
    if (!files.temDisco()) {
      this.saveBrowserTabs();
      tab.dirty = false;
      tab.saveFailed = false;
      tab.statusSaved = `Salvo neste navegador às ${fmtTime()}`;
      this.afterSave(tab);
      return;
    }
    // Documento novo (sem arquivo ainda): cria o rascunho e passa a salvar nele — é o
    // "salva conforme eu escrevo". O lugar é a pasta escolhida em Configurações ▸ Histórico
    // e salvamento (ou a pasta concedida, no desenho antigo). O `temp/rascunho.md` do
    // servidor de dev só existe no Vite: no PWA instalado ele não grava nada e ainda dava
    // a impressão de "Salvo" — por isso o autosave daqui de baixo não usa mais esse atalho.
    if (!tab.path) {
      try {
        // silencioso: o autosave roda a cada pausa/teto — um aviso de erro a cada rodada
        // seria ruído
        if (await this.ensureSaved(true)) return;
      } catch {
        /* sem pasta de rascunhos: cai no aviso abaixo */
      }
      // Sem pasta: NADA foi gravado. O selo não pode dizer "Salvo" — e o `saveFailed` faz
      // a barra mostrar "Não salvo" em vez de "Salvando…".
      tab.saveFailed = true;
      tab.statusSaved = "Sem pasta para salvar — clique para escolher";
      if (tab === this.tab) this.setSaveState();
      this.renderTabs();
      if (!avisouSemPasta) {
        avisouSemPasta = true;
        // Não abre o seletor sozinho: o navegador só permite escolher pasta a partir de um
        // gesto. A pergunta explica e o botão dela abre o seletor.
        void this.pedirPastaParaSalvar();
      }
      return;
    }
    try {
      await files.saveDoc(tab.path, text);
      this.recordVersion(tab.path, text);
      // uma cópia por dia mesmo sem salvar: cobre o "esqueci de salvar"
      this.backupOnceADay(tab.path);
      // se o texto mudou enquanto gravava, continua "sujo" (o próximo autosave pega)
      if (tab !== this.tab || this.editor.getText() === text) tab.dirty = false;
      tab.saveFailed = false;
      tab.statusSaved = tab.isDraft ? `Rascunho atualizado às ${fmtTime()}` : `Salvo automaticamente às ${fmtTime()}`;
      this.afterSave(tab);
    } catch {
      // não conseguiu gravar pelo app (navegador): guarda em temp/ do projeto
      tab.saveFailed = true;
      if (tab === this.tab) this.setSaveState();
      this.renderTabs();
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
    if (this.semDocumento()) return false;
    if (this.tab.kind === "word") return this.saveWord(saveAs);
    if (this.tab.kind === "ppt") return this.savePpt(saveAs);
    if (this.tab.kind === "xlsx") return this.saveExcel(saveAs);
    try {
      const previousPath = this.path;
      const wasDraft = this.isDraft;
      if (saveAs || !this.path) {
        const suggested = this.isDraft || !this.path ? `${this.docTitleForFileName()}.md` : baseName(this.path);
        let defaultPath = suggested;
        try {
          defaultPath = joinPath(await this.pastaPadraoDoTipo("md"), suggested);
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
        const count = this.applySaveFixes();
        if (count) toast(`Correção automática: ${count} ajuste${count === 1 ? "" : "s"} antes de salvar.`, "ok", 2600);
      }

      const content = this.editor.getText();
      await files.saveDoc(this.path, content);
      if (previousPath && previousPath !== this.path) {
        void moveHistory(previousPath, this.path);
        void moveCommits(previousPath, this.path);
      }
      this.recordVersion(this.path, content, true);
      // cópia real em disco (é o backup que sobrevive a limpar os dados do app)
      void this.backupNow(this.path, "salvar");
      void this.exportLog(this.path);

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
      this.tab.saveFailed = false;
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
      this.tab.saveFailed = true;
      this.setSaveState();
      this.renderTabs();
      toast("Erro ao salvar: " + e, "err");
      return false;
    }
  },

  async openDocDialog(this: App): Promise<void> {
    const picked = await files.pickOpenDoc();
    if (picked) await this.openPath(picked);
  },

  /** Importar do Office: abre direto nos documentos do Word, Excel e PowerPoint. */
  async importOfficeDialog(this: App): Promise<void> {
    const picked = await files.pickImportOffice();
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
    if (/\.pptx$/i.test(path)) return await this.openPptx(path);
    if (/\.xlsx$/i.test(path)) return await this.openXlsx(path);
    if (/\.xlsm$/i.test(path)) {
      // .xlsm é a mesma planilha do .xlsx, com macros — que o app não preserva
      const ok = await this.openXlsx(path);
      if (ok) {
        toast(
          "Planilha .xlsm aberta. As macros não são preservadas: ao salvar, escolha um nome .xlsx para não sobrescrever o original.",
          "info",
          8000
        );
      }
      return ok;
    }
    if (/\.xls$/i.test(path)) {
      toast("O formato antigo .xls não é aceito. Salve a planilha como .xlsx.", "info", 5500);
      return false;
    }
    if (/\.csv$/i.test(path)) {
      toast("Arquivo .csv não é aceito como planilha. Salve a planilha como .xlsx.", "info", 5500);
      return false;
    }
    if (/\.doc$/i.test(path)) {
      toast("O formato antigo .doc não é aceito. Salve o documento como .docx.", "info", 5500);
      return false;
    }
    if (/\.ppt$/i.test(path)) {
      toast("O formato antigo .ppt não é aceito. Salve a apresentação como .pptx.", "info", 5500);
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
   * salva automaticamente em Documentos/mdOffice (com aviso no rodapé/toast).
   * Funciona mesmo com backends antigos (não depende de comandos novos).
   */
  async ensureSaved(this: App, silencioso = false): Promise<boolean> {
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
      // a gravação deu certo: o selo não pode continuar dizendo "Não foi possível salvar"
      // por causa de uma tentativa anterior (era o que acontecia ao criar o rascunho depois
      // de uma falha: o arquivo existia e o rodapé continuava vermelho).
      tab.saveFailed = false;
      tab.dirty = this.tab === tab ? this.editor.getText() !== text : false;
      // no navegador com pasta escolhida o arquivo está na pasta da pessoa, não "no app"
      const naPastaEscolhida = target.startsWith(PREFIXO_RASCUNHO);
      tab.statusSaved = naPastaEscolhida ? "Rascunho guardado na pasta escolhida" : "Rascunho guardado no app";
      if (this.tab === tab) {
        this.setPreviewPath(target);
        this.refreshPath();
      }
      this.afterSave(tab);
      this.saveSession();
      toast(
        naPastaEscolhida
          ? "Rascunho guardado na pasta que você escolheu (não é a versão final). Use Ctrl+Shift+S quando quiser salvar em outro lugar."
          : "Rascunho guardado na pasta do app (não é a versão final). Use Ctrl+Shift+S quando quiser salvar numa pasta sua.",
        "info",
        6500
      );
      return true;
    } catch (e) {
      // No navegador a pasta de rascunhos do app não existe. Numa ação explícita
      // (Desenhar, colar uma imagem, abrir o histórico) o documento ainda pode ganhar
      // um arquivo: pede para salvar agora — essas ações gravam assets/ ao lado dele.
      // O autosave (`silencioso`) nunca abre seletor: ele espera a próxima rodada.
      if (!silencioso && files.emApp()) {
        if (await this.save(false)) return true;
        return false;
      }
      this.tab.saveFailed = true;
      if (this.tab === tab) this.setSaveState();
      if (!silencioso) toast("Não consegui guardar o rascunho: " + e, "err", 7000);
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
    const ext =
      this.tab.kind === "word" ? ".docx" : this.tab.kind === "ppt" ? ".pptx" : this.tab.kind === "xlsx" ? ".xlsx" : ".md";
    const target = /\.[a-zA-Z0-9]+$/.test(value) ? value : `${value}${ext}`;
    try {
      const previous = this.path;
      const newPath = await files.renameFile(this.path, target);
      void moveHistory(this.path, newPath);
      void moveCommits(this.path, newPath);
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

  /**
   * Nova tentativa depois de o rodapé mostrar "Não foi possível salvar".
   *
   * Chamado pelo clique no rodapé (ou Enter/Espaço com ele focado). Num documento sem
   * arquivo, abre o "Salvar como…" — o clique é o gesto que o navegador exige para o
   * seletor de arquivos. O autosave nunca abre seletor sozinho.
   */
  async retrySave(this: App): Promise<void> {
    if (!this.tabs.length) return;
    const tinhaArquivo = !!this.path;
    // limpa o vermelho na hora: se a nova tentativa falhar (ou for cancelada), volta a marcar
    this.tab.saveFailed = false;
    this.setSaveState();
    const ok = await this.save(false);
    if (!ok) {
      this.tab.saveFailed = true;
      this.setSaveState();
      return;
    }
    // documento novo: o seletor escolheu a pasta; o autosave segue nela
    if (!tinhaArquivo) void this.autosave();
  },

  /**
   * Pergunta, uma vez, onde o app pode gravar os documentos novos.
   *
   * Aparece quando o salvamento automático tenta gravar um documento sem arquivo e não há
   * pasta concedida nem pasta de rascunhos escolhida. O botão "Escolher pasta" é um gesto
   * de verdade — é o que permite abrir o seletor do navegador e guardar o handle para as
   * próximas gravações. "Agora não" deixa o rodapé com o aviso clicável.
   */
  async pedirPastaParaSalvar(this: App): Promise<void> {
    if (pedidoDePastaAberto || !files.temDisco()) return;
    // já há um diálogo aberto (ex.: a pergunta do backup na primeira execução): não empilha
    // outro por cima; o rodapé "Não foi possível salvar" continua clicável
    if (document.querySelector(".modal-backdrop")) return;
    pedidoDePastaAberto = true;

    const backdrop = h("div", { class: "modal-backdrop" });
    const modal = h("div", { class: "modal bk-ask" });
    modal.innerHTML = `
      <header class="wm-head">
        <svg class="ic"><use href="#i-save"/></svg>
        <h2>Onde o mdOffice deve salvar o que você escreve?</h2>
      </header>
      <div class="bk-ask-body">
        <p>O salvamento automático está ligado, mas este documento ainda não tem uma pasta.
        Escolha uma e o texto passa a ser gravado sozinho enquanto você escreve — sem
        precisar lembrar do <kbd>Ctrl</kbd>+<kbd>S</kbd>.</p>
        <ul class="bk-ask-list">
          <li>O arquivo fica na pasta que você escolher; nada vai para a nuvem.</li>
          <li>As imagens coladas vão junto, na pasta <code>assets/</code> ao lado do documento.</li>
          <li>Dá para trocar depois em <b>Configurações ▸ Histórico e salvamento</b>.</li>
        </ul>
      </div>
      <footer class="wm-foot">
        <span class="muted">Você também pode usar <kbd>Ctrl</kbd>+<kbd>S</kbd> a qualquer momento.</span>
        <span class="dr-spacer"></span>
        <button class="btn" data-nao>Agora não</button>
        <button class="btn primary" data-sim>Escolher pasta</button>
      </footer>`;
    backdrop.append(modal);
    document.body.append(backdrop);

    const fechar = (): void => {
      pedidoDePastaAberto = false;
      document.removeEventListener("keydown", onKey, true);
      backdrop.remove();
    };
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === "Escape") fechar();
    };
    document.addEventListener("keydown", onKey, true);
    modal.querySelector<HTMLButtonElement>("[data-nao]")?.addEventListener("click", fechar);

    const sim = modal.querySelector<HTMLButtonElement>("[data-sim]");
    sim?.addEventListener("click", async () => {
      sim.disabled = true;
      try {
        const pastas = await files.pickFolders();
        const id = pastas[0];
        if (!id) {
          sim.disabled = false;
          return; // cancelou o seletor: a pergunta continua aberta
        }
        await files.setDraftFolder(id);
        try {
          await this.sidebar.addProjectPath(ID_RASCUNHOS, false);
        } catch {
          /* a árvore se atualiza no próximo render */
        }
        fechar();
        toast("Pasta escolhida: os documentos novos passam a ser salvos nela automaticamente.", "ok", 5200);
        await this.autosave();
      } catch (e) {
        sim.disabled = false;
        toast("Não consegui usar essa pasta: " + e, "err", 6000);
      }
    });
  },
};
