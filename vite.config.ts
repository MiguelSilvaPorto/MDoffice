import { defineConfig, type Plugin } from "vite";
import fs from "node:fs";
import path from "node:path";

/**
 * Salvamento automático dentro do projeto, para quando o app roda no NAVEGADOR (dev):
 * o navegador não pode escrever arquivos, então mandamos o texto para o servidor de
 * desenvolvimento, que grava em `temp/rascunho.md` (a mesma pasta que o app usa).
 */
function tempSavePlugin(): Plugin {
  const raiz = process.cwd();
  return {
    name: "mdc-temp-save",
    configureServer(server) {
      server.middlewares.use("/__salvar", (req, res) => {
        if (req.method !== "POST") {
          res.statusCode = 405;
          res.end("use POST");
          return;
        }
        let body = "";
        req.on("data", (chunk) => {
          body += chunk;
          if (body.length > 8_000_000) req.destroy();
        });
        req.on("end", () => {
          try {
            const dados = JSON.parse(body) as { name?: string; content?: string };
            const nome = String(dados.name || "rascunho")
              .replace(/[^\w.-]+/g, "_")
              .slice(0, 60);
            const destino = path.join(raiz, "temp", `${nome}.md`);
            fs.mkdirSync(path.dirname(destino), { recursive: true });
            fs.writeFileSync(destino, String(dados.content ?? ""), "utf8");
            res.setHeader("content-type", "application/json");
            res.end(JSON.stringify({ ok: true, arquivo: destino }));
          } catch (e) {
            res.statusCode = 500;
            res.end(JSON.stringify({ ok: false, erro: String(e) }));
          }
        });
      });
    },
  };
}

/**
 * No modo dev o Vite acrescenta `?import` aos imports dinâmicos e recusa arquivos de public/.
 * O motor offline de tradução (onnxruntime) importa seus .mjs assim, então servimos /ort/ "cru".
 */
function ortPlugin(): Plugin {
  return {
    name: "mdc-ort-public",
    configureServer(server) {
      server.middlewares.use("/ort", (req, res, next) => {
        const nome = path.basename((req.url || "").split("?")[0]);
        const arquivo = path.join(process.cwd(), "public", "ort", nome);
        if (!nome || !fs.existsSync(arquivo)) return next();
        res.setHeader("content-type", nome.endsWith(".wasm") ? "application/wasm" : "text/javascript");
        res.setHeader("cache-control", "no-cache");
        fs.createReadStream(arquivo).pipe(res);
      });
    },
  };
}

// Configuração pensada para o Tauri 2:
// - porta fixa 1420 (definida em tauri.conf.json > build.devUrl)
// - não limpar o terminal para não esconder logs do cargo
export default defineConfig({
  clearScreen: false,
  plugins: [tempSavePlugin(), ortPlugin()],
  // Cache do otimizador POR PASTA. O padrão (`node_modules/.vite`) é compartilhado,
  // porque `node_modules` é um junction apontando para a cópia principal: o servidor
  // de dev de uma worktree e o da cópia principal escrevem no MESMO cache e trocam o
  // hash de configuração um do outro (o hash inclui a raiz do projeto). Cada troca
  // faz o Vite re-otimizar tudo e mandar os clientes conectados recarregarem.
  cacheDir: ".vite",
  optimizeDeps: {
    // Só o que o Vite JAMAIS veria sozinho: os pacotes usados dentro dos workers.
    // O scanner de dependências não lê arquivo de worker, então `typo-js` só era
    // descoberto quando o corretor subia — ~20s depois de abrir o app — e aí o Vite
    // re-otimizava e mandava o app inteiro recarregar, no meio do uso.
    // `@huggingface/transformers` (IA local e tradução offline) tinha o mesmo destino.
    //
    // O resto o scanner acha: ele segue os `import()` dinâmicos e o esbuild já embute
    // os pacotes que os outros carregam sob demanda (os `@codemirror/lang-*` que os
    // blocos de código puxam, por exemplo, viram chunks no próprio cache).
    include: ["typo-js", "@huggingface/transformers"],
  },
  server: {
    port: 1420,
    strictPort: true,
    watch: {
      // `src-tauri` é do Rust (quem recompila é o cargo).
      //
      // `.worktrees` e `dist` ficam de fora porque o servidor de dev não tem nada
      // a ver com eles e a observação atrapalha os dois lados:
      // - o `dist` de uma worktree carrega o modelo de IA (270 MB) e, quando a
      //   worktree é removida, o arquivo fica travado e o observador morre com
      //   EBUSY — o Vite cai junto e o app fecha sozinho;
      // - observar a worktree de outra pessoa é justamente o que o AGENTS.md
      //   pede para não fazer.
      ignored: ["**/src-tauri/**", "**/.worktrees/**", "**/dist/**"],
    },
  },
  build: {
    target: "es2021",
    minify: "esbuild",
    sourcemap: false,
    chunkSizeWarningLimit: 2200,
  },
});
