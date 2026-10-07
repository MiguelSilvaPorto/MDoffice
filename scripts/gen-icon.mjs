// Gera app-icon.png (1024x1024) usado por `tauri icon` para criar todos os ícones.
// Feito sem dependências: desenha em um buffer RGBA e codifica um PNG na mão.
import { deflateSync } from "node:zlib";
import { writeFileSync } from "node:fs";

const S = 1024;
const SS = 2; // supersampling 2x2 para suavizar as bordas

// ---------- utilidades de desenho ----------

const distToSeg = (px, py, ax, ay, bx, by) => {
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy;
  let t = len2 === 0 ? 0 : ((px - ax) * dx + (py - ay) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
};

const inRoundRect = (x, y, cx, cy, w, h, r) => {
  const dx = Math.abs(x - cx) - (w / 2 - r);
  const dy = Math.abs(y - cy) - (h / 2 - r);
  const qx = Math.max(dx, 0);
  const qy = Math.max(dy, 0);
  return Math.hypot(qx, qy) + Math.min(Math.max(dx, dy), 0) - r <= 0;
};

const inTriangle = (px, py, a, b, c) => {
  const sign = (p1, p2, p3) => (p1[0] - p3[0]) * (p2[1] - p3[1]) - (p2[0] - p3[0]) * (p1[1] - p3[1]);
  const d1 = sign([px, py], a, b);
  const d2 = sign([px, py], b, c);
  const d3 = sign([px, py], c, a);
  const hasNeg = d1 < 0 || d2 < 0 || d3 < 0;
  const hasPos = d1 > 0 || d2 > 0 || d3 > 0;
  return !(hasNeg && hasPos);
};

const lerp = (a, b, t) => a + (b - a) * t;
const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];

const INDIGO = hex("#4f46e5");
const VIOLET = hex("#7c3aed");
const WHITE = [255, 255, 255];
const INK = hex("#3b2fb8");

// Segmentos do "M"
const M_POINTS = [
  [318, 690],
  [318, 400],
  [452, 566],
  [586, 400],
  [586, 690],
];
const M_THICK = 34;
// Seta para baixo
const ARROW_SHAFT = [752, 400, 752, 600];
const ARROW_SHAFT_THICK = 30;
const ARROW_HEAD = [
  [688, 566],
  [816, 566],
  [752, 706],
];

function sample(x, y) {
  // fundo: quadrado arredondado com gradiente diagonal
  if (inRoundRect(x, y, S / 2, S / 2, S, S, 210)) {
    const t = (x + y) / (2 * S);
    let col = [lerp(INDIGO[0], VIOLET[0], t), lerp(INDIGO[1], VIOLET[1], t), lerp(INDIGO[2], VIOLET[2], t)];
    // brilho suave no canto superior esquerdo
    const glow = Math.max(0, 1 - Math.hypot(x - 240, y - 200) / 620);
    col = col.map((v) => Math.min(255, v + glow * 44));

    // "página" branca
    if (inRoundRect(x, y, S / 2, S / 2, S - 300, S - 300, 104)) {
      let page = [...WHITE];
      const shadow = Math.max(0, 1 - distToSeg(x, y, 0, S / 2 + 118, S, S / 2 + 118) / 90);
      page = page.map((v) => v - shadow * 18);
      // "M"
      for (let i = 0; i < M_POINTS.length - 1; i++) {
        const [ax, ay] = M_POINTS[i];
        const [bx, by] = M_POINTS[i + 1];
        if (distToSeg(x, y, ax, ay, bx, by) <= M_THICK) return INK;
      }
      // seta (haste + ponta)
      if (distToSeg(x, y, ARROW_SHAFT[0], ARROW_SHAFT[1], ARROW_SHAFT[2], ARROW_SHAFT[3]) <= ARROW_SHAFT_THICK) return INK;
      if (inTriangle(x, y, ARROW_HEAD[0], ARROW_HEAD[1], ARROW_HEAD[2])) return INK;
      return page.map((v) => Math.max(0, Math.round(v)));
    }
    return col.map((v) => Math.round(v));
  }
  return null;
}

// ---------- rasterização ----------

const pixels = Buffer.alloc(S * S * 4);
for (let y = 0; y < S; y++) {
  for (let x = 0; x < S; x++) {
    let r = 0;
    let g = 0;
    let b = 0;
    let covered = 0;
    for (let sy = 0; sy < SS; sy++) {
      for (let sx = 0; sx < SS; sx++) {
        const col = sample(x + (sx + 0.5) / SS, y + (sy + 0.5) / SS);
        if (col) {
          r += col[0];
          g += col[1];
          b += col[2];
          covered++;
        }
      }
    }
    const i = (y * S + x) * 4;
    if (covered > 0) {
      pixels[i] = Math.round(r / covered);
      pixels[i + 1] = Math.round(g / covered);
      pixels[i + 2] = Math.round(b / covered);
      pixels[i + 3] = Math.round((covered / (SS * SS)) * 255);
    }
  }
}

// ---------- codificação PNG ----------

const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
})();

const crc32 = (buf) => {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};

const chunk = (type, data) => {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, "ascii");
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crcBuf]);
};

const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(S, 0);
ihdr.writeUInt32BE(S, 4);
ihdr[8] = 8; // bits por canal
ihdr[9] = 6; // RGBA
ihdr[10] = 0;
ihdr[11] = 0;
ihdr[12] = 0;

// linhas com filtro 0
const raw = Buffer.alloc(S * (S * 4 + 1));
for (let y = 0; y < S; y++) {
  raw[y * (S * 4 + 1)] = 0;
  pixels.copy(raw, y * (S * 4 + 1) + 1, y * S * 4, (y + 1) * S * 4);
}

const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  chunk("IHDR", ihdr),
  chunk("IDAT", deflateSync(raw, { level: 9 })),
  chunk("IEND", Buffer.alloc(0)),
]);

writeFileSync("app-icon.png", png);
console.log(`app-icon.png gerado (${S}x${S}, ${(png.length / 1024).toFixed(0)} kB)`);
