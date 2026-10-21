// Barra de ferramentas e menu ⋯: ações, botões e estilo do desenho.

import type { App } from "./app";
import { deckSummary } from "../powerpoint/presenter";
import { $, $$, toast, loadJSON, saveJSON } from "../util";
import { teclaVisivel } from "./keymap";
import { TABLE_SNIPPET, AI_TEMPLATE } from "./constants";
import { abrirAiDocs } from "../aiDocs/dialog";
import { newTab } from "../tabs";
import { copyText } from "../util";

export const toolbarMethods = {
  act(this: App, name: string): void {
    // Sem documento aberto, as ações de escrita e inserção avisam em vez de mexer num documento
    // que não está à vista (os botões da barra, a fita e a paleta passam por aqui).
    if (name !== "palette" && name !== "translate-settings" && name !== "export" && this.semDocumento()) return;
    if (this.tab.kind === "word") {
      if (name === "image") {
        this.wordHost.pickImageDialog();
        return;
      }
      if (name === "draw") {
        toast("O desenho ainda não está disponível em documentos (.docx).", "info", 3200);
        return;
      }
    }
    if (this.tab.kind === "ppt") {
      if (name === "image") {
        void this.pickPptImage();
        return;
      }
      if (name === "draw") {
        toast("O desenho ainda não está disponível em apresentações.", "info", 3200);
        return;
      }
    }
    if (this.tab.kind === "xlsx") {
      if (name === "image") {
        toast("Imagens dentro da planilha ainda não são suportadas pelo motor.", "info", 3800);
        return;
      }
      if (name === "draw") {
        toast("O desenho ainda não está disponível em planilhas.", "info", 3200);
        return;
      }
    }
    switch (name) {
      case "heading":
        this.editor.cycleHeading();
        break;
      case "bold":
        this.editor.wrapSelection("**", "**", "texto");
        break;
      case "italic":
        this.editor.wrapSelection("*", "*", "texto");
        break;
      case "strike":
        this.editor.wrapSelection("~~", "~~", "texto");
        break;
      case "code":
        this.editor.wrapSelection("`", "`", "código");
        break;
      case "codeblock":
        this.editor.insert("\n```\n$0\n```\n");
        break;
      case "quote":
        this.editor.toggleLinePrefix("> ");
        break;
      case "list":
        this.editor.toggleLinePrefix("- ");
        break;
      case "olist":
        this.editor.toggleLinePrefix("1. ");
        break;
      case "task":
        this.editor.toggleLinePrefix("- [ ] ");
        break;
      case "link":
        this.editor.wrapSelection("[", "](https://)", "texto do link");
        break;
      case "align-left":
        this.editor.setAlignment("left");
        break;
      case "align-center":
        this.editor.setAlignment("center");
        break;
      case "align-right":
        this.editor.setAlignment("right");
        break;
      case "align-justify":
        this.editor.setAlignment("justify");
        break;
      case "mark":
        this.editor.wrapSelection("<mark>", "</mark>", "destaque");
        break;
      case "small":
        // letras menores (Markdown não tem tamanho de fonte; <small> é HTML seguro e simples)
        this.editor.wrapSelection("<small>", "</small>", "texto menor");
        break;
      case "table":
        this.editor.insert(TABLE_SNIPPET);
        break;
      case "hr":
        this.editor.insert("\n---\n");
        break;
      case "mermaid":
        this.newDiagram();
        break;
      case "ai-template":
        this.editor.insert(AI_TEMPLATE);
        break;
      case "ai-docs": {
        // novo documento .md com o texto pronto (o nome sugerido é o do arquivo: SKILL.md, AGENTS.md...)
        const criar = (nome: string, md: string) => {
          const tab = newTab(this.editor.createState(md), { path: null, isDraft: false, statusSaved: "Novo arquivo" });
          tab.title = nome;
          this.tabs.push(tab);
          this.selectTab(tab.id);
          toast(`${nome} criado — salve com Ctrl+Shift+S na pasta do projeto, com esse nome.`, "ok", 4200);
        };
        abrirAiDocs({
          // numa planilha, apresentação ou documento Word o texto vai para um documento novo
          inserir: (md) => (this.tab.kind && this.tab.kind !== "doc" ? criar("Documento", md) : this.editor.insert(md)),
          novo: criar,
          copiar: copyText,
        });
        break;
      }
      case "image":
        void this.insertImageFromDialog();
        break;
      case "draw":
        this.openDraw();
        break;
      case "translate-toggle":
        this.toggleTranslation();
        break;
      case "translate-settings":
        this.showSettings("traducao");
        break;
      case "export":
        this.openExport();
        break;
      case "palette":
        this.abrirBusca();
        break;
    }
  },

  buildMoreMenu(this: App, menu: HTMLElement): void {
    // Menu "Mais opções": só AÇÕES. Tudo que é ajuste (tema, painéis, correção,
    // sugestões, salvamento, tradução…) vive nas Configurações.
    this.ddItem(menu, { icon: "i-saveas", label: "Salvar como…", hint: teclaVisivel("salvar-como"), onPick: () => void this.save(true) });
    this.ddItem(menu, { icon: "i-import", label: "Importar do Office…", hint: ".docx .xlsx .xlsm .pptx", onPick: () => void this.importOfficeDialog() });
    this.ddSep(menu);
    this.ddItem(menu, { icon: "i-copy", label: "Copiar para a IA", hint: teclaVisivel("copiar-ia"), onPick: () => void this.copyForAI() });
    this.ddItem(menu, { icon: "i-export", label: "Exportar…", hint: teclaVisivel("exportar"), onPick: () => this.openExport() });
    this.ddItem(menu, { icon: "i-zip", label: "Pacote para IA (.zip)", hint: "tudo junto", onPick: () => this.openExport("zip") });
    this.ddSep(menu);
    this.ddItem(menu, { icon: "i-spark", label: "Configurações", hint: `tom ${this.settings.tone}`, onPick: () => this.showSettings() });
    this.ddItem(menu, { icon: "i-check", label: "Revisar texto", hint: teclaVisivel("revisar"), onPick: () => this.openReview() });
    this.ddItem(menu, { icon: "i-eye", label: "Apresentar (slides)", hint: `F5 · ${deckSummary(this.editor.getText())}`, onPick: () => this.openSlides() });
    this.ddSep(menu);
    this.ddItem(menu, { icon: "i-help", label: "Boas-vindas e ajuda", hint: teclaVisivel("ajuda"), onPick: () => this.showWelcome() });
  },

  buildDrawStyleMenu(this: App, menu: HTMLElement): void {
    const current = loadJSON<string>("mdc.drawstyle", "image") === "text" ? "text" : "image";
    this.ddItem(menu, {
      icon: "i-image",
      label: "Imagem (PNG)",
      checked: current === "image",
      onPick: () => this.setDrawStyle("image"),
    });
    this.ddItem(menu, {
      icon: "i-draw",
      label: "Letras e símbolos",
      hint: "texto puro",
      checked: current === "text",
      onPick: () => this.setDrawStyle("text"),
    });
    this.ddNote(menu, "Imagem guarda um PNG em assets/. Letras vira texto no próprio Markdown — ideal para mandar à IA.");
  },

  setDrawStyle(this: App, style: "image" | "text"): void {
    saveJSON("mdc.drawstyle", style);
    toast(
      style === "text"
        ? "Desenho em letras e símbolos: entra direto no Markdown."
        : "Desenho em imagem: vira PNG na pasta assets/.",
      "info",
      2600
    );
  },

  /**
   * A barra do topo acompanha o módulo. Na **apresentação** o grupo do **Desenhar** (o botão e a
   * setinha de estilo) sai: o desenho lá é a aba **Desenhar** da fita, e o botão do topo só respondia
   * com o aviso "ainda não disponível em apresentações". Nos outros módulos ele volta.
   */
  ajustarBarraDoTipo(this: App): void {
    const desenhar = document.querySelector<HTMLElement>(".tb-split-draw");
    if (desenhar) desenhar.style.display = this.tab?.kind === "ppt" ? "none" : "";
  },

  setupToolbar(this: App): void {
    // O "Novo" do topo era o único `title` com atalho escrito à mão — e dizia
    // Ctrl+N, que nem é o atalho do app (no navegador, Ctrl+N abre uma janela do
    // navegador e o app não vê a tecla). Agora ele mostra a tecla que vale aqui:
    // Ctrl+T no Tauri, Ctrl+Alt+N no navegador.
    const novo = document.querySelector<HTMLElement>('[data-act="new"]');
    if (novo) novo.title = `Novo documento (${teclaVisivel("nova-aba")})`;
    $$("[data-act]").forEach((btn) => {
      const name = btn.dataset.act!;
      btn.addEventListener("click", () => {
        switch (name) {
          case "new":
            void this.newDoc();
            break;
          case "open":
            void this.openDocDialog();
            break;
          case "save":
            void this.save(false);
            break;
          case "save-as":
            void this.save(true);
            break;
          case "toggle-autosave":
            this.toggleAutosave();
            break;
          case "copy-ai":
            void this.copyForAI();
            break;
          case "present":
            this.presentActive();
            break;
          case "welcome":
            this.showWelcome();
            break;
          case "export-html":
            this.openExport("html");
            break;
          case "export-bundle":
            this.openExport("zip");
            break;
          case "toggle-more": {
            const box = document.querySelector<HTMLElement>("#toolbar-more");
            if (box) {
              const show = box.hidden;
              box.hidden = !show;
              saveJSON("mdc.toolbar-more", show);
              btn.classList.toggle("active", show);
            }
            break;
          }
          case "toggle-sidebar":
            this.toggle("no-sidebar");
            break;
          case "toggle-preview":
            this.toggle("no-preview");
            break;
          case "theme":
            this.applyTheme(document.documentElement.dataset.theme !== "dark");
            break;
          default:
            this.act(name);
            break;
        }
      });
    });

    // menus "⋯"
    $$("[data-menu]").forEach((btn) => {
      const which = btn.dataset.menu!;
      btn.addEventListener("click", () => {
        if (which === "more") this.openMenu(btn, (m) => this.buildMoreMenu(m));
        else if (which === "draw-style") this.openMenu(btn, (m) => this.buildDrawStyleMenu(m));
      });
    });

    // estado da barra de formatação expandida
    const moreBox = document.querySelector<HTMLElement>("#toolbar-more");
    if (moreBox && loadJSON<boolean>("mdc.toolbar-more", false)) {
      moreBox.hidden = false;
      document.querySelector("#tb-more")?.classList.add("active");
    }
  },
};
