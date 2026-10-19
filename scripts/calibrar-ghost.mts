// Calibra a decisão da sugestão: P(acertar | evidências) por regressão logística.
//
// Uso: npx tsx scripts/calibrar-ghost.mts [treino.txt] [validacao.txt] [maxChars]
//   padrão: docs/historico-tecnico.md (treino) e scripts/corpus-wikipedia.txt (validação)
//
// O que ele faz:
//  1. anda pelo texto de TREINO simulando a digitação e, em cada ponto de decisão, guarda as
//     evidências (`pontoCru`) e se a sugestão acertaria (a primeira palavra é a que vem);
//  2. ajusta uma regressão logística (features padronizadas, L2) e devolve os pesos crus para o
//     `CALIB.w` do predict.ts — o mesmo vetor que o app usa em runtime;
//  3. no texto de VALIDAÇÃO (que não entrou no ajuste), roda a decisão do app
//     (probabilidade × teclas ≥ custo) para uma grade de custos e mostra precisão, cobertura e
//     economia — é assim que o custo de cada intensidade é escolhido, com número.
import fs from "node:fs";
import { DocumentIndex } from "../src/broker/ghost/documentIndex.ts";
import { THRESHOLDS, pontoCru, CALIB, probAcerto, valeMostrar } from "../src/broker/ghost/predict.ts";
import { setLanguageModel } from "../src/broker/ghost/model.ts";

const raiz = new URL("..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
setLanguageModel(JSON.parse(fs.readFileSync(process.env.GHOST_MODEL ?? `${raiz}public/ngrams/pt.json`, "utf8")));

const treino = process.argv[2] ?? `${raiz}docs/historico-tecnico.md`;
const validacao = process.argv[3] ?? `${raiz}scripts/corpus-wikipedia.txt`;
const maxChars = +(process.argv[4] ?? 60000);

const BOUNDARY = /[A-Za-zÀ-ÿ0-9]$/;
/** Com --fluxo, calibra no FLUXO de digitação (a sugestão aceita avança o texto). */
const fluxo = process.argv.includes("--fluxo");

interface Amostra {
  x: number[];
  y: number;
  keys: number;
}

/** Anda pelo texto no FLUXO de digitação: quando a decisão atual mostra e a primeira palavra
 *  acerta, o texto avança (o usuário aceitou com Tab). É a população que o avaliador simula. */
function amostrarFluxo(texto: string): Amostra[] {
  const paras = texto.split(/\n+/).filter((p) => p.trim().length > 30);
  const index = new DocumentIndex();
  const out: Amostra[] = [];
  for (const para of paras) {
    let i = 1;
    while (i < para.length) {
      const before = para.slice(0, i);
      const rest = para.slice(i);
      let avancou = 0;
      if (BOUNDARY.test(before) || /\s$/.test(before)) {
        const pt = pontoCru(before, index);
        if (pt && !(pt.prefixLen > 0 && pt.keys < THRESHOLDS.minSuffix)) {
          const acerta = rest.toLowerCase().startsWith(pt.text.trimEnd().toLowerCase()) ? 1 : 0;
          out.push({ x: pt.x, y: acerta, keys: pt.keys });
          if (acerta && valeMostrar(pt.x, pt.keys)) avancou = pt.text.trimEnd().length;
        }
      }
      i += Math.max(1, avancou);
    }
    index.update(para);
  }
  return out;
}

/** Mede a decisão no fluxo (limita a leitura de um texto grande). */
function medirFluxo(texto: string, max = 120000) {
  const paras = texto.slice(0, max).split(/\n+/).filter((p) => p.trim().length > 30);
  const index = new DocumentIndex();
  const st = { shown: 0, hit: 0, posicoes: 0, keys: 0, ganho: 0 };
  for (const para of paras) {
    let i = 1;
    st.keys++;
    while (i < para.length) {
      const before = para.slice(0, i);
      const rest = para.slice(i);
      let aceitou = false;
      if (BOUNDARY.test(before) || /\s$/.test(before)) {
        st.posicoes++;
        const pt = pontoCru(before, index);
        if (pt && !(pt.prefixLen > 0 && pt.keys < THRESHOLDS.minSuffix) && valeMostrar(pt.x, pt.keys)) {
          st.shown++;
          if (rest.toLowerCase().startsWith(pt.text.trimEnd().toLowerCase())) {
            st.hit++;
            st.ganho += Math.max(0, pt.text.trimEnd().length - 1);
            aceitou = true;
            i += pt.text.trimEnd().length;
          }
        }
      }
      st.keys++;
      if (!aceitou) i += 1;
    }
    index.update(para);
  }
  return st;
}

/** Anda pelo texto como o editor (1 caractere por passo) e devolve as amostras do ponto de decisão. */
function amostrar(texto: string): Amostra[] {
  const paras = texto.split(/\n+/).filter((p) => p.trim().length > 30);
  const index = new DocumentIndex();
  const out: Amostra[] = [];
  for (const para of paras) {
    let i = 1;
    while (i < para.length) {
      const before = para.slice(0, i);
      const rest = para.slice(i);
      if (BOUNDARY.test(before) || /\s$/.test(before)) {
        const pt = pontoCru(before, index);
        // o runtime não mostra completar palavra com menos de minSuffix letras
        if (pt && !(pt.prefixLen > 0 && pt.keys < THRESHOLDS.minSuffix)) {
          const acerta = rest.toLowerCase().startsWith(pt.text.trimEnd().toLowerCase()) ? 1 : 0;
          out.push({ x: pt.x, y: acerta, keys: pt.keys });
        }
      }
      i += 1;
    }
    index.update(para);
  }
  return out;
}

/** Ajusta a logística com features padronizadas e devolve os pesos no espaço CRU (para o app). */
function ajustar(amostras: Amostra[]): { w: number[]; auc: number; taxa: number } {
  const n = amostras.length;
  if (!n) throw new Error("sem amostras");
  const d = amostras[0].x.length;
  const media = new Array(d).fill(0);
  const desvio = new Array(d).fill(0);
  for (const a of amostras) for (let j = 0; j < d; j++) media[j] += a.x[j] / n;
  for (const a of amostras) for (let j = 0; j < d; j++) desvio[j] += (a.x[j] - media[j]) ** 2 / n;
  for (let j = 0; j < d; j++) desvio[j] = Math.sqrt(desvio[j]) || 1;

  const z = amostras.map((a) => a.x.map((v, j) => (v - media[j]) / desvio[j]));
  const w = new Array(d).fill(0);
  const LR = 0.5;
  const L2 = 1e-3;
  for (let it = 0; it < 400; it++) {
    const g = new Array(d).fill(0);
    for (let i = 0; i < n; i++) {
      let s = 0;
      for (let j = 0; j < d; j++) s += w[j] * z[i][j];
      const p = 1 / (1 + Math.exp(-s));
      const e = p - amostras[i].y;
      for (let j = 0; j < d; j++) g[j] += (e * z[i][j]) / n;
    }
    for (let j = 0; j < d; j++) w[j] -= LR * (g[j] + L2 * w[j]);
  }

  // AUC (qualidade da ordenação)
  const ord = amostras.map((a, i) => ({ p: probCom(w, z[i]), y: a.y })).sort((a, b) => b.p - a.p);
  let pos = 0;
  let neg = 0;
  for (const o of ord) o.y ? pos++ : neg++;
  let soma = 0;
  let vistosPos = 0;
  for (const o of ord) {
    if (o.y) vistosPos++;
    else soma += vistosPos;
  }
  const auc = pos && neg ? soma / (pos * neg) : 0.5;

  // de volta ao espaço cru: w_cru = w_std / desvio; b_cru = −Σ w_std·média/desvio
  const wCru = new Array(d).fill(0);
  for (let j = 0; j < d; j++) wCru[j] = w[j] / desvio[j];
  let b = 0;
  for (let j = 0; j < d; j++) b -= (w[j] * media[j]) / desvio[j];
  wCru[0] += b;
  return { w: wCru, auc, taxa: amostras.reduce((a, s) => a + s.y, 0) / n };
}

function probCom(w: number[], x: number[]): number {
  let s = 0;
  for (let j = 0; j < x.length; j++) s += w[j] * x[j];
  return 1 / (1 + Math.exp(-s));
}

console.log(`treino: ${treino}${fluxo ? " (fluxo)" : ""}`);
const textoTreino = fs.readFileSync(treino, "utf8").slice(0, maxChars);
const amostras = fluxo ? amostrarFluxo(textoTreino) : amostrar(textoTreino);
console.log(`amostras: ${amostras.length} (acerto-base ${(100 * amostras.reduce((a, s) => a + s.y, 0) / amostras.length).toFixed(1)}%)`);
const { w, auc, taxa } = ajustar(amostras);
console.log(`AUC no treino: ${auc.toFixed(3)}   acerto-base: ${(100 * taxa).toFixed(1)}%`);
console.log("pesos crus (CALIB.w):");
console.log(`  [${w.map((v) => +v.toFixed(4)).join(", ")}]`);
if (fluxo) {
  CALIB.w = w;
  const f = medirFluxo(fs.readFileSync(validacao, "utf8"));
  const p = (100 * f.hit) / Math.max(1, f.shown);
  const e = (100 * f.ganho) / Math.max(1, f.keys);
  const c = (100 * f.shown) / Math.max(1, f.posicoes);
  console.log(`\nfluxo na validação: ${f.shown} mostradas (${c.toFixed(1)}% de cobertura), ${p.toFixed(1)}% certas, ${e.toFixed(1)}% de economia`);
}

// ---- validação: a decisão do app, para uma grade de custos
console.log(`\nvalidação: ${validacao}`);
const textoVal = fs.readFileSync(validacao, "utf8").slice(0, maxChars);
const paras = textoVal.split(/\n+/).filter((p) => p.trim().length > 30);
const index = new DocumentIndex();
const pontos: { x: number[]; keys: number; acerta: boolean }[] = [];
let keystrokes = 0;
for (const para of paras) {
  let i = 1;
  keystrokes += 1;
  while (i < para.length) {
    const before = para.slice(0, i);
    const rest = para.slice(i);
    if (BOUNDARY.test(before) || /\s$/.test(before)) {
      const pt = pontoCru(before, index);
      if (pt && !(pt.prefixLen > 0 && pt.keys < THRESHOLDS.minSuffix)) {
        pontos.push({ x: pt.x, keys: pt.keys, acerta: rest.toLowerCase().startsWith(pt.text.trimEnd().toLowerCase()) });
      }
    }
    keystrokes += 1;
    i += 1;
  }
  index.update(para);
}

CALIB.w = w;
console.log("custo | mostradas | precisão | cobertura | economia");
for (const custo of [0.3, 0.5, 0.7, 0.9, 1.1, 1.4, 1.8, 2.4]) {
  let shown = 0;
  let hits = 0;
  let ganho = 0;
  for (const pt of pontos) {
    if (probAcerto(pt.x) * pt.keys < custo) continue;
    shown++;
    if (pt.acerta) {
      hits++;
      ganho += Math.max(0, pt.keys - 1);
    }
  }
  console.log(
    `${custo.toFixed(1)} | ${shown} | ${shown ? ((100 * hits) / shown).toFixed(1) + "%" : "-"} | ${((100 * shown) / pontos.length).toFixed(1)}% | ${((100 * ganho) / keystrokes).toFixed(1)}%`
  );
}
console.log(`\nposições: ${pontos.length}   teclas: ${keystrokes}`);
