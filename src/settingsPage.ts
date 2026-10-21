// Página de Configurações (abre como uma aba, ao lado dos documentos). Cada ajuste vale na hora.
import { toast, baseName } from "./util";
import * as backup from "./backup";
import {
  pickFolders,
  listDrafts,
  draftsFolder,
  deleteDraft,
  draftFolderInfo,
  setDraftFolder,
  clearDraftFolder,
  type DraftFolder,
} from "./files";
import { mostrarNaPasta as revealItemInDir, perguntar as ask, emTauri } from "./ponte";
import { podeInstalar, jaInstalado, instalarApp } from "./app/pwa";
import { resumoVersoes, limparVersoesTudo } from "./history";
import { resumoLog, limparLogTudo } from "./snapshots";
import { relatorio as relatorioArmazenamento, removerLegado, limiteDoCache, definirLimiteDoCache } from "./storage";
import { clearGhostMemory } from "./broker/ghost/memory";
import { limparAprendizado } from "./broker/aprendizado";
import { limparTermos, termosAprendidos, termosInsistentes } from "./broker/personal/termos";
import { limparMetricas, metricasCorretor } from "./broker/personal/metricas";
import { exportarAprendizado } from "./broker/personal/aprendizadoArquivo";
import { calibragem } from "./broker/spell/decisao";
import { profileSummary } from "./broker/personal/profile";
import { getGhostMode, setGhostMode, clearFeedback, feedbackSummary, type GhostMode } from "./broker/personal/feedback";
import { MODELOS, getEscolhaModelo, onLanguageModelReady, tamanhoAutomatico, tamanhoCarregado, trocarTamanhoModelo, type EscolhaModelo } from "./broker/ghost/model";
import { limparRitmo, resumoRitmo } from "./broker/writing";
import type { Translation, ProviderChoice } from "./translate/controller";
import type { Tone } from "./broker/writing";
import type { AppSettings } from "./settings";
import type { AppIcon } from "./app/appIcon";
import type { AbaHistorico } from "./historyUi";
import { melhorarSelects } from "./seletor";
import {
  ATALHOS,
  GRUPOS as GRUPOS_DE_ATALHOS,
  comboDeEvento,
  emCaptura,
  foiTrocada,
  quantasTrocadas,
  teclaPadrao,
  teclaVisivel,
  trocarTecla,
  voltarAoPadrao,
  voltarTudoAoPadrao,
} from "./app/keymap";

export type SettingsSection = "escrita" | "traducao" | "historico" | "armazenamento" | "aparencia" | "atalhos";

/** Nível de animação do app (Configurações ▸ Aparência). */
export type NivelAnimacao = "discreta" | "padrao" | "completa";

/** Formato dos cantos do app (Configurações ▸ Aparência). */
export type FormatoCantos = "quadrados" | "redondos";

/** Uma cópia datada em disco, como as Configurações mostram (com a pasta de onde ela veio). */
export interface CopiaDiscoResumo {
  root: string;
  name: string;
  stamp: string;
  bytes: number;
  at: number;
  protection: boolean;
  /** de qual raiz veio: a pasta escolhida pelo usuário ou a pasta do app */
  local: "usuario" | "app" | "outra";
}

/** Um documento (que não o atual) com cópias em backup. */
export interface OutroDocBackup {
  original: string;
  copias: number;
  bytes: number;
  newest: number;
}

/** O que as três camadas de histórico guardaram, resumido para a tela. */
export interface HistoricoVisao {
  /** caminho do documento atual; null quando não há arquivo salvo */
  doc: string | null;
  nome: string;
  versoes: { total: number; marcadas: number; ultimaEm: number | null; ultimoNome: string; ultimoTam: number };
  alteracoes: { total: number; ultimaEm: number | null; ultimoResumo: string; ancora: boolean };
  copias: { total: number; bytes: number; ultimaEm: number | null };
  copiasDetalhe: CopiaDiscoResumo[];
  outros: OutroDocBackup[];
  sumidos: number;
  raizApp: string;
}

export interface SettingsCtx {
  settings: () => AppSettings;
  patch: (p: Partial<AppSettings>) => void;
  translation: Translation;
  autoFix: () => boolean;
  setAutoFix: (on: boolean) => void;
  copilot: () => boolean;
  setCopilot: (on: boolean) => void;
  dictionaryCount: () => number;
  openDictionary: () => void;
  /** F4: promove um termo que o app insiste em marcar (entra no dicionário pessoal). */
  promoverTermo: (palavra: string) => void;
  /** F4: esquece um termo aprendido (sai das listas e volta a ser verificado). */
  esquecerTermo: (palavra: string) => void;
  /** F4: importa um arquivo de aprendizado (substitui o atual) e recarrega o dicionário. */
  importarAprendizado: (texto: string) => { ok: boolean; resumo?: string; erro?: string };
  dark: () => boolean;
  setDark: (dark: boolean) => void;
  /** Nível de animação do app: discreta, padrão ou completa. */
  animacao: () => NivelAnimacao;
  setAnimacao: (v: NivelAnimacao) => void;
  /** Formato dos cantos: quadrados ou redondos. */
  cantos: () => FormatoCantos;
  setCantos: (v: FormatoCantos) => void;
  flag: (cls: "no-sidebar" | "no-preview") => boolean;
  toggleFlag: (cls: "no-sidebar" | "no-preview") => void;
  drawStyle: () => "image" | "text";
  setDrawStyle: (s: "image" | "text") => void;
  /** O que cada camada do histórico guardou e onde (versões, alterações, cópias). */
  historicoVisao: () => Promise<HistoricoVisao>;
  /** Apaga versões + alterações + log exportado DESTE documento (as cópias em disco ficam). */
  apagarHistoricoDoDoc: () => Promise<void>;
  /** Restaura uma cópia de disco no arquivo original e recarrega a aba, se estiver aberta. */
  restaurarCopia: (path: string, root: string, name: string) => Promise<boolean>;
  /** Abre o diálogo de originais sumidos (arquivos que só existem no backup). */
  abrirRecuperacao: () => void;
  openHistory: (aba?: AbaHistorico) => void;
  /** Depois de escolher a pasta dos rascunhos, grava o documento novo já (se o autosave estiver ligado). */
  salvarRascunhoAgora: () => void;
  /** Conserta blocos de alinhamento quebrados no Markdown (ferramenta de manutenção). */
  repairAlignments: () => void;
  /** Ícone da janela escolhido (claro/escuro). */
  appIcon: () => AppIcon;
  setAppIcon: (v: AppIcon) => void;
}

const NAV: { id: SettingsSection; label: string; desc: string; icon: string }[] = [
  { id: "escrita", label: "Escrita", desc: "Correção e sugestões", icon: "i-feather" },
  { id: "traducao", label: "Tradução", desc: "Inglês ao vivo e glossário", icon: "i-globe" },
  { id: "historico", label: "Histórico", desc: "Versões, backup e salvamento", icon: "i-clock" },
  { id: "armazenamento", label: "Armazenamento", desc: "Espaço em disco e limpeza", icon: "i-folder" },
  { id: "aparencia", label: "Aparência", desc: "Tema e elementos da janela", icon: "i-eye" },
  { id: "atalhos", label: "Atalhos", desc: "Teclas rápidas do app", icon: "i-code" },
];

const TONES: { id: Tone; title: string; desc: string }[] = [
  { id: "formal", title: "Formal", desc: "Aponta linguagem informal (“pra”, “tá”, “a gente”, “coisa”, “acho que”…) e sugere a forma culta. Bom para trabalhos, relatórios e e-mails profissionais." },
  { id: "neutro", title: "Neutro", desc: "Só corrige o claramente informal (“pra → para”, “tá → está”). Deixa “a gente” e as sugestões de estilo em paz." },
  { id: "informal", title: "Informal", desc: "Não mexe no jeito de falar: corrige ortografia, pontuação e maiúsculas, mas aceita gírias e “a gente”." },
];

const PROVIDERS: { id: ProviderChoice; title: string; desc: string }[] = [
  {
    id: "offline",
    title: "Offline",
    desc: "Modelo no seu PC: sem limite, sem internet depois de baixar e nada sai do computador. É o padrão.",
  },
  {
    id: "auto",
    title: "Automático",
    desc: "Usa o modelo local. Só manda texto para o online se você permitir abaixo e o modelo local falhar.",
  },
  {
    id: "online",
    title: "Online (grátis)",
    desc: "MyMemory: rápido para começar, com limite diário e qualidade média. Só funciona com “Permitir o tradutor online” ligado.",
  },
];

/** Chip de ícone que ancora cada linha de ajuste. */
function rowIcon(icon: string): string {
  return `<span class="st-row-ic"><svg class="ic"><use href="#${icon}"/></svg></span>`;
}

/** Interruptor liga/desliga acessível. */
function toggle(id: string, label: string, desc: string, on: boolean, icon: string): string {
  return `<label class="st-row">
    ${rowIcon(icon)}
    <span class="st-text"><b>${label}</b><small>${desc}</small></span>
    <input type="checkbox" class="st-switch" role="switch" data-k="${id}" ${on ? "checked" : ""}>
  </label>`;
}

/**
 * Um `<select>` das Configurações: o `melhorarSelects` (ver `src/seletor.ts`) troca a lista
 * cinza do sistema pelo menu do app. `opcoes` = [valor, rótulo]; `atual` marca a escolhida.
 */
function dd(chave: string, opcoes: [string, string][], atual: string): string {
  return `<select class="st-select" data-k="${chave}">${opcoes
    .map(([valor, rotulo]) => `<option value="${valor}"${valor === atual ? " selected" : ""}>${rotulo}</option>`)
    .join("")}</select>`;
}

/** As opções do modelo de palavras (o automático diz qual tamanho escolheria neste computador). */
const OPCOES_MODELO: [string, string][] = [
  ["auto", `Automático (${MODELOS[tamanhoAutomatico()].nome})`],
  ["leve", "Leve (12)"],
  ["basico", "Básico (40)"],
  ["medio", "Médio (80)"],
  ["alto", "Alto (160)"],
];

/** Tetos do cache do WebView, em MB (0 = automático). Os mesmos do lado Rust (`storage.rs`). */
const LIMITES_DE_CACHE: [string, string][] = [
  ["0", "Automático"],
  ["512", "512 MB"],
  ["1024", "1 GB"],
  ["2048", "2 GB"],
  ["4096", "4 GB"],
];

export function renderSettingsPage(host: HTMLElement, ctx: SettingsCtx, section: SettingsSection = "escrita"): void {
  // Se a página for redesenhada no meio de uma troca de tecla, a escuta antiga não
  // vale mais — e deixá-la ligada calaria os atalhos do app inteiro.
  emCaptura(false);
  const s = ctx.settings();
  const tr = ctx.translation.settings;
  const off = ctx.translation.offline;
  const nativo = emTauri();
  host.textContent = "";

  host.innerHTML = `
    <aside class="st-nav" role="tablist" aria-label="Seções das configurações">
      <header class="st-brand">
        <span class="st-brand-ic"><svg class="ic"><use href="#i-gear"/></svg></span>
        <span class="st-brand-txt"><h2>Configurações</h2><small>Preferências do app</small></span>
      </header>
      ${NAV.map(
        (n) => `<button class="st-nav-item" role="tab" data-nav="${n.id}" title="${n.label}"><span class="st-nav-ic"><svg class="ic"><use href="#${n.icon}"/></svg></span><span class="st-nav-txt"><b>${n.label}</b><small>${n.desc}</small></span></button>`
      ).join("")}
    </aside>
    <div class="st-scroll">
      <div class="st-col">
        <section class="st-sec" data-sec="escrita">
          <header class="st-sec-head">
            <span class="st-sec-ic"><svg class="ic"><use href="#i-feather"/></svg></span>
            <div class="st-sec-txt">
              <h3>Escrita</h3>
              <p class="st-lead">Como o assistente corrige e sugere enquanto você escreve.</p>
            </div>
          </header>

          <h4 class="st-group">Tom do texto</h4>
          <div class="st-seg" role="radiogroup" aria-label="Tom do texto">
            ${TONES.map((t) => `<label class="st-seg-item"><input type="radio" name="tone" value="${t.id}" ${s.tone === t.id ? "checked" : ""}><span>${t.title}</span></label>`).join("")}
          </div>
          <p class="st-seg-desc" data-tone-desc></p>
          <p class="st-note">Vale para o assistente de escrita, a correção automática e o português enviado à tradução.</p>
          <p class="st-note">O painel de revisão (F7) mostra o <b>MIP</b> — marcadores informais por 1.000 palavras — antes e depois das correções seguras, com a contagem por classe (internetês, contração, muleta, gíria, oralidade, atenuação, redundância e vagueza) e o risco de cada troca.</p>

          <h4 class="st-group">Digitação e sugestões</h4>
          <div class="st-list">
            ${toggle("autofix", "Correção automática", "Ponto final, vírgulas, maiúsculas, espaços e palavras erradas entram sozinhos (Ctrl+Z desfaz).", ctx.autoFix(), "i-brush")}
            ${toggle("copilot", "Sugestões enquanto digita", "Mostra a continuação da frase em cinza. Tab aceita; Alt+Seta aceita uma palavra.", ctx.copilot(), "i-spark")}
            <div class="st-row">
              ${rowIcon("i-focus")}
              <span class="st-text"><b>Intensidade das sugestões</b><small>Discreta: só com muita certeza (aparece pouco, quase sempre certa). Equilibrada: arrisca o palpite mais provável, mesmo faltando só 2 letras (Alt+Seta para baixo troca a opção). Agressiva: aparece ainda mais e erra mais.</small></span>
              ${dd("ghostmode", [["discreto", "Discreta"], ["equilibrado", "Equilibrada"], ["agressivo", "Agressiva"]], getGhostMode())}
            </div>
            <div class="st-row">
              ${rowIcon("i-grid")}
              <span class="st-text"><b>Modelo de palavras</b><small>Quantas palavras seguintes o app conhece para cada palavra: quanto maior, mais ele acerta a próxima palavra, e mais memória usa. Automático escolhe pelo seu computador. <span data-modelo-status></span></small></span>
              ${dd("modelo", OPCOES_MODELO, getEscolhaModelo())}
            </div>
          </div>

          <h4 class="st-group">Aprendizado</h4>
          <div class="st-list">
            <div class="st-row">
              ${rowIcon("i-pilcrow")}
              <span class="st-text"><b>Seu estilo de escrita</b><small data-style-summary></small></span>
            </div>
            <div class="st-row">
              ${rowIcon("i-check")}
              <span class="st-text"><b>Corretor: precisão percebida e ruído</b><small data-corretor-resumo></small></span>
            </div>
            <div class="st-row">
              ${rowIcon("i-spark")}
              <span class="st-text"><b>Termos que o app insiste em marcar</b><small>Palavras que você já disse que estão certas (“Ignorar neste texto”). Aos poucos o app aprende sozinho: elas entram no dicionário pessoal e param de ser marcadas. Clique para adicionar uma agora.</small></span>
            </div>
            <div class="st-termos" data-termos-candidatos></div>
            <div class="st-row">
              ${rowIcon("i-text")}
              <span class="st-text"><b>Termos que o app aprendeu sozinho</b><small>Clique num termo para esquecê-lo — ele sai do dicionário e volta a ser verificado.</small></span>
            </div>
            <div class="st-termos" data-termos-aprendidos></div>
            <div class="st-row">
              ${rowIcon("i-search")}
              <span class="st-text"><b>Memória das sugestões</b><small>As sugestões aprendem com os seus documentos recentes. Fica só neste computador.</small></span>
              <button class="btn small st-btn" data-act="forget-ghost">Esquecer o que aprendeu</button>
            </div>
            <div class="st-row">
              ${rowIcon("i-text")}
              <span class="st-text"><b>Dicionário pessoal</b><small data-dict-count></small></span>
              <button class="btn small st-btn" data-act="dict">Abrir dicionário…</button>
            </div>
            <div class="st-row">
              ${rowIcon("i-save")}
              <span class="st-text"><b>Levar o aprendizado para outro computador</b><small>Um arquivo pequeno com as trocas, as classes de erro, os termos e o dicionário pessoal — nenhum documento entra nele. Importar substitui o aprendizado atual.</small></span>
              <button class="btn small st-btn" data-act="exp-aprend">Exportar…</button>
              <button class="btn small st-btn" data-act="imp-aprend">Importar…</button>
            </div>
          </div>

          <h4 class="st-group">Manutenção do documento</h4>
          <div class="st-list">
            <div class="st-row">
              ${rowIcon("i-align-left")}
              <span class="st-text"><b>Reparar alinhamentos</b><small>Conserta blocos de alinhamento quebrados: tira o &lt;/div&gt; sobrando e fecha os &lt;div align&gt; que ficaram abertos.</small></span>
              <button class="btn small st-btn" data-act="repair-align">Reparar agora</button>
            </div>
          </div>
        </section>

        <section class="st-sec" data-sec="traducao">
          <header class="st-sec-head">
            <span class="st-sec-ic"><svg class="ic"><use href="#i-globe"/></svg></span>
            <div class="st-sec-txt">
              <h3>Tradução</h3>
              <p class="st-lead">Você escreve em português; a pré-visualização mostra o inglês ao vivo e a exportação traduz o documento.</p>
            </div>
          </header>

          <h4 class="st-group">Inglês ao vivo</h4>
          <div class="st-list">
            ${toggle("tr-on", "Tradução automática", "Mostra a versão em inglês ao lado do português (Ctrl+Alt+T).", tr.enabled, "i-columns")}
            ${toggle("tr-polish", "Melhorar o português antes de traduzir", "Corrige pontuação, maiúsculas, “a gente → nós” e linguagem informal para a tradução sair mais clara.", tr.polish, "i-brush")}
          </div>

          <h4 class="st-group">Motor de tradução</h4>
          <div class="st-seg" role="radiogroup" aria-label="Motor de tradução">
            ${PROVIDERS.map((p) => `<label class="st-seg-item"><input type="radio" name="prov" value="${p.id}" ${tr.provider === p.id ? "checked" : ""}><span>${p.title}</span></label>`).join("")}
          </div>
          <p class="st-seg-desc" data-prov-desc></p>
          <div class="st-inline">
            <button class="btn small st-btn" data-act="dl"></button>
            <span class="muted" data-dl-status></span>
          </div>

          <div class="st-list">
            ${toggle(
              "tr-online",
              "Permitir o tradutor online",
              "Desligado, o texto do documento NUNCA sai do computador: a tradução usa o modelo local. Ao ligar, os trechos são enviados ao MyMemory (serviço gratuito na internet).",
              tr.onlineOk,
              "i-cloud"
            )}
          </div>

          <h4 class="st-group">Limite e glossário</h4>
          <label class="st-field">
            <span class="st-field-label"><b>E-mail para ampliar o limite do modo online</b><small>Opcional — só vale com o tradutor online permitido acima.</small></span>
            <input type="email" data-k="email" placeholder="voce@exemplo.com" autocomplete="off" spellcheck="false" value="${tr.email.replace(/"/g, "&quot;")}">
          </label>
          <label class="st-field">
            <span class="st-field-label"><b>Glossário</b><small>Um termo por linha. <code>mdOffice</code> mantém o nome; <code>rascunho = draft</code> força a tradução.</small></span>
            <textarea data-k="gloss" rows="6" spellcheck="false" placeholder="mdOffice&#10;rascunho = draft"></textarea>
          </label>
          <div class="st-inline"><button class="btn small st-btn" data-act="clear-tr">Limpar memória de traduções</button></div>
        </section>

        <section class="st-sec" data-sec="historico">
          <header class="st-sec-head">
            <span class="st-sec-ic"><svg class="ic"><use href="#i-clock"/></svg></span>
            <div class="st-sec-txt">
              <h3>Histórico e salvamento</h3>
              <p class="st-lead">O que já foi guardado deste documento, onde está e como voltar atrás — sem sair do app.</p>
            </div>
          </header>

          <h4 class="st-group">Este documento</h4>
          <div class="st-list">
            <div class="st-row">
              ${rowIcon("i-clock")}
              <span class="st-text"><b>Versões</b><small data-hist-versoes>verificando…</small></span>
              <span class="st-btns"><button class="btn small st-btn" data-act="hist-versoes">Abrir aba Versões</button></span>
            </div>
            <div class="st-row">
              ${rowIcon("i-code")}
              <span class="st-text"><b>Alterações</b><small data-hist-alteracoes>verificando…</small></span>
              <span class="st-btns"><button class="btn small st-btn" data-act="hist-alteracoes">Abrir aba Alterações</button></span>
            </div>
            <div class="st-row">
              ${rowIcon("i-folder")}
              <span class="st-text"><b>Cópias em disco</b><small data-hist-copias>verificando…</small></span>
              <span class="st-btns"><button class="btn small st-btn" data-act="hist-backup">Abrir aba Backup</button></span>
            </div>
            <div class="st-row">
              ${rowIcon("i-trash")}
              <span class="st-text"><b>Apagar versões e alterações</b><small>Some o histórico <b>deste documento</b>: versões, alterações e o log exportado. As cópias em disco <b>não</b> são apagadas.</small></span>
              <span class="st-btns"><button class="btn small st-btn danger" data-act="hist-apagar">Apagar…</button></span>
            </div>
          </div>

          <h4 class="st-group">Cópias deste documento — recuperar aqui</h4>
          <div class="st-list" data-copias-doc></div>

          <h4 class="st-group">Outros documentos com backup — recuperar aqui</h4>
          <div class="st-list" data-copias-outros></div>

          <h4 class="st-group">Arquivo apagado do disco</h4>
          <div class="st-list">
            <div class="st-row">
              ${rowIcon("i-help")}
              <span class="st-text"><b>Originais sumidos</b><small data-hist-sumidos>verificando…</small></span>
              <span class="st-btns"><button class="btn small st-btn" data-act="hist-recuperar">Ver e recuperar…</button></span>
            </div>
          </div>

          <h4 class="st-group">Onde ficam os arquivos</h4>
          <div class="st-list">
            <div class="st-row">
              ${rowIcon("i-folder-plus")}
              <span class="st-text"><b>${nativo ? "Pasta escolhida por você" : "Pasta dos documentos"}</b><small data-backup-root>—</small></span>
              ${
                nativo
                  ? `<span class="st-btns">
                <button class="btn small st-btn" data-act="backup-dir">Trocar…</button>
                <button class="btn small st-btn" data-act="backup-open">Abrir</button>
              </span>`
                  : ""
              }
            </div>
            <div class="st-row">
              ${rowIcon("i-folder")}
              <span class="st-text"><b>${nativo ? "Pasta do app" : "Backup e lixeira"}</b><small data-backup-app>—</small></span>
              ${nativo ? `<span class="st-btns"><button class="btn small st-btn" data-act="backup-open-app">Abrir</button></span>` : ""}
            </div>
            <div class="st-row">
              ${rowIcon("i-doc")}
              <span class="st-text"><b>Log de alterações exportado</b><small>Vai junto de cada cópia, em <code>&lt;documento&gt;/.historico/historico.json</code> — sobrevive se os dados do app forem limpos.</small></span>
            </div>
            <p class="st-list-note">Versões e alterações ficam no banco local do app (não são arquivos soltos) e se recuperam pelas abas acima. ${
              nativo
                ? "As cópias em disco são arquivos datados de verdade, nas duas pastas."
                : "As cópias em disco são arquivos datados de verdade, dentro de .mdoffice/ na pasta dos documentos."
            }</p>
          </div>

          <h4 class="st-group">Salvamento</h4>
          <div class="st-list">
            ${toggle("autosave", "Salvamento automático dos documentos novos", "Cada documento tem o seu salvamento automático: o botão no topo do app liga e desliga o documento que está à vista. Aqui se escolhe o que os documentos NOVOS vão herdar. Regrava rascunhos do app e documentos MD* enquanto você escreve; arquivos .docx, .pptx e .xlsx são gravados só no Ctrl+S (o selo da barra mostra “Não salvo”).", s.autosaveOn, "i-save")}
            ${
              nativo
                ? ""
                : `<div class="st-row">
              ${rowIcon("i-folder-plus")}
              <span class="st-text"><b>Pasta dos rascunhos</b><small data-drafts-root>verificando…</small></span>
              <span class="st-btns">
                <button class="btn small st-btn" data-act="drafts-dir">Escolher…</button>
                <button class="btn small st-btn" data-act="drafts-clear" hidden>Remover</button>
              </span>
            </div>`
            }
            ${toggle("hist", "Guardar versões dos documentos", "Uma cópia automática a cada 5 minutos (se o texto mudou) e ao salvar.", s.historyOn, "i-clock")}
            <div class="st-row">
              ${rowIcon("i-list")}
              <span class="st-text"><b>Versões guardadas por documento</b><small>As marcadas por você (★) nunca são apagadas sozinhas.</small></span>
              ${dd("hist-max", [20, 40, 60, 100, 200].map((n) => [String(n), `${n} versões`] as [string, string]), String(s.historyMax))}
            </div>
            ${toggle("commits", "Guardar o log de alterações", "Guarda só a instrução de cada mudança (o que saiu e o que entrou), não o arquivo inteiro. Dá para voltar a qualquer ponto pela aba Alterações do histórico.", s.commitsOn, "i-code")}
          </div>

          <h4 class="st-group">Backup em disco</h4>
          <p class="st-sub">Uma cópia de verdade do arquivo, gravada em duas pastas ao mesmo tempo. Se uma falhar (HD desconectado, sem permissão), a outra ainda salva.</p>
          <div class="st-list">
            ${toggle("backup", "Guardar cópia dos documentos em disco", "Ao salvar, ao sair de um documento com alterações e uma vez por dia. Também vale para documentos (.docx), apresentações (.pptx) e planilhas (.xlsx).", s.backupOn, "i-folder")}
            ${toggle("backupwarn", "Avisar quando o original sumir", "Se você apagar um arquivo do disco, o app avisa na barra inferior e deixa restaurar pela cópia.", s.backupWarnMissing, "i-eye")}
            <div class="st-row">
              ${rowIcon("i-trash")}
              <span class="st-text"><b>Política de limpeza</b><small>Quanto cada documento guarda antes de as cópias mais antigas saírem. As marcadas à mão nunca saem.</small></span>
              ${dd("backup-profile", backup.PERFIS.map((p) => [p.id, p.nome] as [string, string]), s.backupProfile)}
            </div>
            <p class="st-list-note" data-backup-profile-desc></p>
            <div class="st-row" data-backup-custom ${s.backupProfile === "personalizado" ? "" : "hidden"}>
              ${rowIcon("i-copy")}
              <span class="st-text"><b>Cópias por documento</b><small>0 = guardar quantas existirem, sem limite de quantidade.</small></span>
              ${dd("backup-copies", [10, 20, 50, 100, 200, 500, 0].map((n) => [String(n), n === 0 ? "sem limite" : `${n} cópias`] as [string, string]), String(s.backupCopies))}
            </div>
            <div class="st-row" data-backup-custom2 ${s.backupProfile === "personalizado" ? "" : "hidden"}>
              ${rowIcon("i-clock")}
              <span class="st-text"><b>Prazo</b><small>0 = não apagar por tempo (só pela quantidade acima).</small></span>
              ${dd("backup-days", [7, 30, 90, 365, 0].map((n) => [String(n), n === 0 ? "sem prazo" : n === 365 ? "1 ano" : `${n} dias`] as [string, string]), String(s.backupDays))}
            </div>
            <div class="st-row">
              ${rowIcon("i-grid")}
              <span class="st-text"><b>Espaço usado</b><small data-backup-size>calculando…</small></span>
              <span class="st-btns">
                <button class="btn small st-btn" data-act="backup-prune">Limpar cópias antigas</button>
              </span>
            </div>
          </div>
        </section>

        <section class="st-sec" data-sec="armazenamento">
          <header class="st-sec-head">
            <span class="st-sec-ic"><svg class="ic"><use href="#i-folder"/></svg></span>
            <div class="st-sec-txt">
              <h3>Armazenamento</h3>
              <p class="st-lead">Onde o espaço está indo e o que dá para limpar.</p>
            </div>
          </header>

          <h4 class="st-group">Resumo</h4>
          <div class="st-list">
            <div class="st-row">
              ${rowIcon("i-grid")}
              <span class="st-text"><b>Total no disco</b><small data-arm-total>calculando…</small></span>
            </div>
            <div class="st-arm-barra" data-arm-barra></div>
            <div class="st-arm-legenda" data-arm-legenda></div>
          </div>

          <h4 class="st-group">O que ocupa</h4>
          <div class="st-list">
            <div class="st-row">
              ${rowIcon("i-clock")}
              <span class="st-text"><b>Versões guardadas</b><small data-arm-vers>calculando…</small></span>
              <span class="st-btns"><button class="btn small st-btn" data-act="arm-clear-vers">Limpar versões</button></span>
            </div>
            <div class="st-row">
              ${rowIcon("i-code")}
              <span class="st-text"><b>Log de alterações</b><small data-arm-log>calculando…</small></span>
              <span class="st-btns"><button class="btn small st-btn" data-act="arm-clear-log">Limpar log</button></span>
            </div>
            <div class="st-row">
              ${rowIcon("i-folder")}
              <span class="st-text"><b>Backup em disco</b><small data-arm-backup>calculando…</small></span>
              <span class="st-btns">
                <button class="btn small st-btn" data-act="arm-open-backup">Abrir pasta</button>
                <button class="btn small st-btn" data-act="arm-prune-backup">Limpar antigas</button>
              </span>
            </div>
            <div class="st-row">
              ${rowIcon("i-save")}
              <span class="st-text"><b>Rascunhos</b><small data-arm-drafts>calculando…</small></span>
              <span class="st-btns">
                ${nativo ? `<button class="btn small st-btn" data-act="arm-open-drafts">Abrir pasta</button>` : ""}
                <button class="btn small st-btn" data-act="arm-clear-drafts">Apagar</button>
              </span>
            </div>
            <div class="st-row">
              ${rowIcon("i-cloud")}
              <span class="st-text"><b>Outros dados do app</b><small data-arm-other>calculando…</small></span>
              <span class="st-btns"><button class="btn small st-btn" data-act="arm-open-data">Abrir pasta</button></span>
            </div>
            <div class="st-row">
              ${rowIcon("i-refresh")}
              <span class="st-text"><b>Cache do WebView</b><small data-arm-cache>calculando…</small></span>
              ${dd("cache-limite", LIMITES_DE_CACHE, "0")}
            </div>
          </div>

          <div data-arm-legacy hidden>
            <h4 class="st-group">Da versão anterior</h4>
            <div class="st-list">
              <div class="st-row">
                ${rowIcon("i-trash")}
                <span class="st-text"><b>Dados do mdCreator</b><small data-arm-legacy-txt>calculando…</small></span>
                <span class="st-btns"><button class="btn small st-btn danger" data-act="arm-remove-legacy">Remover…</button></span>
              </div>
            </div>
          </div>
        </section>

        <section class="st-sec" data-sec="aparencia">
          <header class="st-sec-head">
            <span class="st-sec-ic"><svg class="ic"><use href="#i-eye"/></svg></span>
            <div class="st-sec-txt">
              <h3>Aparência</h3>
              <p class="st-lead">Tema e o que aparece na janela.</p>
            </div>
          </header>
          <h4 class="st-group">Tema</h4>
          <div class="st-opcoes" role="radiogroup" aria-label="Tema do app">
            <label class="st-opcao" title="Fundo claro e texto escuro">
              <input type="radio" name="tema" value="claro" ${ctx.dark() ? "" : "checked"}>
              <span class="st-opcao-previa" data-tema="claro" aria-hidden="true">
                <span class="st-opcao-linha"></span>
                <span class="st-opcao-linha curta"></span>
                <span class="st-opcao-ponto"></span>
              </span>
              <span class="st-opcao-nome"><svg class="ic"><use href="#i-sun"/></svg>Claro</span>
            </label>
            <label class="st-opcao" title="Fundo escuro e texto claro">
              <input type="radio" name="tema" value="escuro" ${ctx.dark() ? "checked" : ""}>
              <span class="st-opcao-previa" data-tema="escuro" aria-hidden="true">
                <span class="st-opcao-linha"></span>
                <span class="st-opcao-linha curta"></span>
                <span class="st-opcao-ponto"></span>
              </span>
              <span class="st-opcao-nome"><svg class="ic"><use href="#i-moon"/></svg>Escuro</span>
            </label>
          </div>

          <h4 class="st-group">Animação</h4>
          <div class="st-opcoes tres" role="radiogroup" aria-label="Nível de animação">
            <label class="st-opcao" title="Sem enfeite: só cor e opacidade, tudo rápido">
              <input type="radio" name="animacao" value="discreta" ${ctx.animacao() === "discreta" ? "checked" : ""}>
              <span class="st-opcao-previa st-anim-previa" data-anim="discreta" aria-hidden="true"><span class="st-anim-bola"></span></span>
              <span class="st-opcao-nome">Discreta</span>
            </label>
            <label class="st-opcao" title="O equilíbrio de sempre: entradas curtas e suaves">
              <input type="radio" name="animacao" value="padrao" ${ctx.animacao() === "padrao" ? "checked" : ""}>
              <span class="st-opcao-previa st-anim-previa" data-anim="padrao" aria-hidden="true"><span class="st-anim-bola"></span></span>
              <span class="st-opcao-nome">Padrão</span>
            </label>
            <label class="st-opcao" title="Entradas com mola (passam do ponto e assentam), cascata mais espaçada, hover mais alto e janelas maiores">
              <input type="radio" name="animacao" value="completa" ${ctx.animacao() === "completa" ? "checked" : ""}>
              <span class="st-opcao-previa st-anim-previa" data-anim="completa" aria-hidden="true"><span class="st-anim-bola"></span></span>
              <span class="st-opcao-nome">Completa</span>
            </label>
          </div>
          <p class="st-note">Vale para o app inteiro: entradas, cascatas, elevação ao passar o mouse e a troca de painéis.</p>

          <h4 class="st-group">Cantos</h4>
          <div class="st-opcoes" role="radiogroup" aria-label="Formato dos cantos">
            <label class="st-opcao" title="Cantos retos de verdade (2 a 3 px)">
              <input type="radio" name="cantos" value="quadrados" ${ctx.cantos() === "quadrados" ? "checked" : ""}>
              <span class="st-opcao-previa st-canto-previa" data-cantos="quadrados" aria-hidden="true">
                <span class="st-canto-barra"></span>
                <span class="st-canto-barra curta"></span>
              </span>
              <span class="st-opcao-nome">Quadrado</span>
            </label>
            <label class="st-opcao" title="Cantos suaves, como o app já era">
              <input type="radio" name="cantos" value="redondos" ${ctx.cantos() === "redondos" ? "checked" : ""}>
              <span class="st-opcao-previa st-canto-previa" data-cantos="redondos" aria-hidden="true">
                <span class="st-canto-barra"></span>
                <span class="st-canto-barra curta"></span>
              </span>
              <span class="st-opcao-nome">Redondo</span>
            </label>
          </div>

          <h4 class="st-group">Aplicativo</h4>
          <div class="st-list" data-pwa data-pwa-bloco hidden>
            <div class="st-row">
              ${rowIcon("i-web")}
              <span class="st-text"><b>Instalar no computador</b><small data-pwa-txt>O mdOffice vira um aplicativo na janela própria, com ícone no menu Iniciar. Sem instalador .exe — quem instala é o navegador.</small></span>
              <span class="st-btns"><button class="btn small st-btn" data-act="pwa-instalar">Instalar</button></span>
            </div>
          </div>

          <h4 class="st-group">Janela</h4>
          <div class="st-list">
            ${toggle("sidebar", "Painel lateral", "Projetos, busca, estrutura e contexto para a IA.", !ctx.flag("no-sidebar"), "i-sidebar")}
            ${toggle("preview", "Pré-visualização", "O resultado formatado ao lado do texto.", !ctx.flag("no-preview"), "i-columns")}
            <div class="st-row">
              ${rowIcon("i-draw")}
              <span class="st-text"><b>Estilo do desenho</b><small>Imagem guarda um PNG em assets/. Letras vira texto no próprio Markdown (ótimo para a IA).</small></span>
              ${dd("draw", [["image", "Imagem (PNG)"], ["text", "Letras e símbolos"]], ctx.drawStyle())}
            </div>
          </div>

          <h4 class="st-group">Ícone do app</h4>
          <div class="st-seg" role="radiogroup" aria-label="Ícone do app">
            <label class="st-seg-item" title="Ícone de fundo claro"><input type="radio" name="appicon" value="claro" ${ctx.appIcon() === "claro" ? "checked" : ""}><img class="st-seg-icone" src="/icones/mdoffice-claro.png" alt=""><span>Claro</span></label>
            <label class="st-seg-item" title="Ícone de fundo escuro"><input type="radio" name="appicon" value="escuro" ${ctx.appIcon() === "escuro" ? "checked" : ""}><img class="st-seg-icone" src="/icones/mdoffice-escuro.png" alt=""><span>Escuro</span></label>
          </div>
          <p class="st-note">Vale para a janela e a barra de tarefas. O ícone do .exe/instalador é fixo (claro).</p>
        </section>

        <section class="st-sec" data-sec="atalhos">
          <header class="st-sec-head">
            <span class="st-sec-ic"><svg class="ic"><use href="#i-code"/></svg></span>
            <div class="st-sec-txt">
              <h3>Atalhos</h3>
              <p class="st-lead">Clique na tecla de um atalho e pressione a que você quer no lugar.</p>
              ${emTauri() ? "" : `<p class="st-note">No navegador, Ctrl+T, Ctrl+W e Ctrl+Tab pertencem ao próprio navegador — ele abre, fecha e troca as abas dele antes de o app receber a tecla. Por isso os atalhos de abas aqui usam Ctrl+Alt (por exemplo, ${teclaVisivel("nova-aba")} cria uma nova aba).</p>`}
            </div>
          </header>
          ${GRUPOS_DE_ATALHOS.map((grupo) => {
            const doGrupo = ATALHOS.filter((a) => a.grupo === grupo);
            if (!doGrupo.length) return "";
            return `<h4 class="st-group">${grupo}</h4>
          <div class="st-keys-card">
            <div class="st-keys">
              ${doGrupo
                .map(
                  (a) => `<div class="st-key" data-at="${a.id}">
                <span>${a.rotulo}</span>
                <span class="st-key-teclas">
                  <button class="st-key-btn" data-tecla="${a.id}" title="Clique para trocar a tecla"><kbd>${teclaVisivel(a.id)}</kbd></button>
                  <button class="st-key-voltar" data-voltar="${a.id}" title="Voltar ao padrão (${teclaPadrao(a.id)})" aria-label="Voltar ao padrão" ${foiTrocada(a.id) ? "" : "hidden"}><svg class="ic"><use href="#i-undo"/></svg></button>
                </span>
              </div>`
                )
                .join("")}
            </div>
          </div>`;
          }).join("")}
          <p class="st-list-note" data-at-nota></p>
          <div class="st-btns">
            <button class="st-btn" data-at-restaurar ${quantasTrocadas() ? "" : "hidden"}>Restaurar todos os atalhos</button>
          </div>
        </section>
      </div>
    </div>

    <!-- Confirmação do ajuste. Fica solta no canto, e não numa barra fixa no topo:
         a barra repetia o nome da seção que aparece logo abaixo dela, e o "Salvo"
         precisa estar à vista onde a pessoa acabou de clicar — não no alto. -->
    <span class="st-saved" aria-live="polite"></span>`;

  // os `<select>` desta página abrem o menu do app (a lista do sistema não segue o tema)
  melhorarSelects(host);

  const q = <T extends HTMLElement>(sel: string) => host.querySelector<T>(sel)!;
  const saved = q(".st-saved");
  let savedTimer: number | undefined;
  const flash = () => {
    saved.textContent = "✓ Salvo";
    window.clearTimeout(savedTimer);
    savedTimer = window.setTimeout(() => (saved.textContent = ""), 1600);
  };
  /**
   * Liga um evento a um elemento da página.
   *
   * A página de Configurações é montada só com a seção da aba escolhida — abrir direto em
   * "Aparência", por exemplo, não tem os botões do Backup. Sem o `?.` o `null.addEventListener`
   * estourava e **abortava o resto da função**: os cartões de tema/animação/cantos ficavam
   * desenhados mas sem listener (o rádio marcava e nada acontecia).
   */
  const on = (sel: string, ev: string, fn: (e: Event) => void) => q(sel)?.addEventListener(ev, fn);
  const sw = (key: string) => q<HTMLInputElement>(`[data-k="${key}"]`);
  /** Cria um elemento já com classe e texto (as linhas do histórico são montadas na mão). */
  const el = <K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, texto?: string): HTMLElementTagNameMap[K] => {
    const node = document.createElement(tag);
    if (cls) node.className = cls;
    if (texto !== undefined) node.textContent = texto;
    return node;
  };

  /** Liga um `dd()`: a escolha chega pelo `change` do select (a lista é o menu do app). */
  const ligarDd = (chave: string, _opcoes: [string, string][], aoEscolher: (valor: string) => void): void => {
    q<HTMLSelectElement>(`[data-k="${chave}"]`)?.addEventListener("change", (e) => {
      aoEscolher((e.target as HTMLSelectElement).value);
    });
  };

  // As seções são ABAS: só uma fica à vista por vez. Antes elas ficavam todas
  // empilhadas na mesma página e a navegação lateral apenas rolava até a seção —
  // para mudar um ajuste de "Aparência" era preciso atravessar as cinco.
  const items = host.querySelectorAll<HTMLElement>(".st-nav-item");
  const secoes = host.querySelectorAll<HTMLElement>(".st-sec");
  const scroller = q(".st-scroll");
  const mark = (id: string) => {
    items.forEach((b) => {
      const active = b.dataset.nav === id;
      b.classList.toggle("active", active);
      b.setAttribute("aria-selected", String(active));
    });
  };
  const abrir = (id: string) => {
    for (const sec of secoes) sec.hidden = sec.dataset.sec !== id;
    scroller.scrollTop = 0; // cada aba abre do começo, não onde a anterior parou
    mark(id);
  };
  items.forEach((b) => b.addEventListener("click", () => abrir(b.dataset.nav!)));
  abrir(section);

  // escrita
  const toneDesc = q("[data-tone-desc]");
  const paintTone = () => {
    const id = host.querySelector<HTMLInputElement>('input[name="tone"]:checked')?.value as Tone | undefined;
    toneDesc.textContent = TONES.find((t) => t.id === id)?.desc ?? "";
  };
  paintTone();
  host.querySelectorAll<HTMLInputElement>('input[name="tone"]').forEach((r) =>
    r.addEventListener("change", () => {
      ctx.patch({ tone: r.value as Tone });
      paintTone();
      flash();
    })
  );
  sw("autofix")?.addEventListener("change", (e) => {
    ctx.setAutoFix((e.target as HTMLInputElement).checked);
    flash();
  });
  sw("copilot")?.addEventListener("change", (e) => {
    ctx.setCopilot((e.target as HTMLInputElement).checked);
    flash();
  });
  const paintDict = () => {
    const n = ctx.dictionaryCount();
    q("[data-dict-count]").textContent = n ? `${n} palavra(s) que você mandou ignorar` : "Nenhuma palavra ainda — clique numa palavra sublinhada e escolha “Adicionar ao dicionário”.";
  };
  const paintStyle = () => {
    const p = profileSummary();
    const fb = feedbackSummary();
    const el = q("[data-style-summary]");
    if (!p.ready) {
      el.textContent = `Ainda aprendendo: ${p.docs} documento(s), ${p.words} palavras analisadas (a partir de ~400 palavras o app passa a usar o seu estilo na revisão).`;
      return;
    }
    const pct = (n: number) => `${Math.round((100 * n) / Math.max(1, p.sentences))}%`;
    const ab = p.openers.slice(0, 3).map(([w, n]) => `“${w}” (${pct(n)})`).join(", ");
    const rt = resumoRitmo();
    el.textContent =
      `Frases de ${Math.round(p.avgSentence)} palavras em média (90% até ${p.p90}); ${p.commasPer100.toFixed(1).replace(".", ",")} vírgulas a cada 100 palavras; palavras de ${p.avgWordLen.toFixed(1).replace(".", ",")} letras. Costuma abrir frases com ${ab}.` +
      (fb.decisions >= 30 ? ` Você aceita ${Math.round(fb.acceptNext * 100)}% das sugestões de próxima palavra e ${Math.round(fb.acceptPrefix * 100)}% das de completar palavra.` : "") +
      (rt.decisoes >= 5 ? ` A correção automática espera ~${(rt.pausa / 1000).toFixed(1).replace(".", ",")} s de pausa para agir (aprende com os seus desfazer).` : "");
  };
  paintStyle();
  const paintModelo = () => {
    const t = tamanhoCarregado();
    q("[data-modelo-status]").textContent = t ? `Em uso: ${MODELOS[t].nome} (${MODELOS[t].sucessores} palavras seguintes).` : "Carregando…";
  };
  paintModelo();
  onLanguageModelReady(paintModelo); // aberto antes de o modelo terminar de carregar
  ligarDd("modelo", OPCOES_MODELO, (valor) => {
    q("[data-modelo-status]").textContent = "Carregando…";
    void trocarTamanhoModelo(valor as EscolhaModelo).then(() => {
      paintModelo();
      flash();
    });
  });
  ligarDd("ghostmode", [["discreto", "Discreta"], ["equilibrado", "Equilibrada"], ["agressivo", "Agressiva"]], (valor) => {
    setGhostMode(valor as GhostMode);
    flash();
  });
  paintDict();
  // F4 — auto-cura: métricas do corretor + termos candidatos/aprendidos
  const paintCorretor = () => {
    const m = metricasCorretor();
    const c = calibragem();
    const n = c.ok + c.ruim;
    const precisao = n ? `${Math.round((c.ok / Math.max(1, n)) * 100)}% (de ${n} correções automáticas)` : "sem amostra ainda";
    q("[data-corretor-resumo]").textContent =
      `Precisão percebida: ${precisao} · ${String(m.porMil).replace(".", ",")} aviso(s) de escrita por 1.000 palavras (em ${m.palavras} palavras verificadas).`;
    const cand = termosInsistentes();
    q("[data-termos-candidatos]").innerHTML = cand.length
      ? cand
          .slice(0, 14)
          .map(
            (t) =>
              `<button class="st-termo" type="button" data-termo="${t.palavra}" title="Adicionar “${t.palavra}” ao dicionário agora">${t.palavra}<span>${String(t.pontos).replace(".", ",")}</span></button>`
          )
          .join("")
      : `<span class="muted">Nada por aqui ainda — quando você ignorar a mesma palavra algumas vezes, ela aparece nesta lista.</span>`;
    const apre = termosAprendidos();
    q("[data-termos-aprendidos]").innerHTML = apre.length
      ? apre
          .slice(0, 14)
          .map(
            (t) =>
              `<button class="st-termo feito" type="button" data-esquecer="${t.palavra}" title="Esquecer “${t.palavra}” (sai do dicionário e volta a ser verificada)">${t.palavra} ✕</button>`
          )
          .join("")
      : `<span class="muted">O app ainda não aprendeu nenhum termo sozinho.</span>`;
  };
  paintCorretor();
  q("[data-termos-candidatos]")?.addEventListener("click", (e) => {
    const b = (e.target as HTMLElement).closest<HTMLElement>("[data-termo]");
    if (!b) return;
    ctx.promoverTermo(b.dataset.termo!);
    paintCorretor();
    paintDict();
  });
  q("[data-termos-aprendidos]")?.addEventListener("click", (e) => {
    const b = (e.target as HTMLElement).closest<HTMLElement>("[data-esquecer]");
    if (!b) return;
    ctx.esquecerTermo(b.dataset.esquecer!);
    paintCorretor();
    paintDict();
  });
  on('[data-act="exp-aprend"]', "click", () => {
    const texto = exportarAprendizado();
    const blob = new Blob([texto], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `mdoffice-aprendizado-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.append(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(a.href);
    toast("Aprendizado exportado — guarde o arquivo onde quiser.", "ok", 3400);
  });
  on('[data-act="imp-aprend"]', "click", () => {
    const inp = document.createElement("input");
    inp.type = "file";
    inp.accept = ".json,application/json";
    inp.addEventListener("change", () => {
      const f = inp.files?.[0];
      if (!f) return;
      void f.text().then((texto) => {
        const r = ctx.importarAprendizado(texto);
        if (r.ok) {
          toast(`Aprendizado importado: ${r.resumo}`, "ok", 5600);
          paintCorretor();
          paintDict();
          paintStyle();
        } else {
          toast(r.erro ?? "Não deu para importar o arquivo.", "err", 5600);
        }
      });
    });
    inp.click();
  });
  on('[data-act="forget-ghost"]', "click", () => {
    clearGhostMemory();
    clearFeedback();
    limparRitmo();
    limparAprendizado();
    limparTermos();
    limparMetricas();
    paintStyle();
    paintCorretor();
    toast("As sugestões, a correção automática e o corretor esqueceram o que aprenderam.", "ok", 2600);
  });
  on('[data-act="dict"]', "click", () => {
    ctx.openDictionary();
  });
  on('[data-act="repair-align"]', "click", () => {
    ctx.repairAlignments();
  });

  // tradução
  sw("tr-on")?.addEventListener("change", (e) => {
    ctx.translation.setEnabled((e.target as HTMLInputElement).checked);
    flash();
  });
  sw("tr-polish")?.addEventListener("change", (e) => {
    ctx.translation.update({ polish: (e.target as HTMLInputElement).checked });
    flash();
  });
  sw("tr-online")?.addEventListener("change", (e) => {
    const onlineOk = (e.target as HTMLInputElement).checked;
    ctx.translation.update({ onlineOk });
    if (onlineOk) {
      toast("Tradutor online permitido: com ele escolhido, os trechos vão para o MyMemory.", "info", 5000);
    }
    flash();
  });
  const provDesc = q("[data-prov-desc]");
  const paintProvider = () => {
    const id = host.querySelector<HTMLInputElement>('input[name="prov"]:checked')?.value as ProviderChoice | undefined;
    provDesc.textContent = PROVIDERS.find((p) => p.id === id)?.desc ?? "";
  };
  paintProvider();
  host.querySelectorAll<HTMLInputElement>('input[name="prov"]').forEach((r) =>
    r.addEventListener("change", () => {
      const escolha = r.value as ProviderChoice;
      ctx.translation.update({ provider: escolha });
      if (escolha === "online" && !ctx.translation.settings.onlineOk) {
        toast(
          "O tradutor online está desligado. Ligue “Permitir o tradutor online” para usá-lo — por enquanto a tradução continua no seu PC.",
          "info",
          6500
        );
      }
      paintProvider();
      flash();
    })
  );
  const email = sw("email");
  email.addEventListener("change", () => {
    ctx.translation.update({ email: email.value.trim() });
    flash();
  });
  const gloss = q<HTMLTextAreaElement>('[data-k="gloss"]');
  gloss.value = tr.glossary.map((g) => (g.en ? `${g.pt} = ${g.en}` : g.pt)).join("\n");
  gloss.addEventListener("change", () => {
    const glossary = gloss.value
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean)
      .map((l) => {
        const i = l.indexOf("=");
        return i < 0 ? { pt: l, en: "" } : { pt: l.slice(0, i).trim(), en: l.slice(i + 1).trim() };
      })
      .filter((g) => g.pt);
    ctx.translation.update({ glossary });
    flash();
  });
  const dl = q<HTMLButtonElement>('[data-act="dl"]');
  const dlStatus = q("[data-dl-status]");
  const paintOffline = () => {
    const st = off.status;
    if (st.state === "ready" || (off.downloaded && st.state === "idle")) {
      dl.textContent = "Modelo offline instalado";
      dl.disabled = true;
      dlStatus.textContent = "Pronto para usar sem internet.";
    } else if (st.state === "loading") {
      dl.textContent = "Baixando…";
      dl.disabled = true;
      dlStatus.textContent = st.message;
    } else {
      dl.textContent = "Baixar modelo offline";
      dl.disabled = false;
      dlStatus.textContent = st.state === "error" ? st.message : "Ainda não instalado.";
    }
  };
  paintOffline();
  const prev = off.onStatus;
  off.onStatus = (st) => {
    prev?.(st);
    if (host.isConnected) paintOffline();
  };
  dl.addEventListener("click", () => {
    off.warmUp();
    paintOffline();
  });
  on('[data-act="clear-tr"]', "click", () => {
    ctx.translation.clearCache();
  });

  // histórico e salvamento
  sw("autosave")?.addEventListener("change", (e) => {
    ctx.patch({ autosaveOn: (e.target as HTMLInputElement).checked });
    flash();
  });
  sw("hist")?.addEventListener("change", (e) => {
    ctx.patch({ historyOn: (e.target as HTMLInputElement).checked });
    flash();
  });
  // No navegador o rascunho precisa de uma pasta de verdade. A escolha guarda o
  // handle no IndexedDB (o mesmo das pastas de projeto), então sobrevive a reabrir.
  if (!nativo) {
    let pastaRascunhos: DraftFolder | null = null;
    const paintDraftsRoot = () => {
      const el = host.querySelector<HTMLElement>("[data-drafts-root]");
      const limpar = host.querySelector<HTMLButtonElement>('[data-act="drafts-clear"]');
      if (!el) return;
      el.textContent = pastaRascunhos
        ? `${pastaRascunhos.nome || "Pasta escolhida"} — o autosave grava os documentos novos ali, como arquivos de verdade`
        : "Nenhuma pasta escolhida — o rascunho de um documento novo não é gravado. Escolha uma pasta para o autosave gravar de verdade.";
      if (limpar) limpar.hidden = !pastaRascunhos;
    };
    void draftFolderInfo()
      .then((info) => {
        pastaRascunhos = info;
        paintDraftsRoot();
      })
      .catch(() => paintDraftsRoot());
    on('[data-act="drafts-dir"]', "click", async () => {
      try {
        const escolhida = await pickFolders();
        if (!escolhida.length) return;
        pastaRascunhos = await setDraftFolder(escolhida[0]);
        paintDraftsRoot();
        flash();
        ctx.salvarRascunhoAgora();
        toast("Pasta dos rascunhos definida: os documentos novos passam a ser gravados nela.", "ok", 4200);
      } catch (e) {
        toast("Não foi possível usar essa pasta: " + e, "err", 5000);
      }
    });
    on('[data-act="drafts-clear"]', "click", async () => {
      try {
        await clearDraftFolder();
        pastaRascunhos = null;
        paintDraftsRoot();
        flash();
        toast("Pasta dos rascunhos removida. Os documentos novos voltam a usar a pasta concedida ao app.", "info", 4200);
      } catch (e) {
        toast("Não foi possível remover a pasta: " + e, "err", 5000);
      }
    });
  }
  ligarDd("hist-max", [20, 40, 60, 100, 200].map((n) => [String(n), `${n} versões`] as [string, string]), (valor) => {
    ctx.patch({ historyMax: Number(valor) || 60 });
    flash();
  });
  // Histórico e salvamento: as três camadas (versões e alterações no banco do app, cópias
  // datadas em disco) aparecem resumidas, e dá para recuperar versão, alteração e cópia
  // sem sair do app. O "Apagar" limpa as duas camadas do app + o log exportado.
  let visao: HistoricoVisao | null = null;
  const copiasDeOutro = new Map<string, CopiaDiscoResumo[]>();
  const expandidos = new Set<string>();

  const quandoCurto = (at: number) =>
    new Date(at).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
  const haQuanto = (at: number | null): string => {
    if (!at) return "—";
    const s = Math.round((Date.now() - at) / 1000);
    if (s < 60) return "agora há pouco";
    const m = Math.round(s / 60);
    if (m < 60) return `há ${m} min`;
    const h = Math.round(m / 60);
    if (h < 24) return `há ${h} h`;
    const d = Math.round(h / 24);
    return d === 1 ? "ontem" : `há ${d} dias`;
  };
  const rotuloPasta = (local: CopiaDiscoResumo["local"]) =>
    local === "usuario" ? "pasta escolhida" : local === "app" ? "pasta do app" : "outra pasta";
  const localDaRaiz = (root: string): CopiaDiscoResumo["local"] => {
    const r = root.toLowerCase();
    const usuario = (ctx.settings().backupRoot ?? "").toLowerCase();
    const app = (visao?.raizApp ?? "").toLowerCase();
    if (usuario && r === usuario) return "usuario";
    if (app && r === app) return "app";
    return "outra";
  };
  const iconeLinha = (icone: string): HTMLElement => {
    const span = el("span", "st-row-ic");
    span.innerHTML = `<svg class="ic"><use href="#${icone}"/></svg>`;
    return span;
  };
  /** Uma cópia datada com [Restaurar] e [Apagar] — restaurar devolve ao arquivo original. */
  const linhaCopia = (doc: string, c: CopiaDiscoResumo): HTMLElement => {
    const row = el("div", "st-row");
    row.title = c.name;
    row.append(iconeLinha(c.protection ? "i-shield" : "i-copy"));
    const txt = el("span", "st-text");
    const b = el("b");
    b.append(document.createTextNode(`${quandoCurto(c.at)} `));
    if (c.protection) b.append(el("em", "st-tag", "proteção"));
    txt.append(b, el("small", undefined, `${backup.tamanhoLegivel(c.bytes)} · ${rotuloPasta(c.local)} · ${haQuanto(c.at)}`));
    const btns = el("span", "st-btns");
    const restaurar = el("button", "btn small st-btn", "Restaurar");
    restaurar.type = "button";
    restaurar.title = "Devolve esta cópia para o arquivo original (o estado de agora é guardado antes)";
    restaurar.addEventListener("click", async () => {
      restaurar.disabled = true;
      if (await ctx.restaurarCopia(doc, c.root, c.name)) await pintarHistorico();
      else restaurar.disabled = false;
    });
    const apagar = el("button", "btn small st-btn danger", "Apagar");
    apagar.type = "button";
    apagar.addEventListener("click", async () => {
      try {
        await backup.apagarCopia(doc, c.root, c.name);
        toast("Cópia apagada.", "info", 2400);
        await pintarHistorico();
      } catch (e) {
        toast("Não foi possível apagar: " + e, "err", 5000);
      }
    });
    btns.append(restaurar, apagar);
    row.append(txt, btns);
    return row;
  };

  const pintarResumo = () => {
    const v = visao;
    if (!v) return;
    const linhas = [q("[data-hist-versoes]"), q("[data-hist-alteracoes]"), q("[data-hist-copias]")];
    if (!v.doc) {
      for (const l of linhas) l.textContent = "Abra (ou salve) um documento para ver o histórico dele.";
    } else {
      linhas[0].textContent = v.versoes.total
        ? `${v.versoes.total} versão(ões) · ${v.versoes.marcadas} marcada(s) · última ${haQuanto(v.versoes.ultimaEm)} (${v.versoes.ultimoNome})`
        : "Nenhuma versão ainda — elas entram sozinhas a cada 5 min e ao salvar.";
      linhas[1].textContent = v.alteracoes.total
        ? `${v.alteracoes.total} mudança(s) · última ${haQuanto(v.alteracoes.ultimaEm)} (${v.alteracoes.ultimoResumo})`
        : "Nenhuma mudança registrada ainda.";
      linhas[2].textContent = v.copias.total
        ? `${v.copias.total} cópia(s) · ${backup.tamanhoLegivel(v.copias.bytes)} · última ${haQuanto(v.copias.ultimaEm)}`
        : "Nenhuma cópia em disco ainda — são gravadas ao salvar e ao sair de um documento com alterações.";
    }
    q("[data-backup-app]").textContent = v.raizApp || "só existe na janela do app";
    q("[data-hist-sumidos]").textContent = v.sumidos
      ? `${v.sumidos} arquivo(s) com o original apagado — a cópia está no backup.`
      : "Nenhum arquivo apagado por enquanto.";
    (q('[data-act="hist-recuperar"]') as HTMLButtonElement).disabled = !v.sumidos;
    for (const sel of ['[data-act="hist-versoes"]', '[data-act="hist-alteracoes"]', '[data-act="hist-backup"]', '[data-act="hist-apagar"]']) {
      (q(sel) as HTMLButtonElement).disabled = !v.doc;
    }
  };

  const pintarCopiasDoc = () => {
    const host = q("[data-copias-doc]");
    host.textContent = "";
    const v = visao;
    if (!v?.doc) {
      host.append(el("p", "st-list-note", "Abra (ou salve) um documento para ver as cópias dele."));
      return;
    }
    if (!v.copiasDetalhe.length) {
      host.append(el("p", "st-list-note", "Nenhuma cópia em disco ainda — elas são gravadas ao salvar, ao sair do documento com alterações e uma vez por dia."));
      return;
    }
    for (const c of v.copiasDetalhe) host.append(linhaCopia(v.doc, c));
  };

  const alternarOutro = async (original: string) => {
    if (expandidos.has(original)) {
      expandidos.delete(original);
    } else {
      if (!copiasDeOutro.has(original)) {
        const entry = await backup.listar(original);
        copiasDeOutro.set(
          original,
          entry.copies.map((c) => ({ root: c.root, name: c.name, stamp: c.stamp, bytes: c.bytes, at: c.at, protection: c.protection, local: localDaRaiz(c.root) }))
        );
      }
      expandidos.add(original);
    }
    pintarOutros();
  };

  const pintarOutros = () => {
    const host = q("[data-copias-outros]");
    host.textContent = "";
    const lista = visao?.outros ?? [];
    if (!lista.length) {
      host.append(el("p", "st-list-note", "Nenhum outro documento com backup ainda."));
      return;
    }
    for (const o of lista) {
      const aberto = expandidos.has(o.original);
      const row = el("button", "st-row st-row-clique") as HTMLButtonElement;
      row.type = "button";
      row.title = o.original;
      row.append(iconeLinha("i-doc"));
      const txt = el("span", "st-text");
      txt.append(
        el("b", undefined, baseName(o.original)),
        el("small", undefined, `${o.copias} cópia(s) · ${backup.tamanhoLegivel(o.bytes)} · mais recente ${quandoCurto(o.newest)}`)
      );
      row.append(txt);
      row.insertAdjacentHTML("beforeend", `<svg class="ic st-chev${aberto ? " open" : ""}"><use href="#i-chevron"/></svg>`);
      row.addEventListener("click", () => void alternarOutro(o.original));
      host.append(row);
      if (!aberto) continue;
      const copias = copiasDeOutro.get(o.original);
      if (!copias) host.append(el("p", "st-list-note", "Carregando cópias…"));
      else if (!copias.length) host.append(el("p", "st-list-note", "Nenhuma cópia encontrada."));
      else for (const c of copias) host.append(linhaCopia(o.original, c));
    }
  };

  async function pintarHistorico(): Promise<void> {
    visao = await ctx.historicoVisao();
    pintarResumo();
    pintarCopiasDoc();
    pintarOutros();
  }
  void pintarHistorico();

  const btnApagar = q<HTMLButtonElement>('[data-act="hist-apagar"]');
  let apagarArmado = false;
  let apagarTimer: number | undefined;
  const desarmarApagar = () => {
    apagarArmado = false;
    btnApagar.textContent = "Apagar…";
    btnApagar.classList.remove("confirmando");
  };
  btnApagar.addEventListener("click", async () => {
    if (!apagarArmado) {
      apagarArmado = true;
      btnApagar.textContent = "Confirmar?";
      btnApagar.classList.add("confirmando");
      window.clearTimeout(apagarTimer);
      apagarTimer = window.setTimeout(desarmarApagar, 4000);
      return;
    }
    window.clearTimeout(apagarTimer);
    desarmarApagar();
    await ctx.apagarHistoricoDoDoc();
    await pintarHistorico();
  });
  on('[data-act="hist-versoes"]', "click", () => ctx.openHistory("versoes"));
  on('[data-act="hist-alteracoes"]', "click", () => ctx.openHistory("alteracoes"));
  on('[data-act="hist-backup"]', "click", () => ctx.openHistory("backup"));
  on('[data-act="hist-recuperar"]', "click", () => ctx.abrirRecuperacao());

  // backup em disco
  let backupRoot = s.backupRoot;
  const paintBackupProfile = () => {
    const perfil = ctx.settings().backupProfile;
    const p = backup.PERFIS.find((x) => x.id === perfil);
    q("[data-backup-profile-desc]").textContent = p ? p.desc : "";
    const custom = perfil === "personalizado";
    q("[data-backup-custom]").hidden = !custom;
    q("[data-backup-custom2]").hidden = !custom;
  };
  const paintBackupRoot = () => {
    q("[data-backup-root]").textContent = nativo
      ? backupRoot || "Nenhuma pasta escolhida (o backup fica só na pasta do app)"
      : "A pasta que você concedeu ao app — o backup fica dentro dela, em .mdoffice/backups";
  };
  const paintBackupSize = () =>
    void backup.indice().then((idx) => {
      const el = q("[data-backup-size]");
      el.textContent = idx.copies
        ? `${backup.tamanhoLegivel(idx.bytes)} em ${idx.copies} cópia(s), de ${idx.files.length} documento(s)`
        : "Nenhuma cópia ainda.";
    });
  paintBackupProfile();
  paintBackupRoot();
  paintBackupSize();

  sw("backup")?.addEventListener("change", (e) => {
    ctx.patch({ backupOn: (e.target as HTMLInputElement).checked });
    flash();
  });
  sw("backupwarn")?.addEventListener("change", (e) => {
    ctx.patch({ backupWarnMissing: (e.target as HTMLInputElement).checked });
    flash();
  });
  ligarDd("backup-profile", backup.PERFIS.map((p) => [p.id, p.nome] as [string, string]), (valor) => {
    ctx.patch({ backupProfile: valor as AppSettings["backupProfile"] });
    paintBackupProfile();
    flash();
  });
  ligarDd("backup-copies", [10, 20, 50, 100, 200, 500, 0].map((n) => [String(n), n === 0 ? "sem limite" : `${n} cópias`] as [string, string]), (valor) => {
    ctx.patch({ backupCopies: Number(valor) || 0 });
    flash();
  });
  ligarDd("backup-days", [7, 30, 90, 365, 0].map((n) => [String(n), n === 0 ? "sem prazo" : n === 365 ? "1 ano" : `${n} dias`] as [string, string]), (valor) => {
    ctx.patch({ backupDays: Number(valor) || 0 });
    flash();
  });
  // os três botões de pasta do backup só existem no app nativo; no navegador o `on`
  // estourava com o seletor ausente e derrubava o resto da página de Configurações
  host.querySelector('[data-act="backup-dir"]')?.addEventListener("click", async () => {
    try {
      const escolhida = await pickFolders();
      if (!escolhida.length) return;
      backupRoot = await backup.prepararPasta(escolhida[0]);
      ctx.patch({ backupRoot });
      paintBackupRoot();
      flash();
      toast("Pasta de backup definida.", "ok", 2600);
      await pintarHistorico();
    } catch (e) {
      toast("Não foi possível usar essa pasta: " + e, "err", 5000);
    }
  });
  host.querySelector('[data-act="backup-open"]')?.addEventListener("click", async () => {
    if (!backupRoot) {
      toast("Nenhuma pasta escolhida — use “Trocar…” para definir uma.", "info", 3400);
      return;
    }
    try {
      await revealItemInDir(backupRoot);
    } catch {
      toast("Não foi possível abrir a pasta.", "err", 4000);
    }
  });
  host.querySelector('[data-act="backup-open-app"]')?.addEventListener("click", async () => {
    try {
      const pasta = visao?.raizApp || (await backup.pastaDoApp());
      await revealItemInDir(pasta);
    } catch {
      toast("Não foi possível abrir a pasta.", "err", 4000);
    }
  });
  on('[data-act="backup-prune"]', "click", async () => {
    const atual = ctx.settings();
    const numeros = backup.numerosDoPerfil(atual.backupProfile, atual.backupCopies, atual.backupDays);
    try {
      const n = await backup.limpar(numeros.copias, numeros.dias);
      toast(n ? `${n} cópia(s) antiga(s) apagada(s).` : "Nada a apagar com a política atual.", "ok", 3200);
      paintBackupSize();
      await pintarHistorico();
    } catch (e) {
      toast("Não foi possível limpar: " + e, "err", 5000);
    }
  });

  // armazenamento
  const bytes = (n: number) => backup.tamanhoLegivel(n);
  const setTxt = (sel: string, txt: string) => {
    const el = host.querySelector<HTMLElement>(sel);
    if (el) el.textContent = txt;
  };
  const paintArmazenamento = () => {
    void (async () => {
      const [vers, log, idx, drafts, rep, cache] = await Promise.all([
        resumoVersoes(),
        resumoLog(),
        backup.indice().catch(() => ({ roots: [], files: [], copies: 0, bytes: 0 })),
        listDrafts().catch(() => []),
        relatorioArmazenamento().catch(() => null),
        limiteDoCache().catch(() => null),
      ]);
      const rascunhosBytes = drafts.reduce((a, d) => a + (d.bytes ?? 0), 0);
      setTxt("[data-arm-vers]", vers.versoes ? `${vers.versoes} versão(ões) em ${vers.docs} documento(s) — ≈ ${bytes(vers.bytes)}` : "Nenhuma versão guardada.");
      setTxt("[data-arm-log]", log.commits ? `${log.commits} alteração(ões) em ${log.docs} documento(s) — ≈ ${bytes(log.bytes)}` : "Nenhuma alteração guardada.");
      setTxt("[data-arm-backup]", idx.copies ? `${idx.copies} cópia(s) de ${idx.files.length} documento(s) — ${bytes(idx.bytes)}` : "Nenhuma cópia ainda.");
      setTxt("[data-arm-drafts]", drafts.length ? `${drafts.length} rascunho(s) — ${bytes(rascunhosBytes)}` : "Nenhum rascunho.");
      const dataBytes = rep?.data_bytes ?? 0;
      const outros = Math.max(0, dataBytes - vers.bytes - log.bytes - idx.bytes - rascunhosBytes);
      setTxt("[data-arm-other]", rep ? `${bytes(outros)} — cache do WebView e preferências (se recria sozinho)` : "indisponível fora do app.");
      // Cache do WebView: o que está em disco agora e o teto escolhido. O teto vale na próxima
      // abertura (o WebView só lê o argumento quando a janela é criada), então enquanto o
      // escolhido for diferente do que está em uso a linha avisa.
      const teto = cache?.limite_mb ?? 0;
      const emUso = cache?.aplicado_mb ?? 0;
      const seletorCache = host.querySelector<HTMLSelectElement>('[data-k="cache-limite"]');
      if (seletorCache && cache) seletorCache.value = String(teto); // o setter do seletor sincroniza o rótulo
      const rotuloTeto = teto === 0 ? "automático (o WebView decide)" : bytes(teto * 1024 * 1024);
      const pendente = teto !== emUso ? " — vale na próxima abertura do app" : "";
      setTxt(
        "[data-arm-cache]",
        rep ? `${bytes(rep.cache_bytes)} agora — limite: ${rotuloTeto}${pendente}` : "indisponível fora do app."
      );
      const total = dataBytes + (rep?.legacy_bytes ?? 0);
      setTxt(
        "[data-arm-total]",
        rep ? `${bytes(total)} — dados do app ${bytes(dataBytes)}${rep.legacy_dir ? ` + versão anterior ${bytes(rep.legacy_bytes)}` : ""}` : "indisponível fora do app."
      );
      const bloco = host.querySelector<HTMLElement>("[data-arm-legacy]");
      if (bloco) {
        bloco.hidden = !(rep?.legacy_dir && rep.legacy_bytes > 0);
        if (!bloco.hidden) setTxt("[data-arm-legacy-txt]", `${bytes(rep!.legacy_bytes)} em ${rep!.legacy_dir} — a migração já copiou o que importava`);
      }
      const partes = [
        { nome: "Versões", bytes: vers.bytes, cor: "var(--accent)" },
        { nome: "Log", bytes: log.bytes, cor: "color-mix(in srgb, var(--accent) 55%, transparent)" },
        { nome: "Backup", bytes: idx.bytes, cor: "var(--fi-ppt, #e11d48)" },
        { nome: "Rascunhos", bytes: rascunhosBytes, cor: "#f59e0b" },
        { nome: "Outros", bytes: outros, cor: "var(--muted)" },
      ].filter((p) => p.bytes > 0);
      const soma = partes.reduce((a, p) => a + p.bytes, 0) || 1;
      const barra = host.querySelector<HTMLElement>("[data-arm-barra]");
      if (barra) barra.innerHTML = partes.map((p) => `<span style="width:${(100 * p.bytes) / soma}%;background:${p.cor}" title="${p.nome}: ${bytes(p.bytes)}"></span>`).join("");
      const legenda = host.querySelector<HTMLElement>("[data-arm-legenda]");
      if (legenda) legenda.innerHTML = partes.map((p) => `<span><i style="background:${p.cor}"></i>${p.nome} · ${bytes(p.bytes)}</span>`).join("");
    })();
  };
  paintArmazenamento();
  on('[data-act="arm-clear-vers"]', "click", async () => {
    if (!(await ask("Apagar TODAS as versões guardadas de todos os documentos? O texto atual não muda.", { title: "Limpar versões", kind: "warning" }))) return;
    const n = await limparVersoesTudo();
    toast(n ? `${n} versão(ões) apagada(s).` : "Não havia versões guardadas.", "ok", 3200);
    paintArmazenamento();
  });
  on('[data-act="arm-clear-log"]', "click", async () => {
    if (!(await ask("Apagar o log de alterações de todos os documentos? A aba Alterações do histórico fica vazia.", { title: "Limpar log", kind: "warning" }))) return;
    const n = await limparLogTudo();
    toast(n ? `${n} alteração(ões) apagada(s).` : "Não havia alterações guardadas.", "ok", 3200);
    paintArmazenamento();
  });
  on('[data-act="arm-open-backup"]', "click", async () => {
    try {
      await revealItemInDir(await backup.pastaDoApp());
    } catch {
      toast("Não foi possível abrir a pasta.", "err", 4000);
    }
  });
  on('[data-act="arm-prune-backup"]', "click", async () => {
    const atual = ctx.settings();
    const numeros = backup.numerosDoPerfil(atual.backupProfile, atual.backupCopies, atual.backupDays);
    try {
      const n = await backup.limpar(numeros.copias, numeros.dias);
      toast(n ? `${n} cópia(s) antiga(s) apagada(s).` : "Nada a apagar com a política atual.", "ok", 3200);
      paintBackupSize();
      paintArmazenamento();
    } catch (e) {
      toast("Não foi possível limpar: " + e, "err", 5000);
    }
  });
  // no navegador o botão não existe (não há caminho para abrir no Explorador)
  host.querySelector('[data-act="arm-open-drafts"]')?.addEventListener("click", async () => {
    try {
      await revealItemInDir(await draftsFolder());
    } catch {
      toast("Não foi possível abrir a pasta.", "err", 4000);
    }
  });
  on('[data-act="arm-clear-drafts"]', "click", async () => {
    const lista = await listDrafts().catch(() => []);
    if (!lista.length) {
      toast("Nenhum rascunho para apagar.", "info", 2600);
      return;
    }
    if (!(await ask(`Apagar ${lista.length} rascunho(s) do app? Documentos já salvos em pasta não são afetados.`, { title: "Apagar rascunhos", kind: "warning" }))) return;
    for (const d of lista) {
      try {
        await deleteDraft(d.path);
      } catch {
        /* segue nos outros */
      }
    }
    toast(`${lista.length} rascunho(s) apagado(s).`, "ok", 3000);
    paintArmazenamento();
  });
  on('[data-act="arm-open-data"]', "click", async () => {
    try {
      const r = await relatorioArmazenamento();
      await revealItemInDir(r.data_dir);
    } catch {
      toast("Não foi possível abrir a pasta.", "err", 4000);
    }
  });
  on('[data-act="arm-remove-legacy"]', "click", async () => {
    const r = await relatorioArmazenamento().catch(() => null);
    if (!r?.legacy_dir) return;
    const confirmado = await ask(
      `Remover a pasta da versão anterior (${bytes(r.legacy_bytes)})?\n\n${r.legacy_dir}\n\nA migração já copiou rascunhos, backups e preferências para a pasta nova; isto só libera o espaço que ficou para trás.`,
      { title: "Remover dados antigos", kind: "warning" }
    );
    if (!confirmado) return;
    try {
      const liberado = await removerLegado();
      toast(liberado ? `Pasta antiga removida: ${bytes(liberado)} liberados.` : "Nada para remover.", "ok", 4200);
      paintArmazenamento();
    } catch (e) {
      toast(String(e), "err", 6000);
    }
  });
  // Teto do cache do WebView: guardado no lado Rust, porque é ele quem monta a janela e passa
  // o `--disk-cache-size`. A escolha só passa a valer quando o app abrir de novo.
  ligarDd("cache-limite", LIMITES_DE_CACHE, async (valor) => {
    const mb = Number(valor) || 0;
    try {
      const cfg = await definirLimiteDoCache(mb);
      flash();
      toast(
        cfg.limite_mb === 0
          ? "Cache do WebView: automático — vale na próxima abertura do app."
          : `Cache do WebView: até ${bytes(cfg.limite_mb * 1024 * 1024)} — vale na próxima abertura do app.`,
        "ok",
        4200
      );
    } catch (e) {
      toast("Não foi possível guardar o limite do cache: " + e, "err", 5200);
    }
    paintArmazenamento(); // mostra o limite guardado (e avisa se ainda não valeu)
  });

  // aparência
  host.querySelectorAll<HTMLInputElement>('input[name="tema"]').forEach((r) =>
    r.addEventListener("change", () => {
      if (!r.checked) return;
      ctx.setDark(r.value === "escuro");
      flash();
    })
  );
  host.querySelectorAll<HTMLInputElement>('input[name="animacao"]').forEach((r) =>
    r.addEventListener("change", () => {
      if (!r.checked) return;
      ctx.setAnimacao(r.value === "discreta" ? "discreta" : r.value === "completa" ? "completa" : "padrao");
      flash();
    })
  );
  host.querySelectorAll<HTMLInputElement>('input[name="cantos"]').forEach((r) =>
    r.addEventListener("change", () => {
      if (!r.checked) return;
      ctx.setCantos(r.value === "quadrados" ? "quadrados" : "redondos");
      flash();
    })
  );
  sw("sidebar")?.addEventListener("change", () => {
    ctx.toggleFlag("no-sidebar");
    flash();
  });
  sw("preview")?.addEventListener("change", () => {
    ctx.toggleFlag("no-preview");
    flash();
  });
  ligarDd("draw", [["image", "Imagem (PNG)"], ["text", "Letras e símbolos"]], (valor) => {
    ctx.setDrawStyle(valor === "text" ? "text" : "image");
    flash();
  });
  host.querySelectorAll<HTMLInputElement>('input[name="appicon"]').forEach((r) =>
    r.addEventListener("change", () => {
      if (!r.checked) return;
      ctx.setAppIcon(r.value === "escuro" ? "escuro" : "claro");
      flash();
    })
  );

  // ---------------------------------------------------------------- PWA (instalar)
  //
  // O "instalador" é o do navegador: quando ele oferece o convite (`beforeinstallprompt`,
  // capturado em `src/app/pwa.ts`), a linha aparece e o botão abre o diálogo do Chrome/Edge.
  // Instalado, a linha continua visível só para explicar que já está pronto.
  const blocoPwa = q<HTMLElement>("[data-pwa-bloco]");
  if (blocoPwa && (podeInstalar() || jaInstalado())) {
    blocoPwa.hidden = false;
    const txt = q<HTMLElement>("[data-pwa-txt]");
    const botao = q<HTMLButtonElement>('[data-act="pwa-instalar"]');
    if (jaInstalado()) {
      txt.textContent = "O mdOffice já está instalado neste computador: abra pelo menu Iniciar, sem navegador em volta.";
      botao.hidden = true;
    } else {
      botao.addEventListener("click", async () => {
        const aceitou = await instalarApp();
        if (aceitou) {
          txt.textContent = "Instalado. O mdOffice agora abre pelo menu Iniciar.";
          botao.hidden = true;
          toast("mdOffice instalado neste computador.", "ok", 4000);
        } else {
          toast("A instalação foi cancelada. Você pode instalar depois pelo menu do navegador.", "info", 5000);
        }
      });
    }
  }

  // ---------------------------------------------------------------- atalhos
  //
  // Cada linha é um atalho de verdade: clicar na tecla entra em modo de escuta e a
  // próxima combinação pressionada vira a nova. Enquanto a escuta dura, o
  // `emCaptura(true)` cala o resto do app — sem isso, tentar trocar "Nova aba" para
  // Ctrl+T abriria uma aba no meio da troca.
  const notaAtalhos = q("[data-at-nota]");
  const botaoRestaurar = q<HTMLButtonElement>("[data-at-restaurar]");
  let escutando: { id: string; botao: HTMLButtonElement } | null = null;
  let limparNota: number | undefined;

  const avisar = (texto: string, ruim = true): void => {
    notaAtalhos.textContent = texto;
    notaAtalhos.classList.toggle("ruim", ruim);
    window.clearTimeout(limparNota);
    limparNota = window.setTimeout(() => {
      notaAtalhos.textContent = "";
      notaAtalhos.classList.remove("ruim");
    }, 4000);
  };

  /** Redesenha a linha conforme o que está valendo agora. */
  const pintarLinha = (id: string): void => {
    const linha = host.querySelector<HTMLElement>(`[data-at="${id}"]`);
    if (!linha) return;
    linha.querySelector("kbd")!.textContent = teclaVisivel(id);
    const voltar = linha.querySelector<HTMLButtonElement>("[data-voltar]");
    if (voltar) voltar.hidden = !foiTrocada(id);
  };

  const rotuloDe = (id: string): string => ATALHOS.find((a) => a.id === id)?.rotulo ?? "";

  const encerrarEscuta = (): void => {
    if (!escutando) return;
    const id = escutando.id;
    escutando.botao.classList.remove("escutando");
    escutando = null;
    emCaptura(false);
    document.removeEventListener("keydown", aoTeclar, true);
    pintarLinha(id); // devolve o texto da tecla no botão
  };

  function aoTeclar(e: KeyboardEvent): void {
    if (!escutando) return;
    // A página saiu da frente (outra aba, outro documento) ou foi redesenhada: a
    // escuta perdeu a validade. Sai antes do `preventDefault` para a tecla seguir o
    // caminho normal — assim nada é engolido à toa.
    if (host.offsetParent === null || !escutando.botao.isConnected) {
      encerrarEscuta();
      return;
    }
    // a tecla é daqui: não pode chegar ao editor nem aos atalhos do app
    e.preventDefault();
    e.stopPropagation();
    if (e.key === "Escape") {
      encerrarEscuta();
      return;
    }
    const combo = comboDeEvento(e);
    if (!combo) {
      avisar("Essa tecla sozinha atrapalharia a digitação — use Ctrl ou Alt junto. As teclas F1 a F12 valem sozinhas.");
      return;
    }
    const motivo = trocarTecla(escutando.id, combo);
    if (motivo) {
      avisar(motivo);
      return;
    }
    const id = escutando.id;
    encerrarEscuta();
    botaoRestaurar.hidden = quantasTrocadas() === 0;
    avisar(`${rotuloDe(id)} agora é ${combo}.`, false);
  }

  host.querySelectorAll<HTMLButtonElement>("[data-tecla]").forEach((b) =>
    b.addEventListener("click", () => {
      const id = b.dataset.tecla!;
      if (escutando?.id === id) {
        encerrarEscuta();
        return;
      }
      encerrarEscuta();
      escutando = { id, botao: b };
      b.classList.add("escutando");
      b.querySelector("kbd")!.textContent = "pressione…";
      emCaptura(true);
      document.addEventListener("keydown", aoTeclar, true);
    })
  );

  host.querySelectorAll<HTMLButtonElement>("[data-voltar]").forEach((b) =>
    b.addEventListener("click", () => {
      const id = b.dataset.voltar!;
      voltarAoPadrao(id);
      pintarLinha(id);
      botaoRestaurar.hidden = quantasTrocadas() === 0;
      avisar(`${rotuloDe(id)} voltou ao padrão (${teclaPadrao(id)}).`, false);
    })
  );

  botaoRestaurar.addEventListener("click", () => {
    voltarTudoAoPadrao();
    for (const a of ATALHOS) pintarLinha(a.id);
    botaoRestaurar.hidden = true;
    avisar("Todos os atalhos voltaram ao padrão.", false);
  });
}
