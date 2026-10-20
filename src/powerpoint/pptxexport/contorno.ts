// Contorno parcial na exportação: o PowerPoint não conhece borda por lado (o `a:ln` é
// sempre em volta da forma). Então cada trecho vira uma forma de linha (custGeom) por cima
// da forma-base, que perde o contorno. O arquivo abre igual no PowerPoint; ao reabrir no
// MDOffice, os trechos voltam como formas de linha — o visual é o mesmo.

import type { Deck, DeckSetup, Shape } from "../schema";
import { caixaEmPol } from "./shapes";
import { segmentosDoContorno } from "../edicao/contorno";

export function expandirContornosParciais(deck: Deck, setup: DeckSetup): Deck {
  let mudou = false;
  const slides = deck.slides.map((sl) => {
    let mexeu = false;
    const shapes: Shape[] = [];
    for (const s of sl.shapes) {
      if (!s.lnLados) {
        shapes.push(s);
        continue;
      }
      const { w, h } = caixaEmPol(s.box, setup);
      const segs = w > 0 && h > 0 ? segmentosDoContorno(s, w, h) : null;
      if (!segs || !segs.length) {
        shapes.push(s);
        continue;
      }
      mexeu = mudou = true;
      shapes.push({ ...s, ln: undefined, lnLados: undefined });
      segs.forEach((seg, i) => {
        const cmds: (string | number)[] = [
          "M", (seg.x1 / w) * 1000, (seg.y1 / h) * 1000,
          "L", (seg.x2 / w) * 1000, (seg.y2 / h) * 1000,
        ];
        shapes.push({
          ...s,
          id: `${s.id}-contorno-${i}`,
          kind: "forma",
          geom: "rect",
          paths: [{ w: 1000, h: 1000, cmds, fill: "none", stroke: true }],
          fill: "",
          fillX: { kind: "none" },
          text: "",
          paras: undefined,
          shadow: undefined,
          opacity: 1,
          ln: s.ln ? { ...s.ln } : undefined,
          lnLados: undefined,
        });
      });
    }
    return mexeu ? { ...sl, shapes } : sl;
  });
  return mudou ? { ...deck, slides } : deck;
}
