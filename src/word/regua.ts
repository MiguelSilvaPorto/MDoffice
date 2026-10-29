// A régua do Word: a horizontal (em cima da folha) e a vertical (na lateral do papel).
// As margens ficam sombreadas e as marcas saem em centímetros — como a do Word.
//
// Onde cada uma mora:
//  - a HORIZONTAL vive no palco, acima da folha e grudada no topo da rolagem. Ela mede a
//    LARGURA: por isso acompanha o zoom e mostra as margens esquerda e direita;
//  - a VERTICAL vive dentro da folha escalada, ao lado do papel. Só assim ela continua
//    apontando para a margem esquerda do papel quando a folha muda de tamanho, de margem ou
//    de zoom (a folha é o que dá a referência).
//
// A régua é desenhada num <canvas>: os traços ficam nítidos em qualquer zoom (o desenho é
// refeito na resolução da tela) e as medidas em centímetros caem em qualquer papel.

import { CM_TO_PX, pageSizePx, type PageSetup } from "./model";

/** A espessura da régua na tela (px). */
export const ESPESSURA = 20;

export interface ReguaHooks {
  /** A configuração da página (o papel e as margens). */
  getSetup: () => PageSetup;
  /** O zoom da vista (a régua acompanha). */
  getZoom: () => number;
  /** Quantas páginas a folha mede (o modo livro mede duas, lado a lado). */
  getPaginas?: () => number;
  /** Os recuos do parágrafo selecionado, em pontos (para os marcadores). */
  getIndents?: () => { left: number; right: number };
  /** Aplica um recuo (em pontos) ao parágrafo selecionado — o arrasto do marcador. */
  setIndent?: (lado: "left" | "right", pt: number) => void;
}

/** 1 ponto = 96/72 px (a folha é desenhada a 96 dpi). */
const PT_TO_PX = 96 / 72;
/** Distância (px de tela) para pegar o marcador com o ponteiro. */
const PEGA_MARCADOR = 8;

interface Cores {
  /** o fundo da régua (a cor do app). */
  fundo: string;
  /** a tinta (os números e as marcas). */
  tinta: string;
}

/**
 * Onde caem as marcas da régua: uma a cada centímetro, com o número a cada 2 cm quando a
 * régua está apertada (zoom pequeno). `escala` é quantos pixels de tela vale um centímetro.
 */
export function marcasDaRegua(comprimentoPx: number, escala: number): { cm: number; pos: number; numero: boolean }[] {
  const passo = escala >= 0.75 ? 1 : 2;
  const cmMax = Math.ceil(comprimentoPx / CM_TO_PX);
  const marcas: { cm: number; pos: number; numero: boolean }[] = [];
  for (let cm = 0; cm <= cmMax; cm++) {
    const pos = cm * CM_TO_PX * escala;
    if (pos > comprimentoPx) break;
    marcas.push({ cm, pos, numero: cm % passo === 0 && cm > 0 });
  }
  return marcas;
}

export class Reguas {
  private h: HTMLCanvasElement | null;
  private v: HTMLCanvasElement | null;
  private hooks: ReguaHooks;
  /**
   * A régua nasce **ligada**: com os marcadores de recuo ela é ferramenta de formatação,
   * não só enfeite. O botão "Régua" (aba Exibir) continua desligando.
   */
  private ligada = true;
  /** Marcador que está sendo arrastado (ou null). */
  private arrastando: "left" | "right" | null = null;

  constructor(h: HTMLCanvasElement | null, v: HTMLCanvasElement | null, hooks: ReguaHooks) {
    this.h = h;
    this.v = v;
    this.hooks = hooks;
    this.aplicarVisibilidade();
    h?.addEventListener("pointerdown", this.onPointerDown);
    h?.addEventListener("pointermove", this.onPointerMove);
    h?.addEventListener("pointerup", this.onPointerUp);
    h?.addEventListener("pointercancel", this.onPointerUp);
    h?.addEventListener("pointerleave", () => {
      if (!this.arrastando && this.h) this.h.style.cursor = "default";
    });
  }

  /** A régua está ligada? */
  visivel(): boolean {
    return this.ligada;
  }

  /** Liga/desliga a régua (o botão da aba Exibir). */
  alternar(): boolean {
    this.ligada = !this.ligada;
    this.aplicarVisibilidade();
    this.desenhar();
    return this.ligada;
  }

  private aplicarVisibilidade(): void {
    if (this.h) this.h.hidden = !this.ligada;
    if (this.v) this.v.hidden = !this.ligada;
  }

  /** Redesenha as duas réguas (o papel, as margens ou o zoom mudaram). */
  desenhar(): void {
    if (!this.ligada) return;
    this.desenharHorizontal();
    this.desenharVertical();
  }

  private cores(): Cores {
    const cs = getComputedStyle(document.documentElement);
    const peg = (nome: string, padrao: string) => cs.getPropertyValue(nome).trim() || padrao;
    return { fundo: peg("--panel", "#ffffff"), tinta: peg("--muted", "#6b7280") };
  }

  /**
   * A régua horizontal: mede a LARGURA da folha. Ela fica no palco (fora da escala), então
   * o desenho usa o zoom para saber quanto vale um centímetro na tela.
   */
  private desenharHorizontal(): void {
    const canvas = this.h;
    if (!canvas) return;
    const s = this.hooks.getSetup();
    const zoom = this.hooks.getZoom();
    const { w } = pageSizePx(s);
    const paginas = Math.max(1, this.hooks.getPaginas?.() ?? 1);
    const ml = Math.round(s.margins.left * CM_TO_PX);
    const mr = Math.round(s.margins.right * CM_TO_PX);
    const dpr = window.devicePixelRatio || 1;
    const larguraTela = Math.max(1, Math.round(w * paginas * zoom));
    canvas.width = Math.max(1, Math.round(larguraTela * dpr));
    canvas.height = Math.max(1, Math.round(ESPESSURA * dpr));
    canvas.style.width = `${larguraTela}px`;
    canvas.style.height = `${ESPESSURA}px`;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const cores = this.cores();
    ctx.fillStyle = cores.fundo;
    ctx.fillRect(0, 0, larguraTela, ESPESSURA);
    // as margens do papel sombreadas: a parte clara é a área de texto
    ctx.fillStyle = "rgba(128,128,128,0.30)";
    for (let p = 0; p < paginas; p++) {
      const base = p * w * zoom;
      ctx.fillRect(base, 0, ml * zoom, ESPESSURA);
      ctx.fillRect(base + larguraTela / paginas - mr * zoom, 0, mr * zoom, ESPESSURA);
    }
    ctx.strokeStyle = cores.tinta;
    ctx.fillStyle = cores.tinta;
    ctx.lineWidth = 1;
    ctx.font = "9px 'Segoe UI', sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "alphabetic";
    // a cada centímetro uma marca; o número sai a cada 2 cm quando a régua está apertada
    for (const m of marcasDaRegua(w, zoom)) {
      const x = Math.round(m.pos) + 0.5;
      if (x > larguraTela) break;
      const grande = m.numero;
      ctx.beginPath();
      ctx.moveTo(x, grande ? ESPESSURA - 9 : ESPESSURA - 5);
      ctx.lineTo(x, ESPESSURA - 0.5);
      ctx.stroke();
      if (grande) ctx.fillText(String(m.cm), x, 9);
    }
    this.desenharMarcadores(ctx, s, zoom, paginas);
  }

  /**
   * Os marcadores de recuo (esquerdo e direito), como no Word: um triângulo no topo da
   * régua e uma linha até a base. Arrastar o da esquerda afasta o texto da margem
   * esquerda; o da direita, da margem direita.
   */
  private desenharMarcadores(
    ctx: CanvasRenderingContext2D,
    s: PageSetup,
    zoom: number,
    paginas: number
  ): void {
    if (!this.hooks.getIndents || !this.hooks.setIndent) return;
    const ind = this.hooks.getIndents();
    const { w } = pageSizePx(s);
    const ml = s.margins.left * CM_TO_PX;
    const mr = s.margins.right * CM_TO_PX;
    const larguraPagina = w * zoom;
    const accent = getComputedStyle(document.documentElement).getPropertyValue("--accent").trim() || "#6d28d9";
    ctx.save();
    ctx.strokeStyle = accent;
    ctx.fillStyle = accent;
    ctx.lineWidth = 1.5;
    for (let p = 0; p < paginas; p++) {
      const base = p * larguraPagina;
      const xEsq = base + ml * zoom + ind.left * PT_TO_PX * zoom;
      const xDir = base + (w - mr) * zoom - ind.right * PT_TO_PX * zoom;
      for (const x of [xEsq, xDir]) {
        ctx.beginPath();
        ctx.moveTo(x, ESPESSURA - 1);
        ctx.lineTo(x, 8);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(x, 1);
        ctx.lineTo(x - 5, 8);
        ctx.lineTo(x + 5, 8);
        ctx.closePath();
        ctx.fill();
      }
    }
    ctx.restore();
    const cm = (pt: number): string => (pt / 28.3465).toFixed(1).replace(".", ",");
    if (this.h) {
      this.h.title = `Recuo esquerdo: ${cm(ind.left)} cm · direito: ${cm(ind.right)} cm — arraste os marcadores`;
    }
  }

  /** O marcador sob o ponteiro (o mais próximo), ou null. */
  private marcadorEm(x: number): "left" | "right" | null {
    if (!this.hooks.getIndents) return null;
    const s = this.hooks.getSetup();
    const zoom = this.hooks.getZoom();
    const { w } = pageSizePx(s);
    const ml = s.margins.left * CM_TO_PX;
    const mr = s.margins.right * CM_TO_PX;
    const paginas = Math.max(1, this.hooks.getPaginas?.() ?? 1);
    const ind = this.hooks.getIndents();
    const larguraPagina = w * zoom;
    let melhor: { lado: "left" | "right"; dist: number } | null = null;
    for (let p = 0; p < paginas; p++) {
      const base = p * larguraPagina;
      const xEsq = base + ml * zoom + ind.left * PT_TO_PX * zoom;
      const xDir = base + (w - mr) * zoom - ind.right * PT_TO_PX * zoom;
      for (const [lado, xm] of [["left", xEsq], ["right", xDir]] as const) {
        const dist = Math.abs(x - xm);
        if (dist <= PEGA_MARCADOR && (!melhor || dist < melhor.dist)) melhor = { lado, dist };
      }
    }
    return melhor?.lado ?? null;
  }

  /** O recuo (pt) que o ponteiro representa, no marcador e na página em que ele está. */
  private valorDoPonteiro(x: number, lado: "left" | "right"): number {
    const s = this.hooks.getSetup();
    const zoom = this.hooks.getZoom();
    const { w } = pageSizePx(s);
    const ml = s.margins.left * CM_TO_PX;
    const mr = s.margins.right * CM_TO_PX;
    const paginas = Math.max(1, this.hooks.getPaginas?.() ?? 1);
    const ind = this.hooks.getIndents?.() ?? { left: 0, right: 0 };
    const larguraPagina = w * zoom;
    const pagina = Math.min(paginas - 1, Math.max(0, Math.floor(x / larguraPagina)));
    const base = pagina * larguraPagina;
    const textoPt = (w - ml - mr) / PT_TO_PX;
    if (lado === "left") {
      const pt = (x - (base + ml * zoom)) / zoom / PT_TO_PX;
      return Math.round(Math.min(Math.max(0, textoPt - ind.right), Math.max(0, pt)));
    }
    const pt = (base + (w - mr) * zoom - x) / zoom / PT_TO_PX;
    return Math.round(Math.min(Math.max(0, textoPt - ind.left), Math.max(0, pt)));
  }

  private onPointerDown = (e: PointerEvent): void => {
    const lado = this.marcadorEm(e.offsetX);
    if (!lado || !this.hooks.setIndent) return;
    this.arrastando = lado;
    try {
      this.h?.setPointerCapture(e.pointerId);
    } catch {
      /* sem captura: o arrasto segue dentro do canvas */
    }
    if (this.h) this.h.style.cursor = "ew-resize";
    e.preventDefault();
  };

  private onPointerMove = (e: PointerEvent): void => {
    if (!this.h) return;
    if (!this.arrastando) {
      this.h.style.cursor = this.marcadorEm(e.offsetX) ? "ew-resize" : "default";
      return;
    }
    const lado = this.arrastando;
    const atual = this.hooks.getIndents?.() ?? { left: 0, right: 0 };
    const pt = this.valorDoPonteiro(e.offsetX, lado);
    if (pt === (lado === "left" ? atual.left : atual.right)) return;
    // o host aplica ao parágrafo e redesenha a régua no `onChange` do editor: um desenho
    // por movimento, não dois (o `desenhar` daqui e o do host)
    this.hooks.setIndent?.(lado, pt);
    e.preventDefault();
  };

  private onPointerUp = (e: PointerEvent): void => {
    if (!this.arrastando) return;
    this.arrastando = null;
    try {
      this.h?.releasePointerCapture(e.pointerId);
    } catch {
      /* já soltou */
    }
    if (this.h) this.h.style.cursor = "default";
  };

  /**
   * A régua vertical: mede a ALTURA do papel. Ela mora dentro da folha escalada, então o
   * desenho é na proporção do papel (1 px do papel = 1 px do desenho) e o texto sai no
   * tamanho da tela (por isso a fonte é dividida pelo zoom).
   */
  private desenharVertical(): void {
    const canvas = this.v;
    if (!canvas) return;
    const s = this.hooks.getSetup();
    const zoom = this.hooks.getZoom();
    const { h } = pageSizePx(s);
    const mt = Math.round(s.margins.top * CM_TO_PX);
    const mb = Math.round(s.margins.bottom * CM_TO_PX);
    const dpr = window.devicePixelRatio || 1;
    // a espessura é a da TELPA: dentro da folha escalada, ela vale ESPESSURA/zoom
    const espessura = ESPESSURA / zoom;
    canvas.width = Math.max(1, Math.round(espessura * dpr));
    canvas.height = Math.max(1, Math.round(h * dpr));
    canvas.style.width = `${espessura}px`;
    canvas.style.height = `${h}px`;
    // ao lado do papel (a folha é a referência da margem esquerda)
    canvas.style.left = `${-espessura}px`;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const cores = this.cores();
    ctx.fillStyle = cores.fundo;
    ctx.fillRect(0, 0, espessura, h);
    ctx.fillStyle = "rgba(128,128,128,0.30)";
    ctx.fillRect(0, 0, espessura, mt);
    ctx.fillRect(0, h - mb, espessura, mb);
    ctx.strokeStyle = cores.tinta;
    ctx.fillStyle = cores.tinta;
    ctx.lineWidth = 1;
    // o número sai no tamanho da tela: dentro da folha escalada, a fonte é dividida pelo zoom
    ctx.font = `${9 / zoom}px 'Segoe UI', sans-serif`;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    // a régua vertical mora dentro da folha escalada: a escala da marca é 1 (1 px do papel)
    for (const m of marcasDaRegua(h, 1)) {
      const y = Math.round(m.pos) + 0.5;
      if (y > h) break;
      const grande = m.numero;
      ctx.beginPath();
      ctx.moveTo(espessura - (grande ? 8 / zoom : 4 / zoom), y);
      ctx.lineTo(espessura - 0.5, y);
      ctx.stroke();
      if (grande) ctx.fillText(String(m.cm), 1 / zoom, y - 4 / zoom);
    }
  }
}
