// Página de Configurações (abre como uma aba, ao lado dos documentos). Cada ajuste vale na hora.
import type { Translation, ProviderChoice } from "./translation";
import type { Tone } from "./writing";
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

const NAV: { id: SettingsSection; label: string; icon: string }[] = [
  { id: "escrita", label: "Escrita", icon: "i-draw" },
  { id: "traducao", label: "Tradução", icon: "i-globe" },
  { id: "historico", label: "Histórico", icon: "i-clock" },
  { id: "aparencia", label: "Aparência", icon: "i-eye" },
  { id: "atalhos", label: "Atalhos", icon: "i-code" },
];

const TONES: { id: Tone; title: string; desc: string }[] = [
  { id: "formal", title: "Formal", desc: "Aponta linguagem informal (“pra”, “tá”, “a gente”, “coisa”, “acho que”…) e sugere a forma culta. Bom para trabalhos, relatórios e e-mails profissionais." },
  { id: "neutro", title: "Neutro", desc: "Só corrige o claramente informal (“pra → para”, “tá → está”). Deixa “a gente” e as sugestões de estilo em paz." },
  { id: "informal", title: "Informal", desc: "Não mexe no jeito de falar: corrige ortografia, pontuação e maiúsculas, mas aceita gírias e “a gente”." },
];

const SHORTCUTS: [string, string][] = [
  ["Ctrl+T", "Nova aba"],
  ["Ctrl+W", "Fechar aba"],
  ["Ctrl+Shift+T", "Reabrir a última aba fechada"],
  ["Ctrl+Tab / Ctrl+1…9", "Trocar de aba"],
  ["F2", "Renomear o documento"],
  ["Ctrl+O / Ctrl+S", "Abrir / salvar"],
  ["Ctrl+Shift+S", "Salvar como"],
  ["Ctrl+K", "Buscar comandos"],
  ["Ctrl+Shift+E", "Exportar"],
  ["Ctrl+Alt+T", "Tradução automática"],
  ["Ctrl+Shift+F", "Modo foco (Esc sai)"],
  ["Ctrl+Shift+D", "Desenhar"],
  ["F7", "Revisar texto"],
  ["F1", "Boas-vindas e ajuda"],
];

/** Interruptor liga/desliga acessível. */
function toggle(id: string, label: string, desc: string, on: boolean): string {
  return `<label class="st-row">
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
      <h2>Configurações</h2>
      ${NAV.map((n) => `<button class="st-nav-item" role="tab" data-nav="${n.id}"><svg class="ic"><use href="#${n.icon}"/></svg><span>${n.label}</span></button>`).join("")}
      <span class="st-saved" aria-live="polite"></span>
    </aside>
    <div class="st-scroll">
      <div class="st-col">
        <section class="st-sec" data-sec="escrita">
          <h3>Escrita</h3>
          <p class="st-lead">Como o assistente corrige e sugere enquanto você escreve.</p>
          <h4>Tom do texto</h4>
          <div class="st-cards">
            ${TONES.map(
              (t) => `<label class="st-card"><input type="radio" name="tone" value="${t.id}" ${s.tone === t.id ? "checked" : ""}>
                <span><b>${t.title}</b><small>${t.desc}</small></span></label>`
            ).join("")}
          </div>
          <p class="st-note">Vale para o assistente de escrita, a correção automática e o português enviado à tradução.</p>
          <div class="st-list">
            ${toggle("autofix", "Correção automática", "Ponto final, vírgulas, maiúsculas, espaços e palavras erradas entram sozinhos (Ctrl+Z desfaz).", ctx.autoFix())}
            ${toggle("copilot", "Sugestões enquanto digita", "Mostra a continuação da frase em cinza. Tab aceita; Alt+Seta aceita uma palavra.", ctx.copilot())}
            <div class="st-row">
              <span class="st-text"><b>Dicionário pessoal</b><small data-dict-count></small></span>
              <button class="btn small st-btn" data-act="dict">Abrir dicionário…</button>
            </div>
          </div>
        </section>

        <section class="st-sec" data-sec="traducao">
          <h3>Tradução</h3>
          <p class="st-lead">Você escreve em português; a pré-visualização mostra o inglês ao vivo e a exportação traduz o documento.</p>
          <div class="st-list">
            ${toggle("tr-on", "Tradução automática", "Mostra a versão em inglês ao lado do português (Ctrl+Alt+T).", tr.enabled)}
            ${toggle("tr-polish", "Melhorar o português antes de traduzir", "Corrige pontuação, maiúsculas, “a gente → nós” e linguagem informal para a tradução sair mais clara.", tr.polish)}
          </div>
          <h4>Motor de tradução</h4>
          <div class="st-cards">
            <label class="st-card"><input type="radio" name="prov" value="auto" ${tr.provider === "auto" ? "checked" : ""}><span><b>Automático</b><small>Usa o modo offline se já estiver instalado; senão o online. Se o limite do online acabar, troca sozinho.</small></span></label>
            <label class="st-card"><input type="radio" name="prov" value="online" ${tr.provider === "online" ? "checked" : ""}><span><b>Online (grátis)</b><small>MyMemory. Bom para começar, mas tem limite diário e qualidade média.</small></span></label>
            <label class="st-card"><input type="radio" name="prov" value="offline" ${tr.provider === "offline" ? "checked" : ""}><span><b>Offline</b><small>Modelo no seu PC, sem limite e sem internet (baixa cerca de 120 MB uma vez).</small></span></label>
          </div>
          <div class="st-inline">
            <button class="btn small st-btn" data-act="dl"></button>
            <span class="muted" data-dl-status></span>
          </div>
          <label class="st-field">E-mail para ampliar o limite do modo online (opcional)
            <input type="email" data-k="email" placeholder="voce@exemplo.com" autocomplete="off" spellcheck="false" value="${tr.email.replace(/"/g, "&quot;")}">
          </label>
          <label class="st-field">Glossário — um termo por linha. <code>mdCreator</code> mantém o nome; <code>rascunho = draft</code> força a tradução.
            <textarea data-k="gloss" rows="6" spellcheck="false" placeholder="mdCreator&#10;rascunho = draft"></textarea>
          </label>
          <div class="st-inline"><button class="btn small st-btn" data-act="clear-tr">Limpar memória de traduções</button></div>
        </section>

        <section class="st-sec" data-sec="historico">
          <h3>Histórico de versões</h3>
          <p class="st-lead">Cópias do documento guardadas no app para você voltar atrás.</p>
          <div class="st-list">
            ${toggle("hist", "Guardar versões dos documentos", "Uma cópia automática a cada 5 minutos (se o texto mudou) e ao salvar.", s.historyOn)}
            <div class="st-row">
              <span class="st-text"><b>Versões por documento</b><small>As marcadas por você (★) nunca são apagadas sozinhas.</small></span>
              <select data-k="hist-max" class="st-select">${[20, 40, 60, 100, 200].map((n) => `<option value="${n}" ${s.historyMax === n ? "selected" : ""}>${n} versões</option>`).join("")}</select>
            </div>
            <div class="st-row">
              <span class="st-text"><b>Este documento</b><small data-hist-count></small></span>
              <span class="st-btns">
                <button class="btn small st-btn" data-act="hist-open">Abrir histórico</button>
                <button class="btn small st-btn danger" data-act="hist-clear">Apagar</button>
              </span>
            </div>
          </div>
        </section>

        <section class="st-sec" data-sec="aparencia">
          <h3>Aparência</h3>
          <p class="st-lead">Tema e o que aparece na janela.</p>
          <div class="st-list">
            ${toggle("dark", "Tema escuro", "Cores escuras na interface, no editor e na pré-visualização.", ctx.dark())}
            ${toggle("sidebar", "Painel lateral", "Projetos, busca, estrutura e contexto para a IA.", !ctx.flag("no-sidebar"))}
            ${toggle("preview", "Pré-visualização", "O resultado formatado ao lado do texto.", !ctx.flag("no-preview"))}
            <div class="st-row">
              <span class="st-text"><b>Estilo do desenho</b><small>Imagem guarda um PNG em assets/. Letras vira texto no próprio Markdown (ótimo para a IA).</small></span>
              <select data-k="draw" class="st-select">
                <option value="image" ${ctx.drawStyle() === "image" ? "selected" : ""}>Imagem (PNG)</option>
                <option value="text" ${ctx.drawStyle() === "text" ? "selected" : ""}>Letras e símbolos</option>
              </select>
            </div>
          </div>
        </section>

        <section class="st-sec" data-sec="atalhos">
          <h3>Atalhos</h3>
          <p class="st-lead">Os principais atalhos do teclado.</p>
          <div class="st-keys">
            ${SHORTCUTS.map(([k, d]) => `<div class="st-key"><kbd>${k}</kbd><span>${d}</span></div>`).join("")}
          </div>
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
  const mark = (id: string) => items.forEach((b) => b.classList.toggle("active", b.dataset.nav === id));
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
  host.querySelectorAll<HTMLInputElement>('input[name="tone"]').forEach((r) =>
    r.addEventListener("change", () => {
      ctx.patch({ tone: r.value as Tone });
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
  paintDict();
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
  host.querySelectorAll<HTMLInputElement>('input[name="prov"]').forEach((r) =>
    r.addEventListener("change", () => {
      ctx.translation.update({ provider: r.value as ProviderChoice });
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

  // histórico
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
