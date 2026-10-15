# Funcionalidades

O que o mdOffice faz hoje, por módulo. Cada documento lista as funcionalidades daquele
motor; o **changelog** ([CHANGELOG.md](../CHANGELOG.md)) conta o que mudou e o
**histórico técnico** ([docs/historico-tecnico.md](historico-tecnico.md)) guarda o porquê
de cada mudança de linha.

| Módulo | O que é | Documento |
| --- | --- | --- |
| **MD\*** | O editor de Markdown: escrita, desenho, diagramas e a escrita assistida (corretor, sugestões, revisão, formalização e tradução) | [md.md](md.md) |
| **Word** | Documentos `.docx` de verdade: páginas, estilos, tabelas, imagens e impressão em PDF | [word.md](word.md) |
| **Excel** | Planilhas `.xlsx`/`.xlsm`: grade que cresce, fórmulas, formatação e mesclagem | [excel.md](excel.md) |
| **PowerPoint** | Apresentações `.pptx`: abrir/salvar com fidelidade, editar formas e apresentar (F5) | [powerpoint.md](powerpoint.md) |

Além dos módulos, o app tem recursos que valem para todos eles (abas, tela de Início,
histórico de versões, backup em disco, lixeira de documentos, configurações, busca de
comandos e modo foco) — esses ficam na categoria **Geral** do [changelog](../CHANGELOG.md).

A **tela de Início** mostra os arquivos recentes numa **grade de cartões**, cada um com a
**prévia do documento** (um papel com o título e o começo do texto, na cor do formato): o
`.md` lê o próprio texto e os formatos do Office (.docx/.pptx/.xlsx) abrem o zip e tiram o
texto do XML principal, no lado Rust (comando `preview_file`) — o documento **não** é
carregado no app só para a prévia.

## Documentos relacionados

- [Estrutura do projeto](estrutura-do-projeto.md) — como o código está organizado.
- [Paridade com o DeckCraft](paridade-deckcraft.md) — checklist do que falta para alcançar a referência.
- [Funções do Excel](excel/formulas/README.md) — cada função com sintaxe, regras e exemplos.
- [Mapas da UI do DeckCraft](ui-deckcraft-abas.md) · [painéis](ui-deckcraft-paineis.md) — referência de interface usada como inspiração.
