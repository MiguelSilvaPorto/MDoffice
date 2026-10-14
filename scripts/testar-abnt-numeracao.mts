// Teste das regras ABNT do grupo S: SUMÁRIO e NUMERAÇÃO (NBR 6027 e NBR 6024).
//
// Cada caso tem os DOIS lados: o texto que acusa e o texto correto que NÃO acusa —
// sem o segundo, o teste não prova precisão. As regras rodam pelo caminho real
// (TOML → lint → interpretador → verificador), com a mesma máscara do app.
//
// Roda com: node scripts/testar-abnt-numeracao.mts

import { checa, fim, regrasCruas, regrasDe, rodar, verificar } from "./abnt/ferramentas.mts";

const s01 = await regrasDe("abnt.s01");
const s02 = await regrasDe("abnt.s02");
const s03 = await regrasDe("abnt.s03");
const s04 = await regrasDe("abnt.s04");
const grupo = await regrasDe("abnt.s");

const semAviso = (nome: string, avisos: any[]) => checa(nome, avisos.length === 0, JSON.stringify(avisos));
const umAviso = (nome: string, avisos: any[], trecho: string) =>
  checa(nome, avisos.length === 1 && avisos[0].mensagem.includes(trecho), JSON.stringify(avisos));

console.log("S01 — o sumário bate com os títulos e a ordem");
{
  // O caso correto: itens de lista com numeração, pontilhado e páginas.
  const correto = [
    "# SUMÁRIO",
    "",
    "- 1 Introdução ......... 1",
    "- 2 Referencial teórico ......... 3",
    "- 2.1 Conceito ......... 3",
    "",
    "# 1 Introdução",
    "",
    "Texto.",
    "",
    "# 2 Referencial teórico",
    "",
    "Texto.",
    "",
    "## 2.1 Conceito",
    "",
    "Texto.",
  ].join("\n");
  semAviso("sumário completo não acusa", await rodar(correto, s01));

  // Tolerância: link, destaque e item sem número de página.
  const tolerado = [
    "# SUMÁRIO",
    "",
    "- [1 Introdução](#introducao)",
    "- **2.1 Conceito**",
    "",
    "# 1 Introdução",
    "",
    "Texto.",
    "",
    "## 2.1 Conceito",
    "",
    "Texto.",
  ].join("\n");
  semAviso("link, negrito e item sem página são tolerados", await rodar(tolerado, s01));

  // A subseção que existe no texto e falta no sumário — o caso do catálogo.
  const ausente = [
    "# SUMÁRIO",
    "",
    "- 1 Introdução ......... 1",
    "- 2 Referencial teórico ......... 3",
    "",
    "# 1 Introdução",
    "",
    "Texto.",
    "",
    "# 2 Referencial teórico",
    "",
    "Texto.",
    "",
    "## 2.1 Conceito",
    "",
    "Texto.",
  ].join("\n");
  const faltando = await rodar(ausente, s01);
  umAviso("subseção ausente no sumário acusa", faltando, "não lista esta seção");
  checa(
    "o aviso aponta o título que falta no corpo",
    faltando.length === 1 && faltando[0].mensagem.includes("2.1 Conceito"),
    JSON.stringify(faltando)
  );

  // Sem sumário é silêncio (quem cobra o elemento é a regra E01).
  semAviso(
    "documento sem SUMÁRIO não acusa",
    await rodar("# 1 Introdução\n\nTexto.\n\n## 1.1 Contexto\n\nTexto.", s01)
  );
  semAviso("sumário ainda sem itens não acusa", await rodar("# SUMÁRIO\n\n# 1 Introdução\n\nTexto.", s01));

  // Entrada que não corresponde a título nenhum.
  const fantasma = [
    "# SUMÁRIO",
    "",
    "- 1 Introdução ......... 1",
    "- 3 Metodologia ......... 5",
    "",
    "# 1 Introdução",
    "",
    "Texto.",
  ].join("\n");
  umAviso("entrada sem título correspondente acusa", await rodar(fantasma, s01), "não corresponde a nenhum título");

  // Ordem trocada no sumário.
  const desordenado = [
    "# SUMÁRIO",
    "",
    "- 2 Referencial ......... 3",
    "- 1 Introdução ......... 1",
    "",
    "# 1 Introdução",
    "",
    "Texto.",
    "",
    "# 2 Referencial",
    "",
    "Texto.",
  ].join("\n");
  umAviso("entrada fora de ordem acusa", await rodar(desordenado, s01), "fora de ordem");

  // Profundidade: nível 4 fora do sumário é silêncio; nível 2 é cobrado.
  const fundo = [
    "# SUMÁRIO",
    "",
    "- 1 Introdução",
    "- 1.1 Objetivo",
    "- 1.1.1 Detalhe",
    "",
    "# 1 Introdução",
    "",
    "Texto.",
    "",
    "## 1.1 Objetivo",
    "",
    "Texto.",
    "",
    "### 1.1.1 Detalhe",
    "",
    "Texto.",
    "",
    "#### 1.1.1.1 Detalhe fino",
    "",
    "Texto.",
  ].join("\n");
  semAviso("seção quaternária fora do sumário não é cobrada (profundidade 3)", await rodar(fundo, s01));

  const pequeno = "# SUMÁRIO\n\n- 1 Introdução\n\n# 1 Introdução\n\nTexto.\n\n## 1.1 Objetivo\n\nTexto.";
  umAviso(
    "a opção profundidade é lida do TOML (nível 2 cobrado)",
    await rodar(pequeno, s01),
    "não lista esta seção"
  );
  semAviso("profundidade menor silencia o nível não cobrado", await verificar("sumario-bate-titulos", pequeno, { profundidade: 1 }));

  // Pós-textuais são ignorados pelas duas pontas: nem cobrados nem fantasma.
  const pos = "# SUMÁRIO\n\n- 1 Introdução ......... 1\n- REFERÊNCIAS ......... 20\n\n# 1 Introdução\n\nTexto.\n\n# REFERÊNCIAS\n\nSILVA, João. **Livro**. 2020.";
  semAviso("REFERÊNCIAS no sumário não é fantasma", await rodar(pos, s01));
}

console.log("\nS02 — pré-textuais fora do sumário");
{
  const comResumo = [
    "# SUMÁRIO",
    "",
    "- RESUMO ......... 3",
    "- 1 Introdução ......... 5",
    "",
    "# RESUMO",
    "",
    "Texto.",
    "",
    "# 1 Introdução",
    "",
    "Texto.",
  ].join("\n");
  umAviso("RESUMO listado no sumário acusa", await rodar(comResumo, s02), "Elemento pré-textual");

  const comLista = "# SUMÁRIO\n\n- LISTA DE TABELAS ......... 4\n- 1 Introdução ......... 5\n\n# LISTA DE TABELAS\n\nTabela 1 — x\n\n# 1 Introdução\n\nTexto.";
  umAviso("LISTA DE TABELAS listada acusa", await rodar(comLista, s02), "Elemento pré-textual");

  const soTexto = "# SUMÁRIO\n\n- 1 Introdução ......... 1\n- REFERÊNCIAS ......... 20\n\n# 1 Introdução\n\nTexto.\n\n# REFERÊNCIAS\n\nSILVA, João. 2020.";
  semAviso("só títulos do texto e pós-textuais não acusam", await rodar(soTexto, s02));
  semAviso("documento sem sumário não acusa", await rodar("# RESUMO\n\nTexto.", s02));
}

console.log("\nS03 — numeração decimal e níveis");
{
  // O exemplo do catálogo: "1.2" em ## depois de "3.".
  const errado = "# 3 PROPAGANDA\n\nTexto.\n\n## 1.2 Conceito\n\nTexto.";
  umAviso("numeração que não continua a do pai acusa", await rodar(errado, s03), "não continua");

  const certo = "# 3 PROPAGANDA\n\nTexto.\n\n## 3.1 Conceito\n\nTexto.\n\n## 3.2 Tipos\n\nTexto.";
  semAviso("subseções que continuam o pai não acusam", await rodar(certo, s03));

  // Nível a mais: "2.1.1.1" direto sob "2.1", sem a subseção intermediária.
  const fundoDemais = "# 2 METODOLOGIA\n\nTexto.\n\n## 2.1 Entrevistas\n\nTexto.\n\n#### 2.1.1.1 Roteiro\n\nTexto.";
  umAviso("indicativo mais fundo que a estrutura acusa", await rodar(fundoDemais, s03), "desce mais níveis");

  const progressivo = "# 1 INTRODUÇÃO\n\nTexto.\n\n## 1.1 Contexto\n\nTexto.\n\n### 1.1.1 Histórico\n\nTexto.\n\n## 1.2 Objetivos\n\nTexto.";
  semAviso("progressão normal (1, 1.1, 1.1.1, 1.2) não acusa", await rodar(progressivo, s03));

  semAviso("títulos sem indicativo não acusam", await rodar("# INTRODUÇÃO\n\nTexto.\n\n## Contexto\n\nTexto.", s03));
  semAviso("títulos de nível 1 não têm pai para continuar", await rodar("# 1 Introdução\n\nTexto.\n\n# 2 Método\n\nTexto.", s03));
}

console.log("\nS04 — subseção única (sugestão)");
{
  const unica = "# 2 METODOLOGIA\n\nTexto.\n\n## 2.1 Entrevistas\n\nTexto.";
  umAviso("uma única subseção acusa", await rodar(unica, s04), "Subseção única");

  const duas = "# 2 METODOLOGIA\n\nTexto.\n\n## 2.1 Entrevistas\n\nTexto.\n\n## 2.2 Questionários\n\nTexto.";
  semAviso("duas subseções não acusam", await rodar(duas, s04));

  const mista = "# 2 METODOLOGIA\n\nTexto.\n\n## 2.1 Entrevistas\n\nTexto.\n\n## Questionários\n\nTexto.";
  semAviso("a filha sem indicativo também conta na divisão", await rodar(mista, s04));

  semAviso("sem indicativo decimal não acusa (README não é tese)", await rodar("# Metodologia\n\nTexto.\n\n## Entrevistas\n\nTexto.", s04));
  semAviso("pré/pós-textuais não contam como divisão", await rodar("# REFERÊNCIAS\n\n## 1.1 Algo\n\nTexto.", s04));

  const cru = (await regrasCruas("abnt.s04"))[0];
  checa("S04 é sugestão e nunca automática", cru?.severidade === "suggestion" && cru?.auto !== true, JSON.stringify(cru));
  const avisos = await rodar(unica, s04);
  checa("o aviso de S04 sai sem correção automática", avisos.length === 1 && avisos[0].safe === false, JSON.stringify(avisos));
}

console.log("\nintegração — as quatro regras juntas");
{
  const texto = [
    "# SUMÁRIO",
    "",
    "- RESUMO ......... 3",
    "- 1 INTRODUÇÃO ......... 5",
    "",
    "# RESUMO",
    "",
    "Texto.",
    "",
    "# 1 INTRODUÇÃO",
    "",
    "Texto.",
    "",
    "## 1.1 Contexto",
    "",
    "Texto.",
    "",
    "# 2 METODOLOGIA",
    "",
    "Texto.",
    "",
    "## 4 RESULTADOS",
    "",
    "Texto.",
  ].join("\n");
  const avisos = await rodar(texto, grupo);
  const tem = (pedaco: string) => avisos.some((a) => a.mensagem.includes(pedaco));
  checa("a entrada pré-textual é acusada (S02)", tem("Elemento pré-textual"), JSON.stringify(avisos));
  checa("a seção ausente no sumário é acusada (S01)", tem("não lista esta seção"), JSON.stringify(avisos));
  checa("a numeração errada é acusada (S03)", tem("não continua"), JSON.stringify(avisos));
  checa("a subseção única é acusada (S04)", tem("Subseção única"), JSON.stringify(avisos));
  checa(
    "todo aviso tem trecho (o motor descarta aviso vazio)",
    avisos.length > 0 && avisos.every((a) => a.to > a.from),
    JSON.stringify(avisos)
  );
  checa(
    "nenhum aviso tem correção a aplicar (grupo S é conferência)",
    avisos.every((a) => a.fix === undefined && a.safe === false),
    JSON.stringify(avisos)
  );
}

fim();
