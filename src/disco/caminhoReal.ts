// O caminho de verdade (C:\...) das pastas do app, para o texto copiado levar o caminho
// completo de cada imagem.
//
// O navegador nunca revela onde uma pasta está no disco: o File System Access API dá o handle
// e o nome, e o app só conhece `assets/imagem-x.png`. Quem cola o texto num chat de IA (o
// Claude Code, por exemplo) precisa do caminho inteiro para abrir a imagem — sem ele, a IA
// varre o disco atrás do arquivo. Então a pessoa informa UMA vez o caminho de cada pasta
// (copiado da barra de endereço do Explorador de Arquivos) e o app lembra.
import { buscarDocumento, buscarPasta } from "./registro";
import { loadJSON, saveJSON } from "../util";

const CHAVE = "mdc.caminhosReais";

/** A pasta (real) de um documento: a chave do que a pessoa informou e o que vem abaixo dela. */
export interface PastaDoDocumento {
  /** chave do caminho guardado: a pasta concedida, ou o próprio documento aberto sozinho */
  chave: string;
  /** o nome da pasta que a pessoa precisa informar (confere com o fim do caminho colado) */
  nome: string;
  /** as subpastas entre a pasta informada e o documento ("Projeto/notas.md" → ["Projeto"]) */
  subpastas: string[];
}

/** Onde o documento vive, em termos de "pasta informada + subpastas" (null se não estiver registrado). */
export async function pastaDoDocumento(docId: string): Promise<PastaDoDocumento | null> {
  const doc = await buscarDocumento(docId);
  if (!doc) return null;
  if (doc.pastaId) {
    const pasta = await buscarPasta(doc.pastaId);
    if (pasta) return { chave: `pasta:${doc.pastaId}`, nome: pasta.nome, subpastas: doc.relativo.split("/").slice(0, -1).filter(Boolean) };
  }
  // aberto sozinho (sem a pasta concedida): a pessoa informa a pasta onde o arquivo está
  return { chave: `doc:${doc.id}`, nome: "", subpastas: [] };
}

/** O caminho que a pessoa informou para a pasta, ou null. */
export function caminhoInformado(chave: string): string | null {
  return loadJSON<Record<string, string>>(CHAVE, {})[chave] ?? null;
}

export function guardarCaminho(chave: string, caminho: string): void {
  const todos = loadJSON<Record<string, string>>(CHAVE, {});
  todos[chave] = limparCaminho(caminho);
  saveJSON(CHAVE, todos);
}

/** Tira aspas e a barra do fim do que foi colado ("C:\Pasta\" → "C:\Pasta"). */
export function limparCaminho(caminho: string): string {
  return caminho.trim().replace(/^"(.*)"$/, "$1").replace(/[\\/]+$/, "");
}

/**
 * O caminho colado parece o de uma pasta do Windows (C:\…, \\servidor\…) e termina com o nome
 * da pasta? Devolve a mensagem de erro, ou null quando está bom.
 */
export function validarCaminho(caminho: string, nome: string): string | null {
  const c = limparCaminho(caminho);
  if (!/^(?:[a-zA-Z]:[\\/]|\\\\[^\\]+\\|\/)/.test(c)) return "Cole o caminho completo da pasta, como C:\\Users\\voce\\Documentos\\Rascunhos.";
  if (nome) {
    const ultimo = c.split(/[\\/]/).pop() ?? "";
    if (ultimo.toLowerCase() !== nome.toLowerCase()) return `Esse caminho não termina na pasta "${nome}". Abra a pasta "${nome}" no Explorador e copie o endereço dela.`;
  }
  return null;
}

/** A pasta real do documento (C:\…\Projeto), ou null se a pessoa ainda não informou. */
export function pastaRealDe(p: PastaDoDocumento): string | null {
  const base = caminhoInformado(p.chave);
  if (!base) return null;
  return [base, ...p.subpastas].join("\\");
}

/** Um caminho relativo vira absoluto a partir da pasta real (resolve `.` e `..`). */
export function absoluto(pastaReal: string, relativo: string): string {
  const partes = pastaReal.split(/[\\/]/);
  for (const parte of relativo.split(/[\\/]/)) {
    if (!parte || parte === ".") continue;
    if (parte === "..") {
      if (partes.length > 1) partes.pop();
    } else partes.push(parte);
  }
  return partes.join("\\");
}

/** Imagem do Markdown: ![alt](destino "título") — o destino pode vir entre <…>. */
const IMAGEM = /(!\[[^\]\n]*\]\()\s*(<[^>\n]+>|[^)\s]+)((?:\s+"[^"\n]*")?\s*\))/g;

/** O destino é local e relativo? (não é http, data:, âncora nem caminho absoluto) */
function ehRelativo(destino: string): boolean {
  return !/^(?:[a-z][a-z0-9+.-]*:|#|\/|\\)/i.test(destino);
}

/** O texto tem imagem com caminho relativo? */
export function temImagemRelativa(texto: string): boolean {
  for (const m of texto.matchAll(IMAGEM)) if (ehRelativo(m[2].replace(/^<|>$/g, ""))) return true;
  return false;
}

/**
 * O texto com o caminho completo de cada imagem relativa: `![imagem](assets/x.png)` →
 * `![imagem](<C:\Rascunhos\assets\x.png>)`. Os `<…>` deixam o link válido mesmo com espaços.
 */
export function comCaminhosCompletos(texto: string, pastaReal: string): string {
  return texto.replace(IMAGEM, (todo, abre: string, destino: string, fecha: string) => {
    let rel = destino.replace(/^<|>$/g, "");
    if (!ehRelativo(rel)) return todo;
    try {
      rel = decodeURIComponent(rel);
    } catch {
      /* mantém */
    }
    return `${abre}<${absoluto(pastaReal, rel)}>${fecha}`;
  });
}
