// O que a fita e o painel precisam saber do que está selecionado (o host calcula e entrega).
import type { EstadoTrecho } from "../edicao/texto";
import type { Canto } from "../edicao/formato";
import type { CelulasSel, Ferramenta } from "../stage";
import type { Animacao, DeckSetup, Fill, Para, Shape, SlideLayout, Transicao } from "../schema";

export interface EstadoUI {
  temLamina: boolean;
  indice: number;
  total: number;
  layout: SlideLayout;
  /** a lâmina atual está oculta na apresentação */
  oculta: boolean;
  /** formas selecionadas */
  formas: Shape[];
  /** a principal (a última escolhida) */
  forma?: Shape;
  editando: boolean;
  /** estilo do texto (da seleção, ou o da forma toda) */
  trecho: EstadoTrecho | null;
  /** o primeiro parágrafo afetado */
  paragrafo?: Para;
  podeDesfazer: boolean;
  podeRefazer: boolean;
  temCopia: boolean;
  zoom: number;
  ferramenta: Ferramenta;
  fixas: boolean;
  encaixe: boolean;
  grade: boolean;
  /** faixa de lâminas na lateral (vertical) em vez do topo (horizontal) */
  faixaVertical: boolean;
  /** cores mais usadas no deck */
  paleta: string[];
  fontes: string[];
  setup: DeckSetup;
  bg?: Fill;
  /** transição de entrada da lâmina atual (normalizada) */
  transicao?: Transicao;
  /** a lâmina tem uma transição do .pptx que o app não representa (fica guardada crua) */
  transicaoPreservada?: boolean;
  /** animação da forma principal (aba Animações) */
  animacao?: Animacao;
  /** a lâmina tem um `<p:timing>` do .pptx que o app não representa (fica guardado cru) */
  animacaoPreservada?: boolean;
  /** posição da animação da forma principal na ordem (0-based; -1 = sem animação) */
  animacaoPos?: number;
  /** quantas animações a lâmina tem */
  animacaoTotal?: number;
  /** a seleção tem formas agrupadas */
  temGrupo: boolean;
  /** unidade de medida do painel */
  largura: number;
  altura: number;
  /** células escolhidas na tabela selecionada */
  celulas: CelulasSel | null;
  /** cantos escolhidos para a edição de raio (palco e painel) */
  cantosSel: Canto[];
}

export const FONTES_COMUNS = [
  "Segoe UI", "Calibri", "Arial", "Arial Black", "Cambria", "Candara", "Consolas", "Courier New", "Georgia", "Impact", "Tahoma",
  "Times New Roman", "Trebuchet MS", "Verdana", "Montserrat", "Roboto", "Open Sans", "Inter",
];

export const TAMANHOS = [8, 9, 10, 10.5, 11, 12, 14, 16, 18, 20, 24, 28, 32, 36, 40, 44, 48, 54, 60, 72, 80, 96];

/** Centímetros ⇄ pt (o PowerPoint em português mostra tamanhos em cm). */
export const ptParaCm = (pt: number) => Math.round((pt / 72) * 2.54 * 100) / 100;
export const cmParaPt = (cm: number) => (cm / 2.54) * 72;
