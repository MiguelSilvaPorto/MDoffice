// Imagens no Markdown: inserir, colar e arrastar arquivos.

import type { App } from "./app";
import * as files from "../files";
import { diag } from "../broker/diag";
import { $, toast, baseName, stripExt, isImagePath, isMarkdownPath, blobToBase64 } from "../util";

export const mediaMethods = {
  insertImageMd(this: App, rel: string, alt: string): void {
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
      this.insertImageMd(rel, stripExt(baseName(src)));
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
        this.insertImageMd(rel, "imagem");
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
        const rel = await files.writeAsset(this.path!, name, await blobToBase64(arquivo));
        this.insertImageMd(rel, stripExt(img.nome));
        toast(`Imagem salva em ${rel}`, "ok");
      } catch (err) {
        toast("Falha ao salvar a imagem arrastada: " + err, "err");
      }
    }
  },
};
