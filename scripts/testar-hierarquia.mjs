// Testa a Arrumação em HIERARQUIA e as garantias do Designer ao mexer no conteúdo:
//  - o organograma é entendido (pai/filho pelos conectores) e redesenhado, com conectores novos;
//  - o que já está arrumado (uma fileira de cartões iguais) NÃO é movido;
//  - nenhum arranjo é oferecido se espreme o texto, sobrepõe cartões ou cai sobre um texto que fica;
//  - o Designer remove o desenho antigo do slide (triângulo, pontilhado, barrinha) e não move o que já está bem.
// Uso: node scripts/testar-hierarquia.mjs
import { build } from "esbuild";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const raiz = new URL("..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const tmp = mkdtempSync(join(tmpdir(), "pp-hier-"));
for (const [nome, arq] of [["arranjos", "arranjos.ts"], ["designer", "designer.ts"], ["modelos", "modelos.ts"], ["sugestoes", "sugestoes.ts"]])
  await build({ entryPoints: [join(raiz, "src/powerpoint/edicao", arq)], bundle: true, platform: "node", format: "esm", outfile: join(tmp, `${nome}.mjs`), logLevel: "error" });
const im = (n) => import(pathToFileURL(join(tmp, `${n}.mjs`)).href);
const A = await im("arranjos");
const G = await im("designer");
const M = await im("modelos");
const S = await im("sugestoes");

let falhas = 0;
const ok = (nome, cond, detalhe = "") => {
  if (!cond) falhas++;
  console.log(`${cond ? "OK   " : "FALHA"} ${nome}${detalhe ? "  " + detalhe : ""}`);
};
const RATIO = 16 / 9;
let n = 0;
const base = (extra) => ({ id: `s${++n}`, kind: "forma", text: "", fontFamily: "Segoe UI", fontSize: 14, color: "1C212B", bold: false, italic: false, align: "esquerda", fill: "", src: "", rot: 0, ...extra });
const cartao = (x, y, w, h, extra = {}) => base({ box: { x, y, w, h }, geom: "roundRect", fill: "0A7B3E", fillX: { kind: "solid", color: "0A7B3E", alpha: 1 }, ...extra });
const texto = (x, y, w, h, t, tam = 14) => base({ kind: "texto", box: { x, y, w, h }, fontSize: tam, paras: [{ runs: [{ text: t, size: tam, bold: false, italic: false, underline: false, strike: false, color: "1C212B", font: "Segoe UI" }], align: "esquerda", lvl: 0, marL: 0, indent: 0, spcBef: 0, spcAft: 0, endSize: tam }] });
const fio = (x, y, w, h) => base({ box: { x, y, w, h }, geom: "rect", fill: "0A7B3E", fillX: { kind: "solid", color: "0A7B3E", alpha: 1 } });
const lamina = (shapes, layout = "conteudo") => ({ md: "", layout, notes: "", shapes });
const caixaDe = (sl, id) => sl.shapes.find((f) => f.id === id)?.box;
const cx = (b) => b.x + b.w / 2;
const cy = (b) => b.y + b.h / 2;
const de = { theme: "claro", bg: "", fontFamily: "Segoe UI" };

// ---------------------------------------------------------------- um organograma (como os do deck da equipe)
function organograma() {
  const titulo = texto(5, 4, 60, 9, "Nossa equipe", 30);
  const ana = cartao(35, 16, 30, 9);
  const bruno = cartao(35, 34, 30, 9);
  const i1 = cartao(6, 54, 26, 9);
  const i2 = cartao(37, 54, 26, 9);
  const i3 = cartao(68, 54, 26, 9);
  const rotulo = (c, t) => texto(c.box.x + 1, c.box.y + 2, c.box.w - 2, 5, t, 14);
  const textos = [rotulo(ana, "Ana Portela"), rotulo(bruno, "Bruno Perondi"), rotulo(i1, "Araucária"), rotulo(i2, "Cambé"), rotulo(i3, "SAP")];
  // conectores finos (como num deck importado): hastes e barramento
  const c1 = fio(49.9, 25, 0.25, 9); // Ana -> Bruno
  const c2 = fio(49.9, 43, 0.25, 5.5); // Bruno -> barramento
  const bus = fio(18.9, 48.4, 62.3, 0.35);
  const d1 = fio(18.9, 48.4, 0.25, 5.6);
  const d2 = fio(49.9, 48.4, 0.25, 5.6);
  const d3 = fio(81, 48.4, 0.25, 5.6);
  const lamina0 = lamina([titulo, ana, bruno, i1, i2, i3, ...textos, c1, c2, bus, d1, d2, d3]);
  return { sl: lamina0, ids: { titulo, ana, bruno, i1, i2, i3 }, conectores: [c1, c2, bus, d1, d2, d3] };
}
{
  const o = organograma();
  const novo = A.aplicarArranjo(o.sl, "hierarquia", 0, RATIO);
  const { ana, bruno, i1, i2, i3, titulo } = o.ids;
  const B = (c) => caixaDe(novo, c.id);
  ok("a hierarquia mudou a lâmina (entendeu a árvore)", novo !== o.sl);
  ok("é oferecida: legível, sem sobreposição e o texto cabe", A.arranjoLegivel(o.sl, novo));
  ok("os níveis descem: gerente → supervisor → áreas", cy(B(ana)) < cy(B(bruno)) && cy(B(bruno)) < cy(B(i1)) && Math.abs(cy(B(i1)) - cy(B(i2))) < 0.5);
  ok("o pai fica CENTRADO sobre os filhos", Math.abs(cx(B(bruno)) - (cx(B(i1)) + cx(B(i3))) / 2) < 1.5, `${cx(B(bruno)).toFixed(1)} × ${((cx(B(i1)) + cx(B(i3))) / 2).toFixed(1)}`);
  ok("as caixas do mesmo nível têm o mesmo tamanho", Math.abs(B(i1).w - B(i2).w) < 0.2 && Math.abs(B(i2).w - B(i3).w) < 0.2 && Math.abs(B(i1).h - B(i3).h) < 0.2);
  ok("o título (que fica onde está) não se move", JSON.stringify(B(titulo)) === JSON.stringify(titulo.box));
  const antigos = new Set(o.conectores.map((c) => c.id));
  const novos = novo.shapes.filter((f) => f.name === "arr:conector");
  ok("os conectores antigos saem e entram conectores NOVOS", !novo.shapes.some((f) => antigos.has(f.id)) && novos.length >= 5, `${novos.length} novos`);
  ok("os conectores novos usam a cor dos antigos", novos.every((f) => f.fillX?.color === "0A7B3E"));
  // cada filho tem uma descida que termina na borda de cima dele
  const desce = (c) => novos.some((f) => f.box.w < f.box.h && Math.abs(cx(f.box) - cx(B(c))) < 0.3 && Math.abs(f.box.y + f.box.h - B(c).y) < 0.8);
  ok("cada filho recebe a descida do conector até a borda de cima", [i1, i2, i3, bruno].every(desce));
  ok("os conectores ficam ATRÁS dos cartões", novo.shapes.findIndex((f) => f.name === "arr:conector") < novo.shapes.findIndex((f) => f.id === ana.id));
  const lado = A.aplicarArranjo(o.sl, "hierarquia-lado", 0, RATIO);
  const L = (c) => caixaDe(lado, c.id);
  ok("de lado: a raiz fica à esquerda e os níveis vão para a direita", L(ana).x + L(ana).w <= L(bruno).x + 0.5 && L(bruno).x + L(bruno).w <= L(i1).x + 0.5);
  // rearranjar não empilha conectores
  const duas = A.aplicarArranjo(novo, "hierarquia-lado", 0, RATIO);
  ok("arrumar de novo não deixa conectores da arrumação anterior", duas.shapes.filter((f) => f.name === "arr:conector").length <= 12);
  // lâmina sem hierarquia: nada
  const semArvore = lamina([cartao(5, 40, 25, 20), cartao(37, 40, 25, 20), cartao(69, 40, 25, 20)]);
  ok("uma lâmina sem hierarquia devolve a mesma lâmina (o cartão não é oferecido)", A.aplicarArranjo(semArvore, "hierarquia", 0, RATIO) === semArvore && !A.arranjoLegivel(semArvore, semArvore));
}

// ---------------------------------------------------------------- o slide do relato: três cartões em fileira + parágrafo + desenho antigo
function capaComCartoes() {
  const tit1 = texto(5, 8, 70, 9, "TECNOLOGIA DA INFORMAÇÃO", 40);
  const tit2 = texto(5, 17, 70, 9, "SEJA BEM-VINDO À IMCOPA!", 40);
  const par = texto(5, 29, 62, 18, "Este guia foi desenvolvido pelo time de TI para apoiar sua integração com nossos sistemas, ferramentas e equipamentos. Nosso objetivo é garantir que você tenha o conhecimento e os recursos necessários.", 14);
  const cartoes = [6, 36.5, 67].flatMap((x) => {
    const c = cartao(x, 66, 27, 22, { fill: "FFFFFF", fillX: { kind: "solid", color: "FFFFFF", alpha: 1 } });
    return [c, texto(x + 2, 74, 23, 4, "Recursos & Sistemas", 13), texto(x + 2, 79, 23, 8, "Padronização de computadores corporativos, ferramentas de produtividade e conectividade estável.", 10)];
  });
  const triangulo = base({ box: { x: 82, y: 0, w: 18, h: 30 }, geom: "triangle", fill: "0A9B4E", fillX: { kind: "solid", color: "0A9B4E", alpha: 0.9 } });
  const pontos = Array.from({ length: 9 }, (_, i) => base({ box: { x: 88 + (i % 3) * 2, y: 4 + Math.floor(i / 3) * 3.5, w: 0.7, h: 1.2 }, geom: "ellipse", fill: "6DC9A0", fillX: { kind: "solid", color: "6DC9A0", alpha: 1 } }));
  const barra = fio(5, 5, 4, 0.5);
  const logo = base({ kind: "imagem", box: { x: 90, y: 90, w: 6, h: 6 }, src: "media:1" });
  return { sl: lamina([triangulo, ...pontos, barra, tit1, tit2, par, ...cartoes, logo], "titulo"), cartoes: cartoes.filter((c) => c.geom === "roundRect"), triangulo, pontos, barra, logo, par };
}
{
  const c = capaComCartoes();
  const ep = A.enfeitesDa(c.sl);
  ok("o desenho antigo é reconhecido: triângulo, pontilhado e barrinha", ep.has(c.triangulo.id) && c.pontos.every((p) => ep.has(p.id)) && ep.has(c.barra.id));
  // os traços que LIGAM cartões não são enfeite: o Designer não os apaga (a hierarquia os redesenha)
  const org = organograma();
  const epo = A.enfeitesDa(org.sl);
  ok("os conectores de um organograma (hastes, barramento, descidas) NÃO são tratados como enfeite", org.conectores.every((k) => !epo.has(k.id)));
  const rodape = fio(5, 92, 90, 0.4);
  ok("um separador comprido (rodapé) também fica", !A.enfeitesDa(lamina([...org.sl.shapes, rodape])).has(rodape.id));
  ok("cartões, textos e o logotipo NÃO são tratados como enfeite", !c.cartoes.some((k) => ep.has(k.id)) && !ep.has(c.logo.id) && !ep.has(c.par.id));
  ok("uma fileira de cartões iguais já está arrumada: o Designer não a move", A.melhorArranjo(c.sl, RATIO) === c.sl);
  const exec = M.MODELOS.find((m) => m.id === "executivo");
  for (const arte of ["ondas", "facetas", "mosaico", "orbes"]) {
    const r = G.aplicarArte(c.sl, arte, 3, exec, de, RATIO);
    const mesmos = c.cartoes.every((k) => JSON.stringify(caixaDe(r, k.id)) === JSON.stringify(k.box));
    ok(`${arte}: os três cartões ficam EXATAMENTE onde estavam`, mesmos);
    ok(`${arte}: o triângulo, o pontilhado e a barrinha antigos saem`, !r.shapes.some((f) => f.id === c.triangulo.id || f.id === c.barra.id || c.pontos.some((p) => p.id === f.id)));
    ok(`${arte}: o parágrafo e o logotipo continuam`, !!caixaDe(r, c.par.id) && !!caixaDe(r, c.logo.id));
    const art = r.shapes.filter((f) => f.name?.startsWith("tpl:arte-"));
    // a arte não cobre o conteúdo: nenhuma forma de arte pintada cai sobre o texto ou os cartões
    const conteudo = r.shapes.filter((f) => !f.fixa && !f.name?.startsWith("tpl:") && (f.paras?.length || f.geom === "roundRect")).map((f) => f.box);
    const cobre = art.filter((f) => f.fillX && !f.fillX.radial).filter((f) => {
      let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
      for (const p of f.paths ?? []) for (let i = 0; i < p.cmds.length; ) {
        const cmd = p.cmds[i++];
        const k = cmd === "M" || cmd === "L" ? 2 : cmd === "C" ? 6 : cmd === "Q" ? 4 : 0;
        for (let j = 0; j < k; j += 2) { const X = f.box.x + (p.cmds[i + j] / p.w) * f.box.w, Y = f.box.y + (p.cmds[i + j + 1] / p.h) * f.box.h; x0 = Math.min(x0, X); x1 = Math.max(x1, X); y0 = Math.min(y0, Y); y1 = Math.max(y1, Y); }
        i += k;
      }
      const b = f.paths?.length ? { x: x0, y: y0, w: x1 - x0, h: y1 - y0 } : f.box;
      return conteudo.some((t) => Math.min(b.x + b.w, t.x + t.w) - Math.max(b.x, t.x) > 0.5 && Math.min(b.y + b.h, t.y + t.h) - Math.max(b.y, t.y) > 0.5);
    });
    ok(`${arte}: a arte nova não cobre os textos nem os cartões`, art.length > 0 && cobre.length === 0, `${cobre.length} cobrem`);
  }
  // o arranjo manual (botão Arrumação) também não pode cair sobre o parágrafo
  for (const [id, v] of [["lista", 0], ["grade", 2], ["destaque", 0], ["faixa", 0]]) {
    const novo = A.aplicarArranjo(c.sl, id, v, RATIO);
    ok(`o arranjo ${id} só é oferecido se não cobrir o parágrafo nem cortar o texto`, !A.arranjoLegivel(c.sl, novo) || [...c.cartoes].every((k) => { const b = caixaDe(novo, k.id); const p = c.par.box; return !(Math.min(b.x + b.w, p.x + p.w) - Math.max(b.x, p.x) > 0 && Math.min(b.y + b.h, p.y + p.h) - Math.max(b.y, p.y) > 0); }));
  }
}

// ---------------------------------------------------------------- o texto espremido (o pior caso do relato)
{
  const longo = "Padrões de e-mail, portal e domínio: o nome de usuário segue o primeiro nome e o último sobrenome, sem acentos, e a senha deve ser trocada no primeiro acesso ao sistema corporativo da empresa.";
  const c1 = cartao(8, 30, 40, 55, { fill: "FFFFFF", fillX: { kind: "solid", color: "FFFFFF", alpha: 1 } });
  const c2 = cartao(52, 30, 40, 55, { fill: "FFFFFF", fillX: { kind: "solid", color: "FFFFFF", alpha: 1 } });
  const t1 = texto(10, 33, 36, 50, longo, 14);
  const t2 = texto(54, 33, 36, 50, longo, 14);
  const original = lamina([texto(5, 6, 80, 10, "Senhas", 30), c1, t1, c2, t2]);
  const espremido = { ...original, shapes: original.shapes.map((f) => (f.id === c1.id ? { ...f, box: { x: 8, y: 30, w: 14, h: 30 } } : f.id === t1.id ? { ...f, box: { x: 9, y: 31, w: 12, h: 28 } } : f)) };
  ok("um parágrafo espremido numa coluna estreita reprova (o texto vazaria)", !A.arranjoLegivel(original, espremido));
  const sobreposto = { ...original, shapes: original.shapes.map((f) => (f.id === c2.id ? { ...f, box: { x: 20, y: 40, w: 40, h: 55 } } : f.id === t2.id ? { ...f, box: { x: 22, y: 43, w: 36, h: 50 } } : f)) };
  ok("dois cartões sobrepostos reprovam (tudo num lugar só)", !A.arranjoLegivel(original, sobreposto));
  // nenhuma fórmula entrega um resultado que vaza ou se sobrepõe
  const ruins = [];
  for (const [id, v] of [["grade", 2], ["grade", 3], ["lista", 0], ["destaque", 0], ["faixa", 0], ["hierarquia", 0], ["hierarquia-lado", 0]]) {
    const novo = A.aplicarArranjo(original, id, v, RATIO);
    if (!A.arranjoLegivel(original, novo)) continue; // não oferecida: ótimo
    const b1 = caixaDe(novo, c1.id), b2 = caixaDe(novo, c2.id);
    const inter = Math.min(b1.x + b1.w, b2.x + b2.w) - Math.max(b1.x, b2.x) > 0 && Math.min(b1.y + b1.h, b2.y + b2.h) - Math.max(b1.y, b2.y) > 0;
    if (inter || b1.w < 15 || b2.w < 15) ruins.push(`${id}${v || ""}`);
  }
  ok("toda fórmula oferecida mantém os cartões separados e largos o bastante para o parágrafo", ruins.length === 0, ruins.join(" "));
}

// ---------------------------------------------------------------- o Fluxo: blocos de tamanhos diferentes (um infográfico)
{
  const bloco = (x, y, w, h, t) => {
    const c = cartao(x, y, w, h, { fill: "FFFFFF", fillX: { kind: "solid", color: "FFFFFF", alpha: 1 } });
    return { c, formas: [c, texto(x + 1, y + 1, w - 2, Math.min(h - 2, 6), t, 12)] };
  };
  const bs = [bloco(5, 20, 40, 20, "Um"), bloco(50, 22, 45, 8, "Dois"), bloco(5, 50, 20, 25, "Três"), bloco(30, 52, 30, 12, "Quatro"), bloco(65, 55, 28, 15, "Cinco")];
  const sl = lamina(bs.flatMap((b) => b.formas));
  const novo = A.aplicarArranjo(sl, "fluxo", 0, RATIO);
  ok("o Fluxo é oferecido numa lâmina de blocos variados (grade e lista exigem blocos iguais)", novo !== sl && A.arranjoLegivel(sl, novo), A.motivosDoArranjo(sl, novo).slice(0, 2).join(" | "));
  const razoes = bs.map((b) => caixaDe(novo, b.c.id).w / b.c.box.w);
  ok("cada bloco MANTÉM a proporção e todos escalam igual (nenhum vira outro tamanho)", razoes.every((r) => Math.abs(r - razoes[0]) < 0.01) && bs.every((b) => Math.abs(caixaDe(novo, b.c.id).h / b.c.box.h - razoes[0]) < 0.01), razoes.map((r) => r.toFixed(2)).join(" "));
  const cxs = bs.map((b) => caixaDe(novo, b.c.id));
  ok("os blocos não se sobrepõem e ficam dentro da lâmina", cxs.every((c, i) => c.x >= 0 && c.y >= 0 && c.x + c.w <= 100 && c.y + c.h <= 100 && cxs.every((d, j) => j <= i || !(Math.min(c.x + c.w, d.x + d.w) - Math.max(c.x, d.x) > 0.01 && Math.min(c.y + c.h, d.y + d.h) - Math.max(c.y, d.y) > 0.01))));
  ok("o texto de cada bloco anda com ele (continua dentro do cartão)", bs.every((b) => { const c = caixaDe(novo, b.c.id); const f = caixaDe(novo, b.formas[1].id); return f.x >= c.x - 0.01 && f.y >= c.y - 0.01 && f.x + f.w <= c.x + c.w + 0.01 && f.y + f.h <= c.y + c.h + 0.01; }));
  // um slide diagramado em COLUNAS de alturas diferentes cabe sem encolher (as linhas desperdiçariam espaço)
  const col = [bloco(6, 22, 42, 5, "a"), bloco(6, 30, 42, 20, "b"), bloco(6, 53, 42, 20, "c"), bloco(54, 22, 42, 40, "d"), bloco(54, 65, 42, 17, "e")];
  const slc = lamina(col.flatMap((b) => b.formas));
  const nc = A.aplicarArranjo(slc, "fluxo", 0, RATIO);
  const k = caixaDe(nc, col[1].c.id).w / col[1].c.box.w;
  ok("um slide em colunas de alturas diferentes cabe quase sem encolher (colunas, não linhas)", k >= 0.85, `escala ${k.toFixed(2)}`);
}

// ---------------------------------------------------------------- a imagem de canto é arte; a legenda anda com o cartão
{
  const canto = base({ kind: "imagem", box: { x: 75, y: 0, w: 25, h: 33 }, src: "media:9", fill: "", fillX: undefined });
  const cartoes = [6, 36, 66].map((x) => cartao(x, 55, 26, 25, { fill: "FFFFFF", fillX: { kind: "solid", color: "FFFFFF", alpha: 1 } }));
  const sl = lamina([canto, ...cartoes, texto(8, 60, 22, 6, "Alfa", 12), texto(38, 60, 22, 6, "Beta", 12), texto(68, 60, 22, 6, "Gama", 12)]);
  const un = A.unidadesDa(sl);
  ok("a imagem que sangra pelo canto é arte, não um cartão", un.length === 3 && !un.some((u) => u.ids.includes(canto.id)), `${un.length} unidades`);
  const cartaoA = cartao(6, 30, 40, 20, { fill: "FFFFFF", fillX: { kind: "solid", color: "FFFFFF", alpha: 1 } });
  const cartaoB = cartao(54, 30, 40, 20, { fill: "FFFFFF", fillX: { kind: "solid", color: "FFFFFF", alpha: 1 } });
  const legenda = texto(8, 52.5, 36, 6, "Legenda do primeiro cartão", 11);
  const sl2 = lamina([cartaoA, texto(8, 33, 36, 6, "Primeiro", 14), cartaoB, texto(56, 33, 36, 6, "Segundo", 14), legenda]);
  const dono = A.unidadesDa(sl2).find((u) => u.ids.includes(cartaoA.id));
  ok("a legenda logo abaixo do cartão (até 3,5) faz parte dele e anda junto", dono.ids.includes(legenda.id));
}

// ---------------------------------------------------------------- o texto escala junto com a caixa (sem inflar)
{
  const c1 = cartao(6, 30, 40, 22), c2 = cartao(54, 30, 40, 22), c3 = cartao(6, 60, 40, 22), c4 = cartao(54, 60, 40, 22);
  const rotulo = texto(8, 33, 36, 4, "Etiqueta", 6);
  const titulo = texto(8, 38, 36, 6, "Título do cartão", 20);
  const sl = lamina([c1, rotulo, titulo, c2, texto(56, 33, 36, 6, "x", 12), c3, texto(8, 63, 36, 6, "y", 12), c4, texto(56, 63, 36, 6, "z", 12)]);
  const novo = A.aplicarArranjo(sl, "grade", 3, RATIO);
  const tam = (id) => novo.shapes.find((f) => f.id === id).paras[0].runs[0].size;
  ok("uma letra de 6 pt NÃO é inflada para 8 pt dentro de uma caixa que encolheu", tam(rotulo.id) <= 6.01, `${tam(rotulo.id)} pt`);
  const k = caixaDe(novo, c1.id).w / c1.box.w;
  ok("a letra grande acompanha a caixa na mesma proporção (sem piso que quebre o encaixe)", Math.abs(tam(titulo.id) - Math.max(6, 20 * k)) < 0.6, `${tam(titulo.id)} pt (k=${k.toFixed(2)})`);
}

// ---------------------------------------------------------------- o Designer não piora o que já está bem
{
  const bloco = (x, y, w, h) => [cartao(x, y, w, h, { fill: "FFFFFF", fillX: { kind: "solid", color: "FFFFFF", alpha: 1 } })];
  // cinco cartões de processo na fileira de cima + um bloco largo embaixo: o Fluxo só os encolheria
  const sl = lamina([...[5, 23, 41, 59, 77].flatMap((x) => bloco(x, 25, 17, 22)), ...bloco(5, 55, 90, 15), ...bloco(5, 74, 40, 14)]);
  const melhor = A.melhorArranjo(sl, RATIO);
  const fluxo = A.aplicarArranjo(sl, "fluxo", 0, RATIO);
  const k = caixaDe(fluxo, sl.shapes[0].id).w / sl.shapes[0].box.w;
  ok("o Designer não aplica um arranjo que só encolhe os blocos (o que já estava bem fica)", melhor === sl || k >= 0.95, `escala do fluxo ${k.toFixed(2)}`);
}

// ---------------------------------------------------------------- o painel diz POR QUE não há arranjo
{
  const fileira = lamina([0, 1, 2].map((i) => cartao(6 + i * 31, 60, 27, 22, { fill: "FFFFFF", fillX: { kind: "solid", color: "FFFFFF", alpha: 1 } })));
  ok("cartões já alinhados e iguais: o painel diz que não há o que arrumar", /já estão alinhados/.test(A.explicarSemArranjo(fileira)));
  ok("sem cartões nem blocos: o painel diz que não há o que arrumar", /não tem cartões nem blocos/.test(A.explicarSemArranjo(lamina([texto(5, 5, 60, 10, "Só um título", 30)]))));
}

// ---------------------------------------------------------------- o modo Tudo não pode ficar com UM cartão
{
  const legiveis = [{ arranjo: "grade", variante: 3 }];
  const lote = S.sugestoesDe({ unidades: 11, arrumavel: true, arrumacoes: legiveis, modelos: M.MODELOS, lote: 0 });
  const pares = new Set(lote.map((s) => `${s.arranjo}|${s.variante}|${s.modelo.id}|${s.tratamento}`));
  ok("com UMA arrumação que funciona, o modo Tudo ainda traz 8 cartões diferentes (varia o visual)", lote.length === 8 && pares.size >= 7, `${lote.length} cartões, ${pares.size} distintos`);
  ok("os cartões do lote seguinte são outros", S.sugestoesDe({ unidades: 11, arrumavel: true, arrumacoes: legiveis, modelos: M.MODELOS, lote: 1 }).every((s) => !pares.has(`${s.arranjo}|${s.variante}|${s.modelo.id}|${s.tratamento}`)));
  ok("com duas unidades não se oferece hierarquia (precisa de três cartões)", !S.arrumacoesDe(2).some((a) => a.arranjo.startsWith("hierarquia")) && S.arrumacoesDe(3).some((a) => a.arranjo === "hierarquia"));
  ok("sem nenhuma arrumação que funcione, as sugestões saem só de visual", S.sugestoesDe({ unidades: 11, arrumavel: false, modelos: M.MODELOS, lote: 0 }).every((s) => s.arranjo === null));
}

if (falhas) {
  console.log(`\n${falhas} falha(s)`);
  process.exit(1);
}
console.log("\ntudo certo");
