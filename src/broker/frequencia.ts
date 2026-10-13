// Frequência das palavras no corpus de texto escrito, para a interface.
//
// Responsabilidade: dizer quantas vezes uma palavra aparece em texto real. É o
// que separa "palavra que as pessoas escrevem" de "palavra que existe no
// dicionário mas quase ninguém usa" — distinção que o dicionário sozinho não faz.
//
// O arquivo é o mesmo que o corretor usa (`ngrams/freq-pt.json`), carregado uma
// vez e guardado em memória. Enquanto não chega, `contagem` devolve 0 e quem
// depende dela simplesmente não opina — nunca inventa.

import { normalizar } from "./spell/candidatos";

const CAMINHO = "ngrams/freq-pt.json";

let tabela: Map<string, number> | null = null;
let carregando: Promise<void> | null = null;

/** Carrega a tabela (uma vez). Chamadas seguintes reaproveitam a mesma promessa. */
export function carregarFrequencia(base?: string): Promise<void> {
  if (tabela) return Promise.resolve();
  if (carregando) return carregando;
  carregando = (async () => {
    try {
      const raiz = base ?? (typeof document !== "undefined" ? document.baseURI : "/");
      const res = await fetch(new URL(CAMINHO, raiz));
      if (!res.ok) return;
      const dados = (await res.json()) as { w?: string[]; n?: number[] };
      if (!Array.isArray(dados.w) || !Array.isArray(dados.n)) return;
      const mapa = new Map<string, number>();
      for (let i = 0; i < dados.w.length; i++) {
        const chave = normalizar(dados.w[i]);
        const n = dados.n[i] ?? 0;
        const atual = mapa.get(chave);
        if (atual === undefined || n > atual) mapa.set(chave, n);
      }
      tabela = mapa;
    } catch {
      /* sem a tabela: as regras que dependem dela ficam quietas */
    }
  })();
  return carregando;
}

/** Já dá para usar a frequência? */
export function frequenciaPronta(): boolean {
  return tabela !== null;
}

/** Quantas vezes a palavra aparece no corpus (0 quando não se sabe). */
export function contagem(palavra: string): number {
  if (!tabela) return 0;
  return tabela.get(normalizar(palavra)) ?? 0;
}
