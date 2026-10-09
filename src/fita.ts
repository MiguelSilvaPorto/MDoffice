// Controles compartilhados da faixa de opções (o "topo" do editor):
//
// - Recolher/expandir: botão no canto das abas, duplo clique numa aba ou Ctrl+F1.
//   Recolhida, a faixa se abre só na hora de usar: escolher um comando, mudar um
//   campo ou clicar fora devolve o espaço automaticamente (como no Office).
// - Ajustar o tamanho: arrastar a borda de baixo da faixa (cursor de redimensionar)
//   deixa tudo maior ou menor — sem cortar botão — e o duplo clique volta ao normal.
//
// As duas preferências ficam guardadas e valem para as três fitas (Word, Excel e Apresentações).

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

/** Liga o botão de recolher/expandir; devolve um atalho para alternar por código. */
export function ligarRecolherFita(o: OpcoesRecolherFita): { alternar: () => void } {
  let recolhida = ler();
  let temporaria = false; // painel à mostra só enquanto o usuário mexe na faixa

  const botao = document.createElement("button");
  botao.type = "button";
  botao.className = "fita-recolher";
  botao.innerHTML = '<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 15.5l6-6 6 6"/></svg>';
  o.abas.append(botao);

  const aplicar = (): void => {
    const escondida = recolhida && !temporaria;
    o.el.classList.toggle("fita-recolhida", escondida);
    const titulo = escondida ? "Fixar a faixa de opções (Ctrl+F1)" : "Recolher a faixa de opções (Ctrl+F1)";
    botao.title = titulo;
    botao.setAttribute("aria-label", titulo);
    botao.setAttribute("aria-expanded", String(!escondida));
  };

  /** Fixa a escolha (recolhida ou não) e guarda; avisa as outras fitas abertas. */
  const fixar = (v: boolean, avisar = true): void => {
    recolhida = v;
    temporaria = false;
    gravar(v);
    if (avisar) document.dispatchEvent(new CustomEvent(EVENTO, { detail: v }));
    aplicar();
  };

  botao.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    fixar(!recolhida);
  });

  // duplo clique numa aba fixa ou solta a faixa (como no Office)
  o.abas.addEventListener("dblclick", (e) => {
    if ((e.target as HTMLElement).closest(".fita-recolher")) return;
    e.preventDefault();
    fixar(!recolhida);
  });

  // recolhida: clicar numa aba mostra a faixa por enquanto
  o.abas.addEventListener("click", (e) => {
    if (!recolhida || temporaria) return;
    if ((e.target as HTMLElement).closest(".fita-recolher")) return;
    temporaria = true;
    aplicar();
  });

  // escolheu um comando (ou mexeu num campo): a faixa volta a fechar
  o.el.addEventListener("click", (e) => {
    if (!recolhida || !temporaria) return;
    const t = e.target as HTMLElement;
    if (o.abas.contains(t) || t.closest("select, input, textarea, .wd-ribbon-nav")) return;
    temporaria = false;
    aplicar();
  });
  o.el.addEventListener("change", (e) => {
    if (!recolhida || !temporaria) return;
    if ((e.target as HTMLElement).closest("select, input")) fixar(true, false);
  });

  // clicou fora: fecha a faixa que estava aberta só para uso
  document.addEventListener("pointerdown", (e) => {
    if (!recolhida || !temporaria) return;
    const t = e.target as HTMLElement;
    if (o.el.contains(t) || t.closest(".fita-resize")) return;
    temporaria = false;
    aplicar();
  });

  // Ctrl+F1 alterna (só quando a fita está à vista)
  document.addEventListener("keydown", (e) => {
    if (!e.ctrlKey || e.key !== "F1") return;
    if (!o.el.isConnected || o.el.offsetParent === null) return;
    e.preventDefault();
    e.stopPropagation();
    fixar(!recolhida);
  });

  // outra fita mudou a preferência: acompanha
  document.addEventListener(EVENTO, (e) => {
    recolhida = !!(e as CustomEvent).detail;
    temporaria = false;
    aplicar();
  });

  aplicar();
  return { alternar: () => fixar(!recolhida) };
}

/**
 * Deixa ajustar o tamanho da faixa arrastando a borda de baixo: ao passar o mouse
 * aparece o cursor de redimensionar e, arrastando, os botões acompanham (a faixa
 * fica menor e sobra espaço para o documento, ou maior para quem prefere assim).
 * Duplo clique na borda volta ao tamanho normal.
 */
export function ligarAjusteAlturaFita(o: { el: HTMLElement }): void {
  let escala = lerEscala();

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
    if (escala === 1) o.el.style.removeProperty("zoom");
    else o.el.style.setProperty("zoom", String(escala));
    alca.title = rotulo();
    alca.setAttribute("aria-valuenow", String(Math.round(escala * 100)));
  };

  const avisar = (): void => {
    document.dispatchEvent(new CustomEvent(EVENTO_ESCALA, { detail: escala }));
  };

  alca.addEventListener("pointerdown", (e) => {
    if (e.button !== 0) return;
    e.preventDefault();
    alca.setPointerCapture(e.pointerId);
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

  alca.addEventListener("dblclick", () => {
    escala = 1;
    aplicar();
    gravarEscala(1);
    avisar();
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

  aplicar();
}
