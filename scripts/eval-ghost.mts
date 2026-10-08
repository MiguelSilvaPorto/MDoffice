// Simula uma pessoa digitando um texto e aceitando (Tab) só as sugestões que estão certas.
// Mede: economia de teclas, precisão (quanto do que aparece está certo) e cobertura.
// Uso: npx tsx scripts/eval-ghost.mts <texto.txt> [maxChars]
//   GHOST_MODEL=public/ngrams/pt.json  liga o modelo de idioma (sem ele, mede o plano B)
//   NO_LEARN=1  não aprende com o próprio texto (documento novo)   ALT=1  conta as alternativas (Alt+Seta)
//   GHOST_T / GHOST_MIX  JSON para testar outros limiares/pesos   SHOW_MISSES=1  mostra exemplos de erro
import fs from "node:fs";
import { DocumentIndex } from "../src/broker/ghost/documentIndex.ts";
import { predictFromLine, THRESHOLDS, MIX } from "../src/broker/ghost/predict.ts";
if (process.env.GHOST_T) Object.assign(THRESHOLDS, JSON.parse(process.env.GHOST_T));
if (process.env.GHOST_MIX) Object.assign(MIX, JSON.parse(process.env.GHOST_MIX));

const file = process.argv[2];
const maxChars = +(process.argv[3] ?? 60000);
if (process.env.GHOST_MODEL) {
  const m = await import("../src/broker/ghost/model.ts");
  m.setLanguageModel(JSON.parse(fs.readFileSync(process.env.GHOST_MODEL, "utf8")));
}
const noLearn = !!process.env.NO_LEARN; // sem aprender com o próprio texto (pior caso: documento novo)

const text = fs.readFileSync(file, "utf8").slice(0, maxChars);
const paras = text.split(/\n+/).filter((p) => p.trim().length > 30);

const index = new DocumentIndex();
let soFar = "";
const st = { chars: 0, keys: 0, shown: 0, hit: 0, nextShown: 0, nextHit: 0, prefShown: 0, prefHit: 0, multi: 0, multiHit: 0, accWords: 0, positions: 0, altHit: 0 };
const misses: string[] = [];

for (const para of paras) {
  let i = 1;
  st.keys += 1;
  while (i < para.length) {
    const before = para.slice(0, i);
    const rest = para.slice(i);
    const typedBoundary = /[A-Za-zÀ-ÿ0-9]$/.test(before) || /\s$/.test(before);
    let accepted = false;
    if (typedBoundary) {
      st.positions++;
      const pred = predictFromLine(before, "", i, index);
      if (pred && pred.text) {
        const isNext = /\s$/.test(before);
        const words = pred.text.trim().split(/\s+/).length;
        st.shown++;
        if (isNext) st.nextShown++;
        else st.prefShown++;
        if (words > 1) st.multi++;
        // aceita as palavras certas do começo da sugestão (tudo de uma vez = Tab; parcial = Alt+Seta por palavra);
        // com ALT=1 também vale trocar para uma alternativa (Alt+Seta para baixo, 1 tecla por troca)
        const match = (text: string) => {
          const sw = text.split(/(?<=s)/);
          let ok = 0;
          let len = 0;
          for (const w of sw) {
            if (rest.toLowerCase().startsWith((text.slice(0, len) + w).toLowerCase())) {
              ok++;
              len += w.length;
            } else break;
          }
          if (ok === 0 && sw.length === 1 && rest.toLowerCase().startsWith(text.trimEnd().toLowerCase())) {
            ok = 1;
            len = text.trimEnd().length;
          }
          return { ok, len, all: ok === sw.length };
        };
        let found: { ok: number; len: number; all: boolean; alt: number } | null = null;
        const options = process.env.ALT ? (pred.alts ?? [pred.text]) : [pred.text];
        for (let j = 0; j < options.length && !found; j++) {
          const m = match(options[j]);
          if (m.ok > 0) found = { ...m, alt: j };
        }
        if (found) {
          st.hit++;
          if (found.alt > 0) st.altHit++;
          if (isNext) st.nextHit++;
          else st.prefHit++;
          if (words > 1) st.multiHit++;
          accepted = true;
          st.keys += found.alt + (found.all ? 1 : found.ok);
          st.accWords += found.ok;
          i += found.len;
        } else if (misses.length < 30 && Math.random() < 0.01) {
          misses.push(`${JSON.stringify(before.slice(-28))} → ${JSON.stringify(pred.text)} | real: ${JSON.stringify(rest.slice(0, 22))}`);
        }
      }
    }
    if (!accepted) {
      st.keys += 1;
      i += 1;
    }
  }
  st.chars += para.length;
  soFar += para + "\n";
  if (!noLearn) index.update(soFar);
}

const pct = (a: number, b: number) => (b ? ((100 * a) / b).toFixed(1) + "%" : "-");
console.log(`texto: ${st.chars} caracteres, ${paras.length} parágrafos`);
console.log(`TECLAS: ${st.keys} em vez de ${st.chars}  →  economia de ${(100 * (1 - st.keys / st.chars)).toFixed(1)}%`);
console.log(`sugestões mostradas: ${st.shown} em ${st.positions} posições (cobertura ${pct(st.shown, st.positions)}); certas: ${pct(st.hit, st.shown)}`);
console.log(`  acertos só com alternativa: ${st.altHit}`);
console.log(`  próxima palavra:   ${st.nextShown} mostradas, ${pct(st.nextHit, st.nextShown)} certas`);
console.log(`  completar palavra: ${st.prefShown} mostradas, ${pct(st.prefHit, st.prefShown)} certas`);
console.log(`  multi-palavra:     ${st.multi} mostradas, ${pct(st.multiHit, st.multi)} certas`);
if (process.env.SHOW_MISSES) console.log("erros (amostra):\n  " + misses.join("\n  "));
