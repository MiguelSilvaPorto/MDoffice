// Baixa um corpus de português da Wikipédia (pt.wikipedia.org, CC BY-SA 4.0) para regerar os
// n-gramas do app (`node scripts/build-ngrams.mjs`). Só o TEXTO dos artigos é gravado, em
// `corpus/` (fora do Git): o modelo que vai para o app guarda **contagens**, nunca trechos.
//
// Uso:
//   node scripts/baixar-corpus.mjs [--mb=30] [--saida=corpus] [--min=1500]
//   node scripts/baixar-corpus.mjs --titulos=scripts/corpus-wikipedia.txt   (redo determinístico)
//
// As fontes de títulos são os artigos **destacados e bons** (a nata da Wikipédia, longos e bem
// escritos) e, se precisar de mais, os **mais lidos** — em todos, só o domínio principal.
//
// Por que a REST (`/api/rest_v1/page/html/…`) e não `prop=extracts`: a API de extratos só
// devolve **um** extrato completo por pedido (`exlimit` só vale com `exintro`), então em lote
// vinha quase tudo vazio e o rendimento era péssimo. A REST devolve o artigo inteiro por
// pedido, e o HTML vira texto com um limpador simples (fora tabelas, referências e edição).
//
// O download é RETOMÁVEL: rodar de novo continua de onde parou (o alvo `--mb` é o total no
// disco) e cada pedido espera a sua vez (a Wikipédia pede ritmo educado e User-Agent que
// identifique o projeto). Falha de rede tenta de novo com espera maior.
import fs from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { textoDoHtml } from "./corpus-texto.mjs";

const raiz = dirname(dirname(fileURLToPath(import.meta.url)));
const args = process.argv.slice(2);
const opt = Object.fromEntries(args.filter((a) => a.startsWith("--")).map((a) => a.slice(2).split("=")));

const LIMITE_MB = Number(opt.mb ?? 30);
const SAIDA = join(raiz, opt.saida ?? "corpus");
const MIN_CHARS = Number(opt.min ?? 1500);
const TITULOS = opt.titulos ? join(raiz, opt.titulos) : null;
const MANIFESTO = join(raiz, "scripts/corpus-wikipedia.txt");
const API = "https://pt.wikipedia.org/w/api.php";
const REST = "https://pt.wikipedia.org/api/rest_v1/page/html/";
const UA = "mdOffice/1.0 (corpus de n-gramas; https://github.com/mdoffice)";
const PAUSA = Number(opt.pausa ?? 120);

const pausa = (ms) => new Promise((r) => setTimeout(r, ms));

/** Um pedido com 4 tentativas e espera crescente (a rede e a API oscilam). */
const buscar = async (url, tentativa = 1) => {
  try {
    const r = await fetch(url, { headers: { "User-Agent": UA, Accept: "application/json" } });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r;
  } catch (e) {
    if (tentativa >= 4) throw new Error(`desisti de ${url.slice(0, 110)}…: ${e.message}`);
    const espera = 1000 * 3 ** (tentativa - 1);
    console.error(`  falhou (${e.message}) — tento de novo em ${espera / 1000}s`);
    await pausa(espera);
    return buscar(url, tentativa + 1);
  }
};
const json = async (params) => (await buscar(`${API}?format=json&formatversion=2&${new URLSearchParams(params)}`)).json();

/** O nome do arquivo: o título sanitizado (o redo pula o que já está no disco). */
const arquivoDe = (titulo) => titulo.replace(/[\\/:*?"<>|]/g, "_").replace(/\s+/g, "_").slice(0, 120);

fs.mkdirSync(SAIDA, { recursive: true });
const existentes = new Set(fs.readdirSync(SAIDA).filter((f) => f.endsWith(".txt")).map((f) => f.replace(/^\d{4}-/, "").replace(/\.txt$/, "")));
let bytes = fs.readdirSync(SAIDA)
  .filter((f) => f.endsWith(".txt"))
  .reduce((s, f) => s + fs.statSync(join(SAIDA, f)).size, 0);
const alvo = LIMITE_MB * 1024 * 1024;
console.error(`no disco: ${existentes.size} artigos · ${(bytes / 1024 / 1024).toFixed(1)} MB (alvo ${LIMITE_MB} MB)`);

/** Os títulos a visitar: destacados/bons primeiro; o que faltar vem dos mais lidos. */
async function titulosDaWikipedida() {
  const fora = [];
  for (const categoria of ["!Artigos destacados", "!Artigos bons"]) {
    let cont = null;
    do {
      const j = await json({ action: "query", list: "categorymembers", cmtitle: `Categoria:${categoria}`, cmnamespace: 0, cmlimit: 500, ...(cont ? { cmcontinue: cont } : {}) });
      for (const p of j.query?.categorymembers ?? []) fora.push(p.title);
      cont = j.continue?.cmcontinue ?? null;
      await pausa(PAUSA);
    } while (cont);
    console.error(`  ${categoria}: ${fora.length} títulos`);
  }
  try {
    const vistos = await json({ action: "query", list: "mostviewed", pvimmetric: "pageviews", pvimlimit: 500 });
    for (const p of vistos.query?.mostviewed ?? []) {
      const t = p.title ?? p;
      if (!/^(Wikipédia|Especial|Predefinição|Categoria|Ajuda|Portal|Ficheiro):/.test(t)) fora.push(t);
    }
  } catch {
    /* sem os mais lidos, os destacados/bons bastam */
  }
  return [...new Set(fora)];
}

const titulos = TITULOS ? fs.readFileSync(TITULOS, "utf8").split(/\r?\n/).map((l) => l.trim()).filter(Boolean) : await titulosDaWikipedida();
console.error(`títulos a visitar: ${titulos.length}`);

// Alguns pedidos em paralelo: a REST renderiza o artigo no servidor (~2–8 s cada), então o
// ganho é quase linear e o ritmo segue educado (a pausa é por pedido, não por lote).
const PARALELO = Math.max(1, Math.min(8, Number(opt.paralelo ?? 4)));
const escritos = [];
let feitos = 0;
let sequencia = existentes.size;
const fila = titulos.filter((t) => !existentes.has(arquivoDe(t)));
console.error(`paralelo: ${PARALELO} · na fila: ${fila.length}`);

const visitar = async (posicao) => {
  const titulo = fila[posicao];
  const chave = arquivoDe(titulo);
  feitos++;
  try {
    const r = await buscar(`${REST}${encodeURIComponent(titulo)}?redirect=true`);
    const texto = textoDoHtml(await r.text());
    if (texto.length >= MIN_CHARS) {
      const nome = `${String(++sequencia).padStart(4, "0")}-${chave}.txt`;
      fs.writeFileSync(join(SAIDA, nome), texto, "utf8");
      escritos.push(titulo);
      bytes += Buffer.byteLength(texto, "utf8");
    }
  } catch (e) {
    console.error(`  ${titulo}: ${e.message}`);
  }
  if (feitos % 25 === 0) console.error(`  ${existentes.size + escritos.length} artigos · ${(bytes / 1024 / 1024).toFixed(1)} MB · último: ${titulo}`);
  await pausa(PAUSA);
};

let proximo = 0;
const trabalhador = async () => {
  while (bytes < alvo) {
    const posicao = proximo++;
    if (posicao >= fila.length) return;
    await visitar(posicao);
  }
};
await Promise.all(Array.from({ length: PARALELO }, () => trabalhador()));

const antigos = fs.existsSync(MANIFESTO) ? fs.readFileSync(MANIFESTO, "utf8").split(/\r?\n/).filter(Boolean) : [];
const todos = [...new Set([...antigos, ...escritos])];
fs.writeFileSync(MANIFESTO, todos.join("\n") + "\n", "utf8");
console.error(`\npronto: ${existentes.size + escritos.length} artigos · ${(bytes / 1024 / 1024).toFixed(1)} MB em ${SAIDA}`);
console.error(`manifesto com ${todos.length} títulos: ${MANIFESTO}`);
console.error(`para regerar o modelo: node scripts/build-ngrams.mjs public/ngrams/pt.json ${opt.saida ?? "corpus"} --vocab=30000 --trimin=6`);