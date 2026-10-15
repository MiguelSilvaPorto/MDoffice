// A "fita métrica" do palco: o texto do balão que acompanha a forma enquanto ela é movida,
// redimensionada ou desenhada. Puro (sem DOM) para dar para testar no Node.
//
// A unidade é o **cm** — a mesma do painel Tamanho (e da régua de campos da fita), para o
// número do gesto bater com o que a pessoa lê depois nos campos.
import type { ShapeBox } from "../schema";
import type { Dim } from "./geometria";

/** pt -> cm (a mesma conta do `ui/estado.ptParaCm`; aqui para este módulo seguir sem UI). */
const ptParaCm = (pt: number) => (pt / 72) * 2.54;

/** Um número com vírgula e no máximo uma casa, como o painel mostra (12,5). */
const n = (v: number) => v.toLocaleString("pt-BR", { maximumFractionDigits: 1 });

/** "16,9 × 7,6 cm" — o tamanho da caixa (para o arrasto de redimensionar e o de desenhar). */
export function textoDoTamanho(box: ShapeBox, d: Dim): string {
  return `${n(ptParaCm((box.w / 100) * d.w))} × ${n(ptParaCm((box.h / 100) * d.h))} cm`;
}

/** "x 3,4 · y 4,8 cm" — a posição do canto superior esquerdo (para o arrasto de mover). */
export function textoDaPosicao(box: ShapeBox, d: Dim): string {
  return `x ${n(ptParaCm((box.x / 100) * d.w))} · y ${n(ptParaCm((box.y / 100) * d.h))} cm`;
}
