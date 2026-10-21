// A "fita métrica" do palco: o texto que mora NAS LINHAS do gesto — a linha em pé mostra o x e a
// deitada o y (ao mover); a linha de baixo mostra a largura e a da direita a altura (ao
// redimensionar ou desenhar). Ao girar, mostra o ângulo da forma (ou o quanto a seleção girou)
// junto da alça de giro. Puro (sem DOM) para dar para testar no Node.
//
// A unidade das medidas é o **cm** — a mesma do painel Tamanho (e da régua de campos da fita), para
// o número do gesto bater com o que a pessoa lê depois nos campos. O giro usa **graus**, como o
// campo Rotação.
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

/**
 * "37°" — o giro que a forma tem agora. Com `delta`, mostra o quanto a seleção
 * girou ("+37°" / "-12°"): é o número que vale para VÁRIAS formas, porque cada uma
 * pode ter partido de um ângulo próprio. A vírgula e a casa decimal são as mesmas
 * do campo Rotação do painel.
 */
export function textoGiro(graus: number, delta = false): string {
  const v = Math.abs(graus) < 0.05 ? 0 : graus;
  const num = v.toLocaleString("pt-BR", { maximumFractionDigits: 1 });
  if (!delta) return `${num}°`;
  return `${v > 0 ? "+" : ""}${num}°`;
}
