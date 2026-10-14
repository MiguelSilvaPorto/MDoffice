// ABNT — o lint que roda na carga das regras.
//
// Ele existe porque a sintaxe aceita é FECHADA: fora dela, recusa. E porque as
// afirmações do schema não podem viver em prosa — as duas vezes em que a especificação
// contradisse a si mesma (`{hs}` de grupo não capturante, `[espaco]` que é regex
// válida) foram pegas por leitura humana, não por máquina.

import { CLASSES, FORMATOS, LISTAS, PREDICADOS, TRANSFORMADORES, type RegraCrua, type RegraToml } from "./esquema";

/** Escapes que o schema aceita no texto do padrão. */
const ESCAPES_OK = new Set([
  "\\p",
  "\\P",
  "\\u",
  "\\.", "\\*", "\\+", "\\?", "\\(", "\\)", "\\[", "\\]", "\\{", "\\}",
  "\\|", "\\/", "\\\\", "\\-", "\\^", "\\$", "\\#", "\\'", "\\\"", "\\ ",
]);

/** Shorthand recusado: o significado muda de motor para motor. */
const SHORTHAND = new Set(["b", "B", "w", "W", "d", "D", "s", "S"]);

interface Varredura {
  recusados: string[];
  grupos: string[];
  referencias: { nome: string; dentroDeClasse: boolean }[];
  capturas: { nome: string; formato?: string }[];
}

/**
 * Percorre o padrão lendo ESCAPES de verdade — não procurando o texto `\b`.
 *
 * É o que evita o falso positivo em `\\b` (barra escapada) e em `[\b]`, que em
 * JavaScript é backspace dentro de classe e no Rust é outra coisa.
 */
export function varrerPadrao(regex: string): Varredura {
  const out: Varredura = { recusados: [], grupos: [], referencias: [], capturas: [] };
  let dentroDeClasse = false;
  let i = 0;
  while (i < regex.length) {
    const c = regex[i];

    if (c === "\\") {
      const proximo = regex[i + 1] ?? "";
      if (SHORTHAND.has(proximo)) {
        out.recusados.push(`\\${proximo}`);
      } else if (proximo === "p" || proximo === "P") {
        // \p{L}, \p{N}…: pode
      } else if (proximo === "u") {
        i += 5; // \uXXXX
      } else if (!ESCAPES_OK.has(`\\${proximo}`)) {
        out.recusados.push(`\\${proximo}`);
      }
      i += 2;
      continue;
    }

    if (c === "[" && !dentroDeClasse) {
      dentroDeClasse = true;
      i++;
      // `]` como primeiro caractere da classe é literal: `[]a]`
      if (regex[i] === "]") i++;
      continue;
    }
    if (c === "]" && dentroDeClasse) {
      dentroDeClasse = false;
      i++;
      continue;
    }

    // lookaround: fora do dialeto
    if (c === "(" && regex[i + 1] === "?") {
      const marca = regex[i + 2];
      if (marca === "=" || marca === "!") {
        out.recusados.push(`(?${marca}`);
        i += 3;
        continue;
      }
      if (marca === "<") {
        const depois = regex[i + 3];
        if (depois === "=" || depois === "!") {
          out.recusados.push(`(?<${depois}`);
          i += 4;
          continue;
        }
        const fim = regex.indexOf(">", i + 3);
        if (fim > 0) {
          out.grupos.push(regex.slice(i + 3, fim));
          i = fim + 1;
          continue;
        }
      }
    }

    // referência a classe ou a lista
    if (c === "<" && regex[i + 1] === "<") {
      const fim = regex.indexOf(">>", i + 2);
      if (fim < 0) {
        out.recusados.push("<< sem fechar");
        break;
      }
      out.referencias.push({ nome: regex.slice(i + 2, fim), dentroDeClasse });
      i = fim + 2;
      continue;
    }

    i++;
  }
  return out;
}

/** Lê os `{nome}` e `{nome:formato}` de um texto de substituição ou mensagem. */
export function lerCapturas(texto: string): { nome: string; formato?: string }[] {
  const out: { nome: string; formato?: string }[] = [];
  for (const m of texto.matchAll(/\{([a-zA-Z_][\w]*)(?::([a-z]+))?\}/g)) {
    out.push({ nome: m[1], formato: m[2] });
  }
  return out;
}

/**
 * Confere uma regra crua e devolve a versão tipada.
 *
 * Devolve `null` e escreve o motivo quando a regra não passa — a carga nunca
 * "conserta" nada em silêncio.
 */
export function conferirRegra(crua: RegraCrua, reclamar: (erro: string) => void): RegraToml | null {
  const faltando = (["id", "norma", "grupo", "severidade", "regex", "trecho"] as const).filter(
    (campo) => !crua[campo]
  );
  if (faltando.length) {
    reclamar(`faltam campos: ${faltando.join(", ")}`);
    return null;
  }
  const regra = crua as RegraToml;
  const erro = (texto: string) => reclamar(texto);

  // A mensagem é obrigatória quando não há transformador: é ele que a escreve.
  if (!regra.mensagem && !regra.transformar) {
    erro("falta `mensagem` (só o transformador pode escrevê-la no lugar)");
    return null;
  }

  if (regra.transformar && !TRANSFORMADORES.includes(regra.transformar)) {
    erro(`transformador desconhecido: ${regra.transformar}`);
    return null;
  }
  if (regra.antes && !PREDICADOS[regra.antes]) {
    erro(`predicado desconhecido: ${regra.antes}`);
    return null;
  }
  if (regra.depois && !PREDICADOS[regra.depois]) {
    erro(`predicado desconhecido: ${regra.depois}`);
    return null;
  }

  const v = varrerPadrao(regra.regex);
  if (v.recusados.length) {
    erro(`sintaxe fora do dialeto: ${[...new Set(v.recusados)].join(", ")}`);
    return null;
  }

  // referências: classe só dentro de classe, lista só fora
  for (const ref of v.referencias) {
    if (ref.nome in CLASSES) {
      if (!ref.dentroDeClasse) {
        erro(`<<${ref.nome}>> é conteúdo de classe: use dentro de [ ] — solto viraria sequência de matches`);
        return null;
      }
    } else if (ref.nome in LISTAS) {
      if (ref.dentroDeClasse) {
        erro(`<<${ref.nome}>> é lista de alternativas: use FORA de [ ] — dentro dela o "|" seria literal`);
        return null;
      }
    } else {
      erro(`referência desconhecida: <<${ref.nome}>>`);
      return null;
    }
  }

  if (!v.grupos.includes(regra.trecho)) {
    erro(
      `trecho "${regra.trecho}" não é grupo nomeado do regex` +
        (v.grupos.length ? ` (tem: ${v.grupos.join(", ")})` : " (o regex não tem grupo nomeado)")
    );
    return null;
  }

  // todo `{nome}` precisa ser grupo nomeado — foi o erro que passou duas vezes em prosa
  const textos: [string, string][] = [
    ["substituir", regra.substituir ?? ""],
    ["mensagem", regra.mensagem ?? ""],
  ];
  for (const [campo, texto] of textos) {
    for (const cap of lerCapturas(texto)) {
      if (!v.grupos.includes(cap.nome)) {
        erro(
          `${campo} usa {${cap.nome}}, que não é grupo nomeado do regex` +
            (v.grupos.length ? ` (tem: ${v.grupos.join(", ")})` : " (o regex não tem grupo nomeado)")
        );
        return null;
      }
      if (cap.formato && !(FORMATOS as readonly string[]).includes(cap.formato)) {
        erro(`${campo} usa o formato ":${cap.formato}", que não existe`);
        return null;
      }
      if (cap.formato === "mapa" && !regra.mapa) {
        erro(`${campo} usa {${cap.nome}:mapa} e a regra não tem tabela [regra.mapa]`);
        return null;
      }
    }
  }

  if (!regra.substituir && !regra.transformar) {
    erro("a regra não tem `substituir` nem `transformar`: não há como produzir a correção");
    return null;
  }

  return regra;
}

/** Expande `<<classe>>` e `<<lista>>` no texto do padrão. Só deve rodar depois do lint. */
export function expandir(regex: string): string {
  return regex.replace(/<<([^>]+)>>/g, (_m, nome: string) => {
    if (nome in CLASSES) return CLASSES[nome];
    if (nome in LISTAS) return LISTAS[nome].map((x) => x.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|");
    throw new Error(`referência desconhecida: <<${nome}>>`);
  });
}
