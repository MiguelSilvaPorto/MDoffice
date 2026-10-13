// A tela de apresentação (modo tela cheia, F5). Recebe o modelo do deck e desenha
// uma lâmina por vez. Também é a porta de entrada que o App chama para apresentar
// um documento Markdown qualquer — por isso concentra openPresentation/deckSummary.
import { marked } from "marked";
import DOMPurify from "dompurify";
import { deckFromMarkdown } from "./markdown";
import { DEFAULT_SETUP, stageRatio } from "./model";
import type { Deck, DeckSetup, Slide } from "./schema";
import { fundoValor } from "./render/forma";

marked.setOptions({ gfm: true, breaks: false });

function sanitize(html: string): string {
  return DOMPurify.sanitize(html, { ADD_ATTR: ["target", "rel"] });
}

/** Lâmina oculta (`show === false`) fica de fora da apresentação. O campo ainda
 *  pode não existir no modelo, por isso a checagem é `=== false` (não `!slide.show`). */
function oculta(slide: Slide): boolean {
  return (slide as Slide & { show?: boolean }).show === false;
}

/** Abre o modo apresentação. Setas/Espaço/Enter/clique avançam, Backspace volta,
 *  Home/End vão à primeira/última lâmina, digitar um número e Enter pula direto
 *  para a lâmina, B/W alternam tela preta/branca, N mostra/oculta as notas, Esc
 *  sai. Ctrl+P imprime uma lâmina por página (PDF). Lâminas ocultas não aparecem. */
export function openDeckView(deck: Deck, setup: DeckSetup = DEFAULT_SETUP, titulo?: string, desenharFormas?: (slide: Slide) => string): void {
  if (!deck.slides.length) {
    alert("Este documento não tem conteúdo para apresentar.\n\nSepare as lâminas com uma linha de três traços (---).");
    return;
  }
  // a apresentação anda pela ordem das lâminas visíveis: `atual` é a posição nessa
  // lista (e é o número que a barra mostra), não o índice em deck.slides
  const ordem = deck.slides.map((_, i) => i).filter((i) => !oculta(deck.slides[i]));
  if (!ordem.length) {
    alert("Todas as lâminas estão ocultas — não há o que apresentar.\n\nMostre ao menos uma lâmina para usar o modo apresentação.");
    return;
  }
  const overlay = document.createElement("div");
  overlay.className = `slides-overlay tema-${setup.theme}`;
  overlay.innerHTML = `
    <div class="slides-stage" data-stage></div>
    <div class="slides-notes" data-notes hidden></div>
    <div class="slides-tela" data-tela hidden></div>
    <div class="slides-bar">
      <span class="slides-title" data-title></span>
      <span class="slides-count" data-count></span>
      <span class="slides-goto" data-goto hidden></span>
      <span class="slides-help">← → ↑ ↓ / PgUp PgDn navega · Home/End início/fim · nº + Enter vai para a lâmina · B/W tela preta/branca · N notas · Esc sai · Ctrl+P PDF</span>
      <button class="btn" data-close>Fechar</button>
    </div>`;
  document.body.append(overlay);
  document.body.classList.add("apresentando");
  overlay.style.setProperty("--slide-ratio", String(stageRatio(setup)));

  const stage = overlay.querySelector<HTMLElement>("[data-stage]")!;
  const contador = overlay.querySelector<HTMLElement>("[data-count]")!;
  const notas = overlay.querySelector<HTMLElement>("[data-notes]")!;
  const rotulo = overlay.querySelector<HTMLElement>("[data-title]")!;
  const tela = overlay.querySelector<HTMLElement>("[data-tela]")!;
  const goto = overlay.querySelector<HTMLElement>("[data-goto]")!;
  let atual = 0;
  let mostrarNotas = false;
  let digitos = ""; // número sendo digitado para "ir para a lâmina"
  let telaCor: "preta" | "branca" | null = null; // tela preta/branca (B/W)
  let pinturaSeq = 0; // marked é assíncrono: uma pintura antiga não pode sobrescrever a nova

  rotulo.textContent = titulo || deck.titulo;
  if (setup.footer) rotulo.textContent += ` · ${setup.footer}`;

  const pintar = async () => {
    const seq = ++pinturaSeq;
    const slide = deck.slides[ordem[atual]];
    // lâmina com formas (importada de .pptx ou montada no palco): desenha as formas, como no palco, em escala cheia
    if (slide.shapes.length && desenharFormas) {
      const fundo = fundoValor(slide.bg, setup.media ?? {});
      stage.innerHTML = `<section class="slide-rica" style="${fundo ? `background:${fundo};` : ""}">${desenharFormas(slide)}</section>`;
    } else {
      const html = await marked.parse(slide.md, { gfm: true, async: true });
      if (seq !== pinturaSeq) return; // uma troca mais recente já assumiu a pintura
      const numero = setup.showNumber ? `<span class="slide-num">${atual + 1}</span>` : "";
      stage.innerHTML = `<section class="slide layout-${slide.layout}">${sanitize(String(html))}${numero}</section>`;
    }
    contador.textContent = `${atual + 1} / ${ordem.length}`;
    notas.textContent = slide.notes;
    notas.hidden = !mostrarNotas || !slide.notes;
  };
  void pintar();

  const irPara = (pos: number) => {
    if (digitos) limparDigitos(); // navegar (tecla ou clique) cancela o número pendente
    const proximo = Math.min(Math.max(0, pos), ordem.length - 1);
    if (proximo === atual) return;
    atual = proximo;
    void pintar();
  };
  const ir = (passo: number) => irPara(atual + passo);

  const limparDigitos = () => {
    digitos = "";
    goto.hidden = true;
  };
  const mostrarDigitos = () => {
    goto.textContent = `ir para lâmina ${digitos}`;
    goto.hidden = false;
  };
  const limparTela = () => {
    telaCor = null;
    tela.hidden = true;
    tela.classList.remove("preta", "branca");
  };
  const mostrarTela = (cor: "preta" | "branca") => {
    // a mesma tecla desliga a tela; a outra tecla troca a cor
    if (telaCor === cor) {
      limparTela();
      return;
    }
    telaCor = cor;
    tela.hidden = false;
    tela.classList.toggle("preta", cor === "preta");
    tela.classList.toggle("branca", cor === "branca");
  };

  const fechar = () => {
    document.removeEventListener("keydown", onKey, true);
    overlay.remove();
    document.body.classList.remove("apresentando");
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return; // atalhos do sistema (Ctrl+P etc.) passam direto
    const tecla = e.key.toLowerCase();
    // tela preta/branca: B e W alternam; qualquer outra tecla volta para a lâmina
    if (telaCor) {
      e.preventDefault();
      if (tecla === "b") mostrarTela("preta");
      else if (tecla === "w") mostrarTela("branca");
      else limparTela();
      return;
    }
    if (e.key === "Escape") {
      e.preventDefault();
      if (digitos) limparDigitos(); // o primeiro Esc cancela o número digitado
      else fechar();
      return;
    }
    if (/^\d$/.test(e.key)) {
      e.preventDefault();
      digitos += e.key;
      mostrarDigitos();
      return;
    }
    if (digitos) {
      if (e.key === "Enter") {
        e.preventDefault();
        irPara(Number(digitos) - 1); // "0" cai na primeira; acima do total, na última
        limparDigitos();
        return;
      }
      if (e.key === "Backspace") {
        e.preventDefault();
        digitos = digitos.slice(0, -1);
        if (digitos) mostrarDigitos();
        else limparDigitos();
        return;
      }
      limparDigitos(); // qualquer outra tecla cancela o número pendente
    }
    if (tecla === "n") {
      mostrarNotas = !mostrarNotas;
      notas.hidden = !mostrarNotas || !deck.slides[ordem[atual]].notes;
      return;
    }
    if (tecla === "b") {
      mostrarTela("preta");
      return;
    }
    if (tecla === "w") {
      mostrarTela("branca");
      return;
    }
    if (e.key === "Home") {
      e.preventDefault();
      irPara(0);
      return;
    }
    if (e.key === "End") {
      e.preventDefault();
      irPara(ordem.length - 1);
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
    if (telaCor) {
      limparTela(); // clique volta da tela preta/branca
      return;
    }
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
