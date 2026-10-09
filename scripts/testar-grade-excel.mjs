// Verifica a grade do Excel num DOM simulado (sem navegador): monta um
// ExcelHost, simula a digitação de célula por teclado e confere o que o modelo
// gravou e o que a tela desenhou.
//
// É o complemento do scripts/testar-excel.mjs: aquele prova o cálculo e o
// arquivo .xlsx; este prova que a interface responde.

import { mkdirSync, existsSync } from "node:fs";
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
const caminhoHost = join(saidaJs, "excel", "host.js");
// --recompile força a recompilação (o caminho padrão reaproveita o que existe)
if (!existsSync(caminhoHost) || process.argv.includes("--recompile")) {
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
      "--rootDir", join(raiz, "src"),
      join(raiz, "src", "excel", "host.ts"),
    ],
    { stdio: "inherit", cwd: raiz }
  );
  const fs = await import("node:fs");
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
}

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
    this.style = new Proxy({ setProperty() {} }, {
      set(t, k, v) { t[k] = v; return true; },
      get(t, k) { return t[k] ?? ""; },
    });
    this._innerHTML = "";
    this._text = "";
    this.listeners = {};
    this.hidden = false;
    this.value = "";
    this.type = "text";
  }
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
      this.children.push(filho);
    }
  }
  get textContent() { return this._text; }
  set textContent(v) { this._text = v; this._innerHTML = ""; this.children = []; }
  set className(v) { this._value_class = v; this._cls = v; }
  get className() { return this._cls ?? ""; }
  append(...f) { for (const x of f) { this.children.push(x); x.pai = this; } }
  addEventListener(t, fn) { (this.listeners[t] ||= []).push(fn); }
  dispatch(t, ev = {}) {
    for (const fn of this.listeners[t] ?? []) fn({ preventDefault() {}, stopPropagation() {}, target: this, ...ev });
  }
  focus() {}
  select() {}
  setSelectionRange() {}
  scrollIntoView() {}
  setAttribute(k, v) { this.attrs[k] = String(v); }
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
docEl.classList = "";
const docClass = { add() {}, remove() {}, contains: () => false };
globalThis.document = {
  body: docEl,
  createElement: (t) => new El(t),
  querySelector: () => new El(),
  querySelectorAll: () => [],
  getElementById: () => null,
  addEventListener() {},
  removeEventListener() {},
};
globalThis.window = {
  addEventListener() {},
  setTimeout: (fn, ms) => setTimeout(fn, ms),
  clearTimeout: (t) => clearTimeout(t),
  matchMedia: () => ({ matches: false }),
  getComputedStyle: () => ({}),
};
globalThis.requestAnimationFrame = (fn) => setTimeout(fn, 0);
// o Node moderno já tem "navigator" (só leitura): só criamos se não existir
if (!globalThis.navigator) globalThis.navigator = { clipboard: { writeText: async () => {} } };
globalThis.atob = (s) => Buffer.from(s, "base64").toString("binary");
globalThis.btoa = (s) => Buffer.from(s, "binary").toString("base64");
globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
document.documentElement = { dataset: {} };
void docClass;

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

console.log("\nResumo");
ok("resumo menciona abas", host.resumo().includes("aba"), host.resumo());

console.log(`\n${passou} passaram, ${falhou} falharam`);
process.exit(falhou ? 1 : 0);