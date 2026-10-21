// A árvore de documentos e a busca — no navegador.
//
// No app nativo a árvore vem do Rust (que varre a pasta do projeto). No navegador a varredura
// é a mesma, mas sobre os **handles** da pasta que a pessoa concedeu: cada arquivo encontrado
// é registrado (o registro é o que dá o id, a identidade do documento).
//
// A diferença de fundo: no app nativo o `path` é o caminho absoluto e aqui é o **id** do
// registro — a ponte `src/ponte` traduz um no outro e o app não percebe.

import { buscarPasta, registrarDocumento } from "./registro";
import { handleDe } from "./arquivo";

/** Um nó da árvore (o que o app já esperava do Rust). */
export interface MdNode {
  name: string;
  path: string;
  directory: boolean;
  children: MdNode[];
}

/** As extensões que o app trata como documento. */
const EXTENSOES = [".md", ".markdown", ".mdx", ".docx", ".xlsx", ".xlsm", ".pptx"];

/** Pastas que nunca entram na árvore (node_modules, a pasta de backup do app…). */
const IGNORADAS = new Set(["node_modules", "target", "dist", "assets", "build", ".git", ".mdoffice"]);

const ehDocumento = (nome: string): boolean => {
  const baixo = nome.toLowerCase();
  return EXTENSOES.some((e) => baixo.endsWith(e));
};

/** Registra um arquivo e devolve o id dele (o `path` do app). */
async function registrar(handle: FileSystemFileHandle, pastaId: string, subpasta: string): Promise<string> {
  // o relativo é SEMPRE dentro da pasta concedida (a pasta não entra nele)
  const relativo = subpasta ? `${subpasta}/${handle.name}` : handle.name;
  const doc = await registrarDocumento(handle, pastaId, relativo);
  return doc.id;
}

/** A árvore de uma pasta (até 4 níveis, com as pastas vazias inclusas). */
export async function listarMarkdown(pastaId: string): Promise<MdNode[]> {
  const pasta = await buscarPasta(pastaId);
  if (!pasta) return [];
  const orcamento = { restantes: 400 };
  return await varrer(pasta.handle, 4, orcamento, pastaId, "");
}

async function varrer(
  handle: FileSystemDirectoryHandle,
  profundidade: number,
  orcamento: { restantes: number },
  pastaId: string,
  subpasta: string,
): Promise<MdNode[]> {
  const pastas: MdNode[] = [];
  const docs: MdNode[] = [];
  for await (const item of handle.values()) {
    if (orcamento.restantes <= 0) break;
    if (item.name.startsWith(".")) continue;
    if (item.kind === "directory") {
      if (profundidade <= 0 || IGNORADAS.has(item.name)) continue;
      const sub = item as FileSystemDirectoryHandle;
      const filhos = await varrer(sub, profundidade - 1, orcamento, pastaId, subpasta ? `${subpasta}/${item.name}` : item.name);
      // pasta VAZIA também entra na árvore: é onde a pessoa cria uma pasta nova
      pastas.push({ name: item.name, path: item.name, directory: true, children: filhos });
    } else if (item.kind === "file" && ehDocumento(item.name)) {
      orcamento.restantes--;
      const arquivo = item as FileSystemFileHandle;
      const id = await registrar(arquivo, pastaId, subpasta);
      docs.push({ name: item.name, path: id, directory: false, children: [] });
    }
  }
  return [...pastas, ...docs];
}

// ---------- a busca ----------

export interface ContentHit {
  path: string;
  name: string;
  line: number;
  text: string;
  start: number;
  end: number;
}

/** Minúscula e sem acento, caractere a caractere (os índices continuam alinhados). */
function dobrar(c: string): string {
  const l = c.toLowerCase();
  switch (l) {
    case "á":
    case "à":
    case "â":
    case "ã":
    case "ä":
      return "a";
    case "é":
    case "è":
    case "ê":
    case "ë":
      return "e";
    case "í":
    case "ì":
    case "î":
    case "ï":
      return "i";
    case "ó":
    case "ò":
    case "ô":
    case "õ":
    case "ö":
      return "o";
    case "ú":
    case "ù":
    case "û":
    case "ü":
      return "u";
    case "ç":
      return "c";
    case "ñ":
      return "n";
    default:
      return l;
  }
}

/** Procura um texto dentro dos documentos Markdown das pastas concedidas. */
export async function buscarMarkdown(raizIds: string[], consulta: string, limite = 150): Promise<ContentHit[]> {
  const agulha = [...consulta.trim()].map(dobrar);
  if (agulha.length < 2) return [];
  const teto = Math.max(1, Math.min(300, limite));
  const achados: ContentHit[] = [];
  for (const raizId of raizIds) {
    const handle = await handleDe(raizId);
    if (!handle) continue;
    const arquivos = await coletarMarkdown(handle, 6);
    for (const arquivo of arquivos) {
      if (achados.length >= teto) return achados;
      let texto = "";
      try {
        texto = await (await arquivo.handle.getFile()).text();
      } catch {
        continue;
      }
      const nome = arquivo.handle.name;
      let porArquivo = 0;
      const linhas = texto.split("\n");
      for (let i = 0; i < linhas.length; i++) {
        const chars = [...linhas[i]];
        const dobrado = chars.map(dobrar);
        const pos = dobrado.join("").indexOf(agulha.join(""));
        if (pos < 0) continue;
        // recorte de até ~140 caracteres em volta do achado
        const inicio = Math.max(0, pos - 50);
        const fim = Math.min(chars.length, pos + agulha.length + 90);
        achados.push({
          path: arquivo.id,
          name: nome,
          line: i + 1,
          text: chars.slice(inicio, fim).join(""),
          start: pos - inicio,
          end: pos - inicio + agulha.length,
        });
        if (++porArquivo >= 5) break;
      }
    }
  }
  return achados;
}

interface ArquivoColetado {
  handle: FileSystemFileHandle;
  id: string;
}

async function coletarMarkdown(handle: FileSystemDirectoryHandle, profundidade: number): Promise<ArquivoColetado[]> {
  const saida: ArquivoColetado[] = [];
  if (saida.length >= 2000) return saida;
  for await (const item of handle.values()) {
    if (saida.length >= 2000) return saida;
    if (item.name.startsWith(".")) continue;
    if (item.kind === "directory") {
      if (profundidade > 0 && !IGNORADAS.has(item.name)) {
        saida.push(...(await coletarMarkdown(item as FileSystemDirectoryHandle, profundidade - 1)));
      }
    } else if (item.kind === "file") {
      const baixo = item.name.toLowerCase();
      if (baixo.endsWith(".md") || baixo.endsWith(".markdown") || baixo.endsWith(".mdx")) {
        const arquivo = item as FileSystemFileHandle;
        const pasta = await handleDeDaPasta(handle);
        saida.push({ handle: arquivo, id: await registrar(arquivo, pasta, "") });
      }
    }
  }
  return saida;
}

/** A pasta de registro de um handle (o id dela serve para o caminho relativo). */
async function handleDeDaPasta(handle: FileSystemDirectoryHandle): Promise<string> {
  const pasta = await buscarPastaPorHandle(handle);
  return pasta?.id ?? "";
}

async function buscarPastaPorHandle(handle: FileSystemDirectoryHandle): Promise<{ id: string } | null> {
  // as pastas concedidas são poucas: comparar os handles é mais barato que um índice
  const { listarPastas } = await import("./registro");
  const pastas = await listarPastas();
  return pastas.find((p) => p.handle === handle) ?? null;
}
