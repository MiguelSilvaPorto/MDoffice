// Verificação completa: estilo + ortografia (dicionário) + “você quis dizer…?”.

import { ABBREVIATIONS, GLUED } from "./data/abbreviations";
import { concordanciaDeNumero } from "./concordancia";
import { carregarFrequencia, contagem } from "./frequencia";
import { maskNonProse } from "./mask";
import { commonNeighbor } from "./neighbor";
import { checkWords } from "./spell";
import { checkStyle } from "./style";
import type { WritingIssue } from "./types";
import { rerankSuggestions } from "./personal/rerank";
import { personalIndex } from "./ghost/memory";
import { DocumentIndex } from "./ghost/documentIndex";

export async function checkText(text: string, ignore: Set<string>): Promise<WritingIssue[]> {
  // A frequência é a mesma tabela que o corretor usa. Espera curta: se não
  // chegar, as regras que dependem dela ficam quietas e nada quebra.
  await Promise.race([carregarFrequencia(), new Promise((r) => setTimeout(r, 1500))]);
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
      const near = commonNeighbor(token.word, contagem);
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
  return fundidos.sort((a, b) => a.from - b.from);
}
