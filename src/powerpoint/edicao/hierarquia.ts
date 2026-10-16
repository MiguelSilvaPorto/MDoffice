// Arrumação em HIERARQUIA (organograma): entende a árvore do slide e a redesenha — cada nível numa
// linha (ou coluna), os filhos centrados sob o pai, as caixas do mesmo nível com o MESMO tamanho e
// os conectores REDESENHADOS (haste, barramento e descidas). É o que faltava às fórmulas de grade
// e lista: elas moviam os cartões mas jogavam fora as ligações, e a hierarquia — que é o sentido do
// slide — se perdia.
//
// Como a árvore é descoberta: os conectores (traços finos, ou ligações nativas do Conectar) formam
// REDES (traços que se tocam); numa rede, o cartão mais alto é o pai dos que estão abaixo dele. Uma
// rede sem um cartão claramente no topo (um separador sob uma fileira) não manda: os cartões dela
// só entram numa fileira no fim. Cartões sem ligação nenhuma e muito maiores que os demais (um
// quadro de números ao lado do organograma) ficam numa coluna à parte.
//
// Tudo em "unidades de altura": a largura em % vale `ratio` vezes mais, então x% × ratio = u.
// Funções puras: devolvem lâmina nova.
import { uid } from "../../util";
import type { Para, Run, Shape, ShapeBox, Slide } from "../schema";

export type Orientacao = "baixo" | "lado";

/** O cartão e tudo o que anda com ele (`ids[0]` é o cartão). */
export interface UnidadeH {
  ids: string[];
  box: ShapeBox;
}

export interface EntradaH {
  slide: Slide;
  unidades: UnidadeH[];
  /** traços finos fora dos cartões: os candidatos a conector */
  linhas: Shape[];
  /** conectores de TRAÇO (linha reta ou em cotovelo, só contorno): o PowerPoint e o Conectar os gravam assim */
  tracos?: Shape[];
  ratio: number;
  /** de onde (em %) o arranjo pode começar — abaixo do cabeçalho — e até onde — acima do rodapé */
  topo: number;
  baixo: number;
  /** o que fica onde está e não pode ser coberto (um texto solto ao lado do organograma), em % */
  obstaculos?: ShapeBox[];
}

/** A árvore: índices em `unidades`. */
export interface Arvore {
  /** filho → pai */
  pai: Map<number, number>;
  /** pai → filhos (na ordem de leitura) */
  filhos: Map<number, number[]>;
  nivel: Map<number, number>;
  raizes: number[];
  /** cartões sem ligação nenhuma */
  orfaos: number[];
  /** os traços e ligações que fazem parte da árvore (saem, porque são redesenhados) */
  tracos: Set<string>;
  /** a cor original do ramo que chega a cada filho (o conector azul da SAP continua azul) */
  corDoFilho: Map<number, string>;
}

const MARGEM = 5;
/** Quanto os traços podem estar afastados para contarem como "tocando" (em unidades de altura). */
const TOL_REDE = 1.0;
const TOL_CARTAO = 1.8;
/** Espaços do layout (em unidades de altura): entre irmãos, entre níveis e do cartão ao barramento. */
const VAO_IRMAOS = 2;
const VAO_NIVEL = 6;
const ESCALA_MAX = 1.8;
const PREFIXO = "arr:";

interface Ret {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

const ret = (b: ShapeBox, ratio: number): Ret => ({ x0: b.x * ratio, y0: b.y, x1: (b.x + b.w) * ratio, y1: b.y + b.h });
const toca = (a: Ret, b: Ret, tol: number): boolean => a.x0 - tol <= b.x1 && b.x0 - tol <= a.x1 && a.y0 - tol <= b.y1 && b.y0 - tol <= a.y1;
const centroY = (r: Ret): number => (r.y0 + r.y1) / 2;
const altura = (r: Ret): number => r.y1 - r.y0;

/**
 * O traço ANCORA no cartão: ele termina no MEIO de uma borda, perpendicular a ela (uma haste que
 * sobe ou desce do centro do cartão; um traço que sai do meio do lado). Um traço que só passa rente
 * ao cartão — o separador sob uma fileira, o fio de destaque — encosta, mas não liga.
 */
function ancora(l: Ret, c: Ret): Lado | null {
  const w = l.x1 - l.x0;
  const h = l.y1 - l.y0;
  if (h >= w) {
    const cx = (l.x0 + l.x1) / 2;
    const lo = c.x0 + 0.15 * (c.x1 - c.x0);
    const hi = c.x1 - 0.15 * (c.x1 - c.x0);
    if (cx < lo || cx > hi) return null;
    if (l.y0 <= c.y1 + TOL_CARTAO && l.y1 >= c.y1 - TOL_CARTAO && l.y0 >= c.y0) return "base";
    if (l.y0 <= c.y0 + TOL_CARTAO && l.y1 >= c.y0 - TOL_CARTAO && l.y1 <= c.y1) return "topo";
    return null;
  }
  const cy = (l.y0 + l.y1) / 2;
  const lo = c.y0 + 0.15 * (c.y1 - c.y0);
  const hi = c.y1 - 0.15 * (c.y1 - c.y0);
  if (cy >= lo && cy <= hi) {
    if (l.x0 <= c.x1 + TOL_CARTAO && l.x1 >= c.x1 - TOL_CARTAO && l.x0 >= c.x0) return "dir";
    if (l.x0 <= c.x0 + TOL_CARTAO && l.x1 >= c.x0 - TOL_CARTAO && l.x1 <= c.x1) return "esq";
    return null;
  }
  // um BARRAMENTO que corre rente à borda de cima ou de baixo (a barra de onde descem as hastes dos
  // filhos): vale quando ENCOSTA (até 1,5) no cartão e passa por boa parte da largura dele. O separador que
  // fica um pouco afastado (>1,5) não conta — senão o quadro ao lado viraria pai da fileira.
  const sobreposto = Math.min(l.x1, c.x1) - Math.max(l.x0, c.x0);
  if (sobreposto < 0.3 * (c.x1 - c.x0)) return null;
  if (Math.abs(cy - c.y0) <= 1.5) return "topo";
  if (Math.abs(cy - c.y1) <= 1.5) return "base";
  return null;
}

type Lado = "topo" | "base" | "esq" | "dir";

const mediana = (v: number[]): number => {
  const o = [...v].sort((a, b) => a - b);
  return o.length ? o[Math.floor(o.length / 2)] : 0;
};

// ---------------------------------------------------------------- a árvore

/**
 * A árvore do slide (ou nada, se ele não tem uma hierarquia de pelo menos três cartões em dois
 * níveis). `cartoes[i]` é o cartão (a caixa do contêiner) da unidade `i`.
 */
export function detectarArvore(e: EntradaH): Arvore | null {
  const { unidades, linhas, ratio, slide } = e;
  if (unidades.length < 3) return null;
  const porId = new Map(slide.shapes.map((s) => [s.id, s]));
  const cartao = unidades.map((u) => ret(porId.get(u.ids[0])?.box ?? u.box, ratio));
  const donoDoId = new Map<string, number>();
  unidades.forEach((u, i) => u.ids.forEach((id) => donoDoId.set(id, i)));

  // 1) as redes de traços: união dos que se tocam
  const r = linhas.map((l) => ret(l.box, ratio));
  const raiz = linhas.map((_, i) => i);
  const achar = (i: number): number => (raiz[i] === i ? i : (raiz[i] = achar(raiz[i])));
  for (let i = 0; i < linhas.length; i++) for (let j = i + 1; j < linhas.length; j++) if (toca(r[i], r[j], TOL_REDE)) raiz[achar(i)] = achar(j);
  const redes = new Map<number, number[]>();
  linhas.forEach((_, i) => redes.set(achar(i), [...(redes.get(achar(i)) ?? []), i]));

  const arestas: [number, number][] = [];
  const tracos = new Set<string>();
  // o lado do cartão em que cada traço termina (ancorado), por cartão
  const lados = linhas.map((_, m) => unidades.map((_, i) => ancora(r[m], cartao[i])));
  // as redes que ligam vários cartões saem: viram lixo solto quando os cartões se mexem (um separador
  // sob uma fileira também) — mesmo as que não geram aresta
  for (const membros of redes.values()) {
    const tocados = new Set<number>();
    for (const m of membros) lados[m].forEach((l, i) => l && tocados.add(i));
    if (tocados.size >= 2) membros.forEach((m) => tracos.add(linhas[m].id));
  }
  // vizinhança entre traços (se tocam)
  const viz = linhas.map(() => [] as number[]);
  for (let a = 0; a < linhas.length; a++) for (let b = a + 1; b < linhas.length; b++) if (toca(r[a], r[b], TOL_REDE)) (viz[a].push(b), viz[b].push(a));
  // O PAI de um cartão: caminhando pelos traços a partir da haste de CIMA (ou da esquerda) dele, o primeiro
  // cartão cuja haste de BAIXO (ou da direita) é alcançada. Numa rede emendada (a haste do gerente, o
  // barramento do supervisor e uma linha em L até outro cartão) o caminho mais curto é o que diz quem
  // é o pai — e não "o cartão mais alto da rede", que faria do gerente pai de todos.
  for (let f = 0; f < unidades.length; f++) {
    const entrada = linhas.map((_, m) => m).filter((m) => lados[m][f] === "topo" || lados[m][f] === "esq");
    if (!entrada.length) continue;
    const visto = new Set<number>(entrada);
    let fila = entrada;
    let achado = -1;
    for (let passo = 0; passo < 14 && fila.length && achado < 0; passo++) {
      const candidatos: number[] = [];
      for (const m of fila) {
        for (let p = 0; p < unidades.length; p++) {
          if (p === f) continue;
          const sai = lados[m][p];
          const acima = sai === "base" && centroY(cartao[p]) < centroY(cartao[f]) - 0.5 * altura(cartao[p]);
          const aEsquerda = sai === "dir" && (cartao[p].x0 + cartao[p].x1) / 2 < (cartao[f].x0 + cartao[f].x1) / 2 - 0.5 * (cartao[p].x1 - cartao[p].x0);
          if (acima || aEsquerda) candidatos.push(p);
        }
      }
      if (candidatos.length) {
        // vários na mesma distância: o mais perto do filho
        achado = candidatos.sort((a, b) => Math.abs(centroY(cartao[f]) - centroY(cartao[a])) - Math.abs(centroY(cartao[f]) - centroY(cartao[b])))[0];
        break;
      }
      const proxima: number[] = [];
      for (const m of fila) for (const n of viz[m]) if (!visto.has(n)) (visto.add(n), proxima.push(n));
      fila = proxima;
    }
    if (achado >= 0) arestas.push([achado, f]);
  }
  // 1b) os conectores de TRAÇO: cada ponta encosta num cartão (a diagonal da caixa liga os dois); o de cima
  // (ou o da esquerda, se estão lado a lado) é o pai. Não precisa de rede: um conector liga exatamente dois.
  const corDoFilho = new Map<number, string>();
  const cartaoEm = (x: number, y: number): number => {
    let melhor = -1;
    let areaMelhor = Infinity;
    cartao.forEach((c, i) => {
      if (x < c.x0 - TOL_CARTAO || x > c.x1 + TOL_CARTAO || y < c.y0 - TOL_CARTAO || y > c.y1 + TOL_CARTAO) return;
      const a = (c.x1 - c.x0) * (c.y1 - c.y0);
      if (a < areaMelhor) (melhor = i, areaMelhor = a);
    });
    return melhor;
  };
  for (const t of e.tracos ?? []) {
    const b = ret(t.box, ratio);
    // a diagonal PRINCIPAL é a que o espelhamento diz (sem espelho: do canto de cima-esquerda ao de baixo-direita;
    // espelhado só na horizontal OU só na vertical: a outra); a segunda só vale se a principal não achar dois cartões
    const principal: [number, number, number, number] = !!t.flipH !== !!t.flipV ? [b.x1, b.y0, b.x0, b.y1] : [b.x0, b.y0, b.x1, b.y1];
    const secundaria: [number, number, number, number] = !!t.flipH !== !!t.flipV ? [b.x0, b.y0, b.x1, b.y1] : [b.x1, b.y0, b.x0, b.y1];
    const diagonais = [principal, secundaria];
    let par: [number, number] | null = null;
    for (const [ax, ay, cx, cy] of diagonais) {
      const i = cartaoEm(ax, ay);
      const j = cartaoEm(cx, cy);
      if (i >= 0 && j >= 0 && i !== j) {
        par = [i, j];
        break;
      }
    }
    if (!par) continue;
    let [pai, filho] = par;
    const dy = centroY(cartao[filho]) - centroY(cartao[pai]);
    if (Math.abs(dy) > 0.5 * altura(cartao[pai])) {
      if (dy < 0) [pai, filho] = [filho, pai];
    } else if (cartao[pai].x0 > cartao[filho].x0) {
      [pai, filho] = [filho, pai];
    }
    arestas.push([pai, filho]);
    tracos.add(t.id);
    const cor = t.ln?.grad?.stops?.[t.ln.grad.stops.length - 1]?.color ?? t.ln?.color;
    if (cor) corDoFilho.set(filho, cor);
  }
  // 2) as ligações nativas do Conectar: o extremo de cima é o pai
  for (const s of slide.shapes) {
    if (!s.liga) continue;
    const a = donoDoId.get(s.liga.de);
    const b = donoDoId.get(s.liga.para);
    if (a === undefined || b === undefined || a === b) continue;
    const [pai, filho] = centroY(cartao[a]) <= centroY(cartao[b]) ? [a, b] : [b, a];
    if (centroY(cartao[filho]) - centroY(cartao[pai]) <= 0.5 * altura(cartao[pai])) continue;
    arestas.push([pai, filho]);
    tracos.add(s.id);
  }

  // 3) um pai por filho (o mais próximo acima) e os níveis
  const pai = new Map<number, number>();
  for (const [p, f] of arestas) {
    const atual = pai.get(f);
    if (atual === undefined || Math.abs(centroY(cartao[f]) - centroY(cartao[p])) < Math.abs(centroY(cartao[f]) - centroY(cartao[atual]))) pai.set(f, p);
  }
  // 3b) cartões EMPILHADOS sem conector entre eles (o gerente e o supervisor, um logo abaixo do outro,
  // alinhados): o de baixo é filho do de cima — a hierarquia está na posição, não no traço
  const comArvore = new Set<number>([...pai.keys(), ...pai.values()]);
  for (const f of [...comArvore].filter((i) => !pai.has(i))) {
    const F = cartao[f];
    const candidatos = [...comArvore]
      .filter((i) => i !== f && centroY(cartao[i]) < centroY(F) && F.y0 - cartao[i].y1 >= -0.5 && F.y0 - cartao[i].y1 <= 1.0 * altura(cartao[i]))
      .filter((i) => Math.min(cartao[i].x1, F.x1) - Math.max(cartao[i].x0, F.x0) >= 0.6 * Math.min(cartao[i].x1 - cartao[i].x0, F.x1 - F.x0));
    if (!candidatos.length) continue;
    const p = candidatos.sort((a, b) => F.y0 - cartao[a].y1 - (F.y0 - cartao[b].y1))[0];
    // não vira filho de um descendente dele mesmo
    let anc: number | undefined = p;
    let ciclo = false;
    while (anc !== undefined) {
      if (anc === f) ciclo = true;
      anc = pai.get(anc);
    }
    if (!ciclo) pai.set(f, p);
  }
  const filhos = new Map<number, number[]>();
  for (const [f, p] of pai) filhos.set(p, [...(filhos.get(p) ?? []), f]);
  for (const [p, lista] of filhos) filhos.set(p, lista.sort((a, b) => cartao[a].x0 - cartao[b].x0));
  const naArvore = new Set<number>([...pai.keys(), ...pai.values()]);
  const raizes = [...naArvore].filter((i) => !pai.has(i)).sort((a, b) => cartao[a].x0 - cartao[b].x0);
  const nivel = new Map<number, number>();
  const descer = (i: number, n: number): void => {
    nivel.set(i, n);
    for (const f of filhos.get(i) ?? []) descer(f, n + 1);
  };
  raizes.forEach((i) => descer(i, 0));
  const profundidade = Math.max(-1, ...nivel.values()) + 1;
  if (naArvore.size < 3 || profundidade < 2) return null;
  const orfaos = unidades.map((_, i) => i).filter((i) => !naArvore.has(i));
  return { pai, filhos, nivel, raizes, orfaos, tracos, corDoFilho };
}

// ---------------------------------------------------------------- o texto acompanha o cartão

function escalaDoTexto(s: Shape, k: number): Shape {
  const fonte = (t: number | undefined): number | undefined => (t ? Math.max(Math.min(t, 6), Math.round(t * k * 10) / 10) : t);
  return {
    ...s,
    fontSize: fonte(s.fontSize) ?? s.fontSize,
    paras: s.paras ? s.paras.map((p: Para) => ({ ...p, runs: p.runs.map((r: Run) => ({ ...r, size: fonte(r.size) ?? r.size })) })) : s.paras,
  };
}

// ---------------------------------------------------------------- o layout

interface No {
  i: number;
  nivel: number;
  /** tamanho na régua (s = ao longo dos irmãos, l = ao longo dos níveis), em unidades de altura */
  s: number;
  l: number;
  /** a posição do centro no eixo dos irmãos */
  cs: number;
}

/** O estilo do conector: a cor e a espessura dos traços originais (ou o acento e um fio). */
function estiloDoConector(e: EntradaH, arv: Arvore): { cor: string; espessura: number } {
  const usados = e.linhas.filter((l) => arv.tracos.has(l.id));
  const tracos = (e.tracos ?? []).filter((t) => arv.tracos.has(t.id));
  // a cor: o preenchimento dos traços finos; senão o contorno dos conectores de traço; senão a da ligação
  // nativa; senão o verde padrão. (Um conector reto tem largura 0 e entra nas duas listas — só vale a cor
  // que ele de fato tem.)
  const cor = usados.map((l) => (l.fillX?.kind === "solid" ? l.fillX.color : l.fill)).find((c): c is string => !!c)
    ?? tracos.map((t) => t.ln?.color).find((c): c is string => !!c)
    ?? e.slide.shapes.filter((s) => s.liga && arv.tracos.has(s.id)).map((s) => s.ln?.color).find((c): c is string => !!c)
    ?? "18A303";
  const espessuras = usados.filter((l) => (l.fillX?.kind === "solid" ? l.fillX.color : l.fill)).map((l) => Math.min(l.box.w * e.ratio, l.box.h));
  // os conectores de traço guardam a espessura em pt (a lâmina tem 540 pt de altura: 1 pt = 0,185 u)
  const doTraco = tracos.map((t) => (t.ln?.w ?? 1.5) / 5.4);
  const t = espessuras.length ? mediana(espessuras) : doTraco.length ? mediana(doTraco) : 0.35;
  return { cor, espessura: Math.max(0.25, Math.min(0.7, t)) };
}

/**
 * A lâmina com a hierarquia redesenhada. `orientacao`: "baixo" (a raiz em cima, os níveis descem)
 * ou "lado" (a raiz à esquerda, os níveis vão para a direita).
 */
export function aplicarHierarquia(e: EntradaH, arv: Arvore, orientacao: Orientacao): Slide {
  const { slide, unidades, ratio } = e;
  const porId = new Map(slide.shapes.map((s) => [s.id, s]));
  const contêiner = (i: number): Shape => porId.get(unidades[i].ids[0])!;
  const baixo = orientacao === "baixo";
  /** o tamanho de um cartão na régua (irmãos, níveis) */
  const medida = (b: ShapeBox): { s: number; l: number } => (baixo ? { s: b.w * ratio, l: b.h } : { s: b.h, l: b.w * ratio });

  // os cartões grandes e sem ligação (um quadro de números) ficam numa coluna à parte
  const areaMediana = mediana([...arv.nivel.keys()].map((i) => contêiner(i).box.w * ratio * contêiner(i).box.h));
  const aparte = arv.orfaos.filter((i) => contêiner(i).box.w * ratio * contêiner(i).box.h >= 1.4 * areaMediana);
  const fileira = arv.orfaos.filter((i) => !aparte.includes(i)).sort((a, b) => contêiner(a).box.x - contêiner(b).box.x);

  // os níveis: os da árvore + a fileira dos cartões sem ligação no fim
  const nos = new Map<number, No>();
  for (const [i, n] of arv.nivel) {
    const m = medida(contêiner(i).box);
    nos.set(i, { i, nivel: n, s: m.s, l: m.l, cs: 0 });
  }
  const niveis = Math.max(...arv.nivel.values()) + 1;
  const nivelDaFileira = fileira.length ? niveis : -1;
  for (const i of fileira) {
    const m = medida(contêiner(i).box);
    nos.set(i, { i, nivel: nivelDaFileira, s: m.s, l: m.l, cs: 0 });
  }
  const total = niveis + (fileira.length ? 1 : 0);
  // as caixas do mesmo nível têm o mesmo tamanho: o do maior
  const tamNivel = Array.from({ length: total }, (_, n) => {
    const doNivel = [...nos.values()].filter((x) => x.nivel === n);
    return { s: Math.max(...doNivel.map((x) => x.s)), l: Math.max(...doNivel.map((x) => x.l)) };
  });

  // a largura de cada subárvore e a posição dos centros (os filhos centrados sob o pai)
  const largura = (i: number): number => {
    const f = arv.filhos.get(i) ?? [];
    const bloco = f.reduce((a, c) => a + largura(c), 0) + VAO_IRMAOS * Math.max(0, f.length - 1);
    return Math.max(tamNivel[nos.get(i)!.nivel].s, bloco);
  };
  const colocar = (i: number, inicio: number): void => {
    const f = arv.filhos.get(i) ?? [];
    const w = largura(i);
    if (!f.length) {
      nos.get(i)!.cs = inicio + w / 2;
      return;
    }
    const bloco = f.reduce((a, c) => a + largura(c), 0) + VAO_IRMAOS * (f.length - 1);
    let x = inicio + (w - bloco) / 2;
    for (const c of f) {
      colocar(c, x);
      x += largura(c) + VAO_IRMAOS;
    }
    nos.get(i)!.cs = (nos.get(f[0])!.cs + nos.get(f[f.length - 1])!.cs) / 2;
  };
  let cursor = 0;
  for (const r of arv.raizes) {
    colocar(r, cursor);
    cursor += largura(r) + VAO_IRMAOS * 1.5;
  }
  const larguraArvore = Math.max(0, cursor - VAO_IRMAOS * 1.5);
  // a fileira dos sem ligação, centrada sob a árvore
  // (a caixa de cada um é desenhada com o tamanho do NÍVEL — o do maior —, então o espaço dele é esse)
  const tamFileira = fileira.length ? tamNivel[nivelDaFileira].s : 0;
  const larguraFileira = fileira.length * tamFileira + VAO_IRMAOS * Math.max(0, fileira.length - 1);
  const larguraTotal = Math.max(larguraArvore, larguraFileira);
  const deslocArvore = (larguraTotal - larguraArvore) / 2;
  for (const [i, n] of nos) if (n.nivel !== nivelDaFileira) n.cs += deslocArvore;
  if (fileira.length) {
    let x = (larguraTotal - larguraFileira) / 2;
    for (const i of fileira) {
      nos.get(i)!.cs = x + tamFileira / 2;
      x += tamFileira + VAO_IRMAOS;
    }
  }
  const alturaTotal = tamNivel.reduce((a, t) => a + t.l, 0) + VAO_NIVEL * (total - 1);

  // a região disponível (em unidades de altura); a coluna à parte tira largura dela
  const esq = MARGEM * ratio;
  const dir = (100 - MARGEM) * ratio;
  const regiaoBaixo = e.baixo;
  const colunaAparte = aparte.length ? Math.min(0.24 * 100 * ratio, Math.max(...aparte.map((i) => contêiner(i).box.w * ratio))) : 0;
  const aparteNaDireita = aparte.length ? aparte.reduce((a, i) => a + (contêiner(i).box.x + contêiner(i).box.w / 2), 0) / aparte.length >= 50 : true;

  /** A escala e a origem para uma região (x0..x1 em unidades de altura; a partir de `topoRegiao` em %). */
  const regiaoCom = (x0: number, x1: number, topoRegiao: number) => {
    const dispS = baixo ? x1 - x0 : regiaoBaixo - topoRegiao;
    const dispL = baixo ? regiaoBaixo - topoRegiao : x1 - x0;
    const k = Math.min(1.15, dispS / larguraTotal, dispL / alturaTotal);
    return {
      k,
      x0,
      x1,
      topo: topoRegiao,
      origemS: (baixo ? x0 : topoRegiao) + (dispS - larguraTotal * k) / 2,
      origemL: (baixo ? topoRegiao : x0) + Math.min(2, (dispL - alturaTotal * k) / 2),
    };
  };
  const xe = esq + (aparte.length && !aparteNaDireita ? colunaAparte + 3 : 0);
  const xd = dir - (aparte.length && aparteNaDireita ? colunaAparte + 3 : 0);
  // a posição de cada nível no eixo dos níveis
  const inicioNivel: number[] = [];
  let lNivel = 0;
  for (let n = 0; n < total; n++) {
    inicioNivel.push(lNivel);
    lNivel += tamNivel[n].l + VAO_NIVEL;
  }
  /** A caixa (em %) de um nó numa região — para conferir, pela posição REAL, se ele encosta num texto fixo. */
  const caixaNa = (no: No, r: { k: number; origemS: number; origemL: number }): ShapeBox => {
    const t = tamNivel[no.nivel];
    const s0 = r.origemS + (no.cs - t.s / 2) * r.k;
    const l0 = r.origemL + inicioNivel[no.nivel] * r.k;
    return baixo ? { x: s0 / ratio, y: l0, w: (t.s * r.k) / ratio, h: t.l * r.k } : { x: l0 / ratio, y: s0, w: (t.l * r.k) / ratio, h: t.s * r.k };
  };
  const batem = (a: ShapeBox, b: ShapeBox): boolean => a.x < b.x + b.w + 0.8 && b.x < a.x + a.w + 0.8 && a.y < b.y + b.h + 0.8 && b.y < a.y + a.h + 0.8;
  // o que fica onde está (um texto ao lado do organograma) não pode ficar sob os cartões: vale a região de
  // MAIOR escala cujos nós, na posição real, não batem em nenhum deles. A região inteira também é candidata —
  // a árvore centrada pode passar longe do título que está num canto, mesmo que o retângulo o cruze.
  const obstaculos = (e.obstaculos ?? []).filter((o) => o.y < regiaoBaixo && o.y + o.h > e.topo);
  const livreDeObstaculos = (r: { k: number; origemS: number; origemL: number }): boolean => ![...nos.values()].some((no) => obstaculos.some((o) => batem(caixaNa(no, r), o)));
  const candidatas = [regiaoCom(xe, xd, e.topo)].filter(livreDeObstaculos);
  if (obstaculos.length) {
    const aEsq = obstaculos.filter((o) => o.x + o.w / 2 < 50);
    const aDir = obstaculos.filter((o) => o.x + o.w / 2 >= 50);
    const xe2 = Math.max(xe, ...aEsq.map((o) => (o.x + o.w) * ratio + 2));
    const xd2 = Math.min(xd, ...aDir.map((o) => o.x * ratio - 2));
    if (xd2 - xe2 > 20) candidatas.push(regiaoCom(xe2, xd2, e.topo));
    candidatas.push(regiaoCom(xe, xd, Math.min(regiaoBaixo - 20, Math.max(e.topo, ...obstaculos.map((o) => o.y + o.h + 1.5)))));
  }
  // (a de baixo do último obstáculo e a que desvia pelos lados não batem por construção)
  const reg = candidatas.reduce((a, c) => (c.k > a.k + 0.02 ? c : a));
  const { k, origemS, origemL } = reg;
  const regiaoL0 = reg.topo;
  const regiaoL1 = regiaoBaixo;

  // as caixas novas dos cartões (em %) e o conteúdo de cada um, escalado junto
  const caixas = new Map<string, ShapeBox>();
  const escala = new Map<string, number>();
  const colocarUnidade = (i: number, B: ShapeBox): void => {
    const c = contêiner(i);
    const ku = Math.min(ESCALA_MAX, (B.w * ratio) / (c.box.w * ratio), B.h / c.box.h);
    const ccx = c.box.x + c.box.w / 2;
    const ccy = c.box.y + c.box.h / 2;
    for (const id of unidades[i].ids) {
      const s = porId.get(id)!;
      escala.set(id, ku);
      if (id === c.id) {
        caixas.set(id, B);
        continue;
      }
      // o conteúdo gira em torno do centro do cartão: sai exatamente onde estava, só menor/maior
      const cx = s.box.x + s.box.w / 2;
      const cy = s.box.y + s.box.h / 2;
      const w = s.box.w * ku;
      const h = s.box.h * ku;
      caixas.set(id, { x: B.x + B.w / 2 + (cx - ccx) * ku - w / 2, y: B.y + B.h / 2 + (cy - ccy) * ku - h / 2, w, h });
    }
  };
  const caixaDoNo = new Map<number, ShapeBox>();
  for (const n of nos.values()) {
    const t = tamNivel[n.nivel];
    const s0 = origemS + (n.cs - t.s / 2) * k;
    const l0 = origemL + inicioNivel[n.nivel] * k;
    const B: ShapeBox = baixo ? { x: s0 / ratio, y: l0, w: (t.s * k) / ratio, h: t.l * k } : { x: l0 / ratio, y: s0, w: (t.l * k) / ratio, h: t.s * k };
    caixaDoNo.set(n.i, B);
    colocarUnidade(n.i, B);
  }
  // a coluna à parte: empilhada, centrada na altura, do lado de onde veio
  if (aparte.length) {
    const kA = Math.min(1, colunaAparte / Math.max(...aparte.map((i) => contêiner(i).box.w * ratio)));
    const alturas = aparte.map((i) => contêiner(i).box.h * kA);
    const pilha = alturas.reduce((a, h) => a + h, 0) + VAO_IRMAOS * (aparte.length - 1);
    let y = regiaoL0 + Math.max(0, (regiaoL1 - regiaoL0 - pilha) / 2);
    aparte.forEach((i, idx) => {
      const c = contêiner(i);
      const w = c.box.w * kA;
      const B: ShapeBox = { x: (aparteNaDireita ? dir - colunaAparte / 2 : esq + colunaAparte / 2) / ratio - w / 2, y, w, h: alturas[idx] };
      colocarUnidade(i, B);
      y += alturas[idx] + VAO_IRMAOS;
    });
  }

  // os conectores novos: haste, barramento e descidas, no estilo dos antigos
  const { cor, espessura } = estiloDoConector(e, arv);
  const fio = (x: number, y: number, w: number, h: number, corDele?: string): Shape => ({
    id: uid(),
    kind: "forma",
    box: { x, y, w, h },
    text: "",
    fontFamily: "",
    fontSize: 12,
    color: corDele ?? cor,
    bold: false,
    italic: false,
    align: "esquerda",
    fill: corDele ?? cor,
    fillX: { kind: "solid", color: corDele ?? cor, alpha: 1 },
    src: "",
    rot: 0,
    geom: "rect",
    name: `${PREFIXO}conector`,
  });
  const tx = espessura / ratio; // a espessura em % da largura
  const ty = espessura; // e em % da altura
  const fios: Shape[] = [];
  const horizontal = (xa: number, xb: number, y: number, c?: string): void => {
    const a = Math.min(xa, xb) - tx / 2;
    fios.push(fio(a, y - ty / 2, Math.abs(xb - xa) + tx, ty, c));
  };
  const vertical = (x: number, ya: number, yb: number, c?: string): void => {
    const a = Math.min(ya, yb) - ty / 2;
    fios.push(fio(x - tx / 2, a, tx, Math.abs(yb - ya) + ty, c));
  };
  for (const [p, filhos] of arv.filhos) {
    const P = caixaDoNo.get(p)!;
    const Fs = filhos.map((c) => caixaDoNo.get(c)!);
    if (baixo) {
      const saida = P.y + P.h;
      const entrada = Math.min(...Fs.map((f) => f.y));
      const barra = saida + (entrada - saida) / 2;
      const px = P.x + P.w / 2;
      const cxs = Fs.map((f) => f.x + f.w / 2);
      if (Fs.length === 1 && Math.abs(cxs[0] - px) < 0.3) {
        vertical(px, saida, entrada, arv.corDoFilho.get(filhos[0]));
        continue;
      }
      vertical(px, saida, barra);
      horizontal(Math.min(px, ...cxs), Math.max(px, ...cxs), barra);
      Fs.forEach((f, i) => vertical(cxs[i], barra, f.y, arv.corDoFilho.get(filhos[i])));
    } else {
      const saida = P.x + P.w;
      const entrada = Math.min(...Fs.map((f) => f.x));
      const barra = saida + (entrada - saida) / 2;
      const py = P.y + P.h / 2;
      const cys = Fs.map((f) => f.y + f.h / 2);
      if (Fs.length === 1 && Math.abs(cys[0] - py) < 0.3) {
        horizontal(saida, entrada, py, arv.corDoFilho.get(filhos[0]));
        continue;
      }
      horizontal(saida, barra, py);
      vertical(barra, Math.min(py, ...cys), Math.max(py, ...cys));
      Fs.forEach((f, i) => horizontal(barra, f.x, cys[i], arv.corDoFilho.get(filhos[i])));
    }
  }

  // a lâmina: sem os traços antigos e sem os conectores de uma arrumação anterior; os novos ficam
  // logo depois das decorações, ATRÁS dos cartões
  const restantes = slide.shapes
    .filter((s) => !arv.tracos.has(s.id) && !s.name?.startsWith(PREFIXO))
    .map((s) => {
      const caixa = caixas.get(s.id);
      return caixa ? { ...escalaDoTexto(s, escala.get(s.id) ?? 1), box: caixa } : s;
    });
  const primeiraViva = restantes.findIndex((s) => !s.fixa);
  const corte = primeiraViva < 0 ? restantes.length : primeiraViva;
  return { ...slide, shapes: [...restantes.slice(0, corte), ...fios, ...restantes.slice(corte)] };
}
