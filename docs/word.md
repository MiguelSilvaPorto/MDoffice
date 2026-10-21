# Word — documentos `.docx`

O motor do Word edita o documento **direto na folha** (sem Markdown no meio) e abre/salva
arquivos `.docx` de verdade.

## Documento e páginas

- **Novo documento Word**: **+ → Documento Word** cria o documento já editável na folha **e já
  salvo** em `Documentos\mdOffice\Word\Documento.docx` (a pasta padrão do app — "Salvar como…"
  escolhe outro lugar); **Abrir** aceita `.docx` do Word.
- Folha **A5, A4, A3, A2 ou Carta** com margens configuráveis (tamanho, orientação, margens,
  cabeçalho, rodapé e “Página X de Y”) em **Layout → Configurar Página** — e o **Tamanho** (aba
  Layout) troca só o papel de uma vez, com as medidas de cada um no menu.
- **Páginas de verdade**: o texto flui de uma página para a outra e parágrafos longos se
  dividem entre elas (paginação calculada, não é só uma folha rolando).
- **Imagens com alças**: clique na imagem para selecioná-la; as **8 alças** nos cantos e lados
  redimensionam mantendo a proporção (o tamanho fica no documento e vai para o `.docx`) e a
  **alça pontilhada** à esquerda arrasta a imagem para outro ponto do texto (arrastar o próprio corpo da imagem também move, e Ctrl+Z desfaz). `Ctrl+Z` volta ao
  tamanho anterior. A imagem entra pelo botão *Imagem*, por `Ctrl+V` ou arrastada do Explorer. Em parágrafo com **entrelinha fixa**, a imagem desliga a entrelinha daquele parágrafo para a linha crescer e a imagem não vazar sobre o texto vizinho.
- **A imagem flutua e o texto se acomoda em volta** (como no Word): com a imagem **selecionada**
  aparece a aba **Imagem** da fita, e o **clique direito** traz **Quebra de Texto**. São **7 modos**:
  **Alinhado com o texto** (o de sempre, a imagem na linha do texto), **Quadrado** (o texto passa
  dos dois lados), **Contorno** (o texto segue o **desenho** da imagem: num PNG em círculo o texto
  entra no vão e sai por fora), **Topo e base** (o texto só passa por cima e por baixo),
  **Através**, **Atrás do texto** e **À frente do texto**. A mesma aba traz a **posição**
  (esquerda, centro, direita), o **ajustar à largura do texto**, a **proporção original** e o
  **texto alternativo**.
  - **Arrastar a imagem flutuante reorganiza o texto enquanto se arrasta**: o deslocamento vai
    direto para a folha (o texto se acomoda a cada movimento) e, no fim do gesto, a posição vira
    uma transação — `Ctrl+Z` desfaz.
  - **Arrastar a imagem flutuante pelo TEXTO muda a âncora dela** (como no Word): o parágrafo que
    ficaria com a imagem é marcado com uma **barrinha de acento** e, ao soltar, a imagem **vai
    para esse parágrafo** — o texto passa a se acomodar em volta **no ponto novo** e o
    deslocamento é recalculado para a imagem ficar onde foi solta. A âncora é o parágrafo que
    fica sob a **borda superior** da imagem (a mesma regra do WordCraft, do ArtCraft).
  - A imagem flutuante ganha **parágrafo próprio** (é o parágrafo que vira o flutuante): por isso
    o texto dos parágrafos **vizinhos** se reorganiza em volta dela, e não só o do parágrafo onde
    ela está.
  - Na **paginação**, a imagem flutuante **nunca é cortada** pela quebra de página: ela desce
    inteira para a página seguinte, com o texto (é a âncora que manda na página do objeto).
  - O `.docx` guardado sai com a imagem **ancorada** (com a quebra e a posição) e volta igual ao
    ser aberto.
- **Zoom** (barra inferior) e régua de trabalho na coluna de escrita. A folha é **sempre do
  tamanho do papel** escolhido (A4, 21 × 29,7 cm, por padrão): o **zoom é só a vista** e o tamanho
  do papel aparece ao lado da página (com a orientação), para uma folha vista pequena não ser
  confundida com "o papel mudou" — e a barra traz **Ajustar** (a folha cabe na largura da janela;
  nunca amplia além de 100%) e o número do zoom, que **volta a 100%** no clique. A **aba Exibir**
  traz o **menu de zoom** (50/75/100/150/200%, *Ajustar* e *Página inteira*) e a **régua**
  (horizontal e vertical, com as margens sombreadas e as medidas em centímetros).
- **Tema escuro**: a folha **escurece junto** — papel e tinta acompanham o tema (é o mesmo
  desenho da prévia do Markdown), então escrever à noite não leva clarão; “Preto” do documento
  entra como **tinta automática** (é o que o Word grava em “Automático”) e o **marca-texto**
  mantém o texto escuro por cima. **Imprimir e Exportar PDF saem sempre em papel branco**, com o
  tema que estiver na tela.

## Fita (no desenho do Word Online)

- Abas **Início**, **Inserir**, **Layout**, **Revisão** e **Exibir** (e a aba contextual **Tabela**
  quando o cursor está numa tabela).
- **Exibir**: os **modos de exibição** — **Impressão** (a folha com as páginas de verdade),
  **Rascunho** (o texto contínuo, sem a folha nem as quebras de página), **Leitura** (uma coluna
  confortável, com a letra e o entrelinha maiores, sem as bordas do papel) e **Livro** (a folha
  **aberta**: a página 1 à esquerda, a 2 à direita, a 3 e a 4 na faixa de baixo, com a **lombada
  no meio**); a **régua** (horizontal e vertical, com as margens sombreadas e as medidas em
  centímetros, que acompanha o papel, as margens e o zoom); e o **zoom** (50/75/100/150/200%,
  *Ajustar* e *Página inteira*). O modo **Livro** é da tela: no impresso e no PDF a folha volta
  a ter uma página de largura e o texto sai na sequência.
- **Fonte**: família e tamanho, negrito/itálico/sublinhado/riscado, sub/sobrescrito,
  **cor da letra** e **destaque** (marca-texto), limpar formatação. Os dois campos **mostram o
  que o documento tem** (fonte ou tamanho vindo de um `.docx` fora da lista não some) e aceitam
  **digitação** — dá para escrever qualquer tamanho (com vírgula) ou qualquer nome de fonte, com
  a lista do app no botão ao lado. **Digitar sugere** (a lista abre filtrada, sem ligar para
  maiúsculas nem acentos; setas andam, **Enter** escolhe o destacado, **Esc** devolve o texto).
- **Parágrafo**: marcadores e numeração com níveis, recuo, entrelinha, alinhamento
  (esquerda, centro, direita e **justificado**).
- **Popups da fita (cor da letra, destaque, grade da tabela)**: abrir e **fechar pelo mesmo
  botão** — clicar de novo nele **recolhe** o que estava aberto (clicar fora ou `Esc` também
  fecha, e outro botão troca o popup de lugar).
- **Estilos**: Texto normal, Título 1–4, Citação e Código (caixas de estilo com prévia).
- **Área de transferência**: colar, recortar, copiar e **pincel de formatação**
  (uma vez ou fixo), desfazer/refazer.
- **Páginas**: quebra de página, cabeçalho e rodapé, números de página.
- **Layout**: **Tamanho** troca o papel de uma vez (**A5, A4, A3, A2 ou Carta**, com as medidas de
  cada um no menu) e **Página** abre o **Configurar Página** completo (papel, orientação, margens,
  cabeçalho/rodapé e “Página X de Y”). O papel escolhido vale na folha, na impressão/PDF e no `.docx`.
- **Ilustrações**: imagens (inserir, colar ou arrastar — arrastar uma imagem **dentro** da página
  **move**; arquivo de fora continua entrando), links, **tabelas** (inserir,
  linhas/colunas, mesclar, dividir, sombrear, bordas) e marcas de parágrafo.
- **Clique direito**: abre o menu **do app** — o do WebView2 (Emoji, Inspecionar, Direção da
  escrita) não abre no documento. Com o cursor numa **tabela**, a lista é a da tabela e **"Excluir
  tabela" vem em primeiro** — junto de inserir/excluir **linha** e **coluna** e mesclar/dividir —,
  seguida de recortar/copiar/colar e selecionar tudo; fora dela, é o menu de texto (desfazer,
  recortar, copiar, colar, selecionar tudo). **Em cima de uma imagem**, o menu abre com **"Excluir
  imagem"** em primeiro (e os itens de texto continuam abaixo). Fecha ao clicar fora ou com `Esc`.
- **Revisão de texto**: corretor de português (sublinhados e sugestões) e voz/suplementos — em
  **título** ele não pede ponto final (o corpo do texto continua pedindo normalmente).
- **A fita cabe na largura (sem rolagem)**: as mesmas quatro etapas do PowerPoint — **cheia**,
  **compacta** (espaços e ícones menores, com piso de fonte), **grupos em botão com menu** (o último
  colapsa primeiro) e a **faixa única** quando a faixa está recolhida — que **não acontece sozinha**:
  recolher é o **Ctrl+F1**, e clicar numa aba mostra a faixa completa (a escolha fica). As
  **setinhas de rolar** que ficavam por cima do conteúdo saíram: o que não couber vira um botão com o
  nome do grupo. A alça da borda de baixo ajusta a altura **com teto** (o menor entre 1,5× e um
  terço da janela).

## Escrita assistida (também no Word)

- O **corretor de português** sublinha erros e abre sugestões ao clicar **no texto sublinhado** —
  clicar numa imagem, no espaço da linha ou na margem não abre o popup (a imagem é inline e ficava na
  borda da faixa da palavra); um aviso que atravessa uma imagem não oferece sugestão (aplicar
  apagaria a imagem). O **texto fantasma** (sugestões enquanto digita) funciona aqui também, com
  **Tab/Alt+→/Alt+↓**.
- **Revisar texto** (`F7`) e a **revisão inteligente** analisam o documento Word como o
  Markdown (regras e sinônimos).
- **Formalizar** (`Ctrl+Alt+F` ou **Revisão → Revisão de Texto → Formalizar**): a mesma janela
  do Markdown, com **antes × depois** e o MIP caindo ao vivo. Pega a seleção (sem seleção, o
  documento inteiro) e aplica cada troca **no lugar dela** — o texto em volta e o formato ficam
  como estavam, e negrito/cor do próprio trecho trocado são mantidos. `Ctrl+Z` desfaz tudo.
- O **histórico de versões**, as **abas**, a **Estrutura** e a busca valem igual ao Markdown.

## Salvar e exportar

- **Salvar .docx de verdade** (`Ctrl+S`) — o arquivo abre no Word.
- **Salvamento automático**: rascunhos do app são regravados sozinhos; um `.docx` **seu** só é
  gravado no `Ctrl+S` (o motor pode simplificar comentários, revisões, campos). O selo da barra
  mostra **Não salvo** enquanto houver alterações pendentes e o aviso explica na primeira vez —
  o histórico guarda cópias de qualquer jeito.
- **Aviso “Salvar alterações?” arrastável**: ao fechar uma aba com alterações, o pop-up pode
  ser **arrastado pela barra de título** para sair da frente do documento (duplo clique na barra
  volta ao centro; os **9 pontos** mostram a alça). O **X** circular cancela e o fundo **não
  escurece** o documento.
- **Exportar PDF** imprime a própria folha (com páginas, cabeçalho e rodapé).
- **Importar do Office**: abre `.docx` direto das pastas do Office (e explica os formatos
  antigos `.doc`).

## Limitações conhecidas

O motor avisa (nunca some em silêncio) o que ainda **não** entende e pode simplificar ao
salvar: comentários, revisões, campos e caixas de texto; e ainda não há tradução ao vivo
(use **Exportar → Inglês**), desenho, notas de rodapé, colunas e tabelas dentro de tabelas
com mesclagem complexa. O histórico guarda cópias antes de qualquer alteração.

## Relevo da folha

A folha tem **ilusão de profundidade** nos dois temas: moldura de 1px, sombra em **duas camadas**
(uma rente e uma longa) e uma **dobra clara de 1px no topo** — a luz batendo na borda de cima do
papel. No tema escuro é o que separa a folha do palco (a sombra sozinha sumia).
