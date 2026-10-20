// Compor a lâmina: gera uma composição NOVA a partir do conteúdo — o caminho do Designer, não o de
// "empurrar o que já existe". A lâmina é lida em GRUPOS (título com antetítulo/subtítulo, cada coluna
// de conteúdo, rodapé, diagrama), a decoração antiga (painéis de fundo, cartões, filetes) é podada e o
// conteúdo é recolocado em padrões de página (cartões, faixas, destaque, grade) desenhados na hora.
//
// O texto nunca vaza por construção: cada grupo anda e escala INTEIRO (as caixas e as letras na mesma
// proporção), e o grupo só entra num espaço se a escala respeitar o piso de 9 pt do texto de conteúdo.
// Por isso não há reflow de parágrafo nem estimativa de linha: o desenho interno do bloco é preservado.
//
// Função pura: devolve lâmina nova. Só a lâmina que recebe muda — quem chama é a Arrumação do painel.
import type { Fill, Shape, ShapeBox, Slide } from "../schema";
import { formasDeArte, type ArteId } from "./arte";
import { fonteCss, razaoDeLinha } from "../render/forma";

/** Margens e vãos em % da lâmina. */
const MARGEM = 4.5;
const VAO = 2.6;
/** Piso da letra de conteúdo (pt): o grupo não entra num espaço que a leve abaixo disto. */
const PISO_LETRA = 9;
/** A partir disto a imagem é fundo/painel (decoração da composição antiga). */
const AREA_PAINEL = 12;
/** Abaixo disto a forma é ícone/filete e anda junto do grupo. */
const ALCANCE_ICONE = 6;
const ENCOSTA = 2.2;

// ---------------------------------------------------------------------------
// conteúdo
// ---------------------------------------------------------------------------

interface Grupo {
  /** formas que andam juntas (textos e o diagrama) */
  ids: string[];
  /** ícones presos ao grupo (andam junto, não contam para a caixa) */
  presos: string[];
  box: ShapeBox;
}

interface Conteudo {
  titulo: Grupo | null;
  grupos: Grupo[];
  rodape: Grupo | null;
  /** imagens grandes da composição antiga (painéis, cartões, arte) — podadas */
  paineis: Shape[];
}

const txt = (s: Shape): string => (s.paras ?? []).flatMap((p) => p.runs.map((r) => r.text ?? "")).join("").trim();
const temTexto = (s: Shape): boolean => !!txt(s);
const maiorLetra = (s: Shape): number => Math.max(s.fontSize || 0, ...(s.paras ?? []).flatMap((p) => p.runs.map((r) => r.size ?? 0)));
const ehImagem = (s: Shape): boolean => s.kind === "imagem" || !!s.src;
const area = (b: ShapeBox): number => b.w * b.h;

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
const distancia = (a: ShapeBox, b: ShapeBox): number => {
  const ca = centro(a);
  const cb = centro(b);
  return Math.hypot(ca.x - cb.x, ca.y - cb.y);
};
/** Quanto duas caixas se sobrepõem na horizontal, em % da menor. */
const sobreX = (a: ShapeBox, b: ShapeBox): number => {
  const w = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
  return w <= 0 ? 0 : w / Math.max(0.01, Math.min(a.w, b.w));
};
/** Quanto duas caixas se sobrepõem, em % da menor delas. */
const sobreposicao = (a: ShapeBox, b: ShapeBox): number => {
  const w = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
  const h = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
  if (w <= 0 || h <= 0) return 0;
  return (w * h) / Math.max(0.01, Math.min(area(a), area(b)));
};
const encosta = (a: ShapeBox, b: ShapeBox, folga = ENCOSTA): boolean =>
  a.x - folga <= b.x + b.w && b.x - folga <= a.x + a.w && a.y - folga <= b.y + b.h && b.y - folga <= a.y + a.h;

/**
 * A lâmina em grupos. Título e rodapé saem pelas faixas (como no resto do app); o conteúdo é
 * agrupado por COLUNAS (quem se sobrepõe no eixo X) e, dentro da coluna, pelos vãos verticais — é o
 * que separa "três cartões lado a lado" de "um cartão com três parágrafos".
 */
export function analisar(slide: Slide): Conteudo {
  const vivas = slide.shapes.filter((s) => !s.fixa && !s.liga && !s.oculta);
  const textos = vivas.filter((s) => temTexto(s) && s.kind !== "imagem" && !s.tabela && !s.grafico);
  // painéis são as imagens de fundo/cartão — mas mídia (vídeo/áudio) NÃO é painel: nunca é podada
  const paineis = vivas.filter((s) => ehImagem(s) && !temTexto(s) && !s.midia && area(s.box) >= AREA_PAINEL);
  const usados = new Set<string>();
  const grupo = (ids: string[]): Grupo => {
    ids.forEach((id) => usados.add(id));
    const formas = ids.map((id) => slide.shapes.find((s) => s.id === id)).filter((s): s is Shape => !!s);
    return { ids: [...ids], presos: [], box: caixaDe(formas.map((s) => s.box)) };
  };

  // ---- título: o(s) texto(s) grande(s) da faixa de cima + o antetítulo/subtítulo que o acompanham
  const daFaixa = textos.filter((t) => t.box.y + t.box.h / 2 < 34);
  const maiorDaFaixa = Math.max(0, ...daFaixa.map(maiorLetra));
  const tituloIds = new Set(daFaixa.filter((t) => maiorLetra(t) >= Math.max(14, maiorDaFaixa * 0.72)).map((t) => t.id));
  let titulo: Grupo | null = null;
  if (tituloIds.size) {
    const caixaTitulo = caixaDe(textos.filter((t) => tituloIds.has(t.id)).map((t) => t.box));
    for (const t of textos) {
      if (tituloIds.has(t.id)) continue;
      const perto = t.box.y + t.box.h > caixaTitulo.y - 4 && t.box.y < caixaTitulo.y + caixaTitulo.h + 4.5;
      const sobre = sobreX(t.box, caixaTitulo);
      if (perto && sobre > 0.5) tituloIds.add(t.id);
    }
    titulo = grupo([...tituloIds]);
  }

  // ---- rodapé: os textos da faixa de baixo
  const rodapeIds = textos.filter((t) => !usados.has(t.id) && t.box.y >= 76).map((t) => t.id);
  const rodape = rodapeIds.length ? grupo(rodapeIds) : null;

  // ---- diagrama: um bloco de formas sem texto que ocupa a lâmina (organograma, quadro) anda inteiro,
  // levando junto os textos de dentro. É conteúdo desenhado, não uma coluna de texto.
  // painéis são fundo, não diagrama: sem esta exclusão os cartões de fundo "grudam" e engolem o texto todo
  const soltas = vivas.filter((s) => !usados.has(s.id) && !temTexto(s) && !paineis.includes(s));
  let diagrama: Grupo | null = null;
  for (const g of agrupar(soltas)) {
    if (g.length < 4) continue;
    const caixa = caixaDe(g.map((s) => s.box));
    if (area(caixa) < 25) continue;
    const dentro = textos.filter((t) => !usados.has(t.id) && contem(caixa, t.box)).map((t) => t.id);
    if (dentro.length) {
      diagrama = grupo([...g.map((s) => s.id), ...dentro]);
      break;
    }
  }

  // ---- conteúdo: o resto, em colunas (sobreposição no eixo X) e grupos (vãos verticais)
  const restantes = textos.filter((t) => !usados.has(t.id));
  const grupos: Grupo[] = [];
  for (const col of colunasDe(restantes)) {
    const ordenadas = [...col].sort((a, b) => a.box.y - b.box.y);
    let atual: Shape[] = [];
    const fechar = () => {
      if (atual.length) grupos.push(grupo(atual.map((s) => s.id)));
      atual = [];
    };
    for (const t of ordenadas) {
      const ultimo = atual[atual.length - 1];
      if (ultimo && t.box.y - (ultimo.box.y + ultimo.box.h) > 5) fechar();
      atual.push(t);
    }
    fechar();
  }
  if (diagrama) grupos.push(diagrama);

  // ---- ícones e miudezas: presos ao grupo mais próximo (dentro dele vale distância 0)
  const todos = [...(titulo ? [titulo] : []), ...grupos, ...(rodape ? [rodape] : [])];
  for (const s of vivas) {
    if (usados.has(s.id) || paineis.includes(s)) continue;
    let melhor: Grupo | null = null;
    let d = Infinity;
    for (const g of todos) {
      const dd = contem(g.box, s.box) ? 0 : distancia(g.box, s.box);
      if (dd < d) {
        d = dd;
        melhor = g;
      }
    }
    if (melhor && d <= ALCANCE_ICONE) {
      melhor.presos.push(s.id);
      usados.add(s.id);
    }
  }

  // ---- painel de fundo de UM grupo (o cartão do rodapé, por exemplo) anda com ele: senão o texto
  // muda de lugar e o fundo fica para trás
  const todosGrupos = [...(titulo ? [titulo] : []), ...grupos, ...(rodape ? [rodape] : [])];
  const presosDePainel = new Set<string>();
  for (const p of paineis) {
    if (usados.has(p.id)) continue;
    const dentro = textos.filter((t) => contem(p.box, t.box));
    if (!dentro.length) continue;
    const dono = todosGrupos.find((g) => dentro.every((t) => g.ids.includes(t.id)));
    if (dono) {
      dono.presos.push(p.id);
      usados.add(p.id);
      presosDePainel.add(p.id);
    }
  }

  return { titulo, grupos, rodape, paineis: paineis.filter((p) => !presosDePainel.has(p.id)) };
}

/** Colunas naturais: duas formas estão na mesma coluna quando se sobrepõem no eixo X. */
function colunasDe(formas: Shape[]): Shape[][] {
  if (!formas.length) return [];
  const colunas: Shape[][] = [];
  for (const s of [...formas].sort((a, b) => a.box.x - b.box.x)) {
    const col = colunas.find((c) => sobreX(s.box, caixaDe(c.map((f) => f.box))) > 0.55);
    if (col) col.push(s);
    else colunas.push([s]);
  }
  return colunas;
}

/** Agrupa as formas que se encostam (união por proximidade). */
function agrupar(formas: Shape[]): Shape[][] {
  const grupos: Shape[][] = [];
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
    if (g.length) grupos.push(g);
  }
  return grupos;
}

// ---------------------------------------------------------------------------
// paleta
// ---------------------------------------------------------------------------

interface Paleta {
  acento: string;
  escuro: string;
  /** quase branco, para os cartões */
  tinta: string;
  /** bem claro, para faixas alternadas */
  suave: string;
}

const rgb = (hex: string): [number, number, number] => {
  const h = hex.replace("#", "");
  const n = h.length === 3 ? h.split("").map((c) => c + c).join("") : h.padEnd(6, "0").slice(0, 6);
  return [parseInt(n.slice(0, 2), 16), parseInt(n.slice(2, 4), 16), parseInt(n.slice(4, 6), 16)];
};
const hex = (r: number, g: number, b: number): string =>
  [r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0")).join("");
const misturar = (a: string, b: string, f: number): string => {
  const [r1, g1, b1] = rgb(a);
  const [r2, g2, b2] = rgb(b);
  return hex(r1 + (r2 - r1) * f, g1 + (g2 - g1) * f, b1 + (b2 - b1) * f);
};
const luminancia = (c: string): number => {
  const [r, g, b] = rgb(c);
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
};
/** Saturação grosseira: serve para separar a cor da marca dos cinzas do texto. */
const saturacao = (c: string): number => {
  const [r, g, b] = rgb(c);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  return max === 0 ? 0 : (max - min) / max;
};

/** A cor da marca: a mais frequente entre os preenchimentos saturados (fora branco/preto/cinza). */
function paletaDe(slide: Slide): Paleta {
  const contagem = new Map<string, number>();
  for (const f of slide.shapes) {
    for (const c of [f.fillX?.kind === "solid" ? f.fillX.color : undefined, f.fill]) {
      if (!c) continue;
      const cor = c.replace("#", "").toUpperCase();
      if (!/^[0-9A-F]{6}$/.test(cor)) continue;
      if (luminancia(cor) > 0.92 || luminancia(cor) < 0.12) continue;
      if (saturacao(cor) < 0.25) continue;
      contagem.set(cor, (contagem.get(cor) ?? 0) + 1);
    }
  }
  const acento = [...contagem.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "0B7A45";
  return {
    acento,
    escuro: misturar(acento, "000000", 0.35),
    tinta: misturar(acento, "FFFFFF", 0.94),
    suave: misturar(acento, "FFFFFF", 0.88),
  };
}

// ---------------------------------------------------------------------------
// desenho
// ---------------------------------------------------------------------------

let sequencia = 0;

interface Estilo {
  paleta: Paleta;
  /** 0 = cartões claros, 1 = faixas, 2 = destaque */
  variante: number;
}

const solido = (color: string): Fill => ({ kind: "solid", color });

/** Uma forma decorativa nova (fundo de cartão, faixa, filete). */
function forma(box: ShapeBox, opts: { fill?: string; ln?: { color: string; w: number; alpha?: number }; cantos?: number; alpha?: number }): Shape {
  const s: Shape = {
    id: `cmp-${++sequencia}`,
    kind: "forma",
    box,
    text: "",
    fontFamily: "",
    fontSize: 12,
    color: "000000",
    bold: false,
    italic: false,
    align: "esquerda",
    fill: opts.fill ?? "",
    src: "",
    rot: 0,
    geom: opts.cantos ? "roundRect" : "rect",
    cantos: opts.cantos ? [opts.cantos, opts.cantos, opts.cantos, opts.cantos] : undefined,
    fillX: opts.fill ? { ...solido(opts.fill), alpha: opts.alpha } : undefined,
    ln: opts.ln ? { color: opts.ln.color, alpha: opts.ln.alpha ?? 1, w: opts.ln.w } : undefined,
  };
  return s;
}

/** A cor do texto é clara? (branco/near-white: foi desenhado para uma faixa colorida) */
const textoClaro = (s: Shape): boolean => {
  const cores = [s.color, ...(s.paras ?? []).flatMap((p) => p.runs.map((r) => r.color))].filter((c): c is string => !!c);
  return cores.length > 0 && cores.some((c) => /^[0-9a-fA-F]{6}$/.test(c.replace("#", "")) && luminancia(c) > 0.86);
};

const cartao = (box: ShapeBox, p: Paleta, faixa: number): Shape[] => {
  const fundo = forma(box, { fill: p.tinta, ln: { color: p.acento, w: 0.75, alpha: 0.28 }, cantos: 1.1 });
  if (faixa <= 0) return [fundo];
  const topo = forma({ ...box, h: Math.min(box.h, faixa) }, { fill: p.acento, cantos: 1.1 });
  // só os cantos de cima arredondados, para encostar no cartão
  topo.cantos = [1.1, 1.1, 0, 0];
  return [fundo, topo];
};

const faixaFundo = (box: ShapeBox, p: Paleta, destaque: boolean, faixa: number): Shape[] => {
  const cor = destaque ? p.tinta : "ffffff";
  const fundo = forma(box, { fill: cor, ln: { color: p.acento, w: 0.6, alpha: 0.16 }, cantos: 0.8 });
  const barra = forma({ x: box.x, y: box.y + 0.5, w: 0.32, h: Math.max(0.8, box.h - 1) }, { fill: p.acento, cantos: 0.16 });
  const partes = [fundo, barra];
  if (faixa > 0) {
    const topo = forma({ ...box, h: Math.min(box.h, faixa) }, { fill: p.acento, cantos: 0.8 });
    topo.cantos = [0.8, 0.8, 0, 0];
    partes.push(topo);
  }
  return partes;
};

/** Escala mínima do grupo para o texto de conteúdo não descer do piso. */
function escalaMinima(slide: Slide, g: Grupo): number {
  const letras = g.ids
    .map((id) => slide.shapes.find((s) => s.id === id))
    .filter((s): s is Shape => !!s && temTexto(s))
    .map(maiorLetra)
    .filter((n) => n >= 10);
  if (!letras.length) return 0.55;
  return Math.max(0.55, PISO_LETRA / Math.min(...letras));
}

/** Aplica o grupo na lâmina: caixa e letra na mesma proporção, nunca abaixo do piso. */
function aplicarGrupo(slide: Slide, g: Grupo, destino: ShapeBox, escala: number, novos: Shape[], cor?: string): void {
  const origem = g.box;
  for (const id of [...g.ids, ...g.presos]) {
    const f = slide.shapes.find((s) => s.id === id);
    if (!f) continue;
    const ehTexto = temTexto(f) && f.kind !== "imagem";
    const escalaLetra = ehTexto ? Math.max(escala, Math.min(1, maiorLetra(f) >= 10 ? PISO_LETRA / Math.max(1, maiorLetra(f)) : 1)) : escala;
    const box: ShapeBox = {
      x: destino.x + (f.box.x - origem.x) * escala,
      y: destino.y + (f.box.y - origem.y) * escala,
      w: Math.max(0.01, f.box.w * escala),
      h: Math.max(0.01, f.box.h * escala),
    };
    const novo: Shape = { ...f, box };
    if (ehTexto && f.paras?.length) {
      novo.fontSize = Math.max(1, f.fontSize * escalaLetra);
      novo.paras = f.paras.map((p) => ({
        ...p,
        runs: p.runs.map((r) => ({ ...r, size: Math.max(1, r.size * escalaLetra), color: cor ?? r.color })),
      }));
      if (cor) novo.color = cor;
    }
    if (f.ln) novo.ln = { ...f.ln, w: Math.max(0.25, f.ln.w * escala) };
    novos.push(novo);
  }
}

/**
 * Monta a lâmina composta. Devolve `null` quando o conteúdo não cabe em nenhum padrão com o texto
 * legível (aí a lâmina fica como está — melhor não mexer do que entregar ilegível).
 */
export function recompor(slide: Slide, ratio: number, variante = 0): Slide {
  // lâmina com vídeo/áudio fica como está: recomposta poderia esconder ou perder a mídia
  if (slide.shapes.some((s) => s.midia)) return slide;
  const c = analisar(slide);
  if (!c.grupos.length || !c.titulo) return slide;
  const p = paletaDe(slide);

  const util = 100 - 2 * MARGEM;
  const escalaTitulo = c.titulo ? Math.min(1, util / Math.max(1, c.titulo.box.w)) : 1;
  const alturaTitulo = c.titulo ? c.titulo.box.h * escalaTitulo : 0;
  const topoConteudo = MARGEM + alturaTitulo + (c.titulo ? 4.6 : 0);
  const escalaRodape = c.rodape ? Math.min(1, util / Math.max(1, c.rodape.box.w)) : 1;
  const alturaRodape = c.rodape ? c.rodape.box.h * escalaRodape : 0;
  const baseConteudo = 100 - MARGEM - (c.rodape ? alturaRodape + 3.2 : 0);
  const alturaUtil = Math.max(8, baseConteudo - topoConteudo);

  interface Colocacao {
    g: Grupo;
    destino: ShapeBox;
    escala: number;
  }
  interface Desenho {
    fundos: Shape[];
    /** conteúdo re-tipografado (já posicionado) */
    conteudo?: Shape[];
    /** ou blocos inteiros só movidos/escalados */
    colocacoes?: Colocacao[];
    /** o padrão já posicionou o título (não colocar de novo no fim) */
    tituloProprio?: boolean;
    /** o fundo do padrão é escuro (rodapé e textos do título precisam ser claros) */
    fundoEscuro?: boolean;
  }

  const n = c.grupos.length;

  // o painel que estava atrás do grupo vira o FUNDO do cartão dele: a imagem é reaproveitada,
  // nunca apagada (e o véu branco por cima garante o contraste do texto)
  // A imagem de FUNDO tem texto por cima (é decoração: pode ser coberta). A imagem de CONTEÚDO
  // (print, foto) não tem texto por cima — essa não pode ser coberta nem sumir.
  const presosDeGrupo = new Set([
    ...(c.titulo?.presos ?? []),
    ...c.grupos.flatMap((g) => g.presos),
    ...(c.rodape?.presos ?? []),
  ]);
  const textosDa = slide.shapes.filter((s) => temTexto(s) && s.kind !== "imagem");
  const temTextoEm = (p: Shape): boolean => textosDa.some((t) => contem(p.box, t.box));
  // arte de canto (a tarja verde do deck) não é "imagem de conteúdo"
  const ehCanto = (p: Shape): boolean =>
    (p.box.x >= 68 && p.box.y <= 4) || (p.box.x >= 68 && p.box.y + p.box.h >= 96) || (p.box.x <= 4 && p.box.y + p.box.h >= 96) || (p.box.x <= 4 && p.box.y <= 4);
  const imagemDeConteudo = (p: Shape): boolean => area(p.box) >= 300 && !temTextoEm(p) && !ehCanto(p) && !presosDeGrupo.has(p.id);
  const painelDe = (g: Grupo): Shape | undefined =>
    c.paineis.find((p) => imagemDeConteudo(p) && !contem(p.box, g.box) && sobreposicao(p.box, g.box) > 0.2);
  const paineisUsados = new Set<Shape>();

  // -------------------------------------------------------------------------
  // re-tipografia: o texto é reescrito no padrão novo (título grande no topo do
  // cartão, corpo legível), em vez de o bloco antigo só encolher
  // -------------------------------------------------------------------------

  const PT_CABECALHO = 17;
  const PT_CORPO = 12.5;
  const LINHA = 1.26;
  const LARGURA_CHAR = 0.52;

  // medida de verdade: no navegador o texto é medido no canvas (a mesma fonte que vai desenhar);
  // na bancada (Node) cai numa estimativa conservadora. Subestimar aqui = texto vazando depois.
  let medidor: CanvasRenderingContext2D | null | undefined;
  function contexto(): CanvasRenderingContext2D | null {
    if (medidor !== undefined) return medidor;
    try {
      medidor = typeof document !== "undefined" ? document.createElement("canvas").getContext("2d") : null;
    } catch {
      medidor = null;
    }
    return medidor;
  }

  function linhasDe(texto: string, tamanho: number, larguraPt: number, fonte: string, negrito: boolean): number {
    const ctx = contexto();
    const fc = fonteCss(fonte || "sans-serif", negrito);
    if (ctx) ctx.font = `${fc.peso} ${tamanho}px ${fc.stack}`;
    // a bancada não tem canvas: usa uma média de largura de caractere mais conservadora
    const porLinha = Math.max(6, Math.floor(larguraPt / (tamanho * 0.58)));
    let total = 0;
    for (const bloco of texto.split("\n")) {
      if (!bloco.trim()) {
        total += 1;
        continue;
      }
      if (!ctx) {
        total += Math.max(1, Math.ceil(bloco.length / porLinha));
        continue;
      }
      let n = 1;
      let atual = "";
      for (const palavra of bloco.split(/\s+/).filter(Boolean)) {
        const teste = atual ? `${atual} ${palavra}` : palavra;
        if (atual && ctx.measureText(teste).width > larguraPt) {
          n++;
          atual = palavra;
        } else atual = teste;
      }
      total += n;
    }
    return Math.max(1, total);
  }

  /** Altura da faixa de imagem no topo do cartão (a imagem aparece INTEIRA, nunca atrás do texto). */
  function bandaDaImagem(papel: Shape | undefined, largura: number): number {
    if (!papel) return 0;
    const util = largura - 4;
    const proporcao = papel.box.h / Math.max(0.01, papel.box.w);
    return Math.min(util * proporcao, largura * 0.42);
  }

  /** Altura (em % da lâmina) da forma reescrita no tamanho dado. */
  function alturaDaForma(s: Shape, tamanho: number, larguraPct: number): number {
    const larguraPt = Math.max(20, (larguraPct / 100) * 960);
    let total = 0;
    for (const p of s.paras ?? []) {
      // quebras de linha dentro do parágrafo (run.br = <br>) contam como linha
      const texto = p.runs.map((r) => (r.br ? "\n" : r.text ?? "")).join("");
      const base = Math.max(1, p.runs[0]?.size ?? tamanho);
      const marL = (p.marL ?? 0) * (tamanho / base);
      const negrito = p.runs.some((r) => r.bold) || s.bold;
      const fonte = p.runs[0]?.font || s.fontFamily || "sans-serif";
      const linhas = linhasDe(texto, tamanho, Math.max(12, larguraPt - marL), fonte, negrito);
      // a mesma razão de linha que o renderizador usa (medida na fonte de verdade)
      total += linhas * tamanho * Math.max(1.3, razaoDeLinha(fonte, negrito)) * (p.lnSpc?.pct ?? 1) + (p.spcBef ?? 0) + (p.spcAft ?? 0);
    }
    return (total * 1.05 * 100) / 540;
  }

  interface Linha {
    forma: Shape;
    texto: string;
    negrito: boolean;
    icones: Shape[];
  }
  interface GrupoTexto {
    cabecalho: Linha | null;
    corpo: Linha[];
    g: Grupo;
  }

  /** Lê um grupo como texto corrido: um cabeçalho e os parágrafos. Só vale para grupos de UMA coluna. */
  function preparar(g: Grupo): GrupoTexto | null {
    const textos = g.ids
      .map((id) => slide.shapes.find((s) => s.id === id))
      .filter((s): s is Shape => !!s && temTexto(s) && s.kind !== "imagem");
    if (!textos.length) return null;
    if (!textos.every((t) => sobreX(t.box, g.box) > 0.6)) return null;
    textos.sort((a, b) => a.box.y - b.box.y);
    const imagens = g.presos.map((id) => slide.shapes.find((s) => s.id === id)).filter((s): s is Shape => !!s && ehImagem(s));
    const iconesDe = (t: Shape) =>
      imagens.filter((i) => {
        const meio = i.box.y + i.box.h / 2;
        return meio >= t.box.y - 0.4 && meio <= t.box.y + t.box.h + 0.4;
      });
    const linhas: Linha[] = textos.map((t) => ({
      forma: t,
      texto: txt(t),
      negrito: t.bold || (t.paras ?? []).some((p) => p.runs.some((r) => r.bold)),
      icones: iconesDe(t),
    }));
    const primeiro = linhas[0];
    // é cabeçalho quando é curto e (negrito, CAIXA ALTA ou maior que o texto de baixo) — o "título"
    // de um cartão no estilo Office costuma ser uma etiqueta em caixa alta, não a maior letra
    const caixaAlta = primeiro.texto.length > 3 && primeiro.texto === primeiro.texto.toUpperCase();
    const temCabecalho =
      linhas.length >= 2 &&
      primeiro.texto.length <= 90 &&
      (primeiro.negrito || caixaAlta || maiorLetra(primeiro.forma) > maiorLetra(linhas[1].forma) + 0.4);
    return { cabecalho: temCabecalho ? primeiro : null, corpo: temCabecalho ? linhas.slice(1) : linhas, g };
  }

  /** Reescreve uma forma de texto na caixa e no tamanho pedidos (mantém o desenho dos trechos). */
  function reescrever(l: Linha, box: ShapeBox, tamanho: number, cor?: string): Shape {
    return {
      ...l.forma,
      box,
      // a caixa nova precisa quebrar linha: o texto do .pptx pode vir com "não quebrar"
      wrap: true,
      fontSize: tamanho,
      color: cor ?? l.forma.color,
      paras: (l.forma.paras ?? []).map((p) => ({
        ...p,
        runs: p.runs.map((r) => ({ ...r, size: tamanho, color: cor ?? r.color })),
      })),
    };
  }

  /**
   * Coloca o grupo num cartão re-tipografado. `comFaixa` desenha o cabeçalho em faixa colorida.
   * Devolve as formas (fundo + conteúdo) e a altura usada.
   */
  function cartaoDeTexto(gt: GrupoTexto, box: ShapeBox, comFaixa: boolean, papel?: Shape): { fundos: Shape[]; conteudo: Shape[]; altura: number } {
    const pad = 2;
    const cab = gt.cabecalho;
    const cabAltura = cab ? alturaDaForma(cab.forma, PT_CABECALHO, box.w - 2 * pad) + 2.2 : 0;
    const banda = bandaDaImagem(papel, box.w);
    const fundos: Shape[] = [];
    const conteudo: Shape[] = [];
    // o cartão é o do deck: quase branco, sem borda, canto macio
    fundos.push(forma(box, { fill: p.tinta, cantos: 1.8 }));
    if (papel && banda > 0) {
      // a imagem informativa aparece INTEIRA no topo do cartão (ajustada pela proporção, centrada)
      const escala = Math.min((box.w - 2 * pad) / Math.max(0.01, papel.box.w), banda / Math.max(0.01, papel.box.h));
      const w = papel.box.w * escala;
      const h = papel.box.h * escala;
      fundos.push({ ...papel, box: { x: box.x + (box.w - w) / 2, y: box.y + 1.6, w, h } });
    }
    const topoFaixa = box.y + (banda > 0 ? banda + 1.6 : 0);
    if (comFaixa && cab) {
      // minimalista: um filete curto na cor da marca e o título em verde — sem faixa pesada
      fundos.push(forma({ x: box.x + pad, y: topoFaixa + 0.8, w: 6, h: 0.24 }, { fill: p.acento, cantos: 0.12 }));
      const hb = { x: box.x + pad, y: topoFaixa + 1.4, w: box.w - 2 * pad, h: alturaDaForma(cab.forma, PT_CABECALHO - 1, box.w - 2 * pad) };
      conteudo.push(reescrever(cab, hb, PT_CABECALHO - 1, p.acento));
    }
    let y = topoFaixa + (comFaixa && cab ? alturaDaForma(cab.forma, PT_CABECALHO - 1, box.w - 2 * pad) + 2 : banda > 0 ? 0.2 : pad);
    if (cab && !comFaixa) {
      const h = alturaDaForma(cab.forma, PT_CABECALHO - 1, box.w - 2 * pad);
      conteudo.push(reescrever(cab, { x: box.x + pad, y, w: box.w - 2 * pad, h }, PT_CABECALHO - 1, p.acento));
      y += h + 0.6;
    }
    for (const par of gt.corpo) {
      const desloca = par.icones.length ? 3.4 : 0;
      const h = alturaDaForma(par.forma, PT_CORPO, box.w - 2 * pad - desloca) * 1.08 + 0.3;
      // ícone à esquerda, alinhado à primeira linha
      for (const ic of par.icones) {
        const lado = Math.min(2.4, h * 0.75);
        conteudo.push({ ...ic, box: { x: box.x + pad, y: y + (h - lado) / 2, w: lado, h: lado } });
      }
      const cor = textoClaro(par.forma) ? p.escuro : undefined;
      conteudo.push(reescrever(par, { x: box.x + pad + desloca, y, w: box.w - 2 * pad - desloca, h }, PT_CORPO, cor));
      y += h + 0.7;
    }
    const altura = Math.max(12, y - box.y + pad - 0.7);
    return { fundos, conteudo, altura };
  }

  /** Altura que o cartão de texto vai precisar (para balancear as colunas antes de desenhar). */
  function alturaDoCartao(gt: GrupoTexto, largura: number, comFaixa: boolean, papel?: Shape): number {
    const pad = 2;
    const cab = gt.cabecalho;
    const banda = bandaDaImagem(papel, largura);
    let h = (banda > 0 ? banda + 1.6 : 0) + (comFaixa && cab ? alturaDaForma(cab.forma, PT_CABECALHO - 1, largura - 2 * pad) + 2 : banda > 0 ? 0.2 : pad);
    if (cab && !comFaixa) h += alturaDaForma(cab.forma, PT_CABECALHO - 1, largura - 2 * pad) + 0.6;
    for (const par of gt.corpo) h += (alturaDaForma(par.forma, PT_CORPO, largura - 2 * pad - (par.icones.length ? 3.4 : 0)) * 1.08 + 0.3) + 0.7;
    return Math.max(12, h + pad - 0.7);
  }

  /** Distribui os grupos em colunas por altura (masonry), preservando a ordem de leitura. */
  function colunasPorAltura(alturas: number[], cols: number): number[][] {
    const colunas: number[][] = Array.from({ length: cols }, () => []);
    const totais = new Array(cols).fill(0);
    alturas.forEach((h, i) => {
      const menor = totais.indexOf(Math.min(...totais));
      colunas[menor].push(i);
      totais[menor] += h;
    });
    return colunas.filter((c) => c.length);
  }

  // ---- cartões re-tipografados (o desenho principal)
  const cartoesTexto = (cols: number, comFaixa: boolean): Desenho | null => {
    const preparados = c.grupos.map(preparar);
    if (preparados.some((g) => !g)) return null;
    const gts = preparados as GrupoTexto[];
    if (gts.length > 6) return null;
    const k = Math.min(cols, gts.length);
    const larg = (util - VAO * (k - 1)) / k;

    const alturas = gts.map((gt) => alturaDoCartao(gt, larg, comFaixa, painelDe(gt.g)));
    const colunas = colunasPorAltura(alturas, k);
    const totais = colunas.map((col) => col.reduce((a, i) => a + alturas[i], 0) + VAO * (col.length - 1));
    if (Math.max(...totais) > alturaUtil + 0.5) return null;
    const sobra = alturaUtil - Math.max(...totais);
    const fundos: Shape[] = [];
    const conteudo: Shape[] = [];
    colunas.forEach((col, ci) => {
      const x = MARGEM + ci * (larg + VAO);
      let y = topoConteudo + sobra / 2;
      for (const i of col) {
        const papel = painelDe(gts[i].g);
        if (papel) paineisUsados.add(papel);
        const r = cartaoDeTexto(gts[i], { x, y, w: larg, h: alturas[i] }, comFaixa, papel);
        fundos.push(...r.fundos);
        conteudo.push(...r.conteudo);
        y += alturas[i] + VAO;
      }
    });
    return { fundos, conteudo, tituloProprio: true };
  };

  // ---- faixas re-tipografadas: cada grupo numa faixa larga, texto grande
  const faixasTexto = (): Desenho | null => {
    const preparados = c.grupos.map(preparar);
    if (preparados.some((g) => !g)) return null;
    const gts = preparados as GrupoTexto[];
    const pad = 2.2;
    const larg = util - 2 * pad - 1.2;
    const alturas = gts.map((gt) => {
      let h = gt.cabecalho ? alturaDaForma(gt.cabecalho.forma, PT_CABECALHO + 2, larg) + 0.6 : 0;
      for (const par of gt.corpo) h += alturaDaForma(par.forma, PT_CORPO, larg) * 1.08 + 0.3 + 0.7;
      return Math.max(10, h + 2 * pad);
    });
    const total = alturas.reduce((a, v) => a + v, 0);
    if (total + 1.4 * (gts.length - 1) > alturaUtil) return null;
    const vao = gts.length > 1 ? Math.min(5, (alturaUtil - total) / (gts.length - 1)) : 0;
    const sobra = gts.length > 1 ? 0 : (alturaUtil - total) / 2;
    const fundos: Shape[] = [];
    const conteudo: Shape[] = [];
    let y = topoConteudo + sobra;
    gts.forEach((gt, i) => {
      const h = alturas[i];
      fundos.push(...faixaFundo({ x: MARGEM, y, w: util, h }, p, i % 2 === 1, 0.6));
      let yy = y + pad;
      if (gt.cabecalho) {
        const ch = alturaDaForma(gt.cabecalho.forma, PT_CABECALHO + 2, larg);
        conteudo.push(reescrever(gt.cabecalho, { x: MARGEM + pad, y: yy, w: larg, h: ch }, PT_CABECALHO + 2, p.acento));
        yy += ch + 0.6;
      }
      for (const par of gt.corpo) {
        const ph = alturaDaForma(par.forma, PT_CORPO, larg) * 1.08 + 0.3;
        const cor = textoClaro(par.forma) ? p.escuro : undefined;
        conteudo.push(reescrever(par, { x: MARGEM + pad, y: yy, w: larg, h: ph }, PT_CORPO, cor));
        yy += ph + 0.7;
      }
      y += h + vao;
    });
    return { fundos, conteudo, tituloProprio: true };
  };

  /** O grupo tem cabeçalho em texto claro (branco, desenhado para a faixa colorida antiga)? */
  const cabecalhoClaro = (g: Grupo): boolean =>
    g.ids.map((id) => slide.shapes.find((s) => s.id === id)).some((s): boolean => !!s && temTexto(s) && textoClaro(s));

  /** Altura da faixa colorida atrás de um cabeçalho branco (para ele não sumir no cartão claro). */
  const faixaDoCabecalho = (g: Grupo, escala: number, pad: number): number => {
    const formas = g.ids.map((id) => slide.shapes.find((s) => s.id === id)).filter((s): s is Shape => !!s && temTexto(s));
    const claros = formas.filter(textoClaro);
    if (!claros.length) return 0.6;
    const fim = Math.max(...claros.map((s) => s.box.y + s.box.h));
    const escuros = formas.filter((f) => !textoClaro(f));
    const limite = escuros.length ? Math.min(...escuros.map((s) => s.box.y)) - 0.45 : fim;
    return Math.max(0.6, (Math.min(fim, limite) - g.box.y) * escala + pad + 0.6 + 0.8);
  };

  /** Põe o grupo no cartão: com cabeçalho claro encosta no topo (a faixa manda); senão centra. */
  const porNoCartao = (g: Grupo, cell: ShapeBox, escala: number, pad: number): { destino: ShapeBox; faixa: number } => {
    const claro = cabecalhoClaro(g);
    const w = g.box.w * escala;
    const h = g.box.h * escala;
    return {
      destino: { x: cell.x + (cell.w - w) / 2, y: claro ? cell.y + pad + 0.6 : cell.y + Math.max(pad, (cell.h - h) / 2), w, h },
      faixa: claro ? faixaDoCabecalho(g, escala, pad) : 0.6,
    };
  };

  // ---- blocos inteiros (para grupos que não são texto corrido: quadros, diagramas)
  const gradeDe = (cols: number): Desenho | null => {
    const linhas = Math.ceil(n / cols);
    const pad = 1.8;
    const larg = (util - VAO * (cols - 1)) / cols;
    const eW = c.grupos.map((g) => Math.min(1.6, (larg - 2 * pad) / Math.max(1, g.box.w)));
    const alturas = c.grupos.map((g, i) => Math.max(g.box.h * eW[i] + 2 * pad + 0.6, 0.6 + pad));
    const altLinha: number[] = [];
    for (let r = 0; r < linhas; r++) altLinha.push(Math.max(...alturas.slice(r * cols, r * cols + cols)));
    let soma = altLinha.reduce((a, v) => a + v, 0) + VAO * (linhas - 1);
    if (soma > alturaUtil) {
      const f = (alturaUtil - VAO * (linhas - 1)) / Math.max(0.01, soma - VAO * (linhas - 1));
      for (let r = 0; r < linhas; r++) altLinha[r] *= f;
      soma = alturaUtil;
    }
    let y = topoConteudo + (alturaUtil - soma) / 2;
    const fundos: Shape[] = [];
    const colocacoes: Colocacao[] = [];
    for (let i = 0; i < n; i++) {
      const r = Math.floor(i / cols);
      const cell = { x: MARGEM + (i % cols) * (larg + VAO), y, w: larg, h: altLinha[r] };
      const g = c.grupos[i];
      const escala = Math.min(1.6, (cell.w - 2 * pad) / Math.max(1, g.box.w), (cell.h - 2 * pad - 0.6) / Math.max(1, g.box.h));
      if (escala < escalaMinima(slide, g)) return null;
      const d = porNoCartao(g, cell, escala, pad);
      fundos.push(...cartao(cell, p, d.faixa));
      colocacoes.push({ g, destino: d.destino, escala });
      if (i % cols === cols - 1 || i === n - 1) y += altLinha[r] + VAO;
    }
    return { fundos, colocacoes };
  };

  // a variante escolhe o desenho; se não couber, tenta os outros
  const cartoes = (): Desenho | null => cartoesTexto(n <= 3 ? n : n <= 6 ? Math.ceil(n / 2) : 2, true);
  const lista = (): Desenho | null => cartoesTexto(1, false);
  const grade = (): Desenho | null => gradeDe(n <= 4 ? 2 : n <= 6 ? 3 : n <= 8 ? 4 : 5);
  // a arte generativa (formas) entra atrás do conteúdo: é o "design" quando não há imagem
  const semente = [...(c.titulo ? c.titulo.ids : []), ...c.grupos.flatMap((g) => g.ids)].join("").split("").reduce((a, ch) => (a * 31 + ch.charCodeAt(0)) >>> 0, 7) % 997;
  // imagem + conteúdo: a maior imagem vira o "herói" (redimensionada para caber) e os textos
  // se acomodam ao lado dela — é o desenho que aproveita a imagem em vez de escondê-la
  const midiaHero = (): Desenho | null => {
    const maior = [...c.paineis].filter(imagemDeConteudo).sort((a, b) => area(b.box) - area(a.box))[0];
    if (!maior) return null;
    const preparados = c.grupos.map(preparar);
    if (preparados.some((g) => !g)) return null;
    const gts = preparados as GrupoTexto[];
    const heroW = util * 0.46;
    const colW = util - heroW - VAO;
    const alturas = gts.map((gt) => alturaDoCartao(gt, colW, true));
    const total = alturas.reduce((a, v) => a + v, 0) + VAO * (gts.length - 1);
    if (total > alturaUtil + 0.5) return null;
    const fundos: Shape[] = [];
    const conteudo: Shape[] = [];
    const escala = Math.min(heroW / Math.max(1, maior.box.w), alturaUtil / Math.max(1, maior.box.h));
    const w = maior.box.w * escala;
    const h = maior.box.h * escala;
    const cx = MARGEM + util - heroW + heroW / 2;
    const cy = topoConteudo + alturaUtil / 2;
    // o círculo grande atrás da imagem e alguns pontos dão o contraste do desenho
    const raio = Math.max(w, h) * 0.62;
    fundos.push({ ...forma({ x: cx - raio, y: cy - raio * 0.9, w: raio * 2, h: raio * 1.8 }, { fill: p.tinta }), geom: "ellipse" });
    fundos.push({ ...forma({ x: cx + w * 0.42, y: cy - raio * 0.78, w: 1.5, h: 1.5 }, { fill: p.acento, cantos: 0.75 }), geom: "ellipse" });
    fundos.push({ ...forma({ x: cx + w * 0.5, y: topoConteudo + 1.2, w: 0.9, h: 0.9 }, { fill: misturar(p.acento, "FFFFFF", 0.45), cantos: 0.45 }), geom: "ellipse" });
    fundos.push({ ...forma({ x: cx - w * 0.5, y: cy + raio * 0.6, w: 1.1, h: 1.1 }, { fill: misturar(p.acento, "000000", 0.15), cantos: 0.55 }), geom: "ellipse" });
    fundos.push({ ...maior, box: { x: cx - w / 2, y: cy - h / 2, w, h } });
    paineisUsados.add(maior);
    let y = topoConteudo + (alturaUtil - total) / 2;
    gts.forEach((gt, i) => {
      const r = cartaoDeTexto(gt, { x: MARGEM, y, w: colW, h: alturas[i] }, true);
      fundos.push(...r.fundos);
      conteudo.push(...r.conteudo);
      y += alturas[i] + VAO;
    });
    return { fundos, conteudo };
  };

  /**
   * O desenho de impacto: a imagem vira um CÍRCULO recortado (sangrando na lâmina), o fundo é
   * tom da marca, formas de contraste (pontos) preenchem o vazio e o texto fica na coluna da
   * esquerda — título grande, corpo legível. É a lógica do "design uau", não um slide desenhado
   * à mão: qualquer lâmina com imagem e texto cai neste padrão.
   */
  const circulo = (): Desenho | null => {
    // com imagem, ela é a protagonista; sem imagem, o "herói" é um motivo geométrico gerado
    const imagem = [...c.paineis].filter(imagemDeConteudo).sort((a, b) => area(b.box) - area(a.box))[0];
    if (!imagem || !c.titulo) return null;
    const escuro = misturar(p.acento, "06120C", 0.84);
    const claro = misturar(p.acento, "FFFFFF", 0.55);
    const fundos: Shape[] = [];
    const conteudo: Shape[] = [];
    fundos.push(forma({ x: 0, y: 0, w: 100, h: 100 }, { fill: escuro }));

    // a imagem num círculo: a caixa é quadrada em pontos e o `crop` recorta o miolo (sem distorcer)
    const diametro = 430; // pt
    const lado = diametro / 960; // % da largura
    const altura = diametro / 540; // % da altura
    const cx = 79;
    const cy = 50;
    const box = { x: cx - lado / 2, y: cy - altura / 2, w: lado, h: altura };
    const ar = imagem.box.w / Math.max(0.01, imagem.box.h);
    const corte = ar > 1 ? ((1 - 1 / ar) / 2) * 100 : 0;
    const corteV = ar > 1 ? 0 : ((1 - ar) / 2) * 100;
    fundos.push({ ...imagem, box, geom: "ellipse", crop: [corte, corteV, corte, corteV] });
    paineisUsados.add(imagem);

    // formas de contraste: pontos e um arco atrás do círculo
    fundos.push({ ...forma({ x: cx - lado * 0.62, y: cy - altura * 0.62, w: lado * 1.24, h: altura * 1.24 }, { fill: misturar(p.acento, escuro, 0.55), alpha: 0.55 }), geom: "ellipse" });
    for (const [dx, dy, d] of [
      [-0.58, -0.48, 1.5],
      [-0.44, 0.62, 1.1],
      [0.52, -0.55, 1.9],
      [0.66, 0.5, 1.2],
    ] as [number, number, number][]) {
      fundos.push({ ...forma({ x: cx + lado * dx, y: cy + altura * dy, w: d, h: d * 1.78 }, { fill: claro, cantos: d / 2 }), geom: "ellipse" });
    }

    // texto na coluna da esquerda: título grande, antetítulo e subtítulo menores
    const largura = 42;
    const textos = c.titulo.ids
      .map((id) => slide.shapes.find((s) => s.id === id))
      .filter((s): s is Shape => !!s && temTexto(s))
      .sort((a, b) => a.box.y - b.box.y);
    const maior = Math.max(...textos.map(maiorLetra));
    let y = 0;
    const blocos: { s: Shape; tamanho: number; cor: string }[] = [];
    for (const s of textos) {
      const l = maiorLetra(s);
      const tamanho = l >= maior - 0.1 ? 27 : l >= 12 ? 12.5 : 9.5;
      const cor = l >= maior - 0.1 ? "FFFFFF" : "FFFFFF";
      blocos.push({ s, tamanho, cor });
      y += alturaDaForma(s, tamanho, largura) + (tamanho >= 20 ? 1.2 : 0.6);
    }
    y += 2.2;
    const corpo: { s: Shape; tamanho: number }[] = [];
    for (const g of c.grupos) {
      for (const id of g.ids) {
        const s = slide.shapes.find((x) => x.id === id);
        if (!s || !temTexto(s)) continue;
        const tamanho = maiorLetra(s) >= 14 ? 13 : 11.5;
        corpo.push({ s, tamanho });
        y += alturaDaForma(s, tamanho, largura) + 1.1;
      }
      y += 1.6;
    }
    if (y > 88) return null;

    let yy = Math.max(10, (100 - y) / 2 + 2);
    for (const b of blocos) {
      const h = alturaDaForma(b.s, b.tamanho, largura);
      conteudo.push(reescrever({ forma: b.s, texto: txt(b.s), negrito: b.s.bold, icones: [] }, { x: MARGEM + 1, y: yy, w: largura, h }, b.tamanho, b.cor));
      yy += h + (b.tamanho >= 20 ? 1.2 : 0.6);
    }
    yy += 2.2;
    for (const b of corpo) {
      const h = alturaDaForma(b.s, b.tamanho, largura);
      conteudo.push(reescrever({ forma: b.s, texto: txt(b.s), negrito: b.s.bold, icones: [] }, { x: MARGEM + 1, y: yy, w: largura, h }, b.tamanho, "FFFFFF"));
      yy += h + 1.1;
    }
    return { fundos, conteudo, tituloProprio: true, fundoEscuro: true };
  };

  // -------------------------------------------------------------------------
  // padrão ÚNICO: a mesma lógica, combinada por semente
  //
  // O desenho não é escolhido à mão: a semente liga as peças que podem variar sem quebrar a
  // leitura — tom do fundo, forma do recorte da imagem (círculo, arco, retângulo arredondado),
  // lado e sangria, motivo de contraste (pontos, anéis, grade) e zona do texto. Duas lâminas
  // nunca caem na mesma combinação; e a legibilidade é uma regra fixa: o texto nunca entra na
  // área da imagem e o contraste é sempre calculado sobre o fundo escolhido.
  // -------------------------------------------------------------------------

  /** PRNG determinístico (mulberry32): a mesma semente devolve o mesmo desenho. */
  const sorteador = (semente: number) => {
    let a = semente >>> 0;
    return () => {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };

  /** Recorte (cover) para a imagem preencher a caixa sem distorcer. */
  const recorteCover = (imagem: ShapeBox, caixa: ShapeBox, ratio: number): [number, number, number, number] => {
    const alvo = (caixa.w / caixa.h) * ratio;
    const fonte = imagem.w / Math.max(0.01, imagem.h);
    if (fonte > alvo) {
      const c = ((1 - alvo / fonte) / 2) * 100;
      return [c, 0, c, 0];
    }
    const c = ((1 - fonte / alvo) / 2) * 100;
    return [0, c, 0, c];
  };

  const padraoUnico = (): Desenho | null => {
    // com imagem, ela é a protagonista; sem imagem, o "herói" é um motivo geométrico gerado
    const imagem = [...c.paineis].filter(imagemDeConteudo).sort((a, b) => area(b.box) - area(a.box))[0];
    if (!c.titulo || c.grupos.length < 1) return null;
    const rnd = sorteador(semente + variante * 977);
    const escolha = <T,>(lista: T[]): T => lista[Math.floor(rnd() * lista.length) % lista.length];

    // 1) tom do fundo: escuro da marca, creme ou a cor da marca
    const tons = [
      { fundo: misturar(p.acento, "06120C", 0.86), texto: "FFFFFF", suave: misturar(p.acento, "FFFFFF", 0.62), contraste: p.acento },
      { fundo: "FBF8F2", texto: misturar(p.acento, "000000", 0.78), suave: misturar(p.acento, "000000", 0.25), contraste: p.acento },
      { fundo: p.acento, texto: "FFFFFF", suave: "FFFFFF", contraste: misturar(p.acento, "FFFFFF", 0.55) },
    ];
    // cada variante puxa um tom (escuro, claro, cor da marca) — as três ideias nunca empatam
    const tom = tons[variante % tons.length];

    // 2) recorte da imagem: círculo, arco (topo arredondado) ou retângulo de cantos macios
    const recorte = escolha(["circulo", "circulo", "arco", "retangulo"] as const);
    // 3) lado e sangria
    const lado = rnd() < 0.5 ? "direita" : "esquerda";
    const sangra = rnd() < 0.45;
    const tamanho = 0.62 + rnd() * 0.2; // fração da altura

    const fundos: Shape[] = [];
    const conteudo: Shape[] = [];
    fundos.push(forma({ x: 0, y: 0, w: 100, h: 100 }, { fill: tom.fundo }));

    // caixa da imagem (em % — o círculo precisa de lados iguais em pontos)
    const alturaImg = 100 * tamanho;
    const larguraImg = (alturaImg * 5.4) / 9.6; // mesma medida em pontos
    const cx = lado === "direita" ? (sangra ? 88 : 74) : sangra ? 12 : 26;
    const cy = 50 + (rnd() - 0.5) * 8;
    let caixa = { x: cx - larguraImg / 2, y: cy - alturaImg / 2, w: larguraImg, h: alturaImg };
    if (recorte === "arco") caixa = { ...caixa, w: larguraImg * 1.15, h: alturaImg };
    if (recorte === "retangulo") caixa = { ...caixa, w: larguraImg * 1.1, h: alturaImg * 0.92 };

    if (imagem) {
      const formaImg: Shape = { ...imagem, box: caixa, crop: recorteCover(imagem.box, caixa, ratio) };
      if (recorte === "circulo") formaImg.geom = "ellipse";
      else if (recorte === "arco") {
        formaImg.geom = "roundRect";
        formaImg.cantos = [50, 50, 0, 0];
      } else {
        formaImg.geom = "roundRect";
        formaImg.cantos = [12, 12, 12, 12];
      }
      fundos.push(formaImg);
      paineisUsados.add(imagem);
    } else {
      // sem imagem: o herói é uma forma na cor da marca, com anel e pontos (o recorte vira desenho)
      const hx = caixa.x + caixa.w / 2;
      const hy = caixa.y + caixa.h / 2;
      const raio = Math.min(caixa.w, caixa.h * 1.78) / 2;
      if (recorte === "arco") {
        fundos.push({ ...forma({ x: hx - raio, y: hy - caixa.h / 2, w: raio * 2, h: caixa.h }, { fill: tom.contraste, cantos: raio }), geom: "roundRect", cantos: [50, 50, 0, 0] });
      } else if (recorte === "retangulo") {
        fundos.push({ ...forma({ x: hx - raio, y: hy - caixa.h / 2, w: raio * 2, h: caixa.h }, { fill: tom.contraste, cantos: 8 }), geom: "roundRect", cantos: [8, 8, 8, 8] });
      } else {
        fundos.push({ ...forma({ x: hx - raio, y: hy - raio * 0.9, w: raio * 2, h: raio * 1.8 }, { fill: tom.contraste }), geom: "ellipse" });
        fundos.push({ ...forma({ x: hx - raio * 1.14, y: hy - raio * 1.03, w: raio * 2.28, h: raio * 2.05 }, { ln: { color: tom.suave, w: 1.5, alpha: 0.5 } }), geom: "ellipse" });
      }
    }

    // 4) motivo de contraste, do lado oposto à imagem
    const motivo = escolha(["pontos", "aneis", "grade"] as const);
    const mx = lado === "direita" ? 8 : 92;
    const my = 12 + rnd() * 20;
    if (motivo === "pontos") {
      for (let k = 0; k < 3; k++) {
        const d = 1.1 + rnd() * 1.4;
        fundos.push({ ...forma({ x: mx + (rnd() - 0.5) * 10, y: my + k * 4.2, w: d, h: d * 1.78 }, { fill: tom.contraste, cantos: d / 2 }), geom: "ellipse" });
      }
    } else if (motivo === "aneis") {
      const d = 16 + rnd() * 12;
      fundos.push({ ...forma({ x: mx - d / 2, y: my, w: d, h: (d * 1.78) }, { ln: { color: tom.contraste, w: 2, alpha: 0.5 } }), geom: "ellipse" });
      fundos.push({ ...forma({ x: mx - d / 3, y: my + d * 0.4, w: d * 0.66, h: d * 1.18 }, { ln: { color: tom.suave, w: 1, alpha: 0.4 } }), geom: "ellipse" });
    } else {
      const cols = 4;
      const linhas = 5;
      const passo = 2.2;
      for (let l = 0; l < linhas; l++) {
        for (let col = 0; col < cols; col++) {
          fundos.push({ ...forma({ x: mx + col * passo - (cols * passo) / 2, y: my + l * passo * 1.4, w: 0.55, h: 0.55 * 1.78 }, { fill: tom.suave, cantos: 0.27 }), geom: "ellipse" });
        }
      }
    }

    // 5) zona do texto: sempre no lado oposto ao da imagem, com largura folgada
    const largura = 38;
    const x = lado === "direita" ? MARGEM + 2 : 100 - MARGEM - 2 - largura;
    const textos = c.titulo.ids
      .map((id) => slide.shapes.find((s) => s.id === id))
      .filter((s): s is Shape => !!s && temTexto(s))
      .sort((a, b) => a.box.y - b.box.y);
    const maior = Math.max(...textos.map(maiorLetra));
    // o texto desce de tamanho até caber (nunca abaixo de 9 pt) — é o encaixe, não um corte
    const escalas = [1, 0.9, 0.8, 0.72];
    let blocos: { s: Shape; tamanho: number }[] = [];
    let corpo: { s: Shape; tamanho: number; gap: number }[] = [];
    let alturaTotal = 0;
    for (const escala of escalas) {
      blocos = [];
      corpo = [];
      alturaTotal = 0;
      for (const s of textos) {
        const base = maiorLetra(s) >= maior - 0.1 ? 26 : maiorLetra(s) >= 12 ? 12.5 : 9.5;
        const tamanho = Math.max(9, base * escala);
        blocos.push({ s, tamanho });
        alturaTotal += alturaDaForma(s, tamanho, largura) + (tamanho >= 20 ? 1.2 : 0.6);
      }
      alturaTotal += 2.4;
      for (const g of c.grupos) {
        const ids = g.ids.filter((id) => {
          const s = slide.shapes.find((y2) => y2.id === id);
          return !!s && temTexto(s);
        });
        ids.forEach((id, k) => {
          const s = slide.shapes.find((y2) => y2.id === id)!;
          const tamanho = Math.max(9, (maiorLetra(s) >= 14 ? 12.5 : 11) * escala);
          const gap = k === ids.length - 1 ? 3.4 : 1.1;
          corpo.push({ s, tamanho, gap });
          alturaTotal += alturaDaForma(s, tamanho, largura) + gap;
        });
      }
      if (alturaTotal <= 86) break;
    }
    if (alturaTotal > 86) return null;
    let y = Math.max(9, (100 - alturaTotal) / 2);
    for (const b of blocos) {
      const h = alturaDaForma(b.s, b.tamanho, largura);
      conteudo.push(reescrever({ forma: b.s, texto: txt(b.s), negrito: b.s.bold, icones: [] }, { x, y, w: largura, h }, b.tamanho, b.tamanho >= 20 ? tom.texto : tom.suave));
      y += h + (b.tamanho >= 20 ? 1.2 : 0.6);
    }
    y += 2.4;
    for (const b of corpo) {
      const h = alturaDaForma(b.s, b.tamanho, largura);
      conteudo.push(reescrever({ forma: b.s, texto: txt(b.s), negrito: b.s.bold, icones: [] }, { x, y, w: largura, h }, b.tamanho, tom.texto));
      y += h + b.gap;
    }
    return { fundos, conteudo, tituloProprio: true, fundoEscuro: tom.fundo !== "FBF8F2" };
  };
  const artes: ArteId[] = ["ondas", "facetas", "mosaico", "orbes"];
  const comArte = false;
  // cada ideia começa por uma ESTRUTURA diferente (não é a mesma arrumação recolorida):
  //   0 = imagem/forma protagonista + coluna de texto
  //   1 = cartões (grade)
  //   2 = faixas largas empilhadas
  // se a estrutura não couber, a próxima da lista assume — mas a primeira tentativa é sempre outra
  const ordens = [
    [padraoUnico, circulo, midiaHero, cartoes, faixasTexto, lista, grade],
    [cartoes, faixasTexto, padraoUnico, midiaHero, lista, grade],
    [faixasTexto, cartoes, padraoUnico, midiaHero, lista, grade],
  ];
  const ordem = ordens[variante % ordens.length];
  const desenho = ordem.map((f) => f()).find((d): d is Desenho => !!d) ?? null;
  if (!desenho) return slide;
  // imagem que NÃO entrou no desenho não pode ficar coberta pelo conteúdo novo (informação perdida)
  {
    const caixasNovas = [...desenho.fundos, ...(desenho.conteudo ?? [])].map((s) => s.box);
    for (const s of slide.shapes) {
      if (!c.paineis.includes(s) || paineisUsados.has(s) || !imagemDeConteudo(s) || presosDeGrupo.has(s.id)) continue;
      if (caixasNovas.some((b) => sobreposicao(b, s.box) > 0.02)) return slide;
    }
  }

  // ---- monta a lâmina: arte (se for a variante) + fixas + fundos novos + conteúdo
  const paletaArte = {
    bg: misturar(p.acento, "08130D", 0.86),
    fg: "FFFFFF",
    accent: misturar(p.acento, "FFFFFF", 0.3),
    muted: misturar(p.acento, "FFFFFF", 0.62),
  };
  const formasArte: Shape[] = comArte ? formasDeArte(artes[semente % artes.length], semente, "conteudo", paletaArte, ratio) : [];
  const corDoTexto = desenho.fundoEscuro ? "FFFFFF" : undefined;
  const novos: Shape[] = [];
  novos.push(...formasArte);
  for (const s of slide.shapes) if (s.fixa) novos.push(s);
  // imagem que não virou cartão continua na lâmina (nada de mídia ou imagem apagada)
  for (const s of slide.shapes) if (c.paineis.includes(s) && !paineisUsados.has(s) && !presosDeGrupo.has(s.id)) novos.push(s);
  novos.push(...desenho.fundos);

  const tituloDestino = c.titulo ? { x: MARGEM, y: MARGEM, w: c.titulo.box.w * escalaTitulo, h: alturaTitulo } : null;
  const rodapeDestino = c.rodape ? { x: MARGEM, y: 100 - MARGEM - alturaRodape, w: c.rodape.box.w * escalaRodape, h: alturaRodape } : null;

  // decoração do título, por variante
  if (tituloDestino) {
    if (variante === 1) {
      novos.push(forma({ x: 0, y: 0, w: 100, h: tituloDestino.h + 2.2 * MARGEM }, { fill: p.tinta }));
      novos.push(forma({ x: MARGEM, y: tituloDestino.h + 2.2 * MARGEM - 0.18, w: 100, h: 0.18 }, { fill: p.acento, alpha: 0.5 }));
    } else if (variante === 2) {
      novos.push(forma({ x: MARGEM - 1.2, y: tituloDestino.y + 0.4, w: 0.36, h: Math.max(1.2, tituloDestino.h - 0.8) }, { fill: p.acento }));
    } else {
      novos.push(forma({ x: MARGEM, y: tituloDestino.y - 1.5, w: 9, h: 0.34 }, { fill: p.acento, cantos: 0.17 }));
    }
  }
  if (rodapeDestino) {
    novos.push(forma({ x: MARGEM, y: rodapeDestino.y - 1.6, w: util, h: 0.08 }, { fill: p.acento, alpha: 0.22 }));
  }

  // conteúdo
  if (desenho.conteudo) novos.push(...desenho.conteudo);
  else for (const col of desenho.colocacoes ?? []) aplicarGrupo(slide, col.g, col.destino, col.escala, novos);
  if (tituloDestino && c.titulo && !desenho.tituloProprio) aplicarGrupo(slide, c.titulo, tituloDestino, escalaTitulo, novos, corDoTexto);
  if (rodapeDestino && c.rodape) aplicarGrupo(slide, c.rodape, rodapeDestino, escalaRodape, novos, corDoTexto);

  return { ...slide, shapes: novos, bg: comArte ? { kind: "solid", color: paletaArte.bg } : slide.bg };
}

/** O nome com que as composições aparecem no painel. */
export const NOMES_COMPOSICAO = ["Compor — imagem + texto", "Compor — cartões", "Compor — faixas"] as const;