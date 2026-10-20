// O catálogo de comandos do app — o que a busca de funções (Ctrl+K) oferece
// além dos botões das fitas (esses são coletados do DOM, em `busca/coleta.ts`).
//
// Cada comando diz em qual módulo ele vale: com uma planilha aberta, a busca
// esconde as funções de Word, de Apresentação e de Markdown.

import type { App } from "./app";
import { tabLabel } from "../tabs";
import { focarBusca } from "../busca/interface";
import type { Comando, Modulo } from "../busca/tipos";
import { fileIcon, kindOfPath, kindOfTab } from "../fileIcons";
import { toast, baseName, docDirOf, stripExt, loadJSON, saveJSON } from "../util";
import { teclaVisivel } from "./keymap";

export const commandsMethods = {
  /** A busca de funções: abre a barra no topo com tudo o que dá para fazer agora. */
  abrirBusca(this: App): void {
    focarBusca();
  },

  /**
   * O catálogo de comandos do app — a parte que não vem da fita.
   *
   * É montado na hora (as abas, os recentes e o salvamento automático mudam),
   * por isso a busca pergunta por ele cada vez que abre.
   */
  comandosDaBusca(this: App): Comando[] {
    const c: Comando[] = [];
    const add = (grupo: string, label: string, run: () => void, extra?: Partial<Comando>) =>
      c.push({ grupo, label, run, ...extra });
    /** o comando vale só nestes módulos (sem a lista, vale em todos) */
    const so = (...modulos: Modulo[]): Partial<Comando> => ({ modulos });

    // ------------------------------------------------------------ documento
    add("Documento", "Novo documento (nova aba)", () => void this.newDoc(), {
      iconeHtml: fileIcon("md"),
      atalho: teclaVisivel("nova-aba"),
      palavras: "criar markdown",
    });
    add("Documento", "Nova planilha (.xlsx)", () => void this.newExcelDoc(), {
      iconeHtml: fileIcon("excel"),
      palavras: "planilha excel tabela grade",
    });
    add("Documento", "Novo documento (.docx)", () => void this.newWordDoc(), {
      iconeHtml: fileIcon("word"),
      palavras: "word documento paginas",
    });
    add("Documento", "Nova apresentação (.pptx)", () => void this.newPowerPointDoc(), {
      iconeHtml: fileIcon("ppt"),
      palavras: "apresentacao slides powerpoint deck laminas",
    });
    add("Documento", "Abrir arquivo…", () => void this.openDocDialog(), {
      icone: "i-open",
      atalho: teclaVisivel("abrir"),
      palavras: "abrir open arquivo",
    });
    add("Documento", "Importar do Office (.docx, .xlsx, .pptx)…", () => void this.importOfficeDialog(), {
      icone: "i-import",
      palavras: "docx xlsx xlsm pptx importar",
    });
    add("Documento", "Salvar", () => void this.save(false), {
      icone: "i-save",
      atalho: teclaVisivel("salvar"),
    });
    add("Documento", "Salvar como…", () => void this.save(true), {
      icone: "i-saveas",
      atalho: teclaVisivel("salvar-como"),
    });
    add(
      "Documento",
      this.autosaveLigado ? "Desativar salvamento automático deste documento" : "Ativar salvamento automático deste documento",
      () => this.toggleAutosave(),
      {
        icone: this.autosaveLigado ? "i-cloud-off" : "i-cloud",
        palavras: "autosave salvar automatico ligar desligar",
      }
    );
    add("Documento", "Renomear documento", () => this.tabBar.beginRename(this.tab.id), {
      icone: "i-edit",
      atalho: teclaVisivel("renomear"),
      palavras: "nome titulo",
    });
    add("Documento", "Histórico de versões", () => void this.openHistory(), {
      icone: "i-clock",
      palavras: "versoes restaurar voltar anterior alteracoes backup",
    });
    add("Documento", "Salvar versão agora", () => void this.saveVersionNow(), {
      icone: "i-clock",
      palavras: "historico marcar",
    });
    add(
      "Documento",
      "Backup agora",
      () => this.backupNow(this.path, "manual").then(() => toast("Cópia de backup gravada.", "ok", 2600)),
      { icone: "i-shield", palavras: "backup copia seguranca" }
    );
    add("Documento", "Arquivos só no backup", () => this.openMissingBackups(), {
      icone: "i-shield",
      palavras: "sumiu apagado restaurar recuperar",
    });
    add("Documento", "Fechar aba", () => void this.closeTab(this.activeTabId()), {
      icone: "i-close",
      atalho: teclaVisivel("fechar-aba"),
    });
    add("Documento", "Fechar todos os documentos", () => void this.closeAll(), {
      icone: "i-close",
      atalho: teclaVisivel("fechar-tudo"),
      palavras: "fechar tudo abas arquivos",
    });
    add("Documento", "Reabrir aba fechada", () => void this.reopenClosedTab(), {
      icone: "i-undo",
      atalho: teclaVisivel("reabrir-aba"),
    });

    // --------------------------------------------------------------- buscar
    add("Buscar", "Buscar no conteúdo dos documentos", () => this.sidebar.focusSearch(), {
      icone: "i-search",
      palavras: "procurar texto pesquisar projetos",
    });

    // -------------------------------------------------------- configurações
    add("Configurações", "Abrir configurações", () => this.showSettings(), {
      icone: "i-gear",
      palavras: "preferencias ajustes tom historico",
    });
    add("Configurações", "Tom do texto: formal", () => this.setTonePref("formal"), { icone: "i-text" });
    add("Configurações", "Tom do texto: neutro", () => this.setTonePref("neutro"), { icone: "i-text" });
    add("Configurações", "Tom do texto: informal", () => this.setTonePref("informal"), { icone: "i-text" });

    // -------------------------------------------------------------- exportar
    add("Exportar", "Exportar…", () => this.openExport(), {
      icone: "i-export",
      atalho: teclaVisivel("exportar"),
    });
    add("Exportar", "Exportar como PDF", () => this.openExport("pdf"), {
      icone: "i-pdf",
      palavras: "imprimir",
    });
    add("Exportar", "Exportar como documento (.docx)", () => this.openExport("docx"), {
      icone: "i-word",
      palavras: "word doc",
    });
    add("Exportar", "Exportar como página web (.html)", () => this.openExport("html"), {
      icone: "i-web",
      palavras: "site",
    });
    add("Exportar", "Exportar Markdown", () => this.openExport("md"), { icone: "i-doc" });
    add("Exportar", "Exportar texto simples", () => this.openExport("txt"), {
      icone: "i-text",
      palavras: "txt",
    });
    add("Exportar", "Pacote para IA (.zip)", () => this.openExport("zip"), {
      icone: "i-zip",
      palavras: "zip pacote tudo junto",
    });
    add("Exportar", "Copiar formatado (colar em outro editor)", () => this.openExport("copy"), {
      icone: "i-copy",
    });
    add("Exportar", "Copiar Markdown para a IA", () => void this.copyForAI(), {
      icone: "i-copy",
      atalho: teclaVisivel("copiar-ia"),
      ...so("md"),
    });

    // ------------------------------------------------------------ tradução
    const tr = this.translation;
    add(
      "Tradução",
      tr.settings.enabled ? "Desligar tradução automática" : "Ligar tradução automática (PT-BR → inglês)",
      () => this.toggleTranslation(),
      { icone: "i-globe", atalho: teclaVisivel("traducao"), palavras: "traduzir english", ...so("md") }
    );
    add("Tradução", "Ajustes da tradução (offline, glossário…)", () => this.showSettings("traducao"), {
      icone: "i-gear",
      palavras: "motor modelo glossario",
      ...so("md"),
    });
    add("Tradução", "Ver só português", () => this.showLanguage("pt"), { icone: "i-globe", ...so("md") });
    add("Tradução", "Ver só inglês", () => this.showLanguage("en"), { icone: "i-globe", ...so("md") });
    add("Tradução", "Ver português e inglês juntos", () => this.showLanguage("both"), { icone: "i-globe", ...so("md") });

    // ------------------------------------------------------------- escrever
    add("Escrever", "Revisar texto", () => this.openReview(), {
      icone: "i-check",
      atalho: teclaVisivel("revisar"),
      palavras: "ortografia gramatica",
      ...so("md"),
    });
    add("Escrever", "Revisão inteligente (palavras repetidas)", () => void this.openDeepReview(), {
      icone: "i-replace",
      palavras: "sinônimos repetição diff trocar palavras",
      ...so("md"),
    });
    add("Escrever", "Apresentar (slides)", () => this.openSlides(), {
      icone: "i-eye",
      atalho: teclaVisivel("slides"),
      palavras: "apresentação slides powerpoint deck",
      ...so("md"),
    });
    add("Apresentação", "Apresentar esta apresentação (F5)", () => this.presentActive(), {
      icone: "i-eye",
      palavras: "apresentar slideshow F5 modo apresentação",
      ...so("ppt"),
    });
    add("Escrever", "Modo foco", () => this.toggleFocus(), {
      icone: "i-focus",
      atalho: teclaVisivel("modo-foco"),
      palavras: "concentrar zen",
    });
    add("Escrever", "Desenhar", () => void this.openDraw(), {
      icone: "i-draw",
      atalho: teclaVisivel("desenhar"),
      ...so("md"),
    });
    add("Escrever", "Formatar texto (acentos, pontuação, espaçamento, maiúsculas)", () => void this.formatarTexto(), {
      icone: "i-brush",
      palavras: "formatar pontuacao virgula ponto espaco maiuscula acento corrigir tudo",
      ...so("md"),
    });
    add("Escrever", "Formalizar texto (prévia antes/depois)…", () => this.openFormalizar(), {
      icone: "i-feather",
      atalho: teclaVisivel("formalizar"),
      palavras: "formalidade registro oralidade giria muleta atenuacao pra a gente acho que mip antes depois",
      ...so("md"),
    });
    add("Escrever", "Dicionário pessoal…", () => this.showDictionary(), {
      icone: "i-dicionario",
      palavras: "palavras dicionario glossario",
      ...so("md"),
    });

    // ------------------------------------------------------------------ ver
    add("Ver", "Alternar tema claro/escuro", () => this.applyTheme(document.documentElement.dataset.theme !== "dark"), {
      icone: document.documentElement.dataset.theme === "dark" ? "i-sun" : "i-moon",
      palavras: "escuro dark claro tema",
    });
    add("Ver", "Mostrar/ocultar painel lateral", () => this.toggle("no-sidebar"), { icone: "i-sidebar" });
    add("Ver", "Mostrar/ocultar pré-visualização", () => this.toggle("no-preview"), { icone: "i-eye" });
    add("Ver", "Início (Hub de criação: documentos, planilhas, apresentações e Markdown)", () => this.showHome(), {
      icone: "i-home",
      palavras: "home inicio novo hub criar",
    });
    add("Ver", "Painel: Projetos", () => this.openSidePanel("projects"), { icone: "i-folder" });
    add("Ver", "Painel: Estrutura do documento", () => this.openSidePanel("outline"), { icone: "i-list" });
    add("Ver", "Boas-vindas e ajuda", () => this.showWelcome(), {
      icone: "i-help",
      atalho: teclaVisivel("ajuda"),
    });

    // ------------------------------------------------------- abas e recentes
    this.tabs.forEach((t, i) => {
      if (t === this.tab) return;
      add("Ir para a aba", tabLabel(t), () => void this.switchTo(t.id), {
        iconeHtml: fileIcon(kindOfTab(t.kind)),
        atalho: i < 9 ? `Ctrl+${i + 1}` : undefined,
      });
    });
    this.recents.slice(0, 8).forEach((r) =>
      add("Recentes", stripExt(baseName(r.path)), () => void this.openPath(r.path), {
        iconeHtml: fileIcon(kindOfPath(r.path)),
        palavras: docDirOf(r.path),
      })
    );

    return c;
  },

  showLanguage(this: App, view: "pt" | "en" | "both"): void {
    if (!this.translation.settings.enabled) this.toggleTranslation();
    this.translation.setView(view);
  },

  openSidePanel(this: App, panel: "projects" | "outline"): void {
    document.body.classList.remove("no-sidebar");
    this.sidebar.show(panel);
  },

  /** Modo foco: só o texto, sem painéis nem barras (Esc ou Ctrl+Shift+F para sair). */
  toggleFocus(this: App, force?: boolean): void {
    const on = force ?? !document.body.classList.contains("focus-mode");
    document.body.classList.toggle("focus-mode", on);
    if (on) toast("Modo foco: Esc para sair.", "info", 2200);
    this.editor.focus();
  },

  toggleTranslation(this: App): void {
    if (this.tab.kind === "word") {
      toast("A tradução ao vivo ainda não é só para Markdown. Em documentos (.docx) use Exportar e escolha o idioma Inglês.", "info", 5200);
      return;
    }
    if (this.tab.kind === "xlsx") {
      toast(
        "A tradução ao vivo ainda não é só para Markdown. Em planilhas, as fórmulas e os valores ficam como estão.",
        "info",
        5200
      );
      return;
    }
    const on = !this.translation.settings.enabled;
    if (on && document.body.classList.contains("no-preview")) document.body.classList.remove("no-preview");
    this.translation.setEnabled(on);
    if (on && !loadJSON<boolean>("mdc.tr-intro", false)) {
      saveJSON("mdc.tr-intro", true);
      toast("Você escreve em português; o inglês aparece ao lado e acompanha o que você digita. Ajustes: botão “Ajustes” acima da pré-visualização.", "info", 7000);
    }
  },

  toggle(this: App, cls: string): void {
    const on = document.body.classList.toggle(cls);
    saveJSON(`mdc.${cls}`, on);
    if (cls === "no-preview" || cls === "no-sidebar") {
      this.editor?.view?.requestMeasure();
    }
    if (cls === "no-sidebar") {
      // a barra continua no DOM (recolhe animando): "inert" a tira do Tab e dos leitores de tela
      document.getElementById("sidebar")?.toggleAttribute("inert", on);
      window.setTimeout(() => this.editor?.view?.requestMeasure(), 320);
    }
  },
};
