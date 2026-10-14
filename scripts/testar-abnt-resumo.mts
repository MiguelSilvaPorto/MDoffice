// Teste das regras do RESUMO e do ABSTRACT (E09, E10, A01, A02, A03).
//
// Cada exame tem os DOIS lados: o caso que acusa e o texto correto que NÃO acusa (sem o
// segundo, o teste não prova precisão). Os avisos de ausência são conferidos pelo trecho
// em que estão ancorados — é a prova de que não saem com faixa vazia, que o motor descarta.
//
// Roda com: node scripts/testar-abnt-resumo.mts

import { checa, empacotar, fim, regrasCruas, rodar } from "./abnt/ferramentas.mts";

const I = await empacotar("src/broker/abnt/index.ts");

/** Só as regras desta tarefa — o teste não depende de quantas outras já existem. */
const MINHAS = ["abnt.e09", "abnt.e10", "abnt.a01", "abnt.a02", "abnt.a03"];
const cruas = (await regrasCruas()).filter((r: { id: string }) => MINHAS.includes(r.id));
checa("as cinco regras carregam pelo índice", cruas.length === 5, String(cruas.length));

const regras = cruas.map((r) => I.regraDeToml(r));
const porId = new Map<string, unknown>(cruas.map((r: { id: string }) => [r.id, I.regraDeToml(r)]));
const rodarId = (id: string, texto: string) => rodar(texto, [porId.get(id)]);

/** `n` palavras contáveis ("palavra1 palavra2 …"), como o `contarPalavras` do app conta. */
const f = (n: number): string => Array.from({ length: n }, (_, i) => `palavra${i + 1}`).join(" ");

console.log("E09/A01 — extensão do resumo");
{
  const CURTO = `# RESUMO\n\n${f(10)}\n\nPalavras-chave: um; dois.\n\n# ABSTRACT\n\ntext.`;
  const e09 = await rodarId("abnt.e09", CURTO);
  const a01 = await rodarId("abnt.a01", CURTO);
  checa("E09 acusa o resumo de 10 palavras", e09.length === 1 && e09[0].mensagem.includes("10 palavras"), JSON.stringify(e09));
  checa(
    "a mensagem do E09 cita a NBR 14724 e diz o número contado",
    e09[0]?.mensagem.includes("[ABNT NBR 14724:2024]") === true && e09[0]?.mensagem.includes("150") === true,
    JSON.stringify(e09[0]?.mensagem)
  );
  checa(
    "A01 acusa o mesmo resumo sob a NBR 6028",
    a01.length === 1 && a01[0].mensagem.includes("[ABNT NBR 6028:2021]") === true,
    JSON.stringify(a01)
  );
  checa(
    "E09 e A01 apontam o mesmo trecho (uma conta só)",
    e09[0]?.from === a01[0]?.from && e09[0]?.to === a01[0]?.to,
    JSON.stringify([e09[0]?.from, e09[0]?.to, a01[0]?.from, a01[0]?.to])
  );
  checa("o aviso cobre o corpo do resumo (trecho com conteúdo)", CURTO.slice(e09[0]?.from, e09[0]?.to).includes("palavra10"), JSON.stringify(CURTO.slice(e09[0]?.from, e09[0]?.to)));

  const noLimite150 = `# RESUMO\n\n${f(150)}\n\n# ABSTRACT\n\ntext.`;
  checa("resumo com exatamente 150 palavras não acusa", (await rodarId("abnt.e09", noLimite150)).length === 0);
  const noLimite500 = `# RESUMO\n\n${f(500)}\n\n# ABSTRACT\n\ntext.`;
  checa("resumo com exatamente 500 palavras não acusa", (await rodarId("abnt.e09", noLimite500)).length === 0);

  const longo = `# RESUMO\n\n${f(501)}\n\n# ABSTRACT\n\ntext.`;
  const avisoLongo = await rodarId("abnt.e09", longo);
  checa(
    "um resumo acima do máximo acusa e pede enxugar",
    avisoLongo.length === 1 && avisoLongo[0].mensagem.includes("501 palavras") && avisoLongo[0].mensagem.includes("enxugar"),
    JSON.stringify(avisoLongo)
  );

  // 145 palavras + 10 na linha das palavras-chave: se a linha entrasse na conta, daria 155
  // (dentro da faixa) e o aviso não sairia — é este caso que prova a exclusão.
  const comChaves = `# RESUMO\n\n${f(145)}\n\nPalavras-chave: ${f(10)}.`;
  const avisoChaves = await rodarId("abnt.e09", comChaves);
  checa(
    "a linha “Palavras-chave:” não entra na contagem (145, não 155)",
    avisoChaves.length === 1 && avisoChaves[0].mensagem.includes("145 palavras"),
    JSON.stringify(avisoChaves)
  );

  const semResumo = `# INTRODUÇÃO\n\n${f(50)}`;
  checa("sem bloco RESUMO é silêncio no E09", (await rodarId("abnt.e09", semResumo)).length === 0);
  checa("sem bloco RESUMO é silêncio no A01", (await rodarId("abnt.a01", semResumo)).length === 0);
}

console.log("\nE10 — abstract presente");
{
  const resumo = `# RESUMO\n\n${f(150)}`;
  const semAbstract = await rodarId("abnt.e10", resumo);
  checa("acusa o abstract que falta", semAbstract.length === 1, JSON.stringify(semAbstract));
  checa(
    "a mensagem diz o que incluir e onde",
    semAbstract[0]?.mensagem.includes("[ABNT NBR 14724:2024]") === true &&
      semAbstract[0]?.mensagem.includes("ABSTRACT") === true &&
      semAbstract[0]?.mensagem.includes("depois do RESUMO") === true,
    JSON.stringify(semAbstract[0]?.mensagem)
  );
  checa(
    "a âncora é a última linha do resumo (o aviso sai com trecho, não vazio)",
    resumo.slice(semAbstract[0]?.from, semAbstract[0]?.to) === f(150),
    JSON.stringify(resumo.slice(semAbstract[0]?.from, semAbstract[0]?.to))
  );

  const comAbstract = `${resumo}\n\n# ABSTRACT\n\n${f(150)}`;
  checa("com o ABSTRACT presente não acusa", (await rodarId("abnt.e10", comAbstract)).length === 0);

  const semNada = "# INTRODUÇÃO\n\ntexto qualquer";
  checa("sem RESUMO no documento é silêncio (quem cobra o resumo é a estrutura)", (await rodarId("abnt.e10", semNada)).length === 0);

  const soTitulo = `${resumo}\n\n# ABSTRACT\n`;
  const vazio = await rodarId("abnt.e10", soTitulo);
  checa(
    "o título ABSTRACT sem texto também acusa (ancorado no título)",
    vazio.length === 1 && soTitulo.slice(vazio[0]?.from, vazio[0]?.to) === "ABSTRACT",
    JSON.stringify(vazio)
  );
}

console.log("\nA02 — palavras-chave");
{
  const semRotulo = `# RESUMO\n\n${f(150)}`;
  const ausente = await rodarId("abnt.a02", semRotulo);
  checa(
    "acusa o rótulo ausente e cita a NBR 6028",
    ausente.length === 1 && ausente[0].mensagem.includes("[ABNT NBR 6028:2021]") === true && ausente[0].mensagem.includes("Palavras-chave:") === true,
    JSON.stringify(ausente)
  );
  checa(
    "a âncora do rótulo ausente é o fim do resumo (não sai faixa vazia)",
    semRotulo.slice(ausente[0]?.from, ausente[0]?.to) === f(150),
    JSON.stringify(semRotulo.slice(ausente[0]?.from, ausente[0]?.to))
  );

  const certos = [
    ["com Palavras-chave: não acusa", `${semRotulo}\n\nPalavras-chave: um; dois; três.`],
    ["o rótulo em negrito também vale", `${semRotulo}\n\n**Palavras-chave:** um; dois.`],
    ["sem hífen (“Palavras chave:”) também vale", `${semRotulo}\n\nPalavras chave: um; dois.`],
    ["em caixa alta também vale", `${semRotulo}\n\nPALAVRAS-CHAVE: um; dois.`],
  ];
  for (const [nome, texto] of certos) {
    const avisos = await rodarId("abnt.a02", texto);
    checa(nome, avisos.length === 0, JSON.stringify(avisos));
  }

  const singular = `${semRotulo}\n\nPalavra-chave: um; dois.`;
  const avisoSingular = await rodarId("abnt.a02", singular);
  checa(
    "singular acusa e a mensagem pede o plural",
    avisoSingular.length === 1 && avisoSingular[0].mensagem.includes("plural"),
    JSON.stringify(avisoSingular)
  );

  const semDoisPontos = `${semRotulo}\n\nPalavras-chave um; dois.`;
  const avisoDoisPontos = await rodarId("abnt.a02", semDoisPontos);
  checa(
    "sem dois-pontos acusa",
    avisoDoisPontos.length === 1 && avisoDoisPontos[0].mensagem.includes("dois-pontos"),
    JSON.stringify(avisoDoisPontos)
  );

  const semTermos = `${semRotulo}\n\nPalavras-chave:`;
  const avisoSemTermos = await rodarId("abnt.a02", semTermos);
  checa(
    "rótulo sem termos acusa",
    avisoSemTermos.length === 1 && avisoSemTermos[0].mensagem.includes("termos"),
    JSON.stringify(avisoSemTermos)
  );

  checa("sem bloco RESUMO é silêncio", (await rodarId("abnt.a02", "# INTRODUÇÃO\n\ntexto")).length === 0);
}

console.log("\nA03 — citação no resumo");
{
  const simples = `# RESUMO\n\nO estudo de (Silva, 2020) mostra que a prática melhora o resultado.`;
  const avisos = await rodarId("abnt.a03", simples);
  checa("acusa a citação autor-data", avisos.length === 1 && avisos[0].mensagem.includes("[ABNT NBR 6028:2021]") === true, JSON.stringify(avisos));
  checa(
    "o trecho é exatamente a citação",
    simples.slice(avisos[0]?.from, avisos[0]?.to) === "(Silva, 2020)",
    JSON.stringify(simples.slice(avisos[0]?.from, avisos[0]?.to))
  );

  const variantes = [
    ["autores múltiplos e página", "# RESUMO\n\nO método (SILVA; Costa, 2020, p. 15) foi aplicado."],
    ["et al.", "# RESUMO\n\nSegundo (Silva et al., 2020), os dados indicam melhora."],
    ["ano com letra de chamada", "# RESUMO\n\nO recorte (IBGE, 2021a) aponta crescimento."],
  ];
  for (const [nome, texto] of variantes) {
    const saida = await rodarId("abnt.a03", texto);
    checa(`acusa com ${nome}`, saida.length === 1, JSON.stringify(saida));
  }

  const limpo = "# RESUMO\n\nO estudo mostra que a prática melhora o resultado.";
  checa("resumo sem citação não acusa", (await rodarId("abnt.a03", limpo)).length === 0);
  checa(
    "citação fora do resumo não é desta regra",
    (await rodarId("abnt.a03", "# INTRODUÇÃO\n\nConforme (Silva, 2020), a prática melhora o resultado.")).length === 0
  );
  checa(
    "parênteses que não é citação não acusa",
    (await rodarId("abnt.a03", "# RESUMO\n\nO recorte (Figura 1) mostra o crescimento.")).length === 0
  );
}

console.log("\ntodas juntas");
{
  const correto = `# RESUMO\n\n${f(160)}\n\nPalavras-chave: um; dois; três.\n\n# ABSTRACT\n\n${f(160)}\n\nKeywords: one; two; three.`;
  const limpos = await rodar(correto, regras);
  checa("documento correto: nenhum aviso", limpos.length === 0, JSON.stringify(limpos));

  const problematico = `# RESUMO\n\n${f(10)}\n\nO estudo (Silva, 2020) mostra.`;
  const todos = await rodar(problematico, regras);
  const mensagens = todos.map((a) => a.mensagem).join("\n");
  checa("documento problemático: cinco avisos (E09, A01, E10, A02, A03)", todos.length === 5, JSON.stringify(todos.map((a) => a.mensagem)));
  checa(
    "os cinco avisos citam as duas normas e os três pontos",
    mensagens.includes("15 palavras") === true &&
      mensagens.includes("[ABNT NBR 14724:2024]") === true &&
      mensagens.includes("[ABNT NBR 6028:2021]") === true &&
      mensagens.includes("ABSTRACT") === true &&
      mensagens.includes("Palavras-chave:") === true &&
      mensagens.includes("citação") === true,
    mensagens
  );
}

fim();
