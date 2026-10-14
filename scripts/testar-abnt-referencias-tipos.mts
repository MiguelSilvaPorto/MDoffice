// Teste das regras de FORMA por tipo de referência (NBR 6023:2025) — R03 a R10.
//
// Cada regra é conferida pelos DOIS lados: a entrada que acusa (exatamente um aviso,
// de conferência — sem `fix` e sem sugestão) e a entrada completa do mesmo tipo, que
// NÃO pode acusar. No fim, uma bibliografia com uma referência completa de cada tipo
// prova a precisão em conjunto, e os casos de fora do bloco / sem bloco provam o
// silêncio do escopo.
//
// Roda com: node scripts/testar-abnt-referencias-tipos.mts
import { checa, empacotar, fim, rodar } from "./abnt/ferramentas.mts";

const I = await empacotar("src/broker/abnt/index.ts");

// Só as oito deste trabalho: as regras da LISTA (R01, R02, R11, R12) são de outro
// arquivo e a precisão medida aqui não pode depender delas.
const IDS = ["abnt.r03", "abnt.r04", "abnt.r05", "abnt.r06", "abnt.r07", "abnt.r08", "abnt.r09", "abnt.r10"];

const cruas: any[] = I.carregarRegras();
const conhecidas = new Set(cruas.map((r) => r.id));
checa(
  "as oito regras R03–R10 estão registradas em FONTES",
  IDS.every((id) => conhecidas.has(id)),
  JSON.stringify([...conhecidas])
);

const regras = cruas.filter((r) => IDS.includes(r.id)).map((r) => I.regraDeToml(r));
checa("as oito viram regra (lint e verificador ok)", regras.length === 8, String(regras.length));

/** Documento com a entrada (ou entradas) dentro do bloco de referências. */
const emBloco = (entradas: string[]): string =>
  ["# REFERÊNCIAS", "", ...entradas.flatMap((e) => [e, ""])].join("\n");

const soMinhas = (texto: string) => rodar(texto, regras);

/** O caso que acusa: exatamente um aviso, do tipo certo, de conferência (sem troca). */
async function acusa(nome: string, entrada: string, trecho: string): Promise<void> {
  const avisos = await soMinhas(emBloco([entrada]));
  const um = avisos.length === 1;
  const certo = um && avisos[0].mensagem.includes(trecho) && avisos[0].mensagem.startsWith("[ABNT NBR 6023:2025]");
  const conferencia = um && avisos[0].fix === undefined && avisos[0].sugestoes.length === 0 && avisos[0].safe === false;
  checa(`acusa — ${nome}`, certo, JSON.stringify(avisos.map((a) => a.mensagem)));
  checa(`  conferência (sem correção conhecida) — ${nome}`, conferencia, JSON.stringify(avisos));
}

/** O caso correto: silêncio. */
async function limpa(nome: string, entrada: string): Promise<void> {
  const avisos = await soMinhas(emBloco([entrada]));
  checa(`não acusa — ${nome}`, avisos.length === 0, JSON.stringify(avisos.map((a) => a.mensagem)));
}

console.log("R03 — livro: sem local/editora");
await acusa("título + ano, sem dados de publicação (o exemplo do catálogo)", "Livro, 2020.", "sem local e editora");
await acusa("autor + título + ano", "GIL, Antonio Carlos. Como elaborar projetos de pesquisa. 2017.", "sem local e editora");
await limpa("livro completo", "GIL, Antonio Carlos. Como elaborar projetos de pesquisa. 6. ed. São Paulo: Atlas, 2017.");
await limpa("livro sem local e editora conhecidos ([S.l.: s.n.])", "SILVA, João. Título do livro. [S.l.: s.n.], 2020.");
await limpa("artigo (fascículo) não é julgado como livro", "SOUZA, Ana. Análise do discurso. Revista Brasileira de Linguística, v. 12, n. 3, p. 45-67, 2020.");

console.log("\nR04 — capítulo: sem “In:”");
await acusa(
  "páginas da parte, obra completa e nenhum “In:”",
  "SILVA, João. A educação superior. COSTA, Maria. Universidade e sociedade. São Paulo: Atlas, 2019. p. 15-30.",
  "sem “In:”"
);
await acusa(
  "segundo autor depois do ponto e nenhum “In:”",
  "SILVA, João. A educação superior. COSTA, Maria. Universidade e sociedade. São Paulo: Atlas, 2019.",
  "sem “In:”"
);
await limpa("capítulo com “In:”", "SILVA, João. A educação superior. In: COSTA, Maria (org.). Universidade e sociedade. 2. ed. São Paulo: Atlas, 2019. p. 15-30.");
await limpa("livro (sem rastro de parte) não é julgado como capítulo", "GIL, Antonio Carlos. Como elaborar projetos de pesquisa. 6. ed. São Paulo: Atlas, 2017.");

console.log("\nR05 — artigo: periódico + v./n./p.");
await acusa(
  "fascículo depois de ponto: falta o periódico",
  "SOUZA, Ana. Análise do discurso. v. 12, n. 3, p. 45-67, 2020.",
  "sem o título do periódico"
);
await acusa(
  "periódico e fascículo, sem páginas",
  "SOUZA, Ana. Análise do discurso. Revista Brasileira de Linguística, v. 12, n. 3, 2020.",
  "sem as páginas"
);
await limpa("artigo completo", "SOUZA, Ana. Análise do discurso. Revista Brasileira de Linguística, v. 12, n. 3, p. 45-67, 2020.");

console.log("\nR06 — site: Disponível em / Acesso em");
await acusa(
  "“Disponível em” sem “Acesso em”",
  "SILVA, João. Orientação a objetos. São Paulo: Érica, 2019. Disponível em: https://exemplo.com.",
  "sem “Acesso em”"
);
await acusa(
  "endereço sem os dois rótulos",
  "SILVA, João. Orientação a objetos. São Paulo: Érica, 2019. https://exemplo.com.",
  "sem os rótulos"
);
await acusa(
  "“Acessado em” no lugar de “Acesso em”",
  "SILVA, João. Orientação a objetos. São Paulo: Érica, 2019. Disponível em: https://exemplo.com. Acessado em: 10 maio 2022.",
  "não “Acessado em”"
);
await limpa(
  "referência online completa",
  "SILVA, João. Orientação a objetos. São Paulo: Érica, 2019. Disponível em: https://exemplo.com. Acesso em: 10 maio 2022."
);

console.log("\nR07 — lei: órgão emissor");
await acusa(
  "a entrada começa pelo tipo",
  "Lei n. 8.112, de 11 de dezembro de 1990. Dispõe sobre o regime jurídico dos servidores públicos civis. Diário Oficial da União: seção 1, Brasília, p. 23942, 12 dez. 1990.",
  "sem o órgão emissor"
);
await acusa("portaria sem o órgão", "Portaria n. 1.234, de 2 de janeiro de 2020. Define procedimentos internos.", "sem o órgão emissor");
await limpa(
  "lei com o órgão na frente",
  "BRASIL. Lei n. 8.112, de 11 de dezembro de 1990. Dispõe sobre o regime jurídico dos servidores públicos civis. Diário Oficial da União: seção 1, Brasília, p. 23942, 12 dez. 1990."
);

console.log("\nR08 — tese/dissertação: instituição e ano");
await acusa(
  "tipo sem instituição",
  "RODRIGUES, Paulo. Redes neurais aplicadas à educação. 2021. Tese (Doutorado em Educação).",
  "sem a instituição"
);
await acusa(
  "instituição presente, ano ausente",
  "RODRIGUES, Paulo. Redes neurais aplicadas à educação. Tese (Doutorado em Educação) – Universidade Federal de Pernambuco, Recife.",
  "sem o ano"
);
await limpa(
  "tese completa",
  "RODRIGUES, Paulo. Redes neurais aplicadas à educação. 2021. Tese (Doutorado em Educação) – Universidade Federal de Pernambuco, Recife, 2021."
);
await limpa(
  "TCC com a instituição por sigla",
  "SILVA, João. Título do trabalho. Trabalho de Conclusão de Curso (Graduação em Sistemas) – UFPE, Recife, 2019."
);

console.log("\nR09 — evento: ano");
await acusa(
  "“In:” + Anais sem ano",
  "SOARES, Lima. Ensino de ciências. In: CONGRESSO BRASILEIRO DE ENSINO DE CIÊNCIAS, 10., São Paulo. Anais eletrônicos [...]. São Paulo: ABENGE.",
  "sem o ano"
);
await limpa(
  "trabalho em evento completo",
  "SOARES, Lima. Ensino de ciências. In: CONGRESSO BRASILEIRO DE ENSINO DE CIÊNCIAS, 10., 2020, São Paulo. Anais eletrônicos [...]. São Paulo: ABENGE, 2020."
);
await limpa(
  "capítulo com “In:” (sem Anais) não é julgado como evento",
  "SILVA, João. A educação superior. In: COSTA, Maria (org.). Universidade e sociedade. São Paulo: Atlas, 2019. p. 15-30."
);

console.log("\nR10 — patente: número do registro");
await acusa(
  "campos de patente sem número",
  "TELES, Marcos. Processo de fabricação de papel reciclado. Depositante: Papel S.A. Classificação internacional de patentes: D21H 11/14. Depósito: 13 out. 2006.",
  "sem o número do registro"
);
await limpa(
  "patente completa",
  "TELES, Marcos. Processo de fabricação de papel reciclado. Depositante: Papel S.A. Classificação internacional de patentes: D21H 11/14. N. do registro: PI 0604759-3. Depósito: 13 out. 2006."
);
await limpa(
  "livro com “patentes” no título não é julgado como patente",
  "SILVA, João. Patentes e inovação. São Paulo: Atlas, 2019."
);

console.log("\nconjunto e escopo");
{
  const completas = [
    "GIL, Antonio Carlos. Como elaborar projetos de pesquisa. 6. ed. São Paulo: Atlas, 2017.",
    "SILVA, João. A educação superior. In: COSTA, Maria (org.). Universidade e sociedade. 2. ed. São Paulo: Atlas, 2019. p. 15-30.",
    "SOUZA, Ana. Análise do discurso. Revista Brasileira de Linguística, v. 12, n. 3, p. 45-67, 2020.",
    "INSTITUTO BRASILEIRO DE GEOGRAFIA E ESTATÍSTICA. Censo demográfico 2010. Rio de Janeiro: IBGE, 2011. Disponível em: https://www.ibge.gov.br. Acesso em: 10 maio 2022.",
    "BRASIL. Lei n. 8.112, de 11 de dezembro de 1990. Dispõe sobre o regime jurídico dos servidores públicos civis. Diário Oficial da União: seção 1, Brasília, p. 23942, 12 dez. 1990.",
    "RODRIGUES, Paulo. Redes neurais aplicadas à educação. 2021. Tese (Doutorado em Educação) – Universidade Federal de Pernambuco, Recife, 2021.",
    "SOARES, Lima. Ensino de ciências. In: CONGRESSO BRASILEIRO DE ENSINO DE CIÊNCIAS, 10., 2020, São Paulo. Anais eletrônicos [...]. São Paulo: ABENGE, 2020.",
    "TELES, Marcos. Processo de fabricação de papel reciclado. Depositante: Papel S.A. Classificação internacional de patentes: D21H 11/14. N. do registro: PI 0604759-3. Depósito: 13 out. 2006.",
  ];
  const avisos = await soMinhas(emBloco(completas));
  checa(
    "bibliografia completa (um de cada tipo) não acusa",
    avisos.length === 0,
    JSON.stringify(avisos.map((a) => a.mensagem))
  );

  const colado = await soMinhas("# REFERÊNCIAS\nGIL, Antonio Carlos. Como elaborar projetos de pesquisa. 2017.");
  checa(
    "entrada colada no título da seção (sem linha vazia) é julgada",
    colado.length === 1 && colado[0].mensagem.includes("sem local e editora"),
    JSON.stringify(colado.map((a) => a.mensagem))
  );
}

{
  // Fora do bloco: uma introdução com a mesma forma dos avisos fica em silêncio.
  const comIntro = await soMinhas(
    [
      "# INTRODUÇÃO",
      "",
      "Lei n. 8.112, de 11 de dezembro de 1990, é citada no corpo.",
      "",
      "# REFERÊNCIAS",
      "",
      "BRASIL. Lei n. 8.112, de 11 de dezembro de 1990. Dispõe sobre o regime jurídico dos servidores públicos civis. Diário Oficial da União: seção 1, Brasília, p. 23942, 12 dez. 1990.",
    ].join("\n")
  );
  checa("entrada fora do bloco não é julgada", comIntro.length === 0, JSON.stringify(comIntro.map((a) => a.mensagem)));

  const semBloco = await soMinhas(
    ["# INTRODUÇÃO", "", "SILVA, João. Título. 2017.", "", "Lei n. 8.112, de 11 de dezembro de 1990."].join("\n")
  );
  checa("documento sem o bloco é silêncio", semBloco.length === 0, JSON.stringify(semBloco.map((a) => a.mensagem)));
}

fim();
