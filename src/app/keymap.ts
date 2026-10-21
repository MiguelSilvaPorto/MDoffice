// Atalhos de teclado do app — a lista daqui é a fonte única.
//
// Antes cada atalho era um `if` no `keys.ts`, e a aba Atalhos só sabia MOSTRAR a
// lista: não havia como escolher outra tecla. Agora cada ação se declara aqui (tecla
// de fábrica, grupo, rótulo e o que faz), o `keys.ts` despacha por esta tabela e o
// que a pessoa trocar fica em `mdc.atalhos`.

import type { App } from "./app";
import { loadJSON, saveJSON } from "../util";

export interface Atalho {
  /** identificador estável — é a chave do que a pessoa grava em `mdc.atalhos` */
  id: string;
  grupo: string;
  rotulo: string;
  /** tecla de fábrica, no formato "Ctrl+Shift+T" */
  padrao: string;
  /**
   * Tecla de fábrica no navegador: Ctrl+T, Ctrl+W e Ctrl+Tab pertencem a ele — que abre,
   * fecha e troca as abas dele antes de o app ver a tecla, e `preventDefault` não segura.
   * Anunciar essas teclas seria prometer o que não funciona.
   */
  padraoNavegador?: string;
  /** o que o atalho faz */
  acao?: (app: App, e: KeyboardEvent) => void;
  /**
   * A tecla é nossa, mas a ação vive em outro módulo (a fita recolhível). Estes não
   * são despachados pelo `keys.ts`: quem cuida pergunta a tecla por `combina(id, e)`.
   */
  externo?: boolean;
  /** vale mesmo com um modal aberto (padrão: com modal, o atalho não dispara) */
  comModal?: boolean;
  /** só vale quando isto responder true */
  quando?: (app: App) => boolean;
  /**
   * A tecla é um dígito: vale para todos de 1 a 9 com os mesmos modificadores
   * (é o "Ctrl+1…9" da lista).
   */
  digitos?: boolean;
}

/** Ordem em que os grupos aparecem na tela. */
export const GRUPOS = ["Abas", "Arquivo", "Escrita", "Formatação", "Janela e ajuda"] as const;

export const ATALHOS: Atalho[] = [
  // ---------------------------------------------------------------- abas
  //
  // Ctrl+T/Ctrl+W/Ctrl+Tab/Ctrl+1…9 são do PRÓPRIO navegador: ele abre, fecha e troca as
  // abas dele antes de o app ver a tecla, e `preventDefault` não segura. Por isso as abas
  // usam um padrão alternativo (`padraoNavegador`, com Alt no meio).
  {
    id: "nova-aba",
    grupo: "Abas",
    rotulo: "Nova aba",
    padrao: "Ctrl+T",
    padraoNavegador: "Ctrl+Alt+N",
    acao: (a) => void a.newDoc(),
  },
  {
    id: "fechar-aba",
    grupo: "Abas",
    rotulo: "Fechar aba",
    padrao: "Ctrl+W",
    padraoNavegador: "Ctrl+Alt+W",
    acao: (a) => void a.closeTab(a.activeTabId()),
  },
  {
    id: "fechar-tudo",
    grupo: "Abas",
    rotulo: "Fechar todos os documentos",
    padrao: "Ctrl+Shift+W",
    padraoNavegador: "Ctrl+Alt+Shift+W",
    acao: (a) => void a.closeAll(),
  },
  {
    id: "reabrir-aba",
    grupo: "Abas",
    rotulo: "Reabrir a última aba fechada",
    padrao: "Ctrl+Shift+T",
    padraoNavegador: "Ctrl+Alt+Shift+T",
    acao: (a) => void a.reopenClosedTab(),
  },
  {
    id: "proxima-aba",
    grupo: "Abas",
    rotulo: "Próxima aba",
    padrao: "Ctrl+Tab",
    padraoNavegador: "Ctrl+Alt+PageDown",
    acao: (a) => void a.switchRelative(1),
  },
  {
    id: "aba-anterior",
    grupo: "Abas",
    rotulo: "Aba anterior",
    padrao: "Ctrl+Shift+Tab",
    padraoNavegador: "Ctrl+Alt+PageUp",
    acao: (a) => void a.switchRelative(-1),
  },
  {
    id: "aba-n",
    grupo: "Abas",
    rotulo: "Ir para a aba",
    padrao: "Ctrl+1",
    padraoNavegador: "Ctrl+Alt+1",
    digitos: true,
    acao: (a, e) => {
      const n = Number(e.key);
      const alvo = n === 9 ? a.tabs[a.tabs.length - 1] : a.tabs[n - 1];
      if (alvo) void a.switchTo(alvo.id);
    },
  },

  // ------------------------------------------------------------- arquivo
  { id: "abrir", grupo: "Arquivo", rotulo: "Abrir documento", padrao: "Ctrl+O", acao: (a) => void a.openDocDialog() },
  {
    id: "salvar",
    grupo: "Arquivo",
    rotulo: "Salvar",
    padrao: "Ctrl+S",
    // com modal aberto o atalho continua sendo consumido (senão o WebView abriria o
    // "salvar página" dele por baixo da janela), mas não salva nada
    comModal: true,
    acao: (a) => {
      if (document.querySelector(".modal-backdrop")) return;
      void a.save(false);
    },
  },
  {
    id: "salvar-como",
    grupo: "Arquivo",
    rotulo: "Salvar como",
    padrao: "Ctrl+Shift+S",
    comModal: true,
    acao: (a) => {
      if (document.querySelector(".modal-backdrop")) return;
      void a.save(true);
    },
  },
  { id: "exportar", grupo: "Arquivo", rotulo: "Exportar", padrao: "Ctrl+Shift+E", acao: (a) => a.openExport() },
  {
    id: "renomear",
    grupo: "Arquivo",
    rotulo: "Renomear o documento",
    padrao: "F2",
    acao: (a) => a.tabBar.beginRename(a.tab.id),
  },

  // -------------------------------------------------------------- escrita
  { id: "buscar-comandos", grupo: "Escrita", rotulo: "Buscar comando ou função", padrao: "Ctrl+K", acao: (a) => a.abrirBusca() },
  { id: "revisar", grupo: "Escrita", rotulo: "Revisar texto", padrao: "F7", acao: (a) => a.openReview() },
  { id: "formalizar", grupo: "Escrita", rotulo: "Formalizar texto (com prévia)", padrao: "Ctrl+Alt+F", acao: (a) => a.openFormalizar() },
  {
    id: "traducao",
    grupo: "Escrita",
    rotulo: "Tradução automática",
    padrao: "Ctrl+Alt+T",
    acao: (a) => a.toggleTranslation(),
  },
  { id: "desenhar", grupo: "Escrita", rotulo: "Desenhar", padrao: "Ctrl+Shift+D", acao: (a) => void a.openDraw() },
  { id: "slides", grupo: "Escrita", rotulo: "Apresentar (slides)", padrao: "F5", acao: (a) => a.openSlides() },
  {
    id: "copiar-ia",
    grupo: "Escrita",
    rotulo: "Copiar para a IA",
    padrao: "Ctrl+Shift+C",
    acao: (a) => void a.copyForAI(),
  },

  // ------------------------------------------------------------ formatação
  {
    id: "negrito",
    grupo: "Formatação",
    rotulo: "Negrito",
    padrao: "Ctrl+B",
    // o Word tem o próprio mapa de teclas (ProseMirror); aqui vale para o resto
    quando: (a) => a.tab.kind !== "word" && a.tab.kind !== "xlsx",
    acao: (a) => a.act("bold"),
  },
  {
    id: "italico",
    grupo: "Formatação",
    rotulo: "Itálico",
    padrao: "Ctrl+I",
    quando: (a) => a.tab.kind !== "word" && a.tab.kind !== "xlsx",
    acao: (a) => a.act("italic"),
  },

  // -------------------------------------------------------- janela e ajuda
  { id: "modo-foco", grupo: "Janela e ajuda", rotulo: "Modo foco", padrao: "Ctrl+Shift+F", acao: (a) => a.toggleFocus() },
  // a ação mora no fita.ts, que é quem conhece o estado recolhido/expandido
  { id: "fita", grupo: "Janela e ajuda", rotulo: "Recolher/expandir a faixa de opções", padrao: "Ctrl+F1", externo: true },
  { id: "ajuda", grupo: "Janela e ajuda", rotulo: "Boas-vindas e ajuda", padrao: "F1", acao: (a) => a.showWelcome() },
];

// ------------------------------------------------------------------ teclas

const CHAVE = "mdc.atalhos";

/** Só o que a pessoa trocou. O resto continua valendo o padrão do código. */
let trocadas: Record<string, string> = loadJSON<Record<string, string>>(CHAVE, {});

let captura = false;

function porId(id: string): Atalho | undefined {
  return ATALHOS.find((a) => a.id === id);
}

/** A tecla de fábrica DESTE ambiente (no navegador, a variante que ele não reserva). */
function padraoDe(id: string): string {
  const a = porId(id);
  if (!a) return "";
  return a.padraoNavegador ?? a.padrao;
}

/** A tecla em vigor (o que a pessoa escolheu ou, sem escolha, a de fábrica). */
export function teclaDe(id: string): string {
  return trocadas[id] ?? padraoDe(id);
}

/** A tecla de fábrica, para comparar e para restaurar. */
export function teclaPadrao(id: string): string {
  return padraoDe(id);
}

export function foiTrocada(id: string): boolean {
  return trocadas[id] !== undefined && trocadas[id] !== padraoDe(id);
}

export function quantasTrocadas(): number {
  return ATALHOS.filter((a) => foiTrocada(a.id)).length;
}

/** Como a tecla aparece na tela: o "Ctrl+1…9" da família dos dígitos. */
export function teclaVisivel(id: string): string {
  const t = teclaDe(id);
  return porId(id)?.digitos ? `${t}…9` : t;
}

// ------------------------------------------------- nome e leitura da tecla

/**
 * O nome da tecla, ou `null` quando ela não serve para um atalho.
 *
 * Entram letras, dígitos, F1–F12, Tab e PageUp/PageDown. Teclas de edição (setas,
 * Backspace) e modificadores soltos ficam de fora: um atalho nelas atrapalharia a
 * digitação. PageUp/PageDown só valem acompanhadas de modificador (o `comboDeEvento`
 * exige Ctrl ou Alt), como na troca de abas do navegador.
 */
function nomeDaTecla(e: KeyboardEvent): string | null {
  if (/^[a-zA-Z]$/.test(e.key)) return e.key.toUpperCase();
  if (/^[0-9]$/.test(e.key)) return e.key;
  if (/^F([1-9]|1[0-2])$/.test(e.key)) return e.key;
  if (e.key === "Tab") return "Tab";
  if (e.key === "PageUp" || e.key === "PageDown") return e.key;
  return null;
}

export function ctrlOuMeta(e: KeyboardEvent): boolean {
  return e.ctrlKey || e.metaKey;
}

/**
 * A combinação que a pessoa acabou de pressionar, no formato guardado — ou `null`
 * se não serve como atalho.
 */
export function comboDeEvento(e: KeyboardEvent): string | null {
  const nome = nomeDaTecla(e);
  if (!nome) return null;
  const ctrl = ctrlOuMeta(e);
  // Tecla sem modificador só vale se for de função: qualquer outra dispararia
  // enquanto a pessoa escreve no documento.
  if (!ctrl && !e.altKey && !/^F([1-9]|1[0-2])$/.test(nome)) return null;
  return montar(ctrl, e.altKey, e.shiftKey, nome);
}

function montar(ctrl: boolean, alt: boolean, shift: boolean, nome: string): string {
  const partes: string[] = [];
  if (ctrl) partes.push("Ctrl");
  if (alt) partes.push("Alt");
  if (shift) partes.push("Shift");
  partes.push(nome);
  return partes.join("+");
}

interface Partes {
  ctrl: boolean;
  alt: boolean;
  shift: boolean;
  nome: string;
}

function desmontar(combo: string): Partes {
  const partes = combo.split("+");
  const nome = partes.pop() ?? "";
  return {
    ctrl: partes.includes("Ctrl"),
    alt: partes.includes("Alt"),
    shift: partes.includes("Shift"),
    nome,
  };
}

/** O evento casa com esta tecla? (usado pelo `keys.ts` e pela fita) */
export function combina(id: string, e: KeyboardEvent): boolean {
  const alvo = desmontar(teclaDe(id));
  if (alvo.nome === "") return false;
  if (alvo.ctrl !== ctrlOuMeta(e) || alvo.alt !== e.altKey || alvo.shift !== e.shiftKey) return false;
  const nome = nomeDaTecla(e);
  if (!nome) return false;
  // a família dos dígitos vale para qualquer um deles
  if (porId(id)?.digitos) return /^[1-9]$/.test(nome);
  return nome === alvo.nome;
}

/**
 * Qual atalho o evento aciona (o primeiro que casar), ou `null`.
 *
 * Com um modal aberto, os atalhos ficam quietos — só os marcados com `comModal`.
 */
export function atalhoDoEvento(app: App, e: KeyboardEvent): Atalho | null {
  const comModal = !!document.querySelector(".modal-backdrop");
  for (const a of ATALHOS) {
    if (a.externo || !a.acao) continue;
    if (comModal && !a.comModal) continue;
    if (a.quando && !a.quando(app)) continue;
    if (combina(a.id, e)) return a;
  }
  return null;
}

// ------------------------------------------------------------- trocar tecla

/**
 * Troca a tecla de um atalho. Devolve o motivo da recusa, ou `null` se deu certo.
 *
 * Recusa conflito em vez de deixar duas ações na mesma tecla: as duas disparariam
 * juntas e não haveria como saber qual era qual.
 */
export function trocarTecla(id: string, combo: string): string | null {
  const alvo = desmontar(combo);
  if (alvo.nome === "") return "Essa tecla não serve para um atalho.";
  const conflito = ATALHOS.find((a) => a.id !== id && combina(a.id, eventoFalso(alvo)));
  if (conflito) return `${combo} já é "${conflito.rotulo}".`;
  trocadas = { ...trocadas, [id]: combo };
  gravar();
  return null;
}

/** Um evento de mentira com a combinação pedida, para reaproveitar o `combina`. */
function eventoFalso(p: Partes): KeyboardEvent {
  return {
    key: p.nome,
    ctrlKey: p.ctrl,
    metaKey: false,
    altKey: p.alt,
    shiftKey: p.shift,
  } as KeyboardEvent;
}

export function voltarAoPadrao(id: string): void {
  if (!(id in trocadas)) return;
  const copia = { ...trocadas };
  delete copia[id];
  trocadas = copia;
  gravar();
}

export function voltarTudoAoPadrao(): void {
  trocadas = {};
  gravar();
}

/** Aviso de que alguma tecla mudou (quem exibe atalho fora da aba escuta isto). */
export const EVENTO_MUDOU = "mdc:atalhos-mudaram";

function gravar(): void {
  saveJSON(CHAVE, trocadas);
  // Quem mostra a tecla em outro lugar (a dica da fita, por exemplo) precisa saber
  // que ela mudou — senão a interface passa a mentir.
  document.dispatchEvent(new CustomEvent(EVENTO_MUDOU));
}

// ------------------------------------------------------------------ captura

/**
 * Enquanto a pessoa escolhe uma tecla na aba Atalhos, o resto do app não pode
 * reagir ao que ela aperta.
 */
export function emCaptura(v?: boolean): boolean {
  if (v !== undefined) captura = v;
  return captura;
}
