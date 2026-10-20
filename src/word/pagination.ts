// Paginação visual: o texto flui em folhas reais (A4/Carta). Medimos cada bloco e inserimos
// "espaçadores" (rodapé da folha, vão cinza, cabeçalho da próxima) onde a página termina.
// Parágrafos longos se dividem linha a linha; imagens, tabelas e blocos muito altos não.
import { Plugin, PluginKey } from "prosemirror-state";
import { Decoration, DecorationSet, type EditorView } from "prosemirror-view";
import type { Node as PMNode } from "prosemirror-model";
import { fillHeaderFooter, pageSizePx, CM_TO_PX, type PageSetup } from "./model";

export const GAP_PX = 28;

/** O modo da folha: "normal" (uma página por faixa) ou "livro" (duas páginas lado a lado). */
export type ModoPagina = "normal" | "livro";

export interface PaginationHooks {
  getSetup: () => PageSetup;
  /** Quantas páginas o documento tem agora. */
  onPages: (count: number) => void;
  /** A paginação está ligada? (no modo Rascunho o texto é contínuo: não há páginas) */
  ativo?: () => boolean;
  /** O modo da folha (o livro monta a grade de duas páginas por faixa). */
  modo?: () => ModoPagina;
}

/** O passo entre uma página e a seguinte no fluxo (a altura da página + o vão). */
export function passoDaPagina(setup: PageSetup): number {
  return pageSizePx(setup).h + GAP_PX;
}

/**
 * Onde a página N cai na grade do livro: duas por faixa (a primeira à esquerda, a segunda à
 * direita) e as faixas uma embaixo da outra. O deslocamento sai da posição natural da página
 * no fluxo (uma pilha) — é ele que vira o `transform` de cada bloco.
 */
export function lugarDaPagina(pagina: number, larguraPagina: number, passo: number): { dx: number; dy: number } {
  return { dx: (pagina % 2) * larguraPagina, dy: (Math.floor(pagina / 2) - pagina) * passo };
}

/** Hash curto (a assinatura da paginação não pode crescer com o documento). */
function hashCurto(s: string): string {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(36);
}

interface PState {
  deco: DecorationSet;
  serial: number;
}

export const paginationKey = new PluginKey<PState>("pagination");

interface Spacer {
  pos: number;
  height: number;
  /** página (0-based) que termina neste espaçador */
  endsPage: number;
  end?: boolean;
}

/** Quer refazer a paginação (configuração da página mudou, zoom, imagem carregou…). */
export function requestPagination(view: EditorView): void {
  view.dispatch(view.state.tr.setMeta(paginationKey, { refresh: true }));
}

function hf(text: string, page: number, total: number): string {
  return fillHeaderFooter(text, page, total);
}

function buildSpacer(s: Spacer, total: number, setup: PageSetup): HTMLElement {
  const el = document.createElement("div");
  el.className = "wd-spacer";
  el.contentEditable = "false";
  el.style.height = `${Math.max(0, Math.round(s.height))}px`;
  el.append(buildFill(), buildFoot(s, total, setup));
  if (!s.end) el.append(buildGap(setup), buildHead(s, total, setup));
  return el;
}

/** O espaço vazio que sobrou na página (o rodapé desce para o fim dela). */
function buildFill(): HTMLElement {
  const fill = document.createElement("div");
  fill.className = "wd-sp-fill";
  return fill;
}

/** O rodapé da página (com o número, se o documento pedir). */
function buildFoot(s: Spacer, total: number, setup: PageSetup): HTMLElement {
  const mb = Math.round(setup.margins.bottom * CM_TO_PX);
  const foot = document.createElement("div");
  foot.className = "wd-sp-foot";
  foot.style.height = `${mb}px`;
  const parts: string[] = [];
  if (setup.footer.trim()) parts.push(hf(setup.footer, s.endsPage + 1, total));
  if (setup.pageNumbers) parts.push(`Página ${s.endsPage + 1} de ${total}`);
  foot.textContent = parts.join("   ·   ");
  return foot;
}

/** O vão cinza entre uma página e a outra. */
function buildGap(setup: PageSetup): HTMLElement {
  const gap = document.createElement("div");
  gap.className = "wd-sp-gap";
  gap.style.height = `${GAP_PX}px`;
  // o vão cinza sai das margens para ocupar a largura toda da folha
  gap.style.marginLeft = `-${Math.round(setup.margins.left * CM_TO_PX)}px`;
  gap.style.marginRight = `-${Math.round(setup.margins.right * CM_TO_PX)}px`;
  return gap;
}

/** O cabeçalho da página que vem a seguir. */
function buildHead(s: Spacer, total: number, setup: PageSetup): HTMLElement {
  const mt = Math.round(setup.margins.top * CM_TO_PX);
  const head = document.createElement("div");
  head.className = "wd-sp-head";
  head.style.height = `${mt}px`;
  head.textContent = hf(setup.header, s.endsPage + 2, total);
  return head;
}

/**
 * No modo LIVRO o espaçador se divide em dois: o **rodapé** viaja com a página que termina
 * (ele fica no pé dela) e o **cabeçalho** com a página seguinte (no topo dela) — na grade do
 * livro as duas páginas de uma faixa estão lado a lado, e um bloco só não poderia ficar nos
 * dois lugares ao mesmo tempo.
 */
function buildRodape(s: Spacer, total: number, setup: PageSetup, lugar: { dx: number; dy: number }): HTMLElement {
  const mt = Math.round(setup.margins.top * CM_TO_PX);
  const el = document.createElement("div");
  el.className = "wd-spacer wd-sp-rodape";
  el.contentEditable = "false";
  el.style.height = `${Math.max(0, Math.round(s.height - GAP_PX - mt))}px`;
  el.style.transform = `translate(${Math.round(lugar.dx)}px, ${Math.round(lugar.dy)}px)`;
  el.append(buildFill(), buildFoot(s, total, setup));
  return el;
}

/** O vão e o cabeçalho da página seguinte (viajam com ela). */
function buildTopo(s: Spacer, total: number, setup: PageSetup, lugar: { dx: number; dy: number }): HTMLElement {
  const mt = Math.round(setup.margins.top * CM_TO_PX);
  const el = document.createElement("div");
  el.className = "wd-spacer wd-sp-topo";
  el.contentEditable = "false";
  el.style.height = `${GAP_PX + mt}px`;
  el.style.transform = `translate(${Math.round(lugar.dx)}px, ${Math.round(lugar.dy)}px)`;
  el.append(buildGap(setup), buildHead(s, total, setup));
  return el;
}

interface Leaf {
  node: PMNode;
  pos: number;
  el: HTMLElement;
}

const LEAF_TYPES = new Set(["paragraph", "heading", "code_block", "horizontal_rule", "page_break", "table"]);

function collectLeaves(view: EditorView): Leaf[] {
  const out: Leaf[] = [];
  view.state.doc.descendants((node, pos) => {
    if (!LEAF_TYPES.has(node.type.name)) return true; // listas e citações: desce
    const dom = view.nodeDOM(pos);
    if (dom instanceof HTMLElement) out.push({ node, pos, el: dom });
    return false;
  });
  return out;
}

/** Linhas de um parágrafo (topo e base, em px relativos à origem, já sem zoom). */
function lineBoxes(el: HTMLElement, origin: number, scale: number): { top: number; bottom: number; left: number }[] {
  const range = document.createRange();
  range.selectNodeContents(el);
  const rects = Array.from(range.getClientRects())
    .filter((r) => r.width > 0 && r.height > 0)
    .sort((a, b) => a.top - b.top);
  const lines: { top: number; bottom: number; left: number }[] = [];
  for (const r of rects) {
    const top = (r.top - origin) / scale;
    const bottom = (r.bottom - origin) / scale;
    const last = lines[lines.length - 1];
    if (last && top < last.bottom - 2) {
      last.top = Math.min(last.top, top);
      last.bottom = Math.max(last.bottom, bottom);
      last.left = Math.min(last.left, r.left);
    } else lines.push({ top, bottom, left: r.left });
  }
  return lines;
}

interface FolhaMedida {
  pos: number;
  tamanho: number;
  /** a página (0-based) onde a folha cai */
  pagina: number;
}

function measure(view: EditorView, setup: PageSetup): { spacers: Spacer[]; pages: number; folhas: FolhaMedida[] } {
  const { h: pageH } = pageSizePx(setup);
  const mt = Math.round(setup.margins.top * CM_TO_PX);
  const mb = Math.round(setup.margins.bottom * CM_TO_PX);
  const contentH = pageH - mt - mb;
  const stride = pageH + GAP_PX;

  const dom = view.dom as HTMLElement;
  dom.classList.add("wd-measuring");
  const spacers: Spacer[] = [];
  const folhas: FolhaMedida[] = [];
  let page = 0;
  try {
    const box = dom.getBoundingClientRect();
    const scale = box.width / dom.offsetWidth || 1;
    const padTop = parseFloat(getComputedStyle(dom).paddingTop) || 0;
    const origin = box.top + padTop * scale;
    const leaves = collectLeaves(view);

    let shift = 0;
    let forceNext = false;
    let lastBottom = 0;

    for (const leaf of leaves) {
      if (leaf.node.type.name === "page_break") {
        forceNext = true;
        continue;
      }
      const r = leaf.el.getBoundingClientRect();
      const cs = getComputedStyle(leaf.el);
      const mbot = parseFloat(cs.marginBottom) || 0;
      const baseTop = (r.top - origin) / scale;
      const baseBottom = (r.bottom - origin) / scale + mbot;
      let top = baseTop + shift;
      let bottom = baseBottom + shift;

      if (forceNext) {
        forceNext = false;
        const s = (page + 1) * stride - top;
        if (s > 0) {
          spacers.push({ pos: leaf.pos, height: s, endsPage: page });
          shift += s;
          top += s;
          bottom += s;
          page++;
        }
      }

      const isHeading = leaf.node.type.name === "heading";
      // um parágrafo FLUTUANTE (a imagem flutuante) não é texto: ele não se divide linha a
      // linha — a imagem é um bloco só e fica inteira (ou sobe inteira para a página seguinte)
      const ehFloat = leaf.el.classList.contains("wd-flutuante");
      let guard = 0;
      // quanto o bloco ainda precisa caber nesta página (títulos pedem espaço para 2–3 linhas depois)
      while (bottom + (isHeading ? 56 : 0) > page * stride + contentH && guard++ < 400) {
        const pageEnd = page * stride + contentH;
        const isText = leaf.node.type.name === "paragraph" || leaf.node.type.name === "heading";
        if (isText && !isHeading && !ehFloat) {
          const lines = lineBoxes(leaf.el, origin, scale).map((l) => ({ top: l.top + shift, bottom: l.bottom + shift, left: l.left }));
          let fit = lines.filter((l) => l.bottom <= pageEnd).length;
          // não deixa linha órfã/viúva: pelo menos 2 linhas de cada lado
          if (fit >= 2 && lines.length - fit >= 2) {
            // o corte cai na linha `fit`; acha a posição do texto no começo dessa linha
            // borda esquerda REAL da linha: sem isso o corte cai depois da 1ª letra ("d|ocumento")
            const left = lines[fit].left + 0.5 * scale;
            const y = box.top + padTop * scale + (lines[fit].top - shift) * scale + 2 * scale;
            const hit = view.posAtCoords({ left, top: y });
            const start = leaf.pos + 1;
            const end = leaf.pos + leaf.node.nodeSize - 1;
            if (hit && hit.pos > start && hit.pos < end) {
              const s = (page + 1) * stride - lines[fit].top;
              if (s > 0) {
                spacers.push({ pos: hit.pos, height: s, endsPage: page });
                shift += s;
                bottom = baseBottom + shift;
                top = baseTop + shift;
                page++;
                fit = 0;
                continue;
              }
            }
          }
        }
        // não coube: se já está no topo da página (bloco mais alto que a folha), deixa passar
        if (top <= page * stride + 1) {
          page = Math.max(page, Math.floor((bottom - 1) / stride));
          break;
        }
        const s = (page + 1) * stride - top;
        if (s <= 0) break;
        spacers.push({ pos: leaf.pos, height: s, endsPage: page });
        shift += s;
        top += s;
        bottom += s;
        page++;
      }
      // a folha ficou nesta página (o modo livro usa isso para montar a grade)
      folhas.push({ pos: leaf.pos, tamanho: leaf.node.nodeSize, pagina: page });
      lastBottom = Math.max(lastBottom, bottom);
      // bloco que atravessou várias páginas (tabela enorme): a página atual acompanha
      const reached = Math.floor((bottom - mbot - 1) / stride);
      if (reached > page) page = reached;
    }

    // fecha a última folha: preenche até o fim da página e põe o rodapé
    const endFill = Math.max(0, page * stride + contentH - lastBottom);
    spacers.push({ pos: view.state.doc.content.size, height: endFill + mb, endsPage: page, end: true });
  } finally {
    dom.classList.remove("wd-measuring");
  }
  return { spacers, pages: page + 1, folhas };
}

export function paginationPlugin(hooks: PaginationHooks): Plugin<PState> {
  return new Plugin<PState>({
    key: paginationKey,
    state: {
      init: () => ({ deco: DecorationSet.empty, serial: 0 }),
      apply(tr, value) {
        const meta = tr.getMeta(paginationKey) as { deco?: DecorationSet; refresh?: boolean } | undefined;
        if (meta?.deco) return { deco: meta.deco, serial: value.serial };
        if (meta?.refresh) return { deco: value.deco.map(tr.mapping, tr.doc), serial: value.serial + 1 };
        return { deco: tr.docChanged ? value.deco.map(tr.mapping, tr.doc) : value.deco, serial: value.serial };
      },
    },
    props: {
      decorations(state) {
        return paginationKey.getState(state)?.deco ?? DecorationSet.empty;
      },
    },
    view(view) {
      let raf = 0;
      let timer = 0;
      let signature = "";
      let lastSerial = -1;
      let lastDoc: PMNode | null = null;

      const run = () => {
        raf = 0;
        // desligada (modo Rascunho): o texto é contínuo, sem quebras de página — os
        // espaçadores saem e a folha vira um papel só
        if (hooks.ativo && !hooks.ativo()) {
          if (signature) {
            signature = "";
            view.dispatch(view.state.tr.setMeta(paginationKey, { deco: DecorationSet.empty }).setMeta("addToHistory", false));
          }
          hooks.onPages(1);
          return;
        }
        const setup = hooks.getSetup();
        const { spacers, pages, folhas } = measure(view, setup);
        hooks.onPages(pages);
        const livro = hooks.modo?.() === "livro";
        const sig =
          JSON.stringify(spacers.map((s) => [s.pos, Math.round(s.height), s.end ? 1 : 0])) +
          pages +
          JSON.stringify(setup) +
          (livro ? "|livro" : "|normal") +
          (livro ? hashCurto(folhas.map((f) => `${f.pos}:${f.pagina}`).join(",")) : "");
        if (sig === signature) return;
        signature = sig;
        const decos: Decoration[] = [];
        if (livro) {
          // MODO LIVRO: cada bloco é levado para a casa da sua página na grade (duas por
          // faixa). A medição acontece SEM o deslocamento (a classe `wd-measuring` desliga
          // o `transform`), senão as caixas mediriam a página já movida.
          const { w: larguraPagina } = pageSizePx(setup);
          const passo = passoDaPagina(setup);
          for (const f of folhas) {
            const { dx, dy } = lugarDaPagina(f.pagina, larguraPagina, passo);
            decos.push(
              Decoration.node(f.pos, f.pos + f.tamanho, {
                class: "wd-livro",
                style: `transform:translate(${Math.round(dx)}px, ${Math.round(dy)}px)`,
              }),
            );
          }
          // o espaçador se divide: o rodapé fica no pé da página que termina, o cabeçalho
          // no topo da seguinte (na grade, as duas páginas de uma faixa estão lado a lado)
          for (const s of spacers) {
            const base = `sp-${s.pos}-${Math.round(s.height)}-${s.endsPage}-${pages}-${setup.footer}-${setup.header}-${setup.pageNumbers}`;
            const a = lugarDaPagina(s.endsPage, larguraPagina, passo);
            decos.push(
              Decoration.widget(s.pos, () => buildRodape(s, pages, setup, a), { side: s.end ? 1 : -1, key: `${base}-rod` }),
            );
            if (!s.end) {
              const b = lugarDaPagina(s.endsPage + 1, larguraPagina, passo);
              decos.push(Decoration.widget(s.pos, () => buildTopo(s, pages, setup, b), { side: -1, key: `${base}-topo` }));
            }
          }
        } else {
          for (const s of spacers) {
            decos.push(
              Decoration.widget(s.pos, () => buildSpacer(s, pages, setup), {
                side: s.end ? 1 : -1,
                key: `sp-${s.pos}-${Math.round(s.height)}-${s.endsPage}-${pages}-${setup.footer}-${setup.header}-${setup.pageNumbers}`,
              }),
            );
          }
        }
        view.dispatch(view.state.tr.setMeta(paginationKey, { deco: DecorationSet.create(view.state.doc, decos) }).setMeta("addToHistory", false));
      };
      const schedule = (delay = 90) => {
        window.clearTimeout(timer);
        timer = window.setTimeout(() => {
          cancelAnimationFrame(raf);
          raf = requestAnimationFrame(run);
        }, delay);
      };

      // imagens carregando mudam as alturas
      const onLoad = () => schedule(40);
      view.dom.addEventListener("load", onLoad, true);
      schedule(0);

      return {
        update(v) {
          const st = paginationKey.getState(v.state);
          const changed = lastDoc !== v.state.doc || (st && st.serial !== lastSerial);
          lastDoc = v.state.doc;
          if (st) lastSerial = st.serial;
          if (changed) schedule();
        },
        destroy() {
          window.clearTimeout(timer);
          cancelAnimationFrame(raf);
          view.dom.removeEventListener("load", onLoad, true);
        },
      };
    },
  });
}
