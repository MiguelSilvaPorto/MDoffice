// Liga a seleção do navegador (dentro de uma caixa de texto editável) às "posições" do texto no modelo:
// os parágrafos juntos com "\n" entre eles, a quebra de linha (<br>) contando 1 e o marcador da lista
// (.pp-bu) e o espaço de largura zero dos parágrafos vazios não contando nada.

const ZW = "​";

function ehMarcador(n: Node): boolean {
  return n.nodeType === 1 && (n as HTMLElement).classList.contains("pp-bu");
}

/** Um <br> só conta como quebra quando vem texto depois dele no parágrafo (o último <br> é só marcador do navegador). */
export function brConta(br: Node): boolean {
  let n: Node | null = br.nextSibling;
  while (n) {
    if (n.nodeType === 3 && (n.nodeValue ?? "").split(ZW).join("") === "") {
      n = n.nextSibling;
      continue;
    }
    if (n.nodeType === 1 && (n as HTMLElement).tagName === "BR") return true;
    if (ehMarcador(n)) {
      n = n.nextSibling;
      continue;
    }
    return true;
  }
  return false;
}

/** Quantas posições o nó ocupa. */
function comprimento(n: Node): number {
  if (n.nodeType === 3) return (n.nodeValue ?? "").split(ZW).join("").length;
  if (n.nodeType !== 1) return 0;
  const el = n as HTMLElement;
  if (ehMarcador(el)) return 0;
  if (el.tagName === "BR") return brConta(el) ? 1 : 0;
  let t = 0;
  for (const c of Array.from(el.childNodes)) t += comprimento(c);
  return t;
}

/** Posição de um ponto da seleção (nó + deslocamento) no texto da forma. */
function posicaoDe(rt: HTMLElement, alvo: Node, desloc: number): number {
  let acc = 0;
  const ps = Array.from(rt.children);
  for (let i = 0; i < ps.length; i++) {
    const p = ps[i];
    if (i > 0) acc += 1;
    if (p === alvo || p.contains(alvo)) return acc + dentroDe(p, alvo, desloc);
    acc += comprimento(p);
  }
  // o alvo é o próprio contêiner: desloc conta parágrafos
  if (alvo === rt) {
    let t = 0;
    for (let i = 0; i < Math.min(desloc, ps.length); i++) t += comprimento(ps[i]) + (i > 0 ? 1 : 0);
    return t;
  }
  return acc;
}

function dentroDe(raiz: Node, alvo: Node, desloc: number): number {
  let acc = 0;
  let achou = false;
  const andar = (n: Node): void => {
    if (achou) return;
    if (n === alvo) {
      if (n.nodeType === 3) {
        const bruto = n.nodeValue ?? "";
        acc += bruto.slice(0, desloc).split(ZW).join("").length;
      } else {
        const filhos = Array.from(n.childNodes);
        for (let i = 0; i < Math.min(desloc, filhos.length); i++) acc += comprimento(filhos[i]);
      }
      achou = true;
      return;
    }
    if (n.nodeType === 3) {
      acc += comprimento(n);
      return;
    }
    if (ehMarcador(n)) return;
    if (n.nodeType === 1 && (n as HTMLElement).tagName === "BR") {
      acc += brConta(n) ? 1 : 0;
      return;
    }
    for (const c of Array.from(n.childNodes)) {
      andar(c);
      if (achou) return;
    }
  };
  andar(raiz);
  return acc;
}

/** Seleção atual dentro da caixa de texto, em posições do texto. null quando a seleção está fora dela. */
export function lerSelecao(rt: HTMLElement): { ini: number; fim: number } | null {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return null;
  const r = sel.getRangeAt(0);
  if (!rt.contains(r.startContainer) || !rt.contains(r.endContainer)) return null;
  const a = posicaoDe(rt, r.startContainer, r.startOffset);
  const b = posicaoDe(rt, r.endContainer, r.endOffset);
  return { ini: Math.min(a, b), fim: Math.max(a, b) };
}

/** Acha o ponto (nó + deslocamento) de uma posição do texto. */
function pontoDe(rt: HTMLElement, pos: number): { no: Node; desloc: number } {
  let acc = 0;
  const ps = Array.from(rt.children);
  for (let i = 0; i < ps.length; i++) {
    const p = ps[i];
    if (i > 0) acc += 1;
    const len = comprimento(p);
    if (pos <= acc + len) return pontoNoParagrafo(p, pos - acc);
    acc += len;
  }
  const ult = ps[ps.length - 1] ?? rt;
  return pontoNoParagrafo(ult, comprimento(ult));
}

function pontoNoParagrafo(p: Element, pos: number): { no: Node; desloc: number } {
  let acc = 0;
  let ultimoTexto: { no: Node; desloc: number } | null = null;
  const andar = (n: Node): { no: Node; desloc: number } | null => {
    if (n.nodeType === 3) {
      const bruto = n.nodeValue ?? "";
      const len = comprimento(n);
      if (pos <= acc + len) {
        // converte posição "sem espaço de largura zero" para o deslocamento bruto
        let visto = 0;
        let i = 0;
        for (; i < bruto.length && visto < pos - acc; i++) if (bruto[i] !== ZW) visto++;
        return { no: n, desloc: i };
      }
      acc += len;
      ultimoTexto = { no: n, desloc: bruto.length };
      return null;
    }
    if (ehMarcador(n)) return null;
    if (n.nodeType === 1 && (n as HTMLElement).tagName === "BR") {
      if (!brConta(n)) return null;
      const pai = n.parentNode!;
      const idx = Array.from(pai.childNodes).indexOf(n as ChildNode);
      if (pos === acc) return { no: pai, desloc: idx };
      acc += 1;
      if (pos === acc) return { no: pai, desloc: idx + 1 };
      return null;
    }
    for (const c of Array.from(n.childNodes)) {
      const r = andar(c);
      if (r) return r;
    }
    return null;
  };
  const r = andar(p);
  if (r) return r;
  if (ultimoTexto) return ultimoTexto;
  return { no: p, desloc: 0 };
}

/** Coloca a seleção do navegador entre duas posições do texto. */
export function restaurarSelecao(rt: HTMLElement, ini: number, fim: number = ini): void {
  const sel = window.getSelection();
  if (!sel) return;
  const a = pontoDe(rt, ini);
  const b = pontoDe(rt, fim);
  const r = document.createRange();
  try {
    r.setStart(a.no, a.desloc);
    r.setEnd(b.no, b.desloc);
    sel.removeAllRanges();
    sel.addRange(r);
  } catch {
    /* posição fora do texto: ignora */
  }
}

/** Texto da caixa como o modelo o enxerga (sem marcadores nem espaços de largura zero). */
export function textoDaCaixa(rt: HTMLElement): string {
  const ps = Array.from(rt.children);
  return ps
    .map((p) => {
      let t = "";
      const andar = (n: Node): void => {
        if (n.nodeType === 3) t += (n.nodeValue ?? "").split(ZW).join("").replace(/ /g, " ");
        else if (ehMarcador(n)) return;
        else if (n.nodeType === 1 && (n as HTMLElement).tagName === "BR") t += brConta(n) ? "\n" : "";
        else for (const c of Array.from(n.childNodes)) andar(c);
      };
      andar(p);
      return t;
    })
    .join("\n");
}
