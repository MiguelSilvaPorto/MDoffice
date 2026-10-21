// Testa o painel POSIÇÃO e os LADOS DA QUEBRA da imagem do Word:
//  - os deslocamentos em cm (horizontal e vertical) mudam o lugar da imagem;
//  - os lados da quebra decidem para que lado o texto passa (o `float` acompanha);
//  - "Fixar na página" mantém a imagem na mesma altura quando o texto acima cresce;
//  - "Mover com o texto" volta a fazer a imagem andar com o texto.
//
// O teste roda o app DE VERDADE (Vite + Chrome com tela), porque a paginação mede
// o DOM — e isso precisa de uma página que desenhe.
//
// Uso: node scripts/testar-word-imagem-posicao.mjs
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

const perfil = mkdtempSync(join(tmpdir(), "mdc-pos-"));
const PORTA = await portaLivre(1495);
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

const portaCdp = 9405;
chrome = spawn(CHROME, [
  "--headless=new", "--disable-gpu", "--no-sandbox", "--window-size=1600,1000",
  `--remote-debugging-port=${portaCdp}`, `--user-data-dir=${perfil}`,
  "--no-first-run", "--no-default-browser-check", "about:blank",
], { stdio: "ignore" });

let ws = null;
for (let i = 0; i < 60 && !ws; i++) {
  try {
    const r = await fetch(`http://127.0.0.1:${portaCdp}/json`);
    const pagina = (await r.json()).find((t) => t.type === "page");
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
// o documento: texto + uma imagem que vira flutuante
// ---------------------------------------------------------------------------
const preparo = await avaliar(`
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
    const doc = schema.node('doc', null, [
      p('Primeiro paragrafo do documento.'),
      schema.node('paragraph', null, [img]),
      p(lorem.repeat(4)), p(lorem.repeat(4)), p(lorem.repeat(3)),
    ]);
    ed.view.dispatch(ed.view.state.tr.replaceWith(0, ed.view.state.doc.content.size, doc.content));
    await new Promise((r) => setTimeout(r, 500));
    let pos = -1, size = 1;
    ed.view.state.doc.descendants((n, pp) => { if (n.type.name === 'image') { pos = pp; size = n.nodeSize; } });
    const Sel = ed.view.state.selection.constructor;
    ed.view.dispatch(ed.view.state.tr.setSelection(Sel.create(ed.view.state.doc, pos + size)));
    ed.setQuebraDeTexto('quadrado');
    await new Promise((r) => setTimeout(r, 800));
    return JSON.stringify({ pos, wrap: ed.query().imagem?.wrap, espacos: document.querySelectorAll('#word-editor .wd-spacer').length });
  })()
`);
const p0 = typeof preparo === "string" ? JSON.parse(preparo) : preparo;
ok(
  "a imagem ficou flutuante e a página foi paginada",
  p0?.wrap === "quadrado" && p0?.espacos > 0,
  String(preparo)
);

// ---------------------------------------------------------------------------
// 1) painel Posição: os deslocamentos em cm
// ---------------------------------------------------------------------------
const painel = await avaliar(`
  (async () => {
    const ed = window.__mdoffice.app.wordHost.editor;
    document.querySelector('[data-cmd="img-pos"]')?.click();
    await new Promise((r) => setTimeout(r, 200));
    const pop = document.querySelector('.wd-pos-pop');
    if (!pop) return JSON.stringify({ abriu: false });
    const campos = pop.querySelectorAll('.wd-pos-campo');
    campos[0].value = '1,00';
    campos[0].dispatchEvent(new Event('blur'));
    await new Promise((r) => setTimeout(r, 250));
    const campos2 = document.querySelector('.wd-pos-pop')?.querySelectorAll('.wd-pos-campo') ?? [];
    campos2[1].value = '0,50';
    campos2[1].dispatchEvent(new Event('blur'));
    await new Promise((r) => setTimeout(r, 350));
    let pos = -1;
    ed.view.state.doc.descendants((n, p) => { if (n.type.name === 'image') pos = p; });
    const a = ed.view.state.doc.nodeAt(pos).attrs;
    return JSON.stringify({ abriu: true, hOffset: a.hOffset, vOffset: a.vOffset, linhas: Array.from(pop.querySelectorAll('.wd-pos-rotulo')).map((e) => e.textContent) });
  })()
`);
const p1 = typeof painel === "string" ? JSON.parse(painel) : painel;
ok("o painel Posição abre com os deslocamentos", p1?.abriu === true, String(painel).slice(0, 200));
ok("o deslocamento horizontal em cm vira px", p1?.hOffset === 38, `hOffset=${p1?.hOffset} (1,00 cm = 38 px)`);
ok("o deslocamento vertical em cm vira px", p1?.vOffset === 19, `vOffset=${p1?.vOffset} (0,50 cm = 19 px)`);

// ---------------------------------------------------------------------------
// 2) lados da quebra
// ---------------------------------------------------------------------------
const lados = await avaliar(`
  (async () => {
    const ed = window.__mdoffice.app.wordHost.editor;
    const flutua = () => {
      const el = document.querySelector('#word-editor .wd-img')?.parentElement;
      return el ? getComputedStyle(el).float : null;
    };
    const antes = flutua();
    ed.setLadosDaQuebra('esquerda');
    await new Promise((r) => setTimeout(r, 250));
    const esquerda = flutua();
    ed.setLadosDaQuebra('direita');
    await new Promise((r) => setTimeout(r, 250));
    const direita = flutua();
    ed.setLadosDaQuebra('maior');
    await new Promise((r) => setTimeout(r, 250));
    return JSON.stringify({ antes, esquerda, direita, voltou: flutua() });
  })()
`);
const p2 = typeof lados === "string" ? JSON.parse(lados) : lados;
ok("“só à esquerda” põe a imagem à direita (o texto fica à esquerda)", p2?.esquerda === "right", JSON.stringify(p2));
ok("“só à direita” põe a imagem à esquerda (o texto fica à direita)", p2?.direita === "left", JSON.stringify(p2));
ok("“o lado mais largo” volta ao de sempre", p2?.voltou === p2?.antes, JSON.stringify(p2));

// ---------------------------------------------------------------------------
// 3) fixar na página × mover com o texto
// ---------------------------------------------------------------------------
const fixar = await avaliar(`
  (async () => {
    const app = window.__mdoffice.app;
    const ed = app.wordHost.editor;
    const schema = ed.view.state.schema;
    const achar = () => { let q = -1; ed.view.state.doc.descendants((n, p) => { if (n.type.name === 'image') q = p; }); return q; };
    const y = () => Math.round(document.querySelector('#word-editor .wd-img img').getBoundingClientRect().y);
    const selecionar = () => {
      let pos = -1, size = 1;
      ed.view.state.doc.descendants((n, p) => { if (n.type.name === 'image') { pos = p; size = n.nodeSize; } });
      const sel = ed.view.state.selection;
      const Sel = sel.constructor;
      ed.view.dispatch(ed.view.state.tr.setSelection(Sel.create(ed.view.state.doc, sel.node ? pos : pos + size)));
    };
    selecionar();
    await new Promise((r) => setTimeout(r, 200));
    ed.setFixaNaPagina(true);
    await new Promise((r) => setTimeout(r, 900));
    const antes = y();
    // um parágrafo novo NO TOPO: o texto acima cresce
    ed.view.dispatch(ed.view.state.tr.insert(0, schema.nodes.paragraph.create(null, [schema.text('Paragrafo novo no topo do documento, para empurrar tudo o que vem abaixo.')])));
    await new Promise((r) => setTimeout(r, 1500));
    const fixo = { y: y(), attrs: { ...ed.view.state.doc.nodeAt(achar()).attrs } };
    // volta para "mover com o texto"
    selecionar();
    await new Promise((r) => setTimeout(r, 200));
    ed.setFixaNaPagina(false);
    await new Promise((r) => setTimeout(r, 900));
    const antesMover = y();
    ed.view.dispatch(ed.view.state.tr.insert(0, schema.nodes.paragraph.create(null, [schema.text('Outro paragrafo no topo, para empurrar de novo.')])));
    await new Promise((r) => setTimeout(r, 1500));
    const solto = { y: y(), fixa: ed.view.state.doc.nodeAt(achar()).attrs.fixa };
    return JSON.stringify({ antes, fixo, antesMover, solto });
  })()
`);
const p3 = typeof fixar === "string" ? JSON.parse(fixar) : fixar;
ok(
  "fixar na página: a imagem não anda quando o texto acima cresce",
  p3 && Math.abs(p3.fixo.y - p3.antes) <= 2,
  `antes=${p3?.antes} depois=${p3?.fixo.y}`
);
ok("fixar na página grava a altura dentro da página", p3?.fixo.attrs.fixa === true && p3?.fixo.attrs.pageOffset >= 0, JSON.stringify(p3?.fixo.attrs).slice(0, 160));
ok(
  "mover com o texto: a imagem volta a andar com o texto",
  p3 && p3.solto.y - p3.antesMover > 10,
  `antes=${p3?.antesMover} depois=${p3?.solto.y}`
);

// ---------------------------------------------------------------------------
// 4) o tremor ao digitar acima (a imagem fixa não pode "piscar")
// ---------------------------------------------------------------------------
// A leitura é feita LOGO depois de cada tecla, ainda na mesma tarefa: é a posição
// que a tela pintaria ao fim dela. Antes do acerto síncrono, essa leitura pegava a
// imagem uma linha abaixo (ela descia com o texto e só voltava no ciclo seguinte).
const tremor = await avaliar(`
  (async () => {
    const ed = window.__mdoffice.app.wordHost.editor;
    const achar = () => { let q = -1; ed.view.state.doc.descendants((n, p) => { if (n.type.name === 'image') q = p; }); return q; };
    let pos = -1, size = 1;
    ed.view.state.doc.descendants((n, p) => { if (n.type.name === 'image') { pos = p; size = n.nodeSize; } });
    const sel = ed.view.state.selection;
    const Sel = sel.constructor;
    ed.view.dispatch(ed.view.state.tr.setSelection(Sel.create(ed.view.state.doc, sel.node ? pos : pos + size)));
    await new Promise((r) => setTimeout(r, 200));
    ed.setFixaNaPagina(true);
    await new Promise((r) => setTimeout(r, 900));
    const y = () => Math.round(document.querySelector('#word-editor .wd-img img').getBoundingClientRect().y);
    const prim = () => Math.round(document.querySelector('#word-editor p').getBoundingClientRect().height);
    const alturaAntes = prim();
    const ys = [];
    for (let i = 0; i < 120; i++) {
      ed.view.dispatch(ed.view.state.tr.insertText('x', 1));
      ys.push(y());
    }
    await new Promise((r) => setTimeout(r, 500));
    return JSON.stringify({
      min: Math.min(...ys), max: Math.max(...ys), amostras: ys.length,
      alturaAntes, alturaDepois: prim(), fixa: ed.view.state.doc.nodeAt(achar()).attrs.fixa,
    });
  })()
`);
const p4 = typeof tremor === "string" ? JSON.parse(tremor) : tremor;
ok(
  "digitar no topo não faz a imagem fixa tremer (mesmo com o texto acima crescendo)",
  p4 && p4.max - p4.min <= 3,
  `y de ${p4?.min} a ${p4?.max} em ${p4?.amostras} teclas (amplitude ${p4 ? p4.max - p4.min : "?"} px)`
);
ok(
  "o teste do tremor tem texto crescendo acima da imagem (senão não prova nada)",
  p4 && p4.alturaDepois - p4.alturaAntes >= 17,
  `parágrafo acima: ${p4?.alturaAntes} → ${p4?.alturaDepois} px`
);

// 6) o menu da quebra marca a opção da imagem (mesmo com a seleção fora dela)
// ---------------------------------------------------------------------------
// O clique na fita tira o foco do editor; o menu abria com `query().imagem` nulo e marcava
// "Alinhado com o texto" para qualquer imagem. A fita guarda a última imagem em foco.
const menuQuebra = await avaliar(`
  (async () => {
    const ed = window.__mdoffice.app.wordHost.editor;
    let pos = -1, size = 1;
    ed.view.state.doc.descendants((n, p) => { if (n.type.name === 'image') { pos = p; size = n.nodeSize; } });
    const sel = ed.view.state.selection;
    const Sel = sel.constructor;
    ed.view.dispatch(ed.view.state.tr.setSelection(Sel.create(ed.view.state.doc, sel.node ? pos : pos + size)));
    await new Promise((r) => setTimeout(r, 250));
    ed.setQuebraDeTexto('contorno');
    await new Promise((r) => setTimeout(r, 600));
    // a seleção sai da imagem (é o que o clique na fita faz)
    ed.view.dispatch(ed.view.state.tr.setSelection(Sel.create(ed.view.state.doc, 1)));
    await new Promise((r) => setTimeout(r, 400));
    const queryNula = !ed.query().imagem;
    document.querySelector('[data-cmd="img-wrap"]')?.click();
    await new Promise((r) => setTimeout(r, 250));
    const menu = document.querySelector('.wd-wrap-pop');
    const marcado = menu ? Array.from(menu.querySelectorAll('.wd-menu-item')).filter((b) => b.classList.contains('active')).map((b) => b.textContent.replace('✓', '').trim()) : [];
    document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    await new Promise((r) => setTimeout(r, 150));
    return JSON.stringify({ queryNula, marcado, abriu: !!menu });
  })()
`);
const p6 = typeof menuQuebra === "string" ? JSON.parse(menuQuebra) : menuQuebra;
ok(
  "o menu da quebra marca a opção da imagem mesmo com a seleção fora dela",
  p6?.abriu === true && p6?.marcado?.includes("Contorno") && p6?.queryNula === true,
  `marcado=${JSON.stringify(p6?.marcado)} (query nula: ${p6?.queryNula})`
);

await limpar();
console.log("");
if (falhas) {
  console.log(`${falhas} FALHA(S)`);
  process.exit(1);
}
console.log("Tudo certo.");
