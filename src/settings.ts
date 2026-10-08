// Configurações gerais do app: tom do texto e histórico de versões.
import type { Tone } from "./writing";
import { h, loadJSON, saveJSON } from "./util";

export interface AppSettings {
  tone: Tone;
  historyOn: boolean;
  historyMax: number;
}

const KEY = "mdc.settings";
const DEFAULTS: AppSettings = { tone: "formal", historyOn: true, historyMax: 60 };

export function loadSettings(): AppSettings {
  const saved = loadJSON<Partial<AppSettings>>(KEY, {});
  const tone: Tone = saved.tone === "neutro" || saved.tone === "informal" ? saved.tone : "formal";
  return { ...DEFAULTS, ...saved, tone };
}

const TONES: { id: Tone; title: string; desc: string }[] = [
  { id: "formal", title: "Formal", desc: "Aponta linguagem informal (“pra”, “tá”, “a gente”, “coisa”, “acho que”…) e sugere a forma culta. Bom para trabalhos, relatórios e e-mails profissionais." },
  { id: "neutro", title: "Neutro", desc: "Só corrige o que é claramente informal (“pra → para”, “tá → está”) e deixa “a gente” e as sugestões de estilo em paz." },
  { id: "informal", title: "Informal", desc: "Não mexe no jeito de falar: continua corrigindo ortografia, pontuação e maiúsculas, mas aceita gírias e “a gente”." },
];

/**
 * Página de Configurações — aberta em uma JANELA PRÓPRIA (menu ⋯ → Configurações).
 * As escolhas são guardadas no mesmo localStorage do editor: valem para ele também.
 */
export function renderSettingsPage(version = "0.1.0"): void {
  document.title = "Configurações — mdCreator";
  if (localStorage.getItem("mdc.theme") === "dark") document.documentElement.dataset.theme = "dark";
  const s = loadSettings();
  const autoFix = loadJSON<boolean>("mdc.autofix", true);
  const copilot = loadJSON<boolean>("mdc.copilot", true);
  const temaEscuro = document.documentElement.dataset.theme === "dark";
  const semPainel = loadJSON<boolean>("mdc.no-sidebar", false);
  const semPreview = loadJSON<boolean>("mdc.no-preview", false);
  const dict = loadJSON<string[]>("mdc.ignore-words", []);

  const page = h("div", { class: "tr-modal settings-page" });
  page.innerHTML = `
    <header class="wm-head">
      <svg class="ic"><use href="#i-spark"/></svg>
      <h2>Configurações</h2>
      <span class="dr-spacer"></span>
      <span class="muted" data-aviso></span>
      <button class="btn primary" data-ok>Salvar</button>
    </header>
    <div class="wm-body tr-body">
      <section>
        <h4>Escrita e correção</h4>
        ${TONES.map((t) => `<label class="tr-opt"><input type="radio" name="tone" value="${t.id}"> <span><b>${t.title}</b> — ${t.desc}</span></label>`).join("")}
        <label class="tr-opt"><input type="checkbox" data-autofix> <span><b>Correção automática</b> — ponto final, vírgulas, maiúsculas e palavras erradas entram sozinhas enquanto você escreve e ao pausar.</span></label>
        <label class="tr-opt"><input type="checkbox" data-copilot> <span><b>Sugestões inline (estilo Copilot)</b> — completa a frase enquanto você digita; <kbd>Tab</kbd> aceita, <kbd>Alt</kbd>+<kbd>Seta</kbd> palavra por palavra.</span></label>
        <h4 style="margin-top:14px">Dicionário pessoal</h4>
        <p class="muted">Palavras aqui não são marcadas como erro (nomes, marcas, termos técnicos).</p>
        <div class="dict-add">
          <input type="text" class="dict-input" placeholder="digite uma palavra (ex.: mdCreator)" />
          <button class="btn primary" data-dict-add>Adicionar</button>
        </div>
        <div class="dict-list" data-dict-list></div>
      </section>
      <section>
        <h4>Arquivos e salvamento</h4>
        <label class="tr-opt"><input type="checkbox" data-hist> <span><b>Guardar versões dos documentos</b> — uma cópia a cada 5 minutos (se o texto mudou) e ao salvar.</span></label>
        <label class="tr-field">Quantas versões guardar por documento
          <select data-max>
            ${[20, 40, 60, 100, 200].map((n) => `<option value="${n}">${n} versões</option>`).join("")}
          </select>
        </label>
        <p class="muted">O <b>salvamento automático</b> grava o documento em andamento em <code>temp/</code> (dentro do projeto) cerca de 2 segundos depois que você para de digitar. Essa pasta fica no <code>.gitignore</code> — os rascunhos não vão para o Git.</p>
      </section>
      <section>
        <h4>Aparência</h4>
        <label class="tr-opt"><input type="checkbox" data-tema> <span><b>Tema escuro</b></span></label>
        <label class="tr-opt"><input type="checkbox" data-sidebar> <span><b>Painel lateral</b> (recentes e estrutura)</span></label>
        <label class="tr-opt"><input type="checkbox" data-preview> <span><b>Pré-visualização</b> ao lado do editor</span></label>
        <p class="muted">Aparência vale para a próxima vez que a janela do editor abrir.</p>
      </section>
      <section>
        <h4>Sobre e diagnóstico</h4>
        <p class="muted"><b>mdCreator ${version}</b> — editor Markdown com desenho, diagramas e assistente de escrita em português.</p>
        <p class="muted">Salvamento automático: <code>temp/</code> do projeto · Histórico de versões e dicionário: pasta de dados do app · Documentos: onde você mandar salvar.</p>
      </section>
    </div>
    <footer class="wm-foot">
      <span class="muted">Salvar aqui já vale para o editor (basta voltar para a janela dele).</span>
      <span class="dr-spacer"></span>
      <button class="btn primary" data-ok2>Salvar</button>
    </footer>`;
  document.body.innerHTML = "";
  document.body.append(page);

  const q = <T extends HTMLElement>(sel: string) => page.querySelector<T>(sel)!;
  page.querySelectorAll<HTMLInputElement>('input[name="tone"]').forEach((r) => (r.checked = r.value === s.tone));
  q<HTMLInputElement>("[data-autofix]").checked = autoFix;
  q<HTMLInputElement>("[data-copilot]").checked = copilot;

  // dicionário pessoal (mesma lista que o editor usa)
  const listaDict = q("[data-dict-list]");
  const palavras = new Set<string>(dict.map((w) => String(w).toLowerCase()));
  const desenharDict = () => {
    const ordenadas = Array.from(palavras).sort((a, b) => a.localeCompare(b, "pt-BR"));
    listaDict.innerHTML = "";
    if (!ordenadas.length) {
      listaDict.append(h("p", { class: "muted", text: "Nenhuma palavra ainda." }));
      return;
    }
    for (const w of ordenadas) {
      const linha = h("div", { class: "dict-row" });
      linha.append(h("span", { text: w }));
      const b = h("button", { class: "btn icon", type: "button", title: "Remover do dicionário" });
      b.textContent = "×";
      b.addEventListener("click", () => {
        palavras.delete(w);
        saveJSON("mdc.ignore-words", Array.from(palavras));
        desenharDict();
      });
      linha.append(b);
      listaDict.append(linha);
    }
  };
  const adicionarDict = () => {
    const campo = q<HTMLInputElement>(".dict-input");
    const valor = campo.value.trim().toLowerCase();
    if (!valor) return;
    palavras.add(valor);
    saveJSON("mdc.ignore-words", Array.from(palavras));
    campo.value = "";
    desenharDict();
  };
  desenharDict();
  q<HTMLElement>("[data-dict-add]").addEventListener("click", adicionarDict);
  q<HTMLInputElement>(".dict-input").addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      adicionarDict();
    }
  });
  q<HTMLInputElement>("[data-hist]").checked = s.historyOn;
  q<HTMLSelectElement>("[data-max]").value = String(s.historyMax);
  q<HTMLInputElement>("[data-tema]").checked = temaEscuro;
  q<HTMLInputElement>("[data-sidebar]").checked = !semPainel;
  q<HTMLInputElement>("[data-preview]").checked = !semPreview;

  const salvar = () => {
    const tone = (page.querySelector('input[name="tone"]:checked') as HTMLInputElement | null)?.value as Tone | undefined;
    const atual = loadSettings();
    saveJSON(KEY, {
      ...atual,
      tone: tone ?? atual.tone,
      historyOn: q<HTMLInputElement>("[data-hist]").checked,
      historyMax: Number(q<HTMLSelectElement>("[data-max]").value) || 60,
    });
    saveJSON("mdc.autofix", q<HTMLInputElement>("[data-autofix]").checked);
    saveJSON("mdc.copilot", q<HTMLInputElement>("[data-copilot]").checked);
    const escuro = q<HTMLInputElement>("[data-tema]").checked;
    localStorage.setItem("mdc.theme", escuro ? "dark" : "light");
    document.documentElement.dataset.theme = escuro ? "dark" : "light";
    saveJSON("mdc.no-sidebar", !q<HTMLInputElement>("[data-sidebar]").checked);
    saveJSON("mdc.no-preview", !q<HTMLInputElement>("[data-preview]").checked);
    const aviso = q("[data-aviso]");
    aviso.textContent = "Salvo ✅";
    window.setTimeout(() => (aviso.textContent = ""), 2600);
  };
  page.querySelectorAll("[data-ok]").forEach((b) => b.addEventListener("click", salvar));
  page.querySelectorAll("[data-ok2]").forEach((b) => b.addEventListener("click", salvar));
}

export function openSettingsDialog(opts: {
  current: AppSettings;
  historyCount: () => Promise<number>;
  onSave: (next: AppSettings) => void;
  onClearHistory: () => Promise<void>;
  onOpenHistory: () => void;
}): void {
  if (document.querySelector(".settings-modal")) return;
  const s = { ...opts.current };
  const backdrop = h("div", { class: "modal-backdrop" });
  const modal = h("div", { class: "modal tr-modal settings-modal" });
  modal.innerHTML = `
    <header class="wm-head">
      <svg class="ic"><use href="#i-spark"/></svg>
      <h2>Configurações</h2>
      <button class="btn icon" data-close title="Fechar (Esc)"><svg class="ic"><use href="#i-close"/></svg></button>
    </header>
    <div class="wm-body tr-body">
      <section>
        <h4>Tom do texto</h4>
        ${TONES.map((t) => `<label class="tr-opt"><input type="radio" name="tone" value="${t.id}"> <span><b>${t.title}</b> — ${t.desc}</span></label>`).join("")}
        <p class="muted">Vale para o assistente de escrita, a correção automática e a preparação do português antes de traduzir.</p>
      </section>
      <section>
        <h4>Histórico de versões</h4>
        <label class="tr-opt"><input type="checkbox" data-hist> <span><b>Guardar versões dos documentos</b> — uma cópia automática a cada 5 minutos (se o texto mudou) e ao salvar.</span></label>
        <label class="tr-field">Quantas versões guardar por documento
          <select data-max>
            ${[20, 40, 60, 100, 200].map((n) => `<option value="${n}">${n} versões</option>`).join("")}
          </select>
        </label>
        <div class="tr-offline" style="margin-left:0">
          <button class="btn small" data-open-hist>Abrir o histórico deste documento</button>
          <button class="btn small" data-clear-hist>Apagar o histórico deste documento</button>
          <span class="muted" data-count></span>
        </div>
      </section>
    </div>
    <footer class="wm-foot">
      <span class="dr-spacer"></span>
      <button class="btn" data-close>Cancelar</button>
      <button class="btn primary" data-ok>Salvar</button>
    </footer>`;
  backdrop.append(modal);
  document.body.append(backdrop);

  const q = <T extends HTMLElement>(sel: string) => modal.querySelector<T>(sel)!;
  modal.querySelectorAll<HTMLInputElement>('input[name="tone"]').forEach((r) => (r.checked = r.value === s.tone));
  q<HTMLInputElement>("[data-hist]").checked = s.historyOn;
  q<HTMLSelectElement>("[data-max]").value = String(s.historyMax);
  const paintCount = () =>
    void opts.historyCount().then((n) => (q("[data-count]").textContent = n ? `${n} versão(ões) guardada(s)` : "Nenhuma versão ainda"));
  paintCount();

  const close = () => {
    document.removeEventListener("keydown", onKey, true);
    backdrop.remove();
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      close();
    }
  };
  document.addEventListener("keydown", onKey, true);
  backdrop.addEventListener("mousedown", (e) => {
    if (e.target === backdrop) close();
  });
  modal.querySelectorAll("[data-close]").forEach((b) => b.addEventListener("click", close));
  q("[data-open-hist]").addEventListener("click", () => {
    close();
    opts.onOpenHistory();
  });
  q("[data-clear-hist]").addEventListener("click", async () => {
    await opts.onClearHistory();
    paintCount();
  });
  q("[data-ok]").addEventListener("click", () => {
    const tone = (modal.querySelector('input[name="tone"]:checked') as HTMLInputElement | null)?.value as Tone | undefined;
    const next: AppSettings = {
      tone: tone ?? s.tone,
      historyOn: q<HTMLInputElement>("[data-hist]").checked,
      historyMax: Number(q<HTMLSelectElement>("[data-max]").value) || 60,
    };
    saveJSON(KEY, next);
    close();
    opts.onSave(next);
  });
}
