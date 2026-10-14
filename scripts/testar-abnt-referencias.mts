// Teste das regras da LISTA de referências (NBR 6023:2025): R01, R02, R11 e R12.
//
// As quatro são verificadores (`tipo = "estrutura"`), então o caminho do teste é o do
// app inteiro: TOML → lint da carga → verificador → aviso do motor, sobre a máscara.
// Cada caso tem os DOIS lados: o texto que acusa e o texto correto que NÃO acusa.
//
// Os limites estão escritos onde aparecem (o que a regra deixa passar de propósito):
// a chave da ordem é conservadora, o cruzamento casa por palavra e a R12 só olha a
// mistura na mesma lista — falso positivo é pior que falso negativo.

import { checa, empacotar, fim, rodar } from "./abnt/ferramentas.mts";

const I = await empacotar("src/broker/abnt/index.ts");

const IDS = ["abnt.r01", "abnt.r02", "abnt.r11", "abnt.r12"];
const cruas = (I.carregarRegras() as any[]).filter((r) => IDS.includes(r.id));
checa("as quatro regras da lista carregam pelo lint", cruas.length === 4, cruas.map((r) => r.id).join(", "));
checa(
  "as quatro apontam para o verificador, na norma e no grupo certos",
  cruas.every((r) => r.tipo === "estrutura" && typeof r.verifica === "string" && r.norma === "nbr6023:2025" && r.grupo === "R"),
  JSON.stringify(cruas.map((r) => [r.id, r.tipo, r.verifica, r.norma]))
);
{
  const r12crua = cruas.find((r) => r.id === "abnt.r12");
  checa(
    "R12 é sugestão e nunca automática (confiança baixa do catálogo)",
    r12crua?.severidade === "suggestion" && r12crua?.auto !== true,
    JSON.stringify(r12crua)
  );
}

const r01 = I.regraDeToml(cruas.find((r) => r.id === "abnt.r01"));
const r02 = I.regraDeToml(cruas.find((r) => r.id === "abnt.r02"));
const r11 = I.regraDeToml(cruas.find((r) => r.id === "abnt.r11"));
const r12 = I.regraDeToml(cruas.find((r) => r.id === "abnt.r12"));

const ver = (regra: any, texto: string): Promise<any[]> => rodar(texto, [regra]);
const recorte = (texto: string, aviso: any): string => texto.slice(aviso.from, aviso.to);

// ---------------------------------------------------------------- R01

console.log("\nR01 — a lista de referências existe");
{
  const citacao = "# INTRODUÇÃO\n\nO tema segue atual (Furtado, 2019).\n";
  const avisos = await ver(r01, citacao);
  checa("acusa sem a lista quando há citação", avisos.length === 1, JSON.stringify(avisos));
  checa(
    "a mensagem diz o que falta e o que fazer",
    /Falta a lista de referências/.test(avisos[0]?.mensagem ?? "") && /REFERÊNCIAS/.test(avisos[0]?.mensagem ?? ""),
    avisos[0]?.mensagem
  );
  checa(
    "a âncora é a última linha com conteúdo (onde a lista entraria)",
    recorte(citacao, avisos[0]) === "O tema segue atual (Furtado, 2019).",
    JSON.stringify(recorte(citacao, avisos[0]))
  );

  const narrativa = "# INTRODUÇÃO\n\nSegundo Silva (2020), o tema segue atual.\n";
  checa("a citação narrativa (autor fora do parêntese) também cobra a lista", (await ver(r01, narrativa)).length === 1);

  const academico = "# RESUMO\n\nUm resumo do trabalho.\n\n# INTRODUÇÃO\n\nTexto.\n";
  checa("trabalho com RESUMO cobra a lista mesmo sem citação", (await ver(r01, academico)).length === 1);

  const nota = "# MINHAS NOTAS\n\nUma ideia solta, sem citação nenhuma.\n";
  checa("nota solta fica em silêncio (não é trabalho)", (await ver(r01, nota)).length === 0);

  const comLista = "# INTRODUÇÃO\n\nO tema segue atual (Furtado, 2019).\n\n# REFERÊNCIAS\n\nFURTADO, Carlos. **Obra**. São Paulo: Editora, 2019.\n";
  checa("com a lista presente não acusa", (await ver(r01, comLista)).length === 0);

  checa("documento vazio não acusa", (await ver(r01, "")).length === 0);
}

// ---------------------------------------------------------------- R02

console.log("\nR02 — ordem alfabética");
{
  const desordenado =
    "# REFERÊNCIAS\n\nSILVA, João. **Outra obra**. Rio de Janeiro: Editora, 2020.\n\nSANTOS, Pedro. **A obra**. São Paulo: Editora, 2019.\n";
  const avisos = await ver(r02, desordenado);
  checa("acusa a entrada que fura a ordem (SANTOS deve vir antes de SILVA)", avisos.length === 1, JSON.stringify(avisos));
  checa(
    "aponta para a entrada fora de ordem e manda reordenar",
    recorte(desordenado, avisos[0]).startsWith("SANTOS") && /reordene/.test(avisos[0]?.mensagem ?? ""),
    avisos[0]?.mensagem
  );

  const ordenado = "# REFERÊNCIAS\n\nSILVA, João. **A**. 2020.\n\nSOUZA, Maria. **B**. 2018.\n";
  checa("em ordem não acusa", (await ver(r02, ordenado)).length === 0);

  const acentos = "# REFERÊNCIAS\n\nÁVILA, Ana. **A**. 2020.\n\nAZEVEDO, Bruno. **B**. 2019.\n";
  checa("acento não decide a ordem (ÁVILA antes de AZEVEDO)", (await ver(r02, acentos)).length === 0);
  const acentosTrocados = "# REFERÊNCIAS\n\nAZEVEDO, Bruno. **B**. 2019.\n\nÁVILA, Ana. **A**. 2020.\n";
  checa("... e acusa quando estão trocados", (await ver(r02, acentosTrocados)).length === 1);

  const mesmoAutor = "# REFERÊNCIAS\n\nSILVA, João. **A**. 2020.\n\nSILVA, João. **B**. 2018.\n";
  checa("várias obras do mesmo autor não são acusadas (a ordem por ano é outra conferência)", (await ver(r02, mesmoAutor)).length === 0);

  const comLixo = "# REFERÊNCIAS\n\nALVES, Ana. **A**. 2020.\n\n(não encontrei os dados)\n\nCOSTA, Carlos. **C**. 2019.\n";
  checa("parágrafo solto no meio não entra na conta nem quebra a ordem", (await ver(r02, comLixo)).length === 0);

  const entidade = "# REFERÊNCIAS\n\nBRASIL. Lei n. 8.078, de 11 de setembro de 1990. Brasília, 1990.\n\nCOSTA, Maria. **B**. 2019.\n";
  checa("entidade sem vírgula (BRASIL) entra pela primeira palavra", (await ver(r02, entidade)).length === 0);
  const entidadeTrocada = "# REFERÊNCIAS\n\nCOSTA, Maria. **B**. 2019.\n\nBRASIL. Lei n. 8.078, de 11 de setembro de 1990. Brasília, 1990.\n";
  checa("... e é acusada quando está fora de ordem", (await ver(r02, entidadeTrocada)).length === 1);

  const titulo = "# REFERÊNCIAS\n\nSILVA, João. **T**. 2019.\n\nA IMPORTÂNCIA da leitura. 2020.\n";
  checa("entrada por título com artigo não é chave confiável (fica fora da conta)", (await ver(r02, titulo)).length === 0);

  const lista = "# REFERÊNCIAS\n\n- SILVA, João. **B**. 2020.\n- SANTOS, Pedro. **A**. 2019.\n";
  checa("item de lista é uma entrada (SANTOS depois de SILVA acusa)", (await ver(r02, lista)).length === 1);

  const coladoNoTitulo = "# REFERÊNCIAS\nSILVA, João. **B**. 2020.\n\nSANTOS, Pedro. **A**. 2019.\n";
  checa("entrada colada no título também é lida", (await ver(r02, coladoNoTitulo)).length === 1);
}

// ---------------------------------------------------------------- R11

console.log("\nR11 — citação ↔ referência");
{
  const lista = "# REFERÊNCIAS\n\nSILVA, João. **Título**. São Paulo: Editora, 2020.\n";

  const comCerto = `# INTRODUÇÃO\n\nO tema é discutido (Silva, 2020) e retomado.\n\n${lista}`;
  checa("citação com entrada não acusa", (await ver(r11, comCerto)).length === 0);

  const comErrado = `# INTRODUÇÃO\n\nO tema é discutido (Furtado, 2019) e retomado.\n\n${lista}`;
  const avisos = await ver(r11, comErrado);
  checa("citação sem entrada acusa", avisos.length === 1, JSON.stringify(avisos));
  checa("aponta o trecho da citação", recorte(comErrado, avisos[0]) === "(Furtado, 2019)", JSON.stringify(recorte(comErrado, avisos[0])));
  checa(
    "a mensagem manda incluir a referência ou remover a citação",
    /inclua a referência ou remova\/ajuste a citação/.test(avisos[0]?.mensagem ?? ""),
    avisos[0]?.mensagem
  );

  const semLista = "# INTRODUÇÃO\n\nO tema é discutido (Furtado, 2019).\n";
  checa("sem lista o cruzamento fica em silêncio (quem cobra é a R01)", (await ver(r11, semLista)).length === 0);

  const listaVazia = "# INTRODUÇÃO\n\nO tema (Furtado, 2019).\n\n# REFERÊNCIAS\n";
  checa("lista só com o título: a citação está sem entrada", (await ver(r11, listaVazia)).length === 1);

  const entidade = "# REFERÊNCIAS\n\nINSTITUTO BRASILEIRO DE GEOGRAFIA E ESTATÍSTICA (IBGE). **Censo 2022**. Rio de Janeiro: IBGE, 2021.\n";
  checa("sigla da entidade casa (IBGE, 2021)", (await ver(r11, `# INTRODUÇÃO\n\nOs dados vêm do (IBGE, 2021).\n\n${entidade}`)).length === 0);

  const variosAutores = "# REFERÊNCIAS\n\nSILVA, João; COSTA, Maria; LIMA, Ana; SOUZA, Rui. **Obra**. 2020.\n";
  checa("et al. casa o primeiro autor", (await ver(r11, `# INTRODUÇÃO\n\n(Silva et al., 2020) defendem.\n\n${variosAutores}`)).length === 0);
  checa("dois autores no mesmo ano (SILVA; COSTA, 2020) casam a entrada", (await ver(r11, `# INTRODUÇÃO\n\n(SILVA; COSTA, 2020)\n\n${variosAutores}`)).length === 0);

  const duasEntradas = "# REFERÊNCIAS\n\nSILVA, João. **A**. 2020.\n\nCOSTA, Maria. **B**. 2019.\n";
  checa(
    "duas citações no mesmo parêntese, as duas com entrada",
    (await ver(r11, `# INTRODUÇÃO\n\n(Silva, 2020; Costa, 2019)\n\n${duasEntradas}`)).length === 0
  );
  const soSilva = "# REFERÊNCIAS\n\nSILVA, João. **A**. 2020.\n";
  const faltando = `# INTRODUÇÃO\n\n(Silva, 2020; Costa, 2019)\n\n${soSilva}`;
  const avisosFalta = await ver(r11, faltando);
  checa(
    "... e só a que falta é acusada, no próprio segmento",
    avisosFalta.length === 1 && recorte(faltando, avisosFalta[0]) === "Costa, 2019",
    JSON.stringify(avisosFalta.map((a) => recorte(faltando, a)))
  );

  const narrativa = `# INTRODUÇÃO\n\nSegundo Silva (2020), o tema segue.\n\n${lista}`;
  checa("citação narrativa com entrada não acusa", (await ver(r11, narrativa)).length === 0);
  const narrativaErrada = `# INTRODUÇÃO\n\nSegundo Furtado (2019), o tema segue.\n\n${lista}`;
  checa("citação narrativa sem entrada acusa", (await ver(r11, narrativaErrada)).length === 1);

  const emCodigo = `# INTRODUÇÃO\n\nExemplo: \`(Furtado, 2019)\`.\n\n${lista}`;
  checa("citação dentro de código fica de fora (a máscara)", (await ver(r11, emCodigo)).length === 0);

  const repetida = `# INTRODUÇÃO\n\n(Furtado, 2019) aparece aqui, (Furtado, 2019) de novo e (Furtado, 2019) outra vez.\n\n${lista}`;
  const avisosRepetida = await ver(r11, repetida);
  checa(
    "citação repetida vira UM aviso, com o número de vezes",
    avisosRepetida.length === 1 && /3 vezes/.test(avisosRepetida[0]?.mensagem ?? ""),
    JSON.stringify(avisosRepetida)
  );

  const anoComLetra = "# REFERÊNCIAS\n\nSILVA, João. **A**. 2020a.\n";
  checa("letra de desambiguação não separa (2020a casa 2020)", (await ver(r11, `# INTRODUÇÃO\n\n(Silva, 2020a)\n\n${anoComLetra}`)).length === 0);

  const outroAno = "# REFERÊNCIAS\n\nSILVA, João. **A**. 2020.\n";
  checa("mesmo autor em outro ano NÃO casa (e acusa)", (await ver(r11, `# INTRODUÇÃO\n\n(Silva, 2019)\n\n${outroAno}`)).length === 1);

  const dentroDaLista = "# REFERÊNCIAS\n\nSILVA, João. **A**. 2020.\n\n(Costa, 2019)\n";
  checa("citação escrita dentro da lista não entra no cruzamento", (await ver(r11, dentroDaLista)).length === 0);
}

// ---------------------------------------------------------------- R12

console.log("\nR12 — destaque tipográfico uniforme");
{
  const misto = "# REFERÊNCIAS\n\nSILVA, João. **A obra**. São Paulo: Editora, 2020.\n\nSANTOS, Pedro. A outra obra. Editora, 2019.\n";
  const avisos = await ver(r12, misto);
  checa("acusa a mistura (uma entrada com destaque, outra sem)", avisos.length === 1, JSON.stringify(avisos));
  checa(
    "aponta para a entrada sem destaque e manda padronizar",
    recorte(misto, avisos[0]).startsWith("SANTOS") && /Padronize/.test(avisos[0]?.mensagem ?? ""),
    avisos[0]?.mensagem
  );

  const todosNegrito = "# REFERÊNCIAS\n\nSILVA, João. **A**. 2020.\n\nSANTOS, Pedro. **B**. 2019.\n";
  checa("todas com destaque não acusa", (await ver(r12, todosNegrito)).length === 0);

  const nenhum = "# REFERÊNCIAS\n\nSILVA, João. A. 2020.\n\nSANTOS, Pedro. B. 2019.\n";
  checa("nenhuma com destaque não acusa (a regra é a uniformidade)", (await ver(r12, nenhum)).length === 0);

  const itens = "# REFERÊNCIAS\n\n- SILVA, João. **A**. 2020.\n- SANTOS, Pedro. **B**. 2019.\n";
  checa("o asterisco do item de lista não conta como destaque", (await ver(r12, itens)).length === 0);

  const itensMistos = "# REFERÊNCIAS\n\n- SILVA, João. **A**. 2020.\n- SANTOS, Pedro. B. 2019.\n";
  checa("item sem destaque no meio de itens com destaque acusa", (await ver(r12, itensMistos)).length === 1);

  const latinismo = "# REFERÊNCIAS\n\nSILVA, João. **A**. 2020.\n\nSANTOS, Pedro. Capítulo. *In*: COSTA, Carlos. Obra. 2019.\n";
  const avisosLatinismo = await ver(r12, latinismo);
  checa(
    "latinismo em itálico (In) não é destaque do título — a entrada conta como sem",
    avisosLatinismo.length === 1 && recorte(latinismo, avisosLatinismo[0]).startsWith("SANTOS"),
    JSON.stringify(avisosLatinismo)
  );

  const semAno = "# REFERÊNCIAS\n\nSILVA, João. **A**. 2020.\n\nSANTOS, Pedro. B sem ano.\n";
  checa("entrada que não parece referência (sem ano nem s.d.) não entra na conta", (await ver(r12, semAno)).length === 0);
}

// ---------------------------------------------------------------- as quatro juntas

console.log("\nas quatro na mesma passada");
{
  const semLista = "# INTRODUÇÃO\n\n(Furtado, 2019) e (Silva, 2020).\n";
  const avisos = await rodar(semLista, [r01, r02, r11, r12]);
  checa(
    "sem lista: só a R01 fala (uma vez), não uma acusação por citação",
    avisos.length === 1 && /Falta a lista/.test(avisos[0].mensagem),
    JSON.stringify(avisos.map((a) => a.mensagem))
  );

  const comLista = "# INTRODUÇÃO\n\n(Furtado, 2019).\n\n# REFERÊNCIAS\n\nSILVA, João. **A**. 2020.\n";
  const avisos2 = await rodar(comLista, [r01, r02, r11, r12]);
  checa(
    "com lista: só o cruzamento fala (uma vez)",
    avisos2.length === 1 && /Citação sem referência/.test(avisos2[0].mensagem),
    JSON.stringify(avisos2.map((a) => a.mensagem))
  );
}

fim();
