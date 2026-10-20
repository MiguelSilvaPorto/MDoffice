# Mapa da fita do DeckCraft (abas, grupos e botões)

> Especificação escrita do zero para recriar a interface no mdOffice. Nenhum trecho de código foi copiado.
> Base: comportamento observado no app de referência (alpha, interface em inglês). Rótulos entre aspas são texto visível ao usuário; os nomes de grupo em português são **descritivos** — o DeckCraft não desenha o nome do grupo, apenas separa um do outro com um traço vertical fino. Atalhos no padrão Windows (no macOS o app mostra ⌘).

## Resumo

- **10 abas fixas + 7 abas contextuais** + a aba **File** (backstage); **75 grupos**; **≈ 230 botões e controles** (sem contar os itens internos de cada menu).
- Ordem das abas: **File** · **Home (Página Inicial)** · **Insert (Inserir)** · **Draw (Desenhar)** · **Design** · **Transitions (Transições)** · **Animations (Animações)** · **Slide Show (Apresentação de Slides)** · **Record (Gravar)** · **Review (Revisão)** · **View (Exibir)**.
- Abas contextuais, na ordem em que aparecem: **Slide Master** · **Shape Format (Formato da Forma)** · **Picture Format (Formato da Imagem)** · **Table Design (Design da Tabela)** · **Layout** · **Chart Design (Design do Gráfico)** · **Playback (Reprodução)**.
- Grupos por aba: Página Inicial 7 · Inserir 9 · Desenhar 3 · Design 4 · Transições 4 · Animações 4 · Apresentação de Slides 4 · Gravar 2 · Revisão 4 · Exibir 5 · contextuais 29.
- A fita fica sobre um cartão claro: botões grandes (ícone ~32 px + rótulo em 1–2 linhas) e pequenos (ícone ~17 px + rótulo). O botão desabilitado fica esmaecido e sem reação ao mouse; o ligado ganha fundo preenchido; a dica de cada botão mostra o rótulo e o atalho quando existe.
- Clicar na aba ativa recolhe a fita; duplo clique em qualquer aba (ou Ctrl+F1) também. A aba ativa fica em negrito com um sublinhado na cor de destaque.

---

## File (backstage)

Não é uma fita: é uma tela cheia que substitui fita, lâminas e barra de status até Esc ou a seta de voltar. Um menu lateral de ~160 px (um tom mais escuro que a página) escolhe a página; o conteúdo fica à direita. Com nada aberto, o File é a tela inicial (Home). As páginas Info, Save As, Print e Export só existem com uma apresentação aberta.

### Menu lateral

| Item | O que faz | Estado (quando habilita/marca/contextual) | Ícone (descrição curta) | Atalho |
|---|---|---|---|---|
| Back | Fecha o File e volta à apresentação | Só com apresentação aberta; destacado ao passar o mouse | Círculo com seta para a esquerda | Esc |
| Home | Página inicial (mesma tela com nada aberto) | Sempre | Casa | — |
| New | Nova apresentação a partir de um tema | Sempre | Página em branco | — |
| Open | Abrir apresentação recente ou procurar | Sempre | Pasta aberta | Ctrl+O (no item Browse) |
| Info | Informações e propriedades do arquivo | Só com apresentação | "i" em círculo | — |
| Save | Salva na hora (sem página) | Só com apresentação; sem caminho, cai em Save As | Disquete | Ctrl+S |
| Save As | Escolher tipo e destino | Só com apresentação | Disquete com lápis | Ctrl+Shift+S |
| Print | Imprimir (via PDF) | Só com apresentação | Impressora | Ctrl+P |
| Export | Criar PDF, folhetos e mudar tipo | Só com apresentação | Caixa com seta para fora | — |
| Close | Fecha a apresentação | Só com apresentação | Página | Ctrl+W |
| Account | Aparência e informações do produto | Sempre (grupo de baixo) | Pessoa | — |
| Options | Preferências | Sempre (grupo de baixo) | Engrenagem | Ctrl+, |

### Página "Home"

| Bloco | O que faz | Estado (quando habilita/marca) | Ícone (descrição curta) | Atalho |
|---|---|---|---|---|
| Marca DeckCraft | Logotipo e nome no topo | Sempre | Lâmina com marca | — |
| "New" + 5 miniaturas | Apresentação em branco + primeiros temas; clicar cria | Sempre | Miniaturas desenhadas | — |
| Link "More themes →" | Vai para a página New | Sempre | — | — |
| "Recent" + busca "Search for a file" | Filtra a lista de recentes | Sempre | Lupa | — |
| Lista de recentes (até 8) | Abre o arquivo escolhido (nome + pasta) | Sempre | — | — |
| Link "More presentations →" | Vai para a página Open (só se houver mais de 8) | Com mais de 8 recentes | — | — |
| Link do Discord | Abre a comunidade | Sempre | — | — |

**Notas para recriar no mdOffice:** a tela Início do mdOffice já tem recentes, rascunhos e busca, mas os "new tiles" com tema ficam de fora (lá o novo documento escolhe formato/layout). Ao recriar o File, a Home pode reaproveitar os cards existentes e acrescentar as miniaturas de tema do botão Template.

### Página "New"

| Bloco | O que faz | Estado (quando habilita/marca) | Ícone (descrição curta) | Atalho |
|---|---|---|---|---|
| "Blank Presentation" (miniatura grande) | Cria uma apresentação vazia | Sempre | Miniatura em branco | — |
| Busca "Search for themes" | Filtra a lista de temas | Sempre | Lupa | — |
| Galeria de temas | Cria uma apresentação com o tema escolhido | Sempre | Miniaturas desenhadas | — |

**Notas para recriar no mdOffice:** o mdOffice cria decks por formato e tem 6 modelos internos (botão Template) e 6 layouts; falta uma página de "novo a partir de tema" com busca e miniaturas. É o lugar natural para expor os modelos como cartões.

### Página "Open"

| Bloco | O que faz | Estado (quando habilita/marca) | Ícone (descrição curta) | Atalho |
|---|---|---|---|---|
| "Recent" (selecionado) | Mostra a lista de recentes à direita | Sempre | Relógio | — |
| "Browse" | Abre o diálogo de arquivo | Sempre | Pasta aberta | Ctrl+O |
| "Recover Unsaved Presentations" | Abre os rascunhos recuperáveis | Só quando existe pasta de recuperação | — | — |
| Busca + lista "Presentations" | Filtra e abre um recente | Sempre | Lupa | — |

**Notas para recriar no mdOffice:** a Início do mdOffice já lista recentes, rascunhos e importa .pptx/.docx/.xlsx. Faltam só a coluna "Recent/Browse" com busca e o atalho de recuperação, que já existem em outra forma (backup/rascunhos).

### Página "Info"

| Bloco | O que faz | Estado (quando habilita/marca) | Ícone (descrição curta) | Atalho |
|---|---|---|---|---|
| Título + caminho | Mostra nome e local (ou "Not saved yet") | Só com apresentação | — | — |
| "Copy path" | Copia o caminho para a área de transferência | Com caminho salvo | — | — |
| "Open file location" | Abre a pasta do arquivo | Com caminho salvo | — | — |
| "Check for Issues" (Inspect Presentation) | Abre o verificador de acessibilidade | Sempre | Acessibilidade | — |
| "Revert" (Manage Presentation) | Volta à última versão salva | Só com alterações não salvas e arquivo salvo | Seta circular | — |
| Propriedades | Tamanho, lâminas, ocultas, Título, Assunto, Tags, Categorias, Empresa, Comentários, Autor (editáveis) e Local | Só com apresentação | — | — |

**Notas para recriar no mdOffice:** o mdOffice não edita propriedades do documento (o .pptx preserva título/autor, mas não há UI). Ao recriar, essa página também pode hospedar o histórico de versões e o backup, que o mdOffice tem e o DeckCraft não.

### Página "Save As"

| Bloco | O que faz | Estado (quando habilita/marca) | Ícone (descrição curta) | Atalho |
|---|---|---|---|---|
| Lista de tipo de arquivo | Escolhe entre PowerPoint (.pptx), formato próprio, PDF, outline (.txt), PNG e JPEG | Sempre (com apresentação) | — | — |
| Botão "Save"/"Download" | Salva (ou baixa, na versão web) no tipo escolhido | Com apresentação; pptx/formato próprio salvam, os demais geram cópia | Disquete | Ctrl+Shift+S |
| Texto de detalhe | Explica o formato escolhido | Sempre | — | — |

**Notas para recriar no mdOffice:** o mdOffice salva .pptx e exporta; falta a página única de "salvar como" com todos os tipos juntos e as descrições. Os tipos outline/PNG/JPEG são as pendências de exportação já listadas na paridade.

### Página "Print"

| Bloco | O que faz | Estado (quando habilita/marca) | Ícone (descrição curta) | Atalho |
|---|---|---|---|---|
| Botão "Print" | Gera o PDF de impressão | Só com lâminas no intervalo | Impressora | Ctrl+P |
| Aviso | Explica que a impressão passa por um PDF | Sempre | — | — |
| Escopo | "Print All Slides", "Print Current Slide" ou "Custom Range" | Sempre | — | — |
| Campo "Slides:" | Intervalo digitado (ex.: 1-3, 5) | Digitar escolhe "Custom Range" | — | — |
| Layout | Full Page Slides, Notes Pages ou folhetos (1, 2, 3, 4, 6 e 9 por página) | Sempre | — | — |
| "Print Hidden Slides" | Inclui as lâminas ocultas | Sempre | — | — |
| "Frame Slides" | Desenha a moldura em volta de cada lâmina | Sempre | — | — |
| Link "Edit Header & Footer" | Abre o diálogo de cabeçalho/rodapé | Sempre | — | — |
| Prévia com paginador | Mostra cada página impressa; setas anterior/próxima | Sempre | — | — |

**Notas para recriar no mdOffice:** hoje o mdOffice imprime a lâmina pelo Ctrl+P do modo apresentação, sem notas nem folhetos. Esta página é o modelo completo para a pendência "Export to PDF (slides, notes, handouts)" da paridade — inclusive a prévia paginada.

### Página "Export"

| Bloco | O que faz | Estado (quando habilita/marca) | Ícone (descrição curta) | Atalho |
|---|---|---|---|---|
| "Create PDF Document" | Exporta o deck em PDF; caixa "Include hidden slides" + botão "Create PDF" | Sempre (com apresentação) | Página | — |
| "Create Handouts" | PDF de folhetos (1–9 lâminas por página) + botão "Create Handouts" | Sempre | Notas | — |
| "Change File Type" | Lista de tipos (menos PDF) + botão "Save As" | Sempre | Caixa com seta | — |

**Notas para recriar no mdOffice:** o mdOffice tem exportação própria (HTML/PDF/Word/TXT/pacote IA) no Markdown e exporta .pptx no PowerPoint; falta juntar isso num lugar só, com folhetos e tipo de arquivo, como aqui. Vídeo, GIF e pacote de CD não existem no DeckCraft — não copiar.

### Página "Account"

| Bloco | O que faz | Estado (quando habilita/marca) | Ícone (descrição curta) | Atalho |
|---|---|---|---|---|
| "Appearance" | Alterna Light/Dark | Sempre | — | — |
| "User Information" | Aviso de que não há conta nem login | Sempre | — | — |
| "Product Information" | Logotipo, versão, licença; "About DeckCraft"; links Discord/GitHub | Sempre | — | — |

**Notas para recriar no mdOffice:** o mdOffice já tem Configurações com aparência, atalhos etc. Não há contas no DeckCraft; a página serve de referência só para "Sobre" e tema claro/escuro.

---

## Página Inicial (Home)

### Grupo "Área de Transferência"

| Botão/menu | O que faz | Estado (quando habilita/marca/contextual) | Ícone (descrição curta) | Atalho |
|---|---|---|---|---|
| Paste (dividido) | Cola na lâmina/forma selecionada; a seta abre "Paste", "Paste and Match Formatting" e "Paste Formatting" | Habilitado com apresentação aberta | Prancheta com folha | Ctrl+V |
| Cut | Recorta a seleção | Com apresentação aberta | Tesoura | Ctrl+X |
| Copy | Copia a seleção | Com apresentação aberta | Duas folhas sobrepostas | Ctrl+C |
| Format | Pincel de formatação; clique duplo o deixa fixo | Com texto ou forma selecionada; marca enquanto ativo | Pincel sobre retângulo | Ctrl+Shift+C |

**Notas para recriar no mdOffice:** a fita do mdOffice já tem Colar, Recortar, Copiar, Desfazer/Refazer e o **Pincel de Formatação** (o "Copiar formatação", com o modo fixo do duplo clique e o Esc para sair) no grupo Área de Transferência; falta o menu do Colar (colar mantendo formatação / colar formatação). O Duplicar (Ctrl+D) do mdOffice não existe neste grupo do DeckCraft.

### Grupo "Lâminas"

| Botão/menu | O que faz | Estado (quando habilita/marca/contextual) | Ícone (descrição curta) | Atalho |
|---|---|---|---|---|
| New Slide (dividido) | Cria lâmina; a seta abre a grade de layouts, "Duplicate Selected Slides" e "Slides from Outline…" | Com lâmina aberta | Lâmina com "+" | Ctrl+Shift+N |
| Layout | Menu com a grade de layouts da lâmina atual | Com lâmina aberta | Lâmina com blocos | — |
| Reset | Devolve a lâmina ao layout (tira o que foi acrescentado) | Com lâmina aberta | Lâmina com seta circular | — |
| Section | Menu "Add Section" / "Remove All Sections" | Com lâmina aberta | Aba de pasta | — |

**Notas para recriar no mdOffice:** o mdOffice cobre Nova lâmina (no card do fim da faixa: a prévia cria e o rótulo abre a galeria de layouts), Layout, Duplicar, Excluir, Renomear, Ocultar e Redefinir. Faltam Seções (adicionar/remover todas) e "Slides from Outline…". O DeckCraft não tem Renomear/Ocultar aqui — o mdOffice tem a mais.

### Grupo "Fonte"

| Botão/menu | O que faz | Estado (quando habilita/marca/contextual) | Ícone (descrição curta) | Atalho |
|---|---|---|---|---|
| Fonte (lista) | Troca a família; as duas primeiras do tema aparecem como "(Headings)" e "(Body)" | Com texto ou forma selecionada | — | — |
| Tamanho (lista) | Troca o corpo da fonte (até 96 pt) | Com texto ou forma selecionada | — | — |
| Increase Font Size | Aumenta um passo | Com texto ou forma | "A" com triângulo para cima | Ctrl+Shift+. |
| Decrease Font Size | Diminui um passo | Com texto ou forma | "A" com triângulo para baixo | Ctrl+Shift+, |
| Clear All Formatting | Limpa a formatação do trecho | Com texto ou forma | "A" com borracha | Ctrl+Espaço |
| Bold | Alterna negrito | Marca quando o trecho está em negrito | "B" | Ctrl+B |
| Italic | Alterna itálico | Marca quando em itálico | "I" inclinado | Ctrl+I |
| Underline | Alterna sublinhado | Marca quando sublinhado | "U" com traço | Ctrl+U |
| Strikethrough | Alterna tachado | Marca quando tachado | "ab" cortado por linha vermelha | Ctrl+Shift+X |
| Superscript | Alterna sobrescrito | Marca quando sobrescrito | "x²" | Ctrl+Shift+= |
| Subscript | Alterna subscrito | Marca quando subscrito | "x₂" | Ctrl+= |
| Character Spacing (menu) | Very Tight (-3 pt), Tight (-1,5), Normal, Loose (3), Very Loose (6) | Com texto ou forma | "a" e "A" com seta dupla embaixo | — |
| Change Case (menu) | Sentence case., lowercase, UPPERCASE, Capitalize Each Word, tOGGLE cASE | Com texto ou forma | "A" e "a" | Shift+F3 |
| Text Highlight Color (dividido) | Aplica marca-texto amarelo; a seta abre a grade de cores + "No Color" | Com texto ou forma; cor padrão amarela | Marca-texto com barra amarela | — |
| Font Color (dividido) | Aplica a cor de fonte (padrão vinho); a seta abre a grade do tema | Com texto ou forma | "A" com barra vermelha | — |

**Notas para recriar no mdOffice:** o mdOffice cobre quase todo o grupo (fonte, tamanho, crescer/diminuir, B/I/S/T, sobrescrito/subscrito, caixa, espaçamento, cor, marca-texto, limpar formatação) e ainda tem versalete. Diferenças a acertar: anotar as duas primeiras fontes como "Headings/Body" do tema e mostrar o atalho Ctrl+Espaço no limpar.

### Grupo "Parágrafo"

| Botão/menu | O que faz | Estado (quando habilita/marca/contextual) | Ícone (descrição curta) | Atalho |
|---|---|---|---|---|
| Bullets (dividido) | Liga/desliga marcadores; a seta abre "None" + 9 símbolos (•, ○, ■, □, ◆, ➢, ✓, –, ★) | Com texto ou forma; marca quando há marcador | Três pontos com linhas | — |
| Numbering (dividido) | Liga/desliga numeração; a seta abre "None" + 7 esquemas (1./1)/I./i./A./a)/a.) | Com texto ou forma; marca quando há numeração | "1 2 3" com linhas | — |
| Decrease List Level | Sobe um nível da lista | Com texto ou forma | Linhas com triângulo para a esquerda | Shift+Tab |
| Increase List Level | Desce um nível da lista | Com texto ou forma | Linhas com triângulo para a direita | Tab |
| Line Spacing (menu) | 1,0 · 1,5 · 2,0 · 2,5 · 3,0 + "Line Spacing Options…" | Com texto ou forma | Linhas com seta vertical dupla | — |
| Columns (menu) | 1, 2 ou 3 colunas (espaçamento 18 pt) | Com texto ou forma | Duas colunas de linhas | — |
| Align Left | Alinha à esquerda | Marca quando ativo | Linhas alinhadas à esquerda | Ctrl+L |
| Center | Centraliza | Marca quando ativo | Linhas centradas | Ctrl+E |
| Align Right | Alinha à direita | Marca quando ativo | Linhas à direita | Ctrl+R |
| Justify | Justifica | Marca quando ativo | Linhas cheias | Ctrl+J |
| Text Direction (menu) | Horizontal, Rotate all text 90°, Rotate all text 270°, Stacked | Com texto ou forma | "A" deitado com seta | — |
| Align Text (menu) | Top, Middle, Bottom | Com texto ou forma | Caixa com texto e setas | — |

**Notas para recriar no mdOffice:** o mdOffice cobre marcadores, numeração, recuos, espaçamento entre linhas, alinhamentos e alinhamento vertical. Faltam Colunas (1–3) e Direção do Texto (90°/270°/empilhado), além do menu de opções de espaçamento (o mdOffice só lista múltiplos).

### Grupo "Imagem"

| Botão/menu | O que faz | Estado (quando habilita/marca/contextual) | Ícone (descrição curta) | Atalho |
|---|---|---|---|---|
| Picture | Abre o diálogo para inserir imagem do computador | Com lâmina aberta | Moldura com paisagem | — |

**Notas para recriar no mdOffice:** o mdOffice insere imagem pelo grupo Ilustrações do Inserir; não há grupo próprio na Página Inicial. Ao recriar, um botão isolado pode ser atalho para o mesmo comando (é o que o DeckCraft faz).

### Grupo "Desenho"

| Botão/menu | O que faz | Estado (quando habilita/marca/contextual) | Ícone (descrição curta) | Atalho |
|---|---|---|---|---|
| Shapes (menu) | Galeria por categorias (Lines — com Curve/Freeform/Scribble —, Rectangles, Basic Shapes, Block Arrows, Equation Shapes, Flowchart, Stars and Banners, Callouts, Action Buttons); escolher arma a ferramenta de desenho | Com lâmina aberta | Quadrado, triângulo e círculo | — |
| Text Box | Arma a ferramenta de caixa de texto | Com lâmina aberta | Caixa com alças e linhas | — |
| Arrange (menu) | Order Objects (Bring to Front/Send to Back/Bring Forward/Send Backward), Group Objects (Group/Ungroup/Regroup), Position Objects (Align com 6 bordas + distribuir, Rotate com 90°/90°/espelhar) e "Selection Pane…" | Com seleção de forma | Três quadrados sobrepostos | Ctrl+] etc. (itens) |
| Quick Styles (menu) | Grade 6×7 de estilos rápidos por cor de acento (rótulo "Abc") | Com seleção de forma | Quatro quadrados coloridos | — |
| Shape Fill (dividido) | Preenche com o acento 1; a seta abre a grade do tema + "No Fill" | Com seleção de forma | Balde inclinado com gota | — |
| Shape Outline (dividido) | Contorno fino na cor do texto; a seta abre cor + "No Outline", Weight (0,25–6 pt), Dashes (7) e Arrows (6) | Com seleção de forma | Lápis sobre retângulo | — |
| Shape Effects (menu) | Shadow (6), Reflection (4), Glow (4 + No Glow), Soft Edges (6), Bevel (13) e "Format Shape…" (abre o painel) | Com seleção de forma | Quadrado com sombra e brilho | — |

**Notas para recriar no mdOffice:** o mdOffice tem Formas (galeria), preenchimento, contorno, efeitos (6 sombras), organizar e 6 estilos rápidos — mas na aba Formato da Forma, não na Página Inicial. Faltam aqui Caixa de Texto no grupo (existe no Inserir) e a grade de estilos rápidos; o Arrange do DeckCraft inclui Painel de Seleção, que o mdOffice não tem.

### Grupo "Ideias de Design"

| Botão/menu | O que faz | Estado (quando habilita/marca/contextual) | Ícone (descrição curta) | Atalho |
|---|---|---|---|---|
| Design Ideas | Abre o painel de sugestões de design | Com lâmina aberta | Lâmpada amarela | — |

**Notas para recriar no mdOffice:** atendido no **grupo Composição ▸ Composição**, na aba
**Design** (o grupo nasceu na Página Inicial e voltou para a aba Design, como no Office). Ele se
chamava **"Designer"** (o nome do PowerPoint) e virou **"Composição"** quando as Ideias de design e
os Arranjos viraram um sistema só; o ícone é a estrela do app (`i-spark`), no lugar da lâmpada
amarela da referência.

---

## Inserir (Insert)

### Grupo "Lâminas"

| Botão/menu | O que faz | Estado (quando habilita/marca/contextual) | Ícone (descrição curta) | Atalho |
|---|---|---|---|---|
| New Slide (dividido) | Cria lâmina; a seta abre só a grade de layouts | Com lâmina aberta | Lâmina com "+" | Ctrl+Shift+N |

**Notas para recriar no mdOffice:** o mdOffice atende este botão no **card "+ Nova lâmina" do fim da faixa** (a prévia cria com o último layout; o rótulo abre a galeria). Na **fita** ele **não existe mais** — saiu a pedido, porque o card fazia o mesmo duas vezes; a aba Inserir ficou com o **Duplicar** no grupo Lâminas.

### Grupo "Tabelas"

| Botão/menu | O que faz | Estado (quando habilita/marca/contextual) | Ícone (descrição curta) | Atalho |
|---|---|---|---|---|
| Table (menu) | Grade que cresce com o mouse (8 linhas × 10 colunas, rótulo "NxM Table"), separador e "Insert Table…" | Com lâmina aberta | Tabela 3×3 | — |

**Notas para recriar no mdOffice:** o mdOffice insere tabela por uma grade 6×8; falta a segunda via "Insert Table…" com número exato (o DeckCraft oferece as duas).

### Grupo "Imagens"

| Botão/menu | O que faz | Estado (quando habilita/marca/contextual) | Ícone (descrição curta) | Atalho |
|---|---|---|---|---|
| Pictures | Abre o diálogo de imagem | Com lâmina aberta | Moldura com paisagem | — |
| Screenshot | Captura de tela | **Desabilitado** (recurso futuro, dica "not available yet") | Cantos de recorte | — |

**Notas para recriar no mdOffice:** o mdOffice insere imagem e aceita colar do clipboard; captura de tela não existe nos dois — o botão pode ficar desabilitado igual.

### Grupo "Ilustrações"

| Botão/menu | O que faz | Estado (quando habilita/marca/contextual) | Ícone (descrição curta) | Atalho |
|---|---|---|---|---|
| Shapes (menu) | Mesma galeria de formas; escolher arma a ferramenta | Com lâmina aberta | Quadrado, triângulo e círculo | — |
| Icons (menu) | Biblioteca de 24 pictogramas (Star, Heart, Lightning, Sun, Moon, Cloud, Smile, Not allowed, Plus, Multiply, Equals, Chevron, Arrow, Move, Return, Decision, Database, Document, Speech, Thought, Pin, Ring, Burst, Banner); insere no centro da lâmina | Com lâmina aberta | Pessoa, estrela e coração | — |
| SmartArt | Abre o diálogo de SmartArt | Com lâmina aberta | Caixa ligada a duas caixas | — |
| Chart (menu) | Lista os tipos principais de gráfico; escolher insere | Com lâmina aberta | Barras | — |

**Notas para recriar no mdOffice:** o mdOffice cobre Formas e Gráfico (7 tipos) no Inserir; faltam SmartArt e a galeria de ícones. A galeria de formas do DeckCraft tem ~150 presets em 9 categorias; a do mdOffice tem ~40 — a categorização por "Equation Shapes", "Block Arrows" etc. é um bom modelo.

### Grupo "Links"

| Botão/menu | O que faz | Estado (quando habilita/marca/contextual) | Ícone (descrição curta) | Atalho |
|---|---|---|---|---|
| Link | Abre o diálogo de hiperlink | Com lâmina aberta | Dois elos de corrente | Ctrl+K |
| Action (menu) | 12 botões de ação ("Action Button: back", "…forward", "…beginning", "…end", "…home", "…information", "…return", "…movie", "…document", "…sound", "…help", "…custom") | Com lâmina aberta | Retângulo com cursor | — |

**Notas para recriar no mdOffice:** o mdOffice importa e preserva hiperlinks, mas não tem botões para inserir/editar na fita; botões de ação não existem. Duas pendências claras (hyperlinks na UI e action buttons).

### Grupo "Comentários"

| Botão/menu | O que faz | Estado (quando habilita/marca/contextual) | Ícone (descrição curta) | Atalho |
|---|---|---|---|---|
| Comment | Abre o diálogo de novo comentário | Com lâmina aberta | Balão de fala com linhas | — |

**Notas para recriar no mdOffice:** o mdOffice não tem comentários — funcionalidade inteira a construir (a paridade já lista "Comments" como pendência P1).

### Grupo "Texto"

| Botão/menu | O que faz | Estado (quando habilita/marca/contextual) | Ícone (descrição curta) | Atalho |
|---|---|---|---|---|
| Text Box | Arma a caixa de texto | Com lâmina aberta | Caixa com alças | — |
| Header & Footer | Abre o diálogo de cabeçalho/rodapé | Com lâmina aberta | Página com faixas | — |
| WordArt (menu) | 6 estilos de WordArt | Com lâmina aberta | "A" inclinado laranja | — |
| Date & Time | Insere o campo de data/hora | Com lâmina aberta | Calendário com faixa vermelha | — |
| Slide Number | Insere o número da lâmina | Com lâmina aberta | Lâmina com "#" | — |

**Notas para recriar no mdOffice:** o mdOffice cobre Caixa de texto; faltam WordArt, Data/Hora e um botão de Número da lâmina (o rodapé/número já existe no modelo e em Configurar, mas não como inserção). Header & Footer do mdOffice é o "Configurar".

### Grupo "Símbolos"

| Botão/menu | O que faz | Estado (quando habilita/marca/contextual) | Ícone (descrição curta) | Atalho |
|---|---|---|---|---|
| Equation | Abre o diálogo de equação | Com lâmina aberta | Símbolo de somatório (Σ) | — |
| Symbol | Abre o diálogo de símbolos | Com lâmina aberta | "Ω" | — |

**Notas para recriar no mdOffice:** não há equação nem galeria de símbolos na fita; a digitação normal aceita símbolos, mas sem inserção guiada. Pendências P2 da paridade.

### Grupo "Mídia"

| Botão/menu | O que faz | Estado (quando habilita/marca/contextual) | Ícone (descrição curta) | Atalho |
|---|---|---|---|---|
| Video | Abre o diálogo de vídeo | Com lâmina aberta | Câmera de vídeo com ponto vermelho | — |
| Audio | Abre o diálogo de áudio | Com lâmina aberta | Alto-falante com ondas | — |

**Notas para recriar no mdOffice:** o mdOffice não insere nem reproduz áudio/vídeo (área "Media" da paridade, 0/7). A aba Playback contextual mostra o que falta depois de inserir.

---

## Desenhar (Draw)

### Grupo "Ferramentas"

| Botão/menu | O que faz | Estado (quando habilita/marca/contextual) | Ícone (descrição curta) | Atalho |
|---|---|---|---|---|
| Select | Volta à ferramenta de seleção | Marca quando a ferramenta ativa é a seleção | Laço tracejado | — |
| Eraser | Arma a borracha (traço de 2 pt) | Marca quando a borracha está ativa | Borracha inclinada | — |

**Notas para recriar no mdOffice:** o mdOffice não tem canetas/borracha no slide (o desenho assistido existe só no Markdown). A aba Desenhar é nova; a borracha pode reaproveitar o modelo de traço livre.

### Grupo "Canetas"

| Botão/menu | O que faz | Estado (quando habilita/marca/contextual) | Ícone (descrição curta) | Atalho |
|---|---|---|---|---|
| Black Pen | Arma a caneta preta (1,5 pt) | Marca quando ativa (mesma cor e espessura) | Caneta inclinada | — |
| Red Pen | Arma a caneta vermelha (1,5 pt) | Idem | Caneta inclinada | — |
| Blue Pen | Arma a caneta azul (1,5 pt) | Idem | Caneta inclinada | — |
| Pencil | Arma o lápis cinza (1 pt) | Idem | Lápis amarelo | — |
| Highlighter | Arma o marca-texto amarelo (10 pt) | Idem | Marca-texto amarelo | — |

**Notas para recriar no mdOffice:** sem equivalente. As cinco opções (três canetas + lápis + marca-texto) e o estado "armado" por cor/espessura são um bom mínimo para a futura tinta.

### Grupo "Converter"

| Botão/menu | O que faz | Estado (quando habilita/marca/contextual) | Ícone (descrição curta) | Atalho |
|---|---|---|---|---|
| Ink to Shape | Converte tinta em forma | **Desabilitado** ("coming soon") | Rabisco com círculo | — |
| Ink to Text | Converte tinta em texto | **Desabilitado** ("coming soon") | Rabisco com "a" | — |
| Ink to Math | Converte tinta em fórmula | **Desabilitado** ("coming soon") | Rabisco com sinal | — |

**Notas para recriar no mdOffice:** não existem; os três ficam desabilitados como no DeckCraft até haver reconhecimento. Não inventar comportamento.

---

## Design

### Grupo "Temas"

| Botão/menu | O que faz | Estado (quando habilita/marca/contextual) | Ícone (descrição curta) | Atalho |
|---|---|---|---|---|
| Galeria de temas | Miniaturas de todos os temas embutidos (desenho "Aa" + 6 cores); clicar aplica | Sempre (com apresentação); marca o tema atual | Miniaturas desenhadas | — |

**Notas para recriar no mdOffice:** o mdOffice tem 3 temas (claro/escuro/contraste) e 6 modelos no botão Template, mas sem galeria de miniaturas na fita. Uma galeria de temas na fita (com a miniatura desenhada) é o que falta; as variantes de cor/fonte nomeadas também.

### Grupo "Variantes"

| Botão/menu | O que faz | Estado (quando habilita/marca/contextual) | Ícone (descrição curta) | Atalho |
|---|---|---|---|---|
| Colors (menu) | Lista de esquemas de cor embutidos (8 amostras + nome); clicar aplica | Sempre | Quatro barras coloridas | — |
| Fonts (menu) | Esquemas de fonte (nome + fonte de título/texto); clicar aplica | Sempre | "A" e "g" | — |
| Background Styles (menu) | 12 estilos de fundo (4 cores × 3 tons) + "Reset Slide Background" | Sempre | Lâmina com diagonal colorida | — |

**Notas para recriar no mdOffice:** o mdOffice tem a paleta do documento (importada) e a fonte do deck, sem esquemas nomeados; fundo só por cor/gradiente/imagem. Faltam os 12 estilos prontos e os esquemas nomeados de cor/fonte.

### Grupo "Personalizar"

| Botão/menu | O que faz | Estado (quando habilita/marca/contextual) | Ícone (descrição curta) | Atalho |
|---|---|---|---|---|
| Slide Size (menu) | "Standard (4:3)", "Widescreen (16:9)" e "Page Setup…" | Sempre | Lâmina com seta diagonal | — |
| Format Background | Abre o painel de fundo (cor, gradiente, imagem) | Com lâmina | Lâmina com pincel | — |

**Notas para recriar no mdOffice:** o mdOffice cobre 16:9/4:3 e fundo (cor, gradiente, imagem, aplicar a todas) via Configurar/Formatar fundo; falta o diálogo de tamanho custom ("Page Setup") e reunir as opções num menu só.

### Grupo "Designer"

| Botão/menu | O que faz | Estado (quando habilita/marca/contextual) | Ícone (descrição curta) | Atalho |
|---|---|---|---|---|
| Design Ideas | Abre o painel de sugestões | Com lâmina | Lâmpada amarela | — |

**Notas para recriar no mdOffice:** o comando existe, mas mora **só na Página Inicial** (ver a nota
do grupo de mesmo nome lá) — o mdOffice não repete o mesmo botão em duas abas, para não ter dois
caminhos que possam ficar dessincronizados.

---

## Transições (Transitions)

### Grupo "Prévia"

| Botão/menu | O que faz | Estado (quando habilita/marca/contextual) | Ícone (descrição curta) | Atalho |
|---|---|---|---|---|
| Preview | Reproduz a transição da lâmina atual (sem entrar no F5) | Sempre | Círculo com triângulo verde | — |

**Notas para recriar no mdOffice:** o mdOffice tem o botão Prévia no grupo Aplicar — equivalente coberto.

### Grupo "Transição para esta Lâmina"

| Botão/menu | O que faz | Estado (quando habilita/marca/contextual) | Ícone (descrição curta) | Atalho |
|---|---|---|---|---|
| Galeria (12 miniaturas) | Aplica a transição; marca a atual (None, Morph, Fade, Push, Wipe, Split, Reveal, Cut, Random Bars, Shape, Uncover, Cover) | Com lâmina; marca a transição atual | Miniaturas desenhadas | — |
| Seta "mais" (menu) | Lista todas as transições por categoria: Subtle, Exciting, Dynamic Content (~48 no total) | Com lâmina | — | — |

**Notas para recriar no mdOffice:** o mdOffice tem 7 transições (nenhuma, fade, push, wipe, split, cover, uncover) com prévia desenhada em SVG. O catálogo do DeckCraft tem ~48 — falta o menu "mais por categoria" e, principalmente, Morph. O desenho das miniaturas do mdOffice é um bom padrão a manter.

### Grupo "Opções de Efeito"

| Botão/menu | O que faz | Estado (quando habilita/marca/contextual) | Ícone (descrição curta) | Atalho |
|---|---|---|---|---|
| Effect Options (menu) | Opções da transição atual (ex.: direção "From Left/Right/Top/Bottom", "Horizontal/Vertical", "Through Black", "Smoothly") | Só habilita quando a transição tem opções | Caixa com seta para cima | — |

**Notas para recriar no mdOffice:** o mdOffice usa 4 setas de Direção em vez do menu de opções. O modelo do DeckCraft (uma lista de opções por tipo, com rótulos prontos) escala melhor quando entrarem mais transições.

### Grupo "Tempo"

| Botão/menu | O que faz | Estado (quando habilita/marca/contextual) | Ícone (descrição curta) | Atalho |
|---|---|---|---|---|
| Duration | Campo de segundos (passo 0,25 s) | Com transição definida | — | — |
| On Mouse Click | Avanço ao clicar | Marcado por padrão | — | — |
| After: + campo | Avanço automático após N segundos | Caixa liga o campo | — | — |
| Apply To All | Aplica a transição e o tempo a todas as lâminas | Com lâmina | Lâmina com selo de check | — |

**Notas para recriar no mdOffice:** o mdOffice tem Duração em lista e "Aplicar a todas", mas não tem avanço "Ao clicar/Após" com campo de segundos. Faltam as duas caixas e o spinner — pendência da paridade ("Advance on click / after time").

---

## Animações (Animations)

### Grupo "Prévia"

| Botão/menu | O que faz | Estado (quando habilita/marca/contextual) | Ícone (descrição curta) | Atalho |
|---|---|---|---|---|
| Preview | Reproduz as animações da lâmina em prévia | Sempre | Círculo com triângulo verde | — |

**Notas para recriar no mdOffice:** a aba Animações inteira é nova (0/8 na paridade). A prévia reaproveita o modo apresentação já existente.

### Grupo "Animação"

| Botão/menu | O que faz | Estado (quando habilita/marca/contextual) | Ícone (descrição curta) | Atalho |
|---|---|---|---|---|
| Galeria rápida (13) | Aplica um efeito à seleção (Appear, Fade, Fly In, Float In, Split, Wipe, Zoom, Pulse, Spin, Grow/Shrink, Fade (saída), Fly Out, Lines) | Com forma selecionada; marca o efeito atual | Estrelas verde/amarela/vermelha e curva | — |
| Seta "mais" (menu) | Lista todos os efeitos por classe: Entrance, Emphasis, Exit, Motion Paths (~70) | Com forma selecionada | — | — |
| Effect Options (menu) | Opções do efeito atual + "As One Object" / "By Paragraph" (compilação de texto) | Só quando o efeito tem opções | Caixa com seta para cima | — |

**Notas para recriar no mdOffice:** sem equivalente. O recorte é claro: 4 classes (entrada/ênfase/saída/caminho), galeria rápida com 13 e menu completo por classe; o "por parágrafo" é o que cobre texto.

### Grupo "Animação Avançada"

| Botão/menu | O que faz | Estado (quando habilita/marca/contextual) | Ícone (descrição curta) | Atalho |
|---|---|---|---|---|
| Add Animation (menu) | Acrescenta outro efeito à forma (lista todos, menos mídia), com a classe ao lado do nome | Com forma selecionada | Estrela com "+" | — |
| Animation Pane | Abre o painel de animações (ordem e tempo) | Sempre | Painel com linhas coloridas | — |
| Trigger (menu) | Define o gatilho: "On Click of… (none)" ou "On Click of {forma}" | Só com animação na seleção | Raio amarelo | — |
| Animation Painter | Copia a animação de uma forma para outra; clique duplo fixa | Com forma animada selecionada; marca enquanto ativo | Estrela com pincel | Alt+Shift+C |

**Notas para recriar no mdOffice:** sem equivalente; o painel de animação (reordenar/tempo) é a peça P0 que falta, junto com o gatilho e o pintor.

### Grupo "Tempo"

| Botão/menu | O que faz | Estado (quando habilita/marca/contextual) | Ícone (descrição curta) | Atalho |
|---|---|---|---|---|
| Start (lista) | On Click, With Previous, After Previous | Com animação na seleção | — | — |
| Duration | Duração em segundos (passo 0,25 s) | Com animação | — | — |
| Delay | Atraso em segundos | Com animação | — | — |

**Notas para recriar no mdOffice:** sem equivalente; o trio Start/Duration/Delay é o mínimo de tempo a modelar junto com o painel.

---

## Apresentação de Slides (Slide Show)

### Grupo "Iniciar Apresentação"

| Botão/menu | O que faz | Estado (quando habilita/marca/contextual) | Ícone (descrição curta) | Atalho |
|---|---|---|---|---|
| Play from Start | Começa do slide 1 em tela cheia | Com lâmina | Lâmina com triângulo verde | F5 |
| Play from Current Slide | Começa do slide atual | Com lâmina | Lâmina com triângulo | Ctrl+Enter |
| Presenter View | Liga/desliga a janela do apresentador | Marca quando ligada | Monitor com slide e notas | — |
| Custom Show | Abre o diálogo de apresentação personalizada | Com lâmina | Lista com triângulo | — |

**Notas para recriar no mdOffice:** o mdOffice tem F5 (do início) e as notas na tela; faltam "do slide atual" na fita, a janela do apresentador de verdade e apresentações personalizadas. A paridade já lista presenter view como próximo passo.

### Grupo "Configurar"

| Botão/menu | O que faz | Estado (quando habilita/marca/contextual) | Ícone (descrição curta) | Atalho |
|---|---|---|---|---|
| Set Up Slide Show | Abre o diálogo de configuração (loop, quiosque, sem animação…) | Com lâmina | Lâmina com engrenagem | — |
| Hide Slide | Oculta/mostra a lâmina atual | Marca quando a lâmina está oculta | Lâmina cortada | — |

**Notas para recriar no mdOffice:** ocultar lâmina já existe na Página Inicial do mdOffice; falta o "Configurar Apresentação" (loop/quiosque). O botão ocultar aqui é o mesmo comando em outro lugar — ao recriar, manter só um.

### Grupo "Ensaiar"

| Botão/menu | O que faz | Estado (quando habilita/marca/contextual) | Ícone (descrição curta) | Atalho |
|---|---|---|---|---|
| Rehearse Timings | Abre a apresentação com cronômetro de ensaio | Com lâmina | Lâmina com relógio | — |
| Record | Grava narração | **Desabilitado** (precisa de captura de áudio, "coming soon") | Círculo vermelho de gravação | — |

**Notas para recriar no mdOffice:** nenhum dos dois existe; o ensaio depende do cronômetro da presenter view (a construir). Não copiar o botão desabilitado de gravação sem o áudio.

### Grupo "Opções da Apresentação"

| Botão/menu | O que faz | Estado (quando habilita/marca/contextual) | Ícone (descrição curta) | Atalho |
|---|---|---|---|---|
| Use Timings | Usar os tempos ensaiados | Marcado por padrão | — | — |
| Play Narrations | Reproduzir narrações | Marcado por padrão | — | — |
| Show Media Controls | Mostrar controles de mídia | Caixa exibida, mas **sem efeito** no app (não envia comando) | — | — |

**Notas para recriar no mdOffice:** sem equivalente; só fará sentido quando houver ensaio/narração. A terceira caixa é inerte no DeckCraft — não replicar como se funcionasse.

---

## Gravar (Record)

### Grupo "Gravar"

| Botão/menu | O que faz | Estado (quando habilita/marca/contextual) | Ícone (descrição curta) | Atalho |
|---|---|---|---|---|
| Cameo | Insere a câmera na gravação | **Desabilitado** ("Camera capture is not available yet") | Lâmina com pessoa | — |
| From Beginning | Abre a apresentação em modo ensaio desde o começo | Com lâmina | Lâmina com triângulo verde | — |
| From Current Slide | Idem, do slide atual | Com lâmina | Lâmina com triângulo | — |

**Notas para recriar no mdOffice:** a aba inteira é nova e depende de captura de áudio/câmera; no estado atual é só um atalho para o ensaio. Pendência P2 (Record slide show) — não copiar sem os recursos.

### Grupo "Saiba Mais"

| Botão/menu | O que faz | Estado (quando habilita/marca/contextual) | Ícone (descrição curta) | Atalho |
|---|---|---|---|---|
| Learn More | Abre a página do app no navegador | Sempre | "?" em círculo | — |

**Notas para recriar no mdOffice:** não há equivalente; no mdOffice a ajuda vive na própria suíte (atalhos/Configurações). Não precisa de botão.

---

## Revisão (Review)

### Grupo "Revisão de Texto"

| Botão/menu | O que faz | Estado (quando habilita/marca/contextual) | Ícone (descrição curta) | Atalho |
|---|---|---|---|---|
| Spelling | Abre o diálogo de verificação ortográfica | Com lâmina | "abc" com check verde | F7 |
| Thesaurus | Abre o dicionário de sinônimos | **Desabilitado** ("coming soon") | Livro com marcador | — |

**Notas para recriar no mdOffice:** o mdOffice tem corretor de português no Markdown/Word, mas não no PowerPoint; o sinônimos existe na revisão do Word. Faltam as duas entradas na fita do deck.

### Grupo "Acessibilidade"

| Botão/menu | O que faz | Estado (quando habilita/marca/contextual) | Ícone (descrição curta) | Atalho |
|---|---|---|---|---|
| Check Accessibility | Abre o verificador (texto alt, contraste…) | Com lâmina | Pessoa em círculo azul | — |

**Notas para recriar no mdOffice:** não existe verificador de acessibilidade; pendência P2 da paridade. O diálogo do DeckCraft pode servir de referência de conteúdo.

### Grupo "Idioma"

| Botão/menu | O que faz | Estado (quando habilita/marca/contextual) | Ícone (descrição curta) | Atalho |
|---|---|---|---|---|
| Translate | Traduz o texto selecionado | **Desabilitado** ("Translation needs a language model (not bundled)") | Dois quadros com letras | — |
| Language | Abre o diálogo de idioma do texto | Com lâmina | Globo com meridianos | — |

**Notas para recriar no mdOffice:** o mdOffice tem tradução PT-BR → inglês local com memória e glossário — muito além do DeckCraft. O botão Translate do mdOffice pode ligar nesse recurso em vez de ficar desabilitado.

### Grupo "Comentários"

| Botão/menu | O que faz | Estado (quando habilita/marca/contextual) | Ícone (descrição curta) | Atalho |
|---|---|---|---|---|
| New Comment | Abre o diálogo de novo comentário | Com lâmina | Balão com "+" | Ctrl+Alt+M |
| Delete | Apaga o comentário (da seleção) | Com lâmina aberta | Balão com "×" | — |
| Show Comments | Mostra/esconde o painel de comentários | Marca quando o painel está aberto | Dois balões | — |

**Notas para recriar no mdOffice:** não há comentários; a pendência P1 inclui responder/resolver, que o DeckCraft tem no painel (a fita só expõe novo/apagar/mostrar).

---

## Exibir (View)

### Grupo "Modos de Exibição"

| Botão/menu | O que faz | Estado (quando habilita/marca/contextual) | Ícone (descrição curta) | Atalho |
|---|---|---|---|---|
| Normal | Volta à edição normal | Marca quando ativo | Lâmina com faixa de miniaturas | — |
| Outline View | Modo estrutura (só texto) | Marca quando ativo | Linhas à esquerda e lâmina | — |
| Slide Sorter | Modo classificador (grade de miniaturas) | Marca quando ativo | Quatro miniaturas | — |
| Notes Page | Página de anotações | Marca quando ativo | Página com lâmina e linhas | — |
| Reading View | Leitura dentro da janela | Não fica marcada (modo temporário) | Livro aberto | — |

**Notas para recriar no mdOffice:** o mdOffice tem zoom, faixa de lâminas (vertical/horizontal) e Notas; faltam Outline, Slide Sorter como view separada, Notes Page e Reading View. A paridade já aponta esses itens (Views 6/10).

### Grupo "Modos Mestre"

| Botão/menu | O que faz | Estado (quando habilita/marca/contextual) | Ícone (descrição curta) | Atalho |
|---|---|---|---|---|
| Slide Master | Entra/sai do modo mestre | Marca quando está no modo mestre | Lâmina roxa com miniaturas | — |
| Handout Master | Modo mestre de folhetos | **Desabilitado** ("coming soon") | Página com 4 miniaturas | — |
| Notes Master | Modo mestre de anotações | **Desabilitado** ("coming soon") | Página com lâmina e linhas | — |

**Notas para recriar no mdOffice:** o mdOffice lê mestre/layout do .pptx, mas não edita; o modo mestre é a maior lacuna de "Masters & themes" (P0). Os dois botões desabilitados mostram que nem o DeckCraft terminou os mestres de folheto/anotação.

### Grupo "Mostrar"

| Botão/menu | O que faz | Estado (quando habilita/marca/contextual) | Ícone (descrição curta) | Atalho |
|---|---|---|---|---|
| Ruler | Liga/desliga as réguas | Caixa marcada quando ligada | Régua amarela | — |
| Gridlines | Liga/desliga a grade | Idem | Grade | Shift+F9 |
| Guides | Liga/desliga as guias | Idem | Guias tracejadas | Alt+F9 |
| Notes | Mostra/esconde o painel de notas | Marca quando aberto | Bloco amarelo | — |

**Notas para recriar no mdOffice:** o mdOffice tem grade, guias de encaixe e Notas; faltam réguas. As caixas Ruler/Gridlines/Guides são o modelo direto para os toggles que já existem na aba Exibir.

### Grupo "Zoom"

| Botão/menu | O que faz | Estado (quando habilita/marca/contextual) | Ícone (descrição curta) | Atalho |
|---|---|---|---|---|
| Zoom (menu) | 400 %, 200 %, 150 %, 100 %, 75 %, 66 %, 50 % e 33 % | Sempre | Lupa | Ctrl+= / Ctrl+- |
| Fit to Window | Ajusta o palco à janela | Sempre | Quatro cantos com lâmina | — |

**Notas para recriar no mdOffice:** o mdOffice tem zoom contínuo 40–400 % (Ctrl+roda) e 100 %; falta o menu de porcentagens fixas e um "Ajustar à janela" explícito na fita. Fáceis de acrescentar.

### Grupo "Aparência"

| Botão/menu | O que faz | Estado (quando habilita/marca/contextual) | Ícone (descrição curta) | Atalho |
|---|---|---|---|---|
| Grayscale | Mostra a lâmina em tons de cinza | Marca quando ligado | Três faixas de cinza | — |
| Dark Mode | Alterna o tema claro/escuro | Marca quando escuro | Paleta de cores | — |

**Notas para recriar no mdOffice:** o mdOffice já tem tema claro/escuro (na Configurações e na barra superior); falta o modo tons de cinza na fita (pendência P2 da paridade).

---

## Formato da Forma (Shape Format) — contextual

Aparece quando há forma, grupo, conector ou edição de texto selecionada.

### Grupo "Inserir Formas"

| Botão/menu | O que faz | Estado (quando habilita/marca/contextual) | Ícone (descrição curta) | Atalho |
|---|---|---|---|---|
| Shapes (menu) | Galeria de formas; escolher arma a ferramenta | Sempre (na aba) | Quadrado, triângulo e círculo | — |
| Text Box | Arma a caixa de texto | Com lâmina | Caixa com alças | — |
| Edit Shape (menu) | "Change Shape": troca a geometria pela escolhida na galeria | Com seleção de forma | Forma com pontos de edição | — |
| Merge Shapes (menu) | Union, Combine, Fragment, Intersect, Subtract | Com 2+ formas selecionadas | Dois círculos sobrepostos | — |

**Notas para recriar no mdOffice:** a aba Formato da Forma do mdOffice não tem Editar Forma nem Mesclar Formas (duas pendências P1 da paridade); a galeria de Formas e a Caixa de Texto existem no Inserir. Ao recriar, os dois botões novos são o maior ganho desta aba.

### Grupo "Estilos de Forma"

| Botão/menu | O que faz | Estado (quando habilita/marca/contextual) | Ícone (descrição curta) | Atalho |
|---|---|---|---|---|
| Shape Styles (menu) | Grade 6×7 de estilos rápidos por acento | Com seleção de forma | Quatro quadrados coloridos | — |
| Shape Fill (dividido) | Preenche (padrão acento 1); seta abre grade + "No Fill" + "Gradient…" | Com seleção de forma | Balde com gota | — |
| Shape Outline (dividido) | Contorno; seta abre cor, "No Outline", Weight, Dashes, Arrows | Com seleção de forma | Lápis sobre retângulo | — |
| Shape Effects (menu) | Shadow, Reflection, Glow, Soft Edges, Bevel, "Format Shape…" | Com seleção de forma | Quadrado com sombra e brilho | — |

**Notas para recriar no mdOffice:** o mdOffice cobre estilos rápidos (6), preenchimento, contorno (com traços e pontas) e efeitos (6 sombras) nesta aba; o DeckCraft acrescenta o item "Gradient…" que salta para o painel de preenchimento — bom atalho a copiar.

### Grupo "Texto"

| Botão/menu | O que faz | Estado (quando habilita/marca/contextual) | Ícone (descrição curta) | Atalho |
|---|---|---|---|---|
| Text Fill (menu) | Cor do preenchimento das letras | Com seleção de forma | "A" azul com barra | — |
| Text Outline (menu) | Contorno das letras + "No Outline" | Com seleção de forma | "A" vazado | — |
| Text Effects (menu) | Efeitos de texto (hoje só "Shadow") | Com seleção de forma | "A" roxo com brilho | — |

**Notas para recriar no mdOffice:** a paridade aponta "Text outline and text effects" como pendência P2 e não há esses controles na fita do mdOffice. O recorte do DeckCraft (preenchimento, contorno e efeitos de texto) é o desenho a seguir.

### Grupo "Texto Alternativo"

| Botão/menu | O que faz | Estado (quando habilita/marca/contextual) | Ícone (descrição curta) | Atalho |
|---|---|---|---|---|
| Alt Text | Abre o diálogo de texto alternativo | Com seleção de forma | Imagem com linhas de texto | — |

**Notas para recriar no mdOffice:** não existe (pendência P1 "Alt text"); o botão abre um diálogo simples de descrição/decorativa.

### Grupo "Organizar"

| Botão/menu | O que faz | Estado (quando habilita/marca/contextual) | Ícone (descrição curta) | Atalho |
|---|---|---|---|---|
| Bring Forward (dividido) | Sobe uma camada; seta abre "Bring Forward" e "Bring to Front" | Com seleção de forma | Camadas com seta para cima | Ctrl+] / Ctrl+Shift+] |
| Send Backward (dividido) | Desce uma camada; seta abre "Send Backward" e "Send to Back" | Com seleção de forma | Camadas com seta para baixo | Ctrl+[ / Ctrl+Shift+[ |
| Selection Pane | Abre o painel de seleção | Com seleção de forma | Painel com lista | — |
| Align (menu) | 6 alinhamentos + distribuir H/V | Com seleção de forma | Três retângulos com linha-guia | — |
| Group (menu) | Group, Ungroup, Regroup | Com seleção de forma | Contorno tracejado com formas | Ctrl+Alt+G etc. |
| Rotate (menu) | Girar 90° para cada lado e espelhar H/V | Com seleção de forma | Quadrado com seta circular | — |

**Notas para recriar no mdOffice:** o mdOffice tem ordem, alinhar/distribuir, girar/espelhar e agrupar/desagrupar (sem "reagrupar" e sem painel de seleção). O par "Bring Forward/Send Backward" com submenu é mais direto que o menu "Organizar" do mdOffice — vale reorganizar assim.

### Grupo "Tamanho"

| Botão/menu | O que faz | Estado (quando habilita/marca/contextual) | Ícone (descrição curta) | Atalho |
|---|---|---|---|---|
| Height | Altura exata em polegadas | Com uma forma selecionada | — | — |
| Width | Largura exata em polegadas | Com uma forma selecionada | — | — |

**Notas para recriar no mdOffice:** o mdOffice já tem Altura/Largura em cm na aba Formato; só falta a unidade configurável e travar proporção (no roadmap: "travar proporção").

### Grupo "Painel de Formatação"

| Botão/menu | O que faz | Estado (quando habilita/marca/contextual) | Ícone (descrição curta) | Atalho |
|---|---|---|---|---|
| Format Pane | Abre o painel completo de formatação | Com seleção de forma | Lâmina com pincel | — |

**Notas para recriar no mdOffice:** o mdOffice já tem o painel Formatar completo — equivalente coberto.

---

## Formato da Imagem (Picture Format) — contextual

Aparece quando há imagem selecionada.

### Grupo "Ajustes"

| Botão/menu | O que faz | Estado (quando habilita/marca/contextual) | Ícone (descrição curta) | Atalho |
|---|---|---|---|---|
| Remove Background | Remove o fundo da imagem | **Desabilitado** ("coming soon") | Pessoa com fundo roxo | — |
| Corrections (menu) | Brilho ±0–40 % e Contraste ±0–40 % | Com imagem selecionada | Sol com raios | — |
| Color (menu) | Saturação 0–300 % e "Grayscale" | Com imagem selecionada | Três círculos RGB | — |
| Transparency (menu) | Transparência 0–95 % | Com imagem selecionada | Xadrez com retângulo translúcido | — |
| Change Picture | Troca a imagem por outra do computador | Com imagem | Imagem com seta circular verde | — |
| Reset Picture | Desfaz ajustes e recorte | Com imagem | Imagem com seta circular azul | — |

**Notas para recriar no mdOffice:** o mdOffice tem trocar imagem e redefinir recorte, sem correções/cor/transparência (pendências P1 da paridade). Os menus com valores prontos (±40 %, saturação, transparência) são fáceis de transportar quando o motor suportar os filtros.

### Grupo "Estilos de Imagem"

| Botão/menu | O que faz | Estado (quando habilita/marca/contextual) | Ícone (descrição curta) | Atalho |
|---|---|---|---|---|
| Picture Styles (menu) | 6 estilos prontos (moldura branca, sombra, canto arredondado, borda suave, reflexo, oval) | Com imagem selecionada | Quatro quadrados coloridos | — |
| Alt Text | Abre o diálogo de texto alternativo | Com imagem | Imagem com linhas | — |

**Notas para recriar no mdOffice:** o mdOffice tem contorno e sombra genéricos, sem estilos prontos de imagem; os 6 presets do DeckCraft são combinações de comandos já existentes — bons candidatos a uma galeria no mdOffice.

### Grupo "Organizar"

| Botão/menu | O que faz | Estado (quando habilita/marca/contextual) | Ícone (descrição curta) | Atalho |
|---|---|---|---|---|
| (mesmo grupo da aba Formato da Forma) | Ordem, painel, alinhar, grupo e giro | Com seleção | — | — |

**Notas para recriar no mdOffice:** o mdOffice já tem o equivalente na aba Formato; ao recriar, reaproveitar o mesmo grupo nas duas abas.

### Grupo "Recorte"

| Botão/menu | O que faz | Estado (quando habilita/marca/contextual) | Ícone (descrição curta) | Atalho |
|---|---|---|---|---|
| Crop (menu) | "Crop to Shape" (galeria) + "Crop 10% each side", "Crop 20% each side", "Reset Crop" | Com imagem selecionada | Marcas de recorte | — |

**Notas para recriar no mdOffice:** o mdOffice recorta pelos 4 lados e tem formato retângulo/elipse/arredondado; faltam proporção/travar e o recorte por porcentagem (fácil de acrescentar ao menu).

### Grupo "Tamanho"

| Botão/menu | O que faz | Estado (quando habilita/marca/contextual) | Ícone (descrição curta) | Atalho |
|---|---|---|---|---|
| Height / Width | Altura e largura exatas | Com imagem selecionada | — | — |

**Notas para recriar no mdOffice:** igual ao grupo Tamanho da aba Formato da Forma — reaproveitar.

---

## Design da Tabela (Table Design) — contextual

Aparece quando há tabela (ou texto em célula) selecionada.

### Grupo "Opções de Estilo"

| Botão/menu | O que faz | Estado (quando habilita/marca/contextual) | Ícone (descrição curta) | Atalho |
|---|---|---|---|---|
| Header Row | Liga a linha de cabeçalho | Caixa marcada conforme a tabela | — | — |
| First Column | Liga a primeira coluna destacada | Idem | — | — |
| Total Row | Liga a linha de total | Idem | — | — |
| Last Column | Liga a última coluna destacada | Idem | — | — |
| Banded Rows | Liga as faixas alternadas de linha | Idem | — | — |
| Banded Columns | Liga as faixas alternadas de coluna | Idem | — | — |

**Notas para recriar no mdOffice:** o mdOffice tem Linha de cabeçalho, Linhas em faixas e Primeira coluna; faltam Total Row, Last Column e Banded Columns (três das seis caixas). O painel das seis em duas colunas é o desenho a copiar.

### Grupo "Estilos de Tabela"

| Botão/menu | O que faz | Estado (quando habilita/marca/contextual) | Ícone (descrição curta) | Atalho |
|---|---|---|---|---|
| Galeria | Estilos prontos com miniatura pintada; marca o estilo atual | Com tabela selecionada | Miniaturas de tabela | — |
| Seta "mais" (menu) | Lista completa de estilos | Com tabela selecionada | — | — |

**Notas para recriar no mdOffice:** o mdOffice já tem presets com nomes; falta a miniatura pintada e o menu "mais" (o mdOffice usa uma lista simples). Melhoria visual direta.

### Grupo "Sombreamento"

| Botão/menu | O que faz | Estado (quando habilita/marca/contextual) | Ícone (descrição curta) | Atalho |
|---|---|---|---|---|
| Shading (dividido) | Pinta a célula com o acento 1; seta abre a grade + "No Fill" | Com tabela selecionada | Tabela com células amarelas | — |

**Notas para recriar no mdOffice:** o mdOffice chama o mesmo de "Sombreamento" no grupo Estilos de Tabela; equivalente coberto (só separar em grupo próprio, se quiser fidelidade).

---

## Layout (tabela) — contextual

Aparece junto com o Design da Tabela.

### Grupo "Linhas e Colunas"

| Botão/menu | O que faz | Estado (quando habilita/marca/contextual) | Ícone (descrição curta) | Atalho |
|---|---|---|---|---|
| Delete (menu) | "Delete Columns", "Delete Rows", "Delete Table" | Com tabela selecionada | Tabela com "×" vermelho | — |
| Insert Above | Insere linha acima | Idem | Tabela com bloco verde em cima | — |
| Insert Below | Insere linha abaixo | Idem | Bloco verde embaixo | — |
| Insert Left | Insere coluna à esquerda | Idem | Bloco verde à esquerda | — |
| Insert Right | Insere coluna à direita | Idem | Bloco verde à direita | — |

**Notas para recriar no mdOffice:** o mdOffice tem inserir/excluir linha e coluna e excluir tabela (como botão); o menu "Delete" com as três opções juntas é mais compacto — bom ajuste.

### Grupo "Mesclar"

| Botão/menu | O que faz | Estado (quando habilita/marca/contextual) | Ícone (descrição curta) | Atalho |
|---|---|---|---|---|
| Merge Cells | Junta as células selecionadas | Com tabela | Duas células com setas convergindo | — |
| Split Cells | Divide a célula | Com tabela | Célula dividida com setas | — |

**Notas para recriar no mdOffice:** o mdOffice tem mesclar e dividir; equivalente coberto.

### Grupo "Tamanho da Célula"

| Botão/menu | O que faz | Estado (quando habilita/marca/contextual) | Ícone (descrição curta) | Atalho |
|---|---|---|---|---|
| Distribute Rows | Iguala as alturas | Com tabela | Três barras entre linhas | — |
| Distribute Columns | Iguala as larguras | Com tabela | Três barras entre colunas | — |

**Notas para recriar no mdOffice:** o mdOffice tem largura/altura exatas, mas não distribuir (no roadmap: parcial) — dois botões a acrescentar.

### Grupo "Alinhamento"

| Botão/menu | O que faz | Estado (quando habilita/marca/contextual) | Ícone (descrição curta) | Atalho |
|---|---|---|---|---|
| Align Left / Center / Align Right | Alinhamento horizontal do texto da célula | Com tabela | Linhas de texto alinhadas | Ctrl+L / Ctrl+E / Ctrl+R |
| Top / Center / Bottom | Alinhamento vertical do texto | Com tabela | — | — |

**Notas para recriar no mdOffice:** o mdOffice tem alinhamento vertical na aba Layout da Tabela e horizontal no grupo Parágrafo; equivalente coberto (só o "Center/Bottom" por botões pequenos de texto, que o mdOffice já usa).

### Grupo "Organizar"

| Botão/menu | O que faz | Estado (quando habilita/marca/contextual) | Ícone (descrição curta) | Atalho |
|---|---|---|---|---|
| (mesmo grupo da aba Formato da Forma) | Ordem, painel, alinhar, grupo e giro | Com tabela selecionada | — | — |

**Notas para recriar no mdOffice:** reaproveitar o grupo Organizar já existente na aba Formato da Forma.

---

## Design do Gráfico (Chart Design) — contextual

Aparece quando há gráfico selecionado.

### Grupo "Gráfico"

| Botão/menu | O que faz | Estado (quando habilita/marca/contextual) | Ícone (descrição curta) | Atalho |
|---|---|---|---|---|
| Change Chart Type (menu) | Troca o tipo mantendo os dados | Com gráfico selecionado | Pizza e barras | — |
| Edit Data | Abre o diálogo de dados do gráfico | Com gráfico selecionado | Tabela com lápis amarelo | — |

**Notas para recriar no mdOffice:** o mdOffice edita dados no painel e cria 7 tipos; falta "Mudar Tipo" sem perder os dados — botão pequeno e útil.

### Grupo "Organizar"

| Botão/menu | O que faz | Estado (quando habilita/marca/contextual) | Ícone (descrição curta) | Atalho |
|---|---|---|---|---|
| (mesmo grupo da aba Formato da Forma) | Ordem, painel, alinhar, grupo e giro | Com gráfico selecionado | — | — |

**Notas para recriar no mdOffice:** reaproveitar o grupo Organizar.

---

## Reprodução (Playback) — contextual

Aparece quando há mídia (áudio/vídeo) selecionada.

### Grupo "Reprodução"

| Botão/menu | O que faz | Estado (quando habilita/marca/contextual) | Ícone (descrição curta) | Atalho |
|---|---|---|---|---|
| Play / Pause | Reproduz ou pausa a mídia selecionada | Com mídia selecionada; vira "Pause" durante a reprodução | Triângulo verde / duas barras | Alt+P |
| Trim | Abre o diálogo de corte da mídia | Com mídia selecionada | Trilho de mídia com alças | — |

**Notas para recriar no mdOffice:** sem equivalente (mídia 0/7 na paridade). O par Play/Pause com troca de rótulo e o Trim são o mínimo da experiência.

### Grupo "Opções de Reprodução"

| Botão/menu | O que faz | Estado (quando habilita/marca/contextual) | Ícone (descrição curta) | Atalho |
|---|---|---|---|---|
| Start Automatically | Começa sozinho no show | Caixa marcada conforme a mídia | — | — |
| Play Across Slides | Continua nas outras lâminas | Idem | — | — |
| Loop until Stopped | Repete até parar | Idem | — | — |
| Hide During Show | Some durante o show | Idem | — | — |
| Rewind after Playing | Volta ao início ao terminar | Idem | — | — |
| Play Full Screen | Reproduz em tela cheia | Idem | — | — |

**Notas para recriar no mdOffice:** sem equivalente; as seis caixas são o modelo de opções de mídia quando o mdOffice reproduzir áudio/vídeo.

### Grupo "Volume"

| Botão/menu | O que faz | Estado (quando habilita/marca/contextual) | Ícone (descrição curta) | Atalho |
|---|---|---|---|---|
| Volume (menu) | Low, Medium, High, Mute | Com mídia selecionada | Alto-falante com três ondas | — |

**Notas para recriar no mdOffice:** sem equivalente; menu de 4 níveis, simples de transportar.

---

## Slide Master — contextual

Aparece quando a edição está no mestre/layout (a seleção não é de lâmina).

### Grupo "Editar Layout"

| Botão/menu | O que faz | Estado (quando habilita/marca/contextual) | Ícone (descrição curta) | Atalho |
|---|---|---|---|---|
| Insert Layout | Cria um layout novo | No modo mestre | Lâmina com "+" | — |
| Delete | Apaga o layout selecionado | No modo mestre | Lâmina com "×" | — |
| Rename | Renomeia o layout | No modo mestre | Lâmina com lápis | — |

**Notas para recriar no mdOffice:** o mdOffice não edita layouts (só lê do .pptx); os três botões são o começo do modo mestre (pendência P0 "Slide Master view").

### Grupo "Inserir Placeholder"

| Botão/menu | O que faz | Estado (quando habilita/marca/contextual) | Ícone (descrição curta) | Atalho |
|---|---|---|---|---|
| Insert Placeholder (menu) | Content, Text, Picture, Chart, Table, Media | No modo mestre | Tabela 3×3 | — |

**Notas para recriar no mdOffice:** sem equivalente; o menu dos 6 tipos de placeholder é o modelo para o futuro editor de layouts.

### Grupo "Temas"

| Botão/menu | O que faz | Estado (quando habilita/marca/contextual) | Ícone (descrição curta) | Atalho |
|---|---|---|---|---|
| Themes (menu) | Aplica um tema embutido ao mestre | No modo mestre | Duas lâminas com "Aa" | — |
| Background Styles | Abre o painel de fundo | No modo mestre | Lâmina com pincel | — |

**Notas para recriar no mdOffice:** depende do modo mestre; reaproveita o grupo Tema/Variantes do Design.

### Grupo "Fechar"

| Botão/menu | O que faz | Estado (quando habilita/marca/contextual) | Ícone (descrição curta) | Atalho |
|---|---|---|---|---|
| Close Master View | Volta à edição normal | No modo mestre | "×" | — |

**Notas para recriar no mdOffice:** sem equivalente até existir o modo mestre; o botão é o par do "Slide Master" na aba Exibir.

---

## Comportamentos transversais (para recriar fielmente)

### Barra de título (acesso rápido)

| Item | O que faz | Estado (quando habilita/marca) | Ícone (descrição curta) | Atalho |
|---|---|---|---|---|
| Home | Abre o File (backstage) na página Home | Marca quando o File está aberto | Casa | — |
| Save | Salva a apresentação | Só com documento; sem caminho cai em "salvar como" | Disquete | Ctrl+S |
| Undo | Desfaz | Só quando há o que desfazer | Seta curva para a esquerda | Ctrl+Z |
| Redo | Refaz | Só quando há o que refazer | Seta curva para a direita | Ctrl+Y |
| Play from Start | Inicia o show | Com documento | Lâmina com triângulo | F5 |
| Título central | Mostra o nome do arquivo + " — Edited" quando há alterações | Sempre | — | — |
| Search commands | Abre a paleta de comandos | Sempre | Lupa | Ctrl+Shift+P |
| "Present" | Inicia o show do slide atual | Com documento | — | — |
| Comments | Mostra/esconde o painel de comentários | Com documento; marca quando aberto | Balão de fala | — |
| Light/Dark | Alterna o tema | Sempre | Paleta (claro) / brilho (escuro) | — |

**Notas para recriar no mdOffice:** a barra superior do mdOffice já tem novo/abrir/salvar/exportar etc.; o que falta é o par Undo/Redo, o "Apresentar" em destaque e o alternador claro/escuro — todos já existem em outros lugares do app.

### Regras de estado (valem para todas as abas)

- **Habilitado/desabilitado:** cada botão segue o comando por trás. Desabilitado = ícone e rótulo esmaecidos, sem reação ao mouse. As regras mais comuns: exige apresentação aberta; exige lâmina; exige seleção; exige 2+ formas; exige texto ou forma; exige histórico (desfazer/refazer).
- **Marcado (ligado):** o botão fica com fundo preenchido; nos grupos de galeria, a miniatura atual ganha moldura de destaque. Exemplos: negrito quando o trecho está em negrito; a transição aplicada; a cor/espessura da caneta ativa.
- **Contextual:** as sete abas contextuais aparecem na ordem Slide Master → Formato da Forma → Formato da Imagem → Design da Tabela → Layout → Design do Gráfico → Reprodução. Regras: Formato da Forma com forma/grupo/conector ou edição de texto; Formato da Imagem com imagem; Design da Tabela e Layout com tabela ou célula em edição; Design do Gráfico com gráfico; Reprodução com mídia; Slide Master quando a edição está no mestre.
- **Dicas (tooltips):** todo botão mostra o rótulo e, quando existe, o atalho entre parênteses. No macOS o app troca Ctrl por ⌘.
- **Recolher a fita:** clicar na aba ativa, dar duplo clique em qualquer aba ou Ctrl+F1; clicar de novo (ou escolher uma aba) reabre.
- **Geometria da fita:** barra de título ~38 px; linha de abas ~28 px; cartão da fita ~66 px de conteúdo + margens, cantos arredondados; grupos separados por um traço vertical de ~13 px de largura; botões grandes com ícone ~32 px e rótulo de 11 px em até 2 linhas; pequenos com ícone ~17 px e rótulo de 12 px.
- **Menus:** os botões com seta abrem menus suspensos ancorados; itens de menu podem ter ícone; separadores agrupam seções (ex.: "Order Objects" / "Group Objects" / "Position Objects" no menu Organizar). Escolher um item fecha o menu; os menus de cor permanecem abertos até a escolha.
- **O que não existe (não inventar):** barra de menus nativa fora do macOS (o app tem uma árvore de menus usada no macOS e como catálogo); sem contas/login; sem gravação de áudio/câmera; sem remover fundo de imagem; sem SmartArt avançado (só o diálogo); sem folhetos/anotações mestre; a caixa "Show Media Controls" não faz nada.
