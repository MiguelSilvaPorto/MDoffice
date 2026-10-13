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

---

## Próximos registros

Este documento foi **semeado** com as mudanças mais recentes (até 2026-10-13). A partir daqui,
cada tarefa registra as próprias entradas ao ser fechada — e pode reescrever/consolidar as
antigas quando fizer sentido.
