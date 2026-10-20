# Mapa de painéis, diálogos e telas do DeckCraft

> Especificação escrita do zero para recriar a interface no mdOffice. Nenhum trecho de código foi copiado.

Este documento descreve a interface do DeckCraft (referência open-source) observada na leitura do
código-fonte, para servir de planta na reconstrução dos painéis, diálogos, menus contextuais, telas
e atalhos no mdOffice. Os rótulos entre aspas são os textos que o usuário vê na tela.

## Resumo

- **8 painéis**: Formatar Forma (Format Shape), Formatar Fundo (Format Background), Animações
  (Animation Pane), Seleção (Selection), Comentários (Comments), Ideias de Design (Design Ideas)
  — os seis à direita —, Notas (inferior) e a barra de controle de mídia (flutuante sobre o palco).
- **27 diálogos**: Inserir Tabela, Tamanho da Lâmina, Cabeçalho e Rodapé, Inserir Hiperlink,
  Configurar Apresentação, Zoom, Novo Comentário, Texto Alternativo, Lâminas a partir de Tópicos,
  Renomear Seção, Renomear (forma), Renomear Layout, Parágrafo, Sobre o DeckCraft, Preferências,
  Exportar, Símbolo, Equação, Ortografia, Verificador de Acessibilidade, Idioma, Apresentações
  Personalizadas, Dados do Gráfico, Cortar Mídia, Escolher um Gráfico SmartArt, Sair (alterações
  não salvas) e Fechar apresentação (alterações não salvas).
- **6 menus contextuais**: palco com forma selecionada, palco sem seleção, miniatura de lâmina,
  cabeçalho de seção, linha do painel de Seleção e linha do painel de Animações. Não há menu
  contextual na fita nem nas abas.
- **10 telas**: Início / aba Arquivo (Backstage, com 8 páginas), Modo Normal, Estrutura (Outline),
  Classificação de Lâminas (Slide Sorter), Página de Notas, Exibição de Leitura (Reading View),
  Apresentação de Slides (tela cheia), Modo Apresentador (Presenter View, janela separada),
  Mestre de Lâminas e Paleta de Comandos. Gravação de narração/tela **não existe** (a aba
  "Record" é um espaço reservado).

Convenções do DeckCraft que valem para tudo o que segue: `⌘` é a tecla de comando (Command no
macOS, Ctrl no Windows/Linux); a fita tem as abas fixas **File**, Home, Insert, Draw, Design,
Transitions, Animations, Slide Show, Record, Review, View e as contextuais **Shape Format**,
**Picture Format**, **Table Design**, **Layout**, **Chart Design**, **Playback** e
**Slide Master**, que aparecem conforme a seleção; a aba **File** abre a tela cheia do Backstage.

---

## Painel "Formatar Forma" (Format Shape)

**Quando aparece:** na lateral direita, quando um comando abre o painel de formatação: aba
**Shape Format** → "Format Pane"; clique com o botão direito na forma → "Format Shape…"; ou
"Shape Effects" → "Format Shape…". É um painel redimensionável (240–520 pt de largura, 300 pt por
padrão) com um X no cabeçalho que o fecha. Com **nada selecionado**, mostra só a frase
"Select a shape to format it.".

### Seção "Abas de ícones" (na ordem em que aparece)

| Controle | Tipo | O que faz | Estado/observações |
|---|---|---|---|
| Fill & Line | botão-ícone (alternador) | abre a aba de preenchimento e contorno | é a aba inicial |
| Effects | botão-ícone | abre a aba de sombra, reflexo, brilho e bordas suaves | |
| Size & Properties | botão-ícone | abre a aba de tamanho, posição e texto alternativo | |
| Text Options | botão-ícone | abre a aba da caixa de texto | |
| Picture | botão-ícone | abre a aba de ajustes da imagem | só existe quando a seleção é uma imagem |

### Seção "Fill & Line" → "Fill"

| Controle | Tipo | O que faz | Estado/observações |
|---|---|---|---|
| No fill / Solid fill / Gradient fill / Pattern fill / Automatic | radios | troca o tipo de preenchimento | cada um aplica um valor inicial; "Automatic" limpa o preenchimento |
| Color | botão suspenso (com abertura de cores) | escolhe a cor do preenchimento | o menu traz a opção "No Fill" além das cores |
| Transparency | slider 0–100% | opacidade do preenchimento | aplica ao soltar o controle |
| Preset gradients | 6 amostras clicáveis | gradientes prontos a partir da cor atual | só quando o tipo é gradiente |
| Type | select | Linear, Radial, Rectangular, Path | só quando é gradiente |
| Direction | botões com setas | 8 direções no linear; 5 origens (centro, cantos) no radial/retangular | só quando é gradiente |
| Angle | campo numérico com passo (graus) | ângulo do gradiente linear | só no linear |
| Gradient stops | barra clicável | clicar acrescenta uma parada (até 10); arrastar move a parada | a parada escolhida fica contornada |
| Color (parada) | amostra + botão suspenso | cor da parada selecionada | mantém a transparência atual |
| Remove stop | botão | apaga a parada selecionada | desabilitado com só duas paradas |
| Position | campo numérico (%) | posição da parada na barra | |
| Transparency (parada) | slider 0–100% | transparência da parada | |
| Rotate with shape | caixa de seleção | gira o gradiente junto com a forma | só quando é gradiente |

### Seção "Fill & Line" → "Line"

| Controle | Tipo | O que faz | Estado/observações |
|---|---|---|---|
| No line / Solid line / Automatic | radios | tipo de contorno | "Automatic" volta ao padrão do tema |
| Color | botão suspenso (com abertura de cores) | cor do contorno | o menu traz "No Outline" |
| Width | campo numérico com passo (pt) | espessura do traço | passo de 0,25 pt |
| Dash | botões com glifos | traço contínuo, pontilhado, tracejado, traço-ponto, traço longo | os rótulos são desenhos ("—", "···", "- -", "-·-", "— —") |

### Seção "Effects"

| Controle | Tipo | O que faz | Estado/observações |
|---|---|---|---|
| Shadow | 6 botões (None, Outer, Bottom, Center, Inner, Perspective) | tipo de sombra | aplica na hora |
| Reflection | 4 botões (None, Tight, Half, Full) | reflexo | |
| Glow | slider 0–40 pt | tamanho do brilho | 0 remove o brilho |
| Soft Edges | slider 0–50 pt | suavização das bordas | |
| Reset Effects | botão | limpa todos os efeitos | |

### Seção "Size & Properties"

| Controle | Tipo | O que faz | Estado/observações |
|---|---|---|---|
| Height / Width | campos numéricos com passo (polegadas) | tamanho exato | passo de 0,1" |
| Rotation | campo numérico com passo (graus) | rotação exata | passo de 1° |
| Horizontal / Vertical | campos numéricos com passo (polegadas) | posição exata | passo de 0,1" |
| Alt Text | caixa de texto multilinha (3 linhas) | descrição da forma | grava ao sair do campo |

### Seção "Text Options" → "Text Box"

| Controle | Tipo | O que faz | Estado/observações |
|---|---|---|---|
| Vertical alignment | 3 botões (Top, Middle, Bottom) | âncora vertical do texto | |
| Do not Autofit / Shrink text on overflow / Resize shape to fit text | 3 botões | ajuste automático do texto | |
| Wrap text in shape | caixa de seleção | quebra de linha dentro da forma | |
| Margins (pt): Left / Right / Top / Bottom | campos numéricos com passo | margens internas | padrões 7,2 / 7,2 / 3,6 / 3,6 pt |
| Columns | botões 1 / 2 / 3 | número de colunas de texto | espaçamento fixo de 18 pt |

### Seção "Picture" (só para imagens)

| Controle | Tipo | O que faz | Estado/observações |
|---|---|---|---|
| Brightness | slider −100% a +100% | brilho | aplica ao soltar |
| Contrast | slider −100% a +100% | contraste | |
| Saturation | slider 0–400% | saturação | |
| Transparency | slider 0–100% | transparência da imagem | |
| Reset Picture | botão | desfaz todos os ajustes | |

**Notas para recriar no mdOffice:** o `src/powerpoint/ui/painel.ts` já é um painel único à
direita com seções em sanfona ("Preenchimento", "Linha", "Efeitos", "Ajustes da forma", "Tamanho e
posição", "Texto", "Imagem", "Gráfico") e resolve o mesmo terreno. Falta o que o DeckCraft tem de
diferente: as **abas de ícones** no topo (Fill & Line / Effects / Size & Properties / Text
Options / Picture) e o **editor de gradiente dentro do painel** (amostras prontas, tipo, direção,
ângulo, barra de paradas com cor/posição/transparência). O "Texto Alternativo" do DeckCraft vive
no painel, enquanto o mdOffice não tem campo de alt text; e o painel do DeckCraft não formata
gráfico (isso fica na aba Chart Design) — o mdOffice tem a seção "Gráfico", que pode ser mantida.

## Painel "Formatar Fundo" (Format Background)

**Quando aparece:** na lateral direita, pela aba **Design** → "Format Background", pelo menu
contextual do palco ou da miniatura ("Format Background…") ou pela aba **Slide Master** →
"Background Styles". Substitui o painel de formatação; tem o mesmo cabeçalho com X.

### Seção "Fill" (na ordem em que aparece)

| Controle | Tipo | O que faz | Estado/observações |
|---|---|---|---|
| Solid fill / Gradient fill / Picture or texture fill / Pattern fill / Follow the layout | radios | tipo de fundo da lâmina | "Follow the layout" devolve o fundo ao layout |
| Color | botão suspenso (com abertura de cores) | cor do fundo sólido | |
| (editor de gradiente) | amostras, select, direções, ângulo, barra de paradas | igual ao do painel de forma, sem "Rotate with shape" | aparece com fundo gradiente |
| Presets de padrão | 10 amostras clicáveis (5%, 20%, 50%, listras, grade, diagonal, onda, pontos, trama) | escolhe o padrão | aparece com fundo de padrão |
| Foreground / Background | dois botões suspensos de cor | cores do padrão | |
| Insert picture from file… | botão | escolhe a imagem do fundo | só aparece com fundo de imagem; o radio "Picture or texture fill" já abre o seletor do sistema |
| Hide background graphics | caixa de seleção | esconde os grafismos do mestre | |
| Apply to All | botão | aplica o fundo atual a todas as lâminas | desabilitado quando não há nada a aplicar |
| Reset Background | botão | volta o fundo ao padrão | |

**Notas para recriar no mdOffice:** o painel do mdOffice já tem a seção "Fundo" com Do tema /
Sólido / Gradiente / Imagem e "Aplicar a todas as lâminas", o que cobre o essencial. Faltam os
tipos **padrão/textura** (com as amostras e as duas cores) e a caixa **"Hide background
graphics"**; o "Reset Background" do DeckCraft equivale a escolher "Do tema" no mdOffice. O
gradiente do mdOffice usa só duas cores e ângulo, enquanto o DeckCraft tem barra de paradas —
vale decidir se a profundidade entra agora ou fica para depois.

## Painel "Animações" (Animation Pane)

**Quando aparece:** na lateral direita, pela aba **Animations** → "Animation Pane". Vazio, mostra
"Select an object on the slide and add an animation from the Animations tab.".

### Seção "Barra de ações" (na ordem em que aparece)

| Controle | Tipo | O que faz | Estado/observações |
|---|---|---|---|
| ▶ Play All | botão | roda a lâmina em modo apresentação, em prévia, tocando tudo automaticamente | |

### Seção "Lista de animações" (na ordem em que aparece)

| Controle | Tipo | O que faz | Estado/observações |
|---|---|---|---|
| número do clique | texto à esquerda | ordem de disparo "On Click" | vazio quando o início é "With/After Previous" |
| ícone da classe | ícone | entrada, ênfase, saída ou caminho de movimento | |
| nome do objeto | texto | nome da forma animada | clicar seleciona a forma na lâmina |
| barra de tempo | barra colorida | duração (largura) e atraso (deslocamento) | verde = entrada, amarelo = ênfase, vermelho = saída, azul = caminho |

**Notas para recriar no mdOffice:** o mdOffice **não tem** painel de animações nem animações de
objeto (a área "Animations" está zerada no checklist de paridade). Se for entrar, este painel é o
modelo mínimo viável: lista com ordem de clique, ícone por classe, nome e a barrinha de tempo —
sem timeline avançada. A aba **Animations** da fita do DeckCraft (galeria de efeitos, Add
Animation, Effect Options, Trigger, Animation Painter, Start/Duration/Delay) é a outra metade da
feature e deve ser tratada junto.

## Painel "Seleção" (Selection)

**Quando aparece:** na lateral direita, pela aba **Home** → "Arrange" → "Selection Pane…" ou pela
aba **Shape Format** → "Selection Pane". Lista todos os objetos da lâmina, do mais à frente para o
mais atrás.

### Seção "Cabeçalho"

| Controle | Tipo | O que faz | Estado/observações |
|---|---|---|---|
| Show All | botão | mostra todos os objetos ocultos | |
| Hide All | botão | oculta todos | |
| Send Backward | botão-ícone (seta para baixo) | manda a seleção um nível para trás | desabilitado sem seleção |
| Bring Forward | botão-ícone (seta para cima) | traz a seleção um nível para a frente | desabilitado sem seleção |

### Seção "Lista de objetos"

| Controle | Tipo | O que faz | Estado/observações |
|---|---|---|---|
| chevron | botão | dobra/desdobra um grupo | só em linhas de grupo |
| nome | texto (ou campo ao renomear) | identifica o objeto | duplo clique ou F2 renomeia; nome vazio é recusado |
| olho | botão-ícone | mostra/oculta o objeto | ícone muda entre olho aberto e cortado |
| cadeado | botão-ícone | trava/destrava o objeto | ícone muda entre fechado e aberto |
| linha | área clicável e arrastável | seleciona, ou arrasta para reordenar entre os irmãos | Ctrl/⌘+clique alterna; Shift+clique pega uma faixa de linhas do mesmo nível; arrastar mostra uma linha de inserção azul |
| fundo | realce | linha selecionada e linha sob o ponteiro | objetos dentro de grupo oculto aparecem apagados |

**Notas para recriar no mdOffice:** o mdOffice **não tem** painel de seleção; a seleção é feita
só no palco. É uma adição de alto valor e baixo risco, porque o modelo já tem nome, oculto e
bloqueado por forma (`s.bloqueada` aparece no painel de formatação). O que o DeckCraft faz e vale
copiar: ordem "da frente para trás", grupos dobrando, olho e cadeado por linha, renomear no lugar
e arrastar para reordenar; o que pode ficar para depois: as setas "Bring Forward/Send Backward" no
cabeçalho (a fita do mdOffice já tem a ordem no grupo Organizar).

## Painel "Comentários" (Comments)

**Quando aparece:** na lateral direita, pelo botão de comentários na barra de título ou na barra de
status, pela aba **Review** → "Show Comments" ou ao postar um comentário novo. Vazio, mostra
"No comments on this slide.".

### Seção "Ações" (na ordem em que aparece)

| Controle | Tipo | O que faz | Estado/observações |
|---|---|---|---|
| + New Comment | botão | abre o diálogo de comentário novo | |

### Seção "Lista de comentários" (na ordem em que aparece)

| Controle | Tipo | O que faz | Estado/observações |
|---|---|---|---|
| avatar | círculo com as iniciais | identifica o autor | |
| autor e data | textos | quem escreveu e quando | a data vem do arquivo, sem fuso |
| texto | texto | o comentário | |
| respostas | linhas "↳ autor: texto" | conversa encadeada | |
| Reply… | campo de texto de uma linha | escreve a resposta; Enter envia | |
| Resolve / Reopen | botão pequeno | marca o comentário como resolvido ou reabre | o rótulo alterna |
| 🗑 | botão pequeno | apaga o comentário | |

**Notas para recriar no mdOffice:** o mdOffice **não tem** comentários (1/4 na área Review do
checklist). O painel do DeckCraft é enxuto e serve de referência direta: cartão com avatar,
autor/data, texto, respostas, campo de resposta com Enter e os botões Resolve e apagar. Note que
no DeckCraft os comentários são **por lâmina** e o painel só lista a lâmina atual; o botão
"+ New Comment" fica dentro do próprio painel.

## Painel "Ideias de Design" (Design Ideas)

**Quando aparece:** na lateral direita, pela aba **Home** ou **Design** → "Design Ideas".

### Seção "Conteúdo" (na ordem em que aparece)

| Controle | Tipo | O que faz | Estado/observações |
|---|---|---|---|
| texto de introdução | rótulo | "Pick a look for your slides. Ideas are generated on your device." | deixa claro que é offline |
| amostras de tema | miniaturas clicáveis | mostra a lâmina atual em cada tema embutido | clicar aplica o tema; o ponteiro ganha realce e o nome aparece em dica |

**Notas para recriar no mdOffice:** o mdOffice atende este painel na aba **Composição** (as
antigas Ideias de design e os Arranjos num sistema só): uma lista de miniaturas da lâmina atual com
cada design **e** cada arrumação, com o filtro **Tudo/Arrumação/Visual** — os cartões do *Tudo*
juntam as duas metades. É a mesma receita do DeckCraft (a lâmina de verdade reduzida, com o mapa de
cores do deck inteiro), com os designs criados na hora por cima do catálogo. O custo de renderizar
uma miniatura por cartão é real — por isso a prévia dos modos Tudo/Arrumação sai **aos poucos** (uma
por quadro) e o painel guarda a fornada enquanto a lâmina não muda.

## Painel "Notas" (inferior)

**Quando aparece:** na parte de baixo da tela no Modo Normal e na Estrutura, quando a opção
"Notes" está ligada (padrão ligado; o botão fica na barra de status e na aba **View**). Some no
Modo Mestre de Lâminas.

### Seção "Conteúdo"

| Controle | Tipo | O que faz | Estado/observações |
|---|---|---|---|
| área de texto | campo multilinha | notas do apresentador da lâmina atual | dica "Click to add notes"; grava ao sair do campo; redimensionável (36–400 pt de altura) |

**Notas para recriar no mdOffice:** o mdOffice já tem o painel "Notas" na aba lateral do
editor, com a mesma função. A diferença de arranjo é que o DeckCraft o põe **embaixo do palco**
(como o PowerPoint) e o mantém redimensionável; o mdOffice o põe na coluna da direita, junto do
painel de formatação. Manter a solução do mdOffice é aceitável; se quiser paridade visual, a
versão inferior é a do DeckCraft.

## Barra de controle de mídia (flutuante sobre o palco)

**Quando aparece:** sobre a forma de mídia selecionada no editor (aba **Playback**), flutuando no
canto inferior do objeto.

### Seção "Controles" (na ordem em que aparece)

| Controle | Tipo | O que faz | Estado/observações |
|---|---|---|---|
| play / pause | botão-ícone | toca ou pausa | o ícone alterna |
| ◀ | botão-ícone | volta ¼ de segundo | |
| ▶ | botão-ícone | avança ¼ de segundo | |
| linha do tempo | barra clicável e arrastável | busca na mídia | marcações amarelas mostram os cortes; o preenchimento azul mostra o progresso |
| tempo | rótulo | posição atual no formato mm:ss,cc | |
| erro | texto vermelho | "No sound: …" quando a saída de áudio falha | |

**Notas para recriar no mdOffice:** o mdOffice não tem mídia (0/7 na área Media), então isto é
referência para quando a feature entrar. O desenho é deliberadamente pequeno: play/pause, saltos
de ¼ de segundo, uma barra de busca com marcas de corte e o tempo — sem volume, sem velocidade.
Na lâmina em apresentação, o mesmo controle não aparece; o clique na mídia toca/pausa.

---

## Diálogo "Inserir Tabela" (Insert Table)

**Quando aparece:** aba **Insert** → "Table" → "Insert Table…".

| Campo/botão | Tipo | O que faz |
|---|---|---|
| Number of columns: | campo de texto | número de colunas (padrão 5) |
| Number of rows: | campo de texto | número de linhas (padrão 2) |
| Insert | botão principal (acento) | cria a tabela |
| Cancel | botão | fecha sem criar |

**Notas para recriar no mdOffice:** o mdOffice já insere tabela por **seletor de grade** em
popup na fita, sem diálogo. O diálogo do DeckCraft é o complemento para números exatos; se for
adotado, o par natural é grade + "Insert Table…", como o DeckCraft faz.

## Diálogo "Tamanho da Lâmina" (Slide Size)

**Quando aparece:** aba **Design** → "Slide Size" → "Page Setup…".

| Campo/botão | Tipo | O que faz |
|---|---|---|
| Slides sized for: | select | presets de tamanho (4:3, 16:9, etc.); mostra "Custom" quando o tamanho não é um preset |
| Width (in): | campo de texto | largura em polegadas |
| Height (in): | campo de texto | altura em polegadas |
| Maximize content (else ensure fit) | caixa de seleção | escala o conteúdo para aproveitar o novo tamanho, em vez de só caber |
| OK / Cancel | botões | aplica ou fecha |

**Notas para recriar no mdOffice:** o mdOffice troca 16:9/4:3 direto na fita, sem diálogo; não há
presets nomeados nem campo de tamanho exato. Este diálogo é o modelo para quando o tamanho custom
entrar, e a distinção "maximizar × garantir que caiba" é a decisão de UX mais importante dele.

## Diálogo "Cabeçalho e Rodapé" (Header and Footer)

**Quando aparece:** aba **Insert** → "Header & Footer"; aba **Insert** → "Slide Number"; ou o link
"Edit Header & Footer" na página Imprimir do Backstage.

| Campo/botão | Tipo | O que faz |
|---|---|---|
| Date and time | caixa de seleção | liga a data |
| (data fixa) | campo de texto | texto da data; vazio = atualiza sozinha |
| Slide number | caixa de seleção | liga o número da lâmina |
| Footer | caixa de seleção | liga o rodapé |
| (texto do rodapé) | campo de texto | texto do rodapé |
| Don't show on title slide | caixa de seleção | esconde tudo na lâmina de título |
| Apply / Apply to All / Cancel | botões | aplica à lâmina atual, a todas, ou fecha |

**Notas para recriar no mdOffice:** o mdOffice tem rodapé e número da lâmina, mas **sem campo de
data** e sem "não mostrar na lâmina de título". O diálogo do DeckCraft é o alvo; a data fixa ×
automática é a parte que costuma faltar nos modelos de dados, então vale checar o `.pptx` antes.

## Diálogo "Inserir Hiperlink" (Insert Hyperlink)

**Quando aparece:** aba **Insert** → "Link"; ⌘K; ou o menu contextual do palco → "Link…".

| Campo/botão | Tipo | O que faz |
|---|---|---|
| Web Page or File / This Document / Email Address | três abas clicáveis | muda o destino |
| Address: | campo de texto | URL ou caminho (começa com "https://") |
| (lista de lâminas) | lista rolável | "1. Título da lâmina" para escolher a lâmina de destino |
| Email address: | campo de texto | endereço de e-mail (vira mailto:) |
| ScreenTip: | campo de texto | dica de tela do link |
| OK / Cancel | botões | aplica ou fecha |

**Notas para recriar no mdOffice:** o mdOffice **não tem** hiperlink. O diálogo do DeckCraft é
pequeno e completo: três modos, a lista de lâminas com os títulos reais (não só números) e a dica
de tela. A lista de lâminas deve vir do modelo (`title()` de cada lâmina) para o usuário
reconhecer o destino.

## Diálogo "Configurar Apresentação" (Set Up Slide Show)

**Quando aparece:** aba **Slide Show** → "Set Up Slide Show".

| Campo/botão | Tipo | O que faz |
|---|---|---|
| Presented by a speaker (full screen) | radio | apresentação em tela cheia conduzida |
| Browsed by an individual (window) | radio | apresentação em janela |
| Browsed at a kiosk (full screen) | radio | quiosque em tela cheia |
| Loop continuously until 'Esc' | caixa de seleção | repete até o Esc |
| Show without narration | caixa de seleção | desliga a narração |
| Show without animation | caixa de seleção | desliga as animações |
| Use timings, if present | caixa de seleção | usa os tempos ensaiados |
| OK / Cancel | botões | aplica ou fecha |

**Notas para recriar no mdOffice:** o mdOffice não tem "Configurar apresentação"; o modo
apresentação é um F5 simples. Este diálogo é a referência para quando entrar (a apresentação em
janela e o quiosque são as opções que mudam comportamento, não só dados).

## Diálogo "Zoom"

**Quando aparece:** clique no percentual da barra de status, ou aba **View** → "Zoom" (a fita usa
um menu com os mesmos valores).

| Campo/botão | Tipo | O que faz |
|---|---|---|
| 400% / 200% / 150% / 100% / 75% / 66% / 50% / 33% | radios | aplica o zoom na hora |
| Fit | botão | ajusta à janela |
| OK / Cancel | botões | fecha |

**Notas para recriar no mdOffice:** o mdOffice já tem zoom com slider e Ctrl+roda no palco
(40–400%), mas sem lista de percentuais nem botão "ajustar à janela" no mesmo lugar. O diálogo é
opcional; se entrar, os mesmos valores do DeckCraft são um bom padrão.

## Diálogo "Novo Comentário" (New Comment)

**Quando aparece:** painel de Comentários → "+ New Comment"; aba **Review** → "New Comment"; aba
**Insert** → "Comment".

| Campo/botão | Tipo | O que faz |
|---|---|---|
| (área de texto) | campo multilinha (4 linhas) | o comentário; dica "Start a conversation" |
| Post | botão principal | publica; só funciona com texto não vazio |
| Cancel | botão | fecha |

**Notas para recriar no mdOffice:** o mdOffice não tem comentários. Quando entrar, este diálogo
é o mínimo: uma caixa e um botão; depois de postar, o painel de comentários abre sozinho.

## Diálogo "Texto Alternativo" (Alt Text)

**Quando aparece:** menu contextual do palco → "Edit Alt Text…"; aba **Shape Format** ou
**Picture Format** → "Alt Text".

| Campo/botão | Tipo | O que faz |
|---|---|---|
| (explicação) | rótulo | "How would you describe this object and its context…?" |
| (área de texto) | campo multilinha (4 linhas) | a descrição |
| Mark as decorative | caixa de seleção | marca como decorativo |
| OK / Cancel | botões | aplica ou fecha |

**Notas para recriar no mdOffice:** o mdOffice não tem alt text. O DeckCraft oferece o mesmo
campo em dois lugares (diálogo e painel de formatação) — escolher um só evita duas fontes de
verdade; a explicação em forma de pergunta e a caixa "decorativo" são bons guias de redação.

## Diálogo "Lâminas a partir de Tópicos" (Slides from Outline)

**Quando aparece:** aba **Home** → "New Slide" (seta) → "Slides from Outline…".

| Campo/botão | Tipo | O que faz |
|---|---|---|
| (explicação) | rótulo | linhas sem recuo viram títulos; linhas com tabulação viram marcadores |
| (área de texto) | campo multilinha (10 linhas, monoespaçado) | o texto do roteiro |
| Insert / Cancel | botões | cria as lâminas ou fecha |

**Notas para recriar no mdOffice:** o mdOffice gera deck a partir de Markdown no "Apresentar",
mas não tem o comando no editor. Este diálogo é o caminho direto para trazer o recurso, com a
mesma regra de indentação (título × marcador) e um campo grande e monoespaçado.

## Diálogo "Renomear Seção" (Rename Section)

**Quando aparece:** menu contextual do cabeçalho de seção no painel de miniaturas.

| Campo/botão | Tipo | O que faz |
|---|---|---|
| Name: | campo de texto | novo nome (pré-preenchido com o atual) |
| Rename / Cancel | botões | renomeia ou fecha |

**Notas para recriar no mdOffice:** o mdOffice não tem seções. Seções entram no checklist de
paridade como P1 e este diálogo é o menor dos pedaços da feature (o resto é o cabeçalho na lista de
miniaturas e os comandos de mover/remover).

## Diálogo "Renomear" (forma)

**Quando aparece:** menu contextual do painel de Seleção → "Rename"; duplo clique na linha também
renomeia no lugar.

| Campo/botão | Tipo | O que faz |
|---|---|---|
| Name: | campo de texto | novo nome da forma (pré-preenchido) |
| Rename / Cancel | botões | renomeia ou fecha |

**Notas para recriar no mdOffice:** o mdOffice já renomeia a lâmina por `window.prompt`; para
formas não há renomear. Este diálogo é trivial e casa com o painel de Seleção sugerido acima —
o nome precisa existir no modelo para valer a pena.

## Diálogo "Renomear Layout" (Rename Layout)

**Quando aparece:** aba **Slide Master** → "Rename".

| Campo/botão | Tipo | O que faz |
|---|---|---|
| Name: | campo de texto | novo nome do layout |
| Rename / Cancel | botões | renomeia ou fecha |

**Notas para recriar no mdOffice:** o mdOffice lê mestre/layout mas não os edita; este diálogo
só faz sentido junto do Modo Mestre de Lâminas.

## Diálogo "Parágrafo" (Paragraph)

**Quando aparece:** aba **Home** → grupo Parágrafo → seta do canto (o botão "Paragraph").

| Campo/botão | Tipo | O que faz |
|---|---|---|
| Before text (in): | campo de texto | recuo esquerdo, em polegadas |
| Special — hanging (in): | campo de texto | recuo deslocado (negativo), em polegadas |
| Spacing before (pt): | campo de texto | espaço antes do parágrafo |
| Spacing after (pt): | campo de texto | espaço depois |
| Line spacing (lines): | campo de texto | espaçamento entre linhas (padrão 1,0) |
| OK / Cancel | botões | aplica ou fecha |

**Notas para recriar no mdOffice:** o mdOffice tem espaçamento de linha e recuos no painel de
formatação, mas sem o diálogo com todos os números juntos. A referência útil aqui é a unidade:
polegadas para recuo, pontos para espaçamento, "linhas" para entrelinha — mistura que o
PowerPoint/DeckCraft mantém e que o usuário já conhece.

## Diálogo "Sobre o DeckCraft" (About DeckCraft)

**Quando aparece:** aba **Help** → "About DeckCraft"; página **Account** → "About DeckCraft";
aba **File** → "About DeckCraft".

| Campo/botão | Tipo | O que faz |
|---|---|---|
| About / Contributors / Models | três abas | alternam o conteúdo |
| (conteúdo) | logo, nome, versão, frase, links | comunidade (Discord), site, código no GitHub, licença e ano |
| Close | botão | fecha |

**Notas para recriar no mdOffice:** o mdOffice tem a aba **Sobre** nas Configurações; a ideia de
separar "Sobre / Contribuidores / Modelos" em abas é aproveitável (o mdOffice tem IA local, então
"Modelos" é uma aba natural). A janela do DeckCraft cresce (640×380) só nas abas com tabela — um
detalhe que evita rolagem desnecessária.

## Diálogo "Preferências" (Preferences)

**Quando aparece:** aba **File** → "Options"; ⌘, ; menu de comandos.

| Campo/botão | Tipo | O que faz |
|---|---|---|
| General | cabeçalho | separa as opções gerais |
| Dark appearance | caixa de seleção | alterna o tema escuro |
| Interface size | slider 0,75×–1,75× | escala da interface |
| Editing | cabeçalho | separa as opções de edição |
| Show smart guides | caixa de seleção | guias inteligentes |
| Snap objects to grid | caixa de seleção | encaixe na grade |
| Replace straight quotes with smart quotes | caixa de seleção | aspas tipográficas |
| AutoCorrect as you type | caixa de seleção | correção automática |
| Your name (comments): | campo de texto | nome usado nos comentários |
| Done | botão | fecha |

**Notas para recriar no mdOffice:** o mdOffice já tem uma aba de **Configurações** bem maior que
esta (escrita, tradução, histórico, aparência, atalhos). O que o DeckCraft tem e o mdOffice pode
não ter: escala da interface e o campo do nome para comentários; e o DeckCraft **não** tem
"autosave" nem "unidades" aqui, apesar de o checklist cobrar.

## Diálogo "Exportar" (Export)

**Quando aparece:** aba **File** → "Export" → "Change File Type" (o diálogo rápido) ou pelo menu
de comandos "Export…".

| Campo/botão | Tipo | O que faz |
|---|---|---|
| PDF document (.pdf) | radio | exporta PDF |
| PNG images (current slide) / (all slides) | radios | exporta PNG |
| JPEG image (current slide) | radio | exporta JPEG |
| PowerPoint Presentation (.pptx) | radio | exporta .pptx |
| Outline (.txt) | radio | exporta só títulos e texto |
| Print layout: | select | só no PDF: Full Page Slides, Notes Pages, Handouts 1/2/3/4/6/9 por página |
| Include hidden slides | caixa de seleção | só no PDF |
| Export / Cancel | botões | executa ou fecha |

**Notas para recriar no mdOffice:** o mdOffice exporta .pptx e imprime via sistema, mas não tem
PNG/JPEG por lâmina nem "tópicos em texto", e não oferece notas/handouts. Este diálogo é o mapa
direto do que falta na exportação; o combo de layout de impressão vale reaproveitar também na
página **Imprimir**.

## Diálogo "Símbolo" (Symbol)

**Quando aparece:** aba **Insert** → "Symbol".

| Campo/botão | Tipo | O que faz |
|---|---|---|
| (instrução) | rótulo | "Click a symbol to insert it at the insertion point." |
| Punctuation / Currency / Math / Greek / Arrows / Shapes | 6 grupos de botões | cada botão insere o caractere no texto | a inserção começa a edição de texto se preciso |
| Close | botão | fecha |

**Notas para recriar no mdOffice:** o mdOffice não tem diálogo de símbolos. É uma adição
barata e útil; a divisão em seis grupos do DeckCraft cobre o uso comum sem virar uma tabela
gigante, e a grade de botões quadrados de 26 pt é um bom alvo de toque.

## Diálogo "Equação" (Equation)

**Quando aparece:** aba **Insert** → "Equation".

| Campo/botão | Tipo | O que faz |
|---|---|---|
| (dica) | rótulo | exemplos de forma linear ("a^2+b^2=c^2", "x=(-b±√(b^2-4ac))/2a") |
| (campo) | campo de texto de uma linha | a equação digitada |
| Insert / Cancel | botões | insere uma caixa de texto com a equação em 28 pt itálico, ou fecha |

**Notas para recriar no mdOffice:** o mdOffice não tem equações (P2 no checklist). O DeckCraft
resolve de forma modesta — converte uma forma linear em texto com sobrescritos e símbolos — o que
é honesto para um recurso P2 e evita um editor de fórmulas completo.

## Diálogo "Ortografia" (Spelling)

**Quando aparece:** aba **Review** → "Spelling"; F7.

| Campo/botão | Tipo | O que faz |
|---|---|---|
| (lista) | linhas "Slide N: “palavra”" | aponta as palavras desconhecidas |
| Go to | botão pequeno | salta para a lâmina do problema |
| (vazio) | rótulo | "The spelling check is complete. No issues found." |
| Close | botão | fecha |

**Notas para recriar no mdOffice:** o mdOffice não tem verificação ortográfica no PowerPoint.
O DeckCraft usa uma lista embutida (sem idiomas) e devolve lâmina + palavra — um bom começo antes
de pensar em corretor de verdade; a lista com "Go to" é o padrão de resultado que o Verificador de
Acessibilidade repete.

## Diálogo "Verificador de Acessibilidade" (Accessibility Checker)

**Quando aparece:** aba **Review** → "Check Accessibility"; página **Info** → "Check for Issues" →
"Inspect Presentation".

| Campo/botão | Tipo | O que faz |
|---|---|---|
| (lista) | linhas "Slide N: problema — nome" | lista os problemas, em área rolável |
| Go to | botão pequeno | vai para a lâmina e seleciona a forma do problema |
| (vazio) | rótulo | "No accessibility issues found. …" |
| Close | botão | fecha |

**Notas para recriar no mdOffice:** o mdOffice não tem verificador de acessibilidade. É o par
natural do alt text: sem alt text e sem contraste verificado, o .pptx exportado fica pior do que o
PowerPoint aceita. A lista com "Go to" que seleciona a forma é o comportamento que dá utilidade ao
diálogo.

## Diálogo "Idioma" (Language)

**Quando aparece:** aba **Review** → "Language".

| Campo/botão | Tipo | O que faz |
|---|---|---|
| Mark selected text as: | rótulo | |
| (lista) | 10 idiomas clicáveis | English (US/UK), Español, Français, Deutsch, Italiano, Português, 日本語, 中文, العربية |
| OK / Cancel | botões | fecha |

**Notas para recriar no mdOffice:** o mdOffice tem tradução de documentos por IA, não marcação de
idioma no texto. O diálogo do DeckCraft é hoje um esqueleto (a escolha não muda o documento), o
que serve de aviso: se entrar no mdOffice, precisa gravar o idioma no trecho, senão vira botão
sem efeito.

## Diálogo "Apresentações Personalizadas" (Custom Shows)

**Quando aparece:** aba **Slide Show** → "Custom Show".

| Campo/botão | Tipo | O que faz |
|---|---|---|
| (lista) | linhas "nome (N lâminas)" + botão Delete | apaga a apresentação personalizada |
| New show name: | campo de texto | nome (padrão "Custom Show 1") |
| Slides (e.g. 1,3,5): | campo de texto | lista de lâminas (padrão "1") |
| Create / Cancel | botões | cria ou fecha |

**Notas para recriar no mdOffice:** o mdOffice não tem apresentações personalizadas (P2 no
checklist). O diálogo é simples, mas a lista de lâminas por texto livre ("1,3,5") é a parte
frágil: sem validação, erros de digitação viram lâminas erradas.

## Diálogo "Dados do Gráfico" (Chart Data)

**Quando aparece:** aba **Chart Design** → "Edit Data", com um gráfico selecionado.

| Campo/botão | Tipo | O que faz |
|---|---|---|
| (instrução) | rótulo | "first row = series names, first column = categories" |
| (grade) | grade de campos de texto (70 pt) | os dados: cabeçalho de séries e coluna de categorias |
| + Row | botão | acrescenta uma linha |
| + Series | botão | acrescenta uma coluna |
| OK / Cancel | botões | aplica ou fecha |
| (sem gráfico) | rótulo | "Select a chart first." e botão Close |

**Notas para recriar no mdOffice:** o mdOffice edita dados de gráfico **no próprio painel**
(+ Categoria / + Série), sem diálogo, e avisa que o gráfico vai para o .pptx como imagem. O
diálogo do DeckCraft é a alternativa "planilha"; se o mdOffice quiser planilha, esta grade é o
modelo, com a regra primeira linha = séries e primeira coluna = categorias.

## Diálogo "Cortar Mídia" (Trim Media)

**Quando aparece:** aba **Playback** → "Trim", com mídia selecionada.

| Campo/botão | Tipo | O que faz |
|---|---|---|
| Start time (s): | campo de texto | segundo inicial |
| End trim (s): | campo de texto | segundos cortados do fim |
| Fade in (s): | campo de texto | esmaecimento de entrada |
| Fade out (s): | campo de texto | esmaecimento de saída |
| OK / Cancel | botões | aplica ou fecha |

**Notas para recriar no mdOffice:** o mdOffice não tem mídia nem corte. Quando a mídia entrar, o
diálogo de quatro campos é o suficiente para o essencial; os valores aparecem como marcas na barra
de controle de mídia do palco, o que dá retorno visual ao que foi cortado.

## Diálogo "Escolher um Gráfico SmartArt" (Choose a SmartArt Graphic)

**Quando aparece:** aba **Insert** → "SmartArt".

| Campo/botão | Tipo | O que faz |
|---|---|---|
| (instrução) | rótulo | "Pick a graphic; type one item per line." |
| Basic List / Basic Process / Basic Cycle / Hierarchy / Pyramid / Matrix | botões de escolha | o tipo de diagrama |
| (área de texto) | campo multilinha (5 linhas) | um item por linha (padrão "Plan / Build / Launch") |
| Insert / Cancel | botões | cria o diagrama ou fecha |

**Notas para recriar no mdOffice:** o mdOffice não tem SmartArt (0/2). O diálogo do DeckCraft é
um "SmartArt mínimo" — seis tipos e um campo de texto —, o que é uma forma barata de cobrir o
recurso sem árvore de layouts. Os seis tipos cobrem o uso comum; listas e processos são o começo.

## Diálogo "Sair" (alterações não salvas) — título "DeckCraft"

**Quando aparece:** ao fechar a janela com alguma apresentação com alterações não salvas.

| Campo/botão | Tipo | O que faz |
|---|---|---|
| (pergunta) | texto | "Do you want to save the changes you made to “X”?" (ou "N presentations") e "Your changes will be lost if you don't save them." |
| Don't Save | botão | descarta e sai |
| Save | botão principal (acento) | salva tudo e sai (Enter) |
| Cancel | botão | volta à janela |

**Notas para recriar no mdOffice:** o mdOffice já tem autosave, rascunhos e backup, o que reduz o
peso da pergunta; mesmo assim, fechar com alterações pendentes merece a mesma tríade
Salvar / Não salvar / Cancelar, com a contagem de documentos no texto quando houver mais de um.

## Diálogo "Fechar apresentação" (alterações não salvas)

**Quando aparece:** aba **File** → "Close"; ⌘W, com alterações não salvas na apresentação ativa.

| Campo/botão | Tipo | O que faz |
|---|---|---|
| (pergunta) | texto | mesma pergunta, com o nome da apresentação |
| Don't Save | botão | fecha sem salvar |
| Save | botão principal (acento) | salva e fecha (Enter) |
| Cancel | botão | mantém aberta |

**Notas para recriar no mdOffice:** é o irmão do diálogo anterior, mas por documento — no
mdOffice, com abas estilo Chrome, é este o formato que faz sentido ao fechar uma aba. Atenção ao
caso "nunca salvo": no DeckCraft, salvar manda para "Save As"; o mdOffice deve fazer o mesmo.

---

## Menu contextual "palco, com forma selecionada" (clique direito)

| Item (na ordem) | O que faz |
|---|---|
| Cut | recorta a seleção |
| Copy | copia a seleção |
| Paste | cola |
| — separador — | |
| Edit Text | entra na edição de texto da forma |
| Bring to Front ▸ | submenu: "Bring to Front", "Bring Forward" |
| Send to Back ▸ | submenu: "Send to Back", "Send Backward" |
| Group ▸ | submenu: "Group", "Ungroup" |
| Lock / Unlock | trava ou destrava a seleção (o rótulo alterna) |
| Link… | abre o diálogo de hiperlink |
| Edit Alt Text… | abre o diálogo de texto alternativo |
| Set as Default Shape | guarda a forma como padrão das próximas |
| Format Shape… | abre o painel de formatação |

## Menu contextual "palco, sem seleção" (clique direito)

| Item (na ordem) | O que faz |
|---|---|
| Cut / Copy / Paste | recorta, copia e cola (habilitados conforme o estado) |
| — separador — | |
| Layout ▸ | submenu com os layouts do mestre, pelo nome |
| Reset Slide | volta a lâmina ao layout |
| Format Background… | abre o painel de fundo |
| New Comment | abre o diálogo de comentário |

**Notas para recriar no mdOffice:** o menu de contexto do palco do mdOffice tem 10–11 itens
(Editar texto, Recortar, Copiar, Colar, Duplicar, Excluir, Trazer para a frente, Enviar para trás,
Agrupar, Desagrupar / Colar, Selecionar tudo), sem submenus nem formatação. O DeckCraft troca
"Duplicar/Excluir" por submenus de ordem e acrescenta link, alt text, forma padrão e
"Format Shape…" — itens que valem adicionar quando as features existirem; "Set as Default Shape" e
"Layout" dependem de o modelo guardar essas escolhas.

## Menu contextual "miniatura de lâmina" (clique direito)

Vale para o painel de miniaturas (Modo Normal) e para a Classificação de Lâminas. Se a lâmina
clicada não estiver selecionada, ela é selecionada antes.

| Item (na ordem) | O que faz |
|---|---|
| Cut / Copy / Paste | recorta, copia e cola lâminas |
| — separador — | |
| New Slide | insere uma lâmina nova |
| Duplicate Slide | duplica |
| Delete Slide | exclui |
| — separador — | |
| Add Section | começa uma seção nesta lâmina |
| Layout ▸ | submenu com os layouts, pelo nome |
| Reset Slide | volta a lâmina ao layout |
| Format Background… | abre o painel de fundo |
| Hide Slide / Show Slide | oculta ou mostra (o rótulo alterna) |

**Notas para recriar no mdOffice:** o mdOffice não tem menu de contexto na faixa de miniaturas
(nem seções, nem ocultar lâmina). Este menu é o alvo direto quando esses comandos existirem; note
que o DeckCraft **seleciona a lâmina antes** de abrir o menu, o que evita comandos aplicados à
lâmina errada — detalhe fácil de esquecer.

## Menu contextual "cabeçalho de seção" (clique direito)

| Item (na ordem) | O que faz |
|---|---|
| Rename Section… | abre o diálogo de renomear |
| Remove Section | apaga a seção, mantendo as lâminas |
| Remove Section & Slides | apaga a seção e as lâminas dela |
| Move Section Up | sobe a seção |
| Move Section Down | desce a seção |

**Notas para recriar no mdOffice:** depende de seções, que o mdOffice não tem. A dupla
"Remove Section" × "Remove Section & Slides" é o cuidado que evita perda de conteúdo por engano —
o modelo de dados precisa distinguir seção de lâminas.

## Menu contextual "linha do painel de Seleção" (clique direito)

| Item (na ordem) | O que faz |
|---|---|
| Bring to Front | manda para a frente |
| Bring Forward | um nível à frente |
| Send Backward | um nível atrás |
| Send to Back | manda para o fundo |
| — separador — | |
| Rename | renomeia no lugar |
| Show / Hide | mostra ou oculta (o rótulo alterna) |
| Lock / Unlock | trava ou destrava (o rótulo alterna) |

**Notas para recriar no mdOffice:** só existe quando o painel de Seleção existir; é o mesmo
conjunto de ações das setas do cabeçalho e do olho/cadeado, oferecido como menu para quem procura
no clique direito.

## Menu contextual "linha do painel de Animações" (clique direito)

| Item (na ordem) | O que faz |
|---|---|
| Start On Click | começa ao clicar |
| Start With Previous | começa junto com a anterior |
| Start After Previous | começa depois da anterior |
| — separador — | |
| Move Up | sobe na ordem |
| Move Down | desce na ordem |
| Remove | apaga a animação |

**Notas para recriar no mdOffice:** depende do painel de animações; é o mínimo para reordenar e
mudar o disparo sem sair da lista, e cobre os mesmos campos que a fita (Start/Duration/Delay).

**Observação geral:** não há menu contextual na fita nem nas abas do DeckCraft — clicar com o
botão direito numa aba não abre nada. Se o mdOffice quiser um (por exemplo, para personalizar a
fita), será uma adição, não uma paridade.

---

## Tela "Início / aba Arquivo" (Backstage)

**Quando aparece:** aba **File** na fita; Alt+F; ⌘P cai direto na página Imprimir; ⌘W pergunta
antes de fechar; com **nenhuma apresentação aberta** o app abre nesta tela (é a tela inicial).
Ela toma a janela inteira abaixo da barra de título: some a fita, o palco e a barra de status.

**Estrutura:** menu lateral esquerdo de 160 pt, um tom mais escuro que a página, com entradas de
40 pt (ícone de contorno + rótulo) e a página atual na cor de acento:

- No topo, com apresentação aberta: a seta "Back" (linha de 46 pt, dica "Back (Esc)"), depois
  **Home**, **New**, **Open**, um separador, **Info**, **Save**, **Save As**, **Print**,
  **Export**, **Close**.
- Sem apresentação: só **Home**, **New**, **Open**.
- Embaixo, após um separador: **Account** e **Options**.
- **Save**, **Close** e **Options** agem na hora; as demais entradas trocam a página.
- Teclado: Esc volta à apresentação; ↑/↓ percorrem o menu (a página aparece assim que a entrada
  ganha o foco, como no PowerPoint); Enter/Espaço executam a entrada focada.

A área da página tem margens generosas (48/36/22/32) e largura máxima de 1180 pt; cada página
(menos a Home) começa com o título em 22 pt.

### Página "Home"

| Elemento | Tipo | O que faz |
|---|---|---|
| logo + "DeckCraft" | cabeçalho | identidade |
| New + "More themes →" | título + link | o link vai para a página New |
| amostras | 5 miniaturas de tema + "Blank Presentation" + "Sample deck: Northern Lights" | clicar cria a apresentação com o tema (ou abre o deck de exemplo) |
| Recent + caixa "Search for a file" | título + campo de busca | filtra os recentes pelo nome |
| lista de recentes | linhas de 44 pt (ícone, nome, pasta) | clicar abre o arquivo; a dica mostra o caminho completo |
| "More presentations →" | link | aparece com mais de 8 recentes e leva a Open |
| Discord | link | comunidade |

### Página "New"

| Elemento | Tipo | O que faz |
|---|---|---|
| Blank Presentation | miniatura grande | cria uma apresentação em branco |
| "Search for themes" | campo de busca | filtra os temas |
| galeria | miniaturas dos temas embutidos + o deck de exemplo | clicar cria com aquele tema |

### Página "Open"

| Elemento | Tipo | O que faz |
|---|---|---|
| Recent | linha selecionada (lista da esquerda) | mostra os recentes |
| Browse | linha da esquerda | abre o seletor de arquivos (dica "Ctrl+O") |
| Recover Unsaved Presentations | botão | recupera rascunhos; avisa na barra de status quando não há nenhum |
| "Search for a file" | campo de busca | filtra a lista |
| Presentations | título + lista | os recentes, com nome e pasta |

### Página "Info"

| Elemento | Tipo | O que faz |
|---|---|---|
| título | texto em acento, 24 pt | nome da apresentação |
| caminho | texto apagado | caminho ou "Not saved yet" |
| Copy path / Open file location | botões | copiam o caminho ou abrem a pasta |
| Check for Issues → Inspect Presentation | cartão com botão quadrado | abre o Verificador de Acessibilidade |
| Revert → Manage Presentation | cartão com botão quadrado | volta ao arquivo salvo (desabilitado sem alterações) |
| Properties | grade | Size, Slides, Hidden slides e os campos editáveis Title, Subject, Tags, Categories, Company, Comments, Author (cada um com dica própria), além de Location |
| Location | linha da grade | o caminho ou "Not saved yet" |

### Página "Save As"

| Elemento | Tipo | O que faz |
|---|---|---|
| nome e caminho | textos | apresentação atual |
| tipo | select (340 pt) | PowerPoint (*.pptx), DeckCraft (*.deckcraft), PDF, Outline (*.txt), PNG, JPEG — cada um com uma descrição embaixo |
| Save / Download | botão principal | salva no tipo escolhido; .pptx e .deckcraft viram o arquivo do documento, os outros são cópias |

### Página "Print"

| Elemento | Tipo | O que faz |
|---|---|---|
| Print | botão quadrado | imprime via PDF (abre no leitor do sistema ou baixa, na web) |
| (aviso) | texto apagado | explica que a impressão passa por um PDF |
| Settings | título | |
| escopo | select | Print All Slides / Print Current Slide / Custom Range |
| Slides: | campo de texto | intervalo ("e.g. 1-3, 5"); digitar já muda o escopo para Custom Range |
| layout | select | Full Page Slides, Notes Pages, Handouts 1/2/3/4/6/9 por página |
| Print Hidden Slides / Frame Slides | caixas de seleção | inclui ocultas; desenha moldura |
| Edit Header & Footer | link | abre o diálogo de cabeçalho e rodapé |
| prévia | página em miniatura | desenha a página impressa (notas com o texto, handouts em grade; 3 por página deixa linhas para anotações) |
| pager | "N of M" + setas | navega pelas páginas da prévia |

### Página "Export"

| Elemento | Tipo | O que faz |
|---|---|---|
| Create PDF Document | linha da lista | com "Include hidden slides" e o botão "Create PDF" |
| Create Handouts | linha da lista | com "N slides per page" (1/2/3/4/6/9) e o botão "Create Handouts" |
| Change File Type | linha da lista | lista dos tipos com descrição e o botão "Save As" |
| descrições | listas com marcadores | três tópicos explicando o resultado de cada tarefa |

### Página "Account"

| Elemento | Tipo | O que faz |
|---|---|---|
| Appearance | select | Light / Dark |
| User Information | texto | explica que não há conta e que tudo fica no dispositivo |
| Product Information | logo, nome, versão, licença | e o cartão "About DeckCraft", mais os links de Discord e GitHub |

**Notas para recriar no mdOffice:** a tela **Início** do mdOffice já cobre "novo, recentes,
rascunhos, busca"; o que o Backstage acrescenta é a **mesma tela servir de aba Arquivo com
apresentação aberta**, com Info, Save As, Print e Export no mesmo menu lateral. Para o mdOffice,
vale trazer as páginas **Info** (propriedades do documento — hoje uma pendência P2) e **Print**
(escopo + layout + prévia), que são as que têm função que ainda não existe em lugar nenhum; a
página **Export** pode reaproveitar o diálogo de exportação existente. O padrão de teclado
(Alt+F entra com o foco no menu, ↑/↓ mostram a página, Esc volta) é barato e melhora muito o uso.

## Tela "Modo Normal"

**Quando aparece:** é a tela de trabalho padrão (aba **View** → "Normal"; ou ao abrir um arquivo).

**Estrutura, da esquerda para a direita e de cima para baixo:**

1. **Barra de título** (38 pt) — descrita adiante.
2. **Fita**: linha de abas (File, Home, Insert, Draw, Design, Transitions, Animations, Slide Show,
   Record, Review, View + contextuais) e o cartão de comandos. Clicar na aba ativa recolhe a fita
   (⌘F1, ou duplo clique); clicar numa aba diferente a abre.
3. **Painel de miniaturas** (150–420 pt, 236 pt por padrão): números e miniaturas, seções com
   cabeçalho dobrável e contagem, marca de lâmina oculta (traço diagonal) e de animação/transição
   (★), moldura de acento na selecionada, arrastar para reordenar com linha de inserção, e um
   "+ New Slide" no fim da lista.
4. **Palco**: a lâmina com sombra, cercada pela área de colagem (objetos fora da lâmina aparecem
   ali e podem ser selecionados), alças de seleção e rotação, guias inteligentes, grade e guias
   opcionais, régua opcional, prévia de desenho, cursor de texto e barra de mídia.
5. **Painel de Notas** (inferior) quando ligado.
6. **Painel de tarefas** (direita) quando aberto.
7. **Barra de status** (28 pt) — descrita adiante.

**Notas para recriar no mdOffice:** o arranjo é o mesmo que o mdOffice já usa (miniaturas à
esquerda, palco no centro, painel à direita, notas na direita). O que difere: no DeckCraft as
**notas ficam embaixo do palco** e o painel da direita é só de tarefas; e o palco mostra a área de
colagem ao redor da lâmina. O "+ New Slide" no fim da lista de miniaturas é um detalhe bom de
copiar.

## Tela "Estrutura" (Outline View)

**Quando aparece:** aba **View** → "Outline View".

**Estrutura:** painel esquerdo de 360 pt (redimensionável) com a lista de lâminas em texto:

| Elemento | Tipo | O que faz |
|---|---|---|
| número | texto | número da lâmina |
| marcador | quadradinho | contorno de acento na lâmina atual |
| título | campo de texto em negrito | editar e sair do campo grava o título da lâmina; ganhar o foco vai para a lâmina |
| corpo | campo multilinha por forma de texto | um parágrafo por linha, com tabulações pelo nível da lista |

**Notas para recriar no mdOffice:** o mdOffice não tem vista de estrutura no PowerPoint (tem o
painel Estrutura do app, para Markdown/Word). A implementação do DeckCraft é modesta e direta —
título e corpo como campos de texto — e é um bom modelo caso a vista entre.

## Tela "Classificação de Lâminas" (Slide Sorter)

**Quando aparece:** aba **View** → "Slide Sorter"; botão de visão na barra de status.

| Elemento | Tipo | O que faz |
|---|---|---|
| grade | miniaturas de 200 pt × zoom | número embaixo à esquerda; à direita, "★ tipo" quando há transição |
| clique | — | seleciona; ⌘/Ctrl+clique soma à seleção |
| duplo clique | — | abre a lâmina no Modo Normal |
| arrastar | — | reordena com linha vertical de inserção |
| ⌘/Ctrl + roda | gesto | amplia/reduz a grade (0,5×–3×) |
| clique direito | menu | o mesmo menu da miniatura de lâmina |

**Notas para recriar no mdOffice:** o mdOffice tem uma faixa de miniaturas com reordenar, não uma
vista separada. A Classificação do DeckCraft é praticamente a mesma faixa em grade, com zoom pelo
gesto; se o mdOffice quiser a vista, o trabalho é o layout em grade e o zoom, não a interação.

## Tela "Página de Notas" (Notes Page)

**Quando aparece:** aba **View** → "Notes Page".

**Estrutura:** uma folha retrato (proporção 8,5:11) sobre o fundo escuro, com a lâmina na parte de
cima e a área de notas embaixo (dica "Click to add text", texto escuro sobre branco). PageUp e
PageDown trocam de lâmina.

**Notas para recriar no mdOffice:** o mdOffice não tem Página de Notas; a exportação de notas
também não existe. É o par natural da impressão de notas no Backstage (o DeckCraft reusa a mesma
ideia no layout "Notes Pages" do PDF).

## Tela "Exibição de Leitura" (Reading View)

**Quando aparece:** aba **View** → "Reading View"; botão na barra de status.

**Estrutura:** a lâmina centralizada sobre preto, com uma barra de 34 pt na base:

| Elemento | Tipo | O que faz |
|---|---|---|
| "Slide N of M" | texto | posição |
| ◀ / ▶ | botões | lâmina anterior / próxima |
| Close | botão | sai da exibição |

Clicar na lâmina avança; Esc sai. Não entra em tela cheia do sistema, nem mostra o painel de
controles flutuante da apresentação.

**Notas para recriar no mdOffice:** o mdOffice não tem vista de leitura dentro da janela (o F5
vai direto para a tela cheia). A barra inferior é o único elemento novo; como o motor de
apresentação já existe, a vista é um modo de desenho, não um segundo motor.

## Tela "Apresentação de Slides" (tela cheia)

**Quando aparece:** F5 (do começo), Shift+F5 ou ⌘Enter (da lâmina atual), ⌘Shift+Enter,
"Present" na barra de título, "Play from Start / Current" na aba **Slide Show**, ou as prévias de
transição/animação. Entra em tela cheia do sistema (na Exibição de Leitura, não).

| Elemento | Tipo | O que faz |
|---|---|---|
| lâmina | — | desenhada com transições, animações, mídia e GIFs animados |
| controles flutuantes | barra arredondada no canto inferior esquerdo | aparece quando o ponteiro se mexeu nos últimos 2,5 s: ◀, ▶, ✏ (caneta liga/desliga), ⬛ (tela preta) e "End" |
| tela preta / branca | — | B ou ponto / W ou vírgula alternam |
| caneta | traço de 3 pt na cor definida no documento | desenhar com o mouse; E apaga os traços |
| fim | texto "End of slide show, click to exit." no alto | clique ou Enter sai |
| ensaio de tempos | caixa no alto à esquerda | "Slide MM:SSS.S  Total MM:SS"; os tempos são gravados ao sair |
| cursor | — | esconde depois de 2,5 s sem movimento |
| links e ações | — | o ponteiro vira mãozinha sobre links; clique segue o link (lâmina, URL ou sair) |
| mídia | — | toca ao clicar (ou sozinha, se configurada); o botão de play/pause dos GIFs fica no canto do objeto |

**Notas para recriar no mdOffice:** o modo apresentação do mdOffice já cobre o essencial
(teclado, B/W, notas com N, Ctrl+P para PDF). O que falta do lado do DeckCraft: a **caneta**
(desenhar na lâmina), os **controles flutuantes** na base, o **ensaio de tempos** e a mídia
tocando de verdade. A barra flutuante que só aparece quando o mouse se mexe é o detalhe que
mantém a tela limpa e vale copiar.

## Tela "Modo Apresentador" (Presenter View)

**Quando aparece:** junto com a apresentação em tela cheia, quando a opção "Presenter View" (aba
**Slide Show**, ligada por padrão) está ativa. Abre numa **segunda janela** de 1100×700 com o
título "Presenter View — DeckCraft". Não aparece na Exibição de Leitura.

| Elemento | Tipo | O que faz |
|---|---|---|
| cronômetro | texto 22 pt, "HH:MM:SS" | tempo decorrido desde o começo |
| "Slide N of M" | texto | posição |
| ◀ Previous / Next ▶ | botões | navegam |
| End Show | botão | encerra a apresentação |
| lâmina atual | imagem | ocupa ~62% da largura e 80% da altura da metade esquerda |
| "Next" + próxima lâmina | rótulo + imagem | prévia da próxima lâmina; "End of slide show" quando é a última |
| notas | área rolável | as notas do apresentador, 18 pt; "No notes." quando vazias |

Fechar a janela do apresentador desliga o modo apresentador (a apresentação segue).

**Notas para recriar no mdOffice:** o mdOffice mostra as notas **na própria tela cheia** (tecla
N). A janela separada é a diferença de arquitetura: exige segunda janela (no Tauri é possível) e
traz cronômetro e prévia da próxima lâmina. Se a segunda janela for cara, dá para chegar perto com
um painel sobreposto na tela cheia; o que não pode faltar é a tríade notas + próxima lâmina +
cronômetro.

## Tela "Mestre de Lâminas" (Slide Master)

**Quando aparece:** aba **View** → "Slide Master" (o botão alterna para "Close Master View").

**Estrutura:** o painel de miniaturas passa a listar o mestre (linha inteira) e, abaixo, os
layouts com recuo e largura menor, com o nome em dica; o palco edita o mestre ou o layout
escolhido; a fita mostra a aba contextual **Slide Master** (Insert Layout, Delete, Rename, Insert
Placeholder com Content/Text/Picture/Chart/Table/Media, Themes, Background Styles, Close Master
View); a barra de status mostra "Slide Master" no lugar do contador.

**Notas para recriar no mdOffice:** o mdOffice lê mestre/layout do .pptx mas não os edita
(pendência P0). Esta tela é o alvo: a lista de mestres/layouts no painel de miniaturas, a edição
no palco e a aba contextual com quatro ações (inserir/renomear/apagar layout e inserir
placeholder) já entregam o essencial.

## Tela "Paleta de Comandos" (Command Palette)

**Quando aparece:** ⌘Shift+P, ⌘F, o item "Find…" do menu Edit, o botão de busca na barra de título
ou o cartão da página Account.

**Estrutura:** janela flutuante de 520×380 ancorada no alto e ao centro (90 pt abaixo do topo),
sem barra de título:

| Elemento | Tipo | O que faz |
|---|---|---|
| campo de busca | campo de texto | dica "Search commands…"; filtra por nome e por identificador |
| lista | linhas selecionáveis | até 60 comandos, os que começam com o termo primeiro; o atalho aparece alinhado à direita |
| ↑ / ↓ | teclas | movem a seleção |
| Enter | tecla | executa o comando selecionado |
| Esc | tecla | fecha |

**Notas para recriar no mdOffice:** o mdOffice já tem a busca em **Ctrl+K** (`src/busca/`), que
também busca documentos e — o que é o ponto — **lê os botões de verdade das fitas** (com o ícone de
cada um) e **filtra pelo documento aberto**, sem escurecer o app. A diferença é que a do DeckCraft é
**só de comandos** e mostra o atalho de cada um à direita — detalhe que ensina os atalhos ao
usuário. A busca do mdOffice mostra o atalho dos comandos do app à direita (e das fitas, na dica do
botão); a tecla (Ctrl+K × Ctrl+Shift+P) segue a do resto do app.

---

## Barra de status e barra de título

### Barra de status (28 pt, na base)

| Elemento | Posição | Tipo | O que faz |
|---|---|---|---|
| "Slide N of M" (ou "Slide Master") | esquerda | texto | posição atual |
| "English (United States)" | a 120 pt da esquerda | texto | idioma da revisão (fixo) |
| mensagem de status | a 290 pt da esquerda | texto em acento | avisos e erros; some depois de 6 s |
| ajustar à janela | direita | botão-ícone | dica "Fit slide to current window" |
| percentual de zoom | direita | texto clicável | abre o diálogo de Zoom |
| ampliar zoom | direita | botão-ícone | passo de zoom |
| slider de zoom | direita | slider logarítmico 10–400% | sem valor numérico ao lado |
| reduzir zoom | direita | botão-ícone | passo de zoom |
| Slide Show | direita | botão-ícone | abre a apresentação na lâmina atual |
| Reading View | direita | botão-ícone | entra na exibição de leitura |
| Slide Sorter | direita | botão-ícone (alternador) | entra na classificação |
| Normal | direita | botão-ícone (alternador) | volta ao modo normal |
| Comments | direita | botão com ícone e rótulo (alternador) | mostra/esconde o painel de comentários |
| Notes | direita | botão com ícone e rótulo (alternador) | mostra/esconde o painel de notas |

Tudo da metade direita é clicável; os textos da esquerda não são.

### Barra de título (38 pt, no topo)

| Elemento | Posição | Tipo | O que faz |
|---|---|---|---|
| arrastar a área vazia | toda | gesto | move a janela; duplo clique maximiza/restaura |
| Home | esquerda | botão-ícone (alternador) | abre/fecha a aba Arquivo; a dica é "Home" |
| Save | esquerda | botão-ícone | salva (dica "Save (⌘S)"); desabilitado sem documento |
| Undo / Redo | esquerda | botões-ícone | desfazer/refazer (dicas "Undo (⌘Z)", "Redo (⌘Y)") |
| Play from Start | esquerda | botão-ícone | apresentação do começo (dica "Play from Start (F5)") |
| título | centro | texto | nome do documento + " — Edited" quando há alterações; "DeckCraft" sem documento |
| Search | direita | botão-ícone | paleta de comandos (dica "Search commands (⇧⌘P)") |
| Present | direita | botão-pílula em acento | apresentação a partir da lâmina atual |
| Comments | direita | botão-ícone (alternador) | painel de comentários |
| Light/Dark | direita | botão-ícone | alterna o tema (o ícone muda com o modo) |

Quando a janela integra os controles do sistema (macOS), o grupo da esquerda começa 84 pt à
direita para não ficar sob os botões da janela.

### Avisos (toast)

Uma faixa flutuante aparece centralizada a 44 pt da base por 8 s, com uma frase e um X para fechar.
O uso principal é avisar que as fontes do arquivo não estão instaladas. Diferente da mensagem da
barra de status, o toast não depende da barra existir.

**Notas para recriar no mdOffice:** a barra de status do mdOffice tem "Lâmina N / M", o botão
"Painel" e o zoom (− slider % +). O DeckCraft acrescenta o **idioma**, as **mensagens
transitórias** e, principalmente, os **botões de visão/comentários/notas** — que dão acesso de um
clique a recursos hoje espalhados. A barra de título do DeckCraft é mais rica que a do mdOffice
(Home, Save, Undo, Redo, Play, Search, Present, Comments, tema); o mdOffice tem uma barra
superior própria (novo, abrir, salvar, autosave, desenhar, exportar, ⋯), então a recomendação é
acrescentar só o que falta de função (Undo/Redo já existem por atalho) e adotar o padrão de
título "nome — Edited" e o toast para avisos de fonte.

## Atalhos globais

Convenção: ⌘ = Command no macOS e Ctrl no Windows/Linux. "Cmd" e "Ctrl" aparecem juntos na coluna
porque o DeckCraft trata os dois como o mesmo modificador.

| Tecla | Ação | Contexto |
|---|---|---|
| F5 | apresentação do começo | global |
| Shift+F5 | apresentação da lâmina atual | global |
| ⌘Enter | apresentação da lâmina atual | global |
| ⌘Shift+Enter | apresentação do começo | global |
| Esc | sair da apresentação / cancelar / desmarcar / sair do campo | apresentação, diálogos, palco |
| → ↓ Espaço PageDown N | próxima lâmina ou próximo passo | apresentação |
| ← ↑ Backspace PageUp P | lâmina/passo anterior | apresentação |
| ⌘P | alterna a caneta | apresentação |
| ⌘A | desliga a caneta | apresentação |
| Home / End | primeira / última lâmina | apresentação |
| B ou . | alterna tela preta | apresentação |
| W ou , | alterna tela branca | apresentação |
| E | apaga os traços da caneta | apresentação |
| 0–9, depois Enter | vai para a lâmina digitada | apresentação |
| clique / clique direito | avança / volta | apresentação |
| ⌘N | nova apresentação | global |
| ⌘O | abrir | global |
| ⌘S | salvar | global |
| ⌘Shift+S | salvar como | global |
| ⌘W | fechar a apresentação (pergunta se houver alterações) | global |
| ⌘P | imprimir (abre a aba Arquivo na página Imprimir) | global |
| ⌘, | preferências | global |
| ⌘Shift+P | paleta de comandos | global |
| ⌘F | paleta de comandos ("Find…") | global |
| Alt+F | aba Arquivo, com o foco no menu lateral | global |
| ⌘Z / ⌘Y | desfazer / refazer | global |
| ⌘X / ⌘C / ⌘V | recortar / copiar / colar | global |
| ⌘Shift+V | colar com a mesma formatação | global |
| ⌘D | duplicar | global |
| Delete / Backspace | excluir a seleção | palco |
| ⌘A | selecionar tudo | palco |
| ⌘Shift+N | nova lâmina | global |
| PageDown / PageUp | próxima / lâmina anterior | global (sem seleção) |
| ↓ / → e ↑ / ← | próxima / lâmina anterior | palco sem seleção |
| Home / End | primeira / última lâmina | palco sem seleção |
| Enter | nova lâmina (sem seleção) / editar texto (com seleção) | palco |
| F2 | editar texto / renomear no painel de Seleção | palco, painel de Seleção |
| Tab / Shift+Tab | percorre as formas da lâmina | palco |
| setas | move a seleção 6 pt | palco |
| Alt+setas | move a seleção 1 pt | palco |
| ⌘] / ⌘[ | trazer para a frente / enviar para trás | palco |
| ⌘Shift+] / ⌘Shift+[ | trazer para a frente de tudo / enviar para o fundo | palco |
| ⌘Alt+G | agrupar | palco |
| ⌘Alt+Shift+G | desagrupar | palco |
| ⌘Alt+J | reagrupar | palco |
| ⌘B / ⌘I / ⌘U | negrito / itálico / sublinhado | texto ou formas |
| ⌘Shift+X | tachado | texto ou formas |
| ⌘Shift+= | sobrescrito | texto ou formas |
| ⌘= | subscrito | texto ou formas |
| ⌘Shift+. / ⌘Shift+, | aumentar / diminuir a fonte | texto ou formas |
| ⌘] / ⌘[ | aumentar / diminuir a fonte (na edição de texto) | edição de texto |
| Shift+F3 | alterna maiúsculas (minúsculas → Capitalizar → MAIÚSCULAS) | texto |
| ⌘Espaço | limpar toda a formatação | texto ou formas |
| ⌘L / ⌘E / ⌘R / ⌘J | alinhar à esquerda / centralizar / à direita / justificar | texto ou formas |
| Tab / Shift+Tab | aumentar / diminuir o nível da lista | edição de texto |
| ⌘Shift+C | pincel de formatação | texto ou formas |
| ⌘Shift+V | aplicar a formatação copiada | texto ou formas |
| ⌘K | inserir hiperlink | global |
| ⌘Alt+M | novo comentário | global |
| F7 | ortografia | global |
| Alt+P | reproduzir mídia | mídia |
| Alt+Shift+C / Alt+Shift+V | copiar / aplicar animação (pincel de animação) | animação |
| Shift+F9 | linhas de grade | global |
| Alt+F9 | guias | global |
| ⌘= / ⌘- | ampliar / reduzir o zoom | global |
| ⌘0 | ajustar à janela | global |
| ⌘F1 | recolher/abrir a fita | global |
| Ctrl + roda do mouse | zoom no palco (ancorado no ponteiro) | palco |
| roda do mouse | passa as lâminas (com a lâmina ajustada à janela; ampliada, no fim da rolagem são **dois ticos** — o primeiro arma, o segundo troca) | palco |
| ⌘ + roda do mouse | zoom na classificação de lâminas | Classificação |
| PageDown / PageUp | próxima / anterior | Página de Notas |
| Esc | volta à apresentação | aba Arquivo |
| ↑ / ↓ | percorrem o menu lateral (a página abre ao ganhar o foco) | aba Arquivo |
| Enter / Espaço | executa a entrada focada | aba Arquivo |
| ⌘N (com a aba Arquivo aberta) | nova apresentação | aba Arquivo |
| ↑ / ↓, Enter, Esc | navega e executa na lista / fecha | paleta de comandos |
| ← ↑ → ↓ (com Ctrl) | palavra anterior/seguinte | edição de texto (Ctrl; Option no Mac) |
| Ctrl+Shift+setas | estende a seleção por palavra | edição de texto |
| Ctrl+↑ / Ctrl+↓ | parágrafo anterior / seguinte | edição de texto |
| Ctrl+Backspace / Ctrl+Delete | apaga a palavra para trás / para a frente | edição de texto |
| Home / End | começo / fim da linha visual | edição de texto |
| Ctrl+Home / Ctrl+End | começo / fim do texto | edição de texto |
| Shift+Enter | quebra de linha (sem novo parágrafo) | edição de texto |
| Tab / Shift+Tab (dentro de tabela) | próxima / célula anterior; Tab na última cria linha | edição de texto em tabela |
| duplo / triplo clique | seleciona a palavra / o parágrafo | edição de texto |

**Notas para recriar no mdOffice:** o mdOffice já cobre a maioria dos atalhos de edição e de
documento (Ctrl+Z/Y, Ctrl+C/X/V/D, Ctrl+G, setas, F5, Ctrl+K para a paleta). As lacunas que o
DeckCraft preenche e valem mapear: **⌘Shift+P** (ou manter Ctrl+K), **Alt+F** para a aba Arquivo,
**F7** para ortografia, **⌘Alt+M** para comentário, **Alt+F9 / Shift+F9** para guias e grade,
**⌘F1** para recolher a fita e **⌘0** para ajustar à janela. Na apresentação, o mdOffice já tem
as teclas de navegação, B/W, N e Esc; o que falta são **⌘P** (caneta), **E** (apagar traços),
**Home/End** e o **salto por número + Enter**.
