// Pastas dos projetos: criar, renomear e excluir pela barra lateral e mover documentos
// entre pastas arrastando e soltando. O trabalho de disco fica no Rust (`files.ts`); aqui
// fica a conversa com o usuário e o acerto do estado do app (abas, recentes, histórico).

import type { App } from "./app";
import * as files from "../files";
import { moveHistory } from "../history";
import { moveCommits } from "../snapshots";
import { pedirTexto } from "../dialogoTexto";
import { baseName, docDirOf, h, saveJSON, toast } from "../util";

/** Valida o nome de uma pasta para o diálogo (o Rust ainda limpa os caracteres inválidos). */
function erroDoNome(valor: string, usados: Set<string>): string | null {
  const nome = valor.trim();
  if (!nome) return "Digite um nome para a pasta.";
  if (nome === "." || nome === "..") return "Esse nome não pode ser usado.";
  if (/[\\/:*?"<>|]/.test(nome)) return 'O nome não pode conter \\ / : * ? " < > |.';
  if (usados.has(nome.toLowerCase())) return "Já existe uma pasta com esse nome aqui.";
  return null;
}

/** true se o arquivo é Markdown (os únicos que guardam imagens fora do próprio arquivo). */
const ehMarkdown = (path: string): boolean => /\.(md|markdown|mdx)$/i.test(path);

export const projectsMethods = {
  /** Cria uma pasta dentro de `parent` (a pasta do projeto ou uma subpasta). */
  async newFolderIn(this: App, parent: string): Promise<void> {
    const usados = this.sidebar.nomesDePastas(parent);
    const nome = await pedirTexto({
      titulo: "Nova pasta",
      rotulo: "Nome da pasta",
      dica: "Ela fica dentro da pasta do projeto, ao lado dos documentos.",
      ok: "Criar",
      validar: (v) => erroDoNome(v, usados),
    });
    if (!nome) return;
    try {
      const criada = await files.createFolder(parent, nome.trim());
      await this.sidebar.refresh();
      // a pasta nova entra aberta e em foco, pronta para receber documentos arrastados
      this.sidebar.focarPasta(criada);
      toast(`Pasta "${baseName(criada)}" criada — arraste documentos para dentro dela.`, "ok", 4600);
    } catch (e) {
      toast("Não consegui criar a pasta: " + e, "err", 6000);
    }
  },

  /** Renomeia uma pasta (o nome é pedido num diálogo). */
  async renameFolderAt(this: App, path: string): Promise<void> {
    const atual = baseName(path);
    const usados = this.sidebar.nomesDePastas(docDirOf(path));
    usados.delete(atual.toLowerCase());
    const nome = await pedirTexto({
      titulo: "Renomear pasta",
      rotulo: "Novo nome",
      valor: atual,
      ok: "Renomear",
      validar: (v) => erroDoNome(v, usados),
    });
    if (!nome || nome.trim() === atual) return;
    try {
      const nova = await files.renameFolder(path, nome.trim());
      this.renomearCaminhos(path, nova);
      this.sidebar.repathPrefix(path, nova);
      await this.sidebar.refresh();
      this.sidebar.focarPasta(nova);
      toast(`Pasta renomeada para "${baseName(nova)}".`, "ok", 3600);
    } catch (e) {
      toast("Não consegui renomear a pasta: " + e, "err", 6000);
    }
  },

  /** Exclui uma pasta (só a vazia; a confirmação vem antes). */
  async deleteFolderAt(this: App, path: string): Promise<void> {
    const nome = baseName(path);
    // pelo que a árvore conhece, a pasta tem algo dentro? então nem abre a confirmação
    if (this.sidebar.resumoDe(path) !== "pasta vazia") {
      toast("Esta pasta ainda tem documentos ou subpastas. Mova ou apague o conteúdo antes de excluí-la.", "info", 6500);
      return;
    }
    if (!(await this.confirmarExcluirPasta(nome))) return;
    try {
      await files.deleteFolder(path);
      this.sidebar.forgetFolder(path);
      await this.sidebar.refresh();
      toast(`Pasta "${nome}" excluída.`, "ok", 3600);
    } catch (e) {
      toast("Não consegui excluir a pasta: " + e, "err", 6500);
    }
  },

  /** Confirmação de excluir pasta (mesmo diálogo do resto do app). */
  async confirmarExcluirPasta(this: App, nome: string): Promise<boolean> {
    return await new Promise<boolean>((resolve) => {
      const backdrop = h("div", { class: "modal-backdrop" });
      const modal = h("div", { class: "modal tr-modal link-modal" });
      modal.innerHTML = `
        <header class="wm-head"><h2>Excluir a pasta?</h2></header>
        <div class="wm-body tr-body">
          <p>A pasta <b data-nome></b> será removida do disco.</p>
          <p class="muted">Só pastas <b>vazias</b> podem ser excluídas — nenhum documento é apagado por aqui.</p>
        </div>
        <footer class="wm-foot">
          <button class="btn" data-cancel>Cancelar</button>
          <span class="dr-spacer"></span>
          <button class="btn danger" data-ok><svg class="ic"><use href="#i-trash"/></svg><span>Excluir pasta</span></button>
        </footer>`;
      modal.querySelector("[data-nome]")!.textContent = nome;
      backdrop.append(modal);
      document.body.append(backdrop);

      let done = false;
      const finish = (ok: boolean) => {
        if (done) return;
        done = true;
        document.removeEventListener("keydown", onKey, true);
        backdrop.remove();
        resolve(ok);
      };
      const onKey = (e: KeyboardEvent) => {
        if (e.key === "Escape") {
          e.preventDefault();
          e.stopPropagation();
          finish(false);
        }
      };
      document.addEventListener("keydown", onKey, true);
      backdrop.addEventListener("mousedown", (e) => {
        if (e.target === backdrop) finish(false);
      });
      modal.querySelector("[data-cancel]")!.addEventListener("click", () => finish(false));
      modal.querySelector("[data-ok]")!.addEventListener("click", () => finish(true));
      (modal.querySelector("[data-ok]") as HTMLElement).focus();
    });
  },

  /**
   * Move um documento para outra pasta (o arrastar e soltar da barra lateral).
   *
   * Salva o que estiver aberto antes de mexer no disco e, depois, acerta o que aponta para
   * o arquivo: abas, recentes, abas fechadas e o histórico de versões. O documento do
   * Markdown referencia as imagens de `assets/` por caminho relativo — como a pasta de
   * imagens é compartilhada e fica na pasta antiga, ao final o usuário é avisado.
   */
  async moveDoc(this: App, path: string, dir: string): Promise<void> {
    if (docDirOf(path).toLowerCase() === dir.toLowerCase()) return;
    const abertas = this.tabs.filter((t) => (t.path ?? "").toLowerCase() === path.toLowerCase());
    try {
      await this.saveTabsFor(path);
    } catch (e) {
      toast("Não consegui salvar o documento antes de mover: " + e, "err", 6500);
      return;
    }
    let usavaAssets = false;
    if (ehMarkdown(path)) {
      try {
        usavaAssets = /\]\(assets\//.test(await files.loadDoc(path));
      } catch {
        /* se não der para ler, segue sem o aviso */
      }
    }
    let novo: string;
    try {
      novo = await files.moveFile(path, dir);
    } catch (e) {
      toast("Não consegui mover o documento: " + e, "err", 6000);
      return;
    }
    if (novo.toLowerCase() === path.toLowerCase()) {
      await this.sidebar.refresh();
      return;
    }
    for (const tab of abertas) {
      tab.path = novo;
      void moveHistory(path, novo);
      void moveCommits(path, novo);
    }
    const baixo = path.toLowerCase();
    this.recents = this.recents.map((r) => (r.path.toLowerCase() === baixo ? { ...r, path: novo } : r));
    saveJSON("mdc.recents", this.recents);
    this.closedTabs = this.closedTabs.map((p) => (p.toLowerCase() === baixo ? novo : p));
    if (abertas.includes(this.tab)) {
      this.setPreviewPath(novo);
      this.refreshPath();
    }
    await this.sidebar.refresh();
    this.sidebar.focarPasta(dir);
    toast(`"${baseName(novo)}" movido para "${baseName(dir)}".`, "ok", 3600);
    if (usavaAssets) {
      toast("As imagens de assets/ continuam na pasta antiga — reinsira as que o documento usa.", "info", 8500);
    }
  },

  /** Leva abas, recentes e abas fechadas de dentro de uma pasta renomeada para o caminho novo. */
  renomearCaminhos(this: App, antigo: string, novo: string): void {
    const baixo = antigo.toLowerCase();
    const troca = (p: string | null): string | null => (p && p.toLowerCase().startsWith(baixo) ? novo + p.slice(antigo.length) : p);
    for (const tab of this.tabs) {
      const antes = tab.path;
      const depois = troca(antes);
      if (antes && depois && depois !== antes) {
        tab.path = depois;
        void moveHistory(antes, depois);
        void moveCommits(antes, depois);
      }
    }
    this.recents = this.recents.map((r) => {
      const p = troca(r.path);
      return p && p !== r.path ? { ...r, path: p } : r;
    });
    saveJSON("mdc.recents", this.recents);
    this.closedTabs = this.closedTabs.map((p) => troca(p) ?? p);
    if (this.path) {
      this.setPreviewPath(this.path);
      this.refreshPath();
    }
  },
};
