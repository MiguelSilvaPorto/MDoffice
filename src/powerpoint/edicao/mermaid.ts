// Fluxo do Mermaid (PowerPoint): um `flowchart` colado pela pessoa vira FORMAS NATIVAS na lâmina —
// cartões (retângulos arredondados) ligados por conectores de CANTOS SUAVES: a geometria é livre
// (custGeom) com curvas de 90°, no lugar dos cantos retos do conector comum.
//
// O que entra: `flowchart`/`graph` com direção (TD/TB/BT/LR/RL), nós `A[Texto]`, `A(Texto)`,
// `A((Texto))`, `A{Texto}` e arestas `-->`, `---`, `-.->`, `==>`, com rótulo `-->|texto|` ou
// `-- texto -->`. Linhas de subgraph/style/class/click são ignoradas.
//
// O que sai: um Shape por cartão (com o texto) e um Shape por aresta (path + seta). Tudo nativo:
// o .pptx guarda os cartões como formas do PowerPoint e os conectores como forma livre — igual ao
// que o próprio PowerPoint produz ao converter um desenho em forma.

import { uid } from "../../util";
import type { CustPath, Line, Para, Shape, ShapeBox } from "../schema";
import type { Dim } from "./geometria";
import { ajustarCor, solido } from "./formato";
import { corDeContraste, type EstiloDeck } from "./criar";

export type FormaNo = "ret" | "redondo" | "circulo";

export interface NoFluxo {
  id: string;
  texto: string;
  forma: FormaNo;
}

export interface ArestaFluxo {
  de: string;
  para: string;
  rotulo: string;
  tracejada: boolean;
  grossa: boolean;
  semSeta: boolean;
}

export interface FluxoMermaid {
  direcao: "TD" | "BT" | "LR" | "RL";
  nos: NoFluxo[];
  arestas: ArestaFluxo[];
}

// ---------------------------------------------------------------------------
// leitura do código
// ---------------------------------------------------------------------------

/** Converte `-- texto -->` / `-. texto .->` / `== texto ==>` para a forma com `|texto|`. */
function normalizarRotulos(linha: string): string {
  return linha
    .replace(/--\s+([^|<>]+?)\s+-->/g, "-->|$1|")
    .replace(/-\.\s+([^|<>]+?)\s+\.->/g, "-.->|$1|")
    .replace(/==\s+([^|<>]+?)\s+==>/g, "==>|$1|");
}

/** Lê o `flowchart` e devolve os nós e as arestas (o layout fica para `fluxoParaFormas`). */
export function lerFluxoMermaid(codigo: string): FluxoMermaid {
  const nos = new Map<string, NoFluxo>();
  const arestas: ArestaFluxo[] = [];
  let direcao: FluxoMermaid["direcao"] = "TD";

  const no = (id: string): NoFluxo => {
    const k = id.trim();
    let n = nos.get(k);
    if (!n) {
      n = { id: k, texto: k, forma: "ret" };
      nos.set(k, n);
    }
    return n;
  };

  // sem comentários (`%%`), uma instrução por linha (ou por `;`)
  const linhas = codigo.replace(/%%.*$/gm, "").split(/\n|;/g);
  for (const bruta of linhas) {
    let linha = bruta.trim();
    if (!linha) continue;

    const cabecalho = /^(?:flowchart|graph)\s+(TD|TB|BT|LR|RL)?/i.exec(linha);
    if (cabecalho) {
      const d = (cabecalho[1] ?? "TD").toUpperCase();
      direcao = (d === "TB" ? "TD" : d) as FluxoMermaid["direcao"];
      linha = linha.slice(cabecalho[0].length).trim();
      if (!linha) continue;
    }
    if (/^(subgraph|end|style|classDef|class|linkStyle|click|direction)\b/i.test(linha)) continue;

    const norm = normalizarRotulos(linha);
    let i = 0;
    const pular = () => {
      const m = /^\s*/.exec(norm.slice(i));
      i += m ? m[0].length : 0;
    };
    const lerNo = (): NoFluxo | null => {
      pular();
      const m = /^([\p{L}\p{N}_][\p{L}\p{N}_.:-]*)/u.exec(norm.slice(i));
      if (!m) return null;
      i += m[0].length;
      const n = no(m[1]);
      const abre = /^(\[\[|\[|\(\(|\(|\{\{|\{)/.exec(norm.slice(i));
      if (abre) {
        const a = abre[1];
        const fecha = a === "[[" ? "]]" : a === "((" ? "))" : a === "{{" ? "}}" : a === "[" ? "]" : a === "(" ? ")" : "}";
        const j = norm.indexOf(fecha, i + a.length);
        if (j >= 0) {
          const texto = norm.slice(i + a.length, j).trim().replace(/^["']|["']$/g, "");
          if (texto) n.texto = texto;
          n.forma = a.startsWith("((") ? "circulo" : a.startsWith("(") ? "redondo" : "ret";
          i = j + fecha.length;
        }
      }
      return n;
    };
    const lerSeta = (): Omit<ArestaFluxo, "de" | "para"> | null => {
      pular();
      const m = /^(-\.-+>|={2,}>|-{2,}>|-{2,}|={2,})/.exec(norm.slice(i));
      if (!m) return null;
      const token = m[0];
      i += token.length;
      const r = { rotulo: "", tracejada: token.startsWith("-."), grossa: token.startsWith("="), semSeta: !token.endsWith(">") };
      if (norm[i] === "|") {
        const j = norm.indexOf("|", i + 1);
        if (j >= 0) {
          r.rotulo = norm.slice(i + 1, j).trim();
          i = j + 1;
        }
      }
      return r;
    };

    let atual = lerNo();
    if (!atual) continue;
    for (let passo = 0; passo < 100; passo++) {
      const antes = i;
      const seta = lerSeta();
      if (!seta) break;
      const destino = lerNo();
      if (!destino || i === antes) break;
      arestas.push({ de: atual.id, para: destino.id, ...seta });
      atual = destino;
    }
  }

  return { direcao, nos: [...nos.values()], arestas };
}

// ---------------------------------------------------------------------------
// layout + formas
// ---------------------------------------------------------------------------

/** Medidas do fluxo, em pt (o tamanho do cartão manda no resto). */
export interface MedidasFluxo {
  larguraNo: number;
  alturaNo: number;
  /** espaço horizontal entre cartões do mesmo nível */
  gapX: number;
  /** espaço vertical entre níveis */
  gapY: number;
  /** raio das curvas dos conectores */
  raio: number;
}

export const MEDIDAS_PADRAO: MedidasFluxo = { larguraNo: 118, alturaNo: 46, gapX: 34, gapY: 56, raio: 9 };

const r2 = (v: number) => Math.round(v * 100) / 100;

/** Nível (camada) de cada nó: maior caminho a partir das raízes, sem entrar em ciclos. */
export function niveisDoFluxo(fluxo: FluxoMermaid): Map<string, number> {
  const saidas = new Map<string, string[]>();
  const entradas = new Map<string, number>();
  for (const n of fluxo.nos) {
    saidas.set(n.id, []);
    entradas.set(n.id, 0);
  }
  for (const a of fluxo.arestas) {
    if (!saidas.has(a.de) || !saidas.has(a.para)) continue;
    saidas.get(a.de)!.push(a.para);
    entradas.set(a.para, (entradas.get(a.para) ?? 0) + 1);
  }
  const nivel = new Map<string, number>();
  const naPilha = new Set<string>();
  let guarda = 0;
  const visita = (id: string, n: number) => {
    if (guarda++ > 5000) return;
    const atual = nivel.get(id);
    if (atual !== undefined && atual >= n) return;
    if (naPilha.has(id)) return; // ciclo: não segue
    nivel.set(id, n);
    naPilha.add(id);
    for (const f of saidas.get(id) ?? []) visita(f, n + 1);
    naPilha.delete(id);
  };
  const raizes = fluxo.nos.filter((x) => (entradas.get(x.id) ?? 0) === 0).map((x) => x.id);
  for (const id of raizes.length ? raizes : fluxo.nos.map((x) => x.id)) visita(id, 0);
  for (const n of fluxo.nos) if (!nivel.has(n.id)) nivel.set(n.id, 0);
  return nivel;
}

/** Caminho do conector: sai do meio de um lado e chega no meio do outro, com cantos em curva. */
function caminhoSuave(x0: number, y0: number, x1: number, y1: number, direcao: "vertical" | "horizontal", raio: number): (string | number)[] {
  const cmds: (string | number)[] = ["M", x0, y0];
  if (direcao === "vertical") {
    const meio = (y0 + y1) / 2;
    if (Math.abs(x1 - x0) < 0.5) {
      cmds.push("L", x0, y1);
      return cmds;
    }
    const dir = x1 > x0 ? 1 : -1;
    const r = Math.max(1, Math.min(raio, Math.abs(x1 - x0) / 2, Math.abs(meio - y0), Math.abs(y1 - meio)));
    cmds.push("L", x0, meio - r);
    cmds.push("Q", x0, meio, x0 + dir * r, meio);
    cmds.push("L", x1 - dir * r, meio);
    cmds.push("Q", x1, meio, x1, meio + r);
    cmds.push("L", x1, y1);
    return cmds;
  }
  const meio = (x0 + x1) / 2;
  if (Math.abs(y1 - y0) < 0.5) {
    cmds.push("L", x1, y0);
    return cmds;
  }
  const dir = y1 > y0 ? 1 : -1;
  const r = Math.max(1, Math.min(raio, Math.abs(y1 - y0) / 2, Math.abs(meio - x0), Math.abs(x1 - meio)));
  cmds.push("L", meio - r, y0);
  cmds.push("Q", meio, y0, meio, y0 + dir * r);
  cmds.push("L", meio, y1 - dir * r);
  cmds.push("Q", meio, y1, meio + r, y1);
  cmds.push("L", x1, y1);
  return cmds;
}

function paraComTexto(texto: string, estilo: EstiloDeck, tam: number, cor: string): Para[] {
  return [
    {
      runs: [{ text: texto, size: tam, bold: false, italic: false, underline: false, strike: false, color: cor, font: estilo.fonte }],
      align: "centro",
      lvl: 0,
      marL: 0,
      indent: 0,
      spcBef: 0,
      spcAft: 0,
      endSize: tam,
    },
  ];
}

const caixaDe = (x0: number, y0: number, x1: number, y1: number, d: Dim): ShapeBox => {
  const w = ((x1 - x0) / d.w) * 100;
  const h = ((y1 - y0) / d.h) * 100;
  return { x: (x0 / d.w) * 100, y: (y0 / d.h) * 100, w, h };
};

/**
 * Converte o fluxo em formas prontas: conectores primeiro (ficam atrás) e os cartões por cima,
 * tudo centrado na lâmina. Em `TD`, cartões de cima para baixo; em `LR`, da esquerda para a direita.
 */
export function fluxoParaFormas(fluxo: FluxoMermaid, dim: Dim, estilo: EstiloDeck, medidas: MedidasFluxo = MEDIDAS_PADRAO): Shape[] {
  if (!fluxo.nos.length) return [];
  const nivel = niveisDoFluxo(fluxo);

  // ordem dentro de cada nível: pela média dos pais (2 passadas), para as linhas não cruzarem à toa
  const porNivel = new Map<number, string[]>();
  for (const n of fluxo.nos) {
    const v = nivel.get(n.id) ?? 0;
    (porNivel.get(v) ?? porNivel.set(v, []).get(v)!).push(n.id);
  }
  const pais = new Map<string, string[]>();
  for (const a of fluxo.arestas) (pais.get(a.para) ?? pais.set(a.para, []).get(a.para)!).push(a.de);
  const pos = new Map<string, number>();
  const niveis = [...porNivel.keys()].sort((a, b) => a - b);
  for (const v of niveis) porNivel.get(v)!.forEach((id, i) => pos.set(id, i));
  for (let passo = 0; passo < 2; passo++) {
    for (const v of niveis) {
      const lista = porNivel.get(v)!;
      const media = (id: string) => {
        const ps = (pais.get(id) ?? []).map((p) => pos.get(p)).filter((x): x is number => x !== undefined);
        return ps.length ? ps.reduce((a, b) => a + b, 0) / ps.length : (pos.get(id) ?? 0);
      };
      lista.sort((a, b) => media(a) - media(b));
      lista.forEach((id, i) => pos.set(id, i));
    }
  }

  // posições em pt (TD: nível = linha; LR: nível = coluna)
  const vertical = fluxo.direcao === "TD" || fluxo.direcao === "BT";
  const { larguraNo, alturaNo, gapX, gapY, raio } = medidas;
  const L = vertical ? larguraNo : alturaNo; // medida ao longo do nível
  const centro = new Map<string, { x: number; y: number }>();
  for (const v of niveis) {
    const lista = porNivel.get(v)!;
    const larguraTotal = lista.length * L + (lista.length - 1) * gapX;
    lista.forEach((id, i) => {
      const aoLongo = -larguraTotal / 2 + i * (L + gapX) + L / 2;
      const atraves = v * (vertical ? alturaNo + gapY : larguraNo + gapY) + (vertical ? alturaNo / 2 : larguraNo / 2);
      centro.set(id, vertical ? { x: aoLongo, y: atraves } : { x: atraves, y: aoLongo });
    });
  }
  // BT/RL invertem o eixo do "fluxo"
  if (fluxo.direcao === "BT" || fluxo.direcao === "RL") {
    let maior = 0;
    for (const c of centro.values()) maior = Math.max(maior, vertical ? c.y : c.x);
    for (const c of centro.values()) {
      if (vertical) c.y = maior - c.y;
      else c.x = maior - c.x;
    }
  }

  // caixa geral (para centrar na lâmina) — o cartão é sempre larguraNo × alturaNo na tela
  const meiaCardX = larguraNo / 2;
  const meiaCardY = alturaNo / 2;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const c of centro.values()) {
    minX = Math.min(minX, c.x - meiaCardX);
    maxX = Math.max(maxX, c.x + meiaCardX);
    minY = Math.min(minY, c.y - meiaCardY);
    maxY = Math.max(maxY, c.y + meiaCardY);
  }
  const dx = dim.w / 2 - (minX + maxX) / 2;
  const dy = dim.h / 2 - (minY + maxY) / 2;
  const emPt = (c: { x: number; y: number }) => ({ x: c.x + dx, y: c.y + dy });

  const formas: Shape[] = [];
  const corLinha = ajustarCor(estilo.acento, 0.9);
  // meio "vão" no sentido do fluxo (de onde a linha sai e onde ela chega)
  const meiaFluxo = (vertical ? alturaNo : larguraNo) / 2;

  // conectores primeiro: os cartões ficam por cima das linhas
  for (const a of fluxo.arestas) {
    const de = centro.get(a.de);
    const para = centro.get(a.para);
    if (!de || !para) continue;
    const A = emPt(de);
    const B = emPt(para);
    const folga = 3; // a ponta da seta encosta na borda do cartão
    let x0: number;
    let y0: number;
    let x1: number;
    let y1: number;
    if (vertical) {
      const desce = B.y >= A.y;
      x0 = A.x;
      y0 = A.y + (desce ? meiaFluxo : -meiaFluxo);
      x1 = B.x;
      y1 = B.y + (desce ? -meiaFluxo - folga : meiaFluxo + folga);
    } else {
      const direita = B.x >= A.x;
      x0 = A.x + (direita ? meiaFluxo : -meiaFluxo);
      y0 = A.y;
      x1 = B.x + (direita ? -meiaFluxo - folga : meiaFluxo + folga);
      y1 = B.y;
    }
    const cmds = caminhoSuave(x0, y0, x1, y1, vertical ? "vertical" : "horizontal", raio);
    // caixa do conector = retângulo do caminho + folga do traço
    const pad = 4;
    const cx0 = Math.min(x0, x1) - pad;
    const cy0 = Math.min(y0, y1) - pad;
    const cx1 = Math.max(x0, x1) + pad;
    const cy1 = Math.max(y0, y1) + pad;
    const largura = Math.max(cx1 - cx0, 0.01);
    const altura = Math.max(cy1 - cy0, 0.01);
    const locais: (string | number)[] = [];
    for (let i = 0; i < cmds.length; ) {
      const c = cmds[i++] as string;
      locais.push(c);
      const quantos = c === "M" || c === "L" ? 2 : c === "Q" ? 4 : c === "C" ? 6 : 0;
      for (let k = 0; k < quantos; k += 2) {
        locais.push(r2((cmds[i + k] as number) - cx0), r2((cmds[i + k + 1] as number) - cy0));
      }
      i += quantos;
    }
    const paths: CustPath[] = [{ w: largura, h: altura, cmds: locais }];
    const ln: Line = {
      color: corLinha,
      alpha: 1,
      w: a.grossa ? 2.75 : 1.75,
      dash: a.tracejada ? "dash" : "solid",
      join: "round",
      cap: "round",
      ...(a.semSeta ? {} : { tail: "triangle" }),
    };
    formas.push({
      id: uid(),
      kind: "forma",
      geom: "custom",
      name: a.rotulo ? `Fluxo: ${a.de} → ${a.para} (${a.rotulo})` : `Fluxo: ${a.de} → ${a.para}`,
      box: caixaDe(cx0, cy0, cx1, cy1, dim),
      text: "",
      fontFamily: estilo.fonte,
      fontSize: 14,
      color: corLinha,
      bold: false,
      italic: false,
      align: "centro",
      fill: "",
      src: "",
      rot: 0,
      fillX: { kind: "none" },
      ln,
      paths,
    });
  }

  // cartões por cima
  const fundo = ajustarCor(estilo.acento, 1.85);
  const corNoTexto = corDeContraste(fundo);
  for (const n of fluxo.nos) {
    const c = centro.get(n.id);
    if (!c) continue;
    const p = emPt(c);
    const forma: Shape = {
      id: uid(),
      kind: "forma",
      geom: n.forma === "circulo" ? "ellipse" : "roundRect",
      name: `Fluxo: ${n.texto.slice(0, 60)}`,
      box: caixaDe(p.x - meiaCardX, p.y - meiaCardY, p.x + meiaCardX, p.y + meiaCardY, dim),
      text: n.texto,
      fontFamily: estilo.fonte,
      fontSize: 14,
      color: corNoTexto,
      bold: false,
      italic: false,
      align: "centro",
      fill: fundo,
      src: "",
      rot: 0,
      fillX: solido(fundo),
      ln: { color: estilo.acento, alpha: 1, w: 1.25, dash: "solid" },
      paras: paraComTexto(n.texto, estilo, 14, corNoTexto),
      anchor: "ctr",
      ins: [6, 3.6, 6, 3.6],
    };
    if (n.forma === "redondo") {
      forma.geom = "roundRect";
      forma.adj = { adj: 50000 };
    }
    formas.push(forma);
  }

  return formas;
}
