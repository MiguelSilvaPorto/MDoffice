// A cadeia inteira do modelo de idioma, num comando: baixa o corpus (retomável), conta os
// n-gramas e deriva os dois arquivos que o app usa. O download é a parte longa (a Wikipédia
// pede ritmo educado); rodar de novo continua de onde parou.
//
// Uso: node scripts/regerar-ngrams.mjs [--mb=30] [--vocab=30000] [--trimin=6] [--web=400]
//
// Depois de rodar, o juiz é o harness: `node scripts/avaliar-correcao.mts` (com e sem
// `--sem-modelo`) e `npm run test:correcao`; se os números piorarem, dá para voltar o modelo
// guardando uma cópia de `public/ngrams` antes (os JSONs não são versionados; ver o LEIA.md).
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const raiz = dirname(dirname(fileURLToPath(import.meta.url)));
const args = process.argv.slice(2);
const opt = Object.fromEntries(args.filter((a) => a.startsWith("--")).map((a) => a.slice(2).split("=")));

/** [arquivo, vocabulário, trimin, sucessores do bigrama, do trigrama] de cada nível (ver MODELOS em ghost/model.ts). */
const NIVEIS = /** @type {[string, number, number, number, number][]} */ ([
  ["pt-40.json", 30000, 6, 40, 10],
  ["pt-80.json", 50000, 3, 80, 20],
  ["pt-160.json", 80000, 2, 160, 40],
]);

// Os níveis saem de TEXTO DA WEB (FineWeb-2: blogs, notícias, sites de empresas e órgãos públicos),
// não da Wikipédia: com a Wikipédia, "Bom " virava "Bom Jesus" (cidade) e "Tecnologia da " perdia
// "informação". Baixa uma vez (~74 MB em 400 lotes); as posições são sorteadas, então refazer muda o texto.
const WEB = "corpus-web/web.txt";

const passos = [
  ["baixar o corpus (retomável)", ["scripts/baixar-corpus.mjs", `--mb=${opt.mb ?? 30}`]],
  ["contar os n-gramas", ["scripts/build-ngrams.mjs", "public/ngrams/pt.json", "corpus", `--vocab=${opt.vocab ?? 30000}`, `--trimin=${opt.trimin ?? 6}`]],
  // os níveis da sugestão (Configurações → Modelo de palavras): guardam mais palavras seguintes, um
  // vocabulário maior e sequências mais raras. Medido no eval-ghost (parágrafos da web separados do
  // treino, documento novo): pt.json 19,8% de economia → básico 21,6% · médio 22,9% · alto 23,8%.
  ...(existsSync(join(raiz, WEB)) ? [] : [["baixar o texto da web (FineWeb-2)", ["scripts/fetch-corpus-web.mjs", WEB, String(opt.web ?? 400), "6000"]]]),
  ...NIVEIS.map(([arq, vocab, trimin, b, t]) => [`contar o modelo ${arq}`, ["--max-old-space-size=12000", "scripts/build-ngrams.mjs", `public/ngrams/${arq}`, WEB, `--vocab=${vocab}`, `--trimin=${trimin}`, `--bi=${b}`, `--tri=${t}`]]),
  ["derivar o contexto do corretor", ["scripts/gerar-contexto.mjs"]],
  ["derivar a frequência", ["scripts/gerar-frequencia.mjs"]],
];

mkdirSync(join(raiz, "corpus-web"), { recursive: true });
for (const [nome, argv] of passos) {
  console.error(`\n— ${nome} —`);
  const r = spawnSync(process.execPath, argv, { cwd: raiz, stdio: "inherit" });
  if (r.status !== 0) {
    console.error(`\nparou em “${nome}” (código ${r.status ?? "?"}).`);
    process.exit(r.status ?? 1);
  }
}

const mb = (p) => {
  try {
    return `${(statSync(join(raiz, p)).size / 1024 / 1024).toFixed(2)} MB`;
  } catch {
    return "—";
  }
};
console.error(
  `\nmodelo pronto: pt.json ${mb("public/ngrams/pt.json")} · pt-40 ${mb("public/ngrams/pt-40.json")} · pt-80 ${mb("public/ngrams/pt-80.json")} · pt-160 ${mb("public/ngrams/pt-160.json")} · ctx-pt.json ${mb("public/ngrams/ctx-pt.json")} · freq-pt.json ${mb("public/ngrams/freq-pt.json")}`
);
console.error("agora meça: node scripts/avaliar-correcao.mts  (e com --sem-modelo, para comparar) · npm run test:correcao");
