// Testa as ligações entre formas (ferramenta Conectar): a rota ortogonal com cantos suaves, o
// traço em GRADIENTE da cor da origem até a do destino (uma forma só), o redesenho automático
// quando as caixas se movem, a junção das metades antigas e o que acontece ao apagar uma das pontas.
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
await build({ entryPoints: [join(raiz, "src/powerpoint/pptxexport/rica.ts")], bundle: true, platform: "node", format: "esm", outfile: join(tmp, "rica.mjs"), logLevel: "error" });
const L = await import(pathToFileURL(join(tmp, "ligacoes.mjs")).href);
const O = await import(pathToFileURL(join(tmp, "operacoes.mjs")).href);
const R = await import(pathToFileURL(join(tmp, "rica.mjs")).href);

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

// ---------------------------------------------------------------- o caminho inteiro
{
  const pts = L.rotaDaLigacao({ x: 250, y: 300 }, "base", { x: 500, y: 400 }, "topo");
  const cmds = L.caminhoDaLigacao(pts);
  ok("caminho: começa na origem", cmds[0] === "M" && perto(cmds[1], 250, 0.01) && perto(cmds[2], 300, 0.01), JSON.stringify(cmds));
  ok("caminho: termina no destino", perto(cmds[cmds.length - 2], 500, 0.01) && perto(cmds[cmds.length - 1], 400, 0.01));
  ok("caminho: uma curva por canto (Q)", cmds.filter((c) => c === "Q").length === 2, JSON.stringify(cmds));
  // não há mais corte de cor: o caminho é UM só, com a curva do último canto incluída
  ok("caminho: a curva do canto final entra no mesmo traço", cmds[cmds.length - 8] === "Q", JSON.stringify(cmds.slice(-8)));

  const reto = L.caminhoDaLigacao([{ x: 250, y: 300 }, { x: 250, y: 400 }]);
  ok("caminho reto: um M e um L (sem curva)", reto.length === 6 && reto[0] === "M" && reto[3] === "L", JSON.stringify(reto));
}

// ---------------------------------------------------------------- cor da caixa
{
  ok("cor da caixa: usa o preenchimento", L.corDaForma(forma("a", 0, 0, 10, 10, { fillX: { kind: "solid", color: "2F6F4E" } })) === "2F6F4E");
  ok("cor da caixa: preenchimento branco cai no contorno", L.corDaForma(forma("a", 0, 0, 10, 10, { fillX: { kind: "solid", color: "FFFFFF" }, ln: { color: "1F5FA8" } })) === "1F5FA8");
  ok("cor da caixa: caixa branca de borda clara não tem cor", L.corDaForma(forma("a", 0, 0, 10, 10, { fillX: { kind: "solid", color: "FDFDFD" }, ln: { color: "E8E8E8" } })) === "");
  ok("cor da caixa: forma vazia não tem cor", L.corDaForma(forma("a", 0, 0, 10, 10)) === "");
  ok("cor da caixa: gradiente de duas paradas usa a primeira", L.corDaForma(forma("a", 0, 0, 10, 10, { fillX: { kind: "gradient", stops: [{ pos: 0, color: "8B3F2A" }, { pos: 100, color: "112233" }] } })) === "8B3F2A");
  ok(
    "cor da caixa: numa rampa de 3 tons vale a cor-base (a do meio)",
    L.corDaForma(forma("a", 0, 0, 10, 10, { fillX: { kind: "gradient", stops: [{ pos: 0, color: "32CC67" }, { pos: 45, color: "1F9D55" }, { pos: 100, color: "0E5746" }] } })) === "1F9D55"
  );
}

// ---------------------------------------------------------------- criação da ligação
{
  const origem = forma("a", 10, 10, 30, 10, { fillX: { kind: "solid", color: "2F6F4E" } });
  const destino = forma("b", 50, 40, 20, 10, { fillX: { kind: "solid", color: "1F5FA8" } });
  const formas = L.ligacaoParaFormas(origem, "base", destino, "topo", dim, est);
  const f = formas[0];

  ok("ligação: uma forma só (o traço inteiro)", formas.length === 1);
  ok(
    "ligação: o traço é o gradiente da origem ao destino",
    !!f.ln.grad && f.ln.grad.stops[0].color === "2F6F4E" && f.ln.grad.stops[1].color === "1F5FA8",
    JSON.stringify(f.ln.grad)
  );
  ok("ligação: as paradas vão de 0% a 100%", f.ln.grad.stops[0].pos === 0 && f.ln.grad.stops[1].pos === 100);
  ok("ligação: a seta fica na cor do destino", f.ln.tail === "triangle" && f.ln.color === "1F5FA8");
  ok("ligação: fica presa às duas formas", f.liga.de === "a" && f.liga.ladoDe === "base" && f.liga.para === "b" && f.liga.ladoPara === "topo");
  ok("ligação: o grupo identifica a ligação", !!f.grupo && f.liga.grupo === f.grupo);
  ok("ligação: o traço tem cantos e pontas arredondados", f.ln.join === "round" && f.ln.cap === "round");
  ok("ligação: sem preenchimento (só o traço)", f.fillX.kind === "none");

  // a seta chega exatamente no ponto escolhido do destino (topo = 40% da lâmina, x 60% = 576pt)
  const fim = emPt(f, f.paths[0].cmds.length - 2);
  ok("ligação: a seta chega no ponto escolhido do destino", perto(fim.x, 60 / 100 * dim.w, 0.6) && perto(fim.y, 40 / 100 * dim.h, 0.6), `${JSON.stringify(fim)}`);

  // o ângulo é o do TRECHO MAIS LONGO da rota, no sentido do fluxo (num cotovelo, a reta
  // origem→destino é uma diagonal que não corresponde ao caminho: o trecho comprido começaria no
  // meio da mistura e a transição se concentraria no fim)
  const pDe = L.pontoDaBorda({ x: 0.1 * dim.w, y: 0.1 * dim.h, w: 0.3 * dim.w, h: 0.1 * dim.h }, "base");
  const pPara = L.pontoDaBorda({ x: 0.5 * dim.w, y: 0.4 * dim.h, w: 0.2 * dim.w, h: 0.1 * dim.h }, "topo");
  const rota = L.rotaDaLigacao(pDe, "base", pPara, "topo");
  ok("ligação: o ângulo é o do trecho mais longo da rota", perto(f.ln.grad.angle, L.anguloDaLigacao(rota), 0.01), `${f.ln.grad.angle} vs ${L.anguloDaLigacao(rota)}`);
  ok("ligação: no \"Z\" do teste o trecho principal é o horizontal (0°)", perto(f.ln.grad.angle, 0, 0.01), `${f.ln.grad.angle}`);
  ok("ligação: o ângulo nunca é negativo (o `a:lin` do .pptx não aceita)", f.ln.grad.angle >= 0 && f.ln.grad.angle < 360);

  // o cotovelo do relato: sai pela direita da caixa de cima, desce um trecho comprido e entra por
  // cima na caixa de baixo — o eixo tem de seguir a DESCIDA (90°), não a diagonal
  const alta = forma("d", 10, 10, 30, 10, { fillX: { kind: "solid", color: "2F6F4E" } });
  const baixa = forma("e", 50, 60, 20, 10, { fillX: { kind: "solid", color: "1F5FA8" } });
  const fe = L.ligacaoParaFormas(alta, "direita", baixa, "topo", dim, est)[0];
  ok("ligação em cotovelo: o eixo segue o trecho mais longo (a descida), não a diagonal", perto(fe.ln.grad.angle, 90, 0.01), `${fe.ln.grad.angle}`);
  ok(
    "ligação em cotovelo: a cor sai da origem e chega no destino",
    fe.ln.grad.stops[0].color === "2F6F4E" && fe.ln.grad.stops[1].color === "1F5FA8",
    JSON.stringify(fe.ln.grad.stops)
  );
  // o mesmo cotovelo de baixo para cima, com a descida/subida ainda sendo o trecho longo: o eixo
  // vira (270°) para continuar apontando no fluxo
  const baixa2 = forma("f", 20, 80, 20, 10, { fillX: { kind: "solid", color: "1F5FA8" } });
  const alta2 = forma("g", 10, 10, 30, 10, { fillX: { kind: "solid", color: "2F6F4E" } });
  const volta = L.ligacaoParaFormas(baixa2, "direita", alta2, "base", dim, est)[0];
  ok("ligação em cotovelo: subindo, o eixo aponta para cima (270°)", perto(volta.ln.grad.angle, 270, 0.01), `${volta.ln.grad.angle}`);
  ok("ligação em cotovelo: as paradas continuam origem → destino", volta.ln.grad.stops[0].color === "1F5FA8" && volta.ln.grad.stops[1].color === "2F6F4E");

  // caixa branca no destino: sem gradiente, o traço fica na cor da origem
  const branca = forma("c", 50, 40, 20, 10, { fillX: { kind: "solid", color: "FFFFFF" }, ln: { color: "EDEDED" } });
  const f2 = L.ligacaoParaFormas(origem, "base", branca, "topo", dim, est)[0];
  ok("ligação para caixa sem cor: traço sólido na cor da origem", !f2.ln.grad && f2.ln.color === "2F6F4E");

  // cores iguais: sólido (sem gradiente à toa)
  const igual = forma("d", 50, 40, 20, 10, { fillX: { kind: "solid", color: "2F6F4E" } });
  const f3 = L.ligacaoParaFormas(origem, "base", igual, "topo", dim, est)[0];
  ok("cores iguais: traço sólido, sem gradiente", !f3.ln.grad && f3.ln.color === "2F6F4E");

  // a ligação de uma caixa estilizada sai na cor-base — e não no tom claro da ponta da rampa
  const estilizada = forma("a", 10, 10, 30, 10, { fillX: { kind: "gradient", stops: [{ pos: 0, color: "32CC67" }, { pos: 45, color: "1F9D55" }, { pos: 100, color: "0E5746" }] } });
  const alvo = forma("b", 50, 40, 20, 10, { fillX: { kind: "solid", color: "1F5FA8" } });
  const lig = L.ligacaoParaFormas(estilizada, "base", alvo, "topo", dim, est)[0];
  ok("ligação de caixa estilizada: o gradiente sai da cor-base da rampa", lig.ln.grad.stops[0].color === "1F9D55", lig.ln.grad.stops[0].color);

  // ligação reta: continua uma forma só (o caminho inteiro, sem curva)
  const alinhada = forma("e", 20, 40, 10, 10, { fillX: { kind: "solid", color: "1F5FA8" } });
  const reta = L.ligacaoParaFormas(origem, "base", alinhada, "topo", dim, est);
  ok("ligação reta: uma forma só", reta.length === 1 && reta[0].paths[0].cmds.length === 6);
}

// ---------------------------------------------------------------- o conector segue as caixas
{
  const origem = forma("a", 10, 10, 30, 10, { fillX: { kind: "solid", color: "2F6F4E" } });
  const destino = forma("b", 50, 40, 20, 10, { fillX: { kind: "solid", color: "1F5FA8" } });
  const partes = L.ligacaoParaFormas(origem, "base", destino, "topo", dim, est);
  const slide = lâmina([origem, destino, ...partes]);

  const sem = lâmina([origem, destino]);
  ok("sem ligações: nada é recalculado", L.atualizarLigacoes(sem, dim, est.acento) === sem);

  // mover a origem: o conector se redesenha (e continua sendo a mesma forma, mesmo id)
  const movida = { ...origem, box: { ...origem.box, x: origem.box.x + 12, y: origem.box.y + 4 } };
  const s2 = L.atualizarLigacoes(lâmina([movida, destino, ...partes]), dim, est.acento);
  const c1 = partes[0];
  const c2 = s2.shapes.find((s) => s.liga);
  ok("mover a caixa: o conector se redesenha", !!c2 && c2.id === c1.id && (c2.box.x !== c1.box.x || c2.box.y !== c1.box.y));
  ok("mover a caixa: as outras formas ficam intactas", s2.shapes.find((s) => s.id === "b") === destino);
  ok("mover a caixa: o gradiente continua derivado das caixas", c2.ln.grad.stops[0].color === "2F6F4E" && c2.ln.grad.stops[1].color === "1F5FA8");
  ok("mover a caixa: o conector não se multiplica", s2.shapes.filter((s) => s.liga).length === 1);

  // redimensionar o destino: a chegada acompanha a nova borda
  const esticado = { ...destino, box: { ...destino.box, w: 30, h: 16 } };
  const s3 = L.atualizarLigacoes(lâmina([origem, esticado, ...partes]), dim, est.acento);
  const c3 = s3.shapes.find((s) => s.liga);
  const fim3 = emPt(c3, c3.paths[0].cmds.length - 2);
  ok("redimensionar: a ligação segue a nova borda", perto(fim3.y, 40 / 100 * dim.h, 0.6), `${JSON.stringify(fim3)}`);

  // apagar o destino leva a ligação inteira junto
  const s4 = L.atualizarLigacoes(lâmina([origem, ...partes]), dim, est.acento);
  ok("apagar a caixa: a ligação vai junto", !s4.shapes.some((s) => s.liga) && s4.shapes.length === 1);

  // documento ANTIGO (a ligação salva em duas metades): o recálculo junta numa forma só
  const metadeA = { ...c1, liga: { ...c1.liga, parte: "a" } };
  const metadeB = { ...c1, id: "ligacao-b", liga: { ...c1.liga, parte: "b" } };
  const s5 = L.atualizarLigacoes(lâmina([origem, destino, metadeA, metadeB]), dim, est.acento);
  const ligas = s5.shapes.filter((s) => s.liga);
  ok("documento antigo: as duas metades viram uma forma só", ligas.length === 1, `${ligas.length}`);
  ok("documento antigo: fica a de baixo (a espinha) com o gradiente refeito", ligas[0]?.id === c1.id && ligas[0]?.ln.grad?.stops?.[0]?.color === "2F6F4E");
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
  const solto = O.clonarFormas([partes[0]])[0];
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

// ---------------------------------------------------------------- o XML do .pptx (linha em gradiente)
{
  const origem = forma("a", 10, 10, 30, 10, { fillX: { kind: "solid", color: "2F6F4E" } });
  const destino = forma("b", 50, 40, 20, 10, { fillX: { kind: "solid", color: "1F5FA8" } });
  const lig = L.ligacaoParaFormas(origem, "base", destino, "topo", dim, est)[0];
  const setup = { aspect: "16:9", theme: "claro", showNumber: false, footer: "", fontFamily: "Segoe UI", fontSize: 18, bg: "" };
  const xml = new R.Escritor(setup).lamina(lâmina([origem, destino, lig])).xml;
  // o `<a:ln>` da ligação é o que tem o gradiente (as caixas sem contorno saem com `<a:noFill/>`;
  // o `(?:\s[^>]*)?` é para não casar com `<a:lnTo>` da geometria)
  const lns = [...xml.matchAll(/<a:ln(?:\s[^>]*)?>([\s\S]*?)<\/a:ln>/g)].map((m) => m[1]);
  const linha = lns.find((l) => l.includes("a:gradFill")) ?? "";
  ok("pptx: o `a:ln` da ligação leva `a:gradFill`", !!linha, `${lns.length} contornos na lâmina`);
  ok(
    "pptx: as paradas vão da cor da origem (0%) à do destino (100%)",
    /<a:gs pos="0"><a:srgbClr val="2F6F4E"\/><\/a:gs>/.test(linha) && /<a:gs pos="100000"><a:srgbClr val="1F5FA8"\/><\/a:gs>/.test(linha),
    linha.slice(0, 160)
  );
  ok("pptx: o eixo é o mesmo ângulo do modelo (`a:lin`)", /<a:lin ang="\d+" scaled="0"\/>/.test(linha));
  ok("pptx: a seta continua no fim (`a:tailEnd`)", /<a:tailEnd type="triangle"\/>/.test(linha));

  // cores iguais: o MESMO conector sai sólido (sem `a:gradFill`)
  const igual = forma("d", 50, 40, 20, 10, { fillX: { kind: "solid", color: "2F6F4E" } });
  const ligIgual = L.ligacaoParaFormas(origem, "base", igual, "topo", dim, est)[0];
  const xml2 = new R.Escritor(setup).lamina(lâmina([origem, igual, ligIgual])).xml;
  ok(
    "pptx: ligação de cores iguais sai sólida (`a:solidFill`, sem `a:gradFill`)",
    /<a:ln[^>]*><a:solidFill><a:srgbClr val="2F6F4E"\/><\/a:solidFill>/.test(xml2) && !/a:gradFill/.test(xml2)
  );
}

console.log(falhas ? `\n${falhas} falha(s)` : "\ntudo certo");
process.exit(falhas ? 1 : 0);
