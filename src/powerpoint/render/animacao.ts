// Toca as animações de forma numa lâmina desenhada — a prévia no editor e a apresentação (F5)
// usam este mesmo jogador. Recebe a raiz com as formas (`[data-shape]`) e a lista de animações
// da lâmina e devolve um controle: "próximo" (o clique da apresentação) e "cancelar".
import type { Animacao } from "../schema";
import { atrasoDe, duracaoEfetiva, entrada, inicioDe } from "../edicao/animacao";

/** Classes que o CSS anima (styles/slides.css). */
const OCULTA = "forma-oculta";
const SURGE = "forma-surge";
const SOME = "forma-some";
const PULSA = "forma-pulsa";
const AMPLIA = "forma-amplia";
const GIRA = "forma-gira";
const TRANSP = "forma-transp";

/** Ênfase que termina num estado novo (a classe fica segurando o fim da animação). */
const ENFASE_FIXA: Partial<Record<Animacao["tipo"], string>> = { ampliar: AMPLIA, girar: GIRA, transparencia: TRANSP };

export interface ControleAnimacoes {
  /** Toca o próximo passo pendente (o clique da apresentação). false = não havia o que tocar. */
  proximo(): boolean;
  /** Para tudo e limpa as classes (troca de lâmina, fechar a apresentação). */
  cancelar(): void;
}

interface Passo {
  /** toca sozinho ("com"/"depois"); o "ao clicar" espera o clique */
  auto: boolean;
  efeitos: Animacao[];
}

/** Agrupa a lista em passos: "com" entra no passo atual; "clicar"/"depois" abrem um novo. */
function agrupar(animacoes: Animacao[]): Passo[] {
  const passos: Passo[] = [];
  for (const a of animacoes) {
    const inicio = inicioDe(a);
    if (inicio === "com" && passos.length) passos[passos.length - 1].efeitos.push(a);
    else passos.push({ auto: inicio !== "clicar", efeitos: [a] });
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

  const passos = agrupar(lista).filter((p) => p.efeitos.some((e) => elementos.has(e.forma)));
  if (!passos.length) return vazio;

  // estado inicial: efeitos de entrada escondem a forma até o passo dela chegar
  for (const a of lista) {
    if (entrada(a.tipo)) elementos.get(a.forma)?.classList.add(OCULTA);
  }

  let indice = 0;
  let timer = 0;
  let vivo = true;

  /** Toca um efeito e devolve quanto ele leva (atraso + duração, ms). */
  const tocar = (a: Animacao): number => {
    const el = elementos.get(a.forma);
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
      // ênfase que termina noutro estado: a classe fica (o CSS segura o fim da animação)
      const fixa = ENFASE_FIXA[a.tipo];
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

  /** Toca um passo inteiro (efeitos em paralelo) e devolve a maior duração. */
  const tocarPasso = (p: Passo): number => {
    let maior = 0;
    for (const a of p.efeitos) maior = Math.max(maior, tocar(a));
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
      for (const el of elementos.values()) {
        el.classList.remove(OCULTA, SURGE, SOME, PULSA, AMPLIA, GIRA, TRANSP);
        el.style.removeProperty("--anim-dur");
      }
    },
  };
}
