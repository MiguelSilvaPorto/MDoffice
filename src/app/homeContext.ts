// O que a página Início pode fazer (criar documentos, modelos, abrir recentes).

import type { App } from "./app";
import * as files from "../files";
import { newTab } from "../tabs";
import { type HomeCtx } from "../homePage";
import { $, toast, baseName } from "../util";
import { AI_TEMPLATE } from "./constants";

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

      createTemplate: (template) => {
        this.hideHome();
        let texto = "";
        let rotulo = "Modelo";
        if (template === "abnt") {
          rotulo = "Trabalho ABNT";
          texto = [
            "# TÍTULO DO TRABALHO ACADÊMICO",
            "",
            "## SUBTÍTULO",
            "",
            "**Nome do Autor**",
            "",
            "---",
            "",
            "### RESUMO",
            "Este trabalho apresenta uma abordagem prática para elaboração de documentos conforme os padrões da ABNT. Palavras-chave: Documento. Normas. ABNT.",
            "",
            "---",
            "",
            "### 1. INTRODUÇÃO",
            "Contextualização do tema, justificativa e objetivos geral e específicos da pesquisa.",
            "",
            "### 2. DESENVOLVIMENTO",
            "Revisão teórica, metodologia aplicada e discussão dos resultados obtidos.",
            "",
            "### 3. CONSIDERAÇÕES FINAIS",
            "Síntese dos achados e recomendações para trabalhos futuros.",
            "",
            "---",
            "",
            "### REFERÊNCIAS",
            "- SOBRENOME, Nome. *Título da Obra em Itálico*. Cidade: Editora, 2026.",
            "- ASSOCIAÇÃO BRASILEIRA DE NORMAS TÉCNICAS. *NBR 14724*: Informação e documentação. Rio de Janeiro: ABNT, 2011.",
            "",
          ].join("\n");
        } else if (template === "relatorio") {
          rotulo = "Relatório Executivo";
          texto = [
            "# Relatório Executivo Mensal",
            "",
            "**Período:** Outubro / 2026",
            "**Responsável:** Equipe de Gestão",
            "",
            "---",
            "",
            "## 1. Sumário Executivo",
            "Breve resumo com as principais métricas e conquistas do período.",
            "",
            "## 2. Metas e Indicadores",
            "| Indicador | Meta | Realizado | Status |",
            "| :--- | ---: | ---: | :-: |",
            "| Usuários Ativos | 10.000 | 12.450 | ✅ Superado |",
            "| Tempo de Resposta | < 200ms | 145ms | ✅ No prazo |",
            "| Satisfação (CSAT) | 90% | 94% | ✅ Superado |",
            "",
            "## 3. Próximos Passos",
            "Plano de ação para o próximo ciclo de entregas.",
            "",
          ].join("\n");
        } else if (template === "orcamento") {
          // orçamento é planilha de verdade: abre o motor com as contas já montadas
          this.hideHome();
          void this.criarOrcamento();
          return;
        } else if (template === "ia") {
          rotulo = "Pedido para IA";
          texto = AI_TEMPLATE;
        }

        const tab = newTab(this.editor.createState(texto), { path: null, isDraft: false, statusSaved: "Novo arquivo" });
        this.tabs.push(tab);
        this.selectTab(tab.id);
        toast(`${rotulo} criado com sucesso.`, "ok", 3500);
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
    };
  },
};
