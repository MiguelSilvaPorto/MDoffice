// Entrada da exportação: deck -> bytes de .pptx.
// O PptxGenJS é importado DINAMICAMENTE (só na hora de exportar) para não pesar
// no arranque do app — o bundle dele tem ~366 KB. Testado no Chromium/WebView (T5).

import type { Deck, DeckSetup, Slide } from "../schema";
import { ehRica } from "../render/forma";
import { comNomeDaCld, comOcultaNoSld, comOcultasNoSldId, escreverLamina, marcarLamina } from "./slides";
import { Escritor } from "./rica";
import { escreverNotas } from "./notes";
import { aplicarTema, fonteTema } from "./theme";

/** Gera os bytes do arquivo .pptx a partir do deck. */
export async function deckToPptx(deck: Deck, setup: DeckSetup, titulo = "Apresentação"): Promise<Uint8Array> {
  const { default: PptxGenJS } = await import("pptxgenjs");

  // nova instância a cada exportação: o PptxGenJS reutiliza lâminas se reaproveitado
  const pptx = new PptxGenJS() as unknown as {
    author: string;
    title: string;
    subject: string;
    defineLayout: (o: { name: string; width: number; height: number }) => void;
    layout: string;
    addSlide: () => unknown;
    write: (o: { outputType: "arraybuffer" }) => Promise<ArrayBuffer>;
  };

  pptx.author = "mdCreator";
  pptx.title = titulo;
  pptx.subject = "Apresentação criada no mdCreator";
  aplicarTema(pptx, setup);

  const slides: Slide[] = deck.slides.length ? deck.slides : [{ md: "", layout: "conteudo", notes: "", shapes: [] }];
  // lâminas vindas de um .pptx (formas ricas, fundo próprio) são escritas pelo Escritor, que mantém tudo fiel;
  // o PptxGenJS só cria o esqueleto delas (layout, notas) e o conteúdo é trocado depois
  const ricas: number[] = [];
  slides.forEach((s, i) => {
    const slide = pptx.addSlide() as Parameters<typeof escreverLamina>[0] & Parameters<typeof escreverNotas>[0];
    // oculta (show="0") e nome da lâmina valem para os dois caminhos (PptxGenJS e Escritor)
    marcarLamina(slide, s);
    if (s.bg || s.shapes.some(ehRica)) {
      ricas.push(i);
    } else {
      // fonte padrão do deck nas formas que não definiram a sua
      const comFonte = { ...s, shapes: s.shapes.map((f) => ({ ...f, fontFamily: f.fontFamily || fonteTema(setup) })) };
      escreverLamina(slide, comFonte, setup);
    }
    escreverNotas(slide, s.notes);
  });

  // arraybuffer: no Tauri não existe download de browser (o writeFile() do
  // PptxGenJS não funciona aqui — ver achado F18 no plano)
  const buf = await pptx.write({ outputType: "arraybuffer" });
  // sem lâminas ricas, fontes, nomes ou lâminas ocultas, o pacote do PptxGenJS já está pronto
  const precisaPos = ricas.length > 0 || setup.fontsRaw?.length || slides.some((s) => s.nome?.trim() || s.show === false);
  if (!precisaPos) return new Uint8Array(buf);
  return await trocarLaminas(new Uint8Array(buf), slides, ricas, setup);
}

export { escreverLamina } from "./slides";
export { escreverNotas } from "./notes";
export { aplicarTema, coresTema, fonteTema } from "./theme";
export { propsDaForma, caixaEmPol } from "./shapes";
export { markdownEmBlocos } from "./slides";

const MIME_EXT: Record<string, string> = { png: "image/png", jpeg: "image/jpeg", jpg: "image/jpeg", gif: "image/gif", svg: "image/svg+xml", webp: "image/webp", bmp: "image/bmp" };

/** Troca o conteúdo das lâminas "ricas" do pacote gerado pelo PptxGenJS pelo XML fiel do Escritor. */
async function trocarLaminas(bytes: Uint8Array, slides: Slide[], ricas: number[], setup: DeckSetup): Promise<Uint8Array> {
  const { default: JSZip } = await import("jszip");
  const zip = await JSZip.loadAsync(bytes);
  const escritor = new Escritor(setup);
  for (const i of ricas) {
    const saida = escritor.lamina(slides[i]);
    zip.file(`ppt/slides/slide${i + 1}.xml`, saida.xml);
    const relPath = `ppt/slides/_rels/slide${i + 1}.xml.rels`;
    let rels = (await zip.file(relPath)?.async("string")) ?? `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"></Relationships>`;
    const novas = saida.imagens
      .map((im) => `<Relationship Id="${im.id}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/${im.arquivo}"/>`)
      .join("");
    rels = rels.replace("</Relationships>", () => novas + "</Relationships>");
    zip.file(relPath, rels);
  }
  // nome e oculta das lâminas: vale para os dois caminhos — o PptxGenJS grava "Slide N"
  // e não escreve no XML trocado pelo Escritor; o show="0" do p:sld some quando a lâmina é rica
  for (let i = 0; i < slides.length; i++) {
    const nome = slides[i].nome?.trim();
    const oculta = slides[i].show === false;
    if (!nome && !oculta) continue;
    const parte = `ppt/slides/slide${i + 1}.xml`;
    let xml = await zip.file(parte)?.async("string");
    if (!xml) continue;
    if (nome) xml = comNomeDaCld(xml, nome);
    if (oculta) xml = comOcultaNoSld(xml);
    zip.file(parte, xml);
  }
  // lâmina oculta: o PptxGenJS já marcou o p:sld (é o que o PowerPoint lê);
  // aqui marcamos também o p:sldId, que é de onde o nosso importador lê
  const ocultas = slides.map((s, i) => (s.show === false ? i : -1)).filter((i) => i >= 0);
  if (ocultas.length) {
    const pres = await zip.file("ppt/presentation.xml")?.async("string");
    if (pres) zip.file("ppt/presentation.xml", comOcultasNoSldId(pres, ocultas));
  }
  const exts = new Set<string>();
  for (const m of escritor.midias) {
    zip.file(`ppt/media/${m.arquivo}`, m.bytes);
    exts.add(m.ext);
  }
  let ct = (await zip.file("[Content_Types].xml")?.async("string")) ?? "";
  for (const ext of exts) {
    if (!new RegExp(`Extension="${ext}"`, "i").test(ct)) ct = ct.replace(/(<Types[^>]*>)/, (m) => `${m}<Default Extension="${ext}" ContentType="${MIME_EXT[ext] ?? "application/octet-stream"}"/>`);
  }
  // fontes embutidas do arquivo original: voltam como estavam (o PowerPoint usa quando a fonte não está instalada)
  if (setup.fontsRaw?.length) {
    const porFamilia = new Map<string, { attrs: Record<string, string>; itens: { slot: string; id: string }[] }>();
    let relsPres = (await zip.file("ppt/_rels/presentation.xml.rels")?.async("string")) ?? "";
    let n = 0;
    for (const f of setup.fontsRaw) {
      n++;
      const id = `rIdF${n}`;
      zip.file(`ppt/fonts/font${n}.fntdata`, f.data, { base64: true });
      relsPres = relsPres.replace("</Relationships>", () => `<Relationship Id="${id}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/font" Target="fonts/font${n}.fntdata"/></Relationships>`);
      const g = porFamilia.get(f.attrs.typeface ?? `fonte${n}`) ?? { attrs: f.attrs, itens: [] };
      g.itens.push({ slot: f.slot, id });
      porFamilia.set(f.attrs.typeface ?? `fonte${n}`, g);
    }
    zip.file("ppt/_rels/presentation.xml.rels", relsPres);
    const ordem = ["regular", "bold", "italic", "boldItalic"];
    const lista = [...porFamilia.values()]
      .map((g) => {
        const attrs = Object.entries(g.attrs).map(([k, v]) => ` ${k}="${v.replace(/&/g, "&amp;").replace(/"/g, "&quot;")}"`).join("");
        const itens = g.itens.sort((a, b) => ordem.indexOf(a.slot) - ordem.indexOf(b.slot)).map((i) => `<p:${i.slot} r:id="${i.id}"/>`).join("");
        return `<p:embeddedFont><p:font${attrs}/>${itens}</p:embeddedFont>`;
      })
      .join("");
    let pres = (await zip.file("ppt/presentation.xml")?.async("string")) ?? "";
    if (pres && !pres.includes("<p:embeddedFontLst>")) {
      pres = pres.replace(/(<p:notesSz[^>]*\/>|<p:notesSz[^>]*>[\s\S]*?<\/p:notesSz>)/, (m) => `${m}<p:embeddedFontLst>${lista}</p:embeddedFontLst>`);
      if (!/embedTrueTypeFonts=/.test(pres)) pres = pres.replace(/<p:presentation /, '<p:presentation embedTrueTypeFonts="1" ');
      zip.file("ppt/presentation.xml", pres);
    }
    if (!/Extension="fntdata"/i.test(ct)) ct = ct.replace(/(<Types[^>]*>)/, (m) => `${m}<Default Extension="fntdata" ContentType="application/x-fontdata"/>`);
  }
  zip.file("[Content_Types].xml", ct);
  return await zip.generateAsync({ type: "uint8array", compression: "DEFLATE" });
}
