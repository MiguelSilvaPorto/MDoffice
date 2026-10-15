// A fita da apresentação, no desenho do PowerPoint: abas (Página Inicial, Inserir, Formato da Forma, Design, Exibir),
// grupos com o nome embaixo, botões grandes e pequenos. Tudo é despachado por `run(comando, valor)` para o host.
import { SOMBRAS_PRONTAS } from "../edicao/formato";
import { ANGULOS_ESTILO, FAMILIAS, FAMILIAS_ORDEM, rampaDeTons } from "../edicao/estilos";
import { GRAFICO_TIPOS } from "../edicao/grafico";
import { ROTULOS_PRESET, type PresetTabela } from "../edicao/tabela";
import { DICAS_DIRECAO, DICAS_TRANSICAO, DIRECOES_TRANSICAO, DURACOES_TRANSICAO, ROTULOS_DIRECAO, ROTULOS_TRANSICAO, TIPOS_TRANSICAO, aceitaDirecao, direcaoDe, duracaoDe, formatarDuracao } from "../edicao/transicao";
import { DICAS_ANIMACAO, DICAS_INICIO, ATRASOS_ANIMACAO, CLASSE_ANIMACAO, DIRECOES_ANIMACAO, DURACOES_ANIMACAO, INICIOS_ANIMACAO, ROTULOS_ANIMACAO, ROTULOS_INICIO, TIPOS_ANIMACAO, aceitaDirecaoAnimacao, atrasoDe, direcaoDeAnimacao, duracaoDeAnimacao, inicioDe, suave } from "../edicao/animacao";
import type { AnimacaoTipo, Shadow, TransicaoDirecao, TransicaoTipo } from "../schema";
import { abrirCores } from "./cores";
import { FONTES_COMUNS, TAMANHOS, cmParaPt, ptParaCm, type EstadoUI } from "./estado";
import { abrirGaleria, iconeDeForma } from "./galeria";
import { abrirModelos } from "./modelos";
import { abrirPopup, ancoraDoPopup, fecharPopup } from "./popup";
import { abrirGaleriaDeLayouts } from "./layoutPreview";
import { melhorarSelects, fecharSeletor } from "../../seletor";
import { GALERIA } from "../edicao/criar";
import { escapeHtml } from "../../util";

export interface HooksFita {
  estado: () => EstadoUI;
  run: (cmd: string, valor?: string) => void;
}

const ic = (n: string) => `<svg class="ic"><use href="#${n}"/></svg>`;

const btn = (cmd: string, conteudo: string, titulo: string, extra = "", menu = false) =>
  `<button type="button" class="ppr ${extra}${menu ? " tem-menu" : ""}" data-cmd="${cmd}"${menu ? ' data-menu="1"' : ""} title="${titulo}" aria-label="${titulo}">${conteudo}${menu ? '<span class="car">▾</span>' : ""}</button>`;

const grande = (cmd: string, icone: string, nome: string, titulo: string, menu = false) => btn(cmd, `${icone}<span>${nome}</span>`, titulo, "big", menu);
const pequeno = (cmd: string, icone: string, nome: string, titulo: string, menu = false) => btn(cmd, `${icone}<span>${nome}</span>`, titulo, "txt", menu);

const grupo = (nome: string, corpo: string) => `<div class="ppr-grupo"><div class="ppr-corpo">${corpo}</div><div class="ppr-rotulo">${nome}</div></div>`;

/** Setas da direção da transição (a lâmina entra por esse lado). */
const FLECHAS_DIRECAO: Record<TransicaoDirecao, string> = { esquerda: "←", direita: "→", cima: "↑", baixo: "↓" };

/**
 * Prévia de uma sombra pronta para a galeria "Efeitos".
 *
 * A sombra é desenhada pela própria **forma** (um quadradinho claro) sobre uma **mesa de tom
 * médio**: a sombra preta e o brilho branco ficam visíveis nos dois temas. Antes a forma era o
 * retângulo do painel e a sombra caía FORA dele, sobre o fundo do menu — no tema escuro a
 * galeria ficava sem prévia nenhuma (sombra preta sobre painel escuro).
 */
function previaSombra(s: Shadow | null): string {
  // a prévia é esquemática: a sombra entra com 80% do deslocamento real para caber na mesa
  const desloc = s
    ? `box-shadow:${Math.round(s.dist * 0.8 * Math.cos((s.dir * Math.PI) / 180))}px ${Math.round(s.dist * 0.8 * Math.sin((s.dir * Math.PI) / 180))}px ${Math.round(s.blur / 2)}px #${s.color}${Math.round(s.alpha * 255).toString(16).padStart(2, "0")}`
    : "";
  return `<span class="ppr-sombra-previa"><span class="ppr-sombra-forma" style="${desloc}"></span></span>`;
}

/** Prévia visual de cada animação: a forma é o retângulo; a seta mostra se ela entra ou sai. */
function previaAnimacao(tipo: AnimacaoTipo): string {
  const moldura = `<rect x="1" y="1" width="30" height="18" rx="2" fill="none" stroke="currentColor" stroke-opacity=".45"/>`;
  const forma = (op: number, extra = "") => `<rect x="13" y="5" width="16" height="10" rx="1.5" fill="currentColor" fill-opacity="${op}"${extra}/>`;
  const traco = (d: string) => `<path d="${d}" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>`;
  const entra = traco("M4 10h5M7 7.5 9.5 10 7 12.5");
  const sai = traco("M24 10h5M26.5 7.5 29 10 26.5 12.5");
  const desenhos: Record<AnimacaoTipo, string> = {
    // entra de uma vez
    aparecer: moldura + entra + forma(0.5),
    // entra suavemente (duas camadas sugerem o fade)
    surgir: moldura + entra + forma(0.22) + `<rect x="17" y="7" width="8" height="6" rx="1" fill="currentColor" fill-opacity=".5"/>`,
    // cresce um pouco e volta (contorno tracejado = o tamanho de partida)
    pulsar: moldura + forma(0.32) + `<rect x="11" y="3" width="20" height="14" rx="2.5" fill="none" stroke="currentColor" stroke-width="1.2" stroke-dasharray="2.5 2" stroke-opacity=".75"/>`,
    // cresce e fica maior (o contorno é o tamanho de partida)
    ampliar: moldura + forma(0.22) + `<rect x="10" y="2.5" width="22" height="15" rx="2" fill="currentColor" fill-opacity=".55"/>`,
    // dá uma volta (seta circular ao lado)
    girar: moldura + forma(0.4) + traco("M9.5 6a6 6 0 1 0-2.6 6.9") + traco("M9.5 6l2.5-1.3M9.5 6l1.3 2.5"),
    // fica meio transparente (a forma "vazada")
    transparencia: moldura + forma(0.2) + `<rect x="13" y="5" width="16" height="10" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.1" stroke-dasharray="2.5 2" stroke-opacity=".7"/>`,
    // sai de uma vez (a forma fica tracejada)
    desaparecer: moldura + forma(0.5, ' stroke="currentColor" stroke-width="1" stroke-dasharray="2.5 2" stroke-opacity=".7"') + sai,
    // sai suavemente
    sumir: moldura + forma(0.12) + `<rect x="17" y="7" width="8" height="6" rx="1" fill="currentColor" fill-opacity=".3"/>` + sai,
    // anda em linha (a forma sai daqui e o tracejado mostra onde ela chega)
    trajetoria:
      moldura +
      `<rect x="4" y="6" width="8" height="8" rx="1" fill="currentColor" fill-opacity=".5"/>` +
      traco("M13 10h7M17.5 7.5 20 10 17.5 12.5") +
      `<rect x="20" y="6" width="8" height="8" rx="1" fill="none" stroke="currentColor" stroke-width="1" stroke-dasharray="2.5 2" stroke-opacity=".65"/>`,
    // entra voando (forma na borda + seta + destino tracejado)
    voar:
      moldura +
      `<rect x="3" y="6" width="8" height="8" rx="1" fill="currentColor" fill-opacity=".5"/>` +
      traco("M12 10h5M14.5 7.5 17 10 14.5 12.5") +
      `<rect x="17" y="5" width="12" height="10" rx="1.5" fill="none" stroke="currentColor" stroke-width="1" stroke-dasharray="2.5 2" stroke-opacity=".65"/>`,
    // cresce do centro (forma pequena + contorno do tamanho final + setas para fora)
    zoom:
      moldura +
      `<rect x="12" y="4" width="18" height="12" rx="2" fill="none" stroke="currentColor" stroke-width="1" stroke-dasharray="2.5 2" stroke-opacity=".65"/>` +
      `<rect x="17" y="7.5" width="8" height="5" rx="1" fill="currentColor" fill-opacity=".6"/>` +
      traco("M15.5 7.5 12.5 4.5M26.5 7.5 29.5 4.5"),
    // sai voando (forma + seta + destino tracejado na borda)
    voarFora:
      moldura +
      `<rect x="5" y="5" width="10" height="10" rx="1.5" fill="currentColor" fill-opacity=".4"/>` +
      traco("M15 10h6M18.5 7.5 21 10 18.5 12.5") +
      `<rect x="21" y="7" width="8" height="6" rx="1" fill="none" stroke="currentColor" stroke-width="1" stroke-dasharray="2.5 2" stroke-opacity=".65"/>`,
    // encolhe até sumir (forma grande + contorno pequeno + setas para dentro)
    encolher:
      moldura +
      `<rect x="9" y="3" width="20" height="14" rx="2" fill="currentColor" fill-opacity=".35"/>` +
      traco("M14 6.5 16.5 8.5M24 6.5 21.5 8.5") +
      `<rect x="17.5" y="7.5" width="7" height="5" rx="1" fill="none" stroke="currentColor" stroke-width="1" stroke-dasharray="2.5 2" stroke-opacity=".8"/>`,
    // revelada a partir da borda (metade cheia + o resto tracejado + seta)
    limpar:
      moldura +
      `<rect x="6" y="5" width="7" height="10" rx="1.5" fill="currentColor" fill-opacity=".5"/>` +
      `<rect x="13" y="5" width="7" height="10" rx="1.5" fill="none" stroke="currentColor" stroke-width="1" stroke-dasharray="2.5 2" stroke-opacity=".6"/>` +
      traco("M2 10h2.5M3.5 8.5 5 10 3.5 11.5"),
    // some a partir da borda (mesmo desenho, seta saindo)
    limparFora:
      moldura +
      `<rect x="6" y="5" width="7" height="10" rx="1.5" fill="currentColor" fill-opacity=".5"/>` +
      `<rect x="13" y="5" width="7" height="10" rx="1.5" fill="none" stroke="currentColor" stroke-width="1" stroke-dasharray="2.5 2" stroke-opacity=".6"/>` +
      traco("M4.5 10h-2.5M3 8.5 1.5 10 3 11.5"),
    // abre do centro como uma caixa (interior cheio + contorno do tamanho final)
    caixa:
      moldura +
      `<rect x="10" y="4" width="20" height="12" rx="2" fill="none" stroke="currentColor" stroke-width="1" stroke-dasharray="2.5 2" stroke-opacity=".65"/>` +
      `<rect x="17" y="7.5" width="6" height="5" rx="1" fill="currentColor" fill-opacity=".55"/>`,
    // fecha para o centro (mesmo desenho)
    caixaFora:
      moldura +
      `<rect x="10" y="4" width="20" height="12" rx="2" fill="none" stroke="currentColor" stroke-width="1" stroke-dasharray="2.5 2" stroke-opacity=".65"/>` +
      `<rect x="17" y="7.5" width="6" height="5" rx="1" fill="currentColor" fill-opacity=".55"/>`,
    // abre do centro como um círculo (círculo cheio + contorno maior tracejado)
    circulo:
      moldura +
      `<circle cx="20" cy="10" r="6" fill="none" stroke="currentColor" stroke-width="1" stroke-dasharray="2.5 2" stroke-opacity=".65"/>` +
      `<circle cx="20" cy="10" r="3" fill="currentColor" fill-opacity=".55"/>`,
    // fecha para o centro (mesmo desenho)
    circuloFora:
      moldura +
      `<circle cx="20" cy="10" r="6" fill="none" stroke="currentColor" stroke-width="1" stroke-dasharray="2.5 2" stroke-opacity=".65"/>` +
      `<circle cx="20" cy="10" r="3" fill="currentColor" fill-opacity=".55"/>`,
    // abre do centro como um losango (losango cheio + contorno maior tracejado)
    losango:
      moldura +
      `<path d="M20 3 27 10 20 17 13 10Z" fill="none" stroke="currentColor" stroke-width="1" stroke-dasharray="2.5 2" stroke-opacity=".65"/>` +
      `<path d="M20 7 23 10 20 13 17 10Z" fill="currentColor" fill-opacity=".55"/>`,
    // fecha para o centro (mesmo desenho)
    losangoFora:
      moldura +
      `<path d="M20 3 27 10 20 17 13 10Z" fill="none" stroke="currentColor" stroke-width="1" stroke-dasharray="2.5 2" stroke-opacity=".65"/>` +
      `<path d="M20 7 23 10 20 13 17 10Z" fill="currentColor" fill-opacity=".55"/>`,
    // abre do centro para os lados (duas metades + setas para fora)
    dividir:
      moldura +
      `<rect x="4" y="5" width="8" height="10" rx="1.5" fill="currentColor" fill-opacity=".5"/>` +
      `<rect x="20" y="5" width="8" height="10" rx="1.5" fill="currentColor" fill-opacity=".5"/>` +
      traco("M13.5 10 11 10M12 8.5 10.5 10 12 11.5M18.5 10 21 10M20 8.5 21.5 10 20 11.5"),
    // fecha no centro (mesmo desenho, setas para dentro)
    dividirFora:
      moldura +
      `<rect x="4" y="5" width="8" height="10" rx="1.5" fill="currentColor" fill-opacity=".5"/>` +
      `<rect x="20" y="5" width="8" height="10" rx="1.5" fill="currentColor" fill-opacity=".5"/>` +
      traco("M11 10 13.5 10M13 8.5 14.5 10 13 11.5M21 10 18.5 10M19 8.5 17.5 10 19 11.5"),
    // faixas que crescem (persianas horizontais)
    persianas:
      moldura +
      `<rect x="6" y="3.5" width="20" height="2.6" rx="1" fill="currentColor" fill-opacity=".55"/>` +
      `<rect x="6" y="8" width="20" height="2.6" rx="1" fill="currentColor" fill-opacity=".55"/>` +
      `<rect x="6" y="12.5" width="14" height="2.6" rx="1" fill="currentColor" fill-opacity=".45"/>` +
      `<rect x="6" y="17" width="7" height="2.6" rx="1" fill="currentColor" fill-opacity=".35"/>`,
    // some em faixas (mesmo desenho, de baixo para cima)
    persianasFora:
      moldura +
      `<rect x="6" y="3.5" width="7" height="2.6" rx="1" fill="currentColor" fill-opacity=".35"/>` +
      `<rect x="6" y="8" width="14" height="2.6" rx="1" fill="currentColor" fill-opacity=".45"/>` +
      `<rect x="6" y="12.5" width="20" height="2.6" rx="1" fill="currentColor" fill-opacity=".55"/>` +
      `<rect x="6" y="17" width="20" height="2.6" rx="1" fill="currentColor" fill-opacity=".55"/>`,
    // pontinhos que aparecem (dissolver)
    dissolver:
      moldura +
      `<g fill="currentColor" fill-opacity=".55">` +
      `<rect x="7" y="4" width="2.4" height="2.4" rx=".4"/><rect x="13" y="4" width="2.4" height="2.4" rx=".4"/><rect x="19" y="4" width="2.4" height="2.4" rx=".4"/>` +
      `<rect x="10" y="7.5" width="2.4" height="2.4" rx=".4"/><rect x="16" y="7.5" width="2.4" height="2.4" rx=".4"/><rect x="22" y="7.5" width="2.4" height="2.4" rx=".4"/>` +
      `<rect x="7" y="11" width="2.4" height="2.4" rx=".4"/><rect x="13" y="11" width="2.4" height="2.4" rx=".4"/><rect x="19" y="11" width="2.4" height="2.4" rx=".4"/>` +
      `<rect x="10" y="14.5" width="2.4" height="2.4" rx=".4"/><rect x="16" y="14.5" width="2.4" height="2.4" rx=".4"/><rect x="22" y="14.5" width="2.4" height="2.4" rx=".4"/>` +
      `</g>`,
    // some em pontinhos (mesmo desenho, com metade apagada)
    dissolverFora:
      moldura +
      `<g fill="currentColor" fill-opacity=".3">` +
      `<rect x="7" y="4" width="2.4" height="2.4" rx=".4"/><rect x="13" y="4" width="2.4" height="2.4" rx=".4"/><rect x="19" y="4" width="2.4" height="2.4" rx=".4"/>` +
      `<rect x="10" y="7.5" width="2.4" height="2.4" rx=".4"/><rect x="16" y="7.5" width="2.4" height="2.4" rx=".4"/><rect x="22" y="7.5" width="2.4" height="2.4" rx=".4"/>` +
      `</g>` +
      `<g fill="currentColor" fill-opacity=".6">` +
      `<rect x="7" y="11" width="2.4" height="2.4" rx=".4"/><rect x="13" y="11" width="2.4" height="2.4" rx=".4"/><rect x="19" y="11" width="2.4" height="2.4" rx=".4"/>` +
      `<rect x="10" y="14.5" width="2.4" height="2.4" rx=".4"/><rect x="16" y="14.5" width="2.4" height="2.4" rx=".4"/><rect x="22" y="14.5" width="2.4" height="2.4" rx=".4"/>` +
      `</g>`,
    // uma volta como um ponteiro (roda)
    roda:
      moldura +
      `<circle cx="16" cy="10" r="7" fill="none" stroke="currentColor" stroke-width="1" stroke-dasharray="2.5 2" stroke-opacity=".6"/>` +
      `<path d="M16 10 16 3 A7 7 0 0 1 22.1 6.5 Z" fill="currentColor" fill-opacity=".5"/>`,
    // some na volta (mesmo desenho, seta no sentido contrário)
    rodaFora:
      moldura +
      `<circle cx="16" cy="10" r="7" fill="none" stroke="currentColor" stroke-width="1" stroke-dasharray="2.5 2" stroke-opacity=".6"/>` +
      `<path d="M16 10 16 3 A7 7 0 0 0 9.9 6.5 Z" fill="currentColor" fill-opacity=".5"/>`,
  };
  return `<svg class="ppr-anim-svg" viewBox="0 0 32 20" aria-hidden="true">${desenhos[tipo]}</svg>`;
}

/**
 * Cartão da galeria de animações: a prévia em cima e o nome embaixo, num alvo de clique só.
 * A fita (efeitos mais usados) e o popup "Mais" (a lista completa) usam o MESMO desenho —
 * trocar o cartão num lugar sem o outro deixaria as duas galerias com cara de coisas diferentes.
 */
function cartaoAnimacao(t: AnimacaoTipo, extra = ""): string {
  return `<button type="button" class="ppr-anim-item${extra ? ` ${extra}` : ""}" data-cmd="animacao:${t}" title="${DICAS_ANIMACAO[t]}" aria-label="${ROTULOS_ANIMACAO[t]}">${previaAnimacao(t)}<span class="ppr-anim-nome">${ROTULOS_ANIMACAO[t]}</span></button>`;
}

/** O cartão "Mais": fecha a fileira da fita com o mesmo desenho dos efeitos e abre a galeria completa. */
function cartaoMaisAnimacoes(): string {
  return (
    `<button type="button" class="ppr-anim-item ppr-anim-mais" data-cmd="animacao-mais" data-menu="1" title="Mais animações: girar, ampliar, transparência… (a lista completa, por classe)" aria-label="Mais animações">` +
    `<span class="ppr-anim-mais-ic" aria-hidden="true">⋯</span><span class="ppr-anim-nome">Mais</span></button>`
  );
}

/** Prévia visual de cada transição: a lâmina que entra é o retângulo cheio, a que sai é o mais claro. */
function previaTransicao(tipo: TransicaoTipo): string {
  const moldura = `<rect x="1" y="1" width="30" height="18" rx="2" fill="none" stroke="currentColor" stroke-opacity=".45"/>`;
  const bloco = (x: number, w: number, opacidade = 0.3) => `<rect x="${x}" y="1" width="${w}" height="18" rx="2" fill="currentColor" fill-opacity="${opacidade}"/>`;
  const traco = (d: string) => `<path d="${d}" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>`;
  const desenhos: Record<TransicaoTipo, string> = {
    // troca direta: um risco no meio
    none: moldura + traco("M7 16 25 4"),
    // a nova aparece sobre a antiga
    fade: moldura + bloco(1, 30, 0.16) + traco("M7 10h18M21 6.5 24.5 10 21 13.5"),
    // as duas deslizam juntas
    push: moldura + bloco(1, 15, 0.18) + bloco(16, 15, 0.42) + traco("M9 10h11M16 6.5 19.5 10 16 13.5"),
    // a nova é revelada a partir da borda
    wipe: moldura + bloco(1, 16, 0.42) + traco("M17 2v16M11 10h7M15 6.5 18.5 10 15 13.5"),
    // abre do centro
    split: moldura + bloco(1, 13, 0.42) + bloco(18, 13, 0.42) + traco("M15.5 4.5 13 10l2.5 5.5M16.5 4.5 19 10l-2.5 5.5"),
    // a nova desliza por cima da antiga
    cover: moldura + bloco(1, 16, 0.16) + bloco(15, 16, 0.42) + traco("M8 10h9M14 6.5 17.5 10 14 13.5"),
    // a antiga sai e revela a nova
    uncover: moldura + bloco(1, 17, 0.42) + bloco(17, 14, 0.16) + traco("M7 10h9M13 6.5 16.5 10 13 13.5"),
  };
  return `<svg class="ppr-trans-svg" viewBox="0 0 32 20" aria-hidden="true">${desenhos[tipo]}</svg>`;
}

const ABAS = [
  { id: "inicio", nome: "Página Inicial" },
  { id: "inserir", nome: "Inserir" },
  { id: "desenhar", nome: "Desenhar" },
  { id: "formato", nome: "Formato da Forma" },
  { id: "tabela", nome: "Layout da Tabela" },
  { id: "transicoes", nome: "Transições" },
  { id: "animacoes", nome: "Animações" },
  { id: "design", nome: "Design" },
  { id: "exibir", nome: "Exibir" },
];

const ESTILOS_RAPIDOS: { nome: string; cmd: string }[] = [
  { nome: "Destaque cheio", cmd: "estilo:cheio" },
  { nome: "Só contorno", cmd: "estilo:contorno" },
  { nome: "Gradiente", cmd: "estilo:gradiente" },
  { nome: "Cartão branco com sombra", cmd: "estilo:cartao" },
  { nome: "Escuro", cmd: "estilo:escuro" },
  { nome: "Suave", cmd: "estilo:suave" },
];

/** Cores clássicas do marca-texto (as mesmas do PowerPoint), hex sem #. */
const CORES_MARCA_TEXTO = ["FFFF00", "00FF00", "00FFFF", "FF99CC", "FFC000", "C9DAF8", "D9EAD3", "F4CCCC"];

/** Presets de espaçamento entre caracteres em pt (negativo = letras mais juntas). */
const ESPACAMENTOS: [string, string][] = [
  ["-1.5", "Muito reduzido (-1,5 pt)"],
  ["-0.75", "Reduzido (-0,75 pt)"],
  ["0", "Nenhum"],
  ["0.75", "Ampliado (0,75 pt)"],
  ["1.5", "Muito ampliado (1,5 pt)"],
  ["3", "3 pt"],
  ["5", "5 pt"],
];

export class Fita {
  readonly el: HTMLElement;
  private aba = "inicio";

  constructor(host: HTMLElement, private hooks: HooksFita) {
    this.el = host;
    host.innerHTML = `
      <div class="ppr-abas" role="tablist">
        ${ABAS.map((a) => `<button type="button" class="ppr-aba${a.id === "inicio" ? " on" : ""}" role="tab" data-aba="${a.id}"${a.id === "formato" || a.id === "tabela" ? " hidden" : ""}><span class="ppr-aba-rot" data-nome="${a.nome}">${a.nome}</span></button>`).join("")}
        <span class="ppr-enche"></span>
        <button type="button" class="ppr-aba ppr-tpl" data-cmd="modelo" data-menu="1" title="Aplicar um modelo à apresentação (tema, cores e fonte)">${ic("i-addons")}<span>Template</span></button>
      </div>
      <div class="ppr-paineis">
        <div class="ppr-painel" data-painel="inicio">${this.inicio()}</div>
        <div class="ppr-painel" data-painel="inserir" hidden>${this.inserir()}</div>
        <div class="ppr-painel" data-painel="desenhar" hidden>${this.desenhar()}</div>
        <div class="ppr-painel" data-painel="formato" hidden>${this.formato()}</div>
        <div class="ppr-painel" data-painel="tabela" hidden>${this.tabela()}</div>
        <div class="ppr-painel" data-painel="transicoes" hidden>${this.transicoes()}</div>
        <div class="ppr-painel" data-painel="animacoes" hidden>${this.animacoes()}</div>
        <div class="ppr-painel" data-painel="design" hidden>${this.design()}</div>
        <div class="ppr-painel" data-painel="exibir" hidden>${this.exibir()}</div>
      </div>`;

    // os seletores de fonte/tamanho abrem a lista do app (não a cinza do sistema)
    melhorarSelects(host);

    // os botões da fita não roubam o foco (a seleção do texto precisa continuar viva)
    host.addEventListener("mousedown", (e) => {
      const t = e.target as HTMLElement;
      if (t.closest("button") && !t.closest("select, input, .sel-face")) e.preventDefault();
    });
    host.addEventListener("click", (e) => this.aoClicar(e));
    // o duplo clique no "Copiar formatação" arma o modo fixo (como no Pincel de Formatação do Word)
    host.addEventListener("dblclick", (e) => {
      if (!(e.target as HTMLElement).closest('[data-cmd="copiar-formato"]')) return;
      this.hooks.run("copiar-formato", "fixo");
    });
    host.addEventListener("change", (e) => this.aoMudar(e));
    host.addEventListener("keydown", (e) => {
      const t = e.target as HTMLElement;
      if (e.key === "Enter" && t.matches("input[data-in]")) (t as HTMLInputElement).blur();
    });
  }

  // ------------------------------------------------------------------
  // conteúdo das abas
  // ------------------------------------------------------------------

  private inicio(): string {
    return [
      grupo(
        "Área de Transferência",
        `${grande("colar", ic("i-paste"), "Colar", "Colar (Ctrl+V)")}
         <div class="ppr-col">
           ${pequeno("recortar", ic("i-cut"), "Recortar", "Recortar (Ctrl+X)")}
           ${pequeno("copiar", ic("i-copy"), "Copiar", "Copiar (Ctrl+C)")}
           ${pequeno("duplicar", ic("i-dup"), "Duplicar", "Duplicar a forma (Ctrl+D)")}
         </div>
         <div class="ppr-col">
           ${pequeno("desfazer", ic("i-undo"), "Desfazer", "Desfazer (Ctrl+Z)")}
           ${pequeno("refazer", ic("i-redo"), "Refazer", "Refazer (Ctrl+Y)")}
           ${pequeno("copiar-formato", ic("i-brush"), "Copiar formatação", "Copiar a formatação da forma escolhida: clique na origem e depois na forma que deve vesti-la (duplo clique deixa o pincel ligado; Esc sai)")}
         </div>`
      ),
      grupo(
        "Fonte",
        `<div class="ppr-linhas">
           <div class="ppr-linha">
             <select class="ppr-sel fonte" data-sel="font" data-editavel title="Fonte" aria-label="Fonte"></select>
             <select class="ppr-sel tam" data-sel="size" data-editavel data-num data-min="1" data-max="4096" title="Tamanho da fonte" aria-label="Tamanho da fonte"></select>
             ${btn("maior", "A<sup>▲</sup>", "Aumentar fonte (Ctrl+Shift+>)", "fmt")}
             ${btn("menor", "A<sub>▼</sub>", "Diminuir fonte (Ctrl+Shift+<)", "fmt")}
           </div>
           <div class="ppr-linha">
             ${btn("negrito", "<b>N</b>", "Negrito (Ctrl+B)", "fmt")}
             ${btn("italico", "<i>I</i>", "Itálico (Ctrl+I)", "fmt")}
             ${btn("sublinhado", "<u>S</u>", "Sublinhado (Ctrl+U)", "fmt")}
             ${btn("tachado", "<s>ab</s>", "Tachado", "fmt")}
             ${btn("cor-texto", `<span class="ppr-a">A</span><span class="ppr-barra" data-barra="cor-texto"></span>`, "Cor da fonte", "fmt cor", true)}
             ${btn("marca-texto", `<span class="ppr-a ppr-hl">ab</span><span class="ppr-barra" data-barra="marca-texto"></span>`, "Marca-texto", "fmt cor", true)}
           </div>
           <div class="ppr-linha">
             ${btn("sobrescrito", "x<sup>2</sup>", "Sobrescrito", "fmt")}
             ${btn("subscrito", "x<sub>2</sub>", "Subscrito", "fmt")}
             ${btn("versalete", `A<span class="ppr-va">bc</span>`, "Versalete (maiúsculas pequenas)", "fmt")}
             ${btn("caixa", "Aa", "Mudar a caixa do texto: MAIÚSCULAS, minúsculas ou Primeira Letra", "fmt", true)}
             ${btn("espacamento", `<span class="ppr-seta">A↔</span>`, "Espaçamento entre caracteres", "fmt", true)}
             ${btn("limpar-formatacao", ic("i-clear-format"), "Limpar formatação", "fmt")}
           </div>
         </div>`
      ),
      grupo(
        "Parágrafo",
        `<div class="ppr-linhas">
           <div class="ppr-linha">
             ${btn("marcadores", ic("i-list"), "Marcadores", "fmt")}
             ${btn("numeracao", ic("i-list-num"), "Numeração", "fmt")}
             ${btn("recuo-menos", ic("i-outdent"), "Diminuir recuo", "fmt")}
             ${btn("recuo-mais", ic("i-indent"), "Aumentar recuo", "fmt")}
             ${btn("espaco", ic("i-line-spacing"), "Espaçamento entre linhas", "fmt", true)}
           </div>
           <div class="ppr-linha">
             ${btn("alinhar-esquerda", ic("i-align-left"), "Alinhar à esquerda (Ctrl+L)", "fmt")}
             ${btn("alinhar-centro", ic("i-align-center"), "Centralizar (Ctrl+E)", "fmt")}
             ${btn("alinhar-direita", ic("i-align-right"), "Alinhar à direita (Ctrl+R)", "fmt")}
             ${btn("alinhar-justificado", ic("i-align-justify"), "Justificar (Ctrl+J)", "fmt")}
             <span class="ppr-sep"></span>
             ${btn("v-topo", `<span class="ppr-v">⤒</span>`, "Alinhar o texto ao topo", "fmt")}
             ${btn("v-meio", `<span class="ppr-v">↕</span>`, "Centralizar o texto na vertical", "fmt")}
             ${btn("v-base", `<span class="ppr-v">⤓</span>`, "Alinhar o texto à base", "fmt")}
           </div>
         </div>`
      ),
      // Lâminas vêm DEPOIS do texto, de propósito (pedido do usuário, com print): Fonte e Parágrafo
      // ocupam o lugar que era dela — o que se usa o tempo todo fica à frente, sem rolar a fita.
      // O "Nova lâmina" saiu daqui (pedido): quem cria é o card do fim da faixa, que faz as duas
      // coisas — a prévia cria com o último layout e o rótulo abre a galeria.
      grupo(
        "Lâminas",
        `<div class="ppr-col">
           ${pequeno("layout", ic("i-columns"), "Layout", "Layout da lâmina", true)}
           ${pequeno("slide-dup", ic("i-dup"), "Duplicar", "Duplicar lâmina")}
           ${pequeno("slide-del", ic("i-trash"), "Excluir", "Excluir lâmina")}
         </div>
         <div class="ppr-col">
           ${pequeno("slide-nome", ic("i-text"), "Renomear", "Dar um nome à lâmina (aparece na miniatura e no .pptx)")}
           ${pequeno("slide-ocultar", ic("i-eye"), "Ocultar", "Ocultar ou mostrar a lâmina na apresentação")}
           ${pequeno("slide-reset", ic("i-replace"), "Redefinir", "Redefinir a lâmina: tira as formas próprias e reaplica as caixas do layout")}
         </div>`
      ),
      grupo(
        "Desenho",
        `${grande("galeria", `<span class="ppr-gal-ic">${iconeDeForma(GALERIA[6], 30)}</span>`, "Formas", "Inserir uma forma", true)}
         <div class="ppr-col">
           ${pequeno("preench", ic("i-bucket"), "Preenchimento", "Preenchimento da forma", true)}
           ${pequeno("contorno", ic("i-border"), "Contorno", "Contorno da forma", true)}
           ${pequeno("sombra", `<span class="ppr-sombra-ic"></span>`, "Efeitos", "Sombra e efeitos", true)}
         </div>
         <div class="ppr-col">
           ${pequeno("ordem", `<span class="ppr-seta">⧉</span>`, "Organizar", "Ordem, alinhamento, grupo e giro", true)}
         </div>`
      ),
      // Ideias de design: no DeckCraft o atalho mora na Página Inicial, mas o Office o tem na aba
      // Design (grupo Designer) — que é onde ele passou a viver. Desde a fusão os dois são um só
      // (**Composição**, um botão só), no lugar do grupo do Office — ver `design()`.
    ].join("");
  }

  private inserir(): string {
    return [
      // o "Nova lâmina" saiu daqui também: o card do fim da faixa é quem cria (e abre a galeria)
      grupo(
        "Lâminas",
        `${grande("slide-dup", ic("i-dup"), "Duplicar", "Duplicar a lâmina atual (a cópia entra logo depois dela)")}`
      ),
      grupo("Tabelas", `${grande("tabela-grade", ic("i-grid"), "Tabela", "Inserir uma tabela", true)}`),
      grupo("Gráficos", `${grande("grafico-menu", ic("i-chart"), "Gráfico", "Inserir um gráfico (colunas, barras, linhas, pizza…)", true)}`),
      grupo(
        "Texto",
        `${grande("ferramenta:texto", ic("i-doc"), "Caixa de texto", "Desenhe uma caixa de texto na lâmina")}`
      ),
      grupo(
        "Ilustrações",
        `${grande("galeria", `<span class="ppr-gal-ic">${iconeDeForma(GALERIA[7], 30)}</span>`, "Formas", "Escolha uma forma e desenhe na lâmina", true)}
         ${grande("image", ic("i-image"), "Imagem", "Inserir imagem do computador")}`
      ),
      grupo(
        "Diagrama",
        `${grande("mermaid-fluxo", ic("i-flow"), "Fluxo do Mermaid", "Cole um flowchart e o app cria os cartões ligados por conectores de cantos suaves")}
         ${grande("conectar", ic("i-link"), "Conectar", "Ligue duas formas: clique na bolinha da borda de uma e na da outra (Esc sai)")}`
      ),
      grupo(
        "Mídia",
        `<div class="ppr-col">
           ${pequeno("midia:video", ic("i-video"), "Vídeo", "Inserir um vídeo do computador")}
           ${pequeno("midia:audio", ic("i-audio"), "Áudio", "Inserir um áudio do computador")}
         </div>`
      ),
      grupo(
        "Linhas",
        `<div class="ppr-col">
           ${pequeno("forma-rapida:0", `<span class="ppr-gal-ic">${iconeDeForma(GALERIA[0], 18)}</span>`, "Linha", "Desenhar uma linha")}
           ${pequeno("forma-rapida:1", `<span class="ppr-gal-ic">${iconeDeForma(GALERIA[1], 18)}</span>`, "Seta", "Desenhar uma seta")}
           ${pequeno("forma-rapida:3", `<span class="ppr-gal-ic">${iconeDeForma(GALERIA[3], 18)}</span>`, "Conector", "Desenhar um conector angular")}
         </div>`
      ),
    ].join("");
  }

  /**
   * Aba Desenhar: tudo o que é traço num lugar só — as canetas (Draw e Curva, que saíram do
   * Inserir), o pincel (cor, espessura, Livre/Pontos e Assistente, o MESMO estado da barrinha
   * flutuante) e as formas para desenhar arrastando. O diagrama fica como atalho.
   */
  private desenhar(): string {
    return [
      grupo(
        "Canetas",
        `${grande("desenho", ic("i-draw"), "Draw", "Desenho à mão: rabisque na lâmina (Esc sai)")}
         ${grande("ferramenta:curva", ic("i-curve"), "Curva", "Curva por pontos: clique para marcar os pontos (duplo-clique termina, clique no início fecha)")}
         ${grande("pincel-tipo:marca", ic("i-mark"), "Marca-texto", "Marca-texto de tinta: traço largo e translúcido para destacar (não vira forma)")}
         ${grande("borracha", ic("i-trash"), "Borracha", "Borracha: clique ou arraste sobre os traços de tinta para apagar (Esc sai)")}`
      ),
      grupo(
        "Converter",
        `${grande("tinta-forma", ic("i-refresh"), "Converter em forma", "Converte o traço de tinta escolhido na forma que o assistente reconhecer")}`
      ),
      grupo(
        "Estúdio",
        `${grande("estudio", `<span class="ppr-estudio-ic"></span>`, "Isolar", "Isolar a box escolhida: edite só ela, num ambiente separado (Esc sai)")}`
      ),
      grupo(
        "Traço",
        `${btn("pincel:cor", `${ic("i-draw")}<span class="ppr-barra" data-barra="pincel-cor"></span>`, "Cor do traço", "fmt cor", true)}
         <div class="ppr-col">
           ${btn("pincel:w:1", "1", "Traço fino (1 pt)", "txt")}
           ${btn("pincel:w:2", "2", "Traço médio (2 pt)", "txt")}
           ${btn("pincel:w:4", "4", "Traço grosso (4 pt)", "txt")}
           ${btn("pincel:w:8", "8", "Traço bem grosso (8 pt)", "txt")}
         </div>
         <div class="ppr-col">
           ${btn("pincel:modo:livre", "Livre", "Traço livre: arraste para rabiscar", "txt")}
           ${btn("pincel:modo:pontos", "Pontos", "Curva por pontos: clique para marcar pontos de parada", "txt")}
         </div>
         ${grande("pincel-assistente", ic("i-spark"), "Assistente", "Assistente: reconhece o traço e ajusta a forma (retângulo, retângulo arredondado, círculo, triângulo, linha e seta)")}`
      ),
      grupo(
        "Formas",
        `${grande("galeria", `<span class="ppr-gal-ic">${iconeDeForma(GALERIA[5], 30)}</span>`, "Formas", "Escolha uma forma e desenhe na lâmina", true)}
         <div class="ppr-col">
           ${pequeno("forma-rapida:5", `<span class="ppr-gal-ic">${iconeDeForma(GALERIA[5], 18)}</span>`, "Retângulo", "Desenhar um retângulo")}
           ${pequeno("forma-rapida:6", `<span class="ppr-gal-ic">${iconeDeForma(GALERIA[6], 18)}</span>`, "Retângulo arredondado", "Desenhar um retângulo arredondado")}
           ${pequeno("forma-rapida:12", `<span class="ppr-gal-ic">${iconeDeForma(GALERIA[12], 18)}</span>`, "Elipse", "Desenhar uma elipse")}
           ${pequeno("forma-rapida:13", `<span class="ppr-gal-ic">${iconeDeForma(GALERIA[13], 18)}</span>`, "Triângulo", "Desenhar um triângulo")}
         </div>
         <div class="ppr-col">
           ${pequeno("forma-rapida:0", `<span class="ppr-gal-ic">${iconeDeForma(GALERIA[0], 18)}</span>`, "Linha", "Desenhar uma linha")}
           ${pequeno("forma-rapida:1", `<span class="ppr-gal-ic">${iconeDeForma(GALERIA[1], 18)}</span>`, "Seta", "Desenhar uma seta")}
           ${pequeno("forma-rapida:3", `<span class="ppr-gal-ic">${iconeDeForma(GALERIA[3], 18)}</span>`, "Conector", "Desenhar um conector angular")}
         </div>`
      ),
      grupo(
        "Diagrama",
        `${grande("mermaid-fluxo", ic("i-flow"), "Fluxo do Mermaid", "Cole um flowchart e o app cria os cartões ligados por conectores de cantos suaves")}
         ${grande("conectar", ic("i-link"), "Conectar", "Ligue duas formas: clique na bolinha da borda de uma e na da outra (Esc sai)")}`
      ),
    ].join("");
  }

  private tabela(): string {
    return [
      grupo(
        "Linhas e Colunas",
        `<div class="ppr-col">
           ${pequeno("tabela-linha-acima", ic("i-table-row-add"), "Inserir acima", "Inserir linha acima")}
           ${pequeno("tabela-linha-abaixo", ic("i-table-row-add"), "Inserir abaixo", "Inserir linha abaixo")}
           ${pequeno("tabela-del-linha", ic("i-table-row-del"), "Excluir linha", "Excluir as linhas escolhidas")}
         </div>
         <div class="ppr-col">
           ${pequeno("tabela-col-esquerda", ic("i-table-col-add"), "Inserir à esquerda", "Inserir coluna à esquerda")}
           ${pequeno("tabela-col-direita", ic("i-table-col-add"), "Inserir à direita", "Inserir coluna à direita")}
           ${pequeno("tabela-del-coluna", ic("i-table-col-del"), "Excluir coluna", "Excluir as colunas escolhidas")}
         </div>`
      ),
      grupo(
        "Mesclar",
        `<div class="ppr-col">
           ${pequeno("tabela-mesclar", ic("i-table-merge"), "Mesclar células", "Juntar as células escolhidas em uma")}
           ${pequeno("tabela-dividir", ic("i-table-split"), "Dividir célula", "Desfazer a mesclagem")}
         </div>`
      ),
      grupo(
        "Estilos de Tabela",
        `<div class="ppr-col">
           ${pequeno("tabela-estilos", "", "Estilos", "Estilos prontos de tabela", true)}
           ${pequeno("tabela-bordas-menu", ic("i-border"), "Bordas", "Bordas das células escolhidas", true)}
           ${pequeno("preench", ic("i-bucket"), "Sombreamento", "Cor de fundo das células escolhidas", true)}
         </div>
         <div class="ppr-col">
           <label class="ppr-opc"><input type="checkbox" data-opc="cabecalho"> Linha de cabeçalho</label>
           <label class="ppr-opc"><input type="checkbox" data-opc="faixas"> Linhas em faixas</label>
           <label class="ppr-opc"><input type="checkbox" data-opc="primeiraColuna"> Primeira coluna</label>
         </div>`
      ),
      grupo(
        "Alinhamento",
        `<div class="ppr-col">
           ${pequeno("v-topo", "", "Alinhar em cima", "Alinhar o texto ao topo da célula")}
           ${pequeno("v-meio", "", "Centralizar", "Centralizar o texto verticalmente")}
           ${pequeno("v-base", "", "Alinhar embaixo", "Alinhar o texto à base da célula")}
         </div>`
      ),
      grupo("Tabela", `${grande("tabela-excluir", ic("i-trash"), "Excluir tabela", "Excluir a tabela inteira")}`),
    ].join("");
  }

  private formato(): string {
    return [
      grupo(
        "Estilos de Forma",
        `<div class="ppr-estilos">${ESTILOS_RAPIDOS.map((e) => `<button type="button" class="ppr-estilo" data-cmd="${e.cmd}" title="${e.nome}" aria-label="${e.nome}"><span class="ppr-estilo-${e.cmd.slice(7)}"></span></button>`).join("")}</div>`
      ),
      grupo(
        "Estilos de Cor",
        `${grande("estilos", ic("i-brush"), "Estilos", "Gradientes bonitos: escolha uma família e a forma ganha a rampa, o brilho, o contorno e a cor do texto casados", true)}`
      ),
      grupo(
        "Preenchimento e Contorno",
        `<div class="ppr-col">
           ${pequeno("preench", ic("i-bucket"), "Preenchimento", "Preenchimento da forma", true)}
           ${pequeno("contorno", ic("i-border"), "Contorno", "Contorno da forma", true)}
           ${pequeno("sombra", `<span class="ppr-sombra-ic"></span>`, "Efeitos", "Sombra e efeitos", true)}
         </div>`
      ),
      grupo(
        "Organizar",
        `<div class="ppr-col">
           ${pequeno("z-topo", `<span class="ppr-seta">⤒</span>`, "Trazer para a frente", "Trazer para a frente de tudo")}
           ${pequeno("z-fundo", `<span class="ppr-seta">⤓</span>`, "Enviar para trás", "Enviar para trás de tudo")}
           ${pequeno("agrupar", `<span class="ppr-seta">⧈</span>`, "Agrupar", "Agrupar (Ctrl+G)")}
         </div>
         <div class="ppr-col">
           ${pequeno("z-frente", `<span class="ppr-seta">▲</span>`, "Avançar", "Subir uma camada")}
           ${pequeno("z-tras", `<span class="ppr-seta">▼</span>`, "Recuar", "Descer uma camada")}
           ${pequeno("desagrupar", `<span class="ppr-seta">⧉</span>`, "Desagrupar", "Desagrupar (Ctrl+Shift+G)")}
         </div>
         <div class="ppr-col">
           ${pequeno("ordem", `<span class="ppr-seta">⇄</span>`, "Alinhar e girar", "Alinhar, distribuir, girar e espelhar", true)}
         </div>`
      ),
      grupo(
        "Tamanho",
        `<div class="ppr-linhas">
           <label class="ppr-medida">Altura <input type="number" step="0.1" min="0.1" data-in="altura" aria-label="Altura em cm"> cm</label>
           <label class="ppr-medida">Largura <input type="number" step="0.1" min="0.1" data-in="largura" aria-label="Largura em cm"> cm</label>
         </div>`
      ),
    ].join("");
  }

  /** Aba Transições: galeria dos efeitos, direção, duração, aplicar a todas e prévia no palco. */
  private transicoes(): string {
    const galeria = TIPOS_TRANSICAO.map(
      (t) =>
        `<button type="button" class="ppr-trans-item" data-cmd="transicao:${t}" title="${DICAS_TRANSICAO[t]}" aria-label="${ROTULOS_TRANSICAO[t]}">${previaTransicao(t)}<span class="ppr-trans-nome">${ROTULOS_TRANSICAO[t]}</span></button>`
    ).join("");
    const direcoes = DIRECOES_TRANSICAO.map((d) => btn(`transicao-direcao:${d}`, `<span class="ppr-trans-dir">${FLECHAS_DIRECAO[d]}</span>`, `${ROTULOS_DIRECAO[d]}: ${DICAS_DIRECAO[d]}`, "trans-dir")).join("");
    const duracoes = DURACOES_TRANSICAO.map((d) => btn(`transicao-duracao:${d.valor}`, d.rotulo, `Duração da transição: ${d.rotulo}`, "fmt")).join("");
    return [
      grupo(
        "Transição",
        `<div class="ppr-trans">${galeria}</div>
         <span class="ppr-trans-nota" data-trans-nota hidden title="A transição deste arquivo não é representada pelo app: ela volta como veio na exportação">Original preservada</span>`
      ),
      grupo("Direção", `<div class="ppr-linha">${direcoes}</div>`),
      grupo("Duração", `<div class="ppr-linha">${duracoes}<span class="ppr-trans-dur" data-trans-dur></span></div>`),
      grupo(
        "Aplicar",
        `${grande("transicao-todas", ic("i-addons"), "Aplicar a todas", "Aplicar esta transição a todas as lâminas")}${grande("transicao-previa", ic("i-eye"), "Prévia", "Reproduzir a transição nesta lâmina, sem entrar no F5")}
         <span class="ppr-trans-nota">Transição é da lâmina — para animar uma forma escolhida, use a aba Animações.</span>`
      ),
    ].join("");
  }

  /**
   * Aba Animações: efeito por forma (entrada/ênfase/saída/trajetória), início, direção e tempo
   * (duração e atraso), build por parágrafo, posição na ordem, prévia e o painel de animação.
   *
   * A ordem dos grupos é a ordem em que se pensa a animação: primeiro QUAL efeito, depois COMO
   * ele começa (início e direção), QUANTO tempo leva, e por último mexer na sequência dela na
   * lâmina (ordem) e ver tocar (Animar). As escolhas de cada linha vão num controle segmentado —
   * a fila de botões soltos de antes não dizia que eles eram alternativas entre si.
   */
  private animacoes(): string {
    // a fita mostra as mais usadas; o cartão "Mais" abre a galeria completa por classe
    const rapidas: AnimacaoTipo[] = ["aparecer", "surgir", "pulsar", "desaparecer", "sumir", "trajetoria"];
    const galeria = rapidas.map((t) => cartaoAnimacao(t)).join("") + cartaoMaisAnimacoes();
    const seg = (extra: string, itens: string) => `<div class="ppr-seg${extra ? ` ${extra}` : ""}">${itens}</div>`;
    const segBtn = (cmd: string, conteudo: string, titulo: string, extra = "") => btn(cmd, conteudo, titulo, `seg${extra ? ` ${extra}` : ""}`);
    const inicios = seg("", INICIOS_ANIMACAO.map((i) => segBtn(`animacao-inicio:${i}`, ROTULOS_INICIO[i], `Início do efeito — ${DICAS_INICIO[i]}`)).join(""));
    const direcoes = seg("", DIRECOES_ANIMACAO.map((d) => segBtn(`animacao-direcao:${d}`, `<span class="ppr-trans-dir">${FLECHAS_DIRECAO[d]}</span>`, `Direção do efeito — ${ROTULOS_DIRECAO[d]}: ${DICAS_DIRECAO[d]}`)).join(""));
    const duracoes = seg("", DURACOES_ANIMACAO.map((d) => segBtn(`animacao-duracao:${d.valor}`, d.rotulo, `Duração do efeito: ${d.rotulo}`)).join(""));
    const atrasos = seg("", ATRASOS_ANIMACAO.map((d) => segBtn(`animacao-atraso:${d.valor}`, d.rotulo, d.valor === 0 ? "Sem atraso: o efeito começa na hora" : `Atraso do efeito: ${d.rotulo}`)).join(""));
    return [
      grupo(
        "Animação",
        `<div class="ppr-anim-wrap"><div class="ppr-trans ppr-anim">${galeria}</div>
         <span class="ppr-trans-nota">A animação vale para as formas escolhidas; a lâmina é a aba Transições.</span>
         <span class="ppr-trans-nota" data-anim-nota hidden title="As animações deste arquivo não são representadas pelo app: voltam como vieram na exportação">Original preservada</span></div>`
      ),
      grupo("Início", `<div class="ppr-linha">${inicios}</div>`),
      grupo("Direção", `<div class="ppr-linha">${direcoes}</div>`),
      grupo(
        "Tempo",
        `<div class="ppr-linhas ppr-tempo">
           <div class="ppr-linha"><span class="ppr-mini">Duração</span>${duracoes}<span class="ppr-trans-dur" data-anim-dur></span></div>
           <div class="ppr-linha"><span class="ppr-mini">Atraso</span>${atrasos}<span class="ppr-trans-dur" data-anim-atraso></span></div>
         </div>`
      ),
      grupo(
        "Texto",
        `<label class="ppr-chip" title="Cada parágrafo do texto entra num passo próprio (um clique por parágrafo; 'com'/'depois' encadeiam)"><input type="checkbox" data-anim-pp><span class="ppr-chip-marca" aria-hidden="true"></span><span>Por parágrafo</span></label>`
      ),
      grupo(
        "Ordem",
        `<div class="ppr-linha">
           <span class="ppr-ordem" data-anim-pos>–</span>
           ${seg("ppr-seg-v", `${segBtn("animacao-subir", "↑", "Mover o efeito da forma selecionada para cima na ordem")}${segBtn("animacao-descer", "↓", "Mover o efeito da forma selecionada para baixo na ordem")}`)}
         </div>`
      ),
      grupo(
        "Animar",
        `${grande("animacao-previa", ic("i-eye"), "Prévia", "Reproduzir as animações desta lâmina, sem entrar no F5")}
         <div class="ppr-col">
           ${pequeno("animacao-painel", ic("i-sidebar"), "Painel", "Abrir o painel de animação: a lista das animações da lâmina, na ordem em que tocam")}
           ${pequeno("animacao-remover", ic("i-trash"), "Remover", "Tirar a animação da forma selecionada")}
         </div>`
      ),
    ].join("");
  }

  private design(): string {
    // A aba segue os quatro blocos do Office (Temas · Variantes · Personalizar · Designer), mas
    // com a cara do app: os cartões, os ícones e os textos são os daqui — a paleta das Variantes,
    // por exemplo, é um ícone próprio com as seis cores das famílias, não a arte do Office.
    return [
      grupo("Temas", `${grande("modelo", ic("i-addons"), "Temas", "Temas e modelos de apresentação (fundo, cores e fonte) — aplicam na apresentação inteira", true)}`),
      grupo("Variantes", `${grande("variantes", `<span class="ppr-variantes-ic"></span>`, "Variantes", "Outras famílias de cor para a apresentação — cada cartão mostra esta lâmina")}`),
      grupo(
        "Personalizar",
        `${grande("fundo", ic("i-bucket"), "Formatar fundo", "Cor, gradiente ou imagem de fundo da lâmina", true)}${grande("layout", ic("i-columns"), "Layout", "Layout da lâmina", true)}${grande("tamanho-lamina", `<span class="ppr-tamanho-ic"></span>`, "Tamanho", "Proporção da lâmina: 16:9 ou 4:3", true)}`
      ),
      grupo("Composição", `${grande("composicao", ic("i-spark"), "Composição", "Sugestões para a apresentação — a arrumação desta lâmina e o visual do deck na mesma prévia, geradas no seu computador")}`),
    ].join("");
  }

  private exibir(): string {
    return [
      grupo(
        "Apresentar",
        `${grande("present", ic("i-eye"), "Apresentar", "Modo apresentação (F5)")}${grande("notes", ic("i-doc"), "Notas", "Focar o painel de notas")}`
      ),
      grupo(
        "Zoom",
        `<div class="ppr-linha">
           ${btn("zoom-out", "−", "Reduzir zoom", "fmt")}
           <span class="ppr-zoom" data-zoomtxt>100%</span>
           ${btn("zoom-in", "+", "Ampliar zoom", "fmt")}
           ${btn("zoom-reset", "100%", "Zoom normal", "fmt")}
         </div>`
      ),
      grupo(
        "Mostrar",
        `<div class="ppr-col">
           ${pequeno("painel-lateral", ic("i-sidebar"), "Painel Formatar", "Mostrar ou esconder o painel Formatar/Notas (à direita)")}
           ${pequeno("alt-faixa", ic("i-columns"), "Faixa vertical", "Mostrar a faixa de lâminas na lateral (vertical) ou de volta no topo (horizontal)")}
           ${pequeno("alt-encaixe", `<span class="ppr-seta">✓</span>`, "Guias de encaixe", "Ligar/desligar o encaixe nas guias")}
         </div>
         <div class="ppr-col">
           ${pequeno("alt-grade", `<span class="ppr-seta">▦</span>`, "Grade", "Mostrar a grade")}
           ${pequeno("alt-fixas", `<span class="ppr-seta">✎</span>`, "Editar elementos do layout", "Permite selecionar e mexer nas decorações que vêm do layout")}
         </div>`
      ),
    ].join("");
  }

  // ------------------------------------------------------------------
  // eventos
  // ------------------------------------------------------------------

  private irParaAba(id: string): void {
    this.aba = id;
    for (const b of this.el.querySelectorAll<HTMLElement>("[data-aba]")) b.classList.toggle("on", b.dataset.aba === id);
    for (const p of this.el.querySelectorAll<HTMLElement>("[data-painel]")) p.hidden = p.dataset.painel !== id;
    this.atualizar();
  }

  private aoClicar(e: MouseEvent): void {
    const t = e.target as HTMLElement;
    const aba = t.closest<HTMLElement>("[data-aba]");
    if (aba) {
      this.irParaAba(aba.dataset.aba!);
      return;
    }
    const b = t.closest<HTMLElement>("[data-cmd]");
    if (!b || (b as HTMLButtonElement).disabled) return;
    const cmd = b.dataset.cmd!;
    // O MESMO botão de novo recolhe o que ele abriu: a galeria de Formas, o Template, a paleta de
    // cores, as bordas… (quem abriu foi ele — o popup guarda a âncora). Sem isto o clique no
    // próprio botão é ignorado pelo "fecha ao clicar fora" e o comando roda de novo, reabrindo.
    if (ancoraDoPopup() === b) {
      fecharPopup();
      return;
    }
    if (b.dataset.menu) {
      this.abrirMenu(cmd, b);
      return;
    }
    fecharPopup();
    if (cmd.startsWith("layout:")) this.hooks.run("layout", cmd.slice(7));
    else if (cmd.startsWith("forma-rapida:")) this.hooks.run("forma-inserir", cmd.slice(13));
    else if (cmd.startsWith("ferramenta:")) this.hooks.run("ferramenta", cmd.slice(11));
    else if (cmd.startsWith("pincel:w:")) this.hooks.run("pincel-w", cmd.slice(9));
    else if (cmd.startsWith("pincel:modo:")) this.hooks.run("pincel-modo", cmd.slice(12));
    else if (cmd.startsWith("pincel-tipo:")) this.hooks.run("pincel-tipo", cmd.slice(12));
    else if (cmd.startsWith("midia:")) this.hooks.run("midia", cmd.slice(6));
    else if (cmd.startsWith("estilo-cor:")) this.hooks.run("estilo-cor", cmd.slice(11));
    else if (cmd.startsWith("estilo:")) this.hooks.run("estilo", cmd.slice(7));
    else if (cmd.startsWith("transicao-direcao:")) this.hooks.run("transicao-direcao", cmd.slice(18));
    else if (cmd.startsWith("transicao-duracao:")) this.hooks.run("transicao-duracao", cmd.slice(18));
    else if (cmd.startsWith("transicao:")) this.hooks.run("transicao", cmd.slice(10));
    else if (cmd.startsWith("animacao-inicio:")) this.hooks.run("animacao-inicio", cmd.slice(16));
    else if (cmd.startsWith("animacao-duracao:")) this.hooks.run("animacao-duracao", cmd.slice(17));
    else if (cmd.startsWith("animacao-atraso:")) this.hooks.run("animacao-atraso", cmd.slice(16));
    else if (cmd.startsWith("animacao-direcao:")) this.hooks.run("animacao-direcao", cmd.slice(17));
    else if (cmd.startsWith("animacao:")) this.hooks.run("animacao", cmd.slice(9));
    else this.hooks.run(cmd);
  }

  private aoMudar(e: Event): void {
    const t = e.target as HTMLElement;
    const pp = t.closest<HTMLInputElement>("input[data-anim-pp]");
    if (pp) {
      this.hooks.run("animacao-por-paragrafo", pp.checked ? "1" : "0");
      return;
    }
    const opc = t.closest<HTMLInputElement>("input[data-opc]");
    if (opc) {
      const k = opc.dataset.opc!;
      this.hooks.run(k === "cabecalho" ? "tabela-cabecalho" : k === "faixas" ? "tabela-faixas" : "tabela-primeira-coluna", opc.checked ? "1" : "0");
      this.hooks.run("tabela-reaplicar");
      return;
    }
    const sel = t.closest<HTMLSelectElement>("[data-sel]");
    if (sel) {
      this.hooks.run(sel.dataset.sel === "font" ? "fonte" : "tamanho", sel.value);
      return;
    }
    const inp = t.closest<HTMLInputElement>("input[data-in]");
    if (inp) {
      const v = parseFloat(inp.value.replace(",", "."));
      if (Number.isFinite(v) && v > 0) this.hooks.run(inp.dataset.in === "altura" ? "tamanho-h" : "tamanho-w", String(cmParaPt(v)));
    }
  }

  private abrirMenu(cmd: string, ancora: HTMLElement): void {
    const est = this.hooks.estado();
    const run = (c: string, v?: string) => this.hooks.run(c, v);
    switch (cmd) {
      case "galeria":
        abrirGaleria(ancora, (item) => run("forma-inserir", String(GALERIA.indexOf(item))));
        return;
      case "estilos":
        this.menuEstilos(ancora);
        return;
      case "modelo":
        abrirModelos(ancora, (m) => run("modelo", m.id), {
          criar: (nome) => run("modelo-criar", nome),
          excluir: (id) => run("modelo-excluir", id),
        });
        return;
      case "animacao-mais": {
        // galeria completa por classe (a fita mostra só as mais usadas)
        const classes: [string, AnimacaoTipo[]][] = [
          ["Entrada", TIPOS_ANIMACAO.filter((t) => CLASSE_ANIMACAO[t] === "entrada")],
          ["Ênfase", TIPOS_ANIMACAO.filter((t) => CLASSE_ANIMACAO[t] === "enfase")],
          ["Saída", TIPOS_ANIMACAO.filter((t) => CLASSE_ANIMACAO[t] === "saida")],
          ["Trajetórias", TIPOS_ANIMACAO.filter((t) => CLASSE_ANIMACAO[t] === "trajetoria")],
        ];
        // o alvo do efeito vai no cabeçalho: o popup tapa a seleção, então ele lembra em QUEM o efeito vai cair
        const alvo = est.forma?.name?.trim();
        const nota = alvo ? `aplicar na forma <b>${escapeHtml(alvo)}</b>` : "selecione uma forma para animar";
        const atual = est.animacao?.tipo;
        const html =
          `<div class="pp-pop-rot">Animações<span class="pp-pop-dica">${nota}</span></div>` +
          classes
            .map(([nome, tipos]) => `<div class="pp-pop-t">${nome}</div><div class="ppr-anim-gal">${tipos.map((t) => cartaoAnimacao(t, t === atual ? "on" : "")).join("")}</div>`)
            .join("");
        const el = abrirPopup(ancora, html, { classe: "pp-pop-menu pp-pop-anim" });
        el.addEventListener("click", (ev) => {
          const b = (ev.target as HTMLElement).closest<HTMLElement>("[data-cmd]");
          if (!b) return;
          fecharPopup();
          run("animacao", b.dataset.cmd!.slice("animacao:".length));
        });
        return;
      }
      case "tabela-grade": {
        const N = 8;
        let cel = "";
        for (let r = 1; r <= 6; r++) for (let c = 1; c <= N; c++) cel += `<span class="pp-tg" data-tg="${r},${c}"></span>`;
        const el = abrirPopup(ancora, `<div class="pp-tg-rot">Inserir tabela</div><div class="pp-tg-grade" style="grid-template-columns:repeat(${N},16px)">${cel}</div>`, { classe: "pp-pop-menu" });
        const rot = el.querySelector<HTMLElement>(".pp-tg-rot")!;
        el.addEventListener("mouseover", (ev) => {
          const t = (ev.target as HTMLElement).closest<HTMLElement>("[data-tg]");
          if (!t) return;
          const [rr, cc] = t.dataset.tg!.split(",").map(Number);
          el.querySelectorAll<HTMLElement>("[data-tg]").forEach((x) => {
            const [r, c] = x.dataset.tg!.split(",").map(Number);
            x.classList.toggle("on", r <= rr && c <= cc);
          });
          rot.textContent = `${rr} × ${cc} (linhas × colunas)`;
        });
        el.addEventListener("click", (ev) => {
          const t = (ev.target as HTMLElement).closest<HTMLElement>("[data-tg]");
          if (!t) return;
          fecharPopup();
          run("tabela-inserir", t.dataset.tg);
        });
        return;
      }
      case "grafico-menu": {
        const el = abrirPopup(
          ancora,
          `<div class="pp-pop-rot">Inserir gráfico</div>` +
            GRAFICO_TIPOS.map((t) => `<button type="button" class="pp-pop-item" data-graf="${t.id}">${t.nome}</button>`).join(""),
          { classe: "pp-pop-menu" }
        );
        el.addEventListener("click", (ev) => {
          const b = (ev.target as HTMLElement).closest<HTMLElement>("[data-graf]");
          if (!b) return;
          fecharPopup();
          run("grafico-inserir", b.dataset.graf);
        });
        return;
      }
      case "tabela-estilos": {
        const el = abrirPopup(ancora, (Object.keys(ROTULOS_PRESET) as PresetTabela[]).map((k) => `<button type="button" class="pp-pop-item" data-preset="${k}">${ROTULOS_PRESET[k]}</button>`).join(""), { classe: "pp-pop-menu" });
        el.addEventListener("click", (ev) => {
          const b = (ev.target as HTMLElement).closest<HTMLElement>("[data-preset]");
          if (!b) return;
          fecharPopup();
          run("tabela-preset", b.dataset.preset);
        });
        return;
      }
      case "tabela-bordas-menu": {
        const itens: [string, string][] = [["todas", "Todas as bordas"], ["externas", "Bordas externas"], ["internas", "Bordas internas"], ["topo", "Borda superior"], ["base", "Borda inferior"], ["esquerda", "Borda esquerda"], ["direita", "Borda direita"], ["nenhuma", "Sem borda"]];
        const el = abrirPopup(ancora, itens.map(([k, n]) => `<button type="button" class="pp-pop-item" data-borda="${k}">${n}</button>`).join(""), { classe: "pp-pop-menu" });
        el.addEventListener("click", (ev) => {
          const b = (ev.target as HTMLElement).closest<HTMLElement>("[data-borda]");
          if (!b) return;
          fecharPopup();
          run("tabela-bordas", `${b.dataset.borda}|1C212B|1`);
        });
        return;
      }
      case "cor-texto":
        abrirCores(ancora, { atual: est.trecho && est.trecho.color !== "misto" ? est.trecho.color : null, paleta: est.paleta, titulo: "Cor da fonte" }, (c) => {
          if (c) run("cor-texto", c);
        });
        return;
      case "pincel:cor":
        // a mesma paleta do pincel (a da barrinha flutuante), aqui na fita
        abrirCores(ancora, { atual: est.pincel.cor, paleta: est.paleta, titulo: "Cor do traço" }, (c) => run("pincel-cor", c ?? ""));
        return;
      case "marca-texto":
        abrirCores(
          ancora,
          {
            atual: est.trecho && est.trecho.highlight !== "misto" && est.trecho.highlight ? est.trecho.highlight : null,
            paleta: est.paleta,
            semCor: "Sem marca-texto",
            titulo: "Marca-texto",
            extra: `<div class="pp-pop-t">Cores do marca-texto</div>
              <div class="pp-swatches">${CORES_MARCA_TEXTO.map((c) => `<button type="button" class="pp-sw" data-extra="marca:${c}" style="background:#${c}" title="#${c}" aria-label="#${c}"></button>`).join("")}</div>`,
          },
          (c) => run("marca-texto", c ?? ""),
          (x) => run("marca-texto", x.startsWith("marca:") ? x.slice(6) : x)
        );
        return;
      case "preench":
        this.menuPreenchimento(ancora);
        return;
      case "contorno":
        this.menuContorno(ancora);
        return;
      case "sombra": {
        // sem forma escolhida o menu abre só de aviso: antes o botão ficava mudo (desabilitado)
        const temForma = !!est.forma;
        const el = abrirPopup(
          ancora,
          `${temForma ? "" : `<p class="pp-pop-dica">Selecione uma forma na lâmina para aplicar o efeito.</p>`}${SOMBRAS_PRONTAS.map((s, i) => `<button type="button" class="pp-pop-item" data-sombra="${i}"${temForma ? "" : " disabled"}>${previaSombra(s.sombra)}${s.nome}</button>`).join("")}`,
          { classe: "pp-pop-menu" }
        );
        el.addEventListener("click", (ev) => {
          const b = (ev.target as HTMLElement).closest<HTMLElement>("[data-sombra]");
          if (!b) return;
          fecharPopup();
          run("sombra-pronta", b.dataset.sombra);
        });
        return;
      }
      case "layout":
        // a mesma galeria do "Nova lâmina", com o layout atual em destaque
        abrirGaleriaDeLayouts(ancora, est.setup, (l) => run("layout", l), est.layout);
        return;
      case "tamanho-lamina": {
        // proporção da lâmina (o "Tamanho do Slide" da aba Design), com a atual em destaque
        const atual = est.setup.aspect;
        const el = abrirPopup(
          ancora,
          [
            ["16:9", "Widescreen (16:9)"],
            ["4:3", "Padrão (4:3)"],
          ]
            .map(([v, n]) => `<button type="button" class="pp-pop-item" data-aspecto="${v}">${n}${v === atual ? " ✓" : ""}</button>`)
            .join(""),
          { classe: "pp-pop-menu" }
        );
        el.addEventListener("click", (ev) => {
          const b = (ev.target as HTMLElement).closest<HTMLElement>("[data-aspecto]");
          if (!b) return;
          fecharPopup();
          run("tamanho-lamina", b.dataset.aspecto);
        });
        return;
      }
      case "espaco": {
        const opcoes = [1, 1.15, 1.5, 2, 2.5, 3];
        const el = abrirPopup(ancora, opcoes.map((o) => `<button type="button" class="pp-pop-item" data-esp="${o}">${String(o).replace(".", ",")}</button>`).join(""), { classe: "pp-pop-menu" });
        el.addEventListener("click", (ev) => {
          const b = (ev.target as HTMLElement).closest<HTMLElement>("[data-esp]");
          if (!b) return;
          fecharPopup();
          run("entrelinha", b.dataset.esp);
        });
        return;
      }
      case "espacamento": {
        const atual = est.trecho && est.trecho.spc !== "misto" ? est.trecho.spc : null;
        const el = abrirPopup(
          ancora,
          `<div class="pp-pop-rot">Espaçamento entre caracteres</div>` +
            ESPACAMENTOS.map(([v, n]) => `<button type="button" class="pp-pop-item${atual !== null && Math.abs(atual - Number(v)) < 0.01 ? " on" : ""}" data-esp-car="${v}">${n}</button>`).join(""),
          { classe: "pp-pop-menu" }
        );
        el.addEventListener("click", (ev) => {
          const b = (ev.target as HTMLElement).closest<HTMLElement>("[data-esp-car]");
          if (!b) return;
          fecharPopup();
          run("espacamento", b.dataset.espCar);
        });
        return;
      }
      case "caixa": {
        const opcoes: [string, string][] = [
          ["maiusculas", "MAIÚSCULAS"],
          ["minusculas", "minúsculas"],
          ["primeira", "Primeira Letra"],
        ];
        const el = abrirPopup(ancora, opcoes.map(([v, n]) => `<button type="button" class="pp-pop-item" data-caixa="${v}">${n}</button>`).join(""), { classe: "pp-pop-menu" });
        el.addEventListener("click", (ev) => {
          const b = (ev.target as HTMLElement).closest<HTMLElement>("[data-caixa]");
          if (!b) return;
          fecharPopup();
          run("caixa", b.dataset.caixa);
        });
        return;
      }
      case "ordem": {
        const itens: [string, string][] = [
          ["z-topo", "Trazer para a frente"], ["z-frente", "Avançar"], ["z-tras", "Recuar"], ["z-fundo", "Enviar para trás"],
          ["agrupar", "Agrupar"], ["desagrupar", "Desagrupar"],
          ["al-esquerda", "Alinhar à esquerda"], ["al-centro", "Centralizar na horizontal"], ["al-direita", "Alinhar à direita"],
          ["al-topo", "Alinhar ao topo"], ["al-meio", "Centralizar na vertical"], ["al-base", "Alinhar embaixo"],
          ["dist-h", "Distribuir na horizontal"], ["dist-v", "Distribuir na vertical"],
          ["girar-90", "Girar 90° à direita"], ["girar--90", "Girar 90° à esquerda"], ["espelhar-h", "Espelhar na horizontal"], ["espelhar-v", "Espelhar na vertical"],
          ["igualar-largura", "Mesma largura"], ["igualar-altura", "Mesma altura"],
          ["bloquear", "Bloquear / desbloquear"],
        ];
        const el = abrirPopup(ancora, itens.map(([c, n]) => `<button type="button" class="pp-pop-item" data-o="${c}">${n}</button>`).join(""), { classe: "pp-pop-menu" });
        el.addEventListener("click", (ev) => {
          const b = (ev.target as HTMLElement).closest<HTMLElement>("[data-o]");
          if (!b) return;
          fecharPopup();
          const c = b.dataset.o!;
          if (c.startsWith("girar-")) run("girar", c.slice(6));
          else if (c.startsWith("al-")) run("alinhar", c.slice(3));
          else if (c.startsWith("dist-")) run("distribuir", c.slice(5));
          else if (c.startsWith("espelhar-")) run("espelhar", c.slice(9));
          else if (c.startsWith("igualar-")) run("igualar", c.slice(8));
          else run(c);
        });
        return;
      }
      case "fundo":
        this.menuFundo(ancora);
        return;
    }
  }

  private menuPreenchimento(ancora: HTMLElement): void {
    const est = this.hooks.estado();
    const f = est.forma?.fillX;
    const tem = !!est.forma;
    abrirCores(
      ancora,
      {
        atual: f?.kind === "solid" ? f.color : null,
        paleta: est.paleta,
        semCor: "Sem preenchimento",
        titulo: "Preenchimento",
        semSelecao: !tem,
        dica: "Selecione uma forma na lâmina para pintar o preenchimento.",
        extra: `<div class="pp-pop-t">Gradiente</div>
          <div class="pp-gradientes">
            ${["cima", "baixo", "esquerda", "direita", "diagonal", "radial"].map((g) => `<button type="button" class="pp-grad" data-extra="grad:${g}" title="Gradiente ${g}"><span class="g-${g}"></span></button>`).join("")}
          </div>
          <button type="button" class="pp-pop-item" data-extra="imagem">Imagem do computador…</button>`,
      },
      (c) => this.hooks.run("preench", c ?? "none"),
      (x) => this.hooks.run(x.startsWith("grad:") ? "gradiente" : x === "imagem" ? "preench-imagem" : x, x.startsWith("grad:") ? x.slice(5) : undefined)
    );
  }

  /** A galeria dos Estilos de Cor: famílias com prévia real, intensidade, brilho, ângulo e cor. */
  private menuEstilos(ancora: HTMLElement): void {
    const est = this.hooks.estado();
    const atual = est.forma?.estilo;
    const temForma = !!est.forma;
    const intensidade = atual?.intensidade ?? "media";
    const cartoes = FAMILIAS_ORDEM.filter((id) => id !== "propria")
      .map((id) => {
        const rec = FAMILIAS[id];
        const r = rampaDeTons(rec.base, intensidade, rec.desvio);
        return `<button type="button" class="pp-estilo-cartao${atual?.familia === id ? " on" : ""}" data-cmd="estilo-cor:familia:${id}" title="${rec.nome}"${temForma ? "" : " disabled"}>
          <span class="pp-estilo-previa" style="background:linear-gradient(135deg,#${r.claro} 0%,#${r.cor} 45%,#${r.escuro} 100%)"></span>
          <span class="pp-estilo-nome">${rec.nome}</span>
        </button>`;
      })
      .join("");
    const op = (on: boolean, cmd: string, nome: string) => `<button type="button" class="pp-op${on ? " on" : ""}" data-cmd="${cmd}"${temForma ? "" : " disabled"}>${nome}</button>`;
    const base = (atual?.base ?? "").trim() || FAMILIAS[atual?.familia ?? "propria"]?.base || est.paleta[0] || "1F9D55";
    const cores = [...new Set([base, ...est.paleta.slice(0, 8)])]
      .map((c) => `<button type="button" class="pp-estilo-cor" data-cmd="estilo-cor:cor:${c}" title="#${c}" aria-label="Cor #${c}"${temForma ? "" : " disabled"} style="background:#${c}"></button>`)
      .join("");
    const html = `
      <div class="pp-pop-t">Estilos de cor</div>
      ${temForma ? "" : `<p class="pp-pop-dica">Selecione uma forma na lâmina para aplicar o estilo — um clique dá a ela o gradiente, o brilho, o contorno e o texto casados.</p>`}
      <div class="pp-estilos-gal">${cartoes}</div>
      <div class="pp-pop-t">Intensidade</div>
      <div class="pp-linhas-op">
        ${op(intensidade === "suave", "estilo-cor:intensidade:suave", "Suave")}
        ${op(intensidade === "media", "estilo-cor:intensidade:media", "Média")}
        ${op(intensidade === "forte", "estilo-cor:intensidade:forte", "Forte")}
      </div>
      <div class="pp-pop-t">Brilho</div>
      <div class="pp-linhas-op">
        ${op(atual?.brilho === "nada", "estilo-cor:brilho:nada", "Sem brilho")}
        ${op(atual?.brilho === "lustro", "estilo-cor:brilho:lustro", "Lustro")}
        ${op(atual?.brilho === "dobra", "estilo-cor:brilho:dobra", "Dobra")}
      </div>
      <div class="pp-pop-t">Ângulo</div>
      <div class="pp-linhas-op">
        ${ANGULOS_ESTILO.map((a) => op((atual?.angulo ?? 45) === a, `estilo-cor:angulo:${a}`, `${a}°`)).join("")}
      </div>
      <div class="pp-pop-t">Cor do estilo</div>
      <div class="pp-estilo-cores">${cores}</div>
      <button type="button" class="pp-pop-item" data-cmd="estilo-cor:desligar"${temForma ? "" : " disabled"}>Desligar estilo (editar à mão)</button>`;
    const el = abrirPopup(ancora, html, { classe: "pp-pop-menu" });
    el.addEventListener("click", (ev) => {
      const b = (ev.target as HTMLElement).closest<HTMLElement>("[data-cmd]");
      if (!b) return;
      fecharPopup();
      this.hooks.run("estilo-cor", b.dataset.cmd!.slice("estilo-cor:".length));
    });
  }

  private menuContorno(ancora: HTMLElement): void {
    const est = this.hooks.estado();
    const l = est.forma?.ln;
    const tem = !!est.forma;
    const espessuras = [0.25, 0.5, 0.75, 1, 1.5, 2.25, 3, 4.5, 6];
    const tracos: [string, string][] = [["solid", "Contínuo"], ["dash", "Tracejado"], ["dot", "Pontilhado"], ["dashDot", "Traço e ponto"], ["lgDash", "Traço longo"]];
    const pontas: [string, string][] = [["", "Nenhuma"], ["triangle", "Triângulo"], ["arrow", "Seta aberta"], ["stealth", "Seta fina"], ["diamond", "Losango"], ["oval", "Círculo"]];
    abrirCores(
      ancora,
      {
        atual: l?.color ?? null,
        paleta: est.paleta,
        semCor: "Sem contorno",
        titulo: "Contorno",
        semSelecao: !tem,
        dica: "Selecione uma forma na lâmina para desenhar o contorno.",
        extra: `<div class="pp-pop-t">Espessura</div>
          <div class="pp-linhas-op">${espessuras.map((w) => `<button type="button" class="pp-op${l?.w === w ? " on" : ""}" data-extra="espessura:${w}"><span style="height:${Math.max(1, w)}px"></span>${String(w).replace(".", ",")} pt</button>`).join("")}</div>
          <div class="pp-pop-t">Tipo de traço</div>
          <div class="pp-linhas-op">${tracos.map(([v, n]) => `<button type="button" class="pp-op${(l?.dash ?? "solid") === v ? " on" : ""}" data-extra="traco:${v}">${n}</button>`).join("")}</div>
          <div class="pp-pop-t">Ponta inicial / final</div>
          <div class="pp-linhas-op">${pontas.map(([v, n]) => `<button type="button" class="pp-op" data-extra="ponta-ini:${v}">⟵ ${n}</button>`).join("")}</div>
          <div class="pp-linhas-op">${pontas.map(([v, n]) => `<button type="button" class="pp-op" data-extra="ponta-fim:${v}">${n} ⟶</button>`).join("")}</div>`,
      },
      (c) => this.hooks.run("contorno", c ?? "none"),
      (x) => {
        const i = x.indexOf(":");
        this.hooks.run(x.slice(0, i), x.slice(i + 1));
      }
    );
  }

  private menuFundo(ancora: HTMLElement): void {
    const est = this.hooks.estado();
    const f = est.bg;
    abrirCores(
      ancora,
      {
        atual: f?.kind === "solid" ? f.color : null,
        paleta: est.paleta,
        semCor: "Restaurar o fundo do tema",
        titulo: "Fundo da lâmina",
        extra: `<div class="pp-pop-t">Gradiente</div>
          <div class="pp-gradientes">
            ${["cima", "baixo", "esquerda", "direita", "diagonal", "radial"].map((g) => `<button type="button" class="pp-grad" data-extra="fundo-grad:${g}" title="Gradiente ${g}"><span class="g-${g}"></span></button>`).join("")}
          </div>
          <div class="pp-pop-t">Fundo com estilo</div>
          <div class="pp-estilos-gal">
            ${FAMILIAS_ORDEM.filter((id) => id !== "propria")
              .map((id) => {
                const rec = FAMILIAS[id];
                const r = rampaDeTons(rec.base, est.bgEstilo?.intensidade ?? "media", rec.desvio);
                return `<button type="button" class="pp-estilo-cartao${est.bgEstilo?.familia === id ? " on" : ""}" data-extra="fundo-estilo:familia:${id}" title="${rec.nome}">
                  <span class="pp-estilo-previa" style="background:linear-gradient(135deg,#${r.claro} 0%,#${r.cor} 45%,#${r.escuro} 100%)"></span>
                  <span class="pp-estilo-nome">${rec.nome}</span>
                </button>`;
              })
              .join("")}
          </div>
          ${est.bgEstilo ? `<button type="button" class="pp-pop-item" data-extra="fundo-estilo:desligar">Desligar o estilo do fundo</button>` : ""}
          <button type="button" class="pp-pop-item" data-extra="fundo-imagem:">Imagem do computador…</button>
          <button type="button" class="pp-pop-item" data-extra="fundo-todas:">Aplicar este fundo a todas as lâminas</button>`,
      },
      (c) => this.hooks.run("fundo-cor", c ?? "tema"),
      (x) => {
        const i = x.indexOf(":");
        this.hooks.run(x.slice(0, i), x.slice(i + 1));
      }
    );
  }

  // ------------------------------------------------------------------
  // estado dos botões
  // ------------------------------------------------------------------

  /** A aba "Formato da Forma" aparece quando há forma selecionada. */
  atualizar(): void {
    const st = this.hooks.estado();
    const tem = st.formas.length > 0;
    const abaFormato = this.el.querySelector<HTMLElement>('[data-aba="formato"]');
    if (abaFormato) {
      abaFormato.hidden = !tem;
      if (!tem && this.aba === "formato") this.irParaAba("inicio");
    }
    const abaTab = this.el.querySelector<HTMLElement>('[data-aba="tabela"]');
    const temTab = !!st.forma?.tabela;
    if (abaTab) {
      if (abaTab.hidden === temTab) {
        abaTab.hidden = !temTab;
        if (temTab && this.aba !== "tabela") this.irParaAba("tabela");
      }
      if (!temTab && this.aba === "tabela") this.irParaAba("inicio");
    }
    if (st.forma?.tabela) {
      for (const k of ["cabecalho", "faixas", "primeiraColuna"] as const) {
        const i = this.el.querySelector<HTMLInputElement>(`input[data-opc="${k}"]`);
        if (i) i.checked = !!st.forma.tabela[k];
      }
    }
    const on = (cmd: string, v: boolean) => {
      for (const b of this.el.querySelectorAll<HTMLElement>(`[data-cmd="${cmd}"]`)) b.classList.toggle("on", v);
    };
    const dis = (cmd: string, d: boolean) => {
      for (const b of this.el.querySelectorAll<HTMLButtonElement>(`[data-cmd="${cmd}"]`)) b.disabled = d;
    };
    const t = st.trecho;
    const temTexto = !!st.forma && (st.forma.paras !== undefined || !!st.forma.tabela);
    on("negrito", t?.bold === true);
    on("italico", t?.italic === true);
    on("sublinhado", t?.underline === true);
    on("tachado", t?.strike === true);
    on("marca-texto", !!(t && t.highlight !== "misto" && t.highlight));
    const base = t && t.baseline !== "misto" ? t.baseline : 0;
    on("sobrescrito", base > 0);
    on("subscrito", base < 0);
    on("versalete", t?.caps === true);
    const al = st.paragrafo?.align;
    on("alinhar-esquerda", al === "esquerda");
    on("alinhar-centro", al === "centro");
    on("alinhar-direita", al === "direita");
    on("alinhar-justificado", al === "justificado");
    const an = st.forma?.anchor ?? "t";
    on("v-topo", temTexto && an === "t");
    on("v-meio", temTexto && an === "ctr");
    on("v-base", temTexto && an === "b");
    on("marcadores", !!st.paragrafo?.bullet?.char);
    on("numeracao", !!st.paragrafo?.bullet?.auto);
    on("alt-encaixe", st.encaixe);
    on("alt-grade", st.grade);
    on("alt-fixas", st.fixas);
    on("alt-faixa", st.faixaVertical);
    on("slide-ocultar", st.oculta);
    // o botão alterna: com a lâmina oculta, ele passa a oferecer "Mostrar"
    const rotuloOcultar = this.el.querySelector<HTMLElement>('[data-cmd="slide-ocultar"] span');
    if (rotuloOcultar) rotuloOcultar.textContent = st.oculta ? "Mostrar" : "Ocultar";
    on("ferramenta:texto", st.ferramenta?.tipo === "texto");
    on("ferramenta:curva", st.ferramenta?.tipo === "curva");
    on("desenho", st.ferramenta?.tipo === "desenho");
    on("conectar", st.ferramenta?.tipo === "conectar");
    for (const c of ["negrito", "italico", "sublinhado", "tachado", "marca-texto", "sobrescrito", "subscrito", "versalete", "caixa", "espacamento", "limpar-formatacao", "maior", "menor", "cor-texto", "marcadores", "numeracao", "recuo-menos", "recuo-mais", "espaco", "alinhar-esquerda", "alinhar-centro", "alinhar-direita", "alinhar-justificado", "v-topo", "v-meio", "v-base"]) dis(c, !temTexto);
    dis("desfazer", !st.podeDesfazer);
    dis("refazer", !st.podeRefazer);
    dis("colar", !st.temCopia);
    // o "Copiar formatação" precisa de uma forma de origem; armado, fica aceso (e clicável para desligar)
    dis("copiar-formato", !tem);
    on("copiar-formato", st.ferramenta?.tipo === "pincel");
    dis("recortar", !tem);
    dis("copiar", !tem);
    dis("duplicar", !tem);
    dis("agrupar", st.formas.length < 2);
    dis("desagrupar", !st.temGrupo);
    dis("slide-del", st.total <= 1);
    // Preenchimento, contorno e efeitos NÃO entram: sem forma escolhida o botão abre o menu com
    // a dica (o clique mudo era o que parecia "botão que não abre"). Os de ordem continuam mudos.
    for (const c of ["ordem", "z-topo", "z-fundo", "z-frente", "z-tras"]) dis(c, !tem);
    for (const b of this.el.querySelectorAll<HTMLElement>("[data-layout]")) b.classList.toggle("on", b.dataset.layout === st.layout);

    // aba Desenhar: as canetas acesas e o pincel (cor, espessura, modo e assistente)
    on("desenho", st.ferramenta?.tipo === "desenho" && st.pincel.tipo === "caneta");
    on("ferramenta:curva", st.ferramenta?.tipo === "curva");
    on("pincel-tipo:marca", st.ferramenta?.tipo === "desenho" && st.pincel.tipo === "marca");
    on("borracha", st.ferramenta?.tipo === "borracha");
    dis("tinta-forma", !st.formas.some((f) => !!f.tinta));
    // Estúdio: o botão isola a box escolhida e, com o Estúdio aberto, ele vira o "Sair"
    const botaoEstudio = this.el.querySelector<HTMLElement>('[data-cmd="estudio"]');
    if (botaoEstudio) {
      const rotulos = botaoEstudio.querySelectorAll<HTMLElement>("span");
      const rotulo = rotulos[rotulos.length - 1];
      if (rotulo) rotulo.textContent = st.estudio ? "Sair" : "Isolar";
      botaoEstudio.title = st.estudio
        ? `Sair do Estúdio${st.estudioNome ? ` (${st.estudioNome})` : ""} — Esc também sai`
        : "Isolar a box escolhida: edite só ela, num ambiente separado (Esc sai)";
      botaoEstudio.setAttribute("aria-label", botaoEstudio.title);
      botaoEstudio.classList.toggle("estudio-on", st.estudio);
      dis("estudio", !st.estudio && !st.podeIsolar);
    }
    on("pincel-assistente", st.pincel.assistente);
    for (const w of [1, 2, 4, 8]) on(`pincel:w:${w}`, st.pincel.w === w);
    on("pincel:modo:livre", st.pincel.modo === "livre");
    on("pincel:modo:pontos", st.pincel.modo === "pontos");
    const barraPincel = this.el.querySelector<HTMLElement>('[data-barra="pincel-cor"]');
    if (barraPincel) barraPincel.style.background = `#${st.pincel.cor}`;

    // aba Transições: tipo, direção, duração e a prévia
    const tr = st.transicao;
    const tipo = tr?.tipo ?? "none";
    // transição original preservada (não representada pelo app): nenhum tipo fica marcado
    const marcado = st.transicaoPreservada && tipo === "none" ? "" : `transicao:${tipo}`;
    for (const b of this.el.querySelectorAll<HTMLElement>("[data-cmd^='transicao:']")) b.classList.toggle("on", b.dataset.cmd === marcado);
    const comDirecao = aceitaDirecao(tipo);
    for (const b of this.el.querySelectorAll<HTMLButtonElement>("[data-cmd^='transicao-direcao:']")) {
      b.disabled = !comDirecao;
      b.classList.toggle("on", comDirecao && b.dataset.cmd === `transicao-direcao:${direcaoDe(tr)}`);
    }
    const dur = duracaoDe(tr);
    for (const b of this.el.querySelectorAll<HTMLButtonElement>("[data-cmd^='transicao-duracao:']")) {
      b.disabled = tipo === "none";
      b.classList.toggle("on", tipo !== "none" && Number(b.dataset.cmd!.split(":")[1]) === dur);
    }
    const durTxt = this.el.querySelector<HTMLElement>("[data-trans-dur]");
    if (durTxt) durTxt.textContent = tipo === "none" ? "" : formatarDuracao(dur);
    const notaTrans = this.el.querySelector<HTMLElement>("[data-trans-nota]");
    if (notaTrans) notaTrans.hidden = !st.transicaoPreservada;
    dis("transicao-previa", tipo === "none");

    // aba Animações: efeito da forma principal, início, duração e a ordem
    const ef = st.animacao;
    for (const b of this.el.querySelectorAll<HTMLButtonElement>("[data-cmd^='animacao:']")) {
      b.disabled = !tem;
      b.classList.toggle("on", !!ef && b.dataset.cmd === `animacao:${ef.tipo}`);
    }
    for (const b of this.el.querySelectorAll<HTMLButtonElement>("[data-cmd^='animacao-inicio:']")) {
      b.disabled = !ef;
      b.classList.toggle("on", !!ef && b.dataset.cmd === `animacao-inicio:${inicioDe(ef)}`);
    }
    const efSuave = !!ef && suave(ef.tipo);
    const efDur = ef ? duracaoDeAnimacao(ef) : 0;
    for (const b of this.el.querySelectorAll<HTMLButtonElement>("[data-cmd^='animacao-duracao:']")) {
      b.disabled = !efSuave;
      b.classList.toggle("on", efSuave && Number(b.dataset.cmd!.split(":")[1]) === efDur);
    }
    const anDurTxt = this.el.querySelector<HTMLElement>("[data-anim-dur]");
    // o valor só aparece quando NÃO é um dos da lista: repetir a duração escolhida ao lado
    // dela mesma era ruído (e um valor do arquivo, fora da lista, precisa aparecer)
    if (anDurTxt) anDurTxt.textContent = efSuave && !DURACOES_ANIMACAO.some((d) => d.valor === efDur) ? formatarDuracao(efDur) : "";
    const efAtraso = ef ? atrasoDe(ef) : 0;
    for (const b of this.el.querySelectorAll<HTMLButtonElement>("[data-cmd^='animacao-atraso:']")) {
      b.disabled = !ef;
      b.classList.toggle("on", !!ef && Number(b.dataset.cmd!.split(":")[1]) === efAtraso);
    }
    const anAtrasoTxt = this.el.querySelector<HTMLElement>("[data-anim-atraso]");
    if (anAtrasoTxt) anAtrasoTxt.textContent = ef && !ATRASOS_ANIMACAO.some((d) => d.valor === efAtraso) ? formatarDuracao(efAtraso) : "";
    const efTraj = !!ef && aceitaDirecaoAnimacao(ef.tipo);
    for (const b of this.el.querySelectorAll<HTMLButtonElement>("[data-cmd^='animacao-direcao:']")) {
      b.disabled = !efTraj;
      b.classList.toggle("on", efTraj && b.dataset.cmd === `animacao-direcao:${direcaoDeAnimacao(ef)}`);
    }
    const ppInput = this.el.querySelector<HTMLInputElement>("[data-anim-pp]");
    if (ppInput) {
      ppInput.checked = !!ef?.porParagrafo;
      ppInput.disabled = !ef || (st.animacaoParas ?? 0) < 2;
    }
    const efPos = st.animacaoPos ?? -1;
    const totalAnim = st.animacaoTotal ?? 0;
    dis("animacao-mais", !tem);
    dis("animacao-subir", !ef || efPos <= 0);
    dis("animacao-descer", !ef || efPos < 0 || efPos >= totalAnim - 1);
    dis("animacao-remover", !ef);
    dis("animacao-previa", totalAnim === 0);
    // "Painel" fica aceso enquanto o painel lateral está mostrando a lista de animações
    on("animacao-painel", st.lateral === "animacao" && st.lateralAberta === true);
    // a posição na ordem: "2/3" diz onde o efeito da forma selecionada está na lâmina
    const badge = this.el.querySelector<HTMLElement>("[data-anim-pos]");
    if (badge) {
      const naOrdem = !!ef && efPos >= 0 && totalAnim > 0;
      badge.textContent = naOrdem ? `${efPos + 1}/${totalAnim}` : "–";
      badge.title = naOrdem ? `${efPos + 1}ª de ${totalAnim} animações nesta lâmina` : "A forma selecionada não tem animação";
      badge.classList.toggle("vazio", !naOrdem);
    }
    const notaAnim = this.el.querySelector<HTMLElement>("[data-anim-nota]");
    if (notaAnim) notaAnim.hidden = !st.animacaoPreservada;

    // seletores de fonte e tamanho
    const selFonte = this.el.querySelector<HTMLSelectElement>('[data-sel="font"]');
    if (selFonte) {
      const atual = t && t.font !== "misto" ? t.font : "";
      const lista = [...new Set([...(atual ? [atual] : []), ...st.fontes, ...FONTES_COMUNS])];
      const sig = lista.join("|") + "#" + atual;
      if (selFonte.dataset.sig !== sig) {
        // a lista aberta seria trocada embaixo do usuário: fecha antes de remontar as opções
        fecharSeletor(selFonte);
        selFonte.innerHTML = (atual ? "" : `<option value="" selected></option>`) + lista.map((f) => `<option value="${f}"${f === atual ? " selected" : ""} style="font-family:'${f}'">${f}</option>`).join("");
        selFonte.dataset.sig = sig;
      }
      selFonte.disabled = !temTexto;
    }
    const selTam = this.el.querySelector<HTMLSelectElement>('[data-sel="size"]');
    if (selTam) {
      const atual = t && t.size !== "misto" ? t.size : 0;
      const lista = [...new Set([...(atual ? [atual] : []), ...TAMANHOS])].sort((a, b) => a - b);
      const sig = lista.join("|") + "#" + atual;
      if (selTam.dataset.sig !== sig) {
        fecharSeletor(selTam);
        selTam.innerHTML = (atual ? "" : `<option value="" selected></option>`) + lista.map((s) => `<option value="${s}"${s === atual ? " selected" : ""}>${String(s).replace(".", ",")}</option>`).join("");
        selTam.dataset.sig = sig;
      }
      selTam.disabled = !temTexto;
    }
    // barra de cor
    const barra = this.el.querySelector<HTMLElement>('[data-barra="cor-texto"]');
    if (barra) barra.style.background = t && t.color !== "misto" ? `#${t.color}` : "var(--muted)";
    const barraMarca = this.el.querySelector<HTMLElement>('[data-barra="marca-texto"]');
    if (barraMarca) barraMarca.style.background = t && t.highlight !== "misto" && t.highlight ? `#${t.highlight}` : "var(--muted)";
    const z = this.el.querySelector<HTMLElement>("[data-zoomtxt]");
    if (z) z.textContent = `${st.zoom}%`;
    // tamanho em cm (se não está digitando nele)
    for (const [chave, v] of [["altura", st.altura], ["largura", st.largura]] as const) {
      const inp = this.el.querySelector<HTMLInputElement>(`input[data-in="${chave}"]`);
      if (inp && document.activeElement !== inp) {
        inp.value = tem ? String(ptParaCm(v)) : "";
        inp.disabled = !tem;
      }
    }
  }
}
