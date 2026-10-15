import * as files from "./files";
import { marked } from "marked";
import DOMPurify from "dompurify";
import { fileIcon, kindOfPath } from "./fileIcons";
import { estruturarPrevia, type PreviaEstruturada } from "./homePrevia";
import { $, h, fmtTime, baseName, stripExt, docDirOf, escapeHtml } from "./util";

/** O mesmo saneamento do resto do app: o HTML do markdown é de fora e não pode virar marcação. */
function sanitize(html: string): string {
  return DOMPurify.sanitize(html, { ADD_ATTR: ["target", "rel"] });
}

export interface HomeCtx {
  createDoc: (tipo: "word" | "excel" | "md" | "ppt") => void;
  createTemplate: (template: "abnt" | "relatorio" | "orcamento" | "ia") => void;
  openExisting: () => void;
  /** Importar documento do Office (.docx, .xlsx, .xlsm, .pptx). */
  importOffice: () => void;
  openPath: (path: string) => void;
  recents: () => { path: string; name: string; at: number }[];
  /** Prévia de um documento para o cartão (o começo do texto; o Rust lê o arquivo). */
  preview: (path: string) => Promise<files.PreviaDoc>;
  drafts: () => Promise<files.DraftInfo[]>;
  openDraft: (draft: files.DraftInfo) => void;
  deleteDraft: (path: string) => Promise<void>;
  closeHome: () => void;
  hasOpenTabs: boolean;
}

export type FormatFilter = "all" | "word" | "excel" | "md" | "ppt";

export function detectFormat(path: string): "word" | "excel" | "md" | "ppt" {
  const p = path.toLowerCase();
  const ext = p.split(".").pop() ?? "";
  if (ext === "docx" || ext === "doc") return "word";
  if (ext === "xlsx" || ext === "xls" || ext === "xlsm" || ext === "csv") return "excel";
  if (ext === "pptx" || ext === "ppt") return "ppt";
  if (p.includes("slide") || p.includes("apresenta") || p.includes("deck")) return "ppt";
  if (p.includes("planilha") || p.includes("tabela") || p.includes("orcamento") || p.includes("financeiro")) return "excel";
  return "md";
}

// ------------------------------------------------------------------
// a versão do documento no cartão ("a prévia pré-carregada")
// ------------------------------------------------------------------

/** Os parágrafos do corpo, um por linha (o cartão é pequeno: a tela corta o resto com overflow). */
const paragrafos = (linhas: string[]) => linhas.map((l) => `<span class="home-prev-par">${escapeHtml(l)}</span>`).join("");

/** O markdown renderizado; cada imagem vira um bloco de figura (o cartão não carrega os assets). */
function htmlDoMarkdown(md: string): string {
  const cru = sanitize(String(marked.parse(md, { gfm: true, async: false })));
  return cru.replace(/<img\b[^>]*>/gi, `<span class="home-prev-figura"></span>`);
}

/** A versão do documento para o cartão (vazio = o cartão fica com o ícone do formato). */
export function previaEmHtml(e: PreviaEstruturada): string {
  if (e.forma === "vazia") return "";
  if (e.forma === "pagina-md") {
    return `<span class="home-prev home-prev-pagina"><span class="home-prev-md">${htmlDoMarkdown(e.bruto)}</span></span>`;
  }
  if (e.forma === "pagina") {
    return `<span class="home-prev home-prev-pagina"><span class="home-prev-titulo">${escapeHtml(e.titulo)}</span>${paragrafos(e.linhas)}</span>`;
  }
  if (e.forma === "lamina") {
    return `<span class="home-prev home-prev-lamina"><span class="home-prev-lamina-titulo">${escapeHtml(e.titulo)}</span><span class="home-prev-lamina-corpo">${paragrafos(e.linhas)}</span></span>`;
  }
  return `<span class="home-prev home-prev-grade">${gradeEmHtml(e.grade)}</span>`;
}

/** A grade do Excel: o cabeçalho das colunas (A, B…) e as linhas com o número e as células. */
function gradeEmHtml(grade: string[][]): string {
  const colunas = Math.max(1, ...grade.map((l) => l.length));
  const letra = (i: number) => String.fromCharCode("A".charCodeAt(0) + i);
  const cabecalho =
    `<span class="home-prev-grade-linha home-prev-grade-cab"><span class="home-prev-grade-num"></span>` +
    Array.from({ length: colunas }, (_, c) => `<span class="home-prev-grade-col">${letra(c)}</span>`).join("") +
    `</span>`;
  const linhas = grade
    .map(
      (l, i) =>
        `<span class="home-prev-grade-linha"><span class="home-prev-grade-num">${i + 1}</span>` +
        Array.from({ length: colunas }, (_, c) => `<span class="home-prev-grade-cel">${escapeHtml(l[c] ?? "")}</span>`).join("") +
        `</span>`
    )
    .join("");
  return cabecalho + linhas;
}

const FORMAT_META: Record<"word" | "excel" | "md" | "ppt", { label: string; ext: string; newLabel: string; icon: string }> = {
  word: { label: "Word", ext: ".docx", newLabel: "documento Word", icon: "i-word" },
  excel: { label: "Excel", ext: ".xlsx", newLabel: "planilha Excel", icon: "i-grid" },
  md: { label: "Markdown", ext: ".md", newLabel: "documento Markdown", icon: "i-doc" },
  ppt: { label: "PowerPoint", ext: ".pptx", newLabel: "apresentação PowerPoint", icon: "i-eye" },
};

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
    <p class="home-subtitle">Selecione um formato abaixo para filtrar seus arquivos recentes ou crie um novo documento.</p>
  `;
  header.append(heroLeft);

  const headerActions = h("div", { class: "home-header-actions" });
  const importBtn = h("button", {
    class: "btn home-import-btn",
    type: "button",
    title: "Importar documento do Word (.docx), Excel (.xlsx/.xlsm) ou PowerPoint (.pptx)",
  });
  importBtn.innerHTML = '<svg class="ic"><use href="#i-import"/></svg><span>Importar do Office</span>';
  importBtn.addEventListener("click", () => ctx.importOffice());
  headerActions.append(importBtn);

  if (ctx.hasOpenTabs) {
    const resumeBtn = h("button", {
      class: "btn home-resume-btn",
      type: "button",
      title: "Voltar para o editor no documento aberto",
    });
    resumeBtn.innerHTML = '<svg class="ic"><use href="#i-doc"/></svg><span>Continuar editando</span>';
    resumeBtn.addEventListener("click", () => ctx.closeHome());
    headerActions.append(resumeBtn);
  }
  header.append(headerActions);
  wrap.append(header);

  // Estado do filtro ativo (all, word, excel, md, ppt)
  let selectedFormat: FormatFilter = "all";
  let activeTab: "recents" | "drafts" = "recents";
  let filterText = "";

  // 2. Grade dos 4 formatos principais: Word, Excel, Markdown, PowerPoint
  const secCards = h("section", { class: "home-section cards-section" });
  const cardsHead = h("div", { class: "home-section-head" });
  cardsHead.innerHTML = `
    <h2 class="home-section-title">Formatos e arquivos</h2>
    <span class="home-section-desc">Clique no card para filtrar a lista abaixo, ou use o botão "+" para criar novo</span>
  `;
  secCards.append(cardsHead);

  const grid = h("div", { class: "home-grid" });

  // Construtor de card interativo com filtro e criação
  const makeCard = (
    tipo: "word" | "excel" | "md" | "ppt",
    badge: string,
    title: string,
    subtitle: string,
    desc: string,
    iconSvg: string
  ) => {
    const card = h("button", { class: `home-card card-${tipo}`, type: "button", title: `Clique para filtrar arquivos de ${title}` });
    card.innerHTML = `
      <div class="home-card-top">
        <span class="home-badge badge-${tipo}">${badge}</span>
      </div>
      <div class="home-card-icon-box">
        ${iconSvg}
      </div>
      <div class="home-card-body">
        <h3 class="home-card-title">${title}</h3>
        <span class="home-card-type">${subtitle}</span>
        <p class="home-card-desc">${desc}</p>
      </div>
      <div class="home-card-footer">
        <span class="home-card-cta-label">Filtrar recentes</span>
        <span class="home-card-new-pill" title="Criar novo ${title} em branco">+ Novo</span>
      </div>
    `;

    // Clicar no botão "+ Novo" cria o documento imediatamente
    card.querySelector(".home-card-new-pill")?.addEventListener("click", (e) => {
      e.stopPropagation();
      ctx.createDoc(tipo);
    });

    // Clicar em qualquer outro lugar do card alterna o filtro dos arquivos recentes
    card.addEventListener("click", () => {
      setFormatFilter(selectedFormat === tipo ? "all" : tipo);
    });

    return card;
  };

  const svgWord = `
    <svg class="home-brand-icon" viewBox="0 0 54 54" width="54" height="54" fill="none">
      <rect x="6" y="8" width="32" height="38" rx="5" fill="#103F91"/>
      <rect x="12" y="15" width="20" height="3" rx="1.5" fill="#8CB5F8" fill-opacity="0.8"/>
      <rect x="12" y="21" width="20" height="3" rx="1.5" fill="#8CB5F8" fill-opacity="0.8"/>
      <rect x="12" y="27" width="14" height="3" rx="1.5" fill="#8CB5F8" fill-opacity="0.8"/>
      <rect x="12" y="33" width="18" height="3" rx="1.5" fill="#8CB5F8" fill-opacity="0.8"/>
      <rect x="18" y="16" width="30" height="30" rx="6" fill="#185ABD"/>
      <text x="33" y="38" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-weight="800" font-size="20" fill="#FFFFFF" text-anchor="middle">W</text>
    </svg>`;

  const svgExcel = `
    <svg class="home-brand-icon" viewBox="0 0 54 54" width="54" height="54" fill="none">
      <rect x="6" y="8" width="32" height="38" rx="5" fill="#0E5C2F"/>
      <rect x="11" y="15" width="22" height="2" rx="1" fill="#72D699" fill-opacity="0.8"/>
      <rect x="11" y="22" width="22" height="2" rx="1" fill="#72D699" fill-opacity="0.8"/>
      <rect x="11" y="29" width="22" height="2" rx="1" fill="#72D699" fill-opacity="0.8"/>
      <rect x="11" y="36" width="22" height="2" rx="1" fill="#72D699" fill-opacity="0.8"/>
      <rect x="21" y="12" width="2" height="28" rx="1" fill="#72D699" fill-opacity="0.8"/>
      <rect x="18" y="16" width="30" height="30" rx="6" fill="#107C41"/>
      <text x="33" y="38" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-weight="800" font-size="20" fill="#FFFFFF" text-anchor="middle">X</text>
    </svg>`;

  const svgMd = `
    <svg class="home-brand-icon" viewBox="0 0 54 54" width="54" height="54" fill="none">
      <rect x="6" y="8" width="32" height="38" rx="5" fill="#0D4E7A"/>
      <rect x="12" y="15" width="20" height="3" rx="1.5" fill="#7DD3FC" fill-opacity="0.8"/>
      <rect x="12" y="21" width="20" height="3" rx="1.5" fill="#7DD3FC" fill-opacity="0.8"/>
      <rect x="12" y="27" width="14" height="3" rx="1.5" fill="#7DD3FC" fill-opacity="0.8"/>
      <rect x="12" y="33" width="18" height="3" rx="1.5" fill="#7DD3FC" fill-opacity="0.8"/>
      <rect x="18" y="16" width="30" height="30" rx="6" fill="#0284C7"/>
      <path d="M23 35v-8l3.5 4 3.5-4v8" stroke="#FFFFFF" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M40 27v8m0 0l-2.5-2.5m2.5 2.5l2.5-2.5" stroke="#FFFFFF" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>`;

  const svgPpt = `
    <svg class="home-brand-icon" viewBox="0 0 54 54" width="54" height="54" fill="none">
      <rect x="6" y="8" width="32" height="38" rx="5" fill="#8E2A12"/>
      <rect x="12" y="15" width="20" height="3" rx="1.5" fill="#FCA585" fill-opacity="0.8"/>
      <circle cx="20" cy="28" r="6" stroke="#FCA585" stroke-width="2" fill="none" opacity="0.85"/>
      <path d="M20 22v6h6" stroke="#FCA585" stroke-width="2" opacity="0.85"/>
      <rect x="18" y="16" width="30" height="30" rx="6" fill="#C43E1C"/>
      <text x="33" y="38" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-weight="800" font-size="20" fill="#FFFFFF" text-anchor="middle">P</text>
    </svg>`;

  const cardWord = makeCard("word", "DOCX", "Word", "Documento de Texto", "Texto formatado, cabeçalhos, páginas A4, normas ABNT e exportação .docx.", svgWord);
  const cardExcel = makeCard(
    "excel",
    "XLSX",
    "Excel",
    "Planilha & Tabelas",
    "Grade de verdade com fórmulas calculadas, R$/%/data, várias abas, mesclas e arquivo .xlsx que abre no Excel.",
    svgExcel
  );
  const cardMd = makeCard("md", "MARKDOWN", "Markdown", "Texto Rápido & IA", "Escrita rápida, leve e focada, com visualização dupla simultânea em tempo real.", svgMd);
  const cardPpt = makeCard("ppt", "PPTX", "PowerPoint", "Apresentação de Slides", "Editor de lâminas com fita de formatação, caixas de texto posicionadas, notas do apresentador e exportação .pptx de verdade.", svgPpt);

  grid.append(cardWord, cardExcel, cardMd, cardPpt);
  secCards.append(grid);
  wrap.append(secCards);

  // 3. Modelos Prontos (Chips rápidos)
  const secTemplates = h("section", { class: "home-section templates-section" });
  const tplHead = h("div", { class: "home-section-head" });
  tplHead.innerHTML = `
    <h2 class="home-section-title">Modelos rápidos</h2>
    <span class="home-section-desc">Comece com uma estrutura pronta em um clique</span>
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
  addChip("i-grid", "Planilha Orçamentária", "Planilha Excel com receitas, despesas e totais calculados", () => ctx.createTemplate("orcamento"));
  addChip("i-spark", "Pedido para IA", "Template estruturado para orientar IAs e LLMs", () => ctx.createTemplate("ia"));
  addChip("i-import", "Importar do Office", "Abrir Word (.docx), Excel (.xlsx/.xlsm) e PowerPoint (.pptx) do seu computador", () => ctx.importOffice());
  addChip("i-open", "Abrir arquivo do PC", "Abrir qualquer arquivo existente do disco (Ctrl+O)", () => ctx.openExisting());

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

  // Atualiza a seleção visual dos 4 cards e re-renderiza a lista
  const setFormatFilter = (fmt: FormatFilter) => {
    selectedFormat = fmt;

    cardWord.classList.toggle("selected", fmt === "word");
    cardExcel.classList.toggle("selected", fmt === "excel");
    cardMd.classList.toggle("selected", fmt === "md");
    cardPpt.classList.toggle("selected", fmt === "ppt");

    // Atualiza o texto de dica nos rodapés dos cards
    const updateCta = (el: HTMLElement, isSelected: boolean) => {
      const label = el.querySelector(".home-card-cta-label");
      if (label) label.textContent = isSelected ? "✓ Filtro ativo (clique p/ tirar)" : "Filtrar recentes";
    };
    updateCta(cardWord, fmt === "word");
    updateCta(cardExcel, fmt === "excel");
    updateCta(cardMd, fmt === "md");
    updateCta(cardPpt, fmt === "ppt");

    void renderList();
  };

  const renderList = async () => {
    listContainer.textContent = "";

    // Se houver um filtro por formato ativo, exibe barra informativa com botão de limpar
    if (selectedFormat !== "all") {
      const meta = FORMAT_META[selectedFormat];
      const filterBar = h("div", { class: "home-filter-active-bar" });
      filterBar.innerHTML = `
        <span class="home-filter-badge-chip">
          <span class="home-filter-badge-dot badge-${selectedFormat}">●</span>
          <span>Mostrando apenas: <b>${meta.label} (${meta.ext})</b></span>
          <button class="home-filter-clear-btn" type="button" title="Limpar filtro e ver todos os arquivos">Limpar filtro ✕</button>
        </span>
      `;
      filterBar.querySelector(".home-filter-clear-btn")?.addEventListener("click", () => {
        setFormatFilter("all");
      });
      listContainer.append(filterBar);

      // Card rápido para criar um novo documento desse formato
      const createRow = h("div", { class: `home-file-row home-file-row-new new-${selectedFormat}` });
      createRow.innerHTML = `
        <div class="home-file-col-main">
          <div class="home-file-icon file-icon-${selectedFormat}">
            <svg class="ic"><use href="#i-plus"/></svg>
          </div>
          <div class="home-file-info">
            <span class="home-file-name">+ Criar novo ${meta.newLabel} em branco</span>
            <span class="home-file-path">Começar a editar um novo arquivo no formato ${meta.ext}</span>
          </div>
        </div>
        <div class="home-file-col-meta">
          <button class="btn small primary home-file-open" type="button">Criar agora</button>
        </div>
      `;
      createRow.addEventListener("click", () => ctx.createDoc(selectedFormat as "word" | "excel" | "md" | "ppt"));
      listContainer.append(createRow);
    }

    if (activeTab === "recents") {
      const recents = ctx.recents();
      const filtered = recents.filter((r) => {
        if (selectedFormat !== "all" && detectFormat(r.path) !== selectedFormat) return false;
        if (!filterText) return true;
        return r.name.toLowerCase().includes(filterText) || r.path.toLowerCase().includes(filterText);
      });

      if (!filtered.length) {
        const empty = h("div", { class: "home-empty" });
        if (selectedFormat !== "all") {
          const meta = FORMAT_META[selectedFormat];
          empty.innerHTML = `
            <svg class="home-empty-ic"><use href="#${meta.icon}"/></svg>
            <p>Nenhum arquivo recente de ${meta.label} encontrado.</p>
            <span class="home-empty-hint">Clique no botão "+ Criar novo ${meta.newLabel}" acima para começar.</span>
          `;
        } else {
          empty.innerHTML = `
            <svg class="home-empty-ic"><use href="#i-clock"/></svg>
            <p>${filterText ? "Nenhum arquivo recente corresponde à busca." : "Nenhum arquivo recente ainda."}</p>
            <span class="home-empty-hint">Os arquivos que você abrir ou salvar aparecerão aqui para acesso rápido.</span>
          `;
        }
        listContainer.append(empty);
        return;
      }

      const grid = h("div", { class: "home-file-grid" });
      const cartoes: { item: { path: string }; papel: HTMLElement }[] = [];
      filtered.forEach((item) => {
        const fmt = detectFormat(item.path);
        const meta = FORMAT_META[fmt];
        const card = h("button", { class: `home-file-card card-${fmt}`, type: "button" });
        card.title = item.path;
        card.innerHTML = `
          <span class="home-file-preview">
            <span class="home-file-preview-ic">${fileIcon(kindOfPath(item.path))}</span>
          </span>
          <span class="home-file-nome">${escapeHtml(item.name)}</span>
          <span class="home-file-meta">
            <span class="home-file-tipo">${meta.label}</span>
            <span class="home-file-time">${fmtTime(new Date(item.at))}</span>
          </span>
          <span class="home-file-dir">${escapeHtml(docDirOf(item.path))}</span>
        `;
        card.addEventListener("click", () => ctx.openPath(item.path));
        grid.append(card);
        cartoes.push({ item, papel: card.querySelector(".home-file-preview") as HTMLElement });
      });
      listContainer.append(grid);

      // As prévias chegam DEPOIS (uma leitura por arquivo, no lado Rust): o cartão nasce com o
      // ícone do formato e troca por uma VERSÃO DO DOCUMENTO quando a leitura responde — a página
      // (Word/Markdown), a lâmina (PowerPoint) ou a grade (Excel), com o conteúdo do arquivo.
      // O texto do arquivo entra escapado (e o markdown passa pelo saneamento): é conteúdo de
      // fora, não pode virar marcação.
      void Promise.all(
        cartoes.map(async ({ item, papel }) => {
          const p = await ctx.preview(item.path);
          const html = previaEmHtml(estruturarPrevia(p.tipo, p.texto));
          if (!html) return;
          papel.classList.add("com-previa");
          papel.innerHTML = html;
        })
      );
    } else {
      // Rascunhos
      let drafts: files.DraftInfo[] = [];
      try {
        drafts = await ctx.drafts();
      } catch {
        drafts = [];
      }

      const filtered = drafts.filter((d) => {
        if (selectedFormat !== "all" && detectFormat(d.path) !== selectedFormat) return false;
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
              ${fileIcon(kindOfPath(draft.path))}
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
