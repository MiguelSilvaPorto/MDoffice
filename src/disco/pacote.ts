// O "Pacote IA" (.zip): Markdown + imagens locais + desenhos editáveis + instruções.
//
// É o antigo `export_portable_bundle` do Rust, agora em TypeScript sobre os handles da pasta
// concedida. O pacote leva o documento, cada imagem **local** referenciada nele (as URLs e os
// data: ficam de fora), o JSON dos desenhos (`<imagem>.draw.json`, para continuar editável
// depois de descompactar) e uma folha de orientação para a IA.
import JSZip from "jszip";
import { buscarDocumento } from "./registro";
import { gravarBytes, pastaBase } from "./arquivo";
import { subpasta } from "./pastaApp";
import { bytesToBase64 } from "../util";

/** Extrai os destinos das imagens Markdown (sem interpretar nem executar HTML). */
export function imagensDoMarkdown(markdown: string): string[] {
  const alvos: string[] = [];
  let cursor = 0;
  while (true) {
    const inicio = markdown.indexOf("![", cursor);
    if (inicio < 0) break;
    const fimRotulo = markdown.indexOf("](", inicio + 2);
    if (fimRotulo < 0) {
      cursor = inicio + 2;
      continue;
    }
    const inicioDestino = fimRotulo + 2;
    const fimDestino = markdown.indexOf(")", inicioDestino);
    if (fimDestino < 0) {
      cursor = inicioDestino;
      continue;
    }
    const bruto = markdown.slice(inicioDestino, fimDestino).trim();
    // o destino pode vir entre <> (para aceitar espaços) — e aí o espaço NÃO separa o título
    let alvo: string;
    if (bruto.startsWith("<")) {
      const fim = bruto.indexOf(">");
      alvo = fim > 0 ? bruto.slice(1, fim) : "";
    } else {
      alvo = bruto.split(/\s+/)[0] ?? "";
    }
    if (alvo && !alvos.includes(alvo)) alvos.push(alvo);
    cursor = fimDestino + 1;
  }
  return alvos;
}

/**
 * Cria o pacote e devolve quantas imagens locais entraram.
 *
 * `outputPath` é o id do arquivo .zip escolhido no "Salvar como…" (já registrado).
 */
export async function exportar(docPath: string, content: string, outputPath: string): Promise<number> {
  const doc = await buscarDocumento(docPath);
  if (!doc) throw new Error("Salve o Markdown em uma pasta antes de exportar o pacote.");
  const pasta = await pastaBase(doc);

  const zip = new JSZip();
  zip.file(doc.nome, content);

  let imagens = 0;
  let sidecars = 0;
  for (const alvo of imagensDoMarkdown(content)) {
    // data URLs já estão dentro do Markdown; imagens da web continuam acessíveis pela rede
    if (/^(data:|https?:\/\/)/i.test(alvo)) continue;
    if (alvo.startsWith("/") || alvo.split(/[\\/]/).includes("..")) {
      throw new Error(`A imagem "${alvo}" está fora da pasta do documento. Mova-a para assets/ antes de exportar.`);
    }
    const partes = alvo.split(/[\\/]/).filter(Boolean);
    const nome = partes.pop()!;
    let dir: FileSystemDirectoryHandle;
    try {
      dir = await subpasta(pasta, partes, false);
    } catch {
      throw new Error(`A imagem "${alvo}" não foi encontrada. O pacote não foi finalizado.`);
    }
    let bytes: Uint8Array;
    try {
      bytes = new Uint8Array(await (await (await dir.getFileHandle(nome)).getFile()).arrayBuffer());
    } catch {
      throw new Error(`A imagem "${alvo}" não foi encontrada. O pacote não foi finalizado.`);
    }
    zip.file(alvo.replace(/\\/g, "/"), bytes);
    imagens++;

    // o sidecar preserva a possibilidade de editar desenhos após descompactar
    try {
      const sidecar = new Uint8Array(await (await (await dir.getFileHandle(`${nome}.draw.json`)).getFile()).arrayBuffer());
      zip.file(`${alvo}.draw.json`, sidecar);
      sidecars++;
    } catch {
      /* não é um desenho (ou o sidecar não existe): segue sem ele */
    }
  }

  const instrucoes =
    `# Instruções para a IA\n\n` +
    `Este pacote contém o documento \`${doc.nome}\` e ${imagens} imagem(ns) local(is) referenciada(s) por ele. ` +
    `Os desenhos editáveis também incluem ${sidecars} arquivo(s) JSON auxiliar(es). ` +
    `Imagens externas (URLs HTTP/HTTPS) não são copiadas; elas precisam de internet.\n\n` +
    `## O que quero que você faça?\nDescreva a tarefa de forma direta.\n\n` +
    `## Como quero o resultado?\n- Formato da resposta:\n- Tom e nível de detalhe:\n- Estrutura desejada:\n\n` +
    `## Contexto e critérios\n- O que é importante manter:\n- Restrições ou exemplos:\n\n` +
    `Abra o Markdown e considere as imagens incluídas no diretório \`assets/\` como referências visuais.\n`;
  zip.file("INSTRUCOES_PARA_IA.md", instrucoes);

  const bytes = await zip.generateAsync({ type: "uint8array" });
  await gravarBytes(outputPath, bytesToBase64(bytes));
  return imagens;
}
