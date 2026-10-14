// Aprendizado por CLASSE de erro: em vez de conhecer só o par exato
// ("estenso → extenso"), o corretor reconhece o TIPO de erro que a pessoa comete
// (letras trocadas de lugar, tecla vizinha, acento, dígrafo, letra que faltou…).
//
// Por que isso importa: o par exato demora a aparecer duas vezes; a classe aparece
// em dezenas de palavras diferentes desde a primeira sessão. Com contadores por
// classe — só números, nunca texto — o corretor pode subir a nota de um candidato
// cuja classe de erro é justamente a que a pessoa costuma aceitar, mesmo que aquele
// par nunca tenha sido visto antes.
//
// O módulo é puro na parte de classificação (dá para testar fora do navegador) e
// guarda os contadores em localStorage, no mesmo espírito do aprendizado dos pares
// (broker/aprendizado.ts): nada do documento é copiado, só as contagens.

export type ClasseErro =
  | "transposicao"
  | "tecla-vizinha"
  | "acento"
  | "digrafo"
  | "falta-letra"
  | "letra-a-mais"
  | "troca-simples"
  | "outra";

export interface Classificacao {
  classe: ClasseErro;
  /** plausibilidade de a classe ser a explicação do erro (0–1); ponto de partida calibrável */
  peso: number;
}

/**
 * Quanto cada classe é, de partida, uma explicação provável do erro.
 * São números de partida (norte: os erros de acento/cedilha são os mais comuns em
 * português; transposição e tecla vizinha são o "erro de dedo" típico; os demais
 * são menos frequentes). Não vêm do documento: são só pesos.
 */
export const PESOS_BASE: Record<ClasseErro, number> = {
  acento: 0.9,
  transposicao: 0.8,
  "tecla-vizinha": 0.75,
  digrafo: 0.7,
  "falta-letra": 0.6,
  "letra-a-mais": 0.55,
  "troca-simples": 0.5,
  outra: 0.25,
};

// ---------- teclado ABNT2 (posição física das teclas) ----------

/**
 * Fileiras do ABNT2 com o deslocamento de cada uma: é o que permite tratar como
 * vizinhas tanto as teclas da mesma fileira quanto as diagonais de cima/baixo
 * (o dedo que escorrega erra a tecla ao lado OU a de cima/baixo na diagonal).
 */
const FILEIRAS_ABNT2: { teclas: string; deslocamento: number }[] = [
  { teclas: "1234567890-=", deslocamento: 0 },
  { teclas: "qwertyuiop´[", deslocamento: 0.5 },
  { teclas: "asdfghjklç~]", deslocamento: 0.75 },
  { teclas: "zxcvbnm,.;/", deslocamento: 1 },
];

const POSICAO_TECLA = new Map<string, { fileira: number; x: number }>();
FILEIRAS_ABNT2.forEach((f, fileira) => {
  for (let i = 0; i < f.teclas.length; i++) {
    const t = f.teclas[i];
    if (!POSICAO_TECLA.has(t)) POSICAO_TECLA.set(t, { fileira, x: f.deslocamento + i });
  }
});

/** Duas teclas são vizinhas: mesma fileira lado a lado, ou diagonal imediata. */
function teclasVizinhas(a: string, b: string): boolean {
  const pa = POSICAO_TECLA.get(a);
  const pb = POSICAO_TECLA.get(b);
  if (!pa || !pb) return false;
  if (pa.fileira === pb.fileira) return Math.abs(pa.x - pb.x) === 1;
  if (Math.abs(pa.fileira - pb.fileira) !== 1) return false;
  return Math.abs(pa.x - pb.x) <= 1.05;
}

// ---------- formas normalizadas ----------

/** minúscula e sem acento/cedilha: é a forma usada para comparar a ESTRUTURA das palavras */
function semAcento(palavra: string): string {
  return palavra
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase();
}

/**
 * Forma "sonora" para o dígrafo: ss/sc/c/ç soam como s, ch soa como x.
 * É o que aproxima grafias concorrentes ("excessão"/"exceção", "chícara"/"xícara").
 */
function canonico(palavra: string): string {
  return semAcento(palavra)
    .replace(/ch/g, "x")
    .replace(/ss|sc|ç|c/g, "s");
}

/** Posições em que duas palavras de mesmo comprimento diferem. */
function diferencas(a: string, b: string): number[] {
  const out: number[] = [];
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) out.push(i);
  return out;
}

/** `curta` é `longa` sem uma letra (na ordem)? */
function ehSubsequencia(curta: string, longa: string): boolean {
  let i = 0;
  for (let j = 0; j < longa.length && i < curta.length; j++) if (longa[j] === curta[i]) i++;
  return i === curta.length;
}

/** O comprimento mínimo para classificar: erro de 1–2 letras em palavra curta é ruído. */
const MIN_LETRAS = 3;

/**
 * Classifica o par `errado → certo` na classe de erro que melhor o explica.
 * Devolve `null` quando não há o que classificar (palavras iguais, pontuação, texto).
 * A ordem das checagens vai do sinal mais específico para o mais genérico:
 * acento → dígrafo → transposição → tecla vizinha → letra faltando/sobrando → troca simples.
 */
export function classificarErro(errado: string, certo: string): Classificacao | null {
  const brutoE = errado.trim().toLowerCase();
  const brutoC = certo.trim().toLowerCase();
  if (!brutoE || !brutoC || brutoE === brutoC) return null;
  // Só troca de PALAVRA: número, sigla com pontuação e afins ficam de fora.
  if (!/^[\p{L}'-]+$/u.test(brutoE) || !/^[\p{L}'-]+$/u.test(brutoC)) return null;
  const e = semAcento(brutoE);
  const c = semAcento(brutoC);
  if (e.length < MIN_LETRAS || c.length < MIN_LETRAS) return null;

  const devolver = (classe: ClasseErro): Classificacao => ({ classe, peso: PESOS_BASE[classe] });

  // 1) só acento/cedilha (inclui acento na posição errada): a estrutura é a mesma.
  if (e === c) return devolver("acento");

  // 2) grafias concorrentes do mesmo som: ss/sc/c/ç e x/ch.
  if (canonico(errado) === canonico(certo)) return devolver("digrafo");

  // 3) letras vizinhas trocadas de lugar (a transposição clássica: "maneria" → "maneira").
  if (e.length === c.length) {
    for (let i = 0; i < e.length - 1; i++) {
      if (e[i] === e[i + 1]) continue;
      if (e.slice(0, i) + e[i + 1] + e[i] + e.slice(i + 2) === c) return devolver("transposicao");
    }
    // 4) uma tecla vizinha no lugar da outra ("casa" → "cada"): mesma estrutura, uma troca só.
    const dif = diferencas(e, c);
    if (dif.length === 1 && teclasVizinhas(e[dif[0]], c[dif[0]])) return devolver("tecla-vizinha");
  }

  // 5) falta de letra / 6) letra a mais: o menor é o maior sem uma letra.
  if (c.length === e.length + 1 && ehSubsequencia(e, c)) return devolver("falta-letra");
  if (e.length === c.length + 1 && ehSubsequencia(c, e)) return devolver("letra-a-mais");

  // 7) troca simples (uma ou mais letras, comprimento ~~igual, sem sinal de tecla vizinha).
  if (Math.abs(e.length - c.length) <= 1) return devolver("troca-simples");

  // Fora disso (palavra bem diferente), a classe não ajuda.
  return devolver("outra");
}

// ---------- contadores por classe (localStorage; só números) ----------

const KEY = "mdc.corretor.classes";

interface ContagemClasse {
  /** vezes que a pessoa aceitou uma correção desta classe */
  ok: number;
  /** vezes que desfez ou digitou por cima */
  nao: number;
}

type Contadores = Partial<Record<ClasseErro, ContagemClasse>>;

let cache: Contadores | null = null;

function armazem(): Storage | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}

function carregar(): Contadores {
  if (cache) return cache;
  const a = armazem();
  if (!a) return (cache = {});
  try {
    const bruto = a.getItem(KEY);
    cache = bruto ? (JSON.parse(bruto) as Contadores) : {};
  } catch {
    cache = {};
  }
  return cache;
}

function gravar(): void {
  const a = armazem();
  if (!a) return;
  try {
    a.setItem(KEY, JSON.stringify(cache ?? {}));
  } catch {
    /* sem espaço: vale só nesta sessão */
  }
}

/** Anota uma decisão (aceitou ou recusou) para a classe de erro do par. */
export function registrarClasse(errado: string, certo: string, aceitou: boolean): void {
  const r = classificarErro(errado, certo);
  if (!r) return;
  const contadores = carregar();
  const c = (contadores[r.classe] ??= { ok: 0, nao: 0 });
  if (aceitou) c.ok++;
  else c.nao++;
  gravar();
}

/** Fator pessoal da classe: 1 = neutro (sem histórico); 0,6 = recusa; 1,4 = aceita muito. */
function fatorPessoal(classe: ClasseErro): number {
  const c = carregar()[classe];
  if (!c) return 1;
  // média móvel suavizada (Laplace): poucas decisões ainda pesam pouco
  const taxa = (c.ok + 1) / (c.ok + c.nao + 2);
  return 0.6 + 0.8 * taxa;
}

/**
 * Multiplicador de confiança da classe para o usuário (0,6–1,4; 1 = sem histórico).
 * É o que o corretor usa para subir a nota de um candidato: uma classe que a pessoa
 * costuma aceitar vale mais que uma que ela vive recusando.
 */
export function pesoDaClasse(classe: ClasseErro): number {
  const peso = PESOS_BASE[classe] * fatorPessoal(classe);
  return Math.round(peso * 1000) / 1000;
}

/** Fator pessoal da classe (0,6–1,4; 1 = sem histórico), para diagnóstico. */
export function confiancaDaClasse(classe: ClasseErro): number {
  return Math.round(fatorPessoal(classe) * 1000) / 1000;
}

/** Bônus aditivo (0 ± BONUS_MAX) para pontuações por evidência (reordenação por contexto). */
export const BONUS_MAX = 0.03;

/**
 * Quanto a classe do par `errado → candidato` ajuda a promover o candidato.
 * Zero quando não há histórico da classe: um usuário novo não muda de comportamento.
 */
export function bonusDaClasse(errado: string, candidato: string): number {
  const r = classificarErro(errado, candidato);
  if (!r) return 0;
  const bonus = (BONUS_MAX * (fatorPessoal(r.classe) - 1)) / 0.4;
  return Math.round(bonus * 10000) / 10000;
}

/** Resumo por classe para Configurações/diagnóstico (só números). */
export function resumoClasses(): { classe: ClasseErro; ok: number; nao: number; peso: number }[] {
  const contadores = carregar();
  return (Object.keys(contadores) as ClasseErro[])
    .map((classe) => ({
      classe,
      ok: contadores[classe]!.ok,
      nao: contadores[classe]!.nao,
      peso: pesoDaClasse(classe),
    }))
    .sort((a, b) => b.ok + b.nao - (a.ok + a.nao));
}

/** Esquece os contadores por classe (Configurações: zerar o aprendizado). */
export function limparClasses(): void {
  cache = {};
  try {
    armazem()?.removeItem(KEY);
  } catch {
    /* sem armazenamento */
  }
}

// ---------- exportar/importar o aprendizado (F4) ----------

/** Os contadores por classe, para o arquivo de aprendizado (F4). */
export function dadosClasses(): Contadores {
  return JSON.parse(JSON.stringify(carregar())) as Contadores;
}

/** Repõe os contadores de um arquivo de aprendizado; devolve quantas classes entraram. */
export function restaurarClasses(dados: unknown): number {
  if (!dados || typeof dados !== "object") throw new Error("classes inválidas");
  const limpos: Contadores = {};
  for (const [k, v] of Object.entries(dados as Record<string, unknown>)) {
    const c = v as ContagemClasse | undefined;
    if (!c || typeof c !== "object") continue;
    limpos[k as ClasseErro] = { ok: Math.max(0, Number(c.ok) || 0), nao: Math.max(0, Number(c.nao) || 0) };
  }
  cache = limpos;
  gravar();
  return Object.keys(limpos).length;
}
