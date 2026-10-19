// Mede o corretor de escrita contra os pares formal/informal de `tests/escrita/rodada-N/`.
//
// Uso:
//   node scripts/testar-escrita.mjs                 # todas as rodadas
//   node scripts/testar-escrita.mjs --rodada=1
//   node scripts/testar-escrita.mjs --detalhe       # mostra os casos que falharam
//   node scripts/testar-escrita.mjs --limite=10     # só 10 blocos por arquivo (desenvolvimento)
//   node scripts/testar-escrita.mjs --amostra=60    # pausas amostradas na sonda A2
//   node scripts/testar-escrita.mjs --saida         # grava os textos corrigidos em saida/
//
// Duas réguas:
//
// A — DIGITAÇÃO. Simula a pausa em cada fronteira de palavra e no meio da palavra.
//     Exige ZERO alteração automática no texto informal (o regime sem acento é
//     detectado: só sugestões). A sonda A2 força a correção automática (prelúdio
//     acentuado) e conta o que mudaria — para achar "correção lixo" escondida atrás
//     do regime.
//
// B — CORREÇÃO FORMAL (ação explícita). Aplica `corrigirFormal` (só forma: acento,
//     pontuação, espaço, maiúscula) e exige:
//       * a sequência de palavras (sem acento/caixa) não muda — nada de troca lexical,
//         remoção ou reordenação;
//       * o número de parágrafos é o mesmo dos blocos;
//       * toda forma acentuada que o gabarito conhece bate com o gabarito.
//     Também mede a cobertura: quantas palavras o gabarito acentua e a correção deixou.
import { build } from "esbuild";
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const raiz = new URL("..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const tmp = mkdtempSync(join(tmpdir(), "escrita-"));

const argumentos = process.argv.slice(2);
const detalhe = argumentos.includes("--detalhe");
const salvar = argumentos.includes("--saida");
const soRodada = +(argumentos.find((a) => a.startsWith("--rodada="))?.split("=")[1] ?? 0);
const soAgente = argumentos.find((a) => a.startsWith("--agente="))?.split("=")[1] ?? "";
const limite = +(argumentos.find((a) => a.startsWith("--limite="))?.split("=")[1] ?? 0);
const amostra = +(argumentos.find((a) => a.startsWith("--amostra="))?.split("=")[1] ?? 80);

// ---------------------------------------------------------------- esbuild

/** O `?raw` do Vite, que o esbuild não conhece sozinho (regras ABNT em .toml). */
const pluginRaw = {
  name: "raw",
  setup(api) {
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

const empacotar = async (conteudo, saida) => {
  await build({
    stdin: { contents: conteudo, resolveDir: raiz, loader: "ts" },
    bundle: true,
    platform: "node",
    format: "esm",
    outfile: join(tmp, saida),
    logLevel: "error",
    plugins: [pluginRaw],
  });
  return import(pathToFileURL(join(tmp, saida)).href);
};

const empacotarArquivo = async (entrada, saida) => {
  await build({
    entryPoints: [join(raiz, entrada)],
    bundle: true,
    platform: "node",
    format: "esm",
    outfile: join(tmp, saida),
    logLevel: "error",
    plugins: [pluginRaw],
  });
  return import(pathToFileURL(join(tmp, saida)).href);
};

// ---------------------------------------------------------------- ambiente do navegador

const ouvintesDoWorker = [];
let workerAtual = null;

/** O mínimo que o corretor espera do navegador (worker, fetch, storage). */
function instalarAmbiente() {
  const g = globalThis;
  const base = pathToFileURL(join(raiz, "public") + "/").href;
  g.self = {
    addEventListener: (tipo, fn) => {
      if (tipo === "message") ouvintesDoWorker.push(fn);
    },
    postMessage: (msg) => workerAtual?.receber(msg),
    location: { href: base },
  };
  g.fetch = async (url) => {
    const u = new URL(String(url));
    const caminho = decodeURIComponent(u.pathname).replace(/^\/([A-Za-z]:)/, "$1");
    const conteudo = readFileSync(caminho, "utf8");
    return {
      ok: true,
      status: 200,
      text: async () => conteudo,
      json: async () => JSON.parse(conteudo),
    };
  };
  g.document = { baseURI: base };
  g.Worker = class {
    constructor() {
      workerAtual = this;
    }
    addEventListener(tipo, fn) {
      if (tipo === "message") this.meus ??= [];
      if (tipo === "message") this.meus.push(fn);
    }
    removeEventListener() {}
    postMessage(msg) {
      for (const fn of ouvintesDoWorker) fn({ data: msg });
    }
    receber(msg) {
      for (const fn of this.meus ?? []) fn({ data: msg });
    }
    terminate() {}
  };
  const memoria = new Map();
  g.localStorage = {
    getItem: (k) => memoria.get(k) ?? null,
    setItem: (k, v) => void memoria.set(k, v),
    removeItem: (k) => void memoria.delete(k),
  };
  g.window = { setTimeout, clearTimeout, setInterval, clearInterval };
}

instalarAmbiente();
await empacotarArquivo("src/broker/spell.worker.ts", "worker.mjs");
const E = await empacotar(
  `export { checkText } from "./src/broker/check.ts";
   export { planejarCorrecaoFormal, corrigirFormal, esqueleto, contarPalavras } from "./src/broker/formal.ts";
   export { usaAcentos } from "./src/broker/regime.ts";`,
  "escrita.mjs"
);
// espera o dicionário carregar (o app faz isso em segundo plano)
await new Promise((r) => setTimeout(r, 1500));

const { checkText, corrigirFormal, esqueleto, contarPalavras, usaAcentos } = E;

// ---------------------------------------------------------------- corpus

const RODADAS = join(raiz, "tests", "escrita");

function rodadas() {
  if (!existsSync(RODADAS)) return [];
  return readdirSync(RODADAS)
    .filter((n) => /^rodada-\d+$/.test(n))
    .map((n) => +n.split("-")[1])
    .filter((n) => !soRodada || n === soRodada)
    .sort((a, b) => a - b);
}

function pares(rodada) {
  const pasta = join(RODADAS, `rodada-${rodada}`);
  const saida = [];
  for (const nome of readdirSync(pasta).sort()) {
    const m = nome.match(/^agente-(\d+)-formal\.txt$/);
    if (!m) continue;
    if (soAgente && m[1] !== soAgente) continue;
    const informal = join(pasta, `agente-${m[1]}-informal.txt`);
    if (!existsSync(informal)) continue;
    saida.push({ agente: m[1], formal: join(pasta, nome), informal });
  }
  return saida;
}

const ler = (caminho) => readFileSync(caminho, "utf8").replace(/^\uFEFF/, "").replace(/\r\n/g, "\n");

/** Blocos do informal: linhas não vazias (uma por bloco, no lençol do corpus). */
const blocos = (texto) => texto.split(/\n\s*\n/).map((b) => b.trim()).filter(Boolean);

/** Parágrafos do formal: exclui título/seções (linhas curtas em caixa alta, ≤8 palavras). */
function paragrafosFormais(texto) {
  const todos = blocos(texto);
  return todos.filter((p) => {
    const palavras = (p.match(/\S+/g) ?? []).length;
    return !(palavras <= 8 && p === p.toUpperCase() && !/[.!?]$/.test(p));
  });
}

const palavras = (texto) => texto.match(/[\p{Letter}\p{Number}]+/gu) ?? [];

/** Sequência de palavras comparável: sem acento, sem caixa (a correção formal não troca palavra). */
const sequencia = (texto) => palavras(texto).map((p) => esqueleto(p));

const DIACRITICO = /[\u00C0-\u024F\u1E00-\u1EFF]/;

/** Mapa: palavra sem acento → formas que o gabarito usa (com e sem acento). */
function formasDoGabarito(formal) {
  const mapa = new Map();
  for (const p of palavras(formal)) {
    const chave = esqueleto(p);
    if (!chave) continue;
    if (!mapa.has(chave)) mapa.set(chave, new Set());
    mapa.get(chave).add(p.toLowerCase());
  }
  return mapa;
}

/** A mudança só mexe em diacríticos (mesmas letras, mesma caixa, sem pontuação nova)? */
function soAcento(antes, depois) {
  if (antes === depois) return false;
  const tira = (s) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  return tira(antes) === tira(depois);
}

// ---------------------------------------------------------------- política da pausa

const ESTRUTURAIS = new Set(["quebra-frase", "trecho-longo", "frase-longa"]);
const REGISTRO = new Set(["giria", "internetes", "contracao", "muleta", "oralidade", "atenuacao", "redundancia", "vagueza", "cliche"]);

/**
 * O que a varredura automática aplicaria com estas issues e este cursor — a mesma
 * política de `planejarVarredura` + `autoFixWords` (palavra sob o cursor nunca;
 * ortografia só atrás do cursor e dentro do parágrafo).
 */
function planejado(issues, texto, pos, parFrom) {
  const lista = [];
  for (const i of issues) {
    if (i.kind === "spell") {
      if (!i.auto) continue;
      if (!(i.to < pos)) continue;
      if (i.from < parFrom) continue;
      if (texto.slice(i.from, i.to) !== i.word) continue;
      lista.push({ from: i.from, to: i.to, insert: i.auto, issue: i, origem: "ortografia" });
      continue;
    }
    if (i.fix === undefined) continue;
    if (ESTRUTURAIS.has(i.classe)) continue;
    if (i.classe && REGISTRO.has(i.classe)) continue;
    if (i.from < pos && pos < i.to) continue;
    lista.push({ from: i.from, to: i.to, insert: i.fix, issue: i, origem: "estilo" });
  }
  return lista;
}

/** Aplica sem sobrepor (a mesma regra do editor: o maior vence). */
function aplicar(texto, correcoes) {
  const safe = [];
  for (const c of [...correcoes].sort((a, b) => a.from - b.from || b.to - a.to)) {
    const ultimo = safe[safe.length - 1];
    if (ultimo && c.from < ultimo.to) {
      if (c.to - c.from > ultimo.to - ultimo.from) safe[safe.length - 1] = c;
      continue;
    }
    safe.push(c);
  }
  let saida = texto;
  for (const c of [...safe].sort((a, b) => b.from - a.from)) saida = saida.slice(0, c.from) + c.insert + saida.slice(c.to);
  return saida;
}

const inicioDoParagrafo = (texto, pos) => texto.lastIndexOf("\n\n", Math.max(0, pos - 1)) + 2;

// ---------------------------------------------------------------- medição

let falhas = 0;
const ok = (nome, cond, detalheTxt = "") => {
  if (!cond) falhas++;
  console.log(`${cond ? "OK   " : "FALHA"} ${nome}${detalheTxt ? `  ${detalheTxt}` : ""}`);
};

const exemplos = { A: [], A2: [], B: [] };
const anotar = (o) => {
  const lista = exemplos[o.regua] ?? (exemplos[o.regua] = []);
  if (lista.length < 40) lista.push(o);
};

console.log("Corretor de escrita — pares formal/informal\n");

for (const rodada of rodadas()) {
  for (const par of pares(rodada)) {
    const formal = ler(par.formal);
    const informal = ler(par.informal);
    const bInformal = blocos(informal);
    const pFormal = paragrafosFormais(formal);
    const nome = `rodada ${rodada} · agente ${par.agente}`;
    console.log(`\n=== ${nome} ===`);
    console.log(`informal: ${palavras(informal).length} palavras, ${bInformal.length} blocos · formal: ${palavras(formal).length} palavras, ${pFormal.length} parágrafos`);

    // ---- lençol do corpus
    ok("corpus: blocos = parágrafos", bInformal.length === pFormal.length, `${bInformal.length} × ${pFormal.length}`);
    const acentuadas = palavras(informal).filter((p) => DIACRITICO.test(p));
    ok("corpus: informal sem acento/ç", acentuadas.length === 0, acentuadas.length ? `${acentuadas.length} palavra(s)` : "");
    ok("corpus: informal sem ponto/vírgula", !/[.,]/.test(informal));

    // ---- A: digitação (regime sem acento = só sugestão)
    {
      const alvos = limite ? bInformal.slice(0, limite) : bInformal;
      let pausas = 0;
      let alteracoes = 0;
      for (let bi = 0; bi < alvos.length; bi++) {
        const bloco = alvos[bi];
        const anterior = bi > 0 ? alvos[bi - 1].split(/\s+/).slice(-60).join(" ") + " " : "";
        const doc = anterior + bloco;
        const base = anterior.length;
        const pontos = new Set();
        for (const m of bloco.matchAll(/\S+/g)) {
          const a = base + m.index;
          const b = a + m[0].length;
          pontos.add(a + 1);
          pontos.add(b);
          if (b < doc.length) pontos.add(b + 1);
        }
        for (const pos of [...pontos].sort((x, y) => x - y)) {
          pausas++;
          const texto = doc.slice(0, pos);
          if (!usaAcentos(texto)) continue; // o app fica quieto: zero alteração por definição
          const issues = await checkText(texto, new Set());
          const parFrom = inicioDoParagrafo(texto, pos);
          const correcoes = planejado(issues, texto, pos, parFrom);
          const depois = aplicar(texto, correcoes);
          if (depois !== texto) {
            alteracoes++;
            anotar({ regua: "A", nome, pos, antes: texto.slice(Math.max(0, pos - 40), pos), depois: depois.slice(Math.max(0, pos - 40)) });
          }
        }
      }
      ok(`A · digitação: zero alteração automática`, alteracoes === 0, `${pausas} pausas, ${alteracoes} alteração(ões)`);
    }

    // ---- A2 (sonda): com a correção automática forçada, o que mudaria?
    {
      const texto = informal;
      const issues = await checkText(texto, new Set());
      const todas = [...texto.matchAll(/\S+/g)];
      const passo = Math.max(1, Math.floor(todas.length / Math.max(1, amostra)));
      // o que CADA correção faria (uma vez só — a pausa repete a varredura no documento todo)
      const vistos = new Map();
      for (let k = passo; k < todas.length; k += passo) {
        const pos = todas[k].index;
        const parFrom = inicioDoParagrafo(texto, pos);
        for (const c of planejado(issues, texto, pos, parFrom)) {
          const trecho = texto.slice(c.from, c.to);
          if (c.insert === trecho) continue;
          const chave = `${c.from}|${c.to}|${c.insert}`;
          if (!vistos.has(chave)) vistos.set(chave, { trecho, insert: c.insert, issue: c.issue, origem: c.origem });
        }
      }
      let acentos = 0;
      let outros = 0;
      const tipos = new Map();
      for (const c of vistos.values()) {
        if (soAcento(c.trecho, c.insert)) {
          acentos++;
          continue;
        }
        outros++;
        const chave = `${c.origem}: ${c.issue.message}`;
        tipos.set(chave, (tipos.get(chave) ?? 0) + 1);
        anotar({ regua: "A2", nome, trecho: c.trecho, insert: c.insert, regra: c.issue.message, origem: c.origem });
      }
      console.log(`  A2 sonda (automática forçada): ${acentos} acento(s) previsto(s), ${outros} mudança(s) que não são acento`);
      if (outros && detalhe) {
        const top = [...tipos.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
        for (const [tipo, n] of top) console.log(`       ${String(n).padStart(4)} × ${tipo}`);
      }
    }

    // ---- B: correção formal explícita
    {
      const r = await corrigirFormal(informal, (t) => checkText(t, new Set(), { curtas: true }), 6);
      const seqAntes = sequencia(informal);
      const seqDepois = sequencia(r.texto);
      let primeiraDiferenca = -1;
      const n = Math.min(seqAntes.length, seqDepois.length);
      for (let i = 0; i < n; i++) {
        if (seqAntes[i] !== seqDepois[i]) {
          primeiraDiferenca = i;
          break;
        }
      }
      if (primeiraDiferenca < 0 && seqAntes.length !== seqDepois.length) primeiraDiferenca = n;
      ok(
        "B · palavras: nenhuma troca/remoção/reordenação",
        primeiraDiferenca < 0,
        `${r.mudancas} ajuste(s) em ${r.rodadas} rodada(s)`
      );
      if (primeiraDiferenca >= 0) {
        const ctx = (seq) => seq.slice(Math.max(0, primeiraDiferenca - 4), primeiraDiferenca + 5).join(" ");
        anotar({ regua: "B", nome, tipo: "palavras", antes: ctx(seqAntes), depois: ctx(seqDepois), indice: primeiraDiferenca });
        if (detalhe) console.log(`       divergência na palavra ${primeiraDiferenca}: “${ctx(seqAntes)}” → “${ctx(seqDepois)}”`);
      }

      const bDepois = blocos(r.texto).length;
      ok("B · parágrafos preservados", bDepois === bInformal.length, `${bInformal.length} blocos → ${bDepois} parágrafos`);

      // A comparação de acento é BLOCO A BLOCO: o gabarito de cada parágrafo formal
      // diz quais formas aquela passagem usa. Comparar o arquivo inteiro misturava
      // "e" (conjunção) com "é" (verbo) de outras passagens e acusava falta onde a
      // própria passagem não acentua.
      const blocosCorrigidos = blocos(r.texto);
      let conferidas = 0;
      let divergentes = 0;
      let naoComparaveis = 0;
      let faltando = 0;
      const faltandoPor = new Map();
      for (let bi = 0; bi < bInformal.length; bi++) {
        const forms = formasDoGabarito(pFormal[bi] ?? "");
        const antesP = palavras(bInformal[bi]);
        const depoisP = palavras(blocosCorrigidos[bi] ?? "");
        for (let i = 0; i < Math.min(antesP.length, depoisP.length); i++) {
          const base = esqueleto(antesP[i]);
          const formas = forms.get(base);
          if (!formas) {
            naoComparaveis++;
            continue;
          }
          const produzida = depoisP[i].toLowerCase();
          if (DIACRITICO.test(produzida)) {
            conferidas++;
            if (!formas.has(produzida)) {
              divergentes++;
              anotar({ regua: "B", nome, tipo: "acento", palavra: depoisP[i], esperado: [...formas].join(" / "), antes: antesP[i] });
              if (detalhe) console.log(`       acento divergente: “${antesP[i]}” → “${depoisP[i]}” (gabarito: ${[...formas].join(" / ")})`);
            }
          } else if (!formas.has(produzida) && [...formas].every((f) => DIACRITICO.test(f))) {
            faltando++;
            faltandoPor.set(antesP[i].toLowerCase(), (faltandoPor.get(antesP[i].toLowerCase()) ?? 0) + 1);
          }
        }
      }
      console.log(
        `  B · acentos: ${conferidas} conferido(s) com o gabarito, ${divergentes} divergente(s), ${faltando} faltando, ${naoComparaveis} fora da comparação`
      );
      if (detalhe && faltandoPor.size) {
        const top = [...faltandoPor.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15);
        console.log(`       faltando: ${top.map(([p, n]) => `${p}×${n}`).join(", ")}`);
      }
      ok("B · formas acentuadas batem com o gabarito", divergentes === 0, `${divergentes} divergência(s)`);
      // Cobertura é MÉTRICA, não veredito: "sai" × "saí", "as" × "às" e "esta" × "está"
      // dependem do sentido da frase — o gabarito sabe, o corretor automático não.
      console.log(`  B · cobertura de acentos: ${((1 - faltando / Math.max(1, faltando + conferidas)) * 100).toFixed(1)}% (${faltando} ambiguidade(s) restante(s))`);

      if (salvar) {
        const pasta = join(RODADAS, `rodada-${rodada}`, "saida");
        mkdirSync(pasta, { recursive: true });
        writeFileSync(join(pasta, `agente-${par.agente}-corrigido.txt`), r.texto, "utf8");
      }
    }
  }
}

// ---------------------------------------------------------------- resumo

console.log("\n================ resumo ================");
const todos = [...exemplos.A, ...exemplos.A2, ...exemplos.B];
if (todos.length) {
  console.log(`exemplos anotados: A=${exemplos.A.length}, A2=${exemplos.A2.length}, B=${exemplos.B.length} (use --detalhe)`);
  for (const e of todos.slice(0, detalhe ? 120 : 0)) {
    if (e.regua === "B" && e.tipo === "acento") {
      console.log(`  B acento: “${e.antes}” → “${e.palavra}” (gabarito ${e.esperado})`);
    } else if (e.regua === "B") {
      console.log(`  B palavras: “${e.antes}” → “${e.depois}”`);
    } else if (e.regua === "A2") {
      console.log(`  A2 ${e.origem}: “${e.trecho}” → “${e.insert}”  (${e.regra})`);
    } else {
      console.log(`  A: alteração perto de “…${e.antes}” → “…${e.depois}”`);
    }
  }
}
console.log(falhas === 0 ? "\nTUDO PASSOU" : `\n${falhas} verificação(ões) falharam`);
process.exit(falhas === 0 ? 0 : 1);
