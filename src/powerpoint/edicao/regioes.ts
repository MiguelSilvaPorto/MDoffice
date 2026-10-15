// As REGIÕES da lâmina (Estúdio, fase 2): o mapa dos contornos.
//
// A fase 1 isolou a box com o contorno EXTERNO dela. Esta fase responde "e dentro?": o cartão com
// um logo, um texto e bolinhas vira uma FACE (o contorno do cartão menos os contornos dos filhos
// diretos), cada elemento interno tem a sua própria face, a rua entre dois cartões é a face do
// palco — e é isso que permite desenhar com exatidão sem cobrir o que já está lá.
//
// Tudo aqui é PURO: os contornos saem em POLÍGONOS (pt da lâmina), porque é o que o teste de ponto,
// a área e o recorte precisam; para DESENHAR (a máscara do Estúdio) o app continua usando o caminho
// exato do `estudio.ts` (arcos de verdade no raio do canto).
//
// A árvore é por CONTENÇÃO (o mesmo critério dos Arranjos e do desenho que gruda no cartão): o pai
// de uma forma é o MENOR contorno que contém o centro dela. Formas que se cruzam sem conter o
// centro uma da outra ficam irmãs — não viram buraco uma da outra (e o `regiaoEm` continua
// escolhendo a face certa para o ponto).

import type { Shape } from "../schema";
import { cantosDe } from "./formato";
import { podeIsolar } from "./estudio";

export interface Ponto {
  x: number;
  y: number;
}

export interface Dim {
  w: number;
  h: number;
}

export interface Regiao {
  /** o id da forma dona do contorno ("" = o palco, a lâmina inteira) */
  dono: string;
  /** o nome do dono (a trilha do Estúdio usa) */
  nome: string;
  /** o contorno externo (o "papel" da região) */
  contorno: Ponto[];
  /** os buracos: os filhos DIRETOS (o que está dentro da região sem ser a região) */
  buracos: Ponto[][];
  /** quantos contornos contêm este (o palco = 0) */
  profundidade: number;
  /** área livre (contorno − buracos), em pt² */
  area: number;
}

/** Pontos por arco de canto (o suficiente para o teste de ponto e a área). */
const PONTOS_DO_ARCO = 5;
/** Pontos da elipse (24 já desenha um círculo convincente). */
const PONTOS_DA_ELIPSE = 24;

const n = (v: number): number => Math.round(v * 100) / 100;

/** Tira os pontos repetidos em sequência (e o último igual ao primeiro): o polígono não precisa. */
function semRepetidos(pontos: Ponto[]): Ponto[] {
  const saida: Ponto[] = [];
  for (const p of pontos) {
    const ultimo = saida[saida.length - 1];
    if (ultimo && Math.abs(ultimo.x - p.x) < 0.01 && Math.abs(ultimo.y - p.y) < 0.01) continue;
    saida.push(p);
  }
  const primeiro = saida[0];
  const ultimo = saida[saida.length - 1];
  if (saida.length > 1 && Math.abs(primeiro.x - ultimo.x) < 0.01 && Math.abs(primeiro.y - ultimo.y) < 0.01) saida.pop();
  return saida;
}

/** A caixa da forma em pt da lâmina. */
function caixaEmPt(s: Shape, d: Dim): { x: number; y: number; w: number; h: number } {
  return { x: (s.box.x / 100) * d.w, y: (s.box.y / 100) * d.h, w: (s.box.w / 100) * d.w, h: (s.box.h / 100) * d.h };
}

/** Gira um ponto em torno de um centro (o `rot` da forma é em graus, no sentido do relógio). */
function girar(p: Ponto, cx: number, cy: number, graus: number): Ponto {
  if (!graus) return p;
  const a = (graus * Math.PI) / 180;
  const dx = p.x - cx;
  const dy = p.y - cy;
  return { x: cx + dx * Math.cos(a) - dy * Math.sin(a), y: cy + dx * Math.sin(a) + dy * Math.cos(a) };
}

/** Um arco de canto (quarto de círculo) amostrado em `passos` pontos, do começo ao fim. */
function arco(cx: number, cy: number, r: number, de: number, ate: number): Ponto[] {
  const pontos: Ponto[] = [];
  for (let i = 0; i <= PONTOS_DO_ARCO; i++) {
    const a = de + ((ate - de) * i) / PONTOS_DO_ARCO;
    pontos.push({ x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r });
  }
  return pontos;
}

/**
 * O contorno de uma forma em POLÍGONO (pt da lâmina), já com a rotação dela. Geometrias exatas:
 * retângulo (e as demais predefinidas, pelo retângulo da caixa), retângulo com cantos arredondados
 * (raio por canto, o MESMO do desenho), elipse e triângulo. `null` quando a forma não tem área.
 */
export function poligonoDaForma(s: Shape, d: Dim): Ponto[] | null {
  if (!podeIsolar(s)) return null;
  const { x, y, w, h } = caixaEmPt(s, d);
  const g = s.geom ?? "rect";
  let pontos: Ponto[];

  if (g === "ellipse" || g === "oval" || g === "circle") {
    const rx = w / 2;
    const ry = h / 2;
    const cx = x + rx;
    const cy = y + ry;
    pontos = Array.from({ length: PONTOS_DA_ELIPSE }, (_, i) => {
      const a = (i / PONTOS_DA_ELIPSE) * Math.PI * 2;
      return { x: cx + Math.cos(a) * rx, y: cy + Math.sin(a) * ry };
    });
  } else if (g === "triangle" || g === "triangleInverted" || g === "rtTriangle") {
    pontos =
      g === "triangle"
        ? [
            { x: x + w / 2, y },
            { x: x + w, y: y + h },
            { x, y: y + h },
          ]
        : g === "triangleInverted"
          ? [
              { x, y },
              { x: x + w, y },
              { x: x + w / 2, y: y + h },
            ]
          : [
              { x, y },
              { x, y: y + h },
              { x: x + w, y: y + h },
            ];
  } else {
    // retângulo, com os cantos arredondados que a forma tiver
    const cantos = cantosDe(s) ?? [0, 0, 0, 0];
    const menor = Math.min(w, h);
    const limite = Math.min(menor / 2, w / 2, h / 2);
    const [rtl, rtr, rbr, rbl] = cantos.map((c) => Math.max(0, Math.min((c / 100) * menor, limite)));
    pontos = [];
    pontos.push({ x: x + rtl, y });
    if (rtr > 0.01) {
      pontos.push(...arco(x + w - rtr, y + rtr, rtr, -Math.PI / 2, 0));
    } else {
      pontos.push({ x: x + w, y });
    }
    if (rbr > 0.01) {
      pontos.push(...arco(x + w - rbr, y + h - rbr, rbr, 0, Math.PI / 2));
    } else {
      pontos.push({ x: x + w, y: y + h });
    }
    if (rbl > 0.01) {
      pontos.push(...arco(x + rbl, y + h - rbl, rbl, Math.PI / 2, Math.PI));
    } else {
      pontos.push({ x, y: y + h });
    }
    if (rtl > 0.01) {
      pontos.push(...arco(x + rtl, y + rtl, rtl, Math.PI, (Math.PI * 3) / 2));
    } else {
      pontos.push({ x, y });
    }
  }

  if (!s.rot) return semRepetidos(pontos.map((p) => ({ x: n(p.x), y: n(p.y) })));
  const cx = x + w / 2;
  const cy = y + h / 2;
  return semRepetidos(
    pontos.map((p) => {
      const q = girar(p, cx, cy, s.rot);
      return { x: n(q.x), y: n(q.y) };
    })
  );
}

/** O contorno do palco: a lâmina inteira. */
export function poligonoDoPalco(d: Dim): Ponto[] {
  return [
    { x: 0, y: 0 },
    { x: n(d.w), y: 0 },
    { x: n(d.w), y: n(d.h) },
    { x: 0, y: n(d.h) },
  ];
}

/** Área de um polígono (fórmula do laço; sempre positiva). */
export function areaDoPoligono(pontos: Ponto[]): number {
  let soma = 0;
  for (let i = 0; i < pontos.length; i++) {
    const a = pontos[i];
    const b = pontos[(i + 1) % pontos.length];
    soma += a.x * b.y - b.x * a.y;
  }
  return Math.abs(soma) / 2;
}

/** O ponto está dentro do polígono? (raio para a direita, contando cruzamentos). */
export function pontoDentro(p: Ponto, poligono: Ponto[]): boolean {
  let dentro = false;
  for (let i = 0, j = poligono.length - 1; i < poligono.length; j = i++) {
    const a = poligono[i];
    const b = poligono[j];
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) dentro = !dentro;
  }
  return dentro;
}

/** O centro do polígono pela caixa (serve para a árvore de contenção). */
function centroDe(pontos: Ponto[]): Ponto {
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const p of pontos) {
    x0 = Math.min(x0, p.x);
    y0 = Math.min(y0, p.y);
    x1 = Math.max(x1, p.x);
    y1 = Math.max(y1, p.y);
  }
  return { x: (x0 + x1) / 2, y: (y0 + y1) / 2 };
}

/** Dois segmentos se cortam? (orientações opostas dos dois lados). */
function segmentosSeCortam(a1: Ponto, a2: Ponto, b1: Ponto, b2: Ponto): boolean {
  const lado = (p: Ponto, q: Ponto, r: Ponto): number => Math.sign((q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x));
  const d1 = lado(a1, a2, b1);
  const d2 = lado(a1, a2, b2);
  const d3 = lado(b1, b2, a1);
  const d4 = lado(b1, b2, a2);
  return d1 !== d2 && d3 !== d4 && d1 !== 0 && d2 !== 0 && d3 !== 0 && d4 !== 0;
}

/** Os dois contornos se cruzam? (um vértice dentro do outro ou arestas que se cortam). */
export function poligonosSeCruzam(a: Ponto[], b: Ponto[]): boolean {
  if (a.some((p) => pontoDentro(p, b))) return true;
  if (b.some((p) => pontoDentro(p, a))) return true;
  for (let i = 0; i < a.length; i++) {
    const a1 = a[i];
    const a2 = a[(i + 1) % a.length];
    for (let j = 0; j < b.length; j++) {
      if (segmentosSeCortam(a1, a2, b[j], b[(j + 1) % b.length])) return true;
    }
  }
  return false;
}

/**
 * O mapa das regiões: o palco e uma face por forma (o contorno dela menos os BURACOS).
 *
 * Os buracos de uma face são as formas **menores** cujo contorno **cruza** o dela — não só as que
 * estão inteiramente dentro: um texto que passa por cima de um logo é buraco do cartão E do logo,
 * então nenhuma face cobre o que a pessoa está vendo (era o defeito de usar só a contenção pelo
 * centro). A `profundidade` (para o `regiaoEm` escolher a face do ponto) continua vindo da árvore
 * de contenção pelo CENTRO — o critério que os Arranjos e o desenho que gruda no cartão já usam.
 */
export function regioesDa(formas: Shape[], d: Dim, nomes?: (s: Shape) => string): Regiao[] {
  const entradas: { id: string; nome: string; poligono: Ponto[]; area: number }[] = [
    { id: "", nome: "palco", poligono: poligonoDoPalco(d), area: d.w * d.h },
  ];
  for (const s of formas) {
    const poligono = poligonoDaForma(s, d);
    if (!poligono) continue;
    entradas.push({ id: s.id, nome: nomes ? nomes(s) : "Box", poligono, area: areaDoPoligono(poligono) });
  }

  // pai = o menor contorno (maior que a forma) que contém o centro dela (só para a profundidade)
  const pai = new Map<string, string>();
  for (const e of entradas) {
    if (!e.id) continue;
    const c = centroDe(e.poligono);
    let escolhido = "";
    let menorArea = Infinity;
    for (const outro of entradas) {
      if (outro.id === e.id) continue;
      if (outro.area <= e.area) continue;
      if (!pontoDentro(c, outro.poligono)) continue;
      if (outro.area < menorArea) {
        menorArea = outro.area;
        escolhido = outro.id;
      }
    }
    pai.set(e.id, escolhido);
  }

  // a profundidade é a contagem de contornos que contêm este — o PALCO conta como um nível (a
  // primeira face fora das formas), então uma forma solta na lâmina tem profundidade 1
  const profundidade = (id: string): number => {
    let nivel = 0;
    let atual: string | undefined = id;
    while (atual !== undefined) {
      const p = pai.get(atual);
      if (p === undefined) break;
      nivel++;
      atual = p;
    }
    return nivel;
  };

  return entradas.map((e) => {
    const buracos = entradas
      .filter((x) => x.id !== e.id && x.area < e.area && poligonosSeCruzam(x.poligono, e.poligono))
      .map((x) => x.poligono);
    return {
      dono: e.id,
      nome: e.nome,
      contorno: e.poligono,
      buracos,
      profundidade: profundidade(e.id),
      area: 0,
    };
  }).map((r) => {
    // a área livre desconta só os buracos de DESENHO: um buraco dentro de outro já está fora da
    // face pelo buraco de fora (contar duas vezes encolheria a área sem motivo)
    const areaBuracos = buracosDeDesenho(r).reduce((soma, b) => soma + areaDoPoligono(b), 0);
    return { ...r, area: Math.max(0, areaDoPoligono(r.contorno) - areaBuracos) };
  });
}

/**
 * A região de um ponto (em pt da lâmina): a face que o contém e NÃO está dentro de um buraco dela.
 * Havendo mais de uma (contornos aninhados), vale a **mais funda** — o mesmo ponto está na face do
 * cartão e na do palco, e o que interessa é a do cartão.
 */
export function regiaoEm(regioes: Regiao[], p: Ponto): Regiao | null {
  let escolhida: Regiao | null = null;
  for (const r of regioes) {
    if (!pontoDentro(p, r.contorno)) continue;
    if (r.buracos.some((b) => pontoDentro(p, b))) continue;
    if (!escolhida || r.profundidade > escolhida.profundidade || (r.profundidade === escolhida.profundidade && r.area < escolhida.area)) {
      escolhida = r;
    }
  }
  return escolhida;
}

/**
 * Os buracos que o DESENHO usa: os que estão inteiramente dentro de outro buraco saem. O
 * `evenodd` (e o `nonzero`) volta a preencher o que está dentro de um buraco aninhado — o logo
 * dentro do cartão já está fora da face pelo buraco do cartão, e furá-lo de novo o traria de volta.
 * O teste de ponto, esse, usa a lista inteira (`bugracos`): qualquer contorno sob o ponto bloqueia.
 */
export function buracosDeDesenho(r: Regiao): Ponto[][] {
  return r.buracos.filter((b) => {
    const c = centroDe(b);
    return !r.buracos.some((outro) => outro !== b && areaDoPoligono(outro) > areaDoPoligono(b) && pontoDentro(c, outro));
  });
}

/** O caminho SVG de uma região: o contorno e os buracos como subcaminhos (o `evenodd` fura). */
export function caminhoDaRegiao(r: Regiao): string {
  const sub = (pontos: Ponto[]) => `M ${pontos.map((p) => `${n(p.x)} ${n(p.y)}`).join(" L ")} Z`;
  return [sub(r.contorno), ...buracosDeDesenho(r).map(sub)].join(" ");
}

/**
 * A máscara de uma região: a lâmina inteira com a região (contorno + buracos) como buraco — o que
 * o Estúdio pinta quando a fronteira é uma face, e não a box inteira.
 */
export function mascaraDaRegiao(r: Regiao, d: Dim): string {
  const fora = `M 0 0 L ${n(d.w)} 0 L ${n(d.w)} ${n(d.h)} L 0 ${n(d.h)} Z`;
  return `${fora} ${[r.contorno, ...buracosDeDesenho(r)].map((pontos) => `M ${pontos.map((p) => `${n(p.x)} ${n(p.y)}`).join(" L ")} Z`).join(" ")}`;
}
