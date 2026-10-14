# PowerPoint — apresentações `.pptx`

Apresentações com **abertura e gravação fiéis** de `.pptx`: o que o app ainda não reproduz é
avisado ao abrir (nunca some em silêncio).

## Abrir e salvar `.pptx`

- **Apresentação nova já salva na pasta padrão**: `+ → Apresentação PowerPoint` cria e guarda de
  uma vez em `Documentos\mdOffice\PowerPoint\Documento.pptx`, sem perguntar pasta ("Salvar
  como…" escolhe outro lugar). A raiz entra sozinha nos **Projetos**, com uma subpasta por tipo.
- Lê cada lâmina como o PowerPoint a monta: formas posicionadas com precisão (grupos, rotação
  e espelhamento), retângulos arredondados, elipses, setas e formas livres; preenchimento
  sólido, em gradiente e com imagem; contornos; sombras; imagens com recorte; fundos da lâmina;
  decorações do **layout e do mestre**; cores do tema (com `lumMod`, `tint`, `alpha`…); texto
  formatado **por trecho**; notas do apresentador e a ordem real das lâminas.
- **Fontes**: os pesos (“Montserrat Black”, “Open Sans Bold”) viram a mesma família no peso
  certo; Montserrat, Roboto e Open Sans já vêm no app (OFL), então o texto quebra nas mesmas
  linhas. A exportação devolve ao arquivo as **fontes embutidas** originais.
- **Gravação** em XML do PowerPoint escrito pelo próprio app. Medido em 5 apresentações reais
  (64 lâminas): diferença média ≈2% para a renderização de referência, e o arquivo exportado,
  reaberto por um leitor independente, é idêntico em quase todas as lâminas.
- **Salvamento automático**: rascunhos do app são regravados sozinhos; uma apresentação **sua** só
  é gravada no `Ctrl+S` — o motor pode simplificar animações e recursos que ainda não entende e
  nada é reescrito por baixo dos panos. Enquanto houver alterações pendentes o selo da barra mostra
  **Não salvo** (com o caminho à vista) e o aviso explica na primeira alteração; o histórico do app
  guarda cópias de qualquer jeito.
- Ainda **não** reproduz (e avisa): tabelas de layout complexo, gráficos importados, SmartArt,
  imagens EMF/WMF, animações e transições antigas, e fontes embutidas **comprimidas**
  (MicroType Express) — aparecem com a família equivalente, mas voltam intactas ao salvar.

## Editar as lâminas

- **Formas**: galeria, desenhar arrastando, 8 alças de redimensionar, girar, **guias de
  encaixe**, seleção múltipla, **agrupar/desagrupar**, ordem (frente/trás), alinhar,
  distribuir, copiar/colar, duplicar e desfazer/refazer.
- **Cantos assistidos**: **clique numa alça de canto** para editar só aquele canto (`Shift+clique`
  soma/remove sem arrastar; clique parado num canto já escolhido deixa só ele) e arraste para
  arredondar **apenas os escolhidos** — cada canto guarda o próprio valor (dá para ter o sup. esq.
  em 50% e o inf. dir. em 30%, por exemplo), com precisão (passo de 0,5%; `Alt` = 0,1%) e o valor na
  tela; duplo clique na alça deixa o canto quadrado e, ao passar o mouse, uma **dica do app** mostra
  o nome do canto, o valor e o que o arrasto faz (o balão do sistema não aparece). O mini-diagrama
  do painel mostra e escolhe os quatro, com presets **Quadrado · Padrão · Suave · Pílula** e **Todos/Opostos**. Com **várias
  formas selecionadas**, as alças do quadro do grupo (e o painel) aplicam o mesmo raio a **todas** —
  é assim que caixas com cantos diferentes ficam iguais. Vale para formas, caixas de texto, imagens
  (máscara) e tabelas. No `.pptx` o app grava a forma **nativa** mais fiel (Retângulo arredondado,
  um canto, par de cima/baixo ou diagonais) e avisa quando o arranjo só existe como **forma livre**
  — que desenha igual, como o “Combinar formas” do PowerPoint.
- **Texto formatado por trecho**: negrito/itálico/sublinhado/riscado, marca-texto,
  sobrescrito, versalete, espaçamento, caixa alta/baixa, cor e limpar formatação.
- **Fonte e tamanho como no PowerPoint**: o campo da fita mostra o que o texto **tem** — mesmo
  que o `.pptx` use um tamanho fora da lista (41, 27, 17 pt…) ou uma fonte que o app não conhece —
  e aceita **digitação**: dá para escrever qualquer tamanho (com vírgula) ou qualquer nome de fonte,
  com a lista do app (e as fontes do próprio deck) no botão ao lado; tamanho misto fica em branco,
  como no Office, e digitar aplica a todos os trechos escolhidos.
- **Tabelas**: inserir, editar células (Tab anda entre elas), mesclar/dividir, linhas e
  colunas, estilos, bordas e sombreamento — com ida e volta fiel no `.pptx` (`a:tbl`).
- **Gráficos**: inserir, editar os dados no painel, desenho em SVG e exportação como imagem.
- **Fluxo do Mermaid**: colar um `flowchart` em **Inserir ▸ Fluxo do Mermaid** monta os
  **cartões** (formas nativas, com texto editável) ligados por **conectores de cantos suaves** —
  cada linha é uma forma livre com curvas de 90° no lugar do canto reto, com seta no fim (o `---`
  sai sem seta) e tracejado no `-.->`. O código dá a direção (TD/TB/BT/LR/RL), as formas
  (`[..]`, `(..)`, `((..))`, `{..}`) e os rótulos (`-->|texto|` ou `-- texto -->`); o nível de
  cada nó sai do encadeamento das setas e o conjunto sai centrado. Numa lâmina recém-criada o
  fluxo usa ela (que vira "Em branco"); se a atual já tem conteúdo, o fluxo ganha uma **lâmina
  nova em branco** logo depois. Depois de criado, é tudo forma comum: mover, colorir, agrupar e
  editar o texto.
- **Mídia**: inserir áudio/vídeo, tocar no F5 com corte, volume e repetição, e ida e volta no `.pptx`.
- **Transições de lâmina**: galeria, direção, duração, no F5 e no arquivo.
- **Animações de forma**: aba própria com **Aparecer**, **Surgir**, **Voar**, **Zoom**, **Limpar**,
  **Caixa**, **Círculo**, **Losango**, **Dividir**, **Persianas**, **Dissolver**, **Roda**,
  **Pulsar**, **Ampliar/Reduzir**, **Girar**, **Transparência**, **Desaparecer**, **Sumir**,
  **Voar fora**, **Encolher**, **Limpar fora**, **Caixa fora**, **Círculo fora**, **Losango fora**,
  **Dividir fora**, **Persianas fora**, **Dissolver fora**, **Roda fora** e **Trajetória** (em
  linha, quatro direções) por forma — as mais usadas na fita, o resto em **Mais animações** —,
  início (**Ao clicar**, **Com anterior**, **Depois do anterior**), duração, **atraso**, **direção**
  (trajetória, voar e limpar), **por parágrafo** (cada parágrafo num passo), ordem (↑↓), remover e
  prévia; as formas animadas ganham **selos numerados** no palco, o **painel de animação** (aba
  lateral) lista a ordem e o `.pptx` faz round-trip do `p:timing`/`p:animMotion` (o que não é
  modelado volta cru, com aviso). **Aplicar já mostra o efeito tocando** e a **prévia devolve a
  lâmina ao estado de projeto** ao terminar (o **Esc** interrompe na hora) — nada fica aplicado
  no palco fora da apresentação.
- **Lâminas**: arrastar as miniaturas para reordenar (na faixa do topo ou na vertical),
  ocultar, renomear e resetar (com ida e volta no `.pptx`), duplicar e excluir. **Nova lâmina** e
  **Layout** abrem uma **galeria em grade** com a **miniatura de cada layout** (os espaços como
  silhuetas cinzas, na proporção do deck) — no "Layout" o atual vem destacado; clicar cria a
  lâmina com aquele layout (ou aplica na atual). A **lâmina nova entra no fim** da apresentação
  (o "+" da faixa fica no fim) e já fica selecionada.
- **Navegar com a roda do mouse**: com o ponteiro sobre a lâmina, girar a roda **sobe/desce uma
  lâmina por gesto** (como no PowerPoint; um "tapa" não passa várias). Com a lâmina **ampliada**,
  a roda rola o quadro primeiro e só troca ao chegar ao fim; `Ctrl` + roda é o **zoom** (mirando o
  ponteiro).
- **Modelos**: o botão **Template** aplica modelos de estilo (tema, cores e fonte) ao deck;
  dá para salvar o visual atual como cartão e aplicar/remover depois.
- **Configurar apresentação**: proporção (16:9 / 4:3), tema (claro/escuro/contraste), fonte
  padrão, tamanho, rodapé e número da lâmina.

## Desenho à mão (Draw)

- Na aba **Inserir**, o botão **Draw** (grupo **Desenho**) liga o lápis: **rabisque na lâmina** e,
  ao soltar, o assistente **refaz o traço por cima** com a forma exata — **retângulo, retângulo
  arredondado, elipse, triângulo, linha, seta e arco** — no mesmo lugar e tamanho, já como forma
  normal (editável, com medidas em cm e ida e volta no `.pptx`). O traço torto é **endireitado
  antes de medir** (a mão nunca acerta o ângulo), então a forma acompanha o que foi desenhado.
- O **arco** segue curvas largas (ajuste **elíptico**), não só círculos: traçar o topo de uma
  caixa sai com o raio e a proporção do traço, em vez de virar "meio círculo".
- **Desenhar por cima de uma forma existente** (mesmo apagada — a cor não importa) sai **alinhado
  a ela**: o resultado encaixa nas bordas e nos centros das formas de baixo quando está perto.
- O que o assistente **não** reconhece fica como **desenho livre** — um caminho de verdade,
  **suavizado** (média móvel + curvas), que também vai para o arquivo; com o **assistente
  desligado**, todo traço fica livre.
- Enquanto o lápis está ligado, a **barrinha do pincel** define **cor**, **espessura** (1, 2, 4
  ou 8 pt) e o assistente, e mostra o que está sendo entendido ("entendi: Círculo"); **Esc** sai.

## Apresentar (F5)

- **A lâmina cobre a tela do app** (full-bleed: só as barras laterais do formato) e a barra virou um
  **HUD que se esconde sozinho** — barra e cursor somem depois de um tempo sem mexer e voltam com
  qualquer movimento.
- **Ferramentas no HUD**: progresso e contador clicável, navegação `‹ ›`, **grade de lâminas** (`G`,
  com a miniatura real de cada uma), **tempo decorrido** (`T`), **notas do apresentador** (`N`),
  **tela preta/branca** (`B`/`W`), **laser** (segure `L` ou `Ctrl`), **caneta** (`P`), **marca-texto**
  (`H`), **borracha** (`E`; `Shift+E` limpa a lâmina), **zoom** (`+`/`−`, `Z` volta a 100% e o chip no
  HUD mostra a %), **ajuda** (`?`) e **Encerrar** (`Esc`).
- **Zoom e marcação ao vivo**: `Ctrl` + roda dá zoom **no ponto do mouse**, `+`/`−` aproximam e
  afastam, e **arrastar com zoom move a tela** (o clique parado continua avançando). A **caneta** e o
  **marca-texto** desenham por cima da lâmina (o traço acompanha o zoom, porque fica na lâmina) e a
  marcação é **por lâmina**; `Esc` sai da ferramenta e do zoom antes de encerrar.
- **Navegação**: setas / `PgUp` / `PgDn` / `Espaço` / clique / **roda do mouse** avançam e voltam; o
  **botão direito volta** uma lâmina; `nº` + `Enter` pula direto para a lâmina; `Esc` fecha primeiro
  a grade/ajuda e só depois a apresentação.
- A lâmina vai **limpa**: os contornos de edição (hover/seleção das formas) não aparecem.
- Na **barra superior**, o botão **Apresentar** aparece enquanto a apresentação está aberta (entre
  o menu **⋯** e os controles da janela) e começa na hora — o mesmo caminho de Exibir ▸ Apresentar.
- **Animações de forma** tocam na ordem: o clique primeiro toca o efeito pendente ("ao clicar")
  e só depois troca de lâmina; "com o anterior"/"depois do anterior" encadeiam sozinhos.
- **Transições** entre lâminas, **mídia** tocando (o player continua entre as lâminas) e
  **`Ctrl+P`** imprime uma lâmina por página (PDF).

## Interface do módulo

- **Fita** com abas (Página Inicial, Inserir, **Transições**, **Animações**, Design e Exibir;
  **Formato da Forma** e **Layout da Tabela** aparecem quando a seleção pede), recolhível e
  ajustável, com rolagem horizontal quando não cabe.
- **Painel Formatar/Animação/Notas** à direita: pode ser escondido, redimensionado e reaberto pela
  aba “« Formatar”; o painel de animação lista os efeitos da lâmina na ordem (selecionar, mover e
  remover) e as notas ficam na aba **Notas**.
- **Zoom até 800%** ancorado no ponteiro (Ctrl + roda do mouse), com rolagem de verdade; o
  passo do clique/roda cresce no zoom alto (do 100% ao 800% em ~17 passos) e o slider
  continua fino.
- **Botão direito + arrastar move a tela** (panorama) — o jeito de navegar no zoom alto, em
  qualquer direção; o cursor vira "agarrando" durante o arrasto e o menu de contexto só abre
  no clique direito parado.
- **Faixa de lâminas** no topo ou na vertical (Exibir → Faixa vertical).

## Testes

- `npm run test:pptx -- <pasta com .pptx>` — importa e exporta apresentações reais e compara.
- `npm run test:pptx-edicao` — testes do motor de edição (geometria, operações, texto, tabelas)
  e dos **cantos por canto** (seleção, raio individual e a geometria que vai para o arquivo).
- `npm run test:desenho` — traços à mão sintéticos ("tremidos") viram a forma certa; o que não é
  reconhecido fica como desenho livre, e a forma montada sai com o pincel certo.
