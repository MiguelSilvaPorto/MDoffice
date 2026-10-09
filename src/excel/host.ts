// Motor de planilhas (.xlsx): grade, fita, edição de célula e cálculo.
// Mesmo papel do src/powerpoint/powerpoint.ts e do src/word/host.ts — o App
// só conversa com a classe ExcelHost exportada aqui.
//
// O que este motor NÃO faz (e o app avisa ao salvar):
//   • referência entre abas na fórmula ("=Planilha2!A1" vira #REF!)
//   • gráficos, imagens, tabelas dinâmicas, validação de dados
//   • formatação condicional e quebras de página na exportação

import { $, h } from "../util";
import { fita, marcarFita, type FormatState } from "./ribbon";
import { calcular, ehFormula, textoDe as operandoTexto, type Contexto, type Operando } from "./formula";
import {
  CABECALHO_COL_PX,
  CABECALHO_LINHA_PX,
  COLUNA_PX,
  LIMITE_CELULAS,
  LINHA_PX,
  MAX_COLUNAS,
  MAX_LINHAS,
  type Alinhamento,
  type Celula,
  type ConfigPlanilha,
  type Estilo,
  type Folha,
  type FormatoNumero,
  type Livro,
} from "./schema";
import {
  dentro,
  deslocarFormula,
  faixa,
  intervalo,
  nomeColuna,
  partes,
  percorrer,
  ref,
  alturaLinha,
  larguraColuna,
  somaAlturas,
  somaLarguras,
  xColuna,
  yLinha,
  type Intervalo,
} from "./refs";
import {
  booleanoDe,
  dataDe,
  dataParaSerial,
  ehErro,
  ehMoeda,
  ehPercentual,
  numeroDe,
  valorParaTexto,
  type Valor,
} from "./values";
import {
  CONFIG_PADRAO,
  duplicarFolha,
  ehVazia,
  estaCheia,
  inserirFolha,
  livroDeExemplo,
  moverFolha,
  novaFolha,
  nomeLivre,
  removerFolha,
  renomearFolha,
  resumo,
  serialize,
  deserialize,
} from "./model";

/** O que o App guarda por aba (serializável, como o WordTabData). */
export interface ExcelTabData {
  livro: Livro;
  config: ConfigPlanilha;
  /** linha e coluna da célula ativa */
  linha: number;
  coluna: number;
}

export interface ExcelHostOptions {
  pane: HTMLElement;
  /** mudou alguma coisa: o App marca a aba como suja e agenda o salvamento */
  onDirty?: () => void;
  /** aba, linha, coluna ou seleção mudaram (rodapé e barra de fórmulas) */
  onStatus?: () => void;
  /** o usuário pediu o diálogo "Configurar planilha" */
  onConfigure?: () => void;
  /** salvar em outro formato não se aplica: o App cuida */
  onPickImage?: () => void;
}

/** Seleção: retângulo + célula ativa dentro dele. */
interface Selecao {
  intervalo: Intervalo;
  ativa: { linha: number; col: number };
}

/** Estado de edição de uma célula (quando o usuário está digitando nela). */
interface Edicao {
  linha: number;
  col: number;
  /** o texto cru que está na caixa de edição */
  texto: string;
  /** célula de origem, para "Esc" voltar ao valor antigo */
  original: string;
}

export class ExcelHost {
  private pane: HTMLElement;
  private opts: ExcelHostOptions;

  private livro: Livro = { folhas: [novaFolha()], ativa: 0 };
  private config: ConfigPlanilha = { ...CONFIG_PADRAO };

  /** célula ativa */
  private linha = 0;
  private coluna = 0;
  /** seleção retangular (quando é só a célula ativa, l1=c1=l2=c2) */
  private sel: Intervalo = { l1: 0, c1: 0, l2: 0, c2: 0 };

  private edicao: Edicao | null = null;
  /** célula que o ponteiro está sobre (para o realce ao passar o mouse) */
  private hover: { linha: number; col: number } | null = null;
  /** arrastando a alça de preenchimento? */
  private preenchendo = false;

  private grade!: HTMLElement;
  private cabecalhoLinhas!: HTMLElement;
  private cabecalhoColunas!: HTMLElement;
  private canto!: HTMLElement;
  private superficie!: HTMLElement;
  private barraFormula!: HTMLInputElement;
  private entrada!: HTMLInputElement;
  private fitaEl!: HTMLElement;
  private abasEl!: HTMLElement;
  private posEl!: HTMLElement;
  private zoomEl!: HTMLElement;

  /** Cache: texto já calculado por célula, para não recalcular a cada tecla. */
  private cache: Map<string, { chave: string; valor: Operando }> = new Map();
  constructor(opts: ExcelHostOptions) {
    this.opts = opts;
    this.pane = opts.pane;
    this.montar();
    this.pintar();
  }

  // ==================================================================
  // montagem do DOM
  // ==================================================================

  private montar(): void {
    this.pane.innerHTML = `
      <div id="xl-ribbon" class="xl-ribbon" role="toolbar" aria-label="Formatação da planilha"></div>
      <div class="xl-barra-formula">
        <span class="xl-nome-celula" data-nomecel>A1</span>
        <span class="xl-sinal">fx</span>
        <input class="xl-formula" data-formula type="text" spellcheck="false" autocomplete="off" placeholder="Digite um valor ou uma fórmula começando com =" aria-label="Conteúdo da célula" />
      </div>
      <div class="xl-guias" data-guias role="tablist" aria-label="Abas da planilha"></div>
      <div class="xl-area" data-area>
        <div class="xl-grade" data-grade tabindex="0" role="grid" aria-label="Planilha">
          <div class="xl-superficie" data-superficie></div>
        </div>
        <input class="xl-entrada" data-entrada type="text" spellcheck="false" autocomplete="off" aria-label="Editar célula" hidden />
      </div>
      <div class="xl-status">
        <span data-pos>Célula A1</span>
        <span class="spacer"></span>
        <span class="xl-zoom">
          <button type="button" class="btn small" data-zoom="out" title="Reduzir">−</button>
          <input type="range" min="50" max="200" step="10" value="100" data-zoomrange aria-label="Zoom" />
          <span data-zoomval>100%</span>
          <button type="button" class="btn small" data-zoom="in" title="Ampliar">+</button>
        </span>
      </div>`;

    this.grade = $("[data-grade]", this.pane);
    // os cabeçalhos são sobreposições fixas sobre a área que rola (como no Excel):
    // por isso vivem fora do "superficie", que é quem anda com a rolagem
    this.cabecalhoLinhas = h("div", { class: "xl-cab-linhas" });
    this.cabecalhoColunas = h("div", { class: "xl-cab-colunas" });
    this.canto = h("div", { class: "xl-canto", title: "Selecionar tudo (Ctrl+A)" });
    this.canto.addEventListener("click", () => this.selecionarTudo());
    this.superficie = $("[data-superficie]", this.pane);
    const area = $("[data-area]", this.pane);
    area.append(this.cabecalhoLinhas, this.cabecalhoColunas, this.canto);

    this.barraFormula = $<HTMLInputElement>("[data-formula]", this.pane);
    this.entrada = $<HTMLInputElement>("[data-entrada]", this.pane);
    this.fitaEl = $("#xl-ribbon", this.pane);
    this.abasEl = $("[data-guias]", this.pane);
    this.posEl = $("[data-pos]", this.pane);
    this.zoomEl = $("[data-zoomval]", this.pane);

    this.fitaEl = fita(this.fitaEl, {
      query: () => this.estadoFormatacao(),
      run: (cmd, valor) => this.executar(cmd, valor),
      configure: () => this.opts.onConfigure?.(),
      pickImage: () => this.opts.onPickImage?.(),
    });

    this.ligarEventos();
  }

  private ligarEventos(): void {
    // ao rolar, os cabeçalhos fixos precisam ser redesenhados (eles não rolam)
    this.grade.addEventListener("scroll", () => this.pintarCabecalhos());
    window.addEventListener("resize", () => this.pintar());

    // ---- navegação por teclado ----
    this.grade.addEventListener("keydown", (e) => this.teclaDaGrade(e));

    // ---- mouse: clique seleciona, arrastar estende, alça preenche ----
    let arrastando = false;
    let ancorou = false;
    let selBase: Intervalo | null = null;
    let direcao: "baixo" | "direita" | null = null;

    this.superficie.addEventListener("mousedown", (e) => {
      const alvo = e.target as HTMLElement | null;
      if (!alvo || !(alvo instanceof HTMLElement)) return;
      if (e.button === 2) return;

      // puxou a alça de preenchimento: guarda a seleção e espera o arrasto
      if (alvo.closest(".xl-alca-preench")) {
        this.preenchendo = true;
        arrastando = true;
        selBase = { ...this.sel };
        direcao = null;
        e.preventDefault();
        return;
      }

      const cel = alvo.closest<HTMLElement>("[data-cel]");
      if (!cel) return;
      const alvoCel = this.posicaoDe(Number(cel.dataset.lin), Number(cel.dataset.col));
      if (!alvoCel) return;
      arrastando = true;
      ancorou = true;
      const estendido = e.shiftKey || e.ctrlKey;
      if (!estendido) {
        this.sel = { l1: alvoCel.linha, c1: alvoCel.col, l2: alvoCel.linha, c2: alvoCel.col };
        this.linha = alvoCel.linha;
        this.coluna = alvoCel.col;
      }
      this.focarGrade();
      this.pintar();
      e.preventDefault();
    });

    window.addEventListener("mousemove", (e) => {
      if (!arrastando) {
        this.hover = this.posicaoDoEvento(e);
        return;
      }
      const p = this.posicaoDoEvento(e);
      if (!p) return;

      // preenchendo: a seleção cresce do retângulo guardado até a célula do mouse
      if (this.preenchendo && selBase) {
        if (p.linha > selBase.l2) direcao = "baixo";
        else if (p.col > selBase.c2) direcao = "direita";
        if (!direcao) {
          this.sel = { ...selBase };
        } else if (direcao === "baixo") {
          this.sel = { ...selBase, l2: Math.max(selBase.l2, p.linha) };
        } else {
          this.sel = { ...selBase, c2: Math.max(selBase.c2, p.col) };
        }
        this.pintar();
        return;
      }

      if (!ancorou) return;
      this.sel = {
        l1: Math.min(this.linha, p.linha),
        c1: Math.min(this.coluna, p.col),
        l2: Math.max(this.linha, p.linha),
        c2: Math.max(this.coluna, p.col),
      };
      this.pintar();
    });

    window.addEventListener("mouseup", () => {
      if (arrastando && this.preenchendo && selBase && direcao) {
        this.preencherSelecao(selBase, direcao);
      }
      arrastando = false;
      ancorou = false;
      this.preenchendo = false;
      selBase = null;
      direcao = null;
    });

    this.superficie.addEventListener("mousemove", (e) => {
      const p = this.posicaoDoEvento(e);
      this.hover = p;
      this.pintarRealce();
    });
    this.superficie.addEventListener("mouseleave", () => {
      this.hover = null;
      this.pintarRealce();
    });

    // ---- duplo clique edita ----
    this.superficie.addEventListener("dblclick", (e) => {
      const alvo = (e.target as HTMLElement).closest<HTMLElement>("[data-cel]");
      if (!alvo) return;
      const l = Number(alvo.dataset.lin);
      const c = Number(alvo.dataset.col);
      this.linha = l;
      this.coluna = c;
      this.editarCelula(this.valorBruto(l, c));
      e.preventDefault();
    });

    // ---- barra de fórmulas ----
    this.barraFormula.addEventListener("keydown", (e) => this.teclaDaFormula(e));
    this.barraFormula.addEventListener("focus", () => this.barraFormula.select());

    // ---- a caixa de edição dentro da célula ----
    this.entrada.addEventListener("keydown", (e) => this.teclaDaEntrada(e));
    this.entrada.addEventListener("blur", () => {
      // só confirma se ainda estiver em edição (o Tab/Enter já resolveu)
      if (this.edicao) this.confirmarEdicao(true);
    });

    // ---- arrastar e soltar uma célula solta valores de texto ----
    this.entrada.addEventListener("paste", (e) => this.colar(e));
    this.grade.addEventListener("paste", (e) => this.colar(e));

    // ---- zoom pela barra de status ----
    this.pane.querySelector("[data-zoom=out]")?.addEventListener("click", () => this.setZoom(this.config.zoom - 10));
    this.pane.querySelector("[data-zoom=in]")?.addEventListener("click", () => this.setZoom(this.config.zoom + 10));
    const range = this.pane.querySelector<HTMLInputElement>("[data-zoomrange]");
    range?.addEventListener("input", () => this.setZoom(+range.value));
  }

  /** Converte as coordenadas de um elemento [data-cel] em posição de célula. */
  private posicaoDe(linha: number, col: number): { linha: number; col: number } | null {
    if (linha < 0 || linha >= MAX_LINHAS || col < 0 || col >= MAX_COLUNAS) return null;
    return { linha, col };
  }

  /** Descobre a célula sob o ponteiro, pelas medidas da aba. */
  private posicaoDoEvento(e: MouseEvent): { linha: number; col: number } | null {
    const alvo = (e.target as HTMLElement | null)?.closest?.<HTMLElement>("[data-cel]");
    if (alvo) return { linha: Number(alvo.dataset.lin), col: Number(alvo.dataset.col) };

    // fora de uma célula (nas bordas ou sobre os realces): mede pelo conteúdo
    const r = this.grade.getBoundingClientRect();
    const x = e.clientX - r.left + this.grade.scrollLeft;
    const y = e.clientY - r.top + this.grade.scrollTop;
    if (x < CABECALHO_COL_PX || y < CABECALHO_LINHA_PX) return null;
    return { linha: this.linhaEm(y), col: this.colunaEm(x) };
  }

  /** Índice da coluna na posição horizontal do conteúdo (nula se passou do fim). */
  private colunaEm(x: number): number {
    const f = this.folha;
    const z = this.escala();
    let acc = CABECALHO_COL_PX;
    for (let c = 0; c < MAX_COLUNAS; c++) {
      const w = larguraColuna(f.colunas, c, COLUNA_PX) * z;
      if (x < acc + w) return c;
      acc += w;
    }
    return MAX_COLUNAS - 1;
  }

  /** Índice da linha na posição vertical do conteúdo. */
  private linhaEm(y: number): number {
    const f = this.folha;
    const z = this.escala();
    let acc = CABECALHO_LINHA_PX;
    for (let l = 0; l < MAX_LINHAS; l++) {
      const alt = alturaLinha(f.linhas, l, LINHA_PX) * z;
      if (y < acc + alt) return l;
      acc += alt;
    }
    return MAX_LINHAS - 1;
  }

  private get folha(): Folha {
    return this.livro.folhas[this.livro.ativa] ?? this.livro.folhas[0];
  }

  /** Fator de escala do zoom (medida da grade x zoom). */
  private escala(): number {
    return Math.max(0.5, Math.min(2, this.config.zoom / 100));
  }

  // ==================================================================
  // cálculo
  // ==================================================================

  /**
   * O Contexto que o avaliador de fórmulas usa. Recalcula sob demanda com um
   * cache por célula, e devolve #CIRC! se as fórmulas se referenciarem em ciclo.
   */
  private contexto(): Contexto {
    const f = this.folha;
    return {
      valorDe: (alvo) => this.valorCalculado(alvo),
      faixaAlvo: (alvo) => {
        const out: Operando[] = [];
        for (const { linha, col } of percorrer(alvo)) out.push(this.valorCalculado(ref(linha, col)));
        return out;
      },
    };
    void f;
  }

  /** Valor de uma célula da aba atual (número, texto, booleano, vazio ou erro). */
  private valorCalculado(refA1: string): Operando {
    const f = this.folha;
    const cel = f.celulas[refA1];
    if (!cel || !cel.texto) return null;

    // cache: só recalcula quando o texto bruto muda
    const guardado = this.cache.get(refA1);
    if (guardado && guardado.chave === cel.texto) return guardado.valor;

    let valor: Operando;
    if (cel.formula || ehFormula(cel.texto)) {
      valor = calcular(cel.texto, this.contexto());
    } else {
      const bruto = cel.texto;
      const boo = booleanoDe(bruto);
      if (boo !== null) {
        valor = boo;
      } else {
        const num = numeroDe(bruto);
        if (num !== null) {
          const pct = ehPercentual(bruto);
          valor = pct ? num / 100 : num;
        } else {
          const d = dataDe(bruto);
          if (d) {
            valor = dataParaSerial(d);
          } else {
            valor = bruto;
          }
        }
      }
    }
    this.cache.set(refA1, { chave: cel.texto, valor });
    return valor;
  }

  /** Valor de uma célula já convertido para o texto que aparece na grade. */
  private valorExibido(linha: number, col: number): string {
    const f = this.folha;
    const cel = f.celulas[ref(linha, col)];
    if (!cel) return "";
    // com "mostrar fórmulas" ligado, a grade mostra o texto cru da fórmula
    if (this.mostrarFrases && (cel.formula || ehFormula(cel.texto))) return cel.texto;
    const v = this.valorCalculado(ref(linha, col));
    if (ehErro(v)) return v.codigo;
    return valorParaTexto(v as Valor, cel.estilo, this.config);
  }

  /** Texto cru que o usuário digitou (para a barra de fórmulas e a edição). */
  private valorBruto(linha: number, col: number): string {
    return this.folha.celulas[ref(linha, col)]?.texto ?? "";
  }

  // ==================================================================
  // desenho
  // ==================================================================

  private pintar(): void {
    const f = this.folha;
    const z = this.escala();
    const cabL = CABECALHO_LINHA_PX;
    const cabC = CABECALHO_COL_PX;
    const largTotal = somaLarguras(f.colunas, MAX_COLUNAS - 1, COLUNA_PX) * z;
    const altTotal = somaAlturas(f.linhas, MAX_LINHAS - 1, LINHA_PX) * z;

    // mostrar/ocultar as linhas da grade é uma classe: o CSS cuida das bordas
    this.grade.classList.toggle("sem-grade", !this.config.grade);
    this.superficie.style.width = `${cabC + largTotal}px`;
    this.superficie.style.height = `${cabL + altTotal}px`;

    // os cabeçalhos são sobreposições fixas sobre a área (não rolam com o conteúdo)
    this.cabecalhoLinhas.style.width = `${cabC}px`;
    this.cabecalhoLinhas.style.height = `${this.grade.clientHeight}px`;
    this.cabecalhoColunas.style.left = `${cabC}px`;
    this.cabecalhoColunas.style.height = `${cabL}px`;

    this.desenharCabecalhos();
    this.desenharCelulas();
    this.desenharGuias();
    this.pintarBarraFormula();
    this.pintarStatus();
    this.pintarRealce();
    this.ajustarEntrada();
    marcarFita(this.fitaEl, this.estadoFormatacao());
  }

  private desenharCabecalhos(): void {
    const f = this.folha;
    const z = this.escala();
    const cabL = CABECALHO_LINHA_PX;
    const cabC = CABECALHO_COL_PX;

    // Letras de coluna: a faixa começa em x=cabC e não rola, então a posição
    // de cada letra é relativa a ela (descontando a rolagem horizontal).
    const scrollX = this.grade.scrollLeft;
    const visLargura = this.grade.clientWidth - cabC;
    const cols: string[] = [];
    for (let c = 0; c < MAX_COLUNAS; c++) {
      const x = xColuna(f.colunas, c, COLUNA_PX) * z - scrollX;
      const w = larguraColuna(f.colunas, c, COLUNA_PX) * z;
      if (x + w < 0 || x > visLargura) continue;
      const selecionada = c >= this.sel.c1 && c <= this.sel.c2;
      cols.push(
        `<button type="button" class="xl-cab-c${selecionada ? " sel" : ""}" data-colcab="${c}" style="left:${x}px;width:${w}px">${nomeColuna(c)}</button>`
      );
    }
    this.cabecalhoColunas.innerHTML = cols.join("");
    // selecionar coluna inteira
    this.cabecalhoColunas.onclick = (e) => {
      const alvo = (e.target as HTMLElement).closest<HTMLElement>("[data-colcab]");
      if (!alvo) return;
      const c = Number(alvo.dataset.colcab);
      const ult = this.ultimaLinhaUsada();
      this.linha = 0;
      this.coluna = c;
      this.sel = { l1: 0, c1: c, l2: ult, c2: c };
      this.pintar();
      this.opts.onStatus?.();
    };

    const scrollY = this.grade.scrollTop;
    const visAltura = this.grade.clientHeight;
    const lins: string[] = [];
    for (let l = 0; l < MAX_LINHAS; l++) {
      const y = cabL + yLinha(f.linhas, l, LINHA_PX) * z - scrollY;
      const alt = alturaLinha(f.linhas, l, LINHA_PX) * z;
      if (y + alt < 0 || y > visAltura) continue;
      const selecionada = l >= this.sel.l1 && l <= this.sel.l2;
      lins.push(
        `<button type="button" class="xl-cab-l${selecionada ? " sel" : ""}" data-lincab="${l}" style="top:${y}px;height:${alt}px">${l + 1}</button>`
      );
    }
    this.cabecalhoLinhas.innerHTML = lins.join("");
    this.cabecalhoLinhas.onclick = (e) => {
      const alvo = (e.target as HTMLElement).closest<HTMLElement>("[data-lincab]");
      if (!alvo) return;
      const l = Number(alvo.dataset.lincab);
      const ultCol = this.ultimaColunaUsada();
      this.linha = l;
      this.coluna = 0;
      this.sel = { l1: l, c1: 0, l2: l, c2: ultCol };
      this.pintar();
      this.opts.onStatus?.();
    };
  }

  private desenharCelulas(): void {
    const f = this.folha;
    const z = this.escala();
    const cabL = CABECALHO_LINHA_PX;
    const cabC = CABECALHO_COL_PX;
    const scrollX = this.grade.scrollLeft;
    const scrollY = this.grade.scrollTop;
    const visLargura = this.grade.clientWidth - cabC;
    const visAltura = this.grade.clientHeight - cabL;

    // Só desenha o que cabe na tela (permite rolar 1000 linhas sem pesar).
    // A posição é em coordenadas do CONTEÚDO; a rolagem só decide o que entra.
    const partes: string[] = [];
    for (let l = 0; l < MAX_LINHAS; l++) {
      const y = cabL + yLinha(f.linhas, l, LINHA_PX) * z;
      const alt = alturaLinha(f.linhas, l, LINHA_PX) * z;
      if (y + alt - scrollY < 0 || y - scrollY > visAltura) continue;
      for (let c = 0; c < MAX_COLUNAS; c++) {
        const x = cabC + xColuna(f.colunas, c, COLUNA_PX) * z;
        const larg = larguraColuna(f.colunas, c, COLUNA_PX) * z;
        if (x + larg - scrollX < 0 || x - scrollX > visLargura) continue;

        const r = ref(l, c);
        const cel = f.celulas[r];
        const mesclada = this.mesclaDe(l, c);
        // célula mesclada: quem desenha é a âncora (canto superior esquerdo);
        // os outros pedaços da mescla não desenham nada
        if (mesclada.l1 !== l || mesclada.c1 !== c) continue;

        const estilo = cel?.estilo;
        const texto = this.edicao && this.edicao.linha === l && this.edicao.col === c ? "" : this.valorExibido(l, c);

        const classes = ["xl-cel"];
        if (cel?.formula) classes.push("formula");
        if (estilo?.numero) classes.push(`n-${estilo.numero}`);
        if (mesclada.l2 > mesclada.l1 || mesclada.c2 > mesclada.c1) classes.push("mesclada");
        const estiloCss = [
          `left:${x}px;top:${y}px;width:${mesclada.largura}px;height:${mesclada.altura}px`,
          estilo?.negrito ? "font-weight:700" : "",
          estilo?.italico ? "font-style:italic" : "",
          estilo?.cor ? `color:#${estilo.cor}` : "",
          estilo?.fundo ? `background:#${estilo.fundo}` : "",
          estilo?.alinhamento ? `text-align:${estilo.alinhamento === "esquerda" ? "left" : estilo.alinhamento}` : "",
        ]
          .filter(Boolean)
          .join(";");

        partes.push(
          `<div class="${classes.join(" ")}" style="${estiloCss}" data-cel data-lin="${l}" data-col="${c}" data-ref="${r}" title="${escaparHtml(texto)}">${escaparHtml(texto)}</div>`
        );
      }
    }

    // Mesclas cuja âncora está fora da vista, mas que ainda aparecem na tela:
    // desenha o pedaço visível (sem texto), para a faixa não sumir.
    for (const m of f.mesclas) {
      const r = intervalo(m);
      if (!r) continue;
      // a âncora só foi desenhada se a célula dela passou no filtro de visibilidade
      const ay = cabL + yLinha(f.linhas, r.l1, LINHA_PX) * z;
      const aalt = alturaLinha(f.linhas, r.l1, LINHA_PX) * z;
      const ax = cabC + xColuna(f.colunas, r.c1, COLUNA_PX) * z;
      const alarg = larguraColuna(f.colunas, r.c1, COLUNA_PX) * z;
      const ancoraVisivel =
        ay + aalt - scrollY >= 0 &&
        ay - scrollY <= visAltura &&
        ax + alarg - scrollX >= 0 &&
        ax - scrollX <= visLargura;
      if (ancoraVisivel) continue;

      const fx = cabC + xColuna(f.colunas, r.c1, COLUNA_PX) * z;
      const fy = cabL + yLinha(f.linhas, r.l1, LINHA_PX) * z;
      const fw = (somaLarguras(f.colunas, r.c2, COLUNA_PX) - somaLarguras(f.colunas, r.c1 - 1, COLUNA_PX)) * z;
      const fh = (somaAlturas(f.linhas, r.l2, LINHA_PX) - somaAlturas(f.linhas, r.l1 - 1, LINHA_PX)) * z;
      const topo = Math.max(fy, scrollY + cabL);
      const base = Math.min(fy + fh, scrollY + visAltura);
      const esq = Math.max(fx, scrollX + cabC);
      const dir = Math.min(fx + fw, scrollX + visLargura);
      if (base <= topo || dir <= esq) continue;
      partes.push(
        `<div class="xl-cel mesclada" style="left:${esq}px;top:${topo}px;width:${dir - esq}px;height:${base - topo}px" data-cel data-lin="${r.l1}" data-col="${r.c1}"></div>`
      );
    }

    this.superficie.querySelectorAll(".xl-cel").forEach((el) => el.remove());
    this.superficie.insertAdjacentHTML("beforeend", partes.join(""));
  }

  private desenharGuias(): void {
    this.abasEl.innerHTML = "";
    this.livro.folhas.forEach((f, i) => {
      const b = h("button", {
        class: `xl-guia${i === this.livro.ativa ? " ativa" : ""}`,
        type: "button",
        role: "tab",
        title: `${f.nome} — duplo clique renomeia, botão direito dá as opções`,
      });
      b.textContent = f.nome;
      b.addEventListener("click", () => this.irParaAba(i));
      b.addEventListener("dblclick", () => this.renomearAbaNaTela(i));
      b.addEventListener("contextmenu", (e) => {
        e.preventDefault();
        this.menuAba(i, e.clientX, e.clientY);
      });
      this.abasEl.append(b);
    });
  }

  /** Renomeia a aba direto na tela (sem depender de janela do sistema). */
  private renomearAbaNaTela(i: number): void {
    const botao = this.abasEl.children[i] as HTMLElement | undefined;
    if (!botao || botao.querySelector("input")) return;
    const atual = this.livro.folhas[i]?.nome ?? "Planilha";
    const entrada = h("input", { class: "xl-guia-input", type: "text", value: atual, spellcheck: "false" });
    botao.textContent = "";
    botao.append(entrada);
    entrada.focus();
    entrada.select();
    let pronto = false;
    const terminar = (salvar: boolean) => {
      if (pronto) return;
      pronto = true;
      const valor = entrada.value.trim();
      if (salvar && valor && valor !== atual) {
        this.guardarPilha();
        this.livro = renomearFolha(this.livro, i, valor);
        this.sujo();
        this.pintar();
        return;
      }
      this.desenharGuias();
    };
    entrada.addEventListener("blur", () => terminar(true));
    entrada.addEventListener("keydown", (e) => {
      e.stopPropagation();
      if (e.key === "Enter") {
        e.preventDefault();
        terminar(true);
      } else if (e.key === "Escape") {
        e.preventDefault();
        terminar(false);
      }
    });
  }

  /** Menu do botão direito na aba (renomear, duplicar, excluir, mover). */
  private menuAba(i: number, x: number, y: number): void {
    document.querySelectorAll(".xl-menu").forEach((m) => m.remove());
    const menu = h("div", { class: "dropdown xl-menu" });
    const item = (rotulo: string, acao: () => void, desabilitado = false) => {
      const b = h("button", { class: "dd-item", type: "button", text: rotulo });
      if (desabilitado) b.disabled = true;
      else {
        b.addEventListener("click", () => {
          menu.remove();
          acao();
        });
      }
      menu.append(b);
    };
    this.irParaAba(i);
    item("Renomear", () => this.renomearAbaNaTela(this.livro.ativa));
    item("Duplicar", () => this.duplicarAba());
    item("Mover para a esquerda", () => this.moverAba(-1), this.livro.ativa === 0);
    item("Mover para a direita", () => this.moverAba(1), this.livro.ativa >= this.livro.folhas.length - 1);
    menu.append(h("div", { class: "dd-sep" }));
    item("Excluir", () => this.excluirAba(), this.livro.folhas.length <= 1);

    document.body.append(menu);
    menu.style.left = `${Math.max(8, Math.min(x, window.innerWidth - menu.offsetWidth - 8))}px`;
    menu.style.top = `${Math.max(8, Math.min(y, window.innerHeight - menu.offsetHeight - 8))}px`;
    const fechar = (ev: MouseEvent) => {
      if (!menu.contains(ev.target as Node)) {
        menu.remove();
        document.removeEventListener("mousedown", fechar, true);
      }
    };
    document.addEventListener("mousedown", fechar, true);
  }

  /** Realce da célula ativa, da seleção e da célula sob o mouse. */
  private pintarRealce(): void {
    this.superficie.querySelectorAll(".xl-realce").forEach((el) => el.remove());
    const f = this.folha;
    const z = this.escala();
    const cabL = CABECALHO_LINHA_PX;
    const cabC = CABECALHO_COL_PX;

    // tudo aqui é desenhado em coordenadas do CONTEÚDO (a rolagem é do navegador)
    const caixa = (l1: number, c1: number, l2: number, c2: number, classe: string): HTMLElement => {
      const x = cabC + xColuna(f.colunas, c1, COLUNA_PX) * z;
      const y = cabL + yLinha(f.linhas, l1, LINHA_PX) * z;
      const larg = somaLarguras(f.colunas, c2, COLUNA_PX) * z - somaLarguras(f.colunas, c1 - 1, COLUNA_PX) * z;
      const alt = somaAlturas(f.linhas, l2, LINHA_PX) * z - somaAlturas(f.linhas, l1 - 1, LINHA_PX) * z;
      return h("div", { class: `xl-realce ${classe}`, style: `left:${x}px;top:${y}px;width:${larg}px;height:${alt}px` });
    };

    // fundo da seleção retangular
    if (this.sel.l1 !== this.sel.l2 || this.sel.c1 !== this.sel.c2) {
      for (const g of this.mesclasVisiveis(this.sel)) {
        this.superficie.append(caixa(g.l1, g.c1, g.l2, g.c2, "sel"));
      }
    }

    // célula sob o mouse
    if (this.hover && !this.edicao) {
      const m = this.mesclaDe(this.hover.linha, this.hover.col);
      this.superficie.append(caixa(m.l1, m.c1, m.l2, m.c2, "hover"));
    }

    // borda grossa da célula ativa (dentro da seleção) + alça de preenchimento
    if (!this.edicao) {
      const m = this.mesclaDe(this.linha, this.coluna);
      const div = caixa(m.l1, m.c1, m.l2, m.c2, "ativa");
      div.append(h("span", { class: "xl-alca-preench", title: "Arrastar para preencher as células abaixo/direita" }));
      this.superficie.append(div);
    }
  }

  /** Retângulos visíveis de uma seleção, já contando as células mescladas. */
  private mesclasVisiveis(sel: Intervalo): Intervalo[] {
    const partes: Intervalo[] = [];
    const visto = new Set<string>();
    for (const { linha, col } of percorrer(sel)) {
      const m = this.mesclaDe(linha, col);
      const chave = `${m.l1},${m.c1},${m.l2},${m.c2}`;
      if (visto.has(chave)) continue;
      visto.add(chave);
      partes.push(m);
    }
    return partes;
  }

  /**
   * Retângulo da célula considerando mesclas; se não houver mescla, é a própria
   * célula. `largura` e `altura` já vêm em px (com zoom aplicado).
   */
  private mesclaDe(linha: number, col: number): Intervalo & { largura: number; altura: number } {
    const f = this.folha;
    const z = this.escala();
    const medida = (r: Intervalo): { largura: number; altura: number } => ({
      largura: (somaLarguras(f.colunas, r.c2, COLUNA_PX) - somaLarguras(f.colunas, r.c1 - 1, COLUNA_PX)) * z,
      altura: (somaAlturas(f.linhas, r.l2, LINHA_PX) - somaAlturas(f.linhas, r.l1 - 1, LINHA_PX)) * z,
    });
    for (const m of f.mesclas) {
      const r = intervalo(m);
      if (!r) continue;
      if (dentro(r, linha, col)) return { ...r, ...medida(r) };
    }
    return {
      l1: linha,
      c1: col,
      l2: linha,
      c2: col,
      largura: larguraColuna(f.colunas, col, COLUNA_PX) * z,
      altura: alturaLinha(f.linhas, linha, LINHA_PX) * z,
    };
  }

  private pintarBarraFormula(): void {
    if (this.edicao) return;
    const nome = $("[data-nomecel]", this.pane);
    nome.textContent = faixa(this.sel);
    this.barraFormula.value = this.valorBruto(this.linha, this.coluna);
  }

  private pintarStatus(): void {
    this.posEl.textContent =
      this.sel.l1 === this.sel.l2 && this.sel.c1 === this.sel.c2
        ? `Célula ${ref(this.linha, this.coluna)}`
        : `${ref(this.sel.l1, this.sel.c1)}:${ref(this.sel.l2, this.sel.c2)} · ${
            (this.sel.l2 - this.sel.l1 + 1) * (this.sel.c2 - this.sel.c1 + 1)
          } células`;
    this.zoomEl.textContent = `${this.config.zoom}%`;
    const range = this.pane.querySelector<HTMLInputElement>("[data-zoomrange]");
    if (range) range.value = String(this.config.zoom);
  }

  private pintarCabecalhos(): void {
    this.desenharCabecalhos();
    // o realce da célula ativa fica em coordenadas de conteúdo: nada a fazer
  }

  /** Última linha/coluna com conteúdo (para "selecionar coluna inteira" e Ctrl+End). */
  private ultimaLinhaUsada(): number {
    let max = 0;
    for (const k of Object.keys(this.folha.celulas)) {
      const p = partes(k);
      if (p) max = Math.max(max, p.linha);
    }
    for (const m of this.folha.mesclas) {
      const r = intervalo(m);
      if (r) max = Math.max(max, r.l2);
    }
    return max;
  }

  private ultimaColunaUsada(): number {
    let max = 0;
    for (const k of Object.keys(this.folha.celulas)) {
      const p = partes(k);
      if (p) max = Math.max(max, p.col);
    }
    for (const m of this.folha.mesclas) {
      const r = intervalo(m);
      if (r) max = Math.max(max, r.c2);
    }
    return max;
  }

  // ==================================================================
  // edição de célula
  // ==================================================================

  private editarCelula(textoInicial?: string): void {
    const r = ref(this.linha, this.coluna);
    const original = this.valorBruto(this.linha, this.coluna);
    this.edicao = { linha: this.linha, col: this.coluna, texto: textoInicial ?? original, original };
    this.entrada.hidden = false;
    this.entrada.value = textoInicial ?? original;
    this.ajustarEntrada();
    this.pintarRealce();
    this.entrada.focus();
    if (textoInicial === undefined) this.entrada.select();
    else this.entrada.setSelectionRange(this.entrada.value.length, this.entrada.value.length);
    this.pintarBarraFormula();
  }

  /** Confirma a edição e devolve o texto salvo (para a barra de fórmulas). */
  private confirmarEdicao(focarGrade = true): void {
    if (!this.edicao) return;
    const { linha, col, texto } = this.edicao;
    this.edicao = null;
    this.entrada.hidden = true;
    this.escrever(linha, col, texto);
    this.linha = linha;
    this.coluna = col;
    this.sel = { l1: linha, c1: col, l2: linha, c2: col };
    if (focarGrade) this.focarGrade();
    this.pintar();
    this.opts.onStatus?.();
  }

  /** Escreve o texto numa célula, aplicando o estilo que o texto sugere. */
  private escrever(linha: number, col: number, texto: string): void {
    const f = this.folha;
    const r = ref(linha, col);
    const limpo = texto.trim() === "" ? "" : texto;
    const atual = f.celulas[r];

    if (limpo === "") {
      // célula vazia: some se não tiver estilo
      if (atual && ehVazia({ ...atual, texto: "" })) delete f.celulas[r];
      this.cache.delete(r);
      this.sujo();
      return;
    }
    if (estaCheia(f) && !atual) {
      this.avisoLimite();
      return;
    }

    // detecta número, moeda, porcentagem e data para já marcar o formato
    const estilo: Estilo = { ...(atual?.estilo ?? {}) };
    const pct = ehPercentual(limpo);
    const moeda = ehMoeda(limpo, this.config.moeda);
    const data = dataDe(limpo);
    if (pct && estilo.numero !== "porcento") estilo.numero = "porcento";
    else if (moeda && estilo.numero !== "moeda") estilo.numero = "moeda";
    else if (data && estilo.numero !== "data") estilo.numero = "data";
    else if (!pct && !moeda && !data && numeroDe(limpo) !== null && estilo.numero === "geral") {
      // número puro sem formato: o "geral" já mostra certinho
    }
    if (ehFormula(limpo)) {
      f.celulas[r] = { texto: limpo, formula: true, estilo: Object.keys(estilo).length ? estilo : undefined };
    } else {
      f.celulas[r] = { texto: limpo, estilo: Object.keys(estilo).length ? estilo : undefined };
    }
    this.cache.delete(r);
    this.sujo();
  }

  /** Escreve um valor já numérico (usado por colar e por preenchimento). */
  private escreverValor(linha: number, col: number, texto: string, estiloBase?: Estilo): void {
    const f = this.folha;
    const r = ref(linha, col);
    const atual = f.celulas[r];
    const estilo = estiloBase ?? atual?.estilo;
    if (texto === "") {
      if (atual && ehVazia({ ...atual, texto: "" })) delete f.celulas[r];
    } else {
      if (estaCheia(f) && !atual) {
        this.avisoLimite();
        return;
      }
      f.celulas[r] = ehFormula(texto)
        ? { texto, formula: true, estilo }
        : { texto, estilo };
    }
    this.cache.delete(r);
  }

  private avisoLimite(): void {
    this.opts.onStatus?.();
    const t = document.getElementById("toasts");
    if (t && !t.querySelector(".xl-limite")) {
      const d = h("div", { class: "toast err xl-limite", text: `Limite de ${LIMITE_CELULAS} células por aba.` });
      t.append(d);
      requestAnimationFrame(() => d.classList.add("show"));
      window.setTimeout(() => {
        d.classList.remove("show");
        window.setTimeout(() => d.remove(), 250);
      }, 3200);
    }
  }

  /** Posiciona a caixa de edição sobre a célula ativa (coordenadas da tela). */
  private ajustarEntrada(): void {
    if (!this.edicao) return;
    const f = this.folha;
    const z = this.escala();
    const m = this.mesclaDe(this.edicao.linha, this.edicao.col);
    const x = CABECALHO_COL_PX + xColuna(f.colunas, m.c1, COLUNA_PX) * z - this.grade.scrollLeft;
    const y = CABECALHO_LINHA_PX + yLinha(f.linhas, m.l1, LINHA_PX) * z - this.grade.scrollTop;
    const larg = (somaLarguras(f.colunas, m.c2, COLUNA_PX) - somaLarguras(f.colunas, m.c1 - 1, COLUNA_PX)) * z;
    const alt = (somaAlturas(f.linhas, m.l2, LINHA_PX) - somaAlturas(f.linhas, m.l1 - 1, LINHA_PX)) * z;
    // a entrada vive em .xl-area (que não rola), então desconta a rolagem;
    // mínimos evitam que ela suma quando a célula está fora da vista
    this.entrada.style.cssText = `left:${x}px;top:${y}px;width:${Math.max(60, larg)}px;height:${Math.max(20, alt)}px;display:block;`;
  }

  private focarGrade(): void {
    this.grade.focus({ preventScroll: true });
  }

  /** Copia a seleção (ou a linha inteira) para um retângulo de valores. */
  private valoresDaSelecao(): { valores: string[][]; origem: { linha: number; col: number } } {
    const sel = this.sel.l1 === this.sel.l2 && this.sel.c1 === this.sel.c2
      ? { ...this.sel, l2: Math.min(this.sel.l1 + 1, MAX_LINHAS - 1), c2: Math.min(this.sel.c1 + 1, MAX_COLUNAS - 1) }
      : this.sel;
    const valores: string[][] = [];
    for (let l = sel.l1; l <= sel.l2; l++) {
      const linha: string[] = [];
      for (let c = sel.c1; c <= sel.c2; c++) linha.push(this.valorBruto(l, c));
      valores.push(linha);
    }
    return { valores, origem: { linha: sel.l1, col: sel.c1 } };
  }

  /** Cola valores de fora: planilha (com tabulação) ou texto simples. */
  private colar(e: ClipboardEvent): void {
    const dt = e.clipboardData;
    if (!dt) return;
    const texto = dt.getData("text/plain");
    if (!texto) return;
    e.preventDefault();
    this.colarTexto(texto);
  }

  /** Cola um texto (uma célula, ou uma grade separada por tabulação/quebra de linha) a partir da seleção. */
  private colarTexto(texto: string): void {
    // texto sem tabulação nem quebra de linha: entra inteiro na célula ativa
    if (!/[\t\n]/.test(texto)) {
      this.escrever(this.linha, this.coluna, texto);
      this.pintar();
      this.opts.onStatus?.();
      return;
    }

    // planilha colada: cada linha e cada coluna vão para uma célula
    const linhas = texto.replace(/\r/g, "").replace(/\n$/, "").split("\n");
    let mudou = false;
    linhas.forEach((linhaTxt, iL) => {
      linhaTxt.split("\t").forEach((celulaTxt, iC) => {
        const l = this.sel.l1 + iL;
        const c = this.sel.c1 + iC;
        if (l >= MAX_LINHAS || c >= MAX_COLUNAS) return;
        this.escreverValor(l, c, celulaTxt.replace(/\r/g, ""));
        mudou = true;
      });
    });
    if (mudou) {
      this.sujo();
      this.pintar();
      this.opts.onStatus?.();
    }
  }

  /** Copia a seleção para a área de transferência (TSV, como o Excel). */
  private copiar(): void {
    const { valores } = this.valoresDaSelecao();
    const tsv = valores.map((l) => l.join("\t")).join("\n");
    void navigator.clipboard.writeText(tsv).catch(() => {});
  }

  // ==================================================================
  // teclado
  // ==================================================================

  private teclaDaGrade(e: KeyboardEvent): void {
    const ctrl = e.ctrlKey || e.metaKey;
    const ultL = this.ultimaLinhaUsada();
    const ultC = this.ultimaColunaUsada();

    switch (e.key) {
      case "ArrowUp":
        e.preventDefault();
        this.mover(this.linha - 1, this.coluna, e.shiftKey);
        return;
      case "ArrowDown":
        e.preventDefault();
        this.mover(this.linha + 1, this.coluna, e.shiftKey);
        return;
      case "ArrowLeft":
        e.preventDefault();
        this.mover(this.linha, this.coluna - 1, e.shiftKey);
        return;
      case "ArrowRight":
        e.preventDefault();
        this.mover(this.linha, this.coluna + 1, e.shiftKey);
        return;
      case "Tab":
        e.preventDefault();
        this.mover(this.linha, this.coluna + (e.shiftKey ? -1 : 1), false);
        return;
      case "Enter":
        e.preventDefault();
        this.editarCelula();
        return;
      case "F2":
        e.preventDefault();
        this.editarCelula();
        return;
      case "Delete":
      case "Backspace":
        e.preventDefault();
        this.limparSelecao();
        return;
      case "Home":
        e.preventDefault();
        if (ctrl) this.mover(0, 0, false);
        else this.mover(this.linha, 0, e.shiftKey);
        return;
      case "End":
        e.preventDefault();
        if (ctrl) this.mover(ultL, ultC, false);
        else this.mover(this.linha, ultC, e.shiftKey);
        return;
      case "PageDown":
        e.preventDefault();
        this.mover(this.linha + 20, this.coluna, e.shiftKey);
        return;
      case "PageUp":
        e.preventDefault();
        this.mover(this.linha - 20, this.coluna, e.shiftKey);
        return;
    }

    if (ctrl && e.key.toLowerCase() === "a") {
      e.preventDefault();
      this.selecionarTudo();
      return;
    }
    if (ctrl && e.key.toLowerCase() === "c") {
      e.preventDefault();
      this.copiar();
      return;
    }
    if (ctrl && e.key.toLowerCase() === "x") {
      e.preventDefault();
      this.copiar();
      this.limparSelecao();
      return;
    }
    if (ctrl && e.key.toLowerCase() === "v") return; // deixa o evento "paste" tratar
    if (ctrl && e.key.toLowerCase() === "z") {
      e.preventDefault();
      this.desfazer();
      return;
    }
    if (ctrl && e.key.toLowerCase() === "y") {
      e.preventDefault();
      this.refazer();
      return;
    }
    if (ctrl && e.key.toLowerCase() === "b") {
      e.preventDefault();
      this.alternarEstilo({ negrito: !this.estiloAtual()?.negrito });
      return;
    }
    if (ctrl && e.key.toLowerCase() === "i") {
      e.preventDefault();
      this.alternarEstilo({ italico: !this.estiloAtual()?.italico });
      return;
    }

    // digitar qualquer coisa começa a editar a célula ativa
    if (!ctrl && !e.altKey && e.key.length === 1) {
      e.preventDefault();
      this.editarCelula(e.key);
    }
  }

  private teclaDaEntrada(e: KeyboardEvent): void {
    if (!this.edicao) return;
    // enquanto digita, a barra de fórmulas mostra o texto em edição
    if (this.edicao) this.edicao.texto = this.entrada.value;
    this.barraFormula.value = this.entrada.value;

    switch (e.key) {
      case "Enter":
        e.preventDefault();
        e.stopPropagation();
        this.confirmarEdicao(false);
        this.mover(this.linha + 1, this.coluna, false);
        return;
      case "Tab":
        e.preventDefault();
        e.stopPropagation();
        this.confirmarEdicao(false);
        this.mover(this.linha, this.coluna + (e.shiftKey ? -1 : 1), false);
        return;
      case "Escape":
        e.preventDefault();
        e.stopPropagation();
        this.edicao = null;
        this.entrada.hidden = true;
        this.entrada.value = "";
        this.pintar();
        this.focarGrade();
        return;
    }
    e.stopPropagation(); // não deixa o app interpretar atalhos durante a edição
  }

  private teclaDaFormula(e: KeyboardEvent): void {
    if (e.key === "Enter") {
      e.preventDefault();
      this.escrever(this.linha, this.coluna, this.barraFormula.value);
      this.pintar();
      this.mover(this.linha + 1, this.coluna, false);
      this.focarGrade();
      return;
    }
    if (e.key === "Escape") {
      e.preventDefault();
      this.pintarBarraFormula();
      this.focarGrade();
    }
    e.stopPropagation();
  }

  /** Move (ou estende, com Shift) a célula ativa. */
  private mover(linha: number, coluna: number, estender: boolean): void {
    const l = Math.max(0, Math.min(MAX_LINHAS - 1, linha));
    const c = Math.max(0, Math.min(MAX_COLUNAS - 1, coluna));
    if (estender) {
      this.sel = {
        l1: Math.min(this.sel.l1, l),
        c1: Math.min(this.sel.c1, c),
        l2: Math.max(this.sel.l2, l),
        c2: Math.max(this.sel.c2, c),
      };
    } else {
      this.linha = l;
      this.coluna = c;
      this.sel = { l1: l, c1: c, l2: l, c2: c };
    }
    this.rolarAte(l, c);
    this.pintar();
    this.focarGrade();
    this.opts.onStatus?.();
  }

  /**
   * Rola a grade só o suficiente para a célula aparecer.
   * Os cabeçalhos cobrem a borda (26px em cima, 46px à esquerda), então a
   * área realmente visível de conteúdo começa em scroll + cabeçalho.
   */
  private rolarAte(linha: number, coluna: number): void {
    const f = this.folha;
    const z = this.escala();
    const m = this.mesclaDe(linha, coluna);
    const cabL = CABECALHO_LINHA_PX;
    const cabC = CABECALHO_COL_PX;

    const y = cabL + yLinha(f.linhas, m.l1, LINHA_PX) * z;
    const alt = somaAlturas(f.linhas, m.l2, LINHA_PX) * z - somaAlturas(f.linhas, m.l1 - 1, LINHA_PX) * z;
    if (y < this.grade.scrollTop + cabL) this.grade.scrollTop = Math.max(0, y - cabL);
    else if (y + alt > this.grade.scrollTop + this.grade.clientHeight) {
      this.grade.scrollTop = y + alt - this.grade.clientHeight;
    }

    const x = cabC + xColuna(f.colunas, m.c1, COLUNA_PX) * z;
    const larg = somaLarguras(f.colunas, m.c2, COLUNA_PX) * z - somaLarguras(f.colunas, m.c1 - 1, COLUNA_PX) * z;
    if (x < this.grade.scrollLeft + cabC) this.grade.scrollLeft = Math.max(0, x - cabC);
    else if (x + larg > this.grade.scrollLeft + this.grade.clientWidth) {
      this.grade.scrollLeft = x + larg - this.grade.clientWidth;
    }
  }

  private selecionarTudo(): void {
    this.sel = { l1: 0, c1: 0, l2: this.ultimaLinhaUsada(), c2: this.ultimaColunaUsada() };
    this.pintar();
    this.opts.onStatus?.();
  }

  // ==================================================================
  // histórico simples (desfazer/refazer por estado do livro)
  // ==================================================================

  private pilhaDesfazer: string[] = [];
  private pilhaRefazer: string[] = [];
  private ultimoEstado = "";
  /** quando ligado, a grade mostra o texto das fórmulas em vez dos valores */
  private mostrarFrases = false;

  /** Guarda o estado atual na pilha de desfazer. */
  private guardarPilha(): void {
    const estado = serialize(this.livro, this.config);
    if (estado === this.ultimoEstado) return;
    this.pilhaDesfazer.push(this.ultimoEstado || estado);
    if (this.pilhaDesfazer.length > 60) this.pilhaDesfazer.shift();
    this.pilhaRefazer = [];
    this.ultimoEstado = estado;
  }

  private desfazer(): void {
    const anterior = this.pilhaDesfazer.pop();
    if (!anterior) return;
    this.pilhaRefazer.push(this.ultimoEstado);
    const snap = deserialize(anterior);
    if (snap) {
      this.livro = snap.livro;
      this.config = snap.config;
      this.ultimoEstado = anterior;
      this.cache.clear();
      this.clamparSelecao();
      this.pintar();
      this.opts.onStatus?.();
      this.sujo();
    }
  }

  private refazer(): void {
    const proximo = this.pilhaRefazer.pop();
    if (!proximo) return;
    this.pilhaDesfazer.push(this.ultimoEstado);
    const snap = deserialize(proximo);
    if (snap) {
      this.livro = snap.livro;
      this.config = snap.config;
      this.ultimoEstado = proximo;
      this.cache.clear();
      this.clamparSelecao();
      this.pintar();
      this.opts.onStatus?.();
      this.sujo();
    }
  }

  private clamparSelecao(): void {
    this.linha = Math.min(this.linha, this.ultimaLinhaUsada());
    this.coluna = Math.min(this.coluna, this.ultimaColunaUsada());
    this.sel = { ...this.sel, l2: Math.min(this.sel.l2, this.ultimaLinhaUsada()), c2: Math.min(this.sel.c2, this.ultimaColunaUsada()) };
  }

  // ==================================================================
  // comandos da fita
  // ==================================================================

  private estadoFormatacao(): FormatState {
    const estilo = this.estiloAtual();
    return {
      temCelula: true,
      temSelecao: this.sel.l1 !== this.sel.l2 || this.sel.c1 !== this.sel.c2,
      negrito: !!estilo?.negrito,
      italico: !!estilo?.italico,
      alinhamento: estilo?.alinhamento ?? "esquerda",
      numero: estilo?.numero ?? "geral",
      cor: estilo?.cor ? `#${estilo.cor}` : "",
      fundo: estilo?.fundo ? `#${estilo.fundo}` : "",
      abas: this.livro.folhas.length,
      zoom: this.config.zoom,
      temMescla: this.temMesclaNaSelecao(),
    };
  }

  /** Estilo em comum das células selecionadas (ou null se divergem). */
  private estiloAtual(): Estilo | null {
    const f = this.folha;
    const primeira = f.celulas[ref(this.sel.l1, this.sel.c1)]?.estilo;
    for (const { linha, col } of percorrer(this.sel)) {
      const e = f.celulas[ref(linha, col)]?.estilo;
      if (JSON.stringify(e ?? {}) !== JSON.stringify(primeira ?? {})) return null;
    }
    return primeira ?? null;
  }

  private temMesclaNaSelecao(): boolean {
    return this.folha.mesclas.some((m) => {
      const r = intervalo(m);
      if (!r) return false;
      return (
        r.l1 >= this.sel.l1 && r.c1 >= this.sel.c1 && r.l2 <= this.sel.l2 && r.c2 <= this.sel.c2
      );
    });
  }

  /** Aplica um estilo a todas as células da seleção. */
  private aplicarEstilo(patch: Partial<Estilo>): void {
    this.guardarPilha();
    const f = this.folha;
    for (const { linha, col } of percorrer(this.sel)) {
      const r = ref(linha, col);
      const cel = f.celulas[r];
      if (!cel) {
        if (!Object.keys(patch).length) continue;
        f.celulas[r] = { texto: "", estilo: { ...patch } };
      } else {
        const novo = { ...(cel.estilo ?? {}), ...patch };
        // remove chaves que viraram undefined
        for (const k of Object.keys(novo) as (keyof Estilo)[]) if (novo[k] === undefined) delete novo[k];
        cel.estilo = Object.keys(novo).length ? novo : undefined;
        if (ehVazia(cel)) delete f.celulas[r];
      }
    }
    this.sujo();
    this.pintar();
    this.opts.onStatus?.();
  }

  private alternarEstilo(patch: Partial<Estilo>): void {
    const atual = this.estiloAtual();
    const prox = { ...(atual ?? {}) };
    for (const [k, v] of Object.entries(patch)) {
      if (v === false) delete (prox as Record<string, unknown>)[k];
      else (prox as Record<string, unknown>)[k] = v;
    }
    this.aplicarEstilo(prox as Partial<Estilo>);
  }

  /** Limpa conteúdo (e estilo) das células selecionadas. */
  private limparSelecao(): void {
    this.guardarPilha();
    const f = this.folha;
    for (const { linha, col } of percorrer(this.sel)) {
      delete f.celulas[ref(linha, col)];
      this.cache.delete(ref(linha, col));
    }
    this.sujo();
    this.pintar();
    this.opts.onStatus?.();
  }

  /**
   * Preenchimento por arrasto da alça (o "quadradinho" no canto da seleção).
   * Copia o conteúdo do retângulo de origem para baixo ou para a direita,
   * deslocando as referências relativas das fórmulas, como o Excel faz:
   * `=C2*D2` preenchido para baixo vira `=C3*D3`.
   */
  private preencherSelecao(origem: Intervalo, direcao: "baixo" | "direita"): void {
    this.guardarPilha();
    const f = this.folha;
    const altOrigem = origem.l2 - origem.l1 + 1;
    const largOrigem = origem.c2 - origem.c1 + 1;

    for (let l = this.sel.l1; l <= this.sel.l2; l++) {
      for (let c = this.sel.c1; c <= this.sel.c2; c++) {
        // as células do retângulo inicial já estão certas: não são tocadas
        if (l >= origem.l1 && l <= origem.l2 && c >= origem.c1 && c <= origem.c2) continue;
        // a origem "anda em círculo" dentro do retângulo inicial
        const ol = direcao === "baixo" ? origem.l1 + ((l - origem.l1) % altOrigem) : l;
        const oc = direcao === "direita" ? origem.c1 + ((c - origem.c1) % largOrigem) : c;
        const cel = f.celulas[ref(ol, oc)];
        if (!cel) continue;
        const texto = cel.formula || ehFormula(cel.texto) ? deslocarFormula(cel.texto, l - ol, c - oc) : cel.texto;
        this.escreverValor(l, c, texto, cel.estilo);
      }
    }
    this.sujo();
    this.pintar();
    this.opts.onStatus?.();
  }

  /** Soma (ou agrega) o bloco de números acima da célula ativa (botão AutoSoma). */
  private somar(aba: "SOMA" | "MÉDIA" | "CONT.NÚM" | "MÍN" | "MÁX"): void {
    const sel = this.sel;
    if (sel.l1 === sel.l2 && sel.c1 === sel.c2) {
      // sem seleção: sobe enquanto houver número na coluna (como o Excel)
      let inicio = this.linha;
      while (inicio > 0 && typeof this.valorCalculado(ref(inicio - 1, this.coluna)) === "number") inicio--;
      if (inicio < this.linha) {
        this.escrever(this.linha, this.coluna, `=${aba}(${ref(inicio, this.coluna)}:${ref(this.linha - 1, this.coluna)})`);
      } else {
        // nada acima: tenta os números à esquerda, na mesma linha
        let colIni = this.coluna;
        while (colIni > 0 && typeof this.valorCalculado(ref(this.linha, colIni - 1)) === "number") colIni--;
        this.escrever(
          this.linha,
          this.coluna,
          colIni < this.coluna ? `=${aba}(${ref(this.linha, colIni)}:${ref(this.linha, this.coluna - 1)})` : `=${aba}()`
        );
      }
      const estilo = this.folha.celulas[ref(this.linha, this.coluna)]?.estilo;
      if (estilo?.numero) this.aplicarNumero(estilo.numero);
    } else {
      const destino = { linha: sel.l2 + 1, col: sel.c1 };
      const faixaRef = faixa(sel);
      this.escrever(destino.linha, destino.col, `=${aba}(${faixaRef})`);
      this.linha = destino.linha;
      this.coluna = destino.col;
      this.sel = { l1: destino.linha, c1: destino.col, l2: destino.linha, c2: destino.col };
    }
    this.pintar();
    this.opts.onStatus?.();
  }

  private aplicarNumero(numero: FormatoNumero): void {
    this.aplicarEstilo({ numero, casas: this.config.casas });
  }

  private executar(cmd: string, valor?: string): void {
    switch (cmd) {
      // ---- área de transferência e histórico ----
      case "copiar":
        this.copiar();
        return;
      case "recortar":
        this.copiar();
        this.limparSelecao();
        return;
      case "colar":
        void navigator.clipboard
          .readText()
          .then((t) => t && this.colarTexto(t))
          .catch(() => {});
        return;
      case "desfazer":
        this.desfazer();
        return;
      case "refazer":
        this.refazer();
        return;
      case "casas-mais":
      case "casas-menos": {
        const est = this.estiloAtual();
        const atual = est?.casas ?? this.config.casas;
        const casas = Math.max(0, Math.min(10, atual + (cmd === "casas-mais" ? 1 : -1)));
        this.aplicarEstilo({ numero: est?.numero && est.numero !== "geral" ? est.numero : "decimal", casas });
        return;
      }

      // ---- abas ----
      case "aba-nova":
        this.novaAba();
        return;
      case "aba-dup":
        this.duplicarAba();
        return;
      case "aba-del":
        this.excluirAba();
        return;
      case "aba-mais":
        this.moverAba(1);
        return;
      case "aba-menos":
        this.moverAba(-1);
        return;

      // ---- linhas e colunas ----
      case "linha-inserir":
        this.inserirLinhas(1);
        return;
      case "linha-excluir":
        this.excluirLinhas();
        return;
      case "col-inserir":
        this.inserirColunas(1);
        return;
      case "col-excluir":
        this.excluirColunas();
        return;

      // ---- formatação ----
      case "negrito":
        this.alternarEstilo({ negrito: !this.estiloAtual()?.negrito });
        return;
      case "italico":
        this.alternarEstilo({ italico: !this.estiloAtual()?.italico });
        return;
      case "cor-texto":
        this.aplicarEstilo({ cor: valor ? semHash(valor) : undefined });
        return;
      case "cor-fundo":
        this.aplicarEstilo({ fundo: valor ? semHash(valor) : undefined });
        return;
      case "align-esquerda":
        this.aplicarEstilo({ alinhamento: "esquerda" });
        return;
      case "align-centro":
        this.aplicarEstilo({ alinhamento: "centro" });
        return;
      case "align-direita":
        this.aplicarEstilo({ alinhamento: "direita" });
        return;
      case "numero":
        if (valor) this.aplicarNumero(valor as FormatoNumero);
        return;
      case "limpar-formato": {
        this.guardarPilha();
        const f = this.folha;
        for (const { linha, col } of percorrer(this.sel)) {
          const cel = f.celulas[ref(linha, col)];
          if (cel) {
            cel.estilo = undefined;
            if (ehVazia(cel)) delete f.celulas[ref(linha, col)];
          }
        }
        this.sujo();
        this.pintar();
        return;
      }
      case "mesclar":
        this.mesclar();
        return;
      case "desmesclar":
        this.desmesclar();
        return;
      case "ajustar-largura":
        this.ajustarLargura();
        return;
      case "ajustar-altura":
        this.ajustarAltura();
        return;

      // ---- agregações ----
      case "soma":
        this.somar("SOMA");
        return;
      case "media":
        this.somar("MÉDIA");
        return;
      case "cont":
        this.somar("CONT.NÚM");
        return;
      case "min":
        this.somar("MÍN");
        return;
      case "max":
        this.somar("MÁX");
        return;

      // ---- células ----
      case "limpar":
        this.limparSelecao();
        return;
      case "formulas":
        this.mostrarFormulas(!this.mostrarFrases);
        return;

      // ---- ver ----
      case "zoom-in":
        this.setZoom(this.config.zoom + 10);
        return;
      case "zoom-out":
        this.setZoom(this.config.zoom - 10);
        return;
      case "zoom-reset":
        this.setZoom(100);
        return;
      case "configure":
        this.opts.onConfigure?.();
        return;
      case "image":
        this.aviso("Imagens dentro da planilha ainda não são suportadas pelo motor.");
        return;
    }
    this.pintar();
  }

  private aviso(msg: string): void {
    this.opts.onStatus?.();
    const t = document.getElementById("toasts");
    if (!t) return;
    const d = h("div", { class: "toast info", text: msg });
    t.append(d);
    requestAnimationFrame(() => d.classList.add("show"));
    window.setTimeout(() => {
      d.classList.remove("show");
      window.setTimeout(() => d.remove(), 250);
    }, 3400);
  }

  // ---- abas ----

  private irParaAba(i: number): void {
    if (i === this.livro.ativa) return;
    this.livro = { ...this.livro, ativa: i };
    this.linha = 0;
    this.coluna = 0;
    this.sel = { l1: 0, c1: 0, l2: 0, c2: 0 };
    this.cache.clear();
    this.pintar();
    this.opts.onStatus?.();
  }

  private novaAba(): void {
    this.guardarPilha();
    const nome = nomeLivre(this.livro.folhas);
    const r = inserirFolha(this.livro, this.livro.ativa + 1, novaFolha(nome));
    this.livro = r.livro;
    this.linha = 0;
    this.coluna = 0;
    this.sel = { l1: 0, c1: 0, l2: 0, c2: 0 };
    this.sujo();
    this.pintar();
  }

  private duplicarAba(): void {
    this.guardarPilha();
    const f = this.folha;
    const nome = nomeLivre(this.livro.folhas, `${f.nome} (cópia)`);
    const r = inserirFolha(this.livro, this.livro.ativa + 1, duplicarFolha(f, nome));
    this.livro = r.livro;
    this.sujo();
    this.pintar();
  }

  private excluirAba(): void {
    this.guardarPilha();
    this.livro = removerFolha(this.livro, this.livro.ativa).livro;
    this.linha = 0;
    this.coluna = 0;
    this.sel = { l1: 0, c1: 0, l2: 0, c2: 0 };
    this.cache.clear();
    this.sujo();
    this.pintar();
  }

  private moverAba(delta: number): void {
    const de = this.livro.ativa;
    const para = de + delta;
    if (para < 0 || para >= this.livro.folhas.length) return;
    this.guardarPilha();
    this.livro = moverFolha(this.livro, de, para);
    this.sujo();
    this.pintar();
  }

  private renomearAba(i: number): void {
    const nome = window.prompt("Nome da aba:", this.livro.folhas[i]?.nome ?? "Planilha");
    if (nome === null) return;
    this.guardarPilha();
    this.livro = renomearFolha(this.livro, i, nome);
    this.sujo();
    this.pintar();
  }

  // ---- linhas e colunas ----

  /** Empurra células para baixo a partir da linha de seleção. */
  private inserirLinhas(qtd: number): void {
    this.guardarPilha();
    const f = this.folha;
    const inicio = this.sel.l1;
    const novas: Record<string, Celula> = {};
    for (const [k, v] of Object.entries(f.celulas)) {
      const p = partes(k);
      if (!p || p.linha < inicio) continue;
      novas[ref(p.linha + qtd, p.col)] = v;
    }
    f.celulas = { ...Object.fromEntries(Object.entries(f.celulas).filter(([k]) => !partes(k) || partes(k)!.linha < inicio)), ...novas };
    this.cache.clear();
    this.sujo();
    this.pintar();
  }

  private excluirLinhas(): void {
    this.guardarPilha();
    const f = this.folha;
    const ini = this.sel.l1;
    const qtd = this.sel.l2 - this.sel.l1 + 1;
    const novas: Record<string, Celula> = {};
    for (const [k, v] of Object.entries(f.celulas)) {
      const p = partes(k);
      if (!p) continue;
      if (p.linha >= ini && p.linha < ini + qtd) continue; // some
      novas[ref(p.linha >= ini + qtd ? p.linha - qtd : p.linha, p.col)] = v;
    }
    f.celulas = novas;
    this.cache.clear();
    this.sujo();
    this.pintar();
  }

  private inserirColunas(qtd: number): void {
    this.guardarPilha();
    const f = this.folha;
    const inicio = this.sel.c1;
    const novas: Record<string, Celula> = {};
    for (const [k, v] of Object.entries(f.celulas)) {
      const p = partes(k);
      if (!p || p.col < inicio) continue;
      novas[ref(p.linha, p.col + qtd)] = v;
    }
    f.celulas = { ...Object.fromEntries(Object.entries(f.celulas).filter(([k]) => !partes(k) || partes(k)!.col < inicio)), ...novas };
    this.cache.clear();
    this.sujo();
    this.pintar();
  }

  private excluirColunas(): void {
    this.guardarPilha();
    const f = this.folha;
    const ini = this.sel.c1;
    const qtd = this.sel.c2 - this.sel.c1 + 1;
    const novas: Record<string, Celula> = {};
    for (const [k, v] of Object.entries(f.celulas)) {
      const p = partes(k);
      if (!p) continue;
      if (p.col >= ini && p.col < ini + qtd) continue;
      novas[ref(p.linha, p.col >= ini + qtd ? p.col - qtd : p.col)] = v;
    }
    f.celulas = novas;
    this.cache.clear();
    this.sujo();
    this.pintar();
  }

  // ---- mesclas e medidas ----

  private mesclar(): void {
    if (this.sel.l1 === this.sel.l2 && this.sel.c1 === this.sel.c2) {
      this.aviso("Selecione duas ou mais células para mesclar.");
      return;
    }
    this.guardarPilha();
    const f = this.folha;
    // tira mesclas que cruzam a seleção
    f.mesclas = f.mesclas.filter((m) => {
      const r = intervalo(m);
      if (!r) return false;
      const cruza =
        r.l1 <= this.sel.l2 && r.l2 >= this.sel.l1 && r.c1 <= this.sel.c2 && r.c2 >= this.sel.c1;
      return !cruza;
    });
    f.mesclas.push(faixa(this.sel));
    this.sujo();
    this.pintar();
  }

  private desmesclar(): void {
    this.guardarPilha();
    const f = this.folha;
    f.mesclas = f.mesclas.filter((m) => {
      const r = intervalo(m);
      if (!r) return false;
      return !(r.l1 <= this.sel.l2 && r.l2 >= this.sel.l1 && r.c1 <= this.sel.c2 && r.c2 >= this.sel.c1);
    });
    this.sujo();
    this.pintar();
  }

  private ajustarLargura(): void {
    const f = this.folha;
    // mede o maior texto da seleção e define a largura
    for (let c = this.sel.c1; c <= this.sel.c2; c++) {
      let maior = 6;
      for (let l = this.sel.l1; l <= this.sel.l2; l++) {
        const texto = this.valorExibido(l, c);
        const fonte = f.celulas[ref(l, c)]?.estilo;
        const tamanho = (fonte?.negrito ? 8.2 : 7.4) + (fonte?.casas ?? 0);
        maior = Math.max(maior, texto.length * tamanho + 18);
      }
      f.colunas[c] = Math.round(Math.min(400, maior));
    }
    this.sujo();
    this.pintar();
  }

  private ajustarAltura(): void {
    const f = this.folha;
    for (let l = this.sel.l1; l <= this.sel.l2; l++) {
      let maior = LINHA_PX;
      for (let c = this.sel.c1; c <= this.sel.c2; c++) {
        const texto = this.valorExibido(l, c);
        const cel = f.celulas[ref(l, c)];
        if (!texto) continue;
        const largura = somaLarguras(f.colunas, c, COLUNA_PX) - somaLarguras(f.colunas, c - 1, COLUNA_PX);
        const linhas = Math.ceil(texto.length / Math.max(4, largura / 7.4));
        maior = Math.max(maior, linhas * 20 + 6);
      }
      if (maior > LINHA_PX) f.linhas[l] = Math.round(Math.min(200, maior));
    }
    this.sujo();
    this.pintar();
  }

  private setZoom(z: number): void {
    this.config = { ...this.config, zoom: Math.max(50, Math.min(200, z)) };
    this.pintar();
    this.opts.onStatus?.();
  }

  /** Alterna a visão entre valores e texto das fórmulas. */
  private mostrarFormulas(v: boolean): void {
    this.mostrarFrases = v;
    this.aviso(v ? "Mostrando o texto das fórmulas (como Ctrl+` no Excel)." : "Mostrando os valores.");
    this.pintar();
  }

  // ==================================================================
  // API pública (o App chama)
  // ==================================================================

  private sujo(): void {
    this.guardarPilha();
    this.opts.onDirty?.();
  }

  /** Livro de exemplo que "Novo" abre. */
  createTab(): ExcelTabData {
    const { livro, config } = livroDeExemplo();
    return { livro, config, linha: 0, coluna: 0 };
  }

  /** Livro vazio (para um .xlsx em branco). */
  createEmpty(): ExcelTabData {
    return { livro: { folhas: [novaFolha()], ativa: 0 }, config: { ...CONFIG_PADRAO }, linha: 0, coluna: 0 };
  }

  load(data: ExcelTabData): void {
    this.livro = {
      folhas: data.livro?.folhas?.length
        ? data.livro.folhas.map((f) => ({
            nome: f.nome,
            celulas: f.celulas ?? {},
            colunas: f.colunas ?? {},
            linhas: f.linhas ?? {},
            mesclas: f.mesclas ?? [],
            congelado: f.congelado,
          }))
        : [novaFolha()],
      ativa: data.livro?.ativa ?? 0,
    };
    this.config = { ...CONFIG_PADRAO, ...(data.config ?? {}) };
    this.linha = Math.min(data.linha ?? 0, MAX_LINHAS - 1);
    this.coluna = Math.min(data.coluna ?? 0, MAX_COLUNAS - 1);
    this.sel = { l1: this.linha, c1: this.coluna, l2: this.linha, c2: this.coluna };
    this.cache.clear();
    this.pilhaDesfazer = [];
    this.pilhaRefazer = [];
    this.ultimoEstado = serialize(this.livro, this.config);
    this.pintar();
  }

  snapshot(): ExcelTabData {
    return {
      livro: structuredClone(this.livro),
      config: { ...this.config },
      linha: this.linha,
      coluna: this.coluna,
    };
  }

  /** Texto serializado (histórico e rascunho). */
  serialized(): string {
    return serialize(this.livro, this.config);
  }

  /** Volta a planilha a partir de um texto serializado (histórico). */
  restore(serialized: string): void {
    const snap = deserialize(serialized);
    if (!snap) return;
    this.livro = snap.livro;
    this.config = snap.config;
    this.ultimoEstado = serialized;
    this.cache.clear();
    this.clamparSelecao();
    this.pintar();
    this.opts.onStatus?.();
    this.sujo();
  }

  /** Texto legível de um estado serializado (o diff do histórico usa). */
  projection(serialized: string): string {
    const snap = deserialize(serialized);
    return snap ? this.textoLegivel(snap.livro) : serialized;
  }

  /** Configuração atual (para o diálogo "Configurar planilha"). */
  setup_(): ConfigPlanilha {
    return { ...this.config };
  }

  setConfig(patch: Partial<ConfigPlanilha>): void {
    this.config = { ...this.config, ...patch };
    this.sujo();
    this.pintar();
  }

  /** Texto da planilha em português (a IA, o corretor e o histórico usam). */
  text(): string {
    return this.textoLegivel(this.livro);
  }

  /** Projeção em texto do livro inteiro: aba a aba, linha a linha. */
  private textoLegivel(livro: Livro): string {
    const linhas: string[] = [];
    for (const f of livro.folhas) {
      linhas.push(`## ${f.nome}`);
      const usadas: { linha: number; valores: (string | number)[] }[] = [];
      let maxL = -1;
      let maxC = -1;
      for (const [k] of Object.entries(f.celulas)) {
        const p = partes(k);
        if (!p) continue;
        maxL = Math.max(maxL, p.linha);
        maxC = Math.max(maxC, p.col);
      }
      for (const m of f.mesclas) {
        const r = intervalo(m);
        if (r) {
          maxL = Math.max(maxL, r.l2);
          maxC = Math.max(maxC, r.c2);
        }
      }
      for (let l = 0; l <= maxL; l++) {
        const valores: (string | number)[] = [];
        for (let c = 0; c <= maxC; c++) {
          const texto = this.valorExibidoEm(f, l, c);
          valores.push(texto || "");
        }
        if (valores.some((v) => v !== "")) usadas.push({ linha: l, valores });
      }
      if (!usadas.length) {
        linhas.push("(aba vazia)", "");
        continue;
      }
      // primeira linha não vazia como cabeçalho, como numa tabela Markdown
      const cab = usadas[0];
      linhas.push(`| ${cab.valores.join(" | ")} |`);
      linhas.push(`| ${cab.valores.map(() => "---").join(" | ")} |`);
      for (const u of usadas.slice(1)) linhas.push(`| ${u.valores.join(" | ")} |`);
      linhas.push("");
    }
    return linhas.join("\n");
  }

  /** Valor exibido de uma célula de uma folha específica (usado no texto). */
  private valorExibidoEm(f: Folha, linha: number, col: number): string {
    const cel = f.celulas[ref(linha, col)];
    if (!cel || !cel.texto) return "";
    const v = this.calcularEm(f, ref(linha, col));
    if (ehErro(v)) return v.codigo;
    return valorParaTexto(v as Valor, cel.estilo, this.config);
  }

  /** Calcula o valor de uma célula de uma folha arbitrária. */
  private calcularEm(f: Folha, refA1: string): Operando {
    const cel = f.celulas[refA1];
    if (!cel || !cel.texto) return null;
    const contexto: Contexto = {
      valorDe: (alvo) => this.calcularEm(f, alvo),
      faixaAlvo: (alvo) => {
        const out: Operando[] = [];
        for (const { linha, col } of percorrer(alvo)) out.push(this.calcularEm(f, ref(linha, col)));
        return out;
      },
    };
    if (cel.formula || ehFormula(cel.texto)) return calcular(cel.texto, contexto);
    const boo = booleanoDe(cel.texto);
    if (boo !== null) return boo;
    const num = numeroDe(cel.texto);
    if (num !== null) return ehPercentual(cel.texto) ? num / 100 : num;
    const d = dataDe(cel.texto);
    if (d) return dataParaSerial(d);
    return cel.texto;
  }

  /** Estatísticas para o rodapé. */
  stats(): { abas: number; celulas: number; zoom: number } {
    const usadas = this.livro.folhas.reduce((t, f) => t + Object.values(f.celulas).filter((c) => !!c.texto).length, 0);
    return { abas: this.livro.folhas.length, celulas: usadas, zoom: this.config.zoom };
  }

  /** Resumo curto (barra de título / paleta). */
  resumo(): string {
    return resumo(this.livro, this.config);
  }

  /** Célula ativa (para a barra de fórmulas do App, se quiser). */
  celulaAtiva(): { ref: string; texto: string; formula: boolean } {
    return {
      ref: ref(this.linha, this.coluna),
      texto: this.valorBruto(this.linha, this.coluna),
      formula: !!this.folha.celulas[ref(this.linha, this.coluna)]?.formula,
    };
  }

  focus(): void {
    this.focarGrade();
  }
}

function semHash(cor: string): string {
  return cor.replace(/^#/, "").slice(0, 6);
}

function escaparHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}