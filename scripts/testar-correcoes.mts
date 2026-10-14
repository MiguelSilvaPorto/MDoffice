// Mede o corretor contra o corpus de `test/docs/gramatical.md`.
//
// Uso: node scripts/testar-correcoes.mts [--detalhe] [--caso=NN]
//
// Como funciona: empacota os módulos TS com o esbuild (mesmo padrão dos outros
// testes) e roda o pipeline REAL do app fora do navegador — `checkText`, o mesmo
// que o editor usa. O worker do dicionário roda com um shim de `self`/`fetch`/
// `Worker`, então o que é medido aqui é o comportamento do app, não uma cópia.
//
// O teste não julga estilo: cada caso só exige os erros OBJETIVOS do corpus
// (ortografia, acentuação, pontuação obrigatória, concordância, espaçamento).
import fs from "node:fs";
import { build } from "esbuild";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const raiz = new URL("..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const tmp = mkdtempSync(join(tmpdir(), "correcoes-"));

/**
 * O `?raw` do Vite, que o esbuild não conhece sozinho.
 *
 * As regras ABNT vivem em `src/broker/abnt/regras/*.toml` e entram no pacote como
 * texto (é assim que o app as carrega também). Sem este plugin, empacotar `check.ts`
 * falha no primeiro `.toml?raw`.
 */
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
      contents: fs.readFileSync(args.path, "utf8"),
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

// ---------------------------------------------------------------- corpus

interface Caso {
  numero: number;
  titulo: string;
  errado: string;
  esperado: string;
}

function lerCorpus(): Caso[] {
  const texto = fs.readFileSync(join(raiz, "test/docs/gramatical.md"), "utf8");
  const casos: Caso[] = [];
  for (const bloco of texto.split(/^## Caso /m).slice(1)) {
    const numero = +(bloco.match(/^(\d+)/)?.[1] ?? 0);
    const titulo = (bloco.match(/^\d+ — (.+)$/m)?.[1] ?? "").trim();
    const blocoDe = (rotulo: string): string | null => {
      const i = bloco.indexOf(`### ${rotulo}`);
      if (i < 0) return null;
      const m = bloco.slice(i).match(/````text\r?\n([\s\S]*?)\r?\n````/);
      return m ? m[1] : null;
    };
    const errado = blocoDe("Errado");
    const esperado = blocoDe("Esperado");
    if (errado === null || esperado === null) {
      console.error(`Caso ${numero}: falta o bloco Errado ou Esperado`);
      continue;
    }
    casos.push({ numero, titulo, errado, esperado });
  }
  return casos;
}

// ---------------------------------------------------------------- ambiente do navegador

type Ouvinte = (e: { data: unknown }) => void;
const ouvintesDoWorker: Ouvinte[] = [];
let workerAtual: { receber(msg: unknown): void } | null = null;

/** Recria o mínimo que o corretor espera do navegador (worker, fetch, storage). */
function instalarAmbiente(): void {
  const g = globalThis as unknown as Record<string, unknown>;
  const base = pathToFileURL(join(raiz, "public") + "/").href;

  g.self = {
    addEventListener: (tipo: string, fn: Ouvinte) => {
      if (tipo === "message") ouvintesDoWorker.push(fn);
    },
    // a resposta do worker volta por aqui
    postMessage: (msg: unknown) => workerAtual?.receber(msg),
    location: { href: base },
  };

  // o worker busca o dicionário por URL: aqui lemos direto do disco
  g.fetch = async (url: unknown) => {
    const u = new URL(String(url));
    const caminho = decodeURIComponent(u.pathname).replace(/^\/([A-Za-z]:)/, "$1");
    const conteudo = fs.readFileSync(caminho, "utf8");
    return {
      ok: true,
      status: 200,
      text: async () => conteudo,
      json: async () => JSON.parse(conteudo) as unknown,
    };
  };

  g.document = { baseURI: base };

  // `new Worker(...)` vira uma conversa direta com o módulo já carregado
  g.Worker = class {
    private meus: Ouvinte[] = [];
    constructor() {
      workerAtual = this;
    }
    addEventListener(tipo: string, fn: Ouvinte): void {
      if (tipo === "message") this.meus.push(fn);
    }
    removeEventListener(): void {
      /* não usado */
    }
    postMessage(msg: unknown): void {
      for (const fn of ouvintesDoWorker) fn({ data: msg });
    }
    receber(msg: unknown): void {
      for (const fn of this.meus) fn({ data: msg });
    }
    terminate(): void {
      /* não usado */
    }
  };

  const memoria = new Map<string, string>();
  g.localStorage = {
    getItem: (k: string) => memoria.get(k) ?? null,
    setItem: (k: string, v: string) => void memoria.set(k, v),
    removeItem: (k: string) => void memoria.delete(k),
  };
  g.window = { setTimeout, clearTimeout, setInterval, clearInterval };
}

// ---------------------------------------------------------------- correção

interface Mudanca {
  from: number;
  to: number;
  insert: string;
  origem: "estilo" | "ortografia";
}

interface Escolha {
  from: number;
  to: number;
  insert: string;
  origem: Mudanca["origem"];
}

/** Aplica as mudanças de trás para frente, sem sobrepor trechos. */
function aplicar(texto: string, mudancas: Escolha[]): string {
  const ordenadas = [...mudancas].sort((a, b) => b.from - a.from);
  let fimAnterior = Number.POSITIVE_INFINITY;
  let saida = texto;
  for (const m of ordenadas) {
    if (m.to > fimAnterior) continue; // sobrepõe a anterior: fica para a próxima rodada
    saida = saida.slice(0, m.from) + m.insert + saida.slice(m.to);
    fimAnterior = m.from;
  }
  return saida;
}

interface WritingIssue {
  from: number;
  to: number;
  word: string;
  kind: string;
  message: string;
  suggestions: string[];
  fix?: string;
  safe?: boolean;
  auto?: string;
}

interface Resultado {
  texto: string;
  mudancas: Mudanca[];
  avisos: WritingIssue[];
}

/**
 * Repete a correção até estabilizar: uma correção abre caminho para a seguinte
 * (é o mesmo laço do "Corrigir tudo" do app).
 */
async function corrigir(
  texto: string,
  checkText: (t: string, ignore: Set<string>) => Promise<WritingIssue[]>
): Promise<Resultado> {
  let atual = texto;
  const todas: Mudanca[] = [];
  const avisos: WritingIssue[] = [];
  for (let rodada = 0; rodada < 4; rodada++) {
    const issues = await checkText(atual, new Set());
    avisos.push(...issues);
    const escolhas: Escolha[] = [];
    for (const i of issues) {
      const insert = i.fix ?? i.auto;
      if (!insert) continue;
      escolhas.push({ from: i.from, to: i.to, insert, origem: i.kind === "spell" ? "ortografia" : "estilo" });
    }
    if (!escolhas.length) break;
    const antes = atual;
    atual = aplicar(atual, escolhas);
    todas.push(...escolhas.map((e) => ({ ...e, origem: e.origem })));
    if (atual === antes) break;
  }
  return { texto: atual, mudancas: todas, avisos };
}

// ---------------------------------------------------------------- main

const argumentos = process.argv.slice(2);
const detalhe = argumentos.includes("--detalhe");
const soCaso = +(argumentos.find((a) => a.startsWith("--caso="))?.split("=")[1] ?? 0);

const casos = lerCorpus().filter((c) => !soCaso || c.numero === soCaso);
console.log(`Corpus: ${casos.length} casos\n`);

instalarAmbiente();
await empacotar("src/broker/spell.worker.ts", "worker.mjs");
const C = await empacotar("src/broker/check.ts", "check.mjs");
const checkText = C.checkText as (t: string, ignore: Set<string>) => Promise<WritingIssue[]>;

// espera o dicionário carregar antes de medir (o app faz isso em segundo plano)
await new Promise((r) => setTimeout(r, 1500));

let passaram = 0;
let limpos = 0;
const falhas: { caso: Caso; obtido: string }[] = [];
const sujeiras: { caso: Caso; obtido: string }[] = [];

for (const caso of casos) {
  const r = await corrigir(caso.errado, checkText);
  const ok = r.texto.trim() === caso.esperado.trim();
  if (ok) {
    passaram++;
    console.log(`  ok   Caso ${String(caso.numero).padStart(2)} — ${caso.titulo}`);
  } else {
    falhas.push({ caso, obtido: r.texto });
    console.log(`  FALHA Caso ${String(caso.numero).padStart(2)} — ${caso.titulo}`);
    if (detalhe) {
      console.log(`        esperado: ${JSON.stringify(caso.esperado.trim())}`);
      console.log(`        obtido:   ${JSON.stringify(r.texto.trim())}`);
      const aplicadas = r.mudancas.map((m) => `${m.origem}:${JSON.stringify(caso.errado.slice(m.from, m.to))}->${JSON.stringify(m.insert)}`);
      console.log(`        aplicadas: ${aplicadas.length ? aplicadas.join("  ") : "(nenhuma)"}`);
      const naoAplicadas = r.avisos.filter((i) => !i.fix && !i.auto).map((i) => `${i.kind}:${JSON.stringify(i.word)} (${i.suggestions.slice(0, 3).join(", ")})`);
      console.log(`        só avisos: ${naoAplicadas.length ? naoAplicadas.join("  ") : "(nenhum)"}`);
    }
  }

  // Falso positivo: o texto JÁ CORRETO não pode ser mexido. Uma regra que
  // "conserta" o que está certo é pior que uma que não acha o erro.
  const limpo = await corrigir(caso.esperado, checkText);
  if (limpo.texto.trim() !== caso.esperado.trim()) {
    sujeiras.push({ caso, obtido: limpo.texto });
    console.log(`  SUJEIRA Caso ${String(caso.numero).padStart(2)} — mexeu no texto correto`);
    if (detalhe) {
      console.log(`        correto:  ${JSON.stringify(caso.esperado.trim())}`);
      console.log(`        virou:    ${JSON.stringify(limpo.texto.trim())}`);
      const aplicadas = limpo.mudancas.map((m) => `${m.origem}:${JSON.stringify(caso.esperado.slice(m.from, m.to))}->${JSON.stringify(m.insert)}`);
      console.log(`        aplicadas: ${aplicadas.join("  ")}`);
    }
  } else {
    limpos++;
  }
}

// ---------------------------------------------------------------- aprendizado

// Prova de ponta a ponta: uma troca que a pessoa aceita passa a ser conhecida
// pelo corretor. Antes de aceitar, a palavra inventada não tem correção
// confiável; depois de aceita algumas vezes, o corretor aplica sozinho.
console.log("\n=== aprendizado com o uso ===");
{
  // Um bundle só: empacotar `check.ts` e `aprendizado.ts` separadamente daria a
  // cada um a sua própria cópia do módulo, e o registro não chegaria ao corretor.
  const entrada = join(tmp, "junto.ts");
  const caminho = (p: string) => join(raiz, p).replace(/\\/g, "/");
  fs.writeFileSync(
    entrada,
    `export { checkText } from "${caminho("src/broker/check.ts")}";\n` +
      `export { registrarCorrecao, correcoesConfiadas, limparAprendizado } from "${caminho("src/broker/aprendizado.ts")}";\n`
  );
  const J = await (async () => {
    const saida = join(tmp, "junto.mjs");
    await build({
      entryPoints: [entrada],
      bundle: true,
      platform: "node",
      format: "esm",
      outfile: saida,
      logLevel: "error",
      plugins: [pluginRaw as never],
    });
    return import(pathToFileURL(saida).href);
  })();
  const checkJunto = J.checkText as typeof checkText;

  const inventada = "xilofraste";
  const correta = "xilofone";
  const frase = `O ${inventada} chegou ontem.`;

  const antes = await corrigir(frase, checkJunto);
  const conhecidaAntes = antes.texto.includes(correta);
  console.log(`  antes de aceitar:  ${JSON.stringify(antes.texto.trim())}`);

  J.registrarCorrecao(inventada, correta);
  const depoisDeUma = await corrigir(frase, checkJunto);
  console.log(`  após 1 aceite:     ${JSON.stringify(depoisDeUma.texto.trim())}`);

  J.registrarCorrecao(inventada, correta);
  await new Promise((r) => setTimeout(r, 300));
  const depoisDeDuas = await corrigir(frase, checkJunto);
  const conhecidaDepois = depoisDeDuas.texto.includes(correta);
  console.log(`  após 2 aceites:    ${JSON.stringify(depoisDeDuas.texto.trim())}`);

  const ok = !conhecidaAntes && conhecidaDepois;
  console.log(ok ? "  ok   o corretor passou a aplicar a troca aprendida" : "  FALHA o aprendizado não chegou ao corretor");
  if (!ok) falhas.push({ caso: { numero: 0, titulo: "aprendizado com o uso", errado: frase, esperado: frase }, obtido: depoisDeDuas.texto });
}

console.log(`\n${passaram}/${casos.length} casos corrigidos`);
console.log(`${limpos}/${casos.length} textos corretos preservados` + (sujeiras.length ? `  (${sujeiras.length} sujaram)` : ""));
if (falhas.length) {
  console.log("\nNão corrigidos:");
  for (const f of falhas) console.log(`  Caso ${String(f.caso.numero).padStart(2)} — ${f.caso.titulo}`);
}
if (sujeiras.length) {
  console.log("\nFalsos positivos:");
  for (const s of sujeiras) console.log(`  Caso ${String(s.caso.numero).padStart(2)} — ${s.caso.titulo}`);
}
process.exit(falhas.length || sujeiras.length ? 1 : 0);
