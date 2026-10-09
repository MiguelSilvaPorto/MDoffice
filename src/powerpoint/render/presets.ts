// Geometrias predefinidas do OOXML (prstGeom) e geometria livre (custGeom) convertidas em caminhos SVG.
// As coordenadas saem em pt (o desenho da forma usa viewBox em pt, então traço e geometria ficam em escala exata).
import type { CustPath } from "../schema";

export interface Traçado {
  d: string;
  /** false = só contorno (linhas e conectores) */
  preenche: boolean;
  /** false = sem contorno (caminho com stroke="0") */
  traco?: boolean;
  /** regra de preenchimento para formas vazadas (moldura, rosca) */
  evenodd?: boolean;
}

const f = (n: number) => (Math.round(n * 1000) / 1000).toString();

function poligono(pts: [number, number][]): string {
  return "M" + pts.map(([x, y]) => `${f(x)} ${f(y)}`).join("L") + "Z";
}

function elipse(cx: number, cy: number, rx: number, ry: number): string {
  return `M${f(cx - rx)} ${f(cy)}A${f(rx)} ${f(ry)} 0 1 0 ${f(cx + rx)} ${f(cy)}A${f(rx)} ${f(ry)} 0 1 0 ${f(cx - rx)} ${f(cy)}Z`;
}

function retanguloArredondado(w: number, h: number, r: number): string {
  r = Math.max(0, Math.min(r, w / 2, h / 2));
  if (r === 0) return `M0 0H${f(w)}V${f(h)}H0Z`;
  return `M${f(r)} 0H${f(w - r)}A${f(r)} ${f(r)} 0 0 1 ${f(w)} ${f(r)}V${f(h - r)}A${f(r)} ${f(r)} 0 0 1 ${f(w - r)} ${f(h)}H${f(r)}A${f(r)} ${f(r)} 0 0 1 0 ${f(h - r)}V${f(r)}A${f(r)} ${f(r)} 0 0 1 ${f(r)} 0Z`;
}

/** Presets conhecidos (para avisar quando um não existe). */
export const PRESETS_CONHECIDOS = new Set([
  "rect", "roundRect", "ellipse", "triangle", "rtTriangle", "diamond", "parallelogram", "trapezoid", "pentagon", "hexagon",
  "octagon", "chevron", "homePlate", "rightArrow", "leftArrow", "upArrow", "downArrow", "star5", "plus", "donut", "frame",
  "line", "straightConnector1", "bentConnector2", "bentConnector3", "curvedConnector3", "round1Rect", "round2SameRect",
  "snip1Rect", "snip2SameRect", "flowChartProcess", "flowChartAlternateProcess", "flowChartTerminator", "flowChartDecision",
  "teardrop", "noSmoking", "mathPlus", "mathMinus", "mathMultiply", "cloud", "heart", "lightningBolt", "sun", "moon", "smileyFace",
  "wedgeRectCallout", "wedgeRoundRectCallout", "ribbon", "leftRightArrow", "upDownArrow", "can", "cube", "arc", "blockArc", "pie",
]);

/** Traçados de um preset, em pt. `adj` traz os ajustes do arquivo (1/100000). */
export function tracadoDoPreset(prst: string, w: number, h: number, adj: Record<string, number> = {}): Traçado[] {
  const ss = Math.min(w, h);
  const a = (nome: string, padrao: number) => adj[nome] ?? padrao;
  switch (prst) {
    case "rect":
    case "flowChartProcess":
      return [{ d: `M0 0H${f(w)}V${f(h)}H0Z`, preenche: true }];
    case "roundRect":
    case "flowChartAlternateProcess": {
      const r = (ss * Math.min(a("adj", prst === "roundRect" ? 16667 : 16667), 50000)) / 100000;
      return [{ d: retanguloArredondado(w, h, r), preenche: true }];
    }
    case "flowChartTerminator":
      return [{ d: retanguloArredondado(w, h, Math.min(w, h) / 2), preenche: true }];
    case "round1Rect": {
      const r = (ss * Math.min(a("adj", 16667), 50000)) / 100000;
      return [{ d: `M0 0H${f(w - r)}A${f(r)} ${f(r)} 0 0 1 ${f(w)} ${f(r)}V${f(h)}H0Z`, preenche: true }];
    }
    case "round2SameRect": {
      const r1 = (ss * Math.min(a("adj1", 16667), 50000)) / 100000;
      const r2 = (ss * Math.min(a("adj2", 0), 50000)) / 100000;
      return [
        {
          d: `M${f(r1)} 0H${f(w - r1)}A${f(r1)} ${f(r1)} 0 0 1 ${f(w)} ${f(r1)}V${f(h - r2)}A${f(r2)} ${f(r2)} 0 0 1 ${f(w - r2)} ${f(h)}H${f(r2)}A${f(r2)} ${f(r2)} 0 0 1 0 ${f(h - r2)}V${f(r1)}A${f(r1)} ${f(r1)} 0 0 1 ${f(r1)} 0Z`,
          preenche: true,
        },
      ];
    }
    case "snip1Rect": {
      const s = (ss * Math.min(a("adj", 16667), 50000)) / 100000;
      return [{ d: poligono([[0, 0], [w - s, 0], [w, s], [w, h], [0, h]]), preenche: true }];
    }
    case "snip2SameRect": {
      const s1 = (ss * Math.min(a("adj1", 16667), 50000)) / 100000;
      const s2 = (ss * Math.min(a("adj2", 0), 50000)) / 100000;
      return [{ d: poligono([[s1, 0], [w - s1, 0], [w, s1], [w, h - s2], [w - s2, h], [s2, h], [0, h - s2], [0, s1]]), preenche: true }];
    }
    case "ellipse":
      return [{ d: elipse(w / 2, h / 2, w / 2, h / 2), preenche: true }];
    case "triangle": {
      const x = (w * a("adj", 50000)) / 100000;
      return [{ d: poligono([[0, h], [x, 0], [w, h]]), preenche: true }];
    }
    case "rtTriangle":
      return [{ d: poligono([[0, 0], [0, h], [w, h]]), preenche: true }];
    case "diamond":
    case "flowChartDecision":
      return [{ d: poligono([[w / 2, 0], [w, h / 2], [w / 2, h], [0, h / 2]]), preenche: true }];
    case "parallelogram": {
      const x = (ss * Math.min(a("adj", 25000), (100000 * w) / (ss || 1))) / 100000;
      return [{ d: poligono([[0, h], [x, 0], [w, 0], [w - x, h]]), preenche: true }];
    }
    case "trapezoid": {
      const x = (ss * Math.min(a("adj", 25000), (50000 * w) / (ss || 1))) / 100000;
      return [{ d: poligono([[0, h], [x, 0], [w - x, 0], [w, h]]), preenche: true }];
    }
    case "pentagon":
      return [{ d: poligono([[w * 0.5, 0], [w, h * 0.3799], [w * 0.809, h], [w * 0.191, h], [0, h * 0.3799]]), preenche: true }];
    case "hexagon": {
      const x = (ss * Math.min(a("adj", 25000), 50000)) / 100000;
      return [{ d: poligono([[0, h / 2], [x, 0], [w - x, 0], [w, h / 2], [w - x, h], [x, h]]), preenche: true }];
    }
    case "octagon": {
      const x = (ss * Math.min(a("adj", 29289), 50000)) / 100000;
      return [{ d: poligono([[0, x], [x, 0], [w - x, 0], [w, x], [w, h - x], [w - x, h], [x, h], [0, h - x]]), preenche: true }];
    }
    case "chevron": {
      const x = (ss * Math.min(a("adj", 50000), (100000 * w) / (ss || 1))) / 100000;
      return [{ d: poligono([[0, 0], [w - x, 0], [w, h / 2], [w - x, h], [0, h], [x, h / 2]]), preenche: true }];
    }
    case "homePlate": {
      const x = (ss * Math.min(a("adj", 50000), (100000 * w) / (ss || 1))) / 100000;
      return [{ d: poligono([[0, 0], [w - x, 0], [w, h / 2], [w - x, h], [0, h]]), preenche: true }];
    }
    case "rightArrow":
    case "leftArrow": {
      const dx = (ss * Math.min(a("adj2", 50000), (100000 * w) / (ss || 1))) / 100000;
      const dy = (h * a("adj1", 50000)) / 200000;
      const y1 = h / 2 - dy;
      const y2 = h / 2 + dy;
      const pts: [number, number][] =
        prst === "rightArrow"
          ? [[0, y1], [w - dx, y1], [w - dx, 0], [w, h / 2], [w - dx, h], [w - dx, y2], [0, y2]]
          : [[w, y1], [dx, y1], [dx, 0], [0, h / 2], [dx, h], [dx, y2], [w, y2]];
      return [{ d: poligono(pts), preenche: true }];
    }
    case "upArrow":
    case "downArrow": {
      const dy = (ss * Math.min(a("adj2", 50000), (100000 * h) / (ss || 1))) / 100000;
      const dx = (w * a("adj1", 50000)) / 200000;
      const x1 = w / 2 - dx;
      const x2 = w / 2 + dx;
      const pts: [number, number][] =
        prst === "upArrow"
          ? [[x1, h], [x1, dy], [0, dy], [w / 2, 0], [w, dy], [x2, dy], [x2, h]]
          : [[x1, 0], [x1, h - dy], [0, h - dy], [w / 2, h], [w, h - dy], [x2, h - dy], [x2, 0]];
      return [{ d: poligono(pts), preenche: true }];
    }
    case "leftRightArrow": {
      const dx = (ss * Math.min(a("adj2", 50000), (50000 * w) / (ss || 1))) / 100000;
      const dy = (h * a("adj1", 50000)) / 200000;
      const y1 = h / 2 - dy;
      const y2 = h / 2 + dy;
      return [{ d: poligono([[0, h / 2], [dx, 0], [dx, y1], [w - dx, y1], [w - dx, 0], [w, h / 2], [w - dx, h], [w - dx, y2], [dx, y2], [dx, h]]), preenche: true }];
    }
    case "upDownArrow": {
      const dy = (ss * Math.min(a("adj2", 50000), (50000 * h) / (ss || 1))) / 100000;
      const dx = (w * a("adj1", 50000)) / 200000;
      const x1 = w / 2 - dx;
      const x2 = w / 2 + dx;
      return [{ d: poligono([[w / 2, 0], [w, dy], [x2, dy], [x2, h - dy], [w, h - dy], [w / 2, h], [0, h - dy], [x1, h - dy], [x1, dy], [0, dy]]), preenche: true }];
    }
    case "star5": {
      const cx = w / 2;
      const cy = h / 2;
      const ri = Math.min(0.99, a("adj", 19098) / 50000);
      const pts: [number, number][] = [];
      for (let i = 0; i < 10; i++) {
        const ang = -Math.PI / 2 + (i * Math.PI) / 5;
        const k = i % 2 === 0 ? 1 : ri;
        pts.push([cx + Math.cos(ang) * (w / 2) * k, cy + Math.sin(ang) * (h / 2) * k]);
      }
      return [{ d: poligono(pts), preenche: true }];
    }
    case "plus":
    case "mathPlus": {
      const x = (ss * (prst === "plus" ? a("adj", 25000) : a("adj1", 23520) / 2)) / 100000;
      return [{ d: poligono([[x, 0], [w - x, 0], [w - x, x], [w, x], [w, h - x], [w - x, h - x], [w - x, h], [x, h], [x, h - x], [0, h - x], [0, x], [x, x]]), preenche: true }];
    }
    case "mathMinus": {
      const y = (h * a("adj1", 23520)) / 200000;
      return [{ d: poligono([[0, h / 2 - y], [w, h / 2 - y], [w, h / 2 + y], [0, h / 2 + y]]), preenche: true }];
    }
    case "mathMultiply": {
      const k = 0.18;
      const cx = w / 2;
      const cy = h / 2;
      return [{ d: poligono([[w * k, 0], [cx, cy - h * k], [w - w * k, 0], [w, h * k], [cx + w * k, cy], [w, h - h * k], [w - w * k, h], [cx, cy + h * k], [w * k, h], [0, h - h * k], [cx - w * k, cy], [0, h * k]]), preenche: true }];
    }
    case "donut": {
      const d = (ss * a("adj", 25000)) / 100000;
      return [{ d: elipse(w / 2, h / 2, w / 2, h / 2) + elipse(w / 2, h / 2, Math.max(0.1, w / 2 - d), Math.max(0.1, h / 2 - d)), preenche: true, evenodd: true }];
    }
    case "noSmoking": {
      const d = (ss * a("adj", 18750)) / 100000;
      return [{ d: elipse(w / 2, h / 2, w / 2, h / 2) + elipse(w / 2, h / 2, Math.max(0.1, w / 2 - d), Math.max(0.1, h / 2 - d)), preenche: true, evenodd: true }];
    }
    case "frame": {
      const x = (ss * a("adj1", 12500)) / 100000;
      return [{ d: `M0 0H${f(w)}V${f(h)}H0Z` + `M${f(x)} ${f(x)}V${f(h - x)}H${f(w - x)}V${f(x)}Z`, preenche: true, evenodd: true }];
    }
    case "teardrop":
      return [{ d: `M${f(w / 2)} ${f(h)}A${f(w / 2)} ${f(h / 2)} 0 1 1 ${f(w)} ${f(h / 2)}L${f(w)} 0L${f(w / 2)} 0A${f(w / 2)} ${f(h / 2)} 0 0 0 0 ${f(h / 2)}A${f(w / 2)} ${f(h / 2)} 0 0 0 ${f(w / 2)} ${f(h)}Z`, preenche: true }];
    case "can": {
      const ry = (h * a("adj", 25000)) / 200000;
      return [
        { d: `M0 ${f(ry)}A${f(w / 2)} ${f(ry)} 0 0 1 ${f(w)} ${f(ry)}V${f(h - ry)}A${f(w / 2)} ${f(ry)} 0 0 1 0 ${f(h - ry)}Z`, preenche: true },
        { d: `M0 ${f(ry)}A${f(w / 2)} ${f(ry)} 0 0 0 ${f(w)} ${f(ry)}`, preenche: false },
      ];
    }
    case "line":
    case "straightConnector1":
      return [{ d: `M0 0L${f(w)} ${f(h)}`, preenche: false }];
    case "bentConnector2":
      return [{ d: `M0 0H${f(w)}V${f(h)}`, preenche: false }];
    case "bentConnector3": {
      const x = (w * a("adj1", 50000)) / 100000;
      return [{ d: `M0 0H${f(x)}V${f(h)}H${f(w)}`, preenche: false }];
    }
    case "curvedConnector3": {
      const x = (w * a("adj1", 50000)) / 100000;
      return [{ d: `M0 0C${f(x)} 0 ${f(x)} ${f(h / 2)} ${f(x)} ${f(h / 2)}S${f(x)} ${f(h)} ${f(w)} ${f(h)}`, preenche: false }];
    }
    case "wedgeRectCallout":
    case "wedgeRoundRectCallout": {
      const r = prst === "wedgeRoundRectCallout" ? (ss * a("adj3", 16667)) / 100000 : 0;
      return [{ d: retanguloArredondado(w, h, r), preenche: true }];
    }
    case "heart":
      return [{ d: `M${f(w / 2)} ${f(h)}C${f(-w * 0.15)} ${f(h * 0.4)} ${f(w * 0.2)} ${f(-h * 0.15)} ${f(w / 2)} ${f(h * 0.3)}C${f(w * 0.8)} ${f(-h * 0.15)} ${f(w * 1.15)} ${f(h * 0.4)} ${f(w / 2)} ${f(h)}Z`, preenche: true }];
    default:
      return [{ d: `M0 0H${f(w)}V${f(h)}H0Z`, preenche: true }];
  }
}

/** Geometria livre -> traçados em pt (escala do caminho para o tamanho real da forma). */
export function tracadoLivre(paths: CustPath[], w: number, h: number): Traçado[] {
  return paths.map((p) => {
    const sx = p.w ? w / p.w : 1;
    const sy = p.h ? h / p.h : 1;
    let d = "";
    let cx = 0;
    let cy = 0;
    let ix = 0;
    let iy = 0;
    const c = p.cmds;
    for (let i = 0; i < c.length; ) {
      const cmd = c[i++] as string;
      if (cmd === "M") {
        cx = (c[i++] as number) * sx;
        cy = (c[i++] as number) * sy;
        ix = cx;
        iy = cy;
        d += `M${f(cx)} ${f(cy)}`;
      } else if (cmd === "L") {
        cx = (c[i++] as number) * sx;
        cy = (c[i++] as number) * sy;
        d += `L${f(cx)} ${f(cy)}`;
      } else if (cmd === "C") {
        const v = [0, 1, 2, 3, 4, 5].map((k) => (c[i + k] as number) * (k % 2 === 0 ? sx : sy));
        i += 6;
        d += `C${v.map(f).join(" ")}`;
        cx = v[4];
        cy = v[5];
      } else if (cmd === "Q") {
        const v = [0, 1, 2, 3].map((k) => (c[i + k] as number) * (k % 2 === 0 ? sx : sy));
        i += 4;
        d += `Q${v.map(f).join(" ")}`;
        cx = v[2];
        cy = v[3];
      } else if (cmd === "A") {
        const wR = (c[i++] as number) * sx;
        const hR = (c[i++] as number) * sy;
        const st = ((c[i++] as number) * Math.PI) / 180;
        const sw = ((c[i++] as number) * Math.PI) / 180;
        // ângulos do OOXML são "visuais": converte para o parâmetro da elipse
        const par = (ang: number) => Math.atan2(wR * Math.sin(ang), hR * Math.cos(ang));
        let t1 = par(st);
        let t2 = par(st + sw);
        if (sw > 0) while (t2 < t1) t2 += 2 * Math.PI;
        else while (t2 > t1) t2 -= 2 * Math.PI;
        const centroX = cx - wR * Math.cos(t1);
        const centroY = cy - hR * Math.sin(t1);
        const fx = centroX + wR * Math.cos(t2);
        const fy = centroY + hR * Math.sin(t2);
        const grande = Math.abs(sw) > Math.PI ? 1 : 0;
        d += `A${f(wR)} ${f(hR)} 0 ${grande} ${sw > 0 ? 1 : 0} ${f(fx)} ${f(fy)}`;
        cx = fx;
        cy = fy;
        t1 = t2;
      } else if (cmd === "Z") {
        d += "Z";
        cx = ix;
        cy = iy;
      } else {
        break;
      }
    }
    return { d, preenche: p.fill !== "none", traco: p.stroke !== false };
  });
}
