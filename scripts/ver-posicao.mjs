// Foto do popup Posição (aba Imagem) para conferência visual.
// Uso: node scripts/ver-posicao.mjs
import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const raiz = new URL("..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const temp = join(raiz, "temp");
mkdirSync(temp, { recursive: true });
const CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const PORTA_APP = process.env.MDOFICE_URL || "http://localhost:1440/";
const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

const portaCdp = 9409;
const chrome = spawn(CHROME, [
  "--headless=new", "--disable-gpu", "--no-sandbox", "--hide-scrollbars", "--window-size=1500,950",
  `--remote-debugging-port=${portaCdp}`, `--user-data-dir=${join(temp, "chrome-pos")}`,
  "--no-first-run", "--no-default-browser-check", "about:blank",
], { stdio: "ignore" });

let ws = null;
for (let i = 0; i < 60 && !ws; i++) {
  try {
    const r = await fetch(`http://127.0.0.1:${portaCdp}/json`);
    const pagina = (await r.json()).find((t) => t.type === "page");
    if (pagina) ws = new WebSocket(pagina.webSocketDebuggerUrl);
  } catch { /* subindo */ }
  if (!ws) await dormir(300);
}
await new Promise((r, e) => { ws.onopen = r; ws.onerror = e; });
let seq = 0;
const pendentes = new Map();
ws.onmessage = (ev) => {
  const m = JSON.parse(ev.data);
  if (m.id && pendentes.has(m.id)) { pendentes.get(m.id)(m); pendentes.delete(m.id); }
};
const cmd = (method, params = {}) => new Promise((resolve) => { const i = ++seq; pendentes.set(i, resolve); ws.send(JSON.stringify({ id: i, method, params })); });
const avaliar = async (e) => {
  const r = await cmd("Runtime.evaluate", { expression: e, returnByValue: true, awaitPromise: true });
  if (r.result?.exceptionDetails) return { erro: r.result.exceptionDetails.exception?.description };
  return r.result?.result?.value;
};
await cmd("Runtime.enable");
await cmd("Page.enable");
await cmd("Page.navigate", { url: PORTA_APP });
await dormir(5000);
for (let i = 0; i < 60; i++) {
  if (await avaliar("!!window.__mdoffice?.app")) break;
  await dormir(500);
}

await avaliar(`
  (async () => {
    const app = window.__mdoffice.app;
    await app.newWordDoc();
    await new Promise((r) => setTimeout(r, 1300));
    const ed = app.wordHost.editor;
    const schema = ed.view.state.schema;
    const c = document.createElement('canvas'); c.width = 240; c.height = 240;
    const g = c.getContext('2d'); g.fillStyle = '#4f46e5';
    g.beginPath(); g.arc(120, 120, 110, 0, Math.PI * 2); g.fill();
    const url = c.toDataURL('image/png');
    const p = (t) => schema.nodes.paragraph.create(null, t ? [schema.text(t)] : []);
    const img = schema.nodes.image.create({ src: url, width: 180, height: 180, alt: 'circulo' });
    const lorem = 'Texto de preenchimento para o texto se acomodar em volta da imagem flutuante. ';
    const doc = schema.node('doc', null, [p('Primeiro paragrafo do documento.'), schema.node('paragraph', null, [img]), p(lorem.repeat(4)), p(lorem.repeat(3))]);
    ed.view.dispatch(ed.view.state.tr.replaceWith(0, ed.view.state.doc.content.size, doc.content));
    await new Promise((r) => setTimeout(r, 500));
    let pos = -1, size = 1;
    ed.view.state.doc.descendants((n, pp) => { if (n.type.name === 'image') { pos = pp; size = n.nodeSize; } });
    const Sel = ed.view.state.selection.constructor;
    ed.view.dispatch(ed.view.state.tr.setSelection(Sel.create(ed.view.state.doc, pos + size)));
    ed.setQuebraDeTexto('quadrado');
    await new Promise((r) => setTimeout(r, 800));
    ed.setDeslocamentos(38, 19);
    await new Promise((r) => setTimeout(r, 500));
    // a aba Imagem (o botão Posição mora nela; escondido, ele não tem lugar na tela)
    document.querySelector('.wd-rtab[data-tab="image"]')?.click();
    await new Promise((r) => setTimeout(r, 300));
    document.querySelector('[data-cmd="img-pos"]')?.click();
    await new Promise((r) => setTimeout(r, 400));
    return 'ok';
  })()
`);
await dormir(600);
const shot1 = await cmd("Page.captureScreenshot", { format: "png" });
writeFileSync(join(temp, "posicao-painel.png"), Buffer.from(shot1.result.data, "base64"));
console.log("foto:", join(temp, "posicao-painel.png"));

// o menu da quebra com os "Lados da quebra"
await avaliar(`
  (async () => {
    document.querySelector('[data-cmd="img-wrap"]')?.click();
    await new Promise((r) => setTimeout(r, 300));
    return 'ok';
  })()
`);await dormir(500);
const shot2 = await cmd("Page.captureScreenshot", { format: "png" });
writeFileSync(join(temp, "quebra-lados.png"), Buffer.from(shot2.result.data, "base64"));
console.log("foto:", join(temp, "quebra-lados.png"));

chrome.kill();
