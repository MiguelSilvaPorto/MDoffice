// Cores do OOXML: esquema do tema (dk1, accent1...), mapa do mestre (bg1 -> lt1) e as transformações
// (lumMod, lumOff, tint, shade, alpha...). Tudo vira "RRGGBB" + opacidade.
import { caminho, filho, filhos, num, type No } from "./xmltree";

export interface CorResolvida {
  /** RRGGBB maiúsculo */
  hex: string;
  /** opacidade 0-1 */
  alpha: number;
}

export interface Tema {
  /** dk1, lt1, dk2, lt2, accent1..6, hlink, folHlink -> RRGGBB */
  cores: Record<string, string>;
  /** fonte de títulos (+mj-lt) e de texto (+mn-lt) */
  fonteMaior: string;
  fonteMenor: string;
  /** estilos de preenchimento, contorno, efeito e fundo do tema (para as referências de <p:style> e bgRef) */
  preenchimentos: No[];
  contornos: No[];
  efeitos: No[];
  fundos: No[];
}

export interface ContextoCor {
  tema: Tema;
  /** bg1 -> lt1, tx1 -> dk1 ... (do clrMap do mestre/layout) */
  mapa: Record<string, string>;
  /** cor que substitui "phClr" dentro dos estilos do tema */
  phClr?: CorResolvida;
}

export const MAPA_PADRAO: Record<string, string> = {
  bg1: "lt1",
  tx1: "dk1",
  bg2: "lt2",
  tx2: "dk2",
  accent1: "accent1",
  accent2: "accent2",
  accent3: "accent3",
  accent4: "accent4",
  accent5: "accent5",
  accent6: "accent6",
  hlink: "hlink",
  folHlink: "folHlink",
};

const NOMES: Record<string, string> = {
  black: "000000",
  white: "FFFFFF",
  red: "FF0000",
  green: "008000",
  blue: "0000FF",
  yellow: "FFFF00",
  gray: "808080",
  grey: "808080",
  silver: "C0C0C0",
  orange: "FFA500",
  purple: "800080",
  cyan: "00FFFF",
  magenta: "FF00FF",
  lime: "00FF00",
  navy: "000080",
  teal: "008080",
  maroon: "800000",
  olive: "808000",
  brown: "A52A2A",
  pink: "FFC0CB",
  dkGray: "A9A9A9",
  ltGray: "D3D3D3",
  dkBlue: "00008B",
  dkGreen: "006400",
  dkRed: "8B0000",
  ltBlue: "ADD8E6",
  ltGreen: "90EE90",
};

export function lerTema(raiz: No | undefined): Tema {
  const el = caminho(raiz, "themeElements");
  const esquema = filho(el, "clrScheme");
  const cores: Record<string, string> = {};
  for (const c of esquema?.c ?? []) {
    const f = c.c[0];
    if (!f) continue;
    cores[c.n] = f.n === "sysClr" ? (f.a.lastClr ?? "000000") : f.n === "srgbClr" ? f.a.val : (NOMES[f.a.val] ?? "000000");
  }
  const fontes = filho(el, "fontScheme");
  const fmt = filho(el, "fmtScheme");
  return {
    cores,
    fonteMaior: caminho(fontes, "majorFont/latin")?.a.typeface ?? "Calibri Light",
    fonteMenor: caminho(fontes, "minorFont/latin")?.a.typeface ?? "Calibri",
    preenchimentos: filhos(filho(fmt, "fillStyleLst")),
    contornos: filhos(filho(fmt, "lnStyleLst")),
    efeitos: filhos(filho(fmt, "effectStyleLst")),
    fundos: filhos(filho(fmt, "bgFillStyleLst")),
  };
}

// ---- conversões de cor ----

function hexParaRgb(hex: string): [number, number, number] {
  const h = hex.length === 3 ? hex.split("").map((c) => c + c).join("") : hex.padEnd(6, "0");
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

function rgbParaHex(r: number, g: number, b: number): string {
  const p = (x: number) => Math.max(0, Math.min(255, Math.round(x))).toString(16).padStart(2, "0");
  return (p(r) + p(g) + p(b)).toUpperCase();
}

function rgbParaHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h / 6, s, l];
}

function hslParaRgb(h: number, s: number, l: number): [number, number, number] {
  if (s === 0) return [l * 255, l * 255, l * 255];
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const f = (t: number) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  return [f(h + 1 / 3) * 255, f(h) * 255, f(h - 1 / 3) * 255];
}

/** Resolve um elemento de cor (srgbClr, schemeClr, sysClr, prstClr, hslClr, scrgbClr) com as transformações dele. */
export function resolverCor(no: No | undefined, ctx: ContextoCor): CorResolvida | undefined {
  if (!no) return undefined;
  let hex: string;
  switch (no.n) {
    case "srgbClr":
      hex = (no.a.val ?? "000000").toUpperCase();
      break;
    case "sysClr":
      hex = (no.a.lastClr ?? (no.a.val === "window" ? "FFFFFF" : "000000")).toUpperCase();
      break;
    case "prstClr":
      hex = NOMES[no.a.val] ?? "000000";
      break;
    case "scrgbClr":
      hex = rgbParaHex((num(no, "r") / 100000) * 255, (num(no, "g") / 100000) * 255, (num(no, "b") / 100000) * 255);
      break;
    case "hslClr": {
      const [r, g, b] = hslParaRgb(num(no, "hue") / 21600000, num(no, "sat") / 100000, num(no, "lum") / 100000);
      hex = rgbParaHex(r, g, b);
      break;
    }
    case "schemeClr": {
      const v = no.a.val ?? "tx1";
      if (v === "phClr") {
        if (!ctx.phClr) return undefined;
        hex = ctx.phClr.hex;
        break;
      }
      const chave = ctx.mapa[v] ?? v;
      hex = (ctx.tema.cores[chave] ?? ctx.tema.cores[v] ?? "000000").toUpperCase();
      break;
    }
    default:
      return undefined;
  }
  let alpha = no.n === "schemeClr" && no.a.val === "phClr" && ctx.phClr ? ctx.phClr.alpha : 1;
  let [r, g, b] = hexParaRgb(hex);
  for (const t of no.c) {
    const v = num(t, "val") / 100000;
    switch (t.n) {
      case "alpha":
        alpha = v;
        break;
      case "alphaMod":
        alpha *= v;
        break;
      case "alphaOff":
        alpha += v;
        break;
      case "lumMod":
      case "lumOff":
      case "lum":
      case "satMod":
      case "satOff":
      case "sat":
      case "hueMod":
      case "hueOff":
      case "hue": {
        let [h, s, l] = rgbParaHsl(r, g, b);
        if (t.n === "lumMod") l *= v;
        else if (t.n === "lumOff") l += v;
        else if (t.n === "lum") l = v;
        else if (t.n === "satMod") s *= v;
        else if (t.n === "satOff") s += v;
        else if (t.n === "sat") s = v;
        else if (t.n === "hueMod") h *= v;
        else if (t.n === "hueOff") h += num(t, "val") / 21600000;
        else h = num(t, "val") / 21600000;
        h = ((h % 1) + 1) % 1;
        [r, g, b] = hslParaRgb(h, Math.max(0, Math.min(1, s)), Math.max(0, Math.min(1, l)));
        break;
      }
      case "tint":
        r = r + (255 - r) * (1 - v);
        g = g + (255 - g) * (1 - v);
        b = b + (255 - b) * (1 - v);
        break;
      case "shade":
        r *= v;
        g *= v;
        b *= v;
        break;
      case "comp": {
        const [h, s, l] = rgbParaHsl(r, g, b);
        [r, g, b] = hslParaRgb((h + 0.5) % 1, s, l);
        break;
      }
      case "inv":
        r = 255 - r;
        g = 255 - g;
        b = 255 - b;
        break;
      case "gray": {
        const y = 0.299 * r + 0.587 * g + 0.114 * b;
        r = g = b = y;
        break;
      }
    }
  }
  return { hex: rgbParaHex(r, g, b), alpha: Math.max(0, Math.min(1, alpha)) };
}

/** Primeiro elemento de cor dentro de um nó (solidFill, gs, ln...). */
export function corDentro(no: No | undefined, ctx: ContextoCor): CorResolvida | undefined {
  for (const c of no?.c ?? []) {
    const r = resolverCor(c, ctx);
    if (r) return r;
  }
  return undefined;
}
