// Testa o motor do Pincel de formatação ("Copiar formatação"): o que ele leva da origem para o alvo
// (preenchimento, contorno, sombra, transparência, a receita do estilo vivo e o formato do texto), o
// que ele NÃO toca no alvo (caixa, giro, texto, id, geometria) e o desfecho do estilo vivo — com
// receita, o alvo passa a usar a receita; sem receita, o alvo solta o estilo e a dobra derivada.
// Uso: node scripts/testar-pincel.mjs
import { build } from "esbuild";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const raiz = new URL("..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const tmp = mkdtempSync(join(tmpdir(), "pp-pincel-"));
await build({ entryPoints: [join(raiz, "src/powerpoint/edicao/pincel.ts")], bundle: true, platform: "node", format: "esm", outfile: join(tmp, "pincel.mjs"), logLevel: "error" });
const P = await import(pathToFileURL(join(tmp, "pincel.mjs")).href);

let falhas = 0;
const ok = (nome, cond, detalhe = "") => {
  if (!cond) falhas++;
  console.log(`${cond ? "OK   " : "FALHA"} ${nome}${detalhe ? "  " + detalhe : ""}`);
};

/** Forma mínima (o que o pincel copia e o que ele não pode tocar). */
const forma = (id, extra = {}) => ({
  id,
  kind: "forma",
  box: { x: 10, y: 10, w: 30, h: 20 },
  text: "",
  fontFamily: "Segoe UI",
  fontSize: 18,
  color: "111111",
  bold: false,
  italic: false,
  align: "esquerda",
  fill: "",
  src: "",
  rot: 0,
  ...extra,
});

const trecho = (extra = {}) => ({ text: "t", size: 18, bold: false, italic: false, underline: false, strike: false, color: "111111", font: "Segoe UI", ...extra });
const paragrafo = (runs, extra = {}) => ({ runs, align: "esquerda", lvl: 0, marL: 0, indent: 0, spcBef: 0, spcAft: 0, endSize: 18, ...extra });

// ---- a cópia

const origem = forma("a", {
  fillX: { kind: "gradient", stops: [{ pos: 0, color: "112233", alpha: 1 }, { pos: 100, color: "445566", alpha: 1 }], angle: 45 },
  fill: "112233",
  ln: { color: "FF0000", alpha: 1, w: 2.25, dash: "dash", head: "triangle" },
  shadow: { color: "000000", alpha: 0.35, blur: 8, dist: 6, dir: 90 },
  opacity: 0.6,
  estilo: { familia: "esmeralda", intensidade: "forte", brilho: "lustro", base: "1F9D55", angulo: 45 },
  fontFamily: "Georgia",
  fontSize: 24,
  color: "FFFFFF",
  bold: true,
  italic: true,
  align: "centro",
  paras: [paragrafo([trecho({ text: "Olá", size: 24, bold: true, font: "Georgia", color: "FFFFFF", highlight: "FFFF00", caps: true })], { align: "centro", lvl: 1, marL: 24, spcAft: 6 })],
});

const copia = P.copiarFormato(origem);
ok("a cópia leva o preenchimento (gradiente, paradas e ângulo)", copia.fill.kind === "gradient" && copia.fill.stops.length === 2 && copia.fill.angle === 45);
ok("a cópia leva o contorno inteiro (traço e ponta)", copia.ln.color === "FF0000" && copia.ln.w === 2.25 && copia.ln.dash === "dash" && copia.ln.head === "triangle");
ok("a cópia leva a sombra e a transparência", copia.shadow.alpha === 0.35 && copia.opacity === 0.6);
ok("a cópia leva a receita do estilo vivo", copia.estilo.familia === "esmeralda" && copia.estilo.intensidade === "forte");
ok("a cópia leva o formato da forma (fonte, tamanho, cor, negrito/itálico e alinhamento)", copia.texto.fontFamily === "Georgia" && copia.texto.fontSize === 24 && copia.texto.color === "FFFFFF" && copia.texto.bold === true && copia.texto.italic === true && copia.texto.align === "centro");
ok("a cópia leva o formato do primeiro trecho (marca-texto e versalete inclusive)", copia.trecho.font === "Georgia" && copia.trecho.highlight === "FFFF00" && copia.trecho.caps === true);
ok("a cópia leva o formato do primeiro parágrafo (nível, recuo e espaçamento)", copia.paragrafo.lvl === 1 && copia.paragrafo.marL === 24 && copia.paragrafo.spcAft === 6);

// mexer na origem depois não muda o que foi copiado
origem.fillX.stops[0].color = "000000";
origem.ln.color = "000000";
origem.paras[0].runs[0].color = "000000";
ok("a cópia é profunda (mexer na origem depois não muda o formato guardado)", copia.fill.stops[0].color === "112233" && copia.ln.color === "FF0000" && copia.trecho.color === "FFFFFF");

// o preenchimento simples (sem o campo rico) também é copiado; vazio é "sem preenchimento"
const simples = forma("s", { fill: "ABCDEF" });
ok("a forma antiga (só `fill`) copia como preenchimento sólido", P.copiarFormato(simples).fill.kind === "solid" && P.copiarFormato(simples).fill.color === "ABCDEF");
const semPintura = forma("v", { fill: "" });
ok("a forma sem preenchimento copia como `none` (o alvo perde a pintura)", P.copiarFormato(semPintura).fill.kind === "none");

// ---- a aplicação

const alvo = forma("b", {
  box: { x: 60, y: 70, w: 10, h: 5 },
  rot: 33,
  kind: "forma",
  geom: "ellipse",
  text: "texto do alvo",
  fill: "00FF00",
  ln: { color: "00FF00", alpha: 1, w: 1, dash: "solid" },
  fontFamily: "Calibri",
  fontSize: 12,
  color: "00FF00",
  paras: [paragrafo([trecho({ text: "texto", highlight: "FF99CC" })])],
});
const pintado = P.aplicarFormato(alvo, copia);

ok("o alvo veste o preenchimento, o contorno, a sombra, a transparência e a receita da cópia", pintado.fillX.kind === "gradient" && pintado.ln.w === 2.25 && pintado.ln.head === "triangle" && pintado.shadow.blur === 8 && pintado.opacity === 0.6 && pintado.estilo.familia === "esmeralda");
ok("o alvo veste o formato do texto (a forma e os trechos; o marca-texto da origem chega)", pintado.fontFamily === "Georgia" && pintado.fontSize === 24 && pintado.color === "FFFFFF" && pintado.align === "centro" && pintado.paras[0].runs[0].font === "Georgia" && pintado.paras[0].runs[0].highlight === "FFFF00" && pintado.paras[0].runs[0].caps === true);
ok("o alvo veste o formato do parágrafo (nível, recuo e espaçamento da origem)", pintado.paras[0].lvl === 1 && pintado.paras[0].marL === 24 && pintado.paras[0].spcAft === 6);
ok("o texto já escrito fica (só o formato veste)", pintado.paras[0].runs[0].text === "texto" && pintado.text === "texto do alvo");
ok("a caixa, o giro, o id e a geometria do alvo não se mexem", pintado.box.x === 60 && pintado.box.w === 10 && pintado.rot === 33 && pintado.id === "b" && pintado.geom === "ellipse");

// a quebra de linha é do texto: não recebe o formato do trecho
const comQuebra = forma("c", { paras: [paragrafo([trecho({ text: "a" }), { ...trecho({ text: "" }), br: true }])] });
const quebrado = P.aplicarFormato(comQuebra, copia);
ok("a quebra de linha continua intocada", quebrado.paras[0].runs[1].br === true && quebrado.paras[0].runs[1].font === "Segoe UI");

// ---- o estilo vivo

const comEstilo = forma("d", {
  estilo: { familia: "oceano", intensidade: "suave", brilho: "nada", base: "1122FF", angulo: 0 },
  capa: { de: "outra" },
});
const semReceita = P.aplicarFormato(comEstilo, P.copiarFormato(semPintura));
ok("sem receita na cópia, o alvo solta o estilo vivo (a pintura fica dona)", semReceita.estilo === undefined);
ok("a dobra derivada do alvo sai junto (não sobra enfeite órfão)", semReceita.capa === undefined);
const comReceita = P.aplicarFormato(comEstilo, copia);
ok("com receita na cópia, o alvo passa a usar a receita da origem (e a dobra fica para o recálculo)", comReceita.estilo.familia === "esmeralda" && comReceita.estilo.base === "1F9D55");

// sem texto de um lado, o outro fica sem paras (e o formato da forma ainda chega)
const semTexto = P.aplicarFormato(forma("e"), copia);
ok("alvo sem `paras` continua sem `paras` (o formato do texto simples chega)", semTexto.paras === undefined && semTexto.fontSize === 24 && semTexto.color === "FFFFFF");

console.log(falhas ? `\n${falhas} FALHA(S)` : "\nTudo certo.");
process.exit(falhas ? 1 : 0);
