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
import { aplicarHierarquia, detectarArvore } from "./hierarquia";

export type Arranjo = "grade" | "lista" | "destaque" | "faixa" | "hierarquia" | "hierarquia-lado";

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
  // só aparecem (e só mudam a lâmina) quando ela tem uma hierarquia: o resto devolve a lâmina como está
  { id: "hierarquia", nome: "Hierarquia", descricao: "organograma: um nível por linha, filhos centrados sob o pai e conectores redesenhados" },
  { id: "hierarquia-lado", nome: "Hierarquia →", descricao: "organograma da esquerda para a direita, com os conectores redesenhados" },
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
const AREA_MIN = 1; // % da área da lâmina
/** Abaixo disto o cartão precisa ter texto (ou ser imagem): senão é um enfeite pequeno, não um cartão. */
const AREA_SEM_TEXTO = 2;
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

/** `fora` envolve `dentro`: o centro dele cai na caixa e ele é MENOR (dois cartões concêntricos —
 *  o de fora e o branco de dentro — não podem se descartar um ao outro). */
function envolve(fora: Shape, dentroDe: Shape): boolean {
  return fora !== dentroDe && area(fora.box) > area(dentroDe.box) && dentro(fora, dentroDe);
}

function temTexto(s: Shape): boolean {
  return (s.paras ?? []).some((p) => p.runs.some((r) => (r.text ?? "").trim()));
}

/** Pinta ou mostra imagem — o que faz de uma forma um cartão. */
function pintado(s: Shape): boolean {
  return s.kind === "imagem" || !!s.src || (!!s.fillX && s.fillX.kind !== "none") || !!s.fill;
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
  if (!pintado(s) || porcao(s.box) < AREA_SEM_TEXTO) return false;
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
  const candidatos = vivas.filter(ehCartao).filter((c) => porcao(c.box) >= AREA_SEM_TEXTO || c.kind === "imagem" || !!c.src || temTexto(c) || vivas.some((o) => o !== c && temTexto(o) && dentro(c, o)));
  // um painel que envolve vários cartões é fundo, não cartão: os cartões dele é que contam
  const paineis = new Set(candidatos.filter((c) => candidatos.filter((o) => envolve(c, o)).length >= 2).map((c) => c.id));
  const reais = candidatos.filter((c) => !paineis.has(c.id));
  return { cards: reais.filter((c) => !reais.some((o) => envolve(o, c))).sort(emOrdem), paineis };
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
  const topoDosCartoes = cards.length ? Math.min(...cards.map((c) => c.box.y)) : 101;
  for (const s of soltas(slide, cards)) {
    const termina = s.box.y + s.box.h;
    if (s.box.y <= 14 && termina <= 34) fim = Math.max(fim, termina);
    // o texto que está ACIMA do primeiro cartão (o parágrafo de apresentação, por exemplo) também fica:
    // sem isto os cartões eram jogados por cima dele
    else if (cards.length && temTexto(s) && termina <= topoDosCartoes + 1) fim = Math.max(fim, termina);
  }
  return fim > 0 ? Math.min(fim + 2, 70) : 0;
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

/**
 * A lâmina tem o que arrumar? Uma lâmina de título (dois textos soltos) fica como está — é a mesma
 * condição do `aplicarArranjo` (nenhuma fórmula faz sentido ali), exposta para o painel poder
 * explicar em vez de oferecer cartões que não mudam nada.
 */
export function arrumavel(slide: Slide): boolean {
  const { cards, paineis } = analisar(slide);
  return cards.length >= 2 || unidadesCom(slide, cards, paineis).length >= 3;
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

/** O texto da forma na mesma proporção do cartão. O piso de 8 pt só segura a letra legível: uma letra que já era menor que isso não é inflada (caberia pior na caixa que encolheu). */
function escalaDoTexto(s: Shape, k: number): Shape {
  const fonte = (tamanho: number | undefined): number | undefined => (tamanho ? Math.max(Math.min(tamanho, 8), Math.round(tamanho * k * 10) / 10) : tamanho);
  return {
    ...s,
    fontSize: fonte(s.fontSize) ?? s.fontSize,
    paras: s.paras ? s.paras.map((p) => ({ ...p, runs: p.runs.map((r: Run) => ({ ...r, size: fonte(r.size) ?? r.size })) })) : s.paras,
  };
}

/** Até onde (em %) o arranjo pode descer: acima do rodapé (o que fica fora dos cartões, embaixo). */
function limiteBaixo(slide: Slide, unidades: Unidade[]): number {
  const dosCartoes = new Set(unidades.flatMap((u) => u.ids));
  const rodape = slide.shapes.filter((s) => !s.fixa && !s.liga && !dosCartoes.has(s.id) && s.box.y >= 82).map((s) => s.box.y);
  return rodape.length ? Math.min(94, Math.min(...rodape) - 1.5) : 94;
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

  // a hierarquia não é uma grade: ela entende a árvore e redesenha os conectores
  if (id === "hierarquia" || id === "hierarquia-lado") {
    const linhas = slide.shapes.filter((s) => !s.fixa && ehLinhaSolta(s, emCartao.has(s.id)));
    const dosCartoes = new Set(unidades.flatMap((u) => u.ids));
    // o texto solto que fica onde está (e não pode ser coberto pelo organograma)
    const obstaculos = slide.shapes.filter((s) => !s.fixa && !s.liga && !dosCartoes.has(s.id) && s.kind === "texto" && temTexto(s)).map((s) => s.box);
    const entrada = { slide, unidades, linhas, ratio, topo: Math.max(topo, MARGEM), baixo: limiteBaixo(slide, unidades), obstaculos };
    const arvore = detectarArvore(entrada);
    return arvore ? aplicarHierarquia(entrada, arvore, id === "hierarquia" ? "baixo" : "lado") : slide;
  }

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

/**
 * O DESENHO ANTIGO do slide: formas decorativas sem texto fora dos cartões — o triângulo, o pontilhado,
 * a barrinha de destaque que o deck trazia. O Designer põe arte nova e REMOVE estas (senão as duas
 * brigam e a antiga cobre o texto). Ficam as imagens (logotipos), os cartões e tudo o que tem texto, as
 * tabelas, os gráficos e as mídias, e os traços que ligam cartões (a hierarquia os redesenha).
 */
export function enfeitesDa(slide: Slide): Set<string> {
  const { cards, paineis } = analisar(slide);
  const dosCartoes = new Set(unidadesCom(slide, cards, paineis).flatMap((u) => u.ids));
  const GEOMS = /^(rect|round|ellipse|triangle|rtTriangle|diamond|parallelogram|trapezoid|hexagon|pentagon|snip)/i;
  const saida = new Set<string>();
  for (const s of slide.shapes) {
    if (s.liga || s.name?.startsWith("arr:")) continue;
    if (s.kind === "imagem" || s.src || s.tabela || s.grafico || s.midia || temTexto(s)) continue;
    if (dosCartoes.has(s.id) || cards.some((c) => dentro(c, s))) continue;
    if (!pintado(s) && !(s.paths?.length)) continue;
    const area = porcao(s.box);
    const curto = Math.min(s.box.w, s.box.h);
    const longo = Math.max(s.box.w, s.box.h);
    // um TRAÇO fino (relação ≥ 5): é conector ou separador (fica) — a não ser a barrinha curta de destaque,
    // solta, longe de qualquer cartão. Um traço que toca um cartão é conector, mesmo curto.
    if (curto <= 1.2 && longo / Math.max(0.01, curto) >= 5) {
      const encosta = cards.some((c) => s.box.x <= c.box.x + c.box.w + 1.5 && c.box.x <= s.box.x + s.box.w + 1.5 && s.box.y <= c.box.y + c.box.h + 1.5 && c.box.y <= s.box.y + s.box.h + 1.5);
      if (longo <= 9 && !encosta) saida.add(s.id);
      continue;
    }
    const decorativa = ehDecoracao(s) || (!!s.geom && GEOMS.test(s.geom) && area < AREA_MIN) || (!!s.paths?.length && area >= AREA_MIN);
    if (decorativa) saida.add(s.id);
  }
  return saida;
}

/**
 * Os cartões JÁ estão arrumados? Do mesmo tamanho e sobre poucas linhas e colunas (três cartões
 * lado a lado, uma grade 2×3…). Mexer neles só piora: o Designer deixa onde estão. Um conjunto
 * espalhado tem uma linha e uma coluna para cada cartão, então não passa.
 */
function jaArrumados(unidades: Unidade[], cards: Shape[]): boolean {
  const caixas = unidades.length ? cards.map((c) => c.box) : [];
  if (caixas.length < 2) return false;
  const w0 = caixas[0].w;
  const h0 = caixas[0].h;
  if (!caixas.every((b) => Math.abs(b.w - w0) / w0 <= 0.1 && Math.abs(b.h - h0) / h0 <= 0.1)) return false;
  const grupos = (valores: number[], tol: number): number => {
    const ordem = [...valores].sort((a, b) => a - b);
    let n = 0;
    ordem.forEach((v, i) => {
      if (i === 0 || v - ordem[i - 1] > tol) n++;
    });
    return n;
  };
  const linhas = grupos(caixas.map((b) => b.y), 3);
  const colunas = grupos(caixas.map((b) => b.x), 3);
  return linhas * colunas <= caixas.length + 1;
}

/**
 * O MELHOR arranjo para a lâmina (é o que o Designer aplica sozinho): entre as fórmulas que deixam
 * tudo legível, a que dá os maiores cartões — com um bônus para a hierarquia, que preserva o sentido
 * do slide (um organograma não vira grade). A lâmina sem o que arrumar volta como está.
 */
export function melhorArranjo(slide: Slide, ratio: number): Slide {
  const { cards, paineis } = analisar(slide);
  const unidades = unidadesCom(slide, cards, paineis);
  if (cards.length < 2 && unidades.length < 3) return slide;
  // o que já está em ordem (uma fileira de cartões iguais) não é mexido — a arrumação só piora
  if (jaArrumados(unidades, cards)) return slide;
  const candidatos: [Arranjo, number, number][] = [
    ["hierarquia", 0, 2.5],
    ["hierarquia-lado", 0, 2.2],
    ...variantesDe("grade", unidades.length).map((v): [Arranjo, number, number] => ["grade", v, 1]),
    ["lista", 0, 1],
    ["faixa", 0, 1],
    ["destaque", 0, 1],
  ];
  let melhor = slide;
  let nota = 0;
  for (const [id, variante, peso] of candidatos) {
    const novo = aplicarArranjo(slide, id, variante, ratio);
    if (!arranjoLegivel(slide, novo)) continue;
    const caixas = new Map(novo.shapes.map((f) => [f.id, f.box]));
    const area = unidades.reduce((a, u) => {
      const bs = u.ids.map((i) => caixas.get(i)).filter((b): b is ShapeBox => !!b);
      const c = bs.length ? caixaDe(bs) : { w: 0, h: 0 };
      return a + c.w * c.h;
    }, 0) / unidades.length;
    if (area * peso > nota) {
      nota = area * peso;
      melhor = novo;
    }
  }
  return melhor;
}

/** Os menores lados que um cartão pode ter depois do arranjo (nas unidades do app) sem ficar ilegível. */
const LARGURA_MIN = 7;
const ALTURA_MIN = 5;
/** Na hierarquia a área mínima (% × %) vale no lugar das medidas: um cartão alto e estreito lê bem; uma tira de 2% não. */
const AREA_MIN_CARTAO = 35;

/**
 * Por que o arranjo NÃO deve ser oferecido (lista vazia = pode). Os motivos explicam a rejeição
 * (o painel e os testes mostram qual regra reprovou, em vez de só "não coube"):
 * - nada mudou (a fórmula não encontrou o que arrumar);
 * - um cartão ficou pequeno demais (uma tira de 2% da lâmina não se lê);
 * - o texto não cabe mais na caixa (a palavra quebra no meio ou o parágrafo vaza para o vizinho);
 * - um cartão caiu sobre um texto que fica onde está, ou sobre outro cartão.
 */
export function motivosDoArranjo(original: Slide, novo: Slide): string[] {
  // a fórmula que não encontrou o que arrumar (a hierarquia numa lâmina sem hierarquia) devolve a mesma lâmina
  if (novo === original) return ["a fórmula não encontrou o que arrumar"];
  const unidades = unidadesDa(original);
  if (unidades.length < 2) return [];
  const motivos: string[] = [];
  const caixas = new Map(novo.shapes.map((s) => [s.id, s.box]));
  const porId = new Map(novo.shapes.map((s) => [s.id, s]));
  const original0 = new Map(original.shapes.map((s) => [s.id, s]));
  // o texto só reprova se o ARRANJO o piorou: uma palavra que já quebrava no slide original não conta
  const piorou = (id: string): boolean => !textoCabe(porId.get(id)) && textoCabe(original0.get(id));
  // a hierarquia (reconhecida pelos conectores que ela redesenha) tem o mínimo relaxado; os demais arranjos, o rígido
  const hierarquia = novo.shapes.some((f) => f.name?.startsWith("arr:"));
  const minLargura = hierarquia ? 4.5 : LARGURA_MIN;
  const minAltura = hierarquia ? 4.5 : ALTURA_MIN;
  const finais: ShapeBox[] = [];
  unidades.forEach((u, i) => {
    const bs = u.ids.map((id) => caixas.get(id)).filter((b): b is ShapeBox => !!b);
    if (!bs.length) return;
    const c = caixaDe(bs);
    finais.push(c);
    // a hierarquia tem cartões altos e estreitos (as pessoas sob uma área): vale a área; os outros arranjos, o mínimo rígido
    if (c.w < minLargura || c.h < minAltura || (hierarquia && c.w * c.h < AREA_MIN_CARTAO)) motivos.push(`cartão ${i} pequeno demais (${c.w.toFixed(1)}×${c.h.toFixed(1)})`);
    const vaza = u.ids.filter(piorou);
    if (vaza.length) motivos.push(`texto não cabe em ${vaza.join(",")}`);
  });
  // um cartão não pode cair sobre um texto que fica onde está (o parágrafo, o título)
  const dosCartoes0 = new Set(unidades.flatMap((u) => u.ids));
  const fixos = original.shapes.filter((f) => !f.fixa && !f.liga && !dosCartoes0.has(f.id) && temTexto(f));
  finais.forEach((c, i) => {
    for (const f of fixos) {
      const t = f.box;
      const w = Math.min(c.x + c.w, t.x + t.w) - Math.max(c.x, t.x);
      const h = Math.min(c.y + c.h, t.y + t.h) - Math.max(c.y, t.y);
      if (w > 0 && h > 0 && w * h > 0.05 * Math.min(c.w * c.h, t.w * t.h)) motivos.push(`cartão ${i} cobre o texto ${f.id}`);
    }
  });
  // dois cartões não podem se sobrepor (o arranjo que junta tudo num lugar só é o pior resultado possível)
  for (let i = 0; i < finais.length; i++) {
    for (let j = i + 1; j < finais.length; j++) {
      const a = finais[i];
      const b = finais[j];
      const w = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
      const h = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
      if (w > 0 && h > 0 && w * h > 0.1 * Math.min(a.w * a.h, b.w * b.h)) motivos.push(`cartões ${i} e ${j} se sobrepõem`);
    }
  }
  return motivos;
}

/**
 * O arranjo deixou tudo legível? Com muitos cartões, fórmulas como Lista e Faixa os reduzem a tiras
 * de 2% da lâmina; com muito texto, a caixa estreita faz o parágrafo vazar; com um texto fixo por perto,
 * o cartão cai sobre ele. Nesses casos a fórmula não é oferecida (os motivos estão em `motivosDoArranjo`).
 */
export function arranjoLegivel(original: Slide, novo: Slide): boolean {
  return motivosDoArranjo(original, novo).length === 0;
}

/**
 * O texto da forma CABE na caixa? Duas conferências, com a letra de cada trecho:
 * 1. a palavra mais longa cabe na largura (palavra que passa da caixa quebra no meio: "Arauc/ária");
 * 2. o texto INTEIRO cabe na altura — as linhas que a largura força, uma sobre a outra. Um cartão com
 *    parágrafos, espremido numa coluna estreita, ganha muitas linhas e vaza por cima do vizinho.
 * É uma estimativa (0,5 em de largura média por letra, 1,2 de entrelinha; a lâmina tem 960 pt de
 * largura e `alturaPt` de altura) — conservadora o bastante para reprovar o que visivelmente vaza.
 */
function textoCabe(s: Shape | undefined, alturaPt = 540): boolean {
  if (!s || s.fixa || !temTexto(s)) return true;
  const larguraPt = (s.box.w / 100) * 960;
  const util = Math.max(8, larguraPt - 12); // menos o respiro das bordas
  const paras: { texto: string; letra: number }[] = s.paras?.length
    ? s.paras.map((p) => ({ texto: p.runs.map((r) => r.text ?? "").join(""), letra: Math.max(1, ...p.runs.map((r) => r.size ?? s.fontSize)) }))
    : (s.text ?? "").split("\n").map((t) => ({ texto: t, letra: s.fontSize }));
  // 1) a palavra mais longa, trecho a trecho (um "3" enorme ao lado de uma frase pequena não reprova a frase)
  const trechos = s.paras?.length ? s.paras.flatMap((p) => p.runs.map((r) => ({ texto: r.text ?? "", letra: r.size ?? s.fontSize }))) : paras;
  if (!trechos.every((t) => Math.max(1, ...t.texto.split(/\s+/).map((w) => w.length)) * t.letra * 0.55 <= util * 1.08)) return false;
  // 2) o texto inteiro na altura
  const linhas = paras.reduce((a, p) => a + Math.max(1, Math.ceil((p.texto.length * p.letra * 0.5) / util)), 0);
  const necessario = paras.reduce((a, p) => a + Math.max(1, Math.ceil((p.texto.length * p.letra * 0.5) / util)) * p.letra * 1.2, 0);
  const disponivel = (s.box.h / 100) * alturaPt - 6;
  // uma linha só (um rótulo) em caixa justa escorrega um pouco e ninguém vê: só a largura importa. Um
  // parágrafo de VÁRIAS linhas que passa da altura vaza por cima do vizinho — é esse o defeito que a
  // conferência existe para pegar (o cartão espremido numa coluna estreita)
  return linhas <= 1 || necessario <= disponivel * 1.12;
}
