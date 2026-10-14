// Fita de ferramentas da planilha, no desenho da fita do Excel: abas no alto (Página Inicial, Fórmulas,
// Exibir), grupos com o nome embaixo, botões grandes (ícone em cima, nome embaixo) e pequenos.
// Recebe o elemento pronto, escreve um template string e despacha tudo por `data-cmd`.
import { h } from "../util";
import { ligarAjusteAlturaFita, ligarRecolherFita } from "../fita";
import type { Alinhamento, FormatoNumero } from "./schema";
import { melhorarSelects } from "../seletor";

/** O que a fita precisa saber e fazer (o host implementa). */
export interface RibbonHooks {
  query: () => FormatState;
  run: (cmd: string, value?: string) => void;
  configure: () => void;
  pickImage: () => void;
}

export interface FormatState {
  temCelula: boolean;
  temSelecao: boolean;
  negrito: boolean;
  italico: boolean;
  alinhamento: Alinhamento;
  numero: FormatoNumero;
  cor: string;
  fundo: string;
  abas: number;
  zoom: number;
  temMescla: boolean;
}

const CORES = [
  "#000000", "#434343", "#6b7280", "#9ca3af", "#d9d9d9", "#ffffff",
  "#dc2626", "#f97316", "#f59e0b", "#fde047", "#22c55e", "#0ea5e9", "#4f46e5", "#a855f7",
];

const ic = (nome: string) => `<svg class="ic"><use href="#${nome}"/></svg>`;

/** Botão da fita. `big` = ícone em cima e nome embaixo; `txt` = ícone ao lado do nome. */
const btn = (cmd: string, label: string, title: string, extra = "") =>
  `<button type="button" class="xl ${extra}" data-cmd="${cmd}" title="${title}" aria-label="${title}">${label}</button>`;

const big = (cmd: string, icone: string, nome: string, title: string) =>
  btn(cmd, `${icone}<span>${nome}</span>`, title, "big");

const txt = (cmd: string, icone: string, nome: string, title: string) =>
  btn(cmd, `${icone}<span>${nome}</span>`, title, "txt");

/** Grupo da fita: conteúdo em cima, nome embaixo (como no Excel). */
const group = (label: string, body: string, cls = "") =>
  `<div class="xl-group ${cls}"><div class="xl-body">${body}</div><div class="xl-glabel">${label}</div></div>`;

const ABAS: { id: string; nome: string }[] = [
  { id: "inicio", nome: "Página Inicial" },
  { id: "formulas", nome: "Fórmulas" },
  { id: "exibir", nome: "Exibir" },
];

const NUMEROS: [FormatoNumero, string][] = [
  ["geral", "Geral"],
  ["decimal", "Número"],
  ["moeda", "Moeda"],
  ["porcento", "Porcentagem"],
  ["data", "Data"],
];

const GRAU_FX = `<span class="xl-fx">fx</span>`;
const SIGMA = `<span class="xl-sigma">Σ</span>`;

export function fita(host: HTMLElement, hooks: RibbonHooks): HTMLElement {
  const painelInicio = `
    ${group(
      "Área de Transferência",
      `
      ${big("colar", ic("i-paste"), "Colar", "Colar da área de transferência (Ctrl+V)")}
      <div class="xl-col">
        ${txt("recortar", ic("i-cut"), "Recortar", "Recortar (Ctrl+X)")}
        ${txt("copiar", ic("i-copy"), "Copiar", "Copiar (Ctrl+C)")}
      </div>`
    )}
    ${group(
      "Desfazer",
      `
      <div class="xl-col">
        ${txt("desfazer", ic("i-undo"), "Desfazer", "Desfazer (Ctrl+Z)")}
        ${txt("refazer", ic("i-redo"), "Refazer", "Refazer (Ctrl+Y)")}
      </div>`
    )}
    ${group(
      "Fonte",
      `
      <div class="xl-rows">
        <div class="xl-row">
          ${btn("negrito", "<b>N</b>", "Negrito (Ctrl+B)", "fmt")}
          ${btn("italico", "<i>I</i>", "Itálico (Ctrl+I)", "fmt")}
        </div>
        <div class="xl-row">
          ${btn("cor-fundo", `<span class="xl-a xl-balde">${ic("i-bucket")}</span><span class="xl-bar" data-bar="cor-fundo"></span>`, "Cor de preenchimento", "colorbtn")}
          ${btn("cor-texto", `<span class="xl-a">A</span><span class="xl-bar" data-bar="cor-texto"></span>`, "Cor da fonte", "colorbtn")}
        </div>
      </div>`
    )}
    ${group(
      "Alinhamento",
      `
      <div class="xl-rows">
        <div class="xl-row">
          ${btn("align-esquerda", ic("i-align-left"), "Alinhar à esquerda", "fmt")}
          ${btn("align-centro", ic("i-align-center"), "Centralizar", "fmt")}
          ${btn("align-direita", ic("i-align-right"), "Alinhar à direita", "fmt")}
        </div>
        <div class="xl-row">
          ${btn("mesclar", ic("i-table-merge") + "<span>Mesclar</span>", "Mesclar células selecionadas", "txt")}
          ${btn("desmesclar", ic("i-table-split"), "Desfazer mesclagem", "fmt")}
        </div>
      </div>`
    )}
    ${group(
      "Número",
      `
      <div class="xl-rows">
        <div class="xl-row">
          <select class="xl-select" data-numero title="Formato do número" aria-label="Formato do número">
            ${NUMEROS.map(([v, n]) => `<option value="${v}">${n}</option>`).join("")}
          </select>
        </div>
        <div class="xl-row">
          ${btn("numero:moeda", "R$", "Formato de moeda (R$)", "fmt")}
          ${btn("numero:porcento", "%", "Estilo de porcentagem", "fmt")}
          ${btn("numero:decimal", "000", "Estilo de separador de milhar", "fmt")}
          ${btn("casas-mais", `<span class="xl-casas">,0<small>→,00</small></span>`, "Aumentar casas decimais", "fmt")}
          ${btn("casas-menos", `<span class="xl-casas">,00<small>→,0</small></span>`, "Diminuir casas decimais", "fmt")}
        </div>
      </div>`
    )}
    ${group(
      "Células",
      `
      <div class="xl-col">
        ${txt("linha-inserir", ic("i-table-row-add"), "Inserir linha", "Inserir linha acima da seleção")}
        ${txt("linha-excluir", ic("i-table-row-del"), "Excluir linha", "Excluir as linhas selecionadas")}
        ${txt("ajustar-altura", `<span class="xl-seta">↕</span>`, "Ajustar altura", "Ajustar altura das linhas ao conteúdo")}
      </div>
      <div class="xl-col">
        ${txt("col-inserir", ic("i-table-col-add"), "Inserir coluna", "Inserir coluna à esquerda da seleção")}
        ${txt("col-excluir", ic("i-table-col-del"), "Excluir coluna", "Excluir as colunas selecionadas")}
        ${txt("ajustar-largura", `<span class="xl-seta">↔</span>`, "Ajustar largura", "Ajustar largura das colunas ao conteúdo")}
      </div>`
    )}
    ${group(
      "Edição",
      `
      ${big("soma", SIGMA, "AutoSoma", "AutoSoma: escreve =SOMA(...) na célula")}
      <div class="xl-col">
        ${txt("limpar", ic("i-clear-format"), "Limpar tudo", "Limpar conteúdo e formato (Delete)")}
        ${txt("limpar-formato", `<span class="xl-seta">Aa</span>`, "Limpar formatos", "Limpar só a formatação")}
      </div>`
    )}
    ${group(
      "Planilha",
      `
      ${big("aba-nova", ic("i-plus"), "Nova aba", "Nova aba")}
      <div class="xl-col">
        ${txt("aba-dup", ic("i-dup"), "Duplicar", "Duplicar aba")}
        ${txt("aba-del", ic("i-trash"), "Excluir", "Excluir aba")}
      </div>
      <div class="xl-col">
        ${txt("aba-menos", `<span class="xl-seta">◀</span>`, "Mover à esquerda", "Mover aba para a esquerda")}
        ${txt("aba-mais", `<span class="xl-seta">▶</span>`, "Mover à direita", "Mover aba para a direita")}
      </div>`
    )}`;

  const painelFormulas = `
    ${group(
      "Biblioteca de Funções",
      `
      ${big("soma", SIGMA, "AutoSoma", "Escreve =SOMA(...) na célula")}
      <div class="xl-col">
        ${txt("media", `<span class="xl-seta">x̄</span>`, "Média", "Escreve =MÉDIA(...) na célula")}
        ${txt("cont", `<span class="xl-seta">#</span>`, "Contar números", "Escreve =CONT.NÚM(...) na célula")}
      </div>
      <div class="xl-col">
        ${txt("min", `<span class="xl-seta">↓</span>`, "Mínimo", "Escreve =MÍN(...) na célula")}
        ${txt("max", `<span class="xl-seta">↑</span>`, "Máximo", "Escreve =MÁX(...) na célula")}
      </div>`
    )}
    ${group("Auditoria de Fórmulas", big("formulas", GRAU_FX, "Mostrar Fórmulas", "Mostrar o texto das fórmulas em vez dos valores"))}`;

  const painelExibir = `
    ${group(
      "Zoom",
      `
      ${big("zoom-reset", `<span class="xl-zoomval" data-zoomtxt>100%</span>`, "Zoom", "Zoom normal (100%)")}
      <div class="xl-col">
        ${txt("zoom-in", `<span class="xl-seta">+</span>`, "Ampliar", "Ampliar zoom")}
        ${txt("zoom-out", `<span class="xl-seta">−</span>`, "Reduzir", "Reduzir zoom")}
      </div>`
    )}
    ${group("Mostrar", big("formulas", GRAU_FX, "Fórmulas", "Mostrar o texto das fórmulas em vez dos valores"))}`;

  host.innerHTML = `
    <div class="xl-tabs" role="tablist">
      ${ABAS.map((a, i) => `<button type="button" class="xl-tab${i === 0 ? " on" : ""}" role="tab" data-xltab="${a.id}">${a.nome}</button>`).join("")}
      <span class="xl-tabs-fill"></span>
      <button type="button" class="xl-tab xl-tab-cfg" data-cmd="configure" title="Configurar planilha: grade, casas decimais, moeda e zoom">${ic("i-gear")}<span>Configurar</span></button>
    </div>
    <div class="xl-panels">
      <div class="xl-panel" data-xlpanel="inicio">${painelInicio}</div>
      <div class="xl-panel" data-xlpanel="formulas" hidden>${painelFormulas}</div>
      <div class="xl-panel" data-xlpanel="exibir" hidden>${painelExibir}</div>
    </div>
  `;

  // o seletor de número abre a lista do app (não a cinza do sistema)
  melhorarSelects(host);

  // os botões da fita não roubam o foco da célula em edição
  host.addEventListener("mousedown", (e) => {
    if ((e.target as HTMLElement).closest("button")) e.preventDefault();
  });

  host.addEventListener("change", (e) => {
    const sel = (e.target as HTMLElement).closest<HTMLSelectElement>("[data-numero]");
    if (sel) hooks.run("numero", sel.value);
  });

  host.addEventListener("click", (e) => {
    const t = e.target as HTMLElement;
    const aba = t.closest<HTMLElement>("[data-xltab]");
    if (aba) {
      e.preventDefault();
      for (const b of host.querySelectorAll<HTMLElement>("[data-xltab]")) b.classList.toggle("on", b === aba);
      for (const p of host.querySelectorAll<HTMLElement>("[data-xlpanel]")) p.hidden = p.dataset.xlpanel !== aba.dataset.xltab;
      return;
    }
    const barra = t.closest<HTMLElement>("[data-bar]");
    if (barra) {
      e.preventDefault();
      abrirCores(barra, hooks);
      return;
    }
    const b = t.closest<HTMLElement>("[data-cmd]");
    if (!b) return;
    e.preventDefault();
    const cmd = b.dataset.cmd!;
    // "numero:decimal" já traz o valor no comando
    if (cmd.startsWith("numero:")) hooks.run("numero", cmd.slice(7));
    else hooks.run(cmd);
  });

  // recolher a faixa: botão no canto das abas, duplo clique numa aba ou Ctrl+F1
  const tabsEl = host.querySelector<HTMLElement>(".xl-tabs");
  const panelsEl = host.querySelector<HTMLElement>(".xl-panels");
  if (tabsEl && panelsEl) ligarRecolherFita({ el: host, abas: tabsEl, paineis: panelsEl });
  // ajustar o tamanho da faixa arrastando a borda de baixo
  ligarAjusteAlturaFita({ el: host });
  // quando a fita não cabe na janela, a roda do mouse rola os grupos na horizontal
  panelsEl?.addEventListener(
    "wheel",
    (e) => {
      const p = panelsEl.querySelector<HTMLElement>(".xl-panel:not([hidden])");
      if (!p || p.scrollWidth <= p.clientWidth || Math.abs(e.deltaY) < Math.abs(e.deltaX)) return;
      e.preventDefault();
      p.scrollLeft += e.deltaY;
    },
    { passive: false }
  );

  return host;
}

/** Marca na fita o que está ligado na célula ativa (negrito, alinhamento, formato do número, zoom). */
export function marcarFita(host: HTMLElement, s: FormatState): void {
  const liga = (cmd: string, on: boolean) => {
    for (const b of host.querySelectorAll<HTMLElement>(`[data-cmd="${cmd}"]`)) b.classList.toggle("on", on);
  };
  liga("negrito", s.negrito);
  liga("italico", s.italico);
  liga("align-esquerda", s.alinhamento === "esquerda");
  liga("align-centro", s.alinhamento === "centro");
  liga("align-direita", s.alinhamento === "direita");
  liga("mesclar", s.temMescla);
  const sel = host.querySelector<HTMLSelectElement>("[data-numero]");
  if (sel && sel.value !== s.numero) sel.value = s.numero;
  for (const [k, cor] of [["cor-texto", s.cor], ["cor-fundo", s.fundo]] as const) {
    const barra = host.querySelector<HTMLElement>(`[data-bar="${k}"]`);
    if (barra) barra.style.background = cor || "";
  }
  const z = host.querySelector<HTMLElement>("[data-zoomtxt]");
  if (z) z.textContent = `${s.zoom}%`;
}

/** Paleta de cores (reaproveita o mesmo desenho do PowerPoint). */
function abrirCores(barra: HTMLElement, hooks: RibbonHooks): void {
  const existente = document.querySelector(".xl-cores");
  existente?.remove();
  const pop = h("div", { class: "modal-backdrop xl-cores-back" });
  const box = h("div", { class: "xl-cores" });
  box.innerHTML = CORES.map(
    (c) => `<button type="button" data-cor="${c}" style="background:${c}" title="${c}" aria-label="${c}"></button>`
  ).join("");
  pop.append(box);
  document.body.append(pop);

  const fechar = () => {
    document.removeEventListener("keydown", onKey, true);
    pop.remove();
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      fechar();
    }
  };
  document.addEventListener("keydown", onKey, true);
  pop.addEventListener("mousedown", (e) => {
    if (e.target === pop) fechar();
  });
  box.addEventListener("click", (e) => {
    const b = (e.target as HTMLElement).closest<HTMLElement>("[data-cor]");
    if (!b) return;
    const cmd = barra.dataset.bar === "cor-fundo" ? "cor-fundo" : "cor-texto";
    hooks.run(cmd, b.dataset.cor!);
    fechar();
  });
  void hooks.pickImage;
}
