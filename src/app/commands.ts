// Busca de comandos (Ctrl+K), modo foco e alternâncias de painéis.

import type { App } from "./app";
import { tabLabel } from "../tabs";
import { openPalette, type PaletteItem } from "../palette";
import { $, toast, baseName, docDirOf, stripExt, loadJSON, saveJSON } from "../util";

export const commandsMethods = {
  /** Busca de comandos (Ctrl+K). */
  openPalette(this: App): void {
    const items: PaletteItem[] = [];
    const add = (group: string, label: string, run: () => void, hint?: string, keywords?: string) =>
      items.push({ group, label, run, hint, keywords });

    add("Documento", "Novo documento (nova aba)", () => void this.newDoc(), "Ctrl+T", "criar");
    add("Documento", "Abrir arquivo…", () => void this.openDocDialog(), "Ctrl+O");
    add("Documento", "Salvar", () => void this.save(false), "Ctrl+S");
    add("Documento", "Salvar como…", () => void this.save(true), "Ctrl+Shift+S");
    add("Documento", "Renomear documento", () => this.tabBar.beginRename(this.tab.id), "F2", "nome título");
    add("Documento", "Histórico de versões", () => void this.openHistory(), undefined, "versoes restaurar voltar anterior");
    add("Documento", "Salvar versão agora", () => void this.saveVersionNow(), undefined, "historico marcar");
    add("Buscar", "Buscar no conteúdo dos documentos", () => this.sidebar.focusSearch(), undefined, "procurar texto pesquisar projetos");
    add("Configurações", "Abrir configurações", () => this.showSettings(), undefined, "preferencias ajustes tom historico");
    add("Configurações", "Tom do texto: formal", () => this.setTonePref("formal"));
    add("Configurações", "Tom do texto: neutro", () => this.setTonePref("neutro"));
    add("Configurações", "Tom do texto: informal", () => this.setTonePref("informal"));
    add("Documento", "Fechar aba", () => void this.closeTab(this.activeTabId()), "Ctrl+W");
    add("Documento", "Reabrir aba fechada", () => void this.reopenClosedTab(), "Ctrl+Shift+T");

    add("Exportar", "Exportar…", () => this.openExport(), "Ctrl+Shift+E");
    add("Exportar", "Exportar como PDF", () => this.openExport("pdf"), undefined, "imprimir");
    add("Exportar", "Exportar como Word (.docx)", () => this.openExport("docx"), undefined, "doc");
    add("Exportar", "Exportar como página web (.html)", () => this.openExport("html"), undefined, "site");
    add("Exportar", "Exportar Markdown", () => this.openExport("md"));
    add("Exportar", "Exportar texto simples", () => this.openExport("txt"), undefined, "txt");
    add("Exportar", "Pacote para IA (.zip)", () => this.openExport("zip"), undefined, "zip");
    add("Exportar", "Copiar formatado (colar no Word)", () => this.openExport("copy"));
    add("Exportar", "Copiar Markdown para a IA", () => void this.copyForAI(), "Ctrl+Shift+C");

    const tr = this.translation;
    add("Tradução", tr.settings.enabled ? "Desligar tradução automática" : "Ligar tradução automática (PT-BR → inglês)", () => this.toggleTranslation(), "Ctrl+Alt+T", "traduzir english");
    add("Tradução", "Ajustes da tradução (offline, glossário…)", () => this.showSettings("traducao"), undefined, "motor modelo glossario");
    add("Tradução", "Ver só português", () => this.showLanguage("pt"));
    add("Tradução", "Ver só inglês", () => this.showLanguage("en"));
    add("Tradução", "Ver português e inglês juntos", () => this.showLanguage("both"));

    add("Escrever", "Revisar texto", () => this.openReview(), "F7", "ortografia gramática");
    add("Escrever", "Revisão inteligente (palavras repetidas)", () => this.openDeepReview(), undefined, "sinônimos repetição diff trocar palavras");
    add("Escrever", "Apresentar (slides)", () => this.openSlides(), "F5", "apresentação slides powerpoint deck");
    add("Escrever", "Modo foco", () => this.toggleFocus(), "Ctrl+Shift+F", "concentrar zen");
    add("Escrever", "Desenhar", () => void this.openDraw(), "Ctrl+Shift+D");
    add("Escrever", "Inserir imagem", () => void this.insertImageFromDialog());
    add("Escrever", "Inserir tabela", () => this.act("table"));
    add("Escrever", "Inserir diagrama", () => this.act("mermaid"));
    add("Escrever", "Inserir modelo para IA", () => this.act("ai-template"));
    add("Escrever", "Dicionário pessoal…", () => this.showDictionary());

    add("Ver", "Alternar tema claro/escuro", () => this.applyTheme(document.documentElement.dataset.theme !== "dark"), undefined, "escuro dark");
    add("Ver", "Mostrar/ocultar painel lateral", () => this.toggle("no-sidebar"));
    add("Ver", "Mostrar/ocultar pré-visualização", () => this.toggle("no-preview"));
    add("Ver", "Início (Hub de criação: Word, Excel, MD, PowerPoint)", () => this.showHome(), undefined, "home inicio novo hub criar");
    add("Ver", "Painel: Projetos", () => this.openSidePanel("projects"));
    add("Ver", "Painel: Estrutura do documento", () => this.openSidePanel("outline"));
    add("Ver", "Boas-vindas e ajuda", () => this.showWelcome(), "F1");

    this.tabs.forEach((t, i) => {
      if (t !== this.tab) add("Ir para a aba", tabLabel(t), () => void this.switchTo(t.id), i < 9 ? `Ctrl+${i + 1}` : undefined);
    });
    this.recents.slice(0, 8).forEach((r) => add("Recentes", stripExt(baseName(r.path)), () => void this.openPath(r.path), docDirOf(r.path)));
    openPalette(items);
  },

  showLanguage(this: App, view: "pt" | "en" | "both"): void {
    if (!this.translation.settings.enabled) this.toggleTranslation();
    this.translation.setView(view);
  },

  openSidePanel(this: App, panel: "projects" | "outline" | "context"): void {
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
      toast("A tradução ao vivo ainda é só para Markdown. Em documentos Word use Exportar e escolha o idioma Inglês.", "info", 5200);
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
  },
};
