// Testa a lógica de edição da apresentação (sem abrir o app): geometria, operações em várias formas e texto.
// Uso: node scripts/testar-edicao-pptx.mjs
import { build } from "esbuild";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const raiz = new URL("..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const tmp = mkdtempSync(join(tmpdir(), "pp-edicao-"));
const empacotar = async (entrada, saida) => {
  await build({ entryPoints: [join(raiz, entrada)], bundle: true, platform: "node", format: "esm", outfile: join(tmp, saida), logLevel: "error" });
  return import(pathToFileURL(join(tmp, saida)).href);
};

let falhas = 0;
const ok = (nome, cond, detalhe = "") => {
  if (!cond) falhas++;
  console.log(`${cond ? "OK   " : "FALHA"} ${nome}${detalhe ? "  " + detalhe : ""}`);
};
const perto = (a, b, tol = 0.01) => Math.abs(a - b) <= tol;

const G = await empacotar("src/powerpoint/edicao/geometria.ts", "geometria.mjs");
const O = await empacotar("src/powerpoint/edicao/operacoes.ts", "operacoes.mjs");
const T = await empacotar("src/powerpoint/edicao/texto.ts", "texto.mjs");
const F = await empacotar("src/powerpoint/edicao/formato.ts", "formato.mjs");
const MED = await empacotar("src/powerpoint/edicao/medida.ts", "medida.mjs");

// ---------------------------------------------------------------- geometria
const dim = { w: 960, h: 540 };
{
  const b0 = { x: 10, y: 10, w: 20, h: 20 };
  // sem rotação: puxar a alça "se" muda só largura/altura, o canto superior esquerdo não sai do lugar
  const r = G.redimensionar(b0, 0, "se", 96, 54, dim);
  ok("alça se: canto superior esquerdo parado", perto(r.x, 10) && perto(r.y, 10), JSON.stringify(r));
  ok("alça se: cresce 96pt x 54pt (10% x 10%)", perto(r.w, 30) && perto(r.h, 30));
  // alça "nw": o canto inferior direito fica parado
  const n = G.redimensionar(b0, 0, "nw", -96, -54, dim);
  ok("alça nw: canto inferior direito parado", perto(n.x + n.w, 30) && perto(n.y + n.h, 30));
  // girada 90 graus: a âncora (canto oposto) continua no mesmo ponto da lâmina
  const antes = G.cantos(G.paraPt(b0, dim), 90);
  const depois = G.redimensionar(b0, 90, "se", 40, 20, dim);
  const cantosDepois = G.cantos(G.paraPt(depois, dim), 90);
  ok("girada: canto oposto não se mexe", perto(antes[0].x, cantosDepois[0].x, 0.05) && perto(antes[0].y, cantosDepois[0].y, 0.05), JSON.stringify([antes[0], cantosDepois[0]]));
  // proporção mantida
  const p = G.redimensionar({ x: 10, y: 10, w: 20, h: 10 }, 0, "se", 96, 0, dim, { proporcao: true });
  ok("Shift mantém a proporção", perto((p.w / 100) * dim.w / ((p.h / 100) * dim.h), (20 * 9.6) / (10 * 5.4), 0.01));
  // do centro
  const c = G.redimensionar(b0, 0, "e", 48, 0, dim, { doCentro: true });
  ok("Alt: cresce dos dois lados (centro fixo)", perto(c.x + c.w / 2, 20) && perto(c.w, 30));
  // envolvente de forma girada 90 graus: troca largura e altura
  const env = G.envolvente({ box: { x: 40, y: 40, w: 20, h: 10 }, rot: 90 }, dim);
  ok("envolvente girada 90°", perto((env.w / 100) * dim.w, (10 / 100) * dim.h) && perto((env.h / 100) * dim.h, (20 / 100) * dim.w), JSON.stringify(env));
  // encaixe no centro da lâmina
  const e = G.encaixar({ x: 39.7, y: 10, w: 20, h: 10 }, [], 0.6);
  ok("encaixe no centro da lâmina", perto(e.dx, 0.3) && e.guias.some((g) => g.eixo === "v" && g.pos === 50), JSON.stringify(e));
  ok("ângulo do ponteiro: acima = 0°", perto(G.anguloDoPonteiro(100, 50, 100, 100), 0) && perto(G.anguloDoPonteiro(150, 100, 100, 100), 90));
}

// ---------------------------------------------------------------- beirada da forma (mover) x texto (selecionar)
{
  const caixa = { x: 100, y: 100, w: 400, h: 200 }; // em pt
  ok("no meio da caixa não é beirada", !G.pertoDaBorda(caixa, { x: 300, y: 200 }, 6));
  ok("a 3 pt da esquerda é beirada", G.pertoDaBorda(caixa, { x: 103, y: 200 }, 6));
  ok("a 3 pt do topo é beirada", G.pertoDaBorda(caixa, { x: 300, y: 103 }, 6));
  ok("a 3 pt da direita é beirada", G.pertoDaBorda(caixa, { x: 497, y: 200 }, 6));
  ok("a 3 pt de baixo é beirada", G.pertoDaBorda(caixa, { x: 300, y: 297 }, 6));
  ok("a 7 pt da borda já é texto", !G.pertoDaBorda(caixa, { x: 107, y: 200 }, 6) && !G.pertoDaBorda(caixa, { x: 300, y: 293 }, 6));
  ok("exatamente em cima do contorno é beirada", G.pertoDaBorda(caixa, { x: 100, y: 100 }, 6) && G.pertoDaBorda(caixa, { x: 500, y: 300 }, 6));
  ok("fora da caixa não é beirada", !G.pertoDaBorda(caixa, { x: 99, y: 200 }, 6) && !G.pertoDaBorda(caixa, { x: 300, y: 301 }, 6));
  const t = T.temTexto;
  ok("forma vazia não tem texto", !t(undefined) && !t([]) && !t([{ runs: [], align: "esquerda", lvl: 0, marL: 0, indent: 0, spcBef: 0, spcAft: 0, endSize: 18 }]));
  ok("o \\u200b do parágrafo vazio não conta como texto", !t([{ runs: [{ text: "\u200b" }], align: "esquerda", lvl: 0, marL: 0, indent: 0, spcBef: 0, spcAft: 0, endSize: 18 }]));
  ok("com texto de verdade conta", t([{ runs: [{ text: "A no trabalho" }], align: "esquerda", lvl: 0, marL: 0, indent: 0, spcBef: 0, spcAft: 0, endSize: 18 }]));
}

// ---------------------------------------------------------------- fita métrica (a medida do gesto)
{
  const d = { w: 960, h: 540 };
  ok("o x mora na linha em pé", MED.textoX({ x: 10, y: 25, w: 20, h: 10 }, d) === "x 3,4 cm", MED.textoX({ x: 10, y: 25, w: 20, h: 10 }, d));
  ok("o y mora na linha deitada", MED.textoY({ x: 10, y: 25, w: 20, h: 10 }, d) === "y 4,8 cm", MED.textoY({ x: 10, y: 25, w: 20, h: 10 }, d));
  ok("a largura sai na linha de baixo", MED.textoLargura({ x: 0, y: 0, w: 50, h: 40 }, d) === "16,9 cm", MED.textoLargura({ x: 0, y: 0, w: 50, h: 40 }, d));
  ok("a altura sai na linha da direita", MED.textoAltura({ x: 0, y: 0, w: 50, h: 40 }, d) === "7,6 cm", MED.textoAltura({ x: 0, y: 0, w: 50, h: 40 }, d));
  ok("caixa zerada sai 0 cm", MED.textoLargura({ x: 0, y: 0, w: 0, h: 0 }, d) === "0 cm" && MED.textoAltura({ x: 0, y: 0, w: 0, h: 0 }, d) === "0 cm");
  ok("vírgula decimal, como o painel", /^x \d+,\d cm$/.test(MED.textoX({ x: 15, y: 15, w: 30, h: 30 }, d)), MED.textoX({ x: 15, y: 15, w: 30, h: 30 }, d));
  ok("uma casa no máximo (nada de 16,933333)", !/\d,\d\d/.test(MED.textoLargura({ x: 0, y: 0, w: 13, h: 17 }, d)), MED.textoLargura({ x: 0, y: 0, w: 13, h: 17 }, d));
}

// ---------------------------------------------------------------- operações em várias formas
const forma = (id, x, y, w, h, extra = {}) => ({ id, kind: "forma", box: { x, y, w, h }, text: "", fontFamily: "A", fontSize: 18, color: "000000", bold: false, italic: false, align: "esquerda", fill: "", src: "", rot: 0, geom: "rect", ...extra });
const slide = (shapes) => ({ md: "", layout: "conteudo", notes: "", shapes });
{
  const s = slide([forma("a", 10, 10, 10, 10), forma("b", 40, 30, 10, 10), forma("c", 80, 60, 10, 10)]);
  const e = O.alinharFormas(s, ["a", "b", "c"], "esquerda", dim);
  ok("alinhar à esquerda leva todas à menor borda", e.shapes.every((f) => perto(f.box.x, 10)));
  const dist = O.distribuirFormas(s, ["a", "b", "c"], "h", dim);
  const [a, b, c] = dist.shapes;
  ok("distribuir: espaços iguais", perto(b.box.x - (a.box.x + a.box.w), c.box.x - (b.box.x + b.box.w)), JSON.stringify(dist.shapes.map((f) => f.box.x)));
  ok("alinhar uma forma só alinha à lâmina", O.alinharFormas(s, ["a"], "centro", dim).shapes[0].box.x === 45);
  const g = O.agruparFormas(s, ["a", "b"]);
  ok("agrupar dá o mesmo id às formas", g.shapes[0].grupo && g.shapes[0].grupo === g.shapes[1].grupo && !g.shapes[2].grupo);
  ok("comGrupos puxa o resto do grupo", O.comGrupos(g, ["a"]).sort().join() === "a,b");
  ok("desagrupar limpa o grupo", O.desagruparFormas(g, ["a"]).shapes.every((f) => !f.grupo));
  const z = O.ordemDasFormas(s, ["a"], "topo");
  ok("ordem: topo põe no fim", z.shapes[2].id === "a");
  const z2 = O.ordemDasFormas(s, ["a", "b"], "frente");
  ok("ordem: avançar duas mantém a relativa", z2.shapes.map((f) => f.id).join() === "c,a,b", z2.shapes.map((f) => f.id).join());
  const d = O.duplicarFormas(g, ["a", "b"]);
  const novos = d.slide.shapes.filter((f) => d.novos.includes(f.id));
  ok("duplicar: ids novos e grupo novo (preserva a ligação entre as cópias)", novos.length === 2 && novos[0].id !== "a" && novos[0].grupo !== g.shapes[0].grupo && novos[0].grupo === novos[1].grupo);
  ok("espelhar liga o flip", O.espelharFormas(s, ["a"], "h").shapes[0].flipH === true);
  const bloq = O.moverFormas(slide([forma("x", 10, 10, 10, 10, { bloqueada: true })]), ["x"], 5, 5);
  ok("forma bloqueada não se move", bloq.shapes[0].box.x === 10);
}

// ---------------------------------------------------------------- texto
const run = (text, extra = {}) => ({ text, size: 18, bold: false, italic: false, underline: false, strike: false, color: "000000", font: "X", ...extra });
const para = (runs, extra = {}) => ({ runs, align: "esquerda", lvl: 0, marL: 0, indent: 0, spcBef: 0, spcAft: 0, endSize: 18, ...extra });
{
  const ps = [para([run("Olá mundo bonito")])];
  const n = T.estiloNoIntervalo(ps, 4, 9, { bold: true, color: "FF0000" });
  ok("estilo no trecho divide em 3 partes", n[0].runs.length === 3 && n[0].runs[1].text === "mundo" && n[0].runs[1].bold && n[0].runs[0].bold === false && n[0].runs[2].text === " bonito", JSON.stringify(n[0].runs.map((r) => [r.text, r.bold])));
  const todos = T.estiloNoIntervalo(ps, -1, -1, { size: 30 });
  ok("sem seleção vale para todo o texto", todos[0].runs.every((r) => r.size === 30) && todos[0].endSize === 30);
  const volta = T.estiloNoIntervalo(n, 4, 9, { bold: false, color: "000000" });
  ok("desfazer o estilo junta os trechos de novo", volta[0].runs.length === 1 && volta[0].runs[0].text === "Olá mundo bonito");
  const est = T.estadoDoTrecho(n, 4, 9);
  ok("estado do trecho: negrito ligado, cor vermelha", est.bold === true && est.color === "FF0000");
  ok("estado misto quando a seleção cruza estilos", T.estadoDoTrecho(n, 0, 12).bold === "misto");
  ok("próximo tamanho sobe pelos degraus", T.proximoTamanho(18, true) === 20 && T.proximoTamanho(18, false) === 16 && T.proximoTamanho(11, false) === 10.5);

  // digitar: preserva o estilo do vizinho
  const base = [para([run("Ab", { bold: true }), run("Cd", { color: "FF0000" })])];
  const dig = T.aplicarTextoDigitado(base, "AbXCd", { size: 18, bold: false, italic: false, underline: false, strike: false, color: "000000", font: "X" });
  ok("digitar no fim do trecho herda o estilo dele", dig[0].runs[0].text === "AbX" && dig[0].runs[0].bold === true && dig[0].runs[1].text === "Cd");
  const apagar = T.aplicarTextoDigitado(base, "Abd", { size: 18, bold: false, italic: false, underline: false, strike: false, color: "000000", font: "X" });
  ok("apagar um caractere mantém o resto", apagar[0].runs.map((r) => r.text).join("|") === "Ab|d" && apagar[0].runs[1].color === "FF0000", JSON.stringify(apagar[0].runs.map((r) => r.text)));
  const enter = T.aplicarTextoDigitado(base, "Ab\nCd", { size: 18, bold: false, italic: false, underline: false, strike: false, color: "000000", font: "X" });
  ok("Enter divide o parágrafo e mantém os estilos", enter.length === 2 && enter[0].runs[0].text === "Ab" && enter[1].runs[0].text === "Cd" && enter[1].runs[0].color === "FF0000");
  const junta = T.aplicarTextoDigitado(enter, "AbCd", { size: 18, bold: false, italic: false, underline: false, strike: false, color: "000000", font: "X" });
  ok("apagar a quebra junta os parágrafos", junta.length === 1 && junta[0].runs.length === 2);
  const vazio = T.aplicarTextoDigitado([para([])], "oi", { size: 24, bold: true, italic: false, underline: false, strike: false, color: "112233", font: "Y" });
  ok("digitar em parágrafo vazio usa o estilo de digitação", vazio[0].runs[0].text === "oi" && vazio[0].runs[0].size === 24 && vazio[0].runs[0].font === "Y");
  const marcador = T.alternarMarcador([para([run("a")]), para([run("b")])], [0, 1], "marcador");
  ok("marcadores ligam com recuo pendente", marcador[0].bullet?.char === "•" && marcador[0].indent < 0 && marcador[0].marL > 0);
  ok("marcadores desligam ao repetir", T.alternarMarcador(marcador, [0, 1], "marcador").every((p) => !p.bullet && p.marL === 0));
  const num = T.alternarMarcador([para([run("a")])], [0], "numeracao");
  ok("numeração", num[0].bullet?.auto === "arrowPlaceholder" || num[0].bullet?.auto === "arabicPeriod");
  const par = T.estiloDosParas([para([run("a")]), para([run("b")])], [1], { align: "centro", lnSpc: { pct: 1.5 } });
  ok("propriedades de parágrafo só nos índices dados", par[0].align === "esquerda" && par[1].align === "centro" && par[1].lnSpc.pct === 1.5);
  ok("parasDaSelecao: cursor no 2º parágrafo", T.parasDaSelecao([para([run("abc")]), para([run("de")])], 5, 5).join() === "1");

  // marca-texto, sobrescrito/subscrito, versalete e espaçamento de caracteres
  const marca = T.estiloNoIntervalo(ps, 4, 9, { highlight: "FFFF00", baseline: 30, caps: true, spc: 1.5 });
  ok(
    "formatação avançada divide o trecho e não vaza para os vizinhos",
    marca[0].runs.length === 3 && marca[0].runs[1].highlight === "FFFF00" && marca[0].runs[1].baseline === 30 && marca[0].runs[1].caps === true && marca[0].runs[1].spc === 1.5 && marca[0].runs[0].highlight === undefined,
    JSON.stringify(marca[0].runs.map((r) => [r.text, r.highlight]))
  );
  const estMarca = T.estadoDoTrecho(marca, 4, 9);
  ok("estado do trecho: marca-texto, sobrescrito, versalete e espaçamento", estMarca.highlight === "FFFF00" && estMarca.baseline === 30 && estMarca.caps === true && estMarca.spc === 1.5);
  ok("estado misto do marca-texto quando só parte do trecho tem", T.estadoDoTrecho(marca, 0, 12).highlight === "misto");
  const voltaMarca = T.estiloNoIntervalo(marca, 4, 9, { highlight: "", baseline: 0, caps: false, spc: 0 });
  ok("tirar a formatação avançada junta os trechos de novo", voltaMarca[0].runs.length === 1 && voltaMarca[0].runs[0].text === "Olá mundo bonito");

  // mudar caixa
  ok("MAIÚSCULAS com acentos certos", T.mudarCaixaTexto([para([run("informação jurídica")])], -1, -1, "maiusculas")[0].runs[0].text === "INFORMAÇÃO JURÍDICA");
  ok("minúsculas com acentos certos", T.mudarCaixaTexto([para([run("SÃO PAULO")])], -1, -1, "minusculas")[0].runs[0].text === "são paulo");
  const titulo = T.mudarCaixaTexto([para([run("olá mundo (teste)")])], -1, -1, "primeira");
  ok("Primeira Letra põe maiúscula em cada palavra", titulo[0].runs[0].text === "Olá Mundo (Teste)", titulo[0].runs[0].text);
  const soTrecho = T.mudarCaixaTexto([para([run("um dois três")])], 3, 7, "maiusculas");
  ok("mudar caixa só no trecho selecionado", soTrecho[0].runs.map((r) => r.text).join("") === "um DOIS três", JSON.stringify(soTrecho[0].runs.map((r) => r.text)));

  // limpar formatação
  const digitacao = { size: 18, bold: false, italic: false, underline: false, strike: false, color: "1C212B", font: "Segoe UI" };
  const sujo = [para([run("abc", { bold: true, color: "FF0000", size: 40, font: "Comic Sans MS", caps: true, spc: 3, baseline: -25, highlight: "00FF00" }), run("def", { color: "1C212B", font: "Segoe UI" })])];
  const limpo = T.limparEstiloNoIntervalo(sujo, 0, 3, digitacao);
  const l = limpo[0].runs[0];
  ok("limpar formatação volta ao estilo de digitação", l.bold === false && l.color === "1C212B" && l.size === 18 && l.font === "Segoe UI", JSON.stringify(l));
  ok("limpar formatação tira marca-texto, sobrescrito, versalete e espaçamento", l.highlight === undefined && l.baseline === undefined && l.caps === undefined && l.spc === undefined);
  ok("limpar formatação não mexe no resto do texto", limpo[0].runs.map((r) => r.text).join("") === "abcdef" && limpo[0].runs.length === 1);
}

// ---------------------------------------------------------------- estilos de cor no .pptx (o caso de ouro)
const E = await empacotar("src/powerpoint/edicao/estilos.ts", "estilos.mjs");
const RE = await empacotar("src/powerpoint/pptxexport/rica.ts", "rica-estilos.mjs");
{
  const setup = { aspect: "16:9", theme: "claro", showNumber: false, footer: "", fontFamily: "Segoe UI", fontSize: 18, bg: "" };
  const tema = { acento: "1F9D55" };
  const base = forma("a", 10, 12, 34, 12, { estilo: { familia: "esmeralda", intensidade: "media", brilho: "lustro", angulo: 45 } });
  const comEstilo = E.atualizarEstilos(slide([base]), dim, tema);
  const esq = E.esquemaDoEstilo(base.estilo, tema);
  const xml = new RE.Escritor(setup).lamina({ md: "", layout: "conteudo", notes: "", shapes: comEstilo.shapes }).xml;
  ok("pptx: o gradiente do estilo vai nativo (a cor no meio da rampa)", xml.includes("<a:gradFill") && xml.includes('<a:gs pos="45000"><a:srgbClr val="1F9D55"/>'));
  ok("pptx: o ângulo do estilo vira o `a:lin` do arquivo", xml.includes(`<a:lin ang="${45 * 60000}"`));
  ok("pptx: a parada do lustro leva o alfa (branco translúcido)", xml.includes('<a:srgbClr val="FFFFFF"><a:alpha val="24000"/></a:srgbClr>'));
  ok("pptx: o contorno sai no tom profundo da rampa", xml.includes(`<a:ln w="${Math.round(0.75 * 12700)}"`) && xml.includes(`<a:srgbClr val="${esq.escuro}"><a:alpha val="55000"/>`));
  ok("pptx: a sombra leve vai no efeito (outerShdw)", xml.includes("<a:outerShdw") && xml.includes(`blurRad="${Math.round(12 * 12700)}"`));

  // a dobra vira duas formas vizinhas no mesmo grupo (é o que o PowerPoint abre como um grupo)
  const comDobra = E.atualizarEstilos(slide([{ ...base, estilo: { ...base.estilo, brilho: "dobra" } }]), dim, tema);
  const xmlDobra = new RE.Escritor(setup).lamina({ md: "", layout: "conteudo", notes: "", shapes: comDobra.shapes }).xml;
  ok("pptx: a dobra sai como grupo (base + capa no mesmo grpSp)", xmlDobra.includes("<p:grpSp>") && (xmlDobra.match(/<p:sp>/g) ?? []).length === 2);
  ok("pptx: a capa do brilho é um caminho livre translúcido", xmlDobra.includes("<a:custGeom") && /<a:alpha val="16000"\/>/.test(xmlDobra));
}

// ---------------------------------------------------------------- marca-texto no .pptx (escrita e leitura)
const R = await empacotar("src/powerpoint/pptxexport/rica.ts", "rica.mjs");
const TI = await empacotar("src/powerpoint/pptximport/texto.ts", "imptexto.mjs");
{
  const setup = { aspect: "16:9", theme: "claro", showNumber: false, footer: "", fontFamily: "Segoe UI", fontSize: 18, bg: "" };
  const caixa = {
    id: "f1",
    kind: "texto",
    box: { x: 5, y: 5, w: 40, h: 20 },
    text: "Oi",
    fontFamily: "Segoe UI",
    fontSize: 18,
    color: "000000",
    bold: false,
    italic: false,
    align: "esquerda",
    fill: "",
    src: "",
    rot: 0,
    geom: "rect",
    paras: [para([run("Oi", { highlight: "FFFF00", baseline: 30, caps: true, spc: 2 })])],
  };
  const xml = new R.Escritor(setup).lamina({ md: "", layout: "conteudo", notes: "", shapes: [caixa] }).xml;
  ok("exporta o marca-texto no trecho", xml.includes('<a:highlight><a:srgbClr val="FFFF00"/></a:highlight>'));
  ok("marca-texto sai antes das fontes (ordem que o OOXML exige)", xml.indexOf("<a:highlight>") < xml.indexOf("<a:latin"));
  ok("o resto da formatação avançada continua saindo", xml.includes('baseline="30000"') && xml.includes('cap="all"') && xml.includes('spc="200"'));

  const ctx = { tema: { cores: { dk1: "000000", lt1: "FFFFFF", accent1: "4F46E5" }, fonteMaior: "Calibri Light", fonteMenor: "Calibri", preenchimentos: [], contornos: [], efeitos: [], fundos: [] }, mapa: { bg1: "lt1", tx1: "dk1" } };
  const comMarca = { n: "rPr", a: {}, c: [{ n: "highlight", a: {}, c: [{ n: "srgbClr", a: { val: "00B050" }, c: [], t: "" }], t: "" }], t: "" };
  ok("importa a cor do marca-texto", TI.lerRProps(comMarca, ctx).highlight?.hex === "00B050");
  ok("run sem <a:highlight> não ganha marca-texto", TI.lerRProps({ n: "rPr", a: {}, c: [], t: "" }, ctx).highlight === undefined);
}

// ---------------------------------------------------------------- formato
{
  const s = forma("a", 0, 0, 10, 10);
  const comFill = F.comPreenchimento(s, F.solido("#0ba050"));
  ok("preenchimento sólido mantém o campo antigo", comFill.fillX.color === "0BA050" && comFill.fill === "0BA050");
  const grad = F.gradiente("FFFFFF", "000000", 90);
  ok("gradiente tem 2 paradas", grad.stops.length === 2 && grad.angle === 90);
  ok("ajustar cor escurece e clareia", F.ajustarCor("808080", 0.5) === "404040" && F.ajustarCor("808080", 1.5) === "C0C0C0");
  const ln = F.comLinha(s, { w: 3, color: "FF0000" });
  ok("linha nova pega os padrões", ln.ln.w === 3 && ln.ln.dash === "solid" && F.comLinha(ln, null).ln === undefined);
  ok("sombra liga com padrão e desliga", F.comSombra(s, {}).shadow.blur === 8 && F.comSombra(F.comSombra(s, {}), null).shadow === undefined);
  const rr = F.comRaioDeCanto(forma("r", 0, 0, 10, 10, { geom: "roundRect" }), 25);
  ok("raio de canto: 25% do menor lado = adj 25000", rr.adj.adj === 25000 && perto(F.raioDeCanto(rr), 25));
  ok("forma sem canto ignora o raio", F.comRaioDeCanto(s, 25) === s);

  // remover um campo (Sem sombra, Sem contorno, opacidade 100%…) precisa sobreviver ao
  // patchFormas, que espalha o resultado por cima da forma original: chave apagada continuaria viva
  const cheia = {
    ...s,
    shadow: { color: "000000", alpha: 0.3, blur: 8, dist: 4, dir: 90 },
    ln: { color: "000000", alpha: 1, w: 1, dash: "solid" },
    fillX: { kind: "solid", color: "FF0000" },
    opacity: 0.5,
  };
  const slide = { md: "", layout: "conteudo", notes: "", shapes: [cheia] };
  const semSombra = O.patchFormas(slide, ["a"], (f) => F.comSombra(f, null)).shapes[0];
  ok("patchFormas: Sem sombra tira a sombra", !semSombra.shadow, JSON.stringify(semSombra.shadow ?? null));
  const semLinha = O.patchFormas(slide, ["a"], (f) => F.comLinha(f, null)).shapes[0];
  ok("patchFormas: Sem contorno tira o contorno", !semLinha.ln, JSON.stringify(semLinha.ln ?? null));
  const semFill = O.patchFormas(slide, ["a"], (f) => F.comPreenchimento(f, undefined)).shapes[0];
  ok("patchFormas: sem preenchimento limpa o fillX", !semFill.fillX && semFill.fill === "", JSON.stringify(semFill.fillX ?? null));
  const opaco = O.patchFormas(slide, ["a"], (f) => F.comOpacidade(f, 1)).shapes[0];
  ok("patchFormas: opacidade 100% limpa o opacity", opaco.opacity === undefined, String(opaco.opacity));
  const comCantos = O.patchFormas({ ...slide, shapes: [{ ...cheia, adj: { adj: 50000 } }] }, ["a"], (f) => F.comCantos(f, ["tl", "tr", "br", "bl"], 20)).shapes[0];
  ok("patchFormas: cantos limpam o ajuste antigo (adj)", comCantos.adj === undefined, JSON.stringify(comCantos.adj ?? null));
}

// ---------------------------------------------------------------- cantos por canto
{
  const setup2 = { aspect: "16:9", theme: "claro", showNumber: false, footer: "", fontFamily: "Segoe UI", fontSize: 18, bg: "" };
  const redondo = () => forma("c1", 10, 10, 30, 20, { geom: "roundRect", adj: { adj: 16667 } });
  ok("cantos: roundRect vira 16,67 nos quatro", JSON.stringify(F.cantosDe(redondo()).map((v) => Math.round(v * 100) / 100)) === JSON.stringify([16.67, 16.67, 16.67, 16.67]));
  const soTl = F.comCantos(redondo(), ["tl"], 30);
  ok("cantos: muda só os escolhidos", JSON.stringify(soTl.cantos) === JSON.stringify([30, 16.667, 16.667, 16.667]) && soTl.geom === "roundRect" && soTl.adj === undefined, JSON.stringify(soTl.cantos));
  const dois = F.comCantos(redondo(), ["tl", "br"], 0);
  ok("cantos: zera só os escolhidos", JSON.stringify(dois.cantos) === JSON.stringify([0, 16.667, 0, 16.667]));
  ok("cantos: iguala formas com bases diferentes", JSON.stringify(F.valoresComSelecao([10, 0, 5, 2], ["tl", "br"], 30)) === JSON.stringify([30, 0, 30, 2]));
  ok("cantos: canto cortado (snip) não entra no raio por canto", F.cantosDe(forma("s", 0, 0, 10, 10, { geom: "snip1Rect" })) === null);
  ok("representação: 4 iguais = roundRect", F.representacaoDeCantos([20, 20, 20, 20]) === "roundRect");
  ok("representação: zeros = rect", F.representacaoDeCantos([0, 0, 0, 0]) === "rect");
  ok("representação: só sup. direito = round1Rect", F.representacaoDeCantos([0, 20, 0, 0]) === "round1Rect");
  ok("representação: par de cima = round2SameRect", F.representacaoDeCantos([20, 20, 0, 0]) === "round2SameRect");
  ok("representação: diagonal = round2DiagRect", F.representacaoDeCantos([20, 0, 20, 0]) === "round2DiagRect");
  ok("representação: 3+1 = forma livre", F.representacaoDeCantos([20, 20, 20, 0]) === "livre");
  ok("adj do canto: 16,6667% = 16667", F.adjDeCanto(16.6667) === 16667);

  const xmlDe = (f) => new R.Escritor(setup2).lamina({ md: "", layout: "conteudo", notes: "", shapes: [f] }).xml;
  ok("arquivo: quatro iguais viram roundRect nativo", xmlDe({ ...redondo(), cantos: [20, 20, 20, 20] }).includes('<a:prstGeom prst="roundRect"'));
  ok("arquivo: par de cima vira round2SameRect nativo", xmlDe({ ...redondo(), cantos: [20, 20, 0, 0] }).includes('<a:prstGeom prst="round2SameRect"'));
  const livreXml = xmlDe({ ...redondo(), cantos: [20, 20, 20, 0] });
  ok("arquivo: 3+1 vira forma livre (custGeom com curvas)", livreXml.includes("<a:custGeom") && livreXml.includes("<a:cubicBezTo"));
  ok("arquivo: o raio por canto manda (adj antigo é ignorado)", !xmlDe({ ...redondo(), cantos: [20, 20, 20, 20], adj: { adj: 40000 } }).includes("40000"));
  ok("arquivo: tudo zero vira retângulo", xmlDe({ ...redondo(), cantos: [0, 0, 0, 0] }).includes('<a:prstGeom prst="rect"'));
}

// ---------------------------------------------------------------- tabelas
{
  const TB = await empacotar("src/powerpoint/edicao/tabela.ts", "tabela.mjs");
  const est = { size: 16, bold: false, italic: false, underline: false, strike: false, color: "000000", font: "Arial" };
  const t = TB.criarTabela(3, 3, 300, 90, est, "2563EB");
  ok("tabela 3x3 com tamanho certo", t.linhas.length === 3 && t.colunas.length === 3 && perto(TB.tamanhoTotal(t).w, 300) && perto(TB.tamanhoTotal(t).h, 90, 60));
  ok("estilo cabeçalho colorido pinta a 1ª linha", t.celulas[0][0].fill?.color === "2563EB" && t.celulas[1][0].fill);
  const l = TB.inserirLinha(t, 1);
  ok("inserir linha", l.linhas.length === 4 && l.celulas.length === 4 && l.celulas[1].length === 3);
  const c = TB.inserirColuna(t, 3);
  ok("inserir coluna no fim", c.colunas.length === 4 && c.celulas.every((x) => x.length === 4));
  ok("excluir linha/coluna", TB.excluirLinha(t, 0).linhas.length === 2 && TB.excluirColuna(t, 0).colunas.length === 2);
  ok("não exclui a última linha", TB.excluirLinha(TB.excluirLinha(TB.excluirLinha(t, 0), 0), 0).linhas.length === 1);
  const m = TB.mesclar(t, { r0: 0, c0: 0, r1: 1, c1: 1 });
  ok("mesclar 2x2", m.celulas[0][0].colspan === 2 && m.celulas[0][0].rowspan === 2 && m.celulas[1][1].coberta && !m.celulas[2][2].coberta);
  ok("dono de célula coberta", TB.donaDe(m, 1, 1).r === 0 && TB.donaDe(m, 1, 1).c === 0);
  const ml = TB.inserirLinha(m, 1);
  ok("inserir linha dentro da mesclagem a estica", ml.celulas[0][0].rowspan === 3 && ml.celulas[1][0].coberta);
  const me = TB.excluirLinha(m, 1);
  ok("excluir linha dentro da mesclagem a encolhe", me.celulas[0][0].rowspan === undefined && me.linhas.length === 2);
  const d = TB.dividir(m, 0, 0);
  ok("dividir desfaz a mesclagem", d.celulas[0][0].colspan === undefined && !d.celulas[1][1].coberta);
  const b = TB.bordasCelulas(t, { r0: 0, c0: 0, r1: 0, c1: 0 }, "todas", { color: "FF0000", alpha: 1, w: 2, dash: "solid" });
  ok("borda vale dos dois lados da divisa", b.celulas[0][0].bordas.r.color === "FF0000" && b.celulas[0][1].bordas.l.color === "FF0000");
  const aj = TB.ajustarAoTamanho(t, 600, 180);
  ok("ajustar ao tamanho escala colunas e linhas", perto(TB.tamanhoTotal(aj).w, 600) && perto(TB.tamanhoTotal(aj).h, 180));
}

// ---------------------------------------------------------------- histórico (desfazer/refazer)
const H = await empacotar("src/powerpoint/edicao/historico.ts", "historico.mjs");
{
  const h = new H.Historico(10);
  const s = (n) => ({ n });
  ok("histórico vazio não desfaz nem refaz", h.desfazer(s(0)) === null && h.refazer(s(0)) === null && !h.podeDesfazer);
  h.registrar(s(0));
  ok("registrar habilita o desfazer", h.podeDesfazer);
  const volta = h.desfazer(s(1));
  ok("desfazer devolve o estado anterior", volta?.n === 0);
  ok("depois de desfazer, dá para refazer", h.podeRefazer && !h.podeDesfazer);
  ok("refazer devolve o estado que estava na tela", h.refazer(s(0))?.n === 1);
  // mesma chave dentro de ~1 s vira um passo só (digitação seguida)
  const h2 = new H.Historico(10);
  h2.registrar(s(0), "digitar:a");
  h2.registrar(s(1), "digitar:a");
  h2.registrar(s(2), "digitar:a");
  ok("digitação seguida na mesma caixa vira um passo só", h2.desfazer(s(3))?.n === 0 && !h2.podeDesfazer);
  // chaves diferentes viram passos separados
  const h3 = new H.Historico(10);
  h3.registrar(s(0), "digitar:a");
  h3.registrar(s(1), "mover:a");
  ok("ações diferentes viram passos separados", h3.desfazer(s(2))?.n === 1 && h3.desfazer(s(1))?.n === 0);
  // uma edição nova apaga o futuro (não dá para refazer por cima)
  const h4 = new H.Historico(10);
  h4.registrar(s(0));
  h4.desfazer(s(1));
  h4.registrar(s(0));
  ok("edição nova depois de desfazer limpa o refazer", !h4.podeRefazer);
}

// ---------------------------------------------------------------- modelos (botão Template)
const M = await empacotar("src/powerpoint/edicao/modelos.ts", "modelos.mjs");
// as decorações do desenho do modelo (formas fixas "tpl:") entram antes do texto: os testes de cor, fonte e
// acabamento olham as formas do deck, então o desenho sai daqui (ele tem o teste próprio, testar-modelos.mjs)
const aplicar = (...a) => M.aplicarModelo(...a).map((s) => ({ ...s, shapes: s.shapes.filter((f) => !f.name?.startsWith("tpl:")) }));
{
  const ids = M.MODELOS.map((m) => m.id);
  ok("modelos: ids únicos e campos preenchidos", new Set(ids).size === ids.length && M.MODELOS.every((m) => m.nome && m.descricao && m.fonte && m.tema));
  const mk = (shapes, bg) => ({ md: "", layout: "conteudo", notes: "", shapes, bg });
  const run = (color, font) => ({ text: "Oi", size: 18, bold: false, italic: false, underline: false, strike: false, color, font });
  const para = (r) => ({ runs: [r], align: "esquerda", lvl: 0, marL: 0, indent: 0, spcBef: 0, spcAft: 0, endSize: 18 });
  const caixa = (extra = {}) => ({ id: "t", kind: "texto", box: { x: 8, y: 10, w: 80, h: 20 }, text: "Oi", fontFamily: "Segoe UI", fontSize: 18, color: "1C212B", bold: false, italic: false, align: "esquerda", fill: "", src: "", rot: 0, ...extra });
  const base = [
    mk([caixa({ paras: [para(run("1C212B", "Segoe UI"))] })], { kind: "solid", color: "FFFFFF" }),
    mk([caixa({ id: "f", kind: "forma", color: "FFFFFF", fill: "4F46E5", fillX: { kind: "solid", color: "4F46E5" }, ln: { color: "4F46E5", alpha: 1, w: 1, dash: "solid" } })]),
    mk([caixa({ id: "c", fontFamily: "Consolas", color: "FF0000", text: "X" })]),
  ];
  const de = { theme: "claro", bg: "", fontFamily: "Segoe UI" };
  const noite = M.MODELOS.find((m) => m.id === "meia-noite");
  const r = aplicar(base, de, noite);
  const rT = r[0].shapes[0];
  const rF = r[1].shapes[0];
  const rC = r[2].shapes[0];
  ok("modelo troca a cor do texto e a fonte", rT.color === "F4F5F8" && rT.paras[0].runs[0].color === "F4F5F8" && rT.paras[0].runs[0].font === "Inter" && rT.fontFamily === "Inter");
  ok("modelo troca o acento no preenchimento e no contorno", rF.fill === "818CF8" && rF.fillX.color === "818CF8" && rF.ln.color === "818CF8");
  ok("texto branco da forma de acento continua branco", rF.color === "FFFFFF");
  ok("modelo troca o fundo da lâmina", r[0].bg.color === "151B26");
  ok("cor e fonte próprias ficam como estão", rC.color === "FF0000" && rC.fontFamily === "Consolas");
  ok("aplicar não mexe nas lâminas originais", base[0].shapes[0].color === "1C212B" && base[0].bg.color === "FFFFFF");
  const duas = aplicar(r, { theme: "escuro", bg: "151B26", fontFamily: "Inter" }, noite);
  ok("aplicar o mesmo modelo de novo não muda nada", JSON.stringify(duas) === JSON.stringify(r));
  const cont = M.MODELOS.find((m) => m.id === "contraste");
  const rc = aplicar(base, de, cont);
  ok("contraste recalculado no texto da forma de acento", rc[1].shapes[0].color === "1C212B" && rc[1].shapes[0].fillX.color === "FFD400");
  const cl = M.MODELOS.find((m) => m.id === "classico");
  const basePapel = [mk([caixa({ fontFamily: "Georgia", paras: [para(run("1C212B", "Georgia"))] })], { kind: "solid", color: "F7F3EA" })];
  const rp = aplicar(basePapel, { theme: "claro", bg: "F7F3EA", fontFamily: "Georgia" }, cl);
  ok("fundo e fonte personalizados voltam ao padrão do modelo", rp[0].bg.color === "FFFFFF" && rp[0].shapes[0].fontFamily === "Segoe UI");
  const cel = (color) => ({ paras: [para(run(color, "Segoe UI"))], fill: { kind: "solid", color: "4F46E5" } });
  const tab = [mk([caixa({ id: "tb", tabela: { colunas: [50], linhas: [20], celulas: [[cel("1C212B")]] } })])];
  const rt = aplicar(tab, de, noite);
  ok("tabela: texto e preenchimento das células trocam junto", rt[0].shapes[0].tabela.celulas[0][0].paras[0].runs[0].color === "F4F5F8" && rt[0].shapes[0].tabela.celulas[0][0].fill.color === "818CF8");

  // Estilos de Cor nos modelos (R5): a receita viaja no FUNDO das lâminas e o estilo vivo segue o
  // acento novo — é o que faz o deck inteiro acompanhar o modelo
  // o catálogo do app não traz mais os três modelos de fundo em gradiente (saíam ilegíveis), mas o
  // MODELO COM ESTILO continua valendo: é o formato dos modelos guardados pelo usuário
  ok("modelos: o catálogo do app não tem fundo em gradiente", M.MODELOS.every((m) => !m.estilo));
  const esmeralda = { id: "esmeralda", nome: "Esmeralda", descricao: "", tema: "escuro", bg: "0B3A2B", fonte: "Inter", cores: { fg: "FFFFFF", accent: "2FBF71", muted: "9FD9BC" }, estilo: { familia: "esmeralda", intensidade: "media", brilho: "lustro" }, usuario: true };
  const rEst = aplicar(base, de, esmeralda);
  ok("modelo com estilo: o fundo das lâminas ganha a receita (sem cor própria)", rEst.every((s) => s.bgEstilo?.familia === "esmeralda" && s.bgEstilo.base === ""));
  const rSem = aplicar(rEst, { theme: "escuro", bg: "0B3A2B", fontFamily: "Inter" }, noite);
  ok("modelo sem estilo: o fundo volta ao do modelo (a receita do fundo sai)", rSem.every((s) => !s.bgEstilo));
  const C = await empacotar("src/powerpoint/edicao/criar.ts", "criar.mjs");
  const formaDoTema = caixa({ id: "s", kind: "forma", estilo: { familia: "propria", intensidade: "media", brilho: "nada" }, fillX: { kind: "solid", color: "4F46E5" } });
  const slidesEst = aplicar([mk([formaDoTema], { kind: "solid", color: "FFFFFF" })], de, esmeralda);
  const setupNovo = { aspect: "16:9", theme: esmeralda.tema, showNumber: false, footer: "", fontFamily: esmeralda.fonte, fontSize: 18, bg: esmeralda.bg };
  const estNovo = C.estiloDoDeck(slidesEst, setupNovo);
  const derivado = E.atualizarEstilos(slidesEst[0], dim, estNovo).shapes[0];
  ok(
    "modelo com estilo: a forma de cor do tema re-deriva no acento novo",
    derivado.fillX.kind === "gradient" && derivado.fillX.stops.some((p) => p.color === estNovo.acento),
    `${estNovo.acento}`
  );
  const salvo = M.modeloDoDeck(rEst, setupNovo, "Meu estilo", "u1");
  ok("modelo do usuário guarda o estilo do fundo do deck", salvo.estilo?.familia === "esmeralda" && salvo.estilo.intensidade === "media");
  ok("modelo do usuário sem estilo no fundo não inventa um", !M.modeloDoDeck(base, de, "Sem estilo", "u2").estilo);
}

// ideias de design: o tratamento alcança as cores próprias das formas e o acabamento
{
  const mk = (shapes, bg) => ({ md: "", layout: "conteudo", notes: "", shapes, bg });
  const run = (color, font) => ({ text: "Oi", size: 18, bold: false, italic: false, underline: false, strike: false, color, font });
  const para = (r) => ({ runs: [r], align: "esquerda", lvl: 0, marL: 0, indent: 0, spcBef: 0, spcAft: 0, endSize: 18 });
  const caixa = (extra = {}) => ({ id: "t", kind: "texto", box: { x: 8, y: 10, w: 80, h: 20 }, text: "Oi", fontFamily: "Segoe UI", fontSize: 18, color: "1C212B", bold: false, italic: false, align: "esquerda", fill: "", src: "", rot: 0, ...extra });
  // deck importado: quadros com um verde próprio (fora de qualquer paleta) e texto branco
  const verde = (id) => caixa({ id, kind: "forma", geom: "rect", color: "FFFFFF", fill: "2EA36F", fillX: { kind: "solid", color: "2EA36F" }, paras: [para(run("FFFFFF", "Segoe UI"))] });
  const destino = { fg: "13293D", bg: "E8F1F2", accent: "1B98E0", muted: "247BA0" };
  ok(
    "ideias: o papel da superfície leva a marca para o acento, o escuro para o fundo escuro e o claro para a tinta do acento",
    M.papelDaCor("2EA36F", destino) === "1B98E0" && M.papelDaCor("0F2738", destino) === "13293D" && M.papelDaCor("E8F7EE", destino) === "CBE5EF" && M.papelDaCor("64748B", destino) === "13293D"
  );
  ok(
    "ideias: o papel do texto mantém o escuro escuro e o claro claro (para não sumir sobre imagem)",
    M.papelDoTexto("0F2738", destino) === "13293D" && M.papelDoTexto("FFFFFF", destino) === "E8F1F2" && M.papelDoTexto("2EA36F", destino) === "1B98E0"
  );
  ok(
    "ideias: o contraste vira o texto para o extremo que contrasta com a superfície",
    M.contrasteCom("FFFFFF", "1B98E0", destino) === "13293D" && M.contrasteCom("FFFFFF", "13293D", destino) === "FFFFFF" && M.contrasteDeCores("FFFFFF", "13293D") >= 4.5
  );
  const deck = [
    mk([verde("a"), verde("b"), caixa({ id: "c", color: "2EA36F", paras: [para(run("2EA36F", "Segoe UI"))] })], { kind: "solid", color: "FFFFFF" }),
    mk(
      [
        caixa({ id: "d", kind: "forma", fill: "4F46E5", fillX: { kind: "solid", color: "4F46E5" } }),
        caixa({ id: "e", kind: "forma", fill: "0F2738", fillX: { kind: "solid", color: "0F2738" } }),
        caixa({ id: "f", kind: "forma", fill: "E8F7EE", fillX: { kind: "solid", color: "E8F7EE" } }),
        caixa({ id: "g", color: "64748B", paras: [para(run("64748B", "Segoe UI"))] }),
      ],
      { kind: "solid", color: "FFFFFF" }
    ),
  ];
  const de = { theme: "claro", bg: "", fontFamily: "Segoe UI" };
  const ocean = M.MODELOS.find((m) => m.id === "ocean");
  const semTrat = aplicar(deck, de, ocean);
  ok("ideias: sem tratamento o verde próprio fica como está (o comportamento antigo)", semTrat[0].shapes[0].fillX.color === "2EA36F" && semTrat[0].shapes[0].geom === "rect");
  const rec = aplicar(deck, de, ocean, "recolorir");
  ok(
    "ideias: recolorir leva as cores próprias para a paleta (marca → acento, escuro → fundo escuro, claro → tinta)",
    rec[0].shapes[0].fill === "1B98E0" && rec[0].shapes[0].fillX.color === "1B98E0" && rec[1].shapes[0].fillX.color === "1B98E0" && rec[1].shapes[1].fillX.color === "13293D" && rec[1].shapes[2].fillX.color === "CBE5EF" && rec[0].bg.color === "E8F1F2"
  );
  const pares = [];
  for (const sl of rec)
    for (const s of sl.shapes) {
      const sup = s.fillX?.kind === "solid" ? s.fillX.color : s.fill;
      if (!sup) continue;
      for (const p of s.paras ?? []) for (const r of p.runs) pares.push([r.color, sup]);
    }
  ok(
    "ideias: todo texto de forma pintada fica com o contraste mínimo (WCAG 4,5:1)",
    pares.length >= 2 && pares.every(([t, sup]) => M.contrasteDeCores(t, sup) >= 4.5),
    pares.map(([t, sup]) => `${t}/${sup}`).join(" ")
  );
  const escuro = M.MODELOS.find((m) => m.id === "escuro");
  const cartao = [mk([caixa({ id: "card", kind: "forma", fill: "FFFFFF", fillX: { kind: "solid", color: "FFFFFF" }, paras: [para(run("0F2738", "Segoe UI"))] })], { kind: "solid", color: "FFFFFF" })];
  const comEscuro = aplicar(cartao, de, escuro, "recolorir");
  const card = comEscuro[0].shapes[0];
  ok(
    "ideias: num design escuro o cartão branco escurece e o texto continua legível (o defeito do print)",
    card.fillX.color !== "FFFFFF" && card.paras[0].runs[0].color !== "0F2738" && M.contrasteDeCores(card.paras[0].runs[0].color, card.fillX.color) >= 4.5
  );
  // texto solto em cima de um cartão que é imagem: a cor de trás é desconhecida, então o texto
  // não troca de lado — era o defeito do print (cartão branco de imagem + texto claro em cima)
  const comImagem = [mk([caixa({ id: "card", kind: "imagem", src: "m1", box: { x: 0, y: 0, w: 100, h: 60 } }), caixa({ id: "txt", box: { x: 10, y: 10, w: 60, h: 20 }, color: "0F2738", paras: [para(run("0F2738", "Segoe UI"))] })], { kind: "solid", color: "FFFFFF" })];
  const sobreImagem = aplicar(comImagem, de, escuro, "recolorir")[0].shapes[1];
  ok(
    "ideias: texto solto sobre imagem não troca de lado (o escuro continua escuro e legível)",
    sobreImagem.paras[0].runs[0].color !== "F4F5F8" && M.contrasteDeCores(sobreImagem.paras[0].runs[0].color, "FFFFFF") >= 4.5
  );
  const cantos = aplicar(deck, de, ocean, "cantos");  ok("ideias: cantos arredondados nos quadros pintados (raio 12% no adj) e recoloridos junto", cantos[0].shapes[0].geom === "roundRect" && cantos[0].shapes[0].adj.adj === 12000 && cantos[0].shapes[1].geom === "roundRect" && cantos[0].shapes[0].fillX.color === "1B98E0" && cantos[0].shapes[2].geom === undefined);
  const cont = aplicar(deck, de, ocean, "contorno");
  ok("ideias: contorno de acento nas formas pintadas (1,25 pt no mínimo)", cont[0].shapes[0].ln.color === "1B98E0" && cont[0].shapes[0].ln.w === 1.25 && cont[0].shapes[2].ln === undefined);
  ok("ideias: aplicar não mexe nas lâminas originais", deck[0].shapes[0].fillX.color === "2EA36F" && deck[0].shapes[0].geom === "rect");
}

// arranjos: reorganizar a lâmina em fórmulas padrão (grade, lista, destaque, faixa)
const A = await empacotar("src/powerpoint/edicao/arranjos.ts", "arranjos.mjs");
{
  const run = (text) => ({ text, size: 18, bold: false, italic: false, underline: false, strike: false, color: "1C212B", font: "Segoe UI" });
  const para = (text) => ({ runs: [run(text)], align: "esquerda", lvl: 0, marL: 0, indent: 0, spcBef: 0, spcAft: 0, endSize: 18 });
  const caixa = (id, x, y, w, h, extra = {}) => ({ id, kind: "forma", box: { x, y, w, h }, text: "", fontFamily: "Segoe UI", fontSize: 18, color: "1C212B", bold: false, italic: false, align: "esquerda", fill: "E5E7EB", src: "", rot: 0, ...extra });
  const texto = (id, x, y, w, h, txt, extra = {}) => caixa(id, x, y, w, h, { kind: "texto", fill: "", paras: [para(txt)], ...extra });
  const ratio = 16 / 9;
  const lamina = {
    md: "",
    layout: "conteudo",
    notes: "",
    bg: { kind: "solid", color: "FFFFFF" },
    shapes: [
      caixa("fixa1", 70, 2, 25, 30, { fixa: true }),
      texto("titulo", 6, 6, 50, 10, "CONHEÇA A EQUIPE"),
      caixa("c1", 10, 30, 20, 12),
      texto("t1", 12, 32, 16, 8, "Ana"),
      caixa("c2", 40, 30, 20, 12),
      texto("t2", 42, 32, 16, 8, "Bruno"),
      caixa("c3", 10, 50, 20, 12),
      texto("t3", 12, 52, 16, 8, "Diego"),
      caixa("c4", 40, 50, 20, 12),
      texto("t4", 42, 52, 16, 8, "Miguel"),
      caixa("lig", 10, 42, 50, 2, { liga: { de: "c1", para: "c3", grupo: "g" } }),
    ],
  };
  const u = A.unidadesDa(lamina);
  ok("arranjos: acha as unidades (o cartão e o que está dentro dele)", u.length === 4 && u[0].ids.length === 2 && u[0].ids[0] === "c1" && u[0].ids[1] === "t1");
  ok("arranjos: ordem de leitura (cima para baixo, esquerda para a direita)", JSON.stringify(u.map((x) => x.ids[0])) === JSON.stringify(["c1", "c2", "c3", "c4"]));
  const grade = A.aplicarArranjo(lamina, "grade", 2, ratio);
  const c = (id) => grade.shapes.find((s) => s.id === id);
  const dentro = (fora, d) => {
    const cx = d.box.x + d.box.w / 2;
    const cy = d.box.y + d.box.h / 2;
    return cx >= fora.box.x && cx <= fora.box.x + fora.box.w && cy >= fora.box.y && cy <= fora.box.y + fora.box.h;
  };
  const cruza = (a, b) => a.box.x < b.box.x + b.box.w && b.box.x < a.box.x + a.box.w && a.box.y < b.box.y + b.box.h && b.box.y < a.box.y + a.box.h;
  ok(
    "arranjos: a grade dá o MESMO tamanho a todos os cartões",
    c("c1").box.w === c("c2").box.w && c("c1").box.h === c("c2").box.h && c("c3").box.w === c("c1").box.w && c("c4").box.h === c("c1").box.h
  );
  ok("arranjos: o texto anda junto com o cartão", dentro(c("c1"), c("t1")) && dentro(c("c4"), c("t4")));
  ok(
    "arranjos: o texto escala na mesma proporção do cartão",
    Math.abs(c("t1").paras[0].runs[0].size / 18 - c("c1").box.w / 20) < 0.01 && c("t1").paras[0].runs[0].size > 18
  );
  ok("arranjos: os cartões não se sobrepõem", !cruza(c("c1"), c("c2")) && !cruza(c("c1"), c("c3")) && !cruza(c("c3"), c("c4")));
  ok("arranjos: nada sai da lâmina", grade.shapes.every((s) => s.box.x >= 0 && s.box.y >= 0 && s.box.x + s.box.w <= 100 && s.box.y + s.box.h <= 100));
  ok("arranjos: os conectores saem (a vizinhança dos cartões mudou)", !grade.shapes.some((s) => s.liga));
  ok("arranjos: as formas fixas do modelo não se movem", JSON.stringify(c("fixa1").box) === JSON.stringify({ x: 70, y: 2, w: 25, h: 30 }));
  ok("arranjos: o título do topo fica onde está", JSON.stringify(c("titulo").box) === JSON.stringify({ x: 6, y: 6, w: 50, h: 10 }));
  ok("arranjos: aplicar não mexe na lâmina original", lamina.shapes.find((s) => s.id === "c1").box.x === 10);
  const lista = A.aplicarArranjo(lamina, "lista", 0, ratio);
  const l = (id) => lista.shapes.find((s) => s.id === id);
  ok("arranjos: a lista empilha tudo numa coluna", l("c1").box.x === l("c2").box.x && l("c2").box.x === l("c3").box.x && l("c1").box.y < l("c2").box.y && l("c2").box.y < l("c3").box.y);
  const faixa = A.aplicarArranjo(lamina, "faixa", 0, ratio);
  const f = (id) => faixa.shapes.find((s) => s.id === id);
  ok("arranjos: a faixa põe tudo numa linha", f("c1").box.y === f("c2").box.y && f("c2").box.y === f("c4").box.y && f("c1").box.x < f("c2").box.x && f("c2").box.x < f("c3").box.x);
  const destaque = A.aplicarArranjo(lamina, "destaque", 0, ratio);
  const d = (id) => destaque.shapes.find((s) => s.id === id);
  ok("arranjos: o destaque dá o primeiro espaço grande e o resto na coluna ao lado", d("c1").box.w > d("c2").box.w && d("c1").box.x < d("c2").box.x && d("c2").box.x === d("c3").box.x);
  ok(
    "arranjos: as variantes da grade respeitam a quantidade de cartões",
    JSON.stringify(A.variantesDe("grade", 4)) === JSON.stringify([2, 3, 4]) && JSON.stringify(A.variantesDe("grade", 2)) === JSON.stringify([2]) && JSON.stringify(A.variantesDe("lista", 4)) === JSON.stringify([0])
  );
  ok("arranjos: o rótulo diz a fórmula", A.rotuloDoArranjo("grade", 3, 6) === "Grade 3×2" && A.rotuloDoArranjo("lista", 0, 6) === "Lista");
  const linha = A.aplicarArranjo({ ...lamina, shapes: [...lamina.shapes, caixa("traco", 20, 42, 40, 0.5, { fill: "0BA050" }), caixa("barra", 12, 34, 4, 0.6, { fill: "0BA050" })] }, "grade", 2, ratio);
  ok(
    "arranjos: o traço fino fora dos cartões sai; a barrinha de dentro do cartão fica",
    !linha.shapes.some((s) => s.id === "traco") && linha.shapes.some((s) => s.id === "barra")
  );
  const titulo = { md: "", layout: "titulo", notes: "", shapes: [texto("a", 8, 28, 84, 24, "Título"), texto("b", 8, 55, 84, 14, "Subtítulo")] };
  ok("arranjos: lâmina de título (dois textos) fica como está", A.aplicarArranjo(titulo, "lista", 0, ratio) === titulo);
  const topicos = {
    md: "",
    layout: "conteudo",
    notes: "",
    shapes: [texto("tt", 6, 6, 60, 12, "Título"), texto("p1", 6, 30, 88, 10, "Um"), texto("p2", 6, 45, 88, 10, "Dois"), texto("p3", 6, 60, 88, 10, "Três")],
  };
  const gradeTop = A.aplicarArranjo(topicos, "grade", 2, ratio);
  const g = (id) => gradeTop.shapes.find((s) => s.id === id);
  ok("arranjos: lâmina de tópicos (sem cartões) usa os textos como unidades e guarda o título", g("tt").box.y === 6 && g("p1").box.y > g("tt").box.y && g("p1").box.y === g("p2").box.y && g("p2").box.x > g("p1").box.x);
}

// gerador de designs: paletas criadas na hora, misturadas na fornada das Ideias
const GEN = await empacotar("src/powerpoint/edicao/gerador.ts", "gerador.mjs");
{
  const a = GEN.gerarDesign(3);
  const b = GEN.gerarDesign(3);
  ok("gerador: a mesma semente devolve o mesmo design (a prévia é o que o clique aplica)", JSON.stringify(a) === JSON.stringify(b) && a.id === "gerado-3" && a.gerado === true);
  const oito = Array.from({ length: 8 }, (_, n) => GEN.gerarDesign(n));
  ok("gerador: oito sementes seguidas dão oito paletas diferentes", new Set(oito.map((d) => d.cores.accent)).size === 8);
  ok("gerador: oito nomes diferentes", new Set(oito.map((d) => d.nome)).size >= 7);
  ok(
    "gerador: o texto contrasta com o fundo em todos (WCAG 4,5:1)",
    oito.every((d) => M.contrasteDeCores(d.cores.fg, d.bg) >= 4.5),
    oito.map((d) => `${d.cores.fg}/${d.bg}=${M.contrasteDeCores(d.cores.fg, d.bg).toFixed(1)}`).join(" ")
  );
  ok("gerador: fundo claro e escuro alternam", oito.filter((d) => d.tema === "claro").length === 4 && oito.filter((d) => d.tema === "escuro").length === 4);
  ok(
    "gerador: cores em hex de seis dígitos e fonte do catálogo",
    oito.every((d) => [d.bg, d.cores.fg, d.cores.accent, d.cores.muted].every((c) => /^[0-9A-F]{6}$/.test(c))) && oito.every((d) => typeof d.fonte === "string" && d.fonte.length > 2)
  );
  ok("gerador: os esquemas giram (análogo, complementar, triádico)", GEN.esquemaDe(0) === "análogo" && GEN.esquemaDe(1) === "complementar" && GEN.esquemaDe(2) === "triádico");
  ok("gerador: a matiz espalha (duas sementes seguidas ficam longe)", Math.abs(GEN.matizDaSemente(0) - GEN.matizDaSemente(1)) > 90);
  const mk = (shapes, bg) => ({ md: "", layout: "conteudo", notes: "", shapes, bg });
  const run = (color) => ({ text: "Oi", size: 18, bold: false, italic: false, underline: false, strike: false, color, font: "Segoe UI" });
  const para = (r) => ({ runs: [r], align: "esquerda", lvl: 0, marL: 0, indent: 0, spcBef: 0, spcAft: 0, endSize: 18 });
  const caixa = (extra = {}) => ({ id: "t", kind: "texto", box: { x: 8, y: 10, w: 80, h: 20 }, text: "Oi", fontFamily: "Segoe UI", fontSize: 18, color: "1C212B", bold: false, italic: false, align: "esquerda", fill: "", src: "", rot: 0, ...extra });
  const deckG = [mk([caixa({ paras: [para(run("1C212B"))] })], { kind: "solid", color: "FFFFFF" })];
  const gerado = GEN.gerarDesign(4);
  const aplicado = aplicar(deckG, { theme: "claro", bg: "", fontFamily: "Segoe UI" }, gerado);
  ok(
    "gerador: o design criado na hora aplica como qualquer modelo (fundo, texto e fonte)",
    aplicado[0].bg.color === gerado.bg && aplicado[0].shapes[0].paras[0].runs[0].color === gerado.cores.fg && aplicado[0].shapes[0].fontFamily === gerado.fonte
  );
}

// modelos criados pelo usuário: o visual do deck vira um modelo reaplicável
{
  const mk = (shapes, bg) => ({ md: "", layout: "conteudo", notes: "", shapes, bg });
  const run = (color, font) => ({ text: "Oi", size: 18, bold: false, italic: false, underline: false, strike: false, color, font });
  const para = (r) => ({ runs: [r], align: "esquerda", lvl: 0, marL: 0, indent: 0, spcBef: 0, spcAft: 0, endSize: 18 });
  const caixa = (extra = {}) => ({ id: "t", kind: "texto", box: { x: 8, y: 10, w: 80, h: 20 }, text: "Oi", fontFamily: "Segoe UI", fontSize: 18, color: "1C212B", bold: false, italic: false, align: "esquerda", fill: "", src: "", rot: 0, ...extra });
  // deck com cara própria: fundo bege, acento verde e fonte Georgia
  const meuDeck = [
    mk([caixa({ fontFamily: "Georgia", paras: [para(run("2B2B2B", "Georgia"))] })], { kind: "solid", color: "FDF6E3" }),
    mk([caixa({ id: "f", kind: "forma", color: "FFFFFF", fill: "2E7D32", fillX: { kind: "solid", color: "2E7D32" }, ln: { color: "2E7D32", alpha: 1, w: 1, dash: "solid" } })], { kind: "solid", color: "FDF6E3" }),
  ];
  const setup = { aspect: "16:9", theme: "claro", showNumber: false, footer: "", fontFamily: "Georgia", fontSize: 18, bg: "" };
  const modelo = M.modeloDoDeck(meuDeck, setup, "Meu modelo", "usuario-1");
  ok("modelo do usuário: guarda fundo, fonte e acento do deck", modelo.usuario === true && modelo.bg === "FDF6E3" && modelo.fonte === "Georgia" && modelo.cores.accent === "2E7D32", JSON.stringify(modelo.cores));
  // aplicar num deck com a cara padrão reproduz o visual guardado
  const padrao = [
    mk([caixa({ paras: [para(run("1C212B", "Segoe UI"))] })], { kind: "solid", color: "FFFFFF" }),
    mk([caixa({ id: "f", kind: "forma", color: "FFFFFF", fill: "4F46E5", fillX: { kind: "solid", color: "4F46E5" } })]),
  ];
  const aplicado = aplicar(padrao, { theme: "claro", bg: "", fontFamily: "Segoe UI" }, modelo);
  ok(
    "aplicar o modelo do usuário: fundo, texto, fonte e acento",
    aplicado[0].bg.color === "FDF6E3" && aplicado[0].shapes[0].color === "2B2B2B" && aplicado[0].shapes[0].fontFamily === "Georgia" && aplicado[1].shapes[0].fillX.color === "2E7D32",
    JSON.stringify([aplicado[0].bg, aplicado[0].shapes[0].color, aplicado[1].shapes[0].fillX.color])
  );
}

// ---------------------------------------------------------------- gráficos
const GC = await empacotar("src/powerpoint/edicao/grafico.ts", "grafico.mjs");
{
  const g = GC.graficoPadrao("colunas");
  ok("gráfico novo: 4 categorias e 2 séries", g.categorias.length === 4 && g.series.length === 2);
  const n = GC.normalizarGrafico({ tipo: "linhas", categorias: ["A", "B"], series: [{ nome: "", valores: [1, NaN, 5] }] });
  ok("normalizar: um valor por categoria, nome preenchido e número inválido vira 0", n.series[0].valores.length === 2 && n.series[0].nome === "Série 1" && n.series[0].valores[1] === 0);
  const esc = GC.escalaDeValores({ tipo: "colunas", categorias: ["A", "B"], series: [{ nome: "S", valores: [3, 9] }] });
  ok("escala de colunas começa em zero e cobre o máximo", esc.min === 0 && esc.max >= 9 && esc.ticks.length >= 3, JSON.stringify(esc));
  const emp = GC.escalaDeValores({ tipo: "colunas", empilhado: true, categorias: ["A"], series: [{ nome: "S1", valores: [5] }, { nome: "S2", valores: [7] }] });
  ok("escala empilhada soma as séries", emp.max >= 12, JSON.stringify(emp));
  const neg = GC.escalaDeValores({ tipo: "linhas", categorias: ["A", "B"], series: [{ nome: "S", valores: [-4, 6] }] });
  ok("escala de linhas aceita negativos", neg.min <= -4 && neg.max >= 6, JSON.stringify(neg));
  ok("paleta: o acento do deck entra na primeira série", GC.paletaDeSeries(3, "123456")[0] === "123456");
  ok("paleta: as cores próprias do gráfico mandam", GC.paletaDeSeries(2, "123456", ["ABCDEF"])[0] === "ABCDEF");
  const v = GC.setValor(g, 1, 0, 42);
  ok("setValor muda só o valor pedido", v.series[0].valores[1] === 42 && v.series[1].valores[1] === 5 && g.series[0].valores[1] === 6);
  const c = GC.setCategoria(g, 2, "X");
  ok("setCategoria muda só a categoria pedida", c.categorias[2] === "X" && c.categorias[0] === "Categoria 1");
  const mais = GC.addCategoria(GC.addSerie(g));
  ok("addCategoria/addSerie mantêm linhas e colunas alinhadas", mais.categorias.length === 5 && mais.series.length === 3 && mais.series.every((s) => s.valores.length === 5));
  const menos = GC.delCategoria(GC.delSerie(g, 0), 0);
  ok("delCategoria/delSerie tiram a linha e a coluna", menos.categorias.length === 3 && menos.series.length === 1 && menos.series[0].valores.length === 3);
  ok("nunca fica sem série", GC.delSerie(menos, 0).series.length === 1);
  ok("nunca fica sem categoria", GC.delCategoria({ ...g, categorias: ["A"], series: [{ nome: "S", valores: [1] }] }, 0).categorias.length === 1);
  const box = GC.caixaDoGrafico(960, 540);
  ok("caixa do gráfico centrada e dentro da lâmina", box.x > 0 && box.y > 0 && box.x + box.w < 100 && box.y + box.h < 100, JSON.stringify(box));
}

// ---------------------------------------------------------------- gráficos: desenho (SVG)
const GR = await empacotar("src/powerpoint/render/grafico.ts", "grafico-render.mjs");
{
  const ctx = { larguraPt: 960, alturaPt: 540, media: {}, editavel: false };
  const forma = { id: "g1", kind: "forma", box: { x: 20, y: 20, w: 40, h: 40 }, text: "", fontFamily: "A", fontSize: 16, color: "000000", bold: false, italic: false, align: "centro", fill: "", src: "", rot: 0, geom: "rect", grafico: GC.graficoPadrao("colunas") };
  const svg = GR.svgDoGrafico(forma, ctx, "export");
  ok("SVG do gráfico: viewBox em pt e medidas em pt no modo export", svg.startsWith("<svg") && svg.includes('viewBox="0 0 384 216"') && !svg.includes("cqw"));
  ok("SVG do gráfico: desenha barras, eixos e título", (svg.match(/<rect/g) ?? []).length >= 8 && svg.includes("<line") && svg.includes("Título do gráfico"));
  const tela = GR.svgDoGrafico(forma, ctx, "tela");
  ok("SVG do gráfico: no modo tela as medidas saem em cqw", tela.includes("cqw"));
  const pizza = GR.svgDoGrafico({ ...forma, grafico: { ...GC.graficoPadrao("pizza"), legenda: true } }, ctx, "export");
  ok("SVG da pizza: um setor por categoria", (pizza.match(/<path/g) ?? []).length >= 4);
  const vazio = GR.svgDoGrafico({ ...forma, grafico: undefined }, ctx, "export");
  ok("forma sem gráfico não desenha nada", vazio === "");
}

// ---------------------------------------------------------------- arrastar a caixa (área de pega)
const FR = await empacotar("src/powerpoint/render/forma.ts", "forma-render.mjs");
{
  const ctx = { larguraPt: 960, alturaPt: 540, media: {}, editavel: true };
  const caixa = { id: "c1", kind: "forma", box: { x: 10, y: 10, w: 30, h: 12 }, text: "A no trabalho", fontFamily: "A", fontSize: 16, color: "000000", bold: false, italic: false, align: "centro", fill: "", src: "", rot: 0, geom: "rect", paras: [] };
  const solta = FR.htmlFormaRica(caixa, ctx);
  ok("caixa sem fundo não escolhida: o miolo deixa o clique passar", solta.includes("pp-sem-fundo") && !solta.includes("pp-pega"), solta.slice(0, 130));
  const escolhida = FR.htmlFormaRica(caixa, { ...ctx, selecionadas: [caixa.id] });
  ok("caixa sem fundo ESCOLHIDA: o miolo vira área de arrasto (pp-pega)", escolhida.includes("pp-sem-fundo pp-pega"), escolhida.slice(0, 130));
  ok(
    "caixa com fundo não precisa do pp-pega (o miolo já pega)",
    !FR.htmlFormaRica({ ...caixa, fillX: { kind: "solid", color: "FFFFFF" } }, { ...ctx, selecionadas: [caixa.id] }).includes("pp-pega")
  );
  ok(
    "editando o texto, quem pega o ponteiro é o texto (sem pp-pega)",
    !FR.htmlFormaRica(caixa, { ...ctx, selecionadas: [caixa.id], editando: caixa.id }).includes("pp-pega")
  );
  ok("outra forma escolhida não arrasta esta", !FR.htmlFormaRica(caixa, { ...ctx, selecionadas: ["outra"] }).includes("pp-pega"));
}

// ---------------------------------------------------------------- transições de lâmina
const TR = await empacotar("src/powerpoint/edicao/transicao.ts", "transicao.mjs");
{
  const t = TR.normalizarTransicao({ tipo: "push" });
  ok("transição: tipo conhecido ganha a direção padrão", t.tipo === "push" && t.direcao === "direita" && t.duracao === undefined, JSON.stringify(t));
  ok("transição: fade e split não guardam direção", TR.normalizarTransicao({ tipo: "fade", direcao: "cima" }).direcao === undefined && TR.normalizarTransicao({ tipo: "split", direcao: "baixo" }).direcao === undefined);
  ok("transição: tipo desconhecido vira sem transição", TR.normalizarTransicao({ tipo: "vortex" }) === undefined);
  ok("transição: duração fora dos limites é aparada", TR.duracaoDe({ tipo: "fade", duracao: 99 }) === 10 && TR.duracaoDe({ tipo: "fade", duracao: 0 }) === 0.1);
  ok("transição: duração padrão de 0,7 s", TR.duracaoDe({ tipo: "fade" }) === 0.7 && TR.formatarDuracao(0.7) === "0,7 s" && TR.formatarDuracao(1) === "1 s");
  ok("transição: só push/wipe/cover/uncover aceitam direção", TR.aceitaDirecao("push") && TR.aceitaDirecao("wipe") && TR.aceitaDirecao("cover") && TR.aceitaDirecao("uncover") && !TR.aceitaDirecao("split") && !TR.aceitaDirecao("fade") && !TR.aceitaDirecao("none"));
  const troca = TR.comTransicao({ tipo: "push", direcao: "esquerda", duracao: 1 }, { direcao: "baixo" });
  ok("transição: comTransicao troca só o pedido", troca.tipo === "push" && troca.direcao === "baixo" && troca.duracao === 1, JSON.stringify(troca));
  const sem = TR.normalizarTransicao({ tipo: "none", direcao: "cima", duracao: 2 });
  ok("transição: 'sem' limpa direção e duração", sem.tipo === "none" && sem.direcao === undefined && sem.duracao === undefined);
  ok("transição: comTransicao muda a duração mantendo o tipo", TR.comTransicao({ tipo: "wipe", direcao: "cima" }, { duracao: 2 }).duracao === 2);
}

// ---------------------------------------------------------------- round-trip do p:transition
const IMP = await empacotar("src/powerpoint/pptximport/slides.ts", "slides-imp.mjs");
const EXP = await empacotar("src/powerpoint/pptxexport/slides.ts", "slides-exp.mjs");
{
  // lâmina mínima, como o PptxGenJS e o Escritor a escrevem
  const lamina = (extra) =>
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr></p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr>${extra}</p:sld>`;
  const alternado = (dentro) =>
    `<mc:AlternateContent xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006" xmlns:p14="http://schemas.microsoft.com/office/powerpoint/2010/main"><mc:Choice Requires="p14">${dentro}</mc:Choice><mc:Fallback>${dentro.replace(/\s+p14:dur="\d+"/, "")}</mc:Fallback></mc:AlternateContent>`;

  // sem transição
  const nada = IMP.lerTransicao(lamina(""));
  ok("transição: lâmina sem p:transition não inventa nada", !nada.transicao && !nada.bruta && nada.avisos.length === 0);

  // fade como o PowerPoint grava (mc:AlternateContent + p14:dur em milissegundos)
  const fade = IMP.lerTransicao(lamina(alternado(`<p:transition spd="med" p14:dur="700"><p:fade/></p:transition>`)));
  ok("transição: fade com p14:dur vira 0,7 s", fade.transicao?.tipo === "fade" && fade.transicao.duracao === 0.7 && !fade.transicao.direcao, JSON.stringify(fade));

  // spd sem p14:dur (fast = 0,5 s · med = 0,75 s · slow = 1 s)
  const push = IMP.lerTransicao(lamina(`<p:transition spd="fast"><p:push dir="r"/></p:transition>`));
  ok("transição: push com dir e spd=fast", push.transicao?.tipo === "push" && push.transicao.direcao === "direita" && push.transicao.duracao === 0.5, JSON.stringify(push.transicao));
  const wipe = IMP.lerTransicao(lamina(`<p:transition><p:wipe dir="u"/></p:transition>`));
  ok("transição: wipe sem spd não inventa duração", wipe.transicao?.tipo === "wipe" && wipe.transicao.direcao === "cima" && wipe.transicao.duracao === undefined, JSON.stringify(wipe.transicao));
  const cover = IMP.lerTransicao(lamina(`<p:transition spd="slow"><p:cover dir="l"/></p:transition>`));
  ok("transição: cover com dir", cover.transicao?.tipo === "cover" && cover.transicao.direcao === "esquerda" && cover.transicao.duracao === 1, JSON.stringify(cover.transicao));
  const uncover = IMP.lerTransicao(lamina(`<p:transition spd="slow"><p:pull dir="l"/></p:transition>`));
  ok("transição: pull (Uncover) vira uncover", uncover.transicao?.tipo === "uncover" && uncover.transicao.direcao === "esquerda", JSON.stringify(uncover.transicao));
  const split = IMP.lerTransicao(lamina(`<p:transition spd="med"><p:split/></p:transition>`));
  ok("transição: split padrão", split.transicao?.tipo === "split" && split.transicao.duracao === 0.75, JSON.stringify(split.transicao));
  const semDir = IMP.lerTransicao(lamina(`<p:transition spd="med"><p:push/></p:transition>`));
  ok("transição: sem dir vale o padrão do OOXML (esquerda)", semDir.transicao?.direcao === "esquerda", JSON.stringify(semDir.transicao));

  // o que o modelo não representa: guarda o XML cru e avisa
  const wedge = IMP.lerTransicao(lamina(`<p:transition spd="slow"><p:wedge/></p:transition>`));
  ok("transição: efeito desconhecido fica guardado cru e avisa", !wedge.transicao && !!wedge.bruta && wedge.avisos.length === 1 && wedge.bruta.includes("<p:wedge/>"), JSON.stringify(wedge));
  const som = IMP.lerTransicao(lamina(`<p:transition spd="med"><p:fade/><p:sndAc><p:stSnd/></p:sndAc></p:transition>`));
  ok("transição: com som fica guardada crua", !som.transicao && !!som.bruta && som.avisos.length === 1, JSON.stringify(som.avisos));
  const splitVert = IMP.lerTransicao(lamina(`<p:transition spd="med"><p:split orient="vert"/></p:transition>`));
  ok("transição: split vertical fica guardado cru", !splitVert.transicao && !!splitVert.bruta && splitVert.avisos.length === 1);
  const canto = IMP.lerTransicao(lamina(`<p:transition spd="med"><p:cover dir="lu"/></p:transition>`));
  ok("transição: direção de canto fica guardada crua", !canto.transicao && !!canto.bruta);

  // gravação: spd + p14:dur + dir, e a leitura devolve o mesmo modelo
  const xmlPush = EXP.xmlTransicao({ tipo: "push", direcao: "esquerda", duracao: 2 });
  ok("transição: push entra como <p:push dir=\"l\"> com spd=slow e p14:dur", xmlPush.includes('spd="slow"') && xmlPush.includes('p14:dur="2000"') && xmlPush.includes('<p:push dir="l"/>'), xmlPush);
  ok("transição: 'sem' não escreve nada", EXP.xmlTransicao({ tipo: "none" }) === "" && EXP.xmlTransicao(undefined) === "");
  ok("transição: spd acompanha a duração", EXP.velocidadeDe(0.5) === "fast" && EXP.velocidadeDe(0.7) === "med" && EXP.velocidadeDe(2) === "slow");
  for (const tipo of ["fade", "push", "wipe", "split", "cover", "uncover"]) {
    const modelo = TR.normalizarTransicao({ tipo, duracao: 1.5 });
    const volta = IMP.lerTransicao(EXP.inserirTransicao(lamina(""), modelo));
    ok(`transição: round-trip ${tipo}`, JSON.stringify(volta.transicao) === JSON.stringify(modelo), JSON.stringify([modelo, volta]));
  }
  // a transição entra depois do clrMapOvr (a ordem do esquema) e não duplica
  const comTransicao = EXP.inserirTransicao(lamina(""), { tipo: "fade", duracao: 1 });
  ok("transição: entra depois do p:clrMapOvr", /<\/p:clrMapOvr><p:transition/.test(comTransicao), comTransicao.slice(-260));
  const trocada = EXP.inserirTransicao(comTransicao, { tipo: "wipe", direcao: "baixo" });
  ok("transição: trocar não deixa a antiga no arquivo", (trocada.match(/<p:transition\b/g) ?? []).length === 1 && IMP.lerTransicao(trocada).transicao?.tipo === "wipe");
  // o XML cru guardado volta como veio (inclusive o mc:AlternateContent)
  const bruta = IMP.lerTransicao(lamina(alternado(`<p:transition spd="slow" p14:dur="2000"><p:wedge/></p:transition>`))).bruta;
  ok("transição: o XML cru volta como veio", EXP.inserirTransicao(lamina(""), undefined, bruta) === lamina(bruta));
}

// ---------------------------------------------------------------- animações de forma (modelo)
const AN = await empacotar("src/powerpoint/edicao/animacao.ts", "animacao.mjs");
{
  const a = AN.normalizarAnimacao({ forma: "s1", tipo: "surgir" });
  ok("animação: surgir ganha a duração padrão de 0,5 s", a.forma === "s1" && a.tipo === "surgir" && a.duracao === 0.5 && a.inicio === undefined, JSON.stringify(a));
  ok("animação: aparecer não guarda duração", AN.normalizarAnimacao({ forma: "s1", tipo: "aparecer", duracao: 2 }).duracao === undefined);
  ok("animação: tipo desconhecido é descartado", AN.normalizarAnimacao({ forma: "s1", tipo: "spin" }) === undefined);
  ok("animação: sem forma é descartada", AN.normalizarAnimacao({ tipo: "surgir" }) === undefined);
  ok("animação: duração fora dos limites é aparada", AN.duracaoDeAnimacao({ forma: "s1", tipo: "sumir", duracao: 99 }) === 10 && AN.duracaoDeAnimacao({ forma: "s1", tipo: "sumir", duracao: 0 }) === 0.1);
  ok("animação: duração efetiva é 0 nos instantâneos", AN.duracaoEfetiva({ forma: "s1", tipo: "aparecer" }) === 0 && AN.duracaoEfetiva({ forma: "s1", tipo: "surgir" }) === 0.5);
  ok("animação: início conhecido é preservado", AN.normalizarAnimacao({ forma: "s1", tipo: "surgir", inicio: "depois" }).inicio === "depois");
  ok("animação: início inválido cai no padrão (ao clicar)", AN.inicioDe({ forma: "s1", tipo: "surgir", inicio: "x" }) === "clicar");

  // comAnimacao: acrescenta no fim, troca no lugar (preserva a ordem)
  let lista = AN.comAnimacao(undefined, "s1", "surgir");
  lista = AN.comAnimacao(lista, "s2", "aparecer");
  lista = AN.comAnimacao(lista, "s1", "sumir");
  ok("animação: comAnimacao troca no lugar e preserva a ordem", lista.length === 2 && lista[0].forma === "s1" && lista[0].tipo === "sumir" && lista[1].forma === "s2", JSON.stringify(lista));
  ok("animação: comInicio muda o início do efeito", AN.comInicio(lista, "s2", "depois")[1].inicio === "depois");
  ok("animação: comInicio em forma sem efeito não faz nada", JSON.stringify(AN.comInicio(lista, "s9", "com")) === JSON.stringify(lista));
  ok("animação: comDuracao só vale nos suaves", AN.comDuracao(lista, "s2", 2)[1].duracao === undefined && AN.comDuracao(lista, "s1", 2)[0].duracao === 2);
  ok("animação: mover troca as posições", AN.moverAnimacao(lista, "s1", 1)[1].forma === "s1");
  ok("animação: mover fora dos limites não muda nada", JSON.stringify(AN.moverAnimacao(lista, "s1", -1)) === JSON.stringify(lista));
  ok("animação: remover tira o efeito da forma", AN.semAnimacao(lista, "s1").length === 1);
  ok("animação: podar segue as formas vivas", AN.podarAnimacoes(lista, ["s2"]).length === 1 && AN.podarAnimacoes(lista, ["s2"])[0].forma === "s2");

  // ênfase: duração padrão por tipo e classe
  ok("animação: girar/ampliar nascem com 2 s", AN.normalizarAnimacao({ forma: "s1", tipo: "girar" }).duracao === 2 && AN.normalizarAnimacao({ forma: "s1", tipo: "ampliar" }).duracao === 2);
  ok("animação: pulsar/transparência nascem com 0,5 s", AN.normalizarAnimacao({ forma: "s1", tipo: "pulsar" }).duracao === 0.5 && AN.normalizarAnimacao({ forma: "s1", tipo: "transparencia" }).duracao === 0.5);
  ok("animação: classe de cada efeito", AN.CLASSE_ANIMACAO.pulsar === "enfase" && AN.CLASSE_ANIMACAO.surgir === "entrada" && AN.CLASSE_ANIMACAO.sumir === "saida");
  ok("animação: instantâneos e suaves", AN.instantaneo("aparecer") && AN.instantaneo("desaparecer") && !AN.instantaneo("pulsar") && AN.suave("girar") && !AN.suave("desaparecer"));
  ok("animação: ênfase tem duração efetiva", AN.duracaoEfetiva({ forma: "s1", tipo: "pulsar", duracao: 1 }) === 1);

  // atraso: normalização, limite e mutação
  ok("animação: atraso entra normalizado", AN.normalizarAnimacao({ forma: "s1", tipo: "surgir", atraso: 0.5 }).atraso === 0.5);
  ok("animação: atraso zero não é guardado", AN.normalizarAnimacao({ forma: "s1", tipo: "surgir", atraso: 0 }).atraso === undefined);
  ok("animação: atraso fora dos limites é aparado", AN.atrasoDe({ forma: "s1", tipo: "surgir", atraso: 99 }) === 60 && AN.atrasoDe({ forma: "s1", tipo: "surgir", atraso: -1 }) === 0);
  ok("animação: comAtraso muda o atraso do efeito", AN.comAtraso(lista, "s1", 1)[0].atraso === 1);
  ok("animação: comAtraso em forma sem efeito não faz nada", JSON.stringify(AN.comAtraso(lista, "s9", 1)) === JSON.stringify(lista));

  // trajetória: direção, duração padrão e classe
  const traj = AN.normalizarAnimacao({ forma: "s1", tipo: "trajetoria" });
  ok("animação: trajetória nasce com 2 s e direção padrão", traj.duracao === 2 && traj.direcao === "direita", JSON.stringify(traj));
  ok("animação: trajetória guarda a direção escolhida", AN.normalizarAnimacao({ forma: "s1", tipo: "trajetoria", direcao: "cima" }).direcao === "cima");
  ok("animação: direção inválida cai no padrão", AN.direcaoDeAnimacao({ forma: "s1", tipo: "trajetoria", direcao: "x" }) === "direita");
  ok("animação: só a trajetória aceita direção", AN.aceitaDirecaoAnimacao("trajetoria") && !AN.aceitaDirecaoAnimacao("pulsar") && AN.normalizarAnimacao({ forma: "s1", tipo: "pulsar", direcao: "cima" }).direcao === undefined);
  ok("animação: classe da trajetória", AN.CLASSE_ANIMACAO.trajetoria === "trajetoria");
  const comTraj = AN.comAnimacao(undefined, "s1", "trajetoria");
  ok("animação: comDirecao muda a direção da trajetória", AN.comDirecao(comTraj, "s1", "baixo")[0].direcao === "baixo");
  ok("animação: comDirecao em efeito sem direção não faz nada", JSON.stringify(AN.comDirecao(lista, "s2", "cima")) === JSON.stringify(lista));

  // por parágrafo: flag, mutação e contagem
  ok("animação: porParagrafo entra normalizado", AN.normalizarAnimacao({ forma: "s1", tipo: "surgir", porParagrafo: true }).porParagrafo === true);
  ok("animação: sem porParagrafo o flag não aparece", AN.normalizarAnimacao({ forma: "s1", tipo: "surgir" }).porParagrafo === undefined);
  const comPP = AN.comPorParagrafo(comTraj, "s1", true);
  ok("animação: comPorParagrafo liga e desliga o build", comPP[0].porParagrafo === true && AN.comPorParagrafo(comPP, "s1", false)[0].porParagrafo === undefined);
  ok("animação: paragrafosDe conta só os não vazios", JSON.stringify(AN.paragrafosDe({ paras: [{ runs: [1] }, { runs: [] }, { runs: [2, 3] }] })) === "[0,2]");

  // voar e zoom: direção padrão do voar e classes
  ok("animação: voar nasce com direção baixo", AN.normalizarAnimacao({ forma: "s1", tipo: "voar" }).direcao === "baixo");
  ok(
    "animação: classes de voar/zoom",
    AN.CLASSE_ANIMACAO.voar === "entrada" && AN.CLASSE_ANIMACAO.zoom === "entrada" && AN.CLASSE_ANIMACAO.voarFora === "saida" && AN.CLASSE_ANIMACAO.encolher === "saida"
  );
  ok("animação: direção vale no voar e na trajetória", AN.aceitaDirecaoAnimacao("voar") && AN.aceitaDirecaoAnimacao("voarFora") && AN.aceitaDirecaoAnimacao("trajetoria") && !AN.aceitaDirecaoAnimacao("zoom"));

  // limpar e as revelações do centro
  ok("animação: limpar nasce com direção baixo", AN.normalizarAnimacao({ forma: "s1", tipo: "limpar" }).direcao === "baixo");
  ok(
    "animação: classes de limpar/caixa/círculo/losango",
    AN.CLASSE_ANIMACAO.limpar === "entrada" &&
      AN.CLASSE_ANIMACAO.caixa === "entrada" &&
      AN.CLASSE_ANIMACAO.circulo === "entrada" &&
      AN.CLASSE_ANIMACAO.losango === "entrada" &&
      AN.CLASSE_ANIMACAO.limparFora === "saida" &&
      AN.CLASSE_ANIMACAO.caixaFora === "saida" &&
      AN.CLASSE_ANIMACAO.circuloFora === "saida" &&
      AN.CLASSE_ANIMACAO.losangoFora === "saida"
  );
  ok("animação: direção vale no limpar", AN.aceitaDirecaoAnimacao("limpar") && AN.aceitaDirecaoAnimacao("limparFora") && !AN.aceitaDirecaoAnimacao("caixa"));

  // as texturas (dividir, persianas, dissolver e roda)
  ok(
    "animação: classes das texturas",
    AN.CLASSE_ANIMACAO.dividir === "entrada" &&
      AN.CLASSE_ANIMACAO.persianas === "entrada" &&
      AN.CLASSE_ANIMACAO.dissolver === "entrada" &&
      AN.CLASSE_ANIMACAO.roda === "entrada" &&
      AN.CLASSE_ANIMACAO.dividirFora === "saida" &&
      AN.CLASSE_ANIMACAO.persianasFora === "saida" &&
      AN.CLASSE_ANIMACAO.dissolverFora === "saida" &&
      AN.CLASSE_ANIMACAO.rodaFora === "saida"
  );
  ok("animação: texturas não têm direção", !AN.aceitaDirecaoAnimacao("dividir") && !AN.aceitaDirecaoAnimacao("persianas") && !AN.aceitaDirecaoAnimacao("dissolver") && !AN.aceitaDirecaoAnimacao("roda"));

  // trocar o efeito de uma forma: os padrões do tipo novo valem; o que é escolha da forma fica
  ok(
    "animação: trocar o efeito volta aos padrões do tipo novo (duração)",
    JSON.stringify(AN.comAnimacao([{ forma: "s1", tipo: "surgir", duracao: 0.5, atraso: 0.25 }], "s1", "ampliar")) === JSON.stringify([{ forma: "s1", tipo: "ampliar", duracao: 2, atraso: 0.25 }]),
    JSON.stringify(AN.comAnimacao([{ forma: "s1", tipo: "surgir", duracao: 0.5, atraso: 0.25 }], "s1", "ampliar"))
  );
  ok(
    "animação: trocar para trajetória usa a direção padrão dela",
    JSON.stringify(AN.comAnimacao([{ forma: "s1", tipo: "voar", direcao: "cima" }], "s1", "trajetoria")) === JSON.stringify([{ forma: "s1", tipo: "trajetoria", duracao: 2, direcao: "direita" }]),
    JSON.stringify(AN.comAnimacao([{ forma: "s1", tipo: "voar", direcao: "cima" }], "s1", "trajetoria"))
  );
  ok(
    "animação: reaplicar o mesmo efeito mantém as escolhas",
    JSON.stringify(AN.comAnimacao([{ forma: "s1", tipo: "surgir", inicio: "depois", duracao: 1 }], "s1", "surgir")) === JSON.stringify([{ forma: "s1", tipo: "surgir", inicio: "depois", duracao: 1 }]),
    JSON.stringify(AN.comAnimacao([{ forma: "s1", tipo: "surgir", inicio: "depois", duracao: 1 }], "s1", "surgir"))
  );
}

// ---------------------------------------------------------------- jogador das animações (DOM falso)
// A prévia do editor toca a sequência e no fim devolve a lâmina ao estado de projeto; a
// apresentação (F5) NÃO limpa — lá o estado final é o estado da lâmina.
{
  const RA = await empacotar("src/powerpoint/render/animacao.ts", "render-animacao.mjs");
  globalThis.window = { matchMedia: () => ({ matches: false }), setTimeout: globalThis.setTimeout, clearTimeout: globalThis.clearTimeout };
  const espera = (ms) => new Promise((r) => setTimeout(r, ms));
  const criarEl = (id) => {
    const classes = new Set();
    const props = new Map();
    return {
      dataset: { shape: id },
      classList: {
        add: (...cs) => cs.forEach((c) => classes.add(c)),
        remove: (...cs) => cs.forEach((c) => classes.delete(c)),
        contains: (c) => classes.has(c),
      },
      style: { setProperty: (k, v) => props.set(k, v), removeProperty: (k) => props.delete(k) },
      addEventListener: () => {},
      querySelectorAll: () => [],
      getBoundingClientRect: () => ({ left: 0, top: 0, width: 100, height: 50 }),
      _classes: classes,
    };
  };
  const el = criarEl("s1");
  const raiz = { querySelectorAll: () => [el], clientWidth: 400, clientHeight: 300, getBoundingClientRect: () => ({ left: 0, top: 0, width: 400, height: 300 }) };
  const limpo = () => !el._classes.has("forma-amplia") && !el._classes.has("forma-surge") && !el._classes.has("forma-some") && !el._classes.has("forma-oculta");

  // prévia de um efeito fixo (ampliar): aplica e, no fim, devolve a forma ao normal
  RA.iniciarAnimacoes(raiz, [{ forma: "s1", tipo: "ampliar", duracao: 0.1 }], { automatico: true, limparNoFim: true });
  await espera(60);
  ok("jogador: a prévia aplica o efeito fixo", el._classes.has("forma-amplia"));
  await espera(250);
  ok("jogador: a prévia limpa no fim (a forma volta ao normal)", limpo());

  // apresentação (sem limparNoFim): o estado final fica
  RA.iniciarAnimacoes(raiz, [{ forma: "s1", tipo: "ampliar", duracao: 0.1 }], { automatico: true });
  await espera(250);
  ok("jogador: na apresentação o efeito fixo fica", el._classes.has("forma-amplia"));
  el._classes.clear();

  // prévia de uma saída (sumir): depois da prévia a forma volta a aparecer
  RA.iniciarAnimacoes(raiz, [{ forma: "s1", tipo: "sumir", duracao: 0.1 }], { automatico: true, limparNoFim: true });
  await espera(60);
  ok("jogador: a prévia da saída aplica", el._classes.has("forma-some"));
  await espera(250);
  ok("jogador: a prévia da saída devolve a forma", limpo());

  // cancelar (troca de lâmina, Escape) limpa na hora
  const c = RA.iniciarAnimacoes(raiz, [{ forma: "s1", tipo: "surgir", duracao: 5 }], { automatico: true });
  await espera(40);
  c.cancelar();
  ok("jogador: cancelar limpa na hora", limpo());
  delete globalThis.window;
}

// ---------------------------------------------------------------- round-trip do p:timing
const TIMP = await empacotar("src/powerpoint/pptximport/timing.ts", "timing-imp.mjs");
const TEXP = await empacotar("src/powerpoint/pptxexport/timing.ts", "timing-exp.mjs");
{
  const spids = new Map([["4", "s1"], ["5", "s2"]]);
  const ids = { s1: 4, s2: 5 };
  const modelo = [
    { forma: "s1", tipo: "surgir", duracao: 1 },
    { forma: "s2", tipo: "desaparecer", inicio: "depois" },
  ];
  const xml = TEXP.xmlTiming(modelo, ids, []);
  ok("timing: presetID/presetClass de cada efeito", xml.includes('presetID="10" presetClass="entr"') && xml.includes('presetID="1" presetClass="exit"'), xml.slice(0, 400));
  ok("timing: nodeType acompanha o início", xml.includes('nodeType="clickEffect"') && xml.includes('nodeType="afterEffect"'));
  const volta = TIMP.lerTiming(`<p:sld>${xml}</p:sld>`, spids);
  ok("timing: round-trip devolve o mesmo modelo", JSON.stringify(volta.animacoes) === JSON.stringify(modelo), JSON.stringify([modelo, volta]));
  ok("timing: round-trip não guarda cru nem avisa", !volta.bruta && volta.avisos.length === 0);

  // "com o anterior" sem clique antes vira grupo automático (começa junto com a lâmina)
  const com = TEXP.xmlTiming([{ forma: "s1", tipo: "aparecer", inicio: "com" }], ids, []);
  ok("timing: 'com' sem clique antes vira grupo automático", com.includes('evt="onBegin"') && com.includes("<p:tn>2</p:tn>"));
  ok("timing: 'com' volta como 'com'", TIMP.lerTiming(com, spids).animacoes?.[0].inicio === "com");

  ok("timing: sem animações não escreve p:timing", TEXP.xmlTiming(undefined, ids) === "" && TEXP.xmlTiming([], ids) === "");

  // dois efeitos na mesma forma: o modelo é um por forma — fica cru (nada se perde)
  const duplicado = TIMP.lerTiming(TEXP.xmlTiming([{ forma: "s1", tipo: "aparecer" }, { forma: "s1", tipo: "surgir" }], ids, []), spids);
  ok("timing: dois efeitos na mesma forma ficam crus", !duplicado.animacoes && !!duplicado.bruta);

  // ênfase modelada: pulsar (presetID 26, animScale) e o que fica fora do modelo (colorPulse = 27)
  const pulsarXml = TEXP.xmlTiming([{ forma: "s1", tipo: "pulsar" }], ids, []);
  ok("timing: pulsar sai como emph 26 com animScale", pulsarXml.includes('presetID="26" presetClass="emph"') && pulsarXml.includes("<p:animScale>") && pulsarXml.includes('autoRev="1"'), pulsarXml.slice(pulsarXml.indexOf("<p:childTnLst>"), pulsarXml.indexOf("<p:childTnLst>") + 200));
  const pulsado = TIMP.lerTiming(pulsarXml, spids);
  ok("timing: pulsar volta modelado", pulsado.animacoes?.[0]?.tipo === "pulsar" && pulsado.animacoes[0].inicio === undefined && pulsado.animacoes[0].duracao === 0.5, JSON.stringify(pulsado));
  const fora = `<p:timing><p:tnLst><p:par><p:cTn id="1" dur="indefinite" nodeType="tmRoot"><p:childTnLst><p:seq concurrent="1" nextAc="seek"><p:cTn id="2" dur="indefinite" nodeType="mainSeq"><p:childTnLst><p:par><p:cTn id="3" fill="hold"><p:stCondLst><p:cond delay="indefinite"/></p:stCondLst><p:childTnLst><p:par><p:cTn id="4" presetID="27" presetClass="emph" presetSubtype="0" fill="hold" grpId="0" nodeType="clickEffect"><p:stCondLst><p:cond delay="0"/></p:stCondLst><p:childTnLst><p:animClr clrSpc="rgb" dir="cw"><p:cBhvr><p:cTn id="5" dur="500" fill="hold"/><p:tgtEl><p:spTgt spid="4"/></p:tgtEl></p:cBhvr><p:to><a:srgbClr val="FF0000"/></p:to></p:animClr></p:childTnLst></p:cTn></p:par></p:childTnLst></p:cTn></p:par></p:childTnLst></p:cTn><p:prevCondLst><p:cond evt="onPrev" delay="0"><p:tgtEl><p:sldTgt/></p:tgtEl></p:cond></p:prevCondLst><p:nextCondLst><p:cond evt="onNext" delay="0"><p:tgtEl><p:sldTgt/></p:tgtEl></p:cond></p:nextCondLst></p:seq></p:childTnLst></p:cTn></p:par></p:tnLst></p:timing>`;
  const cru = TIMP.lerTiming(fora, spids);
  ok("timing: ênfase fora do modelo (colorPulse) fica crua e avisa", !cru.animacoes && !!cru.bruta && cru.avisos.length === 1);
  const semTiming = `<p:sld><p:cSld/><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sld>`;
  ok("timing: o XML cru volta como veio", TEXP.inserirTiming(semTiming, undefined, cru.bruta, {}, []).includes(cru.bruta));

  // alvo que não é uma forma da lâmina (id desconhecido): cru
  const desconhecido = TIMP.lerTiming(xml, new Map([["4", "s1"]]));
  ok("timing: efeito sem forma correspondente fica cru", !desconhecido.animacoes && !!desconhecido.bruta);

  // inserção na ordem do esquema: depois da transição e sem duplicar
  const comTransicao = `<p:sld><p:cSld/><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr><p:transition spd="fast"><p:fade/></p:transition></p:sld>`;
  const comTiming = TEXP.inserirTiming(comTransicao, modelo, undefined, ids, []);
  ok("timing: entra depois do p:transition", /<\/p:transition><p:timing/.test(comTiming), comTiming.slice(0, 300));
  const semTransicao = TEXP.inserirTiming(semTiming, modelo, undefined, ids, []);
  ok("timing: sem transição entra depois do p:clrMapOvr", /<\/p:clrMapOvr><p:timing/.test(semTransicao));
  const idempotente = TEXP.inserirTiming(comTiming, modelo, undefined, ids, []);
  ok("timing: inserir de novo não duplica", (idempotente.match(/<p:timing\b/g) ?? []).length === 1);
  // transição crua (mc:AlternateContent): o timing entra depois do bloco inteiro, não no meio
  const alt = `<mc:AlternateContent xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006"><mc:Choice Requires="p14"><p:transition spd="slow"><p:wedge/></p:transition></mc:Choice><mc:Fallback><p:transition spd="slow"><p:fade/></p:transition></mc:Fallback></mc:AlternateContent>`;
  const comAlt = TEXP.inserirTiming(`<p:sld><p:cSld/><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr>${alt}</p:sld>`, modelo, undefined, ids, []);
  ok("timing: com transição crua entra depois do mc:AlternateContent", /<\/mc:AlternateContent><p:timing/.test(comAlt), comAlt.slice(0, 300));

  // forma com texto entra no p:bldLst (o fundo da forma anima junto)
  const comTexto = TEXP.xmlTiming([{ forma: "s1", tipo: "surgir" }], ids, [{ id: "s1", paras: [{ runs: [] }] }]);
  ok("timing: forma com texto entra no p:bldLst", comTexto.includes("<p:bldLst>") && comTexto.includes('<p:bldP spid="4" grpId="0" animBg="1"/>'));

  // ênfase: round-trip dos quatro efeitos (com duração explícita)
  for (const tipo of ["pulsar", "ampliar", "girar", "transparencia"]) {
    const m = [{ forma: "s1", tipo, duracao: 1 }];
    const volta = TIMP.lerTiming(TEXP.xmlTiming(m, ids, []), spids);
    ok(`timing: round-trip ${tipo}`, JSON.stringify(volta.animacoes) === JSON.stringify(m), JSON.stringify([m, volta]));
  }

  // atraso: sai no p:cond do efeito e volta (ordem das chaves = a da normalização)
  const comAtraso = [{ forma: "s1", tipo: "surgir", duracao: 1, atraso: 0.5 }];
  const xmlAtraso = TEXP.xmlTiming(comAtraso, ids, []);
  ok("timing: atraso entra no p:cond do efeito", xmlAtraso.includes('<p:cond delay="500"/>'), xmlAtraso.slice(0, 500));
  ok("timing: atraso volta modelado", JSON.stringify(TIMP.lerTiming(xmlAtraso, spids).animacoes) === JSON.stringify(comAtraso));
  // "depois do anterior" com atraso: o lote seguinte espera atraso + duração do anterior
  const encadeado = TEXP.xmlTiming([{ forma: "s1", tipo: "surgir", atraso: 0.5, duracao: 1 }, { forma: "s2", tipo: "desaparecer", inicio: "depois" }], ids, []);
  ok("timing: o lote seguinte espera atraso + duração", encadeado.includes('<p:cond delay="1500"/>'), encadeado.slice(0, 700));

  // trajetória: round-trip das quatro direções (subtypes do PowerPoint: cima 1, direita 2, baixo 4, esquerda 8)
  for (const [direcao, sub] of [["cima", 1], ["direita", 2], ["baixo", 4], ["esquerda", 8]]) {
    const m = [{ forma: "s1", tipo: "trajetoria", duracao: 2, direcao }];
    const xmlT = TEXP.xmlTiming(m, ids, []);
    const volta = TIMP.lerTiming(xmlT, spids);
    ok(
      `timing: round-trip trajetória ${direcao}`,
      xmlT.includes(`presetID="64" presetClass="path" presetSubtype="${sub}"`) && xmlT.includes("<p:animMotion") && JSON.stringify(volta.animacoes) === JSON.stringify(m),
      JSON.stringify([m, volta])
    );
  }
  // caminho fora do padrão fica cru: distância diferente e curva
  const meia = TEXP.xmlTiming([{ forma: "s1", tipo: "trajetoria", direcao: "direita" }], ids, []).replace('path="M 0 0 L 0.25 0 E"', 'path="M 0 0 L 0.5 0 E"');
  ok("timing: trajetória com outra distância fica crua", !TIMP.lerTiming(meia, spids).animacoes);
  const curva = TEXP.xmlTiming([{ forma: "s1", tipo: "trajetoria", direcao: "direita" }], ids, []).replace('path="M 0 0 L 0.25 0 E"', 'path="M 0 0 C 0 -0.25 0.25 -0.25 0.25 0 E"');
  ok("timing: trajetória em curva fica crua", !TIMP.lerTiming(curva, spids).animacoes);

  // Voar (entrada/saída): round-trip das quatro direções (subtypes 1/2/4/8, um eixo parado)
  for (const [direcao, sub] of [["cima", 1], ["direita", 2], ["baixo", 4], ["esquerda", 8]]) {
    for (const [tipo, classe] of [["voar", "entr"], ["voarFora", "exit"]]) {
      const m = [{ forma: "s1", tipo, duracao: 0.5, direcao }];
      const xmlV = TEXP.xmlTiming(m, ids, []);
      const volta = TIMP.lerTiming(xmlV, spids);
      ok(
        `timing: round-trip ${tipo} ${direcao}`,
        xmlV.includes(`presetID="2" presetClass="${classe}" presetSubtype="${sub}"`) && JSON.stringify(volta.animacoes) === JSON.stringify(m),
        JSON.stringify([m, volta])
      );
    }
  }
  // Voar diagonal (os dois eixos se movem) fica cru
  const diagonal = TEXP.xmlTiming([{ forma: "s1", tipo: "voar", direcao: "direita" }], ids, []).replace('val="#ppt_y"', 'val="1+#ppt_h/2"');
  ok("timing: voar diagonal fica cru", !TIMP.lerTiming(diagonal, spids).animacoes);

  // Zoom/Encolher: round-trip e a variante (subtype 16) ficando crua
  for (const [tipo, classe] of [["zoom", "entr"], ["encolher", "exit"]]) {
    const m = [{ forma: "s1", tipo, duracao: 1 }];
    const xmlZ = TEXP.xmlTiming(m, ids, []);
    const volta = TIMP.lerTiming(xmlZ, spids);
    ok(`timing: round-trip ${tipo}`, xmlZ.includes(`presetID="53" presetClass="${classe}"`) && JSON.stringify(volta.animacoes) === JSON.stringify(m), JSON.stringify([m, volta]));
  }
  const zoomVariante = TEXP.xmlTiming([{ forma: "s1", tipo: "zoom" }], ids, []).replace('presetSubtype="0"', 'presetSubtype="16"');
  ok("timing: zoom com variante (subtype 16) fica cru", !TIMP.lerTiming(zoomVariante, spids).animacoes);

  // Limpar (entrada/saída): round-trip das quatro direções (subtypes 1/2/4/8 + o filter da borda)
  for (const [direcao, sub, filtro] of [["cima", 1, "wipe(down)"], ["direita", 2, "wipe(left)"], ["baixo", 4, "wipe(up)"], ["esquerda", 8, "wipe(right)"]]) {
    for (const [tipo, classe] of [["limpar", "entr"], ["limparFora", "exit"]]) {
      const m = [{ forma: "s1", tipo, duracao: 0.5, direcao }];
      const xmlL = TEXP.xmlTiming(m, ids, []);
      const volta = TIMP.lerTiming(xmlL, spids);
      ok(
        `timing: round-trip ${tipo} ${direcao}`,
        xmlL.includes(`presetID="22" presetClass="${classe}" presetSubtype="${sub}"`) && xmlL.includes(`filter="${filtro}"`) && JSON.stringify(volta.animacoes) === JSON.stringify(m),
        JSON.stringify([m, volta])
      );
    }
  }
  // Caixa/Círculo/Losango (abre na entrada, fecha na saída): round-trip com filter e subtype 16/32
  for (const [tipo, classe, sub, filtro] of [
    ["caixa", "entr", 16, "box(in)"],
    ["caixaFora", "exit", 32, "box(out)"],
    ["circulo", "entr", 16, "circle(in)"],
    ["circuloFora", "exit", 32, "circle(out)"],
    ["losango", "entr", 16, "diamond(in)"],
    ["losangoFora", "exit", 32, "diamond(out)"],
  ]) {
    const m = [{ forma: "s1", tipo, duracao: 0.5 }];
    const xmlF = TEXP.xmlTiming(m, ids, []);
    const volta = TIMP.lerTiming(xmlF, spids);
    ok(
      `timing: round-trip ${tipo}`,
      xmlF.includes(`presetClass="${classe}" presetSubtype="${sub}"`) && xmlF.includes(`filter="${filtro}"`) && JSON.stringify(volta.animacoes) === JSON.stringify(m),
      JSON.stringify([m, volta])
    );
  }
  // filter/subtype fora do padrão ficam crus
  const limparErrado = TEXP.xmlTiming([{ forma: "s1", tipo: "limpar", direcao: "cima" }], ids, []).replace('filter="wipe(down)"', 'filter="wipe(sideways)"');
  ok("timing: limpar com filter desconhecido fica cru", !TIMP.lerTiming(limparErrado, spids).animacoes);
  // a borda vem do filter (não do subtype): um filter de outra direção volta com a direção dele
  const limparTrocado = TEXP.xmlTiming([{ forma: "s1", tipo: "limpar", direcao: "cima" }], ids, []).replace('filter="wipe(down)"', 'filter="wipe(right)"');
  ok("timing: limpar lê a direção do filter", JSON.stringify(TIMP.lerTiming(limparTrocado, spids).animacoes) === JSON.stringify([{ forma: "s1", tipo: "limpar", duracao: 0.5, direcao: "esquerda" }]));
  const caixaSub = TEXP.xmlTiming([{ forma: "s1", tipo: "caixaFora" }], ids, []).replace('presetSubtype="32"', 'presetSubtype="16"');
  ok("timing: caixa fora com subtype de entrada fica crua", !TIMP.lerTiming(caixaSub, spids).animacoes);

  // Dividir, Persianas, Dissolver e Roda (a variante padrão): round-trip com filter e subtype
  for (const [tipo, classe, preset, sub, filtro] of [
    ["dividir", "entr", 16, 21, "barn(inHorizontal)"],
    ["dividirFora", "exit", 16, 42, "barn(outHorizontal)"],
    ["persianas", "entr", 3, 10, "blinds(horizontal)"],
    ["persianasFora", "exit", 3, 10, "blinds(horizontal)"],
    ["dissolver", "entr", 9, 0, "dissolve"],
    ["dissolverFora", "exit", 9, 0, "dissolve"],
    ["roda", "entr", 21, 1, "wheel(1)"],
    ["rodaFora", "exit", 21, 1, "wheel(1)"],
  ]) {
    const m = [{ forma: "s1", tipo, duracao: 0.5 }];
    const xmlT = TEXP.xmlTiming(m, ids, []);
    const volta = TIMP.lerTiming(xmlT, spids);
    ok(
      `timing: round-trip ${tipo}`,
      xmlT.includes(`presetID="${preset}" presetClass="${classe}" presetSubtype="${sub}"`) && xmlT.includes(`filter="${filtro}"`) && JSON.stringify(volta.animacoes) === JSON.stringify(m),
      JSON.stringify([m, volta])
    );
  }
  // as outras variantes ficam cruas (persianas verticais, roda de dois ponteiros, dividir vertical)
  const persianasV = TEXP.xmlTiming([{ forma: "s1", tipo: "persianas" }], ids, []).replace('filter="blinds(horizontal)"', 'filter="blinds(vertical)"');
  ok("timing: persianas verticais ficam cruas", !TIMP.lerTiming(persianasV, spids).animacoes);
  const roda2 = TEXP.xmlTiming([{ forma: "s1", tipo: "roda" }], ids, []).replace('filter="wheel(1)"', 'filter="wheel(2)"');
  ok("timing: roda de dois ponteiros fica crua", !TIMP.lerTiming(roda2, spids).animacoes);
  const dividirV = TEXP.xmlTiming([{ forma: "s1", tipo: "dividir" }], ids, []).replace('filter="barn(inHorizontal)"', 'filter="barn(inVertical)"');
  ok("timing: dividir na vertical fica cru", !TIMP.lerTiming(dividirV, spids).animacoes);

  // "por parágrafo": um efeito por parágrafo NÃO vazio + bldP build="p"; o importador colapsa de volta
  {
    const forma = (id) => ({
      id,
      kind: "forma",
      box: { x: 0, y: 0, w: 30, h: 20 },
      text: "",
      fontFamily: "Segoe UI",
      fontSize: 18,
      color: "000000",
      bold: false,
      italic: false,
      align: "esquerda",
      fill: "",
      src: "",
      rot: 0,
      name: id,
      geom: "rect",
      paras: [{ runs: [{ text: "Um" }] }, { runs: [] }, { runs: [{ text: "Dois" }] }],
    });
    const f1 = forma("s1");
    const m = [{ forma: "s1", tipo: "surgir", duracao: 0.5, porParagrafo: true }];
    const xmlPP = TEXP.xmlTiming(m, ids, [f1]);
    ok(
      "timing: por parágrafo gera um efeito por parágrafo não vazio",
      (xmlPP.match(/presetID="10"/g) ?? []).length === 2 && xmlPP.includes('<p:pRg st="0" end="0"/>') && xmlPP.includes('<p:pRg st="2" end="2"/>') && !xmlPP.includes('<p:pRg st="1"'),
      xmlPP.slice(0, 300)
    );
    ok("timing: por parágrafo usa bldP build=p", xmlPP.includes('<p:bldP spid="4" grpId="0" build="p"/>') && !xmlPP.includes("animBg"));
    ok("timing: um clique por parágrafo (nodeType)", (xmlPP.match(/nodeType="clickEffect"/g) ?? []).length === 2);
    const parasInfo = new Map([["4", { total: 3, naoVazios: [0, 2] }]]);
    const voltaPP = TIMP.lerTiming(xmlPP, spids, parasInfo);
    ok("timing: build por parágrafo volta colapsado", JSON.stringify(voltaPP.animacoes) === JSON.stringify(m), JSON.stringify([m, voltaPP]));
    // sem o mapa de parágrafos não dá para conferir a cobertura: fica cru
    ok("timing: sem o mapa de parágrafos o build fica cru", !TIMP.lerTiming(xmlPP, spids).animacoes);
    // cobertura diferente (um parágrafo a mais) também fica crua
    const infoErrada = new Map([["4", { total: 3, naoVazios: [0, 1, 2] }]]);
    ok("timing: cobertura diferente fica crua", !TIMP.lerTiming(xmlPP, spids, infoErrada).animacoes);
    // "depois": o segundo parágrafo encadeia (afterEffect)
    const mDepois = [{ forma: "s1", tipo: "aparecer", inicio: "depois", porParagrafo: true }];
    const xmlDepois = TEXP.xmlTiming(mDepois, ids, [f1]);
    ok("timing: build 'depois' encadeia (afterEffect)", xmlDepois.includes('nodeType="afterEffect"') && TIMP.lerTiming(xmlDepois, spids, parasInfo).animacoes?.[0]?.inicio === "depois");
  }
}

// ---------------------------------------------------------------- contrato do despacho da fita
{
  // cada prefixo do despacho precisa bater com o slice usado: um off-by-one aqui
  // faz o botão mandar valor errado (foi assim que "animacao-inicio" e
  // "animacao-duracao" passaram com 17/18 em vez de 16/17)
  const fitaSrc = readFileSync(join(raiz, "src/powerpoint/ui/fita.ts"), "utf8");
  const despachos = [...fitaSrc.matchAll(/cmd\.startsWith\("([a-z-]+):"\)\) this\.hooks\.run\("[a-z-]+", cmd\.slice\((\d+)\)\)/g)];
  ok("fita: os despachos com slice foram encontrados", despachos.length >= 8, `achou ${despachos.length}`);
  for (const [, prefixo, n] of despachos) {
    ok(`fita: slice do prefixo "${prefixo}:"`, Number(n) === prefixo.length + 1, `esperado ${prefixo.length + 1}, veio ${n}`);
  }
}

// ---------------------------------------------------------------- exportação: spid amarrado à forma
const ESC = await empacotar("src/powerpoint/pptxexport/rica.ts", "rica.mjs");
{
  const setup = { aspect: "16:9", theme: "claro", showNumber: false, footer: "", fontFamily: "Segoe UI", fontSize: 18, bg: "" };
  const forma = (id, x) => ({ id, kind: "forma", box: { x, y: 10, w: 30, h: 20 }, text: "", fontFamily: "Segoe UI", fontSize: 18, color: "000000", bold: false, italic: false, align: "esquerda", fill: "", src: "", rot: 0, name: id, geom: "rect" });
  const slide = { md: "", layout: "conteudo", notes: "", shapes: [forma("s1", 10), forma("s2", 50)], animacoes: [{ forma: "s2", tipo: "surgir", duracao: 1 }] };
  const saida = new ESC.Escritor(setup).lamina(slide);
  const spid = saida.ids.s2;
  ok("exportação: o mapa de ids liga a forma ao id do XML", typeof spid === "number" && saida.xml.includes(`<p:cNvPr id="${spid}" name="s2"`), JSON.stringify(saida.ids));
  const comTiming = TEXP.inserirTiming(saida.xml, slide.animacoes, undefined, saida.ids, slide.shapes);
  ok("exportação: o efeito anima o spid certo", comTiming.includes(`<p:spTgt spid="${spid}"/>`), comTiming.slice(comTiming.indexOf("<p:timing")));
  ok("exportação: o p:timing entra antes do fim da lâmina", comTiming.indexOf("<p:timing") < comTiming.indexOf("</p:sld>"));
  ok("exportação: a lâmina sem animação não ganha p:timing", !new ESC.Escritor(setup).lamina({ ...slide, animacoes: undefined }).xml.includes("p:timing"));
}

// ---------------------------------------------------------------- mídia (áudio/vídeo)
const MD = await empacotar("src/powerpoint/edicao/midia.ts", "midia.mjs");
{
  ok("tipo pelo arquivo: vídeo, áudio e desconhecido", MD.tipoDeArquivo("filme.MP4") === "video" && MD.tipoDeArquivo("som.mp3") === "audio" && MD.tipoDeArquivo("nota.txt") === null);
  ok("extensão pelo MIME", MD.extDeMime("video/mp4") === "mp4" && MD.extDeMime("audio/mpeg") === "mp3" && MD.extDeMime("video/webm") === "webm");
  const v = MD.midiaPadrao("video", "aula.mp4");
  const a = MD.midiaPadrao("audio", "trilha.mp3");
  ok("vídeo começa com auto e controles; áudio espera o clique", v.auto === true && v.controles === true && a.auto === false && a.tipo === "audio");
  const n = MD.normalizarMidia({ tipo: "video", volume: 3, corte: { inicio: -2, fim: -1 } });
  ok("normalizar: volume 0-1 e corte coerente", n.volume === 1 && n.corte.inicio === 0 && n.corte.fim >= 0.1, JSON.stringify(n.corte));
  const c = MD.comCorteDaMidia(v, 1.5, 4);
  ok("corte: início e fim guardados", c.corte.inicio === 1.5 && c.corte.fim === 4);
  ok("trecho: fim nulo quando não há corte", MD.trechoDaMidia(v).fim === null && MD.trechoDaMidia(c).inicio === 1.5);
  ok("volume pela porcentagem do painel", MD.comVolumeDaMidia(v, 0.35).volume === 0.35 && MD.comVolumeDaMidia(v, 5).volume === 1);
  ok("opções ligam e desligam", MD.comOpcaoMidia(v, "loop", true).loop === true && MD.comOpcaoMidia(v, "auto", false).auto === false);
  const bx = MD.caixaDaMidia("video", 960, 540);
  ok("caixa do vídeo centrada e dentro da lâmina", bx.x > 0 && bx.y > 0 && bx.x + bx.w < 100 && bx.y + bx.h < 100, JSON.stringify(bx));
}

// ---------------------------------------------------------------- mídia: o desenho na lâmina
const RENDMID = await empacotar("src/powerpoint/render/midia.ts", "rend-midia.mjs");
{
  const formaVideo = {
    id: "v1",
    kind: "imagem",
    box: { x: 10, y: 10, w: 50, h: 40 },
    text: "",
    rot: 0,
    geom: "rect",
    src: "media:v1",
    midia: { tipo: "video", auto: true, controles: true, poster: "data:image/png;base64,QUJD" },
  };
  const html = RENDMID.htmlMidia(formaVideo, { media: {}, editavel: true });
  ok(
    "o vídeo vai direto no quadro (sem o invólucro sem estilo que o encolhia)",
    /data-kind="imagem"[^>]*><video/.test(html) && !html.includes("pp-midia-player"),
    "o vídeo voltaria a cair para o tamanho natural"
  );
  ok("o vídeo preenche o quadro (cover, não contain)", /object-fit:cover/.test(html) && !/object-fit:contain/.test(html));
  ok("a capa do arquivo vai no atributo poster", /poster="data:image\/png/.test(html));
  const htmlPres = RENDMID.htmlMidia(formaVideo, { media: {}, apresentando: true });
  ok("na apresentação o vídeo também preenche o quadro", /object-fit:cover/.test(htmlPres) && /poster="data:image\/png/.test(htmlPres));
  const formaImportada = { ...formaVideo, src: "media:v1", midia: { tipo: "video", auto: true, controles: true, poster: "media:p1" } };
  const htmlImp = RENDMID.htmlMidia(formaImportada, { media: { p1: "data:image/png;base64,QUJD" }, editavel: true });
  ok(
    "a capa de um deck importado é resolvida pelo mapa de mídia (não sai `media:` cru)",
    !htmlImp.includes('poster="media:') && /poster="(data:|blob:)/.test(htmlImp),
    htmlImp.match(/poster="[^"]{0,24}/)?.[0] ?? "sem poster"
  );
  const formaAudio = { ...formaVideo, midia: { tipo: "audio", auto: false, controles: true, poster: "data:image/png;base64,QUJD" }, src: "media:a1" };
  const htmlAudio = RENDMID.htmlMidia(formaAudio, { media: {}, editavel: true });
  ok("o áudio mantém a capa com o player por cima", htmlAudio.includes("pp-midia-capa") && htmlAudio.includes("<audio"));
}

// ---------------------------------------------------------------- mídia: XML do .pptx
const ESCR = await empacotar("src/powerpoint/pptxexport/rica.ts", "rica.mjs");
{
  const setup = {
    aspect: "16:9",
    theme: "claro",
    showNumber: false,
    footer: "",
    fontFamily: "Segoe UI",
    fontSize: 18,
    bg: "",
    media: {
      v1: "data:video/mp4;base64,QUJD",
      a1: "data:audio/mpeg;base64,QUJD",
      p1: "data:image/png;base64,QUJD",
    },
  };
  const formaMidia = (tipo, src, poster) => ({
    id: "mv", kind: "imagem", box: { x: 10, y: 10, w: 50, h: 40 }, text: "", fontFamily: "Segoe UI", fontSize: 16,
    color: "000000", bold: false, italic: false, align: "centro", fill: "", src, rot: 0, geom: "rect",
    midia: { tipo, auto: true, poster },
  });
  const escritor = new ESCR.Escritor(setup);
  const video = escritor.lamina({ md: "", layout: "conteudo", notes: "", shapes: [formaMidia("video", "media:v1", "media:p1")] });
  ok("vídeo: p:pic com videoFile, p14:media e ação de mídia", video.xml.includes("<a:videoFile") && video.xml.includes("p14:media") && video.xml.includes("ppaction://media"));
  ok("vídeo: relações de vídeo, media e imagem para a capa", video.imagens.some((i) => i.tipo === "video") && video.imagens.some((i) => i.tipo === "media") && video.imagens.some((i) => i.tipo === "image"));
  ok("vídeo: arquivo .mp4 em ppt/media", escritor.midias.some((m) => m.ext === "mp4" && m.tipo === "video"));
  const escritor2 = new ESCR.Escritor(setup);
  const audio = escritor2.lamina({ md: "", layout: "conteudo", notes: "", shapes: [formaMidia("audio", "media:a1", "media:p1")] });
  ok("áudio: p:pic com audioFile", audio.xml.includes("<a:audioFile") && audio.imagens.some((i) => i.tipo === "audio"));
  const semCapa = new ESCR.Escritor(setup).lamina({ md: "", layout: "conteudo", notes: "", shapes: [formaMidia("video", "media:v1", undefined)] });
  ok("mídia sem capa não quebra a lâmina", typeof semCapa.xml === "string" && semCapa.xml.includes("<p:sp"));
}

// ---------------------------------------------------------------- fluxo do Mermaid
const MM = await empacotar("src/powerpoint/edicao/mermaid.ts", "mermaid.mjs");
{
  const codigo = [
    "flowchart TD",
    "  %% comentário",
    "  A[Pedido] --> B(Análise)",
    "  A --> C((Orçamento))",
    "  B --> D{Aprovar?}",
    "  C --> D",
    "  D -->|sim| E[Produção]",
    "  D -.-> F[Revisão]",
    "  E --- F",
    "  style A fill:#f00",
  ].join("\n");
  const fluxo = MM.lerFluxoMermaid(codigo);
  ok("fluxo: direção TD", fluxo.direcao === "TD");
  ok("fluxo: 6 nós (comentário e style ficam de fora)", fluxo.nos.length === 6, JSON.stringify(fluxo.nos.map((n) => n.id)));
  ok(
    "fluxo: textos e formas dos nós",
    fluxo.nos.find((n) => n.id === "A").texto === "Pedido" && fluxo.nos.find((n) => n.id === "B").forma === "redondo" && fluxo.nos.find((n) => n.id === "C").forma === "circulo",
    JSON.stringify(fluxo.nos)
  );
  ok(
    "fluxo: 7 arestas, com rótulo e cadeia",
    fluxo.arestas.length === 7 && fluxo.arestas.some((a) => a.de === "D" && a.para === "E" && a.rotulo === "sim"),
    JSON.stringify(fluxo.arestas)
  );
  ok(
    "fluxo: tracejada e sem seta",
    fluxo.arestas.some((a) => a.de === "D" && a.para === "F" && a.tracejada) && fluxo.arestas.some((a) => a.de === "E" && a.para === "F" && a.semSeta)
  );
  const niveis = MM.niveisDoFluxo(fluxo);
  ok("fluxo: níveis (A=0, D=2, E=3)", niveis.get("A") === 0 && niveis.get("D") === 2 && niveis.get("E") === 3, JSON.stringify([...niveis]));

  const estilo = { fonte: "Segoe UI", tamanho: 18, corTexto: "1C212B", acento: "107C41", paleta: [] };
  const formas = MM.fluxoParaFormas(fluxo, dim, estilo);
  const cartoes = formas.filter((f) => f.geom !== "custom");
  const conectores = formas.filter((f) => f.geom === "custom");
  ok("fluxo: um cartão por nó e um conector por aresta", cartoes.length === 6 && conectores.length === 7, `${cartoes.length}/${conectores.length}`);
  ok("fluxo: o conector com desvio sai em curva (quadrática)", conectores.some((c) => c.paths[0].cmds.includes("Q")));
  ok(
    "fluxo: conector normal tem seta e o '---' sai sem",
    conectores.filter((c) => c.ln.tail === "triangle").length === 6 && conectores.some((c) => !c.ln.tail)
  );
  ok("fluxo: conector reto entre cartões alinhados é uma linha", conectores.some((c) => !c.paths[0].cmds.includes("Q")));
  ok("fluxo: tracejada vira traço 'dash'", conectores.some((c) => c.ln.dash === "dash"));
  ok("fluxo: conector sem preenchimento", conectores.every((c) => c.fillX.kind === "none"));
  ok("fluxo: cartões com texto centralizado", cartoes.every((c) => c.paras[0].align === "centro" && c.anchor === "ctr" && c.paras[0].runs[0].text.length > 0));
  ok(
    "fluxo: nada sai da lâmina",
    formas.every((f) => f.box.x >= -0.01 && f.box.y >= -0.01 && f.box.x + f.box.w <= 100.01 && f.box.y + f.box.h <= 100.01),
    JSON.stringify(formas.map((f) => [Math.round(f.box.x), Math.round(f.box.y), Math.round(f.box.w), Math.round(f.box.h)]))
  );
  const setupFluxo = { aspect: "16:9", theme: "claro", showNumber: false, footer: "", fontFamily: "Segoe UI", fontSize: 18, bg: "" };
  const xml = new R.Escritor(setupFluxo).lamina({ md: "", layout: "conteudo", notes: "", shapes: [cartoes[0], conectores[0]] }).xml;
  ok("fluxo: cartão vira roundRect nativo", xml.includes('<a:prstGeom prst="roundRect"'));
  ok(
    "fluxo: conector vai como forma livre, sem preenchimento e com a seta",
    xml.includes("<a:custGeom") && xml.includes("<a:quadBezTo") && xml.includes('<a:tailEnd type="triangle"/>') && xml.includes("<a:noFill/>") && !xml.includes("<a:prstDash")
  );
  const lr = MM.fluxoParaFormas(MM.lerFluxoMermaid("flowchart LR\n A --> B"), dim, estilo);
  const [cartaoA, cartaoB] = lr.filter((f) => f.geom !== "custom");
  ok("fluxo LR: B fica à direita de A", cartaoB.box.x > cartaoA.box.x + cartaoA.box.w - 0.01, JSON.stringify([cartaoA.box, cartaoB.box]));
  ok("fluxo LR: o cartão continua em pé (largura × altura)", cartaoA.box.w > cartaoA.box.h, JSON.stringify(cartaoA.box));
  ok("fluxo: código vazio não gera nada", MM.fluxoParaFormas(MM.lerFluxoMermaid(""), dim, estilo).length === 0);
}

// ---------------------------------------------------------------- roda do mouse: troca de lâmina
const RODA = await empacotar("src/powerpoint/roda-laminas.ts", "roda.mjs");
{
  let relogio = 10_000;
  const trocas = [];
  const roda = RODA.criarRodaDeLaminas({ irPara: (d) => trocas.push(d), agora: () => relogio });
  ok("roda: um gesto para baixo troca para a próxima", roda({ dy: 100, podeRolar: false }) === "trocar" && trocas.join() === "1");
  ok("roda: a inércia do mesmo gesto não passa adiante", roda({ dy: 100, podeRolar: false }) === "segurar" && trocas.length === 1);
  relogio += RODA.ESPERA_DA_TROCA + 40;
  ok("roda: para cima volta uma lâmina", roda({ dy: -100, podeRolar: false }) === "trocar" && trocas.join() === "1,-1");
  relogio += RODA.ESPERA_DA_TROCA + 40;
  ok("roda: com a lâmina ampliada, primeiro rola a tela", roda({ dy: 100, podeRolar: true }) === "rolar" && trocas.length === 2);
  ok("roda: no fim da rolagem o gesto troca", roda({ dy: 100, podeRolar: false }) === "trocar" && trocas.length === 3);
  relogio += RODA.ESPERA_DA_TROCA + 40;
  ok("roda: gesto pequeno (menos que o passo) segura", roda({ dy: 20, podeRolar: false }) === "segurar" && trocas.length === 3);
  ok("roda: dois movimentos pequenos somam o gesto", roda({ dy: 30, podeRolar: false }) === "trocar" && trocas.length === 4);
  relogio += RODA.ESPERA_DA_TROCA + 40;
  roda({ dy: 100, podeRolar: true });
  ok("roda: rolar zera o que estava acumulado", roda({ dy: 30, podeRolar: false }) === "segurar");
  ok("roda: o passo e a espera existem", RODA.PASSO_DA_RODA === 40 && RODA.ESPERA_DA_TROCA === 260);
}

// ---------------------------------------------------------------- desenho assistido: arco girado
const DES = await empacotar("src/powerpoint/edicao/desenho.ts", "desenho2.mjs");
{
  const estDesenho = { fonte: "Segoe UI", tamanho: 18, corTexto: "1C212B", acento: "00B050", paleta: [] };
  const dim = { w: 960, h: 540 };
  const pincel = { cor: "00B050", w: 4, assistente: true };
  const giro = (18 * Math.PI) / 180;
  const pontos = [];
  for (let i = 0; i <= 60; i++) {
    const a = ((120 + (i / 60) * 220) * Math.PI) / 180;
    const x = 170 * Math.cos(a);
    const y = 130 * Math.sin(a);
    pontos.push({
      x: 480 + x * Math.cos(giro) - y * Math.sin(giro) + Math.sin(i * 2.1) * 0.8,
      y: 270 + x * Math.sin(giro) + y * Math.cos(giro) + Math.cos(i * 1.7) * 0.8,
    });
  }
  const forma = DES.formaDoTraco(pontos, pincel, estDesenho, dim);
  ok("desenho: o traço torto sai como arco girado", forma?.geom === "arc" && Math.abs((forma.rot ?? 0) - 18) <= 4, JSON.stringify({ geom: forma?.geom, rot: forma?.rot }));
  const setupDesenho = { aspect: "16:9", theme: "claro", showNumber: false, footer: "", fontFamily: "Segoe UI", fontSize: 18, bg: "" };
  const xml = new R.Escritor(setupDesenho).lamina({ md: "", layout: "conteudo", notes: "", shapes: [forma] }).xml;
  ok("desenho: o arco girado vai no .pptx com rotação e ângulos", /prst="arc"/.test(xml) && /rot="\d+"/.test(xml) && /adj1/.test(xml) && /adj2/.test(xml));
}

console.log(falhas ? `\n${falhas} falha(s)` : "\ntudo certo");
process.exit(falhas ? 1 : 0);
