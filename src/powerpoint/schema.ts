// Modelo de dados do motor de APRESENTAÇÕES (PowerPoint) do mdCreator.
// Espelha o motor do Word (src/word): schema → model → markdown → view → host.
// Só tipos e constantes: nenhum DOM, nenhum I/O, nenhuma dependência externa.

/** Proporção da lâmina. */
export type DeckAspect = "16:9" | "4:3";

/** Papel da lâmina (muda o alinhamento/estilo base). */
export type SlideLayout = "titulo" | "secao" | "conteudo" | "vazio";

/** Tema visual aplicado ao deck (fundo, acento, fontes). */
export type ThemeId = "claro" | "escuro" | "contraste";

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
  /** geometria livre (custGeom): caminhos em unidades do próprio caminho */
  paths?: CustPath[];
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