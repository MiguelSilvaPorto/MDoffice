// O ESTÚDIO — fase 1: isolar uma box e trabalhar só nela.
//
// Este módulo é PURO (nada de DOM): diz se a forma escolhida pode ser isolada e devolve o CAMINHO
// dela em pt da lâmina — o mesmo caminho que vira a máscara do ambiente isolado (o resto da lâmina
// fica esmaecido) e que, nas fases seguintes, será a fronteira do recorte da pintura.
//
// "Box" aqui é qualquer forma com ÁREA: retângulo (com ou sem cantos arredondados, **raio por
// canto**), elipse, triângulo e as demais formas predefinidas. Linha, conector, geometria livre
// (custGeom) e traço de tinta ficam de fora: não têm área para isolar — e o caminho deles não é o
// que a máscara precisa mostrar.

import type { Shape } from "../schema";
import { cantosDe } from "./formato";

export interface Dim {
  w: number;
  h: number;
}

/** Duas casas: o caminho vai para um `viewBox` em pt, e o número redondo mantém o SVG pequeno. */
const n = (v: number): number => Math.round(v * 100) / 100;

/** A caixa da forma em pt da lâmina (a unidade do resto do motor). */
export function boxEmPt(s: Shape, d: Dim): { x: number; y: number; w: number; h: number } {
  return { x: (s.box.x / 100) * d.w, y: (s.box.y / 100) * d.h, w: (s.box.w / 100) * d.w, h: (s.box.h / 100) * d.h };
}

/**
 * A forma tem área para isolar? Linha, conector, geometria livre e traço de tinta não têm — e uma
 * caixa sem tamanho também não. O resto (retângulo, arredondado, elipse, triângulo, texto, imagem,
 * gráfico, tabela) pode.
 */
export function podeIsolar(s: Shape | undefined | null): boolean {
  if (!s) return false;
  if (s.box.w <= 0 || s.box.h <= 0) return false;
  if (s.tinta?.length) return false;
  if (s.paths?.length) return false;
  const g = s.geom ?? "rect";
  if (g === "line" || g.endsWith("Connector3") || g.endsWith("Connector")) return false;
  return true;
}

/** O nome da box na trilha do Estúdio: o nome do arquivo, senão a primeira linha do texto. */
export function nomeDaBox(s: Shape): string {
  const salvo = (s.name ?? "").trim();
  if (salvo) return salvo;
  const doTexto = s.paras?.length ? s.paras.map((p) => p.runs.map((r) => r.text).join("")).join("\n") : (s.text ?? "");
  const linha = doTexto
    .split("\n")
    .map((l) => l.trim())
    .find((l) => l.length > 0);
  return linha ? linha.slice(0, 40) : "Box";
}

/** Geometrias que desenhamos com o caminho exato; o resto cai no retângulo da caixa. */
const ELIPSES = new Set(["ellipse", "oval", "circle"]);
const TRIANGULOS = new Set(["triangle", "triangleInverted", "rtTriangle"]);

/**
 * O caminho da box em pt, no formato que o SVG (`viewBox="0 0 d.w d.h"`) entende. `null` quando a
 * forma não tem área para isolar. As geometrias predefinidas que não desenhamos com exatidão (as
 * estrelas, os balões, os conectores curtos...) caem no retângulo da caixa — a máscara continua
 * valendo e o comportamento é previsível.
 */
export function caminhoDaBox(s: Shape, d: Dim): string | null {
  if (!podeIsolar(s)) return null;
  const { x, y, w, h } = boxEmPt(s, d);
  const x2 = x + w;
  const y2 = y + h;
  const g = s.geom ?? "rect";

  if (ELIPSES.has(g)) {
    const rx = w / 2;
    const ry = h / 2;
    const cx = x + rx;
    const cy = y + ry;
    // duas meias-voltas: o mesmo sentido dos presets do OOXML (a elipse inteira num só caminho)
    return `M ${n(cx)} ${n(y)} A ${n(rx)} ${n(ry)} 0 0 1 ${n(cx)} ${n(y2)} A ${n(rx)} ${n(ry)} 0 0 1 ${n(cx)} ${n(y)} Z`;
  }

  if (TRIANGULOS.has(g)) {
    const pts: [number, number][] =
      g === "triangle"
        ? [
            [x + w / 2, y],
            [x2, y2],
            [x, y2],
          ]
        : g === "triangleInverted"
          ? [
              [x, y],
              [x2, y],
              [x + w / 2, y2],
            ]
          : [
              // triângulo retângulo do OOXML: ângulo reto no canto inferior esquerdo
              [x, y],
              [x, y2],
              [x2, y2],
            ];
    return `M ${pts.map(([px, py]) => `${n(px)} ${n(py)}`).join(" L ")} Z`;
  }

  // retângulo — com os cantos arredondados que a forma tiver (o raio é o MESMO que o desenho usa:
  // % do menor lado, por canto; o limite de metade do lado evita que dois cantos se cruzem)
  const cantos = cantosDe(s) ?? [0, 0, 0, 0];
  const menor = Math.min(w, h);
  const limite = Math.min(menor / 2, w / 2, h / 2);
  const [rtl, rtr, rbr, rbl] = cantos.map((c) => Math.max(0, Math.min((c / 100) * menor, limite)));
  if (rtl + rtr + rbr + rbl === 0) return `M ${n(x)} ${n(y)} L ${n(x2)} ${n(y)} L ${n(x2)} ${n(y2)} L ${n(x)} ${n(y2)} Z`;
  const arco = (r: number, px: number, py: number) => (r > 0.01 ? ` A ${n(r)} ${n(r)} 0 0 1 ${n(px)} ${n(py)}` : "");
  return (
    `M ${n(x + rtl)} ${n(y)}` +
    ` L ${n(x2 - rtr)} ${n(y)}${arco(rtr, x2, y + rtr)}` +
    ` L ${n(x2)} ${n(y2 - rbr)}${arco(rbr, x2 - rbr, y2)}` +
    ` L ${n(x + rbl)} ${n(y2)}${arco(rbl, x, y2 - rbl)}` +
    ` L ${n(x)} ${n(y + rtl)}${arco(rtl, x + rtl, y)} Z`
  );
}

/**
 * O anel da máscara: o retângulo da lâmina com a box como BURACO (o preenchimento cobre o que está
 * fora da box). É o que esmaece o resto da lâmina no ambiente isolado, sem esconder nada.
 */
export function mascaraDaBox(s: Shape, d: Dim): string | null {
  const dentro = caminhoDaBox(s, d);
  if (!dentro) return null;
  const fora = `M 0 0 L ${n(d.w)} 0 L ${n(d.w)} ${n(d.h)} L 0 ${n(d.h)} Z`;
  return `${fora} ${dentro}`;
}
