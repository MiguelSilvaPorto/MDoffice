// Copia o dicionário pt-BR (pacote dictionary-pt) para public/dicionario,
// de onde o app carrega em tempo de execução (sem inflar o JavaScript).
import { copyFileSync, mkdirSync, existsSync } from "node:fs";

const origem = "node_modules/dictionary-pt";
const destino = "public/dicionario";

if (!existsSync(origem)) {
  console.error("Pacote dictionary-pt não encontrado. Rode: npm install");
  process.exit(1);
}

mkdirSync(destino, { recursive: true });
for (const [de, para] of [
  ["index.aff", "pt_BR.aff"],
  ["index.dic", "pt_BR.dic"],
]) {
  copyFileSync(`${origem}/${de}`, `${destino}/${para}`);
  console.log(`copiado: ${destino}/${para}`);
}

// Motor de tradução offline (onnxruntime-web): os .wasm ficam locais para funcionar sem internet.
const ort = "node_modules/onnxruntime-web/dist";
if (existsSync(ort)) {
  mkdirSync("public/ort", { recursive: true });
  for (const arq of [
    "ort-wasm-simd-threaded.wasm",
    "ort-wasm-simd-threaded.mjs",
    "ort-wasm-simd-threaded.asyncify.wasm",
    "ort-wasm-simd-threaded.asyncify.mjs",
  ]) {
    if (existsSync(`${ort}/${arq}`)) {
      copyFileSync(`${ort}/${arq}`, `public/ort/${arq}`);
      console.log(`copiado: public/ort/${arq}`);
    }
  }
}
