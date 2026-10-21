import { defineConfig, type Connect, type Plugin } from "vite";
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

/**
 * "A página está viva?"
 *
 * Quando o conteúdo da janela trava, o processo do app continua de pé e a janela
 * continua respondendo mensagens — de fora não há como saber que a página morreu.
 * Então ela mesma avisa de tempos em tempos, e o servidor de dev guarda o horário;
 * o watchdog (tools\watchdog.ps1) pergunta aqui e reinicia o app quando o aviso fica
 * velho demais.
 *
 * Mora no servidor de dev de propósito: é ferramenta de desenvolvimento — não existe
 * na versão final e não precisa de nada no lado Rust.
 */
function batimentoPlugin(): Plugin {
  let vistoEm = 0;
  // O mesmo middleware serve o dev (`vite`) e o app instalado (`vite preview`): o watchdog
  // pergunta em /__vivo/estado e a pagina avisa em /__vivo.
  const atender = (server: { middlewares: Connect.Server }) => {
    server.middlewares.use("/__vivo", (req, res) => {
        // consulta do watchdog: há quanto tempo a página não avisa
        if ((req.url ?? "").startsWith("/estado")) {
          res.setHeader("content-type", "application/json");
          res.setHeader("cache-control", "no-store");
          res.end(JSON.stringify({ vistoEm, idade: vistoEm ? (Date.now() - vistoEm) / 1000 : null }));
          return;
        }
        vistoEm = Date.now();
        res.statusCode = 204;
        res.end();
      });
  };
  return {
    name: "mdc-batimento",
    configureServer: atender,
    configurePreviewServer: atender,
  };
}

/**
 * O `@huggingface/transformers` embute o onnxruntime e o Vite copia o wasm dele para
 * `assets/` — mas o worker já aponta o runtime para `/ort/` (`public/ort`, que existe em
 * qualquer versão do app). Sem este filtro o MESMO wasm de 26 MB sai duas vezes no `dist`.
 *
 * Só o `.wasm` é descartado; o `.mjs` (pequeno) continua e o `wasmPaths` do worker garante
 * que o runtime busque os binários em `/ort/`.
 */
function semOrtDuplicado(): Plugin {
  return {
    name: "mdc-ort-sem-duplicado",
    apply: "build",
    generateBundle(_opcoes, bundle) {
      for (const [nome, item] of Object.entries(bundle)) {
        if (item.type === "asset" && /(^|\/)ort-wasm-.*\.wasm$/.test(item.fileName)) {
          delete bundle[nome];
        }
      }
    },
  };
}

/** O servidor está rodando dentro de uma worktree? (muda o padrão de `watch.ignored`) */
const emWorktree = /[\\/]\.worktrees[\\/][^\\/]+$/.test(process.cwd());

// Configuração do app (site local, PWA): a porta do `npm run app`/dev é fixa (1420) para o
// endereço não mudar entre uma abertura e outra (o service worker e os handles do disco são
// por origem).
export default defineConfig({
  clearScreen: false,
  plugins: [tempSavePlugin(), ortPlugin(), batimentoPlugin(), semOrtDuplicado()],
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
    // `@huggingface/transformers` (tradução offline) tinha o mesmo destino.
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
      // O vigia nativo do Windows não avisa mudanças em algumas unidades/pastas
      // (aqui, o projeto em A:): sem polling o dev server serve módulos VELHOS — o
      // HMR nunca chega e o código novo só aparece reiniciando o Vite. O polling
      // custa pouco e deixa o ciclo editar→ver confiável.
      usePolling: true,
      interval: 400,
      // `.worktrees` e `dist` ficam de fora porque o servidor de dev não tem nada
      // a ver com eles e a observação atrapalha os dois lados:
      // - o `dist` de uma worktree carrega o modelo de IA (270 MB) e, quando a
      //   worktree é removida, o arquivo fica travado e o observador morre com
      //   EBUSY — o Vite cai junto e o app fecha sozinho;
      // - observar a worktree de outra pessoa é justamente o que o AGENTS.md
      //   pede para não fazer.
      //
      // MAS: quando o próprio servidor roda DENTRO de uma worktree, ignorar
      // `**/.worktrees/**` casa com a raiz inteira e o watcher não vê nada — o dev
      // server passa a servir módulos velhos (HMR nunca chega). Nesse caso a
      // exclusão sai: só a worktree atual é observada.
      ignored: [
        "**/dist/**",
        // estáticos grandes (dicionário, n-gramas, motor da tradução): não mudam em uso e o
        // polling não precisa varrê-los a cada 400 ms
        "**/public/ngrams/**",
        "**/public/ort/**",
        "**/public/dicionario/**",
        "**/temp/**",
        ...(emWorktree ? [] : ["**/.worktrees/**"]),
      ],
    },
  },
  // `npm run app`: serve o `dist/` na mesma porta do dev. É este modo que o navegador
  // instala como PWA (o service worker só é registrado na versão de produção).
  preview: {
    port: 1420,
    strictPort: true,
  },
  build: {
    target: "es2021",
    minify: "esbuild",
    sourcemap: false,
    chunkSizeWarningLimit: 2200,
  },
});
