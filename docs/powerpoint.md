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
  distribuir, copiar/colar, duplicar e desfazer/refazer. Arrastar: a forma **escolhida** pega o
  ponteiro em **qualquer ponto do miolo** (cursor de mover) — inclusive as caixas de texto **sem
  preenchimento**, que fora da seleção continuam clique-através para não esconder o que está
  embaixo. E o **Copiar formatação** (o Pincel de
  Formatação): com uma forma escolhida, o clique no botão guarda a pintura e o formato do texto dela
  e o **ponteiro vira “copiar”** — cada clique numa forma veste o formato guardado, sem mexer na
  caixa, no giro nem no texto do alvo; **duplo clique** deixa o pincel **ligado** (pinta várias) e o
  `Esc` sai. A pintura viva (**Estilo de Cor**) vai junto: o alvo passa a usar a mesma receita.
- **Fita métrica do arrasto**: enquanto **arrasta**, um **balão com a medida** acompanha o gesto —
  **x · y** (posição, em cm) ao **mover**; **largura × altura** ao **redimensionar** e ao **desenhar**
  uma forma. A unidade é o **cm**, a mesma dos campos de **Tamanho** do painel, e o balão fica acima
  do quadro (virando para baixo quando não há espaço no topo) e **some ao soltar**.
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
  como no Office, e digitar aplica a todos os trechos escolhidos.
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
- **Mídia**: inserir áudio/vídeo, tocar no F5 com corte, volume e repetição, e ida e volta no `.pptx`.
- **Transições de lâmina**: galeria, direção, duração, no F5 e no arquivo.
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
  que não é modelado volta cru, com aviso). **Aplicar já mostra o efeito tocando** e a **prévia
  devolve a lâmina ao estado de projeto** ao terminar (o **Esc** interrompe na hora) — nada fica
  aplicado no palco fora da apresentação.
- **Lâminas**: arrastar as miniaturas para reordenar (na faixa do topo ou na vertical),
  ocultar, renomear e resetar (com ida e volta no `.pptx`), duplicar e excluir (o botão
  **Duplicar** está na Página Inicial e na aba **Inserir**). O **clique direito na miniatura**
  abre um menu do app — **Duplicar lâmina**, **Nova lâmina no fim**, **Renomear…**, **Ocultar/
  Mostrar na apresentação** e **Excluir lâmina** — agindo na lâmina clicada (antes caía no menu do
  navegador: Voltar/Atualizar/Salvar como/Imprimir/Inspecionar). **Nova lâmina** é um **botão
  dividido**: o **clique na frente** cria a lâmina **na hora**, com o **último layout escolhido** — a
  primeira nasce **Capa**, e a preferência sobrevive ao recarregar; a **setinha ▾** (e o **Layout**)
  abre a **galeria em grade** com a **miniatura de cada layout** (os espaços como silhuetas cinzas,
  na proporção do deck), onde o atual vem destacado — clicar cria a lâmina com aquele layout (ou
  aplica na atual) e passa a ser o "último". No **card "+ Nova lâmina" do fim da faixa** o mesmo par:
  a **prévia** cria com o último layout e o **rótulo** abre a galeria — o "+" redondo que pendia do
  canto da prévia saiu (o rótulo assumiu a função dele). A **lâmina nova entra no fim** da
  apresentação e já fica selecionada.
- **A fita cabe na largura da janela**: a faixa de opções **se ajusta sozinha** ao espaço — se o
  painel da aba ativa não cabe, os espaços e os ícones encolhem em degraus (a **fonte não
  encolhe**), depois os botões grandes ficam **numa linha** (fita compacta) e, por fim, os botões
  pequenos ficam **só com o ícone** (o nome continua na dica e no `aria-label`). Medido num
  navegador em **1338 px**, todas as abas cabem sem rolagem (Início e Animações eram as que
  estouravam, em 353 e 218 px); em 1600 px basta um ajuste leve. Ao alargar a janela a fita
  volta ao normal. A rolagem lateral fica só como último recurso em janelas muito estreitas
  (abaixo de ~1200 px a aba Animações ainda rola). O tamanho que você escolhe arrastando a borda
  de baixo continua valendo: o ajuste automático soma-se a ele.
- **Popups da fita (Formas, Template, Layout, Nova lâmina, cores, bordas…)**: abrir e **fechar
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
  de cor, cada um com as próprias cores e fonte).
- **Aba Design** (fita): quatro grupos, na ordem do Office — **Temas** (a galeria de modelos do
  Template), **Variantes**, **Personalizar** (**Formatar fundo**, **Layout** e **Tamanho** da
  lâmina: 16:9 ou 4:3) e **Designer** (**Ideias de design** e **Arranjos**, que abrem o painel
  lateral na aba certa). A organização lembra a do Office; os cartões, os ícones e os textos são
  os do app (a paleta das Variantes é um ícone próprio com as seis cores das famílias).
- **Variantes** (aba Design): as **seis famílias de cor** do Estilo de cor — **Esmeralda**,
  **Oceano**, **Ameixa**, **Âmbar**, **Rubi** e a **Grafite** (a escura) — aplicadas à
  apresentação inteira. Cada cartão mostra **esta lâmina** naquela família (a mesma máquina das
  Ideias: a prévia é a lâmina de verdade reduzida), então o cartão mostra exatamente o que o
  clique faz. A variante troca a **cor** (fundo pastel da família, acento e tinta do mesmo
  matiz), não a tipografia — para trocar a fonte há os **Temas** e as **Ideias de design**.
- **Ideias de design** (aba do painel lateral, ou **Design ▸ Designer ▸ Ideias de design** na
  fita): mostra **esta lâmina** desenhada em cada ideia, em cartões clicáveis — clicar aplica à
  apresentação inteira. Cada ideia é um **design** (as cores e a fonte) com um **acabamento**:
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
  - *cantos arredondados*: os quadros pintados ganham cantos arredondados (raio de 12%);
  - *contorno de acento*: os quadros pintados ganham contorno na cor de acento do design.

  O botão **Gerar mais ideias** percorre as combinações (designs × acabamentos, 8 por vez) e o
  contador ao lado do título mostra quantas estão à mostra. As ideias são geradas **no
  computador** (sem nuvem), como no *Design Ideas* do DeckCraft: a prévia é a lâmina de verdade
  reduzida — com o mapa de cores do deck inteiro —, então o cartão mostra exatamente o que o
  clique faz.

  Além dos designs do catálogo, **o app cria designs na hora**: a cada fornada entram três
  cartões **Novo**, com uma paleta montada na hora a partir de uma cor de partida (o **ângulo de
  ouro** espalha as paletas), um **esquema harmônico** (análogo, complementar ou triádico), fundo
  claro ou escuro alternado e uma fonte que combina — o nome sai da cor ("Verde análogo"). A
  semente avança a cada fornada, então as paletas **não se repetem**, e o design é
  **determinístico**: o `gerado-N` volta pela mesma função, e é isso que faz a prévia do cartão
  ser exatamente o que o clique aplica. O texto de cada paleta é conferido contra o fundo
  (**WCAG 4,5:1**) antes de a ideia aparecer.
- **Arranjos** (aba do painel lateral, ou **Página Inicial ▸ Designer ▸ Arranjos** na fita): reorganiza a
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
    arrumar — uma lâmina de título, por exemplo — fica como está).

  Como o arranjo não troca cores nem fontes, dá para aplicar um arranjo e depois combinar com
  qualquer ideia de design.

## Desenho à mão (Draw) e Curva por pontos

- Na aba **Desenhar** (logo depois de Inserir), o botão **Draw** liga o lápis: **rabisque na lâmina** e,
  ao soltar, o assistente **refaz o traço por cima** com a forma exata — **retângulo, retângulo
  arredondado, elipse, triângulo, linha, seta e arco** — no mesmo lugar e tamanho, já como forma
  normal (editável, com medidas em cm e ida e volta no `.pptx`). O traço torto é **endireitado
  antes de medir** (a mão nunca acerta o ângulo), então a forma acompanha o que foi desenhado.
- O **arco** segue curvas largas (ajuste **elíptico**), não só círculos: traçar o topo de uma
  caixa sai com o raio e a proporção do traço, em vez de virar "meio círculo". O ajuste também
  procura a **orientação**: a curva desenhada **torta** sai como arco **girado no mesmo ângulo do
  desenho** e a caixa acompanha (a curva passa pelo traço, não por perto dele). E uma elipse em
  forma de "faca" (duas retas com um canto, por exemplo) **não vira arco** — vai para o desenho
  livre. O ajuste tem que **passar pelo traço**: o **desvio máximo** da curva (não só a média)
  barra o topo de um cartão (retas com cantos), que virava um arco bojudo **por baixo** do
  desenho — esse traço sai como **linha** (cantos rasos) ou desenho livre com a aresta encaixada.
- **Desenhar por cima de uma forma existente** (mesmo apagada — a cor não importa) sai **alinhado
  a ela**: o resultado encaixa nas bordas e nos centros das formas de baixo quando está perto.
- O que o assistente **não** reconhece fica como **desenho livre** — um caminho de verdade,
  **suavizado** (duas passadas de média móvel + curvas, com passo fino para não cortar os cantos),
  que também vai para o arquivo; com o **assistente desligado**, todo traço fica livre. No modo
  assistente o desenho livre **encaixa nos eixos**: os trechos quase horizontais/verticais viram
  retas de verdade — o "L" desenhado alguns graus torto sai **reto, com o canto em 90°** — e o que
  é diagonal de propósito (fora da tolerância de ~9°) fica como foi desenhado. Os trechos
  encaixados saem como **segmento reto** no caminho (não como curva): é o que impede a "barriga"
  que a cúbica fazia no meio do topo de um cartão mesmo com os pontos já alinhados.
- **Modos Livre vs Pontos na aba Desenhar e na barra do Pincel**: enquanto o lápis está ligado, a **barrinha do pincel** define
  **cor**, **espessura** (1, 2, 4 ou 8 pt), assistente, e agora permite alternar entre **[Livre]** (arraste para
  rabiscar) e **[Pontos]** (clique para posicionar nós de parada). No modo Livre, dar um clique pontual sem arrastar
  também inicia a inserção de nós de parada automaticamente. A aba **Desenhar** tem os mesmos controles
  (cor, espessuras, **Livre/Pontos** e **Assistente**) antes de começar o traço — é o **mesmo pincel**: o que
  se escolhe na aba aparece aceso na barrinha (e o contrário também).

### Curva por pontos de parada (ferramenta Curva e modo Pontos)

- **Onde encontrar**: na aba **Desenhar ▸ Curva** ou ativando **[Pontos]** na aba/barrinha flutuante do Draw.
- **Como funciona**: cada clique na lâmina adiciona um nó de controle de passagem. O caminho é interpolado
  em tempo real com spline suave $C^1$ (Catmull-Rom), garantindo contornos limpos e sem oscilações indesejadas.
- **Fechamento suave**: ao aproximar o mouse do ponto inicial (marcado com halo verde pulsante), um clique fecha o
  contorno criando uma forma geométrica completa (`custom`, com preenchimento).
- **Quinas e cantos retos**: segure `Alt` ao clicar para transformar o nó num canto reto (marcador quadrado).
- **Travamento de direção**: segure `Shift` enquanto move o mouse para travar o segmento a cada 45° (horizontal,
  vertical ou diagonal perfeita).
- **Encaixe magnético (snap)**: aproximações próximas a bordas ou centros de outras formas da lâmina alinham o
  ponto automaticamente.
- **Conclusão e atalhos**:
  - `Enter` ou botão **Concluir** ou **duplo clique**: finaliza a curva aberta.
  - `Backspace` ou `Delete`: desfaz o último ponto adicionado.
  - `Esc` ou botão **✕**: descarta e cancela o traçado em andamento.

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
- **A cor acompanha as caixas**: a **espinha** (o trecho que sai da origem) sai com a **cor da
  forma de origem** e a **descida final** (do último canto até o destino) com a **cor da forma de
  destino** — as duas partes se encontram no mesmo ponto, sem fresta; quando o destino é
  branco/sem cor, a descida segue a cor da origem. O fim leva **seta**. Se a caixa tem **Estilo de
  cor**, a ligação usa a **cor-base da rampa** (a do meio), não o tom claro da ponta.
- A ligação fica **presa às duas formas**: mover, redimensionar, **trocar a cor** ou **apagar**
  qualquer lado **redesenha** (ou remove) o conector na hora — as duas partes andam juntas (mesma
  seleção) e valem como formas comuns (colorir, ordem, copiar/colar, desfazer), inclusive na
  exportação do `.pptx`, onde viram formas livres (como o fluxo do Mermaid). Como o traço é
  derivado das caixas, **arrastar a própria ligação não muda a rota** — para ajustar, mova as
  formas ligadas (ou apague a ligação e refaça).

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

- **Fita** com abas (Página Inicial, Inserir, **Desenhar**, **Transições**, **Animações**, Design e Exibir;
  **Formato da Forma** e **Layout da Tabela** aparecem quando a seleção pede), recolhível e
  ajustável, com rolagem horizontal quando não cabe.
- **Painel Formatar/Animação/Notas/Ideias/Arranjos** à direita: pode ser escondido, redimensionado
  e reaberto pela aba **« Formatar**; o painel de animação lista os efeitos da lâmina na ordem
  (selecionar, mover e remover), as notas ficam na aba **Notas** e **Ideias/Arranjos** mostram os
  cartões gerados no computador. As abas **quebram de linha** quando não cabem e o painel
  **encolhe com a janela** — nada vaza para fora do app.
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
