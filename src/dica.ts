// Dica (tooltip) do app: um balão nosso no lugar do `title` nativo do navegador.
//
// Os controles do app já carregam a dica no `title` — e isso é bom: um lugar só, a tecla
// do atalho vai junto e a aba Atalhos atualiza o mesmo campo ao remapear tecla. O que
// destoava era a CARA: quem desenha o balão é o navegador, com a fonte, a borda e a sombra
// do sistema, por cima da fita, dos menus e do resto do app. Este módulo escuta o `title`
// no documento inteiro e mostra o mesmo texto num balão do app (a regra `.dica` no CSS).
//
// Regras que importam:
// - espera um instante parado sobre o controle (a dica não pisca ao cruzar a fita);
// - o `title` sai do elemento enquanto o balão está de pé (senão o nativo aparece por
//   cima) e VOLTA ao sair — se o dono trocou o `title` no meio, o valor novo vence;
// - toque (dedo/caneta) não abre dica; o balão nunca recebe o ponteiro;
// - sai no clique, no Esc, na rolagem, ao redimensionar a janela e quando o dono some.

const ESPERA_MS = 380;
const MARGEM = 8;

/** Caixa do controle (o que `getBoundingClientRect()` devolve). */
export interface CaixaDica {
  left: number;
  top: number;
  width: number;
  height: number;
  bottom: number;
}

/** A posição do balão: abaixo do controle; sem espaço, acima; sempre dentro da janela. */
export function posicaoDaDica(
  caixa: CaixaDica,
  tamanho: { largura: number; altura: number },
  janela: { largura: number; altura: number }
): { esquerda: number; topo: number; abaixo: boolean } {
  const cabeAbaixo = caixa.bottom + MARGEM + tamanho.altura <= janela.altura;
  const cabeAcima = caixa.top - MARGEM - tamanho.altura >= 0;
  const abaixo = cabeAbaixo || !cabeAcima;
  const topo = abaixo ? caixa.bottom + MARGEM : caixa.top - MARGEM - tamanho.altura;
  const centro = caixa.left + caixa.width / 2 - tamanho.largura / 2;
  const limite = Math.max(MARGEM, janela.largura - tamanho.largura - MARGEM);
  return {
    esquerda: Math.round(Math.min(Math.max(MARGEM, centro), limite)),
    topo: Math.round(topo),
    abaixo,
  };
}

/** Liga as dicas do app no documento inteiro. Devolve a função que desliga (testes). */
export function ligarDicas(doc: Document = document): () => void {
  const janela = doc.defaultView ?? window;
  let balao: HTMLElement | null = null;
  let dono: HTMLElement | null = null;
  let guardado: string | null = null;
  let relogio = 0;

  const esconder = (): void => {
    janela.clearTimeout(relogio);
    relogio = 0;
    // devolve o title — a não ser que o dono o tenha trocado no meio do hover
    if (dono && guardado !== null && !dono.hasAttribute("title")) dono.setAttribute("title", guardado);
    dono = null;
    guardado = null;
    if (balao && !balao.hidden) {
      balao.hidden = true;
      balao.textContent = "";
    }
  };

  const mostrar = (): void => {
    relogio = 0;
    if (!dono) return;
    if (!balao) {
      balao = doc.createElement("div");
      balao.className = "dica";
      balao.setAttribute("role", "tooltip");
      balao.hidden = true;
      // filho do <html> (e não do <body>): o modo apresentação esconde os filhos do body
      // que não são a sobreposição dele — a dica do HUD precisa continuar aparecendo
      doc.documentElement.append(balao);
    }
    balao.textContent = guardado ?? "";
    balao.hidden = false;
    const caixa = dono.getBoundingClientRect();
    const pos = posicaoDaDica(
      caixa,
      { largura: balao.offsetWidth, altura: balao.offsetHeight },
      { largura: janela.innerWidth, altura: janela.innerHeight }
    );
    balao.style.left = `${pos.esquerda}px`;
    balao.style.top = `${pos.topo}px`;
  };

  const trocar = (novo: HTMLElement | null, imediato = false): void => {
    if (novo === dono) return;
    esconder();
    if (!novo) return;
    const texto = novo.getAttribute("title");
    if (!texto || !texto.trim()) return;
    dono = novo;
    guardado = texto;
    novo.removeAttribute("title"); // o balão nativo nunca chega a aparecer
    relogio = janela.setTimeout(mostrar, imediato ? 0 : ESPERA_MS);
  };

  const donoDe = (alvo: EventTarget | null): HTMLElement | null =>
    alvo instanceof Element ? (alvo.closest("[title]") as HTMLElement | null) : null;

  const aoEntrar = (e: Event): void => {
    if ((e as PointerEvent).pointerType === "touch") return; // dedo/caneta: sem dica
    if (dono && !dono.isConnected) esconder(); // o dono sumiu (a fita se redesenhou)
    const alvo = donoDe(e.target);
    if (alvo) trocar(alvo);
  };

  const aoSair = (e: Event): void => {
    if (!dono) return;
    // andar DENTRO do mesmo controle (ícone, texto) não fecha a dica
    const destino = (e as PointerEvent).relatedTarget;
    if (destino instanceof Node && (destino === dono || dono.contains(destino))) return;
    trocar(null);
  };

  const aoFocar = (e: Event): void => {
    const alvo = donoDe(e.target);
    if (alvo) trocar(alvo, true); // teclado: sem espera
  };

  const aoSoltarFoco = (e: Event): void => {
    if (!dono) return;
    const destino = (e as FocusEvent).relatedTarget;
    if (destino instanceof Node && (destino === dono || dono.contains(destino))) return;
    trocar(null);
  };

  const aoMover = (): void => {
    if (dono && !dono.isConnected) esconder();
  };

  const aoTeclar = (e: KeyboardEvent): void => {
    if (e.key === "Escape") esconder();
  };

  doc.addEventListener("pointerover", aoEntrar, true);
  doc.addEventListener("pointerout", aoSair, true);
  doc.addEventListener("pointermove", aoMover, true);
  doc.addEventListener("pointerdown", esconder, true);
  doc.addEventListener("focusin", aoFocar, true);
  doc.addEventListener("focusout", aoSoltarFoco, true);
  doc.addEventListener("wheel", esconder, true);
  doc.addEventListener("scroll", esconder, true);
  doc.addEventListener("keydown", aoTeclar, true);
  janela.addEventListener("resize", esconder);
  janela.addEventListener("blur", esconder);

  return () => {
    esconder();
    doc.removeEventListener("pointerover", aoEntrar, true);
    doc.removeEventListener("pointerout", aoSair, true);
    doc.removeEventListener("pointermove", aoMover, true);
    doc.removeEventListener("pointerdown", esconder, true);
    doc.removeEventListener("focusin", aoFocar, true);
    doc.removeEventListener("focusout", aoSoltarFoco, true);
    doc.removeEventListener("wheel", esconder, true);
    doc.removeEventListener("scroll", esconder, true);
    doc.removeEventListener("keydown", aoTeclar, true);
    janela.removeEventListener("resize", esconder);
    janela.removeEventListener("blur", esconder);
  };
}
