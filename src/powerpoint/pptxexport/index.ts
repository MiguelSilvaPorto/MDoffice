// Entrada da exportação: deck -> bytes de .pptx.
// O PptxGenJS é importado DINAMICAMENTE (só na hora de exportar) para não pesar
// no arranque do app — o bundle dele tem ~366 KB. Testado no Chromium/WebView (T5).

import type { Deck, DeckSetup, Slide } from "../schema";
import { escreverLamina } from "./slides";
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
  for (const s of slides) {
    const slide = pptx.addSlide() as Parameters<typeof escreverLamina>[0] & Parameters<typeof escreverNotas>[0];
    // fonte padrão do deck nas formas que não definiram a sua
    const comFonte = { ...s, shapes: s.shapes.map((f) => ({ ...f, fontFamily: f.fontFamily || fonteTema(setup) })) };
    escreverLamina(slide, comFonte, setup);
    escreverNotas(slide, s.notes);
  }

  // arraybuffer: no Tauri não existe download de browser (o writeFile() do
  // PptxGenJS não funciona aqui — ver achado F18 no plano)
  const buf = await pptx.write({ outputType: "arraybuffer" });
  return new Uint8Array(buf);
}

export { escreverLamina } from "./slides";
export { escreverNotas } from "./notes";
export { aplicarTema, coresTema, fonteTema } from "./theme";
export { propsDaForma, caixaEmPol } from "./shapes";
export { markdownEmBlocos } from "./slides";