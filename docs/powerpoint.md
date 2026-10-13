# PowerPoint — apresentações `.pptx`

Apresentações com **abertura e gravação fiéis** de `.pptx`: o que o app ainda não reproduz é
avisado ao abrir (nunca some em silêncio).

## Abrir e salvar `.pptx`

- Lê cada lâmina como o PowerPoint a monta: formas posicionadas com precisão (grupos, rotação
  e espelhamento), retângulos arredondados, elipses, setas e formas livres; preenchimento
  sólido, em gradiente e com imagem; contornos; sombras; imagens com recorte; fundos da lâmina;
  decorações do **layout e do mestre**; cores do tema (com `lumMod`, `tint`, `alpha`…); texto
  formatado **por trecho**; notas do apresentador e a ordem real das lâminas.
- **Fontes**: os pesos (“Montserrat Black”, “Open Sans Bold”) viram a mesma família no peso
  certo; Montserrat, Roboto e Open Sans já vêm no app (OFL), então o texto quebra nas mesmas
  linhas. A exportação devolve ao arquivo as **fontes embutidas** originais.
- **Gravação** em XML do PowerPoint escrito pelo próprio app. Medido em 5 apresentações reais
  (64 lâminas): diferença média ≈2% para a renderização de referência, e o arquivo exportado,
  reaberto por um leitor independente, é idêntico em quase todas as lâminas.
- Ainda **não** reproduz (e avisa): tabelas de layout complexo, gráficos importados, SmartArt,
  imagens EMF/WMF, animações e transições antigas, e fontes embutidas **comprimidas**
  (MicroType Express) — aparecem com a família equivalente, mas voltam intactas ao salvar.

## Editar as lâminas

- **Formas**: galeria, desenhar arrastando, 8 alças de redimensionar, girar, **guias de
  encaixe**, seleção múltipla, **agrupar/desagrupar**, ordem (frente/trás), alinhar,
  distribuir, copiar/colar, duplicar e desfazer/refazer.
- **Texto formatado por trecho**: negrito/itálico/sublinhado/riscado, marca-texto,
  sobrescrito, versalete, espaçamento, caixa alta/baixa, cor e limpar formatação.
- **Tabelas**: inserir, editar células (Tab anda entre elas), mesclar/dividir, linhas e
  colunas, estilos, bordas e sombreamento — com ida e volta fiel no `.pptx` (`a:tbl`).
- **Gráficos**: inserir, editar os dados no painel, desenho em SVG e exportação como imagem.
- **Mídia**: inserir áudio/vídeo, tocar no F5 com corte, volume e repetição, e ida e volta no `.pptx`.
- **Transições de lâmina**: galeria, direção, duração, no F5 e no arquivo.
- **Lâminas**: arrastar as miniaturas para reordenar (na faixa do topo ou na vertical),
  ocultar, renomear e resetar (com ida e volta no `.pptx`), duplicar e excluir.
- **Modelos**: o botão **Template** aplica modelos de estilo (tema, cores e fonte) ao deck;
  dá para salvar o visual atual como cartão e aplicar/remover depois.
- **Configurar apresentação**: proporção (16:9 / 4:3), tema (claro/escuro/contraste), fonte
  padrão, tamanho, rodapé e número da lâmina.

## Apresentar (F5)

- **Modo apresentação completo**: avançar/voltar lâmina, **tela preta/branca**, **transições**
  entre lâminas, mídia tocando e as **notas do apresentador**.

## Interface do módulo

- **Fita** com abas (Página Inicial, Inserir, **Transições**, Design e Exibir; **Formato da Forma**
  e **Layout da Tabela** aparecem quando a seleção pede), recolhível e ajustável, com rolagem
  horizontal quando não cabe.
- **Painel Formatar/Notas** à direita: pode ser escondido, redimensionado e reaberto pela aba
  “« Formatar”; as notas ficam na aba **Notas**.
- **Zoom até 400%** ancorado no ponteiro (Ctrl + roda do mouse), com rolagem de verdade.
- **Faixa de lâminas** no topo ou na vertical (Exibir → Faixa vertical).

## Testes

- `npm run test:pptx -- <pasta com .pptx>` — importa e exporta apresentações reais e compara.
- `npm run test:pptx-edicao` — testes do motor de edição (geometria, operações, texto, tabelas).
