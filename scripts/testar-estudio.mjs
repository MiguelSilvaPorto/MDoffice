// Testa o ESTÚDIO (fase 1): o caminho da box (com o raio dos cantos), a máscara do ambiente
// isolado e a fiação que abre/fecha o modo na lâmina.
//
//   1) o núcleo puro (`src/powerpoint/edicao/estudio.ts`): quem pode ser isolado, a caixa em pt e
//      o caminho de cada geometria (retângulo, cantos arredondados por canto, elipse, triângulo);
//   2) a máscara: o retângulo da lâmina com a box como buraco (o `evenodd`);
//   3) a fiação: a fita (grupo Estúdio + Isolar/Sair), o host (máscara, trilha, seleção presa à
//      box, Esc, troca de lâmina) e o CSS.
//
// Uso: node scripts/testar-estudio.mjs
import { build } from "esbuild";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const raiz = new URL("..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const tmp = mkdtempSync(join(tmpdir(), "pp-estudio-"));
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

const E = await empacotar("src/powerpoint/edicao/estudio.ts", "estudio.mjs");
const { podeIsolar, boxEmPt, caminhoDaBox, mascaraDaBox, nomeDaBox } = E;

/** A lâmina 16:9 do app, em pt (a mesma unidade do motor). */
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

// ---------------------------------------------------------------- 1) o núcleo puro

console.log("o que pode ser isolado (a box precisa de área)");
ok("uma forma pode", podeIsolar(mk()) === true);
ok("uma forma com cantos arredondados pode", podeIsolar(mk({ cantos: [10, 10, 10, 10] })) === true);
ok("uma imagem pode", podeIsolar(mk({ kind: "imagem", src: "x.png" })) === true);
ok("uma caixa de texto pode", podeIsolar(mk({ kind: "texto", text: "Oi" })) === true);
ok("uma linha NÃO pode (não tem área)", podeIsolar(mk({ geom: "line" })) === false);
ok("um conector NÃO pode", podeIsolar(mk({ geom: "bentConnector3" })) === false);
ok("um traço de tinta NÃO pode", podeIsolar(mk({ tinta: [{ x: 1, y: 1 }] })) === false);
ok("geometria livre (custGeom) NÃO pode", podeIsolar(mk({ paths: [{ w: 10, h: 10, cmds: [] }] })) === false);
ok("uma caixa sem tamanho NÃO pode", podeIsolar(mk({ box: { x: 10, y: 10, w: 0, h: 40 } })) === false);
ok("sem forma (nada escolhido) NÃO pode", podeIsolar(undefined) === false && podeIsolar(null) === false);

console.log("\na caixa em pt da lâmina");
{
  const b = boxEmPt(mk(), D);
  ok("a % vira pt (10% de 960 = 96; 80% de 960 = 768)", b.x === 96 && b.y === 54 && b.w === 768 && b.h === 432, JSON.stringify(b));
}

console.log("\no caminho da box");
{
  const ret = caminhoDaBox(mk(), D);
  ok("o retângulo sai fechado, nos quatro cantos", ret === "M 96 54 L 864 54 L 864 486 L 96 486 Z", ret);

  const redondo = caminhoDaBox(mk({ geom: "roundRect", cantos: [10, 10, 10, 10] }), D);
  // 10% do menor lado (432) = 43,2 — o MESMO raio que o desenho da forma usa
  const raios = redondo.match(/A 43\.2 43\.2 0 0 1/g) ?? [];
  ok("o retângulo arredondado tem quatro arcos de 43,2 pt", raios.length === 4, redondo);
  ok("e o caminho começa depois do raio do canto superior esquerdo", redondo.startsWith("M 139.2 54"), redondo.slice(0, 24));

  const exagerado = caminhoDaBox(mk({ box: { x: 10, y: 10, w: 10, h: 80 }, cantos: [50, 50, 50, 50] }), D);
  ok(
    "o raio é limitado a metade do menor lado (não deixa dois cantos se cruzarem)",
    /A 48 48 0 0 1/.test(exagerado),
    exagerado.slice(0, 40)
  );

  const elipse = caminhoDaBox(mk({ geom: "ellipse" }), D);
  ok("a elipse são duas meias-voltas", (elipse.match(/A 384 216 0 0 1/g) ?? []).length === 2 && elipse.endsWith("Z"), elipse);

  const tri = caminhoDaBox(mk({ geom: "triangle" }), D);
  ok("o triângulo tem o ápice no meio do topo", tri === "M 480 54 L 864 486 L 96 486 Z", tri);

  const estrela = caminhoDaBox(mk({ geom: "star5" }), D);
  ok("as geometrias que não desenhamos caem no retângulo da caixa (previsível)", estrela === ret, estrela);

  ok("sem área não há caminho", caminhoDaBox(mk({ geom: "line" }), D) === null);
}

console.log("\na máscara do ambiente isolado");
{
  const m = mascaraDaBox(mk(), D);
  ok("são dois caminhos: a lâmina inteira e a box como buraco", (m.match(/M /g) ?? []).length === 2, m);
  ok("o de fora é a lâmina toda", m.startsWith("M 0 0 L 960 0 L 960 540 L 0 540 Z"), m.slice(0, 40));
  ok("e a box entra fechada no fim (o `evenodd` do SVG faz o buraco)", m.endsWith("Z") && m.includes("M 96 54"));
  ok("sem box, sem máscara", mascaraDaBox(mk({ geom: "line" }), D) === null);
}

console.log("\no nome da box na trilha");
ok("o nome do arquivo manda", nomeDaBox(mk({ name: "Card do Diego" })) === "Card do Diego");
ok("sem nome, vale a primeira linha do texto", nomeDaBox(mk({ text: "Diego Souza\nAnalista" })) === "Diego Souza");
ok(
  "e o texto por parágrafos também vale",
  nomeDaBox(mk({ paras: [{ runs: [{ text: "Maria Silva" }], align: "esquerda", lvl: 0, marL: 0, indent: 0, spcBef: 0, spcAft: 0, endSize: 18 }] })) === "Maria Silva"
);
ok("sem nada, 'Box'", nomeDaBox(mk({ text: "  \n " })) === "Box");

// ---------------------------------------------------------------- 3) a fiação

console.log("\na fita: o grupo Estúdio na aba Desenhar");
{
  const fita = ler("src/powerpoint/ui/fita.ts");
  ok(
    "o grupo Estúdio vive na aba Desenhar (com o Isolar/Sair)",
    /private desenhar\(\)[\s\S]*?grupo\(\s*"Estúdio",[\s\S]*?private tabela\(\)/.test(fita) && /grande\("estudio",/.test(fita),
    "o grupo novo tem de estar na aba Desenhar (a posição entre os grupos é do layout, não desta checagem)"
  );
  ok("o botão é o comando `estudio`", /grande\("estudio",/.test(fita));
  ok(
    "o botão vira 'Sair' com o Estúdio aberto e só acende com box isolável",
    /rotulo\.textContent = st\.estudio \? "Sair" : "Isolar"/.test(fita) && /dis\("estudio", !st\.estudio && !st\.podeIsolar\)/.test(fita)
  );
  ok("o ícone do grupo é o tracejado do app (não arte do Office)", /ppr-estudio-ic/.test(fita));
}

console.log("\no host: entrar, sair e o que o modo muda");
{
  const ppt = ler("src/powerpoint/powerpoint.ts");
  ok("o comando `estudio` alterna o modo", /case "estudio": \{\s*this\.alternarEstudio\(\)/.test(ppt));
  ok(
    "só entra com uma box que tenha área (o resto recebe um aviso, nunca um modo vazio)",
    /!alvo \|\| !podeIsolar\(alvo\)/.test(ppt) && /toast\("Escolha uma box com área para isolar/.test(ppt)
  );
  ok("guarda o zoom de antes e volta para ele ao sair", /this\.zoomAntesEstudio = this\.stage\.zoomAtual/.test(ppt) && /setZoom\(this\.zoomAntesEstudio\)/.test(ppt));
  ok("a máscara usa o caminho da fase 1 (`mascaraDaBox`)", /mascaraDaBox\(box, d\)/.test(ppt) && /fill-rule", "evenodd"/.test(ppt));
  ok(
    "a máscara é redesenhada a cada pintura da lâmina (o desenho troca o DOM inteiro)",
    /this\.pintarSlide\(slide\);\s*this\.pintarEstudio\(\);/.test(ppt) && /this\.pintarSlide\(this\.atual\(\)\);\s*this\.pintarEstudio\(\);/.test(ppt),
    "sem isso a máscara sumiria no primeiro arrasto"
  );
  ok("a trilha diz qual box e oferece o Sair", /data-estudio-nome/.test(ppt) && /data-estudio-sair/.test(ppt) && /nomeDaBox\(box\)/.test(ppt));
  ok("a sessão de cliques passa a respeitar a box (seleção só do que está dentro)", /if \(this\.estudio\) ids = this\.dentroDaBox\(ids\)/.test(ppt));
  ok("o Esc sai do Estúdio", /else if \(this\.estudio\) this\.consumir\(e, \(\) => this\.sairDoEstudio\(\)\)/.test(ppt));
  ok(
    "trocar de lâmina fecha o Estúdio (a box é de uma lâmina)",
    /if \(this\.estudio\) \{\s*this\.estudio = null;[\s\S]{0,220}this\.stage\.setZoom\(this\.zoomAntesEstudio\);/.test(ppt),
    "o zoom de antes volta e o mapa de regiões não atravessa a lâmina"
  );
  ok("carregar outra aba/documento também fecha", /outra aba\/documento: o Estúdio não atravessa/.test(ppt));
  ok(
    "a box apagada fecha o Estúdio (nada de estado fantasma)",
    /if \(this\.estudio && !box\) \{\s*this\.estudio = null;\s*this\.regiao = null;\s*this\.modoRegioes = false;/.test(ppt)
  );
  ok("o zoom enquadra a box e centra", /private enquadrarBox\(s: Shape\)/.test(ppt) && /private centrarNaBox\(s: Shape\)/.test(ppt));
  ok(
    "o estado chega à fita com o nome da box",
    /estudio: !!this\.estudio,/.test(ppt) && /podeIsolar: podeIsolar\(forma\),/.test(ppt) && /estudioNome: isolada \? nomeDaBox\(isolada\) : undefined,/.test(ppt)
  );
  const estado = ler("src/powerpoint/ui/estado.ts");
  ok("o EstadoUI ganhou os três campos", /estudio: boolean;/.test(estado) && /podeIsolar: boolean;/.test(estado) && /estudioNome\?: string;/.test(estado));
}

console.log("\no CSS do Estúdio");
{
  const css = ler("src/styles/powerpoint-edicao.css");
  ok("a máscara cobre a lâmina e não pega o ponteiro", /\.pp-estudio-svg\s*\{[^}]*position:\s*absolute;[^}]*pointer-events:\s*none/.test(css));
  ok("e é o tom do palco que esmaece o resto", /\.pp-estudio-svg path\s*\{[^}]*fill:\s*color-mix\(in srgb, var\(--palco-bg\)/.test(css));
  ok("a trilha é uma pílula no alto do palco", /\.pp-estudio\s*\{[^}]*border-radius:\s*999px/.test(css) && /\.pp-estudio\[hidden\]\s*\{\s*display:\s*none/.test(css));
  ok("a box isolada ganha o contorno de destaque", /\.pp-estudio-on \.pp-estudio-box::after\s*\{[^}]*border:\s*2px solid var\(--accent\)/.test(css));
  ok("o ícone da fita é o tracejado", /\.ppr-estudio-ic\s*\{[^}]*border:\s*2px dashed currentColor/.test(css));
}

console.log(falhas ? `\n${falhas} falha(s)` : "\ntudo certo");
process.exit(falhas ? 1 : 0);
