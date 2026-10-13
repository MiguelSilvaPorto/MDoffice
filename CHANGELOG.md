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

- (nada no momento)

### Adicionado (na main)

**Backend**

- (nada específico do módulo — arquivos, imagens e rascunhos passam pelos comandos do **Geral**)

**Frontend**

- Editor CodeMirror 6 com realce de sintaxe e pré-visualização ao vivo lado a lado.
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

---

## Geral

### Não adicionado (fora da main)

**Backend**

- (nada no momento)

**Frontend**

- **Salvamento automático com feedback imediato e caminho do arquivo**: enquanto o documento é editado ou gravado, o badge exibe "Salvando…" com ícone de nuvem pulsando; assim que o salvamento é concluído, o badge volta para "Salvo" e exibe logo à sua direita o caminho da pasta/arquivo salvo com botão de atalho para abrir/revelar no explorador de arquivos.

**Ferramentas (dev)**

- (nada no momento)

### Adicionado (na main)

**Backend**

- Comandos Rust/Tauri: **arquivos** (abrir/salvar), **assets** (copiar imagens com nome limpo),
  **rascunhos**, **projetos** (árvore), **busca** no conteúdo, **pacote IA** (.zip) e **backup**.
- Testes dos comandos (`commands/tests.rs`).
- Tauri com o recurso **`image-png`** e a permissão **`core:window:allow-set-icon`**, para o app
  trocar o ícone da janela em tempo de execução.
- `Cargo.lock` sincronizado com a feature **`image-png`** (crates `image`, `png`, `byteorder-lite`,
  `moxcms`), validado com `cargo check --locked`.

**Frontend**

- **Abas estilo Chrome**: `Ctrl+T`/`Ctrl+W`/`Ctrl+Tab`/`Ctrl+1…9`, reabrir a última fechada,
  arrastar para reordenar, menu de contexto; fechar nunca pergunta (vira rascunho em Recentes);
  fechar o **último documento** volta para a tela de Início.
- **Documentação do projeto renovada**: README com a história (mdEditor → mdOffice) e o crédito
  à ArtCraft, licença **MIT**, docs de [estrutura](docs/estrutura-do-projeto.md) e
  [funcionalidades por módulo](docs/funcionalidades.md), e este **changelog + o
  [histórico técnico](docs/historico-tecnico.md)** (entregues neste mesmo commit).
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
- **Barra lateral com movimento de verdade**: a pílula do seletor de painéis **desliza** entre
  Início/Projetos/Estrutura/Contexto; mostrar/esconder a barra **recolhe a largura** em vez de
  sumir de uma vez; a troca de painel entra com um passo curto (sem o "pop" com escala) e abrir
  uma pasta na árvore **cresce** a altura (fechar já animava).

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
