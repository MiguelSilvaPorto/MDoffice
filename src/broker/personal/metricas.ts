// F4 — métricas do corretor: o app mede a si mesmo para mostrar em Configurações, com
// transparência (precisão percebida e avisos por 1.000 palavras), e para o protocolo de
// avaliação do plano (F0–F4). Fica só neste computador e guarda NÚMEROS agregados.

const KEY = "mdc.corretor.metricas";

interface Estado {
  /** palavras verificadas (somatório das varreduras) */
  palavras: number;
  /** avisos de ESCRITA (ortografia) nessas varreduras */
  marcadas: number;
  /** quantas varreduras completas foram contadas */
  varreduras: number;
}

let cache: Estado | null = null;

function armazem(): Storage | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}

function carregar(): Estado {
  if (cache) return cache;
  const a = armazem();
  if (!a) return (cache = { palavras: 0, marcadas: 0, varreduras: 0 });
  try {
    const bruto = a.getItem(KEY);
    const p = bruto ? (JSON.parse(bruto) as Estado) : null;
    cache = {
      palavras: Math.max(0, Number(p?.palavras) || 0),
      marcadas: Math.max(0, Number(p?.marcadas) || 0),
      varreduras: Math.max(0, Number(p?.varreduras) || 0),
    };
  } catch {
    cache = { palavras: 0, marcadas: 0, varreduras: 0 };
  }
  return cache;
}

function gravar(): void {
  const a = armazem();
  if (!a) return;
  try {
    a.setItem(KEY, JSON.stringify(cache ?? { palavras: 0, marcadas: 0, varreduras: 0 }));
  } catch {
    /* sem espaço */
  }
}

/** Soma uma varredura (chamada pelo assistente a cada verificação de escrita). */
export function contarVarredura(palavras: number, marcadas: number): void {
  if (!Number.isFinite(palavras) || palavras <= 0) return;
  const e = carregar();
  e.palavras += Math.round(palavras);
  e.marcadas += Math.max(0, Math.round(marcadas));
  e.varreduras += 1;
  gravar();
}

/** O que mostrar em Configurações: totais e a taxa de avisos por 1.000 palavras. */
export function metricasCorretor(): Estado & { porMil: number } {
  const e = carregar();
  return { ...e, porMil: e.palavras > 0 ? Math.round((e.marcadas / e.palavras) * 1000 * 10) / 10 : 0 };
}

export function limparMetricas(): void {
  cache = { palavras: 0, marcadas: 0, varreduras: 0 };
  try {
    armazem()?.removeItem(KEY);
  } catch {
    /* sem armazenamento */
  }
}

export function dadosMetricas(): Estado {
  return { ...carregar() };
}

export function restaurarMetricas(dados: unknown): void {
  const d = dados as Estado | undefined;
  if (!d || typeof d !== "object") throw new Error("métricas inválidas");
  cache = {
    palavras: Math.max(0, Number(d.palavras) || 0),
    marcadas: Math.max(0, Number(d.marcadas) || 0),
    varreduras: Math.max(0, Number(d.varreduras) || 0),
  };
  gravar();
}
