// F4 — dicionário pessoal automático: o app aprende sozinho os termos que a pessoa já disse que
// estão certos, com HISTERESE (nunca promove de primeira) e DECAIMENTO (meia-vida de 30 dias:
// um sinal antigo vale menos que um recente).
//
// Sinais conhecidos (todos "esta palavra não é erro"):
//  - "Ignorar neste texto" no aviso da palavra (peso 1) — a pessoa diz explicitamente que o termo
//    está certo, sem mexer no dicionário;
//  - acrescentar a palavra ao dicionário à mão (marca como promovida: sai da lista de candidatas).
//
// Ao passar do limiar de força, o termo é PROMOVIDO: quem escuta `aoPromoverTermo` (o app) coloca
// a palavra no dicionário pessoal — e ela deixa de ser marcada, sem precisar clicar em nada.
//
// Fica só neste computador (localStorage) e guarda NÚMEROS e a palavra: nada do documento.

const KEY = "mdc.corretor.termos";

/** Força mínima para promover (histerese: 3 sinais simples, ou menos se forem fortes). */
export const LIMIAR_PROMOCAO = 3;

/** Meia-vida da força: um sinal de 30 dias atrás vale metade. */
const MEIA_VIDA_MS = 30 * 24 * 60 * 60 * 1000;

/** Teto de termos guardados; os de menor força saem primeiro (promovidos ficam). */
const LIMITE = 400;

/** Abaixo disto o termo (não promovido) é esquecido na compactação. */
const ESQUECER = 0.25;

interface Item {
  /** força acumulada (decai com o tempo) */
  p: number;
  /** quando foi mexido pela última vez (ms) */
  t: number;
  /** já entrou no dicionário pessoal (aprendida pelo app ou à mão) */
  prom?: boolean;
}

interface Estado {
  v: 1;
  itens: Record<string, Item>;
}

let cache: Estado | null = null;
const ouvintes: ((palavra: string) => void)[] = [];

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
  if (!a) return (cache = { v: 1, itens: {} });
  try {
    const bruto = a.getItem(KEY);
    const parsed = bruto ? (JSON.parse(bruto) as Estado) : null;
    if (parsed && parsed.v === 1 && parsed.itens && typeof parsed.itens === "object") {
      const itens: Record<string, Item> = {};
      for (const [k, v] of Object.entries(parsed.itens)) {
        if (!v || typeof v !== "object") continue;
        itens[k] = { p: Math.max(0, Number(v.p) || 0), t: Number(v.t) || Date.now(), prom: v.prom ? true : undefined };
      }
      cache = { v: 1, itens };
    } else {
      cache = { v: 1, itens: {} };
    }
  } catch {
    cache = { v: 1, itens: {} };
  }
  return cache;
}

function gravar(): void {
  const a = armazem();
  if (!a) return;
  try {
    a.setItem(KEY, JSON.stringify(cache ?? { v: 1, itens: {} }));
  } catch {
    /* sem espaço: vale só nesta sessão */
  }
}

/** Chave de armazenamento: a palavra em minúsculas (o dicionário pessoal também é minúsculo). */
const chave = (palavra: string): string => palavra.trim().toLowerCase();

/** Só vale acompanhar palavra simples (letras, apóstrofo e hífen), como no aprendizado de pares. */
function acompanhavel(palavra: string): boolean {
  const p = palavra.trim();
  return p.length >= 2 && p.length <= 40 && /^[\p{L}][\p{L}'-]*$/u.test(p);
}

/**
 * Visão do estado já com o decaimento aplicado: força recalculada para agora, termos fracos
 * esquecidos e teto respeitado (os mais fracos saem; promovidos nunca). Só leitura — quem
 * escreve chama `aplicar`.
 */
function comDecaimento(agora = Date.now()): Record<string, Item> {
  const itens: Record<string, Item> = {};
  for (const [k, it] of Object.entries(carregar().itens)) {
    const forca = it.p * Math.pow(0.5, (agora - it.t) / MEIA_VIDA_MS);
    if (!it.prom && forca < ESQUECER) continue;
    itens[k] = { p: forca, t: agora, prom: it.prom };
  }
  const chaves = Object.keys(itens);
  if (chaves.length > LIMITE) {
    const removiveis = chaves.filter((k) => !itens[k].prom).sort((a, b) => itens[a].p - itens[b].p);
    let excesso = chaves.length - LIMITE;
    for (const k of removiveis) {
      if (excesso-- <= 0) break;
      delete itens[k];
    }
  }
  return itens;
}

/** Consolida o decaimento no armazenamento (antes de uma escrita). */
function aplicar(agora = Date.now()): Record<string, Item> {
  const estado = carregar();
  estado.itens = comDecaimento(agora);
  gravar();
  return estado.itens;
}

/** Força atual de um termo (com decaimento), 0 quando desconhecido. */
export function forcaDoTermo(palavra: string): number {
  const it = comDecaimento()[chave(palavra)];
  return it ? Math.round(it.p * 100) / 100 : 0;
}

/** Folga na comparação do limiar: o decaimento entre dois sinais deixa um épsilon (frações ínfimas). */
const EPS = 1e-4;

/**
 * Anota um sinal de "esta palavra está certa". Devolve `true` quando o termo acabou de ser
 * PROMOVIDO (quem chamou deve colocá-lo no dicionário pessoal).
 */
export function sinalizarTermo(palavra: string, peso = 1): boolean {
  if (!acompanhavel(palavra)) return false;
  const k = chave(palavra);
  const itens = aplicar();
  const it = (itens[k] ??= { p: 0, t: Date.now() });
  if (it.prom) return false; // já está no dicionário: nada a fazer
  const antes = it.p;
  const novo = it.p + peso;
  const promoveu = antes < LIMIAR_PROMOCAO - EPS && novo >= LIMIAR_PROMOCAO - EPS;
  it.p = Math.min(LIMIAR_PROMOCAO, novo);
  it.t = Date.now();
  if (promoveu) it.prom = true;
  gravar();
  if (promoveu) for (const fn of ouvintes) fn(palavra.trim());
  return promoveu;
}

/** Termos que o app insiste em marcar: candidatas ainda não promovidas, da mais forte à mais fraca. */
export function termosInsistentes(): { palavra: string; pontos: number }[] {
  return Object.entries(comDecaimento())
    .filter(([, it]) => !it.prom && it.p >= 1)
    .map(([k, it]) => ({ palavra: k, pontos: Math.round(it.p * 10) / 10 }))
    .sort((a, b) => b.pontos - a.pontos);
}

/** Termos que o app já aprendeu (promovidos por ele ou adicionados à mão). */
export function termosAprendidos(): { palavra: string; pontos: number }[] {
  return Object.entries(comDecaimento())
    .filter(([, it]) => it.prom)
    .map(([k, it]) => ({ palavra: k, pontos: Math.round(it.p * 10) / 10 }))
    .sort((a, b) => a.palavra.localeCompare(b.palavra, "pt-BR"));
}

/** A palavra entrou no dicionário à mão: sai das candidatas e passa a contar como aprendida. */
export function marcarPromovidoManual(palavra: string): void {
  if (!acompanhavel(palavra)) return;
  const itens = aplicar();
  const k = chave(palavra);
  const it = (itens[k] ??= { p: 0, t: Date.now() });
  it.prom = true;
  it.p = Math.max(it.p, 1);
  it.t = Date.now();
  gravar();
}

/** Esquece um termo (some das listas). */
export function esquecerTermo(palavra: string): void {
  const itens = aplicar();
  delete itens[chave(palavra)];
  gravar();
}

/** Quem quer saber das promoções (o app coloca a palavra no dicionário pessoal). */
export function aoPromoverTermo(fn: (palavra: string) => void): void {
  ouvintes.push(fn);
}

/** Esquece tudo (usado pelo "esquecer o que aprendeu"). */
export function limparTermos(): void {
  cache = { v: 1, itens: {} };
  try {
    armazem()?.removeItem(KEY);
  } catch {
    /* sem armazenamento */
  }
}

// ---------- exportar/importar o aprendizado (F4) ----------

export function dadosTermos(): Estado {
  return { v: 1, itens: comDecaimento() };
}

export function restaurarTermos(dados: unknown): number {
  const d = dados as Estado | undefined;
  if (!d || d.v !== 1 || !d.itens || typeof d.itens !== "object") throw new Error("termos inválidos");
  const itens: Record<string, Item> = {};
  for (const [k, v] of Object.entries(d.itens)) {
    if (!v || typeof v !== "object" || !acompanhavel(k)) continue;
    itens[k] = { p: Math.max(0, Number(v.p) || 0), t: Number(v.t) || Date.now(), prom: v.prom ? true : undefined };
  }
  cache = { v: 1, itens };
  gravar();
  return Object.keys(itens).length;
}
