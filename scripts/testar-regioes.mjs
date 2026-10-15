// Testa as REGIÕES do Estúdio (fase 2): o mapa dos contornos da lâmina.
//
//   1) o contorno em polígono de cada geometria (retângulo, cantos arredondados, elipse, triângulo,
//      rotação) e os testes de ponto/área;
//   2) a árvore de contenção e as faces: o cartão com o logo e o texto (o caso do usuário), a rua
//      entre duas boxes, o aninhamento fundo e as formas que se cruzam;
//   3) a fiação do modo Regiões no Estúdio (a fita, o palco e o CSS).
//
// Uso: node scripts/testar-regioes.mjs
import { build } from "esbuild";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const raiz = new URL("..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const tmp = mkdtempSync(join(tmpdir(), "pp-regioes-"));
const empacotar = async (entrada, saida) => {
  await build({ entryPoints: [join(raiz, entrada)], bundle: true, platform: "node", format: "esm", outfile: join(tmp, saida), logLevel: "error" });
  return import(pathToFileURL(join(tmp, saida)).href);
};

let falhas = 0;
const ok = (nome, cond, detalhe = "") => {
  if (!cond) falhas++;
  console.log(`${cond ? "OK   " : "FALHA"} ${nome}${detalhe ? "  " + detalhe : ""}`);
};
const ler = (rel) => readFileSync(join(raiz, rel), "utf8");

const R = await empacotar("src/powerpoint/edicao/regioes.ts", "regioes.mjs");
const { poligonoDaForma, poligonoDoPalco, areaDoPoligono, pontoDentro, regioesDa, regiaoEm, caminhoDaRegiao } = R;

/** A lâmina 16:9 do app: 960 × 540 pt (o mesmo `dim` do motor). */
const D = { w: 960, h: 540 };
const mk = (extra = {}) => ({
  id: "f1",
  kind: "forma",
  box: { x: 10, y: 10, w: 80, h: 80 },
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
  ...extra,
});
/** Cartão de 10..90% (96..864 × 54..486): 768 × 432 pt — o cartão do print do usuário. */
const CARTAO = mk({ id: "card", box: { x: 10, y: 10, w: 80, h: 80 } });
const PT = (px, py) => ({ x: px, y: py });

// ---------------------------------------------------------------- 1) contornos

console.log("o contorno em polígono");
{
  const ret = poligonoDaForma(CARTAO, D);
  ok("o retângulo são quatro cantos", ret.length === 4 && ret[0].x === 96 && ret[0].y === 54, JSON.stringify(ret));
  ok("a área do retângulo é a da caixa", areaDoPoligono(ret) === 768 * 432, String(areaDoPoligono(ret)));
  ok("e o ponto médio está dentro", pontoDentro(PT(480, 270), ret) === true);
  ok("e um ponto fora não está", pontoDentro(PT(20, 20), ret) === false);

  const redondo = poligonoDaForma(mk({ cantos: [20, 20, 20, 20] }), D);
  ok("o retângulo arredondado é amostrado em mais cantos", redondo.length > 4, `${redondo.length} pontos`);
  ok("e a área é menor que a do retângulo", areaDoPoligono(redondo) < 768 * 432);
  // com raio de 86,4 pt, o canto (106, 64) fica FORA do arco — é o canto que o raio corta
  ok("o canto cortado pelo raio fica fora", pontoDentro(PT(106, 64), redondo) === false);
  ok("e o miolo continua dentro", pontoDentro(PT(480, 270), redondo) === true);

  const elipse = poligonoDaForma(mk({ geom: "ellipse", box: { x: 10, y: 10, w: 80, h: 80 } }), D);
  const areaElipse = areaDoPoligono(elipse);
  const esperada = Math.PI * 384 * 216;
  ok("a elipse amostrada chega perto da área teórica (π·rx·ry)", Math.abs(areaElipse - esperada) / esperada < 0.02, `${Math.round(areaElipse)} de ${Math.round(esperada)}`);
  ok("e o canto da caixa fica fora dela", pontoDentro(PT(110, 65), elipse) === false);

  const tri = poligonoDaForma(mk({ geom: "triangle" }), D);
  ok("o triângulo são três pontos (ápice no meio do topo)", tri.length === 3 && tri[0].x === 480 && tri[0].y === 54);
  ok("a área do triângulo é metade da caixa", Math.abs(areaDoPoligono(tri) - (768 * 432) / 2) < 0.01);

  const girado = poligonoDaForma(mk({ box: { x: 30, y: 30, w: 40, h: 40 }, rot: 45 }), D);
  const reto = poligonoDaForma(mk({ box: { x: 30, y: 30, w: 40, h: 40 } }), D);
  ok(
    "a rotação gira os pontos (e a área não muda além do arredondamento)",
    Math.abs(areaDoPoligono(girado) - areaDoPoligono(reto)) / areaDoPoligono(reto) < 0.001,
    `${Math.round(areaDoPoligono(girado))} contra ${Math.round(areaDoPoligono(reto))}`
  );
  ok("o canto girado 45° fica fora do retângulo original", pontoDentro(PT(288 + 2, 432 + 2), girado) === false, JSON.stringify(girado[0]));
  ok("e o polígono girado continua com quatro cantos", girado.length === 4, `${girado.length} pontos`);

  ok("a linha não tem contorno (não tem área)", poligonoDaForma(mk({ geom: "line" }), D) === null);
  ok("o palco é a lâmina inteira", areaDoPoligono(poligonoDoPalco(D)) === 960 * 540);
}

// ---------------------------------------------------------------- 2) as faces

console.log("\nO CASO DO USUÁRIO: o cartão com o logo e o texto dentro");
{
  const logo = mk({ id: "logo", geom: "ellipse", box: { x: 35, y: 15, w: 30, h: 30 } });
  const nome = mk({ id: "nome", kind: "texto", box: { x: 30, y: 55, w: 40, h: 15 } });
  const regioes = regioesDa([CARTAO, logo, nome], D, (s) => (s.id === "logo" ? "Logo" : s.id === "nome" ? "Nome" : "Cartão"));

  const card = regioes.find((r) => r.dono === "card");
  const palco = regioes.find((r) => r.dono === "");
  ok("o cartão virou uma face com DOIS buracos (o logo e o nome)", card.buracos.length === 2, JSON.stringify(card.buracos.map((b) => b.length)));
  ok("a face é mais funda que o palco", card.profundidade === 1 && palco.profundidade === 0);
  ok(
    "o palco bloqueia TODOS os contornos (o cartão, o logo e o texto) no teste de ponto",
    palco.buracos.length === 3,
    `${palco.buracos.length} buracos`
  );
  ok(
    "mas o DESENHO do palco fura só o cartão (furar o que já está dentro dele preencheria de novo)",
    (caminhoDaRegiao(palco).match(/M /g) ?? []).length === 2,
    caminhoDaRegiao(palco).slice(0, 40)
  );
  ok(
    "a área do palco é a da lâmina menos o cartão (o que está dentro dele já está fora)",
    Math.abs(palco.area - (960 * 540 - 768 * 432)) < 1,
    `área ${Math.round(palco.area)}`
  );
  ok(
    "a área do cartão desconta os buracos",
    fiscalArea(card, logo, nome),
    `área ${Math.round(card.area)}`
  );

  const faceDoCartao = regiaoEm(regioes, PT(120, 120));
  ok("um ponto na face do cartão cai NO cartão", faceDoCartao?.dono === "card", faceDoCartao?.nome);
  const sobreLogo = regiaoEm(regioes, PT(480, 160));
  ok("um ponto sobre o logo cai NO logo (não no cartão)", sobreLogo?.dono === "logo", sobreLogo?.nome);
  const sobreTexto = regiaoEm(regioes, PT(480, 320));
  ok("um ponto sobre o texto cai no texto", sobreTexto?.dono === "nome", sobreTexto?.nome);
  const fora = regiaoEm(regioes, PT(40, 500));
  ok("um ponto fora do cartão cai no PALCO", fora?.dono === "", fora?.nome);
  ok("e o nome de cada face está pronto para a trilha", regioes.find((r) => r.dono === "logo").nome === "Logo");

  const caminho = caminhoDaRegiao(card);
  ok("o caminho da face tem o contorno + um subcaminho por buraco", (caminho.match(/M /g) ?? []).length === 3, caminho.slice(0, 40));
}

console.log("\num texto que passa POR CIMA do logo continua sendo buraco do cartão");
{
  // centro do texto dentro da elipse do logo: o cartão ainda tem de furar os dois — senão pintar a
  // face do cartão cobriria o texto que a pessoa está vendo
  const logo = mk({ id: "logo", geom: "ellipse", box: { x: 35, y: 20, w: 30, h: 45 } });
  const nome = mk({ id: "nome", kind: "texto", box: { x: 30, y: 55, w: 40, h: 15 } });
  const regioes = regioesDa([CARTAO, logo, nome], D);
  const card = regioes.find((r) => r.dono === "card");
  ok("o cartão fura o logo E o texto (interseção, não só contenção)", card.buracos.length === 2, JSON.stringify(card.buracos.map((b) => b.length)));
  const sobreTexto = regiaoEm(regioes, PT(480, 337));
  ok("o ponto sobre o texto (que está sobre o logo) cai no texto", sobreTexto?.dono === "nome", sobreTexto?.dono);
}

/** A área da face do cartão: a do cartão menos o logo (elipse) e o nome (retângulo). */
function fiscalArea(card, logo, nome) {
  const aCard = 768 * 432;
  const aLogo = areaDoPoligono(poligonoDaForma(logo, D));
  const aNome = areaDoPoligono(poligonoDaForma(nome, D));
  return Math.abs(card.area - (aCard - aLogo - aNome)) < 1;
}

console.log("\nduas boxes lado a lado: a rua entre elas é a face do palco");
{
  const esquerda = mk({ id: "e", box: { x: 5, y: 20, w: 35, h: 60 } });
  const direita = mk({ id: "d", box: { x: 60, y: 20, w: 35, h: 60 } });
  const regioes = regioesDa([esquerda, direita], D);
  const palco = regioes.find((r) => r.dono === "");
  ok("o palco tem as duas como buracos", palco.buracos.length === 2);
  const rua = regiaoEm(regioes, PT(480, 200));
  ok("o ponto entre as duas cai no palco (a rua)", rua?.dono === "", rua?.nome);
  const dentroDaEsquerda = regiaoEm(regioes, PT(200, 200));
  ok("e o ponto dentro da esquerda cai nela", dentroDaEsquerda?.dono === "e");
}

console.log("\naninhamento fundo (cartão > logo > bolinha)");
{
  const card = mk({ id: "card" });
  const logo = mk({ id: "logo", geom: "ellipse", box: { x: 35, y: 25, w: 30, h: 40 } });
  const bolinha = mk({ id: "bolinha", geom: "ellipse", box: { x: 45, y: 40, w: 6, h: 6 } });
  const regioes = regioesDa([card, logo, bolinha], D);
  ok("as profundidades são 0 / 1 / 2 / 3", regioes.map((r) => r.profundidade).join(",") === "0,1,2,3", regioes.map((r) => `${r.dono}:${r.profundidade}`).join(" "));
  const naBolinha = regiaoEm(regioes, PT(461, 243));
  ok("o ponto sobre a bolinha cai nela (a mais funda)", naBolinha?.dono === "bolinha", naBolinha?.dono);
  const noLogo = regiaoEm(regioes, PT(400, 200));
  ok("e o ponto no logo (fora da bolinha) cai no logo", noLogo?.dono === "logo", noLogo?.dono);
}

console.log("\nformas que se CRUZAM (sem conter o centro uma da outra)");
{
  const a = mk({ id: "a", box: { x: 10, y: 10, w: 50, h: 60 } });
  const b = mk({ id: "b", box: { x: 40, y: 30, w: 50, h: 60 } });
  const regioes = regioesDa([a, b], D);
  ok("as duas são irmãs (nenhuma vira buraco da outra)", regioes.every((r) => r.buracos.length === (r.dono === "" ? 2 : 0)), regioes.map((r) => `${r.dono}:${r.buracos.length}`).join(" "));
  const noCruzamento = regiaoEm(regioes, PT(480, 270));
  ok("no cruzamento vale a face menos profunda de mesma profundidade... a menor área (previsível)", noCruzamento?.dono === "a" || noCruzamento?.dono === "b", noCruzamento?.dono);
  ok("o mapa é montado sem laço nem erro", regioes.length === 3);
}

console.log("\ngeometrias sem área ficam fora do mapa");
{
  const linha = mk({ id: "l", geom: "line" });
  const card = mk({ id: "card" });
  const regioes = regioesDa([linha, card], D);
  ok("a linha não vira face nem buraco", regioes.length === 2 && regioes.find((r) => r.dono === "").buracos.length === 1);
}

// ---------------------------------------------------------------- 3) a fiação do modo Regiões

console.log("\na fita: o botão Regiões dentro do grupo Estúdio");
{
  const fita = ler("src/powerpoint/ui/fita.ts");
  ok(
    "o botão Regiões está no MESMO grupo do Isolar",
    /grupo\(\s*"Estúdio",[\s\S]{0,600}?estudio-regioes/m.test(fita),
    "o mapa só faz sentido dentro do Estúdio"
  );
  ok(
    "ele fica aceso com o modo ligado e desabilitado fora do Estúdio",
    /on\("estudio-regioes", st\.regioes\)/.test(fita) && /dis\("estudio-regioes", !st\.estudio\)/.test(fita)
  );
  ok("e a dica diz o gesto (acender a face, clicar isola)", /acende a face sob ele e clicar isola/.test(fita));
  ok("o ícone é o tracejado com a divisão (feito no app)", /ppr-regioes-ic/.test(fita));
}

console.log("\no host: o mapa, o realce e a região isolada");
{
  const ppt = ler("src/powerpoint/powerpoint.ts");
  ok("o mapa das regiões é refeito na pintura da lâmina", /this\.regioes = box \? regioesDa\(this\.atual\(\)\.shapes, this\.dim\(\), nomeDaBox\) : \[\]/.test(ppt));
  ok("o ponteiro acende a face sob ele", /private aoMoverNoPalco\(ev: PointerEvent\)/.test(ppt) && /regiaoEm\(this\.regioes, p\)/.test(ppt));
  ok(
    "o realce é um SVG com o caminho da região (com os buracos)",
    /class", "pp-estudio-svg pp-regiao-svg"/.test(ppt) && /path\.setAttribute\("d", caminhoDaRegiao\(r\)\)/.test(ppt)
  );
  ok("o clique isola a região (e não muda a seleção)", /private aoClicarNoPalco\(ev: MouseEvent\)/.test(ppt) && /if \(this\.modoRegioes && this\.estudio\) return;/.test(ppt));
  ok("a fronteira do Estúdio passa a ser a região", /this\.regiao \? mascaraDaRegiao\(this\.regiao, d\) : mascaraDaBox\(box, d\)/.test(ppt));
  ok(
    "a trilha diz a região e oferece o voltar",
    /data-estudio-regiao/.test(ppt) && /data-estudio-voltar/.test(ppt) && /private voltarParaBox\(\)/.test(ppt)
  );
  ok("o Esc sai do mapa, depois da região, e só então do Estúdio", /else if \(this\.modoRegioes\) this\.consumir\(e, \(\) => this\.alternarModoRegioes\(\)\)[\s\S]{0,160}else if \(this\.regiao\) this\.consumir\(e, \(\) => this\.voltarParaBox\(\)\)[\s\S]{0,160}else if \(this\.estudio\)/.test(ppt));
  ok("sair do Estúdio (e trocar de lâmina) limpa o mapa e a região", (ppt.match(/this\.modoRegioes = false;/g) ?? []).length >= 3, "sair, trocar de lâmina e a box que sumiu");
  ok("a região de outra box é invalidada", /if \(this\.regiao && this\.regiao\.dono !== box\?\.id\) this\.regiao = null;/.test(ppt));
  ok(
    "os gestos estão ligados no palco (mover, sair e clicar)",
    /addEventListener\("pointermove", \(ev\) => this\.aoMoverNoPalco\(ev\)\)/.test(ppt) &&
      /addEventListener\("pointerleave", \(\) => this\.pintarRegiaoHover\(null\)\)/.test(ppt) &&
      /addEventListener\("click", \(ev\) => this\.aoClicarNoPalco\(ev\)\)/.test(ppt)
  );
  const estado = ler("src/powerpoint/ui/estado.ts");
  ok("o estado leva o modo e o nome da região", /regioes: boolean;/.test(estado) && /regiao\?: string;/.test(estado) && /regioes: this\.modoRegioes,/.test(ppt));
}

console.log("\no CSS do modo Regiões");
{
  const css = ler("src/styles/powerpoint-edicao.css");
  ok(
    "o realce da face é um véu do acento com contorno tracejado",
    /\.pp-estudio-svg\.pp-regiao-svg path\s*\{[^}]*fill:\s*color-mix\(in srgb, var\(--accent\) 14%/.test(css) &&
      /\.pp-estudio-svg\.pp-regiao-svg path\s*\{[^}]*stroke-dasharray/.test(css)
  );
  ok("e o contorno não engorda com o zoom (non-scaling-stroke)", /vector-effect:\s*non-scaling-stroke/.test(css));
  ok("a trilha tem o voltar e o nome da região", /\.pp-estudio-voltar\s*\{/.test(css) && /\.pp-estudio-regiao\s*\{/.test(css));
}

console.log(falhas ? `\n${falhas} falha(s)` : "\ntudo certo");
process.exit(falhas ? 1 : 0);
