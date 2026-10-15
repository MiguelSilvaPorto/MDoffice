// Modelo de dados do motor de APRESENTAÇÕES (PowerPoint) do mdOffice.
// Espelha o motor do Word (src/word): schema → model → markdown → view → host.
// Só tipos e constantes: nenhum DOM, nenhum I/O, nenhuma dependência externa.

/** Proporção da lâmina. */
export type DeckAspect = "16:9" | "4:3";

/** Papel da lâmina (muda o alinhamento/estilo base). */
export type SlideLayout = "titulo" | "secao" | "conteudo" | "duas" | "soTitulo" | "vazio";

/** Tema visual aplicado ao deck (fundo, acento, fontes). */
export type ThemeId = "claro" | "escuro" | "contraste";

/** Efeito da transição de entrada de uma lâmina (o mesmo nome que o PowerPoint mostra). */
export type TransicaoTipo = "none" | "fade" | "push" | "wipe" | "split" | "cover" | "uncover";

/** De onde a lâmina entra (ou de onde o efeito começa). */
export type TransicaoDirecao = "esquerda" | "direita" | "cima" | "baixo";

/** Como a lâmina entra quando o apresentador avança (escolhida na fita ou lida de um .pptx). */
export interface Transicao {
  tipo: TransicaoTipo;
  /** direção do efeito; só vale nos tipos que aceitam (push, wipe, cover e uncover) */
  direcao?: TransicaoDirecao;
  /** duração em segundos (padrão: 0,7) */
  duracao?: number;
}

/** Efeito de animação de uma forma (entrada, ênfase, saída ou trajetória). */
export type AnimacaoTipo = "aparecer" | "surgir" | "voar" | "zoom" | "limpar" | "caixa" | "circulo" | "losango" | "dividir" | "persianas" | "dissolver" | "roda" | "pulsar" | "ampliar" | "girar" | "transparencia" | "desaparecer" | "sumir" | "voarFora" | "encolher" | "limparFora" | "caixaFora" | "circuloFora" | "losangoFora" | "dividirFora" | "persianasFora" | "dissolverFora" | "rodaFora" | "trajetoria";

/** Direção da trajetória (para onde a forma anda). */
export type AnimacaoDirecao = "esquerda" | "direita" | "cima" | "baixo";

/** Quando o efeito começa: no clique, junto com o anterior ou depois que ele termina. */
export type AnimacaoInicio = "clicar" | "com" | "depois";

/**
 * Animação de uma forma da lâmina. Uma por forma (por enquanto): o efeito entra
 * na ordem em que foi aplicado e a lâmina guarda a lista nessa ordem.
 */
export interface Animacao {
  /** id da forma animada (Shape.id) */
  forma: string;
  tipo: AnimacaoTipo;
  /** quando começa (padrão: ao clicar) */
  inicio?: AnimacaoInicio;
  /** duração em segundos (padrão por tipo); só vale nos efeitos com transição */
  duracao?: number;
  /** atraso antes de tocar, em segundos (padrão: sem atraso) */
  atraso?: number;
  /** direção da trajetória (padrão: direita); só vale no tipo `trajetoria` */
  direcao?: AnimacaoDirecao;
  /** cada parágrafo do texto entra num passo próprio (um clique por parágrafo) */
  porParagrafo?: boolean;
}

/**
 * Uma lâmina. O conteúdo fica em Markdown (`md`) — é o que o app já sabe editar,
 * corrigir, exportar e mandar para a IA — e as notas do apresentador ficam em `notes`.
 */
export interface Slide {
  md: string;
  layout: SlideLayout;
  /** anotações do apresentador (não aparecem na lâmina) */
  notes: string;
  /**
   * Formas posicionadas sobre a lâmina (caixas de texto, imagens, tabelas).
   * Quando `shapes` tem itens, o palco mostra as formas; o `md` é o texto-fonte
   * usado para o .pptx e para a IA. Vazio = lâmina só com `md` (modo simples).
   */
  shapes: Shape[];
  /** fundo próprio da lâmina (veio de um .pptx); vazio = fundo do tema/deck */
  bg?: Fill;
  /** fundo com estilo vivo (Estilos de Cor): o `bg` é derivado da receita a cada mudança */
  bgEstilo?: EstiloForma;
  /** oculta na apresentação (F5): continua editável, mas o apresentador pula a lâmina */
  show?: boolean;
  /** nome próprio da lâmina (aparece na miniatura e vira o `name` do `p:cSld` no .pptx) */
  nome?: string;
  /** transição de entrada da lâmina (vazia = troca direta, sem transição) */
  transicao?: Transicao;
  /** `<p:transition>` original do .pptx quando o efeito não é modelado: volta como veio na exportação */
  transicaoXml?: string;
  /** animações de entrada/saída das formas, na ordem em que tocam (aba Animações) */
  animacoes?: Animacao[];
  /** `<p:timing>` original do .pptx quando a lâmina tem animações que o modelo não representa */
  timingXml?: string;
}

/** O deck inteiro. */
export interface Deck {
  titulo: string;
  slides: Slide[];
}

/** Metadados que acompanham o deck (não são conteúdo). */
export interface DeckSetup {
  aspect: DeckAspect;
  /** tema embutido: fundo e cor do texto */
  theme: ThemeId;
  /** mostra o número da lâmina no canto */
  showNumber: boolean;
  /** rodapé fixo (ex.: nome da empresa) */
  footer: string;
  /** fonte padrão do texto da lâmina */
  fontFamily: string;
  /** tamanho base do texto (pt) */
  fontSize: number;
  /** cor de fundo da lâmina (hex, sem #). Vazio = usa o tema. */
  bg: string;
  /** largura da lâmina em polegadas (padrão: 13,333 para 16:9, 10 para 4:3); vem do .pptx importado */
  widthIn?: number;
  /** altura da lâmina em polegadas (idem) */
  heightIn?: number;
  /** imagens do deck por id (data URL), referenciadas por `media:ID` em Shape.src e Fill.src */
  media?: Record<string, string>;
  /** fontes embutidas no .pptx importado (viram @font-face na tela) */
  fonts?: EmbeddedFont[];
  /** fontes embutidas como vieram no .pptx (EOT, base64): regravadas na exportação para o arquivo não perder as fontes */
  fontsRaw?: FontRaw[];
}

/** Fonte embutida original, intacta (para a exportação devolver ao arquivo). */
export interface FontRaw {
  /** atributos do <p:font> (typeface, panose, pitchFamily, charset) */
  attrs: Record<string, string>;
  slot: "regular" | "bold" | "italic" | "boldItalic";
  /** conteúdo do .fntdata em base64 */
  data: string;
}

/** Uma fonte embutida (data URL de um TrueType/OpenType já decodificado). */
export interface EmbeddedFont {
  family: string;
  weight: number;
  italic: boolean;
  src: string;
}

// ---------------------------------------------------------------------------
// Formas
// ---------------------------------------------------------------------------

/** O que uma forma pode ser. */
export type ShapeKind = "texto" | "imagem" | "forma";

/** Geometria de uma forma dentro da lâmina. Unidades em % da lâmina (0-100),
 *  para o mesmo objeto servir na tela e na exportação em polegadas. */
export interface ShapeBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Alinhamento do parágrafo dentro da forma. */
export type TextAlign = "esquerda" | "centro" | "direita" | "justificado";

/** Uma forma posicionada na lâmina. */
export interface Shape {
  id: string;
  kind: ShapeKind;
  box: ShapeBox;
  /** texto interno (para kind "texto" e "forma") */
  text: string;
  /** fonte, tamanho e cor do texto (hex sem #) */
  fontFamily: string;
  fontSize: number;
  color: string;
  /** negrito / itálico do texto interno */
  bold: boolean;
  italic: boolean;
  align: TextAlign;
  /** cor de preenchimento da forma (kind "forma"); vazio = sem preenchimento */
  fill: string;
  /** para kind "imagem": data URL ou caminho em assets/ */
  src: string;
  /** rotação em graus. */
  rot: number;

  // ---- campos "ricos" (opcionais): preenchidos ao importar um .pptx; vazios nas formas criadas no app ----
  /** nome original da forma no .pptx (só para diagnóstico) */
  name?: string;
  /** geometria predefinida do OOXML (rect, roundRect, ellipse, triangle...); vazio = retângulo */
  geom?: string;
  /** ajustes da geometria (adj, adj1...) em unidades de 1/100000 */
  adj?: Record<string, number>;
  /**
   * raio dos 4 cantos em % do menor lado (0–50), na ordem sup. esq, sup. dir, inf. dir, inf. esq.
   * Vale nas geometrias retangulares; quando existe, manda no desenho (o `adj` deixa de ser lido).
   */
  cantos?: [number, number, number, number];
  /** geometria livre (custGeom): caminhos em unidades do próprio caminho */
  paths?: CustPath[];
  /**
   * Pontos do traço à mão que criou esta forma (pt da lâmina), só do app: é o que permite a
   * borracha e o "Converter em forma" mexerem depois num traço já desenhado. Não vai ao `.pptx`
   * (o arquivo guarda a geometria); o que vier do arquivo não tem este campo.
   */
  tinta?: { x: number; y: number; reto?: boolean }[];
  flipH?: boolean;
  flipV?: boolean;
  /** preenchimento completo (substitui `fill` quando existe) */
  fillX?: Fill;
  /** contorno */
  ln?: Line;
  /** sombra externa */
  shadow?: Shadow;
  /** opacidade geral (0-1) */
  opacity?: number;
  /** texto formatado por parágrafo e trecho (substitui `text` na tela quando existe) */
  paras?: Para[];
  /** alinhamento vertical do texto */
  anchor?: "t" | "ctr" | "b";
  /** margens internas do texto, em pt: esquerda, topo, direita, base */
  ins?: [number, number, number, number];
  /** quebra de linha automática (padrão: sim) */
  wrap?: boolean;
  /** direção do texto: vert = girado 90°, vert270 = girado -90° */
  vert?: "vert" | "vert270" | "eaVert";
  /** recorte da imagem (esquerda, topo, direita, base) em % da imagem */
  crop?: [number, number, number, number];
  /** vem do modelo/layout (decoração fixa): não deve ser selecionada nem movida */
  fixa?: boolean;
  /** tamanho da forma em pt (para o traço e a geometria ficarem em escala exata) */
  sizePt?: [number, number];
  /** formas com o mesmo id de grupo se selecionam e se movem juntas */
  grupo?: string;
  /** ligação presa (ferramenta Conectar): a geometria do conector é DERIVADA das formas ligadas */
  liga?: Liga;
  /** estilo de cor VIVO (ferramenta Estilos de Cor): a aparência é derivada da receita */
  estilo?: EstiloForma;
  /** brilho-dobra: forma-capa derivada de outra (mesma caixa e giro da forma-base) */
  capa?: { de: string };
  /** travada: aparece, mas não se move nem se redimensiona pelo palco */
  bloqueada?: boolean;
  /** texto alternativo (acessibilidade) */
  alt?: string;
  /** a forma cresce para caber o texto (spAutoFit) */
  autofit?: boolean;
  /** texto de orientação mostrado (só no editor) enquanto a caixa está vazia */
  dica?: string;
  /** dados da tabela (quando a forma é uma tabela) */
  tabela?: Tabela;
  /** áudio/vídeo (quando a forma é uma mídia; `src` guarda o arquivo e `midia.poster` a capa) */
  midia?: Midia;
  /** dados do gráfico (quando a forma é um gráfico; o desenho é feito em SVG) */
  grafico?: Grafico;
}

/** Uma célula de tabela. */
export interface CelulaTab {
  paras: Para[];
  fill?: Fill;
  /** bordas da célula: esquerda, topo, direita, base (null = sem borda) */
  bordas?: { l?: Line | null; t?: Line | null; r?: Line | null; b?: Line | null };
  anchor?: "t" | "ctr" | "b";
  /** margens internas em pt: esquerda, topo, direita, base */
  ins?: [number, number, number, number];
  /** colunas/linhas que esta célula ocupa (mesclagem), a partir dela */
  colspan?: number;
  rowspan?: number;
  /** coberta por uma célula mesclada: não é desenhada */
  coberta?: boolean;
  /** estilo do texto que se digita nesta célula quando ela está vazia */
  estilo?: Omit<Run, "text" | "br">;
}

/** Uma tabela: tamanhos em pt (o conjunto se ajusta à caixa da forma). */
/** Borda de uma forma usada por uma ligação (ferramenta Conectar). */
export type Lado = "topo" | "base" | "esq" | "dir";

/**
 * Ligação presa entre duas formas: o conector guarda de onde sai e onde chega e a geometria é
 * recalculada das caixas (mover qualquer lado reposiciona o traço). Cada ligação tem até duas
 * partes: a = a espinha (cor da origem) e b = a descida final (cor do destino).
 */
export interface Liga {
  de: string;
  ladoDe: Lado;
  para: string;
  ladoPara: Lado;
  parte: "a" | "b";
  /** as duas partes andam juntas (e ficam juntas na seleção) */
  grupo: string;
}

/** Família de estilo de cor: a receita da rampa (cor própria e desvio do matiz no tom escuro). */
export type FamiliaEstilo = "esmeralda" | "oceano" | "ameixa" | "ambar" | "rubi" | "grafite" | "propria";

/** O quanto a rampa abre: o tom claro sobe e o escuro desce. */
export type IntensidadeEstilo = "suave" | "media" | "forte";

/** Acabamento do brilho: nada, lustro (faixa clara na própria rampa) ou dobra (forma-capa). */
export type BrilhoEstilo = "nada" | "lustro" | "dobra";

/**
 * Estilo de cor VIVO de uma forma: a forma guarda a receita (família, intensidade e brilho) e a
 * cor-base, e a aparência (preenchimento, contorno, sombra e cor do texto) é DERIVADA a cada
 * mudança da lâmina — trocar a cor ou o tema refaz a rampa inteira. Vazio em `base` = cor do tema.
 */
export interface EstiloForma {
  familia: FamiliaEstilo;
  intensidade: IntensidadeEstilo;
  brilho: BrilhoEstilo;
  /** cor-base (hex sem #); vazio = cor própria da família e, sem ela, o acento do tema */
  base?: string;
  /** ângulo do gradiente em graus (0 = esquerda→direita, 90 = cima→baixo); padrão 45 (diagonal) */
  angulo?: number;
}

export interface Tabela {
  colunas: number[];
  linhas: number[];
  celulas: CelulaTab[][];
  /** opções de estilo (usadas ao aplicar um estilo pronto) */
  cabecalho?: boolean;
  faixas?: boolean;
  primeiraColuna?: boolean;
  /** último estilo pronto aplicado */
  preset?: string;
}

/** Tipo de mídia que uma forma pode tocar. */
export type MidiaTipo = "audio" | "video";

/**
 * Áudio ou vídeo numa forma. O arquivo fica em `Shape.src` (media:ID do deck ou data URL);
 * `poster` é a capa (data URL de imagem) usada na lâmina, nas miniaturas e no .pptx.
 */
export interface Midia {
  tipo: MidiaTipo;
  /** começa sozinho quando a lâmina entra na apresentação */
  auto?: boolean;
  /** repete quando chega ao fim (respeitando o corte) */
  loop?: boolean;
  /** mostra os controles durante a apresentação */
  controles?: boolean;
  /** continua tocando ao sair da lâmina (padrão: para) */
  continuar?: boolean;
  /** volume 0-1 (padrão 1) */
  volume?: number;
  /** corte: trecho que toca, em segundos (fim vazio = até o fim do arquivo) */
  corte?: { inicio: number; fim?: number };
  /** capa (data URL de imagem); vazio = cartão gerado pelo motor */
  poster?: string;
  /** nome original do arquivo (para diagnóstico e para o cartão da capa) */
  nome?: string;
}

/** Tipo de gráfico desenhado pelo motor. */
export type GraficoTipo = "colunas" | "barras" | "linhas" | "area" | "pizza" | "rosca" | "dispersao";

/** Uma série de dados do gráfico: um nome e um valor por categoria. */
export interface GraficoSerie {
  nome: string;
  valores: number[];
}

/**
 * Dados de um gráfico. O motor desenha o gráfico em SVG (não há `c:chart` nativo);
 * na exportação para .pptx ele vira uma imagem, para o arquivo não perder o desenho.
 */
export interface Grafico {
  tipo: GraficoTipo;
  categorias: string[];
  series: GraficoSerie[];
  /** título mostrado no alto do gráfico */
  titulo?: string;
  /** mostra a legenda (padrão: com 2 ou mais séries) */
  legenda?: boolean;
  /** mostra os valores nas barras/pontos */
  rotulos?: boolean;
  /** barras/área empilhadas em vez de lado a lado */
  empilhado?: boolean;
  /** cores das séries (hex sem #); vazio = paleta derivada do deck */
  cores?: string[];
}

/** Um caminho de geometria livre. Comandos: M x y · L x y · C x1 y1 x2 y2 x y · Q x1 y1 x y · A wR hR stAng swAng · Z */
export interface CustPath {
  w: number;
  h: number;
  cmds: (string | number)[];
  fill?: "none" | "norm" | "lighten" | "darken";
  stroke?: boolean;
}

/** Uma parada de gradiente. */
export interface GradStop {
  /** posição 0-100 */
  pos: number;
  color: string;
  alpha: number;
}

/** Preenchimento de forma ou de fundo. */
export interface Fill {
  kind: "none" | "solid" | "gradient" | "image";
  /** cor sólida (hex sem #) */
  color?: string;
  /** opacidade 0-1 */
  alpha?: number;
  stops?: GradStop[];
  /** ângulo do gradiente linear, em graus (0 = da esquerda para a direita; 90 = de cima para baixo) */
  angle?: number;
  /** gradiente circular */
  radial?: boolean;
  /** imagem: data URL ou media:ID */
  src?: string;
  /** imagem ladrilhada em vez de esticada */
  tile?: boolean;
  /** imagem esticada num retângulo deslocado das bordas da forma (esquerda, topo, direita, base) em % da forma;
   *  valores negativos fazem a imagem passar da forma (que a recorta) */
  inset?: [number, number, number, number];
  /** recorte da imagem (esquerda, topo, direita, base) em % da imagem */
  crop?: [number, number, number, number];
}

export interface Line {
  color: string;
  alpha: number;
  /** espessura em pt */
  w: number;
  dash?: "solid" | "dash" | "dot" | "dashDot" | "lgDash" | "sysDash" | "sysDot";
  cap?: "flat" | "round" | "square";
  join?: "round" | "bevel" | "miter";
  /** pontas de seta no início/fim */
  head?: "triangle" | "arrow" | "stealth" | "diamond" | "oval";
  tail?: "triangle" | "arrow" | "stealth" | "diamond" | "oval";
}

export interface Shadow {
  color: string;
  alpha: number;
  /** desfoque, distância em pt e direção em graus */
  blur: number;
  dist: number;
  dir: number;
}

/** Um trecho de texto com formatação própria (todos os valores já resolvidos, sem herança pendente). */
export interface Run {
  text: string;
  /** tamanho em pt */
  size: number;
  bold: boolean;
  italic: boolean;
  underline: boolean;
  strike: boolean;
  color: string;
  alpha?: number;
  font: string;
  caps?: boolean;
  /** espaçamento entre letras em pt */
  spc?: number;
  /** sobrescrito (+) / subscrito (-) em % */
  baseline?: number;
  /** cor do marca-texto (hex sem #); ausente = sem marca-texto */
  highlight?: string;
  link?: string;
  /** quebra de linha dentro do parágrafo (vertical tab) */
  br?: boolean;
}

export interface Bullet {
  /** caractere do marcador (•, –, ...) ou vazio quando numerado */
  char?: string;
  /** esquema de numeração (arabicPeriod, alphaLcPeriod...) */
  auto?: string;
  startAt?: number;
  color?: string;
  /** tamanho em % do texto */
  sizePct?: number;
  font?: string;
}

export interface Para {
  runs: Run[];
  align: TextAlign;
  /** nível de recuo (0-8) */
  lvl: number;
  /** recuo à esquerda e da primeira linha, em pt */
  marL: number;
  indent: number;
  bullet?: Bullet;
  /** espaçamento entre linhas: múltiplo (1 = simples) ou pt fixos */
  lnSpc?: { pct?: number; pts?: number };
  /** espaço antes/depois do parágrafo em pt */
  spcBef: number;
  spcAft: number;
  /** tamanho do texto do parágrafo vazio (altura da linha em branco) */
  endSize: number;
}

// ---------------------------------------------------------------------------
// Temas e proporções
// ---------------------------------------------------------------------------

export const ASPECTS: { id: DeckAspect; title: string; w: number; h: number }[] = [
  { id: "16:9", title: "16:9 (tela cheia)", w: 16, h: 9 },
  { id: "4:3", title: "4:3 (projetor antigo)", w: 4, h: 3 },
];

/** Cores de cada tema (hex sem #, como o .pptx espera). */
export const THEME_COLORS: Record<ThemeId, { bg: string; fg: string; accent: string; muted: string }> = {
  claro: { bg: "FFFFFF", fg: "1C212B", accent: "4F46E5", muted: "6B7280" },
  escuro: { bg: "0E1014", fg: "F4F5F8", accent: "818CF8", muted: "9AA1AE" },
  contraste: { bg: "000000", fg: "FFFFFF", accent: "FFD400", muted: "E5E7EB" },
};

/** Exportado para o .pptx (largura/altura em polegadas). */
export function aspectSize(setup: DeckSetup): { w: number; h: number } {
  if (setup.widthIn && setup.heightIn) return { w: setup.widthIn, h: setup.heightIn };
  const a = ASPECTS.find((x) => x.id === setup.aspect) ?? ASPECTS[0];
  // 13,333 x 7,5 pol é o padrão do PowerPoint para 16:9
  return setup.aspect === "16:9" ? { w: 13.333, h: 7.5 } : { w: 10, h: 7.5 * (a.h / 4) };
}

/** Proporção largura/altura da lâmina (usada pelo palco). */
export function stageRatio(setup: DeckSetup): number {
  if (setup.widthIn && setup.heightIn) return setup.widthIn / setup.heightIn;
  const a = ASPECTS.find((x) => x.id === setup.aspect) ?? ASPECTS[0];
  return a.w / a.h;
}

/** Lâmina vazia com o layout padrão. */
export function emptySlide(layout: SlideLayout = "conteudo"): Slide {
  return { md: "", layout, notes: "", shapes: [] };
}