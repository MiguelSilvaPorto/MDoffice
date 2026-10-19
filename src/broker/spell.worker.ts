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
import { candidatos, construirIndice, montarFrequencia, normalizar as norm, type Frequencia, type Indice } from "./spell/candidatos";
import { montarContexto, notaContexto, type ModeloCtx } from "./spell/contexto";
import { decidir, TAU_INICIAL, type Decisao } from "./spell/decisao";

interface SpellHit {
  word: string;
  suggestions: string[];
  /** faltou espaço entre palavras (ex.: "coisasque" → "coisas que") */
  glued?: boolean;
  /** correção em que dá para confiar (aplicada sozinha pela correção automática) */
  best?: string;
  /** colagem DEDUZIDA: o dicionário aceita, mas a família não é usada na língua */
  duvida?: boolean;
  /** por que o corretor decidiu aplicar (ou não) sozinho — diagnóstico e testes */
  decisao?: { aplicar: boolean; confianca: number; margem: number; motivo: string };
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

/** Mantém a maiúscula do começo quando a sugestão é minúscula. */
function ajustarCaixa(original: string, sugestao: string): string {
  const maiuscula =
    original[0] !== undefined && original[0] === original[0].toUpperCase() && original[0] !== original[0].toLowerCase();
  if (maiuscula && sugestao[0] === sugestao[0].toLowerCase()) {
    return sugestao[0].toUpperCase() + sugestao.slice(1);
  }
  return sugestao;
}

// ---------- índice (vocabulário real, por trigramas) ----------

/**
 * O vocabulário de sugestão vem do corpus de texto escrito, não da lista de
 * legendas: é o que faz "extenso" existir como candidato e "esterno" não.
 * O `.dic` continua sendo a autoridade de "isto é palavra?" (via typo-js);
 * aqui é só a fonte de candidatos.
 */
let indice: Indice | null = null;
let frequencia: Frequencia | null = null;
/** Bigramas do corpus: o quanto cada candidato combina com a palavra anterior. */
let contexto: ModeloCtx | null = null;
/** Limiar de confiança em vigor (a interface calibra e manda por mensagem). */
let tau = TAU_INICIAL;

/** Peso do contexto na nota do candidato: decide desempates, não passa por cima da certeza. */
const PESO_CONTEXTO = 0.35;

/**
 * O corpus de texto escrito (lista completa do `freq-pt.json`): quais palavras
 * aparecem de verdade e as três primeiras letras de cada uma.
 *
 * É o corpus COMPLETO, não a lista curta `PALAVRAS_LISTA` (que serve para julgar
 * "frequente" nos cortes de palavras). A diferença importa: "aplicativo" não está na
 * lista curta, mas está aqui, junto com "aplicação"/"aplicar" — com a lista curta a
 * palavra virava "a plicativo".
 */
let corpus: Set<string> | null = null;
let familias: Set<string> | null = null;

/**
 * Quantas vezes cada forma aparece no corpus — COM acento, exatamente como escrita.
 *
 * É o que separa "ira" (raiva, quase não usada em texto escrito) de "irá" (o verbo,
 * comum): o dicionário conhece as duas, e só o uso diz qual delas era.
 */
let contagensExatas: Map<string, number> | null = null;

function prepararIndice(palavras: string[], contagens: number[]): void {
  frequencia = montarFrequencia(palavras, contagens);
  indice = construirIndice(palavras);
  corpus = new Set<string>();
  familias = new Set<string>();
  contagensExatas = new Map<string, number>();
  for (let i = 0; i < palavras.length; i++) {
    const w = palavras[i];
    const n = norm(w);
    corpus.add(n);
    if (n.length >= 3) familias.add(n.slice(0, 3));
    contagensExatas.set(w.toLowerCase(), contagens[i] ?? 0);
  }
}

/**
 * Palavras reais mais prováveis para a errada, já ordenadas.
 * O trabalho pesado (índice de trigramas + distância de edição + frequência)
 * fica em `spell/candidatos.ts`, que é puro e testável fora do worker.
 */
function parecidas(palavra: string): { p: string; nota: number; distancia: number; contagem: number }[] {
  if (!indice || !frequencia) return [];
  const maxDist = norm(palavra).length <= 4 ? 1 : 2;
  return candidatos(palavra, indice, frequencia, { limite: 20, maxDistancia: maxDist }).map((c) => ({
    p: c.palavra,
    // a nota do candidato vira uma fração de 0 a 0.9, para ficar abaixo das
    // correções de acento (1.0) e dos erros clássicos (1.5)
    nota: 0.9 * Math.min(1, Math.max(0, (c.nota + maxDist) / (3.7 + maxDist))),
    distancia: c.distancia,
    contagem: c.contagem,
  }));
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

/**
 * Trocas que a pessoa já aceitou o bastante para virar correção conhecida
 * (vêm do aprendizado; o worker não lê localStorage, então a interface envia).
 */
const APRENDIDAS = new Map<string, string>();

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

/** Sugestões para uma palavra desconhecida + a correção em que dá para confiar.
 *  `anterior` é a palavra que veio antes (ou "<s>" no começo da frase): entra como
 *  bônus de contexto na nota de cada candidato. */
function sugerirPalavra(
  palavra: string,
  anterior?: string
): { sugestoes: string[]; best?: string; decisao: Decisao; notas: [string, number][]; distanciaTopo: number } {
  const p = norm(palavra);
  const notas = new Map<string, number>();
  const distanciaDe = new Map<string, number>();
  const contagemDe = new Map<string, number>();
  const bonus = (cand: string) => PESO_CONTEXTO * notaContexto(cand, anterior, contexto);
  // A frequência já vem do corpus de texto escrito, dentro da nota do candidato.
  // Não há bônus extra por listas antigas: elas trazem o viés de legenda de volta.
  const anotar = (cand: string, nota: number, distancia = 9, contagem = 0) => {
    const comContexto = nota + bonus(cand);
    const atual = notas.get(cand);
    if (atual === undefined || comContexto > atual) {
      notas.set(cand, comContexto);
      distanciaDe.set(cand, distancia);
      contagemDe.set(cand, contagem);
    }
  };

  // 0) erro clássico conhecido: certeza total
  const classico = ERROS_COMUNS[p];
  if (classico) anotar(classico, 1.5, 0);
  // 0b) troca APRENDIDA: a pessoa já aceitou esta correção outras vezes.
  // Vale tanto quanto um erro clássico — é o que faz o corretor melhorar com o uso.
  const aprendida = APRENDIDAS.get(p);
  if (aprendida) anotar(aprendida, 1.5, 0);
  // 1) só acento/cedilha: nota máxima, mas o USO desempata as variantes:
  //    "pao" é aceito como "pão" e "paó"; quem aparece no corpus é "pão". Sem isso
  //    a primeira variante gerada (a ordem é alfabética) vencia, e o corretor
  //    aplicava sozinho a forma errada.
  for (const v of variantesAcento(palavra)) {
    const uso = contagensExatas?.get(v.toLowerCase()) ?? 0;
    anotar(v, 1 + Math.min(0.1, Math.log10(uso + 1) / 100), 0, uso);
  }
  // 2) parecidas de verdade (índice de trigramas + distância de edição + frequência)
  for (const c of parecidas(palavra)) anotar(c.p, c.nota, c.distancia, c.contagem);

  const ordenadas = [...notas.entries()].sort((a, b) => b[1] - a[1]);
  const sugestoes = ordenadas.slice(0, 6).map(([w]) => ajustarCaixa(palavra, w));

  const primeiro = ordenadas[0];
  const segundo = ordenadas[1];
  let best: string | undefined;
  let decisao: Decisao = { aplicar: false, confianca: 0, margem: 0, tau, motivo: "sem candidato" };
  if (primeiro) {
    const soAcento = norm(primeiro[0]) === p;
    const distancia = distanciaDe.get(primeiro[0]) ?? 9;
    const distanciaSegundo = segundo ? (distanciaDe.get(segundo[0]) ?? 9) : 9;
    const c1 = contagemDe.get(primeiro[0]) ?? 0;
    const c2 = contagemDe.get(segundo?.[0] ?? "") ?? 0;
    // Quando o primeiro está mais PERTO da palavra errada do que o segundo, a
    // escolha não depende de frequência: é o candidato mais próximo que ganha.
    const vencePorDistancia = distancia <= 1 && distanciaSegundo > distancia;
    // Dois candidatos igualmente próximos (ou o vencedor até mais longe): aí quem
    // decide é o USO. 5× separa com folga "atenção" (1.896) de "tensão" (242) e
    // "responsável" (1.556) de "responsivo" (27), sem abrir a porta para pares
    // equilibrados (esses seguem para a decisão por probabilidade).
    const dominaFrequencia = c1 > 0 && c1 >= 5 * Math.max(c2, 1);
    // Classes de CERTEZA: acento/cedilha, erro clássico, o mais próximo (sem empate),
    // uso dominante e o candidato único. Fora delas, quem decide é a probabilidade com
    // margem — empate vira sugestão, nunca aplicação.
    const certo = !!soAcento || !!classico || vencePorDistancia || dominaFrequencia || !segundo;
    decisao = decidir(
      { pontos: ordenadas.map(([, nota]) => nota), certo, contexto: notaContexto(primeiro[0], anterior, contexto) },
      tau
    );
    if (decisao.aplicar) {
      // o par de número ("mantém"/"mantêm") é ambíguo sem o sujeito: fica como sugestão
      const irmao = parDeNumero(primeiro[0]);
      const ambiguo = !!irmao && (contagensExatas?.get(irmao) ?? 0) >= 20;
      if (!ambiguo) best = ajustarCaixa(palavra, primeiro[0]);
    }
  }
  return { sugestoes, best, decisao, notas: ordenadas.slice(0, 8), distanciaTopo: primeiro ? (distanciaDe.get(primeiro[0]) ?? 9) : 9 };
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

/** Uma letra solta que é palavra, ou uma palavra do dicionário. */
function valeComoPalavra(p: string): boolean {
  const l = p.toLowerCase();
  if (l.length === 1) return UMA_LETRA.has(l);
  return l.length >= 2 && !!typo?.check(l);
}

/**
 * A palavra está no dicionário, mas é do português que ninguém escreve?
 *
 * "oira" é forma do verbo "oirar": o dicionário aceita, então não havia o que acusar —
 * e quem escreveu "oira" querendo "o ira" ficava sem aviso nenhum. O jeito de perceber
 * é perguntar pelo USO: a palavra não aparece no corpus de texto escrito e nenhuma
 * palavra do corpus começa como ela (a família dela não é usada).
 *
 * Só vale para o caso clássico: a palavrinha de UMA letra colada na seguinte — "oira"
 * ("o ira"), "oque" ("o que"), "avida" ("a vida"). Abrir para cortes maiores começa a
 * acusar palavra rara de verdade: "xilofone" virava "xi lo fone" (foi o teste do
 * próprio projeto que pegou).
 *
 * Sem corpus carregado não opina: é melhor não acusar do que acusar sem dado.
 */
function cortesDeColagem(palavra: string): string[] {
  if (!corpus || !familias) return [];
  const n = norm(palavra);
  if (n.length < 4 || n.length > 20) return [];
  if (corpus.has(n)) return []; // aparece em texto escrito: é palavra de verdade
  if (familias.has(n.slice(0, 3))) return []; // a família dela é usada: não é obscura
  const primeira = palavra.slice(0, 1);
  if (!UMA_LETRA.has(primeira.toLowerCase())) return [];
  const resto = palavra.slice(1);
  return valeComoPalavra(resto) ? [`${primeira} ${resto}`] : [];
}

/** As formas acentuadas de cada letra — a base do "faltou o acento?". */
const ACENTOS: Record<string, string[]> = {
  a: ["á", "â", "ã", "à"],
  e: ["é", "ê"],
  i: ["í"],
  o: ["ó", "ô", "õ"],
  u: ["ú"],
  c: ["ç"],
};

/** A partir de quantos usos a forma escrita é considerada comum (palavra de verdade). */
const USO_COMUM = 1000;
/** Abaixo disso (mas acima de 20), a forma escrita ainda pode ser só o acento faltando. */
const USO_RARO = 20;
/** Quantas vezes a forma acentuada precisa ser mais usada que a escrita (forma rara). */
const VANTAGEM = 20;
/** Quantas vezes quando a escrita é rara, mas não inexistente ("aniversario" 55 × "aniversário" 486). */
const VANTAGEM_RARA = 3;
/** Piso de uso da forma acentuada, para não trocar raridade por raridade. */
const PISO_ACENTO = 50;

/**
 * O dicionário aceita a forma escrita, mas em texto escrito ela quase não aparece e a
 * acentuada é comum? Então faltou o acento ("ira" → "irá", "duvida" → "dúvida").
 *
 * O dicionário não decide isso: as duas formas existem ("ira" é raiva; "irá" é o verbo
 * ir). Quem decide é o USO — e o aviso é pergunta, nunca correção sozinha, porque o
 * acento troca o sentido e quem escreveu é quem sabe qual era.
 *
 * Duas faixas: forma escrita INEXISTENTE/rara (até 20 usos) exige vantagem de 20×; forma
 * escrita rara mas usada (21 a 1.000) exige 3× — é o caso de "aniversario" (55) contra
 * "aniversário" (486). Acima de 1.000 a forma escrita é comum: é palavra de verdade,
 * e o acento pode trocar o sentido ("esta" × "está", "as" × "às") — não mexe.
 */
/**
 * Singular/plural do verbo ("mantém"/"mantêm", "vem"/"vêm", "tem"/"têm"). As duas
 * formas existem no dicionário e só o SUJEITO decide — sem ele, acentuar é chute.
 * Devolve a forma irmã quando ela existe (para tratar o par como ambíguo).
 */
function parDeNumero(forma: string): string | null {
  const lower = forma.toLowerCase();
  if (!lower.endsWith("m") || lower.length < 3) return null;
  const radical = lower.slice(0, -1);
  const vogal = radical.slice(-1);
  if (vogal !== "e" && vogal !== "é" && vogal !== "ê") return null;
  const irmao = `${radical.slice(0, -1)}êm`;
  if (irmao === lower) return null;
  return typo?.check(irmao) ? irmao : null;
}

/** Formas de "ter"/"haver" que pedem particípio depois ("tinha valido"). */
const AUXILIARES = new Set([
  "tinha", "tinham", "tive", "teve", "tiveram", "tem", "têm", "tivesse", "tivessem",
  "havia", "haviam", "houve", "houveram", "ter", "haver", "tendo", "tido",
]);

function acentoMaisUsado(palavra: string, anterior?: string): string | null {
  if (!contagensExatas) return null;
  const lower = palavra.toLowerCase();
  const aqui = contagensExatas.get(lower) ?? 0;
  if (aqui >= USO_COMUM) return null; // a forma escrita é comum: é palavra de verdade
  // Com 3+ letras, QUALQUER uso no corpus já é leitura possível: "bebe" (verbo) ×
  // "bebê" (substantivo), "valido" (particípio) × "válido" (adjetivo). Frequência não
  // decide sentido — a correção formal não acentua, fica a sugestão. As palavras de
  // duas letras ("ja", "so", "ha") não têm outra leitura e seguem pelas faixas abaixo.
  if (lower.length > 2 && aqui >= 1) return null;
  const vantagem = aqui >= USO_RARO ? VANTAGEM_RARA : VANTAGEM;
  let melhor: string | null = null;
  let melhorUso = 0;
  for (let i = 0; i < lower.length; i++) {
    for (const alt of ACENTOS[lower[i]] ?? []) {
      const forma = lower.slice(0, i) + alt + lower.slice(i + 1);
      if (!typo?.check(forma)) continue; // a sugestão precisa ser palavra de verdade
      const uso = contagensExatas.get(forma) ?? 0;
      if (uso < PISO_ACENTO) continue;
      if (uso < vantagem * Math.max(aqui, 1)) continue;
      if (uso > melhorUso) {
        melhor = forma;
        melhorUso = uso;
      }
    }
  }
  if (melhor) {
    // Depois de "tinha/havia/tem…" a palavra é particípio ("tinha valido"), não
    // adjetivo ("válido"): o acento mudaria a classe e o sentido.
    if (anterior && AUXILIARES.has(anterior.toLowerCase())) return null;
    // "mantém" × "mantêm": as duas são válidas; a pessoa é que sabe o número.
    const irmao = parDeNumero(melhor);
    if (irmao && (contagensExatas.get(irmao) ?? 0) >= USO_RARO) return null;
    // O contexto manda: se a frase pede a forma SEM acento ("tinha valido",
    // "ele bebe agua"), a escrita é palavra de verdade ali — não acentua.
    const notaEscrita = notaContexto(lower, anterior, contexto);
    if (notaEscrita > 0 && notaEscrita >= notaContexto(melhor, anterior, contexto)) return null;
  }
  return melhor;
}

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
  const data = event.data as {
    type: string;
    id?: number;
    words?: string[];
    base?: string;
    correcoes?: [string, string][];
    /** limiar de confiança calibrado na interface (mensagem "tau") */
    valor?: number;
    /** palavra -> palavra anterior, o contexto do bigrama (mensagem "check") */
    ctx?: Record<string, string>;
  };

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

        // A ordem de frequência vem do corpus de texto escrito. Sem ela o corretor
        // ainda funciona, mas volta a preferir palavra comum de legenda.
        try {
          const res = await fetch(new URL("ngrams/freq-pt.json", base));
          if (res.ok) {
            const f = (await res.json()) as { w?: string[]; n?: number[] };
            if (Array.isArray(f.w) && Array.isArray(f.n)) prepararIndice(f.w, f.n);
          }
        } catch {
          /* sem a frequência: segue com o dicionário apenas */
        }

        // O contexto (bigramas) é o que desempata candidatos parecidos pelo que a
        // frase pede. Sem ele o corretor segue só com distância + frequência.
        try {
          const res = await fetch(new URL("ngrams/ctx-pt.json", base));
          if (res.ok) contexto = montarContexto(await res.json());
        } catch {
          /* sem contexto: as notas ficam como antes */
        }

        self.postMessage({ type: "ready" });
      } catch (err) {
        self.postMessage({ type: "failed", error: String(err) });
      }
    })();
    return;
  }

  if (data.type === "aprender") {
    // A interface manda as trocas já confiáveis (o worker não tem localStorage).
    APRENDIDAS.clear();
    for (const par of (data.correcoes ?? []) as [string, string][]) {
      if (!Array.isArray(par) || par.length !== 2) continue;
      APRENDIDAS.set(norm(par[0]), par[1]);
    }
    return;
  }

  if (data.type === "tau") {
    // A interface calibra o limiar (auto-aplicações desfeitas × mantidas) e manda aqui.
    const valor = Number(data.valor);
    if (Number.isFinite(valor) && valor > 0 && valor < 1) tau = valor;
    return;
  }

  if (data.type === "debug") {
    // Sonda de desenvolvimento: mostra o que o corretor responde para palavras
    // conhecidas e quanto custou montar o índice. Útil para comparar calibragens
    // sem abrir o app.
    const t0 = Date.now();
    const r1 = sugerirPalavra("responsavo");
    const t1 = Date.now();
    const r2 = sugerirPalavra("improtante");
    const t2 = Date.now();
    const r3 = sugerirPalavra("estenso");
    const t3 = Date.now();
    const r4 = sugerirPalavra("excessao");
    const t4 = Date.now();
    // O mesmo erro com e sem contexto: é a prova de que o bigrama está entrando
    // ("vou para a caza" → casa; sem contexto, pode empatar com outras parecidas).
    const r5 = sugerirPalavra("caza", "para");
    const t5 = Date.now();
    const r6 = sugerirPalavra("caza");
    const t6 = Date.now();
    self.postMessage({
      type: "debug",
      id: data.id,
      indicePronto: !!indice,
      contextoPronto: !!contexto,
      tau,
      trigramas: indice?.baldes.size ?? 0,
      vocabulario: indice?.palavras.length ?? 0,
      freqSize: FREQUENTES.size,
      responsavo: { sugestoes: r1.sugestoes, best: r1.best, ms: t1 - t0 },
      improtante: { sugestoes: r2.sugestoes, best: r2.best, ms: t2 - t1 },
      estenso: { sugestoes: r3.sugestoes, best: r3.best, ms: t3 - t2 },
      excessao: { sugestoes: r4.sugestoes, best: r4.best, ms: t4 - t3 },
      caza_com_contexto: { sugestoes: r5.sugestoes, best: r5.best, decisao: r5.decisao, ms: t5 - t4 },
      caza_sem_contexto: { sugestoes: r6.sugestoes, best: r6.best, decisao: r6.decisao, ms: t6 - t5 },
    });
    return;
  }

  if (data.type === "check") {
    const words = data.words ?? [];
    const ctx = (data.ctx ?? {}) as Record<string, string>;
    if (!typo) {
      self.postMessage({ type: "result", id: data.id, hits: [] });
      return;
    }
    const hits: SpellHit[] = [];
    for (const word of words) {
      if (!word) continue;
      const lower = word.toLowerCase();
      if (PALAVRAS_OK.has(lower)) continue;
      if (typo.check(word) || (lower !== word && typo.check(lower))) {
        // O dicionário aceita — mas e o resto da língua?
        // 1) Faltou o acento? "ira" (raiva) e "irá" (verbo) existem; o uso decide.
        const comAcento = acentoMaisUsado(word, ctx[word]);
        if (comAcento) {
          hits.push({ word, duvida: true, suggestions: [comAcento] });
          continue;
        }
        // 2) Colou duas palavras? "oira" é forma do verbo "oirar": existe, e ninguém usa.
        const colada = cortesDeColagem(word);
        if (colada.length) hits.push({ word, glued: true, duvida: true, suggestions: colada, best: undefined });
        continue;
      }
      if (JARGAO.test(word)) continue;
      const anterior = ctx[word];
      const r = sugerirPalavra(word, anterior);
      // só faltou acento ou cedilha ("missao" → "missão")? Isso vale mais que supor palavras coladas ("miss ao")
      if (variantesAcento(word).length) {
        hits.push({ word, suggestions: r.sugestoes, best: r.best, decisao: r.decisao });
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
        const duasPartes = grudada.partes.length === 2 && grudada.partes.every((p) => p.length >= 2);
        const forte = grudada.todasFrequentes && duasPartes && word.length >= 6;
        // Um corte de palavra só LIDERA quando não há correção de uma única
        // edição: trocar uma letra é muito mais comum do que esquecer um espaço,
        // e sem esta regra "estenso" virava "es tens o".
        const lidera = forte && (r.distanciaTopo > 1 || camel);
        const resto = r.sugestoes.filter((x) => x !== junto && !outros.includes(x));
        hits.push({
          word,
          glued: true,
          suggestions: (lidera ? [junto, ...outros, ...resto] : [...resto.slice(0, 3), junto, ...outros, ...resto.slice(3)]).slice(0, 6),
          best: lidera ? junto : r.best,
        });
        continue;
      }
      const truncada = separarTruncada(word);
      if (truncada.length) {
        hits.push({ word, glued: true, suggestions: [...truncada, ...r.sugestoes.filter((x) => !truncada.includes(x))].slice(0, 6), best: undefined });
        continue;
      }
      hits.push({ word, suggestions: r.sugestoes, best: r.best, decisao: r.decisao });
    }
    self.postMessage({ type: "result", id: data.id, hits });
  }
});
