// Verifica a grade do Excel num DOM simulado (sem navegador): monta um
// ExcelHost, simula a digitação de célula por teclado e confere o que o modelo
// gravou e o que a tela desenhou.
//
// É o complemento do scripts/testar-excel.mjs: aquele prova o cálculo e o
// arquivo .xlsx; este prova que a interface responde.

import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";

const raiz = process.cwd();
const temp = join(raiz, "temp");
const saidaJs = join(temp, "excel-ui-js");

let passou = 0;
let falhou = 0;
function ok(nome, condicao, detalhe = "") {
  if (condicao) {
    passou++;
    console.log(`  ok   ${nome}`);
  } else {
    falhou++;
    console.log(`  FALHA ${nome}${detalhe ? ` — ${detalhe}` : ""}`);
  }
}

// ---------- compila o motor (mesmo caminho do teste anterior) ----------
// Compila SEMPRE: o artefato velho já escondeu regressões (o teste rodava contra
// o host de uma sessão anterior). `--noCheck` emite só o necessário para o Node.
mkdirSync(saidaJs, { recursive: true });
console.log("Compilando o motor para testar a grade…");
execFileSync(
  process.execPath,
  [
    join(raiz, "node_modules", "typescript", "bin", "tsc"),
    "--outDir", saidaJs,
    "--module", "esnext",
    "--moduleResolution", "bundler",
    "--target", "es2022",
    "--lib", "es2022,dom,dom.iterable",
    "--skipLibCheck", "--strict", "--esModuleInterop",
    // o host importa a fita inteira (que referencia o App só em tipos). Sem checar
    // tipos, o tsc emite só o que o Node precisa e não puxa os `?raw`/`import.meta.env`
    // do app — o teste da grade roda o DOM simulado, não o bundle do Vite.
    "--noCheck",
    "--rootDir", join(raiz, "src"),
    join(raiz, "src", "excel", "host.ts"),
  ],
  { stdio: "inherit", cwd: raiz }
);
const fs = await import("node:fs");
const caminhoHost = join(saidaJs, "excel", "host.js");
const ajustar = (dir) => {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) ajustar(p);
    else if (e.name.endsWith(".js")) {
      fs.writeFileSync(p, fs.readFileSync(p, "utf8").replace(/from\s+"(\.[^"]*?)"/g, (m, a) => (a.endsWith(".js") ? m : `from "${a}.js"`)));
    }
  }
};
ajustar(saidaJs);

// ---------- DOM mínimo ----------
// Só o que o ExcelHost usa: elementos com className/innerHTML/style/dataset,
// querySelector por atributo e addEventListener. Não é um DOM completo — é o
// suficiente para montar a grade e ver o que ela escreve.
class El {
  constructor(tag = "div") {
    this.tag = tag;
    this.className = "";
    this.children = [];
    this.attrs = {};
    this.dataset = {};
    this.style = new Proxy({ setProperty() {}, removeProperty() {} }, {
      set(t, k, v) { t[k] = v; return true; },
      get(t, k) { return t[k] ?? ""; },
    });
    this._innerHTML = "";
    this._text = "";
    this.listeners = {};
    this.hidden = false;
    this.value = "";
    this.type = "text";
    // classList mínimo (o motor liga/desliga "sem-grade" etc.)
    this._classes = new Set();
    this.classList = {
      add: (...cs) => { for (const c of cs) this._classes.add(c); this._sincClasse(); },
      remove: (...cs) => { for (const c of cs) this._classes.delete(c); this._sincClasse(); },
      contains: (c) => this._classes.has(c),
      toggle: (c, v) => {
        const ligar = v === undefined ? !this._classes.has(c) : !!v;
        if (ligar) this._classes.add(c); else this._classes.delete(c);
        this._sincClasse();
        return ligar;
      },
    };
    // área visível simulada (o motor desenha só o que cabe na tela)
    this.clientWidth = 800;
    this.clientHeight = 600;
    this.scrollTop = 0;
    this.scrollLeft = 0;
    this.scrollHeight = 0;
    this.scrollWidth = 0;
  }
  _sincClasse() { this._cls = [...this._classes].join(" "); }
  get innerHTML() { return this._innerHTML; }
  set innerHTML(v) {
    this._innerHTML = v;
    // recria os filhos a partir das tags do template (o motor escreve HTML)
    this.children = [];
    const re = /<(\w+)([^>]*)>/g;
    let m;
    while ((m = re.exec(v))) {
      const [, tag, resto] = m;
      const filho = new El(tag);
      const cls = /class="([^"]*)"/.exec(resto)?.[1];
      if (cls) filho.className = cls;
      // data-x="v" e também o atributo sem valor (ex.: data-grade)
      for (const [, k, val] of resto.matchAll(/data-([\w-]+)(?:="([^"]*)")?/g)) filho.dataset[k] = val ?? "";
      for (const [, k, val] of resto.matchAll(/([\w-]+)="([^"]*)"/g)) filho.attrs[k] = val;
      filho.pai = this;
      this.children.push(filho);
    }
  }
  get textContent() { return this._text; }
  set textContent(v) { this._text = v; this._innerHTML = ""; this.children = []; }
  set className(v) { this._cls = v; if (this._classes) this._classes = new Set(String(v).split(/\s+/).filter(Boolean)); }
  get className() { return this._cls ?? ""; }
  get tagName() { return String(this.tag).toUpperCase(); }
  append(...f) { for (const x of f) { this.children.push(x); x.pai = this; } }
  before(...novos) {
    const pai = this.pai;
    if (!pai) return;
    const i = pai.children.indexOf(this);
    pai.children.splice(i, 0, ...novos);
    for (const n of novos) n.pai = pai;
  }
  after(...novos) {
    const pai = this.pai;
    if (!pai) return;
    const i = pai.children.indexOf(this);
    pai.children.splice(i + 1, 0, ...novos);
    for (const n of novos) n.pai = pai;
  }
  get options() { return this.children.filter((c) => String(c.tag).toLowerCase() === "option"); }
  get selectedOptions() {
    const opts = this.options;
    const marcadas = opts.filter((o) => o.selected || (o.attrs.value ?? o.textContent) === this.value);
    return marcadas.length ? marcadas : opts.slice(0, 1);
  }
  get selectedIndex() {
    const i = this.options.findIndex((o) => o.attrs.selected !== undefined || o.selected);
    return i >= 0 ? i : 0;
  }
  set selectedIndex(i) {
    this.options.forEach((o, k) => { o.selected = k === i; });
    const opt = this.options[i];
    if (opt) this.value = opt.attrs.value ?? opt.textContent ?? "";
  }
  addEventListener(t, fn) { (this.listeners[t] ||= []).push(fn); }
  removeEventListener(t, fn) {
    const l = this.listeners[t];
    if (l) this.listeners[t] = l.filter((f) => f !== fn);
  }
  contains(el) {
    let p = el;
    while (p) {
      if (p === this) return true;
      p = p.pai ?? null;
    }
    return false;
  }
  insertAdjacentElement(pos, el) {
    const pai = this.pai;
    if (!pai) return null;
    const i = pai.children.indexOf(this);
    const idx = pos === "afterbegin" || pos === "beforebegin" ? i : i + 1;
    pai.children.splice(idx, 0, el);
    el.pai = pai;
    return el;
  }
  getBoundingClientRect() {
    return { top: 0, left: 0, right: 800, bottom: 60, width: 800, height: 60, x: 0, y: 0 };
  }
  setPointerCapture() {}
  releasePointerCapture() {}
  dispatchEvent() { return true; }
  dispatch(t, ev = {}) {
    for (const fn of this.listeners[t] ?? []) fn({ preventDefault() {}, stopPropagation() {}, target: this, ...ev });
  }
  focus() {}
  select() {}
  setSelectionRange() {}
  scrollIntoView() {}
  setAttribute(k, v) { this.attrs[k] = String(v); }
  hasAttribute(k) { return this.attrs[k] !== undefined; }
  removeAttribute(k) { delete this.attrs[k]; }
  closest(sel) {
    const ops = String(sel).split(",").map((s) => s.trim());
    let el = this;
    while (el) {
      for (const op of ops) {
        const m = /^\[([\w-]+)(?:="([^"]*)")?\]$/.exec(op);
        if (m) {
          const nome = m[1];
          const valor = nome.startsWith("data-") ? el.dataset[nome.slice(5)] : el.attrs[nome];
          if (m[2] === undefined ? valor !== undefined : String(valor) === m[2]) return el;
        } else if (op.startsWith(".") && String(el.className).split(/\s+/).includes(op.slice(1))) {
          return el;
        } else if (String(el.tag).toLowerCase() === op.toLowerCase()) {
          return el;
        }
      }
      el = el.pai ?? null;
    }
    return null;
  }
  // o motor desenha as células com insertAdjacentHTML; aqui equivale a
  // acrescentar as tags ao final (o _innerHTML não é relido para não duplicar)
  insertAdjacentHTML(_pos, html) {
    const antes = this.children.length;
    const guarda = this._innerHTML;
    this.innerHTML = (this._innerHTML || "") + html;
    this._innerHTML = guarda;
    for (const f of this.children.slice(antes)) f.pai = this;
  }
  getAttribute(k) { return this.attrs[k] ?? null; }
  replaceWith(...novos) {
    const pai = this.pai;
    if (!pai) return;
    const i = pai.children.indexOf(this);
    pai.children.splice(i, 1, ...novos);
    for (const n of novos) n.pai = pai;
  }
  querySelector(sel) { return this.querySelectorAll(sel)[0] ?? null; }
  querySelectorAll(sel) {
    // seletor simples por tag, classe ou atributo data-*
    const partes = sel.trim().split(/\s+/);
    const raizEl = this;
    const achados = [];
    const casa = (el, p) => {
      if (p.startsWith(".")) return String(el.className).split(/\s+/).includes(p.slice(1));
      if (p.startsWith("#")) return el.attrs.id === p.slice(1);
      if (p.startsWith("[")) {
        // [data-grade] -> casa com dataset.grade; [title] -> casa com attrs.title
        const m = /^\[([\w-]+)(?:="([^"]*)")?\]$/.exec(p);
        if (!m) return false;
        const nome = m[1];
        const valor = nome.startsWith("data-") ? el.dataset[nome.slice(5)] : el.attrs[nome];
        return m[2] === undefined ? valor !== undefined : String(valor) === m[2];
      }
      return el.tag.toLowerCase() === p.toLowerCase();
    };
    const passo = (el, i) => {
      for (const f of el.children) {
        if (casa(f, partes[i])) {
          if (i === partes.length - 1) achados.push(f);
          else passo(f, i + 1);
        }
        passo(f, i);
      }
      void raizEl;
    };
    passo(this, 0);
    return achados;
  }
  remove() {}
}

const docEl = new El("body");
// O seletor do app lê o descritor de `value` do prototype do <select> real.
class HTMLSelectElementFake {
  get value() { return this._valor ?? ""; }
  set value(v) { this._valor = String(v); }
}
globalThis.HTMLSelectElement = HTMLSelectElementFake;
globalThis.MutationObserver = class {
  observe() {}
  disconnect() {}
  takeRecords() { return []; }
};
globalThis.ResizeObserver = class {
  observe() {}
  disconnect() {}
};
globalThis.IntersectionObserver = class {
  constructor(cb) { this.cb = cb; }
  observe() {}
  disconnect() {}
};
globalThis.requestAnimationFrame = (fn) => setTimeout(() => fn(0), 0);
globalThis.cancelAnimationFrame = (t) => clearTimeout(t);
// Simula o App: o painel do Excel marca a classe "xlsx-open" no body.
let modalAberto = false;
globalThis.document = {
  body: docEl,
  createElement: (t) => new El(t),
  querySelector: (sel) =>
    String(sel).includes(".modal-backdrop") ? (modalAberto ? new El("div") : null) : null,
  querySelectorAll: () => [],
  getElementById: () => null,
  addEventListener() {},
  removeEventListener() {},
};
// A janela guarda os ouvintes de verdade: o motor registra nela o atalho de
// desfazer/refazer, que precisa valer com o foco em qualquer ponto da planilha.
const ouvintesJanela = {};
globalThis.window = {
  addEventListener(t, fn) { (ouvintesJanela[t] ||= []).push(fn); },
  removeEventListener() {},
  dispatch(t, ev = {}) {
    for (const fn of ouvintesJanela[t] ?? []) fn({ preventDefault() {}, stopPropagation() {}, ...ev });
  },
  setTimeout: (fn, ms) => setTimeout(fn, ms),
  clearTimeout: (t) => clearTimeout(t),
  matchMedia: () => ({ matches: false }),
  getComputedStyle: () => ({}),
  innerWidth: 1280,
  innerHeight: 800,
};
globalThis.requestAnimationFrame = (fn) => setTimeout(fn, 0);
// o Node moderno já tem "navigator" (só leitura): só criamos se não existir
if (!globalThis.navigator) globalThis.navigator = { clipboard: { writeText: async () => {} } };
globalThis.atob = (s) => Buffer.from(s, "base64").toString("binary");
globalThis.btoa = (s) => Buffer.from(s, "binary").toString("base64");
globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
globalThis.CustomEvent = globalThis.CustomEvent ?? class CustomEvent { constructor(type, init) { this.type = type; this.detail = init?.detail; } };
document.documentElement = { dataset: {} };

// ---------- carrega o motor ----------
const { ExcelHost } = await import(pathToFileURL(caminhoHost).href);

// ---------- monta o host ----------
const pane = new El("section");
const status = { dirty: 0 };
const host = new ExcelHost({
  pane,
  onDirty: () => status.dirty++,
  onStatus: () => {},
  onConfigure: () => {},
});

// acesso ao estado interno para conferir o que foi gravado
const st = () => host.snapshot();
const grade = pane.querySelector("[data-grade]");
const entrada = pane.querySelector("[data-entrada]");

console.log("\nGrade montada");
ok("pane preenchida", pane.innerHTML.includes("xl-grade"));
ok("tem barra de fórmulas", pane.innerHTML.includes("xl-formula"));
ok("tem área de guias", pane.innerHTML.includes("xl-guias"));
ok("grade existe no DOM", !!grade);

console.log("\nDigitação: o que o teclado digita chega na célula");
function digitar(texto) {
  const teclas = [...texto];
  // a 1ª tecla chega na grade e abre a caixa de edição; as seguintes já vão
  // direto para o <input>, como acontece no navegador
  grade.dispatch("keydown", { key: teclas[0], ctrlKey: false, shiftKey: false, altKey: false });
  for (const ch of teclas.slice(1)) {
    entrada.value += ch; // o navegador escreve o caractere no input
    entrada.dispatch("keydown", { key: ch === "=" ? "Equal" : ch, ctrlKey: false, shiftKey: false, altKey: false });
  }
  entrada.dispatch("keydown", { key: "Enter" });
}
digitar("10");
ok("A1 guardou o texto", st().livro.folhas[0].celulas.A1?.texto === "10", JSON.stringify(st().livro.folhas[0].celulas.A1));

console.log("\nFórmula calculada");
// a célula ativa está em A2 (Enter desceu); escreve em B1 via API de snapshot
host.load({
  livro: {
    folhas: [{ nome: "P", celulas: { A1: { texto: "10" }, A2: { texto: "20" }, A3: { texto: "30" } }, colunas: {}, linhas: {}, mesclas: [] }],
    ativa: 0,
  },
  config: { grade: true, zoom: 100, casas: 2, moeda: "R$" },
  linha: 0,
  coluna: 0,
});
ok("A1 carregada", st().livro.folhas[0].celulas.A1?.texto === "10");
ok("aba se chama P", st().livro.folhas[0].nome === "P");

// anda uma coluna para a direita antes de digitar a fórmula
grade.dispatch("keydown", { key: "ArrowRight", ctrlKey: false, shiftKey: false, altKey: false });
digitar("=SOMA(A1:A2)");
ok("fórmula guardada", st().livro.folhas[0].celulas.B1?.texto === "=SOMA(A1:A2)", JSON.stringify(st().livro.folhas[0].celulas));
ok("marcada como fórmula", st().livro.folhas[0].celulas.B1?.formula === true);
ok("dirty marcado", status.dirty > 0);

console.log("\nTexto legível (a IA e o corretor leem isto)");
const texto = host.text();
ok("inclui o nome da aba", texto.includes("## P"), texto.slice(0, 60));
ok("inclui o valor calculado", texto.includes("30"), texto.slice(0, 200));

console.log("\nSnapshot e carga preservam o estado");
const antes = host.snapshot();
const serializado = host.serialized();
ok("serializado não é vazio", serializado.length > 10);
host.load({ livro: { folhas: [{ nome: "Vazia", celulas: {}, colunas: {}, linhas: {}, mesclas: [] }], ativa: 0 }, config: antes.config, linha: 0, coluna: 0 });
ok("aba trocada", st().livro.folhas[0].nome === "Vazia");
host.load(antes);
ok("voltou ao estado anterior", st().livro.folhas[0].nome === "P");
ok("fórmula continua lá", st().livro.folhas[0].celulas.B1?.texto === "=SOMA(A1:A2)");

console.log("\nEstatísticas do rodapé");
const s = host.stats();
ok("conta abas", s.abas === 1);
ok("conta células preenchidas", s.celulas >= 3, JSON.stringify(s));
ok("zoom 100", s.zoom === 100);

console.log("\nGrade infinita: a navegação cresce a grade");
host.load({
  livro: { folhas: [{ nome: "G", celulas: {}, colunas: {}, linhas: {}, mesclas: [] }], ativa: 0 },
  config: antes.config,
  linha: 0,
  coluna: 0,
});
ok("a grade nasce com 1000 linhas", host.limLinhas === 1000, String(host.limLinhas));
// 51 PageDowns = 1020 linhas: passa da borda inicial de 1000
for (let i = 0; i < 51; i++) {
  grade.dispatch("keydown", { key: "PageDown", ctrlKey: false, shiftKey: false, altKey: false });
}
ok("a grade cresceu além das 1000 linhas", host.limLinhas > 1000, String(host.limLinhas));
ok("a célula ativa desceu além de 1000", st().linha >= 1000, String(st().linha));
digitar("fundo");
const celulasNovas = Object.values(st().livro.folhas[0].celulas);
ok("digitação gravou na região nova da grade", celulasNovas.some((c) => c.texto === "fundo"));

console.log("\nGrade infinita: rolar perto do fim cresce a grade");
host.load({
  livro: { folhas: [{ nome: "G", celulas: {}, colunas: {}, linhas: {}, mesclas: [] }], ativa: 0 },
  config: antes.config,
  linha: 0,
  coluna: 0,
});
const limiteAntes = host.limLinhas;
grade.scrollHeight = 25_000; // 1000 linhas de 25px
grade.scrollTop = 24_600; // já no fim visível
grade.dispatch("scroll");
ok("a rolagem até o fim cresceu a grade", host.limLinhas > limiteAntes, `${limiteAntes} -> ${host.limLinhas}`);

console.log("\nGrade infinita: conteúdo distante faz a grade nascer maior");
host.load({
  livro: {
    folhas: [{ nome: "Fundo", celulas: { A2500: { texto: "lá embaixo" }, D3000: { texto: "x" } }, colunas: {}, linhas: {}, mesclas: [] }],
    ativa: 0,
  },
  config: antes.config,
  linha: 0,
  coluna: 0,
});
ok("a grade cresceu para caber a linha 3000", host.limLinhas >= 3000, String(host.limLinhas));
ok("a célula distante continua no livro", st().livro.folhas[0].celulas.A2500?.texto === "lá embaixo");

console.log("\nClicar na letra seleciona a coluna inteira");
grade.scrollTop = 0;
grade.scrollLeft = 0;
grade.scrollHeight = 0;
grade.scrollWidth = 0;
host.load({
  livro: {
    folhas: [{ nome: "S", celulas: { A1: { texto: "10" }, A2: { texto: "20" } }, colunas: {}, linhas: {}, mesclas: [] }],
    ativa: 0,
  },
  config: antes.config,
  linha: 0,
  coluna: 0,
});
const cabColunas = pane.querySelector(".xl-cab-colunas");
const botoesCol = cabColunas.querySelectorAll("[data-colcab]");
ok("o cabeçalho desenhou letras de coluna", botoesCol.length > 0, String(botoesCol.length));
for (const fn of cabColunas.listeners.mousedown ?? []) fn({ target: botoesCol[0], preventDefault() {}, button: 0, shiftKey: false });
ok(
  "a seleção cobre a coluna até o fim da grade",
  host.sel.l1 === 0 && host.sel.l2 === host.limLinhas - 1 && host.sel.c1 === 0 && host.sel.c2 === 0,
  JSON.stringify(host.sel)
);

console.log("\nClicar no número seleciona a linha inteira");
const cabLinhas = pane.querySelector(".xl-cab-linhas");
const botoesLin = cabLinhas.querySelectorAll("[data-lincab]");
ok("o cabeçalho desenhou números de linha", botoesLin.length > 0, String(botoesLin.length));
for (const fn of cabLinhas.listeners.mousedown ?? []) fn({ target: botoesLin[0], preventDefault() {}, button: 0, shiftKey: false });
ok(
  "a seleção cobre a linha até o fim da grade",
  host.sel.c1 === 0 && host.sel.c2 === host.limColunas - 1 && host.sel.l1 === 0 && host.sel.l2 === 0,
  JSON.stringify(host.sel)
);

console.log("\nCtrl+Z e Ctrl+Y valem com o foco em qualquer ponto da planilha");
host.load({
  livro: { folhas: [{ nome: "U", celulas: {}, colunas: {}, linhas: {}, mesclas: [] }], ativa: 0 },
  config: antes.config,
  linha: 0,
  coluna: 0,
});
document.body.classList.add("xlsx-open");

// grava um valor (foco na grade) para ter o que desfazer
digitar("10");
ok("A1 guardou antes de desfazer", st().livro.folhas[0].celulas.A1?.texto === "10");

// o foco está num botão da fita: a tecla chega pela janela
const botaoFalso = new El("button");
window.dispatch("keydown", { key: "z", ctrlKey: true, target: botaoFalso });
ok("Ctrl+Z com o foco fora da grade desfaz", (st().livro.folhas[0].celulas.A1?.texto ?? "") === "");

window.dispatch("keydown", { key: "y", ctrlKey: true, target: botaoFalso });
ok("Ctrl+Y com o foco fora da grade refaz", st().livro.folhas[0].celulas.A1?.texto === "10");

window.dispatch("keydown", { key: "z", ctrlKey: true, target: botaoFalso });
window.dispatch("keydown", { key: "z", ctrlKey: true, shiftKey: true, target: botaoFalso });
ok("Ctrl+Shift+Z também refaz", st().livro.folhas[0].celulas.A1?.texto === "10");

// num campo de texto, o atalho da planilha não age (o desfazer é do texto)
window.dispatch("keydown", { key: "z", ctrlKey: true, target: entrada });
ok("Ctrl+Z dentro de campo de texto não mexe na planilha", st().livro.folhas[0].celulas.A1?.texto === "10");

// fora da planilha (Início ou Configurações por cima), não mexe
document.body.classList.add("home-open");
window.dispatch("keydown", { key: "z", ctrlKey: true, target: botaoFalso });
ok("com o Início aberto, Ctrl+Z não mexe na planilha", st().livro.folhas[0].celulas.A1?.texto === "10");
document.body.classList.remove("home-open");

// com um diálogo aberto, também não
modalAberto = true;
window.dispatch("keydown", { key: "z", ctrlKey: true, target: botaoFalso });
ok("com diálogo aberto, Ctrl+Z não mexe na planilha", st().livro.folhas[0].celulas.A1?.texto === "10");
modalAberto = false;

// e a grade continua atendendo o atalho dela
grade.dispatch("keydown", { key: "z", ctrlKey: true });
ok("Ctrl+Z com o foco na grade continua desfazendo", (st().livro.folhas[0].celulas.A1?.texto ?? "") === "");
document.body.classList.remove("xlsx-open");

console.log("\nResumo");
ok("resumo menciona abas", host.resumo().includes("aba"), host.resumo());

console.log(`\n${passou} passaram, ${falhou} falharam`);
process.exit(falhou ? 1 : 0);