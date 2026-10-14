// Toca as animações de forma numa lâmina desenhada — a prévia no editor e a apresentação (F5)
// usam este mesmo jogador. Recebe a raiz com as formas (`[data-shape]`) e a lista de animações
// da lâmina e devolve um controle: "próximo" (o clique da apresentação) e "cancelar".
import type { Animacao } from "../schema";
import { atrasoDe, direcaoDeAnimacao, duracaoEfetiva, entrada, inicioDe } from "../edicao/animacao";

/** Classes que o CSS anima (styles/slides.css). */
const OCULTA = "forma-oculta";
const SURGE = "forma-surge";
const SOME = "forma-some";
const PULSA = "forma-pulsa";
const AMPLIA = "forma-amplia";
const GIRA = "forma-gira";
const TRANSP = "forma-transp";
const TRAJ = "forma-traj";

/** Efeitos que terminam num estado novo (a classe fica segurando o fim da animação). */
const EFEITO_FIXO: Partial<Record<Animacao["tipo"], string>> = { ampliar: AMPLIA, girar: GIRA, transparencia: TRANSP, trajetoria: TRAJ };

export interface ControleAnimacoes {
  /** Toca o próximo passo pendente (o clique da apresentação). false = não havia o que tocar. */
  proximo(): boolean;
  /** Para tudo e limpa as classes (troca de lâmina, fechar a apresentação). */
  cancelar(): void;
}

interface Alvo {
  a: Animacao;
  /** o elemento que anima: a forma ou UM parágrafo dela (no "por parágrafo") */
  el: HTMLElement | null;
}

interface Passo {
  /** toca sozinho ("com"/"depois"); o "ao clicar" espera o clique */
  auto: boolean;
  alvos: Alvo[];
}

/** Parágrafos NÃO vazios do texto de uma forma (é o que o "por parágrafo" anima). */
function paragrafosDe(el: HTMLElement | undefined): HTMLElement[] {
  if (!el) return [];
  return [...el.querySelectorAll<HTMLElement>(".pp-shape-text > p")].filter((p) => (p.textContent ?? "").replace(/\u200b/g, "").trim() !== "");
}

/**
 * Expande a lista em alvos: o efeito "por parágrafo" vira um alvo por parágrafo —
 * o primeiro com o início escolhido e os outros ao clique ou encadeados ("depois"),
 * como o PowerPoint faz com builds.
 */
function expandir(lista: Animacao[], elementos: Map<string, HTMLElement>): Alvo[] {
  const alvos: Alvo[] = [];
  for (const a of lista) {
    const raizEl = elementos.get(a.forma);
    const paras = a.porParagrafo ? paragrafosDe(raizEl) : [];
    if (paras.length) {
      paras.forEach((p, i) => {
        const inicio = i === 0 ? a.inicio : inicioDe(a) === "clicar" ? "clicar" : "depois";
        alvos.push({ a: { ...a, inicio }, el: p });
      });
    } else {
      alvos.push({ a, el: raizEl ?? null });
    }
  }
  return alvos;
}

/** Agrupa os alvos em passos: "com" entra no passo atual; "clicar"/"depois" abrem um novo. */
function agrupar(alvos: Alvo[]): Passo[] {
  const passos: Passo[] = [];
  for (const alvo of alvos) {
    const inicio = inicioDe(alvo.a);
    if (inicio === "com" && passos.length) passos[passos.length - 1].alvos.push(alvo);
    else passos.push({ auto: inicio !== "clicar", alvos: [alvo] });
  }
  return passos;
}

export function iniciarAnimacoes(
  raiz: HTMLElement,
  animacoes: Animacao[] | undefined,
  opts: { atrasoMs?: number; automatico?: boolean } = {}
): ControleAnimacoes {
  const vazio: ControleAnimacoes = { proximo: () => false, cancelar: () => {} };
  const lista = animacoes ?? [];
  if (!lista.length) return vazio;

  const reduzido = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;
  const elementos = new Map<string, HTMLElement>();
  for (const el of raiz.querySelectorAll<HTMLElement>("[data-shape]")) elementos.set(el.dataset.shape!, el);

  const alvos = expandir(lista, elementos);
  const passos = agrupar(alvos).filter((p) => p.alvos.some((x) => x.el));
  if (!passos.length) return vazio;

  // a trajetória anda 25% da lâmina (o mesmo que o preset "Linhas" do PowerPoint):
  // as medidas saem da própria lâmina, então valem na prévia e no F5
  const larg = raiz.clientWidth || raiz.getBoundingClientRect().width || 0;
  const alt = raiz.clientHeight || raiz.getBoundingClientRect().height || 0;

  // estado inicial: efeitos de entrada escondem o alvo (a forma ou o parágrafo) até a vez dele
  for (const alvo of alvos) {
    if (entrada(alvo.a.tipo)) alvo.el?.classList.add(OCULTA);
  }

  let indice = 0;
  let timer = 0;
  let vivo = true;

  /** Toca um alvo e devolve quanto ele leva (atraso + duração, ms). */
  const tocar = ({ a, el }: Alvo): number => {
    if (!el) return 0;
    const ms = reduzido ? 0 : Math.round(duracaoEfetiva(a) * 1000);
    const atrasoMs = reduzido ? 0 : Math.round(atrasoDe(a) * 1000);

    /** Aplica o efeito no elemento (depois do atraso, quando houver). */
    const aplicar = (): void => {
      if (!vivo) return;
      if (a.tipo === "aparecer") {
        el.classList.remove(OCULTA);
        return;
      }
      if (a.tipo === "desaparecer") {
        el.classList.add(OCULTA);
        return;
      }
      el.classList.remove(OCULTA);
      el.style.setProperty("--anim-dur", `${Math.max(1, ms)}ms`);
      // trajetória: a distância sai da lâmina e vai para as variáveis do keyframe
      if (a.tipo === "trajetoria") {
        const dir = direcaoDeAnimacao(a);
        const dist = 0.25 * (dir === "esquerda" || dir === "direita" ? larg : alt);
        el.style.setProperty("--traj-x", `${dir === "esquerda" ? -dist : dir === "direita" ? dist : 0}px`);
        el.style.setProperty("--traj-y", `${dir === "cima" ? -dist : dir === "baixo" ? dist : 0}px`);
      }
      // efeitos que terminam noutro estado: a classe fica (o CSS segura o fim da animação)
      const fixa = EFEITO_FIXO[a.tipo];
      const classe = a.tipo === "surgir" ? SURGE : a.tipo === "sumir" ? SOME : a.tipo === "pulsar" ? PULSA : fixa!;
      el.classList.add(classe);
      if (fixa) return;
      // efeitos que voltam ao estado normal (surgir/sumir/pulsar): limpam no fim
      const fim = () => {
        if (!vivo) return;
        el.classList.remove(classe);
        el.style.removeProperty("--anim-dur");
        if (a.tipo === "sumir") el.classList.add(OCULTA);
      };
      if (ms > 0) {
        el.addEventListener("animationend", fim, { once: true });
        window.setTimeout(fim, ms + 120); // rede de segurança
      } else {
        fim();
      }
    };

    if (atrasoMs > 0) window.setTimeout(aplicar, atrasoMs);
    else aplicar();
    return atrasoMs + ms;
  };

  /** Toca um passo inteiro (alvos em paralelo) e devolve a maior duração. */
  const tocarPasso = (p: Passo): number => {
    let maior = 0;
    for (const alvo of p.alvos) maior = Math.max(maior, tocar(alvo));
    return maior;
  };

  /** Corre os passos automáticos em sequência; para quando o próximo espera clique. */
  const correr = (): void => {
    if (!vivo) return;
    const p = passos[indice];
    if (!p) return;
    indice++;
    const ms = tocarPasso(p);
    const proximo = passos[indice];
    if (proximo && (proximo.auto || opts.automatico)) timer = window.setTimeout(correr, ms);
  };

  const atraso = Math.max(0, opts.atrasoMs ?? 0);
  if (passos[0].auto || opts.automatico) timer = window.setTimeout(correr, atraso);

  return {
    proximo(): boolean {
      if (!vivo) return false;
      const p = passos[indice];
      if (!p || p.auto) return false; // só o "ao clicar" consome o clique
      correr();
      return true;
    },
    cancelar(): void {
      vivo = false;
      window.clearTimeout(timer);
      const els = new Set<HTMLElement>();
      for (const alvo of alvos) if (alvo.el) els.add(alvo.el);
      for (const el of els) {
        el.classList.remove(OCULTA, SURGE, SOME, PULSA, AMPLIA, GIRA, TRANSP, TRAJ);
        el.style.removeProperty("--anim-dur");
        el.style.removeProperty("--traj-x");
        el.style.removeProperty("--traj-y");
      }
    },
  };
}
