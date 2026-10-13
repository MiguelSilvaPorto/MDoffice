// Decisão de aplicar sozinho: quanta confiança há no primeiro candidato e quanto ele
// está na frente do segundo. É o passo que a pesquisa chama de F2 — probabilidade com
// margem, em vez de regras fixas: empate vira SUGESTÃO, nunca aplicação.
//
// As notas do corretor (0 a ~1,5) viram probabilidades por softmax; o limiar sobe e
// desce conforme o histórico local (auto-aplicações desfeitas × mantidas). A leitura do
// limiar já alimenta o worker; o gancho de "desfez" entra por `registrarDesfeita()`.
//
// Puro nas contas; a calibragem usa localStorage quando existe (testes rodam sem ele).

export interface EntradaDecisao {
  /** notas dos candidatos, da melhor para a pior (escala do corretor: 0 a ~1,5) */
  pontos: number[];
  /** classe de certeza: erro clássico, troca aprendida, só acento ou candidato único */
  certo?: boolean;
  /** nota de contexto do vencedor (0 a 1), informativa */
  contexto?: number;
}

export interface Decisao {
  aplicar: boolean;
  /** probabilidade estimada do vencedor (0 a 1) */
  confianca: number;
  /** distância para o segundo colocado (0 a 1) */
  margem: number;
  /** limiar em vigor (muda com o histórico de desfazer/mantidas) */
  tau: number;
  motivo: string;
}

/** Limiar de confiança inicial. */
export const TAU_INICIAL = 0.62;

/** O vencedor precisa estar pelo menos esta vezes à frente do segundo. */
export const RAZAO_MINIMA = 2;

/** Temperatura do softmax: o quanto as notas viram probabilidades. */
const TEMPERATURA = 0.22;

/** Notas -> probabilidades (softmax com temperatura). Usado no diagnóstico e nos testes. */
export function probabilidades(pontos: number[], temperatura = TEMPERATURA): number[] {
  if (!pontos.length) return [];
  const max = Math.max(...pontos);
  const exps = pontos.map((p) => Math.exp((p - max) / Math.max(0.01, temperatura)));
  const soma = exps.reduce((a, b) => a + b, 0);
  return soma > 0 ? exps.map((e) => e / soma) : [];
}

/**
 * Aplica? Leva em conta a classe de certeza, a confiança no vencedor e a margem sobre o
 * segundo. A "confiança" é a fatia do vencedor contra o segundo colocado (0,5 = empate
 * técnico): assim a decisão não fica mais frouxa só porque vieram muitos candidatos
 * pareados na lista.
 */
export function decidir(e: EntradaDecisao, tau = TAU_INICIAL): Decisao {
  if (!e.pontos.length) return { aplicar: false, confianca: 0, margem: 0, tau, motivo: "sem candidato" };
  const [a = 0, b = 0] = probabilidades(e.pontos.slice(0, 2));
  const soma = a + b || 1;
  const p1 = a / soma;
  const p2 = b / soma;
  const margem = p1 - p2;
  if (e.certo) return { aplicar: true, confianca: Math.max(p1, 0.9), margem, tau, motivo: "classe de certeza" };
  if (p1 < tau) return { aplicar: false, confianca: p1, margem, tau, motivo: "confiança abaixo do limiar" };
  if (p2 > 0 && p1 / p2 < RAZAO_MINIMA) return { aplicar: false, confianca: p1, margem, tau, motivo: "empate técnico com o segundo" };
  return { aplicar: true, confianca: p1, margem, tau, motivo: "confiança e margem suficientes" };
}

// ---------------------------------------------------------------------------
// calibragem do limiar (auto-aplicações desfeitas × mantidas)
// ---------------------------------------------------------------------------

interface Calibragem {
  ok: number;
  ruim: number;
}

const KEY = "mdc.corretor.decisao";

function ler(): Calibragem {
  try {
    const raw = typeof localStorage === "undefined" ? null : localStorage.getItem(KEY);
    if (!raw) return { ok: 0, ruim: 0 };
    const c = JSON.parse(raw) as Partial<Calibragem>;
    return { ok: Math.max(0, Number(c.ok) || 0), ruim: Math.max(0, Number(c.ruim) || 0) };
  } catch {
    return { ok: 0, ruim: 0 };
  }
}

function gravar(c: Calibragem): void {
  try {
    if (typeof localStorage !== "undefined") localStorage.setItem(KEY, JSON.stringify(c));
  } catch {
    /* sem armazenamento */
  }
}

/** Registra que uma auto-aplicação foi mantida (o texto seguiu corrigido). */
export function registrarMantida(): void {
  const c = ler();
  c.ok = Math.min(5000, c.ok + 1);
  gravar(c);
}

/** Registra que uma auto-aplicação foi desfeita (Ctrl+Z ou digitar por cima). */
export function registrarDesfeita(): void {
  const c = ler();
  c.ruim = Math.min(5000, c.ruim + 1);
  gravar(c);
}

/** Esquece o histórico de calibragem (usado pelo "esquecer o que aprendeu"). */
export function limparCalibragem(): void {
  gravar({ ok: 0, ruim: 0 });
}

/**
 * Limiar em vigor: fica no inicial até haver amostra e depois sobe/desce conforme a taxa
 * de desfeitas. Duas de cada cem desfeitas é o alvo: acima disso o app fica mais exigente,
 * abaixo relaxa — mas nunca fora de 0,45–0,80.
 */
export function tauAtual(): number {
  const c = ler();
  const n = c.ok + c.ruim;
  if (n < 10) return TAU_INICIAL;
  const taxaRuim = c.ruim / n;
  const ajuste = (taxaRuim - 0.02) * 1.5;
  return Math.max(0.55, Math.min(0.85, Math.round((TAU_INICIAL + ajuste) * 100) / 100));
}
