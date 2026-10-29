# Excel — planilhas `.xlsx`

Planilha com grade que cresce sob demanda, fórmulas em português e abertura de arquivos
`.xlsx`/`.xlsm` do Excel.

## A planilha

- **Planilha nova em branco**: `+ → Planilha Excel` cria uma planilha **vazia** — sem o orçamento
  de exemplo que abria antes — e guarda o rascunho na pasta escolhida (sem perguntar pasta;
  "Salvar como…" escolhe outro lugar).
- **Cálculo sempre em dia**: editar uma célula recalcula as fórmulas que dependem dela (o Total
  de `=C2*D2` e o `=SOMA(...)` acompanham a quantidade na hora), inclusive ao desfazer, colar e
  preencher pela alça.
- **Seleção**: clique simples começa uma seleção nova; **Shift+clique** estende do parágrafo
  ativo até a célula clicada; **Ctrl+clique** também começa uma seleção nova (o app trabalha com
  uma faixa só — antes o Ctrl estendia desde o âncora antigo e parecia selecionar tudo).
- **Grade que cresce sozinha**: role ou escreva além do fim e novas linhas/colunas aparecem
  (rolagem infinita), sem tamanho fixo.
- **Cabeçalhos alinhados**: os números das linhas e as letras das colunas ficam centralizados
  e acompanham exatamente a altura/largura das células (a borda do cabeçalho não soma 1px por
  linha, então os números não vão “descendo” em relação à grade).
- **Desfazer/refazer** funcionam de qualquer ponto da planilha (`Ctrl+Z` / `Ctrl+Y`).
- **Abas de planilha**: nova, duplicar, excluir e mover para a esquerda/direita.
- **Zoom** (aba Exibir e barra inferior) e **linhas de grade** ligáveis nas configurações.
- **Abrir `.xlsx`/`.xlsm`** e **salvar `.xlsx`**; macros não são preservadas (o app sugere
  salvar como `.xlsx` para não sobrescrever o original).
- **Salvamento automático**: rascunhos do app são regravados sozinhos; uma planilha **sua** só é
  gravada no `Ctrl+S` — o selo da barra mostra **Não salvo** enquanto houver alterações pendentes
  (o histórico guarda cópias de qualquer jeito).
- **Aviso “Salvar alterações?” arrastável**: ao fechar uma aba com alterações, o pop-up pode
  ser **arrastado pela barra de título** para sair da frente da planilha (duplo clique na barra
  volta ao centro; os **9 pontos** mostram a alça). O **X** circular cancela e o fundo **não
  escurece** a planilha.

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
- **A fita cabe na largura (sem rolagem)**: os mesmos quatro degraus das outras fitas — **cheia**,
  **compacta** (as métricas da fita do Excel passaram a acompanhar a escala e o aperto, com piso de
  fonte, em vez do `zoom` que encolhia o texto junto), **grupos em botão com menu** (o último
  colapsa primeiro) e a **faixa única** no modo recolhido — que **não acontece sozinho**: recolher é
  o **Ctrl+F1**, e clicar numa aba mostra a faixa completa (a escolha fica). A alça da borda de baixo
  ajusta a altura **com teto** (o menor entre 1,5× e um terço da janela).

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
