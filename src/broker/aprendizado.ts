// Aprendizado do corretor: as decisões da pessoa viram conhecimento do app.
//
// Responsabilidade: guardar o par "o que estava escrito → o que ficou depois de
// aceitar a correção" e devolver os pares em que já dá para confiar. É o que faz o
// corretor melhorar com o uso em vez de depender só de listas escritas à mão:
// uma troca que a pessoa aceita algumas vezes passa a ser aplicada sozinha, e um
// termo que ela recusa para de ser sugerido.
//
// ACEITE e RECUSA andam juntas: desfazer (Ctrl+Z) uma correção que o app aplicou
// sozinho desconta o par — um par confiável volta a ser apenas sugestão — e digitar
// por cima de uma sugestão desconta menos. Cada decisão também alimenta os contadores
// por CLASSE de erro (spell/classeErro.ts), que deixam o corretor acertar antes de
// conhecer o par exato.
//
// Fica só neste computador (localStorage) e guarda NÚMEROS, não textos: cada par é
// uma linha curta com o placar. Nada do documento é copiado.

import { limparClasses, registrarClasse } from "./spell/classeErro";

const KEY = "mdc.corretor.aprendido";

/** Teto de pares guardados; os de menor placar saem primeiro. */
const LIMITE = 3000;

/**
 * Placar mínimo para a troca virar correção confiável (aplicada sozinha).
 * Dois é o mínimo que ainda separa "aceitei uma vez por engano" de "esta troca é
 * sempre certa para mim".
 */
export const ACEITES_PARA_CONFIAR = 2;

/** Quanto cada recusa tira do placar. Desfazer pesa mais que apenas ignorar a sugestão. */
const PESO_DESFAZER = 2;
const PESO_RECUSAR_SUGESTAO = 1;

/** Piso do placar: recusa repetida não empurra o par para o infinito (dá para reaprender). */
const PISO = -ACEITES_PARA_CONFIAR;

interface Registro {
  /** o que estava escrito */
  errado: string;
  /** o que ficou depois da correção */
  certo: string;
  /** placar: +1 por aceite, −2 por desfazer, −1 por recusar a sugestão */
  n: number;
}

let registros: Registro[] | null = null;
const ouvintes: (() => void)[] = [];

function carregar(): Registro[] {
  if (registros) return registros;
  try {
    const bruto = localStorage.getItem(KEY);
    const lista = bruto ? (JSON.parse(bruto) as Registro[]) : [];
    registros = Array.isArray(lista)
      ? lista
          .filter((r) => r && typeof r.errado === "string" && typeof r.certo === "string")
          .map((r) => ({ errado: r.errado, certo: r.certo, n: Number(r.n) || 0 }))
      : [];
  } catch {
    registros = [];
  }
  return registros;
}

function gravar(): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(registros ?? []));
  } catch {
    /* sem espaço: vale só nesta sessão */
  }
}

/** Avisa quem depende do aprendizado (o corretor) que a lista mudou. */
export function aoAprender(fn: () => void): void {
  ouvintes.push(fn);
}

function avisar(): void {
  for (const fn of ouvintes) fn();
}

/** Vale a pena aprender este par? Só troca de PALAVRA, não pontuação nem espaço. */
export function parAprendivel(errado: string, certo: string): boolean {
  if (!errado || !certo) return false;
  if (errado.toLowerCase() === certo.toLowerCase()) return false;
  // uma palavra de cada lado: "estenso" → "extenso" sim; ", mas" → não
  return /^[\p{L}'-]+$/u.test(errado) && /^[\p{L}'-]+$/u.test(certo);
}

function encontrar(errado: string, certo: string): Registro | undefined {
  const chave = errado.toLowerCase();
  const alvo = certo.toLowerCase();
  return carregar().find((r) => r.errado.toLowerCase() === chave && r.certo.toLowerCase() === alvo);
}

/** Ajusta o placar do par: aceite soma; recusa desconta, com piso. */
function ajustar(errado: string, certo: string, delta: number): void {
  if (!parAprendivel(errado, certo)) return;
  const lista = carregar();
  const existente = encontrar(errado, certo);
  if (existente) existente.n = Math.max(PISO, existente.n + delta);
  else lista.push({ errado, certo, n: Math.max(PISO, delta) });

  if (lista.length > LIMITE) {
    lista.sort((a, b) => a.n - b.n);
    lista.splice(0, lista.length - LIMITE);
  }
  gravar();
  avisar();
}

/** Registra que a pessoa aceitou trocar `errado` por `certo`. */
export function registrarCorrecao(errado: string, certo: string): void {
  ajustar(errado, certo, 1);
  registrarClasse(errado, certo, true);
}

/**
 * Registra que a pessoa DESFEZ (Ctrl+Z) uma correção que o app aplicou sozinho.
 * O par perde dois pontos do placar: se era confiável, volta a ser só sugestão.
 */
export function registrarRecusaAoDesfazer(errado: string, certo: string): void {
  ajustar(errado, certo, -PESO_DESFAZER);
  registrarClasse(errado, certo, false);
}

/**
 * Registra que a pessoa recusou uma sugestão de correção: o app propôs `palavra`
 * (o "certo") no lugar do que estava escrito (`contexto`) e ela seguiu escrevendo
 * outra coisa. O desconto é menor que o do desfazer — nada chegou a ser aplicado.
 */
export function registrarRecusaDeSugestao(palavra: string, contexto: string): void {
  ajustar(contexto, palavra, -PESO_RECUSAR_SUGESTAO);
  registrarClasse(contexto, palavra, false);
}

// ---------- veredito da correção automática (Ctrl+Z) ----------

/**
 * Trocas que a correção automática aplicou sozinha e ainda não tiveram veredito.
 * Fica só na memória: nada do documento vai para o armazenamento por causa disto.
 */
let aplicadasAuto: [string, string][] = [];

/**
 * Anota o que a correção automática acabou de aplicar sozinha (substitui a lista
 * anterior: se uma varredura nova começou sem mexer nessas trocas, elas ficaram de pé).
 */
export function marcarAplicadasAuto(pares: [string, string][]): void {
  aplicadasAuto = pares.filter(([errado, certo]) => parAprendivel(errado, certo));
}

/** Não há troca de palavra esperando veredito (a varredura não corrigiu palavras). */
export function limparAplicadasAuto(): void {
  aplicadasAuto = [];
}

/**
 * O texto voltou ao que era antes da varredura (Ctrl+Z): cada troca que ela aplicou
 * sozinha vira recusa. Devolve quantas foram descontadas.
 */
export function registrarDesfazerAplicadas(): number {
  const pares = aplicadasAuto;
  aplicadasAuto = [];
  for (const [errado, certo] of pares) registrarRecusaAoDesfazer(errado, certo);
  return pares.length;
}

/** Placar atual de um par (0 = desconhecido): para diagnóstico e testes. */
export function confiancaDoPar(errado: string, certo: string): number {
  return encontrar(errado, certo)?.n ?? 0;
}

/**
 * Pares em que já dá para confiar, do mais bem colocado para o menos.
 * É o que o corretor usa como correção conhecida, junto com os erros clássicos.
 */
export function correcoesConfiadas(): [string, string][] {
  return carregar()
    .filter((r) => r.n >= ACEITES_PARA_CONFIAR)
    .sort((a, b) => b.n - a.n)
    .map((r) => [r.errado, r.certo]);
}

/** Quantas trocas já foram aprendidas de verdade (as que estão no azul), para Configurações. */
export function totalAprendido(): number {
  return carregar().filter((r) => r.n >= 1).length;
}

/** Esquece tudo o que foi aprendido (pares, veredito pendente e contadores por classe). */
export function limparAprendizado(): void {
  registros = [];
  aplicadasAuto = [];
  limparClasses();
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* sem armazenamento */
  }
  avisar();
}
