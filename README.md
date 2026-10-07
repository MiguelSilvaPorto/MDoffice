# mdCreator

Editor de **Markdown** em português, feito com **Rust + Tauri 2**, pensado para
produzir documentos bonitos e funcionais — inclusive para enviar à IA.

## O que ele faz

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
- **Renomear pelo título**: clique no nome do documento (no topo) e digite o novo nome.
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
  (perfeito para compartilhar ou abrir depois).
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
| `Ctrl+Shift+E`     | Exportar HTML                 |
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
src/                  frontend (TypeScript, sem framework)
├─ main.ts            integração geral (arquivos, IA, export, atalhos)
├─ editor.ts          CodeMirror 6 (tema, atalhos de Markdown, listas)
├─ preview.ts         Markdown → HTML + imagens + Mermaid + export
├─ draw.ts            desenho assistido embutido (PNG + JSON)
├─ files.ts           pontes com o backend (Tauri)
├─ markdown.css       estilos do documento (usados no app e no HTML exportado)
├─ styles.css         interface do app
src-tauri/            backend Rust
├─ src/commands.rs    ler/gravar arquivos, inspecionar diretórios e assets
├─ src/lib.rs         registro dos plugins/comandos
└─ tauri.conf.json    janela, build e empacotamento
```

## Observações

- O `npm install` deste ambiente exige a política de scripts declarada no
  `package.json` (`allowScripts`); em um npm mais antigo esse campo é simplesmente ignorado.
- Imagens são guardadas **ao lado do documento** (em `assets/`). Se você usar
  *Salvar como* em outra pasta, as imagens antigas continuam na pasta original.
