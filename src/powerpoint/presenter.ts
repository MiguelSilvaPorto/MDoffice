// A tela de apresentação (modo tela cheia, F5). Recebe o modelo do deck e desenha
// uma lâmina por vez. Também é a porta de entrada que o App chama para apresentar
// um documento Markdown qualquer — por isso concentra openPresentation/deckSummary.
import { marked } from "marked";
import DOMPurify from "dompurify";
import { direcaoDe, duracaoDe } from "./edicao/transicao";
import { deckFromMarkdown } from "./markdown";
import { DEFAULT_SETUP, stageRatio } from "./model";
import { THEME_COLORS } from "./schema";
import type { Deck, DeckSetup, Slide, Transicao, TransicaoTipo } from "./schema";
import { fundoValor } from "./render/forma";
import { iniciarAnimacoes, type ControleAnimacoes } from "./render/animacao";
import { toast } from "../util";

marked.setOptions({ gfm: true, breaks: false });

function sanitize(html: string): string {
  return DOMPurify.sanitize(html, { ADD_ATTR: ["target", "rel"] });
}

/** Lâmina oculta (`show === false`) fica de fora da apresentação. O campo ainda
 *  pode não existir no modelo, por isso a checagem é `=== false` (não `!slide.show`). */
function oculta(slide: Slide): boolean {
  return (slide as Slide & { show?: boolean }).show === false;
}

/** Ferramenta de tinta da apresentação. */
type FerramentaTinta = "caneta" | "marca" | "borracha";

/**
 * Traço da caneta/marca-texto: pontos NORMALIZADOS (0..1) na lâmina, para o traço sobreviver
 * ao zoom e ao redimensionamento da janela (o canvas é redesenhado no tamanho novo).
 */
interface Traco {
  cor: string;
  /** fração da largura da lâmina (o traço não engrossa quando o canvas cresce) */
  largura: number;
  alpha: number;
  pontos: { x: number; y: number }[];
}

/** Abre o modo apresentação. Setas/Espaço/Enter/clique avançam, Backspace volta,
 *  Home/End vão à primeira/última lâmina, digitar um número e Enter pula direto
 *  para a lâmina, B/W alternam tela preta/branca, N mostra/oculta as notas, Esc
 *  sai. Ctrl+P imprime uma lâmina por página (PDF). Lâminas ocultas não aparecem. */
export function openDeckView(deck: Deck, setup: DeckSetup = DEFAULT_SETUP, titulo?: string, desenharFormas?: (slide: Slide) => string): void {
  if (!deck.slides.length) {
    toast("Este documento não tem conteúdo para apresentar — separe as lâminas com uma linha de três traços (---).", "info", 5600);
    return;
  }
  // a apresentação anda pela ordem das lâminas visíveis: `atual` é a posição nessa
  // lista (e é o número que a barra mostra), não o índice em deck.slides
  const ordem = deck.slides.map((_, i) => i).filter((i) => !oculta(deck.slides[i]));
  if (!ordem.length) {
    toast("Todas as lâminas estão ocultas — mostre ao menos uma para usar o modo apresentação.", "info", 5600);
    return;
  }
  const overlay = document.createElement("div");
  overlay.className = `slides-overlay tema-${setup.theme}`;
  overlay.innerHTML = `
    <div class="slides-stage" data-stage></div>
    <div class="slides-grade" data-grade hidden></div>
    <div class="slides-laser" data-laser hidden></div>
    <div class="slides-notes" data-notes hidden></div>
    <div class="slides-tela" data-tela hidden></div>
    <div class="slides-hud" data-hud>
      <i class="slides-progress"><b data-prog></b></i>
      <div class="slides-linha">
        <span class="slides-title" data-title></span>
        <span class="slides-nav">
          <button class="sl-btn" data-nav="prev" title="Lâmina anterior (←)" aria-label="Lâmina anterior">‹</button>
          <button class="sl-btn sl-contador" data-tool="grade" title="Ver todas as lâminas (G)" aria-label="Grade de lâminas"><span data-count></span></button>
          <button class="sl-btn" data-nav="next" title="Próxima lâmina (→)" aria-label="Próxima lâmina">›</button>
        </span>
        <span class="slides-goto" data-goto hidden></span>
        <span class="slides-espaco"></span>
        <span class="slides-tools">
          <button class="sl-btn" data-tool="caneta" title="Caneta para marcar a lâmina durante a fala (P)">Caneta</button>
          <button class="sl-btn" data-tool="marca" title="Marca-texto (H)">Marca</button>
          <button class="sl-btn" data-tool="borracha" title="Borracha: passe por cima do traço (E)">Borracha</button>
          <button class="sl-btn sl-zoom" data-tool="zoom" title="Zoom da apresentação — clique para voltar a 100%" hidden>100%</button>
          <button class="sl-btn" data-tool="tempo" title="Mostrar o tempo decorrido (T)"><span data-relogio hidden>00:00</span><span data-relogio-off>Tempo</span></button>
          <button class="sl-btn" data-tool="notas" title="Notas do apresentador (N)">Notas</button>
          <button class="sl-btn" data-tool="tela" title="Tela preta (B) ou branca (W)">Tela</button>
          <button class="sl-btn" data-tool="ajuda" title="Atalhos do teclado (?)">?</button>
          <button class="sl-btn sl-sair" data-close title="Encerrar a apresentação (Esc)">Encerrar</button>
        </span>
      </div>
      <div class="slides-ajuda" data-ajuda hidden>
        <b>Atalhos</b>
        <span>← → ↑ ↓ / PgUp PgDn / clique / roda navega</span>
        <span>nº + Enter vai para a lâmina</span>
        <span>B/W tela preta ou branca</span>
        <span>N notas · G grade de lâminas · T tempo</span>
        <span>segure L (ou Ctrl) para o laser</span>
        <span>+ / − dá zoom · Z (ou Esc) volta a 100% · Ctrl+roda dá zoom onde o mouse está</span>
        <span>com zoom, arrastar move a tela</span>
        <span>P caneta · H marca-texto · E borracha (Shift+E limpa) · Esc sai da ferramenta</span>
        <span>botão direito volta · Esc encerra</span>
      </div>
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
  const prog = overlay.querySelector<HTMLElement>("[data-prog]")!;
  const grade = overlay.querySelector<HTMLElement>("[data-grade]")!;
  const laser = overlay.querySelector<HTMLElement>("[data-laser]")!;
  const ajuda = overlay.querySelector<HTMLElement>("[data-ajuda]")!;
  const relogio = overlay.querySelector<HTMLElement>("[data-relogio]")!;
  const relogioOff = overlay.querySelector<HTMLElement>("[data-relogio-off]")!;
  let atual = 0;
  let mostrarNotas = false;
  let inicioEm = Date.now(); // relógio da apresentação (o "Tempo")
  let relogioLigado = false;
  let relogioTimer = 0;
  let ociosoTimer = 0; // esconde o HUD e o cursor depois de um tempo sem mexer
  let laserOn = false;
  let gradeAberta = false;
  let digitos = ""; // número sendo digitado para "ir para a lâmina"
  let telaCor: "preta" | "branca" | null = null; // tela preta/branca (B/W)
  let pinturaSeq = 0; // marked é assíncrono: uma pintura antiga não pode sobrescrever a nova
  let encerrarAtual: (() => void) | null = null; // transição de lâmina em andamento
  let anim: ControleAnimacoes | null = null; // animações de forma da lâmina atual

  // ---- zoom e tinta (caneta/marca-texto/borracha) ----
  // O zoom é o da LÂMINA: `k` de 1 a 6, com a origem em (x%, y%) — o ponto sob a origem fica
  // parado ao ampliar, e é isso que faz "dar zoom onde o mouse está" funcionar.
  let zoomK = 1;
  let zoomX = 50;
  let zoomY = 50;
  let ferramenta: FerramentaTinta | null = null;
  const tintas = new Map<number, Traco[]>(); // por lâmina (índice no deck): a marcação fica
  let tracoAtual: Traco | null = null;
  let pan: { x: number; y: number; ox: number; oy: number; moveu: boolean } | null = null;
  let engolirClique = false; // um arrasto de panorama não pode virar "avança a lâmina"
  let ultimoPonteiro = { x: 0, y: 0 };

  rotulo.textContent = titulo || deck.titulo;
  if (setup.footer) rotulo.textContent += ` · ${setup.footer}`;

  // ---- mídia (áudio/vídeo) ----
  // Cada lâmina nova recria o palco; os players com `continuar` são movidos para um "bolso"
  // (o nó continua vivo, tocando) e voltam ao palco quando a lâmina deles aparece de novo.
  const midiasNoBolso = new Map<string, HTMLMediaElement>();
  const soltarMidias = () => {
    for (const el of stage.querySelectorAll<HTMLMediaElement>("[data-midia-id]")) {
      const id = el.dataset.midiaId!;
      if (el.dataset.continuar === "1") {
        midiasNoBolso.set(id, el);
        el.remove();
      } else {
        el.pause();
      }
    }
  };
  const tocarMidias = () => {
    for (const el of stage.querySelectorAll<HTMLMediaElement>("[data-midia-id]")) {
      const id = el.dataset.midiaId!;
      const salvo = midiasNoBolso.get(id);
      if (salvo && salvo !== el) {
        // o player que já estava tocando volta no lugar do marcador (posição preservada)
        el.replaceWith(salvo);
        midiasNoBolso.delete(id);
        continue;
      }
      const vol = Number(el.dataset.vol ?? "1");
      el.volume = Number.isFinite(vol) ? Math.max(0, Math.min(1, vol)) : 1;
      const ini = Number(el.dataset.ini ?? "0");
      const fim = el.dataset.fim ? Number(el.dataset.fim) : null;
      const posiciona = () => {
        try {
          el.currentTime = ini;
        } catch {
          /* vídeo sem metadados ainda */
        }
      };
      if (ini > 0.05) {
        if (el.readyState >= 1) posiciona();
        else el.addEventListener("loadedmetadata", posiciona, { once: true });
      }
      if (fim !== null && Number.isFinite(fim)) {
        el.addEventListener("timeupdate", () => {
          if (el.currentTime >= fim) {
            if (el.loop) posiciona();
            else el.pause();
          }
        });
      }
      if (el.dataset.auto === "1") void el.play().catch(() => {});
    }
  };

  /** Monta o conteúdo de uma lâmina num elemento próprio (o palco só troca as camadas). */
  const conteudoDa = async (slide: Slide, pos = atual): Promise<HTMLElement> => {
    const secao = document.createElement("section");
    // lâmina com formas (importada de .pptx ou montada no palco): desenha as formas, como no palco, em escala cheia
    if (slide.shapes.length && desenharFormas) {
      secao.className = "slide-rica";
      // fundo da lâmina; sem fundo próprio, vale o do tema do deck (senão o texto claro
      // do tema escuro sumiria no branco do palco)
      const fundo = fundoValor(slide.bg, setup.media ?? {}) || `#${THEME_COLORS[setup.theme]?.bg ?? "FFFFFF"}`;
      secao.style.background = fundo;
      secao.innerHTML = desenharFormas(slide);
      return secao;
    }
    const html = await marked.parse(slide.md, { gfm: true, async: true });
    secao.className = `slide layout-${slide.layout}`;
    secao.innerHTML = sanitize(String(html)) + (setup.showNumber ? `<span class="slide-num">${pos + 1}</span>` : "");
    return secao;
  };

  /** Movimento reduzido no sistema: troca direta, sem animação. */
  const semMovimento = (): boolean => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;

  /** Encerra a transição em andamento (a lâmina que saiu some na hora). */
  const encerrarTransicao = (): void => {
    const fim = encerrarAtual;
    encerrarAtual = null;
    fim?.();
  };

  const animacaoDe = (tipo: TransicaoTipo, entra: boolean): string | null => {
    if (tipo === "fade") return entra ? "anim-fade-entra" : "anim-fade-sai";
    if (tipo === "push") return entra ? "anim-desliza-entra" : "anim-desliza-sai";
    if (tipo === "cover") return entra ? "anim-desliza-entra" : null; // a antiga fica parada
    if (tipo === "uncover") return entra ? null : "anim-desliza-sai"; // a nova já está no lugar
    if (tipo === "wipe") return entra ? "anim-wipe-entra" : null;
    if (tipo === "split") return entra ? "anim-split-entra" : null;
    return null;
  };

  /**
   * Troca o conteúdo do palco. Com transição, a lâmina que sai fica numa camada por baixo e a que
   * entra anima por cima (as animações estão em styles/slides.css). Uma transição nova cancela a anterior.
   * Devolve a camada nova e quanto a transição vai durar (as animações de forma começam depois).
   */
  const mostrar = (novo: HTMLElement, t?: Transicao): { camada: HTMLElement; transicaoMs: number } => {
    encerrarTransicao();
    const saindo = stage.querySelector<HTMLElement>(".slides-camada.entrando");
    const camada = document.createElement("div");
    camada.className = "slides-camada entrando";
    camada.append(novo);
    if (!saindo || !t || t.tipo === "none" || semMovimento()) {
      stage.replaceChildren(camada);
      return { camada, transicaoMs: 0 };
    }
    const ms = Math.round(duracaoDe(t) * 1000);
    const dir = direcaoDe(t);
    const anima = (el: HTMLElement, entra: boolean) => {
      const nome = animacaoDe(t.tipo, entra);
      el.style.setProperty("--trans-dur", `${ms}ms`);
      el.classList.add(`trans-${dir}`);
      if (nome) el.classList.add(nome);
    };
    saindo.classList.replace("entrando", "saindo");
    anima(saindo, false);
    anima(camada, true);
    stage.replaceChildren(saindo, camada);
    const fim = () => {
      saindo.remove();
      camada.className = "slides-camada entrando";
      camada.style.removeProperty("--trans-dur");
    };
    const relogio = window.setTimeout(() => {
      encerrarAtual = null;
      fim();
    }, ms + 120);
    encerrarAtual = () => {
      window.clearTimeout(relogio);
      fim();
    };
    return { camada, transicaoMs: ms };
  };

  const pintar = async (animar = false): Promise<void> => {
    const seq = ++pinturaSeq;
    const slide = deck.slides[ordem[atual]];
    const conteudo = await conteudoDa(slide);
    if (seq !== pinturaSeq) return; // uma troca mais recente já assumiu a pintura
    soltarMidias();
    const { camada, transicaoMs } = mostrar(conteudo, animar ? slide.transicao : undefined);
    // lâmina nova começa sem zoom; a tinta que já existe para ela é redesenhada no canvas novo
    zoomK = 1;
    zoomX = 50;
    zoomY = 50;
    aplicarZoom();
    prepararTinta();
    // animações de forma: entram depois da transição (ou na hora, se não houver)
    anim = iniciarAnimacoes(camada, slide.animacoes, { atrasoMs: transicaoMs });
    tocarMidias();
    contador.textContent = `${atual + 1} / ${ordem.length}`;
    prog.style.width = `${((atual + 1) / ordem.length) * 100}%`;
    notas.textContent = slide.notes || "— esta lâmina não tem notas —";
    notas.hidden = !mostrarNotas;
  };
  void pintar();

  const irPara = (pos: number) => {
    if (digitos) limparDigitos(); // navegar (tecla ou clique) cancela o número pendente
    const proximo = Math.min(Math.max(0, pos), ordem.length - 1);
    if (proximo === atual) return;
    atual = proximo;
    // a transição é a da lâmina que está ENTRANDO
    void pintar(true);
  };
  const ir = (passo: number) => {
    // o clique primeiro toca o próximo efeito "ao clicar" da lâmina; só depois troca de lâmina
    if (passo > 0 && anim?.proximo()) return;
    irPara(atual + passo);
  };

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
    acordar();
  };

  // ---- HUD: notas, tempo, grade, laser e o descanso da barra ----

  /** Mostra a barra (e o cursor); sem mexer por um tempo, esconde os dois. */
  const acordar = (): void => {
    overlay.classList.remove("ocioso");
    window.clearTimeout(ociosoTimer);
    if (gradeAberta || telaCor || !ajuda.hidden) return; // com um painel aberto a barra fica
    ociosoTimer = window.setTimeout(() => overlay.classList.add("ocioso"), 2600);
  };

  const alternarNotas = (): void => {
    mostrarNotas = !mostrarNotas;
    notas.hidden = !mostrarNotas;
    overlay.querySelector('[data-tool="notas"]')?.classList.toggle("on", mostrarNotas);
    acordar();
  };

  const alternarAjuda = (): void => {
    ajuda.hidden = !ajuda.hidden;
    overlay.querySelector('[data-tool="ajuda"]')?.classList.toggle("on", !ajuda.hidden);
    acordar();
  };

  // Tempo (T): conta desde a abertura da apresentação
  const doisDigitos = (n: number): string => String(n).padStart(2, "0");
  const atualizarRelogio = (): void => {
    const s = Math.floor((Date.now() - inicioEm) / 1000);
    relogio.textContent = `${doisDigitos(Math.floor(s / 60))}:${doisDigitos(s % 60)}`;
  };
  const alternarTempo = (): void => {
    relogioLigado = !relogioLigado;
    relogio.hidden = !relogioLigado;
    relogioOff.hidden = relogioLigado;
    window.clearInterval(relogioTimer);
    if (relogioLigado) {
      atualizarRelogio();
      relogioTimer = window.setInterval(atualizarRelogio, 1000);
    }
    overlay.querySelector('[data-tool="tempo"]')?.classList.toggle("on", relogioLigado);
    acordar();
  };

  // Laser: um ponto vermelho segue o mouse enquanto L (ou Ctrl) estiver pressionado
  const ligarLaser = (ligado: boolean): void => {
    if (laserOn === ligado) return;
    laserOn = ligado;
    laser.hidden = !ligado;
  };
  const moverLaser = (x: number, y: number): void => {
    laser.style.transform = `translate(${x}px, ${y}px)`;
  };

  // ---- zoom da lâmina ----

  /** A seção da lâmina na camada que está entrando (recebe o zoom e a tinta). */
  const secaoAtual = (): HTMLElement | null =>
    stage.querySelector<HTMLElement>(".slides-camada.entrando > section") ??
    stage.querySelector<HTMLElement>(".slides-camada > section");

  const aplicarZoom = (): void => {
    const sec = secaoAtual();
    if (sec) {
      if (zoomK <= 1.001) {
        sec.style.removeProperty("transform");
        sec.style.removeProperty("transform-origin");
      } else {
        sec.style.transform = `scale(${zoomK})`;
        sec.style.transformOrigin = `${zoomX}% ${zoomY}%`;
      }
    }
    const chip = overlay.querySelector<HTMLElement>('[data-tool="zoom"]');
    if (chip) {
      chip.hidden = zoomK <= 1.001;
      chip.textContent = `${Math.round(zoomK * 100)}%`;
    }
  };

  const mudarZoom = (k: number, ox = zoomX, oy = zoomY): void => {
    zoomK = Math.min(6, Math.max(1, k));
    zoomX = Math.min(100, Math.max(0, ox));
    zoomY = Math.min(100, Math.max(0, oy));
    if (zoomK <= 1.001) {
      zoomX = 50;
      zoomY = 50;
    }
    aplicarZoom();
    acordar();
  };

  /** O ponto do ponteiro em % da lâmina (com zoom: o rect já vem transformado). */
  const pontoNaLamina = (x: number, y: number): { x: number; y: number } => {
    const sec = secaoAtual();
    const r = sec?.getBoundingClientRect();
    if (!r || r.width <= 0 || r.height <= 0) return { x: 50, y: 50 };
    return { x: ((x - r.left) / r.width) * 100, y: ((y - r.top) / r.height) * 100 };
  };

  // ---- tinta: caneta, marca-texto e borracha por cima da lâmina ----

  const ESTILO_TINTA: Record<Exclude<FerramentaTinta, "borracha">, { cor: string; largura: number; alpha: number }> = {
    caneta: { cor: "#e11d48", largura: 0.0022, alpha: 1 },
    marca: { cor: "#facc15", largura: 0.009, alpha: 0.35 },
  };

  const desenharTinta = (): void => {
    const cv = secaoAtual()?.querySelector<HTMLCanvasElement>("canvas.slides-tinta");
    if (!cv) return;
    const ctx2 = cv.getContext("2d");
    if (!ctx2) return;
    ctx2.clearRect(0, 0, cv.width, cv.height);
    const tracos = [...(tintas.get(ordem[atual]) ?? [])];
    if (tracoAtual) tracos.push(tracoAtual);
    for (const t of tracos) {
      if (!t.pontos.length) continue;
      ctx2.globalAlpha = t.alpha;
      ctx2.strokeStyle = t.cor;
      ctx2.fillStyle = t.cor;
      ctx2.lineWidth = Math.max(1, t.largura * cv.width);
      ctx2.lineCap = "round";
      ctx2.lineJoin = "round";
      const p0 = t.pontos[0];
      if (t.pontos.length === 1) {
        // um toque vira um ponto (sem ele, um clique sozinho não apareceria)
        ctx2.beginPath();
        ctx2.arc(p0.x * cv.width, p0.y * cv.height, Math.max(1, ctx2.lineWidth / 2), 0, Math.PI * 2);
        ctx2.fill();
        continue;
      }
      ctx2.beginPath();
      t.pontos.forEach((p, i) => (i === 0 ? ctx2.moveTo(p.x * cv.width, p.y * cv.height) : ctx2.lineTo(p.x * cv.width, p.y * cv.height)));
      ctx2.stroke();
    }
    ctx2.globalAlpha = 1;
  };

  /** Garante o canvas da lâmina atual (tamanho em px da lâmina × densidade da tela). */
  const prepararTinta = (): void => {
    const sec = secaoAtual();
    if (!sec) return;
    let cv = sec.querySelector<HTMLCanvasElement>("canvas.slides-tinta");
    if (!cv) {
      cv = document.createElement("canvas");
      cv.className = "slides-tinta";
      sec.append(cv);
    }
    const r = sec.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.max(2, Math.round(r.width * dpr));
    const h = Math.max(2, Math.round(r.height * dpr));
    if (cv.width !== w || cv.height !== h) {
      cv.width = w;
      cv.height = h;
    }
    desenharTinta();
  };

  const definirFerramenta = (t: FerramentaTinta | null): void => {
    ferramenta = ferramenta === t ? null : t;
    overlay.classList.toggle("com-tinta", !!ferramenta);
    for (const nome of ["caneta", "marca", "borracha"] as const) {
      overlay.querySelector(`[data-tool="${nome}"]`)?.classList.toggle("on", ferramenta === nome);
    }
    prepararTinta();
    acordar();
  };

  const pontoNoCanvas = (cv: HTMLCanvasElement, e: PointerEvent): { x: number; y: number } => {
    const r = cv.getBoundingClientRect();
    return { x: (e.clientX - r.left) / Math.max(1, r.width), y: (e.clientY - r.top) / Math.max(1, r.height) };
  };

  /** Borracha: some com os traços que passarem perto do ponto (raio em fração da lâmina). */
  const apagarPerto = (p: { x: number; y: number }): void => {
    const lista = tintas.get(ordem[atual]);
    if (!lista?.length) return;
    const raio = 0.02;
    const restantes = lista.filter((t) => !t.pontos.some((q) => Math.hypot(q.x - p.x, q.y - p.y) < raio));
    if (restantes.length !== lista.length) {
      tintas.set(ordem[atual], restantes);
      desenharTinta();
    }
  };

  /**
   * Grade de lâminas (G): miniaturas para pular direto. Cada célula é o PRÓPRIO conteúdo
   * desenhado no tamanho do palco e reduzido por transform — fiel, sem thumbnail separado.
   */
  const fecharGrade = (): void => {
    gradeAberta = false;
    grade.hidden = true;
    grade.textContent = "";
    acordar();
  };
  const abrirGrade = (): void => {
    if (gradeAberta) {
      fecharGrade();
      return;
    }
    gradeAberta = true;
    grade.hidden = false;
    acordar();
    const caixa = document.createElement("div");
    caixa.className = "slides-grade-caixa";
    grade.append(caixa);
    const larguraPalco = stage.clientWidth || window.innerWidth;
    const alturaPalco = stage.clientHeight || window.innerHeight;
    const ratio = stageRatio(setup);
    const larguraSlide = Math.min(larguraPalco, alturaPalco * ratio);
    const alturaSlide = larguraSlide / ratio;
    const k = 220 / larguraSlide; // cada miniatura fica com ~220px de largura
    ordem.forEach((idx, pos) => {
      const cel = document.createElement("button");
      cel.type = "button";
      cel.className = `slides-cel${pos === atual ? " on" : ""}`;
      cel.title = `Lâmina ${pos + 1}`;
      const moldura = document.createElement("span");
      moldura.className = "slides-cel-moldura";
      moldura.style.width = `${Math.round(larguraSlide * k)}px`;
      moldura.style.height = `${Math.round(alturaSlide * k)}px`;
      const dentro = document.createElement("span");
      dentro.className = "slides-cel-conteudo";
      dentro.style.width = `${larguraSlide}px`;
      dentro.style.height = `${alturaSlide}px`;
      dentro.style.transform = `scale(${k})`;
      moldura.append(dentro);
      const numero = document.createElement("b");
      numero.textContent = String(pos + 1);
      cel.append(moldura, numero);
      cel.addEventListener("click", (e) => {
        e.stopPropagation();
        fecharGrade();
        irPara(pos);
      });
      caixa.append(cel);
      void conteudoDa(deck.slides[idx], pos).then((el) => {
        if (gradeAberta) dentro.append(el);
      });
    });
  };

  const fechar = () => {
    document.removeEventListener("keydown", onKey, true);
    document.removeEventListener("keyup", onKeyUp, true);
    window.removeEventListener("resize", aoRedimensionar);
    window.clearInterval(relogioTimer);
    window.clearTimeout(ociosoTimer);
    encerrarTransicao();
    anim?.cancelar();
    anim = null;
    for (const el of stage.querySelectorAll<HTMLMediaElement>("audio,video")) el.pause();
    for (const el of midiasNoBolso.values()) el.pause();
    overlay.remove();
    document.body.classList.remove("apresentando");
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.ctrlKey || e.metaKey || e.altKey) {
      // Ctrl (ou Cmd) segurado vira laser; o resto passa direto (Ctrl+P imprime etc.)
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "l") ligarLaser(true);
      return;
    }
    const tecla = e.key.toLowerCase();
    acordar();
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
      if (gradeAberta) fecharGrade(); // primeiro o painel aberto...
      else if (!ajuda.hidden) alternarAjuda();
      else if (ferramenta) definirFerramenta(null); // ...a ferramenta de tinta...
      else if (zoomK > 1.001) mudarZoom(1, 50, 50); // ...o zoom...
      else if (digitos) limparDigitos(); // ...depois o número digitado...
      else fechar(); // ...e só então a apresentação
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
    // ---- zoom e tinta ----
    if (e.key === "+" || e.key === "=") {
      e.preventDefault();
      const p = pontoNaLamina(ultimoPonteiro.x, ultimoPonteiro.y);
      mudarZoom(zoomK * 1.25, p.x, p.y);
      return;
    }
    if (e.key === "-" || e.key === "_") {
      e.preventDefault();
      const p = pontoNaLamina(ultimoPonteiro.x, ultimoPonteiro.y);
      mudarZoom(zoomK / 1.25, p.x, p.y);
      return;
    }
    if (tecla === "z") {
      mudarZoom(1, 50, 50);
      return;
    }
    if (tecla === "p") {
      definirFerramenta("caneta");
      return;
    }
    if (tecla === "h") {
      definirFerramenta("marca");
      return;
    }
    if (tecla === "e") {
      if (e.shiftKey) {
        tintas.delete(ordem[atual]); // Shift+E limpa a marcação da lâmina
        desenharTinta();
        acordar();
      } else {
        definirFerramenta("borracha");
      }
      return;
    }
    if (tecla === "n") {
      alternarNotas();
      return;
    }
    if (tecla === "g") {
      abrirGrade();
      return;
    }
    if (tecla === "t") {
      alternarTempo();
      return;
    }
    if (tecla === "?") {
      alternarAjuda();
      return;
    }
    if (tecla === "l") {
      ligarLaser(true);
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
  const onKeyUp = (e: KeyboardEvent): void => {
    if (e.key.toLowerCase() === "l" || e.key === "Control" || e.key === "Meta") ligarLaser(false);
  };
  document.addEventListener("keydown", onKey, true);
  document.addEventListener("keyup", onKeyUp, true);

  // botões do HUD: nenhum deles navega
  const botao = (sel: string, fn: () => void): void => {
    overlay.querySelectorAll<HTMLElement>(sel).forEach((b) =>
      b.addEventListener("click", (e) => {
        e.stopPropagation();
        fn();
      })
    );
  };
  botao('[data-nav="prev"]', () => ir(-1));
  botao('[data-nav="next"]', () => ir(1));
  botao('[data-tool="caneta"]', () => definirFerramenta("caneta"));
  botao('[data-tool="marca"]', () => definirFerramenta("marca"));
  botao('[data-tool="borracha"]', () => definirFerramenta("borracha"));
  botao('[data-tool="zoom"]', () => mudarZoom(1, 50, 50)); // clique no % volta a 100%
  botao('[data-tool="grade"]', abrirGrade);
  botao('[data-tool="tempo"]', alternarTempo);
  botao('[data-tool="notas"]', alternarNotas);
  botao('[data-tool="tela"]', () => mostrarTela("preta"));
  botao('[data-tool="ajuda"]', alternarAjuda);
  botao("[data-close]", fechar);

  overlay.addEventListener("click", (e) => {
    const alvo = e.target as HTMLElement;
    if (engolirClique) {
      engolirClique = false; // o arrasto de panorama terminou aqui: não navega
      return;
    }
    if (ferramenta) return; // com uma ferramenta ativa o clique é do desenho, não da navegação
    if (alvo.closest(".slides-hud, .slides-grade, .slides-notes")) return; // o clique é dos controles
    if (telaCor) {
      limparTela(); // clique volta da tela preta/branca
      return;
    }
    if (alvo.closest("a")) return;
    if (alvo.closest("audio,video")) return; // controles da mídia: o clique é do player
    ir(1);
  });
  // botão direito volta uma lâmina (o menu do sistema não abre)
  overlay.addEventListener("contextmenu", (e) => {
    e.preventDefault();
    if (ferramenta) return; // desenhando, o botão direito não navega (evita voltar sem querer)
    const alvo = e.target as HTMLElement;
    if (alvo.closest(".slides-hud, .slides-grade, .slides-notes, audio, video")) return;
    if (telaCor) {
      limparTela();
      return;
    }
    ir(-1);
  });
  // roda do mouse navega (2% de delta acumulado? não: um passo por evento, como nas setas)
  overlay.addEventListener(
    "wheel",
    (e) => {
      const alvo = e.target as HTMLElement;
      if (telaCor || alvo.closest(".slides-hud, .slides-grade, .slides-notes")) return;
      e.preventDefault();
      acordar();
      // Ctrl+roda dá zoom NO PONTO do mouse (a roda sozinha navega, como nas setas)
      if (e.ctrlKey || e.metaKey) {
        const p = pontoNaLamina(e.clientX, e.clientY);
        mudarZoom(zoomK * (e.deltaY < 0 ? 1.15 : 1 / 1.15), p.x, p.y);
        return;
      }
      ir(e.deltaY > 0 ? 1 : -1);
    },
    { passive: false }
  );

  // ponteiro: desenhar (com ferramenta), apagar (borracha) ou mover a tela (com zoom)
  overlay.addEventListener("pointerdown", (e) => {
    if (e.button !== 0) return;
    const alvo = e.target as HTMLElement;
    if (alvo.closest(".slides-hud, .slides-grade, .slides-notes")) return;
    if (telaCor) return;
    ultimoPonteiro = { x: e.clientX, y: e.clientY };
    if (alvo instanceof HTMLCanvasElement && alvo.classList.contains("slides-tinta")) {
      if (ferramenta === "borracha") {
        overlay.dataset.apagando = "1";
        apagarPerto(pontoNoCanvas(alvo, e));
        e.preventDefault();
        return;
      }
      if (ferramenta) {
        tracoAtual = { ...ESTILO_TINTA[ferramenta], pontos: [pontoNoCanvas(alvo, e)] };
        alvo.setPointerCapture(e.pointerId);
        desenharTinta();
        e.preventDefault();
      }
      return;
    }
    // sem ferramenta e com zoom: arrastar move a tela (o clique parado continua avançando)
    if (zoomK > 1.001) {
      pan = { x: e.clientX, y: e.clientY, ox: zoomX, oy: zoomY, moveu: false };
      overlay.setPointerCapture(e.pointerId);
      e.preventDefault();
    }
  });
  overlay.addEventListener("pointermove", (e) => {
    ultimoPonteiro = { x: e.clientX, y: e.clientY };
    const alvo = e.target as HTMLElement;
    const noCanvas = alvo instanceof HTMLCanvasElement && alvo.classList.contains("slides-tinta");
    if (tracoAtual && noCanvas) {
      tracoAtual.pontos.push(pontoNoCanvas(alvo as HTMLCanvasElement, e));
      desenharTinta();
      return;
    }
    if (ferramenta === "borracha" && overlay.dataset.apagando === "1" && noCanvas) {
      apagarPerto(pontoNoCanvas(alvo as HTMLCanvasElement, e));
      return;
    }
    if (pan) {
      const dx = e.clientX - pan.x;
      const dy = e.clientY - pan.y;
      if (!pan.moveu && Math.abs(dx) + Math.abs(dy) > 4) pan.moveu = true;
      if (!pan.moveu) return;
      const r = secaoAtual()?.getBoundingClientRect();
      if (r && r.width > 0) {
        // mover o conteúdo por (dx, dy) px = deslocar a origem na fração correspondente
        mudarZoom(zoomK, pan.ox - (dx / (r.width * zoomK)) * 100, pan.oy - (dy / (r.height * zoomK)) * 100);
      }
    }
  });
  const soltarPonteiro = (): void => {
    if (tracoAtual) {
      const lista = tintas.get(ordem[atual]) ?? [];
      lista.push(tracoAtual);
      tintas.set(ordem[atual], lista);
      tracoAtual = null;
      desenharTinta();
    }
    if (pan) {
      engolirClique = pan.moveu; // o arrasto de panorama não pode virar "avança a lâmina"
      pan = null;
    }
    delete overlay.dataset.apagando;
  };
  overlay.addEventListener("pointerup", soltarPonteiro);
  overlay.addEventListener("pointercancel", soltarPonteiro);

  const aoRedimensionar = (): void => {
    prepararTinta(); // a lâmina mudou de tamanho: o canvas da tinta acompanha
  };
  window.addEventListener("resize", aoRedimensionar);
  overlay.addEventListener("mousemove", (e) => {
    acordar();
    if (laserOn) moverLaser(e.clientX, e.clientY);
  });
  acordar();
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
