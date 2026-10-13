# Excel — planilhas `.xlsx`

Planilha com grade que cresce sob demanda, fórmulas em português e abertura de arquivos
`.xlsx`/`.xlsm` do Excel.

## A planilha

- **Grade que cresce sozinha**: role ou escreva além do fim e novas linhas/colunas aparecem
  (rolagem infinita), sem tamanho fixo.
- **Desfazer/refazer** funcionam de qualquer ponto da planilha (`Ctrl+Z` / `Ctrl+Y`).
- **Abas de planilha**: nova, duplicar, excluir e mover para a esquerda/direita.
- **Zoom** (aba Exibir e barra inferior) e **linhas de grade** ligáveis nas configurações.
- **Abrir `.xlsx`/`.xlsm`** e **salvar `.xlsx`**; macros não são preservadas (o app sugere
  salvar como `.xlsx` para não sobrescrever o original).

## Fita (abas Início, Fórmulas e Exibir)

- **Área de transferência**: colar, recortar, copiar e desfazer/refazer.
- **Fonte**: negrito, itálico, **cor de preenchimento** e **cor da fonte**.
- **Alinhamento**: esquerda, centro, direita; **mesclar** e **desfazer mesclagem**.
- **Número**: formatos (geral, número, moeda, porcentagem, data…), **R$**, **%**, separador
  de milhar e aumentar/diminuir **casas decimais**.
- **Células**: inserir/excluir **linha** e **coluna**, ajustar **altura** e **largura** ao
  conteúdo.
- **Edição**: **AutoSoma** (escreve `=SOMA(...)`), limpar conteúdo e formato, limpar só o formato.
- **Fórmulas**: biblioteca (AutoSoma, Média, Contar números, Mínimo, Máximo), barra de
  fórmulas e **auditoria** (mostrar o texto das fórmulas em vez dos valores).
- **Exibir**: zoom e mostrar fórmulas.

## Fórmulas

- Fórmulas em **português** com referências (`A1`, `$A$1`), operadores e erros tratados.
- **Documentação completa**: cada função por categoria (matemática, estatística, financeiras,
  data/hora, texto, pesquisa/referência, lógica, informação, engenharia, banco de dados e
  matrizes dinâmicas) em [docs/excel/formulas](excel/formulas/README.md), com sintaxe, regras,
  exemplos e o status no mdOffice.

## Configuração

Em **Configurar planilha** (engrenagem na fita): **linhas de grade**, **casas decimais**,
**símbolo da moeda** e **zoom**.

## Escrita assistida e histórico

A planilha é serializada em texto, então o **corretor/revisão** e o **histórico de versões**
usam o conteúdo dela como nos outros módulos (o texto da planilha alimenta a IA e o corretor).
As abas de documento do app valem igual aos demais módulos.
