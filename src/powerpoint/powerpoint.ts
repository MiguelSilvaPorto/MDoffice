// Liga o motor de apresentações à tela: palco, fita, painel de formatação, notas, zoom e o editor de texto.
// O App só conversa com esta classe; o resto do motor fica dentro de src/powerpoint.
// (mesmo papel do src/word/host.ts)
import { marked } from "marked";
import DOMPurify from "dompurify";
import { $, escapeHtml, toast } from "../util";
import { pedirTexto } from "../dialogoTexto";
import { fluxoParaFormas, lerFluxoMermaid } from "./edicao/mermaid";
import { ligarAjusteAlturaFita, ligarRecolherFita } from "../fita";
import { caixaCentrada, estiloDoDeck, GALERIA, novaCaixaDeTexto, novaForma, novaImagem, type EstiloDeck, type ItemGaleria } from "./edicao/criar";
import { dicaDoTraco, formaDoTraco, type Pincel } from "./edicao/desenho";
import { ajustarCor, CANTOS, comAjuste, comCantos, comLinha, comOpacidade, comPreenchimento, comRaioDeCanto, comSombra, gradiente, SOMBRAS_PRONTAS, solido, corPrincipal, type Canto } from "./edicao/formato";
import { aspectSize, stageRatio } from "./schema";
import type { Dim } from "./edicao/geometria";
import { Historico } from "./edicao/historico";
import { formasDoLayout, novaLamina } from "./edicao/layouts";
import { migrarSlides, registrarMidia } from "./edicao/migrar";
import { MODELOS, aplicarModelo, type ModeloPPT } from "./edicao/modelos";
import { criarModeloUsuario, lerModelosUsuario, removerModeloUsuario } from "./modelosUsuario";
import {
  agruparFormas,
  alinharFormas,
  colarFormas,
  comGrupos,
  desagruparFormas,
  distribuirFormas,
  duplicarFormas,
  espelharFormas,
  igualarTamanho,
  ordemDasFormas,
  patchFormas,
  removerFormas,
  type ModoAlinhar,
} from "./edicao/operacoes";
import { lerSelecao, restaurarSelecao, textoDaCaixa } from "./edicao/selecaoDom";
import { alternarMarcador, estadoDoTrecho, estiloDosParas, estiloNoIntervalo, limparEstiloNoIntervalo, mudarCaixaTexto, mudarRecuo, mudarTamanhoRelativo, parasDaSelecao, type EstiloRun, type RunPatch, type TipoCaixa } from "./edicao/texto";
import { comTransicao, direcaoDe, duracaoDe, normalizarTransicao, ROTULOS_DIRECAO } from "./edicao/transicao";
import { comAnimacao, comAtraso, comDirecao, comDuracao, comInicio, comPorParagrafo, moverAnimacao, normalizarAnimacoes, paragrafosDe, podarAnimacoes, semAnimacao, suave, TIPOS_ANIMACAO, aceitaDirecaoAnimacao, atrasoDe, direcaoDeAnimacao, duracaoDeAnimacao, inicioDe, formatarDuracao, ROTULOS_ANIMACAO, ROTULOS_INICIO } from "./edicao/animacao";
import { iniciarAnimacoes, type ControleAnimacoes } from "./render/animacao";
import { caixaDaMidia, comCorteDaMidia, comOpcaoMidia, comVolumeDaMidia, midiaPadrao, normalizarMidia, MIDIA_ROTULOS, tipoDeArquivo } from "./edicao/midia";
import { capturarQuadro, cartaoParaPng } from "./render/midia";
import {
  addCategoria,
  addSerie,
  caixaDoGrafico,
  comCores,
  comOpcao,
  comTipo,
  comTitulo,
  delCategoria,
  delSerie,
  GRAFICO_TIPOS,
  graficoPadrao,
  normalizarGrafico,
  paletaDeSeries,
  setCategoria,
  setSerieNome,
  setValor,
} from "./edicao/grafico";
import { DEFAULT_SETUP, deserialize, newSlide, serialize } from "./model";
import { alturaDaLinha, ajustarAoTamanho, alinharVerticalmente, aplicarPreset, bordasCelulas, criarTabela, dividir, excluirColuna, excluirLinha, expandirSelecao, inserirColuna, inserirLinha, larguraDaColuna, mesclar, preencherCelulas, tamanhoTotal, type ModoBorda, type PresetTabela } from "./edicao/tabela";
import { NotesPanel } from "./notes";
import { deckFromMarkdown } from "./markdown";
import { openDeckView } from "./presenter";
import { aoCarregarFontes, fundoValor, htmlFormaRica, parasComEstilo, parasComTexto, registrarFontes, type CtxRender } from "./render/forma";
import { shapeText } from "./shapes";
import { clampIndex, duplicateSlide, moveSlide, removeSlide, replaceSlide, resetSlide, setLayout } from "./slides";
import { Stage, passoZoom, type CelulasSel, type Ferramenta } from "./stage";
import { THEMES, stageVars, themeOf } from "./themes";
import { abrirCores } from "./ui/cores";
import { Fita } from "./ui/fita";
import { Painel } from "./ui/painel";
import { abrirPopup, fecharPopup } from "./ui/popup";
import type { EstadoUI } from "./ui/estado";
import type { Animacao, AnimacaoDirecao, AnimacaoInicio, AnimacaoTipo, Deck, DeckSetup, Fill, GraficoTipo, Para, Shape, ShapeBox, Slide, SlideLayout, TextAlign, Transicao, TransicaoDirecao, TransicaoTipo } from "./schema";

marked.setOptions({ gfm: true, breaks: false });

/** O que o App guarda por aba (serializável, como o WordTabData). */
export interface PowerPointTabData {
  setup: DeckSetup;
  slides: Slide[];
  /** lâmina e forma selecionadas */
  indice: number;
  selecionada: string | null;
}

export interface PowerPointHostOptions {
  pane: HTMLElement;
  /** pede uma imagem ao usuário; `destino` diz o que fazer com ela (inserir, preencher, fundo, trocar) */
  onPickImage?: (destino?: string) => void;
  /** pede um áudio/vídeo ao usuário; `tipo` diz se é "audio" ou "video" (ou "trocar" na troca de arquivo) */
  onPickMedia?: (tipo?: string) => void;
  onConfigure?: () => void;
  onDirty?: () => void;
}

function sanitize(html: string): string {
  return DOMPurify.sanitize(html, { ADD_ATTR: ["target", "rel"] });
}

/** Estado desfazível: as lâminas (imutáveis), a lâmina atual, a seleção e o setup do deck. */
interface Estado {
  slides: Slide[];
  indice: number;
  selecao: string[];
  setup: DeckSetup;
}

/** Formas copiadas (valem entre abas de apresentação). */
let areaDeTransferencia: Shape[] = [];

const lerFlag = (chave: string, padrao: boolean): boolean => {
  try {
    const v = localStorage.getItem(chave);
    return v === null ? padrao : v === "1";
  } catch {
    return padrao;
  }
};
const gravarFlag = (chave: string, v: boolean): void => {
  try {
    localStorage.setItem(chave, v ? "1" : "0");
  } catch {
    /* sem armazenamento */
  }
};

const CHAVE_PINCEL = "mdc.pp.pincel";
/** O pincel do Draw guardado entre sessões (cor, espessura e assistente). */
function lerPincel(): Pincel {
  try {
    const v = JSON.parse(localStorage.getItem(CHAVE_PINCEL) ?? "null") as Partial<Pincel> | null;
    if (v && typeof v === "object") {
      return { cor: typeof v.cor === "string" ? v.cor : "", w: Number(v.w) > 0 ? Number(v.w) : 2, assistente: v.assistente !== false };
    }
  } catch {
    /* sem armazenamento */
  }
  return { cor: "", w: 2, assistente: true };
}
function gravarPincel(p: Pincel): void {
  try {
    localStorage.setItem(CHAVE_PINCEL, JSON.stringify(p));
  } catch {
    /* sem armazenamento */
  }
}

export class PowerPointHost {
  private pane: HTMLElement;
  private opts: PowerPointHostOptions;

  private setup: DeckSetup = { ...DEFAULT_SETUP };
  private slides: Slide[] = [newSlide()];
  private indice = 0;
  private selecao: string[] = [];
  private editando: string | null = null;
  private ferramenta: Ferramenta = null;
  private pincel: Pincel = lerPincel();
  private fixas = false;
  private encaixe = lerFlag("mdc.pp.encaixe", true);
  private grade = lerFlag("mdc.pp.grade", false);
  private faixaVertical = lerFlag("mdc.pp.faixaVertical", false);
  private hist = new Historico<Estado>(100);
  private pendente: Estado | null = null;
  /** prévia das animações de forma em andamento no palco (aba Animações) */
  private animPreview: ControleAnimacoes | null = null;
  private destinoImagem = "inserir";
  private destinoMidia: string | null = null;
  private lateral: "formatar" | "notas" | "animacao" = "formatar";
  /** célula em edição (quando a forma em edição é uma tabela) e células selecionadas */
  private celulaEdit: [number, number] | null = null;
  private celulas: CelulasSel | null = null;
  /** cantos escolhidos para a edição de raio (as alças de canto do palco e o painel) */
  private cantosSel: Canto[] = [...CANTOS];

  private strip!: HTMLElement;
  private canvas!: HTMLElement;
  private frame!: HTMLElement;
  private slideEl!: HTMLElement;
  private notesEl!: HTMLTextAreaElement;

  private fita!: Fita;
  private painel!: Painel;
  private stage: Stage;
  private notes = new NotesPanel();

  constructor(opts: PowerPointHostOptions) {
    this.opts = opts;
    this.pane = opts.pane;
    this.stage = new Stage({
      contexto: () => ({
        shapes: this.atual().shapes,
        dim: this.dim(),
        selecao: this.selecao,
        editando: this.editando,
        ferramenta: this.ferramenta,
        fixasSelecionaveis: this.fixas,
        comGrupos: (ids) => comGrupos(this.atual(), ids),
        celulas: this.celulasDaSelecao(),
        cantosSel: this.cantosSel,
        animacoes: normalizarAnimacoes(this.atual().animacoes) ?? [],
        pincel: this.ferramenta?.tipo === "desenho" ? { cor: this.pincelUsado().cor, w: this.pincel.w } : null,
      }),
      aoSelecionar: (ids) => this.selecionar(ids),
      aoSelecionarCantos: (c) => this.selecionarCantos(c),
      aoTransformar: (patches, fase) => this.aoTransformar(patches, fase),
      aoEditarTexto: (id) => this.entrarEdicao(id),
      aoCriar: (c) => this.aoCriar(c),
      aoDuplicarParaArrastar: () => this.duplicarParaArrastar(),
      aoCelulas: (sel) => this.selecionarCelulas(sel),
      aoTraco: (t) => this.aoTraco(t),
      aoTracoAndamento: (pontos) => this.aoTracoAndamento(pontos),
    });
    this.montar();
    // fonte da web carregou: as medidas de entrelinha mudam, então redesenha (sem derrubar quem está digitando)
    aoCarregarFontes(() => {
      if (!this.editando && !this.stage.arrastando) this.pintar();
    });
    document.addEventListener("keydown", (e) => this.aoTecla(e), true);
    document.addEventListener("paste", (e) => this.aoColarDoSistema(e));
    document.addEventListener("selectionchange", () => {
      if (this.editando) this.atualizarUI();
    });
  }

  // ------------------------------------------------------------------
  // montagem do DOM
  // ------------------------------------------------------------------

  private montar(): void {
    this.pane.innerHTML = `
      <div id="pp-ribbon" class="pp-ribbon ppr" role="toolbar" aria-label="Ferramentas da apresentação"></div>
      <div id="pp-stage">
        <div class="pp-pincel" data-pincel hidden>
          <button type="button" class="pp-pincel-cor" data-pincel-cor title="Cor do traço" aria-label="Cor do traço"></button>
          <span class="pp-pincel-sep"></span>
          <button type="button" class="pp-pincel-w" data-pincel-w="1" title="Traço fino (1 pt)">1</button>
          <button type="button" class="pp-pincel-w" data-pincel-w="2" title="Traço médio (2 pt)">2</button>
          <button type="button" class="pp-pincel-w" data-pincel-w="4" title="Traço grosso (4 pt)">4</button>
          <button type="button" class="pp-pincel-w" data-pincel-w="8" title="Traço bem grosso (8 pt)">8</button>
          <span class="pp-pincel-sep"></span>
          <button type="button" class="pp-pincel-assist" data-pincel-assist title="Assistente: reconhece o traço e ajusta a forma (retângulo, retângulo arredondado, círculo, triângulo, linha e seta)">Assistente</button>
          <span class="pp-pincel-dica" data-pincel-dica></span>
        </div>
        <div class="pp-left">
          <div class="pp-strip" data-strip aria-label="Lâminas"></div>
          <div class="pp-canvas" data-canvas>
            <div class="pp-frame" data-frame>
              <div class="pp-slide" data-slide></div>
            </div>
          </div>
        </div>
        <aside class="pp-side">
          <div class="pp-side-resize" data-side-resize title="Arraste para mudar a largura"></div>
          <div class="pp-side-tabs">
            <button type="button" class="on" data-lateral="formatar">Formatar</button>
            <button type="button" data-lateral="animacao">Animação</button>
            <button type="button" data-lateral="notas">Notas</button>
            <button type="button" class="pp-side-fechar" data-side-toggle title="Esconder o painel" aria-label="Esconder o painel">»</button>
          </div>
          <div class="pp-side-corpo pp-painel" data-formatar></div>
          <div class="pp-side-corpo" data-animacao-corpo hidden>
            <div class="pp-side-head"><span>Animações da lâmina</span><span class="pp-side-hint">na ordem em que tocam</span></div>
            <div data-anim-lista></div>
          </div>
          <div class="pp-side-corpo" data-notas-corpo hidden>
            <div class="pp-side-head"><span>Notas do apresentador</span><span class="pp-side-hint">não aparecem na lâmina</span></div>
            <textarea class="pp-notes" data-notes placeholder="O que falar nesta lâmina..."></textarea>
          </div>
        </aside>
        <button type="button" class="pp-side-aba" data-side-toggle title="Mostrar o painel" aria-label="Mostrar o painel">« Formatar</button>
      </div>
      <div class="pp-status">
        <span data-pos>Lâmina 1 / 1</span>
        <span class="spacer"></span>
        <button type="button" class="btn small pp-side-btn" data-side-toggle title="Mostrar ou esconder o painel" aria-pressed="true">Painel</button>
        <span class="pp-zoom">
          <button type="button" class="btn small" data-zoom="out" title="Reduzir zoom" aria-label="Reduzir zoom">−</button>
          <input type="range" min="${Stage.limites.min}" max="${Stage.limites.max}" step="${Stage.limites.passo}" value="100" data-zoomrange aria-label="Zoom">
          <span class="pp-zoom-val" data-zoomval>100%</span>
          <button type="button" class="btn small" data-zoom="in" title="Ampliar zoom" aria-label="Ampliar zoom">+</button>
        </span>
      </div>`;

    this.strip = $("[data-strip]", this.pane);
    this.pane.querySelector(".pp-left")?.classList.toggle("faixa-vertical", this.faixaVertical);
    this.canvas = $("[data-canvas]", this.pane);
    this.frame = $("[data-frame]", this.pane);
    this.slideEl = $("[data-slide]", this.pane);
    this.notesEl = $<HTMLTextAreaElement>("[data-notes]", this.pane);

    this.fita = new Fita($("#pp-ribbon", this.pane), { estado: () => this.estadoUI(), run: (c, v) => this.run(c, v) });
    // recolher a faixa (botão no canto das abas, duplo clique numa aba ou Ctrl+F1),
    // ajustar o tamanho pela borda de baixo e, quando ela não cabe na janela,
    // a roda do mouse rola os grupos na horizontal
    const abasFita = $(".ppr-abas", this.fita.el);
    const paineisFita = $(".ppr-paineis", this.fita.el);
    ligarRecolherFita({ el: this.fita.el, abas: abasFita, paineis: paineisFita });
    ligarAjusteAlturaFita({ el: this.fita.el, modo: "metricas" });
    paineisFita.addEventListener(
      "wheel",
      (e) => {
        const p = paineisFita.querySelector<HTMLElement>(".ppr-painel:not([hidden])");
        if (!p || p.scrollWidth <= p.clientWidth || Math.abs(e.deltaY) < Math.abs(e.deltaX)) return;
        e.preventDefault();
        p.scrollLeft += e.deltaY;
      },
      { passive: false }
    );
    this.painel = new Painel($("[data-formatar]", this.pane), { estado: () => this.estadoUI(), run: (c, v) => this.run(c, v) });

    this.stage.attach(this.frame, this.slideEl);
    this.notes.attach(this.notesEl, (notes) => this.mudarNotas(notes));
    this.ligarPincel();

    this.ligarPainelLateral();
    // abas do painel lateral
    for (const b of this.pane.querySelectorAll<HTMLElement>("[data-lateral]")) {
      b.addEventListener("click", () => this.mostrarLateral(b.dataset.lateral as "formatar" | "notas" | "animacao"));
    }
    // painel de animação: clicar na linha seleciona a forma; os botões mexem no efeito
    this.pane.querySelector<HTMLElement>("[data-anim-lista]")?.addEventListener("click", (ev) => {
      const t = ev.target as HTMLElement;
      const mover = t.closest<HTMLElement>("[data-anim-mover]");
      if (mover) {
        this.moverAnimacaoNaOrdem(Number(mover.dataset.animMover), mover.dataset.animForma);
        return;
      }
      const remover = t.closest<HTMLElement>("[data-anim-remover]");
      if (remover) {
        this.removerAnimacao(remover.dataset.animRemover);
        return;
      }
      const linha = t.closest<HTMLElement>("[data-anim-item]");
      if (linha) this.selecionar([linha.dataset.animItem!]);
    });

    // zoom
    for (const b of this.pane.querySelectorAll<HTMLElement>("[data-zoom]")) {
      b.addEventListener("click", () => this.run(b.dataset.zoom === "in" ? "zoom-in" : "zoom-out"));
    }
    const range = this.pane.querySelector<HTMLInputElement>("[data-zoomrange]");
    range?.addEventListener("input", () => this.setZoom(+range.value));

    // Ctrl + roda do mouse amplia/reduz mirando o PONTEIRO: o ponto que está
    // debaixo do cursor continua debaixo dele (como no PowerPoint). Sem Ctrl,
    // a roda só rola a lâmina normalmente.
    this.canvas.addEventListener(
      "wheel",
      (e) => {
        if (!e.ctrlKey && !e.metaKey) return;
        e.preventDefault();
        const ponto = { x: e.clientX, y: e.clientY };
        // dy < 0 = roda para cima = ampliar (o passo cresce no zoom alto, como nos botões)
        this.setZoom(this.stage.zoomAtual + (e.deltaY < 0 ? passoZoom(this.stage.zoomAtual) : -passoZoom(this.stage.zoomAtual)), ponto);
      },
      { passive: false }
    );

    // arrastar uma imagem do computador para a lâmina
    this.canvas.addEventListener("dragover", (e) => {
      if (e.dataTransfer?.types.includes("Files")) e.preventDefault();
    });
    this.canvas.addEventListener("drop", (e) => {
      const arq = Array.from(e.dataTransfer?.files ?? []).find((f) => f.type.startsWith("image/"));
      if (!arq) return;
      e.preventDefault();
      void this.lerArquivoDeImagem(arq).then((src) => this.insertImage(src));
    });
    // menu de contexto
    this.slideEl.addEventListener("contextmenu", (e) => this.menuDeContexto(e));

    this.pane.style.setProperty("--slide-ratio", String(stageRatio(this.setup)));
    this.pintar();
  }

  /** Esconder/mostrar e redimensionar o painel lateral; a escolha fica guardada. */
  private ligarPainelLateral(): void {
    const guardado = (k: string) => {
      try {
        return localStorage.getItem(k);
      } catch {
        return null;
      }
    };
    const guardar = (k: string, v: string) => {
      try {
        localStorage.setItem(k, v);
      } catch {
        /* sem armazenamento: vale só nesta sessão */
      }
    };
    const largura = Number(guardado("pp-side-w"));
    if (largura >= 200 && largura <= 600) this.pane.style.setProperty("--pp-side-w", `${largura}px`);
    const aplicar = (oculto: boolean) => {
      // a animação só vale no esconder/mostrar (arrastar a borda não deve "deslizar")
      this.pane.classList.add("pp-side-anima");
      this.pane.classList.toggle("pp-side-oculto", oculto);
      for (const b of this.pane.querySelectorAll<HTMLElement>(".pp-side-btn")) b.setAttribute("aria-pressed", String(!oculto));
      guardar("pp-side-oculto", oculto ? "1" : "0");
      window.setTimeout(() => {
        this.pane.classList.remove("pp-side-anima");
        this.stage.desenharSelecao();
      }, 300);
    };
    aplicar(guardado("pp-side-oculto") === "1");
    this.pane.classList.remove("pp-side-anima");
    for (const b of this.pane.querySelectorAll<HTMLElement>("[data-side-toggle]")) b.addEventListener("click", () => aplicar(!this.pane.classList.contains("pp-side-oculto")));
    const alca = this.pane.querySelector<HTMLElement>("[data-side-resize]")!;
    alca.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      alca.setPointerCapture(e.pointerId);
      const move = (ev: PointerEvent) => {
        const w = Math.max(200, Math.min(600, this.pane.getBoundingClientRect().right - ev.clientX));
        this.pane.style.setProperty("--pp-side-w", `${w}px`);
      };
      const fim = () => {
        alca.removeEventListener("pointermove", move);
        alca.removeEventListener("pointerup", fim);
        guardar("pp-side-w", String(Math.round(parseFloat(this.pane.style.getPropertyValue("--pp-side-w")) || 260)));
        this.stage.desenharSelecao();
      };
      alca.addEventListener("pointermove", move);
      alca.addEventListener("pointerup", fim);
    });
  }

  /** Mostra o painel se estiver escondido (usado quando o usuário pede algo que mora nele). */
  private mostrarPainelLateral(): void {
    if (this.pane.classList.contains("pp-side-oculto")) this.pane.querySelector<HTMLElement>("[data-side-toggle]")?.click();
  }

  private mostrarLateral(qual: "formatar" | "notas" | "animacao"): void {
    this.lateral = qual;
    for (const b of this.pane.querySelectorAll<HTMLElement>("[data-lateral]")) b.classList.toggle("on", b.dataset.lateral === qual);
    this.pane.querySelector<HTMLElement>("[data-formatar]")!.hidden = qual !== "formatar";
    this.pane.querySelector<HTMLElement>("[data-animacao-corpo]")!.hidden = qual !== "animacao";
    this.pane.querySelector<HTMLElement>("[data-notas-corpo]")!.hidden = qual !== "notas";
    if (qual === "notas") this.notes.focus();
    else if (qual === "animacao") this.renderAnimacoes();
    else this.painel.atualizar();
  }

  /** Redesenha o painel de animação (lista da lâmina, na ordem). */
  private renderAnimacoes(): void {
    const host = this.pane.querySelector<HTMLElement>("[data-anim-lista]");
    if (!host) return;
    const lista = normalizarAnimacoes(this.atual().animacoes) ?? [];
    const porId = new Map(this.atual().shapes.map((s) => [s.id, s]));
    if (!lista.length) {
      host.innerHTML = `<p class="pp-anim-vazio">Nenhuma animação nesta lâmina. Selecione uma forma e escolha um efeito na aba <b>Animações</b>.</p>`;
      return;
    }
    const principal = this.principal()?.id;
    host.innerHTML = `<ol class="pp-anim-lista">${lista
      .map((a, i) => {
        const nome = escapeHtml(porId.get(a.forma)?.name?.trim() || "Forma");
        const partes = [ROTULOS_ANIMACAO[a.tipo], ROTULOS_INICIO[inicioDe(a)]];
        if (aceitaDirecaoAnimacao(a.tipo)) partes.splice(1, 0, ROTULOS_DIRECAO[direcaoDeAnimacao(a)]);
        if (a.porParagrafo) partes.push("por parágrafo");
        if (suave(a.tipo)) partes.push(formatarDuracao(duracaoDeAnimacao(a)));
        const atraso = atrasoDe(a);
        if (atraso > 0) partes.push(`+${formatarDuracao(atraso)}`);
        return (
          `<li class="pp-anim-linha${a.forma === principal ? " on" : ""}" data-anim-item="${a.forma}" title="Selecionar ${nome}">` +
          `<span class="pp-anim-num">${i + 1}</span>` +
          `<span class="pp-anim-nome">${nome}</span>` +
          `<span class="pp-anim-info">${partes.join(" · ")}</span>` +
          `<span class="pp-anim-acoes">` +
          `<button type="button" data-anim-mover="-1" data-anim-forma="${a.forma}" title="Mover para cima na ordem" aria-label="Mover para cima">↑</button>` +
          `<button type="button" data-anim-mover="1" data-anim-forma="${a.forma}" title="Mover para baixo na ordem" aria-label="Mover para baixo">↓</button>` +
          `<button type="button" data-anim-remover="${a.forma}" title="Remover esta animação" aria-label="Remover animação">×</button>` +
          `</span></li>`
        );
      })
      .join("")}</ol>`;
  }

  // ------------------------------------------------------------------
  // acesso ao estado
  // ------------------------------------------------------------------

  private get deck(): Deck {
    return { titulo: "", slides: this.slides };
  }

  private atual(): Slide {
    return this.slides[clampIndex(this.indice, this.slides.length)];
  }

  /** Tamanho da lâmina em pt. */
  private dim(): Dim {
    const { w, h } = aspectSize(this.setup);
    return { w: w * 72, h: h * 72 };
  }

  private formas(): Shape[] {
    return this.atual().shapes.filter((s) => this.selecao.includes(s.id));
  }

  private principal(): Shape | undefined {
    const f = this.formas();
    return f[f.length - 1];
  }

  private estilo(): EstiloDeck {
    return estiloDoDeck(this.slides, this.setup);
  }

  private estado(): Estado {
    return { slides: this.slides, indice: this.indice, selecao: this.selecao, setup: this.setup };
  }

  /**
   * Volta a um estado do histórico. Se `manterEdicao` (o id que estava em edição)
   * ainda existir, volta a editar a mesma forma — o desfazer durante a digitação
   * não tira o usuário da caixa de texto.
   */
  private restaurar(e: Estado, manterEdicao: string | null = null): void {
    this.slides = e.slides;
    this.indice = clampIndex(e.indice, e.slides.length);
    this.setup = e.setup;
    this.pane.style.setProperty("--slide-ratio", String(stageRatio(this.setup)));
    const ids = new Set(this.atual().shapes.map((s) => s.id));
    this.selecao = e.selecao.filter((id) => ids.has(id));
    this.editando = null;
    this.markDirty();
    const alvo = manterEdicao ? this.atual().shapes.find((s) => s.id === manterEdicao) : undefined;
    if (alvo && !alvo.bloqueada && (alvo.paras !== undefined || alvo.tabela)) this.entrarEdicao(alvo.id);
    else this.pintar();
  }

  private registrar(chave = ""): void {
    this.hist.registrar(this.estado(), chave);
  }

  private substituirSlide(slide: Slide): void {
    this.slides = replaceSlide(this.deck, this.indice, slide).slides;
  }

  /** Aplica uma edição à lâmina atual: guarda o desfazer, troca a lâmina e redesenha. */
  private editar(fn: (s: Slide) => Slide, chave = ""): void {
    const antes = this.atual();
    const depois = fn(antes);
    if (depois === antes) return;
    this.registrar(chave);
    this.substituirSlide(depois);
    this.markDirty();
    this.pintar();
  }

  // ------------------------------------------------------------------
  // desenho
  // ------------------------------------------------------------------

  private ctxRender(editavel: boolean): CtxRender {
    const { w, h } = this.dim();
    return { larguraPt: w, alturaPt: h, media: this.setup.media ?? {}, selecionada: null, editavel, editando: editavel ? this.editando : null, celulaEdit: editavel ? this.celulaEdit : null };
  }

  /** redesenha tudo: miniaturas + lâmina + fita + painel */
  pintar(): void {
    const slide = this.atual();
    for (const [k, v] of Object.entries(stageVars(this.setup))) this.slideEl.style.setProperty(k, v);
    this.slideEl.className = `pp-slide layout-${slide.layout}${this.fixas ? " pp-fixas-on" : ""}`;
    this.slideEl.style.background = fundoValor(slide.bg, this.setup.media ?? {});
    this.pintarSlide(slide);
    this.pintarStrip();
    this.notes.setText(slide.notes);
    this.atualizarStatus();
    this.sincronizarTabelas();
    this.atualizarUI();
  }

  /** só a lâmina e a seleção (usado enquanto se arrasta, para não refazer as miniaturas a cada quadro) */
  private pintarRapido(): void {
    this.pintarSlide(this.atual());
    this.atualizarUI();
  }

  private atualizarUI(): void {
    this.fita.atualizar();
    this.painel.atualizar();
    if (this.lateral === "animacao") this.renderAnimacoes();
    this.stage.desenharSelecao();
  }

  /** desenha o conteúdo da lâmina atual (formas ou markdown) */
  private pintarSlide(slide: Slide): void {
    // redesenhar cancela uma prévia de animações em andamento (o DOM vai ser trocado)
    this.animPreview?.cancelar();
    this.animPreview = null;
    if (!slide.shapes.length) {
      // lâmina só com markdown (modo simples)
      const html = marked.parse(slide.md, { gfm: true, async: false }) as string;
      this.slideEl.innerHTML = `<div class="pp-md">${sanitize(html)}</div>`;
      const md = this.slideEl.querySelector<HTMLElement>(".pp-md")!;
      md.onclick = () => this.editarMarkdown();
      return;
    }
    const ctx = this.ctxRender(true);
    this.slideEl.innerHTML = slide.shapes.map((s) => htmlFormaRica(s, ctx)).join("") + (this.grade ? `<div class="pp-grade"></div>` : "");
    if (this.editando) this.ligarEdicao(this.editando);
  }

  /** miniaturas das lâminas */
  private pintarStrip(): void {
    this.strip.textContent = "";
    for (const [k, v] of Object.entries(stageVars(this.setup))) this.strip.style.setProperty(k, v);
    const ctx = this.ctxRender(false);
    this.slides.forEach((s, i) => {
      const oculta = s.show === false;
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = `pp-thumb${i === this.indice ? " active" : ""}${oculta ? " oculta" : ""}`;
      btn.title = `Lâmina ${i + 1}${s.nome ? ` — ${s.nome}` : ""}${oculta ? " (oculta na apresentação)" : ""}`;
      const inner = document.createElement("div");
      inner.className = "pp-thumb-box";
      if (s.shapes.length) {
        inner.classList.add("pp-thumb-rica");
        inner.style.background = fundoValor(s.bg, this.setup.media ?? {}) || "var(--slide-bg, #fff)";
        inner.innerHTML = s.shapes.map((f) => htmlFormaRica(f, ctx)).join("");
      } else {
        const html = marked.parse(s.md, { gfm: true, async: false }) as string;
        inner.innerHTML = sanitize(html).slice(0, 400);
      }
      const num = document.createElement("span");
      num.className = "pp-thumb-num";
      num.textContent = String(i + 1);
      inner.append(num);
      btn.append(inner);
      // lâmina oculta: olho marcado por cima da miniatura (o apresentador pula ela)
      if (oculta) {
        const olho = document.createElement("span");
        olho.className = "pp-thumb-oculta";
        olho.title = "Oculta na apresentação";
        olho.setAttribute("aria-hidden", "true");
        olho.innerHTML = '<svg class="ic"><use href="#i-eye"/></svg>';
        btn.append(olho);
      }
      // nome próprio da lâmina: aparece embaixo da miniatura, como no PowerPoint
      if (s.nome) {
        const cap = document.createElement("span");
        cap.className = "pp-thumb-nome";
        cap.textContent = s.nome;
        btn.append(cap);
      }
      btn.addEventListener("click", () => this.irPara(i));
      // arrastar para reordenar
      btn.draggable = true;
      btn.addEventListener("dragstart", (e) => {
        e.dataTransfer?.setData("application/x-pp-lamina", String(i));
        if (e.dataTransfer) e.dataTransfer.effectAllowed = "move";
        btn.classList.add("arrastando");
      });
      btn.addEventListener("dragend", () => this.strip.querySelectorAll(".arrastando, .alvo-antes, .alvo-depois").forEach((n) => n.classList.remove("arrastando", "alvo-antes", "alvo-depois")));
      btn.addEventListener("dragover", (e) => {
        if (!e.dataTransfer?.types.includes("application/x-pp-lamina")) return;
        e.preventDefault();
        const antes = this.antesDaMiniatura(btn, e);
        btn.classList.toggle("alvo-antes", antes);
        btn.classList.toggle("alvo-depois", !antes);
      });
      btn.addEventListener("dragleave", () => btn.classList.remove("alvo-antes", "alvo-depois"));
      btn.addEventListener("drop", (e) => {
        const de = Number(e.dataTransfer?.getData("application/x-pp-lamina"));
        if (!Number.isFinite(de)) return;
        e.preventDefault();
        const antes = this.antesDaMiniatura(btn, e);
        let para = antes ? i : i + 1;
        if (de < para) para--;
        this.moverLaminaPara(de, para);
      });

      const del = document.createElement("button");
      del.type = "button";
      del.className = "pp-thumb-del";
      del.textContent = "×";
      del.title = "Excluir lâmina";
      del.addEventListener("click", (e) => {
        e.stopPropagation();
        this.indice = i;
        this.run("slide-del");
      });
      btn.append(del);
      this.strip.append(btn);
    });

    const add = document.createElement("button");
    add.type = "button";
    add.className = "pp-thumb-add";
    add.title = "Nova lâmina no fim";
    add.setAttribute("aria-label", "Nova lâmina");
    add.innerHTML = '<svg class="ic"><use href="#i-plus"/></svg><span>Nova lâmina</span>';
    add.addEventListener("click", () => this.run("slide-new"));
    this.strip.append(add);
    // mantém a miniatura da lâmina atual à vista (na horizontal e na vertical)
    this.strip.querySelector(".pp-thumb.active")?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }

  /** Arrastar na faixa: numa faixa vertical o "antes" é acima; na horizontal, à esquerda. */
  private antesDaMiniatura(el: HTMLElement, e: { clientX: number; clientY: number }): boolean {
    const r = el.getBoundingClientRect();
    return this.faixaVertical ? e.clientY < r.top + r.height / 2 : e.clientX < r.left + r.width / 2;
  }

  private atualizarStatus(): void {
    const pos = this.pane.querySelector("[data-pos]");
    if (pos) {
      const s = this.atual();
      pos.textContent = `Lâmina ${this.indice + 1} / ${this.slides.length}${s.nome ? ` — ${s.nome}` : ""}${s.show === false ? " (oculta)" : ""}`;
    }
    const zv = this.pane.querySelector("[data-zoomval]");
    if (zv) zv.textContent = `${this.stage.zoomAtual}%`;
    const range = this.pane.querySelector<HTMLInputElement>("[data-zoomrange]");
    if (range) range.value = String(this.stage.zoomAtual);
  }

  // ------------------------------------------------------------------
  // estado para a fita e o painel
  // ------------------------------------------------------------------

  private cacheFontes: { slides: Slide[]; lista: string[] } | null = null;

  private fontesDoDeck(): string[] {
    if (this.cacheFontes?.slides === this.slides) return this.cacheFontes.lista;
    const m = new Map<string, number>();
    for (const sl of this.slides) for (const s of sl.shapes) for (const p of s.paras ?? []) for (const r of p.runs) m.set(r.font, (m.get(r.font) ?? 0) + r.text.length);
    for (const f of this.setup.fonts ?? []) m.set(f.family, m.get(f.family) ?? 1);
    const lista = [...m.entries()].sort((a, b) => b[1] - a[1]).map(([k]) => k);
    this.cacheFontes = { slides: this.slides, lista };
    return lista;
  }

  private rtEmEdicao(): HTMLElement | null {
    if (!this.editando) return null;
    return this.slideEl.querySelector<HTMLElement>(`[data-shape="${this.editando}"] [data-editando]`);
  }

  /** Os parágrafos que a fita mostra: os do texto em edição, os da forma selecionada ou os da primeira célula escolhida. */
  private parasPrincipais(): Para[] | undefined {
    const f = this.principal();
    if (!f) return undefined;
    if (f.tabela) {
      const c: [number, number] = this.celulaEdit ?? (this.celulas?.id === f.id ? [this.celulas.r0, this.celulas.c0] : [0, 0]);
      return f.tabela.celulas[c[0]]?.[c[1]]?.paras;
    }
    return f.paras;
  }

  private celulasDaSelecao(): CelulasSel | null {
    const f = this.principal();
    return f?.tabela && this.celulas?.id === f.id ? this.celulas : null;
  }

  private selecionarCelulas(sel: CelulasSel | null): void {
    if (this.editando && sel && this.celulaEdit && (sel.r0 !== this.celulaEdit[0] || sel.c0 !== this.celulaEdit[1] || sel.r1 !== sel.r0 || sel.c1 !== sel.c0)) this.sairEdicao();
    this.celulas = sel;
    this.atualizarUI();
  }

  private estadoUI(): EstadoUI {
    const formas = this.formas();
    const forma = formas[formas.length - 1];
    let trecho: EstadoUI["trecho"] = null;
    let paragrafo: EstadoUI["paragrafo"];
    const paras = this.parasPrincipais();
    if (paras) {
      let ini = -1;
      let fim = -1;
      const rt = this.rtEmEdicao();
      const sel = rt ? lerSelecao(rt) : null;
      if (sel) {
        ini = sel.ini;
        fim = sel.fim;
      }
      trecho = estadoDoTrecho(paras, ini, fim);
      const idx = parasDaSelecao(paras, ini, fim);
      paragrafo = paras[idx[0] ?? 0];
    }
    const d = this.dim();
    const anims = normalizarAnimacoes(this.atual().animacoes);
    const animacao = forma && anims ? anims.find((a) => a.forma === forma.id) : undefined;
    return {
      temLamina: this.slides.length > 0,
      indice: this.indice,
      total: this.slides.length,
      layout: this.atual().layout,
      oculta: this.atual().show === false,
      formas,
      forma,
      editando: !!this.editando,
      trecho,
      paragrafo,
      podeDesfazer: this.hist.podeDesfazer,
      podeRefazer: this.hist.podeRefazer,
      temCopia: areaDeTransferencia.length > 0,
      zoom: this.stage.zoomAtual,
      ferramenta: this.ferramenta,
      fixas: this.fixas,
      encaixe: this.encaixe,
      grade: this.grade,
      faixaVertical: this.faixaVertical,
      paleta: this.estilo().paleta,
      fontes: this.fontesDoDeck(),
      setup: this.setup,
      bg: this.atual().bg,
      temGrupo: formas.some((s) => !!s.grupo),
      largura: forma ? (forma.box.w / 100) * d.w : 0,
      altura: forma ? (forma.box.h / 100) * d.h : 0,
      celulas: this.celulasDaSelecao(),
      cantosSel: [...this.cantosSel],
      transicao: normalizarTransicao(this.atual().transicao),
      transicaoPreservada: !!this.atual().transicaoXml,
      animacao,
      animacaoPreservada: !!this.atual().timingXml,
      animacaoPos: forma && anims ? anims.findIndex((a) => a.forma === forma.id) : -1,
      animacaoTotal: anims?.length ?? 0,
      animacaoParas: forma ? paragrafosDe(forma).length : 0,
    };
  }

  // ------------------------------------------------------------------
  // seleção e arraste
  // ------------------------------------------------------------------

  private selecionar(ids: string[]): void {
    const igual = ids.length === this.selecao.length && ids.every((x, i) => x === this.selecao[i]);
    if (igual) return;
    if (this.editando && !(ids.length === 1 && ids[0] === this.editando)) this.sairEdicao();
    this.selecao = ids;
    // seleção nova: a edição de cantos volta a valer para os quatro
    this.cantosSel = [...CANTOS];
    if (this.celulas && !(ids.length === 1 && ids[0] === this.celulas.id)) this.celulas = null;
    this.atualizarUI();
  }

  /** Cantos escolhidos (painel e palco): só eles mudam quando o raio é ajustado. */
  private selecionarCantos(cantos: Canto[]): void {
    const novo = cantos.length ? cantos : [...CANTOS];
    const igual = novo.length === this.cantosSel.length && novo.every((c, i) => c === this.cantosSel[i]);
    if (igual) return;
    this.cantosSel = novo;
    this.stage.desenharSelecao();
    this.painel.atualizar();
  }

  private aoTransformar(patches: Map<string, Partial<Shape>>, fase: "inicio" | "meio" | "fim"): void {
    if (fase === "inicio") {
      this.pendente = this.estado();
      return;
    }
    if (patches.size) {
      const d = this.dim();
      this.substituirSlide({
        ...this.atual(),
        shapes: this.atual().shapes.map((s) => {
          if (!patches.has(s.id)) return s;
          const novo = { ...s, ...patches.get(s.id)! };
          // tabela redimensionada: as colunas e linhas escalam junto
          if (novo.tabela && (novo.box.w !== s.box.w || novo.box.h !== s.box.h)) novo.tabela = ajustarAoTamanho(novo.tabela, (novo.box.w / 100) * d.w, (novo.box.h / 100) * d.h);
          return novo;
        }),
      });
      this.markDirty();
      this.pintarRapido();
    }
    if (fase === "fim") {
      if (this.pendente && this.pendente.slides !== this.slides) this.hist.registrar(this.pendente);
      this.pendente = null;
      this.pintar();
    }
  }

  /** Ctrl+arrastar: duplica a seleção e passa a seleção para as cópias. */
  private duplicarParaArrastar(): string[] {
    const ids = this.selecao.slice();
    if (!ids.length) return [];
    this.pendente = this.estado();
    const r = duplicarFormas(this.atual(), ids, 0, 0);
    this.substituirSlide(r.slide);
    this.selecao = r.novos;
    this.markDirty();
    return r.novos;
  }

  // ------------------------------------------------------------------
  // criação de formas
  // ------------------------------------------------------------------

  private aoCriar(c: { box: ShapeBox; clique: boolean; x0: number; y0: number; x1: number; y1: number }): void {
    const f = this.ferramenta;
    this.ferramenta = null;
    if (!f) return;
    const est = this.estilo();
    const d = this.dim();
    let forma: Shape;
    if (f.tipo === "texto") {
      const box = c.clique ? caixaCentrada(c.x0, c.y0, 240, 40, d) : c.box;
      forma = novaCaixaDeTexto(box, est);
    } else if (f.tipo === "forma") {
      const item = GALERIA[Number(f.id)];
      forma = this.formaDoItem(item, c, est, d);
    } else {
      return;
    }
    this.registrar();
    this.substituirSlide({ ...this.atual(), shapes: [...this.atual().shapes, forma] });
    this.selecao = [forma.id];
    this.markDirty();
    this.pintar();
    if (f.tipo === "texto") this.entrarEdicao(forma.id);
  }

  private formaDoItem(item: ItemGaleria, c: { box: ShapeBox; clique: boolean; x0: number; y0: number; x1: number; y1: number }, est: EstiloDeck, d: Dim): Shape {
    if (item.ehLinha) {
      let box: ShapeBox;
      let flipH = false;
      let flipV = false;
      if (c.clique) box = caixaCentrada(c.x0, c.y0, item.geom === "line" ? 200 : 160, item.geom === "line" ? 0 : 70, d);
      else {
        box = { x: Math.min(c.x0, c.x1), y: Math.min(c.y0, c.y1), w: Math.abs(c.x1 - c.x0), h: Math.abs(c.y1 - c.y0) };
        flipH = c.x1 < c.x0;
        flipV = c.y1 < c.y0;
      }
      const s = novaForma(item, box, est);
      if (flipH) s.flipH = true;
      if (flipV) s.flipV = true;
      return s;
    }
    const box = c.clique ? caixaCentrada(c.x0, c.y0, 180, item.geom === "ellipse" || item.geom === "star5" || item.geom === "heart" ? 180 : 110, d) : c.box;
    return novaForma(item, box, est);
  }

  // ------------------------------------------------------------------
  // desenho à mão (Draw)
  // ------------------------------------------------------------------

  /** O pincel em uso: a cor cai no acento do deck enquanto não foi escolhida. */
  private pincelUsado(): Pincel {
    return { cor: this.pincel.cor || this.estilo().acento, w: this.pincel.w, assistente: this.pincel.assistente };
  }

  /** Liga os controles da barrinha do pincel (cor, espessura e assistente). */
  private ligarPincel(): void {
    const barra = $<HTMLElement>("[data-pincel]", this.pane);
    barra.querySelector<HTMLElement>("[data-pincel-cor]")?.addEventListener("click", (e) => {
      const est = this.estilo();
      abrirCores(e.currentTarget as HTMLElement, { atual: this.pincelUsado().cor, paleta: est.paleta, titulo: "Cor do traço" }, (cor) => {
        this.pincel.cor = cor ?? est.acento;
        gravarPincel(this.pincel);
        this.atualizarPincel();
      });
    });
    for (const b of barra.querySelectorAll<HTMLElement>("[data-pincel-w]")) {
      b.addEventListener("click", () => {
        this.pincel.w = Number(b.dataset.pincelW) || 2;
        gravarPincel(this.pincel);
        this.atualizarPincel();
      });
    }
    barra.querySelector<HTMLElement>("[data-pincel-assist]")?.addEventListener("click", () => {
      this.pincel.assistente = !this.pincel.assistente;
      gravarPincel(this.pincel);
      this.atualizarPincel();
    });
    this.atualizarPincel();
  }

  /** Mostra/esconde a barrinha do pincel e reflete cor, espessura e assistente. */
  private atualizarPincel(): void {
    const barra = this.pane.querySelector<HTMLElement>("[data-pincel]");
    if (!barra) return;
    const ativo = this.ferramenta?.tipo === "desenho";
    barra.hidden = !ativo;
    if (!ativo) return;
    const p = this.pincelUsado();
    const cor = barra.querySelector<HTMLElement>("[data-pincel-cor]");
    if (cor) cor.style.background = `#${p.cor}`;
    for (const b of barra.querySelectorAll<HTMLElement>("[data-pincel-w]")) b.classList.toggle("on", Number(b.dataset.pincelW) === this.pincel.w);
    barra.querySelector("[data-pincel-assist]")?.classList.toggle("on", this.pincel.assistente);
    const dica = barra.querySelector<HTMLElement>("[data-pincel-dica]");
    if (dica) dica.textContent = "Rabisque na lâmina — Esc para sair";
  }

  /** Terminou um traço: vira forma (assistida) ou desenho livre, no lugar em que foi feito. */
  private aoTraco(t: { pontos: { x: number; y: number }[] }): void {
    const forma = formaDoTraco(t.pontos, this.pincelUsado(), this.estilo(), this.dim(), this.atual().shapes);
    if (!forma) return;
    this.registrar();
    this.substituirSlide({ ...this.atual(), shapes: [...this.atual().shapes, forma] });
    this.selecao = [forma.id];
    this.markDirty();
    this.pintar();
    this.atualizarPincel();
  }

  /** Traço em andamento: mostra o que o assistente está entendendo. */
  private aoTracoAndamento(pontos: { x: number; y: number }[]): void {
    const dica = this.pane.querySelector<HTMLElement>("[data-pincel-dica]");
    if (dica) dica.textContent = `entendi: ${dicaDoTraco(pontos, this.pincel.assistente)}`;
  }

  // ------------------------------------------------------------------
  // edição de texto dentro das formas e das células de tabela
  // ------------------------------------------------------------------

  private entrarEdicao(id: string, cel?: [number, number]): void {
    const s = this.atual().shapes.find((x) => x.id === id);
    if (!s || s.bloqueada || (s.paras === undefined && !s.tabela)) return;
    this.editando = id;
    this.selecao = [id];
    if (s.tabela) {
      this.celulaEdit = cel ?? (this.celulas?.id === id ? [this.celulas.r0, this.celulas.c0] : [0, 0]);
      this.celulas = { id, r0: this.celulaEdit[0], c0: this.celulaEdit[1], r1: this.celulaEdit[0], c1: this.celulaEdit[1] };
    } else this.celulaEdit = null;
    this.pintar();
    const rt = this.rtEmEdicao();
    if (rt) {
      rt.focus();
      const fim = document.createRange();
      fim.selectNodeContents(rt);
      fim.collapse(false);
      const sel = window.getSelection();
      sel?.removeAllRanges();
      sel?.addRange(fim);
    }
  }

  private sairEdicao(): void {
    if (!this.editando) return;
    this.editando = null;
    this.celulaEdit = null;
    window.getSelection()?.removeAllRanges();
    this.pintar();
  }

  /** Liga os eventos da caixa de texto em edição (depois de cada desenho da lâmina). */
  private ligarEdicao(id: string): void {
    const rt = this.rtEmEdicao();
    if (!rt) return;
    rt.addEventListener("input", () => this.aoDigitar(id, rt));
    rt.addEventListener("paste", (e) => {
      // cola sempre como texto puro: o formato de fora não entra
      e.preventDefault();
      e.stopPropagation();
      const t = e.clipboardData?.getData("text/plain") ?? "";
      if (t) document.execCommand("insertText", false, t);
    });
    rt.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        this.sairEdicao();
        return;
      }
      // dentro de uma tabela: Tab anda entre as células (e cria linha no fim)
      if (e.key === "Tab" && this.celulaEdit) {
        e.preventDefault();
        e.stopPropagation();
        this.moverCelula(e.shiftKey ? -1 : 1, true);
      }
    });
  }

  private estiloDeDigitacao(s: Shape, cel?: [number, number] | null): EstiloRun {
    const c = cel && s.tabela ? s.tabela.celulas[cel[0]]?.[cel[1]] : undefined;
    if (c?.estilo) return { ...c.estilo };
    return { size: s.fontSize, bold: s.bold, italic: s.italic, underline: false, strike: false, color: s.color || "000000", font: s.fontFamily || "Arial" };
  }

  private aoDigitar(id: string, rt: HTMLElement): void {
    const s = this.atual().shapes.find((x) => x.id === id);
    if (!s) return;
    const texto = textoDaCaixa(rt);
    if (s.tabela && this.celulaEdit) {
      const [r, c] = this.celulaEdit;
      const cel = s.tabela.celulas[r]?.[c];
      if (!cel) return;
      const paras = parasComTexto(cel.paras, texto, this.estiloDeDigitacao(s, this.celulaEdit));
      if (paras === cel.paras) return;
      // o desfazer da digitação entra no histórico global (Ctrl+Z na apresentação)
      this.registrar(`digitar:${id}:${r}:${c}`);
      const t = { ...s.tabela, celulas: s.tabela.celulas.map((linha, i) => (i === r ? linha.map((x, j) => (j === c ? { ...x, paras } : x)) : linha)) };
      this.substituirSlide({ ...this.atual(), shapes: this.atual().shapes.map((x) => (x.id === id ? { ...x, tabela: t } : x)) });
      this.markDirty();
      this.fita.atualizar();
      requestAnimationFrame(() => this.sincronizarTabelas());
      return;
    }
    if (!s.paras) return;
    const paras = parasComTexto(s.paras, texto, this.estiloDeDigitacao(s));
    if (paras === s.paras) return;
    // o desfazer da digitação entra no histórico global (Ctrl+Z na apresentação)
    this.registrar(`digitar:${id}`);
    // não redesenha: o cursor precisa continuar onde está
    this.substituirSlide({ ...this.atual(), shapes: this.atual().shapes.map((x) => (x.id === id ? { ...x, paras, text: texto } : x)) });
    this.markDirty();
    this.fita.atualizar();
  }

  /**
   * Aplica uma mudança de texto ao alvo certo: ao trecho selecionado dentro da caixa em edição, ou a todo o texto das formas
   * selecionadas (nas tabelas, às células escolhidas — ou a todas quando nenhuma foi escolhida).
   */
  private mapearTextos(fn: (paras: Para[], sel: { ini: number; fim: number } | null) => Para[], chave: string, extra?: (s: Shape, sel: { ini: number; fim: number } | null) => Partial<Shape>): void {
    const rt = this.rtEmEdicao();
    const sel = rt ? lerSelecao(rt) : null;
    const editandoId = this.editando;
    const celEdit = this.celulaEdit;
    const alvoIds = editandoId ? [editandoId] : this.selecao;
    this.editar(
      (sl) => ({
        ...sl,
        shapes: sl.shapes.map((s) => {
          if (!alvoIds.includes(s.id)) return s;
          if (s.tabela) {
            const t = s.tabela;
            const escolha = editandoId && celEdit ? { r0: celEdit[0], c0: celEdit[1], r1: celEdit[0], c1: celEdit[1] } : this.celulas?.id === s.id ? this.celulas : null;
            const e = escolha ? expandirSelecao(t, escolha) : { r0: 0, c0: 0, r1: t.linhas.length - 1, c1: t.colunas.length - 1 };
            const celulas = t.celulas.map((linha, r) => linha.map((c, col) => (r >= e.r0 && r <= e.r1 && col >= e.c0 && col <= e.c1 && !c.coberta ? { ...c, paras: fn(c.paras, editandoId ? sel : null) } : c)));
            return { ...s, tabela: { ...t, celulas } };
          }
          if (!s.paras) return s;
          return { ...s, paras: fn(s.paras, editandoId ? sel : null), ...(extra ? extra(s, editandoId ? sel : null) : {}) };
        }),
      }),
      chave
    );
    this.refocar(sel);
  }

  /** Aplica um estilo ao trecho selecionado (ou a todo o texto). */
  private estiloDoTexto(patch: RunPatch): void {
    this.mapearTextos(
      (paras, sel) => estiloNoIntervalo(paras, sel ? sel.ini : -1, sel ? sel.fim : -1, patch),
      "estilo-texto",
      (_s, sel) => {
        const extra: Partial<Shape> = {};
        if (!sel || sel.ini === sel.fim) {
          if (patch.font !== undefined) extra.fontFamily = patch.font;
          if (patch.size !== undefined) extra.fontSize = patch.size;
          if (patch.color !== undefined) extra.color = patch.color;
          if (patch.bold !== undefined) extra.bold = patch.bold;
          if (patch.italic !== undefined) extra.italic = patch.italic;
        }
        return extra;
      }
    );
  }

  private mudarTamanhoTexto(sobe: boolean): void {
    this.mapearTextos((paras, sel) => mudarTamanhoRelativo(paras, sel ? sel.ini : -1, sel ? sel.fim : -1, sobe), "tamanho-texto");
  }

  /** Muda a caixa do texto selecionado (MAIÚSCULAS, minúsculas ou Primeira Letra). */
  private mudarCaixa(tipo: TipoCaixa): void {
    this.mapearTextos((paras, sel) => mudarCaixaTexto(paras, sel ? sel.ini : -1, sel ? sel.fim : -1, tipo), "caixa-texto");
  }

  /**
   * "Limpar formatação": devolve o trecho selecionado ao estilo de digitação da forma (o mesmo que o texto novo
   * herda) e tira marca-texto, sobrescrito/subscrito, versalete e espaçamento de caracteres.
   */
  private limparFormatacao(): void {
    const rt = this.rtEmEdicao();
    const sel = rt ? lerSelecao(rt) : null;
    const editandoId = this.editando;
    const celEdit = this.celulaEdit;
    const alvoIds = editandoId ? [editandoId] : this.selecao;
    const ini = editandoId && sel ? sel.ini : -1;
    const fim = editandoId && sel ? sel.fim : -1;
    this.editar(
      (sl) => ({
        ...sl,
        shapes: sl.shapes.map((s) => {
          if (!alvoIds.includes(s.id)) return s;
          if (s.tabela) {
            const t = s.tabela;
            const escolha = editandoId && celEdit ? { r0: celEdit[0], c0: celEdit[1], r1: celEdit[0], c1: celEdit[1] } : this.celulas?.id === s.id ? this.celulas : null;
            const e = escolha ? expandirSelecao(t, escolha) : { r0: 0, c0: 0, r1: t.linhas.length - 1, c1: t.colunas.length - 1 };
            const celulas = t.celulas.map((linha, r) =>
              linha.map((c, col) => (r >= e.r0 && r <= e.r1 && col >= e.c0 && col <= e.c1 && !c.coberta ? { ...c, paras: limparEstiloNoIntervalo(c.paras, ini, fim, this.estiloDeDigitacao(s, [r, col])) } : c))
            );
            return { ...s, tabela: { ...t, celulas } };
          }
          if (!s.paras) return s;
          return { ...s, paras: limparEstiloNoIntervalo(s.paras, ini, fim, this.estiloDeDigitacao(s)) };
        }),
      }),
      "limpar-formatacao"
    );
    this.refocar(sel);
  }

  /** Depois de redesenhar durante a edição: devolve o foco e a seleção do texto. */
  private refocar(sel: { ini: number; fim: number } | null): void {
    if (!this.editando) return;
    const rt = this.rtEmEdicao();
    if (!rt) return;
    rt.focus();
    if (sel) restaurarSelecao(rt, sel.ini, sel.fim);
  }

  /** Propriedades de parágrafo nas formas selecionadas (ou só nos parágrafos tocados pela seleção de texto). */
  private estiloDosParagrafos(fn: (paras: Para[], idx: number[]) => Para[]): void {
    this.mapearTextos((paras, sel) => fn(paras, sel ? parasDaSelecao(paras, sel.ini, sel.fim) : paras.map((_, i) => i)), "paragrafo");
  }

  // ------------------------------------------------------------------
  // tabelas
  // ------------------------------------------------------------------

  /** A tabela selecionada (a principal), se houver. */
  private tabelaAtual(): Shape | undefined {
    const f = this.principal();
    return f?.tabela ? f : undefined;
  }

  /** Muda a tabela da forma selecionada e acerta o tamanho da forma. */
  private editarTabela(fn: (t: NonNullable<Shape["tabela"]>) => NonNullable<Shape["tabela"]>, chave = ""): void {
    const f = this.tabelaAtual();
    if (!f?.tabela) return;
    const d = this.dim();
    this.editar(
      (sl) => ({
        ...sl,
        shapes: sl.shapes.map((s) => {
          if (s.id !== f.id || !s.tabela) return s;
          const t = fn(s.tabela);
          const tot = tamanhoTotal(t);
          return { ...s, tabela: t, box: { ...s.box, w: (tot.w / d.w) * 100, h: (tot.h / d.h) * 100 } };
        }),
      }),
      chave
    );
  }

  /** A seleção de células atual (ou a célula inteira da tabela se nada foi escolhido). */
  private selDaTabela(): { r0: number; c0: number; r1: number; c1: number } {
    const f = this.tabelaAtual();
    if (this.celulaEdit) return { r0: this.celulaEdit[0], c0: this.celulaEdit[1], r1: this.celulaEdit[0], c1: this.celulaEdit[1] };
    if (this.celulas && f && this.celulas.id === f.id) return this.celulas;
    const t = f?.tabela;
    return { r0: 0, c0: 0, r1: (t?.linhas.length ?? 1) - 1, c1: (t?.colunas.length ?? 1) - 1 };
  }

  /** Mede as tabelas na tela: se o texto fez alguma linha crescer, a caixa da forma acompanha (a seleção fica certa). */
  private sincronizarTabelas(): void {
    const tabs = this.atual().shapes.filter((s) => s.tabela);
    if (!tabs.length) return;
    const raiz = this.slideEl.getBoundingClientRect();
    if (!raiz.height) return;
    let mudou = false;
    const shapes = this.atual().shapes.map((s) => {
      if (!s.tabela) return s;
      const el = this.slideEl.querySelector<HTMLElement>(`[data-shape="${s.id}"] table`);
      if (!el) return s;
      const hPct = (el.getBoundingClientRect().height / raiz.height) * 100;
      if (hPct > s.box.h + 0.15) {
        mudou = true;
        return { ...s, box: { ...s.box, h: hPct } };
      }
      return s;
    });
    if (mudou) {
      this.substituirSlide({ ...this.atual(), shapes });
      requestAnimationFrame(() => this.stage.desenharSelecao());
    }
  }

  /** Anda para a célula seguinte/anterior (Tab); no fim de uma tabela, Tab cria uma linha nova. */
  private moverCelula(passo: number, editar: boolean): void {
    const f = this.tabelaAtual();
    if (!f?.tabela) return;
    const t = f.tabela;
    const atual = this.celulaEdit ?? (this.celulas?.id === f.id ? ([this.celulas.r0, this.celulas.c0] as [number, number]) : ([0, 0] as [number, number]));
    // lista das células "donas" (não cobertas) na ordem de leitura
    const lista: [number, number][] = [];
    t.celulas.forEach((linha, r) => linha.forEach((c, col) => !c.coberta && lista.push([r, col])));
    let i = lista.findIndex(([r, c]) => r === atual[0] && c === atual[1]);
    if (i < 0) i = 0;
    let prox = i + passo;
    const wasEditing = !!this.editando;
    if (wasEditing) this.sairEdicao();
    if (prox >= lista.length) {
      this.editarTabela((x) => inserirLinha(x, x.linhas.length, x.linhas.length - 1));
      const nova = this.tabelaAtual()!.tabela!;
      prox = lista.length;
      lista.push([nova.linhas.length - 1, 0]);
    }
    if (prox < 0) prox = 0;
    const [r, c] = lista[Math.min(prox, lista.length - 1)];
    this.celulas = { id: f.id, r0: r, c0: c, r1: r, c1: c };
    if (editar || wasEditing) this.entrarEdicao(f.id, [r, c]);
    else this.atualizarUI();
  }

  // ------------------------------------------------------------------
  // comandos da fita e do painel
  // ------------------------------------------------------------------

  private run(cmd: string, value?: string): void {
    const sl = this.atual();
    const ids = this.selecao;
    const d = this.dim();
    const principal = this.principal();

    // tabela selecionada: preenchimento, contorno e alinhamento vertical valem para as células escolhidas
    if (principal?.tabela && this.comandoDeTabela(cmd, value)) return;
    // gráfico selecionado: tipo, dados, título e opções valem para ele
    if (principal?.grafico && this.comandoDeGrafico(cmd, value)) return;
    // mídia selecionada: reprodução, corte e opções valem para ela
    if (principal?.midia && this.comandoDeMidia(cmd, value)) return;

    // ---- comandos com valor no nome ----
    if (cmd.startsWith("grad-cor:") || cmd.startsWith("grad-pos:")) return this.gradienteParada(cmd, value);
    if (cmd.startsWith("ajuste:")) {
      const chave = cmd.slice(7);
      this.editar((s) => patchFormas(s, ids, (f) => comAjuste(f, chave, Number(value))), `ajuste-${chave}`);
      return;
    }
    if (cmd.startsWith("marg:")) {
      const i = Number(cmd.slice(5));
      this.editar(
        (s) =>
          patchFormas(s, ids, (f) => {
            const ins = [...(f.ins ?? [7.2, 3.6, 7.2, 3.6])] as [number, number, number, number];
            ins[i] = Math.max(0, (Number(value) / 2.54) * 72);
            return { ins };
          }),
        "margem"
      );
      return;
    }
    if (cmd.startsWith("crop:")) {
      const i = Number(cmd.slice(5));
      this.editar(
        (s) =>
          patchFormas(s, ids, (f) => {
            const c = [...(f.crop ?? [0, 0, 0, 0])] as [number, number, number, number];
            c[i] = Math.max(0, Math.min(95, Number(value) || 0));
            return { crop: c };
          }),
        "recorte"
      );
      return;
    }
    if (cmd.startsWith("bg-grad-cor:")) {
      const i = Number(cmd.slice(12));
      const f = sl.bg;
      if (f?.kind !== "gradient" || !f.stops) return;
      const stops = f.stops.map((p, k) => ((i === 0 && k === 0) || (i === 1 && k === f.stops!.length - 1) ? { ...p, color: String(value) } : p));
      this.editar((s) => ({ ...s, bg: { ...f, stops } }), "fundo");
      return;
    }

    switch (cmd) {
      // ---- lâmina ----
      // a fita emite "slide-novo" e o botão "+" da faixa emite "slide-new":
      // os dois nomes fazem a mesma coisa (antes só um deles era tratado e o
      // botão "Nova lâmina" da fita ficava sem efeito)
      case "slide-novo":
      case "slide-new": {
        this.registrar();
        // a lâmina nova herda o fundo e as decorações fixas da atual e já vem com as caixas do layout escolhido
        const layout = (value as SlideLayout) || (sl.shapes.length ? "conteudo" : "conteudo");
        const nova = novaLamina(layout, this.estilo(), sl);
        // vai para o FIM da apresentação: o "+" da faixa fica no fim, e era onde o usuário
        // esperava a lâmina nova; antes ela entrava logo depois da ATUAL — onde ele estava
        // olhando — e parecia fora de lugar
        const lista = this.slides.slice();
        lista.push(nova);
        this.slides = lista;
        this.indice = lista.length - 1;
        this.selecao = [];
        this.editando = null;
        this.markDirty();
        this.pintar();
        return;
      }
      case "slide-dup": {
        this.registrar();
        const r = duplicateSlide(this.deck, this.indice);
        this.slides = r.deck.slides;
        this.indice = r.index;
        this.selecao = [];
        this.markDirty();
        this.pintar();
        return;
      }
      case "slide-del": {
        this.registrar();
        const r = removeSlide(this.deck, this.indice);
        this.slides = r.deck.slides;
        this.indice = r.index;
        this.selecao = [];
        this.editando = null;
        this.markDirty();
        this.pintar();
        return;
      }
      case "slide-ocultar": {
        // alterna oculta/mostra: a lâmina continua no editor, mas o apresentador pula ela
        this.editar((s) => {
          if (s.show !== false) return { ...s, show: false };
          const n = { ...s };
          delete n.show;
          return n;
        });
        return;
      }
      case "slide-nome": {
        void (async () => {
          const nome = await pedirTexto({
            titulo: "Renomear lâmina",
            rotulo: "Nome da lâmina",
            dica: "Vazio volta a usar só o número da lâmina.",
            valor: sl.nome ?? "",
          });
          if (nome === null) return;
          const limpo = nome.trim();
          if (limpo === (this.atual().nome ?? "")) return;
          this.editar((s) => {
            const n = { ...s };
            if (limpo) n.nome = limpo;
            else delete n.nome;
            return n;
          });
        })();
        return;
      }
      case "slide-reset": {
        // uma ação só no desfazer: tira as formas próprias (as fixas ficam) e reaplica as caixas do layout
        this.registrar();
        this.slides = resetSlide(this.deck, this.indice, formasDoLayout(this.atual().layout, this.estilo())).slides;
        this.selecao = [];
        this.markDirty();
        this.pintar();
        return;
      }
      case "slide-up":
        return this.moverLamina(-1);
      case "slide-down":
        return this.moverLamina(1);
      case "layout":
      case "layout-sel": {
        this.registrar();
        const novo = (value ?? "conteudo") as SlideLayout;
        this.slides = setLayout(this.deck, this.indice, novo).slides;
        // lâmina sem caixas próprias (só decoração): recebe as caixas do layout
        const atual = this.atual();
        if (!atual.shapes.some((f) => !f.fixa)) this.substituirSlide({ ...atual, shapes: [...atual.shapes, ...formasDoLayout(novo, this.estilo())] });
        this.markDirty();
        this.pintar();
        return;
      }
      case "theme":
        if (value && THEMES.some((t) => t.id === value)) this.setSetup({ theme: value as DeckSetup["theme"] });
        return;
      case "modelo": {
        const modelo = MODELOS.find((m) => m.id === value) ?? lerModelosUsuario().find((m) => m.id === value);
        if (modelo) this.usarModelo(modelo);
        return;
      }
      case "modelo-criar": {
        // salva o visual do deck atual como um modelo do usuário (fica no botão Template)
        const modelo = criarModeloUsuario(this.slides, this.setup, String(value ?? ""));
        toast(`Modelo "${modelo.nome}" salvo no botão Template.`, "ok", 4200);
        return;
      }
      case "modelo-excluir":
        removerModeloUsuario(String(value ?? ""));
        toast("Modelo removido.", "ok", 3000);
        return;

      // ---- transição de entrada da lâmina ----
      case "transicao": {
        const tipo = String(value ?? "none") as TransicaoTipo;
        this.mudarTransicao(normalizarTransicao({ ...(sl.transicao ?? {}), tipo } as Transicao));
        return;
      }
      case "transicao-direcao":
        this.mudarTransicao(comTransicao(sl.transicao, { direcao: String(value) as TransicaoDirecao }));
        return;
      case "transicao-duracao":
        this.mudarTransicao(comTransicao(sl.transicao, { duracao: Number(String(value).replace(",", ".")) }));
        return;
      case "transicao-todas": {
        const t = normalizarTransicao(sl.transicao);
        const mudou = this.slides.some((x) => x.transicaoXml || JSON.stringify(x.transicao ?? null) !== JSON.stringify(t ?? null));
        if (!mudou) return;
        this.registrar("transicao-todas");
        this.slides = this.slides.map((x) => ({ ...x, transicao: t, transicaoXml: undefined }));
        this.markDirty();
        this.pintar();
        return;
      }
      case "transicao-previa":
        return this.preverTransicao();

      // ---- animações de forma (aba Animações) ----
      case "animacao": {
        const tipo = String(value ?? "") as AnimacaoTipo;
        if (!TIPOS_ANIMACAO.includes(tipo)) return;
        return this.aplicarAnimacao(tipo);
      }
      case "animacao-inicio":
        return this.mudarInicioAnimacao(String(value ?? "clicar") as AnimacaoInicio);
      case "animacao-duracao":
        return this.mudarDuracaoAnimacao(Number(String(value).replace(",", ".")));
      case "animacao-atraso":
        return this.mudarAtrasoAnimacao(Number(String(value).replace(",", ".")));
      case "animacao-direcao":
        return this.mudarDirecaoAnimacao(String(value ?? "direita") as AnimacaoDirecao);
      case "animacao-por-paragrafo":
        return this.mudarPorParagrafoAnimacao(String(value) === "1");
      case "animacao-remover":
        return this.removerAnimacao();
      case "animacao-subir":
        return this.moverAnimacaoNaOrdem(-1);
      case "animacao-descer":
        return this.moverAnimacaoNaOrdem(1);
      case "animacao-previa":
        return this.preverAnimacoes();

      case "present":
        return this.present();
      case "configure":
        return void this.opts.onConfigure?.();
      case "notes":
        this.mostrarLateral("notas");
        return;

      // ---- desfazer, refazer, área de transferência ----
      case "desfazer": {
        const e = this.hist.desfazer(this.estado());
        if (e) this.restaurar(e, this.editando);
        return;
      }
      case "refazer": {
        const e = this.hist.refazer(this.estado());
        if (e) this.restaurar(e, this.editando);
        return;
      }
      case "copiar":
        return this.copiar();
      case "recortar":
        this.copiar();
        return this.run("excluir");
      case "colar":
        return this.colar();
      case "duplicar": {
        if (!ids.length) return;
        this.registrar();
        const r = duplicarFormas(sl, comGrupos(sl, ids));
        this.substituirSlide(r.slide);
        this.selecao = r.novos;
        this.markDirty();
        this.pintar();
        return;
      }
      case "excluir":
        if (!ids.length) return;
        this.registrar();
        {
          // as animações das formas que saíram somem junto; o `<p:timing>` cru (que apontava
          // para elas por id) não vale mais depois de excluir
          const semFormas = removerFormas(sl, ids);
          this.substituirSlide({ ...semFormas, animacoes: podarAnimacoes(semFormas.animacoes, semFormas.shapes.map((f) => f.id)), timingXml: undefined });
        }
        this.selecao = [];
        this.markDirty();
        this.pintar();
        return;
      case "sel-tudo":
        this.selecionar(sl.shapes.filter((s) => !s.fixa || this.fixas).map((s) => s.id));
        return;

      // ---- inserir ----
      case "tabela-inserir": {
        const [linhas, colunas] = String(value ?? "3,3").split(",").map(Number);
        return this.inserirTabela(Math.max(1, linhas || 3), Math.max(1, colunas || 3));
      }
      case "grafico-inserir": {
        const tipo = (GRAFICO_TIPOS.some((t) => t.id === value) ? value : "colunas") as GraficoTipo;
        return this.inserirGrafico(tipo);
      }
      case "mermaid-fluxo":
        return void this.abrirFluxoMermaid();
      case "desenho":
        this.ferramenta = this.ferramenta?.tipo === "desenho" ? null : { tipo: "desenho" };
        this.atualizarPincel();
        this.stage.desenharSelecao();
        this.fita.atualizar();
        return;
      case "forma-inserir":
        this.ferramenta = { tipo: "forma", id: String(value ?? "5") };
        this.atualizarPincel();
        this.stage.desenharSelecao();
        this.fita.atualizar();
        return;
      case "ferramenta":
        this.ferramenta = value === "texto" ? (this.ferramenta?.tipo === "texto" ? null : { tipo: "texto" }) : null;
        this.atualizarPincel();
        this.stage.desenharSelecao();
        this.fita.atualizar();
        return;
      case "image":
        this.destinoImagem = "inserir";
        return void this.opts.onPickImage?.("inserir");
      case "midia":
        this.destinoMidia = String(value ?? "video");
        return void this.opts.onPickMedia?.(this.destinoMidia);
      case "preench-imagem":
      case "imagem-trocar":
      case "fundo-imagem":
        this.destinoImagem = cmd === "preench-imagem" ? "preencher" : cmd === "imagem-trocar" ? "trocar" : "fundo";
        return void this.opts.onPickImage?.(this.destinoImagem);

      // ---- texto ----
      case "fonte":
        return this.estiloDoTexto({ font: String(value) });
      case "tamanho":
        return this.estiloDoTexto({ size: Math.max(1, Number(String(value).replace(",", "."))) });
      case "maior":
        return this.mudarTamanhoTexto(true);
      case "menor":
        return this.mudarTamanhoTexto(false);
      case "negrito":
      case "italico":
      case "sublinhado":
      case "tachado": {
        const est = this.estadoUI().trecho;
        const chave = cmd === "negrito" ? "bold" : cmd === "italico" ? "italic" : cmd === "sublinhado" ? "underline" : "strike";
        const ligado = est ? est[chave] === true : false;
        return this.estiloDoTexto({ [chave]: !ligado } as RunPatch);
      }
      case "cor-texto":
        return this.estiloDoTexto({ color: String(value) });
      case "marca-texto":
        // vazio = "sem marca-texto" (o menu de cores manda "" nesse caso)
        return this.estiloDoTexto({ highlight: String(value ?? "").replace(/^#/, "") });
      case "sobrescrito": {
        const t = this.estadoUI().trecho;
        const atual = t && t.baseline !== "misto" ? t.baseline : 0;
        return this.estiloDoTexto({ baseline: atual > 0 ? 0 : 30 });
      }
      case "subscrito": {
        const t = this.estadoUI().trecho;
        const atual = t && t.baseline !== "misto" ? t.baseline : 0;
        return this.estiloDoTexto({ baseline: atual < 0 ? 0 : -25 });
      }
      case "versalete":
        return this.estiloDoTexto({ caps: this.estadoUI().trecho?.caps !== true });
      case "espacamento":
        return this.estiloDoTexto({ spc: Number(String(value).replace(",", ".")) || 0 });
      case "caixa":
        return this.mudarCaixa(String(value) as TipoCaixa);
      case "limpar-formatacao":
        return this.limparFormatacao();
      case "marcadores":
        return this.estiloDosParagrafos((p, idx) => alternarMarcador(p, idx, "marcador"));
      case "numeracao":
        return this.estiloDosParagrafos((p, idx) => alternarMarcador(p, idx, "numeracao"));
      case "recuo-mais":
        return this.estiloDosParagrafos((p, idx) => mudarRecuo(p, idx, 1));
      case "recuo-menos":
        return this.estiloDosParagrafos((p, idx) => mudarRecuo(p, idx, -1));
      case "entrelinha":
        return this.estiloDosParagrafos((p, idx) => estiloDosParas(p, idx, { lnSpc: { pct: Number(value) } }));
      case "alinhar-esquerda":
      case "alinhar-centro":
      case "alinhar-direita":
      case "alinhar-justificado": {
        const mapa: Record<string, TextAlign> = { "alinhar-esquerda": "esquerda", "alinhar-centro": "centro", "alinhar-direita": "direita", "alinhar-justificado": "justificado" };
        return this.estiloDosParagrafos((p, idx) => estiloDosParas(p, idx, { align: mapa[cmd] }));
      }
      case "v-topo":
      case "v-meio":
      case "v-base":
      case "anchor": {
        const a = cmd === "v-topo" ? "t" : cmd === "v-meio" ? "ctr" : cmd === "v-base" ? "b" : (value as "t" | "ctr" | "b");
        this.editar((s) => patchFormas(s, ids, (f) => (f.paras ? { anchor: a } : {})));
        return;
      }
      case "vert":
        this.editar((s) => patchFormas(s, ids, { vert: (value || undefined) as Shape["vert"] }));
        return;
      case "wrap":
        this.editar((s) => patchFormas(s, ids, { wrap: value === "1" }));
        return;

      // ---- preenchimento ----
      case "preench": {
        if (!ids.length) return;
        const fill: Fill | undefined = value === "none" ? { kind: "none" } : solido(String(value));
        this.editar((s) => patchFormas(s, ids, (f) => comPreenchimento(f, fill)));
        return;
      }
      case "pf-tipo": {
        const base = corPrincipal(principal?.fillX) ?? this.estilo().acento;
        if (value === "image") return this.run("preench-imagem");
        const fill: Fill | undefined = value === "none" ? { kind: "none" } : value === "solid" ? solido(base) : gradiente(ajustarCor(base, 1.3), ajustarCor(base, 0.75), 90);
        this.editar((s) => patchFormas(s, ids, (f) => comPreenchimento(f, fill)));
        return;
      }
      case "pf-cor":
        this.editar((s) => patchFormas(s, ids, (f) => (f.fillX?.kind === "solid" ? comPreenchimento(f, { ...f.fillX, color: String(value) }) : comPreenchimento(f, solido(String(value))))), "pf-cor");
        return;
      case "pf-transp":
        this.editar((s) => patchFormas(s, ids, (f) => (f.fillX && f.fillX.kind !== "none" ? comPreenchimento(f, { ...f.fillX, alpha: 1 - Math.max(0, Math.min(100, Number(value))) / 100 }) : {})), "pf-transp");
        return;
      case "gradiente": {
        const base = corPrincipal(principal?.fillX) ?? this.estilo().acento;
        const c1 = ajustarCor(base, 1.3);
        const c2 = ajustarCor(base, 0.75);
        const dir = String(value);
        const ang: Record<string, number> = { baixo: 90, cima: 270, direita: 0, esquerda: 180, diagonal: 45 };
        const fill: Fill = dir === "radial" ? { ...gradiente(c1, c2), radial: true, angle: undefined } : gradiente(c1, c2, ang[dir] ?? 90);
        this.editar((s) => patchFormas(s, ids, (f) => comPreenchimento(f, fill)));
        return;
      }
      case "grad-tipo":
        this.editar((s) => patchFormas(s, ids, (f) => (f.fillX?.kind === "gradient" ? comPreenchimento(f, { ...f.fillX, radial: value === "radial", angle: value === "radial" ? undefined : (f.fillX.angle ?? 90) }) : {})));
        return;
      case "grad-angulo":
        this.editar((s) => patchFormas(s, ids, (f) => (f.fillX?.kind === "gradient" ? comPreenchimento(f, { ...f.fillX, angle: Number(value) }) : {})), "grad-angulo");
        return;
      case "grad-add":
        this.editar((s) =>
          patchFormas(s, ids, (f) => {
            const fx = f.fillX;
            if (fx?.kind !== "gradient" || !fx.stops) return {};
            const st = [...fx.stops].sort((a, b) => a.pos - b.pos);
            const meio = { pos: (st[st.length - 2].pos + st[st.length - 1].pos) / 2, color: st[st.length - 1].color, alpha: 1 };
            return comPreenchimento(f, { ...fx, stops: [...st.slice(0, -1), meio, st[st.length - 1]] });
          })
        );
        return;
      case "grad-del":
        this.editar((s) =>
          patchFormas(s, ids, (f) => {
            const fx = f.fillX;
            if (fx?.kind !== "gradient" || !fx.stops || fx.stops.length <= 2) return {};
            return comPreenchimento(f, { ...fx, stops: fx.stops.filter((_, i) => i !== Number(value)) });
          })
        );
        return;
      case "grad-inverter":
        this.editar((s) =>
          patchFormas(s, ids, (f) => {
            const fx = f.fillX;
            if (fx?.kind !== "gradient" || !fx.stops) return {};
            return comPreenchimento(f, { ...fx, stops: [...fx.stops].reverse().map((p) => ({ ...p, pos: 100 - p.pos })) });
          })
        );
        return;

      // ---- linha ----
      case "contorno":
        this.editar((s) => patchFormas(s, ids, (f) => (value === "none" ? comLinha(f, null) : comLinha(f, { color: String(value) }))));
        return;
      case "ln-tipo":
        this.editar((s) => patchFormas(s, ids, (f) => (value === "none" ? comLinha(f, null) : comLinha(f, f.ln ?? { color: ajustarCor(corPrincipal(f.fillX) ?? "4F46E5", 0.7), w: 1 }))));
        return;
      case "ln-cor":
        this.editar((s) => patchFormas(s, ids, (f) => comLinha(f, { color: String(value) })), "ln-cor");
        return;
      case "ln-w":
      case "espessura":
        this.editar((s) => patchFormas(s, ids, (f) => comLinha(f, { w: Math.max(0, Number(String(value).replace(",", "."))) })), "ln-w");
        return;
      case "ln-transp":
        this.editar((s) => patchFormas(s, ids, (f) => comLinha(f, { alpha: 1 - Math.max(0, Math.min(100, Number(value))) / 100 })), "ln-transp");
        return;
      case "ln-dash":
      case "traco":
        this.editar((s) => patchFormas(s, ids, (f) => comLinha(f, { dash: value as never })));
        return;
      case "ln-head":
      case "ponta-ini":
        this.editar((s) => patchFormas(s, ids, (f) => comLinha(f, { head: (value || undefined) as never })));
        return;
      case "ln-tail":
      case "ponta-fim":
        this.editar((s) => patchFormas(s, ids, (f) => comLinha(f, { tail: (value || undefined) as never })));
        return;
      case "ln-cap":
        this.editar((s) => patchFormas(s, ids, (f) => comLinha(f, { cap: value as never })));
        return;

      // ---- efeitos ----
      case "sombra-pronta":
        this.editar((s) => patchFormas(s, ids, (f) => comSombra(f, SOMBRAS_PRONTAS[Number(value)]?.sombra ?? null)));
        return;
      case "sd-on":
        this.editar((s) => patchFormas(s, ids, (f) => comSombra(f, value === "1" ? {} : null)));
        return;
      case "sd-cor":
        this.editar((s) => patchFormas(s, ids, (f) => comSombra(f, { color: String(value) })), "sd");
        return;
      case "sd-transp":
        this.editar((s) => patchFormas(s, ids, (f) => comSombra(f, { alpha: 1 - Math.max(0, Math.min(100, Number(value))) / 100 })), "sd");
        return;
      case "sd-blur":
        this.editar((s) => patchFormas(s, ids, (f) => comSombra(f, { blur: Math.max(0, Number(value)) })), "sd");
        return;
      case "sd-dist":
        this.editar((s) => patchFormas(s, ids, (f) => comSombra(f, { dist: Math.max(0, Number(value)) })), "sd");
        return;
      case "sd-dir":
        this.editar((s) => patchFormas(s, ids, (f) => comSombra(f, { dir: Number(value) })), "sd");
        return;
      case "opac":
        this.editar((s) => patchFormas(s, ids, (f) => comOpacidade(f, Math.max(0, Math.min(100, Number(value))) / 100)), "opac");
        return;
      case "canto":
      case "canto-preset":
        this.editar((s) => patchFormas(s, ids, (f) => comCantos(f, this.cantosSel, Number(value))), "canto");
        return;
      case "canto-corte":
        // formas com canto cortado (snip*): o ajuste é o tamanho do corte, não um raio
        this.editar((s) => patchFormas(s, ids, (f) => comRaioDeCanto(f, Number(value))), "canto");
        return;
      case "canto-sel": {
        const c = value as Canto;
        const tem = this.cantosSel.includes(c);
        if (tem && this.cantosSel.length <= 1) return;
        this.selecionarCantos(tem ? this.cantosSel.filter((x) => x !== c) : [...this.cantosSel, c]);
        return;
      }
      case "canto-todos":
        this.selecionarCantos([...CANTOS]);
        return;
      case "canto-opostos": {
        const diagonal = this.cantosSel.length === 2 && this.cantosSel.includes("tl") && this.cantosSel.includes("br");
        this.selecionarCantos(diagonal ? ["tr", "bl"] : ["tl", "br"]);
        return;
      }
      case "estilo":
        return this.estiloRapido(String(value));

      // ---- tamanho, posição, giro ----
      case "tamanho-w":
      case "pos-w":
        this.editar((s) => patchFormas(s, ids, (f) => ({ box: { ...f.box, w: ((cmd === "pos-w" ? (Number(value) / 2.54) * 72 : Number(value)) / d.w) * 100 } })), "tam");
        return;
      case "tamanho-h":
      case "pos-h":
        this.editar((s) => patchFormas(s, ids, (f) => ({ box: { ...f.box, h: ((cmd === "pos-h" ? (Number(value) / 2.54) * 72 : Number(value)) / d.h) * 100 } })), "tam");
        return;
      case "pos-x":
        this.editar((s) => patchFormas(s, ids, (f) => ({ box: { ...f.box, x: (((Number(value) / 2.54) * 72) / d.w) * 100 } })), "pos");
        return;
      case "pos-y":
        this.editar((s) => patchFormas(s, ids, (f) => ({ box: { ...f.box, y: (((Number(value) / 2.54) * 72) / d.h) * 100 } })), "pos");
        return;
      case "rot":
        this.editar((s) => patchFormas(s, ids, { rot: ((Number(value) % 360) + 360) % 360 }), "rot");
        return;
      case "girar":
        this.editar((s) => patchFormas(s, ids, (f) => ({ rot: (((f.rot + Number(value)) % 360) + 360) % 360 })));
        return;
      case "espelhar":
        this.editar((s) => espelharFormas(s, ids, value === "v" ? "v" : "h"));
        return;
      case "bloquear":
        this.editar((s) => patchFormas(s, ids, (f) => ({ bloqueada: !f.bloqueada })));
        return;
      case "bloquear-forma":
        this.editar((s) => patchFormas(s, ids, { bloqueada: value === "1" }));
        return;
      case "img-forma":
        this.editar((s) =>
          patchFormas(s, ids, (f) => ({
            geom: String(value),
            adj: undefined,
            // trocar para retângulo/elipse descarta os cantos por canto (que só valem na família retangular)
            cantos: value === "rect" || value === "ellipse" ? undefined : f.cantos,
          }))
        );
        return;
      case "crop-reset":
        this.editar((s) => patchFormas(s, ids, { crop: undefined }));
        return;

      // ---- organizar ----
      case "z-topo":
        return this.editar((s) => ordemDasFormas(s, comGrupos(s, ids), "topo"));
      case "z-fundo":
        return this.editar((s) => ordemDasFormas(s, comGrupos(s, ids), "fundo"));
      case "z-frente":
        return this.editar((s) => ordemDasFormas(s, comGrupos(s, ids), "frente"));
      case "z-tras":
        return this.editar((s) => ordemDasFormas(s, comGrupos(s, ids), "tras"));
      case "agrupar":
        return this.editar((s) => agruparFormas(s, ids));
      case "desagrupar":
        return this.editar((s) => desagruparFormas(s, ids));
      case "alinhar":
        return this.editar((s) => alinharFormas(s, ids, String(value) as ModoAlinhar, d));
      case "distribuir":
        return this.editar((s) => distribuirFormas(s, ids, value === "v" ? "v" : "h", d));
      case "igualar":
        return this.editar((s) => igualarTamanho(s, ids, value === "altura" ? "altura" : value === "largura" ? "largura" : "ambos"));

      // ---- fundo da lâmina ----
      case "bg-tipo": {
        if (value === "tema") return this.editar((s) => ({ ...s, bg: undefined }));
        if (value === "image") return this.run("fundo-imagem");
        const t = themeOf(this.setup.theme);
        const atual = sl.bg?.kind === "solid" ? sl.bg.color! : t.bg;
        const bg: Fill = value === "solid" ? solido(atual) : gradiente(ajustarCor(atual, 1.1), ajustarCor(atual, 0.8), 90);
        return this.editar((s) => ({ ...s, bg }));
      }
      case "fundo-cor":
      case "bg-cor":
        return this.editar((s) => ({ ...s, bg: value === "tema" ? undefined : solido(String(value)) }), "fundo");
      case "fundo-grad": {
        const base = sl.bg?.kind === "solid" ? sl.bg.color! : this.estilo().acento;
        const ang: Record<string, number> = { baixo: 90, cima: 270, direita: 0, esquerda: 180, diagonal: 45 };
        const bg: Fill = value === "radial" ? { ...gradiente(ajustarCor(base, 1.3), ajustarCor(base, 0.75)), radial: true, angle: undefined } : gradiente(ajustarCor(base, 1.3), ajustarCor(base, 0.75), ang[String(value)] ?? 90);
        return this.editar((s) => ({ ...s, bg }));
      }
      case "bg-grad-angulo":
        return this.editar((s) => (s.bg?.kind === "gradient" ? { ...s, bg: { ...s.bg, angle: Number(value) } } : s), "fundo");
      case "fundo-todas": {
        const bg = sl.bg;
        this.registrar();
        this.slides = this.slides.map((x) => ({ ...x, bg }));
        this.markDirty();
        this.pintar();
        return;
      }

      // ---- exibição ----
      case "zoom-in":
        return this.setZoom(this.stage.zoomAtual + passoZoom(this.stage.zoomAtual));
      case "zoom-out":
        return this.setZoom(this.stage.zoomAtual - passoZoom(this.stage.zoomAtual));
      case "zoom-reset":
        return this.setZoom(100);
      case "alt-encaixe":
        this.encaixe = !this.encaixe;
        gravarFlag("mdc.pp.encaixe", this.encaixe);
        return this.atualizarUI();
      case "alt-grade":
        this.grade = !this.grade;
        gravarFlag("mdc.pp.grade", this.grade);
        return this.pintar();
      case "alt-fixas":
        this.fixas = !this.fixas;
        if (!this.fixas) this.selecao = this.selecao.filter((id) => !this.atual().shapes.find((s) => s.id === id)?.fixa);
        return this.pintar();
      case "painel-lateral":
        this.pane.querySelector<HTMLElement>("[data-side-toggle]")?.click();
        return;
      case "alt-faixa":
        this.faixaVertical = !this.faixaVertical;
        gravarFlag("mdc.pp.faixaVertical", this.faixaVertical);
        this.pane.querySelector(".pp-left")?.classList.toggle("faixa-vertical", this.faixaVertical);
        return this.atualizarUI();
    }
  }

  /** Cria uma tabela no meio da lâmina. */
  private inserirTabela(linhas: number, colunas: number): void {
    const d = this.dim();
    const est = this.estilo();
    const wPt = Math.min(d.w * 0.84, Math.max(colunas * 90, d.w * 0.4));
    const hPt = Math.min(d.h * 0.7, linhas * 34);
    const tipo = { size: 16, bold: false, italic: false, underline: false, strike: false, color: est.corTexto, font: est.fonte };
    const t = criarTabela(linhas, colunas, wPt, hPt, tipo, est.acento);
    const tot = tamanhoTotal(t);
    const forma: Shape = {
      id: Math.random().toString(36).slice(2, 10),
      kind: "forma",
      box: { x: 50 - (tot.w / d.w) * 50, y: Math.max(6, 50 - (tot.h / d.h) * 50), w: (tot.w / d.w) * 100, h: (tot.h / d.h) * 100 },
      text: "",
      fontFamily: est.fonte,
      fontSize: 16,
      color: est.corTexto,
      bold: false,
      italic: false,
      align: "esquerda",
      fill: "",
      src: "",
      rot: 0,
      geom: "rect",
      name: "Tabela",
      tabela: t,
    };
    this.registrar();
    this.substituirSlide({ ...this.atual(), shapes: [...this.atual().shapes, forma] });
    this.selecao = [forma.id];
    this.celulas = { id: forma.id, r0: 0, c0: 0, r1: 0, c1: 0 };
    this.markDirty();
    this.pintar();
  }

  /** Cria um gráfico no meio da lâmina (o desenho é em SVG; os dados se editam no painel). */
  private inserirGrafico(tipo: GraficoTipo): void {
    const d = this.dim();
    const est = this.estilo();
    const grafico = normalizarGrafico({ ...graficoPadrao(tipo), cores: paletaDeSeries(2, est.acento) });
    const nome = GRAFICO_TIPOS.find((t) => t.id === tipo)?.nome ?? "Colunas";
    const forma: Shape = {
      id: Math.random().toString(36).slice(2, 10),
      kind: "forma",
      box: caixaDoGrafico(d.w, d.h),
      text: "",
      fontFamily: est.fonte,
      fontSize: 16,
      color: est.corTexto,
      bold: false,
      italic: false,
      align: "centro",
      fill: "",
      src: "",
      rot: 0,
      geom: "rect",
      name: `Gráfico de ${nome.toLowerCase()}`,
      grafico,
    };
    this.registrar();
    this.substituirSlide({ ...this.atual(), shapes: [...this.atual().shapes, forma] });
    this.selecao = [forma.id];
    this.markDirty();
    this.pintar();
  }

  /**
   * Inserir ▸ Fluxo do Mermaid: cola-se o `flowchart` e o app monta os cartões e os conectores de
   * cantos suaves na lâmina (tudo nativo e editável). O diálogo valida na hora: sem nó, não fecha.
   */
  private async abrirFluxoMermaid(): Promise<void> {
    const codigo = await pedirTexto({
      titulo: "Fluxo do Mermaid",
      rotulo: "Código do fluxograma",
      dica: "Um `flowchart TD` (ou LR). Ex.: A[Pedido] --> B[Análise]; um rótulo sai com -->|sim|.",
      ok: "Criar na lâmina",
      linhas: 9,
      validar: (v) => (lerFluxoMermaid(v).nos.length ? null : "Não encontrei nenhum nó — comece com `flowchart TD` e escreva A[Texto] --> B[Texto]."),
    });
    if (codigo === null) return;
    const fluxo = lerFluxoMermaid(codigo);
    const formas = fluxoParaFormas(fluxo, this.dim(), this.estilo());
    if (!formas.length) {
      toast("O fluxo não tem nada para desenhar.", "info", 3200);
      return;
    }
    // lâmina recém-criada (só com as caixas do layout): vira "Em branco" e recebe o fluxo.
    // Se já tem conteúdo, o fluxo ganha uma lâmina nova em branco logo depois — nada fica por baixo.
    const vazia = !this.atual().shapes.some((s) => !s.fixa);
    if (vazia) {
      this.editar((s) => ({ ...s, layout: "vazio" as SlideLayout, shapes: [...formas] }));
    } else {
      const nova = novaLamina("vazio" as SlideLayout, this.estilo(), this.atual());
      const lista = this.slides.slice();
      lista.splice(this.indice + 1, 0, { ...nova, shapes: [...nova.shapes, ...formas] });
      this.registrar();
      this.slides = lista;
      this.indice += 1;
      this.editando = null;
      this.markDirty();
      this.pintar();
    }
    this.selecionar(formas.map((f) => f.id));
    toast(
      `${fluxo.nos.length} cartão(ões) e ${fluxo.arestas.length} conector(es) criados${vazia ? " nesta lâmina" : " numa lâmina nova em branco"}.`,
      "ok",
      4200
    );
  }

  // ------------------------------------------------------------------
  // gráficos
  // ------------------------------------------------------------------

  /** O gráfico selecionado (a forma principal), se houver. */
  private graficoAtual(): Shape | undefined {
    const f = this.principal();
    return f?.grafico ? f : undefined;
  }

  /** Muda os dados ou as opções do gráfico selecionado (uma entrada no desfazer por chamada). */
  private editarGrafico(fn: (g: NonNullable<Shape["grafico"]>) => NonNullable<Shape["grafico"]>, chave = ""): void {
    const f = this.graficoAtual();
    if (!f?.grafico) return;
    this.editar(
      (sl) => ({
        ...sl,
        shapes: sl.shapes.map((s) => (s.id !== f.id || !s.grafico ? s : { ...s, grafico: normalizarGrafico(fn(s.grafico)) })),
      }),
      chave
    );
  }

  /** Comandos do gráfico selecionado. Devolve true quando tratou. */
  private comandoDeGrafico(cmd: string, value?: string): boolean {
    if (!this.graficoAtual()) return false;
    switch (cmd) {
      case "grafico-tipo": {
        if (!GRAFICO_TIPOS.some((t) => t.id === value)) return true;
        this.editarGrafico((g) => comTipo(g, value as GraficoTipo), "grafico-tipo");
        return true;
      }
      case "grafico-titulo":
        this.editarGrafico((g) => comTitulo(g, String(value ?? "")), "grafico-titulo");
        return true;
      case "grafico-legenda":
        this.editarGrafico((g) => comOpcao(g, "legenda", value === "1"));
        return true;
      case "grafico-rotulos":
        this.editarGrafico((g) => comOpcao(g, "rotulos", value === "1"));
        return true;
      case "grafico-empilhado":
        this.editarGrafico((g) => comOpcao(g, "empilhado", value === "1"));
        return true;
      case "grafico-add-cat":
        this.editarGrafico((g) => addCategoria(g), "grafico-cat");
        return true;
      case "grafico-del-cat":
        this.editarGrafico((g) => delCategoria(g, Number(value)), "grafico-cat");
        return true;
      case "grafico-add-serie":
        this.editarGrafico((g) => addSerie(g), "grafico-serie");
        return true;
      case "grafico-del-serie":
        this.editarGrafico((g) => delSerie(g, Number(value)), "grafico-serie");
        return true;
    }
    if (cmd.startsWith("grafico-cor:")) {
      const j = Number(cmd.slice("grafico-cor:".length));
      const cor = String(value ?? "").replace(/^#/, "");
      if (!/^[0-9A-Fa-f]{6}$/.test(cor)) return true;
      this.editarGrafico((g) => {
        const cores = paletaDeSeries(g.series.length, undefined, g.cores);
        cores[j] = cor.toUpperCase();
        return comCores(g, cores);
      }, "grafico-cor");
      return true;
    }
    if (cmd.startsWith("grafico-cat:")) {
      const i = Number(cmd.slice("grafico-cat:".length));
      this.editarGrafico((g) => setCategoria(g, i, String(value ?? "")), `grafico-cat-${i}`);
      return true;
    }
    if (cmd.startsWith("grafico-serie:")) {
      const j = Number(cmd.slice("grafico-serie:".length));
      this.editarGrafico((g) => setSerieNome(g, j, String(value ?? "")), `grafico-serie-${j}`);
      return true;
    }
    if (cmd.startsWith("grafico-val:")) {
      const [i, j] = cmd.slice("grafico-val:".length).split(":").map(Number);
      const v = Number(String(value ?? "").replace(",", "."));
      this.editarGrafico((g) => setValor(g, i, j, Number.isFinite(v) ? v : 0), `grafico-val-${i}-${j}`);
      return true;
    }
    return false;
  }

  /** Comandos que mudam de significado quando a forma selecionada é uma tabela. Devolve true se tratou. */
  private comandoDeTabela(cmd: string, value?: string): boolean {
    const sel = this.selDaTabela();
    switch (cmd) {
      case "preench": {
        const fill: Fill | null = value === "none" ? null : { kind: "solid", color: String(value), alpha: 1 };
        this.editarTabela((t) => preencherCelulas(t, sel, fill));
        return true;
      }
      case "contorno":
      case "ln-cor":
        this.editarTabela((t) => bordasCelulas(t, sel, value === "none" ? "nenhuma" : "todas", { color: String(value === "none" ? "000000" : value), alpha: 1, w: 1, dash: "solid" }));
        return true;
      case "v-topo":
      case "v-meio":
      case "v-base":
        this.editarTabela((t) => alinharVerticalmente(t, sel, cmd === "v-topo" ? "t" : cmd === "v-meio" ? "ctr" : "b"));
        return true;
      case "tabela-linha-acima":
        this.editarTabela((t) => inserirLinha(t, sel.r0, sel.r0));
        return true;
      case "tabela-linha-abaixo":
        this.editarTabela((t) => inserirLinha(t, sel.r1 + 1, sel.r1));
        return true;
      case "tabela-col-esquerda":
        this.editarTabela((t) => inserirColuna(t, sel.c0, sel.c0));
        return true;
      case "tabela-col-direita":
        this.editarTabela((t) => inserirColuna(t, sel.c1 + 1, sel.c1));
        return true;
      case "tabela-del-linha":
        this.editarTabela((t) => {
          let n = t;
          for (let r = sel.r1; r >= sel.r0; r--) n = excluirLinha(n, r);
          return n;
        });
        this.celulas = null;
        this.atualizarUI();
        return true;
      case "tabela-del-coluna":
        this.editarTabela((t) => {
          let n = t;
          for (let c = sel.c1; c >= sel.c0; c--) n = excluirColuna(n, c);
          return n;
        });
        this.celulas = null;
        this.atualizarUI();
        return true;
      case "tabela-mesclar":
        this.editarTabela((t) => mesclar(t, sel));
        return true;
      case "tabela-dividir":
        this.editarTabela((t) => dividir(t, sel.r0, sel.c0));
        return true;
      case "tabela-preset":
        this.editarTabela((t) => aplicarPreset(t, String(value) as PresetTabela, this.estilo().acento, this.estilo().corTexto));
        return true;
      case "tabela-cabecalho":
      case "tabela-faixas":
      case "tabela-primeira-coluna": {
        const chave = cmd === "tabela-cabecalho" ? "cabecalho" : cmd === "tabela-faixas" ? "faixas" : "primeiraColuna";
        const preset = (value === "1" ? "ligar" : "desligar") as string;
        void preset;
        this.editarTabela((t) => ({ ...t, [chave]: value === "1" }));
        return true;
      }
      case "tabela-reaplicar":
        this.editarTabela((t) => aplicarPreset(t, String(value ?? t.preset ?? "acento") as PresetTabela, this.estilo().acento, this.estilo().corTexto));
        return true;
      case "tabela-bordas": {
        const [modo, cor, w] = String(value).split("|");
        this.editarTabela((t) => bordasCelulas(t, sel, modo as ModoBorda, { color: cor || "000000", alpha: 1, w: Number(w) || 1, dash: "solid" }));
        return true;
      }
      case "tabela-largura-coluna":
        this.editarTabela((t) => larguraDaColuna(t, sel.c0, (Number(value) / 2.54) * 72), "tabela-larg");
        return true;
      case "tabela-altura-linha":
        this.editarTabela((t) => alturaDaLinha(t, sel.r0, (Number(value) / 2.54) * 72), "tabela-alt");
        return true;
      case "tabela-excluir":
        this.run("excluir");
        return true;
      case "tabela-limpar":
        this.editarTabela((t) => ({
          ...t,
          celulas: t.celulas.map((linha, r) => linha.map((c, col) => (r >= sel.r0 && r <= sel.r1 && col >= sel.c0 && col <= sel.c1 ? { ...c, paras: c.paras.map((p) => ({ ...p, runs: [] })) } : c))),
        }));
        return true;
    }
    return false;
  }

  private gradienteParada(cmd: string, value?: string): void {
    const i = Number(cmd.split(":")[1]);
    const campo = cmd.startsWith("grad-cor") ? "color" : "pos";
    this.editar(
      (s) =>
        patchFormas(s, this.selecao, (f) => {
          const fx = f.fillX;
          if (fx?.kind !== "gradient" || !fx.stops) return {};
          const stops = fx.stops.map((p, k) => (k === i ? (campo === "color" ? { ...p, color: String(value) } : { ...p, pos: Math.max(0, Math.min(100, Number(value))) }) : p));
          if (campo === "pos") stops.sort((a, b) => a.pos - b.pos);
          return comPreenchimento(f, { ...fx, stops });
        }),
      "grad-parada"
    );
  }

  /** Estilos prontos da aba Formato (aplicam preenchimento, linha, sombra e cor do texto de uma vez). */
  private estiloRapido(nome: string): void {
    const est = this.estilo();
    const acento = est.acento;
    const claro = (h: string) => {
      const c = h.padEnd(6, "0");
      return 0.299 * parseInt(c.slice(0, 2), 16) + 0.587 * parseInt(c.slice(2, 4), 16) + 0.114 * parseInt(c.slice(4, 6), 16) > 150;
    };
    const aplicar = (f: Shape): Shape => {
      let n: Shape = { ...f };
      const ehLinha = f.geom === "line" || !!f.geom?.endsWith("Connector3");
      if (ehLinha) return comLinha(n, { color: acento, w: 2.25 });
      let corTexto = "1C212B";
      if (nome === "cheio") {
        n = comPreenchimento(n, solido(acento));
        n = comLinha(n, { color: ajustarCor(acento, 0.7), w: 1 });
        n = comSombra(n, null);
        corTexto = claro(acento) ? "1C212B" : "FFFFFF";
      } else if (nome === "contorno") {
        n = comPreenchimento(n, { kind: "none" });
        n = comLinha(n, { color: acento, w: 2.25 });
        n = comSombra(n, null);
        corTexto = acento;
      } else if (nome === "gradiente") {
        n = comPreenchimento(n, gradiente(ajustarCor(acento, 1.3), ajustarCor(acento, 0.7), 90));
        n = comLinha(n, null);
        n = comSombra(n, SOMBRAS_PRONTAS[1].sombra);
        corTexto = "FFFFFF";
      } else if (nome === "cartao") {
        n = comPreenchimento(n, solido("FFFFFF"));
        n = comLinha(n, { color: "E5E7EB", w: 0.75 });
        n = comSombra(n, SOMBRAS_PRONTAS[1].sombra);
      } else if (nome === "escuro") {
        n = comPreenchimento(n, solido("0F2738"));
        n = comLinha(n, null);
        n = comSombra(n, null);
        corTexto = "FFFFFF";
      } else if (nome === "suave") {
        n = comPreenchimento(n, solido(ajustarCor(acento, 1.85)));
        n = comLinha(n, { color: acento, w: 1 });
        n = comSombra(n, null);
        corTexto = ajustarCor(acento, 0.55);
      }
      if (n.paras) n = { ...n, color: corTexto, paras: parasComEstilo(n.paras, { color: corTexto }) };
      return n;
    };
    this.editar((s) => patchFormas(s, this.selecao, aplicar));
  }

  // ------------------------------------------------------------------
  // copiar e colar
  // ------------------------------------------------------------------

  private copiar(): void {
    const ids = comGrupos(this.atual(), this.selecao);
    const formas = this.atual().shapes.filter((s) => ids.includes(s.id));
    if (!formas.length) return;
    areaDeTransferencia = formas.map((s) => JSON.parse(JSON.stringify(s)) as Shape);
    // também no sistema, para colar em outra janela do app
    try {
      void navigator.clipboard?.writeText(`mdc-formas:${JSON.stringify(areaDeTransferencia)}`);
    } catch {
      /* sem acesso à área de transferência */
    }
    this.atualizarUI();
  }

  private colar(): void {
    if (!areaDeTransferencia.length) return;
    this.registrar();
    const r = colarFormas(this.atual(), areaDeTransferencia);
    this.substituirSlide(r.slide);
    this.selecao = r.novos;
    this.markDirty();
    this.pintar();
  }

  private aoColarDoSistema(e: ClipboardEvent): void {
    if (!this.ativo()) return;
    const alvo = e.target as HTMLElement | null;
    if (alvo && (alvo.closest("textarea, input, select") || (alvo.isContentEditable && this.editando))) return;
    const dt = e.clipboardData;
    if (!dt) return;
    const img = Array.from(dt.files).find((f) => f.type.startsWith("image/"));
    if (img) {
      e.preventDefault();
      void this.lerArquivoDeImagem(img).then((src) => this.insertImage(src));
      return;
    }
    const texto = dt.getData("text/plain");
    if (texto.startsWith("mdc-formas:")) {
      try {
        const formas = JSON.parse(texto.slice(11)) as Shape[];
        if (Array.isArray(formas) && formas.length) {
          e.preventDefault();
          areaDeTransferencia = formas;
          this.colar();
          return;
        }
      } catch {
        /* texto comum */
      }
    }
    if (texto.trim()) {
      // texto solto vira uma caixa de texto
      e.preventDefault();
      const d = this.dim();
      const caixa = novaCaixaDeTexto(caixaCentrada(50, 50, Math.min(d.w * 0.6, 420), 60, d), this.estilo());
      caixa.paras = parasComTexto(caixa.paras ?? [], texto.trim(), this.estiloDeDigitacao(caixa));
      caixa.text = texto.trim();
      this.registrar();
      this.substituirSlide({ ...this.atual(), shapes: [...this.atual().shapes, caixa] });
      this.selecao = [caixa.id];
      this.markDirty();
      this.pintar();
    } else if (areaDeTransferencia.length) {
      e.preventDefault();
      this.colar();
    }
  }

  private lerArquivoDeImagem(arq: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result));
      r.onerror = () => reject(r.error);
      r.readAsDataURL(arq);
    });
  }

  // ------------------------------------------------------------------
  // teclado
  // ------------------------------------------------------------------

  /** A tela de apresentação está à vista? */
  private ativo(): boolean {
    const c = document.body.classList;
    return c.contains("ppt-open") && !c.contains("home-open") && !c.contains("settings-open") && !c.contains("apresentando") && this.pane.offsetParent !== null;
  }

  private aoTecla(e: KeyboardEvent): void {
    if (!this.ativo() || e.defaultPrevented) return;
    const alvo = e.target as HTMLElement;
    const digitando = !!alvo.closest("input, textarea, select") || alvo.isContentEditable;
    const ctrl = e.ctrlKey || e.metaKey;
    const k = e.key.toLowerCase();

    // dentro de uma caixa de texto em edição: os atalhos de formatação e o desfazer/refazer são nossos
    if (this.editando && alvo.isContentEditable) {
      if (ctrl && k === "z" && !e.shiftKey) {
        e.preventDefault();
        this.run("desfazer");
        return;
      }
      if (ctrl && (k === "y" || (k === "z" && e.shiftKey))) {
        e.preventDefault();
        this.run("refazer");
        return;
      }
      if (ctrl && !e.shiftKey && (k === "b" || k === "i" || k === "u")) {
        e.preventDefault();
        this.run(k === "b" ? "negrito" : k === "i" ? "italico" : "sublinhado");
      } else if (ctrl && !e.shiftKey && (k === "l" || k === "e" || k === "r" || k === "j")) {
        e.preventDefault();
        this.run(k === "l" ? "alinhar-esquerda" : k === "e" ? "alinhar-centro" : k === "r" ? "alinhar-direita" : "alinhar-justificado");
      } else if (ctrl && e.shiftKey && (e.key === ">" || e.key === ".")) {
        e.preventDefault();
        this.run("maior");
      } else if (ctrl && e.shiftKey && (e.key === "<" || e.key === ",")) {
        e.preventDefault();
        this.run("menor");
      }
      return;
    }
    if (digitando) return;

    if (ctrl && k === "z" && !e.shiftKey) return this.consumir(e, () => this.run("desfazer"));
    if (ctrl && (k === "y" || (k === "z" && e.shiftKey))) return this.consumir(e, () => this.run("refazer"));
    if (ctrl && k === "c") return this.consumir(e, () => this.copiar());
    if (ctrl && k === "x") return this.consumir(e, () => this.run("recortar"));
    if (ctrl && k === "v") return; // quem cola é o evento "paste"
    if (ctrl && k === "d") return this.consumir(e, () => this.run("duplicar"));
    if (ctrl && k === "a") return this.consumir(e, () => this.run("sel-tudo"));
    if (ctrl && k === "g") return this.consumir(e, () => this.run(e.shiftKey ? "desagrupar" : "agrupar"));
    if (ctrl && !e.shiftKey && (k === "b" || k === "i" || k === "u") && this.selecao.length) return this.consumir(e, () => this.run(k === "b" ? "negrito" : k === "i" ? "italico" : "sublinhado"));

    if (e.key === "Escape") {
      if (this.ferramenta) this.consumir(e, () => this.run("ferramenta", ""));
      else if (this.selecao.length) this.consumir(e, () => this.selecionar([]));
      return;
    }
    if (this.tabelaAtual() && this.celulas && this.selecao.length === 1) {
      const tab = this.tabelaAtual()!.tabela!;
      const c = this.celulas;
      if (e.key === "Delete" || e.key === "Backspace") return this.consumir(e, () => this.run("tabela-limpar"));
      if (e.key === "Tab") return this.consumir(e, () => this.moverCelula(e.shiftKey ? -1 : 1, false));
      if (e.key.startsWith("Arrow")) {
        const dr = e.key === "ArrowDown" ? 1 : e.key === "ArrowUp" ? -1 : 0;
        const dc = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
        const r = Math.max(0, Math.min(tab.linhas.length - 1, c.r0 + dr));
        const col = Math.max(0, Math.min(tab.colunas.length - 1, c.c0 + dc));
        return this.consumir(e, () => {
          this.celulas = { id: c.id, r0: r, c0: col, r1: e.shiftKey ? Math.max(r, c.r1) : r, c1: e.shiftKey ? Math.max(col, c.c1) : col };
          this.atualizarUI();
        });
      }
      if (e.key === "Escape") return this.consumir(e, () => { this.celulas = null; this.atualizarUI(); });
      // digitar uma letra começa a escrever na célula
      if (e.key.length === 1 && !ctrl && !e.altKey) {
        const id = c.id;
        this.entrarEdicao(id, [c.r0, c.c0]);
        return;
      }
    }
    if (e.key === "Delete" || e.key === "Backspace") {
      if (this.selecao.length) this.consumir(e, () => this.run("excluir"));
      return;
    }
    if ((e.key === "Enter" || e.key === "F2") && this.selecao.length === 1) return this.consumir(e, () => this.entrarEdicao(this.selecao[0], this.celulas?.id === this.selecao[0] ? [this.celulas.r0, this.celulas.c0] : undefined));
    if (e.key === "Tab" && this.atual().shapes.length) {
      const lista = this.atual().shapes.filter((s) => !s.fixa || this.fixas);
      const i = lista.findIndex((s) => s.id === this.selecao[this.selecao.length - 1]);
      const prox = lista[(i + (e.shiftKey ? -1 : 1) + lista.length) % lista.length];
      if (prox) this.consumir(e, () => this.selecionar([prox.id]));
      return;
    }
    if (e.key.startsWith("Arrow")) {
      if (this.selecao.length) {
        const passo = e.shiftKey ? 1 : e.altKey ? 0.05 : 0.2;
        const d = this.dim();
        const dx = e.key === "ArrowLeft" ? -passo : e.key === "ArrowRight" ? passo : 0;
        const dy = e.key === "ArrowUp" ? -passo : e.key === "ArrowDown" ? passo : 0;
        return this.consumir(e, () => {
          this.registrar("setas");
          const ids = comGrupos(this.atual(), this.selecao);
          this.substituirSlide({ ...this.atual(), shapes: this.atual().shapes.map((s) => (ids.includes(s.id) && !s.bloqueada ? { ...s, box: { ...s.box, x: s.box.x + dx, y: s.box.y + dy * (d.w / d.h) } } : s)) });
          this.markDirty();
          this.pintar();
        });
      }
      if (e.key === "ArrowRight" || e.key === "ArrowDown") this.consumir(e, () => this.irPara(this.indice + 1));
      if (e.key === "ArrowLeft" || e.key === "ArrowUp") this.consumir(e, () => this.irPara(this.indice - 1));
    }
  }

  private consumir(e: KeyboardEvent, fn: () => void): void {
    e.preventDefault();
    e.stopPropagation();
    fn();
  }

  // ------------------------------------------------------------------
  // menu de contexto
  // ------------------------------------------------------------------

  private menuDeContexto(e: MouseEvent): void {
    // botão direito + arrasto = panorama: não abre o menu (o clique parado continua abrindo)
    if (this.stage.consumirPanorama()) return;
    e.preventDefault();
    const alvo = e.target as HTMLElement;
    const formaEl = alvo.closest<HTMLElement>(".pp-shape[data-shape]");
    const id = formaEl?.dataset.shape;
    if (id && !this.selecao.includes(id)) this.selecionar(comGrupos(this.atual(), [id]));
    const tem = this.selecao.length > 0;
    const itens: [string, string, boolean][] = tem
      ? [
          ["editar-texto", "Editar texto", this.selecao.length === 1 && !!this.principal()?.paras],
          ["recortar", "Recortar", true],
          ["copiar", "Copiar", true],
          ["colar", "Colar", areaDeTransferencia.length > 0],
          ["duplicar", "Duplicar", true],
          ["excluir", "Excluir", true],
          ["z-topo", "Trazer para a frente", true],
          ["z-fundo", "Enviar para trás", true],
          ["agrupar", "Agrupar", this.selecao.length > 1],
          ["desagrupar", "Desagrupar", this.formas().some((s) => !!s.grupo)],
        ]
      : [
          ["colar", "Colar", areaDeTransferencia.length > 0],
          ["sel-tudo", "Selecionar tudo", true],
        ];
    const ancora = document.createElement("span");
    ancora.style.cssText = `position:fixed;left:${e.clientX}px;top:${e.clientY}px;width:1px;height:1px`;
    document.body.append(ancora);
    const el = abrirPopup(ancora, itens.map(([c, n, ok]) => `<button type="button" class="pp-pop-item" data-c="${c}"${ok ? "" : " disabled"}>${n}</button>`).join(""), { classe: "pp-pop-menu", aoFechar: () => ancora.remove() });
    el.addEventListener("click", (ev) => {
      const b = (ev.target as HTMLElement).closest<HTMLButtonElement>("[data-c]");
      if (!b || b.disabled) return;
      fecharPopup();
      const c = b.dataset.c!;
      if (c === "editar-texto") this.entrarEdicao(this.selecao[0]);
      else this.run(c);
    });
  }

  // ------------------------------------------------------------------
  // outras ações
  // ------------------------------------------------------------------

  /** Arrastar na faixa: leva a lâmina `de` para a posição `para` (índice final). */
  private moverLaminaPara(de: number, para: number): void {
    if (de === para || de < 0 || para < 0 || de >= this.slides.length || para >= this.slides.length) return;
    this.registrar();
    const r = moveSlide(this.deck, de, para);
    this.slides = r.deck.slides;
    this.indice = r.index;
    this.selecao = [];
    this.markDirty();
    this.pintar();
  }

  private moverLamina(delta: number): void {
    this.registrar();
    const r = moveSlide(this.deck, this.indice, this.indice + delta);
    this.slides = r.deck.slides;
    this.indice = r.index;
    this.markDirty();
    this.pintar();
  }

  /** Insere (ou aplica) uma imagem; `destino` vem do pedido feito à fita/painel. */
  insertImage(src: string, destino?: string): void {
    const como = destino ?? this.destinoImagem;
    this.destinoImagem = "inserir";
    const ref = registrarMidia(this.setup, src);
    const img = new Image();
    img.onload = () => {
      const w = img.naturalWidth;
      const h = img.naturalHeight;
      if (como === "fundo") {
        this.editar((s) => ({ ...s, bg: { kind: "image", src: ref } }));
      } else if (como === "preencher" && this.selecao.length) {
        this.editar((s) => patchFormas(s, this.selecao, (f) => comPreenchimento(f, { kind: "image", src: ref })));
      } else if (como === "trocar" && this.principal()?.kind === "imagem") {
        this.editar((s) => patchFormas(s, this.selecao, (f) => (f.kind === "imagem" ? { src: ref } : {})));
      } else {
        const forma = novaImagem(ref, w, h, this.dim(), this.estilo());
        this.registrar();
        this.substituirSlide({ ...this.atual(), shapes: [...this.atual().shapes, forma] });
        this.selecao = [forma.id];
        this.markDirty();
        this.pintar();
      }
    };
    img.onerror = () => {
      /* imagem inválida: ignora */
    };
    img.src = src;
  }

  private mudarNotas(notes: string): void {
    this.substituirSlide({ ...this.atual(), notes });
    this.markDirty();
  }

  /** Troca a transição da lâmina atual (a fita manda o tipo, a direção ou a duração). */
  private mudarTransicao(t: Transicao | undefined): void {
    const atual = this.atual();
    if (!atual.transicaoXml && JSON.stringify(atual.transicao ?? null) === JSON.stringify(t ?? null)) return;
    // escolher uma transição na fita substitui a que veio do .pptx (inclusive a preservada crua)
    this.editar((s) => ({ ...s, transicao: t, transicaoXml: undefined }), "transicao");
  }

  /** Prévia da transição no palco, sem entrar no F5 (as animações estão em styles/slides.css). */
  private preverTransicao(): void {
    const t = normalizarTransicao(this.atual().transicao);
    if (!t || t.tipo === "none" || window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    const el = this.slideEl;
    const ms = Math.round(duracaoDe(t) * 1000);
    const classe = t.tipo === "fade" ? "anim-fade-entra" : t.tipo === "wipe" ? "anim-wipe-entra" : t.tipo === "split" ? "anim-split-entra" : "anim-desliza-entra";
    const dir = `trans-${direcaoDe(t)}`;
    let pronto = false;
    const fim = () => {
      if (pronto) return;
      pronto = true;
      el.classList.remove(dir, classe);
      el.style.removeProperty("--trans-dur");
    };
    el.classList.remove(dir, classe);
    void el.offsetWidth; // reinicia a animação quando a prévia é pedida de novo
    el.style.setProperty("--trans-dur", `${ms}ms`);
    el.classList.add(dir, classe);
    el.addEventListener("animationend", fim, { once: true });
    window.setTimeout(fim, ms + 150);
  }

  // ------------------------------------------------------------------
  // animações de forma (aba Animações)
  // ------------------------------------------------------------------

  /** Aplica uma mudança na lista de animações da lâmina (sem criar lâmina nova à toa). */
  private editarAnimacoes(fn: (lista: Animacao[] | undefined) => Animacao[] | undefined, chave: string): void {
    this.editar((s) => {
      const depois = fn(s.animacoes);
      const mudou = JSON.stringify(depois ?? null) !== JSON.stringify(s.animacoes ?? null);
      // escolher uma animação na fita substitui o que veio cru do .pptx (como na transição)
      if (!mudou && !s.timingXml) return s;
      return { ...s, animacoes: depois, timingXml: undefined };
    }, chave);
  }

  /** Aplica um efeito à seleção (a ordem é a da aplicação). */
  private aplicarAnimacao(tipo: AnimacaoTipo): void {
    if (!this.selecao.length) return;
    const ids = comGrupos(this.atual(), this.selecao);
    this.editarAnimacoes((lista) => {
      let nova = lista;
      for (const id of ids) nova = comAnimacao(nova, id, tipo);
      return nova;
    }, "animacao");
  }

  /** Muda o início do efeito da forma principal (ao clicar / com / depois do anterior). */
  private mudarInicioAnimacao(inicio: AnimacaoInicio): void {
    const f = this.principal();
    if (!f) return;
    this.editarAnimacoes((lista) => comInicio(lista, f.id, inicio), "animacao");
  }

  /** Muda a duração do efeito da forma principal (só nos efeitos com transição). */
  private mudarDuracaoAnimacao(segundos: number): void {
    const f = this.principal();
    if (!f || !Number.isFinite(segundos)) return;
    this.editarAnimacoes((lista) => comDuracao(lista, f.id, segundos), "animacao");
  }

  /** Muda o atraso do efeito da forma principal (0 = sem atraso). */
  private mudarAtrasoAnimacao(segundos: number): void {
    const f = this.principal();
    if (!f || !Number.isFinite(segundos)) return;
    this.editarAnimacoes((lista) => comAtraso(lista, f.id, segundos), "animacao");
  }

  /** Muda a direção da trajetória da forma principal. */
  private mudarDirecaoAnimacao(direcao: AnimacaoDirecao): void {
    const f = this.principal();
    if (!f) return;
    this.editarAnimacoes((lista) => comDirecao(lista, f.id, direcao), "animacao");
  }

  /** Liga/desliga o "por parágrafo" do efeito da forma principal. */
  private mudarPorParagrafoAnimacao(ativo: boolean): void {
    const f = this.principal();
    if (!f) return;
    this.editarAnimacoes((lista) => comPorParagrafo(lista, f.id, ativo), "animacao");
  }

  /** Tira o efeito da forma (a principal ou a indicada pelo painel de animação). */
  private removerAnimacao(forma?: string): void {
    const id = forma ?? this.principal()?.id;
    if (!id) return;
    this.editarAnimacoes((lista) => semAnimacao(lista, id), "animacao-remover");
  }

  /** Move o efeito da forma na ordem (passo -1 sobe, +1 desce). */
  private moverAnimacaoNaOrdem(passo: number, forma?: string): void {
    const id = forma ?? this.principal()?.id;
    if (!id) return;
    this.editarAnimacoes((lista) => moverAnimacao(lista, id, passo), "animacao-ordem");
  }

  /** Prévia das animações no palco: toca a sequência inteira, sem esperar cliques. */
  private preverAnimacoes(): void {
    const lista = normalizarAnimacoes(this.atual().animacoes);
    if (!lista?.length) return;
    this.animPreview?.cancelar();
    this.animPreview = iniciarAnimacoes(this.slideEl, lista, { automatico: true });
  }

  // ------------------------------------------------------------------
  // mídia (áudio/vídeo)
  // ------------------------------------------------------------------

  /**
   * Insere um áudio/vídeo na lâmina (o App chama isto depois de escolher o arquivo).
   * O arquivo vira `media:ID`; a capa é o primeiro quadro do vídeo ou um cartão do motor.
   */
  async insertMedia(src: string, tipo?: string, nome?: string): Promise<void> {
    const trocar = tipo === "trocar" || this.destinoMidia === "trocar";
    this.destinoMidia = null;
    const tipoFinal = tipo === "audio" || tipo === "video" ? tipo : (tipoDeArquivo(nome ?? "") ?? "video");
    const ref = registrarMidia(this.setup, src);
    const cartao = cartaoParaPng(midiaPadrao(tipoFinal, nome));
    const poster = tipoFinal === "video" ? ((await capturarQuadro(src)) ?? cartao) : cartao;
    if (trocar) {
      const alvo = this.principal();
      if (alvo?.midia) {
        this.editar(
          (s) =>
            patchFormas(s, this.selecao, (f) =>
              f.midia ? { src: ref, midia: normalizarMidia({ ...f.midia, tipo: tipoFinal, poster: poster ?? f.midia.poster, nome: nome ?? f.midia.nome }) } : {}
            ),
          "midia-arquivo"
        );
        return;
      }
    }
    const midia = normalizarMidia({ ...midiaPadrao(tipoFinal, nome), poster: poster ?? undefined });
    const forma: Shape = {
      id: Math.random().toString(36).slice(2, 10),
      kind: "imagem",
      box: caixaDaMidia(tipoFinal, this.dim().w, this.dim().h),
      text: "",
      fontFamily: this.estilo().fonte,
      fontSize: 16,
      color: this.estilo().corTexto,
      bold: false,
      italic: false,
      align: "centro",
      fill: "",
      src: ref,
      rot: 0,
      geom: "rect",
      name: `${MIDIA_ROTULOS[tipoFinal]}${nome ? `: ${nome}` : ""}`,
      midia,
    };
    this.registrar();
    this.substituirSlide({ ...this.atual(), shapes: [...this.atual().shapes, forma] });
    this.selecao = [forma.id];
    this.markDirty();
    this.pintar();
  }

  /** A mídia selecionada (a forma principal), se houver. */
  private midiaAtual(): Shape | undefined {
    const f = this.principal();
    return f?.midia ? f : undefined;
  }

  /** Muda as opções da mídia selecionada (uma entrada no desfazer por chamada). */
  private editarMidia(fn: (m: NonNullable<Shape["midia"]>) => NonNullable<Shape["midia"]>, chave = ""): void {
    const f = this.midiaAtual();
    if (!f?.midia) return;
    this.editar(
      (sl) => ({
        ...sl,
        shapes: sl.shapes.map((s) => (s.id !== f.id || !s.midia ? s : { ...s, midia: normalizarMidia(fn(s.midia)) })),
      }),
      chave
    );
  }

  /** Comandos da mídia selecionada. Devolve true quando tratou. */
  private comandoDeMidia(cmd: string, value?: string): boolean {
    const f = this.midiaAtual();
    if (!f?.midia) return false;
    switch (cmd) {
      case "midia-auto":
        this.editarMidia((m) => comOpcaoMidia(m, "auto", value === "1"));
        return true;
      case "midia-loop":
        this.editarMidia((m) => comOpcaoMidia(m, "loop", value === "1"));
        return true;
      case "midia-controles":
        this.editarMidia((m) => comOpcaoMidia(m, "controles", value === "1"));
        return true;
      case "midia-continuar":
        this.editarMidia((m) => comOpcaoMidia(m, "continuar", value === "1"));
        return true;
      case "midia-volume": {
        const v = Number(String(value ?? "").replace(",", "."));
        this.editarMidia((m) => comVolumeDaMidia(m, Number.isFinite(v) ? v / 100 : 1), "midia-vol");
        return true;
      }
      case "midia-trocar":
        this.destinoMidia = "trocar";
        this.opts.onPickMedia?.("trocar");
        return true;
      case "midia-reproduzir": {
        // prévia no palco: toca/pausa o player da forma
        const el = this.slideEl.querySelector<HTMLMediaElement>(`[data-shape="${f.id}"] [data-player]`);
        if (el) {
          if (el.paused) void el.play().catch(() => {});
          else el.pause();
        }
        return true;
      }
    }
    if (cmd === "midia-corte:inicio" || cmd === "midia-corte:fim") {
      const v = Number(String(value ?? "").replace(",", "."));
      const noInicio = cmd.endsWith("inicio");
      this.editarMidia((m) => {
        const inicio = noInicio ? (Number.isFinite(v) ? v : 0) : (m.corte?.inicio ?? 0);
        const fim = noInicio ? m.corte?.fim : Number.isFinite(v) && v > 0 ? v : undefined;
        return comCorteDaMidia(m, inicio, fim);
      }, "midia-corte");
      return true;
    }
    return false;
  }

  /** Quando a lâmina não tem formas, clicar no markdown edita o texto. */
  private editarMarkdown(): void {
    const md = this.slideEl.querySelector<HTMLElement>(".pp-md");
    if (!md) return;
    md.contentEditable = "true";
    md.spellcheck = true;
    md.focus();
    md.oninput = () => {
      this.substituirSlide({ ...this.atual(), md: md.innerHTML });
      this.markDirty();
    };
    md.onblur = () => {
      md.contentEditable = "false";
      md.innerHTML = marked.parse(this.atual().md, { gfm: true, async: false }) as string;
    };
    md.onkeydown = (e) => {
      if (e.key === "Escape") md.blur();
    };
  }

  private setZoom(z: number, ancora?: { x: number; y: number }): void {
    this.stage.setZoom(z, ancora);
    this.atualizarStatus();
    this.fita.atualizar();
  }

  private markDirty(): void {
    this.opts.onDirty?.();
  }

  // ------------------------------------------------------------------
  // API pública (o App chama)
  // ------------------------------------------------------------------

  /** Deck de exemplo que "Novo" abre: 3 lâminas montadas com caixas de texto posicionadas. */
  private modeloInicial(setup: DeckSetup): Slide[] {
    const t = themeOf(setup.theme);
    const est: EstiloDeck = { fonte: setup.fontFamily || "Segoe UI", tamanho: 18, corTexto: t.fg, acento: t.accent, paleta: [] };
    const txt = (text: string, box: ShapeBox, size: number, extra: { bold?: boolean; align?: TextAlign; color?: string } = {}): Shape => {
      const s = novaCaixaDeTexto(box, est);
      const cor = extra.color ?? t.fg;
      s.paras = text.split("\n").map((l) => ({
        runs: l ? [{ text: l, size, bold: !!extra.bold, italic: false, underline: false, strike: false, color: cor, font: est.fonte }] : [],
        align: extra.align ?? "esquerda",
        lvl: 0,
        marL: 0,
        indent: 0,
        spcBef: 0,
        spcAft: 0,
        endSize: size,
      }));
      s.text = text;
      s.fontSize = size;
      s.color = cor;
      s.bold = !!extra.bold;
      s.anchor = "ctr";
      return s;
    };
    return [
      {
        md: "",
        layout: "titulo",
        notes: "Abertura: cumprimente e diga o tema da apresentação em uma frase.",
        shapes: [
          txt("Sua apresentação", { x: 8, y: 30, w: 84, h: 22 }, 54, { bold: true, align: "centro" }),
          txt("Nome do apresentador · data", { x: 8, y: 54, w: 84, h: 12 }, 22, { align: "centro", color: t.muted }),
        ],
      },
      {
        md: "",
        layout: "conteudo",
        notes: "Uma ideia por lâmina. Use as notas para o que falar, não para o que mostrar.",
        shapes: [
          txt("O que vamos ver", { x: 8, y: 10, w: 84, h: 14 }, 36, { bold: true }),
          txt("•  Primeiro assunto", { x: 10, y: 30, w: 80, h: 10 }, 22),
          txt("•  Segundo assunto", { x: 10, y: 43, w: 80, h: 10 }, 22),
          txt("•  Terceiro assunto", { x: 10, y: 56, w: 80, h: 10 }, 22),
        ],
      },
      {
        md: "",
        layout: "secao",
        notes: "Combine o próximo passo e encerre agradecendo.",
        shapes: [txt("Obrigado!", { x: 8, y: 34, w: 84, h: 22 }, 48, { bold: true, align: "centro", color: t.accent })],
      },
    ];
  }

  /** Snapshot serializável da aba (histórico/rascunho). */
  createTab(mdInicial?: string, setupInicial?: DeckSetup): PowerPointTabData {
    const setup = { ...DEFAULT_SETUP, ...(setupInicial ?? {}) };
    const deck = mdInicial ? deckFromMarkdown(mdInicial, setup) : null;
    const slides = deck?.slides.length ? deck.slides : this.modeloInicial(setup);
    return { setup, slides: migrarSlides(slides, setup), indice: 0, selecionada: null };
  }

  /** Aba a partir de um deck já pronto (importado de .pptx): preserva as formas, os fundos e a mídia. */
  createTabFromDeck(deck: Deck, setupInicial: DeckSetup): PowerPointTabData {
    const setup = { ...DEFAULT_SETUP, ...setupInicial };
    const slides = deck.slides.length ? deck.slides.map((x) => ({ ...x, notes: x.notes ?? "", shapes: x.shapes ?? [] })) : this.modeloInicial(setup);
    return { setup, slides: migrarSlides(slides, setup), indice: 0, selecionada: null };
  }

  load(data: PowerPointTabData): void {
    this.setup = { ...DEFAULT_SETUP, ...data.setup };
    const slides = data.slides?.length ? data.slides.map((s) => ({ ...s, notes: s.notes ?? "", shapes: s.shapes ?? [] })) : [newSlide()];
    this.slides = migrarSlides(slides, this.setup);
    this.indice = clampIndex(data.indice ?? 0, this.slides.length);
    this.selecao = data.selecionada ? [data.selecionada] : [];
    this.editando = null;
    this.ferramenta = null;
    this.atualizarPincel();
    this.hist.limpar();
    this.pane.style.setProperty("--slide-ratio", String(stageRatio(this.setup)));
    this.stage.zoomReset();
    this.pintar();
    // fontes embutidas do .pptx: ao carregarem, redesenha com as métricas certas
    if (this.setup.fonts?.length) void registrarFontes(this.setup.fonts).then(() => this.pintar());
  }

  snapshot(): PowerPointTabData {
    return {
      setup: { ...this.setup },
      slides: this.slides,
      indice: this.indice,
      selecionada: this.selecao[this.selecao.length - 1] ?? null,
    };
  }

  /** Texto serializado (histórico). */
  serialized(): string {
    return serialize(this.setup, this.slides);
  }

  /** Texto legível de um estado serializado (o diff do histórico usa). */
  projection(serialized: string): string {
    const deck = deserialize(serialized);
    if (!deck) return serialized;
    return deck.slides
      .map((s, i) => {
        const partes = s.shapes.map((f) => shapeText(f)).filter(Boolean);
        const corpo = s.md || partes.join("\n\n");
        return `## Lâmina ${i + 1}\n\n${corpo}${s.notes ? `\n\n> [notas] ${s.notes}` : ""}`;
      })
      .join("\n\n");
  }

  /** Markdown da lâmina atual (o App usa para a IA e para o corretor). */
  text(): string {
    const s = this.atual();
    const partes = s.shapes.map((f) => shapeText(f)).filter(Boolean);
    const md = s.md || partes.join("\n\n");
    return md + (s.notes ? `\n\n> [notas] ${s.notes}` : "");
  }

  /** Restaura a partir de um texto Markdown (rascunho/apresentação rápida). */
  restore(texto: string): void {
    const deck = deckFromMarkdown(texto, this.setup);
    this.slides = migrarSlides(deck.slides.length ? deck.slides : [newSlide()], this.setup);
    this.indice = 0;
    this.selecao = [];
    this.editando = null;
    this.hist.limpar();
    this.pintar();
  }

  /** Restaura a partir de um estado serializado (histórico e cópia de backup). */
  restoreSerialized(serialized: string): void {
    const snap = deserialize(serialized);
    if (!snap) return;
    const midia = this.setup.media;
    const fontes = this.setup.fonts;
    const brutas = this.setup.fontsRaw;
    this.setup = { ...DEFAULT_SETUP, ...snap.setup, media: snap.setup.media ?? midia, fonts: snap.setup.fonts ?? fontes, fontsRaw: snap.setup.fontsRaw ?? brutas };
    this.slides = migrarSlides(snap.slides.length ? snap.slides : [newSlide()], this.setup);
    this.indice = 0;
    this.selecao = [];
    this.editando = null;
    this.hist.limpar();
    this.pane.style.setProperty("--slide-ratio", String(stageRatio(this.setup)));
    this.pintar();
  }

  /** Configuração da apresentação (proporção, número, rodapé, fonte). */
  setup_(): DeckSetup {
    return { ...this.setup };
  }

  setSetup(setup: Partial<DeckSetup>): void {
    this.setup = { ...this.setup, ...setup };
    if (setup.aspect) this.pane.style.setProperty("--slide-ratio", String(stageRatio(this.setup)));
    this.markDirty();
    this.pintar();
  }

  /** Aplica um modelo (tema + fundo + fonte) ao deck inteiro, trocando as cores do tema antigo. */
  private usarModelo(modelo: ModeloPPT): void {
    this.registrar();
    this.slides = aplicarModelo(this.slides, { theme: this.setup.theme, bg: this.setup.bg, fontFamily: this.setup.fontFamily }, modelo);
    this.setSetup({ theme: modelo.tema, bg: modelo.bg, fontFamily: modelo.fonte });
  }

  /** Estatísticas para o rodapé do app. */
  stats(): { slides: number; formas: number; indice: number } {
    return { slides: this.slides.length, formas: this.atual().shapes.length, indice: this.indice };
  }

  focus(): void {
    this.slideEl.focus?.();
  }

  /** Modo apresentação (F5) com o deck em edição. */
  present(): void {
    if (this.editando) this.sairEdicao();
    const ctx: CtxRender = { ...this.ctxRender(false), apresentando: true };
    openDeckView(this.deck, this.setup, "Apresentação", (slide) => slide.shapes.map((f) => htmlFormaRica(f, ctx)).join(""));
  }

  irPara(i: number): void {
    const novo = clampIndex(i, this.slides.length);
    if (novo === this.indice) return;
    if (this.editando) this.sairEdicao();
    this.indice = novo;
    this.selecao = [];
    this.pintar();
  }

  /** Distribui formas (usado pelo botão da fita). */
  distribuir(eixo: "h" | "v"): void {
    this.run("distribuir", eixo);
  }
}
