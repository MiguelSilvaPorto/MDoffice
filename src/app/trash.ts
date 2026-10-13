// Lixeira: a ação "Mover para a lixeira" do menu do arquivo e a limpeza dos 30 dias.
//
// Mover para a lixeira NÃO apaga: o arquivo sai da pasta do projeto e fica guardado
// numa pasta do app (dá para recuperar por lá, pelo Explorer, dentro de 30 dias).
// Passado o prazo, a limpeza da abertura apaga de vez — nada acontece sem o usuário
// mandar: são duas ações separadas de propósito.
import type { App } from "./app";
import * as files from "../files";
import { baseName, h, toast, saveJSON } from "../util";

export const trashMethods = {
  /** Pergunta se pode mover (mesmo diálogo de confirmação das outras ações do app). */
  async askMoveToTrash(name: string): Promise<boolean> {
    return await new Promise<boolean>((resolve) => {
      const backdrop = h("div", { class: "modal-backdrop" });
      const modal = h("div", { class: "modal tr-modal link-modal" });
      modal.innerHTML = `
        <header class="wm-head"><h2>Mover para a lixeira?</h2></header>
        <div class="wm-body tr-body">
          <p>O arquivo <b data-nome></b> sai da pasta e vai para a <b>lixeira do mdOffice</b>.</p>
          <p class="muted">Ele fica guardado por <b>30 dias</b> — dá para recuperar na pasta do app — e depois é apagado definitivamente.</p>
        </div>
        <footer class="wm-foot">
          <button class="btn" data-cancel>Cancelar</button>
          <span class="dr-spacer"></span>
          <button class="btn danger" data-ok><svg class="ic"><use href="#i-trash"/></svg><span>Mover para a lixeira</span></button>
        </footer>`;
      modal.querySelector("[data-nome]")!.textContent = name;
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
   * Grava o que ainda não foi salvo nas abas abertas deste caminho.
   *
   * O arquivo está prestes a sair da pasta: se ficasse alteração sem salvar, ela se
   * perderia. Word/PowerPoint/Excel gravam pelo próprio motor; Markdown, pelo texto.
   */
  async saveTabsFor(this: App, path: string): Promise<void> {
    const alvo = path.toLowerCase();
    for (const tab of this.tabs.filter((t) => (t.path ?? "").toLowerCase() === alvo)) {
      if (!tab.dirty) continue;
      if (tab.kind === "word") await this.writeDocx(tab, tab.path!);
      else if (tab.kind === "ppt") await this.writePptx(tab, tab.path!);
      else if (tab.kind === "xlsx") await this.writeXlsx(tab, tab.path!);
      else await files.saveDoc(tab.path!, this.textOf(tab));
      tab.dirty = false;
    }
  },

  /** Ação do menu do arquivo: confirma, salva o que está aberto, move e avisa. */
  async moveToTrash(this: App, path: string): Promise<void> {
    const nome = baseName(path);
    if (!(await this.askMoveToTrash(nome))) return;
    const alvo = path.toLowerCase();
    const abertas = this.tabs.filter((t) => (t.path ?? "").toLowerCase() === alvo);
    try {
      await this.saveTabsFor(path);
    } catch (e) {
      toast("Não consegui salvar o documento antes de mover: " + e, "err", 6500);
      return;
    }
    try {
      await files.moveToTrash(path);
    } catch (e) {
      toast("Não consegui mover para a lixeira: " + e, "err", 6500);
      return;
    }
    // fecha o que estava aberto (já salvo: sem perguntas) e tira dos recentes.
    // A aba perde o caminho antes de fechar: a ação da lixeira já cuidou do arquivo,
    // e o fechamento não deve gravar backup nem oferecer reabertura de um documento
    // que saiu da pasta de propósito.
    for (const tab of abertas) {
      tab.path = null;
      await this.closeTab(tab.id);
    }
    // tira também o que ficou guardado de fechamentos ANTES da lixeira (Ctrl+Shift+T
    // não deve tentar reabrir um documento que saiu da pasta)
    this.closedTabs = this.closedTabs.filter((p) => p.toLowerCase() !== alvo);
    this.recents = this.recents.filter((r) => r.path.toLowerCase() !== alvo);
    saveJSON("mdc.recents", this.recents);
    void this.sidebar.refresh();
    toast(`"${nome}" foi para a lixeira. Fica guardado por 30 dias.`, "ok", 4200);
  },

  /** Apaga de vez o que passou dos 30 dias na lixeira (silencioso; roda na abertura). */
  async purgeTrash(this: App): Promise<void> {
    try {
      await files.purgeTrash();
    } catch {
      /* sem acesso ao backend (navegador): não existe lixeira lá */
    }
  },
};
