// A "fita métrica" do palco: o texto que mora NAS LINHAS do gesto — a linha em pé mostra o x e a
// deitada o y (ao mover); a linha de baixo mostra a largura e a da direita a altura (ao
// redimensionar ou desenhar). Puro (sem DOM) para dar para testar no Node.
//
// A unidade é o **cm** — a mesma do painel Tamanho (e da régua de campos da fita), para o
// número do gesto bater com o que a pessoa lê depois nos campos.
import type { ShapeBox } from "../schema";
import type { Dim } from "./geometria";

/** pt -> cm (a mesma conta do `ui/estado.ptParaCm`; aqui para este módulo seguir sem UI). */
const ptParaCm = (pt: number) => (pt / 72) * 2.54;

/** Um número com vírgula e no máximo uma casa, como o painel mostra (12,5). */
const n = (v: number) => v.toLocaleString("pt-BR", { maximumFractionDigits: 1 });

/** "x 3,4 cm" — a posição horizontal, para a linha EM PÉ (ao mover). */
export function textoX(box: ShapeBox, d: Dim): string {
  return `x ${n(ptParaCm((box.x / 100) * d.w))} cm`;
}

/** "y 4,8 cm" — a posição vertical, para a linha DEITADA (ao mover). */
export function textoY(box: ShapeBox, d: Dim): string {
  return `y ${n(ptParaCm((box.y / 100) * d.h))} cm`;
}

/** "16,9 cm" — a largura, para a linha de BAIXO (ao redimensionar/desenhar). */
export function textoLargura(box: ShapeBox, d: Dim): string {
  return `${n(ptParaCm((box.w / 100) * d.w))} cm`;
}

/** "7,6 cm" — a altura, para a linha da DIREITA (ao redimensionar/desenhar). */
export function textoAltura(box: ShapeBox, d: Dim): string {
  return `${n(ptParaCm((box.h / 100) * d.h))} cm`;
}
