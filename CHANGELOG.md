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



### Adicionado (na main)

**Backend**

- (nada específico do módulo — arquivos, imagens e rascunhos passam pelos comandos do **Geral**)

**Frontend**

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

### Adicionado (na main)

**Backend**

- (nada específico do módulo — abrir/salvar passam pelos comandos do **Geral**)

**Frontend**

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

- **A fita do PowerPoint cabe na tela sem rolar** — ela se ajusta sozinha à largura da janela: se o painel da aba não cabe, os espaços e ícones encolhem em degraus (a fonte não), os botões grandes ficam numa linha e, por último, os botões pequenos ficam só com o ícone (o nome fica na dica). Em 1338 px todas as abas cabem (Início estourava 353 px e Animações 218 px); a rolagem lateral fica só para janelas muito estreitas.

- **Aba "Desenhar" na fita**: as ferramentas de traço ganharam o lugar próprio (como no PowerPoint de
  verdade): **Canetas** (**Draw** e **Curva**, que **saíram do Inserir**), **Traço** (**cor** na
  mesma paleta do pincel, espessuras **1/2/4/8**, **Livre/Pontos** e o **Assistente**), **Formas**
  (a galeria + retângulo, retângulo arredondado, elipse, triângulo, linha, seta e conector para
  desenhar arrastando) e **Diagrama** (Fluxo do Mermaid e Conectar). A aba mostra o **estado do
  pincel** (botão aceso na cor/espessura/modo escolhidos) e mexe no **mesmo pincel** da barrinha
  flutuante — o que se escolhe num lugar aparece no outro. Teste: `npm run test:layout`.

- **Aba Design completa: Temas, Variantes, Personalizar e Designer**: a aba tinha só dois grupos
  (fundo e layout) e agora segue os quatro blocos do Office, com a cara do app. **Temas** abre a
  galeria de modelos (a mesma do botão Template), **Variantes** é novo — as seis famílias de cor do
  Estilo de cor (Esmeralda, Oceano, Ameixa, Âmbar, Rubi e a **Grafite** escura) aplicadas à
  apresentação inteira, com **esta lâmina** desenhada em cada cartão (a mesma máquina das Ideias: o
  cartão mostra exatamente o que o clique aplica; a variante troca a cor, não a tipografia) —,
  **Personalizar** reúne fundo, layout e o **Tamanho** da lâmina (**16:9/4:3**, que tinha ficado sem
  UI quando o "Configurar apresentação" saiu) e **Designer** leva as Ideias de design e os Arranjos
  para o lugar do Designer do Office (saem da Página Inicial). Os ícones da paleta das Variantes
  (com as seis cores) e do Tamanho são desenhados no CSS do app — nada de arte do Office. Testes:
  `npm run test:estilos` e `npm run test:layout`.

### Adicionado (na main)

**Backend**

- **Arranjos: o conteúdo não se desloca mais do cartão** — o bloco inteiro (cartão + o que sai dele) é centrado no espaço e todas as formas andam por ele; a detecção roda uma vez e usa mapas por id, em vez de `find` por forma.

- (nada específico do módulo — abrir/salvar passam pelos comandos do **Geral**)

**Frontend**

- **O card "Nova lâmina" da faixa: o "+" do canto saiu e o rótulo assumiu a galeria**: o card
  ficou com dois alvos claros — a **prévia** cria a lâmina na hora, com o **último layout
  escolhido**, e o **rótulo "+ Nova lâmina"** (embaixo) abre a **galeria** com os seis layouts,
  onde a escolha cria e passa a ser o "último" (o mesmo caminho da fita, pelo
  `abrirGaleriaDeLayouts`); clicar no rótulo de novo **recolhe** a galeria, como nos outros popups
  do app. O **"+" redondo** que pendia do canto da prévia era um alvo a mais e saiu (pedido: "o
  botão de cima era para sumir e o de baixa assumir a função"). Teste: `npm run test:layout`.

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

- (nada no momento)

**Frontend**


- (nada no momento)

**Ferramentas (dev)**

### Adicionado (na main)

**Backend**

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
