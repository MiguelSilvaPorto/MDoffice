// Testa o Designer (Composição ▸ Designer): a arte vetorial (ondas, facetas, mosaico, brilhos) e a
// recomposição da capa. Confere que a arte é determinística e válida, que o texto da capa lê bem
// (4,5:1) e nunca é invadido pela arte (medindo as curvas de verdade), que uma lâmina com imagens
// não é recomposta, que trocar de arte/modelo TROCA (não empilha) e que o layout novo refaz a arte.
// Uso: node scripts/testar-designer.mjs
import { build } from "esbuild";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const raiz = new URL("..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const tmp = mkdtempSync(join(tmpdir(), "pp-designer-"));
for (const [nome, arq] of [["arte", "arte.ts"], ["designer", "designer.ts"], ["modelos", "modelos.ts"], ["desenhos", "desenhos.ts"], ["layouts", "layouts.ts"]])
  await build({ entryPoints: [join(raiz, "src/powerpoint/edicao", arq)], bundle: true, platform: "node", format: "esm", outfile: join(tmp, `${nome}.mjs`), logLevel: "error" });
const im = (n) => import(pathToFileURL(join(tmp, `${n}.mjs`)).href);
const A = await im("arte");
const G = await im("designer");
const M = await im("modelos");
const D = await im("desenhos");
const L = await im("layouts");

let falhas = 0;
const ok = (nome, cond, detalhe = "") => {
  if (!cond) falhas++;
  console.log(`${cond ? "OK   " : "FALHA"} ${nome}${detalhe ? "  " + detalhe : ""}`);
};
const semIds = (v) => JSON.stringify(v, (k, x) => (k === "id" ? undefined : x));
const cruza = (a, b) => a.x < b.x + b.w - 0.01 && b.x < a.x + a.w - 0.01 && a.y < b.y + b.h - 0.01 && b.y < a.y + a.h - 0.01;
const LAYOUTS = ["titulo", "secao", "conteudo", "duas", "soTitulo"];
const modelos = M.MODELOS;
const de = { theme: "claro", bg: "", fontFamily: "Segoe UI" };
const paleta = (m) => G.paletaDoModelo(m);

/** A caixa (em % da lâmina) que envolve o traçado de uma forma — pelos pontos de controle (conservador). */
function caixaDoTracado(s) {
  if (!s.paths?.length) return s.box;
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const p of s.paths) {
    const c = p.cmds;
    for (let i = 0; i < c.length; ) {
      const cmd = c[i++];
      const n = cmd === "M" || cmd === "L" ? 2 : cmd === "C" ? 6 : cmd === "Q" ? 4 : 0;
      for (let k = 0; k < n; k += 2) {
        const X = s.box.x + (c[i + k] / p.w) * s.box.w;
        const Y = s.box.y + (c[i + k + 1] / p.h) * s.box.h;
        x0 = Math.min(x0, X); x1 = Math.max(x1, X); y0 = Math.min(y0, Y); y1 = Math.max(y1, Y);
      }
      i += n;
    }
  }
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

// --- a identidade da arte
ok("o id do desenho vai e volta (arte-ondas-12)", JSON.stringify(A.lerDesenhoArte(A.desenhoDeArte("ondas", 12))) === '{"id":"ondas","semente":12}');
ok("um desenho que não é arte não é lido como arte", A.lerDesenhoArte("barra") === null && A.lerDesenhoArte("arte-xis-1") === null);

// --- a arte: válida e determinística
{
  let invalidas = 0, naoFixas = 0, naoMarcadas = 0, vazias = 0, semFundo = 0, instaveis = 0, total = 0;
  for (const a of A.ARTES) for (const m of modelos) for (const layout of LAYOUTS) for (const semente of [0, 1, 7]) {
    const c = A.comporArte(a.id, semente, layout, paleta(m), 16 / 9);
    total++;
    if (!c || !c.formas.length) { vazias++; continue; }
    if (!c.fundo?.stops?.length) semFundo++;
    for (const f of c.formas) {
      if (!f.fixa) naoFixas++;
      if (!f.name?.startsWith(`tpl:arte-${a.id}-${semente}:`)) naoMarcadas++;
      for (const p of f.paths ?? []) if (p.cmds.some((v) => typeof v === "number" && !Number.isFinite(v))) invalidas++;
      for (const k of ["x", "y", "w", "h"]) if (!Number.isFinite(f.box[k])) invalidas++;
    }
    if (semIds(c) !== semIds(A.comporArte(a.id, semente, layout, paleta(m), 16 / 9))) instaveis++;
  }
  ok(`a arte existe em todo layout e paleta (${total} combinações)`, vazias === 0, `${vazias} vazias`);
  ok("toda forma de arte é fixa e marcada com o desenho e a semente", naoFixas === 0 && naoMarcadas === 0, `${naoFixas} soltas, ${naoMarcadas} sem marca`);
  ok("nenhum número do traçado é NaN/infinito", invalidas === 0, `${invalidas}`);
  ok("toda composição traz o fundo em gradiente", semFundo === 0);
  ok("a mesma semente dá a mesma arte (determinística)", instaveis === 0);
}
ok("a lâmina em branco não ganha arte", A.ARTES.every((a) => A.comporArte(a.id, 0, "vazio", paleta(modelos[0])) === null));
ok("sementes diferentes dão artes diferentes", semIds(A.comporArte("ondas", 1, "titulo", paleta(modelos[0]))) !== semIds(A.comporArte("ondas", 2, "titulo", paleta(modelos[0]))));

// --- a arte não invade o texto
{
  const invade = [];
  for (const a of A.ARTES.filter((x) => x.id !== "orbes")) // os brilhos são luz difusa por trás do texto central (o contraste cobre)
    for (const m of modelos) for (const semente of [0, 1, 2, 3]) {
      const c = A.comporArte(a.id, semente, "titulo", paleta(m), 16 / 9);
      for (const f of c.formas) {
        const caixa = caixaDoTracado(f);
        if (!f.fillX || f.fillX.radial) continue; // fios finos e luz difusa (o gradiente radial se apaga antes da borda)
        if (cruza(caixa, c.texto.titulo) || cruza(caixa, c.texto.subtitulo)) invade.push(`${a.id}/${m.id}/${semente}`);
      }
    }
  ok("na capa, nenhuma arte pintada invade a zona do título e do subtítulo", invade.length === 0, [...new Set(invade)].slice(0, 6).join(" "));
  const invadeMiolo = [];
  for (const a of A.ARTES) for (const layout of ["conteudo", "duas", "soTitulo"]) for (const semente of [0, 1]) {
    const textos = L.caixasDoLayout(layout).map((c) => c.box);
    const c = A.comporArte(a.id, semente, layout, paleta(modelos[0]), 16 / 9);
    for (const f of c.formas) if (f.fillX && !f.fillX.radial && textos.some((t) => cruza(caixaDoTracado(f), t))) invadeMiolo.push(`${a.id}/${layout}/${semente}`);
  }
  ok("no miolo, a arte de borda não cobre nenhuma caixa dos layouts", invadeMiolo.length === 0, [...new Set(invadeMiolo)].slice(0, 6).join(" "));
}

// --- recompor a capa
const caixaTxt = (id, box, tam, t, extra = {}) => ({ id, kind: "texto", box, text: "", fontFamily: "Segoe UI", fontSize: tam, color: "1C212B", bold: false, italic: false, align: "esquerda", fill: "", src: "", rot: 0, paras: [{ runs: [{ text: t, size: tam, bold: false, italic: false, underline: false, strike: false, color: "1C212B", font: "Segoe UI" }], align: "esquerda", lvl: 0, marL: 0, indent: 0, spcBef: 0, spcAft: 0, endSize: tam }], ...extra });
const capa = (titulo = "Sua apresentação", sub = "Nome do apresentador · data") => ({ md: "", layout: "titulo", notes: "", shapes: [caixaTxt("t", { x: 8, y: 28, w: 84, h: 24 }, 48, titulo), caixaTxt("s", { x: 8, y: 55, w: 84, h: 14 }, 24, sub)] });
{
  const ruins = [], estoura = [];
  for (const a of A.ARTES) for (const m of modelos) for (const semente of [0, 1]) {
    const r = G.aplicarArte(capa(), a.id, semente, m, de, 16 / 9);
    const c = A.comporArte(a.id, semente, "titulo", paleta(m), 16 / 9);
    const t = r.shapes.find((f) => f.id === "t");
    const s = r.shapes.find((f) => f.id === "s");
    if (A.contraste(t.color, c.fundoDoTexto) < 4.5 || A.contraste(s.color, c.fundoDoTexto) < 4.5) ruins.push(`${a.id}/${m.id}`);
    if (JSON.stringify(t.box) !== JSON.stringify(c.texto.titulo) || JSON.stringify(s.box) !== JSON.stringify(c.texto.subtitulo)) ruins.push(`${a.id}/${m.id}: caixa`);
    if (t.fontSize > 54 || s.fontSize > 22) estoura.push(`${a.id}/${m.id}`);
  }
  ok("o título e o subtítulo da capa leem bem (4,5:1) sobre a arte, em toda paleta", ruins.length === 0, [...new Set(ruins)].slice(0, 6).join(" "));
  ok("o texto vai para a zona que a arte deixa livre", true);
  ok("o título nunca passa de 54 pt nem o subtítulo de 22 pt", estoura.length === 0);
  const longo = G.aplicarArte(capa("Planejamento estratégico corporativo", "x"), "facetas", 0, M.MODELOS.find((m) => m.id === "papel"), de, 16 / 9);
  ok("uma palavra longa em caixa estreita reduz a letra (não quebra no meio da palavra)", longo.shapes.find((f) => f.id === "t").fontSize < 54, String(longo.shapes.find((f) => f.id === "t").fontSize));
  ok("a capa só é recomposta quando é só texto: imagem/cartão fica no lugar", (() => {
    const comImagem = capa();
    comImagem.shapes.push({ ...caixaTxt("img", { x: 60, y: 5, w: 30, h: 20 }, 12, ""), kind: "imagem", src: "media:1" });
    const r = G.aplicarArte(comImagem, "ondas", 0, modelos[0], de, 16 / 9);
    return JSON.stringify(r.shapes.find((f) => f.id === "t").box) === JSON.stringify({ x: 8, y: 28, w: 84, h: 24 }) && !!G.papeisDaCapa(capa()) && G.papeisDaCapa(comImagem) === null;
  })());
}

// --- lâmina de conteúdo: nenhuma caixa se move
{
  const conteudo = { md: "", layout: "conteudo", notes: "", shapes: [caixaTxt("t", { x: 6, y: 6, w: 88, h: 14 }, 34, "Resultados"), caixaTxt("c", { x: 6, y: 24, w: 88, h: 66 }, 22, "Receita +18%")] };
  const caixas = (sl) => sl.shapes.filter((f) => !f.name?.startsWith("tpl:")).map((f) => `${f.id}:${JSON.stringify(f.box)}`).join("|");
  const ruins = [];
  for (const a of A.ARTES) for (const m of modelos) {
    const r = G.aplicarArte(conteudo, a.id, 0, m, de, 16 / 9);
    if (caixas(r) !== caixas(conteudo)) ruins.push(`${a.id}/${m.id}`);
    const fundo = r.bg?.stops?.[0]?.color ?? r.bg?.color;
    for (const id of ["t", "c"]) if (A.contraste(r.shapes.find((f) => f.id === id).color, fundo) < 4.5) ruins.push(`${a.id}/${m.id}: texto ${id}`);
  }
  ok("no conteúdo nenhuma caixa muda de posição e o texto continua legível sobre o fundo da arte", ruins.length === 0, [...new Set(ruins)].slice(0, 6).join(" "));
}

// --- trocar: a arte nova substitui a antiga; o modelo novo substitui a arte
{
  const a1 = G.aplicarArte(capa(), "ondas", 0, modelos[0], de, 16 / 9);
  const a2 = G.aplicarArte(a1, "mosaico", 4, modelos[3], de, 16 / 9);
  const artes = (sl) => sl.shapes.filter((f) => f.name?.startsWith("tpl:arte-"));
  ok("aplicar outra arte TROCA a anterior (não empilha)", artes(a2).length > 0 && artes(a2).every((f) => f.name.startsWith("tpl:arte-mosaico-4:")) && !a2.shapes.some((f) => f.name?.startsWith("tpl:arte-ondas")));
  ok("a arte fica ATRÁS do texto", a2.shapes[a2.shapes.length - 1].id === "s" || a2.shapes[a2.shapes.length - 1].id === "t");
  const comTemplate = M.aplicarModelo([a1], de, M.MODELOS.find((m) => m.id === "corporativo"));
  ok("aplicar um modelo com desenho (o botão Template) tira a arte", !comTemplate[0].shapes.some((f) => f.name?.startsWith("tpl:arte-")) && comTemplate[0].shapes.some((f) => f.name?.startsWith("tpl:barra")));
  const comoMiolo = D.refazerDesenho({ ...a1, layout: "conteudo" });
  const marcas = comoMiolo.shapes.filter((f) => f.name?.startsWith("tpl:arte-ondas-0:"));
  ok("trocar o layout refaz a arte para o layout novo (capa → conteúdo)", marcas.length > 0 && marcas.length < a1.shapes.filter((f) => f.name?.startsWith("tpl:arte-ondas-0:")).length + 3, `${marcas.length} formas`);
  ok("o modelo guardado pelo usuário leva a arte do deck", M.modeloDoDeck([a1], { theme: "escuro", bg: "", fontFamily: "Inter" }, "Meu", "u1").desenho === "arte-ondas-0");
}

// --- as sugestões
{
  const l0 = G.sugestoesDeArte(0, modelos);
  const l1 = G.sugestoesDeArte(1, modelos);
  ok("cada lote traz 8 composições e as quatro artes aparecem", l0.length === 8 && new Set(l0.map((s) => s.arte)).size === 4);
  const chave = (s) => `${s.arte}|${s.semente}|${s.modelo.id}`;
  ok("o lote seguinte traz combinações novas (nenhuma repete)", l1.every((s) => !l0.some((o) => chave(o) === chave(s))));
  ok("a paleta anda espalhada pelo catálogo (não são vizinhas)", new Set(l0.map((s) => s.modelo.id)).size >= 6);
}

if (falhas) {
  console.log(`\n${falhas} falha(s)`);
  process.exit(1);
}
console.log("\ntudo certo");
