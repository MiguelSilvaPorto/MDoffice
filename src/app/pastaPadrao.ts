// Pasta padrão dos documentos: onde um documento novo nasce, sem o usuário escolher nada.
//
// A raiz é `…/Documentos/mdOffice` (o Rust cria: `default_docs_dir`) e dentro dela vivem as
// quatro subpastas por tipo — Markdown, Word, Excel, PowerPoint. O documento novo nasce **salvo**
// na subpasta do próprio tipo (nome livre: Documento, Documento-2, …) e a raiz entra na lista de
// projetos da barra lateral, então as subpastas aparecem na árvore como pastas normais.
//
// Quem quiser outro lugar usa "Salvar como…", que continua perguntando — já sugerindo a subpasta
// do tipo.

import { createFolder, defaultDocsDir, existsText } from "../files";
import { comRaizPadrao, EXTENSAO_DO_TIPO, PASTA_DO_TIPO, type TipoComPasta } from "../pastas";
import { joinPath, toast } from "../util";
import type { App } from "./app";

/** A raiz resolvida nesta sessão (a chamada ao Rust não se repete). */
let raiz: string | null = null;
/** As subpastas já garantidas nesta sessão. */
const prontas = new Set<string>();

/** A raiz `…/Documentos/mdOffice`, garantindo as quatro subpastas por tipo. */
export async function raizPadrao(): Promise<string> {
  if (!raiz) raiz = await defaultDocsDir();
  for (const tipo of Object.keys(EXTENSAO_DO_TIPO) as TipoComPasta[]) {
    if (prontas.has(tipo)) continue;
    try {
      await createFolder(raiz, PASTA_DO_TIPO[tipo]);
      prontas.add(tipo);
    } catch {
      /* a pasta pode existir (ou o disco reclamar): o save cria de novo se precisar */
    }
  }
  return raiz;
}

/** A subpasta de um tipo, criada se preciso. */
export async function pastaPadraoDoTipo(tipo: TipoComPasta): Promise<string> {
  return comRaizPadrao(await raizPadrao(), tipo);
}

/** O arquivo já existe? (sonda barata: a leitura de um arquivo inexistente responde rápido) */
async function existe(caminho: string): Promise<boolean> {
  try {
    return await existsText(caminho);
  } catch {
    return false;
  }
}

/**
 * Um caminho livre na pasta padrão do tipo: `Documento.docx`, `Documento-2.docx`… A checagem é
 * no disco (não numa lista em memória), então dois documentos novos seguidos nunca colidem.
 */
export async function caminhoPadraoLivre(tipo: TipoComPasta): Promise<string> {
  const pasta = await pastaPadraoDoTipo(tipo);
  const ext = EXTENSAO_DO_TIPO[tipo];
  for (let n = 1; n <= 200; n++) {
    const nome = n === 1 ? `Documento.${ext}` : `Documento-${n}.${ext}`;
    const caminho = joinPath(pasta, nome);
    if (!(await existe(caminho))) return caminho;
  }
  return joinPath(pasta, `Documento-${Date.now()}.${ext}`);
}

export const pastaPadraoMethods = {
  /** A pasta padrão do tipo (com a raiz e as quatro subpastas garantidas). */
  async pastaPadraoDoTipo(this: App, tipo: TipoComPasta): Promise<string> {
    return await pastaPadraoDoTipo(tipo);
  },

  /** Um caminho livre na pasta padrão do tipo. */
  async caminhoPadraoLivre(this: App, tipo: TipoComPasta): Promise<string> {
    return await caminhoPadraoLivre(tipo);
  },

  /** Registra a raiz padrão como projeto na barra lateral (idempotente) e devolve a raiz. */
  async registrarProjetoPadrao(this: App): Promise<string> {
    const base = await raizPadrao();
    await this.sidebar.addProjectPath(base);
    return base;
  },

  /**
   * O documento recém-criado nasce **salvo** na pasta padrão do tipo: `Documentos/mdOffice/Word/
   * Documento.docx`, por exemplo. Sem diálogo — quem quer outro lugar usa "Salvar como…".
   */
  async nascerNoPadrao(this: App, tipo: TipoComPasta): Promise<void> {
    try {
      this.tab.path = await caminhoPadraoLivre(tipo);
      this.tab.isDraft = false;
      await this.save(false);
      await this.registrarProjetoPadrao();
      await this.sidebar.refresh();
      toast(`Documento novo em Documentos\\mdOffice\\${PASTA_DO_TIPO[tipo]} — “Salvar como…” escolhe outro lugar.`, "ok", 4600);
    } catch (e) {
      toast(`Não consegui guardar o documento na pasta padrão (${String(e)}). Use “Salvar como…” para escolher a pasta.`, "info", 7000);
    }
  },
};
