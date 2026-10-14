// ABNT — leitor do subconjunto de TOML que o schema usa.
//
// Por que não um parser de verdade: as regras e os perfis usam um subconjunto pequeno
// e fechado (`chave = valor`, textos literal e básico, booleano, número, tabela em
// linha e seção `[a.b]`), e o `node_modules` das worktrees é um junction — trazer uma
// dependência nova quebraria as outras worktrees até a cópia principal instalar.
// Se o formato crescer (arrays de tabelas, datas, chaves pontuadas), trocar por um
// parser de verdade em vez de estender este.
//
// O que ele NÃO aceita, ele recusa com a linha — nunca adivinha.

export type ValorToml = string | number | boolean | ValorToml[] | { [chave: string]: ValorToml };
export type TabelaToml = { [chave: string]: ValorToml };

/** Erro de leitura com a linha, para o TOML recusado não virar erro obscuro depois. */
export class ErroToml extends Error {
  constructor(
    readonly linha: number,
    mensagem: string
  ) {
    super(`linha ${linha}: ${mensagem}`);
    this.name = "ErroToml";
  }
}

const ESCAPES: Record<string, string> = { n: "\n", t: "\t", r: "\r", "\\": "\\", '"': '"' };

/** Um valor a partir do texto, começando em `i`. Devolve o valor e onde parou. */
function lerValor(texto: string, i: number, linha: number): { valor: ValorToml; fim: number } {
  while (texto[i] === " " || texto[i] === "\t") i++;
  const c = texto[i];

  // texto literal: nada é interpretado
  if (c === "'") {
    const fim = texto.indexOf("'", i + 1);
    if (fim < 0) throw new ErroToml(linha, "texto literal sem fechar");
    return { valor: texto.slice(i + 1, fim), fim: fim + 1 };
  }

  // texto básico: escapes curtos e \uXXXX
  if (c === '"') {
    let out = "";
    let j = i + 1;
    while (j < texto.length) {
      const d = texto[j];
      if (d === '"') return { valor: out, fim: j + 1 };
      if (d === "\\") {
        const e = texto[j + 1] ?? "";
        if (e === "u") {
          out += String.fromCharCode(parseInt(texto.slice(j + 2, j + 6), 16));
          j += 6;
          continue;
        }
        if (!(e in ESCAPES)) throw new ErroToml(linha, `escape desconhecido: \\${e}`);
        out += ESCAPES[e];
        j += 2;
        continue;
      }
      out += d;
      j++;
    }
    throw new ErroToml(linha, "texto básico sem fechar");
  }

  // tabela em linha: { a = 1, b = "x" }
  if (c === "{") {
    const tabela: TabelaToml = {};
    let j = i + 1;
    for (;;) {
      while (texto[j] === " " || texto[j] === "\t") j++;
      if (texto[j] === "}") return { valor: tabela, fim: j + 1 };
      const igual = texto.indexOf("=", j);
      if (igual < 0) throw new ErroToml(linha, "tabela em linha sem '='");
      const chave = texto.slice(j, igual).trim();
      if (!chave) throw new ErroToml(linha, "tabela em linha sem chave");
      const { valor, fim } = lerValor(texto, igual + 1, linha);
      tabela[chave.replace(/^["']|["']$/g, "")] = valor;
      j = fim;
      while (texto[j] === " " || texto[j] === "\t") j++;
      if (texto[j] === ",") {
        j++;
        continue;
      }
      if (texto[j] === "}") return { valor: tabela, fim: j + 1 };
      throw new ErroToml(linha, "tabela em linha: esperava ',' ou '}'");
    }
  }

  // lista (uma linha)
  if (c === "[") {
    const lista: ValorToml[] = [];
    let j = i + 1;
    for (;;) {
      while (texto[j] === " " || texto[j] === "\t") j++;
      if (texto[j] === "]") return { valor: lista, fim: j + 1 };
      const { valor, fim } = lerValor(texto, j, linha);
      lista.push(valor);
      j = fim;
      while (texto[j] === " " || texto[j] === "\t") j++;
      if (texto[j] === ",") {
        j++;
        continue;
      }
      if (texto[j] === "]") return { valor: lista, fim: j + 1 };
      throw new ErroToml(linha, "lista: esperava ',' ou ']'");
    }
  }

  // booleano, número ou palavra solta
  const resto = texto.slice(i);
  if (/^true\b/.test(resto)) return { valor: true, fim: i + 4 };
  if (/^false\b/.test(resto)) return { valor: false, fim: i + 5 };
  const numero = resto.match(/^-?\d+(?:\.\d+)?/);
  if (numero) return { valor: Number(numero[0]), fim: i + numero[0].length };

  throw new ErroToml(linha, `valor não reconhecido: ${resto.slice(0, 24)}`);
}

/** Tira o comentário de uma linha, respeitando textos. */
function semComentario(linha: string): string {
  let dentro: string | null = null;
  for (let i = 0; i < linha.length; i++) {
    const c = linha[i];
    if (dentro) {
      if (c === "\\" && dentro === '"') i++;
      else if (c === dentro) dentro = null;
      continue;
    }
    if (c === '"' || c === "'") {
      dentro = c;
      continue;
    }
    if (c === "#") return linha.slice(0, i);
  }
  return linha;
}

/**
 * Lê o TOML do subconjunto. Devolve as tabelas aninhadas; uma seção
 * `[perfil.norma]` vira `{ perfil: { norma: { … } } }`.
 */
export function lerToml(texto: string): TabelaToml {
  const raiz: TabelaToml = {};
  let atual: TabelaToml = raiz;
  const linhas = texto.split(/\r?\n/);

  for (let n = 0; n < linhas.length; n++) {
    const bruta = semComentario(linhas[n]).trim();
    if (!bruta) continue;
    const linha = n + 1;

    if (bruta.startsWith("[")) {
      if (!bruta.endsWith("]")) throw new ErroToml(linha, "seção sem fechar");
      const caminho = bruta.slice(1, -1).trim().split(".").map((x) => x.trim());
      if (caminho.some((x) => !x)) throw new ErroToml(linha, "seção com nome vazio");
      atual = raiz;
      for (const parte of caminho) {
        const proximo = atual[parte];
        if (proximo === undefined) atual[parte] = {};
        else if (typeof proximo !== "object" || Array.isArray(proximo)) {
          throw new ErroToml(linha, `"${parte}" já é um valor, não uma seção`);
        }
        atual = atual[parte] as TabelaToml;
      }
      continue;
    }

    const igual = bruta.indexOf("=");
    if (igual < 0) throw new ErroToml(linha, "esperava 'chave = valor'");
    const chave = bruta.slice(0, igual).trim().replace(/^["']|["']$/g, "");
    if (!chave) throw new ErroToml(linha, "chave vazia");
    const { valor, fim } = lerValor(bruta, igual + 1, linha);
    if (bruta.slice(fim).trim()) throw new ErroToml(linha, "sobrou texto depois do valor");
    atual[chave] = valor;
  }
  return raiz;
}
