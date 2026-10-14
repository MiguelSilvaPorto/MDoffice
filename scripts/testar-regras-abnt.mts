// Teste das regras ABNT em TOML. Três partes, na ordem em que protegem:
//
// 1. CLASSES GERADAS — percorre os code points de 0 a 0x10FFFF e confere a tabela
//    contra o que o motor faz de verdade (`/\s/u`, `/\d/u`). O que é circular está
//    dito no próprio teste: para os predicados sobre `\p{L}` ele confere a lógica do
//    complemento e a borda, não a escolha da classe.
// 2. LINT — as dez regras antigas passam, e exemplos quebrados de propósito são recusados.
// 3. TESTE DE OURO — as regras em TOML têm de produzir EXATAMENTE os mesmos avisos
//    que as dez funções TypeScript de `src/broker/style/abnt.ts`, nas quatro famílias
//    de caso: acento colado à borda, vizinhos, bordas do texto e match descartado ao
//    lado de um válido.
//
// As famílias 5 e 6 da especificação (texto em NFD e em CRLF) são do PIPELINE, não das
// regras: elas testam a normalização que roda antes — ficam em `testar-correcoes`.
//
// Roda com: node scripts/testar-regras-abnt.mts
import { build } from "esbuild";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";

const raiz = dirname(dirname(fileURLToPath(import.meta.url)));
let falhas = 0;
const checa = (nome: string, ok: boolean, extra = "") => {
  console.log(`  ${ok ? "ok  " : "FALHA"} ${nome}${!ok && extra ? ` — ${extra}` : ""}`);
  if (!ok) falhas++;
};

// ---------------------------------------------------------------- empacotar

const tmp = mkdtempSync(join(tmpdir(), "abnt-"));

/** O `?raw` do Vite, que o esbuild não conhece sozinho. */
const pluginRaw = {
  name: "raw",
  setup(api: {
    onResolve: (o: { filter: RegExp }, cb: (a: { path: string; importer: string }) => unknown) => void;
    onLoad: (o: { filter: RegExp; namespace: string }, cb: (a: { path: string }) => unknown) => void;
  }) {
    api.onResolve({ filter: /\?raw$/ }, (args) => ({
      path: resolve(dirname(args.importer), args.path.replace(/\?raw$/, "")),
      namespace: "raw",
    }));
    api.onLoad({ filter: /.*/, namespace: "raw" }, (args) => ({
      contents: readFileSync(args.path, "utf8"),
      loader: "text",
    }));
  },
};

const empacotar = async (entrada: string, saida: string) => {
  await build({
    entryPoints: [join(raiz, entrada)],
    bundle: true,
    platform: "node",
    format: "esm",
    outfile: join(tmp, saida),
    logLevel: "error",
    plugins: [pluginRaw as never],
  });
  return import(pathToFileURL(join(tmp, saida)).href);
};

// ---------------------------------------------------------------- 1. classes

console.log("classes e predicados (gerado, code point a code point)");
{
  const E = await empacotar("src/broker/abnt/esquema.ts", "esquema.mjs");
  const CLASSES = E.CLASSES as Record<string, string>;
  const PREDICADOS = E.PREDICADOS as Record<string, string>;

  const divergentes = (conteudo: string, espera: (c: string) => boolean) => {
    const rx = new RegExp(`[${conteudo}]`, "u");
    const ruins: number[] = [];
    for (let cp = 0; cp <= 0x10ffff; cp++) {
      const c = String.fromCodePoint(cp);
      if (rx.test(c) !== espera(c)) ruins.push(cp);
    }
    return ruins;
  };
  const amostra = (lista: number[]) => lista.slice(0, 8).map((cp) => "U+" + cp.toString(16).toUpperCase()).join(" ");

  const espaco = divergentes(CLASSES.espaco, (c) => /\s/u.test(c));
  checa(`o conjunto "espaco" é o \\s do motor`, espaco.length === 0, `${espaco.length} divergências: ${amostra(espaco)}`);

  const digito = divergentes(CLASSES.digito, (c) => /\d/u.test(c));
  checa(`o conjunto "digito" é o \\d do motor`, digito.length === 0, `${digito.length} divergências: ${amostra(digito)}`);

  const palavra = divergentes(CLASSES.palavra_ascii, (c) => /\w/u.test(c));
  checa(`o conjunto "palavra_ascii" é o \\w do motor`, palavra.length === 0, `${palavra.length} divergências: ${amostra(palavra)}`);

  // predicados: o que este teste prova está dito aqui, para ninguém ler mais do que ele diz
  const CIRCULAR = "confere o complemento e a borda, não a escolha da classe";
  let complementoOk = true;
  for (const [nome, classe] of Object.entries(PREDICADOS)) {
    const negacao = classe.startsWith("[^");
    // o conteúdo só faz sentido DENTRO de uma classe: `A-Za-z0-9_` solto seria a
    // sequência literal desses caracteres, não o conjunto deles
    const conteudo = classe.replace(/^\[\^?/, "").replace(/\]$/, "");
    const positivos = new RegExp(`[${conteudo}]`, "u");
    const predicado = new RegExp(classe, "u");
    for (let cp = 0; cp <= 0x2fff; cp++) {
      const c = String.fromCodePoint(cp);
      const esperado = negacao ? !positivos.test(c) : positivos.test(c);
      if (predicado.test(c) !== esperado) {
        complementoOk = false;
        console.log(`        ${nome}: U+${cp.toString(16).toUpperCase()} diverge`);
        break;
      }
    }
  }
  checa(`cada predicado é a negação do conjunto que declara (${CIRCULAR})`, complementoOk);
}

// ---------------------------------------------------------------- 2. lint

/** Os ids das dez regras originais — o teste de ouro compara ELAS com as funções TS. */
const IDS_ANTIGAS = [
  "abnt.horas",
  "abnt.horas_dois_pontos",
  "abnt.unidades",
  "abnt.meses",
  "abnt.siglas_plural",
  "abnt.citacao_autor_data",
  "abnt.pagina",
  "abnt.et_al",
  "abnt.travessao",
  "abnt.latinismos",
];

console.log("\nlint da carga");
{
  const L = await empacotar("src/broker/abnt/lint.ts", "lint.mjs");
  const I = await empacotar("src/broker/abnt/index.ts", "index.mjs");

  // as dez originais continuam passando; cada grupo novo (E, C, R, S…) acrescenta as
  // suas e a carga segue exigindo que TODAS passem (uma ruim derruba a carga inteira)
  let carregadas = 0;
  let erroCarga = "";
  try {
    const ids = new Set((I.carregarRegras() as { id: string }[]).map((r) => r.id));
    carregadas = IDS_ANTIGAS.filter((id) => ids.has(id)).length;
  } catch (e) {
    erroCarga = String(e);
  }
  checa("as dez regras originais (e as novas) passam no lint", carregadas === 10, erroCarga);

  // recusas: cada exemplo quebra uma regra do schema
  const base = {
    id: "teste",
    norma: "abnt:tipografia",
    grupo: "T",
    severidade: "warning",
    regex: "(?<trecho>a)",
    trecho: "trecho",
    substituir: "b",
    mensagem: "m",
  };
  const recusa = (nome: string, cru: Record<string, unknown>) => {
    let motivo = "";
    const r = L.conferirRegra(cru, (e: string) => (motivo = e));
    checa(`recusa: ${nome}`, r === null && !!motivo, motivo || "aceitou");
  };

  recusa("shorthand \\d no padrão", { ...base, regex: "(?<trecho>[0-9]{0,\\d})" });
  recusa("lookbehind", { ...base, regex: "(?<!x)(?<trecho>a)" });
  recusa("lookahead", { ...base, regex: "(?<trecho>a)(?!x)" });
  recusa("{nome} que não é grupo", { ...base, substituir: "{naoExiste}" });
  recusa("<<nome>> desconhecido", { ...base, regex: "(?<trecho><<naoExiste>>)" });
  recusa("classe usada fora de colchetes", { ...base, regex: "(?<trecho><<digito>>)" });
  recusa("lista usada dentro de colchetes", { ...base, regex: "(?<trecho>[<<meses>>])" });
  recusa("trecho que não é grupo nomeado", { ...base, trecho: "outro" });
  recusa("predicado desconhecido", { ...base, antes: "predicado_inventado" });
  recusa("escopo de bloco sem contexto", { ...base, escopo: "bloco" });
  recusa("bloco desconhecido", { ...base, escopo: "bloco", contexto: { blocos: ["introducao"] } });
  recusa("tipo desconhecido", { ...base, tipo: "mágica" });
  recusa("regra de estrutura sem verificador", {
    ...base,
    tipo: "estrutura",
    regex: undefined,
    trecho: undefined,
    substituir: undefined,
    mensagem: undefined,
  });
}

// ---------------------------------------------------------------- 3. teste de ouro

console.log("\nteste de ouro (TOML contra as dez funções)");
{
  const A = await empacotar("src/broker/style/abnt.ts", "abnt-ts.mjs");
  const I = await empacotar("src/broker/abnt/index.ts", "index2.mjs");
  const M = await empacotar("src/broker/mask.ts", "mask.mjs");

  const ANTIGAS = [
    "abntHours",
    "abntHoursColon",
    "abntUnits",
    "abntMonths",
    "abntAcronymPlural",
    "abntCitation",
    "abntPage",
    "abntEtAl",
    "abntDash",
    "abntLatin",
  ].map((n) => A[n]);

  interface Aviso {
    de: number;
    ate: number;
    mensagem: string;
    fix?: string;
    sugestoes: string[];
    auto: boolean;
  }
  const rodar = (regras: unknown[], texto: string): Aviso[] => {
    const mask = M.maskNonProse(texto);
    const avisos: Aviso[] = [];
    const ctx = {
      text: texto,
      mask,
      push: (de: number, ate: number, mensagem: string, fix?: string, sugestoes?: string[], safe?: boolean) =>
        avisos.push({ de, ate, mensagem, fix, sugestoes: sugestoes ?? [], auto: safe === true }),
    };
    for (const r of regras) (r as (c: unknown) => void)(ctx);
    return avisos;
  };

  // O teste de ouro compara as DEZ funções antigas com as TOML delas; as regras novas do
  // catálogo (E, C01/C03/C04/C06, R, S, A, P, T) não têm par no TypeScript antigo — têm
  // o próprio teste (scripts/testar-abnt-<grupo>.mts) — e ficam fora daqui.
  //
  // A seta NÃO é estilo: `.map(I.regraDeToml)` passaria o ÍNDICE do array como o
  // `registro` de verificadores — na primeira regra de estrutura, "verificador
  // desconhecido". O registro default só vale quando o segundo argumento é undefined.
  const novos = I.carregarRegras()
    .filter((r: { id: string }) => IDS_ANTIGAS.includes(r.id))
    .map((r: unknown) => I.regraDeToml(r));

  // As quatro famílias da Parte A, com caso para cada uma das dez regras.
  const FAMILIAS: [string, string[]][] = [
    [
      "acento colado à borda",
      [
        "às 14hs",
        "ação",
        "é",
        "às 14:30hs",
        "ação 10km",
        "só 25ºc depois",
        "é 14 de Outubro",
        "às ONG's",
        "(SILVA, 2020)",
        "é pág. 15",
        "às et al",
        "ação -- inciso",
        "é a priori",
      ],
    ],
    [
      "vizinhos",
      ["14hs 15hs", "10km 20kg", "pág. 15 pg. 20", "et al et al", "ONG's USP's", "a priori ad hoc"],
    ],
    ["bordas do texto", ["14hs", "10km", "pág. 15", "et al", "ONG's", "a priori", "14 de Outubro"]],
    ["descartado ao lado de válido", ["x14hs 15hs", "x10km 20kg", "xON1's ONG's", "xpág. 15 pg. 20"]],
  ];

  let comparados = 0;
  for (const [familia, textos] of FAMILIAS) {
    const diferencas: string[] = [];
    for (const texto of textos) {
      const velho = rodar(ANTIGAS, texto);
      const novo = rodar(novos as unknown[], texto);
      comparados++;
      const igual =
        velho.length === novo.length &&
        velho.every((a, i) => {
          const b = novo[i];
          return (
            a.de === b.de &&
            a.ate === b.ate &&
            a.mensagem === b.mensagem &&
            a.fix === b.fix &&
            a.auto === b.auto &&
            a.sugestoes.join("|") === b.sugestoes.join("|")
          );
        });
      if (!igual) {
        diferencas.push(
          `"${texto}"\n        antigas: ${JSON.stringify(velho)}\n        TOML:    ${JSON.stringify(novo)}`
        );
      }
    }
    checa(`${familia} (${textos.length} textos)`, diferencas.length === 0, diferencas.join("\n      "));
  }
  console.log(`  (${comparados} textos comparados, aviso por aviso)`);
}

// ------------------------------------------- 4. normalização (famílias 5 e 6)

console.log("\nnormalização: NFD e CRLF (famílias 5 e 6 da especificação)");
{
  const N = await empacotar("src/broker/normalizar.ts", "normalizar.mjs");
  const I = await empacotar("src/broker/abnt/index.ts", "index3.mjs");
  const M = await empacotar("src/broker/mask.ts", "mask2.mjs");
  const regras = I.carregarRegras().map((r) => I.regraDeToml(r));

  const rodarRegras = (texto: string) => {
    const mask = M.maskNonProse(texto);
    const avisos: { de: number; ate: number; fix?: string }[] = [];
    const ctx = {
      text: texto,
      mask,
      push: (de: number, ate: number, _m: string, fix?: string) => avisos.push({ de, ate, fix }),
    };
    for (const r of regras) (r as (c: unknown) => void)(ctx);
    return avisos;
  };

  // NFD: "Á" é "A" + marca solta. Sem normalizar, a classe literal [A-ZÁÉÍÓÚ] da regra
  // das siglas não casa o "Á" — o aviso sai deslocado e a troca APAGA a letra.
  const nfd = "ÁBC's".normalize("NFD");
  const cru = rodarRegras(nfd);
  const norm = N.normalizarTexto(nfd);
  const depois = rodarRegras(norm.texto);
  checa("em NFD, a regra erra o alvo (é o problema que a normalização conserta)", cru.some((a) => a.fix === "BCs"), JSON.stringify(cru));
  checa("o texto normalizado está em NFC", norm.texto.normalize("NFC") === norm.texto && norm.mudou === true);
  checa(
    "depois de normalizar, a regra acerta a sigla inteira",
    depois.length === 1 && depois[0].fix === "ÁBCs",
    JSON.stringify(depois)
  );

  // o aviso volta para o ORIGINAL, em índice de caractere
  const norm2 = N.normalizarTexto(nfd);
  const de = N.paraOriginal(norm2, depois[0].de);
  const ate = N.paraOriginal(norm2, depois[0].ate);
  checa(
    "o span volta ao original com o comprimento certo (NFD tem 6 caracteres)",
    de === 0 && ate === [...nfd].length,
    `de ${de} até ${ate}, original tem ${[...nfd].length}`
  );

  // CRLF: a regra que casa fim de linha não pode depender do fim de linha do documento
  const crlf = "primeiro -- trecho\r\nsegundo -- trecho";
  const n3 = N.normalizarTexto(crlf);
  checa("CRLF vira LF", !n3.texto.includes("\r") && n3.texto.includes("\n"));
  const avisos = rodarRegras(n3.texto);
  checa("as duas ocorrências são achadas", avisos.length === 2, JSON.stringify(avisos));
  const segundo = avisos[1];
  const deCrlf = N.paraOriginal(n3, segundo.de);
  const esperado = [...crlf].indexOf("\n") + 1 + [..."segundo"].length;
  checa(
    "o segundo aviso aponta para a posição certa no original (com o \\r contado)",
    deCrlf === esperado,
    `${deCrlf} contra ${esperado}`
  );
}

// ---------------------------------------------------------------- 5. perfil

console.log("\nperfil: regra desligada, suavizada e endurecida");
{
  const I = await empacotar("src/broker/abnt/index.ts", "index4.mjs");
  const regras = I.carregarRegras();

  const base = I.perfilBase();
  checa(
    "o perfil base carrega com as versões de norma",
    base.nome === "ABNT base" && base.norma?.nbr6023 === "2025",
    JSON.stringify(base.norma)
  );

  const sem = I.aplicarPerfil(regras, { nome: "x", regras: { "abnt.latinismos": "off" } });
  checa(
    "off tira a regra",
    sem.length === regras.length - 1 && !sem.some((r: { id: string }) => r.id === "abnt.latinismos")
  );

  const suave = I.aplicarPerfil(regras, { nome: "x", regras: { "abnt.latinismos": "soft" } });
  const r = suave.find((x: { id: string }) => x.id === "abnt.latinismos");
  checa("soft vira sugestão e perde o automático", r.severidade === "suggestion" && r.auto === false, JSON.stringify(r));

  const duro = I.aplicarPerfil(regras, { nome: "x", regras: { "abnt.citacao_autor_data": "hard" } });
  checa(
    "hard vira erro",
    duro.find((x: { id: string }) => x.id === "abnt.citacao_autor_data").severidade === "error"
  );
}

// ------------------------------------- 6. medição (o número que reabre a questão)

console.log("\nmedição: as dez regras sobre um TCC");
{
  const I = await empacotar("src/broker/abnt/index.ts", "index5.mjs");
  const M = await empacotar("src/broker/mask.ts", "mask3.mjs");
  const texto = readFileSync(join(raiz, "docs/pesquisa-formalidade-abnt.md"), "utf8");
  const regras = I.carregarRegras().map((r) => I.regraDeToml(r));
  const mask = M.maskNonProse(texto);
  const ctx = { text: texto, mask, push: () => {} };

  for (const regra of regras) (regra as (c: unknown) => void)(ctx); // aquece
  const voltas = 10;
  const t0 = performance.now();
  for (let v = 0; v < voltas; v++) for (const regra of regras) (regra as (c: unknown) => void)(ctx);
  const ms = (performance.now() - t0) / voltas;

  console.log(
    `  ${[...texto].length} caracteres, ${regras.length} regras: ${ms.toFixed(1)} ms por verificação`
  );
  checa(
    "verificar um TCC inteiro fica bem abaixo do que a digitação tolera",
    ms < 50,
    `${ms.toFixed(1)} ms — se subir muito com as 41 regras, é este número que reabre a questão`
  );
}

console.log(falhas ? `\n${falhas} FALHA(S)` : "\nTudo certo.");
process.exit(falhas ? 1 : 0);
