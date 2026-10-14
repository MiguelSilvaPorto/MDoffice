// Testa as ligações entre formas (ferramenta Conectar): a rota ortogonal com cantos suaves, a
// divisão em duas partes (espinha com a cor da origem / descida com a cor do destino), o
// redesenho automático quando as caixas se movem e o que acontece ao apagar uma das pontas.
// Uso: node scripts/testar-ligacoes.mjs
import { build } from "esbuild";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const raiz = new URL("..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const tmp = mkdtempSync(join(tmpdir(), "pp-ligacoes-"));
await build({ entryPoints: [join(raiz, "src/powerpoint/edicao/ligacoes.ts")], bundle: true, platform: "node", format: "esm", outfile: join(tmp, "ligacoes.mjs"), logLevel: "error" });
await build({ entryPoints: [join(raiz, "src/powerpoint/edicao/operacoes.ts")], bundle: true, platform: "node", format: "esm", outfile: join(tmp, "operacoes.mjs"), logLevel: "error" });
const L = await import(pathToFileURL(join(tmp, "ligacoes.mjs")).href);
const O = await import(pathToFileURL(join(tmp, "operacoes.mjs")).href);

let falhas = 0;
const ok = (nome, cond, detalhe = "") => {
  if (!cond) falhas++;
  console.log(`${cond ? "OK   " : "FALHA"} ${nome}${detalhe ? "  " + detalhe : ""}`);
};
const perto = (a, b, tol = 0.6) => Math.abs(a - b) <= tol;

const dim = { w: 960, h: 540 };
const est = { fonte: "Segoe UI", tamanho: 18, corTexto: "111111", acento: "2F6F4E", paleta: [] };

/** Forma base (em % da lâmina), com preenchimento/contorno opcionais. */
const forma = (id, x, y, w, h, extra = {}) => ({
  id,
  kind: "forma",
  box: { x, y, w, h },
  text: "",
  fontFamily: "Segoe UI",
  fontSize: 18,
  color: "111111",
  bold: false,
  italic: false,
  align: "centro",
  fill: "",
  src: "",
  rot: 0,
  ...extra,
});
/** Lâmina mínima para os testes. */
const lâmina = (shapes) => ({ id: "s1", md: "", layout: "conteudo", notes: "", shapes });
/** Posição (pt) de um ponto local do caminho dentro da lâmina. */
const emPt = (s, i) => {
  const p = s.paths[0].cmds;
  const x = p[i];
  const y = p[i + 1];
  return { x: (s.box.x / 100) * dim.w + x, y: (s.box.y / 100) * dim.h + y };
};

// ---------------------------------------------------------------- ponto da borda
{
  const r = { x: 100, y: 200, w: 300, h: 100 };
  const base = L.pontoDaBorda(r, "base");
  const esq = L.pontoDaBorda(r, "esq");
  const dir = L.pontoDaBorda(r, "dir");
  const topo = L.pontoDaBorda(r, "topo");
  ok("ponto da borda: base no meio de baixo", perto(base.x, 250) && perto(base.y, 300));
  ok("ponto da borda: topo no meio de cima", perto(topo.x, 250) && perto(topo.y, 200));
  ok("ponto da borda: esquerda no meio da lateral", perto(esq.x, 100) && perto(esq.y, 250));
  ok("ponto da borda: direita no meio da lateral", perto(dir.x, 400) && perto(dir.y, 250));
}

// ---------------------------------------------------------------- rota ortogonal
{
  const z = L.rotaDaLigacao({ x: 250, y: 300 }, "base", { x: 500, y: 400 }, "topo");
  ok("rota vertical: \"Z\" com dois cantos", z.length === 4 && perto(z[1].x, 250) && perto(z[1].y, 350) && perto(z[2].x, 500) && perto(z[2].y, 350), JSON.stringify(z));

  const reta = L.rotaDaLigacao({ x: 250, y: 300 }, "base", { x: 250, y: 400 }, "topo");
  ok("rota alinhada: reta (dois pontos)", reta.length === 2);

  const h = L.rotaDaLigacao({ x: 400, y: 250 }, "dir", { x: 700, y: 250 }, "esq");
  ok("rota horizontal alinhada: reta", h.length === 2);
  const hz = L.rotaDaLigacao({ x: 400, y: 250 }, "dir", { x: 700, y: 320 }, "esq");
  ok("rota horizontal desalinhada: \"Z\" de lado", hz.length === 4 && perto(hz[1].x, 550) && perto(hz[2].x, 550), JSON.stringify(hz));

  const misto = L.rotaDaLigacao({ x: 250, y: 300 }, "base", { x: 500, y: 350 }, "esq");
  ok("rota mista: um \"L\" só (canto na altura do destino)", misto.length === 3 && perto(misto[1].x, 250) && perto(misto[1].y, 350), JSON.stringify(misto));
  const misto2 = L.rotaDaLigacao({ x: 400, y: 250 }, "dir", { x: 500, y: 400 }, "topo");
  ok("rota mista: \"L\" com canto na coluna do destino", misto2.length === 3 && perto(misto2[1].x, 500) && perto(misto2[1].y, 250), JSON.stringify(misto2));
}

// ---------------------------------------------------------------- caminho dividido
{
  const pts = L.rotaDaLigacao({ x: 250, y: 300 }, "base", { x: 500, y: 400 }, "topo");
  const { de: cmdDe, para: cmdPara } = L.caminhoDaLigacao(pts);
  ok("caminho: a espinha existe quando há canto", !!cmdDe && cmdDe[0] === "M");
  ok("caminho: a descida sempre existe", !!cmdPara && cmdPara[0] === "M");
  // continuidade: o fim da espinha é exatamente o começo da descida
  const fimDe = { x: cmdDe[cmdDe.length - 2], y: cmdDe[cmdDe.length - 1] };
  const inicioPara = { x: cmdPara[1], y: cmdPara[2] };
  ok("caminho: as duas partes se encontram no corte (sem fresta)", perto(fimDe.x, inicioPara.x, 0.01) && perto(fimDe.y, inicioPara.y, 0.01), `${JSON.stringify(fimDe)} vs ${JSON.stringify(inicioPara)}`);
  // a curva do ÚLTIMO canto pertence à descida (a cor troca ali)
  ok("caminho: a curva do canto final fica na descida", cmdPara.includes("Q") && !String(fimDe.y).includes("Q"));
  ok("caminho: a espinha leva a curva dos cantos anteriores", cmdDe.includes("Q"));
  // a descida termina no ponto de chegada
  ok("caminho: a descida termina no destino", perto(cmdPara[cmdPara.length - 2], 500, 0.01) && perto(cmdPara[cmdPara.length - 1], 400, 0.01));

  const reto = L.caminhoDaLigacao([{ x: 250, y: 300 }, { x: 250, y: 400 }]);
  ok("caminho reto: só existe a descida", reto.de === null && reto.para[0] === "M" && reto.para.length === 6, JSON.stringify(reto));
}

// ---------------------------------------------------------------- cor da caixa
{
  ok("cor da caixa: usa o preenchimento", L.corDaForma(forma("a", 0, 0, 10, 10, { fillX: { kind: "solid", color: "2F6F4E" } })) === "2F6F4E");
  ok("cor da caixa: preenchimento branco cai no contorno", L.corDaForma(forma("a", 0, 0, 10, 10, { fillX: { kind: "solid", color: "FFFFFF" }, ln: { color: "1F5FA8" } })) === "1F5FA8");
  ok("cor da caixa: caixa branca de borda clara não tem cor", L.corDaForma(forma("a", 0, 0, 10, 10, { fillX: { kind: "solid", color: "FDFDFD" }, ln: { color: "E8E8E8" } })) === "");
  ok("cor da caixa: forma vazia não tem cor", L.corDaForma(forma("a", 0, 0, 10, 10)) === "");
  ok("cor da caixa: gradiente usa a primeira parada", L.corDaForma(forma("a", 0, 0, 10, 10, { fillX: { kind: "gradient", stops: [{ color: "8B3F2A" }] } })) === "8B3F2A");
}

// ---------------------------------------------------------------- criação da ligação
{
  const origem = forma("a", 10, 10, 30, 10, { fillX: { kind: "solid", color: "2F6F4E" } });
  const destino = forma("b", 50, 40, 20, 10, { fillX: { kind: "solid", color: "1F5FA8" } });
  const formas = L.ligacaoParaFormas(origem, "base", destino, "topo", dim, est);

  ok("ligação: duas partes (espinha + descida)", formas.length === 2);
  ok("ligação: a espinha sai com a cor da origem", formas[0].liga.parte === "a" && formas[0].ln.color === "2F6F4E");
  ok("ligação: a descida sai com a cor do destino e com a seta", formas[1].liga.parte === "b" && formas[1].ln.color === "1F5FA8" && formas[1].ln.tail === "triangle");
  ok("ligação: a espinha não leva seta", !formas[0].ln.tail);
  ok("ligação: as partes ficam presas às duas formas", formas[0].liga.de === "a" && formas[0].liga.ladoDe === "base" && formas[0].liga.para === "b" && formas[0].liga.ladoPara === "topo");
  ok("ligação: as partes andam juntas (mesmo grupo)", !!formas[0].grupo && formas[0].grupo === formas[1].grupo && formas[0].liga.grupo === formas[0].grupo);
  ok("ligação: o traço tem cantos e pontas arredondados", formas[0].ln.join === "round" && formas[0].ln.cap === "round");
  ok("ligação: sem preenchimento (só o traço)", formas[0].fillX.kind === "none");

  // a descida termina exatamente no ponto de chegada (topo do destino = 60% da lâmina, x 600pt)
  const fim = emPt(formas[1], formas[1].paths[0].cmds.length - 2);
  ok("ligação: a seta chega no ponto escolhido do destino", perto(fim.x, 60 / 100 * dim.w, 0.6) && perto(fim.y, 40 / 100 * dim.h, 0.6), `${JSON.stringify(fim)}`);

  // caixa branca no destino: a descida segue a cor da origem
  const branca = forma("c", 50, 40, 20, 10, { fillX: { kind: "solid", color: "FFFFFF" }, ln: { color: "EDEDED" } });
  const formas2 = L.ligacaoParaFormas(origem, "base", branca, "topo", dim, est);
  ok("ligação para caixa sem cor: a descida segue a cor da origem", formas2[1].ln.color === "2F6F4E");

  // ligação reta: só uma parte (a descida), sem espinha
  const alinhada = forma("d", 20, 40, 10, 10, { fillX: { kind: "solid", color: "1F5FA8" } });
  const reta = L.ligacaoParaFormas(origem, "base", alinhada, "topo", dim, est);
  ok("ligação reta: uma parte só (a descida)", reta.length === 1 && reta[0].liga.parte === "b" && reta[0].ln.tail === "triangle");
}

// ---------------------------------------------------------------- o conector segue as caixas
{
  const origem = forma("a", 10, 10, 30, 10, { fillX: { kind: "solid", color: "2F6F4E" } });
  const destino = forma("b", 50, 40, 20, 10, { fillX: { kind: "solid", color: "1F5FA8" } });
  const partes = L.ligacaoParaFormas(origem, "base", destino, "topo", dim, est);
  const slide = lâmina([origem, destino, ...partes]);

  const sem = lâmina([origem, destino]);
  ok("sem ligações: nada é recalculado", L.atualizarLigacoes(sem, dim, est.acento) === sem);

  // mover a origem: a descida se redesenha (e continua sendo a mesma forma, mesmo id)
  const movida = { ...origem, box: { ...origem.box, x: origem.box.x + 12, y: origem.box.y + 4 } };
  const s2 = L.atualizarLigacoes(lâmina([movida, destino, ...partes]), dim, est.acento);
  const b2 = s2.shapes.find((s) => s.liga?.parte === "b");
  const b1 = partes[1];
  ok("mover a caixa: o conector se redesenha", !!b2 && b2.id === b1.id && (b2.box.x !== b1.box.x || b2.box.y !== b1.box.y));
  ok("mover a caixa: as outras formas ficam intactas", s2.shapes.find((s) => s.id === "b") === destino);
  ok("mover a caixa: a cor do trecho continua a da caixa", b2.ln.color === "1F5FA8");

  // redimensionar o destino: a chegada acompanha a nova borda
  const esticado = { ...destino, box: { ...destino.box, w: 30, h: 16 } };
  const s3 = L.atualizarLigacoes(lâmina([origem, esticado, ...partes]), dim, est.acento);
  const b3 = s3.shapes.find((s) => s.liga?.parte === "b");
  const fim3 = emPt(b3, b3.paths[0].cmds.length - 2);
  ok("redimensionar: a ligação segue a nova borda", perto(fim3.y, 40 / 100 * dim.h, 0.6), `${JSON.stringify(fim3)}`);

  // apagar o destino leva a ligação inteira junto
  const s4 = L.atualizarLigacoes(lâmina([origem, ...partes]), dim, est.acento);
  ok("apagar a caixa: a ligação vai junto", !s4.shapes.some((s) => s.liga) && s4.shapes.length === 1);

  // apagar uma parte da ligação não derruba a outra (a outra continua presa)
  const s5 = L.atualizarLigacoes(lâmina([origem, destino, partes[1]]), dim, est.acento);
  ok("meia ligação: a parte que sobrou continua seguindo a caixa", s5.shapes.length === 3 && s5.shapes[2].liga.parte === "b");
}

// ---------------------------------------------------------------- copiar e colar
{
  const origem = forma("a", 10, 10, 30, 10, { fillX: { kind: "solid", color: "2F6F4E" } });
  const destino = forma("b", 50, 40, 20, 10, { fillX: { kind: "solid", color: "1F5FA8" } });
  const partes = L.ligacaoParaFormas(origem, "base", destino, "topo", dim, est);

  // copiar as duas caixas + a ligação: a cópia fica presa nas CÓPIAS
  const tudo = O.clonarFormas([origem, destino, ...partes]);
  const novoA = tudo[0];
  const novoB = tudo[1];
  const ligaCopia = tudo.find((s) => s.liga);
  ok("duplicar tudo: a cópia fica presa nas formas copiadas", ligaCopia.liga.de === novoA.id && ligaCopia.liga.para === novoB.id);
  ok("duplicar tudo: o grupo da cópia é novo", ligaCopia.grupo !== partes[0].grupo && ligaCopia.liga.grupo === ligaCopia.grupo);

  // copiar só o conector: ele perde o grude (vira um traço solto, com o desenho que tinha)
  const solto = O.clonarFormas([partes[1]])[0];
  ok("duplicar só o conector: ele deixa de ficar preso", !solto.liga && !!solto.paths?.length);
}

// ---------------------------------------------------------------- alvo do modo Conectar

console.log("\nalvo do modo Conectar (a bolinha manda; a caixa de cima vence; sem piscar)");

{
  // duas caixas SOBREPOSTAS: `a` embaixo, `b` em cima (a lista vem na ordem de pintura)
  const a = { id: "a", box: { x: 10, y: 10, w: 40, h: 30 } };
  const b = { id: "b", box: { x: 20, y: 20, w: 40, h: 30 } };
  const formas = [a, b];
  const rx = 0.85; // ~8 px de raio da bolinha num slide de 960 de largura
  const ry = 1.5; // ~8 px num slide de 540 de altura
  const mx = 1.5; // histerese, ~14 px
  const my = 2.6;
  const alvo = (x, y, atual = null) => L.alvoDaConexao(formas, { x, y }, atual, rx, ry, mx, my);

  ok("no miolo das duas, a caixa de CIMA ganha", alvo(30, 30) === "b", String(alvo(30, 30)));
  ok("na parte de baixo, só a de baixo aparece", alvo(15, 35) === "a", String(alvo(15, 35)));
  // a bolinha do meio da base de `a` fica em (30, 40): ~1,5 px FORA da caixa dela e DENTRO de `b`
  // (pelo DOM o alvo virava `b` → as bolinhas piscavam e a ligação saía na caixa errada)
  ok("a bolinha da caixa de baixo não é roubada pela de cima", alvo(30, 41.2) === "a", String(alvo(30, 41.2)));
  // a bolinha do topo de `b` (40, 20) pende para fora da caixa dela, dentro de `a`: manda `b`
  ok("a bolinha de cima manda mesmo fora da caixa dela", alvo(40, 19) === "b", String(alvo(40, 19)));
  // a fresta em volta da caixa continua sendo dela (histerese): 1% fora, longe das bolinhas
  ok("perto da caixa, o alvo não pisca (histerese)", alvo(9, 30, "a") === "a", String(alvo(9, 30, "a")));
  ok("longe de tudo, solta o alvo", alvo(5, 30, "a") === null, String(alvo(5, 30, "a")));
  // e o clique usa a bolinha separada (com folga) e devolve o LADO
  const bol = L.bolinhaDaConexao(formas, { x: 30, y: 41.2 }, rx, ry);
  ok("a bolinha do clique devolve a caixa e o lado", bol?.id === "a" && bol?.lado === "base", JSON.stringify(bol));
  ok("fora das bolinhas, o clique não pega nada", L.bolinhaDaConexao(formas, { x: 30, y: 30 }, rx, ry) === null);
}

console.log(falhas ? `\n${falhas} falha(s)` : "\ntudo certo");
process.exit(falhas ? 1 : 0);
