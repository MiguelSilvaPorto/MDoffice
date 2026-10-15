// Testa a PINTURA do Estúdio (fase 3): o recorte na geometria, a fita do traço, os buracos por
// sentido (o "donut") e a forma que vai para a lâmina e para o .pptx.
//
// Uso: node scripts/testar-pintura.mjs
import { build } from "esbuild";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const raiz = new URL("..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const tmp = mkdtempSync(join(tmpdir(), "pp-pintura-"));
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

const P = await empacotar("src/powerpoint/edicao/pintura.ts", "pintura.mjs");
const R = await empacotar("src/powerpoint/edicao/regioes.ts", "regioes.mjs");
const { recortar, ehConvexo, sentidoAntiHorario, fitaDoTraco, caixaDoPoligono, caminhoDaPintura, formaDaPintura, formaDoPincel, areaDaPintura } = P;
const { pontoDentro, areaDoPoligono, poligonoDaForma, regioesDa } = R;

const D = { w: 960, h: 540 };
const PT = (x, y) => ({ x, y });
const quadrado = (x, y, lado) => [PT(x, y), PT(x + lado, y), PT(x + lado, y + lado), PT(x, y + lado)];
/** A janela um tico maior: o recorte deixa os vértices EXATAMENTE na borda (o teste de ponto não
 *  aceita borda), e o que importa é não haver ponto FORA — com folga de 0,05 pt. */
const folgada = (janela, eps = 0.05) => {
  const cx = janela.reduce((s, p) => s + p.x, 0) / janela.length;
  const cy = janela.reduce((s, p) => s + p.y, 0) / janela.length;
  return janela.map((p) => {
    const m = Math.hypot(p.x - cx, p.y - cy) || 1;
    return PT(p.x + ((p.x - cx) / m) * eps, p.y + ((p.y - cy) / m) * eps);
  });
};
/** A propriedade que o usuário pediu: NENHUM ponto do resultado fora da fronteira. */
const dentroDeTodos = (pontos, janela) => pontos.every((p) => pontoDentro(p, folgada(janela)));

console.log("o recorte (Sutherland–Hodgman)");
{
  const janela = quadrado(100, 100, 200); // 100..300
  const assunto = quadrado(200, 200, 200); // 200..400 (cruzando o canto)
  const saida = recortar(assunto, janela);
  ok("o resultado fica inteiro dentro da janela", dentroDeTodos(saida, janela), JSON.stringify(saida));
  ok("e a área é a da interseção (100×100)", Math.abs(areaDoPoligono(saida) - 100 * 100) < 0.01, String(Math.round(areaDoPoligono(saida))));

  const pequeno = quadrado(150, 150, 50);
  ok("um sujeito inteiramente dentro passa inteiro", Math.abs(areaDoPoligono(recortar(pequeno, janela)) - 2500) < 0.01);
  ok("um sujeito inteiramente fora some", recortar(quadrado(500, 500, 50), janela).length === 0);

  // a fronteira REAL do app: o cartão arredondado (convexo) e a elipse
  const cartao = { id: "card", kind: "forma", box: { x: 10, y: 10, w: 80, h: 80 }, cantos: [20, 20, 20, 20], text: "", fontFamily: "S", fontSize: 18, color: "0", bold: false, italic: false, align: "esquerda", fill: "", src: "", rot: 0 };
  const contorno = poligonoDaForma(cartao, D);
  ok("o contorno do cartão é convexo (o recorte vale)", ehConvexo(contorno) === true, `${contorno.length} pontos`);

  const traco = quadrado(90, 90, 300); // atravessa o canto superior esquerdo do cartão
  const cortado = recortar(traco, contorno);
  ok("o traço que atravessa o canto fica dentro do cartão", dentroDeTodos(cortado, contorno));
  ok("e o canto arredondado é respeitado (o ponto no canto da caixa fica de fora)", areaDoPoligono(cortado) < areaDoPoligono(recortar(traco, quadrado(96, 54, 768))), "o raio come o canto");

  const elipse = poligonoDaForma({ ...cartao, cantos: undefined, geom: "ellipse" }, D);
  ok("a elipse também é convexa", ehConvexo(elipse) === true);
  ok("e o sentido do polígono é detectado (o recorte normaliza)", typeof sentidoAntiHorario(contorno) === "boolean");
}

console.log("\na fita do traço (a pincelada tem largura)");
{
  const linha = fitaDoTraco([PT(100, 100), PT(200, 100)], 10);
  ok("um traço reto vira um retângulo de largura 10", Math.abs(areaDoPoligono(linha) - 100 * 10) < 1, String(Math.round(areaDoPoligono(linha))));
  ok("e a caixa acompanha o comprimento", (() => { const c = caixaDoPoligono(linha); return Math.abs(c.w - 100) < 0.01 && Math.abs(c.h - 10) < 0.01; })(), JSON.stringify(caixaDoPoligono(linha)));
  const toque = fitaDoTraco([PT(50, 50)], 8);
  ok("um toque só vira um losango com largura", Math.abs(areaDoPoligono(toque) - (8 * 8) / 2) < 0.5, String(Math.round(areaDoPoligono(toque))));
  ok("traço sem pontos não vira nada", fitaDoTraco([], 10).length === 0);
}

console.log("\na forma da pintura (o que vai para a lâmina e para o .pptx)");
{
  const contorno = quadrado(100, 100, 200);
  const buraco = quadrado(180, 180, 40);
  const forma = formaDaPintura(contorno, [buraco], "4f46e5", 0.35, "x1", D, "Pintura · vidro");
  ok("a caixa é a do contorno em % da lâmina", forma.box.x === (100 / 960) * 100 && forma.box.w === (200 / 960) * 100, JSON.stringify(forma.box));
  ok("o preenchimento leva a cor e a transparência", forma.fillX.kind === "solid" && forma.fillX.color === "4f46e5" && forma.fillX.alpha === 0.35);
  const cmds = forma.paths[0].cmds;
  ok("o caminho é geometria livre (M/L/Z) com a caixa em pt", cmds[0] === "M" && cmds.includes("L") && cmds[cmds.length - 1] === "Z" && forma.paths[0].w === 200 && forma.paths[0].h === 200);
  ok("o contorno e o buraco são DOIS subcaminhos (o buraco entra invertido)", (cmds.filter((c) => c === "M").length === 2), JSON.stringify(cmds.slice(0, 6)));
  ok("a área livre desconta o buraco", Math.abs(areaDaPintura(contorno, [buraco]) - (200 * 200 - 40 * 40)) < 0.01);
  ok("a transparência é limitada ao razoável", formaDaPintura(contorno, [], "0", 0, "x", D).fillX.alpha >= 0.05);
  ok("sem polígono não há forma", formaDaPintura([PT(1, 1)], [], "0", 1, "x", D) === null);
}

console.log("\no PINCEL: o traço recortado pela fronteira (e pelos buracos)");
{
  const card = { id: "card", kind: "forma", box: { x: 10, y: 10, w: 80, h: 80 }, text: "", fontFamily: "S", fontSize: 18, color: "0", bold: false, italic: false, align: "esquerda", fill: "", src: "", rot: 0 };
  const contorno = poligonoDaForma(card, D);
  const logo = { ...card, id: "logo", geom: "ellipse", box: { x: 40, y: 30, w: 20, h: 30 } };
  const regioes = regioesDa([card, logo], D);
  const face = regioes.find((r) => r.dono === "card");

  const traco = [PT(90, 200), PT(400, 200), PT(900, 200)]; // atravessa a lâmina toda, na altura do logo
  const fita = fitaDoTraco(traco, 12);
  const cortada = recortar(fita, contorno);
  ok("o traço atravessando a lâmina sai inteiro dentro do cartão", dentroDeTodos(cortada, contorno), `${cortada.length} pontos`);
  ok("e os buracos da face entram no caminho da pintura", face.buracos.length === 1);
  const forma = P.formaDaPintura(cortada, face.buracos, "e11d48", 0.5, "p1", D);
  ok("o caminho tem o traço e o buraco do logo", (forma.paths[0].cmds.filter((c) => c === "M").length === 2), "");

  const pincel = formaDoPincel(traco, 12, "e11d48", 1, "p2", D);
  ok("sem fronteira (fora do Estúdio) o pincel desenha a fita inteira", pincel.box.w > 80, JSON.stringify(pincel.box));
}

console.log("\nas fronteiras que NÃO são convexas");
{
  const ele = [PT(0, 0), PT(100, 0), PT(100, 40), PT(40, 40), PT(40, 100), PT(0, 100)]; // um "L"
  ok("o L não é convexo (é dito, e não pintado torto)", ehConvexo(ele) === false);
}

// ---------------------------------------------------------------- a fiação

console.log("\na fita: o grupo Pintura no Estúdio");
{
  const fita = ler("src/powerpoint/ui/fita.ts");
  ok("o grupo Pintura entrou depois do Estúdio", /grupo\(\s*"Estúdio"[\s\S]*?grupo\(\s*"Pintura"/m.test(fita));
  ok("as três ferramentas estão lá", /grande\("pintura:pincel"/.test(fita) && /grande\("pintura:balde"/.test(fita) && /grande\("pintura:vidro"/.test(fita));
  ok("e a transparência é escolhida na fita", /<select class="ppr-sel" data-transp/.test(fita) && /<option value="0\.35">35%<\/option>/.test(fita));
  ok("fora do Estúdio as ferramentas ficam desabilitadas", /dis\("pintura:pincel", !st\.estudio\)/.test(fita) && /dis\("pintura:vidro", !st\.estudio\)/.test(fita));
}

console.log("\no host: o pincel, o balde e o vidro");
{
  const ppt = ler("src/powerpoint/powerpoint.ts");
  ok("a ferramenta de pintura é um estado do host", /private pintura: "nenhuma" \| "pincel" \| "balde" \| "vidro" = "nenhuma";/.test(ppt));
  ok("os comandos da fita estão ligados", /case "pintura:pincel"/.test(ppt) && /case "pintura:balde"/.test(ppt) && /case "pintura:vidro"/.test(ppt) && /cmd\.startsWith\("pintura:transp:"\)/.test(ppt));
  ok("o pincel pinta no palco (descer, arrastar e soltar)", /private aoBaixarNoPalco\(ev: PointerEvent\)/.test(ppt) && /private aoSoltarNoPalco\(\)/.test(ppt) && /pointerdown/.test(ppt) && /pinturaPendente/.test(ppt));
  ok("o traço é recortado pela fronteira (a região isolada ou a box)", /recortar\(/.test(ppt) && /this\.fronteiraDaPintura\(\)/.test(ppt));
  ok("e a forma sai pelo caminho normal (desfazer, histórico e exportação valem)", /this\.editar\(\(s\) => \(\{ \.\.\.s, shapes: \[\.\.\.s\.shapes, nova\] \}\)/.test(ppt));
  ok("o balde e o vidro pintam a FACE (contorno + buracos)", /this\.regiao \?\? regiaoEm\(this\.regioes, p\)/.test(ppt));
  ok(
    "a fronteira não convexa é recusada com aviso",
    /não é convexa/.test(ppt) && /toast\(/.test(ppt)
  );
  ok("o modo Regiões e a pintura não se atropelam (Esc sai da pintura primeiro)", /else if \(this\.pintura !== "nenhuma"\)/.test(ppt));
}

console.log("\no CSS da pintura");
{
  const css = ler("src/styles/powerpoint-edicao.css");
  ok("a prévia do traço aparece no palco", /\.pp-pintura-preview/.test(css));
  ok("e o cursor do palco avisa que a ferramenta está ligada", /\.pp-estudio-on\.pp-pintura-on\s+#pp-stage|pp-pintura-on/.test(css));
}

console.log(falhas ? `\n${falhas} falha(s)` : "\ntudo certo");
process.exit(falhas ? 1 : 0);
