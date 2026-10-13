// Testa a correção automática: regras de pontuação/limpeza, política da varredura e o ritmo aprendido.
// Uso: node scripts/testar-correcao.mjs
import { build } from "esbuild";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const raiz = new URL("..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const tmp = mkdtempSync(join(tmpdir(), "correcao-"));
const empacotar = async (entrada, saida) => {
  await build({ entryPoints: [join(raiz, entrada)], bundle: true, platform: "node", format: "esm", outfile: join(tmp, saida), logLevel: "error" });
  return import(pathToFileURL(join(tmp, saida)).href);
};

let falhas = 0;
const ok = (nome, cond, detalhe = "") => {
  if (!cond) falhas++;
  console.log(`${cond ? "OK   " : "FALHA"} ${nome}${detalhe ? "  " + detalhe : ""}`);
};

const S = await empacotar("src/broker/style/index.ts", "style.mjs");
const A = await empacotar("src/broker/autofix.ts", "autofix.mjs");
const R = await empacotar("src/broker/personal/autofmt.ts", "autofmt.mjs");

/** Aplica todos os fixes numa transação, como o editor (em caso de sobreposição, o maior vence). */
const aplicar = (texto) => {
  const lista = S.checkStyle(texto)
    .filter((i) => i.fix !== undefined)
    .map((i) => ({ from: i.from, to: i.to, insert: i.fix }))
    .sort((a, b) => a.from - b.from);
  const safe = [];
  for (const c of lista) {
    const ultimo = safe[safe.length - 1];
    if (ultimo && c.from < ultimo.to) {
      if (c.to - c.from > ultimo.to - ultimo.from) safe[safe.length - 1] = c;
      continue;
    }
    safe.push(c);
  }
  let out = texto;
  for (const c of [...safe].sort((a, b) => b.from - a.from)) out = out.slice(0, c.from) + c.insert + out.slice(c.to);
  return out;
};
const igual = (nome, texto, esperado) => {
  const r = aplicar(texto);
  ok(nome, r === esperado, r === esperado ? "" : `→ ${JSON.stringify(r)}`);
};

// ---------------------------------------------------------------- ponto final
igual("ponto final no fim do parágrafo", "O relatorio ficou pronto", "O relatorio ficou pronto.");
igual("não fecha frase terminando em conector", "O relatorio ficou pronto para", "O relatorio ficou pronto para");
igual("título não recebe ponto", "## titulo sem ponto", "## titulo sem ponto");
igual("item de lista não recebe ponto", "- item sem ponto", "- item sem ponto");
igual("reticências ficam intactas", "Esperando...", "Esperando...");

// ---------------------------------------------------------------- vírgulas
igual("vírgula antes de “mas”", "eu comprei pão mas esqueci o leite", "Eu comprei pão, mas esqueci o leite.");
igual("expressão intercalada sem sobrar espaço", "O resultado no entanto foi diferente", "O resultado, no entanto, foi diferente.");
igual("“isto é” com acento casa", "O resultado isto é o número final ficou alto", "O resultado, isto é, o número final ficou alto.");
igual("conectivo no início da frase", "Por isso decidimos mudar o plano", "Por isso, decidimos mudar o plano.");
igual("“porém” abrindo a frase", "Porém decidimos mudar o plano", "Porém, decidimos mudar o plano.");
igual("“entretanto” abrindo a frase", "Entretanto faltou testar o sistema", "Entretanto, faltou testar o sistema.");
igual("“portanto” intercalado nos dois lados", "ele chegou atrasado portanto perdemos a reunião", "Ele chegou atrasado, portanto, perdemos a reunião.");
igual("“entretanto” intercalado não duplica vírgulas", "O time entregou o projeto entretanto faltou teste", "O time entregou o projeto, entretanto, faltou teste.");
igual("frase subordinada longa ganha vírgula", "A reunião foi longa pois muita coisa estava pendente", "A reunião foi longa, pois muita coisa estava pendente.");
igual("não mexe em código", "Use `no entanto` no texto", "Use `no entanto` no texto.");
igual("não mexe em número", "O valor é 1.000,00", "O valor é 1.000,00.");

// ---------------------------------------------------------------- limpeza
igual("dois pontos seguidos viram um", "O relatorio ficou pronto.. O proximo item tambem", "O relatorio ficou pronto. O proximo item tambem.");
igual("pontos separados por espaço viram um", "O relatorio ficou pronto. . O proximo item tambem", "O relatorio ficou pronto. O proximo item tambem.");
igual("vírgulas duplicadas viram uma", "atrasado,, portanto perdemos a reunião", "Atrasado, portanto perdemos a reunião.");
igual("frase colada ganha o ponto", "O relatorio ficou pronto O proximo item tambem", "O relatorio ficou pronto. O proximo item tambem.");
igual("frase colada antes de nome próprio não arrisca", "falei O Pedro ontem", "Falei O Pedro ontem.");
igual("quebra de frase comprida só entra no “Corrigir tudo”", "um dois três quatro cinco seis sete oito nove dez onze e doze", "Um dois três quatro cinco seis sete oito nove dez onze. E doze.");

// ---------------------------------------------------------------- política da varredura
const T = "eu comprei pao mas esqueci o leite";
const fimT = T.length;
const p1 = A.planejarVarredura(T, { pos: fimT, from: 0, to: fimT, parFrom: 0, parTo: fimT, parConcluido: true });
ok("política: parágrafo concluído fecha com ponto", p1.some((c) => c.insert === "leite."));
const p2 = A.planejarVarredura(T, { pos: 5, from: 0, to: fimT, parFrom: 0, parTo: fimT, parConcluido: false });
ok("política: parágrafo em andamento não fecha com ponto", !p2.some((c) => c.insert === "leite."));
ok("política: vírgulas entram mesmo em andamento", p2.some((c) => c.insert === ", mas"));
const posLeite = T.indexOf("leite") + 2;
const p3 = A.planejarVarredura(T, { pos: posLeite, from: 0, to: fimT, parFrom: 0, parTo: fimT, parConcluido: true });
ok("política: não toca a palavra sob o cursor", !p3.some((c) => c.from <= posLeite && posLeite <= c.to));
const G = "pronto O proximo item";
const p4 = A.planejarVarredura(G, { pos: G.length, from: 0, to: G.length, parFrom: 0, parTo: G.length, parConcluido: true });
ok("política: frase colada entra na varredura", p4.some((c) => c.insert === "o. "));
const Q = "um dois três quatro cinco seis sete oito nove dez onze e doze";
const p5 = A.planejarVarredura(Q, { pos: Q.length, from: 0, to: Q.length, parFrom: 0, parTo: Q.length, parConcluido: true });
ok("política: quebra de frase comprida nunca entra sozinha", !p5.some((c) => c.insert.startsWith(". ")));

// ---------------------------------------------------------------- ritmo aprendido
R.limparRitmo();
ok("ritmo: começa em 3,5 s", R.ritmoDePausa() === 3500, `${R.ritmoDePausa()} ms`);
R.marcarAplicacao("a");
R.observarEdicao("a"); // Ctrl+Z: voltou ao texto de antes
ok("ritmo: correção desfeita faz esperar mais", R.ritmoDePausa() > 3500, `${R.ritmoDePausa()} ms`);
R.limparRitmo();
R.marcarAplicacao("b");
R.marcarAplicacao("c"); // a de “b” ficou de pé até a próxima pausa: valeu
ok("ritmo: correção mantida faz agir mais cedo", R.ritmoDePausa() < 3500, `${R.ritmoDePausa()} ms`);
for (let i = 0; i < 30; i++) R.marcarAplicacao(`x${i}`);
ok("ritmo: limite mínimo respeitado", R.ritmoDePausa() >= 1500, `${R.ritmoDePausa()} ms`);
R.limparRitmo();
for (let i = 0; i < 30; i++) {
  R.marcarAplicacao(`y${i}`);
  R.observarEdicao(`y${i}`);
}
ok("ritmo: limite máximo respeitado", R.ritmoDePausa() <= 8000, `${R.ritmoDePausa()} ms`);
R.limparRitmo();
ok("ritmo: zerar volta ao padrão", R.ritmoDePausa() === 3500);

// ---------------------------------------------------------------- memória do checkStyle
{
  const antes = S.checkStyle("O relatorio ficou pronto");
  antes[0].message = "mutado por engano";
  const depois = S.checkStyle("O relatorio ficou pronto");
  ok("memória: mutação de fora não vaza", depois[0].message !== "mutado por engano");
}

// ---------------------------------------------------------------- desempenho
{
  const frase = "eu comprei pao mas esqueci o leite e depois voltei a padaria no entanto estava fechada ";
  let grande = "";
  for (let i = 0; i < 120; i++) grande += `${i} ${frase}`;
  const t0 = performance.now();
  S.checkStyle(`${grande}x`);
  const ms = performance.now() - t0;
  ok("desempenho: varredura de ~12 mil caracteres abaixo de 25 ms", ms < 25, `${ms.toFixed(1)} ms`);
}

console.log(falhas ? `\n${falhas} falha(s)` : "\ntudo certo");
process.exit(falhas ? 1 : 0);
