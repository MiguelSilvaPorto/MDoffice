// A tela de apresentação (modo tela cheia, F5). Recebe o modelo do deck e desenha
// uma lâmina por vez. Também é a porta de entrada que o App chama para apresentar
// um documento Markdown qualquer — por isso concentra openPresentation/deckSummary.
import { marked } from "marked";
import DOMPurify from "dompurify";
import { deckFromMarkdown } from "./markdown";
import { DEFAULT_SETUP, stageRatio } from "./model";
import type { Deck, DeckSetup } from "./schema";

marked.setOptions({ gfm: true, breaks: false });

function sanitize(html: string): string {
  return DOMPurify.sanitize(html, { ADD_ATTR: ["target", "rel"] });
}

/** Abre o modo apresentação. Setas/Espaço/Enter/clique avançam, Backspace volta,
 *  N mostra/oculta as notas, Esc sai. Ctrl+P imprime uma lâmina por página (PDF). */
export function openDeckView(deck: Deck, setup: DeckSetup = DEFAULT_SETUP, titulo?: string): void {
  if (!deck.slides.length) {
    alert("Este documento não tem conteúdo para apresentar.\n\nSepare as lâminas com uma linha de três traços (---).");
    return;
  }
  const overlay = document.createElement("div");
  overlay.className = `slides-overlay tema-${setup.theme}`;
  overlay.innerHTML = `
    <div class="slides-stage" data-stage></div>
    <div class="slides-notes" data-notes hidden></div>
    <div class="slides-bar">
      <span class="slides-title" data-title></span>
      <span class="slides-count" data-count></span>
      <span class="slides-help">← → navega · N notas · Esc sai · Ctrl+P exporta PDF</span>
      <button class="btn" data-close>Fechar</button>
    </div>`;
  document.body.append(overlay);
  document.body.classList.add("apresentando");
  overlay.style.setProperty("--slide-ratio", String(stageRatio(setup)));

  const stage = overlay.querySelector<HTMLElement>("[data-stage]")!;
  const contador = overlay.querySelector<HTMLElement>("[data-count]")!;
  const notas = overlay.querySelector<HTMLElement>("[data-notes]")!;
  const rotulo = overlay.querySelector<HTMLElement>("[data-title]")!;
  let atual = 0;
  let mostrarNotas = false;

  rotulo.textContent = titulo || deck.titulo;
  if (setup.footer) rotulo.textContent += ` · ${setup.footer}`;

  const pintar = async () => {
    const slide = deck.slides[atual];
    const html = await marked.parse(slide.md, { gfm: true, async: true });
    const numero = setup.showNumber ? `<span class="slide-num">${atual + 1}</span>` : "";
    stage.innerHTML = `<section class="slide layout-${slide.layout}">${sanitize(String(html))}${numero}</section>`;
    contador.textContent = `${atual + 1} / ${deck.slides.length}`;
    notas.textContent = slide.notes;
    notas.hidden = !mostrarNotas || !slide.notes;
  };
  void pintar();

  const ir = (passo: number) => {
    const proximo = Math.min(Math.max(0, atual + passo), deck.slides.length - 1);
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
    if (e.key.toLowerCase() === "n") {
      mostrarNotas = !mostrarNotas;
      notas.hidden = !mostrarNotas || !deck.slides[atual].notes;
      return;
    }
    if (["ArrowRight", "ArrowDown", " ", "PageDown", "Enter"].includes(e.key)) {
      e.preventDefault();
      ir(1);
      return;
    }
    if (["ArrowLeft", "ArrowUp", "PageUp", "Backspace"].includes(e.key)) {
      e.preventDefault();
      ir(-1);
    }
  };
  document.addEventListener("keydown", onKey, true);
  overlay.addEventListener("click", (e) => {
    const alvo = e.target as HTMLElement;
    if (alvo.closest("a")) return;
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
}

// ---------------------------------------------------------------------------
// API que o App chama (equivalente ao antigo src/power/host.ts, fundido aqui)
// ---------------------------------------------------------------------------

/** Apresenta o documento atual (o app chama isto no F5 / menu). */
export function openPresentation(texto: string, titulo = "Apresentação"): void {
  const deck = deckFromMarkdown(texto, DEFAULT_SETUP);
  openDeckView(deck, DEFAULT_SETUP, titulo);
}

/** Resumo para o menu/botão: quantas lâminas o documento tem. */
export function deckSummary(texto: string): string {
  const deck = deckFromMarkdown(texto, DEFAULT_SETUP);
  return `${deck.slides.length} lâmina${deck.slides.length === 1 ? "" : "s"}`;
}
