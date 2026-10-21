// Os rascunhos no navegador.
//
// Um documento novo ainda não tem arquivo nenhum. Para o salvamento automático não ser uma
// promessa vazia (o selo dizia "Salvo" e nada existia no disco), o autosave cria um
// rascunho de verdade e passa a gravar nele.
//
// O lugar é escolhido pela pessoa em **Configurações ▸ Histórico e salvamento ▸ Pasta dos
// rascunhos**. O handle fica no IndexedDB (como o das pastas de projeto), então o rascunho
// sobrevive a fechar e reabrir o app. Os arquivos entram direto na pasta escolhida:
//
//   Minha pasta de rascunhos/notas.md
//
// Sem uma pasta escolhida, vale o desenho antigo: `.mdoffice/rascunhos/` dentro da primeira
// pasta concedida ao app. Sem nenhuma das duas, o autosave não tem onde gravar e o app avisa.
//
// O rascunho aparece em **Início ▸ Rascunhos** e no painel lateral, e sai de lá quando a
// pessoa usa "Salvar como…" (o app apaga o rascunho depois de gravar o arquivo definitivo).
import {
  apagarDocumento,
  apagarPasta,
  atualizarDocumento,
  buscarDocumento,
  buscarPasta,
  documentoPorCaminho,
  esquecerPastaDeRascunhos,
  guardarPastaDeRascunhos,
  ID_RASCUNHOS,
  listarDocumentos,
  listarPastas,
  pastaDeRascunhosSalva,
  pastaPadrao,
  PREFIXO_RASCUNHO,
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

/** A pasta antiga dos rascunhos (dentro do `.mdoffice`), usada sem pasta escolhida. */
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
  relativo: string,
  idBase?: string
): Promise<DocumentoRegistrado> {
  const existente = await documentoPorCaminho(pastaId, relativo);
  if (!existente) return await registrarDocumento(handle, pastaId, relativo, idBase);
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
  const escolhida = await pastaDeRascunhosSalva();
  const pasta = escolhida ?? (await pastaPadrao());
  if (!pasta) {
    throw new Error(
      "Escolha a pasta dos rascunhos em Configurações ▸ Histórico e salvamento (ou conceda uma pasta ao app)."
    );
  }
  const dir = escolhida ? escolhida.handle : await pastaDeRascunhos(pasta.handle);
  if (!dir) throw new Error("Não consegui criar a pasta dos rascunhos.");
  const seguro =
    base
      .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "-")
      .replace(/[. ]+$/g, "")
      .trim()
      .slice(0, 60) || "documento";
  const nome = await nomeLivre(dir, `${seguro}.${ext}`);
  const handle = await dir.getFileHandle(nome, { create: true });
  // na pasta escolhida o arquivo mora direto nela; no desenho antigo, dentro de .mdoffice
  const relativo = escolhida ? nome : `.mdoffice/${PASTA}/${nome}`;
  const pastaId = escolhida ? ID_RASCUNHOS : pasta.id;
  // o prefixo `rascunho/` evita que o id colida com um documento de mesmo nome em outra pasta
  const idBase = escolhida ? `${PREFIXO_RASCUNHO}${nome}` : relativo;
  const doc = await registrar(handle, pastaId, relativo, idBase);
  return doc.id;
}

/** Os rascunhos guardados, do mais novo para o mais antigo. */
export async function listar(): Promise<RascunhoInfo[]> {
  const saida: RascunhoInfo[] = [];
  const escolhida = await pastaDeRascunhosSalva();
  if (escolhida) {
    for (const nome of await nomesDeArquivos(escolhida.handle)) {
      if (!EXTENSOES.test(nome)) continue;
      try {
        const handle = await escolhida.handle.getFileHandle(nome);
        const arquivo = await handle.getFile();
        const doc = await registrar(handle, ID_RASCUNHOS, nome, `${PREFIXO_RASCUNHO}${nome}`);
        saida.push({ path: doc.id, modified_ms: arquivo.lastModified, bytes: arquivo.size });
      } catch {
        /* sumiu no meio da leitura */
      }
    }
  }
  for (const concedida of await listarPastas()) {
    if (concedida.id === ID_RASCUNHOS) continue;
    const dir = await pastaDeRascunhos(concedida.handle, false);
    if (!dir) continue;
    for (const nome of await nomesDeArquivos(dir)) {
      if (!EXTENSOES.test(nome)) continue;
      try {
        const handle = await dir.getFileHandle(nome);
        const arquivo = await handle.getFile();
        const relativo = `.mdoffice/${PASTA}/${nome}`;
        const doc = await registrar(handle, concedida.id, relativo);
        saida.push({ path: doc.id, modified_ms: arquivo.lastModified, bytes: arquivo.size });
      } catch {
        /* sumiu no meio da leitura */
      }
    }
  }
  return saida.sort((a, b) => b.modified_ms - a.modified_ms);
}

/** A pasta dos rascunhos (o rótulo que a interface mostra; não há caminho absoluto). */
export async function pasta(): Promise<string> {
  const escolhida = await pastaDeRascunhosSalva();
  return escolhida ? escolhida.nome : `.mdoffice/${PASTA}`;
}

/** A pasta escolhida para os rascunhos (null = nunca escolheu). */
export async function pastaEscolhida(): Promise<{ nome: string } | null> {
  const escolhida = await pastaDeRascunhosSalva();
  return escolhida ? { nome: escolhida.nome } : null;
}

/** Define a pasta dos rascunhos a partir de uma pasta já concedida ao app. */
export async function definirPasta(id: string): Promise<{ nome: string }> {
  const pasta = await buscarPasta(id);
  if (!pasta) throw new Error("A pasta escolhida não está mais disponível.");
  const salva = await guardarPastaDeRascunhos(pasta.handle);
  // O seletor registra a pasta como se fosse de projeto. Se nenhum documento usa esse
  // registro, ele sai: a pasta dos rascunhos não é a pasta dos documentos. Se já era um
  // projeto (tem documentos), o registro fica — apagá-lo quebraria os arquivos abertos.
  const documentos = await listarDocumentos();
  if (!documentos.some((d) => d.pastaId === id)) await apagarPasta(id);
  return { nome: salva.nome };
}

/** Esquece a pasta escolhida (os arquivos que já estão nela não são apagados). */
export async function esquecerPasta(): Promise<void> {
  await esquecerPastaDeRascunhos();
}

/**
 * Apaga um rascunho (o arquivo e o registro).
 *
 * Só mexe no que é rascunho: se o caminho for de um documento de verdade (o "Salvar como"
 * apaga o rascunho anterior), ele é ignorado.
 */
export async function apagar(path: string): Promise<void> {
  const doc = await buscarDocumento(path);
  if (!doc) return;
  const nome = doc.relativo.split("/").pop() ?? doc.nome;
  let dir: FileSystemDirectoryHandle | null = null;
  if (doc.pastaId === ID_RASCUNHOS) {
    const escolhida = await pastaDeRascunhosSalva();
    dir = escolhida?.handle ?? null;
  } else if (doc.relativo.startsWith(`.mdoffice/${PASTA}/`)) {
    try {
      dir = await pastaDeRascunhos(await raizDoDocumento(doc), false);
    } catch {
      dir = null;
    }
  } else {
    return; // não é rascunho: o "Salvar como" não pode apagar um documento do usuário
  }
  try {
    if (dir) await apagarArquivo(dir, nome);
  } catch {
    /* o arquivo já não está lá: o registro sai de qualquer forma */
  }
  await apagarDocumento(doc.id);
}
