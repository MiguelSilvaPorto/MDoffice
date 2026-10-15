// Testa o motor dos Estilos de cor: a cor (HSL de ida e volta), a rampa de tons (o claro sobe,
// o escuro desce e o matiz desvia para o frio), o esquema casado (gradiente, contorno, sombra e
// texto por contraste), a aplicação na forma, a capa do brilho-dobra e o recálculo vivo
// (`atualizarEstilos`): trocar a cor ou o tema refaz a rampa, apagar a base leva a capa junto e
// a lâmina sem estilos volta a mesma referência.
// Uso: node scripts/testar-estilos.mjs
import { build } from "esbuild";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const raiz = new URL("..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const tmp = mkdtempSync(join(tmpdir(), "pp-estilos-"));
await build({ entryPoints: [join(raiz, "src/powerpoint/edicao/estilos.ts")], bundle: true, platform: "node", format: "esm", outfile: join(tmp, "estilos.mjs"), logLevel: "error" });
await build({ entryPoints: [join(raiz, "src/powerpoint/edicao/operacoes.ts")], bundle: true, platform: "node", format: "esm", outfile: join(tmp, "operacoes.mjs"), logLevel: "error" });
await build({ entryPoints: [join(raiz, "src/powerpoint/edicao/variantes.ts")], bundle: true, platform: "node", format: "esm", outfile: join(tmp, "variantes.mjs"), logLevel: "error" });
const E = await import(pathToFileURL(join(tmp, "estilos.mjs")).href);
const O = await import(pathToFileURL(join(tmp, "operacoes.mjs")).href);
const V = await import(pathToFileURL(join(tmp, "variantes.mjs")).href);

let falhas = 0;
const ok = (nome, cond, detalhe = "") => {
  if (!cond) falhas++;
  console.log(`${cond ? "OK   " : "FALHA"} ${nome}${detalhe ? "  " + detalhe : ""}`);
};
const perto = (a, b, tol = 0.01) => Math.abs(a - b) <= tol;
const pertoCor = (a, b, tol = 1) => a.length === 6 && b.length === 6 && [0, 2, 4].every((i) => Math.abs(parseInt(a.slice(i, i + 2), 16) - parseInt(b.slice(i, i + 2), 16)) <= tol);
const dim = { w: 960, h: 540 };
const tema = { acento: "1F9D55" };

/** Forma base (em % da lâmina). */
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
const lâmina = (shapes, extra = {}) => ({ md: "", layout: "conteudo", notes: "", shapes, ...extra });
const estilo = (extra = {}) => ({ familia: "esmeralda", intensidade: "media", brilho: "nada", ...extra });
/** O valor de uma parada pela posição (o meio da rampa é a cor-base). */
const parada = (fill, pos) => fill.stops.find((p) => Math.abs(p.pos - pos) < 0.01);

// ---------------------------------------------------------------- cor
{
  const cores = ["1F9D55", "E08A1E", "FFFFFF", "000000", "123456", "7A3E9D", "4A5568"];
  const ida = cores.every((c) => {
    const { h, s, l } = E.hexParaHsl(c);
    return pertoCor(E.hslParaHex(h, s, l), c);
  });
  ok("cor: HSL de ida e volta", ida);
  ok("cor: primárias do círculo", E.hslParaHex(0, 1, 0.5) === "FF0000" && E.hslParaHex(120, 1, 0.5) === "00FF00" && E.hslParaHex(240, 1, 0.5) === "0000FF");
  ok("cor: cinza sem saturação", E.hslParaHex(0, 0, 0.5) === "808080", E.hslParaHex(0, 0, 0.5));
  ok("cor: matiz fora da volta normaliza", E.hslParaHex(480, 1, 0.5) === "00FF00" && E.hslParaHex(-120, 1, 0.5) === "0000FF");
  ok("cor: contraste escuro → texto claro", E.contrastePara("1F9D55") === "FFFFFF" && E.contrastePara("0E6B52") === "FFFFFF");
  ok("cor: contraste claro → texto escuro", E.contrastePara("E08A1E") === "1F2A37" && E.contrastePara("FFFFFF") === "1F2A37");
}

// ---------------------------------------------------------------- rampa
{
  const base = "1F9D55";
  const r = E.rampaDeTons(base, "media", 20);
  const hb = E.hexParaHsl(base).h;
  const hc = E.hexParaHsl(r.claro).h;
  const he = E.hexParaHsl(r.escuro).h;
  const lb = E.hexParaHsl(base).l;
  const lc = E.hexParaHsl(r.claro).l;
  const le = E.hexParaHsl(r.escuro).l;
  ok("rampa: mantém a cor do meio", r.cor === base);
  ok("rampa: o claro sobe a luz", perto((lc - lb) * 100, 13, 1.5), `${lb} → ${lc}`);
  ok("rampa: o escuro desce a luz", perto((lb - le) * 100, 17, 1.5), `${lb} → ${le}`);
  ok("rampa: o escuro desvia o matiz para o frio (verde → teal)", perto(he - hb, 20, 2), `${hb} → ${he}`);
  ok("rampa: o claro fica na família do matiz", Math.abs(hc - hb) <= 7, `${hb} → ${hc}`);
  ok("rampa: o escuro não perde saturação", E.hexParaHsl(r.escuro).s >= E.hexParaHsl(base).s * 0.98);
  const suave = E.rampaDeTons(base, "suave", 20);
  const forte = E.rampaDeTons(base, "forte", 20);
  ok("rampa: forte abre mais que média, que abre mais que suave", E.hexParaHsl(forte.escuro).l < E.hexParaHsl(r.escuro).l && E.hexParaHsl(r.escuro).l < E.hexParaHsl(suave.escuro).l);
  const ambar = E.rampaDeTons("E08A1E", "media", -12);
  ok("rampa: o desvio negativo também vale (âmbar → quente)", perto(E.hexParaHsl(ambar.escuro).h - E.hexParaHsl("E08A1E").h, -12, 2));
}

// ---------------------------------------------------------------- esquema
{
  const esq = E.esquemaDoEstilo(estilo(), tema);
  ok("esquema: gradiente em diagonal", esq.fill.kind === "gradient" && esq.fill.angle === 45);
  ok("esquema: três paradas sem brilho", esq.fill.stops.length === 3 && parada(esq.fill, 45).color === "1F9D55");
  ok("esquema: paradas ordenadas de 0 a 100", esq.fill.stops[0].pos === 0 && esq.fill.stops[esq.fill.stops.length - 1].pos === 100);
  ok("esquema: contorno no tom profundo e fino", esq.ln.color === esq.escuro && esq.ln.w === 0.75);
  ok("esquema: sombra leve", esq.shadow.alpha === 0.18 && esq.shadow.blur === 12);
  ok("esquema: texto por contraste", esq.corTexto === "FFFFFF");
  ok("esquema: âmbar pede texto escuro", E.esquemaDoEstilo(estilo({ familia: "ambar" }), tema).corTexto === "1F2A37");

  const comBase = E.esquemaDoEstilo(estilo({ base: "112233" }), tema);
  ok("esquema: a cor do estilo vence a da família", parada(comBase.fill, 45).color === "112233");
  const doTema = E.esquemaDoEstilo(estilo({ familia: "propria", base: "" }), { acento: "336699" });
  ok("esquema: sem cor própria, usa o acento do tema", parada(doTema.fill, 45).color === "336699");
  const daFamilia = E.esquemaDoEstilo(estilo({ base: "" }), { acento: "336699" });
  ok("esquema: sem cor no estilo, a família manda (não o tema)", parada(daFamilia.fill, 45).color === "1F9D55");

  const lustro = E.esquemaDoEstilo(estilo({ brilho: "lustro" }), tema);
  const brancos = lustro.fill.stops.filter((p) => p.color === "FFFFFF" && p.alpha < 1);
  const ordenadas = lustro.fill.stops.every((p, i, a) => i === 0 || a[i - 1].pos <= p.pos);
  ok("esquema: lustro soma paradas de branco translúcido", brancos.length === E.LUSTRO.length && ordenadas, `${lustro.fill.stops.length} paradas`);
  ok("esquema: o lustro não apaga as cores da rampa", parada(lustro.fill, 0).color === lustro.claro && parada(lustro.fill, 45).color === "1F9D55" && parada(lustro.fill, 100).color === lustro.escuro);
  ok("esquema: ângulo próprio é respeitado", E.esquemaDoEstilo(estilo({ angulo: 90 }), tema).fill.angle === 90);
}

// ---------------------------------------------------------------- aplicar na forma
{
  const paras = [
    { runs: [{ text: "T.I. CAMBÉ", size: 24, bold: true, italic: false, underline: false, strike: false, color: "111111", font: "Segoe UI" }, { text: "!", size: 24, bold: true, italic: false, underline: false, strike: false, color: "FF0000", font: "Segoe UI" }], align: "esquerda", lvl: 0, marL: 0 },
  ];
  const s = forma("a", 10, 20, 30, 10, { paras, cantos: [12, 12, 12, 12], text: "T.I. CAMBÉ!" });
  const n = E.aplicarEsquemaNaForma(s, E.esquemaDoEstilo(estilo(), tema));
  ok("aplicar: preenchimento virou o gradiente do estilo", n.fillX.kind === "gradient" && parada(n.fillX, 45).color === "1F9D55");
  ok("aplicar: contorno e sombra casados", n.ln.color === n.fillX.stops[2].color && !!n.shadow);
  ok("aplicar: a cor-base do texto mudou", n.color === "FFFFFF");
  ok("aplicar: o trecho com a cor antiga acompanha", n.paras[0].runs[0].color === "FFFFFF");
  ok("aplicar: o trecho com cor própria fica", n.paras[0].runs[1].color === "FF0000");
  ok("aplicar: caixa, texto e cantos intactos", n.box === s.box && n.text === s.text && n.cantos === s.cantos);
  ok("aplicar: não muta a forma original", s.color === "111111" && !s.fillX);
}

// ---------------------------------------------------------------- capa da dobra
{
  const base = forma("a", 10, 20, 40, 12, { grupo: "g1" });
  const capa = E.capaDaDobra(base, dim);
  ok("capa: mesma caixa e giro da base", capa.box.x === base.box.x && capa.box.y === base.box.y && capa.box.w === base.box.w && capa.box.h === base.box.h && capa.rot === base.rot);
  ok("capa: presa à base", capa.capa.de === "a" && capa.grupo === "g1");
  ok("capa: caminho fechado próprio", String(capa.paths[0].cmds[0]) === "M" && capa.paths[0].cmds.includes("Z") && capa.geom === "custom");
  const alfas = capa.fillX.stops.map((p) => p.alpha);
  ok("capa: brilho translúcido e sutil", alfas.every((a) => a >= 0 && a <= 0.2) && Math.max(...alfas) > 0.1);
  ok("capa: mantém a identidade quando já existe", E.capaDaDobra(base, dim, "capa-1").id === "capa-1");
}

// ---------------------------------------------------------------- recálculo vivo
{
  const base = forma("a", 10, 20, 30, 10, { fillX: { kind: "solid", color: "CCCCCC" } });
  const outro = forma("b", 60, 60, 20, 10);

  const sem = lâmina([base, outro]);
  ok("vivo: lâmina sem estilos volta a mesma referência", E.atualizarEstilos(sem, dim, tema) === sem);

  const comEstilo = forma("a", 10, 20, 30, 10, { estilo: estilo(), color: "111111" });
  const s1 = E.atualizarEstilos(lâmina([comEstilo, outro]), dim, tema);
  const a1 = s1.shapes[0];
  ok("vivo: a forma estilizada é derivada", a1.id === "a" && a1.fillX.kind === "gradient" && a1.color === "FFFFFF");
  ok("vivo: as outras formas ficam intactas", s1.shapes[1] === outro);
  ok("vivo: a forma original não é mutada", !comEstilo.fillX && comEstilo.color === "111111");

  // trocar a cor-base refaz a rampa
  const trocada = forma("a", 10, 20, 30, 10, { estilo: estilo({ base: "C6363C" }) });
  const a2 = E.atualizarEstilos(lâmina([trocada]), dim, tema).shapes[0];
  ok("vivo: trocar a cor refaz a rampa", parada(a2.fillX, 45).color === "C6363C" && a2.color === "FFFFFF");

  // o tema acompanha quando não há cor própria; a cor fixa não muda
  const doTema = forma("a", 10, 20, 30, 10, { estilo: estilo({ familia: "propria" }) });
  const t1 = E.atualizarEstilos(lâmina([doTema]), dim, { acento: "1F9D55" }).shapes[0];
  const t2 = E.atualizarEstilos(lâmina([t1]), dim, { acento: "1D6FB8" }).shapes[0];
  ok("vivo: sem cor própria, o tema acompanha", parada(t1.fillX, 45).color === "1F9D55" && parada(t2.fillX, 45).color === "1D6FB8");
  const fixa = forma("a", 10, 20, 30, 10, { estilo: estilo({ base: "C6363C" }) });
  const f2 = E.atualizarEstilos(lâmina([E.atualizarEstilos(lâmina([fixa]), dim, { acento: "1F9D55" }).shapes[0]]), dim, { acento: "1D6FB8" }).shapes[0];
  ok("vivo: cor própria não segue o tema", parada(f2.fillX, 45).color === "C6363C");

  // a dobra cria a capa logo depois da base, com id estável, e ela acompanha a caixa
  const comDobra = forma("a", 10, 20, 30, 10, { estilo: estilo({ brilho: "dobra" }) });
  const d1 = E.atualizarEstilos(lâmina([comDobra, outro]), dim, tema);
  ok("dobra: a capa nasce logo depois da base", d1.shapes.length === 3 && d1.shapes[1].capa?.de === "a" && d1.shapes[1].name === "Brilho");
  const movida = { ...d1.shapes[0], box: { ...d1.shapes[0].box, x: 40, y: 35 } };
  const d2 = E.atualizarEstilos(lâmina([movida, outro, d1.shapes[1]]), dim, tema);
  const capa2 = d2.shapes.find((s) => s.capa);
  ok("dobra: a capa segue a caixa da base", capa2.box.x === 40 && capa2.box.y === 35);
  ok("dobra: a capa mantém a identidade no recálculo", capa2.id === d1.shapes[1].id);
  ok("dobra: o resultado é o mesmo rodando de novo (idempotente)", JSON.stringify(E.atualizarEstilos(d2, dim, tema).shapes) === JSON.stringify(d2.shapes));

  // desligar o brilho leva a capa; apagar a base também
  const semDobra = { ...movida, estilo: estilo({ brilho: "nada" }) };
  const d3 = E.atualizarEstilos(lâmina([semDobra, outro, capa2]), dim, tema);
  ok("dobra: trocar para sem brilho remove a capa", !d3.shapes.some((s) => s.capa));
  const d4 = E.atualizarEstilos(lâmina([outro, capa2]), dim, tema);
  ok("dobra: apagar a base leva a capa órfã", !d4.shapes.some((s) => s.capa));

  // fundo com estilo (a dobra vira lustro — nada de forma extra)
  const slide = lâmina([outro], { bgEstilo: estilo({ brilho: "dobra" }) });
  const c1 = E.atualizarEstilos(slide, dim, tema);
  ok("fundo: o bg vira o gradiente do estilo", c1.bg.kind === "gradient" && parada(c1.bg, 45).color === "1F9D55");
  ok("fundo: a dobra vira lustro (sem forma-capa)", c1.bg.stops.some((p) => p.color === "FFFFFF" && p.alpha < 1) && c1.shapes.length === 1);
  ok("fundo: a lâmina ganha uma referência nova", c1 !== slide && c1.shapes.length === 1);
}

// ---------------------------------------------------------------- ligar e soltar (a galeria e o painel)
{
  ok(
    "guardas: família, intensidade e brilho reconhecem só o que existe",
    E.ehFamilia("esmeralda") && !E.ehFamilia("verde") && E.ehIntensidade("forte") && !E.ehIntensidade("mediaa") && E.ehBrilho("dobra") && E.ehBrilho("lustro") && !E.ehBrilho("brilho")
  );
  const pad = E.estiloDaFamilia("esmeralda");
  ok("padrão da galeria: média, lustro e diagonal", pad.intensidade === "media" && pad.brilho === "lustro" && pad.angulo === 45 && pad.familia === "esmeralda" && pad.base === undefined);
  ok("padrão com cor própria", E.estiloDaFamilia("propria", "336699").base === "336699");

  const f1 = forma("a", 10, 10, 30, 10);
  const f2 = forma("b", 50, 50, 20, 10);
  const s1 = E.ligarEstilo(lâmina([f1, f2]), ["a"], { familia: "esmeralda", base: "" }, pad);
  ok("ligar: nasce com o padrão mais o ajuste", s1.shapes[0].estilo.familia === "esmeralda" && s1.shapes[0].estilo.brilho === "lustro" && s1.shapes[0].estilo.base === "");
  ok("ligar: só a seleção muda", s1.shapes[1] === f2);
  const s2 = E.ligarEstilo(s1, ["a"], { intensidade: "forte" }, pad);
  ok("ligar: o ajuste preserva o resto da receita", s2.shapes[0].estilo.intensidade === "forte" && s2.shapes[0].estilo.angulo === 45);
  ok("ligar: sem seleção, a lâmina volta a mesma", E.ligarEstilo(s1, [], { intensidade: "forte" }, pad) === s1);

  // o fluxo inteiro: ligar → derivar → soltar (a pintura fica como está)
  const d1 = E.atualizarEstilos(s2, dim, tema);
  ok("vivo: ligar o estilo já deriva a pintura", d1.shapes[0].fillX.kind === "gradient" && d1.shapes[0].color === "FFFFFF");
  const solto = E.soltarEstilo(d1, ["a"]);
  ok("soltar: a receita sai e a pintura fica", !solto.shapes[0].estilo && solto.shapes[0].fillX.kind === "gradient" && solto.shapes[0].ln.color === d1.shapes[0].ln.color && solto.shapes[0].color === "FFFFFF");
  ok("soltar: depois de soltar, o recálculo devolve a MESMA lâmina", E.atualizarEstilos(solto, dim, tema) === solto);
  const semEstilo = lâmina([f1]);
  ok("soltar: sem estilo para soltar, a lâmina volta a mesma", E.soltarEstilo(semEstilo, ["a"]) === semEstilo);

  // a capa da dobra vira forma comum (não some) quando o estilo é solto
  const comDobra = forma("a", 10, 10, 30, 10, { estilo: { ...E.estiloDaFamilia("esmeralda"), brilho: "dobra" } });
  const d2 = E.atualizarEstilos(lâmina([comDobra]), dim, tema);
  const solto2 = E.soltarEstilo(d2, ["a"]);
  ok("soltar: a capa da dobra fica como forma comum", solto2.shapes.length === 2 && !solto2.shapes[1].capa && !solto2.shapes[0].estilo);
}

// ---------------------------------------------------------------- a dobra agrupada e a cópia (R3)
{
  const base = forma("a", 10, 10, 30, 10, { estilo: { ...E.estiloDaFamilia("esmeralda"), brilho: "dobra" } });
  const d1 = E.atualizarEstilos(lâmina([base]), dim, tema);
  const [b1, c1] = d1.shapes;
  ok("dobra: a base e a capa nascem no mesmo grupo", !!b1.grupo && b1.grupo === c1.grupo, JSON.stringify([b1.grupo, c1.grupo]));
  ok("dobra: a capa continua vizinha da base", c1.capa?.de === "a" && d1.shapes.length === 2);

  // desagrupar manda: o recálculo não volta a agrupar (o grupo só nasce junto da capa)
  const desagrupado = O.desagruparFormas(d1, ["a"]);
  const d2 = E.atualizarEstilos(desagrupado, dim, tema);
  ok("dobra: depois de desagrupar, o recálculo respeita", !d2.shapes[0].grupo && !d2.shapes[1].grupo && d2.shapes[1].capa?.de === "a");

  // copiar a base + a capa: o grude acompanha as cópias (e o grupo é novo)
  const copiadas = O.clonarFormas(d1.shapes);
  const [b2, c2] = copiadas;
  ok("cópia: a capa fica presa na CÓPIA da base", c2.capa?.de === b2.id && b2.id !== b1.id);
  ok("cópia: o grupo é novo e compartilhado pelas duas", !!b2.grupo && b2.grupo === c2.grupo && b2.grupo !== b1.grupo);
  ok("cópia: a base copiada continua com o estilo vivo", b2.estilo?.brilho === "dobra" && b2.estilo?.familia === "esmeralda");

  // copiar só a capa: vira forma comum (sem grude inventado)
  const soCapa = O.clonarFormas([c1])[0];
  ok("cópia: copiar só a capa solta o grude", !soCapa.capa && soCapa.id !== c1.id);
}

// ---------------------------------------------------------------- o fundo com estilo (R4)
{
  const semFundo = lâmina([]);
  const l1 = E.ligarEstiloFundo(semFundo, { familia: "esmeralda", base: "" }, E.estiloDaFamilia("esmeralda"));
  ok("fundo: ligar cria a receita", l1.bgEstilo.familia === "esmeralda" && l1.bgEstilo.brilho === "lustro" && l1.bgEstilo.angulo === 45);
  const d1 = E.atualizarEstilos(l1, dim, tema);
  ok("fundo: o bg vira o gradiente da rampa", d1.bg.kind === "gradient" && parada(d1.bg, 45).color === "1F9D55");
  const l2 = E.ligarEstiloFundo(d1, { intensidade: "forte" }, E.estiloDaFamilia("esmeralda"));
  ok("fundo: ajustar preserva o resto da receita", l2.bgEstilo.intensidade === "forte" && l2.bgEstilo.familia === "esmeralda");
  const solto = E.soltarEstiloFundo(d1);
  ok("fundo: soltar remove a receita e mantém o gradiente como pintura", !solto.bgEstilo && solto.bg.kind === "gradient");
  ok("fundo: depois de soltar, o recálculo devolve a MESMA lâmina", E.atualizarEstilos(solto, dim, tema) === solto);
  ok("fundo: sem estilo, soltar devolve a mesma lâmina", E.soltarEstiloFundo(semFundo) === semFundo);
  const doTema = E.ligarEstiloFundo(semFundo, {}, E.estiloDaFamilia("propria"));
  ok("fundo: sem cor própria, usa o acento do tema", parada(E.atualizarEstilos(doTema, dim, { acento: "336699" }).bg, 45).color === "336699");
  const comDobra = E.ligarEstiloFundo(semFundo, { brilho: "dobra" }, E.estiloDaFamilia("esmeralda"));
  const d2 = E.atualizarEstilos(comDobra, dim, tema);
  ok("fundo: a dobra vira lustro (e não cria forma)", d2.bg.stops.some((p) => p.color === "FFFFFF" && p.alpha < 1) && d2.shapes.length === 0);
}

// ---------------------------------------------------------------- as variantes da aba Design
// Cada variante é um MODELO (a mesma estrutura do Template e das Ideias): a família dá a rampa, o
// acento e o fundo, e o Estilo de Cor segue a família — a prévia do cartão é o próprio
// `aplicarModelo` na lâmina atual, então o cartão mostra o que o clique aplica.
{
  const lista = V.modelosDasVariantes("Inter");
  ok("variantes: uma por família (6)", lista.length === 6 && V.FAMILIAS_VARIANTE.length === 6, JSON.stringify(lista.map((m) => m.nome)));
  ok("variantes: ids únicos e estáveis", new Set(lista.map((m) => m.id)).size === 6 && lista.every((m) => m.id.startsWith("variante-")), JSON.stringify(lista.map((m) => m.id)));
  ok("variantes: a Grafite é a única escura", lista.find((m) => m.id === "variante-grafite")?.tema === "escuro" && lista.filter((m) => m.tema === "escuro").length === 1);
  const esmeralda = lista[0];
  ok("variantes: o acento é a cor da família", esmeralda.cores.accent === E.FAMILIAS.esmeralda.base, JSON.stringify(esmeralda.cores));
  ok("variantes: o estilo segue a família (o fundo nasce com a rampa)", esmeralda.estilo?.familia === "esmeralda" && esmeralda.estilo?.intensidade === "media" && esmeralda.estilo?.brilho === "nada");
  ok("variantes: a fonte é a do deck (a variante troca a cor, não a tipografia)", lista.every((m) => m.fonte === "Inter"));
  ok("variantes: o fundo e o texto contrastam", lista.every((m) => E.luminancia(m.cores.bg) > 128 ? E.luminancia(m.cores.fg) < 128 : E.luminancia(m.cores.fg) > 128), JSON.stringify(lista.map((m) => [m.cores.bg, m.cores.fg])));
}

console.log(falhas ? `\n${falhas} falha(s)` : "\ntudo certo");
process.exit(falhas ? 1 : 0);
