# Medição do corretor — linha de base do F0

> Números medidos **antes** de mexer no algoritmo, para servir de régua às fases seguintes
> (F1 candidatos/ranking, F2 decisão, F3 morfologia, F4 auto-cura). O desenho da fase está em
> [pesquisa-correcao-offline.md](pesquisa-correcao-offline.md) (§4 e §5, "F0 — Medir antes de mexer").
>
> **Commit medido:** `120cc9e` (main) · **Data:** 2026-10-14 · **Semente:** 20261014 ·
> **Ambiente:** Windows, Node v24.21.0 · **Modelo de idioma:** ligado (`public/ngrams/pt.json`),
> como o app liga na abertura.

## Como rodar

```powershell
node scripts/avaliar-correcao.mts                        # tabela legível no console
node scripts/avaliar-correcao.mts --json                 # JSON no stdout (para comparar versões)
node scripts/avaliar-correcao.mts --json=medida.json     # tabela + JSON em arquivo
node scripts/avaliar-correcao.mts --classe=x_ch --detalhe
node scripts/avaliar-correcao.mts --por-classe=50 --paragrafos=200 --seed=7
```

Roda em ~20 s, **não altera o comportamento do corretor** (mesmo `checkText` do editor, com o
dicionário real no shim de worker) e **sempre sai com código 0** — é medição, não teste.

| Opção | Padrão | O que faz |
| --- | --- | --- |
| `--json[=arquivo]` | — | JSON com todos os números (sem arquivo, imprime só o JSON) |
| `--classe=xx` | todas | filtra uma classe (`acento`, `cedilha`, `ss_s`, `x_ch`, `g_j`, `transposicao`, `letra_mais`, `letra_menos`, `tecla_vizinha`) |
| `--por-classe=N` | 30 | erros sintéticos por classe (0 desliga o conjunto) |
| `--paragrafos=N` | 120 | parágrafos de `docs/*.md` usados como base do conjunto sintético (documentos de medição — `docs/medicao-*.md` — ficam fora: são instrumento, não corpus) |
| `--seed=N` | 20261014 | semente do gerador (mesma semente = mesmos casos) |
| `--piores=N` | 5 | quantos piores casos listar em cada lista |
| `--detalhe` | — | lista caso a caso |
| `--sem-modelo` | — | desliga o modelo de idioma (mede só o caminho do dicionário) |

## Conjuntos e colunas

**Conjuntos.** (a) **real** — cada par palavra errada → gabarito extraído de
`test/docs/gramatical.md` (é a regressão: o "Esperado" é o gabarito; 25 pares de palavra em
34 casos — os casos de pontuação/registro/espaçamento não geram par de palavra). (b) **sintético** —
30 erros por classe, injetados em 116 parágrafos limpos de `docs/*.md` + `README.md`; o texto
original é o gabarito. (c) **corretos** — os 34 "Esperado" do corpus, usados só para falso
positivo. Não há corpus real de erro no repositório (o do estudo Gimenes et al. não está aqui);
fica registrado como lacuna para o F1.

**Reprodutibilidade.** Mesma semente = mesmos casos, na mesma árvore de `docs/*.md`: rode duas
vezes e os números (fora o tempo) saem idênticos. O gerador é **por classe**, então
`--classe=xx` mostra exatamente os mesmos casos daquela classe na tabela cheia (numa execução
filtrada os falsos positivos saem de uma amostra menor — só os parágrafos que aquela classe
tocou). Os parágrafos vêm dos docs **do commit medido** — mexeu na prosa dos docs, muda o
conjunto (o console e o JSON imprimem quantos parágrafos e quantas palavras entraram, então a
diferença aparece na hora).

**Colunas.** `n` casos · `det%` o corretor acusou o erro · `r@1`/`r@3` o gabarito está na 1ª / nas
3 primeiras sugestões (caso não detectado conta como erro) · `prec1` entre os que têm sugestão,
quantos acertam na 1ª · `auto%` quantos vêm com `auto` (o corretor aplicaria sozinho) ·
`auto✓%` desses, quantos são o gabarito · `visível` a forma escrita não é palavra do dicionário
(sem isso o corretor de ortografia não tem como ver o erro — é matéria do F3) · `r@3†` o
recall@3 só entre os visíveis.

**Falsos positivos.** Medidos em 3.998 palavras: os 34 "Esperado" conferidos à mão e os 116
parágrafos com 1 erro injetado, contando uma vez por parágrafo e **fora** do erro injetado (o
parágrafo estava limpo antes). Palavra desconhecida que já era acusada antes da corrupção
(termo técnico) fica fora da conta — entra numa linha à parte.

## Números do baseline (commit `120cc9e`)

**Payload que o worker carrega: 7,5 MB** — `pt_BR.dic` 4,3 MB · `ctx-pt.json` 1,9 MB ·
`pt_BR.aff` 0,9 MB · `freq-pt.json` 0,4 MB. Fora do worker, o modelo de idioma do reordenamento
carrega `pt.json` (6,9 MB) no thread principal. *(RSS do worker não é medível no harness — fica
para o app/DevTools.)*

### Por conjunto

| conjunto | n | det% | r@1 | r@3 | prec1 | auto% | auto✓% | visível | r@3† |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| real (gramatical.md) | 25 | 100% | 96% | 96% | 100% | 76% | 100% | 100% | 96% |
| sintético (9 classes) | 270 | 97% | 74% | 84% | 80% | 76% | 88% | 96% | 87% |
| **total** | **295** | **97%** | **76%** | **85%** | **81%** | **76%** | **89%** | **97%** | **88%** |

### Por classe (sintético + real)

| classe | n | det% | r@1 | r@3 | prec1 | auto% | auto✓% | auto≠gab | visível | r@3† |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| acento | 40 | 95% | 93% | 95% | 97% | 68% | 100% | 0 | 95% | 100% |
| letra a menos | 35 | 89% | 60% | 71% | 78% | 57% | 90% | 2 | 86% | 80% |
| transposição | 32 | 97% | 63% | 84% | 65% | 81% | 73% | 7 | 97% | 87% |
| c↔ç | 30 | 97% | 93% | 97% | 97% | 93% | 100% | 0 | 97% | 100% |
| s↔ss | 30 | 100% | 83% | 87% | 89% | 83% | 96% | 1 | 100% | 87% |
| x↔ch | 30 | 97% | 33% | 47% | 40% | 57% | 41% | 10 | 97% | 48% |
| g↔j | 30 | 100% | 93% | 93% | 93% | 90% | 96% | 1 | 100% | 93% |
| letra a mais | 30 | 100% | 77% | 93% | 82% | 83% | 92% | 2 | 100% | 93% |
| tecla vizinha | 30 | 100% | 77% | 93% | 77% | 73% | 95% | 1 | 100% | 93% |
| letra trocada | 5 | 100% | 100% | 100% | 100% | 100% | 100% | 0 | 100% | 100% |
| outra | 3 | 100% | 100% | 100% | 100% | 100% | 100% | 0 | 100% | 100% |
| **TOTAL** | **295** | **97%** | **76%** | **85%** | **81%** | **76%** | **89%** | **24** | **97%** | **88%** |

### Falsos positivos, auto-aplicação e tempo

- **Falsos positivos: 3,25 por 1000 palavras** (13 em 3.998). **Todos** vêm do "você quis
  dizer…" (`neighbor.ts`) sobre palavra que existe — "paridade"→caridade, "Pause"→passe,
  "parse"→passe, "rasas"→casas, "acento"→aceito. Pelo caminho da ortografia (palavra
  desconhecida): **zero** em textos corretos (0 em 291 palavras) e zero fora do erro injetado.
- **Auto-aplicação: 225 de 295 (76%)**; o `best` coincide com o gabarito em **201 de 225 (89%)** —
  ou seja, **24 auto-aplicações trocariam a palavra ERRADA** (8,1% dos erros; 10,7% das
  auto-aplicações). Por classe: x↔ch 10, transposição 7, letra a mais 2, letra a menos 2,
  s↔ss 1, g↔j 1, tecla vizinha 1, acento 0, c↔ç 0.
- **Tempo: p50 0,056 ms/palavra · p95 0,152 ms/palavra** (535 textos, pipeline completo:
  estilo + dicionário + reordenamento). No worker, em lote de 960 palavras, 0,015 ms/palavra.
  *Medido no harness (mesmo processo); no app há o custo de mensagem do worker. Varia ~10%
  entre execuções.*

## Os piores casos

**Erro invisível / auto-aplicado errado / fora do 1º lugar:**

1. **real · letra a menos · `pra` → `para`** — "Vou mandar o arquivo **pra** você ainda hoje."
   *Detectado, mas sem sugestão nenhuma* (`suggestions: []`): o corretor marca e não ajuda.
2. **sintético · acento · `fieis` → `fiéis`** — "Apresentações com **abertura e gravação fieis**
   de `.pptx`…" *Não detectado*: "fieis" é forma aceita pelo dicionário (o `acentoMaisUsado`
   não alcança: a escrita precisa ser rara e a acentuada 20× mais usada).
3. **sintético · c↔ç · `troçar` → `trocar`** — "…trocar “c” por “ç” não pesa diferente de
   **troçar** qualquer letra…" *Não detectado*: "troçar" é verbo real.
4. **sintético · transposição · `apinéis` → `painéis`** — "…na reconstrução dos **apinéis**,
   diálogos, menus contextuais…" *Não detectado*: o dicionário tem a forma (flexão de apinelar).
5. **sintético · x↔ch · `fichas` → `fixas`** — "…o menu de porcentagens **fichas** e um
   “Ajustar à janela”…" *Não detectado*: "fichas" é palavra comum — o erro virou erro de
   palavra real.

**Piores de RANKING** (o gabarito está na lista, mas não em 1º lugar — o alvo direto do F1):

| escrito | gabarito | 1ª sugestão (e `auto`) |
| --- | --- | --- |
| `vaalem` | valem | "vá além" (auto errado) |
| `variaa` | varia | "várias" (auto errado) |
| `jnela` | janela | "pela" (auto errado) |
| `entea` | entra | "enteá" (auto errado) |
| `recrira` | recriar | "receita" (auto errado) |

Outros `auto` errados do conjunto sintético: `prinçípio`→"principio" (era "princípio"),
`mantem`→"mantém" (era "mantêm"), `fexar`→"fixar" (era "fechar"), `xecar`→"secar" (era
"checar"), `caicha`→"cai chá" (era "caixa"), `expliçadas`→"explicada" (era "explicadas").

## Leitura: onde o corretor erra mais e o que isso sugere para o F1

1. **A detecção é boa (97%); o ranking é o gargalo (r@1 76%, r@3 85%).** Quando a forma errada
   não é palavra do dicionário, "detectado" quase sempre acontece; o que falha é *qual* palavra
   aparece primeiro — exatamente o que o F1 ataca (candidatos por deletes + peso por classe de
   erro + contexto no escore). No conjunto real da regressão, 24 dos 25 pares já estão em 1º
   lugar: aqui o espaço é para não piorar.
2. **x↔ch é o pior de longe** (r@1 33%, r@3 47%, `auto✓` 41%, 10 das 24 auto-aplicações erradas):
   trocar "ch"↔"x" muda a palavra de tamanho, o índice de trigramas erra o alvo e o ranking
   escolhe vizinhos frequentes ("fichas"→"fixas" já existe no dicionário; `xecar`→"secar",
   `fexar`→"fixar"). As tabelas de confusão PT e o peso por classe (§3.2 da pesquisa) são o
   remédio direto — e o ganho tende a ser o maior de todo o F1.
3. **Transposição tem o pior casamento entre auto e acerto** (81% de auto, só 73% de acerto):
   o erro "de dedo" é bem detectado (97%), mas o desempate por frequência genérica perde para
   palavras comuns parecidas — e o `auto` aplica a errada em 7 casos. Peso de edição por classe
   (transposição vale mais que troca arbitrária) e vizinhança ABNT2 são o alvo.
4. **Letra a menos é o caso mais frágil** (r@1 60%, `auto✓` 90%, `r@3†` 80%): faltar uma letra
   frequentemente produz outra palavra válida ou um corte de palavra grudada (`jnela`→"pela",
   `caicha`→"cai chá"). Mesmo entre os erros visíveis, um quinto não chega ao top-3.
5. **10,7% das auto-aplicações estão erradas hoje** — a meta do F2 é ≥ 99% de acerto. O F0 diz
   que **não basta decidir melhor entre os candidatos existentes**: é preciso que o candidato
   certo esteja no topo (F1) e que a decisão só aplique com margem de verdade (F2). Os 24 casos
   de `auto ≠ gabarito` são o conjunto de teste natural de "nunca aplicar" (o JSON os lista em
   `autoErrados`).
6. **Os erros invisíveis (10 dos 270 sintéticos, 4%) têm nome**: a forma escrita
   continua sendo palavra aceita pelo dicionário ("fieis", "troçar", "apinéis", "fichas",
   "laminas", "explicito"). É a matéria do F3 (morfologia/contexto), mas o acento é o mais
   barato de atacar já no F1: os limiares do `acentoMaisUsado` (20/20/50) deixam passar demais.
7. **Falso positivo pelo caminho da ortografia: zero.** O ruído que existe (3,25/1000) é do
   `neighbor.ts` sobre palavra existente — e quase sempre em cima de termo técnico do próprio
   repositório ("parse", "Pause", "paridade"). O critério de bloqueio do F1 é **não piorar
   FP/1000**: mexer no `neighbor` (ou no viés das listas de legenda) tende a ser o ganho de
   qualidade percebida mais direto depois do ranking.
8. **Custo não é problema hoje**: p95 0,152 ms/palavra no pipeline e payload de 7,5 MB. Qualquer
   proposta do F1 (índice de deletes, tabelas de confusão, contexto no escore) tem folga de
   latência; o que vigiar é o **payload** — `ctx-pt.json` (1,9 MB) já é o segundo maior arquivo
   do worker, e as tabelas de confusão são dezenas de KB, o que é barato.
9. **Lacunas da medição** (registradas para as próximas fases): corpus real de erro (Gimenes et
   al.) não está no repositório; RSS do worker não é medível no harness; a "taxa de aceitação do
   usuário" depende de telemetria no app (§4.4 da pesquisa) e não tem proxy offline; a medição
   não aplica as correções (não mede "auto-aplicações desfeitas" — o harness só sabe o que o
   `best` faria).

---

## Medição pós-rebase (informativa)

No fechamento desta tarefa a `main` já tinha avançado com o corretor **com confusões do português
e teclado ABNT2** (`760095e`, de outra tarefa) e com as regras ABNT em TOML (`edf5d6c`). A mesma
medição rodou no commit do rebase — **`cdd1c84`** — só para conferir que o harness funciona com o
código novo e para registrar o efeito colateral. **Isto não é a medição do F1** (cada fase registra
a sua); é a fotografia do mesmo conjunto rotulado em dois commits.

| métrica | `120cc9e` (linha de base) | `cdd1c84` (pós-rebase) |
| --- | ---: | ---: |
| r@1 total | 76% | **80%** |
| r@3 total | 85% | **89%** |
| precisão do 1º lugar | 81% | **84%** |
| auto% | 76% | **82%** |
| acerto do `best` | 89% | **91%** |
| `auto ≠ gabarito` | 24 | 23 |
| falsos positivos / 1000 palavras | 3,25 | 3,25 |
| x↔ch r@1 / r@3 | 33% / 47% | **67% / 77%** |
| tecla vizinha r@1 | 77% | **87%** |
| p50 / p95 ms por palavra | 0,056 / 0,152 | **0,185 / 0,998** |
| worker em lote (960 palavras) | 0,015 | **0,154** |
| payload do worker | 7,5 MB | 7,5 MB |

Leitura curta: o trabalho de confusões/teclado **ataca exatamente o que o F0 apontou** — x↔ch
dobrou o recall@1 e a tecla vizinha subiu 10 p.p. — e não mexeu em falsos positivos (3,25/1000,
igual). O preço apareceu na **latência: ficou ~6,5× mais lento no p95** (0,998 ms/palavra) e 10×
no lote, ainda dentro da meta de ≤ 2 ms/palavra que a pesquisa estimou para o F1, mas agora é um
número a vigiar. Dois pontos oscilaram para baixo: `s↔ss` (r@1 83%→77%, precisão do 1º lugar
89%→82%) e `letra a mais` (precisão 82%→77%) — como o conjunto é o mesmo nos dois commits, a
diferença é do corretor, não da amostra.

Enquanto isso, a lição de método: um `.toml?raw` novo em `src/broker/abnt/` **quebra qualquer
bundle esbuild sem plugin** — o `scripts/testar-correcoes.mts` já ganhou o dele, e este harness
tem o próprio (seção "empacotamento"); quem escrever outro harness precisa do mesmo.

### Terceira medição — `neighbor` sem falso positivo

O F0 apontou que **todos** os falsos positivos vinham do "você quis dizer" (`neighbor.ts`) sobre
palavra real, e a correção foi exigir que a diferença seja **erro de digitação típico** (inversão,
tecla vizinha, confusão do português, "h" mudo ou dobra) — ver o histórico técnico. Mesmo conjunto,
commit da medição logo após a mudança:

| métrica | `cdd1c84` | `neighbor` corrigido |
| --- | ---: | ---: |
| r@1 total | 80% | 78% |
| r@3 total | 89% | **86%** |
| precisão do 1º lugar | 84% | 83% |
| auto% | 82% | 80% |
| acerto do `best` | 91% | **92%** |
| `auto ≠ gabarito` | 23 | **19** |
| **falsos positivos / 1000 palavras** | **3,25** | **0,00** |
| p50 / p95 ms por palavra | 0,185 / 0,998 | 0,182 / 1,026 |

Leitura curta: o ruído **zerou** (0 em 4.275 palavras) e as auto-aplicações erradas caíram de 23
para 19; em troca, o recall cedeu ~2 p.p. no conjunto sintético — parte dele era justamente o
"vizinho" acertando por sorte em cima de troca sem classe. O corpus de regressão segue **34/34 e
34/34**. O alvo do F1 que fica na mesa é o **ranking das classes "letra a menos" e "letra a mais"**
(`mdia`→"dia", `fecar`→"ficar", `lissta`→"está"): o gabarito está na lista, mas não em 1º.

### Quarta medição — ranking das letras faltando/sobrando

O ranking ganhou **teto de frequência** e **bônus de prefixo** (ver histórico técnico): a palavra
muito comum deixou de decidir sozinha contra uma edição melhor. Mesmo conjunto:

| métrica | `neighbor` corrigido | ranking das letras |
| --- | ---: | ---: |
| r@1 total | 78% | **82%** |
| r@3 total | 86% | 86% |
| precisão do 1º lugar | 83% | **87%** |
| auto% | 80% | 81% |
| acerto do `best` | 92% | **95%** |
| `auto ≠ gabarito` | 19 | **13** |
| falsos positivos / 1000 palavras | 0,00 | 0,00 |
| p50 / p95 ms por palavra | 0,182 / 1,026 | 0,175 / 1,084 |

Leitura curta: as três classes do alvo andaram — "letra a mais" r@1 **87%**, "letra a menos" r@1
66% (era 60%) — e a **precisão do 1º lugar subiu 4 p.p.**, com as auto-aplicações erradas caindo de
19 para 13. O que sobrou de ruim é de outra natureza: casos **ambíguos ou invisíveis** ("slva" →
"silva" em vez de "salva"; "media" → "média"; "xama" → "chama" — a forma escrita é palavra do
dicionário). Esses pedem **contexto/uso** (F3/F4), não mais edição: é a próxima fronteira.

### Quinta medição — o contexto decide a palavra que existe

O F3 entrou: quando a escrita é palavra real mas não combina com a frase, o app pergunta por
contexto (`spell/uso.ts`), comparando a leitura escrita com as trocas de classe no modelo de
n-gramas. Mesmo conjunto:

| métrica | ranking das letras | contexto decide |
| --- | ---: | ---: |
| r@1 total | 82% | **83%** |
| r@3 total | 86% | **87%** |
| precisão do 1º lugar | 87% | 87% |
| auto% | 81% | 81% |
| acerto do `best` | 95% | 95% |
| falsos positivos / 1000 palavras | 0,00 | **0,00** |
| p50 / p95 ms por palavra | 0,175 / 1,084 | 0,178 / 0,918 |

Leitura curta: o ganho é pequeno em pontos (1 p.p. em cada recall) mas de **natureza nova** — pela
primeira vez o app acusa uma palavra que existe ("o maior ganho **resta** aba" → "desta"), o que
antes era impossível sem IA. E o ruído **continuou zero**, que era o risco da mudança. O que segue
fora de alcance: casos em que a palavra de contexto **não está no vocabulário** do modelo (o
"media" do conjunto sintético vem depois de "severidade", palavra que o corpus de 30 mil não tem),
e os ambíguos de verdade ("slva" → "salva" ou "silva"). Ambos precisariam de um contexto mais largo
(as duas palavras anteriores) ou de vocabulário maior — matéria do F4.

### Sexta medição — o F4: o contexto paga o próprio custo?

O F4 estava para entrar como "contexto dos dois lados com trigramas". Antes de mexer na régua, a
própria medição foi montada: o `--json` do harness passou a levar a lista `medidas` (caso a caso),
e duas rodadas — **com** e **sem** o modelo de idioma — foram comparadas por índice.

| rodada | r@1 | r@3 | precisão do 1º | auto% | auto✓% | FP/1000 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| sem o modelo (só dicionário) | **85%** | 88% | 91% | 83% | 94% | 0,00 |
| com o modelo, régua antiga | 84% ✗ | 88% | 91% | 82% | 95% | 0,00 |
| com o modelo, régua nova | **85%** | 88% | 91% | 83% | 94% | 0,00 |

Leitura curta: a camada de contexto estava **tirando** um ponto de r@1. Caso a caso, os dois
culpados: “messmo” → “**mesh**” (contexto 0,034 contra 0,003 — uma evidência fraca que passava no
piso 0,03 porque o **bônus de classe** chegava junto) e “revissão” → “**previsão**” (0,103 contra
0,042 — 2,4×, e o antigo exigia só 2×). Régua nova: a promoção é do **contexto** (piso 0,06 e no
mínimo 3× o contexto do 1º + 0,02), e o bônus de classe/uso só escolhe entre candidatas que o
contexto já sustenta.

**A varredura que decidiu:** 8 pisos × 5 fatores × 4 margens (160 configurações), simuladas sobre a
evidência real de 54 casos do conjunto — **nenhuma** dá ganho líquido positivo; as que promovem
alguma coisa, promovem errado ou dão em empate. Conclusão honesta: nesse corpus (30 mil palavras,
top-12 sucessoras por linha) o contexto **não** é promotor confiável — o trigrama ajuda a **escolher**
a forma de quem já errou, mas não a **acusar** quem escreveu certo. Por isso a régua ficou
conservadora: fica pronta para promover quando o contexto for decisivo de verdade, e hoje não
atrapalha. O caso “media” → “média” segue fora de alcance **por desenho** (a razão pelo lado
direito é 0,15 — o modelo não sustenta a troca), e é o tipo de caso em que acusar seria chute.

---

*Números do commit `120cc9e`. Se um rebase trouxer mudanças ao corretor, esta linha de base
continua valendo para o que foi medido — o harness roda de novo no commit novo e a tabela
resultante vira a comparação (o JSON guarda commit, data e semente).*
