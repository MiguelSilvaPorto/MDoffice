// Executa a exportação escolhida (traduz, gera o arquivo e salva).

import { ask } from "@tauri-apps/plugin-dialog";
import * as files from "../files";
import { type TranslatedDoc } from "../translate/controller";
import { buildDocx } from "../md/docx";
import { bytesToBase64, docDirOf, joinPath, toast } from "../util";
import { type ExportPrefs, type ExportCtx } from "./types";
import { FORMATS } from "./formats";
import { htmlDocument, buildBody, printHtml } from "./render";
import { markdownToText } from "./text";

export async function suggestedPath(ctx: ExportCtx, name: string): Promise<string> {
  const p = ctx.docPath();
  if (p) return joinPath(docDirOf(p), name);
  try {
    return joinPath(await files.defaultDocsDir(), name);
  } catch {
    return name;
  }
}

/** Devolve o caminho irmão com outro sufixo (…-pt.md → …-en.md). */
export function sibling(path: string, from: string, to: string): string {
  return path.replace(new RegExp(`${from}(\\.[^.\\\\/]+)$`), `${to}$1`);
}

export async function runExport(ctx: ExportCtx, prefs: ExportPrefs, say: (t: string) => void): Promise<boolean> {
  const md = ctx.getMarkdown();
  if (!md.trim()) {
    toast("Documento vazio — nada para exportar.", "info");
    return false;
  }
  const fmt = FORMATS.find((f) => f.id === prefs.format)!;
  const name = ctx.docName();
  const wantsEn = prefs.lang !== "pt";

  let doc: TranslatedDoc | null = null;
  if (wantsEn) {
    say("Traduzindo para o inglês…");
    doc = await ctx.translation.translateDocument(md, (d, t) => say(t ? `Traduzindo para o inglês… ${d}/${t}` : "Traduzindo…"));
    if (doc.incomplete) {
      const proceed = await ask(
        "Alguns trechos não puderam ser traduzidos (limite do tradutor ou falta de conexão). Exportar assim mesmo, deixando esses trechos em português?",
        { title: "mdOffice", kind: "warning", okLabel: "Exportar assim", cancelLabel: "Cancelar" }
      );
      if (!proceed) return false;
    }
  }
  const enMd = doc?.markdown ?? "";
  const separate = prefs.format === "md" || prefs.format === "txt" || prefs.format === "zip";

  // ----- copiar -----
  if (prefs.format === "copy") {
    say("Preparando a cópia…");
    const html = await buildBody(ctx, prefs, md, doc, false);
    const styled = html
      .replace(/<table/g, '<table style="border-collapse:collapse"')
      .replace(/<(th|td)(\s|>)/g, '<$1 style="border:1px solid #bbb;padding:4px 8px"$2');
    const plain = prefs.lang === "en" ? markdownToText(enMd) : markdownToText(md);
    if (typeof ClipboardItem !== "undefined" && navigator.clipboard?.write) {
      await navigator.clipboard.write([
        new ClipboardItem({ "text/html": new Blob([styled], { type: "text/html" }), "text/plain": new Blob([plain], { type: "text/plain" }) }),
      ]);
    } else {
      await navigator.clipboard.writeText(plain);
    }
    toast("Copiado com formatação. Cole no Word, Docs ou e-mail.", "ok", 3600);
    return true;
  }

  // ----- PDF de documento Word: imprime a própria folha -----
  if (prefs.format === "pdf" && ctx.printNative && prefs.lang === "pt") {
    ctx.printNative();
    toast("Na janela de impressão, escolha “Salvar como PDF” como impressora.", "info", 6500);
    return true;
  }

  // ----- PDF (impressão) -----
  if (prefs.format === "pdf") {
    say("Montando o documento…");
    const body = await buildBody(ctx, prefs, md, doc, prefs.toc);
    const html = htmlDocument({ title: name, lang: prefs.lang === "en" ? "en" : "pt-BR", body, css: ctx.mdCss, theme: prefs.theme, size: prefs.size, print: true });
    await printHtml(html);
    toast("Na janela de impressão, escolha “Salvar como PDF” como impressora.", "info", 6500);
    return true;
  }

  // ----- arquivos -----
  const baseSuffix = prefs.lang === "both" && separate ? "-pt" : prefs.lang === "en" ? "-en" : prefs.lang === "both" ? "-pt-en" : "";
  const target = await files.pickSaveAny(await suggestedPath(ctx, `${name}${baseSuffix}.${fmt.ext}`), fmt.label, [fmt.ext]);
  if (!target) return false;

  const written: string[] = [];
  const writeText = async (path: string, content: string) => {
    await files.saveDoc(path, content);
    written.push(path);
  };

  switch (prefs.format) {
    case "md":
      if (prefs.lang === "both") {
        await writeText(target, md);
        await writeText(sibling(target, "-pt", "-en"), enMd);
      } else await writeText(target, prefs.lang === "en" ? enMd : md);
      break;
    case "txt":
      if (prefs.lang === "both") {
        await writeText(target, markdownToText(md));
        await writeText(sibling(target, "-pt", "-en"), markdownToText(enMd));
      } else await writeText(target, markdownToText(prefs.lang === "en" ? enMd : md));
      break;
    case "html": {
      say("Montando a página…");
      const body = await buildBody(ctx, prefs, md, doc, prefs.toc);
      await writeText(
        target,
        htmlDocument({ title: name, lang: prefs.lang === "en" ? "en" : "pt-BR", body, css: ctx.mdCss, theme: prefs.theme, size: prefs.size, print: false })
      );
      break;
    }
    case "docx": {
      say("Gerando o documento do Word…");
      const bytes =
        ctx.nativeDocx && prefs.lang === "pt"
          ? await ctx.nativeDocx()
          : ctx.docxFromMarkdown && prefs.lang === "en"
            ? await ctx.docxFromMarkdown(enMd)
            : await buildDocx({
                markdown: prefs.lang === "en" ? enMd : md,
                bilingual: prefs.lang === "both" && doc ? ctx.translation.blocks(doc) : undefined,
                title: name,
                docPath: ctx.docPath(),
                pageSize: prefs.size,
              });
      await files.saveBinary(target, bytesToBase64(bytes));
      written.push(target);
      break;
    }
    case "zip": {
      if (!(await ctx.ensureFile())) return false;
      const docPath = ctx.docPath();
      if (!docPath) return false;
      say("Criando o pacote…");
      const count = await files.exportPortableBundle(docPath, prefs.lang === "en" ? enMd : md, target);
      written.push(target);
      if (prefs.lang === "both") {
        await files.exportPortableBundle(docPath, enMd, sibling(target, "-pt", "-en"));
        written.push(sibling(target, "-pt", "-en"));
      }
      toast(`Pacote criado com o Markdown e ${count} imagem(ns) local(is).`, "ok", 5200);
      break;
    }
    default:
      break;
  }
  toast(written.length > 1 ? `${written.length} arquivos exportados.` : `Exportado: ${written[0].split(/[\\/]/).pop()}`, "ok", 4200);
  if (written[0]) ctx.reveal(written[0]);
  return true;
}

/** Corpo HTML do documento (um idioma ou os dois lado a lado). */
