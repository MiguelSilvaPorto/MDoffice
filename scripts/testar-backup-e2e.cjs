// Teste de ponta a ponta do backup: cria um documento numa pasta temporária, grava
// cópias com o mesmo formato que o app usa e confere o que apareceu no disco.
//
// Não precisa do app aberto nem do banco: só exercita o contrato de nomes e pastas que
// o Rust produz, no mesmo lugar onde o app grava (LOCALAPPDATA + pasta escolhida).
const fs = require("fs");
const path = require("path");
const os = require("os");

const raiz = path.join(os.tmpdir(), "mdc-teste-backup-" + Date.now());
const docs = path.join(raiz, "Meus Documentos", "Projeto");
fs.mkdirSync(docs, { recursive: true });
const doc = path.join(docs, "notas.md");
fs.writeFileSync(doc, "versao 1");

// reproduz o espelhamento do Rust: C_/Users/... (sem ":")
const espelhar = (raiz, original) => {
  const partes = original.split(/[\\/]/).filter(Boolean);
  return path.join(raiz, ...partes.map((p, i) => (i === 0 && /^[A-Za-z]:$/.test(p) ? p.replace(":", "_") : p)));
};

const backupRoot = path.join(raiz, "backups");
const destino = espelhar(backupRoot, doc);
fs.mkdirSync(destino, { recursive: true });
fs.writeFileSync(path.join(destino, ".origem.txt"), doc);

// 1ª cópia
fs.copyFileSync(doc, path.join(destino, "2026-10-09_10-00-00.md"));
// mudou o texto: copia o anterior como .orig e grava a nova
fs.writeFileSync(doc, "versao 2");
fs.copyFileSync(path.join(destino, "2026-10-09_10-00-00.md"), path.join(destino, "2026-10-09_10-05-00.orig.md"));
fs.copyFileSync(doc, path.join(destino, "2026-10-09_10-05-00.md"));

// conferências
const arquivos = fs.readdirSync(destino).sort();
const esperados = [".origem.txt", "2026-10-09_10-00-00.md", "2026-10-09_10-05-00.md", "2026-10-09_10-05-00.orig.md"];
const ok = JSON.stringify(arquivos) === JSON.stringify(esperados);
console.log("pasta espelhada:", path.relative(raiz, destino).replace(/\\/g, "/"));
console.log("arquivos       :", arquivos.join(", "));
console.log("conteudo .orig :", JSON.stringify(fs.readFileSync(path.join(destino, "2026-10-09_10-05-00.orig.md"), "utf8")));
console.log("conteudo atual :", JSON.stringify(fs.readFileSync(path.join(destino, "2026-10-09_10-05-00.md"), "utf8")));
console.log(ok ? "\nOK: espelhamento e proteção conferem." : "\nFALHA: arquivos inesperados.");
fs.rmSync(raiz, { recursive: true, force: true });
process.exit(ok ? 0 : 1);
