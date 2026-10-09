// Edição de texto dentro da lâmina. Cada forma de texto é um contenteditable
// com histórico próprio (pilha simples de desfazer/refazer por forma).
import type { Shape } from "./schema";

interface UndoEntry {
  antes: string;
  depois: string;
}

const LIMITE_UNDO = 100;

export class TextEditor {
  private el: HTMLElement | null = null;
  private shapeId = "";
  private pilha = new Map<string, UndoEntry[]>();
  private future = new Map<string, UndoEntry[]>();
  private onChange: ((shapeId: string, texto: string) => void) | null = null;

  /** Liga o editor a uma forma e começa a "escutar" o que o usuário digita. */
  attach(el: HTMLElement, shapeId: string, onChange?: (shapeId: string, texto: string) => void): void {
    this.el = el;
    this.shapeId = shapeId;
    this.onChange = onChange ?? null;
    // agora que estamos no elemento certo, conecta os handlers
    el.oninput = () => this.registrar(el.innerText.replace(/ /g, " "));
    el.onkeydown = (e) => this.tecla(e);
  }

  detach(): void {
    if (this.el) {
      this.el.oninput = null;
      this.el.onkeydown = null;
    }
    this.el = null;
    this.shapeId = "";
  }

  /** Texto atual da forma em edição. */
  texto(): string {
    return this.el ? this.el.innerText.replace(/ /g, " ") : "";
  }

  private registrar(texto: string): void {
    if (!this.shapeId) return;
    const lista = this.pilha.get(this.shapeId) ?? [];
    const anterior = lista[lista.length - 1]?.depois ?? texto;
    if (anterior === texto) return;
    lista.push({ antes: anterior, depois: texto });
    if (lista.length > LIMITE_UNDO) lista.shift();
    this.pilha.set(this.shapeId, lista);
    this.future.set(this.shapeId, []);
    this.onChange?.(this.shapeId, texto);
  }

  private tecla(e: KeyboardEvent): void {
    // Ctrl+Z desfaz, Ctrl+Y / Ctrl+Shift+Z refaz (dentro da forma)
    if (!(e.ctrlKey || e.metaKey)) return;
    const k = e.key.toLowerCase();
    if (k === "z") {
      e.preventDefault();
      if (e.shiftKey) this.refazer();
      else this.desfazer();
    } else if (k === "y") {
      e.preventDefault();
      this.refazer();
    }
  }

  podeDesfazer(shapeId: string): boolean {
    return (this.pilha.get(shapeId)?.length ?? 0) > 0;
  }

  podeRefazer(shapeId: string): boolean {
    return (this.future.get(shapeId)?.length ?? 0) > 0;
  }

  desfazer(): void {
    if (!this.shapeId || !this.el) return;
    const lista = this.pilha.get(this.shapeId);
    if (!lista || !lista.length) return;
    const item = lista.pop()!;
    this.el.innerText = item.antes;
    const f = this.future.get(this.shapeId) ?? [];
    f.push(item);
    this.future.set(this.shapeId, f);
    this.onChange?.(this.shapeId, item.antes);
  }

  refazer(): void {
    if (!this.shapeId || !this.el) return;
    const lista = this.future.get(this.shapeId);
    if (!lista || !lista.length) return;
    const item = lista.pop()!;
    this.el.innerText = item.depois;
    const p = this.pilha.get(this.shapeId) ?? [];
    p.push(item);
    this.pilha.set(this.shapeId, p);
    this.onChange?.(this.shapeId, item.depois);
  }

  /**
   * Aplica formatação de seleção (negrito/itálico/cor/fonte/tamanho/alinhamento)
   * via document.execCommand — é o caminho que o contenteditable entende
   * nativamente e o mesmo que o corretor/IA esperam encontrar.
   */
  aplicar(comando: string, valor?: string): void {
    if (!this.el) return;
    this.el.focus();
    document.execCommand(comando, false, valor);
    this.registrar(this.el.innerText.replace(/ /g, " "));
  }

  /** Estado do texto selecionado (a fita usa para acender os botões). */
  query(): { bold: boolean; italic: boolean; align: string } {
    try {
      return {
        bold: document.queryCommandState("bold"),
        italic: document.queryCommandState("italic"),
        align: (document.queryCommandValue("justify") as string) || "left",
      };
    } catch {
      return { bold: false, italic: false, align: "left" };
    }
  }

  /** Limpa o histórico de uma forma (quando ela é excluída). */
  esquecer(shapeId: string): void {
    this.pilha.delete(shapeId);
    this.future.delete(shapeId);
  }

  /** Serializa o texto de volta para o modelo (usa o texto do DOM). */
  snapshot(): { shapeId: string; texto: string } | null {
    if (!this.el || !this.shapeId) return null;
    return { shapeId: this.shapeId, texto: this.texto() };
  }
}