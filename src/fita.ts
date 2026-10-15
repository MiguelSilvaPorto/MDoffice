// Controles compartilhados da faixa de opções (o "topo" do editor):
//
// - Recolher/expandir: **Ctrl+F1** (a dica vive no `title` da barra das abas). Sem duplo clique:
//   dois cliques numa aba — ou num botão, como o Template — recolhiam a faixa sem querer (a
//   pedido; ver o `click` daqui de baixo, que também ignora o clique repetido).
//   Recolhida, a faixa se abre só na hora de usar: escolher um comando, mudar um
//   campo ou clicar fora devolve o espaço automaticamente (como no Office) — menos
//   enquanto a pessoa escolhe num **popup do app**: eles marcam a classe `app-popup`
//   (os do PowerPoint, os do Word, o menu do `seletor`, o menu do Excel) e o clique
//   dentro deles não conta como "fora" — nem o comando que os abre recolhe a faixa.
// - Ajustar o tamanho: arrastar a borda de baixo da faixa (cursor de redimensionar)
//   deixa tudo maior ou menor — sem cortar botão — e o duplo clique volta ao normal.
//
// As duas preferências ficam guardadas e valem para as três fitas (Word, Excel e Apresentações).

import { EVENTO_MUDOU, combina, emCaptura, teclaVisivel } from "./app/keymap";

export interface OpcoesRecolherFita {
  /** raiz da faixa: recebe a classe `fita-recolhida` */
  el: HTMLElement;
  /** onde ficam as abas: recebe o botão de recolher */
  abas: HTMLElement;
  /** raiz dos painéis que somem quando a faixa está recolhida */
  paineis: HTMLElement;
}

const CHAVE = "mdc.fita.recolhida";
const EVENTO = "mdc:fita-recolhida";
const CHAVE_ESCALA = "mdc.fita.escala";
const EVENTO_ESCALA = "mdc:fita-escala";
const ESCALA_MIN = 0.7;
const ESCALA_MAX = 1.5;

const ler = (): boolean => {
  try {
    return localStorage.getItem(CHAVE) === "1";
  } catch {
    return false;
  }
};

const gravar = (v: boolean): void => {
  try {
    localStorage.setItem(CHAVE, v ? "1" : "0");
  } catch {
    /* sem armazenamento: vale só nesta sessão */
  }
};

const lerEscala = (): number => {
  try {
    const v = Number(localStorage.getItem(CHAVE_ESCALA));
    return Number.isFinite(v) && v >= ESCALA_MIN && v <= ESCALA_MAX ? v : 1;
  } catch {
    return 1;
  }
};

const gravarEscala = (v: number): void => {
  try {
    if (v === 1) localStorage.removeItem(CHAVE_ESCALA);
    else localStorage.setItem(CHAVE_ESCALA, String(v));
  } catch {
    /* sem armazenamento: vale só nesta sessão */
  }
};

/** Liga o recolher/expandir (Ctrl+F1 ou duplo clique numa aba); devolve um atalho por código. */
export function ligarRecolherFita(o: OpcoesRecolherFita): { alternar: () => void } {
  let recolhida = ler();
  let temporaria = false; // painel à mostra só enquanto o usuário mexe na faixa

  const aplicar = (): void => {
    const escondida = recolhida && !temporaria;
    o.el.classList.toggle("fita-recolhida", escondida);
    // sem botão (o chevron saiu a pedido): a dica vive na barra das abas, que é onde o gesto mora
    const titulo = escondida
      ? `Fixar a faixa de opções (${teclaVisivel("fita")}) ou duplo clique numa aba`
      : `Recolher a faixa de opções (${teclaVisivel("fita")}) ou duplo clique numa aba`;
    o.abas.title = titulo;
    o.abas.setAttribute("aria-label", `Abas da faixa de opções — ${titulo}`);
  };

  /** Fixa a escolha (recolhida ou não) e guarda; avisa as outras fitas abertas. */
  const fixar = (v: boolean, avisar = true): void => {
    recolhida = v;
    temporaria = false;
    gravar(v);
    if (avisar) document.dispatchEvent(new CustomEvent(EVENTO, { detail: v }));
    aplicar();
  };

  /**
   * Alterna decidindo pelo que está À VISTA: com a faixa aberta (mesmo que só "por enquanto", no
   * modo recolhido — o caso de clicar no Template) RECOLHE; recolhida, fixa aberta. O clique do
   * chevron usava o estado fixo e, com a faixa à mostra e a preferência "recolhida", fazia o
   * contrário — fixava aberta e a faixa não fechava mais. (O chevron saiu; o gesto ficou.)
   */
  const alternarPeloVisivel = (): void => {
    const visivel = !(recolhida && !temporaria);
    fixar(visivel);
  };

  // O duplo clique numa aba NÃO recolhe mais a faixa (a pedido): trocar de aba com dois cliques
  // — ou abrir e fechar um popup pelo próprio botão — recolhia a faixa do nada. O recolher vive
  // no Ctrl+F1, com a dica no `title` da barra das abas.

  // recolhida: clicar numa aba mostra a faixa por enquanto
  o.abas.addEventListener("click", (e) => {
    if (!recolhida || temporaria) return;
    temporaria = true;
    aplicar();
  });

  // escolheu um comando (ou mexeu num campo): a faixa volta a fechar — MENOS quando o comando
  // abre um popup (Template, cores, Formas…): aí a faixa fica à vista enquanto a pessoa escolhe
  // (o popup vive no `body` e o clique nele seria "fora"). A decisão espera um tique porque o
  // popup nasce no mesmo clique — e, se ele fechou, a faixa volta a fechar como sempre.
  // Dois cliques no MESMO botão também não recolhem: quem clica rápido (inclusive no botão que
  // abre e fecha um popup) não pode ver a faixa sumir no meio do gesto.
  let ultimoClique: { alvo: EventTarget | null; t: number } | null = null;
  o.el.addEventListener("click", (e) => {
    if (!recolhida || !temporaria) return;
    const t = e.target as HTMLElement;
    if (o.abas.contains(t) || t.closest("select, input, textarea, .wd-ribbon-nav")) return;
    const agora = performance.now();
    const repetido = ultimoClique !== null && ultimoClique.alvo === e.target && agora - ultimoClique.t < 450;
    ultimoClique = { alvo: e.target, t: agora };
    if (repetido) return;
    setTimeout(() => {
      if (recolhida && temporaria && !document.querySelector(".app-popup")) {
        temporaria = false;
        aplicar();
      }
    }, 0);
  });
  o.el.addEventListener("change", (e) => {
    if (!recolhida || !temporaria) return;
    if ((e.target as HTMLElement).closest("select, input")) fixar(true, false);
  });

  // clicou fora: fecha a faixa que estava aberta só para uso — mas clique dentro de um popup (que
  // mora no `body`) ou de um diálogo do app NÃO é "fora": a pessoa ainda está usando a faixa.
  document.addEventListener("pointerdown", (e) => {
    if (!recolhida || !temporaria) return;
    const t = e.target as HTMLElement;
    if (o.el.contains(t) || t.closest(".fita-resize, .app-popup, .modal-backdrop, .modal")) return;
    temporaria = false;
    aplicar();
  });

  // Ctrl+F1 alterna (só quando a fita está à vista). A tecla vem do `keymap.ts`,
  // como todas as outras: é o que deixa ela aparecer — e ser trocada — na aba
  // Atalhos das Configurações.
  document.addEventListener("keydown", (e) => {
    if (emCaptura() || !combina("fita", e)) return;
    if (!o.el.isConnected || o.el.offsetParent === null) return;
    e.preventDefault();
    e.stopPropagation();
    alternarPeloVisivel();
  });

  // outra fita mudou a preferência: acompanha
  document.addEventListener(EVENTO, (e) => {
    recolhida = !!(e as CustomEvent).detail;
    temporaria = false;
    aplicar();
  });

  // trocaram a tecla na aba Atalhos: a dica do botão precisa acompanhar
  document.addEventListener(EVENTO_MUDOU, () => aplicar());

  aplicar();
  return { alternar: () => fixar(!recolhida) };
}

/**
 * Deixa ajustar o tamanho da faixa arrastando a borda de baixo: ao passar o mouse
 * aparece o cursor de redimensionar e, arrastando, os botões acompanham (a faixa
 * fica menor e sobra espaço para o documento, ou maior para quem prefere assim).
 * Duplo clique na borda volta ao tamanho normal.
 *
 * `modo` decide COMO a faixa acompanha:
 * - `"zoom"` (padrão): aplica `zoom` na faixa inteira — simples, mas a fonte
 *   encolhe junto e fica ilegível abaixo de ~90%.
 * - `"metricas"`: publica `--fita-escala` e deixa o CSS escalar as métricas
 *   (alturas, ícones, espaçamentos) mantendo um piso para a fonte. É o modo das
 *   Apresentações, onde a fita tem muitos botões grandes.
 *
 * `painel` (só no modo `"metricas"`) é o seletor do painel que rola na horizontal: com ele a fita
 * também se ajusta sozinha à LARGURA — se o painel da aba ativa não cabe, reduz os espaçamentos e
 * os ícones em degraus (`--fita-ajuste`; a fonte tem piso) e, abaixo de ~88%, vira compacta (os
 * botões grandes numa linha). A rolagem fica só como último recurso, em janela muito estreita.
 */
export function ligarAjusteAlturaFita(o: { el: HTMLElement; modo?: "zoom" | "metricas"; painel?: string }): void {
  let escala = lerEscala();
  const porMetricas = o.modo === "metricas";
  // quanto a fita precisou encolher para caber na largura (1 = nada) e se os botões pequenos
  // ficaram só com o ícone (o nome continua na dica)
  let ajuste = 1;
  let soIcones = false;
  const porLargura = porMetricas && !!o.painel;

  // alça na borda de baixo (logo abaixo da faixa, sem cobrir os botões)
  const alca = document.createElement("div");
  alca.className = "fita-resize";
  alca.title = "Arraste para ajustar o tamanho da faixa de opções · duplo clique volta ao normal";
  alca.setAttribute("role", "separator");
  alca.setAttribute("aria-orientation", "horizontal");
  alca.setAttribute("aria-valuemin", String(Math.round(ESCALA_MIN * 100)));
  alca.setAttribute("aria-valuemax", String(Math.round(ESCALA_MAX * 100)));
  o.el.insertAdjacentElement("afterend", alca);

  // o valor do tamanho não é anunciado a cada quadro do arrasto: vai no tooltip
  const rotulo = () => `Arraste para ajustar o tamanho da faixa de opções (${Math.round(escala * 100)}%) · duplo clique volta ao normal`;

  const aplicar = (): void => {
    // a escala vai para o CSS; cada fita decide o que fazer com ela
    o.el.style.setProperty("--fita-escala", String(escala));
    o.el.style.setProperty("--fita-ajuste", String(ajuste));
    // fita baixa: os botões grandes viram "ícone + nome" numa linha, o que
    // devolve espaço vertical sem diminuir a fonte (o piso está no CSS)
    if (porMetricas) o.el.classList.toggle("fita-compacta", escala * ajuste < 0.88);
    o.el.classList.toggle("fita-icones", soIcones);
    if (porMetricas) {
      // nada de `zoom`: ele encolheria também a fonte (o piso fica no CSS)
      o.el.style.removeProperty("zoom");
    } else if (escala === 1) {
      o.el.style.removeProperty("zoom");
    } else {
      o.el.style.setProperty("zoom", String(escala));
    }
    alca.title = rotulo();
    alca.setAttribute("aria-valuenow", String(Math.round(escala * 100)));
    agendarAjuste();
  };

  // ---- ajuste à largura: o painel da aba ativa tem que caber sem rolar ----
  const painelAtivo = (): HTMLElement | null => (o.painel ? o.el.querySelector<HTMLElement>(`${o.painel}:not([hidden])`) : null);
  const cabe = (): boolean => {
    const p = painelAtivo();
    return !p || p.scrollWidth <= p.clientWidth + 1;
  };
  let ajustando = false;
  let agendado = false;
  /** Do mais folgado ao mais apertado, o primeiro degrau em que o painel cabe (senão o último: rola). */
  const ajustarLargura = (): void => {
    agendado = false;
    if (!porLargura || ajustando || o.el.offsetParent === null) return;
    ajustando = true;
    try {
      for (const degrau of DEGRAUS_LARGURA) {
        ajuste = degrau.ajuste;
        soIcones = !!degrau.icones;
        aplicar();
        if (cabe()) break;
      }
    } finally {
      ajustando = false;
    }
  };
  const agendarAjuste = (): void => {
    if (!porLargura || ajustando || agendado) return;
    // microtarefa: roda logo depois da mudança, junto das outras (várias mudanças = um ajuste só)
    agendado = true;
    queueMicrotask(ajustarLargura);
  };

  const avisar = (): void => {
    document.dispatchEvent(new CustomEvent(EVENTO_ESCALA, { detail: escala }));
  };

  // Duplo clique volta ao normal. Não dá para usar o evento `dblclick`: o
  // `preventDefault` do pointerdown (abaixo) corta os eventos de mouse de
  // compatibilidade, e o navegador para de contar o segundo clique como duplo.
  // Então contamos aqui: dois toques próximos, no mesmo lugar.
  let ultimoToque = 0;
  let ultimoX = 0;
  let ultimoY = 0;

  alca.addEventListener("pointerdown", (e) => {
    if (e.button !== 0) return;
    e.preventDefault();

    const agora = Date.now();
    const duplo =
      agora - ultimoToque < 350 && Math.abs(e.clientX - ultimoX) < 6 && Math.abs(e.clientY - ultimoY) < 6;
    ultimoToque = agora;
    ultimoX = e.clientX;
    ultimoY = e.clientY;
    if (duplo) {
      escala = 1;
      aplicar();
      gravarEscala(1);
      avisar();
      return;
    }

    // capturar o ponteiro é o ideal, mas não pode impedir o arrasto se falhar
    try {
      alca.setPointerCapture(e.pointerId);
    } catch {
      /* ponteiro sintético/sem captura: segue pelo listener no próprio elemento */
    }
    alca.classList.add("arrastando");
    document.body.style.cursor = "row-resize";
    const y0 = e.clientY;
    const s0 = escala;
    // altura na escala 1 (a do começo do arrasto) manda na sensibilidade do gesto
    const base = Math.max(80, o.el.getBoundingClientRect().height / (escala || 1));
    const mover = (ev: PointerEvent) => {
      const s = Math.max(ESCALA_MIN, Math.min(ESCALA_MAX, s0 + (ev.clientY - y0) / base));
      escala = Math.round(s * 100) / 100;
      aplicar();
    };
    const soltar = (): void => {
      alca.removeEventListener("pointermove", mover);
      alca.removeEventListener("pointerup", soltar);
      alca.removeEventListener("pointercancel", soltar);
      alca.classList.remove("arrastando");
      document.body.style.removeProperty("cursor");
      gravarEscala(escala);
      avisar();
    };
    alca.addEventListener("pointermove", mover);
    alca.addEventListener("pointerup", soltar);
    alca.addEventListener("pointercancel", soltar);
  });

  // com o foco na borda, as setas também ajustam (acessibilidade)
  alca.tabIndex = 0;
  alca.addEventListener("keydown", (e) => {
    if (e.key !== "ArrowUp" && e.key !== "ArrowDown") return;
    e.preventDefault();
    const passo = e.key === "ArrowUp" ? 0.05 : -0.05;
    escala = Math.round(Math.max(ESCALA_MIN, Math.min(ESCALA_MAX, escala + passo)) * 100) / 100;
    aplicar();
    gravarEscala(escala);
    avisar();
  });

  // outra faixa mudou o tamanho: acompanha
  document.addEventListener(EVENTO_ESCALA, (e) => {
    const v = Number((e as CustomEvent).detail);
    if (!Number.isFinite(v)) return;
    escala = Math.max(ESCALA_MIN, Math.min(ESCALA_MAX, v));
    aplicar();
  });

  // a janela (ou o painel lateral) mudou de largura, outra aba abriu ou os botões mudaram: refaz
  if (porLargura) {
    let larguraAntes = o.el.clientWidth;
    new ResizeObserver(() => {
      if (o.el.clientWidth === larguraAntes) return;
      larguraAntes = o.el.clientWidth;
      agendarAjuste();
    }).observe(o.el);
    new MutationObserver(agendarAjuste).observe(o.el, { subtree: true, attributes: true, attributeFilter: ["hidden"] });
  }

  aplicar();
}

/**
 * Os degraus do ajuste à largura, do mais folgado ao mais apertado: quanto as métricas da fita
 * encolhem (a fonte tem piso no CSS; abaixo de ~88% a fita vira compacta) e quando os botões
 * pequenos ficam só com o ícone.
 */
const DEGRAUS_LARGURA: { ajuste: number; icones?: boolean }[] = [{ ajuste: 1 }, { ajuste: 0.92 }, { ajuste: 0.84 }, { ajuste: 0.84, icones: true }, { ajuste: 0.7, icones: true }];

/**
 * Faz a roda do mouse andar de LADO num trecho que passa da largura (as fitas e a galeria de
 * Estilos, por exemplo).
 *
 * Esses trechos rolam na horizontal com a barra escondida; na galeria de Estilos, sem botão
 * próprio, não havia como alcançar o que ficava cortado — a roda ali não fazia nada. Agora a roda
 * vertical vira rolagem lateral, como nas galerias do Office, com três cuidados:
 * - um trecho DENTRO de outro (a galeria dentro da fita) pega o gesto para si — o evento fica
 *   marcado como tratado (`defaultPrevented`) e o de fora não rola junto nem encadeia;
 * - `Ctrl`/`Shift`/roda lateral seguem o caminho normal (zoom e rolagem nativa);
 * - o gesto é do trecho que tem o que rolar: quando ele não passa da largura, o evento segue
 *   livre (quem estiver atrás decide).
 */
export function ligarRodaHorizontal(el: HTMLElement): void {
  el.addEventListener(
    "wheel",
    (e) => {
      if (e.defaultPrevented) return; // um trecho de dentro já pegou o gesto
      if (e.ctrlKey || e.metaKey || e.shiftKey) return; // zoom (Ctrl+roda) e atalhos ficam de fora
      if (Math.abs(e.deltaX) >= Math.abs(e.deltaY)) return; // roda lateral: rolagem normal
      const max = el.scrollWidth - el.clientWidth;
      if (max <= 1) return; // não há o que rolar: o gesto segue livre
      // o gesto é DESTE trecho — mesmo no fim ele não "vaza" para o de fora (a galeria no fim
      // não deve arrastar a fita inteira, que é o que aconteceria por encadeamento)
      e.preventDefault();
      el.scrollLeft = Math.max(0, Math.min(max, el.scrollLeft + e.deltaY));
    },
    { passive: false }
  );
}
