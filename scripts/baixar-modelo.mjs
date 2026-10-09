// Baixa o modelo de linguagem local (Gemma 3 270M, 4 bits, para GPU) para public/modelos/, de onde o app o carrega.
// O que está em public/ entra no instalador (frontendDist), então o app funciona 100% offline.
// Os arquivos NÃO ficam no git (public/modelos/ está no .gitignore): rode este script uma vez (o build já roda).
//
// Para trocar de modelo, mude MODELO/ARQUIVOS aqui e `MODELO_DIR` em src/broker/llm/config.ts.
import fs from "node:fs";
import path from "node:path";

const REPO = "onnx-community/gemma-3-270m-it-ONNX";
const DESTINO = "public/modelos/gemma-3-270m";
const ARQUIVOS = [
  "config.json",
  "generation_config.json",
  "tokenizer.json",
  "tokenizer_config.json",
  "special_tokens_map.json",
  "added_tokens.json",
  "onnx/model_q4f16.onnx",
  "onnx/model_q4f16.onnx_data",
];

const AVISO = `Gemma 3 270M (Google) — pesos em formato ONNX de ${REPO}.

Gemma é fornecido sob e sujeito aos Termos de Uso do Gemma, em https://ai.google.dev/gemma/terms
(inclui a Política de Uso Proibido: https://ai.google.dev/gemma/prohibited_use_policy).
Este app usa o modelo localmente, sem enviar texto a nenhum servidor. Quem redistribuir o app deve
repassar estes termos. Gemma está sob licença Gemma; ©Google LLC.
`;

fs.mkdirSync(path.join(DESTINO, "onnx"), { recursive: true });
fs.writeFileSync(path.join(DESTINO, "AVISO-GEMMA.txt"), AVISO);

let baixados = 0;
for (const arq of ARQUIVOS) {
  const dest = path.join(DESTINO, arq);
  const url = `https://huggingface.co/${REPO}/resolve/main/${arq}`;
  // pula o que já existe com tamanho certo (HEAD devolve o tamanho)
  let esperado = 0;
  try {
    const head = await fetch(url, { method: "HEAD", redirect: "follow" });
    esperado = +(head.headers.get("content-length") ?? 0);
  } catch {
    /* sem rede: usa o que já tiver */
  }
  if (fs.existsSync(dest) && (!esperado || fs.statSync(dest).size === esperado)) continue;
  console.log(`baixando ${arq}…`);
  const r = await fetch(url, { redirect: "follow" });
  if (!r.ok || !r.body) {
    if (arq === "added_tokens.json" || arq === "special_tokens_map.json") continue; // opcionais
    console.error(`falhou: ${arq} (${r.status}). O app funciona sem o modelo, mas sem a IA local.`);
    process.exit(process.env.MODELO_OPCIONAL ? 0 : 1);
  }
  const out = fs.createWriteStream(dest + ".parte");
  for await (const chunk of r.body) out.write(chunk);
  await new Promise((res) => out.end(res));
  fs.renameSync(dest + ".parte", dest);
  baixados++;
}
console.log(baixados ? `modelo pronto em ${DESTINO}` : `modelo já estava em ${DESTINO}`);
