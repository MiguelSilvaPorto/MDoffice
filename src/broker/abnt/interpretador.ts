// ABNT — o interpretador: transforma uma regra em TOML numa regra do app.
//
// O contrato de saída é o que já existe (`RuleCtx`), então o motor de estilo continua
// chamando `Rule` e não sabe de onde a regra veio — nem se ela é um padrão ou um
// verificador do documento.

import type { Rule, RuleCtx } from "../style/types";
import type { RegraToml, Transformador } from "./esquema";
import { PREDICADOS } from "./esquema";
import { expandir } from "./lint";
import { documentoDe, type Faixa } from "./documento";
import { VERIFICADORES, type Verificador } from "./verificadores";

interface ResultadoTransformador {
  sugestoes: string[];
  mensagem: string;
  fix?: string;
}

type TransformadorImpl = (grupos: Record<string, string>, bruto: RegraToml) => ResultadoTransformador | null;

/**
 * "SILVA" → "Silva"; "silva" → "Silva"; caixa mista fica como está.
 * Siglas curtas (até 4 letras) não são tocadas.
 */
function autorCaixaMista(token: string): string {
  if (token === token.toUpperCase()) {
    if (token.length < 5) return token;
    return token[0] + token.slice(1).toLowerCase();
  }
  if (token === token.toLowerCase()) {
    if (token.length < 3) return token;
    return token[0].toUpperCase() + token.slice(1).toLowerCase();
  }
  return token;
}

/** O julgamento que não cabe em dado. Um só, e é o que a citação precisa. */
const IMPLEMENTACOES: Record<Transformador, TransformadorImpl> = {
  caixa_mista_autor: (grupos, regra) => {
    const autor = grupos.autor ?? "";
    const ano = grupos.ano ?? "";
    const novo = autor.split(/\s*;\s*/).map(autorCaixaMista).join("; ");
    if (novo === autor) return null; // já está em caixa mista ou é sigla: não acusa
    const sugestao = `(${novo}, ${ano})`;
    const eraCaixaAlta = autor === autor.toUpperCase();
    return {
      sugestoes: [sugestao],
      mensagem: eraCaixaAlta
        ? `[ABNT NBR 10520:2023] O sobrenome do autor no sistema autor-data vai em caixa mista (a CAIXA ALTA era da NBR 10520:2002): “${sugestao}”`
        : `[ABNT NBR 10520:2023] Sobrenome do autor no sistema autor-data em caixa mista: “${sugestao}”`,
    };
  },
};

function formatar(valor: string, formato: string | undefined, regra: RegraToml): string {
  if (formato === "minusculo") return valor.toLowerCase();
  if (formato === "mapa") {
    const achado = regra.mapa?.[valor.toLowerCase()];
    return achado ?? valor;
  }
  return valor;
}

/** Troca os `{nome}` e `{nome:formato}` pelos valores dos grupos. */
function preencher(texto: string, grupos: Record<string, string>, regra: RegraToml): string {
  return texto.replace(/\{([a-zA-Z_][\w]*)(?::([a-z]+))?\}/g, (_m, nome: string, formato?: string) =>
    formatar(grupos[nome] ?? "", formato, regra)
  );
}

/**
 * Uma regra em TOML vira uma `Rule`.
 *
 * As decisões que valem a leitura:
 *
 * 1. **O match é só o trecho.** As bordas são predicados (`antes`/`depois`), não
 *    grupos de contexto — um grupo consumido à esquerda ou à direita apareceria no
 *    span e faria o vizinho sumir ("14hs 15hs": o primeiro match comeria o espaço e
 *    o segundo perderia o caractere de que precisa).
 * 2. **Ao descartar, a busca retoma um caractere depois do INÍCIO do descartado** —
 *    nunca depois do fim. Retomar pelo fim pularia um match válido que se sobrepõe ao
 *    rejeitado.
 * 3. **A troca acontece sobre o trecho**, não sobre o match inteiro.
 * 4. **`escopo = "bloco"`** deixa a regra valer só dentro das seções pedidas — fora
 *    delas é silêncio, inclusive quando o bloco não existe no documento.
 * 5. **`tipo = "estrutura"`** delega ao verificador; o TOML fica sendo a declaração
 *    (id, norma, severidade, parâmetros) e o julgamento mora em `verificadores/`.
 *
 * O `registro` existe para o TESTE poder injetar um verificador de mentira sem mexer
 * no registro de verdade (`regraDeToml(regra, { meu: () => [...] })`).
 */
export function regraDeToml(regra: RegraToml, registro: Record<string, Verificador> = VERIFICADORES): Rule {
  const tipo = regra.tipo ?? "texto";

  if (tipo === "docx") {
    throw new Error(`regra ${regra.id} é do .docx: não roda no texto (quem a usa é o validador do arquivo exportado)`);
  }

  if (tipo === "estrutura") {
    const impl = registro[regra.verifica ?? ""];
    if (!impl) {
      const conhecidos = Object.keys(registro);
      throw new Error(
        `regra ${regra.id}: verificador desconhecido "${regra.verifica ?? ""}" (conhecidos: ${conhecidos.join(", ") || "nenhum"})`
      );
    }
    return ({ text, push }: RuleCtx) => {
      const doc = documentoDe(text);
      for (const aviso of impl(doc, regra)) {
        // o verificador responde pelo que devolve: faixa fora do texto é recortada
        // aqui para o aviso não virar span inválido no editor
        const de = Math.max(0, Math.min(aviso.from, text.length));
        const ate = Math.max(de, Math.min(aviso.to, text.length));
        push(de, ate, aviso.mensagem, aviso.fix, aviso.sugestoes ?? [], (aviso.auto ?? regra.auto) === true);
      }
    };
  }

  if (!regra.regex) throw new Error(`regra ${regra.id}: regra de texto sem regex (o lint deveria ter recusado)`);
  const fonte = expandir(regra.regex);
  const flags = regra.ignorar_caixa ? "giu" : "gu";
  const rx = new RegExp(fonte, flags);
  const predAntes = regra.antes ? new RegExp(PREDICADOS[regra.antes], "u") : null;
  const predDepois = regra.depois ? new RegExp(PREDICADOS[regra.depois], "u") : null;
  const transformador = regra.transformar ? IMPLEMENTACOES[regra.transformar] : null;
  const nomeDoTrecho = regra.trecho ?? "trecho";

  return ({ text, mask, push }: RuleCtx) => {
    // o modelo do documento só é lido quando a regra precisa dele (bloco)
    const regioes: Faixa[] | null =
      regra.escopo === "bloco" ? documentoDe(text).regioesDeBlocos(regra.contexto?.blocos ?? []) : null;

    rx.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = rx.exec(mask)) !== null) {
      const inicio = m.index;
      const fim = m.index + m[0].length;

      // escopo de bloco: fora dos blocos pedidos a regra não acusa — e a retomada segue
      // a mesma regra do descarte (um caractere depois do INÍCIO)
      if (regioes && !regioes.some((f) => inicio >= f.from && fim <= f.to)) {
        rx.lastIndex = inicio + 1;
        continue;
      }

      // bordas: sem caractere antes/depois é verdadeiro (é o que substitui o
      // lookbehind/lookahead sem consumir nada)
      const antesOk = !predAntes || inicio === 0 || predAntes.test(mask[inicio - 1]);
      const depoisOk = !predDepois || fim >= mask.length || predDepois.test(mask[fim]);
      if (!antesOk || !depoisOk) {
        rx.lastIndex = inicio + 1; // retoma pelo INÍCIO do descartado, não pelo fim
        continue;
      }

      // grupos nomeados, o bruto e o trecho
      const grupos: Record<string, string> = {};
      for (const [nome, valor] of Object.entries(m.groups ?? {})) grupos[nome] = valor ?? "";
      const trechoRel = m.groups?.[nomeDoTrecho];
      if (trechoRel === undefined) continue;
      const deslocamento = m[0].indexOf(trechoRel);
      const de = inicio + (deslocamento >= 0 ? deslocamento : 0);
      const ate = de + trechoRel.length;

      let sugestoes: string[];
      let mensagem: string;
      let fix: string | undefined;

      if (transformador) {
        const saida = transformador(grupos, regra);
        if (!saida) {
          rx.lastIndex = inicio + 1;
          continue;
        }
        sugestoes = saida.sugestoes;
        mensagem = saida.mensagem;
        fix = saida.fix;
      } else if (regra.substituir !== undefined) {
        fix = preencher(regra.substituir, grupos, regra);
        if (regra.pular_se_igual && fix === mask.slice(de, ate)) {
          rx.lastIndex = inicio + 1;
          continue;
        }
        sugestoes = [fix];
        mensagem = preencher(regra.mensagem ?? "", grupos, regra);
      } else {
        // regra de aviso: acusa sem saber a troca ("completar os dados da referência")
        sugestoes = [];
        mensagem = preencher(regra.mensagem ?? "", grupos, regra);
      }

      push(de, ate, mensagem, fix, sugestoes, regra.auto === true);
    }
  };
}
