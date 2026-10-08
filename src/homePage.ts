import * as files from "./files";
import { $, h, fmtTime, baseName, stripExt, docDirOf } from "./util";

export interface HomeCtx {
  createDoc: (tipo: "word" | "excel" | "md" | "ppt") => void;
  createTemplate: (template: "abnt" | "relatorio" | "orcamento" | "ia") => void;
  openExisting: () => void;
  openPath: (path: string) => void;
  recents: () => { path: string; name: string; at: number }[];
  drafts: () => Promise<files.DraftInfo[]>;
  openDraft: (draft: files.DraftInfo) => void;
  deleteDraft: (path: string) => Promise<void>;
  closeHome: () => void;
  hasOpenTabs: boolean;
}

export function renderHomePage(container: HTMLElement, ctx: HomeCtx): void {
  container.textContent = "";

  const wrap = h("div", { class: "home-wrap" });

  // 1. Cabeçalho / Hero
  const header = h("header", { class: "home-header" });
  const heroLeft = h("div", { class: "home-hero" });
  heroLeft.innerHTML = `
    <div class="home-tag">
      <svg class="ic"><use href="#i-spark"/></svg>
      <span>mdOffice Hub</span>
    </div>
    <h1 class="home-title">Início</h1>
    <p class="home-subtitle">Crie documentos formatados, planilhas, apresentações e notas com inteligência artificial integrada.</p>
  `;
  header.append(heroLeft);

  if (ctx.hasOpenTabs) {
    const resumeBtn = h("button", {
      class: "btn home-resume-btn",
      type: "button",
      title: "Voltar para o editor no documento aberto",
    });
    resumeBtn.innerHTML = '<svg class="ic"><use href="#i-doc"/></svg><span>Continuar editando</span>';
    resumeBtn.addEventListener("click", () => ctx.closeHome());
    header.append(resumeBtn);
  }
  wrap.append(header);

  // 2. Grade dos 4 formatos principais: Word, Excel, Markdown, PowerPoint
  const secCards = h("section", { class: "home-section cards-section" });
  const cardsHead = h("div", { class: "home-section-head" });
  cardsHead.innerHTML = `
    <h2 class="home-section-title">Novo arquivo</h2>
    <span class="home-section-desc">Escolha um dos 4 formatos para começar a produzir</span>
  `;
  secCards.append(cardsHead);

  const grid = h("div", { class: "home-grid" });

  // Card 1: Word
  const cardWord = h("button", { class: "home-card card-word", type: "button" });
  cardWord.innerHTML = `
    <div class="home-card-top">
      <span class="home-badge badge-word">DOCX</span>
    </div>
    <div class="home-card-icon-box">
      <svg class="home-brand-icon" viewBox="0 0 54 54" width="54" height="54" fill="none">
        <rect x="6" y="8" width="32" height="38" rx="5" fill="#103F91"/>
        <rect x="12" y="15" width="20" height="3" rx="1.5" fill="#8CB5F8" fill-opacity="0.8"/>
        <rect x="12" y="21" width="20" height="3" rx="1.5" fill="#8CB5F8" fill-opacity="0.8"/>
        <rect x="12" y="27" width="14" height="3" rx="1.5" fill="#8CB5F8" fill-opacity="0.8"/>
        <rect x="12" y="33" width="18" height="3" rx="1.5" fill="#8CB5F8" fill-opacity="0.8"/>
        <rect x="18" y="16" width="30" height="30" rx="6" fill="#185ABD"/>
        <text x="33" y="38" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-weight="800" font-size="20" fill="#FFFFFF" text-anchor="middle">W</text>
      </svg>
    </div>
    <div class="home-card-body">
      <h3 class="home-card-title">Word</h3>
      <span class="home-card-type">Documento de Texto</span>
      <p class="home-card-desc">Texto formatado, cabeçalhos, páginas A4, normas ABNT e exportação .docx.</p>
    </div>
    <div class="home-card-footer">
      <span class="home-card-cta">Criar documento Word <b>+</b></span>
    </div>
  `;
  cardWord.addEventListener("click", () => ctx.createDoc("word"));
  grid.append(cardWord);

  // Card 2: Excel
  const cardExcel = h("button", { class: "home-card card-excel", type: "button" });
  cardExcel.innerHTML = `
    <div class="home-card-top">
      <span class="home-badge badge-excel">XLSX</span>
    </div>
    <div class="home-card-icon-box">
      <svg class="home-brand-icon" viewBox="0 0 54 54" width="54" height="54" fill="none">
        <rect x="6" y="8" width="32" height="38" rx="5" fill="#0E5C2F"/>
        <rect x="11" y="15" width="22" height="2" rx="1" fill="#72D699" fill-opacity="0.8"/>
        <rect x="11" y="22" width="22" height="2" rx="1" fill="#72D699" fill-opacity="0.8"/>
        <rect x="11" y="29" width="22" height="2" rx="1" fill="#72D699" fill-opacity="0.8"/>
        <rect x="11" y="36" width="22" height="2" rx="1" fill="#72D699" fill-opacity="0.8"/>
        <rect x="21" y="12" width="2" height="28" rx="1" fill="#72D699" fill-opacity="0.8"/>
        <rect x="18" y="16" width="30" height="30" rx="6" fill="#107C41"/>
        <text x="33" y="38" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-weight="800" font-size="20" fill="#FFFFFF" text-anchor="middle">X</text>
      </svg>
    </div>
    <div class="home-card-body">
      <h3 class="home-card-title">Excel</h3>
      <span class="home-card-type">Planilha & Tabelas</span>
      <p class="home-card-desc">Tabelas estruturadas com colunas alinhadas, fórmulas e dados tabulares.</p>
    </div>
    <div class="home-card-footer">
      <span class="home-card-cta">Criar nova planilha <b>+</b></span>
    </div>
  `;
  cardExcel.addEventListener("click", () => ctx.createDoc("excel"));
  grid.append(cardExcel);

  // Card 3: Markdown
  const cardMd = h("button", { class: "home-card card-md", type: "button" });
  cardMd.innerHTML = `
    <div class="home-card-top">
      <span class="home-badge badge-md">MARKDOWN</span>
    </div>
    <div class="home-card-icon-box">
      <svg class="home-brand-icon" viewBox="0 0 54 54" width="54" height="54" fill="none">
        <rect x="6" y="8" width="32" height="38" rx="5" fill="#0D4E7A"/>
        <rect x="12" y="15" width="20" height="3" rx="1.5" fill="#7DD3FC" fill-opacity="0.8"/>
        <rect x="12" y="21" width="20" height="3" rx="1.5" fill="#7DD3FC" fill-opacity="0.8"/>
        <rect x="12" y="27" width="14" height="3" rx="1.5" fill="#7DD3FC" fill-opacity="0.8"/>
        <rect x="12" y="33" width="18" height="3" rx="1.5" fill="#7DD3FC" fill-opacity="0.8"/>
        <rect x="18" y="16" width="30" height="30" rx="6" fill="#0284C7"/>
        <path d="M23 35v-8l3.5 4 3.5-4v8" stroke="#FFFFFF" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M40 27v8m0 0l-2.5-2.5m2.5 2.5l2.5-2.5" stroke="#FFFFFF" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    </div>
    <div class="home-card-body">
      <h3 class="home-card-title">Markdown</h3>
      <span class="home-card-type">Texto Rápido & IA</span>
      <p class="home-card-desc">Escrita rápida, leve e focada, com visualização dupla simultânea em tempo real.</p>
    </div>
    <div class="home-card-footer">
      <span class="home-card-cta">Criar documento Markdown <b>+</b></span>
    </div>
  `;
  cardMd.addEventListener("click", () => ctx.createDoc("md"));
  grid.append(cardMd);

  // Card 4: PowerPoint
  const cardPpt = h("button", { class: "home-card card-ppt", type: "button" });
  cardPpt.innerHTML = `
    <div class="home-card-top">
      <span class="home-badge badge-ppt">PPTX</span>
    </div>
    <div class="home-card-icon-box">
      <svg class="home-brand-icon" viewBox="0 0 54 54" width="54" height="54" fill="none">
        <rect x="6" y="8" width="32" height="38" rx="5" fill="#8E2A12"/>
        <rect x="12" y="15" width="20" height="3" rx="1.5" fill="#FCA585" fill-opacity="0.8"/>
        <circle cx="20" cy="28" r="6" stroke="#FCA585" stroke-width="2" fill="none" opacity="0.85"/>
        <path d="M20 22v6h6" stroke="#FCA585" stroke-width="2" opacity="0.85"/>
        <rect x="18" y="16" width="30" height="30" rx="6" fill="#C43E1C"/>
        <text x="33" y="38" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-weight="800" font-size="20" fill="#FFFFFF" text-anchor="middle">P</text>
      </svg>
    </div>
    <div class="home-card-body">
      <h3 class="home-card-title">PowerPoint</h3>
      <span class="home-card-type">Apresentação de Slides</span>
      <p class="home-card-desc">Lâminas separadas por (---) com modo tela cheia F5 e exportação PDF.</p>
    </div>
    <div class="home-card-footer">
      <span class="home-card-cta">Criar apresentação <b>+</b></span>
    </div>
  `;
  cardPpt.addEventListener("click", () => ctx.createDoc("ppt"));
  grid.append(cardPpt);

  secCards.append(grid);
  wrap.append(secCards);

  // 3. Modelos Prontos (Chips rápidos)
  const secTemplates = h("section", { class: "home-section templates-section" });
  const tplHead = h("div", { class: "home-section-head" });
  tplHead.innerHTML = `
    <h2 class="home-section-title">Modelos rápidos</h2>
    <span class="home-section-desc">Comece com uma estrutura pré-formatada</span>
  `;
  secTemplates.append(tplHead);

  const chips = h("div", { class: "home-chips" });
  const addChip = (iconId: string, label: string, desc: string, onClick: () => void) => {
    const btn = h("button", { class: "home-chip-btn", type: "button", title: desc });
    btn.innerHTML = `<svg class="ic"><use href="#${iconId}"/></svg><span class="chip-label">${label}</span>`;
    btn.addEventListener("click", onClick);
    chips.append(btn);
  };

  addChip("i-word", "Trabalho ABNT", "Modelo acadêmico completo nas normas ABNT", () => ctx.createTemplate("abnt"));
  addChip("i-doc", "Relatório Executivo", "Resumo executivo, metas, resultados e conclusão", () => ctx.createTemplate("relatorio"));
  addChip("i-grid", "Planilha Orçamentária", "Tabela de receitas, despesas e totais", () => ctx.createTemplate("orcamento"));
  addChip("i-spark", "Pedido para IA", "Template estruturado para orientar IAs e LLMs", () => ctx.createTemplate("ia"));
  addChip("i-open", "Abrir arquivo do PC", "Abrir arquivo existente do disco (Ctrl+O)", () => ctx.openExisting());

  secTemplates.append(chips);
  wrap.append(secTemplates);

  // 4. Seção de Arquivos Recentes e Rascunhos
  const secRecents = h("section", { class: "home-section recents-section" });
  const tabsBar = h("div", { class: "home-tabs-bar" });

  const tabRecentsBtn = h("button", { class: "home-tab-pill active", type: "button" });
  tabRecentsBtn.textContent = "Arquivos Recentes";

  const tabDraftsBtn = h("button", { class: "home-tab-pill", type: "button" });
  tabDraftsBtn.textContent = "Rascunhos no App";

  const tabsLeft = h("div", { class: "home-tabs-left" });
  tabsLeft.append(tabRecentsBtn, tabDraftsBtn);

  const searchBox = h("div", { class: "home-search-box" });
  searchBox.innerHTML = `
    <svg class="ic"><use href="#i-search"/></svg>
    <input type="text" class="home-search-field" placeholder="Filtrar arquivos..." spellcheck="false" autocomplete="off" />
  `;
  const searchInput = searchBox.querySelector<HTMLInputElement>("input")!;

  tabsBar.append(tabsLeft, searchBox);
  secRecents.append(tabsBar);

  const listContainer = h("div", { class: "home-list-container" });
  secRecents.append(listContainer);
  wrap.append(secRecents);

  container.append(wrap);

  // Estado da aba (recentes vs rascunhos) e filtro
  let activeTab: "recents" | "drafts" = "recents";
  let filterText = "";

  const renderList = async () => {
    listContainer.textContent = "";

    if (activeTab === "recents") {
      const recents = ctx.recents();
      const filtered = recents.filter((r) => {
        if (!filterText) return true;
        return r.name.toLowerCase().includes(filterText) || r.path.toLowerCase().includes(filterText);
      });

      if (!filtered.length) {
        const empty = h("div", { class: "home-empty" });
        empty.innerHTML = `
          <svg class="home-empty-ic"><use href="#i-clock"/></svg>
          <p>${filterText ? "Nenhum arquivo recente corresponde à busca." : "Nenhum arquivo recente ainda."}</p>
          <span class="home-empty-hint">Os arquivos que você abrir ou salvar aparecerão aqui para acesso rápido.</span>
        `;
        listContainer.append(empty);
        return;
      }

      const list = h("div", { class: "home-file-list" });
      filtered.forEach((item) => {
        const row = h("div", { class: "home-file-row" });
        const ext = item.path.split(".").pop()?.toLowerCase() ?? "md";
        let iconSymbol = "i-doc";
        let iconClass = "file-icon-md";
        if (ext === "docx" || ext === "doc") {
          iconSymbol = "i-word";
          iconClass = "file-icon-word";
        } else if (ext === "xlsx" || ext === "csv") {
          iconSymbol = "i-grid";
          iconClass = "file-icon-excel";
        } else if (ext === "pptx") {
          iconSymbol = "i-eye";
          iconClass = "file-icon-ppt";
        }

        row.innerHTML = `
          <div class="home-file-col-main">
            <div class="home-file-icon ${iconClass}">
              <svg class="ic"><use href="#${iconSymbol}"/></svg>
            </div>
            <div class="home-file-info">
              <span class="home-file-name" title="${item.name}">${item.name}</span>
              <span class="home-file-path" title="${item.path}">${item.path}</span>
            </div>
          </div>
          <div class="home-file-col-meta">
            <span class="home-file-time">${fmtTime(new Date(item.at))}</span>
            <button class="btn small primary-soft home-file-open" type="button">Abrir</button>
          </div>
        `;

        row.addEventListener("click", () => ctx.openPath(item.path));
        list.append(row);
      });
      listContainer.append(list);
    } else {
      // Rascunhos
      let drafts: files.DraftInfo[] = [];
      try {
        drafts = await ctx.drafts();
      } catch {
        drafts = [];
      }

      const filtered = drafts.filter((d) => {
        const name = baseName(d.path);
        if (!filterText) return true;
        return name.toLowerCase().includes(filterText) || d.path.toLowerCase().includes(filterText);
      });

      if (!filtered.length) {
        const empty = h("div", { class: "home-empty" });
        empty.innerHTML = `
          <svg class="home-empty-ic"><use href="#i-doc"/></svg>
          <p>${filterText ? "Nenhum rascunho corresponde à busca." : "Nenhum rascunho salvo no momento."}</p>
          <span class="home-empty-hint">Textos não salvos são guardados aqui automaticamente para sua segurança.</span>
        `;
        listContainer.append(empty);
        return;
      }

      const list = h("div", { class: "home-file-list" });
      filtered.forEach((draft) => {
        const row = h("div", { class: "home-file-row" });
        const name = stripExt(baseName(draft.path));
        row.innerHTML = `
          <div class="home-file-col-main">
            <div class="home-file-icon file-icon-draft">
              <svg class="ic"><use href="#i-doc"/></svg>
            </div>
            <div class="home-file-info">
              <span class="home-file-name" title="${name}">${name}</span>
              <span class="home-file-path" title="${draft.path}">${docDirOf(draft.path)}</span>
            </div>
          </div>
          <div class="home-file-col-meta">
            <span class="home-file-time">${fmtTime(new Date(draft.modified_ms))}</span>
            <button class="btn small primary-soft home-file-open" type="button">Continuar</button>
            <button class="btn icon small home-file-delete" type="button" title="Excluir rascunho"><svg class="ic"><use href="#i-trash"/></svg></button>
          </div>
        `;

        row.querySelector(".home-file-open")?.addEventListener("click", (e) => {
          e.stopPropagation();
          ctx.openDraft(draft);
        });

        row.querySelector(".home-file-delete")?.addEventListener("click", async (e) => {
          e.stopPropagation();
          await ctx.deleteDraft(draft.path);
          void renderList();
        });

        row.addEventListener("click", () => ctx.openDraft(draft));
        list.append(row);
      });
      listContainer.append(list);
    }
  };

  tabRecentsBtn.addEventListener("click", () => {
    activeTab = "recents";
    tabRecentsBtn.classList.add("active");
    tabDraftsBtn.classList.remove("active");
    void renderList();
  });

  tabDraftsBtn.addEventListener("click", () => {
    activeTab = "drafts";
    tabDraftsBtn.classList.add("active");
    tabRecentsBtn.classList.remove("active");
    void renderList();
  });

  searchInput.addEventListener("input", () => {
    filterText = searchInput.value.trim().toLowerCase();
    void renderList();
  });

  void renderList();
}
