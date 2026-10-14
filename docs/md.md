# MD\* — o editor de Markdown

O motor original do app: escrever em Markdown com pré-visualização ao vivo, desenhar
dentro do documento e contar com uma escrita assistida de português que roda offline.

## Editor e pré-visualização

- Editor com **realce de sintaxe** (CodeMirror 6) e **pré-visualização ao vivo** lado a lado.
- **Coluna de escrita limitada** (`980px`, centralizada) para as linhas não ficarem gigantes
  em monitores largos — igual à pré-visualização. A divisória do meio acompanha o mouse 1:1;
  arrastada **para além do limite da direita**, fecha a pré-visualização (que volta em
  **Configurações → Aparência → Pré-visualização**).
- **Salvamento automático** a cada alteração, sem travar a interface — inclusive em documento
  aberto de uma **pasta de rede** (UNC/SMB), onde cada gravação pode levar segundos; a fila de
  salvamento não descarta alteração nenhuma (o que foi digitado durante a gravação entra na
  gravação seguinte). Barra de status com palavras/caracteres/linhas,
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
- **Zoom** de 50% a **800%** (barra **− / % / +** e **Ctrl + roda**, ancorado no ponteiro), com
  cliques/traços precisos: o quadro é pintado só no **pedaço à vista** — nítido em qualquer zoom.
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
- **Aprendizado do corretor (auto-cura)**: os pares que você aceita viram correção automática e as
  recusas descontam; os termos que você insiste em manter (**“Ignorar neste texto”**) entram
  sozinhos no **dicionário pessoal** — com histerese (3 sinais) e decaimento (meia-vida de 30 dias:
  costume antigo perde força e o termo fraco é esquecido). Em **Configurações ▸ Escrita** dá para
  ver a **precisão percebida**, os **avisos por 1.000 palavras**, os **termos que o app insiste em
  marcar** e os que **aprendeu** (clique para adicionar/esquecer) e **exportar/importar o
  aprendizado** num JSON pequeno, sem nenhum documento.
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
- **Formalidade por classe + MIP**: o catálogo informal → formal tem **94 padrões** por classe
  (internetês, contração, muleta, gíria, oralidade, atenuação, redundância, vagueza e **clichê**) — com o
  que **corrige sozinho** (“pra → para”, “vc → você”, “subir para cima → subir”, “nos dias de hoje →
  atualmente”) separado do que **só sugere** (“acho que” → “considera-se que”/“entende-se que”,
  “faz-se necessário” → “é necessário”), cada sugestão com o risco. As **frases** ganham janelas de
  contexto (“a gente vê que” → “nós vemos”/“vê-se que”; “Aí eu fui” → “Então, eu”/“Em seguida, eu”;
  “então” repetido; “há três anos atrás” → “há três anos”; **“vou estar enviando” → “enviarei”**,
  com os irregulares na tabela — “vamos estar fazendo” → “faremos”; e **“vou fazer”/“vamos enviar”**,
  que aponta a passiva “será feito”/“serão enviados” quando o complemento permitir discernir), sem
  tocar citação (`>`), código, URL, sigla ou e-mail. O painel de revisão mostra o **MIP** — marcadores
  informais por 1.000 palavras — antes e depois das correções seguras, por classe, com o trecho de
  cada marcador.
- **“Formalizar texto” com prévia** (`Ctrl+Alt+F`, no menu Escrever ou no painel de revisão):
  pega a **seleção** — sem seleção, o documento inteiro — e abre **antes × depois** lado a lado,
  com o trecho trocado pintado (vermelho no antes, verde no depois) e o **MIP caindo ao vivo**.
  As **trocas seguras** já vêm marcadas; as que **dependem do sentido** esperam a decisão, com o
  risco no tooltip e as alternativas em chips (“a gente analisou” → “Nós analisamos” **ou**
  “analisou-se”); avisos sem troca pronta (“sei lá…”) só informam. Aplicar é **uma transação só**:
  Ctrl+Z desfaz tudo de uma vez.
- **Citações ABNT (NBR 10520:2023)**: além da tipografia (horas, unidades, meses, “et al.”,
  “p.”, travessão e latim), o revisor confere citações — acusa a autor-data **sem o ano**
  (“(Silva)”; só sobrenomes comuns, em caixa mista, para “(Anexo)”, “(Brasil)”, leis e siglas
  passarem), a **direta entre aspas sem a página** (“…texto” (Silva, 2020)), a **direta longa
  com aspas** (mais de 3 linhas: em texto corrido deve virar bloco; no bloco `>`, as aspas saem)
  e o **ponto final duplicado** (“…. (Silva, 2020).” → um ponto só, o de fora), este com
  correção automática. As conferências que não sabem a correção (ano, página) avisam sem
  sugerir troca.
- **Normas ABNT em tabelas, figuras e listas**: avisos de estrutura no texto — a tabela pede a
  identificação e o título acima ("Tabela 1 – …") e **"Fonte:"** abaixo (normas do IBGE); a
  figura pede a legenda acima ("Figura 1 – …") e a fonte abaixo quando não é de autoria própria;
  e as listas pré-textuais (de figuras, de tabelas e de siglas) só podem conter itens que
  existem — lista vazia, item apontando para uma figura/tabela que o documento não tem ou sigla
  que não é usada no texto são avisados. O aviso de fonte ausente **não sugere a troca**: a
  máquina não conhece a autoria.
- **Conferência ABNT das referências (NBR 6023)**: no bloco **REFERÊNCIAS**, oito regras
  (**R03–R10**) conferem a **forma de cada tipo** — livro sem local/editora, capítulo sem
  “In:”, artigo sem o título do periódico ou sem as páginas, site sem “Acesso em: data”, lei
  sem o órgão emissor, tese/dissertação sem instituição ou ano, evento sem ano e patente sem o
  número do registro. O dado que falta não é conhecido, então esses avisos **apontam o que
  completar, sem troca automática** — e só aparecem com marca forte do tipo (não valem em cima
  de dúvida).
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
- **Avisos de ABNT**: as regras das normas entram no mesmo painel de revisão. Nas referências
  (NBR 6023:2025), a **lista é conferida como um todo**: se ela existe (o aviso aponta o fim do
  trabalho, onde ela entraria, e só quando o documento se comporta como trabalho — tem citação
  ou elemento como resumo/sumário); se está em **ordem alfabética** pela chave do primeiro
  sobrenome/entidade (SANTOS antes de SILVA; acento e caixa não decidem a ordem); se cada
  **citação autor-data** tem entrada na lista (a narrativa “Silva (2020)” também conta; sigla,
  SOBRENOME composto e “et al.” casam por palavra; citação repetida vira um aviso só); e se o
  **destaque do título** é uniforme (sugestão, só quando a lista mistura negrito/itálico com
  entradas sem destaque). São avisos de conferência — nenhum corrige o texto sozinho.

## Sugestões enquanto você digita

- A continuação aparece em cinza depois do cursor: **Tab** aceita tudo, **Alt+→** palavra por
  palavra, **Alt+↓/↑** alternam até 3 opções e **Esc** descarta. Vem de três fontes: modelo
  do português embutido, o próprio documento e uma memória dos seus textos recentes. O modelo
  embutido é feito de **contagens** de palavras e sequências (1–3 palavras) de um corpus da
  **Wikipédia em português** (CC BY-SA 4.0) — nenhum trecho de texto é copiado para o app, e o
  corpus pode ser refeito com `scripts/baixar-corpus.mjs` + `scripts/build-ngrams.mjs`.
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
