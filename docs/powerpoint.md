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
  encaixe**, seleção múltipla (**cada forma escolhida mostra as próprias 4 alças de canto** —
  arrastar uma delas redimensiona **só aquela forma**, sem desfazer a seleção; o quadro do grupo
  segue com as 8 para redimensionar todas de uma vez, e no canto em que as duas caem no mesmo
  ponto quem atende é a alça da forma), **agrupar/desagrupar**, ordem (frente/trás), alinhar,
  distribuir, copiar/colar, duplicar e desfazer/refazer. Com as formas **empilhadas** (um avatar em
  cima do cartão, os textos por cima do fundo…), o clique pega a de cima: o **clique direito na
  forma** traz **"Selecionar tudo neste ponto"** (com a contagem — "Selecionar tudo neste ponto
  (3)"), que pega a pilha inteira de uma vez, cada forma com o grupo dela; dali para trás é só
  tirar o que não serve com `Shift`+clique. Arrastar: a forma **escolhida** pega o
  ponteiro em **qualquer ponto do miolo** (cursor de mover) — inclusive as caixas de texto **sem
  preenchimento**, que fora da seleção continuam clique-através para não esconder o que está
  embaixo. E o **Copiar formatação** (o Pincel de
  Formatação): com uma forma escolhida, o clique no botão guarda a pintura e o formato do texto dela
  e o **ponteiro vira “copiar”** — cada clique numa forma veste o formato guardado, sem mexer na
  caixa, no giro nem no texto do alvo; **duplo clique** deixa o pincel **ligado** (pinta várias) e o
  `Esc` sai. A pintura viva (**Estilo de Cor**) vai junto: o alvo passa a usar a mesma receita.
- **Fita métrica do arrasto**: enquanto **arrasta**, a **medida mora nas linhas do gesto** — ao
  **mover**, a **linha em pé** marca o **x** e a **deitada** o **y** (o rótulo viaja colado nelas,
  junto do canto); ao **redimensionar** ou **desenhar** uma forma, a **linha de baixo** mostra a
  **largura** e a **da direita** a **altura**. A unidade é o **cm**, a mesma dos campos de
  **Tamanho** do painel; perto das bordas o rótulo **vira para o outro lado** e tudo **some ao
  soltar**.
- **Arrasto leve**: o quadro do arrasto mexe **só no que mudou** — mover ou girar vai direto no
  estilo da forma (e o painel só troca os números de tamanho/posição), em vez de refazer a lâmina
  inteira a cada movimento; o que **muda o desenho** (redimensionar) refaz **só aquela forma**, e
  o que é **derivado** (ligação, cópia do modelo, Estúdio) segue o desenho completo. No fim do
  gesto a lâmina é redesenhada uma vez, como sempre (desfazer, miniaturas e painel ficam em dia).
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
- **Texto dentro da forma**: com a forma **escolhida**, clicar no texto **entra na edição** e o
  arrasto **seleciona o texto** (o caret cai onde o ponteiro clicou; o duplo clique escolhe a
  palavra). Vale também para o **vazio ao lado/embaixo do texto** — inclusive quando o texto
  **passa do quadro** da forma: ali o clique **não larga a escolha**, vai para o texto. O **mover**
  fica na **beirada** da forma — a faixa de ~6 px por dentro do contorno — e, com **várias** formas
  escolhidas, o arrasto continua movendo o conjunto; sem a forma escolhida, o primeiro arrasto pega
  e move, como sempre. O **cursor** troca (`mover` ↔ `texto`) para dizer quem manda em cada estado.
- **Texto formatado por trecho**: negrito/itálico/sublinhado/riscado, marca-texto,
  sobrescrito, versalete, espaçamento, caixa alta/baixa, cor e limpar formatação.
- **Fonte e tamanho como no PowerPoint**: o campo da fita mostra o que o texto **tem** — mesmo
  que o `.pptx` use um tamanho fora da lista (41, 27, 17 pt…) ou uma fonte que o app não conhece —
  e aceita **digitação**: dá para escrever qualquer tamanho (com vírgula) ou qualquer nome de fonte,
  com a lista do app (e as fontes do próprio deck) no botão ao lado; tamanho misto fica em branco,
  como no Office, e digitar aplica a todos os trechos escolhidos. **Digitar sugere**: a lista abre
  filtrada pelo que se escreveu (sem ligar para maiúsculas nem acentos — "time" acha "Times New
  Roman"), as setas andam pelos itens, o **Enter** escolhe o destacado, o **Esc** devolve o texto
  que estava e a lista **não fecha** enquanto se digita.
- **Menus de forma (Preenchimento, Contorno e Efeitos) sem forma escolhida**: o botão continua
  **clicável** e o menu abre com a **dica** — "Selecione uma forma na lâmina para…" — e os itens
  **desabilitados**, em vez de engolir o clique (o relato: "clicado de novo, não abre"); e o menu
  **nunca cobre o próprio botão**: quando não cabe embaixo ele **encolhe** com rolagem por dentro,
  em vez de subir por cima da fita — o clique seguinte no botão continua sendo do botão.
- **Ordem dos grupos na Página Inicial**: **Área de Transferência → Fonte → Parágrafo → Lâminas →
  Desenho** — o texto vem **à frente das lâminas** (o que se usa o tempo todo fica sem rolar a
  fita; o grupo **Lâminas** continua inteiro, logo depois).
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
- **Mídia**: inserir áudio/vídeo, tocar no F5 com corte, volume e repetição (na apresentação, a
  **barra de controle do HUD** comanda o player — ver *Apresentar (F5)*), e ida e volta no `.pptx`.
- **Transições de lâmina**: galeria, direção, duração, no F5 e no arquivo. A aba lembra que a
  transição é da **lâmina** — para animar uma **forma** escolhida, a aba é a **Animações**, e a
  nota traz o **botão** que leva direto para lá.
- **Animações de forma**: aba própria com **Aparecer**, **Surgir**, **Voar**, **Zoom**, **Limpar**,
  **Caixa**, **Círculo**, **Losango**, **Dividir**, **Persianas**, **Dissolver**, **Roda**,
  **Pulsar**, **Ampliar/Reduzir**, **Girar**, **Transparência**, **Desaparecer**, **Sumir**,
  **Voar fora**, **Encolher**, **Limpar fora**, **Caixa fora**, **Círculo fora**, **Losango fora**,
  **Dividir fora**, **Persianas fora**, **Dissolver fora**, **Roda fora** e **Trajetória** (em
  linha, quatro direções) por forma — as mais usadas na fita, o resto no cartão **Mais**. A aba
  está arrumada na ordem em que se pensa a animação: **Animação** (a galeria, com o **selo de
  conferido** no efeito escolhido), **Início** (**Ao clicar**, **Com anterior**, **Depois do
  anterior**), **Direção** (trajetória, voar e limpar, setas ← → ↑ ↓), **Tempo** (**duração** e
  **atraso**, cada um na sua linha — o valor que não está na lista, vindo do arquivo, aparece
  escrito), **Texto** (**Por parágrafo**: cada parágrafo num passo), **Ordem** (a **posição na
  ordem**, "2/3", com as setas ↑↓ para mover) e **Animar** (**Prévia**, **Painel** e **Remover**).
  O botão **Painel** abre o **painel de animação** (aba lateral) — a lista das animações da lâmina
  na ordem em que tocam — e fica **aceso** enquanto é ela que está à mostra. As formas animadas
  ganham **selos numerados** no palco e o `.pptx` faz round-trip do `p:timing`/`p:animMotion` (o
  que não é modelado volta cru, com aviso) — o arquivo exportado toca as animações no PowerPoint.
  Os controles (**Início**, **Duração**, **Atraso**, **Direção**, **Texto** e **Remover**) valem
  para **toda a seleção**: com duas ou mais formas escolhidas, o ajuste e a remoção valem para
  todas, como no PowerPoint. **Aplicar já mostra o efeito tocando** e a **prévia
  devolve a lâmina ao estado de projeto** ao terminar (o **Esc** interrompe na hora) — nada fica
  aplicado no palco fora da apresentação.
- **Lâminas**: arrastar as miniaturas para reordenar (na faixa do topo ou na vertical) —
  o gesto é o do **mouse**: **segure a miniatura e leve** para a posição (uma **linha de acento**
  mostra onde ela entra, o **Esc** cancela e, perto da borda, a faixa **rola sozinha**). Depois,
  ocultar, renomear e resetar (com ida e volta no `.pptx`), duplicar e excluir (o botão
  **Duplicar** está na Página Inicial e na aba **Inserir**). O **clique direito na miniatura**
  abre um menu do app — **Duplicar lâmina**, **Nova lâmina no fim**, **Renomear…**, **Ocultar/
  Mostrar na apresentação** e **Excluir lâmina** — agindo na lâmina clicada (antes caía no menu do
  navegador: Voltar/Atualizar/Salvar como/Imprimir/Inspecionar). Quem **cria lâmina** é o **card
  "+ Nova lâmina" do fim da faixa** (o botão da fita saiu a pedido — ele fazia o mesmo duas vezes):
  a **prévia** cria a lâmina **na hora**, com o **último layout escolhido** — a primeira nasce
  **Capa**, e a preferência sobrevive ao recarregar — e o **rótulo "+ Nova lâmina"** abre a
  **galeria em grade** com a **miniatura de cada layout** (os espaços como silhuetas cinzas, na
  proporção do deck), onde o atual vem destacado; clicar lá cria a lâmina com aquele layout e passa
  a ser o "último". O **Layout** da fita abre a mesma galeria para trocar o layout da lâmina atual.
  O "+" redondo que pendia do canto da prévia saiu (o rótulo assumiu a função dele). A **lâmina nova
  entra no fim** da apresentação e já fica selecionada.
- **Histórico: a lâmina em foco nas duas versões**: no **Histórico** (rodapé do documento), as abas
  **Alterações** e **Versões** de uma apresentação mostram a **lâmina em foco no editor** como
  **duas mini lâminas lado a lado** — **esquerda: como estava; direita: como ficou** — em vez do
  texto serializado do deck inteiro, que não dizia nada sobre o que está na tela. Quando a versão é
  de antes de a lâmina existir, o lado avisa em vez de sair em branco. E a lista de **Alterações**
  tem **nome**: diz **qual lâmina** mudou ("Lâmina 3 alterada", "Nova lâmina", "Lâmina excluída")
  ou avisa quando a mudança foi **visual** (cores, formas e posição, sem mexer no texto).
- **A fita cabe na largura da janela, em quatro degraus (sem rolagem lateral)**: do mais folgado ao
  mais apertado — (1) **cheia**, com as métricas em 1; (2) **compacta**, com espaços e ícones
  menores (a **fonte não encolhe**: o piso está no CSS) e os botões grandes numa linha, **agrupados**
  (o ar entre um botão e outro fica ~a metade do vão de dentro dele — o grupo **Canetas** da aba
  Desenhar, com Draw/Curva/Marca-texto/Borracha, era o caso espalhado que pediu isso); (3) os
  **grupos que não couberem viram um botão** com o nome do grupo, e clicar nele abre um menu com os
  controles daquele grupo — o **último** grupo colapsa primeiro, então o que se usa o tempo todo fica
  à vista; (4) **faixa única** com a faixa **recolhida** (**Ctrl+F1**): os
  grupos da aba ativa ficam numa linha de botões — é o "mais" de cada grupo — e a faixa acompanha a
  aba ativa. Quem decide é o **encaixe** (`src/fitaEncaixe.ts`), medido em `npm run test:encaixe`:
  em 1338 px o Início abre inteiro (antes estourava 353 px) e a 700 px, com a escala em 1,5×, os
  grupos colapsam sem sobrar nada. O tamanho que você escolhe arrastando a borda de baixo continua
  valendo (o ajuste **soma-se** a ele) e agora tem **teto**: o menor entre **1,5×** e **um terço da
  janela** — numa janela baixa a faixa não come a tela.
  O plano é uma **estimativa** (supõe que todo grupo encolhe junto com as métricas), então depois
  de aplicado o encaixe **confere no navegador**: se ainda sobra rolagem, encolhe mais as métricas
  aos poucos e, só então, manda mais um grupo (o último) para o menu. A **galeria de animações**
  deixou de ter 72 px fixos por cartão e acompanha as métricas — era ela que fazia a aba
  **Animações** estourar a largura (medido num Chrome real, de 1500 a 900 px nenhuma aba rola mais;
  em 1338 px a aba inteira, com a Prévia, o Painel e o Remover, cabe sem menu). Os **quatro botões
  do grupo Desenho** (Preenchimento, Contorno, Efeitos e Organizar) ficam num **2×2** — antes eram
  três numa coluna e o Organizar solto ao lado, o que deixava o grupo mais alto que o resto da
  faixa (pedido do usuário, com print).
- **Popups da fita (Formas, Template, Layout, cores, bordas…)**: abrir e **fechar
  pelo mesmo botão** — clicar de novo nele **recolhe** o que estava aberto (antes o clique no
  próprio botão era ignorado pelo "fecha ao clicar fora" e o comando rodava outra vez, reabrindo).
  Clicar fora ou `Esc` continua fechando, e clicar em **outro** botão troca o popup de lugar.
- **Navegar com a roda do mouse**: com o ponteiro sobre a lâmina, girar a roda **sobe/desce uma
  lâmina por gesto** (como no PowerPoint; um "tapa" não passa várias). Com a lâmina **ampliada**,
  a roda rola o quadro primeiro e só troca ao chegar ao fim; `Ctrl` + roda é o **zoom** (mirando o
  ponteiro).
- **Modelos**: o botão **Template** aplica modelos de estilo (tema, cores, fonte **e desenho**) ao deck.
  O **desenho** é o que faz a lâmina parecer outra e não só ter outras cores: **barra lateral**,
  **faixas**, **cantos**, **círculos**, **moldura** ou **blocos**, cada um diferente na **capa/seção**
  e no **miolo** da apresentação. São formas fixas (atrás do texto, sem seleção) que ficam nas
  bordas e nos cantos e **nunca cobrem o texto**; trocar de modelo **troca** as decorações (não
  empilha), trocar o **layout** de uma lâmina refaz o desenho para ele e a lâmina nova herda o da
  anterior. O cartão do modelo mostra o desenho em miniatura, e **Salvar como modelo** guarda o
  desenho do deck. Os modelos de gradiente (Esmeralda, Oceano, Ameixa) saíram do catálogo —
  ficavam ilegíveis — e entraram **Corporativo**, **Executivo** e **Terracota**.
  A galeria tem duas seções: **seus modelos** — o cartão **Novo modelo**, que guarda o visual da
  apresentação atual (quantas vezes você quiser), e os modelos que você já criou, cada um com um
  **× no canto** para apagar; e os **modelos do app**, abaixo do título *Modelos do app*. O cartão
  recém-criado entra em destaque e à vista, e o × só existe nos modelos do usuário. O catálogo traz
  os presets do app **mais os 13 designs no formato do DeckCraft** (8 temas originais + 5 esquemas
  de cor, cada um com as próprias cores e fonte).- **Aba Design** (fita): quatro grupos, na ordem do Office — **Temas** (a galeria de modelos do
  Template), **Variantes**, **Personalizar** (**Formatar fundo**, **Layout** e **Tamanho** da
  lâmina: 16:9 ou 4:3) e **Composição** (a fusão das Ideias de design com os Arranjos, que abre o painel lateral na aba certa). A organização lembra a do Office; os cartões, os ícones e os textos são
  os do app (a paleta das Variantes é um ícone próprio com as seis cores das famílias).
- **Variantes** (aba Design): as **seis famílias de cor** do Estilo de cor — **Esmeralda**,
  **Oceano**, **Ameixa**, **Âmbar**, **Rubi** e a **Grafite** (a escura) — aplicadas à
  apresentação inteira. Cada cartão mostra **esta lâmina** naquela família (a mesma máquina da
  Composição: a prévia é a lâmina de verdade reduzida), então o cartão mostra exatamente o que o
  clique faz. A variante troca a **cor** (fundo pastel da família, acento e tinta do mesmo
  matiz), não a tipografia — para trocar a fonte há os **Temas** e as **Ideias de design**.

- **Composição** (aba do painel lateral, ou **Design ▸ Composição** na fita): o sistema de
  sugestões da apresentação — as antigas **Ideias de design** e os **Arranjos** eram o mesmo
  sistema em duas abas e viraram **um só**, com nome próprio (o papel do "Designer" do PowerPoint,
  sem copiar o nome). Cada cartão mostra **esta lâmina** já com a sugestão aplicada e o **filtro**
  escolhe o que as sugestões mexem:
  - **Designer** (o padrão): o app **desenha a arte** da lâmina — **ondas** de seda, **facetas** de
    vidro, **mosaico** de losangos e **brilhos** — na paleta de um modelo, em **vetor** (curvas
    de Bézier e gradientes com transparência, formas editáveis que saem no .pptx; nada de imagem
    de banco). Cada estilo vale para o tom **escuro** e o **claro** (a paleta escura ganha arte
    luminosa sobre fundo profundo; a clara, uma arte suave) e é **determinístico** por semente:
    o cartão mostra exatamente o que o clique faz. Na **capa** (e na seção) feita só de texto o
    **título e o subtítulo são recompostos** para a zona que a arte deixa livre — com o
    alinhamento e a cor que leem bem ali (**4,5:1**) e a letra reduzida quando uma palavra não
    cabe na caixa. Uma capa com **imagens ou cartões não é recomposta** (a arte vai para as
    bordas), e nas lâminas de **conteúdo** a arte fica só nas bordas e **nenhuma caixa muda de
    posição**. "Gerar mais" traz outras combinações (as artes giram, a paleta anda espalhada pelo
    catálogo e os três últimos cartões usam **paletas criadas na hora**). Trocar de arte ou de
    modelo **troca** a arte (não empilha), mudar o layout da lâmina a **refaz** para ele e
    **Salvar como modelo** a leva junto;
  - **Visual**: muda **cores, fonte, desenho e o formato das caixas** — e **nenhuma
    caixa muda de posição nem de tamanho**, como o Designer do Office. O clique vale **só para a
    lâmina aberta** (o fundo do design vira o fundo dela; o tema do deck não muda). A opção
    **Aplicar o visual a todas as lâminas** (abaixo do filtro) leva o design ao deck inteiro;
  - **Arrumação**: só as fórmulas da lâmina atual (grade, lista, destaque, faixa) — **esta**
    é a que reposiciona o conteúdo, e só quando você a escolhe;
  - **Tudo**: cada cartão junta as duas metades — a arrumação **e** o visual desta lâmina — num
    **passo de desfazer só**. O nome do cartão diz as duas ("Grade 2×2 · Clássico"); numa lâmina
    que não tem o que arrumar (uma lâmina de título) os cartões saem só de visual.

  A prévia de cada cartão sai do **mesmo caminho do clique** (`aplicarModeloALamina`), então mostra
  exatamente o que vai acontecer com a lâmina.

  O **visual** é um **design** (as cores e a fonte) com um **acabamento**:
  - *cores novas*: troca a paleta e, o mais importante, **remapeia as cores próprias das formas**
    pelo papel de cada uma — a cor da marca vira o acento, os fundos claros viram uma tinta do
    acento e os painéis escuros continuam escuros. Um organograma importado (com verdes que não
    estão em tema nenhum) passa inteiro para a paleta do design, em vez de só o fundo e o texto.
    O **texto** segue regras próprias para não sumir: o escuro continua escuro e o claro continua
    claro (o papel da superfície é que muda), a superfície de cada texto é procurada **embaixo
    dele** — o preenchimento da própria forma, o cartão que está por baixo ou o fundo da lâmina —
    e, quando a cor nova não alcança **4,5:1** de contraste (WCAG) com essa superfície, o texto
    vira para o extremo do design que contrasta. Sobre um cartão que é **imagem** (a cor de trás
    é desconhecida) o texto não troca de lado — é o que o mantém legível num deck importado;
  - *cartão com sombra*: os quadros pintados ganham **cantos arredondados e sombra suave** — o
    formato de cartão, que dá profundidade sem mudar o tamanho nem a posição;
  - *sombra suave*: só a sombra, sem arredondar;
  - *cantos arredondados*: os quadros pintados ganham cantos arredondados (raio de 12%);
  - *contorno de acento*: os quadros pintados ganham contorno na cor de acento do design.

  Os acabamentos formatam só **caixas pintadas** de conteúdo: o texto solto, as tabelas e as
  **decorações fixas** (do modelo e do layout) ficam como estão.

  O botão **Gerar mais** percorre as combinações (designs × acabamentos no modo Visual; arrumações
  × designs no modo Tudo) e o contador ao lado do título mostra quantas estão à mostra. Tudo é
  gerado **no computador** (sem nuvem e sem IA): a prévia é a lâmina de verdade reduzida — com o
  mapa de cores do deck inteiro —, então o cartão mostra exatamente o que o clique faz. Na fornada
  mista a arrumação anda de uma em uma (dois cartões vizinhos nunca repetem a mesma) e o visual
  anda por saltos pelo catálogo, então a fornada espalha designs em vez de mostrar vizinhos.

  Além dos designs do catálogo, **o app cria designs na hora**: a cada fornada entram três
  cartões **Novo**, com uma paleta montada na hora a partir de uma cor de partida (o **ângulo de
  ouro** espalha as paletas), um **esquema harmônico** (análogo, complementar ou triádico), fundo
  claro ou escuro alternado e uma fonte que combina — o nome sai da cor ("Verde análogo"). A
  semente avança a cada fornada, então as paletas **não se repetem**, e o design é
  **determinístico**: o `gerado-N` volta pela mesma função, e é isso que faz a prévia do cartão
  ser exatamente o que o clique aplica. O texto de cada paleta é conferido contra o fundo
  (**WCAG 4,5:1**) antes de a ideia aparecer.
- A **arrumação** (o filtro *Arrumação* — e a metade dos cartões do *Tudo*) reorganiza a
  lâmina em **fórmulas padrão**, mantendo o visual (cores, estilos, imagens):

  - *Grade* (2×2, 3×2, 4×2… conforme a quantidade), *Lista*, *Destaque* (o primeiro cartão grande
    e o resto numa coluna ao lado) e *Faixa* (tudo numa linha);
  - cada **cartão** é detectado com tudo o que está dentro dele (avatar, logo, textos) — num deck
    importado o cartão costuma ser uma **imagem** com os textos soltos por cima, então a detecção
    é por contenção (o que está por dentro anda junto);
  - o **cartão pode ter qualquer preenchimento** (sólido, **gradiente** ou imagem) e **cartões
    concêntricos** (o de fora e o branco de dentro) contam como um só; a partir de **1% da lâmina**
    (abaixo de 2% precisa ter texto dentro, senão é enfeite);
  - a fórmula que deixaria os cartões **ilegíveis** (por exemplo, Lista ou Faixa com 11 cartões)
    **não é oferecida** — o painel só mostra os arranjos que cabem;
  - os cartões ganham o **mesmo tamanho** (o do maior, ajustado para caber no espaço da fórmula) e
    o conteúdo escala junto, com o texto num mínimo de 8pt;
  - **enfeites não são cartões**: uma forma grande, pintada e sem texto que não é retângulo
    (triângulo, seta…) ou é translúcida fica onde está e não engole nada; um **painel de fundo**
    que envolve vários cartões também fica parado — só os cartões dentro dele se arrumam;
  - as **formas fixas do modelo** (decorações) e os **textos do cabeçalho** (título, subtítulo,
    legenda) **não se movem**; as **linhas de ligação saem** (conectores e traços finos fora dos
    cartões), porque a vizinhança dos cartões mudou — dá para desfazer;
  - o cartão e o que sai dele andam como **um bloco** (nada fica deslocado) e as prévias são desenhadas
    aos poucos, sem travar o app;
  - a prévia é a **sua lâmina** reorganizada e o clique aplica a fórmula **só na lâmina atual** (se ela não tem conteúdo para
    arrumar — uma lâmina de título, por exemplo — o painel explica em vez de oferecer cartões que
    não mudam nada).

  Como a fórmula não troca cores nem fontes, quem quer só reorganizar usa o filtro **Arrumação** —
  e quem quer o pacote completo usa o **Tudo**, que aplica a fórmula e o design de uma vez.

## Desenho à mão (Draw) e Curva por pontos

- Na aba **Desenhar** (logo depois de Inserir), o botão **Draw** liga o lápis: **rabisque na lâmina** e,
  ao soltar, o assistente **refaz o traço por cima** com a forma exata — **retângulo, retângulo
  arredondado, elipse, triângulo, linha, seta e arco** — no mesmo lugar e tamanho, já como forma
  normal (editável, com medidas em cm e ida e volta no `.pptx`). O traço torto é **endireitado
  antes de medir** (a mão nunca acerta o ângulo), então a forma acompanha o que foi desenhado.
  Com o lápis ligado, a **barrinha do pincel** flutua **por cima da faixa de lâminas e do palco**
  (ela não some atrás das miniaturas nem da lâmina).
- A **prévia ao vivo é o próprio traço final**: os pontos viram o caminho **suave** no espaço em
  **pt da lâmina** (a espessura acompanha o zoom) e, com o **Assistente** ligado, o **encaixe nos
  eixos aparece enquanto se desenha** — antes a prévia era uma polilinha em % que no zoom alto saía
  **fina e serrilhada**, diferente do traço que ficava. A **Curva** por pontos usa o mesmo espaço.
- O **arco** segue curvas largas (ajuste **elíptico**), não só círculos: traçar o topo de uma
  caixa sai com o raio e a proporção do traço, em vez de virar "meio círculo". O ajuste também
  procura a **orientação**: a curva desenhada **torta** sai como arco **girado no mesmo ângulo do
  desenho** e a caixa acompanha (a curva passa pelo traço, não por perto dele). E uma elipse em
  forma de "faca" (duas retas com um canto, por exemplo) **não vira arco** — vai para o desenho
  livre. O ajuste tem que **passar pelo traço**: o **desvio máximo** da curva (não só a média)
  barra o topo de um cartão (retas com cantos), que virava um arco bojudo **por baixo** do
  desenho — esse traço sai como **linha** (cantos rasos) ou desenho livre com a aresta encaixada.
  E a **cauda reta** das pontas barra o canto do cartão desenhado com **retas curtas + curva**: ele
  era aceito como arco de uma elipse enorme e girada (a forma cobria só a curva e "jogava para
  fora" no canto) — com reta na ponta (a ~0,5 pt da corda numa janela de ~50 pt, contra ~2–3 pt de
  um arco de verdade) o traçado vai para o **desenho livre**, que cobre o desenho todo. Quando o
  arco é reconhecido mesmo, a forma dele é um **caminho** com a mesma curva e a **caixa no pedaço
  visível** (o preset `arc` tem a caixa da elipse inteira e girada — a seleção pegava um retângulo
  enorme e o encaixe mexia na elipse, não no traço); no `.pptx` sai como custGeom com curvas.
- **Desenhar por cima de uma forma existente** (mesmo apagada — a cor não importa) sai **alinhado
  a ela**: a caixa encaixa nas bordas (e nos centros, nas formas reconhecidas) das formas de baixo
  quando está perto — o limiar é 2,5% da largura da lâmina (~24 pt) porque a mão que segue a borda
  de um cartão erra mais que os ~10 pt do início. Os alvos são as bordas **visíveis**: num cartão de
  canto arredondado o canto do retângulo é vazio e a linha desenhada no topo cola onde a borda
  começa de verdade (no fim do arco do canto), não na quina que não existe; o trecho só vale quando
  cruza a faixa do desenho e a ponta do traço entra no fim dele. Nos **traços** (desenho livre e
  curva) o encaixe é só nas **bordas**: o ímã do centro deslocava o traço inteiro para o meio da
  forma de baixo.
- O que o assistente **não** reconhece fica como **desenho livre** — um caminho de verdade,
  **suavizado** (duas passadas de média móvel + curvas, com passo fino para não cortar os cantos),
  que também vai para o arquivo; com o **assistente desligado**, todo traço fica livre. No modo
  assistente o desenho livre **encaixa nos eixos**: os trechos quase horizontais/verticais viram
  retas de verdade — o "L" desenhado alguns graus torto sai **reto, com o canto em 90°** — e o que
  é diagonal de propósito (fora da tolerância de ~9°) fica como foi desenhado. Os trechos
  encaixados saem como **segmento reto** no caminho (não como curva): é o que impede a "barriga"
  que a cúbica fazia no meio do topo de um cartão mesmo com os pontos já alinhados. O encaixe roda
  **antes** da simplificação — simplificado primeiro, um trecho quase reto vira 2–3 pontos e não
  sobraria "corrida" para alinhar (era por aí que o "L" desenhado quase reto escapava torto). Um
  traço que **só parece** um círculo também não é mais fechado: "fechado" só quando as pontas quase
  se encontram (7% da diagonal — era 22%) e o **arco** tem de passar pelo traço (desvio médio de
  0,8% e máximo de 0,35% da diagonal — eram 1,8% e 0,6%); o que não corresponde fica em **desenho
  livre** em vez de virar uma elipse fechada ou um arco bojudo. As **juntas** entre a reta encaixada
  e a curva também saem suaves: o braço da cúbica continua a direção da reta (a reta encostando na
  curva de esguelha deixava uma quebra visível), e o `reto` do Alt continua fazendo quina. E as
  **corridas vizinhas quase colineares viram uma só** (médias a até 5 pt e os pontos do vão a até
  8 pt da reta): quando a mão derrapa no meio do trecho, o alinhamento formava duas retas com
  médias diferentes e o caminho fazia um degrau entre elas.
- **Modos Livre vs Pontos na aba Desenhar e na barra do Pincel**: enquanto o lápis está ligado, a **barrinha do pincel** define
  **cor**, **espessura** (1, 2, 4 ou 8 pt), assistente, e agora permite alternar entre **[Livre]** (arraste para
  rabiscar) e **[Pontos]** (clique para posicionar nós de parada). No modo Livre, um clique pontual **não faz
  nada** — é o **[Pontos]** que marca nós (o clique não liga o modo por conta própria). A aba **Desenhar** tem os mesmos controles
  (cor, espessuras, **Livre/Pontos** e **Assistente**) antes de começar o traço — é o **mesmo pincel**: o que
  se escolhe na aba aparece aceso na barrinha (e o contrário também). A barrinha tem **[Caneta] [Marca]** para
  trocar entre a caneta e o marca-texto sem sair do traço.
- **Marca-texto de tinta** (aba **Desenhar ▸ Marca-texto**, ou **[Marca]** na barrinha): traço **largo e
  translúcido** para destacar o que já está na lâmina — ele **não vira forma** (o assistente não endireita um
  destaque) e a espessura escolhida vale ×3 (1 → 3 pt, 4 → 12 pt, 8 → 24 pt). Escolher o Marca-texto já liga o
  lápis; o **Esc** sai.
- **Borracha** (aba **Desenhar ▸ Borracha**): **clique ou arraste sobre os traços de tinta** para apagá-los —
  desenho livre, curva e marca-texto. Ela só toca o que veio do Draw (uma forma comum embaixo dela **não** é
  apagada) e cada traço apagado é um passo do **desfazer**. Com a borracha ligada a barrinha vira só a dica e o
  cursor vira mira; o **Esc** sai.
- **Converter em forma** (aba **Desenhar ▸ Converter em forma**): com um traço de tinta **escolhido**, ele passa
  pelo assistente e vira a **forma limpa** (retângulo, elipse, triângulo, linha, seta, arco…) **no lugar e do
  tamanho em que ele está** — inclusive depois de movido ou esticado. Se o assistente não reconhecer, o app avisa
  e o traço continua como desenho livre. Para isso o traço guarda os **pontos** em que foi desenhado (`tinta`,
  um dado **só do app**: o `.pptx` continua com a geometria de sempre, e um traço que vem do arquivo não tem o
  botão habilitado).

### Curva por pontos de parada (ferramenta Curva e modo Pontos)

- **Onde encontrar**: na aba **Desenhar ▸ Curva** ou ativando **[Pontos]** na aba/barrinha flutuante do Draw.
- **Como funciona**: cada clique na lâmina adiciona um nó de controle de passagem. O caminho é interpolado
  em tempo real com spline suave $C^1$ (Catmull-Rom), garantindo contornos limpos e sem oscilações indesejadas.
  A prévia mostra **só os nós já marcados**: não há um trecho "elástico" seguindo o mouse entre os cliques.
- **Fechamento suave**: ao aproximar o mouse do ponto inicial (marcado com halo verde pulsante), um clique fecha o
  contorno criando uma forma geométrica completa (`custom`, com preenchimento).
- **Quinas e cantos retos**: segure `Alt` ao clicar para transformar o nó num canto reto (marcador quadrado).
- **Travamento de direção**: segure `Shift` enquanto move o mouse para travar o segmento a cada 45° (horizontal,
  vertical ou diagonal perfeita).
- **Encaixe magnético (snap)**: aproximações próximas a bordas ou centros de outras formas da lâmina alinham o
  ponto automaticamente.
- **Conclusão e atalhos**:
  - `Enter`, botão **Concluir** ou **duplo clique**: finaliza a curva aberta (o duplo clique **não**
    marca um ponto repetido: o clique do par termina).
  - `Backspace` ou `Delete`: desfaz o último ponto adicionado.
  - `Esc` ou botão **✕**: descarta e cancela o traçado em andamento.

## Estúdio: isolar uma box

A aba **Desenhar** tem o grupo **Estúdio**: com uma **box escolhida** (um cartão, uma imagem, uma
caixa de texto — qualquer forma **com área**), o botão **Isolar** põe o palco num **ambiente só
dela**:

- o **resto da lâmina fica esmaecido** por uma máscara que usa o **próprio caminho da box** (com o
  **raio dos cantos**, canto por canto) como buraco — o que está dentro continua vivo e brilhante;
- o **zoom enquadra e centra a box** (a "lâmina da box") e, ao sair, o palco volta ao zoom de antes;
- uma **trilha** no alto diz qual box está isolada (`Lâmina 3 ▸ Card do Diego`) e traz o **Sair**;
- a **seleção passa a respeitar a box**: clicar no que está fora (esmaecido) não escolhe nada;
- **`Esc` sai**; trocar de lâmina ou de documento fecha o modo; e **apagar a box** fecha junto — o
  Estúdio nunca fica apontando para o que não existe mais.

**O que não dá para isolar:** linha, conector, geometria livre e traço de tinta (não têm área) — o
aviso diz isso quando você tenta. As geometrias que o app desenha com exatidão são o **retângulo**, o
**retângulo com cantos arredondados** (raio por canto), a **elipse** e o **triângulo**; as demais
formas predefinidas caem no retângulo da caixa (previsível, e a máscara continua valendo).

Este é o **primeiro passo** de um conjunto: o caminho da box é o mesmo que a **pintura recortada**
(vidro, pincel, balde), as **camadas** e as **cópias vinculadas** (modelo → cópias, com partes
desvinculadas) vão usar como fronteira. Teste: `npm run test:estudio`.

## Estúdio · Regiões: o mapa dos contornos

Dentro do Estúdio, o botão **Regiões** liga o **mapa de contornos** da lâmina:

- **passar o ponteiro acende a face sob ele** (um véu do acento com o contorno tracejado) — o mapa
  divide o que está na lâmina nas **regiões de verdade**: a **face do cartão** (o contorno dele
  menos o logo, o texto e as bolinhas que estão dentro), a **face de cada elemento**, a **rua entre
  dois cartões** e o **palco** (a lâmina menos o que a ocupa);
- **clicar isola aquela região**: a fronteira do Estúdio deixa de ser a box inteira e passa a ser a
  **face escolhida** — com os **buracos** dela —, então o que você fizer ali dentro **não cobre** o
  que estava na lâmina (o logo continua inteiro, o texto continua à vista);
- a **trilha** vira `Lâmina 3 ▸ Card do Diego ‹ Box · Logo`: o **‹ Box** volta para a box inteira e o
  `Esc` sai do mapa, depois da região, e só então do Estúdio.

O que define cada face: o contorno em **polígono** (retângulo, cantos arredondados amostrados no
**raio por canto**, elipse, triângulo — e a **rotação** da forma junto), os **buracos por
interseção** (um texto que **passa por cima** de um logo é buraco do cartão **e** do logo: pintar a
face do cartão não pode cobrir o que você está vendo) e a profundidade pela árvore de **contenção
pelo centro** (o mesmo critério dos Arranjos e do desenho que gruda no cartão). Um buraco que está
inteiramente dentro de outro não é desenhado de novo (o `evenodd` voltaria a preencher o que já
estava furado). Teste: `npm run test:regioes`.

## Estúdio · Pintura: pincel, balde e vidro (recortados na fronteira)

Dentro do Estúdio, o grupo **Pintura** (aba Desenhar) põe uma ferramenta na mão:

- **Pincel**: arraste e o traço aparece **já recortado** pela fronteira (a região isolada, ou a box
  inteira) — o que passa do contorno simplesmente **não existe**, nem na prévia nem no resultado;
- **Balde**: clique numa face e ela é pintada inteira (opaca), **já furando** o que está dentro dela;
- **Vidro**: o mesmo, **translúcido** (a cor é a do traço, e a transparência vem do seletor
  **Opaco/75/50/35/20%**).

O que sai é uma **forma normal da lâmina** (geometria livre, `custGeom`), com o **alfa no
preenchimento**: vale o desfazer, o histórico, a exportação — e o `.pptx` mostra **exatamente o que
você fez**, em qualquer visualizador (o recorte é geometria, não uma máscara do app). Os buracos
entram no caminho como **subcaminhos invertidos** (o truque do "donut" do OOXML, o mesmo do SVG):
por isso a pintura **não cobre** o logo nem o texto que já estavam na face.

**Limite desta fase:** a fronteira precisa ser **convexa** (retângulo, retângulo arredondado,
elipse e triângulo são — e são as que o Estúdio isola). Numa fronteira côncava o app **avisa** e não
pinta, em vez de entregar um recorte torto. O `Esc` sai da ferramenta (e depois do Estúdio).

Teste: `npm run test:pintura`.

## Estúdio · Camadas: a pintura numa lista

O painel lateral tem a aba **Camadas**: cada **grupo de pintura** (e cada **forma solta**) aparece
como uma **camada**, de cima para baixo = da frente para trás. Em cada uma:

- **olho**: esconde/mostra a camada inteira. Escondida, ela **não é desenhada** (lâmina e miniatura)
  e **não vai ao `.pptx`** — o arquivo é o que se vê;
- **nome** editável (é do app: o `.pptx` não tem camadas — o que vai ao arquivo são as formas);
- **opacidade** da camada (5% a 100%);
- **▲/▼**: a camada sobe/desce **inteira** (as formas andam juntas na ordem z);
- **⤓ fundir**: junta a camada na de baixo (o nome e o estado da de baixo mandam);
- **✕ apagar** a camada inteira;
- e o botão **Agrupar a pintura**, que junta as pinceladas da lâmina numa camada nova (com as formas
  que estiverem escolhidas, quando houver duas ou mais).

Teste: `npm run test:camadas`.

## Estúdio · Modelo e cópias vinculadas

O grupo **Modelo** (aba Desenhar):

- **Modelo**: a box escolhida (o cartão e o que está **dentro** dele) vira a mestra;
- **Cópia**: cria uma **cópia vinculada** dela — o cartão e o conteúdo, deslocados; a cópia entra
  logo depois da origem e já fica escolhida;
- **Desvincular** / **Re-vincular**: por **parte** (o cartão, um texto, uma imagem, uma forma
  pintada). A parte desvinculada é **própria daquela cópia**; re-vincular traz o que o modelo tem
  agora.

**Como o vínculo se comporta:** editar uma parte **vinculada** de uma cópia **desvincula essa
parte sozinha** (com o aviso e o caminho de volta) — é o que faz o "Diego Souza" de cada cartão ser
dele sem nenhum passo extra, enquanto o **logo, o fundo e a pintura seguem o modelo**: mudar o
modelo muda todas as cópias. A **posição e o tamanho de cada cópia são livres** (mover ou
redimensionar uma não mexe nas outras); as partes seguem o **arranjo** do modelo dentro do cartão —
sem escala automática (o tamanho é seu, o arranjo é do modelo).

**Quem guarda o quê:** os vínculos são **do app** (`Shape.ehModelo`, `Shape.modelo` e
`Shape.desvinculado` ficam no rascunho/histórico). O **`.pptx` recebe as formas como estão** — o
PowerPoint não tem instância, e o arquivo mostra exatamente o que você viu. Nesta entrega a lâmina
tem **um modelo** (vários modelos por lâmina é um passo seguinte).

Teste: `npm run test:modelo`.

## Conectar formas

- Na aba **Inserir**, o botão **Conectar** (grupo **Diagrama**, ao lado do Fluxo do Mermaid) liga
  **formas que já existem** — nada é recriado: com o modo ligado, passar o mouse sobre uma forma
  mostra as **bolinhas nas quatro bordas** (topo, base, esquerda, direita); o primeiro clique marca
  a **origem** (a bolinha escolhida fica acesa) e o segundo, o **destino**, e a ligação nasce ali.
  Clique fora das bolinhas cancela a origem e **Esc** sai do modo. O alvo é **a forma apontada**: a
  bolinha manda, depois a caixa **de cima** e, sem nada embaixo do ponteiro, a mesma forma segue
  enquanto o ponteiro anda perto dela — as bolinhas não ficam piscando na borda (caixas
  sobrepostas não trocam o alvo no meio do caminho) e as **linhas de ligação não roubam** o
  ponteiro.
- O traço sai com **cantos suaves de 90°** (a mesma ideia do Fluxo do Mermaid): alinhado quando as
  bordas se encontram, um "Z" quando as laterais pedem desvio e um "L" quando uma ponta é vertical
  e a outra horizontal.
- **A cor acompanha as caixas, em transição**: o traço é **uma forma só**, com um **gradiente**
  que sai da **cor da forma de origem** e chega na **cor da forma de destino** — o ângulo é a
  **reta entre as duas bordas escolhidas**, então num "L" a passagem é diagonal e o canto já é
  mistura (era o corte seco de antes, uma metade de cada cor). Quando o destino é branco/sem cor, o
  fim segue a cor da origem; **cores iguais** saem em traço sólido (sem gradiente à toa). O fim
  leva **seta**, na cor do destino. Se a caixa tem **Estilo de cor**, a ligação usa a **cor-base da
  rampa** (a do meio), não o tom claro da ponta.
- A ligação fica **presa às duas formas**: mover, redimensionar, **trocar a cor** ou **apagar**
  qualquer lado **redesenha** (ou remove) o conector na hora — vale como forma comum (colorir,
  ordem, copiar/colar, desfazer), inclusive na exportação do `.pptx`, onde vira uma **forma livre
  com o traço em gradiente** (`a:ln` com `a:gradFill`, no mesmo eixo da tela) — como o fluxo do
  Mermaid. Como o traço é derivado das caixas, **arrastar a própria ligação não muda a rota** —
  para ajustar, mova as formas ligadas (ou apague a ligação e refaça). Documento salvo antes do
  gradiente (a ligação em duas metades) se junta numa forma só na primeira mexida na lâmina.

## Estilos de cor

- Na aba **Formato da Forma**, o botão **Estilos** (grupo **Estilos de Cor**) abre a galeria: as
  **famílias** — Esmeralda, Oceano, Ameixa, Âmbar, Rubi, Grafite e "Da sua cor" — aparecem como
  cartões com a **prévia real** da rampa. Um clique aplica na seleção: a forma ganha o **gradiente
  em diagonal** (3 tons), o **lustro** (a faixa clara translúcida), o contorno no **tom profundo**,
  uma sombra leve e a **cor do texto por contraste** (claro sobre a cor escura). É o visual da
  referência (verde → teal) em dois cliques.
- O estilo é **vivo**: a forma guarda a receita (família, intensidade, brilho, ângulo e cor-base) e
  a aparência é **derivada** a cada mudança da lâmina. Por isso, **trocar a cor** da forma (o
  preenchimento) muda a **cor-base** e a **rampa inteira se refaz** — do claro ao tom escuro, que
  desvia o matiz para o frio (verde vira teal) em vez de só escurecer. Sem cor própria, o estilo
  usa a **cor do tema** e acompanha os Modelos.
- A galeria ainda ajusta **Intensidade** (Suave/Média/Forte — o quanto a rampa abre), **Brilho**
  (**Sem brilho**, **Lustro** ou **Dobra**), **Ângulo** (0/45/90/135) e a **Cor do estilo**; o
  mesmo conjunto aparece na seção **Estilo** do painel Formatar, que também traz o **Desligar
  estilo**. O **Lustro** é a faixa clara translúcida dentro do próprio gradiente; a **Dobra** é o
  brilho diagonal da referência: uma **forma-capa** (paralelogramo com gradiente de branco) que
  nasce **agrupada com a forma** e acompanha a caixa e o giro dela em qualquer mudança — apagar a
  forma leva a capa junto, **desagrupar manda** (o recálculo não volta a agrupar) e
  **copiar/colar** remapeia o grude para as cópias (copiar só a capa a solta, virando forma comum).
- Com o estilo ligado, **ele manda** no preenchimento, no contorno, na sombra e na cor do texto:
  trocar a orientação do **gradiente** vira o **ângulo** do estilo; e editar a pintura à mão
  (contorno, sombra, estilos rápidos, "sem preenchimento") **desliga o estilo**, deixando o que
  estava na tela como pintura normal, editável. O **Desligar estilo** faz o mesmo sem mudar nada.
- No `.pptx` o gradiente vai **nativo** (parada a parada, com transparência), o contorno e a
  sombra vão no lugar certo e a **Dobra abre como um grupo** (base + capa no mesmo `p:grpSp`,
  editável lá); o conceito "vivo" não existe no arquivo — reimportar traz o visual como pintura.
- **O fundo da lâmina também aceita estilo**: no popover **Formatar fundo** há a seção **Fundo com
  estilo** (as mesmas famílias, com a prévia real) e o painel da lâmina traz Família, Intensidade,
  Brilho, Ângulo, Cor-base e o **Desligar o estilo do fundo**. O fundo é vivo como as formas —
  escolher uma cor vira a **cor-base** (a rampa se refaz), as orientações de gradiente viram o
  **ângulo**, sem cor própria ele acompanha o tema e a edição manual solta o estilo, deixando o
  gradiente como pintura. No fundo **não há dobra**: o brilho fica no lustro. "Aplicar a todas as
  lâminas" leva o estilo junto.
- **Os Modelos combinam com o estilo**: o **modelo pode** pôr o Estilo de Cor no fundo das lâminas (os do catálogo
  não usam mais; os **seus** modelos, sim, se o deck tem) (o
  cartão mostra a **rampa** na prévia) e cujo acento é o do próprio modelo. Aplicar um modelo
  **re-deriva** as formas de Estilo de Cor sem cor própria (a base vazia segue o acento novo) e as
  de cor fixa ficam; aplicar um modelo **sem** estilo devolve o fundo ao do modelo (a receita do
  fundo sai). **Salvar como modelo** guarda o estilo do fundo do deck, então o seu modelo reproduz
  o gradiente em qualquer apresentação.

## Apresentar (F5)

- **A lâmina cobre a tela do app** (full-bleed: só as barras laterais do formato) e a barra virou um
  **HUD que se esconde sozinho** — barra e cursor somem depois de um tempo sem mexer e voltam com
  qualquer movimento.
- **Ferramentas no HUD**: progresso e contador clicável, navegação `‹ ›`, **grade de lâminas** (`G`,
  com a miniatura real de cada uma), **tempo decorrido** (`T`), **notas do apresentador** (`N`),
  **tela preta/branca** (`B`/`W`), **tela cheia** (`F`, e a apresentação já abre em tela cheia),
  **laser** (segure `L` ou `Ctrl`), **caneta** (`P`), **marca-texto**
  (`H`), **borracha** (`E`; `Shift+E` limpa a lâmina), **zoom** (`+`/`−`, `Z` volta a 100% e o chip no
  HUD mostra a %), **ajuda** (`?`) e **Encerrar** (`Esc`).
- **Controles da mídia na apresentação**: toda lâmina com **áudio/vídeo** ganha uma **barra de
  controle no HUD** — **reproduzir/pausar**, **tempo e busca** (o trecho do corte, quando há um),
  **volume**, **mudo**, **voltar ao início** e **tela cheia da própria mídia** —, e ela vale mesmo
  com a opção "Mostrar controles na apresentação" **desligada**. No teclado: `K` reproduz/pausa,
  `M` liga/desliga o som e `,`/`.` voltam/avançam 5 s. A barra **não se esconde** enquanto a mídia
  toca (é por ela que se pausa o vídeo) e o player com `continuar` segue tocando ao trocar de lâmina
  com o controle na mão.
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

- **Fita** com abas (Página Inicial, Inserir, **Desenhar**, **Transições**, **Animações**, Design e Exibir;
  **Formato da Forma** e **Layout da Tabela** aparecem quando a seleção pede), **recolhível** e
  **ajustável** — e ela **cabe na largura da janela** (sem rolagem lateral). Recolhida (**Ctrl+F1**),
  a faixa é a **faixa única** (os grupos viram botões com menu); a faixa **não se recolhe sozinha**:
  clicar numa aba mostra a faixa **completa** e **a escolha fica** (trabalhar na lâmina não a recolhe
  mais), e o **Ctrl+F1** alterna — é o único gesto que recolhe.
- **Painel Formatar/Animação/Notas/Composição** à direita: pode ser escondido, redimensionado
  e reaberto pela aba **« Formatar**; o painel de animação lista os efeitos da lâmina na ordem
  (selecionar, mover e remover), as notas ficam na aba **Notas** e a **Composição** mostra os
  cartões gerados no computador (com o filtro Tudo/Arrumação/Visual). As abas ficam numa **grade
  regular** — células iguais, alinhadas coluna com coluna (3+3 no painel padrão, as seis numa linha
  quando o painel é largo), com **hover** para mostrar que são clicáveis — e o painel **encolhe com
  a janela**: nada vaza para fora do app. O **filtro da Composição** (Designer/Visual/Arrumação/Tudo)
  divide a largura do painel e cede com **reticências** quando o painel encolhe: os quatro ficam
  sempre dentro, em qualquer largura (antes o "Tudo" saía pela borda). Conferido no navegador com
  `node scripts/harness-painel.mjs 260|200|170`.
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
- `npm run test:ligacoes` — a rota do conector (reta, "Z" e "L"), a divisão em duas partes com o
  corte contínuo, as cores por trecho (branco cai na origem), o redesenho ao mover/redimensionar,
  a remoção ao apagar a caixa e a cópia da ligação (remapeada ou solta).
- `npm run test:estilos` — o motor das cores (HSL de ida e volta, rampa com o desvio do matiz,
  contraste), o esquema casado, a capa do brilho, o ligar/soltar do estilo e o recálculo vivo
  (trocar a cor ou o tema, órfãos, idempotência).

## Tema escuro: onde a lâmina começa e termina

No tema escuro o **palco** (a área em volta da lâmina) ganha um tom próprio — um degrau acima do
fundo do app — e a lâmina leva uma **moldura de 1px** (\--lamina-borda\), que destaca o fim dela
tanto quando a lâmina é escura quanto quando é clara. A **miniatura** da lista usa a mesma moldura,
e a dica "Clique para adicionar o título/texto" fica em 55% de opacidade (era 40% e sumia no
escuro). Os dois tokens ficam em \src/styles/tokens.css\.

As **molduras das prévias** de lâmina — Ideias e Arranjos no painel lateral e a galeria de
**Variantes** na aba Design — usam o mesmo tom do palco (\--palco-bg\): elas recortam a lâmina de
verdade e o que pinta é o **vão em volta** dela, que é palco e não papel (o branco fixo que havia
ali aparecia no tema escuro como um papel que não existe na tela).

## O papel da apresentação: ela nasce clara

A apresentação **nova** nasce com **papel branco** (tema **Claro**), e a **importação** de um
`.pptx` também. O tema do **app** (claro/escuro) é da **interface**: ele não decide a cor da
lâmina. Quem quer lâmina escura escolhe um **modelo escuro** na própria apresentação — **Design ▸
Temas** (o catálogo tem o **Escuro** e o **Meia-noite**) — ou a variante **Grafite** (**Design ▸
Variantes**), de propósito. O documento que já existe **mantém o tema que tinha**: o que está salvo
no rascunho/histórico vence o padrão, então trocar o padrão de fábrica não repinta nada.
Teste: `npm run test:lamina`.
