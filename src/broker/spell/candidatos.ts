// Geração de candidatos para uma palavra desconhecida.
//
// Responsabilidade: dada uma palavra que o dicionário não conhece, devolver as
// palavras reais mais prováveis — em ordem de confiança. Não sabe nada de DOM,
// de worker nem de onde a frequência veio: recebe o vocabulário e as contagens
// prontos, o que torna este módulo testável fora do navegador.
//
// Como escolhe, em três passos:
//   1. CANDIDATOS — um índice invertido de trigramas aponta as palavras que
//      compartilham pedaços de 3 letras com a palavra errada. É o que faz o
//      acerto não depender de ONDE está o erro: "estenso" encontra "extenso"
//      mesmo trocando a segunda letra.
//   2. DISTÂNCIA — quantas edições separam as duas (trocar, inserir, apagar ou
//      inverter letras de lugar). É o sinal mais forte de "foi isso que a pessoa
//      quis escrever" e vem antes de qualquer outra coisa.
//   3. FREQUÊNCIA — entre candidatos igualmente próximos, ganha o que as pessoas
//      realmente escrevem. É o que separa "extenso" de "esterno" e o que evita
//      sugerir palavra rara para erro de palavra comum.
//
// O peso da frequência é ajustável porque existe uma tensão real: alta demais e
// uma palavra comum porém distante passa na frente da certa; baixa demais e o
// empate entre duas palavras igualmente próximas fica arbitrário.

/** Palavra com acento removido e minúscula — a forma usada para comparar. */
export function normalizar(palavra: string): string {
  return palavra
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase();
}

export interface Frequencia {
  /** forma normalizada → quantas vezes aparece no corpus */
  contagem: Map<string, number>;
  /** log da maior contagem, para normalizar o peso entre 0 e 1 */
  maxLog: number;
}

/** Monta a tabela de frequência a partir das palavras e contagens do corpus. */
export function montarFrequencia(palavras: string[], contagens: number[]): Frequencia {
  const contagem = new Map<string, number>();
  let maior = 1;
  for (let i = 0; i < palavras.length; i++) {
    const n = contagens[i] ?? 0;
    const chave = normalizar(palavras[i]);
    // duas grafias podem normalizar igual ("café"/"cafe"): fica a maior
    const atual = contagem.get(chave);
    if (atual === undefined || n > atual) contagem.set(chave, n);
    if (n > maior) maior = n;
  }
  return { contagem, maxLog: Math.log1p(maior) };
}

export interface Indice {
  /** trigrama → posições das palavras em `palavras` */
  baldes: Map<string, number[]>;
  /** as palavras como aparecem (com acento), na ordem do vocabulário */
  palavras: string[];
  /** forma normalizada de cada palavra (mesma ordem) */
  normalizadas: string[];
}

/** Pedaços de 3 letras de uma palavra, sem repetir (o índice não precisa de peso). */
function trigramas(palavra: string): string[] {
  if (palavra.length < 3) return [palavra];
  const vistos = new Set<string>();
  for (let i = 0; i + 3 <= palavra.length; i++) vistos.add(palavra.slice(i, i + 3));
  return [...vistos];
}

/**
 * Índice invertido de trigramas. Custo de memória proporcional ao número de
 * trigramas distintos, não ao número de pares de palavras — por isso cabe em
 * memória mesmo com dezenas de milhares de palavras.
 */
export function construirIndice(palavras: string[]): Indice {
  const baldes = new Map<string, number[]>();
  const normalizadas: string[] = new Array(palavras.length);
  for (let i = 0; i < palavras.length; i++) {
    const n = normalizar(palavras[i]);
    normalizadas[i] = n;
    for (const g of trigramas(n)) {
      let balde = baldes.get(g);
      if (!balde) baldes.set(g, (balde = []));
      balde.push(i);
    }
  }
  return { baldes, palavras, normalizadas };
}

/**
 * Distância de edição (Damerau-Levenshtein): quantas operações de trocar uma
 * letra, inserir, apagar ou inverter duas vizinhas separam as duas palavras.
 * A inversão conta como UMA operação porque trocar letras de lugar é um erro de
 * digitação típico ("maneria" → "maneira").
 *
 * Para no limite `max` e devolve `max + 1` quando passa — assim uma comparação
 * descartada custa pouco.
 */
export function distancia(a: string, b: string, max: number): number {
  const n = a.length;
  const m = b.length;
  if (Math.abs(n - m) > max) return max + 1;
  if (n === 0) return m <= max ? m : max + 1;
  if (m === 0) return n <= max ? n : max + 1;

  let anterior2 = new Uint16Array(m + 1);
  let anterior1 = new Uint16Array(m + 1);
  let atual = new Uint16Array(m + 1);
  for (let j = 0; j <= m; j++) anterior1[j] = j;

  for (let i = 1; i <= n; i++) {
    atual[0] = i;
    let melhorDaLinha = i;
    const ca = a.charCodeAt(i - 1);
    for (let j = 1; j <= m; j++) {
      const custo = ca === b.charCodeAt(j - 1) ? 0 : 1;
      let v = Math.min(anterior1[j] + 1, atual[j - 1] + 1, anterior1[j - 1] + custo);
      // inversão de duas letras vizinhas
      if (i > 1 && j > 1 && ca === b.charCodeAt(j - 2) && a.charCodeAt(i - 2) === b.charCodeAt(j - 1)) {
        const v2 = anterior2[j - 2] + 1;
        if (v2 < v) v = v2;
      }
      atual[j] = v;
      if (v < melhorDaLinha) melhorDaLinha = v;
    }
    if (melhorDaLinha > max) return max + 1;
    const troca = anterior2;
    anterior2 = anterior1;
    anterior1 = atual;
    atual = troca;
  }
  return anterior1[m];
}

export interface Candidato {
  palavra: string;
  distancia: number;
  contagem: number;
  /** nota final (maior é melhor) */
  nota: number;
}

export interface OpcoesCandidatos {
  /** limite de edições aceitas (padrão: 1 para palavras curtas, 2 para o resto) */
  maxDistancia?: number;
  /** quantos candidatos devolver */
  limite?: number;
  /** quanto a frequência pesa contra a distância (padrão calibrado no corpus) */
  pesoFrequencia?: number;
}

/** Peso padrão da frequência. Calibrado contra `test/docs/gramatical.md`. */
export const PESO_FREQUENCIA = 3.7;

/**
 * Palavras reais mais prováveis para uma palavra desconhecida, da melhor para a
 * pior. Devolve lista vazia quando não há nada razoável — é melhor não sugerir
 * do que sugerir palavra sem relação.
 */
export function candidatos(
  palavra: string,
  indice: Indice,
  frequencia: Frequencia,
  opcoes: OpcoesCandidatos = {}
): Candidato[] {
  const p = normalizar(palavra);
  const maxDist = opcoes.maxDistancia ?? (p.length <= 4 ? 1 : 2);
  const limite = opcoes.limite ?? 40;
  const peso = opcoes.pesoFrequencia ?? PESO_FREQUENCIA;

  // 1) candidatos: quem compartilha trigramas
  const vistos = new Set<number>();
  const achados: Candidato[] = [];
  for (const g of trigramas(p)) {
    const balde = indice.baldes.get(g);
    if (!balde) continue;
    for (const i of balde) {
      if (vistos.has(i)) continue;
      vistos.add(i);
      const c = indice.normalizadas[i];
      if (Math.abs(c.length - p.length) > maxDist) continue;
      const d = distancia(p, c, maxDist);
      if (d > maxDist) continue;
      const n = frequencia.contagem.get(c) ?? 0;
      const pesoFreq = Math.log1p(n) / frequencia.maxLog;
      achados.push({ palavra: indice.palavras[i], distancia: d, contagem: n, nota: -d + peso * pesoFreq });
    }
  }

  // 2) ordena: nota (distância + frequência) e, no empate, mais frequente primeiro
  achados.sort((a, b) => b.nota - a.nota || b.contagem - a.contagem || a.palavra.localeCompare(b.palavra));
  return achados.slice(0, limite);
}
