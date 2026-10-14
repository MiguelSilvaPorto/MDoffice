// Teste das regras de TABELAS e FIGURAS — T01 (IBGE), T02 e E11 (NBR 14724).
//
// Cada caso tem os DOIS lados: o texto que acusa e o texto correto que NÃO acusa —
// sem o segundo, o teste não prova precisão (contrato em docs/abnt-como-escrever-regras.md).
//
// Roda com: node scripts/testar-abnt-tabelas.mts

import { checa, fim, regrasDe, rodar } from "./abnt/ferramentas.mts";

const t01 = await regrasDe("abnt.t01");
const t02 = await regrasDe("abnt.t02");
const e11 = await regrasDe("abnt.e11");

/** Roda as regras contra o texto (máscara do app) e confere quantos avisos saíram. */
async function confere(nome: string, texto: string, regras: any[], quantos: number): Promise<any[]> {
  const avisos = await rodar(texto, regras);
  checa(
    nome,
    avisos.length === quantos,
    `${avisos.length} aviso(s): ${JSON.stringify(avisos.map((a) => a.mensagem))}`
  );
  return avisos;
}

console.log("T01 — tabela: título acima e “Fonte:” abaixo");
{
  const completa = [
    "Tabela 1 – População residente, por região",
    "",
    "| Região | Total |",
    "| --- | --- |",
    "| Sul | 10 |",
    "",
    "Fonte: IBGE (2024).",
  ].join("\n");
  await confere("completa (título e fonte) não acusa", completa, t01, 0);

  const semFonte = [
    "Tabela 1 – População residente",
    "",
    "| Região | Total |",
    "| --- | --- |",
    "| Sul | 10 |",
    "",
    "Os dados mostram o crescimento da região Sul.",
  ].join("\n");
  const avisosSemFonte = await confere("sem “Fonte:” acusa uma vez", semFonte, t01, 1);
  checa("o aviso é o da fonte", /fonte/i.test(avisosSemFonte[0]?.mensagem ?? ""), avisosSemFonte[0]?.mensagem);
  checa(
    "sem correção pronta (a autoria não é conhecida)",
    avisosSemFonte[0]?.fix === undefined && avisosSemFonte[0]?.safe === false && avisosSemFonte[0]?.sugestoes.length === 0,
    JSON.stringify(avisosSemFonte[0])
  );
  checa(
    "e ancora na última linha da tabela",
    avisosSemFonte[0]?.from === semFonte.indexOf("| Sul | 10 |"),
    String(avisosSemFonte[0]?.from)
  );

  const semTitulo = ["| Região | Total |", "| --- | --- |", "| Sul | 10 |", "", "Fonte: IBGE (2024)."].join("\n");
  const avisosSemTitulo = await confere("sem título acima acusa uma vez", semTitulo, t01, 1);
  checa("o aviso é o do título", /título/i.test(avisosSemTitulo[0]?.mensagem ?? ""), avisosSemTitulo[0]?.mensagem);
  checa("e ancora na primeira linha da tabela", avisosSemTitulo[0]?.from === 0, String(avisosSemTitulo[0]?.from));

  const semNada = ["| a | b |", "| --- | --- |", "| 1 | 2 |"].join("\n");
  await confere("sem título e sem fonte acusa as duas coisas", semNada, t01, 2);

  const negrito = [
    "**Tabela 2 — Renda média**",
    "",
    "| Cidade | Renda |",
    "| --- | --- |",
    "| A | 3 |",
    "",
    "**Fonte:** IBGE (2024).",
  ].join("\n");
  await confere("título e fonte em negrito não acusam", negrito, t01, 0);

  const quadro = [
    "Quadro 1 – Metas do plano",
    "",
    "| Meta | Prazo |",
    "| --- | --- |",
    "| A | 2027 |",
    "",
    "Fonte: elaborado pelo autor (2026).",
  ].join("\n");
  await confere("“Quadro 1” acima conta como título", quadro, t01, 0);

  const duasTabelas = [
    "Tabela 1 – População residente",
    "",
    "| Região | Total |",
    "| --- | --- |",
    "| Sul | 10 |",
    "",
    "Fonte: IBGE (2024).",
    "",
    "Tabela 2 – Renda média",
    "",
    "| Cidade | Renda |",
    "| --- | --- |",
    "| A | 3 |",
  ].join("\n");
  await confere("só a tabela sem fonte acusa (uma vez)", duasTabelas, t01, 1);
}

console.log("\nT02 — figura: legenda acima e “Fonte:” abaixo");
{
  const completa = [
    "Figura 1 – Fluxo do processo",
    "",
    "![Fluxo do processo](fluxo.png)",
    "",
    "Fonte: elaborado pelo autor (2026).",
  ].join("\n");
  await confere("completa (legenda e fonte) não acusa", completa, t02, 0);

  const semFonte = [
    "Figura 1 – Fluxo do processo",
    "",
    "![Fluxo do processo](fluxo.png)",
    "",
    "O fluxo começa na entrada de dados.",
  ].join("\n");
  const avisosSemFonte = await confere("sem “Fonte:” acusa uma vez", semFonte, t02, 1);
  checa("o aviso é o da fonte", /fonte/i.test(avisosSemFonte[0]?.mensagem ?? ""), avisosSemFonte[0]?.mensagem);

  const semLegenda = ["![Fluxo do processo](fluxo.png)", "", "Fonte: elaborado pelo autor."].join("\n");
  const avisosSemLegenda = await confere("sem legenda acima acusa uma vez", semLegenda, t02, 1);
  checa("o aviso é o da legenda", /legenda/i.test(avisosSemLegenda[0]?.mensagem ?? ""), avisosSemLegenda[0]?.mensagem);

  await confere("figura sozinha acusa as duas coisas", "![Fluxo](fluxo.png)", t02, 2);

  const grafico = [
    "Gráfico 1 – Evolução das matrículas",
    "",
    "![Evolução](grafico.png)",
    "",
    "Fonte: INEP (2024).",
  ].join("\n");
  await confere("“Gráfico 1” acima conta como legenda", grafico, t02, 0);

  const caixaAlta = [
    "**Figura 2 – Arquitetura do sistema**",
    "",
    "![Arquitetura](arq.png)",
    "",
    "FONTE: elaborado pelo autor.",
  ].join("\n");
  await confere("legenda em negrito e “FONTE:” em caixa alta não acusam", caixaAlta, t02, 0);
}

console.log("\nE11 — listas só com itens que existem");
{
  const semLista = [
    "# 1 Introdução",
    "",
    "texto",
    "",
    "Tabela 1 – População",
    "",
    "| a | b |",
    "| --- | --- |",
    "| 1 | 2 |",
    "",
    "Fonte: IBGE (2024).",
  ].join("\n");
  await confere("documento sem listas não acusa", semLista, e11, 0);

  const tabelasOk = [
    "# LISTA DE TABELAS",
    "",
    "Tabela 1 – População residente",
    "",
    "# 1 Introdução",
    "",
    "Tabela 1 – População residente",
    "",
    "| Região | Total |",
    "| --- | --- |",
    "| Sul | 10 |",
    "",
    "Fonte: IBGE (2024).",
  ].join("\n");
  await confere("lista de tabelas com item que existe não acusa", tabelasOk, e11, 0);

  const tabelasVazia = ["# LISTA DE TABELAS", "", "# 1 Introdução", "", "texto"].join("\n");
  const avisosVazia = await confere("lista de tabelas vazia acusa uma vez", tabelasVazia, e11, 1);
  checa("o aviso é o de lista vazia", /sem nenhum item/i.test(avisosVazia[0]?.mensagem ?? ""), avisosVazia[0]?.mensagem);
  checa(
    "e ancora no título da lista",
    avisosVazia[0]?.from === tabelasVazia.indexOf("LISTA DE TABELAS"),
    String(avisosVazia[0]?.from)
  );

  const tabelasFantasma = [
    "# LISTA DE TABELAS",
    "",
    "Tabela 3 – Renda média",
    "",
    "# 1 Introdução",
    "",
    "Tabela 1 – População residente",
    "",
    "| Região | Total |",
    "| --- | --- |",
    "| Sul | 10 |",
    "",
    "Fonte: IBGE (2024).",
  ].join("\n");
  const avisosFantasma = await confere("item que não existe no documento acusa uma vez", tabelasFantasma, e11, 1);
  checa("o aviso aponta o item", (avisosFantasma[0]?.mensagem ?? "").includes("Tabela 3"), avisosFantasma[0]?.mensagem);
  checa(
    "e ancora na linha do item",
    avisosFantasma[0]?.from === tabelasFantasma.indexOf("Tabela 3"),
    String(avisosFantasma[0]?.from)
  );

  const figurasOk = [
    "# LISTA DE FIGURAS",
    "",
    "Figura 1 – Fluxo do processo",
    "",
    "# 1 Introdução",
    "",
    "Figura 1 – Fluxo do processo",
    "",
    "![Fluxo](fluxo.png)",
    "",
    "Fonte: elaborado pelo autor.",
  ].join("\n");
  await confere("lista de figuras com item que existe não acusa", figurasOk, e11, 0);

  const figuraSoNoAlt = [
    "# LISTA DE FIGURAS",
    "",
    "Figura 1 – Fluxo do processo",
    "",
    "# 1 Introdução",
    "",
    "![Figura 1 – Fluxo do processo](fluxo.png)",
  ].join("\n");
  await confere("identificação no alt da imagem conta como existente", figuraSoNoAlt, e11, 0);

  const figurasFantasma = ["# LISTA DE FIGURAS", "", "Figura 2 – Arquitetura", "", "# 1 Introdução", "", "texto"].join("\n");
  await confere("figura listada que não existe acusa uma vez", figurasFantasma, e11, 1);

  const siglasOk = [
    "# LISTA DE SIGLAS",
    "",
    "ABNT – Associação Brasileira de Normas Técnicas",
    "",
    "# 1 Introdução",
    "",
    "Conforme a ABNT, o trabalho segue as normas.",
  ].join("\n");
  await confere("sigla usada no texto não acusa", siglasOk, e11, 0);

  const siglasFantasma = [
    "# LISTA DE SIGLAS",
    "",
    "ABNT – Associação Brasileira de Normas Técnicas",
    "",
    "# 1 Introdução",
    "",
    "texto sem a sigla",
  ].join("\n");
  await confere("sigla listada que não é usada acusa uma vez", siglasFantasma, e11, 1);

  const siglasVazia = ["# LISTA DE SIGLAS", "", "# 1 Introdução", "", "texto"].join("\n");
  await confere("lista de siglas vazia acusa uma vez", siglasVazia, e11, 1);

  const siglasTabela = [
    "# LISTA DE SIGLAS",
    "",
    "| Sigla | Significado |",
    "| --- | --- |",
    "| ABNT | Associação Brasileira de Normas Técnicas |",
    "",
    "# 1 Introdução",
    "",
    "texto",
  ].join("\n");
  await confere("lista de siglas em tabela não é “vazia” e não acusa", siglasTabela, e11, 0);
}

fim();
