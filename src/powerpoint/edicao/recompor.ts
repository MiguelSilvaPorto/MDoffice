// Recompor a lâmina: em vez de fórmulas fixas de cartão, entende a ESTRUTURA da lâmina — título
// (com o antetítulo e o subtítulo que andam com ele), colunas de conteúdo, rodapé, painéis de fundo
// e ícones — e redesenha tudo com margens iguais, na ordem de leitura, escalando a letra até um piso
// por papel (título 16 pt, corpo 9 pt, etiqueta 6 pt). O que é diagrama (um grupo de formas sem texto
// que se encostam) anda como UM bloco, sem embaralhar as peças.
//
// Função pura: devolve lâmina nova. Só a lâmina que recebe muda — quem chama é a Arrumação do painel.
import type { Para, Shape, ShapeBox, Slide } from "../schema";
import { aplicarArranjo, variantesDe } from "./arranjos";

/** Piso de letra por papel (pt). */
const PISO_TITULO = 16;
const PISO_CORPO = 9;
const PISO_ETIQUETA = 6;

/** Margens e vãos em % da lâmina (o mesmo respiro do modelo do deck). */
const MARGEM_X = 4.5;
const MARGEM_TOPO = 4.5;
const MARGEM_BASE = 4;
const VAO_COLUNA = 2.6;
const VAO_BLOCO = 1.8;
/** O terço de cima é a faixa do título; abaixo de 76% é rodapé. */
const FAIXA_TITULO = 34;
const FAIXA_RODAPE = 76;
/** A partir disto a imagem é fundo/painel (e não conteúdo). */
const AREA_PAINEL = 12;
/** Um grupo de formas sem texto que se encostam é UM diagrama. */
const DIAGRAMA_MIN = 4;
const ENCOSTA = 2.5;

type Papel = "titulo" | "corpo" | "rodape" | "painel" | "diagrama";

interface Bloco {
  papel: Papel;
  /** formas que o bloco move/escala (textos, cartões, o diagrama) */
  ids: string[];
  /** a caixa que envolve o conteúdo do bloco */
  box: ShapeBox;
  /** maior letra do bloco (pt); 0 = sem texto */
  letra: number;
  /** ícones/linhas que andam junto (não contam para a caixa) */
  presos: string[];
}

const area = (b: ShapeBox): number => b.w * b.h;
const txt = (s: Shape): string => (s.paras ?? []).flatMap((p) => p.runs.map((r) => r.text ?? "")).join("").trim();
const temTexto = (s: Shape): boolean => !!txt(s);
const maiorLetra = (s: Shape): number => Math.max(s.fontSize || 0, ...(s.paras ?? []).flatMap((p) => p.runs.map((r) => r.size ?? 0)));
const ehImagem = (s: Shape): boolean => s.kind === "imagem" || !!s.src;

function caixaDe(boxes: ShapeBox[]): ShapeBox {
  const x = Math.min(...boxes.map((b) => b.x));
  const y = Math.min(...boxes.map((b) => b.y));
  const x2 = Math.max(...boxes.map((b) => b.x + b.w));
  const y2 = Math.max(...boxes.map((b) => b.y + b.h));
  return { x, y, w: Math.max(0.01, x2 - x), h: Math.max(0.01, y2 - y) };
}

const centro = (b: ShapeBox) => ({ x: b.x + b.w / 2, y: b.y + b.h / 2 });
const contem = (fora: ShapeBox, b: ShapeBox): boolean => {
  const c = centro(b);
  return c.x >= fora.x && c.x <= fora.x + fora.w && c.y >= fora.y && c.y <= fora.y + fora.h;
};
const encosta = (a: ShapeBox, b: ShapeBox, folga = ENCOSTA): boolean =>
  a.x - folga <= b.x + b.w && b.x - folga <= a.x + a.w && a.y - folga <= b.y + b.h && b.y - folga <= a.y + a.h;
const distancia = (a: ShapeBox, b: ShapeBox): number => {
  const ca = centro(a);
  const cb = centro(b);
  return Math.hypot(ca.x - cb.x, ca.y - cb.y);
};

/**
 * Os blocos da lâmina, na ordem de leitura (título, colunas da esquerda para a direita, rodapé).
 * Quem não é conteúdo (ícone, filete, seta) fica em `presos` do bloco mais próximo e anda com ele.
 */
export function blocosDa(slide: Slide): Bloco[] {
  const vivas = slide.shapes.filter((s) => !s.fixa && !s.liga && !s.oculta);
  const mapa = new Map(vivas.map((s) => [s.id, s]));
  const textos = vivas.filter((s) => temTexto(s) && s.kind !== "imagem" && !s.tabela && !s.grafico);
  const imagens = vivas.filter((s) => ehImagem(s) && !temTexto(s));
  const paineis = imagens.filter((s) => area(s.box) >= AREA_PAINEL);
  const soltas = vivas.filter((s) => !textos.includes(s) && !paineis.includes(s));
  const usados = new Set<string>();
  const blocos: Bloco[] = [];
  const criar = (papel: Papel, ids: string[]): Bloco => {
    const boxes = ids.map((id) => mapa.get(id)!.box);
    const letra = Math.max(0, ...ids.map((id) => maiorLetra(mapa.get(id)!)));
    ids.forEach((id) => usados.add(id));
    return { papel, ids: [...ids], box: caixaDe(boxes), letra, presos: [] };
  };
  const recalcular = (b: Bloco) => {
    b.box = caixaDe(b.ids.map((id) => mapa.get(id)!.box));
    b.letra = Math.max(0, ...b.ids.map((id) => maiorLetra(mapa.get(id)!)));
  };

  // ---- painéis de fundo: as imagens grandes viram o fundo da coluna mais próxima
  for (const p of paineis) blocos.push(criar("painel", [p.id]));

  // ---- título: o(s) texto(s) grande(s) da faixa de cima
  const daFaixa = textos.filter((t) => t.box.y + t.box.h / 2 < FAIXA_TITULO);
  const maiorDaFaixa = Math.max(0, ...daFaixa.map(maiorLetra));
  const tituloIds = daFaixa.filter((t) => maiorLetra(t) >= Math.max(14, maiorDaFaixa * 0.72)).map((t) => t.id);
  let titulo: Bloco | null = tituloIds.length ? criar("titulo", tituloIds) : null;
  if (titulo) {
    // antetítulo/subtítulo: textos na mesma faixa de largura, logo acima ou abaixo do título
    for (const t of textos) {
      if (usados.has(t.id)) continue;
      const perto = t.box.y + t.box.h > titulo.box.y - 4 && t.box.y < titulo.box.y + titulo.box.h + 4.5;
      const sobre = Math.min(t.box.x + t.box.w, titulo.box.x + titulo.box.w) - Math.max(t.box.x, titulo.box.x);
      if (perto && sobre > 0.5 * Math.min(t.box.w, titulo.box.w)) {
        titulo.ids.push(t.id);
        usados.add(t.id);
      }
    }
    recalcular(titulo);
    blocos.push(titulo);
  }

  // ---- rodapé: os textos da faixa de baixo
  const rodapeIds = textos.filter((t) => !usados.has(t.id) && t.box.y >= FAIXA_RODAPE).map((t) => t.id);
  if (rodapeIds.length) blocos.push(criar("rodape", rodapeIds));

  // ---- diagrama: formas sem texto que se encostam viram UM bloco. Quando ele ocupa a lâmina
  // (organograma, infográfico), leva junto os textos de dentro: o conjunto anda como um todo.
  const semTexto = soltas.filter((s) => !temTexto(s));
  const grande = agrupar(semTexto).find((g) => g.length >= DIAGRAMA_MIN && g.reduce((a, s) => a + area(s.box), 0) > 6);
  if (grande) {
    const caixa = caixaDe(grande.map((s) => s.box));
    const dentro = textos.filter((t) => !usados.has(t.id) && contem(caixa, t.box));
    if ((area(caixa) >= 25 || grande.length >= 8) && dentro.length) {
      for (const t of dentro) usados.add(t.id);
      blocos.push(criar("diagrama", [...grande.map((s) => s.id), ...dentro.map((t) => t.id)]));
    } else {
      blocos.push(criar("diagrama", grande.map((s) => s.id)));
    }
  }

  // ---- conteúdo: o resto, em COLUNAS (vãos verticais) e, dentro delas, em blocos (vãos horizontais)
  const corpo = textos.filter((t) => !usados.has(t.id));
  for (const col of colunasDe(corpo)) {
    const ordenadas = [...col].sort((a, b) => a.box.y - b.box.y);
    let atual: Shape[] = [];
    const fechar = () => {
      if (atual.length) blocos.push(criar("corpo", atual.map((s) => s.id)));
      atual = [];
    };
    for (const t of ordenadas) {
      const ultimo = atual[atual.length - 1];
      if (ultimo && t.box.y - (ultimo.box.y + ultimo.box.h) > 1.6) fechar();
      atual.push(t);
    }
    fechar();
  }
  // ---- ícones, filetes e sobras: presos ao bloco mais próximo (contido nele vale distância 0)
  for (const s of vivas) {
    if (usados.has(s.id)) continue;
    let melhor: Bloco | null = null;
    let d = Infinity;
    for (const b of blocos) {
      // a decoração segue o CONTEÚDO, não o painel de fundo (o painel escala para cobrir a coluna)
      if (b.papel === "painel") continue;
      const dd = contem(b.box, s.box) ? 0 : distancia(b.box, s.box);
      if (dd < d) {
        d = dd;
        melhor = b;
      }
    }
    if (melhor && d <= 9) {
      melhor.presos.push(s.id);
      usados.add(s.id);
    }
  }
  return blocos;
}

/** Colunas naturais: projeta as caixas no eixo X e corta nos vãos maiores que o vão de coluna. */
function colunasDe(formas: Shape[]): Shape[][] {
  if (!formas.length) return [];
  const ordenadas = [...formas].sort((a, b) => a.box.x - b.box.x || a.box.y - b.box.y);
  const colunas: Shape[][] = [];
  let atual: Shape[] = [ordenadas[0]];
  let fim = ordenadas[0].box.x + ordenadas[0].box.w;
  for (const s of ordenadas.slice(1)) {
    if (s.box.x <= fim + 1.2) {
      atual.push(s);
      fim = Math.max(fim, s.box.x + s.box.w);
    } else {
      colunas.push(atual);
      atual = [s];
      fim = s.box.x + s.box.w;
    }
  }
  colunas.push(atual);
  return colunas;
}

/** Agrupa as formas que se encostam (união por proximidade). */
function agrupar(formas: Shape[]): Shape[][] {
  const grupo: Shape[][] = [];
  const vistos = new Set<Shape>();
  for (const s of formas) {
    if (vistos.has(s)) continue;
    const fila = [s];
    const g: Shape[] = [];
    vistos.add(s);
    while (fila.length) {
      const atual = fila.pop()!;
      g.push(atual);
      for (const o of formas) {
        if (!vistos.has(o) && encosta(atual.box, o.box)) {
          vistos.add(o);
          fila.push(o);
        }
      }
    }
    if (g.length) grupo.push(g);
  }
  return grupo;
}

// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
// layout
// ---------------------------------------------------------------------------

type Modo = "natural" | "empilhado" | "duas";

/** Uma transformação de bloco: escala em volta do canto superior esquerdo + deslocamento, com o piso da letra. */
interface Transf {
  s: number;
  dx: number;
  dy: number;
  origem: ShapeBox;
  piso: number;
}

const caixaEm = (b: ShapeBox, t: Transf): ShapeBox => ({
  x: t.origem.x + (b.x - t.origem.x) * t.s + t.dx,
  y: t.origem.y + (b.y - t.origem.y) * t.s + t.dy,
  w: Math.max(0.01, b.w * t.s),
  h: Math.max(0.01, b.h * t.s),
});

const pisoDe = (b: Bloco): number => (b.papel === "titulo" ? PISO_TITULO : b.papel === "rodape" ? PISO_ETIQUETA : PISO_CORPO);

/** Aplica a transformação numa forma: caixa, letra de cada trecho (com piso) e espessura do traço. */
function transformar(f: Shape, t: Transf): Shape {
  if (t.s === 1 && t.dx === 0 && t.dy === 0) return f;
  const escalar = (v: number, piso: number): number => Math.max(piso, v * t.s);
  return {
    ...f,
    box: caixaEm(f.box, t),
    fontSize: escalar(f.fontSize, t.piso),
    paras: f.paras?.map((p: Para): Para => ({ ...p, runs: p.runs.map((r) => (r.text?.trim() ? { ...r, size: escalar(r.size, t.piso) } : r)) })),
    ln: f.ln ? { ...f.ln, w: Math.max(0.25, f.ln.w * t.s) } : f.ln,
  };
}

/**
 * Recompor = NORMALIZAR a lâmina (não reconstruir): o desenho é preservado e o que muda é a
 * posição — margens iguais, colunas alinhadas e com o mesmo vão, rodapé no lugar, painéis
 * emoldurando as colunas, e a letra só desce quando o texto não cabe (até o piso). Entre as
 * variantes (as colunas naturais, tudo numa coluna e duas colunas iguais), vence a de menos defeito.
 */
export function recompor(slide: Slide, ratio: number): Slide {
  const blocos = blocosDa(slide);
  const conteudo = blocos.filter((b) => b.papel === "corpo" || b.papel === "diagrama");
  if (!conteudo.length) return slide;
  let melhor: Slide = slide;
  let nota = -Infinity;
  const candidatos: Slide[] = [];
  for (const modo of ["natural", "duas", "empilhado"] as const) {
    const novo = layoutar(slide, blocos, modo);
    if (novo) candidatos.push(novo);
  }
  // a lâmina de cartões (fotos, cards) continua se entendendo com a grade: ela entra como candidata
  const cards = slide.shapes.filter((f) => !f.fixa && (f.kind === "imagem" || f.src) && f.box.w * f.box.h >= 3).length;
  if (cards >= 4) {
    for (const v of variantesDe("grade", cards).slice(0, 3)) candidatos.push(aplicarArranjo(slide, "grade", v, ratio));
    candidatos.push(aplicarArranjo(slide, "fluxo", 0, ratio));
  }
  // a rede de segurança: se nenhuma variante ficou melhor que a lâmina ORIGINAL, ela volta como está
  nota = avaliar(slide, slide, blocos);
  for (const c of candidatos) {
    const n = avaliar(slide, c, blocos);
    if (n > nota + 0.02) {
      nota = n;
      melhor = c;
    }
  }
  void ratio;
  return melhor;
}

/** Coloca os blocos na lâmina, alinhando e distribuindo. */
function layoutar(slide: Slide, blocos: Bloco[], modo: Modo): Slide | null {
  const transf = new Map<string, Transf>();
  const util = 100 - 2 * MARGEM_X;
  const anotar = (b: Bloco, x: number, y: number, s: number): Transf => {
    const t: Transf = { s, dx: x - b.box.x, dy: y - b.box.y, origem: b.box, piso: pisoDe(b) };
    b.ids.forEach((id) => transf.set(id, t));
    b.presos.forEach((id) => transf.set(id, t));
    return t;
  };
  let topo = MARGEM_TOPO;

  // ---- título: alinhado à margem; só encolhe se passar da largura útil
  const titulo = blocos.find((b) => b.papel === "titulo");
  if (titulo) {
    // sem escalar: a caixa do texto não pode encolher com a letra no piso (o texto vazaria)
    anotar(titulo, MARGEM_X, topo, 1);
    topo += titulo.box.h + 2.6;
  }

  // ---- rodapé: alinhado embaixo, na margem
  let base = 100 - MARGEM_BASE;
  const rodape = blocos.find((b) => b.papel === "rodape");
  if (rodape) {
    base -= rodape.box.h;
    anotar(rodape, MARGEM_X, base, 1);
    base -= 2;
  }

  // ---- colunas do conteúdo, conforme o modo
  const corpo = blocos.filter((b) => b.papel === "corpo" || b.papel === "diagrama").sort((a, b) => a.box.x - b.box.x || a.box.y - b.box.y);
  const colunas: Bloco[][] = [];
  if (modo === "empilhado") colunas.push(corpo);
  else if (modo === "duas") {
    const meio = Math.ceil(corpo.length / 2);
    colunas.push(corpo.slice(0, meio), corpo.slice(meio));
  } else {
    let atual: Bloco[] = [];
    let fim = -Infinity;
    for (const b of corpo) {
      if (atual.length && b.box.x > fim + 1.2) {
        colunas.push(atual);
        atual = [];
        fim = -Infinity;
      }
      atual.push(b);
      fim = Math.max(fim, b.box.x + b.box.w);
    }
    if (atual.length) colunas.push(atual);
  }
  const uteis = colunas.filter((c) => c.length);
  if (!uteis.length) return null;
  // CONSERVADOR: o ritmo vertical do desenho é preservado (cada bloco fica na altura em que está);
  // o que muda é o **alinhamento** — os blocos de uma coluna na mesma borda esquerda — e, se algum
  // passar do rodapé, ele sobe até caber. Nada é re-empilhado e nada escala.
  uteis.forEach((col) => {
    const colunaX = Math.min(...col.map((b) => b.box.x));
    for (const b of col) {
      const t = anotar(b, colunaX, b.box.y, 1);
      const fim = b.box.y + b.box.h;
      if (fim > base) t.dy -= fim - base;
    }
  });

  // ---- painéis de fundo: cada imagem grande emoldura a coluna mais próxima
  for (const p of blocos.filter((b) => b.papel === "painel" && transf.has(b.ids[0]))) {
    const t = transf.get(p.ids[0])!;
    const box = caixaEm(p.box, t);
    const c = centro(box);
    let alvo = uteis[0];
    let d = Infinity;
    for (const col of uteis) {
      const cb = caixaDe(col.map((b) => ({ ...b.box, ...caixaEm(b.box, transf.get(b.ids[0])!) })));
      const cc = centro(cb);
      const dd = Math.hypot(c.x - cc.x, c.y - cc.y);
      if (dd < d) {
        d = dd;
        alvo = col;
      }
    }
    const cb = caixaDe(alvo.map((b) => ({ ...b.box, ...caixaEm(b.box, transf.get(b.ids[0])!) })));
    // o painel mantém o enquadramento: cobre a coluna, com um respiro igual em cima e embaixo
    const alvoW = Math.max(6, cb.w + 2.4);
    const s = alvoW / Math.max(1, p.box.w);
    const cx = cb.x + cb.w / 2;
    const cy = cb.y + cb.h / 2;
    let dx = cx - (p.box.x + p.box.w / 2) * s;
    let dy = cy - (p.box.y + p.box.h / 2) * s;
    // o painel não sai da lâmina (cobre a coluna e para na borda)
    const novoT = { w: p.box.w * s, h: p.box.h * s };
    if (p.box.x * s + dx < 0) dx = -p.box.x * s;
    if (p.box.y * s + dy < 0) dy = -p.box.y * s;
    if (p.box.x * s + dx + novoT.w > 100) dx = 100 - novoT.w - p.box.x * s;
    if (p.box.y * s + dy + novoT.h > 100) dy = 100 - novoT.h - p.box.y * s;
    const t2: Transf = { s, dx, dy, origem: { x: 0, y: 0, w: 100, h: 100 }, piso: PISO_ETIQUETA };
    transf.set(p.ids[0], t2);
  }

  return {
    ...slide,
    shapes: slide.shapes.map((s) => {
      if (s.fixa) return s;
      const t = transf.get(s.id);
      const r = t ? transformar(s, t) : s;
      // decoração não sai da lâmina (um filete preso a um bloco que subiu/desceu não pode vazar)
      if (!r.paras?.length) {
        const b = r.box;
        if (b.x < 0 || b.y < 0 || b.x + b.w > 100 || b.y + b.h > 100) {
          return { ...r, box: { ...b, x: Math.max(0, Math.min(100 - b.w, b.x)), y: Math.max(0, Math.min(100 - b.h, b.y)) } };
        }
      }
      return r;
    }),
  };
}

/**
 * Último recurso: quando a letra no piso ainda não cabe (caixa pequena demais), a letra desce até
 * caber. É melhor um texto um pouco menor do que um texto vazando por cima do vizinho.
 */
function ajustarLetra(f: Shape): Shape {
  if (!f.paras?.length || textoCabe(f)) return f;
  let atual = f;
  for (let i = 0; i < 30 && !textoCabe(atual); i++) {
    if (maiorLetra(atual) <= 6.1) break;
    const paras = atual.paras;
    if (!paras) break;
    atual = {
      ...atual,
      fontSize: Math.max(6, atual.fontSize * 0.93),
      paras: paras.map((p) => ({ ...p, runs: p.runs.map((r) => ({ ...r, size: Math.max(6, r.size * 0.93) })) })),
    };
  }
  return atual;
}

/** O que a lâmina tem de errado: textos que não cabem e textos que se sobrepõem. */
function defeitos(slide: Slide, blocos: Bloco[]): { vaza: number; sobre: number } {
  const ids = new Set(blocos.filter((b) => b.papel !== "painel").flatMap((b) => b.ids));
  const textos = slide.shapes.filter((s) => !s.fixa && ids.has(s.id) && s.paras?.length && txt(s));
  let sobre = 0;
  for (let i = 0; i < textos.length; i++) {
    for (let j = i + 1; j < textos.length; j++) {
      const a = textos[i].box;
      const b = textos[j].box;
      const w = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
      const h = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
      if (w > 0 && h > 0 && w * h > 0.08 * Math.min(a.w * a.h, b.w * b.h)) sobre++;
    }
  }
  const vaza = textos.filter((s) => !textoCabe(s)).length;
  return { vaza, sobre };
}

/**
 * Nota da variante RELATIVA à lâmina original: só pesa o que ela piorou (a régua do estimator
 * acusa caixas justas que o deck já usa) e a cobertura da área soma.
 */
function avaliar(original: Slide, novo: Slide, blocos: Bloco[]): number {
  const antes = defeitos(original, blocos);
  const depois = defeitos(novo, blocos);
  let nota = 1 - Math.max(0, depois.vaza - antes.vaza) * 1.2 - Math.max(0, depois.sobre - antes.sobre) * 0.5;
  // a letra abaixo do piso de conteúdo desce a nota (a não ser que a original já fosse miúda ali)
  const ids = new Set(blocos.filter((b) => b.papel !== "painel").flatMap((b) => b.ids));
  const miudas = novo.shapes.filter((s) => !s.fixa && ids.has(s.id) && s.paras?.length && maiorLetra(s) < PISO_CORPO - 0.01).length;
  const miudasAntes = original.shapes.filter((s) => !s.fixa && ids.has(s.id) && s.paras?.length && maiorLetra(s) < PISO_CORPO - 0.01).length;
  nota -= Math.max(0, miudas - miudasAntes) * 0.8;
  // a qualidade da POSIÇÃO: o quanto a lâmina está fora da grade canônica (margem, topo, rodapé, coluna)
  const porId = new Map(novo.shapes.map((s) => [s.id, s]));
  const cx = (b: Bloco) => caixaDe(b.ids.map((id) => porId.get(id)?.box).filter((x): x is ShapeBox => !!x));
  let desvio = 0;
  const tit = blocos.find((b) => b.papel === "titulo");
  if (tit) {
    const c = cx(tit);
    desvio += Math.abs(c.x - MARGEM_X) + Math.abs(c.y - MARGEM_TOPO);
  }
  const rod = blocos.find((b) => b.papel === "rodape");
  if (rod) {
    const c = cx(rod);
    desvio += Math.abs(c.x - MARGEM_X) + Math.abs(100 - MARGEM_BASE - (c.y + c.h));
  }
  const corpos = blocos.filter((b) => b.papel === "corpo" || b.papel === "diagrama");
  if (corpos.length) desvio += Math.abs(caixaDe(corpos.map(cx)).x - MARGEM_X);
  nota -= Math.min(0.5, desvio / 40);
  return nota;
}

/** O texto cabe na caixa? (a mesma estimativa da Arrumação: a palavra na largura e o texto na altura) */
function textoCabe(s: Shape, alturaPt = 540): boolean {
  const util = Math.max(8, (s.box.w / 100) * 960 - 8);
  const paras = (s.paras ?? []).map((p) => ({ texto: p.runs.map((r) => r.text ?? "").join(""), letra: Math.max(1, ...p.runs.map((r) => r.size ?? s.fontSize)) }));
  if (!paras.length) return true;
  if (!paras.every((p) => Math.max(1, ...p.texto.split(/\s+/).map((w) => w.length)) * p.letra * 0.55 <= util * 1.08)) return false;
  const necessario = paras.reduce((a, p) => a + Math.max(1, Math.ceil((p.texto.length * p.letra * 0.5) / util)) * p.letra * 1.2, 0);
  const disponivel = (s.box.h / 100) * alturaPt - 4;
  return disponivel <= 0 || necessario <= disponivel * 1.2;
}
