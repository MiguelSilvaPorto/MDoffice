// Teste das regras de ESTRUTURA do trabalho: E01–E03 (NBR 14724:2024) e P01
// (NBR 15287:2025).
//
// Cada caso tem os DOIS lados: o texto que acusa e o texto correto que NÃO acusa —
// sem o segundo, o teste não prova precisão (docs/abnt-como-escrever-regras.md). O
// caso do texto que "não é um TCC" (sem seções de trabalho) é o outro lado da
// evidência mínima: é o falso positivo que o verificador foi escrito para evitar.

import { checa, documento, empacotar, fim, regrasDe, rodar, verificar } from "./abnt/ferramentas.mts";

const I = await empacotar("src/broker/abnt/index.ts");

/**
 * As regras destes ids, prontas para rodar. Filtra por id EXATO: o prefixo
 * `abnt.e0` passou a alcançar E09/E10 (do resumo) quando os grupos se juntaram.
 */
const regrasDeIds = (ids: string[]) =>
  (I.carregarRegras() as { id: string }[])
    .filter((r) => ids.includes(r.id))
    .map((r) => I.regraDeToml(r));

// ---------------------------------------------------------------- textos

const TEXTO_QUALQUER =
  "A reunião discutiu o cronograma e os objetivos do time para o trimestre, e a ata fica na pasta compartilhada.";

const SEM_RESUMO = [
  "# INTRODUÇÃO",
  "",
  "texto.",
  "",
  "# DESENVOLVIMENTO",
  "",
  "texto.",
  "",
  "# CONCLUSÃO",
  "",
  "fim.",
  "",
  "# REFERÊNCIAS",
  "",
  "SILVA, João. Livro. 2020.",
].join("\n");

const COMPLETO = [
  "# RESUMO",
  "",
  "Este trabalho investiga o tema.",
  "",
  "# ABSTRACT",
  "",
  "This work investigates the theme.",
  "",
  "# SUMÁRIO",
  "",
  "1 INTRODUÇÃO",
  "2 DESENVOLVIMENTO",
  "3 CONCLUSÃO",
  "4 REFERÊNCIAS",
  "",
  "# INTRODUÇÃO",
  "",
  "texto.",
  "",
  "# DESENVOLVIMENTO",
  "",
  "texto.",
  "",
  "# CONCLUSÃO",
  "",
  "fim.",
  "",
  "# REFERÊNCIAS",
  "",
  "SILVA, João. Livro. 2020.",
].join("\n");

const REFS_ANTES_CONCLUSAO = [
  "# REFERÊNCIAS",
  "",
  "SILVA, João. Livro. 2020.",
  "",
  "# CONCLUSÃO",
  "",
  "fim.",
].join("\n");

const ORDEM_CERTA = [
  "# INTRODUÇÃO",
  "",
  "texto.",
  "",
  "# CONCLUSÃO",
  "",
  "fim.",
  "",
  "# REFERÊNCIAS",
  "",
  "SILVA, João. Livro. 2020.",
].join("\n");

const RESUMO_DEPOIS = ["# INTRODUÇÃO", "", "texto.", "", "# RESUMO", "", "texto."].join("\n");

const SEM_CONCLUSAO = [
  "# INTRODUÇÃO",
  "",
  "texto.",
  "",
  "# METODOLOGIA",
  "",
  "procedimentos.",
  "",
  "# REFERÊNCIAS",
  "",
  "SILVA, João. Livro. 2020.",
].join("\n");

const E03_ALTERNATIVAS = [
  "# INTRODUÇÃO",
  "",
  "texto.",
  "",
  "# REFERENCIAL TEÓRICO",
  "",
  "conceitos.",
  "",
  "# CONSIDERAÇÕES FINAIS",
  "",
  "fim.",
].join("\n");

const PROJETO_SEM_CRONOGRAMA = [
  "# INTRODUÇÃO",
  "",
  "tema e problema.",
  "",
  "# OBJETIVOS",
  "",
  "geral e específicos.",
  "",
  "# METODOLOGIA",
  "",
  "procedimentos.",
  "",
  "# REFERÊNCIAS",
  "",
  "SILVA, João. Livro. 2021.",
].join("\n");

const PROJETO_COMPLETO = [
  "# INTRODUÇÃO",
  "",
  "tema e problema.",
  "",
  "# OBJETIVOS",
  "",
  "geral e específicos.",
  "",
  "# METODOLOGIA",
  "",
  "procedimentos.",
  "",
  "# CRONOGRAMA",
  "",
  "meses e etapas.",
  "",
  "# REFERÊNCIAS",
  "",
  "SILVA, João. Livro. 2021.",
].join("\n");

// ---------------------------------------------------------------- carga

console.log("carga das regras");
{
  const E = regrasDeIds(["abnt.e01", "abnt.e02", "abnt.e03"]);
  const P = regrasDeIds(["abnt.p01"]);
  checa("as regras E01–E03 carregam", E.length === 3, String(E.length));
  checa("a regra P01 carrega", P.length === 1, String(P.length));
}

// ---------------------------------------------------------------- E01

console.log("\nE01 — elementos pré-textuais obrigatórios");
{
  const regras = await regrasDe("abnt.e01");

  const avisos = await rodar(SEM_RESUMO, regras);
  checa(
    "acusa o trabalho sem os pré-textuais",
    avisos.length === 1 &&
      avisos[0].mensagem.includes("“RESUMO”") &&
      avisos[0].mensagem.includes("“ABSTRACT”") &&
      avisos[0].mensagem.includes("“SUMÁRIO”"),
    JSON.stringify(avisos.map((a) => a.mensagem))
  );
  checa(
    "o aviso explica por que a regra fala (cara de trabalho acadêmico)",
    avisos.length === 1 &&
      avisos[0].mensagem.includes("[ABNT NBR 14724:2024]") &&
      avisos[0].mensagem.includes("trabalho acadêmico") &&
      avisos[0].mensagem.includes("“INTRODUÇÃO”"),
    JSON.stringify(avisos.map((a) => a.mensagem))
  );
  checa(
    "o aviso é de conferência: sem troca automática",
    avisos.length === 1 && !avisos[0].safe && avisos[0].fix === undefined && avisos[0].sugestoes.length === 0,
    JSON.stringify(avisos)
  );

  const doc = await documento(SEM_RESUMO);
  const ancora = I.ancoraNoFim(doc);
  checa(
    "o aviso ancora no fim (onde o elemento entraria) e tem trecho",
    avisos.length === 1 &&
      avisos[0].from === ancora.from &&
      avisos[0].to === ancora.to &&
      SEM_RESUMO.slice(avisos[0].from, avisos[0].to).trim().length > 0,
    JSON.stringify(avisos)
  );

  const correto = await rodar(COMPLETO, regras);
  checa("não acusa o trabalho com resumo, abstract e sumário", correto.length === 0, JSON.stringify(correto));

  const qualquer = await rodar(TEXTO_QUALQUER, regras);
  checa("não acusa um texto qualquer (sem seções de trabalho)", qualquer.length === 0, JSON.stringify(qualquer));

  const resumoSolto = await rodar("# RESUMO\n\ntexto.", regras);
  checa("não acusa um resumo solto (evidência insuficiente)", resumoSolto.length === 0, JSON.stringify(resumoSolto));
}

// ---------------------------------------------------------------- E02

console.log("\nE02 — ordem pré-textuais → textuais → pós-textuais");
{
  const regras = await regrasDe("abnt.e02");

  const avisos = await rodar(REFS_ANTES_CONCLUSAO, regras);
  checa(
    "acusa referências antes da conclusão",
    avisos.length === 1 &&
      avisos[0].mensagem.includes("“CONCLUSÃO”") &&
      avisos[0].mensagem.includes("“REFERÊNCIAS”") &&
      avisos[0].mensagem.includes("pré-textuais → textuais → pós-textuais"),
    JSON.stringify(avisos.map((a) => a.mensagem))
  );
  checa(
    "o aviso aponta o título fora de ordem (trecho visível) e manda mover",
    avisos.length === 1 &&
      REFS_ANTES_CONCLUSAO.slice(avisos[0].from, avisos[0].to) === "CONCLUSÃO" &&
      avisos[0].mensagem.includes("Mova “CONCLUSÃO” para antes de “REFERÊNCIAS”"),
    JSON.stringify(avisos)
  );

  const correto = await rodar(ORDEM_CERTA, regras);
  checa("não acusa a ordem certa", correto.length === 0, JSON.stringify(correto));

  const preDepois = await rodar(RESUMO_DEPOIS, regras);
  checa(
    "acusa pré-textual depois do textual",
    preDepois.length === 1 &&
      RESUMO_DEPOIS.slice(preDepois[0].from, preDepois[0].to) === "RESUMO" &&
      preDepois[0].mensagem.includes("“INTRODUÇÃO”"),
    JSON.stringify(preDepois)
  );

  const qualquer = await rodar(TEXTO_QUALQUER, regras);
  checa("não acusa um texto qualquer", qualquer.length === 0, JSON.stringify(qualquer));
}

// ---------------------------------------------------------------- E03

console.log("\nE03 — introdução, desenvolvimento e conclusão");
{
  const regras = await regrasDe("abnt.e03");

  const avisos = await rodar(SEM_CONCLUSAO, regras);
  checa(
    "acusa o trabalho sem conclusão",
    avisos.length === 1 && avisos[0].mensagem.includes("“CONCLUSÃO”"),
    JSON.stringify(avisos.map((a) => a.mensagem))
  );

  const correto = await rodar(COMPLETO, regras);
  checa("não acusa o trabalho com introdução, desenvolvimento e conclusão", correto.length === 0, JSON.stringify(correto));

  const alternativas = await rodar(E03_ALTERNATIVAS, regras);
  checa(
    "não acusa quando a conclusão se chama “Considerações finais” (alternativa)",
    alternativas.length === 0,
    JSON.stringify(alternativas)
  );

  const soIntroducao = await rodar("# INTRODUÇÃO\n\ntexto.", regras);
  checa("não acusa com uma única seção (evidência insuficiente)", soIntroducao.length === 0, JSON.stringify(soIntroducao));

  const semIntroducao = await rodar(["# DESENVOLVIMENTO", "", "texto.", "", "# CONCLUSÃO", "", "fim."].join("\n"), regras);
  checa(
    "acusa o trabalho sem introdução",
    semIntroducao.length === 1 && semIntroducao[0].mensagem.includes("“INTRODUÇÃO”"),
    JSON.stringify(semIntroducao.map((a) => a.mensagem))
  );

  const qualquer = await rodar(TEXTO_QUALQUER, regras);
  checa("não acusa um texto qualquer", qualquer.length === 0, JSON.stringify(qualquer));
}

// ---------------------------------------------------------------- P01

console.log("\nP01 — seções do projeto de pesquisa");
{
  const regras = await regrasDe("abnt.p01");

  const avisos = await rodar(PROJETO_SEM_CRONOGRAMA, regras);
  checa(
    "acusa o projeto sem cronograma",
    avisos.length === 1 && avisos[0].mensagem.includes("“CRONOGRAMA”"),
    JSON.stringify(avisos.map((a) => a.mensagem))
  );
  checa(
    "o aviso cita a NBR 15287 e fala de projeto de pesquisa",
    avisos.length === 1 && avisos[0].mensagem.includes("[ABNT NBR 15287:2025]") && avisos[0].mensagem.includes("projeto de pesquisa"),
    JSON.stringify(avisos.map((a) => a.mensagem))
  );

  const correto = await rodar(PROJETO_COMPLETO, regras);
  checa("não acusa o projeto completo", correto.length === 0, JSON.stringify(correto));

  const alternativas = await rodar(
    ["# INTRODUÇÃO", "", "tema.", "", "# OBJETIVO GERAL", "", "objetivo.", "", "# MATERIAL E MÉTODOS", "", "procedimentos.", "", "# CRONOGRAMA", "", "etapas."].join("\n"),
    regras
  );
  checa(
    "não acusa com “Objetivo geral” e “Material e métodos” (alternativas)",
    alternativas.length === 0,
    JSON.stringify(alternativas)
  );

  const soCronograma = await rodar("# CRONOGRAMA\n\netapas.", regras);
  checa("não acusa com uma única seção (evidência insuficiente)", soCronograma.length === 0, JSON.stringify(soCronograma));

  const qualquer = await rodar(TEXTO_QUALQUER, regras);
  checa("não acusa um texto qualquer", qualquer.length === 0, JSON.stringify(qualquer));
}

// ---------------------------------------------------------------- integração

console.log("\nintegração (as três regras do grupo E juntas)");
{
  const E = regrasDeIds(["abnt.e01", "abnt.e02", "abnt.e03"]);
  const avisos = await rodar(SEM_RESUMO, E);
  checa(
    "só E01 fala no trabalho sem pré-textuais (E02/E03 estão satisfeitas)",
    avisos.length === 1 && avisos[0].mensagem.includes("elementos pré-textuais"),
    JSON.stringify(avisos.map((a) => a.mensagem))
  );

  const foraDeOrdem = await rodar(REFS_ANTES_CONCLUSAO, E);
  checa(
    "só E02 fala no trabalho fora de ordem (E01/E03 ficam quietas)",
    foraDeOrdem.length === 1 && foraDeOrdem[0].mensagem.includes("fora de ordem"),
    JSON.stringify(foraDeOrdem.map((a) => a.mensagem))
  );
}

// ---------------------------------------------------------------- verificador direto

console.log("\nverificador secoes-obrigatorias (direto)");
{
  const texto = "# INTRODUÇÃO\n\nx\n\n# CONCLUSÃO\n\nfim";

  const comMinimo1 = await verificar("secoes-obrigatorias", texto, { obrigatorias: ["INTRODUÇÃO", "DESENVOLVIMENTO"], minimo: 1 });
  checa(
    "com `minimo = 1`, uma seção reconhecida já faz falar",
    comMinimo1.length === 1 && comMinimo1[0].mensagem.includes("“DESENVOLVIMENTO”"),
    JSON.stringify(comMinimo1)
  );
  checa(
    "o aviso ausente ancora no fim (trecho “fim”)",
    comMinimo1.length === 1 && texto.slice(comMinimo1[0].from, comMinimo1[0].to) === "fim",
    JSON.stringify(comMinimo1)
  );

  const padrao = await verificar("secoes-obrigatorias", texto, { obrigatorias: ["INTRODUÇÃO", "DESENVOLVIMENTO"] });
  checa("sem `minimo`, o padrão 2 exige duas seções reconhecidas", padrao.length === 0, JSON.stringify(padrao));

  const alternativas = await verificar("secoes-obrigatorias", "# INTRODUÇÃO\n\nx\n\n# CONSIDERAÇÕES FINAIS\n\nfim", {
    obrigatorias: [{ rotulo: "CONCLUSÃO", nomes: ["CONCLUSÃO", "CONSIDERAÇÕES FINAIS"] }],
    minimo: 1,
  });
  checa("item com alternativas é satisfeito por qualquer uma delas", alternativas.length === 0, JSON.stringify(alternativas));

  const bloco = await verificar("secoes-obrigatorias", "# INTRODUÇÃO\n\nx\n\n# 8. Referências Bibliográficas\n\nSILVA, João. Livro. 2020.", {
    obrigatorias: ["referencias"],
    minimo: 1,
  });
  checa("nome de bloco conhece os sinônimos (Referências Bibliográficas)", bloco.length === 0, JSON.stringify(bloco));

  const nivel2 = await verificar("secoes-obrigatorias", "## INTRODUÇÃO\n\nx\n\n## CONCLUSÃO\n\ny", {
    obrigatorias: ["INTRODUÇÃO", "DESENVOLVIMENTO"],
    minimo: 1,
  });
  checa("o nível padrão (1) ignora seções de nível 2", nivel2.length === 0, JSON.stringify(nivel2));

  const nivel2b = await verificar("secoes-obrigatorias", "## INTRODUÇÃO\n\nx\n\n## CONCLUSÃO\n\ny", {
    obrigatorias: ["INTRODUÇÃO", "DESENVOLVIMENTO"],
    minimo: 1,
    nivel: 2,
  });
  checa("com `nivel = 2`, as seções de nível 2 entram", nivel2b.length === 1, JSON.stringify(nivel2b));

  let faltouOpcao = false;
  try {
    await verificar("secoes-obrigatorias", "x", {});
  } catch (e) {
    faltouOpcao = /obrigatorias/.test(String(e));
  }
  checa("opção obrigatória ausente reclama (não vira undefined circulando)", faltouOpcao);
}

console.log("\nverificador secoes-em-ordem (direto)");
{
  const fases = [["RESUMO"], ["INTRODUÇÃO"], ["REFERÊNCIAS"]];
  const fasesNomes = ["pré", "textual", "pós"];

  const fora = await verificar("secoes-em-ordem", "# REFERÊNCIAS\n\nx\n\n# INTRODUÇÃO\n\ny", { fases, fases_nomes: fasesNomes });
  checa(
    "acusa a fase posterior antes da anterior",
    fora.length === 1 && fora[0].mensagem.includes("“INTRODUÇÃO”") && fora[0].mensagem.includes("“REFERÊNCIAS”"),
    JSON.stringify(fora)
  );

  const ordem = await verificar("secoes-em-ordem", "# RESUMO\n\nx\n\n# INTRODUÇÃO\n\ny\n\n# REFERÊNCIAS\n\nz", { fases, fases_nomes: fasesNomes });
  checa("não acusa a ordem certa", ordem.length === 0, JSON.stringify(ordem));

  let faltouFases = false;
  try {
    await verificar("secoes-em-ordem", "x", {});
  } catch (e) {
    faltouFases = /fases/.test(String(e));
  }
  checa("`fases` ausente reclama", faltouFases);

  let contouFases = false;
  try {
    await verificar("secoes-em-ordem", "# RESUMO\n\nx", { fases, fases_nomes: ["pré"] });
  } catch (e) {
    contouFases = /fases_nomes/.test(String(e));
  }
  checa("`fases_nomes` com contagem errada reclama", contouFases);
}

fim();
