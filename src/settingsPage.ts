// Página de Configurações (abre como uma aba, ao lado dos documentos). Cada ajuste vale na hora.
import { toast, baseName } from "./util";
import * as backup from "./backup";
import { pickFolders, listDrafts, draftsFolder, deleteDraft } from "./files";
import { revealItemInDir } from "@tauri-apps/plugin-opener";
import { ask } from "@tauri-apps/plugin-dialog";
import { resumoVersoes, limparVersoesTudo } from "./history";
import { resumoLog, limparLogTudo } from "./snapshots";
import { relatorio as relatorioArmazenamento, removerLegado } from "./storage";
import { clearGhostMemory } from "./broker/ghost/memory";
import { limparAprendizado } from "./broker/aprendizado";
import { profileSummary } from "./broker/personal/profile";
import { llmEnabled, llmUseGpu, llmTypingSetting, setLlmEnabled, setLlmUseGpu, setLlmTyping } from "./broker/llm/config";
import { llmAvailable, llmDevice } from "./broker/llm/client";
import { getGhostMode, setGhostMode, clearFeedback, feedbackSummary, type GhostMode } from "./broker/personal/feedback";
import { limparRitmo, resumoRitmo } from "./broker/writing";
import type { Translation, ProviderChoice } from "./translate/controller";
import type { Tone } from "./broker/writing";
import type { AppSettings } from "./settings";
import type { AppIcon } from "./app/appIcon";
import type { AbaHistorico } from "./historyUi";


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
  /** Conserta blocos de alinhamento quebrados no Markdown (ferramenta de manutenção). */
  repairAlignments: () => void;
  /** Ícone da janela escolhido (claro/escuro). */
  appIcon: () => AppIcon;
  setAppIcon: (v: AppIcon) => void;
  /** Abre o menu suspenso do app (o mesmo do ⋯) ancorado no elemento. */
  menu: (ancora: HTMLElement, opcoes: { rotulo: string; ativo?: boolean; escolher: () => void }[]) => void;
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
  { id: "auto", title: "Automático", desc: "Usa o modo offline se já estiver instalado; senão o online. Se o limite do online acabar, troca sozinho." },
  { id: "online", title: "Online (grátis)", desc: "MyMemory. Bom para começar, mas tem limite diário e qualidade média." },
  { id: "offline", title: "Offline", desc: "Modelo no seu PC, sem limite e sem internet (baixa cerca de 120 MB uma vez)." },
];

const SHORTCUT_GROUPS: { title: string; keys: [string, string][] }[] = [
  {
    title: "Abas",
    keys: [
      ["Ctrl+T", "Nova aba"],
      ["Ctrl+W", "Fechar aba"],
      ["Ctrl+Shift+T", "Reabrir a última aba fechada"],
      ["Ctrl+Tab / Ctrl+1…9", "Trocar de aba"],
    ],
  },
  {
    title: "Arquivo",
    keys: [
      ["Ctrl+O / Ctrl+S", "Abrir / salvar"],
      ["Ctrl+Shift+S", "Salvar como"],
      ["Ctrl+Shift+E", "Exportar"],
      ["F2", "Renomear o documento"],
    ],
  },
  {
    title: "Escrita e IA",
    keys: [
      ["Ctrl+K", "Buscar comandos"],
      ["F7", "Revisar texto"],
      ["Ctrl+Alt+T", "Tradução automática"],
      ["Ctrl+Shift+D", "Desenhar"],
    ],
  },
  {
    title: "Janela e ajuda",
    keys: [
      ["Ctrl+Shift+F", "Modo foco (Esc sai)"],
      ["Ctrl+F1", "Recolher/expandir a faixa de opções"],
      ["F1", "Boas-vindas e ajuda"],
    ],
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
 * Botão que abre o menu do app no lugar de um `<select>` nativo: a lista do
 * `<select>` é desenhada pelo sistema (cinza claro) e não segue o tema.
 * `opcoes` = [valor, rótulo]; `atual` marca a escolhida no menu.
 */
function dd(chave: string, opcoes: [string, string][], atual: string): string {
  const rotulo = opcoes.find((o) => o[0] === atual)?.[1] ?? opcoes[0]?.[1] ?? "";
  return `<button type="button" class="st-select st-dd" data-dd="${chave}" data-valor="${atual}" aria-haspopup="menu"><span data-dd-txt>${rotulo}</span></button>`;
}

export function renderSettingsPage(host: HTMLElement, ctx: SettingsCtx, section: SettingsSection = "escrita"): void {
  const s = ctx.settings();
  const tr = ctx.translation.settings;
  const off = ctx.translation.offline;
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

          <h4 class="st-group">Digitação e sugestões</h4>
          <div class="st-list">
            ${toggle("autofix", "Correção automática", "Ponto final, vírgulas, maiúsculas, espaços e palavras erradas entram sozinhos (Ctrl+Z desfaz).", ctx.autoFix(), "i-brush")}
            ${toggle("copilot", "Sugestões enquanto digita", "Mostra a continuação da frase em cinza. Tab aceita; Alt+Seta aceita uma palavra.", ctx.copilot(), "i-spark")}
            <div class="st-row">
              ${rowIcon("i-focus")}
              <span class="st-text"><b>Intensidade das sugestões</b><small>Só aparece quando poupa digitação de verdade. Discreta: 4+ letras e só com muita certeza. Equilibrada: 3+ letras. Agressiva: 2+ letras, aparece mais e erra mais.</small></span>
              ${dd("ghostmode", [["discreto", "Discreta"], ["equilibrado", "Equilibrada"], ["agressivo", "Agressiva"]], getGhostMode())}
            </div>
          </div>

          <h4 class="st-group">IA local</h4>
          <div class="st-list">
            ${toggle("llm", "IA local na revisão inteligente", "Um modelo de linguagem pequeno (Gemma 3 270M, que já vem no app) confere cada troca de palavra sugerida. Roda em uma thread só, usa a GPU, trabalha só com o computador parado e sai da memória quando não está em uso. Nada sai do seu computador.", llmEnabled(), "i-shield")}
            ${toggle("llmtyping", "IA ajuda nas sugestões enquanto digito", "Numa pausa curta no meio de uma palavra, a IA local escolhe, entre os candidatos do modelo de palavras, o que combina com a frase (acerta bem mais). Só aparece quando a IA tem bastante certeza. Precisa da IA local e da GPU; carrega na primeira vez (alguns segundos) e sai da memória depois de 90 s parado.", llmTypingSetting(), "i-feather")}
            ${toggle("llmgpu", "Usar a GPU para a IA local", "A IA local só funciona na GPU (WebGPU). Se você desligar, ela fica inativa e a revisão usa só as regras.", llmUseGpu(), "i-grid")}
            <div class="st-row">
              ${rowIcon("i-check")}
              <span class="st-text"><b>Estado da IA local</b><small data-llm-status>verificando…</small></span>
            </div>
          </div>

          <h4 class="st-group">Aprendizado</h4>
          <div class="st-list">
            <div class="st-row">
              ${rowIcon("i-pilcrow")}
              <span class="st-text"><b>Seu estilo de escrita</b><small data-style-summary></small></span>
            </div>
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

          <h4 class="st-group">Limite e glossário</h4>
          <label class="st-field">
            <span class="st-field-label"><b>E-mail para ampliar o limite do modo online</b><small>Opcional — aumenta a cota diária do provedor online.</small></span>
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
              <span class="st-text"><b>Pasta escolhida por você</b><small data-backup-root>—</small></span>
              <span class="st-btns">
                <button class="btn small st-btn" data-act="backup-dir">Trocar…</button>
                <button class="btn small st-btn" data-act="backup-open">Abrir</button>
              </span>
            </div>
            <div class="st-row">
              ${rowIcon("i-folder")}
              <span class="st-text"><b>Pasta do app</b><small data-backup-app>—</small></span>
              <span class="st-btns"><button class="btn small st-btn" data-act="backup-open-app">Abrir</button></span>
            </div>
            <div class="st-row">
              ${rowIcon("i-doc")}
              <span class="st-text"><b>Log de alterações exportado</b><small>Vai junto de cada cópia, em <code>&lt;documento&gt;/.historico/historico.json</code> — sobrevive se os dados do app forem limpos.</small></span>
            </div>
            <p class="st-list-note">Versões e alterações ficam no banco local do app (não são arquivos soltos) e se recuperam pelas abas acima. As cópias em disco são arquivos datados de verdade, nas duas pastas.</p>
          </div>

          <h4 class="st-group">Salvamento</h4>
          <div class="st-list">
            ${toggle("autosave", "Salvamento automático", "Grava o documento sozinho enquanto você escreve. Desligue se quiser salvar apenas com Ctrl+S.", s.autosaveOn, "i-save")}
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
            ${toggle("backup", "Guardar cópia dos documentos em disco", "Ao salvar, ao sair de um documento com alterações e uma vez por dia. Também vale para Word, PowerPoint e Excel.", s.backupOn, "i-folder")}
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
                <button class="btn small st-btn" data-act="arm-open-drafts">Abrir pasta</button>
                <button class="btn small st-btn" data-act="arm-clear-drafts">Apagar</button>
              </span>
            </div>
            <div class="st-row">
              ${rowIcon("i-cloud")}
              <span class="st-text"><b>Outros dados do app</b><small data-arm-other>calculando…</small></span>
              <span class="st-btns"><button class="btn small st-btn" data-act="arm-open-data">Abrir pasta</button></span>
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
            <label class="st-opcao" title="Movimento mais longo, com mais relevo e cascata">
              <input type="radio" name="animacao" value="completa" ${ctx.animacao() === "completa" ? "checked" : ""}>
              <span class="st-opcao-previa st-anim-previa" data-anim="completa" aria-hidden="true"><span class="st-anim-bola"></span></span>
              <span class="st-opcao-nome">Completa</span>
            </label>
          </div>
          <p class="st-note">Vale para o app inteiro: entradas, cascatas, elevação ao passar o mouse e a troca de painéis.</p>

          <h4 class="st-group">Cantos</h4>
          <div class="st-opcoes" role="radiogroup" aria-label="Formato dos cantos">
            <label class="st-opcao" title="Cantos retos, cara de ferramenta">
              <input type="radio" name="cantos" value="quadrados" ${ctx.cantos() === "quadrados" ? "checked" : ""}>
              <span class="st-opcao-previa st-canto-previa" data-cantos="quadrados" aria-hidden="true">
                <span class="st-canto-barra"></span>
                <span class="st-canto-barra curta"></span>
              </span>
              <span class="st-opcao-nome">Quadrado</span>
            </label>
            <label class="st-opcao" title="Cantos bem suaves, arredondados">
              <input type="radio" name="cantos" value="redondos" ${ctx.cantos() === "redondos" ? "checked" : ""}>
              <span class="st-opcao-previa st-canto-previa" data-cantos="redondos" aria-hidden="true">
                <span class="st-canto-barra"></span>
                <span class="st-canto-barra curta"></span>
              </span>
              <span class="st-opcao-nome">Redondo</span>
            </label>
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
              <p class="st-lead">Os principais atalhos do teclado.</p>
            </div>
          </header>
          ${SHORTCUT_GROUPS.map(
            (g) => `<h4 class="st-group">${g.title}</h4>
          <div class="st-keys-card">
            <div class="st-keys">
              ${g.keys.map(([k, d]) => `<div class="st-key"><span>${d}</span><kbd>${k}</kbd></div>`).join("")}
            </div>
          </div>`
          ).join("")}
        </section>
      </div>
    </div>

    <!-- Confirmação do ajuste. Fica solta no canto, e não numa barra fixa no topo:
         a barra repetia o nome da seção que aparece logo abaixo dela, e o "Salvo"
         precisa estar à vista onde a pessoa acabou de clicar — não no alto. -->
    <span class="st-saved" aria-live="polite"></span>`;

  const q = <T extends HTMLElement>(sel: string) => host.querySelector<T>(sel)!;
  const saved = q(".st-saved");
  let savedTimer: number | undefined;
  const flash = () => {
    saved.textContent = "✓ Salvo";
    window.clearTimeout(savedTimer);
    savedTimer = window.setTimeout(() => (saved.textContent = ""), 1600);
  };
  const on = (sel: string, ev: string, fn: (e: Event) => void) => q(sel).addEventListener(ev, fn);
  const sw = (key: string) => q<HTMLInputElement>(`[data-k="${key}"]`);
  /** Cria um elemento já com classe e texto (as linhas do histórico são montadas na mão). */
  const el = <K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, texto?: string): HTMLElementTagNameMap[K] => {
    const node = document.createElement(tag);
    if (cls) node.className = cls;
    if (texto !== undefined) node.textContent = texto;
    return node;
  };

  /** Liga um dropdown `dd()`: clicar abre o menu do app e a escolha atualiza o botão. */
  const ligarDd = (chave: string, opcoes: [string, string][], aoEscolher: (valor: string) => void): void => {
    const btn = q<HTMLButtonElement>(`[data-dd="${chave}"]`);
    btn.addEventListener("click", () => {
      const atual = btn.dataset.valor ?? "";
      ctx.menu(
        btn,
        opcoes.map(([valor, rotulo]) => ({
          rotulo,
          ativo: valor === atual,
          escolher: () => {
            btn.dataset.valor = valor;
            const txt = btn.querySelector<HTMLElement>("[data-dd-txt]");
            if (txt) txt.textContent = rotulo;
            aoEscolher(valor);
          },
        }))
      );
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
  sw("autofix").addEventListener("change", (e) => {
    ctx.setAutoFix((e.target as HTMLInputElement).checked);
    flash();
  });
  sw("copilot").addEventListener("change", (e) => {
    ctx.setCopilot((e.target as HTMLInputElement).checked);
    flash();
  });
  const paintDict = () => {
    const n = ctx.dictionaryCount();
    q("[data-dict-count]").textContent = n ? `${n} palavra(s) que você mandou ignorar` : "Nenhuma palavra ainda — clique numa palavra sublinhada e escolha “Adicionar ao dicionário”.";
  };
  const paintLlm = async () => {
    const el = q("[data-llm-status]");
    const gpu = (navigator as unknown as { gpu?: { requestAdapter: () => Promise<unknown> } }).gpu;
    const [modelo, adapter] = await Promise.all([llmAvailable(), gpu ? gpu.requestAdapter().catch(() => null) : Promise.resolve(null)]);
    if (!llmEnabled()) el.textContent = "Desligada.";
    else if (!modelo) el.textContent = "O modelo não está nesta cópia do app (rode \"npm run prep:modelo\" antes de gerar o instalador).";
    else if (!adapter) el.textContent = "Este computador não oferece WebGPU, então a IA local fica inativa. As revisões seguem só com as regras.";
    else if (!llmUseGpu()) el.textContent = "A GPU está desligada nas configurações: a IA local fica inativa.";
    else el.textContent = `Pronta (GPU${llmDevice() ? ", em uso agora" : ""}). Carrega ao fazer uma revisão e sai da memória após 90 s parada.`;
  };
  void paintLlm();
  sw("llm").addEventListener("change", (e) => {
    setLlmEnabled((e.target as HTMLInputElement).checked);
    void paintLlm();
    flash();
  });
  sw("llmtyping").addEventListener("change", (e) => {
    setLlmTyping((e.target as HTMLInputElement).checked);
    flash();
  });
  sw("llmgpu").addEventListener("change", (e) => {
    setLlmUseGpu((e.target as HTMLInputElement).checked);
    void paintLlm();
    flash();
  });
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
  ligarDd("ghostmode", [["discreto", "Discreta"], ["equilibrado", "Equilibrada"], ["agressivo", "Agressiva"]], (valor) => {
    setGhostMode(valor as GhostMode);
    flash();
  });
  paintDict();
  on('[data-act="forget-ghost"]', "click", () => {
    clearGhostMemory();
    clearFeedback();
    limparRitmo();
    limparAprendizado();
    paintStyle();
    toast("As sugestões, a correção automática e o corretor esqueceram o que aprenderam.", "ok", 2600);
  });
  on('[data-act="dict"]', "click", () => {
    ctx.openDictionary();
  });
  on('[data-act="repair-align"]', "click", () => {
    ctx.repairAlignments();
  });

  // tradução
  sw("tr-on").addEventListener("change", (e) => {
    ctx.translation.setEnabled((e.target as HTMLInputElement).checked);
    flash();
  });
  sw("tr-polish").addEventListener("change", (e) => {
    ctx.translation.update({ polish: (e.target as HTMLInputElement).checked });
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
      ctx.translation.update({ provider: r.value as ProviderChoice });
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
  sw("autosave").addEventListener("change", (e) => {
    ctx.patch({ autosaveOn: (e.target as HTMLInputElement).checked });
    flash();
  });
  sw("hist").addEventListener("change", (e) => {
    ctx.patch({ historyOn: (e.target as HTMLInputElement).checked });
    flash();
  });
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
    q("[data-backup-root]").textContent = backupRoot || "Nenhuma pasta escolhida (o backup fica só na pasta do app)";
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

  sw("backup").addEventListener("change", (e) => {
    ctx.patch({ backupOn: (e.target as HTMLInputElement).checked });
    flash();
  });
  sw("backupwarn").addEventListener("change", (e) => {
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
  on('[data-act="backup-dir"]', "click", async () => {
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
  on('[data-act="backup-open"]', "click", async () => {
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
  on('[data-act="backup-open-app"]', "click", async () => {
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
      const [vers, log, idx, drafts, rep] = await Promise.all([
        resumoVersoes(),
        resumoLog(),
        backup.indice().catch(() => ({ roots: [], files: [], copies: 0, bytes: 0 })),
        listDrafts().catch(() => []),
        relatorioArmazenamento().catch(() => null),
      ]);
      const rascunhosBytes = drafts.reduce((a, d) => a + (d.bytes ?? 0), 0);
      setTxt("[data-arm-vers]", vers.versoes ? `${vers.versoes} versão(ões) em ${vers.docs} documento(s) — ≈ ${bytes(vers.bytes)}` : "Nenhuma versão guardada.");
      setTxt("[data-arm-log]", log.commits ? `${log.commits} alteração(ões) em ${log.docs} documento(s) — ≈ ${bytes(log.bytes)}` : "Nenhuma alteração guardada.");
      setTxt("[data-arm-backup]", idx.copies ? `${idx.copies} cópia(s) de ${idx.files.length} documento(s) — ${bytes(idx.bytes)}` : "Nenhuma cópia ainda.");
      setTxt("[data-arm-drafts]", drafts.length ? `${drafts.length} rascunho(s) — ${bytes(rascunhosBytes)}` : "Nenhum rascunho.");
      const dataBytes = rep?.data_bytes ?? 0;
      const outros = Math.max(0, dataBytes - vers.bytes - log.bytes - idx.bytes - rascunhosBytes);
      setTxt("[data-arm-other]", rep ? `${bytes(outros)} — cache do WebView e preferências (se recria sozinho)` : "indisponível fora do app.");
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
        { nome: "Backup", bytes: idx.bytes, cor: "var(--fi-ppt, #d24a17)" },
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
  on('[data-act="arm-open-drafts"]', "click", async () => {
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
  sw("sidebar").addEventListener("change", () => {
    ctx.toggleFlag("no-sidebar");
    flash();
  });
  sw("preview").addEventListener("change", () => {
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
}
