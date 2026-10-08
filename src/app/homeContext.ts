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
        let titulo = "Documento";
        let texto = "";
        if (tipo === "excel") {
          titulo = "Planilha Excel";
          texto = [
            "# Planilha de Dados",
            "",
            "| ID | Descrição do Item | Categoria | Quantidade | Valor Unit. (R$) | Total (R$) |",
            "| :-: | :--- | :--- | ---: | ---: | ---: |",
            "| 01 | Item de Exemplo A | Serviços | 2 | 125,00 | 250,00 |",
            "| 02 | Item de Exemplo B | Suprimentos | 5 | 45,00 | 225,00 |",
            "| 03 | Licença de Sistema | Tecnologia | 1 | 380,00 | 380,00 |",
            "| 04 | Suporte Mensal | Operação | 1 | 150,00 | 150,00 |",
            "| **—** | **Total Geral** | **—** | **9** | **—** | **1.005,00** |",
            "",
            "> 📊 **Dica do Excel:** Colunas com alinhamento numérico à direita (`---:`) organizam valores monetários e quantidades. Você pode copiar tabelas para o Excel ou colar do Excel no editor.",
            "",
          ].join("\n");
        } else if (tipo === "md") {
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
        } else if (tipo === "ppt") {
          titulo = "Apresentação PowerPoint";
          texto = [
            "# Apresentação mdOffice",
            "",
            "## Subtítulo da sua Apresentação",
            "",
            "Apresentador · Data",
            "",
            "---",
            "",
            "## 1. Visão Geral",
            "",
            "- Apresentação moderna construída em slides simples",
            "- Cada lâmina é separada por uma linha de três traços (`---`)",
            "- Aperte **F5** a qualquer momento para entrar em tela cheia!",
            "",
            "---",
            "",
            "## 2. Principais Metas",
            "",
            "1. **Clareza:** Slides objetivos com tipografia elegante",
            "2. **Agilidade:** Foco no conteúdo sem perder tempo com alinhamento manual",
            "3. **Exportação:** Exporte para PDF com uma lâmina por página (Ctrl+P)",
            "",
            "---",
            "",
            "## 3. Conclusão",
            "",
            "Obrigado!",
            "",
            "> Aperte **F5** para iniciar o modo de apresentação agora mesmo.",
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
          rotulo = "Planilha Orçamentária";
          texto = [
            "# Orçamento e Custos do Projeto",
            "",
            "| Categoria | Descrição | Previsão (R$) | Realizado (R$) | Diferença (R$) |",
            "| :--- | :--- | ---: | ---: | ---: |",
            "| Pessoal | Desenvolvimento | 15.000,00 | 14.200,00 | + 800,00 |",
            "| Infraestrutura | Servidores & Nuvem | 3.500,00 | 3.100,00 | + 400,00 |",
            "| Marketing | Lançamento | 5.000,00 | 5.000,00 | 0,00 |",
            "| **Total** | | **23.500,00** | **22.300,00** | **+ 1.200,00** |",
            "",
          ].join("\n");
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
