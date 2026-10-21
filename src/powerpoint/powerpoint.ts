// Liga o motor de apresentações à tela: palco, fita, painel de formatação, notas, zoom e o editor de texto.
// O App só conversa com esta classe; o resto do motor fica dentro de src/powerpoint.
// (mesmo papel do src/word/host.ts)
import { marked } from "marked";
import DOMPurify from "dompurify";
import { $, escapeHtml, toast } from "../util";
import { pedirTexto } from "../dialogoTexto";
import { fluxoParaFormas, lerFluxoMermaid } from "./edicao/mermaid";
import { ligarAjusteAlturaFita, ligarEncaixeFita, ligarRecolherFita, ligarRodaHorizontal } from "../fita";
import { podeIsolar, caminhoDaBox, mascaraDaBox, nomeDaBox } from "./edicao/estudio";
import { criarModelo, desfazerModelo, novaCopia, desvincular, revincular, sincronizarCopias, ehParteDeCopia, temModelo, podeDesvincular, podeRevincular } from "./edicao/modelo";
import { camadasDe, criarCamada, renomearCamada, esconderCamada, opacidadeDaCamada, moverCamada, apagarCamada, fundirParaBaixo, PREFIXO_PINTURA } from "./edicao/camadas";
import { regioesDa, regiaoEm, caminhoDaRegiao, mascaraDaRegiao, poligonoDaForma, type Ponto, type Regiao } from "./edicao/regioes";
import { recortar, fitaDoTraco, ehConvexo, formaDaPintura } from "./edicao/pintura";
import { caixaCentrada, estiloDoDeck, GALERIA, novaCaixaDeTexto, novaForma, novaImagem, type EstiloDeck, type ItemGaleria } from "./edicao/criar";
import { dicaDoTraco, formaDoTraco, formaDeCurva, formaDaTinta, type Pincel } from "./edicao/desenho";
import { atualizarEstilos, ehBrilho, ehFamilia, ehIntensidade, estiloDaFamilia, ligarEstilo, ligarEstiloFundo, soltarEstilo, soltarEstiloFundo } from "./edicao/estilos";
import { atualizarLigacoes, ligacaoParaFormas } from "./edicao/ligacoes";
import { ajustarCor, CANTOS, comAjuste, comCantos, comLadoContorno, comLinha, comOpacidade, comPreenchimento, comRaioDeCanto, comSombra, gradiente, inverterLadoContorno, presetContorno, SOMBRAS_PRONTAS, solido, corPrincipal, type Canto } from "./edicao/formato";
import { aspectSize, stageRatio } from "./schema";
import type { Dim } from "./edicao/geometria";
import { Historico } from "./edicao/historico";
import { formasDoLayout, novaLamina, ORDEM_LAYOUTS, ROTULOS_LAYOUT } from "./edicao/layouts";
import { migrarSlides, registrarMidia } from "./edicao/migrar";
import { MODELOS, ROTULO_TRATAMENTO, aplicarModelo, aplicarModeloALamina, type EstiloAtual, type ModeloPPT, type TratamentoIdeia } from "./edicao/modelos";
import { modelosDasVariantes } from "./edicao/variantes";
import { refazerDesenho } from "./edicao/desenhos";
import { ARTES, type ArteId } from "./edicao/arte";
import { aplicarArte, papeisDaCapa, sugestoesDeArte } from "./edicao/designer";
import { explicarSemArranjo, melhorArranjo } from "./edicao/arranjos";
import { ARRANJOS, aplicarArranjo, arranjoLegivel, arrumavel, rotuloDoArranjo, unidadesDa, variantesDe, type Arranjo } from "./edicao/arranjos";
import { gerarDesign } from "./edicao/gerador";
import { ACABAMENTOS, sugestoesDe } from "./edicao/sugestoes";
import { criarModeloUsuario, lerModelosUsuario, removerModeloUsuario } from "./modelosUsuario";
import { aplicarFormato, copiarFormato, type FormatoPincel } from "./edicao/pincel";
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
import { alternarMarcador, estadoDoTrecho, estiloDosParas, estiloNoIntervalo, limparEstiloNoIntervalo, mudarCaixaTexto, mudarRecuo, mudarTamanhoRelativo, parasDaSelecao, textoDosParas, type EstiloRun, type RunPatch, type TipoCaixa } from "./edicao/texto";
import { comTransicao, direcaoDe, duracaoDe, normalizarTransicao, ROTULOS_DIRECAO } from "./edicao/transicao";
import { comAnimacao, comAtraso, comDirecao, comDuracao, comInicio, comPorParagrafo, moverAnimacao, normalizarAnimacoes, paragrafosDe, podarAnimacoes, semAnimacao, suave, TIPOS_ANIMACAO, aceitaDirecaoAnimacao, atrasoDe, direcaoDeAnimacao, duracaoDeAnimacao, inicioDe, formatarDuracao, ROTULOS_ANIMACAO, ROTULOS_INICIO } from "./edicao/animacao";
import { iniciarAnimacoes, type ControleAnimacoes } from "./render/animacao";
import { caixaDaMidia, comCorteDaMidia, comOpcaoMidia, comVolumeDaMidia, midiaPadrao, normalizarMidia, MIDIA_ROTULOS, tipoDeArquivo } from "./edicao/midia";
import { capturarQuadro, cartaoParaPng } from "./render/midia";
import { ligarRodaDeLaminas } from "./roda-laminas";
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
import { aoCarregarFontes, fundoValor, htmlFormaRica, parasComEstilo, parasComTexto, registrarFontes, urlDaMidia, type CtxRender } from "./render/forma";
import { shapeText } from "./shapes";
import { clampIndex, duplicateSlide, moveSlide, removeSlide, replaceSlide, resetSlide, setLayout } from "./slides";
import { Stage, passoZoom, type CelulasSel, type Ferramenta } from "./stage";
import { stageVars, themeOf } from "./themes";
import { Fita } from "./ui/fita";
import { abrirGaleriaDeLayouts, miniaturaDeLayout } from "./ui/layoutPreview";
import { Painel } from "./ui/painel";
import { abrirPopup, ancoraDoPopup, fecharPopup } from "./ui/popup";
import { abrirMenuOrganizar, ITEM_ORGANIZAR } from "./ui/organizar";
import type { EstadoUI } from "./ui/estado";
import type { Animacao, AnimacaoDirecao, AnimacaoInicio, AnimacaoTipo, Deck, DeckSetup, Fill, GraficoTipo, Lado, Para, Shape, ShapeBox, Slide, SlideLayout, TextAlign, Transicao, TransicaoDirecao, TransicaoTipo } from "./schema";

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
const lerTexto = (chave: string, padrao: string): string => {
  try {
    return localStorage.getItem(chave) ?? padrao;
  } catch {
    return padrao;
  }
};
const gravarTexto = (chave: string, v: string): void => {
  try {
    localStorage.setItem(chave, v);
  } catch {
    /* sem armazenamento */
  }
};

/** A preferência do "Nova lâmina": o último layout escolhido (a primeira lâmina nasce Capa). */
const CHAVE_ULTIMO_LAYOUT = "mdc.pp.ultimo-layout";
const layoutSalvo = (): SlideLayout => {
  const v = lerTexto(CHAVE_ULTIMO_LAYOUT, "titulo");
  return (ORDEM_LAYOUTS as string[]).includes(v) ? (v as SlideLayout) : "titulo";
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
  /** pincel de formatação armado: o formato copiado e se ele é fixo (o duplo clique na fita o fixa) */
  private pincelFmt: { formato: FormatoPincel; fixo: boolean } | null = null;
  private fixas = false;
  private encaixe = lerFlag("mdc.pp.encaixe", true);
  private grade = lerFlag("mdc.pp.grade", false);
  private faixaVertical = lerFlag("mdc.pp.faixaVertical", false);
  /** o último layout escolhido: o clique direto do "Nova lâmina" (fita e faixa) usa ele */
  private ultimoLayout: SlideLayout = layoutSalvo();
  private hist = new Historico<Estado>(100);
  private pendente: Estado | null = null;
  /** prévia das animações de forma em andamento no palco (aba Animações) */
  private animPreview: ControleAnimacoes | null = null;
  private destinoImagem = "inserir";
  private destinoMidia: string | null = null;
  private lateral: "formatar" | "notas" | "animacao" | "composicao" | "camadas" = "formatar";
  /** qual lote da Composição está à mostra (o botão "Gerar mais" avança) */
  private loteComposicao = 0;
  /** o filtro da Composição: o visual (padrão: formata as caixas sem movê-las), só a arrumação ou as duas metades juntas (Tudo) */
  private filtroComposicao: "designer" | "tudo" | "arrumacao" | "visual" = "designer";
  /** o visual da Composição vale para a apresentação inteira (desligado: só para a lâmina aberta) */
  private composicaoTodas = false;
  /** a lâmina e a proporção de que as prévias foram desenhadas (evita refazê-las à toa) */
  private previasVista: { slide: Slide; ratio: number } | null = null;
  /** identifica o desenho em andamento das prévias (um novo cancela o anterior) */
  private previasToken = 0;
  /** célula em edição (quando a forma em edição é uma tabela) e células selecionadas */
  private celulaEdit: [number, number] | null = null;
  private celulas: CelulasSel | null = null;
  /** cantos escolhidos para a edição de raio (as alças de canto do palco e o painel) */
  private cantosSel: Canto[] = [...CANTOS];
  /** a box isolada no Estúdio (o id da forma) — null = o Estúdio está fechado */
  private estudio: string | null = null;
  /** o zoom de antes de entrar no Estúdio: ao sair, o palco volta para ele */
  private zoomAntesEstudio = 100;
  /** o modo Regiões: o ponteiro acende a face sob ele e o clique isola (dentro do Estúdio) */
  private modoRegioes = false;
  /** a região isolada dentro da box (null = a fronteira é a box inteira) */
  private regiao: Regiao | null = null;
  /** o mapa de regiões da lâmina (refeito a cada pintura) */
  private regioes: Regiao[] = [];
  /** a ferramenta de pintura ativa (o que o palco desenha é recortado pela fronteira) */
  private pintura: "nenhuma" | "pincel" | "balde" | "vidro" = "nenhuma";
  /** a transparência da pintura (Vidro usa; o Balde pinta opaco) */
  private pinturaTransp = 0.35;
  /** o traço em andamento (pontos em pt da lâmina) */
  private pinturaPontos: Ponto[] = [];
  private pinturaPendente = false;

  private strip!: HTMLElement;
  private canvas!: HTMLElement;
  private frame!: HTMLElement;
  private slideEl!: HTMLElement;
  private notesEl!: HTMLTextAreaElement;
  /** a trilha do Estúdio (nome da box + Sair) */
  private trilhaEstudio!: HTMLElement;

  /**
   * Arrasto da miniatura em andamento. É feito com eventos de PONTEIRO, e não com o `draggable`
   * do HTML: o arrastar-e-soltar nativo disputa com o arrastar de arquivos do sistema (que
   * entrega os arquivos soltos na janela), e com isso a miniatura ficava presa (relato do
   * usuário: "o app bloqueia").
   */
  private arrastoFaixa: { de: number; x: number; y: number; ativo: boolean; ponteiro: number } | null = null;
  /** o clique que o navegador dispara no fim de um arrasto não pode escolher a lâmina errada */
  private cliqueAposArrasto = false;
  private rolagemDoArrasto: number | null = null;

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
        pincel: this.ferramenta?.tipo === "desenho" || this.ferramenta?.tipo === "curva" ? { cor: this.pincelUsado().cor, w: this.pincel.w, assistente: this.pincel.assistente && this.pincel.tipo !== "marca" } : null,
      }),
      aoSelecionar: (ids) => this.selecionar(ids),
      aoSelecionarCantos: (c) => this.selecionarCantos(c),
      aoTransformar: (patches, fase) => this.aoTransformar(patches, fase),
      aoEditarTexto: (id, ponto) => this.entrarEdicao(id, undefined, ponto),
      aoSairEdicao: () => this.sairEdicao(),
      aoCriar: (c) => this.aoCriar(c),
      aoDuplicarParaArrastar: () => this.duplicarParaArrastar(),
      aoCelulas: (sel) => this.selecionarCelulas(sel),
      aoTraco: (t) => this.aoTraco(t),
      aoTracoAndamento: (pontos) => this.aoTracoAndamento(pontos),
      aoLigar: (l) => this.aoLigar(l),
      aoPincelar: (id) => this.aoPincelar(id),
      aoCurva: (c) => this.aoCurva(c),
      aoApagarTinta: (id) => this.aoApagarTinta(id),
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
        <!-- a barrinha do Draw é só a DICA (e o Concluir/Cancelar da curva por pontos): cor,
             espessura, Caneta/Marca, Livre/Pontos e Assistente vivem na aba Desenhar, que já
             mostra e comanda o mesmo pincel — repetir aqui era um popup em cima da lâmina -->
        <div class="pp-pincel" data-pincel hidden>
          <button type="button" class="pp-pincel-btn pp-pincel-concluir" data-pincel-concluir hidden title="Concluir curva (Enter)">Concluir</button>
          <button type="button" class="pp-pincel-btn pp-pincel-cancelar" data-pincel-cancelar hidden title="Cancelar curva (Esc)">✕</button>
          <span class="pp-pincel-dica" data-pincel-dica></span>
        </div>
        <div class="pp-estudio" data-estudio hidden>
          <span class="pp-estudio-marca" aria-hidden="true"></span>
          <span class="pp-estudio-tag">Estúdio</span>
          <span class="pp-estudio-nome" data-estudio-nome></span>
          <button type="button" class="pp-estudio-voltar" data-estudio-voltar hidden title="Voltar para a box inteira (Esc)">‹ Box</button>
          <span class="pp-estudio-regiao" data-estudio-regiao hidden></span>
          <button type="button" class="btn small pp-estudio-sair" data-estudio-sair title="Sair do Estúdio (Esc)">Sair</button>
        </div>
        <div class="pp-left">
          <div class="pp-strip" data-strip aria-label="Lâminas"></div>
          <div class="pp-faixa-alca" data-faixa-resize title="Arraste para mudar a largura da faixa de lâminas"></div>
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
            <button type="button" data-lateral="composicao">Composição</button>
            <button type="button" data-lateral="camadas">Camadas</button>
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
          <div class="pp-side-corpo" data-composicao-corpo hidden>
            <div class="pp-side-head"><span>Composição</span><span class="pp-side-hint" data-composicao-hint>geradas no seu computador</span></div>
            <p class="pp-ideias-dica">Sugestões para <b>esta lâmina</b>: o <b>Designer</b> arruma o conteúdo, desenha a arte (adaptada ao espaço livre) e, na capa, recompõe o título; o <b>Visual</b> muda cores, fonte e o formato das caixas <b>sem mover nenhuma</b>; a <b>Arrumação</b> reposiciona o conteúdo. Clicar aplica só nesta lâmina (e dá para desfazer).</p>
            <div class="pp-seg" data-composicao-filtro role="group" aria-label="O que as sugestões mudam">
              <button type="button" class="on" data-filtro="designer" title="Arte vetorial (ondas, facetas, mosaico, brilhos) com a paleta de um modelo; a capa é recomposta">Designer</button>
              <button type="button" data-filtro="visual">Visual</button>
              <button type="button" data-filtro="arrumacao">Arrumação</button>
              <button type="button" data-filtro="tudo">Tudo</button>
            </div>
            <label class="pp-ideias-todas" title="Aplica o visual escolhido a todas as lâminas da apresentação, e não só a esta"><input type="checkbox" data-composicao-todas /> Aplicar o visual a todas as lâminas</label>
            <button type="button" class="btn small pp-ideias-mais" data-composicao-mais title="Outras combinações de arrumação e visual">Gerar mais</button>
            <div class="pp-ideias" data-composicao></div>
          </div>
          <div class="pp-side-corpo" data-camadas-corpo hidden>
            <div class="pp-side-head"><span>Camadas</span><span class="pp-side-hint">de baixo para cima</span></div>
            <p class="pp-ideias-dica">Cada camada agrupa a pintura (e as formas) para <b>esconder</b>, reordenar, apagar ou mudar a <b>opacidade</b> de uma vez. O olho vale no app <b>e no .pptx</b>: o que está escondido não vai ao arquivo.</p>
            <button type="button" class="btn small pp-camadas-nova" data-camada-nova title="Agrupa a pintura da lâmina numa camada só">Agrupar a pintura</button>
            <div class="pp-camadas" data-camadas></div>
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
    this.trilhaEstudio = $("[data-estudio]", this.pane);
    $("[data-estudio-sair]", this.pane).addEventListener("click", () => this.run("estudio"));
    $("[data-estudio-voltar]", this.pane).addEventListener("click", () => this.voltarParaBox());
    // o modo Regiões: o ponteiro acende a face sob ele e o clique a isola
    this.slideEl.addEventListener("pointermove", (ev) => this.aoMoverNoPalco(ev));
    this.slideEl.addEventListener("pointerleave", () => {
      this.pintarRegiaoHover(null);
      this.pintarPinturaPreview();
    });
    this.slideEl.addEventListener("pointerdown", (ev) => this.aoBaixarNoPalco(ev));
    this.slideEl.addEventListener("pointerup", () => this.aoSoltarNoPalco());
    this.slideEl.addEventListener("click", (ev) => this.aoClicarNoPalco(ev));
    this.pane.querySelector<HTMLSelectElement>("[data-transp]")?.addEventListener("change", (ev) => this.run(`pintura:transp:${(ev.target as HTMLSelectElement).value}`));

    this.fita = new Fita($("#pp-ribbon", this.pane), { estado: () => this.estadoUI(), run: (c, v) => this.run(c, v) });
    // recolher a faixa (botão no canto das abas, duplo clique numa aba ou Ctrl+F1), ajustar a
    // altura pela borda de baixo e ENCAIXAR a largura: os grupos que não couberem viram botão
    const abasFita = $(".ppr-abas", this.fita.el);
    const paineisFita = $(".ppr-paineis", this.fita.el);
    ligarRecolherFita({ el: this.fita.el, abas: abasFita, paineis: paineisFita });
    ligarAjusteAlturaFita({ el: this.fita.el, modo: "metricas" });
    // os quatro degraus da largura (cheio, compacto, grupos em menu e a faixa única recolhida)
    ligarEncaixeFita({ el: this.fita.el, painel: ".ppr-painel", grupo: ".ppr-grupo", corpo: ".ppr-corpo", rotulo: ".ppr-rotulo" });
    // a roda anda de lado na fila de abas (o painel não rola mais: o encaixe garante o ajuste)
    this.fita.el.querySelectorAll<HTMLElement>(".ppr-abas").forEach(ligarRodaHorizontal);
    this.painel = new Painel($("[data-formatar]", this.pane), { estado: () => this.estadoUI(), run: (c, v) => this.run(c, v) });

    this.stage.attach(this.frame, this.slideEl);
    this.notes.attach(this.notesEl, (notes) => this.mudarNotas(notes));
    this.ligarPincel();
    this.ligarArrastoDaFaixa();

    this.ligarPainelLateral();
    // abas do painel lateral
    for (const b of this.pane.querySelectorAll<HTMLElement>("[data-lateral]")) {
      b.addEventListener("click", () => this.mostrarLateral(b.dataset.lateral as "formatar" | "notas" | "animacao" | "composicao" | "camadas"));
    }
    // o painel de Camadas: os botões de cada camada (o olho, a ordem, fundir, apagar) e o slider
    const listaCamadas = $("[data-camadas]", this.pane);
    listaCamadas.addEventListener("click", (ev) => {
      const alvo = (ev.target as HTMLElement).closest<HTMLElement>("[data-camada-acao]");
      if (!alvo) return;
      const acao = alvo.dataset.camadaAcao!;
      const camada = alvo.dataset.camada ?? "";
      if (acao === "nova") this.run("camada-nova");
      else this.run(`camada:${acao}`, camada);
    });
    listaCamadas.addEventListener("change", (ev) => {
      const alvo = ev.target as HTMLElement;
      const camada = alvo.dataset.camada;
      if (!camada) return;
      if (alvo.matches("[data-camada-op]")) this.run(`camada:op:${camada}`, (alvo as HTMLInputElement).value);
      else if (alvo.matches("[data-camada-nome]")) this.run(`camada:nome:${camada}`, (alvo as HTMLInputElement).value);
    });
    $("[data-camada-nova]", this.pane).addEventListener("click", () => this.run("camada-nova"));
    // o visual vale só para a lâmina aberta, a menos que a opção "todas as lâminas" esteja ligada
    this.pane.querySelector<HTMLInputElement>("[data-composicao-todas]")?.addEventListener("change", (ev) => {
      this.composicaoTodas = (ev.target as HTMLInputElement).checked;
    });
    // o filtro da Composição: o visual (padrão), só a arrumação ou as duas metades juntas (Tudo)
    const filtro = this.pane.querySelector<HTMLElement>("[data-composicao-filtro]");
    filtro?.addEventListener("click", (ev) => {
      const b = (ev.target as HTMLElement).closest<HTMLElement>("[data-filtro]");
      if (!b) return;
      this.filtroComposicao = (b.dataset.filtro as "designer" | "tudo" | "arrumacao" | "visual") ?? "designer";
      for (const x of filtro.querySelectorAll<HTMLElement>("[data-filtro]")) x.classList.toggle("on", x === b);
      this.previasVista = null; // o host troca de conteúdo: a prévia guardada não vale mais
      this.pintarComposicao();
    });
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
    // debaixo do cursor continua debaixo dele (como no PowerPoint). Sem Ctrl, a roda
    // troca de lâmina (logo abaixo).
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

    // roda do mouse sem Ctrl: sobe/desce UMA lâmina por gesto, como no PowerPoint.
    // Com a lâmina ampliada, a roda rola o quadro primeiro; no fim, troca de lâmina.
    ligarRodaDeLaminas(this.canvas, (direcao) => this.irPara(this.indice + direcao));

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
    this.canvas.addEventListener("contextmenu", (e) => {
      if (!this.slideEl.contains(e.target as Node)) {
        e.preventDefault();
        fecharPopup();
        this.stage.consumirPanorama();
      }
    });

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
    const larguraFaixa = Number(guardado("pp-faixa-w"));
    if (larguraFaixa >= 72 && larguraFaixa <= 320) this.pane.style.setProperty("--pp-faixa-w", `${larguraFaixa}px`);
    const aplicar = (oculto: boolean) => {
      // a animação só vale no esconder/mostrar (arrastar a borda não deve "deslizar")
      this.pane.classList.add("pp-side-anima");
      this.pane.classList.toggle("pp-side-oculto", oculto);
      for (const b of this.pane.querySelectorAll<HTMLElement>(".pp-side-btn")) b.setAttribute("aria-pressed", String(!oculto));
      guardar("pp-side-oculto", oculto ? "1" : "0");
      // esconder/mostrar o painel também apaga/acende o "Painel" da aba Animações
      this.fita?.atualizar();
      window.setTimeout(() => {
        this.pane.classList.remove("pp-side-anima");
        this.stage.desenharSelecao();
      }, 300);
    };
    aplicar(guardado("pp-side-oculto") === "1");
    this.pane.classList.remove("pp-side-anima");
    for (const b of this.pane.querySelectorAll<HTMLElement>("[data-side-toggle]")) b.addEventListener("click", () => aplicar(!this.pane.classList.contains("pp-side-oculto")));
    // "Gerar mais": avança o lote — cada lote percorre combinações novas (a fornada é determinística)
    this.pane.querySelector<HTMLElement>("[data-composicao-mais]")?.addEventListener("click", () => {
      this.loteComposicao++;
      this.pintarComposicao();
    });
    const alca = this.pane.querySelector<HTMLElement>("[data-side-resize]")!;
    alca.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      try {
        alca.setPointerCapture(e.pointerId);
      } catch {
        /* ponteiro sintético */
      }
      const direita0 = this.pane.getBoundingClientRect().right;
      let wAtual = Math.round(parseFloat(this.pane.style.getPropertyValue("--pp-side-w")) || 260);
      let quadro = 0;
      const move = (ev: PointerEvent) => {
        wAtual = Math.max(200, Math.min(600, direita0 - ev.clientX));
        if (quadro) return;
        quadro = requestAnimationFrame(() => {
          quadro = 0;
          this.pane.style.setProperty("--pp-side-w", `${Math.round(wAtual)}px`);
        });
      };
      const fim = () => {
        if (quadro) {
          cancelAnimationFrame(quadro);
          quadro = 0;
        }
        this.pane.style.setProperty("--pp-side-w", `${Math.round(wAtual)}px`);
        alca.removeEventListener("pointermove", move);
        alca.removeEventListener("pointerup", fim);
        alca.removeEventListener("pointercancel", fim);
        guardar("pp-side-w", String(Math.round(wAtual)));
        this.stage.desenharSelecao();
      };
      alca.addEventListener("pointermove", move);
      alca.addEventListener("pointerup", fim);
      alca.addEventListener("pointercancel", fim);
    });
    // a alça da faixa de lâminas (modo vertical): a MESMA mecânica do painel — rAF, limites e a
    // largura guardada —, escrevendo na `--pp-faixa-w` (as miniaturas acompanham, porque o texto
    // delas é `cqw` dentro da moldura). Antes a faixa vertical ficava presa em 112 px.
    const alcaFaixa = this.pane.querySelector<HTMLElement>("[data-faixa-resize]");
    alcaFaixa?.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      try {
        alcaFaixa.setPointerCapture(e.pointerId);
      } catch {
        /* ponteiro sintético */
      }
      const x0 = e.clientX;
      const w0 = Math.round(parseFloat(this.pane.style.getPropertyValue("--pp-faixa-w")) || 112);
      const max = Math.max(160, Math.min(320, this.pane.getBoundingClientRect().width * 0.45));
      let wAtual = w0;
      let quadro = 0;
      const move = (ev: PointerEvent) => {
        wAtual = Math.max(72, Math.min(max, w0 + (ev.clientX - x0)));
        if (quadro) return;
        quadro = requestAnimationFrame(() => {
          quadro = 0;
          this.pane.style.setProperty("--pp-faixa-w", `${Math.round(wAtual)}px`);
        });
      };
      const fim = () => {
        if (quadro) {
          cancelAnimationFrame(quadro);
          quadro = 0;
        }
        this.pane.style.setProperty("--pp-faixa-w", `${Math.round(wAtual)}px`);
        alcaFaixa.removeEventListener("pointermove", move);
        alcaFaixa.removeEventListener("pointerup", fim);
        alcaFaixa.removeEventListener("pointercancel", fim);
        guardar("pp-faixa-w", String(Math.round(wAtual)));
        this.stage.desenharSelecao();
      };
      alcaFaixa.addEventListener("pointermove", move);
      alcaFaixa.addEventListener("pointerup", fim);
      alcaFaixa.addEventListener("pointercancel", fim);
    });
  }

  /** Mostra o painel se estiver escondido (usado quando o usuário pede algo que mora nele). */
  private mostrarPainelLateral(): void {
    if (this.pane.classList.contains("pp-side-oculto")) this.pane.querySelector<HTMLElement>("[data-side-toggle]")?.click();
  }

  private mostrarLateral(qual: "formatar" | "notas" | "animacao" | "composicao" | "camadas"): void {
    this.lateral = qual;
    for (const b of this.pane.querySelectorAll<HTMLElement>("[data-lateral]")) b.classList.toggle("on", b.dataset.lateral === qual);
    this.pane.querySelector<HTMLElement>("[data-formatar]")!.hidden = qual !== "formatar";
    this.pane.querySelector<HTMLElement>("[data-animacao-corpo]")!.hidden = qual !== "animacao";
    this.pane.querySelector<HTMLElement>("[data-notas-corpo]")!.hidden = qual !== "notas";
    this.pane.querySelector<HTMLElement>("[data-composicao-corpo]")!.hidden = qual !== "composicao";
    this.pane.querySelector<HTMLElement>("[data-camadas-corpo]")!.hidden = qual !== "camadas";
    if (qual === "notas") this.notes.focus();
    else if (qual === "animacao") this.renderAnimacoes();
    else if (qual === "composicao") this.pintarComposicao();
    else if (qual === "camadas") this.pintarCamadas();
    else this.painel.atualizar();
    // o botão "Painel" da aba Animações acompanha a aba aberta (fica aceso enquanto ela é a da vez)
    this.fita?.atualizar();
  }

  /**
   * Composição: a LÂMINA ATUAL desenhada em cada sugestão, offline — as antigas Ideias de design e
   * os Arranjos agora são um sistema só, com o filtro Tudo/Arrumação/Visual. No modo Tudo (o
   * padrão) cada cartão junta as duas metades: a ARRUMAÇÃO (a lâmina reorganizada) e o VISUAL (o
   * design do deck). A prévia é a lâmina real reduzida por `transform`: o `.pp-slide` é um
   * container de `cqw`, então o texto das formas escala junto e o cartão mostra exatamente o que o
   * clique vai aplicar — sem desenho à parte para manter em dia.
   */
  private pintarComposicao(): void {
    const host = this.pane.querySelector<HTMLElement>("[data-composicao]");
    if (!host) return;
    // na Arrumação não há "mais": as fórmulas e os estilos são finitos e aparecem todos de uma vez — um botão
    // que só repete os mesmos cartões confundia (nos outros modos ele traz combinações novas)
    const mais = this.pane.querySelector<HTMLElement>("[data-composicao-mais]");
    if (mais) mais.hidden = this.filtroComposicao === "arrumacao";
    if (this.filtroComposicao === "designer") return this.pintarDesigner(host);
    if (this.filtroComposicao === "arrumacao") return this.pintarArranjos(host);
    if (this.filtroComposicao === "visual") return this.pintarVisuais(host);
    return this.pintarMistas(host);
  }

  /**
   * Modo Tudo: a fornada mista (arrumação × visual) do lote, com a lâmina atual desenhada em cada
   * sugestão. Como nos Arranjos, os cartões saem vazios na hora e cada prévia é desenhada num
   * quadro próprio — a mistura aplica o modelo no deck inteiro, então é a prévia mais cara das
   * três. O clique vai por `composicao-aplicar` ("arranjo|variante|modelo|tratamento"): as duas
   * metades num passo de desfazer só.
   */
  private pintarMistas(host: HTMLElement): void {
    const atual = this.atual();
    const de: EstiloAtual = { theme: this.setup.theme, bg: this.setup.bg, fontFamily: this.setup.fontFamily };
    const ctx = this.ctxRender(false);
    const largura = 960; // referência da prévia (o cqw do texto sai daqui)
    const ratio = stageRatio(this.setup);
    const altura = Math.round(largura / ratio);
    const quantas = unidadesDa(atual).length;
    // as arrumações que FUNCIONAM nesta lâmina (legíveis, sem sobrepor): a fornada roda por elas e varia o
    // visual — o filtro vem ANTES do sorteio, senão sobrava um cartão só
    const legiveis = arrumavel(atual)
      ? ARRANJOS.flatMap((a) => variantesDe(a.id, quantas).map((v) => ({ arranjo: a.id, variante: v }))).filter((o) => { const novo = aplicarArranjo(atual, o.arranjo, o.variante, ratio); return o.arranjo === "recompor" ? novo !== atual : arranjoLegivel(atual, novo); })
      : [];
    const podeArrumar = legiveis.length > 0;
    // quando a lâmina tem uma COMPOSIÇÃO de verdade (estrutura nova), os cartões "Novo · ..." que só
    // trocam cor/fundo do mesmo arranjo saem: o painel não promete design novo onde só há recolorido
    const temComposicao = legiveis.some((o) => o.arranjo === "recompor");
    const todas = sugestoesDe({ unidades: quantas, arrumavel: podeArrumar, arrumacoes: podeArrumar ? legiveis : undefined, modelos: [...MODELOS, ...lerModelosUsuario()], lote: this.loteComposicao });
    const sugestoes = temComposicao ? todas.filter((s) => !s.modelo.gerado) : todas;
    this.previasVista = null; // o host troca de conteúdo: a prévia dos Arranjos não vale mais
    const criadas = sugestoes.filter((s) => s.modelo.gerado).length;
    this.atualizarDica(
      sugestoes.length
        ? `${sugestoes.length} ${podeArrumar ? "sugestões" : "visuais"} por vez${criadas ? ` — ${criadas} criada${criadas > 1 ? "s" : ""} na hora` : ""}`
        : ""
    );
    host.textContent = "";
    if (!sugestoes.length) {
      const aviso = document.createElement("p");
      aviso.className = "pp-ideias-vazio";
      aviso.textContent = "Esta lâmina não tem conteúdo para arrumar — a Composição trabalha com o que já está nela.";
      host.append(aviso);
      return;
    }
    const token = ++this.previasToken;
    const pendentes: (() => void)[] = [];
    for (const s of sugestoes) {
      const cartao = document.createElement("button");
      cartao.type = "button";
      cartao.className = "pp-ideia";
      // a lâmina que não é arrumável sai só de visual: o cartão não promete uma fórmula que não muda nada
      const nomeArrumacao = s.arranjo ? rotuloDoArranjo(s.arranjo, s.variante, quantas) : "";
      const nomeVisual = s.tratamento === "recolorir" ? s.modelo.nome : `${s.modelo.nome} · ${ROTULO_TRATAMENTO[s.tratamento]}`;
      cartao.title = `${nomeArrumacao ? `${nomeArrumacao} · ` : ""}${nomeVisual} — ${s.modelo.descricao}`;
      const moldura = document.createElement("span");
      moldura.className = "pp-ideia-moldura";
      const previa = document.createElement("span");
      previa.className = "pp-slide pp-ideia-slide";
      previa.style.width = `${largura}px`;
      previa.style.height = `${altura}px`;
      pendentes.push(() => {
        const comModelo = aplicarModeloALamina(atual, de, s.modelo, s.tratamento, ratio);
        const comTudo = s.arranjo ? aplicarArranjo(comModelo, s.arranjo, s.variante, ratio) : comModelo;
        // a fórmula que reduz os cartões a tiras ilegíveis não é oferecida; o cartão só de VISUAL (sem
        // arrumação) não passa por esta conferência — nele a lâmina "não mudou" de propósito
        if (s.arranjo && !arranjoLegivel(comModelo, comTudo)) {
          cartao.remove();
          return;
        }
        previa.style.background = fundoValor(comTudo.bg, this.setup.media ?? {}) || `#${s.modelo.cores?.bg || s.modelo.bg || themeOf(s.modelo.tema).bg}`;
        previa.innerHTML = comTudo.shapes.length
          ? comTudo.shapes.map((f) => htmlFormaRica(f, ctx)).join("")
          : sanitize(String(marked.parse(comTudo.md, { gfm: true, async: false }))).slice(0, 600);
        const w = moldura.clientWidth;
        if (w > 0) previa.style.transform = `scale(${w / largura})`;
      });
      moldura.append(previa);
      const nome = document.createElement("span");
      nome.className = "pp-ideia-nome";
      // o cartão diz as duas metades: a arrumação primeiro (é o que muda a lâmina que a prévia mostra)
      nome.textContent = [s.modelo.gerado ? "Novo" : "", nomeArrumacao, nomeVisual].filter(Boolean).join(" · ");
      cartao.append(moldura, nome);
      cartao.addEventListener("click", () => this.run("composicao-aplicar", `${s.arranjo ?? "-"}|${s.variante}|${s.modelo.id}|${s.tratamento}`));
      host.append(cartao);
    }
    // uma prévia por quadro; se a lâmina mudar no meio, o desenho antigo para
    const proxima = (): void => {
      if (token !== this.previasToken) return;
      pendentes.shift()?.();
      if (pendentes.length) requestAnimationFrame(proxima);
      else if (!host.querySelector(".pp-ideia")) {
        const aviso = document.createElement("p");
        aviso.className = "pp-ideias-vazio";
        aviso.textContent = explicarSemArranjo(atual);
        host.append(aviso);
      }
    };
    requestAnimationFrame(proxima);
  }

  /** O texto ao lado do título da aba (o "N por vez…"). */
  private atualizarDica(texto: string): void {
    const dica = this.pane.querySelector<HTMLElement>("[data-composicao-hint]");
    if (dica) dica.textContent = texto || "geradas no seu computador";
  }

  /**
   * Modo Designer: a lâmina atual com a ARTE de cada sugestão (ondas, facetas, mosaico, brilhos) na
   * paleta de um modelo — e, na capa, o título recomposto para a arte. A prévia sai do MESMO caminho
   * do clique (`aplicarArte`); cada uma é desenhada num quadro próprio (a arte tem muitas formas).
   * "Gerar mais" avança o lote: as artes giram e a paleta anda por passos, sem repetir.
   */
  private pintarDesigner(host: HTMLElement): void {
    const atual = this.atual();
    const de: EstiloAtual = { theme: this.setup.theme, bg: this.setup.bg, fontFamily: this.setup.fontFamily };
    const ctx = this.ctxRender(false);
    const largura = 960;
    const ratio = stageRatio(this.setup);
    const altura = Math.round(largura / ratio);
    // a lâmina já arrumada (uma vez só: as oito prévias partem dela) — o Designer arruma o conteúdo
    const arrumada = melhorArranjo(atual, ratio);
    const criadas = 3; // os últimos cartões usam paletas CRIADAS na hora (a semente avança a cada lote)
    const catalogo = [...MODELOS, ...lerModelosUsuario()];
    const sugestoes = sugestoesDeArte(this.loteComposicao, catalogo, 8).map((s, i, todas) => (i >= todas.length - criadas ? { ...s, modelo: gerarDesign(s.semente) } : s));
    this.previasVista = null;
    this.atualizarDica(`${sugestoes.length} composições por vez — ${criadas} com paleta criada na hora${papeisDaCapa(atual) ? " · a capa é recomposta" : ""}`);
    host.textContent = "";
    const token = ++this.previasToken;
    const pendentes: (() => void)[] = [];
    for (const s of sugestoes) {
      const nomeArte = ARTES.find((a) => a.id === s.arte)?.nome ?? s.arte;
      const cartao = document.createElement("button");
      cartao.type = "button";
      cartao.className = "pp-ideia";
      cartao.title = `${nomeArte} · ${s.modelo.nome} — ${s.modelo.descricao}`;
      const moldura = document.createElement("span");
      moldura.className = "pp-ideia-moldura";
      const previa = document.createElement("span");
      previa.className = "pp-slide pp-ideia-slide";
      previa.style.width = `${largura}px`;
      previa.style.height = `${altura}px`;
      pendentes.push(() => {
        const comArte = aplicarArte(arrumada, s.arte, s.semente, s.modelo, de, ratio, false);
        previa.style.background = fundoValor(comArte.bg, this.setup.media ?? {});
        previa.innerHTML = comArte.shapes.map((f) => htmlFormaRica(f, ctx)).join("");
        const w = moldura.clientWidth;
        if (w > 0) previa.style.transform = `scale(${w / largura})`;
      });
      moldura.append(previa);
      const nome = document.createElement("span");
      nome.className = "pp-ideia-nome";
      nome.textContent = `${s.modelo.gerado ? "Novo · " : ""}${nomeArte} · ${s.modelo.nome}`;
      cartao.append(moldura, nome);
      cartao.addEventListener("click", () => this.run("designer-aplicar", `${s.arte}|${s.semente}|${s.modelo.id}`));
      host.append(cartao);
    }
    const proxima = (): void => {
      if (token !== this.previasToken) return;
      pendentes.shift()?.();
      if (pendentes.length) requestAnimationFrame(proxima);
    };
    requestAnimationFrame(proxima);
  }

  /**
   * Modo Visual: a fornada das Ideias de design — uma combinação de design × acabamento por
   * cartão, com a lâmina atual desenhada em cada uma. "Gerar mais" avança para a fornada seguinte:
   * são `modelos × tratamentos` combinações, então dá para passar por todas sem repetir.
   */
  private pintarVisuais(host: HTMLElement): void {
    const atual = this.atual();
    const de: EstiloAtual = { theme: this.setup.theme, bg: this.setup.bg, fontFamily: this.setup.fontFamily };
    const ctx = this.ctxRender(false);
    const largura = 960; // referência da prévia (o cqw do texto sai daqui)
    const ratio = stageRatio(this.setup);
    const altura = Math.round(largura / ratio);
    const modelos = [...MODELOS, ...lerModelosUsuario()];
    const tratamentos: TratamentoIdeia[] = [...ACABAMENTOS];
    const porLote = 8;
    const criadasPorLote = 3; // designs que o app CRIA na hora; o resto vem do catálogo
    const doCatalogo = porLote - criadasPorLote;
    const total = modelos.length * tratamentos.length;
    this.previasVista = null; // o host troca de conteúdo: a prévia dos Arranjos não vale mais
    // o tratamento gira a cada ideia e o modelo a cada três: a fornada já mistura os acabamentos;
    // no fim entram os designs criados na hora (a semente avança a cada fornada, então não repetem)
    const ideias: { m: ModeloPPT; t: TratamentoIdeia }[] = [];
    for (let k = 0; k < Math.min(doCatalogo, total); k++) {
      const g = this.loteComposicao * doCatalogo + k;
      ideias.push({ m: modelos[Math.floor(g / tratamentos.length) % modelos.length], t: tratamentos[g % tratamentos.length] });
    }
    for (let k = 0; k < criadasPorLote; k++) {
      const semente = this.loteComposicao * criadasPorLote + k;
      ideias.push({ m: gerarDesign(semente), t: tratamentos[semente % tratamentos.length] });
    }
    this.atualizarDica(`${ideias.length} visuais por vez — ${criadasPorLote} criados na hora`);
    host.textContent = "";
    for (const { m, t } of ideias) {
      // a prévia sai do MESMO caminho do clique (`aplicarModeloALamina`): o cartão mostra
      // exatamente o que vai acontecer com esta lâmina
      const comModelo = aplicarModeloALamina(atual, de, m, t, ratio);
      const cartao = document.createElement("button");
      cartao.type = "button";
      cartao.className = "pp-ideia";
      cartao.title = `${m.nome} · ${ROTULO_TRATAMENTO[t]} — ${m.descricao}`;
      const moldura = document.createElement("span");
      moldura.className = "pp-ideia-moldura";
      const previa = document.createElement("span");
      previa.className = "pp-slide pp-ideia-slide";
      previa.style.width = `${largura}px`;
      previa.style.height = `${altura}px`;
      previa.style.background = fundoValor(comModelo.bg, this.setup.media ?? {}) || `#${m.cores?.bg || m.bg || themeOf(m.tema).bg}`;
      previa.innerHTML = comModelo.shapes.length
        ? comModelo.shapes.map((f) => htmlFormaRica(f, ctx)).join("")
        : sanitize(String(marked.parse(comModelo.md, { gfm: true, async: false }))).slice(0, 600);
      moldura.append(previa);
      const nome = document.createElement("span");
      nome.className = "pp-ideia-nome";
      const rotulo = t === "recolorir" ? m.nome : `${m.nome} · ${ROTULO_TRATAMENTO[t]}`;
      nome.textContent = m.gerado ? `Novo · ${rotulo}` : rotulo;
      cartao.append(moldura, nome);
      cartao.addEventListener("click", () => this.run("ideia", `${m.id}|${t}`));
      host.append(cartao);
    }
    // a escala sai depois do layout: cada prévia cabe na largura que o painel tiver agora
    for (const moldura of host.querySelectorAll<HTMLElement>(".pp-ideia-moldura")) {
      const previa = moldura.firstElementChild as HTMLElement | null;
      const w = moldura.clientWidth;
      if (previa && w > 0) previa.style.transform = `scale(${w / largura})`;
    }
  }


  /**
   * Galeria de VARIANTES (aba Design): a lâmina atual desenhada em cada família de cor. É a
   * mesma máquina das Ideias — `aplicarModelo` na lâmina atual + a prévia reduzida por
   * `transform` —, então o cartão mostra exatamente o que o clique aplica.
   */
  private abrirVariantes(): void {
    const ancora = this.fita.el.querySelector<HTMLElement>('[data-cmd="variantes"]');
    if (!ancora) return;
    const atual = this.atual();
    const de: EstiloAtual = { theme: this.setup.theme, bg: this.setup.bg, fontFamily: this.setup.fontFamily };
    const ctx = this.ctxRender(false);
    const largura = 960; // referência da prévia (o cqw do texto sai daqui)
    const altura = Math.round(largura / stageRatio(this.setup));
    const modelos = modelosDasVariantes(de.fontFamily);
    const el = abrirPopup(ancora, "", { classe: "pp-pop-modelos pp-pop-variantes" });
    el.innerHTML =
      `<div class="pp-pop-t">Variantes do design</div><div class="pp-vars">` +
      modelos
        .map((m) => {
          // a prévia sai do deck inteiro (o mapa de cores é o do deck todo): é o que o clique aplica
          const comModelo = aplicarModelo(this.slides, de, m)[this.indice] ?? atual;
          const fundo = fundoValor(comModelo.bg, this.setup.media ?? {}) || `#${m.cores?.bg || m.bg}`;
          return `<button type="button" class="pp-var" data-var="${m.id}" title="${m.nome} — ${m.descricao}">
              <span class="pp-var-moldura" style="aspect-ratio:${largura}/${altura}"><span class="pp-slide pp-var-slide" style="width:${largura}px;height:${altura}px;background:${fundo}">${
                comModelo.shapes.length ? comModelo.shapes.map((f) => htmlFormaRica(f, ctx)).join("") : ""
              }</span></span>
              <span class="pp-var-nome">${m.nome}</span>
            </button>`;
        })
        .join("") +
      `</div>`;
    // a escala das prévias sai depois do layout (o mesmo passo das Ideias): cada uma cabe na largura
    for (const moldura of el.querySelectorAll<HTMLElement>(".pp-var-moldura")) {
      const previa = moldura.firstElementChild as HTMLElement | null;
      const w = moldura.clientWidth;
      if (previa && w > 0) previa.style.transform = `scale(${w / largura})`;
    }
    el.addEventListener("click", (ev) => {
      const b = (ev.target as HTMLElement).closest<HTMLElement>("[data-var]");
      if (!b) return;
      fecharPopup();
      this.run("variante", b.dataset.var!);
    });
  }

  /** Modo Arrumação: a lâmina atual em cada fórmula (a grade abre em variantes). */
  private pintarArranjos(host: HTMLElement): void {
    const atual = this.atual();
    // lâmina sem o que arrumar (título e subtítulo soltos): explica em vez de repetir a mesma
    // prévia seis vezes — é a condição do `aplicarArranjo`, que devolveria a lâmina intacta
    if (!arrumavel(atual)) {
      this.previasVista = null;
      host.textContent = "";
      const aviso = document.createElement("p");
      aviso.className = "pp-ideias-vazio";
      aviso.textContent = "Esta lâmina não tem conteúdo para arrumar — a Composição trabalha com o que já está nela.";
      host.append(aviso);
      this.atualizarDica("nada a arrumar nesta lâmina");
      return;
    }
    const ctx = this.ctxRender(false);
    const largura = 960; // referência da prévia (o cqw do texto sai daqui)
    const ratio = stageRatio(this.setup);
    const altura = Math.round(largura / ratio);
    // a lâmina não mudou (só a seleção, o zoom…): as prévias que já estão no painel valem
    const vista = this.previasVista;
    if (vista && vista.slide === atual && vista.ratio === ratio && host.childElementCount > 0) {
      this.escalarPrevias(host, largura);
      return;
    }
    this.previasVista = { slide: atual, ratio };
    const token = ++this.previasToken;
    const quantas = unidadesDa(atual).length;
    const ideias: { id: Arranjo; variante: number }[] = [];
    for (const a of ARRANJOS) for (const v of variantesDe(a.id, quantas)) ideias.push({ id: a.id, variante: v });
    host.textContent = "";
    // os cartões (vazios) aparecem na hora; a prévia de cada um é desenhada num quadro próprio,
    // para o clique e a edição não esperarem seis lâminas inteiras serem montadas
    this.atualizarDica(`${ideias.length} arrumações — o visual continua o mesmo`);
    const pendentes: (() => void)[] = [];
    // duas fórmulas que dão o MESMO resultado (o "melhor" do fluxo igual ao em linhas) não aparecem duas vezes
    const vistos = new Set<string>();
    for (const { id, variante } of ideias) {
      const cartao = document.createElement("button");
      cartao.type = "button";
      cartao.className = "pp-ideia";
      cartao.title = `${rotuloDoArranjo(id, variante, quantas)} — ${ARRANJOS.find((a) => a.id === id)?.descricao ?? ""}`;
      const moldura = document.createElement("span");
      moldura.className = "pp-ideia-moldura";
      const previa = document.createElement("span");
      previa.className = "pp-slide pp-ideia-slide";
      previa.style.width = `${largura}px`;
      previa.style.height = `${altura}px`;
      pendentes.push(() => {
        const comArranjo = aplicarArranjo(atual, id, variante, ratio);
        // a fórmula que reduz os cartões a tiras ilegíveis não é oferecida; a Recomposição já se
        // recusa sozinha (devolve a lâmina original quando não melhora) e some quando não muda nada
        if (comArranjo === atual || (id !== "recompor" && !arranjoLegivel(atual, comArranjo))) {
          cartao.remove();
          return;
        }
        const assinatura = comArranjo.shapes.map((f) => `${f.id}:${f.box.x.toFixed(1)},${f.box.y.toFixed(1)},${f.box.w.toFixed(1)},${f.box.h.toFixed(1)}`).join("|");
        if (vistos.has(assinatura)) {
          cartao.remove();
          return;
        }
        vistos.add(assinatura);
        previa.style.background = fundoValor(comArranjo.bg, this.setup.media ?? {}) || `#${themeOf(this.setup.theme).bg}`;
        previa.innerHTML = comArranjo.shapes.length
          ? comArranjo.shapes.map((f) => htmlFormaRica(f, ctx)).join("")
          : sanitize(String(marked.parse(comArranjo.md, { gfm: true, async: false }))).slice(0, 600);
        const w = moldura.clientWidth;
        if (w > 0) previa.style.transform = `scale(${w / largura})`;
      });
      moldura.append(previa);
      const nome = document.createElement("span");
      nome.className = "pp-ideia-nome";
      nome.textContent = rotuloDoArranjo(id, variante, quantas);
      cartao.append(moldura, nome);
      cartao.addEventListener("click", () => this.run("arranjo", `${id}|${variante}`));
      host.append(cartao);
    }
    // uma prévia por quadro; se a lâmina mudar no meio, o desenho antigo para
    const proxima = (): void => {
      if (token !== this.previasToken) return;
      pendentes.shift()?.();
      if (pendentes.length) requestAnimationFrame(proxima);
      else if (!host.querySelector(".pp-ideia")) {
        const aviso = document.createElement("p");
        aviso.className = "pp-ideias-vazio";
        // diz POR QUE (já está arrumado, não há o que arrumar, ou é denso demais) em vez da frase genérica
        aviso.textContent = explicarSemArranjo(atual);
        host.append(aviso);
      }
    };
    requestAnimationFrame(proxima);
  }

  /** A escala de cada prévia cabe na largura que o painel tiver agora (sai depois do layout). */
  private escalarPrevias(host: HTMLElement, largura: number): void {
    for (const moldura of host.querySelectorAll<HTMLElement>(".pp-ideia-moldura")) {
      const previa = moldura.firstElementChild as HTMLElement | null;
      const w = moldura.clientWidth;
      if (previa && w > 0) previa.style.transform = `scale(${w / largura})`;
    }
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

  /** Guarda o último layout escolhido (é o que o "Nova lâmina" usa no clique direto). */
  private definirUltimoLayout(l: SlideLayout): void {
    if (this.ultimoLayout === l) return;
    this.ultimoLayout = l;
    gravarTexto(CHAVE_ULTIMO_LAYOUT, l);
  }

  private registrar(chave = ""): void {
    this.hist.registrar(this.estado(), chave);
  }

  private substituirSlide(slide: Slide): void {
    // o que é derivado se redesenha a cada mudança: primeiro os ESTILOS (a cor da forma), depois
    // as LIGAÇÕES (o conector lê a cor da caixa já derivada — trocar esta ordem quebra a cor)
    const temEstilo = slide.shapes.some((s) => s.estilo || s.capa) || !!slide.bgEstilo;
    const temLigacao = slide.shapes.some((s) => s.liga);
    const comEstilo = temEstilo ? atualizarEstilos(slide, this.dim(), this.estilo()) : slide;
    this.slides = replaceSlide(this.deck, this.indice, temLigacao ? atualizarLigacoes(comEstilo, this.dim(), this.estilo().acento) : comEstilo).slides;
  }

  /** As formas da seleção que têm estilo vivo. */
  private idsComEstilo(): string[] {
    return this.atual()
      .shapes.filter((s) => s.estilo && this.selecao.includes(s.id))
      .map((s) => s.id);
  }

  /**
   * Edição de pintura manual (contorno, sombra…): numa forma com estilo vivo, o estilo é SOLTO
   * antes — a pintura fica dona em vez de o recálculo derrubar a escolha no próximo movimento.
   */
  private comPintura(fn: (s: Slide) => Slide, chave = ""): void {
    const estilizadas = this.idsComEstilo();
    this.editar((s) => fn(estilizadas.length ? soltarEstilo(s, estilizadas) : s), chave);
  }

  /** Estilos de cor (galeria, painel e cor do preenchimento): liga, ajusta ou solta o estilo. */
  private estiloCor(acao: string): void {
    const ids = this.selecao;
    if (!ids.length) return;
    const [op, valor = ""] = acao.split(":");
    if (op === "desligar") {
      this.editar((s) => soltarEstilo(s, ids), "estilo");
      return;
    }
    if (op === "familia" && ehFamilia(valor)) {
      this.editar((s) => ligarEstilo(s, ids, { familia: valor, base: "" }, estiloDaFamilia(valor)), "estilo");
      return;
    }
    if (op === "intensidade" && ehIntensidade(valor)) {
      this.editar((s) => ligarEstilo(s, ids, { intensidade: valor }, estiloDaFamilia("esmeralda")), "estilo");
      return;
    }
    if (op === "brilho" && ehBrilho(valor)) {
      this.editar((s) => ligarEstilo(s, ids, { brilho: valor }, estiloDaFamilia("esmeralda")), "estilo");
      return;
    }
    if (op === "angulo") {
      const ang = Math.round(Math.max(0, Math.min(360, Number(valor))));
      if (!Number.isFinite(ang)) return;
      this.editar((s) => ligarEstilo(s, ids, { angulo: ang }, estiloDaFamilia("esmeralda")), "estilo");
      return;
    }
    if (op === "cor" && /^[0-9A-Fa-f]{6}$/.test(valor)) {
      this.editar((s) => ligarEstilo(s, ids, { base: valor.toUpperCase() }, estiloDaFamilia("propria")), "estilo");
    }
  }

  /** Fundo com estilo: a mesma receita das formas (no fundo a dobra vira lustro, sem forma-capa). */
  private fundoEstilo(acao: string): void {
    const [op, valor = ""] = acao.split(":");
    if (op === "desligar") {
      this.editar((s) => soltarEstiloFundo(s), "fundo");
      return;
    }
    if (op === "familia" && ehFamilia(valor)) {
      this.editar((s) => ligarEstiloFundo(s, { familia: valor, base: "" }, estiloDaFamilia(valor)), "fundo");
      return;
    }
    if (op === "intensidade" && ehIntensidade(valor)) {
      this.editar((s) => ligarEstiloFundo(s, { intensidade: valor }, estiloDaFamilia("esmeralda")), "fundo");
      return;
    }
    if (op === "brilho" && ehBrilho(valor)) {
      this.editar((s) => ligarEstiloFundo(s, { brilho: valor }, estiloDaFamilia("esmeralda")), "fundo");
      return;
    }
    if (op === "angulo") {
      const ang = Math.round(Math.max(0, Math.min(360, Number(valor))));
      if (!Number.isFinite(ang)) return;
      this.editar((s) => ligarEstiloFundo(s, { angulo: ang }, estiloDaFamilia("esmeralda")), "fundo");
      return;
    }
    if (op === "cor" && /^[0-9A-Fa-f]{6}$/.test(valor)) {
      this.editar((s) => ligarEstiloFundo(s, { base: valor.toUpperCase() }, estiloDaFamilia("propria")), "fundo");
    }
  }

  /** Os ids das formas que MUDARAM entre dois estados (a assinatura é o próprio JSON da forma). */
  private idsMudados(antes: Slide, depois: Slide): string[] {
    const assinatura = (s: Shape) => JSON.stringify(s);
    const antesPor = new Map(antes.shapes.map((s) => [s.id, assinatura(s)]));
    const mudadas: string[] = [];
    for (const s of depois.shapes) {
      const a = antesPor.get(s.id);
      if (a === undefined || a !== assinatura(s)) mudadas.push(s.id);
    }
    return mudadas;
  }

  /** Aplica uma edição à lâmina atual: guarda o desfazer, troca a lâmina e redesenha. */
  private editar(fn: (s: Slide) => Slide, chave = ""): void {
    const antes = this.atual();
    let depois = fn(antes);
    if (depois === antes) return;
    // MODELO: editar uma PARTE vinculada de uma cópia DESVINCULA essa parte (o vínculo é do modelo,
    // não uma jaula: quem mexeu quis que aquela parte fosse própria) — e o aviso diz como voltar
    const soltas = this.idsMudados(antes, depois).filter((id) => {
      const s = depois.shapes.find((x) => x.id === id);
      return !!s && ehParteDeCopia(s) && !s.desvinculado;
    });
    if (soltas.length) {
      depois = desvincular(depois, soltas);
      toast(
        soltas.length === 1
          ? "Esta parte deixou de seguir o modelo — use Re-vincular (aba Desenhar) para voltar."
          : `${soltas.length} partes deixaram de seguir o modelo — use Re-vincular para voltar.`,
        "info",
        4400
      );
    }
    // e as cópias acompanham o modelo a cada edição
    if (temModelo(depois)) depois = sincronizarCopias(depois, this.dim());
    this.registrar(chave);
    this.substituirSlide(depois);
    this.markDirty();
    this.pintar();
  }

  // ------------------------------------------------------------------
  // desenho
  // ------------------------------------------------------------------

  private ctxRender(editavel: boolean, selecionadas?: string[]): CtxRender {
    const { w, h } = this.dim();
    return { larguraPt: w, alturaPt: h, media: this.setup.media ?? {}, selecionada: null, selecionadas, editavel, editando: editavel ? this.editando : null, celulaEdit: editavel ? this.celulaEdit : null };
  }

  /** redesenha tudo: miniaturas + lâmina + fita + painel */
  pintar(): void {
    const slide = this.atual();
    for (const [k, v] of Object.entries(stageVars(this.setup))) this.slideEl.style.setProperty(k, v);
    this.slideEl.className = `pp-slide layout-${slide.layout}${this.fixas ? " pp-fixas-on" : ""}`;
    this.slideEl.style.background = fundoValor(slide.bg, this.setup.media ?? {});
    this.pintarSlide(slide);
    this.pintarEstudio();
    this.pintarStrip();
    this.notes.setText(slide.notes);
    this.atualizarStatus();
    this.sincronizarTabelas();
    this.atualizarUI();
    // com a Composição aberta, ela acompanha a lâmina atual (e o modelo aplicado)
    if (this.lateral === "composicao") this.pintarComposicao();
    // o painel de Camadas também (mexer na lâmina muda a lista)
    if (this.lateral === "camadas") this.pintarCamadas();
  }

  /** O painel de Camadas: a lista de cima para baixo é a da FRENTE para trás (como nos editores). */
  private pintarCamadas(): void {
    const host = $("[data-camadas]", this.pane);
    const camadas = camadasDe(this.atual());
    const nova = this.pane.querySelector<HTMLButtonElement>("[data-camada-nova]");
    const temPintura = this.atual().shapes.filter((s) => (s.name ?? "").startsWith(PREFIXO_PINTURA)).length > 1;
    if (nova) nova.disabled = !(this.selecao.length > 1 || temPintura);
    if (!camadas.length) {
      host.innerHTML = `<p class="pp-camadas-vazio">Nenhuma forma nesta lâmina ainda.</p>`;
      return;
    }
    host.innerHTML = [...camadas]
      .reverse()
      .map((c, i, todas) => {
        const frente = i === 0;
        const fundo = i === todas.length - 1;
        const membros = c.membros.length === 1 ? "1 forma" : `${c.membros.length} formas`;
        return `<div class="pp-camada${c.oculta ? " oculta" : ""}">
          <button type="button" class="pp-camada-olho" data-camada-acao="olho" data-camada="${c.id}" title="${c.oculta ? "Mostrar esta camada" : "Esconder esta camada (não vai ao .pptx)"}" aria-pressed="${!c.oculta}">${c.oculta ? "○" : "◉"}</button>
          <div class="pp-camada-corpo">
            <input class="pp-camada-nome" data-camada-nome data-camada="${c.id}" value="${escapeHtml(c.nome)}" title="Nome da camada" aria-label="Nome da camada">
            <div class="pp-camada-linha">
              <span class="pp-camada-cont">${membros}</span>
              <input type="range" class="pp-camada-op" data-camada-op data-camada="${c.id}" min="5" max="100" step="5" value="${Math.round(c.opacidade * 100)}" title="Opacidade da camada" aria-label="Opacidade da camada">
            </div>
          </div>
          <div class="pp-camada-acoes">
            <button type="button" data-camada-acao="sobe" data-camada="${c.id}" title="Subir a camada" ${frente ? "disabled" : ""}>▲</button>
            <button type="button" data-camada-acao="desce" data-camada="${c.id}" title="Descer a camada" ${fundo ? "disabled" : ""}>▼</button>
            <button type="button" data-camada-acao="fundir" data-camada="${c.id}" title="Fundir com a camada de baixo" ${fundo ? "disabled" : ""}>⤓</button>
            <button type="button" data-camada-acao="apagar" data-camada="${c.id}" title="Apagar a camada">✕</button>
          </div>
        </div>`;
      })
      .join("");
  }

  /** só a lâmina e a seleção (usado enquanto se arrasta, para não refazer as miniaturas a cada quadro) */
  private pintarRapido(): void {
    this.pintarSlide(this.atual());
    this.pintarEstudio();
    this.atualizarUI();
  }

  // ------------------------------------------------------------------
  // Estúdio (o ambiente isolado de uma box)
  // ------------------------------------------------------------------

  /** A box isolada (a forma do id guardado, na lâmina atual). */
  private boxDoEstudio(): Shape | undefined {
    if (!this.estudio) return undefined;
    return this.atual().shapes.find((s) => s.id === this.estudio);
  }

  /**
   * Pinta a "casca" do Estúdio: a trilha (nome da box + Sair), a classe do palco e a MÁSCARA — o
   * retângulo da lâmina com a box como buraco, que esmaece todo o resto. A máscara é um SVG em pt
   * da lâmina (o mesmo caminho que a pintura vai usar como fronteira nas próximas fases).
   */
  private pintarEstudio(): void {
    const box = this.boxDoEstudio();
    // a box sumiu (apagada, desfeita, outra lâmina): o Estúdio fecha junto — nada de estado fantasma
    if (this.estudio && !box) {
      this.estudio = null;
      this.regiao = null;
      this.modoRegioes = false;
    }
    this.pane.classList.toggle("pp-estudio-on", !!this.estudio);
    // com uma ferramenta de pintura na mão, as formas não pegam o ponteiro (quem desenha é o palco)
    this.pane.classList.toggle("pp-pintura-on", !!this.estudio && this.pintura !== "nenhuma");
    // o mapa das regiões é da lâmina: refeito a cada pintura (as formas podem ter mudado de lugar)
    this.regioes = box ? regioesDa(this.atual().shapes, this.dim(), nomeDaBox) : [];
    // a região isolada é de UMA box: trocar de box (ou apagá-la) invalida a região
    if (this.regiao && this.regiao.dono !== box?.id) this.regiao = null;
    if (this.trilhaEstudio) {
      this.trilhaEstudio.hidden = !this.estudio;
      const nome = this.trilhaEstudio.querySelector<HTMLElement>("[data-estudio-nome]");
      if (box && nome) nome.textContent = nomeDaBox(box);
      const regiao = this.trilhaEstudio.querySelector<HTMLElement>("[data-estudio-regiao]");
      if (regiao) {
        regiao.hidden = !this.regiao;
        regiao.textContent = this.regiao?.nome ?? "";
      }
      const voltar = this.trilhaEstudio.querySelector<HTMLElement>("[data-estudio-voltar]");
      if (voltar) voltar.hidden = !this.regiao;
    }
    this.slideEl.querySelector(".pp-estudio-svg")?.remove();
    for (const el of this.slideEl.querySelectorAll<HTMLElement>("[data-shape]")) el.classList.remove("pp-estudio-box");
    if (!box) {
      this.pintarRegiaoHover(null);
      return;
    }
    const d = this.dim();
    // a fronteira: a box inteira ou a REGIÃO isolada (o contorno dela com os buracos)
    const caminho = this.regiao ? mascaraDaRegiao(this.regiao, d) : mascaraDaBox(box, d);
    if (caminho) {
      const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      svg.setAttribute("class", "pp-estudio-svg");
      svg.setAttribute("viewBox", `0 0 ${d.w} ${d.h}`);
      svg.setAttribute("preserveAspectRatio", "none");
      svg.setAttribute("aria-hidden", "true");
      const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
      path.setAttribute("d", caminho);
      path.setAttribute("fill-rule", "evenodd");
      svg.append(path);
      this.slideEl.append(svg);
    }
    // a box isolada ganha o contorno de destaque (o resto fica atrás da máscara)
    for (const el of this.slideEl.querySelectorAll<HTMLElement>("[data-shape]")) {
      if (el.dataset.shape === box.id) el.classList.add("pp-estudio-box");
    }
  }

  // ------------------------------------------------------------------
  // Regiões (o mapa dos contornos: a face sob o ponteiro e a região isolada)
  // ------------------------------------------------------------------

  /** O ponto do ponteiro em pt da lâmina (a unidade do mapa de regiões). */
  private pontoNoPalco(ev: { clientX: number; clientY: number }): { x: number; y: number } | null {
    const d = this.dim();
    const r = this.slideEl.getBoundingClientRect();
    if (!r.width || !r.height) return null;
    return { x: ((ev.clientX - r.left) / r.width) * d.w, y: ((ev.clientY - r.top) / r.height) * d.h };
  }

  /** Com o modo Regiões ligado, o ponteiro acende a face sob ele. */
  private aoMoverNoPalco(ev: PointerEvent): void {
    // com o pincel na mão, o movimento ACRESCENTA no traço (a prévia já vem recortada)
    if (this.estudio && this.pintura === "pincel" && this.pinturaPendente) {
      const ponto = this.pontoNoPalco(ev);
      if (ponto) {
        this.pinturaPontos.push(ponto);
        this.pintarPinturaPreview();
      }
      return;
    }
    if (!this.estudio || !this.modoRegioes) return;
    const p = this.pontoNoPalco(ev);
    this.pintarRegiaoHover(p ? regiaoEm(this.regioes, p) : null);
  }

  /** O realce da face sob o ponteiro (a mesma linguagem do palco: acento, sem roubar o ponteiro). */
  private pintarRegiaoHover(r: Regiao | null): void {
    this.slideEl.querySelector(".pp-regiao-svg")?.remove();
    if (!r || !this.estudio) return;
    const d = this.dim();
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("class", "pp-estudio-svg pp-regiao-svg");
    svg.setAttribute("viewBox", `0 0 ${d.w} ${d.h}`);
    svg.setAttribute("preserveAspectRatio", "none");
    svg.setAttribute("aria-hidden", "true");
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", caminhoDaRegiao(r));
    path.setAttribute("fill-rule", "evenodd");
    svg.append(path);
    this.slideEl.append(svg);
  }

  /** No modo Regiões o clique ISOLA a face sob o ponteiro (não muda a seleção). */
  private aoClicarNoPalco(ev: MouseEvent): void {
    if (!this.estudio || !this.modoRegioes) return;
    const p = this.pontoNoPalco(ev);
    if (!p) return;
    const r = regiaoEm(this.regioes, p);
    if (r) this.isolarRegiao(r);
  }

  /** Isola a região: a fronteira do Estúdio passa a ser aquela face (contorno + buracos). */
  private isolarRegiao(r: Regiao): void {
    this.regiao = r;
    this.pintar();
  }

  /** Volta para a box inteira (a trilha tem o botão; o Esc faz o mesmo, antes de sair do Estúdio). */
  private voltarParaBox(): void {
    if (!this.regiao) return;
    this.regiao = null;
    this.pintar();
  }

  /** Liga/desliga o modo Regiões (só vale dentro do Estúdio). */
  private alternarModoRegioes(): void {
    if (!this.estudio) return;
    this.modoRegioes = !this.modoRegioes;
    if (!this.modoRegioes) this.pintarRegiaoHover(null);
    this.atualizarUI();
  }

  // ------------------------------------------------------------------
  // Pintura (fase 3): o pincel, o balde e o vidro — recortados na fronteira
  // ------------------------------------------------------------------

  /** A fronteira da pintura: a região isolada ou a box inteira (contorno + buracos). */
  private fronteiraDaPintura(): { contorno: Ponto[]; buracos: Ponto[][] } | null {
    if (this.regiao) return { contorno: this.regiao.contorno, buracos: this.regiao.buracos };
    const box = this.boxDoEstudio();
    if (!box) return null;
    const contorno = poligonoDaForma(box, this.dim());
    return contorno ? { contorno, buracos: [] } : null;
  }

  /** Solta a pintura na lâmina pelo caminho normal (desfazer, histórico e exportação valem). */
  private soltarPintura(contorno: Ponto[], buracos: Ponto[][], cor: string, alpha: number, nome: string): void {
    const id = `pin${Date.now().toString(36)}${Math.round(Math.random() * 1e4).toString(36)}`;
    const nova = formaDaPintura(contorno, buracos, cor, alpha, id, this.dim(), nome);
    if (!nova) return;
    this.registrar();
    this.editar((s) => ({ ...s, shapes: [...s.shapes, nova] }), "pintura");
    this.selecionar([nova.id]);
  }

  private aoBaixarNoPalco(ev: PointerEvent): void {
    if (!this.estudio || this.pintura === "nenhuma") return;
    const p = this.pontoNoPalco(ev);
    const f = this.fronteiraDaPintura();
    if (!p || !f) return;
    if (!ehConvexo(f.contorno)) {
      toast("Esta fronteira não é convexa — a pintura ainda não recorta nela.", "info", 5200);
      return;
    }
    if (this.pintura === "pincel") {
      this.pinturaPendente = true;
      this.pinturaPontos = [p];
      this.pintarPinturaPreview();
      return;
    }
    // balde e vidro pintam a FACE sob o ponteiro (ou a região já isolada)
    const face = this.regiao ?? regiaoEm(this.regioes, p);
    if (!face) return;
    const cor = this.pincelUsado().cor;
    const alpha = this.pintura === "vidro" ? this.pinturaTransp : 1;
    this.soltarPintura(face.contorno, face.buracos, cor, alpha, this.pintura === "vidro" ? "Pintura · vidro" : "Pintura · balde");
  }

  /** Solta o pincel: a fita do traço é RECORTADA pela fronteira e vira uma forma. */
  private aoSoltarNoPalco(): void {
    if (!this.pinturaPendente) return;
    this.pinturaPendente = false;
    const pontos = this.pinturaPontos;
    this.pinturaPontos = [];
    this.slideEl.querySelector(".pp-pintura-preview")?.remove();
    const f = this.fronteiraDaPintura();
    if (!f || !pontos.length || !ehConvexo(f.contorno)) return;
    const cortada = recortar(fitaDoTraco(pontos, this.pincel.w), f.contorno);
    if (cortada.length < 3) return;
    this.soltarPintura(cortada, f.buracos, this.pincelUsado().cor, this.pinturaTransp, "Pintura · pincel");
  }

  /** A prévia do traço (o polígono já recortado): o desenho acontece dentro da fronteira, à vista. */
  private pintarPinturaPreview(): void {
    this.slideEl.querySelector(".pp-pintura-preview")?.remove();
    if (!this.estudio || this.pintura !== "pincel" || !this.pinturaPendente || !this.pinturaPontos.length) return;
    const f = this.fronteiraDaPintura();
    if (!f || !ehConvexo(f.contorno)) return;
    const cortada = recortar(fitaDoTraco(this.pinturaPontos, this.pincel.w), f.contorno);
    if (cortada.length < 3) return;
    const d = this.dim();
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("class", "pp-estudio-svg pp-pintura-preview");
    svg.setAttribute("viewBox", `0 0 ${d.w} ${d.h}`);
    svg.setAttribute("preserveAspectRatio", "none");
    svg.setAttribute("aria-hidden", "true");
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", caminhoDaRegiao({ contorno: cortada, buracos: f.buracos } as Regiao));
    path.setAttribute("fill-rule", "nonzero");
    path.setAttribute("fill", `#${this.pincelUsado().cor}`);
    path.setAttribute("fill-opacity", String(this.pinturaTransp));
    svg.append(path);
    this.slideEl.append(svg);
  }

  /** Cancela um traço em andamento (trocar de ferramenta, sair do Estúdio, Esc). */
  private cancelarPintura(): void {
    this.pinturaPendente = false;
    this.pinturaPontos = [];
    this.slideEl.querySelector(".pp-pintura-preview")?.remove();
  }

  /** No Estúdio, só o que está DENTRO da box entra na seleção (o resto está esmaecido). */
  private dentroDaBox(ids: string[]): string[] {
    const box = this.boxDoEstudio();
    if (!box) return ids;
    const b = box.box;
    return ids.filter((id) => {
      const f = this.atual().shapes.find((s) => s.id === id);
      if (!f) return false;
      const cx = f.box.x + f.box.w / 2;
      const cy = f.box.y + f.box.h / 2;
      return cx >= b.x && cx <= b.x + b.w && cy >= b.y && cy <= b.y + b.h;
    });
  }

  /** Entra/sai do Estúdio: o ambiente isolado de uma box (o "Photoshop por cima das box"). */
  private alternarEstudio(): void {
    if (this.estudio) {
      this.sairDoEstudio();
      return;
    }
    const alvo = this.principal();
    if (!alvo || !podeIsolar(alvo)) {
      toast("Escolha uma box com área para isolar — linha, conector e traço de tinta não têm área.", "info", 5200);
      return;
    }
    this.estudio = alvo.id;
    this.zoomAntesEstudio = this.stage.zoomAtual;
    this.enquadrarBox(alvo);
    this.pintar();
  }

  private sairDoEstudio(): void {
    if (!this.estudio) return;
    this.estudio = null;
    this.regiao = null;
    this.modoRegioes = false;
    this.pintura = "nenhuma";
    this.cancelarPintura();
    this.stage.setZoom(this.zoomAntesEstudio);
    this.pintar();
  }

  /** Enquadra a box no palco (o "ambiente só dela") e centra: o zoom de antes volta ao sair. */
  private enquadrarBox(s: Shape): void {
    const caixa = this.canvas.getBoundingClientRect();
    const quadro = this.frame.getBoundingClientRect();
    if (caixa.width < 10 || quadro.width < 10 || s.box.w <= 0 || s.box.h <= 0) return;
    const escalaX = (caixa.width * 0.86) / ((s.box.w / 100) * quadro.width);
    const escalaY = (caixa.height * 0.86) / ((s.box.h / 100) * quadro.height);
    const { min, max } = Stage.limites;
    const alvo = Math.max(min, Math.min(max, Math.round(this.stage.zoomAtual * Math.min(escalaX, escalaY))));
    this.stage.setZoom(alvo);
    this.centrarNaBox(s);
  }

  /** Deixa o centro da box no centro do que está à vista (o palco rola de verdade). */
  private centrarNaBox(s: Shape): void {
    const caixa = this.canvas.getBoundingClientRect();
    const quadro = this.frame.getBoundingClientRect();
    if (!caixa.width || !quadro.width) return;
    const cx = quadro.left + ((s.box.x + s.box.w / 2) / 100) * quadro.width;
    const cy = quadro.top + ((s.box.y + s.box.h / 2) / 100) * quadro.height;
    this.canvas.scrollLeft += cx - (caixa.left + caixa.width / 2);
    this.canvas.scrollTop += cy - (caixa.top + caixa.height / 2);
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
    const ctx = this.ctxRender(true, this.selecao);
    // as formas escondidas (o olho do painel de camadas) não são desenhadas — e não pegam o ponteiro
    this.slideEl.innerHTML = slide.shapes.filter((s) => !s.oculta).map((s) => htmlFormaRica(s, ctx)).join("") + (this.grade ? `<div class="pp-grade"></div>` : "");
    if (this.editando) this.ligarEdicao(this.editando);
  }

  /** o que a fileira de miniaturas desenhou por último (evita refazer o que não mudou) */
  private stripDeck: Slide[] | null = null;
  private stripSetup: DeckSetup | null = null;

  /** miniaturas das lâminas */
  private pintarStrip(): void {
    // Nada mudou desde o último desenho (as lâminas são imutáveis): a fileira já está certa e só
    // o "aceso" pode ter andado (trocar de lâmina). Refazer as N miniaturas custa caro — cada
    // `innerHTML` vira DOM de verdade (medido: ~59 ms num deck de 12 lâminas).
    if (this.stripDeck === this.slides && this.stripSetup === this.setup) {
      for (const [i, b] of [...this.strip.querySelectorAll<HTMLElement>(".pp-thumb")].entries()) b.classList.toggle("active", i === this.indice);
      return;
    }
    this.stripDeck = this.slides;
    this.stripSetup = this.setup;
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
        inner.innerHTML = s.shapes.filter((f) => !f.oculta).map((f) => htmlFormaRica(f, ctx)).join("");
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
      btn.addEventListener("click", () => {
        // o clique que o navegador dispara no fim de um arrasto não pode escolher a lâmina errada
        if (this.cliqueAposArrasto) {
          this.cliqueAposArrasto = false;
          return;
        }
        this.irPara(i);
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
      // clique direito na miniatura: as ações DAQUELA lâmina (e barra o menu nativo do WebView)
      btn.addEventListener("contextmenu", (e) => this.menuDaLamina(e, i));
      this.strip.append(btn);
    });

    const add = document.createElement("div");
    add.className = "pp-thumb-add";
    const rotuloUltimo = ROTULOS_LAYOUT[this.ultimoLayout];
    const titulo = `Nova lâmina no fim (${rotuloUltimo})`;
    // o card tem DOIS alvos: a prévia cria a lâmina com o último layout; o rótulo "+ Nova lâmina"
    // abre a galeria com todas as variações (e a escolha lá cria e passa a ser o "último").
    // O "+" redondo que pendia do canto da prévia saiu a pedido — o rótulo assumiu a função dele.
    const dicaGaleria = "Nova lâmina: escolher o layout";
    add.innerHTML =
      `<button type="button" class="pp-thumb-add-corpo" title="${titulo}" aria-label="${titulo}">${miniaturaDeLayout(this.ultimoLayout, this.setup)}</button>` +
      `<button type="button" class="pp-thumb-add-rot" title="${dicaGaleria}" aria-label="${dicaGaleria}"><b>+</b> Nova lâmina</button>`;
    add.querySelector<HTMLButtonElement>(".pp-thumb-add-corpo")!.addEventListener("click", () => this.run("slide-new"));
    add.querySelector<HTMLButtonElement>(".pp-thumb-add-rot")!.addEventListener("click", (e) => {
      // o MESMO botão recolhe o que abriu (como nos popups da fita)
      if (ancoraDoPopup() === e.currentTarget) {
        fecharPopup();
        return;
      }
      abrirGaleriaDeLayouts(e.currentTarget as HTMLElement, this.setup, (l) => this.run("slide-new", l));
    });
    this.strip.append(add);
    // mantém a miniatura da lâmina atual à vista (na horizontal e na vertical)
    this.strip.querySelector(".pp-thumb.active")?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }

  // ------------------------------------------------------------------
  // arrastar as miniaturas para reordenar
  // ------------------------------------------------------------------

  /**
   * Arrasto da faixa de lâminas com eventos de PONTEIRO — e não com o `draggable` do HTML: o
   * arrastar-e-soltar nativo disputa com o arrastar de arquivos do sistema, e por isso o
   * arrasto **nunca começa** dentro do app (a miniatura ficava presa; relato do usuário: "o
   * app bloqueia"). O gesto é o mesmo do resto do app: `pointerdown` + captura do ponteiro,
   * um mínimo de movimento para virar arrasto (o clique
   * simples continua só escolhendo a lâmina), a linha de inserção acompanhando o ponteiro e o
   * `moverLaminaPara` no soltar.
   */
  private ligarArrastoDaFaixa(): void {
    const miniaturas = (): HTMLElement[] => [...this.strip.querySelectorAll<HTMLElement>(".pp-thumb")];

    /** Índice de inserção (na lista de agora) que o ponteiro aponta — é onde a linha fica. */
    const destino = (x: number, y: number): number => {
      const lista = miniaturas();
      const coord = this.faixaVertical ? y : x;
      for (let i = 0; i < lista.length; i++) {
        const r = lista[i].getBoundingClientRect();
        const meio = this.faixaVertical ? r.top + r.height / 2 : r.left + r.width / 2;
        if (coord < meio) return i;
      }
      return lista.length; // passou da última: entra no fim (o "+ Nova lâmina" não é posição)
    };

    const marcarDestino = (para: number): void => {
      for (const n of this.strip.querySelectorAll(".alvo-antes, .alvo-depois")) n.classList.remove("alvo-antes", "alvo-depois");
      const lista = miniaturas();
      if (!lista.length) return;
      // a linha fica ANTES da miniatura que cede o lugar; no fim da faixa, depois da última
      if (para < lista.length) lista[para].classList.add("alvo-antes");
      else lista[lista.length - 1].classList.add("alvo-depois");
    };

    const fim = (): void => {
      this.pararRolagemDoArrasto();
      this.strip.classList.remove("pp-arrastando");
      for (const n of this.strip.querySelectorAll(".arrastando, .alvo-antes, .alvo-depois")) n.classList.remove("arrastando", "alvo-antes", "alvo-depois");
      document.removeEventListener("keydown", escapar, true);
      this.arrastoFaixa = null;
    };

    const mover = (ev: PointerEvent): void => {
      const a = this.arrastoFaixa;
      if (!a) return;
      if (!a.ativo) {
        // só vira arrasto depois de um mínimo de movimento: o clique simples escolhe a lâmina
        if (Math.abs(ev.clientX - a.x) < 4 && Math.abs(ev.clientY - a.y) < 4) return;
        a.ativo = true;
        // a captura vem AQUI, e não no `pointerdown`: com ela o ponteiro é redirecionado para a
        // faixa e os cliques das miniaturas (escolher, excluir, "+ Nova lâmina") deixariam de
        // chegar nos botões. Capturando no começo do arrasto, o clique simples segue intacto.
        try {
          this.strip.setPointerCapture(a.ponteiro);
        } catch {
          /* ponteiro sem captura (sintético): o arrasto segue pelos eventos do próprio elemento */
        }
        this.strip.classList.add("pp-arrastando");
        miniaturas()[a.de]?.classList.add("arrastando");
      }
      ev.preventDefault(); // nada de selecionar o texto dos rótulos no caminho
      marcarDestino(destino(ev.clientX, ev.clientY));
      this.rolarFaixaNoArrasto(ev.clientX, ev.clientY);
    };

    const soltar = (ev: PointerEvent): void => {
      const a = this.arrastoFaixa;
      const ativo = !!a?.ativo;
      // o destino é medido ANTES de limpar: o `moverLaminaPara` redesenha a faixa
      const para = ativo ? destino(ev.clientX, ev.clientY) : 0;
      desligar();
      if (!a || !ativo) return; // clique simples: quem age é o handler do botão
      this.cliqueAposArrasto = true; // o clique do fim do gesto não pode escolher outra lâmina
      let final = para;
      if (a.de < final) final--;
      this.moverLaminaPara(a.de, final);
    };

    const cancelar = (): void => desligar();

    const desligar = (): void => {
      this.strip.removeEventListener("pointermove", mover);
      this.strip.removeEventListener("pointerup", soltar);
      this.strip.removeEventListener("pointercancel", cancelar);
      fim();
    };

    /** Esc cancela o arrasto (o gesto do app: a tecla sai da ação em andamento). */
    const escapar = (ev: KeyboardEvent): void => {
      if (ev.key !== "Escape" || !this.arrastoFaixa) return;
      ev.preventDefault();
      ev.stopPropagation();
      desligar();
    };

    this.strip.addEventListener("pointerdown", (e) => {
      if (e.button !== 0) return;
      const alvo = e.target as HTMLElement;
      if (alvo.closest(".pp-thumb-del")) return; // o × exclui a lâmina; não é pega de arrasto
      const btn = alvo.closest<HTMLElement>(".pp-thumb");
      if (!btn) return;
      const de = miniaturas().indexOf(btn);
      if (de < 0) return;
      this.cliqueAposArrasto = false; // um gesto novo zera o que sobrou do anterior
      this.arrastoFaixa = { de, x: e.clientX, y: e.clientY, ativo: false, ponteiro: e.pointerId };
      this.strip.addEventListener("pointermove", mover);
      this.strip.addEventListener("pointerup", soltar);
      this.strip.addEventListener("pointercancel", cancelar);
      document.addEventListener("keydown", escapar, true);
    });
  }

  /**
   * Perto da borda da faixa, o arrasto rola a faixa sozinho: a miniatura de destino pode estar
   * fora da vista (mesmo gesto do PowerPoint).
   */
  private rolarFaixaNoArrasto(x: number, y: number): void {
    const r = this.strip.getBoundingClientRect();
    const margem = 30;
    const passo = 12;
    const vertical = this.faixaVertical;
    const direcao = vertical ? (y < r.top + margem ? -passo : y > r.bottom - margem ? passo : 0) : x < r.left + margem ? -passo : x > r.right - margem ? passo : 0;
    if (direcao === 0) {
      this.pararRolagemDoArrasto();
      return;
    }
    if (this.rolagemDoArrasto !== null) return;
    this.rolagemDoArrasto = window.setInterval(() => {
      if (vertical) this.strip.scrollTop += direcao;
      else this.strip.scrollLeft += direcao;
    }, 16);
  }

  private pararRolagemDoArrasto(): void {
    if (this.rolagemDoArrasto === null) return;
    window.clearInterval(this.rolagemDoArrasto);
    this.rolagemDoArrasto = null;
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
    const isolada = this.boxDoEstudio();
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
      pincel: { cor: this.pincelUsado().cor, w: this.pincel.w, modo: this.ferramenta?.tipo === "curva" ? "pontos" : this.stage.obterModoDesenho(), assistente: this.pincel.assistente, tipo: this.pincel.tipo === "marca" ? "marca" : "caneta" },
      fixas: this.fixas,
      encaixe: this.encaixe,
      grade: this.grade,
      faixaVertical: this.faixaVertical,
      paleta: this.estilo().paleta,
      fontes: this.fontesDoDeck(),
      setup: this.setup,
      bg: this.atual().bg,
      bgEstilo: this.atual().bgEstilo,
      ultimoLayout: this.ultimoLayout,
      temGrupo: formas.some((s) => !!s.grupo),
      largura: forma ? (forma.box.w / 100) * d.w : 0,
      altura: forma ? (forma.box.h / 100) * d.h : 0,
      celulas: this.celulasDaSelecao(),
      cantosSel: [...this.cantosSel],
      estudio: !!this.estudio,
      podeIsolar: podeIsolar(forma),
      estudioNome: isolada ? nomeDaBox(isolada) : undefined,
      regioes: this.modoRegioes,
      regiao: this.regiao?.nome,
      pintura: this.pintura,
      pinturaTransp: this.pinturaTransp,
      modelo: temModelo(this.atual()),
      desvinculavel: podeDesvincular(this.atual(), this.selecao),
      revinculavel: podeRevincular(this.atual(), this.selecao),
      transicao: normalizarTransicao(this.atual().transicao),
      transicaoPreservada: !!this.atual().transicaoXml,
      animacao,
      animacaoPreservada: !!this.atual().timingXml,
      animacaoPos: forma && anims ? anims.findIndex((a) => a.forma === forma.id) : -1,
      animacaoTotal: anims?.length ?? 0,
      animacaoParas: forma ? paragrafosDe(forma).length : 0,
      lateral: this.lateral,
      lateralAberta: !this.pane.classList.contains("pp-side-oculto"),
    };
  }

  // ------------------------------------------------------------------
  // seleção e arraste
  // ------------------------------------------------------------------

  private selecionar(ids: string[]): void {
    // no modo Regiões (ou com uma ferramenta de pintura na mão) o clique é do mapa/pincel
    if ((this.modoRegioes || this.pintura !== "nenhuma") && this.estudio) return;
    // Estúdio aberto: só o que está dentro da box entra na seleção
    if (this.estudio) ids = this.dentroDaBox(ids);
    const igual = ids.length === this.selecao.length && ids.every((x, i) => x === this.selecao[i]);
    if (igual) return;
    if (this.editando && !(ids.length === 1 && ids[0] === this.editando)) this.sairEdicao();
    if (!this.editando) window.getSelection()?.removeAllRanges();
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
      // as caixas de ANTES: é com elas que o quadro vivo sabe se dá para mexer só no estilo
      const antes = new Map<string, ShapeBox>();
      if (fase === "meio") for (const s of this.atual().shapes) if (patches.has(s.id)) antes.set(s.id, { ...s.box });
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
      if (fase === "meio") this.pintarArrasto(patches, antes);
      else this.pintarRapido();
    }
    if (fase === "fim") {
      const mudou = !!this.pendente && this.pendente.slides !== this.slides;
      if (mudou) this.hist.registrar(this.pendente!);
      this.pendente = null;
      // Sem edição não há o que repintar. O palco chama isto a CADA pointerup — inclusive no
      // clique que só ESCOLHEU uma forma — e o `pintar` redesenha as miniaturas de todas as
      // lâminas: era isso que travava a seleção múltipla (medido: ~65 ms por clique, 55 deles
      // nas miniaturas). Com `patches` aplicados o repaint continua vindo, como sempre.
      if (mudou || patches.size) this.pintar();
    }
  }

  /**
   * O quadro VIVO do arrasto: mexe só nas formas que mudaram, sem refazer a lâmina inteira.
   *
   * Refazer o `innerHTML` da lâmina a cada evento de movimento invalidava o estilo de TODAS as
   * formas, e a próxima passada de layout pagava a conta (medido no navegador: ~9 ms por quadro,
   * contra ~0,2 ms das alças sozinhas — o arrasto ficava abaixo de 20 quadros). Aqui:
   * - **mover** (a caixa do mesmo tamanho) e **girar** vão direto no estilo do elemento — o mais
   *   barato, e é o gesto do relato;
   * - o que **muda o desenho** (redimensionar, cantos...) refaz **só aquela forma**
   *   (`htmlFormaRica`), em vez de todas;
   * - o que é **derivado** (ligação/capa que seguem a forma, o Estúdio com a máscara da box) cai no
   *   caminho completo — quem muda não é só a forma arrastada.
   * No fim do arrasto o `pintar()` refaz tudo de uma vez.
   */
  private pintarArrasto(patches: Map<string, Partial<Shape>>, antes: Map<string, ShapeBox>): void {
    const slide = this.atual();
    if (this.estudio || slide.shapes.some((s) => s.liga || s.capa)) return this.pintarRapido();
    const porId = new Map(slide.shapes.map((s) => [s.id, s]));
    const pct = (v: number) => String(Math.round(v * 1000) / 1000);
    const ctx = this.ctxRender(true, this.selecao);
    for (const [id, p] of patches) {
      const s = porId.get(id);
      const velho = antes.get(id);
      const el = this.slideEl.querySelector<HTMLElement>(`[data-shape="${id}"]`);
      if (!s || !velho || !el) return this.pintarRapido();
      const soMoveu =
        Object.keys(p).every((k) => k === "box" || k === "rot") && (!p.box || (p.box.w === velho.w && p.box.h === velho.h));
      if (soMoveu) {
        if (p.box) {
          el.style.left = `${pct(p.box.x)}%`;
          el.style.top = `${pct(p.box.y)}%`;
          el.style.width = `${pct(p.box.w)}%`;
          el.style.height = `${pct(p.box.h)}%`;
        }
        if (p.rot !== undefined) el.style.transform = p.rot ? `rotate(${pct(p.rot)}deg)` : "";
        continue;
      }
      // mudou o desenho (tamanho, cantos...): refaz SÓ esta forma
      const novo = document.createElement("div");
      novo.innerHTML = htmlFormaRica(s, ctx);
      const elNovo = novo.firstElementChild;
      if (!elNovo) return this.pintarRapido();
      el.replaceWith(elNovo);
    }
    // as alças e a medida acompanham (é o overlay, não a lâmina) e o painel só troca os números
    this.stage.desenharSelecao();
    this.painel.vivo();
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
    return { cor: this.pincel.cor || this.estilo().acento, w: this.pincel.w, assistente: this.pincel.assistente, tipo: this.pincel.tipo === "marca" ? "marca" : "caneta" };
  }

  /** Liga o Concluir/Cancelar da barrinha — o resto do pincel é comandado pela aba Desenhar. */
  private ligarPincel(): void {
    const barra = $<HTMLElement>("[data-pincel]", this.pane);
    barra.querySelector<HTMLElement>("[data-pincel-concluir]")?.addEventListener("click", () => {
      this.stage.finalizarCurva();
      this.atualizarPincel();
    });
    barra.querySelector<HTMLElement>("[data-pincel-cancelar]")?.addEventListener("click", () => {
      this.stage.cancelarCurva();
      this.atualizarPincel();
    });
    this.atualizarPincel();
  }

  /** Mostra/esconde a barrinha e mantém a dica (e o Concluir/Cancelar da curva por pontos). */
  private atualizarPincel(): void {
    // a aba Desenhar mostra o estado do pincel: atualiza os botões dela junto com a barrinha
    this.fita.atualizar();
    const barra = this.pane.querySelector<HTMLElement>("[data-pincel]");
    if (!barra) return;
    const ehDesenho = this.ferramenta?.tipo === "desenho";
    const ehCurva = this.ferramenta?.tipo === "curva";
    const ehBorracha = this.ferramenta?.tipo === "borracha";
    const ativo = ehDesenho || ehCurva || ehBorracha;
    barra.hidden = !ativo;
    this.frame?.classList.toggle("pp-borracha", ehBorracha);
    if (!ativo) return;
    const marca = this.pincel.tipo === "marca";
    const modo = ehCurva ? "pontos" : this.stage.obterModoDesenho();

    const temPontos = this.stage.temPontosCurva();
    const btnConcluir = barra.querySelector<HTMLElement>("[data-pincel-concluir]");
    const btnCancelar = barra.querySelector<HTMLElement>("[data-pincel-cancelar]");
    if (btnConcluir) btnConcluir.hidden = !temPontos;
    if (btnCancelar) btnCancelar.hidden = !temPontos;

    const dica = barra.querySelector<HTMLElement>("[data-pincel-dica]");
    if (dica) {
      if (ehBorracha) {
        dica.textContent = "Borracha: clique ou arraste sobre os traços de tinta — Esc para sair";
      } else if (temPontos) {
        dica.textContent = "Clique para o próximo · Duplo-clique/Enter termina · Clique no 1º fecha";
      } else if (ehCurva || modo === "pontos") {
        dica.textContent = "Clique para marcar pontos de parada — Esc para sair";
      } else if (marca) {
        dica.textContent = "Marca-texto: arraste sobre o que quer destacar — Esc para sair";
      } else {
        dica.textContent = "Rabisque ou clique pontos de parada — Esc para sair";
      }
    }
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

  /** Terminou ou fechou uma curva por pontos de parada. */
  private aoCurva(c: { pontos: { x: number; y: number; reto?: boolean }[]; fechado: boolean }): void {
    const pontosPt = this.stage.pontosEmPtComReto(c.pontos, this.dim());
    const forma = formaDeCurva(pontosPt, c.fechado, this.pincelUsado(), this.estilo(), this.dim(), this.atual().shapes);
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
    if (!dica) return;
    // "entendi" é o assistente lendo o traço: desligado (ou no marca-texto, que ele não lê),
    // a dica só diz o que o traço é — o prefixo fazia parecer que ele continuava trabalhando.
    const assistindo = this.pincel.assistente && this.pincel.tipo !== "marca";
    dica.textContent = assistindo ? `entendi: ${dicaDoTraco(pontos, true)}` : dicaDoTraco(pontos, false);
  }

  /**
   * Borracha: apaga o traço de tinta com este id. Só mexe em forma que veio do Draw (tem
   * `tinta`) — desenho livre/curva/marca-texto; uma forma qualquer que esteja embaixo fica.
   * Cada traço apagado é um passo do desfazer.
   */
  private aoApagarTinta(id: string): void {
    const s = this.atual().shapes.find((f) => f.id === id);
    if (!s?.tinta || s.bloqueada) return;
    this.registrar();
    this.substituirSlide({ ...this.atual(), shapes: this.atual().shapes.filter((f) => f.id !== id) });
    this.selecao = this.selecao.filter((x) => x !== id);
    this.markDirty();
    this.pintar();
  }

  /** Conectar: as duas formas escolhidas ganham a ligação presa (que se redesenha sozinha). */
  private aoLigar(l: { de: string; ladoDe: Lado; para: string; ladoPara: Lado }): void {
    const de = this.atual().shapes.find((s) => s.id === l.de);
    const para = this.atual().shapes.find((s) => s.id === l.para);
    if (!de || !para) return;
    const formas = ligacaoParaFormas(de, l.ladoDe, para, l.ladoPara, this.dim(), this.estilo());
    if (!formas.length) return;
    this.registrar();
    this.substituirSlide({ ...this.atual(), shapes: [...this.atual().shapes, ...formas] });
    this.selecao = [formas[formas.length - 1].id];
    this.markDirty();
    this.pintar();
  }

  // ------------------------------------------------------------------
  // edição de texto dentro das formas e das células de tabela
  // ------------------------------------------------------------------

  private entrarEdicao(id: string, cel?: [number, number], ponto?: { x: number; y: number }): void {
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
      const sel = window.getSelection();
      const faixa = document.createRange();
      // O caret vai ONDE o ponteiro clicou: é o começo do gesto de selecionar o texto (o arrasto
      // segue daí). Sem o ponto — os caminhos que não vêm do mouse —, vai para o fim, como antes.
      const pos = ponto ? document.caretPositionFromPoint(ponto.x, ponto.y) : null;
      if (pos && rt.contains(pos.offsetNode)) {
        faixa.setStart(pos.offsetNode, pos.offset);
        faixa.collapse(true);
      } else {
        faixa.selectNodeContents(rt);
        faixa.collapse(false);
      }
      sel?.removeAllRanges();
      sel?.addRange(faixa);
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
    // Camadas: a opacidade e o nome vêm no comando (os campos do painel)
    if (cmd.startsWith("camada:op:")) {
      this.editar((s) => opacidadeDaCamada(s, cmd.slice(10), Number(value) / 100), "camada-op");
      return;
    }
    if (cmd.startsWith("camada:nome:")) {
      this.editar((s) => renomearCamada(s, cmd.slice(12), String(value ?? "")), "camada-nome");
      return;
    }
    if (cmd.startsWith("pintura:transp:")) {
      this.pinturaTransp = Math.max(0.05, Math.min(1, Number(cmd.slice(15)) || 0.35));
      this.atualizarUI();
      return;
    }
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
      // "slide-new" é o comando do card do fim da faixa: a prévia cria com o último layout e o
      // rótulo "+ Nova lâmina" abre a galeria (que chama este mesmo comando com o layout escolhido)
      case "slide-new": {
        this.registrar();
        // a lâmina nova herda o fundo e as decorações fixas da atual e já vem com as caixas do
        // layout escolhido — sem valor (o clique da frente da fita e o "+" da faixa), vale o
        // ÚLTIMO layout escolhido: o clique direto cria sem abrir a galeria
        const layout = (value as SlideLayout) || this.ultimoLayout;
        this.definirUltimoLayout(layout);
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
        // alterna oculta/mostra: a lâmina continua no editor, mas o apresentador pula ela.
        // O "apagar" é `undefined` (e não `delete`): o modelo da lâmina é uma fusão, e sem a
        // chave o `show: false` antigo sobrevivia — o botão ficava em "Mostrar" sem efeito.
        this.editar((s) => (s.show === false ? { ...s, show: undefined } : { ...s, show: false }));
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
            // `undefined` e não `delete`: o modelo da lâmina é uma fusão (ver `replaceSlide`) —
            // sem a chave, o nome antigo sobrevivia e a lâmina continuava com o nome velho.
            if (limpo) n.nome = limpo;
            else n.nome = undefined;
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
        // aplicar um layout à lâmina atual também é uma ESCOLHA de layout: vira o último
        this.definirUltimoLayout(novo);
        this.slides = setLayout(this.deck, this.indice, novo).slides;
        // a capa e o miolo têm decorações diferentes: o desenho do modelo se refaz para o layout novo
        this.slides = this.slides.map((sl, i) => (i === this.indice ? refazerDesenho(sl, stageRatio(this.setup)) : sl));
        // lâmina sem caixas próprias (só decoração): recebe as caixas do layout
        const atual = this.atual();
        if (!atual.shapes.some((f) => !f.fixa)) this.substituirSlide({ ...atual, shapes: [...atual.shapes, ...formasDoLayout(novo, this.estilo())] });
        this.markDirty();
        this.pintar();
        return;
      }
      case "modelo": {
        const modelo = MODELOS.find((m) => m.id === value) ?? lerModelosUsuario().find((m) => m.id === value);
        if (modelo) this.usarModelo(modelo);
        return;
      }
      case "template-criar": {
        // salva o visual do deck atual como um modelo do usuário (fica no botão Template).
        // O comando é `template-criar` (e não `modelo-criar`): o Estúdio Modelo usa `modelo-criar`
        // para "esta box virou modelo" — com os dois no mesmo nome, o `case` de lá nunca rodava
        // (o switch pega o primeiro) e o botão "Modelo" da fita criava um cartão de Template.
        const modelo = criarModeloUsuario(this.slides, this.setup, String(value ?? ""));
        if (!modelo) {
          // o armazenamento local recusou: sem o aviso, a pessoa acharia que o modelo foi criado
          toast("Não foi possível salvar o modelo: o armazenamento do app está cheio ou indisponível.", "err", 7000);
          return;
        }
        toast(`Modelo "${modelo.nome}" salvo no botão Template.`, "ok", 4200);
        return;
      }
      case "modelo-excluir": {
        const nome = lerModelosUsuario().find((m) => m.id === String(value ?? ""))?.nome;
        if (!removerModeloUsuario(String(value ?? ""))) {
          toast("Não foi possível remover o modelo: o armazenamento do app está cheio ou indisponível.", "err", 7000);
          return;
        }
        toast(nome ? `Modelo "${nome}" removido.` : "Modelo removido.", "ok", 3000);
        return;
      }
      case "composicao":
        // o botão da fita (Página Inicial ▸ grupo Composição) abre o painel já na Composição
        this.mostrarPainelLateral();
        this.mostrarLateral("composicao");
        return;
      case "designer-aplicar": {
        // cartão do Designer ("arte|semente|modelo"): a arte e a paleta valem para esta lâmina — ou
        // para o deck inteiro, com a opção "todas as lâminas" (a capa recebe a arte grande, as demais, a de borda)
        const [arteId, semente, idModelo] = String(value ?? "").split("|");
        const arte = ARTES.find((a) => a.id === arteId)?.id as ArteId | undefined;
        const m = [...MODELOS, ...lerModelosUsuario()].find((x) => x.id === idModelo) ?? (idModelo?.startsWith("gerado-") ? gerarDesign(Number(idModelo.slice("gerado-".length))) : undefined);
        if (!arte || !m) return;
        this.registrar();
        this.aplicarArteDaComposicao(arte, Number(semente) || 0, m);
        this.pintar();
        return;
      }
      case "composicao-aplicar": {
        // cartão misto ("arranjo|variante|modelo|tratamento"): o visual e a arrumação valem para
        // esta lâmina — as duas metades num passo de desfazer só
        const [id, v, idModelo, t] = String(value ?? "").split("|");
        // "-" = a lâmina não é arrumável (lâmina de título): o cartão só troca o visual
        const arranjo = id === "-" ? null : ARRANJOS.find((a) => a.id === id);
        const m = [...MODELOS, ...lerModelosUsuario()].find((x) => x.id === idModelo) ?? (idModelo.startsWith("gerado-") ? gerarDesign(Number(idModelo.slice("gerado-".length))) : undefined);
        if ((id !== "-" && !arranjo) || !m) return;
        this.registrar();
        this.aplicarVisualDaComposicao(m, t as TratamentoIdeia);
        // a arrumação lê a lâmina JÁ com o modelo novo (o deck mudou de referência no meio)
        if (arranjo) this.substituirSlide(aplicarArranjo(this.atual(), arranjo.id, Number(v) || 0, stageRatio(this.setup)));
        this.pintar();
        return;
      }
      case "ideia": {
        // cartão do modo Visual: aplica o design com o acabamento proposto ("id|tratamento")
        const [id, t] = String(value ?? "").split("|");
        const m = [...MODELOS, ...lerModelosUsuario()].find((x) => x.id === id) ?? (id.startsWith("gerado-") ? gerarDesign(Number(id.slice("gerado-".length))) : undefined);
        if (m) {
          this.registrar();
          this.aplicarVisualDaComposicao(m, t as TratamentoIdeia);
          this.pintar();
        }
        return;
      }
      case "arranjo": {
        // cartão do modo Arrumação: aplica a fórmula ("id|variante") só na lâmina atual (a que a prévia mostra)
        const [id, v] = String(value ?? "").split("|");
        const arranjo = ARRANJOS.find((a) => a.id === id);
        if (arranjo) {
          this.registrar();
          const ratio = stageRatio(this.setup);
          this.substituirSlide(aplicarArranjo(sl, arranjo.id, Number(v) || 0, ratio));
          // repinta o palco (e as miniaturas): sem isto a lâmina mudava na memória e o resultado só
          // aparecia ao trocar de slide — os outros comandos da Composição já repintavam
          this.pintar();
        }
        return;
      }
      case "variantes":
        // o botão da aba Design abre a galeria com a lâmina atual desenhada em cada família de cor
        this.abrirVariantes();
        return;
      case "variante": {
        // cartão das Variantes: aplica a família à apresentação inteira (a prévia é a mesma função)
        const m = modelosDasVariantes(this.setup.fontFamily).find((x) => x.id === value);
        if (m) this.usarModelo(m);
        return;
      }
      case "tamanho-lamina": {
        // proporção da lâmina (o "Tamanho do Slide" da aba Design): 16:9 ou 4:3
        const aspecto = value === "4:3" ? "4:3" : "16:9";
        if (aspecto === this.setup.aspect) return;
        this.registrar("tamanho-lamina");
        this.setSetup({ aspect: aspecto });
        return;
      }

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
      // "Painel": mostra o painel lateral já na lista de animações (a lista mora nele)
      case "animacao-painel":
        this.mostrarPainelLateral();
        this.mostrarLateral("animacao");
        return;

      case "present":
        return this.present();
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
      case "copiar-formato":
        return this.alternarPincelFormato(value === "fixo");
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
      case "curva":
        this.ferramenta = this.ferramenta?.tipo === "curva" ? null : { tipo: "curva" };
        this.selecao = [];
        this.atualizarPincel();
        this.stage.desenharSelecao();
        this.fita.atualizar();
        return;
      case "conectar":
        this.ferramenta = this.ferramenta?.tipo === "conectar" ? null : { tipo: "conectar" };
        this.selecao = []; // no modo conectar valem as bolinhas das bordas, não as alças
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
        if (value === "texto") {
          this.ferramenta = this.ferramenta?.tipo === "texto" ? null : { tipo: "texto" };
        } else if (value === "curva") {
          this.ferramenta = this.ferramenta?.tipo === "curva" ? null : { tipo: "curva" };
          this.selecao = [];
        } else {
          this.ferramenta = null;
        }
        // o pincel de formatação vive junto da ferramenta: sair dela (Esc, outro botão) esquece o formato copiado
        this.pincelFmt = null;
        this.atualizarPincel();
        this.stage.desenharSelecao();
        this.fita.atualizar();
        return;
      // ---- pincel do Draw: os controles vivem na aba Desenhar (a barrinha do palco é só a dica) ----
      case "pincel-cor": {
        const est = this.estilo();
        this.pincel.cor = String(value ?? "").trim() || est.acento;
        gravarPincel(this.pincel);
        this.atualizarPincel();
        return;
      }
      case "pincel-w":
        this.pincel.w = Number(value) || 2;
        gravarPincel(this.pincel);
        this.atualizarPincel();
        return;
      case "pincel-modo":
        this.stage.definirModoDesenho(value === "pontos" ? "pontos" : "livre");
        this.atualizarPincel();
        return;
      case "pincel-assistente":
        this.pincel.assistente = !this.pincel.assistente;
        gravarPincel(this.pincel);
        this.atualizarPincel();
        return;
      case "pincel-tipo": {
        // caneta (traço normal) ou marca-texto de tinta: escolher já liga o Draw com ele
        this.pincel.tipo = value === "marca" ? "marca" : "caneta";
        gravarPincel(this.pincel);
        if (this.ferramenta?.tipo !== "desenho") this.ferramenta = { tipo: "desenho" };
        this.pincelFmt = null;
        this.atualizarPincel();
        this.stage.desenharSelecao();
        return;
      }
      case "borracha": {
        this.ferramenta = this.ferramenta?.tipo === "borracha" ? null : { tipo: "borracha" };
        this.selecao = [];
        this.pincelFmt = null;
        this.atualizarPincel();
        this.stage.desenharSelecao();
        return;
      }
      // ---- Estúdio: o ambiente isolado de uma box ----
      case "estudio": {
        this.alternarEstudio();
        return;
      }
      case "estudio-regioes": {
        this.alternarModoRegioes();
        return;
      }
      // ---- Modelo de box e cópias vinculadas (fase 5) ----
      case "modelo-criar": {
        const alvo = this.principal();
        if (!alvo) return;
        this.editar((s) => criarModelo(s, alvo.id, d), "modelo");
        toast("Esta box virou modelo: as cópias vinculadas seguem o que mudar nela.", "ok", 4400);
        return;
      }
      case "modelo-desfazer": {
        const alvo = this.principal();
        if (alvo) this.editar((s) => desfazerModelo(s, alvo.id, d), "modelo");
        return;
      }
      case "modelo-copia": {
        const alvo = this.principal();
        if (!alvo) return;
        const { slide, card, novos } = novaCopia(this.atual(), alvo.id, d);
        if (!card) return;
        this.registrar("modelo-copia");
        this.substituirSlide(slide);
        this.markDirty();
        this.selecionar(novos);
        this.pintar();
        toast("Cópia vinculada criada: editar o modelo muda todas; o nome de cada uma se desvincula sozinho ao editar.", "ok", 5600);
        return;
      }
      case "modelo-desvincular":
        this.editar((s) => desvincular(s, ids), "modelo-desvincular");
        return;
      case "modelo-revincular":
        this.editar((s) => revincular(s, ids, d), "modelo-revincular");
        return;

      // ---- Camadas: a pintura (e as formas) agrupada numa lista que se esconde e ordena ----
      case "camada-nova": {
        this.editar((s) => criarCamada(s, this.selecao), "camada-nova");
        return;
      }
      case "camada:olho": {
        const c = camadasDe(sl).find((x) => x.id === value);
        if (c) this.editar((s) => esconderCamada(s, value!, !c.oculta), "camada-olho");
        return;
      }
      case "camada:sobe":
        this.editar((s) => moverCamada(s, value!, 1), "camada-ordem");
        return;
      case "camada:desce":
        this.editar((s) => moverCamada(s, value!, -1), "camada-ordem");
        return;
      case "camada:fundir":
        this.editar((s) => fundirParaBaixo(s, value!), "camada-fundir");
        return;
      case "camada:apagar":
        this.editar((s) => apagarCamada(s, value!), "camada-apagar");
        return;
      // ---- Pintura: o pincel, o balde e o vidro (só dentro do Estúdio) ----
      case "pintura:pincel":
      case "pintura:balde":
      case "pintura:vidro": {
        const qual = cmd.slice(8) as "pincel" | "balde" | "vidro";
        this.pintura = this.pintura === qual ? "nenhuma" : qual;
        this.cancelarPintura();
        this.atualizarUI();
        return;
      }
      case "pintura:nenhuma": {
        this.pintura = "nenhuma";
        this.cancelarPintura();
        this.atualizarUI();
        return;
      }

      case "tinta-forma": {
        // "Converter em forma": o traço escolhido passa pelo reconhecedor e vira a forma limpa
        const alvos = this.atual().shapes.filter((f) => this.selecao.includes(f.id) && f.tinta);
        if (!alvos.length) {
          toast("Escolha um traço de tinta para converter em forma.", "info", 3600);
          return;
        }
        const patches = new Map<string, Partial<Shape>>();
        for (const s of alvos) {
          const nova = formaDaTinta(s, this.dim());
          if (nova) patches.set(s.id, nova);
        }
        if (!patches.size) {
          toast("O assistente não reconheceu o traço — ele continua como desenho livre.", "info", 4200);
          return;
        }
        const ids = [...patches.keys()];
        this.editar((sl) => patchFormas(sl, ids, (f) => patches.get(f.id) ?? {}), "tinta-forma");
        toast(`${patches.size} traço(s) viraram forma.`, "ok", 3200);
        return;
      }
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
        // com estilo vivo, a cor escolhida é a COR-BASE do estilo (a rampa inteira se refaz) e
        // "sem preenchimento" é edição manual: o estilo é solto e a pintura fica
        const estilizadas = this.idsComEstilo();
        const outras = ids.filter((id) => !estilizadas.includes(id));
        if (estilizadas.length) {
          const manual: Fill | undefined = value === "none" ? { kind: "none" } : solido(String(value));
          this.editar((s) => {
            const n = value === "none" ? soltarEstilo(s, estilizadas) : ligarEstilo(s, estilizadas, { base: String(value) }, estiloDaFamilia("propria"));
            return outras.length ? patchFormas(n, outras, (f) => comPreenchimento(f, manual)) : n;
          }, "estilo");
          return;
        }
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
        // com estilo vivo, a orientação escolhida vira o ÂNGULO do estilo (o radial é edição
        // manual: solta o estilo e entra como pintura)
        const estilizadas = this.idsComEstilo();
        const dir = String(value);
        const ang: Record<string, number> = { baixo: 90, cima: 270, direita: 0, esquerda: 180, diagonal: 45 };
        if (estilizadas.length && dir !== "radial") {
          this.editar((s) => ligarEstilo(s, estilizadas, { angulo: ang[dir] ?? 90 }, estiloDaFamilia("esmeralda")), "estilo");
          return;
        }
        const base = corPrincipal(principal?.fillX) ?? this.estilo().acento;
        const c1 = ajustarCor(base, 1.3);
        const c2 = ajustarCor(base, 0.75);
        const fill: Fill = dir === "radial" ? { ...gradiente(c1, c2), radial: true, angle: undefined } : gradiente(c1, c2, ang[dir] ?? 90);
        this.editar((s) => patchFormas(estilizadas.length ? soltarEstilo(s, estilizadas) : s, ids, (f) => comPreenchimento(f, fill)));
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
        // a chave junta as prévias do seletor de cores num passo só de desfazer (o seletor aplica
        // enquanto se mexe — o "Outra cor" não espera mais o OK)
        this.comPintura((s) => patchFormas(s, ids, (f) => (value === "none" ? comLinha(f, null) : comLinha(f, { color: String(value) }))), "contorno");
        return;
      case "ln-tipo":
        this.comPintura((s) => patchFormas(s, ids, (f) => (value === "none" ? comLinha(f, null) : comLinha(f, f.ln ?? { color: ajustarCor(corPrincipal(f.fillX) ?? "4F46E5", 0.7), w: 1 }))));
        return;
      case "ln-cor":
        this.comPintura((s) => patchFormas(s, ids, (f) => comLinha(f, { color: String(value) })), "ln-cor");
        return;
      case "ln-w":
      case "espessura":
        this.comPintura((s) => patchFormas(s, ids, (f) => comLinha(f, { w: Math.max(0, Number(String(value).replace(",", "."))) })), "ln-w");
        return;
      case "ln-transp":
        this.comPintura((s) => patchFormas(s, ids, (f) => comLinha(f, { alpha: 1 - Math.max(0, Math.min(100, Number(value))) / 100 })), "ln-transp");
        return;
      case "ln-dash":
      case "traco":
        this.comPintura((s) => patchFormas(s, ids, (f) => comLinha(f, { dash: value as never })));
        return;
      case "ln-head":
      case "ponta-ini":
        this.comPintura((s) => patchFormas(s, ids, (f) => comLinha(f, { head: (value || undefined) as never })));
        return;
      case "ln-tail":
      case "ponta-fim":
        this.comPintura((s) => patchFormas(s, ids, (f) => comLinha(f, { tail: (value || undefined) as never })));
        return;
      case "ln-cap":
        this.comPintura((s) => patchFormas(s, ids, (f) => comLinha(f, { cap: value as never })));
        return;
      case "ln-lado-t":
      case "ln-lado-r":
      case "ln-lado-b":
      case "ln-lado-l": {
        const lado = cmd.slice(-1) as "t" | "r" | "b" | "l";
        const pct = Number(String(value).replace(",", "."));
        this.comPintura((s) => patchFormas(s, ids, (f) => comLadoContorno(f, lado, pct)), "ln-lado");
        return;
      }
      case "ln-inv": {
        const lado = value as "t" | "r" | "b" | "l";
        this.comPintura((s) => patchFormas(s, ids, (f) => inverterLadoContorno(f, lado)), "ln-inv");
        return;
      }
      case "ln-preset":
        this.comPintura(
          (s) => patchFormas(s, ids, (f) => presetContorno(f, value as "completo" | "metade" | "topo")),
          "ln-preset"
        );
        return;

      // ---- efeitos ----
      case "sombra-pronta":
        this.comPintura((s) => patchFormas(s, ids, (f) => comSombra(f, SOMBRAS_PRONTAS[Number(value)]?.sombra ?? null)));
        return;
      case "sd-on":
        this.comPintura((s) => patchFormas(s, ids, (f) => comSombra(f, value === "1" ? {} : null)));
        return;
      case "sd-cor":
        this.comPintura((s) => patchFormas(s, ids, (f) => comSombra(f, { color: String(value) })), "sd");
        return;
      case "sd-transp":
        this.comPintura((s) => patchFormas(s, ids, (f) => comSombra(f, { alpha: 1 - Math.max(0, Math.min(100, Number(value))) / 100 })), "sd");
        return;
      case "sd-blur":
        this.comPintura((s) => patchFormas(s, ids, (f) => comSombra(f, { blur: Math.max(0, Number(value)) })), "sd");
        return;
      case "sd-dist":
        this.comPintura((s) => patchFormas(s, ids, (f) => comSombra(f, { dist: Math.max(0, Number(value)) })), "sd");
        return;
      case "sd-dir":
        this.comPintura((s) => patchFormas(s, ids, (f) => comSombra(f, { dir: Number(value) })), "sd");
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
      case "estilo-cor":
        this.estiloCor(String(value ?? ""));
        return;
      case "est-cor-base":
        this.estiloCor("cor:" + String(value ?? ""));
        return;
      case "est-cor-angulo":
        this.estiloCor("angulo:" + String(value ?? ""));
        return;
      case "est-cor-int":
        this.estiloCor("intensidade:" + String(value ?? ""));
        return;
      case "est-cor-bri":
        this.estiloCor("brilho:" + String(value ?? ""));
        return;
      case "fundo-estilo":
        this.fundoEstilo(String(value ?? ""));
        return;
      case "fundo-est-int":
        this.fundoEstilo("intensidade:" + String(value ?? ""));
        return;
      case "fundo-est-bri":
        this.fundoEstilo("brilho:" + String(value ?? ""));
        return;
      case "fundo-est-angulo":
        this.fundoEstilo("angulo:" + String(value ?? ""));
        return;
      case "fundo-est-cor":
        this.fundoEstilo("cor:" + String(value ?? ""));
        return;

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
        // com estilo no fundo, "gradiente" é o que ele já é; o resto é edição manual (solta o estilo)
        if (sl.bgEstilo) {
          if (value === "gradient") return;
          if (value === "tema") return this.editar((s) => ({ ...soltarEstiloFundo(s), bg: undefined }), "fundo");
          if (value === "image") {
            this.editar((s) => soltarEstiloFundo(s), "fundo");
            return this.run("fundo-imagem");
          }
          const t = themeOf(this.setup.theme);
          const atual = sl.bg?.kind === "solid" ? sl.bg.color! : t.bg;
          return this.editar((s) => ({ ...soltarEstiloFundo(s), bg: solido(atual) }), "fundo");
        }
        if (value === "tema") return this.editar((s) => ({ ...s, bg: undefined }));
        if (value === "image") return this.run("fundo-imagem");
        const t = themeOf(this.setup.theme);
        const atual = sl.bg?.kind === "solid" ? sl.bg.color! : t.bg;
        const bg: Fill = value === "solid" ? solido(atual) : gradiente(ajustarCor(atual, 1.1), ajustarCor(atual, 0.8), 90);
        return this.editar((s) => ({ ...s, bg }));
      }
      case "fundo-cor":
      case "bg-cor":
        // com estilo no fundo, a cor escolhida é a COR-BASE (a rampa inteira se refaz)
        if (sl.bgEstilo && value !== "tema") return this.editar((s) => ligarEstiloFundo(s, { base: String(value).toUpperCase() }, estiloDaFamilia("propria")), "fundo");
        return this.editar((s) => ({ ...soltarEstiloFundo(s), bg: value === "tema" ? undefined : solido(String(value)) }), "fundo");
      case "fundo-grad": {
        const dir = String(value);
        const ang: Record<string, number> = { baixo: 90, cima: 270, direita: 0, esquerda: 180, diagonal: 45 };
        if (sl.bgEstilo && dir !== "radial") return this.editar((s) => ligarEstiloFundo(s, { angulo: ang[dir] ?? 90 }, estiloDaFamilia("esmeralda")), "fundo");
        const base = sl.bg?.kind === "solid" ? sl.bg.color! : this.estilo().acento;
        const bg: Fill = dir === "radial" ? { ...gradiente(ajustarCor(base, 1.3), ajustarCor(base, 0.75)), radial: true, angle: undefined } : gradiente(ajustarCor(base, 1.3), ajustarCor(base, 0.75), ang[dir] ?? 90);
        return this.editar((s) => ({ ...soltarEstiloFundo(s), bg }), "fundo");
      }
      case "bg-grad-angulo":
        if (sl.bgEstilo) return this.editar((s) => ligarEstiloFundo(s, { angulo: Number(value) }, estiloDaFamilia("esmeralda")), "fundo");
        return this.editar((s) => (s.bg?.kind === "gradient" ? { ...s, bg: { ...s.bg, angle: Number(value) } } : s), "fundo");
      case "fundo-todas": {
        // o estilo do fundo viaja junto com o gradiente (senão as outras lâminas voltariam ao tema)
        const bg = sl.bg;
        const bgEstilo = sl.bgEstilo;
        this.registrar();
        this.slides = this.slides.map((x) => {
          const n: Slide = { ...x, bg };
          if (bgEstilo) n.bgEstilo = bgEstilo;
          else delete n.bgEstilo;
          return n;
        });
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
    // os estilos rápidos são pintura manual: numa forma com estilo vivo, o estilo é solto antes
    this.comPintura((s) => patchFormas(s, this.selecao, aplicar));
  }

  // ------------------------------------------------------------------
  // copiar e colar
  // ------------------------------------------------------------------

  /**
   * "Copiar formatação" (o Pincel de Formatação): guarda o formato da forma principal da seleção e
   * arma a ferramenta de pintura. Clicar de novo no botão (ou Esc) desliga; o duplo clique na fita
   * arma o modo fixo, em que o pincel pinta várias formas até ser desligado.
   */
  private alternarPincelFormato(fixo: boolean): void {
    if (this.ferramenta?.tipo === "pincel" && !fixo) {
      this.run("ferramenta", "");
      return;
    }
    const origem = this.principal();
    if (!origem) return;
    this.pincelFmt = { formato: copiarFormato(origem), fixo };
    this.ferramenta = { tipo: "pincel" };
    this.atualizarPincel();
    this.stage.desenharSelecao();
    this.fita.atualizar();
  }

  /**
   * O clique do pincel de formatação: o alvo veste o formato copiado (a geometria, a caixa, o giro e
   * o texto dele ficam). Clique no vazio ou em forma travada não gasta o pincel — ele fica armado.
   */
  private aoPincelar(id: string | null): void {
    const p = this.pincelFmt;
    if (!p || !id) return;
    const alvo = this.atual().shapes.find((s) => s.id === id);
    if (!alvo || alvo.bloqueada) return;
    const fmt = p.formato;
    // sem receita de estilo na cópia, o estilo vivo do alvo é solto antes (a pintura fica dona)
    this.editar((s) => patchFormas(fmt.estilo ? s : soltarEstilo(s, [id]), [id], (f) => aplicarFormato(f, fmt)));
    if (!p.fixo) this.run("ferramenta", "");
  }

  /** O que vai para a área de transferência ao copiar:
   * - o formato INTERNO num tipo próprio (`web text/x-mdc-formas`) — é o que o colar daqui lê;
   * - a IMAGEM em PNG quando a escolha é uma imagem (outros apps colam o desenho, como no
   *   PowerPoint — antes colavam o JSON interno como texto, o relato com print);
   * - `text/plain` = o texto das formas de TEXTO (nunca o JSON: colar num editor de texto tem de
   *   dar o texto, e num app sem suporte, nada).
   */
  private copiar(): void {
    void this.copiarParaAreaDeTransferencia();
  }

  private async copiarParaAreaDeTransferencia(): Promise<void> {
    const ids = comGrupos(this.atual(), this.selecao);
    const formas = this.atual().shapes.filter((s) => ids.includes(s.id));
    if (!formas.length) return;
    areaDeTransferencia = formas.map((s) => JSON.parse(JSON.stringify(s)) as Shape);
    const texto = formas
      .filter((s) => s.kind === "texto" && s.text)
      .map((s) => s.text)
      .join("\n\n");
    try {
      const itens: Record<string, Blob> = {
        "web text/x-mdc-formas": new Blob([JSON.stringify(areaDeTransferencia)], { type: "text/plain" }),
        "text/plain": new Blob([texto], { type: "text/plain" }),
      };
      const png = await this.pngDaImagemCopiavel();
      if (png) itens["image/png"] = png;
      await navigator.clipboard.write([new ClipboardItem(itens)]);
    } catch {
      // sem a área de transferência rica: o colar daqui continua pelo `areaDeTransferencia`; e o
      // texto (nunca o JSON) é o que dá para oferecer
      try {
        await navigator.clipboard?.writeText(texto);
      } catch {
        /* sem acesso à área de transferência */
      }
    }
    this.atualizarUI();
  }

  /** O PNG da imagem escolhida (só quando a seleção é UMA imagem): é o que outros apps colam. */
  private async pngDaImagemCopiavel(): Promise<Blob | null> {
    const formas = this.atual().shapes.filter((s) => this.selecao.includes(s.id));
    if (formas.length !== 1 || formas[0].kind !== "imagem" || !formas[0].src) return null;
    const src = urlDaMidia(formas[0].src, this.setup.media ?? {});
    if (!src) return null;
    try {
      const blob = await (await fetch(src)).blob();
      if (blob.type === "image/png") return blob;
      // JPEG/WebP/etc.: redesenha num canvas e devolve PNG (o único tipo que a área de
      // transferência aceita de forma universal)
      const bmp = await createImageBitmap(blob);
      const cv = document.createElement("canvas");
      cv.width = bmp.width;
      cv.height = bmp.height;
      cv.getContext("2d")?.drawImage(bmp, 0, 0);
      bmp.close?.();
      return await new Promise<Blob | null>((ok) => cv.toBlob((b) => ok(b), "image/png"));
    } catch {
      return null;
    }
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
    // o formato INTERNO vem primeiro: copiar uma imagem daqui e colar daqui tem de colar a FORMA
    // (com id e estilo), e não inserir o PNG que também acompanha a cópia (o caminho dos arquivos
    // fica para as imagens que vêm DE FORA)
    const texto = dt.getData("text/plain");
    const interno = dt.getData("web text/x-mdc-formas") || dt.getData("text/x-mdc-formas");
    const json = interno || (texto.startsWith("mdc-formas:") ? texto.slice(11) : "");
    if (json) {
      try {
        const formas = JSON.parse(json) as Shape[];
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
    const img = Array.from(dt.files).find((f) => f.type.startsWith("image/"));
    if (img) {
      e.preventDefault();
      void this.lerArquivoDeImagem(img).then((src) => this.insertImage(src));
      return;
    }
    if (texto.trim()) {
      // texto solto vai para a CAIXA ESCOLHIDA, no fim do texto dela (pedido: o texto da área de
      // transferência entra dentro de uma caixa; sem caixa escolhida, ele cria a própria caixa e
      // cola). O "digitado" é aplicado sobre os parágrafos, então o que já estava fica como está.
      e.preventDefault();
      const escolhida = this.principal();
      const caixaAlvo = escolhida && !escolhida.tabela ? escolhida : null;
      if (caixaAlvo) {
        const atual = textoDosParas(caixaAlvo.paras ?? []);
        const junto = atual.trim() ? `${atual.replace(/\s+$/, "")}\n${texto.trim()}` : texto.trim();
        const paras = parasComTexto(caixaAlvo.paras ?? [], junto, this.estiloDeDigitacao(caixaAlvo));
        this.registrar();
        this.substituirSlide({
          ...this.atual(),
          shapes: this.atual().shapes.map((s) => (s.id === caixaAlvo.id ? { ...s, paras, text: textoDosParas(paras) } : s)),
        });
        this.selecao = [caixaAlvo.id];
        this.markDirty();
        this.pintar();
        return;
      }
      // sem caixa escolhida: uma caixa nova recebe o conteúdo (como já era)
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

    if (this.stage.temPontosCurva()) {
      if (e.key === "Enter") {
        return this.consumir(e, () => {
          this.stage.finalizarCurva();
          this.atualizarPincel();
        });
      }
      if (e.key === "Escape") {
        return this.consumir(e, () => {
          this.stage.cancelarCurva();
          this.atualizarPincel();
        });
      }
      if (e.key === "Backspace" || e.key === "Delete") {
        return this.consumir(e, () => {
          this.stage.removerUltimoPontoCurva();
          this.atualizarPincel();
        });
      }
    }

    if (e.key === "Escape") {
      // prévia de animação em andamento: o Escape para e devolve a forma ao normal
      if (this.animPreview) {
        this.consumir(e, () => {
          this.animPreview?.cancelar();
          this.animPreview = null;
        });
        return;
      }
      if (this.ferramenta) this.consumir(e, () => this.run("ferramenta", ""));
      // Estúdio: o modo Regiões sai primeiro, depois a região, e por fim o ambiente isolado
      else if (this.modoRegioes) this.consumir(e, () => this.alternarModoRegioes());
      else if (this.pintura !== "nenhuma") this.consumir(e, () => this.run("pintura:nenhuma"));
      else if (this.regiao) this.consumir(e, () => this.voltarParaBox());
      else if (this.estudio) this.consumir(e, () => this.sairDoEstudio());
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
    e.preventDefault();
    fecharPopup();
    // botão direito + arrasto = panorama: não abre o menu (o clique parado na forma continua abrindo)
    if (this.stage.consumirPanorama()) return;
    const alvo = e.target as HTMLElement;
    const formaEl = alvo.closest<HTMLElement>(".pp-shape[data-shape]");
    const id = formaEl?.dataset.shape;
    const forma = id ? this.atual().shapes.find((s) => s.id === id) : undefined;
    // Clique direito no vazio da lâmina é do gesto de panorama (mover a tela): não abre o popup
    // de "Colar / Selecionar tudo" para não atrapalhar a navegação.
    if (!forma || (forma.fixa && !this.fixas)) return;
    if (!this.selecao.includes(forma.id)) this.selecionar(comGrupos(this.atual(), [forma.id]));
    // A PILHA do ponto clicado: com várias formas empilhadas (um avatar sobre o cartão, os textos
    // por cima…), o clique só pega a de cima — este item pega todas de uma vez (cada uma com o grupo
    // dela), e quem quiser só algumas tira o resto com Shift/clique depois.
    const pilha = comGrupos(this.atual(), this.stage.formasNoPonto(e.clientX, e.clientY));
    // O menu de contexto da forma: em grupos (editar, área de transferência, forma) e com o
    // item "Organizar" — o MESMO menu da fita, com o mesmo ícone (ordem, alinhamento, grupo,
    // giro e bloqueio), para não ter dois lugares diferentes com o mesmo nome.
    const item = (c: string, n: string, ok = true) =>
      `<button type="button" class="pp-pop-item" data-c="${c}"${ok ? "" : " disabled"}>${n}</button>`;
    const titulo = (t: string) => `<div class="pp-pop-t">${t}</div>`;
    const html = [
      titulo("Editar"),
      item("editar-texto", "Editar texto", this.selecao.length === 1 && !!this.principal()?.paras),
      item("sel-ponto", pilha.length > 1 ? `Selecionar tudo neste ponto (${pilha.length})` : "Selecionar tudo neste ponto", pilha.length > 1),
      titulo("Área de transferência"),
      item("recortar", "Recortar"),
      item("copiar", "Copiar"),
      item("colar", "Colar", areaDeTransferencia.length > 0),
      titulo("Forma"),
      item("duplicar", "Duplicar"),
      item("excluir", "Excluir"),
      titulo("Organizar"),
      ITEM_ORGANIZAR,
    ].join("");
    const ancora = document.createElement("span");
    ancora.style.cssText = `position:fixed;left:${e.clientX}px;top:${e.clientY}px;width:1px;height:1px`;
    document.body.append(ancora);
    const el = abrirPopup(ancora, html, { classe: "pp-pop-menu", aoFechar: () => ancora.remove() });
    el.addEventListener("click", (ev) => {
      const alvo = ev.target as HTMLElement;
      const b = alvo.closest<HTMLButtonElement>("[data-c],[data-organizar]");
      if (!b) return;
      if (b.hasAttribute("data-organizar")) {
        // o item "Organizar" abre o menu completo (o da fita) AO LADO dele, como um submenu:
        // embaixo não caberia (o item fica no rodapé do menu) e o menu subia para o topo da tela
        abrirMenuOrganizar(b, (cmd, valor) => this.run(cmd, valor), { aoLado: true });
        return;
      }
      if (b.disabled) return;
      fecharPopup();
      const c = b.dataset.c!;
      if (c === "editar-texto") this.entrarEdicao(this.selecao[0]);
      else if (c === "sel-ponto") this.selecionar(pilha);
      else this.run(c);
    });
  }

  /**
   * Menu de contexto da MINIATURA da faixa (clique direito).
   *
   * Antes o clique direito aqui caía no menu nativo do WebView (Voltar/Atualizar/Salvar como/
   * Imprimir/Inspecionar) — nada a ver com a lâmina, e sem o "Duplicar lâmina" que se procura
   * ali. As ações agem na lâmina CLICADA (`this.indice = i`), como o × de excluir já fazia; a
   * fita continua agindo na lâmina atual.
   */
  private menuDaLamina(e: MouseEvent, i: number): void {
    e.preventDefault();
    e.stopPropagation();
    const slide = this.slides[i];
    if (!slide) return;
    const oculta = slide.show === false;
    const itens: [string, string, boolean][] = [
      ["dup", "Duplicar lâmina", true],
      ["nova", "Nova lâmina no fim", true],
      ["nome", "Renomear…", true],
      ["ocultar", oculta ? "Mostrar na apresentação" : "Ocultar na apresentação", true],
      ["del", "Excluir lâmina", this.slides.length > 1],
    ];
    const ancora = document.createElement("span");
    ancora.style.cssText = `position:fixed;left:${e.clientX}px;top:${e.clientY}px;width:1px;height:1px`;
    document.body.append(ancora);
    const el = abrirPopup(ancora, itens.map(([c, n, ok]) => `<button type="button" class="pp-pop-item" data-c="${c}"${ok ? "" : " disabled"}>${n}</button>`).join(""), {
      classe: "pp-pop-menu",
      aoFechar: () => ancora.remove(),
    });
    el.addEventListener("click", (ev) => {
      const b = (ev.target as HTMLElement).closest<HTMLButtonElement>("[data-c]");
      if (!b || b.disabled) return;
      fecharPopup();
      const c = b.dataset.c!;
      if (c === "nova") {
        // a regra do app vale também aqui: a lâmina nova entra no FIM
        this.run("slide-new");
        return;
      }
      this.indice = i;
      if (c === "dup") this.run("slide-dup");
      else if (c === "del") this.run("slide-del");
      else if (c === "nome") this.run("slide-nome");
      else this.run("slide-ocultar");
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

  /** Aplica um efeito à seleção (a ordem é a da aplicação) e já mostra como ele toca. */
  private aplicarAnimacao(tipo: AnimacaoTipo): void {
    if (!this.selecao.length) return;
    const ids = comGrupos(this.atual(), this.selecao);
    this.editarAnimacoes((lista) => {
      let nova = lista;
      for (const id of ids) nova = comAnimacao(nova, id, tipo);
      return nova;
    }, "animacao");
    // como no PowerPoint: aplicar mostra o efeito tocando; a prévia devolve a forma ao normal
    this.preverAnimacoes();
  }

  /**
   * Ajusta os efeitos de **todas as formas escolhidas** — como no PowerPoint, os controles
   * (início, duração, atraso, direção, por parágrafo, remover) valem para a seleção; com uma
   * forma só, é o efeito dela. Antes os controles usavam `principal()` e mexiam apenas na
   * última forma escolhida: com duas caixas selecionadas, a segunda ficava com a animação
   * original.
   */
  private editarAnimacoesDaSelecao(fn: (lista: Animacao[] | undefined, id: string) => Animacao[] | undefined, rotulo: string): void {
    if (!this.selecao.length) return;
    const ids = comGrupos(this.atual(), this.selecao);
    this.editarAnimacoes((lista) => {
      let nova = lista;
      // a forma sem efeito deixa o helper devolver undefined: fica o que já estava
      for (const id of ids) nova = fn(nova, id) ?? nova;
      return nova;
    }, rotulo);
  }

  /** Muda o início do efeito das formas escolhidas (ao clicar / com / depois do anterior). */
  private mudarInicioAnimacao(inicio: AnimacaoInicio): void {
    this.editarAnimacoesDaSelecao((lista, id) => comInicio(lista, id, inicio), "animacao");
  }

  /** Muda a duração do efeito das formas escolhidas (só nos efeitos com transição). */
  private mudarDuracaoAnimacao(segundos: number): void {
    if (!Number.isFinite(segundos)) return;
    this.editarAnimacoesDaSelecao((lista, id) => comDuracao(lista, id, segundos), "animacao");
  }

  /** Muda o atraso do efeito das formas escolhidas (0 = sem atraso). */
  private mudarAtrasoAnimacao(segundos: number): void {
    if (!Number.isFinite(segundos)) return;
    this.editarAnimacoesDaSelecao((lista, id) => comAtraso(lista, id, segundos), "animacao");
  }

  /** Muda a direção da trajetória das formas escolhidas. */
  private mudarDirecaoAnimacao(direcao: AnimacaoDirecao): void {
    this.editarAnimacoesDaSelecao((lista, id) => comDirecao(lista, id, direcao), "animacao");
  }

  /** Liga/desliga o "por parágrafo" do efeito das formas escolhidas. */
  private mudarPorParagrafoAnimacao(ativo: boolean): void {
    this.editarAnimacoesDaSelecao((lista, id) => comPorParagrafo(lista, id, ativo), "animacao");
  }

  /** Tira o efeito das formas escolhidas (ou só da indicada pelo painel de animação). */
  private removerAnimacao(forma?: string): void {
    // o `semAnimacao` devolve `undefined` também quando a lista FICA VAZIA (resultado válido:
    // o campo é limpo) — por isso aqui o undefined passa, em vez de manter a lista anterior
    if (forma) {
      this.editarAnimacoes((lista) => semAnimacao(lista, forma), "animacao-remover");
      return;
    }
    if (!this.selecao.length) return;
    const ids = comGrupos(this.atual(), this.selecao);
    this.editarAnimacoes((lista) => {
      let nova: Animacao[] | undefined = lista;
      for (const id of ids) nova = semAnimacao(nova, id);
      return nova;
    }, "animacao-remover");
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
    // limparNoFim: a prévia é só uma espiada — no fim a forma volta ao estado de projeto
    this.animPreview = iniciarAnimacoes(this.slideEl, lista, { automatico: true, limparNoFim: true });
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
    this.pincelFmt = null;
    // outra aba/documento: o Estúdio não atravessa (a box é de uma lâmina de um documento)
    this.estudio = null;
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

  /** A lâmina em foco no editor (0-based) — é a que o Histórico mostra na prévia. */
  laminaEmFoco(): number {
    return this.indice;
  }

  /**
   * Prévia de UMA lâmina de um estado serializado (o Histórico usa): o MESMO desenho da miniatura
   * da faixa, encaixado em qualquer largura (o CSS do container cuida do tamanho). `null` quando o
   * estado não tem essa lâmina — a versão é de antes de ela existir.
   */
  previaDaLamina(estado: string, indice: number): HTMLElement | null {
    const snap = deserialize(estado);
    const slide = snap?.slides[indice];
    if (!snap || !slide) return null;
    const setup = { ...DEFAULT_SETUP, ...snap.setup };
    const { w, h } = aspectSize(setup);
    const ctx: CtxRender = {
      larguraPt: w * 72,
      alturaPt: h * 72,
      media: setup.media ?? {},
      selecionada: null,
      editavel: false,
      editando: null,
      celulaEdit: null,
    };
    const box = document.createElement("div");
    box.className = "hi-lamina";
    for (const [k, v] of Object.entries(stageVars(setup))) box.style.setProperty(k, v);
    box.style.setProperty("--slide-ratio", String(stageRatio(setup)));
    box.style.background = fundoValor(slide.bg, setup.media ?? {}) || "var(--slide-bg, #fff)";
    if (slide.shapes.length) {
      box.innerHTML = slide.shapes.map((f) => htmlFormaRica(f, ctx)).join("");
    } else {
      const md = document.createElement("div");
      md.className = "hi-lamina-md";
      md.innerHTML = sanitize(marked.parse(slide.md, { gfm: true, async: false }) as string);
      box.append(md);
    }
    return box;
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
  /**
   * O visual de uma sugestão da Composição: só a lâmina aberta (cores, fonte, desenho e formato das
   * caixas — nenhuma caixa muda de posição), ou o deck inteiro quando a opção "todas as lâminas"
   * está ligada. Sem histórico e sem pintar: o chamador cuida dos dois.
   */
  private aplicarVisualDaComposicao(modelo: ModeloPPT, tratamento?: TratamentoIdeia): void {
    if (this.composicaoTodas) return this.aplicarModeloDeck(modelo, tratamento);
    const de: EstiloAtual = { theme: this.setup.theme, bg: this.setup.bg, fontFamily: this.setup.fontFamily };
    this.substituirSlide(aplicarModeloALamina(this.atual(), de, modelo, tratamento, stageRatio(this.setup)));
  }

  /**
   * A arte do Designer: só a lâmina aberta, ou o deck inteiro com a opção "todas as lâminas" (aí o
   * tema, o fundo e a fonte do deck também seguem o modelo, como no Template). Sem histórico e sem
   * pintar: o chamador cuida dos dois.
   */
  private aplicarArteDaComposicao(arte: ArteId, semente: number, modelo: ModeloPPT): void {
    const de: EstiloAtual = { theme: this.setup.theme, bg: this.setup.bg, fontFamily: this.setup.fontFamily };
    const ratio = stageRatio(this.setup);
    if (!this.composicaoTodas) {
      this.substituirSlide(aplicarArte(this.atual(), arte, semente, modelo, de, ratio));
      return;
    }
    this.slides = this.slides.map((sl, i) => aplicarArte(sl, arte, semente + i, modelo, de, ratio));
    this.setup = { ...this.setup, theme: modelo.tema, bg: modelo.bg, fontFamily: modelo.fonte };
    const d = this.dim();
    const tema = this.estilo();
    this.slides = this.slides.map((s) => atualizarEstilos(s, d, tema));
  }

  private usarModelo(modelo: ModeloPPT, tratamento?: TratamentoIdeia): void {
    this.registrar();
    this.aplicarModeloDeck(modelo, tratamento);
    this.pintar();
  }

  /**
   * O miolo do `usarModelo`, sem histórico e sem pintar: é o que a Composição usa para juntar o
   * visual e a arrumação num passo de desfazer só (o `registrar` e o `pintar` ficam com o
   * chamador). Sem o `pintar` do `setSetup`, o tema/fundo/fonte entram no `setup` direto — o
   * caminho do modelo não mexe no `aspect`, que é o que o `setSetup` trataria à parte.
   */
  private aplicarModeloDeck(modelo: ModeloPPT, tratamento?: TratamentoIdeia): void {
    this.slides = aplicarModelo(this.slides, { theme: this.setup.theme, bg: this.setup.bg, fontFamily: this.setup.fontFamily }, modelo, tratamento, stageRatio(this.setup));
    this.setup = { ...this.setup, theme: modelo.tema, bg: modelo.bg, fontFamily: modelo.fonte };
    this.markDirty();
    // o estilo vivo acompanha o modelo: re-deriva as formas e os fundos com o acento NOVO (a
    // base vazia passou a apontar para ele) — sem isso a pintura ficaria com a rampa antiga até
    // a próxima edição da lâmina
    const d = this.dim();
    const tema = this.estilo();
    this.slides = this.slides.map((s) => atualizarEstilos(s, d, tema));
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
    // trocar de lâmina fecha o Estúdio (a box é de uma lâmina só) e devolve o zoom de antes
    if (this.estudio) {
      this.estudio = null;
      this.regiao = null;
      this.modoRegioes = false;
      this.pintura = "nenhuma";
      this.cancelarPintura();
      this.stage.setZoom(this.zoomAntesEstudio);
    }
    this.indice = novo;
    this.selecao = [];
    this.pintar();
  }

  /** Distribui formas (usado pelo botão da fita). */
  distribuir(eixo: "h" | "v"): void {
    this.run("distribuir", eixo);
  }
}
