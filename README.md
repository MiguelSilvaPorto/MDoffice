# mdCreator

Editor de **Markdown** em português, feito com **Rust + Tauri 2**, pensado para
produzir documentos bonitos e funcionais — inclusive para enviar à IA.

## O que ele faz

- **Motor do Word (.docx)**: **+ → Documento Word** cria um documento editado direto na folha
  (sem Markdown) e **Abrir** aceita `.docx` do Word. Folha **A4/Carta** com margens, páginas de
  verdade (o texto flui de uma página para a outra, parágrafos longos se dividem entre elas),
  **cabeçalho, rodapé e “Página X de Y”**. Fita com estilos (Texto normal, Título 1–4, Citação,
  Código), **fonte, tamanho, cor da letra e destaque**, negrito/itálico/sublinhado/riscado,
  sub/sobrescrito, alinhamento (inclui justificado), entrelinha, recuo, listas com níveis,
  **tabelas** (inserir, linhas/colunas, mesclar, sombrear), **imagens** (inserir, colar, arrastar),
  links, quebra de página e **zoom**. Salva **.docx de verdade** (`Ctrl+S`) e exporta em PDF
  (imprime a própria folha). O corretor de português sublinha erros e abre sugestões ao clicar; o
  histórico de versões, as abas, a Estrutura e a busca nas abas funcionam também aqui.
  *Arquivos .docx seus só são gravados quando você salva (o motor pode simplificar o que ainda não
  entende: comentários, revisões, campos, caixas de texto); o histórico guarda cópias antes.*
  Ainda não há: tradução ao vivo (use Exportar → Inglês), desenho, notas de rodapé, colunas e
  tabelas dentro de tabelas com mesclagem complexa.
- **Abas estilo Chrome**: uma fileira horizontal com todos os documentos abertos, cada um
  com seu próprio texto, histórico de desfazer e posição de rolagem. `Ctrl+T` nova aba,
  `Ctrl+W` fecha, `Ctrl+Tab` / `Ctrl+1…9` trocam, `Ctrl+Shift+T` reabre a última fechada,
  arraste para reordenar e clique com o botão direito para duplicar/fechar outras. Fechar uma
  aba nunca pergunta nada: o que não foi salvo vira rascunho e fica em **Recentes**. As abas
  abertas voltam sozinhas quando você reabre o app.
- **Painel lateral de projetos**: ícones de painéis (**Início**, **Projetos**, **Estrutura** e
  **Contexto IA**), busca e uma árvore de projetos — cada projeto é uma pasta sua, com os
  `.md` dentro (✓ marca o que já está aberto numa aba). `+` cria um documento no projeto.
- **Tradução automática PT-BR → inglês**: ligue em **Traduzir** (`Ctrl+Alt+T`). Você escreve em
  português; a pré-visualização mostra **português e inglês lado a lado** (ou só um deles, ou
  um embaixo do outro) e o inglês acompanha o que você digita — só os trechos alterados são
  traduzidos de novo, o resto vem de uma memória local. Código, links, imagens, tabelas e
  diagramas ficam intactos. Antes de traduzir, o app **arruma o português** (pontuação,
  maiúsculas, “a gente → nós”, linguagem informal) para a tradução sair mais clara. Há um
  **glossário** (termos que não se traduzem ou têm tradução fixa) em **Ajustes**. Dois motores:
  **online grátis** (MyMemory) e **offline** (modelo que roda no PC, ≈120 MB baixados uma vez, sem
  limite). No modo automático, se o limite do online acabar, ele passa para o offline.
- **Exportar** (botão no topo ou `Ctrl+Shift+E`): uma tela só para escolher formato e idioma —
  **página web**, **PDF**, **Word (.docx)**, **Markdown**, **texto simples**, **pacote para IA**
  (.zip) ou **copiar formatado** (cola no Word/Docs). Cada um em **português**, **inglês** ou
  **os dois** (documento bilíngue em duas colunas, parágrafo por parágrafo; no Markdown/texto/ZIP
  saem dois arquivos). Opções de tema (claro, papel, escuro), tamanho da página e sumário.
- **Estrutura do texto** (painel lateral, 3º ícone): árvore de títulos com **seções que
  recolhem** (setinha; botões de recolher/abrir tudo no topo), **destaque da seção onde o cursor
  está**, **palavras** de cada seção e **tarefas** concluídas (2/5). Clique leva ao título; o
  **⋯** (ou botão direito) abre: mover a seção para cima/baixo (junto com as subseções),
  promover/rebaixar o nível (## ↔ #), adicionar subseção, copiar o texto da seção e excluir —
  tudo é uma ação só no `Ctrl+Z`. Títulos dentro de blocos de código são ignorados, e a caixa
  **Buscar** filtra a lista.
- **Busca de comandos** (`Ctrl+K`) e **modo foco** (`Ctrl+Shift+F`, Esc sai).
- **Histórico de versões**: cada documento guarda cópias sozinhas (a cada 5 minutos, se o texto
  mudou, e sempre que você salva). Abra pelo botão **Histórico** no rodapé, pelo menu **⋯** ou
  pelo `Ctrl+K`: a lista mostra as versões, o lado direito mostra **o que mudou** (vermelho saiu,
  verde entrou) e **Restaurar** troca o texto numa ação só (`Ctrl+Z` desfaz; o texto de antes é
  guardado como "Antes de restaurar"). Dá para **salvar versão com nome** e o histórico acompanha
  o arquivo quando você renomeia ou usa Salvar como.
- **Configurações numa aba**: **⋯ → Configurações** (ou `Ctrl+K`) abre uma aba ao lado dos
  documentos, com menu lateral (Escrita, Tradução, Histórico, Aparência, Atalhos). Cada ajuste vale
  na hora, sem botão Salvar: tom do texto, correção automática, sugestões ao digitar, dicionário
  pessoal, motor e glossário da tradução, histórico, tema, painéis e estilo do desenho.
- **Tom do texto** (em Configurações → Escrita): *formal* (aponta “pra”, “tá”, “a gente”, “coisa”…),
  *neutro* (só o claramente informal) ou *informal* (não mexe no registro, só ortografia e
  pontuação). Vale para o assistente, a correção automática e o português enviado à tradução.
- **Busca no conteúdo**: a caixa **Buscar** do painel lateral procura dentro dos documentos dos
  seus projetos (ignora acento e maiúscula) e nas abas abertas, mesmo sem salvar; clique no
  resultado para abrir já na linha. Também em `Ctrl+K → Buscar no conteúdo`.
- **Interface simples**: no topo só o essencial (Novo, Abrir, Salvar, Desenhar, Imagem e **⋯**).
  O resto (copiar para IA, HTML, Pacote IA, tema, painéis, pastas) fica no menu **⋯** — e a
  barra de formatação mostra uma linha só, com o **⋯** revelando o resto quando você quiser.
- **Editor com realce de sintaxe** (CodeMirror 6) + **pré-visualização ao vivo** lado a lado.
- **Desenho assistido dentro do documento**: *Desenhar* cria a imagem e abre o
  canvas embutido no preview, sem popup. A caneta reconhece traços tortos e corrige
  linhas, retângulos, elipses/círculos e polígonos; também encaixa alinhamentos.
  Formas, texto, cores, seleção/mover, borracha e desfazer/refazer continuam disponíveis.
  Cada desenho é PNG 2x em `assets/` com um sidecar JSON para edição posterior.
- **Mover e copiar objetos no desenho**: com a ferramenta **⌖ Selecionar**, clique em
  qualquer ponto do objeto (inclusive dentro de um círculo/retângulo vazio) e arraste para
  mover — com ímã de alinhamento nas outras formas. Para repetir um padrão: **Alt+arrastar**
  copia e arrasta a cópia, **Ctrl+C/Ctrl+V** copia e cola, **Ctrl+D** duplica e as
  **setas** ajustam fino (Shift = 10px).
- **Estilo de desenho configurável**: no menu **▾** ao lado de *Desenhar* você escolhe
  **Imagem (PNG)** ou **Letras e símbolos**. No modo letras, tudo é desenhado numa
  grade de caracteres: caixas (`┌─┐│└┘`), linhas, textos, **campos selecionáveis** `[ ]`
  e **tabelas** — com traço simples, duplo (`╔═╗`) ou ASCII (`+| -`). O resultado é
  texto puro dentro de um bloco ` ```text `, editável depois pelo botão *Editar letras*.
  Ótimo para IA: é legível e não depende de imagem.
- **Caixa de texto nos dois estilos**: ferramenta **T** — clique e escreva (Enter quebra
  linha, Ctrl+Enter ou clicar fora conclui). No modo imagem, duplo clique edita o texto;
  no modo letras, o texto é escrito em linhas na grade.
- **Renomear pela aba**: dê **duplo clique na aba** (ou `F2`) e digite o novo nome.
  Se o arquivo já estiver salvo, ele é **renomeado no disco** (a pasta `assets/` continua
  funcionando, pois as imagens são relativas); se ainda não foi salvo, o nome vale para o
  próximo salvamento. Nomes com caracteres inválidos são limpos e nada é sobrescrito.
- **Zoom para ajuste fino**: nos dois modos de desenho há **− / % / +** na barra e
  **Ctrl + roda do mouse** para dar zoom (50% a 300%). Ampliado, o desenho rola dentro da
  área e os cliques/traços continuam precisos. Clicar no **%** volta para 100%.
- **Modelos prontos no modo letras**: botão **Modelos ▾** insere uma *Caixa com título e
  campo*, um *Fluxo A ▶ B* ou uma *Tabela 3 × 2* com um clique — sem precisar desenhar.
  A caneta também endireita traços tortos (um risco torto vira `─────`).
- **Apagar fácil nos desenhos**: no modo letras, a ferramenta **⌖** deixa você **arrastar
  marcando uma área** e apagar tudo de dentro dela com **Del** (ou o botão 🗑). Também dá
  para clicar com o **botão direito** (ou usar a borracha) sobre uma linha ou rótulo para
  apagar só o trecho. O botão **Remover** apaga o desenho inteiro do documento (nos dois modos).
- **Tempo real no modo letras (ida e volta)**: enquanto você desenha, o bloco ` ```text `
  vai sendo atualizado **no editor à esquerda na hora**; e se você **editar o bloco no
  editor** (mudar um texto, marcar um campo), o quadro **recarrega** com a sua edição —
  então *Concluir* nunca sobrescreve o que você escreveu. Se o bloco for apagado, o quadro
  fecha com aviso. Cancelar devolve o conteúdo original.
- **Campos selecionáveis no preview**: as caixas de tarefa (`- [ ]`) são clicáveis na
  pré-visualização e ligam/desligam direto no Markdown.
- **Imagens**: insira pelo botão *Imagem*, **cole com `Ctrl+V`** ou **arraste o arquivo**
  para a janela. Tudo é copiado para `assets/` com nome limpo (sem acentos/espaços).
- **Rascunhos na pasta do app**: documento criado e ainda não salvo por você **não vai
  para Documentos** — ele é guardado na pasta de dados do próprio app
  (`…\AppData\Local\com.mdcreator.desktop\rascunhos`), com suas imagens em `assets/`.
  Ao **reabrir o app, o último rascunho é restaurado automaticamente** (nada se perde).
  Quando você usar **Salvar como** para uma pasta sua, o documento **e as imagens** vão
  juntos para lá, e o rascunho é removido. A barra inferior mostra "Rascunho (no app)" e
  o botão ao lado abre essa pasta.
- **Formatação estilo Word**: botões de **alinhamento** — esquerda, **centralizado**,
  **direita** e **justificado** (com hifenização automática) — além de **destaque**
  (marca-texto `<mark>`) e **alinhamento de tabelas** (`:---`, `:---:`, `---:` renderizam
  à esquerda/centro/direita). Como o Markdown não tem sintaxe de alinhamento, o app usa
  `<div align="…">` em volta do trecho: clique no mesmo botão para voltar ao normal.
  O alinhamento age **só nas linhas selecionadas** — se você pegar um trecho de um bloco já
  alinhado, o resto do bloco continua como estava (o app divide o bloco). No menu **⋯**,
  **Reparar alinhamentos** conserta `<div>` sobrando ou sem fechar de documentos antigos.
- **Assistente de escrita (português, offline)**: sublinha em **vermelho** as palavras fora
  do dicionário pt-BR e em **amarelo** problemas de estilo/gramática (abreviações de internet
  como “vc”, palavras grudadas como “derrepente”, repetições “de de”, espaços extras,
  pontuação, frase e **parágrafo começando em minúscula**…). **Clique na palavra sublinhada** para ver as
  **sugestões** e **outras palavras** (sinônimos) e trocar na hora. Abra **Revisar texto**
  (`F7` ou no menu **⋯**) para ver tudo junto: avisos agrupados, **palavras repetidas** com
  sugestões, estatísticas (palavras, frases, média, frases longas), correção item a item e
  **“Corrigir tudo (estilo)”**. O dicionário carrega em segundo plano (não trava o app) e
  você pode **ignorar** palavras que não quer mais ver avisadas.
- **Sugestão de palavras enquanto você digita (Markdown e Word, offline)**: a continuação
  aparece em cinza depois do cursor. **Tab** aceita tudo, **Alt+→** aceita palavra por palavra,
  **Alt+↓ / Alt+↑** trocam entre até 3 opções (o indicador “1/3” mostra quantas há) e **Esc**
  descarta. Ela completa a palavra que você está digitando (a partir de 1–3 letras, conforme a
  confiança) e prevê a próxima palavra ou até 3 (“de acordo com o”). Só aparece quando há
  confiança. Vem de três fontes juntas: um **modelo do português** embutido
  (`public/ngrams/pt.json`, só contagens de palavras e sequências de 2–3 palavras, gerado de
  textos da Wikipédia em português), **o próprio documento** (o que você repete passa a ser
  sugerido) e uma **memória dos seus documentos recentes** (guardada só neste computador; em
  Configurações há “Esquecer o que aprendeu”). Em textos de teste, quem aceita só as sugestões
  certas digita 17–21% menos teclas num documento novo (antes: 5–12%), e mais ainda em
  documentos que repetem termos. Para refazer o modelo e medir:
  `node scripts/fetch-corpus.mjs corpus.txt 100 6000`,
  `node scripts/build-ngrams.mjs public/ngrams/pt.json corpus.txt --vocab=24000 --trimin=8` e
  `GHOST_MODEL=public/ngrams/pt.json ALT=1 npx tsx scripts/eval-ghost.mts texto.txt`.
- **Aprende com você (só neste computador)**: as sugestões de palavras guardam o que você aceita e
  recusa (Tab, Esc, digitar outra coisa) e ajustam a confiança; há um **perfil do seu estilo** (tamanho
  das frases, vírgulas, como abre as frases) que alimenta a revisão — a regra “seu estilo” avisa uma
  frase bem mais longa que o seu normal — e um **modo de intensidade** das sugestões (discreta,
  equilibrada, agressiva) em Configurações. Ao dar espaço depois de uma palavra com erro de digitação
  (“voce”, “resultdo”), o texto fantasma oferece a correção (Tab troca). As sugestões do corretor são
  reordenadas pelo contexto da frase.
- **Revisão inteligente** (Ctrl+K → “Revisão inteligente”, Markdown e Word): analisa o documento todo e,
  para palavras que se repetem demais (“importante” 38 vezes), propõe trocas por sinônimos **na mesma
  forma** (tempo verbal, plural, feminino), mostrando um **diff** (antes/depois, em contexto) e **o
  porquê** de cada troca. Só propõe quando o contexto sustenta (a palavra de antes e a de depois) e
  nada muda sem você aceitar. Quando você já aceitou várias sugestões de palavras, o app analisa em
  segundo plano e mostra um aviso discreto na barra de baixo. A análise roda em fatias de poucos
  milissegundos, numa só thread, só com o computador parado, e pausa se você digitar ou a aba sumir.
  Sinônimos: lista escolhida a dedo + (opcional, “menos certas”) o dicionário aberto do LibreOffice
  (`scripts/build-synonyms.mjs`, derivado do TeP 2.0).
- **Ponto e vírgula automáticos**: o assistente avisa (e o **“Corrigir tudo”** aplica) quando
  falta o **ponto final** no fim do parágrafo, quando falta **vírgula antes** de “mas, porém,
  contudo, entretanto, todavia”, **depois** de conectivos que abrem a frase (“Além disso,”,
  “No entanto,”, “Por outro lado,”, “Dessa forma,”, “Portanto,”, “Por exemplo,”…) e quando o
  **texto ou o parágrafo começa com minúscula** (propõe a maiúscula).
- **Modo formal**: sugere trocar linguagem informal por formal — “pra/pó” → *para*, “tá” →
  *está*, “um monte de” → *muitos*, “bem legal” → *muito interessante*, “tipo assim” →
  *por exemplo*, “acho que” → *considero que*, “coisa” → *item/elemento*, “e tal” →
  *entre outros*, “no final das contas” → *em última análise*, “por causa disso” →
  *por esse motivo*… E **“a gente” é corrigido pela frase inteira, com o verbo na pessoa
  certa**: *“a gente vai fazer”* → **“nós vamos fazer”**, *“a gente irá”* → **“nós iremos”**,
  *“a gente gostaria”* → **“nós gostaríamos”** (mais de 100 verbos no presente, passado,
  imperfeito, futuro e condicional). Se o verbo não estiver na lista, o app **não troca
  nada** — só sugere, para não mudar o sentido.
- **Correção automática** (ligada por padrão; liga/desliga em **⋯ → Correção automática**):
  - **palavras erradas** — quando o corretor tem certeza da troca (só acento, erro clássico
    ou palavra muito parecida e comum), ela entra sozinha **assim que você termina a palavra**
    (nunca no meio dela): *responsavo* → **responsável**, *reuniao* → **reunião**, *otima* →
    **ótima**, *excessao* → **exceção**;
  - **enquanto você escreve** — maiúscula no começo de frase/parágrafo, espaços, pontuação
    repetida e abreviações (“vc” → “você”) entram sozinhos assim que você pausa;
  - **ao terminar o parágrafo** (linha em branco) — o parágrafo anterior ganha ponto final,
    vírgulas e trocas formais;
  - **ao salvar** (`Ctrl+S` / `Salvar como`) — o documento inteiro é revisado antes de gravar.
  Ela **não mexe** em documento que você só abriu (precisa que você digite) e cada correção é
  uma ação única de *desfazer* (`Ctrl+Z`). Palavras em que o corretor **não** tem certeza
  continuam só sugeridas (clique ou `F7` → **Corrigir tudo**).
- **Espaço esquecido**: palavras coladas viram duas (“coisasque” → **coisas que**, “naoconsigo” →
  **não consigo**, “textoOutro” → **texto Outro**) — sozinho quando as duas partes são palavras
  comuns; com a palavra cortada no fim (“coisasqu”) o app só sugere “coisas que”. Também avisa e
  corrige o espaço que falta depois de ponto, “!” e “?” (“fim.Começo”, “Oi!Tudo”). Marcas e
  nomes (Instagram, WhatsApp) não são cortados, e verbos de informática (“scrollar”, “commitar”,
  “deployar”…) não contam como erro.
- **“Você quis dizer…?”**: para palavras que **existem** no dicionário mas estão a **uma
  letra** de uma palavra muito comum (ex.: *maneria* → **maneira**, com troca de letras de
  lugar) o app sugere a palavra provável — sem alarmar em palavras curtas nem nas que diferem
  só na terminação (para não sugerir “escreve” quando você escreveu “escrevi”).
- **Tabelas, listas de tarefas, linhas, links, código e diagramas Mermaid** na barra de ferramentas.
- **Construtor de diagramas "quase desenhado"**: o **◈** abre um assistente com
  pré-visualização ao vivo. Escolha o tipo (Fluxo / Sequência / Estados) e preencha os
  campos — ou **clique direto no diagrama**: clicar num passo abre **＋ Passo depois ·
  ✏ Texto · 🗑 Apagar**, e a barra de cima tem **＋ Passo · ＋ Decisão · ＋ Fim**, que já
  criam o nó conectado. Apagar um passo do meio **religa o fluxo** sozinho. Também dá
  para escrever o código Mermaid à mão (a pré-visualização acompanha na hora).
- **Modelo IA**: insere um esqueleto estruturado (Objetivo, Contexto, Requisitos,
  Formato da resposta) — ótimo para pedir coisas à IA.
- **Copiar p/ IA**: copia o Markdown pronto e lembra você de anexar as imagens.
- **Exportar HTML**: um único arquivo com o CSS embutido e as imagens em base64
  (perfeito para compartilhar ou abrir depois) — agora dentro da tela **Exportar**.
- **Pacote IA (.zip)**: reúne o Markdown, todas as imagens locais referenciadas,
  os JSONs editáveis dos desenhos e um `INSTRUCOES_PARA_IA.md` com campos simples
  para explicar a tarefa, o formato e os critérios. Envie o ZIP inteiro para levar tudo junto.
- **Salvamento automático** a cada alteração, status bar com palavras/caracteres/linhas,
  painel de recentes e índice (estrutura) navegável, tema claro/escuro.
- **Coluna de escrita limitada** (`980px`, centralizada) para as linhas não ficarem gigantes
  em monitores largos — igual à pré-visualização. A divisória do meio acompanha o mouse 1:1.
- **Tela de boas-vindas** a qualquer momento pelo botão **?** no topo (ou `F1`).
- **Pastas para IA**: clique com o botão direito na área de escrita e escolha *Pasta*.
  Selecione diretórios, confira a árvore e escreva seu pedido. Caminhos e nomes são
  inseridos no Markdown; o app não lê o conteúdo dos arquivos.

## Requisitos

- [Rust](https://rustup.rs) (stable) + toolchain do Visual Studio (C++ build tools)
- [Node.js](https://nodejs.org) 20+
- Windows: WebView2 (já vem no Windows 10/11)

## Como rodar

```bash
npm install     # instala as dependências do frontend
npm run app     # inicia o app em modo desenvolvimento (Tauri + Vite)
```

O dicionário pt-BR (≈5 MB, vem do pacote `dictionary-pt`) fica fora do repositório: o
`npm run app` / `npm run build` copiam ele sozinho para `public/dicionario/`. Para copiar
na mão: `npm run prep:dicionario`.

**Salvamento automático**: o app guarda o documento em andamento numa pasta **`temp/` dentro
do projeto** (na janela do app e também quando ele roda no navegador, via servidor de
desenvolvimento). Essa pasta fica no `.gitignore` — seus rascunhos **não** vão para o Git.

Gerar o executável/instalador:

```bash
npm run app:build      # cria o binário de produção (e o instalador no Windows)
```

Outros comandos:

| Comando             | O que faz                                        |
| ------------------- | ------------------------------------------------ |
| `npm run app`       | Inicia o app (dev)                               |
| `npm run app:build` | Compila o app de produção                        |
| `npm run check`     | Checagem de tipos do TypeScript                  |
| `npm run build`     | Build só do frontend (gera `dist/`)              |
| `npm run prep:dicionario` | Copia o dicionário pt-BR para `public/dicionario/` |
| `npm run icon`      | Regenera os ícones a partir de `scripts/gen-icon.mjs` |

## Atalhos

| Atalho             | Ação                          |
| ------------------ | ----------------------------- |
| `Ctrl+N`           | Novo documento                |
| `Ctrl+O`           | Abrir                         |
| `Ctrl+S`           | Salvar                        |
| `Ctrl+Shift+S`     | Salvar como                   |
| `Ctrl+Shift+D`     | Abrir o quadro de desenho     |
| `Ctrl+Shift+C`     | Copiar Markdown para a IA     |
| `Ctrl+Shift+E`     | Exportar (HTML, PDF, Word…)   |
| `Ctrl+T` / `Ctrl+W` | Nova aba / fechar aba         |
| `Ctrl+Tab`, `Ctrl+1…9` | Trocar de aba            |
| `Ctrl+Shift+T`     | Reabrir aba fechada           |
| `F2`               | Renomear o documento          |
| `Ctrl+K`           | Buscar comandos               |
| `Ctrl+Alt+T`       | Tradução automática           |
| `Ctrl+Shift+F`     | Modo foco                     |
| `Ctrl+B` / `Ctrl+I`| Negrito / itálico             |
| `Ctrl+V`           | Colar imagem da área de transferência |
| `F1`               | Tela de boas-vindas / ajuda   |
| **Pacote IA**      | Salvar Markdown + imagens juntos em um ZIP |
| Arrastar a divisória | Ajusta o tamanho dos painéis (duplo clique = 50/50) |
| Clique direito no editor | Menu contextual → Pasta     |

No quadro de desenho: `V` selecionar, `P` caneta, `L` linha, `A` seta, `R` retângulo,
`O` elipse, `T` texto, `E` borracha, `Shift` para linhas retas/quadrados,
`Del` apagar seleção, `Ctrl+Z` desfazer, `Ctrl+D` duplicar.

No desenho em letras e símbolos: `P` mão livre, `L` linha, `R` caixa, `T` texto,
`C` campo selecionável `[ ]`, `B` tabela, `E` borracha, `Ctrl+Enter` concluir.

## Como o documento é organizado

```
Minha pasta/
├─ documento.md        ← o texto Markdown
└─ assets/             ← todas as imagens/desenhos usados no documento
   ├─ desenho-abc123.png
   └─ captura-de-tela.png
```

O Markdown referencia as imagens de forma relativa (`![Desenho](assets/desenho-abc123.png)`),
então o par `.md` + `assets/` pode ser movido/zipado junto sem quebrar nada.
Ao enviar para uma IA, use **Pacote IA** e anexe o ZIP inteiro. O arquivo inclui
o Markdown, os recursos referenciados e um modelo de instrução; o `.md` continua
legível e as imagens ficam vinculadas por caminhos relativos dentro do ZIP.

## Estrutura do projeto

```
src/                  frontend (TypeScript, sem framework) — um "motor" por pasta
├─ main.ts            ponto de partida (cria o App)
├─ app/               o app: estado e integração (um arquivo por assunto)
│  ├─ app.ts          classe App (campos, abas, getters) + junta os módulos abaixo
│  ├─ tabs · pages · documents · wordDocs · assistant · media · drawing
│  ├─ aiContext · menus · toolbar · commands · keys · layout …
├─ md/                motor do Markdown
│  ├─ editor.ts + editor/   CodeMirror 6 (tema, alinhamento, formatação, avisos)
│  ├─ preview.ts      Markdown → HTML + imagens + Mermaid
│  ├─ draw/           desenho assistido embutido (modelo, reconhecimento, quadro, editor)
│  ├─ textdraw/       desenho em letras e símbolos (grade, glifos, editor)
│  ├─ diagram/        construtor de diagramas Mermaid
│  ├─ docx.ts         Markdown → Word (usado ao exportar)
│  └─ markdown.css    estilos do documento (app e HTML exportado)
├─ word/              motor do Word (.docx): schema, editor, paginação, fita
│  └─ docx/           importação do .docx (estilos, blocos, mídia, página)
├─ power/             motor de apresentações (slides)
├─ broker/            sugestão e correção (português, offline)
│  ├─ writing.ts      fachada; peças: tone, mask, spell, stats, check, neighbor
│  ├─ data/ · style/  listas de palavras/frases e regras de estilo (ABNT, tom…)
│  ├─ ghost/          sugestão de palavras (predict, model, memory, documentIndex…)
│  └─ spell.worker.ts · palavras.ts · review.ts
├─ translate/         tradução: plano, máscara, motores, cache, modelo offline, controlador
├─ export/            tela Exportar (HTML, PDF, Word, MD, TXT, ZIP, cópia)
├─ tabs.ts · sidebar.ts · outline.ts   abas, painel lateral, Estrutura
├─ history.ts · historyUi.ts           histórico de versões
├─ settings.ts · settingsPage.ts       configurações (aba)
├─ palette.ts · files.ts               Ctrl+K · pontes com o backend (Tauri)
├─ styles.css         só importa os arquivos de styles/ (um por área da interface)
└─ styles/            tokens, base, topbar, sidebar, editor, word, home …
src-tauri/            backend Rust
├─ src/commands/      files · assets · drafts · projects · search · bundle · util
├─ src/lib.rs         registro dos plugins/comandos
└─ tauri.conf.json    janela, build e empacotamento
```

## Observações

- O `npm install` deste ambiente exige a política de scripts declarada no
  `package.json` (`allowScripts`); em um npm mais antigo esse campo é simplesmente ignorado.
- Imagens são guardadas **ao lado do documento** (em `assets/`). Se você usar
  *Salvar como* em outra pasta, as imagens antigas continuam na pasta original.
