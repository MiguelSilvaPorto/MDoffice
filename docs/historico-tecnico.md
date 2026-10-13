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

## src/settingsPage.ts

### 2026-10-13 · e392858 · atalho novo na lista
- **Local:** lista `SHORTCUTS`
- **Linha:** nova linha `["Ctrl+F1", "Recolher/expandir a faixa de opções"]`
- **Porquê:** documentar o atalho criado junto com o recolher da fita.

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

---

## Próximos registros

Este documento foi **semeado** com as mudanças mais recentes (até 2026-10-13). A partir daqui,
cada tarefa registra as próprias entradas ao ser fechada — e pode reescrever/consolidar as
antigas quando fizer sentido.
