// A pasta do próprio app dentro da pasta concedida: `.mdoffice/`.
//
// No app nativo o backup e a lixeira ficam em `%LOCALAPPDATA%\com.mdoffice.desktop`. No
// navegador não existe "pasta de dados do app" — e não queremos uma pasta escondida no
// sistema. Então tudo do app vive em `.mdoffice/`, ao lado dos documentos:
//
//   Projeto/notas.md
//   Projeto/.mdoffice/backups/…      (as cópias datadas)
//   Projeto/.mdoffice/lixeira/…      (o que saiu da pasta, por 30 dias)
//
// Assim o backup viaja junto com os documentos (basta copiar a pasta do projeto) e a
// pessoa vê tudo o que o app guardou sem precisar de programa nenhum.
import { buscarPasta, type DocumentoRegistrado } from "./registro";

/** O nome da pasta do app (com o ponto na frente: fica no fim da lista do Explorer). */
export const NOME_PASTA_APP = ".mdoffice";

/** Cria (se preciso) e devolve uma pasta dentro de outra, seguindo um caminho. */
export async function subpasta(
  raiz: FileSystemDirectoryHandle,
  partes: string[],
  criar = true
): Promise<FileSystemDirectoryHandle> {
  let atual = raiz;
  for (const parte of partes) {
    if (!parte) continue;
    atual = await atual.getDirectoryHandle(parte, { create: criar });
  }
  return atual;
}

/** A mesma coisa, mas devolve `null` em vez de erro quando a pasta não existe. */
export async function subpastaSeExistir(
  raiz: FileSystemDirectoryHandle,
  partes: string[]
): Promise<FileSystemDirectoryHandle | null> {
  try {
    return await subpasta(raiz, partes, false);
  } catch {
    return null;
  }
}

/** A pasta do app (`.mdoffice`) na raiz concedida. */
export async function pastaDoApp(raiz: FileSystemDirectoryHandle): Promise<FileSystemDirectoryHandle> {
  return await subpasta(raiz, [NOME_PASTA_APP]);
}

/**
 * A raiz que a pessoa concedeu (onde fica o `.mdoffice`).
 *
 * Normalmente é a pasta registrada do documento. Quando o arquivo foi aberto sozinho (sem
 * a pasta), o Chromium dá a pasta dele pelo `parent` — é o mesmo lugar, só que sem registro.
 */
export async function raizDoDocumento(doc: DocumentoRegistrado): Promise<FileSystemDirectoryHandle> {
  if (doc.pastaId) {
    const pasta = await buscarPasta(doc.pastaId);
    if (pasta) return pasta.handle;
  }
  if (doc.handle.parent) return doc.handle.parent;
  throw new Error("A pasta do documento não está mais disponível.");
}

// ---------- leitura e gravação de arquivos ----------

export async function lerTexto(pasta: FileSystemDirectoryHandle, nome: string): Promise<string | null> {
  try {
    const arquivo = await (await pasta.getFileHandle(nome)).getFile();
    return await arquivo.text();
  } catch {
    return null;
  }
}

export async function lerJson<T>(pasta: FileSystemDirectoryHandle, nome: string): Promise<T | null> {
  const texto = await lerTexto(pasta, nome);
  if (texto === null) return null;
  try {
    return JSON.parse(texto) as T;
  } catch {
    return null;
  }
}

export async function gravarTexto(pasta: FileSystemDirectoryHandle, nome: string, texto: string): Promise<void> {
  const arquivo = await pasta.getFileHandle(nome, { create: true });
  const writable = await arquivo.createWritable();
  await writable.write(texto);
  await writable.close();
}

export async function gravarJson(pasta: FileSystemDirectoryHandle, nome: string, valor: unknown): Promise<void> {
  await gravarTexto(pasta, nome, JSON.stringify(valor, null, 2));
}

export async function lerBytes(pasta: FileSystemDirectoryHandle, nome: string): Promise<Uint8Array | null> {
  try {
    const arquivo = await (await pasta.getFileHandle(nome)).getFile();
    return new Uint8Array(await arquivo.arrayBuffer());
  } catch {
    return null;
  }
}

export async function gravarBytes(pasta: FileSystemDirectoryHandle, nome: string, bytes: Uint8Array): Promise<void> {
  const arquivo = await pasta.getFileHandle(nome, { create: true });
  await escreverNoArquivo(arquivo, bytes);
}

/**
 * Grava bytes num arquivo já aberto.
 *
 * A cópia para um `Uint8Array` novo não é preciosismo: o `write` do File System Access
 * pede `ArrayBuffer`, e o `Uint8Array` que vem de `arrayBuffer()` pode estar apoiado num
 * `SharedArrayBuffer` (o TypeScript recusa, com razão).
 */
export async function escreverNoArquivo(arquivo: FileSystemFileHandle, bytes: Uint8Array): Promise<void> {
  const writable = await arquivo.createWritable();
  const copia = new Uint8Array(bytes.byteLength);
  copia.set(bytes);
  await writable.write(copia);
  await writable.close();
}

export async function existe(pasta: FileSystemDirectoryHandle, nome: string): Promise<boolean> {
  try {
    await pasta.getFileHandle(nome);
    return true;
  } catch {
    return false;
  }
}

/** Os nomes dos arquivos de uma pasta (sem as subpastas). */
export async function nomesDeArquivos(pasta: FileSystemDirectoryHandle): Promise<string[]> {
  const nomes: string[] = [];
  for await (const item of pasta.values()) {
    if (item.kind === "file") nomes.push(item.name);
  }
  return nomes;
}

/** Apaga um arquivo (sem erro se ele já não está lá). */
export async function apagarArquivo(pasta: FileSystemDirectoryHandle, nome: string): Promise<boolean> {
  try {
    await pasta.removeEntry(nome);
    return true;
  } catch {
    return false;
  }
}

/** Dois conteúdos são iguais? (evita gravar uma cópia repetida) */
export function mesmosBytes(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}
