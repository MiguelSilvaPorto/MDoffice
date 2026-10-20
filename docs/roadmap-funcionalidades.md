# Roadmap de funcionalidades — Apresentações (PowerPoint)

> **O que é este documento:** o roadmap do módulo de **Apresentações** do mdOffice — o que já está
> pronto, o que está planejado e a prioridade de cada item, agrupado por área da fita. Cada item
> traz, na nota, o que o app entrega hoje (motor, fita, painel) e o que falta para fechar. É o
> roadmap linkado no [README](../README.md) e na [lista de funcionalidades](funcionalidades.md).
>
> **Régua de escopo:** no começo, o app usou o **[DeckCraft](https://getartcraft.com)** como
> **inspiração de produto** (ver a nota no [README](../README.md)): ele serviu para calibrar **o
> tamanho da ambição** — quais áreas um editor de apresentações precisa cobrir —, não como
> especificação nem como lista de cópia. Cada item abaixo foi **desenhado e implementado aqui**, e
> as decisões que são nossas (inclusive o que **não** entra no roadmap) estão no fim do documento.
>
> **Última revisão:** 20/10/2026 — itens re-verificados **contra o código do mdOffice**.

**Como ler**

- `- [x]` — **pronto** (a nota diz o que é parcial)
- `- [ ]` — **planejado** (é o backlog; a nota diz o que falta)
- `P0/P1/P2` — **prioridade do roadmap**: P0 = sem isso o módulo não substitui o PowerPoint no dia a
  dia; P1 = importante; P2 = depois
- O número ao lado do nome da área é **prontos / total** daquela área
- A nota curta traz a evidência do que existe hoje e o que falta

**Resumo por área**

<!-- contagens:inicio -->
| Área | Prontos | Total |
|---|---:|---:|
| Estrutura do app | 10 | 10 |
| Arquivos | 8 | 17 |
| Lâminas | 6 | 9 |
| Visões | 6 | 10 |
| Mestres e temas | 8 | 14 |
| Formas | 6 | 14 |
| Formatação | 7 | 11 |
| Organização | 7 | 9 |
| Texto | 14 | 25 |
| Tabelas | 7 | 8 |
| Gráficos | 4 | 5 |
| SmartArt | 0 | 2 |
| Imagens | 6 | 11 |
| Mídia | 4 | 7 |
| Transições | 3 | 5 |
| Animações | 6 | 8 |
| Apresentação | 3 | 10 |
| Revisão | 1 | 4 |
| Desenho | 2 | 2 |
| Desfazer e área de transferência | 2 | 3 |
| Automação | 1 | 2 |
| Plataformas | 1 | 2 |
| **Total** | **112** | **188** |
<!-- contagens:fim -->

**Onde estão as lacunas maiores:** as áreas que mais pesam para trocar o PowerPoint no dia a dia —
**SmartArt, animações, gravação (áudio/tela), apresentação (visor do apresentador/tinta) e
mestres**. Do outro lado, o módulo já tem boa parte do **editor** (formas, texto, tabelas,
formatação, organização, desfazer) e um **import/export .pptx de alta fidelidade** — além de coisas
que estão fora do escopo de um editor de slides e são o diferencial do app (IA local, tradução,
suíte Word/Excel/Markdown, backup e histórico).

## Escopo do editor (o que o módulo precisa editar)

> Levantado em **13/10/2026** a partir das ferramentas de edição de conteúdo do editor — só o que
> mexe no documento, na ordem do que pesa mais para as lâminas.

| # | Área | Escopo planejado | Hoje | Esforço |
|---|---|---|---|---|
| 1 | **Animações** | presets completos (entrada/ênfase/saída/trajetórias), início/duração/atraso, build por parágrafo, painel, pincel | entrada/saída + ênfase + voar/zoom + revelações e texturas (limpar, caixa, círculo, losango, dividir, persianas, dissolver, roda) + trajetória em linha (**29 presets**) com início/duração/atraso/direção, por parágrafo, prévia, painel, selos e round-trip do `p:timing`/`p:animMotion`; sem os demais presets (xadrez, barras, faixas, espiar…; curvas/voltas/laços) | pequena |
| 2 | **Morph e transições** | Morph (objetos/palavras/caracteres) + o quadro completo de transições, com opções por efeito | 7 efeitos; sem Morph nem opções por tipo | grande |
| 3 | **Formas** | mesclar (união/fragmentar/interseção/subtrair), editar pontos, forma livre/curva/rabisco, conector colado em pontos de conexão, botões de ação | nada disso | grande |
| 4 | **Mestre e layouts** | vista de mestre: editar master, criar/renomear/excluir layouts e placeholders | 6 layouts + "Editar elementos do layout" na própria lâmina | média-grande |
| 5 | **Gráfico nativo** | `c:chart` real (segue editável no PowerPoint), 12+ tipos | 7 tipos com editor de dados, mas **exporta como imagem** | grande |
| 6 | **Comentários** | threads com responder/resolver/excluir | nada | média |
| 7 | **Apresentação** | visor do apresentador (próxima lâmina, cronômetro), ensaiar tempos, caneta/laser, apresentar da lâmina atual, apresentações personalizadas | F5 simples com notas (**N**); sempre da 1ª lâmina | média |
| 8 | **Texto avançado** | pincel de formatação, símbolos/emoji, hyperlink, data/hora e campos, colunas, contorno/sombra de texto, WordArt, RTL/CJK | formatação por trecho já é boa; falta o resto | média |
| 9 | **Imagens** | correções (brilho/contraste/saturação/cinza), recorte com alças/proporção, EMF/WMF, GIF com play/pause | recorte básico pelos 4 lados e trocar imagem | média |
| 10 | **Lâminas** | seções, copiar/colar entre decks, reutilizar lâminas, lâminas a partir de estrutura, layout com re-mapeamento de placeholders | nada disso | média |
| 11 | **Tabelas** | distribuir linhas/colunas, largura/altura exatas, estilos prontos, desenhar tabela | largura/altura **sem controle na fita**; distribuir não existe | pequena |
| 12 | **Visões** | página de notas, estrutura (outline), classificador dedicado, modo leitura, réguas | vista normal + zoom | média |
| 13 | **SmartArt** | 6 layouts básicos (viram grupo de formas) | nada (o importador avisa) | média |
| 14 | **Mídia** | fade in/out, poster frame, mais codecs | corte/volume/loop/continuar em outras lâminas | pequena |

**Ganhos rápidos** (a infraestrutura já existe; falta só a porta de entrada): controle de largura de
coluna/altura de linha na tabela (os comandos já existem no host), lâminas a partir de estrutura
(`deckFromMarkdown` já existe), pincel de formatação, galeria de símbolos/emoji, data/hora e número
como campos, "apresentar da lâmina atual", texto alternativo (o campo já existe no schema),
correções simples de imagem e réguas.

---

## Estrutura do app (10/10)

- [x] **Tela de início (novo, modelos/temas, recentes)** — P0 · parcial: tela **Início** com os 4 formatos, recentes, rascunhos e busca; temas/modelos ficam dentro do editor (botão **Template** na fita do PowerPoint: os modelos do app + os do usuário)
- [x] **Fita com as abas Página Inicial/Inserir/Desenhar/Design/Transições/Animações/Apresentação/Revisão/Exibir** — P0 · parcial: fita com **9 abas** (Página Inicial, Inserir, **Desenhar**, **Transições**, **Animações**, Design e Exibir, mais **Formato da Forma** e **Layout da Tabela** quando a seleção pede); faltam Apresentação, Revisão e Gravar
- [x] **Abas contextuais (Formato da Forma, Formato da Imagem, Design/Leiaute da Tabela, Design do Gráfico)** — P0 · parcial: **Formato da Forma** e **Layout da Tabela** aparecem conforme a seleção; faltam Formato da Imagem e Design do Gráfico
- [x] **Barra de acesso rápido / comandos na barra de título** — P1 · parcial: barra superior do app (novo, abrir, salvar, salvamento automático, desenhar, exportar, ⋯)
- [x] **Paleta de comandos / busca "Tell me"** — P1 · tem: **Ctrl+K** busca comandos e documentos
- [x] **Atalhos de teclado para os comandos comuns** — P0 · tem: atalhos no editor e no PowerPoint (Ctrl+Z/Y, Ctrl+C/X/V/D, Ctrl+G, setas, F5…)
- [x] **Barra de status (contador de lâminas, notas, comentários, visões, zoom)** — P0 · parcial: posição da lâmina, zoom e dicas; sem contadores de comentários/anotações
- [x] **Aparência clara e escura** — P1 · tem: tema claro/escuro (e "papel" na exportação)
- [x] **Várias apresentações abertas** — P1 · tem: abas estilo Chrome com estado por documento
- [x] **Preferências (salvamento automático, unidades, padrões)** — P2 · tem: aba **Configurações** (escrita, tradução, histórico/backup, aparência, atalhos)

## Arquivos (8/17)

- [x] **Apresentação em branco** — P0 · tem: card PowerPoint no Início / menu "+"
- [x] **Abrir .pptx do PowerPoint** — P0 · tem: importador fiel (formas, grupos, texto por trecho, fundos, mestre/layout, fontes embutidas)
- [x] **Salvar como .pptx do PowerPoint** — P0 · tem: exportador em XML próprio, devolve fontes embutidas e o que não modela
- [ ] **Abrir/salvar variantes .potx/.ppsx/.pptm** — P2 · falta
- [ ] **Importar .ppt legado (binário)** — P2 · falta (o app avisa para salvar no formato novo)
- [x] **Salvar como modelo** — P1 · parcial: salvar o **visual** do deck atual como modelo do usuário (tema, fundo, fonte, cores) — não as lâminas
- [x] **Salvamento automático e recuperação de queda** — P0 · tem: salvamento automático + rascunhos + backup em disco + histórico de versões
- [ ] **Propriedades do documento** — P2 · falta (título/autor/assunto não são editados nem gravados no .pptx)
- [x] **Exportar para PDF (lâminas, páginas de notas, folhetos; camada de texto, links, marcadores)** — P0 · parcial: no modo apresentação, **Ctrl+P** imprime a lâmina (vira PDF pelo sistema); sem notas/folhetos nem camada de texto
- [ ] **Exportar lâminas como PNG/JPEG** — P0 · falta
- [ ] **Exportar estrutura / RTF** — P2 · falta
- [ ] **Exportar vídeo (MP4) / GIF animado** — P2 · falta
- [x] **Imprimir (lâminas, folhetos, notas, estrutura)** — P1 · parcial: imprimir a apresentação (Ctrl+P); sem folhetos/notas
- [ ] **Proteção por senha** — P2 · falta
- [ ] **Reutilizar lâminas de outro arquivo** — P1 · falta
- [x] **Arrastar e soltar arquivos na janela** — P1 · tem (imagens e documentos)
- [ ] **Abrir/salvar .odp (OpenDocument)** — P2 · falta

## Lâminas (6/9)

- [x] **Nova lâmina pelo layout** — P0 · tem: "Nova lâmina" pergunta o layout
- [x] **Duplicar, excluir e ocultar lâminas** — P0 · tem: duplicar, excluir e **ocultar/mostrar** (a miniatura marca e o F5 pula)
- [x] **Reordenar lâminas (miniaturas, classificador)** — P0 · tem: arrastar as miniaturas (faixa horizontal ou vertical)
- [ ] **Seções (adicionar, renomear, remover, mover, recolher)** — P1 · falta
- [x] **Layouts de lâmina (11 padrão)** — P0 · parcial: **6 layouts** (Capa, Cabeçalho da seção, Título e conteúdo, Duas colunas, Somente o título, Em branco)
- [x] **Redefinir lâmina** — P1 · tem: botão **Redefinir**
- [x] **Lâminas a partir de estrutura** — P2 · parcial: o app cria um deck a partir de Markdown (`deckFromMarkdown`, usado em "Apresentar"); não há o comando no editor de slides
- [ ] **Copiar/colar lâminas entre decks** — P1 · falta (copiar/colar formas existe; lâminas entre decks não)
- [ ] **Zoom de resumo, de seção e de lâmina** — P2 · falta (o zoom existente é o de visualização do palco)

## Visões (6/10)

- [x] **Visão normal (miniaturas, lâmina, notas)** — P0 · tem: miniaturas + palco + painel de notas
- [ ] **Visão de estrutura (outline)** — P1 · falta no PowerPoint (o app tem o painel **Estrutura** para Markdown/Word)
- [x] **Classificador de lâminas** — P0 · parcial: faixa de miniaturas com reordenar; não é uma visão separada
- [ ] **Página de notas** — P1 · falta
- [x] **Modo leitura** — P1 · parcial: o botão **Apresentar** abre a apresentação em tela cheia; não há uma visão "de leitura" dentro da janela
- [x] **Zoom, ajustar à janela** — P0 · tem: zoom do palco (40–400%, com Ctrl+roda ancorado no ponteiro)
- [x] **Réguas, grade e guias** — P1 · parcial: **grade** e **guias de encaixe**; sem réguas
- [x] **Guias inteligentes** — P1 · tem: guias de encaixe ao mover/redimensionar
- [ ] **Visão em tons de cinza / preto e branco** — P2 · falta
- [ ] **Nova janela / organizar janelas** — P2 · falta

## Mestres e temas (8/14)

- [ ] **Vista do Mestre de Slides (editar mestre e layouts)** — P0 · falta (o app **lê** mestre/layout do .pptx e mantém as decorações; dá para mexer nelas na própria lâmina com **Editar elementos do layout**, mas não há vista de mestre)
- [ ] **Inserir/renomear/excluir layouts, inserir placeholders** — P1 · falta
- [ ] **Mestres de folhetos e de notas** — P2 · falta
- [x] **Temas prontos (designs originais)** — P0 · tem: 3 temas (claro/escuro/contraste) + **22 modelos** de deck (6 clássicos + 13 do catálogo de designs + 3 de marca)
- [x] **Variantes do tema** — P1 · tem: a aba **Design ▸ Variantes** aplica as **seis famílias de cor** do Estilo de cor (Esmeralda, Oceano, Ameixa, Âmbar, Rubi e a Grafite escura) à apresentação inteira, com a lâmina atual desenhada em cada cartão; a variante troca a cor, não a tipografia
- [x] **Esquemas de cor (prontos e personalizados)** — P0 · parcial: paleta do deck e cores do documento (importadas); sem editor de esquema de cores
- [x] **Esquemas de fonte (prontos e personalizados)** — P0 · parcial: fonte do deck nos modelos/Configurar; sem esquemas de fonte nomeados
- [ ] **Esquemas de efeito / estilos de fundo** — P2 · falta
- [x] **Formatar fundo (sólido, gradiente, imagem, padrão)** — P0 · parcial: cor, gradiente e imagem (padrão/textura não); aplicar a todas as lâminas
- [ ] **Ocultar elementos gráficos do fundo** — P1 · falta
- [x] **Tamanho da lâmina (16:9, 4:3, predefinições, personalizado)** — P0 · parcial: **aba Design ▸ Personalizar ▸ Tamanho** (16:9 e 4:3); tamanhos personalizados (`widthIn`/`heightIn`) são preservados do .pptx
- [x] **Cabeçalho e rodapé (data, número da lâmina, rodapé)** — P1 · parcial: rodapé e número da lâmina; sem campo de data
- [ ] **Procurar temas em .pptx/.thmx** — P2 · falta
- [x] **Sugestões de layout do Designer (offline)** — P2 · tem: as **Ideias de design** (aba **Design ▸ Designer**) mostram a lâmina atual desenhada em cada design (catálogo + criados na hora), geradas no computador; os **Arranjos** reorganizam a lâmina em fórmulas padrão

## Formas (6/14)

- [x] **Formas predefinidas (linhas, retângulos, básicas, setas, equações, fluxograma, estrelas, balões)** — P0 · parcial: ~40 na galeria; o render/importação cobrem ~60 geometrias
- [ ] **Botões de ação** — P2 · falta
- [x] **Alças de ajuste** — P0 · tem: ajustes por geometria no painel (setas, estrela, balão, cantos…)
- [x] **Conectores (reto, angular, curvo)** — P0 · tem: linha, seta, seta dupla, conector angular e curvo
- [ ] **Colar conector em pontos de conexão** — P1 · falta (as linhas são formas independentes)
- [ ] **Ferramentas de forma livre, curva e rabisco** — P1 · falta (o importador lê formas livres; não há ferramenta para desenhar)
- [ ] **Editar pontos** — P1 · falta
- [ ] **Mesclar formas (união, combinar, fragmentar, interseção, subtrair)** — P1 · falta
- [x] **Trocar forma** — P1 · parcial: trocar a geometria de **imagens** (retângulo, cantos arredondados, elipse) no painel; formas comuns sem interface
- [x] **Caixas de texto** — P0 · tem
- [ ] **WordArt** — P1 · falta
- [ ] **Transformações de texto (curvar)** — P2 · falta
- [x] **Estilos rápidos de forma** — P1 · tem: 6 estilos rápidos (cheio, contorno, gradiente, cartão, escuro, suave)
- [ ] **Definir como forma padrão** — P2 · falta

## Formatação (7/11)

- [x] **Preenchimento sólido e transparência** — P0 · tem
- [x] **Preenchimento com gradiente (linear, radial, retangular, caminho)** — P0 · parcial: linear e radial (com paradas, ângulo e inverter); sem retangular/caminho
- [x] **Preenchimento com imagem e textura** — P1 · parcial: imagem sim; textura não
- [ ] **Preenchimento com padrão** — P2 · falta
- [x] **Linha: cor, espessura, tracejado, composta, ponta, junção** — P0 · parcial: cor, espessura, transparência, 6 traços, pontas e cap; sem composta/junção
- [x] **Pontas de seta** — P0 · tem: 6 pontas (triângulo, seta, fina, losango, círculo…)
- [x] **Sombra (externa, interna, predefinições)** — P1 · tem: 6 sombras prontas + cor/transparência/desfoque/distância/ângulo
- [ ] **Reflexo, brilho e bordas suaves** — P2 · falta
- [ ] **Chanfro e rotação 3D** — P2 · falta
- [ ] **Pincel de formatação** — P1 · falta
- [x] **Painel Formatar Forma** — P0 · tem: painel **Formatar** completo (imagem, preenchimento, linha, efeitos, ajustes, tamanho, texto)

## Organização (7/9)

- [x] **Tamanho e posição exatos, travar proporção** — P0 · parcial: largura/altura/posição exatas em cm; sem travar proporção
- [x] **Girar e espelhar** — P0 · tem: rotação livre + 90°, espelhar H/V
- [x] **Trazer para frente / enviar para trás / para o topo / para o fundo** — P0 · tem
- [x] **Alinhar e distribuir** — P0 · tem (6 alinhamentos + distribuir H/V)
- [x] **Agrupar, desagrupar, reagrupar** — P0 · parcial: agrupar/desagrupar; sem "reagrupar"
- [ ] **Painel de seleção (nomes, visibilidade, ordem)** — P1 · falta
- [x] **Mover com o teclado, duplicar com deslocamento repetido** — P1 · parcial: setas movem (Shift = passo maior, Alt = fino) e Ctrl+D duplica; sem repetição por deslocamento
- [x] **Bloquear formas** — P2 · tem: bloquear posição e tamanho
- [ ] **Texto alternativo (Alt Text)** — P1 · falta

## Texto (14/25)

- [x] **Edição de texto no lugar (cursor, seleção, mouse, teclado)** — P0 · tem: edição direta na forma, com formatação por trecho
- [x] **Fonte, tamanho, negrito, itálico, sublinhado, tachado** — P0 · tem (fontes do sistema + embutidas do .pptx, com os pesos certos)
- [x] **Cor da fonte e marca-texto** — P0 · tem: cor e **marca-texto** (cores clássicas)
- [x] **Sobrescrito, subscrito, versalete, espaçamento entre caracteres** — P1 · tem: Sobrescrito/Subscrito/Versalete/Espaçamento na fita (o round-trip preserva `baseline`, `caps`, `spc`)
- [x] **Alterar caixa, aumentar/diminuir fonte, limpar formatação** — P1 · tem: A▲/A▼, **Aa** (maiúsculas/minúsculas/Primeira Letra) e **Limpar formatação**
- [ ] **Contorno e efeitos de texto** — P2 · falta
- [x] **Alinhamento de parágrafo, recuos, espaçamento, entrelinha** — P0 · tem
- [x] **Marcadores e numeração** — P0 · tem
- [ ] **Marcadores com imagem/símbolo** — P2 · falta
- [x] **Níveis de lista (Tab / Shift+Tab)** — P0 · tem: recuo de nível
- [ ] **Tabulações** — P2 · falta
- [ ] **Colunas** — P2 · falta
- [x] **Âncora vertical, margens, quebra** — P0 · tem
- [x] **Ajuste automático (reduzir no excesso, redimensionar forma)** — P0 · parcial: preserva o `normAutofit` do .pptx; sem controles para aplicar
- [x] **Direção do texto (girado, empilhado)** — P1 · tem: girar 90°/270°
- [ ] **Localizar e substituir, substituir fontes** — P1 · falta no PowerPoint
- [ ] **Verificação ortográfica** — P1 · falta no PowerPoint (o app tem corretor no Markdown/Word)
- [ ] **Dicionário de sinônimos** — P2 · falta
- [ ] **Autocorreção e aspas inteligentes** — P2 · falta no PowerPoint
- [x] **Símbolos e emoji** — P1 · parcial: digitação normal aceita; sem galeria de símbolos
- [ ] **Equações** — P2 · falta
- [x] **Hiperlinks (URL, lâmina, e-mail)** — P1 · parcial: importa e preserva o link; sem controles para inserir
- [x] **Campos de data/hora e número da lâmina** — P1 · parcial: número da lâmina e rodapé; sem campo de data
- [ ] **Direita para a esquerda e escritas complexas** — P1 · falta
- [ ] **Texto do leste asiático (fontes CJK, quebra de linha)** — P1 · falta

## Tabelas (7/8)

- [x] **Inserir tabela (grade, diálogo)** — P0 · tem: grade 6×8 no Inserir
- [ ] **Desenhar tabela** — P2 · falta
- [x] **Estilos e opções de tabela** — P0 · tem: presets + cabeçalho/faixas/primeira coluna
- [x] **Inserir/excluir linhas e colunas** — P0 · tem
- [x] **Mesclar e dividir células** — P1 · tem
- [x] **Distribuir linhas/colunas, tamanhos** — P1 · parcial: os comandos de largura de coluna/altura de linha exatas existem, mas **sem controle na fita/painel**; distribuir não existe
- [x] **Preenchimento, bordas, margens e alinhamento de célula** — P1 · parcial: preenchimento, bordas e alinhamento vertical; margens de célula não
- [x] **Navegação entre células pelo teclado** — P0 · tem: Tab/Shift+Tab, setas e digitação direta

## Gráficos (4/5)

- [x] **Inserir gráfico (colunas, barras, linhas, área, pizza, rosca, dispersão)** — P0 · tem: **Inserir > Gráfico** (colunas, barras, linhas, área, pizza, rosca e dispersão), desenhado em SVG
- [ ] **Outros tipos (radar, ações, combo, cascata, funil, treemap, sunburst, histograma, caixa)** — P2 · falta
- [x] **Editar os dados do gráfico** — P0 · tem: tabela de dados no painel (categorias × séries, adicionar/remover categoria e série)
- [x] **Elementos do gráfico (título, legenda, rótulos, eixos, grade)** — P1 · parcial: título, legenda, rótulos de dados, eixos e grade; sem formatação individual de cada elemento
- [x] **Estilos e cores do gráfico** — P2 · parcial: cor por série (a paleta do deck entra na criação); sem estilos prontos

> O gráfico é desenhado em SVG pelo motor; no .pptx exportado ele vira **imagem** (o `c:chart` nativo ainda não é escrito). Gráficos de um .pptx importado continuam como aviso, e o arquivo os mantém no round-trip.

## SmartArt (0/2)

- [ ] **Inserir SmartArt (listas, processos, ciclos, hierarquia)** — P1 · falta
- [ ] **Painel de texto e troca de layout** — P2 · falta

## Imagens (6/11)

- [x] **Inserir imagem (PNG, JPEG, GIF, WebP, BMP, TIFF)** — P0 · tem
- [x] **Imagens SVG** — P1 · parcial: inserir SVG funciona pelo navegador; importar .pptx com SVG não
- [x] **Recorte (e recortar pela forma, proporção)** — P0 · parcial: recorte pelos 4 lados e formato retângulo/elipse/arredondado; sem proporção/travar
- [ ] **Correções, cor, transparência** — P1 · falta (brilho/contraste/saturação)
- [ ] **Efeitos artísticos** — P2 · falta
- [ ] **Remover fundo** — P2 · falta
- [x] **Estilos e bordas de imagem** — P1 · parcial: contorno e sombra (comuns a formas); sem estilos prontos
- [x] **Trocar/redefinir imagem** — P1 · parcial: trocar imagem e redefinir recorte; sem redefinir tudo
- [ ] **Compactar imagens** — P2 · falta
- [x] **Colar imagem da área de transferência** — P0 · tem: Ctrl+V cola imagem
- [ ] **Inserir captura de tela** — P2 · falta

## Mídia (4/7)

- [x] **Inserir áudio (formatos comuns)** — P0 · tem: **Inserir > Áudio** (mp3, wav, m4a, aac, ogg, flac), com o arquivo guardado no deck
- [x] **Inserir vídeo** — P1 · tem: **Inserir > Vídeo** (mp4, webm, ogv, mov, m4v, **mkv**); a capa é o primeiro quadro do vídeo
- [x] **Reprodução de áudio/vídeo na apresentação** — P0 · tem: reprodução no F5 com controles opcionais, volume e corte (início/fim)
- [x] **Cortar, fade de entrada/saída, volume, repetir, continuar em outras lâminas** — P2 · parcial: corte, volume, repetir e **continuar em outras lâminas**; sem fade de entrada/saída
- [ ] **Gravar áudio / gravar tela** — P2 · falta
- [ ] **Ícones, modelos 3D, conteúdo de banco** — P2 · falta
- [ ] **Objetos incorporados (OLE): inserir; manter objetos estrangeiros** — P2 · falta (o importador avisa e mantém o que não modela)

> O áudio/vídeo vira parte do `.pptx` exportado (relação de vídeo/áudio + `p14:media` e a capa no `blip`); a importação lê os arquivos de mídia de volta para o modelo.

## Transições (3/5)

- [x] **Galeria de transições (fade, push, wipe, split, cover, uncover, zoom, morph…)** — P0 · parcial: 7 tipos (**Sem, Fade, Push, Wipe, Split, Cover e Uncover**), com prévia na fita; sem Zoom nem Morph
- [x] **Opções de efeito e duração** — P0 · tem: direção (quando o tipo aceita) e duração (0,5 s / 1 s / 2 s)
- [x] **Avançar no clique / após tempo, aplicar a todas** — P0 · parcial: avanço no clique e **Aplicar a todas**; sem avanço automático por tempo (o XML cru do .pptx é preservado)
- [ ] **Sons de transição** — P2 · falta
- [ ] **Morph** — P1 · falta

> A transição toca no F5 (e na prévia) e faz o round-trip no `.pptx` (`p:transition` com `spd`/`p14:dur`/`dir`); efeitos desconhecidos ficam guardados crus.

## Animações (6/8)

- [x] **Efeitos de entrada, ênfase e saída** — P0 · parcial: entrada/saída (**Aparecer**, **Surgir**, **Voar**, **Zoom**, **Limpar**, **Caixa**, **Círculo**, **Losango**, **Dividir**, **Persianas**, **Dissolver**, **Roda**, **Desaparecer**, **Sumir**, **Voar fora**, **Encolher**, **Limpar fora**, **Caixa fora**, **Círculo fora**, **Losango fora**, **Dividir fora**, **Persianas fora**, **Dissolver fora**, **Roda fora**) e **ênfase** (Pulsar, Ampliar/Reduzir, Girar, Transparência); sem os demais efeitos de ênfase (cor, negrito…) nem as outras entradas/saídas (xadrez, barras aleatórias, faixas, espiar, flutuar…) nem as variantes verticais/do centro das revelações (a variante padrão é a modelada)
- [x] **Trajetórias de movimento** — P1 · parcial: **trajetória em linha** nas quatro direções (25% da lâmina, como o preset "Linhas"); sem curvas, voltas, laços nem caminho personalizado
- [x] **Opções de efeito, início (no clique/com/depois), duração, atraso** — P0 · parcial: início (**Ao clicar**, **Com anterior**, **Depois do anterior**), duração (0,5/1/2 s, padrão por tipo), **atraso** (Sem a 2 s) e a **direção** da trajetória, do voar e do limpar (4 bordas); sem as demais opções de efeito
- [x] **Painel de animação (reordenar, tempo)** — P0 · tem: **painel de animação** na aba lateral (lista na ordem, selecionar, mover ↑↓ e remover) + selos numerados no palco
- [x] **Build por parágrafo** — P1 · tem: caixa **Por parágrafo** na aba Animações (um passo por parágrafo não vazio: um clique por parágrafo no "ao clicar", encadeado no "com"/"depois") + round-trip do `pRg`/`bldLst build="p"`
- [ ] **Gatilhos** — P2 · falta
- [ ] **Pincel de animação** — P2 · falta
- [x] **Prévia no editor** — P1 · tem: botão **Prévia** na aba Animações (toca a sequência sem entrar no F5)

> As animações tocam no F5 na ordem: o clique primeiro toca o efeito pendente e só depois troca de
> lâmina. O `.pptx` faz **round-trip do `p:timing`/`p:animMotion`** (presetID por efeito,
> `nodeType`, atraso, direção da trajetória/do voo/do limpar, build por parágrafo e comportamentos
> de visibilidade/fade/escala/rotação/opacidade/movimento/recorte (`filter`)); o que o modelo não
> representa (curvas, voltas, laços e caminho personalizado, diagonais do voo, variantes do zoom,
> as variantes verticais/do centro das revelações e os outros `filter`, gatilhos, repetição,
> demais presets, mídia com tempo próprio) fica guardado **cru** e volta como veio, com aviso na
> importação.

## Apresentação (3/10)

- [x] **Tela cheia desde o começo / da lâmina atual** — P0 · parcial: o botão **Apresentar** abre a tela cheia (sempre da 1ª lâmina visível); o **F5** global apresenta o Markdown do editor; sem "apresentar da lâmina atual"
- [x] **Navegação (teclas, clique, ir para lâmina, tela em branco)** — P0 · tem: setas, espaço, PageUp/Down, clique, **nº + Enter** (ir para lâmina) e **B/W** (tela preta/branca)
- [x] **Visor do apresentador (notas, próxima lâmina, cronômetro)** — P0 · parcial: as notas aparecem na tela com **N**; sem janela do apresentador, próxima lâmina ou cronômetro
- [ ] **Caneta e marca-texto durante a apresentação** — P1 · falta
- [ ] **Ponteiro laser** — P2 · falta
- [ ] **Ensaiar tempos** — P2 · falta
- [ ] **Apresentações personalizadas** — P2 · falta
- [ ] **Configurar apresentação (repetir, quiosque, sem animação)** — P1 · falta
- [ ] **Gravar apresentação (narração)** — P2 · falta
- [ ] **Apresentar em vários monitores** — P1 · falta

## Revisão (1/4)

- [ ] **Comentários (adicionar, responder, resolver, excluir)** — P1 · falta
- [ ] **Verificador de acessibilidade** — P2 · falta
- [ ] **Comparar apresentações** — P2 · falta
- [x] **Controle de alterações / histórico de versões** — P2 · tem: histórico de versões + log de alterações do app (restaurar em um clique)

## Desenho (2/2)

- [x] **Canetas de tinta, marca-texto, borracha** — P1 · tem: **caneta (Draw)**, **curva por pontos**,
  **marca-texto de tinta** e **borracha** na aba **Desenhar** (com cor, espessura, modo e o
  assistente de forma). Falta só o laço para selecionar vários traços.
- [x] **Tinta → forma / texto** — P2 · parcial: o assistente **converte o traço em forma** ao
  desenhar e há o **Converter em forma** para um traço já escolhido; falta **tinta → texto**.

## Desfazer e área de transferência (2/3)

- [x] **Desfazer/refazer ilimitados** — P0 · tem: histórico próprio da apresentação (digitação agrupada, mover, formatar, lâminas)
- [x] **Recortar, copiar, colar formas e lâminas** — P0 · parcial: formas sim (Ctrl+C/X/V/D); lâminas entre decks não
- [ ] **Colar especial (manter formatação, imagem, só texto)** — P1 · falta

## Automação (1/2)

- [x] **Todo comando scriptável (CLI, canal de controle, MCP)** — P0 · parcial: no app, **Ctrl+K** e todos os comandos internos são despachados por `run(comando)`; sem CLI, canal JSON ou MCP
- [ ] **Renderização e conversão sem interface** — P0 · falta

## Plataformas (1/2)

- [x] **Builds macOS, Windows e Linux** — P0 · parcial: **Windows** (Tauri 2)
- [ ] **Build Web (WASM)** — P1 · falta

---

## Fora do roadmap (decisões de produto)

Estes itens existem em outros editores, mas **não entram** no roadmap — e é uma escolha, não uma
pendência:

- **Formato próprio de trabalho.** O app usa o **`.pptx`** como formato: abre e salva no padrão do
  PowerPoint. Um formato proprietário não acrescenta nada a quem precisa trocar arquivos com o
  Office.
- **Barra de menus nativa do macOS.** O app desenha a própria barra (Tauri); se houver build para
  macOS, o menu nativo entra como requisito **da plataforma**, não como item do editor.
- **Build para BSD.** Fora do horizonte: os alvos são Windows (hoje) e, depois, macOS/Linux/Web.

## Além do escopo de um editor de slides (o que o app já entrega)

- **Suíte completa**: Word (.docx), Excel (.xlsx) e Markdown no mesmo app.
- **IA local**: corretor de português, sugestões enquanto digita (modelo de n-gramas + o que você escreve), revisão inteligente com sinônimos.
- **Tradução automática PT-BR → inglês** com memória local, glossário e pré-visualização lado a lado.
- **Backup em disco** (duas pastas, política de limpeza, restauração) e **histórico com log de alterações**.
- **Importar do Office** (.docx/.xlsx/.xlsm/.pptx) direto pelo Início.
- **Exportar** Markdown para HTML/PDF/Word/TXT/pacote IA, com documento bilíngue.
- **Interface e dicionário em português.**
- **Desenho assistido** e diagramas Mermaid no Markdown; projetos e busca no conteúdo.
- **Janela própria por documento**: a aba pode virar um aplicativo separado, com o documento sozinho.

## Arquitetura (contexto)

| Item | Como é hoje |
|---|---|
| Linguagem/UI | TypeScript + Tauri 2 (WebView2) |
| Modelo de lâmina | HTML/SVG por forma |
| Formato de trabalho | `.pptx` |
| Import/export | importador e exportador próprios; o que o modelo não representa volta cru, com aviso |
| Automação | paleta Ctrl+K e comandos internos |
| Plataformas | Windows |

## Próximos passos

Ordem sugerida (impacto × esforço, foco no editor):

1. **Animações** — fechar o quadro: os demais presets (xadrez, barras aleatórias, faixas, espiar…;
   curvas/voltas/laços e o caminho personalizado na trajetória) e os itens P2 (gatilhos e pincel
   de animação).
2. **Ganhos rápidos** — largura/altura de coluna e linha na fita, lâminas a partir de estrutura,
   pincel de formatação, símbolos/emoji, data/hora, "apresentar da lâmina atual" e texto alternativo.
3. **Visor do apresentador de verdade** (notas, próxima lâmina e cronômetro) e ensaiar tempos.
4. **Formas** — mesclar (booleanas), editar pontos, forma livre/rabisco e conector com cola.
5. **Mestre** — vista para editar mestre/layouts e placeholders; depois os 11 layouts.
6. **Gráfico nativo `c:chart`** no `.pptx` + tipos extras (radar, ações, cascata) e estilos prontos.
7. **Exportar PDF e PNG do deck** sem depender do Ctrl+P, com notas e folhetos.
8. **Texto avançado** — tabulações, colunas, contorno/sombra de texto, WordArt e inserir hyperlink.
9. **Imagens** — correções (brilho/contraste/saturação), recorte com proporção e EMF/WMF no import.
10. **Lâminas e revisão** — seções, copiar/colar lâminas entre decks, comentários e SmartArt;
    **Morph** como evolução das transições.
