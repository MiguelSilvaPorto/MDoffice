# Estrutura do projeto

Como o código do mdOffice está organizado — um app **100% TypeScript** que roda no navegador
(instalável como PWA), e como os documentos do usuário ficam no disco.

## O app — `src/`

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
├─ busca/              a barra de busca de funções (Ctrl+K): tipos · filtro · coleta das
│                      fitas · a interface da barra
├─ disco/             o disco do NAVEGADOR (File System Access API): registro dos handles no
│  │                  IndexedDB, operações de arquivo, árvore/busca, prévia do Office (JSZip)
│  ├─ registro.ts     os handles (o `id` do documento ocupa o lugar do caminho)
│  ├─ arquivo.ts      abrir/ler/gravar/renomear/mover + a pasta assets/
│  ├─ arvore.ts       a árvore de markdown e a busca
│  ├─ zip.ts          a prévia de .docx/.pptx/.xlsx pelo JSZip
│  ├─ pastaApp.ts     a pasta `.mdoffice/` (backup e lixeira dentro da pasta escolhida)
│  ├─ backup.ts       backup em `.mdoffice/backups` (cópias datadas, .orig, histórico)
│  └─ lixeira.ts      lixeira em `.mdoffice/lixeira` (30 dias, index.json)
├─ ponte/             a única porta entre o app e o disco (`invoke`, diálogos, avisos)
├─ files.ts                          a fachada de arquivos do app (usa a ponte)
├─ styles.css         só importa os arquivos de styles/ (um por área da interface)
└─ styles/            tokens, base, topbar, sidebar, editor, word, home, fita …
```

O `app/pwa.ts` registra o service worker (o app abre com o servidor parado) e guarda o convite
de instalação do navegador; o manifesto e o service worker ficam em `public/`.

## O disco (File System Access API)

Não há backend: o app trabalha nos **handles** das pastas que a pessoa concede. O "caminho" de um
documento é o `id` do registro (`src/disco/registro.ts`) — o caminho relativo dentro da pasta,
como `notas.md` — e o arquivo é o handle guardado no IndexedDB (sobrevive ao recarregar).

```
src/disco/
├─ registro.ts   os handles no IndexedDB (o id ocupa o lugar do caminho)
├─ arquivo.ts    abrir, ler, gravar, renomear, mover, assets/
├─ arvore.ts     a árvore de markdown e a busca
├─ zip.ts        a prévia de .docx/.pptx/.xlsx pelo JSZip
├─ pastaApp.ts   a pasta `.mdoffice/` dentro da pasta concedida
├─ backup.ts     backup em `.mdoffice/backups`
├─ rascunhos.ts  documentos novos em `.mdoffice/rascunhos`
└─ lixeira.ts    lixeira em `.mdoffice/lixeira` (30 dias)
```

## Como o documento é organizado (no disco)

```
Minha pasta/
├─ documento.md        ← o texto Markdown
├─ assets/             ← todas as imagens/desenhos usados no documento
│  ├─ desenho-abc123.png
│  └─ captura-de-tela.png
└─ .mdoffice/          ← o que o app guarda
   ├─ backups/         ← as cópias datadas de cada documento
   ├─ rascunhos/       ← documentos novos quando não há pasta de rascunhos escolhida
   └─ lixeira/         ← o que saiu da pasta, por 30 dias (index.json)
```

O `.mdoffice/` fica **dentro** da pasta que você concede ao app: o backup viaja junto se você
copiar a pasta do projeto, e nada do app vai para uma pasta escondida do sistema.

O Markdown referencia as imagens de forma relativa (`![Desenho](assets/desenho-abc123.png)`),
então o par `.md` + `assets/` pode ser movido/zipado junto sem quebrar nada. Ao enviar para
uma IA, use **Pacote IA** e anexe o ZIP inteiro: ele inclui o Markdown, os recursos
referenciados e um modelo de instrução.

Documento criado e ainda não salvo fica na pasta de dados do app (rascunhos), com as
imagens em `assets/`; ao usar **Salvar como**, o documento e as imagens vão juntos para a
sua pasta.

No **navegador**, a pasta dos rascunhos pode ser escolhida em Configurações ▸ Histórico e
salvamento. Nesse caso os documentos novos são gravados direto nela (fora do `.mdoffice/`), e
o handle da pasta fica no IndexedDB — a escolha sobrevive a recarregar. Sem escolha, vale o
`.mdoffice/rascunhos/` da pasta concedida; sem nenhuma das duas, o autosave avisa que não tem
onde gravar.
