// Fita de ferramentas da planilha, no desenho da fita do Excel: abas no alto
// (Página Inicial, Fórmulas, Exibir), grupos com o nome embaixo, botões grandes
// (ícone em cima, nome embaixo) e pequenos. Recebe o elemento pronto, escreve um
// template string e despacha tudo por `data-cmd`.
//
// Os botões de fonte usam os mesmos ícones SVG do resto do app (nada de "N" e
// "I" em texto) e as cores abrem um popover perto do botão, não um modal com
// fundo escurecido.
import { h } from "../util";
import { ligarAjusteAlturaFita, ligarEncaixeFita, ligarRecolherFita } from "../fita";
import { FONTE_PADRAO, TAMANHO_PADRAO, type Alinhamento, type FormatoNumero } from "./schema";
import { melhorarSelects } from "../seletor";

/** O que a fita precisa saber e fazer (o host implementa). */
export interface RibbonHooks {
  query: () => FormatState;
  run: (cmd: string, value?: string) => void;
  pickImage: () => void;
}

export interface FormatState {
  temCelula: boolean;
  temSelecao: boolean;
  negrito: boolean;
  italico: boolean;
  fonte: string;
  tamanho: number;
  alinhamento: Alinhamento;
  numero: FormatoNumero;
  cor: string;
  fundo: string;
  abas: number;
  zoom: number;
  temMescla: boolean;
}

/** Paleta no espírito do Excel: tema, cores padrão, cinzas e as últimas usadas. */
const CORES_TEMA = [
  "#ffffff", "#000000", "#e7e6e6", "#44546a", "#4472c4",
  "#ed7d31", "#a5a5a5", "#ffc000", "#5b9bd5", "#70ad47",
];
const CORES_PADRAO = [
  "#c00000", "#ff0000", "#ffc000", "#ffff00", "#92d050",
  "#00b050", "#00b0f0", "#0070c0", "#002060", "#7030a0",
];
const CORES_CINZA = ["#000000", "#404040", "#595959", "#7f7f7f", "#a6a6a6", "#d9d9d9", "#ffffff"];
const CHAVE_RECENTES = "mdc.excel.cores.recentes";

/** Catálogo do “Inserir função”: só o que o motor realmente calcula. */
const FUNCOES: { nome: string; categoria: string; sintaxe: string; descricao: string }[] = [
  { nome: "SOMA", categoria: "Matemática", sintaxe: "SOMA(número1; número2; …)", descricao: "Soma números ou faixas." },
  { nome: "PROD", categoria: "Matemática", sintaxe: "PROD(número1; número2; …)", descricao: "Multiplica os números." },
  { nome: "ARRED", categoria: "Matemática", sintaxe: "ARRED(número; casas)", descricao: "Arredonda para a quantidade de casas." },
  { nome: "INT", categoria: "Matemática", sintaxe: "INT(número)", descricao: "Arredonda para baixo até o inteiro." },
  { nome: "MOD", categoria: "Matemática", sintaxe: "MOD(número; divisor)", descricao: "Resto da divisão." },
  { nome: "POTÊNCIA", categoria: "Matemática", sintaxe: "POTÊNCIA(base; expoente)", descricao: "Eleva a base ao expoente." },
  { nome: "RAIZ", categoria: "Matemática", sintaxe: "RAIZ(número)", descricao: "Raiz quadrada." },
  { nome: "ABS", categoria: "Matemática", sintaxe: "ABS(número)", descricao: "Valor sem sinal." },
  { nome: "PI", categoria: "Matemática", sintaxe: "PI()", descricao: "Valor de π (3,14159…)." },
  { nome: "MÉDIA", categoria: "Estatística", sintaxe: "MÉDIA(número1; …)", descricao: "Média dos números." },
  { nome: "MÍN", categoria: "Estatística", sintaxe: "MÍN(número1; …)", descricao: "Menor número." },
  { nome: "MÁX", categoria: "Estatística", sintaxe: "MÁX(número1; …)", descricao: "Maior número." },
  { nome: "CONT.NÚM", categoria: "Estatística", sintaxe: "CONT.NÚM(valor1; …)", descricao: "Conta quantos números existem." },
  { nome: "CONT.VALORES", categoria: "Estatística", sintaxe: "CONT.VALORES(valor1; …)", descricao: "Conta células não vazias (inclusive texto)." },
  { nome: "MED", categoria: "Estatística", sintaxe: "MED(número1; …)", descricao: "Mediana dos números." },
  { nome: "DESVPAD", categoria: "Estatística", sintaxe: "DESVPAD(número1; …)", descricao: "Desvio padrão de uma amostra." },
  { nome: "DESVPADP", categoria: "Estatística", sintaxe: "DESVPADP(número1; …)", descricao: "Desvio padrão da população." },
  { nome: "SE", categoria: "Lógica", sintaxe: "SE(teste; se_verdadeiro; se_falso)", descricao: "Escolhe um resultado conforme o teste." },
  { nome: "E", categoria: "Lógica", sintaxe: "E(teste1; teste2; …)", descricao: "Verdadeiro se todos os testes forem verdadeiros." },
  { nome: "OU", categoria: "Lógica", sintaxe: "OU(teste1; teste2; …)", descricao: "Verdadeiro se algum teste for verdadeiro." },
  { nome: "NÃO", categoria: "Lógica", sintaxe: "NÃO(teste)", descricao: "Inverte verdadeiro/falso." },
  { nome: "SOMASE", categoria: "Pesquisa", sintaxe: "SOMASE(faixa; critério; faixa_soma)", descricao: "Soma as células que passam no critério." },
  { nome: "CONT.SE", categoria: "Pesquisa", sintaxe: "CONT.SE(faixa; critério)", descricao: "Conta as células que passam no critério." },
  { nome: "CONCATENAR", categoria: "Texto", sintaxe: "CONCATENAR(texto1; texto2; …)", descricao: "Junta textos e faixas." },
  { nome: "TEXTO", categoria: "Texto", sintaxe: "TEXTO(valor; formato)", descricao: "Formata um número como texto." },
  { nome: "ESQUERDA", categoria: "Texto", sintaxe: "ESQUERDA(texto; caracteres)", descricao: "Primeiros caracteres do texto." },
  { nome: "DIREITA", categoria: "Texto", sintaxe: "DIREITA(texto; caracteres)", descricao: "Últimos caracteres do texto." },
  { nome: "EXT.TEXTO", categoria: "Texto", sintaxe: "EXT.TEXTO(texto; início; caracteres)", descricao: "Trecho do meio do texto." },
  { nome: "NÚM.CARACT", categoria: "Texto", sintaxe: "NÚM.CARACT(texto)", descricao: "Quantidade de caracteres." },
  { nome: "MAIÚSCULA", categoria: "Texto", sintaxe: "MAIÚSCULA(texto)", descricao: "Texto em maiúsculas." },
  { nome: "MINÚSCULA", categoria: "Texto", sintaxe: "MINÚSCULA(texto)", descricao: "Texto em minúsculas." },
  { nome: "ESPAÇOS", categoria: "Texto", sintaxe: "ESPAÇOS(texto)", descricao: "Remove espaços extras." },
  { nome: "HOJE", categoria: "Data/hora", sintaxe: "HOJE()", descricao: "Data de hoje (serial do Excel)." },
  { nome: "AGORA", categoria: "Data/hora", sintaxe: "AGORA()", descricao: "Data e hora atuais." },
];

function lerRecentes(): string[] {
  try {
    const cru = JSON.parse(localStorage.getItem(CHAVE_RECENTES) ?? "[]");
    return Array.isArray(cru) ? cru.filter((c) => typeof c === "string" && /^#[0-9a-f]{6}$/i.test(c)).slice(0, 10) : [];
  } catch {
    return [];
  }
}

function lembrarCor(cor: string): void {
  if (!/^#[0-9a-f]{6}$/i.test(cor)) return;
  try {
    const lista = [cor, ...lerRecentes().filter((c) => c.toLowerCase() !== cor.toLowerCase())].slice(0, 10);
    localStorage.setItem(CHAVE_RECENTES, JSON.stringify(lista));
  } catch {
    /* sem armazenamento: a paleta ainda funciona nesta sessão */
  }
}

const ic = (nome: string) => `<svg class="ic"><use href="#${nome}"/></svg>`;

/** Botão da fita. `extra` assume `fmt`, `txt`, `big`, `colorbtn`… */
const btn = (cmd: string, label: string, title: string, extra = "") =>
  `<button type="button" class="xl ${extra}" data-cmd="${cmd}" title="${title}" aria-label="${title}" aria-pressed="false">${label}</button>`;

const big = (cmd: string, icone: string, nome: string, title: string) =>
  btn(cmd, `${icone}<span>${nome}</span>`, title, "big");

const txt = (cmd: string, icone: string, nome: string, title: string) =>
  btn(cmd, `${icone}<span>${nome}</span>`, title, "txt");

/** Grupo da fita: conteúdo em cima, nome embaixo (como no Excel). */
const group = (label: string, body: string, cls = "") =>
  `<div class="xl-group ${cls}"><div class="xl-body">${body}</div><div class="xl-glabel">${label}</div></div>`;

/**
 * Botão dividido de cor: a parte esquerda aplica a última cor usada; a seta
 * abre a paleta. A barrinha embaixo mostra a cor atual (como no Excel).
 */
const corBtn = (cmd: string, icone: string, titulo: string, padrao: string) =>
  `<span class="xl-cor" data-corgrupo="${cmd}">
    <button type="button" class="xl xl-cor-main" data-cmd="${cmd}" title="${titulo}" aria-label="${titulo}">${icone}</button>
    <button type="button" class="xl xl-cor-seta" data-paleta="${cmd}" title="${titulo}: escolher cor" aria-label="Escolher ${titulo.toLowerCase()}">${ic("i-caret-down")}</button>
    <span class="xl-bar" data-bar="${cmd}" data-cor="${padrao}"></span>
  </span>`;

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

/** Fontes comuns em documentos brasileiros (a lista é só uma sugestão; o .xlsx guarda o nome). */
const FONTES = [
  "Calibri",
  "Aptos",
  "Arial",
  "Cambria",
  "Consolas",
  "Courier New",
  "Garamond",
  "Georgia",
  "Segoe UI",
  "Tahoma",
  "Times New Roman",
  "Trebuchet MS",
  "Verdana",
];

/** Tamanhos em pontos, do menor ao maior (o Excel usa 8–72 no menu). */
const TAMANHOS = [8, 9, 10, 11, 12, 14, 16, 18, 20, 24, 28, 32, 36, 48, 72];

const GRAU_FX = `<span class="xl-fx">fx</span>`;

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
        <div class="xl-row xl-fontes">
          <select class="xl-select xl-fonte" data-fonte title="Fonte" aria-label="Fonte">
            ${FONTES.map((f) => `<option value="${f}">${f}</option>`).join("")}
          </select>
          <select class="xl-select xl-tamanho" data-tamanho title="Tamanho da fonte" aria-label="Tamanho da fonte">
            ${TAMANHOS.map((t) => `<option value="${t}">${t}</option>`).join("")}
          </select>
          ${btn("negrito", ic("i-bold"), "Negrito (Ctrl+B)", "fmt")}
          ${btn("italico", ic("i-italic"), "Itálico (Ctrl+I)", "fmt")}
        </div>
        <div class="xl-row">
          ${corBtn("cor-texto", ic("i-font-color"), "Cor da fonte", "#c00000")}
          ${corBtn("cor-fundo", ic("i-fill-color"), "Cor de preenchimento", "#ffff00")}
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
          ${btn("align-justificado", ic("i-align-justify"), "Justificar", "fmt")}
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
          ${btn("numero:moeda", `<span class="xl-letra">R$</span>`, "Formato de moeda (R$)", "fmt")}
          ${btn("numero:porcento", `<span class="xl-letra">%</span>`, "Estilo de porcentagem", "fmt")}
          ${btn("numero:decimal", `<span class="xl-letra">,00</span>`, "Estilo de número com duas casas", "fmt")}
          ${btn("casas-mais", ic("i-decimals-add"), "Aumentar casas decimais", "fmt")}
          ${btn("casas-menos", ic("i-decimals-remove"), "Diminuir casas decimais", "fmt")}
        </div>
      </div>`
    )}
    ${group(
      "Células",
      `
      <div class="xl-col">
        ${txt("linha-inserir", ic("i-table-row-add"), "Inserir linha", "Inserir linha acima da seleção")}
        ${txt("linha-excluir", ic("i-table-row-del"), "Excluir linha", "Excluir as linhas selecionadas")}
        ${txt("ajustar-altura", ic("i-row-height"), "Ajustar altura", "Ajustar altura das linhas ao conteúdo")}
      </div>
      <div class="xl-col">
        ${txt("col-inserir", ic("i-table-col-add"), "Inserir coluna", "Inserir coluna à esquerda da seleção")}
        ${txt("col-excluir", ic("i-table-col-del"), "Excluir coluna", "Excluir as colunas selecionadas")}
        ${txt("ajustar-largura", ic("i-col-width"), "Ajustar largura", "Ajustar largura das colunas ao conteúdo")}
      </div>`
    )}
    ${group(
      "Tabelas",
      `
      ${big("tabela", ic("i-grid"), "Tabela", "Aplicar um estilo de tabela à seleção (cabeçalho e linhas alternadas)")}`
    )}
    ${group(
      "Edição",
      `
      ${big("soma", ic("i-sigma"), "AutoSoma", "AutoSoma: escreve =SOMA(...) na célula")}
      <div class="xl-col">
        ${txt("limpar", ic("i-clear-format"), "Limpar tudo", "Limpar conteúdo e formato (Delete)")}
        ${txt("limpar-formato", `<span class="xl-letra xl-letra-forte">Aa</span>`, "Limpar formatos", "Limpar só a formatação")}
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
        ${txt("aba-menos", ic("i-back"), "Mover à esquerda", "Mover aba para a esquerda")}
        ${txt("aba-mais", ic("i-chevron-r"), "Mover à direita", "Mover aba para a direita")}
      </div>`
    )}`;

  const painelFormulas = `
    ${group(
      "Biblioteca de Funções",
      `
      ${big("soma", ic("i-sigma"), "AutoSoma", "Escreve =SOMA(...) na célula")}
      ${big("funcao", ic("i-function"), "Inserir função", "Escolher uma função e começar a digitar os argumentos")}
      <div class="xl-col">
        ${txt("media", ic("i-average"), "Média", "Escreve =MÉDIA(...) na célula")}
        ${txt("cont", ic("i-hash"), "Contar números", "Escreve =CONT.NÚM(...) na célula")}
      </div>
      <div class="xl-col">
        ${txt("min", ic("i-arrow-down"), "Mínimo", "Escreve =MÍN(...) na célula")}
        ${txt("max", ic("i-arrow-up"), "Máximo", "Escreve =MÁX(...) na célula")}
      </div>`
    )}
    ${group("Auditoria de Fórmulas", big("formulas", GRAU_FX, "Mostrar Fórmulas", "Mostrar o texto das fórmulas em vez dos valores"))}`;

  const painelExibir = `
    ${group(
      "Zoom",
      `
      ${big("zoom-reset", `<span class="xl-zoomval" data-zoomtxt>100%</span>`, "Zoom", "Zoom normal (100%)")}
      <div class="xl-col">
        ${txt("zoom-in", ic("i-plus"), "Ampliar", "Ampliar zoom")}
        ${txt("zoom-out", ic("i-minus"), "Reduzir", "Reduzir zoom")}
      </div>`
    )}
    ${group("Mostrar", big("formulas", GRAU_FX, "Fórmulas", "Mostrar o texto das fórmulas em vez dos valores"))}`;

  host.innerHTML = `
    <div class="xl-tabs" role="tablist">
      ${ABAS.map((a, i) => `<button type="button" class="xl-tab${i === 0 ? " on" : ""}" role="tab" data-xltab="${a.id}">${a.nome}</button>`).join("")}
      <span class="xl-tabs-fill"></span>
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
    const alvo = e.target as HTMLElement;
    if (alvo.closest("button")) e.preventDefault();
  });

  host.addEventListener("change", (e) => {
    const alvo = e.target as HTMLElement;
    const numero = alvo.closest<HTMLSelectElement>("[data-numero]");
    if (numero) {
      hooks.run("numero", numero.value);
      return;
    }
    const fonte = alvo.closest<HTMLSelectElement>("[data-fonte]");
    if (fonte) {
      hooks.run("fonte", fonte.value);
      return;
    }
    const tamanho = alvo.closest<HTMLSelectElement>("[data-tamanho]");
    if (tamanho) hooks.run("tamanho", tamanho.value);
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

    const paleta = t.closest<HTMLElement>("[data-paleta]");
    if (paleta) {
      e.preventDefault();
      abrirCores(paleta, hooks);
      return;
    }

    const b = t.closest<HTMLElement>("[data-cmd]");
    if (!b) return;
    e.preventDefault();
    const cmd = b.dataset.cmd!;
    // "numero:decimal" já traz o valor no comando
    if (cmd.startsWith("numero:")) {
      hooks.run("numero", cmd.slice(7));
      return;
    }
    // a parte principal do botão de cor aplica a última cor escolhida
    if (cmd === "cor-texto" || cmd === "cor-fundo") {
      const barra = host.querySelector<HTMLElement>(`[data-bar="${cmd}"]`);
      hooks.run(cmd, barra?.dataset.cor || (cmd === "cor-texto" ? "#c00000" : "#ffff00"));
      return;
    }
    if (cmd === "funcao") {
      abrirFuncoes(b, hooks);
      return;
    }
    if (cmd === "tabela") {
      abrirTabelas(b, hooks);
      return;
    }
    hooks.run(cmd);
  });

  // recolher a faixa: botão no canto das abas, duplo clique numa aba ou Ctrl+F1
  const tabsEl = host.querySelector<HTMLElement>(".xl-tabs");
  const panelsEl = host.querySelector<HTMLElement>(".xl-panels");
  if (tabsEl && panelsEl) ligarRecolherFita({ el: host, abas: tabsEl, paineis: panelsEl });
  // ajustar a altura arrastando a borda de baixo (com o teto de um terço da janela)
  ligarAjusteAlturaFita({ el: host, modo: "metricas" });
  // os quatro degraus da largura: o grupo que não couber vira botão com menu (nada de rolagem)
  ligarEncaixeFita({ el: host, painel: ".xl-panel", grupo: ".xl-group", corpo: ".xl-body", rotulo: ".xl-glabel" });

  return host;
}

/** Marca na fita o que está ligado na célula ativa (negrito, alinhamento, formato do número, zoom). */
export function marcarFita(host: HTMLElement, s: FormatState): void {
  const liga = (cmd: string, on: boolean) => {
    for (const b of host.querySelectorAll<HTMLElement>(`[data-cmd="${cmd}"]`)) {
      b.classList.toggle("on", on);
      b.setAttribute("aria-pressed", on ? "true" : "false");
    }
  };
  liga("negrito", s.negrito);
  liga("italico", s.italico);
  liga("align-esquerda", s.alinhamento === "esquerda");
  liga("align-centro", s.alinhamento === "centro");
  liga("align-direita", s.alinhamento === "direita");
  liga("align-justificado", s.alinhamento === "justificado");
  liga("mesclar", s.temMescla);
  const sel = host.querySelector<HTMLSelectElement>("[data-numero]");
  if (sel && sel.value !== s.numero) sel.value = s.numero;
  const garantirOpcao = (select: HTMLSelectElement, valor: string): void => {
    if (![...select.options].some((o) => o.value === valor)) {
      const opt = document.createElement("option");
      opt.value = valor;
      opt.textContent = valor;
      select.append(opt);
    }
  };
  const fonteSel = host.querySelector<HTMLSelectElement>("[data-fonte]");
  if (fonteSel) {
    const fonte = s.fonte || FONTE_PADRAO;
    garantirOpcao(fonteSel, fonte);
    if (fonteSel.value !== fonte) fonteSel.value = fonte;
  }
  const tamanhoSel = host.querySelector<HTMLSelectElement>("[data-tamanho]");
  if (tamanhoSel) {
    const tamanho = String(s.tamanho || TAMANHO_PADRAO);
    garantirOpcao(tamanhoSel, tamanho);
    if (tamanhoSel.value !== tamanho) tamanhoSel.value = tamanho;
  }
  for (const [k, cor, padrao] of [
    ["cor-texto", s.cor, "#c00000"],
    ["cor-fundo", s.fundo, "#ffff00"],
  ] as const) {
    const barra = host.querySelector<HTMLElement>(`[data-bar="${k}"]`);
    if (barra) {
      if (cor) barra.dataset.cor = cor;
      barra.style.background = cor || barra.dataset.cor || padrao;
    }
  }
  const z = host.querySelector<HTMLElement>("[data-zoomtxt]");
  if (z) z.textContent = `${s.zoom}%`;
}

/** Popover de cores ancorado no botão (sem fundo de modal). */
function abrirCores(ancora: HTMLElement, hooks: RibbonHooks): void {
  document.querySelectorAll(".xl-cores").forEach((el) => el.remove());
  const cmd = ancora.dataset.paleta === "cor-fundo" ? "cor-fundo" : "cor-texto";
  const grupo = ancora.closest<HTMLElement>(".xl-cor");
  const barra = grupo?.querySelector<HTMLElement>(`[data-bar="${cmd}"]`) ?? null;
  const atual = (barra?.dataset.cor || "").toLowerCase();
  const recentes = lerRecentes();

  const opcao = (cor: string) =>
    `<button type="button" class="xl-cor-op${cor.toLowerCase() === atual ? " atual" : ""}" data-cor="${cor}" style="--cor:${cor}" title="${cor}" aria-label="${cor}"></button>`;
  const secao = (titulo: string, corpo: string) =>
    `<div class="xl-cores-secao"><div class="xl-cores-titulo">${titulo}</div>${corpo}</div>`;

  const pop = h("div", { class: "xl-cores", role: "dialog", "aria-label": "Escolher cor" });
  pop.innerHTML = `
    <div class="xl-cores-topo">
      <span>${cmd === "cor-fundo" ? "Cor de preenchimento" : "Cor da fonte"}</span>
      <button type="button" class="xl-cores-x" data-fechar title="Fechar">${ic("i-close")}</button>
    </div>
    <div class="xl-cores-corpo">
      ${secao(
        "Usadas recentemente",
        recentes.length
          ? `<div class="xl-cores-grade">${recentes.map(opcao).join("")}</div>`
          : `<div class="xl-cores-dica">As cores que você usar aparecem aqui.</div>`
      )}
      ${secao("Cores do tema", `<div class="xl-cores-grade">${CORES_TEMA.map(opcao).join("")}</div>`)}
      ${secao("Cores padrão", `<div class="xl-cores-grade">${CORES_PADRAO.map(opcao).join("")}</div>`)}
      ${secao("Cinzas", `<div class="xl-cores-grade xl-cores-grade-cinza">${CORES_CINZA.map(opcao).join("")}</div>`)}
    </div>
    <div class="xl-cores-rodape">
      <button type="button" class="xl-cores-auto" data-cor="">${cmd === "cor-fundo" ? "Sem preenchimento" : "Automática"}</button>
      <label class="xl-cores-livre" title="Escolher uma cor personalizada">
        <input type="color" value="${barra?.dataset.cor || "#000000"}" data-corlivre />
        <span>Mais cores…</span>
      </label>
    </div>`;
  document.body.append(pop);

  // posiciona perto do botão, sem sair da janela
  const r = ancora.getBoundingClientRect();
  const larg = 312;
  const altura = 430;
  const esq = Math.max(8, Math.min(r.left - larg + r.width, window.innerWidth - larg - 8));
  const topo = Math.min(r.bottom + 6, window.innerHeight - altura);
  pop.style.left = `${esq}px`;
  pop.style.top = `${Math.max(8, topo)}px`;

  const fechar = () => {
    document.removeEventListener("mousedown", fora, true);
    document.removeEventListener("keydown", tecla, true);
    window.removeEventListener("resize", fechar);
    window.removeEventListener("scroll", fechar, true);
    pop.remove();
  };
  const fora = (ev: MouseEvent) => {
    if (!pop.contains(ev.target as Node) && !ancora.contains(ev.target as Node)) fechar();
  };
  const tecla = (ev: KeyboardEvent) => {
    if (ev.key === "Escape") {
      ev.preventDefault();
      ev.stopPropagation();
      fechar();
    }
  };
  document.addEventListener("mousedown", fora, true);
  document.addEventListener("keydown", tecla, true);
  window.addEventListener("resize", fechar);
  window.addEventListener("scroll", fechar, true);

  const aplicar = (cor: string) => {
    if (barra) {
      barra.dataset.cor = cor;
      barra.style.background = cor || (cmd === "cor-fundo" ? "#ffff00" : "#c00000");
    }
    if (cor) lembrarCor(cor);
    hooks.run(cmd, cor);
    fechar();
  };

  pop.querySelector("[data-fechar]")?.addEventListener("click", fechar);
  pop.querySelectorAll<HTMLElement>("[data-cor]").forEach((b) => {
    b.addEventListener("click", () => aplicar(b.dataset.cor ?? ""));
  });
  const livre = pop.querySelector<HTMLInputElement>("[data-corlivre]");
  livre?.addEventListener("input", () => {
    if (!barra) return;
    barra.dataset.cor = livre.value;
    barra.style.background = livre.value;
  });
  livre?.addEventListener("change", () => aplicar(livre.value));
  void hooks.pickImage;
}

/** Base dos popovers da fita: posiciona perto do botão e fecha no fora/Esc/rolagem. */
function abrirPopover(
  ancora: HTMLElement,
  classe: string,
  rotulo: string,
  html: string,
  largura: number,
  altura: number
): { pop: HTMLElement; fechar: () => void } {
  document.querySelectorAll(`.${classe}`).forEach((el) => el.remove());
  const pop = h("div", { class: classe, role: "dialog", "aria-label": rotulo });
  pop.innerHTML = html;
  document.body.append(pop);

  const r = ancora.getBoundingClientRect();
  const esq = Math.max(8, Math.min(r.left - largura + r.width, window.innerWidth - largura - 8));
  const topo = Math.min(r.bottom + 6, window.innerHeight - altura);
  pop.style.left = `${esq}px`;
  pop.style.top = `${Math.max(8, topo)}px`;

  function fechar(): void {
    document.removeEventListener("mousedown", fora, true);
    document.removeEventListener("keydown", tecla, true);
    window.removeEventListener("resize", fechar);
    window.removeEventListener("scroll", fechar, true);
    pop.remove();
  }
  function fora(ev: MouseEvent): void {
    if (!pop.contains(ev.target as Node) && !ancora.contains(ev.target as Node)) fechar();
  }
  function tecla(ev: KeyboardEvent): void {
    if (ev.key === "Escape") {
      ev.preventDefault();
      ev.stopPropagation();
      fechar();
    }
  }
  document.addEventListener("mousedown", fora, true);
  document.addEventListener("keydown", tecla, true);
  window.addEventListener("resize", fechar);
  window.addEventListener("scroll", fechar, true);
  pop.querySelector("[data-fechar]")?.addEventListener("click", fechar);
  return { pop, fechar };
}

/** Fórmulas que o motor calcula, com busca — clicar começa `=FUNÇÃO(` na célula ativa. */
function abrirFuncoes(ancora: HTMLElement, hooks: RibbonHooks): void {
  const semAcento = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const itens = FUNCOES.map(
    (f) => `<button type="button" class="xl-funcao" data-funcao="${f.nome}" data-busca="${semAcento(
      `${f.nome} ${f.categoria} ${f.sintaxe} ${f.descricao}`
    )}">
      <span class="xl-funcao-nome">${f.nome}</span>
      <span class="xl-funcao-cat">${f.categoria}</span>
      <span class="xl-funcao-sin">${f.sintaxe}</span>
      <span class="xl-funcao-desc">${f.descricao}</span>
    </button>`
  ).join("");

  const { pop, fechar } = abrirPopover(
    ancora,
    "xl-funcoes",
    "Inserir função",
    `<div class="xl-pop-topo"><span>Inserir função</span><button type="button" class="xl-cores-x" data-fechar title="Fechar">${ic("i-close")}</button></div>
     <input class="xl-funcoes-busca" type="search" placeholder="Buscar função (ex.: soma, se, texto…)" aria-label="Buscar função" />
     <div class="xl-funcoes-lista">${itens || `<div class="xl-funcoes-vazio">Nenhuma função encontrada.</div>`}</div>`,
    380,
    450
  );

  const busca = pop.querySelector<HTMLInputElement>(".xl-funcoes-busca");
  const lista = pop.querySelector<HTMLElement>(".xl-funcoes-lista");
  busca?.focus();
  busca?.addEventListener("input", () => {
    const q = semAcento(busca.value.trim());
    let achou = 0;
    for (const b of lista?.querySelectorAll<HTMLElement>("[data-funcao]") ?? []) {
      const visivel = !q || (b.dataset.busca ?? "").includes(q);
      b.hidden = !visivel;
      if (visivel) achou++;
    }
    let vazio = lista?.querySelector<HTMLElement>(".xl-funcoes-vazio");
    if (!achou && lista && !vazio) {
      vazio = h("div", { class: "xl-funcoes-vazio", text: "Nenhuma função encontrada." });
      lista.append(vazio);
    } else if (achou && vazio) {
      vazio.remove();
    }
  });
  pop.querySelectorAll<HTMLElement>("[data-funcao]").forEach((b) => {
    b.addEventListener("click", () => {
      hooks.run("funcao", b.dataset.funcao ?? "");
      fechar();
    });
  });
}

/** Estilos de tabela reais (cabeçalho + linhas alternadas) aplicados à seleção. */
function abrirTabelas(ancora: HTMLElement, hooks: RibbonHooks): void {
  const card = (id: string, nome: string, cab: string, alt: string) =>
    `<button type="button" class="xl-tabela-card" data-tabela="${id}">
      <span class="xl-tabela-mini" style="--cab:${cab};--alt:${alt}">
        <span class="xl-tabela-mini-cab"></span><span></span><span class="alt"></span><span></span>
      </span>
      <span>${nome}</span>
    </button>`;
  const { pop, fechar } = abrirPopover(
    ancora,
    "xl-tabelas",
    "Estilo de tabela",
    `<div class="xl-pop-topo"><span>Estilo de tabela</span><button type="button" class="xl-cores-x" data-fechar title="Fechar">${ic("i-close")}</button></div>
     <p class="xl-tabelas-dica">Aplica na seleção: cabeçalho em destaque e linhas alternadas.</p>
     <div class="xl-tabelas-grade">
       ${card("azul", "Azul", "#1f4e78", "#ddebf7")}
       ${card("verde", "Verde", "#375623", "#e2efda")}
       ${card("cinza", "Cinza", "#404040", "#f2f2f2")}
     </div>`,
    286,
    300
  );
  pop.querySelectorAll<HTMLElement>("[data-tabela]").forEach((b) => {
    b.addEventListener("click", () => {
      hooks.run("tabela", b.dataset.tabela ?? "");
      fechar();
    });
  });
}
