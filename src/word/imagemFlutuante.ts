// Imagem FLUTUANTE do Word: a imagem sai do fluxo do texto e o texto se organiza em volta
// dela — quadrado, contorno, topo e base, através, atrás e à frente.
//
// A imagem continua sendo um nó INLINE do esquema: é assim que o `.docx` importa e exporta, e
// a posição dela no texto é o que ANCORA o flutuante. Quando a quebra não é "alinhado", o
// PARÁGRAFO que a contém vira o próprio flutuante (`float` no CSS). Flutuando no nível do
// parágrafo, o texto dos parágrafos VIZINHOS se reorganiza em volta — que é o que o Word faz.
// Por isso a imagem precisa ficar sozinha no parágrafo (`deixarImagemSozinha`): com texto
// dividindo o parágrafo, o texto do próprio parágrafo ficaria espremido na caixa do flutuante.
//
// O "contorno" (o texto segue o desenho do PNG, entrando nos vãos — o círculo) vem do
// `shape-outside: url(...)`: o navegador usa o canal ALFA da imagem como forma do flutuante.

import { Plugin, PluginKey, type EditorState, type Transaction } from "prosemirror-state";
import { Decoration, DecorationSet, type EditorView } from "prosemirror-view";
import type { Node as PMNode } from "prosemirror-model";

/** Como o texto se organiza em volta da imagem. */
export type WrapImagem = "alinhado" | "quadrado" | "contorno" | "topo-base" | "atravessar" | "atras" | "frente";

/** Lado em que a imagem flutua. */
export type LadoHorizontal = "left" | "right" | "center";

/** De que lado o texto passa na imagem (os "Lados da Quebra" do Word). */
export type LadosDaQuebra = "maior" | "esquerda" | "direita";

/** Os lados da quebra, na ordem do menu. */
export const LADOS_DA_QUEBRA: { id: LadosDaQuebra; nome: string; dica: string }[] = [
  { id: "maior", nome: "O lado mais largo", dica: "O texto passa do lado que tiver mais espaço (o de sempre)" },
  { id: "esquerda", nome: "Só à esquerda", dica: "O texto passa só do lado esquerdo da imagem" },
  { id: "direita", nome: "Só à direita", dica: "O texto passa só do lado direito da imagem" },
];

/** Os modos de quebra, na ordem da fita (o do Word). */
export const MODOS_DE_QUEBRA: { id: WrapImagem; nome: string; dica: string }[] = [
  { id: "alinhado", nome: "Alinhado com o texto", dica: "A imagem fica na linha do texto, como sempre" },
  { id: "quadrado", nome: "Quadrado", dica: "O texto passa dos dois lados da imagem" },
  { id: "contorno", nome: "Contorno", dica: "O texto segue o desenho da imagem (entra nos vãos do PNG)" },
  { id: "topo-base", nome: "Topo e base", dica: "O texto passa só por cima e por baixo" },
  { id: "atravessar", nome: "Através", dica: "O texto segue o desenho e passa por cima da imagem" },
  { id: "atras", nome: "Atrás do texto", dica: "A imagem fica atrás do texto" },
  { id: "frente", nome: "À frente do texto", dica: "A imagem fica por cima do texto" },
];

export interface DadosFlutuante {
  wrap: WrapImagem;
  hAlign: LadoHorizontal;
  /** Deslocamento horizontal (px) a partir da margem. */
  hOffset: number;
  /** Deslocamento vertical (px) a partir do parágrafo âncora. */
  vOffset: number;
  /** Distância do texto (px) no contorno. */
  shapeMargin: number;
  /** De que lado o texto passa. */
  lados: LadosDaQuebra;
  /** A imagem fica na mesma altura da PÁGINA (não anda com o texto). */
  fixa: boolean;
  /** A altura da imagem a partir do topo da página (px) — só quando `fixa`. */
  pageOffset: number;
}

/** Lê os dados de flutuação de um nó de imagem (atributos do esquema). */
export function dadosDaImagem(attrs: Record<string, unknown>): DadosFlutuante {
  const wrap = attrs.wrap as WrapImagem;
  const hAlign = attrs.hAlign as LadoHorizontal;
  const lados = attrs.lados as LadosDaQuebra;
  return {
    wrap: MODOS_DE_QUEBRA.some((m) => m.id === wrap) ? wrap : "alinhado",
    hAlign: hAlign === "right" || hAlign === "center" ? hAlign : "left",
    hOffset: Number(attrs.hOffset) || 0,
    vOffset: Number(attrs.vOffset) || 0,
    shapeMargin: attrs.shapeMargin == null ? 8 : Number(attrs.shapeMargin) || 0,
    lados: LADOS_DA_QUEBRA.some((m) => m.id === lados) ? lados : "maior",
    fixa: attrs.fixa === true,
    pageOffset: Number(attrs.pageOffset) || 0,
  };
}

/** A imagem sai do fluxo do texto? */
export function ehFlutuante(d: DadosFlutuante): boolean {
  return d.wrap !== "alinhado";
}

/** O texto se organiza em volta (a imagem é um `float` do CSS)? */
export function ehFloatDeTexto(d: DadosFlutuante): boolean {
  return d.wrap === "quadrado" || d.wrap === "contorno" || d.wrap === "topo-base" || d.wrap === "atravessar";
}

/** O texto segue o desenho do PNG (o `shape-outside`)? */
export function ehContorno(d: DadosFlutuante): boolean {
  return d.wrap === "contorno" || d.wrap === "atravessar";
}

/**
 * Para que lado a imagem flutua (o `float` do CSS).
 *
 * O CSS não tem "texto dos dois lados": um flutuante joga o texto para o lado
 * OPOSTO. Por isso os "lados da quebra" escolhem para onde o texto vai — "só à
 * direita" põe a imagem à esquerda — que é o que o Word faz na prática.
 */
export function flutuaPara(d: DadosFlutuante): "left" | "right" {
  if (d.lados === "esquerda") return "right"; // o texto só à esquerda → a imagem vai à direita
  if (d.lados === "direita") return "left"; // o texto só à direita → a imagem vai à esquerda
  return d.hAlign === "right" ? "right" : "left";
}

/**
 * A posição horizontal do flutuante anda na margem **direita** (e não na esquerda)?
 * Só no float à direita: nos outros casos (float à esquerda/centro, "topo e base" e a imagem
 * absoluta) a posição é a margem esquerda.
 */
export function andaNaMargemDireita(d: DadosFlutuante): boolean {
  if (d.lados !== "maior") return flutuaPara(d) === "right";
  return d.hAlign === "right" && (d.wrap === "quadrado" || d.wrap === "contorno" || d.wrap === "atravessar");
}

// ---------------------------------------------------------------------------
// O contorno: o `shape-outside` com o PNG (data URL) fica numa folha de estilo
// viva — no atributo `style` do parágrafo ele viraria uma eternidade de texto.
// ---------------------------------------------------------------------------

let folhaDeContorno: HTMLStyleElement | null = null;
const regrasDeContorno = new Map<string, string>();

/** Hash curto e estável do src (o nome da classe precisa sobreviver ao redesenho). */
function hashCurto(s: string): string {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(36);
}

/** Classe CSS que dá à imagem o formato do desenho (o texto contorna o PNG). */
export function classeDoContorno(src: string): string {
  const nome = `wd-contorno-${hashCurto(src)}`;
  if (regrasDeContorno.has(nome)) return nome;
  const seguro = String(src).replace(/"/g, "%22");
  regrasDeContorno.set(nome, `.${nome}{shape-outside:url("${seguro}");shape-box:border-box}`);
  // fora do navegador (o teste do módulo roda no Node) não há folha de estilo para escrever
  if (typeof document === "undefined") return nome;
  if (!folhaDeContorno) {
    folhaDeContorno = document.createElement("style");
    folhaDeContorno.id = "wd-contornos";
    document.head.append(folhaDeContorno);
  }
  folhaDeContorno.textContent = [...regrasDeContorno.values()].join("\n");
  return nome;
}

// ---------------------------------------------------------------------------
// Os estilos do flutuante
// ---------------------------------------------------------------------------

export interface EstilosFlutuante {
  /** Estilo do PARÁGRAFO (que é o flutuante). */
  paragrafo: string;
  /** Estilo da IMAGEM dentro do parágrafo. */
  imagem: string;
}

/**
 * Os valores AO VIVO do gesto em andamento (arrasto ou redimensionamento).
 *
 * Eles entram na **decoração**, que o ProseMirror redesenha junto com a página. Escrever
 * a posição à mão no elemento (ou numa variável CSS dele) não serve: o ProseMirror recria
 * o parágrafo a cada atualização e o que estava escrito nele morre com o elemento antigo
 * — era por isso que o texto não acompanhava o arrasto.
 */
export interface GestoAoVivo {
  /** posição da imagem no documento */
  pos: number;
  /** deslocamento horizontal em px, já com o sinal da margem do lado certo */
  dx?: number;
  /** deslocamento vertical em px */
  dy?: number;
  /** tamanho ao vivo (redimensionamento), em px de papel */
  largura?: number;
  altura?: number;
}

let gestoAoVivo: GestoAoVivo | null = null;

/** Guarda (ou limpa, com `null`) o gesto em andamento. */
export function definirGestoAoVivo(g: GestoAoVivo | null): void {
  gestoAoVivo = g;
}

/** O gesto em andamento (a decoração lê daqui). */
export function gestoAoVivoAtual(): GestoAoVivo | null {
  return gestoAoVivo;
}

/**
 * Estilo do parágrafo-âncora (o flutuante) e da imagem dentro dele.
 *
 * `larguraConteudo` é a largura da área de texto da página (px) — usada para centralizar.
 * `aoVivo` são os valores do gesto em andamento: eles entram somados à posição guardada,
 * e mudam a largura do flutuante no redimensionamento (o texto se reacomoda na hora).
 */
export function estiloDoFlutuante(
  d: DadosFlutuante,
  larguraConteudo: number,
  larguraImagem: number,
  aoVivo: GestoAoVivo | null = null,
): EstilosFlutuante {
  if (!ehFlutuante(d)) return { paragrafo: "", imagem: "" };
  const p: string[] = [];
  const i: string[] = [];
  const w = Math.max(1, Math.round(aoVivo?.largura ?? larguraImagem));
  const off = Math.round(d.vOffset + (aoVivo?.dy ?? 0));
  const offH = Math.round(d.hOffset + (aoVivo?.dx ?? 0));
  switch (d.wrap) {
    case "quadrado":
    case "contorno":
    case "atravessar": {
      // o lado do texto manda no `float` (e, quando ele não foi escolhido, é o alinhamento)
      const direita = flutuaPara(d) === "right";
      const centralizado = d.lados === "maior" && d.hAlign === "center";
      p.push(`float:${direita ? "right" : "left"}`);
      p.push(`width:${w}px`);
      p.push("line-height:0");
      p.push(`margin-top:${off}px`);
      p.push("margin-bottom:0");
      // no contorno a distância do texto vem do `shape-margin`, não da margem
      if (ehContorno(d)) p.push(`shape-margin:${d.shapeMargin}px`);
      if (centralizado) {
        const central = Math.max(0, Math.round((larguraConteudo - w) / 2));
        p.push(`margin-left:${central + offH}px`);
        p.push("margin-right:0");
      } else if (direita) {
        p.push(`margin-right:${offH}px`);
        // no contorno a distância do texto vem do `shape-margin`, não da margem
        p.push(`margin-left:${ehContorno(d) ? 0 : d.shapeMargin}px`);
      } else {
        p.push(`margin-left:${offH}px`);
        p.push(`margin-right:${ehContorno(d) ? 0 : d.shapeMargin}px`);
      }
      // "através": a imagem FICA ATRÁS do texto (o texto passa por cima dela)
      if (d.wrap === "atravessar") i.push("position:relative;z-index:-1");
      break;
    }
    case "topo-base": {
      // o texto passa só por cima e por baixo: a imagem é um BLOCO no fluxo (não um float),
      // e a posição na página sai da margem
      p.push(`width:${w}px`);
      p.push("line-height:0");
      p.push(`margin-top:${off}px`);
      p.push("margin-bottom:0");
      const sobra = Math.max(0, Math.round(larguraConteudo - w));
      if (d.hAlign === "center") p.push(`margin-left:${Math.round(sobra / 2) + offH}px`);
      else if (d.hAlign === "right") p.push(`margin-left:${Math.max(0, sobra - offH)}px`);
      else p.push(`margin-left:${offH}px`);
      p.push("margin-right:0");
      break;
    }
    case "atras":
    case "frente": {
      // o parágrafo some (é só a âncora): a imagem sai do fluxo e fica solta na página
      p.push("height:0");
      p.push("line-height:0");
      p.push("margin-top:0");
      p.push("margin-bottom:0");
      p.push("margin-left:0");
      p.push("margin-right:0");
      i.push("position:absolute");
      i.push(d.wrap === "atras" ? "z-index:-1" : "z-index:2");
      // a imagem absoluta nasce na posição do texto: a margem a joga para o lado pedido
      const sobra = Math.max(0, Math.round(larguraConteudo - w));
      if (d.hAlign === "center") i.push(`margin-left:${Math.round(sobra / 2) + offH}px`);
      else if (d.hAlign === "right") i.push(`margin-left:${Math.max(0, sobra - offH)}px`);
      else i.push(`margin-left:${offH}px`);
      i.push(`margin-top:${off}px`);
      break;
    }
    default:
      break;
  }
  // redimensionamento ao vivo: o tamanho vai pela DECORAÇÃO, não pelo `style` da imagem —
  // o ProseMirror pode recriar a imagem no meio do gesto e o que estiver escrito à mão morre
  // com o elemento antigo (o desenho voltaria ao tamanho guardado)
  if (aoVivo?.largura) {
    i.push(`--wd-iw:${w}px`);
    i.push(`--wd-ih:${Math.max(1, Math.round(aoVivo.altura ?? w))}px`);
  }
  return { paragrafo: p.join(";"), imagem: i.join(";") };
}

// ---------------------------------------------------------------------------
// O plugin: pinta o flutuante nos parágrafos
// ---------------------------------------------------------------------------

/**
 * A posição da imagem que está **atrás do texto** no ponto clicado (ou `null`).
 *
 * As quebras "Atrás do texto" e "Através" desenham a imagem com `z-index` negativo: o clique
 * cai no TEXTO, que está por cima, e a imagem nunca é selecionada — sem seleção não há alças,
 * e ela deixa de poder ser movida ou redimensionada. O Word resolve dando prioridade ao
 * objeto: aqui o clique dentro do retângulo da imagem a seleciona (o CSS a levanta enquanto
 * está selecionada, para as alças ficarem alcançáveis).
 */
export function posDaImagemAtrasNoPonto(view: EditorView, x: number, y: number): number | null {
  let achado: number | null = null;
  view.state.doc.descendants((no, pos) => {
    if (achado != null) return false;
    if (no.type.name !== "image") return true;
    const d = dadosDaImagem(no.attrs as Record<string, unknown>);
    if (!ehFlutuante(d)) return true;
    const atras = d.wrap === "atras" || d.wrap === "atravessar";
    if (!atras) return true;
    const el = view.nodeDOM(pos);
    if (!(el instanceof HTMLElement)) return true;
    const r = el.getBoundingClientRect();
    if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) achado = pos;
    return true;
  });
  return achado;
}

export const flutuanteKey = new PluginKey<FlutuanteState>("flutuante");

export interface FlutuanteHooks {
  /** Largura da área de texto da página (px) — para centralizar a imagem. */
  larguraConteudo: () => number;
}

export interface FlutuanteState {
  /** as decorações do flutuante */
  decos: DecorationSet;
  /** o parágrafo que ficaria com a imagem (no arrasto): recebe a marca de destino */
  ancora: number | null;
}

/** O nó de imagem é o ÚNICO conteúdo do parágrafo? (condição para o parágrafo flutuar) */
function imagemSozinha(no: PMNode): PMNode | null {
  if (no.childCount !== 1) return null;
  const filho = no.firstChild;
  if (!filho || filho.type.name !== "image") return null;
  return filho;
}

function montar(state: EditorState, hooks: FlutuanteHooks, ancora: number | null): DecorationSet {
  const larguraConteudo = hooks.larguraConteudo();
  const decos: Decoration[] = [];
  state.doc.descendants((no, pos) => {
    if (no.type.name !== "paragraph" && no.type.name !== "heading") return true;
    const img = imagemSozinha(no);
    if (!img) return false;
    const d = dadosDaImagem(img.attrs as Record<string, unknown>);
    if (!ehFlutuante(d)) return false;
    const imgPos = pos + 1;
    // o gesto em andamento (arrasto/redimensionamento) entra na decoração: é ela que o
    // ProseMirror redesenha quando recria o parágrafo, então o ao vivo não se perde
    const vivo = gestoAoVivoAtual();
    const aoVivo = vivo && vivo.pos === imgPos ? vivo : null;
    const estilos = estiloDoFlutuante(d, larguraConteudo, Number(img.attrs.width) || 0, aoVivo);
    const classe = ehContorno(d) ? classeDoContorno(String(img.attrs.src)) : "";
    // o `style` da decoração é SOMADO ao do parágrafo (o do flutuante vem por último e ganha)
    decos.push(Decoration.node(pos, pos + no.nodeSize, { class: `wd-flutuante ${classe}`.trim(), style: estilos.paragrafo }));
    if (estilos.imagem) {
      const classeImg = `wd-img-${d.wrap}${aoVivo ? " wd-img-ao-vivo" : ""}`;
      decos.push(Decoration.node(imgPos, imgPos + img.nodeSize, { class: classeImg, style: estilos.imagem }));
    }
    return false;
  });
  // o parágrafo que ficaria com a imagem no arrasto: a barrinha de acento
  if (ancora != null) {
    const no = state.doc.nodeAt(ancora);
    if (no) decos.push(Decoration.node(ancora, ancora + no.nodeSize, { class: "wd-ancora-alvo" }));
  }
  return DecorationSet.create(state.doc, decos);
}

/** O plugin que transforma o parágrafo-âncora no flutuante. */
export function pluginFlutuante(hooks: FlutuanteHooks): Plugin<FlutuanteState> {
  return new Plugin<FlutuanteState>({
    key: flutuanteKey,
    state: {
      init: (_config, state) => ({ decos: montar(state, hooks, null), ancora: null }),
      apply(tr, value, _old, newState) {
        const meta = tr.getMeta(flutuanteKey) as { refresh?: boolean; ancora?: number | null } | undefined;
        if (meta?.refresh) return { decos: montar(newState, hooks, value.ancora), ancora: value.ancora };
        if (meta && "ancora" in meta) {
          const ancora = meta.ancora ?? null;
          return { decos: montar(newState, hooks, ancora), ancora };
        }
        if (!tr.docChanged) return { decos: value.decos.map(tr.mapping, tr.doc), ancora: value.ancora };
        // o documento mudou: a âncora candidata pode ter ido embora
        const ancora = value.ancora != null && newState.doc.nodeAt(value.ancora) ? value.ancora : null;
        return { decos: montar(newState, hooks, ancora), ancora };
      },
    },
    props: {
      decorations(state) {
        return flutuanteKey.getState(state)?.decos ?? DecorationSet.empty;
      },
    },
  });
}

/**
 * Marca (ou desmarca) o parágrafo que ficaria com a imagem no arrasto.
 *
 * A marca é a barrinha de acento à esquerda do parágrafo — ela diz ONDE a
 * imagem vai ficar ancorada, que é a informação que o arrasto precisa dar.
 */
export function marcarAncora(view: EditorView, ancora: number | null): void {
  view.dispatch(view.state.tr.setMeta(flutuanteKey, { ancora }).setMeta("addToHistory", false));
}

/** Redesenha os flutuantes (a página mudou: a largura da área de texto mudou). */
export function requestingFlutuante(state: EditorState): Transaction {
  return state.tr.setMeta(flutuanteKey, { refresh: true });
}

// ---------------------------------------------------------------------------
// Deixar a imagem sozinha no parágrafo
// ---------------------------------------------------------------------------

/**
 * Deixa a imagem sozinha no seu parágrafo: o flutuante é o parágrafo, e um texto dividindo
 * o parágrafo com a imagem ficaria espremido na caixa do flutuante. Devolve a transação e a
 * nova posição da imagem.
 *
 * Aceita um estado (começa uma transação nova) ou uma transação já em andamento (continua
 * nela) — é o que o arrasto precisa, quando a imagem já foi movida de parágrafo.
 */
export function deixarImagemSozinha(base: EditorState | Transaction, imgPos: number): { tr: Transaction; pos: number } {
  const img = base.doc.nodeAt(imgPos);
  if (!img || img.type.name !== "image") return { tr: "tr" in base ? base.tr : base, pos: imgPos };
  const $pos = base.doc.resolve(imgPos);
  const parent = $pos.parent;
  if (parent.type.name !== "paragraph" && parent.type.name !== "heading") {
    return { tr: "tr" in base ? base.tr : base, pos: imgPos };
  }
  if (parent.childCount === 1) return { tr: "tr" in base ? base.tr : base, pos: imgPos };
  let tr = "tr" in base ? base.tr : base;
  let pos = imgPos;
  const offset = $pos.parentOffset;
  const temAntes = offset > 0;
  const temDepois = offset + img.nodeSize < parent.content.size;
  if (temAntes) {
    tr = tr.split(pos, 1);
    pos = tr.mapping.map(pos, 1);
  }
  if (temDepois) tr = tr.split(pos + img.nodeSize, 1);
  return { tr, pos };
}
