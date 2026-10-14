// F0 da pesquisa de correção offline: mede o corretor ANTES de mexer no algoritmo.
//
// Uso:
//   node scripts/avaliar-correcao.mts [--json[=arquivo]] [--detalhe] [--classe=acento]
//          [--por-classe=30] [--paragrafos=40] [--seed=20261014] [--piores=5] [--sem-modelo]
//
// Conjuntos rotulados:
//   real      — os pares de `test/docs/gramatical.md` (o bloco "Esperado" é o gabarito);
//   sintético — erros por classe gerados a partir de parágrafos corretos de `docs/*.md`
//               (o texto original vira o gabarito);
//   corretos  — textos sem erro nenhum, usados só para medir falso positivo.
//
// Métricas (por classe e no total): detecção, recall@1/@3, precisão do 1º lugar,
// taxa de auto-aplicação, acerto do `best`, ms/palavra (p50/p95) e o payload que o
// worker carrega. Os falsos positivos por 1000 palavras vêm dos textos corretos.
//
// O comportamento do corretor NÃO é alterado: empacota os módulos com o esbuild (mesmo
// padrão de `scripts/testar-correcoes.mts`), monta o mínimo do navegador (self/fetch/
// Worker/localStorage) e roda o pipeline REAL — `checkText`, o mesmo do editor.
//
// É medição, não teste: o código de saída é sempre 0.
import fs from "node:fs";
import { execSync } from "node:child_process";
import { build, type Plugin } from "esbuild";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const raiz = new URL("..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const tmp = mkdtempSync(join(tmpdir(), "avaliar-correcao-"));

// ------------------------------------------------------------------ opções

interface Opcoes {
  json: boolean;
  jsonArquivo: string | null;
  detalhe: boolean;
  classe: string | null;
  porClasse: number;
  paragrafos: number;
  seed: number;
  piores: number;
  modelo: boolean;
}

function lerOpcoes(argv: string[]): Opcoes {
  const valor = (nome: string, padrao: number): number =>
    +(argv.find((a) => a.startsWith(`--${nome}=`))?.split("=")[1] ?? padrao);
  const jsonArg = argv.find((a) => a === "--json" || a.startsWith("--json="));
  return {
    json: !!jsonArg,
    jsonArquivo: jsonArg && jsonArg.startsWith("--json=") ? jsonArg.slice("--json=".length) : null,
    detalhe: argv.includes("--detalhe"),
    classe: argv.find((a) => a.startsWith("--classe="))?.split("=")[1] ?? null,
    porClasse: valor("por-classe", 30),
    paragrafos: valor("paragrafos", 120),
    seed: valor("seed", 20261014),
    piores: valor("piores", 5),
    modelo: !argv.includes("--sem-modelo"),
  };
}

const opcoes = lerOpcoes(process.argv.slice(2));

// ------------------------------------------------------------------ ambiente do navegador

type Ouvinte = (e: { data: unknown }) => void;
const ouvintesDoWorker: Ouvinte[] = [];
let workerAtual: { receber(msg: unknown): void } | null = null;

/** Cada arquivo lido pelo `fetch` (o do worker e o do thread principal). */
const buscados: { arquivo: string; bytes: number }[] = [];

/** Recria o mínimo que o corretor espera do navegador (worker, fetch, storage). */
function instalarAmbiente(): string {
  const g = globalThis as unknown as Record<string, unknown>;
  const base = pathToFileURL(join(raiz, "public") + "/").href;

  g.self = {
    addEventListener: (tipo: string, fn: Ouvinte) => {
      if (tipo === "message") ouvintesDoWorker.push(fn);
    },
    // a resposta do worker volta por aqui
    postMessage: (msg: unknown) => workerAtual?.receber(msg),
    location: { href: base },
  };

  // o worker busca o dicionário por URL: aqui lemos direto do disco
  g.fetch = async (url: unknown) => {
    // pode vir absoluta de raiz ("/ngrams/pt.json"): no app isso é a raiz de `public/`
    const alvo = String(url);
    const u = alvo.startsWith("/") ? new URL(alvo.slice(1), base) : new URL(alvo, base);
    const caminho = decodeURIComponent(u.pathname).replace(/^\/([A-Za-z]:)/, "$1");
    const conteudo = fs.readFileSync(caminho, "utf8");
    const nome = u.pathname.match(/(dicionario|ngrams)\/[^/]+$/)?.[0] ?? u.pathname;
    buscados.push({ arquivo: nome, bytes: Buffer.byteLength(conteudo) });
    return {
      ok: true,
      status: 200,
      text: async () => conteudo,
      json: async () => JSON.parse(conteudo) as unknown,
    };
  };

  g.document = { baseURI: base };

  // `new Worker(...)` vira uma conversa direta com o módulo já carregado
  g.Worker = class {
    private meus: Ouvinte[] = [];
    constructor() {
      workerAtual = this;
    }
    addEventListener(tipo: string, fn: Ouvinte): void {
      if (tipo === "message") this.meus.push(fn);
    }
    removeEventListener(): void {
      /* não usado */
    }
    postMessage(msg: unknown): void {
      for (const fn of ouvintesDoWorker) fn({ data: msg });
    }
    receber(msg: unknown): void {
      for (const fn of this.meus) fn({ data: msg });
    }
    terminate(): void {
      /* não usado */
    }
  };

  const memoria = new Map<string, string>();
  g.localStorage = {
    getItem: (k: string) => memoria.get(k) ?? null,
    setItem: (k: string, v: string) => void memoria.set(k, v),
    removeItem: (k: string) => void memoria.delete(k),
  };
  g.window = { setTimeout, clearTimeout, setInterval, clearInterval };
  return base;
}

// ------------------------------------------------------------------ números

const pct = (a: number, b: number): string => (b ? `${((100 * a) / b).toFixed(0)}%` : "—");
const dec = (x: number, casas = 2): string => x.toFixed(casas).replace(".", ",");
const inteiro = (n: number): string => n.toLocaleString("pt-BR");
const mb = (bytes: number): string => `${dec(bytes / 1024 / 1024, 1)} MB`;

/** Percentil pela posição (o conjunto é pequeno; não vale interpolar). */
function percentil(valores: number[], p: number): number {
  if (!valores.length) return 0;
  const ordenados = [...valores].sort((a, b) => a - b);
  const i = Math.min(ordenados.length - 1, Math.max(0, Math.ceil((p / 100) * ordenados.length) - 1));
  return ordenados[i];
}

/** Gerador determinístico (mesma semente = mesmo conjunto rotulado). */
function mulberry32(semente: number): () => number {
  let a = semente >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ------------------------------------------------------------------ palavras e classes

interface Token {
  t: string;
  from: number;
  to: number;
}

const RX_TOKEN = /[\p{L}][\p{L}'-]*/gu;

function tokenizar(texto: string): Token[] {
  const out: Token[] = [];
  let m: RegExpExecArray | null;
  RX_TOKEN.lastIndex = 0;
  while ((m = RX_TOKEN.exec(texto)) !== null) out.push({ t: m[0], from: m.index, to: m.index + m[0].length });
  return out;
}

/** Letra sem acento (e "ç" → "c"): é a base das comparações de classe. */
const semAcento = (w: string): string => w.normalize("NFD").replace(/[\u0300-\u036f]/g, "");

/** Levenshtein com corte: devolve `limite + 1` quando passa do limite. */
function distancia(a: string, b: string, limite = 4): number {
  if (Math.abs(a.length - b.length) > limite) return limite + 1;
  const anterior = new Array<number>(b.length + 1);
  const atual = new Array<number>(b.length + 1);
  for (let j = 0; j <= b.length; j++) anterior[j] = j;
  for (let i = 1; i <= a.length; i++) {
    atual[0] = i;
    let melhor = atual[0];
    for (let j = 1; j <= b.length; j++) {
      atual[j] = Math.min(anterior[j] + 1, atual[j - 1] + 1, anterior[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      if (atual[j] < melhor) melhor = atual[j];
    }
    if (melhor > limite) return limite + 1;
    for (let j = 0; j <= b.length; j++) anterior[j] = atual[j];
  }
  return anterior[b.length];
}

/** Uma confusão conhecida do português aplicada a UMA posição? Devolve a classe. */
const CONFUSOES: { de: string; para: string; classe: string }[] = [
  { de: "ss", para: "s", classe: "ss_s" },
  { de: "ch", para: "x", classe: "x_ch" },
  { de: "g", para: "j", classe: "g_j" },
  { de: "s", para: "ss", classe: "ss_s" },
  { de: "x", para: "ch", classe: "x_ch" },
  { de: "j", para: "g", classe: "g_j" },
];

function confusaoConhecida(a: string, b: string): string | null {
  for (const r of CONFUSOES) {
    for (let i = 0; i + r.de.length <= a.length; i++) {
      if (a.slice(i, i + r.de.length) === r.de && a.slice(0, i) + r.para + a.slice(i + r.de.length) === b) return r.classe;
    }
  }
  return null;
}

/** De que classe é o par (errado → gabarito)? `null` = não é erro de palavra. */
function classificarPar(errado: string, gabarito: string): string | null {
  const a = errado.toLowerCase();
  const b = gabarito.toLowerCase();
  if (a === b) return null; // só mudou a caixa
  const sa = semAcento(a);
  const sb = semAcento(b);
  if (sa === sb) return a.includes("ç") !== b.includes("ç") ? "cedilha" : "acento";
  if ([...sa].sort().join("") === [...sb].sort().join("") && sa !== sb) return "transposicao";
  const conf = confusaoConhecida(sa, sb);
  if (conf) return conf;
  if (a.length === b.length) return "letra_trocada";
  if (Math.abs(a.length - b.length) === 1) {
    const curto = a.length < b.length ? a : b;
    const longo = a.length < b.length ? b : a;
    if (distancia(curto, longo, 1) === 1) return a.length < b.length ? "letra_menos" : "letra_mais";
  }
  return "outra";
}

const ROTULO: Record<string, string> = {
  acento: "acento",
  cedilha: "c↔ç",
  ss_s: "s↔ss",
  x_ch: "x↔ch",
  g_j: "g↔j",
  transposicao: "transposição",
  letra_mais: "letra a mais",
  letra_menos: "letra a menos",
  tecla_vizinha: "tecla vizinha",
  letra_trocada: "letra trocada",
  outra: "outra",
};
const rotulo = (c: string): string => ROTULO[c] ?? c;

/** Classes geradas no conjunto sintético (as mesmas do plano do F0). */
const CLASSES_SINTETICAS = [
  "acento",
  "cedilha",
  "ss_s",
  "x_ch",
  "g_j",
  "transposicao",
  "letra_mais",
  "letra_menos",
  "tecla_vizinha",
];

/** Vizinhança das teclas no ABNT2 (só letras sem acento). */
const VIZINHAS: Record<string, string> = {
  q: "wa", w: "qeasd", e: "wrsdf", r: "etdfg", t: "ryfgh", y: "tughj", u: "yihjk", i: "uojkl",
  o: "ipkl", p: "ol", a: "qwsxz", s: "qweadzxc", d: "wersf xcv".replace(" ", ""), f: "ertdgc vb".replace(" ", ""),
  g: "rtyfhvbn", h: "tyugjbnm", j: "yuihkn m".replace(" ", ""), k: "uiojlm", l: "iopk",
  z: "asx", x: "asdzc", c: "sdfxv", v: "dfgcb", b: "fghvn", n: "ghjbm", m: "hjkn",
};

/** Aplica UMA corrupção da classe escolhida; `null` quando ela não cabe na palavra. */
function corromper(palavra: string, classe: string, rnd: () => number): string | null {
  const w = palavra;
  const posicoes = (pred: (i: number) => boolean): number[] => {
    const out: number[] = [];
    for (let i = 0; i < w.length; i++) if (pred(i)) out.push(i);
    return out;
  };
  const escolha = <T,>(lista: T[]): T | null => (lista.length ? lista[Math.floor(rnd() * lista.length) % lista.length] : null);

  switch (classe) {
    case "acento": {
      const nfd = [...w.normalize("NFD")];
      const marcas = nfd.map((c, i) => (/[\u0300-\u036f]/.test(c) ? i : -1)).filter((i) => i >= 0);
      const i = escolha(marcas);
      if (i === null) return null;
      return nfd.filter((_, j) => j !== i).join("").normalize("NFC");
    }
    case "cedilha": {
      if (w.includes("ç")) {
        const i = escolha(posicoes((i) => w[i] === "ç"));
        return i === null ? null : w.slice(0, i) + "c" + w.slice(i + 1);
      }
      const i = escolha(posicoes((i) => w[i] === "c" && i > 0));
      return i === null ? null : w.slice(0, i) + "ç" + w.slice(i + 1);
    }
    case "ss_s": {
      const duplos = posicoes((i) => w[i] === "s" && w[i + 1] === "s");
      if (duplos.length) {
        const i = escolha(duplos);
        return i === null ? null : w.slice(0, i) + "s" + w.slice(i + 2);
      }
      const simples = posicoes((i) => w[i] === "s" && w[i + 1] !== "s" && w[i - 1] !== "s" && i > 0);
      const i = escolha(simples);
      return i === null ? null : w.slice(0, i) + "ss" + w.slice(i + 1);
    }
    case "x_ch": {
      const digrafos = posicoes((i) => w[i] === "c" && w[i + 1] === "h");
      if (digrafos.length) {
        const i = escolha(digrafos);
        return i === null ? null : w.slice(0, i) + "x" + w.slice(i + 2);
      }
      const iguais = posicoes((i) => w[i] === "x");
      const i = escolha(iguais);
      return i === null ? null : w.slice(0, i) + "ch" + w.slice(i + 1);
    }
    case "g_j": {
      const gs = posicoes((i) => w[i] === "g");
      const js = posicoes((i) => w[i] === "j");
      const daVez = rnd() < 0.5 && gs.length ? gs : js.length ? js : gs;
      const i = escolha(daVez);
      if (i === null) return null;
      return w.slice(0, i) + (w[i] === "g" ? "j" : "g") + w.slice(i + 1);
    }
    case "transposicao": {
      const pares = posicoes((i) => w[i] !== w[i + 1] && i + 1 < w.length && /[a-z]/.test(w[i]) && /[a-z]/.test(w[i + 1]));
      const i = escolha(pares);
      if (i === null) return null;
      return w.slice(0, i) + w[i + 1] + w[i] + w.slice(i + 2);
    }
    case "letra_mais": {
      const i = Math.floor(rnd() * w.length) % w.length;
      return w.slice(0, i) + w[i] + w.slice(i);
    }
    case "letra_menos": {
      const i = Math.floor(rnd() * w.length) % w.length;
      const r = w.slice(0, i) + w.slice(i + 1);
      return r.length >= 4 ? r : null;
    }
    case "tecla_vizinha": {
      const i = escolha(posicoes((i) => !!VIZINHAS[w[i]]));
      if (i === null) return null;
      const destino = escolha([...VIZINHAS[w[i]]]);
      return destino === null ? null : w.slice(0, i) + destino + w.slice(i + 1);
    }
    default:
      return null;
  }
}

// ------------------------------------------------------------------ corpus real

interface Caso {
  numero: number;
  titulo: string;
  errado: string;
  esperado: string;
}

function lerCorpus(): Caso[] {
  const texto = fs.readFileSync(join(raiz, "test/docs/gramatical.md"), "utf8");
  const casos: Caso[] = [];
  for (const bloco of texto.split(/^## Caso /m).slice(1)) {
    const numero = +(bloco.match(/^(\d+)/)?.[1] ?? 0);
    const titulo = (bloco.match(/^\d+ — (.+)$/m)?.[1] ?? "").trim();
    const blocoDe = (rotulo: string): string | null => {
      const i = bloco.indexOf(`### ${rotulo}`);
      if (i < 0) return null;
      const m = bloco.slice(i).match(/````text\r?\n([\s\S]*?)\r?\n````/);
      return m ? m[1] : null;
    };
    const errado = blocoDe("Errado");
    const esperado = blocoDe("Esperado");
    if (errado === null || esperado === null) continue;
    casos.push({ numero, titulo, errado, esperado });
  }
  return casos;
}

type Passo =
  | { tipo: "igual"; antes: Token; depois: Token }
  | { tipo: "troca"; antes: Token; depois: Token }
  | { tipo: "so-antes"; antes: Token }
  | { tipo: "so-depois"; depois: Token };

/** Alinhamento por maior subsequência comum (textos curtos). */
function alinhar(a: Token[], b: Token[]): Passo[] {
  const n = a.length;
  const m = b.length;
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] = a[i].t === b[j].t ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  const passos: Passo[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i].t === b[j].t) {
      passos.push({ tipo: "igual", antes: a[i], depois: b[j] });
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      passos.push({ tipo: "so-antes", antes: a[i] });
      i++;
    } else {
      passos.push({ tipo: "so-depois", depois: b[j] });
      j++;
    }
  }
  while (i < n) passos.push({ tipo: "so-antes", antes: a[i++] });
  while (j < m) passos.push({ tipo: "so-depois", depois: b[j++] });

  // troca: um "so-antes" seguido de um "so-depois" (mesmo trecho reescrito)
  const juntos: Passo[] = [];
  for (let k = 0; k < passos.length; k++) {
    const p = passos[k];
    const q = passos[k + 1];
    if (p.tipo === "so-antes" && q?.tipo === "so-depois") {
      juntos.push({ tipo: "troca", antes: p.antes, depois: q.depois });
      k++;
      continue;
    }
    juntos.push(p);
  }
  return juntos;
}

/** Pares (palavra errada → gabarito) de um caso: só os que o corretor de palavra pode pegar. */
function paresDoCaso(caso: Caso): { token: Token; gabarito: string; classe: string }[] {
  const antes = tokenizar(caso.errado);
  const depois = tokenizar(caso.esperado);
  const out: { token: Token; gabarito: string; classe: string }[] = [];
  for (const passo of alinhar(antes, depois)) {
    if (passo.tipo !== "troca") continue;
    const errado = passo.antes.t;
    const gabarito = passo.depois.t;
    if (!/^[\p{L}]+$/u.test(errado) || !/^[\p{L}]+$/u.test(gabarito)) continue;
    if (errado.length < 3) continue; // o corretor só olha palavras de 3+ letras
    const d = distancia(semAcento(errado.toLowerCase()), semAcento(gabarito.toLowerCase()), 4);
    const limite = Math.max(2, Math.floor(Math.max(errado.length, gabarito.length) / 4));
    if (d > limite || d / Math.max(errado.length, gabarito.length) > 0.35) continue;
    const classe = classificarPar(errado, gabarito);
    if (!classe) continue;
    out.push({ token: passo.antes, gabarito, classe });
  }
  return out;
}

// ------------------------------------------------------------------ empacotamento

/**
 * Imports `...toml?raw` (recurso do Vite, usado pelas regras ABNT): o esbuild não
 * conhece o sufixo, então o conteúdo entra como texto — é o que o app recebe.
 */
const textoCru: Plugin = {
  name: "texto-cru",
  setup(api) {
    api.onResolve({ filter: /\?raw$/ }, (args) => {
      const relativo = args.path.replace(/\?raw$/, "");
      const base = args.importer ? dirname(args.importer) : raiz;
      return { path: resolve(base, relativo), namespace: "cru" };
    });
    api.onLoad({ filter: /.*/, namespace: "cru" }, (args) => ({
      contents: fs.readFileSync(args.path, "utf8"),
      loader: "text",
    }));
  },
};

// ------------------------------------------------------------------ main

interface Medida {
  conjunto: "real" | "sintetico";
  origem: string;
  classe: string;
  errado: string;
  gabarito: string;
  detectado: boolean;
  sugestoes: string[];
  auto: string | null;
  trecho: string;
  /** a forma escrita não é palavra do dicionário conhecida? (sem isso o corretor não pode ver) */
  flagavel: boolean;
}

interface Acumulado {
  n: number;
  detectado: number;
  r1: number;
  r3: number;
  comSugestao: number;
  prec1: number;
  auto: number;
  autoOk: number;
  autoErrado: number;
  flagavel: number;
  r3flag: number;
}

const vazio = (): Acumulado => ({
  n: 0,
  detectado: 0,
  r1: 0,
  r3: 0,
  comSugestao: 0,
  prec1: 0,
  auto: 0,
  autoOk: 0,
  autoErrado: 0,
  flagavel: 0,
  r3flag: 0,
});

function acumular(acc: Acumulado, m: Medida): void {
  acc.n++;
  if (m.flagavel) acc.flagavel++;
  if (!m.detectado) return;
  acc.detectado++;
  if (m.sugestoes.length) acc.comSugestao++;
  const g = m.gabarito.toLowerCase();
  const s1 = (m.sugestoes[0] ?? "").toLowerCase();
  if (m.sugestoes.slice(0, 3).some((s) => s.toLowerCase() === g)) {
    acc.r3++;
    if (m.flagavel) acc.r3flag++;
  }
  if (s1 === g) {
    acc.r1++;
    acc.prec1++;
  }
  if (m.auto) {
    acc.auto++;
    if (m.auto.toLowerCase() === g) acc.autoOk++;
    else acc.autoErrado++;
  }
}

async function main(): Promise<number> {
  console.log("Empacotando o corretor…");
  instalarAmbiente();
  const entrada = join(tmp, "junto.ts");
  const caminho = (p: string) => join(raiz, p).replace(/\\/g, "/");
  fs.writeFileSync(
    entrada,
    `export { checkText } from "${caminho("src/broker/check.ts")}";\n` +
      `export { checkWords, warmUpSpell, onSpellReady, spellIsReady } from "${caminho("src/broker/spell.ts")}";\n` +
      `export { maskNonProse } from "${caminho("src/broker/mask.ts")}";\n` +
      `export { loadLanguageModel } from "${caminho("src/broker/ghost/model.ts")}";\n`
  );
  const saida = join(tmp, "junto.mjs");
  await build({ entryPoints: [entrada], bundle: true, platform: "node", format: "esm", outfile: saida, logLevel: "error", plugins: [textoCru] });
  // O worker é um contexto à parte, como no navegador: precisa do próprio pacote,
  // importado aqui só para registrar os ouvintes de `self`.
  await build({
    entryPoints: [join(raiz, "src/broker/spell.worker.ts")],
    bundle: true,
    platform: "node",
    format: "esm",
    outfile: join(tmp, "worker.mjs"),
    logLevel: "error",
    plugins: [textoCru],
  });
  await import(pathToFileURL(join(tmp, "worker.mjs")).href);
  const M = await import(pathToFileURL(saida).href);

  const checkText = M.checkText as (t: string, ignore: Set<string>) => Promise<WritingIssue[]>;
  const checkWords = M.checkWords as (w: string[], ctx?: Record<string, string>) => Promise<Map<string, SpellHit>>;
  const maskNonProse = M.maskNonProse as (t: string) => string;

  // dicionário carregado de verdade (o worker é o mesmo do app)
  const tDicionario = performance.now();
  M.warmUpSpell();
  await new Promise<void>((resolve) => {
    const prazo = setTimeout(resolve, 90_000);
    M.onSpellReady(() => {
      clearTimeout(prazo);
      resolve();
    });
  });
  const msDicionario = performance.now() - tDicionario;
  if (!M.spellIsReady()) console.log("AVISO: o dicionário não carregou — a medição só vai contabilizar as regras de estilo.");

  if (opcoes.modelo) {
    // como o app faz no início: sem o modelo, `rerankSuggestions` fica desligado
    try {
      await M.loadLanguageModel();
    } catch {
      /* sem modelo: mede o caminho do dicionário apenas */
    }
  }

  // ---------------------------------------------------------------- medidas

  const medidas: Medida[] = [];
  const medirTempos: number[] = [];
  const fpTextos: { texto: string; palavras: number }[] = [];

  const verificar = async (texto: string): Promise<WritingIssue[]> => {
    const t0 = performance.now();
    const issues = await checkText(texto, new Set());
    const palavras = tokenizar(texto).length;
    if (palavras) medirTempos.push((performance.now() - t0) / palavras);
    return issues;
  };

  const escolherIssue = (issues: WritingIssue[], errado: string, from: number, to: number): WritingIssue | null =>
    issues.find((i) => i.word.toLowerCase() === errado.toLowerCase() && i.from === from && i.to === to) ??
    issues.find((i) => i.from < to && i.to > from && i.kind === "spell") ??
    null;

  const trechoMarcado = (texto: string, from: number, to: number): string =>
    (texto.slice(Math.max(0, from - 40), from) + "«" + texto.slice(from, to) + "»" + texto.slice(to, to + 40))
      .replace(/\s+/g, " ")
      .trim();

  // falsos positivos (palavra correta sinalizada). Duas fontes: textos corretos por
  // definição (o "Esperado" do corpus) e o resto dos textos corrompidos — já que o
  // parágrafo estava limpo antes do erro injetado. Só entra na conta o que recai
  // sobre palavra que EXISTE (ou sobre palavra desconhecida em texto conferido);
  // termo técnico acusado num parágrafo corrompido fica medido à parte, porque
  // confundir "palavra que o dicionário não tem" com "falso positivo" é o próprio
  // problema que o F4 vai atacar.
  let fpPalavras = 0;
  let fpExisteCorreto = 0;
  let fpDesconhecidaCorreto = 0;
  let fpExisteCorrompido = 0;
  let fpDesconhecidaForaDoErro = 0;
  let fpNeighborCorreto = 0;
  let fpNeighborCorrompido = 0;
  let fpCorrompidoPalavras = 0;
  const fpExemplos: string[] = [];

  // ---------------------------------------------------------------- conjunto real

  const casos = lerCorpus();
  const doFiltro = (c: string): boolean => !opcoes.classe || opcoes.classe === c;

  for (const caso of casos) {
    const pares = paresDoCaso(caso).filter((p) => doFiltro(p.classe));
    const issues = await verificar(caso.errado);
    for (const par of pares) {
      const issue = escolherIssue(issues, par.token.t, par.token.from, par.token.to);
      medidas.push({
        conjunto: "real",
        origem: `Caso ${String(caso.numero).padStart(2, "0")} — ${caso.titulo}`,
        classe: par.classe,
        errado: par.token.t,
        gabarito: par.gabarito,
        detectado: !!issue,
        sugestoes: issue?.suggestions ?? [],
        auto: issue?.auto ?? null,
        trecho: trechoMarcado(caso.errado, par.token.from, par.token.to),
        flagavel: true, // par real: não passa pelo filtro de visibilidade
      });
    }
    fpTextos.push({ texto: caso.esperado, palavras: tokenizar(caso.esperado).length });
  }

  // ---------------------------------------------------------------- conjunto sintético

  const rnd = mulberry32(opcoes.seed);
  const pool: { texto: string; tokens: Token[]; jaSinalizadas: Set<string> }[] = [];

  if (opcoes.porClasse > 0 && opcoes.paragrafos > 0) {
    const arquivos = fs
      .readdirSync(join(raiz, "docs"))
      .filter((f) => f.endsWith(".md"))
      // documentos de medição são instrumento, não corpus: se entrassem na conta, o
      // conjunto mudaria a cada fase (e a linha de base deixaria de ser comparável)
      .filter((f) => !/^medicao-/.test(f))
      .sort()
      .map((f) => join(raiz, "docs", f));
    arquivos.push(join(raiz, "README.md"));

    const candidatos: { texto: string; tokens: Token[] }[] = [];
    for (const arquivo of arquivos) {
      const linhas = fs.readFileSync(arquivo, "utf8").split(/\r?\n/);
      for (const bloco of linhas.join("\n").split(/\n\s*\n/)) {
        const texto = bloco.trim();
        if (texto.length < 60 || texto.length > 600) continue;
        if (/^(#|\||>|[-*]\s|\d+\.)/.test(texto)) continue;
        if (texto.includes("```") || texto.includes("|")) continue;
        const mascara = maskNonProse(texto);
        const tokens = tokenizar(texto).filter(
          (t) => /^[a-záàâãéêíóôõúç]{5,}$/u.test(t.t) && mascara.slice(t.from, t.to) === t.t
        );
        if (tokens.length >= 8) candidatos.push({ texto, tokens });
      }
    }
    // embaralha (com a semente) para espalhar os parágrafos entre os arquivos
    for (let i = candidatos.length - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1)) % (i + 1);
      [candidatos[i], candidatos[j]] = [candidatos[j], candidatos[i]];
    }

    for (const c of candidatos) {
      if (pool.length >= opcoes.paragrafos) break;
      const issues = await verificar(c.texto);
      const sujeira = issues.filter((i) => i.kind === "spell");
      // parágrafo com muita coisa acusada não serve de base: o "correto" precisa
      // ser verificável. As poucas acusadas ficam de fora dos falsos positivos.
      if (sujeira.length > 3) continue;
      pool.push({ ...c, jaSinalizadas: new Set(sujeira.map((i) => i.word.toLowerCase())) });
    }

    const paragrafosContados = new Set<string>();
    let indice = 0;
    for (const classe of CLASSES_SINTETICAS) {
      // gerador POR CLASSE: o conjunto de uma classe não depende de quais outras
      // rodaram, então `--classe=xx` mostra exatamente os mesmos casos da tabela cheia
      const rndClasse = mulberry32(opcoes.seed + 1013 * indice);
      indice++;
      if (opcoes.classe && opcoes.classe !== classe) continue;
      const usados = new Set<string>();      let feitos = 0;
      let tentativas = 0;
      while (feitos < opcoes.porClasse && tentativas < opcoes.porClasse * 60) {
        tentativas++;
        const par = pool[Math.floor(rndClasse() * pool.length) % pool.length];
        if (!par) break;
        const tok = par.tokens[Math.floor(rndClasse() * par.tokens.length) % par.tokens.length];
        const chave = `${par.texto.length}:${tok.from}`;
        if (usados.has(chave)) continue;
        const errada = corromper(tok.t, classe, rndClasse);
        if (!errada || errada === tok.t) continue;
        usados.add(chave);
        feitos++;
        const corrompido = par.texto.slice(0, tok.from) + errada + par.texto.slice(tok.to);
        const issues = await verificar(corrompido);
        const fim = tok.from + errada.length;
        const issue = escolherIssue(issues, errada, tok.from, fim);
        // Falso positivo: o corretor acusa uma palavra FORA do erro injetado que ele
        // não acusava antes da corrupção. Cada parágrafo conta uma vez só (a mesma
        // palavra em 9 corrupções diferentes é uma sinalização, não nove).
        if (!paragrafosContados.has(par.texto)) {
          paragrafosContados.add(par.texto);
          fpCorrompidoPalavras += tokenizar(corrompido).length;
          for (const i of issues) {
            if (i.from < fim && i.to > tok.from) continue;
            if (par.jaSinalizadas.has(i.word.toLowerCase())) continue;
            if (i.kind === "spell") {
              if (i.message.includes("existe")) fpExisteCorrompido++;
              else fpDesconhecidaForaDoErro++;
              if (fpExemplos.length < 12 && !fpExemplos.some((e) => e.toLowerCase().includes(i.word.toLowerCase()))) {
                fpExemplos.push(`${JSON.stringify(i.word)} → ${i.suggestions.slice(0, 2).join(", ")}`);
              }
            } else if (/você quis dizer/.test(i.message)) {
              fpNeighborCorrompido++;
              if (fpExemplos.length < 12 && !fpExemplos.some((e) => e.toLowerCase().includes(i.word.toLowerCase()))) {
                fpExemplos.push(`${JSON.stringify(i.word)} (existente) → ${i.suggestions.slice(0, 2).join(", ")}`);
              }
            }          }
        }
        medidas.push({
          conjunto: "sintetico",
          origem: `parágrafo de docs (${classe})`,
          classe,
          errado: errada, // o que ficou escrito no lugar da palavra certa
          gabarito: tok.t, // o texto original é o gabarito
          detectado: !!issue,
          sugestoes: issue?.suggestions ?? [],
          auto: issue?.auto ?? null,
          trecho: trechoMarcado(corrompido, tok.from, fim),
          flagavel: true, // refinado depois, com uma consulta em lote ao dicionário
        });
      }
      if (!opcoes.classe || opcoes.classe === classe) {
        console.log(`  sintético ${rotulo(classe).padEnd(13)} ${feitos} casos`);
      }
    }
  }

  // ---------------------------------------------------------------- falsos positivos

  for (const { texto, palavras } of fpTextos) {
    const issues = await verificar(texto);
    fpPalavras += palavras;
    for (const i of issues) {
      const exemplo = (rotulo: string) =>
        fpExemplos.length < 12 && !fpExemplos.some((e) => e.toLowerCase().includes(i.word.toLowerCase()))
          ? fpExemplos.push(`${JSON.stringify(i.word)}${rotulo} → ${i.suggestions.slice(0, 2).join(", ")}`)
          : 0;
      if (i.kind === "spell") {
        if (i.message.includes("existe")) fpExisteCorreto++;
        else fpDesconhecidaCorreto++;
        exemplo("");
      } else if (/você quis dizer/.test(i.message)) {
        fpNeighborCorreto++;
        exemplo(" (existente)");
      }
    }
  }
  fpPalavras += fpCorrompidoPalavras;
  const fpNeighbor = fpNeighborCorreto + fpNeighborCorrompido;
  const fpExiste = fpExisteCorreto + fpExisteCorrompido + fpNeighbor;
  const fpTotal = fpExiste + fpDesconhecidaCorreto;

  // ---------------------------------------------------------------- o corretor consegue ver o erro?

  // Se a forma errada AINDA é palavra do dicionário, não há o que o corretor de
  // ortografia faça (é o caso do F3): separa esses casos do recall "possível".
  const sinteticos = medidas.filter((m) => m.conjunto === "sintetico");
  const corrompidas = [...new Set(sinteticos.map((m) => m.errado))];
  if (corrompidas.length) {
    const conhecidas = await checkWords(corrompidas);
    for (const m of sinteticos) m.flagavel = conhecidas.has(m.errado);
  }

  // ---------------------------------------------------------------- worker (lote)

  const vocabulario = [...new Set(pool.flatMap((p) => p.tokens.map((t) => t.t)))];
  let msLote = 0;
  if (vocabulario.length) {
    const t0 = performance.now();
    await checkWords(vocabulario);
    msLote = performance.now() - t0;
  }

  // ---------------------------------------------------------------- agregação

  const porClasse = new Map<string, Acumulado>();
  const porConjunto = new Map<string, Acumulado>();
  const total = vazio();
  for (const m of medidas) {
    const acc = porClasse.get(m.classe) ?? vazio();
    acumular(acc, m);
    porClasse.set(m.classe, acc);
    const accC = porConjunto.get(m.conjunto) ?? vazio();
    acumular(accC, m);
    porConjunto.set(m.conjunto, accC);
    acumular(total, m);
  }

  const gravidade = (m: Medida): number =>
    m.detectado ? (m.auto && m.auto.toLowerCase() !== m.gabarito.toLowerCase() ? 1 : 2) : 0;
  const naoPrimeiro = medidas.filter((m) => !(m.sugestoes[0] ?? "").toLowerCase().startsWith(m.gabarito.toLowerCase()));
  // os reais primeiro (é a regressão: não pode piorar) e, depois, um caso por classe,
  // para a lista mostrar fenômenos diferentes em vez de nove vezes o mesmo erro
  const pioresReais = naoPrimeiro.filter((m) => m.conjunto === "real").sort((a, b) => gravidade(a) - gravidade(b));
  const classesVistas = new Set(pioresReais.map((m) => m.classe));
  const pioresSinteticos: Medida[] = [];
  for (const m of naoPrimeiro.filter((m) => m.conjunto === "sintetico").sort((a, b) => gravidade(a) - gravidade(b) || a.classe.localeCompare(b.classe))) {
    if (classesVistas.has(m.classe)) continue;
    classesVistas.add(m.classe);
    pioresSinteticos.push(m);
  }
  const piores = [...pioresReais, ...pioresSinteticos].slice(0, opcoes.piores);
  // lista separada: casos em que o gabarito ESTÁ na lista de sugestões, mas não em 1º —
  // é o alvo direto do F1 (candidato certo existe, ranking escolhe outro)
  const pioresRanking = naoPrimeiro
    .filter((m) => m.sugestoes.some((s) => s.toLowerCase() === m.gabarito.toLowerCase()))
    .sort((a, b) => (a.auto ? 0 : 1) - (b.auto ? 0 : 1) || a.classe.localeCompare(b.classe))
    .filter((m, i, todos) => todos.findIndex((x) => x.classe === m.classe && x.errado === m.errado) === i)
    .slice(0, opcoes.piores);

  // ---------------------------------------------------------------- payload

  const doWorker = new Set(["dicionario/pt_BR.aff", "dicionario/pt_BR.dic", "ngrams/freq-pt.json", "ngrams/ctx-pt.json"]);
  const unicos = new Map<string, number>();
  for (const b of buscados) if (!unicos.has(b.arquivo)) unicos.set(b.arquivo, b.bytes);
  const payload = [...unicos.entries()].filter(([f]) => doWorker.has(f)).map(([arquivo, bytes]) => ({ arquivo, bytes }));
  const fora = [...unicos.entries()].filter(([f]) => !doWorker.has(f)).map(([arquivo, bytes]) => ({ arquivo, bytes }));
  const payloadBytes = payload.reduce((s, f) => s + f.bytes, 0);

  const tempos = {
    textos: medirTempos.length,
    p50: percentil(medirTempos, 50),
    p95: percentil(medirTempos, 95),
    loteMs: msLote,
    lotePorPalavra: vocabulario.length ? msLote / vocabulario.length : 0,
  };

  let commit = "";
  try {
    commit = execSync("git rev-parse --short HEAD", { cwd: raiz }).toString().trim();
  } catch {
    /* sem git: segue sem o commit */
  }

  const autoErradosExemplos = medidas
    .filter((m) => m.auto && m.auto.toLowerCase() !== m.gabarito.toLowerCase())
    .filter((m, i, todos) => todos.findIndex((x) => x.classe === m.classe && x.errado === m.errado) === i)
    .slice(0, 10)
    .map((m) => ({ classe: m.classe, conjunto: m.conjunto, errado: m.errado, gabarito: m.gabarito, auto: m.auto, trecho: m.trecho }));

  const resultado = {
    gerado: new Date().toISOString(),
    commit,
    seed: opcoes.seed,
    modeloDeIdioma: opcoes.modelo,
    dicionario: { carregou: !!M.spellIsReady(), ms: Math.round(msDicionario) },
    payloadWorker: { bytes: payloadBytes, arquivos: payload, foraDoWorker: fora },
    desempenho: tempos,
    conjuntos: {
      real: { textos: casos.length, casos: medidas.filter((m) => m.conjunto === "real").length },
      sintetico: { casos: medidas.filter((m) => m.conjunto === "sintetico").length, paragrafos: pool.length },
      corretos: { textos: fpTextos.length, palavras: fpPalavras - fpCorrompidoPalavras },
    },    falsosPositivos: {
      palavras: fpPalavras,
      sinalizadas: fpTotal,
      por1000: fpPalavras ? (1000 * fpTotal) / fpPalavras : 0,
      palavraExistente: fpExiste,
      neighbor: fpNeighbor,
      acentoOuColagem: fpExisteCorreto + fpExisteCorrompido,
      desconhecidaEmTextoCorreto: fpDesconhecidaCorreto,
      desconhecidaForaDoErroInjetado: fpDesconhecidaForaDoErro,
      emTextosCorretos: { palavras: fpPalavras - fpCorrompidoPalavras, sinalizadas: fpExisteCorreto + fpDesconhecidaCorreto + fpNeighborCorreto },
      emTextosCorrompidos: { palavras: fpCorrompidoPalavras, sinalizadas: fpExisteCorrompido + fpNeighborCorrompido },
      exemplos: fpExemplos,
    },
    conjunto: Object.fromEntries(porConjunto),
    classes: Object.fromEntries([...porClasse.entries()].sort((a, b) => b[1].n - a[1].n)),
    total,
    autoErrados: autoErradosExemplos,    piores: piores.map((m) => ({ conjunto: m.conjunto, classe: m.classe, errado: m.errado, gabarito: m.gabarito, detectado: m.detectado, visivel: m.flagavel, sugestoes: m.sugestoes.slice(0, 3), auto: m.auto, trecho: m.trecho })),
    pioresRanking: pioresRanking.map((m) => ({ conjunto: m.conjunto, classe: m.classe, errado: m.errado, gabarito: m.gabarito, sugestoes: m.sugestoes.slice(0, 3), auto: m.auto, trecho: m.trecho })),
  };

  // ---------------------------------------------------------------- saída

  const linhas: string[] = [];
  linhas.push("");
  linhas.push(`== avaliar-correcao (F0) — ${new Date().toLocaleDateString("pt-BR")} — commit ${commit || "?"} — semente ${opcoes.seed} ==`);
  linhas.push(
    `dicionário: ${M.spellIsReady() ? `pronto em ${dec(msDicionario / 1000)} s` : "NÃO CARREGOU"} · ` +
      `modelo de idioma: ${opcoes.modelo ? "ligado" : "desligado"} · ` +
      `payload do worker: ${mb(payloadBytes)}` +
      (payload.length ? ` (${payload.map((f) => `${f.arquivo.split("/").pop()} ${mb(f.bytes)}`).join(" · ")})` : "")
  );
  if (fora.length) linhas.push(`fora do worker: ${fora.map((f) => `${f.arquivo.split("/").pop()} ${mb(f.bytes)}`).join(" · ")}`);
  linhas.push(
    `conjuntos: real ${resultado.conjuntos.real.casos} erros em ${resultado.conjuntos.real.textos} casos · ` +
      `sintético ${resultado.conjuntos.sintetico.casos} erros em ${pool.length} parágrafos · ` +
      `falsos positivos medidos em ${inteiro(fpPalavras)} palavras de ${fpTextos.length} textos corretos + ${pool.length} corrompidos`
  );
  if (opcoes.classe) linhas.push(`filtro de classe: ${rotulo(opcoes.classe)}`);

  const cabecalho = ["classe", "n", "det%", "r@1", "r@3", "prec1", "auto%", "auto✓%", "visível", "r@3†"];
  const larguras = [16, 5, 6, 6, 6, 7, 7, 7, 8, 6];
  const linha = (c: string[]): string => c.map((v, i) => v.padEnd(larguras[i])).join(" ");
  const escreverLinha = (nome: string, a: Acumulado): void => {
    linhas.push(
      linha([
        nome.slice(0, 16),
        String(a.n),
        pct(a.detectado, a.n),
        pct(a.r1, a.n),
        pct(a.r3, a.n),
        pct(a.prec1, a.comSugestao),
        pct(a.auto, a.n),
        pct(a.autoOk, a.auto),
        pct(a.flagavel, a.n),
        pct(a.r3flag, a.flagavel),
      ])
    );
  };
  linhas.push("");
  linhas.push("por conjunto");
  linhas.push(linha(cabecalho));
  for (const nome of ["real", "sintetico"]) {
    const acc = porConjunto.get(nome);
    if (acc) escreverLinha(nome === "real" ? "real (gramatical)" : "sintético", acc);
  }
  escreverLinha("TOTAL", total);

  linhas.push("");
  linhas.push("por classe");
  linhas.push(linha(cabecalho));
  for (const [classe, acc] of [...porClasse.entries()].sort((a, b) => b[1].n - a[1].n)) escreverLinha(rotulo(classe), acc);
  escreverLinha("TOTAL", total);

  linhas.push("");
  linhas.push(
    `falsos positivos: ${dec(fpPalavras ? (1000 * fpTotal) / fpPalavras : 0)} por 1000 palavras ` +
      `(${fpTotal} em ${inteiro(fpPalavras)} palavras · ${fpTextos.length} textos corretos + ${pool.length} com 1 erro injetado)`
  );
  linhas.push(
    `  palavra que existe questionada: ${fpExiste} ("você quis dizer": ${fpNeighbor} · acento/colagem: ${fpExisteCorreto + fpExisteCorrompido}) · ` +
      `desconhecida em texto conferido: ${fpDesconhecidaCorreto} · desconhecida fora do erro injetado: ${fpDesconhecidaForaDoErro} (termo técnico?)`
  );
  linhas.push(
    `auto-aplicação: ${total.auto} de ${total.n} (${pct(total.auto, total.n)}); acerto do \`best\`: ${pct(total.autoOk, total.auto)}` +
      ` · auto ≠ gabarito: ${total.autoErrado}` +
      (total.autoErrado ? "  <<< aplicar sozinho trocaria a palavra ERRADA" : "")
  );
  linhas.push(
    `ms/palavra (pipeline): p50 ${dec(tempos.p50, 3)} · p95 ${dec(tempos.p95, 3)} · ` +
      `worker em lote (${vocabulario.length} palavras): ${dec(tempos.lotePorPalavra, 4)}`
  );
  linhas.push("† r@3 só entre os erros que o corretor podia ver (a forma escrita não é palavra do dicionário)");
  if (fpExemplos.length) linhas.push(`falsos positivos (exemplos): ${fpExemplos.slice(0, 6).join(" · ")}`);

  if (piores.length) {
    linhas.push("");
    linhas.push(`piores casos (${piores.length}) — erro invisível, auto-aplicado errado ou fora do 1º lugar:`);
    for (const m of piores) {
      linhas.push(
        `  [${m.conjunto}] ${rotulo(m.classe)} · ${JSON.stringify(m.errado)} → ${JSON.stringify(m.gabarito)} · ` +
          `detectado: ${m.detectado ? "sim" : "não"}${m.flagavel ? "" : " (a forma escrita é palavra do dicionário)"} · ` +
          `sugestões: ${m.sugestoes.slice(0, 3).map((s) => JSON.stringify(s)).join(", ") || "—"}` +
          (m.auto ? ` · auto: ${JSON.stringify(m.auto)}` : "")
      );
      linhas.push(`        …${m.trecho}…`);
    }
  }
  if (pioresRanking.length) {
    linhas.push("");
    linhas.push(`piores de RANKING (${pioresRanking.length}) — o gabarito está na lista, mas não em 1º (alvo do F1):`);
    for (const m of pioresRanking) {
      linhas.push(
        `  [${m.conjunto}] ${rotulo(m.classe)} · ${JSON.stringify(m.errado)} → ${JSON.stringify(m.gabarito)} · ` +
          `1ª: ${JSON.stringify(m.sugestoes[0] ?? "—")}` + (m.auto ? ` · auto: ${JSON.stringify(m.auto)} (ERRADO)` : "")
      );
    }
  }

  const relatorio = linhas.join("\n");
  if (opcoes.jsonArquivo) fs.writeFileSync(opcoes.jsonArquivo, JSON.stringify(resultado, null, 2) + "\n", "utf8");
  if (opcoes.json && !opcoes.jsonArquivo) console.log(JSON.stringify(resultado, null, 2));
  else {
    console.log(relatorio);
    if (opcoes.jsonArquivo) console.log(`\nJSON: ${opcoes.jsonArquivo}`);
    if (opcoes.detalhe) {
      console.log("\npor caso:");
      for (const m of medidas) {
        console.log(
          `  ${m.conjunto.padEnd(9)} ${rotulo(m.classe).padEnd(14)} ${JSON.stringify(m.errado)} → ${JSON.stringify(m.gabarito)} ` +
            `det=${m.detectado ? "s" : "n"} ${m.sugestoes.slice(0, 3).map((s) => JSON.stringify(s)).join(",")}` +
            (m.auto ? ` auto=${JSON.stringify(m.auto)}` : "") +
            `  [${m.origem}]`
        );
      }
    }
  }
  return 0;
}

// ------------------------------------------------------------------ tipos do corretor

interface WritingIssue {
  from: number;
  to: number;
  word: string;
  kind: string;
  message: string;
  suggestions: string[];
  fix?: string;
  safe?: boolean;
  auto?: string;
}

interface SpellHit {
  word: string;
  suggestions: string[];
  best?: string;
}

main().catch((err: unknown) => {
  console.error("A medição falhou (o código de saída continua 0):", err);
});
