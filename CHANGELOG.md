# Changelog — mdOffice

Tudo que é feito no app entra aqui, **na categoria que mexeu**, dividido entre **Backend**
(`src-tauri/`, Rust) e **Frontend** (`src/`, TypeScript). O "porquê" técnico de cada mudança
de linha fica no [histórico técnico](docs/historico-tecnico.md).

## Regras

- **Não adicionado** = trabalho que **ainda não está na `main`** (worktree aberta, PR não
  integrado). É onde toda tarefa nasce.
- **Adicionado** = está na `main`. **Só entra aqui o que foi integrado na `main`** — o que não
  entrou na `main` nunca é promovido.
- Ao fechar uma tarefa (`fechar.ps1`), mova a entrada de "Não adicionado" para "Adicionado"
  na mesma categoria (e no mesmo lado, backend/frontend) e registre o porquê no
  [histórico técnico](docs/historico-tecnico.md).
- A categoria **Geral** é o que vale para o app todo (abas, Início, histórico, backup,
  configurações) e também as **ferramentas do repositório** (worktrees).
- O `fechar.ps1` **bloqueia o fechamento** se a tarefa não tocar em `CHANGELOG.md` e
  `docs/historico-tecnico.md` (regra completa no [AGENTS.md](AGENTS.md)).

> Estado do "Não adicionado" conferido em **2026-10-14**.

---

## MD\*

### Não adicionado (fora da main)

**Backend**

- (nada no momento)

**Frontend**

- (nada no momento)

### Adicionado (na main)

**Backend**

- (nada específico do módulo — arquivos, imagens e rascunhos passam pelos comandos do **Geral**)

**Frontend**

- **O corretor passou a DECIDIR antes de mexer (e nunca "conserta" o informal)**: o relato era
  uma correção sem sentido aplicada sozinha ao parar de digitar (print "esc … r"). Agora
  **texto sem acento por escolha** (informal, áudio transcrito) não recebe **nenhuma** alteração
  automática — nem acento, nem vírgula, nem maiúscula; o aviso continua e a ação explícita
  resolve. **Gíria e registro** ("pra", "tá", "a gente", "pq") saíram da varredura automática:
  ficam como sugestão. **Ponto final só quando o parágrafo acabou de verdade**: pausar no fim
  da linha em que você está não fecha mais a frase (era daí que saíam os pontos no meio da
  frase e as maiúsculas seguintes); **vírgulas opinativas** (antes de "enquanto"/"como") e
  **trocas de palavra por contexto** ("mão" × "não") também ficaram só como sugestão. A
  ortografia parou de chutar acento: variante desempatada pelo uso
  ("pao" → "pão", não "paó"), plural do verbo sem sujeito ("mantém"/"mantêm") e homógrafos
  ("bebe"/"bebê", "valido"/"válido") viram sugestão, e depois de auxiliar ("tinha valido") não
  se acentua como adjetivo. O comando **"Formatar texto" virou correção formal estrita**:
  restaura acentos/cedilha, insere pontuação, acerta espaçamento e maiúsculas em quantas
  rodadas precisar, preserva parágrafos e **não troca palavras** (mesmas letras, mesmo número
  de palavras). Novo **log de decisões** (`?diag=1` ou `__mdofficeDiag.ligar()`): painel
  flutuante com o que foi detectado/aplicado/ignorado, o motivo e o trecho, em JSONL
  (copiar/baixar). Medido com corpus novo de pares formal/informal (96 mil palavras em duas
  rodadas de 6 autores — a segunda com textos inéditos, `tests/escrita/rodada-1` e `rodada-2`):
  **zero** alteração automática em ~270 mil pausas simuladas (cada fronteira e o meio de cada
  palavra), **zero** troca/remoção/reordenação de palavra na correção formal, parágrafos
  preservados em 12/12 pares, **zero** acento divergente do gabarito e 92–96% dos acentos
  restaurados (os que faltam são ambíguos por sentido: "sai"/"saí", "as"/"às", "avó"/"avô").
  Teste: `node scripts/testar-escrita.mjs`.

- **Colar imagem no Markdown voltou a funcionar (inclusive print do Windows)**: o colar lia só
  `clipboardData.files`; no WebView2 a imagem às vezes chega só em `items` ou apenas pela área de
  transferência rica, e o evento era ignorado sem aviso. Agora lê as três formas (com
  `clipboard.read` de reserva), captura o evento no documento (o CodeMirror podia consumi-lo
  antes) e registra no diagnóstico (`?diag=1`) o que veio no colar — tipos, arquivos e itens —
  para diagnosticar qualquer variação da área de transferência.
- **A sugestão enquanto você digita ganhou uma decisão calibrada (e ficou mais rápida)**: o
  texto fantasma aparecia por limiares fixos (0,45 / 0,6 / 0,8…) sobre a probabilidade
  **normalizada entre candidatas**, que não é a chance de acertar — cada ajuste trocava precisão
  por cobertura (o relato: "toda vez que tento arrumar fica pior"; "sugere uma ou duas palavras a
  cada 12 palavras"). Agora a decisão é **P(acertar) calibrada** (regressão logística ajustada em
  `scripts/calibrar-ghost.mts`, no fluxo de digitação) **× teclas poupadas ≥ custo do erro**, com
  piso por modo. Medido em `scripts/corpus-wikipedia.txt`: **92,7% de acerto** (era 85,7%),
  **20,2% de economia** (era 20,9%) e 5,2% de cobertura no mesmo ponto de precisão — e a **próxima
  palavra** e a corrente seguem a regra antiga (a calibração não se sustenta nelas). O aprendizado
  do uso passou a mexer **no máximo ±25%** (antes multiplicava a probabilidade e as recusas
  faziam a sugestão sumir) e a previsão espera **45 ms** (era 90 ms) — com a previsão custando
  menos de 1 ms, a sugestão acompanha a digitação em vez de só aparecer nas pausas. Teste:
  `npm run test:ghost` (régua em população fixa, independente do modelo) e o novo
  `scripts/calibrar-ghost.mts`.

- **A sugestão de "troca por contexto" não manda mais um nome próprio no lugar de uma palavra**: em
  "caso **aja** divergência" o app perguntava se você queria **"Ana"** — a variante de tecla vizinha
  "ana" existe no corpus como nome próprio, e o nome, por ser frequente, batia a correção certa.
  Agora a mesma frase oferece **"haja"**, e um nome próprio só é cotado quando a palavra escrita já
  está com maiúscula (`Aja` continua podendo virar `Ana`). Medido no navegador com o texto do
  relato: a marca de "aja" passou de "contexto pede **Ana**?" para "contexto pede **haja**?".
  Teste: `npm run test:correcao`.

- **O cartão de sugestão da escrita não some mais ao rolar**: o popup do corretor fechava a cada
  rolagem do texto (o código dizia "as posições mudam") — a pessoa perdia a mensagem no meio da
  leitura ("some a cada movimento", com print). Agora ele **acompanha o trecho** (reposicionado por
  quadro, com `coordsAtPos`, também ao redimensionar a janela) e só fecha quando o trecho sai da
  janela do editor, quando o **texto muda** (a correção pendente aplicaria sobre outro texto) ou ao
  clicar fora. Teste: `npm run test:layout` (3 checagens: o acompanhar ao rolar, o resize e o
  fechar ao mudar o texto).

- **Prancheta de letras: botão direito + arrastar move a tela**: no zoom alto, andar pelo desenho
  dependia da barra de rolagem. Agora **segurar o botão direito e arrastar** move a tela
  (panorama), com o cursor "agarrando" enquanto o arrasto dura — e o **clique parado continua
  apagando** a linha/rótulo sob o cursor (o arrasto é consumido antes do menu de contexto; uma
  zona morta de 3 px separa o clique tremido do arrasto). É o mesmo gesto do palco do PowerPoint,
  e a dica do rodapé da prancheta passou a explicar os dois casos.

- **A sugestão enquanto você digita agora aparece certa**: o texto fantasma mostrava **muita
  sugestão errada** — medido no `scripts/eval-ghost.mts` (o avaliador do próprio repositório, com
  o modelo de idioma real), a base antiga acertava **49%** do que mostrava. Os limiares de
  confiança subiram (completar palavra e próxima palavra) e o mínimo de letras poupadas foi de 3
  para 4: a mesma medição sobe para **~74% de acerto**, ainda economizando **~9%** das teclas —
  mostra menos e mostra certo. Os **modos de intensidade** continuam valendo (discreta ~94%,
  equilibrada ~74%, agressiva ~61%), agora com um **teto** no limiar para o modo discreto não
  ficar mudo com a base mais exigente. A **correção do que foi digitado** ("noçao" → "noção")
  segue intacta — ela vem antes de qualquer previsão. Novo `test:ghost` prende a precisão e a
  economia no corpus de teste.

- **F4 — auto-cura do conhecimento do corretor**: os termos que você já disse que estão certos
  ("Ignorar neste texto") ganham **histerese** (nada de promover de primeira: com 3 sinais o app
  adiciona a palavra ao **dicionário pessoal sozinho** e avisa) e **decaimento** (meia-vida de 30
  dias: um costume antigo perde força, e o que ficou fraco é esquecido na compactação). Em
  **Configurações ▸ Escrita ▸ Aprendizado**: **precisão percebida** (correções automáticas
  mantidas), **avisos por 1.000 palavras**, a lista de **"termos que o app insiste em marcar"**
  (clique para adicionar) e a dos **termos aprendidos** (clique para esquecer). E **exportar/
  importar o aprendizado** num JSON pequeno (trocas, classes de erro, termos, métricas e o
  dicionário pessoal — nenhum documento entra nele).
- **Avisos de estilo com a correção pronta no popup**: clicar num aviso como **"Frase muito
  comprida"** agora mostra o trecho **já corrigido** ("… do novo projeto. E combinamos de …") com
  um clique para aplicar - antes o popup só dizia "comece nova frase aqui". Nesses avisos os botões
  de dicionário ("Ignorar palavra", "Adicionar ao dicionário") dão lugar a **"Ignorar neste
  texto"**, que dispensa o aviso somente naquele documento (nos outros ele continua).

- **Exportador Markdown → .docx não arrasta mais a interface**: o import de
  `renderMermaidInto` era feito pelo índice `./diagram`, que reexporta o construtor de
  diagramas — e o construtor puxa o seletor, que registra listeners de `document` na carga
  do módulo. O exportador passou a carregar a UI inteira junto: no app é só peso, mas o
  teste que valida o `.docx` gerado (roda no Node, sem DOM) quebrava com `document is not
  defined`. Agora o import é direto de `./diagram/mermaid`. Nenhuma mudança de
  comportamento: o export só deixou de depender de código de tela.

- **Regras ABNT de estrutura (E01–E03 e P01)**: o motor passou a conferir o trabalho pela
  estrutura que as normas cobram, e não só pela tipografia. **E01** cobra os elementos
  pré-textuais obrigatórios (resumo, abstract e sumário — NBR 14724:2024); **E02** confere a
  ordem pré-textuais → textuais → pós-textuais (o caso clássico: referências antes da
  conclusão); **E03** cobra as partes da estrutura textual (introdução, desenvolvimento e
  conclusão); e **P01** cobra as seções do projeto de pesquisa (introdução, objetivos,
  metodologia e cronograma — NBR 15287:2025). Os dois verificadores são genéricos
  (`secoes-obrigatorias` e `secoes-em-ordem`), parametrizados pelos TOMLs; o aviso de
  ausência ancora no fim do documento e explica por que a regra falou — o verificador só age
  quando o documento tem **cara de trabalho** (ao menos dois elementos reconhecidos e um
  indício de corpo do texto), para um texto qualquer não virar "TCC sem resumo".

- **Regras ABNT do sumário e da numeração (S01–S04)**: o motor de estrutura agora compara o
  **sumário** com os títulos do texto — subseção que falta, entrada sobrando, ordem trocada e
  pré-textuais listados (RESUMO, LISTAS…) — e confere a **numeração progressiva**: a subseção
  continua o número da seção superior ("3" → "3.1", nunca "1.2" depois de "3") e não desce mais
  níveis do que a estrutura de títulos alcança. Fecha com o aviso de **subseção única**
  ("2 METODOLOGIA" com uma só "2.1"), que é **sugestão de forma**, nunca automática. O sumário
  em Markdown é aceito como lista com numeração, destaque, link e pontilhado de página; nada
  disso é corrigido sozinho — a máquina não sabe qual seção o autor quis dizer.

- **Motor ABNT — contexto de documento e regras de estrutura**: o motor sabia conferir
  padrão de texto, mas não sabia *onde* no documento — e as normas cobram exatamente isso
  ("a lista de referências existe", "o sumário bate com os títulos", "o resumo tem
  150–500 palavras"). Agora a regra pode declarar **escopo de bloco** (`referencias`,
  `resumo`, `sumário`, listas…) ou **tipo "estrutura"**, que delega a um verificador com o
  modelo do documento na mão (títulos, parágrafos, linhas tipadas, contagem de palavras).
  Regra de conferência também passou a existir: quando a correção não é conhecida
  ("complete os dados da referência"), o aviso sai sem sugestão, em vez de obrigar a
  inventar uma troca. É a base das 31 regras restantes do catálogo (grupos E, C, R, S, A,
  P e T) e vem com o contrato escrito em `docs/abnt-como-escrever-regras.md`.

- **Motor ABNT — resumo e abstract (E09, E10, A01–A03)**: as primeiras regras que usam o
  motor novo, todas de conferência (nenhuma troca automática). **E09/A01** são o mesmo exame
  declarado duas vezes — a extensão do resumo fora da faixa de **150–500 palavras**, contada
  no bloco RESUMO e dita no aviso (a linha “Palavras-chave:” não entra na conta) —, uma vez
  sob a NBR 14724:2024 e outra sob a NBR 6028:2021. **E10** cobra o **ABSTRACT** quando o
  trabalho tem RESUMO e não tem o resumo em língua estrangeira (título sem texto também
  acusa); **A02** cobra o rótulo **“Palavras-chave:”** (plural e dois-pontos incluídos) e
  **A03** acusa citação autor-data — “(Silva, 2020)” — dentro do resumo. Os avisos de
  ausência ancoram no fim do resumo, onde o elemento entraria, e sem RESUMO no documento as
  regras são silêncio (quem cobra o resumo é a regra de estrutura).

- **Motor ABNT — forma de cada tipo de referência (NBR 6023:2025)**: as referências passam a
  ser conferidas **por tipo** — **livro** (local e editora), **capítulo** ("In:" com a obra
  completa), **artigo** (título do periódico antes de "v./n." e as páginas), **site**
  ("Disponível em" e "Acesso em: data"), **lei** (órgão emissor), **tese/dissertação**
  (instituição e ano), **evento** (ano) e **patente** (número do registro). São as oito regras
  **R03–R10**, de **conferência**: o dado que falta a máquina não conhece, então o aviso sai
  **sem sugestão de troca** — ele diz o que completar. Cada regra só acusa com marca forte do
  tipo (páginas da parte ou um segundo autor no capítulo, "In:" + Anais no evento, campo da
  patente…) e fica quieta na dúvida; cada teste tem **os dois lados** — a entrada que acusa e a
  referência **completa** do mesmo tipo, que não pode acusar —, e uma **bibliografia com uma
  referência completa de cada tipo** sai sem nenhum aviso.

- **Motor ABNT — validação do `.docx` exportado (E04–E08 e E12)**: margem, fonte, entrelinha,
  papel, paginação e quebra de seção não existem no Markdown — só no arquivo final. O motor ganhou
  o validador que **abre o `.docx` exportado** (JSZip + varredura do XML, sem UI e sem depender do
  exportador) e roda seis regras declaradas em TOML (`tipo = "docx"`, em `src/md/regras-docx/`):
  margens 3-2-3-2 (`w:pgMar`), Arial/Times 12 pt (`w:rFonts`/`w:sz`), entrelinha 1,5 (`w:spacing`),
  papel A4 (`w:pgSz`), paginação a partir da introdução (`w:pgNumType`/campo PAGE) e seção primária
  em página nova (quebras/`w:sectPr`). As duas últimas são de confiança média e entram como
  **sugestão**; o validador só acusa a ausência total de paginação, não a posição do número.
  O teste (`npm run test:abnt-docx`) monta `.docx` à mão com os dois lados de cada regra e registra
  o que os exportadores de hoje violam: o export do Markdown sai com margens de 2 cm, Calibri 11,
  entrelinha 1,25, sem paginação e sem quebra entre seções primárias; o export da sessão Word, no
  setup padrão, com margens superior/base de 2,5 cm, Calibri 11, entrelinha 1,15 e sem quebra
  (configurado em ABNT, o mesmo exportador não acusa nada).

- **Citações ABNT — C01, C03, C04 e C06 (NBR 10520:2023)**: as conferências de citação que
  faltavam do catálogo. **C01** acusa a citação autor-data entre parênteses **sem o ano**
  ("(Silva)") — o critério é apertado de propósito (lista fechada de sobrenomes em caixa mista):
  "(Anexo)", "(Brasil)", leis e siglas passam em paz. **C03** acusa a **citação direta entre
  aspas sem a página** ("…texto" (Silva, 2020)). **C04** acusa a **citação direta longa (mais de
  3 linhas) com aspas** — em texto corrido (deve virar bloco `>`) ou dentro do bloco (as aspas
  saem; recuo de 4 cm, fonte menor e espaço simples). **C06** acusa o **ponto final duplicado**
  (“…. (Silva, 2020).” → um ponto só, o de fora) e corrige — as demais acusam sem sugerir troca
  (o ano e a página são desconhecidos). C01/C03/C06 são regras declaradas em TOML; C04 é
  verificador do documento; teste próprio com os dois lados em `scripts/testar-abnt-citacoes.mts`.

- **ABNT em tabelas, figuras e listas (T01, T02 e E11)**: três verificadores novos no motor
  ABNT. A **tabela** pede a identificação e o título na linha imediatamente acima ("Tabela 1 –
  …") e a **fonte logo abaixo** ("Fonte: …", normas do IBGE); a **figura** pede a legenda acima
  ("Figura 1 – …") e a fonte abaixo quando não é de autoria própria. Os avisos apontam a linha
  onde o título e a fonte entram e **não sugerem a troca**: a máquina não conhece a autoria
  (fonte de terceiros é o caso comum). As **listas pré-textuais** (de figuras, de tabelas e de
  siglas) são conferidas contra o documento: lista sem nenhum item e item que aponta para uma
  figura/tabela que não existe — ou sigla que não é usada no texto — são avisados, porque a
  lista só pode conter os itens que existem.

- **Lista de referências conferida de ponta a ponta (ABNT NBR 6023:2025)**: quatro avisos novos
  no painel de revisão, olhando a lista como um todo. **R01** — a lista existe (o aviso sai no
  fim do trabalho, onde ela entraria, e só quando o documento se comporta como trabalho: tem
  citação autor-data ou elemento como resumo/sumário). **R02** — ordem alfabética pela chave do
  primeiro sobrenome/entidade, comparada pelo `Intl.Collator("pt-BR")` (acento e caixa não
  decidem a ordem) e com o ponteiro na entrada que fura. **R11** — cruzamento citação ↔
  referência: toda citação autor-data (inclusive a narrativa, "Silva (2020)") precisa de entrada
  com o mesmo ano; o casamento é folgado de propósito (sigla, SOBRENOME composto e "et al."
  casam por palavra) e a citação repetida vira um aviso só. **R12** — destaque tipográfico
  uniforme: **sugestão**, nunca automática, e só quando a lista mistura entradas com e sem
  negrito/itálico no título. Nenhuma das quatro corrige o texto sozinha.
- **Prancheta com zoom até 800%**: o zoom do quadro de desenho e do de letras parava em 300% — e
  acima disso borraria, porque o canvas guardava o quadro inteiro num buffer limitado a 3×. Agora
  vai a **800% com o traço nítido**: o canvas pinta só a **janela visível** (a "folha" é o quadro
  inteiro e dá a rolagem; o pedaço à vista é pintado na resolução da tela). Os passos do zoom
  crescem no alto (25% até 200%, 50% até 400%, 1× daí em diante — 800% em 12 cliques) e o zoom
  **ancora no ponteiro** (Ctrl+roda) ou no centro da janela (botões −/+): o ponto que você está
  olhando fica onde está. O quadro embutido no documento também rola de verdade (antes o excesso
  era cortado).

- **Popup do aviso com diff colorido**: a correção mostra o que **sai** em vermelho riscado e o
  que **entra** em verde — nos chips "Trocar por" (palavra → sugestão) e "Corrigir" (o trecho com
  a troca destacada, ficando neutro o que não muda).
- Editor CodeMirror 6 com realce de sintaxe e pré-visualização ao vivo lado a lado.
- **Seleção de texto sem pintura dupla**: o destaque da linha do cursor só aparece com a
  seleção vazia — antes ele caía por cima da seleção e parecia "duas coisas selecionadas".
- **Botão Desenhar** como ação principal: dividido (desenhar + tipo de desenho), sólido no
  acento, ícone de caneta desenhando, divisor que acompanha o tema e estados de hover/active/foco.
- Coluna de escrita limitada e centralizada, com a divisória acompanhando o mouse 1:1.
- Salvamento automático a cada alteração, barra de status (palavras/caracteres/linhas).
- **Desenho assistido (prancheta)**: caneta que reconhece e corrige traços, formas, texto,
  cores, seleção/mover com ímã, Alt+arrastar para copiar, zoom 50–300%, PNG 2x + sidecar JSON.
- **Desenho em letras e símbolos**: grade de caracteres (caixas, linhas, campos `[ ]`,
  tabelas), modelos prontos, apagar por área, ida e volta em tempo real com o bloco ` ```text `.
- **Construtor de diagramas Mermaid** (assistente visual com clique no diagrama).
- **Formatação estilo Word no Markdown**: alinhamento (`<div align>`), destaque, alinhamento
  de tabelas e “Reparar alinhamentos”.
- **Imagens**: inserir, colar (`Ctrl+V`) ou arrastar, com cópia para `assets/` e nome limpo.
- **Rascunhos** na pasta do app com restauração automática ao reabrir; migração para a pasta
  do usuário no “Salvar como”.
- Campos de tarefa clicáveis na pré-visualização.
- **Busca no conteúdo** (projetos e abas abertas).
- **Corretor de português offline**: sublinhados vermelho/amarelo, sugestões e sinônimos ao
  clicar, `F7` (revisar), “Corrigir tudo (estilo)”, dicionário pessoal e ignorar palavra.
- **Palavra que o dicionário aceita e ninguém escreve**: o dicionário conhece muita forma que
  não é usada — "oira" é do verbo "oirar" — e aí nada era acusado, mesmo com a pessoa querendo
  escrever "o ira". Agora, quando a palavra não aparece no corpus de texto escrito, a família
  dela também não (nenhuma palavra do corpus começa igual) e ela é a palavrinha de uma letra
  colada na seguinte, o corretor pergunta **"faltou um espaço?"** e oferece o corte. É pergunta,
  não correção automática: fica na revisão com o botão "Corrigir", nunca sozinha no texto.
  Medido: **nenhuma acusação em 2803 palavras** de texto real do projeto.
  (A medida é contra o **corpus completo** de texto escrito — o `freq-pt.json`, que o worker já
  recebe. Com a lista curta de palavras frequentes, "aplicativo" não estava nela e virava
  "a plicativo".)
- **Acento pelo uso**: o dicionário aceita as duas formas — "ira" é raiva, "irá" é o verbo — e
  por isso nada era acusado. Agora, quando a forma escrita quase não aparece em texto escrito e a
  acentuada é muito mais usada, o corretor pergunta **"faltou o acento?"** ("ira" → "irá",
  "duvida" → "dúvida"). É pergunta, nunca correção sozinha: o acento troca o sentido. As medidas
  são as mesmas do "você quis dizer…" — a forma escrita tem de ser rara, a acentuada tem de ser
  bem mais usada e existir de verdade.
- **Regras ABNT em TOML**: as dez regras de norma e tipografia deixaram de ser funções no
  código e passaram a ser **dado** (`src/broker/abnt/regras/*.toml`), com **id estável**,
  **versão de norma** de cada uma e **perfil institucional** — por regra, `off` (a instituição
  não usa), `soft` (vira sugestão, nunca automática) ou `hard` (vira erro). É o `Config` do
  catálogo: as universidades divergem entre si, e a divergência passa a ser dado, não código.
  O schema é **fechado**: `\d`, `\s`, `\b` e os demais shorthands são recusados na carga (o
  significado muda de motor para motor), `<<classe>>` só vale dentro de `[ ]`, `{nome}` só vale
  como grupo nomeado do próprio regex. Um **teste de ouro** exige que as regras em TOML
  produzam exatamente os mesmos avisos que as dez funções antigas, em quatro famílias de caso
  (acento colado à borda, vizinhos, bordas do texto, match descartado ao lado de um válido).
  O texto agora é **normalizado (NFC + LF) antes das regras**, com o aviso voltando para a
  posição do original — texto colado do macOS ou de PDF vem em NFD, e nesse formato a regra das
  siglas errava o alvo e a troca **apagava a letra acentuada**. Medido: as dez regras sobre um
  TCC de 57 mil caracteres levam **1,8 ms** por verificação.
- **Correção automática**: palavras erradas com certeza, maiúsculas, espaços, pontuação,
  abreviações; ao terminar o parágrafo e ao salvar; cada correção é um passo de `Ctrl+Z`.
- **Ponto e vírgula automáticos** e **modo formal** (“a gente” com o verbo conjugado);
  espaços esquecidos e “Você quis dizer…?”.
- **Sugestões enquanto digita** (modelo de n-gramas + o próprio documento + memória local),
  com `Tab`/`Alt+→`/`Alt+↓`, modo de intensidade e aprendizado pelo uso.
- **IA local (Gemma 3 270M, WebGPU)** escolhendo sugestões e conferindo trocas da revisão.
- **Revisão inteligente**: repetições trocadas por sinônimos na mesma forma, com diff e porquê.
- **Tradução automática PT-BR → inglês** (lado a lado, memória local, glossário, motor online
  grátis e offline ≈120 MB).
- **Exportar**: HTML, PDF, Word, Markdown, texto, **Pacote IA** (.zip) e copiar formatado —
  em português, inglês ou bilíngue.
- **Modelo IA** e **Copiar p/ IA** para pedir coisas à IA com contexto.
- **Skills e regras**: janela que gera `SKILL.md`, `AGENTS.md` e `CLAUDE.md` a partir de modelos.
- **Divisória editor/prévia**: arrastar para além do limite da direita fecha a pré-visualização
  (saída suave e aviso de como reabrir); encostar no mínimo continua só redimensionando.
- **Puxar a pré-visualização de volta**: fechada a prévia, sobra uma faixa na **borda direita** —
  clicar traz a prévia de volta no tamanho em que estava e arrastar para a esquerda a aumenta,
  como se fosse o próprio divisor. Antes a única volta era Configurações ▸ Aparência. A faixa
  fica **fora** da área da barra de rolagem do editor, só existe com a prévia fechada e some nos
  painéis onde não há prévia (Word, Excel, PowerPoint, Configurações, Início e modo foco).
- **Vírgulas em trechos longos**: a correção automática passa a inserir a vírgula depois das
  **aberturas adverbiais** (“Com o tempo,”, “Hoje em dia,”, “No começo,”, “Atualmente,”…) e
  quando elas **retomam a oração** no meio de um trecho (“…revisar hoje em dia, eu quero…”).
  Trechos de **25+ palavras sem pontuação** agora ganham uma **sugestão de quebra** antes do
  pronome-sujeito (“…de verdade → . Eu resolvi…”), aplicável no “Corrigir tudo (estilo)” do
  `F7`. Guardas evitam o falso positivo de expressão com complemento (“No começo de tudo”,
  “Com o tempo livre” ficam sem vírgula). Antes, no texto típico, a varredura só aplicava
  maiúscula inicial e ponto final — nenhuma vírgula.
- **Reticências são três pontos**: o corretor agora acusa o "...." (quatro pontos) e corrige para
  "..." - antes o "...." era tratado como intencional e passava batido. A correção entra na
  varredura (na pausa, ao terminar o parágrafo e ao salvar) e o aviso mostra o trecho já
  corrigido; linhas pontilhadas longas (".....") continuam intactas.
- **Trecho longo com "Dividir:" e "Encurtar:"**: o aviso de trecho comprido deixou de ser beco sem
  saída — quando não há pronome para quebrar, ele agora oferece **divisores** (vírgula antes de
  "porque", "se", "quando"…, "e" com sujeito novo, depois de "hoje em dia"…) e **aproveita as
  quebras que outras regras já acharam** (". E deixará…"); junto vêm até **três trocas que
  encurtam** o trecho mantendo o nexo ("ser capaz de" → "poder", "posteriormente" → "depois",
  "fazer uso de" → "usar"). Cada chip mostra o resultado e aplica num clique; nada entra sozinho.
  Quando os dois avisos falam da MESMA frase (o do perfil — "Frase de 55 palavras" — e o do trecho
  sem pontuação), eles viram **um aviso só**.
- **A marca do aviso agora cobre a frase inteira**: o "Frase de 55 palavras" pintava só 40
  caracteres e o "trecho muito longo", 60 — a mensagem falava de uma coisa e a faixa amarela
  mostrava outra. Agora a faixa vai do começo ao fim da frase/trecho.
- **Seleção do app no construtor de diagramas e no desenho de letras**: tipo do diagrama, forma e
  conexões de cada linha e o estilo de traço trocam a lista cinza do sistema pelo menu do app; as
  opções que o construtor refaz na hora (próximo passo, de/para) continuam atualizando sozinhas.

---

## Word

### Não adicionado (fora da main)

**Backend**

- (nada no momento)

**Frontend**
- **A imagem parou de atrapalhar a escrita no Word**: um parágrafo com **entrelinha fixa** (1 ou um valor exato)
  e uma imagem **inline** grande ficava com a caixa da linha menor que a imagem — ela vazava por cima das linhas
  vizinhas e **capturava o clique**, então não dava para clicar/editar o texto embaixo. Agora parágrafo (e título)
  que contém imagem **não aplica a entrelinha fixa**: a linha cresce para caber a imagem, que continua inline e
  redimensionável; os demais parágrafos mantêm a entrelinha como estava. Trava: `npm run test:word-imagem`.


### Adicionado (na main)

**Backend**

- (nada específico do módulo — abrir/salvar passam pelos comandos do **Geral**)

**Frontend**

- **Clique direito numa imagem: "Excluir imagem" no menu**: o menu de contexto do Word (que já
  conhecia tabela) tratava a imagem como texto — abria desfazer/recortar/copiar/colar/selecionar
  tudo e **não havia como apagar a imagem** pelo caminho natural ("quando eu clico com o botão
  direito na imagem não aparece a opção de poder excluir ela"). Agora, com o clique sobre a imagem,
  o menu abre com **"Excluir imagem"** em primeiro — e o comando apaga o nó da imagem (o mesmo
  caminho do "Excluir tabela"). Os itens de texto continuam abaixo, para quem erra o alvo.
  Conferido no navegador: imagem inserida → clique direito → menu "Excluir imagem…" → clique → a
  imagem sai do documento. Teste: `npm run test:layout`.

- **Imagens no Word agora se movem e redimensionam**: clicar seleciona a imagem (8 alças nos
  cantos e lados); arrastar uma alça mantém a proporção e grava `width`/`height` no documento —
  o tamanho vai para o `.docx` e `Ctrl+Z` volta ao anterior. A alça pontilhada à esquerda
  arrasta a imagem para outro ponto do texto. Antes era só um `<img>` inline sem alça nenhuma.
- **A aba Layout ganhou o botão Tamanho — e o papel vai até A3/A2 (relato do usuário)**: o papel da
  folha só mudava no **Configurar Página**, num seletor com **A4 e Carta**; na aba **Layout** não
  havia botão para isso. Agora a aba tem **Tamanho ▾**, um menu com **A5, A4, A3, A2 e Carta**
  (cada um com as medidas em cm e o atual marcado) — a troca vale na hora para a folha inteira. O
  **Configurar Página** lista os cinco, e o papel escolhido vale na **folha**, na **impressão/PDF**
  (`@page size`) e no **`.docx`** exportado (as medidas da seção, em twips). Na importação, um
  `.docx` em A3 (ou A2/A5) passa a ser reconhecido pelo **tamanho mais próximo** em vez de cair
  sempre em A4/Carta.

- **O corretor não abre mais sugestão quando o clique cai numa imagem**: no print, a imagem estava
  selecionada e o popup do corretor abria com a sugestão de uma palavra ("Awdaw") — e no canto da
  página, longe dela. A imagem é **inline** (ocupa **uma** posição), então o fim da faixa da palavra
  é exatamente o começo da imagem: o clique na imagem "caía na palavra" e, pior, o popup ancorava no
  **parágrafo** inteiro. Agora o popup só abre quando o clique cai **no texto sublinhado** (nunca na
  imagem, no espaço da linha ou na margem) e a âncora é a **própria palavra**. E um problema que
  **atravessa** uma imagem ou uma quebra de linha fica sem sugestão — aplicar a correção substitui a
  faixa inteira e **apagaria a imagem**. Conferido no harness com o corretor real
  (`node scripts/harness-corretor.mjs`: clique na imagem "não abriu ✓", na palavra "abriu ✓", popup a
  **0 px** da palavra; com a regra antiga o harness acusa "ABRIU ✗"). Teste: `npm run test:corretor-word`.

- **A legenda do cartão de Estilo não sai mais do cartão (fita do Word)**: na galeria **Estilos**,
  o segundo texto de cada cartão ("Calibri Light, 16") era mais largo que o cartão quando a fita
  encolhia — com `--fita-e` em 0,81 o cartão ia a **65 px** (o piso era 64 px) e a legenda pedia
  **70 px**, então ela vazava e encostava no cartão vizinho (relato com print). Agora o **piso do
  cartão é 80 px** — o que a maior legenda atual ocupa —, e **nome e legenda são recortados**
  (`overflow: hidden` + reticências) para nenhum texto futuro vazar. O nome também deixou de ter um
  `max-width` fixo (86 px) maior que o cartão. A galeria continua rolando de lado normalmente.

- **O clique direito no Word abre o menu do app, não o do navegador — e a tabela tem "Excluir
  tabela"**: o `#word-pane` não tratava o `contextmenu`, então o WebView2 mostrava o menu nativo
  (**Emoji**, **Inspecionar**, **Direção da escrita**…, o print do usuário), que não conhece o
  documento. Agora o clique direito abre o **menu do app** no ponto clicado (o cursor vai para lá,
  como no nativo): com o cursor numa **tabela**, **"Excluir tabela" vem em primeiro**, seguido de
  inserir/excluir **linha** e **coluna**, mesclar/dividir, recortar/copiar/colar e selecionar tudo;
  fora dela, é o menu de texto (desfazer, recortar, copiar, colar, selecionar tudo). O **Excluir
  Tabela** já existia na aba contextual **Tabela**, mas só era achado por quem descobrisse a aba —
  o dono relatou "não consigo remover as tabelas depois que entram" e é o clique direito a porta que
  se tenta primeiro. O menu é barrado de vazar da janela e fecha com `Esc` ou clique fora; a lista de
  itens é pura (`src/word/contexto.ts`) e está presa no `test:layout`.

- **Arrastar uma imagem (ou um trecho) dentro do documento move em vez de duplicar**: o
  `handleDrop` do editor mandava **qualquer arquivo** da área de transferência do arrasto para o
  `handleFiles` — e o WebView2 entrega a **própria imagem arrastada** na lista de arquivos. Como o
  ProseMirror já move o trecho, a imagem era inserida de novo e a original ficava no lugar (o
  relato com print: "arrasto a imagem e ela duplica"). Agora o drop recebe o sinal `moved` do
  ProseMirror e, quando o arrasto começou **dentro** do editor, deixa o movimento acontecer;
  arquivo de **fora** (do Explorer, de outra janela) continua entrando pelo `handleFiles`. Teste:
  `npm run test:layout` (a checagem lê o `handleDrop`).
- **A folha é A4 de verdade (e o zoom diz que é só a vista)**: o relato ("quando coloco uma imagem
  o tamanho do papel muda — olha como é pequena essa folha, não tem um tamanho fixo A4") veio de uma
  folha **vista pequena**: o papel **sempre foi A4** (a config do app aberto está em 794 × 1123 px =
  A4 a 96 dpi) — o que muda é o **zoom**, e não havia nada na tela dizendo nem o tamanho do papel nem
  que aquilo era a vista. Agora a barra do Word mostra o **tamanho do papel ao lado da página**
  ("A4 · 21 × 29,7 cm", com a orientação no balão) e ganhou **Ajustar** — a folha cabe na largura da
  janela (nunca aumenta além de 100%) — e o **número do zoom virou botão**: um clique volta a **100%**.
  O papel continua saindo só da configuração de página (mudar o conteúdo, imagem inclusive, não mexe
  nele) e há teste prendendo isso.

- **A folha do Word ganhou relevo (ilusão de profundidade)**: no tema escuro a sombra da folha era
  escura sobre um palco escuro e a página ficava "flutuando" sem contorno — o usuário pediu relevo.
  Agora a folha tem **moldura de 1px** + **sombra em duas camadas** (uma rente, de 1px, e uma longa
  e suave por baixo) + uma **dobra clara de 1px no topo** (`inset 0 1px 0`), nos dois temas — a
  luz batendo na borda de cima é o que dá a leitura de folha de papel em relevo.

- **O mesmo botão recolhe o popup**: clicar de novo no botão da **cor da letra**, do **destaque** ou da grade da **tabela** **reabria** o popup — o clique no próprio botão era ignorado pelo "fecha ao clicar fora". Agora o popup guarda o **botão que o abriu** e o clique nele **recolhe** (clicar fora ou `Esc` continua fechando, e outro botão troca o popup de lugar).

- **No tema escuro o papel escurece**: a folha do Word era **branca fixa** — com o app no tema escuro (e a prévia do Markdown já escura), a coluna de escrita continuava um clarão. Agora o **papel e a tinta da folha saem de variáveis**: no tema escuro a folha escurece (mesmos tons da prévia do Markdown) e a tinta clareia, e tudo o que a folha pinta sozinha acompanha — **texto padrão, títulos, citação, bloco e código em linha, `<hr>` e bordas de tabela, cabeçalho/rodapé, rótulo da quebra de página, link e a sombra da folha**. Dois cuidados: o **marca-texto** (a paleta é toda clara) mantém o **texto escuro por cima**, e o **“Preto” do documento entra como tinta automática** — é o que o Word grava em “Automático” (`w:color` 000000), então documento importado não some na folha escura (cor explícita que não seja preto continua como o autor escolheu). **Imprimir e Exportar PDF saem sempre em papel branco**, com a tinta escura — o que vai para o papel não segue o tema da tela.

- **O ajuste da fita do Word agora encolhe de verdade (e do jeito certo)**: arrastar a borda de baixo da fita aplicava **zoom** na faixa inteira — a fonte encolhia junto, ficava ilegível abaixo de ~90% e, na prática, o ajuste “só aumentava” ✗. Agora a fita do Word usa o **mesmo modo das Apresentações**: a escala (`--fita-escala`) move as **métricas** (alturas, ícones, espaçamentos e os cartões de estilo) com **piso de fonte** (11,5 px nos botões, 10 px no rótulo do grupo) — e abaixo de ~88% entra o modo **compacto**, em que os botões grandes deixam de empilhar ícone + nome e viram **uma linha só**, devolvendo a altura que se foi buscar no arrasto. Duplo clique na borda (ou as setas, com a borda em foco) volta ao normal, como antes.

**Frontend**

- **Formalizar no Word (com prévia antes/depois)**: o comando **“Formalizar texto”** (`Ctrl+Alt+F`) agora também atende o documento Word — por um botão novo na fita (**Revisão → Revisão de Texto → Formalizar**) ou pela busca de comandos. Pega a **seleção**; sem seleção, o documento inteiro, e abre a **mesma janela** do Markdown: antes × depois, **MIP** ao vivo, trocas seguras já marcadas e as de sentido com o risco e as alternativas. Cada troca entra **no lugar dela**, numa transação só — o texto em volta e o **formato** dele ficam intactos, e o formato do próprio trecho trocado é mantido (negrito continua negrito) —, e `Ctrl+Z` desfaz tudo de uma vez. O corretor do Word reacende em seguida, já sobre o texto formal.
- Motor `.docx`: editar o documento direto na folha (sem Markdown) e abrir `.docx` do Word.
- Folha **A4/Carta** com margens, orientação, cabeçalho, rodapé e “Página X de Y”.
- **Páginas de verdade**: o texto flui entre as páginas e parágrafos se dividem.
- Fita no desenho do **Word Online**: estilos (Normal, Título 1–4, Citação, Código), fonte,
  tamanho, cores, destaque, negrito/itálico/sublinhado/riscado, sub/sobrescrito, alinhamento
  (justificado), entrelinha, recuo, listas com níveis, pincel de formatação e marcas de parágrafo.
- **Tabelas** (inserir, linhas/colunas, mesclar, dividir, sombrear, bordas), **imagens**
  (inserir/colar/arrastar), links e quebra de página; zoom.
- **Salvar `.docx` de verdade** (`Ctrl+S`) e **exportar PDF** imprimindo a folha.
- Corretor/revisão e **texto fantasma** funcionando no Word; fontes métricas locais.
- Histórico de versões, abas, Estrutura e busca valem no Word também.
- Importação de `.docx` com avisos do que ainda não entende (nunca some em silêncio).
- **Aviso de voz sem janela do sistema**: quando o reconhecimento de voz não está disponível, o
  aviso virou um toast do app (antes era o `alert` nativo do WebView).
- **Seleção do app na fita e em “Configurar página”**: os seletores de **Fonte** e **Tamanho** e os
  quatro do diálogo de página (papel, orientação, fonte e tamanho padrão) trocam a lista cinza do
  sistema pelo menu suspenso do app.
- **Setas de tamanho e campos na linha da fita**: o `A▲`/`A▼` de aumentar/diminuir a fonte agora
  aponta para os dois lados (a seta de diminuir fica **embaixo** do A, como no Word) e os
  seletores de **Fonte** e **Tamanho** ficaram na **mesma altura dos botões** da linha (28 px) —
  antes o campo ficava 2 px mais baixo que os vizinhos.
- **Fonte e tamanho livres na fita**: os campos de **Fonte** e **Tamanho** mostram o que o
  documento tem — um `.docx` com 13/13,5 pt ou com fonte fora da lista não fica mais em branco — e
  aceitam **digitação** (qualquer tamanho ou nome de fonte, como no Word), com a lista do app no
  botão ao lado; a lista de fontes ganhou as clássicas do Windows/Office.
- **Título do Word não pede mais ponto final**: um bloco de **Título** ("TESTE DE ESCRITA") recebia
  a sugestão **"Falta o ponto final no fim do parágrafo"** — no Markdown a linha do título começa
  com `#` e a regra já a pulava, mas o corretor do Word roda sobre a **projeção** do documento
  (texto puro, um parágrafo por linha) e ali o título não tinha marcador. A projeção passou a
  listar as linhas de **título** (`heading`) e a regra do ponto final as ignora; o corpo do texto
  continua pedindo o ponto (verificado: o MESMO texto como parágrafo segue marcado). 2 verificações
  novas em `npm run test:correcao`.

---

## Excel

### Não adicionado (fora da main)

**Backend**

- (nada no momento)

**Frontend**

- (nada no momento)

### Adicionado (na main)

**Backend**

- (nada específico do módulo — abrir/salvar passam pelos comandos do **Geral**)

**Frontend**

- **Grade que cresce sob demanda** (rolagem infinita) e desfazer/refazer de qualquer ponto.
- Fórmulas em português (referências `A1`/`$A$1`, operadores, erros) e **barra de fórmulas**.
- **Documentação das funções** por categoria em [docs/excel/formulas](docs/excel/formulas/README.md).
- Fita com abas **Início**, **Fórmulas** e **Exibir**: área de transferência, desfazer, fonte
  (negrito/itálico, cores), alinhamento, **mesclar/desmesclar**, formatos de número (moeda,
  porcentagem, milhar, casas decimais), inserir/excluir linha e coluna, ajustar altura/largura,
  **AutoSoma**, limpar conteúdo/formato, biblioteca (Média, Contar, Mínimo, Máximo) e
  **auditoria** (mostrar fórmulas).
- **Abas de planilha** (nova, duplicar, excluir, mover) e **zoom**.
- Abrir `.xlsx`/`.xlsm` e salvar `.xlsx` (macros não são preservadas; sugere `.xlsx`).
- **Configurar planilha**: linhas de grade, casas decimais, símbolo da moeda e zoom.
- **Limpeza**: removido o `renomearAba` com `window.prompt` (código morto) - a aba já se renomeia
  na tela, no duplo clique e no menu de contexto.
- **Seleção do app no formato do número**: o seletor da fita troca a lista cinza do sistema pelo
  menu suspenso do app (o valor e o comportamento são os mesmos).
- **Seletor de formato de número na altura da linha**: o campo do grupo **Número** passou a ter a
  mesma altura dos botões ao lado (26 px) — estava 2 px mais baixo.

---

## PowerPoint

### Não adicionado (fora da main)

**Backend**

- (nada no momento)

**Frontend**

- **O Assistente desligado deixa o desenho fiel (e a dica para de dizer "entendi")**: o traço livre
  ainda **encaixava nas formas de baixo** com o Assistente desligado — ao soltar, a caixa pulava e
  esticava até a borda do cartão (a prévia não mostra esse encaixe, então o salto era ainda mais
  estranho), e a dica continuava "entendi: …", como se ele estivesse lendo o traço. Agora o **ímã nas
  formas** (como o reconhecimento e o encaixe nos eixos) só age com o **Assistente** ligado; desligado,
  o traço fica onde a mão passou e a dica mostra só **Desenho livre**. Teste: `npm run test:desenho`.

- **A barrinha flutuante do Draw ficou só com a dica**: com o lápis ligado, o popup em cima da lâmina
  repetia **cor**, **espessura** (1/2/4/8), **Caneta/Marca**, **Livre/Pontos** e **Assistente** — tudo o
  que a aba **Desenhar** já mostra e comanda (o mesmo pincel). Agora esses controles vivem **só na
  aba** e a barrinha do palco é só a **dica** ("Clique para marcar pontos…", o "entendi: Retângulo" do
  assistente, a instrução da borracha) com o **Concluir/Cancelar** da curva por pontos — o que a aba
  não tem. No marca-texto, o **Assistente** da aba fica **desabilitado** (ele não reconhece um destaque),
  ocupando o aviso que existia no popup.


- **O aviso "Animações desta lâmina foram mantidas como vieram" saiu**: ao abrir um .pptx com animações
  fora do modelo (mídia com tempo próprio, efeitos interativos), o importador **preserva o XML** — nada se
  perde — mas avisava "Aberto com limitações: …" a cada abertura, o que não fazia sentido (o arquivo está
  preservado). O aviso deixou de existir; os que representam **perda real** (fonte embutida, imagem não
  carregada, tabela/gráfico sem suporte) continuam, numa mensagem única por arquivo.
- **O Compor ganhou "faixa + duas colunas" para texto longo (e o título não some mais nos cartões)**: quando o
  texto não cabe ao lado de uma imagem grande com 9 pt, a lâmina caía nos cartões. O padrão novo vira a imagem
  numa **faixa larga** (topo ou base, cortada em *cover*) — ou, sem imagem, numa faixa na cor da marca com anel e
  pontos — e distribui título e conteúdo em **duas colunas** balanceadas por altura, com a medida no canvas e piso
  de 9 pt. Entra como a terceira ideia ("Compor — faixa + colunas") e como fallback das outras duas. Corrigido
  também o **título sumido**: cartões e faixas se diziam "donos do título" sem colocá-lo, e a lâmina saía sem
  título quando caía nesses padrões.

- **A Arrumação ganhou "Compor": três estruturas diferentes por lâmina, imagem protagonista e mídia preservada**: o
  "Recompor" conservador só alinhava o que já existia — e isso nunca gerava uma lâmina nova. Agora a lâmina é lida
  em **grupos** (título com antetítulo/subtítulo, cada coluna de conteúdo, rodapé, imagem de conteúdo) e recomposta
  em **três estruturas diferentes**, não em recoloridos da mesma arrumação: **imagem + texto** (a imagem vira herói
  recortado — círculo, arco ou retângulo de cantos macios, com corte *cover* e sangria — e uma forma geométrica com
  anel e pontos quando não há imagem), **cartões** e **faixas**. O texto é **re-tipografado** (título 26 pt, corpo
  12,5 pt) com a altura medida no canvas na mesma fonte do renderizador e **desce até 9 pt** antes de desistir; a
  caixa força a quebra de linha. **Mídia nunca é apagada**: imagem/vídeo não são podados (lâmina com vídeo/áudio não
  é recomposta) e a imagem de conteúdo não pode ser coberta — o painel de fundo de um grupo anda junto com ele. No
  painel, os cartões **"Novo · …" que só trocavam cor/fundo** saem quando há composição. Testado numa **cópia** do
  deck real, lâmina por lâmina, com captura isolada do palco no app.

- **Organograma real: a hierarquia lê conectores de traço, apaga os antigos em todo arranjo e a Arrumação tem mais estilos** — o organograma importado usa conectores de traço (reta e cotovelo, com o ramo da SAP azul), que o detector não enxergava: a hierarquia não era oferecida e os conectores ficavam soltos no meio do slide depois do Fluxo. Agora a hierarquia lê os conectores pelas duas pontas (com o espelhamento do cotovelo), mantém a cor de cada ramo, e **todos** os arranjos os apagam. O Fluxo ganhou estilos (em linhas e em 2, 3 ou 4 colunas), a Arrumação mostra todos os estilos distintos de uma vez (sem o "Gerar mais", que repetia os mesmos cartões) e a região da hierarquia é escolhida pela posição real dos cartões, não pelo retângulo.

- **Composição ▸ Arrumação: o arranjo aparece no palco ao clicar** — o cartão alterava a lâmina na memória mas não repintava o palco, então o resultado só aparecia ao trocar de slide e voltar (os outros comandos da Composição já repintavam). Teste novo confere que os quatro comandos que mudam a lâmina chamam o repintar.

- **Arrumação que funciona em slides reais: Fluxo, região livre, texto proporcional e explicação** — medido em 24 slides reais, 21 não ofereciam nenhum arranjo. Agora: o **Fluxo** mantém o tamanho de cada bloco e os alinha em linhas ou colunas (a grade/lista exigiam blocos iguais e encolhiam tudo); a região dos cartões é a **maior área livre** que não cruza texto fixo (antes, uma faixa fixa); a **legenda** abaixo do cartão anda com ele e a **imagem de canto** é arte, não cartão; o texto escala **na mesma proporção** da caixa (o piso de 8 pt fazia o texto vazar); a grade ganhou 5 e 6 colunas; o Designer só aplica um arranjo que **não encolha** os blocos; e o painel **explica por que** não há arranjo ("já estão alinhados", "não há o que arrumar", "denso demais"). Cerca de metade dos slides medidos passou a ter arranjos.

- **Composição ▸ Tudo: volta a gerar cartões quando nenhuma arrumação é legível** — ao exigir que um arranjo "mude algo", o filtro de legibilidade passou a descartar também os cartões só de **visual** (neles a lâmina não muda de propósito) e o painel mostrava "Nenhuma composição cabe nesta lâmina" mesmo havendo visuais. Agora só os cartões com arrumação passam pelo filtro.

- **Arrumação em hierarquia (organograma) e um Designer que arruma sem estragar** — dois arranjos novos entendem a árvore pelos conectores e a redesenham (um nível por linha ou coluna, filhos centrados sob o pai, caixas do nível iguais, conectores novos, texto fixo desviado). O Designer passa a escolher sozinho o melhor arranjo, **remover o desenho antigo** do slide (triângulos, pontilhados, barrinhas) e **adaptar a arte à zona livre**; o que já está arrumado (uma fileira de cartões iguais) não é movido. Um arranjo só é oferecido se tudo continua legível: o texto cabe (palavra e parágrafo), nenhum cartão fica pequeno demais, cobre outro cartão ou cobre um texto que fica no lugar — corrige o caso em que três cartões viraram uma coluna sobre o parágrafo e o texto vazava. O modo **Tudo** deixou de mostrar um cartão só (filtra as arrumações antes de combinar com os visuais). Testes: `npm run test:hierarquia`.
- **A fita baixa fica legível (os ícones não caem mais para 14 px)**: com a fita arrastada para ~70%,
  os botões grandes viram "ícone + nome numa linha" — certo, é o que devolve altura — mas o **ícone
  ia para o piso de 14 px** (o do ícone pequeno) e o texto para 11 px: ficava "muito feio, difícil de
  até enxergar" (relato com print). Agora o ícone do botão grande na fita baixa tem **piso próprio:
  19 px** (quase o do botão empilhado, que fica em 20–24 px), o ícone pequeno **16 px**, as alturas
  param em **24 px** e o texto em **11,5 px** (o rótulo do grupo, 11 px). O desenho não mudou — a
  fita baixa continua a linha única — o que mudou é que ela não encolhe abaixo do que se enxerga.
  (As outras fitas têm os próprios pisos.)

- **Arrumação em hierarquia (organograma) e um Designer que arruma sem estragar** - dois arranjos novos entendem a árvore pelos conectores e a redesenham (um nível por linha ou coluna, filhos centrados sob o pai, caixas do nível iguais, conectores novos, texto fixo desviado). O Designer passa a escolher sozinho o melhor arranjo, **remover o desenho antigo** do slide (triângulos, pontilhados, barrinhas) e **adaptar a arte à zona livre**; o que já está arrumado (uma fileira de cartões iguais) não é movido. Um arranjo só é oferecido se tudo continua legível: o texto cabe (palavra e parágrafo), nenhum cartão fica pequeno demais, cobre outro cartão ou cobre um texto que fica no lugar — corrige o caso em que três cartões viraram uma coluna sobre o parágrafo e o texto vazava. O modo **Tudo** deixou de mostrar um cartão só (filtra as arrumações antes de combinar com os visuais). Testes: `npm run test:hierarquia`.

- **O seletor de cores abre com os "Usados recentemente"**: a lista de cores usadas já existia, mas
  ficava **no fim** do popup e **escondida quando vazia** — quem abria via "Cores do documento" no
  topo. Agora o popup abre com **Usados recentemente** no lugar dela (com as cores usadas ou, sem
  nenhuma ainda, a dica "As cores que você usar aparecem aqui"), **Cores do documento** logo abaixo
  e depois **Cores padrão** e **Outra cor**. Vale para todos os seletores (fonte, contorno,
  preenchimento, marca-texto, traço do pincel e o painel), que são o mesmo popup. A cor lembrada
  passou a ser normalizada em maiúsculas, para a mesma cor não entrar duas vezes (a paleta do deck e
  o hex digitado podem vir em caixas diferentes). Teste: `npm run test:layout`.

- **A espessura do contorno aceita qualquer número**: o menu **Contorno → Espessura** só tinha os
  traçados predefinidos (0,25 a 6 pt) e o print do usuário pediu uma caixa que aceite **qualquer
  número**. Agora há um **campo livre** (aceita **vírgula e ponto**: 2,75 pt vale) acima dos
  presets, que continuam como atalho; **Enter** ou sair do campo aplica. O comando `espessura` já
  aceitava qualquer valor — faltava a interface. Conferido no navegador (harness temporário): o
  campo abre com a espessura atual (2,25 pt), digitar 7,5 + Enter aplica `espessura=7,5` e sair do
  campo com 0,25 aplica `espessura=0,25`. Teste: `npm run test:layout`.

- **A aba Desenhar cabe CHEIA (e o que sobrou de duplicação saiu)**: o print do usuário mostrava a
  aba **compacta demais** e com grupos virando menu. Duas causas: o **piso do encaixe** estava em
  0,62 (herança da correção anterior) e a aba tinha **oito grupos**, sendo dois deles **repetição**
  do que já existe na aba **Inserir**. Agora: o piso voltou para **0,78** (as métricas encolhem
  pouco e só então grupos viram menu), saiu o grupo **Formas** da aba Desenhar (a galeria é a mesma
  do **Inserir ▸ Ilustrações** — os atalhos **Retângulo/Retângulo arredondado/Elipse/Triângulo**,
  que só existiam ali, **mudaram de lugar** em vez de sumir) e o grupo **Diagrama** já tinha saído.
  A aba Desenhar fica com seis grupos — **Canetas · Converter · Estúdio · Traço · Pintura ·
  Modelo** — e fica **cheia (ajuste 1)** em 1520 px e em 1280 px, sem nenhum grupo colapsado;
  abaixo disso os grupos que viram menu aparecem **centrados e tracejados** (o conserto do print
  anterior). Conferido por foto, com o harness da fita real (`node scripts/harness-fita.mjs 1520
  desenhar`), em 1520/1280/1000 px. Teste: `npm run test:layout` (a aba não repete o Inserir, e os
  comandos continuam lá) e `npm run test:encaixe`.

- **A mídia da apresentação ganhou controle (e a apresentação, tela cheia)**: no F5, uma lâmina com
  **áudio/vídeo** agora mostra uma **barra de controle no HUD** — **reproduzir/pausar**, **tempo**,
  **busca**, **volume**, **mudo**, **voltar ao início do trecho** e **tela cheia da própria mídia**
  (`K`, `M` e `,`/`.` no teclado também comandam). Ela aparece **sempre**, mesmo com "Mostrar
  controles na apresentação" desligado, e **não se esconde** enquanto a mídia toca — era o buraco:
  o vídeo começava sozinho e não havia como pausá-lo. Dois defeitos de fundo entraram junto: a
  reprodução tratava o **invólucro** da mídia como se fosse o player (pausar/tocar um `div` quebrava
  a mídia e a que tocava entre lâminas nunca pausava de verdade) e o **isolamento da lâmina**
  (`pointer-events: none` nas formas) deixava os controles nativos **inertes** — a opção ligada no
  painel nunca mostrou controle nenhum. Agora o player que pede controles recebe o ponteiro. E o
  modo apresentação **abre em tela cheia** (o pedido sai no gesto do F5, com o botão **Tela cheia**
  e a tecla `F` alternando; se o navegador recusar, a tela cheia é pedida à janela do app, e
  encerrar devolve a janela ao tamanho normal).


- **Composição ▸ Designer: o app desenha a arte da lâmina (ondas, facetas, mosaico e brilhos) e recompõe a capa** — como o Designer do Office responde a um slide simples, mas gerado no computador, em vetor e editável: gradientes com transparência e curvas de Bézier na paleta de um modelo, nos tons escuro e claro, determinísticos por semente. Na capa feita só de texto, o título e o subtítulo vão para a zona livre, com cor legível (4,5:1) e letra que cabe; no conteúdo a arte fica nas bordas e nenhuma caixa se move. É o novo modo padrão da Composição ("Gerar mais" traz outras combinações, com paletas criadas na hora). Também: modelo escuro numa lâmina de texto escuro agora vira texto claro (o contraste era calculado contra o fundo antigo). Teste: `npm run test:designer`.

- **O grupo "Diagrama" saiu da aba Desenhar (era função repetida)**: **Fluxo do Mermaid** e
  **Conectar** já vivem na aba **Inserir** — são **inserção**, não desenho — e o atalho na aba
  Desenhar fazia exatamente a mesma coisa em dois lugares (pedido: *"o diagrama é função repetida, já
  existe a função e fazem exatamente a mesma coisa"*). Nenhum comando saiu do motor: a segunda porta
  é que fechou. A aba Desenhar fica com o que é dela — **Canetas**, **Converter**, **Estúdio**,
  **Traço**, **Pintura**, **Modelo** e **Formas** — e, com um grupo a menos, ela cabe mais larga
  antes de o encaixe esconder algum outro.

- **"Selecionar tudo neste ponto" (as formas empilhadas de uma vez)**: com um avatar em cima do
  cartão, os textos por cima do fundo e as decorações no meio, o clique pega **só a forma de cima** —
  e chegar nas de baixo virava caça ao pedaço à vista, uma a uma ("fica difícil selecionar várias em
  um ponto concentrado", o relato). O **clique direito na forma** agora traz **"Selecionar tudo neste
  ponto"** (com a contagem: "Selecionar tudo neste ponto (3)"): pega a **pilha inteira** de uma vez,
  de cima para baixo, **cada forma com o grupo dela** (como no clique) — dali para trás é só tirar o
  que não serve com `Shift`+clique. A pilha sai do **mesmo critério do clique** (o que o ponteiro
  alcança, por `elementsFromPoint`: uma forma coberta só entra com o ponto na parte que está à
  vista), e as **decorações do layout** (fixas) entram só com o "Editar elementos do layout" ligado,
  como no clique. O item fica desabilitado com menos de duas formas no ponto.

- **A fita não parece mais quebrada quando um grupo vira menu (e ela prefere encolher a esconder)** —
  dois defeitos que apareceram juntos na aba **Desenhar** (que ganhou Estúdio, Pintura e Modelo): o
  **grupo colapsado** era desenhado como um botão **solto no topo** do painel, com o vão do rótulo
  vazio embaixo (o "justificar/espacar" do grupo, sem corpo nem rótulo, joga o primeiro filho para
  cima) — a faixa parecia quebrada e os controles do grupo (inclusive os novos do **Modelo**) sumiam
  da vista; agora o grupo colapsado fica **centrado**, com a **borda tracejada** do app e a altura
  de um grupo (a cara de "aqui mora o grupo inteiro"), e o clique abre os controles dele. E o
  **piso do encolhimento das métricas** desceu de **0,70 para 0,62**: com ele, a aba prefere
  **encolher** (alturas, ícones e espaços; a fonte tem piso próprio no CSS e continua legível) a
  **esconder** um grupo — antes a aba colapsava grupos com a janela ainda larga. Teste:
  `npm run test:encaixe`.

- **Estúdio · Modelo e cópias vinculadas: replicar a box sem copiar tudo** (fase 5) — a aba
  Desenhar ganhou o grupo **Modelo**: **Modelo** (a box escolhida vira a mestra), **Cópia** (cria uma
  cópia vinculada dela: o cartão e o conteúdo, deslocados), **Desvincular** e **Re-vincular** (por
  **parte**). É o caso do cartão repetido: o **nome de cada um** se desvincula (basta editá-lo — o
  app desvincula aquela parte sozinho e avisa como voltar) e **logo, fundo e pintura seguem o
  modelo** — mudar o modelo muda todas as cópias. A **posição e o tamanho de cada cópia são livres**
  (mover/redimensionar uma não mexe nas outras); as partes seguem o **arranjo** do modelo dentro do
  cartão. A unidade da box é o cartão e o que está **dentro** dele (pela contenção do centro, o
  mesmo critério das Regiões e dos Arranjos), e o vínculo é por parte (`Shape.modelo`), com
  `Shape.ehModelo`/`Shape.desvinculado` — tudo **do app**: o `.pptx` recebe as formas como estão (o
  PowerPoint não tem instância) e o rascunho guarda os vínculos para continuar editando depois.
  Teste: `npm run test:modelo`.

- **Estúdio · Camadas: a pintura numa lista que se esconde, ordena e apaga de uma vez** (fase 4) — o
  painel lateral ganhou a aba **Camadas**: cada **grupo de pintura** (e cada forma solta) aparece
  como uma camada, com **olho**, **nome** editável, **opacidade**, e as ações **subir/descer** (a
  camada inteira anda junta), **fundir com a de baixo**, **apagar** e **Agrupar a pintura** (junta
  as pinceladas da lâmina numa camada nova). O **olho vale no app e no `.pptx`**: a forma escondida
  não é desenhada na lâmina nem na miniatura e **não vai ao arquivo** — o `.pptx` é o que se vê.
  Uma camada é um **grupo** (o mesmo `grupo` do "Agrupar") com nome (`camada`, do app: o `.pptx`
  não tem camadas, e o nome fica no rascunho para voltar a mexer nelas). Teste:
  `npm run test:camadas`.

- **Estúdio · Pintura: desenhar dentro da fronteira, com translucidez** (fase 3) — o grupo **Pintura**
  (aba Desenhar) traz **Pincel**, **Balde** e **Vidro** + a **transparência** (Opaco/75/50/35/20%),
  e todos só valem **dentro do Estúdio** (a fronteira é de lá): o **Pincel** rabisca e o traço é
  **recortado na geometria** a cada quadro (a prévia já vem cortada), o **Balde** pinta a **face**
  sob o ponteiro e o **Vidro** pinta a face **translúcida**. O resultado é uma **forma normal** da
  lâmina (geometria livre, `custGeom`) — desfazer, histórico, exportação e o `.pptx` valem sem
  invenção: **o arquivo mostra exatamente o que você fez**, com o alfa no preenchimento. O que está
  dentro da face (o logo, o nome) entra no caminho como **buraco** (subcaminho invertido, o truque
  do "donut"): a pintura **não cobre** o que já estava lá, nem na tela nem no arquivo. O recorte é
  **Sutherland–Hodgman** numa fronteira **convexa** (as do Estúdio são: retângulo, arredondado,
  elipse, triângulo) — uma fronteira não convexa é **recusada com aviso**, em vez de pintar torto.
  Teste: `npm run test:pintura`.

- **Estúdio · Regiões: o mapa dos contornos** (fase 2 do Estúdio) — dentro do Estúdio, o botão
  **Regiões** liga o mapa: **passar o ponteiro acende a face sob ele** (véu do acento com contorno
  tracejado) e **clicar isola aquela região** — a fronteira deixa de ser a box inteira e passa a ser
  **o contorno da face com os buracos** dos elementos que estão dentro dela. É o que dá a precisão
  pedida: no cartão com logo, nome e bolinhas, a face do cartão **não cobre** o logo nem o texto, a
  face do logo tem a bolinha furada, a **rua entre dois cartões** é a face do palco e a área livre
  desconta o que já está lá. A trilha vira `Lâmina 3 ▸ Card do Diego ‹ Box · Logo` (o **‹ Box**
  volta para a box inteira) e o `Esc` sai do mapa, depois da região, e só então do Estúdio.
  O mapa é um módulo puro (`edicao/regioes.ts`): contorno em **polígono** por geometria (com
  **rotação**, raio por canto amostrado, elipse e triângulo), **buracos por interseção** (um texto
  que passa por cima do logo é buraco do cartão **e** do logo — senão pintar a face cobriria o que
  você está vendo) e profundidade pela árvore de contenção pelo centro (o mesmo critério dos
  Arranjos). Teste: `npm run test:regioes`.

- **Aba Animações cabe na tela (sem rolar nem cortar o grupo "Animar")** — o plano do encaixe supunha que todo grupo encolhe junto com as métricas, mas a galeria de animações tinha 72 px fixos por cartão e a aba passava da largura mesmo no degrau compacto. Agora a galeria acompanha as métricas e o encaixe **confere no navegador** depois de aplicar o plano: se ainda sobra rolagem, encolhe mais as métricas e, por fim, manda mais um grupo para o menu. Medido num Chrome real: de 1500 a 900 px nenhuma aba rola; em 1338 px a aba Animações cabe inteira.

- **Estúdio: isolar uma box e trabalhar só nela** (fase 1 de um conjunto) — a aba **Desenhar** ganhou
  o grupo **Estúdio** com o botão **Isolar**: com uma box escolhida, o palco entra num **ambiente só
  dela** — o resto da lâmina fica atrás de uma **máscara** (o mesmo caminho da box, com o **raio dos
  cantos**, como buraco), o **zoom enquadra e centra a box** (e volta ao que era ao sair), uma
  **trilha** no alto diz qual box está isolada (`Lâmina 3 ▸ Card do Diego` + **Sair**) e a **seleção
  passa a respeitar a box**: o que está fora não entra no clique. `Esc` sai, trocar de lâmina (ou de
  documento) fecha o modo, e apagar a box fecha junto — nada de estado fantasma. Linha, conector e
  traço de tinta **não** podem ser isolados (não têm área) e o aviso diz isso. O caminho da box é um
  módulo puro (`edicao/estudio.ts`: retângulo, **cantos arredondados por canto**, elipse e triângulo;
  o resto cai no retângulo da caixa) — é ele que as próximas fases (pintura recortada, camadas e as
  **cópias vinculadas**) vão usar como fronteira. Teste: `npm run test:estudio`.

- **As juntas entre a reta encaixada e a curva saíram suaves (sem quebras)**: o encaixe nos eixos
  deixa os trechos quase retos como retas, mas a cúbica que continuava da reta saía na tangente do
  vizinho de trás do traço — a reta encostava na curva de esguelha e ficava uma **quina** visível
  (print do usuário: "ficou com umas quebras, não ficou suave"). Agora o braço da cúbica nas juntas
  continua a **direção da reta** (um terço do trecho da curva, ~o arco de círculo que a mão faz) e o
  `reto` do Alt continua fazendo quina. O ajuste vale para o caminho final **e** para a prévia
  (mesma função nos dois). Teste: `npm run test:desenho`.

- **Aba Design completa: Temas, Variantes, Personalizar e Designer**: a aba tinha só dois grupos
  (fundo e layout) e agora segue os quatro blocos do Office, com a cara do app. **Temas** abre a
  galeria de modelos (a mesma do botão Template), **Variantes** é novo — as seis famílias de cor do
  Estilo de cor (Esmeralda, Oceano, Ameixa, Âmbar, Rubi e a **Grafite** escura) aplicadas à
  apresentação inteira, com **esta lâmina** desenhada em cada cartão (a mesma máquina das Ideias: o
  cartão mostra exatamente o que o clique aplica; a variante troca a cor, não a tipografia) —,
  **Personalizar** reúne fundo, layout e o **Tamanho** da lâmina (**16:9/4:3**, que tinha ficado sem
  UI quando o "Configurar apresentação" saiu) e **Composição** leva as Ideias de design e os Arranjos (já fundidos num sistema só, com nome próprio) para o lugar do Designer do Office (saem da Página Inicial). Os ícones da paleta das Variantes
  (com as seis cores) e do Tamanho são desenhados no CSS do app — nada de arte do Office. Testes:
  `npm run test:estilos` e `npm run test:layout`.

- **Template: os modelos agora têm DESENHO, não só cores** — barra lateral, faixas, cantos, círculos, moldura ou blocos, diferentes na capa/seção e no miolo; as decorações ficam nas bordas (nunca cobrem o texto), trocam ao mudar de modelo e de layout, aparecem em miniatura no cartão e vão no "Salvar como modelo". Saem os modelos Esmeralda, Oceano e Ameixa (fundo em gradiente ilegível) e entram Corporativo, Executivo e Terracota. Teste: `npm run test:modelos`.

### Adicionado (na main)

**Backend**

- **Arranjos: o conteúdo não se desloca mais do cartão** — o bloco inteiro (cartão + o que sai dele) é centrado no espaço e todas as formas andam por ele; a detecção roda uma vez e usa mapas por id, em vez de `find` por forma.

- (nada específico do módulo — abrir/salvar passam pelos comandos do **Geral**)

**Frontend**

- **Arrastar a caixa direto, sem sair da edição do texto**: com o texto em edição, o
  `contenteditable` cobre a caixa inteira e engolia também a **beirada** de ~6 px que agarra a
  forma para mover — era preciso clicar num lugar vazio da lâmina para sair da edição e só então
  arrastar. Agora a beirada continua valendo **durante a edição**: o `pointerdown` nela sai da
  edição e o **mesmo gesto** vira o arrasto (a forma continua escolhida), e o cursor vira
  **mover** nessa faixa. No miolo, o clique segue sendo o cursor de texto (caret e seleção do
  texto). Teste: `npm run test:layout` + laboratório do palco (beirada move; miolo não).

- **O botão "Desenhar" do topo sai na apresentação**: no PowerPoint o desenho é a aba **Desenhar** da
  fita; o botão da barra do topo (com a setinha de estilo) só respondia com o aviso "o desenho ainda
  não está disponível em apresentações" — foi removido ali ("não vejo necessidade de ter ele"). Nos
  outros módulos ele continua (no Markdown é lá que se desenha), e a barra acompanha a troca de
  abas: some ao entrar na apresentação e volta ao sair. Conferido no navegador: MD visível → PPT
  oculto → MD visível → PPT oculto. Teste: `npm run test:layout`.

- **Copiar uma imagem cola a imagem (não o JSON interno como texto)**: o `Copiar` gravava o
  `mdc-formas:[…]` (o formato interno) como **text/plain** na área de transferência do sistema —
  colar num outro app dava aquele texto gigante (print do usuário). Agora a área de transferência
  leva, como no PowerPoint: a **imagem em PNG** (quando a escolha é uma imagem — JPEG/WebP passam
  por um canvas e saem PNG) e o formato interno num **tipo próprio** (`web text/x-mdc-formas`), que
  só o colar do app lê; `text/plain` fica com o **texto** das caixas de texto (nunca o JSON). O
  colar lê o formato interno **antes** dos arquivos (copiar uma imagem daqui e colar daqui cola a
  **forma**, com id e estilo) e mantém o caminho dos arquivos para imagens de fora. Teste:
  `npm run test:layout` (3 checagens).
- **Organograma real: a hierarquia lê conectores de traço, apaga os antigos em todo arranjo e a Arrumação tem mais estilos** — o organograma importado usa conectores de traço (reta e cotovelo, com o ramo da SAP azul), que o detector não enxergava: a hierarquia não era oferecida e os conectores ficavam soltos no meio do slide depois do Fluxo. Agora a hierarquia lê os conectores pelas duas pontas (com o espelhamento do cotovelo), mantém a cor de cada ramo, e **todos** os arranjos os apagam. O Fluxo ganhou estilos (em linhas e em 2, 3 ou 4 colunas), a Arrumação mostra todos os estilos distintos de uma vez (sem o "Gerar mais", que repetia os mesmos cartões) e a região da hierarquia é escolhida pela posição real dos cartões, não pelo retângulo.

- **Colar texto entra na caixa escolhida (ou cria a própria caixa)**: texto na área de transferência
  agora sempre vira conteúdo **dentro de uma caixa** — com uma caixa escolhida, ele entra no **fim
  do texto dela** (parágrafo novo, preservando o que já estava), e o `Ctrl+V` deixa de criar uma
  caixa centralizada por cima; **sem seleção**, o app cria a **própria caixa** com o conteúdo, como
  era ("quando eu tiver texto na área de transferência ele deve ser colado dentro da sua própria box
  mesmo que não esteja selecionada nenhuma box"). Tabela escolhida não recebe o texto (colar em
  célula é com a célula em edição) — nesse caso vale a caixa nova. Conferido no navegador: com a
  caixa escolhida o slide ficou com 2 formas e o texto da caixa ganhou o parágrafo colado; sem
  seleção ficou com 3, e a caixa nova contém o texto. Teste: `npm run test:layout`.

- **A Arrumação ganhou "Recompor": ela lê a estrutura da lâmina e devolve as posições ao lugar**: as
  fórmulas antigas (grade, lista, destaque, faixa, fluxo, hierarquia) só entendem **cartões** — num deck
  de infográficos (dezenas de elipses, setas, ícones e grades de imagem) elas tratam ícone como cartão e
  **recusam tudo** ("Nenhuma fórmula deixa o conteúdo todo legível": a régua reprovava a fórmula inteira
  por causa de uma forma só). A **Recomposição** lê a **estrutura** — **título** (com antetítulo e
  subtítulo), **colunas de conteúdo**, **rodapé**, **painéis de fundo** e ícones — e **normaliza** as
  posições: margens iguais, colunas alinhadas com o mesmo vão, os painéis emoldurando as colunas e o
  rodapé no lugar. Ela é **conservadora**: o **ritmo vertical do desenho é preservado** (nenhum bloco é
  re-empilhado e **nada escala** — a letra e a caixa ficam como o design as deixou), o que muda é o
  **alinhamento**; um bloco que passe do rodapé sobe até caber, a decoração não sai da lâmina e um
  **diagrama** anda como **um bloco**. Se nada mudar (ou se a mudança piorar a lâmina), ela **volta como
  está** — a Recomposição nunca entrega uma lâmina pior. Testada numa **cópia** do deck real (12 lâminas
  de um infográfico corporativo), lâmina por lâmina, **no app**: **12/12 sem sobreposição nova, sem texto
  vazando e sem nada fora da lâmina** — 9 recompostas e 3 preservadas. Teste:
  `npm run test:recompor -- <arquivo.pptx>`.

- **A ligação em cotovelo ganhou o degradê no caminho certo**: o eixo do gradiente era a **reta
  origem→destino** — numa ligação reta dá no mesmo, mas num **cotovelo** essa reta é uma diagonal
  que não corresponde ao caminho: o trecho comprido já começava no meio da mistura e a transição se
  concentrava no fim (relato com print: "o degradê só acontece do B → A, não do A → B, e se
  encontra no meio"). Agora o eixo é o **trecho mais longo da rota**, no sentido do fluxo: a cor
  sai da origem com a cor da origem, anda pelo trecho principal e chega no destino com a cor do
  destino. A ligação reta fica igual (a rota tem um trecho só) e a seta continua na cor do destino.
  Teste: `npm run test:ligacoes` (5 casos, incluindo o cotovelo descendo e subindo).

- **A roda do mouse, no fim da lâmina ampliada, agora pede dois ticos (não pula mais de lâmina sem
  querer)**: com a lâmina **ampliada**, chegar ao fim da rolagem e dar **um** tico a mais já trocava
  de lâmina — e é justamente o tico que escapa no meio do trabalho (a rolagem "acabou" e a mão
  continua). Agora o fim tem **dois passos**: o **primeiro** tico **arma** (a roda fica quieta) e só
  o **segundo** troca; uma **pausa (650 ms) desarma**, então um tico isolado, mais tarde, nunca troca
  sozinho. Com a lâmina **inteira à vista** (não há o que rolar) continua **um tico = uma lâmina** —
  esse fluxo estava certo e não mudou. Testes: `npm run test:pptx-edicao` (a sequência completa com o
  relógio injetado: rolar, armar, trocar, pausa que desarma) e `npm run test:layout`.
- **A cor do contorno vale na hora (o "Outra cor" não espera mais o OK)**: escolher a cor no seletor
  do sistema — gradiente, matiz, R/G/B, conta-gotas — **já aplica** enquanto se mexe, e o código
  digitado também; o menu fica **aberto** para ajustar a espessura e o traço logo depois, e o **OK**
  virou "aplicar e fechar" ("quando eu clicar em uma cor já virar uma seleção"). A cor só entra nos
  **Recentes** quando o seletor é fechado (a prévia do arrasto não enche a lista) e as prévias viram
  **um passo só** de desfazer: durante o arrasto é uma aplicação por quadro e o `contorno` ganhou a
  **chave** que junta as edições seguidas no histórico (medido no navegador: 5 cores seguidas =
  1 passo; um desfazer volta à cor de antes). Teste: `npm run test:layout`.

- **O seletor de cores abre com os "Usados recentemente"**: a lista de cores usadas já existia, mas
  ficava **no fim** do popup e **escondida quando vazia** — quem abria via "Cores do documento" no
  topo. Agora o popup abre com **Usados recentemente** no lugar dela (com as cores usadas ou, sem
  nenhuma ainda, a dica "As cores que você usar aparecem aqui"), **Cores do documento** logo abaixo
  e depois **Cores padrão** e **Outra cor**. Vale para todos os seletores (fonte, contorno,
  preenchimento, marca-texto, traço do pincel e o painel), que são o mesmo popup. A cor lembrada
  passou a ser normalizada em maiúsculas, para a mesma cor não entrar duas vezes (a paleta do deck e
  o hex digitado podem vir em caixas diferentes). Teste: `npm run test:layout`.

- **A barra lateral de lâminas (faixa vertical) agora pode ser arrastada para expandir/reduzir**: a
  alça de 6 px fica entre a faixa e o palco (o cursor vira `col-resize`, com realce no hover) e
  arrastar escreve na largura da faixa — as **miniaturas acompanham** (o texto delas é `cqw`, então
  a lâmina inteira cresce junto) e a largura fica **guardada** entre sessões, como a do painel
  direito (72 px a ~45% do painel). Antes a faixa vertical ficava presa em 112 px (print do
  usuário). Só aparece no modo **Exibir → Faixa vertical**. Teste: `npm run test:layout`.

- **Mudar a caixa do texto ganhou as cinco opções do Office**: o menu tinha três (**MAIÚSCULAS**,
  **minúsculas** e "Primeira Letra" — que na verdade fazia **título por palavra**, apesar do
  rótulo) e faltavam as duas que se usam o tempo todo: **Frase normal** (minúsculas com a primeira
  letra de cada frase em maiúscula) e **aLTERNAR mAIÚSCULAS/mINÚSCULAS** (tOGGLE cASE). Agora são
  as cinco, na ordem do Office, e o rótulo do título ficou explícito (**Primeira Letra De Cada
  Palavra**). A **Frase normal** entende a frase **através dos trechos** (um trecho em negrito no
  meio não reinicia a frase) e **cada parágrafo abre uma frase**; o **aLTERNAR** troca a caixa de
  cada letra e não mexe no resto. Os acentos saem certos nos dois. Teste: `npm run test:edicao-pptx`
  (5 casos novos, incluindo a frase atravessando trechos e por parágrafo).

- **A espessura do contorno aceita qualquer número**: o menu **Contorno → Espessura** só tinha os
  traçados predefinidos (0,25 a 6 pt) e o print do usuário pediu uma caixa que aceite **qualquer
  número**. Agora há um **campo livre** (aceita **vírgula e ponto**: 2,75 pt vale) acima dos
  presets, que continuam como atalho; **Enter** ou sair do campo aplica. O comando `espessura` já
  aceitava qualquer valor — faltava a interface. Conferido no navegador (harness temporário): o
  campo abre com a espessura atual (2,25 pt), digitar 7,5 + Enter aplica `espessura=7,5` e sair do
  campo com 0,25 aplica `espessura=0,25`. Teste: `npm run test:layout`.

- **Selecionar várias formas deixou de travar a cada clique**: o palco chama o "fim da
  transformação" a cada `pointerup` — inclusive no clique que só **escolheu** uma forma — e o host
  **repintava tudo** ali: ~65 ms por clique, dos quais ~59 ms eram as **miniaturas de todas as
  lâminas** (cada `innerHTML` de miniatura vira DOM de verdade). Agora o fim do arrasto **só
  repinta quando houve mudança** e a fileira de miniaturas **não é refeita quando nada mudou** (as
  lâminas são imutáveis: lâmina igual, miniatura igual — só o "aceso" anda ao trocar de lâmina).
  Medido no app, num deck de 12 lâminas × 31 formas: o repaint caiu de **65–95 ms para ~10 ms** e o
  shift+clique de ~250 ms para ~105 ms de ida-e-volta (15 ms de trabalho do app). Teste:
  `npm run test:layout`.

- **As abas do painel lateral ficaram fáceis de clicar (grade regular, com hover)**: **Formatar**,
  **Animação**, **Notas**, **Composição**, **Camadas** e o **»** estavam numa fila que quebrava em
  linhas irregulares — cada célula do tamanho do texto, o rótulo "flutuando" no meio e sem nenhum
  estado de hover ("está muito difícil de clicar"). Agora é uma **grade**: todas as células têm a
  mesma largura por linha e alinham coluna com coluna (no painel padrão, 3+3; no mínimo de 200 px,
  2+2+2; com o painel largo, as seis numa linha só), a área de clique ganhou um piso de altura e a
  aba **acende no hover**. Conferido no navegador: os cinco cliques acertam a aba em qualquer
  largura. Teste: `npm run test:layout`.

- **O filtro da Composição (Designer/Visual/Arrumação/Tudo) cabe no painel em qualquer largura**:
  os botões eram `flex: 1 1 auto` com `min-width: auto` — não encolhiam abaixo do próprio texto e o
  **"Tudo" saía pela borda** quando o painel encolhia (print do usuário). Agora os quatro dividem a
  largura (`flex: 1 1 0; min-width: 0`) e o rótulo cede com **reticências** quando falta espaço —
  nunca vaza. Conferido em navegador real (novo `scripts/harness-painel.mjs`): em 260 px os quatro
  com o rótulo inteiro; em 200/170 px, iguais e dentro do painel.

- **Aba Animações sem a mensagem lateral de escopo**: removida a mensagem `"A animação vale para as
  formas escolhidas; a lâmina é a aba Transições."` (e a nota de transição ao lado da galeria) na
  aba **Animações**, liberando o espaço lateral do grupo **Animação**.

- **O arrasto das formas deixou de travar**: o quadro do arrasto refazia o **`innerHTML` da lâmina
  inteira** (todas as formas ricas) + o **painel lateral inteiro** + a fita a cada evento de
  movimento — e a passada de layout que vinha atrás pagava a conta. Medido no navegador (Chrome
  headless + CDP, arrasto de ponteiro de verdade): **~14 ms por quadro antes, ~1,7 ms agora** (~8×
  mais leve; mover e redimensionar). Agora o quadro vivo mexe **só no que mudou**: mover/girar vai
  direto no estilo da forma, o painel só troca os números de tamanho/posição, o que **muda o
  desenho** (redimensionar) refaz **só aquela forma**, e o que é **derivado** (ligação, cópia do
  modelo, Estúdio) segue o desenho completo. No fim do gesto a lâmina é redesenhada uma vez, como
  sempre (desfazer, miniaturas e painel ficam em dia). 4 verificações novas em `npm run test:layout`.

- **O menu "Organizar" põe o par dos extremos junto (como no Office)**: a ordem era
  **Trazer para a frente**, Avançar, Recuar, **Enviar para trás** — o par que se usa junto ficava
  separado pelos passos de camada e o "Enviar para trás" só aparecia na quarta linha (relato com
  print). Agora é **Trazer para a frente ▸ Enviar para trás ▸ Avançar ▸ Recuar** (o resto da lista
  não mudou), como na fita e no menu do clique direito, que já mostravam o par junto. Vale para os
  dois botões que abrem esse menu (o **Organizar** da aba Desenhar e o **Alinhar e girar** da
  Página Inicial).

- **Dois comandos "criar modelo" com o mesmo nome — um deles nunca rodava**: o botão **Modelo** do
  Estúdio Modelo ("esta box vira modelo, as cópias vinculadas seguem o que mudar nela") mandava
  `modelo-criar`, o mesmo comando do cartão **Novo modelo** do **Template** — e o `switch` pega o
  primeiro `case`, então o do Estúdio Modelo era **código morto**: clicar em **Modelo** criava um
  **cartão de Template** ("Meu modelo") em vez de marcar a box como modelo (o Vite já avisava disso
  no build). Os nomes agora são próprios — `template-criar` (Template) e `modelo-criar` (Estúdio
  Modelo) — e um teste novo barra comando repetido no `switch`.

- **Redesign da aba Desenhar, grupos recolhidos e clique direito limpo no palco**:
  - **Aba Desenhar compacta e estruturada**: o grupo **Traço** deixou a coluna alta de 4 linhas
    e o seletor solto para usar duas linhas horizontais com controles segmentados (**1 · 2 · 4 · 8**
    ao lado da **Cor**, e **Livre · Pontos** ao lado do **Assistente**); o grupo **Pintura** alinha
    o botão **Em forma** com a coluna compacta de **Opacidade**; e o grupo **Formas** trocou a lista
    larga de textos por uma grade rápida 2×4 de ícones ao lado do botão **Formas ▾**.
  - **Botões de grupo recolhido (`Modelo ▾`, `Formas ▾`…) não jogam mais grupos para fora da tela**:
    os botões `.fita-grupo-recolhido` ganharam visual de pílula estruturada com `flex: 0 1 auto` e
    `min-width: 0` (com reticências quando apertado), impedindo que estourem a largura da faixa em
    janelas estreitas.
  - **Fim do texto marcado em azul nos botões e formas**: `user-select: none` nos controles da
    interface e nas formas da lâmina fora de edição (mantendo `user-select: text` dentro da forma em
    edição e nos campos de entrada), limpando também a seleção nativa do navegador ao sair da edição
    de texto ou selecionar/arrastar no palco.
  - **Clique direito para mover a tela sem prender o menu "Selecionar tudo"**: os popups agora
    fecham já no `pointerdown` em fase de captura (o palco chama `preventDefault()` no `pointerdown`,
    o que engolia o `mousedown` e deixava o menu preso), o arrasto com botão direito funciona também
    no pano de fundo ao redor da lâmina e o clique direito no vazio da lâmina não abre mais o menu
    "Colar / Selecionar tudo" (o menu de contexto abre só ao clicar com o direito sobre uma forma).
  - **Aba Transições sem o aviso redundante**: removida a mensagem `"Transição é da lâmina. Para
    animar uma forma escolhida, vá na aba Animações"` da faixa de Transições.
  - **Redimensionar o painel lateral sem engasgos**: o arrasto de `.pp-side-resize` agora é
    cadenciado por `requestAnimationFrame` e lê a borda direita apenas no `pointerdown`.

- **O grupo Canetas ficou agrupado (os 4 botões não estão mais espalhados)**: na fita baixa os botões
  grandes da aba Desenhar (**Draw**, **Curva**, **Marca-texto**, **Borracha**) tinham ~10 px de ar
  entre um e outro (o padding de cada botão + o vão do grupo) — o pedido foi compactar ("está muito
  espalhado"). O ar caiu para ~5 px (metade do vão entre o ícone e o rótulo dentro do próprio botão)
  e o grupo encolheu de 296 px para 278 px na medição a 1400 px, o que também alivia o encaixe; a
  mudança vale para os botões grandes de **todas as abas** na fita baixa. Teste: `npm run test:layout`.

- **Os quatro botões do grupo Desenho ficam juntos e mais compactos**: Preenchimento, Contorno,
  Efeitos e Organizar estavam em **três numa coluna + o Organizar solto ao lado** (print do
  usuário) — o grupo ficava mais alto que o resto da faixa e o quarto botão parecia de fora. Agora
  são um **2×2** (Preenchimento/Contorno em cima, Efeitos/Organizar embaixo): o grupo fica uma
  linha mais baixo e os quatro leem juntos.

- **A lâmina inteira animando? É a TRANSIÇÃO — e agora ela aparece onde você trabalha**: aplicar uma
  animação numa forma grava **só na forma** (a exportação leva a animação por forma), mas quem já
  tinha aplicado uma **transição** na lâmina continuava vendo a **lâmina inteira** animar na
  apresentação — e a aba Animações não dizia isso ("eu tentei aplicar animação só nessa box[, mas]
  aplica em todo o slide"). Agora, quando a lâmina tem transição, a aba **Animações** mostra uma nota
  com o **nome dela** ("A transição (Push) anima a lâmina inteira — o efeito é só da forma
  escolhida") e o botão **Tirar transição**, que resolve em um clique; sem transição, fica a
  nota-base que aponta a aba Transições. A nota da aba **Transições** ganhou o botão **Animações**,
  que leva direto à aba onde o efeito vai para a forma escolhida. Teste: `npm run test:layout`.

- **A ligação do Conectar vira uma transição (da cor da origem para a do destino)**: o conector era
  **duas formas** — a espinha na cor da forma de origem e a descida na cor da de destino — e a cor
  trocava de uma vez no ponto de encontro: um **corte seco** (o verde → azul do relato). Agora é
  **uma forma só**, com o traço em **gradiente**: 0% = cor da origem, 100% = cor do destino, e o
  **ângulo é a reta entre as duas bordas escolhidas** — num "L", o trecho reto sai esverdeado, o
  canto já é mistura e a descida chega azul. A **seta** fica na cor do destino (marcador não pinta
  com gradiente) e **cores iguais** seguem em traço sólido. O `.pptx` sai com **linha em gradiente**
  (`a:ln` com `a:gradFill`, no mesmo eixo da tela) e a **importação passou a preservar** contorno em
  gradiente (antes achatava na primeira parada). Documento salvo antes disso se junta numa forma só
  na primeira mexida na lâmina. Teste: `npm run test:layout`.

- **O arco no desenho fica com a caixa no pedaço visível (não na elipse inteira)**: o arco
  reconhecido guardava a caixa da **elipse inteira e girada** — a seleção pegava um retângulo
  enorme, "jogava para fora" do traço e o encaixe mexia na elipse, não no desenho (print do
  usuário). Agora o arco vira um **caminho** com a mesma curva (a elipse amostrada) e a caixa
  colada no pedaço desenhado: medido num quarto de círculo de raio 120, a caixa passou de 240×240
  para **121×119**; o "Converter em forma" segue o mesmo caminho, e o `.pptx` sai como custGeom com
  curvas (o mesmo desenho no Office). Testes: `npm run test:desenho` e `npm run test:pptx`.

- **A forma criada cobre o traçado todo (o canto com retas não vira um arco solto)**: o canto do
  cartão desenhado com retas curtas + curva era reconhecido como um **arco de uma elipse enorme e
  girada** (medido: rx 352 num traçado de 190) — a forma cobria só a curva (as retas do traçado
  ficavam de fora) e a elipse "jogava para fora" no canto (print do usuário). Agora o reconhecedor
  mede a **cauda reta** das pontas (reta de verdade fica a ~0,5 pt da corda numa janela de ~50 pt;
  arco de verdade, ~2–3 pt) e um traçado com cauda reta fica como **desenho livre**, cobrindo tudo —
  com o encaixe nos eixos e nas formas de baixo. Teste: `npm run test:desenho`.

- **A barrinha do pincel (Draw) volta a ficar por cima da faixa de lâminas e do palco**: ela perdeu o
  `z-index` quando o Estúdio chegou (fase 1) e, sem ele, as miniaturas e a lâmina — posicionadas e
  **depois** dela no DOM — pintavam por cima: o usuário só via o botão "8" (a espessura acesa)
  aparecendo por trás das miniaturas. A barrinha volta ao `z-index: 60` da escada do arquivo (por
  cima de tudo do palco, abaixo do Estúdio, que é 61, e dos popups, 300). Teste: `npm run test:layout`.

- **A animação vale para TODA a seleção (os ajustes e o Remover também)**: aplicar o efeito já era
  por forma escolhida, mas os controles de ajuste (**Início**, **Duração**, **Atraso**, **Direção**
  e **Por parágrafo**) e o **Remover** olhavam só a última forma escolhida — com duas caixas
  selecionadas, a segunda ficava com o efeito original ("seria possivel aplicar animação somente na
  seleção das box não no slide inteiro"). Agora os controles valem para a seleção inteira, como no
  PowerPoint, e o **Remover** que esvazia a lista limpa o campo de verdade. A aba **Transições**
  ganhou a nota de que a transição é da lâmina — para animar uma forma escolhida, a aba é a
  **Animações** — e a aba **Animações** a nota espelhada. A exportação já levava a animação (o
  `p:timing` que o PowerPoint toca) e ganhou verificação própria: estrutura do PowerPoint, presets
  (`surgir=10`, `aparecer=1`, `voar=2`), duração em milissegundos e o modelo de volta inteiro.
  Testes: `npm run test:pptx-edicao` e `npm run test:layout`.

- **O degrau no meio da reta encaixada saiu (a curva "quase perfeita" agora fecha)**: quando a mão
  derrapa no meio de um trecho, o alinhamento nos eixos formava **duas retas com médias
  diferentes** — o caminho fazia um degrau/barriga entre elas (print do usuário: "a curva do
  assistente quase saiu perfeita"). Agora as corridas vizinhas quase colineares viram **uma só**
  (a média sai do trecho inteiro): vale quando as médias estão a até 5 pt e os pontos do vão ficam
  a até 8 pt da reta — um degrau de verdade, que a mão desenhou, tem a diferença maior e fica.
  Teste: `npm run test:desenho`.

- **O encaixe do desenho usa a borda VISÍVEL do cartão, não o retângulo dele**: num cartão de canto
  arredondado o canto do retângulo é **vazio** — a linha desenhada no topo entrava nesse vão e
  parava na quina que não existe (print do usuário: "gruda na borda de um quadrado, não o que está
  dentro dele"). Agora os alvos do encaixe são os **trechos visíveis** das bordas (a borda de cima
  começa onde o arco do canto termina), o trecho só vale quando cruza a faixa do desenho e a
  **ponta** do traço entra no fim do trecho. Medido: a linha no topo cola em 205 (fim do canto) em
  vez de 192 (o vão). Teste: `npm run test:desenho`.

- **O desenho gruda nas formas de baixo (as bordas do cartão)**: ao desenhar o canto por cima do
  cartão, o traço sai **por dentro** das bordas dele (a mão erra ~10–30 pt) — mais que o limiar do
  encaixe (~10 pt) — então o desenho ficava no retângulo do próprio traço e não grudava no cartão
  (print do usuário). Agora o limiar é **2,5% da largura da lâmina** (~24 pt) e, nos **traços**
  (desenho livre e curva), o encaixe é só nas **bordas**: o ímã do centro deslocava o traço inteiro
  para o meio da forma de baixo. Teste: `npm run test:desenho`.

- **As juntas entre a reta encaixada e a curva saíram suaves (sem quebras)**: o encaixe nos eixos
  deixa os trechos quase retos como retas, mas a cúbica que continuava da reta saía na tangente do
  vizinho de trás do traço — a reta encostava na curva de esguelha e ficava uma **quina** visível
  (print do usuário: "ficou com umas quebras, não ficou suave"). Agora o braço da cúbica nas juntas
  continua a **direção da reta** (um terço do trecho da curva, ~o arco de círculo que a mão faz) e o
  `reto` do Alt continua fazendo quina. O ajuste vale para o caminho final **e** para a prévia
  (mesma função nos dois). Teste: `npm run test:desenho`.

- **O traço que só PARECE um círculo não é mais fechado (nem vira um arco bojudo)**: ao desenhar o
  topo arredondado de um cartão (quase reto com cantos), o assistente fechava o traço numa
  **elipse** — um "C" com abertura de ~18% da diagonal contava como "fechado" (o limite era 22%) —
  ou aceitava um **arco** que passava longe do desenho (para traços grandes os limites eram largos:
  desvio médio de 1,8% e máximo de 0,6% da diagonal). Agora "fechado" é só quando as pontas quase
  se encontram (7% da diagonal) e o arco tem de **passar pelo traço** (média 0,8% e máximo 0,35%) —
  o que não corresponde fica como **desenho livre**, com o encaixe nos eixos. Teste:
  `npm run test:desenho`.

- **O traço quase reto sai reto (o encaixe nos eixos voltou a acontecer)**: o desenho livre já
  "encaixava nos eixos", mas o encaixe rodava **depois** da simplificação (RDP): um trecho quase
  reto já tinha virado 2–3 pontos e não sobrava a **corrida de segmentos** que o alinhamento exige
  — o "L" desenhado alguns graus torto continuava saindo **torto** (print do usuário). Agora o
  encaixe roda no traço **suavizado, antes de simplificar** (o mesmo no `alinharNosEixos`), e o
  teste ganhou o caso do tremor **pequeno** — o sintético era grande e escondia o defeito.

- **Modo Pontos: o clique do modo Livre não marca mais nó (e o duplo clique termina de verdade)**:
  com o Draw em **Livre**, um clique sem arrastar **ligava o modo Pontos** e virava o "primeiro nó"
  — e a partir daí a linha **seguia o mouse sem parar**, "até o infinito" (print do usuário). Agora
  o clique no Livre **não faz nada** (o modo é do botão **Pontos**), a prévia dos pontos mostra
  **só os nós marcados** (o trecho elástico saiu) e o **duplo clique termina** a curva aberta: o
  `preventDefault` do `pointerdown` cortava o `dblclick` do navegador, então o par de cliques é
  contado no próprio palco (o mesmo caso do duplo clique da alça de canto) — antes, só fechando o
  círculo (clique no nó inicial) dava para terminar. Testes: `npm run test:desenho` e
  `npm run test:layout`.

- **A prévia do traço é o que fica (fim da linha fina e serrilhada)**: enquanto se desenha à mão
  (ou se marcam os pontos da **Curva**), a prévia ao vivo era uma **polilinha em %** com
  `non-scaling-stroke` — no zoom alto ela saía **fina e com cantos**, enquanto o traço que ficava no
  fim era **grosso, curvo e suave** (print do usuário). Agora a prévia usa o **mesmo caminho do
  final**: os pontos viram **pt da lâmina** (a espessura acompanha o zoom, como o traço de
  verdade), passam pelo **mesmo suavizar/simplificar** e saem nas **cúbicas** do caminho — e, com o
  **Assistente** ligado, a prévia **já mostra o encaixe nos eixos** (o trecho quase reto fica reto
  enquanto você desenha). A prévia da **Curva** entrou no mesmo espaço. Teste: `npm run test:layout`.

- **Arrastar a lâmina para reordenar voltou a funcionar (o app "bloqueava" o gesto)**: clicar e
  segurar a miniatura para levá-la a outra posição **não fazia nada** dentro do app — a faixa usava
  o arrasto do **HTML** (`draggable`), e o **Tauri substitui o manipulador de arrasto do WebView2**
  para entregar os arquivos soltos na janela (a doc do Tauri é explícita: desligar é obrigatório
  para o HTML5 drag no Windows). O gesto agora é por **eventos de ponteiro**, como o resto do app:
  **segure e arraste** (um clique simples continua só escolhendo a lâmina), a **linha de acento**
  mostra onde ela entra — em cima/embaixo na faixa vertical e à esquerda/direita na do topo —, a
  miniatura na mão fica **esmaecida**, perto da borda a faixa **rola sozinha** e o **Esc** cancela.
  Como o arrasto só começa depois de um mínimo de movimento, escolher a lâmina, excluir pelo **×** e
  o **+ Nova lâmina** continuam funcionando como sempre.

- **A apresentação nova nasce clara — o tema do app não decide o papel da lâmina**: o padrão de
  fábrica da apresentação era o tema **Escuro**, então quem usava o app no escuro abria uma lâmina
  escura sem ter pedido. Agora ela nasce com **papel branco** (tema **Claro**) e o tema do app fica
  onde deve — na **interface**; quem quer lâmina escura escolhe um modelo escuro na apresentação
  (aba **Design ▸ Temas**, como o **Escuro** ou o **Meia-noite** do catálogo) ou a variante **Grafite**
  (aba Design ▸ Variantes), de propósito. A **importação** de `.pptx` segue clara (não herda o tema
  de quem chamou) e o documento que já existia **mantém o tema que tinha** — trocar o padrão de
  fábrica não repinta rascunho nem histórico antigos. Teste: `npm run test:lamina`.

- **As molduras das prévias de lâmina (Ideias, Arranjos e Variantes) são palco, não papel**: o
  cartão que recorta a prévia da lâmina tinha um **branco fixo** atrás dela, então no tema escuro
  do app o vão em volta da lâmina aparecia como um papel branco que não existe na tela. A moldura
  passou a usar o **tom do palco** (`--palco-bg`) — o mesmo do editor: escuro no tema escuro e
  claro no claro. A lâmina recortada não muda (ela tem o fundo próprio, que é o que o cartão
  mostra). Teste: `npm run test:layout`.

- **O "Nova lâmina" saiu da fita — o card do fim da faixa assumiu tudo**: o botão da fita
  (**Página Inicial ▸ Lâminas**, e o gêmeo na aba **Inserir**) fazia o mesmo que o **card
  "+ Nova lâmina"** do fim da faixa: os dois criavam com o último layout e os dois abriam a
  galeria. Agora quem manda é o **card**: a **prévia** cria a lâmina na hora (com o último
  layout — a primeira nasce Capa) e o **rótulo "+ Nova lâmina"** abre a **galeria em grade**
  com a miniatura de cada layout. O título do card diz qual layout o clique vai usar. Os grupos
  **Lâminas** das duas abas ficam com o resto (Layout, Duplicar, Excluir, Renomear, Ocultar e
  Redefinir na Página Inicial; Duplicar no Inserir). O botão dividido saiu com o helper e o CSS
  dele, e o comando `slide-novo` (o menu da setinha) ficou sem dono e saiu junto — o card chama
  a galeria direto. A lâmina nova continua entrando **no fim** e já selecionada.

- **A fita métrica fica NAS LINHAS**: a medida do arrasto saiu do balão flutuante e passou a morar
  nas próprias linhas do gesto (as mesmas guias rosa, que agora aparecem junto com a medida): ao
  **mover**, a **linha em pé** mostra o **x** ("x 2,7 cm") e a **deitada** o **y** ("y 6,1 cm"),
  com o rótulo colado nelas junto do canto; ao **redimensionar** ou **desenhar**, a **linha de
  baixo** mostra a **largura** e a **da direita** a **altura**. Perto das bordas da lâmina o
  rótulo vira para o outro lado (acima/abaixo, esquerda/direita) e tudo some ao soltar. Teste:
  `npm run test:layout`.

- **"Composição": as Ideias de design e os Arranjos viraram um sistema só**: os dois nasceram da
  mesma ideia e estavam se separando — duas abas no painel, dois botões na fita e um grupo com o
  nome do PowerPoint (**"Designer"**). Agora é **uma aba** (Composição), **um botão** na fita
  (grupo **Composição**, na aba **Design**) e um **filtro** que escolhe o que as sugestões mexem: **Tudo** (o padrão —
  cada cartão junta a **arrumação** desta lâmina e o **visual** do deck, com o nome dizendo as
  duas: "Grade 2×2 · Clássico"), **Arrumação** (só as fórmulas, o visual continua o mesmo) e
  **Visual** (só os designs, na apresentação inteira, como as Ideias eram).

  A fornada do *Tudo* é **determinística** (o lote devolve sempre as mesmas sugestões — é o que faz
  a prévia do cartão ser o que o clique aplica): a arrumação anda de uma em uma (dois cartões
  vizinhos nunca repetem a mesma fórmula), o visual anda por saltos pelo catálogo (a fornada
  espalha designs em vez de mostrar vizinhos) e os últimos cartões são **criados na hora** (o
  cartão diz **Novo**, com a paleta pelo ângulo de ouro, como nas Ideias). O clique aplica as duas
  metades **num passo de desfazer só**. Numa lâmina que não tem o que arrumar (uma lâmina de
  título, por exemplo) os cartões saem **só de visual** — sem prometer uma fórmula que não muda
  nada — e o filtro Arrumação explica em vez de repetir a mesma prévia. A prévia passou a usar o
  **ratio do deck** (num 4:3 ela dizia uma coisa e o clique fazia outra) e o nome da Microsoft saiu
  da interface (o grupo "Designer" deixou de existir).

- **Ferramentas de tinta na aba Desenhar**: o **marca-texto** (traço **largo e translúcido**, sem
  virar forma: é marcação), a **borracha** (clique ou arraste **sobre os traços de tinta** para
  apagar — cada traço é um passo do desfazer, e uma forma comum embaixo dela **não** é tocada) e o
  **Converter em forma** (o traço escolhido passa pelo reconhecedor e vira a forma limpa, **no
  lugar e do tamanho em que ele está** — mesmo depois de movido). O traço desenhado guarda os
  pontos (`tinta`, só do app) — é o que permite apagar e converter depois; o `.pptx` continua com
  a geometria de sempre. Na barrinha do pincel entram **Caneta/Marca**, e com a borracha ela vira
  só a dica (cor e espessura não valem para ela). Testes: `npm run test:desenho` e
  `npm run test:layout`.
- **Aba "Desenhar" na fita**: as ferramentas de traço ganharam o lugar próprio (como no PowerPoint de
  verdade): **Canetas** (**Draw** e **Curva**, que **saíram do Inserir**), **Traço** (**cor** na
  mesma paleta do pincel, espessuras **1/2/4/8**, **Livre/Pontos** e o **Assistente**), **Formas**
  (a galeria + retângulo, retângulo arredondado, elipse, triângulo, linha, seta e conector para
  desenhar arrastando) e **Diagrama** (Fluxo do Mermaid e Conectar). A aba mostra o **estado do
  pincel** (botão aceso na cor/espessura/modo escolhidos) e mexe no **mesmo pincel** da barrinha
  flutuante — o que se escolhe num lugar aparece no outro. Teste: `npm run test:layout`.
- **O card "Nova lâmina" da faixa: o "+" do canto saiu e o rótulo assumiu a galeria**: o card
  ficou com dois alvos claros — a **prévia** cria a lâmina na hora, com o **último layout
  escolhido**, e o **rótulo "+ Nova lâmina"** (embaixo) abre a **galeria** com os seis layouts,
  onde a escolha cria e passa a ser o "último" (o mesmo caminho da fita, pelo
  `abrirGaleriaDeLayouts`); clicar no rótulo de novo **recolhe** a galeria, como nos outros popups
  do app. O **"+" redondo** que pendia do canto da prévia era um alvo a mais e saiu (pedido: "o
  botão de cima era para sumir e o de baixa assumir a função"). Teste: `npm run test:layout`.

- **O traço e a curva por pontos não deixam mais rastro (o "leque")**: desenhando à mão ou marcando pontos da **Curva**, cada quadro do arrasto **empilhava uma prévia nova** por cima das anteriores — o resultado era um leque de linhas que só crescia conforme o mouse andava (o print do usuário). A limpeza do que o palco desenha por cima da lâmina não conhecia o traço (`pp-traco`), a prévia da curva (`pp-curva-preview`) nem os pontos (`pp-no-curva`) — e, pela mesma porta, o **balão da medida** (`pp-medida`) ficava preso na tela depois de soltar. Agora a lista é uma só (`SELETOR_DO_OVERLAY`) e **o teste trava**: toda classe que o palco empilha tem de estar nela (ou dentro de uma que está).

- **Fita métrica do arrasto**: enquanto se arrasta algo na lâmina, um **balão com a medida** acompanha o gesto — **x · y** (posição) ao **mover** e **largura × altura** ao **redimensionar** uma forma ou **desenhar** uma nova. A unidade é o **cm**, a mesma dos campos de **Tamanho** do painel (o número do gesto bate com o que a pessoa lê depois), com uma casa e vírgula decimal; o balão fica **acima do quadro** (e vira para baixo quando não há espaço no topo), não rouba o ponteiro e **some ao soltar**. Com **várias formas escolhidas**, a medida é a da **moldura do grupo**.
- **O "+" do card "Nova lâmina" abre as variações (e o chevron de recolher a fita saiu)**: o card
  do fim da faixa ficou com **dois alvos de clique**: o **corpo** (a prévia + o rótulo "+ Nova
  lâmina") cria a lâmina com o **último layout escolhido** e o **"+"** no canto da prévia abre a
  **galeria** com os seis layouts — escolher lá cria com aquele layout e passa a ser o "último"
  (antes o "+" não fazia nada). A galeria virou **um helper só** (`abrirGaleriaDeLayouts`): a
  mesma na fita (Nova lâmina e Layout) e no card, então os caminhos nunca divergem. E o **chevron
  de recolher a faixa de opções saiu** (pedido: ficar um controle só): o recolher continua no
  **Ctrl+F1** e no **duplo clique numa aba**, agora os dois com a regra "decide pelo que está à
  vista" e a dica morando na barra das abas (o botão anunciava o que ia fazer e desapareceu com
  ele).

- **Template: os modelos agora têm DESENHO, não só cores** — barra lateral, faixas, cantos, círculos, moldura ou blocos, diferentes na capa/seção e no miolo; as decorações ficam nas bordas (nunca cobrem o texto), trocam ao mudar de modelo e de layout, aparecem em miniatura no cartão e vão no "Salvar como modelo". Saem os modelos Esmeralda, Oceano e Ameixa (fundo em gradiente ilegível) e entram Corporativo, Executivo e Terracota. Teste: `npm run test:modelos`.

- **Arranjos: cartões com gradiente, cartões concêntricos e cartões pequenos agora são detectados, e só aparecem os arranjos legíveis** — antes, num deck importado (organograma com cartões em gradiente, 1,9% da lâmina cada), nenhum cartão era detectado e o app embaralhava as 29 caixas de texto; o cartão de fora e o branco de dentro também se descartavam um ao outro. Agora a Lista/Faixa/Destaque com muitos cartões (tiras de 2%) deixam de ser oferecidas.

- **Arranjos: triângulos e painéis de fundo não viram mais "cartões"** — antes uma forma grande e decorativa (ex.: os triângulos verdes) ou um painel atrás dos cartões era tratado como cartão, engolia os de verdade e o arranjo saía desordenado; agora eles ficam parados e só os cartões com conteúdo se arrumam. Teste: `npm run test:arranjos`.

- **Fonte e Parágrafo à frente das Lâminas na Página Inicial**: o grupo **Lâminas** vinha logo depois da Área de Transferência e empurrava **Fonte** e **Parágrafo** para trás (o pedido veio com print: "quero que esses dois fiquem no lugar das lâminas"). Agora a ordem é **Área de Transferência → Fonte → Parágrafo → Lâminas → Desenho**: o que se usa o tempo todo fica **sem rolar a fita**, e o grupo Lâminas continua inteiro, logo depois do texto.

- **A lâmina tem começo e fim no tema escuro**: no escuro o palco usava o mesmo fundo do app
  (`#0e1014`) e a sombra da lâmina é escura fixa — com a apresentação no tema **Escuro** a lâmina
  ficava da cor do palco e não dava para ver onde ela começava ou terminava (print do usuário).
  Agora o **palco tem tom próprio** no escuro (`#1a1e26`, um degrau acima do fundo do app) e a
  lâmina ganhou uma **moldura de 1px** (`--lamina-borda: #5b6472`, que contrasta 2,9:1 com o palco
  e 3,3:1 com o fundo do tema Escuro) — o anel aparece nos dois casos: lâmina escura sobre palco
  claro e lâmina clara sobre palco escuro. A **miniatura** da lista recebeu a mesma moldura (uma
  lâmina escura sumia dentro dela) e a dica "Clique para adicionar o título/texto" subiu de 40%
  para **55%** de opacidade, que é o que a deixa visível sem virar texto de verdade.

- **"Nova lâmina" com o último layout escolhido (sem abrir o painel)**: o clique direto criava
  sempre "Título e conteúdo" e a fita obrigava a passar pela **galeria** (que abria um painel
  grande). Agora **Nova lâmina** é um **botão dividido**: o **clique na frente** cria a lâmina
  **na hora**, no fim, com o **último layout escolhido** — e a **setinha ▾** abre a galeria, como
  antes (escolher lá passa a ser "o último"). A preferência **nasce Capa** e **sobrevive ao
  recarregar**; aplicar um **Layout** à lâmina atual também conta como escolha. O card do fim da
  faixa deixou de ser o "+" genérico: ele mostra a **prévia do último layout** (a mesma miniatura
  da galeria, com o "+" no canto) e cria com ele no clique — o **clique direito** na miniatura
  segue com as ações da lâmina (Duplicar, Renomear…), intacto.

- **O mesmo botão recolhe o popup**: clicar de novo em **Formas**, **Template**, **Layout**, **Nova lâmina**, nas cores ou nas bordas **reabria** o popup em vez de fechá-lo — o clique no próprio botão era ignorado pelo "fecha ao clicar fora" e o comando rodava outra vez. Agora o popup guarda a **âncora** que o abriu e o clique nela **recolhe** (clicar fora ou `Esc` continua fechando, e outro botão troca o popup de lugar).

- **Curva por pontos de parada e modo Pontos no Draw**: desenhar contornos e curvas suaves à mão livre
  costumava deixar pontos tortos ou traços ondulados. Agora o PowerPoint oferece duas soluções integradas:
  - **Ferramenta dedicada Curva** na fita (**Inserir ▸ Linhas ▸ Curva**): clique na lâmina para marcar pontos
    de parada sucessivos; o traço é recalculado em tempo real com interpolação suave $C^1$ (Catmull-Rom), sem quinas.
  - **Modo Pontos na barra do Draw**: a barra flutuante do pincel traz o alternador **[Livre]** e **[Pontos]**,
    e um clique sem arrastar no modo Livre inicia os nós de parada automaticamente.
  - **Ajustes de precisão**: fechar o contorno ao clicar próximo ao nó inicial (halo verde), gerando forma fechada;
    segurar `Alt` para marcar o nó como canto reto/quina (marcador quadrado); segurar `Shift` para travar o segmento
    a cada 45°; `Backspace`/`Delete` para remover o último ponto; `Enter` ou duplo-clique para concluir curva aberta;
    e `Esc` para cancelar.

- **Fita: os menus de forma abrem mesmo sem forma escolhida — e nunca por cima do botão**: o
  **Contorno** (o relato: "clicado de novo, não abre"), o **Preenchimento** e os **Efeitos**
  ficavam **desabilitados** sem forma escolhida e engoliam o clique sem dizer nada. Agora os três
  abrem o menu com a **dica** (o padrão que os **Estilos de cor** já usavam — `d32f4db`): o menu
  traz "Selecione uma forma na lâmina para desenhar o contorno." (idem preenchimento e efeito) e os
  itens **desabilitados** — nada de clique mudo. E o menu **não cobre mais o próprio botão**: numa
  janela baixa ele subia e tapava a fita (o clique seguinte caía no menu); agora ele **encolhe**
  com rolagem por dentro e fica sempre **abaixo** — ou, quando lá há mais espaço, acima,
  **terminando antes da âncora**. Os botões de ordem (Trazer para frente etc.) seguem desabilitados
  sem seleção, como no PowerPoint. Teste: `npm run test:menus` (o posicionamento dos menus, com
  varredura de 100 janelas provando que o menu nunca cobre a âncora).

- **A galeria do Template põe os SEUS modelos em cima e o catálogo embaixo**: o cartão
  **Novo modelo** (guardar esta apresentação) vem **primeiro** e cada modelo que você criou fica
  logo depois dele, com um **× no canto** para apagar só o que é seu (os modelos do app não têm ×).
  Antes o catálogo vinha na frente e o "+" era o **último** cartão de uma grade de 22 modelos que
  rola: quem criava um modelo abria a galeria de novo e não achava nem o cartão novo (ele nascia
  fora da tela) nem como criar outro — parecia que só dava para criar **um**. O cartão recém-criado
  entra em **destaque** e é trazido à vista, apagar mantém a rolagem onde você estava e a grade é
  reencaixada na janela depois de desenhar (o popup era posicionado com o conteúdo ainda vazio e a
  **última coluna saía da tela** — é também por isso que o print do relato mostrava duas colunas).
  Se o armazenamento do app recusar a gravação (cheio ou indisponível), o aviso aparece — em vez de
  um modelo que some sem explicação.

- **Arrastar a caixa pelo vazio (forma sem fundo)**: uma caixa de texto sem preenchimento só
  pegava o clique **nas letras** — o resto do retângulo era clique-através, então tentar arrastar
  a caixa pelo miolo caía na lâmina e ainda **desfazia a seleção**. Agora a forma sem fundo
  **escolhida** tem o interior inteiro como área de arrasto (com o cursor de mover) e continua
  clique-através quando não está escolhida — dá para escolher o que está embaixo sem perder a
  caixa de vista. Editando o texto, quem manda continua sendo o cursor de texto.

- **Aba Arranjos não trava mais ao clicar** — as prévias são desenhadas uma por quadro e reaproveitadas enquanto a lâmina não muda (antes, seis lâminas inteiras eram remontadas de forma síncrona a cada clique ou edição).

- **Aba Design sem o grupo "Tema"**: os três botões (**Tema claro**, **Tema escuro** e **Alto
  contraste**) saíram da fita do PowerPoint: o clique não mudava nada visível no deck (quem manda
  na cara é o **Template**, o **fundo da lâmina** e as cores das formas). A aba fica com
  **Personalizar** e **Layout**, e o comando interno (`theme:`) saiu junto.

- **Aba "Arranjos": a lâmina reorganizada em fórmulas padrão**: as ideias mexiam no visual, mas a
  arrumação ficava sempre a mesma — o usuário pediu para reorganizar a lâmina em fórmulas padrão.
  A aba nova (painel lateral + botão **Página Inicial ▸ grupo Designer ▸ Arranjos** na fita) propõe a lâmina
  atual em **grade** (2×2, 3×2, 4×2…), **lista**, **destaque** (o primeiro cartão grande e o resto
  numa coluna ao lado) e **faixa** (tudo numa linha). Cada cartão é detectado com **tudo o que está
  dentro dele** (avatar, logo, textos — num deck importado o cartão costuma ser uma imagem com os
  textos soltos por cima, e a detecção é por contenção), os cartões ganham o **mesmo tamanho** (o
  do maior, ajustado para caber) com o conteúdo escalando junto (texto com mínimo de 8pt), e as
  **formas fixas do modelo não se movem** (as decorações) nem os **textos do cabeçalho** (título,
  subtítulo, legenda). As **linhas de ligação saem** — conectores e traços finos fora dos cartões —
  porque a vizinhança dos cartões mudou; a barrinha de destaque dentro do cartão anda com ele. O
  visual (cores, estilos, imagens) fica como está: dá para aplicar um arranjo e depois combinar com
  qualquer ideia de design. Verificado no deck real do usuário: 3-4 unidades por lâmina, nada fora
  da lâmina e nenhum cartão sobreposto nas quatro fórmulas.

- **Designs criados na hora (o gerador das Ideias)**: as ideias só combinavam o catálogo (19
  designs × 3 acabamentos). Agora **três cartões de cada fornada são criados pelo app**: uma
  paleta montada na hora a partir de uma cor de partida (o **ângulo de ouro** espalha as
  paletas), um **esquema harmônico** (análogo, complementar ou triádico), fundo claro ou escuro
  alternado e uma fonte que combina — o nome sai da cor ("Verde análogo") e o cartão diz
  **Novo**. A semente avança a cada fornada, então as paletas **não se repetem**; o design é
  **determinístico** (o `gerado-N` volta pela mesma função), e é isso que faz a prévia do cartão
  ser exatamente o que o clique aplica. O texto de cada paleta é conferido contra o fundo
  (**WCAG 4,5:1**, medido em 14,9 e 15,9 nas oito primeiras) antes de a ideia aparecer.

- **O vazio ao lado do texto não larga mais a caixa**: com a forma **escolhida**, clicar/puxar no **vazio** ao lado ou embaixo do texto **deselecionava a caixa** ✗ — o quadro da forma pode ser **menor que o texto** (o texto transborda), então esse vazio cai **fora** do quadro e o clique não encontrava a forma. Agora o gesto do texto alcança **o que o texto pinta** (a caixa do texto **e o que passa dela**): o clique nesse vazio **entra na edição** e vai para o texto, sem largar a escolha. A **beirada** do quadro continua movendo e o clique **fora de tudo** continua limpando a escolha, como sempre.

- **Estilos de cor (R6 — polimento)**: dois ajustes de acabamento. O **conector que sai de uma
  caixa com Estilo de Cor** agora usa a **cor-base da rampa** (a parada do meio) — antes ele pegava
  a **ponta clara** do gradiente, então a ligação saía mais clara que a caixa (num gradiente de
  duas paradas, o empate continua com a primeira, o comportamento de sempre). E o **menu de
  estilos**, aberto **sem forma escolhida**, avisa ("selecione uma forma na lâmina…") e deixa os
  cartões e controles **desabilitados** — antes os cliques não faziam nada, sem explicação.

- **As Ideias de design ganharam um atalho na Página Inicial**: o botão saiu da aba **Design**
  (grupo Designer) e passou para o **fim da Página Inicial**, no mesmo grupo **Designer** — o
  atalho fica junto das tarefas do dia a dia e no mesmo lugar da referência (o DeckCraft põe as
  *Design Ideas* na Home). O clique faz o de sempre: **mostra o painel** e abre a aba **Ideias**,
  com esta lâmina desenhada em cada modelo. A aba **Design** continua com Personalizar (fundo)
  e Layout, sem repetir o comando.

- **Estilos de cor (R5 — os Modelos)**: o botão **Template** ganhou três modelos com a cara da
  referência — **Esmeralda**, **Oceano** e **Ameixa** — que levam o **Estilo de Cor** no fundo das
  lâminas (a rampa da família, com o acento do próprio modelo) e cujo cartão mostra a **prévia da
  rampa** no lugar da cor de fundo. Aplicar um modelo **re-deriva na hora** as formas que usam
  Estilo de Cor sem cor própria (a base vazia passa a apontar para o **acento novo**) e as de cor
  fixa ficam como estão; aplicar um modelo **sem** estilo devolve o fundo ao do modelo (a receita
  do fundo sai — senão o recálculo a reescreveria logo depois). E **salvar a apresentação como
  modelo** guarda o estilo do fundo do deck junto, então o modelo criado por você reproduz o
  gradiente em qualquer apresentação.

- **Texto dentro da forma: dá para selecionar — e o mover ficou na beirada**: com a forma **escolhida**, arrastar por cima do **texto** movia a forma ✗, e o texto ficava inalcançável: a edição só abria por **duplo clique**, e o duplo clique nativo morria no `preventDefault` do ponteiro (os eventos de mouse derivados não saem). Agora o clique no texto de uma forma **escolhida** entra na edição e o **arrasto seleciona o texto** ✓ — o **caret cai onde o ponteiro clicou** e o duplo clique escolhe a palavra (o redesenho não apaga mais a seleção). O **mover** fica na **beirada** da forma (a faixa de ~6 px por dentro do contorno) e, com **várias** formas escolhidas, o arrasto continua movendo o conjunto; sem a forma escolhida, o primeiro arrasto pega e move, como sempre. O **cursor** troca (`mover` ↔ `texto`) para dizer quem manda em cada estado.

- **Estilos de cor (R4 — o fundo da lâmina)**: as mesmas famílias agora pintam o **fundo**: no
  popover **Formatar fundo** (e na seção Fundo do painel quando nada está selecionado) entrou o
  **"Fundo com estilo"** com os cartões das famílias — um clique dá ao fundo o **gradiente da
  rampa com lustro** (no fundo não há dobra: o brilho fica no lustro). O fundo é **vivo** como as
  formas: escolher uma **cor** vira a **cor-base** (a rampa se refaz), as **orientações de
  gradiente** viram o **ângulo**, sem cor própria ele **acompanha o tema**, e editar o fundo à
  mão (tipo, cor do tema, gradiente radial) **solta o estilo**, deixando o gradiente atual como
  pintura. O **"Aplicar a todas as lâminas"** leva o estilo junto (senão as outras voltariam ao
  tema) e o painel ganhou Família, Intensidade, Brilho, Ângulo, Cor-base e o **Desligar o estilo
  do fundo**.

- **Ideias de design: o texto não some mais** (e o contraste é conferido): com um design escuro, o
  texto das formas ficava **claro sobre cartão branco** e desaparecia (print do usuário). Duas
  causas: o branco puro dos cartões ficava fora do remapeamento e a cor do texto era escolhida
  pelo "papel" da cor sem olhar **onde o texto senta**. Agora as **superfícies** têm papel próprio
  (as claras viram a tinta do acento, as escuras continuam escuras, as da marca viram o acento) e
  os **textos** têm outro: o escuro continua escuro, o claro continua claro. A superfície de cada
  texto é procurada **embaixo dele** (o preenchimento da própria forma, o cartão de baixo ou o
  fundo da lâmina) e o contraste é medido (**WCAG 4,5:1**): se o tom escolhido não alcança, o
  texto vira para o extremo do design que contrasta — e, em último recurso, branco ou preto puro.
  Sobre um cartão que é **imagem** (a cor de trás é desconhecida) o texto **não troca de lado**:
  num deck importado é isso que o mantém legível. No deck real do usuário: 190 textos com
  superfície conhecida, **0 abaixo de 4,5:1**, e os 168 textos sobre cartões-imagem preservados.

- **Estilos de cor (R3 — o brilho em dobra)**: o acabamento **Dobra** entrou na galeria e no
  painel: além do **Lustro** (a faixa clara dentro da própria rampa), agora dá para pôr o
  **brilho diagonal** da referência — uma **forma-capa** translúcida (paralelogramo com gradiente
  de branco) que nasce **agrupada com a forma** e acompanha caixa e giro em qualquer mudança.
  Apagar a forma leva a capa junto, **desagrupar manda** (o recálculo não volta a agrupar) e
  **copiar/colar** remapeia o grude para as cópias (copiar só a capa a solta, vira forma comum).
  De quebra, o **caso de ouro de exportação** entrou no `test:pptx-edicao`: o gradiente sai
  **nativo** (parada a parada, com o alfa do lustro), o ângulo vira o `a:lin`, o contorno vai no
  tom profundo com o alfa, a sombra no efeito, e a **dobra abre no PowerPoint como um grupo**
  (base + capa no mesmo `p:grpSp`) — a volta traz o visual como pintura.

- **Desenho assistido: o topo do cartão sai reto (sem barriga no meio)**: com os pontos já
  alinhados pelo encaixe nos eixos, o caminho continuava saindo em **cúbicas** — e a curva do
  Catmull-Rom **bojava entre os pontos** quando os vizinhos eram os cantos (o print do relato). Os
  trechos encaixados agora saem como **segmento reto** (`L`) no caminho: o topo de um cartão fica
  exatamente reto, com os cantos descendo como foram desenhados. O encaixe passou a rodar **por
  último** (depois da suavização), senão a média móvel puxava os pontos do topo de volta para os
  cantos.

- **Estilos de cor (R2 — a cara do sistema)**: na aba **Formato da Forma**, o botão **Estilos**
  (grupo **Estilos de Cor**) abre a galeria das famílias — **Esmeralda, Oceano, Ameixa, Âmbar,
  Rubi, Grafite** e "Da sua cor" — com a **prévia real** da rampa em cada cartão; um clique dá à
  forma o **gradiente diagonal de 3 tons**, o **lustro**, o contorno no tom profundo, a sombra
  leve e a **cor do texto por contraste** (a caixa da referência em dois cliques). O estilo é
  **vivo**: a forma guarda a receita e a pintura é **derivada** — **trocar a cor** (o
  preenchimento) refaz a **rampa inteira** (o tom escuro desvia o matiz para o frio: verde vira
  teal) e, sem cor própria, o estilo usa a **cor do tema** e acompanha os Modelos. A galeria
  ajusta **Intensidade** (Suave/Média/Forte), **Brilho** (Sem brilho/Lustro), **Ângulo**
  (0/45/90/135) e a **Cor do estilo**; o painel Formatar ganhou a seção **Estilo** com os mesmos
  controles e o **Desligar estilo**. Com o estilo ligado, ele manda no preenchimento, no
  contorno, na sombra e na cor do texto — trocar a orientação do gradiente vira o **ângulo** do
  estilo, e editar a pintura à mão (contorno, sombra, estilos rápidos, "sem preenchimento")
  **desliga o estilo**, deixando o que estava na tela como pintura normal, editável. No `.pptx`
  o gradiente vai **nativo** (paradas com transparência) e abre igual no PowerPoint; o conceito
  "vivo" não existe no arquivo — reimportar traz o visual como pintura. **R3** traz o brilho em
  dobra e o caso de ouro de exportação; **R4** e **R5**, fundo e modelos.

- **Desenho assistido: o arco agora tem que passar pelo traço** (e a linha não engole os cantos):
  um traço do **topo de um cartão** (retas com cantos) virava um **arco largo que bojava por baixo
  do desenho** — o ajuste elíptico era aceito pela **média** do desvio, que é pequena quando o
  traço só "se parece" com a elipse. Agora o aceite olha o **desvio máximo** da curva: o topo do
  cartão fica **livre** (e o encaixe nos eixos deixa a aresta reta com os cantos) ou, quando os
  cantos são rasos, sai como **linha em cima da aresta** — a tolerância da linha caiu de 5% para
  2,5% do comprimento, que era o que deixava os cantos passarem por "linha".

- **Múltipla seleção: cada forma tem as próprias 4 alças de canto**: antes só o quadro do grupo ganhava alças — as formas escolhidas ficavam só com o contorno tracejado, sem nenhum ponto, e não havia como redimensionar **uma** delas estando com várias selecionadas (qualquer alça mexia na seleção inteira). Agora cada forma mostra as **suas 4 alças de canto** (menores, 7 px contra 9 px das do grupo) e arrastar uma delas redimensiona **só aquela forma**, **sem desfazer a seleção** — o quadro do grupo segue com as 8 alças para redimensionar todas de uma vez. No canto em que as duas caem no mesmo ponto quem atende é a alça da forma (a pequena no pontual, a grande no coletivo); a haste de girar continua **uma só**, do conjunto.

- **Ideias de design com "Gerar mais ideias" e acabamentos**: as ideias mostravam só 8 cartões
  e, num deck importado, trocavam apenas o fundo e o texto — as formas do organograma têm cores
  próprias (verdes) que não estão em tema nenhum e ficavam intactas. Agora cada ideia é um
  **design + acabamento** (*cores novas*, *cantos arredondados* ou *contorno de acento*) e o
  botão **Gerar mais ideias** percorre as combinações, 8 por vez, com o contador à mostra. O
  *cores novas* remapeia as cores próprias das formas **pelo papel de cada uma** — a cor da
  marca vira o acento, os fundos claros viram uma tinta do acento e as cores escuras viram o
  texto —, então o organograma inteiro passa para a paleta do design (no deck real do usuário,
  128 formas trocam de cor, contra 44 antes). A prévia do cartão usa o mapa do **deck inteiro**,
  para o cartão mostrar exatamente o que o clique faz.

- **Estilos de cor — o motor (R1, primeira rodada)**: o sistema que vai dar às formas o gradiente
  bonito da referência começou pela base que ninguém vê: um módulo puro de cor que converte
  hex↔HSL, gera a **rampa de tons** que preserva a saturação e **desvia o matiz no tom escuro**
  (o verde vira teal, como na imagem), monta o **esquema casado** (gradiente em diagonal,
  contorno no tom profundo, sombra leve e a cor do texto por contraste), já sabe o **brilho**
  (lustro na própria rampa e a dobra como forma-capa) e o recálculo **vivo** (trocar a cor ou o
  tema refaz a rampa inteira). Nada muda na tela ainda: a galeria, o fundo e os modelos são as
  rodadas seguintes — o modelo ganhou os campos (`estilo`, `capa`, `bgEstilo`) e o `test:estilos`
  cobre as 55 regras (cor, rampa, esquema, aplicação, capa e recálculo).

- **Desenho assistido: o traço livre encaixa nos eixos**: no modo assistente, um traço que não é
  reconhecido como forma (um "L" com canto arredondado, por exemplo) saía **torto, como foi
  desenhado**. Agora os trechos quase horizontais/verticais viram **retas de verdade** — o "L"
  alguns graus torto sai **reto, com o canto em 90°** — e o que é diagonal de propósito fica como
  está. O encaixe lê a direção numa **janela de pontos** (o tremor que sobra no caminho fino
  enganava a leitura por segmento) e só age em trechos com **3+ segmentos** alinhados.

- **Botão "Ideias de design" na fita** (aba **Design** ▸ grupo **Designer**): as Ideias existiam
  só pela aba do painel lateral; agora o botão abre o painel já na aba das Ideias — o mesmo
  lugar do *Design Ideas* do PowerPoint (aba Design). A aba Design ganhou o grupo **Designer**
  com a estrela do app, e o clique também **mostra o painel** se ele estiver escondido.

- **Sem sombra agora tira a sombra de verdade** (e a família toda): as opções que **removem** um
  formato — **Sem sombra**, **Sem contorno**, **Sem preenchimento**, opacidade de volta a **100%**
  e o ajuste antigo ao mexer nos **cantos** — não surtiam efeito quando aplicadas pela fita ou pelo
  painel. O motivo: o `patchFormas` espalha o resultado por cima da forma original e uma chave
  **apagada** (`delete`) continuava viva na original; agora o campo removido vira `undefined`, que
  o espalhamento respeita. Testes novos prendem cada um dos cinco casos.

- **Popup do Template cabe na janela (e rola com o título à vista)**: com os 19 modelos — mais os que o usuário cria — o popup chegava à **borda inferior** da janela e a última linha ficava **cortada no meio**, parecendo que faltavam modelos. Agora ele tem teto próprio (`min(64vh, 560px)`, menor que os 78vh gerais dos popups da fita) e o título **“Modelos de apresentação” fica fixo** enquanto a grade rola por baixo — e o “Novo modelo” continua sendo o último, alcançável com a rolagem. Três verificações novas no `test:layout`.

- **Ideias de design** (aba nova no painel lateral): mostra **esta lâmina** desenhada em cada
  modelo do catálogo, em cartões clicáveis — clicar aplica o modelo à apresentação inteira. É a
  ideia do *Design Ideas* do **DeckCraft**, offline como lá ("geradas no seu computador"): a
  prévia é a lâmina de verdade reduzida por `transform`, então o cartão mostra exatamente o que
  o clique faz. Junto veio o **catálogo do DeckCraft**: **13 designs novos** — os 8 temas
  originais (Harbor, Ember, Meadow, Nocturne, Paper, Coral Reef, Slate e DeckCraft) e os 5
  esquemas de cor (Grayscale, Ocean, Sunset, Forest e Berry) —, cada um com as próprias cores
  (fundo, texto, acento e secundária) e fonte, no mesmo formato dos modelos do usuário.

- **Conectar formas (Inserir ▸ Diagrama)**: a ferramenta **Conectar** liga **formas que já
  existem** — nada é recriado. Com o modo ligado, passar o mouse sobre uma forma mostra as
  **bolinhas nas quatro bordas** (topo, base, esquerda, direita); o primeiro clique marca a
  **origem** (a bolinha escolhida fica acesa) e o segundo, o **destino**, e a ligação nasce ali
  (clique fora das bolinhas cancela a origem; `Esc` sai do modo). O traço sai com **cantos suaves
  de 90°**, como no Fluxo do Mermaid: alinhado quando as bordas se encontram, um "Z" quando as
  laterais pedem desvio e um "L" quando uma ponta é vertical e a outra horizontal. **A cor
  acompanha as caixas**: a **espinha** (o trecho que sai da origem) sai com a **cor da forma de
  origem** e a **descida final** com a **cor da forma de destino** — as duas partes se encontram
  no mesmo ponto, sem fresta; quando o destino é branco/sem cor, a descida segue a cor da origem,
  e o fim leva **seta**. A ligação fica **presa às duas formas**: mover, redimensionar, trocar a
  cor ou **apagar** qualquer lado **redesenha** (ou remove) o conector na hora; as duas partes
  andam juntas (mesma seleção) e valem como formas comuns — inclusive na exportação do `.pptx`,
  onde viram formas livres.

- **Aplicar animação não deixa mais a forma presa**: a **prévia** (e a prévia que toca ao aplicar
  um efeito, como no PowerPoint) agora **devolve a forma ao normal** quando termina — antes, um
  efeito de ênfase (Ampliar, Girar, Transparência) deixava a forma maior/girada/transparente no
  palco e uma saída (Sumir, Desaparecer, Encolher) a deixava **invisível**, sem jeito de desfazer
  só o estado visual. O **Esc** interrompe uma prévia em andamento e devolve tudo na hora, e
  **trocar o efeito** de uma forma agora usa os padrões do efeito novo (a duração do antigo não
  contamina mais: Ampliar volta a nascer com 2 s).

- **Zoom e marcação ao vivo na apresentação (F5)**: `Ctrl` + roda dá **zoom no ponto do mouse**,
  `+`/`−` aproximam e afastam e **arrastar com zoom move a tela** (o clique parado continua
  avançando), com um chip no HUD mostrando a porcentagem — clique nele, `Z` ou `Esc` voltam a
  100%. E dá para **marcar a lâmina durante a fala**: **caneta** (`P`), **marca-texto** (`H`) e
  **borracha** (`E`; `Shift+E` limpa a lâmina), com o traço desenhado num canvas **dentro da
  lâmina** — ele acompanha o zoom e a marcação fica guardada **por lâmina**. Os três botões
  entraram no HUD e a ajuda (`?`) lista os atalhos novos.

- **Nova lâmina vai para o fim**: o botão **+ Nova lâmina** (que fica no fim da faixa) e o
  **Nova lâmina** da fita criavam a lâmina **logo depois da atual** — onde você estava olhando —
  e ela parecia fora de lugar. Agora a lâmina nova entra **no fim** da apresentação (herdando
  fundo e decorações da lâmina atual, como antes) e já fica selecionada, com a faixa rolando até
  ela; as dicas dos dois botões passaram a dizer "no fim".

- **Apresentação sem a "caixa de seleção"**: no modo apresentação, passar o mouse sobre uma forma
  acendia o **contorno de hover/seleção** do editor por cima do desenho (o editor reativa o
  ponteiro nas formas e o contorno vinha junto). Agora a apresentação é só leitura: nada de
  ponteiro nas formas e os contornos de hover/selecionado desligados no deck.

- **Vídeo em lâmina importada volta a preencher o quadro**: o vídeo era desenhado dentro de um
  invólucro sem estilo (o `height:100%` caía para o tamanho natural, ~300×150), então a área do
  vídeo ficava transparente e **os cartões de trás apareciam através dela** (na lâmina 8 do deck
  IMCOPA, os cartões escuros com as imagens "600 × 400" que o Google Slides esconde atrás do
  vídeo). Agora o vídeo vai direto no quadro e **recorta ao quadro** (`object-fit: cover`, como
  no PowerPoint/Google — antes era `contain`, com tarjas pretas). De quebra: a **capa** de um
  deck importado (`media:ID`) não passava pelo resolvedor de mídia e o atributo `poster` saía
  cru — a miniatura e o editor ficavam sem a capa; agora é resolvida (blob/data).

- **Botão Apresentar na barra superior**: com uma apresentação aberta, o botão **Apresentar**
  aparece na barra de cima (entre o menu **⋯** e os controles da janela) e começa a apresentação
  na hora — o mesmo caminho de **Exibir ▸ Apresentar**. Ele só existe com uma apresentação ativa:
  nos outros documentos some sozinho (`body.ppt-open`).

- **Fluxo do Mermaid na lâmina**: em **Inserir ▸ Fluxo do Mermaid**, colar um `flowchart`
  (TD/TB/LR/RL; nós `A[Texto]`, `A(Texto)`, `A((Texto))` e `A{Texto}`; setas `-->`, `---`,
  `-.->`, `==>`; rótulo `-->|texto|` ou `-- texto -->`) cria **cartões nativos** ligados por
  **conectores de cantos suaves** — a linha é uma **forma livre com curvas de 90°** no lugar
  do canto reto, com seta no fim (o `---` sai sem seta) e tracejado no `-.->`. O nível de cada
  nó sai do encadeamento das setas (com guarda de ciclo), a ordem dentro do nível segue os
  pais e o conjunto sai centrado na lâmina. Numa lâmina recém-criada o fluxo usa ela (que vira
  "Em branco"); se a atual já tem conteúdo, o fluxo ganha uma **lâmina nova em branco** logo
  depois — nada fica por baixo. Os cartões e os conectores são formas comuns (mover, colorir,
  agrupar, editar texto) e o `.pptx` guarda igual: cartões como formas do PowerPoint e
  conectores como forma livre com a seta.

- **Desenho livre suave**: o traço que o assistente não reconhece saía como uma **polilinha** (as
  quinas da simplificação ficavam visíveis). Agora ele passa por uma **média móvel** (tira o
  tremor da mão, sem mexer nas pontas) e vira **curvas cúbicas** (Catmull-Rom) — o desenho livre
  sai limpo e fiel ao traço, na tela e no `.pptx`.

- **Draw enxerga as formas de baixo e o arco segue curvas largas**: traçar o contorno de uma
  forma existente (mesmo **apagada** — a cor não importa, o app lê a geometria) agora sai
  **alinhado a ela**: a forma reconhecida (ou o desenho livre) encaixa nas bordas e nos centros
  das formas de baixo quando está perto. E o arco deixou de ser só de círculo: o ajuste virou
  **elíptico** (cônica alinhada em uma passada), então uma curva larga — o topo de uma caixa —
  sai com o raio e a proporção do traço, em vez de virar "meio círculo". O arco também passou a
  ser conferido **antes** da reta (uma curva rasa virava linha).

- **Escolha do painel com a cara do app**: os grupos de escolha do painel do PowerPoint
  (preenchimento: **Do tema / Sólido / Gradiente / Imagem**, e os demais) usavam o controle
  nativo — círculo pequeno e a escolha marcada só com um anel do sistema. Agora o **círculo é
  desenhado pelo app** (maior, com o ponto na cor de destaque e um halo suave no escolhido) e
  **a linha inteira do escolhido fica destacada** (fundo suave, borda na cor de destaque e
  texto em semibold), com hover na linha e foco visível pelo teclado. Vale para todos os
  grupos do painel (preenchimento, contorno, âncora e os demais).

- **Botão direito + arrastar move a tela no PowerPoint**: com o zoom alto (até 800%), navegar
  era só pela barra de rolagem — agora **botão direito pressionado + arrastar** move a tela em
  qualquer direção, com o cursor virando "agarrando" e o arrasto acompanhando o ponteiro
  (nada de soltar e pegar de novo a cada tela). O **clique direito parado continua abrindo o
  menu de contexto**: o arrasto só conta depois de 3 px e, quando conta, o menu não abre.

- **Ícone da Formas alinhado**: o preview da forma no botão **Formas** seguia um tamanho próprio
  (30 px) em vez do tamanho dos outros ícones — na **fita baixa** ele ficava maior que o botão e
  vazava para fora; e o desenho dentro do ícone saía **3 px abaixo do centro** (o `viewBox` não
  era simétrico). Agora ele acompanha o ícone grande (fita normal) e o normal (fita baixa), e o
  desenho fica centrado — vale também para as miniaturas da galeria.

- **Zoom do PowerPoint até 800%**: o teto era 400%; agora o slider, o **+ / −** e o
  **Ctrl + roda** vão a **800%** (a lâmina é HTML/vetorial, então ampliar não perde nitidez, e
  a rolagem continua de verdade). Para a faixa nova não custar 70 cliques, o passo do botão e
  da roda **cresce com o nível** — 10% até 150%, 25% até 250%, 50% até 500%, 100% daí em
  diante (do 100% ao 800% em ~17 passos) —, o mesmo conceito que as pranchetas de desenho já
  usavam; o slider continua fino (10%).

- **Dica das alças de canto no visual do app**: o balão nativo do sistema (`title`) saiu; passar o
  mouse numa alça de canto mostra uma caixa do próprio app com **"Canto superior direito · 40%"**
  (valor em destaque) e a dica de uso — **"Arraste arredonda os 4 cantos escolhidos · Shift+clique
  soma ou tira"** (o texto acompanha quantos cantos estão na escolha). A caixa abre para o lado de
  dentro da lâmina (direita→esquerda nas alças da direita, cima→baixo nas de cima) e **some durante
  o arrasto**, quando quem manda é o aviso com o valor ao vivo.

- **Correção no Draw**: o retângulo desenhado torto (a mão nunca acerta o ângulo) virava
  **retângulo arredondado** e a forma saía maior que o traço — o arredondamento era medido na
  caixa alinhada aos eixos. Agora o traço é **endireitado antes de medir** (a inclinação sai da
  aresta mais longa) e a caixa **acompanha o desenho**; o que separa "arredondado" de "elipse"
  passa a ser a existência de **lados retos**. O **arco** também entrou: um traço curvo que
  segue um círculo (o "canto arredondado") vira uma forma de **arco** de verdade, com o raio e
  o trecho desenhados. E o **Draw saiu da galeria de Formas**: agora é um botão próprio no
  grupo **Desenho** da aba **Inserir**.

- **Desenho à mão assistido (Draw)**: na aba **Inserir**, o botão **Draw** (grupo Desenho) —
  liga o lápis e você **rabisca na lâmina**; ao soltar, o app **refaz o traço por cima** com a
  forma exata (**retângulo, retângulo arredondado, círculo/elipse, triângulo, linha, seta e
  arco**), no mesmo lugar e tamanho, já como forma normal (editável, medidas em cm e ida e volta no `.pptx`).
  O que não for reconhecido fica como **desenho livre** (também preservado no arquivo); a
  **barrinha do pincel** traz cor, espessura (1–8 pt) e o interruptor do assistente, com dica do
  que está sendo entendido enquanto desenha; **Esc** sai do lápis. Testes: `npm run test:desenho`.

- **Fita do PowerPoint sem o botão "Selecionar tudo"**: o grupo **Edição** (que só tinha esse
  botão) saiu da aba Página Inicial — **Ctrl+A** e o clique direito no vazio seguem selecionando
  todas as formas.

- **Abrir e salvar `.pptx` com fidelidade** (formas, fundos, imagens, texto por trecho,
  decorações de layout/mestre, cores do tema, notas, fontes embutidas) — ≈2% de diferença
  média para a referência; o que não reproduz é avisado.

- **Editor de formas**: galeria, desenhar arrastando, 8 alças, girar, guias de encaixe,
  seleção múltipla, agrupar, ordem, alinhar, distribuir, copiar/colar e desfazer.

- **Texto formatado por trecho**: marca-texto, sobrescrito, versalete, espaçamento, caixa e
  limpar formatação.

- **Tabelas** (`a:tbl`) com edição de células, mesclar/dividir, linhas/colunas, estilos, bordas.

- **Gráficos**: inserir, editar dados no painel, desenho em SVG e exportar como imagem.

- **Mídia**: inserir áudio/vídeo, tocar no F5 (corte/volume/loop) e ida e volta no `.pptx`.

- **Transições de lâmina** (galeria, direção, duração) no F5 e no arquivo.

- **Lâminas**: reordenar arrastando (topo ou vertical), ocultar, renomear, resetar, duplicar.

- **Modelos**: botão **Template** (tema/cores/fonte) e modelos do usuário (cartões).

- **Modo apresentação completo**: navegar, tela preta/branca, fade e notas do apresentador.

- **Fita** com abas (Página Inicial, Inserir, Formato da Forma, Layout da Tabela, Design,
  Exibir), recolhível/ajustável e com rolagem; **painel Formatar/Notas** redimensionável.

- **Zoom até 400%** ancorado no ponteiro; faixa de lâminas no topo ou na vertical.

- **Configurar apresentação**: proporção, tema, fonte padrão, tamanho, rodapé e número.

- **Checklist de paridade revisado** contra o código atual e contra o projeto **DeckCraft** real
  (232 comandos): itens que já existem passam a aparecer como feitos (Transições, ocultar/
  renomear/redefinir lâmina, marca-texto, sobrescrito/versalete, mudar caixa, ir para lâmina,
  tela preta/branca), o resumo vai a **102/191** e entra o **mapa de edição** — 14 áreas do que o
  DeckCraft edita e falta aqui, com os ganhos rápidos e os próximos passos reordenados
  (`docs/paridade-deckcraft.md`).

- **Animações de forma** (aba nova): entrada e saída — **Aparecer**, **Surgir**, **Desaparecer** e
  **Sumir** — por forma, com início (**Ao clicar**, **Com anterior**, **Depois do anterior**),
  duração nos efeitos suaves (0,5/1/2 s), ordem (↑↓), **Remover** e **Prévia** no palco. As
  formas animadas ganham **selos numerados** no editor e, no F5, os efeitos tocam na ordem (o
  clique primeiro toca o efeito pendente e só depois troca de lâmina). O `.pptx` faz **round-trip
  do `p:timing`**: o que o modelo não representa (ênfase, trajetórias, por parágrafo, gatilhos…)
  volta cru, com aviso na importação.

- **Animações, degrau 2**: **ênfase** — **Pulsar**, **Ampliar/Reduzir**, **Girar** e
  **Transparência** — com duração padrão por tipo, **atraso** por efeito ("Sem" a 2 s) e a
  galeria reorganizada em **Entrada/Ênfase/Saída** (as mais usadas na fita + **Mais animações**).
  Entra o **painel de animação** na aba lateral: a lista da lâmina na ordem, com selecionar,
  mover (↑↓) e remover item a item. O round-trip do `p:timing` cobre tudo isso (ênfase por
  escala/rotação/opacidade, `autoRev` do pulsar e o atraso no `p:cond`).

- **Animações, degrau 3**: **trajetória em linha** nas quatro direções (a forma anda 25% da
  lâmina; a direção se escolhe no grupo **Direção**), com prévia, F5 e round-trip do
  `p:animMotion` (presetID 64 e os subtypes do PowerPoint: cima 1, direita 2, baixo 4, esquerda
  8); o cartão **Trajetória** entra na fita e o grupo **Trajetórias** no "Mais animações".
  **Correção**: o despacho da fita do degrau 2 tinha dois `slice` com um caractere a mais — os
  botões "Com anterior"/"Depois" e as durações de 1 s/2 s não chegavam ao motor (caíam no padrão
  em silêncio). Agora um **teste de contrato** confere cada prefixo do despacho contra o `slice`.

- **Animações, degrau 4**: **por parágrafo** — a caixa no grupo **Texto** faz cada parágrafo do
  texto entrar num passo próprio: um clique por parágrafo no "ao clicar"; "com o anterior" e
  "depois" encadeiam sozinhos. O `.pptx` escreve um efeito por parágrafo **não vazio** (`pRg`) com
  `bldLst build="p"` e o importador colapsa o build de volta numa animação; se a cobertura dos
  parágrafos não bater com o texto da forma, o timing volta cru, com aviso.

- **Animações, degrau 5**: os presets clássicos **Voar** e **Zoom** (entrada) e **Voar fora** e
  **Encolher** (saída), com o **Voar escolhendo a borda** no grupo Direção (padrão "de baixo", como
  o PowerPoint). A forma voa de fora da lâmina (medida na hora), o zoom cresce do centro com fade
  e o encolher termina invisível. Round-trip do `p:timing` com `anim` de `ppt_x`/`ppt_y` (tavLst
  de/para), escala 0–100% e fade; diagonais e as variantes do zoom (subtype 16/32) ficam crus,
  com aviso.

- **Animações, degrau 6**: os presets de revelação **Limpar** e **Limpar fora** (com a **borda
  escolhida** em Direção), **Caixa**, **Círculo** e **Losango** (abre do centro na entrada, fecha
  na saída) — a galeria passa a **21 efeitos**. A prévia e o F5 usam recorte (`clip-path`): o
  limpar varre a partir da borda, as outras abrem do centro. Round-trip do `p:timing` com
  `animEffect` de `filter` (`wipe(up|down|left|right)`, `box(in|out)`, `circle(in|out)`,
  `diamond(in|out)`) e subtypes 16/32; filter ou subtype fora do padrão volta cru, com aviso.

- **Animações, degrau 7**: os clássicos de textura **Dividir** (abre do centro para os lados),
  **Persianas** (faixas horizontais), **Dissolver** (pontinhos) e **Roda** (uma volta como um
  ponteiro), com as saídas "fora" — a galeria passa a **29 efeitos**. O F5 desenha as texturas
  por **máscara** (a variável registrada `--reveal` anima dentro do gradiente; o dividir usa
  recorte) e o `.pptx` faz round-trip do `p:timing` com `filter` (`barn(in|outHorizontal)`,
  `blinds(horizontal)`, `dissolve`, `wheel(1)`) e subtypes 21/42, 10, 0 e 1; as outras variantes
  do PowerPoint (verticais, dois ponteiros…) ficam cruas, com aviso.

- **Diálogos do app no lugar de janelas do sistema**: **Novo modelo** (botão Template) e
  **Renomear lâmina** agora usam o diálogo de texto do app — com o tema, dica, Enter/OK,
  Esc/Cancelar e clique fora; ao criar, a galeria reabre já com o cartão novo.

- **Avisos do F5**: "documento sem conteúdo" e "todas as lâminas ocultas" viraram toasts do app
  (antes eram `alert` nativos).

- **Seleção do app na fita, no painel e no “Configurar apresentação”**: fonte/tamanho da fita, os
  campos do painel (transição, animação, layout…) e os três do diálogo de configuração trocam a
  lista cinza do sistema pelo menu suspenso do app.

- **Cantos por canto (assistido)**: dá para escolher **quais cantos** mudar — clique na alça do
  canto no palco (`Shift` soma/remove; 1, 2, 3 ou 4) ou nos cantos do mini-diagrama do painel — e
  arrastar arredonda **só os escolhidos**, com precisão (passo de 0,5%; `Alt` = 0,1%) e o valor na
  tela; duplo clique na alça deixa o canto quadrado. Presets **Quadrado · Padrão · Suave · Pílula**
  e atalhos **Todos/Opostos**; vale para formas, caixas de texto, imagens (máscara) e tabelas.
  No arquivo, o app grava a forma **nativa** mais fiel (Retângulo arredondado, um canto, par de
  cima/baixo ou diagonais) e avisa quando o arranjo só existe como **forma livre** — que desenha
  igual, como o “Combinar formas” do PowerPoint.

- **Cantos: o clique escolhe só aquele canto (e o grupo iguala tudo)**: clicar numa alça de canto
  agora escolhe **só ela** no ajuste (antes, com os quatro marcados, o clique mantinha os quatro e
  o arrasto mexia em todos); clique **parado** num canto já marcado deixa só ele, `Shift+clique`
  soma/remove **sem arrastar** (não muda valor sem querer) e o arrasto mexe **apenas nos cantos
  escolhidos**, com cada canto guardando o valor que tinha. Com **várias formas selecionadas**, o
  quadro do grupo ganha as quatro alças: arrastar (ou usar os presets do painel) iguala os cantos
  de **todas as caixas** de uma vez, e o painel avisa quando as formas têm valores diferentes.

- **Fita e painel com os campos no lugar**: o campo de **tamanho** vazio volta a ficar **em
  branco** (mostrava um “—” que parecia erro — é assim que o PowerPoint mostra tamanho misto) e
  os seletores de **fonte/tamanho** ficam na **mesma altura dos botões** (26 px). No grupo Fonte,
  o `A▼` de diminuir agora **desce** (era sobrescrito como o `A▲`) e a setinha de menu dos botões
  de cor (A/ab) mora **dentro** do botão, sem estourar a linha. E no painel a **lista aberta** de
  um seletor não morre mais quando o painel se redesenha (antes a escolha era perdida).

- **"Nova lâmina" e "Layout" com galeria de miniaturas**: os dois menus eram uma lista de nomes;
  agora abrem uma **grade de 2 colunas** com a **miniatura de cada layout** — os espaços como
  silhuetas cinzas (barra do título, linhas do corpo), na proporção do deck (16:9 ou 4:3) e com o
  nome embaixo. No "Layout" o layout atual vem destacado. A miniatura sai do MESMO dado que monta a
  lâmina nova (`caixasDoLayout`): mudou um layout, ela acompanha sozinha.

- **Fonte e tamanho livres na fita**: o campo mostra o tamanho/fonte que o slide **tem** (os
  **41, 27 e 17 pt** do deck de referência aparecem na lista, mesmo fora dos “redondos”) e aceita
  **digitação** — qualquer tamanho (com vírgula, de 1 a 4096) ou qualquer nome de fonte; tamanho
  misto fica em branco e digitar aplica a todos os trechos. A lista de fontes do app ganhou as
  clássicas do Windows/Office e o diálogo **Configurar apresentação** passou a usá-la.

- **A roda do mouse troca de lâmina**: com o ponteiro sobre a lâmina, girar a roda **sobe/desce
  uma lâmina por gesto**, como no PowerPoint (um “tapa” não passa várias — a inércia do mesmo
  gesto é engolida). Com a lâmina **ampliada**, a roda rola o quadro primeiro e só troca quando
  chega ao fim (ou quando a lâmina inteira está à vista). `Ctrl` + roda continua sendo o **zoom**.

- **Modo apresentação (F5) redesenhado**: a lâmina agora **cobre a tela do app** (full-bleed — só as
  barras laterais do formato) e a barra virou um **HUD que se esconde sozinho**: barra e cursor somem
  depois de um tempo sem mexer e voltam com qualquer movimento. Ele traz progresso, navegação `‹ ›`,
  contador clicável, **grade de lâminas** (`G`, com a miniatura real de cada uma), **tempo decorrido**
  (`T`), notas (`N`), tela preta/branca (`B`/`W`), **laser** (segure `L` ou `Ctrl`), ajuda (`?`) e
  Encerrar (`Esc`). A **roda do mouse** e o **botão direito** também navegam, e o `Esc` fecha a
  grade/ajuda antes de sair. De quebra, a lâmina sem fundo próprio passa a usar o **fundo do tema**
  — antes o tema escuro ficava com texto claro sumindo no branco do palco.

- **Desenho assistido acertado (curvas)**: o traço desenhado **torto** agora vira um **arco girado**
  no mesmo ângulo do desenho - o ajuste passou a procurar a elipse **com orientação** (antes só
  existia o ajuste alinhado aos eixos: a elipse saía grande e a curva ficava longe do traço, o
  "não se encaixa" do relato). A validação também ficou mais rígida: elipse em forma de "faca"
  (duas retas com um canto, por exemplo) **não vira arco** - vira desenho livre - e o **desenho
  livre** ganhou **duas passadas de suavização** com passo de simplificação mais fino (o "cheio de
  falhas" do serrilhado da mão).

- **O "Configurar apresentação" saiu**: o diálogo não tinha mais função. O **Tema** virou a aba
  **Design** (Tema + **Template**, com os 13 designs do catálogo e as **Ideias de design**) e
  **fonte/tamanho** são da fita (Fonte) e dos modelos. Saíram o botão **Configurar** da barra da
  fita e o **Tamanho** de Design ▸ Personalizar (o grupo ficou só com **Formatar fundo**), junto do
  diálogo (`askPptSetup`/`configurePpt`) e da fiação `onConfigure` do host do PowerPoint. A
  **proporção, o rodapé e o número da lâmina** continuam valendo para os decks (importados,
  exportados e salvos) — só não têm mais esse editor. O **"Configurar planilha"** do Excel fica
  como está.

- **Prévia das sombras na galeria "Efeitos" (tema escuro)**: a prévia era um retângulo com o fundo
  do próprio painel e a sombra desenhada **por fora** dele — no tema escuro a sombra preta caía
  sobre o menu escuro e a galeria ficava **sem prévia nenhuma**. Agora cada opção desenha a
  **forma** (um quadradinho claro) sobre uma **mesa de tom médio**: a sombra preta e o brilho
  branco aparecem nos dois temas, com recorte na mesa e o deslocamento da prévia em 80% do real
  para caber. Vale para os seis presets (inclusive **Brilho suave**); 4 verificações novas em
  `npm run test:layout`.

- **Conectar sem piscar e na caixa certa**: o alvo das bolinhas do modo **Conectar** passou a ser
  **geométrico** — a bolinha manda, depois a **caixa de cima** e, sem nada embaixo do ponteiro, a
  forma atual fica enquanto o ponteiro anda **perto** dela (histerese). Pelo DOM, a fresta de ~6 px
  em volta da caixa (onde a bolinha pende para fora) pertence à caixa **de baixo** e a própria
  linha da ligação roubava o ponteiro: com duas caixas sobrepostas as **bolinhas piscavam** e a
  ligação saía **na caixa errada** (relato do usuário). O clique também ficou com folga (~8 px) e
  os **conectores saem do alvo**.

- **"Duplicar lâmina" no clique direito da miniatura (e na aba Inserir)**: o clique direito na
  miniatura caía no **menu do navegador** (Voltar/Atualizar/Salvar como/Imprimir/Inspecionar) —
  nada a ver com a lâmina e sem o "Duplicar lâmina" que se procura ali. Agora abre um **menu do
  app** com **Duplicar lâmina**, **Nova lâmina no fim**, **Renomear…**, **Ocultar/Mostrar na
  apresentação** e **Excluir lâmina** (desabilitado com uma só), agindo na **lâmina clicada** —
  como o × de excluir já fazia. O botão **Duplicar** (que já existia pequeno na Página Inicial)
  também entrou na aba **Inserir**; 5 verificações novas em `npm run test:layout`.

- **Redesign da aba Animações** (pedido do usuário): a aba deixou de ser uma fila de oito grupos
  soltos. São **sete**, na ordem em que se pensa a animação: **Animação** (galeria + **Mais**),
  **Início**, **Direção**, **Tempo** (**duração e atraso na mesma casa**, cada linha com o próprio
  rótulo), **Texto**, **Ordem** e **Animar**. As escolhas de cada linha viraram **controles
  segmentados** — o escolhido fica aceso, em vez de botões soltos que não diziam ser alternativas
  entre si — e **Por parágrafo** virou um **chip que acende** quando está ligado. Na galeria, o
  cartão **Mais** entrou na fileira com o mesmo desenho dos efeitos, o **escolhido ganha o selo de
  conferido**, os nomes foram alargados para caber inteiro (sem "Desapa…") e **sem forma escolhida
  a galeria aparece apagada** (antes ela tinha a cara de sempre e o clique morria em silêncio). No
  grupo **Ordem**, o **número da vez** aparece ao lado das setas (**2/3** = a 2ª de 3 animações da
  lâmina) e o botão novo **Painel** abre o painel lateral já na lista de animações, ficando **aceso**
  enquanto é ela que está à mostra. O popup **Mais** ganhou cabeçalho dizendo **em qual forma** o
  efeito vai cair e cartões maiores (nada de "Transparên…"). Nada mudou no motor: mesmos efeitos,
  mesmo `.pptx` de ida e volta. O desenho está preso por **10 verificações** novas em
  `npm run test:layout` — inclusive a **largura do cartão**, medida no harness: o nome
  "Desaparecer" ocupa **61 px** de texto, e em cartões de 54 px ele saía cortado.
- **O painel lateral se encaixa na janela**: a fileira de abas (Formatar, Animação, Notas, Ideias,
  **Arranjos**) precisava de 326px num painel de 260 — a última aba ficava **cortada** (o "Arranjos"
  da captura) e o painel ainda empurrava o palco para fora. As abas agora **quebram de linha**
  quando não cabem e o painel encolhe com a janela: largura e conteúdo usam
  `min(var(--pp-side-w, 260px), 100%)` (o piso de 200px vale quando cabe; a largura escolhida no
  arrasto continua valendo). Medido no navegador em 1400/900/700/560/**420px**: nada vaza em
  nenhuma largura e em 420 o painel fica com 143px **dentro** da janela (antes terminava 116px
  fora do app).

## Geral

### Não adicionado (fora da main)

**Backend**

- **Pastas e documentos mexidos pelo próprio app**: três comandos novos em `files.rs` — `move_file`
  (move um documento para outra pasta **sem sobrescrever**: ganha `-1`, `-2`… se o nome já existir),
  `rename_folder` (renomeia a pasta mantendo a pasta-mãe, também sem sobrescrever) e `delete_folder`
  (exclui **apenas pasta vazia** — um documento nunca sai por engano). O `create_folder` passou a
  reaproveitar o mesmo saneamento de nome. A árvore de projetos (`list_markdown`) agora inclui as
  **pastas vazias**: é onde se cria uma pasta nova e para onde se arrasta um documento logo depois.

**Frontend**

  markdown passa pelo saneamento, como todo HTML de fora no app.

- **O README fala da suíte, não de "imitar o Office"**: as frases "construir o Office inteiro" e "os programas do
  Office" viraram "construir uma **suíte de documentos** inteira" e "os **editores da suíte**". As menções que
  continuam são nomes próprios (mdOffice, MDOFFICE, o endereço do repositório e o LibreOffice, de onde vêm os
  dicionários) — nenhuma delas sugere imitação.

- (nada no momento)

- **Os módulos agora se chamam pelo formato, não pela marca da Microsoft**: na interface, "Word",
  "Excel" e "PowerPoint" viraram **Documentos (.docx)**, **Planilhas (.xlsx)** e
  **Apresentações (.pptx)** — nos cartões e filtros do Início, no menu "+", na paleta de comandos
  (Ctrl+K), nos menus de exportar/importar, nas dicas das abas, nos avisos e nos diálogos de
  salvar. É o formato que identifica cada módulo; dizer que o app abre e salva `.docx`, `.xlsx` e
  `.pptx` continua sendo uso descritivo e aceito. As **subpastas padrão** também mudaram
  (`Documentos/`, `Planilhas/`, `Apresentações/`): as antigas (`Word/`, `Excel/`, `PowerPoint/`)
  são renomeadas uma vez, e se o nome novo já existir nada é movido nem juntado (nenhum arquivo
  se perde). O Markdown não é marca e ficou como está; os arquivos de código e os nomes internos
  (`src/word`, `src/excel`, `src/powerpoint`) não mudaram. Teste: `npm run test:layout`.

- **O menu dos grupos da fita abre e fica (o controle de dentro volta a ser clicável)**: com a faixa
  apertada, o grupo que não cabe vira um **botão com menu** — mas o menu **abria e sumia no mesmo
  tique**: o `hidden` que o próprio menu liga/desliga re-disparava o re-planejo do encaixe, e o
  `aplicar()` **fecha o menu** antes de medir. Com a faixa estreita, **todo controle de um grupo
  recolhido ficava inalcançável** — o relato veio pelo **Assistente** do Draw ("não tem como clicar
  no assistente para desativar ele"), que mora no grupo **Traço**. Agora o observador do encaixe
  **ignora as mudanças de `hidden` dentro do menu** (elas não são "a aba trocou"): o menu abre,
  fica, e o comando de dentro roda — o clique desliga o Assistente e a escolha fica guardada. Vale
  para as três fitas (Word, Excel e Apresentações).

- **A faixa de opções não se recolhe mais sozinha**: o modo recolhido tinha o "por enquanto" — no
  modo recolhido (a **faixa única**) a faixa abria completa com um clique numa aba e **voltava ao
  recolhido ao primeiro clique fora dela** (na lâmina, num comando, depois de um popup). Cada
  caminho desses virou um relato de "a faixa recolheu do nada", e o último é o pior: **trabalhar na
  lâmina** (escolher a forma que se vai formatar) recolhia a faixa no meio do uso. Agora **abrir é
  um pedido**: clicar numa aba (ou no Template) mostra a faixa **e a escolha fica** — a preferência
  é guardada, como a do **Ctrl+F1**, que continua alternando e passa a ser o único gesto que
  recolhe. A marca `app-popup`, que existia só para a regra antiga reconhecer os popups do app,
  saiu dos quatro criadores.

- **A faixa de opções não se recolhe mais sozinha**: o modo recolhido tinha o "por enquanto" — no
  modo recolhido (a **faixa única**) a faixa abria completa com um clique numa aba e **voltava ao
  recolhido ao primeiro clique fora dela** (na lâmina, num comando, depois de um popup). Cada
  caminho desses virou um relato de "a faixa recolheu do nada", e o último é o pior: **trabalhar na
  lâmina** (escolher a forma que se vai formatar) recolhia a faixa no meio do uso. Agora **abrir é
  um pedido**: clicar numa aba (ou no Template) mostra a faixa **e a escolha fica** — a preferência
  é guardada, como a do **Ctrl+F1**, que continua alternando e passa a ser o único gesto que
  recolhe. A marca `app-popup`, que existia só para a regra antiga reconhecer os popups do app,
  saiu dos quatro criadores.

- **Pastas dos projetos: navegar, organizar e mover documentos sem sair do app**: o painel
  **Projetos** ganhou uma **trilha de caminho** (projeto › subpasta › subpasta) com **botão Voltar**
  que percorre as pastas visitadas; clicar num nível da trilha abre a árvore até ele. Dá para
  **criar uma pasta** (botão que aparece na linha da pasta ou "Nova pasta aqui" no clique direito) e
  **renomear**/**excluir** as subpastas (só pasta vazia, com confirmação) — tudo pela própria barra
  lateral. E **mover um documento** é **arrastar a linha dele e soltar em cima da pasta de destino**:
  o app salva o que estiver aberto, move o arquivo, acerta a aba, os recentes e o histórico de
  versões, e avisa quando o documento é Markdown com imagens em `assets/` (elas ficam na pasta
  antiga). A pasta em foco ganha realce e a de destino abre sozinha depois do arrasto.
- **O checklist "Paridade com o DeckCraft" virou o roadmap de funcionalidades**: o documento era um
  checklist de "o que falta para alcançar a referência" — e isso podia ser lido como cópia de
  funcionalidades, contradizendo o que o README afirma (o DeckCraft é **inspiração de produto**; a
  implementação é própria). Agora ele é o **roadmap do módulo de Apresentações**: título e
  introdução próprios, **áreas e itens em português**, prioridades **do roadmap** (não as da
  referência), uma única menção à inspiração (no topo, com o link do README) e uma seção de
  **decisões de produto** com o que fica **fora** do roadmap (formato próprio de trabalho, menu
  nativo do macOS e BSD). As contagens por área foram refeitas **a partir dos itens** (**112 de 188**
  prontos) — a versão antiga divergia entre o resumo e os cabeçalhos. O arquivo passou a se chamar
  `docs/roadmap-funcionalidades.md`, e o README e a lista de funcionalidades apontam para ele. Feito
  só de documentação: nada do app mudou.

**Ferramentas (dev)**

- `npm run test:salvamento` confere os três comandos novos de `files.rs` (a conta de comandos
  `async` passou de 7 para 11: o valor antigo já estava desatualizado); o `cargo test` cobre mover
  entre pastas, renomear pasta e recusar excluir pasta com conteúdo.

### Adicionado (na main)

**Backend**

- **A tela Início ganhou a prévia dos documentos** (`preview_file`): um comando novo que devolve o
  começo do texto de um arquivo — o `.md` lê o próprio texto, os formatos do Office (.docx/.pptx/
  .xlsx) abrem o zip e tiram o texto do XML principal (documento, primeira lâmina, textos
  compartilhados). O zip é lido direto do arquivo (sem trazer os bytes para o lado TS) e qualquer
  falha devolve prévia vazia — a tela nunca quebra por um arquivo que sumiu. Teste no `cargo test`.

- **Limite do cache do WebView (lado nativo)**: a janela do app passou a ser montada pelo
  `lib.rs` (o `tauri.conf.json` ficou com `windows: []`) porque o `--disk-cache-size` precisa
  chegar **junto com o WebView** — o arquivo de configuração é compilado no app e não dá para
  mudá-lo em tempo de execução. A escolha fica em `cache.json` na pasta de dados (MB; 0 =
  automático), o `preparar_webview()` marca o que ficou valendo na sessão e os padrões do wry
  (`msWebOOUI`, `msPdfOOUI`, `msSmartScreenProtection`) continuam nos argumentos. Os comandos
  novos (`storage_cache_config`/`storage_set_cache_limit`) validam o teto contra a lista da tela,
  e o `storage_report` passou a devolver `cache_bytes` — a soma só das pastas de cache do perfil
  (dentro de `EBWebView\Default`), sem preferências e sem contar duas vezes o
  `Service Worker\CacheStorage`.

- **Salvamento automático em pasta de rede (UNC/SMB) não trava mais a interface**: os comandos
  de arquivo e de backup passaram a rodar no pool de tarefas do Tauri (`#[tauri::command(async)]`).
  No Tauri 2 um comando síncrono roda na **thread principal** — e ler/gravar num share de rede
  (centenas de ms a segundos por operação) travava a janela e filava o IPC a cada salvamento. Cada
  salvamento também gasta **uma ida ao disco a menos** (não checa mais `exists()` da pasta antes de
  gravar: a pasta é criada só quando a gravação responde "não encontrei" e tenta de novo) e a cópia
  de backup lê o documento **uma única vez** (antes o `same_bytes` + `fs::copy` reliam o original
  por raiz, em série — 4 leituras de rede por cópia com duas pastas).

- Comandos Rust/Tauri: **arquivos** (abrir/salvar), **assets** (copiar imagens com nome limpo),
  **rascunhos**, **projetos** (árvore), **busca** no conteúdo, **pacote IA** (.zip) e **backup**.
- **App renomeado no lado nativo**: crate `mdoffice`, lib `mdoffice_lib`, identificador
  `com.mdoffice.desktop` e binário/processo `mdoffice`. Na primeira execução com o nome novo,
  uma **migração** copia a pasta de dados antiga (`%LOCALAPPDATA%\com.mdcreator.desktop` →
  `com.mdoffice.desktop`) — rascunhos, backups e preferências não se perdem.
- Testes dos comandos (`commands/tests.rs`).
- Tauri com o recurso **`image-png`** e a permissão **`core:window:allow-set-icon`**, para o app
  trocar o ícone da janela em tempo de execução.
- `Cargo.lock` sincronizado com a feature **`image-png`** (crates `image`, `png`, `byteorder-lite`,
  `moxcms`), validado com `cargo check --locked`.
- **Lixeira de documentos** (`trash_move`/`trash_purge`): o arquivo sai da pasta do projeto e
  fica em `lixeira/` na pasta de dados do app, com um índice do caminho original; a limpeza
  apaga de vez só o que passou de **30 dias** (roda na abertura e a cada arquivo movido). O
  aviso de backup sabe que o arquivo está na lixeira e não trata como "sumido".
- Comandos do painel de **Armazenamento**: `storage_report` (tamanho da pasta de dados e da
  pasta da versão anterior) e `storage_remove_legacy` (remove a pasta `com.mdcreator.desktop`
  depois da migração); `drafts_folder_path` e o tamanho de cada rascunho (`bytes`). Com teste
  Rust do `soma_pasta` (28 testes no total).

**Frontend**

- **A pílula da barra lateral (o fundo da aba ativa) não desalinha mais**: o tamanho dela era
  **fixo em px** (30×28) e a posição só era medida na **troca de painel** — se o tamanho da aba
  mudasse (um ajuste de estilo, a fonte carregando, o zoom) ou se a barra mudasse de largura, a
  pílula ficava deslocada em relação ao ícone (o print do usuário). Agora o tamanho é **copiado do
  botão ativo** (`offsetWidth`/`offsetHeight`) e a posição é recalculada no **primeiro quadro**,
  no **resize**, quando as **fontes** ficam prontas e quando a **largura da barra** muda
  (`ResizeObserver`). Teste: `npm run test:layout`.

- **A prévia do PowerPoint mostra a lâmina de verdade (não uma página fake)**: os cartões da tela
  Início desenhavam o `.pptx` a partir do **texto** extraído — um papel branco com a primeira linha
  como título e o resto como corpo, que parecia um mockup ("parece algo falso"). Agora o cartão
  **importa o .pptx e desenha a lâmina** com o mesmo renderizador do palco e do F5: fundo do tema,
  formas na posição certa, imagens e o título no tamanho real (16:9 ou 4:3, conforme o arquivo). O
  texto continua como plano B (sem acesso a arquivos ou deck sem formas) e a importação fica em
  cache por leitura. Do lado do texto, a página do cartão mostra mais parágrafos (11 → 16), para o
  papel não parecer vazio. Conferido no navegador com o `.pptx` do usuário (a lâmina real no cartão,
  197×111, com o título no lugar) e em `npm run test:previa` (deck → HTML, com a proporção e o
  fundo do tema).

- **Dá para trocar de aba com o aviso “Salvar alterações?” aberto**: a trava da versão anterior
  impedia consultar outro documento; agora o aviso fica **flutuando sem bloquear o resto do app**
  (o fundo transparente deixa os cliques passarem) e **trocar de aba cancela o aviso** — ele é do
  documento que ia ser fechado e nunca aparece sobre a aba nova.

- **O aviso “Salvar alterações?” ficou com cara de pop-up de verdade**: ganhou **X circular**
  (cancela, como o Esc), uma alça de **9 pontos** no cabeçalho (mostra que dá para arrastar) e o
  fundo **não escurece mais** o documento atrás. E o aviso **não trava a troca de aba**: trocar de
  aba cancela o aviso (ele pertence ao documento que ia fechar) — antes ele ia junto para a aba
  nova, e a resposta podia agir na aba errada.

- **O aviso “Salvar alterações?” agora é arrastável**: o pop-up de confirmação ao fechar uma aba
  com alterações (Word, PowerPoint e Excel) ficava preso no centro e cobria o documento. A barra
  de título virou a alça (pointer events, com captura): arrasta com o mouse/dedo, fica limitado à
  janela e volta ao centro com duplo clique. Botões e campos da barra continuam clicáveis.
- **Arrastar a aba para fora da janela abre o documento numa janela própria**: o gesto da aba (que
  já reordenava) agora detecta o ponteiro **fora da janela** — soltar ali abre o documento numa
  **janela independente** ("quero pegar a aba e arrastar para fora… a aba ganha seu aplicativo de
  forma independente") e tira a aba da janela atual. A janela nova sobe pelo mesmo app com
  `?doc=<caminho>` e abre **só aquele documento**: não restaura a sessão das outras janelas nem grava
  a sessão (a fileira da janela principal continua sendo a dela). Antes de mover, o documento é
  **persistido** como no fechar (arquivo seu pergunta; rascunho é gravado) — a aba só sai depois que
  a janela abriu, e cancelar o "salvar?" não move nada. Sem arrastar (janela maximizada, por
  exemplo), o menu da aba tem **"Abrir em nova janela"**. No navegador de desenvolvimento a janela é
  do navegador (com pop-up liberado). Conferido no navegador: soltar fora chamou
  `index.html?doc=…` e a aba saiu; e a janela `?doc=` não sobrescreveu a sessão (sentinela intacta).
  Teste: `npm run test:layout`.

- **A sessão do navegador não perde mais os documentos no reload (e o 1º documento da sessão
  reaberta não some)**: no modo de desenvolvimento sem Tauri, o autosave gravava **um único**
  `temp/rascunho.md` e nunca o lia — recarregar a página perdia todas as abas. Agora o texto de
  **todas as abas Markdown** vai para o `localStorage` a cada edição/troca de aba e volta no
  reload (com os avisos contando “Salvo neste navegador”). De quebra, o primeiro documento de
  uma sessão reaberta perdia o texto quando outra aba era ativada em seguida:
  `dropPristineStartTab` remove a aba inicial vazia e agora **carrega o estado da aba que assume**
  antes do próximo snapshot.

- **O selo de salvamento não diz mais “Salvo” quando a gravação falhou**: `saveFailed` no
  `DocTab` e o modo `erro` no selo (“Não salvo”); o documento novo que não consegue ir para a
  pasta padrão fica marcado como não salvo (antes o erro aparecia e o selo continuava “Salvo” —
  o falso positivo do print). No **navegador** o “novo documento” não tenta mais a pasta padrão
  (não existe Tauri): a aba nasce como “Novo documento (navegador)” e o autosave guarda na
  sessão do navegador — o erro `Cannot read properties of undefined (reading 'invoke')` sumiu.

- **Ícone na aba do navegador**: o app não declarava favicon (a aba ficava sem ícone); agora usa
  `public/icones/mdoffice-escuro.png` (e o `apple-touch-icon` para a versão instalada).

- **Dev server dentro de worktree serve o código novo (HMR)**: o `watch.ignored` excluía
  `**/.worktrees/**`; quando o Vite roda dentro de uma worktree, esse padrão casa com a raiz
  inteira e nenhuma mudança era vista — o servidor servia módulos velhos até reiniciar (foi o
  que aconteceu nos testes). Fora da worktree a exclusão continua; dentro dela só a worktree
  atual é observada, com **polling** (o watcher nativo do Windows não avisava mudanças na
  unidade A:) e os estáticos grandes (dicionário, n-gramas, modelos) fora da varredura.

- **A lista de fontes/tamanho ficou menor**: o menu do seletor (o campo Fonte da fita, no Word e no
  PowerPoint) abria com **linhas altas e até 330 px** de lista — no print do usuário a lista de
  fontes tomava meia tela. As linhas foram de 3/12 px para **2/11,5 px** (a altura da linha caiu de
  21,5 para 18,5 px) e a lista de 330 para **240 px** de teto (no harness, 253 → 177 px de altura
  visível). Conferido no navegador com `node scripts/harness-seletor.mjs`.

- **A dica não deixa o texto vazar da caixa (caminho longo)**: o balão do app trava em 320 px de
  largura, mas um caminho (ou URL) não tem espaço para quebrar — o texto passava **por fora** da
  caixa e cobria o conteúdo: era o balão do caminho da pasta, no print do usuário, invadindo a
  lista de documentos. Agora o texto quebra **dentro** do balão (`overflow-wrap: anywhere`), no
  ponto que for preciso. Teste: `npm run test:layout`.

- **Os cartões dos Recentes mostram o DOCUMENTO — cada tipo com a sua cara**: o cartão tinha
  sempre o mesmo papel branco com o texto cru (o Word "parecia slide", o Markdown mostrava a
  sintaxe `[Desenho](assets/…)` e o que não dava para ler virava só o ícone). Agora o preview é
  uma **versão do documento pré-carregada**: **Word** e **Markdown** viram uma **página A4 em pé**
  com o **papel do tema** (a folha escurece no tema escuro, o mesmo tom da folha do editor), o
  **PowerPoint** uma **lâmina 16:9** (sempre clara — a apresentação nasce no tema claro) e o
  **Excel** uma **grade** com o cabeçalho das colunas (A, B…) e o número das linhas. O conteúdo é
  o do arquivo: o **markdown chega renderizado** (títulos, listas, negrito, código — e cada imagem
  vira um bloco de figura, porque o cartão não carrega os assets do documento), e o primeiro
  parágrafo vira o **título** da página/lâmina. No **Excel** o `preview_file` (Rust) passou a ler
  `xl/worksheets/sheet1.xml` e devolver as primeiras linhas com as células separadas por TAB —
  antes só saía a lista de textos, sem linha nem coluna, e a grade não existia. Sem texto (ou num
  formato sem prévia), o cartão continua com o ícone do formato; o texto entra escapado e o

- **As Alterações têm nome (o "+6983 −6984" saiu da lista)**: a lista de commits de um documento
  mostrava só números — o tamanho do texto que entrou e saiu —, e numa apresentação não dava para
  saber o que tinha mudado. Agora cada alteração tem um **nome**: numa apresentação, **qual lâmina**
  mudou ("**Lâmina 3 alterada**", "**Lâminas 2 e 4 alteradas**", "**Nova lâmina**", "**Lâmina
  excluída**") e, quando o texto não mudou (cor, forma ou posição — o caso de aplicar um modelo ou
  uma variante), "**Alteração visual (sem mudança de texto)**"; nos documentos de texto, quantas
  **linhas** mudaram ("**1 linha alterada**", "**12 linhas alteradas**"). O nome é calculado no
  fecho da pausa, a partir do texto legível de cada motor (nunca da serialização). Teste:
  `npm run test:log`.

- **A fita cabe na largura em quatro degraus — e sem rolagem (PowerPoint, Word e Excel)**: a faixa
  de opções deixou de empurrar botão para fora da tela. Do mais folgado ao mais apertado: (1)
  **cheia**; (2) **compacta** — espaços e ícones menores, com **piso de fonte** (o Excel entrou
  nesse caminho: saiu do `zoom`, que encolhia o texto junto); (3) os **grupos que não couberem
  viram um botão** com o nome do grupo — clicar abre um menu com os controles daquele grupo, e o
  **último** grupo colapsa primeiro, então o que se usa o tempo todo continua à vista; (4) **faixa
  única** no modo recolhido (Ctrl+F1 ou duplo clique numa aba): os grupos da aba ativa ficam numa
  linha de botões (o "mais" de cada grupo) e a faixa acompanha a aba ativa, em vez de sumir. Quem
  decide é uma função pura (largura disponível × largura dos grupos, `src/fitaEncaixe.ts`), medida
  em `npm run test:encaixe`; a conferência cobre **1400/1100/900/700 px** com a escala em
  **0,7/1/1,5** e a pior combinação ainda deixa a fita inteira à vista. As **setinhas de rolar** do
  Word e a roda do mouse nos painéis saíram (a galeria de Estilos continua rolando de lado, que ali
  é galeria). A alça de altura ganhou **teto**: o menor entre **1,5×** e **um terço da janela** —
  numa janela baixa a faixa não come a tela (o valor guardado segue sendo a sua preferência).
  Testes: `npm run test:encaixe` e `npm run test:layout`.

- **A lista de recentes virou uma grade de cartões com a prévia**: cada cartão mostra um "papel"
  com o título (a primeira linha) e o começo do texto do documento, com a cor do formato na borda;
  o ícone do formato fica no lugar enquanto a prévia não chega (ou quando o arquivo não tem texto).
  A prévia é lida por arquivo, em paralelo, depois do cartão nascer — e o texto do arquivo entra
  **escapado** (é conteúdo de fora). Teste: `npm run test:layout`.

- **Histórico da apresentação: a lâmina em foco antes × depois (em vez do texto do deck)**: a aba
  **Alterações** (e a **Versões**) de um `.pptx` despejava o **texto serializado do documento
  inteiro** — os resumos viravam "+4843 −7259" e o diff não dizia nada sobre o que estava na tela
  (print do usuário). Agora o painel mostra as **duas versões da lâmina em foco** (a selecionada
  no editor) como **mini lâminas lado a lado** — esquerda: como estava; direita: como ficou —,
  desenhadas com o mesmo motor da miniatura da faixa; quando a versão é de antes de a lâmina
  existir, o lado avisa. Os outros módulos (Markdown, Word e Excel) seguem no diff de texto de
  sempre. Teste: `npm run test:log`.

- **Sem sessão, o app fica no Início (não abre rascunho sozinho)**: ao recarregar com **nada aberto**, o app abria **sozinho** o último rascunho — e, no navegador, o `temp/rascunho.md` velho do projeto — sem se saber o que viria (relato: "não tem nada aberto e ele abre o primeiro documento ou último que foi aberto"). A sessão vazia caía na recuperação **legada** (de antes das abas): agora, sem sessão para reabrir, o app **fica no Início (o Hub)** — exatamente como quando se fecha a última aba — e a recuperação legada sai do start. **Nada se perde**: os rascunhos continuam guardados e à mão em **Recentes ▸ "Rascunhos guardados no app"**, e o texto do `temp/rascunho.md` (dev) segue no arquivo, para abrir quando quiser.

- **Histórico: o diff agora é lado a lado**: o painel abria a mudança numa coluna única (a linha
  vermelha "saiu" em cima, a verde "entrou" embaixo) — agora o **antes fica à esquerda** e o
  **depois à direita**, **pareados linha a linha**, com uma barra **Antes · Depois** grudada no
  topo enquanto o diff rola; o que não mudou sai igual dos dois lados, o lado sem linha fica
  apagado e o trecho omitido vira um **⋯** atravessando as duas colunas. A legenda passou a
  explicar esquerda/direita. Vale para **Versões** e para **Alterações** (o `test:log` prende o
  pareamento: troca, inserção, remoção e bloco com excedente).

- **A faixa não recolhe mais com dois cliques**: o **duplo clique numa aba** (Página Inicial, Inserir…) alternava o recolher da faixa — e quem troca de aba apertado, ou abre e fecha um popup pelo próprio botão (o **Template**, por exemplo), recolhia a faixa **sem querer** ✗ (relato do usuário). O gesto saiu: **recolher/abrir a faixa agora é só o `Ctrl+F1`** (a dica continua no `title` da barra das abas), e **dois cliques no mesmo botão** — inclusive o que abre e fecha um popup — também não recolhem nada. Um clique simples num comando continua devolvendo o espaço, como sempre.

- **A fita não recolhe enquanto se escolhe num popup**: com a faixa recolhida e aberta "por enquanto" (um clique numa aba), **escolher um modelo no Template** — ou qualquer item de um popup do app — **recolhia a faixa do nada** ✗ (print do usuário): o popup vive no `document.body`, então o clique nele contava como "clique fora", e o próprio clique no botão que **abre** o popup já mandava fechar. Agora os popups do app marcam **`app-popup`** (os do PowerPoint, os do Word, o menu do **seletor** de campos e o menu do **Excel**), o clique dentro deles (e dentro de qualquer **diálogo** do app) **não é "fora"** e o comando que abre um popup adia a decisão **um tique** — se o popup já fechou, a faixa volta a fechar como sempre.

- **A lista dos seletores ficou do tamanho do campo (mudar o tamanho da fonte não abre mais uma
  janela)**: o menu dos seletores (tamanho da fonte, fonte, e todos os `<select>` do app) usava a
  largura e as linhas dos menus **“⋯”** — **250px de largura mínima** e **~36px por item** —, então
  escolher “36” abria um painel gigante com barra de rolagem, fora do tamanho do campo (print do
  usuário). Agora a lista **abraça o conteúdo** (com a **largura do campo como mínimo**, como a
  lista nativa), as linhas são **compactas** (22px) e a altura fica presa em **60vh/330px** com a
  rolagem dentro. Vale para a fita (PowerPoint, Word, Excel), os painéis e o editor.

- **Cache do WebView com teto escolhido**: a linha nova **Cache do WebView** em
  **Configurações ▸ Armazenamento** mostra o que está em disco agora (ex.: "55.1 MB agora") e
  deixa escolher o teto — **Automático** (o WebView decide, como sempre foi), **512 MB**, **1 GB**,
  **2 GB** ou **4 GB** — no mesmo controle dos outros ajustes. A escolha vale na **próxima
  abertura** do app (o WebView só lê o argumento quando a janela nasce): até lá a linha avisa
  "vale na próxima abertura do app" e, depois de reabrir, mostra só o limite em uso. A conta do
  "Outros dados do app" continua a mesma; a linha nova é que separa o cache das preferências.
- **Marcador de conflito no histórico (limpeza)**: o fechamento da tarefa das Ideias deixou um
  bloco de conflito (`<<<<<<<` / `=======` / `>>>>>>>`) **commitado** no
  `docs/historico-tecnico.md` — a resolução tinha sido feita e conferida, mas o `fechar.ps1`
  desfez o arquivo ao continuar o rebase, e o `git add` seguinte estagiou a versão com os
  marcadores. Os três marcadores saíram (os dois lados ficaram: a entrada do botão de perigo e a
  das Ideias) e o `testar-layout` agora **falha** se um marcador voltar em `CHANGELOG.md`,
  `README.md` ou nos docs dos módulos — o defeito não passa mais despercebido.

- **Documento novo já salvo na pasta padrão do app (`Documentos\mdOffice`)**: criar um documento não pergunta mais nada — ele **nasce salvo** na subpasta do próprio tipo, uma para cada: **`Markdown`**, **`Word`**, **`Excel`** e **`PowerPoint`** (`Documento.md`, `Documento.docx`, `Documento.xlsx`, `Documento.pptx`; o nome livre vira `Documento-2`, `Documento-3`… e a checagem é no disco, então dois seguidos nunca colidem). Vale para o `Ctrl+N`, para os cards do Início e para os **+** das abas de cada motor ✓. A raiz entra sozinha na lista de **Projetos** da barra lateral, então as subpastas aparecem na árvore como pastas normais ✓ — e **"Salvar como…" continua perguntando**, já sugerindo a subpasta do tipo (mudou de pasta? as imagens de `assets/` seguem o documento, como sempre ✓). Quem quiser outro lugar salva onde quiser e nada é imposto.
- **A árvore de projetos lista `.xlsx`/`.xlsm`/`.pptx`**: antes só `.md`/`.docx` apareciam — planilha e apresentação ficavam **invisíveis no painel** mesmo estando na pasta do projeto ✗. O teste do Rust cobre as quatro pastas padrão (ordem alfabética, `txt`/imagem fora, pasta vazia fora).
- **Medição não vai para o commit — e a entrada do CHANGELOG promove no fecho**: dois deslizes no fechamento da concordância de número. O **JSON da medição** (`medida-concord.json`, 133 KB) ficou na raiz e entrou no commit com o `git add -A`: medição é **arquivo de trabalho** (o número mora em `docs/medicao-corretor.md`), e na dúvida `git status` antes do `fechar.ps1` mostra o que vai junto. E a **entrada do CHANGELOG** ficou em “Não adicionado” mesmo com o código já na `main`: quando o commit do `fechar.ps1` entra na `main`, a entrada precisa **já estar** em “Adicionado” — quem fecha promove, no mesmo commit.

- **Troca de abas animada**: trocar de documento tinha ficado "seco" — só a barra lateral e os
  painéis animavam. Agora a **nova aba ativa entra com um "pop"** e o **documento desliza do lado
  de onde a aba veio** (aba à esquerda entra da esquerda, à direita da direita) — vale para
  Markdown, Word, Excel e PowerPoint, inclusive entre duas abas do mesmo tipo. O movimento segue
  os níveis das Configurações: **Discreta** desliga e **Completa** usa a curva de mola.
- **Concordância de número no corretor (a regra estrutural que o corpus mediu faltar)**: quando o erro dá uma forma que existe, quem decide entre singular e plural passa a ser a **concordância com a frase** — não a frequência. Se o determinante **imediato** pede plural (“as”, “os”, “vários”, “duas”…; antes ou depois da palavra) e o 1º do dicionário não concorda, a forma que concorda **passa na frente** — “tods os arquivos” → **todos**, “as citacõs” → **citações**, “As segurass notas” → **seguras**. A troca é **dentro da mesma palavra** (nunca uma palavra por outra: o `parDeNumero` cobre o “s” do plural, “m”↔“ns”, “ão”↔“ões/ãos/ães”, “l”↔“is/eis” e o a↔o do gênero) e a concordância ainda **veta** a promoção do contexto que contrarie a frase. Só reordena sugestão — nunca vira correção automática. **Medição:** no conjunto rotulado dá **250/295 = o mesmo do baseline** (os casos injetados não têm a forma “determinante + palavra”), com **falsos positivos 0,00**; o ganho é estrutural e está preso em 8 verificações novas (incluindo os três casos acima). A medição está em `docs/medicao-corretor.md` (oitava medição).
- **Corpus dos n-gramas: cadeia reproduzível — e o resultado medido**: o modelo de sugestões vinha de um corpus que **ninguém conseguia refazer** (nem se sabia o tamanho), e ele tem buracos: **“severidade” não existe** no vocabulário e **“mesh” existe**. Entraram `scripts/baixar-corpus.mjs` (artigos **destacados e bons** da Wikipédia PT, CC BY-SA 4.0 — só **contagens** vão para o app — com **retomada**, **paralelismo** e **manifesto de títulos versionado** para o redo), `scripts/corpus-texto.mjs` (o limpador de HTML: prosa fica; tabela — infobox **aninhado** também —, figura, referência e nota de edição saem), `scripts/regerar-ngrams.mjs` (`npm run corpus`, a cadeia num comando) e `npm run test:corpus` (14 verificações). O `build-ngrams.mjs` passou a aceitar uma **pasta** de corpus (com 718 arquivos a linha de comando estourava). **O achado:** `prop=extracts` só devolve **um** extrato completo por pedido (`exlimit` só vale junto com `exintro`) — era por isso que o download rendia quase nada (0,17 MB/min); a REST (`/page/html/…`) rende o artigo inteiro e, com 4 pedidos em paralelo, o corpus anda a ~0,6 MB/min. **O resultado medido:** com 30 MB de Wikipédia o modelo fica **menor** (4,8 MB) e conhece “severidade” (e não conhece mais “mesh”) — mas **no harness ele é pior**: r@1 **85% → 80%**, r@3 88% → 84%, precisão 91% → 88%, **falsos positivos 0,00 → 1,64/1000**, 19 casos perdidos contra 6 ganhos (ganha em plural com “ss”/“j”, perde em palavras do dia a dia do app: “clicar”, “seguras”, “porcentagens”…). Conclusão honesta: o problema não é só o **tamanho** do corpus, é o **registro** — o antigo estava mais perto dos textos do app (técnico) do que a enciclopédia. O modelo antigo **ficou** (a cadeia está pronta para um corpus do registro certo, ou misto).

- **Diálogo de texto com várias linhas (modo código)**: o diálogo de uma linha do app
  (`pedirTexto`, usado em "Novo modelo", renomear lâmina etc.) ganhou a opção de virar uma
  **área de várias linhas** — Enter quebra a linha e **Ctrl+Enter** (ou o botão) confirma —,
  com fonte monoespaçada e a janela um pouco mais larga. É o campo que o Fluxo do Mermaid do
  PowerPoint usa para colar o `flowchart`; a validação e o "clicar fora cancela" continuam
  iguais.
- **O nível “Completa” ganhou cara própria — e o “Padrão” deixou de ser igual a ele**: os dois níveis eram praticamente indistinguíveis (o “Completa” só mexia **30–100 ms** nas durações e **1 px** no hover). Agora o “Completa” **entra com mola** (a curva passa do ponto e assenta, `cubic-bezier(0.34,1.56,0.64,1)`), viaja **o dobro** (modais e painéis 26 px, menus 14 px, abas 16 px), a **cascata do Início** abre mais espaçada (70/140/210/280 ms), a **paleta (Ctrl+K) entra em escadinha** (26 ms por item), os itens da paleta deslizam de lado, o toast e a barra lateral usam a mola, e o hover sobe **3 px** (com sombra maior nos cartões) — o “Padrão” continua curto e direto, como sempre foi, e o “Discreta” segue sem entrada e sem elevação. A **prévia de cada cartão** mostra o ritmo (a do “Completa” dá dois tempos com um estufo no fim) e a descrição diz o que muda. A rede de segurança do movimento de saída subiu de **420 para 640 ms** (senão o modal saía antes de a animação do completo acabar).
- **Sem o painel "Contexto para IA"**: a aba de pastas vinculadas saiu da barra lateral (não fazia
  mais sentido), junto com o modal "Pastas de contexto para IA", o item do menu **⋯**, o atalho do
  menu do botão direito do editor, o tipo `LinkedFolder` e o comando `inspect_folders` (Rust, que
  só servia a ele). O **Copiar para IA**, o **Pacote para IA** e o painel de **Projetos** ficam
  como estavam, e o menu do editor agora só tem o **Copiar** — sem abrir quando não há seleção.
- **Ícones de tipo no estilo adotado (contorno)**: os ícones das **abas**, das **listas**
  (Recentes/Projetos) e dos **menus** deixaram a folha preenchida e passaram ao **contorno** —
  folha com o canto dobrado, interior vazio e a marca do formato no traço: **#** (Markdown),
  linhas de texto (Word), planilha com faixa de cabeçalho (Excel) e gráfico com seta
  (PowerPoint). A paleta é a do conjunto adotado (**md roxo `#7C3AED`, Word azul `#2B6CE4`,
  Excel verde `#16A34A`, PowerPoint laranja `#EA580C`), a mesma nos dois temas — a identidade
  do formato não muda com o tema. O traço foi calibrado para 16 px (o tamanho das abas) e
  conferido rasterizado em 16, 17 e 22 px, claro e escuro.

- **A lista dos seletores não cobre mais a tela**: a lista aberta de um seletor (tamanho da
  fonte, fonte…) montava os 20+ itens na altura natural e, em tela menor, cobria tudo — não
  dava para ver o documento atrás. Agora a **altura fica presa à janela** (no máximo ~72%
  dela) e a lista **rola dentro** dela; ao abrir, ela já vem **posicionada no item marcado**,
  centrado na área visível, em vez de sempre do começo. Vale para todos os seletores do app
  (Word, Excel, PowerPoint e Configurações).

- **Boas-vindas com o ícone atual do app**: o cartão “Bem-vindo ao mdOffice” (na pré-visualização e no `F1`) ainda mostrava o **quadradinho roxo com “M↓”** — o logo abandonado — e agora mostra o **ícone do app** (as folhas azul/laranja com a folha branca), na versão **clara ou escura** conforme o tema e a escolha das Configurações (a mesma chave que troca o ícone da janela). O CSS do antigo gradiente saiu, e o `test:layout` passa a prender as três coisas: a imagem do ícone, a escolha claro/escuro e a ausência do quadradinho antigo.
- **Formalidade base (Onda 3)**: o catálogo informal → formal cresceu de **18 para 75 padrões**, agora classificados por **classe** (internetês, contração, muleta, gíria, oralidade, atenuação, redundância e vagueza), com política explícita de **seguro** (o app pode corrigir sozinho — 45 padrões) × **sugestão** (30 padrões, quando a troca depende do sentido) e tom mínimo (neutro × formal). Entraram as **regras de frase por janelas** — “a gente vê que” → “nós vemos”/“vê-se que”, “Aí eu fui” → “Então, eu”/“Em seguida, eu”, “então” repetido, “você vê que” → “observa-se que” e “há três anos atrás” → “há três anos” —, com exclusão de citação (`>`), código, URL, sigla e e-mail. O painel de revisão (F7) passa a mostrar o **MIP** (marcadores informais por 1.000 palavras) antes e depois das correções seguras, a contagem por classe e o trecho/risco de cada marcador.

- **Teste do “entretanto” alinhado ao comportamento decidido**: a adversativa leva só a vírgula de antes (“…, entretanto faltou teste.”), como o corpus já exigia (caso 16, “porém”); a expectativa antiga do teste pedia as duas vírgulas.

- **Corretor aprende com as recusas e por classe de erro**: desfazer um ajuste automático (ou digitar por cima) desconta o par aprendido, e o app passa a reconhecer classes (transposição, tecla vizinha, acento, dígrafo) para acertar antes de conhecer o par exato.

- **Salvamento automático com feedback imediato e caminho do arquivo**: enquanto o documento é editado ou gravado, o badge exibe "Salvando…" com ícone de nuvem pulsando; assim que o salvamento é concluído, o badge volta para "Salvo" e exibe logo à sua direita o caminho da pasta/arquivo salvo com botão de atalho para abrir/revelar no explorador de arquivos.

- **Ícones de tipo redesenhados**: cada tipo passou a ser uma **folha de documento** na cor do
  formato (com o canto dobrado) e a marca dentro — M↓ no Markdown, W no Word, a planilha no Excel
  e o gráfico de pizza no PowerPoint —, no lugar do quadradinho com a letra solta; vale nas abas,
  nas listas, nos menus, na busca e no Início.

- **Citação ABNT atualizada para a NBR 10520:2023**: o corretor aceita Caixa Mista `(Silva, 2020)` e passa a sugestão (não erro) para quem escreve em CAIXA ALTA; "et al." opcional.

- **Corretor com contexto e decisão por confiança**: as sugestões passam a usar os **bigramas** do
  modelo de n-gramas (`public/ngrams/ctx-pt.json`) — "vou para a caza" vira "casa" com muito mais
  chance — e o auto-aplicar deixa de ser regra fixa: decide por **probabilidade com margem**
  (vencedor × segundo colocado), empate vira sugestão e o limiar se calibra com o histórico de
  desfazer.

- **O limiar do corretor se calibra com o uso**: desfazer uma correção que o app aplicou sozinho
  sobe o limiar (o corretor fica mais exigente); as que ficam de pé o descem. O limiar em vigor vai
  para o worker a cada veredito, e a calibragem funciona até sem armazenamento local.

- **Correção automática de novo nos casos claros**: a decisão por probabilidade tinha deixado
  passar para "só sugestão" erros óbvios como **"atensao" → "atenção"**; a dominância de uso (5×)
  voltou a aplicá-los sozinha — medido no corpus: **32/32 casos corrigidos e 32/32 textos
  corretos preservados**.

- **O corretor conhece as confusões do português e o teclado ABNT2**: a nota dos candidatos passa a
  ser **ponderada por classe** (c↔ç, s↔z, g↔j, e↔i, o↔u, m↔n, "h" mudo, letra dobrada, inversão de
  vizinhas) e pela **vizinhança de teclas**; as **grafias prováveis** (ss↔ç, ch↔x, dobradas) são
  procuradas direto no vocabulário. "excessao" → **exceção**, "analize" → **análise**, "pesquiza" →
  **pesquisa** e "obrigdao" → **obrigado** agora saem certos - e sozinhos. Corpus: **34/34**.

- **"Você quis dizer" sem falsos positivos**: o aviso só aparece quando a diferença é **erro de
  digitação típico** (inversão de letras, tecla vizinha do ABNT2, confusão c↔ç/s↔z/g↔j/m↔n, "h"
  mudo ou letra dobrada). Antes qualquer troca de letra valia e palavras reais eram questionadas
  ("paridade" → "caridade", "parse" → "passe"); medido com o harness: **3,25 → 0,00 falsos
  positivos por 1000 palavras**, com o acerto da auto-correção em 92%.

- **Ranking das letras faltando/sobrando**: a frequência ganhou **teto** (palavra comum não passa
  mais por cima de um candidato melhor por edição) e o candidato que **preserva o começo da
  palavra** ganha um bônus pequeno. "aparee" → **aparece** (era "para"), "fecar" → **fechar** (era
  "ficar") e "mdia" subiu para o topo da lista (era "dia"). Medido: recall@1 **78% → 82%**,
  precisão do 1º **83% → 87%**, acerto da auto-correção **92% → 95%** e auto-aplicações erradas
  **19 → 13**.

- **O contexto decide a palavra que existe**: quando a forma escrita é palavra de verdade mas não
  combina com a frase ("o maior ganho **resta** aba"), o app pergunta — comparando, no modelo de
  n-gramas, a leitura escrita com as trocas de classe (acento nos dois sentidos, x↔ch, g↔j, c↔ç,
  tecla vizinha, "h" mudo, dobra). É **sugestão** ("o contexto pede «desta»?"), nunca correção
  automática. Recall@1 **82% → 83%**, recall@3 **86% → 87%**, falsos positivos seguem **0,00**.

- **Harness de medição do corretor (F0) com linha de base registrada**: `scripts/avaliar-correcao.mts`
  mede o corretor real (`checkText`) contra um conjunto rotulado — os 25 pares de palavra de
  `test/docs/gramatical.md` e 270 erros sintéticos por classe (acento, c↔ç, s↔ss, x↔ch, g↔j,
  transposição, letra a mais/menos, tecla vizinha) gerados de parágrafos limpos de `docs/*.md` —,
  com recall@1/@3, precisão do 1º lugar, falsos positivos por 1000 palavras, taxa e acerto da
  auto-aplicação, ms/palavra (p50/p95) e o payload que o worker carrega; saída legível, `--json`
  e `--classe=`. Aplicar: `node scripts/avaliar-correcao.mts`. Baseline do commit `120cc9e` em
  `docs/medicao-corretor.md`: detecção 97%, r@1 76%, r@3 85%, FP 3,25/1000, auto-aplicação 76%
  com 10,7% delas erradas, p95 0,152 ms/palavra e 7,5 MB de payload no worker. No fechamento um
  rebase trouxe o corretor com confusões/teclado (`760095e`); a mesma medição rodou no commit novo
  (`cdd1c84`): r@1 80%, r@3 89%, x↔ch 33%→67%, FP igual e p95 0,998 ms/palavra — a comparação está
  no documento. Nada muda no comportamento do corretor.

- **F4 do corretor — a promoção por contexto para de errar**: o `rerankSuggestions` (a camada que reordena as sugestões pelo trigrama/bigrama e pelo lado direito da frase) promovia com evidência **fraca**, e o bônus de classe/uso podiam promovê-la sozinhos — na medição isso custava acerto (“messmo” → “**mesh**” ✗, “revissão” → “**previsão**” ✗). Agora **a promoção é do contexto**: piso próprio (0,06), no mínimo **3×** o contexto do 1º do dicionário + margem, e o bônus de classe/uso só escolhem entre candidatas que o contexto já sustenta. Com o modelo ligado, o r@1 voltou de **84% para 85%** (empata com a rodada sem modelo em vez de perder 1 p.p.), a precisão do 1º segue **91%** e os falsos positivos **0,00**. A varredura de limiares (8 pisos × 5 fatores × 4 margens sobre as evidências reais de 54 casos do conjunto) mostrou que **nenhuma** configuração faz a promoção ganhar nesse corpus — a régua ficou conservadora de propósito: promove quando o contexto é de fato decisivo, fora disso não chuta.
- **Harness: medição caso a caso**: o `--json` do `scripts/avaliar-correcao.mts` agora leva a lista `medidas` (cada erro com conjunto, classe, sugestões, auto e trecho) — é o que permite comparar duas rodadas (com/sem modelo, antes/depois) **por índice** e ver exatamente quais casos mudaram, em vez de só o total.
- **Fila do salvamento automático (nada de pedido descartado)**: um salvamento por vez e o pedido
  que chega durante uma gravação **deixa de ser ignorado** — ao terminar, a fila grava de novo com
  o texto mais recente. Antes (`if (this.saving) return`), em pasta de rede o autosave disparado
  durante uma gravação lenta era simplesmente descartado e a última parte do que foi digitado
  ficava sem salvar até a próxima tecla/blur/fechar. Rajadas de pedidos durante a gravação viram
  **uma** gravação (coalescência), a digitação nunca espera o disco e o indicador "Salvando…"
  continua refletindo o estado real. Teste novo: `npm run test:salvamento` (fila exercitada com um
  "disco lento" de mentira + contratos do Rust).

- **Frases formais, degrau 2 — clichês, perífrase e plano em 1ª pessoa**: entrou a classe **clichê** (peso 1 no MIP, como a pesquisa pede) com 10 padrões — **com correção**: “nos dias de hoje” → **atualmente**, “vem crescendo” → **tem crescido**, “de suma importância” → **essencial**, “desde os primórdios” → **desde o início**; **só sugestão**: “é sabido que”/“todos sabem que” (afirme direto), “cada vez mais”, “faz-se necessário”, “no mundo atual”, “abrir um leque de possibilidades” e “um passo importante”. Duas **janelas de frase** novas: **“vou estar enviando” → “enviarei”** (a pessoa vem do auxiliar e o verbo sai do gerúndio pelo infinitivo, com fazer/dizer/trazer e os compostos na tabela dos irregulares — “vamos estar fazendo” → **faremos**, “vão estar trazendo” → **trarão**) e **“vou fazer”/“vamos enviar”** em 1ª pessoa, que avisa e mostra a passiva certa (“será feito”, “serão enviados”) **sem troca pronta** (o gênero e o número do complemento mandam). Completam o catálogo “dá pra ver que” → **observa-se que**, “de certa forma” (vagueza; “meio que” deixou de sugerir justamente “de certa forma”) e “criar novo”/“inovar do zero” (redundância). São **94 padrões** em 9 classes, e as regras novas marcaram **zero** falsos positivos nos 98 mil palavras dos documentos do próprio projeto (a única marcação foi o “de certa forma” citado na pesquisa, que fala da regra).
- **Formalizar texto com prévia antes/depois**: o comando novo (**Ctrl+Alt+F**, no menu “Escrever” e no painel de revisão) pega a **seleção** — ou o documento inteiro quando não há seleção — e mostra **antes × depois** lado a lado, com o **MIP ao vivo** e os trechos trocados pintados (vermelho no antes, verde no depois). As **trocas seguras** (com correção pronta — a mesma régua do MIP) já entram marcadas; as que **dependem do sentido** esperam a decisão, com o risco explicado no tooltip e as alternativas em chips (“a gente analisou” → “Nós analisamos” **ou** “analisou-se”); os avisos sem troca pronta (“sei lá…”) só informam, sem caixa. Nada dentro de citação (`>`), código, URL, sigla ou e-mail, e aplicar é **uma transação**: Ctrl+Z desfaz tudo de uma vez.
- **Dois consertos no catálogo que a prévia revelou**: “dar uma olhada **no** relatório” virava “examinar **no** relatório” — a troca agora leva a preposição junto (“examinar o relatório”, “examinar a planilha”, “examinar as contas”…) e a forma solta, sem objeto, virou **sugestão** (“examinar”, “revisar”, “conferir”); e “um monte de **gente**” virava “muitos gente” — agora é **sugestão** com as quatro formas (muitos/muitas/vários/várias). As duas eram marcadas como **troca segura**, e a formatação em massa as aplicava assim mesmo.
- **Abas estilo Chrome**: `Ctrl+T`/`Ctrl+W`/`Ctrl+Tab`/`Ctrl+1…9`, reabrir a última fechada,
  arrastar para reordenar, menu de contexto; fechar nunca pergunta (vira rascunho em Recentes);
  fechar o **último documento** volta para a tela de Início.
- **Atalhos configuráveis** (Configurações ▸ Atalhos): antes a aba só mostrava a lista — não havia
  como escolher outra tecla. Agora cada atalho é um item de verdade: clique na tecla e pressione a
  nova. Tem aviso de conflito (diz qual atalho já usa aquela tecla), recusa tecla solta (letra sem
  Ctrl/Alt atrapalharia a digitação; F1–F12 valem sozinhas), voltar ao padrão por linha ou de uma
  vez, e Esc para desistir. A lista passou a trazer **todos** os atalhos do app — entraram negrito,
  itálico, apresentar, copiar para a IA e ir para a aba N — e as dicas de tecla espalhadas pelo app
  (menus de contexto, botões, busca de comandos) acompanham a troca.
- **Documentação do projeto renovada**: README com a história (mdEditor → mdOffice) e o crédito
  à ArtCraft, licença **MIT**, docs de [estrutura](docs/estrutura-do-projeto.md) e
  [funcionalidades por módulo](docs/funcionalidades.md), e este **changelog + o
  [histórico técnico](docs/historico-tecnico.md)** (entregues neste mesmo commit).
- **Nome unificado em mdOffice**: textos e títulos de janela, metadados gravados em
  `.docx`/`.xlsx`/`.pptx`, nome do pacote (`mdoffice`) e as centenas de referências ao antigo
  "mdCreator" na documentação.
- **Configurações**: os seis `<select>` (intensidade das sugestões, versões por documento,
  política de backup, cópias, prazo e estilo do desenho) viraram **dropdowns do app** — a lista
  nativa do sistema (cinza claro) não seguia o tema.
- **Tela de Início** com os quatro formatos (Word, Excel, MD, PowerPoint) e botão lateral fixo.
- **Painel de projetos**: árvore de pastas com `.md` em cartões (contagem de documentos/pastas,
  esqueleto ao carregar, busca com o termo destacado), animações de abrir/fechar e indicador de
  aberto/alterado por documento.
- **Estrutura do texto**: árvore de títulos com seções que recolhem, destaque da seção atual,
  contagem de palavras/tarefas e ações (mover, promover, copiar, excluir).
- **Histórico de versões** + **log de alterações** (diff leve, marcos) + aba **Backup**, com
  restauração em um passo.
- **Backup em disco** em duas pastas, com política de limpeza (perfis), aviso de arquivo
  sumido e tela de restauração.
- **Configurações numa aba** (Escrita, Tradução, Histórico, Aparência, Atalhos), com ajustes
  valendo na hora; redesign com trilha lateral e cartões.
- **Configurações**: ícones menores na trilha lateral (chips de 32 → 26 px e glifos de 16 → 14;
  marca de 40 → 34), deixando a trilha mais leve sem mudar a estrutura.
- **Configurações em abas**: cada seção aparece sozinha, em vez da página única que rolava pelas
  cinco. Trocar de seção abre sempre do topo e rolar não troca mais de aba; o nome da seção ficou
  só no cabeçalho dela (a barra fixa do topo repetia o mesmo nome). A confirmação **"Salvo"** virou
  uma pílula no pé da página, fora do canto reservado aos avisos do app.
- **Busca de comandos** (`Ctrl+K`), **modo foco** (`Ctrl+Shift+F`) e atalhos documentados.
- **Importar do Office** (`.docx`, `.xlsx`, `.xlsm`, `.pptx`) com explicação dos formatos antigos.
- **Ícone por tipo de arquivo** (M↓, W, tabela, gráfico de pizza) nas abas, listas e busca.
- Tema claro/escuro, animações consistentes da interface e painel lateral redimensionável.
- **Tela de carregamento** na abertura: cobre a janela enquanto o pacote do app não chega, no
  lugar do HTML cru (ícones gigantes) que aparecia nesse intervalo. O tema guardado passa a
  valer **antes** da primeira pintura, então quem usa o escuro não vê mais o clarão branco.
- **Skills e regras** para IA e o menu **+** separando Markdown, Word, Planilha e Apresentação.
- **Ícone do app escolhível** (Configurações ▸ Aparência): claro ou escuro, trocando na hora o
  ícone da janela e da barra de tarefas; sem escolha ainda, segue o tema.
- **Seção Armazenamento** nas Configurações: resumo com barra proporcional (versões, log,
  backup, rascunhos, outros), cartões com o tamanho de cada parte e limpeza — versões, log,
  rascunhos, cópias antigas e a pasta da versão anterior (mdCreator); atalhos para as pastas.
- **Copiar no menu do botão direito** do editor: com texto selecionado, o menu ganha o item
  **Copiar** (Ctrl+C) antes de "Pasta (contexto)", copiando exatamente o trecho escolhido.
- **Barra lateral com movimento de verdade**: a pílula do seletor de painéis **desliza** entre
  Início/Projetos/Estrutura/Contexto; mostrar/esconder a barra **recolhe a largura** em vez de
  sumir de uma vez; a troca de painel entra com um passo curto (sem o "pop" com escala) e abrir
  uma pasta na árvore **cresce** a altura (fechar já animava).
- **Escolha do tema em dois cartões** (Configurações ▸ Aparência): **Claro** e **Escuro** lado a
  lado, cada um com uma prévia do tema, clicáveis — o interruptor "Tema escuro" saiu.
- **Aparência com nível de animação e cantos** (Configurações ▸ Aparência): **Animação** em três
  cartões — Discreta, Padrão e Completa, cada um com a prévia do ritmo — e **Cantos** em dois
  (Quadrado e Redondo). Valem para o app inteiro e ficam guardados.
- **Cantos: correção do Redondo e do Quadrado**: o Redondo arredondava além do desenho original
  (o botão Desenhar virava pílula) e agora **não mexe em nada** — é o app como ele já era; o
  Quadrado passou a apertar de verdade (2 px nos controles, 3 px nas caixas).
- **Interruptor das Configurações alinhado**: bolinha com folga igual nos quatro lados e igual
  entre ligado/desligado (geometria inteira: 40×24 px, bolinha de 18 px e folga de 3 px), sem o
  desalinhamento de meio pixel que aparecia em 100%, 125% e 150% de escala do Windows.
- **Mover para a lixeira**: último item do menu do arquivo (botão "⋯" e clique direito, agora o
  **mesmo menu** nos dois), com diálogo de confirmação. Antes de mover, salva o que estiver
  aberto nas abas do documento, fecha-as e limpa a lista de Recentes — nada é apagado na hora:
  o arquivo fica **30 dias** na lixeira do app (dá para recuperar pela pasta) e depois some de vez.
- **Menu de Recentes redesenhado**: cada linha tem o **ícone do tipo** do arquivo, o nome com o
  **"há quanto tempo"** ao lado e a pasta na segunda linha (os rascunhos aparecem como
  "Rascunho do app"); as ações ("Abrir arquivo…", "Reabrir aba fechada") ficam **fixas no rodapé**
  enquanto só a lista rola, e o × de tirar da lista aparece no hover, no lugar do tempo.
- **Histórico e salvamento (aba das Configurações)**: mostra **o que cada camada guardou** —
  versões (quantas, quantas marcadas, a última e o nome dela), alterações (quantas e o último
  resumo) e cópias em disco (quantas, tamanho e a última) — e as **cópias viram lista dentro do
  app**, com **Restaurar** e **Apagar** por cópia, para o documento atual **e** para os outros
  documentos com backup. Ganhou "onde ficam os arquivos" (as duas pastas com Abrir e o log
  exportado em `.historico/historico.json`), o atalho para os **originais sumidos** e o
  **Apagar completo** (versões + alterações + log exportado - as cópias em disco ficam; antes
  o botão apagava só as versões). O "Abrir histórico" abre direto na aba certa.
- **Diálogo de texto do app** (`src/dialogoTexto.ts`): componente único para pedir um nome - campo
  com rótulo e dica, **Enter/OK** confirmando, **Esc/Cancelar/clique fora** cancelando e `validar`
  com mensagem de erro. Substitui os `window.prompt` nativos ("localhost:1420 diz."), que não
  seguem o tema.
- **Seleção do app no lugar da lista cinza do sistema**: todo `<select>` restante (Word, Excel,
  PowerPoint, diagramas e desenho de letras) passa a abrir o **mesmo menu suspenso do ⋯**, que
  segue o tema claro/escuro (`src/seletor.ts` + estilos do controle). O `<select>` continua no
  DOM — valor, opções e o evento `change` seguem valendo para todo o código existente — e a tela
  mostra uma “cara” com o rótulo atual e o chevron. **Esc fecha só a lista** (o diálogo por baixo
  continua), clicar fora fecha e opção desabilitada não abre.
- **Configurações com o seletor unificado**: os seis campos que usavam um botão próprio de menu
  (intensidade das sugestões, versões guardadas, política/cópias/prazo do backup e estilo do
  desenho) agora são `<select>` melhorados pelo **mesmo controle do resto do app**
  (`src/seletor.ts`): a lista aberta é o menu suspenso do app, no tema. O componente antigo
  (`dd`/`ctx.menu`) sai — uma implementação só.
- **Seletor do app acertado**: o controle que substitui o `<select>` nativo ficou **em branco** no
  valor vazio (mostrava um “—” que parecia erro) e a **setinha acompanha o tamanho do contexto**
  (1em — na fita do PowerPoint ela cresce junto quando a faixa é aumentada). A lista aberta
  **fecha antes** de um painel se redesenhar (`fecharSeletor`), em vez de ficar presa a um
  controle que sumiu.
- **Seletor do app com campo editável**: o controle ganhou o modo `data-editavel` — o valor vira
  um **campo que aceita digitação** (com a setinha abrindo a mesma lista), o que a pessoa digita
  entra como opção do próprio select e o `change` continua valendo para todo o código existente;
  `data-num` normaliza números (vírgula ou ponto, com mínimo e máximo declarados no próprio
  select). É o que as fitas do **Word** e do **PowerPoint** usam para não ficar presas a listas
  fixas de fonte e tamanho. A lista de fontes comuns virou **uma só** (`src/fontes.ts`),
  compartilhada pelos dois motores, com as clássicas do Windows/Office.
- **A tela de carregamento não se mexe mais**: no intervalo entre o HTML e o pacote do app
  (CSS + JS), a página ficava sem estilo e mais alta que a janela — dava para rolar com a roda do
  mouse ou arrastar a barra de rolagem por baixo da tela de carregamento. Agora o `html`/`body` já
  nascem travados no próprio `index.html`, com os MESMOS valores do `base.css` (nada muda quando o
  app assume).
- **Selo do salvamento honesto com arquivo SEU do Office**: ao editar um `.pptx`/`.docx`/`.xlsx`
  que é seu, o autosave **não** reescreve o arquivo (o motor pode simplificar animações, gráficos,
  comentários e revisões) — mas o selo da barra dizia **"Salvando…" para sempre**, como se houvesse
  uma gravação que nunca termina, e o chip do caminho sumia junto. Agora ele mostra **"Não salvo"**
  (âmbar, sem pulsar), o caminho continua à vista e, na primeira alteração de cada arquivo, um aviso
  explica que só o **Ctrl+S** grava o arquivo (as alterações ficam no histórico do app). O MD\* segue
  igual ("Salvando…" → "Salvo") e a descrição do toggle nas Configurações passou a dizer o que o
  salvamento automático cobre. Verificações novas em `npm run test:salvamento`.
- **Dica (tooltip) no padrão do app**: os controles sempre tiveram a dica no `title` — e é bom
  (um lugar só, com a tecla do atalho junto, atualizada pela aba Atalhos) —, mas quem desenhava o
  balão era o **navegador**, com a fonte, a borda e a sombra do sistema, destoando da fita, dos
  menus e do resto do app (o "Pincel de Formatação" do Word era o exemplo à vista). Agora um balão
  próprio (`src/dica.ts` + a regra `.dica`) mostra esse mesmo texto: superfície dos menus (painel,
  borda, sombra), tema claro/escuro, a preferência de cantos respeitada e **acima dos popups**. Ele
  espera **380 ms** parado sobre o controle, não abre no toque, não recebe o ponteiro, sai no
  clique/Esc/rolagem, nunca sai na impressão — e o `title` **volta** ao elemento assim que o balão
  fecha (o nativo nunca chega a aparecer). Vale para a fita, a barra, a régua, os painéis e o modo
  apresentação; verificações novas em `npm run test:layout`.
- **Botão de perigo das Configurações legível**: o **"Remover…"/"Apagar…"** das Configurações saía
  **vermelho com o rótulo vermelho** (invisível): o botão tem as classes `btn` e `st-btn`, e o
  `.btn.danger` do base pintava o **fundo** enquanto o `.st-btn.danger` pintava o **texto**. Agora
  ele é o botão do lugar — fundo normal, texto vermelho e borda no tom — e o **vermelho sólido com
  texto branco fica só no hover e na confirmação** (o apagar pede dois cliques).
- **A roda do mouse anda de lado nas fitas e na galeria de Estilos**: as partes que passam da
  largura (a **galeria de Estilos** do Word, os **painéis** das três fitas e as **abas** das
  Apresentações) rolam na horizontal com a barra escondida — e sem botão próprio na galeria não
  havia como alcançar o que ficava cortado: quem via o "Título 3" não chegava à "Citação". Agora a
  roda vertical vira **rolagem lateral** (como nas galerias do Office), com três cuidados: o trecho
  de dentro pega o gesto para si (a galeria rolando **não** arrasta a fita inteira, nem no fim),
  `Ctrl`/`Shift`/roda lateral seguem o caminho normal (o zoom continua do `Ctrl` + roda) e um trecho
  sem o que rolar deixa o evento passar. O handler virou **uma função só**
  (`ligarRodaHorizontal`, em `src/fita.ts`): o Excel e o PowerPoint tinham cópias inline — o Word,
  nenhuma. 4 verificações novas em `npm run test:layout`.
- **O botão de recolher a faixa faz o que anuncia (o caso do Template)**: com a faixa mostrada
  "por enquanto" no modo recolhido — o que acontece ao clicar num botão da barra das abas, como o
  **Template** —, o chevron usava o estado **fixo** em vez do que está à vista: ele anunciava
  "Recolher a faixa de opções" e fazia o contrário (fixava aberta, e a faixa não fechava mais).
  Agora o clique decide pelo que está à vista: aberta (mesmo que só por enquanto) → **recolhe**;
  recolhida → fixa aberta. Vale para as três fitas (Word, PowerPoint e Excel).
- **A aba Alterações do histórico mostra o documento, não o "commit do app"**: no Word, PowerPoint e
  Excel os estados são guardados como **texto serializado** (um JSON interno) e o diff aparecia com
  esse blob — com o `\n` escapado e tudo — no lugar do que a pessoa escreveu (o relato veio com a
  captura de uma apresentação). O tipo do documento agora vem do **arquivo** (extensão), não da aba
  ativa, e um **texto legível** tenta o projetor do tipo e, se ele não reconhecer o estado (formato
  antigo), os dos outros motores; nada reconhecendo, o JSON cru **não** vai para a tela. O
  **resumo** de cada alteração também sai do documento: a lista mostra "+2" (o tamanho da mudança de
  verdade) em vez de "+4843 −7259" (o tamanho da serialização). 4 verificações novas em
  `npm run test:layout`.

**Ferramentas (dev)**

- **O modelo do corretor saiu do git (e o histórico dele foi removido)**: os quatro JSONs
  (`pt/ctx-pt/freq-pt/syn-pt`, ~9,5 MB) eram versionados e **cada regeneração reescrevia o arquivo
  inteiro** — 4 commits de n-gramas somavam ~14 MB no histórico. Agora eles moram **fora do git**
  (como `public/ort` e `public/modelos` já faziam): o `.gitignore` ignora os JSONs, um `LEIA.md` na
  pasta explica a geração, as worktrees **ligam a pasta à cópia principal** (`abrir.ps1`) e o
  `regerar-ngrams.mjs` passou a dizer para guardar uma cópia antes de regenerar (não há mais
  `git checkout --`). O **histórico da `main` foi reescrito** com `git filter-repo` (num clone
  isolado; os JSONs saíram de todos os commits) e o `main` do GitHub foi atualizado com **push
  forçado protegido por lease** — o commit da limpeza está em **Adicionado** porque a operação roda
  direto na `main`. De quebra, o repositório ganhou o primeiro **`git gc`** em muito tempo:
  o `.git` caiu de **111 MB (objetos soltos, sem pack) para 11,5 MB**. As branches de tarefa
  abertas ainda seguram os blobs antigos (a `main` delas é a antiga); quando fecharem (rebase na
  `main` limpa) eles ficam inalcançáveis e o próximo `gc` os descarta — o alvo é ~4,5 MB.

- **`test:excel` está quebrado em checkout limpo (achado, não consertado)**: o segundo teste (`testar-grade-excel.mjs`) compila o motor com `tsc` sem os tipos do `?raw` (erros `TS2307` sobre `.toml?raw`/`.css?raw`) e, quando compila, o stub de DOM não cobre o seletor novo do app (`melhorarSelects` explode) ✗. Na cópia principal ele passa por acaso: o `temp/` está compilado de antes ✗. Fica registrado para quem for consertar (é teste, não app).
- **Marcador de conflito no CHANGELOG (limpeza)**: o fechamento da tarefa do ícone das boas-vindas resolveu um conflito de rebase e deixou a **linha de fecho** (`>>>>>>> 074695b …`) no arquivo — o `git diff --check` acusa, mas nem o `fechar.ps1` nem os testes olham o CHANGELOG. A linha saiu e o `git grep` do repositório inteiro ficou **limpo** (era o único marcador). Fica a lição: ao resolver conflito, conferir os **três** marcadores (`<<<<<<<`, `=======`, `>>>>>>>`) e rodar `git diff --check` antes de `git add`.
- **Teste da formalização** (`npm run test:formalizar`, 47 verificações): prova o plano de trocas de ponta a ponta — o que entra (catálogo + janelas de frase, com classe e risco), o que **não** entra (citação, código, texto já formal), a aplicação (ordem, sobreposição, limites para a prévia pintar), a queda do MIP e a **janela inteira** num DOM de mentira (abre, pinta, decide e aplica); prende ainda os dois consertos do catálogo e confere que toda classe que a janela usa existe no CSS.
- Fluxo de **worktrees** obrigatório: `abrir.ps1`, `fechar.ps1`, `limpar.ps1`, `status.ps1`,
  `limpar-agendada.ps1` e proteção opcional da `main`.
- `fechar.ps1` integra a `main` por **rebase** (história linear, sem commit de merge) e envia
  a `main` ao GitHub; `monitor-push.ps1` completa o envio quando todas as worktrees terminam.
- `abrir.ps1`/`fechar.ps1` aceitam a **descrição da branch** (`-Porque`/`-Proposito`), mostrada
  no `status.ps1` e no corpo do commit; `-Branch` confere a worktree certa.
- `fechar.ps1` **bloqueia** o fechamento quando a tarefa não tocou no `CHANGELOG.md` ou no
  `docs/historico-tecnico.md` (mostra o que faltou e como registrar; nada vai para a `main`).
- **Ícones do build regerados** dos pacotes novos (`app-icon.png` do pacote claro +
  `src-tauri/icons/*` via `npm run icon`); o script `icon` virou `tauri icon app-icon.png` e o
  `gen-icon.mjs` (desenho antigo) foi removido.
- **Servidor de dev sem recarga no meio do uso**: as dependências usadas **dentro dos workers**
  (`typo-js`, do corretor, e `@huggingface/transformers`, da IA local e da tradução offline) entraram
  em `optimizeDeps.include`. O Vite não lê arquivo de worker ao procurar dependências, então só
  descobria esses pacotes quando o worker subia — ~20 s depois de abrir o app — e reagia
  re-otimizando tudo e recarregando o app inteiro. O cache do otimizador passou para `.vite/`, por
  pasta: o padrão (`node_modules/.vite`) é compartilhado entre a cópia principal e as worktrees e o
  hash que o valida inclui a raiz do projeto, então cada troca de pasta invalidava o cache e
  recarregava os clientes conectados.
- **Watchdog percebe a página travada**: o processo do app continuar de pé não quer dizer app
  funcionando — depois de muitos recarregamentos o **conteúdo da janela** morre e a janela segue
  respondendo mensagens do sistema, então o watchdog (que só olhava se o processo existia) nunca
  percebia. Agora a página avisa ao servidor de dev que está viva (a cada 5 s, só em
  desenvolvimento) e o `watchdog.ps1` reinicia o app quando o aviso fica velho
  (`-TravadoSegundos`, padrão 90) - com prazo maior para o primeiro aviso, que depende do
  carregamento do dicionário e do modelo (`-TravadoNaSubidaSegundos`, padrão 180). O
  `tools/watchdog.ps1` também ganhou BOM de UTF-8: sem ele o PowerShell 5.1 lê o arquivo como
  ANSI e os acentos saíam corrompidos no log.
- **Pesquisa (documento)**: formalidade por regras e validação ABNT — o que é verificável e como
  (`docs/pesquisa-formalidade-abnt.md`).
- **Pesquisa (documento)**: correção/sugestão sem IA — estado da arte, algoritmos e plano por fases
  (`docs/pesquisa-correcao-offline.md`).
- **Pesquisa (documento)**: síntese com a ordem de execução (dores, camadas, ondas, métricas e
  limites) em `docs/pesquisa-sugestoes.md`.
- **Pesquisa (documento)**: sugestões sem IA — aquecimento, velocidade e sugestões longas: gargalos
  medidos no motor atual (modelo, índice, latência, largura média de 1,35 palavra), estado da arte
  com fontes e plano por fases V0–V4 (`docs/pesquisa-sugestoes-velocidade-tamanho.md`).
- **Monitor da `main` suja**: além do hook que bloqueia o commit na `main`, o mesmo instalador
  (`instalar-monitor.ps1`) agora agenda o `monitor-main.ps1`: a cada poucos minutos ele registra
  no log quando a **cópia principal** fica com alterações soltas (trabalho direto na `main` -
  edição, que o hook não tem como impedir) e quando ela volta a ficar limpa.
- **Teste de layout com a seção do seletor**: `npm run test:layout` ganhou 10 checagens das regras
  que apareceram tortas no seletor (valor vazio sem o “—”, setinha `1em`, alto dos selects nas três
  fitas, setinha do botão de cor dentro do botão, setas de aumentar/diminuir e a lista que fecha
  antes de um painel se redesenhar).
- **Teste de layout com o campo editável**: mais 10 checagens em `npm run test:layout` para o
  modo editável (o valor digitado vira opção, vírgula e min/max, a escolha na lista não é aplicada
  duas vezes, as duas fitas marcadas como editáveis e a lista de fontes única).
- **Testes da roda do mouse**: a decisão da roda virou módulo próprio (`src/powerpoint/roda-laminas.ts`)
  e ganhou 10 checagens em `npm run test:pptx-edicao` (gesto, inércia, rolagem primeiro, soma de
  movimentos pequenos) + 6 em `npm run test:layout` (Ctrl é do zoom, roda lateral ignorada e a
  ligação no palco).
- **Testes do desenho assistido**: `npm run test:desenho` ganhou 4 checagens do arco (traço torto
  sai girado no ângulo do desenho, a curva **passa pelo traço** - desvio máximo medido contra o
  arco reconhecido - e o "canto em L" fica como desenho livre em vez de arco-faca) e o
  `npm run test:pptx-edicao` confere que o arco girado vai ao `.pptx` com rotação e ângulos.
- **Teste de layout com o botão de perigo**: 3 checagens prendem o fundo reafirmado no
  `.st-btn.danger`, o texto na cor de perigo e o vermelho sólido só no hover/confirmação - o
  defeito (rótulo vermelho sobre fundo vermelho) não volta sem alguém notar.
- **Testes do Conectar**: 8 checagens novas em `npm run test:ligacoes` prendem o alvo geométrico
  (a bolinha manda, a caixa de cima vence, a histerese não solta na fresta e o clique devolve a
  caixa e o lado) e 4 em `npm run test:layout` garantem que o palco usa a função (e não o DOM) e
  deixa os conectores fora do alvo — o defeito das bolinhas piscando e da ligação na caixa errada
  volta só com alguém vendo.
- **Verificações do pincel de formatação voltaram a passar**: duas checagens de `testar-layout`
  usavam janelas curtas de regex (600 e 320 caracteres) entre um marco e a guarda, e o código
  cresceu em volta (876 e 495) — a `main` ficou com `test:layout` vermelho sem o pincel ter
  quebrado nada. As janelas foram para 1200 e 700 (as guardas testadas são as mesmas).


**Ferramentas (dev)**

- **Os estragos das resoluções de conflito da tarefa do "fechar todos"**: (1) o
  `npm run test:layout` **voltou a rodar** — a resolução daquela tarefa perdeu o fecho (`);` e `}`)
  do bloco "histórico: a alteração mostra o documento" no `scripts/testar-layout.mts`, e o arquivo
  foi para a `main` sem compilar (a suíte morria com `SyntaxError: Expected ',', got 'ident'`
  **antes** de rodar qualquer checagem); (2) as **seções do histórico técnico** daquela tarefa
  (`tabs.ts`, `keymap`/`commands`/`pages`/`layout`, os comandos de documento e as travas) voltaram
  ao lugar — a promoção de outra sessão (`80744cf`) as havia descartado inteiras na resolução dela.
  Teste: `npm run test:layout`.

### Adicionado (na main)

### Adicionado (na main)

**Backend**

- **A tela Início ganhou a prévia dos documentos** (`preview_file`): um comando novo que devolve o
  começo do texto de um arquivo — o `.md` lê o próprio texto, os formatos do Office (.docx/.pptx/
  .xlsx) abrem o zip e tiram o texto do XML principal (documento, primeira lâmina, textos
  compartilhados). O zip é lido direto do arquivo (sem trazer os bytes para o lado TS) e qualquer
  falha devolve prévia vazia — a tela nunca quebra por um arquivo que sumiu. Teste no `cargo test`.

- **Limite do cache do WebView (lado nativo)**: a janela do app passou a ser montada pelo
  `lib.rs` (o `tauri.conf.json` ficou com `windows: []`) porque o `--disk-cache-size` precisa
  chegar **junto com o WebView** — o arquivo de configuração é compilado no app e não dá para
  mudá-lo em tempo de execução. A escolha fica em `cache.json` na pasta de dados (MB; 0 =
  automático), o `preparar_webview()` marca o que ficou valendo na sessão e os padrões do wry
  (`msWebOOUI`, `msPdfOOUI`, `msSmartScreenProtection`) continuam nos argumentos. Os comandos
  novos (`storage_cache_config`/`storage_set_cache_limit`) validam o teto contra a lista da tela,
  e o `storage_report` passou a devolver `cache_bytes` — a soma só das pastas de cache do perfil
  (dentro de `EBWebView\Default`), sem preferências e sem contar duas vezes o
  `Service Worker\CacheStorage`.

- **Salvamento automático em pasta de rede (UNC/SMB) não trava mais a interface**: os comandos
  de arquivo e de backup passaram a rodar no pool de tarefas do Tauri (`#[tauri::command(async)]`).
  No Tauri 2 um comando síncrono roda na **thread principal** — e ler/gravar num share de rede
  (centenas de ms a segundos por operação) travava a janela e filava o IPC a cada salvamento. Cada
  salvamento também gasta **uma ida ao disco a menos** (não checa mais `exists()` da pasta antes de
  gravar: a pasta é criada só quando a gravação responde "não encontrei" e tenta de novo) e a cópia
  de backup lê o documento **uma única vez** (antes o `same_bytes` + `fs::copy` reliam o original
  por raiz, em série — 4 leituras de rede por cópia com duas pastas).

- Comandos Rust/Tauri: **arquivos** (abrir/salvar), **assets** (copiar imagens com nome limpo),
  **rascunhos**, **projetos** (árvore), **busca** no conteúdo, **pacote IA** (.zip) e **backup**.
- **App renomeado no lado nativo**: crate `mdoffice`, lib `mdoffice_lib`, identificador
  `com.mdoffice.desktop` e binário/processo `mdoffice`. Na primeira execução com o nome novo,
  uma **migração** copia a pasta de dados antiga (`%LOCALAPPDATA%\com.mdcreator.desktop` →
  `com.mdoffice.desktop`) — rascunhos, backups e preferências não se perdem.
- Testes dos comandos (`commands/tests.rs`).
- Tauri com o recurso **`image-png`** e a permissão **`core:window:allow-set-icon`**, para o app
  trocar o ícone da janela em tempo de execução.
- `Cargo.lock` sincronizado com a feature **`image-png`** (crates `image`, `png`, `byteorder-lite`,
  `moxcms`), validado com `cargo check --locked`.
- **Lixeira de documentos** (`trash_move`/`trash_purge`): o arquivo sai da pasta do projeto e
  fica em `lixeira/` na pasta de dados do app, com um índice do caminho original; a limpeza
  apaga de vez só o que passou de **30 dias** (roda na abertura e a cada arquivo movido). O
  aviso de backup sabe que o arquivo está na lixeira e não trata como "sumido".
- Comandos do painel de **Armazenamento**: `storage_report` (tamanho da pasta de dados e da
  pasta da versão anterior) e `storage_remove_legacy` (remove a pasta `com.mdcreator.desktop`
  depois da migração); `drafts_folder_path` e o tamanho de cada rascunho (`bytes`). Com teste
  Rust do `soma_pasta` (28 testes no total).

**Frontend**

- **Redimensionamento fluido da fita e tamanho uniforme entre abas**: arrastar a borda da fita
  (`.fita-resize`) não força mais `getBoundingClientRect()` síncrono nem reabre todos os grupos
  recolhidos a cada pixel — as medidas naturais da aba são cacheadas no `pointerdown` e por
  `WeakMap`, e a atualização roda cadenciada em `requestAnimationFrame`. Além disso, a classe
  `fita-compacta` agora depende apenas da altura escolhida pelo usuário (`escala < 0.88`) e as abas
  principais (**Página Inicial**, **Inserir** e **Desenhar**) compartilham o mesmo piso de ajuste,
  mantendo os botões do mesmo tamanho ao trocar de aba.

- **Fechar todos os arquivos — e o app fica sem nenhum aberto**: fechar a **última aba** não cria
  mais um **"Sem título"** na fileira: o app fica no **Início** com a fileira vazia (o documento de
  trabalho continua existindo por baixo, mas não é uma aba). Entrar no app **sem sessão** também
  abre no Início, sem aba nenhuma. E entrou o comando **Fechar todos** — no menu da aba, na paleta
  do **Ctrl+K** e no **Ctrl+Shift+W** —, que fecha tudo de uma vez. Com a fileira vazia, os
  comandos de documento (**salvar**, **exportar**, **desenhar**, **imagem**, **revisar**,
  **apresentar**, **copiar para a IA**, **histórico**…) **avisam em vez de agir** num documento que
  não está à vista, a barra de status diz **"Nenhum documento aberto"** e a janela fica só
  "mdOffice". Teste: `npm run test:layout`.
- **A fita volta da aba com o encaixe certo (não "bugada")**: com a faixa **recolhida**, clicar numa aba abre a faixa "por enquanto" — e isso tira a classe `fita-recolhida` ✗ **sem avisar o encaixe**, que decide o plano justamente por ela: o plano continuava o da **faixa única** (todos os grupos viram botão/menu) e, ao voltar para a aba, a fita aparecia assim (o print). Agora quem mexe na classe **avisa num evento próprio** quando o modo muda **de verdade** (`EVENTO_MODO`, separado do evento da preferência, para as duas pontas não se chamarem em laço) e o encaixe **re-planeja** — a fita volta certa, com só os grupos que não couberem em menu.
- **A fita cabe na largura em quatro degraus — e sem rolagem (PowerPoint, Word e Excel)**: a faixa
  de opções deixou de empurrar botão para fora da tela. Do mais folgado ao mais apertado: (1)
  **cheia**; (2) **compacta** — espaços e ícones menores, com **piso de fonte** (o Excel entrou
  nesse caminho: saiu do `zoom`, que encolhia o texto junto); (3) os **grupos que não couberem
  viram um botão** com o nome do grupo — clicar abre um menu com os controles daquele grupo, e o
  **último** grupo colapsa primeiro, então o que se usa o tempo todo continua à vista; (4) **faixa
  única** no modo recolhido (Ctrl+F1 ou duplo clique numa aba): os grupos da aba ativa ficam numa
  linha de botões (o "mais" de cada grupo) e a faixa acompanha a aba ativa, em vez de sumir. Quem
  decide é uma função pura (largura disponível × largura dos grupos, `src/fitaEncaixe.ts`), medida
  em `npm run test:encaixe`; a conferência cobre **1400/1100/900/700 px** com a escala em
  **0,7/1/1,5** e a pior combinação ainda deixa a fita inteira à vista. As **setinhas de rolar** do
  Word e a roda do mouse nos painéis saíram (a galeria de Estilos continua rolando de lado, que ali
  é galeria). A alça de altura ganhou **teto**: o menor entre **1,5×** e **um terço da janela** —
  numa janela baixa a faixa não come a tela (o valor guardado segue sendo a sua preferência).
  Testes: `npm run test:encaixe` e `npm run test:layout`.

- **A lista de recentes virou uma grade de cartões com a prévia**: cada cartão mostra um "papel"
  com o título (a primeira linha) e o começo do texto do documento, com a cor do formato na borda;
  o ícone do formato fica no lugar enquanto a prévia não chega (ou quando o arquivo não tem texto).
  A prévia é lida por arquivo, em paralelo, depois do cartão nascer — e o texto do arquivo entra
  **escapado** (é conteúdo de fora). Teste: `npm run test:layout`.

- **Histórico da apresentação: a lâmina em foco antes × depois (em vez do texto do deck)**: a aba
  **Alterações** (e a **Versões**) de um `.pptx` despejava o **texto serializado do documento
  inteiro** — os resumos viravam "+4843 −7259" e o diff não dizia nada sobre o que estava na tela
  (print do usuário). Agora o painel mostra as **duas versões da lâmina em foco** (a selecionada
  no editor) como **mini lâminas lado a lado** — esquerda: como estava; direita: como ficou —,
  desenhadas com o mesmo motor da miniatura da faixa; quando a versão é de antes de a lâmina
  existir, o lado avisa. Os outros módulos (Markdown, Word e Excel) seguem no diff de texto de
  sempre. Teste: `npm run test:log`.

- **Sem sessão, o app fica no Início (não abre rascunho sozinho)**: ao recarregar com **nada aberto**, o app abria **sozinho** o último rascunho — e, no navegador, o `temp/rascunho.md` velho do projeto — sem se saber o que viria (relato: "não tem nada aberto e ele abre o primeiro documento ou último que foi aberto"). A sessão vazia caía na recuperação **legada** (de antes das abas): agora, sem sessão para reabrir, o app **fica no Início (o Hub)** — exatamente como quando se fecha a última aba — e a recuperação legada sai do start. **Nada se perde**: os rascunhos continuam guardados e à mão em **Recentes ▸ "Rascunhos guardados no app"**, e o texto do `temp/rascunho.md` (dev) segue no arquivo, para abrir quando quiser.

- **Histórico: o diff agora é lado a lado**: o painel abria a mudança numa coluna única (a linha
  vermelha "saiu" em cima, a verde "entrou" embaixo) — agora o **antes fica à esquerda** e o
  **depois à direita**, **pareados linha a linha**, com uma barra **Antes · Depois** grudada no
  topo enquanto o diff rola; o que não mudou sai igual dos dois lados, o lado sem linha fica
  apagado e o trecho omitido vira um **⋯** atravessando as duas colunas. A legenda passou a
  explicar esquerda/direita. Vale para **Versões** e para **Alterações** (o `test:log` prende o
  pareamento: troca, inserção, remoção e bloco com excedente).

- **A faixa não recolhe mais com dois cliques**: o **duplo clique numa aba** (Página Inicial, Inserir…) alternava o recolher da faixa — e quem troca de aba apertado, ou abre e fecha um popup pelo próprio botão (o **Template**, por exemplo), recolhia a faixa **sem querer** ✗ (relato do usuário). O gesto saiu: **recolher/abrir a faixa agora é só o `Ctrl+F1`** (a dica continua no `title` da barra das abas), e **dois cliques no mesmo botão** — inclusive o que abre e fecha um popup — também não recolhem nada. Um clique simples num comando continua devolvendo o espaço, como sempre.

- **A fita não recolhe enquanto se escolhe num popup**: com a faixa recolhida e aberta "por enquanto" (um clique numa aba), **escolher um modelo no Template** — ou qualquer item de um popup do app — **recolhia a faixa do nada** ✗ (print do usuário): o popup vive no `document.body`, então o clique nele contava como "clique fora", e o próprio clique no botão que **abre** o popup já mandava fechar. Agora os popups do app marcam **`app-popup`** (os do PowerPoint, os do Word, o menu do **seletor** de campos e o menu do **Excel**), o clique dentro deles (e dentro de qualquer **diálogo** do app) **não é "fora"** e o comando que abre um popup adia a decisão **um tique** — se o popup já fechou, a faixa volta a fechar como sempre.

- **A lista dos seletores ficou do tamanho do campo (mudar o tamanho da fonte não abre mais uma
  janela)**: o menu dos seletores (tamanho da fonte, fonte, e todos os `<select>` do app) usava a
  largura e as linhas dos menus **“⋯”** — **250px de largura mínima** e **~36px por item** —, então
  escolher “36” abria um painel gigante com barra de rolagem, fora do tamanho do campo (print do
  usuário). Agora a lista **abraça o conteúdo** (com a **largura do campo como mínimo**, como a
  lista nativa), as linhas são **compactas** (22px) e a altura fica presa em **60vh/330px** com a
  rolagem dentro. Vale para a fita (PowerPoint, Word, Excel), os painéis e o editor.

- **Cache do WebView com teto escolhido**: a linha nova **Cache do WebView** em
  **Configurações ▸ Armazenamento** mostra o que está em disco agora (ex.: "55.1 MB agora") e
  deixa escolher o teto — **Automático** (o WebView decide, como sempre foi), **512 MB**, **1 GB**,
  **2 GB** ou **4 GB** — no mesmo controle dos outros ajustes. A escolha vale na **próxima
  abertura** do app (o WebView só lê o argumento quando a janela nasce): até lá a linha avisa
  "vale na próxima abertura do app" e, depois de reabrir, mostra só o limite em uso. A conta do
  "Outros dados do app" continua a mesma; a linha nova é que separa o cache das preferências.
- **Marcador de conflito no histórico (limpeza)**: o fechamento da tarefa das Ideias deixou um
  bloco de conflito (`<<<<<<<` / `=======` / `>>>>>>>`) **commitado** no
  `docs/historico-tecnico.md` — a resolução tinha sido feita e conferida, mas o `fechar.ps1`
  desfez o arquivo ao continuar o rebase, e o `git add` seguinte estagiou a versão com os
  marcadores. Os três marcadores saíram (os dois lados ficaram: a entrada do botão de perigo e a
  das Ideias) e o `testar-layout` agora **falha** se um marcador voltar em `CHANGELOG.md`,
  `README.md` ou nos docs dos módulos — o defeito não passa mais despercebido.

- **Documento novo já salvo na pasta padrão do app (`Documentos\mdOffice`)**: criar um documento não pergunta mais nada — ele **nasce salvo** na subpasta do próprio tipo, uma para cada: **`Markdown`**, **`Word`**, **`Excel`** e **`PowerPoint`** (`Documento.md`, `Documento.docx`, `Documento.xlsx`, `Documento.pptx`; o nome livre vira `Documento-2`, `Documento-3`… e a checagem é no disco, então dois seguidos nunca colidem). Vale para o `Ctrl+N`, para os cards do Início e para os **+** das abas de cada motor ✓. A raiz entra sozinha na lista de **Projetos** da barra lateral, então as subpastas aparecem na árvore como pastas normais ✓ — e **"Salvar como…" continua perguntando**, já sugerindo a subpasta do tipo (mudou de pasta? as imagens de `assets/` seguem o documento, como sempre ✓). Quem quiser outro lugar salva onde quiser e nada é imposto.
- **A árvore de projetos lista `.xlsx`/`.xlsm`/`.pptx`**: antes só `.md`/`.docx` apareciam — planilha e apresentação ficavam **invisíveis no painel** mesmo estando na pasta do projeto ✗. O teste do Rust cobre as quatro pastas padrão (ordem alfabética, `txt`/imagem fora, pasta vazia fora).
- **Medição não vai para o commit — e a entrada do CHANGELOG promove no fecho**: dois deslizes no fechamento da concordância de número. O **JSON da medição** (`medida-concord.json`, 133 KB) ficou na raiz e entrou no commit com o `git add -A`: medição é **arquivo de trabalho** (o número mora em `docs/medicao-corretor.md`), e na dúvida `git status` antes do `fechar.ps1` mostra o que vai junto. E a **entrada do CHANGELOG** ficou em “Não adicionado” mesmo com o código já na `main`: quando o commit do `fechar.ps1` entra na `main`, a entrada precisa **já estar** em “Adicionado” — quem fecha promove, no mesmo commit.

- **Troca de abas animada**: trocar de documento tinha ficado "seco" — só a barra lateral e os
  painéis animavam. Agora a **nova aba ativa entra com um "pop"** e o **documento desliza do lado
  de onde a aba veio** (aba à esquerda entra da esquerda, à direita da direita) — vale para
  Markdown, Word, Excel e PowerPoint, inclusive entre duas abas do mesmo tipo. O movimento segue
  os níveis das Configurações: **Discreta** desliga e **Completa** usa a curva de mola.
- **Concordância de número no corretor (a regra estrutural que o corpus mediu faltar)**: quando o erro dá uma forma que existe, quem decide entre singular e plural passa a ser a **concordância com a frase** — não a frequência. Se o determinante **imediato** pede plural (“as”, “os”, “vários”, “duas”…; antes ou depois da palavra) e o 1º do dicionário não concorda, a forma que concorda **passa na frente** — “tods os arquivos” → **todos**, “as citacõs” → **citações**, “As segurass notas” → **seguras**. A troca é **dentro da mesma palavra** (nunca uma palavra por outra: o `parDeNumero` cobre o “s” do plural, “m”↔“ns”, “ão”↔“ões/ãos/ães”, “l”↔“is/eis” e o a↔o do gênero) e a concordância ainda **veta** a promoção do contexto que contrarie a frase. Só reordena sugestão — nunca vira correção automática. **Medição:** no conjunto rotulado dá **250/295 = o mesmo do baseline** (os casos injetados não têm a forma “determinante + palavra”), com **falsos positivos 0,00**; o ganho é estrutural e está preso em 8 verificações novas (incluindo os três casos acima). A medição está em `docs/medicao-corretor.md` (oitava medição).
- **Corpus dos n-gramas: cadeia reproduzível — e o resultado medido**: o modelo de sugestões vinha de um corpus que **ninguém conseguia refazer** (nem se sabia o tamanho), e ele tem buracos: **“severidade” não existe** no vocabulário e **“mesh” existe**. Entraram `scripts/baixar-corpus.mjs` (artigos **destacados e bons** da Wikipédia PT, CC BY-SA 4.0 — só **contagens** vão para o app — com **retomada**, **paralelismo** e **manifesto de títulos versionado** para o redo), `scripts/corpus-texto.mjs` (o limpador de HTML: prosa fica; tabela — infobox **aninhado** também —, figura, referência e nota de edição saem), `scripts/regerar-ngrams.mjs` (`npm run corpus`, a cadeia num comando) e `npm run test:corpus` (14 verificações). O `build-ngrams.mjs` passou a aceitar uma **pasta** de corpus (com 718 arquivos a linha de comando estourava). **O achado:** `prop=extracts` só devolve **um** extrato completo por pedido (`exlimit` só vale junto com `exintro`) — era por isso que o download rendia quase nada (0,17 MB/min); a REST (`/page/html/…`) rende o artigo inteiro e, com 4 pedidos em paralelo, o corpus anda a ~0,6 MB/min. **O resultado medido:** com 30 MB de Wikipédia o modelo fica **menor** (4,8 MB) e conhece “severidade” (e não conhece mais “mesh”) — mas **no harness ele é pior**: r@1 **85% → 80%**, r@3 88% → 84%, precisão 91% → 88%, **falsos positivos 0,00 → 1,64/1000**, 19 casos perdidos contra 6 ganhos (ganha em plural com “ss”/“j”, perde em palavras do dia a dia do app: “clicar”, “seguras”, “porcentagens”…). Conclusão honesta: o problema não é só o **tamanho** do corpus, é o **registro** — o antigo estava mais perto dos textos do app (técnico) do que a enciclopédia. O modelo antigo **ficou** (a cadeia está pronta para um corpus do registro certo, ou misto).

- **Diálogo de texto com várias linhas (modo código)**: o diálogo de uma linha do app
  (`pedirTexto`, usado em "Novo modelo", renomear lâmina etc.) ganhou a opção de virar uma
  **área de várias linhas** — Enter quebra a linha e **Ctrl+Enter** (ou o botão) confirma —,
  com fonte monoespaçada e a janela um pouco mais larga. É o campo que o Fluxo do Mermaid do
  PowerPoint usa para colar o `flowchart`; a validação e o "clicar fora cancela" continuam
  iguais.
- **O nível “Completa” ganhou cara própria — e o “Padrão” deixou de ser igual a ele**: os dois níveis eram praticamente indistinguíveis (o “Completa” só mexia **30–100 ms** nas durações e **1 px** no hover). Agora o “Completa” **entra com mola** (a curva passa do ponto e assenta, `cubic-bezier(0.34,1.56,0.64,1)`), viaja **o dobro** (modais e painéis 26 px, menus 14 px, abas 16 px), a **cascata do Início** abre mais espaçada (70/140/210/280 ms), a **paleta (Ctrl+K) entra em escadinha** (26 ms por item), os itens da paleta deslizam de lado, o toast e a barra lateral usam a mola, e o hover sobe **3 px** (com sombra maior nos cartões) — o “Padrão” continua curto e direto, como sempre foi, e o “Discreta” segue sem entrada e sem elevação. A **prévia de cada cartão** mostra o ritmo (a do “Completa” dá dois tempos com um estufo no fim) e a descrição diz o que muda. A rede de segurança do movimento de saída subiu de **420 para 640 ms** (senão o modal saía antes de a animação do completo acabar).
- **Sem o painel "Contexto para IA"**: a aba de pastas vinculadas saiu da barra lateral (não fazia
  mais sentido), junto com o modal "Pastas de contexto para IA", o item do menu **⋯**, o atalho do
  menu do botão direito do editor, o tipo `LinkedFolder` e o comando `inspect_folders` (Rust, que
  só servia a ele). O **Copiar para IA**, o **Pacote para IA** e o painel de **Projetos** ficam
  como estavam, e o menu do editor agora só tem o **Copiar** — sem abrir quando não há seleção.
- **Ícones de tipo no estilo adotado (contorno)**: os ícones das **abas**, das **listas**
  (Recentes/Projetos) e dos **menus** deixaram a folha preenchida e passaram ao **contorno** —
  folha com o canto dobrado, interior vazio e a marca do formato no traço: **#** (Markdown),
  linhas de texto (Word), planilha com faixa de cabeçalho (Excel) e gráfico com seta
  (PowerPoint). A paleta é a do conjunto adotado (**md roxo `#7C3AED`, Word azul `#2B6CE4`,
  Excel verde `#16A34A`, PowerPoint laranja `#EA580C`), a mesma nos dois temas — a identidade
  do formato não muda com o tema. O traço foi calibrado para 16 px (o tamanho das abas) e
  conferido rasterizado em 16, 17 e 22 px, claro e escuro.

- **A lista dos seletores não cobre mais a tela**: a lista aberta de um seletor (tamanho da
  fonte, fonte…) montava os 20+ itens na altura natural e, em tela menor, cobria tudo — não
  dava para ver o documento atrás. Agora a **altura fica presa à janela** (no máximo ~72%
  dela) e a lista **rola dentro** dela; ao abrir, ela já vem **posicionada no item marcado**,
  centrado na área visível, em vez de sempre do começo. Vale para todos os seletores do app
  (Word, Excel, PowerPoint e Configurações).

- **Boas-vindas com o ícone atual do app**: o cartão “Bem-vindo ao mdOffice” (na pré-visualização e no `F1`) ainda mostrava o **quadradinho roxo com “M↓”** — o logo abandonado — e agora mostra o **ícone do app** (as folhas azul/laranja com a folha branca), na versão **clara ou escura** conforme o tema e a escolha das Configurações (a mesma chave que troca o ícone da janela). O CSS do antigo gradiente saiu, e o `test:layout` passa a prender as três coisas: a imagem do ícone, a escolha claro/escuro e a ausência do quadradinho antigo.
- **Formalidade base (Onda 3)**: o catálogo informal → formal cresceu de **18 para 75 padrões**, agora classificados por **classe** (internetês, contração, muleta, gíria, oralidade, atenuação, redundância e vagueza), com política explícita de **seguro** (o app pode corrigir sozinho — 45 padrões) × **sugestão** (30 padrões, quando a troca depende do sentido) e tom mínimo (neutro × formal). Entraram as **regras de frase por janelas** — “a gente vê que” → “nós vemos”/“vê-se que”, “Aí eu fui” → “Então, eu”/“Em seguida, eu”, “então” repetido, “você vê que” → “observa-se que” e “há três anos atrás” → “há três anos” —, com exclusão de citação (`>`), código, URL, sigla e e-mail. O painel de revisão (F7) passa a mostrar o **MIP** (marcadores informais por 1.000 palavras) antes e depois das correções seguras, a contagem por classe e o trecho/risco de cada marcador.

- **Teste do “entretanto” alinhado ao comportamento decidido**: a adversativa leva só a vírgula de antes (“…, entretanto faltou teste.”), como o corpus já exigia (caso 16, “porém”); a expectativa antiga do teste pedia as duas vírgulas.

- **Corretor aprende com as recusas e por classe de erro**: desfazer um ajuste automático (ou digitar por cima) desconta o par aprendido, e o app passa a reconhecer classes (transposição, tecla vizinha, acento, dígrafo) para acertar antes de conhecer o par exato.

- **Salvamento automático com feedback imediato e caminho do arquivo**: enquanto o documento é editado ou gravado, o badge exibe "Salvando…" com ícone de nuvem pulsando; assim que o salvamento é concluído, o badge volta para "Salvo" e exibe logo à sua direita o caminho da pasta/arquivo salvo com botão de atalho para abrir/revelar no explorador de arquivos.

- **Ícones de tipo redesenhados**: cada tipo passou a ser uma **folha de documento** na cor do
  formato (com o canto dobrado) e a marca dentro — M↓ no Markdown, W no Word, a planilha no Excel
  e o gráfico de pizza no PowerPoint —, no lugar do quadradinho com a letra solta; vale nas abas,
  nas listas, nos menus, na busca e no Início.

- **Citação ABNT atualizada para a NBR 10520:2023**: o corretor aceita Caixa Mista `(Silva, 2020)` e passa a sugestão (não erro) para quem escreve em CAIXA ALTA; "et al." opcional.

- **Corretor com contexto e decisão por confiança**: as sugestões passam a usar os **bigramas** do
  modelo de n-gramas (`public/ngrams/ctx-pt.json`) — "vou para a caza" vira "casa" com muito mais
  chance — e o auto-aplicar deixa de ser regra fixa: decide por **probabilidade com margem**
  (vencedor × segundo colocado), empate vira sugestão e o limiar se calibra com o histórico de
  desfazer.

- **O limiar do corretor se calibra com o uso**: desfazer uma correção que o app aplicou sozinho
  sobe o limiar (o corretor fica mais exigente); as que ficam de pé o descem. O limiar em vigor vai
  para o worker a cada veredito, e a calibragem funciona até sem armazenamento local.

- **Correção automática de novo nos casos claros**: a decisão por probabilidade tinha deixado
  passar para "só sugestão" erros óbvios como **"atensao" → "atenção"**; a dominância de uso (5×)
  voltou a aplicá-los sozinha — medido no corpus: **32/32 casos corrigidos e 32/32 textos
  corretos preservados**.

- **O corretor conhece as confusões do português e o teclado ABNT2**: a nota dos candidatos passa a
  ser **ponderada por classe** (c↔ç, s↔z, g↔j, e↔i, o↔u, m↔n, "h" mudo, letra dobrada, inversão de
  vizinhas) e pela **vizinhança de teclas**; as **grafias prováveis** (ss↔ç, ch↔x, dobradas) são
  procuradas direto no vocabulário. "excessao" → **exceção**, "analize" → **análise**, "pesquiza" →
  **pesquisa** e "obrigdao" → **obrigado** agora saem certos - e sozinhos. Corpus: **34/34**.

- **"Você quis dizer" sem falsos positivos**: o aviso só aparece quando a diferença é **erro de
  digitação típico** (inversão de letras, tecla vizinha do ABNT2, confusão c↔ç/s↔z/g↔j/m↔n, "h"
  mudo ou letra dobrada). Antes qualquer troca de letra valia e palavras reais eram questionadas
  ("paridade" → "caridade", "parse" → "passe"); medido com o harness: **3,25 → 0,00 falsos
  positivos por 1000 palavras**, com o acerto da auto-correção em 92%.

- **Ranking das letras faltando/sobrando**: a frequência ganhou **teto** (palavra comum não passa
  mais por cima de um candidato melhor por edição) e o candidato que **preserva o começo da
  palavra** ganha um bônus pequeno. "aparee" → **aparece** (era "para"), "fecar" → **fechar** (era
  "ficar") e "mdia" subiu para o topo da lista (era "dia"). Medido: recall@1 **78% → 82%**,
  precisão do 1º **83% → 87%**, acerto da auto-correção **92% → 95%** e auto-aplicações erradas
  **19 → 13**.

- **O contexto decide a palavra que existe**: quando a forma escrita é palavra de verdade mas não
  combina com a frase ("o maior ganho **resta** aba"), o app pergunta — comparando, no modelo de
  n-gramas, a leitura escrita com as trocas de classe (acento nos dois sentidos, x↔ch, g↔j, c↔ç,
  tecla vizinha, "h" mudo, dobra). É **sugestão** ("o contexto pede «desta»?"), nunca correção
  automática. Recall@1 **82% → 83%**, recall@3 **86% → 87%**, falsos positivos seguem **0,00**.

- **Harness de medição do corretor (F0) com linha de base registrada**: `scripts/avaliar-correcao.mts`
  mede o corretor real (`checkText`) contra um conjunto rotulado — os 25 pares de palavra de
  `test/docs/gramatical.md` e 270 erros sintéticos por classe (acento, c↔ç, s↔ss, x↔ch, g↔j,
  transposição, letra a mais/menos, tecla vizinha) gerados de parágrafos limpos de `docs/*.md` —,
  com recall@1/@3, precisão do 1º lugar, falsos positivos por 1000 palavras, taxa e acerto da
  auto-aplicação, ms/palavra (p50/p95) e o payload que o worker carrega; saída legível, `--json`
  e `--classe=`. Aplicar: `node scripts/avaliar-correcao.mts`. Baseline do commit `120cc9e` em
  `docs/medicao-corretor.md`: detecção 97%, r@1 76%, r@3 85%, FP 3,25/1000, auto-aplicação 76%
  com 10,7% delas erradas, p95 0,152 ms/palavra e 7,5 MB de payload no worker. No fechamento um
  rebase trouxe o corretor com confusões/teclado (`760095e`); a mesma medição rodou no commit novo
  (`cdd1c84`): r@1 80%, r@3 89%, x↔ch 33%→67%, FP igual e p95 0,998 ms/palavra — a comparação está
  no documento. Nada muda no comportamento do corretor.

- **F4 do corretor — a promoção por contexto para de errar**: o `rerankSuggestions` (a camada que reordena as sugestões pelo trigrama/bigrama e pelo lado direito da frase) promovia com evidência **fraca**, e o bônus de classe/uso podiam promovê-la sozinhos — na medição isso custava acerto (“messmo” → “**mesh**” ✗, “revissão” → “**previsão**” ✗). Agora **a promoção é do contexto**: piso próprio (0,06), no mínimo **3×** o contexto do 1º do dicionário + margem, e o bônus de classe/uso só escolhem entre candidatas que o contexto já sustenta. Com o modelo ligado, o r@1 voltou de **84% para 85%** (empata com a rodada sem modelo em vez de perder 1 p.p.), a precisão do 1º segue **91%** e os falsos positivos **0,00**. A varredura de limiares (8 pisos × 5 fatores × 4 margens sobre as evidências reais de 54 casos do conjunto) mostrou que **nenhuma** configuração faz a promoção ganhar nesse corpus — a régua ficou conservadora de propósito: promove quando o contexto é de fato decisivo, fora disso não chuta.
- **Harness: medição caso a caso**: o `--json` do `scripts/avaliar-correcao.mts` agora leva a lista `medidas` (cada erro com conjunto, classe, sugestões, auto e trecho) — é o que permite comparar duas rodadas (com/sem modelo, antes/depois) **por índice** e ver exatamente quais casos mudaram, em vez de só o total.
- **Fila do salvamento automático (nada de pedido descartado)**: um salvamento por vez e o pedido
  que chega durante uma gravação **deixa de ser ignorado** — ao terminar, a fila grava de novo com
  o texto mais recente. Antes (`if (this.saving) return`), em pasta de rede o autosave disparado
  durante uma gravação lenta era simplesmente descartado e a última parte do que foi digitado
  ficava sem salvar até a próxima tecla/blur/fechar. Rajadas de pedidos durante a gravação viram
  **uma** gravação (coalescência), a digitação nunca espera o disco e o indicador "Salvando…"
  continua refletindo o estado real. Teste novo: `npm run test:salvamento` (fila exercitada com um
  "disco lento" de mentira + contratos do Rust).

- **Frases formais, degrau 2 — clichês, perífrase e plano em 1ª pessoa**: entrou a classe **clichê** (peso 1 no MIP, como a pesquisa pede) com 10 padrões — **com correção**: “nos dias de hoje” → **atualmente**, “vem crescendo” → **tem crescido**, “de suma importância” → **essencial**, “desde os primórdios” → **desde o início**; **só sugestão**: “é sabido que”/“todos sabem que” (afirme direto), “cada vez mais”, “faz-se necessário”, “no mundo atual”, “abrir um leque de possibilidades” e “um passo importante”. Duas **janelas de frase** novas: **“vou estar enviando” → “enviarei”** (a pessoa vem do auxiliar e o verbo sai do gerúndio pelo infinitivo, com fazer/dizer/trazer e os compostos na tabela dos irregulares — “vamos estar fazendo” → **faremos**, “vão estar trazendo” → **trarão**) e **“vou fazer”/“vamos enviar”** em 1ª pessoa, que avisa e mostra a passiva certa (“será feito”, “serão enviados”) **sem troca pronta** (o gênero e o número do complemento mandam). Completam o catálogo “dá pra ver que” → **observa-se que**, “de certa forma” (vagueza; “meio que” deixou de sugerir justamente “de certa forma”) e “criar novo”/“inovar do zero” (redundância). São **94 padrões** em 9 classes, e as regras novas marcaram **zero** falsos positivos nos 98 mil palavras dos documentos do próprio projeto (a única marcação foi o “de certa forma” citado na pesquisa, que fala da regra).
- **Formalizar texto com prévia antes/depois**: o comando novo (**Ctrl+Alt+F**, no menu “Escrever” e no painel de revisão) pega a **seleção** — ou o documento inteiro quando não há seleção — e mostra **antes × depois** lado a lado, com o **MIP ao vivo** e os trechos trocados pintados (vermelho no antes, verde no depois). As **trocas seguras** (com correção pronta — a mesma régua do MIP) já entram marcadas; as que **dependem do sentido** esperam a decisão, com o risco explicado no tooltip e as alternativas em chips (“a gente analisou” → “Nós analisamos” **ou** “analisou-se”); os avisos sem troca pronta (“sei lá…”) só informam, sem caixa. Nada dentro de citação (`>`), código, URL, sigla ou e-mail, e aplicar é **uma transação**: Ctrl+Z desfaz tudo de uma vez.
- **Dois consertos no catálogo que a prévia revelou**: “dar uma olhada **no** relatório” virava “examinar **no** relatório” — a troca agora leva a preposição junto (“examinar o relatório”, “examinar a planilha”, “examinar as contas”…) e a forma solta, sem objeto, virou **sugestão** (“examinar”, “revisar”, “conferir”); e “um monte de **gente**” virava “muitos gente” — agora é **sugestão** com as quatro formas (muitos/muitas/vários/várias). As duas eram marcadas como **troca segura**, e a formatação em massa as aplicava assim mesmo.
- **Abas estilo Chrome**: `Ctrl+T`/`Ctrl+W`/`Ctrl+Tab`/`Ctrl+1…9`, reabrir a última fechada,
  arrastar para reordenar, menu de contexto; fechar nunca pergunta (vira rascunho em Recentes);
  fechar o **último documento** volta para a tela de Início.
- **Atalhos configuráveis** (Configurações ▸ Atalhos): antes a aba só mostrava a lista — não havia
  como escolher outra tecla. Agora cada atalho é um item de verdade: clique na tecla e pressione a
  nova. Tem aviso de conflito (diz qual atalho já usa aquela tecla), recusa tecla solta (letra sem
  Ctrl/Alt atrapalharia a digitação; F1–F12 valem sozinhas), voltar ao padrão por linha ou de uma
  vez, e Esc para desistir. A lista passou a trazer **todos** os atalhos do app — entraram negrito,
  itálico, apresentar, copiar para a IA e ir para a aba N — e as dicas de tecla espalhadas pelo app
  (menus de contexto, botões, busca de comandos) acompanham a troca.
- **Documentação do projeto renovada**: README com a história (mdEditor → mdOffice) e o crédito
  à ArtCraft, licença **MIT**, docs de [estrutura](docs/estrutura-do-projeto.md) e
  [funcionalidades por módulo](docs/funcionalidades.md), e este **changelog + o
  [histórico técnico](docs/historico-tecnico.md)** (entregues neste mesmo commit).
- **Nome unificado em mdOffice**: textos e títulos de janela, metadados gravados em
  `.docx`/`.xlsx`/`.pptx`, nome do pacote (`mdoffice`) e as centenas de referências ao antigo
  "mdCreator" na documentação.
- **Configurações**: os seis `<select>` (intensidade das sugestões, versões por documento,
  política de backup, cópias, prazo e estilo do desenho) viraram **dropdowns do app** — a lista
  nativa do sistema (cinza claro) não seguia o tema.
- **Tela de Início** com os quatro formatos (Word, Excel, MD, PowerPoint) e botão lateral fixo.
- **Painel de projetos**: árvore de pastas com `.md` em cartões (contagem de documentos/pastas,
  esqueleto ao carregar, busca com o termo destacado), animações de abrir/fechar e indicador de
  aberto/alterado por documento.
- **Estrutura do texto**: árvore de títulos com seções que recolhem, destaque da seção atual,
  contagem de palavras/tarefas e ações (mover, promover, copiar, excluir).
- **Histórico de versões** + **log de alterações** (diff leve, marcos) + aba **Backup**, com
  restauração em um passo.
- **Backup em disco** em duas pastas, com política de limpeza (perfis), aviso de arquivo
  sumido e tela de restauração.
- **Configurações numa aba** (Escrita, Tradução, Histórico, Aparência, Atalhos), com ajustes
  valendo na hora; redesign com trilha lateral e cartões.
- **Configurações**: ícones menores na trilha lateral (chips de 32 → 26 px e glifos de 16 → 14;
  marca de 40 → 34), deixando a trilha mais leve sem mudar a estrutura.
- **Configurações em abas**: cada seção aparece sozinha, em vez da página única que rolava pelas
  cinco. Trocar de seção abre sempre do topo e rolar não troca mais de aba; o nome da seção ficou
  só no cabeçalho dela (a barra fixa do topo repetia o mesmo nome). A confirmação **"Salvo"** virou
  uma pílula no pé da página, fora do canto reservado aos avisos do app.
- **Busca de comandos** (`Ctrl+K`), **modo foco** (`Ctrl+Shift+F`) e atalhos documentados.
- **Importar do Office** (`.docx`, `.xlsx`, `.xlsm`, `.pptx`) com explicação dos formatos antigos.
- **Ícone por tipo de arquivo** (M↓, W, tabela, gráfico de pizza) nas abas, listas e busca.
- Tema claro/escuro, animações consistentes da interface e painel lateral redimensionável.
- **Tela de carregamento** na abertura: cobre a janela enquanto o pacote do app não chega, no
  lugar do HTML cru (ícones gigantes) que aparecia nesse intervalo. O tema guardado passa a
  valer **antes** da primeira pintura, então quem usa o escuro não vê mais o clarão branco.
- **Skills e regras** para IA e o menu **+** separando Markdown, Word, Planilha e Apresentação.
- **Ícone do app escolhível** (Configurações ▸ Aparência): claro ou escuro, trocando na hora o
  ícone da janela e da barra de tarefas; sem escolha ainda, segue o tema.
- **Seção Armazenamento** nas Configurações: resumo com barra proporcional (versões, log,
  backup, rascunhos, outros), cartões com o tamanho de cada parte e limpeza — versões, log,
  rascunhos, cópias antigas e a pasta da versão anterior (mdCreator); atalhos para as pastas.
- **Copiar no menu do botão direito** do editor: com texto selecionado, o menu ganha o item
  **Copiar** (Ctrl+C) antes de "Pasta (contexto)", copiando exatamente o trecho escolhido.
- **Barra lateral com movimento de verdade**: a pílula do seletor de painéis **desliza** entre
  Início/Projetos/Estrutura/Contexto; mostrar/esconder a barra **recolhe a largura** em vez de
  sumir de uma vez; a troca de painel entra com um passo curto (sem o "pop" com escala) e abrir
  uma pasta na árvore **cresce** a altura (fechar já animava).
- **Escolha do tema em dois cartões** (Configurações ▸ Aparência): **Claro** e **Escuro** lado a
  lado, cada um com uma prévia do tema, clicáveis — o interruptor "Tema escuro" saiu.
- **Aparência com nível de animação e cantos** (Configurações ▸ Aparência): **Animação** em três
  cartões — Discreta, Padrão e Completa, cada um com a prévia do ritmo — e **Cantos** em dois
  (Quadrado e Redondo). Valem para o app inteiro e ficam guardados.
- **Cantos: correção do Redondo e do Quadrado**: o Redondo arredondava além do desenho original
  (o botão Desenhar virava pílula) e agora **não mexe em nada** — é o app como ele já era; o
  Quadrado passou a apertar de verdade (2 px nos controles, 3 px nas caixas).
- **Interruptor das Configurações alinhado**: bolinha com folga igual nos quatro lados e igual
  entre ligado/desligado (geometria inteira: 40×24 px, bolinha de 18 px e folga de 3 px), sem o
  desalinhamento de meio pixel que aparecia em 100%, 125% e 150% de escala do Windows.
- **Mover para a lixeira**: último item do menu do arquivo (botão "⋯" e clique direito, agora o
  **mesmo menu** nos dois), com diálogo de confirmação. Antes de mover, salva o que estiver
  aberto nas abas do documento, fecha-as e limpa a lista de Recentes — nada é apagado na hora:
  o arquivo fica **30 dias** na lixeira do app (dá para recuperar pela pasta) e depois some de vez.
- **Menu de Recentes redesenhado**: cada linha tem o **ícone do tipo** do arquivo, o nome com o
  **"há quanto tempo"** ao lado e a pasta na segunda linha (os rascunhos aparecem como
  "Rascunho do app"); as ações ("Abrir arquivo…", "Reabrir aba fechada") ficam **fixas no rodapé**
  enquanto só a lista rola, e o × de tirar da lista aparece no hover, no lugar do tempo.
- **Histórico e salvamento (aba das Configurações)**: mostra **o que cada camada guardou** —
  versões (quantas, quantas marcadas, a última e o nome dela), alterações (quantas e o último
  resumo) e cópias em disco (quantas, tamanho e a última) — e as **cópias viram lista dentro do
  app**, com **Restaurar** e **Apagar** por cópia, para o documento atual **e** para os outros
  documentos com backup. Ganhou "onde ficam os arquivos" (as duas pastas com Abrir e o log
  exportado em `.historico/historico.json`), o atalho para os **originais sumidos** e o
  **Apagar completo** (versões + alterações + log exportado - as cópias em disco ficam; antes
  o botão apagava só as versões). O "Abrir histórico" abre direto na aba certa.
- **Diálogo de texto do app** (`src/dialogoTexto.ts`): componente único para pedir um nome - campo
  com rótulo e dica, **Enter/OK** confirmando, **Esc/Cancelar/clique fora** cancelando e `validar`
  com mensagem de erro. Substitui os `window.prompt` nativos ("localhost:1420 diz."), que não
  seguem o tema.
- **Seleção do app no lugar da lista cinza do sistema**: todo `<select>` restante (Word, Excel,
  PowerPoint, diagramas e desenho de letras) passa a abrir o **mesmo menu suspenso do ⋯**, que
  segue o tema claro/escuro (`src/seletor.ts` + estilos do controle). O `<select>` continua no
  DOM — valor, opções e o evento `change` seguem valendo para todo o código existente — e a tela
  mostra uma “cara” com o rótulo atual e o chevron. **Esc fecha só a lista** (o diálogo por baixo
  continua), clicar fora fecha e opção desabilitada não abre.
- **Configurações com o seletor unificado**: os seis campos que usavam um botão próprio de menu
  (intensidade das sugestões, versões guardadas, política/cópias/prazo do backup e estilo do
  desenho) agora são `<select>` melhorados pelo **mesmo controle do resto do app**
  (`src/seletor.ts`): a lista aberta é o menu suspenso do app, no tema. O componente antigo
  (`dd`/`ctx.menu`) sai — uma implementação só.
- **Seletor do app acertado**: o controle que substitui o `<select>` nativo ficou **em branco** no
  valor vazio (mostrava um “—” que parecia erro) e a **setinha acompanha o tamanho do contexto**
  (1em — na fita do PowerPoint ela cresce junto quando a faixa é aumentada). A lista aberta
  **fecha antes** de um painel se redesenhar (`fecharSeletor`), em vez de ficar presa a um
  controle que sumiu.
- **Seletor do app com campo editável**: o controle ganhou o modo `data-editavel` — o valor vira
  um **campo que aceita digitação** (com a setinha abrindo a mesma lista), o que a pessoa digita
  entra como opção do próprio select e o `change` continua valendo para todo o código existente;
  `data-num` normaliza números (vírgula ou ponto, com mínimo e máximo declarados no próprio
  select). É o que as fitas do **Word** e do **PowerPoint** usam para não ficar presas a listas
  fixas de fonte e tamanho. A lista de fontes comuns virou **uma só** (`src/fontes.ts`),
  compartilhada pelos dois motores, com as clássicas do Windows/Office.
- **A tela de carregamento não se mexe mais**: no intervalo entre o HTML e o pacote do app
  (CSS + JS), a página ficava sem estilo e mais alta que a janela — dava para rolar com a roda do
  mouse ou arrastar a barra de rolagem por baixo da tela de carregamento. Agora o `html`/`body` já
  nascem travados no próprio `index.html`, com os MESMOS valores do `base.css` (nada muda quando o
  app assume).
- **Selo do salvamento honesto com arquivo SEU do Office**: ao editar um `.pptx`/`.docx`/`.xlsx`
  que é seu, o autosave **não** reescreve o arquivo (o motor pode simplificar animações, gráficos,
  comentários e revisões) — mas o selo da barra dizia **"Salvando…" para sempre**, como se houvesse
  uma gravação que nunca termina, e o chip do caminho sumia junto. Agora ele mostra **"Não salvo"**
  (âmbar, sem pulsar), o caminho continua à vista e, na primeira alteração de cada arquivo, um aviso
  explica que só o **Ctrl+S** grava o arquivo (as alterações ficam no histórico do app). O MD\* segue
  igual ("Salvando…" → "Salvo") e a descrição do toggle nas Configurações passou a dizer o que o
  salvamento automático cobre. Verificações novas em `npm run test:salvamento`.
- **Dica (tooltip) no padrão do app**: os controles sempre tiveram a dica no `title` — e é bom
  (um lugar só, com a tecla do atalho junto, atualizada pela aba Atalhos) —, mas quem desenhava o
  balão era o **navegador**, com a fonte, a borda e a sombra do sistema, destoando da fita, dos
  menus e do resto do app (o "Pincel de Formatação" do Word era o exemplo à vista). Agora um balão
  próprio (`src/dica.ts` + a regra `.dica`) mostra esse mesmo texto: superfície dos menus (painel,
  borda, sombra), tema claro/escuro, a preferência de cantos respeitada e **acima dos popups**. Ele
  espera **380 ms** parado sobre o controle, não abre no toque, não recebe o ponteiro, sai no
  clique/Esc/rolagem, nunca sai na impressão — e o `title` **volta** ao elemento assim que o balão
  fecha (o nativo nunca chega a aparecer). Vale para a fita, a barra, a régua, os painéis e o modo
  apresentação; verificações novas em `npm run test:layout`.
- **Botão de perigo das Configurações legível**: o **"Remover…"/"Apagar…"** das Configurações saía
  **vermelho com o rótulo vermelho** (invisível): o botão tem as classes `btn` e `st-btn`, e o
  `.btn.danger` do base pintava o **fundo** enquanto o `.st-btn.danger` pintava o **texto**. Agora
  ele é o botão do lugar — fundo normal, texto vermelho e borda no tom — e o **vermelho sólido com
  texto branco fica só no hover e na confirmação** (o apagar pede dois cliques).
- **A roda do mouse anda de lado nas fitas e na galeria de Estilos**: as partes que passam da
  largura (a **galeria de Estilos** do Word, os **painéis** das três fitas e as **abas** das
  Apresentações) rolam na horizontal com a barra escondida — e sem botão próprio na galeria não
  havia como alcançar o que ficava cortado: quem via o "Título 3" não chegava à "Citação". Agora a
  roda vertical vira **rolagem lateral** (como nas galerias do Office), com três cuidados: o trecho
  de dentro pega o gesto para si (a galeria rolando **não** arrasta a fita inteira, nem no fim),
  `Ctrl`/`Shift`/roda lateral seguem o caminho normal (o zoom continua do `Ctrl` + roda) e um trecho
  sem o que rolar deixa o evento passar. O handler virou **uma função só**
  (`ligarRodaHorizontal`, em `src/fita.ts`): o Excel e o PowerPoint tinham cópias inline — o Word,
  nenhuma. 4 verificações novas em `npm run test:layout`.
- **O botão de recolher a faixa faz o que anuncia (o caso do Template)**: com a faixa mostrada
  "por enquanto" no modo recolhido — o que acontece ao clicar num botão da barra das abas, como o
  **Template** —, o chevron usava o estado **fixo** em vez do que está à vista: ele anunciava
  "Recolher a faixa de opções" e fazia o contrário (fixava aberta, e a faixa não fechava mais).
  Agora o clique decide pelo que está à vista: aberta (mesmo que só por enquanto) → **recolhe**;
  recolhida → fixa aberta. Vale para as três fitas (Word, PowerPoint e Excel).
- **A aba Alterações do histórico mostra o documento, não o "commit do app"**: no Word, PowerPoint e
  Excel os estados são guardados como **texto serializado** (um JSON interno) e o diff aparecia com
  esse blob — com o `\n` escapado e tudo — no lugar do que a pessoa escreveu (o relato veio com a
  captura de uma apresentação). O tipo do documento agora vem do **arquivo** (extensão), não da aba
  ativa, e um **texto legível** tenta o projetor do tipo e, se ele não reconhecer o estado (formato
  antigo), os dos outros motores; nada reconhecendo, o JSON cru **não** vai para a tela. O
  **resumo** de cada alteração também sai do documento: a lista mostra "+2" (o tamanho da mudança de
  verdade) em vez de "+4843 −7259" (o tamanho da serialização). 4 verificações novas em
  `npm run test:layout`.
- **A dica não pisca mais ao mexer o mouse (e sai suave)**: com **títulos aninhados** — a linha da
  pasta tem o caminho e o selo interno o texto dele (a lista de arquivos da barra lateral) — cada
  passada do mouse sobre o filho escondia o balão e o reabria, alternando os textos: o "piscar" do
  relato. Agora mexer **dentro** do dono atual não troca a dica, e a saída **esvanece** (classe
  `saindo`, ~130 ms) antes de sair do fluxo, em vez de sumir de uma vez. 4 verificações novas em
  `npm run test:layout`.
- **O campo de fonte sugere enquanto se digita (e a lista para de fechar sozinha)**: no relato,
  digitar o nome da fonte não sugeria nada e a lista aberta **fechava** no primeiro clique dentro do
  campo. Agora o controle (o mesmo das fitas do PowerPoint e do Word, do Excel, das Configurações e
  dos diálogos) abre a lista **filtrada pelo texto** — sem ligar para maiúsculas nem acentos ("time"
  acha "Times New Roman") — e ela **continua aberta** enquanto se escreve, com os itens trocando no
  lugar (sem piscar: a entrada animada do menu toca uma vez só, na abertura). As **setas** andam
  pelos itens, o **Enter** aplica o destacado (sem sugestão, vale o texto digitado, como antes), o
  **Esc** devolve o texto que estava e a seta para baixo abre a lista toda (como no Office). Sem
  correspondência, a própria lista avisa: "Nada corresponde — Enter usa o texto digitado". Os campos
  de **número** (tamanho) não sugerem — ali o valor é livre e a lista é atalho. 8 checagens novas em
  `npm run test:layout`.
- **"Abrir em nova janela (só este documento)" — a janela do documento vira um app de verdade**: o
  item já existia no menu da aba, mas a janela nova subia **sem as permissões do app** (a capacidade
  estava presa às janelas `main`/`config`), então ela abria com a **barra nativa do Windows por cima
  da barra do app**, os botões minimizar/maximizar/fechar **mortos** e os diálogos (salvar, escolher
  arquivo) recusados. Agora a janela nasce **sem moldura**, como a principal, e o label `doc-*`
  entra na capacidade — a janela do documento tem as **mesmas permissões** da principal. De quebra,
  o item passou a funcionar com **documento nunca salvo**: antes ele respondia "Salve o documento
  antes…" justamente no caso mais comum (documento novo); agora o app grava o **rascunho** dele e a
  janela abre esse rascunho. E o rótulo diz o que a janela leva: **Abrir em nova janela (só este
  documento)** — ela abre com **uma aba** e a aba sai da janela atual (o gesto de arrastar a aba
  para fora continua igual). 4 checagens novas em `npm run test:layout`.

**Ferramentas (dev)**

- **O modelo do corretor saiu do git (e o histórico dele foi removido)**: os quatro JSONs
  (`pt/ctx-pt/freq-pt/syn-pt`, ~9,5 MB) eram versionados e **cada regeneração reescrevia o arquivo
  inteiro** — 4 commits de n-gramas somavam ~14 MB no histórico. Agora eles moram **fora do git**
  (como `public/ort` e `public/modelos` já faziam): o `.gitignore` ignora os JSONs, um `LEIA.md` na
  pasta explica a geração, as worktrees **ligam a pasta à cópia principal** (`abrir.ps1`) e o
  `regerar-ngrams.mjs` passou a dizer para guardar uma cópia antes de regenerar (não há mais
  `git checkout --`). O **histórico da `main` foi reescrito** com `git filter-repo` (num clone
  isolado; os JSONs saíram de todos os commits) e o `main` do GitHub foi atualizado com **push
  forçado protegido por lease** — o commit da limpeza está em **Adicionado** porque a operação roda
  direto na `main`. De quebra, o repositório ganhou o primeiro **`git gc`** em muito tempo:
  o `.git` caiu de **111 MB (objetos soltos, sem pack) para 11,5 MB**. As branches de tarefa
  abertas ainda seguram os blobs antigos (a `main` delas é a antiga); quando fecharem (rebase na
  `main` limpa) eles ficam inalcançáveis e o próximo `gc` os descarta — o alvo é ~4,5 MB.

- **`test:excel` está quebrado em checkout limpo (achado, não consertado)**: o segundo teste (`testar-grade-excel.mjs`) compila o motor com `tsc` sem os tipos do `?raw` (erros `TS2307` sobre `.toml?raw`/`.css?raw`) e, quando compila, o stub de DOM não cobre o seletor novo do app (`melhorarSelects` explode) ✗. Na cópia principal ele passa por acaso: o `temp/` está compilado de antes ✗. Fica registrado para quem for consertar (é teste, não app).
- **Marcador de conflito no CHANGELOG (limpeza)**: o fechamento da tarefa do ícone das boas-vindas resolveu um conflito de rebase e deixou a **linha de fecho** (`>>>>>>> 074695b …`) no arquivo — o `git diff --check` acusa, mas nem o `fechar.ps1` nem os testes olham o CHANGELOG. A linha saiu e o `git grep` do repositório inteiro ficou **limpo** (era o único marcador). Fica a lição: ao resolver conflito, conferir os **três** marcadores (`<<<<<<<`, `=======`, `>>>>>>>`) e rodar `git diff --check` antes de `git add`.
- **Teste da formalização** (`npm run test:formalizar`, 47 verificações): prova o plano de trocas de ponta a ponta — o que entra (catálogo + janelas de frase, com classe e risco), o que **não** entra (citação, código, texto já formal), a aplicação (ordem, sobreposição, limites para a prévia pintar), a queda do MIP e a **janela inteira** num DOM de mentira (abre, pinta, decide e aplica); prende ainda os dois consertos do catálogo e confere que toda classe que a janela usa existe no CSS.
- Fluxo de **worktrees** obrigatório: `abrir.ps1`, `fechar.ps1`, `limpar.ps1`, `status.ps1`,
  `limpar-agendada.ps1` e proteção opcional da `main`.
- `fechar.ps1` integra a `main` por **rebase** (história linear, sem commit de merge) e envia
  a `main` ao GitHub; `monitor-push.ps1` completa o envio quando todas as worktrees terminam.
- `abrir.ps1`/`fechar.ps1` aceitam a **descrição da branch** (`-Porque`/`-Proposito`), mostrada
  no `status.ps1` e no corpo do commit; `-Branch` confere a worktree certa.
- `fechar.ps1` **bloqueia** o fechamento quando a tarefa não tocou no `CHANGELOG.md` ou no
  `docs/historico-tecnico.md` (mostra o que faltou e como registrar; nada vai para a `main`).
- **Ícones do build regerados** dos pacotes novos (`app-icon.png` do pacote claro +
  `src-tauri/icons/*` via `npm run icon`); o script `icon` virou `tauri icon app-icon.png` e o
  `gen-icon.mjs` (desenho antigo) foi removido.
- **Servidor de dev sem recarga no meio do uso**: as dependências usadas **dentro dos workers**
  (`typo-js`, do corretor, e `@huggingface/transformers`, da IA local e da tradução offline) entraram
  em `optimizeDeps.include`. O Vite não lê arquivo de worker ao procurar dependências, então só
  descobria esses pacotes quando o worker subia — ~20 s depois de abrir o app — e reagia
  re-otimizando tudo e recarregando o app inteiro. O cache do otimizador passou para `.vite/`, por
  pasta: o padrão (`node_modules/.vite`) é compartilhado entre a cópia principal e as worktrees e o
  hash que o valida inclui a raiz do projeto, então cada troca de pasta invalidava o cache e
  recarregava os clientes conectados.
- **Watchdog percebe a página travada**: o processo do app continuar de pé não quer dizer app
  funcionando — depois de muitos recarregamentos o **conteúdo da janela** morre e a janela segue
  respondendo mensagens do sistema, então o watchdog (que só olhava se o processo existia) nunca
  percebia. Agora a página avisa ao servidor de dev que está viva (a cada 5 s, só em
  desenvolvimento) e o `watchdog.ps1` reinicia o app quando o aviso fica velho
  (`-TravadoSegundos`, padrão 90) - com prazo maior para o primeiro aviso, que depende do
  carregamento do dicionário e do modelo (`-TravadoNaSubidaSegundos`, padrão 180). O
  `tools/watchdog.ps1` também ganhou BOM de UTF-8: sem ele o PowerShell 5.1 lê o arquivo como
  ANSI e os acentos saíam corrompidos no log.
- **Pesquisa (documento)**: formalidade por regras e validação ABNT — o que é verificável e como
  (`docs/pesquisa-formalidade-abnt.md`).
- **Pesquisa (documento)**: correção/sugestão sem IA — estado da arte, algoritmos e plano por fases
  (`docs/pesquisa-correcao-offline.md`).
- **Pesquisa (documento)**: síntese com a ordem de execução (dores, camadas, ondas, métricas e
  limites) em `docs/pesquisa-sugestoes.md`.
- **Pesquisa (documento)**: sugestões sem IA — aquecimento, velocidade e sugestões longas: gargalos
  medidos no motor atual (modelo, índice, latência, largura média de 1,35 palavra), estado da arte
  com fontes e plano por fases V0–V4 (`docs/pesquisa-sugestoes-velocidade-tamanho.md`).
- **Monitor da `main` suja**: além do hook que bloqueia o commit na `main`, o mesmo instalador
  (`instalar-monitor.ps1`) agora agenda o `monitor-main.ps1`: a cada poucos minutos ele registra
  no log quando a **cópia principal** fica com alterações soltas (trabalho direto na `main` -
  edição, que o hook não tem como impedir) e quando ela volta a ficar limpa.
- **Teste de layout com a seção do seletor**: `npm run test:layout` ganhou 10 checagens das regras
  que apareceram tortas no seletor (valor vazio sem o “—”, setinha `1em`, alto dos selects nas três
  fitas, setinha do botão de cor dentro do botão, setas de aumentar/diminuir e a lista que fecha
  antes de um painel se redesenhar).
- **Teste de layout com o campo editável**: mais 10 checagens em `npm run test:layout` para o
  modo editável (o valor digitado vira opção, vírgula e min/max, a escolha na lista não é aplicada
  duas vezes, as duas fitas marcadas como editáveis e a lista de fontes única).
- **Testes da roda do mouse**: a decisão da roda virou módulo próprio (`src/powerpoint/roda-laminas.ts`)
  e ganhou 10 checagens em `npm run test:pptx-edicao` (gesto, inércia, rolagem primeiro, soma de
  movimentos pequenos) + 6 em `npm run test:layout` (Ctrl é do zoom, roda lateral ignorada e a
  ligação no palco).
- **Testes do desenho assistido**: `npm run test:desenho` ganhou 4 checagens do arco (traço torto
  sai girado no ângulo do desenho, a curva **passa pelo traço** - desvio máximo medido contra o
  arco reconhecido - e o "canto em L" fica como desenho livre em vez de arco-faca) e o
  `npm run test:pptx-edicao` confere que o arco girado vai ao `.pptx` com rotação e ângulos.
- **Teste de layout com o botão de perigo**: 3 checagens prendem o fundo reafirmado no
  `.st-btn.danger`, o texto na cor de perigo e o vermelho sólido só no hover/confirmação - o
  defeito (rótulo vermelho sobre fundo vermelho) não volta sem alguém notar.
- **Testes do Conectar**: 8 checagens novas em `npm run test:ligacoes` prendem o alvo geométrico
  (a bolinha manda, a caixa de cima vence, a histerese não solta na fresta e o clique devolve a
  caixa e o lado) e 4 em `npm run test:layout` garantem que o palco usa a função (e não o DOM) e
  deixa os conectores fora do alvo — o defeito das bolinhas piscando e da ligação na caixa errada
  volta só com alguém vendo.
- **Verificações do pincel de formatação voltaram a passar**: duas checagens de `testar-layout`
  usavam janelas curtas de regex (600 e 320 caracteres) entre um marco e a guarda, e o código
  cresceu em volta (876 e 495) — a `main` ficou com `test:layout` vermelho sem o pincel ter
  quebrado nada. As janelas foram para 1200 e 700 (as guardas testadas são as mesmas).
- **`testar-layout.mts` estava quebrado na main (sintaxe)**: uma resolução de conflito de outra
  sessão comeu o `);` e o `}` de uma checagem do histórico — o arquivo nem carregava
  (`ERR_INVALID_TYPESCRIPT_SYNTAX`) e ninguém via. Consertado no caminho desta tarefa.
