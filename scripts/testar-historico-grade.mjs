// Testa o desenho em GRADE da seção Histórico e salvamento:
// - resumo do documento em 3 colunas e demais grupos em 2;
// - nenhum cartão estourando para a direita;
// - em tela estreita, tudo cai para uma coluna.
//
// Precisa do app rodando (npm run dev) — o roteiro usa o Chrome headless pelo DevTools.
// Uso: node scripts/testar-historico-grade.mjs   (MDOFICE_URL aponta para outro lugar se preciso)
import { spawn } from "node:child_process";
import { mkdirSync } from "node:fs";
import { join } from "node:path";

const raiz = process.cwd();
const temp = join(raiz, "temp");
mkdirSync(temp, { recursive: true });

const URL_APP = process.env.MDOFICE_URL || "http://localhost:1431/";
const PORTA = Number(process.env.MDOFFICE_PORTA_CHROME || 9336);
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
    `--user-data-dir=${join(temp, "chrome-historico-teste")}`,
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
  await call("Emulation.setDeviceMetricsOverride", { width: 1300, height: 800, deviceScaleFactor: 1, mobile: false });
  await call("Page.navigate", { url: URL_APP });

  const avaliar = async (expressao) => {
    const r = await call("Runtime.evaluate", { expression: expressao, returnByValue: true, awaitPromise: true });
    if (r?.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || "erro no script");
    return r?.result?.value;
  };

  // espera o app (o carregamento do dicionário acontece depois; a Home já basta)
  for (let i = 0; i < 80; i++) {
    await espera(500);
    if (await avaliar("document.readyState === 'complete' && document.body.classList.contains('home-open') && (document.querySelector('#home-page')?.innerText || '').trim().length > 0")) break;
  }
  await avaliar("document.querySelector('.modal [data-nao]')?.click()");
  await espera(400);

  // abre Configurações > Histórico pelo catálogo
  for (let i = 0; i < 12; i++) {
    const abriu = await avaliar(`
      (async () => {
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', code: 'KeyK', ctrlKey: true, bubbles: true }));
        await new Promise((r) => setTimeout(r, 250));
        const input = document.getElementById('busca-input');
        if (!input) return false;
        input.value = 'Abrir configurações';
        input.dispatchEvent(new Event('input', { bubbles: true }));
        await new Promise((r) => setTimeout(r, 250));
        const item = Array.from(document.querySelectorAll('#busca-painel .busca-item'))
          .find((e) => /configura/i.test(e.querySelector('.bi-label')?.textContent || ''));
        item?.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
        await new Promise((r) => setTimeout(r, 700));
        document.querySelector('[data-nav="historico"]')?.click();
        await new Promise((r) => setTimeout(r, 400));
        return !!document.querySelector('[data-sec="historico"]:not([hidden])');
      })()
    `);
    if (abriu) break;
    await espera(500);
  }

  const cols = (sel) =>
    avaliar(`(() => {
      const el = document.querySelector(${JSON.stringify(sel)});
      if (!el) return -1;
      return getComputedStyle(el).gridTemplateColumns.split(' ').filter(Boolean).length;
    })()`);
  const alturaSecao = () =>
    avaliar("Math.round(document.querySelector('[data-sec=\"historico\"]')?.getBoundingClientRect().height || 0)");

  ok("a seção Histórico abriu", (await cols('[data-sec="historico"] .st-grid-3')) > 0);
  ok("o resumo está em 3 colunas", (await cols('[data-sec="historico"] .st-grid-3')) === 3);
  ok("as cópias estão em 2 colunas", (await cols('[data-sec="historico"] .st-recover')) === 2);
  ok("o salvamento está em 2 colunas", (await cols('[data-sec="historico"] .st-grid-2:not(.st-recover)')) === 2);
  ok("os quatro atalhos do documento existem", await avaliar("['hist-versoes','hist-alteracoes','hist-backup','hist-apagar'].every((a) => !!document.querySelector('[data-act=\"' + a + '\"]'))"));
  ok("o autosave ocupa a linha inteira", await avaliar("!!document.querySelector('[data-k=\"autosave\"]')?.closest('.st-row')?.classList.contains('wide')"));

  const estouros = await avaliar(`
    Array.from(document.querySelectorAll('[data-sec="historico"] .st-grid > .st-row'))
      .filter((c) => c.scrollWidth > c.clientWidth + 1)
      .map((c) => c.querySelector('.st-text b')?.textContent || c.className)
  `);
  ok("nenhum cartão estoura para a direita", estouros.length === 0, JSON.stringify(estouros));

  const altura = await alturaSecao();
  ok("a seção ficou mais curta que a pilha antiga", altura > 0 && altura < 1900, `${altura}px`);

  // tela estreita: todas as grades caem para uma coluna
  await call("Emulation.setDeviceMetricsOverride", { width: 800, height: 800, deviceScaleFactor: 1, mobile: false });
  await espera(700);
  const colunasEstreitas = await avaliar(`
    Array.from(document.querySelectorAll('[data-sec="historico"] .st-grid'))
      .map((g) => getComputedStyle(g).gridTemplateColumns.split(' ').filter(Boolean).length)
  `);
  ok("em tela estreita tudo vira uma coluna", colunasEstreitas.length > 0 && colunasEstreitas.every((n) => n === 1), JSON.stringify(colunasEstreitas));
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
