// Assistente de escrita em português (100% offline):
// - ortografia com dicionário pt-BR (nspell + dictionary-pt)
// - regras de estilo/gramática comuns
// - sugestões de outras palavras (sinônimos)
// - estatísticas do texto (palavras repetidas, frases longas…)

// lista das palavras mais frequentes do português: usada para saber se uma palavra é
// comum (e então NÃO sugerir troca) ou rara (aí sim vale o "você quis dizer…")
import { FREQUENTES } from "./palavras";

export interface WritingIssue {
  from: number;
  to: number;
  word: string;
  kind: "spell" | "style";
  message: string;
  /** palavras para trocar (ortografia/sinônimos) */
  suggestions: string[];
  /** correção direta da regra (quando existe) */
  fix?: string;
  /** pode ser aplicada sozinha enquanto se digita (espaços, maiúsculas, abreviações) */
  safe?: boolean;
  /** correção de ortografia em que dá para confiar (aplicada sozinha pela correção automática) */
  auto?: string;
}

export interface WritingStats {
  words: number;
  sentences: number;
  avgWordsPerSentence: number;
  longSentences: number;
  repeated: { word: string; count: number; from: number; to: number }[];
}

// ---------- listas curadas (pt-BR) ----------

/** Abreviações de internet → forma correta. */
const ABBREVIATIONS: Record<string, string> = {
  vc: "você",
  vcs: "vocês",
  pq: "porque",
  tbm: "também",
  tb: "também",
  mto: "muito",
  mt: "muito",
  eh: "é",
  ta: "está",
  "tá": "está",
  qdo: "quando",
  qnd: "quando",
  qq: "qualquer",
  vdd: "verdade",
  pfv: "por favor",
  dnv: "de novo",
  vlw: "valeu",
  obg: "obrigado",
  blz: "beleza",
  q: "que",
  "tô": "estou",
  tou: "estou",
  "cê": "você",
  msm: "mesmo",
  cmg: "comigo",
  ctg: "contigo",
  agr: "agora",
  dps: "depois",
  qm: "quem",
  qts: "quantos",
  sdds: "saudades",
};

/** Palavras grudadas → separadas. */
const GLUED: Record<string, string> = {
  derrepente: "de repente",
  derepente: "de repente",
  concerteza: "com certeza",
  apartir: "a partir",
  denovo: "de novo",
  porisso: "por isso",
  emcima: "em cima",
  arespeito: "a respeito",
  maomenos: "mais ou menos",
  demais: "demais",
  " pramim": " para mim",
};

/** Expressões que soam melhor de outro jeito. */
const PHRASES: { rx: RegExp; fix: string; message: string }[] = [
  { rx: /\ba\s+n[íi]vel\s+de\b/gi, fix: "em nível de", message: "Prefira “em nível de” (e não “a nível de”)." },
  { rx: /\bno\s+sentido\s+de\b/gi, fix: "para", message: "“no sentido de” → prefira “para”." },
  { rx: /\bprimeiramente\b/gi, fix: "primeiro", message: "“primeiramente” → “primeiro” costuma ficar mais natural." },
  { rx: /\bdevido\s+ao\s+fato\s+de\s+que\b/gi, fix: "porque", message: "“devido ao fato de que” → use “porque”." },
  { rx: /\bcom\s+o\s+objetivo\s+de\b/gi, fix: "para", message: "“com o objetivo de” → “para” é mais direto." },
  { rx: /\bfazer\s+com\s+que\b/gi, fix: "fazer", message: "“fazer com que” pode virar só “fazer”." },
  { rx: /\bem\s+fun[çc][ãa]o\s+disso\b/gi, fix: "por isso", message: "“em função disso” → “por isso”." },
];

/** Palavras muito frequentes em português (usadas no "você quis dizer…"). */
const COMMON_WORDS = new Set([
  "a", "à", "ao", "aos", "as", "às", "o", "os", "um", "uma", "uns", "umas", "de", "da", "das",
  "do", "dos", "em", "no", "na", "nos", "nas", "por", "para", "com", "sem", "sob", "entre",
  "até", "após", "ante", "que", "qual", "quais", "quando", "onde", "como", "porque", "pois",
  "mas", "também", "já", "não", "sim", "muito", "mais", "menos", "bem", "mal", "melhor",
  "pior", "todo", "toda", "todos", "todas", "este", "esta", "estes", "estas", "esse", "essa",
  "esses", "essas", "isso", "aquele", "aquela", "eu", "tu", "ele", "ela", "nós", "você",
  "vocês", "eles", "elas", "me", "te", "se", "lhe", "meu", "minha", "seu", "sua", "nosso",
  "nossa", "dele", "dela", "ser", "sou", "é", "somos", "são", "era", "eram", "foi", "foram",
  "seja", "sendo", "sido", "estar", "está", "estão", "estava", "estavam", "esteve", "estou",
  "ter", "tem", "têm", "tinha", "tinham", "teve", "tiver", "tendo", "haver", "há", "havia",
  "houve", "fazer", "faz", "fazem", "fez", "fizeram", "fazendo", "feito", "poder", "pode",
  "podem", "podia", "podendo", "dizer", "diz", "dizem", "disse", "disseram", "dizendo", "ver",
  "veem", "viu", "viram", "vendo", "visto", "dar", "dá", "dão", "deu", "deram", "dando",
  "saber", "sabe", "sabem", "soube", "sabendo", "querer", "quer", "querem", "quis", "querendo",
  "chegar", "chega", "chegou", "chegando", "passar", "passa", "passou", "passando", "ficar",
  "fica", "ficou", "ficando", "deixar", "deixa", "deixou", "deixando", "levar", "leva", "levou",
  "começar", "começa", "começou", "começando", "começo", "parecer", "parece", "pareceu",
  "parecendo", "ajudar", "ajuda", "ajudou", "ajudando", "usar", "usa", "usou", "usando", "uso",
  "trabalhar", "trabalha", "trabalhou", "trabalhando", "trabalho", "escrever", "escreve",
  "escreveu", "escrevendo", "escrito", "escrita", "ler", "leu", "lendo", "leitura", "falar",
  "fala", "falou", "falando", "pensar", "pensa", "pensou", "pensando", "pensamento",
  "entender", "entende", "entendeu", "entendendo", "precisar", "precisa", "precisou",
  "precisando", "acontecer", "acontece", "aconteceu", "maneira", "forma", "modo", "jeito",
  "exemplo", "exemplos", "documento", "documentos", "texto", "textos", "palavra", "palavras",
  "frase", "frases", "linha", "linhas", "página", "páginas", "arquivo", "arquivos", "pasta",
  "pastas", "imagem", "imagens", "problema", "problemas", "solução", "soluções", "ideia",
  "ideias", "tempo", "lugar", "pessoa", "pessoas", "coisa", "coisas", "parte", "partes", "dia",
  "dias", "ano", "anos", "meses", "hora", "horas", "momento", "casa", "cidade", "país", "mundo",
  "vida", "água", "amigo", "amiga", "família", "filho", "filha", "criança", "escola",
  "empresa", "equipe", "projeto", "reunião", "cliente", "clientes", "grande", "pequeno",
  "pequena", "novo", "nova", "velho", "bom", "boa", "ruim", "importante", "difícil", "fácil",
  "rápido", "devagar", "certo", "errada", "errado", "primeiro", "segundo", "terceiro",
  "último", "próximo", "anterior", "sempre", "nunca", "talvez", "quase", "ainda", "depois",
  "antes", "agora", "hoje", "ontem", "amanhã", "aqui", "ali", "acima", "abaixo", "dentro",
  "fora", "perto", "longe", "tudo", "nada", "algo", "alguém", "ninguém", "cada", "outro",
  "outra", "outros", "outras", "mesmo", "mesma", "próprio", "único", "possível", "necessário",
  "então", "assim", "além", "porém", "contudo", "entretanto", "portanto", "conforme",
  "através", "obrigado", "obrigada", "desculpa", "nenhum", "nenhuma", "vários", "várias",
  "serviço", "serviços", "sistema", "sistemas", "usuário", "usuários", "versão", "número",
  "código", "dados", "relatório", "lista", "grupo", "dúvida", "pergunta", "resposta",
  "resultado", "objetivo", "processo", "função", "parte", "final", "início", "meio",
  "disso", "nisso", "disto", "nisto", "desse", "dessa", "desses", "dessas", "nesse", "nessa",
  "nesses", "nessas", "deste", "desta", "neste", "nesta", "porém", "contudo", "entretanto",
  "todavia", "porque", "portanto",
]);

/** Procura uma palavra muito comum a uma letra de distância (ex.: maneria → maneira). */
function commonNeighbor(word: string): string | null {
  const lower = word.toLowerCase();
  // só vale para palavra RARA: "fizer" é comum (não tem nada de errado) e "maneria" não existe
  if (lower.length < 5 || FREQUENTES.has(lower) || COMMON_WORDS.has(lower)) return null;
  const letters = "abcdefghijklmnopqrstuvwxyzáâãàéêíóôõúüç";
  const variants = new Set<string>();
  // troca de duas letras de lugar (o caso "maneria" → "maneira")
  for (let i = 0; i < lower.length - 1; i++) {
    variants.add(lower.slice(0, i) + lower[i + 1] + lower[i] + lower.slice(i + 2));
  }
  // trocas de uma letra (ignorando o final: é onde as conjugações diferem,
  // o que evitaria falsos positivos como "escrevi" → "escreve")
  for (let i = 0; i < lower.length - 1; i++) {
    for (const c of letters) {
      const replaced = lower.slice(0, i) + c + lower.slice(i + 1);
      if (replaced !== lower) variants.add(replaced);
    }
  }
  for (const candidate of variants) {
    if (FREQUENTES.has(candidate) || COMMON_WORDS.has(candidate)) return candidate;
  }
  return null;
}

/** Conectivos que pedem vírgula quando abrem a frase. */
const INTRO_CONNECTIVES = [
  "além disso",
  "além do mais",
  "por outro lado",
  "dessa forma",
  "dessa maneira",
  "desse modo",
  "sendo assim",
  "assim sendo",
  "no entanto",
  "portanto",
  "por isso",
  "por fim",
  "ou seja",
  "isto é",
  "em resumo",
  "em suma",
  "de modo geral",
  "via de regra",
  "por exemplo",
  "em primeiro lugar",
  "em segundo lugar",
  "por conseguinte",
  "consequentemente",
  "além disto",
  "diante disso",
];

/**
 * “a gente” + verbo: a forma da 1ª pessoa do plural, para a frase continuar com o mesmo sentido.
 * Só verbos de forma inequívoca entram aqui (nada de “para”, “como”, que viram confusão).
 */
const A_GENTE_VERBS: Record<string, string> = {
  // presente
  é: "somos", está: "estamos", tá: "estamos", tem: "temos", vai: "vamos", faz: "fazemos",
  pode: "podemos", quer: "queremos", precisa: "precisamos", sabe: "sabemos", diz: "dizemos",
  vê: "vemos", dá: "damos", fica: "ficamos", fala: "falamos", chega: "chegamos", passa: "passamos",
  leva: "levamos", deixa: "deixamos", usa: "usamos", ajuda: "ajudamos", trabalha: "trabalhamos",
  começa: "começamos", pensa: "pensamos", termina: "terminamos", revisa: "revisamos",
  manda: "mandamos", envia: "enviamos", mostra: "mostramos", compra: "compramos", olha: "olhamos",
  gosta: "gostamos", consegue: "conseguimos", entende: "entendemos", escreve: "escrevemos",
  lê: "lemos", vende: "vendemos", recebe: "recebemos", paga: "pagamos", chama: "chamamos",
  encontra: "encontramos", acha: "achamos", lembra: "lembramos", espera: "esperamos",
  mora: "moramos", estuda: "estudamos", anda: "andamos", corre: "corremos", come: "comemos",
  abre: "abrimos", decide: "decidimos", repete: "repetimos", pede: "pedimos", perde: "perdemos",
  sente: "sentimos", dorme: "dormimos", assiste: "assistimos", permite: "permitimos",
  acaba: "acabamos",
  // passado (perfeito)
  foi: "fomos", fez: "fizemos", teve: "tivemos", esteve: "estivemos", disse: "dissemos",
  viu: "vimos", deu: "demos", pôde: "pudemos", quis: "quisemos", soube: "soubemos",
  veio: "viemos", chegou: "chegamos", falou: "falamos", passou: "passamos", ficou: "ficamos",
  levou: "levamos", deixou: "deixamos", usou: "usamos", ajudou: "ajudamos",
  trabalhou: "trabalhamos", começou: "começamos", pensou: "pensamos", terminou: "terminamos",
  revisou: "revisamos", mandou: "mandamos", enviou: "enviamos", mostrou: "mostramos",
  comprou: "compramos", gostou: "gostamos", conseguiu: "conseguimos", entendeu: "entendemos",
  escreveu: "escrevemos", vendeu: "vendemos", recebeu: "recebemos", pagou: "pagamos",
  achou: "achamos", esperou: "esperamos", precisou: "precisamos", acabou: "acabamos",
  // imperfeito
  era: "éramos", estava: "estávamos", tinha: "tínhamos", ia: "íamos", fazia: "fazíamos",
  podia: "podíamos", queria: "queríamos", sabia: "sabíamos", dizia: "dizíamos", via: "víamos",
  dava: "dávamos", ficava: "ficávamos", falava: "falávamos", usava: "usávamos",
  precisava: "precisávamos", ajudava: "ajudávamos", gostava: "gostávamos", acabava: "acabávamos",
  // futuro e condicional
  será: "seremos", estará: "estaremos", terá: "teremos", irá: "iremos", fará: "faremos",
  poderá: "poderemos", quererá: "quereremos", dirá: "diremos", virá: "viremos", dará: "daremos",
  saberá: "saberemos", precisará: "precisaremos", ficará: "ficaremos", falará: "falaremos",
  seria: "seríamos", estaria: "estaríamos", teria: "teríamos", iria: "iríamos", faria: "faríamos",
  poderia: "poderíamos", gostaria: "gostaríamos", precisaria: "precisaríamos", ficaria: "ficaríamos",
};

/**
 * Corrige a frase “a gente + verbo” inteira: troca por “nós” e ajusta o verbo
 * (é o que faz o sentido continuar o mesmo, ex.: “a gente vai fazer” → “nós vamos fazer”).
 * Quando o verbo não está na lista, devolve só a sugestão para não errar.
 */
function aGenteFix(verb: string): string | null {
  const plural = A_GENTE_VERBS[verb.toLowerCase()];
  return plural || null;
}

/** Linguagem informal → alternativa formal. */
const INFORMAL: { rx: RegExp; message: string; fix?: string; suggestion?: string }[] = [
  { rx: /(?<![\p{L}])pra(?![\p{L}])/giu, message: "“pra” é informal — use “para”", fix: "para" },
  { rx: /(?<![\p{L}])pro(?![\p{L}])/giu, message: "“pro” é informal — use “para o”", fix: "para o" },
  { rx: /(?<![\p{L}])t[áa](?![\p{L}])/giu, message: "“tá” é informal — use “está”", fix: "está" },
  { rx: /(?<![\p{L}])n[ée](?![\p{L}])/giu, message: "“né” é informal — escreva por extenso (ex.: “não é?”)" },
  { rx: /(?<![\p{L}])um monte de(?![\p{L}])/giu, message: "“um monte de” é informal — use “muitos” ou “vários”", fix: "muitos" },
  { rx: /(?<![\p{L}])muito bom(?![\p{L}])/giu, message: "Em texto formal, “muito bom” pode virar “excelente”", suggestion: "excelente" },
  { rx: /(?<![\p{L}])bem legal(?![\p{L}])/giu, message: "“bem legal” é informal — use “muito interessante”", fix: "muito interessante" },
  { rx: /(?<![\p{L}])tipo assim(?![\p{L}])/giu, message: "“tipo assim” é informal — use “por exemplo”", fix: "por exemplo" },
  { rx: /(?<![\p{L}])acho que(?![\p{L}])/giu, message: "Em texto formal, prefira “considero que” ou “entendo que”", suggestion: "considero que" },
  { rx: /(?<![\p{L}])e tal(?![\p{L}])/giu, message: "“e tal” é informal — use “entre outros”", fix: "entre outros" },
  { rx: /(?<![\p{L}])da[íi](?![\p{L}])/giu, message: "“daí” é informal — prefira “então” ou “em seguida”" },
  { rx: /(?<![\p{L}])no final das contas(?![\p{L}])/giu, message: "“no final das contas” → “em última análise”", fix: "em última análise" },
  { rx: /(?<![\p{L}])por causa disso(?![\p{L}])/giu, message: "“por causa disso” → “por esse motivo”", fix: "por esse motivo" },
  { rx: /(?<![\p{L}])coisa(?![\p{L}])/giu, message: "“coisa” é vago em texto formal — prefira “item”, “elemento” ou “aspecto”", suggestion: "item" },
  { rx: /(?<![\p{L}])baita(?![\p{L}])/giu, message: "“baita” é informal — use “grande” ou “expressivo”", fix: "grande" },
  { rx: /(?<![\p{L}])muito massa(?![\p{L}])/giu, message: "“muito massa” é informal — use “excelente”", fix: "excelente" },
  { rx: /(?<![\p{L}])apps(?![\p{L}])/giu, message: "em texto formal prefira “aplicativos”", suggestion: "aplicativos", fix: "aplicativos" },
  { rx: /(?<![\p{L}])app(?![\p{L}])/giu, message: "em texto formal prefira “aplicativo”", suggestion: "aplicativo", fix: "aplicativo" },
];

/** Sinônimos curados para “usar outra palavra”. */
export const SYNONYMS: Record<string, string[]> = {
  importante: ["essencial", "fundamental", "relevante", "crucial", "decisivo"],
  grande: ["amplo", "enorme", "vasto", "extenso", "elevado"],
  pequeno: ["reduzido", "curto", "mínimo", "compacto", "leve"],
  bom: ["ótimo", "excelente", "adequado", "positivo", "eficaz"],
  ruim: ["fraco", "inadequado", "precário", "insuficiente", "negativo"],
  rápido: ["ágil", "veloz", "imediato", "acelerado"],
  lento: ["devagar", "gradual", "moroso", "arrastado"],
  problema: ["questão", "falha", "dificuldade", "obstáculo", "erro"],
  solução: ["resposta", "saída", "alternativa", "medida"],
  ajuda: ["apoio", "suporte", "auxílio", "colaboração"],
  melhorar: ["aperfeiçoar", "aprimorar", "elevar", "otimizar", "refinar"],
  fazer: ["realizar", "executar", "produzir", "elaborar", "desenvolver"],
  criar: ["desenvolver", "produzir", "montar", "elaborar", "gerar"],
  mostrar: ["exibir", "apresentar", "demonstrar", "indicar", "revelar"],
  usar: ["utilizar", "empregar", "aplicar", "adotar"],
  mudar: ["alterar", "ajustar", "modificar", "trocar", "revisar"],
  difícil: ["complexo", "desafiador", "trabalhoso", "complicado"],
  fácil: ["simples", "direto", "descomplicado", "prático"],
  bonito: ["elegante", "agradável", "atraente", "bem-feito"],
  interessante: ["relevante", "curioso", "notável", "instigante"],
  muito: ["bastante", "considerável", "elevado", "intenso"],
  pouco: ["reduzido", "mínimo", "limitado", "escasso"],
  sempre: ["constantemente", "invariavelmente", "em todos os casos"],
  nunca: ["jamais", "em nenhum caso"],
  começar: ["iniciar", "abrir", "dar início", "arrancar"],
  terminar: ["concluir", "finalizar", "encerrar", "completar"],
  claro: ["evidente", "nítido", "objetivo", "transparente"],
  forte: ["robusto", "consistente", "intenso", "sólido"],
  novo: ["recente", "inédito", "atualizado", "moderno"],
  antigo: ["anterior", "prévio", "original", "tradicional"],
  ideia: ["conceito", "proposta", "noção", "plano"],
  objetivo: ["meta", "finalidade", "propósito", "intuito"],
  exemplo: ["modelo", "caso", "amostra", "demonstração"],
  erro: ["falha", "equívoco", "engano", "defeito"],
  tempo: ["prazo", "período", "duração", "momento"],
  pessoa: ["indivíduo", "alguém", "usuário", "participante"],
  trabalho: ["tarefa", "atividade", "projeto", "esforço"],
  resultado: ["conclusão", "desfecho", "efeito", "produto"],
  explicar: ["detalhar", "esclarecer", "descrever", "justificar"],
  entender: ["compreender", "assimilar", "captar", "perceber"],
  pensar: ["refletir", "considerar", "avaliar", "ponderar"],
  verificar: ["conferir", "checar", "validar", "confirmar"],
  adicionar: ["incluir", "acrescentar", "inserir", "incorporar"],
  remover: ["retirar", "excluir", "eliminar", "apagar"],
  garantir: ["assegurar", "certificar", "garantir"],
  permitir: ["possibilitar", "autorizar", "habilitar"],
  precisar: ["necessitar", "requerer", "demandar"],
  acontecer: ["ocorrer", "suceder", "verificar-se"],
  enorme: ["gigantesco", "colossal", "imenso"],
  rápido_e_fácil: [],
};

// ---------- utilitários ----------

/** Esconde trechos que não devem ser corrigidos (código, links, front-matter). */
const MASCA = "·";
const mascara = (n: number) => MASCA.repeat(Math.max(0, n));

function maskNonProse(text: string): string {
  const lines = text.split("\n");
  let inFence = false;
  const masked = lines.map((line, index) => {
    const fence = /^\s*(```|~~~)/.test(line);
    if (fence) {
      inFence = !inFence;
      return mascara(line.length);
    }
    if (inFence) return mascara(line.length);
    if (index === 0 && /^---\s*$/.test(line)) return mascara(line.length);
    let out = line;
    // links/imagens: mantém só o rótulo, no lugar certo e com o mesmo comprimento
    out = out.replace(/!\[([^\]]*)\]\(([^)]*)\)/g, (_m, label: string, url: string) => `${mascara(2)}${label}${mascara(3 + url.length)}`);
    out = out.replace(/\[([^\]]*)\]\(([^)]*)\)/g, (_m, label: string, url: string) => `${mascara(1)}${label}${mascara(3 + url.length)}`);
    // html
    out = out.replace(/<[^>]+>/g, (m) => mascara(m.length));
    // código embutido
    out = out.replace(/`[^`]*`/g, (m) => mascara(m.length));
    // URLs soltas
    out = out.replace(/https?:\/\/\S+/g, (m) => mascara(m.length));
    return out;
  });
  let result = masked.join("\n");
  // front-matter (--- no topo)
  if (/^---\s*\n/.test(text)) {
    const end = result.indexOf(`\n${MASCA}---`, 3);
    if (end > 0) {
      result = mascara(end + 4) + result.slice(end + 4);
    }
  }
  return result;
}

function isInsideMask(text: string, from: number, to: number): boolean {
  const pedaco = maskNonProse(text).slice(from, to);
  return /^[·\s]*$/.test(pedaco) && pedaco.includes(MASCA) && text.slice(from, to).trim() !== "";
}

// ---------- ortografia ----------

interface SpellHit {
  word: string;
  suggestions: string[];
  /** correção em que dá para confiar (aplicada sozinha pela correção automática) */
  best?: string;
}

let spellWorker: Worker | null = null;
let spellReady = false;
let spellFailed = false;
let spellId = 1;
const spellPending = new Map<number, (hits: SpellHit[]) => void>();

/** Começa a carregar o dicionário em segundo plano (não trava a interface). */
export function warmUpSpell(): void {
  ensureSpellWorker();
}

export function spellIsReady(): boolean {
  return spellReady;
}

export function spellHasFailed(): boolean {
  return spellFailed;
}

const spellReadyCallbacks: (() => void)[] = [];

/** Chama o callback quando o dicionário terminar de carregar. */
export function onSpellReady(cb: () => void): void {
  if (spellReady) {
    cb();
    return;
  }
  spellReadyCallbacks.push(cb);
}

function ensureSpellWorker(): Worker | null {
  if (spellWorker || spellFailed) return spellWorker;
  try {
    spellWorker = new Worker(new URL("./spell.worker.ts", import.meta.url), { type: "module" });
  } catch (err) {
    spellFailed = true;
    console.warn("Corretor indisponível:", err);
    return null;
  }
  spellWorker.addEventListener("message", (event: MessageEvent) => {
    const data = event.data as { type: string; id?: number; hits?: SpellHit[]; error?: string };
    if (data.type === "ready") {
      spellReady = true;
      for (const cb of spellReadyCallbacks.splice(0)) cb();
      return;
    }
    if (data.type === "failed") {
      spellFailed = true;
      console.warn("Dicionário pt-BR indisponível:", data.error);
      for (const resolve of spellPending.values()) resolve([]);
      spellPending.clear();
      return;
    }
    if (data.type === "result" && data.id !== undefined) {
      const resolve = spellPending.get(data.id);
      spellPending.delete(data.id);
      resolve?.(data.hits ?? []);
    }
  });
  spellWorker.postMessage({ type: "init", base: document.baseURI });
  return spellWorker;
}

/** Aguarda o dicionário ficar pronto (espera curta: o resto roda em segundo plano). */
async function waitForSpell(timeoutMs = 3000): Promise<boolean> {
  if (spellReady) return true;
  if (spellFailed) return false;
  const started = Date.now();
  while (!spellReady && !spellFailed && Date.now() - started < timeoutMs) {
    await new Promise((r) => window.setTimeout(r, 200));
  }
  return spellReady;
}

async function checkWords(words: string[]): Promise<Map<string, SpellHit>> {
  const worker = ensureSpellWorker();
  if (!worker || spellFailed || !words.length) return new Map();
  if (!(await waitForSpell())) return new Map();
  const hits = await new Promise<SpellHit[]>((resolve) => {
    const id = spellId++;
    spellPending.set(id, resolve);
    worker.postMessage({ type: "check", id, words });
  });
  return new Map(hits.map((h) => [h.word, h]));
}

// ---------- regras de estilo ----------

export function checkStyle(text: string): WritingIssue[] {
  const issues: WritingIssue[] = [];
  const mask = maskNonProse(text);

  const push = (from: number, to: number, message: string, fix?: string, suggestions: string[] = [], safe = false) => {
    const word = text.slice(from, to);
    if (!word.trim()) return;
    issues.push({ from, to, word, kind: "style", message, suggestions, fix, safe });
  };

  // abreviações de internet
  const wordRx = /[\p{L}]+/gu;
  let m: RegExpExecArray | null;
  while ((m = wordRx.exec(mask)) !== null) {
    const raw = m[0];
    const lower = raw.toLowerCase();
    const replacement = ABBREVIATIONS[lower];
    if (replacement && raw === lower) {
      push(m.index, m.index + raw.length, `“${raw}” → “${replacement}” (abreviação de internet)`, replacement, [replacement], true);
      continue;
    }
    const glued = GLUED[lower];
    if (glued && glued !== lower && raw === lower) {
      push(m.index, m.index + raw.length, `“${raw}” parece junto — escreva “${glued}”`, glued, [glued], true);
    }
  }

  // palavras repetidas (“de de”)
  const repeatRx = /\b([\p{L}]{2,})\s+\1\b/giu;
  while ((m = repeatRx.exec(mask)) !== null) {
    const whole = m[0];
    const single = m[1];
    push(m.index, m.index + whole.length, `Repetição: “${single} ${single}”`, single, [single], true);
  }

  // espaços duplos
  const doubleSpaceRx = /[^\S\n]{2,}/g;
  while ((m = doubleSpaceRx.exec(mask)) !== null) {
    const start = m.index;
    const end = m.index + m[0].length;
    const after = /^[\p{L}\d]+/u.exec(text.slice(end))?.[0];
    if (after) {
      // inclui a palavra seguinte para o aviso ficar visível e substituível
      push(start, end + after.length, "Espaços extras", ` ${after}`, [], true);
    } else if (start > 0) {
      push(start - 1, end, "Espaços extras", text.slice(start - 1, start), [], true);
    }
  }

  // espaço antes de pontuação
  const spaceBeforeRx = /\s+([,.;:!?])/g;
  while ((m = spaceBeforeRx.exec(mask)) !== null) {
    push(m.index, m.index + m[0].length, `Espaço antes de “${m[1]}”`, m[1], [], true);
  }

  // falta de espaço depois da pontuação
  const noSpaceRx = /([,;:])(?=[\p{L}])/gu;
  while ((m = noSpaceRx.exec(mask)) !== null) {
    push(m.index, m.index + 1, `Falta um espaço depois de “${m[1]}”`, `${m[1]} `, [], true);
  }

  // pontuação repetida (!!! / ???)
  const repeatedPunct = /([!?])\1{2,}/g;
  while ((m = repeatedPunct.exec(mask)) !== null) {
    push(m.index, m.index + m[0].length, "Pontuação repetida demais", m[1], [], true);
  }

  // expressões que pedem vírgula dos DOIS lados (no meio da frase)
  const entreVirgulas = /\b(ou seja|isto é|por exemplo|em outras palavras|ou melhor|no entanto|porém|contudo|entretanto|todavia|portanto|além disso|além do mais)\b/giu;
  while ((m = entreVirgulas.exec(mask)) !== null) {
    const ini = m.index;
    const fim = ini + m[0].length;
    const antes = text.slice(Math.max(0, ini - 1), ini);
    const depois = text.slice(fim, fim + 1);
    if (antes === "," || depois === "," || antes === "\n" || antes === "") continue;
    if (ini === 0 || text.slice(Math.max(0, ini - 1), ini) === "\n") continue; // começo de linha: outra regra cuida
    push(ini, fim, `Em volta de “${m[0]}” costumam vir vírgulas`, `, ${m[0]},`, [], false);
  }

  // trecho comprido sem NENHUMA pontuação: falta vírgula/ponto entre as orações
  // (não tenta adivinhar onde: só avisa — quebrar orações precisa de leitura humana)
  const semPontoRx = /(?<![\p{L}\d])[\p{L}\d]+(?:\s+[\p{L}\d]+){24,}/gu;
  while ((m = semPontoRx.exec(mask)) !== null) {
    const inicio = m.index;
    const fim = inicio + Math.min(m[0].length, 60);
    push(
      inicio,
      fim,
      "Esse trecho está muito longo sem vírgulas nem pontos — separe em orações (frases curtas leem melhor e a IA entende melhor)",
      undefined,
      [],
      false
    );
  }

  // frases começando com minúscula (depois de . ! ?)
  const lowerAfterRx = /([.!?])\s+([a-záàâãéêíóôõúç][\p{L}]*)/gu;
  while ((m = lowerAfterRx.exec(mask)) !== null) {
    const before = mask.slice(Math.max(0, m.index - 4), m.index + 1);
    if (/\b(etc|ex|pág|sr|sra|dr|dra|vs)\.$/i.test(before)) continue;
    const word = m[2];
    const start = m.index + m[1].length + m[0].slice(m[1].length).search(/\S/);
    push(start, start + word.length, "Comece a frase com maiúscula", word[0].toUpperCase() + word.slice(1), [], true);
  }

  // início do texto ou de um parágrafo começando com minúscula
  const paraStartRx = /(^|\n[^\S\n]*\n)[^\S\n]*(["“'«(]?)([a-záàâãéêíóôõúç][\p{L}]*)/gu;
  while ((m = paraStartRx.exec(mask)) !== null) {
    const word = m[3];
    const start = m.index + m[0].length - word.length;
    push(start, start + word.length, "Comece o parágrafo com maiúscula", word[0].toUpperCase() + word.slice(1), [], true);
  }

  // expressões
  for (const phrase of PHRASES) {
    phrase.rx.lastIndex = 0;
    while ((m = phrase.rx.exec(mask)) !== null) {
      push(m.index, m.index + m[0].length, phrase.message, phrase.fix, [phrase.fix]);
    }
  }

  // vírgula antes de "mas", "porém", "contudo"…
  const adversativeRx = /(?<![\p{L},;:\n])([\p{L}]{2,})\s+(mas|porém|contudo|entretanto|todavia)(?![\p{L}])/giu;
  while ((m = adversativeRx.exec(mask)) !== null) {
    const conjStart = m.index + m[0].length - m[2].length;
    const wsStart = m.index + m[1].length;
    push(wsStart, conjStart + m[2].length, `Falta vírgula antes de “${m[2]}”`, `, ${m[2]}`, [`, ${m[2]}`]);
  }

  // vírgula depois de conectivos no começo da frase
  for (const conn of INTRO_CONNECTIVES) {
    const rx = new RegExp(`(?:^|[.!?]\\s+|\\n)(${conn})(?=\\s+[\\p{L}])`, "giu");
    while ((m = rx.exec(mask)) !== null) {
      const matched = m[1];
      const start = m.index + (m[0].length - matched.length);
      push(start, start + matched.length, `Depois de “${matched}” costuma vir uma vírgula`, `${matched},`, [`${matched},`]);
    }
  }

  // ponto final faltando em parágrafos
  {
    const lines = text.split("\n");
    const maskLines = mask.split("\n");
    let offset = 0;
    for (let i = 0; i < lines.length; i++) {
      const raw = lines[i];
      const trimmed = (maskLines[i] ?? "").trim();
      const words = trimmed.split(/\s+/).filter(Boolean).length;
      const skip = trimmed === "" || /^[#>\-*+\d|`<]/.test(trimmed) || /[|:]\s*$/.test(trimmed);
      const endsOk = /[.!?:;…)\]"'»]$/.test(trimmed);
      // o ponto só falta no FIM DO PARÁGRAFO: se a linha de baixo continua o texto,
      // a frase segue ali (é escrita "quebrada" em várias linhas) — não é erro
      const proxima = (maskLines[i + 1] ?? "").trim();
      const proximaCrua = (lines[i + 1] ?? "").trim();
      const fimDeParagrafo =
        i + 1 >= lines.length ||
        proxima === "" ||
        proximaCrua === "" ||
        /^([#>|`]|!\[|[-*+]\s|\d+\.\s|```)/.test(proximaCrua);
      if (!skip && fimDeParagrafo && words >= 3 && !endsOk && /[\p{L}\d]$/u.test(trimmed)) {
        const lineEnd = offset + raw.trimEnd().length;
        const wm = /[\p{L}\d]+$/u.exec(text.slice(offset, lineEnd));
        const start = lineEnd - (wm ? wm[0].length : 1);
        push(start, lineEnd, "Falta o ponto final no fim do parágrafo", `${text.slice(start, lineEnd)}.`, []);
      }
      offset += raw.length + 1;
    }
  }

  // registro informal → formal
  for (const rule of INFORMAL) {
    rule.rx.lastIndex = 0;
    while ((m = rule.rx.exec(mask)) !== null) {
      push(m.index, m.index + m[0].length, rule.message, rule.fix, rule.suggestion ? [rule.suggestion] : []);
    }
  }

  // “a gente” + verbo: corrige a frase inteira, com o verbo na pessoa certa
  const aGenteRx = /(?<![\p{L}])(a gente|A gente)([^\S\n]+([\p{L}]+))?/gu;
  while ((m = aGenteRx.exec(mask)) !== null) {
    const phrase = m[1];
    const verb = m[3];
    const quem = phrase[0] === "A" ? "Nós" : "nós";
    const plural = verb ? aGenteFix(verb) : null;
    if (verb && plural) {
      push(
        m.index,
        m.index + m[0].length,
        `“${phrase} ${verb}” é informal — em texto formal fica “${quem} ${plural}” (mesmo sentido)`,
        `${quem} ${plural}`,
        [`${quem} ${plural}`],
        true
      );
    } else {
      push(
        m.index,
        m.index + phrase.length,
        `“${phrase}” é informal — em texto formal use “${quem}” (ajuste o verbo)`,
        undefined,
        [],
        false
      );
    }
  }

  const seen = new Set<string>();
  return issues
    .filter((i) => !isInsideMask(text, i.from, i.to))
    .filter((i) => {
      const key = `${i.from}-${i.to}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => a.from - b.from);
}

// ---------- frase longa + estatísticas ----------

export function stats(text: string): WritingStats {
  const mask = maskNonProse(text).replace(/\s+/g, " ");
  const words = (mask.match(/[\p{L}\p{N}][\p{L}\p{N}'-]*/gu) ?? []).length;
  const sentences = mask.split(/[.!?]+\s/).filter((s) => s.trim().length > 12);
  let longSentences = 0;
  for (const s of sentences) {
    const n = (s.match(/[\p{L}\p{N}][\p{L}\p{N}'-]*/gu) ?? []).length;
    if (n > 35) longSentences++;
  }

  // palavras repetidas com exagero (fora de listas de parada)
  const stop = new Set([
    "a", "o", "as", "os", "de", "da", "do", "das", "dos", "e", "é", "em", "um", "uma", "para", "por",
    "com", "que", "não", "na", "no", "se", "ao", "aos", "à", "às", "the", "of", "to", "and",
  ]);
  const counts = new Map<string, { count: number; from: number; to: number }>();
  const rx = /[\p{L}]{4,}/gu;
  let m: RegExpExecArray | null;
  while ((m = rx.exec(mask)) !== null) {
    const lower = m[0].toLowerCase();
    if (stop.has(lower)) continue;
    const current = counts.get(lower);
    if (current) current.count++;
    else counts.set(lower, { count: 1, from: m.index, to: m.index + m[0].length });
  }
  const repeated = Array.from(counts.entries())
    .filter(([, v]) => v.count >= 5)
    .map(([word, v]) => ({ word, count: v.count, from: v.from, to: v.to }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);

  const sentCount = Math.max(1, sentences.length);
  return {
    words,
    sentences: sentences.length,
    avgWordsPerSentence: Math.round((words / sentCount) * 10) / 10,
    longSentences,
    repeated,
  };
}

// ---------- verificação completa ----------

export async function checkText(text: string, ignore: Set<string>): Promise<WritingIssue[]> {
  const issues = checkStyle(text);
  const mask = maskNonProse(text);
  const rx = /[\p{L}][\p{L}'-]{2,}/gu;
  const tokens: { word: string; from: number; to: number }[] = [];
  const unique = new Set<string>();
  let m: RegExpExecArray | null;
  while ((m = rx.exec(mask)) !== null) {
    const word = m[0];
    const lower = word.toLowerCase();
    if (ignore.has(lower)) continue;
    if (ABBREVIATIONS[lower] || GLUED[lower]) continue;
    if (word === word.toUpperCase() && word.length <= 4) continue;
    tokens.push({ word, from: m.index, to: m.index + word.length });
    unique.add(word);
  }
  if (tokens.length) {
    const wrong = await checkWords(Array.from(unique));
    for (const token of tokens) {
      const hit = wrong.get(token.word);
      if (hit) {
        issues.push({
          from: token.from,
          to: token.to,
          word: token.word,
          kind: "spell",
          message: `“${token.word}” não está no dicionário`,
          suggestions: hit.suggestions,
          auto: hit.best,
        });
        continue;
      }
      // A palavra existe no dicionário, mas pode ser um erro de uma letra
      // numa palavra muito comum (ex.: "maneria" → "maneira").
      const near = commonNeighbor(token.word);
      if (near) {
        issues.push({
          from: token.from,
          to: token.to,
          word: token.word,
          kind: "style",
          message: `“${token.word}” existe, mas você quis dizer “${near}”?`,
          suggestions: [near],
        });
      }
    }
  }
  // Junta avisos que caem no MESMO trecho: palavra errada + falta do ponto final.
  // Assim a correção da palavra já sai com o ponto ("correçao" → "correção."), em vez de
  // um aviso anular o outro (antes eles se sobrepunham e só um era aplicado).
  const fundidos: WritingIssue[] = [];
  for (const i of issues) {
    const par = fundidos.find((f) => f.kind !== i.kind && f.from === i.from && f.to === i.to);
    if (par && (/ponto final/.test(par.message) || /ponto final/.test(i.message))) {
      const palavra = par.kind === "spell" ? par : i;
      palavra.message = `${palavra.message} — e falta o ponto final`;
      palavra.suggestions = palavra.suggestions.map((s) => (s.endsWith(".") ? s : `${s}.`));
      if (palavra.auto && !palavra.auto.endsWith(".")) palavra.auto = `${palavra.auto}.`;
      if (palavra.fix && !palavra.fix.endsWith(".")) palavra.fix = `${palavra.fix}.`;
      fundidos.splice(fundidos.indexOf(par), 1);
      fundidos.push(palavra);
      continue;
    }
    fundidos.push(i);
  }
  return fundidos.sort((a, b) => a.from - b.from);
}

/** Sinônimos para trocar a palavra por outra. */
export function synonymsFor(word: string): string[] {
  const key = word.toLowerCase();
  return SYNONYMS[key] ?? [];
}
