# Funcionalidades

O que o mdOffice faz hoje, por módulo. Cada documento lista as funcionalidades daquele
motor; o **changelog** ([CHANGELOG.md](../CHANGELOG.md)) conta o que mudou e o
**histórico técnico** ([docs/historico-tecnico.md](historico-tecnico.md)) guarda o porquê
de cada mudança de linha.

| Módulo | O que é | Documento |
| --- | --- | --- |
| **MD\*** | O editor de Markdown: escrita, desenho, diagramas e a escrita assistida (corretor, sugestões, revisão, formalização e tradução) | [md.md](md.md) |
| **Documentos (.docx)** | Documentos `.docx` de verdade: páginas, estilos, tabelas, **imagens que flutuam com o texto em volta**, **modos de exibição** (impressão, rascunho, leitura), **régua** e impressão em PDF | [word.md](word.md) |
| **Planilhas (.xlsx)** | Planilhas `.xlsx`/`.xlsm`: grade que cresce, fórmulas, formatação e mesclagem | [excel.md](excel.md) |
| **Apresentações (.pptx)** | Apresentações `.pptx`: abrir/salvar com fidelidade, editar formas e apresentar (F5) | [powerpoint.md](powerpoint.md) |

Além dos módulos, o app tem recursos que valem para todos eles (abas, tela de Início,
histórico de versões, backup em disco, lixeira de documentos, configurações, busca de
comandos, navegação e organização das pastas dos projetos e modo foco) — esses ficam na
categoria **Geral** do [changelog](../CHANGELOG.md).

**Abas**: a fileira abre os documentos e cada aba tem menu (renomear, duplicar, mostrar na pasta,
copiar caminho, **abrir em nova janela (só este documento)**…). Arrastar uma aba **para fora da
janela** e soltar ali — ou escolher o item do menu — abre o documento numa **janela própria**: ela é
o app inteiro **sem as outras abas** (a barra do app, os diálogos e o salvar funcionam nela) e não
mexe na sessão das outras janelas. O documento é persistido antes de a aba sair da janela atual:
rascunhos são gravados, **documento novo ganha o rascunho dele na hora** e arquivos seus perguntam
se há alterações. Com o **Início** aberto por cima, **clicar na aba que já está ativa** traz o
documento de volta — antes só a aba nova escondia o Início, e era preciso escolher outro arquivo e
voltar para o original.

A **tela de Início** mostra os arquivos recentes numa **grade de cartões**, cada um com uma
**versão do documento** pré-carregada — o tipo dá a forma e o arquivo dá o conteúdo: **Documentos
(.docx)** e **Markdown** viram uma **página A4 em pé** no papel do tema (no escuro a folha escurece,
como no editor; o markdown chega renderizado e cada imagem vira um bloco de figura), as
**Apresentações (.pptx)** uma **lâmina 16:9** (sempre clara) e as **Planilhas (.xlsx)** uma **grade**
com o cabeçalho das colunas e o número das linhas. Nas **Apresentações (.pptx)** o cartão desenha a
**lâmina de verdade**: o `.pptx` é importado e o
mesmo renderizador do palco e do F5 põe fundo do tema, formas, imagens e o título no tamanho real
(16:9 ou 4:3, conforme o arquivo) — o texto extraído fica só como plano B. Sem texto (ou num
formato sem prévia), o cartão fica com o ícone do formato. O `.md` lê
o próprio texto e os formatos do Office (.docx/.pptx/.xlsx) abrem o zip e tiram o texto do XML
principal, no lado Rust (comando `preview_file`) — o documento **não** é carregado no app só para a
prévia (no `.xlsx`, o mesmo comando lê a planilha e devolve as primeiras linhas com as células
separadas por TAB; a estrutura de cada cartão é decidida em `src/homePrevia.ts`). Com documento
aberto, o Início tem o caminho de volta visível: o botão **Voltar** fixo ao lado do logo e o
**Continuar editando** (com o nome do arquivo) como primeira ação do cabeçalho — e o **Esc**
fecha o Início, devolvendo o foco para o editor.

**Identidade e marcas**: os quatro formatos têm **cores e desenhos próprios** — índigo (Markdown),
violeta (Word), fúcsia (Excel) e rosa (PowerPoint) —, de propósito longe do azul, verde e laranja das
marcas do Office; os cartões trazem uma **folha, uma grade, uma lâmina e o "M↓"**, nunca letras em
chapas coloridas. O logo (o mesmo do executável) aparece no cabeçalho, e o rodapé da Início diz que o
**mdOffice não é afiliado, patrocinado nem endossado pela Microsoft** — Word, Excel e PowerPoint são
marcas da Microsoft Corporation (o mesmo aviso está no `README`).

## Documentos relacionados

- [Estrutura do projeto](estrutura-do-projeto.md) — como o código está organizado.
- [Roadmap de funcionalidades](roadmap-funcionalidades.md) — o que o módulo de Apresentações já faz e o que vem depois.
- [Funções do Excel](excel/formulas/README.md) — cada função com sintaxe, regras e exemplos.
- [Mapas da UI do DeckCraft](ui-deckcraft-abas.md) · [painéis](ui-deckcraft-paineis.md) — referência de interface usada como inspiração.
