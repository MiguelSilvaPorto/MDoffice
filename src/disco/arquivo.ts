// As operações de arquivo do navegador (File System Access API).
//
// O navegador não dá caminho: ele dá **handle**. Toda operação aqui trabalha com o handle
// guardado no registro (`registro.ts`). Duas coisas que o FSA não tem e que o app precisa:
//  - **renomear** e **mover** não existem → o arquivo é lido, gravado no destino e o
//    original é apagado (é o que o "mover sem sobrescrever" do app já faz);
//  - **apagar** precisa de permissão de escrita → por isso a `permissao` é pedida antes.
//
// O `path` que o app passa por aqui é o **id do registro** (no app nativo é o caminho
// absoluto — a ponte `src/ponte` traduz um no outro).

import {
  apagarDocumento,
  apagarPasta as esquecerPasta,
  atualizarDocumento,
  buscarDocumento,
  buscarPasta,
  listarDocumentos,
  listarPastas,
  pastaPadrao,
  registrarDocumento,
  registrarPasta,
  type DocumentoRegistrado,
} from "./registro";

/** O navegador tem o File System Access API? (é Chromium-only) */
export function temDisco(): boolean {
  return typeof window !== "undefined" && typeof window.showDirectoryPicker === "function";
}

/**
 * Adota um arquivo que chegou por arrastar-e-soltar.
 *
 * O Chromium entrega um handle de verdade no `drop`; o registro dá a ele um id, e o app
 * passa a abrir/gravar o arquivo como qualquer outro. Quando o arquivo está dentro de uma
 * pasta já concedida, o caminho relativo passa a ser o de dentro dela (o backup e a lixeira
 * ficam no `.mdoffice` certo); quando não está, fica só o nome (e a pasta do arquivo é a
 * que o Chromium informa pelo `parent`).
 */
export async function adotarArquivo(handle: FileSystemFileHandle): Promise<string> {
  const pasta = await pastaPadrao();
  const doc = await registrarDocumento(handle, pasta?.id ?? "", handle.name);
  return doc.id;
}

/** O caminho que a pessoa vê: a pasta concedida + o caminho dentro dela ("Projeto/notas.md"). */
export async function caminhoDeExibicao(path: string): Promise<string> {
  const doc = await buscarDocumento(path);
  if (doc) {
    const pasta = doc.pastaId ? await buscarPasta(doc.pastaId) : null;
    return pasta ? `${pasta.nome}/${doc.relativo}` : doc.relativo;
  }
  const pasta = await buscarPasta(path);
  if (pasta) return pasta.nome;
  return path;
}

/** O nome do arquivo (sem a pasta). */
export async function nomeDoDocumento(path: string): Promise<string> {
  const doc = await buscarDocumento(path);
  return doc?.nome ?? path;
}

/** O caminho relativo é SEMPRE dentro da pasta concedida (a pasta não entra nele). */
function relativoDe(handle: FileSystemFileHandle, _pastaNome: string, subpasta: string): string {
  return subpasta ? `${subpasta}/${handle.name}` : handle.name;
}

/** O caminho relativo de um arquivo recém-escolhido (só o nome: a pasta concedida é a base). */
function relativoDoArquivo(handle: FileSystemFileHandle, _pasta: { nome: string } | null): string {
  return handle.name;
}

// ---------- permissão ----------

/** Garante a permissão de escrita no handle (o Chromium pede ao usuário). */
async function permissao(handle: FileSystemHandle, modo: "read" | "readwrite"): Promise<boolean> {
  if (!handle.queryPermission) return true; // sem API de permissão: o FSA já autorizou
  const atual = await handle.queryPermission({ mode: modo });
  if (atual === "granted") return true;
  if (!handle.requestPermission) return false;
  const pedido = await handle.requestPermission({ mode: modo });
  return pedido === "granted";
}

// ---------- escolher ----------

/** A pessoa cancelou o diálogo do sistema? (só isso engole o erro; o resto sobe) */
function cancelou(e: unknown): boolean {
  if (!(e instanceof DOMException)) return false;
  if (e.name === "AbortError") return true; // a pessoa fechou o diálogo
  if (e.name === "NotAllowedError") {
    // o navegador não permitiu abrir o seletor (sem gesto do usuário, sem permissão, janela
    // sem foco): para o app é "nada escolhido", mas o dev precisa saber que o diálogo nem abriu
    console.warn("[disco] o navegador não permitiu abrir o seletor de arquivos:", e.message);
    return true;
  }
  return false;
}

/** A pessoa escolhe uma pasta (o app ganha o acesso a ela). */
export async function escolherPasta(): Promise<string | null> {
  if (!window.showDirectoryPicker) return null;
  try {
    const handle = await window.showDirectoryPicker({ id: "mdoffice-pasta", mode: "readwrite" });
    const pasta = await registrarPasta(handle);
    return pasta.id;
  } catch (e) {
    // cancelar devolve null; um erro de verdade (o registro falhou, o IndexedDB negou) sobe —
    // senão o app trataria "não consegui" como "a pessoa desistiu" e nada aconteceria
    if (cancelou(e)) return null;
    throw e;
  }
}

/** A pessoa escolhe um arquivo (o app ganha o acesso a ele). */
export async function escolherArquivo(extensoes: string[], descricao = "Documentos"): Promise<string | null> {
  if (!window.showOpenFilePicker) return null;
  try {
    const [handle] = await window.showOpenFilePicker({
      multiple: false,
      types: extensoes.length ? [{ description: descricao, accept: { "text/plain": extensoes.map((e) => `.${e}`) } }] : undefined,
    });
    if (!handle) return null;
    const pasta = await pastaPadrao();
    const doc = await registrarDocumento(handle, pasta?.id ?? "", relativoDoArquivo(handle, pasta));
    return doc.id;
  } catch (e) {
    if (cancelou(e)) return null;
    throw e;
  }
}

/** A pessoa escolhe um arquivo e ONDE salvar (devolve o id do registro novo). */
export async function salvarComo(nomeSugerido: string, extensoes: string[], descricao = "Documentos"): Promise<string | null> {
  if (!window.showSaveFilePicker) return null;
  try {
    const handle = await window.showSaveFilePicker({
      suggestedName: nomeSugerido,
      types: extensoes.length ? [{ description: descricao, accept: { "text/plain": extensoes.map((e) => `.${e}`) } }] : undefined,
    });
    const pasta = await pastaPadrao();
    const doc = await registrarDocumento(handle, pasta?.id ?? "", relativoDoArquivo(handle, pasta));
    return doc.id;
  } catch (e) {
    if (cancelou(e)) return null;
    throw e;
  }
}

// ---------- ler e gravar ----------

/** Lê o texto de um documento (o `path` é o id do registro). */
export async function lerTexto(path: string): Promise<string> {
  const doc = await buscarDocumento(path);
  if (!doc) throw new Error("O documento não está mais disponível.");
  const arquivo = await doc.handle.getFile();
  return await arquivo.text();
}

/** Grava o texto de um documento. */
export async function gravarTexto(path: string, conteudo: string): Promise<void> {
  const doc = await buscarDocumento(path);
  if (!doc) throw new Error("O documento não está mais disponível.");
  await gravarNoHandle(doc.handle, conteudo);
  await atualizar(doc, new Blob([conteudo]).size);
}

/** Grava bytes (base64) num documento — o DOCX/XLSX/PPTX exportado. */
export async function gravarBytes(path: string, base64: string): Promise<void> {
  const doc = await buscarDocumento(path);
  if (!doc) throw new Error("O documento não está mais disponível.");
  const bin = atob(base64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  await gravarNoHandle(doc.handle, bytes);
  await atualizar(doc, bytes.byteLength);
}

async function gravarNoHandle(handle: FileSystemFileHandle, dados: string | Uint8Array): Promise<void> {
  if (!(await permissao(handle, "readwrite"))) throw new Error("O navegador não deu permissão para gravar neste arquivo.");
  const fluxo = await handle.createWritable();
  await fluxo.write(dados as FileSystemWriteChunkType);
  await fluxo.close();
}

/** Atualiza o registro (o tamanho e a data mudaram a cada gravação). */
async function atualizar(doc: DocumentoRegistrado, bytes: number): Promise<void> {
  doc.bytes = bytes;
  doc.modificado = Date.now();
  await atualizarDocumento(doc);
}

/** Lê um arquivo como data URL (a prévia da imagem). */
export async function lerComoDataUrl(path: string): Promise<string> {
  const doc = await buscarDocumento(path);
  if (!doc) throw new Error("O arquivo não está mais disponível.");
  const arquivo = await doc.handle.getFile();
  const buffer = new Uint8Array(await arquivo.arrayBuffer());
  let bin = "";
  for (let i = 0; i < buffer.length; i++) bin += String.fromCharCode(buffer[i]);
  return `data:${arquivo.type || "application/octet-stream"};base64,${btoa(bin)}`;
}

/** Os bytes de um documento (a prévia do Office abre o zip). */
export async function bytesDoDocumento(path: string): Promise<Uint8Array> {
  const doc = await buscarDocumento(path);
  if (!doc) throw new Error("O arquivo não está mais disponível.");
  return new Uint8Array(await (await doc.handle.getFile()).arrayBuffer());
}

// ---------- a pasta assets/ ----------

/**
 * A pasta onde o documento vive.
 *
 * Quando a pessoa concedeu uma pasta, ela é a base e o caminho relativo diz onde o documento
 * está dentro dela. Quando o arquivo foi aberto sozinho (sem a pasta), o Chromium dá a pasta
 * dele pelo `parent` — é o mesmo lugar, só que sem o registro.
 */
export async function pastaBase(doc: DocumentoRegistrado): Promise<FileSystemDirectoryHandle> {
  if (doc.pastaId) {
    const pasta = await buscarPasta(doc.pastaId);
    if (pasta) {
      const partes = doc.relativo.split("/").slice(0, -1); // o último pedaço é o nome do arquivo
      let atual = pasta.handle;
      for (const parte of partes) {
        if (!parte) continue;
        atual = await atual.getDirectoryHandle(parte);
      }
      return atual;
    }
  }
  if (doc.handle.parent) return doc.handle.parent;
  throw new Error("A pasta do documento não está mais disponível.");
}

/** A pasta `assets/` ao lado do documento (criada se preciso). */
async function pastaAssets(doc: DocumentoRegistrado): Promise<FileSystemDirectoryHandle> {
  const base = await pastaBase(doc);
  return await base.getDirectoryHandle("assets", { create: true });
}

/** Copia um arquivo (já registrado) para a `assets/` do documento. Devolve o caminho relativo. */
export async function copiarAsset(doc: string, origem: string, nome?: string | null): Promise<string> {
  const alvo = await buscarDocumento(doc);
  if (!alvo) throw new Error("O documento ainda não foi salvo em uma pasta.");
  const src = await buscarDocumento(origem);
  if (!src) throw new Error("O arquivo de origem não está mais disponível.");
  const pasta = await pastaAssets(alvo);
  const nomeFinal = nome || src.nome;
  const arquivo = await pasta.getFileHandle(nomeFinal, { create: true });
  await gravarNoHandle(arquivo, new Uint8Array(await (await src.handle.getFile()).arrayBuffer()));
  return `assets/${arquivo.name}`;
}

/** Grava bytes (base64) num arquivo novo dentro da `assets/`. */
export async function escreverAsset(doc: string, nome: string, base64: string): Promise<string> {
  const alvo = await buscarDocumento(doc);
  if (!alvo) throw new Error("O documento ainda não foi salvo em uma pasta.");
  const pasta = await pastaAssets(alvo);
  const arquivo = await pasta.getFileHandle(nome, { create: true });
  await gravarNoHandle(arquivo, base64ParaBytes(base64));
  return `assets/${arquivo.name}`;
}

/** Atualiza um arquivo que já está dentro de `assets/` (o desenho grava PNG e JSON). */
export async function atualizarAsset(doc: string, relativo: string, base64: string): Promise<void> {
  const alvo = await buscarDocumento(doc);
  if (!alvo) throw new Error("O documento ainda não foi salvo em uma pasta.");
  const partes = relativo.replace(/\\/g, "/").split("/");
  if (partes[0] !== "assets" || partes.length < 2) throw new Error("O arquivo precisa estar dentro de assets/.");
  const pasta = await pastaAssets(alvo);
  const arquivo = await pasta.getFileHandle(partes[partes.length - 1], { create: true });
  await gravarNoHandle(arquivo, base64ParaBytes(base64));
}

/** Copia a pasta `assets/` de um documento para o lado do outro (sem sobrescrever). */
export async function copiarAssets(fromDoc: string, toDoc: string): Promise<number> {
  const origem = await buscarDocumento(fromDoc);
  const destino = await buscarDocumento(toDoc);
  if (!origem || !destino) return 0;
  let de: FileSystemDirectoryHandle;
  try {
    de = await pastaAssets(origem);
  } catch {
    return 0;
  }
  const para = await pastaAssets(destino);
  const existentes = new Set<string>();
  for await (const item of para.values()) existentes.add(item.name);
  let copiados = 0;
  for await (const item of de.values()) {
    if (item.kind !== "file") continue;
    const arquivo = item as FileSystemFileHandle;
    let nome = arquivo.name;
    if (existentes.has(nome)) {
      const ponto = nome.lastIndexOf(".");
      const base = ponto > 0 ? nome.slice(0, ponto) : nome;
      const ext = ponto > 0 ? nome.slice(ponto) : "";
      let i = 1;
      while (existentes.has(`${base}-${i}${ext}`)) i++;
      nome = `${base}-${i}${ext}`;
    }
    const novo = await para.getFileHandle(nome, { create: true });
    await gravarNoHandle(novo, new Uint8Array(await (await arquivo.getFile()).arrayBuffer()));
    existentes.add(nome);
    copiados++;
  }
  return copiados;
}

/** base64 → bytes (o caminho que o app usa para os desenhos e as imagens). */
function base64ParaBytes(base64: string): Uint8Array {
  const bin = atob(base64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

// ---------- renomear, mover, apagar ----------

/** Renomeia o documento (o FSA não renomeia: grava no novo e apaga o velho). */
export async function renomearDocumento(path: string, novoNome: string): Promise<string> {
  const doc = await buscarDocumento(path);
  if (!doc) throw new Error("O documento não foi encontrado.");
  const base = await pastaBase(doc);
  const destino = await base.getFileHandle(novoNome, { create: true });
  const arquivo = await doc.handle.getFile();
  await gravarNoHandle(destino, new Uint8Array(await arquivo.arrayBuffer()));
  const salvo = await registrarDocumento(destino, doc.pastaId, doc.relativo.replace(/[^/]+$/, destino.name));
  await apagarHandle(doc);
  await apagarDocumento(doc.id);
  return salvo.id;
}

/** Move o documento para outra pasta. */
export async function moverDocumento(path: string, pastaDestinoId: string): Promise<string> {
  const doc = await buscarDocumento(path);
  if (!doc) throw new Error("O documento não foi encontrado.");
  const destinoPasta = await buscarPasta(pastaDestinoId);
  if (!destinoPasta) throw new Error("A pasta de destino não está mais disponível.");
  const destino = await destinoPasta.handle.getFileHandle(doc.nome, { create: true });
  const arquivo = await doc.handle.getFile();
  await gravarNoHandle(destino, new Uint8Array(await arquivo.arrayBuffer()));
  const salvo = await registrarDocumento(destino, pastaDestinoId, relativoDe(destino, destinoPasta.nome, ""));
  await apagarHandle(doc);
  await apagarDocumento(doc.id);
  return salvo.id;
}

/** Apaga o documento (do registro e do disco). */
export async function apagarDocumentoDisco(path: string): Promise<void> {
  const doc = await buscarDocumento(path);
  if (!doc) return;
  await apagarHandle(doc);
  await apagarDocumento(doc.id);
}

/** Apaga o handle do disco (sem depender só do `parent`: ele pode faltar). */
async function apagarHandle(doc: DocumentoRegistrado): Promise<void> {
  try {
    const pasta = await pastaBase(doc);
    await pasta.removeEntry(doc.handle.name);
    return;
  } catch {
    /* cai no parent */
  }
  try {
    if (doc.handle.parent) await doc.handle.parent.removeEntry(doc.handle.name);
  } catch {
    /* já não está lá */
  }
}

// ---------- pastas ----------

/** Cria uma subpasta dentro de uma pasta (e devolve o id do registro). */
export async function criarPasta(pastaId: string, nome: string): Promise<string> {
  const pasta = await buscarPasta(pastaId);
  if (!pasta) throw new Error("A pasta não está mais disponível.");
  const sub = await pasta.handle.getDirectoryHandle(nome, { create: true });
  const registrada = await registrarPasta(sub);
  return registrada.id;
}

/** Renomeia uma pasta. */
export async function renomearPasta(pastaId: string, novoNome: string): Promise<string> {
  const pasta = await buscarPasta(pastaId);
  if (!pasta) throw new Error("A pasta não foi encontrada.");
  const mae = pasta.handle.parent;
  if (!mae) throw new Error("A pasta não tem pasta-mãe.");
  const destino = await mae.getDirectoryHandle(novoNome, { create: true });
  // o FSA não copia o conteúdo: a pasta renomeada fica com o conteúdo antigo — por isso a
  // renomeação de pasta só faz sentido para pastas criadas pelo app
  const registrada = await registrarPasta(destino);
  return registrada.id;
}

/** Apaga uma pasta — **só se estiver vazia** (documento nunca sai por engano). */
export async function apagarPasta(pastaId: string): Promise<void> {
  const pasta = await buscarPasta(pastaId);
  if (!pasta) throw new Error("A pasta não foi encontrada.");
  const mae = pasta.handle.parent;
  if (!mae) throw new Error("A pasta não tem pasta-mãe.");
  let cheia = false;
  for await (const _ of pasta.handle.values()) {
    cheia = true;
    break;
  }
  if (cheia) throw new Error("A pasta não está vazia. Mova ou apague os documentos antes de excluí-la.");
  await mae.removeEntry(pasta.handle.name);
  await esquecerPasta(pastaId);
}

/** Uma pasta do registro, com o handle (usada internamente). */
export async function handleDe(pastaId: string): Promise<FileSystemDirectoryHandle | null> {
  const pasta = await buscarPasta(pastaId);
  return pasta?.handle ?? null;
}

/** Todos os documentos registrados (o "abertos" do navegador). */
export async function documentosRegistrados(): Promise<DocumentoRegistrado[]> {
  return await listarDocumentos();
}

/** Todas as pastas concedidas. */
export async function pastasConcedidas(): Promise<string[]> {
  return (await listarPastas()).map((p) => p.id);
}
