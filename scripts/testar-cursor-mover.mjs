// Testa o CURSOR e o ARRASTO das formas escolhidas no palco do PowerPoint.
//
// O que estava errado (relato com print): com a box escolhida, a parte VAZIA dela não dizia
// nada — o ponteiro ficava com o cursor normal e o clique no vazio caía na lâmina (desfazendo a
// escolha). A causa: a classe `pp-pega` (que torna o miolo da box sem preenchimento uma área de
// arrasto, com o cursor de mover) era calculada no DESENHO da lâmina — e a lâmina só é redesenhada
// quando o conteúdo muda, não quando a escolha muda. Como a escolha nunca chega ao desenho, a
// classe nunca era aplicada.
//
// O teste roda o app DE VERDADE (Vite + Chrome) e confere:
//  - escolhida, a box sem preenchimento ganha `pp-escolhida` e `pp-pega`;
//  - o cursor no VAZIO da box escolhida é o de mover;
//  - o cursor nas LETRAS é o de texto (o clique nelas entra na edição);
//  - arrastar a partir do vazio move a box;
//  - sem escolha, o vazio continua clique-atrás (não esconde o que está embaixo).
// Uso: node scripts/testar-cursor-mover.mjs
import { spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";

const raiz = new URL("..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";

let falhas = 0;
const ok = (nome, cond, detalhe = "") => {
  if (!cond) falhas++;
  console.log(`${cond ? "OK   " : "FALHA"} ${nome}${detalhe ? "  " + detalhe : ""}`);
};
const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

/** Uma porta livre: um Vite antigo (de outra worktree) pode estar segurando a fixa. */
const portaLivre = async (primeira) => {
  for (let p = primeira; p < primeira + 20; p++) {
    const livre = await new Promise((resolve) => {
      const s = createServer();
      s.once("error", () => resolve(false));
      s.once("listening", () => s.close(() => resolve(true)));
      s.listen(p, "127.0.0.1");
    });
    if (livre) return p;
  }
  throw new Error("nenhuma porta livre");
};

// ---------------------------------------------------------------------------
// o ambiente: Vite (dev) + Chrome sem cabeça, falados por CDP
// ---------------------------------------------------------------------------
const perfil = mkdtempSync(join(tmpdir(), "mdc-cursor-"));
const PORTA = await portaLivre(1491);
// o Vite direto (sem shell): o npx.cmd nao aceita spawn sem shell nesta versao do Node
const vite = spawn(process.execPath, [join(raiz, "node_modules", "vite", "bin", "vite.js"), "--port", String(PORTA), "--strictPort"], { cwd: raiz, stdio: "ignore" });
let chrome = null;
const limpar = async () => {
  try { chrome?.kill(); } catch { /* ja saiu */ }
  try { vite.kill(); } catch { /* ja saiu */ }
  await dormir(300);
  try { rmSync(perfil, { recursive: true, force: true }); } catch { /* nada */ }
};
process.on("exit", () => { try { chrome?.kill(); } catch { /* nada */ } try { vite.kill(); } catch { /* nada */ } });

let subiu = false;
for (let i = 0; i < 60 && !subiu; i++) {
  try {
    const r = await fetch(`http://localhost:${PORTA}/`);
    if (r.ok) subiu = true;
  } catch { /* ainda subindo */ }
  if (!subiu) await dormir(500);
}
if (!subiu) {
  console.log(`FALHA o servidor de desenvolvimento nao subiu na porta ${PORTA}`);
  await limpar();
  process.exit(1);
}

const portaCdp = 9401;
chrome = spawn(CHROME, ["--headless=new", "--disable-gpu", "--no-sandbox", "--window-size=1600,1000", `--remote-debugging-port=${portaCdp}`, `--user-data-dir=${perfil}`, "--no-first-run", "--no-default-browser-check", "about:blank"], { stdio: "ignore" });

let ws = null;
for (let i = 0; i < 60 && !ws; i++) {
  try {
    const r = await fetch(`http://127.0.0.1:${portaCdp}/json`);
    const lista = await r.json();
    const pagina = lista.find((t) => t.type === "page");
    if (pagina) ws = new WebSocket(pagina.webSocketDebuggerUrl);
  } catch { /* chrome ainda subindo */ }
  if (!ws) await dormir(300);
}
if (!ws) {
  console.log("FALHA nao deu para abrir o Chrome");
  await limpar();
  process.exit(1);
}
await new Promise((r, e) => { ws.onopen = r; ws.onerror = e; });
let seq = 0;
const pendentes = new Map();
ws.onmessage = (ev) => {
  const m = JSON.parse(ev.data);
  if (m.id && pendentes.has(m.id)) { pendentes.get(m.id)(m); pendentes.delete(m.id); }
};
const cmd = (method, params = {}) => new Promise((resolve) => { const i = ++seq; pendentes.set(i, resolve); ws.send(JSON.stringify({ id: i, method, params })); });
const avaliar = async (expressao) => {
  const r = await cmd("Runtime.evaluate", { expression: expressao, returnByValue: true, awaitPromise: true });
  if (r.result?.exceptionDetails) return { erro: r.result.exceptionDetails.exception?.description ?? r.result.exceptionDetails.text };
  return r.result?.result?.value;
};
// mouse DE VERDADE: o palco usa setPointerCapture, que exige um ponteiro existente
const mouse = (type, x, y, buttons) => cmd("Input.dispatchMouseEvent", { type, x, y, button: "left", buttons, clickCount: type === "mouseMoved" ? 0 : 1 });
const clicar = async (x, y) => { await mouse("mousePressed", x, y, 1); await dormir(60); await mouse("mouseReleased", x, y, 0); await dormir(280); };
const arrastar = async (x0, y0, x1, y1) => {
  await mouse("mousePressed", x0, y0, 1); await dormir(90);
  await mouse("mouseMoved", (x0 + x1) / 2, (y0 + y1) / 2, 1); await dormir(140);
  await mouse("mouseMoved", x1, y1, 1); await dormir(140);
  await mouse("mouseReleased", x1, y1, 0); await dormir(450);
};

await cmd("Runtime.enable");
await cmd("Page.enable");
await cmd("Page.navigate", { url: `http://localhost:${PORTA}/` });
await dormir(4500);
// O app pode demorar: na PRIMEIRA vez o Vite otimiza as dependências (typo-js, transformers),
// a página recarrega no meio e o `window.__mdoffice` só existe quando o boot termina. Sem esta
// espera, o teste falhava com um erro de código em vez de dizer o que aconteceu.
let carregou = false;
for (let i = 0; i < 120 && !carregou; i++) {
  carregou = await avaliar("!!window.__mdoffice?.app");
  if (!carregou) await dormir(500);
}
if (!carregou) {
  console.log("FALHA o app nao carregou no navegador (o Vite ainda esta otimizando as dependencias?)");
  await limpar();
  process.exit(1);
}
await dormir(1200);

// ---------------------------------------------------------------------------
// o cenário: um deck novo, uma box de texto sem preenchimento
// ---------------------------------------------------------------------------
const preparo = await avaliar(`(async () => {
  const app = window.__mdoffice.app;
  await app.newPowerPointDoc();
  await new Promise((r) => setTimeout(r, 900));
  const palco = app.pptHost['stage'];
  const slide = palco['slideEl'];
  const el = [...slide.querySelectorAll('.pp-shape')].find((e) => e.classList.contains('pp-sem-fundo') && e.querySelector('.pp-rt span'));
  if (!el) return { erro: 'o deck novo nao tem caixa de texto sem preenchimento' };
  const sp = el.querySelector('.pp-rt span').getBoundingClientRect();
  window.__id = el.dataset.shape;
  window.__forma = () => slide.querySelector('[data-shape="' + window.__id + '"]');
  window.__texto = { x: sp.left + 4, y: sp.top + sp.height / 2 };
  return { id: window.__id, texto: window.__texto };
})()`);
ok("o deck de teste tem uma caixa de texto sem preenchimento", !preparo.erro, preparo.erro ?? "");

if (!preparo.erro) {
  // 1) sem escolha: o vazio é clique-atrás
  const semEscolha = await avaliar(`(() => {
    const el = window.__forma();
    const r = el.getBoundingClientRect();
    for (let fy = 0.1; fy <= 0.9; fy += 0.05) for (let fx = 0.05; fx <= 0.95; fx += 0.05) {
      const p = { x: r.left + r.width * fx, y: r.top + r.height * fy };
      const n = document.elementFromPoint(p.x, p.y);
      if (n && n.classList.contains('pp-shape') && n.dataset.shape === window.__id) { window.__vazio = p; return { vazio: p }; }
    }
    return { vazio: null };
  })()`);
  ok("sem escolha, o vazio da box é clique-atrás", semEscolha.vazio === null, JSON.stringify(semEscolha.vazio));

  // 2) escolher a box (clique nas letras, como no print)
  const texto = (await avaliar("window.__texto"));
  await clicar(texto.x, texto.y);
  const escolhida = await avaliar(`(() => {
    const el = window.__forma();
    const r = el.getBoundingClientRect();
    let vazio = null;
    for (let fy = 0.1; fy <= 0.9; fy += 0.05) for (let fx = 0.05; fx <= 0.95; fx += 0.05) {
      const p = { x: r.left + r.width * fx, y: r.top + r.height * fy };
      const n = document.elementFromPoint(p.x, p.y);
      if (n && n.classList.contains('pp-shape') && n.dataset.shape === window.__id) { vazio = p; break; }
    }
    window.__vazio = vazio;
    if (!vazio) return { erro: 'sem ponto vazio', classes: el.className };
    const alvo = document.elementFromPoint(vazio.x, vazio.y);
    return {
      classes: el.className,
      vazio,
      cursorNoVazio: getComputedStyle(alvo).cursor,
      cursorNoTexto: getComputedStyle(document.elementFromPoint(window.__texto.x, window.__texto.y)).cursor,
      box: JSON.stringify(window.__mdoffice.app.pptHost.atual().shapes.find((s) => s.id === window.__id).box),
    };
  })()`);
  ok("a box escolhida ganha a classe da escolha", /pp-escolhida/.test(escolhida.classes ?? ""), escolhida.classes ?? "");
  ok("a box escolhida sem preenchimento vira área de arrasto", /pp-pega/.test(escolhida.classes ?? ""), escolhida.classes ?? "");
  ok("o cursor no VAZIO da box escolhida é o de mover", escolhida.cursorNoVazio === "move", String(escolhida.cursorNoVazio));
  ok("o cursor nas LETRAS da box escolhida é o de texto", escolhida.cursorNoTexto === "text", String(escolhida.cursorNoTexto));

  // 3) arrastar a partir do vazio move a box
  if (escolhida.vazio) {
    const v = escolhida.vazio;
    await arrastar(v.x, v.y, v.x + 110, v.y + 70);
    const depois = await avaliar(`JSON.stringify(window.__mdoffice.app.pptHost.atual().shapes.find((s) => s.id === window.__id).box)`);
    ok("arrastar pelo vazio move a box", depois !== escolhida.box, `${escolhida.box} -> ${depois}`);
  }
}

await limpar();
console.log(falhas ? `\n${falhas} falha(s).` : "\nTudo certo.");
process.exit(falhas ? 1 : 0);
