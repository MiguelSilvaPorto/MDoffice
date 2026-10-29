// Imagens no Markdown: inserir, colar e arrastar arquivos.

import type { App } from "./app";
import * as files from "../files";
import { pedirTexto } from "../dialogoTexto";
import { comCaminhosCompletos, guardarCaminho, pastaDoDocumento, pastaRealDe, validarCaminho, type PastaDoDocumento } from "../disco/caminhoReal";
import { diag } from "../broker/diag";
import { $, toast, baseName, stripExt, isImagePath, isMarkdownPath, blobToBase64 } from "../util";

/** A pasta do documento aberto, lida do registro na primeira cópia (a cópia em si é síncrona). */
let pastaEmCache: { docId: string; pasta: PastaDoDocumento | null } | null = null;

async function pastaDoAtual(docId: string): Promise<PastaDoDocumento | null> {
  if (pastaEmCache?.docId !== docId) pastaEmCache = { docId, pasta: await pastaDoDocumento(docId) };
  return pastaEmCache.pasta;
}

export const mediaMethods = {
  /** Copiar texto do editor: as imagens relativas ganham o caminho completo (null = pasta ainda desconhecida). */
  textoCopiadoComCaminhos(this: App, texto: string): string | null {
    const docId = this.tab.path;
    if (!docId || pastaEmCache?.docId !== docId || !pastaEmCache.pasta) return null;
    const real = pastaRealDe(pastaEmCache.pasta);
    return real ? comCaminhosCompletos(texto, real) : null;
  },

  /**
   * A cópia saiu com os caminhos relativos: descobre a pasta (perguntando uma vez, se preciso) e
   * regrava a área de transferência com o caminho completo de cada imagem.
   */
  async copiaSemCaminho(this: App, texto: string): Promise<void> {
    const docId = this.tab.path;
    if (!docId) return;
    const pasta = await pastaDoAtual(docId);
    if (!pasta) return;
    let real = pastaRealDe(pasta);
    if (!real) {
      if (!(await this.informarPastaReal(pasta))) return;
      real = pastaRealDe(pasta);
      if (!real) return;
    }
    try {
      await navigator.clipboard.writeText(comCaminhosCompletos(texto, real));
      toast("Copiado com o caminho completo das imagens.", "ok");
    } catch {
      toast("Não consegui regravar a área de transferência: copie de novo.", "info");
    }
  },

  /** Pergunta (uma vez) onde a pasta do documento está no computador. */
  async informarPastaReal(this: App, pasta?: PastaDoDocumento | null): Promise<boolean> {
    const docId = this.tab.path;
    if (!pasta && docId) pasta = await pastaDoAtual(docId);
    if (!pasta) {
      toast("Este documento ainda não está numa pasta.", "info");
      return false;
    }
    const nome = pasta.nome;
    const caminho = await pedirTexto({
      titulo: "Onde fica esta pasta?",
      rotulo: nome ? `Caminho da pasta "${nome}"` : "Caminho da pasta onde está este documento",
      dica: "O navegador não informa ao app onde as pastas estão. Abra a pasta no Explorador de Arquivos, clique na barra de endereço, copie e cole aqui — é só uma vez. Daí em diante, copiar texto com imagens leva o caminho completo de cada uma.",
      valor: pastaRealDe({ ...pasta, subpastas: [] }) ?? "",
      ok: "Guardar",
      validar: (v) => validarCaminho(v, nome),
    });
    if (caminho === null) return false;
    guardarCaminho(pasta.chave, caminho);
    return true;
  },

  /**
   * Insere a referência da imagem no Markdown e já entrega os bytes ao preview.
   *
   * `dataUrl` é a imagem que acabou de ser gravada (colar/arrastar): o preview mostra na
   * hora, sem depender da leitura de volta do disco. Sem ele (imagem escolhida pelo botão),
   * o preview lê o arquivo como sempre.
   */
  insertImageMd(this: App, rel: string, alt: string, dataUrl?: string): void {
    if (dataUrl) this.preview.seedAsset(rel, dataUrl);
    const { from } = this.editor.selectionPos();
    this.editor.insertAt(from, `![${alt}](${rel})\n`);
    this.updatePreview();
  },

  async insertImageFromDialog(this: App): Promise<void> {
    if (this.semDocumento()) return;
    const src = await files.pickImageFile();
    if (!src) return;
    if (!(await this.ensureSaved())) return;
    try {
      const rel = await files.copyAsset(this.path!, src);
      // os mesmos bytes que acabaram de ser copiados vão para o preview (sem reler o disco)
      let dataUrl: string | undefined;
      try {
        dataUrl = await files.readDataUrl(src);
      } catch {
        /* sem a leitura otimista: o preview lê o arquivo copiado */
      }
      this.insertImageMd(rel, stripExt(baseName(src)), dataUrl);
      toast(`Imagem salva em ${rel}`, "ok");
    } catch (e) {
      toast("Falha ao copiar a imagem: " + e, "err");
    }
  },

  async onPaste(this: App, e: ClipboardEvent): Promise<void> {
    const dt = e.clipboardData;
    if (!dt) return;
    // O WebView2 não entrega a imagem do mesmo jeito que o Chrome: às vezes vem em
    // `files`, às vezes só em `items` (kind "file"), às vezes só pela área de
    // transferência rica. Olhamos os três e registramos o que veio no diagnóstico.
    const tipos = Array.from(dt.types ?? []);
    const arquivos = Array.from(dt.files ?? []);
    const itens = Array.from(dt.items ?? []);
    const imgs: File[] = arquivos.filter((f) => f.type.startsWith("image/"));
    if (!imgs.length) {
      for (const item of itens) {
        if (item.kind !== "file" || !item.type.startsWith("image/")) continue;
        const f = item.getAsFile();
        if (f) imgs.push(f);
      }
    }
    // "Files" nos tipos (ou um image/*) = a área de transferência TEM imagem, mesmo que
    // o evento não a traga: aí vale impedir o colar padrão e buscar pelo clipboard.read.
    const pareceImagem = tipos.includes("Files") || tipos.some((t) => t.startsWith("image/"));
    if (!imgs.length && !pareceImagem) return; // texto normal: o colar padrão segue
    e.preventDefault();
    diag({
      gatilho: "app",
      regra: "colar imagem",
      veredito: imgs.length ? "detectado" : "ignorado",
      motivo: `tipos=[${tipos.join(", ")}] · arquivos=[${arquivos.map((f) => f.type).join(", ")}] · itens=[${itens.map((i) => `${i.kind}:${i.type}`).join(", ")}] · documento=${this.path ? "salvo" : "rascunho"}`,
    });
    if (!imgs.length && pareceImagem) {
      try {
        const lidos = await navigator.clipboard.read();
        for (const item of lidos) {
          const tipo = item.types.find((t) => t.startsWith("image/"));
          if (!tipo) continue;
          const ext = (tipo.split("/")[1] || "png").replace("jpeg", "jpg");
          const blob = await item.getType(tipo);
          imgs.push(new File([blob], `imagem-${Date.now().toString(36)}.${ext}`, { type: tipo }));
        }
        diag({ gatilho: "app", regra: "colar imagem", veredito: imgs.length ? "detectado" : "ignorado", motivo: `clipboard.read devolveu ${imgs.length} imagem(ns)` });
      } catch (err) {
        diag({ gatilho: "app", regra: "colar imagem", veredito: "ignorado", motivo: `clipboard.read indisponível: ${String(err)}` });
      }
    }
    if (!imgs.length) return;
    if (!(await this.ensureSaved())) return;

    for (const f of imgs) {
      const ext = (f.type.split("/")[1] || "png").replace("jpeg", "jpg");
      const name = `imagem-${Date.now().toString(36)}.${ext}`;
      try {
        const b64 = await blobToBase64(f);
        const rel = await files.writeAsset(this.path!, name, b64);
        // o preview recebe exatamente os bytes gravados: aparece na hora, mesmo que a
        // leitura de volta do disco ainda não esteja disponível
        this.insertImageMd(rel, "imagem", `data:${f.type || "image/png"};base64,${b64}`);
        toast(`Imagem colada e salva em ${rel}`, "ok");
      } catch (err) {
        toast("Falha ao salvar a imagem colada: " + err, "err");
      }
    }
  },

  /**
   * Arrastar e soltar arquivos na janela.
   *
   * O Chromium entrega um **handle** de verdade no `drop` (`getAsFileSystemHandle`): o
   * documento abre para leitura e gravação, como no "Abrir…". Sem o handle (navegador sem a
   * API), o documento não pode ser aberto — mas a imagem ainda pode ser copiada para assets/.
   */
  async setupDragDrop(this: App): Promise<void> {
    const temArquivos = (e: DragEvent): boolean => Array.from(e.dataTransfer?.types ?? []).includes("Files");
    document.addEventListener("dragover", (e) => {
      if (!temArquivos(e)) return;
      e.preventDefault();
      if (e.dataTransfer) e.dataTransfer.dropEffect = "copy";
    });
    document.addEventListener("drop", (e) => {
      if (!temArquivos(e)) return;
      e.preventDefault();
      void this.handleDrop(e);
    });
  },

  async handleDrop(this: App, e: DragEvent): Promise<void> {
    const dt = e.dataTransfer;
    if (!dt) return;
    const itens = Array.from(dt.items ?? []);
    const soltos: { nome: string; handle: FileSystemFileHandle | null; file: File | null }[] = [];
    for (const item of itens) {
      if (item.kind !== "file") continue;
      const file = item.getAsFile();
      const handle = await item.getAsFileSystemHandle?.().catch(() => null);
      const arquivoHandle = handle && handle.kind === "file" ? (handle as FileSystemFileHandle) : null;
      soltos.push({ nome: file?.name ?? "", handle: arquivoHandle, file });
    }
    if (!soltos.length) return;

    const documentos = soltos.filter(
      (a) => isMarkdownPath(a.nome) || /\.(docx|pptx|xlsx|xlsm)$/i.test(a.nome)
    );
    for (const doc of documentos) {
      if (!doc.handle) {
        toast(`O navegador não deu acesso a "${doc.nome}" — use Abrir arquivo (Ctrl+O).`, "info", 6500);
        continue;
      }
      const id = await files.adotarArquivo(doc.handle);
      await this.openPath(id);
    }

    const imagens = soltos.filter((a) => isImagePath(a.nome));
    if (!imagens.length) return;
    if (!(await this.ensureSaved())) return;
    for (const img of imagens) {
      try {
        const arquivo = img.handle ? await img.handle.getFile() : img.file;
        if (!arquivo) continue;
        const ext = (arquivo.type.split("/")[1] || "png").replace("jpeg", "jpg");
        const name = `imagem-${Date.now().toString(36)}.${ext}`;
        const b64 = await blobToBase64(arquivo);
        const rel = await files.writeAsset(this.path!, name, b64);
        this.insertImageMd(rel, stripExt(img.nome), `data:${arquivo.type || "image/png"};base64,${b64}`);
        toast(`Imagem salva em ${rel}`, "ok");
      } catch (err) {
        toast("Falha ao salvar a imagem arrastada: " + err, "err");
      }
    }
  },
};
