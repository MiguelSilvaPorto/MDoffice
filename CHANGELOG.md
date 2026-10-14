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

> Estado do "Não adicionado" conferido em **2026-10-13**.

---

## MD\*

### Não adicionado (fora da main)

**Backend**

- (nada no momento)

**Frontend**

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
- **Avisos de estilo com a correção pronta no popup**: clicar num aviso como **"Frase muito
  comprida"** agora mostra o trecho **já corrigido** ("… do novo projeto. E combinamos de …") com
  um clique para aplicar — antes o popup só dizia "comece nova frase aqui". Nesses avisos os botões
  de dicionário ("Ignorar palavra", "Adicionar ao dicionário") dão lugar a **"Ignorar neste
  texto"**, que dispensa o aviso somente naquele documento (nos outros ele continua).

### Adicionado (na main)

**Backend**

- (nada específico do módulo — arquivos, imagens e rascunhos passam pelos comandos do **Geral**)

**Frontend**

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
  "..." — antes o "...." era tratado como intencional e passava batido. A correção entra na
  varredura (na pausa, ao terminar o parágrafo e ao salvar) e o aviso mostra o trecho já
  corrigido; linhas pontilhadas longas (".....") continuam intactas.

---

## Word

### Não adicionado (fora da main)

**Backend**

- (nada no momento)

**Frontend**

- (nada no momento)

### Adicionado (na main)

**Backend**

- (nada específico do módulo — abrir/salvar passam pelos comandos do **Geral**)

**Frontend**

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

---

## PowerPoint

### Não adicionado (fora da main)

**Backend**

- (nada no momento)

**Frontend**

- (nada no momento)

### Adicionado (na main)

**Backend**

- (nada específico do módulo — abrir/salvar passam pelos comandos do **Geral**)

**Frontend**

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
- Testes: `test:pptx` (ida e volta de arquivos reais) e `test:pptx-edicao`.
- **Checklist de paridade revisado** contra o código atual e contra o projeto **DeckCraft** real
  (232 comandos): itens que já existem passam a aparecer como feitos (Transições, ocultar/
  renomear/redefinir lâmina, marca-texto, sobrescrito/versalete, mudar caixa, ir para lâmina,
  tela preta/branca), o resumo vai a **102/191** e entra o **mapa de edição** — 14 áreas do que o
  DeckCraft edita e falta aqui, com os ganhos rápidos e os próximos passos reordenados
  (`docs/paridade-deckcraft.md`).

---

## Geral

### Não adicionado (fora da main)

**Backend**

- (nada no momento)

**Frontend**

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
  **pesquisa** e "obrigdao" → **obrigado** agora saem certos — e sozinhos. Corpus: **34/34**.

**Ferramentas (dev)**

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

### Adicionado (na main)

**Backend**

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
  **Apagar completo** (versões + alterações + log exportado — as cópias em disco ficam; antes
  o botão apagava só as versões). O "Abrir histórico" abre direto na aba certa.

**Ferramentas (dev)**

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
  no log quando a **cópia principal** fica com alterações soltas (trabalho direto na `main` —
  edição, que o hook não tem como impedir) e quando ela volta a ficar limpa.
