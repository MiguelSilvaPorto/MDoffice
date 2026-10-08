// Trechos de Markdown que a barra de ferramentas insere (tabela, diagrama, modelo para IA).

export const TABLE_SNIPPET = ["", "| Coluna A | Coluna B |", "| --- | --- |", "| $0 |  |", ""].join("\n");

export const MERMAID_SNIPPET = [
  "",
  "```mermaid",
  "flowchart TD",
  "  A[Início] --> B{Decisão}",
  "  B -->|Sim| C[Ação]",
  "  B -->|Não| D[Fim]",
  "```",
  "",
  "$0",
].join("\n");

export const AI_TEMPLATE = [
  "",
  "# Título do pedido",
  "",
  "## Objetivo",
  "Escreva em uma frase o resultado esperado.",
  "",
  "## Contexto",
  "- Ambiente / stack: ",
  "- Restrições: ",
  "",
  "## Requisitos",
  "- [ ] $0",
  "- [ ] ",
  "",
  "## Exemplos / referências",
  "",
  "## Formato da resposta",
  "- Passo a passo numerado, com código comentado e exemplos.",
  "",
].join("\n");
