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
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
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
    entryPoints: [join(raiz, entrada)],
    bundle: true,
    platform: "node",
    format: "esm",
    outfile: join(tmp, saida),
    logLevel: "error",
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
  abrirFormalizar: (op: { texto: string; origem: string; aplicar: (novo: string) => void }) => void;
};

{
  const texto = "A gente vai dar uma olhada no msm relatório e eu acho que dá, sabe?";
  let aplicado: string | null = null;
  J.abrirFormalizar({ texto, origem: "seleção", aplicar: (novo) => (aplicado = novo) });

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
  checa(
    "aplicar entrega o texto final",
    aplicado === "Nós vamos examinar o mesmo relatório e entende-se que dá, sabe?",    String(aplicado)
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
