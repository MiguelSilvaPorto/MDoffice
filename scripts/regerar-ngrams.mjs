// A cadeia inteira do modelo de idioma, num comando: baixa o corpus (retomável), conta os
// n-gramas e deriva os dois arquivos que o app usa. O download é a parte longa (a Wikipédia
// pede ritmo educado); rodar de novo continua de onde parou.
//
// Uso: node scripts/regerar-ngrams.mjs [--mb=30] [--vocab=30000] [--trimin=6]
//
// Depois de rodar, o juiz é o harness: `node scripts/avaliar-correcao.mts` (com e sem
// `--sem-modelo`) e `npm run test:correcao`; se os números piorarem, dá para voltar o modelo
// guardando uma cópia de `public/ngrams` antes (os JSONs não são versionados; ver o LEIA.md).
import { spawnSync } from "node:child_process";
import { statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const raiz = dirname(dirname(fileURLToPath(import.meta.url)));
const args = process.argv.slice(2);
const opt = Object.fromEntries(args.filter((a) => a.startsWith("--")).map((a) => a.slice(2).split("=")));

const passos = [
  ["baixar o corpus (retomável)", ["scripts/baixar-corpus.mjs", `--mb=${opt.mb ?? 30}`]],
  ["contar os n-gramas", ["scripts/build-ngrams.mjs", "public/ngrams/pt.json", "corpus", `--vocab=${opt.vocab ?? 30000}`, `--trimin=${opt.trimin ?? 6}`]],
  ["derivar o contexto do corretor", ["scripts/gerar-contexto.mjs"]],
  ["derivar a frequência", ["scripts/gerar-frequencia.mjs"]],
];

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
  `\nmodelo pronto: pt.json ${mb("public/ngrams/pt.json")} · ctx-pt.json ${mb("public/ngrams/ctx-pt.json")} · freq-pt.json ${mb("public/ngrams/freq-pt.json")}`
);
console.error("agora meça: node scripts/avaliar-correcao.mts  (e com --sem-modelo, para comparar) · npm run test:correcao");
