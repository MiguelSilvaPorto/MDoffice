# Estrutura do projeto

Como o código do mdOffice está organizado — frontend (TypeScript, sem framework), backend
(Rust/Tauri) e como os documentos do usuário ficam no disco.

## Frontend — `src/`

Um "motor" por pasta: cada programa do Office tem o próprio diretório, e o `app/` junta tudo.

```
src/                  frontend (TypeScript, sem framework) — um "motor" por pasta
├─ main.ts            ponto de partida (cria o App)
├─ app/               o app: estado e integração (um arquivo por assunto)
│  ├─ app.ts          classe App (campos, abas, getters) + junta os módulos abaixo
│  ├─ tabs · pages · documents · wordDocs · excelDocs · powerpointDocs
│  ├─ assistant · media · drawing · aiContext · aiDocs · menus · toolbar
│  └─ commands · keys · layout · constants · homeContext · historySearch …
├─ md/                motor do Markdown
│  ├─ editor.ts + editor/   CodeMirror 6 (tema, alinhamento, formatação, avisos)
│  ├─ preview.ts      Markdown → HTML + imagens + Mermaid
│  ├─ draw/           desenho assistido embutido (modelo, reconhecimento, quadro, editor)
│  ├─ textdraw/       desenho em letras e símbolos (grade, glifos, editor)
│  ├─ diagram/        construtor de diagramas Mermaid
│  ├─ docx.ts         Markdown → Word (usado ao exportar)
│  └─ markdown.css    estilos do documento (app e HTML exportado)
├─ word/              motor do Word (.docx): schema, editor, paginação, fita
│  ├─ docx/           importação do .docx (estilos, blocos, mídia, página)
│  ├─ pagination.ts   páginas de verdade (o texto flui entre elas)
│  └─ ribbon.ts       fita no desenho do Word Online
├─ excel/             motor da planilha (.xlsx): modelo, fórmulas, fita, valores
│  ├─ xlsximport/     leitor do .xlsx/.xlsm
│  └─ xlsxexport/     gravação do .xlsx
├─ powerpoint/        motor de apresentações (.pptx)
│  ├─ edicao/         criar, formato, geometria, operações, tabela, texto, gráficos, mídia, transições
│  ├─ ui/             fita (abas/grupos), painel Formatar, galeria de formas, cores, popups
│  ├─ render/         desenho das formas em SVG + HTML (geometrias, preenchimentos, texto por trecho)
│  ├─ pptximport/     leitor do .pptx (pacote, tema/cores, formas, texto com herança, fontes)
│  ├─ pptxexport/     gravação em XML fiel do PowerPoint (rica.ts)
│  ├─ stage.ts        palco: zoom ancorado, seleção, arraste, guias de encaixe
│  └─ presenter.ts    modo apresentação (F5)
├─ broker/            sugestão, correção e revisão do português (offline)
│  ├─ writing.ts      fachada; peças: tone, mask, spell, stats, check, neighbor,
│  │                  concordancia, autofix, autocomplete, aprendizado, frequencia
│  ├─ data/ · style/  listas de palavras/frases e regras de estilo
│  ├─ ghost/          sugestão de palavras (predict, model, ngrams, memory, documentIndex…)
│  └─ spell.worker.ts · palavras.ts · review.ts
├─ translate/         tradução: plano, máscara, motores, cache, modelo offline, controlador
├─ export/            tela Exportar (HTML, PDF, Word, MD, TXT, ZIP, cópia)
├─ tabs.ts · sidebar.ts · outline.ts   abas, painel lateral, Estrutura
├─ history.ts · historyUi.ts           histórico de versões + log de alterações
├─ settings.ts · settingsPage.ts       configurações (aba)
├─ palette.ts · files.ts               Ctrl+K · pontes com o backend (Tauri)
├─ styles.css         só importa os arquivos de styles/ (um por área da interface)
└─ styles/            tokens, base, topbar, sidebar, editor, word, home, fita …
```

## Backend — `src-tauri/` (Rust)

Os comandos que só o lado nativo pode fazer: arquivos, imagens, rascunhos, projetos, busca,
armazenamento e o pacote para IA. O frontend chama por `invoke`.

```
src-tauri/
├─ src/commands/      files · assets · drafts · projects · search · storage · bundle · backup · util · tests
├─ src/lib.rs         registro dos plugins/comandos e a janela (montada aqui, para o cache)
├─ src/main.rs        entrada do app (migra a pasta de dados antes de abrir)
└─ tauri.conf.json    build e empacotamento (a janela fica no lib.rs)
```

A **janela** é montada no `lib.rs` (e não pelo `tauri.conf.json`) porque o teto do cache do
WebView vira o argumento `--disk-cache-size` na criação dela — escolhido em **Configurações ▸
Armazenamento**, guardado em `cache.json` na pasta de dados e lido antes de o Tauri existir.

## Como o documento é organizado (no disco)

```
Minha pasta/
├─ documento.md        ← o texto Markdown
└─ assets/             ← todas as imagens/desenhos usados no documento
   ├─ desenho-abc123.png
   └─ captura-de-tela.png
```

O Markdown referencia as imagens de forma relativa (`![Desenho](assets/desenho-abc123.png)`),
então o par `.md` + `assets/` pode ser movido/zipado junto sem quebrar nada. Ao enviar para
uma IA, use **Pacote IA** e anexe o ZIP inteiro: ele inclui o Markdown, os recursos
referenciados e um modelo de instrução.

Documento criado e ainda não salvo fica na pasta de dados do app (rascunhos), com as
imagens em `assets/`; ao usar **Salvar como**, o documento e as imagens vão juntos para a
sua pasta.
