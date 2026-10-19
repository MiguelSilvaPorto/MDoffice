// Log de decisões do corretor: por que ele sugeriu, aplicou ou ignorou cada coisa.
//
// Vive desligado por padrão (custo zero). Liga por `?diag=1` na URL, por
// `localStorage["mdc.diag"] = "1"` ou pelo console (`__mdofficeDiag.ligar()`), e mostra um botão
// flutuante "Diagnóstico (N)" com o log, cópia e download em JSONL.
//
// Cada entrada é uma DECISÃO, não um aviso: a regra/mensagem que originou, o trecho, os guardas
// (`safe`, `auto`, confiança) e o veredito com o motivo. É o que responde "por que ele tentou
// corrigir aquilo?" sem adivinhar.

export type DiagGatilho = "checagem" | "pausa" | "paragrafo" | "revisao" | "formatar" | "salvar" | "app";
export type DiagVeredito = "detectado" | "aplicado" | "ignorado";

export interface DiagEntrada {
  /** sequência dentro da sessão (id de correlação) */
  n: number;
  /** epoch ms */
  at: number;
  gatilho: DiagGatilho;
  tipo?: "spell" | "style";
  /** regra/mensagem que originou a decisão */
  regra: string;
  from?: number;
  to?: number;
  palavra?: string;
  safe?: boolean;
  auto?: string;
  fix?: string;
  sugestao?: string;
  veredito: DiagVeredito;
  /** por que foi ignorado / como foi aplicado */
  motivo?: string;
  /** janela do texto em volta (para localizar o ponto sem abrir o documento) */
  janela?: string;
}

const LIMITE = 4000;
let ativo = false;
let entradas: DiagEntrada[] = [];
let seq = 0;
const sessao = Math.random().toString(36).slice(2, 8);

export function diagAtivo(): boolean {
  return ativo;
}

export function diagLigar(): void {
  ativo = true;
}

export function diagDesligar(): void {
  ativo = false;
}

export function diagLimpar(): void {
  entradas = [];
  seq = 0;
}

export function diagSessao(): string {
  return sessao;
}

export function diagEntradas(): readonly DiagEntrada[] {
  return entradas;
}

/** Registra uma decisão. Ignorado quando o log está desligado (custo zero). */
export function diag(e: Omit<DiagEntrada, "n" | "at">): void {
  if (!ativo) return;
  seq++;
  entradas.push({ n: seq, at: Date.now(), ...e });
  if (entradas.length > LIMITE) entradas.splice(0, entradas.length - LIMITE);
  avisarPainel();
}

/** A janela do texto em volta do trecho (com "…" nas bordas), para achar o ponto no documento. */
export function janelaDe(texto: string, from: number, to: number, raio = 60): string {
  const ini = Math.max(0, from - raio);
  const fim = Math.min(texto.length, to + raio);
  return `${ini > 0 ? "…" : ""}${texto.slice(ini, fim).replace(/\s+/g, " ").trim()}${fim < texto.length ? "…" : ""}`;
}

/** JSONL: uma decisão por linha, pronto para anexar a um relatório. */
export function diagJSONL(): string {
  return entradas.map((e) => JSON.stringify(e)).join("\n");
}

/** Contagem por regra e veredito (o resumo que aparece no painel). */
export function diagResumo(): { total: number; aplicados: number; ignorados: number; porRegra: [string, number][] } {
  const porRegra = new Map<string, number>();
  let aplicados = 0;
  let ignorados = 0;
  for (const e of entradas) {
    porRegra.set(e.regra, (porRegra.get(e.regra) ?? 0) + 1);
    if (e.veredito === "aplicado") aplicados++;
    if (e.veredito === "ignorado") ignorados++;
  }
  return {
    total: entradas.length,
    aplicados,
    ignorados,
    porRegra: [...porRegra.entries()].sort((a, b) => b[1] - a[1]).slice(0, 20),
  };
}

// ---- painel (só quando ligado) ----
let avisar: (() => void) | null = null;

function avisarPainel(): void {
  avisar?.();
}

/** Liga a notificação do painel (chamado pela UI do diagnóstico). */
export function diagAoMudar(fn: (() => void) | null): void {
  avisar = fn;
}
