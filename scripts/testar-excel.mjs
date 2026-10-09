// Teste do motor de planilhas fora do app: verifica o avaliador de fórmulas,
// o cálculo de datas e a ida-e-volta do .xlsx (exportar -> ler de volta).
//
// Rode com:  node scripts/testar-excel.mjs
//
// O teste NÃO abre o Excel: ele grava um .xlsx de verdade e confere se o
// próprio leitor do motor recupera exatamente o que foi colocado.

import { mkdirSync, writeFileSync } from "node:fs";
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
const { dataParaSerial, serialParaData, numeroDe, dataDe, formatarNumero } = await mod("values.js");
const { nomeColuna, indiceColuna, partes, ref, intervalo } = await mod("refs.js");
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

// referência circular
const circular = {
  valorDe: (alvo) => (alvo === "A1" ? calcular("=A2", circular) : calcular("=A1", circular)),
  faixaAlvo: () => [],
};
ok("referência circular não trava", String(calcular("=A1", circular)).length > 0);

// ------------------------------------------------------------------
console.log("\nDeslocamento de referências (a alça de preenchimento)");
const { deslocarFormula } = await mod("refs.js");
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
console.log("\n.xls antigo e .csv");
console.log("  (o app avisa sobre .xls; ver src/app/documents.ts)");

console.log(`\n${passou} passaram, ${falhou} falharam`);
console.log(`Arquivo de teste gravado em: ${arquivo}`);
process.exit(falhou ? 1 : 0);