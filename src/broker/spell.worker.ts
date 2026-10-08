// Worker do corretor: carrega o dicionário pt-BR e responde as palavras erradas.
// Fica separado para a interface não travar durante o carregamento (~alguns segundos).
//
// Sugestões: monta um índice com as RAIZES do .dic + as formas frequentes da língua,
// compara por similaridade (bigramas + maior subsequência comum), testa as variantes de
// acento direto no dicionário e desempata pela frequência. Assim "responsavo" vira
// "responsável" (e não "responsado", que é flexão, nem "responsivo", que é só parecido),
// "improtante" vira "importante" e "otima" vira "ótima" — tudo isso em poucos milissegundos.
import Typo from "typo-js";
import { FREQUENTES, PALAVRAS_LISTA } from "./palavras";

interface SpellHit {
  word: string;
  suggestions: string[];
  /** faltou espaço entre palavras (ex.: “coisasque” → “coisas que”) */
  glued?: boolean;
  /** correção em que dá para confiar (aplicada sozinha pela correção automática) */
  best?: string;
}

type TypoLike = {
  check(w: string): boolean;
};

let typo: TypoLike | null = null;
let dicTexto: string | null = null;

/** Palavras estrangeiras/técnicas já usadas em português: não são erro de escrita. */
const PALAVRAS_OK = new Set([
  "app", "apps", "site", "sites", "online", "offline", "e-mail", "email", "emails",
  "link", "links", "blog", "blogs", "vlog", "podcast", "podcasts", "streaming", "startup",
  "startups", "software", "hardware", "mouse", "notebook", "laptop", "tablet", "smartphone",
  "download", "downloads", "upload", "cloud", "chip", "chips", "drone", "drones", "gamer",
  "game", "games", "playlist", "playlists", "backup", "backups", "print", "prints",
  "screenshot", "screenshots", "login", "logout", "checkout", "delivery", "pet", "pets",
  "kit", "kits", "briefing", "feedback", "deadline", "insight", "insights", "setup", "budget",
  "budgets", "case", "cases", "workshop", "workshops", "webinar", "webinars", "newsletter",
  "newsletters", "coaching", "mentoring", "coworking", "home-office", "design", "designer",
  "designers", "marketing", "banner", "banners", "ebook", "e-book", "selfie", "deploy", "bug",
  "bugs", "to-do", "know-how", "ok", "okay", "top",
]);

const norm = (s: string) => s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();

/** Mantém a maiúscula do começo quando a sugestão é minúscula. */
function ajustarCaixa(original: string, sugestao: string): string {
  const maiuscula =
    original[0] !== undefined && original[0] === original[0].toUpperCase() && original[0] !== original[0].toLowerCase();
  if (maiuscula && sugestao[0] === sugestao[0].toLowerCase()) {
    return sugestao[0].toUpperCase() + sugestao.slice(1);
  }
  return sugestao;
}

function bigramas(s: string): string[] {
  const out: string[] = [];
  for (let i = 0; i < s.length - 1; i++) out.push(s.slice(i, i + 2));
  return out;
}

/** Coeficiente de Sørensen–Dice sobre os bigramas (0..1). */
function dice(a: string, b: string): number {
  const ba = bigramas(a);
  const bb = bigramas(b);
  if (!ba.length || !bb.length) return a === b ? 1 : 0;
  const cont = new Map<string, number>();
  for (const g of ba) cont.set(g, (cont.get(g) ?? 0) + 1);
  let iguais = 0;
  for (const g of bb) {
    const n = cont.get(g) ?? 0;
    if (n > 0) {
      iguais++;
      cont.set(g, n - 1);
    }
  }
  return (2 * iguais) / (ba.length + bb.length);
}

/** Maior subsequência comum / maior tamanho (0..1) — pega trocas de letras de lugar. */
function lcsRatio(a: string, b: string): number {
  const n = a.length;
  const m = b.length;
  if (!n || !m) return 0;
  let anterior = new Uint16Array(m + 1);
  let atual = new Uint16Array(m + 1);
  for (let i = 1; i <= n; i++) {
    atual.fill(0);
    for (let j = 1; j <= m; j++) {
      atual[j] = a[i - 1] === b[j - 1] ? anterior[j - 1] + 1 : Math.max(anterior[j], atual[j - 1]);
    }
    const t = anterior;
    anterior = atual;
    atual = t;
  }
  return anterior[m] / Math.max(n, m);
}

/** Letras em comum / maior tamanho (filtro barato antes do cálculo caro). */
function letrasEmComum(a: string, b: string): number {
  const cont = new Int8Array(26);
  for (let i = 0; i < a.length; i++) cont[a.charCodeAt(i) - 97]++;
  let comuns = 0;
  for (let i = 0; i < b.length; i++) {
    const k = b.charCodeAt(i) - 97;
    if (k >= 0 && k < 26 && cont[k] > 0) {
      comuns++;
      cont[k]--;
    }
  }
  return comuns / Math.max(a.length, b.length, 1);
}

function parecenca(p: string, c: string): number {
  return 0.45 * dice(p, c) + 0.55 * lcsRatio(p, c);
}

// ---------- índice (raízes do .dic + formas frequentes) ----------

let indice: Map<string, string[]> | null = null;

function construirIndice(): Map<string, string[]> {
  if (indice) return indice;
  const mapa = new Map<string, string[]>();
  const adicionar = (palavra: string) => {
    if (!/^[\p{Letter}]{4,}$/u.test(palavra)) return;
    const n = norm(palavra);
    for (const k of [n.slice(0, 3), n.slice(0, 2)]) {
      let balde = mapa.get(k);
      if (!balde) mapa.set(k, (balde = []));
      balde.push(palavra);
    }
  };
  if (dicTexto) {
    const linhas = dicTexto.split("\n");
    for (let i = 1; i < linhas.length; i++) {
      const palavra = linhas[i].split("/")[0].split("\t")[0].trim();
      adicionar(palavra);
    }
  }
  // formas frequentes que não estão no .dic (ex.: "importante", "ótima", "reunião")
  for (const w of PALAVRAS_LISTA) {
    if (typo && !typo.check(w)) continue;
    adicionar(w);
  }

  indice = mapa;
  return mapa;
}

/**
 * Palavras parecidas com a errada: passeia pelos baldes de 2 e 3 letras, filtra pelo
 * "tamanho parecido + muitas letras iguais" (barato) e só então calcula a nota de verdade.
 */
function parecidas(palavra: string): { p: string; nota: number }[] {
  const mapa = construirIndice();
  const p = norm(palavra);
  const vistas = new Set<string>();
  const baratas: { p: string; chave: number }[] = [];
  for (const chave of [p.slice(0, 3), p.slice(0, 2)]) {
    const balde = mapa.get(chave);
    if (!balde) continue;
    for (const cand of balde) {
      if (vistas.has(cand)) continue;
      vistas.add(cand);
      const c = norm(cand);
      if (Math.abs(c.length - p.length) > 3) continue;
      const barata = letrasEmComum(p, c);
      let prefixo = 0;
      while (prefixo < p.length && prefixo < c.length && p[prefixo] === c[prefixo]) prefixo++;
      // quem começa igual à palavra entra sempre (é o sinal mais forte de acerto)
      if (barata < 0.72 && prefixo < 5) continue;
      baratas.push({ p: cand, chave: barata + (prefixo >= 5 ? 0.5 : 0) });
    }
  }
  baratas.sort((a, b) => b.chave - a.chave);
  const achadas = baratas.slice(0, 800).map((c) => ({ p: c.p, nota: parecenca(p, norm(c.p)) }));
  achadas.sort((a, b) => b.nota - a.nota);
  return achadas.slice(0, 40);
}

/** Formas válidas que só mudam acento/cedilha (o erro de escrita mais comum). */
const VARIANTES: Record<string, string[]> = {
  a: ["a", "á", "à", "â", "ã"],
  e: ["e", "é", "ê"],
  i: ["i", "í"],
  o: ["o", "ó", "ô", "õ"],
  u: ["u", "ú"],
  c: ["c", "ç"],
};

function variantesAcento(palavra: string): string[] {
  const posicoes: { i: number; opcoes: string[] }[] = [];
  for (let i = 0; i < palavra.length; i++) {
    const opcoes = VARIANTES[palavra[i].toLowerCase()];
    if (opcoes && opcoes.length > 1) posicoes.push({ i, opcoes });
  }
  if (!posicoes.length || posicoes.length > 7) return [];
  let combinacoes = [palavra];
  for (const pos of posicoes) {
    const novas: string[] = [];
    for (const c of combinacoes) {
      for (const op of pos.opcoes) {
        novas.push(c.slice(0, pos.i) + op + c.slice(pos.i + 1));
        if (novas.length >= 1500) break;
      }
      if (novas.length >= 1500) break;
    }
    combinacoes = novas;
  }
  const achadas: string[] = [];
  for (const c of combinacoes) {
    if (c === palavra || !/^[\p{Letter}]+$/u.test(c)) continue;
    if (typo?.check(c)) achadas.push(c);
    if (achadas.length >= 3) break;
  }
  return achadas;
}

/** Erros clássicos de escrita em português (mapa direto, com correção confiável). */
const ERROS_COMUNS: Record<string, string> = {
  "excessão": "exceção",
  "exceçao": "exceção",
  "excessao": "exceção",
  "previlégio": "privilégio",
  "previlegio": "privilégio",
  "advinhar": "adivinhar",
  "adevogado": "advogado",
  "menas": "menos",
  "poblema": "problema",
  "probrema": "problema",
  "seje": "seja",
  "atraz": "atrás",
  "concenso": "consenso",
  "estrupo": "estupro",
  "prazeiroso": "prazeroso",
  "imbigo": "umbigo",
  "cidadões": "cidadãos",
  "imprecionante": "impressionante",
  "disperdício": "desperdício",
  "desperdicio": "desperdício",
};

/** Sugestões para uma palavra desconhecida + a correção em que dá para confiar. */
function sugerirPalavra(palavra: string): { sugestoes: string[]; best?: string; notas: [string, number][] } {
  const p = norm(palavra);
  const notas = new Map<string, number>();
  const anotar = (cand: string, nota: number) => {
    const pontos = nota + (FREQUENTES.has(norm(cand)) ? 0.25 : 0);
    const atual = notas.get(cand);
    if (atual === undefined || pontos > atual) notas.set(cand, pontos);
  };

  // 0) erro clássico conhecido: certeza total
  const classico = ERROS_COMUNS[p];
  if (classico) anotar(classico, 1.5);
  // 1) só acento/cedilha: nota máxima
  for (const v of variantesAcento(palavra)) anotar(v, 1);
  // 2) parecidas de verdade
  for (const c of parecidas(palavra)) anotar(c.p, c.nota);

  const ordenadas = [...notas.entries()].sort((a, b) => b[1] - a[1]);
  const sugestoes = ordenadas.slice(0, 6).map(([w]) => ajustarCaixa(palavra, w));

  const semBonus = (nota: number, cand: string) => nota - (FREQUENTES.has(norm(cand)) ? 0.25 : 0);
  const primeiro = ordenadas[0];
  const segundo = ordenadas[1];
  let best: string | undefined;
  if (primeiro) {
    const basePrimeiro = semBonus(primeiro[1], primeiro[0]);
    const baseSegundo = segundo ? semBonus(segundo[1], segundo[0]) : 0;
    const soAcento = norm(primeiro[0]) === p;
    // só acento (ou erro clássico): sempre confiável.
    // Parecida: precisa ser parecida E estar claramente na frente (a frequência entra aqui:
    // é o que faz "atensao → atenção" ganhar de palpites raros tipo "atentato")
    if (soAcento || classico || (basePrimeiro >= 0.7 && primeiro[1] - (segundo?.[1] ?? 0) >= 0.08)) {
      best = ajustarCaixa(palavra, primeiro[0]);
    }
    // Uma ÚNICA sugestão: não há dúvida de qual é a palavra certa — aplica sozinho.
    if (!best && !segundo && !soAcento) {
      best = ajustarCaixa(palavra, primeiro[0]);
    }
  }
  return { sugestoes, best, notas: ordenadas.slice(0, 8) };
}

// ---------- palavras grudadas ("coisasque" → "coisas que") ----------

/** Posição de cada palavra frequente (sem acento) — quanto menor, mais comum. */
const POSICAO = new Map<string, number>();
PALAVRAS_LISTA.forEach((w, i) => {
  const n = norm(w);
  if (!POSICAO.has(n)) POSICAO.set(n, i);
});

/** Palavrinhas de uma letra que podem aparecer coladas (“eu e você”, “a casa”). */
const UMA_LETRA = new Set(["a", "e", "o", "é"]);

interface Peca {
  texto: string;
  frequente: boolean;
  posicao: number;
}

const pecas = new Map<string, Peca | null>();

/** O pedaço é uma palavra de verdade? (frequente, ou com 4+ letras no dicionário) */
function pecaValida(p: string): Peca | null {
  const guardada = pecas.get(p);
  if (guardada !== undefined) return guardada;
  let r: Peca | null = null;
  const lower = p.toLowerCase();
  if (p.length === 1) {
    if (UMA_LETRA.has(lower)) r = { texto: p, frequente: true, posicao: 5 };
  } else {
    const pos = POSICAO.get(norm(p));
    if (pos !== undefined) {
      if (typo?.check(lower)) r = { texto: p, frequente: true, posicao: pos };
      else {
        // acento faltando: "nao" → "não"
        const v = variantesAcento(lower).find((x) => POSICAO.has(norm(x)));
        if (v) r = { texto: ajustarCaixa(p, v), frequente: true, posicao: pos };
      }
    } else if (p.length >= 4 && typo?.check(lower)) {
      r = { texto: p, frequente: false, posicao: 99999 };
    }
  }
  pecas.set(p, r);
  return r;
}

interface Segmentacao {
  pontos: number;
  partes: string[];
  todasFrequentes: boolean;
  peloMenosUma: boolean;
}

/** Melhor jeito de cortar a palavra em 2 ou 3 palavras reais (ou null). */
function separarGrudada(palavra: string): Segmentacao[] {
  const n = palavra.length;
  if (n < 5 || n > 28 || /[-'’]/.test(palavra)) return [];
  const memo = new Map<string, Segmentacao | null>();
  const cortar = (i: number, restam: number): Segmentacao | null => {
    if (i === n) return { pontos: 0, partes: [], todasFrequentes: true, peloMenosUma: false };
    if (restam === 0) return null;
    const chave = i + "|" + restam;
    if (memo.has(chave)) return memo.get(chave)!;
    let melhor: Segmentacao | null = null;
    for (let j = i + 1; j <= n; j++) {
      if (i === 0 && j === n) continue; // precisa de pelo menos duas palavras
      const peca = pecaValida(palavra.slice(i, j));
      if (!peca) continue;
      const resto = cortar(j, restam - 1);
      if (!resto) continue;
      const pontos = (peca.frequente ? 1 + 0.5 * (1 - Math.min(peca.posicao, 5000) / 5000) : 0.3) - 0.35 + resto.pontos;
      if (!melhor || pontos > melhor.pontos) {
        melhor = { pontos, partes: [peca.texto, ...resto.partes], todasFrequentes: peca.frequente && resto.todasFrequentes, peloMenosUma: peca.frequente || resto.peloMenosUma };
      }
    }
    memo.set(chave, melhor);
    return melhor;
  };
  // prefere o corte em MENOS palavras ("nao consigo" e não "na o consigo")
  const duas = cortar(0, 2);
  const tres = cortar(0, 3);
  const lista = [duas, tres].filter((x): x is Segmentacao => !!x);
  return lista.filter((x, i) => lista.findIndex((y) => y.partes.join(" ") === x.partes.join(" ")) === i);
}

/** Palavras curtas que costumam vir depois (para completar “coisasqu” → “coisas que”). */
const COMPLETAVEIS = [
  "que", "quando", "qual", "quais", "quem", "para", "como", "mas", "com", "uma", "não", "isso", "porque",
  "então", "pois", "onde", "muito", "mais", "são", "foi", "sem", "por", "até", "nos", "das", "dos", "ele",
  "ela", "seu", "sua", "tem", "vai", "está", "estão", "também", "só", "já",
];

/** Último pedaço cortado no meio: "coisasqu" → "coisas que" (só sugestão, sem certeza). */
function separarTruncada(palavra: string): string[] {
  const n = palavra.length;
  const achadas: string[] = [];
  if (n < 5) return achadas;
  for (let i = Math.min(n - 2, 14); i >= 3; i--) {
    const esquerda = pecaValida(palavra.slice(0, i));
    if (!esquerda || !esquerda.frequente) continue;
    const resto = norm(palavra.slice(i));
    if (resto.length < 2 || resto.length > 5) continue;
    for (const c of COMPLETAVEIS) {
      if (norm(c).startsWith(resto) && norm(c) !== resto) achadas.push(`${esquerda.texto} ${c}`);
      if (achadas.length >= 3) return achadas;
    }
    if (achadas.length) return achadas;
  }
  return achadas;
}

/** Verbos de informática aportuguesados (“scrollar”, “commitar”…): jargão, não erro. */
const JARGAO = new RegExp(
  "^(scroll|deploy|commit|debug|upload|download|backup|print|stream|hack|rebas|merg|push|pull|logg|build)(ar|a|as|am|o|ou|ando|ado|ada|ados|adas|ei|e|em|amos|aram|ava|avam|aria|ará|ou)$",
  "i"
);

self.addEventListener("message", (event: MessageEvent) => {
  const data = event.data as { type: string; id?: number; words?: string[]; base?: string };

  if (data.type === "init") {
    void (async () => {
      try {
        const base = data.base ?? self.location.href;
        const load = async (file: string) => {
          const res = await fetch(new URL(`dicionario/${file}`, base));
          if (!res.ok) throw new Error(`${file}: ${res.status}`);
          return res.text();
        };
        const [aff, dic] = await Promise.all([load("pt_BR.aff"), load("pt_BR.dic")]);
        dicTexto = dic;
        typo = new Typo("pt_BR", aff, dic, { platform: "any" }) as unknown as TypoLike;
        self.postMessage({ type: "ready" });
      } catch (err) {
        self.postMessage({ type: "failed", error: String(err) });
      }
    })();
    return;
  }

  if (data.type === "debug") {
    const t0 = Date.now();
    const mapa = construirIndice();
    const t1 = Date.now();
    const r1 = sugerirPalavra("responsavo");
    const t2 = Date.now();
    const r2 = sugerirPalavra("improtante");
    const t3 = Date.now();
    const r3 = sugerirPalavra("otima");
    const t4 = Date.now();
    const r4 = sugerirPalavra("excessao");
    const t5 = Date.now();
    self.postMessage({
      type: "debug",
      id: data.id,
      indiceMs: t1 - t0,
      indiceSize: mapa.size,
      freqSize: FREQUENTES.size,
      temRespSemAcento: FREQUENTES.has("responsavel"),
      baldes: ["res", "re", "imp", "im"].map((k) => [k, mapa.get(k)?.length ?? 0]),
      responsavo: { sugestoes: r1.sugestoes, best: r1.best, notas: r1.notas, ms: t2 - t1 },
      improtante: { sugestoes: r2.sugestoes, best: r2.best, ms: t3 - t2 },
      otima: { sugestoes: r3.sugestoes, best: r3.best, ms: t4 - t3 },
      excessao: { sugestoes: r4.sugestoes, best: r4.best, ms: t5 - t4 },
    });
    return;
  }

  if (data.type === "check") {
    const words = data.words ?? [];
    if (!typo) {
      self.postMessage({ type: "result", id: data.id, hits: [] });
      return;
    }
    const hits: SpellHit[] = [];
    for (const word of words) {
      if (!word) continue;
      const lower = word.toLowerCase();
      if (PALAVRAS_OK.has(lower)) continue;
      if (typo.check(word)) continue;
      if (lower !== word && typo.check(lower)) continue;
      if (JARGAO.test(word)) continue;
      const r = sugerirPalavra(word);
      // só faltou acento ou cedilha ("missao" → "missão")? Isso vale mais que supor palavras coladas ("miss ao")
      if (variantesAcento(word).length) {
        hits.push({ word, suggestions: r.sugestoes, best: r.best });
        continue;
      }
      // faltou espaço? "coisasque" → "coisas que" (a certeza vem de as duas partes serem palavras comuns)
      // nomes próprios e marcas (Instagram, WhatsApp) não viram "Insta gram": exige palavras comuns
      const minuscula = word[0] === word[0].toLowerCase();
      const camel = /\p{Ll}\p{Lu}/u.test(word);
      const cortes = separarGrudada(word).filter(
        (c) => c.todasFrequentes || camel || (c.peloMenosUma && minuscula && word.length >= 8)
      );
      if (cortes.length) {
        const grudada = cortes[0];
        const junto = grudada.partes.join(" ");
        const outros = cortes.slice(1).map((c) => c.partes.join(" "));
        const forte = grudada.todasFrequentes && grudada.partes.length === 2 && grudada.partes.every((p) => p.length >= 2) && word.length >= 6;
        // corte fraco (só uma parte é palavra comum): primeiro as palavras parecidas, depois o corte
        const resto = r.sugestoes.filter((x) => x !== junto && !outros.includes(x));
        hits.push({
          word,
          glued: true,
          suggestions: (grudada.todasFrequentes || camel ? [junto, ...outros, ...resto] : [...resto.slice(0, 2), junto, ...outros, ...resto.slice(2)]).slice(0, 6),
          best: forte ? junto : r.best,
        });
        continue;
      }
      const truncada = separarTruncada(word);
      if (truncada.length) {
        hits.push({ word, glued: true, suggestions: [...truncada, ...r.sugestoes.filter((x) => !truncada.includes(x))].slice(0, 6), best: undefined });
        continue;
      }
      hits.push({ word, suggestions: r.sugestoes, best: r.best });
    }
    self.postMessage({ type: "result", id: data.id, hits });
  }
});
