# Excel — planilhas `.xlsx`

Planilha com grade que cresce sob demanda, fórmulas em português e abertura de arquivos
`.xlsx`/`.xlsm` do Excel.

## A planilha

- **Planilha nova em branco**: `+ → Planilha Excel` cria uma planilha **vazia** — sem o orçamento
  de exemplo que abria antes — e guarda o rascunho na pasta escolhida (sem perguntar pasta;
  "Salvar como…" escolhe outro lugar).
- **Cálculo sempre em dia**: editar uma célula recalcula as fórmulas que dependem dela (o Total
  de `=C2*D2` e o `=SOMA(...)` acompanham a quantidade na hora), inclusive ao desfazer, colar e
  preencher pela alça. Referências circulares mostram `#CIRC!` em vez de estourar a pilha.
- **Valores como no Excel**: `01/01/2026` é data (não vira 1012026), `1.234,56` é mil duzentos e
  trinta e quatro com cinquenta e seis, `0.125` é cento e vinte e cinco milésimos e **“Item 1”
  continua texto** (antes qualquer texto com dígito virava número). Números do `.xlsx` são
  convertidos do ponto decimal do XML para a escrita brasileira sem perder casas.
- **Seleção**: clique simples começa uma seleção nova; **Shift+clique** estende do âncora até a
  célula clicada; **Shift+setas** move a ponta e **encolhe** o bloco; **Ctrl+seta** pula para a
  borda do conteúdo; **Ctrl+A** pega a área usada (de novo, a grade inteira). **Ctrl+clique**
  também começa uma seleção nova (o app trabalha com uma faixa só).
- **Edição**: **duplo clique**, **F2** ou digitar abrem a célula; **Enter** desce uma linha e
  **Tab** anda para o lado. A alça de preenchimento fica no canto **do bloco selecionado** (não da
  célula ativa), copia fórmulas deslocando as referências e continua séries numéricas (1, 2 → 3, 4).
- **Copiar e colar**: uma célula copia **1×1**; a colagem começa na **célula ativa** e, numa
  mescla, só a âncora recebe o valor (nada fica escondido embaixo da mescla). Copiar uma fórmula
  e colar ao lado/abaixo desloca as referências relativas e leva o estilo junto.
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
- **Fonte**: negrito e itálico com **ícones SVG de verdade** (não mais “N”/“I” em texto),
  **cor da fonte** e **cor de preenchimento** em botões divididos: a parte da esquerda aplica a
  última cor usada e a seta abre a **paleta ancorada no botão** (com “Automática”, “Sem
  preenchimento” e uma cor personalizada), sem escurecer a planilha.
- **Alinhamento**: esquerda, centro, direita e **justificado**; **mesclar** e **desfazer
  mesclagem**. O alinhamento vale na tela e é preservado no `.xlsx` (`horizontal` do estilo).
- **Número**: formatos (geral, número, moeda, porcentagem, data…), **R$**, **%**, duas casas e
  aumentar/diminuir **casas decimais**. Os botões de casas usam ícones próprios, não texto solto.
- **Células**: inserir/excluir **linha** e **coluna** (com as fórmulas, mesclas e medidas
  ajustadas), ajustar **altura** e **largura** ao conteúdo.
- **Edição**: **AutoSoma** (escreve `=SOMA(...)`), limpar conteúdo e formato, limpar só o formato.
- **Fórmulas**: biblioteca (AutoSoma, Média, Contar números, Mínimo, Máximo), barra de
  fórmulas e **auditoria** (mostrar o texto das fórmulas em vez dos valores).
- **Exibir**: zoom e mostrar fórmulas.
- **A fita cabe na largura (sem rolagem)**: os mesmos quatro degraus das outras fitas — **cheia**,
  **compacta** (as métricas da fita do Excel passaram a acompanhar a escala e o aperto, com piso de
  fonte, em vez do `zoom` que encolhia o texto junto), **grupos em botão com menu** (o último
  colapsa primeiro) e a **faixa única** no modo recolhido — que **não acontece sozinho**: recolher é
  o **Ctrl+F1**, e clicar numa aba mostra a faixa completa (a escolha fica). A alça da borda de baixo
  ajusta a altura **com teto** (o menor entre 1,5× e um terço da janela). A primeira abertura de
  uma planilha já mede a fita e encaixa os grupos (antes era preciso redimensionar a janela).

## Fórmulas

- Fórmulas em **português** com referências (`A1`, `$A$1`), operadores e erros tratados.
- **Nomes do Excel**: um arquivo com `=SUM(A1:A2)`, `=IF(...)`, `=AVERAGE(...)` é traduzido na
  abertura; ao salvar, `=SOMA(...)` vira `=SUM(...)` no XML (e a vírgula decimal vira ponto, com
  vírgula entre argumentos), então o `.xlsx` abre no Excel de verdade.
- **Agregações ignoram texto de faixa** (`=SOMA(A1:A3)` com “Qtd” no meio soma só os números) e
  `CONT.VALORES` conta texto. `SE`, `E` e `OU` são preguiçosos (o ramo que não vale não é
  calculado, então `=SE(A1=0;0;1/A1)` devolve 0).
- **Fórmulas compartilhadas** do Excel (`<f t="shared">`) são lidas e deslocadas para cada
  célula dependente; `numFmt` personalizado ganha um id próprio (moeda, data e decimal não se
  misturam mais ao reabrir).
- **Documentação completa**: cada função por categoria (matemática, estatística, financeiras,
  data/hora, texto, pesquisa/referência, lógica, informação, engenharia, banco de dados e
  matrizes dinâmicas) em [docs/excel/formulas](excel/formulas/README.md), com sintaxe, regras,
  exemplos e o status no mdOffice.

## Configuração

O livro nasce com os padrões: **linhas de grade visíveis**, **2 casas decimais**, **R$** e
**zoom 100%**. Esses valores acompanham o documento; a antiga janela **Configurar planilha**
saiu da fita (o botão não tinha função prática).

## Escrita assistida e histórico

A planilha é serializada em texto, então o **corretor/revisão** e o **histórico de versões**
usam o conteúdo dela como nos outros módulos (o texto da planilha alimenta a IA e o corretor).
As abas de documento do app valem igual aos demais módulos.
