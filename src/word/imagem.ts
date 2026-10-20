// Imagem do Word como NodeView: clique seleciona, as alças redimensionam (mantendo a
// proporção) e a alça pontilhada arrasta a imagem para outro ponto do texto.
//
// O tamanho vive nos atributos `width`/`height` do nó (é o que o .docx importa/exporta),
// então o redimensionamento sobrevive a salvar, reabrir e desfazer (uma transação por
// gesto: Ctrl+Z volta ao tamanho anterior).

import type { Node as PMNode } from "prosemirror-model";
import { NodeSelection, TextSelection } from "prosemirror-state";
import { moverImagem } from "./imagemMover";
import type { EditorView, NodeView } from "prosemirror-view";

/** Tamanho mínimo de uma imagem redimensionada (px). */
const MINIMO = 24;

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

  /** Gesto de mover: de onde saiu, para onde vai e se já andou o bastante para valer. */
  private movendo: { pos: number; x: number; y: number; alvo: number | null; andou: boolean } | null = null;

  private iniciarMovimento(e: PointerEvent, alvo: HTMLElement): void {
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

  private iniciarGesto(e: PointerEvent, dir: string, ponto: HTMLElement): void {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    const pos = this.getPos();
    if (typeof pos !== "number") return;
    this.selecionar();
    this.gesto = {
      x: e.clientX,
      y: e.clientY,
      w: this.img.getBoundingClientRect().width,
      h: this.img.getBoundingClientRect().height,
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
    const dx = e.clientX - x;
    const dy = e.clientY - y;
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
  }

  private commitarGesto(): void {
    if (!this.gesto) return;
    this.gesto = null;
    this.dom.classList.remove("redimensionando");
    const largura = Math.round(this.img.getBoundingClientRect().width);
    const altura = Math.round(this.img.getBoundingClientRect().height);
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
    this.dom.classList.remove("redimensionando");
  }
}
