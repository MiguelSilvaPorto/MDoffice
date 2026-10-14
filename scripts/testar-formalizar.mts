// Teste da formalização: o que o plano acha, o risco de cada troca e o texto que sai.
//
// Seis partes, na ordem em que protegem:
//   1. ACHAR — os marcadores do catálogo e das janelas de frase entram no plano, com a
//      classe e o risco certos (segura/sentido/manual) — e os dois consertos do catálogo
//      ("dar uma olhada no", "um monte de") ficam presos aqui.
//   2. NÃO ACHAR — citação, código e texto já formal ficam de fora.
//   3. APLICAR — o texto sai na ordem certa, com os limites para a prévia pintar, e
//      sobreposição não come pedaço.
//   4. MEDIR — o MIP cai depois das trocas seguras.
//   5. A JANELA — abre, pinta, decide (checkbox e chip) e aplica, num DOM de mentira.
//   6. O CSS — toda classe que a janela usa existe na folha, e a folha entra no app.
//
// Roda com: npm run test:formalizar
import { build } from "esbuild";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const raiz = dirname(dirname(fileURLToPath(import.meta.url)));
let falhas = 0;
const checa = (nome: string, ok: boolean, extra = "") => {
  console.log(`  ${ok ? "ok  " : "FALHA"} ${nome}${!ok && extra ? ` — ${extra}` : ""}`);
  if (!ok) falhas++;
};

// ---------------------------------------------------------------- empacotar

const tmp = mkdtempSync(join(tmpdir(), "formalizar-"));

/** O `?raw` do Vite, que o esbuild não conhece sozinho (as regras ABNT em TOML usam). */
const pluginRaw = {
  name: "raw",
  setup(api: {
    onResolve: (o: { filter: RegExp }, cb: (a: { path: string; importer: string }) => unknown) => void;
    onLoad: (o: { filter: RegExp; namespace: string }, cb: (a: { path: string }) => unknown) => void;
  }) {
    api.onResolve({ filter: /\?raw$/ }, (args) => ({
      path: resolve(dirname(args.importer), args.path.replace(/\?raw$/, "")),
      namespace: "raw",
    }));
    api.onLoad({ filter: /.*/, namespace: "raw" }, (args) => ({
      contents: readFileSync(args.path, "utf8"),
      loader: "text",
    }));
  },
};

const empacotar = async (entrada: string, saida: string) => {
  await build({
    entryPoints: [isAbsolute(entrada) ? entrada : join(raiz, entrada)],
    bundle: true,
    platform: "node",
    format: "esm",
    outfile: join(tmp, saida),
    logLevel: "error",
    nodePaths: [join(raiz, "node_modules")],
    plugins: [pluginRaw as never],
  });
  return import(pathToFileURL(join(tmp, saida)).href);
};

interface Troca {
  from: number;
  to: number;
  de: string;
  para?: string;
  alternativas: string[];
  classe: string;
  risco: "segura" | "sentido" | "manual";
  message: string;
}

const F = (await empacotar("src/broker/formalizar.ts", "formalizar.mjs")) as {
  trocasDeFormalizacao: (texto: string) => Troca[];
  aplicarTrocas: (texto: string, trocas: Troca[]) => { texto: string; aplicadas: { de: [number, number]; para: [number, number] }[] };
  mipDe: (texto: string) => number;
  ROTULO_RISCO: Record<string, string>;
};

const porDe = (trocas: Troca[], de: string) => trocas.find((t) => t.de.trim().toLowerCase() === de.trim().toLowerCase());

// ---------------------------------------------------------------- 1. achar

console.log("achar os marcadores e classificar o risco");
{
  const texto = "A gente vai entregar o relatório pra ele, porque a gente fez o msm trajeto.";
  const trocas = F.trocasDeFormalizacao(texto);

  const aGente = porDe(trocas, "A gente vai");
  checa("janela de frase entra como troca segura", aGente?.risco === "segura" && aGente.para === "Nós vamos", JSON.stringify(aGente));
  checa("a classe vem do catálogo", aGente?.classe === "oralidade");

  const pra = porDe(trocas, "pra");
  checa("catálogo entra como troca segura", pra?.risco === "segura" && pra.para === "para" && pra.classe === "contracao", JSON.stringify(pra));

  const msm = porDe(trocas, "msm");
  checa("sem correção pronta, o risco é de sentido", msm?.risco === "sentido" && msm.para === "mesmo" && msm.alternativas.length === 0, JSON.stringify(msm));

  const primeiro = trocas[0];
  checa("a lista vem na ordem do texto", primeiro.from === 0 && trocas.every((t, i) => i === 0 || t.from >= trocas[i - 1].from));
}

{
  const trocas = F.trocasDeFormalizacao("O prazo muda toda hora, sabe? E é curto.");
  const sabe = porDe(trocas, "sabe?");
  checa("aviso sem troca pronta vira “manual”", sabe?.risco === "manual" && sabe.para === undefined, JSON.stringify(sabe));
}

{
  const trocas = F.trocasDeFormalizacao("Eu acho que os dados mudaram.");
  const acho = porDe(trocas, "Eu acho que");
  checa(
    "atenuação traz as alternativas e o risco explicado",
    acho?.risco === "sentido" && acho.para === "Considera-se que" && acho.alternativas.includes("Entende-se que"),
    JSON.stringify(acho)
  );
  checa("o risco pede decisão, não correção automática", acho?.risco !== "segura");
}

{
  // Dois erros que a prévia revelou no catálogo (aplicados em massa, escreviam errado):
  // a troca da "olhada" precisa levar a preposição junto e o "monte de" pede acordo.
  const trocas = F.trocasDeFormalizacao("Vou dar uma olhada no relatório e um monte de gente reclamou.");
  const olhada = porDe(trocas, "dar uma olhada no");
  checa("“dar uma olhada no” vira “examinar o” (leva a preposição)", olhada?.risco === "segura" && olhada.para === "examinar o ", JSON.stringify(olhada));
  const monte = porDe(trocas, "um monte de");
  checa(
    "“um monte de” pede acordo: vira sugestão",
    monte?.risco === "sentido" && monte.para === "muitos" && monte.alternativas.includes("muitas"),
    JSON.stringify(monte)
  );
  const solta = porDe(F.trocasDeFormalizacao("Vou dar uma olhada e já aviso."), "dar uma olhada");
  checa("a “olhada” sozinha não tem correção pronta", solta?.risco === "sentido" && solta.para === "examinar", JSON.stringify(solta));
}

// ---------------------------------------------------------------- 2. não achar

console.log("ficar de fora: citação, código e texto já formal");
{
  const citacao = F.trocasDeFormalizacao("> pra ele, tá certo?\n\nO texto ficou parado.");
  checa("citação não entra no plano", citacao.length === 0, JSON.stringify(citacao));
}
{
  const codigo = F.trocasDeFormalizacao("Use `pra` no comando.\n\n```\npra rodar: npm start\n```\n");
  checa("código não entra no plano", codigo.length === 0, JSON.stringify(codigo));
}
{
  const limpo = F.trocasDeFormalizacao("O relatório foi entregue à equipe no prazo previsto.");
  checa("texto já formal não tem troca", limpo.length === 0, JSON.stringify(limpo));
}
{
  checa("texto vazio não tem troca", F.trocasDeFormalizacao("   \n  ").length === 0);
}

// ---------------------------------------------------------------- 3. aplicar

console.log("aplicar as trocas escolhidas");
{
  const texto = "A gente vai entregar o relatório pra ele.";
  const trocas = F.trocasDeFormalizacao(texto);
  const resultado = F.aplicarTrocas(texto, trocas);
  checa("o texto sai formalizado", resultado.texto === "Nós vamos entregar o relatório para ele.", resultado.texto);
  checa("cada troca tem o limite no original e no novo", resultado.aplicadas.length === 2);
  for (const a of resultado.aplicadas) {
    const de = texto.slice(a.de[0], a.de[1]);
    const para = resultado.texto.slice(a.para[0], a.para[1]);
    checa(`os limites de “${de}” caem no lugar certo`, de.trim().length > 0 && para.trim().length > 0, `${de} → ${para}`);
  }
  checa("o antes e o depois apontam para o mesmo trecho semântico", resultado.aplicadas[0].de[0] === 0 && resultado.aplicadas[0].para[0] === 0);
}
{
  const texto = "abc def";
  const t = (from: number, to: number, para: string): Troca => ({
    from,
    to,
    de: texto.slice(from, to),
    para,
    alternativas: [],
    classe: "muleta",
    risco: "segura",
    message: "",
  });
  const resultado = F.aplicarTrocas(texto, [t(0, 3, "X"), t(2, 5, "Y")]);
  checa("sobreposição: vale a primeira", resultado.texto === "X def", resultado.texto);
  checa("a troca com sobreposição não entra na lista", resultado.aplicadas.length === 1);
}
{
  const texto = "A gente vai revisar.";
  const trocas = F.trocasDeFormalizacao(texto);
  const so = trocas.filter((t) => t.de === "A gente vai");
  const resultado = F.aplicarTrocas(texto, so);
  checa("aplicar um subconjunto deixa o resto em paz", resultado.texto === "Nós vamos revisar.", resultado.texto);
  checa("troca sem `para` não muda o texto", F.aplicarTrocas(texto, trocas.filter((t) => t.risco === "manual")).texto === texto);
}

// ---------------------------------------------------------------- 4. medir

console.log("medir o efeito (MIP)");
{
  const texto = "A gente vai entregar pra ele, porque vcs pediram e eu acho que é melhor.";
  const trocas = F.trocasDeFormalizacao(texto);
  const seguras = trocas.filter((t) => t.risco === "segura");
  const antes = F.mipDe(texto);
  const depois = F.mipDe(F.aplicarTrocas(texto, seguras).texto);
  checa("o MIP cai com as trocas seguras", antes > depois, `${antes} → ${depois}`);
  checa("as trocas manuais continuam contando", depois > 0, String(depois));
  checa("sem marcador, MIP zero", F.mipDe("O relatório foi entregue à equipe.") === 0);
}

// ---------------------------------------------------------------- 5. a janela

console.log("a janela abre, pinta e aplica (DOM de mentira)");

/** Elemento mínimo: children, classes, texto, eventos — o que a janela usa. */
class El {
  readonly tag: string;
  children: (El | Texto)[] = [];
  className = "";
  checked = false;
  disabled = false;
  private proprio: string | null = null;
  private ev: Record<string, ((e: unknown) => void)[]> = {};
  constructor(tag: string) {
    this.tag = tag;
  }
  get textContent(): string {
    return (this.proprio ?? "") + this.children.map((c) => c.textContent).join("");
  }
  set textContent(v: string) {
    this.children = [];
    this.proprio = v;
  }
  append(...nos: (El | Texto | string)[]): void {
    for (const n of nos) this.children.push(typeof n === "string" ? new Texto(n) : n);
  }
  setAttribute(): void {}
  addEventListener(t: string, f: (e: unknown) => void): void {
    (this.ev[t] ??= []).push(f);
  }
  removeEventListener(): void {}
  remove(): void {}
  disparar(t: string): void {
    for (const f of this.ev[t] ?? []) f({ target: this, preventDefault() {}, stopPropagation() {} });
  }
  /** Todos os descendentes (ou o próprio) que têm a classe. */
  procurar(cls: string): El[] {
    const achados: El[] = [];
    const passo = (el: El) => {
      if (el.className.split(/\s+/).includes(cls)) achados.push(el);
      for (const c of el.children) if (c instanceof El) passo(c);
    };
    passo(this);
    return achados;
  }
}
class Texto {
  private readonly texto: string;
  constructor(texto: string) {
    this.texto = texto;
  }
  get textContent(): string {
    return this.texto;
  }
}

const docEl = new El("body");
(globalThis as unknown as Record<string, unknown>).document = {
  body: docEl,
  createElement: (t: string) => new El(t),
  createTextNode: (t: string) => new Texto(t),
  querySelector: () => null,
  getElementById: () => null,
  addEventListener() {},
  removeEventListener() {},
};

const J = (await empacotar("src/formalizar.ts", "janela.mjs")) as {
  abrirFormalizar: (op: {
    texto: string;
    origem: string;
    aplicar: (novo: string, aplicadas: { de: [number, number]; para: [number, number] }[]) => void;
  }) => void;
};

{
  const texto = "A gente vai dar uma olhada no msm relatório e eu acho que dá, sabe?";
  let aplicado: string | null = null;
  let aplicadas: { de: [number, number]; para: [number, number] }[] = [];
  J.abrirFormalizar({
    texto,
    origem: "seleção",
    aplicar: (novo, trocasAplicadas) => {
      aplicado = novo;
      aplicadas = trocasAplicadas;
    },
  });

  const modal = docEl.procurar("fz-modal")[0];
  checa("a janela entra no body", modal !== undefined);
  const [antes, depois] = modal.procurar("fz-texto");
  checa("o antes mostra o texto original", antes.textContent === texto, antes.textContent);
  checa(
    "o depois já vem com as trocas seguras",
    depois.textContent.startsWith("Nós vamos examinar o msm relatório"),
    depois.textContent
  );  checa("o que depende de sentido espera (msm fica)", depois.textContent.includes("msm"), depois.textContent);
  checa("as manuais ficam como estavam", depois.textContent.includes("sabe?"), depois.textContent);
  checa("o MIP aparece no cabeçalho", /MIP [\d,.]+ → [\d,.]+/.test(modal.procurar("fz-mip")[0].textContent), modal.procurar("fz-mip")[0].textContent);

  const linhas = modal.procurar("fz-troca");
  checa("a lista tem uma linha por aviso", linhas.length === 5, String(linhas.length));
  const marcadas = linhas.filter((l) => l.procurar("fz-check")[0].checked);
  checa("seguras marcadas, de sentido desmarcadas", marcadas.length === 2, `${marcadas.length} marcada(s)`);
  const manual = linhas.find((l) => /reformule/.test(l.textContent));
  checa("a linha manual não tem caixa", manual !== undefined && manual.procurar("fz-check")[0].disabled, JSON.stringify(manual?.textContent));

  const linhaMsm = linhas.find((l) => l.textContent.includes("msm"));
  const checkMsm = linhaMsm!.procurar("fz-check")[0];
  checkMsm.checked = true;
  checkMsm.disparar("change");
  checa("marcar uma decisão muda o depois ao vivo", modal.procurar("fz-texto")[1].textContent.includes("o mesmo relatório"), modal.procurar("fz-texto")[1].textContent);

  const linhaAcho = linhas.find((l) => l.textContent.includes("acho"));
  const alternativas = linhaAcho!.procurar("fz-alt");
  checa("a linha com alternativas mostra as outras formas", alternativas.length === 1, JSON.stringify(alternativas.map((a) => a.textContent)));
  alternativas[0].disparar("click");
  checa("o chip troca a forma escolhida", modal.procurar("fz-texto")[1].textContent.includes("entende-se que dá"), modal.procurar("fz-texto")[1].textContent);

  const botao = modal.procurar("primary")[0];
  checa("o botão diz quantas trocas vão", /Aplicar 4 troca/.test(botao.textContent), botao.textContent);
  botao.disparar("click");
  checa("aplicar entrega o texto final", aplicado === "Nós vamos examinar o mesmo relatório e entende-se que dá, sabe?", String(aplicado));
  checa(
    "aplicar entrega também onde cada troca caiu (é o que o Word usa)",
    aplicadas.length === 4 &&
      aplicadas.every((a) => texto.slice(a.de[0], a.de[1]).trim().length > 0 && (aplicado as string).slice(a.para[0], a.para[1]).trim().length > 0),
    JSON.stringify(aplicadas)
  );
}

console.log("o mapa do Word (documento ↔ texto)");
{
  const W = (await empacotar("src/word/project.ts", "word-mapa.mjs")) as {
    project: (doc: unknown) => { texto: string; blocos: { proj: number; pm: number; len: number }[] };
    projectRange: (doc: unknown, de?: number, ate?: number) => { texto: string; blocos: { proj: number; pm: number; len: number }[] };
    toPm: (blocos: { proj: number; pm: number; len: number }[], idx: number) => { pos: number; bloco: number } | null;
  };
  interface DocWord {
    child: (i: number) => { nodeSize: number };
  }
  const S = (await empacotar("src/word/schema.ts", "word-schema.mjs")) as {
    schema: { node: (tipo: string, attrs: unknown, conteudo?: unknown[]) => DocWord; text: (t: string) => unknown };
  };

  const par = (t: string) => S.schema.node("paragraph", null, t ? [S.schema.text(t)] : []);
  const p1 = "A gente vai revisar o relatório.";
  const p3 = "Vou dar uma olhada no prazo, sabe?";
  const doc = S.schema.node("doc", null, [par(p1), par(""), par(p3)]);
  const tamanho = (i: number) => doc.child(i).nodeSize;
  const inicioP3 = 1 + tamanho(0) + tamanho(1); // abre p1 + p1 + p2 (vazio) + abre p3

  const proj = W.project(doc);
  checa("a projeção junta os parágrafos com quebra de linha", proj.texto === `${p1}\n\n${p3}`, JSON.stringify(proj.texto));
  checa("o mapa guarda o parágrafo vazio (é a linha em branco)", proj.blocos.length === 3, String(proj.blocos.length));
  checa("o bloco vazio começa onde o texto diz", proj.blocos[1].proj === p1.length + 1, `${proj.blocos[1].proj}`);
  checa("o 3º bloco começa onde o texto diz", proj.blocos[2].proj === p1.length + 2, `${proj.blocos[2].proj}`);
  checa("a posição no documento do 3º parágrafo bate", proj.blocos[2].pm === inicioP3, `${proj.blocos[2].pm} vs ${inicioP3}`);
  checa("o índice do texto volta para a posição certa", W.toPm(proj.blocos, proj.blocos[2].proj)?.pos === inicioP3);
  checa("índice fora dos blocos não tem posição", W.toPm(proj.blocos, proj.texto.length + 5) === null);
  checa(
    "índices em parágrafos diferentes têm blocos diferentes",
    W.toPm(proj.blocos, 0)!.bloco !== W.toPm(proj.blocos, proj.texto.length - 1)!.bloco
  );

  const projSel = W.projectRange(doc, inicioP3 + 4, inicioP3 + 14);
  checa("a seleção projeta só o trecho pedido", projSel.texto === p3.slice(4, 14), JSON.stringify(projSel.texto));
  checa("a seleção tem um bloco só (não atravessa parágrafo)", projSel.blocos.length === 1, String(projSel.blocos.length));
  checa("a seleção mapeia de volta para a posição certa", W.toPm(projSel.blocos, 0)?.pos === inicioP3 + 4, `${W.toPm(projSel.blocos, 0)?.pos}`);
}

console.log("aplicar no Word (troca no lugar, formato em paz)");
{
  const entrada = join(tmp, "palavra.ts");
  const caminho = (p: string) => join(raiz, p).replace(/\\/g, "/");
  writeFileSync(
    entrada,
    `export { project, projectRange, toPm, transacaoDasTrocas } from "${caminho("src/word/project.ts")}";\n` +
      `export { schema } from "${caminho("src/word/schema.ts")}";\n` +
      `export { EditorState } from "prosemirror-state";\n`
  );
  interface TextoPM {
    isText?: boolean;
    text?: string;
    marks?: { type: { name: string } }[];
    textContent: string;
    childCount: number;
    child: (i: number) => TextoPM;
    descendants: (f: (n: TextoPM) => void) => void;
  }
  interface DocPM extends TextoPM {}
  interface EstadoPM {
    doc: DocPM;
    apply: (tr: unknown) => { doc: DocPM };
  }
  const W = (await empacotar(entrada, "palavra.mjs")) as {
    project: (doc: DocPM) => { texto: string; blocos: { proj: number; pm: number; len: number }[] };
    transacaoDasTrocas: (
      estado: EstadoPM,
      blocos: { proj: number; pm: number; len: number }[],
      novo: string,
      aplicadas: { de: [number, number]; para: [number, number] }[]
    ) => { steps: unknown[] } | null;
    schema: {
      node: (tipo: string, attrs: unknown, conteudo?: unknown[]) => DocPM;
      text: (t: string, marcas?: unknown[]) => unknown;
      mark: (nome: string) => unknown;
    };
    EditorState: { create: (cfg: { doc: DocPM }) => EstadoPM };
  };

  const marcado = (t: string, marca: string) => W.schema.text(t, [W.schema.mark(marca)]);
  const doc = W.schema.node("doc", null, [
    W.schema.node("paragraph", null, [marcado("A gente vai", "bold"), W.schema.text(" revisar o relatório.")]),
    W.schema.node("paragraph", null, [W.schema.text("Vou dar uma olhada no prazo, "), marcado("sabe?", "italic")]),
  ]);
  const estado = W.EditorState.create({ doc });
  const proj = W.project(doc);
  const trocas = F.trocasDeFormalizacao(proj.texto).filter((t) => t.risco === "segura");
  const resultado = F.aplicarTrocas(proj.texto, trocas);
  const tr = W.transacaoDasTrocas(estado, proj.blocos, resultado.texto, resultado.aplicadas);
  checa("a transação sai com uma troca por troca", tr !== null && tr.steps.length === resultado.aplicadas.length, `${tr?.steps.length} vs ${resultado.aplicadas.length}`);

  const dep = estado.apply(tr!).doc;
  checa("o 1º parágrafo sai formalizado", dep.child(0).textContent === "Nós vamos revisar o relatório.", dep.child(0).textContent);
  checa("o 2º parágrafo sai formalizado", dep.child(1).textContent === "Vou examinar o prazo, sabe?", dep.child(1).textContent);
  checa("nenhum parágrafo nasce ou morre", dep.childCount === doc.childCount, `${dep.childCount} vs ${doc.childCount}`);

  const pedacos: { texto: string; marcas: string[] }[] = [];
  dep.descendants((n) => {
    if (n.isText) pedacos.push({ texto: n.text ?? "", marcas: (n.marks ?? []).map((m) => m.type.name) });
  });
  checa(
    "a troca herda o formato do trecho que substituiu",
    pedacos.some((p) => p.texto.startsWith("Nós vamos") && p.marcas.includes("bold")),
    JSON.stringify(pedacos)
  );
  checa(
    "o formato do resto fica em paz",
    pedacos.some((p) => p.texto.includes("revisar o relatório.") && p.marcas.length === 0) && pedacos.some((p) => p.texto.includes("sabe?") && p.marcas.includes("italic")),
    JSON.stringify(pedacos)
  );
}

console.log("a janela e o CSS andam juntos");
{
  const dialogo = readFileSync(join(raiz, "src/formalizar.ts"), "utf8");
  const css = readFileSync(join(raiz, "src/styles/formalizar.css"), "utf8");
  const folha = readFileSync(join(raiz, "src/styles.css"), "utf8");
  const classes = new Set(dialogo.match(/fz-[a-z-]+/g) ?? []);
  const faltando = [...classes].filter((c) => !css.includes(`.${c}`));
  checa("toda classe usada na janela existe no CSS", faltando.length === 0, faltando.join(", "));
  checa("a folha da janela entra no app", folha.includes("styles/formalizar.css"));
  for (const estado of ["fz-marca.velho", "fz-marca.novo", "fz-risco.segura", "fz-risco.sentido"]) {
    checa(`o estado “${estado}” tem estilo`, css.includes(`.${estado}`));
  }
}

console.log(falhas ? `\n${falhas} falha(s).` : "\ntudo certo");
process.exit(falhas ? 1 : 0);
