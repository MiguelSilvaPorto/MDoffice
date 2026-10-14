// Vizinhança de teclas no teclado ABNT2.
//
// Errar para a tecla do lado é um dos erros de digitação mais comuns ("obrigdao" onde
// era "obrigado", "maneria" onde era "maneira"). Numa distância de edição comum isso
// custa o mesmo que trocar uma letra por qualquer outra; aqui a troca entre vizinhas
// custa metade, o que faz o candidato certo subir sem afrouxar o resto.
//
// As fileiras são tratadas como uma grade alinhada (o teclado real tem deslocamento
// físico entre elas) — é uma aproximação suficiente para julgar vizinhança.
//
// Puro: só o mapa e as contas.

/** Fileiras do ABNT2, na ordem física (a segunda tem o ´; a terceira, o Ç e o ~). */
const FILEIRAS = ["1234567890-=", "qwertyuiop´[", "asdfghjklç~]", "zxcvbnm,.;/"];

/** Custo de trocar uma letra pela outra quando elas são vizinhas. */
const CUSTO_VIZINHA = 0.5;

/** tecla -> vizinhas (a grade de 3×3 em volta, incluindo diagonais). */
const VIZINHAS: Map<string, Set<string>> = (() => {
  const mapa = new Map<string, Set<string>>();
  FILEIRAS.forEach((linha, r) => {
    for (let c = 0; c < linha.length; c++) {
      const tecla = linha[c];
      const viz = mapa.get(tecla) ?? new Set<string>();
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          if (dr === 0 && dc === 0) continue;
          const outra = FILEIRAS[r + dr]?.[c + dc];
          if (outra && outra !== tecla) viz.add(outra);
        }
      }
      mapa.set(tecla, viz);
    }
  });
  return mapa;
})();

/** As duas teclas ficam lado a lado (a mesma tecla conta como vizinha de si). */
export function saoVizinhas(a: string, b: string): boolean {
  if (a === b) return true;
  return VIZINHAS.get(a)?.has(b) ?? false;
}

/** Custo de trocar uma letra pela outra no teclado: 0 para a mesma tecla, metade para vizinhas, 1 para o resto. */
export function custoDeTecla(a: string, b: string): number {
  if (a === b) return 0;
  return saoVizinhas(a, b) ? CUSTO_VIZINHA : 1;
}

/** As teclas ao lado desta (sem ela mesma) — usado para gerar as trocas que valem a pena. */
export function teclasVizinhasDe(tecla: string): string[] {
  return [...(VIZINHAS.get(tecla) ?? [])];
}
