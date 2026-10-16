// Testa os Modelos (botão Template): todos trazem um DESENHO próprio, o desenho nunca cobre as
// caixas de texto dos layouts, o texto tem contraste com o fundo, aplicar o modelo troca as
// decorações (e não empilha), a troca de layout refaz o desenho e o modelo do usuário o leva.
// Uso: node scripts/testar-modelos.mjs
import { build } from "esbuild";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const raiz = new URL("..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const tmp = mkdtempSync(join(tmpdir(), "pp-modelos-"));
for (const [nome, arq] of [["modelos", "edicao/modelos.ts"], ["desenhos", "edicao/desenhos.ts"], ["layouts", "edicao/layouts.ts"]])
  await build({ entryPoints: [join(raiz, "src/powerpoint", arq)], bundle: true, platform: "node", format: "esm", outfile: join(tmp, `${nome}.mjs`), logLevel: "error" });
const M = await import(pathToFileURL(join(tmp, "modelos.mjs")).href);
const D = await import(pathToFileURL(join(tmp, "desenhos.mjs")).href);
const L = await import(pathToFileURL(join(tmp, "layouts.mjs")).href);

let falhas = 0;
const ok = (nome, cond, detalhe = "") => {
  if (!cond) falhas++;
  console.log(`${cond ? "OK   " : "FALHA"} ${nome}${detalhe ? "  " + detalhe : ""}`);
};
const cruza = (a, b) => a.x < b.x + b.w - 0.01 && b.x < a.x + a.w - 0.01 && a.y < b.y + b.h - 0.01 && b.y < a.y + a.h - 0.01;
const temas = { claro: { bg: "FFFFFF", fg: "1C212B" }, escuro: { bg: "0F1117", fg: "F4F5F8" }, contraste: { bg: "000000", fg: "FFFFFF" } };
const marca = (f, p = "tpl:") => f.name?.startsWith(p);

// --- o catálogo
const sem = M.MODELOS.filter((m) => !m.desenho).map((m) => m.id);
ok("todo modelo do app tem desenho", sem.length === 0, sem.join(","));
ok("o catálogo não traz os três de gradiente", M.MODELOS.every((m) => !["esmeralda", "oceano", "ameixa"].includes(m.id)));
ok("os ids são únicos", new Set(M.MODELOS.map((m) => m.id)).size === M.MODELOS.length);
const usados = new Set(M.MODELOS.map((m) => m.desenho));
ok("os seis desenhos são usados", usados.size === 6, [...usados].join(","));
const ruins = M.MODELOS.filter((m) => {
  const t = temas[m.tema];
  return M.contrasteDeCores(m.cores?.fg ?? t.fg, m.cores?.bg || m.bg || t.bg) < 4.5;
});
ok("o texto de cada modelo tem contraste (WCAG 4,5:1) com o fundo", ruins.length === 0, ruins.map((m) => m.id).join(","));
const apagados = M.MODELOS.filter((m) => m.cores && M.contrasteDeCores(m.cores.accent, m.cores.bg || m.bg) < 1.4);
ok("o acento aparece sobre o fundo (o desenho não some)", apagados.length === 0, apagados.map((m) => m.id).join(","));

// --- o desenho nunca cobre o texto
const cores = { bg: "FFFFFF", fg: "111111", accent: "0F8B4C", muted: "888888" };
for (const ratio of [16 / 9, 4 / 3]) {
  const cobre = [];
  for (const d of D.DESENHOS)
    for (const layout of ["titulo", "secao", "conteudo", "duas", "soTitulo"]) {
      const textos = L.caixasDoLayout(layout).map((c) => c.box);
      for (const f of D.decoracoesDe(d.id, layout, cores, ratio)) {
        if (!f.fixa || !marca(f)) cobre.push(`${d.id}/${layout}: não é fixa/marcada`);
        if (!f.fillX) continue; // moldura: só contorno, contorna o texto
        if (textos.some((t) => cruza(f.box, t))) cobre.push(`${d.id}/${layout}`);
      }
    }
  ok(`nenhuma decoração pintada cobre o texto (${ratio.toFixed(2)})`, cobre.length === 0, cobre.join(" "));
}
ok("a lâmina em branco não tem decoração", D.DESENHOS.every((d) => D.decoracoesDe(d.id, "vazio", cores).length === 0));
const quad = D.decoracoesDe("circulos", "conteudo", cores, 16 / 9)[0];
ok("o círculo é círculo (h = w × proporção)", Math.abs(quad.box.h - quad.box.w * (16 / 9)) < 0.05, `${quad.box.w}×${quad.box.h}`);

// --- aplicar o modelo
const caixa = (id) => ({ id, kind: "texto", box: { x: 6, y: 6, w: 88, h: 14 }, text: "", fontFamily: "Segoe UI", fontSize: 30, color: "1C212B", bold: false, italic: false, align: "esquerda", fill: "", src: "", rot: 0 });
const lamina = (layout) => ({ md: "", layout, notes: "", shapes: [caixa("t")] });
const de = { theme: "claro", bg: "", fontFamily: "Segoe UI" };
const corp = M.MODELOS.find((m) => m.id === "corporativo");
const exec = M.MODELOS.find((m) => m.id === "executivo");
const a = M.aplicarModelo([lamina("conteudo"), lamina("titulo")], de, corp);
ok("aplicar o modelo põe as decorações dele em cada lâmina", a.every((s) => s.shapes.some((f) => marca(f, "tpl:barra"))));
ok("as decorações ficam ATRÁS do texto", a.every((s) => s.shapes[s.shapes.length - 1].id === "t"));
ok("a capa e o miolo recebem decorações diferentes", JSON.stringify(a[0].shapes.filter((f) => f.fixa).map((f) => f.box)) !== JSON.stringify(a[1].shapes.filter((f) => f.fixa).map((f) => f.box)));
const b = M.aplicarModelo(a, de, exec);
ok(
  "trocar de modelo TROCA as decorações (não empilha)",
  b.every((s) => s.shapes.filter((f) => marca(f)).length === D.decoracoesDe("moldura", s.layout, cores).length && !s.shapes.some((f) => marca(f, "tpl:barra")))
);
ok("o texto original continua na lâmina", b.every((s) => s.shapes.some((f) => f.id === "t")));
const dourado = b[0].shapes.find((f) => marca(f, "tpl:moldura"));
ok("as decorações usam a paleta do modelo novo", dourado?.ln?.color === "C9A227");

// --- trocar o layout refaz o desenho
const comoCapa = D.refazerDesenho({ ...a[0], layout: "titulo" });
const esperado = D.decoracoesDe("barra", "titulo", { bg: "FFFFFF", fg: "12372A", accent: "0F8B4C", muted: "5B7B6A" });
ok("trocar o layout refaz o desenho (miolo → capa)", JSON.stringify(comoCapa.shapes.filter((f) => f.fixa).map((f) => f.box)) === JSON.stringify(esperado.map((f) => f.box)));
ok("lâmina sem decoração de modelo fica como está", D.refazerDesenho(lamina("titulo")).shapes.length === 1);
const semDesenho = M.aplicarModelo(a, de, { ...exec, desenho: undefined });
ok("modelo sem desenho (as Ideias) deixa as decorações como estão", semDesenho.every((s, i) => s.shapes.filter((f) => marca(f)).length === a[i].shapes.filter((f) => marca(f)).length));

// --- modelo do usuário
const meu = M.modeloDoDeck(a, { theme: "claro", bg: "FFFFFF", fontFamily: "Inter" }, "Meu", "u1");
ok("o modelo guardado pelo usuário leva o desenho do deck", meu.desenho === "barra", String(meu.desenho));

// --- a Composição: o modelo só nesta lâmina, sem mover nenhuma caixa
{
  const forma = (id, box, extra = {}) => ({ id, kind: "forma", box, text: "", fontFamily: "Segoe UI", fontSize: 18, color: "1C212B", bold: false, italic: false, align: "esquerda", fill: "4F46E5", src: "", rot: 0, fillX: { kind: "solid", color: "4F46E5", alpha: 1 }, ...extra });
  const texto = (id, box) => ({ ...forma(id, box, { kind: "texto", fill: "", fillX: undefined }) });
  const original = { md: "", layout: "conteudo", notes: "", shapes: [forma("deco", { x: 0, y: 0, w: 3, h: 100 }, { fixa: true, geom: "rect" }), texto("t", { x: 6, y: 6, w: 88, h: 14 }), forma("c1", { x: 6, y: 30, w: 40, h: 30 }, { geom: "rect" }), forma("c2", { x: 54, y: 30, w: 40, h: 30 })] };
  const antes = JSON.stringify(original);
  const aplicarL = M.aplicarModeloALamina;
  const caixas = (sl) => sl.shapes.filter((f) => !f.name?.startsWith("tpl:")).map((f) => `${f.id}:${JSON.stringify(f.box)}`).join("|");

  for (const t of ["recolorir", "cartao", "sombra", "cantos", "contorno"]) {
    const r = aplicarL(original, de, M.MODELOS.find((m) => m.id === "executivo"), t);
    ok(`"${t}": nenhuma caixa muda de posição nem de tamanho`, caixas(r) === caixas(original));
  }
  ok("a lâmina original não é alterada (função pura)", JSON.stringify(original) === antes);
  const exec2 = aplicarL(original, de, M.MODELOS.find((m) => m.id === "executivo"), "recolorir");
  ok("a lâmina sem fundo próprio ganha o fundo do modelo (só ela)", exec2.bg?.kind === "solid" && exec2.bg.color === "0A1930");
  const outra = aplicarL(exec2, de, M.MODELOS.find((m) => m.id === "terracota"), "recolorir");
  ok("um segundo modelo troca a fonte e o fundo do primeiro", outra.shapes.find((f) => f.id === "t").fontFamily === "Lato" && outra.bg.color === "F8EFE7", `${outra.shapes.find((f) => f.id === "t").fontFamily} ${outra.bg?.color}`);

  const cartao = aplicarL(original, de, corp, "cartao");
  const c1 = cartao.shapes.find((f) => f.id === "c1");
  ok("cartão: a caixa pintada ganha cantos arredondados e sombra", c1.geom === "roundRect" && !!c1.shadow && c1.shadow.alpha > 0 && c1.shadow.blur > 0);
  ok("cartão: o texto solto não ganha sombra", !cartao.shapes.find((f) => f.id === "t").shadow);
  const deco = cartao.shapes.find((f) => f.id === "deco");
  ok("cartão: a decoração fixa não é formatada (fica como está)", !deco.shadow && deco.geom === "rect");
  const sombra = aplicarL(original, de, corp, "sombra");
  ok("sombra: dá sombra sem arredondar", !!sombra.shapes.find((f) => f.id === "c1").shadow && sombra.shapes.find((f) => f.id === "c1").geom === "rect");
  // o texto escuro de uma lâmina clara tem que virar claro num modelo escuro: o contraste é decidido
  // contra o fundo NOVO (antes era contra o antigo — ou nenhum — e o texto ficava azul-escuro no azul-marinho)
  const noEscuro = aplicarL(original, de, M.MODELOS.find((m) => m.id === "executivo"), "recolorir");
  const corTxt = noEscuro.shapes.find((f) => f.id === "t").color;
  ok("modelo escuro numa lâmina de texto escuro: o texto continua legível (4,5:1)", M.contrasteDeCores(corTxt, noEscuro.bg.color) >= 4.5, `${corTxt} sobre ${noEscuro.bg.color}`);
  const cantos = aplicarL(M.aplicarModelo([original], de, corp)[0], de, corp, "cantos");
  ok("cantos: as decorações do modelo (tpl:) não são arredondadas", cantos.shapes.filter((f) => f.name?.startsWith("tpl:")).every((f) => f.geom !== "roundRect"));
}

if (falhas) {
  console.log(`\n${falhas} falha(s)`);
  process.exit(1);
}
console.log("\ntudo certo");
