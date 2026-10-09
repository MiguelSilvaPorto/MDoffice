// O palco: onde a lâmina é desenhada. Cuida de zoom, seleção de formas,
// arrastar e redimensionar. Não conhece o deck — só manipula o DOM.
import { clampBox } from "./shapes";
import type { Shape } from "./schema";

const ZOOM_MIN = 40;
const ZOOM_MAX = 200;

export interface StageHooks {
  /** Uma forma mudou de posição/tamanho (box em % da lâmina). */
  onBox: (shapeId: string, box: Shape["box"]) => void;
  /** Uma forma foi selecionada (id) ou desmarcada (null). */
  onSelect: (shapeId: string | null) => void;
}

export class Stage {
  private frame: HTMLElement | null = null;
  private slideEl: HTMLElement | null = null;
  private hooks: StageHooks;
  private zoom = 100;

  constructor(hooks: StageHooks) {
    this.hooks = hooks;
  }

  /** Liga o palco aos elementos do HTML (o pane já existe no index.html). */
  attach(frame: HTMLElement, slideEl: HTMLElement): void {
    this.frame = frame;
    this.slideEl = slideEl;
    this.ligarArraste();
  }

  get element(): HTMLElement | null {
    return this.frame;
  }

  get zoomAtual(): number {
    return this.zoom;
  }

  setZoom(valor: number): number {
    this.zoom = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Math.round(valor)));
    if (this.frame) this.frame.style.transform = `scale(${this.zoom / 100})`;
    return this.zoom;
  }

  zoomIn(): number {
    return this.setZoom(this.zoom + 10);
  }

  zoomOut(): number {
    return this.setZoom(this.zoom - 10);
  }

  zoomReset(): number {
    return this.setZoom(100);
  }

  /** Marca visualmente a forma selecionada (classe .selected). */
  marcarSelecionado(shapeId: string | null): void {
    if (!this.slideEl) return;
    this.slideEl.querySelectorAll<HTMLElement>(".pp-shape.selected").forEach((el) => el.classList.remove("selected"));
    if (!shapeId) return;
    const el = this.slideEl.querySelector<HTMLElement>(`[data-shape="${shapeId}"]`);
    if (el) el.classList.add("selected");
  }

  /**
   * Arrastar e redimensionar via Pointer Events.
   * Usa coordenadas em % da lâmina para o mesmo gesto servir na tela e no .pptx.
   */
  private ligarArraste(): void {
    const inicio = (e: PointerEvent) => {
      if (!this.slideEl) return;
      const alvo = e.target as HTMLElement;
      const formaEl = alvo.closest<HTMLElement>(".pp-shape");
      // clique no vazio da lâmina = desseleciona
      if (!formaEl) {
        this.hooks.onSelect(null);
        this.marcarSelecionado(null);
        return;
      }
      const id = formaEl.dataset.shape!;
      this.hooks.onSelect(id);
      this.marcarSelecionado(id);

      const lâmina = this.slideEl!.getBoundingClientRect();
      const redimensionando = alvo.classList.contains("pp-handle");
      const box = formaEl.getBoundingClientRect();
      const base: Shape["box"] = {
        x: ((box.left - lâmina.left) / lâmina.width) * 100,
        y: ((box.top - lâmina.top) / lâmina.height) * 100,
        w: (box.width / lâmina.width) * 100,
        h: (box.height / lâmina.height) * 100,
      };
      const x0 = e.clientX;
      const y0 = e.clientY;
      let movido = false;

      const mover = (ev: PointerEvent) => {
        if (Math.abs(ev.clientX - x0) + Math.abs(ev.clientY - y0) > 2) movido = true;
        const novo = redimensionando
          ? clampBox({
              x: base.x,
              y: base.y,
              w: base.w + ((ev.clientX - x0) / lâmina.width) * 100,
              h: base.h + ((ev.clientY - y0) / lâmina.height) * 100,
            })
          : clampBox({
              x: base.x + ((ev.clientX - x0) / lâmina.width) * 100,
              y: base.y + ((ev.clientY - y0) / lâmina.height) * 100,
              w: base.w,
              h: base.h,
            });
        this.hooks.onBox(id, novo);
        // enquanto arrasta, aplica direto no DOM (feedback imediato)
        formaEl.style.left = `${novo.x}%`;
        formaEl.style.top = `${novo.y}%`;
        formaEl.style.width = `${novo.w}%`;
        formaEl.style.height = `${novo.h}%`;
      };
      const soltar = () => {
        formaEl.removeEventListener("pointermove", mover);
        formaEl.removeEventListener("pointerup", soltar);
        formaEl.removeEventListener("pointercancel", soltar);
        if (movido) this.hooks.onBox(id, this.caixaAtual(formaEl, lâmina));
      };
      formaEl.addEventListener("pointermove", mover);
      formaEl.addEventListener("pointerup", soltar);
      formaEl.addEventListener("pointercancel", soltar);
      // impede a seleção de texto do navegador durante o arrasto
      e.preventDefault();
    };
    this.slideEl?.addEventListener("pointerdown", inicio);
  }

  private caixaAtual(el: HTMLElement, lâmina: DOMRect): Shape["box"] {
    const r = el.getBoundingClientRect();
    return clampBox({
      x: ((r.left - lâmina.left) / lâmina.width) * 100,
      y: ((r.top - lâmina.top) / lâmina.height) * 100,
      w: (r.width / lâmina.width) * 100,
      h: (r.height / lâmina.height) * 100,
    });
  }
}