// Arranjos de lâmina (aba "Arranjos" do painel): reorganizam o conteúdo que JÁ está na lâmina em
// fórmulas padrão — grade, lista, destaque e faixa — mantendo o visual (cores, estilos, imagens).
//
// A unidade de conteúdo é um CARTÃO (forma pintada ou imagem de tamanho razoável) com tudo o que
// está dentro dele (avatar, logo, textos). Num deck importado o cartão quase sempre é uma imagem
// com os textos soltos por cima: por isso a detecção é por contenção (o centro de um dentro da
// caixa do outro) e não por agrupamento. As formas fixas do modelo (decorações) não se movem, os
// textos do cabeçalho (título, subtítulo, legenda) também não, e os conectores ("Conectar") saem:
// eles são derivados das formas, então ficariam ligando cartões que não têm mais vizinhança.
//
// Os dois eixos do app são independentes (x/w em % da largura, y/h em % da altura), então o que é
// "mesmo tamanho" e "mesma proporção" precisa do fator da proporção da lâmina — é o parâmetro
// `ratio`.
//
// Funções puras: devolvem lâmina nova, sem mexer na original.
import type { Run, Shape, ShapeBox, Slide } from "../schema";

export type Arranjo = "grade" | "lista" | "destaque" | "faixa";

export interface ArranjoPPT {
  id: Arranjo;
  nome: string;
  descricao: string;
}

export const ARRANJOS: ArranjoPPT[] = [
  { id: "grade", nome: "Grade", descricao: "cartões do mesmo tamanho em grade" },
  { id: "lista", nome: "Lista", descricao: "um cartão por linha, empilhados" },
  { id: "destaque", nome: "Destaque", descricao: "o primeiro cartão grande e o resto numa coluna ao lado" },
  { id: "faixa", nome: "Faixa", descricao: "tudo numa linha só, como uma linha do tempo" },
];

/** Uma unidade de conteúdo: o cartão e tudo o que anda com ele. */
export interface Unidade {
  box: ShapeBox;
  ids: string[];
}

/** Margem da lâmina e espaço entre os cartões (nas unidades do app). */
const MARGEM = 6;
const ESPACO = 2.5;
/** Um cartão não pode passar disso da lâmina (senão é fundo) nem ser menor que isso (senão é ícone). */
const AREA_MIN = 2; // % da área da lâmina
const AREA_MAX = 80;
/** O conteúdo não cresce mais que isso (um cartão pequeno não vira um outdoor). */
const ESCALA_MAX = 1.8;

const area = (b: ShapeBox): number => b.w * b.h;

/** A área da caixa em % da área da lâmina (a lâmina vale 100 × 100). */
const porcao = (b: ShapeBox): number => area(b) / 100;

/** O centro de `dentro` está na caixa de `fora`? */
function dentro(fora: Shape, dentro: Shape): boolean {
  const cx = dentro.box.x + dentro.box.w / 2;
  const cy = dentro.box.y + dentro.box.h / 2;
  return cx >= fora.box.x && cx <= fora.box.x + fora.box.w && cy >= fora.box.y && cy <= fora.box.y + fora.box.h;
}

function temTexto(s: Shape): boolean {
  return (s.paras ?? []).some((p) => p.runs.some((r) => (r.text ?? "").trim()));
}

/** Pinta ou mostra imagem — o que faz de uma forma um cartão. */
function pintado(s: Shape): boolean {
  return s.kind === "imagem" || !!s.src || s.fillX?.kind === "solid" || !!s.fill;
}

/** Geometrias que um cartão pode ter (retângulo e variações de cantos); triângulo, seta, estrela,
 *  traçado livre etc. são enfeite. */
function geomDeCartao(s: Shape): boolean {
  if (s.paths?.length) return false;
  return !s.geom || /^(rect|round|snip)/i.test(s.geom);
}

/** Uma forma grande, pintada e sem texto que é enfeite (triângulo, forma translúcida…): não é
 *  cartão e não anda com ninguém — fica onde está, como as decorações fixas do modelo. */
function ehDecoracao(s: Shape): boolean {
  if (s.kind === "imagem" || !!s.src || temTexto(s)) return false;
  if (!pintado(s) || porcao(s.box) < AREA_MIN) return false;
  return !geomDeCartao(s) || (s.opacity !== undefined && s.opacity < 0.7);
}

function ehCartao(s: Shape): boolean {
  return pintado(s) && geomDeCartao(s) && !ehDecoracao(s) && porcao(s.box) >= AREA_MIN && porcao(s.box) <= AREA_MAX;
}

/** Ordem de leitura: de cima para baixo e, na mesma faixa, da esquerda para a direita. */
function emOrdem(a: Shape, b: Shape): number {
  const faixa = Math.max(a.box.h, b.box.h) * 0.6;
  if (Math.abs(a.box.y - b.box.y) > faixa) return a.box.y - b.box.y;
  return a.box.x - b.box.x;
}

/** Os cartões da lâmina (só os de fora: um cartão dentro de outro anda com o de fora) e os painéis
 *  de fundo, que envolvem vários cartões e por isso ficam parados. */
function analisar(slide: Slide): { cards: Shape[]; paineis: Set<string> } {
  const vivas = slide.shapes.filter((s) => !s.fixa && !s.liga);
  const candidatos = vivas.filter(ehCartao);
  // um painel que envolve vários cartões é fundo, não cartão: os cartões dele é que contam
  const paineis = new Set(candidatos.filter((c) => candidatos.filter((o) => o !== c && dentro(c, o)).length >= 2).map((c) => c.id));
  const reais = candidatos.filter((c) => !paineis.has(c.id));
  return { cards: reais.filter((c) => !reais.some((o) => o !== c && dentro(o, c))).sort(emOrdem), paineis };
}

/** As formas que não andam: fixas do modelo, conectores e o que está dentro de um cartão. */
function soltas(slide: Slide, cards: Shape[]): Shape[] {
  return slide.shapes.filter((s) => !s.fixa && !s.liga && !ehDecoracao(s) && !cards.some((c) => dentro(c, s)));
}

/** Um traço comprido e fino fora dos cartões é uma linha de ligação (num deck importado elas vêm
 *  como retângulo fino, não como conector). A barrinha de destaque DENTRO de um cartão fica: ela
 *  anda com o cartão. */
function ehLinhaSolta(s: Shape, emCartao: boolean): boolean {
  if (emCartao || temTexto(s)) return false;
  const curto = Math.min(s.box.w, s.box.h);
  const longo = Math.max(s.box.w, s.box.h);
  return curto <= 1 && longo / Math.max(0.01, curto) >= 5;
}

/** A faixa do topo que fica reservada (título, subtítulo, legenda): o texto solto que termina nessa
 *  faixa não se move — o arranjo começa abaixo dele. */
function faixaDoTopo(slide: Slide, cards: Shape[]): number {
  let fim = 0;
  for (const s of soltas(slide, cards)) {
    const termina = s.box.y + s.box.h;
    if (s.box.y <= 14 && termina <= 34) fim = Math.max(fim, termina);
  }
  return fim > 0 ? Math.min(fim + 2, 40) : 0;
}

/** A caixa que envolve todas (a unidade anda como um bloco). */
function caixaDe(caixas: ShapeBox[]): ShapeBox {
  const x = Math.min(...caixas.map((b) => b.x));
  const y = Math.min(...caixas.map((b) => b.y));
  const x2 = Math.max(...caixas.map((b) => b.x + b.w));
  const y2 = Math.max(...caixas.map((b) => b.y + b.h));
  return { x, y, w: x2 - x, h: y2 - y };
}

/**
 * As unidades de conteúdo da lâmina, na ordem de leitura. Com cartões, cada um é uma unidade (com
 * o que está dentro). Sem cartões (lâmina de tópicos), cada texto solto é uma unidade — menos os
 * do cabeçalho, que ficam onde estão.
 */
export function unidadesDa(slide: Slide): Unidade[] {
  const { cards, paineis } = analisar(slide);
  return unidadesCom(slide, cards, paineis);
}

/** Como `unidadesDa`, com os cartões já detectados (o aplicar não detecta duas vezes). */
function unidadesCom(slide: Slide, cards: Shape[], paineis: Set<string>): Unidade[] {
  if (cards.length >= 2) {
    const porId = new Map(slide.shapes.map((s) => [s.id, s]));
    const vivas = slide.shapes.filter((s) => !s.fixa && !s.liga && !ehDecoracao(s) && !paineis.has(s.id));
    const dono = new Map<string, string>();
    // o conteúdo vai para a MENOR carta que o contém (cartão dentro de cartão)
    for (const c of [...cards].sort((a, b) => area(a.box) - area(b.box))) {
      for (const s of vivas) if (s.id !== c.id && dentro(c, s) && !dono.has(s.id)) dono.set(s.id, c.id);
    }
    return cards.map((c) => {
      const ids = [c.id, ...[...dono.entries()].filter(([, cid]) => cid === c.id).map(([sid]) => sid)];
      return { ids, box: caixaDe(ids.map((id) => porId.get(id)!.box)) };
    });
  }
  const band = faixaDoTopo(slide, cards);
  return slide.shapes
    .filter((s) => !s.fixa && !s.liga && s.kind === "texto" && temTexto(s) && s.box.y >= band)
    .sort(emOrdem)
    .map((s) => ({ ids: [s.id], box: { ...s.box } }));
}

/** As variantes que fazem sentido (a grade muda de colunas). */
export function variantesDe(id: Arranjo, quantas: number): number[] {
  if (id !== "grade") return [0];
  return [2, 3, 4].filter((c) => c <= quantas);
}

/** Como o arranjo aparece no painel ("Grade 3×2", "Lista", …). */
export function rotuloDoArranjo(id: Arranjo, variante: number, quantas: number): string {
  const nome = ARRANJOS.find((a) => a.id === id)?.nome ?? id;
  if (id !== "grade") return nome;
  const colunas = Math.max(1, Math.min(variante || 2, quantas));
  return `${nome} ${colunas}×${Math.ceil(quantas / colunas)}`;
}

/** Colunas e linhas de cada fórmula. */
function grade(id: Arranjo, variante: number, quantas: number): { colunas: number; linhas: number } {
  if (id === "grade") {
    const colunas = Math.max(1, Math.min(variante || 2, quantas));
    return { colunas, linhas: Math.ceil(quantas / colunas) };
  }
  if (id === "faixa") return { colunas: quantas, linhas: 1 };
  if (id === "destaque") return { colunas: 2, linhas: Math.max(1, quantas - 1) };
  return { colunas: 1, linhas: quantas }; // lista
}

/** O espaço de cada cartão, na ordem (o cartão é centrado nele depois). */
function espacos(id: Arranjo, variante: number, quantas: number, topo: number): ShapeBox[] {
  const x0 = MARGEM;
  const y0 = Math.max(topo, MARGEM);
  const largura = 100 - 2 * MARGEM;
  const altura = 100 - y0 - MARGEM;
  const { colunas, linhas } = grade(id, variante, quantas);
  const passoX = largura / colunas;
  const passoY = altura / linhas;
  const saida: ShapeBox[] = [];
  for (let i = 0; i < quantas; i++) {
    if (id === "destaque" && i === 0) {
      saida.push({ x: x0, y: y0, w: largura / 2 - ESPACO / 2, h: altura });
      continue;
    }
    if (id === "destaque") {
      const j = i - 1;
      saida.push({ x: x0 + largura / 2 + ESPACO / 2, y: y0 + j * passoY, w: largura / 2 - ESPACO / 2, h: passoY });
      continue;
    }
    const col = i % colunas;
    const lin = Math.floor(i / colunas);
    saida.push({ x: x0 + col * passoX, y: y0 + lin * passoY, w: passoX, h: passoY });
  }
  return saida;
}

/** O texto da forma na mesma proporção do cartão (com um mínimo para não sumir). */
function escalaDoTexto(s: Shape, k: number): Shape {
  const fonte = (tamanho: number | undefined): number | undefined => (tamanho ? Math.max(8, Math.round(tamanho * k * 10) / 10) : tamanho);
  return {
    ...s,
    fontSize: fonte(s.fontSize) ?? s.fontSize,
    paras: s.paras ? s.paras.map((p) => ({ ...p, runs: p.runs.map((r: Run) => ({ ...r, size: fonte(r.size) ?? r.size })) })) : s.paras,
  };
}

/**
 * A lâmina com o arranjo aplicado. Os cartões ganham o MESMO tamanho (o do maior deles, ajustado
 * para caber no espaço da fórmula) e o conteúdo de cada um escala junto, na mesma proporção.
 */
export function aplicarArranjo(slide: Slide, id: Arranjo, variante: number, ratio: number): Slide {
  const { cards, paineis } = analisar(slide);
  const unidades = unidadesCom(slide, cards, paineis);
  const porId = new Map(slide.shapes.map((s) => [s.id, s]));
  const emCartao = new Set(slide.shapes.filter((s) => cards.some((c) => dentro(c, s))).map((s) => s.id));
  // nada a arrumar: uma lâmina de título (dois textos soltos) fica como está
  if (cards.length < 2 && unidades.length < 3) return slide;
  const topo = faixaDoTopo(slide, cards);

  // tamanho físico de cada unidade (a altura vale 1/ratio na régua da largura)
  const fisico = (b: ShapeBox) => ({ w: b.w, h: b.h / ratio });
  const alvo = unidades.reduce((t, u) => ({ w: Math.max(t.w, fisico(u.box).w), h: Math.max(t.h, fisico(u.box).h) }), { w: 0, h: 0 });

  // o espaço que a fórmula reserva limita o tamanho do cartão (o mesmo para todos — menos no
  // destaque, em que o primeiro cartão ocupa a metade da esquerda e pode ser maior)
  const { colunas, linhas } = grade(id, variante, unidades.length);
  const y0 = Math.max(topo, MARGEM);
  const espacoW = (100 - 2 * MARGEM) / colunas - ESPACO;
  const espacoH = (100 - y0 - MARGEM) / linhas - ESPACO;
  const k = Math.min(1.6, espacoW / alvo.w, espacoH / (alvo.h * ratio));
  const cartao = { w: Math.max(4, alvo.w * k), h: Math.max(4, alvo.h * k * ratio) };
  const kGrande = id === "destaque" ? Math.min(2.4, ((100 - 2 * MARGEM) / 2 - ESPACO) / alvo.w, (100 - y0 - MARGEM) / (alvo.h * ratio)) : k;
  const cartaoGrande = id === "destaque" ? { w: Math.max(4, alvo.w * kGrande), h: Math.max(4, alvo.h * kGrande * ratio) } : cartao;

  // a escala de cada unidade e a caixa nova de cada forma que anda com ela
  const escala = new Map<string, number>();
  const caixas = new Map<string, ShapeBox>();
  espacos(id, variante, unidades.length, topo).forEach((slot, i) => {
    const u = unidades[i];
    const tamanho = i === 0 ? cartaoGrande : cartao;
    const ku = Math.min(ESCALA_MAX, tamanho.w / fisico(u.box).w, tamanho.h / (fisico(u.box).h * ratio));
    // o bloco inteiro (cartão + o que sai dele) é centrado no espaço e todas as formas andam por ele:
    // assim o conteúdo não se desloca em relação ao cartão e nada passa do espaço do vizinho
    const bloco = { x: slot.x + (slot.w - u.box.w * ku) / 2, y: slot.y + (slot.h - u.box.h * ku) / 2 };
    for (const sid of u.ids) {
      const s = porId.get(sid)!;
      escala.set(sid, ku);
      caixas.set(sid, { x: bloco.x + (s.box.x - u.box.x) * ku, y: bloco.y + (s.box.y - u.box.y) * ku, w: s.box.w * ku, h: s.box.h * ku });
    }
  });

  const shapes = slide.shapes
    // os conectores e as linhas de ligação saem: a vizinhança dos cartões mudou
    .filter((s) => !s.liga && !ehLinhaSolta(s, emCartao.has(s.id)))
    .map((s) => {
      const caixa = caixas.get(s.id);
      if (!caixa) return s;
      return { ...escalaDoTexto(s, escala.get(s.id) ?? 1), box: caixa };
    });
  return { ...slide, shapes };
}
