// Os rascunhos no navegador: `.mdoffice/rascunhos/` DENTRO da pasta escolhida.
//
// Um documento novo ainda não tem arquivo nenhum. Para o salvamento automático não ser uma
// promessa vazia (o selo dizia "Salvo" e nada existia no disco), o autosave cria um
// rascunho de verdade e passa a gravar nele. É o mesmo desenho dos rascunhos do app nativo
// — que ficam na pasta de dados do Windows —, só que ao lado dos documentos:
//
//   Projeto/.mdoffice/rascunhos/notas.md
//
// O rascunho aparece em **Início ▸ Rascunhos** e no painel lateral, e sai de lá quando a
// pessoa usa "Salvar como…" (o app apaga o rascunho depois de gravar o arquivo definitivo).
import {
  apagarDocumento,
  atualizarDocumento,
  buscarDocumento,
  documentoPorCaminho,
  listarPastas,
  pastaPadrao,
  registrarDocumento,
  type DocumentoRegistrado,
} from "./registro";
import {
  apagarArquivo,
  nomesDeArquivos,
  pastaDoApp,
  raizDoDocumento,
  subpasta,
  subpastaSeExistir,
} from "./pastaApp";

/** A pasta dos rascunhos (dentro do `.mdoffice`). */
const PASTA = "rascunhos";
const EXTENSOES = /\.(md|markdown|mdx|docx|pptx|xlsx|xlsm)$/i;

/** O que a interface espera do `list_drafts` (o mesmo do app nativo). */
export interface RascunhoInfo {
  path: string;
  modified_ms: number;
  bytes: number;
}

/** A pasta dos rascunhos de uma raiz concedida (criada se preciso). */
async function pastaDeRascunhos(
  raiz: FileSystemDirectoryHandle,
  criar = true
): Promise<FileSystemDirectoryHandle | null> {
  if (criar) {
    const app = await pastaDoApp(raiz);
    return await subpasta(app, [PASTA]);
  }
  const app = await subpastaSeExistir(raiz, [".mdoffice"]);
  if (!app) return null;
  return await subpastaSeExistir(app, [PASTA]);
}

/** Nome livre dentro da pasta (`notas.md`, `notas-1.md`…). */
async function nomeLivre(pasta: FileSystemDirectoryHandle, nome: string): Promise<string> {
  const ocupados = new Set(await nomesDeArquivos(pasta));
  if (!ocupados.has(nome)) return nome;
  const ponto = nome.lastIndexOf(".");
  const base = ponto > 0 ? nome.slice(0, ponto) : nome;
  const ext = ponto > 0 ? nome.slice(ponto) : "";
  let i = 1;
  while (ocupados.has(`${base}-${i}${ext}`)) i++;
  return `${base}-${i}${ext}`;
}

/** Registra o arquivo do rascunho (reaproveita o id se ele já existir). */
async function registrar(
  handle: FileSystemFileHandle,
  pastaId: string,
  relativo: string
): Promise<DocumentoRegistrado> {
  const existente = await documentoPorCaminho(pastaId, relativo);
  if (!existente) return await registrarDocumento(handle, pastaId, relativo);
  existente.handle = handle;
  const arquivo = await handle.getFile().catch(() => null);
  if (arquivo) {
    existente.modificado = arquivo.lastModified;
    existente.bytes = arquivo.size;
  }
  await atualizarDocumento(existente);
  return existente;
}

/**
 * Cria um rascunho novo (nome livre) e devolve o **id** do documento.
 *
 * Quem chama (o autosave, via `draft_path`) recebe o id como se fosse um caminho: o resto
 * do app não sabe a diferença.
 */
export async function criar(base: string, ext = "md"): Promise<string> {
  const pasta = await pastaPadrao();
  if (!pasta) {
    throw new Error("Escolha a pasta dos seus documentos antes: o rascunho é guardado nela, em .mdoffice/rascunhos.");
  }
  const dir = await pastaDeRascunhos(pasta.handle);
  if (!dir) throw new Error("Não consegui criar a pasta dos rascunhos.");
  const seguro =
    base
      .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "-")
      .replace(/[. ]+$/g, "")
      .trim()
      .slice(0, 60) || "documento";
  const nome = await nomeLivre(dir, `${seguro}.${ext}`);
  const handle = await dir.getFileHandle(nome, { create: true });
  const doc = await registrar(handle, pasta.id, `.mdoffice/${PASTA}/${nome}`);
  return doc.id;
}

/** Os rascunhos guardados, do mais novo para o mais antigo. */
export async function listar(): Promise<RascunhoInfo[]> {
  const saida: RascunhoInfo[] = [];
  for (const concedida of await listarPastas()) {
    const dir = await pastaDeRascunhos(concedida.handle, false);
    if (!dir) continue;
    for (const nome of await nomesDeArquivos(dir)) {
      if (!EXTENSOES.test(nome)) continue;
      try {
        const handle = await dir.getFileHandle(nome);
        const arquivo = await handle.getFile();
        const doc = await registrar(handle, concedida.id, `.mdoffice/${PASTA}/${nome}`);
        saida.push({ path: doc.id, modified_ms: arquivo.lastModified, bytes: arquivo.size });
      } catch {
        /* sumiu no meio da leitura */
      }
    }
  }
  return saida.sort((a, b) => b.modified_ms - a.modified_ms);
}

/** A pasta dos rascunhos (o rótulo que a interface mostra; não há caminho absoluto). */
export function pasta(): string {
  return `.mdoffice/${PASTA}`;
}

/**
 * Apaga um rascunho (o arquivo e o registro).
 *
 * Só mexe no que está dentro de `.mdoffice/rascunhos`: se o caminho for de um documento de
 * verdade (o "Salvar como" apaga o rascunho anterior), ele é ignorado.
 */
export async function apagar(path: string): Promise<void> {
  const doc = await buscarDocumento(path);
  if (!doc || !doc.relativo.startsWith(`.mdoffice/${PASTA}/`)) return;
  const nome = doc.relativo.split("/").pop() ?? doc.nome;
  try {
    const raiz = await raizDoDocumento(doc);
    const dir = await pastaDeRascunhos(raiz, false);
    if (dir) await apagarArquivo(dir, nome);
  } catch {
    /* o arquivo já não está lá: o registro sai de qualquer forma */
  }
  await apagarDocumento(doc.id);
}
