// Animações de forma: os tipos que a aba Animações mostra, o início, a duração, o atraso e a
// normalização. Funções puras sobre a `Animacao` do modelo — a fita, o painel, a prévia, o F5 e
// o round-trip do .pptx leem daqui.
import type { Animacao, AnimacaoDirecao, AnimacaoInicio, AnimacaoTipo } from "../schema";
import { formatarDuracao } from "./transicao";

/** Duração padrão (segundos) dos efeitos com transição. */
export const DURACAO_PADRAO = 0.5;

/** Durações padrão por tipo (as do PowerPoint): girar/ampliar e a trajetória são mais lentos. */
const DURACAO_POR_TIPO: Partial<Record<AnimacaoTipo, number>> = { girar: 2, ampliar: 2, trajetoria: 2 };

/** Tipos na ordem da galeria (entrada, ênfase, saída e trajetória). */
export const TIPOS_ANIMACAO: AnimacaoTipo[] = [
  "aparecer",
  "surgir",
  "voar",
  "zoom",
  "limpar",
  "caixa",
  "circulo",
  "losango",
  "dividir",
  "persianas",
  "dissolver",
  "roda",
  "pulsar",
  "ampliar",
  "girar",
  "transparencia",
  "desaparecer",
  "sumir",
  "voarFora",
  "encolher",
  "limparFora",
  "caixaFora",
  "circuloFora",
  "losangoFora",
  "dividirFora",
  "persianasFora",
  "dissolverFora",
  "rodaFora",
  "trajetoria",
];

/** Classe de cada efeito (agrupa a galeria e decide a validação do .pptx). */
export type AnimacaoClasse = "entrada" | "enfase" | "saida" | "trajetoria";

export const CLASSE_ANIMACAO: Record<AnimacaoTipo, AnimacaoClasse> = {
  aparecer: "entrada",
  surgir: "entrada",
  voar: "entrada",
  zoom: "entrada",
  limpar: "entrada",
  caixa: "entrada",
  circulo: "entrada",
  losango: "entrada",
  dividir: "entrada",
  persianas: "entrada",
  dissolver: "entrada",
  roda: "entrada",
  pulsar: "enfase",
  ampliar: "enfase",
  girar: "enfase",
  transparencia: "enfase",
  desaparecer: "saida",
  sumir: "saida",
  voarFora: "saida",
  encolher: "saida",
  limparFora: "saida",
  caixaFora: "saida",
  circuloFora: "saida",
  losangoFora: "saida",
  dividirFora: "saida",
  persianasFora: "saida",
  dissolverFora: "saida",
  rodaFora: "saida",
  trajetoria: "trajetoria",
};

export const ROTULOS_ANIMACAO: Record<AnimacaoTipo, string> = {
  aparecer: "Aparecer",
  surgir: "Surgir",
  voar: "Voar",
  zoom: "Zoom",
  limpar: "Limpar",
  caixa: "Caixa",
  circulo: "Círculo",
  losango: "Losango",
  dividir: "Dividir",
  persianas: "Persianas",
  dissolver: "Dissolver",
  roda: "Roda",
  pulsar: "Pulsar",
  ampliar: "Ampliar",
  girar: "Girar",
  transparencia: "Transparência",
  desaparecer: "Desaparecer",
  sumir: "Sumir",
  voarFora: "Voar fora",
  encolher: "Encolher",
  limparFora: "Limpar fora",
  caixaFora: "Caixa fora",
  circuloFora: "Círculo fora",
  losangoFora: "Losango fora",
  dividirFora: "Dividir fora",
  persianasFora: "Persianas fora",
  dissolverFora: "Dissolver fora",
  rodaFora: "Roda fora",
  trajetoria: "Trajetória",
};

export const DICAS_ANIMACAO: Record<AnimacaoTipo, string> = {
  aparecer: "Aparecer: a forma entra de uma vez, quando o efeito chegar",
  surgir: "Surgir: a forma entra suavemente (fade)",
  voar: "Voar: a forma entra voando da borda escolhida em Direção",
  zoom: "Zoom: a forma cresce do centro com um fade",
  limpar: "Limpar: a forma é revelada a partir da borda escolhida em Direção",
  caixa: "Caixa: a forma abre do centro para as bordas, como uma caixa",
  circulo: "Círculo: a forma abre do centro como um círculo",
  losango: "Losango: a forma abre do centro como um losango",
  dividir: "Dividir: a forma abre do centro para os lados, em duas metades",
  persianas: "Persianas: a forma é revelada em faixas, como persianas horizontais",
  dissolver: "Dissolver: a forma aparece em pontinhos, como um chuvisco",
  roda: "Roda: a forma é revelada por uma volta completa, como um ponteiro",
  pulsar: "Pulsar: a forma cresce um pouco e volta ao tamanho",
  ampliar: "Ampliar/Reduzir: a forma cresce e fica maior",
  girar: "Girar: a forma dá uma volta completa",
  transparencia: "Transparência: a forma fica meio transparente",
  desaparecer: "Desaparecer: a forma sai de uma vez",
  sumir: "Sumir: a forma sai suavemente (fade)",
  voarFora: "Voar fora: a forma sai voando para a borda escolhida em Direção",
  encolher: "Encolher: a forma diminui até sumir, com um fade",
  limparFora: "Limpar fora: a forma some a partir da borda escolhida em Direção",
  caixaFora: "Caixa fora: a forma se fecha para o centro, como uma caixa",
  circuloFora: "Círculo fora: a forma se fecha para o centro como um círculo",
  losangoFora: "Losango fora: a forma se fecha para o centro como um losango",
  dividirFora: "Dividir fora: as duas metades se fecham no centro",
  persianasFora: "Persianas fora: a forma some em faixas, como persianas horizontais",
  dissolverFora: "Dissolver fora: a forma some em pontinhos, como um chuvisco",
  rodaFora: "Roda fora: a forma some por uma volta completa, como um ponteiro",
  trajetoria: "Trajetória: a forma anda em linha reta (escolha a direção ao lado)",
};

/** Quando o efeito começa, na ordem da fita. */
export const INICIOS_ANIMACAO: AnimacaoInicio[] = ["clicar", "com", "depois"];

export const ROTULOS_INICIO: Record<AnimacaoInicio, string> = {
  clicar: "Ao clicar",
  com: "Com anterior",
  depois: "Depois",
};

export const DICAS_INICIO: Record<AnimacaoInicio, string> = {
  clicar: "Ao clicar: o efeito espera um clique na apresentação",
  com: "Com o anterior: o efeito toca junto com o anterior (ou com a entrada da lâmina)",
  depois: "Depois do anterior: o efeito toca quando o anterior termina",
};

/** Durações oferecidas na fita (segundos). */
export const DURACOES_ANIMACAO: { valor: number; rotulo: string }[] = [
  { valor: 0.5, rotulo: "0,5 s" },
  { valor: 1, rotulo: "1 s" },
  { valor: 2, rotulo: "2 s" },
];

/** Atrasos oferecidos na fita (segundos); "Sem" limpa o atraso. */
export const ATRASOS_ANIMACAO: { valor: number; rotulo: string }[] = [
  { valor: 0, rotulo: "Sem" },
  { valor: 0.25, rotulo: "0,25 s" },
  { valor: 0.5, rotulo: "0,5 s" },
  { valor: 1, rotulo: "1 s" },
  { valor: 2, rotulo: "2 s" },
];

/** Início padrão de um efeito novo. */
export const INICIO_PADRAO: AnimacaoInicio = "clicar";

/** Direções da trajetória/do voo/do limpar (na ordem da fita) e a padrão. */
export const DIRECOES_ANIMACAO: AnimacaoDirecao[] = ["esquerda", "direita", "cima", "baixo"];

export const DIRECAO_PADRAO: AnimacaoDirecao = "direita";

/** Direção padrão de cada efeito com direção (o PowerPoint usa "de baixo" no Voar e no Limpar). */
const DIRECAO_POR_TIPO: Partial<Record<AnimacaoTipo, AnimacaoDirecao>> = { trajetoria: "direita", voar: "baixo", voarFora: "baixo", limpar: "baixo", limparFora: "baixo" };

/** Trajetória, Voar (entrada/saída) e Limpar (entrada/saída) têm direção. */
export function aceitaDirecaoAnimacao(tipo: AnimacaoTipo | undefined): boolean {
  return tipo === "trajetoria" || tipo === "voar" || tipo === "voarFora" || tipo === "limpar" || tipo === "limparFora";
}

/** Direção efetiva: os tipos sem direção caem no padrão (só para o código não tratar "nenhuma"). */
export function direcaoDeAnimacao(a: Animacao | undefined): AnimacaoDirecao {
  const padrao = (a?.tipo ? DIRECAO_POR_TIPO[a.tipo] : undefined) ?? DIRECAO_PADRAO;
  if (!aceitaDirecaoAnimacao(a?.tipo)) return padrao;
  return a?.direcao && DIRECOES_ANIMACAO.includes(a.direcao) ? a.direcao : padrao;
}

/** Efeitos instantâneos (sem duração): aparecer e desaparecer. */
export function instantaneo(tipo: AnimacaoTipo | undefined): boolean {
  return tipo === "aparecer" || tipo === "desaparecer";
}

/** Efeito com transição ao longo da duração (fade e ênfase). */
export function suave(tipo: AnimacaoTipo | undefined): boolean {
  return !!tipo && !instantaneo(tipo);
}

/** É um efeito de entrada? (o jogador esconde a forma antes de tocar) */
export function entrada(tipo: AnimacaoTipo): boolean {
  return CLASSE_ANIMACAO[tipo] === "entrada";
}

export function inicioDe(a: Animacao): AnimacaoInicio {
  return a.inicio && INICIOS_ANIMACAO.includes(a.inicio) ? a.inicio : INICIO_PADRAO;
}

/** Duração em segundos já dentro dos limites (0,1 s a 10 s), com o padrão do tipo. */
export function duracaoDeAnimacao(a: Animacao | undefined): number {
  const d = a?.duracao;
  if (d === undefined || !Number.isFinite(d)) return (a ? DURACAO_POR_TIPO[a.tipo] : undefined) ?? DURACAO_PADRAO;
  return Math.min(10, Math.max(0.1, Math.round(d * 100) / 100));
}

/** Duração efetiva em segundos (0 nos efeitos instantâneos). */
export function duracaoEfetiva(a: Animacao): number {
  return instantaneo(a.tipo) ? 0 : duracaoDeAnimacao(a);
}

/** Atraso em segundos já dentro dos limites (0 a 60 s). */
export function atrasoDe(a: Animacao | undefined): number {
  const d = a?.atraso;
  if (d === undefined || !Number.isFinite(d)) return 0;
  return Math.min(60, Math.max(0, Math.round(d * 100) / 100));
}

/** Normaliza o que veio da fita, do .pptx ou do rascunho. */
export function normalizarAnimacao(a: Animacao | undefined | null): Animacao | undefined {
  if (!a || !TIPOS_ANIMACAO.includes(a.tipo) || !a.forma) return undefined;
  const out: Animacao = { forma: a.forma, tipo: a.tipo };
  const inicio = inicioDe(a);
  if (inicio !== INICIO_PADRAO) out.inicio = inicio;
  if (suave(a.tipo)) out.duracao = duracaoDeAnimacao(a);
  const atraso = atrasoDe(a);
  if (atraso > 0) out.atraso = atraso;
  if (aceitaDirecaoAnimacao(a.tipo)) out.direcao = direcaoDeAnimacao(a);
  if (a.porParagrafo) out.porParagrafo = true;
  return out;
}

/** Lista normalizada (uma por forma — se vierem duas, fica a primeira). */
export function normalizarAnimacoes(lista: Animacao[] | undefined): Animacao[] | undefined {
  if (!lista?.length) return undefined;
  const vistos = new Set<string>();
  const out: Animacao[] = [];
  for (const a of lista) {
    const n = normalizarAnimacao(a);
    if (!n || vistos.has(n.forma)) continue;
    vistos.add(n.forma);
    out.push(n);
  }
  return out.length ? out : undefined;
}

/** Aplica um efeito à forma: troca o existente no lugar (preserva a ordem) ou acrescenta no fim. */
export function comAnimacao(lista: Animacao[] | undefined, forma: string, tipo: AnimacaoTipo): Animacao[] {
  const atual = normalizarAnimacoes(lista) ?? [];
  const i = atual.findIndex((a) => a.forma === forma);
  const novo = normalizarAnimacao({ ...(i >= 0 ? atual[i] : { forma }), forma, tipo })!;
  if (i >= 0) atual[i] = novo;
  else atual.push(novo);
  return atual;
}

/** Muda o início do efeito da forma; sem efeito na forma, não faz nada. */
export function comInicio(lista: Animacao[] | undefined, forma: string, inicio: AnimacaoInicio): Animacao[] | undefined {
  const atual = normalizarAnimacoes(lista);
  if (!atual) return atual;
  const i = atual.findIndex((a) => a.forma === forma);
  if (i < 0) return atual;
  atual[i] = normalizarAnimacao({ ...atual[i], inicio })!;
  return atual;
}

/** Muda a duração do efeito da forma (só nos efeitos com transição). */
export function comDuracao(lista: Animacao[] | undefined, forma: string, duracao: number): Animacao[] | undefined {
  const atual = normalizarAnimacoes(lista);
  if (!atual) return atual;
  const i = atual.findIndex((a) => a.forma === forma);
  if (i < 0 || !suave(atual[i].tipo)) return atual;
  atual[i] = normalizarAnimacao({ ...atual[i], duracao })!;
  return atual;
}

/** Muda o atraso do efeito da forma (0 = sem atraso). */
export function comAtraso(lista: Animacao[] | undefined, forma: string, atraso: number): Animacao[] | undefined {
  const atual = normalizarAnimacoes(lista);
  if (!atual) return atual;
  const i = atual.findIndex((a) => a.forma === forma);
  if (i < 0) return atual;
  atual[i] = normalizarAnimacao({ ...atual[i], atraso })!;
  return atual;
}

/** Muda a direção da trajetória da forma (só vale no tipo `trajetoria`). */
export function comDirecao(lista: Animacao[] | undefined, forma: string, direcao: AnimacaoDirecao): Animacao[] | undefined {
  const atual = normalizarAnimacoes(lista);
  if (!atual) return atual;
  const i = atual.findIndex((a) => a.forma === forma);
  if (i < 0 || !aceitaDirecaoAnimacao(atual[i].tipo)) return atual;
  atual[i] = normalizarAnimacao({ ...atual[i], direcao })!;
  return atual;
}

/** Liga/desliga o "por parágrafo" do efeito da forma. */
export function comPorParagrafo(lista: Animacao[] | undefined, forma: string, ativo: boolean): Animacao[] | undefined {
  const atual = normalizarAnimacoes(lista);
  if (!atual) return atual;
  const i = atual.findIndex((a) => a.forma === forma);
  if (i < 0) return atual;
  atual[i] = normalizarAnimacao({ ...atual[i], porParagrafo: ativo })!;
  return atual;
}

/** Quantos parágrafos NÃO vazios a forma tem (é o que o "por parágrafo" anima). */
export function paragrafosDe(forma: { paras?: { runs: unknown[] }[] } | undefined): number[] {
  if (!forma?.paras?.length) return [];
  return forma.paras.map((p, i) => (p.runs.length ? i : -1)).filter((i) => i >= 0);
}

/** Tira o efeito da forma. */
export function semAnimacao(lista: Animacao[] | undefined, forma: string): Animacao[] | undefined {
  const atual = normalizarAnimacoes(lista);
  if (!atual) return atual;
  return normalizarAnimacoes(atual.filter((a) => a.forma !== forma));
}

/** Move o efeito da forma na ordem (passo -1 sobe, +1 desce). */
export function moverAnimacao(lista: Animacao[] | undefined, forma: string, passo: number): Animacao[] | undefined {
  const atual = normalizarAnimacoes(lista);
  if (!atual) return atual;
  const i = atual.findIndex((a) => a.forma === forma);
  const j = i + passo;
  if (i < 0 || j < 0 || j >= atual.length) return atual;
  const copia = atual.slice();
  [copia[i], copia[j]] = [copia[j], copia[i]];
  return copia;
}

/** Mantém só as animações cujas formas ainda existem (excluir forma, redefinir lâmina). */
export function podarAnimacoes(lista: Animacao[] | undefined, idsVivos: Iterable<string>): Animacao[] | undefined {
  const vivos = new Set(idsVivos);
  return normalizarAnimacoes((lista ?? []).filter((a) => vivos.has(a.forma)));
}

export { formatarDuracao };
