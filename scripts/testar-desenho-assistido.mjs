// Testa o desenho à mão assistido (Draw): traços sintéticos "tremidos" viram a forma certa,
// o que não é reconhecido fica como desenho livre e a forma montada sai com o pincel certo.
// Uso: node scripts/testar-desenho-assistido.mjs
import { build } from "esbuild";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const raiz = new URL("..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const tmp = mkdtempSync(join(tmpdir(), "pp-desenho-"));
await build({ entryPoints: [join(raiz, "src/powerpoint/edicao/desenho.ts")], bundle: true, platform: "node", format: "esm", outfile: join(tmp, "desenho.mjs"), logLevel: "error" });
const D = await import(pathToFileURL(join(tmp, "desenho.mjs")).href);

let falhas = 0;
const ok = (nome, cond, detalhe = "") => {
  if (!cond) falhas++;
  console.log(`${cond ? "OK   " : "FALHA"} ${nome}${detalhe ? "  " + detalhe : ""}`);
};
const perto = (a, b, tol = 0.01) => Math.abs(a - b) <= tol;
const pertoCaixa = (b, x, y, w, h, tol = 7) => perto(b.x, x, tol) && perto(b.y, y, tol) && perto(b.w, w, tol) && perto(b.h, h, tol);

// PRNG determinístico (mulberry32): o "tremor da mão" é sempre o mesmo
const rng = (seed) => () => {
  seed |= 0;
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const tremor = (r, amp) => (r() - 0.5) * amp * 2;

/** Trecho reto com tremor e "ganchos" nas pontas (como a mão faz). */
function reta(x0, y0, x1, y1, n = 40, amp = 2.5, seed = 11) {
  const r = rng(seed);
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const gancho = i === 0 || i === n ? 3 : 1;
    pts.push({ x: x0 + (x1 - x0) * t + tremor(r, amp * gancho), y: y0 + (y1 - y0) * t + tremor(r, amp * gancho) });
  }
  return pts;
}

/** Caminha um polígono fechado (volta ao primeiro vértice). */
function percorrer(vertices, porAresta = 16, amp = 2.5, seed = 7) {
  const r = rng(seed);
  const pts = [];
  for (let i = 0; i < vertices.length; i++) {
    const a = vertices[i];
    const b = vertices[(i + 1) % vertices.length];
    for (let k = 0; k < porAresta; k++) {
      const t = k / porAresta;
      pts.push({ x: a.x + (b.x - a.x) * t + tremor(r, amp), y: a.y + (b.y - a.y) * t + tremor(r, amp) });
    }
  }
  pts.push({ x: vertices[0].x + tremor(r, amp), y: vertices[0].y + tremor(r, amp) });
  return pts;
}

/** Retângulo arredondado: lados retos + quartos de círculo nos cantos. */
function contornoArredondado(x, y, w, h, raio, amp = 2.5) {
  const r = rng(9);
  const pts = [];
  const arco = (cx, cy, a0, a1) => {
    for (let i = 0; i <= 7; i++) {
      const a = a0 + (a1 - a0) * (i / 7);
      pts.push({ x: cx + Math.cos(a) * raio + tremor(r, amp), y: cy + Math.sin(a) * raio + tremor(r, amp) });
    }
  };
  pts.push({ x: x + w / 2, y });
  pts.push({ x: x + w - raio, y });
  arco(x + w - raio, y + raio, -Math.PI / 2, 0);
  pts.push({ x: x + w, y: y + h - raio });
  arco(x + w - raio, y + h - raio, 0, Math.PI / 2);
  pts.push({ x: x + raio, y: y + h });
  arco(x + raio, y + h - raio, Math.PI / 2, Math.PI);
  pts.push({ x, y: y + raio });
  arco(x + raio, y + raio, Math.PI, (3 * Math.PI) / 2);
  pts.push({ x: x + w / 2, y });
  return pts;
}

function elipse(cx, cy, rx, ry, n = 72, amp = 2.5, seed = 13) {
  const r = rng(seed);
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * Math.PI * 2;
    pts.push({ x: cx + Math.cos(a) * rx + tremor(r, amp), y: cy + Math.sin(a) * ry + tremor(r, amp) });
  }
  return pts;
}

/** Retângulo "torto": os vértices girados alguns graus em torno do centro (como a mão desenha). */
function percorrerTorto(x, y, w, h, graus, porAresta = 16, amp = 2.5) {
  const cx = x + w / 2;
  const cy = y + h / 2;
  const a = (graus * Math.PI) / 180;
  const cos = Math.cos(a);
  const sin = Math.sin(a);
  const girado = (p) => {
    const dx = p.x - cx;
    const dy = p.y - cy;
    return { x: cx + dx * cos - dy * sin, y: cy + dx * sin + dy * cos };
  };
  return percorrer([{ x, y }, { x: x + w, y }, { x: x + w, y: y + h }, { x, y: y + h }].map(girado), porAresta, amp);
}

/** O mesmo contorno arredondado, girado alguns graus. */
function contornoArredondadoTorto(x, y, w, h, raio, graus, amp = 2.5) {
  const cx = x + w / 2;
  const cy = y + h / 2;
  const a = (graus * Math.PI) / 180;
  const cos = Math.cos(a);
  const sin = Math.sin(a);
  return contornoArredondado(x, y, w, h, raio, amp).map((p) => {
    const dx = p.x - cx;
    const dy = p.y - cy;
    return { x: cx + dx * cos - dy * sin, y: cy + dx * sin + dy * cos };
  });
}

/** Arco de círculo desenhado à mão (o "canto arredondado" solto). */
function arco(cx, cy, r, a0graus, a1graus, amp = 1.5, seed = 17) {
  const rnd = rng(seed);
  const pts = [];
  const n = Math.max(12, Math.round(Math.abs(a1graus - a0graus) / 4));
  for (let i = 0; i <= n; i++) {
    const a = ((a0graus + ((a1graus - a0graus) * i) / n) * Math.PI) / 180;
    pts.push({ x: cx + Math.cos(a) * r + tremor(rnd, amp), y: cy + Math.sin(a) * r + tremor(rnd, amp) });
  }
  return pts;
}

/** Curva LARGA (elíptica), como o topo de uma caixa desenhado à mão. */
function arcoElipse(cx, cy, rx, ry, a0graus, a1graus, amp = 1.5, seed = 23) {
  const rnd = rng(seed);
  const pts = [];
  const n = Math.max(16, Math.round(Math.abs(a1graus - a0graus) / 3));
  for (let i = 0; i <= n; i++) {
    const a = ((a0graus + ((a1graus - a0graus) * i) / n) * Math.PI) / 180;
    pts.push({ x: cx + Math.cos(a) * rx + tremor(rnd, amp), y: cy + Math.sin(a) * ry + tremor(rnd, amp) });
  }
  return pts;
}

/** Traço do TOPO de uma caixa: lado curto + canto + reta + canto + lado (o contorno de um card). */
function topoDeCaixa(x0, y0, x1, raio, amp = 2, seed = 29, pontosReta = 6, lado = 20) {
  const rnd = rng(seed);
  const pts = [];
  const ponto = (x, y) => pts.push({ x: x + tremor(rnd, amp), y: y + tremor(rnd, amp) });
  const canto = (cx, cy, a0, a1) => {
    for (let i = 0; i <= 8; i++) {
      const a = a0 + (a1 - a0) * (i / 8);
      ponto(cx + Math.cos(a) * raio, cy + Math.sin(a) * raio);
    }
  };
  ponto(x0, y0 + raio + lado);
  canto(x0 + raio, y0 + raio, Math.PI, 1.5 * Math.PI);
  for (let i = 1; i <= pontosReta; i++) ponto(x0 + raio + ((x1 - raio - x0 - raio) * i) / pontosReta, y0);
  canto(x1 - raio, y0 + raio, 1.5 * Math.PI, 2 * Math.PI);
  ponto(x1, y0 + raio + lado);
  return pts;
}

/** Rabisco qualquer (não bate com forma nenhuma). */
function rabisco(seed = 21) {
  const r = rng(seed);
  const pts = [{ x: 200, y: 200 }];
  let x = 200;
  let y = 200;
  for (let i = 0; i < 120; i++) {
    x += (r() - 0.5) * 44;
    y += (r() - 0.5) * 44;
    pts.push({ x, y });
  }
  return pts;
}

/** Linha com a cabeça desenhada como a mão faz: chega na ponta, volta e risca as duas "asas". */
function seta(x0, y0, x1, y1, nasDuas = false) {
  const miolo = reta(x0, y0, x1, y1, 40, 2.5, nasDuas ? 15 : 11);
  const dx = x1 - x0;
  const dy = y1 - y0;
  const L = Math.hypot(dx, dy);
  const ux = dx / L;
  const uy = dy / L;
  const px = -uy;
  const py = ux;
  const recuo = 34;
  const asa = 30;
  const cabeca = (fx, fy, sentido) => [
    { x: fx - ux * recuo * sentido + px * asa, y: fy - uy * recuo * sentido + py * asa },
    { x: fx, y: fy },
    { x: fx - ux * recuo * sentido - px * asa, y: fy - uy * recuo * sentido - py * asa },
    { x: fx, y: fy },
  ];
  return [...(nasDuas ? cabeca(x0, y0, -1) : []), ...miolo, ...cabeca(x1, y1, 1)];
}

const est = { fonte: "Segoe UI", tamanho: 18, corTexto: "1C212B", acento: "00B050", paleta: [] };
const dim = { w: 960, h: 540 };
const pincel = { cor: "00B050", w: 4, assistente: true };

// ---------------------------------------------------------------- formas fechadas
{
  const p = percorrer([{ x: 100, y: 80 }, { x: 300, y: 80 }, { x: 300, y: 220 }, { x: 100, y: 220 }]);
  const rec = D.reconhecerTraco(p);
  ok("retângulo: reconhecido", rec?.geom === "rect", JSON.stringify(rec));
  ok("retângulo: caixa no lugar", rec && pertoCaixa(rec.box, 100, 80, 200, 140), JSON.stringify(rec?.box));
  ok("retângulo: sem ajuste de canto", rec && !rec.adj);
}

{
  const p = contornoArredondado(120, 90, 220, 150, 18);
  const rec = D.reconhecerTraco(p);
  ok("retângulo arredondado: reconhecido", rec?.geom === "roundRect", JSON.stringify(rec));
  const adj = rec?.adj?.adj ?? 0;
  // r ≈ 18 em min(220,150) = 150 → adj ideal ≈ 12000 (com folga para o tremor)
  ok("retângulo arredondado: raio plausível", adj >= 5000 && adj <= 30000, `adj=${adj}`);
  ok("retângulo arredondado: caixa no lugar", rec && pertoCaixa(rec.box, 120, 90, 220, 150), JSON.stringify(rec?.box));
}

{
  const rec = D.reconhecerTraco(elipse(300, 180, 130, 90));
  ok("elipse: reconhecida", rec?.geom === "ellipse", JSON.stringify(rec));
  ok("elipse: caixa no lugar", rec && pertoCaixa(rec.box, 170, 90, 260, 180, 9), JSON.stringify(rec?.box));
}

// a mão nunca acerta o ângulo: um retângulo alguns graus torto continua retângulo
{
  const rec = D.reconhecerTraco(percorrerTorto(140, 100, 220, 150, 5));
  ok("retângulo torto 5°: continua retângulo (não vira arredondado)", rec?.geom === "rect", JSON.stringify(rec));
  ok("retângulo torto 5°: caixa acompanha o desenho", rec && pertoCaixa(rec.box, 140, 100, 220, 150, 9), JSON.stringify(rec?.box));
  const rec8 = D.reconhecerTraco(percorrerTorto(140, 100, 220, 150, 8));
  ok("retângulo torto 8°: reconhecido", rec8?.geom === "rect", JSON.stringify(rec8));
  const arred = D.reconhecerTraco(contornoArredondadoTorto(120, 90, 220, 150, 18, 5));
  ok("retângulo arredondado torto: reconhecido", arred?.geom === "roundRect", JSON.stringify(arred));
  const adj = arred?.adj?.adj ?? 0;
  ok("retângulo arredondado torto: raio plausível", adj >= 4000 && adj <= 30000, `adj=${adj}`);
}

{
  const cima = D.reconhecerTraco(percorrer([{ x: 160, y: 100 }, { x: 320, y: 260 }, { x: 160, y: 260 }]));
  ok("triângulo: reconhecido", cima?.geom === "triangle", JSON.stringify(cima));
  ok("triângulo para cima: sem flip", cima && !cima.flipV, JSON.stringify(cima));
  const baixo = D.reconhecerTraco(percorrer([{ x: 160, y: 100 }, { x: 320, y: 100 }, { x: 240, y: 260 }]));
  ok("triângulo para baixo: flipV", baixo?.geom === "triangle" && baixo.flipV === true, JSON.stringify(baixo));
}

// ---------------------------------------------------------------- linhas e setas
{
  const rec = D.reconhecerTraco(reta(120, 300, 460, 300));
  ok("linha: reconhecida", rec?.geom === "line", JSON.stringify(rec));
  ok("linha: sem setas", rec && !rec.head && !rec.tail, JSON.stringify({ head: rec?.head, tail: rec?.tail }));
  ok("linha: caixa cobre o traço", rec && pertoCaixa(rec.box, 120, 300, 340, 0, 14), JSON.stringify(rec?.box));
}

{
  const rec = D.reconhecerTraco(seta(120, 320, 460, 320));
  ok("seta: reconhecida como linha", rec?.geom === "line", JSON.stringify(rec));
  ok("seta: ponta no fim", rec?.tail === true && !rec?.head, JSON.stringify({ head: rec?.head, tail: rec?.tail }));
  const d = D.reconhecerTraco(seta(120, 340, 460, 340, true));
  ok("seta dupla: as duas pontas", d?.head === true && d?.tail === true, JSON.stringify({ head: d?.head, tail: d?.tail }));
  // desenhada da direita para a esquerda: a ponta continua sendo o fim do traço
  const invertida = D.reconhecerTraco(seta(460, 360, 120, 360));
  ok("seta invertida: ponta no fim (flipH)", invertida?.tail === true && invertida.flipH === true, JSON.stringify(invertida));
}

// ---------------------------------------------------------------- arco (o "canto arredondado")
{
  const rec = D.reconhecerTraco(arco(300, 240, 120, 180, 270));
  ok("arco: reconhecido", rec?.geom === "arc", JSON.stringify(rec));
  ok("arco: caixa = círculo do arco", rec && pertoCaixa(rec.box, 180, 120, 240, 240, 12), JSON.stringify(rec?.box));
  const a1 = rec?.adj?.adj1 ?? 0;
  const a2 = rec?.adj?.adj2 ?? 0;
  ok("arco: ângulos plausíveis", a1 > 160 * 60000 && a1 < 200 * 60000 && a2 > 250 * 60000 && a2 < 290 * 60000, `adj1=${a1} adj2=${a2}`);
  const inv = D.reconhecerTraco(arco(300, 240, 120, 270, 180));
  ok("arco desenhado ao contrário: mesmo arco", inv?.geom === "arc" && inv.adj && Math.abs(inv.adj.adj1 - a1) < 6 * 60000 && Math.abs(inv.adj.adj2 - a2) < 6 * 60000, JSON.stringify(inv?.adj));
  // curva LARGA: o ajuste tem que ser elíptico — com o círculo, o topo de uma caixa virava "meio círculo"
  const largo = D.reconhecerTraco(arcoElipse(400, 300, 260, 90, 195, 345));
  ok("arco largo: reconhecido", largo?.geom === "arc", JSON.stringify(largo?.geom));
  ok("arco largo: caixa elíptica (não vira círculo)", largo && perto(largo.box.w, 520, 14) && perto(largo.box.h, 180, 14), JSON.stringify(largo?.box));
  const topo = D.reconhecerTraco(topoDeCaixa(150, 120, 650, 70));
  ok("topo de caixa com quinas: fica livre (não é arco)", topo === null, JSON.stringify(topo));

  // o traço do TOPO DE CARTÃO do relato, com a reta mais densa: virava "Linha" (perdia os cantos)
  // — a tolerância da reta era 5% do comprimento e engolia os cantos
  ok("topo de caixa denso: fica livre (não vira linha)", D.reconhecerTraco(topoDeCaixa(150, 120, 650, 70, 2, 29, 10)) === null, JSON.stringify(D.reconhecerTraco(topoDeCaixa(150, 120, 650, 70, 2, 29, 10))));
  // ... e com cantos grandes virava um ARCO largo que passava POR BAIXO do desenho (o print do
  // relato): a média do ajuste era pequena, mas o desvio máximo não — é ele que manda agora
  const comCantos = D.reconhecerTraco(topoDeCaixa(100, 100, 700, 110, 2, 29, 10, 40));
  ok("topo de cartão com cantos grandes: fica livre (não vira arco bojudo)", comCantos === null, JSON.stringify(comCantos));
  const ajusteTopo = D.ajustarElipseOrientada(topoDeCaixa(100, 100, 700, 110, 2, 29, 10, 40));
  ok(
    "ajuste do topo do cartão: o desvio máximo denuncia (média pequena, máximo grande)",
    ajusteTopo !== null && ajusteTopo.absoluto < 8 && ajusteTopo.absolutoMax > 8,
    JSON.stringify(ajusteTopo && { media: +ajusteTopo.absoluto.toFixed(1), max: +ajusteTopo.absolutoMax.toFixed(1) })
  );
  // cantos rasos: aí sim é uma LINHA em cima da aresta (é o "cobrir aquela parte" do relato)
  const raso = D.reconhecerTraco(topoDeCaixa(100, 100, 800, 40, 2, 29, 10, 15));
  ok("topo raso: vira linha em cima da aresta", raso?.geom === "line" && perto(raso.box.y, 100, 6) && raso.box.h < 4, JSON.stringify(raso?.box));

  // traço desenhado TORTO: a elipse é procurada COM orientação — a forma sai girada no mesmo
  // ângulo e a curva passa pelo traço (antes, o ajuste alinhado aos eixos saía grande e a
  // curva não passava pelo desenho: era o "não se encaixa" do relato)
  const giro = (18 * Math.PI) / 180;
  // elipse LARGA (rx ≠ ry): é onde a rotação importa — um arco de círculo é o mesmo círculo
  // em qualquer giro, então o ajuste (certo) devolve rotação zero
  const torto = arcoElipse(0, 0, 170, 130, 120, 340).map((p) => ({
    x: 300 + p.x * Math.cos(giro) - p.y * Math.sin(giro),
    y: 300 + p.x * Math.sin(giro) + p.y * Math.cos(giro),
  }));
  const arcoTorto = D.reconhecerTraco(torto);
  ok("arco torto: reconhecido com a rotação", arcoTorto?.geom === "arc" && Math.abs((arcoTorto.rot ?? 0) - 18) <= 4, JSON.stringify({ geom: arcoTorto?.geom, rot: arcoTorto?.rot }));
  // a curva devolvida tem que PASSAR pelo traço (é o teste que pega o "não se encaixa"):
  // compara com o arco DESENHADO (só o trecho visível, entre adj1 e adj2), não com a elipse toda
  const pontosDoArco = (rec) => {
    const cx = rec.box.x + rec.box.w / 2;
    const cy = rec.box.y + rec.box.h / 2;
    const rx = Math.max(rec.box.w / 2, 1);
    const ry = Math.max(rec.box.h / 2, 1);
    const g = ((rec.rot ?? 0) * Math.PI) / 180;
    let a1 = ((rec.adj?.adj1 ?? 0) / 60000) * (Math.PI / 180);
    let a2 = ((rec.adj?.adj2 ?? 21600000) / 60000) * (Math.PI / 180);
    if (a2 <= a1) a2 += 2 * Math.PI; // o preset varre no sentido horário, de adj1 até adj2
    const out = [];
    for (let i = 0; i <= 240; i++) {
      const t = a1 + ((a2 - a1) * i) / 240;
      const x0 = rx * Math.cos(t);
      const y0 = ry * Math.sin(t);
      out.push({ x: cx + x0 * Math.cos(g) - y0 * Math.sin(g), y: cy + x0 * Math.sin(g) + y0 * Math.cos(g) });
    }
    return out;
  };
  const curvaDoArco = pontosDoArco(arcoTorto);
  const desvioMax = Math.max(...torto.map((p) => Math.min(...curvaDoArco.map((q) => Math.hypot(p.x - q.x, p.y - q.y)))));
  ok("arco torto: a curva passa pelo traço", desvioMax <= 4, `desvio máx ${desvioMax.toFixed(1)} pt`);

  // duas retas com um canto arredondado NÃO podem virar um "arco-faca": a elipse esticada
  // (razão entre eixos minúscula) fica de fora e o traço vira desenho livre
  const cantoEmL = (() => {
    const pts = [...reta(300, 260, 300, 180, 14, 2, 31)];
    for (let i = 1; i <= 10; i++) {
      const a = ((90 + (i / 10) * 90) * Math.PI) / 180;
      pts.push({ x: 300 + 40 * Math.cos(a) + tremor(rng(37), 1.5), y: 140 + 40 * Math.sin(a) + tremor(rng(41), 1.5) });
    }
    pts.push(...reta(340, 140, 430, 140, 14, 2, 43));
    return pts;
  })();
  const lRec = D.reconhecerTraco(cantoEmL);
  ok("canto em L: fica livre (não vira arco esticado)", lRec === null, JSON.stringify(lRec));
  // ... mas desenhado POR CIMA de uma caixa, a forma sai alinhada a ela (o "ver a imagem de fundo")
  const caixaFundo = { id: "cx", kind: "forma", box: { x: (150 / 960) * 100, y: (120 / 540) * 100, w: (500 / 960) * 100, h: (200 / 540) * 100 }, text: "", fontFamily: "A", fontSize: 18, color: "000000", bold: false, italic: false, align: "esquerda", fill: "", src: "", rot: 0 };
  const topoForma = D.formaDoTraco(topoDeCaixa(150, 120, 650, 70), pincel, est, dim, [caixaFundo]);
  ok("topo traçado sobre a caixa sai alinhado a ela", topoForma && perto(topoForma.box.x, (150 / 960) * 100, 0.6) && perto(topoForma.box.y, (120 / 540) * 100, 0.6) && perto(topoForma.box.w, (500 / 960) * 100, 0.6), JSON.stringify(topoForma?.box));
}

// ---------------------------------------------------------------- desenho livre
{
  ok("rabisco: fica livre", D.reconhecerTraco(rabisco()) === null);
  ok("traço curto demais: fica livre", D.reconhecerTraco([{ x: 100, y: 100 }, { x: 104, y: 101 }, { x: 106, y: 100 }]) === null);

  const cp = D.caminhoLivre(rabisco());
  ok("desenho livre: caminho começa com M e sai em curvas", cp.cmds[0] === "M" && cp.cmds.includes("C"));
  const coordsDe = (cmds) => {
    const out = [];
    let i = 0;
    while (i < cmds.length) {
      const c = cmds[i];
      if (c === "M") i += 3;
      else if (c === "C") {
        for (let k = 0; k < 6; k += 2) out.push([cmds[i + 1 + k], cmds[i + 2 + k]]);
        i += 7;
      } else if (c === "L") {
        out.push([cmds[i + 1], cmds[i + 2]]);
        i += 3;
      } else break;
    }
    return out;
  };
  const coords = coordsDe(cp.cmds);
  ok("desenho livre: coordenadas dentro da caixa", coords.every(([x, y]) => x >= -1 && x <= cp.w + 1 && y >= -1 && y <= cp.h + 1), `${cp.w}x${cp.h} (${coords.length} pontos)`);
  ok("desenho livre: pontos enxutos", cp.cmds.filter((c) => c === "C").length <= 120, `${cp.cmds.filter((c) => c === "C").length} curvas`);
  // traço com "quinas": o caminho sai em cúbicas (C), não em segmentos retos (L)
  const quebrado = [];
  for (let i = 0; i <= 36; i++) {
    const q = Math.floor(i / 9);
    quebrado.push({ x: 120 + i * 7, y: 200 + q * 25 + (i % 9) * 3 });
  }
  const cpQuinas = D.caminhoLivre(quebrado);
  ok("desenho livre: sem quinas de polilinha (nada de L, tudo C)", !cpQuinas.cmds.includes("L") && cpQuinas.cmds.includes("C"));
  const fechado = D.caminhoLivre(percorrer([{ x: 100, y: 100 }, { x: 220, y: 100 }, { x: 220, y: 210 }, { x: 100, y: 210 }], 12));
  ok("desenho livre fechado: termina com Z", fechado.cmds[fechado.cmds.length - 1] === "Z");
}

// ---------------------------------------------------------------- a forma montada
{
  const f = D.formaDoTraco(percorrer([{ x: 96, y: 54 }, { x: 480, y: 54 }, { x: 480, y: 270 }, { x: 96, y: 270 }]), pincel, est, dim);
  ok("forma: retângulo do traço", f?.geom === "rect", JSON.stringify(f?.geom));
  ok("forma: sem preenchimento e com o pincel", f?.fillX?.kind === "none" && f?.ln?.color === "00B050" && f?.ln?.w === 4);
  ok("forma: caixa em % da lâmina", f && perto(f.box.x, 10, 0.9) && perto(f.box.y, 10, 1.4) && perto(f.box.w, 40, 0.9) && perto(f.box.h, 40, 1.4), JSON.stringify(f?.box));
  ok("forma: nome do reconhecimento", f?.name === "Retângulo");

  const livre = D.formaDoTraco(rabisco(), { ...pincel, assistente: false }, est, dim);
  ok("sem assistente: desenho livre (caminho)", livre?.geom === "custom" && livre?.paths?.length === 1 && livre.paths[0].cmds.length > 4);
  ok("sem assistente: pincel aplicado no caminho", livre?.ln?.color === "00B050" && livre?.fillX?.kind === "none");

  const comSeta = D.formaDoTraco(seta(120, 320, 460, 320), pincel, est, dim);
  ok("seta vira linha com ponta", comSeta?.geom === "line" && comSeta?.ln?.tail === "triangle" && !comSeta?.ln?.head);
  const comArco = D.formaDoTraco(arco(300, 240, 120, 180, 270), pincel, est, dim);
  ok("arco vira forma de arco", comArco?.geom === "arc" && !!comArco?.adj?.adj1 && comArco?.fillX?.kind === "none");
}

// ---------------------------------------------------------------- encaixe nas formas de baixo
{
  const caixa = (x, y, w, h) => ({ id: "x", kind: "forma", box: { x, y, w, h }, text: "", fontFamily: "A", fontSize: 18, color: "000000", bold: false, italic: false, align: "esquerda", fill: "", src: "", rot: 0 });
  // existente em % (20%, 10%, 50%, 30%) → pt (192, 54, 480, 162)
  const existente = caixa(20, 10, 50, 30);
  const enc = D.encaixarNoPalco({ x: 200, y: 60, w: 470, h: 150 }, [existente], dim, 10);
  ok("encaixe: bordas colam na forma de baixo", perto(enc.x, 192) && perto(enc.y, 54) && perto(enc.x + enc.w, 672) && perto(enc.y + enc.h, 216), JSON.stringify(enc));
  const solto = D.encaixarNoPalco({ x: 400, y: 300, w: 100, h: 80 }, [existente], dim, 10);
  ok("encaixe: longe não mexe", perto(solto.x, 400) && perto(solto.y, 300) && perto(solto.w, 100));
  const f = D.formaDoTraco(percorrer([{ x: 196, y: 56 }, { x: 670, y: 56 }, { x: 670, y: 210 }, { x: 196, y: 210 }]), pincel, est, dim, [existente]);
  ok("desenhar por cima da caixa sai alinhado a ela", f && perto(f.box.x, 20, 0.6) && perto(f.box.y, 10, 0.6) && perto(f.box.w, 50, 0.6) && perto(f.box.h, 30, 0.6), JSON.stringify(f?.box));
}

// ---------------------------------------------------------------- a dica na tela
{
  ok("dica: nome do reconhecimento", D.dicaDoTraco(percorrer([{ x: 100, y: 80 }, { x: 300, y: 80 }, { x: 300, y: 220 }, { x: 100, y: 220 }]), true) === "Retângulo");
  ok("dica: desenho livre no rabisco", D.dicaDoTraco(rabisco(), true) === "Desenho livre");
  ok("dica: desenho livre sem assistente", D.dicaDoTraco(percorrer([{ x: 100, y: 80 }, { x: 300, y: 80 }, { x: 300, y: 220 }, { x: 100, y: 220 }]), false) === "Desenho livre");
}

// ---------------------------------------------------------------- encaixe nos eixos (assistente)
{
  // o "L" do relato: uma aresta torta, o canto arredondado e a outra aresta (tudo com tremor)
  const cantoTorto = (() => {
    const pts = [...reta(300, 260, 300, 180, 14, 2, 31)];
    for (let i = 1; i <= 10; i++) {
      const a = ((90 + (i / 10) * 90) * Math.PI) / 180;
      pts.push({ x: 300 + 40 * Math.cos(a) + tremor(rng(37), 1.5), y: 140 + 40 * Math.sin(a) + tremor(rng(41), 1.5) });
    }
    pts.push(...reta(340, 140, 430, 140, 14, 2, 43));
    return pts;
  })();
  const alinhado = D.alinharNosEixos(cantoTorto);
  const distintos = (arr, campo) => new Set(arr.map((p) => Math.round(p[campo] * 10) / 10)).size;
  const vertical = alinhado.filter((p) => p.y > 200);
  const horizontal = alinhado.filter((p) => p.x > 360);
  ok("encaixe: a aresta vertical do L vira reta", vertical.length >= 3 && distintos(vertical, "x") === 1, `${distintos(vertical, "x")} x(s) distintos`);
  ok("encaixe: a aresta horizontal do L vira reta", horizontal.length >= 2 && distintos(horizontal, "y") === 1, `${distintos(horizontal, "y")} y(s) distintos`);
  ok("encaixe: o L fica onde a mão passou", perto(vertical[0].x, 300, 4) && perto(horizontal[0].y, 140, 4), `${vertical[0].x.toFixed(1)}, ${horizontal[0].y.toFixed(1)}`);
  // diagonal de propósito (38°) não vira reta nem muda de inclinação
  const diagonal = reta(100, 100, 300, 260, 30, 2, 77);
  const diagAl = D.alinharNosEixos(diagonal);
  const xs = diagAl.map((p) => p.x);
  const ys = diagAl.map((p) => p.y);
  const faixaX = Math.max(...xs) - Math.min(...xs);
  const faixaY = Math.max(...ys) - Math.min(...ys);
  const incl = (diagAl[diagAl.length - 1].y - diagAl[0].y) / (diagAl[diagAl.length - 1].x - diagAl[0].x);
  ok("encaixe: traço diagonal fica como está", diagAl.length >= 3 && faixaX > 150 && faixaY > 120 && Math.abs(incl - 0.8) < 0.15, `faixa ${faixaX.toFixed(0)}x${faixaY.toFixed(0)}, inclinação ${incl.toFixed(2)}`);
  // o traço não reconhecido continua desenho livre — mas com o caminho encaixado
  const assistido = D.formaDoTraco(cantoTorto, pincel, est, dim, []);
  const cru = D.formaDoTraco(cantoTorto, { ...pincel, assistente: false }, est, dim, []);
  ok("encaixe: o L continua desenho livre", assistido?.geom === "custom" && !!assistido.paths?.length && assistido.name === "Desenho livre", JSON.stringify({ geom: assistido?.geom }));
  ok("encaixe: com o assistente desligado o traço fica como desenhado", cru?.geom === "custom" && JSON.stringify(cru.box) !== JSON.stringify(assistido.box), JSON.stringify({ com: assistido?.box, sem: cru?.box }));

  // o caminho do assistente sai com RETA nos trechos encaixados: com a cúbica do Catmull-Rom, o
  // topo do cartão ficava com BARRIGA mesmo com os pontos alinhados (o print do relato) — os
  // vizinhos (os cantos) puxavam a curva para fora da reta
  const topoForma = D.formaDoTraco(topoDeCaixa(100, 100, 700, 110, 2, 29, 12, 40), pincel, est, dim, []);
  const cmdsTopo = topoForma?.paths?.[0]?.cmds ?? [];
  const retas = [];
  for (let i = 0; i < cmdsTopo.length; i++) if (cmdsTopo[i] === "L") retas.push([cmdsTopo[i + 1], cmdsTopo[i + 2]]);
  const ysDoTopo = retas.filter(([, y]) => y < 20).map(([, y]) => y);
  ok(
    "encaixe: o topo do cartão sai como RETA no caminho (não cúbica)",
    retas.length >= 2 && ysDoTopo.length >= 2 && new Set(ysDoTopo).size === 1,
    `${retas.length} reta(s) no caminho; ys do topo: ${JSON.stringify([...new Set(ysDoTopo)])}`
  );
}

// ---------------------------------------------------------------- curva por pontos de parada
{
  // 1) svgPathDePontos: aberta e fechada
  const pts = [
    { x: 10, y: 10 },
    { x: 50, y: 30 },
    { x: 80, y: 10 },
  ];
  const dAberta = D.svgPathDePontos(pts, false);
  ok("curva por pontos: svg aberto contém M e C e não tem Z", dAberta.startsWith("M") && dAberta.includes("C") && !dAberta.endsWith("Z"));

  const dFechada = D.svgPathDePontos(pts, true);
  ok("curva por pontos: svg fechado termina com Z e liga de volta", dFechada.startsWith("M") && dFechada.endsWith("Z"));

  // 2) ponto com canto reto (reto: true) gera comando L
  const ptsComCanto = [
    { x: 10, y: 10 },
    { x: 50, y: 10, reto: true },
    { x: 80, y: 40 },
  ];
  const dCanto = D.svgPathDePontos(ptsComCanto, false);
  ok("curva por pontos: ponto reto gera segmento L", dCanto.includes("L50.00 10.00"));

  // 3) formaDeCurva: aberta e fechada
  const fAberta = D.formaDeCurva(pts.map((p) => ({ x: p.x * 5, y: p.y * 5 })), false, pincel, est, dim, []);
  ok("forma de curva aberta: geom custom, nome Curva, fill none", fAberta?.geom === "custom" && fAberta.name === "Curva" && fAberta.paths?.[0]?.fill === "none");

  const fFechada = D.formaDeCurva(pts.map((p) => ({ x: p.x * 5, y: p.y * 5 })), true, pincel, est, dim, []);
  ok("forma de curva fechada: geom custom, nome Forma livre, fill norm, termina em Z", fFechada?.geom === "custom" && fFechada.name === "Forma livre" && fFechada.paths?.[0]?.fill === "norm" && fFechada.paths?.[0]?.cmds.includes("Z"));
}

console.log("");

// ---------------------------------------------------------------- marca-texto, tinta e converter
{
  const pincelCaneta = { cor: "FACC15", w: 4, assistente: true };
  const pincelMarca = { cor: "FACC15", w: 4, assistente: true, tipo: "marca" };
  const caixa = percorrer([{ x: 100, y: 100 }, { x: 400, y: 100 }, { x: 400, y: 260 }, { x: 100, y: 260 }], 20, 2, 5);

  // 1) o marca-texto NÃO é reconhecido (mesmo com o assistente ligado) e sai largo e translúcido
  const marca = D.formaDoTraco(caixa, pincelMarca, est, dim, []);
  ok("marca-texto: fica desenho livre (não vira forma)", marca?.geom === "custom" && marca.name === "Marca-texto", marca?.geom);
  ok("marca-texto: traço largo e translúcido, sem ponta de seta", marca.ln.alpha < 1 && marca.ln.w >= 12 && !marca.ln.head && !marca.ln.tail, JSON.stringify(marca.ln));
  ok("marca-texto: guarda o traço em `tinta`", Array.isArray(marca.tinta) && marca.tinta.length === caixa.length);

  // 2) a caneta com o assistente ligado continua reconhecendo o mesmo traço
  const caneta = D.formaDoTraco(caixa, pincelCaneta, est, dim, []);
  ok("caneta: o mesmo traço vira retângulo", caneta?.geom === "rect", caneta?.geom);
  ok("caneta: forma reconhecida NÃO guarda tinta (já é forma)", caneta.tinta === undefined);

  // 3) desenho livre (não reconhecido) guarda os pontos; a curva também
  const rabisco = reta(120, 300, 260, 340, 30, 6, 3).map((p) => ({ x: p.x, y: p.y + 40 * Math.sin(p.x / 40) }));
  const livre = D.formaDoTraco(rabisco, pincelCaneta, est, dim, []);
  ok("desenho livre: guarda o traço em `tinta`", livre?.geom === "custom" && Array.isArray(livre.tinta) && livre.tinta.length === rabisco.length);
  const curva = D.formaDeCurva([{ x: 200, y: 400 }, { x: 300, y: 430 }, { x: 420, y: 400 }], false, pincelCaneta, est, dim, []);
  ok("curva: também guarda o traço em `tinta`", Array.isArray(curva?.tinta) && curva.tinta.length === 3);

  // 4) Converter em forma: o traço guardado vira a forma reconhecida, NO LUGAR em que ele está agora
  const original = D.formaDoTraco(caixa, pincelCaneta, est, dim, []);
  const stroke = { ...original, geom: "custom", paths: [D.caminhoDePontos(caixa)], tinta: caixa.map((p) => ({ x: p.x, y: p.y })) };
  const convertido = D.formaDaTinta(stroke, dim);
  ok("converter: devolve o retângulo reconhecido", convertido?.geom === "rect" && convertido.name === "Retângulo", JSON.stringify(convertido?.geom));
  ok("converter: mantém a caixa atual do traço", pertoCaixa(convertido.box, stroke.box.x, stroke.box.y, stroke.box.w, stroke.box.h, 1.5), JSON.stringify([convertido.box, stroke.box]));
  ok("converter: limpa os caminhos e a tinta (deixa de ser traço)", convertido.paths === undefined && convertido.tinta === undefined);
  ok("converter: a linha do traço continua (cor e espessura)", convertido.ln?.color === stroke.ln.color && convertido.ln?.w === stroke.ln.w);

  // 5) traço movido: a conversão acompanha a posição NOVA (os pontos são da criação)
  const movido = { ...stroke, box: { ...stroke.box, x: stroke.box.x + 20, y: stroke.box.y + 10 } };
  const convertidoMovido = D.formaDaTinta(movido, dim);
  ok(
    "converter: acompanha o traço que foi movido",
    perto(convertidoMovido.box.x, movido.box.x, 1.5) && perto(convertidoMovido.box.y, movido.box.y, 1.5),
    JSON.stringify([convertidoMovido.box, movido.box])
  );

  // 6) sem pontos ou sem reconhecimento: null (o botão avisa)
  ok("converter: forma sem `tinta` devolve null", D.formaDaTinta({ ...stroke, tinta: undefined }, dim) === null);
  const torto = reta(120, 500, 260, 540, 30, 8, 4).map((p, i) => ({ x: p.x + i * 3, y: p.y + Math.sin(i / 2) * 30 }));
  ok("converter: traço que não é forma devolve null", D.formaDaTinta({ ...stroke, tinta: torto }, dim) === null);
}

console.log(falhas ? `${falhas} falha(s)` : "Tudo certo.");
process.exit(falhas ? 1 : 0);
