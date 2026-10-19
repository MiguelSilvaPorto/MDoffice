// Verificação completa: estilo + ortografia (dicionário) + “você quis dizer…?”.

import { ABBREVIATIONS, GLUED } from "./data/abbreviations";
import { concordanciaDeNumero } from "./concordancia";
import { carregarFrequencia, contagem } from "./frequencia";
import { maskNonProse } from "./mask";
import { commonNeighbor } from "./neighbor";
import { normalizarTexto, paraOriginal } from "./normalizar";
import { checkWords } from "./spell";
import { trocaPorContexto } from "./spell/uso";
import { getLanguageModel } from "./ghost/model";
import { checkStyle } from "./style";
import type { WritingIssue } from "./types";
import { rerankSuggestions } from "./personal/rerank";
import { personalIndex } from "./ghost/memory";
import { DocumentIndex } from "./ghost/documentIndex";
import { diag, janelaDe } from "./diag";

export async function checkText(bruto: string, ignore: Set<string>, opcoes?: { titulos?: readonly number[]; curtas?: boolean }): Promise<WritingIssue[]> {
  // A frequência é a mesma tabela que o corretor usa. Espera curta: se não
  // chegar, as regras que dependem dela ficam quietas e nada quebra.
  await Promise.race([carregarFrequencia(), new Promise((r) => setTimeout(r, 1500))]);

  // NORMALIZAR ANTES DE MASCARAR, e nesta ordem por dois motivos: a máscara depende de
  // "mesmo comprimento" (que a normalização acabou de mudar) e precisa ser construída
  // sobre o texto que as regras vão ver. Todo aviso nasce em posição do texto
  // normalizado e volta ao original no fim — em índice de caractere, que é a unidade
  // do schema (o editor conta em UTF-16, o Rust em byte UTF-8).
  const norm = normalizarTexto(bruto);
  const text = norm.texto;

  const issues = checkStyle(text, opcoes);
  const mask = maskNonProse(text);
  // `curtas` (usado pela correção formal, não pela digitação) inclui as palavras de
  // duas letras: "ja", "so", "ha" só se acentuam por aí — e o uso no corpus decide.
  const rx = opcoes?.curtas ? /[\p{L}][\p{L}'-]{1,}/gu : /[\p{L}][\p{L}'-]{2,}/gu;
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
    // Contexto para o corretor: qual palavra vem ANTES de cada uma (mesmo as curtas,
    // que não entram na checagem) — é o que decide "vou para a **casa**" × "as **casas**".
    // "<s>" marca o começo do texto/linha, como no corpus que treinou o modelo.
    const palavrasDoTexto = [...mask.matchAll(/[\p{L}][\p{L}'-]*/gu)].map((m2) => ({ texto: m2[0], from: m2.index ?? 0, to: (m2.index ?? 0) + m2[0].length }));
    const contexto: Record<string, string> = {};
    let k = 0;
    for (const token of tokens) {
      while (k < palavrasDoTexto.length && palavrasDoTexto[k].to <= token.from) k++;
      const anterior = k > 0 ? palavrasDoTexto[k - 1].texto.toLowerCase() : "<s>";
      if (!(token.word in contexto)) contexto[token.word] = anterior;
    }
    const wrong = await checkWords(Array.from(unique), contexto);
    const docIdx = new DocumentIndex();
    docIdx.update(text); // o que está escrito neste documento ajuda a escolher a palavra certa
    for (const token of tokens) {
      const hit = wrong.get(token.word);
      if (hit) {
        const suggestions = hit.glued ? hit.suggestions : rerankSuggestions(text, token.from, token.to, hit.suggestions, docIdx);
        const used = personalIndex.wordFreq.get(token.word.toLowerCase()) ?? 0;
        issues.push({
          from: token.from,
          to: token.to,
          word: token.word,
          kind: "spell",
          message: hit.glued
            ? `“${token.word}” parece ter palavras coladas — faltou um espaço? Talvez “${hit.suggestions[0]}”`
            : hit.duvida
              ? `“${token.word}” existe, mas em texto escrito quase sempre é “${hit.suggestions[0]}” — faltou o acento?`
              : used >= 4
                ? `“${token.word}” não está no dicionário, mas você a usa com frequência (${used} vezes nos seus textos) — se for um termo seu, adicione ao dicionário`
                : `“${token.word}” não está no dicionário`,
          suggestions,
          // a correção automática só vale se o contexto não discordar da escolha do dicionário
          auto: hit.best && suggestions[0] === hit.suggestions[0] ? hit.best : hit.glued ? hit.best : undefined,
          // Palavras coladas entram como correção DISPONÍVEL (aparece na revisão com o
          // botão "Corrigir", e vale no "corrigir tudo"), mas nunca sozinhas: mesmo com
          // o sinal forte da colagem, é uma pergunta. Sem `auto` a varredura automática
          // não encosta nela — ela só aplica `fix` de estilo.
          //
          // Vale só para a colagem DEDUZIDA (o dicionário aceita a palavra): a colagem
          // clássica ("coisasque") já vem com `auto` e segue como sempre foi.
          fix: hit.duvida ? hit.suggestions[0] : undefined,
        });
        continue;
      }
      // A palavra existe no dicionário, mas pode ser um erro de uma letra
      // numa palavra muito comum (ex.: "maneria" → "maneira").
      //
      // É uma troca de PALAVRA, não de acento: por isso vem com `fix` (entra no
      // "Corrigir tudo", na pausa e ao salvar) e NÃO com `auto` — quem decide é
      // quem escreve, porque a palavra original também existe.
      //
      // Palavras de duas letras (só entram com `curtas`) ficam de fora: "de"/"da"
      // não são erro de uma letra, e sugerir troca nelas seria ruído.
      const near = token.word.length >= 3 ? commonNeighbor(token.word, contagem) : null;
      if (near) {
        issues.push({
          from: token.from,
          to: token.to,
          word: token.word,
          kind: "style",
          message: `“${token.word}” existe, mas você quis dizer “${near}”?`,
          suggestions: [near],
          fix: near,
        });
      } else if (token.word.length >= 3) {
        // A palavra existe, mas o CONTEXTO pode pedir outra leitura: "a media das notas" é
        // "média"; "há aguda a prever" é "ajuda". Quem decide é o uso no corpus (o modelo de
        // n-gramas): a escrita não aparece depois daquela palavra e uma troca de classe
        // aparece com muita vantagem. Fica como PERGUNTA (fix para "Corrigir tudo"/revisão),
        // nunca como correção automática — a palavra existe, o sentido é que decide.
        const troca = trocaPorContexto(token.word, contexto[token.word], getLanguageModel());
        if (troca) {
          issues.push({
            from: token.from,
            to: token.to,
            word: token.word,
            kind: "style",
            message: `“${token.word}” existe, mas o contexto pede “${troca.palavra}”?`,
            suggestions: [troca.palavra],
            fix: troca.palavra,
          });
        }
      }
    }
  }

  // Concordância de número entre artigo e substantivo ("Os documento foram...").
  //
  // Fica aqui, e não nas regras de estilo, porque depende do DICIONÁRIO: a única
  // forma de saber que "documentos" é palavra real (e que "ques" não é) é
  // perguntar a quem conhece o idioma. Por isso roda depois do checkWords.
  issues.push(
    ...(await concordanciaDeNumero(mask, async (propostas) => {
      const hits = await checkWords(propostas);
      // o que volta como hit é o que NÃO existe no dicionário
      return new Set(hits.keys());
    }))
  );

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
  // De volta ao texto ORIGINAL: os avisos nasceram em posições do normalizado, e quem
  // consome (o editor) conta posições no que está escrito na tela.
  const finais = fundidos
    .map((i) => ({ ...i, from: paraOriginal(norm, i.from), to: paraOriginal(norm, i.to) }))
    .sort((a, b) => a.from - b.from);
  // Log de decisões: só o que PODE ser aplicado (auto/fix/safe) — é o que interessa para explicar
  // uma correção que apareceu (ou deixou de aparecer) quando o diagnóstico está ligado.
  for (const i of finais) {
    if (!i.auto && i.fix === undefined && !i.safe) continue;
    diag({
      gatilho: "checagem",
      tipo: i.kind,
      regra: i.message,
      from: i.from,
      to: i.to,
      palavra: i.word,
      safe: i.safe,
      auto: i.auto,
      fix: i.fix,
      sugestao: i.suggestions[0],
      veredito: "detectado",
      janela: janelaDe(bruto, i.from, i.to),
    });
  }
  return finais;
}
