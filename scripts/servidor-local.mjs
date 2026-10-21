// `npm run app`: serve o mdOffice como site local a partir do `dist/`.
//
// É o modo "de verdade" no navegador: o service worker só é registrado na versão de
// produção, então é aqui que o Chrome/Edge oferecem o botão "Instalar" (PWA). O servidor
// é o `vite preview` na mesma porta do desenvolvimento (1420).
//
// Se o `dist/` estiver velho (algum arquivo do app mudou depois do último build), ele
// reconstrói antes de subir — assim `npm run app` nunca abre uma versão antiga.
//
// Uso:
//   npm run app             → builda se precisar e serve
//   npm run app -- --build  → força o build
import { spawn, spawnSync } from "node:child_process";
import { existsSync, readdirSync, statSync } from "node:fs";
import { connect } from "node:net";
import { join } from "node:path";

const raiz = process.cwd();
const dist = join(raiz, "dist");
const indice = join(dist, "index.html");
const forcar = process.argv.includes("--build") || process.argv.includes("-b");

/** O que entra na conta de "o app mudou": fontes, HTML, configuração e arquivos estáticos. */
const VIGIADOS = ["src", "public", "index.html", "vite.config.ts", "package.json", "tsconfig.json"];
const IGNORADOS = new Set(["node_modules", "dist", "temp", ".vite", ".worktrees"]);

function maisNovo(caminho) {
  let quando = 0;
  const visto = statSync(caminho);
  if (!visto.isDirectory()) return visto.mtimeMs;
  for (const item of readdirSync(caminho, { withFileTypes: true })) {
    if (IGNORADOS.has(item.name)) continue;
    quando = Math.max(quando, maisNovo(join(caminho, item.name)));
  }
  return quando;
}

function precisaConstruir() {
  if (forcar) return "build pedido (--build)";
  if (!existsSync(indice)) return "dist/ ainda não existe";
  const feito = statSync(indice).mtimeMs;
  for (const alvo of VIGIADOS) {
    const caminho = join(raiz, alvo);
    if (!existsSync(caminho)) continue;
    if (maisNovo(caminho) > feito) return `${alvo} mudou depois do último build`;
  }
  return null;
}

const motivo = precisaConstruir();
if (motivo) {
  console.log(`\n[mdOffice] construindo o app (${motivo})…\n`);
  // `npm` é um .cmd no Windows: quem o executa é o cmd.exe (argumento fixo, sem interpolação)
  const build = spawnSync(process.env.ComSpec ?? "cmd.exe", ["/d", "/s", "/c", "npm run build"], {
    cwd: raiz,
    stdio: "inherit",
  });
  if (build.status !== 0) {
    console.error("\n[mdOffice] o build falhou — o app não foi aberto.");
    process.exit(build.status ?? 1);
  }
  console.log("");
}

// A porta padrão é 1420 (a mesma do desenvolvimento). Se ela estiver ocupada — outra
// instância do app, o dev server de outra worktree —, o servidor sobe na próxima livre:
// abrir o mdOffice nunca deve falhar por causa de uma porta.
//
// A checagem CONECTA em vez de tentar escutar: no Windows o Vite costuma ficar só em `::1`
// (localhost IPv6), e um teste que escuta em IPv4 diria "livre" com a porta ocupada.
function portaOcupada(porta) {
  const tentar = (host) =>
    new Promise((resolve) => {
      const socket = connect({ port: porta, host });
      const fim = (ocupada) => {
        socket.destroy();
        resolve(ocupada);
      };
      socket.once("connect", () => fim(true));
      socket.once("error", () => fim(false));
      socket.setTimeout(400, () => fim(false));
    });
  return Promise.all([tentar("127.0.0.1"), tentar("::1")]).then(([v4, v6]) => v4 || v6);
}

let porta = 1420;
while (await portaOcupada(porta)) {
  porta++;
  if (porta > 1430) {
    console.error("[mdOffice] não achei porta livre entre 1420 e 1430.");
    process.exit(1);
  }
}

console.log(`[mdOffice] abrindo em http://localhost:${porta}  (Ctrl+C encerra)\n`);
const vite = join(raiz, "node_modules", "vite", "bin", "vite.js");
const servidor = spawn(process.execPath, [vite, "preview", "--port", String(porta), "--strictPort"], {
  cwd: raiz,
  stdio: "inherit",
});

servidor.on("exit", (codigo) => process.exit(codigo ?? 0));
for (const sinal of ["SIGINT", "SIGTERM"]) {
  process.on(sinal, () => {
    servidor.kill();
  });
}
