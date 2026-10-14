// Animações de forma: os tipos que a aba Animações mostra, o início, a duração, o atraso e a
// normalização. Funções puras sobre a `Animacao` do modelo — a fita, o painel, a prévia, o F5 e
// o round-trip do .pptx leem daqui.
import type { Animacao, AnimacaoInicio, AnimacaoTipo } from "../schema";
import { formatarDuracao } from "./transicao";

/** Duração padrão (segundos) dos efeitos com transição. */
export const DURACAO_PADRAO = 0.5;

/** Durações padrão por tipo (as do PowerPoint): girar e ampliar são mais lentos. */
const DURACAO_POR_TIPO: Partial<Record<AnimacaoTipo, number>> = { girar: 2, ampliar: 2 };

/** Tipos na ordem da galeria (entrada, ênfase e saída). */
export const TIPOS_ANIMACAO: AnimacaoTipo[] = ["aparecer", "surgir", "pulsar", "ampliar", "girar", "transparencia", "desaparecer", "sumir"];

/** Classe de cada efeito (agrupa a galeria e decide a validação do .pptx). */
export type AnimacaoClasse = "entrada" | "enfase" | "saida";

export const CLASSE_ANIMACAO: Record<AnimacaoTipo, AnimacaoClasse> = {
  aparecer: "entrada",
  surgir: "entrada",
  pulsar: "enfase",
  ampliar: "enfase",
  girar: "enfase",
  transparencia: "enfase",
  desaparecer: "saida",
  sumir: "saida",
};

export const ROTULOS_ANIMACAO: Record<AnimacaoTipo, string> = {
  aparecer: "Aparecer",
  surgir: "Surgir",
  pulsar: "Pulsar",
  ampliar: "Ampliar",
  girar: "Girar",
  transparencia: "Transparência",
  desaparecer: "Desaparecer",
  sumir: "Sumir",
};

export const DICAS_ANIMACAO: Record<AnimacaoTipo, string> = {
  aparecer: "Aparecer: a forma entra de uma vez, quando o efeito chegar",
  surgir: "Surgir: a forma entra suavemente (fade)",
  pulsar: "Pulsar: a forma cresce um pouco e volta ao tamanho",
  ampliar: "Ampliar/Reduzir: a forma cresce e fica maior",
  girar: "Girar: a forma dá uma volta completa",
  transparencia: "Transparência: a forma fica meio transparente",
  desaparecer: "Desaparecer: a forma sai de uma vez",
  sumir: "Sumir: a forma sai suavemente (fade)",
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
