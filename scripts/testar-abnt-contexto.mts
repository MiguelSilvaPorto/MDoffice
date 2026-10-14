// Teste da BASE nova do motor ABNT: escopo de bloco, verificadores e o modelo do
// documento. São as peças que as regras dos grupos E/C/R/S/A/P/T usam — e é aqui que
// elas são conferidas antes de qualquer regra nova depender delas.

import { checa, documento, empacotar, fim, rodar } from "./abnt/ferramentas.mts";

const I = await empacotar("src/broker/abnt/index.ts");

const recusa = (toml: string): boolean => {
  try {
    I.carregarRegras([{ nome: "teste.toml", texto: toml }]);
    return false;
  } catch {
    return true;
  }
};

const soDaUma = (toml: string): any => I.carregarRegras([{ nome: "teste.toml", texto: toml }])[0];

const BASE = `
id = "teste.simples"
norma = "teste"
grupo = "T"
severidade = "warning"
regex = '(?<trecho>AVISO)'
trecho = "trecho"
mensagem = "achou um aviso"
`;

const TEXTO = [
  "# Capa",
  "",
  "AVISO aqui",
  "",
  "# 3.2 Referências Bibliográficas",
  "",
  "AVISO aqui",
  "",
  "# Referencial teórico",
  "",
  "AVISO aqui",
].join("\n");

console.log("escopo de bloco");
{
  const simples = soDaUma(BASE);
  const bloco = soDaUma(`${BASE}\nescopo = "bloco"\ncontexto = { blocos = ["referencias"] }\n`);

  const todos = await rodar(TEXTO, [I.regraDeToml(simples)]);
  checa("sem escopo, acusa nos três lugares", todos.length === 3, String(todos.length));

  const soBloco = await rodar(TEXTO, [I.regraDeToml(bloco)]);
  const esperado = TEXTO.indexOf("AVISO", TEXTO.indexOf("Referências"));
  checa(
    "com escopo de bloco, acusa só dentro da seção de referências",
    soBloco.length === 1 && soBloco[0].from === esperado,
    JSON.stringify(soBloco.map((a) => a.from)) + ` (esperado ${esperado})`
  );

  const semBloco = await rodar("# Capa\n\nAVISO aqui", [I.regraDeToml(bloco)]);
  checa("bloco que não existe no documento é silêncio", semBloco.length === 0, JSON.stringify(semBloco));

  checa('escopo "bloco" sem contexto é recusado', recusa(`${BASE}\nescopo = "bloco"\n`));
  checa(
    "bloco desconhecido é recusado",
    recusa(`${BASE}\nescopo = "bloco"\ncontexto = { blocos = ["introducao"] }\n`)
  );
  checa("contexto sem escopo de bloco é recusado", recusa(`${BASE}\ncontexto = { blocos = ["referencias"] }\n`));
}

console.log("\nregra de aviso (sem correção conhecida)");
{
  const aviso = soDaUma(BASE.replace('mensagem = "achou um aviso"', 'mensagem = "achou um aviso — complete os dados"'));
  const saida = await rodar("AVISO", [I.regraDeToml(aviso)]);
  checa(
    "acusa sem `substituir`, e sem sugerir troca",
    saida.length === 1 && saida[0].fix === undefined && saida[0].sugestoes.length === 0,
    JSON.stringify(saida)
  );
}

console.log("\nverificador");
{
  const declaracao = {
    id: "teste.estrutura",
    norma: "teste",
    grupo: "T",
    severidade: "warning",
    tipo: "estrutura",
    verifica: "de-mentira",
    opcoes: { quantos: 1 },
  };
  const registro = {
    "de-mentira": (doc: any, regra: any) => [
      { from: regra.opcoes.quantos, to: regra.opcoes.quantos + 4, mensagem: "veio do verificador" },
      { from: 9999, to: 10050, mensagem: "faixa fora do texto" },
    ],
  };
  const avisos = await rodar("0123456789", [I.regraDeToml(declaracao as any, registro)]);
  checa(
    "o aviso do verificador sai como aviso do motor",
    avisos.length === 2 && avisos[0].mensagem === "veio do verificador" && avisos[0].from === 1,
    JSON.stringify(avisos)
  );
  checa(
    "faixa fora do texto é recortada (não vira span inválido)",
    avisos[1].from === 10 && avisos[1].to === 10,
    JSON.stringify(avisos[1])
  );

  let falhou = false;
  try {
    I.regraDeToml({ ...declaracao, verifica: "nao-existe" } as any, registro);
  } catch {
    falhou = true;
  }
  checa("verificador desconhecido recusa na conversão", falhou);

  const TOML_ESTRUTURA = `
id = "teste.estrutura-toml"
norma = "teste"
grupo = "T"
severidade = "warning"
tipo = "estrutura"
verifica = "secoes-obrigatorias"
opcoes = { obrigatorias = ["RESUMO", "REFERÊNCIAS"] }
`;
  checa("regra de estrutura carrega pelo lint", !recusa(TOML_ESTRUTURA));
  checa("regra de estrutura sem `verifica` é recusada", recusa(TOML_ESTRUTURA.replace(/verifica = .*\n/, "")));
  checa(
    "regra de estrutura com `regex` é recusada (campo morto mente)",
    recusa(`${TOML_ESTRUTURA}\nregex = '(?<trecho>x)'\ntrecho = "trecho"\n`)
  );
}

console.log("\nmodelo do documento");
{
  const doc = await documento("# 3.2 Referências Bibliográficas\n\nSILVA, João. **Livro**. 2020.\n\n# Referencial teórico\n\ntexto");
  checa("título com numeração casa com o bloco", (doc.blocos.referencias ?? []).length === 1);
  checa(
    "«Referencial teórico» NÃO casa com referências (a comparação é palavra inteira)",
    doc.blocos.referencias.length === 1,
    JSON.stringify(Object.keys(doc.blocos))
  );
  checa("a faixa do bloco começa no título e vai até o próximo título de mesmo nível", (() => {
    const r = doc.regioesDeBlocos(["referencias"]);
    return r.length === 1 && r[0].from === 0 && r[0].to === doc.secoes[1].from;
  })());

  const outros = await documento("# RESUMO\n\nPalavras-chave: uma.\n\n# Abstract\n\ntext.\n\n# Lista de Ilustrações\n\nFigura 1 — x");
  checa("RESUMO, Abstract e Lista de Ilustrações são reconhecidos", Boolean(outros.blocos.resumo?.length && outros.blocos.abstract?.length && outros.blocos["lista-de-figuras"]?.length), JSON.stringify(Object.keys(outros.blocos)));
  checa("o título guarda onde começa e termina o texto do título", (() => {
    const s = outros.secoes[0];
    return outros.texto.slice(s.tituloFrom, s.tituloTo) === "RESUMO";
  })());
  checa("parágrafos são linhas consecutivas não vazias", doc.paragrafos.length === 4, String(doc.paragrafos.length));

  const crlf = await documento("# Capa\r\n\r\nAVISO");
  checa("o \\r do CRLF fica fora da faixa da linha", crlf.linhas[0].to === "# Capa".length, String(crlf.linhas[0].to));
  checa("a âncora do fim aponta para a última linha com conteúdo", (() => {
    const f = I.ancoraNoFim(crlf);
    return crlf.texto.slice(f.from, f.to) === "AVISO";
  })());

  const semTitulo = await documento("só texto, sem título nenhum");
  checa("documento sem título não tem bloco", Object.keys(semTitulo.blocos).length === 0);
}

fim();
