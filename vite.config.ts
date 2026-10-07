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

// Configuração pensada para o Tauri 2:
// - porta fixa 1420 (definida em tauri.conf.json > build.devUrl)
// - não limpar o terminal para não esconder logs do cargo
export default defineConfig({
  clearScreen: false,
  plugins: [tempSavePlugin()],
  server: {
    port: 1420,
    strictPort: true,
    watch: {
      ignored: ["**/src-tauri/**"],
    },
  },
  build: {
    target: "es2021",
    minify: "esbuild",
    sourcemap: false,
    chunkSizeWarningLimit: 2200,
  },
});
