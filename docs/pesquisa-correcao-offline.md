# Correção e sugestão offline sem IA — pesquisa, gargalos e plano por fases

> **Escopo.** Como fazer o assistente de escrita do mdOffice (a) **incomodar menos desde o
> primeiro minuto**, (b) **corrigir sozinho com confiança conforme aprende** e (c) usar
> **algoritmos melhores sem depender de IA**. O texto abaixo diagnostica o que existe hoje em
> `src/broker/` (nomes de arquivo e de função, sem copiar código), resume o estado da arte com
> fontes, propõe uma decisão de troca baseada em probabilidade e organiza um plano em fases
> (F0–F4) com métricas.
> **Data:** 2026-10-13. **Acesso aos links:** 2026-10-13.
> **Números deste documento:** os internos foram medidos no repositório nesta data; os externos
> têm fonte citada; metas de desempenho estão marcadas como *estimativa*.

---

## 1. Resumo executivo

1. O corretor de hoje é um bom corretor de **palavra errada comum** (digitação, acento, erro
   clássico), mas o desenho atual foi feito para *não errar*, e é justamente isso que o faz
   parecer **tímido no começo e instável no meio do caminho**.
2. O maior gargalo técnico não é o dicionário: é **ranquear candidatos sem contexto** e
   **decidir a troca por regras fixas** em vez de probabilidade (com notável exceção do
   reordenamento por contexto em `personal/rerank.ts` e do modelo de n-gramas em `ghost/`).
3. O aprendizado pessoal só olha **pares exatos de palavra** (`estenso→extenso`) e só quando a
   pessoa **aceita** — não há sinal negativo (Ctrl+Z, digitar por cima), nem aprendizado por
   *classe* de erro (letras trocadas, teclas vizinhas, acento), o que atrasa a "memória" em
   ordens de grandeza.
4. Existem técnicas **sem IA** maduras para tudo o que falta: índice de deletes (SymSpell),
   autômatos de Levenshtein, tabelas de confusão do português (o LanguageTool mantém listas
   PT com dezenas de KB), fonética BR (SoundexBR), morfologia por regras (os afixos do próprio
   Hunspell) e modelos de n-gramas com *stupid backoff* ou Kneser-Ney (KenLM).
5. Dá para **reaproveitar o que o app já tem**: o modelo `public/ngrams/pt.json` (30 mil
   palavras, ~30 mil contextos de bigrama, ~141 mil de trigrama) hoje só serve o fantasma e a
   revisão profunda — ele pode ranquear candidatos do corretor.
6. A recomendação central é **separar detecção, geração e decisão** e transformar a decisão em
   um teste de probabilidade com margem (vencedor × segundo colocado), com limiar **adaptável**
   à taxa de aceitação da pessoa.
7. "Memória que aquece" = dicionário pessoal automático com histerese + n-gramas do próprio
   documento desde o primeiro parágrafo + perfil de erros do usuário (classe, não só par) —
   tudo local, sem esperar centenas de decisões.
8. Segurança primeiro: empate → sugerir (nunca aplicar), teto de correções por parágrafo,
   nunca mexer na palavra sob o cursor (já é regra) e 1 passo de Ctrl+Z por varredura (já é).
9. O que **não** dá para prometer sem IA: reescrita semântica, coerência global, ironia e
   desambiguação fina — isso continua sendo sugestão, ou revisão explícita da IA local opcional.
10. O plano tem 5 fases (F0 medir → F1 candidatos/ranking → F2 decisão probabilística →
    F3 morfologia/palavra real → F4 auto-cura de conhecimento); F0 e F1 atacam a maior parte
    da dor com esforço **P/M**, sem trocar o motor de dicionário.

---

## 2. Diagnóstico do pipeline atual

### 2.1 O caminho de uma sugestão, passo a passo

1. **Varredura** — `src/app/assistant.ts` chama `checkText()` (`src/broker/check.ts`) na pausa,
   ao fechar parágrafo, ao salvar e no "Corrigir tudo". `checkText` roda as **33 regras de
   estilo** (`src/broker/style/index.ts`, lista `RULES`) sobre o texto mascarado
   (`src/broker/mask.ts` esconde código, links, HTML) e, em paralelo, procura palavras
   desconhecidas no dicionário.
2. **Dicionário** — `src/broker/spell.ts` conversa com `spell.worker.ts` (Web Worker). O worker
   carrega `public/dicionario/pt_BR.aff` (980 KB) + `pt_BR.dic` (**312.368 raízes**, 4,5 MB) via
   **typo-js** (BSD modificada) e responde "esta palavra existe?".
3. **Sugestão** — para palavra desconhecida, `sugerirPalavra()` (worker) monta notas em camadas:
   erro clássico da tabela `ERROS_COMUNS` (**20 pares**) ou troca já aprendida (`APRENDIDAS`)
   valem 1,5; **variantes só de acento/cedilha** (geração limitada a ~1500 combinações, até 3
   achadas válidas) valem 1,0; candidatos reais de `spell/candidatos.ts` (índice invertido de
   **trigramas** + distância de Damerau-Levenshtein ≤2 + frequência) valem até 0,9.
4. **Frequência** — o vocabulário de candidatos vem de `public/ngrams/freq-pt.json`
   (**29.476 palavras**, 409 KB): palavras e contagens do corpus de texto escrito, sem as
   tabelas de sequência. O peso da frequência é **fixo** (`PESO_FREQUENCIA = 3.7`,
   `spell/candidatos.ts`), calibrado contra `test/docs/gramatical.md` (30 casos).
5. **Palavras grudadas** — `separarGrudada()` corta em 2–3 pedaços usando a posição na lista de
   legendas (`src/broker/palavras.ts`, **4.000 palavras do OpenSubtitles 2016**, via
   FrequencyWords) e `separarTruncada()` completa palavras cortadas ("coisasqu" → "coisas que").
6. **Reordenamento por contexto** — de volta ao thread principal, `personal/rerank.ts` pode
   **trocar a primeira sugestão** se o modelo de idioma (`ghost/model.ts`) e as memórias
   pessoais sustentarem outra mais, exigindo evidência ≥ 0,03 e ≥ 2× a original. A correção
   automática (`auto`) só sobrevive se o `rerank` **não mudou** a ordem.
7. **"Você quis dizer"** — `neighbor.ts` (com `commonNeighbor`) trata palavra *que existe* mas
   é rara e está a uma letra de uma palavra muito comum, com limiares rígidos
   (`USO_REAL=20`, `VANTAGEM=20`, `PISO_CANDIDATA=50`); o resultado **nunca** entra sozinho.
8. **Aplicação** — `spell.ts` devolve `best` (confiança) e `check.ts` monta o aviso com `auto`;
   `assistant.ts#autoFixWords()` aplica em uma transação de edição (1 passo de Ctrl+Z), nunca
   na palavra sob o cursor; `applyFixes()` chama `registrarCorrecao()` (`aprendizado.ts`), que
   aprende o par quando for aceito.

### 2.2 O que já está bem resolvido

- Detecção com **dicionário Hunspell completo** — a autoridade de "isto é palavra?" é boa; o
  problema está na sugestão e na decisão, não na consulta.
- **Correção de acento** com nota máxima e confiança total — cobre o erro mais comum.
- **Distância com inversão** (Damerau) — "maneria → maneira" funciona.
- **Não sugerir quando não há nada razoável** — decisão de produto correta; erros de omissão
  são menos graves que uma sugestão absurda.
- **Reordenamento contextual** já existe e é bem-comportado (só troca com evidência clara).
- **Undo** de uma varredura inteira como um passo, e regra rígida de não tocar a palavra em edição.
- **Privacidade**: dicionário, frequência, n-gramas, aprendizado e IA são todos locais.

### 2.3 Gargalos — e a que dor cada um explica

| Dor do usuário | Causa técnica (onde) | Efeito observável |
| --- | --- | --- |
| "No começo as sugestões parecem defasadas e incomodam" | Índice de candidatos com vocabulário fixo (só `freq-pt.json`) + reordenamento que exige 2× de evidência + aprendizado que só liga depois de 2 aceites (`ACEITES_PARA_CONFIAR = 2`) e de 30 decisões no fantasma (`personal/feedback.ts`) | Falso positivo em nome próprio/neologismo; sugestão pior que a óbvia do contexto; nada melhorou nas primeiras horas de uso |
| "Quero que com o tempo corrija sozinho com confiança" | A decisão `best` é uma cadeia de regras fixas (`spell.worker.ts#sugerirPalavra`): acento, clássico, distância 1 vs. 2, margem ≥ 0,05, distância 2 com 10× frequência, ou sugestão única | O app só "solta" a mão em casos tabelados; trocas legítimas ficam eternamente como aviso; não há noção de confiança que amadurece com o uso |
| "Quero um algoritmo muito melhor, sem IA" | Sem geração de candidatos por *deletes*/autômato, sem tabela de confusões PT-BR, sem fonética, sem morfologia geradora e sem modelo de linguagem na pontuação dos candidatos | Recall baixo em erros "de pessoa" (ss/s/ç, g/j, e/i, o/u, m/n, h mudo) e ranking decidido por frequência genérica, não pelo contexto da frase |
| "Sugestões ruins incomodam" (falsos positivos) | Frequência de corpus é única e global; o viés das listas de legenda (`palavras.ts`) ainda aparece no "você quis dizer" e nos cortes de palavra grudada | "lento → tento"-like; sinalização de termo técnico que a pessoa usa sempre |
| (Todos) | Sinais negativos ausentes: desfazer e digitar por cima não contam como recusa; o aprendizado não conhece **classes** de erro, só pares exatos | Aprende devagar (uma entrada por erro distinto) e pode repetir uma troca que a pessoa rejeitou sem nunca perceber |

#### a) Dicionário estático — flexões, neologismos e termos do usuário

O `.dic` é uma lista de **raízes com flags de afixo**; quem aplica as regras de flexão é o
typo-js na *checagem*, mas o **índice de sugestão** só enxerga as 29.476 palavras do corpus de
frequência. Ou seja: uma flexão válida que não está entre as palavras frequentes pode **não ser
sugerida** mesmo existindo no idioma. Para termos técnicos e neologismos há apenas a lista fixa
`PALAVRAS_OK` (**90 termos**) e a regex `JARGAO` (verbos aportuguesados). O dicionário pessoal
existe, mas é **manual** ("Configurações → Abrir dicionário…") — nada é adicionado sozinho.

#### b) Ranking por distância + frequência única

`candidatos()` ordena por `-distância + 3.7 · log(freq)/maxLog`. Não há:
contexto (o worker não vê a frase), classe de erro (trocar "c" por "ç" não pesa diferente de
trocar qualquer letra), proximidade de teclado, nem morfologia ("responsavo" precisa *competir*
com flexões reais da mesma raiz). O peso 3,7 é o mesmo para qualquer palavra, comprimento e
situação.

#### c) Sem modelo de linguagem na hora de decidir

O modelo de idioma existe e é bom para o que se propõe: `public/ngrams/pt.json` (7,3 MB;
30.003 palavras, 29.669 contextos de bigrama, 140.865 de trigrama) alimenta o fantasma
(`ghost/predict.ts`, com limiares 0,26 para próxima palavra e 0,82 para completar), a revisão
profunda (`deep/analyze.ts`) e o reordenamento. **O corretor não o usa**: o worker só baixa o
`freq-pt.json` enxuto. Sem P(alvo | anteriores), o corretor não distingue "eu **quis**" de
"eu **quiz**" por probabilidade — só por dicionário.

#### d) Aprendizado pessoal frio no começo

O que o app aprende e quando (números reais do código):

| Módulo | Precisa de | Guarda | Hoje começa a valer quando… |
| --- | --- | --- | --- |
| `aprendizado.ts` | 2 aceites (`ACEITES_PARA_CONFIAR`) | até 3.000 pares `errado→certo` | a pessoa aceita a mesma troca 2× |
| `personal/feedback.ts` (fantasma) | 30 decisões (`st.n < 30`) | pontuação por contexto/palavra (teto 6.000) | 30 aceites/recusas observados |
| `ghost/memory.ts` | documento ≥ 200 chars | 24 documentos × 40 mil chars | salvar/trocar de aba/fechar (debounce 2,5 s) |
| `personal/profile.ts` | 400 palavras e 25 frases | histogramas por documento | alguns textos salvos |

Nada disso aprende com a **primeira frase**: não há perfil de erro durante a sessão, nem
aproveitamento imediato do texto que está sendo escrito (o `DocumentIndex` do documento atual
existe em `ghost/documentIndex.ts` e ajuda a prever, mas **não** a corrigir).

#### e) Auto-aplicar conservador (e sem feedback negativo)

As condições de `best` são seguras, mas: (1) não têm **margem probabilística** — é limiar de
nota, não de chance de acerto; (2) não distinguem "primeira vez do usuário" de "usuário que
aceita 97% das trocas"; (3) quando a troca é rejeitada (Ctrl+Z ou reescrita por cima), **nada é
registrado** no corretor — o par aprendido pode até ter vindo de um Ctrl+Z.

#### f) Tabelas pequenas e sem classes

`ERROS_COMUNS` tem 20 pares; `data/informal.ts`, 18 padrões; `data/aGente.ts` e as listas de
`abbreviations.ts`/`commonWords.ts` são curadas à mão. Faltam exatamente as **classes** que
mais produzem erro real em português: `c/ç/s/ss/sc/x/ch`, `g/j`, `e/i`, `o/u`, `m/n`,
`h` mudo e acentuação — classes que o LanguageTool trata com dezenas de KB de listas (por
exemplo, `confusion_pairs.txt` ≈ 56 KB e `diacritics.txt` ≈ 17 KB no módulo `pt`).

---

## 3. Estado da arte sem IA

### 3.1 Ferramentas e dicionários (o que dá para usar/embutir)

| Ferramenta | O que é | Licença | Idiomas | Como encaixa no mdOffice |
| --- | --- | --- | --- | --- |
| **Hunspell** | Motor de correção e **analisador morfológico** (afixos, compostos) | tri-licença **MPL 1.1 / GPL 2.0 / LGPL 2.1** | qualquer (dicionários) | Já é a base via typo-js; a parte de **afixos** pode gerar formas para o índice de sugestão |
| **Vero (pt-BR do LibreOffice)** | Dicionário oficial do LibreOffice Brasil + corretor gramatical (Lightproof, desde 2013) | dicionário **LGPL-3.0 OR MPL-2.0** (pacote `dictionary-pt`, de onde o app copia `pt_BR.dic/.aff`) | PT-BR | Já é o dicionário do app; a lista de afixos é a mina para morfologia |
| **nspell** (JS) | Hunspell em JavaScript puro, API simples, dicionários pessoais | MIT | qualquer | Alternativa/complemento ao typo-js (ex.: sugerir com `personal()` separado) |
| **LanguageTool** | Verificador gramatical com acervo amplo de regras PT-BR | núcleo **LGPL 2.1+**; n-gramas opcionais baixados à parte | 20+ idiomas, PT e PT-BR | Rodar **local** exige Java (servidor HTTP embutido) — pesado para o Tauri; as **listas de dados** (confusões, diacríticos) são o ouro |
| **Harper** (Automattic) | Corretor gramatical offline em Rust, compila para WASM | **Apache-2.0** | **só inglês** (por enquanto) | Referência de arquitetura e de velocidade; não serve para PT-BR hoje |
| **Vale** | Linter de prosa "markup-aware" (Markdown etc.) | MIT | regras por idioma (spelling via dicionário Hunspell em Go) | Referência de integração com Markdown e de estilo por arquivo, não de gramática PT |
| **textlint / retext** | Ecossistema JS de lint de texto | MIT | plugins por idioma | Ideias para regras declarativas; PT-BR ainda incipiente |
| **write-good / proselint** | Linters de estilo em inglês | MIT / BSD-3-Clause | inglês | Só como referência de catálogo de regras |

Observações de produto:

- **LanguageTool** é o único com regras PT-BR prontas e mantidas (arquivos
  `grammar.xml` ≈ 2,8 MB, `style.xml` ≈ 1,2 MB, listas de ruído/estilo), mas a forma de embutir
  hoje é **servidor Java local** (Java 8+ para rodar o servidor; compilar exige 17+) — decide-se
  por tamanho de instalador e memória, não por algoritmo. O caminho pragmático é **importar as
  listas** (confusões, diacríticos, barbarismos, redundâncias, clichês) como dados e reimplementar
  as regras que interessam no motor do app.
- **Harper** mostra que um corretor Rust/WASM completo cabe em milissegundos e pouca memória —
  mas é inglês; serve de benchmark de engenharia (e de sinal de que, se um dia houver linter
  PT-BR em Rust, vale integrar).

### 3.2 Geração de candidatos (o que trocar no índice)

- **Norvig** (pedagógico, base de comparação): edições de 1 caractere (apagar, trocar, inserir,
  inverter) e `known`/`known_edits2`, escolhendo por frequência do corpus.
- **SymSpell**: pré-calcula **somente deletes** de cada palavra do dicionário (uma palavra de 5
  letras gera ~25 deletes para cobrir distância 3) e faz lookups em hash — o README reporta
  **0,033 ms/palavra** (distância 2) e **0,180 ms** (distância 3) em um núcleo de 2012, ~1.870×
  mais rápido que BK-tree e ~1.000.000× que Norvig nos benchmarks do projeto. Licença **MIT**.
- **BK-tree**: índice métrico clássico para busca aproximada (Burkhard & Keller, 1973); bom
  quando há *poucas* consultas por segundo e memória curta, mas o benchmark do SymSpell o
  coloca atrás em velocidade.
- **Autômatos de Levenshtein** (Schulz & Mihov, 2002): constrói-se um DFA que aceita qualquer
  palavra a ≤n edições e percorre-se o **trie** do dicionário uma vez (é o que o Lucene usa).
  Excelente quando o dicionário já está em trie/FST e se quer restrição por prefixo.
- **Observação sobre "GT/GTR":** essas siglas aparecem em conversas e comparativos de corretores
  sem documentação primária consolidada; o mecanismo por trás delas é o mesmo das abordagens
  acima (índice de deletes / trie / autômato). Por isso o plano adota os mecanismos
  verificáveis, e não as siglas.
- **Transposições e edições ponderadas**: pesa mais o erro provável — inversão de letras
  vizinhas, tecla vizinha no teclado, dígrafo trocado (`ss`↔`ç`), acento ausente. O peso por
  tipo de edição é o que distingue "erro de dedo" de "erro de língua".
- **Variantes só de acento**: já implementadas no app; o ganho está em **não parar na primeira**
  (hoje o teto é 3) e casar com a gramática da frase ("esta"/"está" exige contexto).
- **Tabelas de confusão do português**: `c/ç/s/ss/sc/x/ch`, `g/j`, `e/i`, `o/u`, `m/n`, `h`
  mudo, acentuação e parônimos ("eminente/iminente", "descrição/discrição",
  "concerto/conserto"). O LanguageTool mantém essas listas em dados (`confusion_pairs.txt`,
  `diacritics.txt`, `verbos_sem_acento_*.txt`), e o estudo de Gimenes et al. (2015, ver §3.3)
  mostra os padrões que os brasileiros de fato cometem.
- **Fonética para português**: Soundex clássico não foi feito para português; existem
  adaptações publicadas — **SoundexBR** (pacote R, GPL≥2) e **metaphonebr** (CRAN, foco em
  nomes). Para o corretor, fonética entra como **desempate** (candidato que soa igual), nunca
  como critério único.

### 3.3 O que a literatura mostra sobre erro de escrita em PT-BR

- **Gimenes, Roman & Carvalho (2015)**, *Spelling Error Patterns in Brazilian Portuguese*:
  estudo com 1.808 textos de 452 participantes (62.858 palavras) tipificando os padrões de erro
  do português brasileiro — base direta para peso por classe de erro. As categorias incluem
  trocas de letras, falta/adição, acentos, junção/separação de palavras, entre outras
  (o corpus é descrito no artigo como disponível para download — conferir licença antes de usar).
- Um corretor de **palavra isolada** resolve da ordem de **~78% dos erros** (valor citado por
  Kukich (1992) e reproduzido no artigo do Redalyc sobre implementação do corretor de Norvig) —
  bom para calibrar expectativa: erro de palavra real e de contexto exige mais que dicionário.
- **Probi** (Martins, 2002) é um corpus de aceitabilidade com 11.625 frases anotadas, das quais
  2.616 agramaticais; num artigo de 2023 (STIL), o **LanguageTool** alcança **F1 ≈ 0,40** nesse
  conjunto (CoGrOO ≈ 0,28) — número útil como *baseline externo* de regras, não de ortografia.

### 3.4 Modelos de linguagem estatísticos (sem IA)

- **Objetivo**: substituir a pergunta "qual candidato é mais frequente?" por
  "qual candidato é mais **provável nesta frase**?".
- **N-gramas com *stupid backoff*** (Brants et al., 2007): probabilidade barata de treinar e
  calcular, aproximando Kneser-Ney quando há muita data; ideal para um app que já guarda
  contagens de bigramas/trigramas.
- **Kneser-Ney** (Kneser & Ney, 1995; Chen & Goodman, 1999) é o padrão de qualidade para
  n-gramas; **KenLM** (LGPL-2.1) é a implementação livre de referência: `lmplz -o 5` estima com
  **modified Kneser-Ney**, e o formato binário com `mmap` é o mais rápido de ler.
- No ecossistema do app: não há KenLM em WASM; a rota realista é **pré-computar contagens**
  (como já é feito em `pt.json`) e ler no worker por *lookup* de hash — isto é, "KenLM de
  contagens", não o binário do KenLM. Quem quiser Kneser-Ney de verdade pode gerar o modelo
  *offline* com KenLM e exportar só os topo-N sucessores por contexto.
- **Uso no corretor**: pontuar cada candidato com
  `log P_freq(w) + λ · log P(w | w-1, w-2)` (backoff do trigrama para o bigrama e para o
  unigrama) e decidir pela **margem** entre o 1º e o 2º (`p1 ≥ τ` e `p1 ≥ k·p2`).

### 3.5 Morfologia sem ML

- **Afixos do Hunspell**: o `.aff` já descreve como flexionar (prefixos, sufixos, flags); o
  typo-js usa isso na checagem. O que falta é **materializar as formas** para o índice de
  sugestão (aí "documentos", "documentação" etc. competem no ranking).
- **Regras + léxico** (como o app já faz em `deep/morph.ts` para a revisão profunda): analisar
  ("radical/classe") e reinflectir para concordar em tempo, número e gênero — exatamente o que
  falta para "os documento" → "documentos" virar troca confiável.
- **Stemmers/snowball e recursos Apertium** existem para PT, mas o custo/benefício para o
  corretor é menor do que usar o próprio `.aff` — menos dependência nova, dados já licenciados.

### 3.6 Corpora e frequências livres (com licenças)

| Fonte | O que dá | Licença / condição | Uso recomendado |
| --- | --- | --- | --- |
| `dictionary-pt` (Vero/LibreOffice) | dicionário + afixos PT-BR | **LGPL-3.0 OR MPL-2.0** (o app já usa; escolher MPL e atribuir) | checagem e base morfológica |
| **FrequencyWords** | listas de frequência (base OpenSubtitles) | **MIT** (código) / **CC BY-SA 4.0** (conteúdo) | já usada em `palavras.ts`; aceitável, mas com viés de legenda |
| **Wikipédia (dumps)** | texto corrido formal/variado | **CC BY-SA 4.0** (+ GFDL em parte) | frequência e n-gramas de registro formal |
| **Wikisource / Project Gutenberg PT** | literatura | Gutenberg: textos sem restrição nos EUA (licença da marca à parte); Wikisource CC BY-SA | n-gramas de prosa longa |
| **FineWeb-2 (PT)** | crawl web filtrado | **ODC-By 1.0** | frequência/n-gramas de web geral |
| **GigaVerbo / v2 (Polygl0t)** | 200B/320B tokens PT (agrega várias fontes) | v1: card "other"; v2: "other" no HF (projeto Tucano é Apache-2.0); **revisar fonte a fonte** | só se a atribuição por subfonte for necessária; alternativa mais simples: FineWeb-2 + Wikipédia |
| **OSCAR / CC-100** | web multilíngue | OSCAR é listado como CC0 em card secundário; CC-100 é Common Crawl (termos próprios) | conferir termos antes |
| **brWaC** | 2,7B tokens PT-BR | "available for research purposes only, download upon request" (apud PeLLE/arXiv) | **não** embutir no produto |
| **Corpus do estudo Gimenes et al.** | textos **com erros** anotados do experimento | conforme o artigo; conferir termos | **conjunto rotulado** para avaliar o corretor |

Regra prática para o mdOffice: o app já vive de arquivos pré-computados (`freq-pt.json`,
`pt.json`); **gerar frequência e n-gramas dessas fontes livres num script** (como
`scripts/build-ngrams.mjs` faz) e distribuir **apenas contagens**, sem trechos de texto — é o
que reduz o risco de licença e de tamanho.

### 3.7 O que dá para embutir sem inflar o app

- **Já embutido** e subutilizado: dicionário + afixos, `freq-pt.json`, `pt.json` (bigramas e
  trigramas), `syn-pt.json` (3.510 lemas para sinonímia).
- **Barato de adicionar**: tabelas de confusão PT (dezenas de KB), lista de classes de erro,
  índice de deletes (memória proporcional ao vocabulário × nº de deletes) e pesos de teclado.
- **Caro porém opcional**: KenLM/n-gramas maiores (mais GB), LanguageTool local (servidor Java +
  JVM) — só se virar diferencial claro.

---

## 4. Como corrigir sozinho com segurança

### 4.1 A decisão como probabilidade, não como regra

Para cada palavra desconhecida, o motor gera candidatos e calcula um **escore** que combina:

1. **P(erro de digitação por candidato)** — 1/distância ponderada por classe de erro
   (transposição e tecla vizinha valem mais; `ç↔c` vale mais que `x↔z`).
2. **P_freq(candidato)** — prior do corpus (`freq-pt.json`) **+ prior do documento atual**
   (`DocumentIndex`) **+ prior pessoal** (`ghost/memory.ts`, `aprendizado.ts`), com pesos
   pequenos mas imediatos (o documento de hoje diz mais sobre "hoje" que o corpus).
3. **P(candidato | contexto)** — bigramas/trigramas via backoff (stupid backoff ou KN
   pré-computado): "minha **pretenção**" → "**pretensão**" vs. "**pretensão**"×"preensão".

A troca automática acontece só quando:

```
p1 ≥ τ(usuário, comprimento, classe)   E   p1 ≥ k · p2 (margem sobre o 2º)
```

- **Empate** (margem < k) → mostrar sugestão, nunca aplicar.
- **k ≥ 2–3** é um ponto de partida defensável; calibrar no F0/F2 (*estimativa*).
- **τ começa alto** (perfil novo = conservador) e **cai** conforme a taxa de aceitação da
  pessoa se estabiliza — o mesmo espírito de `thresholdScale` no fantasma, mas no corretor.
- Um **teto de auto-correções por parágrafo** (ex.: 2–3) evita "metralhar" texto novo.

### 4.2 Priors e a memória que aquece (minutos, não semanas)

1. **Durante a sessão** (em memória, sem gravar): contar palavras usadas, pares
   `contexto → palavra` e correções aceitas/recusadas; aplicar em tempo real ao ranking.
2. **Dicionário pessoal automático** com histerese: palavra **desconhecida mas usada N vezes**
   (ou aceita em N contextos) vira "termo do usuário" e **para de ser sugerida**; sai da lista
   se ficar muito tempo sem uso (decaimento). Revisão em Configurações, sempre possível.
3. **Perfil de erro do usuário**: contadores por **classe** (tecla vizinha, dígrafo, acento,
   omissão) e por **par** (`estenso→extenso`), atualizados a cada decisão; classes dominantes
   sobem de prior imediatamente, sem esperar 30 observações.
4. **n-gramas do próprio documento desde o primeiro parágrafo**: o `DocumentIndex` já aprende
   bigramas/trigramas do texto aberto; usá-los na pontuação dos candidatos faz "este texto" ter
   voz desde a primeira linha.
5. **Confusões aprendidas, não só pares**: quando a pessoa corrige `análize→análise`, o sistema
   aprende também "su fixo **-ize** de verbo não vale aqui" — generaliza para `sintetize`,
   `organize`… (com confiança menor que o par exato).

### 4.3 Salvaguardas (o que impede a correção automática de estragar o texto)

- **Nunca** tocar a palavra sob o cursor (regra já existente em `autofix.ts`/`assistant.ts`).
- **Mostrar vs. aplicar**: qualquer classe sem confiança fica só como aviso; empate e
  "palavra real rara" (`neighbor.ts`) nunca auto-aplicam.
- **1 passo de Ctrl+Z** por varredura (já é o comportamento) e **registro do desfazer** como
  recusa (ver §4.4).
- **Proteções de contexto**: nomes próprios, siglas, termos do dicionário pessoal e trechos
  mascarados (código/links) ficam fora da auto-correção.
- **Limite de agressividade**: cada classe tem teto por parágrafo; o app prefere pecar por
  omissão a "consertar" o que estava certo.

### 4.4 Sinais que faltam hoje (e que a decisão precisa)

- **Recusa explícita**: `Esc` no fantasma já registra; para o corretor, o Ctrl+Z imediato à
  varredura e "digitou por cima" (o aviso desapareceu porque o texto mudou) devem entrar em
  `aprendizado.ts`/`personal/feedback.ts` como recusa — hoje não entram.
- **Aceitação implícita**: editar a palavra exatamente para a sugestão da mesma classe é aceite.
- **Amostragem de confiança**: guardar, por faixa de confiança, quantas aplicações foram
  desfeitas — é isso que calibra τ por usuário e evita "aprender errado".

---

## 5. Arquitetura proposta em fases (F0–F4)

| Fase | Objetivo | Esforço | Dor atacada | Métrica de aceitação (meta = *estimativa*, calibrar no F0) |
| --- | --- | --- | --- | --- |
| **F0** | Medir antes de mexer | **P** | — (habilita o resto) | baseline registrado: precisão/recall@1/@3, FP/1000 palavras, aceitação, ms/palavra p95, RSS do worker |
| **F1** | Candidatos e ranking melhores | **M** | 1 e 3 | +10–20 p.p. de recall@3 nos casos de classe (estimativa); FP/1000 não pior; p95 ≤ 2 ms/palavra (estimativa) |
| **F2** | Decisão probabilística + confiança adaptativa | **M** | 2 | ≥ 99% das auto-aplicações mantidas (estimativa); aceitação das sugestões ≥ 80% (estimativa) |
| **F3** | Morfologia e palavra real | **M/G** | 1 e 2 | recall em flexão/concordância (conjunto F0); FP/1000 ≤ 2 em texto formal (estimativa) |
| **F4** | Auto-cura de conhecimento | **P** | 1 e 2 (longo prazo) | termo técnico recorrente para de ser sinalizado em ≤ 3 usos; τ converge em ~2 semanas de uso (estimativa) |

### F0 — Medir antes de mexer (P)

- **Objetivo**: sair do "achismo" com um conjunto rotulado e um painel de números antes de
  qualquer mudança de algoritmo.
- **Conjunto rotulado**: (a) manter `test/docs/gramatical.md` (30 casos) como *regressão*;
  (b) gerar **erros sintéticos por classe** a partir de texto correto (aplicar confusões
  conhecidas e inversões; o gabarito vira o texto original); (c) tentar o corpus do estudo
  Gimenes et al. (textos reais com erro); (d) usar Probi para fenômenos de concordância.
- **Métricas**: recall@1/@3 (o alvo está na lista?), precisão do 1º lugar, **falsos positivos
  por 1000 palavras** (palavra correta sinalizada), **taxa de aceitação** (usou o 'auto' ou
  aplicou o aviso), **ms/palavra** (p50/p95 no worker), **memória** (RSS do worker e tamanho
  dos arquivos carregados), **auto-aplicações desfeitas**.
- **Mudanças**: novos `scripts/avaliar-correcao.mjs` e `src/broker/eval/` (puro, testável fora
  do navegador, no espírito de `spell/candidatos.ts`); contadores em `src/broker/stats.ts` e
  `personal/feedback.ts`. **Nada muda de comportamento.**
- **Impacto**: dá linha de base e trava regressões para todas as fases seguintes.

### F1 — Candidatos e ranking melhores (M)

- **Objetivo**: achar o candidato certo mesmo com erro de "pessoa" (dígrafo, letra vizinha,
  acento, transposição) e ranquear com contexto.
- **Mudanças em `src/broker/*`**:
  - `spell/candidatos.ts` → separar em `spell/indice.ts` (backend de **deletes**, estilo
    SymSpell, com o índice de trigramas mantido como *fallback*) e `spell/pontuar.ts` (escore).
  - novos `spell/confusoes.ts` (classes PT-BR e pesos), `spell/teclado.ts` (vizinhança de
    teclas ABNT2), `spell/morfologia.ts` (formas geradas a partir dos afixos do `.aff`).
  - `spell.worker.ts` passa a **ranquear com bigramas/trigramas**: carregar um `freq-pt.json`
    v2 com os topo-N sucessores por contexto (ou emprestar um recorte do `pt.json`).
  - `frequencia.ts` ganha a frequência **do documento** (via `ghost/documentIndex.ts`) e a
    pessoal (via `ghost/memory.ts`) para o worker.
- **Dados**: `public/dicionario/*` (afixos), `public/ngrams/freq-pt.json` (v2),
  `public/ngrams/pt.json`, tabelas de confusão novas (inspiração: listas PT do LanguageTool +
  padrões do artigo Gimenes et al.).
- **Algoritmos**: deletes simétricos (ou automato de Levenshtein sobre trie); pesos por classe
  de edição; expansão morfológica; escore com backoff `log P_freq + λ_context · log P(w|ctx)`.
- **Impacto nas dores**: 1 (sugestões melhores desde cedo, inclusive sem IA) e 3 (algoritmo).
- **Métricas**: recall@1/@3 no conjunto F0; FP/1000; p95 por palavra; memória do índice de
  deletes (medir com o vocabulário real).

### F2 — Decisão probabilística e confiança adaptativa (M)

- **Objetivo**: o app decidir sozinho **só quando vale**, e ir "soltando a mão" conforme
  aprende.
- **Mudanças**: novo `spell/decisao.ts` (posterior, margem, limiar adaptativo); `autofix.ts` e
  `assistant.ts` passam a pedir a decisão (em vez de olhar `best`); `aprendizado.ts` e
  `personal/feedback.ts` ganham **contadores de recusa** (Ctrl+Z, digitação por cima) e
  **por classe**; `settingsPage.ts` mantém a intensidade como multiplicador de τ e mostra a
  taxa de aceitação.
- **Algoritmos**: `p1 ≥ τ` e `p1 ≥ k·p2`; τ por usuário calibrado por faixa de confiança
  (estatística bayesiana simples: contagem de aplicações mantidas × desfeitas); teto por
  parágrafo; empate → sugestão.
- **Impacto nas dores**: 2 (corrigir sozinho com confiança crescente) — é a fase que responde
  diretamente ao pedido "com o tempo, corrija sozinho".
- **Métricas**: precisão das auto-aplicações (mantidas após 24 h / sem desfazer), taxa de
  aceitação das sugestões, nº de auto-aplicações por 1000 palavras, ms/palavra do caminho de
  decisão.

### F3 — Morfologia e erros de palavra real (M/G)

- **Objetivo**: pegar o que hoje escapa porque a palavra existe — flexão errada, concordância,
  parônimo frequente.
- **Mudanças**: `deep/morph.ts` (já existe) ganha um modo "corrigir"; `concordancia.ts`/
  `check.ts` ampliam a concordância de número/gênero com o léxico; `neighbor.ts` deixa de
  depender das listas de legenda e passa a usar prior de corpus + classes de confusão;
  `spell/morfologia.ts` valida a forma final.
- **Algoritmos**: análise morfológica por regras + reinflexão; teste de contexto (backoff) para
  confirmar a troca de palavra real; tabela de parônimos PT.
- **Impacto**: 1 e 2 (menos "sinaliza o que não deveria" e mais acertos que hoje ficam só no
  aviso).
- **Métricas**: recall/precisão em casos de flexão/concordância; FP/1000 em texto formal; taxa
  de aceitação das sugestões de palavra real.

### F4 — Auto-cura de conhecimento e longo prazo (P)

- **Objetivo**: o sistema manter o próprio conhecimento limpo sem virar um histórico que só
  cresce.
- **Mudanças**: dicionário pessoal automático com histerese e decaimento
  (`aprendizado.ts`/`ghost/memory.ts`); compactação e exportação/importação do aprendizado
  (hoje só `localStorage`); painel em Configurações com precisão percebida, FP/1000 e
  "termos que o app insiste em marcar".
- **Algoritmos**: contadores com meia-vida; promoção/despromoção de termos; calibração contínua
  de τ; detecção de "nunca sugerir" a partir de recusas repetidas.
- **Impacto**: 1 e 2 no acúmulo de semanas — o app **melhora sozinho** e para de repetir ruído.
- **Métricas**: nº de termos promovidos/despromovidos; FP/1000 ao longo do tempo; τ por usuário;
  aceitação semanal; tamanho do aprendizado (KB) e tempo de carga.

### Protocolo de avaliação (vale para todas as fases)

1. **Conjunto de regressão**: `test/docs/gramatical.md` — 30 casos que **não podem** piorar.
2. **Conjunto por classe**: erros sintéticos gerados a partir de texto correto (com o gabarito)
   — mede recall por classe (acento, transposição, dígrafo, tecla vizinha, omissão).
3. **Conjunto real**: corpus do estudo Gimenes et al. (se licença permitir) + amostras reais do
   uso (opt-in, local, anonimizado no dispositivo).
4. **Métricas contínuas no app**: aceitação, desfazer imediato, FP por 1000 palavras, ms/palavra
   e memória — medidos no próprio app, visíveis em Configurações (transparência).
5. **Critério de bloqueio**: qualquer fase que piore FP/1000 ou a precisão de auto-aplicação
   **não fecha** — o corretor prefere não sugerir.

---

## 6. O que não dá para fazer sem IA — e como o app deve se comportar

| Tarefa | Por que não sai sem IA | Comportamento do app |
| --- | --- | --- |
| **Reescrever uma frase** mantendo o sentido | Exige gerar linguagem, não escolher entre candidatos | Sugestão explícita; com IA local ligada, oferecer "revisar com a IA" (como já ocorre na revisão profunda) |
| **Coerência e coesão** do texto (tempos verbais, referências, repetição de ideia) | Depende de significado e de memória longa | Avisos de estilo (repetição, frase longa — já existem) e, no máximo, indicação; nunca reescrita automática |
| **Ironia, humor, tom fino, duplo sentido** | Modelo de mundo | Não opinar; se a IA local estiver ligada, marcar como "sugestão", nunca aplicar |
| **Desambiguação semântica de parônimos distantes** ("concerto/conserto" em contexto ambíguo) | Contexto raso | Sugerir com o contexto disponível; empate → não aplicar |
| **Reescrita de registro** (informal→formal em frases inteiras) | Geração de texto | Manter as trocas pontuais (já existentes) e deixar a reescrita para a IA opcional |
| **Corrigir palavra real usada no sentido errado** em frases longas | Semântica | Detectar só padrões (parônimos, contexto imediato) e sempre como aviso |

Regra geral: **sem IA, o app decide trocas de forma, não de sentido**. Tudo que envolve
significado fica como sugestão — e o app deve dizer isso de forma clara na interface.

---

## 7. Referências

> Todas as URLs foram acessadas em **2026-10-13**.

1. Hunspell — site oficial e licença tri-licença (MPL 1.1 / GPL 2.0 / LGPL 2.1).
   <https://hunspell.github.io/> · <https://github.com/hunspell/hunspell/blob/master/license.hunspell>
2. Chromium/third_party/hunspell — descrição do motor (checador + analisador morfológico).
   <https://chromium.googlesource.com/chromium/src/+/HEAD/third_party/hunspell/README.md>
3. `dictionary-pt` (wooorm/dictionaries; gerado do Vero/LibreOffice) — licença do dicionário
   LGPL-3.0 OR MPL-2.0. <https://github.com/wooorm/dictionaries> ·
   <https://www.npmjs.com/package/dictionary-pt>
4. Projeto VERO (Verificador Ortográfico do LibreOffice) — histórico e corretor gramatical
   (Lightproof). <https://diolinux.com.br/tutoriais/vero-o-corretor-do-libreoffice.html> ·
   <https://extensions.libreoffice.org/en/extensions/show/vero-verificador-ortografico-e-hifenizador-em-portugues>
   · licenças empacotadas: <https://aur.archlinux.org/packages/hunspell-pt-br>
5. nspell — MIT. <https://github.com/wooorm/nspell>
6. Typo.js — BSD modificada. <https://github.com/cfinke/Typo.js>
7. LanguageTool — núcleo LGPL 2.1+; servidor HTTP embutido (requer Java).
   <https://github.com/languagetool-org/languagetool> · <https://dev.languagetool.org/http-server>
8. LanguageTool — módulo português: regras e listas PT (grammar.xml, style.xml,
   `confusion_pairs.txt`, `diacritics.txt`).
   <https://github.com/languagetool-org/languagetool/tree/master/languagetool-language-modules/pt/src/main/resources/org/languagetool/rules/pt>
9. Harper (Automattic) — Apache-2.0; offline, Rust/WASM; **inglês**.
   <https://github.com/Automattic/harper> · <https://writewithharper.com/>
10. Vale — MIT; spelling via dicionário Hunspell em Go; suporte a Markdown.
    <https://vale.sh/> · <https://docs.vale.sh/checks/spelling>
11. textlint (MIT) — <https://textlint.github.io/>; retext —
    <https://github.com/retextjs/retext>; write-good (MIT) —
    <https://github.com/btford/write-good>; proselint (BSD-3-Clause) —
    <https://github.com/amperser/proselint>
12. Peter Norvig — *How to Write a Spelling Corrector*. <https://norvig.com/spell-correct.html>
13. Wolf Garbe — SymSpell (MIT); benchmarks e algoritmo de deletes simétricos.
    <https://github.com/wolfgarbe/SymSpell>
14. BK-tree — índice métrico (Burkhard & Keller, 1973).
    <https://en.wikipedia.org/wiki/BK-tree>
15. Schulz & Mihov (2002) — *Fast String Correction with Levenshtein Automata* (IJDAR 5(1)).
    <https://cis.uni-muenchen.de/otherpublications/conference_journal/02faststring.html> ·
    implementação de referência no Lucene:
    <https://lucene.apache.org/core/9_9_2/core/org/apache/lucene/util/automaton/LevenshteinAutomata.html>
16. SoundexBR (Daniel Marcelino, 2015) — fonética para português; GPL (≥ 2).
    <https://cran.r-project.org/web/packages/SoundexBR/> · metaphonebr (nomes):
    <https://cran.r-project.org/package=metaphonebr>
17. Gimenes, Roman & Carvalho (2015) — *Spelling Error Patterns in Brazilian Portuguese*,
    Computational Linguistics 41(1):175–183. <https://aclanthology.org/J15-1011/>
18. Implementação do corretor de Norvig em português (Redalyc) — inclui a referência de ~78%
    de acertos para corretores de palavra isolada (Kukich, 1992).
    <https://www.redalyc.org/journal/5771/577166257011>
19. Brants et al. (2007) — *Large Language Models in Machine Translation* (stupid backoff).
    <https://aclanthology.org/D07-1090/>
20. Chen & Goodman (1999) — *An empirical study of smoothing techniques for language
    modeling*; Kneser & Ney (1995). <https://www.sciencedirect.com/science/article/pii/S0885230899901286>
    · resumo didático (Jurafsky & Martin, SLP3, Apêndice C): <https://web.stanford.edu/~jurafsky/slp3/C.pdf>
21. KenLM (Kenneth Heafield) — LGPL-2.1; `lmplz` com modified Kneser-Ney; `mmap`.
    <https://kheafield.com/code/kenlm/> · <https://github.com/kpu/kenlm>
22. hermitdave/FrequencyWords — código MIT, conteúdo CC BY-SA 4.0 (base OpenSubtitles).
    <https://github.com/hermitdave/FrequencyWords>
23. Wikimedia dumps — licenças (texto CC BY-SA 4.0 + GFDL). <https://dumps.wikimedia.org/legal.html>
24. Project Gutenberg — licença e domínio público (EUA). <https://www.gutenberg.org/policy/license.html>
25. FineWeb-2 — ODC-By 1.0. <https://huggingface.co/datasets/HuggingFaceFW/fineweb-2>
26. GigaVerbo / Tucano (Polygl0t) — corpus PT e licenças ("other"; projeto Tucano Apache-2.0);
    fontes listadas no card. <https://huggingface.co/datasets/Polygl0t/gigaverbo-v2> ·
    <https://github.com/Nkluge-correa/Tucano/blob/main/cards/datasets/gigaverbo.md>
27. PeLLE (arXiv 2402.19204) — discussão de licenças de corpora PT (brWaC "research purposes
    only"). <https://arxiv.org/html/2402.19204v1>
28. Probi e comparação LanguageTool × CoGrOO (STIL 2023). Corpus de aceitabilidade com 11.625
    frases (2.616 agramaticais). <https://sol.sbc.org.br/index.php/stil/article/download/25481/25302>

---

*Documento de pesquisa — não descreve mudanças já implementadas. As fases F0–F4 são proposta;
cada uma entra no `CHANGELOG` e no `docs/historico-tecnico.md` própria quando (e se) for
implementada.*
