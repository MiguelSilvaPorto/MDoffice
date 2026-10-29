// Teste do motor de planilhas fora do app: verifica o avaliador de fórmulas,
// o cálculo de datas e a ida-e-volta do .xlsx (exportar -> ler de volta).
//
// Rode com:  node scripts/testar-excel.mjs
//
// O teste NÃO abre o Excel: ele grava um .xlsx de verdade e confere se o
// próprio leitor do motor recupera exatamente o que foi colocado.

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { register } from "node:module";
import { pathToFileURL } from "node:url";

const raiz = process.cwd();
const temporario = join(raiz, "temp");

let passou = 0;
let falhou = 0;

function ok(nome, condicao, detalhe = "") {
  if (condicao) {
    passou++;
    console.log(`  ok   ${nome}`);
  } else {
    falhou++;
    console.log(`  FALHA ${nome}${detalhe ? ` — ${detalhe}` : ""}`);
  }
}

function igual(nome, obtido, esperado) {
  const a = JSON.stringify(obtido);
  const b = JSON.stringify(esperado);
  ok(nome, a === b, `obtido ${a}, esperado ${b}`);
}

// O código do motor é TypeScript: compila para uma pasta temporária e importa.
console.log("Compilando o motor para testar…");
const { execFileSync } = await import("node:child_process");
const saidaJs = join(temporario, "excel-teste-js");
mkdirSync(saidaJs, { recursive: true });
execFileSync(
  process.execPath,
  [
    join(raiz, "node_modules", "typescript", "bin", "tsc"),
    "--outDir", saidaJs,
    "--module", "esnext",
    "--moduleResolution", "bundler",
    "--target", "es2022",
    "--lib", "es2022,dom,dom.iterable",
    "--skipLibCheck",
    "--noEmit", "false",
    "--strict",
    "--rootDir", join(raiz, "src", "excel"),
    "--esModuleInterop",
    join(raiz, "src", "excel", "formula.ts"),
    join(raiz, "src", "excel", "values.ts"),
    join(raiz, "src", "excel", "refs.ts"),
    join(raiz, "src", "excel", "model.ts"),
    join(raiz, "src", "excel", "xlsxexport", "index.ts"),
    join(raiz, "src", "excel", "xlsximport", "index.ts"),
  ],
  { stdio: "inherit", cwd: raiz }
);

// os arquivos compilados precisam de .js nas importações do TypeScript
const fs = await import("node:fs");
function ajustarExtensoes(diretorio) {
  for (const entrada of fs.readdirSync(diretorio, { withFileTypes: true })) {
    const caminho = join(diretorio, entrada.name);
    if (entrada.isDirectory()) {
      ajustarExtensoes(caminho);
      continue;
    }
    if (!entrada.name.endsWith(".js")) continue;
    let texto = fs.readFileSync(caminho, "utf8");
    texto = texto.replace(/from\s+"(\.[^"]*?)"/g, (m, alvo) =>
      alvo.endsWith(".js") ? m : `from "${alvo}.js"`
    );
    fs.writeFileSync(caminho, texto);
  }
}
ajustarExtensoes(saidaJs);

const mod = async (caminho) => import(pathToFileURL(join(saidaJs, caminho)).href);
const { calcular } = await mod("formula.js");
const { dataParaSerial, serialParaData, numeroDe, dataDe, formatarNumero, numeroDoXml } = await mod("values.js");
const { nomeColuna, indiceColuna, partes, ref, intervalo, somaLarguras, somaAlturas, indiceEm } = await mod("refs.js");
const { novaFolha, livroDeExemplo } = await mod("model.js");
const { livroParaXlsx } = await mod("xlsxexport/index.js");
const { xlsxParaLivro } = await mod("xlsximport/index.js");

// ------------------------------------------------------------------
console.log("\nReferências A1");
igual("nomeColuna(0)", nomeColuna(0), "A");
igual("nomeColuna(25)", nomeColuna(25), "Z");
igual("nomeColuna(26)", nomeColuna(26), "AA");
igual("nomeColuna(27)", nomeColuna(27), "AB");
igual("nomeColuna(51)", nomeColuna(51), "AZ");
igual("nomeColuna(701)", nomeColuna(701), "ZZ");
igual("nomeColuna(702)", nomeColuna(702), "AAA");
igual("indiceColuna('A')", indiceColuna("A"), 0);
igual("indiceColuna('AA')", indiceColuna("AA"), 26);
igual("indiceColuna('ZZ')", indiceColuna("ZZ"), 701);
igual("partes('B4')", partes("B4"), { linha: 3, col: 1 });
igual("partes('$B$4')", partes("$B$4"), null);
igual("ref(3,1)", ref(3, 1), "B4");
igual("intervalo('C2:E9')", intervalo("C2:E9"), { l1: 1, c1: 2, l2: 8, c2: 4 });
igual("intervalo normalizado", intervalo("E9:C2"), { l1: 1, c1: 2, l2: 8, c2: 4 });

// ------------------------------------------------------------------
console.log("\nMedidas da grade (base da grade \"infinita\")");
// a soma é esparsa: as medidas personalizadas entram como diferença do padrão
igual("somaLarguras com personalizada", somaLarguras({ 2: 200 }, 9, 104), 10 * 104 + (200 - 104));
igual("somaLarguras além do ajuste", somaLarguras({ 2: 200 }, 10, 104), 11 * 104 + (200 - 104));
igual("somaAlturas com personalizada", somaAlturas({ 0: 60 }, 2, 25), 60 + 25 + 25);
igual("somaAlturas até -1", somaAlturas({}, -1, 25), 0);
// indiceEm: busca a linha/coluna que contém a posição
igual("indiceEm na coluna 0", indiceEm({}, 0, 104, 60), 0);
igual("indiceEm na coluna 2", indiceEm({}, 250, 104, 60), 2);
igual("indiceEm com coluna larga", indiceEm({ 1: 400 }, 500, 104, 60), 1);
igual("indiceEm além do fim satura no último", indiceEm({}, 999999, 104, 60), 59);
igual("indiceEm negativo", indiceEm({}, -50, 104, 60), 0);

// ------------------------------------------------------------------
console.log("\nValores: número, data e formatação");
igual("1.234,56", numeroDe("1.234,56"), 1234.56);
igual("1234.56", numeroDe("1234.56"), 1234.56);
igual("1.234 (milhar)", numeroDe("1.234"), 1234);
igual("-12,5", numeroDe("-12,5"), -12.5);
igual("texto vira null", numeroDe("casa"), null);
igual("vazio vira null", numeroDe(""), null);
igual("R$ 1.234,56", numeroDe("R$ 1.234,56"), 1234.56);
igual("15% vira 0,15", numeroDe("15%"), 15);

ok("dataDe 01/01/2026", dataDe("01/01/2026") instanceof Date);
igual("serial de 01/01/2026", dataParaSerial(new Date(Date.UTC(2026, 0, 1))), 46023);
igual("serial de volta", serialParaData(46023).toISOString().slice(0, 10), "2026-01-01");
igual("formata moeda", formatarNumero(1234.5, "moeda", 2, "R$"), "R$ 1.234,50");
igual("formata porcento", formatarNumero(0.15, "porcento", 0, "R$"), "15%");
igual("formata decimal", formatarNumero(1234.5, "decimal", 2, "R$"), "1.234,50");

// ------------------------------------------------------------------
console.log("\nValores: texto com dígitos, datas e números do XML");
igual("texto com número continua texto", numeroDe("Item 1"), null);
igual("data não é número", numeroDe("01/01/2026"), null);
igual("hora não é número", numeroDe("10:30"), null);
igual("fração não é número", numeroDe("1/2"), null);
igual("0.125 é decimal", numeroDe("0.125"), 0.125);
igual("1.234 é milhar", numeroDe("1.234"), 1234);
igual("1.234,56 é mil duzentos e trinta e quatro", numeroDe("1.234,56"), 1234.56);
igual("(100) é -100", numeroDe("(100)"), -100);
igual("15% é 15 (o chamador divide)", numeroDe("15%"), 15);
igual("R$ 10,50", numeroDe("R$ 10,50"), 10.5);
igual("-R$ 10", numeroDe("-R$ 10"), -10);
igual("1.234.567,89", numeroDe("1.234.567,89"), 1234567.89);
igual("número do XML 0.125", numeroDoXml("0.125"), "0,125");
igual("número do XML 1.234", numeroDoXml("1.234"), "1,234");
igual("data com hora vira fração do dia", dataParaSerial(dataDe("01/01/2026 12:00")), 46023.5);
igual("XFE1 está fora do limite do Excel", partes("XFE1"), null);

// ------------------------------------------------------------------
console.log("\nFórmulas");

/** Contexto com uma lista de valores por referência. */
function contexto(dados) {
  const valorDe = (alvo) => {
    if (dados[alvo] !== undefined) return dados[alvo];
    if (dados[alvo]?.formula) return null;
    return null;
  };
  const faixaAlvo = (alvo) => {
    const saida = [];
    for (let l = alvo.l1; l <= alvo.l2; l++) {
      for (let c = alvo.c1; c <= alvo.c2; c++) {
        const chave = `${String.fromCharCode(65 + c)}${l + 1}`;
        saida.push(valorDe(chave));
      }
    }
    return saida;
  };
  return { valorDe, faixaAlvo };
}

const ctx = contexto({ A1: 10, A2: 20, A3: 30, B1: 2, B2: 3, B3: 4 });
igual("soma simples", calcular("=A1+A2", ctx), 30);
igual("precedência * antes de +", calcular("=A1+B1*2", ctx), 14);
igual("parênteses", calcular("=(A1+B1)*2", ctx), 24);
igual("divisão", calcular("=A3/B3", ctx), 7.5);
igual("divisão por zero", String(calcular("=A1/0", ctx)), "#DIV/0!");
igual("potência", calcular("=2^10", ctx), 1024);
igual("porcentagem", calcular("=50%", ctx), 0.5);
igual("unário negativo", calcular("=-A1", ctx), -10);
igual("comparação", calcular("=A1>5", ctx), true);
igual("comparação falsa", calcular("=A1>50", ctx), false);
igual("texto <> texto", calcular('="abc"<>"abd"', ctx), true);
igual("igualdade sem diferenciar", calcular('="abc"="ABC"', ctx), true);
igual("concatenar", calcular('="Total: "&A1', ctx), "Total: 10");
igual("SOMA de faixa", calcular("=SOMA(A1:A3)", ctx), 60);
igual("MÉDIA de faixa", calcular("=MÉDIA(A1:A3)", ctx), 20);
igual("MÍNIMO", calcular("=MÍN(A1:A3)", ctx), 10);
igual("MÁXIMO", calcular("=MÁX(A1:A3)", ctx), 30);
igual("CONT.NÚM", calcular("=CONT.NÚM(A1:A3)", ctx), 3);
igual("PROD", calcular("=PROD(A1:A3)", ctx), 6000);
igual("MED", calcular("=MED(A1:A3)", ctx), 20);
igual("DESVPAD amostra", Math.round(calcular("=DESVPAD(A1:A3)", ctx) * 1e6) / 1e6, 10);
igual("SE verdadeiro", calcular('=SE(A1>5;"sim";"nao")', ctx), "sim");
igual("SE falso", calcular('=SE(A1>50;"sim";"nao")', ctx), "nao");
igual("E verdadeiro", calcular("=E(A1>5;A2>5)", ctx), true);
igual("OU verdadeiro", calcular("=OU(A1>50;A2>5)", ctx), true);
igual("NÃO", calcular("=NÃO(A1>50)", ctx), true);
igual("ARRED", calcular("=ARRED(2.567;2)", ctx), 2.57);
igual("ARRED banker's", calcular("=ARRED(2.675;2)", ctx), 2.68);
igual("ABS", calcular("=ABS(0-10)", ctx), 10);
igual("RAIZ", calcular("=RAIZ(16)", ctx), 4);
igual("RAIZ negativa", String(calcular("=RAIZ(0-16)", ctx)), "#NÚM!");
igual("POTÊNCIA", calcular("=POTÊNCIA(2;8)", ctx), 256);
igual("INT", calcular("=INT(2.9)", ctx), 2);
igual("RESTO", calcular("=RESTO(10;3)", ctx), 1);
igual("CONCATENAR", calcular('=CONCATENAR("a";"b";"c")', ctx), "abc");
igual("NÚM.CARACT", calcular('=NÚM.CARACT("abcd")', ctx), 4);
igual("MAIÚSCULA", calcular('=MAIÚSCULA("abc")', ctx), "ABC");
igual("MINÚSCULA", calcular('=MINÚSCULA("ABC")', ctx), "abc");
igual("ESPAÇOS", calcular('=ESPAÇOS("  a   b  ")', ctx), "a b");
igual("ESQUERDA", calcular('=ESQUERDA("abcdef";3)', ctx), "abc");
igual("DIREITA", calcular('=DIREITA("abcdef";2)', ctx), "ef");
igual("EXT.TEXTO", calcular('=EXT.TEXTO("abcdef";2;3)', ctx), "bcd");
igual("VAZIO em célula vazia", calcular("=VAZIO(D9)", ctx), true);
igual("NÃO.VAZIO contaPreenchidas", calcular("=NÃO.VAZIO(A1;A2;A3)", ctx), 3);
igual("ÉERRO", calcular("=ÉERRO(A1/0)", ctx), true);
igual("É.NÚMERO", calcular("=É.NÚMERO(A1)", ctx), true);
igual("referência com $", calcular("=$A$1+$A$2", ctx), 30);
igual("função desconhecida", String(calcular("=FOOBAR(1)", ctx)).includes("#NOME?"), true);
igual("outra aba dá #REF!", String(calcular("=Planilha2!A1", ctx)), "#REF!");
igual("texto com aspas duplas", calcular('="diz ""oi"""', ctx), 'diz "oi"');

console.log("\nFórmulas: texto em faixa, preguiça e conversões");
const ctxTexto = contexto({ A1: "Qtd", A2: 1, A3: 2 });
igual("SOMA ignora texto da faixa", calcular("=SOMA(A1:A3)", ctxTexto), 3);
igual("CONT.VALORES conta texto", calcular("=CONT.VALORES(A1:A3)", ctxTexto), 3);
igual("CONT.NÚM ignora texto", calcular("=CONT.NÚM(A1:A3)", ctxTexto), 2);
igual("SE não calcula o ramo falso", calcular("=SE(A1=0;0;1/A1)", contexto({ A1: 0 })), 0);
igual("SE não calcula o ramo verdadeiro", calcular("=SE(A1=1;1/A1;0)", contexto({ A1: 0 })), 0);
igual("OU curto-circuita", calcular("=OU(A1=0;1/0=0)", contexto({ A1: 0 })), true);
igual("E curto-circuita", calcular("=E(A1=0;1/0=0)", contexto({ A1: 1 })), false);
igual("número antes de texto", calcular('=1<"a"', ctx), true);
igual("potência associa à direita", calcular("=2^3^2", ctx), 512);
igual("ARRED negativo", calcular("=ARRED(0-2.675;2)", ctx), -2.68);
igual("ARRED casas negativas", calcular("=ARRED(1234.5;-2)", ctx), 1200);
igual("ABS de texto vira erro", String(calcular('=ABS("x")', ctx)), "#VALOR!");
igual("vírgula decimal pt-BR", calcular("=1,5+1", ctx), 2.5);
igual("milhar e decimal pt-BR", calcular("=1.234,56+1", ctx), 1235.56);
igual("TEXTO formata número", calcular('=TEXTO(1234.5;"#.##0,00")', ctx), "1.234,50");
igual("CONCATENAR aceita faixa", calcular("=CONCATENAR(A1:A3)", ctx), "102030");
igual("SOMASE sem terceiro argumento", calcular('=SOMASE(A1:A2;">0")', contexto({ A1: 1, A2: 2 })), 3);
igual(
  "SOMASE multicoluna alinha a soma",
  calcular('=SOMASE(A1:B1;">0";C1:D1)', contexto({ A1: 1, B1: 2, C1: 10, D1: 20 })),
  30
);
igual("SUM em inglês", calcular("=SUM(A1:A3)", ctx), 60);
igual("IF em inglês", calcular("=IF(A1>5;1;2)", ctx), 1);

// referência circular
const circular = {
  valorDe: (alvo) => (alvo === "A1" ? calcular("=A2", circular) : calcular("=A1", circular)),
  faixaAlvo: () => [],
};
ok("referência circular não trava", String(calcular("=A1", circular)).length > 0);

// ------------------------------------------------------------------
console.log("\nDeslocamento de referências (a alça de preenchimento)");
const { deslocarFormula, ajustarFormula } = await mod("refs.js");
igual("para baixo", deslocarFormula("=C2*D2", 1, 0), "=C3*D3");
igual("duas para baixo", deslocarFormula("=C2*D2", 2, 0), "=C4*D4");
igual("para a direita", deslocarFormula("=C2*D2", 0, 1), "=D2*E2");
igual("mistura", deslocarFormula("=C2*D2", 1, 1), "=D3*E3");
igual("absoluta nas duas ($C$2)", deslocarFormula("=$C$2+A1", 1, 0), "=$C$2+A2");
igual("absoluta só na coluna", deslocarFormula("=$C2+A1", 1, 1), "=$C3+B2");
igual("absoluta só na linha", deslocarFormula("=C$2+A1", 1, 1), "=D$2+B2");
igual("função continua função", deslocarFormula("=SOMA(A1:A3)", 3, 0), "=SOMA(A4:A6)");
igual("texto com A1 dentro não muda", deslocarFormula('=SE(A1>0;"A1";"B2")', 1, 0), '=SE(A2>0;"A1";"B2")');
igual("sai da planilha vira #REF!", deslocarFormula("=A1", -1, 0), "=#REF!");
igual("deslocamento zero não muda nada", deslocarFormula("=C2*D2", 0, 0), "=C2*D2");
igual("número solto não é referência", deslocarFormula("=100+2", 1, 0), "=100+2");
igual("percentual", deslocarFormula("=A1*10%", 1, 0), "=A2*10%");
igual("nome de função com dígito não vira referência", deslocarFormula("=LOG10(A1)", 1, 0), "=LOG10(A2)");
igual("inserir linha desloca a faixa", ajustarFormula("=SOMA(A1:A2)", "linha", 1, 1, "inserir"), "=SOMA(A1:A3)");
igual("excluir linha vira #REF!", ajustarFormula("=A2", "linha", 1, 1, "excluir"), "=#REF!");
igual("inserir coluna desloca referência", ajustarFormula("=B1+C1", "coluna", 1, 1, "inserir"), "=C1+D1");
igual("excluir coluna depois da faixa sobe", ajustarFormula("=C1", "coluna", 1, 1, "excluir"), "=B1");

// ------------------------------------------------------------------
console.log("\n. xlsx: exportar e ler de volta");
const { livro, config } = livroDeExemplo();
const bytes = await livroParaXlsx(livro, { titulo: "Teste", casas: config.casas, grade: true });
ok("gera bytes", bytes.length > 0, `${bytes.length} bytes`);
ok("começa com PK (ZIP)", bytes[0] === 0x50 && bytes[1] === 0x4b);

mkdirSync(temporario, { recursive: true });
const arquivo = join(temporario, "teste-motor.xlsx");
writeFileSync(arquivo, bytes);

const lido = await xlsxParaLivro(bytes);
igual("número de abas", lido.livro.folhas.length, 2);
igual("nome da 1ª aba", lido.livro.folhas[0].nome, "Orçamento");
igual("nome da 2ª aba", lido.livro.folhas[1].nome, "Notas");
igual("cabeçalho A1", lido.livro.folhas[0].celulas.A1?.texto, "Item");
igual("cabeçalho E1", lido.livro.folhas[0].celulas.E1?.texto, "Total");
igual("número puro vira texto", lido.livro.folhas[0].celulas.C2?.texto, "2");
igual("fórmula preservada", lido.livro.folhas[0].celulas.E2?.texto, "=C2*D2");
igual("rótulo do total", lido.livro.folhas[0].celulas.A6?.texto, "Total geral");
igual("fórmula do total", lido.livro.folhas[0].celulas.E6?.texto, "=SOMA(E2:E5)");
igual("mescla preservada", lido.livro.folhas[0].mesclas.includes("A6:D6"), true);
igual("congelado preservado", JSON.stringify(lido.livro.folhas[0].congelado), JSON.stringify({ colunas: 0, linhas: 1 }));
igual("estilo negrito do cabeçalho", lido.livro.folhas[0].celulas.A1?.estilo?.negrito, true);
igual("alinhamento do cabeçalho", lido.livro.folhas[0].celulas.A1?.estilo?.alinhamento, "centro");
igual("fundo do cabeçalho", lido.livro.folhas[0].celulas.A1?.estilo?.fundo, "E8F0FE");
igual("formato moeda", lido.livro.folhas[0].celulas.D2?.estilo?.numero, "moeda");
igual("formato porcento", lido.livro.folhas[0].celulas.C2?.estilo?.numero, "decimal");
igual("fórmula marcada como fórmula", lido.livro.folhas[0].celulas.E2?.formula, true);
igual("nota da 2ª aba", lido.livro.folhas[1].celulas.A1?.texto, "Como esta planilha funciona");

// os valores calculados batem com o cálculo à mão do exemplo
const e2 = calcular("=C2*D2", {
  valorDe: (r) => {
    const n = Number(r.slice(1));
    return lido.livro.folhas[0].celulas[r] ? Number(lido.livro.folhas[0].celulas[r].texto.replace(",", ".")) : null;
  },
  faixaAlvo: (a) => [],
});
igual("2 x 5200", e2, 10400);
igual("soma dos quatro", calcular("=10400+1800+1280+950", ctx), 14430);

// ------------------------------------------------------------------
console.log("\n. xlsx: números, formatos e fórmulas em inglês");
const { default: JSZip } = await import("jszip");
const livroNumeros = {
  folhas: [
    {
      nome: "Dados",
      celulas: {
        A1: { texto: "01/01/2026", estilo: { numero: "data" } },
        A2: { texto: "0,125", estilo: { numero: "porcento", casas: 2 } },
        A3: { texto: "1.234,5678", estilo: { numero: "decimal", casas: 4 } },
        B1: { texto: "10", estilo: { numero: "moeda", casas: 2 } },
        C1: { texto: "=SOMA(B1:B1)" },
        D1: { texto: "=SUM(B1:B1)" },
        E1: { texto: "=SE(A1>0;1,5;2,5)" },
        F1: { texto: "=VERDADEIRO" },
        G1: { texto: "Fonte", estilo: { fonte: "Arial", tamanho: 16 } },
      },
      colunas: {},
      linhas: {},
      mesclas: [],
    },
  ],
  ativa: 0,
};
const bytesNumeros = await livroParaXlsx(livroNumeros, { casas: 2, grade: true });
const zipNumeros = await JSZip.loadAsync(bytesNumeros);
const estilosNum = await zipNumeros.file("xl/styles.xml").async("string");
const abaNum = await zipNumeros.file("xl/worksheets/sheet1.xml").async("string");
const idsFormato = [...estilosNum.matchAll(/<numFmt numFmtId="(\d+)"/g)].map((m) => m[1]);
ok("formatos personalizados têm ids únicos", idsFormato.length >= 3 && new Set(idsFormato).size === idsFormato.length, idsFormato.join(","));
ok("fórmula é exportada em inglês", abaNum.includes("<f>SUM(B1:B1)</f>"));
ok(
  "fórmula com SE/vírgula decimal vira IF com ponto e vírgula de argumento",
  abaNum.includes("<f>IF(A1&gt;0,1.5,2.5)</f>")
);
ok("booleano é exportado como TRUE", abaNum.includes("<f>TRUE</f>"));
const lidoNumeros = await xlsxParaLivro(bytesNumeros);
const folhaNum = lidoNumeros.livro.folhas[0].celulas;
igual("a data volta como data", folhaNum.A1.texto, "01/01/2026");
igual("o decimal do XML não vira 125", numeroDe(folhaNum.A2.texto), 0.125);
igual("o decimal grande continua decimal", numeroDe(folhaNum.A3.texto), 1234.5678);
igual("a moeda continua moeda", folhaNum.B1.estilo.numero, "moeda");
igual("o decimal continua decimal", folhaNum.A3.estilo.numero, "decimal");
igual("as casas do decimal sobrevivem", folhaNum.A3.estilo.casas, 4);
igual("a fórmula em inglês volta como SOMA", folhaNum.D1.texto, "=SOMA(B1:B1)");
igual("a família da fonte sobrevive", folhaNum.G1.estilo?.fonte, "Arial");
igual("o tamanho da fonte sobrevive", folhaNum.G1.estilo?.tamanho, 16);
ok("o XML guarda a fonte e o tamanho", estilosNum.includes('<name val="Arial"/>') && estilosNum.includes('<sz val="16"/>'));
ok("a fonte padrão do livro continua Calibri 11", estilosNum.includes('<name val="Calibri"/>') && estilosNum.includes('<sz val="11"/>'));

// fórmula compartilhada: o mestre vale para as dependentes, deslocado
const zipCompart = new JSZip();
zipCompart.file(
  "xl/workbook.xml",
  `<?xml version="1.0"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Compart" sheetId="1" r:id="rId1"/></sheets></workbook>`
);
zipCompart.file(
  "xl/_rels/workbook.xml.rels",
  `<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>`
);
zipCompart.file(
  "xl/worksheets/sheet1.xml",
  `<?xml version="1.0"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData><row r="1"><c r="A1"><v>1</v></c><c r="B1"><f t="shared" ref="B1:B2" si="0">A1*2</f><v>2</v></c></row><row r="2"><c r="A2"><v>2</v></c><c r="B2"><f t="shared" si="0"/><v>4</v></c></row></sheetData></worksheet>`
);
const lidoCompart = await xlsxParaLivro(await zipCompart.generateAsync({ type: "uint8array" }));
igual("fórmula compartilhada mestre", lidoCompart.livro.folhas[0].celulas.B1.texto, "=A1*2");
igual("fórmula compartilhada dependente deslocada", lidoCompart.livro.folhas[0].celulas.B2.texto, "=A2*2");

// ------------------------------------------------------------------
console.log("\njustificado: fita, CSS e .xlsx");
const hostFonte = readFileSync(join(raiz, "src/excel/host.ts"), "utf8");
const ribbonFonte = readFileSync(join(raiz, "src/excel/ribbon.ts"), "utf8");
ok(
  "a fita tem o botão Justificar",
  ribbonFonte.includes('btn("align-justificado"') && ribbonFonte.includes('liga("align-justificado"'),
  "o grupo Alinhamento só tinha esquerda/centro/direita"
);
ok(
  "o CSS recebe justify (e centro/direita viram center/right)",
  /justificado: "justify"/.test(hostFonte) && /centro: "center"/.test(hostFonte) && /direita: "right"/.test(hostFonte)
);
const livroJust = {
  ...livro,
  folhas: livro.folhas.map((f) => ({ ...f, celulas: { ...f.celulas } })),
};
livroJust.folhas[0].celulas.E2 = {
  ...livroJust.folhas[0].celulas.E2,
  estilo: { ...(livroJust.folhas[0].celulas.E2?.estilo ?? {}), alinhamento: "justificado" },
};
const lidoJust = await xlsxParaLivro(await livroParaXlsx(livroJust, { titulo: "Just", casas: config.casas, grade: true }));
igual("justificado sobrevive ao .xlsx", lidoJust.livro.folhas[0].celulas.E2?.estilo?.alinhamento, "justificado");

// ------------------------------------------------------------------
console.log("\nfonte, tamanho e paleta");
ok(
  "a fita tem família e tamanho de fonte",
  ribbonFonte.includes('data-fonte') && ribbonFonte.includes('data-tamanho') && ribbonFonte.includes("FONTES")
);
ok(
  "a paleta tem recentes, tema, padrão, cinzas e mais cores",
  ribbonFonte.includes("Usadas recentemente") &&
    ribbonFonte.includes("Cores do tema") &&
    ribbonFonte.includes("Cores padrão") &&
    ribbonFonte.includes("Cinzas") &&
    ribbonFonte.includes("Mais cores")
);
ok(
  "a fita oferece inserir função e estilo de tabela",
  ribbonFonte.includes("abrirFuncoes") && ribbonFonte.includes("abrirTabelas") && ribbonFonte.includes('"tabela"')
);
ok(
  "a célula desenha a fonte e o tamanho do modelo",
  /font-family:'\$\{\(estilo\?\.fonte/.test(hostFonte) && /font-size:\$\{Math\.max\(6/.test(hostFonte)
);

// ------------------------------------------------------------------
console.log("\nhost: recálculo dos dependentes, seleção e planilha nova");
const hostSrc = readFileSync(join(raiz, "src/excel/host.ts"), "utf8");
ok(
  "qualquer edição limpa o cache (o Total dependente recalcula)",
  /private sujo\(\)[\s\S]{0,700}this\.cache\.clear\(\)/.test(hostSrc),
  "o cache por texto da própria célula deixava C2*D2 velho"
);
ok(
  "clique comum começa uma seleção nova",
  /this\.definirSelecao\(alvoCel, alvoCel, alvoCel\)/.test(hostSrc),
  "o Ctrl não pode estender a partir do âncora antigo"
);
ok(
  "Shift+clique estende já no mousedown",
  /this\.definirSelecao\(this\.ancora, alvoCel, this\.ancora\)/.test(hostSrc)
);
ok(
  "o clique confirma a edição antes de trocar a seleção",
  /if \(this\.edicao\) this\.confirmarEdicao\(false\)/.test(hostSrc)
);
ok(
  "uma célula copiada não vira 2×2",
  !/sel\.l2 = Math\.min\(sel\.l1 \+ 1/.test(hostSrc),
  "valoresDaSelecao expandia a célula única"
);
ok("a alça fica no canto do bloco selecionado", /alca-caixa/.test(hostSrc));
ok(
  "colar usa a célula ativa como âncora",
  /const base = \{ linha: this\.linha, coluna: this\.coluna \}/.test(hostSrc)
);
ok(
  "Enter anda uma linha para baixo",
  /case "Enter":[\s\S]{0,220}this\.mover\(this\.linha \+ 1/.test(hostSrc)
);
ok("planilha nova nasce em branco (sem o orçamento de exemplo)", /createTab\(\): ExcelTabData \{\s*return this\.createEmpty\(\);/.test(hostSrc));
const tabsCss = readFileSync(join(raiz, "src/styles/tabs.css"), "utf8");
ok("o ícone da aba gira no hover", /\.tab:hover \.tab-ic \.ic \{[\s\S]{0,80}rotate\(1turn\)/.test(tabsCss));
const excelCss = readFileSync(join(raiz, "src/styles/excel.css"), "utf8");
ok(
  "o cabeçalho de linha ocupa a coluna inteira (número centralizado)",
  /\.xl-cab-l \{\s*left: 0;\s*width: 100%;/.test(excelCss),
  "sem width/left o botão encolhia para o número"
);
ok(
  "a borda do cabeçalho não soma 1px por linha",
  /\.xl-cab-l,\s*\.xl-cab-c \{[\s\S]{0,500}box-sizing: border-box/.test(excelCss)
);

// ------------------------------------------------------------------
console.log("\n.xls antigo e .csv");
console.log("  (o app avisa sobre .xls; ver src/app/documents.ts)");

console.log(`\n${passou} passaram, ${falhou} falharam`);
console.log(`Arquivo de teste gravado em: ${arquivo}`);
process.exit(falhou ? 1 : 0);