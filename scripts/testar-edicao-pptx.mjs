// Testa a lógica de edição da apresentação (sem abrir o app): geometria, operações em várias formas e texto.
// Uso: node scripts/testar-edicao-pptx.mjs
import { build } from "esbuild";
import { mkdtempSync } from "node:fs";
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
  const r = M.aplicarModelo(base, de, noite);
  const rT = r[0].shapes[0];
  const rF = r[1].shapes[0];
  const rC = r[2].shapes[0];
  ok("modelo troca a cor do texto e a fonte", rT.color === "F4F5F8" && rT.paras[0].runs[0].color === "F4F5F8" && rT.paras[0].runs[0].font === "Inter" && rT.fontFamily === "Inter");
  ok("modelo troca o acento no preenchimento e no contorno", rF.fill === "818CF8" && rF.fillX.color === "818CF8" && rF.ln.color === "818CF8");
  ok("texto branco da forma de acento continua branco", rF.color === "FFFFFF");
  ok("modelo troca o fundo da lâmina", r[0].bg.color === "151B26");
  ok("cor e fonte próprias ficam como estão", rC.color === "FF0000" && rC.fontFamily === "Consolas");
  ok("aplicar não mexe nas lâminas originais", base[0].shapes[0].color === "1C212B" && base[0].bg.color === "FFFFFF");
  const duas = M.aplicarModelo(r, { theme: "escuro", bg: "151B26", fontFamily: "Inter" }, noite);
  ok("aplicar o mesmo modelo de novo não muda nada", JSON.stringify(duas) === JSON.stringify(r));
  const cont = M.MODELOS.find((m) => m.id === "contraste");
  const rc = M.aplicarModelo(base, de, cont);
  ok("contraste recalculado no texto da forma de acento", rc[1].shapes[0].color === "1C212B" && rc[1].shapes[0].fillX.color === "FFD400");
  const cl = M.MODELOS.find((m) => m.id === "classico");
  const basePapel = [mk([caixa({ fontFamily: "Georgia", paras: [para(run("1C212B", "Georgia"))] })], { kind: "solid", color: "F7F3EA" })];
  const rp = M.aplicarModelo(basePapel, { theme: "claro", bg: "F7F3EA", fontFamily: "Georgia" }, cl);
  ok("fundo e fonte personalizados voltam ao padrão do modelo", rp[0].bg.color === "FFFFFF" && rp[0].shapes[0].fontFamily === "Segoe UI");
  const cel = (color) => ({ paras: [para(run(color, "Segoe UI"))], fill: { kind: "solid", color: "4F46E5" } });
  const tab = [mk([caixa({ id: "tb", tabela: { colunas: [50], linhas: [20], celulas: [[cel("1C212B")]] } })])];
  const rt = M.aplicarModelo(tab, de, noite);
  ok("tabela: texto e preenchimento das células trocam junto", rt[0].shapes[0].tabela.celulas[0][0].paras[0].runs[0].color === "F4F5F8" && rt[0].shapes[0].tabela.celulas[0][0].fill.color === "818CF8");
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
  const aplicado = M.aplicarModelo(padrao, { theme: "claro", bg: "", fontFamily: "Segoe UI" }, modelo);
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

console.log(falhas ? `\n${falhas} falha(s)` : "\ntudo certo");
process.exit(falhas ? 1 : 0);
