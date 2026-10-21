// Testa a pasta dos rascunhos do navegador: escolher em Configurações, gravar o
// documento novo como arquivo .md de verdade, reabrir depois do reload e trocar
// de pasta. Também confere o aviso quando não há pasta nenhuma.
//
// Precisa do app rodando (npm run dev) — o roteiro usa o Chrome headless pelo DevTools.
// Uso: node scripts/testar-rascunhos.mjs   (MDOFICE_URL aponta para outro lugar se preciso)
import { spawn } from "node:child_process";
import { mkdirSync } from "node:fs";
import { join } from "node:path";

const raiz = process.cwd();
const temp = join(raiz, "temp");
mkdirSync(temp, { recursive: true });

const URL_APP = process.env.MDOFICE_URL || "http://localhost:1431/";
const PORTA = Number(process.env.MDOFFICE_PORTA_CHROME || 9335);
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
    `--user-data-dir=${join(temp, "chrome-rascunhos")}`,
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
    await espera(900);
    await avaliar("document.querySelector('.modal [data-nao]')?.click()");
    await espera(300);
  };
  const abrirConfig = async () => {
    // o catálogo de comandos só existe depois que o app terminou de iniciar (Home
    // montada ou a sessão restaurada). Sem esta espera, o Ctrl+K abria uma paleta vazia.
    for (let i = 0; i < 24; i++) {
      if (await avaliar("document.readyState === 'complete' && (!!document.querySelector('.tab') || (document.querySelector('#home-page')?.innerText || '').trim().length > 0)")) break;
      await espera(300);
    }
    // o convite de backup pode aparecer DEPOIS do primeiro clique do `recomecar`;
    // enquanto ele está na frente, o Ctrl+K não chega ao app
    await avaliar("document.querySelector('.modal [data-nao]')?.click()");
    await espera(400);
    // tenta de novo até a página de Configurações estar de pé
    for (let i = 0; i < 12; i++) {
      const abriu = await avaliar(`
        (async () => {
          window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true }));
          await new Promise((r) => setTimeout(r, 250));
          const i = document.getElementById('busca-input');
          if (!i) return false;
          i.value = 'Abrir configurações';
          i.dispatchEvent(new Event('input', { bubbles: true }));
          await new Promise((r) => setTimeout(r, 250));
          const item = Array.from(document.querySelectorAll('#busca-painel .busca-item'))
            .find((e) => (e.querySelector('.bi-label')?.textContent || '').includes('Abrir configurações'));
          item?.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
          await new Promise((r) => setTimeout(r, 700));
          return !!document.querySelector('[data-act="drafts-dir"]');
        })()
      `);
      if (abriu) return true;
      await espera(500);
    }
    return false;
  };
  const escolherPasta = async (nome) => {
    await avaliar(`
      (async () => {
        const root = await navigator.storage.getDirectory();
        const dir = await root.getDirectoryHandle(${JSON.stringify(nome)}, { create: true });
        window.showDirectoryPicker = async () => dir;
        document.querySelector('[data-act="drafts-dir"]')?.click();
        await new Promise((r) => setTimeout(r, 1600));
        return true;
      })()
    `);
  };
  const novoDocumento = async (texto) => {
    await avaliar("document.querySelector('[data-act=\"new\"]')?.click()");
    await espera(900);
    await avaliar("document.querySelector('.cm-content')?.focus()");
    await espera(200);
    // texto de verdade no elemento focado (o execCommand falhava quando a aba
    // demorava a assumir o foco depois do reload)
    await call("Input.insertText", { text: texto });
    await espera(5200);
  };
  const lerPasta = async (nome) => {
    return await avaliar(`
      (async () => {
        const root = await navigator.storage.getDirectory();
        const dir = await root.getDirectoryHandle(${JSON.stringify(nome)}, { create: true });
        const saida = [];
        for await (const [chave, h] of dir.entries()) {
          if (h.kind !== 'file' || !/\\.(md|markdown|mdx)$/i.test(chave)) continue;
          const f = await h.getFile();
          saida.push({ nome: chave, texto: await f.text() });
        }
        return saida;
      })()
    `);
  };
  const estado = () =>
    avaliar(`(() => ({
      titulo: document.title,
      texto: document.querySelector('.cm-content')?.innerText || '',
      linhaPasta: document.querySelector('[data-drafts-root]')?.textContent || '',
      barra: Array.from(document.querySelectorAll('#statusbar *, .tb-autosave-text')).map((e) => e.textContent).filter(Boolean).join(' | '),
      toasts: Array.from(document.querySelectorAll('.toast')).map((e) => e.textContent),
      sessao: localStorage.getItem('mdc.session') || ''
    }))()`);

  // a aba pode abrir em about:blank; navega e espera o app
  await call("Page.navigate", { url: URL_APP });
  await espera(1500);
  await esperarApp();
  await recomecar();

  // ------------------------------------------------------------------ 1
  // escolher a pasta e gravar o primeiro rascunho
  ok("1: as Configurações abriram", await abrirConfig());
  await escolherPasta("Rascunhos");
  let e = await estado();
  ok("1: a pasta escolhida aparece nas Configurações", /Rascunhos/.test(e.linhaPasta), e.linhaPasta);

  await novoDocumento("primeiro rascunho gravado como arquivo");
  e = await estado();
  let arquivos = await lerPasta("Rascunhos");
  ok("1: o documento novo virou um arquivo .md", arquivos.length === 1 && arquivos[0].texto.includes("primeiro rascunho"), JSON.stringify(arquivos));
  ok("1: a aba mostra o nome do arquivo", /documento\.md/i.test(e.titulo), e.titulo);
  ok("1: o rodapé diz que é rascunho da pasta escolhida", /Rascunho.*pasta escolhida/i.test(e.barra), e.barra.slice(0, 160));
  ok("1: nenhum aviso de erro de rascunho", !e.toasts.some((t) => /Não consegui guardar|Sem pasta/i.test(t)), JSON.stringify(e.toasts));

  // ------------------------------------------------------------------ 2
  // fechar/reabrir: a sessão volta pelo ARQUIVO, não por uma aba sem caminho
  await call("Page.reload");
  await espera(1500);
  await esperarApp();
  await espera(1500);
  e = await estado();
  const arquivosDepois = await lerPasta("Rascunhos");
  ok("2: o texto voltou depois do reload", e.texto.includes("primeiro rascunho"), JSON.stringify(e.texto.slice(0, 80)));
  ok("2: o mesmo arquivo foi reaberto", /documento\.md/i.test(e.titulo), e.titulo);
  ok("2: a sessão guarda o caminho do rascunho", /rascunho\/documento\.md/.test(e.sessao), e.sessao);
  ok("2: o arquivo não foi duplicado", arquivosDepois.length === 1, JSON.stringify(arquivosDepois.map((a) => a.nome)));

  // ------------------------------------------------------------------ 3
  // trocar a pasta: os próximos rascunhos vão para a nova
  await abrirConfig();
  await escolherPasta("Rascunhos2");
  await novoDocumento("segundo rascunho em outra pasta");
  const pasta2 = await lerPasta("Rascunhos2");
  const pasta1 = await lerPasta("Rascunhos");
  ok("3: o rascunho novo foi para a pasta nova", pasta2.length === 1 && pasta2[0].texto.includes("segundo rascunho"), JSON.stringify(pasta2));
  ok("3: o rascunho antigo ficou onde estava", pasta1.length === 1 && pasta1[0].texto.includes("primeiro rascunho"), JSON.stringify(pasta1));

  // ------------------------------------------------------------------ 4
  // remover a pasta: o autosave não pode dizer que salvou
  await abrirConfig();
  await avaliar("document.querySelector('[data-act=\"drafts-clear\"]')?.click()");
  await espera(800);
  await novoDocumento("rascunho sem pasta nenhuma");
  e = await estado();
  const toasts = e.toasts.join(" ");
  ok("4: o app avisa que não está gravando", /Sem pasta|não está sendo gravado/i.test(e.barra + " " + toasts), (e.barra + " " + toasts).slice(0, 200));
  ok("4: o rodapé não diz que salvou", !/Rascunho \(pasta escolhida\)/i.test(e.barra), e.barra.slice(0, 160));

  ws.close();
  proc.kill();

  console.log(falhas ? `\n${falhas} FALHA(S)` : "\nTudo certo.");
  process.exit(falhas ? 1 : 0);
}

main().catch((e) => {
  console.error("ERRO:", e.message);
  process.exit(1);
});
