// Teste das regras de CITAÇÕES (C01, C03, C04 e C06) — NBR 10520:2023.
//
// Cada regra é testada pelos DOIS lados: o caso que acusa e o caso que NÃO pode
// acusar. Os "não acusa" incluem os falsos positivos clássicos de parêntese
// ((Anexo), (Brasil), leis, siglas) e os limites conhecidos de cada regra, para
// nenhum deles virar surpresa. O corpus (node scripts/testar-correcoes.mts) é a
// rede extra: nenhuma destas regras pode mexer nos 34 textos corretos.
//
// Uso: node scripts/testar-abnt-citacoes.mts

import { checa, empacotar, fim, rodar, verificar } from "./abnt/ferramentas.mts";

const I = await empacotar("src/broker/abnt/index.ts");

const IDS = ["abnt.c01", "abnt.c03", "abnt.c04", "abnt.c06"];
const cruas = (I.carregarRegras() as any[]).filter((r) => IDS.includes(r.id));
const minhas = cruas.map((r) => I.regraDeToml(r));
const so = (id: string) => [I.regraDeToml(cruas.find((r) => r.id === id))];

/** O aviso único de uma regra sobre um texto (ou o vazio, quando não acusa). */
async function conta(texto: string, id: string) {
  const avisos = await rodar(texto, so(id));
  const a = avisos[0];
  return {
    quantos: avisos.length,
    trecho: a ? texto.slice(a.from, a.to) : "",
    fix: a?.fix,
    sugestoes: a?.sugestoes ?? [],
    mensagem: a?.mensagem ?? "",
  };
}

const naoAcusa = async (id: string, textos: string[]) => {
  for (const texto of textos) {
    const r = await conta(texto, id);
    checa(`${id} não acusa ${JSON.stringify(texto)}`, r.quantos === 0, JSON.stringify(r));
  }
};

console.log("carga e declaração");
{
  checa("C01, C03, C04 e C06 carregam pelos ids do catálogo", cruas.length === IDS.length, JSON.stringify(cruas.map((r) => r.id)));
  checa(
    "C04 é tipo estrutura; C01, C03 e C06 são regras de texto",
    cruas.find((r) => r.id === "abnt.c04")?.tipo === "estrutura" &&
      cruas.filter((r) => r.id !== "abnt.c04").every((r) => (r.tipo ?? "texto") === "texto"),
    JSON.stringify(cruas.map((r) => [r.id, r.tipo, r.verifica]))
  );
  checa("todas citam a NBR 10520:2023", cruas.every((r) => r.norma === "nbr10520:2023"));
}

console.log("\nC01 — citação autor-data sem o ano");
{
  const um = await conta("Segundo o autor (Silva), a educação transforma.", "abnt.c01");
  checa("acusa “(Silva)”", um.quantos === 1 && um.trecho === "(Silva)", JSON.stringify(um));
  checa("não sugere troca — o ano é desconhecido", um.fix === undefined && um.sugestoes.length === 0, JSON.stringify(um));
  checa("a mensagem manda acrescentar o ano", um.mensagem.includes("sem o ano") && um.mensagem.includes("acrescente o ano"), um.mensagem);

  for (const [texto, trecho] of [
    ["Os dados vêm de (Silva e Santos), que mediram tudo.", "(Silva e Santos)"],
    ["Os estudos (Oliveira; Costa) divergem.", "(Oliveira; Costa)"],
    ["A pesquisa (Furtado et al.) aponta isso.", "(Furtado et al.)"],
    ["Os autores (Silveira & Melo) concluíram.", "(Silveira & Melo)"],
  ] as const) {
    const r = await conta(texto, "abnt.c01");
    checa(`acusa ${JSON.stringify(trecho)}`, r.quantos === 1 && r.trecho === trecho, JSON.stringify(r));
  }

  await naoAcusa("abnt.c01", [
    "(Anexo)",
    "(Brasil)",
    "A lei (Lei nº 8.112) rege o servidor.",
    "(IBGE) divulga os dados.",
    "(Tabela 1)",
    "(Anexo III)",
    "(Ministério da Educação)",
    "(SILVA)",
    "(silva)",
    "(Silva, 2020)",
    "(Silva, 2020, p. 15)",
    "(Silva Costa)",
    "(cf. Silva)",
    "A chamada `f(Silva)` está no código.",
  ]);
}

console.log("\nC03 — citação direta sem a página");
{
  const um = await conta('Ele escreveu que "a educação transforma" (Silva, 2020) e concluiu.', "abnt.c03");
  checa("acusa aspas seguidas de (Silva, 2020)", um.quantos === 1 && um.trecho === "(Silva, 2020)", JSON.stringify(um));
  checa("não sugere troca — a página é desconhecida", um.fix === undefined && um.sugestoes.length === 0, JSON.stringify(um));

  for (const [texto, trecho] of [
    ["“a educação transforma” (Silva, 2020).", "(Silva, 2020)"],
    ['"texto" (Silva e Santos, 2019)', "(Silva e Santos, 2019)"],
    ['"texto" (Silva et al., 2021)', "(Silva et al., 2021)"],
    ['"texto" (SILVA, 2020)', "(SILVA, 2020)"],
    ['"texto" (IBGE, 2021)', "(IBGE, 2021)"],
    ['"texto" (Silva, 2020a)', "(Silva, 2020a)"],
  ] as const) {
    const r = await conta(texto, "abnt.c03");
    checa(`acusa ${JSON.stringify(trecho)}`, r.quantos === 1 && r.trecho === trecho, JSON.stringify(r));
  }

  // Limite conhecido e assumido: um título entre aspas seguido de citação tem o
  // mesmo formato de uma citação direta — acusa, e quem confirma é quem escreve.
  const titulo = await conta('O romance "Dom Casmurro" (Assis, 1899) é realista.', "abnt.c03");
  checa("título entre aspas tem o formato de citação (limite documentado)", titulo.quantos === 1, JSON.stringify(titulo));

  await naoAcusa("abnt.c03", [
    'Aspas sem "página" (Silva, 2020, p. 15) estão certas.',
    "A educação transforma (Silva, 2020).",
    '"texto" (Silva)',
    '"texto" (Silva, 2020; Santos, 2019)',
    'termina com "aspas" (autor desconhecido, 2020)',
    'O código `("texto" (Silva, 2020))` fica fora da máscara.',
  ]);
}

console.log("\nC06 — ponto final depois do parêntese");
{
  const texto = 'Ele afirmou: "a educação é a base." (Silva, 2020).';
  const avisos = await rodar(texto, so("abnt.c06"));
  const a = avisos[0];
  checa("acusa o ponto duplicado (aspas retas)", avisos.length === 1 && texto.slice(a.from, a.to) === '."', JSON.stringify(avisos));
  checa("a correção tira o ponto de dentro das aspas", a?.fix === '"', JSON.stringify(a));
  const corrigido = texto.slice(0, a.from) + a.fix + texto.slice(a.to);
  checa(
    "o texto corrigido fica com um ponto só, depois do parêntese",
    corrigido === 'Ele afirmou: "a educação é a base" (Silva, 2020).',
    corrigido
  );

  const curvo = await conta("“destacou a importância.” (Silva, 2020, p. 15).", "abnt.c06");
  checa("acusa também com aspas curvas e página", curvo.quantos === 1 && curvo.trecho === ".”" && curvo.fix === "”", JSON.stringify(curvo));

  const pag = await conta("“o fim.” (Silva, 2020, pág. 15).", "abnt.c06");
  checa("aceita “pág.” no meio da citação", pag.quantos === 1 && pag.fix === "”", JSON.stringify(pag));

  await naoAcusa("abnt.c06", [
    '"a educação é a base" (Silva, 2020).',
    "“a educação é a base.” (Silva, 2020) mudou tudo.",
    "O termo “palavra.” (Glossário).",
    "“o fim.” (Silva, 2020; Santos, 2019).",
  ]);
}

console.log("\nC04 — citação direta longa em bloco");
{
  const blocoComAspas = [
    "# Introdução",
    "",
    "> “A educação é a base de tudo,",
    "> ela transforma a sociedade",
    "> e permite o desenvolvimento",
    "> de cada pessoa” (Silva, 2020, p. 15).",
    "",
    "Fim.",
  ].join("\n");

  const r = await conta(blocoComAspas, "abnt.c04");
  checa("acusa o bloco longo começando com aspas", r.quantos === 1 && r.mensagem.includes("não leva aspas"), JSON.stringify(r));
  checa("o aviso cobre a citação (da aspa de abertura ao fecho)", r.trecho.startsWith("“") && r.trecho.endsWith("”"), JSON.stringify(r.trecho));

  const blocoCerto = [
    "> A educação é a base de tudo,",
    "> ela transforma a sociedade",
    "> e permite o desenvolvimento",
    "> de cada pessoa (Silva, 2020, p. 15).",
  ].join("\n");
  checa("não acusa o bloco longo já sem aspas", (await conta(blocoCerto, "abnt.c04")).quantos === 0);

  const corrido = [
    "O autor destacou:",
    "",
    "“A educação é a base de tudo,",
    "ela transforma a sociedade",
    "e permite o desenvolvimento",
    "de cada pessoa.”",
    "",
    "Depois, concluiu.",
  ].join("\n");
  const rc = await conta(corrido, "abnt.c04");
  checa(
    "acusa a citação longa em texto corrido (deve virar bloco)",
    rc.quantos === 1 && rc.mensagem.includes("texto corrido") && rc.trecho.startsWith("“"),
    JSON.stringify(rc)
  );

  const curto = await conta('Ele disse "a educação transforma" e saiu.', "abnt.c04");
  checa("não acusa citação curta entre aspas", curto.quantos === 0, JSON.stringify(curto));

  const blocoCurto = ["> “linha um,", "> linha dois,", "> linha três” (Silva, 2020)."].join("\n");
  checa("não acusa bloco de 3 linhas (no limite, ainda é curta)", (await conta(blocoCurto, "abnt.c04")).quantos === 0);

  const aspaCurtaNoBloco = [
    "> Segundo Silva (2020, p. 15), “a educação",
    "> transforma a sociedade” e permite",
    "> o desenvolvimento de todos,",
    "> sempre com base em evidências.",
  ].join("\n");
  checa("não acusa bloco longo cuja aspa não abre o bloco", (await conta(aspaCurtaNoBloco, "abnt.c04")).quantos === 0);

  const codigo = ["```markdown", "> “A educação é a base de tudo,", "> ela transforma a sociedade", "> e permite o desenvolvimento", "> de cada pessoa”", "```"].join("\n");
  checa("não acusa dentro de cerca de código", (await conta(codigo, "abnt.c04")).quantos === 0);

  const semFecho = ["> “A educação é a base de tudo,", "> ela transforma a sociedade", "> e permite o desenvolvimento", "> de cada pessoa (Silva, 2020)."].join("\n");
  checa("aspa sem par não é julgada", (await conta(semFecho, "abnt.c04")).quantos === 0);

  const dois = await verificar("citacao-direta-longa", blocoCurto, { limite: 2 });
  checa("o limite vem do TOML (opcoes.limite)", dois.length === 1, JSON.stringify(dois));
}

console.log("\nintegração — as quatro juntas");
{
  const dois = await rodar('Ele afirmou: "a educação é a base." (Silva, 2020).', minhas);
  checa("pontuação duplicada e página faltante acusam juntas (2 avisos)", dois.length === 2, JSON.stringify(dois.map((a) => a.mensagem)));

  const um = await rodar("Segundo o autor (Silva) e depois (Silva, 2020).", minhas);
  checa("só o parêntese sem ano acusa quando o outro tem ano", um.length === 1, JSON.stringify(um.map((a) => a.mensagem)));

  const correto = [
    "Segundo Silva (2020, p. 15), a educação transforma a sociedade.",
    "",
    "> A educação é a base de tudo,",
    "> ela transforma a sociedade,",
    "> e permite o desenvolvimento",
    "> de cada pessoa (Silva, 2020, p. 15).",
  ].join("\n");
  checa("nenhuma das quatro acusa um trecho correto", (await rodar(correto, minhas)).length === 0);
}

fim();
