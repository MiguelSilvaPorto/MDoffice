// Testa a busca de funções (Ctrl+K) no app de verdade: a barra no topo, o
// filtro por módulo, os botões da fita com o ícone, a execução do comando e a
// guarda dos atalhos durante a digitação.
//
// Precisa do app rodando (npm run dev) — o roteiro roda no Chrome headless e
// fala com a página pelo DevTools.
//
// Uso: node scripts/testar-busca.mjs   (MDOFICE_URL aponta para outro lugar se preciso)
import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const raiz = process.cwd();
const temp = join(raiz, "temp");
mkdirSync(temp, { recursive: true });

const URL_APP = process.env.MDOFICE_URL || "http://localhost:1431/";
const PORTA = Number(process.env.MDOFFICE_PORTA_CHROME || 9333);
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
    `--user-data-dir=${join(temp, "chrome-busca")}`,
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
  const foto = async (nome) => {
    const r = await call("Page.captureScreenshot", { format: "png" });
    writeFileSync(join(temp, `busca-${nome}.png`), Buffer.from(r.data, "base64"));
  };
  const tecla = async (key, code, vk, modificadores = 0) => {
    await call("Input.dispatchKeyEvent", { type: "keyDown", key, code, windowsVirtualKeyCode: vk, modifiers: modificadores });
    await call("Input.dispatchKeyEvent", { type: "keyUp", key, code, windowsVirtualKeyCode: vk, modifiers: modificadores });
  };
  const digitar = async (texto) => {
    await avaliar(`
      (() => {
        const i = document.getElementById('busca-input');
        i.value = ${JSON.stringify(texto)};
        i.dispatchEvent(new Event('input', { bubbles: true }));
      })()
    `);
    await espera(250);
  };
  const abrir = async () => {
    for (let i = 0; i < 30; i++) {
      await avaliar("document.getElementById('busca-input').focus()");
      await espera(350);
      if (await avaliar("document.getElementById('busca').classList.contains('aberta')")) return true;
    }
    return false;
  };
  const rotulos = () =>
    avaliar(
      "Array.from(document.querySelectorAll('#busca-painel .busca-item')).map(e => e.querySelector('.bi-label').textContent + (e.querySelector('.bi-modulo') ? ' [' + e.querySelector('.bi-modulo').textContent + ']' : ''))"
    );
  const grupos = () => avaliar("Array.from(document.querySelectorAll('#busca-painel .bp-grupo')).map(e => e.textContent)");
  const contexto = () => avaliar("document.querySelector('#busca-painel .bp-contexto')?.textContent");
  const clicarEm = async (rotulo) => {
    await avaliar(`
      (() => {
        const b = Array.from(document.querySelectorAll('#busca-painel .busca-item'))
          .find(e => e.querySelector('.bi-label').textContent === ${JSON.stringify(rotulo)});
        b?.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
      })()
    `);
  };

  // espera o app (o estilo entra junto com o módulo: sem ele, a barra ainda
  // está sem desenho e a medida sai errada)
  const esperarApp = async () => {
    for (let i = 0; i < 60; i++) {
      await espera(300);
      if (await avaliar("!!document.getElementById('busca-input') && getComputedStyle(document.getElementById('busca')).display === 'flex'")) return true;
    }
    return false;
  };
  await esperarApp();

  // a sessão do app não pode vazar de uma rodada para a outra: começa do zero
  await avaliar("try { localStorage.clear(); } catch (e) {}");
  await call("Page.reload");
  await espera(1500);
  await esperarApp();
  await espera(2500);

  // ------------------------------------------------------------------ 1
  const alturaBarra = await avaliar("document.getElementById('busca').getBoundingClientRect().height");
  ok("a barra existe no topo e é pequena", alturaBarra <= 26, `altura=${alturaBarra}`);
  ok("nada escurece a tela com a busca aberta (não é modal)", await avaliar("!document.querySelector('.modal-backdrop')"));

  ok("a busca abre", await abrir());
  ok("o painel aparece", await avaliar("!document.getElementById('busca-painel').hasAttribute('hidden')"));
  ok("a lista tem os comandos do app", (await rotulos()).length > 30, String((await rotulos()).length));
  console.log("      grupos:", JSON.stringify(await grupos()));
  await foto("1-busca");

  // o grupo do documento entra na lista
  ok("o contexto é o módulo do documento", (await contexto()) === "Markdown" || (await contexto()) === "Todas as funções", String(await contexto()));

  // ------------------------------------------------------------------ 2
  await digitar("alinhar");
  const alinhar = await rotulos();
  ok("a busca acha os botões da barra do documento", alinhar.some((r) => r.startsWith("Alinhar à esquerda")), JSON.stringify(alinhar));
  ok("cada resultado mostra o ícone do botão", await avaliar("!!document.querySelector('#busca-painel .busca-item .bi-icone svg, #busca-painel .busca-item .bi-icone')"));
  await foto("2-alinhar");

  // ------------------------------------------------------------------ 3
  await digitar("xyzxyznaoexiste");
  ok("nada encontrado mostra a mensagem", await avaliar("!!document.querySelector('#busca-painel .bp-vazio')"));

  // ------------------------------------------------------------------ 4
  // cria uma planilha pela própria busca
  await digitar("Nova planilha");
  ok("a busca acha o comando de criar planilha", (await rotulos()).includes("Nova planilha (.xlsx)"));
  await clicarEm("Nova planilha (.xlsx)");
  await espera(3000);
  ok("a planilha abriu", await avaliar("document.body.classList.contains('xlsx-open')"));
  ok("a busca fecha depois de executar", await avaliar("!document.getElementById('busca').classList.contains('aberta')"));

  // ------------------------------------------------------------------ 5
  ok("a busca abre de novo", await abrir());
  ok("o contexto virou a planilha", (await contexto()) === "Planilha (.xlsx)", String(await contexto()));
  const gPlanilha = await grupos();
  ok("as fitas da planilha entram (com a aba e o grupo)", gPlanilha.some((g) => g.includes("Biblioteca de Funções")), JSON.stringify(gPlanilha));
  await digitar("soma");
  ok("a função de outra aba da planilha é achada", (await rotulos()).includes("AutoSoma"), JSON.stringify(await rotulos()));
  await foto("3-planilha");

  // ------------------------------------------------------------------ 6
  // uma função de OUTRO módulo aparece (com a etiqueta) quando a do módulo
  // atual não existe: cria uma apresentação e procura uma função dela
  await digitar("Nova apresentação");
  await clicarEm("Nova apresentação (.pptx)");
  await espera(3000);
  ok("a apresentação abriu", await avaliar("document.body.classList.contains('ppt-open')"));
  // volta para a planilha (pela barra de abas — a aba troca no pointerdown)
  await avaliar(`
    (() => {
      const t = Array.from(document.querySelectorAll('.tab')).find(e => e.textContent.includes('Planilha'));
      t?.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0 }));
      t?.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, button: 0 }));
    })()
  `);
  await espera(2000);
  ok("voltou para a planilha", await avaliar("document.body.classList.contains('xlsx-open')"));
  await abrir();
  await digitar("transição");
  const deOutro = await rotulos();
  ok("a função de outro módulo vem com a etiqueta", deOutro.some((r) => r.includes("[Apresentação]")), JSON.stringify(deOutro));
  await foto("4-outro-modulo");

  // ------------------------------------------------------------------ 7
  // o alternador "ver todos os módulos"
  await digitar("zzzz");
  await avaliar(`
    (() => {
      const b = document.querySelector('#busca-painel .br-todos');
      b?.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    })()
  `);
  await espera(300);
  ok("o alternador existe e liga", await avaliar("document.querySelector('#busca-painel .br-todos')?.classList.contains('on')"));

  // ------------------------------------------------------------------ 8
  // a guarda dos atalhos: digitar na busca não dispara atalho do app
  await avaliar("document.getElementById('busca-input').blur()");
  await tecla("Escape", "Escape", 27);
  await espera(300);
  await avaliar(`
    (() => {
      const t = Array.from(document.querySelectorAll('.tab')).find(e => e.textContent.includes('Documento'));
      t?.click();
    })()
  `);
  await espera(1500);
  const antes = await avaliar("document.querySelector('.cm-content')?.innerText || ''");
  await abrir();
  await digitar("teste");
  await tecla("b", "KeyB", 66, 2); // Ctrl+B
  await espera(400);
  ok("o atalho do app não dispara enquanto a pessoa digita", (await avaliar("document.querySelector('.cm-content')?.innerText || ''")) === antes);
  ok("o campo da busca continua com o que foi digitado", (await avaliar("document.getElementById('busca-input').value")) === "teste");

  // ------------------------------------------------------------------ 9
  // clicar fora fecha a busca
  await call("Input.dispatchMouseEvent", { type: "mousePressed", x: 200, y: 700, button: "left", clickCount: 1 });
  await call("Input.dispatchMouseEvent", { type: "mouseReleased", x: 200, y: 700, button: "left", clickCount: 1 });
  await espera(400);
  ok("clicar fora fecha a busca", await avaliar("!document.getElementById('busca').classList.contains('aberta')"));

  // ------------------------------------------------------------------ 10
  // o Ctrl+K abre a busca
  await tecla("k", "KeyK", 75, 2);
  await espera(500);
  ok("o Ctrl+K abre a busca", await avaliar("document.getElementById('busca').classList.contains('aberta')"));
  await tecla("Escape", "Escape", 27);

  // ------------------------------------------------------------------ 11
  // executar um botão da fita: cria um documento e insere uma tabela
  await digitar("Novo documento (nova aba)");
  await clicarEm("Novo documento (nova aba)");
  await espera(1800);
  const antesTabela = await avaliar("document.querySelector('.cm-content')?.innerText || ''");
  await abrir();
  await digitar("tabela");
  await clicarEm("Tabela");
  await espera(1200);
  const depoisTabela = await avaliar("document.querySelector('.cm-content')?.innerText || ''");
  ok("o botão da fita roda pela busca", depoisTabela !== antesTabela && depoisTabela.includes("| Coluna A |"), JSON.stringify(depoisTabela.slice(0, 40)));
  await foto("4-execucao");

  ws.close();
  proc.kill();

  console.log(falhas ? `\n${falhas} FALHA(S)` : "\nTudo certo.");
  process.exit(falhas ? 1 : 0);
}

main().catch((e) => {
  console.error("ERRO:", e.message);
  process.exit(1);
});
