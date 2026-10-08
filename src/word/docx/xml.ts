// Utilidades para ler o XML do Word (w:p, w:r, w:val…).

export type El = Element;

// ---------- utilidades de XML ----------

export const kids = (el: El | null | undefined, name?: string): El[] =>
  el ? (Array.from(el.childNodes).filter((n) => n.nodeType === 1 && (!name || (n as El).nodeName === name)) as El[]) : [];
export const first = (el: El | null | undefined, name: string): El | null => kids(el, name)[0] ?? null;
export const attr = (el: El | null | undefined, name: string): string | null => (el ? el.getAttribute(name) : null);
export const val = (el: El | null | undefined): string | null => attr(el, "w:val");
/** Marcação do Word: presente e não explicitamente desligada. */
export const on = (el: El | null | undefined): boolean => !!el && !["0", "false", "off", "none"].includes((val(el) ?? "").toLowerCase());
export const twipsToPt = (v: string | null): number | null => (v == null || v === "" || isNaN(+v) ? null : Math.round((+v / 20) * 10) / 10);

export function parseXml(text: string): Document {
  return new DOMParser().parseFromString(text, "application/xml");
}

export const HIGHLIGHT: Record<string, string> = {
  yellow: "#ffff00",
  green: "#00ff00",
  cyan: "#00ffff",
  magenta: "#ff00ff",
  blue: "#0000ff",
  red: "#ff0000",
  darkBlue: "#000080",
  darkCyan: "#008080",
  darkGreen: "#008000",
  darkMagenta: "#800080",
  darkRed: "#800000",
  darkYellow: "#808000",
  darkGray: "#808080",
  lightGray: "#c0c0c0",
  black: "#000000",
};
