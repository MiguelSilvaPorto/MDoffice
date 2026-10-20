# Word — documentos `.docx`

O motor do Word edita o documento **direto na folha** (sem Markdown no meio) e abre/salva
arquivos `.docx` de verdade.

## Documento e páginas

- **Novo documento Word**: **+ → Documento Word** cria o documento já editável na folha **e já
  salvo** em `Documentos\mdOffice\Word\Documento.docx` (a pasta padrão do app — "Salvar como…"
  escolhe outro lugar); **Abrir** aceita `.docx` do Word.
- Folha **A4/Carta** com margens configuráveis (tamanho, orientação, margens, cabeçalho,
  rodapé e “Página X de Y”) em **Layout → Configurar Página**.
- **Páginas de verdade**: o texto flui de uma página para a outra e parágrafos longos se
  dividem entre elas (paginação calculada, não é só uma folha rolando).
- **Zoom** (barra inferior) e régua de trabalho na coluna de escrita. A folha é **sempre do
  tamanho do papel** (A4, 21 × 29,7 cm — ou Carta): o **zoom é só a vista** e o tamanho do papel
  aparece ao lado da página (com a orientação), para uma folha vista pequena não ser confundida com
  "o papel mudou" — e a barra traz **Ajustar** (a folha cabe na largura da janela; nunca amplia
  além de 100%) e o número do zoom, que **volta a 100%** no clique.
- **Tema escuro**: a folha **escurece junto** — papel e tinta acompanham o tema (é o mesmo
  desenho da prévia do Markdown), então escrever à noite não leva clarão; “Preto” do documento
  entra como **tinta automática** (é o que o Word grava em “Automático”) e o **marca-texto**
  mantém o texto escuro por cima. **Imprimir e Exportar PDF saem sempre em papel branco**, com o
  tema que estiver na tela.

## Fita (no desenho do Word Online)

- Abas **Início**, **Inserir**, **Layout** e **Revisão** (e a aba contextual **Tabela**
  quando o cursor está numa tabela).
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
- **Ilustrações**: imagens (inserir, colar ou arrastar — arrastar uma imagem **dentro** da página
  **move**; arquivo de fora continua entrando), links, **tabelas** (inserir,
  linhas/colunas, mesclar, dividir, sombrear, bordas) e marcas de parágrafo.
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

- O **corretor de português** sublinha erros e abre sugestões ao clicar; o **texto fantasma**
  (sugestões enquanto digita) funciona aqui também, com **Tab/Alt+→/Alt+↓**.
- **Revisar texto** (`F7`) e a **revisão inteligente** analisam o documento Word como o
  Markdown (regras, sinônimos e a IA local).
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
