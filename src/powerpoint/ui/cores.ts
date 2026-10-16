// Seletor de cores no estilo do PowerPoint: usados recentemente, cores do documento, cores padrão e "mais cores" (hex).
import { abrirPopup, fecharPopup } from "./popup";

/** Paleta padrão: tons de cinza e as cores clássicas do Office. */
const PADRAO: string[][] = [
  ["FFFFFF", "F2F2F2", "D9D9D9", "BFBFBF", "7F7F7F", "404040", "000000"],
  ["FF0000", "C00000", "FFC000", "FFFF00", "92D050", "00B050", "00B0F0"],
  ["0070C0", "002060", "7030A0", "E36C0A", "0BA050", "1F4E79", "833C0B"],
];

const CHAVE_RECENTES = "mdc.pp.coresRecentes";

function recentes(): string[] {
  try {
    return JSON.parse(localStorage.getItem(CHAVE_RECENTES) ?? "[]") as string[];
  } catch {
    return [];
  }
}

function lembrar(cor: string): void {
  try {
    // maiúsculas: a paleta do deck e o hex digitado podem vir em caixas diferentes, e a mesma cor
    // não pode aparecer duas vezes na lista
    const c = cor.toUpperCase();
    const l = [c, ...recentes().filter((x) => x !== c)].slice(0, 10);
    localStorage.setItem(CHAVE_RECENTES, JSON.stringify(l));
  } catch {
    /* sem armazenamento: tudo bem */
  }
}

const quad = (c: string) => `<button type="button" class="pp-sw" data-cor="${c}" style="background:#${c}" title="#${c}" aria-label="#${c}"></button>`;

export interface OpcoesCores {
  /** cor atual (sem #) para destacar */
  atual?: string | null;
  /** cores do documento (as mais usadas no deck) */
  paleta?: string[];
  /** mostra "Sem preenchimento"/"Automático" com este rótulo (undefined = não mostra) */
  semCor?: string;
  titulo?: string;
  /** blocos extras (HTML) com botões data-extra="valor"; o clique chama `aoExtra(valor)` */
  extra?: string;
  /** sem forma escolhida: o menu abre com a dica e os controles desabilitados (não há onde aplicar) */
  semSelecao?: boolean;
  /** o texto que explica o que fazer quando não há forma escolhida */
  dica?: string;
}

/** Abre o seletor; `aoEscolher(null)` = "sem cor", `aoEscolher("RRGGBB")` = cor. */
export function abrirCores(ancora: HTMLElement, op: OpcoesCores, aoEscolher: (cor: string | null) => void, aoExtra?: (valor: string) => void): void {
  const doc = (op.paleta ?? []).slice(0, 10);
  const usadas = recentes();
  const html = `
    ${op.titulo ? `<div class="pp-pop-t">${op.titulo}</div>` : ""}
    ${op.semSelecao && op.dica ? `<p class="pp-pop-dica">${op.dica}</p>` : ""}
    <div class="pp-pop-t">Usados recentemente</div>
    ${usadas.length ? `<div class="pp-swatches">${usadas.map(quad).join("")}</div>` : `<p class="pp-pop-dica">As cores que você usar aparecem aqui.</p>`}
    ${doc.length ? `<div class="pp-pop-t">Cores do documento</div><div class="pp-swatches">${doc.map(quad).join("")}</div>` : ""}
    <div class="pp-pop-t">Cores padrão</div>
    <div class="pp-swatches grade">${PADRAO.flat().map(quad).join("")}</div>
    <div class="pp-pop-t">Outra cor</div>
    <div class="pp-pop-hex">
      <input type="color" data-cor-input value="#${(op.atual ?? "000000").padEnd(6, "0")}" aria-label="Escolher cor">
      <input type="text" data-cor-hex maxlength="7" placeholder="#RRGGBB" value="${op.atual ? "#" + op.atual : ""}" aria-label="Código da cor">
      <button type="button" class="btn small" data-aplicar>OK</button>
    </div>
    ${op.semCor !== undefined ? `<button type="button" class="pp-pop-item" data-sem-cor>${op.semCor}</button>` : ""}
    ${op.extra ?? ""}`;
  const el = abrirPopup(ancora, html, { classe: "pp-cores" });
  // Sem forma escolhida não há onde pintar: o menu fica só de aviso (o clique não faz nada).
  if (op.semSelecao) {
    for (const c of el.querySelectorAll<HTMLButtonElement | HTMLInputElement>("button, input")) c.disabled = true;
  }
  const escolher = (c: string | null) => {
    if (c) lembrar(c);
    fecharPopup();
    aoEscolher(c);
  };
  /** A cor do que veio do seletor (com ou sem #, 3 ou 6 dígitos); null = ainda não é cor. */
  const comoCor = (v: string): string | null => {
    const s = v.replace(/^#/, "").trim();
    if (/^[0-9a-fA-F]{6}$/.test(s)) return s.toUpperCase();
    if (/^[0-9a-fA-F]{3}$/.test(s)) return s.split("").map((c) => c + c).join("").toUpperCase();
    return null;
  };
  /**
   * O "Outra cor" aplica SEM fechar o menu: clicar na cor do seletor do sistema (gradiente, matiz,
   * R/G/B, conta-gotas) já é a escolha, e o campo do código aplica quando o valor fica completo —
   * era o relato ("para aplicar um contorno com perfeição você precisa clicar em OK"). O menu fica
   * aberto para ajustar espessura/traço logo depois; o OK passa a ser "aplicar e fechar". Durante o
   * arrasto é uma aplicação por quadro, e a mesma cor não se repete.
   */
  let ultimaViva = "";
  let agendada = "";
  let marcada = 0;
  const aplicarAgora = (c: string): void => {
    if (c === ultimaViva) return;
    ultimaViva = c;
    aoEscolher(c);
  };
  const aplicarViva = (v: string, agora = false): void => {
    const c = comoCor(v);
    if (!c || c === ultimaViva) return;
    agendada = c;
    if (agora) {
      if (marcada) {
        cancelAnimationFrame(marcada);
        marcada = 0;
      }
      aplicarAgora(c);
      return;
    }
    if (marcada) return;
    marcada = requestAnimationFrame(() => {
      marcada = 0;
      aplicarAgora(agendada);
    });
  };
  el.addEventListener("click", (e) => {
    const t = e.target as HTMLElement;
    const sw = t.closest<HTMLElement>("[data-cor]");
    if (sw) return escolher(sw.dataset.cor!);
    if (t.closest("[data-sem-cor]")) return escolher(null);
    const ex = t.closest<HTMLElement>("[data-extra]");
    if (ex && aoExtra) {
      fecharPopup();
      aoExtra(ex.dataset.extra!);
      return;
    }
    if (t.closest("[data-aplicar]")) {
      const v = comoCor(el.querySelector<HTMLInputElement>("[data-cor-hex]")!.value);
      if (v) escolher(v);
    }
  });
  // o seletor do sistema manda a cor enquanto se mexe; "OK" (e o Enter) fecham
  const cor = el.querySelector<HTMLInputElement>("[data-cor-input]")!;
  const hex = el.querySelector<HTMLInputElement>("[data-cor-hex]")!;
  cor.addEventListener("input", () => {
    hex.value = cor.value.toUpperCase();
    aplicarViva(cor.value);
  });
  // seletor do sistema fechado: a cor entra nos "Recentes" (a prévia do arrasto não enche a lista)
  cor.addEventListener("change", () => {
    const c = comoCor(cor.value);
    if (!c) return;
    aplicarViva(c, true);
    lembrar(c);
  });
  hex.addEventListener("input", () => aplicarViva(hex.value));
  hex.addEventListener("keydown", (e) => {
    if (e.key === "Enter") el.querySelector<HTMLElement>("[data-aplicar]")!.click();
  });
  // Campos de número do bloco extra (a espessura do contorno, por exemplo): aceitam QUALQUER
  // número — Enter ou sair do campo aplica. É o valor que a pessoa escreveu, sem lista fechando
  // o caminho (o presets ao lado continuam sendo atalho).
  for (const campo of el.querySelectorAll<HTMLInputElement>("[data-extra-campo]")) {
    const aplicar = () => {
      const v = campo.value.trim();
      if (!v || !aoExtra) return;
      fecharPopup();
      aoExtra(`${campo.dataset.extraCampo}:${v}`);
    };
    campo.addEventListener("keydown", (e) => {
      if (e.key === "Enter") aplicar();
    });
    campo.addEventListener("change", aplicar);
  }
}
