// Testa a ÂNCORA da imagem flutuante do Word: arrastar a imagem pelo texto tem de
// TROCAR o parágrafo que a segura (a âncora), e o texto passa a se acomodar em
// volta no ponto novo — como o Word e o WordCraft fazem.
//
// O teste roda o app DE VERDADE (Vite + Chrome) e confere:
//  - a marca do destino aparece no parágrafo que ficaria com a imagem;
//  - soltar a imagem sobre outro parágrafo muda a âncora (o nó sai do parágrafo
//    antigo e entra no novo);
//  - a imagem continua onde foi solta (o deslocamento é recalculado);
//  - um Ctrl+Z só desfaz o gesto inteiro.
//
// Uso: node scripts/testar-word-ancora.mjs
import { spawn } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";

const raiz = new URL("..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const temp = join(raiz, "temp");
mkdirSync(temp, { recursive: true });

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
const perfil = mkdtempSync(join(tmpdir(), "mdc-ancora-"));
const PORTA = await portaLivre(1493);
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

const portaCdp = 9403;
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
/** A foto da tela (para conferir o desenho). */
const foto = async (nome) => {
  const r = await cmd("Page.captureScreenshot", { format: "png" });
  const arquivo = join(temp, `ancora-${nome}.png`);
  writeFileSync(arquivo, Buffer.from(r.result.data, "base64"));
  console.log("      foto:", arquivo);
};
/** Avalia uma função (com o `window` em volta) e devolve o valor. */
const evaluates = async (fn) => {
  const r = await cmd("Runtime.evaluate", { expression: `(${fn.toString()})()`, returnByValue: true, awaitPromise: true });
  if (r.result?.exceptionDetails) return { erro: r.result.exceptionDetails.exception?.description ?? r.result.exceptionDetails.text };
  return r.result?.result?.value;
};
// mouse DE VERDADE: o gesto usa setPointerCapture, que exige um ponteiro existente
const mouse = (type, x, y, buttons) => cmd("Input.dispatchMouseEvent", { type, x, y, button: "left", buttons, clickCount: type === "mouseMoved" ? 0 : 1 });

await cmd("Runtime.enable");
await cmd("Page.enable");
await cmd("Page.navigate", { url: `http://localhost:${PORTA}/` });
await dormir(4500);
let carregou = false;
for (let i = 0; i < 60 && !carregou; i++) {
  carregou = !!(await avaliar("!!window.__mdoffice?.app"));
  if (!carregou) await dormir(500);
}
if (!carregou) {
  console.log("FALHA o app nao subiu");
  await limpar();
  process.exit(1);
}

// ---------------------------------------------------------------------------
// o documento: texto + uma imagem (círculo) que vira flutuante
// ---------------------------------------------------------------------------
const montou = await avaliar(`
  (async () => {
    const app = window.__mdoffice.app;
    await app.newWordDoc();
    await new Promise((r) => setTimeout(r, 1200));
    const ed = app.wordHost.editor;
    const schema = ed.view.state.schema;
    const c = document.createElement('canvas'); c.width = 200; c.height = 200;
    const g = c.getContext('2d');
    g.fillStyle = '#4f46e5';
    g.beginPath(); g.arc(100, 100, 90, 0, Math.PI * 2); g.fill();
    const url = c.toDataURL('image/png');
    const p = (t) => schema.nodes.paragraph.create(null, t ? [schema.text(t)] : []);
    const img = schema.nodes.image.create({ src: url, width: 160, height: 160, alt: 'circulo' });
    const doc = schema.node('doc', null, [
      p('Primeiro paragrafo do documento, com texto para a imagem ter onde flutuar.'),
      p('Segundo paragrafo, onde a imagem vai ficar ancorada.'),
      schema.node('paragraph', null, [img]),
      p('Terceiro paragrafo: o texto que vai se acomodar em volta da imagem.'),
      p('Quarto paragrafo, mais abaixo, para o destino do arrasto.'),
      p('Quinto paragrafo.'),
      p('Sexto paragrafo, bem mais abaixo.'),
      p('Setimo paragrafo, o destino final do arrasto.'),
    ]);
    ed.view.dispatch(ed.view.state.tr.replaceWith(0, ed.view.state.doc.content.size, doc.content));
    await new Promise((r) => setTimeout(r, 600));
    // seleciona a imagem e tira ela do fluxo (quadrado): agora ela flutua
    let pos = -1, size = 1;
    ed.view.state.doc.descendants((n, p) => { if (n.type.name === 'image') { pos = p; size = n.nodeSize; } });
    const Sel = ed.view.state.selection.constructor;
    ed.view.dispatch(ed.view.state.tr.setSelection(Sel.create(ed.view.state.doc, pos + size)));
    await new Promise((r) => setTimeout(r, 200));
    ed.setQuebraDeTexto('quadrado');
    await new Promise((r) => setTimeout(r, 700));
    return { pos, wrap: ed.query().imagem?.wrap ?? null };
  })()
`);
ok("a imagem ficou flutuante (quebra em quadrado)", montou?.wrap === "quadrado", JSON.stringify(montou));

// a posição do nó da imagem e o parágrafo que a segura
const antes = await avaliar(`
  (() => {
    const ed = window.__mdoffice.app.wordHost.editor;
    let pos = -1;
    ed.view.state.doc.descendants((n, p) => { if (n.type.name === 'image') pos = p; });
    const img = document.querySelector('#word-editor .wd-img img');
    const r = img.getBoundingClientRect();
    const paras = Array.from(document.querySelectorAll('#word-editor p'));
    const ultimo = paras[paras.length - 1].getBoundingClientRect();
    return JSON.stringify({
      pos,
      paragrafo: pos,
      img: { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2), top: Math.round(r.top) },
      destino: { x: Math.round(ultimo.x + 30), y: Math.round(ultimo.y + ultimo.height / 2) },
    });
  })()
`);
const a = JSON.parse(antes);
ok("a imagem está na tela", !!a?.img, antes);

// ---------------------------------------------------------------------------
// o arrasto: da imagem até o último parágrafo
// ---------------------------------------------------------------------------
await avaliar(`
  window.__ups = 0; window.__downs = 0; window.__cancels = 0;
  window.addEventListener('pointerup', () => { window.__ups++; }, true);
  window.addEventListener('pointerdown', () => { window.__downs++; }, true);
  window.addEventListener('pointercancel', () => { window.__cancels++; }, true);
`);
await mouse("mousePressed", a.img.x, a.img.y, 1);
await dormir(150);
const pegou = await avaliar(`
  (() => {
    const img = document.querySelector('#word-editor .wd-img');
    return JSON.stringify({ sel: img?.classList.contains('sel'), movendo: img?.classList.contains('movendo') });
  })()
`);
ok("o ponteiro pegou a imagem", JSON.parse(pegou)?.movendo === true, String(pegou));
await mouse("mouseMoved", (a.img.x + a.destino.x) / 2, (a.img.y + a.destino.y) / 2, 1);
await dormir(250);
const marca = await avaliar("document.querySelectorAll('#word-editor .wd-ancora-alvo').length");
ok("o arrasto marca o parágrafo que ficaria com a imagem", marca === 1, `marcas=${marca}`);
await foto("1-arrastando");
await mouse("mouseMoved", a.destino.x, a.destino.y, 1);
await dormir(200);
await mouse("mouseReleased", a.destino.x, a.destino.y, 0);
await dormir(900);

const depois = await avaliar(`
  (() => {
    const ed = window.__mdoffice.app.wordHost.editor;
    let pos = -1;
    ed.view.state.doc.descendants((n, p) => { if (n.type.name === 'image') pos = p; });
    const img = document.querySelector('#word-editor .wd-img img');
    const r = img.getBoundingClientRect();
    return JSON.stringify({
      pos,
      soltou: window.__soltou ?? 0,
      attrs: ed.view.state.doc.nodeAt(pos)?.attrs,
      img: { top: Math.round(r.top), x: Math.round(r.x) },
      marcas: document.querySelectorAll('#word-editor .wd-ancora-alvo').length,
    });
  })()
`);
const d = JSON.parse(depois);
console.log("      depois:", depois);
ok("a âncora mudou (a imagem foi para outro parágrafo)", d.pos !== a.pos, `antes=${a.pos} depois=${d.pos}`);
ok("a marca do destino some depois do gesto", d.marcas === 0, `marcas=${d.marcas}`);
ok("a quebra continua em quadrado", d.attrs?.wrap === "quadrado", JSON.stringify(d.attrs?.wrap));
ok("a imagem continua flutuando no texto novo", await avaliar("!!document.querySelector('#word-editor .wd-flutuante')"));

// o texto se acomoda em volta: a linha do parágrafo seguinte é mais estreita
const linhas = await avaliar(`
  (() => {
    const el = document.querySelectorAll('#word-editor p');
    const medidas = [];
    for (const p of el) {
      const rg = document.createRange();
      rg.selectNodeContents(p);
      const rects = Array.from(rg.getClientRects()).filter((r) => r.width > 0);
      if (rects.length) medidas.push({ w: Math.round(rects[0].width), n: rects.length });
    }
    return JSON.stringify(medidas);
  })()
`);
const medidas = JSON.parse(linhas || "[]");
const estreitas = medidas.filter((m) => m.w < 500).length;
ok("o texto se acomoda em volta da imagem (linha mais estreita)", estreitas >= 1, `${estreitas} linha(s) estreita(s) de ${medidas.length}`);

// ---------------------------------------------------------------------------
// um Ctrl+Z só desfaz o gesto inteiro
// ---------------------------------------------------------------------------
await cmd("Input.dispatchKeyEvent", { type: "keyDown", key: "z", code: "KeyZ", modifiers: 2, windowsVirtualKeyCode: 90 });
await cmd("Input.dispatchKeyEvent", { type: "keyUp", key: "z", code: "KeyZ", modifiers: 2, windowsVirtualKeyCode: 90 });
await dormir(800);
const desfazido = await avaliar(`
  (() => {
    const ed = window.__mdoffice.app.wordHost.editor;
    let pos = -1;
    ed.view.state.doc.descendants((n, p) => { if (n.type.name === 'image') pos = p; });
    return JSON.stringify({ pos });
  })()
`);
const u = JSON.parse(desfazido);
ok("um Ctrl+Z só desfaz o gesto inteiro (a âncora volta)", u.pos === a.pos, `antes=${a.pos} depois do arrasto=${d.pos} depois do undo=${u.pos}`);
await foto("2-depois");

// ---------------------------------------------------------------------------
// A PAGINAÇÃO com o flutuante: a imagem não pode ser cortada ao meio pela
// quebra de página (ela desce inteira para a página seguinte) — é o que o
// WordCraft garante com a âncora do objeto.
// ---------------------------------------------------------------------------
console.log("");
const paginacao = await avaliar(`
  (async () => {
    const app = window.__mdoffice.app;
    const ed = app.wordHost.editor;
    const schema = ed.view.state.schema;
    const c = document.createElement('canvas'); c.width = 200; c.height = 200;
    const g = c.getContext('2d');
    g.fillStyle = '#16a34a';
    g.fillRect(0, 0, 200, 200);
    const url = c.toDataURL('image/png');
    const p = (t) => schema.nodes.paragraph.create(null, t ? [schema.text(t)] : []);
    const img = schema.nodes.image.create({ src: url, width: 260, height: 260, alt: 'bloco', wrap: 'quadrado' });
    const lorem = 'Paragrafo de preenchimento para encher as paginas do documento e ver onde a imagem flutuante cai. ';
    const blocos = [];
    for (let i = 0; i < 30; i++) {
      // a imagem no meio do caminho (no fim da primeira pagina)
      if (i === 12) blocos.push(schema.node('paragraph', null, [img]));
      blocos.push(p(lorem.repeat(2) + 'Paragrafo ' + (i + 1) + '.'));
    }
    ed.view.dispatch(ed.view.state.tr.replaceWith(0, ed.view.state.doc.content.size, doc2(schema, blocos)));
    function doc2(schema, blocos) { return schema.node('doc', null, blocos); }
    await new Promise((r) => setTimeout(r, 2500));
    // onde esta a imagem e onde comeca cada pagina
    const img2 = document.querySelector('#word-editor .wd-img img');
    const r = img2 ? img2.getBoundingClientRect() : null;
    const espacadores = Array.from(document.querySelectorAll('#word-editor .wd-spacer')).map((e) => {
      const b = e.getBoundingClientRect();
      return { y: Math.round(b.y), h: Math.round(b.height) };
    });
    return JSON.stringify({ paginas: app.wordHost.pages, img: r ? { y: Math.round(r.y), h: Math.round(r.height) } : null, espacadores });
  })()
`);
const pag = JSON.parse(paginacao);
console.log("      paginacao:", paginacao.slice(0, 300));
// a imagem nao pode atravessar a quebra de pagina: o espaco entre o topo e a
// base dela nao pode conter o inicio de outra pagina
const quebras = (pag.espacadores || []).map((e) => e.y);
const corta = pag.img ? quebras.some((y) => y > pag.img.y && y < pag.img.y + pag.img.h) : false;
ok("a imagem não é cortada pela quebra de página", !corta, `img=${JSON.stringify(pag.img)} quebras=${JSON.stringify(quebras)}`);
ok("a quebra de página existe no documento", quebras.length > 0, `quebras=${quebras.length}`);

await limpar();
console.log("");
if (falhas) {
  console.log(`${falhas} FALHA(S)`);
  process.exit(1);
}
console.log("Tudo certo.");
