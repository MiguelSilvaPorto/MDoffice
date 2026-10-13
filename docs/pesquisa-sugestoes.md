# Sugestões, formalidade e ABNT — síntese e ordem de execução

> **Ponto de entrada** das duas pesquisas feitas para melhorar a assistência de escrita **sem IA**:
> [correção/sugestão offline](pesquisa-correcao-offline.md) e
> [formalidade e ABNT](pesquisa-formalidade-abnt.md). Aqui não há detalhe repetido: há o
> diagnóstico em uma página, a arquitetura alvo, **o que fazer primeiro** e como medir.

## 1. As três dores e o que as causa

| Dor | Causa técnica (segundo os dois levantamentos) |
| --- | --- |
| **"as sugestões ficam defasadas no começo"** | o corretor ranqueia candidatos **sem contexto** e decide por regras fixas; o aprendizado só olha **pares exatos de palavra** e só quando a pessoa **aceita**. O modelo de n-gramas (`public/ngrams/pt.json`: 30 mil palavras, ~141 mil trigramas) **já existe**, mas o worker do corretor usa só a lista de frequência |
| **"com o tempo era para corrigir sozinho, sem eu revisar"** | falta **decisão probabilística com margem** (vencedor × 2º colocado) e limiar que aprende; e o que deveria contar como recusa (Ctrl+Z, digitar por cima) **não alimenta** o aprendizado |
| **"frases formais" e "documento em ABNT"** | a base existe (tom formal/neutro/informal, 18 padrões informal→formal, 10 checagens tipográficas), mas quase tudo é por **palavra isolada** e **nenhuma** checagem por norma. E há um **falso positivo ativo**: a regra de citação cobra o formato da NBR **10520:2002**, substituída pela **10520:2023** |

Contexto do parque atual (para não redescobrir): dicionário Hunspell pt-BR com ~312 mil raízes;
candidatos por trigramas + Levenshtein; frequência fixa (`PESO_FREQUENCIA = 3.7`); aprendizado
pessoal em `personal/*`; previsão de palavras em `ghost/*`; tom em `tone.ts`; estilo em
`style/*`; revisão profunda em `deep/*`; IA local **opcional** (Gemma 3 270M) só reordenando.

## 2. Arquitetura alvo em cinco camadas

| Camada | Papel | Já existe | Falta |
| --- | --- | --- | --- |
| **L1 léxico** | a palavra existe? | typo-js + `pt_BR.dic/.aff` | usar os **afixos** para gerar flexões; dicionário pessoal automático |
| **L2 candidatos** | propor palavras parecidas com o erro | índice de trigramas + Levenshtein | índice de **deletes** (SymSpell), **confusões do português**, vizinhança de **teclado ABNT2** |
| **L3 contexto** | escolher entre candidatos parecidos | `ghost/*` (bigramas/trigramas) | **usar esse modelo no corretor** (hoje o worker não o consulta) |
| **L4 decisão** | aplicar sozinho ou só sugerir | limiares fixos em `autofix`/`spell.worker` | **posterior + margem**, limiar adaptativo, sinal negativo, classe de erro |
| **L5 estilo e norma** | formalidade e ABNT | tom, 18 padrões, 10 checagens tipográficas | catálogo por frase, métrica **MIP**, motor ABNT (41 regras), relatório e perfil `.docx` |

O princípio que atravessa as cinco: **separar detectar, gerar e decidir**. Detecção e geração
podem errar bastante desde que a decisão seja conservadora — é isso que hoje mistura as coisas e
faz o corretor parecer tímido no começo e instável depois.

## 3. Ordem recomendada (o que alivia a dor primeiro)

### Onda 1 — correções de rumo (esforço P, dias)

1. **Citação em Caixa Mista (NBR 10520:2023).** O app cobra `(SILVA, 2020)`; a norma vigente usa
   `(Silva, 2020)`. Aceitar as duas formas na transição e passar a sugerir a nova.
   *Por que primeiro:* é um **erro ativo** que briga com quem escreve certo — o falso positivo mais
   caro que existe (o app "corrige" para o formato antigo).
2. **Ligar os n-gramas no ranqueamento do corretor.** O modelo já está no repositório e hoje só
   serve a previsão de palavras; passar o recorte de contexto (bigramas/trigramas) para o worker é
   a melhor razão impacto/esforço para "acertar desde o começo".
3. **Sinal negativo e classe de erro no aprendizado.** Desfazer e digitar por cima contam como
   recusa; aprender a **classe** (letra vizinha, acento, transposição, dígrafo) em vez do par exato.
4. **Margem de confiança na hora de aplicar** (`p₁ ≥ τ` e `p₁ ≥ k·p₂`, com τ adaptativo à taxa de
   aceitação). Empate → **sugerir**, nunca aplicar; teto por parágrafo e um passo de Ctrl+Z por
   varredura (o app já faz parte disso).

### Onda 2 — motor melhor (esforço M)

5. **F0 da pesquisa de correção: medir antes de mexer.** Conjunto rotulado (30 casos existentes +
   erros sintéticos por classe + corpus real, se disponível) e painel de números
   (recall@1/@3, falsos positivos por 1000 palavras, aceitação, ms/palavra, memória).
   *Sem isso, as fases seguintes não têm como provar melhora.*
6. **F1: candidatos e ranking** — índice de deletes (SymSpell), confusões PT-BR, teclado ABNT2,
   formas geradas pelos afixos do Hunspell e escore com backoff (`log P_freq + λ·log P(w|contexto)`).
7. **F3: palavra real** — flexão e concordância (o que mais aparece em texto corrido).

### Onda 3 — formalidade (esforço P/M)

8. **Catálogo informal ampliado** (18 → ~50 padrões) com classes de segurança — o que **corrige
   sozinho** (contrações, internetês óbvio) e o que **só sugere** (quando mexe no sentido) — e o
   **MIP** (marcadores informais por 1000 palavras) no painel de revisão.
9. **Frase formal** — oralidade, atenuação, vagueza e redundância por janelas de frase, com prévia
   antes/depois, explicação do risco e um comando **"Formalizar seleção"**; o tom
   formal/neutro/informal continua mandando.

### Onda 4 — ABNT (esforço M/G)

10. **Motor ABNT no Markdown + relatório de conformidade** — 41 regras catalogadas (estrutura,
    numeração e sumário, resumo, citação ↔ referência, elementos essenciais por tipo de referência,
    legendas e fontes de figuras/tabelas), cada achado com trecho, severidade e correção, e as
    regras de "ressalva" (varia por instituição) separadas das de alta confiança.
11. **Perfil de exportação `.docx` + validador** — modo ABNT (A4, margens 3-2-3-2, fonte 12,
    entrelinha 1,5, citação longa com recuo de 4 cm) e releitura do ZIP gerado para conferir
    margens/fonte/espaçamento — inclusive em arquivos editados fora do app.

> Se o público for entregar `.docx` no Word, a onda 4 pode subir: o relatório do arquivo vale mais
> que o do Markdown.

## 4. Como saber se funcionou

| Área | Métricas (as metas numéricas estão nos documentos; calibra no F0) |
| --- | --- |
| Correção | recall@1/@3 no conjunto rotulado · **falsos positivos por 1000 palavras** · auto-aplicações desfeitas · ms/palavra (p95) · memória do worker |
| Aprendizado | taxa de aceitação ao longo do tempo · tempo até o τ estabilizar · termos técnicos recorrentes deixando de ser sinalizados |
| Formalidade | MIP antes/depois · falso positivo dos padrões "seguros" · nº de construções de frase cobertas |
| ABNT | regras ativas · precisão das regras de alta confiança · documento de 50 mil palavras em < 2 s · divergência zero entre perfil e `.docx` gerado |

## 5. Limites (o que continua sendo sugestão, por honestidade)

Reescrita semântica, coerência global do texto, fidelidade de uma citação à fonte e tudo o que
**varia por instituição** (capa, ficha catalográfica, folha de aprovação). Nada disso deve ser
"corrigido" em silêncio: entra como sugestão explícita ou como item "não verificável" no relatório.

## 6. Para ler em detalhe

- [**pesquisa-correcao-offline.md**](pesquisa-correcao-offline.md) — diagnóstico por arquivo e
  função, estado da arte sem IA (SymSpell, autômatos de Levenshtein, confusões PT-BR, fonética BR,
  n-gramas e corpora), decisão probabilística passo a passo e plano F0–F4.
- [**pesquisa-formalidade-abnt.md**](pesquisa-formalidade-abnt.md) — catálogo informal→formal e de
  frase, o que é verificável por NBR (14724, 10520, 6023, 6027, 6024, 6028, 15287), catálogo de
  41 regras com exemplos, ferramentas de apoio e plano F0–F3.
