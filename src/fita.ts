// Controles compartilhados da faixa de opções (o "topo" do editor):
//
// - Recolher/expandir: **Ctrl+F1** (a dica vive no `title` da barra das abas) e o **clique numa
//   aba**, no modo recolhido, que mostra a faixa completa — e a escolha fica. Recolhida, a faixa é
//   a **faixa única**: os grupos viram botões com menu (ver o `fitaEncaixe.ts`).
// - A faixa **não se recolhe sozinha**. O modo recolhido já teve o "por enquanto": a faixa abria
//   com um clique e voltava ao recolhido ao primeiro clique fora dela (na lâmina, num comando,
//   depois de um popup). Cada caminho desses virou um relato de "a faixa recolheu do nada" — e o
//   pior era trabalhar na lâmina no meio do uso. Agora **abrir é um pedido**: ela só volta ao
//   recolhido no Ctrl+F1 (e é o Ctrl+F1 que a mostra de novo, quando está recolhida).
// - Ajustar o tamanho: arrastar a borda de baixo da faixa (cursor de redimensionar)
//   deixa tudo maior ou menor — sem cortar botão — e o duplo clique volta ao normal.
//
// As duas preferências ficam guardadas e valem para as três fitas (Word, Excel e Apresentações).

import { EVENTO_MUDOU, combina, emCaptura, teclaVisivel } from "./app/keymap";
import { AJUSTE_MIN, encaixarFita } from "./fitaEncaixe";

export interface OpcoesRecolherFita {
  /** raiz da faixa: recebe a classe `fita-recolhida` */
  el: HTMLElement;
  /** onde ficam as abas: recebe a dica (title/aria-label) do gesto */
  abas: HTMLElement;
  /** raiz dos painéis que somem quando a faixa está recolhida */
  paineis: HTMLElement;
}

const CHAVE = "mdc.fita.recolhida";
const EVENTO = "mdc:fita-recolhida";
/**
 * A faixa MUDOU DE MODO (recolhida ↔ à vista). É um evento separado do `EVENTO` de propósito: quem
 * escuta o `EVENTO` sincroniza a **preferência** e reage mexendo na classe outra vez — se o encaixe
 * escutasse o mesmo evento, os dois se chamariam em laço. Aqui só avisa quem precisa re-planejar.
 */
const EVENTO_MODO = "mdc:fita-modo";
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

/** Liga o recolher/expandir (Ctrl+F1 ou o clique numa aba); devolve um atalho por código. */
export function ligarRecolherFita(o: OpcoesRecolherFita): { alternar: () => void } {
  let recolhida = ler();

  const aplicar = (): void => {
    // Sem a janela "por enquanto", o que a faixa mostra é SEMPRE a escolha guardada — o nome
    // `escondida` ficou do tempo em que o recolhido escondia a faixa de vez; hoje ele é o modo da
    // **faixa única** (os grupos viram botões com menu).
    const escondida = recolhida;
    const antes = o.el.classList.contains("fita-recolhida");
    o.el.classList.toggle("fita-recolhida", escondida);
    // O encaixe decide o plano pela classe (`fita-recolhida` = todos os grupos em botão, a "faixa
    // única"): quando o modo muda DE VERDADE, ele precisa re-planejar. (O evento é próprio para não
    // fazer laço com o da preferência — ver a constante.)
    if (antes !== escondida) document.dispatchEvent(new CustomEvent(EVENTO_MODO));
    // sem botão (o chevron saiu a pedido): a dica vive na barra das abas, que é onde o gesto mora
    const titulo = escondida
      ? `Mostrar a faixa de opções completa (${teclaVisivel("fita")}) ou clique numa aba`
      : `Recolher a faixa de opções, deixando a faixa única (${teclaVisivel("fita")})`;
    o.abas.title = titulo;
    o.abas.setAttribute("aria-label", `Abas da faixa de opções — ${titulo}`);
  };

  /** Fixa a escolha (recolhida ou não) e guarda; avisa as outras fitas abertas. */
  const fixar = (v: boolean, avisar = true): void => {
    recolhida = v;
    gravar(v);
    if (avisar) document.dispatchEvent(new CustomEvent(EVENTO, { detail: v }));
    aplicar();
  };

  // recolhida: clicar numa aba (ou no Template, que vive na mesma barra) mostra a faixa completa
  // — e ela fica: abrir é um pedido, e a escolha é guardada como a do Ctrl+F1 (nada a esconde
  // por baixo: nem a lâmina, nem um comando, nem um popup; ver o comentário do topo)
  o.abas.addEventListener("click", () => {
    if (recolhida) fixar(false);
  });

  // Ctrl+F1 alterna (só quando a fita está à vista). A tecla vem do `keymap.ts`,
  // como todas as outras: é o que deixa ela aparecer — e ser trocada — na aba
  // Atalhos das Configurações.
  document.addEventListener("keydown", (e) => {
    if (emCaptura() || !combina("fita", e)) return;
    if (!o.el.isConnected || o.el.offsetParent === null) return;
    e.preventDefault();
    e.stopPropagation();
    fixar(!recolhida);
  });

  // outra fita mudou a preferência: acompanha
  document.addEventListener(EVENTO, (e) => {
    recolhida = !!(e as CustomEvent).detail;
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
 *   três fitas (Apresentações, Word e Excel).
 *
 * A alça tem TETO: o menor entre `ESCALA_MAX` (1,5×) e um TERÇO da janela. Numa janela baixa, uma
 * faixa de 1,5× comeria a tela e o documento sumiria — o teto é medido na hora do arrasto (e de
 * novo quando a janela muda de tamanho); o valor guardado é a preferência, só a altura À VISTA é
 * limitada.
 *
 * O aperto da LARGURA não é daqui: quem decide o que fazer quando a fita não cabe é o
 * `ligarEncaixeFita` (os quatro degraus, em `fitaEncaixe.ts`).
 */
export function ligarAjusteAlturaFita(o: { el: HTMLElement; modo?: "zoom" | "metricas" }): void {
  let escala = lerEscala();
  const porMetricas = o.modo === "metricas";

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

  /** A escala que está de fato no CSS (a preferência depois do teto) — é ela que mede a altura 1×. */
  let aplicada = escala;
  const alturaNaEscala1 = (): number => Math.max(80, o.el.getBoundingClientRect().height / (aplicada || 1));

  /**
   * O TETO da faixa: o menor entre `ESCALA_MAX` (1,5×) e um TERÇO da janela. A conta usa a altura
   * que a faixa tem na escala 1 (a de agora dividida pela escala aplicada): assim o teto vale para
   * a altura REAL, e não para a escala solta (que depende de quantos botões a aba tem).
   */
  const teto = (): number => {
    const porJanela = window.innerHeight / 3 / alturaNaEscala1();
    return Math.max(ESCALA_MIN, Math.min(ESCALA_MAX, porJanela));
  };

  const aplicar = (): void => {
    // a escala vai para o CSS; cada fita decide o que fazer com ela. O teto limita a altura À
    // VISTA (o valor guardado é a preferência — a janela volta a crescer e ele volta inteiro).
    const efetiva = Math.min(escala, teto());
    o.el.style.setProperty("--fita-escala", String(efetiva));
    if (porMetricas) {
      // nada de `zoom`: ele encolheria também a fonte (o piso fica no CSS)
      o.el.style.removeProperty("zoom");
    } else if (efetiva === 1) {
      o.el.style.removeProperty("zoom");
    } else {
      o.el.style.setProperty("zoom", String(efetiva));
    }
    aplicada = efetiva;
    alca.title = rotulo();
    alca.setAttribute("aria-valuenow", String(Math.round(efetiva * 100)));
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
    const base = alturaNaEscala1();
    const mover = (ev: PointerEvent) => {
      const s = s0 + (ev.clientY - y0) / base;
      escala = Math.round(Math.max(ESCALA_MIN, Math.min(s, teto())) * 100) / 100;
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
    escala = Math.round(Math.max(ESCALA_MIN, Math.min(teto(), escala + passo)) * 100) / 100;
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

  // a janela mudou de ALTURA: o teto é um terço dela — a faixa volta para dentro do limite
  window.addEventListener("resize", aplicar);

  aplicar();
}

/**
 * OS QUATRO DEGRAUS DA LARGURA (o plano vem do `fitaEncaixe.ts`, que é puro e testável): mede os
 * grupos da aba ativa, decide o plano e o aplica.
 *
 * Quando um grupo não cabe, ele vira um **botão com o nome do grupo**; clicar abre o menu com os
 * controles DAQUELE grupo — o corpo do grupo é MOVIDO para o menu, não copiado: os campos
 * continuam ligados (o despacho das três fitas é por delegação na raiz da faixa, e o menu vive
 * dentro dela) e o estado dos `select`/`input` é o de verdade. Fechar o menu devolve o corpo ao
 * grupo, antes do rótulo.
 *
 * No modo recolhido (`fita-recolhida`) o plano é o quarto degrau: TODOS os grupos em botão, numa
 * faixa só que acompanha a aba ativa — o "mais" de cada grupo é o menu dele.
 *
 * Nada de barra de rolagem: quem garante é o encaixe (e o último degrau é curto o bastante para
 * qualquer janela em que o app abre); os botões encolhem com elipse (CSS) na faixa única.
 */
export interface OpcoesEncaixeFita {
  /** raiz da faixa (a que tem as abas e os painéis) */
  el: HTMLElement;
  /** seletor do painel de cada aba (o que troca por `hidden`) */
  painel: string;
  /** seletor do grupo dentro do painel */
  grupo: string;
  /** seletor do corpo do grupo (o que é movido para o menu) */
  corpo: string;
  /** seletor do rótulo do grupo (dá o nome do botão) */
  rotulo: string;
}

export function ligarEncaixeFita(o: OpcoesEncaixeFita): void {
  // o menu dos grupos: criado uma vez, dentro da raiz da faixa (é o que mantém o despacho valendo)
  const pop = document.createElement("div");
  pop.className = "fita-grupo-pop";
  pop.hidden = true;
  o.el.append(pop);

  /** O grupo que está com o corpo no menu (null = menu fechado). */
  let aberto: { grupo: HTMLElement; corpo: HTMLElement; botao: HTMLButtonElement } | null = null;

  const painelAtivo = (): HTMLElement | null => o.el.querySelector<HTMLElement>(`${o.painel}:not([hidden])`);

  const escalaAtual = (): number => {
    const v = Number(getComputedStyle(o.el).getPropertyValue("--fita-escala"));
    return Number.isFinite(v) && v > 0 ? v : 1;
  };

  const fecharMenu = (): void => {
    if (!aberto) return;
    const { grupo, corpo, botao } = aberto;
    const rotulo = grupo.querySelector<HTMLElement>(`:scope > ${o.rotulo}`);
    grupo.insertBefore(corpo, rotulo ?? null);
    aberto = null;
    pop.hidden = true;
    pop.style.removeProperty("left");
    pop.style.removeProperty("top");
    botao.setAttribute("aria-expanded", "false");
  };

  const abrirMenu = (grupo: HTMLElement, botao: HTMLButtonElement): void => {
    fecharMenu();
    const corpo = grupo.querySelector<HTMLElement>(`:scope > ${o.corpo}`);
    if (!corpo) return;
    // o corpo sai do grupo e vai para o menu: os controles são os mesmos (nada de cópia)
    pop.append(corpo);
    pop.hidden = false;
    pop.style.left = "0px";
    pop.style.top = "0px";
    const r = botao.getBoundingClientRect();
    const caixa = o.el.getBoundingClientRect();
    const largura = pop.offsetWidth;
    pop.style.left = `${Math.round(Math.max(0, Math.min(r.left - caixa.left, caixa.width - largura)))}px`;
    pop.style.top = `${Math.round(r.bottom - caixa.top + 3)}px`;
    aberto = { grupo, corpo, botao };
    botao.setAttribute("aria-expanded", "true");
  };

  /** O botão do grupo (criado na primeira vez que ele colapsa; o nome vem do rótulo do grupo). */
  const botaoDo = (grupo: HTMLElement): HTMLButtonElement => {
    let b = grupo.querySelector<HTMLButtonElement>(":scope > .fita-grupo-btn");
    if (!b) {
      b = document.createElement("button");
      b.type = "button";
      b.className = "fita-grupo-btn";
      b.innerHTML = `<span class="fita-grupo-nome"></span><span class="car" aria-hidden="true">▾</span>`;
      b.setAttribute("aria-expanded", "false");
      b.addEventListener("click", (e) => {
        // o clique é do botão do grupo: não é comando da fita (o despacho procura `[data-cmd]`)
        e.stopPropagation();
        const botao = e.currentTarget as HTMLButtonElement;
        if (aberto?.grupo === grupo) fecharMenu();
        else abrirMenu(grupo, botao);
      });
      grupo.prepend(b);
    }
    const nome = (grupo.querySelector<HTMLElement>(o.rotulo)?.textContent ?? "").trim();
    b.querySelector<HTMLElement>(".fita-grupo-nome")!.textContent = nome;
    b.title = `${nome} — abrir os controles deste grupo`;
    b.setAttribute("aria-label", b.title);
    return b;
  };

  /** Aplica o plano dos quatro degraus na aba ativa. */
  const aplicar = (): void => {
    if (o.el.offsetParent === null) return; // fita escondida: não há o que medir
    const painel = painelAtivo();
    if (!painel) return;
    fecharMenu();
    const grupos = [...painel.querySelectorAll<HTMLElement>(o.grupo)];
    if (!grupos.length) return;
    // medir é SEMPRE com tudo aberto e as métricas em 1: a largura do grupo é a natural dele
    for (const g of grupos) g.classList.remove("fita-grupo-recolhido");
    o.el.style.setProperty("--fita-ajuste", "1");
    const escala = escalaAtual();
    const css = getComputedStyle(painel);
    const gap = Number.parseFloat(css.columnGap) || 0;
    const interno = painel.clientWidth - (Number.parseFloat(css.paddingLeft) || 0) - (Number.parseFloat(css.paddingRight) || 0);
    const larguras = grupos.map((g) => g.getBoundingClientRect().width / escala);

    const plano = encaixarFita(interno, larguras, {
      escala,
      gap: gap / escala,
      faixaUnica: o.el.classList.contains("fita-recolhida"),
    });

    o.el.style.setProperty("--fita-ajuste", String(plano.ajuste));
    // fita baixa: os botões grandes viram "ícone + nome" numa linha (o piso da fonte está no CSS)
    o.el.classList.toggle("fita-compacta", escala * plano.ajuste < 0.88);
    o.el.classList.toggle("fita-modo-unico", plano.degrau === "faixa-unica");
    o.el.dataset.fitaDegrau = plano.degrau;
    grupos.forEach((g, i) => {
      const colapsado = plano.noMenu.includes(i);
      g.classList.toggle("fita-grupo-recolhido", colapsado);
      if (colapsado) botaoDo(g);
    });

    // O plano é uma ESTIMATIVA: ele supõe que cada grupo encolhe junto com as métricas, e os que têm
    // largura própria (a galeria de animações) ou texto com piso de fonte encolhem menos. Então,
    // com o plano aplicado, confere-se no DOM: se ainda sobra rolagem, o último grupo aberto vira
    // botão, e assim por diante (nunca fica um painel rolando).
    if (plano.degrau !== "faixa-unica") {
      // primeiro encolhe mais as métricas, aos poucos, até o piso — só depois um grupo vira botão
      for (let aj = plano.ajuste - 0.05; aj >= AJUSTE_MIN - 1e-6 && painel.scrollWidth > painel.clientWidth + 1; aj -= 0.05) {
        o.el.style.setProperty("--fita-ajuste", String(Math.round(aj * 100) / 100));
        o.el.classList.toggle("fita-compacta", escala * aj < 0.88);
      }
      const abertos = grupos.filter((g) => !g.classList.contains("fita-grupo-recolhido"));
      let colapsou = false;
      for (let i = abertos.length - 1; i >= 0 && painel.scrollWidth > painel.clientWidth + 1; i--) {
        abertos[i].classList.add("fita-grupo-recolhido");
        botaoDo(abertos[i]);
        colapsou = true;
      }
      if (colapsou) o.el.dataset.fitaDegrau = "menu";
    }
  };

  let agendado = false;
  const agendar = (): void => {
    if (agendado) return;
    // microtarefa: roda logo depois da mudança (várias mudanças seguidas = um encaixe só)
    agendado = true;
    queueMicrotask(() => {
      agendado = false;
      aplicar();
    });
  };

  // clicou fora do menu (e do botão que o abriu): fecha
  document.addEventListener("pointerdown", (e) => {
    if (!aberto) return;
    const t = e.target as HTMLElement;
    if (pop.contains(t) || t.closest(".fita-grupo-btn")) return;
    fecharMenu();
  });
  // escolheu um comando do menu: fecha (menus com `data-menu` abrem popup próprio e ficam)
  pop.addEventListener("click", (e) => {
    const b = (e.target as HTMLElement).closest<HTMLElement>("[data-cmd]");
    if (b && !b.hasAttribute("data-menu")) fecharMenu();
  });
  // Esc fecha o menu
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") fecharMenu();
  });

  // a janela mudou de largura, a aba trocou, o modo recolhido mudou ou os botões mudaram: reencaixa
  let larguraAntes = o.el.clientWidth;
  new ResizeObserver(() => {
    if (o.el.clientWidth === larguraAntes) return;
    larguraAntes = o.el.clientWidth;
    agendar();
  }).observe(o.el);
  // Só o `hidden` (a troca de aba). O `class` NÃO entra aqui de propósito: o próprio encaixe mexe
  // nas classes dos grupos, e observar isso o faria reencaixar a cada passagem (um laço).
  // O MENU dos grupos também liga/desliga o próprio `hidden` ao abrir e ao fechar — isso não é "a
  // aba trocou": re-planejar aqui fechava o menu no tique seguinte (ele abria e sumia, e todo
  // controle de um grupo recolhido — o Assistente do Draw, por exemplo — ficava inalcançável).
  new MutationObserver((registros) => {
    if (registros.every((r) => pop.contains(r.target))) return;
    agendar();
  }).observe(o.el, { subtree: true, attributes: true, attributeFilter: ["hidden"] });
  // outra faixa mudou a altura (e com ela as métricas): reencaixa
  document.addEventListener(EVENTO_ESCALA, agendar);
  // recolher/expandir muda o modo (a faixa única do quarto degrau)
  document.addEventListener(EVENTO, agendar);
  // o modo mudou DE VERDADE (a classe `fita-recolhida` entrou ou saiu): o plano é outro — recolhida,
  // a fita é uma faixa só, com todos os grupos em botão
  document.addEventListener(EVENTO_MODO, agendar);
  window.addEventListener("resize", agendar);

  aplicar();
}

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
