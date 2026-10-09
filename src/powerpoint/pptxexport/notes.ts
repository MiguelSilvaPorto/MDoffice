// Notas do apresentador no .pptx.
// IMPORTANTE (achado do teste T1): addNotes() substitui a nota anterior quando
// chamada duas vezes na mesma lâmina — por isso chamamos sempre uma vez, aqui.

type PptxSlide = { addNotes: (notas: string) => unknown };

/** Escreve as notas da lâmina, se houver. */
export function escreverNotas(slide: PptxSlide, notas: string): void {
  if (!notas.trim()) return;
  slide.addNotes(notas.trim());
}