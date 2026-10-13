// Aprendizado do corretor: as correções que a pessoa aceita viram conhecimento do app.
//
// Responsabilidade: guardar o par "o que estava escrito → o que ficou depois de
// aceitar a correção" e devolver os pares em que já dá para confiar. É o que faz o
// corretor melhorar com o uso em vez de depender só de listas escritas à mão:
// uma troca que a pessoa aceita algumas vezes passa a ser aplicada sozinha, e um
// termo que ela recusa para de ser sugerido.
//
// Fica só neste computador (localStorage) e guarda NÚMEROS, não textos: cada par
// é uma linha curta com a contagem de aceites. Nada do documento é copiado.

const KEY = "mdc.corretor.aprendido";

/** Teto de pares guardados; os menos usados saem primeiro. */
const LIMITE = 3000;

/**
 * Quantas vezes a mesma troca precisa ser aceita para virar correção confiável
 * (aplicada sozinha). Duas é o mínimo que ainda separa "aceitei uma vez por
 * engano" de "esta troca é sempre certa para mim".
 */
export const ACEITES_PARA_CONFIAR = 2;

interface Registro {
  /** o que estava escrito */
  errado: string;
  /** o que ficou depois da correção */
  certo: string;
  /** quantas vezes a pessoa aceitou esta troca */
  n: number;
}

let registros: Registro[] | null = null;
const ouvintes: (() => void)[] = [];

function carregar(): Registro[] {
  if (registros) return registros;
  try {
    const bruto = localStorage.getItem(KEY);
    registros = bruto ? (JSON.parse(bruto) as Registro[]) : [];
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

/** Registra que a pessoa aceitou trocar `errado` por `certo`. */
export function registrarCorrecao(errado: string, certo: string): void {
  if (!parAprendivel(errado, certo)) return;
  const lista = carregar();
  const chave = errado.toLowerCase();
  const existente = lista.find((r) => r.errado.toLowerCase() === chave && r.certo.toLowerCase() === certo.toLowerCase());
  if (existente) existente.n++;
  else lista.push({ errado, certo, n: 1 });

  if (lista.length > LIMITE) {
    lista.sort((a, b) => a.n - b.n);
    lista.splice(0, lista.length - LIMITE);
  }
  gravar();
  avisar();
}

/**
 * Pares em que já dá para confiar, do mais aceito para o menos.
 * É o que o corretor usa como correção conhecida, junto com os erros clássicos.
 */
export function correcoesConfiadas(): [string, string][] {
  return carregar()
    .filter((r) => r.n >= ACEITES_PARA_CONFIAR)
    .sort((a, b) => b.n - a.n)
    .map((r) => [r.errado, r.certo]);
}

/** Quantas trocas já foram aprendidas (para mostrar em Configurações). */
export function totalAprendido(): number {
  return carregar().length;
}

/** Esquece tudo o que foi aprendido. */
export function limparAprendizado(): void {
  registros = [];
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* sem armazenamento */
  }
  avisar();
}
