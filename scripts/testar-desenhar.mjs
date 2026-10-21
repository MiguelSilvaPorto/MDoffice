// Testa o botão Desenhar num documento NOVO no navegador.
//
// O desenho grava o PNG e o JSON em `assets/`, ao lado do documento — então o
// documento precisa de um arquivo antes. No navegador o app cria o rascunho em
// `.mdoffice/rascunhos/`; quando essa pasta não existe (sem pasta concedida ou
// backend antigo), a ação pede para salvar o documento uma vez em vez de morrer
// com "Não consegui guardar o rascunho: O documento não está mais disponível.".
//
// Precisa do app rodando (npm run dev) — o roteiro usa o Chrome headless pelo DevTools.
// Uso: node scripts/testar-desenhar.mjs   (MDOFICE_URL aponta para outro lugar se preciso)
import { spawn } from "node:child_process";
import { mkdirSync } from "node:fs";
import { join } from "node:path";

const raiz = process.cwd();
const temp = join(raiz, "temp");
mkdirSync(temp, { recursive: true });

const URL_APP = process.env.MDOFICE_URL || "http://localhost:1431/";
const PORTA = Number(process.env.MDOFFICE_PORTA_CHROME || 9334);
const chrome = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";

const espera = (ms) => new Promise((r) => setTimeout(r, ms));

let falhas = 0;
const ok = (nome, cond, detalhe = "") => {
  if (!cond) falhas++;
  console.log(`${cond ? "OK   " : "FALHA"} ${nome}${detalhe ? "  " + detalhe : ""}`);
};

async function main() {
  const proc = spawn(chrome, [
    "--headless=new",
    "--disable-gpu",
    "--hide-scrollbars",
    "--no-first-run",
    "--no-default-browser-check",
    // perfil limpo: a sessão do app não muda de uma rodada para outra
    `--user-data-dir=${join(temp, "chrome-desenhar")}`,
    `--remote-debugging-port=${PORTA}`,
    "--window-size=1500,900",
    "about:blank",
  ], { stdio: "ignore" });

  let alvo = null;
  for (let i = 0; i < 40 && !alvo; i++) {
    await espera(300);
    try {
      const r = await fetch(`http://127.0.0.1:${PORTA}/json/new?${encodeURIComponent(URL_APP)}`, { method: "PUT" });
      alvo = await r.json();
    } catch {
      /* o Chrome ainda está subindo */
    }
  }
  if (!alvo) throw new Error("Chrome não respondeu na porta de depuração.");

  const ws = new WebSocket(alvo.webSocketDebuggerUrl);
  await new Promise((r) => ws.addEventListener("open", r, { once: true }));
  let seq = 0;
  const pendentes = new Map();
  ws.addEventListener("message", (ev) => {
    const m = JSON.parse(ev.data);
    if (m.id && pendentes.has(m.id)) {
      pendentes.get(m.id)(m.result);
      pendentes.delete(m.id);
    }
  });
  const call = (metodo, params = {}) =>
    new Promise((resolve) => {
      const id = ++seq;
      pendentes.set(id, resolve);
      ws.send(JSON.stringify({ id, method: metodo, params }));
    });

  await call("Page.enable");
  await call("Runtime.enable");

  const avaliar = async (expressao) => {
    const r = await call("Runtime.evaluate", { expression: expressao, returnByValue: true, awaitPromise: true });
    if (r?.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || "erro no script");
    return r?.result?.value;
  };
  const esperarApp = async () => {
    for (let i = 0; i < 60; i++) {
      await espera(300);
      if (await avaliar("!!document.getElementById('busca-input') && getComputedStyle(document.getElementById('busca')).display === 'flex'")) return true;
    }
    return false;
  };
  const limpar = async () => {
    // apaga o registro de handles, a sessão e os arquivos do OPFS
    await avaliar(`
      (async () => {
        try { indexedDB.deleteDatabase('mdc-disco'); } catch (e) {}
        localStorage.clear();
        const root = await navigator.storage.getDirectory();
        for await (const [nome] of root.entries()) {
          try { await root.removeEntry(nome, { recursive: true }); } catch (e) {}
        }
        return true;
      })()
    `);
  };
  const recomecar = async () => {
    await limpar();
    await call("Page.reload");
    await espera(1500);
    await esperarApp();
    await espera(1000);
    // a sessão limpa abre o convite de backup: ele é um modal do app e cobre a tela
    await avaliar("document.querySelector('.modal [data-nao]')?.click()");
    await espera(400);
  };
  const concederPasta = async () => {
    // o OPFS é um disco de verdade no navegador e serve de "pasta concedida"
    await avaliar(`
      (async () => {
        const root = await navigator.storage.getDirectory();
        window.showDirectoryPicker = async () => root;
        document.getElementById('proj-add')?.click();
        await new Promise((r) => setTimeout(r, 800));
        return true;
      })()
    `);
  };
  const novoDocumento = async () => {
    await avaliar("document.querySelector('button[title^=\"Novo documento\"]')?.click()");
    await espera(500);
  };
  const clicarDesenhar = async () => {
    await avaliar("document.querySelector('[data-act=\"draw\"]')?.click()");
    await espera(5500);
  };
  const estado = () =>
    avaliar(`(() => ({
      titulo: document.title,
      texto: document.querySelector('.cm-content')?.innerText || '',
      quadro: !!document.querySelector('.draw-inline'),
      toasts: Array.from(document.querySelectorAll('.toast')).map((e) => e.textContent)
    }))()`);

  // a aba pode ter aberto em about:blank antes do app: navega e espera a página
  await call("Page.navigate", { url: URL_APP });
  await espera(1500);
  await esperarApp();

  // ------------------------------------------------------------------ 1
  // com a pasta concedida, o rascunho do navegador (.mdoffice/rascunhos) resolve
  await recomecar();
  await concederPasta();
  await novoDocumento();
  await clicarDesenhar();
  let e = await estado();
  ok("1: nenhum erro ao guardar o rascunho", !e.toasts.some((t) => t.includes("Não consegui guardar o rascunho")), JSON.stringify(e.toasts));
  ok("1: o desenho entrou no Markdown", e.texto.includes("![Desenho]("), JSON.stringify(e.texto.slice(0, 80)));
  ok("1: o quadro abriu no documento", e.quadro);
  ok("1: a aba mostra o nome do rascunho", /documento\.md/i.test(e.titulo), e.titulo);

  // ------------------------------------------------------------------ 2
  // sem a pasta de rascunhos (navegador/backend antigo), o Desenhar pede para
  // salvar o documento uma vez — e usa o arquivo escolhido como base do assets/
  await recomecar();
  await concederPasta();
  await avaliar(`
    (async () => {
      const root = await navigator.storage.getDirectory();
      const proto = FileSystemDirectoryHandle.prototype;
      const original = proto.getDirectoryHandle;
      proto.getDirectoryHandle = function (nome, opts) {
        if (nome === '.mdoffice') throw new DOMException('sem rascunhos', 'NotFoundError');
        return original.call(this, nome, opts);
      };
      window.__picker = 0;
      window.showSaveFilePicker = async () => {
        window.__picker++;
        return root.getFileHandle('desenho-teste.md', { create: true });
      };
      return true;
    })()
  `);
  await novoDocumento();
  await clicarDesenhar();
  e = await estado();
  const picker = await avaliar("window.__picker");
  ok("2: o seletor de salvar foi chamado", picker >= 1, String(picker));
  ok("2: nenhum erro ao guardar o rascunho", !e.toasts.some((t) => t.includes("Não consegui guardar o rascunho")), JSON.stringify(e.toasts));
  ok("2: o desenho entrou no Markdown", e.texto.includes("![Desenho]("), JSON.stringify(e.texto.slice(0, 80)));
  ok("2: o quadro abriu no documento", e.quadro);
  ok("2: a aba mostra o arquivo escolhido", /desenho-teste\.md/i.test(e.titulo), e.titulo);

  ws.close();
  proc.kill();

  console.log(falhas ? `\n${falhas} FALHA(S)` : "\nTudo certo.");
  process.exit(falhas ? 1 : 0);
}

main().catch((e) => {
  console.error("ERRO:", e.message);
  process.exit(1);
});
