// A PINTURA do Estúdio (fase 3): o que se desenha DENTRO da fronteira, recortado na geometria.
//
// A fronteira é o que a fase 1 e a fase 2 entregaram: a box (contorno externo) ou uma REGIÃO
// (contorno + buracos). Aqui a pintura vira geometria de verdade — nada de "máscara que só o app
// entende": o polígono resultante JÁ está dentro do contorno, então o `.pptx` mostra exatamente o
// que estava na tela, em qualquer visualizador.
//
// Duas peças fazem o trabalho:
//
// 1. **O recorte** (Sutherland–Hodgman): o traço da mão vira uma fita (polígono) e é cortado pela
//    fronteira. O recorte vale para janelas CONVEXAS — e as fronteiras do Estúdio são (retângulo,
//    retângulo arredondado, elipse, triângulo): quem não for convexa não recebe pintura (é dito, e
//    não pintado torto).
// 2. **Os buracos por sentido**: os buracos entram no caminho como subcaminhos em sentido
//    INVERTIDO. É o truque do "donut" do OOXML (e o mesmo do SVG): o preenchimento deixa o miolo
//    vazio — na tela e no arquivo — sem precisar subtrair polígonos.
//
// Tudo é puro: o host só decide quando pintar.

import type { CustPath, Shape } from "../schema";
import type { Dim, Ponto } from "./regioes";
import { areaDoPoligono } from "./regioes";

/** Dois pontos no mesmo lugar (a tolerância é a do arredondamento do motor). */
const mesmoPonto = (a: Ponto, b: Ponto): boolean => Math.abs(a.x - b.x) < 0.01 && Math.abs(a.y - b.y) < 0.01;

/** Tira pontos repetidos e o último igual ao primeiro. */
export function limparPoligono(pontos: Ponto[]): Ponto[] {
  const saida: Ponto[] = [];
  for (const p of pontos) if (!saida.length || !mesmoPonto(saida[saida.length - 1], p)) saida.push(p);
  if (saida.length > 1 && mesmoPonto(saida[0], saida[saida.length - 1])) saida.pop();
  return saida;
}

/** O polígono está no sentido anti-horário? (a área com sinal, que a fórmula do laço dá) */
export function sentidoAntiHorario(pontos: Ponto[]): boolean {
  let soma = 0;
  for (let i = 0; i < pontos.length; i++) {
    const a = pontos[i];
    const b = pontos[(i + 1) % pontos.length];
    soma += a.x * b.y - b.x * a.y;
  }
  return soma < 0;
}

/** O polígono é convexo? (todo cruzamento de arestas vizinhas vira para o mesmo lado) */
export function ehConvexo(pontos: Ponto[]): boolean {
  const n = pontos.length;
  if (n < 4) return true;
  const sinal = (p: Ponto, q: Ponto, r: Ponto): number => Math.sign((q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x));
  let lado = 0;
  for (let i = 0; i < n; i++) {
    const s = sinal(pontos[i], pontos[(i + 1) % n], pontos[(i + 2) % n]);
    if (s === 0) continue;
    if (lado === 0) lado = s;
    else if (s !== lado) return false;
  }
  return true;
}

/** A janela no sentido anti-horário (o recorte exige um sentido só). */
function comoAntiHorario(pontos: Ponto[]): Ponto[] {
  const p = limparPoligono(pontos);
  return sentidoAntiHorario(p) ? p : [...p].reverse();
}

/** Dentro da aresta `a→b` (à esquerda dela), para uma janela anti-horária. */
const dentroDaAresta = (p: Ponto, a: Ponto, b: Ponto): number => (b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x);

/** Onde as retas `p→q` e `a→b` se cruzam (para o ponto novo da aresta recortada). */
function cruzamento(p: Ponto, q: Ponto, a: Ponto, b: Ponto): Ponto {
  const r = { x: q.x - p.x, y: q.y - p.y };
  const s = { x: b.x - a.x, y: b.y - a.y };
  const den = r.x * s.y - r.y * s.x;
  if (Math.abs(den) < 1e-9) return { x: q.x, y: q.y };
  const t = ((a.x - p.x) * s.y - (a.y - p.y) * s.x) / den;
  return { x: p.x + r.x * t, y: p.y + r.y * t };
}

/**
 * Recorta o SUJEITO pela JANELA convexa (Sutherland–Hodgman): o resultado está inteiro dentro da
 * janela — é isso que garante o "não sai nem 1 px". Sem janela ou sem sujeito, devolve o que veio.
 */
export function recortar(sujeito: Ponto[], janela: Ponto[]): Ponto[] {
  let saida = limparPoligono(sujeito);
  const janelaCCW = comoAntiHorario(janela);
  if (saida.length < 3 || janelaCCW.length < 3) return saida;
  for (let i = 0; i < janelaCCW.length; i++) {
    const a = janelaCCW[i];
    const b = janelaCCW[(i + 1) % janelaCCW.length];
    const entrada: Ponto[] = [];
    for (let j = 0; j < saida.length; j++) {
      const atual = saida[j];
      const anterior = saida[(j + saida.length - 1) % saida.length];
      const dAtual = dentroDaAresta(atual, a, b);
      const dAnterior = dentroDaAresta(anterior, a, b);
      if (dAtual <= 0) {
        if (dAnterior > 0) entrada.push(cruzamento(anterior, atual, a, b));
        entrada.push(atual);
      } else if (dAnterior <= 0) {
        entrada.push(cruzamento(anterior, atual, a, b));
      }
    }
    saida = limparPoligono(entrada);
    if (saida.length < 3) return [];
  }
  return saida;
}

/**
 * A fita de um traço à mão: o contorno de uma pincelada com LARGURA (pt). Os pontos vêm do
 * ponteiro; o lado de cada ponto sai da direção média dos vizinhos. Um ponto só vira um losango
 * (o "toque" da caneta tem largura, não é um pixel).
 */
export function fitaDoTraco(pontos: Ponto[], largura: number): Ponto[] {
  const pts = limparPoligono(pontos);
  const meia = Math.max(0.5, largura) / 2;
  if (!pts.length) return [];
  if (pts.length === 1) {
    const p = pts[0];
    return [
      { x: p.x - meia, y: p.y },
      { x: p.x, y: p.y - meia },
      { x: p.x + meia, y: p.y },
      { x: p.x, y: p.y + meia },
    ];
  }
  const esquerda: Ponto[] = [];
  const direita: Ponto[] = [];
  for (let i = 0; i < pts.length; i++) {
    const anterior = pts[Math.max(0, i - 1)];
    const proximo = pts[Math.min(pts.length - 1, i + 1)];
    const dx = proximo.x - anterior.x;
    const dy = proximo.y - anterior.y;
    const m = Math.hypot(dx, dy) || 1;
    // normal da direção média (o lado "de cima" do traço)
    const nx = -dy / m;
    const ny = dx / m;
    esquerda.push({ x: pts[i].x + nx * meia, y: pts[i].y + ny * meia });
    direita.push({ x: pts[i].x - nx * meia, y: pts[i].y - ny * meia });
  }
  return limparPoligono([...esquerda, ...direita.reverse()]);
}

/** A caixa (em pt) de um polígono. */
export function caixaDoPoligono(pontos: Ponto[]): { x: number; y: number; w: number; h: number } {
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
  return { x: x0, y: y0, w: Math.max(0.01, x1 - x0), h: Math.max(0.01, y1 - y0) };
}

/** O caminho do custGeom de um polígono fechado, com os coordenadas relativas à caixa. */
function caminhoDePoligono(pontos: Ponto[], caixa: { x: number; y: number; w: number; h: number }, inverter: boolean): CustPath {
  const ordem = inverter ? [...pontos].reverse() : pontos;
  const cmds: (string | number)[] = [];
  ordem.forEach((p, i) => {
    if (i === 0) cmds.push("M", Math.round((p.x - caixa.x) * 100) / 100, Math.round((p.y - caixa.y) * 100) / 100);
    else cmds.push("L", Math.round((p.x - caixa.x) * 100) / 100, Math.round((p.y - caixa.y) * 100) / 100);
  });
  cmds.push("Z");
  return { w: Math.round(caixa.w * 100) / 100, h: Math.round(caixa.h * 100) / 100, cmds };
}

/**
 * O caminho da pintura: o contorno e, depois, os BURACOS em sentido invertido (o truque do
 * "donut": o preenchimento deixa o miolo vazio, na tela e no `.pptx`). Tudo num caminho só, com as
 * coordenadas relativas à caixa do contorno.
 */
export function caminhoDaPintura(contorno: Ponto[], buracos: Ponto[][], caixa = caixaDoPoligono(contorno)): CustPath {
  const base = limparPoligono(contorno);
  const cmds: (string | number)[] = [];
  const juntar = (pontos: Ponto[], inverter: boolean): void => {
    const ordem = inverter ? [...pontos].reverse() : pontos;
    ordem.forEach((p, i) => {
      const x = Math.round((p.x - caixa.x) * 100) / 100;
      const y = Math.round((p.y - caixa.y) * 100) / 100;
      if (i === 0) cmds.push("M", x, y);
      else cmds.push("L", x, y);
    });
    cmds.push("Z");
  };
  juntar(base, false);
  const fora = buracos.map(limparPoligono).filter((b) => b.length > 2);
  for (const b of fora) juntar(b, true);
  const w = Math.round(caixa.w * 100) / 100;
  const h = Math.round(caixa.h * 100) / 100;
  return { w, h, cmds };
}

/**
 * A forma da pintura: geometria livre no box do polígono, preenchida com a cor e a transparência
 * (`alpha`; 1 = opaco). Sem contorno e sem texto — é tinta, não caixa.
 */
export function formaDaPintura(
  contorno: Ponto[],
  buracos: Ponto[][],
  cor: string,
  alpha: number,
  id: string,
  d: Dim,
  nome = "Pintura"
): Shape | null {
  const base = limparPoligono(contorno);
  if (base.length < 3) return null;
  const caixa = caixaDoPoligono(base);
  const caminho = caminhoDaPintura(base, buracos, caixa);
  return {
    id,
    kind: "forma",
    box: { x: (caixa.x / d.w) * 100, y: (caixa.y / d.h) * 100, w: (caixa.w / d.w) * 100, h: (caixa.h / d.h) * 100 },
    text: "",
    fontFamily: "Segoe UI",
    fontSize: 18,
    color: cor,
    bold: false,
    italic: false,
    align: "esquerda",
    fill: "",
    src: "",
    rot: 0,
    name: nome,
    paths: [caminho],
    fillX: { kind: "solid", color: cor, alpha: Math.max(0.05, Math.min(1, alpha)) },
  };
}

/** A forma do PINCEL: a fita do traço, já recortada pela fronteira (e com os buracos dela). */
export function formaDoPincel(pontos: Ponto[], largura: number, cor: string, alpha: number, id: string, d: Dim): Shape | null {
  const fita = fitaDoTraco(pontos, largura);
  if (!fita.length) return null;
  return formaDaPintura(fita, [], cor, alpha, id, d, "Pintura · pincel");
}

/** Os buracos que a pintura precisa furar: os da região/box em que ela está caindo. */
export function buracosDaFronteira(buracos: Ponto[][], contorno: Ponto[]): Ponto[][] {
  const caixaFora = caixaDoPoligono(contorno);
  return buracos.filter((b) => {
    if (b.length < 3) return false;
    // buracos fora do contorno não interessam (e um buraco inteiramente fora dele não entrega nada)
    const c = caixaDoPoligono(b);
    return !(c.x + c.w < caixaFora.x || c.x > caixaFora.x + caixaFora.w || c.y + c.h < caixaFora.y || c.y > caixaFora.y + caixaFora.h);
  });
}

/** Área da pintura depois do recorte (o teste usa para conferir que nada ficou de fora). */
export function areaDaPintura(contorno: Ponto[], buracos: Ponto[][]): number {
  return Math.max(0, areaDoPoligono(contorno) - buracos.reduce((soma, b) => soma + areaDoPoligono(b), 0));
}
