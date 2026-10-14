# Word — documentos `.docx`

O motor do Word edita o documento **direto na folha** (sem Markdown no meio) e abre/salva
arquivos `.docx` de verdade.

## Documento e páginas

- **Novo documento Word**: **+ → Documento Word** cria o documento já editável na folha;
  **Abrir** aceita `.docx` do Word.
- Folha **A4/Carta** com margens configuráveis (tamanho, orientação, margens, cabeçalho,
  rodapé e “Página X de Y”) em **Layout → Configurar Página**.
- **Páginas de verdade**: o texto flui de uma página para a outra e parágrafos longos se
  dividem entre elas (paginação calculada, não é só uma folha rolando).
- **Zoom** (barra inferior) e régua de trabalho na coluna de escrita.

## Fita (no desenho do Word Online)

- Abas **Início**, **Inserir**, **Layout** e **Revisão** (e a aba contextual **Tabela**
  quando o cursor está numa tabela).
- **Fonte**: família e tamanho, negrito/itálico/sublinhado/riscado, sub/sobrescrito,
  **cor da letra** e **destaque** (marca-texto), limpar formatação. Os dois campos **mostram o
  que o documento tem** (fonte ou tamanho vindo de um `.docx` fora da lista não some) e aceitam
  **digitação** — dá para escrever qualquer tamanho (com vírgula) ou qualquer nome de fonte, com
  a lista do app no botão ao lado.
- **Parágrafo**: marcadores e numeração com níveis, recuo, entrelinha, alinhamento
  (esquerda, centro, direita e **justificado**).
- **Estilos**: Texto normal, Título 1–4, Citação e Código (caixas de estilo com prévia).
- **Área de transferência**: colar, recortar, copiar e **pincel de formatação**
  (uma vez ou fixo), desfazer/refazer.
- **Páginas**: quebra de página, cabeçalho e rodapé, números de página.
- **Ilustrações**: imagens (inserir, colar ou arrastar), links, **tabelas** (inserir,
  linhas/colunas, mesclar, dividir, sombrear, bordas) e marcas de parágrafo.
- **Revisão de texto**: corretor de português (sublinhados e sugestões) e voz/suplementos.

## Escrita assistida (também no Word)

- O **corretor de português** sublinha erros e abre sugestões ao clicar; o **texto fantasma**
  (sugestões enquanto digita) funciona aqui também, com **Tab/Alt+→/Alt+↓**.
- **Revisar texto** (`F7`) e a **revisão inteligente** analisam o documento Word como o
  Markdown (regras, sinônimos e a IA local).
- **Formalizar** (`Ctrl+Alt+F` ou **Revisão → Revisão de Texto → Formalizar**): a mesma janela
  do Markdown, com **antes × depois** e o MIP caindo ao vivo. Pega a seleção (sem seleção, o
  documento inteiro) e aplica cada troca **no lugar dela** — o texto em volta e o formato ficam
  como estavam, e negrito/cor do próprio trecho trocado são mantidos. `Ctrl+Z` desfaz tudo.
- O **histórico de versões**, as **abas**, a **Estrutura** e a busca valem igual ao Markdown.

## Salvar e exportar

- **Salvar .docx de verdade** (`Ctrl+S`) — o arquivo abre no Word.
- **Salvamento automático**: rascunhos do app são regravados sozinhos; um `.docx` **seu** só é
  gravado no `Ctrl+S` (o motor pode simplificar comentários, revisões, campos). O selo da barra
  mostra **Não salvo** enquanto houver alterações pendentes e o aviso explica na primeira vez —
  o histórico guarda cópias de qualquer jeito.
- **Exportar PDF** imprime a própria folha (com páginas, cabeçalho e rodapé).
- **Importar do Office**: abre `.docx` direto das pastas do Office (e explica os formatos
  antigos `.doc`).

## Limitações conhecidas

O motor avisa (nunca some em silêncio) o que ainda **não** entende e pode simplificar ao
salvar: comentários, revisões, campos e caixas de texto; e ainda não há tradução ao vivo
(use **Exportar → Inglês**), desenho, notas de rodapé, colunas e tabelas dentro de tabelas
com mesclagem complexa. O histórico guarda cópias antes de qualquer alteração.
