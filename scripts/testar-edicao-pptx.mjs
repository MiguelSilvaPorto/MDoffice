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

console.log(falhas ? `\n${falhas} falha(s)` : "\ntudo certo");
process.exit(falhas ? 1 : 0);
