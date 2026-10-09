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

console.log(falhas ? `\n${falhas} falha(s)` : "\ntudo certo");
process.exit(falhas ? 1 : 0);
