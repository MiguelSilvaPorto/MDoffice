// A lixeira no navegador: `.mdoffice/lixeira/` DENTRO da pasta escolhida.
//
// "Mover para a lixeira" tira o arquivo da pasta do projeto e o guarda ali mesmo, com um
// índice (`index.json`) que anota o caminho original. Ele fica por 30 dias — dá para
// recuperar pela própria pasta, sem abrir o app — e depois é apagado de vez na limpeza,
// que roda na abertura e a cada arquivo movido.
//
// É o mesmo desenho do `commands/trash.rs` do app nativo; o que muda é o lugar: em vez da
// pasta de dados do Windows, a lixeira vive ao lado dos documentos.
import { apagarDocumento, buscarDocumento, listarPastas } from "./registro";
import { caminhoDeExibicao, pastaBase } from "./arquivo";
import {
  apagarArquivo,
  existe,
  gravarBytes,
  gravarJson,
  lerJson,
  nomesDeArquivos,
  pastaDoApp,
  raizDoDocumento,
  subpasta,
  subpastaSeExistir,
} from "./pastaApp";

/** Dias que um arquivo fica guardado antes de ser apagado de vez. */
const RETENCAO_DIAS = 30;
/** Nome da pasta da lixeira (dentro do `.mdoffice`). */
const PASTA = "lixeira";
/** Nome do índice dentro da pasta. */
const INDICE = "index.json";

/** Um item guardado na lixeira. */
export interface ItemDaLixeira {
  /** nome do arquivo dentro da lixeira (ganha `-1`, `-2`… se já houver um igual) */
  name: string;
  /** caminho original do arquivo (é por ele que se sabe de onde veio) */
  original: string;
  /** quando foi movido, em ms desde 1970 */
  moved_at: number;
  /** caminho do arquivo dentro da lixeira (para achar no Explorer) */
  trash_path: string;
}

async function pastaDaLixeira(raiz: FileSystemDirectoryHandle): Promise<FileSystemDirectoryHandle> {
  const app = await pastaDoApp(raiz);
  return await subpasta(app, [PASTA]);
}

/** Nome livre dentro da lixeira, preservando o nome original (`notas.md`, `notas-1.md`…). */
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

/**
 * Move um documento para a lixeira.
 *
 * O arquivo é lido UMA vez: os mesmos bytes viram a cópia da lixeira e a remoção do
 * original. Se a remoção falhar, a cópia já está guardada (o pior caso é o arquivo
 * aparecer nos dois lugares, nunca sumir sem cópia).
 */
export async function mover(path: string): Promise<ItemDaLixeira> {
  const doc = await buscarDocumento(path);
  if (!doc) throw new Error("O documento não está mais disponível.");
  const raiz = await raizDoDocumento(doc);
  const pasta = await pastaDaLixeira(raiz);
  const original = await caminhoDeExibicao(doc.id);
  const bytes = new Uint8Array(await (await doc.handle.getFile()).arrayBuffer());
  const nome = await nomeLivre(pasta, doc.nome);
  await gravarBytes(pasta, nome, bytes);
  const item: ItemDaLixeira = {
    name: nome,
    original,
    moved_at: Date.now(),
    trash_path: `${raiz.name}/.mdoffice/${PASTA}/${nome}`,
  };
  const itens = (await lerJson<ItemDaLixeira[]>(pasta, INDICE)) ?? [];
  itens.push(item);
  await gravarJson(pasta, INDICE, itens);

  // tira o arquivo da pasta do projeto (e do registro: o id deixa de existir)
  try {
    const pai = await pastaBase(doc);
    await pai.removeEntry(doc.nome);
  } catch {
    try {
      if (doc.handle.parent) await doc.handle.parent.removeEntry(doc.nome);
    } catch {
      /* o arquivo já saiu: a cópia na lixeira basta */
    }
  }
  await apagarDocumento(doc.id);
  return item;
}

/** Apaga o que passou dos 30 dias e esquece itens que sumiram da pasta. */
export async function limpar(): Promise<number> {
  const corte = Date.now() - RETENCAO_DIAS * 24 * 60 * 60 * 1000;
  let apagados = 0;
  for (const concedida of await listarPastas()) {
    const app = await subpastaSeExistir(concedida.handle, [".mdoffice"]);
    if (!app) continue;
    const pasta = await subpastaSeExistir(app, [PASTA]);
    if (!pasta) continue;
    const itens = (await lerJson<ItemDaLixeira[]>(pasta, INDICE)) ?? [];
    const manter: ItemDaLixeira[] = [];
    for (const item of itens) {
      if (!(await existe(pasta, item.name))) continue; // recuperado por fora: sai do índice
      if (item.moved_at > 0 && item.moved_at < corte) {
        if (await apagarArquivo(pasta, item.name)) apagados++;
        continue;
      }
      manter.push(item);
    }
    await gravarJson(pasta, INDICE, manter);
  }
  return apagados;
}

/**
 * Os caminhos originais guardados na lixeira (em minúsculas).
 *
 * O aviso de "arquivo sumiu" do backup usa esta lista para não reclamar de um documento que
 * saiu da pasta **de propósito**.
 */
export async function originaisNaLixeira(): Promise<Set<string>> {
  const fora = new Set<string>();
  for (const concedida of await listarPastas()) {
    const app = await subpastaSeExistir(concedida.handle, [".mdoffice"]);
    if (!app) continue;
    const pasta = await subpastaSeExistir(app, [PASTA]);
    if (!pasta) continue;
    for (const item of (await lerJson<ItemDaLixeira[]>(pasta, INDICE)) ?? []) {
      if (item.original) fora.add(item.original.toLowerCase());
    }
  }
  return fora;
}
