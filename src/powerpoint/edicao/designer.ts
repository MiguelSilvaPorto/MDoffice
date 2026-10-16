// O Designer: a lâmina ganha a ARTE (ondas, facetas, mosaico, brilhos) na paleta de um modelo e, na
// capa, o texto é RECOMPOSTO para a arte — o título e o subtítulo vão para a zona que a arte deixa
// livre, com o alinhamento e a cor que lêem bem ali (4,5:1 de contraste). Em lâminas de conteúdo a
// arte fica só nas bordas e nenhuma caixa muda de lugar.
//
// É o caminho único do clique e da prévia (`aplicarArte`): o cartão mostra exatamente o que o clique
// faz. Funções puras: devolvem lâmina nova.
import type { Para, Run, Shape, Slide } from "../schema";
import { themeOf } from "../themes";
import { ARTES, comporArte, comporArteNaZona, contraste, misturar, type ArteId, type PaletaArte, type ZonaArte } from "./arte";
import { enfeitesDa, melhorArranjo } from "./arranjos";
import { ehDecoracaoDeModelo, semDesenho } from "./desenhos";
import { aplicarModeloALamina, type EstiloAtual, type ModeloPPT } from "./modelos";

/** As quatro cores de um modelo (as do tema onde ele não traz as próprias). */
export function paletaDoModelo(m: ModeloPPT): PaletaArte {
  const t = themeOf(m.tema);
  return {
    bg: m.cores?.bg || m.bg || t.bg,
    fg: m.cores?.fg || t.fg,
    accent: m.cores?.accent || t.accent,
    muted: m.cores?.muted || t.muted,
  };
}

const temTexto = (s: Shape): boolean => (s.paras ?? []).some((p) => p.runs.some((r) => (r.text ?? "").trim())) || !!s.text?.trim();

/** O maior tamanho de letra da forma (é o que diz quem é o título). */
function tamanhoDe(s: Shape): number {
  const t = (s.paras ?? []).flatMap((p) => p.runs.map((r) => r.size ?? 0));
  return Math.max(s.fontSize || 0, ...t);
}

/**
 * Os papéis de texto de uma capa: o título (a maior letra) e o subtítulo (a segunda). Só há capa
 * quando a lâmina é Capa/Seção e TODO o conteúdo dela é texto (quatro caixas no máximo) — com
 * imagens ou cartões, mexer nas caixas seria desarrumar o que o autor fez.
 */
export function papeisDaCapa(slide: Slide): { titulo: Shape; subtitulo?: Shape } | null {
  if (slide.layout !== "titulo" && slide.layout !== "secao") return null;
  const vivas = slide.shapes.filter((s) => !s.fixa);
  if (!vivas.length || vivas.length > 4 || vivas.some((s) => s.kind !== "texto" || s.tabela || s.grafico || s.midia)) return null;
  const textos = vivas.filter(temTexto).sort((a, b) => tamanhoDe(b) - tamanhoDe(a));
  if (!textos.length) return null;
  return { titulo: textos[0], subtitulo: textos[1] };
}

/** A cor do texto sobre um fundo: a do modelo, se lê bem (4,5:1); senão a que mais contrasta. */
function corLegivel(preferida: string, fundo: string): string {
  const candidatas = [preferida, "FFFFFF", "0B1220"];
  return candidatas.find((c) => contraste(c, fundo) >= 4.5) ?? candidatas.reduce((a, b) => (contraste(b, fundo) > contraste(a, fundo) ? b : a));
}

/** O texto da forma (uma linha por parágrafo). */
const textoDe = (s: Shape): string => (s.paras?.length ? s.paras.map((p) => p.runs.map((r) => r.text ?? "").join("")).join("\n") : s.text ?? "");

/**
 * O maior tamanho (pt) em que a PALAVRA mais longa ainda cabe na caixa: palavra que passa da caixa
 * quebra no meio ("apresentaçã/o"). A conta é uma estimativa conservadora (0,62 em de largura média
 * por letra, que cobre fontes largas e serifadas); a lâmina tem 960 pt de largura.
 */
export function tamanhoQueCabe(texto: string, larguraPct: number, maximo: number, minimo = 26): number {
  const maior = Math.max(1, ...texto.split(/\s+/).map((w) => w.length));
  const cabe = (larguraPct / 100) * 960 * 0.94 / (maior * 0.62);
  return Math.max(minimo, Math.min(maximo, Math.floor(cabe)));
}

/** A forma com o tamanho, o peso, a cor e o alinhamento novos (o texto em si não muda). */
function formatar(s: Shape, o: { tamanho: number; negrito: boolean; cor: string; align: "esquerda" | "centro"; box: Shape["box"]; ancora: "t" | "b" | "ctr" }): Shape {
  const tam = Math.max(1, tamanhoDe(s));
  const k = o.tamanho / tam;
  const run = (r: Run): Run => ({ ...r, size: Math.round((r.size ?? tam) * k * 10) / 10, color: o.cor, bold: o.negrito });
  const para = (p: Para): Para => ({ ...p, align: o.align, runs: p.runs.map(run) });
  return { ...s, box: o.box, fontSize: o.tamanho, bold: o.negrito, color: o.cor, align: o.align, anchor: o.ancora, paras: s.paras?.map(para) };
}

/**
 * A maior ZONA LIVRE da lâmina: o que sobra (ao lado, embaixo ou em cima) depois do conteúdo. É nela
 * que a arte nasce — em vez de uma faixa fixa na borda, ela preenche o espaço que o conteúdo deixou.
 * Sem zona grande o bastante (o conteúdo ocupa tudo), a arte fica nas bordas como no miolo comum.
 */
export function zonaLivre(shapes: Shape[]): ZonaArte | null {
  const vivas = shapes.filter((s) => !s.fixa && !ehDecoracaoDeModelo(s));
  if (!vivas.length) return null;
  const x0 = Math.min(...vivas.map((s) => s.box.x));
  const y0 = Math.min(...vivas.map((s) => s.box.y));
  const x1 = Math.max(...vivas.map((s) => s.box.x + s.box.w));
  const y1 = Math.max(...vivas.map((s) => s.box.y + s.box.h));
  const m = 2.5;
  const candidatas: ZonaArte[] = [
    { lado: "dir", box: { x: x1 + m, y: 0, w: 100 - (x1 + m), h: 100 } },
    { lado: "esq", box: { x: 0, y: 0, w: x0 - m, h: 100 } },
    { lado: "baixo", box: { x: 0, y: y1 + m, w: 100, h: 100 - (y1 + m) } },
    { lado: "cima", box: { x: 0, y: 0, w: 100, h: y0 - m } },
  ];
  // uma zona só vale se tem espessura para a arte aparecer (lados: 9% da largura; base/topo: 10% da altura)
  const validas = candidatas.filter((z) => (z.lado === "dir" || z.lado === "esq" ? z.box.w >= 9 : z.box.h >= 10));
  if (!validas.length) return null;
  return validas.reduce((a, b) => (b.box.w * b.box.h > a.box.w * a.box.h ? b : a));
}

/**
 * A lâmina com a arte aplicada. Cores, fonte e formato das caixas vêm do modelo (como na
 * Composição); a arte troca as decorações dele, e o fundo vira o da arte (um gradiente na paleta).
 */
export function aplicarArte(slide: Slide, arte: ArteId, semente: number, modelo: ModeloPPT, de: EstiloAtual, ratio = 16 / 9, arrumar = true): Slide {
  // o Designer ARRUMA o conteúdo: a hierarquia redesenhada, a grade, a lista… a que deixa tudo maior e legível
  const arrumada = arrumar ? melhorArranjo(slide, ratio) : slide;
  // o desenho ANTIGO do slide (triângulos, pontilhados, barrinhas) sai: a arte nova o substitui
  const velhos = enfeitesDa(arrumada);
  const semVelhos = velhos.size ? { ...arrumada, shapes: arrumada.shapes.filter((f) => !velhos.has(f.id)) } : arrumada;
  const base = aplicarModeloALamina(semVelhos, de, modelo, "recolorir", ratio);
  const paleta = paletaDoModelo(modelo);
  const papeis = papeisDaCapa(base);
  // uma "capa" com imagens ou cartões não é recomposta: a arte vai para as bordas, como no miolo
  const layoutDaArte = papeis ? base.layout : base.layout === "titulo" || base.layout === "secao" ? "conteudo" : base.layout;
  // as decorações de antes (do modelo ou de outra arte) saem; as formas da arte ficam ATRÁS de tudo
  const resto = semDesenho(base).shapes;
  let comp = comporArte(arte, semente, layoutDaArte, paleta, ratio);
  if (!comp) return base;
  // fora da capa recomposta, a arte ADAPTA-SE: ocupa a zona que o conteúdo deixou livre
  if (!papeis) {
    const zona = zonaLivre(resto);
    if (zona) comp = comporArteNaZona(arte, semente, zona, paleta, ratio);
  }
  let shapes = resto;
  if (comp.texto && papeis) {
    const cor = corLegivel(paleta.fg, comp.fundoDoTexto);
    const sub = misturar(cor, comp.fundoDoTexto, 0.3);
    const corSub = contraste(sub, comp.fundoDoTexto) >= 4.5 ? sub : cor;
    shapes = resto.map((s) => {
      if (s.id === papeis.titulo.id) return formatar(s, { tamanho: tamanhoQueCabe(textoDe(s), comp.texto!.titulo.w, 54), negrito: true, cor, align: comp.texto!.align, box: comp.texto!.titulo, ancora: "b" });
      if (papeis.subtitulo && s.id === papeis.subtitulo.id) return formatar(s, { tamanho: tamanhoQueCabe(textoDe(s), comp.texto!.subtitulo.w, 22, 14), negrito: false, cor: corSub, align: comp.texto!.align, box: comp.texto!.subtitulo, ancora: "t" });
      return s;
    });
  }
  return { ...base, shapes: [...comp.formas, ...shapes], bg: comp.fundo };
}

/** Um cartão do Designer: a arte, a semente e o modelo (a paleta) dela. */
export interface SugestaoArte {
  arte: ArteId;
  semente: number;
  modelo: ModeloPPT;
}

/**
 * A fornada de sugestões do lote: as quatro artes giram, e a paleta anda por passos primos entre si
 * (o catálogo é espalhado, não vizinho) — "Gerar mais" sempre traz combinações novas.
 */
export function sugestoesDeArte(lote: number, modelos: ModeloPPT[], porLote = 8): SugestaoArte[] {
  const saida: SugestaoArte[] = [];
  for (let i = 0; i < porLote; i++) {
    const k = lote * porLote + i;
    saida.push({ arte: ARTES[k % ARTES.length].id, semente: k, modelo: modelos[(k * 7 + lote * 3) % modelos.length] });
  }
  return saida;
}
