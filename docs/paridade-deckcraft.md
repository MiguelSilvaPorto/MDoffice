# Paridade: mdCreator × DeckCraft — checklist de pendências

> **Comparação:** o motor de apresentações do **mdCreator** contra o **[DeckCraft](https://github.com/storytold/deckcraft)**
> — a reimplementação open-source do PowerPoint em Rust puro (ArtCraft), em alpha.
> **Base do checklist:** `docs/parity-checklist.md` do DeckCraft (191 features medidas contra o
> PowerPoint for Mac 16.113, em 10/10/2026), cruzado com a paleta de comandos real do app.
> **Última revisão deste documento:** 13/10/2026.

**Como ler**

- `- [x]` — **existe no mdCreator** (quando for o caso, a nota diz o que é parcial)
- `- [ ]` — **não existe** (é pendência)
- `P0/P1/P2` — prioridade que o DeckCraft dá à feature (P0 = essencial para trocar do PowerPoint)
- A nota curta traz a evidência do lado do mdCreator (motor/fita/painel) e o que falta

**Resumo por área** (itens do DeckCraft já cobertos pelo mdCreator):

| Área | Cobertos | Área | Cobertos |
|---|---:|---|---:|
| Application shell | 10/11 | Media | 4/7 |
| Files | 7/18 | Transitions | 3/5 |
| Slides | 5/9 | Animations | 0/8 |
| Views | 6/10 | Slide show | 3/10 |
| Masters & themes | 6/14 | Review | 1/4 |
| Shapes | 5/14 | Draw | 0/2 |
| Format | 7/11 | Undo & clipboard | 2/3 |
| Arrange | 7/9 | Automation | 1/2 |
| Text | 14/25 | Platforms | 1/3 |
| Tables | 7/8 | **Total** | **99/191** |
| Charts | 4/5 | | |
| SmartArt | 0/2 | | |
| Pictures | 6/11 | | |

As maiores lacunas são as áreas que o DeckCraft marca como o coração da troca do PowerPoint:
**SmartArt, animações, gravação (áudio/tela), apresentação (presenter view/ink) e masters**.
Do outro lado, o mdCreator já tem boa parte do **editor** (formas, texto, tabelas, formatos,
organização, desfazer) e um **import/export .pptx de alta fidelidade** — e coisas que o DeckCraft
não tem (IA local, tradução, suíte Word/Excel/Markdown, backup e histórico).

---

## Application shell (10/11)

- [x] **Start screen (new, templates/themes, recent)** — P0 · parcial: tela **Início** com os 4 formatos, recentes, rascunhos e busca; temas/modelos ficam dentro do editor (botão **Template** na fita do PowerPoint, 6 modelos)
- [x] **Ribbon with Home/Insert/Draw/Design/Transitions/Animations/Slide Show/Review/View tabs** — P0 · parcial: fita com **6 abas** (Página Inicial, Inserir, Formato da Forma, Layout da Tabela, Design, Exibir); faltam Draw, Transitions, Animations, Slide Show, Review e Record
- [x] **Contextual tabs (Shape Format, Picture Format, Table Design/Layout, Chart Design)** — P0 · parcial: **Formato da Forma** e **Layout da Tabela** aparecem conforme a seleção; faltam Picture Format e Chart Design
- [x] **Quick Access toolbar / title bar commands** — P1 · parcial: barra superior do app (novo, abrir, salvar, salvamento automático, desenhar, exportar, ⋯)
- [ ] **Native menu bar (macOS) with every command** — P1 · falta (app Windows/Tauri; sem barra de menus nativa)
- [x] **Command palette / Tell me search** — P1 · tem: **Ctrl+K** busca comandos e documentos
- [x] **Keyboard shortcuts for every common command** — P0 · tem: atalhos no editor e no PowerPoint (Ctrl+Z/Y, Ctrl+C/X/V/D, Ctrl+G, setas, F5…)
- [x] **Status bar (slide counter, notes, comments, views, zoom)** — P0 · parcial: posição da lâmina, zoom e dicas; sem contadores de comentários/anotações
- [x] **Light and dark appearance** — P1 · tem: tema claro/escuro (e "papel" na exportação)
- [x] **Multiple open presentations** — P1 · tem: abas estilo Chrome com estado por documento
- [x] **Preferences (autosave, units, defaults)** — P2 · tem: aba **Configurações** (escrita, tradução, histórico/backup, aparência, atalhos)

## Files (7/18)

- [x] **New blank presentation** — P0 · tem: card PowerPoint no Início / menu "+"
- [ ] **Native file format (open/save)** — P0 · falta: o formato de trabalho é o **.pptx**; não há um formato próprio (o DeckCraft tem `.deckcraft`)
- [x] **Open PowerPoint .pptx** — P0 · tem: importador fiel (formas, grupos, texto por trecho, fundos, mestre/layout, fontes embutidas)
- [x] **Save as PowerPoint .pptx** — P0 · tem: exportador em XML próprio, devolve fontes embutidas e o que não modela
- [ ] **Open/save .potx/.ppsx/.pptm variants** — P2 · falta
- [ ] **Legacy .ppt (binary) import** — P2 · falta (o app avisa para salvar no formato novo)
- [ ] **Save as template** — P1 · falta (há modelos internos, mas não salvar o deck como template)
- [x] **Autosave and crash recovery** — P0 · tem: salvamento automático + rascunhos + backup em disco + histórico de versões
- [ ] **Document properties** — P2 · falta (título/autor/assunto não são editados nem gravados no .pptx)
- [x] **Export to PDF (slides, notes pages, handouts; text layer, links, bookmarks)** — P0 · parcial: no modo apresentação, **Ctrl+P** imprime a lâmina (vira PDF pelo sistema); sem notas/handouts nem camada de texto
- [ ] **Export slides as PNG/JPEG** — P0 · falta
- [ ] **Export outline / RTF** — P2 · falta
- [ ] **Export video (MP4) / animated GIF** — P2 · falta
- [x] **Print (slides, handouts, notes, outline)** — P1 · parcial: imprimir a apresentação (Ctrl+P); sem handouts/notas
- [ ] **Password protection** — P2 · falta
- [ ] **Reuse slides from another file** — P1 · falta
- [x] **Drag and drop files onto the window** — P1 · tem (imagens e documentos)
- [ ] **OpenDocument .odp open/save** — P2 · falta

## Slides (5/9)

- [x] **New slide by layout** — P0 · tem: "Nova lâmina" pergunta o layout
- [x] **Duplicate, delete, hide slides** — P0 · parcial: duplicar e excluir; **ocultar lâmina** não existe
- [x] **Reorder slides (thumbnails, sorter)** — P0 · tem: arrastar as miniaturas (faixa horizontal ou vertical)
- [ ] **Sections (add, rename, remove, move, collapse)** — P1 · falta
- [x] **Slide layouts (11 standard)** — P0 · parcial: **6 layouts** (Capa, Cabeçalho da seção, Título e conteúdo, Duas colunas, Somente o título, Em branco)
- [ ] **Reset slide** — P1 · falta
- [x] **Slides from outline** — P2 · parcial: o app cria um deck a partir de Markdown (`deckFromMarkdown`, usado em "Apresentar"); não há o comando no editor de slides
- [ ] **Copy/paste slides between decks** — P1 · falta (copiar/colar formas existe; lâminas entre decks não)
- [ ] **Zoom (summary, section and slide zoom)** — P2 · falta (o zoom existente é o de visualização do palco)

## Views (6/10)

- [x] **Normal view (thumbnails, slide, notes)** — P0 · tem: miniaturas + palco + painel de notas
- [ ] **Outline view** — P1 · falta no PowerPoint (o app tem o painel **Estrutura** para Markdown/Word)
- [x] **Slide Sorter** — P0 · parcial: faixa de miniaturas com reordenar; não é uma view separada
- [ ] **Notes Page** — P1 · falta
- [x] **Reading View** — P1 · parcial: **F5** abre a apresentação em tela cheia; não há view "de leitura" dentro da janela
- [x] **Zoom, fit to window** — P0 · tem: zoom do palco (40–400%, com Ctrl+roda ancorado no ponteiro)
- [x] **Rulers, gridlines, guides** — P1 · parcial: **grade** e **guias de encaixe**; sem réguas
- [x] **Smart guides** — P1 · tem: guias de encaixe ao mover/redimensionar
- [ ] **Grayscale / black and white view** — P2 · falta
- [ ] **New window / arrange windows** — P2 · falta

## Masters & themes (6/14)

- [ ] **Slide Master view (edit master and layouts)** — P0 · falta (o app **lê** mestre/layout do .pptx e mantém as decorações, mas não os edita)
- [ ] **Insert/rename/delete layouts, insert placeholders** — P1 · falta
- [ ] **Handout and Notes masters** — P2 · falta
- [x] **Built-in themes (original designs)** — P0 · tem: 3 temas (claro/escuro/contraste) + 6 modelos de deck
- [ ] **Theme variants** — P1 · falta
- [x] **Colour schemes (built-in and custom)** — P0 · parcial: paleta do deck e cores do documento (importadas); sem editor de esquema de cores
- [x] **Font schemes (built-in and custom)** — P0 · parcial: fonte do deck nos modelos/Configurar; sem esquemas de fonte nomeados
- [ ] **Effect schemes / background styles** — P2 · falta
- [x] **Format background (solid, gradient, picture, pattern)** — P0 · parcial: cor, gradiente e imagem (padrão/textura não); aplicar a todas as lâminas
- [ ] **Hide background graphics** — P1 · falta
- [x] **Slide size (16:9, 4:3, presets, custom)** — P0 · parcial: 16:9 e 4:3 na UI; tamanhos custom (`widthIn`/`heightIn`) são preservados do .pptx
- [x] **Header & footer (date, slide number, footer)** — P1 · parcial: rodapé e número da lâmina; sem campo de data
- [ ] **Browse themes from .pptx/.thmx** — P2 · falta
- [ ] **Designer layout suggestions (offline)** — P2 · falta

## Shapes (5/14)

- [x] **Preset shapes (lines, rectangles, basic, arrows, equation, flowchart, stars, callouts)** — P0 · parcial: ~40 na galeria; o render/importação cobrem ~60 geometrias (o DeckCraft tem 150+)
- [ ] **Action buttons** — P2 · falta
- [x] **Adjustment handles** — P0 · tem: ajustes por geometria no painel (setas, estrela, balão, cantos…)
- [x] **Connectors (straight, elbow, curved)** — P0 · tem: linha, seta, seta dupla, conector angular e curvo
- [ ] **Connector glue to connection sites** — P1 · falta (as linhas são formas independentes)
- [ ] **Freeform, curve and scribble tools** — P1 · falta (o importador lê formas livres; não há ferramenta para desenhar)
- [ ] **Edit points** — P1 · falta
- [ ] **Merge shapes (union, combine, fragment, intersect, subtract)** — P1 · falta
- [ ] **Change shape** — P1 · falta
- [x] **Text boxes** — P0 · tem
- [ ] **WordArt** — P1 · falta
- [ ] **Text warp transforms** — P2 · falta
- [x] **Shape quick styles** — P1 · tem: 6 estilos rápidos (cheio, contorno, gradiente, cartão, escuro, suave)
- [ ] **Set as default shape** — P2 · falta

## Format (7/11)

- [x] **Solid fill and transparency** — P0 · tem
- [x] **Gradient fill (linear, radial, rectangular, path)** — P0 · parcial: linear e radial (com paradas, ângulo e inverter); sem retangular/path
- [x] **Picture and texture fill** — P1 · parcial: imagem sim; textura não
- [ ] **Pattern fill** — P2 · falta
- [x] **Line colour, width, dash, compound, cap, join** — P0 · parcial: cor, espessura, transparência, 6 traços, pontas e cap; sem compound/join
- [x] **Arrowheads** — P0 · tem: 6 pontas (triângulo, seta, fina, losango, círculo…)
- [x] **Shadow (outer, inner, presets)** — P1 · tem: 6 sombras prontas + cor/transparência/desfoque/distância/ângulo
- [ ] **Reflection, glow, soft edges** — P2 · falta
- [ ] **Bevel and 3-D rotation** — P2 · falta
- [ ] **Format Painter** — P1 · falta
- [x] **Format Shape pane** — P0 · tem: painel **Formatar** completo (imagem, preenchimento, linha, efeitos, ajustes, tamanho, texto)

## Arrange (7/9)

- [x] **Size and position (exact), lock aspect ratio** — P0 · parcial: largura/altura/posição exatas em cm; sem travar proporção
- [x] **Rotate and flip** — P0 · tem: rotação livre + 90°, espelhar H/V
- [x] **Bring forward / send backward / to front / to back** — P0 · tem
- [x] **Align and distribute** — P0 · tem (6 alinhamentos + distribuir H/V)
- [x] **Group, ungroup, regroup** — P0 · parcial: agrupar/desagrupar; sem "reagrupar"
- [ ] **Selection pane (names, visibility, order)** — P1 · falta
- [x] **Nudge, duplicate with repeat offset** — P1 · parcial: setas movem (Shift = passo maior, Alt = fino) e Ctrl+D duplica; sem repetição por deslocamento
- [x] **Lock shapes** — P2 · tem: bloquear posição e tamanho
- [ ] **Alt text** — P1 · falta

## Text (14/25)

- [x] **In-place text editing (caret, selection, mouse, keyboard)** — P0 · tem: edição direta na forma, com formatação por trecho
- [x] **Font, size, bold, italic, underline, strikethrough** — P0 · tem (fontes do sistema + embutidas do .pptx, com os pesos certos)
- [x] **Font colour, highlight** — P0 · parcial: cor sim; **marca-texto** não
- [x] **Superscript, subscript, caps, character spacing** — P1 · parcial: o modelo e o round-trip preservam (`baseline`, `caps`, `spc`); sem controles na fita/painel
- [x] **Change case, grow/shrink font, clear formatting** — P1 · parcial: aumentar/diminuir fonte; sem mudar caixa nem limpar formatação
- [ ] **Text outline and text effects** — P2 · falta
- [x] **Paragraph alignment, indents, spacing, line spacing** — P0 · tem
- [x] **Bullets and numbering** — P0 · tem
- [ ] **Picture bullets, custom bullet symbols** — P2 · falta
- [x] **List levels (Tab / Shift+Tab)** — P0 · tem: recuo de nível
- [ ] **Tab stops** — P2 · falta
- [ ] **Columns** — P2 · falta
- [x] **Vertical anchor, margins, wrap** — P0 · tem
- [x] **Autofit (shrink on overflow, resize shape)** — P0 · parcial: preserva o `normAutofit` do .pptx; sem controles para aplicar
- [x] **Text direction (rotated, stacked)** — P1 · tem: girar 90°/270°
- [ ] **Find and replace, replace fonts** — P1 · falta no PowerPoint
- [ ] **Spelling check** — P1 · falta no PowerPoint (o app tem corretor no Markdown/Word)
- [ ] **Thesaurus** — P2 · falta
- [ ] **AutoCorrect and smart quotes** — P2 · falta no PowerPoint
- [x] **Symbols and emoji** — P1 · parcial: digitação normal aceita; sem galeria de símbolos
- [ ] **Equations** — P2 · falta
- [x] **Hyperlinks (URL, slide, email)** — P1 · parcial: importa e preserva o link; sem controles para inserir
- [x] **Date/time and slide number fields** — P1 · parcial: número da lâmina e rodapé; sem campo de data
- [ ] **Right-to-left and complex scripts** — P1 · falta
- [ ] **East Asian text (CJK fonts, line breaking)** — P1 · falta

## Tables (7/8)

- [x] **Insert table (grid picker, dialog)** — P0 · tem: grade 6×8 no Inserir
- [ ] **Draw table** — P2 · falta
- [x] **Table styles and style options** — P0 · tem: presets + cabeçalho/faixas/primeira coluna
- [x] **Insert/delete rows and columns** — P0 · tem
- [x] **Merge and split cells** — P1 · tem
- [x] **Distribute rows/columns, sizes** — P1 · parcial: largura de coluna e altura de linha exatas; sem distribuir
- [x] **Cell fill, borders, margins, alignment** — P1 · parcial: preenchimento, bordas e alinhamento vertical; margens de célula não
- [x] **Keyboard navigation between cells** — P0 · tem: Tab/Shift+Tab, setas e digitação direta

## Charts (4/5)

- [x] **Insert chart (column, bar, line, area, pie, doughnut, scatter)** — P0 · tem: **Inserir > Gráfico** (colunas, barras, linhas, área, pizza, rosca e dispersão), desenhado em SVG
- [ ] **Other chart types (radar, stock, combo, waterfall, funnel, treemap, sunburst, histogram, box)** — P2 · falta
- [x] **Edit chart data** — P0 · tem: tabela de dados no painel (categorias × séries, adicionar/remover categoria e série)
- [x] **Chart elements (title, legend, labels, axes, gridlines)** — P1 · parcial: título, legenda, rótulos de dados, eixos e grade; sem formatação individual de cada elemento
- [x] **Chart styles and colours** — P2 · parcial: cor por série (a paleta do deck entra na criação); sem estilos prontos

> O gráfico é desenhado em SVG pelo motor; no .pptx exportado ele vira **imagem** (o `c:chart` nativo ainda não é escrito). Gráficos de um .pptx importado continuam como aviso, e o arquivo os mantém no round-trip.

## SmartArt (0/2)

- [ ] **Insert SmartArt (lists, processes, cycles, hierarchy)** — P1 · falta
- [ ] **Text pane and layout switching** — P2 · falta

## Pictures (6/11)

- [x] **Insert picture (PNG, JPEG, GIF, WebP, BMP, TIFF)** — P0 · tem
- [x] **SVG pictures** — P1 · parcial: inserir SVG funciona pelo navegador; importar .pptx com SVG não
- [x] **Crop (and crop to shape, aspect ratio)** — P0 · parcial: recorte pelos 4 lados e formato retângulo/elipse/arredondado; sem proporção/travar
- [ ] **Corrections, colour, transparency** — P1 · falta (brilho/contraste/saturação)
- [ ] **Artistic effects** — P2 · falta
- [ ] **Remove background** — P2 · falta
- [x] **Picture styles and borders** — P1 · parcial: contorno e sombra (comuns a formas); sem estilos prontos
- [x] **Change / reset picture** — P1 · parcial: trocar imagem e redefinir recorte; sem reset geral
- [ ] **Compress pictures** — P2 · falta
- [x] **Paste image from clipboard** — P0 · tem: Ctrl+V cola imagem
- [ ] **Insert screenshot** — P2 · falta

## Media (4/7)

- [x] **Insert audio (any common format)** — P0 · tem: **Inserir > Áudio** (mp3, wav, m4a, aac, ogg, flac), com o arquivo guardado no deck
- [x] **Insert video** — P1 · tem: **Inserir > Vídeo** (mp4, webm, ogv, mov, m4v); a capa é o primeiro quadro do vídeo
- [x] **Audio/video playback in the show** — P0 · tem: reprodução no F5 com controles opcionais, volume e corte (início/fim)
- [x] **Trim, fade in/out, volume, loop, play across slides** — P2 · parcial: corte, volume, repetir e **continuar em outras lâminas**; sem fade de entrada/saída
- [ ] **Record audio / screen recording** — P2 · falta
- [ ] **Icons, 3-D models, stock content** — P2 · falta
- [ ] **Embedded objects (OLE): insert; foreign objects kept on round trip** — P2 · falta (o importador avisa e mantém o que não modela)

> O áudio/vídeo vira parte do `.pptx` exportado (relação de vídeo/áudio + `p14:media` e a capa no `blip`); a importação lê os arquivos de mídia de volta para o modelo.

## Transitions (3/5)

- [x] **Transition gallery (fade, push, wipe, split, cover, uncover, zoom, morph…)** — P0 · parcial: 7 tipos (**Sem, Fade, Push, Wipe, Split, Cover e Uncover**), com prévia na fita; sem Zoom nem Morph
- [x] **Effect options and duration** — P0 · tem: direção (quando o tipo aceita) e duração (0,5 s / 1 s / 2 s)
- [x] **Advance on click / after time, apply to all** — P0 · parcial: avanço no clique e **Aplicar a todas**; sem avanço automático por tempo (o XML cru do .pptx é preservado)
- [ ] **Transition sounds** — P2 · falta
- [ ] **Morph** — P1 · falta

> A transição toca no F5 (e na prévia) e faz o round-trip no `.pptx` (`p:transition` com `spd`/`p14:dur`/`dir`); efeitos desconhecidos ficam guardados crus.

## Animations (0/8)

- [ ] **Entrance, emphasis, exit effects** — P0 · falta
- [ ] **Motion paths** — P1 · falta
- [ ] **Effect options, start (on click/with/after), duration, delay** — P0 · falta
- [ ] **Animation pane (reorder, timing)** — P0 · falta
- [ ] **By-paragraph text builds** — P1 · falta
- [ ] **Triggers** — P2 · falta
- [ ] **Animation Painter** — P2 · falta
- [ ] **Preview in editor** — P1 · falta

## Slide show (3/10)

- [x] **Full-screen show from start / current** — P0 · tem: **F5**
- [x] **Navigation (keys, click, go to slide, blank screen)** — P0 · parcial: setas, espaço, PageUp/Down, clique; sem "ir para lâmina" nem tela em branco
- [x] **Presenter view (notes, next slide, timer)** — P0 · parcial: as notas aparecem na tela com **N**; sem janela do apresentador, próximo slide ou cronômetro
- [ ] **Pen and highlighter ink during the show** — P1 · falta
- [ ] **Laser pointer** — P2 · falta
- [ ] **Rehearse timings** — P2 · falta
- [ ] **Custom shows** — P2 · falta
- [ ] **Set up show (loop, kiosk, without animation)** — P1 · falta
- [ ] **Record slide show (narration)** — P2 · falta
- [ ] **Multi-monitor presenting** — P1 · falta

## Review (1/4)

- [ ] **Comments (add, reply, resolve, delete)** — P1 · falta
- [ ] **Accessibility checker** — P2 · falta
- [ ] **Compare presentations** — P2 · falta
- [x] **Track changes / version history** — P2 · tem: histórico de versões + log de alterações do app (restaurar em um clique)

## Draw (0/2)

- [ ] **Ink pens, highlighter, eraser** — P1 · falta no PowerPoint (o app tem desenho assistido no **Markdown**; não no slide)
- [ ] **Ink to shape / text** — P2 · falta

## Undo & clipboard (2/3)

- [x] **Unlimited undo/redo** — P0 · tem: histórico próprio da apresentação (digitação agrupada, mover, formatar, lâminas)
- [x] **Cut, copy, paste shapes and slides** — P0 · parcial: formas sim (Ctrl+C/X/V/D); lâminas entre decks não
- [ ] **Paste special (keep formatting, picture, text only)** — P1 · falta

## Automation (1/2)

- [x] **Every command scriptable (CLI, control channel, MCP)** — P0 · parcial: no app, **Ctrl+K** e todos os comandos internos são despachados por `run(comando)`; sem CLI, canal JSON ou MCP
- [ ] **Headless rendering and conversion** — P0 · falta

## Platforms (1/3)

- [x] **macOS, Windows, Linux builds** — P0 · parcial: **Windows** (Tauri 2)
- [ ] **Web (WASM) build** — P1 · falta
- [ ] **BSD build** — P2 · falta

---

## O que o mdCreator tem que o DeckCraft não tem

- **Suíte completa**: Word (.docx), Excel (.xlsx) e Markdown no mesmo app — o DeckCraft é só apresentações.
- **IA local**: corretor de português, sugestões enquanto digita (modelo de n-gramas + Gemma local), revisão inteligente com sinônimos.
- **Tradução automática PT-BR → inglês** com memória local, glossário e pré-visualização lado a lado.
- **Backup em disco** (duas pastas, política de limpeza, restauração) e **histórico com log de alterações**.
- **Importar do Office** (.docx/.xlsx/.xlsm/.pptx) direto pelo Início.
- **Exportar** Markdown para HTML/PDF/Word/TXT/pacote IA, com documento bilíngue.
- **Interface e dicionário em português** (o DeckCraft é inglês-only hoje).
- **Desenho assistido** e diagramas Mermaid no Markdown; projetos, contexto para IA e busca no conteúdo.

## Arquitetura e plataformas (contexto)

| | mdCreator | DeckCraft |
|---|---|---|
| Linguagem/UI | TypeScript + Tauri 2 (WebView2) | Rust puro + egui/wgpu |
| Modelo de slide | HTML/SVG por forma (fidelidade de import ~2%) | Rasterizador próprio (vello_cpu) |
| Formato principal | `.pptx` | `.deckcraft` + `.pptx` |
| Automação | paleta Ctrl+K e comandos internos | CLI + canal JSON + MCP |
| Plataformas | Windows | macOS, Windows, Linux, BSD, Web |

## Próximos passos sugeridos

Ordem sugerida para aproximar o motor do DeckCraft (impacto × esforço):

1. **Transições + animações básicas** (fade/push/wipe; aparecer/desaparecer) e reprodução no F5.
2. **Gráficos** (inserir, tipos comuns e editar dados) — o que mais aparece em decks de trabalho.
3. **Presenter view de verdade** (janela com notas, próximo slide e cronômetro).
4. **Exportar PDF e PNG do deck** sem depender do Ctrl+P, com notas/folhetos.
5. **Rápidos de lâmina**: ocultar, renomear, reset, seções e mais layouts (11).
6. **Mídia** (áudio/vídeo no slide e no show).
7. **Imagem**: SVG/EMF no import, correções (brilho/contraste) e crop com proporção.
8. **Texto**: marca-texto, sobrescrito/subscrito na UI, mudar caixa, limpar formatação, tabulações e colunas.
9. **Formas**: mesclar, editar pontos, forma livre e conector com cola.
10. **Clipboard**: colar mantendo a formatação (paste special) e lâminas entre decks.
