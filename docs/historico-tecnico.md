# Histórico técnico

O "porquê" de cada mudança de linha do mdOffice. O [CHANGELOG](../CHANGELOG.md) conta **o que**
mudou (por categoria); aqui fica **onde** mudou e **por que** — arquivo, local, a linha e o motivo.

## Regras

- Uma seção por **arquivo**; dentro dela, uma entrada por **mudança** (linha nova ou linha
  alterada). Um arquivo pode receber quantas entradas precisar — este documento cresce sempre.
- Cada entrada tem: **data · commit**, o **local** (função/bloco), a **linha** (`antes → depois`,
  ou “novo arquivo”) e o **porquê**.
- Entra aqui quando a mudança é **entregue na main** (no fechamento da tarefa, junto com o
  CHANGELOG). Trabalho em worktree ainda não entrou: fica só no "Não adicionado" do changelog.
- Entradas antigas **podem ser reescritas/consolidadas** (ex.: várias mudanças da mesma linha
  viram uma só) — o que não pode é perder o porquê atual.

### Modelo

```markdown
## caminho/do/arquivo.ts

### AAAA-MM-DD · commit · resumo curto
- **Local:** função/bloco
- **Linha:** `antes` → `depois` (ou “novo arquivo”)
- **Porquê:** o motivo daquela mudança.
```

---

## tools/worktrees/fechar.ps1

### 2026-10-13 · 5487098 · integração por rebase
- **Local:** bloco `2+3) integra a main aqui e avanca a main`
- **Linha:** `git merge main -m "merge: integra a main"` → `git rebase main`
- **Porquê:** toda tarefa fechada depois de outra criava um commit `merge: integra a main` no
  histórico; o rebase deixa a história **linear** e elimina esse commit. O fluxo de conflito
  passou a deixar o rebase em andamento (o script continua com `git rebase --continue` quando
  o usuário resolve e roda de novo).

### 2026-10-13 · 5487098 · nome da branch com o HEAD solto
- **Local:** leitura da branch atual (`$branch = Get-BranchAtual -Pasta $raiz`)
- **Linha:** `git symbolic-ref --short HEAD` → `Get-BranchAtual` (lê `rebase-merge/head-name`)
- **Porquê:** durante um rebase o HEAD fica *detached* e o script morria logo na primeira linha
  (`fatal: ref HEAD is not a symbolic ref`), impedindo de continuar o rebase.

### 2026-10-13 · 0ee36ef · descrição da branch no fechar
- **Local:** topo do script + passo `1) commit do que faltar`
- **Linha:** novo `$conferirBranch` capturado **antes** de `$branch`; `git commit -m $msg -m $descricao`
- **Porquê:** o PowerShell não diferencia maiúsculas (`$Branch` e `$branch` eram a mesma
  variável, e a checagem do `-Branch` nunca disparava); e a descrição da tarefa agora vai para
  o corpo do commit.

### 2026-10-13 · este commit · bloqueio dos changelogs
- **Local:** passo `0.5) changelogs: sem eles a tarefa NAO fecha`, antes do rebase e do commit
- **Linha:** novo bloco com `git diff --name-only main...orig-head` + `git status --porcelain -uall`
  e `throw` quando falta `CHANGELOG.md` ou `docs/historico-tecnico.md`
- **Porquê:** só avisar não forçava a lembrança; o bloqueio obriga a registrar a mudança na
  categoria que mexeu antes de entregar na `main` (o erro diz o que faltou e como fazer). Roda
  **antes** de continuar o rebase e usa `orig-head` porque, depois do rebase, os changelogs
  podem ficar idênticos aos da `main` e sumir do diff da tarefa.

## tools/worktrees/abrir.ps1

### 2026-10-13 · 0ee36ef · nome e descrição da branch
- **Local:** parâmetros + bloco de validação do nome
- **Linha:** `[Parameter(Mandatory)][string]$Nome` → `$Nome` opcional + `-Branch`, `-Porque`, `-Proposito`
- **Porquê:** dar para abrir a worktree já dizendo **por que** ela existe e **o que** entrega;
  a descrição fica guardada em `branch.<nome>.description` e aparece no `status.ps1` e no commit.

## tools/worktrees/status.ps1

### 2026-10-13 · 0ee36ef · descrição + correção do "Main vs origin"
- **Local:** seções "Branches locais de tarefa", "Limpeza pendente" e "Main vs origin"
- **Linha:** `$temOrigin = "$(Exec ...)"` → checagem de `$LASTEXITCODE` antes de usar a saída
- **Porquê:** num repositório **sem origin**, o texto de erro do git virava "nome do remote" e o
  `[int]` do `rev-list` quebrava o script antes de mostrar as descrições das branches.

## tools/worktrees/_comum.ps1

### 2026-10-13 · 0ee36ef · `Get-BranchAtual` e `Get-DescricaoBranch`
- **Local:** novas funções no fim do arquivo
- **Linha:** novo código (funções compartilhadas)
- **Porquê:** centralizar a leitura da branch (que precisa funcionar com rebase em andamento) e
  da descrição da tarefa, usadas pelo `fechar.ps1` e pelo `status.ps1`.

## tools/worktrees/monitor-main.ps1

### 2026-10-14 · este commit · monitor da main suja (novo arquivo)
- **Local:** arquivo inteiro (`param`, `Logar`, `LogarMudanca` e o bloco do mutex)
- **Linha:** novo arquivo
- **Porquê:** o hook `pre-commit` bloqueia o commit na `main`, mas não as edições — arquivos
  editados direto na cópia principal só apareciam quando alguém rodava o `status.ps1`. O monitor
  fecha o ponto cego no mesmo molde do `monitor-push.ps1`: mutex próprio, estado próprio
  (`.git\mdoffice-monitor-main.estado`) e o mesmo log, escrevendo só quando o motivo muda
  (limpa ↔ suja, com a lista de arquivos na chave). O parâmetro `-Pasta` existe para testar o
  monitor apontando para outra pasta (uma worktree) sem sujar a `main`; a raiz é normalizada
  para a cópia principal (tira `\.worktrees\<tarefa>`), então o padrão aponta certo mesmo
  rodando de dentro de uma worktree.

## tools/worktrees/instalar-monitor.ps1

### 2026-10-14 · este commit · as duas tarefas dos monitores
- **Local:** lista `$monitores` e os blocos `-Estado`, `-Remover` e de instalação
- **Linha:** `$nome = 'MDOffice-MonitorPush'` fixo → lista com **MonitorPush** e **MonitorMain**,
  percorrida nos três caminhos
- **Porquê:** o monitor novo entra junto do antigo com um comando só: `-Estado` mostra as duas
  tarefas e o fim do log, `-Remover` tira as duas, e a instalação cria as duas com os mesmos
  parâmetros (conhost --headless, a cada 2 minutos, sem administrador) — os scripts são
  conferidos antes de qualquer registro, para não instalar metade.

## src/styles/base.css

### 2026-10-13 · este commit · botão de ação destrutiva
- **Local:** depois de `.btn.primary:hover`
- **Linha:** novas regras `.btn.danger` (fundo `--danger`, texto `--accent-fg`) e `.btn.danger:hover`
- **Porquê:** o diálogo do "Mover para a lixeira" precisava de um botão com cara de ação
  destrutiva: mesmo desenho do primário, trocando o acento pelo vermelho do tema (vale nos dois
  temas, porque `--accent-fg` inverte junto).

### 2026-10-13 · e392858 · barras de rolagem no tom do app
- **Local:** bloco `::-webkit-scrollbar`
- **Linha:** `width: 11px` + thumb 35% → `width: 10px`, thumb 42% (70% no hover), trilho
  transparente + fallback `@supports not selector(::-webkit-scrollbar)` para o Firefox
- **Porquê:** vários painéis usavam `scrollbar-width: thin`, que no Chromium **anula** o desenho
  customizado e traz de volta a barra nativa do sistema (com setinhas) — feia no tema escuro.

## src/fita.ts

### 2026-10-13 · e392858 · controles compartilhados da fita (novo arquivo)
- **Local:** `ligarRecolherFita` e `ligarAjusteAlturaFita`
- **Linha:** novo arquivo
- **Porquê:** o topo ocupava espaço demais e não dava para ajustar; as três fitas (Word, Excel,
  Apresentações) ganharam **recolher** (botão, duplo clique na aba ou Ctrl+F1) e **ajustar o
  tamanho** arrastando a borda de baixo — com a escolha guardada e sincronizada entre as fitas.

### 2026-10-13 · (este commit) · a tecla da fita vem da tabela
- **Local:** o ouvinte de `keydown` e o `title` do botão de recolher
- **Linha:** `if (!e.ctrlKey || e.key !== "F1") return;` → `if (emCaptura() || !combina("fita", e)) return;`;
  `"Recolher a faixa de opções (Ctrl+F1)"` → `` `Recolher a faixa de opções (${teclaVisivel("fita")})` ``
- **Porquê:** a ação continua aqui (é quem conhece o estado recolhido/expandido), mas a tecla passou a
  ser a da tabela — é o que permite trocá-la na aba Atalhos. O `emCaptura()` evita que Ctrl+F1 seja
  recolhido enquanto a pessoa está justamente escolhendo uma tecla. A entrada ficou marcada como
  `externo` no `keymap.ts`, então o `keys.ts` não a despacha (ninguém dispara duas vezes) e a linha
  continua editável na lista. O aviso `EVENTO_MUDOU` reaplica o `title` do botão quando a tecla muda.

## src/styles/fita.css

### 2026-10-13 · e392858 · estilos dos controles da fita (novo arquivo)
- **Local:** `.fita-recolher`, `.fita-resize` e regras de `.fita-recolhida`
- **Linha:** novo arquivo
- **Porquê:** o botão de recolher e a alça de redimensionar precisam do mesmo visual nas três
  fitas; a alça tem área de pega maior que a faixa visível sem cobrir a rolagem do painel.

## src/styles/powerpoint.css · src/styles/powerpoint-edicao.css · src/styles/excel.css

### 2026-10-13 · e392858 · faixa numa linha só e lâminas na vertical
- **Local:** `.ppr-painel`, `.xl-panel`, `.pp-left.faixa-vertical`
- **Linha:** `flex-wrap: wrap` → `nowrap` + `overflow-x: auto`; novas regras da faixa vertical
- **Porquê:** em janelas estreitas os grupos quebravam para uma segunda linha e o topo crescia
  sem controle; agora a fita fica com altura previsível e rola na horizontal (roda do mouse).

## src/powerpoint/ui/fita.ts

### 2026-10-14 · este commit · grupo Edição fora da fita
- **Local:** `inicio()` — lista de grupos da aba Página Inicial
- **Linha:** `grupo("Edição", ...)` com o único botão `sel-tudo` → removido; o array da aba
  termina agora no grupo "Desenho"
- **Porquê:** o grupo só tinha o botão "Selecionar tudo" (ícone ▦), redundante com o **Ctrl+A** e
  com a entrada "Selecionar tudo" do menu de contexto no vazio; a ação continua nos dois caminhos
  (o handler `sel-tudo` do `powerpoint.ts` foi mantido).

## src/powerpoint/powerpoint.ts

### 2026-10-13 · e392858 · faixa vertical, zoom ancorado e desfazer na digitação
- **Local:** `montar()`, `pintarStrip()`, `aoTecla()`, `restaurar()`, `setZoom()`
- **Linha:** novo `faixaVertical` + classe `faixa-vertical`; `setZoom(z, ancora)`;
  `Ctrl+Z/Y` durante a edição entram no histórico global
- **Porquê:** pedido de poder colocar as miniaturas na lateral; o zoom com Ctrl+roda devia
  manter parado o ponto sob o cursor; e o desfazer durante a digitação precisava funcionar
  dentro das caixas de texto e tabelas.

## src/app/powerpointDocs.ts · src/app/excelDocs.ts

### 2026-10-13 · 4bbd1b4 · diálogos "Configurar" compactos
- **Local:** `askPptSetup` / `askExcelConfig` (innerHTML do modal)
- **Linha:** `<div class="wm-body">` sem medida → cabeçalho com ícone + `pg-hint` + linhas
  `.pg-rot`/`.pg-check`; CSS novo de `.modal.pg-modal`
- **Porquê:** os diálogos usavam o modal genérico (até 1520×940) com um formulário minúsculo —
  um "pop gigante" que não dizia o que fazia. Agora ficam do tamanho do conteúdo, com título,
  explicação e fechar por Esc, X ou clique no fundo.

## index.html

### 2026-10-13 · este commit · ícone do Desenhar e rótulo do menu
- **Local:** `<symbol id="i-draw">` e o botão `.tb-draw-caret`
- **Linha:** caneta sozinha → caneta **com o traço desenhado** (`M3 21.3c2.7-1.7…`);
  `aria-haspopup="menu"` + `aria-label` no caret
- **Porquê:** o ícone antigo (um triângulo de caneta) não dizia "desenhar"; o novo mostra a
  caneta e o traço, e o menu de tipo de desenho ganhou rótulo acessível.

## src/styles/topbar.css

### 2026-10-13 · este commit · botão Desenhar como ação principal
- **Local:** `.tb-split-draw`, `.tb-draw-main`, `.tb-draw-caret`
- **Linha:** `background: var(--accent-soft)` + borda fina → `background: var(--accent)` com
  divisor `color-mix(accent-fg 30%)`, sombra leve, hover/active e anel de foco
- **Porquê:** o botão parecia inacabado (fundo lavado, parecia desabilitado) e o divisor branco
  fixo do caret sumia no tema claro; agora é a ação principal da barra, com o divisor do tema.

## src/app/keys.ts

### 2026-10-13 · e392858 · Ctrl+F1 não abre mais a ajuda
- **Local:** `setupKeys` (atalho F1)
- **Linha:** `if (e.key === "F1")` → `if (e.key === "F1" && !e.ctrlKey && !e.metaKey)`
- **Porquê:** o `Ctrl+F1` passou a recolher/expandir a fita; sem a guarda, ele abria a tela de
  boas-vindas junto.

### 2026-10-13 · (este commit) · despacha pela tabela, não por if/else
- **Local:** `setupKeys` inteiro
- **Linha:** ~75 linhas de `if (k === "s") … else if (k === "t") …` → um ouvinte que consulta
  `atalhoDoEvento(this, e)` e executa a ação do atalho
- **Porquê:** era essa cadeia que prendia as teclas. As condições que existiam espalhadas viraram
  regras do `keymap.ts`: com modal aberto o atalho não dispara (só os marcados com `comModal`);
  `negrito`/`itálico` só valem fora do Word e da planilha; F2 só sem modal. O `Escape` do modo foco
  ficou aqui de propósito — é a tecla universal de "cancelar", não uma escolha do app.

## src/app/tabs.ts

### 2026-10-13 · c659efb · fechar o último documento volta ao Início
- **Local:** fluxo de fechar aba
- **Linha:** em vez de manter/abrir um "Sem título", volta para a tela de Início
- **Porquê:** fechar o último documento deixava um "Sem título" aberto em vez de voltar ao Início.

### 2026-10-13 · este commit · menu de Recentes redesenhado
- **Local:** `openRecentsMenu`
- **Linha:** linhas `dd-item two-line`/`dd-row` (nome + pasta, sem ícone) → linhas `rc-item` com o
  ícone do tipo (`fileIcon(kindOfPath)`), o nome com `fmtAgo` ao lado e a pasta (ou "Rascunho do
  app") embaixo; a lista virou um corpo rolável (`rc-body`) com as ações fixas num rodapé
  (`rc-foot`), e o × virou um botão `i-close` que ocupa o lugar do tempo no hover.
- **Porquê:** o menu estava bagunçado: sem ícone não dava para reconhecer o tipo do arquivo, todas
  as linhas eram só texto apertado, a lista inteira rolava e levava "Abrir arquivo…" para fora da
  vista, e não havia nenhuma noção de **quando** o arquivo foi usado por último. O × separado do
  texto evita o encavalamento da seta com o caminho.

## src/util.ts

### 2026-10-13 · este commit · `fmtAgo` para listas
- **Local:** ao lado de `fmtTime`
- **Linha:** `novo` — `fmtAgo(at)` devolve "agora", "há N min", "há N h", "ontem" ou "há N dias"
- **Porquê:** o menu de Recentes passou a mostrar há quanto tempo cada arquivo foi usado/guardado
  (`at` dos recentes e `modified_ms` dos rascunhos). O `ago` do `historyUi` é local e devolve
  "agora há pouco", longo demais para a linha do menu; a forma curta fica aqui, compartilhável.

## src/styles/tabs.css

### 2026-10-13 · este commit · estilos do menu de Recentes
- **Local:** bloco "menu de recentes"
- **Linha:** `.dd-row`, `.dd-item.two-line`, `.tl-name`, `.tl-dir`, `.dd-x` → `.dropdown.recents-menu`
  (coluna flex de 372px, `max-height: min(72vh, 620px)`, corpo rolável + rodapé fixo), `.rc-item`,
  `.rc-line`, `.rc-name`, `.rc-sub` (com `direction: rtl` para mostrar o **fim** do caminho),
  `.rc-time`, `.rc-x` e `.rc-empty`
- **Porquê:** acompanhar o novo desenho: só o corpo rola, o tempo alinha à direita na linha do nome
  e o × ganha um alvo de 24px que aparece no hover. As classes antigas saíram porque só este menu
  as usava (verificado por busca no repositório).

## src/settingsPage.ts

### 2026-10-13 · e392858 · atalho novo na lista
- **Local:** lista `SHORTCUTS`
- **Linha:** nova linha `["Ctrl+F1", "Recolher/expandir a faixa de opções"]`
- **Porquê:** documentar o atalho criado junto com o recolher da fita.

### 2026-10-13 · 8c0a7cf · escolha do ícone do app
- **Local:** `SettingsCtx` (tipo), grupo "Ícone do app" na seção Aparência e o handler de `input[name="appicon"]`
- **Linha:** novo par `appIcon`/`setAppIcon` no contexto; controle segmentado com os dois PNGs; handler que chama `ctx.setAppIcon(...)`
- **Porquê:** o app passou a ter dois ícones (claro/escuro) — a escolha precisava de um lugar, e Aparência já reúne tema e janela.

### 2026-10-13 · a799d63 · seção Armazenamento
- **Local:** `SettingsSection`/`NAV`, seção `data-sec="armazenamento"` e o bloco `paintArmazenamento` + handlers `arm-*`
- **Linha:** nova seção entre Histórico e Aparência: barra proporcional, cartões (versões, log, backup, rascunhos, outros), bloco "Da versão anterior" (aparece só quando a pasta antiga existe) e ações com confirmação (`ask`)
- **Porquê:** não dava para ver onde o espaço estava indo (IndexedDB, backup, rascunhos e a pasta legada da renomeação); o painel mostra o tamanho de cada parte e deixa limpar com um clique.

### 2026-10-13 · (este commit) · configurações em abas
- **Local:** `renderSettingsPage`, o bloco da navegação lateral (antes "navegação lateral: rola até
  a seção e marca a que está à vista")
- **Linha:** o ouvinte de `scroll` do `.st-scroll` (que marcava a seção à vista) e o
  `scrollIntoView` do clique → um `abrir(id)` que liga/desliga `sec.hidden` conforme
  `sec.dataset.sec !== id`, zera a rolagem e chama `mark(id)`
- **Linha:** o `mark(id)` deixou de escrever em `[data-st-title]`/`[data-st-icon]`; o `.st-headbar`
  saiu do HTML e o `.st-saved` foi para fora dele, no fim do template
- **Porquê:** as cinco seções ficavam empilhadas na mesma página e a trilha lateral só rolava até
  elas — para mudar um ajuste em "Aparência" era preciso atravessar as cinco. Com uma seção por
  vez, o nome fixo no topo passou a repetir o cabeçalho da própria aba, logo abaixo dele, então
  saiu; e a confirmação "Salvo" precisava estar à vista de quem acabou de clicar no interruptor.

## src/styles/settings.css

### 2026-10-13 · este commit · interruptor com folga inteira (bolinha centrada)
- **Local:** `.st-switch` (altura), `.st-switch::after` (folga da bolinha) e `.st-switch:checked::after` (deslocamento)
- **Linha:** altura `23px` → `24px`; `top`/`left` `2,5px` → `3px`; `translateX(17px)` → `translateX(16px)`
- **Porquê:** com medidas fracionárias o navegador arredondava a bolinha para um lado em cada
  estado — medido em 100%: folgas 3/19 desligado e 20/2 ligado, em vez de 3/3, e 4/3 na vertical —
  e o desalinhamento reaparecia em 125% e 150% (as escalas mais comuns do Windows). Com medidas
  inteiras (40 = 3 + 16 + 18 + 3; 24 = 3 + 18 + 3) as folgas ficam iguais nos quatro lados e
  iguais entre ligado e desligado, em qualquer escala.

### 2026-10-13 · este commit · ícones menores na trilha das Configurações
- **Local:** `.st-brand-ic` (marca) e `.st-nav-ic` (itens Escrita → Atalhos)
- **Linha:** marca `40px · raio 12 · glifo 19px` → `34px · raio 11 · glifo 16px`; itens
  `32px · raio 10 · glifo 16px` → `26px · raio 8 · glifo 14px`
- **Porquê:** depois do redesign da tela, os chips de ícone da lateral ficaram grandes demais e
  pesavam mais que o texto; menores, a hierarquia volta ao nome/descrição sem perder o destaque
  do item ativo (chip sólido no acento).

### 2026-10-13 · 8c0a7cf · miniatura no controle segmentado
- **Local:** depois de `.st-seg-item:has(input:checked)`
- **Linha:** nova regra `.st-seg-icone` (18px, cantos 4px, margem à direita)
- **Porquê:** o seletor de ícone mostra os próprios PNGs; sem a regra a imagem entra no tamanho
  natural e desalinha o controle.

### 2026-10-13 · a799d63 · barra do Armazenamento
- **Local:** antes de `/* ---------- telas estreitas ---------- */`
- **Linha:** novas regras `.st-arm-barra` (segmentos com largura proporcional) e `.st-arm-legenda` (cores + valores)
- **Porquê:** o painel de Armazenamento precisava mostrar a proporção de cada parte num relance; as classes existentes de lista não cobrem uma barra empilhada.

### 2026-10-13 · (este commit) · o css das abas
- **Local:** `#settings-page`
- **Linha:** `display: none` → `position: relative; display: none`
- **Porquê:** a confirmação "Salvo" passou a ser uma pílula ancorada no pé da página; sem
  `position: relative` no contêiner ela se posicionaria em relação à janela.
- **Local:** `.st-scroll`
- **Linha:** `scroll-behavior: smooth` e `scroll-padding-top: 64px` removidos
- **Porquê:** os dois existiam para a rolagem por âncora até a seção (`scrollIntoView`), que não
  existe mais. O `smooth` ainda faria a troca de aba animar a rolagem até o topo em vez de pular.
- **Local:** `.st-col`
- **Linha:** `padding: 0 36px 160px` → `padding: 0 36px 64px`
- **Porquê:** os 160px eram o respiro do fim da página longa; com uma aba por vez o conteúdo termina
  logo e o valor virava um vazio grande embaixo do último cartão.
- **Local:** `.st-headbar`, `.st-headbar::after`, `.st-heading`, `.st-heading .ic`
- **Linha:** removidos
- **Porquê:** a barra fixa dizia em que seção a rolagem estava — e repetia o nome que o cabeçalho da
  própria seção já mostra logo abaixo. Sem rolagem entre seções, ela só ocupava ~44px no topo de
  toda aba.
- **Local:** `.st-saved`
- **Linha:** `margin-left: auto; color; font-size; font-weight; min-height: 16px` → `position:
  absolute; left: 50%; bottom: 18px; transform: translateX(-50%); padding: 7px 13px; border;
  border-radius: 999px; background; box-shadow; color; font-size; font-weight; white-space;
  pointer-events: none`, mais `.st-saved:empty { display: none }`
- **Porquê:** agora é uma pílula solta no pé da página, à vista de quem acabou de mexer num ajuste
  (a barra ficava lá em cima). No centro, e não no canto de baixo-direita, porque esse canto é dos
  avisos do app (`#toasts`, `z-index: 100`) — ali ela sumiria atrás deles. O `:empty` evita uma
  pílula vazia parada na tela, e `pointer-events: none` garante que ela nunca intercepte um clique.
- **Local:** `.st-sec` e `.st-sec:last-child`
- **Linha:** `.st-sec` perdeu o `border-bottom: 1px solid var(--border)`; a regra `.st-sec:last-child`
  foi removida
- **Porquê:** a linha separava uma seção da seguinte. Com uma seção por vez, a visível é sempre a
  última da coluna, e a linha virava um risco solto no fim do conteúdo.

## src/fileIcons.ts

### 2026-10-13 · este commit · ícones de tipo viram folha de documento
- **Local:** `FOLHA` (novo) e `GLYPH`, usados por `fileIcon()`
- **Linha:** `<rect class="fi-tile" x="2" y="2" width="20" height="20" rx="5">` com as marcas
  ocupando a caixa toda → `FOLHA` (path da folha com o canto dobrado + `fi-fold`) e marcas
  redesenhadas menores, abaixo da dobra (M↓, W, a planilha e a pizza)
- **Porquê:** o quadradinho colorido lia como "etiqueta de app" e a marca solta (principalmente o
  M↓) parecia um botão de baixar, não um documento. A folha na cor do formato com a marca dentro é
  a metáfora que todo mundo já conhece de arquivo (Windows/Office) e continua diferenciando os
  quatro tipos pela forma. As proporções foram ajustadas em prévia (16 a 48 px) para a folha
  preencher a caixa como o quadradinho antigo e a marca continuar legível a 16 px.

## src/styles/fileicons.css

### 2026-10-13 · este commit · a dobra da folha
- **Local:** `.fi-fold` (novo) e o comentário do `.fi-line`
- **Linha:** `novo` — `.fi-fold { fill: #fff; opacity: 0.38 }`
- **Porquê:** o `fi-tile` deixou de ser o quadradinho e virou a folha; a dobra é um triângulo branco
  translúcido por cima da cor do tipo — funciona nas quatro cores e nos dois temas sem pedir uma
  variável de cor nova. O desenho branco continua no `.fi-line`, agora dentro da folha.

## src/powerpoint/edicao/grafico.ts

### 2026-10-13 · 8fe85d0 · gráficos (novo arquivo)
- **Local:** modelo + desenho em SVG do gráfico
- **Linha:** novo arquivo
- **Porquê:** dar suporte a gráficos na apresentação (inserir, editar dados no painel, desenhar
  em SVG e exportar como imagem).

## src/powerpoint/edicao/midia.ts

### 2026-10-13 · 0015031 · áudio e vídeo (novo arquivo)
- **Local:** modelo e reprodução da mídia
- **Linha:** novo arquivo
- **Porquê:** inserir áudio/vídeo, tocar no F5 (corte, volume, repetição) e manter a ida e volta
  no `.pptx`.

## src/powerpoint/edicao/transicao.ts

### 2026-10-13 · d778d51 · transições de lâmina (novo arquivo)
- **Local:** catálogo e aplicação da transição
- **Linha:** novo arquivo
- **Porquê:** galeria de transições com direção e duração, funcionando no F5 e no arquivo.

## src/powerpoint/edicao/modelos.ts

### 2026-10-13 · c08fdad · modelos do usuário (novo arquivo)
- **Local:** cartões de modelo (salvar/aplicar/remover o visual do deck)
- **Linha:** novo arquivo
- **Porquê:** guardar o visual de um deck (tema, cores, fonte) como cartão e reaplicar depois.

## src/broker/aprendizado.ts

### 2026-10-13 · ca2d3b4 · o corretor aprende com o uso (novo arquivo)
- **Local:** registro de aceites/recusas das sugestões
- **Linha:** novo arquivo
- **Porquê:** ajustar a confiança das sugestões conforme o que o usuário aceita ou recusa.

## src/broker/concordancia.ts

### 2026-10-13 · 83bd96f · concordância e abreviações (novo arquivo)
- **Local:** regras de concordância
- **Linha:** novo arquivo
- **Porquê:** ampliar o corretor com pontuação, concordância e abreviações.

## index.html

### 2026-10-13 · 6bee7a2 · tela de carregamento e tema antes da pintura
- **Local:** `<head>` (script inline + `<style>` do `#boot`) e início do `<body>` (marca do `#boot`)
- **Linha:** `novo` — o `<head>` só tinha `charset`, `viewport` e `title`
- **Porquê:** o CSS do app chega junto com o pacote JS. Entre a primeira pintura e a chegada do
  pacote, o WebView mostrava o **HTML cru**: os ícones do sprite em tamanho natural, texto solto e
  caixas empilhadas. A tela de carregamento precisa estar no próprio HTML (estilo embutido e marca
  em SVG inline) para existir antes de qualquer requisição.
- **Local:** `<script>` inline do `<head>`
- **Linha:** `novo`
- **Porquê:** o `<html>` nascia com `data-theme="light"` fixo e o tema guardado só era aplicado
  quando o JS do app rodava — quem usa o escuro via um clarão branco. Ler o `mdc.theme` do
  `localStorage` antes da primeira pintura resolve, e a própria tela de carregamento já nasce no
  tema certo.

## src/main.ts

### 2026-10-13 · 6bee7a2 · tirar a tela de carregamento em qualquer desfecho
- **Local:** fim do arquivo, `tirarTelaDeCarregamento()` e o `app.start()`
- **Linha:** `void app.start().catch(...)` → `void app.start().catch(...).finally(tirarTelaDeCarregamento)`
- **Porquê:** a tela precisa sair **mesmo quando o app falha**. Se ficasse só no caminho de sucesso,
  uma falha no `start()` deixaria a tela na frente do aviso de erro — e o aviso é justamente o que
  a pessoa precisa ler. O `finally` cobre os dois casos; a saída é suave (180 ms) para não piscar.

## src/app/appIcon.ts

### 2026-10-13 · 8c0a7cf · ícone do app (novo arquivo)
- **Local:** módulo inteiro (`appIconAtual`, `aplicarIconeApp`, `definirIconeApp`)
- **Linha:** novo arquivo
- **Porquê:** ler/guardar a escolha do ícone (`mdc.appicon`) e aplicá-la na janela pela API do
  Tauri (`setIcon` + `Image.fromBytes`), sem quebrar no navegador (tudo em try/catch; sem
  escolha ainda, segue o tema: claro no claro, escuro no escuro).

## src/app/app.ts

### 2026-10-13 · este commit · liga a lixeira
- **Local:** hooks da lateral, `start()` e o `Object.assign(App.prototype, …)`
- **Linha:** `fileMenuAt: (x, y, path) => this.openFileMenuAt(x, y, path)` nos hooks;
  `void this.purgeTrash();` logo depois do `void this.setupBackup();`; `trashMethods` no mixin e
  `TrashMethodsType` no `interface App`
- **Porquê:** a ação "Mover para a lixeira" pendura no App como o resto (métodos em
  `src/app/trash.ts`); a limpeza dos 30 dias roda na abertura, junto do setup do backup.

### 2026-10-13 · 8c0a7cf · ícone aplicado na abertura
- **Local:** `start()`, logo depois de `applyTheme`
- **Linha:** `void aplicarIconeApp();` (novo)
- **Porquê:** o ícone escolhido precisa valer já na abertura — antes disso a janela usa o ícone
  fixo do build.

### 2026-10-13 · este commit · revelação do arquivo ao clicar no caminho salvo do topo
- **Local:** `start()` (event listeners)
- **Linha:** `document.querySelector("#tb-saved-path")?.addEventListener("click", ...)`
- **Porquê:** permitir revelar o arquivo salvo no explorador de arquivos (via `revealItemInDir`), espelhando a funcionalidade do rodapé.

## src/app/pages.ts

### 2026-10-13 · 8c0a7cf · contexto das Configurações
- **Local:** objeto devolvido pelo contexto da tela (junto de `openHistory`/`repairAlignments`)
- **Linha:** `appIcon: () => appIconAtual()` e `setAppIcon: (v) => definirIconeApp(v)` (novos)
- **Porquê:** a tela de Configurações não conhece o app; ela fala por este contexto.

## src-tauri/Cargo.toml

### 2026-10-13 · 8c0a7cf · decodificação de PNG
- **Local:** dependência `tauri`
- **Linha:** `features = []` → `features = ["image-png"]`
- **Porquê:** `Image.fromBytes`/`setIcon` só decodificam PNG com esse recurso ligado; sem ele a
  troca de ícone falha em silêncio.

## src-tauri/capabilities/default.json

### 2026-10-13 · 8c0a7cf · permissão do setIcon
- **Local:** lista `permissions`
- **Linha:** nova linha `"core:window:allow-set-icon"`
- **Porquê:** a API `setIcon` não vem no `core:window:default`; sem a permissão o Tauri recusa a
  chamada.

## package.json

### 2026-10-14 · 4cfd23f · script do teste do diff
- **Local:** scripts
- **Linha:** nova linha `"test:diff": "node scripts/testar-diff-troca.mjs"`
- **Porquê:** o diff da troca (o que colore o popup) é lógica pura e ganhou teste próprio na suíte.

### 2026-10-13 · este commit · script do teste da lixeira
- **Local:** scripts
- **Linha:** nova linha `"test:lixeira": "node scripts/testar-lixeira.mts"`
- **Porquê:** o contrato da lixeira (comandos, registro, menu, prazo) entra na suíte como os
  outros testes do projeto.

### 2026-10-13 · 8c0a7cf · script de ícones sem o gerador antigo
- **Local:** scripts
- **Linha:** `"icon": "node scripts/gen-icon.mjs && tauri icon app-icon.png"` → `"icon": "tauri icon app-icon.png"`
- **Porquê:** o `app-icon.png` agora vem dos pacotes novos (claro/escuro); o gerador antigo
  desenhava o ícone anterior e sobrescreveria a fonte.

## scripts/gen-icon.mjs

### 2026-10-13 · 8c0a7cf · removido
- **Local:** arquivo inteiro
- **Linha:** arquivo removido
- **Porquê:** desenhava o ícone antigo (indigo/violeta). Com os pacotes novos como fonte, mantê-lo
  era uma armadilha: rodar `npm run icon` recriaria o ícone velho.

## app-icon.png · src-tauri/icons/ · public/icones/

### 2026-10-13 · 8c0a7cf · ícones novos
- **Local:** fonte do build (`app-icon.png`), pacote gerado (`src-tauri/icons/*`) e PNGs do tempo
  de execução (`public/icones/mdoffice-claro.png` e `mdoffice-escuro.png`)
- **Linha:** arquivos substituídos/novos (pacote gerado com `tauri icon app-icon.png`)
- **Porquê:** o app passa a usar o ícone novo (documento "M↓" com painéis azul/laranja): o claro
  é o fixo do `.exe`/instalador; os dois ficam disponíveis para a escolha em Configurações.
## src/sidebar.ts

### 2026-10-13 · este commit · clique direito abre o menu do arquivo
- **Local:** `contextmenu` das linhas de documento e o `SidebarHooks`
- **Linha:** lista própria `[Abrir, Mostrar na pasta]` → `this.hooks.fileMenuAt(e.clientX, e.clientY, node.path)`
- **Porquê:** o ⋯ e o clique direito devem abrir o MESMO menu (o comentário do `menus.ts` já dizia
  isso); agora o clique direito também tem ícones, Copiar caminho, Renomear e a lixeira.

### 2026-10-13 · movimento da barra lateral · pílula do seletor e árvore crescendo
- **Local:** `posicionarPilula()`, `expandir()` e as chamadas em `show()`, `setHomeActive()`,
  `renderProjects()` e `renderNodes()`
- **Linha:** `novo` (os dois métodos); `this.posicionarPilula();` no fim de `show()`;
  `if (box && alvo === root) this.expandir(box);` depois de `host.append(box)`
- **Porquê:** o fundo do painel ativo pulava de botão em botão e a pasta aberta aparecia já no
  tamanho final (só o fechar animava). A pílula usa `offsetLeft/offsetTop` do botão ativo — o
  seletor virou `position: relative` para ser o `offsetParent` — e desliza pelo CSS; o `expandir`
  é o inverso do `recolher` (`max-height` 0 → `scrollHeight`, soltando a altura no fim para o
  conteúdo poder crescer depois).
- **Local:** `init()`
- **Linha:** `document.getElementById("sidebar")?.toggleAttribute("inert", …)` (novo)
- **Porquê:** a barra não sai mais do DOM ao ser recolhida, então os botões continuariam na ordem
  do Tab e nos leitores de tela; `inert` resolve sem mexer na animação.

## src/app/commands.ts

### 2026-10-13 · movimento da barra lateral · inert e nova medida do editor
- **Local:** `toggle()`
- **Linha:** `document.getElementById("sidebar")?.toggleAttribute("inert", on);` e
  `window.setTimeout(() => this.editor?.view?.requestMeasure(), 320);` (novos)
- **Porquê:** com a barra recolhendo em 280 ms, a medida do CodeMirror feita no clique fica com a
  largura antiga; a segunda medida, depois da transição, evita o texto "pulando" de linha.

### 2026-10-13 · (este commit) · o atalho mostrado é o que está valendo
- **Local:** as 15 chamadas de `add(…)` que passavam a tecla como texto
- **Linha:** `"Ctrl+S"` → `teclaVisivel("salvar")` (e assim por diante)
- **Porquê:** a busca de comandos mostra o atalho ao lado de cada item; escrito à mão, ele ficaria
  desatualizado assim que a pessoa trocasse a tecla.

## src/styles/sidebar.css

### 2026-10-13 · movimento da barra lateral · recolher pela largura
- **Local:** `#sidebar` e `body.no-sidebar #sidebar`
- **Linha:** `body.no-sidebar #sidebar { display: none }` → `{ width: 0; opacity: 0;
  transform: translateX(-12px); border-right-color: transparent; pointer-events: none }`
  (e `overflow: hidden` na regra base)
- **Porquê:** `display: none` não anima: a barra aparecia/sumia de um quadro para o outro e o
  editor dava um salto. Recolher a largura deixa o corpo acompanhar o movimento; o
  `overflow: hidden` recorta o conteúdo enquanto ela fecha.

## src/styles/movimento.css

### 2026-10-13 · movimento da barra lateral · passo curto e pílula
- **Local:** `@keyframes mdc-painel`, a regra de `.sb-panel:not([hidden])` e as transições de
  `#sidebar` e `.sb-pill`
- **Linha:** `.sb-panel… { animation: mdc-surgir … }` → `animation: mdc-painel …` (opacidade +
  `translateY(-6px)`, sem escala); `#sidebar { animation: mdc-surgir … }` → `transition:
  width/opacity/transform/border-color`; `.sb-pill { transition: transform … }` (novo)
- **Porquê:** o `mdc-surgir` (14 px + `scale(0.98)`) foi feito para caixas que nascem no meio da
  tela; numa lista alta que só troca de conteúdo o zoom chama mais atenção do que o próprio
  painel. A barra deixou de ter animação de entrada (agora é transição de estado) e a pílula
  ganhou o deslize.

### 2026-10-13 · este commit · despedida lateral da pré-visualização
- **Local:** bloco novo logo depois de `#preview-bar:not([hidden])`
- **Linha:** novo `@keyframes mdc-sumi-lado` + `body.preview-saindo #preview-wrap,
  body.preview-saindo #splitter { animation: mdc-sumi-lado …; pointer-events: none; }`
- **Porquê:** o fechamento pelo arrasto é um gesto contínuo; sem a saída o painel sumia de um
  quadro para o outro. O `pointer-events: none` impede pegar o divisor no meio da animação.

## src/styles/workspace.css

### 2026-10-13 · movimento da barra lateral · pílula do seletor de painéis
- **Local:** `.sb-tabs`, `.sb-tab`, `.sb-tab.active` e `.sb-pill` (novo)
- **Linha:** `.sb-tabs { position: relative }` e `.sb-tab { position: relative; z-index: 1 }`
  (novos); `.sb-tab.active { background: var(--sb-active) }` → `background: transparent`;
  `.sb-pill` (novo bloco)
- **Porquê:** o destaque do painel ativo era o fundo do próprio botão — trocar de painel
  "piscava" de um botão para o outro. A pílula é um elemento só (posicionado pelo `sidebar.ts`),
  então o fundo **anda** entre os botões; os botões ficam por cima dela (`z-index`) e o `.active`
  só cuida da cor do ícone.

## src/styles/home.css

### 2026-10-13 · movimento da barra lateral · Início sem fundo próprio
- **Local:** regra `.sb-tab[data-side="home"].active, body.home-open …`
- **Linha:** removido `background: var(--accent-soft) !important;` (fica só
  `color: var(--accent) !important`)
- **Porquê:** com a pílula deslizando, o fundo do botão de Início brigava com ela (dois "ativos"
  com cores diferentes). O Início continua se distinguindo pela cor do ícone.

## index.html

### 2026-10-13 · movimento da barra lateral · pílula no HTML
- **Local:** dentro de `.sb-tabs`
- **Linha:** `<span class="sb-pill" aria-hidden="true"></span>` (novo, primeiro filho)
- **Porquê:** a pílula precisa existir antes do primeiro desenho para poder deslizar;
  `aria-hidden` porque é só o fundo do botão ativo (o estado está no `aria-selected` de cada aba).

## scripts/testar-layout.mts

### 2026-10-13 · movimento da barra lateral · regressões cobertas
- **Local:** bloco "barra lateral: movimento"
- **Linha:** 8 verificações novas
- **Porquê:** são regras que quebram fácil sem ninguém notar (o `display: none` voltar, a pílula
  perder a âncora, o `.active` voltar a pintar o fundo). O teste é estático e roda em
  `npm run test:layout`.

## index.html

### 2026-10-13 · este commit · atalho de pasta e caminho salvo no topbar
- **Local:** `.tb-autosave-wrap` (logo após o `#tb-autosave-badge`)
- **Linha:** inclusão do `<button class="tb-saved-path" id="tb-saved-path">`
- **Porquê:** fornecer ao usuário feedback visual rápido de onde o arquivo foi salvo (ou rascunho criado) e permitir abrir diretamente no explorador ao clicar.

## src/app/layout.ts

### 2026-10-13 · este commit · exibição dinâmica de status "Salvando…" e caminho salvo
- **Local:** `updateAutosaveUI()` e `refreshPath()`
- **Linha:** `this.saving || this.dirty` refletido imediatamente no texto e ícone de nuvem; atualização de `#tb-saved-path` ao terminar de salvar
- **Porquê:** ao editar o documento, o badge indica "Salvando…" com o ícone correspondente; quando as alterações são gravadas, o badge volta para "Salvo" e exibe o caminho do arquivo à direita do badge.

### 2026-10-13 · este commit · arrastar além do limite fecha a pré-visualização
- **Local:** `setupSplitter` — checagem no `pointermove` e novo `fecharPreview`
- **Linha:** novo `FECHAR_APOS = 40`; antes do `applyRatio`:
  `if ((ratio - bounds.maxRatio) * bounds.free > FECHAR_APOS) { fecharPreview(...); return; }`;
  `fecharPreview` solta o ponteiro, guarda `mdc.split` e adiciona `preview-saindo`
- **Porquê:** o arrasto travava no mínimo da prévia e não havia gesto para fechar. Passar 40 px
  do limite (encostar no mínimo segue sendo só redimensionar) fecha a prévia com saída suave,
  fallback por tempo e fechamento idempotente. A classe `preview-saindo` vai no
  **`document.body`**, como os demais flags do layout — a primeira versão a pôs no `#body` e a
  animação não rodava (o painel só sumia pelo timeout, sem deslizar).

## src/styles/topbar.css

### 2026-10-13 · este commit · estilização do botão de caminho salvo
- **Local:** regras para `.tb-saved-path`, `.tb-saved-path-ic` e `.tb-saved-path-text`
- **Linha:** novas regras CSS com divisor sutil à esquerda, limite de largura com ellipsis e responsividade
- **Porquê:** integrar visualmente o caminho salvo ao grupo do salvamento automático de forma elegante e discreta.

## src-tauri/Cargo.lock

### 2026-10-13 · 0f81e98 · crates do image-png
- **Local:** entradas `image`, `png 0.18`, `byteorder-lite`, `moxcms`
- **Linha:** novas entradas (resolução do Cargo; 36 linhas)
- **Porquê:** a feature `image-png` do Tauri puxa o crate `image`; sem essas entradas no lock um
  build com `--locked` falha. Validado com `cargo check --locked` (2m33s).

## src-tauri/tauri.conf.json

### 2026-10-13 · este commit · identificador com.mdoffice.desktop
- **Local:** `identifier`
- **Linha:** `com.mdcreator.desktop` → `com.mdoffice.desktop`
- **Porquê:** o identificador é o nome técnico do app (pasta de dados, WebView, instalador);
  deixá-lo com o nome antigo mantinha o "mdCreator" vivo por baixo do produto.

## src-tauri/src/lib.rs

### 2026-10-13 · este commit · registro dos comandos da lixeira
- **Local:** `generate_handler!`
- **Linha:** `commands::trash::trash_move,` e `commands::trash::trash_purge,` (novas linhas, logo
  depois de `commands::search::search_markdown,`)
- **Porquê:** sem registro o frontend não alcança o comando — a ponte `files.ts` existiria à toa.

### 2026-10-13 · este commit · migração da pasta de dados (novo código)
- **Local:** `migrar_pasta_de_dados()` e `copiar_pasta_de_dados()`
- **Linha:** novo código (cópia recursiva de `%LOCALAPPDATA%\com.mdcreator.desktop` para
  `com.mdoffice.desktop`, pulando caches do WebView)
- **Porquê:** trocar o identificador muda a pasta de dados; sem a cópia, rascunhos, backups e
  preferências ficariam para trás. É a única referência de propósito ao nome antigo no código.

## src-tauri/src/main.rs

### 2026-10-13 · este commit · migra antes de abrir a janela
- **Local:** `main()`
- **Linha:** novo `mdoffice_lib::migrar_pasta_de_dados();` antes de `run()`
- **Porquê:** o Tauri cria as janelas (e a pasta nova, pelo WebView) **antes** do `setup`; a
  cópia só funciona rodando aqui, antes de tudo.

## src-tauri/Cargo.toml · package.json

### 2026-10-13 · este commit · nomes técnicos
- **Local:** `[package] name` / `[lib] name` / `"name"`
- **Linha:** `mdcreator`/`mdcreator_lib` → `mdoffice`/`mdoffice_lib`; `"mdcreator"` → `"mdoffice"`
- **Porquê:** o binário de dev e o pacote passam a se chamar mdoffice (o watchdog que encerra o
  processo foi atualizado junto).

## src/main.ts

### 2026-10-13 · este commit · gancho de depuração
- **Local:** `window.__mdcreator`
- **Linha:** `__mdcreator` → `__mdoffice` (e `__mdcreatorTextBoard` → `__mdofficeTextBoard`)
- **Porquê:** o nome do gancho acompanha o produto.

### 2026-10-13 · (este commit) · liga o aviso de vida da página
- **Local:** logo depois de `new App()` e `ligarMovimentoDeSaida()`
- **Linha:** `ligarBatimento();` (novo)
- **Porquê:** é o primeiro ponto de código do app, antes de qualquer carregamento pesado — o aviso
  já vale enquanto dicionário e modelo ainda estão subindo. Sem efeito fora do desenvolvimento.

## README.md · docs/ (vários)

### 2026-10-13 · este commit · nome do app na documentação
- **Local:** README, paridade, mapas de UI e textos do app
- **Linha:** "mdCreator" → "mdOffice" (348 trocas em 38 arquivos)
- **Porquê:** o produto se chama mdOffice; a história do README mantém de propósito o nome
  antigo **mdEditor** (a origem), que é outra palavra.

## vite.config.ts

### 2026-10-13 · (este commit) · sem recarga no meio do uso
- **Local:** `defineConfig`, logo depois de `plugins`
- **Linha:** `novo` — `cacheDir: ".vite"` e `optimizeDeps.include: ["typo-js", "@huggingface/transformers"]`
- **Porquê (o `include`):** o scanner de dependências do Vite não entra em arquivo de worker, então
  `typo-js` (corretor ortográfico) e `@huggingface/transformers` (IA local e tradução offline) só
  entravam no grafo quando o worker subia. Nesse instante o Vite re-otimizava as dependências e
  mandava os clientes recarregarem com o app já aberto — e a recarga refaz o boot inteiro
  (dicionário, modelo, sessão), o que trava o app. Medido: no servidor de dev a recarga caía ~23 s
  depois de abrir a página; com o `include`, nenhuma (e o `typo-js` passou a ser servido do cache,
  `/.vite/deps/typo-js.js`).
- **Porquê (o `cacheDir`):** o padrão é `node_modules/.vite` e o `node_modules` das worktrees é um
  *junction* para o da cópia principal, então todos os servidores de dev dividem o mesmo cache. O
  hash que valida esse cache inclui `root: config.root` (está em `getConfigHash`, no próprio Vite),
  e a raiz de uma worktree é diferente da raiz da cópia principal: cada alternância entre pastas
  invalidava o cache inteiro e disparava re-otimização + recarga. Em `.vite/`, cada pasta tem o seu.
  O Vite já ignora o `cacheDir` no observador de arquivos (`escapePath(cacheDir) + "/**"`), então
  não foi preciso somar nada em `server.watch.ignored`.

### 2026-10-13 · (este commit) · o canal "estou vivo"
- **Local:** `batimentoPlugin()`, no `plugins` do `defineConfig`
- **Linha:** `novo` — middleware em `/__vivo`: `POST` marca o horário (a página avisando que está
  viva) e `GET /__vivo/estado` devolve `{ vistoEm, idade }` para o watchdog
- **Porquê:** quando o conteúdo da janela trava, o processo do app continua de pé e a janela
  continua respondendo — de fora não há como perguntar "você responde?". Com a página avisando, o
  silêncio vira sintoma. Mora no servidor de dev de propósito: é ferramenta de desenvolvimento,
  não existe na versão final e não exige nada do lado Rust.

## .gitignore

### 2026-10-13 · (este commit) · o cache do Vite saiu do node_modules
- **Local:** depois de `public/ort/`
- **Linha:** nova linha `.vite/`
- **Porquê:** o cache do otimizador passou a morar em `.vite/`, na raiz do projeto (ver
  vite.config.ts), para não ser compartilhado entre a cópia principal e as worktrees.

## src/settingsPage.ts

### 2026-10-13 · tema em cartões · dois cartões no lugar do interruptor
- **Local:** seção Aparência, lista "Tema e janela"; e o bloco de ligações "aparência"
- **Linha:** `${toggle("dark", …)}` → `<div class="st-temas" role="radiogroup">…</div>` (dois
  `<label class="st-tema">` com rádio `name="tema"`, prévia e nome); `sw("dark").addEventListener(…)`
  → `host.querySelectorAll('input[name="tema"]').forEach(…)` chamando `ctx.setDark(r.value === "escuro")`
- **Porquê:** o tema era um interruptor liga/desliga ("Tema escuro" aceso = escuro), que não mostra
  o que cada opção faz e esconde a alternativa. Os dois cartões ficam **lado a lado**, clicáveis,
  com uma prévia de cada tema — a escolha vira explícita (Claro × Escuro) e o estado marcado usa o
  mesmo padrão do seletor de ícone do app.

### 2026-10-13 · (este commit) · a aba Atalhos vira editor de atalhos
- **Local:** a seção `data-sec="atalhos"` (antes alimentada por `SHORTCUT_GROUPS`) e um bloco novo
  no fim de `renderSettingsPage`
- **Linha:** `SHORTCUT_GROUPS` foi removida; cada linha agora é
  `<button data-tecla="id"><kbd>…</kbd></button>` mais um `[data-voltar]`; o bloco novo cuida da
  escuta (`aoTeclar`), do aviso e do restaurar
- **Porquê:** a lista virou o lugar onde se escolhe a tecla. A escuta é feita em **captura** no
  `document` e chama `emCaptura(true)`, senão a própria tecla que a pessoa aperta para escolher
  dispararia a ação (trocar "Nova aba" para Ctrl+T abriria uma aba no meio da troca). A recusa por
  conflito mantém a escuta ligada, para a pessoa tentar outra tecla na hora.
- **Local:** começo de `renderSettingsPage` e a guarda no começo de `aoTeclar`
- **Linha:** `emCaptura(false)` na entrada; e, no `aoTeclar`, sair antes do `preventDefault` quando
  `host.offsetParent === null` ou o botão já não está conectado
- **Porquê:** sair da página no meio de uma troca deixaria a escuta ligada e o app inteiro sem
  atalhos. A guarda desarma e deixa a tecla seguir o caminho normal — sem engolir a primeira tecla
  depois da saída.

## src/styles/settings.css

### 2026-10-13 · tema em cartões · cartões com prévia do tema
- **Local:** bloco novo "escolha do tema em dois cartões", depois de `.st-seg-desc`
- **Linha:** `novo` (`.st-temas`, `.st-tema`, `.st-tema-previa[data-tema]`, `.st-tema-linha`,
  `.st-tema-ponto`, `.st-tema-nome`)
- **Porquê:** `.st-temas` é um grid de **duas colunas iguais** (lado a lado em qualquer largura);
  cada cartão é um `<label>` com o rádio escondido, e o estado escolhido aparece com borda/realce
  do acento (`:has(input:checked)`). As prévias usam **cores fixas** (#ffffff/#1c212b no claro,
  #0e1014/#f4f5f8 no escuro) de propósito: os dois cartões aparecem ao mesmo tempo, então não
  podem herdar as variáveis do tema atual. As transições usam os tokens do `movimento.css`.

### 2026-10-13 · (este commit) · as teclas clicáveis
- **Local:** bloco novo, antes de "telas estreitas"
- **Linha:** `novo` (`.st-key-teclas`, `.st-key-btn`, `.st-key-btn:hover kbd`,
  `.st-key-btn.escutando kbd` + `@keyframes st-escutando`, `.st-key-voltar`, `.st-list-note.ruim`)
- **Porquê:** o `kbd` era só um rótulo; agora é um botão que parece o mesmo `kbd` (sem borda nem
  fundo próprios), e a linha em escuta pisca em acento para deixar claro que a vez é de quem digita.
  O botão de voltar só aparece nas linhas que foram trocadas. A animação não precisa de guarda de
  `prefers-reduced-motion`: o `movimento.css` já zera animações nesse caso, para todo o app.

## scripts/testar-layout.mts

### 2026-10-13 · tema em cartões · regressões cobertas
- **Local:** bloco "configurações: tema em dois cartões"
- **Linha:** 5 verificações novas
- **Porquê:** garante que os cartões continuem lado a lado (grid de duas colunas), com o estado
  marcado, as prévias fixas dos dois temas, o interruptor antigo fora da página e a ligação que
  grava o tema (`ctx.setDark`).

## src/settingsPage.ts

### 2026-10-13 · este commit · dropdowns do app no lugar dos `<select>`
- **Local:** novos `dd()` (markup) e `ligarDd()` (ligação), e os seis campos que eram `<select>`
  (intensidade das sugestões, versões, política de backup, cópias, prazo e estilo do desenho)
- **Linha:** `<select class="st-select">` → `<button class="st-select st-dd" data-dd data-valor>`;
  handlers `change` → `ligarDd(chave, opcoes, aoEscolher)`
- **Porquê:** a lista aberta do `<select>` é desenhada pelo sistema (cinza claro) e não segue o
  tema; o menu do app (mesmo do ⋯) fica igual nos temas claro e escuro e marca a opção atual.

## src/app/pages.ts

### 2026-10-13 · este commit · `menu` no contexto das Configurações
- **Local:** `settingsContext()`
- **Linha:** novo `menu: (ancora, opcoes) => this.openMenu(...)` com `ddItem`
- **Porquê:** a página de Configurações é um módulo à parte; passando o menu pelo contexto, ela
  reusa o componente do app em vez de reimplementar um dropdown.

## src/styles/settings.css

### 2026-10-13 · este commit · botão do dropdown
- **Local:** `button.st-dd` e `button.st-dd [data-dd-txt]`
- **Linha:** novas regras (cursor, largura máxima e reticências no rótulo); o visual vem do
  `.st-select`
- **Porquê:** o botão precisa se comportar como botão (clique, foco, truncar rótulo longo) sem
  perder o desenho do seletor do app.

## src-tauri/src/commands/trash.rs

### 2026-10-13 · este commit · lixeira de documentos (novo arquivo)
- **Local:** arquivo inteiro: `TrashEntry`, `trash_folder`, `mover`, `limpar`, `free_name`,
  `trash_move`, `trash_purge` e `trashed_paths`
- **Linha:** novo arquivo; retenção em `RETENTION_DAYS: u64 = 30`; pasta `lixeira/` com índice
  `index.json` (nome, caminho original, quando foi movido, caminho dentro da lixeira)
- **Porquê:** a ação "Mover para a lixeira" não podia apagar nada: o arquivo sai da pasta do
  projeto e fica recuperável por 30 dias. Decisões de propósito: `rename` com plano B de
  copiar+apagar (a pasta de dados pode estar em outro disco); nome original preservado (ganha
  `-1`, `-2`… se repetir); a limpeza só apaga arquivo DENTRO da lixeira (mesma proteção de
  rascunho/backup) e esquece do índice o que sumiu da pasta (recuperado por fora, pelo
  Explorer); no desenvolvimento a pasta fica em `temp/lixeira`, como os rascunhos.

## src-tauri/src/commands/util.rs

### 2026-10-13 · este commit · helpers que a lixeira precisou
- **Local:** fim do arquivo
- **Linha:** `now_ms()`, `write_atomic()` e `project_root()` (novos; vieram de `backup.rs` e
  `drafts.rs` sem mudança de código)
- **Porquê:** os três já existiam dentro de outros módulos e a lixeira usa os mesmos (instante,
  gravação atômica do índice e "estou no projeto em dev?"). Em `util.rs` — o módulo dos
  utilitários comuns dos comandos — eles não duplicam.

## src-tauri/src/commands/drafts.rs

### 2026-10-13 · este commit · raiz do projeto vem do util
- **Local:** imports do topo
- **Linha:** `fn project_root()` local (removida) → `project_root` no `use super::util::{…}`
- **Porquê:** a lixeira precisa da mesma detecção de "rodando no projeto (dev)"; a função era
  privada aqui e passou a ser compartilhada.

## src-tauri/src/commands/backup.rs

### 2026-10-13 · este commit · ajuda a lixeira e usa os helpers do util
- **Local:** imports, `backup_missing` e o início do `mod tests`
- **Linha:** `fn now_ms`/`fn write_atomic` (removidas; vieram de `super::util`); no filtro do
  `backup_missing`, `!Path::new(p).exists()` → `… && !na_lixeira.contains(&p.to_lowercase())`;
  `use std::time::SystemTime;` dentro do `mod tests`
- **Porquê:** arquivo que está na lixeira não "sumiu" — sem o filtro, mover para a lixeira fazia
  o app avisar (e oferecer restauração de) um "original sumido" que o usuário tirou de
  propósito. O import local do teste é porque o `SystemTime` do topo saiu junto com o `now_ms`.

## src-tauri/src/commands/mod.rs

### 2026-10-13 · este commit · módulo trash
- **Local:** lista de módulos e o cabeçalho
- **Linha:** nova linha `pub mod trash;` (entre `search` e `util`) + linha no cabeçalho
- **Porquê:** os comandos ficam separados por assunto, como os vizinhos.

## src-tauri/src/commands/tests.rs

### 2026-10-13 · este commit · testes da lixeira
- **Local:** dois testes novos no fim do arquivo
- **Linha:** `lixeira_move_guarda_e_so_apaga_depois_de_30_dias` e
  `lixeira_nao_sobrescreve_nem_aceita_o_que_ja_esta_na_pasta`
- **Porquê:** garantem o combinado: o arquivo sai da pasta, o nome fica preservado, nada é
  apagado antes de 30 dias (e é depois disso), dois arquivos de mesmo nome convivem, mover algo
  que já está na lixeira (ou uma pasta) é recusado, e o índice esquece o que foi recuperado por
  fora. Os instantes são fixos — o teste não depende do relógio da máquina.

## src/files.ts

### 2026-10-13 · este commit · ponte da lixeira
- **Local:** depois de `deleteDraft`
- **Linha:** `interface TrashEntry` + `moveToTrash()` e `purgeTrash()` (novos `invoke`)
- **Porquê:** o frontend fala com o Rust pelos comandos `trash_move`/`trash_purge`, como todo o
  resto do app; o tipo espelha os campos do Rust (`name`, `original`, `moved_at`, `trash_path`).

## src/app/trash.ts

### 2026-10-13 · este commit · a ação da lixeira (novo arquivo)
- **Local:** arquivo inteiro: `askMoveToTrash`, `saveTabsFor`, `moveToTrash`, `purgeTrash`
- **Linha:** novo arquivo (métodos do App, como os vizinhos de `src/app/`)
- **Porquê:** é a regra da funcionalidade: confirmação (molde do `askSaveChanges`), salvar o que
  está aberto ANTES de mover (senão alteração pendente se perderia junto com o arquivo), fechar
  as abas já salvas e limpar os Recentes. A aba perde o `path` antes de fechar para o fechamento
  não gravar backup nem guardar "reabrir" de um documento que saiu de propósito — e
  `closedTabs`/Recentes são filtrados para o Ctrl+Shift+T não tentar reabrir o que foi movido.
  `purgeTrash` roda na abertura (silencioso): o prazo de 30 dias não depende de ninguém clicar.

## src/app/menus.ts

### 2026-10-13 · este commit · menu do arquivo unificado e com a lixeira
- **Local:** `fileMenuBuild`, `openFileMenuAt`, `openMenuPos` e `ddItem`
- **Linha:** itens do "⋯" viram `fileMenuBuild` (compartilhado); novo `openFileMenuAt` posiciona
  o MESMO menu no clique direito; `openMenuAt` extrai `openMenuPos`; `ddItem` ganha `danger`
- **Porquê:** o comentário do próprio arquivo já dizia que o ⋯ e o clique direito eram "a mesma
  lista", mas o clique direito abria outra, sem ícones e sem Renomear. Agora é uma só, com
  "Mover para a lixeira" no fim (vermelho de propósito: é ação destrutiva).

## src/styles/editor.css

### 2026-10-13 · este commit · item de menu vermelho
- **Local:** depois de `.dd-item:hover`
- **Linha:** `.dd-item.danger` e `.dd-item.danger .ic` (novas)
- **Porquê:** no menu do arquivo, "Mover para a lixeira" sai em vermelho (texto e ícone) para não
  se confundir com as ações comuns.

## scripts/testar-lixeira.mts

### 2026-10-13 · este commit · contrato da lixeira (novo arquivo)
- **Local:** arquivo inteiro
- **Linha:** novo (`npm run test:lixeira`)
- **Porquê:** o comportamento é testado no `cargo test`; aqui se confere o contrato entre as
  pontas: comandos existem e estão registrados, ponte no `files.ts`, prazo de 30 dias, item no
  menu, clique direito unificado, confirmação e a limpeza na abertura.

## src-tauri/src/commands/storage.rs

### 2026-10-13 · a799d63 · relatório e limpeza do legado (novo arquivo)
- **Local:** módulo inteiro (`soma_pasta`, `pasta_legada`, `storage_report`, `storage_remove_legacy`)
- **Linha:** novo arquivo
- **Porquê:** o painel de Armazenamento precisa saber quanto a pasta de dados e a pasta da versão
  anterior ocupam, e poder remover a antiga (`%LOCALAPPDATA%\com.mdcreator.desktop`) — que ficou
  para trás na renomeação e chegou a 586 MB. A remoção só roda quando a pasta nova existe e o
  caminho é o construído pelo próprio código (sem entrada do usuário).

## src-tauri/src/commands/drafts.rs

### 2026-10-13 · a799d63 · tamanho do rascunho e pasta
- **Local:** `DraftInfo`/`list_drafts`; novo `drafts_folder_path`
- **Linha:** novo campo `bytes: u64` (do metadata) e novo comando que devolve a pasta
- **Porquê:** o cartão de rascunhos mostra o total em disco e o botão "Abrir pasta" precisa do
  caminho mesmo quando não há rascunho nenhum (a pasta muda entre dev e app instalado).

## src-tauri/src/commands/mod.rs

### 2026-10-13 · a799d63 · módulo storage
- **Local:** lista de módulos
- **Linha:** nova linha `pub mod storage;`
- **Porquê:** registrar o módulo novo dos comandos de armazenamento.

## src-tauri/src/lib.rs

### 2026-10-13 · a799d63 · comandos registrados
- **Local:** `generate_handler!`
- **Linha:** `storage_report`, `storage_remove_legacy` e `drafts_folder_path` (novos)
- **Porquê:** sem registro, o frontend recebe "command not found".

## src-tauri/src/commands/tests.rs

### 2026-10-13 · a799d63 · teste do soma_pasta
- **Local:** novo teste `soma_o_tamanho_de_uma_pasta_recursivamente`
- **Linha:** novo teste (pasta com arquivo + subpasta; pasta inexistente = 0)
- **Porquê:** o relatório inteiro depende dessa soma; um erro ali mostraria números errados no painel.

## src/storage.ts

### 2026-10-13 · a799d63 · ponte do armazenamento (novo arquivo)
- **Local:** `relatorio()` e `removerLegado()`
- **Linha:** novo arquivo
- **Porquê:** manter o padrão dos outros módulos (backup.ts, history.ts): a tela fala com o
  backend por funções tipadas, não por `invoke` espalhado.

## src/history.ts

### 2026-10-13 · a799d63 · resumo e limpeza geral
- **Local:** depois de `clearHistory`
- **Linha:** novos `resumoVersoes()` (conta docs/versões e soma o texto ×2) e `limparVersoesTudo()`
- **Porquê:** o painel precisa do total do histórico inteiro (e não só de um documento) e de um
  botão que apague tudo.

## src/snapshots.ts

### 2026-10-13 · a799d63 · resumo e limpeza geral
- **Local:** depois de `clearCommits`
- **Linha:** novos `resumoLog()` (soma patches + âncoras ×2) e `limparLogTudo()`
- **Porquê:** mesmo motivo das versões: total do log e limpeza de todos os documentos.

## src/files.ts

### 2026-10-13 · a799d63 · rascunhos com tamanho e pasta
- **Local:** `DraftInfo` e novo `draftsFolder()`
- **Linha:** campo `bytes` no tipo e novo wrapper de `drafts_folder_path`
- **Porquê:** o cartão de rascunhos mostra o total e o botão abre a pasta certa em dev e instalado.

## src/settingsPage.ts

### 2026-10-13 · animação e cantos · três cartões de animação e dois de cantos
- **Local:** seção Aparência; `SettingsCtx`; o bloco de ligações "aparência"
- **Linha:** o grupo "Tema e janela" virou **Tema** (2 cartões, fora da lista), **Animação**
  (3 cartões `name="animacao"`), **Cantos** (2 cartões `name="cantos"`) e **Janela** (a lista de
  interruptores de antes); novos tipos `NivelAnimacao`/`FormatoCantos` e os pares
  `animacao()/setAnimacao()`, `cantos()/setCantos()` no `SettingsCtx`
- **Porquê:** o pedido é escolher o nível de animação em três degraus e o formato dos cantos em
  dois. Cada grupo é um `radiogroup` de cartões (mesmo padrão do tema), com prévia: a da animação
  mostra o ritmo numa bolinha que anda, e a dos cantos mostra o raio numa caixinha.

## src/styles/settings.css

### 2026-10-13 · animação e cantos · cartões e prévias
- **Local:** bloco "cartões de escolha (tema, animação, cantos)"
- **Linha:** `.st-temas/.st-tema*` → `.st-opcoes/.st-opcao*` (nomes neutros, agora que servem a três
  grupos); `.st-opcoes.tres` (grade de 3); `.st-anim-previa` + `@keyframes prev-anim/prev-discreta`;
  `.st-canto-previa[data-cantos]`
- **Porquê:** o mesmo cartão serve para tema, animação e cantos — renomear evita três cópias. A
  prévia da animação usa `container-type: inline-size` e `translateX(calc(100cqw - 24px))` para a
  bolinha atravessar a largura real do cartão (porcentagem em `translateX` seria da bolinha, não
  da caixa).

## src/styles/cantos.css (novo arquivo)

### 2026-10-13 · animação e cantos · camada de raios
- **Local:** arquivo inteiro (dois tiers + as abas do topo)
- **Linha:** novo arquivo
- **Porquê:** os raios estão espalhados por ~15 arquivos (2-16px), cada um no seu componente. Em vez
  de trocar 150 linhas, esta camada (importada por último) redefine os raios das superfícies mais
  visíveis em dois tiers — controles pequenos e caixas — com `!important` de propósito: é uma
  preferência do usuário e precisa vencer os raios mais específicos (ex.: `.tb-quick-actions .btn.icon`).
  Ficaram de fora as formas funcionais (pílulas de 999px, bolinhas de 50%) e as abas do topo, que
  têm regra direcional própria.

## src/styles/movimento.css

### 2026-10-13 · animação e cantos · os três níveis
- **Local:** logo depois do `:root`
- **Linha:** `html.anim-discreta { --mov-1/2/3 }` e `html.anim-completa { … }` (sem classe = padrão);
  gating: `html.anim-discreta … { animation: none !important }` (sem entradas/cascata) e
  `transform: none !important` no hover/active; `html.anim-completa` com `translateY(-2px)`,
  `scale(0.96)` e cascata mais espaçada
- **Porquê:** os tempos já são variáveis (`--mov-*`), então o nível só precisa redefini-las — o resto
  do app acompanha. Os `!important` são a camada de preferência: as regras de hover/entrada têm
  especificidade maior que `html.anim-*`.

## index.html

### 2026-10-13 · animação e cantos · classes antes da primeira pintura
- **Local:** script inline do `<head>`
- **Linha:** leitura de `mdc.animacao` e `mdc.cantos` e as classes no `<html>` (novo)
- **Porquê:** mesmo motivo do tema: aplicar depois do boot faria a primeira pintura sair no tempo e
  no raio padrão e "pular" ao aplicar. Ficam no `<html>` (e não no `<body>`) porque o script roda
  antes de o corpo existir.

## src/styles.css

### 2026-10-13 · animação e cantos · cantos.css por último
- **Local:** fim da lista de `@import`
- **Linha:** `@import "./styles/cantos.css";` (novo)
- **Porquê:** a camada de raios precisa vir depois de todos os componentes (inclusive do movimento,
  que também mexe em raios de alguns elementos).

## src/app/layout.ts · src/app/pages.ts · src/app/app.ts

### 2026-10-13 · animação e cantos · guardar, aplicar e ler no boot
- **Local:** `initialAnimacao()`, `initialCantos()`, `applyAnimacao()`, `applyCantos()` (layout.ts);
  o objeto do `SettingsCtx` (pages.ts); a abertura (app.ts, ao lado do `applyTheme`)
- **Linha:** novos métodos + `animacao/setAnimacao/cantos/setCantos` no ctx +
  `this.applyAnimacao(this.initialAnimacao()); this.applyCantos(this.initialCantos());`
- **Porquê:** o nível e os cantos são preferências como o tema: guardadas em `mdc.animacao`/
  `mdc.cantos`, aplicadas como classe no `<html>` e lidas na abertura. `applyCantos` grava sempre —
  inclusive "redondos", para o padrão ficar explícito no armazenamento.

## scripts/testar-layout.mts

### 2026-10-13 · animação e cantos · regressões cobertas
- **Local:** bloco "configurações: aparência em cartões"
- **Linha:** 11 verificações (as 5 do tema atualizadas + 6 novas)
- **Porquê:** as grades de 2 e de 3, o estado marcado, as prévias, os tempos dos três níveis, o
  gating do discreto, o relevo do completo, os raios dos cantos, as abas e a leitura no boot.
## src/settingsPage.ts

### 2026-10-13 · este commit · aba Histórico com resumo e recuperação dentro do app
- **Local:** seção `data-sec="historico"` e o bloco `// Histórico e salvamento` do render
- **Linha:** `<small data-hist-count>` + "Abrir histórico"/"Apagar" → resumo por camada
  (`data-hist-versoes`, `data-hist-alteracoes`, `data-hist-copias`), listas `data-copias-doc` e
  `data-copias-outros` (montadas com o novo helper `el()`), cópias com `[Restaurar]`/`[Apagar]`,
  "Onde ficam os arquivos" e apagar em dois cliques (classe `confirmando`)
- **Porquê:** a tela só mostrava a contagem de versões e mandava para o modal; não dizia o que
  cada camada guardou nem onde, e o "Apagar" apagava só as versões (as alterações ficavam — o
  botão prometia mais do que fazia).

## src/app/pages.ts

### 2026-10-13 · este commit · contexto do histórico (visão, apagar completo e recuperar)
- **Local:** `settingsContext()`
- **Linha:** `historyCount`/`clearHistory` → `historicoVisao()` (as três camadas + outros
  documentos com backup + originais sumidos + pasta do app), `apagarHistoricoDoDoc()` (versões +
  commits + `backup.apagarLog()`), `restaurarCopia()`, `abrirRecuperacao()`; `openHistory(aba)`
- **Porquê:** o resumo e as ações das três camadas ficam num lugar só (o App conhece o documento
  atual, as abas abertas e o que está em disco); a página de Configurações continua só desenhando.

## src/app/historySearch.ts

### 2026-10-13 · este commit · restaurar cópia de qualquer documento, com recarga tolerante a caixa
- **Local:** `reloadCurrentFromDisk()` e o novo `restaurarCopia()`
- **Linha:** `if (tab.path !== path)` → comparação em `.toLowerCase()`; novo
  `restaurarCopia(path, root, name)`, que restaura, ativa a aba do documento (se estiver aberta)
  e recarrega do disco
- **Porquê:** o índice do backup pode devolver o mesmo caminho do Windows com maiúsculas
  diferentes — a recarga não acontecia e o salvamento automático sobrescreveria a cópia
  restaurada em silêncio. E recuperar a cópia de **outro** documento exige a aba certa ativa
  antes de reler do disco.

## src/historyUi.ts

### 2026-10-13 · este commit · aba inicial do histórico
- **Local:** `HistoryHooks`, tipo `AbaHistorico` e abertura do diálogo
- **Linha:** novo `abaInicial?: AbaHistorico`; `void carregar()` → `trocarAba(atual)`
- **Porquê:** os atalhos "Abrir aba Versões/Alterações/Backup" das Configurações precisam levar
  direto ao ponto; antes o modal caía sempre em Versões.

## src/styles/settings.css

### 2026-10-13 · este commit · linhas de cópia, selo e estado armado do apagar
- **Local:** bloco novo depois de `.st-list-note`
- **Linha:** `button.st-row` (reset do botão da linha expansível), `.st-chev`, `.st-tag` e
  `.st-btn.danger.confirmando`
- **Porquê:** as listas de cópias e de "outros documentos" são montadas em tempo de execução; o
  selo de "proteção" e o estado "Confirmar?" do apagar precisam de desenho próprio.

## src/app/keymap.ts

### 2026-10-13 · (este commit) · atalhos configuráveis (novo arquivo)
- **Local:** tabela `ATALHOS`, `combina`, `comboDeEvento`, `atalhoDoEvento`, `trocarTecla`,
  `voltarAoPadrao`, `voltarTudoAoPadrao`, `emCaptura`
- **Linha:** novo arquivo
- **Porquê:** os atalhos eram uma cadeia de `if` dentro do `keys.ts` — funcionavam, mas a aba
  Atalhos só podia MOSTRAR a lista, nunca trocar uma tecla. Aqui cada ação se declara uma vez
  (tecla de fábrica, grupo, rótulo, o que faz e as condições) e vira fonte única: o `keys.ts`
  despacha por esta tabela, a fita pergunta a tecla de `fita` e as listas do app leem daqui.
- **Local:** `trocarTecla`
- **Linha:** novo
- **Porquê:** recusa conflito em vez de aceitar duas ações na mesma tecla — as duas disparariam
  juntas e não haveria como saber qual era qual. A recusa nomeia o outro atalho.
- **Local:** `comboDeEvento` / `nomeDaTecla`
- **Linha:** novo
- **Porquê:** tecla sem modificador só é aceita se for F1–F12. Letra ou dígito solto viraria um
  atalho que dispara enquanto a pessoa escreve no documento (o ouvinte é do `window`, e o evento
  sobe do editor até ele).
- **Local:** `desmontar` + `combina`, no caso de `digitos: true`
- **Linha:** novo
- **Porquê:** "Ctrl+1…9" não é uma tecla só. A entrada guarda a família (`Ctrl+1`) e o `combina`
  aceita qualquer dígito de 1 a 9 com os mesmos modificadores — assim essa linha também pode ser
  trocada, em vez de ficar fixa na lista.
- **Local:** `EVENTO_MUDOU` (disparado por `gravar`)
- **Linha:** novo
- **Porquê:** quem mostra a tecla fora da aba (a dica do botão da fita) precisa acompanhar a troca;
  sem o aviso a interface passaria a mentir depois de uma troca.

## src/app/menus.ts · src/app/tabs.ts · src/app/toolbar.ts · src/tabs.ts

### 2026-10-13 · (este commit) · as dicas de tecla saem da tabela
- **Local:** 12 pontos com `hint:` e os dois `title:` de botão (novo botão de aba e × de fechar)
- **Linha:** `hint: "Ctrl+W"` → `hint: teclaVisivel("fechar-aba")` (e assim por diante);
  `title: "Fechar aba (Ctrl+W)"` → `title: "Fechar aba (" + teclaVisivel("fechar-aba") + ")"`
- **Porquê:** com o atalho trocável, uma tecla escrita à mão na dica fica velha na primeira troca.
  Agora as dicas leem a tecla em vigor; se ela mudar, a próxima abertura do menu já mostra a nova.

## src/styles/cantos.css

### 2026-10-13 · cantos (correção) · redondo não sobrescreve; quadrado aperta de verdade
- **Local:** as duas listas `html.cantos-*` e a regra das abas
- **Linha:** `html.cantos-redondos … { border-radius: 10px/16px !important }` → **removido**;
  `html.cantos-quadrados … { border-radius: 4px/6px !important }` → `2px` (controles) e `3px`
  (caixas); `.tab` de `5px 5px 0 0` → `2px 2px 0 0`
- **Porquê:** o cartão "Redondo" era o padrão e mesmo assim reescrevia os raios de ~60 componentes —
  o botão Desenhar (container `.tb-split-draw`, 8px com `overflow: hidden`) virou pílula com 16px.
  Arredondar o que já estava certo era o erro; agora o Redondo é o desenho original do app
  (componente a componente) e só o Quadrado tem regras. E o Quadrado estava tímido (4/6px, ainda
  visivelmente arredondado em botões de 28px): passou a 2/3px.

## src/app/layout.ts

### 2026-10-13 · cantos (correção) · redondo não deixa classe
- **Local:** `applyCantos()`
- **Linha:** `classList.toggle("cantos-redondos", …)` → `classList.remove("cantos-redondos")`
- **Porquê:** sem regras de CSS para o redondo, a classe só serviria de resíduo; remover garante que
  nenhuma sobra de uma versão anterior fique no `<html>`.

## index.html

### 2026-10-13 · cantos (correção) · boot só para o quadrado
- **Local:** script inline do `<head>`
- **Linha:** `if (cantos === "quadrados" || cantos === "redondos") …add("cantos-" + cantos)` →
  `if (localStorage.getItem("mdc.cantos") === "quadrados") …add("cantos-quadrados")`
- **Porquê:** acompanha o `applyCantos`: o redondo não tem classe.

## src/settingsPage.ts

### 2026-10-13 · cantos (correção) · títulos dos cartões
- **Local:** grupo Cantos
- **Linha:** "Cantos retos, cara de ferramenta" → "Cantos retos de verdade (2 a 3 px)"; "Cantos bem
  suaves, arredondados" → "Cantos suaves, como o app já era"
- **Porquê:** o rótulo precisa dizer a verdade do que cada cartão faz.

## scripts/testar-layout.mts

### 2026-10-13 · cantos (correção) · regressões cobertas
- **Local:** bloco "configurações: aparência em cartões"
- **Linha:** as duas verificações de raio viraram três: o quadrado em 2/3px, a ausência de
  `cantos-redondos` no CSS e a remoção da classe no `applyCantos`
- **Porquê:** o erro era justamente "mexer no que já estava certo" — o teste agora falha se alguém
  voltar a criar regras para o redondo ou afrouxar o quadrado.

## src/app/batimento.ts

### 2026-10-13 · (este commit) · "estou vivo" (novo arquivo)
- **Local:** `ligarBatimento()`
- **Linha:** novo arquivo
- **Porquê:** avisa o servidor de dev a cada 5 s que a página está viva — é o sinal que o watchdog
  usa para perceber uma página travada. O aviso sai mesmo com a janela minimizada de propósito:
  escondida, o navegador limita os timers a cerca de um por minuto, e é por isso que o watchdog só
  fala em travamento depois de bem mais que isso. Fora do desenvolvimento não faz nada
  (`import.meta.env.DEV`), então não sobra rastro na versão final.

## tools/watchdog.ps1

### 2026-10-13 · (este commit) · percebe a página travada
- **Local:** `EstadoDaPagina`, `MarcarSubida`, `PaginaTravada` e um bloco novo no laço principal
- **Linha:** novo — o watchdog já reiniciava quando o processo do app caía; agora também quando o
  **conteúdo** morre (processo vivo, janela de pé)
- **Porquê:** era o caso que escapava. Ele pergunta ao servidor de dev quando a página avisou pela
  última vez e reinicia o app quando o aviso passa de `-TravadoSegundos` (padrão 90). Sem servidor
  no ar ele não julga (aí vale o "caiu") e com `-SemLevantarSeCair` a checagem fica desligada, no
  mesmo espírito: o app só é mexido quando o código muda.
- **Local:** parâmetros `-TravadoSegundos` e `-TravadoNaSubidaSegundos`
- **Linha:** novos (90 e 180)
- **Porquê:** dois prazos porque são dois casos. Depois de a página ter avisado uma vez, o silêncio
  é sintoma e 90 s já dá folga sobre o limite de 1 aviso/minuto da janela escondida. **Antes** do
  primeiro aviso não se pode acusar travamento: a página ainda está carregando dicionário e modelo
  — daí 180 s. Um `vistoEm` igual ao anotado na subida é aviso anterior à subida e não conta.
- **Local:** arquivo inteiro
- **Linha:** gravado com **BOM de UTF-8**
- **Porquê:** o PowerShell 5.1 lê arquivo sem BOM como ANSI. Sem o BOM os acentos do script viravam
  lixo já na memória e o log saía corrompido ("página" virava "pÃ¡gina") — foi um teste que pegou.

## src/app/aiContext.ts

### 2026-10-13 · 642f315 · Copiar no menu de contexto
- **Local:** `setupEditorInteractions`, handler do `contextmenu` no `#editor`
- **Linha:** `const cursor = this.editor.selectionPos().from` → `const sel = this.editor.selectionPos()`
  + bloco novo: quando `sel.to > sel.from`, o menu ganha o item **Copiar** (ícone `i-copy`, `Ctrl+C`)
  antes do "Pasta"; o clique copia `sliceDoc(sel.from, sel.to)` via `copyText`
- **Porquê:** com texto selecionado, o menu só oferecia "Pasta (contexto)" — copiar é a ação mais
  óbvia com a seleção na mão. O item só aparece quando há seleção (sem seleção o menu fica como era).

## docs/pesquisa-formalidade-abnt.md

### 2026-10-13 · (este commit) · pesquisa de formalidade e validação ABNT (novo arquivo)
- **Local:** documento inteiro
- **Linha:** “novo arquivo”
- **Porquê:** registro dos dois pedidos do projeto — (1) deixar qualquer frase formal **sem IA** e
  (2) verificar um trabalho acadêmico contra as regras ABNT, com relatório. O documento confirma o
  que já existe (`data/informal.ts`, `tone.ts`, `style/abnt.ts` e os vizinhos de `style/`),
  cataloga as transformações de formalidade com ordem de aplicação, riscos de sentido e métrica
  (marcadores informais por 1.000 palavras), classifica o que das normas NBR 14724:2024,
  10520:2023, 6023:2025, 6027:2012, 6024:2012, 6028:2021, 15287:2025, IBGE (tabelas) e 5892:2019
  é verificável automaticamente no Markdown e no `.docx` exportado, entrega o catálogo inicial de
  41 checagens, as ferramentas de apoio (abnTeX2/CSL, Vale, textlint, LanguageTool) e o plano por
  fases — para as próximas tarefas de implementação terem base decidida e referências datadas.

## docs/pesquisa-correcao-offline.md

### 2026-10-13 · este commit · documento novo
- **Local:** arquivo inteiro
- **Linha:** novo arquivo
- **Porquê:** o pedido "as sugestões parecem defasadas no começo; quero que corrija sozinho com
  confiança com o tempo; quero um algoritmo muito melhor sem IA" não tinha um documento que
  juntasse diagnóstico e direção. Este registra o porquê técnico de cada gargalo (ranking sem
  contexto, decisão por regra fixa, aprendizado só de pares aceitos, tabelas pequenas), o estado
  da arte sem IA com fontes e licenças, a decisão de troca por probabilidade com margem e o
  plano por fases F0–F4 com métricas — é o documento de referência para as próximas tarefas do
  corretor.

## docs/pesquisa-sugestoes.md

### 2026-10-13 · pesquisa (síntese) · ponto de entrada e ordem de execução
- **Local:** documento novo
- **Linha:** `novo`
- **Porquê:** as duas pesquisas (correção offline e formalidade/ABNT) são densas e chegaram em
  documentos separados; faltava o que responde "por onde começo e como sei que melhorou". A síntese
  liga as duas, diz as causas em uma página, propõe as cinco camadas (léxico, candidatos, contexto,
  decisão, estilo/norma) e ordena o trabalho em quatro ondas — começando pelas correções de rumo
  baratas (citação no padrão 10520:2023, n-gramas no ranqueamento, sinal negativo no aprendizado,
  margem de confiança) e terminando no motor ABNT e no perfil `.docx`.
## src/broker/data/phrases.ts

### 2026-10-13 · este commit · expressões adverbiais que pedem vírgula
- **Local:** novo `ADVERBIAIS_VIRGULA` (depois de `INTRO_CONNECTIVES`)
- **Linha:** novo array com “hoje em dia”, “com o tempo”, “no começo”, “no início”, “no fim”,
  “de início”, “a princípio”, “por enquanto”, “às vezes”, “de vez em quando”, “na maioria das
  vezes”, “em geral”, “na verdade”, “na prática”, “sem dúvida”, “com certeza”, “mais tarde”,
  “mais cedo”, “em seguida”, “logo depois”, “por último”, “no futuro”, “no passado”, “de agora
  em diante”, “daqui a pouco”, “atualmente”, “antigamente”, “ultimamente”
- **Porquê:** a lista é curta de propósito — só o que quase sempre pede vírgula depois (“Com o
  tempo, era…”). Entram aqui, e não no `INTRO_CONNECTIVES`, porque o caso delas é outro: também
  valem **retomando a oração** no meio do trecho, e quem chega com complemento (“no começo de
  tudo”, “com o tempo livre”) fica de fora na hora, pelo guarda da regra.

## src/broker/style/punctuation.ts

### 2026-10-13 · este commit · vírgula das aberturas adverbiais
- **Local:** novo `adverbialComma` + `CONTINUA_EXPRESSAO` + `trechoDesenvolvido`
- **Linha:** novo (a regra não existia); dispara em dois contextos: (1) abrindo a frase
  (`(?:^|[.!?]\s+|\n)(expr)(?=\s+[\p{L}])`) → `expr,`; (2) retomando a oração, quando o
  pronome-sujeito vem logo depois e já há 6+ palavras desde a última pontuação → `expr,`
- **Porquê:** medido no texto real do usuário: a varredura automática aplicava **só maiúscula e
  ponto final** — nenhuma vírgula — e o trecho de 30 palavras ficava sem pontuação interna.
  As duas vírgulas agora entram sozinhas (“Com o tempo,”, “…revisar hoje em dia, eu quero…”).
  O guarda `CONTINUA_EXPRESSAO` evita o falso positivo de expressão com complemento
  (“No começo de tudo”, “Com o tempo livre”), em que a vírgula cairia no lugar errado.

### 2026-10-13 · este commit · quebra sugerida em trecho longo (antes do pronome)
- **Local:** `longRunWithoutPunct` + novo `pontoSeguro` + `ANTES_DO_PRONOME`
- **Linha:** o trecho de 25+ palavras sem pontuação, que só avisava, agora procura um ponto
  seguro (antes de pronome-sujeito que **abre oração**) e vira sugestão `quebra-frase`
  (`. Eu resolvi…`); sem ponto seguro, segue só o aviso. `pontoSeguro` descarta pronome depois
  de subordinante/preposição/advérbio (“que eu”, “sem eu”, “depois eu”…), exige 8+ palavras na
  oração e pula quando quem manda é a vírgula do adverbial
- **Porquê:** sem candidato a quebra, o aviso não dava saída — o usuário via o trecho sublinhado
  e a correção automática “desistia”. A quebra fica como sugestão (classe `quebra-frase`, fora da
  varredura automática de propósito: reestruturar frase é decisão de leitura) e entra no
  **“Corrigir tudo (estilo)”** do `F7`, num clique.

## src/broker/style/index.ts

### 2026-10-13 · este commit · registro da regra de adverbiais
- **Local:** import e lista `RULES`
- **Linha:** `adverbialComma` entra depois de `introConnectiveComma` e antes de `missingFinalPeriod`
- **Porquê:** mesma ordem das outras regras de vírgula de abertura; se duas regras avisarem o
  mesmo trecho, vale a primeira da lista.

## src/md/editor.ts

### 2026-10-13 · este commit · seleção sem pintura dupla
- **Local:** extensão `linhaDoCursor` (novo `ViewPlugin`), no lugar de `highlightActiveLine()`
- **Linha:** `highlightActiveLine()` → plugin próprio que só marca a linha de seleções **vazias**
- **Porquê:** o `highlightActiveLine` do CodeMirror marca a linha da ponta da seleção mesmo com
  texto selecionado; o fundo dele somava ao da seleção (medido nos pixels: `33,33,70` virava
  `35,35,79`) e a faixa extra parecia "duas coisas selecionadas". Com o cursor sozinho, o
  destaque da linha continua (como no VS Code).

## src/broker/spell.worker.ts

### 2026-10-13 · (este commit) · palavra que o dicionário aceita e ninguém escreve
- **Local:** `PREFIXOS` (novo, ao lado de `POSICAO`), `valeComoPalavra` e `cortesDeColagem`
  (novos) e o bloco de dicionário no `check`
- **Linha:** `if (typo.check(word)) continue;` → um bloco que, quando o dicionário aceita,
  ainda pergunta por colagem e só então continua
- **Porquê:** "oira" é forma do verbo "oirar" — o dicionário aceita, então o corretor não
  tinha o que acusar e quem escreveu "oira" querendo "o ira" ficava sem aviso nenhum. O que
  separa a palavra obscura da palavra normal não é o dicionário, é o USO: ela não aparece no
  corpus de texto escrito e nenhuma palavra do corpus começa igual (a família não é usada).
- **Local:** `cortesDeColagem`, condição do corte
- **Linha:** primeiro teste aceitava qualquer corte em duas palavras válidas; ficou só a
  palavrinha de UMA letra colada na seguinte
- **Porquê:** com o corte livre a regra acusava palavra rara de verdade — o teste do próprio
  projeto pegou "xilofone" virando "xi lo fone" (e o "opacidade" → "opa cidade" aparecia na
  medição). Estreitada ao caso clássico ("o ira", "o que", "a vida"), a medição em 2803
  palavras de texto real do projeto deu **zero acusações**.

### 2026-10-13 · (este commit) · o corpus é o completo, não a lista curta
- **Local:** `prepararIndice` (monta `corpus` e `familias`) e `cortesDeColagem` (passa a usá-los);
  o `PREFIXOS` saiu
- **Linha:** `POSICAO.has(n)` / `PREFIXOS.has(...)` → `corpus.has(n)` / `familias.has(...)`
- **Porquê:** a regra nasceu consultando `PALAVRAS_LISTA` (a lista CURTA de palavras frequentes,
  usada para julgar "frequente" nos cortes). Mas "aplicativo" não está nessa lista — e "apl" não
  é prefixo dela — enquanto a lista COMPLETA (`freq-pt.json`, que o worker já recebia em
  `prepararIndice`) tem "aplicativo", "aplicação", "aplicar". Resultado: o app acusou
  **"aplicativo" → "a plicativo"**. Agora as duas perguntas — "esta palavra aparece em texto
  escrito?" e "a família dela é usada?" — são feitas contra o corpus completo, o mesmo que a
  medição usou (2803 palavras, zero acusações).
- **Local:** primeira linha de `cortesDeColagem`
- **Linha:** `if (!corpus || !familias) return [];` (novo)
- **Porquê:** o corpus chega depois do dicionário. Sem ele a regra não opina — melhor não acusar
  do que acusar sem dado.

## test/docs/gramatical.md

### 2026-10-13 · (este commit) · caso 32: "aplicativo" não pode virar duas
- **Local:** `## Caso 32`
- **Linha:** caso novo — errado "O aplicativo nao abre o documento.", esperado
  "O aplicativo não abre o documento."
- **Porquê:** o falso positivo relatado precisa de guarda no corpus. O caso vale duas vezes: a
  correção do "nao" e, principalmente, o texto correto **não** ser mexido — é essa metade que
  impede "aplicativo" de voltar a ser acusado.

## src/broker/spell.ts

### 2026-10-13 · (este commit) · `duvida` no `SpellHit`
- **Local:** `interface SpellHit`
- **Linha:** campo novo `duvida?: boolean`
- **Porquê:** separar a colagem DEDUZIDA (o dicionário aceita a palavra: é pergunta) da colagem
  clássica ("coisasque", que já vem com `best` e é aplicada sozinha). O `check.ts` usa a marca
  para decidir se oferece a correção sem nunca aplicá-la sozinha.

## src/broker/check.ts

### 2026-10-13 · (este commit) · a colagem deduzida entra como correção disponível
- **Local:** o `issues.push` do ramo de ortografia
- **Linha:** `fix: hit.duvida ? hit.suggestions[0] : undefined` (novo)
- **Porquê:** a acusação precisa aparecer na revisão com o botão "Corrigir" (e valer no
  "corrigir tudo"), mas nunca sozinha: `fix` de ortografia **não** entra na varredura
  automática — quem aplica automático é `auto` (`replacementFor` usa `auto` para ortografia e
  `fix` para estilo). Sem `auto`, a regra pergunta em vez de decidir.

## test/docs/gramatical.md

### 2026-10-13 · (este commit) · caso 31: palavras coladas
- **Local:** `## Caso 31`
- **Linha:** caso novo — errado "e oira verifica", esperado "e o ira verifica"
- **Porquê:** o corpus é o contrato do corretor e este era o furo relatado. O caso só passa
  porque a colagem deduzida vem com `fix` (o runner aplica `fix ?? auto`); é ele também que
  garante que o texto correto não seja mexido — 31/31 dos dois lados.

## src/broker/style/abnt.ts

### 2026-10-13 · este commit · citação autor-data na NBR 10520:2023
- **Local:** `abntCitation` (+ novo auxiliar `autorCaixaMista`)
- **Linha:** a regra passou de acusar qualquer autor fora de CAIXA ALTA
  (`autor !== autor.toUpperCase()` → `fix` “(SILVA, 2020)”, aplicado na varredura/salvar) para
  **sugerir** a caixa mista: sem `fix` (só `suggestions` “(Silva, 2020)”), para nunca entrar
  sozinha; a mensagem agora cita a **NBR 10520:2023** (a CAIXA ALTA era da 10520:2002)
- **Porquê:** a 10520:2002 foi substituída pela 10520:2023, que usa Caixa Mista no sistema
  autor-data; a regra antiga marcava como errado quem escrevia no formato vigente (falso
  positivo ativo) e “corrigia” para o formato antigo. A caixa mista passa a ser aceita em
  silêncio e a caixa alta vira sugestão; siglas curtas (ABNT, IBGE, ONU…) ficam como estão
  para o auxiliar não trocar sigla por nome.

### 2026-10-13 · este commit · “et al.” opcional na NBR 10520:2023
- **Local:** `abntEtAl`
- **Linha:** regex `(?<![\p{L}])(et\.?\s*al)(?!\.)(?![\p{L}])` →
  `(?<![\p{L}])(et\.\s*al|etal)(\.?)(?![.\p{L}])`; mensagem `[ABNT] A expressão latina correta é
  “et al.” (com ponto no final)` → `[ABNT NBR 10520:2023] A grafia da expressão latina é
  “et al.” (ponto só em “al.”); o uso é opcional`
- **Porquê:** a 10520:2023 torna o uso de “et al.” **opcional** (mais de 3 autores): “et al.” e
  “et al” passam a ser aceitos, e a regra só normaliza a grafia com ponto depois de “et”
  (“et. al”, “etal”) — quem escreve sem o ponto final não é mais acusado.

## scripts/testar-correcao.mjs

### 2026-10-13 · este commit · casos da citação ABNT
- **Local:** nova seção “ABNT: citação autor-data (NBR 10520:2023)”
- **Linha:** novo bloco com 7 verificações: `(Silva, 2020)` não é acusada; `(SILVA, 2020)` vira
  sugestão (sem `fix`, com `(Silva, 2020)` em `suggestions`); `(IBGE, 2020)` (sigla curta) não é
  acusada; a sugestão não entra na correção automática; “et al.” e “et al” aceitos; “et. al”
  volta para “et al.” com a norma na mensagem
- **Porquê:** a regra mudou de norma (10520:2023) — sem os casos novos, o teste não protegia o
  falso positivo que a tarefa veio corrigir nem a nova forma aceita.

## scripts/gerar-contexto.mjs (novo) + public/ngrams/ctx-pt.json (novo)

### 2026-10-13 · corretor com contexto · o recorte de bigramas do modelo
- **Local:** arquivo novo (gerador) e arquivo de dados novo (1,9 MB)
- **Linha:** `novo`
- **Porquê:** o modelo completo tem 7,2 MB (os trigramas são 3,5 MB + 1,7 MB de totais) e o corretor
  só precisa de `w`/`n` (vocabulário e unigramas, para o backoff) e `b`/`bt` (sucessores e total de
  cada contexto). O recorte tem 1,9 MB e 29.157 contextos. `w`/`n` vão **completos**, sem o filtro
  de `gerar-frequencia.mjs`, porque os índices de `b`/`bt` apontam para eles.

## src/broker/spell/contexto.ts (novo)

### 2026-10-13 · corretor com contexto · o quanto a palavra combina com a anterior
- **Local:** `montarContexto`, `logProb`, `notaContexto`
- **Linha:** `novo`
- **Porquê:** era o que faltava para "acertar desde o começo": o ranqueamento só olhava distância de
  edição + frequência da palavra isolada. A conta é bigrama com **suavização de Dirichlet** e
  backoff para o unigrama (`(c + α·uni) / (total + α)`), e a nota vai de 0 a 1 pelo quanto a
  sequência é mais provável que a palavra sozinha (20× = 1). Puro, para testar no Node.

## src/broker/spell/decisao.ts (novo)

### 2026-10-13 · corretor com contexto · aplicar sozinho por probabilidade, não por regra
- **Local:** `probabilidades`, `decidir`, `registrarMantida`, `registrarDesfeita`, `tauAtual`, `limparCalibragem`
- **Linha:** `novo`
- **Porquê:** o auto-aplicar era um conjunto de condições fixas (`margem >= 0.05`, `10× mais
  frequente`…). Agora as notas viram probabilidades e a decisão é `confiança ≥ τ` **e**
  `vencedor ≥ 2× o segundo` — **empate vira sugestão, nunca aplicação** (é o que a pesquisa chama
  de F2). A confiança é a fatia do vencedor contra o segundo (0,5 = empate), para a decisão não
  ficar mais frouxa só porque vieram muitos candidatos. As classes de certeza (acento/cedilha, erro
  clássico, mais próximo sem empate, muito mais frequente, candidato único) continuam aplicando
  direto. O limiar começa em 0,62 e anda entre 0,55 e 0,85 conforme o histórico de desfazer ×
  manter; a leitura já alimenta o worker, e o gancho de "desfez" é o próximo passo (fica em
  `registrarDesfeita()`).

## src/broker/spell.worker.ts

### 2026-10-13 · corretor com contexto · contexto na nota e decisão no lugar do `best`
- **Local:** `sugerirPalavra`, o carregamento do `init`, a mensagem `check` e a sonda `debug`
- **Linha:** `anotar(cand, nota, …)` → soma `PESO_CONTEXTO · notaContexto(cand, anterior, contexto)`;
  o bloco do `best` virou `decidir({pontos, certo, contexto}, tau)`; `check` aceita `ctx` e devolve
  `decisao`; nova mensagem `tau`; `debug` ganhou `caza_com_contexto` × `caza_sem_contexto`
- **Porquê:** o worker é quem tem o índice e o modelo; o contexto só podia entrar aqui. O `best`
  continua sendo a resposta (compatível com quem já consome), mas agora sai da decisão
  probabilística; o `decisao` no hit é para diagnóstico e testes. A sonda mostra o mesmo erro com e
  sem contexto lado a lado.

## src/broker/spell.ts

### 2026-10-13 · corretor com contexto · contexto na chamada e limiar enviado
- **Local:** `SpellHit`, `enviarLimiar`, `checkWords`
- **Linha:** `checkWords(words)` → `checkWords(words, contexto?)` (manda `ctx` no `postMessage`);
  `enviarLimiar()` (novo, no `ready`) manda `tauAtual()`; `SpellHit` ganhou `decisao?`
- **Porquê:** a interface é quem sabe o contexto (o texto) e quem calibra o limiar (localStorage);
  o worker não tem nem um nem outro.

## src/broker/check.ts

### 2026-10-13 · corretor com contexto · a palavra anterior de cada token
- **Local:** `checkText`, antes do `checkWords`
- **Linha:** `palavrasDoTexto` + `contexto` (novos): para cada token, acha a palavra anterior
  **entre todas** as palavras do texto (mesmo as curtas, que não entram na checagem), com `<s>` no
  começo
- **Porquê:** o contexto vale para a frase inteira, não só para as palavras que o corretor checa —
  "vou para a caza" precisa saber que antes vinha "para". O ponteiro percorre as duas listas em
  ordem (uma vez só), sem custo perceptível.

## scripts/testar-correcao.mjs

### 2026-10-13 · corretor com contexto · 15 verificações novas
- **Local:** bloco "contexto e decisão"
- **Linha:** `novo`
- **Porquê:** o modelo monta e pontua (sequência que existe puxa a nota, desconhecida não penaliza,
  formato inválido devolve null) e a decisão cobre certeza, vencedor folgado, empate técnico, margem
  mínima, candidato único, sem candidato, limiar padrão e softmax.

## src/md/editor.ts

### 2026-10-13 · este commit · popup do aviso mostra a correção pronta
- **Local:** `showIssuePopup` (linha "Corrigir:" e bloco das ações), `fixPreview` (novo) e o campo
  `onIgnoreStyle`
- **Linha:** avisos de estilo com `fix` e sem `suggestions` (ex.: "Frase muito comprida") ganharam a
  linha **"Corrigir:"** com um chip mostrando o texto **já corrigido** (janela de ~30/36 caracteres
  em volta da troca, com "…"); o clique aplica o `fix`. As ações deixaram de ser sempre de
  dicionário: `spell` mantém "Ignorar palavra"/"Adicionar ao dicionário"; `style` passa a ter só
  **"Ignorar neste texto"** (`onIgnoreStyle`)
- **Porquê:** o popup dizia o problema e não mostrava a solução que a regra já calculava — a quebra
  de frase monta o ". E" na hora de avisar, mas o chip só existia quando a regra mandava
  `suggestions`. E "Ignorar palavra"/"Adicionar ao dicionário" num aviso de estilo eram botões
  mortos: o `ignoredHere` só filtra a ortografia, o estilo não consulta o dicionário. O `title` do
  chip ficou com o texto completo porque o preview pode encurtar com "…".

### 2026-10-14 · 4cfd23f · diff colorido no popup
- **Local:** `fixPreview` → `fixPreviewParts` (novo), `addChipDom`/`spanTexto` (novos) e os chips
  "Trocar por"/"Corrigir" no `showIssuePopup`
- **Linha:** o chip "Corrigir" passou a montar `<span>`s por parte (contexto neutro, `cm-issue-rem`
  para o que sai, `cm-issue-add` para o que entra) usando `partesDaTroca`; o "Trocar por" virou
  `removido → sugestão` colorido
- **Porquê:** o chip mostrava só o resultado aplicado — não dava para ver o que o app ia tirar e
  pôr. Agora o vermelho riscado é o que sai e o verde é o que entra; quando só um lado muda, o
  comum fica neutro (o diff mínimo evita repetir a palavra inteira).

## src/app/assistant.ts

### 2026-10-13 · este commit · "Ignorar neste texto" para avisos de estilo
- **Local:** `styleKey` (novo), o filtro no `runWritingCheck` e `ignoreStyleIssue` (novo)
- **Linha:** `this.issues = await checkText(...)` → `const achados = await checkText(...)` +
  `this.issues = achados.filter((i) => i.kind !== "style" || !this.tab.ignoredStyle.has(styleKey(i)))`;
  `ignoreStyleIssue` guarda `styleKey(issue)` no `tab.ignoredStyle` e roda a verificação de novo
- **Porquê:** o "Ignorar palavra" do popup não tinha efeito nenhum sobre avisos de estilo (a lista
  de ignoradas só alimenta a ortografia). A chave é `mensagem + trecho` — estável entre rechecagens
  e independente da posição (que muda a cada edição) — e o conjunto vive na ABA: dispensar um aviso
  num documento não silencia os outros.

## src/tabs.ts

### 2026-10-13 · este commit · `ignoredStyle` por aba
- **Local:** interface `DocTab` e `newTab`
- **Linha:** novo campo `ignoredStyle: Set<string>`, ao lado do `ignoredHere`, iniciado vazio
- **Porquê:** guardar, por documento, os avisos de estilo que a pessoa dispensou. Fica só na memória
  (como o `ignoredHere`), sem entrar na sessão salva.

## src/app/app.ts

### 2026-10-13 · este commit · ponte do "Ignorar neste texto"
- **Local:** junto dos outros ganchos do assistente (`this.editor.onIgnoreWord = ...`)
- **Linha:** nova linha `this.editor.onIgnoreStyle = (issue) => this.ignoreStyleIssue(issue);`
- **Porquê:** o popup é do editor, mas a lista de avisos e as abas ficam com o App; o gancho leva o
  aviso inteiro (e não só o texto) porque a chave do "ignorar" é mensagem + trecho.

## src/styles/slides.css

### 2026-10-14 · 4cfd23f · cores do diff no popup
- **Local:** depois de `.cm-issue-chip.ghost`
- **Linha:** novas regras `.cm-issue-rem` (cor `--danger` + riscado), `.cm-issue-add` (cor `--ok`,
  negrito) e `.cm-issue-seta` (a seta do "Trocar por")
- **Porquê:** as cores reusam os mesmos tokens do diff do histórico (`--ok`/`--danger`), então o
  vermelho/verde significam a mesma coisa nas duas telas e funcionam no tema claro e no escuro.

### 2026-10-13 · este commit · chip do aviso encurta com "…"
- **Local:** `.cm-issue-chip`
- **Linha:** `max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap`
- **Porquê:** o chip "Corrigir:" pode trazer um trecho longo; sem limite ele empurrava a largura do
  popup (máx. 440px). O `title` do chip guarda o texto completo para quem passar o mouse.

## docs/pesquisa-sugestoes-velocidade-tamanho.md

### 2026-10-13 · esta tarefa · sugestões sem IA: velocidade e sugestões longas (novo arquivo)
- **Local:** documento inteiro
- **Linha:** "novo arquivo"
- **Porquê:** o usuário relatou que a sugestão "começa lenta e pega velocidade" e que "fica em
  no máximo 3 palavras", pedindo pesquisa avançada sobre os dois pontos. O documento registra a
  linha de base **medida** (modelo de 6,92 MB com ~200–270 ms de aquecimento; plano B com 100%
  de 1 palavra; índice total de 31–77 ms na thread principal; `predictFromLine` p50 0,39 ms /
  p90 1,32 ms; largura média de **1,35 palavra**, só 9,2% chegando ao teto de 3), liga cada
  gargalo à constante/arquivo que o causa (`maxWords`, `chain`, `withPrefix`, `update()` total,
  `thresholdScale`) e reúne, com fontes, as técnicas sem IA para resolver (KenLM, Kneser-Ney,
  stupid backoff, DAWG/DAFSA, beam search com normalização de comprimento, tabela de frases,
  PPM, worker/WASM), terminando no plano por fases V0–V4 com critérios de aceite e o apêndice
  de reprodução das medições. É o recorte do **fantasma/sugestão**; o corretor continua em
  `docs/pesquisa-correcao-offline.md`.

## docs/paridade-deckcraft.md · docs/powerpoint.md

### 2026-10-13 · este commit · checklist de paridade revisado contra o código e o DeckCraft real
- **Local:** itens da checklist, tabela de resumo, seção nova "Mapa de edição" e "Próximos
  passos"; em `powerpoint.md`, a lista de abas da fita e a linha do modo apresentação
- **Linha:** 12 itens corrigidos (`[ ]` → `[x]` em Reset, Change shape e Save as template; notas
  de Transições, ocultar lâmina, marca-texto, sobrescrito/versalete, mudar caixa, ir para lâmina,
  tela B/W, largura de coluna "sem UI", mkv e F5 × botão Apresentar); resumo `99/191` →
  `102/191`; seção nova com as 14 áreas de edição e os ganhos rápidos; próximos passos reordenados
- **Porquê:** o checklist dizia que Transições, ocultar/redefinir lâmina, marca-texto e outros
  não existiam — todos existem no código. A varredura do **projeto DeckCraft real** (232 comandos
  de engine + 36 de UI, não só o checklist dele) mostrou o tamanho real das lacunas de edição e
  a ordem que faz sentido atacar; sem isso, a próxima tarefa seria escolhida no escuro.

## src/broker/spell/classeErro.ts

### 2026-10-13 · este commit · aprendizado por classe de erro (novo arquivo)
- **Local:** arquivo novo — `ClasseErro`, `PESOS_BASE`, `classificarErro`, `registrarClasse`,
  `pesoDaClasse`, `bonusDaClasse`, `resumoClasses`, `limparClasses`
- **Linha:** novo arquivo
- **Porquê:** o aprendizado por par exato ("estenso → extenso") demora: a mesma troca precisa
  aparecer duas vezes. A **classe** do erro (transposição, tecla vizinha no ABNT2, acento,
  dígrafo, falta de letra, letra a mais, troca simples) aparece em dezenas de palavras desde a
  primeira sessão — com contadores por classe, o corretor sobe a nota de um candidato da classe
  que a pessoa costuma aceitar mesmo sem conhecer o par. A classificação é pura (testável fora
  do navegador); os contadores vão para `localStorage` (`mdc.corretor.classes`) como
  `{ ok, nao }` por classe — só números, nada do documento.

## src/broker/aprendizado.ts

### 2026-10-13 · este commit · placar do par e recusa (desfazer/digitar por cima)
- **Local:** `Registro.n`, `PESO_DESFAZER`, `PESO_RECUSAR_SUGESTAO`, `PISO`, `ajustar`,
  `registrarCorrecao`, `registrarRecusaAoDesfazer`, `registrarRecusaDeSugestao`
- **Linha:** `n` era a contagem de aceites e só subia (`existente.n++` / `{ n: 1 }`) →
  passa a ser um **placar**: aceite soma 1, desfazer tira 2, recusar a sugestão tira 1, com
  piso −2; `registrarCorrecao` continua somando; entram as duas funções de recusa
- **Porquê:** quem recusava não ensinava nada — o app podia repetir para sempre uma troca que a
  pessoa desfez. Desfazer vale mais que ignorar (a troca chegou a ser aplicada). O piso evita
  que uma sequência de recusas torne o par irrecuperável (e a ordenação/descarte por placar
  mantém o teto de 3.000 pares).

### 2026-10-13 · este commit · veredito do Ctrl+Z para o que a varredura aplicou
- **Local:** `aplicadasAuto`, `marcarAplicadasAuto`, `limparAplicadasAuto`,
  `registrarDesfazerAplicadas`, `confiancaDoPar`, `totalAprendido`, `limparAprendizado`
- **Linha:** novo bloco em memória com as trocas da última correção automática; `totalAprendido`
  passa a contar os pares com placar ≥ 1; `limparAprendizado` também zera o veredito pendente e
  os contadores por classe
- **Porquê:** o Ctrl+Z de uma varredura já era detectado pelo ritmo (`personal/autofmt.ts`), mas
  ninguém sabia **quais** trocas a varredura havia aplicado. O bloco fica só em memória (nada do
  documento é gravado) e é preenchido pelo assistente; quando o texto volta ao estado anterior,
  cada par pendente vira recusa. `totalAprendido` deixa de contar pares que estão no vermelho.

### 2026-10-13 · este commit · cada decisão alimenta a classe de erro
- **Local:** imports e chamadas de `registrarClasse` em `registrarCorrecao`,
  `registrarRecusaAoDesfazer` e `registrarRecusaDeSugestao`
- **Linha:** novo (`registrarClasse(errado, certo, aceitou)` a cada decisão)
- **Porquê:** centraliza a decisão em um módulo só: quem chama não precisa lembrar de anotar a
  classe, e as três formas de decisão (aceitar, desfazer, recusar a sugestão) ficam contadas.

### 2026-10-13 · este commit · par vindo do texto fantasma
- **Local:** `registrarRecusaDeSugestao(palavra, contexto)`
- **Linha:** nova
- **Porquê:** a recusa de uma sugestão de **correção** do fantasma ("resultdo" → "resultado")
  nunca chegava ao aprendizado; agora ela desconta o par e a classe. `palavra` é a sugerida (o
  "certo"); `contexto` é o que estava escrito (o "errado") — a ordem combina com a do fantasma.

## src/broker/personal/autofmt.ts

### 2026-10-13 · este commit · `observarEdicao` informa se a varredura foi desfeita
- **Local:** `observarEdicao`
- **Linha:** `(): void` → `(): boolean` (devolve `true` só quando o texto volta ao de antes)
- **Porquê:** o ritmo já sabia reconhecer o Ctrl+Z da varredura; quem chama (`app/documents.ts`)
  agora usa essa resposta para também descontar o que a varredura havia aprendido.

## src/app/documents.ts

### 2026-10-13 · este commit · o Ctrl+Z da varredura desconta o aprendizado
- **Local:** `onDocChange`
- **Linha:** `if (temPendenteRitmo()) observarEdicao(...)` →
  `if (temPendenteRitmo() && observarEdicao(...)) registrarDesfazerAplicadas()`
- **Porquê:** era aqui que a recusa era conhecida e jogada fora. Um único ponto cobre o Ctrl+Z
  da varredura de pausa, do parágrafo concluído e do salvamento — sem mudar nada quando a
  edição é digitação normal (o texto não voltou ao de antes).

## src/app/assistant.ts

### 2026-10-13 · este commit · `applyFixes` sabe quando é automático
- **Local:** `applyFixes` (`automatico = false`), `autoFixWords`, `runIdleFix`,
  `autoFixFinishedParagraph`
- **Linha:** `applyFixes(issues)` → `applyFixes(issues, automatico)`; `autoFixWords` passa
  `true` e, depois de aplicar, chama `marcarAplicacao(antes)`; as varreduras de estilo limpam
  o pendente (`limparAplicadasAuto()`)
- **Porquê:** só a aplicação automática pode ser recusada com Ctrl+Z — a que a pessoa pediu
  ("Formatar texto", revisão) é aceite explícito e não entra no pendente. `marcarAplicacao`
  também nas trocas de palavra: sem um veredito aberto, o Ctrl+Z de uma correção de palavra
  não seria reconhecido (era o caso mais comum: a palavra é corrigida sozinha enquanto se
  digita).

## src/broker/ghost/suggestion.ts

### 2026-10-13 · este commit · par "o que estava escrito → o que o app propôs"
- **Local:** `parDaCorrecao`
- **Linha:** nova função
- **Porquê:** uma sugestão de correção do fantasma guarda só o texto proposto e quantas letras
  ela substitui; para aprender, é preciso o par inteiro. A função lê o que a sugestão
  substitui (do documento antes da mudança) e devolve `[errado, certo]` — a mesma forma usada
  pelo corretor.

## src/broker/ghost/field.ts

### 2026-10-13 · este commit · aceite e recusa da correção do fantasma (Markdown)
- **Local:** `recusarCorrecao`, `parDaCorrecaoNoDoc`; blocos de `tr.docChanged` e `clearGhostText`
- **Linha:** `if (o) rejected(o, false)` → seguido de `recusarCorrecao(...)`; `acceptGhostText`
  ganha `registrarCorrecao(par[0], par[1])`; Esc numa correção vira recusa explícita
- **Porquê:** quando o fantasma mostrava uma correção ("resultdo" → "resultado"), digitar por
  cima não ensinava nada e aceitar com Tab também não. Agora os dois caminhos alimentam o
  mesmo aprendizado do corretor (o par e a classe). A previsão de próxima palavra continua
  como antes: `rejected`/`accepted` sem par.

## src/word/ghost.ts

### 2026-10-13 · este commit · os mesmos ganchos no documento Word
- **Local:** `parDaCorrecaoDoc`, `recusarCorrecao`, `accept` e o `apply` do plugin
- **Linha:** novos ganchos de aceite (`registrarCorrecao`) e recusa
  (`registrarRecusaDeSugestao`) sobre o par lido de `tr.before`/`view.state.doc`
- **Porquê:** o fantasma do Word é o mesmo preditor do Markdown; sem isso, o aprendizado
  dependeria do editor em que a pessoa está.

## src/broker/personal/rerank.ts

### 2026-10-13 · este commit · classe do erro como desempate fino
- **Local:** `rerankSuggestions`
- **Linha:** `ev = suggestions.map((s) => evidence(...))` → `evidence(...) + bonusDaClasse(errado, s)`
- **Porquê:** o reordenamento por contexto só troca a primeira sugestão com evidência clara
  (≥ 0,03 e 2× a original); a classe entra com no máximo ±0,03 e **zero** para quem ainda não
  tem histórico — ou seja, ninguém muda de comportamento antes de aceitar/recusar alguma coisa,
  e depois o corretor já reconhece o tipo de erro mesmo sem conhecer o par exato.

## scripts/testar-correcao.mjs

### 2026-10-13 · este commit · casos de recusa e de classe
- **Local:** novas seções "aprendizado com recusas" e "classes de erro"; no ritmo, o retorno de
  `observarEdicao`
- **Linha:** novos `ok(...)` (com `localStorage` de mentira para conferir o que seria gravado)
- **Porquê:** o comportamento novo é invisível na tela; sem os casos, uma regressão no placar
  (desfazer que não desconta, confiança que não volta a sugestão) passaria despercebida.

## src/broker/spell.worker.ts

### 2026-10-13 · (este commit) · acento decidido pelo uso
- **Local:** `contagensExatas` (novo, montado em `prepararIndice`), `ACENTOS`, `USO_REAL`,
  `VANTAGEM`, `PISO_ACENTO` e `acentoMaisUsado` (novos) e o ramo do dicionário no `check`
- **Linha:** no ramo que já perguntava por colagem, entra antes:
  `const comAcento = acentoMaisUsado(word)` → `hits.push({ word, duvida: true, suggestions: [comAcento] })`
- **Porquê:** "ira" (raiva) e "irá" (verbo ir) são as DUAS palavras de verdade — o dicionário
  aceita as duas, então o corretor não tinha o que acusar, e quem escreveu "ira" pensando em
  "irá" ficava sem aviso (relatado assim). Quem decide é o USO: em texto escrito, "ira" não
  aparece (0) e "irá" aparece 1794 vezes. As medidas são as mesmas que o `neighbor.ts` já usa
  para "você quis dizer…" (`USO_REAL` 20, `VANTAGEM` 20×, piso 50) — a forma escrita tem de ser
  rara, a acentuada tem de ser muito mais usada e existir no dicionário.
- **Local:** `contagensExatas` (mapa palavra → usos, COM acento)
- **Linha:** novo — `contagensExatas.set(w.toLowerCase(), contagens[i] ?? 0)`
- **Porquê:** a tabela que o worker já recebia é normalizada em outros pontos (`POSICAO` usa
  `norm`, que tira acento) e por isso não serve para comparar "ira" com "irá": as duas caem na
  mesma chave. A contagem exata vem dos dados crus (`f.w`/`f.n`), que têm o acento.
- **Local:** o hit do acento
- **Linha:** `duvida: true` sem `best`
- **Porquê:** pergunta, não decisão — o acento troca o sentido ("esta"/"está", "pais"/"país") e
  quem escreveu é quem sabe. Com `duvida` o `check.ts` põe `fix` (aparece na revisão, vale no
  "corrigir tudo") e não põe `auto` (a varredura automática não encosta).

## src/broker/check.ts

### 2026-10-13 · (este commit) · a mensagem do acento
- **Local:** a mensagem do `issues.push` no ramo de ortografia
- **Linha:** um terceiro caso: `hit.duvida` (sem `glued`) → `“X” existe, mas em texto escrito
  quase sempre é “Y” — faltou o acento?`
- **Porquê:** a mensagem da colagem ("faltou um espaço") mentiria aqui: a palavra não está
  partida em duas, é a MESMA palavra sem o acento. Cada aviso precisa dizer o que fazer.

## test/docs/gramatical.md

### 2026-10-13 · (este commit) · caso 33 e o encadeamento do 31
- **Local:** `## Caso 33` (novo) e o `### Esperado` do caso 31
- **Linha:** caso novo — "O time ira viajar amanha de manha." → "O time irá viajar amanhã de
  manhã."; e o caso 31 passou a esperar "e o **irá** verifica" (era "o ira")
- **Porquê:** o caso 31 mostra o encadeamento completo do que foi relatado: primeiro a colagem
  ("oira" → "o ira"), depois o acento pelo uso ("ira" → "irá") — o `corrigir` do runner roda em
  rodadas, então a segunda correção vem na rodada seguinte.

### 2026-10-13 · calibragem do limiar · dominância de uso no lugar do fator escondido
- **Local:** o bloco do `certo`, em `sugerirPalavra`
- **Linha:** `muitoMaisFrequente = distancia === 2 && c1 >= 10 * max(c2, 1)` →
  `dominaFrequencia = c1 > 0 && c1 >= 5 * max(c2, 1)` (sem condição de distância)
- **Porquê:** a decisão por probabilidade (tarefa anterior) apertou o auto-aplicar e deixou
  **"atensao" → "atenção"** cair para sugestão — o `testar-correcoes.mts` acusou (31/32). Medido no
  corpus: "atenção" 1.896 contra "tensão" 242 = **7,8×**, e os dois com a MESMA distância (1, depois
  de normalizar acento), então nem o fator antigo (10×, só a duas edições) nem o vencedor-por-
  distância pegavam. Com 5× e sem exigir distância 2, o caso claro volta a ser corrigido sozinho e
  os pares equilibrados continuam indo para a decisão por margem. Corpus de volta a **32/32 casos
  corrigidos e 32/32 textos corretos preservados**.

## src/broker/spell/decisao.ts

### 2026-10-13 · calibragem do limiar · veredito da auto-aplicação e memória
- **Local:** `ler`/`gravar`, `calibragem`, `registrarAplicacaoAuto`, `registrarMantidaSePendente`,
  `registrarDesfeitaSePendente`, `limparCalibragem`
- **Linha:** `ler()`/`gravar()` passam a usar uma **memória do módulo** quando não há
  `localStorage`; novos: o veredito pendente (`pendenteAuto`) e o leitor `calibragem()`
- **Porquê:** o limiar adaptativo existia, mas ninguém o alimentava — e, sem `localStorage`
  (modo privado, testes), a calibragem simplesmente não existia. Agora a auto-aplicação abre um
  veredito e ele fecha como **mantida** (outra varredura começou sem desfazer) ou **desfeita**
  (Ctrl+Z), contando **uma vez por leva**; a memória garante que a conta funcione em qualquer
  ambiente, e `calibragem()` existe para diagnóstico e testes.

## src/app/assistant.ts

### 2026-10-13 · calibragem do limiar · os dois pontos de "mantida"
- **Local:** `runIdleFix` (varredura sem troca de palavras) e `applyFixes` (leva automática)
- **Linha:** `limparAplicadasAuto();` → `limparAplicadasAuto(); registrarMantidaSePendente();
  enviarLimiar();` e `marcarAplicadasAuto(pares)` → `registrarMantidaSePendente();
  registrarAplicacaoAuto(); marcarAplicadasAuto(pares); enviarLimiar();`
- **Porquê:** é exatamente o que o `aprendizado.ts` já define como "ficou de pé": uma varredura
  nova que não desfaz a anterior prova que a anterior sobreviveu. Fechar o veredito nesses dois
  pontos dá o sinal de "mantida" sem inventar um temporizador novo; o `enviarLimiar()` leva o
  limiar recém-calculado ao worker na hora.

## src/app/documents.ts

### 2026-10-13 · calibragem do limiar · o Ctrl+Z fecha o veredito
- **Local:** `onDocChange`, no gancho que já detectava o desfazer da varredura
- **Linha:** `if (…) registrarDesfazerAplicadas();` → bloco com `registrarDesfazerAplicadas();
  registrarDesfeitaSePendente(); enviarLimiar();`
- **Porquê:** o mesmo Ctrl+Z que desconta o aprendizado é o sinal mais forte de que a
  auto-aplicação errou — é ele que deve subir o limiar (menos auto-aplicações dali em diante).

## scripts/testar-correcao.mjs

### 2026-10-13 · calibragem do limiar · 6 verificações
- **Local:** fim do bloco "contexto e decisão"
- **Linha:** `novo`
- **Porquê:** cobre o veredito contando uma vez por leva, o desfazer como "ruim", o limiar subindo
  com muitas desfeitas (0,85) e descendo com muitas mantidas (0,59), e o zero voltando ao padrão.

## index.html · src/styles/editor.css · src/app/layout.ts · scripts/testar-layout.mts

### 2026-10-14 · (este commit) · puxar a pré-visualização de volta pela borda direita
- **Local:** `index.html`, último item do `#body`
- **Linha:** novo — `<div id="preview-puxa" title="…">` depois do `</section>` da prévia
- **Porquê:** a alça é o gesto de volta. Fica como ÚLTIMO item do `#body` de propósito: ocupa uma
  faixa própria de 8px na direita e por isso não cai em cima da barra de rolagem do editor (que
  vive nos últimos 10px do painel).
- **Local:** `src/styles/editor.css`, bloco novo depois de `body.no-preview`
- **Linha:** `novo` — `#preview-puxa` (`display: none`, `flex: none`, `width: 8px`,
  `align-self: stretch`, `cursor: col-resize`), `body.no-preview #preview-puxa { display: block }`,
  `#preview-puxa::after` e o hover em `var(--accent)`
- **Porquê:** nasce escondida e só aparece com a prévia fechada — com a prévia aberta ela estaria
  sobre a barra de rolagem. A linha fina do hover é a mesma do divisor: um gesto invisível não
  tem como se anunciar. O `z-index: 2` acompanha o divisor.
- **Local:** `src/styles/word.css`, `excel.css`, `powerpoint.css`, `settings.css`, `home.css` e
  `palette.css`
- **Linha:** `#preview-puxa` somado às regras que já escondem `#splitter` e `#preview-wrap`
- **Porquê:** com a prévia fechada e uma planilha (ou o Início, ou o modo foco) aberta, a alça
  apareceria numa tela onde não existe prévia. O `editor.css` vem antes de todos esses no
  `styles.css`, então as regras deles vencem sem precisar de `!important` novo.
- **Local:** `src/app/layout.ts`, `setupSplitter` (depois do `dblclick` do divisor)
- **Linha:** `novo` — `pointerdown` na alça, `aoMoverPuxa` e `aoSoltarPuxa` na janela, mais o texto
  do aviso ao fechar
- **Porquê:** três decisões que parecem detalhe e não são. (1) O `pointerdown` remove o
  `no-preview` na hora, no tamanho em que a prévia estava: quem só quer trazê-la de volta clica e
  pronto. (2) O arrasto é medido pelo DESLOCAMENTO do dedo e não pela posição: a alça fica na
  beirada, e ler a posição faria a prévia pular para o mínimo no primeiro movimento — o contrário
  de puxar. (3) Quem escuta `pointermove`/`pointerup` é a JANELA, não a alça: no instante em que a
  prévia volta a alça sai da tela (o `display: none` do CSS) e não receberia mais nada. A largura
  final é guardada no mesmo `mdc.split` do divisor.
- **Local:** `scripts/testar-layout.mts`, bloco novo "puxar a pré-visualização de volta"
- **Linha:** 15 verificações
- **Porquê:** a alça é CSS + estrutura + um gesto; o teste prende as três. As que mais protegem
  são as que garantem que ela NÃO existe fora do `no-preview` (senão volta a brigar com a barra
  de rolagem) e que os seis painéis a escondem.

## src/broker/style/limpeza.ts

### 2026-10-14 · reticências são três pontos · a regra nova no `duplicatedPunct`
- **Local:** `duplicatedPunct`
- **Linha:** bloco novo — `const quatroPontos = /(?<![\d.])\.{4}(?![\d.])/gu;` com
  `push(…, "Reticências são três pontos — fica só “...”", "...", [], false)`; o comentário do “..”
  deixou de dizer que “....” é intencional
- **Porquê:** o corretor tratava o “....” como reticência intencional e deixava passar — o usuário
  reportou que o certo são três pontos. Quatro pontos exatos viram “...”, com as mesmas guardas de
  dígito do “..” (não encostam em número). Runs maiores (“.....”, “..........”) ficam de fora: são
  separadores/linhas pontilhadas de propósito, e a regra não arrisca.

## scripts/testar-correcao.mjs

### 2026-10-14 · reticências são três pontos · 3 verificações novas
- **Local:** bloco "ponto final", depois de "reticências ficam intactas"
- **Linha:** `novo` — quatro pontos no fim (“Esperando....”), no meio (“Ele pensou.... O plano
  mudou.”) e a linha pontilhada longa que fica (“Introdução..... 5”)
- **Porquê:** cobre o caso relatado, o meio da frase e a decisão de deixar o separador longo
  intacto — se a regra for apertada depois, o teste do separador mostra o que muda.

## test/docs/gramatical.md

### 2026-10-14 · reticências são três pontos · caso 34
- **Local:** `## Caso 34` (novo)
- **Linha:** caso novo — “A pesquisa continua....” → “A pesquisa continua...”
- **Porquê:** o corpus roda o pipeline real (`checkText`) e exige as duas pontas: o “....” vira
  “...” e o “...” de verdade não é tocado (texto correto preservado).

## docs/md.md

### 2026-10-14 · reticências são três pontos · a menção na correção automática
- **Local:** “Escrita assistida” → bala “**Correção automática**”
- **Linha:** `pontuação repetida e abreviações` → `pontuação repetida (inclusive “....” → “...”:
  reticências são três pontos) e abreviações`
- **Porquê:** o documento do módulo descreve o que entra sozinho na pausa; a regra nova é uma
  correção automática e precisa aparecer ali.

## src/md/diffTroca.ts

### 2026-10-14 · 4cfd23f · diff da troca (novo arquivo)
- **Local:** `diffDaTroca` (miolo comum/sai/entra) e `partesDaTroca` (partes prontas para exibir)
- **Linha:** novo arquivo
- **Porquê:** o popup precisa colorir só o que muda. O diff mínimo evita repetir a palavra inteira
  ("pronto" → "pronto." colore só o ponto); quando os DOIS lados mudam, a exibição mostra os
  trechos inteiros — repetir só o miolo leria como "responsavoável". Lógica pura, testável fora do
  editor (que depende do DOM).

## scripts/testar-diff-troca.mjs

### 2026-10-14 · 4cfd23f · teste do diff (novo arquivo)
- **Local:** arquivo inteiro (9 verificações de exibição + 3 do diff mínimo)
- **Linha:** novo (`npm run test:diff`)
- **Porquê:** cobre os casos reais das regras — ponto final, palavra trocada, inserção/remoção puras,
  vírgula antes de "mas", expressão intercalada, pontuação duplicada e maiúscula no começo.

## src/broker/abnt/ (novo) · src/broker/normalizar.ts (novo) · src/broker/check.ts · src/broker/style/abnt.ts

### 2026-10-14 · (este commit) · as regras ABNT viram dado
- **Local:** `src/broker/abnt/` (`esquema.ts`, `lint.ts`, `interpretador.ts`, `toml.ts`,
  `index.ts`, `regras/*.toml`, `perfis/abnt.toml`)
- **Linha:** `novo` — as dez regras de `style/abnt.ts` passam a viver em TOML
- **Porquê:** as dez funções não tinham **id estável** (não dava para citar uma regra num
  relatório), não sabiam de **versão de norma** (a NBR 14724 de 2024 substituiu a de 2011, a
  6023 tem edição de 2025, e as instituições migram em ritmos diferentes) e não aceitavam
  **perfil institucional** — o que UFAPE e UNIFESP divergem estava em código, se é que estava.
  O TOML fecha os três e mantém o comportamento: o teste de ouro exige aviso idêntico.
- **Local:** `esquema.ts`, `CLASSES` e `PREDICADOS`
- **Linha:** `novo` — vocabulário FECHADO
- **Porquê:** `\d`, `\s`, `\w` e `\b` significam coisas diferentes em cada motor (ASCII no
  JavaScript com a flag `u`, Unicode no `regex` do Rust). Em vez de documentar a divergência,
  o schema a torna impossível: o TOML só aceita as classes da tabela (`<<espaco>>`, `<<digito>>`)
  e os predicados de borda. `espaco` é o `\s` do JavaScript **code point a code point** — e é
  um teste gerado que o confere contra `/\s/u`, não a memória de quem escreveu (a primeira
  versão esqueceu `\u000B`, a tabulação vertical).
- **Local:** `lint.ts`, `conferirRegra` e `varrerPadrao`
- **Linha:** `novo` — recusa na carga
- **Porquê:** as afirmações do schema não podem viver em prosa. Três vezes nesta tarefa a
  especificação contradisse a si mesma (`{hs}` de um grupo não capturante, `[espaco]` que é
  regex válida, `\u000B` faltando) e as três foram pegas por leitura humana. O lint vira
  máquina: escapes recusados lidos um a um (não por busca do texto `\b`, que daria falso
  positivo em `\\b` e em `[\b]`), `{nome}` que precisa ser grupo nomeado, `<<nome>>` que
  precisa existir, classe só dentro de colchetes, lista só fora.
- **Local:** `interpretador.ts`, `regraDeToml`
- **Linha:** `novo` — e três decisões que não são detalhe
- **Porquê:** (1) o **match é só o trecho**; as bordas são predicados, porque um grupo de
  contexto consumido apareceria no span e faria o vizinho sumir — em "14hs 15hs" o primeiro
  match comeria o espaço e o segundo perderia o caractere de que precisa. (2) **ao descartar,
  a busca retoma um caractere depois do INÍCIO do descartado**, nunca depois do fim: retomar
  pelo fim pularia um match válido que se sobrepõe ao rejeitado. (3) **a troca acontece sobre
  o trecho**, não sobre o match inteiro.
- **Local:** `toml.ts`
- **Linha:** `novo` — leitor do subconjunto
- **Porquê:** não há parser de TOML no projeto e o `node_modules` das worktrees é *junction*:
  trazer uma dependência nova quebraria as outras worktrees até a cópia principal instalar.
  O subconjunto (texto literal e básico, booleano, número, tabela em linha, seção `[a.b]`) é
  pequeno e fechado, e o que ele não aceita ele recusa com a linha. Se o formato crescer
  (arrays de tabelas, datas), trocar por um parser de verdade em vez de estender este.
- **Local:** `index.ts`, `aplicarPerfil`
- **Linha:** `novo` — `off` tira a regra, `soft` rebaixa para sugestão sem automático, `hard` sobe para erro
- **Porquê:** é onde a divergência entre instituições deixa de ser código.

### 2026-10-14 · (este commit) · normalizar antes de mascarar
- **Local:** `src/broker/normalizar.ts` (novo) e `src/broker/check.ts`, `checkText`
- **Linha:** `novo` — `text` passa a ser `normalizarTexto(bruto).texto`, e os avisos voltam com
  `paraOriginal(...)` antes de sair
- **Porquê:** texto colado do macOS e de PDF vem em **NFD**: o "Á" é "A" mais uma marca solta, a
  marca não é `\p{L}`, e a classe literal `[A-ZÁÉÍÓÚ]` da regra das siglas não casa — o aviso
  saía deslocado e a troca **apagava a letra acentuada**. A normalização é conserto, não seguro
  de portabilidade. A ordem (normalizar → mapa → mascarar → regras → spans de volta) é
  obrigatória por dois motivos: a máscara depende de "mesmo comprimento", que a normalização
  acabou de mudar, e precisa ser construída sobre o texto que as regras vão ver. O span que
  sai está sempre em **índice de caractere do texto original** — o editor conta em UTF-16 e o
  Rust em byte UTF-8, então cada borda converte.
- **Local:** `src/broker/style/abnt.ts`
- **Linha:** deixou de ser registrado em `style/index.ts`; o arquivo fica marcado como
  **referência do teste de ouro** e nada mais o importa (sai do pacote por tree-shaking)
- **Porquê:** as regras em TOML precisam ser comparadas contra o comportamento ANTERIOR. Sem a
  referência, o teste de ouro viraria "TOML contra TOML".

### 2026-10-14 · (este commit) · o teste e a medição
- **Local:** `scripts/testar-regras-abnt.mts` (novo) e `package.json` (`test:abnt`)
- **Linha:** `novo` — quatro partes: classes geradas, lint, teste de ouro e as famílias 5 e 6
- **Porquê:** as classes são conferidas **code point a code point** (0 a 0x10FFFF) contra
  `/\s/u`, `/\d/u` e `/\w/u`; para os predicados sobre `\p{L}` o teste diz no próprio nome do
  caso que é **circular** (confere o complemento e a borda, não a escolha da classe), para
  ninguém ler mais do que ele prova. O lint é testado pelos dois lados: as dez passam e dez
  exemplos quebrados de propósito são recusados. O teste de ouro compara aviso por aviso, em 30
  textos, contra as dez funções antigas. As famílias 5 e 6 (NFD e CRLF) são do pipeline e
  mostram o estrago que a falta de normalização fazia. E a medição que fica: **1,8 ms** para as
  dez regras sobre 57 mil caracteres — se as 41 regras subirem muito esse número, é ele que
  reabre a questão.
- **Local:** `scripts/testar-correcoes.mts`
- **Linha:** `novo` — plugin `?raw` no empacotamento (nos dois `build()`, não só no primeiro)
- **Porquê:** as regras entram no pacote como texto, do mesmo jeito que no app. O primeiro
  `build()` já tinha o plugin e o segundo não: o erro aparecia só na parte do aprendizado.

## src/broker/spell/teclado.ts (novo)

### 2026-10-13 · confusões e teclado · vizinhança do ABNT2
- **Local:** arquivo inteiro (`FILEIRAS`, `VIZINHAS`, `saoVizinhas`, `custoDeTecla`)
- **Linha:** `novo`
- **Porquê:** errar para a tecla do lado ("obrigdao" por "obrigado") custava o mesmo que trocar uma
  letra por qualquer outra. A grade de 3×3 em volta de cada tecla dá metade do custo para vizinhas
  (diagonais incluídas); a mesma tecla custa zero. As fileiras são tratadas alinhadas — é uma
  aproximação, e o comentário diz isso.

## src/broker/spell/confusoes.ts (novo)

### 2026-10-13 · confusões e teclado · as confusões do português com custo
- **Local:** `PARES`/`CUSTO_DO_PAR`, `custoDeTroca`, `distanciaPonderada`, `PARES_DE_LETRAS`,
  `DOBRAS`, `variantesDeConfusao`
- **Linha:** `novo`
- **Porquê:** a distância de edição tratava c↔ç, s↔z, g↔j, m↔n, "h" mudo e letra dobrada como
  "qualquer troca". Agora cada classe tem custo (0,3-0,5), a inversão de vizinhas custa 0,5 e a
  distância vira ponderada (Damerau-Levenshtein com custos). As **variantes** (ss↔ç, ch↔x, dobradas,
  um por vez) são procuradas direto no vocabulário — e, como a busca é pela forma normalizada, a
  troca de par e a de acento se compõem ("excessao" → "exceçao" casa com "exceção").

## src/broker/spell/candidatos.ts

### 2026-10-13 · confusões e teclado · custo ponderado e busca das variantes
- **Local:** `Indice` (novo `porNormalizada`), `construirIndice` e `candidatos`
- **Linha:** a coleta virou um `Map` por forma normalizada (fica a melhor nota); a nota usa
  `distanciaPonderada` no lugar de `distancia`; novo passo que procura as variantes de confusão em
  `porNormalizada` (custo ≤ `maxDist + 0,6`, arredondado ao teto do índice)
- **Porquê:** o índice de trigramas aproxima pelo miolo da palavra; as confusões precisam de uma
  segunda porta de entrada (a grafia provável), e o custo ponderado faz o candidato certo subir
  quando a diferença é uma confusão conhecida. O dedupe por forma normalizada evita o mesmo
  candidato aparecer duas vezes com notas diferentes.

## scripts/testar-correcao.mjs

### 2026-10-13 · confusões e teclado · 9 verificações
- **Local:** bloco "confusões e teclado"
- **Linha:** `novo`
- **Porquê:** o teclado (vizinha = metade, mesma tecla = zero), o custo por classe, a distância
  ponderada (classe, h mudo, dobra, inversão e troca sem relação) e as variantes (pares trocados,
  limite de explosão).

## scripts/avaliar-correcao.mts

### 2026-10-14 · F0 da pesquisa de correção · harness de medição (novo arquivo)
- **Local:** arquivo inteiro — conjuntos (real, sintético por classe, corretos), métricas por
  conjunto/classe, payload do worker, `--json` / `--classe` / `--seed` / `--detalhe`
- **Linha:** novo (`node scripts/avaliar-correcao.mts`)
- **Porquê:** o F0 de `docs/pesquisa-correcao-offline.md` é "medir antes de mexer": sem linha de
  base, qualquer mudança do F1/F2 seria achismo. O harness reaproveita o ambiente do navegador de
  `scripts/testar-correcoes.mts` (worker do dicionário, `fetch`, `localStorage`) para rodar o
  **mesmo** `checkText` do editor, então o que é medido é o comportamento do app — e nada em
  `src/broker/**` precisou mudar: é instrumento, não comportamento. Sai sempre com código 0 (não
  é teste). Os erros por classe são injetados em parágrafos de `docs/*.md` (o texto original vira
  gabarito), mas só em palavras que o corretor **não** acusa e fora de trechos mascarados
  (`maskNonProse`), para o erro medido ser exatamente o injetado; uma consulta em lote ao
  dicionário separa o erro visível do erro de palavra real (matéria do F3), e os falsos positivos
  são medidos no resto do texto corrompido, uma vez por parágrafo. `docs/medicao-*.md` ficam fora
  do corpus: são instrumento, e se entrassem a linha de base mudaria a cada fase.

## docs/medicao-corretor.md

### 2026-10-14 · 120cc9e · linha de base do corretor (novo arquivo)
- **Local:** arquivo inteiro (como rodar, conjuntos e colunas, tabelas, piores casos, leitura)
- **Linha:** novo
- **Porquê:** registrar o "antes" com commit, data e semente — é a régua das fases F1–F4 e o que
  o critério de bloqueio da pesquisa compara (piorar FP/1000 ou a precisão das auto-aplicações não
  fecha). Os números que interessam às próximas fases: detecção 97% com r@1 76% e r@3 85% (o
  gargalo é o ranking, não a detecção), x↔ch como pior classe (r@1 33% e 10 das 24
  auto-aplicações erradas), 3,25 falsos positivos por 1000 palavras todos do "você quis dizer"
  sobre palavra existente (o caminho da ortografia não gera ruído), 10,7% das auto-aplicações
  erradas e p95 de 0,152 ms/palavra com 7,5 MB no worker. O documento traz ainda a medição do
  mesmo conjunto no commit do rebase (`cdd1c84`), quando a `main` já tinha o corretor com
  confusões/teclado: r@1 80%, FP igual e p95 0,998 ms/palavra — e a nota de que um `.toml?raw`
  novo em `src/broker/abnt/` exige plugin de bundle em qualquer harness esbuild.

---

## src/broker/abnt/ (base nova) · scripts/abnt/ · docs/abnt-como-escrever-regras.md

### 2026-10-14 · (este commit) · contexto de documento, escopo de bloco e verificadores
- **Local:** `src/broker/abnt/esquema.ts`, `RegraToml`
- **Linha:** `novo` — `tipo` (`texto`/`estrutura`/`docx`), `escopo` (`texto`/`bloco`),
  `contexto.blocos`, `verifica`, `opcoes`; `regex` e `trecho` viraram opcionais e
  `substituir` também (regra de aviso)
- **Porquê:** as 31 regras restantes do catálogo (E, C, R, S, A, P, T) não são todas
  padrão de texto. "A lista de referências existe" e "o sumário bate com os títulos" só
  se respondem olhando o documento; e "complete os dados da referência" não sabe a troca —
  obrigar toda regra a ter `substituir` forçaria a inventar correção. O tipo e o escopo
  são declarados no TOML e o lint os confere na carga.
- **Local:** `src/broker/abnt/documento.ts` (novo)
- **Linha:** `novo` — `documentoDe(texto)`: linhas tipadas, parágrafos, seções, blocos
- **Porquê:** é a única fonte de "onde começa a seção de referências" e "o que é um
  parágrafo" — sem ela, cada regra reinventa a leitura e duas regras discordam. A leitura
  é do texto ORIGINAL (não da máscara: título mascarado deixaria de ser título) e tem
  cache de uma entrada, como o `checkStyle`. O `\r` do CRLF fica fora da faixa da linha
  (o app normaliza antes, mas o modelo não depende disso para estar certo). `BLOCOS` e
  `normalizarTitulo` moram no esquema: o nome do bloco é vocabulário, e o lint o confere.
- **Local:** `src/broker/abnt/lint.ts`, `conferirRegra`
- **Linha:** `antes → depois`: campos comuns + ramo por tipo; `escopo = "bloco"` exige
  `contexto.blocos` conhecido; campo de regex em regra de estrutura é RECUSADO
- **Porquê:** a sintaxe continua fechada, agora incluindo o que cada tipo pode carregar —
  campo morto mente (uma `regex` numa regra de estrutura sugere que ela casa padrão, e
  não casa). A obrigação de `substituir` saiu pelo motivo acima.
- **Local:** `src/broker/abnt/interpretador.ts`, `regraDeToml`
- **Linha:** `antes → depois`: o match é filtrado pelos blocos do escopo; `tipo =
  "estrutura"` delega ao verificador e recorta faixa fora do texto; regra sem
  `substituir` acusa sem sugestão; aceita um registro injetado (para teste)
- **Porquê:** o filtro de bloco segue a mesma regra do descarte (retoma um caractere
  depois do INÍCIO quando está fora); o recorte de faixa evita span inválido no editor
  quando o verificador erra a conta; o registro injetado é o que permite testar o
  despacho do verificador sem escrever um verificador de mentira de verdade.
- **Local:** `src/broker/abnt/verificadores/` (novo)
- **Linha:** `novo` — contrato (`tipos.ts`), sete arquivos por grupo e o registro (`index.ts`)
- **Porquê:** o julgamento estrutural é código, mas é código DECLARADO: um mapa
  `nome → função`, um arquivo por grupo (dois trabalhos em paralelo não brigam pelo mesmo
  arquivo) e o registro que agrega. Verificador desconhecido derruba a carga com a lista
  dos conhecidos. As opções do TOML entram por `opcaoTexto`/`opcaoLista`/`opcaoNumero`,
  que reclamam quando falta — em vez de `undefined` circulando.
- **Local:** `scripts/abnt/ferramentas.mts` (novo), `scripts/testar-abnt-contexto.mts`
  (novo) e `scripts/testar-regras-abnt.mts`
- **Linha:** `novo` e `antes → depois`: a recusa "sem substituir e sem transformar" saiu;
  entraram as recusas de escopo/tipo
- **Porquê:** o ajudante concentra o empacotamento com o plugin `?raw` (que já falhou por
  estar duplicado em dois `build()`) e deixa o teste de cada grupo ser só os casos. O teste
  da base confere escopo de bloco, regra de aviso, despacho de verificador, recorte de
  faixa e o modelo do documento — antes de qualquer regra nova depender disso.
- **Local:** `docs/abnt-como-escrever-regras.md` (novo)
- **Porquê:** o contrato em prosa, com os dois lados de cada teste e o que o lint recusa.
  É o que permite mais de uma pessoa (ou agente) escrever regra sem inventar dialeto.
## src/dialogoTexto.ts

### 2026-10-14 · esta tarefa · diálogo de texto do app (novo arquivo)
- **Local:** arquivo inteiro: `pedirTexto` (Promise) sobre o modal do app
- **Linha:** novo arquivo
- **Porquê:** o “Novo modelo” do PowerPoint usava `window.prompt` — a janela nativa do WebView
  (“localhost:1420 diz…”) não segue o tema, não tem o desenho do app e congela a janela. O
  componente reaproveita `modal-backdrop`/`modal` + `wm-head`/`wm-body`/`wm-foot` + `st-field`
  (mesma base dos outros diálogos), devolve o valor por Promise e cancela com **Esc**, botão ou
  clique fora. O `validar` opcional mostra o erro na própria janela (a mensagem some ao digitar).
  Textos de fora entram por `textContent`, nunca como HTML.

## src/styles/modals.css

### 2026-10-14 · esta tarefa · desenho do diálogo de texto
- **Local:** bloco novo no fim (`modal.dialogo-texto`, `.dg-erro`)
- **Linha:** `.modal.dialogo-texto { width: min(460px, 92vw); height: auto }` + respiro do
  `wm-body` + `.dg-erro` (vermelho do app)
- **Porquê:** o `.modal` base nasce grande (95vw × 92vh) para os editores; um diálogo de uma
  linha precisa de largura de leitura e altura mínima, sem “barriga”.

## src/powerpoint/ui/modelos.ts

### 2026-10-14 · esta tarefa · “Novo modelo” sem janela do sistema
- **Local:** handler `[data-criar]` da galeria do botão Template
- **Linha:** `const nome = window.prompt("Nome do novo modelo:", "Meu modelo")` → chamada a
  `pedirTexto({ titulo, rotulo, dica, valor })` (assíncrona)
- **Porquê:** é o caso do print do usuário. Como o diálogo é do app, a galeria fecha antes
  (`fecharPopup()` — os cliques no modal não podem contar como “fora do popup”) e **reabre
  depois** (`abrirModelos` de novo, se a âncora ainda está na fita) para a pessoa ver o cartão
  recém-criado na hora.

## src/powerpoint/powerpoint.ts

### 2026-10-14 · esta tarefa · renomear lâmina com o diálogo do app
- **Local:** `case "slide-nome"` (menu da lâmina)
- **Linha:** `window.prompt(...)` → `pedirTexto(...)` dentro de uma IIFE assíncrona
- **Porquê:** mesmo problema do “Novo modelo”. O `case` é síncrono (a cadeia de menus do app
  continua), então o fluxo virou `void (async () => { … })()` e, depois do `await`, compara com
  `this.atual()` (e não com o `sl` capturado) antes de aplicar a troca.

## src/powerpoint/presenter.ts

### 2026-10-14 · esta tarefa · avisos do F5 viram toast
- **Local:** `openDeckView` (as duas saídas de aviso)
- **Linha:** `alert("Este documento não tem conteúdo…")` e `alert("Todas as lâminas estão
  ocultas…")` → `toast(mensagem, "info", 5600)`
- **Porquê:** `alert` nativo congela a janela e foge do desenho do app; o toast é o canal de
  aviso do próprio sistema (mesmo texto, sem `\n\n` — o toast quebra sozinho).

## src/word/ribbon.ts

### 2026-10-14 · esta tarefa · aviso de voz vira toast
- **Local:** `startDictation` (quando o Web Speech API não existe)
- **Linha:** `alert("O reconhecimento de voz…")` → `toast(mensagem, "info", 5600)`
- **Porquê:** mesmo caso: é aviso, não decisão; o toast não interrompe o fluxo e respeita o tema.

## src/excel/host.ts

### 2026-10-14 · esta tarefa · fora o renomear de aba com prompt (código morto)
- **Local:** método `renomearAba(i)` (particular)
- **Linha:** método inteiro removido (usava `window.prompt` e `renomearFolha`)
- **Porquê:** ninguém o chamava — a renomeação acontece na tela (`renomearAbaNaTela`, no duplo
  clique da aba e no menu de contexto botão direito) desde que essa versão entrou. Era o último
  `window.prompt` do app fora dos diálogos que esta tarefa trocou.

---

## Próximos registros

Este documento foi **semeado** com as mudanças mais recentes (até 2026-10-13). A partir daqui,
cada tarefa registra as próprias entradas ao ser fechada — e pode reescrever/consolidar as
antigas quando fizer sentido.
