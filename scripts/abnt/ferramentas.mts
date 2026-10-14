// ABNT — o ajudante dos testes das regras.
//
// Todo teste de regra ABNT faz o mesmo: empacota um módulo de `src/` com o plugin dos
// `.toml?raw`, roda regras contra um texto e confere avisos. Isto aqui é isso, uma vez
// só — o teste de cada grupo não copia o mesmo bloco (e o plugin `?raw` existe num
// lugar só, que foi onde ele já falhou por estar duplicado).
//
// Uso típico (scripts/testar-abnt-<grupo>.mts):
//
//   import { checa, fim, regrasDe, rodar } from "./abnt/ferramentas.mts";
//   const regras = await regrasDe("abnt.c");
//   const avisos = await rodar("texto (Silva)", regras);
//   checa("acusa sem o ano", avisos.length === 1, JSON.stringify(avisos));
//   fim();
//
// Para verificador, `verificar(nome, texto, opcoes)` roda o verificador direto; para o
// modelo do documento, `documento(texto)`.

import fs from "node:fs";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { build } from "esbuild";

const raiz = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const modulos = new Map<string, unknown>();

/** Empacota um módulo de `src/` (com os `.toml?raw` dentro) e o importa. */
export async function empacotar(rel: string): Promise<Record<string, any>> {
  const guardado = modulos.get(rel);
  if (guardado) return guardado as Record<string, any>;
  const destino = mkdtempSync(join(tmpdir(), "abnt-"));
  const saida = join(destino, "modulo.mjs");
  await build({
    entryPoints: [join(raiz, rel)],
    bundle: true,
    outfile: saida,
    format: "esm",
    platform: "node",
    target: "node20",
    logLevel: "silent",
    plugins: [
      {
        name: "toml-raw",
        setup(b) {
          b.onResolve({ filter: /\?raw$/ }, (a) => ({
            path: resolve(dirname(a.importer), a.path.replace(/\?raw$/, "")),
            namespace: "toml-raw",
          }));
          b.onLoad({ filter: /.*/, namespace: "toml-raw" }, (a) => ({
            contents: `export default ${JSON.stringify(fs.readFileSync(a.path, "utf8"))};`,
            loader: "js",
          }));
        },
      },
    ],
  });
  const modulo = await import(pathToFileURL(saida).href);
  modulos.set(rel, modulo);
  return modulo as Record<string, any>;
}

let total = 0;
let falhas = 0;

export function checa(nome: string, ok: boolean, detalhe?: string): void {
  total++;
  if (ok) {
    console.log(`  ok   ${nome}`);
  } else {
    falhas++;
    console.log(`  FALHA ${nome}${detalhe !== undefined ? ` — ${detalhe}` : ""}`);
  }
}

export function fim(): void {
  console.log(falhas ? `\n${falhas} FALHA(S) de ${total}` : `\nTudo certo (${total} checagens).`);
  process.exit(falhas ? 1 : 0);
}

/** As regras em TOML do app (opcionalmente só as de um prefixo de id). */
export async function regrasCruas(prefixo?: string): Promise<any[]> {
  const I = await empacotar("src/broker/abnt/index.ts");
  const cruas: any[] = I.carregarRegras();
  return prefixo ? cruas.filter((r) => String(r.id).startsWith(prefixo)) : cruas;
}

/** As regras prontas para rodar (mesmo caminho do app: `regraDeToml`). */
export async function regrasDe(prefixo?: string): Promise<any[]> {
  const I = await empacotar("src/broker/abnt/index.ts");
  return (await regrasCruas(prefixo)).map((r) => I.regraDeToml(r));
}

export interface AvisoRodado {
  from: number;
  to: number;
  mensagem: string;
  fix?: string;
  sugestoes: string[];
  safe: boolean;
}

/** Roda regras contra um texto, com a mesma máscara do app. */
export async function rodar(texto: string, regras: any[]): Promise<AvisoRodado[]> {
  const M = await empacotar("src/broker/mask.ts");
  const mask = M.maskNonProse(texto);
  const avisos: AvisoRodado[] = [];
  const ctx = {
    text: texto,
    mask,
    push: (from: number, to: number, mensagem: string, fix?: string, sugestoes?: string[], safe?: boolean) => {
      avisos.push({ from, to, mensagem, fix, sugestoes: sugestoes ?? [], safe: safe === true });
    },
  };
  for (const regra of regras) regra(ctx);
  return avisos.sort((a, b) => a.from - b.from);
}

/** O modelo do documento (títulos, linhas, parágrafos, blocos). */
export async function documento(texto: string): Promise<any> {
  const I = await empacotar("src/broker/abnt/index.ts");
  return I.documentoDe(texto);
}

/** Roda um verificador direto, com opções de teste. */
export async function verificar(nome: string, texto: string, opcoes: Record<string, unknown> = {}): Promise<any[]> {
  const I = await empacotar("src/broker/abnt/index.ts");
  const doc = I.documentoDe(texto);
  const impl = I.verificador(nome);
  return impl(doc, { id: "teste", norma: "teste", grupo: "teste", severidade: "warning", verifica: nome, opcoes });
}
