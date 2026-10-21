// Imagem do Word como NodeView: clique seleciona, as alças redimensionam (mantendo a
// proporção) e o arrasto move a imagem.
//
// Duas formas de arrasto, como no Word:
//  - imagem ALINHADA COM O TEXTO: a alça pontilhada (e o próprio corpo) tira a imagem do
//    lugar e a reinsere noutro ponto do texto (recortar e colar);
//  - imagem FLUTUANTE (quadrado, contorno, topo e base, através, atrás, à frente): o
//    arrasto MOVE a imagem e o texto se reorganiza em volta enquanto o gesto acontece —
//    o deslocamento vai direto para o elemento flutuante, sem passar pelo documento, e só
//    no fim do gesto vira uma transação (Ctrl+Z desfaz). Quando a imagem é solta sobre
//    OUTRO parágrafo, a ÂNCORA dela muda: o nó vai para lá e o texto passa a se acomodar
//    em volta no ponto novo (como no Word e no WordCraft).
//
// O gesto de mover o flutuante mora FORA do NodeView (no módulo): a paginação redesenha
// a página no meio do gesto e o NodeView é remontado — se o estado do gesto ficasse
// nele, o "soltar" se perderia.
//
// O tamanho vive nos atributos `width`/`height` do nó (é o que o .docx importa/exporta),
// então o redimensionamento sobrevive a salvar, reabrir e desfazer (uma transação por
// gesto: Ctrl+Z volta ao tamanho anterior).

import type { Node as PMNode } from "prosemirror-model";
import { NodeSelection, TextSelection } from "prosemirror-state";
import { moverImagem } from "./imagemMover";
import { ancoraCandidata, moverParaParagrafo, paragrafoDa } from "./ancoraImagem";
import {
  andaNaMargemDireita,
  dadosDaImagem,
  definirGestoAoVivo,
  ehFlutuante,
  ehFloatDeTexto,
  marcarAncora,
  requestingFlutuante,
  type DadosFlutuante,
} from "./imagemFlutuante";
import type { EditorView, NodeView } from "prosemirror-view";

/** Tamanho mínimo de uma imagem redimensionada (px). */
const MINIMO = 24;

// ---------------------------------------------------------------------------
// O gesto de MOVER a imagem flutuante (fora do NodeView — ver o aviso do topo)
// ---------------------------------------------------------------------------

interface GestoFlutuante {
  /** a posição do nó da imagem no documento */
  pos: number;
  /** de onde o gesto saiu (px de tela) */
  x: number;
  y: number;
  /** última posição do ponteiro (px de tela) — o "soltar" usa ela para gravar o destino */
  ultimoX: number;
  ultimoY: number;
  /** o deslocamento que a imagem tinha antes do gesto */
  hOffset: number;
  vOffset: number;
  /** os dados de flutuação no começo do gesto */
  dados: DadosFlutuante;
  /** o flutuante é o PARÁGRAFO (true) ou a própria imagem absoluta (false) */
  alvoÉParagrafo: boolean;
  /** o parágrafo que ficaria com a imagem (a âncora candidata) */
  ancora: number | null;
}

/** Só um gesto por vez (o do módulo — o NodeView pode ser remontado no meio dele). */
let gestoFlutuante: GestoFlutuante | null = null;

/** O retângulo da imagem na tela (o NodeView pode ter sido remontado). */
function caixaDaImagem(view: EditorView, pos: number): DOMRect | null {
  const no = view.nodeDOM(pos);
  if (!(no instanceof HTMLElement)) return null;
  const img = no.querySelector("img") ?? no;
  return img.getBoundingClientRect();
}

/** A escala da vista: o ponteiro anda em pixels de TELA, o documento em pixels de PAPEL. */
function escalaDaVista(view: EditorView): number {
  const dom = view.dom as HTMLElement;
  const caixa = dom.getBoundingClientRect();
  const s = caixa.width / dom.offsetWidth;
  return s > 0.05 ? s : 1;
}

/**
 * Começa o gesto de MOVER a imagem flutuante.
 *
 * O deslocamento vai direto para o elemento flutuante (o parágrafo, quando a imagem
 * é um `float`; a própria imagem, quando ela é absoluta) — o navegador reflui o
 * texto em volta a cada movimento. No fim do gesto o deslocamento vira uma transação.
 */
function iniciarGestoFlutuante(view: EditorView, pos: number, dados: DadosFlutuante, e: PointerEvent): void {
  const alvoÉParagrafo = ehFloatDeTexto(dados);
  gestoFlutuante = {
    pos,
    x: e.clientX,
    y: e.clientY,
    ultimoX: e.clientX,
    ultimoY: e.clientY,
    hOffset: dados.hOffset,
    vOffset: dados.vOffset,
    dados,
    alvoÉParagrafo,
    ancora: null,
  };
  // As escutas ficam na JANELA, na fase de CAPTURA: o ProseMirror consome o ponteiro
  // e o parágrafo pode ser remontado no meio do gesto (a paginação redesenha a
  // página) — com a escuta no elemento, o "soltar" nunca chegaria.
  const mover = (ev: PointerEvent) => arrastarGestoFlutuante(view, ev);
  const soltar = () => {
    window.removeEventListener("pointermove", mover, true);
    window.removeEventListener("pointerup", soltar, true);
    window.removeEventListener("pointercancel", soltar, true);
    soltarGestoFlutuante(view);
  };
  window.addEventListener("pointermove", mover, true);
  window.addEventListener("pointerup", soltar, true);
  window.addEventListener("pointercancel", soltar, true);
  // o cursor de "arrastando" (o CSS cuida do resto)
  const no = view.nodeDOM(pos);
  if (no instanceof HTMLElement) no.classList.add("movendo");
}

/** Move o flutuante AO VIVO: o texto se reorganiza em volta enquanto o dedo arrasta. */
function arrastarGestoFlutuante(view: EditorView, e: PointerEvent): void {
  const g = gestoFlutuante;
  if (!g) return;
  g.ultimoX = e.clientX;
  g.ultimoY = e.clientY;
  const escala = escalaDaVista(view);
  const dx = (e.clientX - g.x) / escala;
  const dy = (e.clientY - g.y) / escala;
  // o deslocamento vai pela DECORAÇÃO (o plugin redesenha o flutuante): escrever no
  // elemento não serve — o ProseMirror recria o parágrafo a cada atualização e o texto
  // ficaria parado enquanto a imagem anda.
  // float à direita: anda a margem DIREITA (aumentar a margem joga a imagem para a esquerda);
  // nos outros casos (float à esquerda/centro, "topo e base" e imagem absoluta) anda a esquerda
  const passo = andaNaMargemDireita(g.dados) ? -dx : dx;
  definirGestoAoVivo({ pos: g.pos, dx: passo, dy });
  view.dispatch(requestingFlutuante(view.state));
  // a ÂNCORA candidata: o parágrafo que ficaria com a imagem (o texto sob a borda
  // superior dela). É o que o Word faz ao arrastar — a imagem troca de parágrafo e
  // o texto passa a se acomodar em volta no ponto novo.
  const caixa = caixaDaImagem(view, g.pos);
  if (!caixa) return;
  const texto = textoNaAltura(view, g, caixa.top + 1);
  const candidata = texto != null ? ancoraCandidata(view.state, texto) : null;
  const ancora = candidata?.paragrafo ?? null;
  if (ancora === g.ancora) return;
  g.ancora = ancora;
  marcarAncora(view, ancora);
}

/**
 * A posição do texto na altura dada — o parágrafo que está ali.
 *
 * O ponto é procurado do lado OPOSTO ao da imagem (é de lá que vem o texto que
 * contorna o flutuante) e um pouco afastado dela: colado na borda da imagem o
 * navegador não acha texto (ali é a folga do contorno) e devolve a própria imagem.
 */
function textoNaAltura(view: EditorView, g: GestoFlutuante, y: number): number | null {
  const caixa = caixaDaImagem(view, g.pos);
  if (!caixa) return null;
  const coluna = view.dom.getBoundingClientRect();
  const dentroDaImagem = (pos: number): boolean => {
    const no = view.state.doc.nodeAt(g.pos);
    if (!no) return false;
    return pos >= g.pos && pos <= g.pos + no.nodeSize;
  };
  const xs = [
    caixa.right + 10,
    caixa.right + 26,
    caixa.right + 48,
    caixa.left - 10,
    caixa.left - 26,
    caixa.left - 48,
    coluna.left + 4,
    coluna.right - 4,
  ];
  for (const yy of [y, y + 4, y + 8]) {
    for (const x of xs) {
      const coords = view.posAtCoords({ left: x, top: yy });
      if (!coords || dentroDaImagem(coords.pos)) continue;
      return coords.pos;
    }
  }
  return null;
}

/**
 * Grava o gesto no documento.
 *
 * Duas saídas:
 *  - a imagem foi solta sobre OUTRO parágrafo: a **âncora muda** (o nó vai para
 *    lá e o texto se acomoda em volta no ponto novo);
 *  - a âncora é a mesma: só o deslocamento muda (a imagem passeia na página).
 */
function soltarGestoFlutuante(view: EditorView): void {
  const g = gestoFlutuante;
  gestoFlutuante = null;
  if (!g) return;
  // a marca do destino some
  marcarAncora(view, null);
  // o cursor de "arrastando" sai
  const no = view.nodeDOM(g.pos);
  if (no instanceof HTMLElement) no.classList.remove("movendo");
  // o topo da imagem no momento do "soltar" (com o deslocamento do gesto): é
  // onde ela tem que ficar depois da troca de âncora
  const caixa = caixaDaImagem(view, g.pos);
  const topoSoltar = caixa ? caixa.top : 0;
  // o gesto acabou: o ao vivo sai e a posição volta a ser a do documento (a transação
  // do fim redesenha o flutuante já com os valores guardados)
  definirGestoAoVivo(null);
  const escala = escalaDaVista(view);
  const dx = (g.ultimoX - g.x) / escala;
  const dy = (g.ultimoY - g.y) / escala;
  const atual = view.state.doc.nodeAt(g.pos);
  if (!atual || atual.type.name !== "image") return;

  // o deslocamento horizontal final é o que o gesto JÁ mostrou (o mesmo número do ao vivo):
  // medir o DOM aqui daria outro valor (o elemento pode já ter voltado para a posição antiga)
  const hOffset = Math.round(g.hOffset + (andaNaMargemDireita(g.dados) ? -dx : dx));

  // a âncora nova: a imagem vai para o parágrafo escolhido
  const paragrafoAtual = paragrafoDa(view.state, g.pos);
  if (g.ancora != null && g.ancora !== paragrafoAtual) {
    reancorarImagem(view, g, g.ancora, topoSoltar, hOffset);
    return;
  }

  const vOffset = Math.round(g.vOffset + dy);
  if (hOffset === g.hOffset && vOffset === g.vOffset) return;
  const attrs: Record<string, unknown> = { ...atual.attrs, hOffset, vOffset };
  // "fixa na página": o arrasto move a imagem, então a altura dela DENTRO da página
  // anda junto — senão o acerto da paginação puxaria a imagem de volta
  if (atual.attrs.fixa) {
    attrs.pageOffset = Math.round((Number(atual.attrs.pageOffset) || 0) + (vOffset - g.vOffset));
  }
  const tr = view.state.tr.setNodeMarkup(g.pos, undefined, attrs);
  // trocar o nó zera o NodeSelection (vira cursor de texto) e as alças sumiriam
  tr.setSelection(NodeSelection.create(tr.doc, g.pos));
  view.dispatch(tr);
}

/**
 * Troca a âncora da imagem: o nó vai para o parágrafo escolhido e o deslocamento
 * é recalculado a partir dele — a imagem continua onde foi solta e o texto passa a
 * se acomodar em volta no ponto novo.
 *
 * A sequência é a do WordCraft (ArtCraft — MIT OR Apache-2.0): o objeto é tirado
 * do parágrafo de origem e reinserido no parágrafo que ficou sob ele; o
 * deslocamento é a distância entre onde ele foi solto e a nova origem.
 */
function reancorarImagem(view: EditorView, g: GestoFlutuante, paragrafo: number, topoSoltar: number, hOffset: number): void {
  const movido = moverParaParagrafo(view.state, g.pos, paragrafo + 1);
  if (!movido) return;
  const tr = movido.tr;
  const imagem = tr.doc.nodeAt(movido.pos);
  if (!imagem) return;
  // o deslocamento horizontal vem do gesto (a coluna não muda de lugar)
  tr.setNodeMarkup(movido.pos, undefined, { ...imagem.attrs, hOffset });
  tr.setSelection(NodeSelection.create(tr.doc, movido.pos));
  view.dispatch(tr);
  // o deslocamento VERTICAL sai da nova origem: depois do movimento o texto acima
  // mudou de lugar, então a origem só é conhecida agora (com o documento já
  // redesenhado)
  const escala = escalaDaVista(view);
  const caixa = caixaDaImagem(view, movido.pos);
  if (!caixa) return;
  const vOffset = Math.round(g.vOffset + (topoSoltar - caixa.top) / escala);
  const attrs: Record<string, unknown> = { ...(view.state.doc.nodeAt(movido.pos)?.attrs ?? {}), vOffset };
  // "fixa na página": a âncora mudou, então a altura dentro da página também. Quem mede
  // é a paginação (que conhece o passo da página): -1 pede a medição na próxima passada.
  if (attrs.fixa) attrs.pageOffset = -1;
  const tr2 = view.state.tr.setNodeMarkup(movido.pos, undefined, attrs);
  tr2.setSelection(NodeSelection.create(tr2.doc, movido.pos));
  view.dispatch(tr2);
}

// ---------------------------------------------------------------------------
// O NodeView
// ---------------------------------------------------------------------------

export class ImagemView implements NodeView {
  readonly dom: HTMLElement;
  private img: HTMLImageElement;
  private alca: HTMLElement;
  private node: PMNode;
  private readonly view: EditorView;
  private readonly getPos: () => number | undefined;
  /** proporção largura/altura natural (ou a do tamanho atual) */
  private proporcao = 1;
  private gesto: { x: number; y: number; w: number; h: number; dir: string } | null = null;
  /** dados de flutuação da imagem atual (o modo de quebra) */
  private dados: DadosFlutuante = dadosDaImagem({});

  constructor(node: PMNode, view: EditorView, getPos: () => number | undefined) {
    this.node = node;
    this.view = view;
    this.getPos = getPos;

    this.dom = document.createElement("span");
    this.dom.className = "wd-img";
    this.dom.setAttribute("contenteditable", "false");

    this.img = document.createElement("img");
    this.img.draggable = false;
    // a proporção natural chega quando a imagem termina de carregar
    this.img.addEventListener("load", () => {
      if (this.img.naturalWidth && this.img.naturalHeight) {
        this.proporcao = this.img.naturalWidth / this.img.naturalHeight;
      }
    });
    this.dom.append(this.img);

    // alça de arrastar (mover no texto) — gesto de PONTEIRO, não o drag nativo: o drag do
    // navegador não avisa o ProseMirror e o nó ficava preso no lugar ao soltar
    this.alca = document.createElement("span");
    this.alca.className = "wd-img-alca";
    this.alca.title = "Arrastar a imagem";
    this.alca.innerHTML = "<i></i><i></i><i></i><i></i><i></i><i></i>";
    this.alca.addEventListener("pointerdown", (e) => {
      if (e.button !== 0) return;
      e.preventDefault();
      e.stopPropagation();
      this.iniciarMovimento(e, this.alca);
    });
    this.dom.append(this.alca);

    // oito alças de redimensionar
    for (const dir of ["nw", "n", "ne", "w", "e", "sw", "s", "se"]) {
      const ponto = document.createElement("span");
      ponto.className = `wd-img-p p-${dir}`;
      ponto.dataset.canto = dir;
      this.dom.append(ponto);
      ponto.addEventListener("pointerdown", (e) => this.iniciarGesto(e, dir, ponto));
    }

    // clique seleciona a imagem; arrastar o CORPO também move (como no Word)
    this.img.addEventListener("pointerdown", (e) => {
      if (e.button !== 0) return;
      e.preventDefault();
      this.selecionar();
      this.iniciarMovimento(e, this.img);
    });

    this.aplicar(node);
  }

  update(node: PMNode): boolean {
    if (node.type !== this.node.type) return false;
    this.node = node;
    this.aplicar(node);
    return true;
  }

  selectNode(): void {
    this.dom.classList.add("sel");
  }

  deselectNode(): void {
    this.dom.classList.remove("sel");
    this.encerrarGesto();
  }

  /** As alças e o clique são nossos: o ProseMirror não deve tratar esses eventos. */
  stopEvent(event: Event): boolean {
    const alvo = event.target as HTMLElement | null;
    if (!alvo) return false;
    if (alvo.closest(".wd-img-p")) return true;
    if ((event.type === "pointerdown" || event.type === "mousedown") && (alvo === this.img || alvo === this.alca)) return true;
    return false;
  }

  /** O DOM interno (alças, tamanho ao vivo) é nosso: não deixa o PM achar que o doc mudou. */
  ignoreMutation(): boolean {
    return true;
  }

  destroy(): void {
    this.encerrarGesto();
    // a imagem saiu do documento? (o NodeView é remontado o tempo todo — quando
    // a paginação redesenha a página — e o gesto tem de continuar)
    const g = gestoFlutuante;
    if (!g) return;
    const no = this.view.state.doc.nodeAt(g.pos);
    if (!no || no.type.name !== "image") gestoFlutuante = null;
  }

  /** Lê os atributos e desenha a imagem; guarda a proporção para o redimensionamento. */
  private aplicar(node: PMNode): void {
    const { src, alt, width, height } = node.attrs as {
      src: string;
      alt: string | null;
      width: number | null;
      height: number | null;
    };
    this.img.src = src;
    this.img.alt = alt ?? "";
    this.img.style.width = width ? `${width}px` : "";
    this.img.style.height = height ? `${height}px` : "";
    // proporção: a natural quando já carregou; senão a do tamanho declarado
    if (this.img.naturalWidth && this.img.naturalHeight) {
      this.proporcao = this.img.naturalWidth / this.img.naturalHeight;
    } else if (width && height) {
      this.proporcao = width / height;
    }
    this.dados = dadosDaImagem(node.attrs as Record<string, unknown>);
  }

  private selecionar(): void {
    const pos = this.getPos();
    if (typeof pos !== "number") return;
    // foca ANTES de trocar a seleção: focar depois faria o navegador pôr o cursor de
    // texto e a seleção da imagem se perderia (as alças sumiam ao soltar o gesto)
    this.view.focus();
    const sel = NodeSelection.create(this.view.state.doc, pos);
    this.view.dispatch(this.view.state.tr.setSelection(sel));
  }

  /**
   * O zoom da vista: o ponteiro anda em pixels de TELA, o documento em pixels de PAPEL.
   * Sem esta divisão o gesto sai torto (e o redimensionamento gravava o tamanho errado).
   */
  private escala(): number {
    return escalaDaVista(this.view);
  }

  // ---------- mover ----------

  /** Gesto de mover: de onde saiu, para onde vai e se já andou o bastante para valer. */
  private movendo: { pos: number; x: number; y: number; alvo: number | null; andou: boolean } | null = null;

  private iniciarMovimento(e: PointerEvent, alvo: HTMLElement): void {
    // imagem FLUTUANTE: o arrasto move a imagem e o texto se ajusta em volta ao vivo
    if (ehFlutuante(this.dados)) {
      const pos = this.getPos();
      if (typeof pos !== "number") return;
      this.selecionar();
      iniciarGestoFlutuante(this.view, pos, this.dados, e);
      return;
    }
    const pos = this.getPos();
    if (typeof pos !== "number") return;
    this.selecionar();
    this.movendo = { pos, x: e.clientX, y: e.clientY, alvo: null, andou: false };
    try {
      alvo.setPointerCapture(e.pointerId);
    } catch {
      /* ponteiro sintético (teste) não tem captura */
    }
    const mover = (ev: PointerEvent) => this.arrastarMovimento(ev);
    const soltar = () => {
      alvo.removeEventListener("pointermove", mover);
      alvo.removeEventListener("pointerup", soltar);
      alvo.removeEventListener("pointercancel", soltar);
      this.soltarMovimento();
    };
    alvo.addEventListener("pointermove", mover);
    alvo.addEventListener("pointerup", soltar);
    alvo.addEventListener("pointercancel", soltar);
  }

  /** Mostra onde a imagem vai cair (cursor de texto); soltar é quem move. */
  private arrastarMovimento(e: PointerEvent): void {
    const m = this.movendo;
    if (!m) return;
    if (!m.andou && Math.hypot(e.clientX - m.x, e.clientY - m.y) > 4) m.andou = true;
    if (!m.andou) return;
    this.dom.classList.add("movendo");
    const coords = this.view.posAtCoords({ left: e.clientX, top: e.clientY });
    if (!coords) {
      m.alvo = null;
      return;
    }
    // não vale soltar dentro da própria imagem
    if (coords.pos >= m.pos && coords.pos <= m.pos + this.node.nodeSize) {
      m.alvo = null;
      return;
    }
    const sel = TextSelection.near(this.view.state.doc.resolve(coords.pos), 1);
    m.alvo = sel.from;
    this.view.dispatch(this.view.state.tr.setSelection(sel));
  }

  /** Move o nó no documento (uma transação: Ctrl+Z desfaz). */
  private soltarMovimento(): void {
    const m = this.movendo;
    this.movendo = null;
    this.dom.classList.remove("movendo");
    if (!m || !m.andou || m.alvo == null) return;
    const r = moverImagem(this.view.state, m.pos, m.alvo);
    if (!r) return;
    r.tr.setSelection(NodeSelection.create(r.tr.doc, r.destino));
    this.view.dispatch(r.tr);
  }

  // ---------- redimensionar ----------

  private iniciarGesto(e: PointerEvent, dir: string, ponto: HTMLElement): void {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    const pos = this.getPos();
    if (typeof pos !== "number") return;
    this.selecionar();
    const escala = this.escala();
    this.gesto = {
      x: e.clientX,
      y: e.clientY,
      // a caixa medida está em px de tela: traz para px de documento
      w: this.img.getBoundingClientRect().width / escala,
      h: this.img.getBoundingClientRect().height / escala,
      dir,
    };
    this.dom.classList.add("redimensionando");
    try {
      ponto.setPointerCapture(e.pointerId);
    } catch {
      /* ponteiro sintético (teste) não tem captura */
    }
    const mover = (ev: PointerEvent) => this.arrastarGesto(ev);
    const soltar = () => {
      ponto.removeEventListener("pointermove", mover);
      ponto.removeEventListener("pointerup", soltar);
      ponto.removeEventListener("pointercancel", soltar);
      this.commitarGesto();
    };
    ponto.addEventListener("pointermove", mover);
    ponto.addEventListener("pointerup", soltar);
    ponto.addEventListener("pointercancel", soltar);
  }

  /** Atualiza AO VIVO o tamanho (a transação só entra no fim do gesto). */
  private arrastarGesto(e: PointerEvent): void {
    if (!this.gesto) return;
    const { x, y, w, h, dir } = this.gesto;
    const escala = this.escala();
    const dx = (e.clientX - x) / escala;
    const dy = (e.clientY - y) / escala;
    const horizontal = dir.includes("e") || dir.includes("w");
    const vertical = dir.includes("n") || dir.includes("s");
    let largura = w;
    if (horizontal) {
      largura = dir.includes("e") ? w + dx : w - dx;
    } else if (vertical && Math.abs(dx) > Math.abs(dy)) {
      // canto superior/inferior: se o mouse andou mais na horizontal, usa a largura
      largura = w + dx;
    } else if (vertical) {
      largura = (dir.includes("s") ? h + dy : h - dy) * this.proporcao;
    }
    const max = Math.max(120, this.view.dom.clientWidth);
    largura = Math.min(max, Math.max(MINIMO, largura));
    const altura = Math.max(1, Math.round(largura / this.proporcao));
    this.img.style.width = `${Math.round(largura)}px`;
    this.img.style.height = `${altura}px`;
    // o texto em volta se reacomoda AO VIVO: a largura do flutuante vem da decoração (o
    // ProseMirror pode recriar a imagem no meio do gesto e o `style` à mão se perderia)
    const pos = this.getPos();
    if (typeof pos === "number") {
      definirGestoAoVivo({ pos, largura: Math.round(largura), altura });
      this.view.dispatch(requestingFlutuante(this.view.state));
    }
  }

  private commitarGesto(): void {
    if (!this.gesto) return;
    this.gesto = null;
    definirGestoAoVivo(null);
    this.dom.classList.remove("redimensionando");
    const largura = Math.round(this.img.getBoundingClientRect().width / this.escala());
    const altura = Math.round(this.img.getBoundingClientRect().height / this.escala());
    if (!largura || !altura) return;
    const pos = this.getPos();
    if (typeof pos !== "number") return;
    const atual = this.view.state.doc.nodeAt(pos);
    if (!atual || atual.type !== this.node.type) return;
    if (atual.attrs.width === largura && atual.attrs.height === altura) return;
    const tr = this.view.state.tr.setNodeMarkup(pos, undefined, { ...atual.attrs, width: largura, height: altura });
    // trocar o nó zera o NodeSelection (vira cursor de texto) e as alças sumiriam
    tr.setSelection(NodeSelection.create(tr.doc, pos));
    this.view.dispatch(tr);
  }

  private encerrarGesto(): void {
    this.gesto = null;
    definirGestoAoVivo(null);
    this.dom.classList.remove("redimensionando");
  }
}
