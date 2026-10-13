# Sugestões sem IA: aquecimento, velocidade e sugestões longas — pesquisa, gargalos e plano por fases

> **Escopo.** Por que a sugestão do mdOffice (a) **"começa lenta"** e melhora com o uso e
> (b) **fica presa em até 3 palavras**, e o que a literatura técnica madura (sem IA) oferece para
> **acelerar** e para **sugerir trechos longos**. O texto diagnostica o que existe hoje em
> `src/broker/ghost/` (nomes de arquivo/função e constantes — sem copiar código), resume o estado
> da arte com fontes, propõe decisões e organiza um plano em fases (V0–V4) com métricas.
> **Data:** 2026-10-13. **Acesso aos links:** 2026-10-13.
> **Números deste documento:** os **internos** foram medidos no repositório nesta data (Node 24/V8,
> os mesmos módulos do app, amostra de 41 308 caracteres de `docs/pesquisa-correcao-offline.md`
> e 60 000 caracteres na varredura) e estão marcados como *medido*; os **externos** têm fonte;
> as **metas** estão marcadas como *estimativa*.
> **Parentes:** este documento é o recorte do **fantasma/sugestão**; o corretor ortográfico e a
> revisão estão em [pesquisa-correcao-offline](pesquisa-correcao-offline.md) e a síntese em
> [pesquisa-sugestoes](pesquisa-sugestoes.md).

---

## 1. Resumo executivo

1. O teto de 3 palavras é **literal**: `THRESHOLDS.maxWords = 3` em
   `src/broker/ghost/predict.ts`. E o praticado é bem menor: *medido*, a sugestão tem em média
   **1,35 palavra** — 73,7% têm 1 palavra, 17,1% têm 2 e só **9,2% chegam a 3**.
2. O encadeamento é **guloso e sem visão de futuro**: para cada palavra extra exige
   probabilidade ≥ 0,45 (`chain`), uma decisão de cada vez, sem beam nem penalidade de
   comprimento — quando o n-grama "esfria" (o contexto de trigrama tem 2,5 sucessores em média),
   o laço para.
3. O "**começa lento**" tem quatro causas mecânicas: (a) o modelo de idioma precisa ser
   carregado e interpretado (*medido*: **~200–270 ms** para ler+parsear 6,92 MB e montar o
   `LangModel`, sem contar o download); até ele chegar, o plano B devolve **100% de sugestões de
   1 palavra**; (b) o índice do documento **nasce vazio** em cada documento; (c) o aprendizado
   (feedback/preferências) começa do zero; (d) o índice do documento é **reconstruído inteiro**
   na thread principal (*medido*: **~31–41 ms** para 200 mil caracteres e **~65–77 ms** para
   400 mil, a cada 800 ms ociosos).
4. O **caminho quente é rápido**: *medido*, `predictFromLine` tem p50 **0,39 ms**, p90 **1,32 ms**
   e p99 **2,81 ms** numa varredura de 17 213 posições (picos de 12–34 ms são aquecimento de JIT
   e casos raros). O problema percebido não é latência de uma consulta — é **qualidade no
   começo** e **tamanho da sugestão**.
5. O modelo é **pequeno de propósito**: 30 003 palavras, bigramas com no máximo 12 sucessores,
   trigramas com no máximo 5 e contextos de trigrama com menos de 4 ocorrências descartados
   (`scripts/build-ngrams.mjs`). Não há **4-gramas** nem **frases** — é o que explica o teto
   curto na prática.
6. Sem IA dá para ir **muito além**: consulta de n-gramas do tipo KenLM (hash de sondagem +
   quantização), suavização **Kneser-Ney** (ou *stupid backoff*), **DAWG/DAFSA** para prefixos,
   **top-k pré-computado** por contexto, **beam search** com normalização de comprimento e
   **tabela de frases** (4-gramas/frases do corpus + memória do usuário).
7. A **UI já está pronta** para sugestões longas: o fantasma é um texto único, `Tab` aceita tudo,
   `Alt+→`/`Ctrl+→` aceita palavra a palavra e `Esc` descarta (`src/broker/ghost/field.ts`).
   O limite de 3 palavras **não é da interface** — é do motor.
8. Estudos de composição de texto mostram **economia de teclas de 38–45%** com predição de
   palavras e que **sugestões de frases** ajudam quando são **valiosas** (não só prováveis);
   a cauda de frases erradas é o risco principal (UIST 2016; Koester & Levine).
9. Meta realista *estimada*: manter o p50 abaixo de ~1,5 ms com o índice incremental e o worker
   e levar a distribuição para **≥ 25% das sugestões com 3+ palavras** e média ≥ 2 palavras,
   sem perder precisão — caminho no plano V1/V2.
10. O plano tem cinco passos: **V0 medir** (linha de base registrada neste documento),
    **V1 aquecer e enxugar o caminho quente**, **V2 alongar com beam + tabela de frases**,
    **V3 memória de frases do usuário**, **V4 avaliação contínua** com `scripts/eval-ghost.mts`.

---

## 2. Como funciona hoje (linha do tempo de uma tecla)

### 2.1 O caminho de uma sugestão, passo a passo

1. **Gatilho** — `src/broker/ghost/extension.ts`: a cada mudança do documento ou do cursor, um
   *debounce* de **90 ms** chama `predictCompletion` na **thread principal**; o índice do
   documento é re-construído com *debounce* de **800 ms**; a IA local (opcional) entra num
   terceiro timer de **450 ms** (`REFINE.pauseMs`).
2. **Contexto** — `predict.ts → readContext`: corta a frase atual (pontuação), converte números em
   `#` e a vírgula em token próprio, e identifica se está no meio de uma palavra (prefixo).
3. **Ranking** — `rank()` mistura **quatro fontes**: trigrama do modelo, bigrama, unigramas de
   palavras com o prefixo (`model.withPrefix`, busca binária + ordenação por frequência) e os
   n-gramas do **documento** (mais a memória pessoal, com peso 0,5) — com `preference()`,
   `agreementFactor()` e `repeatPenalty()` por candidato.
4. **Montagem** — `suggestFrom()` decide se vale mostrar (limiares `next: 0,26`, `prefix1/2/3:
   0,82/0,5/0,36`), aplica a concordância/maíusculas e **encadeia** palavras enquanto cada uma
   tiver probabilidade ≥ `chain: 0,45`, **até `maxWords: 3`**.
5. **Fantasma** — `field.ts` desenha o texto em cinza; `Tab` aceita, `Alt+→` aceita uma palavra,
   `Alt+↓/↑` alterna entre até 3 alternativas, `Esc` descarta. Aceites e recusas alimentam
   `personal/feedback.ts` (localStorage) e reordenam a próxima mistura.
6. **IA local (opcional)** — `refine.ts` reordena os candidatos com o modelo pequeno quando a
   pessoa pausa; é o único passo de IA e **não** é o objeto desta pesquisa.

### 2.2 As fontes de dados (e seus números)

| Fonte | O que guarda | Números |
| --- | --- | --- |
| Modelo do idioma (`public/ngrams/pt.json`) | contagens de palavras, bigramas e trigramas (nenhum texto) | *medido*: 6,92 MB; 30 003 palavras; 29 669 contextos de bigrama (184 201 sucessores; média 6,2; máx 12); 140 865 contextos de trigrama (354 459 sucessores; média 2,5; máx 5) |
| Índice do documento (`documentIndex.ts`) | frequência, bigramas e trigramas **do documento aberto** | reconstruído inteiro a cada 800 ms ociosos |
| Memória pessoal (`memory.ts`) | os inícios dos últimos **24 documentos** (40 mil caract. cada) em localStorage | índice próprio, peso 0,5 na mistura |
| Feedback (`personal/feedback.ts`) | aceites/recusas por palavra e por par; taxa de aceitação | escala limiares só depois de **30 decisões**; preferência limitada a ±0,35–1,3 |
| Perfil de escrita (`personal/profile.ts`) | estilo das frases etc. (usado na revisão) | "confiável" a partir de **400 palavras / 25 frases** |

### 2.3 O que foi medido (linha de base de 2026-10-13)

Metodologia: os módulos reais foram empacotados com esbuild e rodados no Node 24 (mesmo motor
V8 do WebView), com o modelo real e uma amostra real de documento; mais detalhes no apêndice.

- **Custo do modelo**: ler+parsear **175–241 ms** + construir o `LangModel` (mapa de 30 mil
  palavras + ordenação alfabética para busca por prefixo) **27–32 ms** → **~200–270 ms** de
  aquecimento, em segundo plano mas na thread principal hoje.
- **Índice do documento** (`DocumentIndex.update`, documento inteiro):
  20 mil caracteres ≈ **4–5 ms**; 60 mil ≈ **7–10 ms**; 200 mil ≈ **31–41 ms**;
  400 mil ≈ **65–77 ms** (a primeira rodada às vezes é pior pelo JIT).
- **Varredura completa da amostra**: em 17 213 posições, **7 148 sugestões (41,5%); 5 330 de
  prefixo**. Latência: p50 **0,39 ms**, p90 **1,32 ms**, p99 **2,81 ms**, máx **~34 ms**.
  Por modo: "próxima palavra" p50 **0,24 ms** / p90 0,54 ms; "completar palavra" p50 **0,49 ms**
  / p90 1,01 ms (o prefixo custa ~2x por causa da varredura de vocabulário + ordenação).
- **Largura das sugestões**: média **1,35 palavra**; 1 palavra **73,7%**, 2 palavras **17,1%**,
  3 palavras **9,2%** (0 acima disso, por definição).
- **Plano B (sem o modelo, o que roda enquanto o arquivo não chega)**: cobertura maior
  (**62,0%** das posições) mas **100% de sugestões de 1 palavra** e latência baixíssima
  (p50 0,01 ms) — é uma base curada + o documento, sem contexto n-grama. É o retrato do
  "começo fraco": o app sugere muito, mas raso.
- **Encadeamento**: na amostra de 120 parágrafos, 215 sugestões com 2+ palavras e **63 que
  alcançaram o teto de 3** — o teto é atingido, mas raramente.

---

## 3. Por que "começa lenta e depois acelera"

### 3.1 O modelo de idioma chega frio

O app começa a carregar `pt.json` no boot (`src/app/app.ts`), mas até o *fetch* + *parse* +
`LangModel` terminarem (~200–270 ms medidos, e no navegador ainda há o download/decodificação),
quem responde é o `predictLegacy` — *medido*: 100% de 1 palavra. O usuário percebe exatamente
o padrão que relatou: no começo sugestões "rasas" (o plano B), depois contextualizadas.

### 3.2 O índice do documento nasce vazio e é reconstruído inteiro

Cada documento novo começa com `DocumentIndex` vazio; ele só aprende depois que a pessoa escreve
(e só depois dos 800 ms ociosos). A reconstrução é **total** (limpa os mapas e relê o documento)
e roda na **thread principal**; *medido*: de 4 ms (20 mil) a ~77 ms (400 mil caracteres). Em
documentos grandes, isso é um engasgo periódico — e, como não é incremental, não aproveita nada
do que já estava indexado.

### 3.3 O aprendizado pessoal começa do zero

`feedback.ts` só ajusta os limiares depois de **30 decisões** e a preferência por par
começa vazia; a memória pessoal só cobre até **24 documentos**. Quem escreve sempre sobre os
mesmos assuntos sente a sugestão "pegar velocidade" ao longo dos dias — é o acúmulo dessas
camadas, não a latência do algoritmo.

### 3.4 O caminho quente é rápido, mas tem picos e alocações

p50 de 0,39 ms esconde picos de **12–34 ms** (JIT nas primeiras chamadas da sessão, GC, casos com
muitos sucessores). Além disso, cada chamada de `rank()` **aloca** vários `Map` (sucessores do
trigrama/bigrama, candidatos do documento) e, no modo prefixo, `withPrefix` percorre e **ordena**
as palavras que começam com o prefixo (limite 60). Nada disso é caro isolado; somado a cada
tecla, e com o `Tab` esperando, é gordura que dá para cortar.

### 3.5 O que o usuário percebe como "lentidão" é taxa de acerto

Estudos de texto preditivo mostram que o custo cognitivo de olhar a sugestão só compensa quando
ela vale a pena (UIST 2016) — sugestão fraca "atrasa" a digitação mesmo com latência baixa.
A sensação de "começa lenta" é, em boa parte, **cobertura contextual baixa no começo** (índice,
modelo e aprendizado frios), não milissegundos.

---

## 4. Por que para em 3 palavras

1. **Teto literal**: `THRESHOLDS.maxWords = 3` (predict.ts). Mudar o número é uma linha; o que
   segura o resultado é o resto.
2. **Encadeamento guloso**: cada palavra extra precisa vencer `chain = 0,45` **sozinha**, sem
   olhar o todo (não há beam nem soma de log-probabilidades). Basta uma palavra "morna" para o
   laço parar.
3. **O n-grama esfria rápido**: o trigrama do modelo tem 2,5 sucessores em média (máx 5) — a
   partir da 3ª/4ª palavra o contexto real cai no bigrama/unigrama e a confiança cai junto.
4. **Não existem 4-gramas nem frases**: o modelo corta em trigrama e o índice do documento só
   aprende pares (bi) e trios (tri) de **palavras**; nada guarda "por outro lado,", "de acordo
   com o" ou "ao mesmo tempo em que" como unidade.
5. **Não há memória de frases**: o feedback aprende pares (palavra → palavra), não sequências
   que a pessoa aceitou; quem digita "obrigado pela atenção" dez vezes por dia não recebe isso
   como sugestão de uma vez.

---

## 5. Estado da arte sem IA (com fontes)

### 5.1 Qualidade do modelo: suavização e ordem

- **Kneser-Ney (interpolado/modificado)** é a suavização clássica de melhor custo-benefício para
  n-gramas; o estudo empírico de Chen & Goodman (1999) é a referência de comparação
  ([PDF](https://people.eecs.berkeley.edu/~klein/cs294-5/chen_goodman.pdf)). O app hoje usa uma
  mistura linear simples (trigrama 0,5 + bigrama 0,35 + unigrama 0,15) — um backoff de verdade
  (com desconto) tende a acertar mais nas caudas.
- **Stupid Backoff** (Brants et al., 2007) mostra que, com muito dado, "esquecer" a
  normalização e usar frequências relativas com um desconto fixo chega perto de Kneser-Ney com
  fração do custo ([PDF](https://aclanthology.org/D07-1090.pdf)) — é a opção "barata" se o
  corpus crescer.
- **Cache e skip-grams**: Goodman (2001) reporta ganhos consistentes combinando cache (o que
  acabou de aparecer) e modelos pulando palavras
  ([PDF](https://www.cs.brandeis.edu/~cs136a/CS136a_docs/goodman2001.pdf)) — ideia diretamente
  aproveitável para o *documento + memória pessoal*, que já funcionam como cache.
- **PPM / context mixing**: em vez de escolher uma ordem, **misturar previsões de várias
  ordens** (caractere e palavra) é a base dos preditores de texto clássicos desde Cleary &
  Witten (1984) ([Wikipedia](https://en.wikipedia.org/wiki/Prediction_by_partial_matching),
  [demo PPM](https://willwade.github.io/ppmpredictor/)) — caminho natural para "sugerir longo"
  sem IA.

### 5.2 Estruturas e velocidade

- **KenLM** (Heafield, 2011) implementa duas estruturas de consulta — *hash de sondagem* e
  *trie* — com quantização de probabilidades/backoff para reduzir memória e tempo
  ([ACL Anthology](https://aclanthology.org/W11-2123/),
  [PDF](https://kheafield.com/papers/avenue/kenlm.pdf)). Lições diretas: consultar o modelo em
  estruturas **planas e compactas** (arrays tipados), **quantizar** contagens e **pré-agrupar
  sucessores** por contexto.
- **DAWG/DAFSA** (autômatos acíclicos) e **FSTs** compactam dicionários e respondem "palavras
  que começam com X" sem varrer e ordenar a lista inteira como o `withPrefix` faz hoje
  ([DAWG básico](https://jbp.dev/blog/dawg-basics.html),
  [dawgdic](https://hackage.haskell.org/package/dawgdic)).
- **Top-k pré-computado**: guardar, por contexto, apenas os k sucessores mais prováveis (o
  build já faz 12/5) permite ao runtime **não montar mapas** — é só ler e ordenar uma lista
  curta de arrays.
- **Fora da thread principal**: índices e consultas pesadas em **Web Worker**, com ou sem WASM,
  é a receita consolidada para não engasgar a UI
  ([web.dev — threads](https://web.dev/articles/webassembly-threads),
  [Chrome — WASM/WebGPU](https://developer.chrome.com/blog/io24-webassembly-webgpu-1)).

### 5.3 Sugestões longas (frases) sem IA

- **Beam search**: manter as `k` melhores continuações parciais e escolher no fim com
  **normalização de comprimento** é o algoritmo padrão de decodificação (e vale para n-gramas
  também, não só redes) ([Dive into Deep Learning, cap. 8.4](https://d2l.ai/chapter_recurrent-modern/beam-search.html)).
  É exatamente o que falta hoje (encadeamento guloso).
- **Frases valiosas vs. palavras exatas**: Arnold, Gajos & Kalai (UIST 2016) mostram que
  sugestões de frases podem **inspirar** e acelerar, mas que o critério não é só "acertar a
  próxima palavra" — a sugestão longa precisa **valer a pena**, senão distrai
  ([UIST](https://dl.acm.org/doi/10.1145/2984511.2984584),
  [Microsoft Research](https://www.microsoft.com/en-us/research/publication/suggesting-phrases-vs-predicting-words-mobile-text-composition/)).
- **Economia de teclas**: a literatura de predição de palavras reporta ganhos de teclado de
  **38% em mediana** em vários estudos (faixa 23–58%)
  ([Koester & Levine](https://kpronline.com/files/KOESTER-LEVINE-Effect-of-a-word-prediction-feature-on-user-performance.pdf))
  e até **45%** em teclados móveis no estudo da UIST — referências para calibrar metas.
- **Tabela de frases**: minar do corpus os **n-gramas de 4–5 palavras** mais frequentes (ou as
  aberturas: "por outro lado,", "de acordo com o", "ao mesmo tempo em que") e consultá-los como
  unidade é o "sem IA" mais próximo do *Smart Compose* para trechos curtos; o modelo atual já é
  construído a partir de corpus (`scripts/build-ngrams.mjs`), então é uma extensão natural do
  build.
- **Prática de teclados**: a combinação de n-gramas com **modelo de toque e busca** é o desenho
  clássico dos teclados preditivos ([patente Google](https://patents.google.com/patent/US20150347383A1/en),
  [panorama n-gram](https://genmind.ch/posts/N-gram-Language-Models-The-Classic-Building-Blocks-of-Predictive-Text/)).

### 5.4 Projetos de referência (sem IA)

- **KenLM** — consulta de n-gramas, C++ ([paper](https://aclanthology.org/W11-2123/)).
- **Presage** — plataforma de predição de texto (n-gramas + adaptação, C++)
  ([documentação](https://presage.sourceforge.io/documentation/presage/doc/html/index.html)).
- **dawgdic / DAWG** — dicionários compactos com travessia de prefixos
  ([Hackage](https://hackage.haskell.org/package/dawgdic)).
- **PPM** — implementações didáticas e produção didática
  ([rene-puschinger/ppm](https://github.com/rene-puschinger/ppm)).

---

## 6. Decisão técnica proposta

### V1 — Aquecer e enxugar (velocidade)

1. **Índice incremental**: em vez de reler o documento inteiro, indexar por parágrafo com uma
   janela deslizante (limite ~200–400 mil caracteres) e atualizar só os parágrafos que mudaram.
   Alvo: *estimativa* ≤ 5 ms em qualquer documento.
2. **Índice no Worker**: mover `DocumentIndex` para um Web Worker (transferindo patches de
   texto), tirando os picos da thread principal; o `predict` continua no main hoje (é leve),
   podendo migrar depois junto do modelo.
3. **Modelo quente e barato**: manter o carregamento no boot, mas (a) tirar a ordenação
   alfabética do construtor e **pré-computá-la no build** (tira ~27–32 ms do arranque);
   (b) guardar o JSON em cache (IndexedDB/HTTP) e, se necessário, dividi-lo em dois arquivos
   (unigramas+bigramas primeiro; trigramas e frases depois) para o motor ficar útil antes.
4. **Sem alocação por consulta**: ler os sucessores direto de listas pré-ordenadas (top-k já
   existe no arquivo) e reusar buffers no `rank`; no prefixo, trocar a varredura+ordenação por
   um índice ordenado (ou DAWG) precomputado no build.
5. **Linha de base registrada** no apêndice; medir de novo com o mesmo método depois de cada
   passo.

### V2 — Alongar (sugestões de muitas palavras)

1. **Beam de continuação**: em vez do "while p ≥ 0,45", expandir as `k` melhores hipóteses
   (k = 3–5) somando log-probabilidades, com **penalidade/normalização de comprimento** e teto
   configurável (ex.: 12–16 palavras). Paradas naturais: fim de frase, pontuação prevista,
   queda de confiança abaixo de um piso móvel.
2. **Limiar por posição**: afrouxar a exigência a cada palavra (ex.: 0,45 → 0,30 → 0,22 → 0,15)
   e usar a **soma** como critério, em vez de cada palavra isolada.
3. **Tabela de frases no build**: guardar os 4-gramas/5-gramas mais frequentes do corpus num
   mapa próprio (ex.: top 50 mil), consultados como unidade — é o que produz sugestões
   "prontas" como "de acordo com", "por outro lado" e aberturas de frase.
4. **Confiança visível**: a sugestão longa aparece inteira em cinza e o `Alt+→` continua
   entregando palavra a palavra; se a pessoa digitar algo diferente, o feedback já pune o par.
5. **Limites de segurança**: comprimento máximo por configuração (intensidade "Discreta /
   Equilibrada / Agressiva" ganha um dente a mais no modo Agressiva), nunca sugerir depois de
   fim de parágrafo, e não encadear através de vírgula + pronome (o modelo pode errar aí).

### V3 — Memória de frases do usuário

1. **Aprender sequências aceitas**: quando a pessoa aceita uma sugestão com Tab, guardar a
   sequência de palavras (com contexto) num cache de frases; quando aceita palavra a palavra,
   guardar o prefixo aceito. Sugerir do cache antes do modelo do idioma quando o contexto casar.
2. **Cache do documento**: as frases repetidas de um documento (títulos, fórmulas de escrita
   do autor) já são o que o índice aprende em palavras — passar a aprender **4-gramas do
   documento** também.
3. **Warm start**: ao abrir um documento, pré-aquecer o índice da memória pessoal dos
   documentos mais parecidos (o `memory.ts` já tem os 24 últimos).

### V4 — Avaliação contínua

1. `scripts/eval-ghost.mts` já mede **economia de teclas, cobertura, precisão e
   multi-palavra**; acrescentar ao relatório a **distribuição de largura** (1/2/3/4+ palavras)
   e a **precisão por profundidade** (acerta a 1ª? a 2ª? a 3ª?).
2. Rodar com 3 textos fixos (formal, técnico, coloquial) antes/depois de cada fase, com
   `GHOST_T`/`GHOST_MIX` para calibrar limiares.
3. Registro no changelog/histórico técnico a cada fase, com os números.

---

## 7. Plano por fases com critérios de aceite

| Fase | O que entra | Esforço | Critério de aceite (*estimativa*) |
| --- | --- | --- | --- |
| **V0** | Medidor reproduzível (apêndice) + linha de base no doc | P | números publicados aqui e script de medição no repositório |
| **V1** | Índice incremental+worker; ordem alfabética no build; top-k sem mapas; buffers reusados | M | re-index ≤ 5 ms (200 mil); p99 do `predict` ≤ 2 ms na amostra; nenhum engasgo > 16 ms na digitação típica |
| **V2** | Beam + limiar por posição; 4-gramas/frases no build; intensidade ajusta o teto | M–G | ≥ 25% das sugestões com 3+ palavras (hoje 9,2%); média ≥ 2 palavras (hoje 1,35); precisão palavra-a-palavra não cai |
| **V3** | Memória de frases (aceites + documento) | M | +20% de economia de teclas no `eval-ghost` sobre a base; cache responde antes do modelo em contextos repetidos |
| **V4** | Relatório de largura/precisão no eval; rotina de calibração | P | toda fase medida com os 3 textos, números no histórico técnico |

(P = pequeno, M = médio, G = grande.)

---

## 8. Riscos e salvaguardas

- **Sugestão longa errada irrita mais que uma curta**: encadear só com confiança decrescente e
  parar em pontuação; manter `Esc`/digitar por cima como recusa (já existe e alimenta o
  feedback).
- **Custo cognitivo**: o estudo da UIST 2016 é explícito — sugestões de frase precisam ser
  **valiosas**; vale medir aceitação por largura antes de soltar frases longas no padrão.
- **Finais de frase**: não sugerir além de um fim previsto (ponto) sem parar; frases do corpus
  não devem atravessar parágrafos.
- **Memória/CPU**: o worker e a janela deslizante evitam crescimento sem limite; o cache de
  frases terá teto (ex.: 5 mil sequências) com LRU.
- **Privacidade**: tudo continua local (o modelo é um arquivo do app; feedback/memória em
  localStorage) — nenhuma fase introduz rede.

---

## 9. Apêndice — como as medições foram feitas (reproduzível)

1. **Qualidade do modelo e cobertura**: `npx tsx scripts/eval-ghost.mts <texto> <maxChars>` com
   `GHOST_MODEL=public/ngrams/pt.json` (o script já existe; mede teclas economizadas,
   cobertura, precisão e multi-palavra). `GHOST_T`/`GHOST_MIX` ajustam limiares/pesos.
2. **Latência e largura na amostra**: os módulos reais
   (`documentIndex.ts`, `predict.ts`, `model.ts`) foram empacotados com
   `esbuild --bundle --platform=node` (o único import externo é `@codemirror/state`, de tipos) e
   rodados no Node 24 com o `pt.json` real; a varredura chama `predictFromLine` em posições de
   fronteira de palavra (passo 2) sobre 60 mil caracteres de `docs/pesquisa-correcao-offline.md`
   e registra percentis com `performance.now()`. O mesmo harness mede `DocumentIndex.update()`
   em 20/60/200/400 mil caracteres e a diferença com/sem modelo (`SEM_MODELO=1`).
3. **Números do arquivo**: contados com `JSON.parse` direto do `public/ngrams/pt.json`
   (vocabulário, contextos e sucessores por ordem) e `fs.statSync` para o tamanho.
4. Os harnesses são temporários (não ficam no repositório); a receita acima permite refazer
   tudo. Se a V0 for aprovada, o medidor vira script fixo em `scripts/`.

## 10. Referências

- Heafield, K. **KenLM: Faster and Smaller Language Model Queries** (WMT 2011) —
  <https://aclanthology.org/W11-2123/> · PDF: <https://kheafield.com/papers/avenue/kenlm.pdf>
- Brants, T. et al. **Large Language Models in Machine Translation** (EMNLP 2007; *stupid
  backoff*) — <https://aclanthology.org/D07-1090.pdf>
- Chen, S. & Goodman, J. **An Empirical Study of Smoothing Techniques for Language Modeling**
  (1999) — <https://people.eecs.berkeley.edu/~klein/cs294-5/chen_goodman.pdf>
- Goodman, J. **A Bit of Progress in Language Modeling** (2001; cache e skip-grams) —
  <https://www.cs.brandeis.edu/~cs136a/CS136a_docs/goodman2001.pdf>
- Cleary, J. & Witten, I. **Prediction by Partial Matching** (1984) —
  <https://en.wikipedia.org/wiki/Prediction_by_partial_matching> · demo:
  <https://willwade.github.io/ppmpredictor/> · código:
  <https://github.com/rene-puschinger/ppm>
- Arnold, K., Gajos, K., Kalai, A. **On Suggesting Phrases vs. Predicting Words for Mobile
  Text Composition** (UIST 2016) — <https://dl.acm.org/doi/10.1145/2984511.2984584> ·
  <https://www.microsoft.com/en-us/research/publication/suggesting-phrases-vs-predicting-words-mobile-text-composition/>
- Koester, H. & Levine, S. **Effect of a Word Prediction Feature on User Performance** —
  <https://kpronline.com/files/KOESTER-LEVINE-Effect-of-a-word-prediction-feature-on-user-performance.pdf>
- **DAWG/DAFSA** — <https://jbp.dev/blog/dawg-basics.html> ·
  <https://hackage.haskell.org/package/dawgdic>
- **Presage** (predição de texto) —
  <https://presage.sourceforge.io/documentation/presage/doc/html/index.html>
- **Beam search** — <https://d2l.ai/chapter_recurrent-modern/beam-search.html>
- **WebAssembly threads + Workers** — <https://web.dev/articles/webassembly-threads> ·
  <https://developer.chrome.com/blog/io24-webassembly-webgpu-1>
- **Patente de predição de texto (n-gramas combinados)** —
  <https://patents.google.com/patent/US20150347383A1/en>
- **Panorama de n-gramas em teclados preditivos** —
  <https://genmind.ch/posts/N-gram-Language-Models-The-Classic-Building-Blocks-of-Predictive-Text/>
