// Módulo de APRESENTAÇÕES (estilo PowerPoint) do mdOffice.
//
// Um "deck" é um documento Markdown normal: cada slide é separado por uma linha com --- .
// Isso mantém tudo o que o app já sabe fazer (IA, correção, exportação) e dá para
// apresentar (F5), navegar com as setas e exportar em PDF pela impressão (Ctrl+P).
import { marked } from "marked";
import DOMPurify from "dompurify";

marked.setOptions({ gfm: true, breaks: false });

/** Separa o texto em slides (--- isolado numa linha, como no Markdown). */
export function splitSlides(texto: string): string[] {
  return texto
    .replace(/\r\n/g, "\n")
    .split(/^\s*-{3,}\s*$/m)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

/** Quantos slides o documento tem (para mostrar no menu/botão). */
export function deckCount(texto: string): number {
  return splitSlides(texto).length;
}

/**
 * Abre o modo apresentação: tela cheia, fundo escuro, uma lâmina por vez.
 * Setas/Espaço/Clique avançam, Backspace volta, Esc sai. Ctrl+P imprime (1 slide por página).
 */
export function openPresentation(texto: string, titulo = "Apresentação"): void {
  const slides = splitSlides(texto);
  if (!slides.length) {
    alert("Este documento não tem conteúdo para apresentar.\n\nSepare os slides com uma linha de três traços (---).");
    return;
  }

  const overlay = document.createElement("div");
  overlay.className = "slides-overlay";
  overlay.innerHTML = `
    <div class="slides-stage" data-stage></div>
    <div class="slides-bar">
      <span class="slides-title"></span>
      <span class="slides-count" data-count></span>
      <span class="slides-help">← → navega · Esc sai · Ctrl+P exporta PDF</span>
      <button class="btn" data-close>Fechar</button>
    </div>`;
  document.body.append(overlay);
  document.body.classList.add("apresentando");
  (overlay.querySelector(".slides-title") as HTMLElement).textContent = titulo;

  const stage = overlay.querySelector<HTMLElement>("[data-stage]")!;
  const contador = overlay.querySelector<HTMLElement>("[data-count]")!;
  let atual = 0;

  const pintar = async () => {
    const html = await marked.parse(slides[atual], { gfm: true, async: true });
    stage.innerHTML = `<section class="slide">${DOMPurify.sanitize(String(html), { ADD_ATTR: ["target", "rel"] })}</section>`;
    contador.textContent = `${atual + 1} / ${slides.length}`;
  };
  void pintar();

  const ir = (passo: number) => {
    const proximo = Math.min(Math.max(0, atual + passo), slides.length - 1);
    if (proximo === atual) return;
    atual = proximo;
    void pintar();
  };
  const fechar = () => {
    document.removeEventListener("keydown", onKey, true);
    overlay.remove();
    document.body.classList.remove("apresentando");
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      fechar();
      return;
    }
    if (e.key === "ArrowRight" || e.key === "ArrowDown" || e.key === " " || e.key === "PageDown" || e.key === "Enter") {
      e.preventDefault();
      ir(1);
      return;
    }
    if (e.key === "ArrowLeft" || e.key === "ArrowUp" || e.key === "PageUp" || e.key === "Backspace") {
      e.preventDefault();
      ir(-1);
    }
  };
  document.addEventListener("keydown", onKey, true);
  overlay.addEventListener("click", (e) => {
    const alvo = e.target as HTMLElement;
    if (alvo.closest("a")) return; // deixa links clicáveis
    if (alvo.closest("[data-close]")) {
      fechar();
      return;
    }
    ir(1);
  });
  overlay.querySelector<HTMLElement>("[data-close]")!.addEventListener("click", (e) => {
    e.stopPropagation();
    fechar();
  });
  overlay.focus?.();
}
