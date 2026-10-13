// Transições de lâmina: os tipos que a fita mostra, a direção, a duração e a normalização.
// Funções puras sobre a `Transicao` do modelo — a fita, a prévia, o F5 e o round-trip do .pptx leem daqui.
import type { Transicao, TransicaoDirecao, TransicaoTipo } from "../schema";

/** Duração padrão (segundos) quando a lâmina não diz outra: é a que o PowerPoint usa. */
export const DURACAO_PADRAO = 0.7;

/** Tipos na ordem da galeria da fita. */
export const TIPOS_TRANSICAO: TransicaoTipo[] = ["none", "fade", "push", "wipe", "split", "cover", "uncover"];

export const ROTULOS_TRANSICAO: Record<TransicaoTipo, string> = {
  none: "Sem",
  fade: "Fade",
  push: "Push",
  wipe: "Wipe",
  split: "Split",
  cover: "Cover",
  uncover: "Uncover",
};

export const DICAS_TRANSICAO: Record<TransicaoTipo, string> = {
  none: "Sem transição: a lâmina troca de uma vez",
  fade: "Fade: a lâmina nova aparece suavemente sobre a anterior (crossfade)",
  push: "Push: a lâmina nova empurra a anterior para fora",
  wipe: "Wipe: a lâmina nova é revelada a partir de uma borda",
  split: "Split: a lâmina nova abre do centro para as bordas",
  cover: "Cover: a lâmina nova desliza por cima da anterior",
  uncover: "Uncover: a lâmina anterior sai e revela a nova",
};

export const DIRECOES_TRANSICAO: TransicaoDirecao[] = ["esquerda", "direita", "cima", "baixo"];

export const ROTULOS_DIRECAO: Record<TransicaoDirecao, string> = {
  esquerda: "Esquerda",
  direita: "Direita",
  cima: "Cima",
  baixo: "Baixo",
};

export const DICAS_DIRECAO: Record<TransicaoDirecao, string> = {
  esquerda: "A lâmina entra pela esquerda",
  direita: "A lâmina entra pela direita",
  cima: "A lâmina entra por cima",
  baixo: "A lâmina entra por baixo",
};

/** Durações oferecidas na fita (segundos). */
export const DURACOES_TRANSICAO: { valor: number; rotulo: string }[] = [
  { valor: 0.5, rotulo: "0,5 s" },
  { valor: 1, rotulo: "1 s" },
  { valor: 2, rotulo: "2 s" },
];

/** Tipos que aceitam direção (fade é um cruzamento e split abre do centro). */
export const TIPOS_COM_DIRECAO: TransicaoTipo[] = ["push", "wipe", "cover", "uncover"];

/** Direção usada quando o tipo aceita direção e a lâmina ainda não escolheu nenhuma. */
export const DIRECAO_PADRAO: TransicaoDirecao = "direita";

export function aceitaDirecao(tipo: TransicaoTipo | undefined): boolean {
  return !!tipo && TIPOS_COM_DIRECAO.includes(tipo);
}

/** Duração em segundos já dentro dos limites (0,1 s a 10 s), com o padrão de 0,7 s. */
export function duracaoDe(t: Transicao | undefined): number {
  const d = t?.duracao;
  if (d === undefined || !Number.isFinite(d)) return DURACAO_PADRAO;
  return Math.min(10, Math.max(0.1, Math.round(d * 100) / 100));
}

/** Direção efetiva: os tipos sem direção caem no padrão (só para o código não tratar "nenhuma"). */
export function direcaoDe(t: Transicao | undefined): TransicaoDirecao {
  if (!aceitaDirecao(t?.tipo)) return DIRECAO_PADRAO;
  return t?.direcao && DIRECOES_TRANSICAO.includes(t.direcao) ? t.direcao : DIRECAO_PADRAO;
}

/** Texto da duração em pt-BR ("0,5 s"). */
export function formatarDuracao(segundos: number): string {
  return `${String(Math.round(segundos * 100) / 100).replace(".", ",")} s`;
}

/**
 * Normaliza o que veio da fita, do .pptx ou do rascunho: tipo conhecido, direção só nos tipos que
 * aceitam (preenchida com o padrão) e duração dentro dos limites. Tipo desconhecido = sem transição.
 */
export function normalizarTransicao(t: Transicao | undefined | null): Transicao | undefined {
  if (!t || !TIPOS_TRANSICAO.includes(t.tipo)) return undefined;
  if (t.tipo === "none") return { tipo: "none" };
  const out: Transicao = { tipo: t.tipo };
  if (aceitaDirecao(t.tipo)) out.direcao = direcaoDe({ tipo: t.tipo, direcao: t.direcao });
  if (t.duracao !== undefined) out.duracao = duracaoDe(t);
  return out;
}

/** Aplica uma mudança parcial (tipo, direção ou duração) por cima da transição atual. */
export function comTransicao(atual: Transicao | undefined, patch: Partial<Transicao>): Transicao | undefined {
  return normalizarTransicao({ tipo: "none", ...(atual ?? {}), ...patch });
}
