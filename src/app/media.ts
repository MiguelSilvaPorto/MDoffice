// Imagens no Markdown: inserir, colar e arrastar arquivos.

import type { App } from "./app";
import * as files from "../files";
import { getCurrentWebview } from "@tauri-apps/api/webview";
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
    const imgs = Array.from(dt.files || []).filter((f) => f.type.startsWith("image/"));
    if (!imgs.length) return;
    e.preventDefault();
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

  async setupDragDrop(this: App): Promise<void> {
    try {
      await getCurrentWebview().onDragDropEvent(async (event) => {
        if (event.payload.type !== "drop") return;
        await this.handleDropped(event.payload.paths as string[]);
      });
    } catch (e) {
      console.warn("Drag & drop indisponível:", e);
    }
  },

  async handleDropped(this: App, paths: string[]): Promise<void> {
    const mdPath = paths.find(
      (p) => isMarkdownPath(p) || /\.docx$/i.test(p) || /\.pptx$/i.test(p) || /\.xlsx$/i.test(p) || /\.xlsm$/i.test(p)
    );
    const images = paths.filter(isImagePath);
    if (mdPath) await this.openPath(mdPath);
    if (!images.length) return;
    if (!(await this.ensureSaved())) return;
    for (const p of images) {
      try {
        const rel = await files.copyAsset(this.path!, p);
        this.insertImageMd(rel, stripExt(baseName(p)));
        toast(`Imagem salva em ${rel}`, "ok");
      } catch (err) {
        toast("Falha ao copiar a imagem: " + err, "err");
      }
    }
  },
};
