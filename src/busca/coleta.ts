// Coleta dos botões REAIS das fitas.
//
// A ideia: em vez de escrever uma lista de comandos (e correr o risco de
// esquecer um), a busca lê as fitas que estão na tela e vira cada botão em um
// comando — com o rótulo, o ícone e o grupo de verdade. Um botão novo que
// nascer na fita aparece na busca sozinho.
//
// A aba importa: o botão pode estar numa aba que não está à vista ("Fórmulas",
// "Inserir", "Transições"…). Nesse caso a busca mostra o botão e, ao executá-lo,
// aciona a aba antes de clicar.
//
// As fitas dos OUTROS módulos também entram (com a etiqueta do módulo): a
// pessoa pode estar numa planilha e mesmo assim achar a função de animação da
// apresentação. Ao executar, o app troca para a aba daquele módulo.

import type { Comando, Modulo } from "./tipos";
import { MODULOS, moduloAtivo } from "./tipos";

/** Troca para a aba de um módulo (o app sabe qual é). */
export type TrocarPara = (modulo: Modulo) => Promise<boolean>;

/** Onde fica a fita de cada módulo. */
const FITAS: Record<Modulo, string> = {
  md: "#toolbar",
  word: "#word-ribbon",
  xlsx: "#xl-ribbon",
  ppt: "#pp-ribbon",
};

/** A ordem de visita: o módulo à vista primeiro, os outros depois. */
const ORDEM: Modulo[] = ["md", "word", "xlsx", "ppt"];

/** O painel de uma aba da fita (o Word, a Planilha e a Apresentação têm um). */
const PAINEL = "[data-panel], [data-xlpanel], [data-painel], #toolbar-more";

/** O botão está num esconderijo que não é painel de aba? Então não entra. */
function visivel(b: HTMLElement, raiz: HTMLElement): boolean {
  let a = b.parentElement;
  while (a && a !== raiz) {
    if (a.hidden) {
      // painel de fita: o botão entra (a aba é acionada na hora de executar)
      if (a.matches(PAINEL)) {
        a = a.parentElement;
        continue;
      }
      return false;
    }
    a = a.parentElement;
  }
  return true;
}

/** O id do painel em que o botão está ("formulas", "inserir"…). */
function idDoPainel(b: HTMLElement): string | null {
  const painel = b.closest<HTMLElement>(PAINEL);
  if (!painel) return null;
  return painel.dataset.panel ?? painel.dataset.xlpanel ?? painel.dataset.painel ?? null;
}

/**
 * A aba que abre o painel do botão.
 *
 * `null` quando o painel não tem aba (não é um painel de fita) ou quando a aba
 * está escondida — a aba "Tabela" do Word só existe com o cursor numa tabela, e
 * a "Formato da Forma" do PowerPoint só com uma forma selecionada.
 */
function abaDo(b: HTMLElement, raiz: HTMLElement): { nome: string; id: string } | null {
  const id = idDoPainel(b);
  if (!id) return null;
  const aba = raiz.querySelector<HTMLElement>(`[data-tab="${id}"], [data-xltab="${id}"], [data-aba="${id}"]`);
  if (!aba || aba.hidden) return null;
  const nome =
    aba.querySelector("[data-nome]")?.getAttribute("data-nome")?.trim() ||
    aba.textContent?.trim() ||
    "";
  return nome ? { nome, id } : null;
}

/** O nome do grupo da fita onde o botão está ("Parágrafo", "Células"…). */
function grupoDaFita(b: HTMLElement): string {
  const g = b.closest(".rb-group, .xl-group, .ppr-grupo");
  const rotulo = g?.querySelector(".rb-glabel, .xl-glabel, .ppr-rotulo")?.textContent?.trim() ?? "";
  return rotulo;
}

/** O ícone do botão: o símbolo do sprite — ou o glifo de texto, quando não há ícone. */
function iconeDo(b: HTMLElement): { icone?: string; glifo?: string } {
  const use = b.querySelector<SVGUseElement>("use");
  const ref = use?.getAttribute("href") || use?.getAttribute("xlink:href") || "";
  if (ref.startsWith("#")) return { icone: ref.slice(1) };
  // sem ícone: o botão é um glifo ("B", "N", "Σ", "R$") — vale mostrar do mesmo jeito
  const texto = (b.textContent || "").replace(/\s+/g, "").trim();
  return texto && texto.length <= 3 ? { glifo: texto } : {};
}

/** Quantas letras tem o texto? (serve para saber se ele é um nome ou um adereço) */
const letras = (s: string): number => (s.match(/\p{L}/gu) || []).length;

/**
 * O nome do botão.
 *
 * Três fontes, na ordem em que valem:
 *  1. o texto do último `<span>` do botão — é o nome que a pessoa lê na fita
 *     ("AutoSoma", "Média", "Colar", "Girar");
 *  2. o texto do próprio botão, quando ele é um nome e não um adereço
 *     ("Modelo IA" — mas "B", "R$" e "▦" são adereços);
 *  3. o `title`, sem a explicação entre parênteses ("Colar (Ctrl+V)" → "Colar").
 */
function rotuloDo(b: HTMLElement): string {
  const filhos = Array.from(b.children);
  const ultimo = filhos[filhos.length - 1];
  if (ultimo && ultimo.tagName.toLowerCase() === "span") {
    const nome = (ultimo.textContent || "").replace(/\s+/g, " ").trim();
    // três letras já ensurem que é um nome ("Média", "Girar") e não um adereço ("bc")
    if (letras(nome) >= 3) return nome;
  }
  const proprio = (b.textContent || "").replace(/\s+/g, " ").trim();
  if (letras(proprio) >= 4) return proprio;

  const bruto = b.getAttribute("aria-label") || b.getAttribute("title") || "";
  const corte = bruto.search(/[(:]/);
  const limpo = (corte > 0 ? bruto.slice(0, corte) : bruto).trim();
  return limpo || bruto.trim() || proprio;
}

/** A dica do botão (o `title` inteiro): vira palavra extra da busca. */
function dicaDo(b: HTMLElement): string {
  return (b.getAttribute("title") || b.getAttribute("aria-label") || "").trim();
}

/**
 * Os comandos das fitas.
 *
 * A fita do módulo à vista vem primeiro; as dos outros módulos também entram
 * (com a etiqueta do módulo), para a pessoa achar a função de outro formato
 * mesmo estando em outro documento.
 */
export function coletarComandos(trocarPara?: TrocarPara): Comando[] {
  const ativo = moduloAtivo();
  const ordem = ativo ? [ativo, ...ORDEM.filter((m) => m !== ativo)] : ORDEM;
  const out: Comando[] = [];
  const vistos = new Set<string>();

  for (const modulo of ordem) {
    const raiz = document.querySelector<HTMLElement>(FITAS[modulo]);
    if (!raiz) continue;

    const botoes = Array.from(raiz.querySelectorAll<HTMLElement>("button[data-cmd], button[data-act]"));
    for (const b of botoes) {
      if (!visivel(b, raiz)) continue;
      // botão de um painel sem aba à vista (aba contextual ausente): não entra
      if (idDoPainel(b) && !abaDo(b, raiz)) continue;

      const rotulo = rotuloDo(b);
      if (!rotulo) continue;
      const chave = `${modulo}:${rotulo.toLowerCase()}`;
      if (vistos.has(chave)) continue;
      vistos.add(chave);

      const aba = abaDo(b, raiz);
      const grupoDa = grupoDaFita(b);
      const grupo =
        [aba?.nome, grupoDa].filter(Boolean).join(" · ") ||
        (modulo === "md" ? "Formatação" : MODULOS[modulo].curto);

      out.push({
        label: rotulo,
        grupo,
        modulos: [modulo],
        // a dica do botão também é busca: "Girar" acha pela frase "dá uma volta completa"
        palavras: dicaDo(b),
        indisponivel:
          (b as HTMLButtonElement).disabled || b.getAttribute("aria-disabled") === "true" || undefined,
        ...iconeDo(b),
        run: () => executar(b, raiz, modulo, trocarPara),
      });
    }
  }
  return out;
}

/**
 * Executa o botão: aciona a aba da fita (se ele estiver numa aba escondida) e
 * clica. Quando o botão é de outro módulo, o app troca para a aba dele antes.
 */
async function executar(
  b: HTMLElement,
  raiz: HTMLElement,
  modulo: Modulo,
  trocarPara?: TrocarPara
): Promise<void> {
  if (modulo !== moduloAtivo()) {
    const ok = await trocarPara?.(modulo);
    if (!ok) return;
  }

  // a fita pode ter sido refeita (troca de aba): procura o botão de novo
  const raizAgora = document.querySelector<HTMLElement>(FITAS[modulo]) ?? raiz;
  const seletor = b.dataset.cmd
    ? `[data-cmd="${b.dataset.cmd}"]`
    : b.dataset.act
      ? `[data-act="${b.dataset.act}"]`
      : "";
  let alvo: HTMLElement | null = null;
  if (seletor) {
    // o mesmo botão: o do mesmo painel da fita
    const candidatos = Array.from(raizAgora.querySelectorAll<HTMLElement>(seletor)).filter(
      (c) => c.closest(PAINEL) === b.closest(PAINEL)
    );
    alvo = candidatos[0] ?? null;
  }
  if (!alvo && b.isConnected) alvo = b;
  if (!alvo) return;

  // a caixa de "mais formatação" do Markdown: abre antes de clicar (senão a
  // pessoa não veria o botão sendo acionado)
  const mais = alvo.closest<HTMLElement>("#toolbar-more");
  if (mais?.hidden) {
    raizAgora.querySelector<HTMLElement>('[data-act="toggle-more"]')?.click();
  }
  // a aba da fita (se o botão estiver num painel escondido)
  const id = idDoPainel(alvo);
  if (id) {
    const painel = alvo.closest<HTMLElement>(PAINEL);
    if (painel?.hidden) {
      const aba = raizAgora.querySelector<HTMLElement>(
        `[data-tab="${id}"], [data-xltab="${id}"], [data-aba="${id}"]`
      );
      aba?.click();
    }
  }
  alvo.click();
}
