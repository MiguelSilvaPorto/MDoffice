// Painel de notas do apresentador: o texto em `Slide.notes`, que não aparece
// na lâmina mas vai para o .pptx (addNotes) e para o modo apresentação (tecla N).

export class NotesPanel {
  private area: HTMLTextAreaElement | null = null;
  private onChange: ((notes: string) => void) | null = null;
  private shapeId = "";

  attach(area: HTMLTextAreaElement, onChange?: (notes: string) => void): void {
    this.area = area;
    this.onChange = onChange ?? null;
    area.oninput = () => this.onChange?.(area.value);
  }

  detach(): void {
    if (this.area) this.area.oninput = null;
    this.area = null;
  }

  /** Escreve as notas da lâmina no painel. */
  setText(notes: string): void {
    if (!this.area) return;
    if (this.area.value !== notes) this.area.value = notes;
  }

  getText(): string {
    return this.area ? this.area.value : "";
  }

  /** Foca o painel (botão "Notas" da fita). */
  focus(): void {
    this.area?.focus();
  }

  get element(): HTMLTextAreaElement | null {
    return this.area;
  }

  get alvo(): string {
    return this.shapeId;
  }

  setAlvo(id: string): void {
    this.shapeId = id;
  }
}