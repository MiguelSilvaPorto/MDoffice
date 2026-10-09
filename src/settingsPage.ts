// Página de Configurações (abre como uma aba, ao lado dos documentos). Cada ajuste vale na hora.
import { toast } from "./util";
import * as backup from "./backup";
import { pickFolders } from "./files";
import { revealItemInDir } from "@tauri-apps/plugin-opener";
import { clearGhostMemory } from "./broker/ghost/memory";
import { profileSummary } from "./broker/personal/profile";
import { llmEnabled, llmUseGpu, llmTypingSetting, setLlmEnabled, setLlmUseGpu, setLlmTyping } from "./broker/llm/config";
import { llmAvailable, llmDevice } from "./broker/llm/client";
import { getGhostMode, setGhostMode, clearFeedback, feedbackSummary, type GhostMode } from "./broker/personal/feedback";
import type { Translation, ProviderChoice } from "./translate/controller";
import type { Tone } from "./broker/writing";
import type { AppSettings } from "./settings";


export type SettingsSection = "escrita" | "traducao" | "historico" | "aparencia" | "atalhos";

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
  flag: (cls: "no-sidebar" | "no-preview") => boolean;
  toggleFlag: (cls: "no-sidebar" | "no-preview") => void;
  drawStyle: () => "image" | "text";
  setDrawStyle: (s: "image" | "text") => void;
  historyCount: () => Promise<number>;
  clearHistory: () => Promise<void>;
  openHistory: () => void;
}

const NAV: { id: SettingsSection; label: string; desc: string; icon: string }[] = [
  { id: "escrita", label: "Escrita", desc: "Correção e sugestões", icon: "i-feather" },
  { id: "traducao", label: "Tradução", desc: "Inglês ao vivo e glossário", icon: "i-globe" },
  { id: "historico", label: "Histórico", desc: "Versões, backup e salvamento", icon: "i-clock" },
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
        <div class="st-headbar">
          <span class="st-heading"><svg class="ic"><use href="#i-feather" data-st-icon/></svg><b data-st-title>Escrita</b></span>
          <span class="st-saved" aria-live="polite"></span>
        </div>

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
              <select class="st-select" data-sel="ghostmode">
                <option value="discreto">Discreta</option>
                <option value="equilibrado">Equilibrada</option>
                <option value="agressivo">Agressiva</option>
              </select>
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
            <span class="st-field-label"><b>Glossário</b><small>Um termo por linha. <code>mdCreator</code> mantém o nome; <code>rascunho = draft</code> força a tradução.</small></span>
            <textarea data-k="gloss" rows="6" spellcheck="false" placeholder="mdCreator&#10;rascunho = draft"></textarea>
          </label>
          <div class="st-inline"><button class="btn small st-btn" data-act="clear-tr">Limpar memória de traduções</button></div>
        </section>

        <section class="st-sec" data-sec="historico">
          <header class="st-sec-head">
            <span class="st-sec-ic"><svg class="ic"><use href="#i-clock"/></svg></span>
            <div class="st-sec-txt">
              <h3>Histórico e salvamento</h3>
              <p class="st-lead">Salvamento contínuo, cópias do documento guardadas no app e o log de alterações para voltar atrás.</p>
            </div>
          </header>

          <h4 class="st-group">Salvamento e versões</h4>
          <div class="st-list">
            ${toggle("autosave", "Salvamento automático", "Grava o documento sozinho enquanto você escreve. Desligue se quiser salvar apenas com Ctrl+S.", s.autosaveOn, "i-save")}
            ${toggle("hist", "Guardar versões dos documentos", "Uma cópia automática a cada 5 minutos (se o texto mudou) e ao salvar.", s.historyOn, "i-clock")}
            <div class="st-row">
              ${rowIcon("i-list")}
              <span class="st-text"><b>Versões por documento</b><small>As marcadas por você (★) nunca são apagadas sozinhas.</small></span>
              <select data-k="hist-max" class="st-select">${[20, 40, 60, 100, 200].map((n) => `<option value="${n}" ${s.historyMax === n ? "selected" : ""}>${n} versões</option>`).join("")}</select>
            </div>
            ${toggle("commits", "Guardar o log de alterações", "Guarda só a instrução de cada mudança (o que saiu e o que entrou), não o arquivo inteiro. Dá para voltar a qualquer ponto pela aba Alterações do histórico.", s.commitsOn, "i-code")}
            <div class="st-row">
              ${rowIcon("i-doc")}
              <span class="st-text"><b>Este documento</b><small data-hist-count></small></span>
              <span class="st-btns">
                <button class="btn small st-btn" data-act="hist-open">Abrir histórico</button>
                <button class="btn small st-btn danger" data-act="hist-clear">Apagar</button>
              </span>
            </div>
          </div>

          <h4 class="st-group">Backup em disco</h4>
          <p class="st-sub">Uma cópia de verdade do arquivo, gravada em duas pastas ao mesmo tempo. Se uma falhar (HD desconectado, sem permissão), a outra ainda salva.</p>
          <div class="st-list">
            ${toggle("backup", "Guardar cópia dos documentos em disco", "Ao salvar, ao sair de um documento com alterações e uma vez por dia. Também vale para Word, PowerPoint e Excel.", s.backupOn, "i-folder")}
            ${toggle("backupwarn", "Avisar quando o original sumir", "Se você apagar um arquivo do disco, o app avisa na barra inferior e deixa restaurar pela cópia.", s.backupWarnMissing, "i-eye")}
            <div class="st-row">
              ${rowIcon("i-folder-plus")}
              <span class="st-text"><b>Pasta escolhida por você</b><small data-backup-root>—</small></span>
              <span class="st-btns">
                <button class="btn small st-btn" data-act="backup-dir">Escolher pasta…</button>
                <button class="btn small st-btn" data-act="backup-open">Abrir</button>
              </span>
            </div>
            <div class="st-row">
              ${rowIcon("i-trash")}
              <span class="st-text"><b>Política de limpeza</b><small>Quanto cada documento guarda antes de as cópias mais antigas saírem. As marcadas à mão nunca saem.</small></span>
              <select data-k="backup-profile" class="st-select">
                ${backup.PERFIS.map((p) => `<option value="${p.id}" ${s.backupProfile === p.id ? "selected" : ""}>${p.nome}</option>`).join("")}
              </select>
            </div>
            <p class="st-list-note" data-backup-profile-desc></p>
            <div class="st-row" data-backup-custom ${s.backupProfile === "personalizado" ? "" : "hidden"}>
              ${rowIcon("i-copy")}
              <span class="st-text"><b>Cópias por documento</b><small>0 = guardar quantas existirem, sem limite de quantidade.</small></span>
              <select data-k="backup-copies" class="st-select">${[10, 20, 50, 100, 200, 500, 0].map((n) => `<option value="${n}" ${s.backupCopies === n ? "selected" : ""}>${n === 0 ? "sem limite" : `${n} cópias`}</option>`).join("")}</select>
            </div>
            <div class="st-row" data-backup-custom2 ${s.backupProfile === "personalizado" ? "" : "hidden"}>
              ${rowIcon("i-clock")}
              <span class="st-text"><b>Prazo</b><small>0 = não apagar por tempo (só pela quantidade acima).</small></span>
              <select data-k="backup-days" class="st-select">${[7, 30, 90, 365, 0].map((n) => `<option value="${n}" ${s.backupDays === n ? "selected" : ""}>${n === 0 ? "sem prazo" : n === 365 ? "1 ano" : `${n} dias`}</option>`).join("")}</select>
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

        <section class="st-sec" data-sec="aparencia">
          <header class="st-sec-head">
            <span class="st-sec-ic"><svg class="ic"><use href="#i-eye"/></svg></span>
            <div class="st-sec-txt">
              <h3>Aparência</h3>
              <p class="st-lead">Tema e o que aparece na janela.</p>
            </div>
          </header>
          <h4 class="st-group">Tema e janela</h4>
          <div class="st-list">
            ${toggle("dark", "Tema escuro", "Cores escuras na interface, no editor e na pré-visualização.", ctx.dark(), "i-moon")}
            ${toggle("sidebar", "Painel lateral", "Projetos, busca, estrutura e contexto para a IA.", !ctx.flag("no-sidebar"), "i-sidebar")}
            ${toggle("preview", "Pré-visualização", "O resultado formatado ao lado do texto.", !ctx.flag("no-preview"), "i-columns")}
            <div class="st-row">
              ${rowIcon("i-draw")}
              <span class="st-text"><b>Estilo do desenho</b><small>Imagem guarda um PNG em assets/. Letras vira texto no próprio Markdown (ótimo para a IA).</small></span>
              <select data-k="draw" class="st-select">
                <option value="image" ${ctx.drawStyle() === "image" ? "selected" : ""}>Imagem (PNG)</option>
                <option value="text" ${ctx.drawStyle() === "text" ? "selected" : ""}>Letras e símbolos</option>
              </select>
            </div>
          </div>
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
    </div>`;

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

  // navegação lateral: rola até a seção e marca a que está à vista
  const items = host.querySelectorAll<HTMLElement>(".st-nav-item");
  const scroller = q(".st-scroll");
  const headTitle = q("[data-st-title]");
  const headIcon = host.querySelector<SVGUseElement>("[data-st-icon]")!;
  const mark = (id: string) => {
    items.forEach((b) => {
      const active = b.dataset.nav === id;
      b.classList.toggle("active", active);
      b.setAttribute("aria-selected", String(active));
    });
    const n = NAV.find((x) => x.id === id);
    if (n) {
      headTitle.textContent = n.label;
      headIcon.setAttribute("href", `#${n.icon}`);
    }
  };
  items.forEach((b) =>
    b.addEventListener("click", () => {
      mark(b.dataset.nav!);
      q(`[data-sec="${b.dataset.nav}"]`).scrollIntoView({ behavior: "smooth", block: "start" });
    })
  );
  scroller.addEventListener(
    "scroll",
    () => {
      let cur = NAV[0].id as string;
      host.querySelectorAll<HTMLElement>(".st-sec").forEach((sec) => {
        if (sec.offsetTop - scroller.scrollTop < 120) cur = sec.dataset.sec!;
      });
      if (scroller.scrollTop + scroller.clientHeight >= scroller.scrollHeight - 4) cur = NAV[NAV.length - 1].id;
      mark(cur);
    },
    { passive: true }
  );
  mark(section);
  window.setTimeout(() => q(`[data-sec="${section}"]`).scrollIntoView({ block: "start" }), 0);

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
    el.textContent =
      `Frases de ${Math.round(p.avgSentence)} palavras em média (90% até ${p.p90}); ${p.commasPer100.toFixed(1).replace(".", ",")} vírgulas a cada 100 palavras; palavras de ${p.avgWordLen.toFixed(1).replace(".", ",")} letras. Costuma abrir frases com ${ab}.` +
      (fb.decisions >= 30 ? ` Você aceita ${Math.round(fb.acceptNext * 100)}% das sugestões de próxima palavra e ${Math.round(fb.acceptPrefix * 100)}% das de completar palavra.` : "");
  };
  paintStyle();
  const modeSel = q<HTMLSelectElement>("[data-sel=ghostmode]");
  modeSel.value = getGhostMode();
  modeSel.addEventListener("change", () => {
    setGhostMode(modeSel.value as GhostMode);
    flash();
  });
  paintDict();
  on('[data-act="forget-ghost"]', "click", () => {
    clearGhostMemory();
    clearFeedback();
    paintStyle();
    toast("As sugestões esqueceram o que aprenderam dos seus documentos.", "ok", 2600);
  });
  on('[data-act="dict"]', "click", () => {
    ctx.openDictionary();
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
  sw("hist-max").addEventListener("change", (e) => {
    ctx.patch({ historyMax: Number((e.target as HTMLSelectElement).value) || 60 });
    flash();
  });
  const paintHist = () =>
    void ctx.historyCount().then((n) => (q("[data-hist-count]").textContent = n ? `${n} versão(ões) guardada(s)` : "Nenhuma versão ainda"));
  paintHist();
  on('[data-act="hist-open"]', "click", () => ctx.openHistory());
  on('[data-act="hist-clear"]', "click", async () => {
    await ctx.clearHistory();
    paintHist();
  });

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
  sw("backup-profile").addEventListener("change", (e) => {
    const valor = (e.target as HTMLSelectElement).value as AppSettings["backupProfile"];
    ctx.patch({ backupProfile: valor });
    paintBackupProfile();
    flash();
  });
  sw("backup-copies").addEventListener("change", (e) => {
    ctx.patch({ backupCopies: Number((e.target as HTMLSelectElement).value) || 0 });
    flash();
  });
  sw("backup-days").addEventListener("change", (e) => {
    ctx.patch({ backupDays: Number((e.target as HTMLSelectElement).value) || 0 });
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
    } catch (e) {
      toast("Não foi possível usar essa pasta: " + e, "err", 5000);
    }
  });
  on('[data-act="backup-open"]', "click", async () => {
    try {
      const pasta = backupRoot || (await backup.pastaDoApp());
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
    } catch (e) {
      toast("Não foi possível limpar: " + e, "err", 5000);
    }
  });

  // aparência
  sw("dark").addEventListener("change", (e) => {
    ctx.setDark((e.target as HTMLInputElement).checked);
    flash();
  });
  sw("sidebar").addEventListener("change", () => {
    ctx.toggleFlag("no-sidebar");
    flash();
  });
  sw("preview").addEventListener("change", () => {
    ctx.toggleFlag("no-preview");
    flash();
  });
  sw("draw").addEventListener("change", (e) => {
    ctx.setDrawStyle((e.target as HTMLSelectElement).value === "text" ? "text" : "image");
    flash();
  });
}
