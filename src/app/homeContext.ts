// O que a página Início pode fazer (criar documentos, modelos, abrir recentes).

import type { App } from "./app";
import * as files from "../files";
import { newTab, tabLabel } from "../tabs";
import { type HomeCtx } from "../homePage";
import { $, toast, baseName } from "../util";


export const homeContextMethods = {
  homeContext(this: App): HomeCtx {
    return {
      createDoc: (tipo) => {
        this.hideHome();
        if (tipo === "word") {
          void this.newWordDoc();
          return;
        }
        if (tipo === "ppt") {
          // apresentação de verdade: abre o motor de PowerPoint, não um .md
          void this.newPowerPointDoc();
          return;
        }
        if (tipo === "excel") {
          // planilha de verdade: abre o motor de Excel, não um .md
          void this.newExcelDoc();
          return;
        }
        let titulo = "Documento";
        let texto = "";
        if (tipo === "md") {
          titulo = "Documento Markdown";
          texto = [
            "# Novo Documento Markdown",
            "",
            "Escreva com agilidade e foco na escrita.",
            "",
            "## Destaques",
            "- [x] Pré-visualização simultânea em tempo real lado a lado",
            "- [ ] Tradução automática com um clique (`Ctrl+Alt+T`)",
            "- [ ] Desenho à mão livre ou vetorial (`Ctrl+Shift+D`)",
            "- [ ] Revisão ortográfica e estilo ABNT",
            "",
          ].join("\n");
        }

        const tab = newTab(this.editor.createState(texto), { path: null, isDraft: false, statusSaved: "Novo arquivo" });
        this.tabs.push(tab);
        this.selectTab(tab.id);
        toast(`${titulo} criado — use Ctrl+Shift+S para salvar numa pasta sua.`, "ok", 3800);
      },

      openExisting: () => {
        this.hideHome();
        void this.openDocDialog();
      },

      importOffice: () => {
        this.hideHome();
        void this.importOfficeDialog();
      },

      openPath: (path) => {
        this.hideHome();
        void this.openPath(path);
      },

      recents: () => {
        return this.recents.map((r) => ({
          path: r.path,
          name: baseName(r.path),
          at: r.at,
        }));
      },

      /** Prévia do documento para o cartão da lista (o Rust lê o começo do texto). */
      preview: (path) => files.previewDoc(path),

      drafts: () => files.listDrafts(),

      openDraft: (draft) => {
        this.hideHome();
        void this.openPath(draft.path);
      },

      deleteDraft: async (path) => {
        await files.deleteDraft(path);
        toast("Rascunho excluído.", "info", 2000);
      },

      closeHome: () => this.hideHome(),
      hasOpenTabs: this.tabs.length > 0,
      // o documento que está aberto agora: o botão de voltar diz o nome dele
      docAberto: (() => {
        const t = this.tabs.find((x) => x.id === this.tab?.id) ?? this.tabs[0];
        if (!t) return null;
        return { nome: tabLabel(t), tipo: t.kind && t.kind !== "doc" ? t.kind : "md" };
      })(),
    };
  },
};
