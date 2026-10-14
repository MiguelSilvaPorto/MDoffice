# MD\* — o editor de Markdown

O motor original do app: escrever em Markdown com pré-visualização ao vivo, desenhar
dentro do documento e contar com uma escrita assistida de português que roda offline.

## Editor e pré-visualização

- Editor com **realce de sintaxe** (CodeMirror 6) e **pré-visualização ao vivo** lado a lado.
- **Coluna de escrita limitada** (`980px`, centralizada) para as linhas não ficarem gigantes
  em monitores largos — igual à pré-visualização. A divisória do meio acompanha o mouse 1:1;
  arrastada **para além do limite da direita**, fecha a pré-visualização (que volta em
  **Configurações → Aparência → Pré-visualização**).
- **Salvamento automático** a cada alteração; barra de status com palavras/caracteres/linhas,
  painel de recentes e índice (estrutura) navegável, tema claro/escuro.
- **Busca no conteúdo**: a caixa **Buscar** do painel lateral procura dentro dos documentos
  dos seus projetos (ignora acento e maiúscula) e nas abas abertas, mesmo sem salvar; clique
  no resultado para abrir já na linha.
- **Campos selecionáveis no preview**: as caixas de tarefa (`- [ ]`) são clicáveis na
  pré-visualização e ligam/desligam direto no Markdown.
- **Tabelas, listas de tarefas, linhas, links, código e diagramas Mermaid** na barra de ferramentas.

## Documentos e imagens

- **Imagens**: insira pelo botão *Imagem*, **cole com `Ctrl+V`** ou **arraste o arquivo** para
  a janela. Tudo é copiado para `assets/` com nome limpo (sem acentos/espaços).
- **Rascunhos na pasta do app**: documento criado e ainda não salvo **não vai para Documentos** —
  fica na pasta de dados do app, com as imagens em `assets/`. Ao reabrir, o último rascunho é
  restaurado; ao usar **Salvar como**, o documento **e as imagens** vão juntos e o rascunho sai.
- **Como o documento é organizado**: par `.md` + pasta `assets/`, referências relativas —
  pode mover/zipar junto sem quebrar nada ([detalhes](estrutura-do-projeto.md)).

## Formatação

- **Formatação estilo Word**: **alinhamento** — esquerda, **centralizado**, **direita** e
  **justificado** (com hifenização) —, **destaque** (marca-texto) e **alinhamento de tabelas**
  (`:---`, `:---:`, `---:`). O alinhamento usa `<div align="…">` e age **só nas linhas
  selecionadas**; **Reparar alinhamentos** conserta documentos antigos.

## Desenho assistido (prancheta)

- *Desenhar* cria a imagem e abre o canvas embutido no preview, sem popup.
- A caneta reconhece traços tortos e corrige linhas, retângulos, elipses/círculos e polígonos;
  também encaixa alinhamentos. Formas, texto, cores, seleção/mover, borracha e desfazer/refazer.
- **Mover e copiar objetos**: **⌖ Selecionar** move com ímã de alinhamento; **Alt+arrastar**
  copia, **Ctrl+C/Ctrl+V** cola, **Ctrl+D** duplica e as **setas** ajustam fino (Shift = 10px).
- **Zoom** de 50% a 300% (barra **− / % / +** e **Ctrl + roda**), com cliques/traços precisos.
- Cada desenho é **PNG 2x** em `assets/` com um sidecar JSON para edição posterior.

## Desenho em letras e símbolos

- No menu **▾** ao lado de *Desenhar* você escolhe **Imagem (PNG)** ou **Letras e símbolos**:
  tudo é desenhado numa grade de caracteres — caixas (`┌─┐│└┘`), linhas, textos, **campos
  selecionáveis** `[ ]` e **tabelas**, com traço simples, duplo (`╔═╗`) ou ASCII (`+| -`).
- **Modelos prontos** (Caixa com título e campo, Fluxo A ▶ B, Tabela 3 × 2) com um clique.
- **Apagar fácil**: arrastar marcando uma área e **Del**; botão direito (ou borracha) apaga
  só o trecho; **Remover** apaga o desenho inteiro.
- **Tempo real (ida e volta)**: o bloco ` ```text ` é atualizado no editor à esquerda na hora,
  e editar o bloco no editor recarrega o quadro — *Concluir* nunca sobrescreve o que você escreveu.

## Diagramas

- **Construtor "quase desenhado"** (◈): escolha o tipo (Fluxo / Sequência / Estados) e preencha
  os campos — ou **clique direto no diagrama** para adicionar passo, decisão e fim; apagar um
  passo do meio religa o fluxo. Também dá para escrever o código Mermaid à mão.

## Escrita assistida (português, offline)

- **Assistente de escrita**: sublinha em **vermelho** palavras fora do dicionário pt-BR e em
  **amarelo** problemas de estilo/gramática (abreviações de internet, palavras grudadas,
  repetições, pontuação, frase começando em minúscula…). **Clique na palavra** para ver
  sugestões e sinônimos; nos avisos de estilo (ex.: **frase muito comprida**) o popup mostra o
  trecho **já corrigido** — a frase quebrada, a vírgula que falta — para aplicar num clique, e
  **“Ignorar neste texto”** dispensa aquele aviso só neste documento. **Revisar texto** (`F7`)
  agrupa os avisos, estatísticas e **“Corrigir tudo (estilo)”**; dicionário pessoal e
  “ignorar palavra”.
- **Correção automática** (liga/desliga): palavras erradas com certeza, maiúsculas, espaços,
  pontuação repetida (inclusive **“....” → “...”**: reticências são três pontos) e abreviações
  entram sozinhas ao pausar; ao **terminar o parágrafo** o parágrafo ganha ponto/vírgulas; ao
  **salvar**, o documento é revisado. Cada correção é um passo único de `Ctrl+Z` — e **desfazer
  ensina**: a troca desfeita volta a ser só sugestão.
- **Ponto e vírgula automáticos**: ponto final no fim do parágrafo, vírgula antes de
  “mas/porém/contudo…”, depois de conectivos que abrem a frase e depois das **aberturas
  adverbiais** (“Com o tempo,”, “Hoje em dia,”, “No começo,”…) — inclusive quando elas
  **retomam a oração** no meio de um trecho (“…revisar hoje em dia, eu quero…”). Trechos de
  25+ palavras sem pontuação viram uma **sugestão de quebra** antes do pronome-sujeito
  (“…de verdade → . Eu resolvi…”), aplicável pelo **“Corrigir tudo (estilo)”**.
- **Trecho longo: “Dividir:” e “Encurtar:”**: quando não há pronome para quebrar, o aviso oferece
  **divisores** (vírgula antes de “porque”/“se”/“quando”…, “e” com sujeito novo, depois de “hoje em
  dia”…) — inclusive as quebras que outras regras já acharam (“…detalhado. E oira…”). Junto vêm
  até **três trocas que encurtam** o trecho mantendo o nexo (“ser capaz de” → “poder”,
  “posteriormente” → “depois”, “fazer uso de” → “usar”). Cada chip mostra o resultado e aplica num
  clique; a faixa do aviso cobre a **frase inteira** e, quando o aviso do seu perfil (“Frase de N
  palavras”) fala da mesma frase, os dois viram **um aviso só**.
- **Modo formal**: “pra/tá/a gente” → linguagem formal, com o verbo ajustado pela frase
  (“a gente vai” → “nós vamos”); modo **informal** e **neutro** também disponíveis.
- **Formalidade por classe + MIP**: o catálogo informal → formal tem 75 padrões por classe
  (internetês, contração, muleta, gíria, oralidade, atenuação, redundância e vagueza) — com o
  que **corrige sozinho** (“pra → para”, “vc → você”, “subir para cima → subir”) separado do
  que **só sugere** (“acho que” → “considera-se que”/“entende-se que”, “coisa” →
  “item/elemento/aspecto”), cada sugestão com o risco. As **frases** ganham janelas de contexto
  (“a gente vê que” → “nós vemos”/“vê-se que”; “Aí eu fui” → “Então, eu”/“Em seguida, eu”;
  “então” repetido; “há três anos atrás” → “há três anos”), sem tocar citação (`>`), código,
  URL, sigla ou e-mail. O painel de revisão mostra o **MIP** — marcadores informais por 1.000
  palavras — antes e depois das correções seguras, por classe, com o trecho de cada marcador.
- **Citações ABNT (NBR 10520:2023)**: além da tipografia (horas, unidades, meses, “et al.”,
  “p.”, travessão e latim), o revisor confere citações — acusa a autor-data **sem o ano**
  (“(Silva)”; só sobrenomes comuns, em caixa mista, para “(Anexo)”, “(Brasil)”, leis e siglas
  passarem), a **direta entre aspas sem a página** (“…texto” (Silva, 2020)), a **direta longa
  com aspas** (mais de 3 linhas: em texto corrido deve virar bloco; no bloco `>`, as aspas saem)
  e o **ponto final duplicado** (“…. (Silva, 2020).” → um ponto só, o de fora), este com
  correção automática. As conferências que não sabem a correção (ano, página) avisam sem
  sugerir troca.
- **Espaço esquecido** e **“Você quis dizer…?”**: palavras coladas viram duas; palavras a uma
  letra de uma comum ganham sugestão.
- **Conferência ABNT de sumário e numeração**: com um **SUMÁRIO** no texto, o assistente compara
  as entradas com os títulos — falta uma subseção? sobrou uma entrada? a ordem está trocada? um
  pré-textual como RESUMO está listado? — e confere a **numeração progressiva**: "3" → "3.1", e um
  "1.2" que não continua o "3" é acusado. O aviso de **subseção única** ("2 METODOLOGIA" com só
  uma "2.1") é sugestão de forma; nada disso é corrigido sozinho.
- **Conferência ABNT do resumo e abstract**: com um **RESUMO** no texto, o assistente conta as
  palavras do resumo — a faixa é **150–500**, e o aviso diz quantas contou —, cobra o
  **ABSTRACT** (e o texto nele) e o rótulo **“Palavras-chave:”** (no plural e com dois-pontos)
  e acusa citação autor-data (“(Silva, 2020)”) dentro do resumo — resumo não leva citação.
  Nada disso é corrigido sozinho.
- **“Formatar texto”** (comando): varredura automática de pontuação com ritmo aprendido.

## Sugestões enquanto você digita

- A continuação aparece em cinza depois do cursor: **Tab** aceita tudo, **Alt+→** palavra por
  palavra, **Alt+↓/↑** alternam até 3 opções e **Esc** descarta. Vem de três fontes: modelo
  do português embutido, o próprio documento e uma memória dos seus textos recentes.
- **IA ajuda nas sugestões** (Configurações): numa pausa, a IA local escolhe entre candidatos
  o que combina com a frase — só para completar palavra e só quando tem confiança.
- **Aprende com você**: aceitar e recusar ajustam a confiança — recusar uma correção do
  fantasma (digitando por cima ou com `Esc`) também conta —, e o corretor reconhece **classes
  de erro** (transposição, tecla vizinha, acento, dígrafo) para acertar antes de conhecer o par
  exato. Há um **perfil do seu estilo** e um **modo de intensidade** (discreta, equilibrada,
  agressiva).

## Revisão inteligente e IA local

- **Revisão inteligente** (Ctrl+K): analisa o documento e propõe trocas para palavras repetidas
  demais, **na mesma forma** (tempo, plural, gênero), com **diff** e **o porquê**; só propõe
  com contexto e nada muda sem aceitar. Roda em fatias, numa thread, com o computador parado.
- **IA local (Gemma 3 270M, embutida)**: confere cada troca (pontua a frase com e sem) e
  descarta as que pioram o texto. Roda **só na GPU** (WebGPU), sai da memória depois de 90 s
  sem uso; sem GPU, tudo continua funcionando com as regras.

## Tradução automática

- **PT-BR → inglês** (`Ctrl+Alt+T`): pré-visualização lado a lado (ou só um idioma), o inglês
  acompanha o que você digita e só os trechos alterados são traduzidos de novo (memória local).
  Código, links, imagens, tabelas e diagramas ficam intactos; **glossário** em Ajustes.
- Dois motores: **online grátis** (MyMemory) e **offline** (modelo ≈120 MB baixado uma vez);
  no automático, se o limite do online acabar, passa para o offline.

## Exportar e IA

- **Exportar** (`Ctrl+Shift+E`): página web, PDF, Word (.docx), Markdown, texto, **pacote para
  IA** (.zip) ou **copiar formatado** — em português, inglês ou os dois (bilíngue em colunas).
- **Pacote IA (.zip)**: Markdown + imagens + JSONs dos desenhos + `INSTRUCOES_PARA_IA.md`.
- **Modelo IA**: esqueleto estruturado (Objetivo, Contexto, Requisitos, Formato) para pedir
  coisas à IA. **Copiar p/ IA**: copia o Markdown pronto e lembra de anexar as imagens.
- **Exportar HTML**: um arquivo só, com CSS embutido e imagens em base64.
