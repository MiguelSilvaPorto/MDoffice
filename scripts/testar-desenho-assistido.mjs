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

// ---------------------------------------------------------------- desenho livre
{
  ok("rabisco: fica livre", D.reconhecerTraco(rabisco()) === null);
  ok("traço curto demais: fica livre", D.reconhecerTraco([{ x: 100, y: 100 }, { x: 104, y: 101 }, { x: 106, y: 100 }]) === null);

  const cp = D.caminhoLivre(rabisco());
  ok("desenho livre: caminho começa com M", cp.cmds[0] === "M" && cp.cmds.includes("L"));
  const xs = [];
  const ys = [];
  for (let i = 1; i + 1 < cp.cmds.length; i += 3) {
    if (typeof cp.cmds[i] === "number" && typeof cp.cmds[i + 1] === "number") {
      xs.push(cp.cmds[i]);
      ys.push(cp.cmds[i + 1]);
    }
  }
  ok("desenho livre: coordenadas dentro da caixa", xs.every((v) => v >= -1 && v <= cp.w + 1) && ys.every((v) => v >= -1 && v <= cp.h + 1), `${cp.w}x${cp.h}`);
  ok("desenho livre: pontos enxutos", xs.length <= 261, `${xs.length} pontos`);
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
}

// ---------------------------------------------------------------- a dica na tela
{
  ok("dica: nome do reconhecimento", D.dicaDoTraco(percorrer([{ x: 100, y: 80 }, { x: 300, y: 80 }, { x: 300, y: 220 }, { x: 100, y: 220 }]), true) === "Retângulo");
  ok("dica: desenho livre no rabisco", D.dicaDoTraco(rabisco(), true) === "Desenho livre");
  ok("dica: desenho livre sem assistente", D.dicaDoTraco(percorrer([{ x: 100, y: 80 }, { x: 300, y: 80 }, { x: 300, y: 220 }, { x: 100, y: 220 }]), false) === "Desenho livre");
}

console.log("");
console.log(falhas ? `${falhas} falha(s)` : "Tudo certo.");
process.exit(falhas ? 1 : 0);
