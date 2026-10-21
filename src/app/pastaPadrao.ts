// A pasta sugerida para um documento novo.
//
// Até a W3 a raiz era `Documentos/mdOffice` (criada pelo Rust), com uma subpasta por tipo, e
// o documento novo nascia **salvo** lá. No navegador não existe "Documentos": a pasta é a
// que a pessoa concedeu ao app, e ela escolhe onde gravar no "Salvar como…".
//
// O documento novo nasce como **rascunho** em `.mdoffice/rascunhos` (um arquivo de verdade,
// que o autosave mantém); o nome da subpasta do tipo fica só como sugestão de pasta no
// diálogo de salvar. Nada aqui cria pasta nem escreve no disco.
import { comRaizPadrao, type TipoComPasta } from "../pastas";
import { toast } from "../util";
import * as files from "../files";
import type { App } from "./app";

/** A raiz "padrão" — no navegador não há uma: quem escolhe a pasta é a pessoa. */
export async function raizPadrao(): Promise<string> {
  return "";
}

/** A subpasta sugerida por tipo ("Markdown", "Documentos", "Planilhas", "Apresentações"). */
export async function pastaPadraoDoTipo(tipo: TipoComPasta): Promise<string> {
  return comRaizPadrao(await raizPadrao(), tipo);
}

/** A extensão de cada tipo (o rascunho nasce com ela). */
const EXTENSAO: Record<TipoComPasta, "md" | "docx" | "pptx" | "xlsx"> = {
  md: "md",
  word: "docx",
  excel: "xlsx",
  ppt: "pptx",
};

export const pastaPadraoMethods = {
  async pastaPadraoDoTipo(this: App, tipo: TipoComPasta): Promise<string> {
    return await pastaPadraoDoTipo(tipo);
  },

  /**
   * O documento recém-criado nasce guardado como **rascunho** em `.mdoffice/rascunhos`
   * (Markdown e Office). É o mesmo desenho do documento novo do Markdown: o autosave grava
   * nele, e "Salvar como…" escolhe a pasta definitiva.
   */
  async nascerNoPadrao(this: App, tipo: TipoComPasta): Promise<void> {
    const tab = this.tab;
    try {
      const base = this.docTitleForFileName() || "documento";
      this.tab.path = await files.draftPath(base, EXTENSAO[tipo]);
      this.tab.isDraft = true;
      await this.save(false);
      await this.sidebar.refresh();
      const escolhida = await files.draftFolderInfo().catch(() => null);
      toast(
        escolhida
          ? `Rascunho guardado na pasta “${escolhida.nome}” — “Salvar como…” escolhe outro lugar.`
          : `Rascunho guardado em .mdoffice/rascunhos — “Salvar como…” escolhe outro lugar.`,
        "ok",
        4600
      );
    } catch (e) {
      // a gravação falhou: o selo não pode continuar dizendo "Salvo"
      tab.dirty = true;
      tab.saveFailed = true;
      tab.statusSaved = "Não foi possível salvar";
      if (tab === this.tab) this.setSaveState();
      this.renderTabs();
      toast(`Não consegui guardar o rascunho (${String(e)}). Use “Salvar como…” para escolher a pasta.`, "info", 7000);
    }
  },
};
