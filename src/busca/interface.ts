// A barra de busca de funções.
//
// Fica na barra de cima (o que era a paleta de comandos, com Ctrl+K) e **não** é
// um modal: enquanto ela está aberta o app continua com a cor normal, sem
// escurecimento, e a pessoa pode rolar o documento e olhar a fita. O clique
// fora fecha a busca.
//
// O que aparece na lista vem de dois lugares: o catálogo do app (`commands.ts`)
// e a fita do documento aberto, coletada do próprio DOM (`coleta.ts`) — por isso
// todo botão da tela aparece aqui, com o ícone dele.

import { h } from "../util";
import { coletarComandos, type TrocarPara } from "./coleta";
import { montarResultado, norm } from "./filtro";
import { MODULOS, moduloAtivo, type Comando } from "./tipos";

export interface HooksBusca {
  /** devolve o foco ao documento quando a busca fecha */
  aoFechar?: () => void;
}

let catalogo: Comando[] = [];
let provedor: (() => Comando[]) | null = null;
let trocarPara: TrocarPara | undefined;
let hooks: HooksBusca = {};
let aberto = false;
let indice = 0;
let mostrandoTodos = false;
/** a lista que está na tela, na mesma ordem dos itens no painel */
let visiveis: Comando[] = [];

const raiz = (): HTMLElement | null => document.getElementById("busca");
const campo = (): HTMLInputElement | null => document.getElementById("busca-input") as HTMLInputElement | null;
const painel = (): HTMLElement | null => document.getElementById("busca-painel");

/**
 * Junta o catálogo do app com a fita do documento.
 *
 * A fita vem **primeiro**: as funções do documento à vista são o que a pessoa
 * está procurando. O mesmo comando pode aparecer nos dois (o botão "Salvar" da
 * barra e o item "Salvar" do catálogo): o da fita fica, mas ganha as palavras
 * do catálogo.
 */
function mesclar(base: Comando[], coletados: Comando[]): Comando[] {
  const mapa = new Map<string, Comando>();
  const ordem: string[] = [];
  const guardar = (c: Comando) => {
    const chave = norm(c.label);
    const ja = mapa.get(chave);
    if (!ja) {
      mapa.set(chave, { ...c });
      ordem.push(chave);
      return;
    }
    if (!ja.palavras && c.palavras) ja.palavras = c.palavras;
    if (!ja.atalho && c.atalho) ja.atalho = c.atalho;
    if (!ja.icone && !ja.glifo && !ja.iconeHtml) {
      if (c.icone) ja.icone = c.icone;
      else if (c.glifo) ja.glifo = c.glifo;
      else if (c.iconeHtml) ja.iconeHtml = c.iconeHtml;
    }
  };
  for (const c of coletados) guardar(c);
  for (const c of base) guardar(c);
  return ordem.map((k) => mapa.get(k)!);
}

/** Um item da lista: o ícone do botão, o rótulo e a etiqueta do módulo. */
function item(c: Comando, i: number, modulo: ReturnType<typeof moduloAtivo>): HTMLElement {
  const b = h("button", {
    class: `busca-item${i === indice ? " ativo" : ""}`,
    type: "button",
    role: "option",
    "aria-selected": i === indice ? "true" : "false",
  });
  if (c.indisponivel) b.classList.add("indisponivel");

  const icone = h("span", { class: "bi-icone" });
  if (c.icone) icone.innerHTML = `<svg class="ic"><use href="#${c.icone}"/></svg>`;
  else if (c.iconeHtml) icone.innerHTML = c.iconeHtml;
  else if (c.glifo) icone.textContent = c.glifo;
  else icone.classList.add("vazio");
  b.append(icone);

  b.append(h("span", { class: "bi-label", text: c.label }));

  // a etiqueta do módulo só aparece quando o comando é de OUTRO módulo: o do
  // módulo aberto já está no cabeçalho do painel
  const mod = c.modulos?.[0];
  if (mod && mod !== modulo) {
    const etiqueta = h("span", { class: "bi-modulo", text: MODULOS[mod].curto });
    etiqueta.dataset.mod = mod;
    b.append(etiqueta);
  }
  if (c.atalho) b.append(h("span", { class: "bi-atalho", text: c.atalho }));

  b.addEventListener("mousemove", () => moverPara(i));
  // o clique no item não tira o foco do campo (a digitação continua)
  b.addEventListener("mousedown", (e) => {
    e.preventDefault();
    executar(i);
  });
  return b;
}

/** Desenha a lista do jeito que está agora. */
function pintar(): void {
  const p = painel();
  const inp = campo();
  if (!p || !inp) return;

  const termos = norm(inp.value).split(/\s+/).filter(Boolean);
  const modulo = moduloAtivo();
  const resultado = montarResultado(
    mesclar(catalogo, coletarComandos(trocarPara)),
    termos,
    modulo,
    mostrandoTodos
  );

  p.textContent = "";
  visiveis = [];

  // cabeçalho: de qual documento a lista é
  const topo = h("div", { class: "bp-topo" });
  topo.append(h("span", { class: "bp-contexto", text: modulo ? MODULOS[modulo].nome : "Todas as funções" }));
  const total = resultado.grupos.reduce((n, g) => n + g.comandos.length, 0);
  topo.append(h("span", { class: "bp-contagem", text: `${total} ${total === 1 ? "função" : "funções"}` }));
  p.append(topo);

  // a lista
  const lista = h("div", { class: "bp-lista", role: "listbox" });
  for (const g of resultado.grupos) {
    lista.append(h("div", { class: "bp-grupo", text: g.titulo }));
    for (const c of g.comandos) {
      lista.append(item(c, visiveis.length, modulo));
      visiveis.push(c);
    }
  }
  if (!visiveis.length) {
    lista.append(
      h("div", {
        class: "bp-vazio",
        text: termos.length ? "Nada encontrado com esse nome." : "Nenhuma função por aqui.",
      })
    );
  }
  p.append(lista);

  // rodapé: as teclas e o alternador de módulos
  const rodape = h("div", { class: "busca-rodape" });
  rodape.append(h("span", { class: "br-dicas", text: "↑↓ mover · Enter executar · Esc fechar" }));
  const todos = h("button", {
    class: `br-todos${mostrandoTodos ? " on" : ""}`,
    type: "button",
    text: "Ver todos os módulos",
  });
  todos.addEventListener("mousedown", (e) => {
    e.preventDefault();
    mostrandoTodos = !mostrandoTodos;
    pintar();
  });
  rodape.append(todos);
  p.append(rodape);

  if (indice >= visiveis.length) indice = Math.max(0, visiveis.length - 1);
  marcarAtivo();
}

/** Marca o item escolhido (sem redesenhar a lista toda). */
function marcarAtivo(): void {
  const p = painel();
  if (!p) return;
  const itens = p.querySelectorAll<HTMLElement>(".busca-item");
  itens.forEach((e, k) => {
    e.classList.toggle("ativo", k === indice);
    e.setAttribute("aria-selected", k === indice ? "true" : "false");
  });
  itens[indice]?.scrollIntoView({ block: "nearest" });
}

function moverPara(i: number): void {
  if (i === indice) return;
  indice = i;
  marcarAtivo();
}

/** Executa o comando escolhido e fecha a busca. */
function executar(i: number): void {
  const c = visiveis[i];
  if (!c) return;
  fecharBusca();
  window.setTimeout(() => c.run(), 0);
}

/**
 * O app diz onde estão os comandos.
 *
 * A lista é montada **na hora de abrir** (as abas, os recentes e o estado do
 * salvamento automático mudam o tempo todo), e não fica guardada.
 */
export function configurarBusca(opts: {
  comandos: () => Comando[];
  /** troca para a aba de um módulo (quando o comando vem da fita de outro) */
  trocarPara?: TrocarPara;
  aoFechar?: () => void;
}): void {
  provedor = opts.comandos;
  trocarPara = opts.trocarPara;
  hooks = { aoFechar: opts.aoFechar };
}

function abrir(): void {
  const r = raiz();
  const inp = campo();
  if (!r || !inp) return;
  // no modo foco a barra de cima nem existe: não abre uma busca invisível
  if (!r.offsetParent) return;
  aberto = true;
  r.classList.add("aberta");
  inp.placeholder = "Buscar comando ou função…";
  painel()?.removeAttribute("hidden");
  indice = 0;
  // cada busca começa pelo módulo do documento à vista (o "ver todos" é escolha
  // de quem está usando, não uma preferência que fica)
  mostrandoTodos = false;
  if (provedor) catalogo = provedor();
  pintar();
  inp.focus();
  inp.select();
}

/** Fecha a busca e devolve o foco para o documento. */
export function fecharBusca(): void {
  if (!aberto) return;
  aberto = false;
  const r = raiz();
  r?.classList.remove("aberta");
  const inp = campo();
  if (inp) {
    inp.value = "";
    inp.placeholder = "Buscar…";
    // o campo solta o foco: senão o próximo clique nele não abriria a busca
    // (o foco não "volta" para um elemento que já estava com ela)
    if (document.activeElement === inp) inp.blur();
  }
  painel()?.setAttribute("hidden", "");
  indice = 0;
  visiveis = [];
  hooks.aoFechar?.();
}

/** Abre a busca (ou foca o campo, se ela já estiver aberta). */
export function focarBusca(): void {
  const inp = campo();
  if (!inp) return;
  if (!aberto) {
    abrir();
    return;
  }
  inp.focus();
  inp.select();
}

/** Redesenha a lista (a aba do documento mudou: o contexto da busca mudou). */
export function atualizarBusca(): void {
  if (!aberto) return;
  if (provedor) catalogo = provedor();
  pintar();
}

// --------------------------------------------------------------- as escutas

function onTecla(e: KeyboardEvent): void {
  if (!aberto) return;
  if (e.key === "Escape") {
    e.preventDefault();
    e.stopPropagation();
    fecharBusca();
    return;
  }
  if (e.key === "ArrowDown" || e.key === "ArrowUp") {
    e.preventDefault();
    e.stopPropagation();
    if (visiveis.length) {
      indice = (indice + (e.key === "ArrowDown" ? 1 : -1) + visiveis.length) % visiveis.length;
      marcarAtivo();
    }
    return;
  }
  if (e.key === "Enter") {
    e.preventDefault();
    e.stopPropagation();
    executar(indice);
    return;
  }
  // Ctrl/Cmd com outra tecla: a busca segura o atalho (o app não deve salvar o
  // documento nem aplicar negrito enquanto a pessoa digita). Ctrl+1…9 e Ctrl+K
  // passam — trocar de aba com a busca aberta é de lei.
  if (e.ctrlKey || e.metaKey) {
    const k = e.key.toLowerCase();
    if (!/^[1-9]$/.test(e.key) && k !== "k") e.preventDefault();
  }
}

function onMouseDown(e: MouseEvent): void {
  if (!aberto) return;
  const alvo = e.target as Node | null;
  if (alvo && raiz()?.contains(alvo)) return;
  fecharBusca();
}

let ligado = false;

function ligar(): void {
  if (ligado) return;
  ligado = true;
  document.addEventListener("keydown", onTecla, true);
  document.addEventListener("mousedown", onMouseDown, true);
  const inp = campo();
  inp?.addEventListener("focus", () => {
    if (!aberto) abrir();
  });
  inp?.addEventListener("input", () => {
    indice = 0;
    pintar();
  });
  // clicar na pílula (no ícone ou na borda) abre a busca; o campo em si cuida
  // do cursor do texto
  raiz()?.addEventListener("mousedown", (e) => {
    const alvo = e.target as HTMLElement;
    if (alvo.closest("#busca-painel")) return;
    if (alvo === inp) return;
    e.preventDefault();
    focarBusca();
  });
}

// as escutas valem desde o começo: o campo da barra de cima precisa abrir a
// busca já no primeiro clique
ligar();
