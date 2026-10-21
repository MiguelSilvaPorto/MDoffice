// Testa a ordem das pastas de projeto na barra lateral:
// - o menu do clique direito move para cima/baixo e persiste;
// - arrastar a linha reordena (com o risco de destino);
// - a ordem sobrevive a recarregar.
//
// Precisa do app rodando (npm run dev) — o roteiro usa o Chrome headless pelo DevTools.
// Uso: node scripts/testar-projetos-ordem.mjs   (MDOFICE_URL aponta para outro lugar se preciso)
import { spawn } from "node:child_process";
import { mkdirSync } from "node:fs";
import { join } from "node:path";

const raiz = process.cwd();
const temp = join(raiz, "temp");
mkdirSync(temp, { recursive: true });

const URL_APP = process.env.MDOFICE_URL || "http://localhost:1431/";
const PORTA = Number(process.env.MDOFFICE_PORTA_CHROME || 9337);
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
    `--user-data-dir=${join(temp, "chrome-projetos")}`,
    `--remote-debugging-port=${PORTA}`,
    "--window-size=1300,800",
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
  let erros = 0;
  ws.addEventListener("message", (ev) => {
    const m = JSON.parse(ev.data);
    if (m.id && pendentes.has(m.id)) {
      pendentes.get(m.id)(m.result);
      pendentes.delete(m.id);
    }
    if (m.method === "Runtime.exceptionThrown") erros++;
  });
  const call = (metodo, params = {}) =>
    new Promise((resolve) => {
      const id = ++seq;
      pendentes.set(id, resolve);
      ws.send(JSON.stringify({ id, method: metodo, params }));
    });

  await call("Page.enable");
  await call("Runtime.enable");
  await call("Page.navigate", { url: URL_APP });

  const avaliar = async (expressao) => {
    const r = await call("Runtime.evaluate", { expression: expressao, returnByValue: true, awaitPromise: true });
    if (r?.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || "erro no script");
    return r?.result?.value;
  };
  const esperarApp = async () => {
    for (let i = 0; i < 60; i++) {
      await espera(500);
      if (await avaliar("document.readyState === 'complete' && document.body.classList.contains('home-open') && (document.querySelector('#home-page')?.innerText || '').trim().length > 0")) return true;
    }
    return false;
  };
  const recomecar = async () => {
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
    await call("Page.reload");
    await espera(1500);
    await esperarApp();
    await espera(800);
    await avaliar("document.querySelector('.modal [data-nao]')?.click()");
    await espera(300);
  };
  const adicionarPastas = async () => {
    await avaliar(`
      (async () => {
        const root = await navigator.storage.getDirectory();
        const dirs = [];
        for (const nome of ['Alfa', 'Beta', 'Gama']) dirs.push(await root.getDirectoryHandle(nome, { create: true }));
        let i = 0;
        window.showDirectoryPicker = async () => dirs[i++];
        for (let k = 0; k < 3; k++) {
          document.getElementById('proj-add')?.click();
          await new Promise((r) => setTimeout(r, 1100));
        }
        return true;
      })()
    `);
    await espera(800);
  };
  const ordem = () =>
    avaliar(`
      Array.from(document.querySelectorAll('#projects-tree > .pj-folder'))
        .map((e) => e.dataset.path)
        .filter((p) => p !== '')
    `);
  const salvo = () => avaliar("JSON.parse(localStorage.getItem('mdc.projects') || '[]').filter((p) => p !== '')");
  const menu = async (indice, rotulo) => {
    return await avaliar(`
      (async () => {
        const linhas = Array.from(document.querySelectorAll('#projects-tree > .pj-folder')).filter((e) => e.dataset.path);
        const alvo = linhas[${indice}];
        const b = alvo.getBoundingClientRect();
        alvo.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: b.left + 20, clientY: b.top + 20 }));
        await new Promise((r) => setTimeout(r, 350));
        const itens = Array.from(document.querySelectorAll('.dropdown .dd-item'));
        const textos = itens.map((e) => (e.textContent || '').trim()).filter(Boolean);
        const item = itens.find((e) => (e.textContent || '').trim() === ${JSON.stringify(rotulo)});
        item?.click();
        await new Promise((r) => setTimeout(r, 600));
        return textos;
      })()
    `);
  };
  const arrastar = async (de, para) => {
    return await avaliar(`
      (async () => {
        const linhas = Array.from(document.querySelectorAll('#projects-tree > .pj-folder')).filter((e) => e.dataset.path);
        const origem = linhas[${de}];
        const alvo = linhas[${para}];
        const ro = origem.getBoundingClientRect();
        const ra = alvo.getBoundingClientRect();
        const x = ro.left + 30;
        const y0 = ro.top + ro.height / 2;
        const y1 = ra.top + ra.height * 0.25;
        origem.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true, button: 0, pointerType: 'mouse', clientX: x, clientY: y0 }));
        window.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, cancelable: true, button: 0, pointerType: 'mouse', clientX: x, clientY: y1 }));
        await new Promise((r) => setTimeout(r, 120));
        const marcado = alvo.className;
        window.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, cancelable: true, button: 0, pointerType: 'mouse', clientX: x, clientY: y1 }));
        await new Promise((r) => setTimeout(r, 600));
        return { marcado, ordem: Array.from(document.querySelectorAll('#projects-tree > .pj-folder')).map((e) => e.dataset.path).filter((p) => p !== '') };
      })()
    `);
  };

  await esperarApp();
  await recomecar();
  await adicionarPastas();

  let antes = await ordem();
  ok("três pastas de projeto aparecem", antes.length >= 3, JSON.stringify(antes));
  const original = [...antes];

  // ------------------------------------------------------------------ 1
  // menu do clique direito: a segunda pasta sobe
  const segundo = original[1];
  const menuItens = await menu(1, "Mover para cima");
  let depois = await ordem();
  ok("o menu oferece Mover para cima", Array.isArray(menuItens) && menuItens.includes("Mover para cima"), JSON.stringify(menuItens));
  ok("Mover para cima troca a ordem", depois[0] === segundo && depois[1] === original[0], JSON.stringify(depois));
  ok("a ordem nova foi gravada", JSON.stringify(await salvo()) === JSON.stringify(depois), JSON.stringify(await salvo()));

  // ------------------------------------------------------------------ 2
  // arrastar a terceira linha para cima da primeira
  const arrasto = await arrastar(2, 0);
  const alvoMarcado = /pj-antes|pj-depois/.test(arrasto.marcado);
  ok("o arrasto acende o destino", alvoMarcado, arrasto.marcado);
  ok("o arrasto reordena", JSON.stringify(arrasto.ordem) === JSON.stringify([depois[2], depois[0], depois[1]]), JSON.stringify(arrasto.ordem));
  ok("a ordem do arrasto foi gravada", JSON.stringify(await salvo()) === JSON.stringify(arrasto.ordem), JSON.stringify(await salvo()));

  // ------------------------------------------------------------------ 3
  // recarregar mantém a ordem
  const ordemAntes = await ordem();
  await call("Page.reload");
  await espera(1500);
  await esperarApp();
  await espera(1000);
  const ordemDepois = await ordem();
  ok("a ordem sobrevive ao reload", JSON.stringify(ordemDepois) === JSON.stringify(ordemAntes), JSON.stringify({ ordemAntes, ordemDepois }));
  ok("sem erro de JavaScript durante o roteiro", erros === 0, String(erros));

  ws.close();
  proc.kill();
  console.log(falhas ? `\n${falhas} FALHA(S)` : "\nTudo certo.");
  process.exit(falhas ? 1 : 0);
}

main().catch((e) => {
  console.error("ERRO:", e.message);
  process.exit(1);
});
