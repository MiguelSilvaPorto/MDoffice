# Pesquisa: formalidade por regras e validação ABNT no mdOffice

**Tipo:** documento de pesquisa (não altera código).
**Data:** 13 out. 2026.
**Perguntas que o documento responde:**

1. Como deixar qualquer frase formal **sem IA**, com regras que explicam cada troca?
2. O que das normas ABNT de uso real dá para **verificar automaticamente** num trabalho acadêmico, com relatório?

**Escopo:** formalidade por regras (objetivo 1) e conformidade ABNT (objetivo 2) no mdOffice, com
diagnóstico do que já existe (`src/broker/`), catálogo de regras, análise do Markdown e do `.docx`
exportado, ferramentas de apoio e plano por fases. As versões das normas foram conferidas nas
fontes listadas na seção 9 (acesso em 13 out. 2026).

---

## 1. Resumo executivo

1. O mdOffice já tem um corretor 100% offline (`src/broker/`) com tom **formal/neutro/informal**, 18 padrões de informal, regras de pontuação/estilo e um painel de revisão — é a base certa para os dois objetivos.
2. O que falta para o objetivo 1 é **cobertura e contexto**: internetês, muletas, oralidade, atenuação, redundâncias, clichês e vagueza não estão no catálogo, e quase tudo é tratado por palavra isolada, não por frase.
3. Dá para deixar uma frase formal por regras porque a formalidade tem **marcadores observáveis** (contrações, gírias, gírias de internet, vícios de oralidade, impessoalidade) — e o corretor pode separar o que **corrige sozinho** do que **só sugere** (quando a troca mexe no sentido).
4. O objetivo 2 hoje é praticamente inexistente: `style/abnt.ts` cobre **10 checagens tipográficas** (horas, unidades, meses, sigla no plural, "et al.", páginas, travessão, latim) e **nenhuma** checagem de estrutura, referências ou citações por norma.
5. Achado importante: a regra `abntCitation` (sobrenome em CAIXA ALTA entre parênteses) segue a **NBR 10520:2002**, que foi substituída pela **NBR 10520:2023** — a atual pede letras maiúsculas e minúsculas no sistema autor-data.
6. As normas vigentes mudaram bastante entre 2023 e 2025: NBR 14724:2024 (trabalhos), NBR 10520:2023 (citações), NBR 6023:2025 (referências), NBR 6028:2021 (resumo), NBR 15287:2025 (projeto); NBR 6027:2012 e NBR 6024:2012 seguem em vigor.
7. O verificável de verdade (alta confiança, sem IA) é: presença/ordem de elementos do trabalho, numeração e sumário coerentes com os títulos, contagem de palavras do resumo, formato e cruzamento citação↔referência, elementos essenciais por tipo de referência, legendas/fontes em figuras e tabelas — e, no `.docx`, margens/fonte/espaçamento/recuos.
8. O que não dá para verificar sem gente é o que exige **leitura**: coerência do conteúdo, fidelidade das citações à fonte, qualidade do referencial e decisões que variam por instituição (capa da instituição, ficha catalográfica, formatação de folha de aprovação).
9. O mdOffice está bem posicionado: o Markdown dá estrutura (títulos, listas, tabelas, `>` para citação), o export `.docx` já é gerado no próprio código (`src/md/docx.ts`, com JSZip já instalado para reler o ZIP) e o painel de revisão pode ganhar uma aba/modal de **relatório de conformidade**.
10. Plano sugerido em 4 fases: **F0** formalidade por regras (P), **F1** frase formal + métrica (M), **F2** motor ABNT no Markdown com relatório (M/G) e **F3** validação do `.docx` exportado + perfil ABNT de exportação (M) — com métrica de regras cobertas, falso-positivo em documentos reais e tempo de análise.

---

## 2. Diagnóstico

### 2.1 O que o mdOffice tem hoje

**Formalidade e estilo (frontend `src/broker/`):**

| Peça | O que faz | Limite atual |
| --- | --- | --- |
| `data/informal.ts` | 18 padrões informal → formal ("pra→para", "pro→para o", "tá→está", "né", "um monte de→muitos", "bem legal", "tipo assim→por exemplo", "acho que", "e tal", "daí", "no final das contas", "por causa disso", "coisa", "baita", "muito massa", "app(s)") | Vocabulário curto; nada de internetês ("vc", "tbm", "qdo"), redundâncias, clichês ou reescrita de frase |
| `tone.ts` + `style/register.ts` | Tom **formal / neutro / informal** decide o que aparece; "formal" também resolve "a gente + verbo" → "nós + verbo" conjugado (`data/aGente.ts`) | "a gente" só troca o sujeito; não oferece a alternativa impessoal; tom "neutro" depende de `fix` na regra |
| `style/punctuation.ts` | Vírgulas (expressões, adversativas, introdutórias), quebra de frase longa, ponto final | — |
| `style/spacing.ts` | Espaços duplos, espaço antes/depois de pontuação, abreviações coladas, palavras repetidas | — |
| `style/capitalization.ts` | Maiúscula depois de ponto e no começo de parágrafo | — |
| `style/limpeza.ts`, `style/phrases.ts`, `style/personal.ts` | Pontuação duplicada, frases coladas, expressões, frase longa | — |
| `style/concordancia.ts` | "fazem dois anos" → "faz dois anos" (impessoal) | — |
| `style/abnt.ts` | 10 checagens **tipográficas**: "14hs→14h", "14:30hs→14h30", espaço entre número e unidade, meses minúsculos, plural de sigla sem apóstrofo, citação autor-data (maiúsculas — ver 2.3), "pág.→p.", "et al.", "--→travessão", latim em itálico | Não valida **nenhuma norma**: nem estrutura, nem referências, nem citações |
| `deep/*` | Análise profunda: repetições, morfologia, thesaurus, propostas com confiança e motivo (usa modelo local de linguagem como apoio) | É sobre repetição/estilo, não sobre formalidade; depende do modelo local |
| `review.ts` + `stats.ts` | Painel de revisão com estatísticas (palavras, frases, frases longas, repetidas) e correções | Não há métrica de formalidade nem relatório de conformidade |
| `mask.ts` | Máscara de código/links/HTML: regras só agem na prosa | Reaproveitável para o motor ABNT |

**Exportação (`src/md/docx.ts`):** gera `.docx` com a biblioteca `docx` a partir do Markdown
(títulos, listas, tabelas, código, imagens, citações em `>` e diagramas). Fatos do arquivo:

- fonte padrão **Calibri 11 pt** (estilo do documento, `size: 22`; títulos de 20/16/14/12 pt);
- A4 ou Letter, **margens de 2 cm nos quatro lados** (`margin: 1134` twips);
- corpo com `spacing: { after: 140, line: 300 }` (≈ **1,25** de entrelinha) e `after` de 7 pt;
- citação (`blockquote`) vira parágrafo **itálico**, com recuo esquerdo de **360 twips (0,63 cm)** e barra lateral — nada disso é o padrão de citação longa da ABNT;
- **sem numeração de páginas**, sem capa, folha de rosto, sumário automático ou ficha catalográfica;
- `jszip` já é dependência do projeto (dá para abrir o `.docx` gerado e ler o XML).

**Configurações:** a aba **Escrita** já oferece o tom (Formal/Neutro/Informal) com a descrição "aponta linguagem informal (…), bom para trabalhos, relatórios e e-mails profissionais" — é onde as novas opções dos dois objetivos caberiam naturalmente.

### 2.2 Objetivo 1 — "deixar qualquer frase formal" (o que falta)

1. **Catálogo maior e classificado por tipo**: internetês, muletas de fala, oralidade/impessoalidade, atenuação ("acho que"), redundâncias/pleonasmos, clichês e vagueza (seção 3.2).
2. **Ação por frase/seleção**: hoje as regras varrem o texto todo; falta "formalizar este trecho" com prévia do antes/depois, como um "Corrigir tudo" recortado.
3. **Política de segurança explícita**: o que entra sozinho (pra→para), o que entra com confirmação (tipo assim→por exemplo) e o que **nunca** entra sozinho (a gente→nós/impessoal, coisa→elemento), com o risco de sentido descrito (seção 3.4).
4. **Métrica de formalidade**: um número simples e explicável (marcadores informais por 1.000 palavras, antes/depois) para a pessoa ver o efeito (seção 3.5).
5. **Cobertura de língua falada → escrita**: sujeito de 1ª/2ª pessoa, "a gente", nominalizações, "dá pra ver que" → "observa-se que" — construções que exigem janela de contexto, não só regex de palavra.
6. **Sem IA**: tudo isso é possível com listas de padrões, contexto local (janela de ±N palavras) e regras estruturais — o modelo local (`deep/`) entra só como apoio opcional, nunca como requisito.

### 2.3 Objetivo 2 — "verificar ABNT com relatório" (o que falta)

- **Nada de estrutura**: o app não sabe o que é capa, folha de rosto, resumo, sumário, introdução, referências — nem no Markdown nem no `.docx`.
- **Nada de referências**: não há leitura da lista de referências, por tipo (livro, capítulo, artigo, site, lei, tese, evento, patente), nem das regras da NBR 6023.
- **Nada de citações no texto**: não há detecção de citação direta/indireta, "apud", página em citação direta, nem **cruzamento com a lista de referências** (a citação existe? a referência citada existe?).
- **Checagens tipográficas que precisam de revisão**: `abntCitation` aplica a regra antiga (CAIXA ALTA); `abntEtAl`, `abntPage` e `abntLatin` são atuais; falta o itálico de "In", "et al.", "[S.l.]" e a punição de pontuação da 10520:2023 (ponto final depois do parêntese).
- **Sem relatório**: o painel de revisão é uma lista de avisos — não há visão "norma por norma" (ok / violada / não verificável), com trecho, severidade e como corrigir.
- **Export sem perfil ABNT**: o `.docx` sai com Calibri 11 e margens simétricas; nenhuma opção aplica margens 3-2-3-2, Arial/Times 12, entrelinha 1,5 nem paginação.

---

## 3. Formalidade por regras

### 3.1 Princípios (sem IA)

1. **Só prosa**: reusar a máscara (`maskNonProse`) — nada de agir dentro de código, link, HTML.
2. **Regra que explica**: toda sugestão diz o que era, o que fica e por quê (padrão que o `WritingIssue` já segue: `message`, `fix`, `suggestions`, `safe`).
3. **Determinismo**: mesmo texto, mesmo resultado; sem modelo, sem rede, sem cronômetro.
4. **Precisão antes de cobertura**: melhor não avisar do que avisar errado (risco de o usuário perder a confiança).
5. **Segurança explícita**: `safe` (entra sozinho), sugestão (entra com clique) e **não mexe** (só informa) — decididos por classe de regra, não por frase.
6. **Tom**: formal/neutro/informal continua mandando (nele vive a política do que aparece); "informal" não recebe nada de registro.
7. **Unidades de leitura**: regras de palavra (lista), regras de janela (contexto de N palavras) e regras de frase (estrutura sujeito-verbo, impessoalidade).

### 3.2 Catálogo de transformações (com exemplos)

Legenda de ação sugerida: **A** = pode corrigir sozinho (`safe`); **S** = só sugerir (depende de sentido/contexto).

#### 3.2.1 Gírias, internetês e contrações

| # | Informal | Formal | Ação | Observação |
| --- | --- | --- | --- | --- |
| 1 | pra | para | A | Já existe; cobrir também "pra o/pra a" escritos por engano não é necessário — a contração certa é "para o/para a" |
| 2 | pro / pros / pra gente | para o / para os / para nós | A | "pra gente" → "para nós" (não "para a gente") |
| 3 | tá / tô / tava / tô indo | está / estou / estava | A | Só fora de citações e nomes |
| 4 | cê / vc / vcs / você | você / vocês | A/S | "vc" é sempre informal; "você" em trabalho acadêmico → preferir impessoal (3.2.3) |
| 5 | tbm / tb / qdo / qto / pq / qm / msm / hj / q / d+ | também / quando / quanto / porque / quem / mesmo / hoje / que | A | Internetês puro; mapear "pq" → "porque" (não "por que"), com sugestão |
| 6 | bagulho / troço / parada | objeto / elemento / assunto | S | Gíria de alta ambiguidade: só sugerir |
| 7 | cara / mano / véi (vocativo) | (remover) | S | Vocativo informal; remoção depende da frase |
| 8 | top / show / massa / da hora | excelente / interessante | S | "muito massa" já está no catálogo |
| 9 | baixar app / apps | instalar aplicativo / aplicativos | A | Já existe "app→aplicativo" |
| 10 | tipo / tipo assim | por exemplo / como | S | "tipo" também é tipo de dado: exigir contexto ("tipo assim", "tipo,") |
| 11 | ok | (remover) ou "de acordo" | S | Em confirmação formal: "está certo" |

#### 3.2.2 Muletas e marcadores de fala

| # | Informal | Formal | Ação | Observação |
| --- | --- | --- | --- | --- |
| 12 | sei lá | não é possível afirmar / (remover) | S | Só sugerir: quase sempre pede reescrita da frase |
| 13 | e tal / etc e tal | entre outros | A | Já existe "e tal" |
| 14 | sabe? / entende? (fim de frase) | (remover) | S | Marcador fático; remoção segura mas o tom visível muda |
| 15 | enfim / vamos dizer / digamos assim | (remover) / por exemplo | S | "enfim" pode ser conclusivo legítimo (raro) |
| 16 | daí / aí (conector de fala) | então / em seguida / nesse momento | S | "aí" locativo é legítimo ("aí está o problema") |
| 17 | então (repetido/início de frase) | portanto / logo / dessa forma / (remover) | S | Só quando há repetição na janela ou frase sem nexo |
| 18 | no final das contas / por causa disso | em última análise / por esse motivo | A | Já existem |

#### 3.2.3 Oralidade → impessoalidade

| # | Antes | Depois | Ação | Observação |
| --- | --- | --- | --- | --- |
| 19 | a gente analisou | analisou-se / este trabalho analisou / nós analisamos | S | Três saídas: impessoal (recomendada no acadêmico), sujeito explícito ou "nós" |
| 20 | eu acho / eu acredito | considera-se / entende-se / os dados indicam | S | Ver 3.2.4; exige concordância com o resto da frase |
| 21 | dá pra ver que | observa-se que / é possível observar que | S | "dá pra" é compressível em "é possível" |
| 22 | a gente vê / você vê que | observa-se que / verifica-se que | S | Evita 1ª pessoa e 2ª pessoa |
| 23 | o pessoal / muita gente | a equipe / os participantes / muitos autores | S | Sentido depende de quem é o sujeito |
| 24 | vou fazer / vamos fazer | será feito / realizar-se-á | S | Para projeto/relatório: "este trabalho fará" |
| 25 | eu fiz a pesquisa | a pesquisa foi realizada | S | Voz passiva sintética ou analítica |
| 26 | tem muita gente que diz | muitos autores afirmam / há quem afirme | S | Muda sujeito e número: sugerir com contexto |

#### 3.2.4 Atenuação, opinião e hedge

| # | Antes | Depois | Ação | Observação |
| --- | --- | --- | --- | --- |
| 27 | acho que / acho | considera-se que / entende-se que | S | "acho que" já existe (sugestão); manter só como sugestão |
| 28 | me parece que | os indícios sugerem que / aparentemente | S | Atenuação com sujeito de 1ª pessoa |
| 29 | meio que | de certa forma / (remover) | A/S | "meio que" é oral puro; remoção costuma caber |
| 30 | mais ou menos | aproximadamente / parcialmente | S | Pode ser quantidade real ("mais ou menos 30") |
| 31 | pode ser que | é possível que | S | Reescrita de modalidade |
| 32 | talvez | talvez | — | **Não mexer**: é atenuação formal aceita no acadêmico |
| 33 | um pouco | parcialmente / ligeiramente | S | Frequentemente legítimo: não corrigir sozinho |

#### 3.2.5 Redundâncias e pleonasmos

| # | Antes | Depois |
| --- | --- | --- |
| 34 | subir para cima / descer para baixo | subir / descer |
| 35 | entrar para dentro / sair para fora | entrar / sair |
| 36 | repetir de novo | repetir |
| 37 | há três anos atrás | há três anos (ou "três anos atrás") |
| 38 | prever / planejar antecipadamente | prever / planejar |
| 39 | elo de ligação | elo / ligação |
| 40 | verdade real / certeza absoluta | verdade / certeza |
| 41 | monopólio exclusivo | monopólio |
| 42 | acabamento final / conclusão final | acabamento / conclusão |
| 43 | em duas metades iguais | em duas metades / ao meio |
| 44 | criar novo / inovar do zero | criar / inovar |
| 45 | mais melhor / menos pior | melhor / menos ruim |
| 46 | encarar de frente | encarar |
| 47 | pequenos detalhes | detalhes |
| 48 | totalmente único | único |

Ação: **A** para os padrões fechados (34–48, com teste de limite de palavra e de não estar em citação); **S** quando o "reforço" pode ser intencional (ex.: "conclusão final" num texto didático).

#### 3.2.6 Clichês e frases feitas

| # | Antes | Depois | Ação |
| --- | --- | --- | --- |
| 49 | nos dias de hoje / no mundo atual | atualmente / hoje | A |
| 50 | desde os primórdios | desde o início | A |
| 51 | é sabido que / todos sabem que | (remover e afirmar direto) | S |
| 52 | cada vez mais | crescentemente / (remover) | S |
| 53 | vem crescendo | tem crescido | A |
| 54 | faz-se necessário | é necessário | S |
| 55 | de suma importância | essencial | A |
| 56 | abrir um leque (de possibilidades) | ampliar as possibilidades | S |
| 57 | um passo importante | um avanço relevante | S |

**Não são clichês para remover**: "por outro lado", "além disso", "dessa forma", "nesse sentido" — são conectores formais; entram em revisão de repetição, não de formalidade.

#### 3.2.7 Vagueza e "coisa"

| # | Antes | Depois | Ação |
| --- | --- | --- | --- |
| 58 | coisa(s) | elemento(s) / aspecto(s) / item(ns) | S |
| 59 | negócio / troço | atividade / objeto / assunto | S |
| 60 | dar uma olhada | examinar | A |
| 61 | fazer uma análise de | analisar | S |
| 62 | realizar uma pesquisa sobre | pesquisar | S |
| 63 | de certa forma | (remover) ou em certa medida | S |
| 64 | isso (anáfora vaga) | este resultado / esse dado / o fenômeno | S |

As de "coisa" e "isso" precisam de janela de contexto e nunca devem entrar sozinhas: "coisa" pode ser citação, dito popular ou parte de nome.

### 3.3 Ordem de aplicação

A ordem importa para não criar avisos duplicados nem "corrigir por cima" (o `style/index.ts` já registra essa lição: a primeira regra que casa o trecho vence; a deduplicação por intervalo é feita no fim).

1. **Máscara** (`maskNonProse`) e, no modo documento, corte de blocos de código, fórmulas, listas de referências e citações longas.
2. **Ortografia/forma** — ortografia do dicionário, espaços, pontuação (as regras `safe` de hoje).
3. **Internetês e contrações** (3.2.1, itens 1–9): trocas sem sentido novo; base do `safe`.
4. **Muletas fechadas** (3.2.2, itens 12–18, só as com correção fixa) e **redundâncias fechadas** (3.2.5) — regras de lista, com limite de palavra e exclusão de citação.
5. **Clichês** (3.2.6) — lista com sugestão.
6. **Frase** (3.2.3 e 3.2.4, 3.2.7) — janela de contexto: sujeito/verbo, impessoalidade, vagueza; sempre sugestão, com explicação e, quando possível, **duas** alternativas ("analisou-se" / "este trabalho analisou").
7. **Deduplicação** por intervalo, mantendo a primeira (mais específica) e sinalizando sobreposição.
8. **Métrica** (3.5) calculada sobre o texto final, para o antes/depois.

Regra de convivência com as regras ABNT existentes: formalidade e estilo rodam antes das checagens ABNT; trocar "pra→para" não pode disparar depois um aviso de "espaço" no mesmo intervalo (dedupe já resolve).

### 3.4 Riscos de alterar o sentido (o que só pode ser sugerido)

| Regra | Risco | Mitigação |
| --- | --- | --- |
| a gente → nós/impessoal | Muda a pessoa do discurso e pode criar mistura com "você" no resto do texto | Detectar a pessoa predominante do documento; oferecer impessoal como 1ª opção |
| acho que → considera-se que | Vira afirmação impessoal onde havia opinião assumida | Manter como sugestão; nunca `safe` |
| então/daí → conector formal | "então" pode ser conclusão lógica legítima; "daí" pode ser lugar | Só quando no início de frase, repetido ou precedido de pausa |
| um monte de → muitos | Concordância: "um monte de gente" → "muitas pessoas", não "muitos" | Sugerir com a concordância resolvida pela janela |
| coisa → elemento | "coisa" pode estar em citação, dito ou nome ("coisas do direito") | Sugerir; nunca `safe`; não agir em citação |
| e tal → entre outros | Pode encerrar lista aberta fora do rol | Sugerir quando houver lista antes |
| mais ou menos → aproximadamente | Pode ser avaliação ("o resultado foi mais ou menos") | Distinguir de quantidade |
| enfim → remover | "Enfim" pode concluir um raciocínio | Só sugerir |
| meio que → remover | Pode atenuar algo que o autor quer atenuar | Sugerir, mostrando o antes/depois |
| pra/pro no meio de apóstrofo/nome | Nomes próprios e transcrições | Excluir maiúscula inicial e contexto de citação |

### 3.5 Métrica de formalidade por regras

**Definição:** *marcadores informais por 1.000 palavras* (MIP), com pesos por classe.

```
MIP = (Σ peso × ocorrências) ÷ palavras × 1.000

Pesos sugeridos
  gíria/internetês/contração fechada ........ 3
  muleta/oralidade com substituição fixa .... 2
  oralidade/impessoalidade (sujeito) ........ 2
  atenuação/opinião .......................... 1
  redundância/pleonasmo ...................... 1
  clichê (com remoção) ....................... 1
  vagueza ("coisa", "isso") .................. 1
```

**Exemplo.** Texto de 400 palavras com 3 "pra", 2 "tá", 1 "a gente analisou", 1 "acho que" e 1 "coisa":

- antes: `(3×3 + 2×3 + 1×2 + 1×1 + 1×1) = 19` → `19 ÷ 400 × 1.000 = 47,5` MIP;
- depois de aplicar os `safe` e aceitar as sugestões: 0 → **0 MIP**.

**Faixas de leitura (sugestão de produto, calibrável em documentos reais):**

| Faixa | Leitura |
| --- | --- |
| 0–2 | formal |
| >2–5 | aceitável (poucos traços) |
| >5–10 | pede revisão de registro |
| >10 | claramente informal |

**Limites honestos:** a métrica mede **só o que o catálogo conhece** (subestima o informal desconhecido), não mede coerência, ironia, adequação ao tema nem repetição de conectores; e pode ser "enganada" com trocas automáticas. Por isso ela vem sempre acompanhada do antes/depois por ocorrência — o número é um resumo, não o diagnóstico.

---

## 4. ABNT — o que é verificável automaticamente

Legenda: ✅ **checável com certeza** (detecção determinística e interpretação estável) · ⚠️ **checável com ressalva** (varia por instituição, versão da norma ou depende de julgamento do tipo "avisa e mostra") · 👤 **não verificável sem revisão humana** (exige leitura/opinião/fonte externa).

> **Ressalva geral:** as normas ABNT são **pagas** (catálogo ABNT/Target); os trabalhos de referência usados aqui são guias de bibliotecas e resumos públicos. Cada instituição fixa o que exige e **algumas ainda pedem versões antigas** (10520:2002, 14724:2011, 6023:2018). O relatório deve sempre registrar **contra qual versão** está avaliando e permitir trocar.

### 4.1 NBR 14724:2024 — apresentação de trabalhos acadêmicos

Versão vigente desde 16 dez. 2024 (4ª edição), substituindo a de 2011. Mantém margens 3-2-3-2,
fonte 12 (Arial ou Times New Roman), entrelinha 1,5 e recuo 1,25 cm; atualizou termos
("seções" em vez de "capítulos") e regras para trabalhos digitais.

| Item | Classificação | Como verificar |
| --- | --- | --- |
| Elementos pré-textuais obrigatórios presentes (capa, folha de rosto, resumo, resumo em língua estrangeira, sumário + folha de aprovação para teses/dissertações) | ✅ | Cabeçalhos/textos normativos no Markdown; estilos/páginas no `.docx` |
| Ordem dos elementos (pré → textuais → pós) | ✅ | Índice de títulos vs. lista de elementos |
| Estrutura textual (introdução, desenvolvimento, conclusão) | ✅ | Presença das seções de topo |
| Seções primárias começam em página nova (ímpar em frente/verso) | ⚠️ | No `.docx` (quebras de seção) — instituição pode adaptar |
| Margens anverso: esquerda e superior 3 cm; direita e inferior 2 cm | ✅ (`.docx`) | `sectPr` do XML (hoje o export usa 2 cm nos quatro lados) |
| Corpus com fonte 12 (Arial ou Times) | ✅ (`.docx`) | `styles.xml`/runs (hoje Calibri 11) |
| Entrelinha 1,5 no corpo; simples em citações longas, notas, legendas e tabelas | ✅/⚠️ (`.docx`) | `w:spacing` (hoje 1,25) |
| Recuo de primeira linha 1,25 cm | ⚠️ | Convenção de manuais; checar no `.docx` |
| Página A4 (21 × 29,7 cm), branca | ✅ (`.docx`) | `w:pgSz` (export já tem A4, mas também Letter) |
| Paginação no canto superior direito, a partir da introdução (contagem desde a folha de rosto) | ⚠️ (`.docx`) | Cabeçalhos/seções; hoje o export não pagina |
| Resumo/abstract: um parágrafo, sem citação | ✅ | Bloco + busca de citações dentro dele |
| Listas (ilustrações, tabelas, abreviaturas e siglas, símbolos) só quando existem os itens | ✅/⚠️ | Cruzar figuras/tabelas/siglas detectadas com as listas |
| Ficha catalográfica e folha de aprovação | ⚠️ | Modelos variam por biblioteca |
| Capa/folha de rosto com os campos certos (autor, título, subtítulo, local, ano, natureza) | ⚠️ | Campos detectáveis; rótulos variam |
| Verso (frente/verso) | 👤 | Depende da impressão |

### 4.2 NBR 10520:2023 — citações

Versão de jul. 2023, substituindo a de 2002. Mudanças que interessam a um verificador:
sobrenome em **maiúsculas e minúsculas** no autor-data entre parênteses; recuo de 4 cm na citação
direta longa passou de obrigatório a **recomendado**; **"et al." opcional** com mais de 3 autores;
ponto final da frase **depois** do parêntese; "*apud*" em itálico.

| Item | Classificação | Como verificar |
| --- | --- | --- |
| Citação autor-data tem autor e ano | ✅ | Regex `(Autor, ano…)` e `Autor (ano)` |
| Sobrenome no padrão da 2023 (Caixa mista; caixa alta é padrão antigo) | ⚠️ | Padrão atual detectável; instituição pode ainda aceitar o antigo (avisar, não reprovar) |
| Citação direta curta (até 3 linhas) entre aspas com página | ✅ | Aspas + `p. N` presentes |
| Citação direta longa (mais de 3 linhas): bloco, recuo 4 cm (recomendado), fonte menor, espaço simples, **sem aspas**; texto sem itálico obrigatório | ⚠️ | No Markdown: bloco `>` com mais de ~3 linhas; no `.docx`: recuo/fonte/espaçamento e ausência de aspas (hoje vira itálico com recuo de 0,63 cm) |
| Página (`p. N`) obrigatória em citação direta (quando houver página) | ✅ | Citação direta sem `p.` → aviso |
| Citação indireta sem aspas, com autor/ano | ✅ | Aspas + autor presentes |
| Citação de citação com "*apud*" em itálico | ✅ | `apud` fora de itálico/markdown |
| Pontuação: ponto final da frase depois do parêntese (evitar dois pontos finais) | ✅ | Padrão `." (Autor…)` / `).` no fim |
| Fidelidade da transcrição e indicação correta da página | 👤 | Exige a fonte original |
| Obra citada consta nas referências (e vice-versa) | ✅ | Cruzamento chave (autor+ano) citação ↔ lista |

### 4.3 NBR 6023:2025 — referências

Versão publicada em maio de 2025 (3ª edição), substituindo a de 2018. Estrutura mantida
(ordem alfabética, sobrenome, destaque tipográfico uniforme, "Disponível em/Acesso em"), com
ajustes para fontes digitais e itálico em "*In*", "*et al.*" e "[*S.l.*]".

| Item | Classificação | Como verificar |
| --- | --- | --- |
| Lista de referências existe (elemento pós-textual) | ✅ | Cabeçalho "REFERÊNCIAS" |
| Ordem alfabética pelo sobrenome do primeiro autor | ✅ | Comparação de chaves |
| Elementos essenciais por tipo (livro, capítulo, artigo, site, lei, tese, evento, patente) | ✅ | Parser por tipo com padrões (ver 6, R01–R08) |
| "Disponível em: URL. Acesso em: data." em referências online | ✅ | Padrão detectável |
| Destaque tipográfico uniforme (título em negrito/itálico de forma consistente) | ⚠️ | No Markdown: `**`/`*`; regra é uniformidade |
| Mais de 3 autores: "et al." **opcional** na 2025 → flagrar só inconsistência interna | ⚠️ | Não reprovar et al.; comparar padrão entre entradas |
| "[S.l.]", "[s.n.]", "s.d.", "[20--]" para dados desconhecidos | ✅ | Padrões |
| *In*, *et al.*, *[S.l.]* em itálico (2025) | ⚠️ | Resumos da 2025; confirmar na norma paga |
| Autoria: SOBRENOME, Nome (ou entidade) e ano de publicação compatível com a citação | ✅ | Cruzamento com citações |
| Metadados corretos/verdadeiros (obra existe, DOI, páginas) | 👤/⚠️ | Só com fonte externa (checagem online é opcional, com rede) |

### 4.4 NBR 6027:2012 (sumário) e NBR 6024:2012 (numeração progressiva)

| Item | Norma | Classificação | Como verificar |
| --- | --- | --- | --- |
| Sumário presente e coerente com os títulos (ordem, texto) | 6027 | ✅ | Comparar títulos/numeração do corpo com o bloco do sumário |
| Elementos pré-textuais **não** aparecem no sumário | 6027 | ⚠️ | Regra da norma (itens citados nos guias); alguns modelos incluem as listas — confirmar instituição |
| Paginação alinhada à direita com pontilhado/linha | 6027 | ⚠️ (`.docx`) | XML: tab/valor de página; some no Markdown puro |
| Sumário gerado por campo (TOC) em vez de texto estático | 6027 | ⚠️ (`.docx`) | Presença de campo `TOC` no XML |
| Numeração decimal e alinhamento com os níveis: seção primária 1; 1.1; 1.1.1; 1.1.1.1; 1.1.1.1.1 | 6024 | ✅ | Séries dos cabeçalhos Markdown (`#`…`######`) vs números |
| Sem títulos textuais sem número (fora de pré/pós-textuais e referências) | 6024 | ✅ | Títulos de nível 1+ no corpo devem ter indicativo |
| Divisão em subseções: não criar uma subseção isolada ("pai" sem pelo menos duas filhas) | 6024 | ⚠️ | Convenção de manuais; avisar, não reprovar |
| Destaques gráficos graduais (primária caixa alta; secundária versalete; terciárias negrito/itálico) | 6024 | ⚠️ | Varia no `.docx`; no Markdown não há versalete |

### 4.5 NBR 6028:2021 — resumo, resenha e recensão

| Item | Classificação | Como verificar |
| --- | --- | --- |
| Resumo presente (língua vernácula) e abstract (língua estrangeira) | ✅ | Blocos |
| Extensão: 150–500 palavras (trabalhos acadêmicos), 100–250 (artigos), 50–100 (indicações breves) | ✅ | Contagem já existente (`stats.ts`) |
| Um parágrafo único, sem citação, verbos na 3ª pessoa | ✅ (parág./citação) / ⚠️ (pessoa) | Quebras + detecção de citação; pessoa verbal exige heurística |
| Palavras-chave logo abaixo, no formato "Palavras-chave: …" | ✅ | Rótulo + separadores |
| Quantidade de palavras-chave (manuais comumente pedem 3 a 5) | ⚠️ | A norma/resumos não fixam o número de forma uniforme; usar ressalva configurável |
| Ordem: resumo após folha de aprovação, antes do sumário | ✅/⚠️ | Posição nos elementos |

### 4.6 NBR 15287:2025 — projeto de pesquisa

Versão de 18 mar. 2025 (3ª edição), substituindo a de 2011. Mesma apresentação gráfica da 14724.

| Item | Classificação | Como verificar |
| --- | --- | --- |
| Elementos pré-textuais (capa, folha de rosto, sumário) | ✅ | Como em 4.1 |
| Estrutura textual: introdução (tema, problema, objetivos, justificativa), metodologia, cronograma, resultados esperados | ⚠️ | Presença de títulos varia em nome/ordem por instituição |
| Referências e formatação gráfica conforme 6023/14724 | ✅/⚠️ | Cruzar com 4.3 e 4.1 |
| Conteúdo e viabilidade do projeto | 👤 | Julgamento |

### 4.7 Tabelas (normas IBGE) e figuras/ilustrações

| Item | Classificação | Como verificar |
| --- | --- | --- |
| Tabela: número e título **acima**; fonte **abaixo** ("Fonte: …") | ✅ | Estrutura da tabela Markdown + linhas vizinhas |
| Tabela de dados numéricos (tabela) vs. quadro não numérico | ⚠️ | Dados numéricos por célula |
| Moldura/traços conforme norma tabular (IBGE) | ⚠️ (`.docx`) | Estilo de borda no XML; no Markdown é a sintaxe |
| Figuras: identificação e legenda **acima** ("Figura N – …"); "Fonte:" **abaixo** quando de terceiros | ✅ | Imagem + legendas vizinhas; "Fonte:" obrigatória se não for autoria própria (⚠️) |
| Citação da fonte da figura/tabela (quando adaptada de terceiros) | ⚠️ | Presença de "Fonte:" com referência |
| Lista de ilustrações/tabelas quando houver itens | ✅ | Cruzamento com as listas pré-textuais |

### 4.8 Abreviaturas, siglas, algarismos, datas e horas

| Item | Classificação | Base | Como verificar |
| --- | --- | --- | --- |
| Lista de abreviaturas e siglas quando usadas | ✅ | 14724 (elemento pré-textual conforme uso) | Detectar siglas no texto × lista |
| Primeira ocorrência: forma completa + sigla entre parênteses | ⚠️ | Convenção de manuais (não é detalhe fechado da NBR) | Heurística por sigla nova |
| Plural de sigla sem apóstrofo (SIGLAS, não SIGLA's) | ✅ | Convenção da língua; o app já tem regra | Já em `abnt.ts` |
| Algarismos: padrão brasileiro (1.000; 1,5; 10 %); arredondamento para uma casa/quantidade definida | ⚠️ | NBR 5891 (arredondamento) + convenções | Padrões numéricos |
| Datas: "4 de abril de 2018", "04.04.2018", "4 abr. 2018" | ✅ | NBR 5892:2019 | Regex de datas + formatos aceitos |
| Horas: "14h", "14h30" (evitar "14:30hs", "14 horas e 30 h") | ✅ | NBR 5892:2019 (com ressalva nos detalhes) | Já em `abnt.ts` (`abntHours`) |
| Abreviaturas de medida sem ponto e com espaço (10 cm, 5 kg) | ✅ | 5892/uso internacional | Já em `abnt.ts` (`abntUnits`) |
| Meses minúsculos em datas | ✅ | Gramática pt-BR | Já em `abnt.ts` (`abntMonths`) |

---

## 5. Como verificar no mdOffice

### 5.1 Análise do Markdown (o que entra e o que fica fora)

O Markdown dá estrutura suficiente para boa parte do trabalho — e o `marked` (já dependência)
produz os tokens com posição para o relatório apontar o trecho.

| Fonte no Markdown | Uso na verificação |
| --- | --- |
| `#` … `######` | Seções e subseções; numeração progressiva (6024) e sumário (6027); elemento do trabalho (introdução, referências…) por título normalizado |
| `>` (blockquote) | Citação (direta longa quando passar de ~3 linhas); conferir aspas/itálico/recuo no `.docx` |
| Lista numerada/`-` | Referências (bloco sob "REFERÊNCIAS"), sumário manual, listas do trabalho |
| Tabelas | Tabela (IBGE): título/fonte nas linhas vizinhas |
| `![legenda](…)` | Figura: legenda acima e "Fonte:" abaixo (linha adjacente) |
| Texto corrido | Citações autor-data, internetês/formalidade, siglas, datas/horas, algarismos |
| Metadados/YAML + primeiras seções | Capa/folha de rosto (título, autor, local, ano, natureza) — heurística |
| `**negrito**`, `*itálico*` | Destaque tipográfico das referências e do latim |

**Fica fora do escopo do Markdown:** paginação, margens, fonte, entrelinha, recuos de página,
quebra de seção (página nova/ímpar), ficha catalográfica, folha de aprovação assinada e a
posição visual das legendas. Isso tudo é do papel/`.docx` (5.2). No Markdown dá para checar o
**conteúdo** e a **ordem**, com um aviso explícito de que o visual não foi avaliado.

**O que o relatório de Markdown deve produzir por regra:**

- **ok** — encontrado e correto (com o trecho);
- **violada** — encontrado e incorreto (trecho + severidade + correção);
- **não verificável aqui** — depende de página/visual ou de leitura (com o motivo), para não dar falsa sensação de "tudo certo".

### 5.2 Validação do `.docx` exportado

O `.docx` é um ZIP com XML (`word/document.xml`, `word/styles.xml`). O projeto já usa JSZip —
dá para **reler o arquivo gerado** e conferir o que o Markdown não vê. Comparação com os valores
atuais de `src/md/docx.ts`:

| Item | ABNT (via guias) | Hoje no export | Ação |
| --- | --- | --- | --- |
| Margem esquerda/superior | 3 cm (1701 twips) | 2 cm (1134) nos quatro lados | Perfil ABNT no export ou aviso no relatório |
| Margem direita/inferior | 2 cm (1134) | 2 cm (1134) | ok |
| Fonte do corpo | Arial ou Times New Roman 12 (24 meios-pontos) | Calibri 11 (22) | Perfil ABNT |
| Entrelinha do corpo | 1,5 (360) | 1,25 (300) | Perfil ABNT |
| Citação longa | recuo 4 cm (2268 twips), fonte menor, espaço simples, **sem aspas**, sem itálico obrigatório | itálico, recuo 360 twips (0,63 cm), barra lateral | Regra própria no export + checagem |
| Paginação (superior direita, da introdução) | presente | ausente | Fase 3 (cabeçalho/seções com `PAGE`) |
| Página A4 | A4 | A4 ou Letter (opção) | Aviso quando Letter |
| Sumário | gerado por campo/estático coerente | não existe | Fase 3 (TOC) |
| Recuo 1,25 cm da 1ª linha | convenção | 0 | Perfil ABNT |

Dois níveis de validação, complementares:

1. **No modelo antes de exportar** — mais simples e não exige reabrir o arquivo: o export monta as
   `Paragraph`/`styles`; dá para o próprio pipeline aplicar/conferir o perfil ABNT.
2. **No arquivo exportado** — mais forte: pega ajustes feitos no Word e é o que o usuário entrega.
   Implementação: JSZip → `document.xml`/`styles.xml` → ler `w:sectPr` (margens, tamanho),
   `w:spacing` (line/after), `w:rFonts`/`w:sz` (fonte), `w:ind` (recuos), presença de `w:pgNumType`
   e de campos de sumário.

### 5.3 Relatório de conformidade

Formato sugerido (uma linha por regra, agrupado por norma), reaproveitando o vocabulário do
`WritingIssue` e exportável em Markdown/JSON (e no "Pacote IA", se quiser):

```text
RELATÓRIO ABNT — monografia.md            (NBR 14724:2024 · 10520:2023 · 6023:2025)
Palavras: 12.480 · Seções: 34 · Referências: 27 · Citações: 61 · Figuras: 8 · Tabelas: 5
Legenda: ✔ ok · ✘ violação · ⚠ ressalva · — não verificável aqui

ESTRUTURA (14724)
✔ Pré-textuais presentes e na ordem (resumo, abstract, sumário)
✘ Resumo com 612 palavras — fora da faixa 150–500 (severidade: média)
   trecho: "linha 12–18: Este trabalho investiga…" · corrigir: enxugar para ≤500
⚠ Folha de aprovação: modelo varia por instituição
— Margens e paginação: verificar no .docx exportado (perfil ABNT)

CITAÇÕES (10520)
✔ 61 citações autor-data com ano
✘ 3 citações diretas sem página (severidade: alta)
   trechos: linha 204, 388, 410 · corrigir: acrescentar p. N
✘ 4 citações usam CAIXA ALTA — padrão de 2002; a 10520:2023 usa Caixa Mista (severidade: baixa)
✘ 2 citações diretas longas ainda com aspas (severidade: média)

REFERÊNCIAS (6023)
✘ 2 citações sem referência correspondente: (Furtado, 2019), (IBGE, 2021) (severidade: alta)
✘ 1 referência fora da ordem alfabética: "SILVA…" antes de "SANTOS…" (severidade: baixa)
⚠ 4 entradas online sem "Acesso em" (severidade: média)

DOCX
✘ Margens esquerda/superior de 2 cm (deveriam ser 3 cm)
✘ Fonte Calibri 11 (deveria ser Arial ou Times 12)
✘ Corpo com entrelinha 1,25 (deveria ser 1,5)
```

O painel de revisão (`review.ts`) pode ganhar a visão "ABNT" com os mesmos componentes (chips,
ir para o trecho, corrigir), e o relatório exportável em arquivo na pasta do documento.

---

## 6. Catálogo inicial de regras (30–40)

Colunas: **ID · Norma · O que verifica · Como detectar · Exemplo de violação → correção · Confiança**
(alta = raramente erra; média = precisa de contexto; baixa = avisar, nunca reprovar automaticamente).

| ID | Norma | O que verifica | Como detectar | Exemplo (violação → correção) | Conf. |
| --- | --- | --- | --- | --- | --- |
| E01 | 14724 | Elementos pré-textuais obrigatórios | Títulos reconhecidos: resumo, abstract, sumário etc. | sem "RESUMO" → incluir o elemento | alta |
| E02 | 14724 | Ordem pré → textuais → pós | Posição relativa dos títulos | referências antes da conclusão → reordenar | alta |
| E03 | 14724 | Introdução/desenvolvimento/conclusão | Títulos de nível 1 | sem conclusão → incluir seção | alta |
| E04 | 14724 | Margens 3-2-3-2 (docx) | `w:sectPr` | margin 1134 nas 4 → left/top 1701 | alta |
| E05 | 14724 | Fonte 12 Arial/Times (docx) | `w:rFonts`, `w:sz` | Calibri 22 → Arial 24 | alta |
| E06 | 14724 | Entrelinha 1,5 (docx) | `w:spacing w:line` | 300 → 360 | alta |
| E07 | 14724 | Página A4 (docx) | `w:pgSz` | Letter → A4 | alta |
| E08 | 14724 | Paginação a partir da introdução (docx) | `w:pgNumType`, cabeçalho | sem campo PAGE → adicionar | média |
| E09 | 14724 | Resumo 150–500 palavras | contagem existente | 612 palavras → enxugar | alta |
| E10 | 14724 | Abstract presente | bloco "ABSTRACT" | ausente → incluir | alta |
| E11 | 14724 | Listas só com itens existentes | figuras/tabelas/siglas × listas | lista de tabelas vazia → remover | média |
| E12 | 14724 | Seção primária começa em página nova (docx) | quebras de seção | seções no mesmo fluxo → inserir quebra | média |
| C01 | 10520 | Citação autor-data com ano | `\(([A-ZÁ…][\w…]+),? \d{4}` | "(Silva)" → "(Silva, 2020)" | alta |
| C02 | 10520 | Caixa do autor no parêntese (2023) | CAIXA ALTA detectada | "(SILVA, 2020)" → "(Silva, 2020)" | média |
| C03 | 10520 | Página em citação direta | aspas + sem `p.` | "…texto" (Silva, 2020) → acrescentar p. N | alta |
| C04 | 10520 | Citação direta longa sem aspas, bloco, fonte menor | >3 linhas/bloco + aspas/fonte | aspas no bloco → remover, recuo 4 cm | média |
| C05 | 10520 | *apud* em itálico | `\bapud\b` fora de `*…*` | Silva apud Costa → *apud* | alta |
| C06 | 10520 | Ponto final depois do parêntese | `\."\s*\(Autor` / `\)\.` | `.” (Silva, 2020).` duplo → um só ponto após ")" | média |
| R01 | 6023 | Lista de referências existe | título "REFERÊNCIAS" | ausente → incluir | alta |
| R02 | 6023 | Ordem alfabética | chave do primeiro sobrenome | SILVA antes de SANTOS → reordenar | alta |
| R03 | 6023 | Livro: autor. *Título*. Local: Editora, ano | parser: padrão com local/editora/ano | "Livro, 2020" → completar dados | média |
| R04 | 6023 | Capítulo: "In:" com obra completa | `\bIn:?` | capítulo sem "In" → acrescentar | média |
| R05 | 6023 | Artigo: título do periódico + v./n./p. | padrão de fascículo | sem periódico → completar | média |
| R06 | 6023 | Site: Disponível em/Acesso em | URLs + rótulos | sem "Acesso em" → acrescentar data | alta |
| R07 | 6023 | Lei: número, data, órgão, publicação | padrão "Lei n." | sem órgão → completar | média |
| R08 | 6023 | Tese/dissertação: tipo, instituição, ano | palavras tese/dissertação/TCC | sem instituição → completar | média |
| R09 | 6023 | Evento: nome, ano, local; "In:" ata/anais | padrão de evento | sem ano → completar | média |
| R10 | 6023 | Patente: número, classificação, data | padrão de patente | sem número → completar | média |
| R11 | 6023 | Citação ↔ referência (cruzamento) | chaves autor+ano nos dois lados | (Furtado, 2019) sem referência → incluir ou remover citação | alta |
| R12 | 6023 | Destaque tipográfico uniforme | presença de `**`/`*` no mesmo campo | título sem destaque → padronizar | baixa |
| S01 | 6027 | Sumário bate com títulos e ordem | comparação título a título | subseção ausente → atualizar sumário | alta |
| S02 | 6027 | Pré-textuais fora do sumário | títulos do sumário | "RESUMO" listado → remover | média |
| S03 | 6024 | Numeração decimal e níveis | séries `\d+(\.\d+)*` × `#` | "1.2" em `##` após "3." → renumerar | alta |
| S04 | 6024 | Sem seção filha única | contagem de filhas por pai | 1 subseção isolada → juntar ou criar par | baixa |
| A01 | 6028 | Extensão do resumo | contagem | 90 palavras → faixa 150–500 | alta |
| A02 | 6028 | Palavras-chave presentes e formatadas | "Palavras-chave:" | ausente → incluir | alta |
| A03 | 6028 | Resumo sem citação | busca de citações no bloco | "(Silva, 2020)" no resumo → remover | média |
| P01 | 15287 | Seções do projeto (intro/objetivos/metodologia/cronograma) | títulos | sem cronograma → incluir | média |
| T01 | IBGE | Título da tabela acima; "Fonte:" abaixo | linhas vizinhas | fonte ausente → acrescentar | média |
| T02 | 14724 | Figura: legenda acima, fonte abaixo | linhas vizinhas | fonte ausente (terceiros) → acrescentar | média |
| G01 | 14724 | Siglas usadas constam da lista | siglas `[A-Z]{2,}` × lista | sigla sem lista → incluir lista | média |
| G02 | 6023/14724 | Elementos latin s/ itálico, datas/horas padrão | regras `abnt.ts` atuais | "14:30hs" → "14h30" | alta |
| G03 | 5892 | Datas em formato aceito | regex de datas | "04/04/2018" → "04.04.2018" | média |
| G04 | 10520/6023 | Caixa do autor na referência (SOBRENOME, Nome) | padrão do 1º campo | "Silva, João" → "SILVA, João" | alta |

Total: **41 regras** (E01–E12, C01–C06, R01–R12, S01–S04, A01–A03, P01, T01–T02, G01–G04).

---

## 7. Ferramentas e referências de apoio

### 7.1 Ecossistema ABNT (LaTeX/CSL) — para inspirar regras e validar formato

- **abnTeX2** — classe LaTeX + estilos bibliográficos ABNT (BibTeX), mantida pela comunidade: <https://github.com/abntex/abntex2> · CTAN: <https://ctan.org/pkg/abntex2>. Serve de **referência de comportamento** (o que a classe gera: capa, folha de aprovação, sumário, citações) e de teste cruzado do nosso motor — sem copiar código.
- **biblatex-abnt** — estilo biblatex/Biber para ABNT: <https://github.com/abntex/biblatex-abnt> · CTAN: <https://ctan.org/pkg/biblatex-abnt>. Útil para conferir geração de referências por tipo.
- **CSL (Citation Style Language) ABNT** — estilos oficiais no repositório da CSL/Zotero: <https://github.com/citation-style-language/styles> · busca "ABNT" no Zotero: <https://www.zotero.org/styles?q=abnt> · arquivo autor-data: `associacao-brasileira-de-normas-tecnicas.csl`. Um motor CSL (`citeproc-js`/`citation-js`) poderia formatar referências a partir de dados estruturados — caminho possível para a fase 3, mas pesado para o produto offline atual.
- **Citation.js** — converte BibTeX/CSL-JSON e formata segundo CSL no navegador/Node: <https://citation.js.org/> · <https://github.com/citation-js/citation-js>.

### 7.2 Linters de prosa — bom encaixe para as regras de formalidade/ABNT

- **Vale** (MIT, Go, offline) — linter de prosa *markup-aware* (Markdown, HTML, etc.), regras em YAML (`substitution`, `existence`, `occurrence`…), escopos por tipo de bloco (título, lista, tabela), LSP para editores e CI: <https://vale.sh/> · <https://github.com/vale-cli/vale> · docs: <https://docs.vale.sh/>. É o encaixe mais direto: cada regra do catálogo (seção 6) vira uma regra Vale e dá para medir falso-positivo em repositório de textos de teste.
- **textlint** (JS/TS, Node) — linter plugável para texto natural com regras próprias, feito para Markdown: <https://textlint.org/> · <https://github.com/textlint/textlint>. Alternativa natural dentro do ecossistema do projeto (mesma stack).
- **LanguageTool** (open source, Java; PT-BR com regras gramaticais) — pode rodar local (Docker/JVM) e tem API; útil como **segunda opinião** de gramática, mas é pesado para embarcar no app: <https://languagetool.org/pt> · <https://github.com/languagetool-org/languagetool>.

### 7.3 Verificadores ABNT comerciais/acadêmicos (apenas para comparação)

- **Mettzer** — editor com formatação ABNT automática: <https://www.mettzer.com/>.
- **FastFormat** — formatação automática ABNT/outros estilos: <https://fastformat.co/>.
- **rascunho.app** — gera/atualiza trabalhos com as versões 2024/2025: <https://rascunho.app/abnt-2024-mudancas>.
- **Assistente do Prof. Alberto Claro** — conferência de formatação com IA: <https://albertoclaro.com/abntnbr147242024-elaboracao-trabalhos-academicos/>.

Esses produtos **formatam** (e às vezes reescrevem) com IA; nenhum foi encontrado com motor de
regras aberto e auditável. O diferencial do mdOffice é justamente o inverso: regras explicadas,
offline, com antes/depois e relatório — sem depender de serviço.

### 7.4 Manuais de bibliotecas universitárias (interpretação prática)

- **USP — ABCD/SIBi**, *Diretrizes para apresentação de dissertações e teses da USP — Parte I (ABNT)*, 5. ed. (2024): <https://www.livrosabertos.abcd.usp.br/portaldelivrosUSP/catalog/book/1353>.
- **UFPR — SiBi**, *Manual de normalização de documentos científicos de acordo com as normas da ABNT* (ed. 2024): <https://bibliotecas.ufpr.br/servicos/normalizacao/> · <https://acervodigital.ufpr.br/handle/1884/88892>.
- **Unesp (Marília)** — normas de citações e referências: <https://www.marilia.unesp.br/#!/laboratorio-editorial/procedimentos-publicacoes/normas-da-abnt--citacoes-e-referencias/>.
- **UFU** — tutorial de trabalhos acadêmicos atualizado pela NBR 14724:2024: <https://bibliotecas.ufu.br/sites/bibliotecas.ufu.br/files/media/imagem/trabalhos_academicos_dez_24.pdf>.
- **UFMS** — manual de citações ABNT 10520/2023: <https://bibliotecas.ufms.br/files/2024/08/NBR-10520-de-2023.pptx.pdf>.
- **Unicamp (IEL)** — orientações para citações 10520:2023: <https://www.iel.unicamp.br/wp-content/uploads/2024/09/guia_nbr10520_2023_ult.-versao.pdf>.
- **PUC Minas** — guias práticos de citações e referências: <https://www.pucminas.br/biblioteca/DocumentoBiblioteca/ABNT-Formatar-indicar-citacoes-e-referencia-las.pdf>.

### 7.5 Ressalvas (para o relatório nunca mentir)

1. **A norma é paga** e seus textos integrais não são públicos; os guias citados são interpretações de bibliotecas. O relatório deve dizer a versão que usou e oferecer "configurar versão".
2. **Cada instituição interpreta e fixa detalhes** (capa, ficha catalográfica, folha de aprovação, número de palavras-chave, uso de negrito). Regra sem consenso entra como **ressalva**, nunca como erro.
3. **Versões convivem**: muitos manuais ainda citam 14724:2011, 10520:2002 e 6023:2018. O verificador precisa de um seletor de versão por norma.
4. **O que é do papel não aparece no Markdown**: paginação, margens e quebras só são checáveis no `.docx` (e só se o export foi feito pelo app ou o arquivo foi relido).
5. **Verificação não é aprovação**: o relatório aponta conformidade mecânica; a banca avalia conteúdo, coerência e fidelidade das fontes — itens sempre marcados como não verificáveis.

---

## 8. Plano por fases

Esforço: **P** (pequeno, ≤ 1 semana), **M** (médio, 1–3 semanas), **G** (grande, > 3 semanas) — na escala de uma pessoa já familiarizada com o `src/broker/`.

### F0 — Formalidade com regras (base) · Esforço P · Impacto alto

- **O que entrega:** catálogo 3.2.1–3.2.2 e 3.2.5 (listas fechadas) com classes de segurança (`safe`/sugestão), tom respeitado, exclusão de citações; amplia o contador para medir MIP no painel de revisão.
- **Arquivos-alvo:** `src/broker/data/informal.ts` (nova estrutura `classe`/`peso`/`safe`), `src/broker/style/register.ts`, `src/broker/stats.ts` (marcadores e MIP), `src/settingsPage.ts` (explicação na aba Escrita).
- **Métricas:** nº de padrões (18 → ~50); falso-positivo < 2% nos `safe`; MIP calculado em < 50 ms para 50 mil palavras.

### F1 — Frase formal (oralidade, atenuação, vagueza) · Esforço M · Impacto alto

- **O que entrega:** regras de janela/frase (3.2.3–3.2.4, 3.2.6–3.2.7) com duas alternativas quando fizer sentido; "formalizar seleção" com prévia antes/depois; explicação de risco em cada sugestão.
- **Arquivos-alvo:** `src/broker/style/register.ts` (ou novo `src/broker/style/formalidade.ts`), `src/broker/data/*.ts` novos (muletas, redundâncias, clichês, impessoalidade), `src/broker/review.ts` (UI de sugestões com risco), `src/broker/style/index.ts` (ordem/dedupe).
- **Métricas:** nº de construções de frase cobertas; falso-positivo medido em 20 trabalhos reais < 10% (sugestões podem errar mais que os `safe`); tempo de varredura ~1,5× a atual.

### F2 — Motor ABNT no Markdown + relatório · Esforço M/G · Impacto alto

- **O que entrega:** novo `src/broker/abnt/` (`estrutura.ts`, `citacoes.ts`, `referencias.ts`, `numeracao.ts`, `resumo.ts`, `relatorio.ts`) rodando sobre os tokens do `marked`; catálogo da seção 6; painel/modal de relatório por norma com ok/violada/não verificável, trecho, severidade e correção; exportação do relatório; seletor de versão das normas.
- **Arquivos-alvo:** `src/broker/abnt/*`, `src/broker/review.ts`/`src/broker/deep/panel.ts` (novo painel), `src/app/commands.ts` (comando "Revisar ABNT"), `src/settingsPage.ts`.
- **Métricas:** 30+ regras ativas; precisão ≥ 95% nas regras de confiança alta; 100% dos achados com trecho e como corrigir; 50 mil palavras analisadas em < 2 s.

### F3 — Perfil ABNT no `.docx` (exportar e validar) · Esforço M · Impacto médio-alto

- **O que entrega:** modo "Exportar para ABNT" (A4, margens 3-2-3-2, Arial/Times 12, entrelinha 1,5, recuo 1,25 cm; citação longa com recuo 4 cm, fonte menor e espaço simples; paginação a partir da introdução; sumário) e **validador** que relê o `.docx` (JSZip + XML) produzindo a parte "DOCX" do relatório — inclusive para arquivos editados fora do app.
- **Arquivos-alvo:** `src/md/docx.ts` (perfil e opções), novo `src/md/docxcheck.ts` (leitura/validação do ZIP), `src/broker/abnt/relatorio.ts` (união Markdown+docx), `src/app/commands.ts`.
- **Métricas:** 100% dos itens visuais da seção 5.2 detectáveis; divergência zero entre o perfil aplicado e o arquivo gerado (teste de ida e volta); nenhuma regressão no export atual (modo padrão intocado).

**Ordem sugerida:** F0 → F1 → F2 → F3. F0/F1 não dependem de ABNT e já melhoram o dia a dia;
F2 entrega o relatório no Markdown (maior parte do valor acadêmico); F3 fecha o ciclo no arquivo
que o usuário entrega — e pode ser antecipada se o público-alvo for entregar `.docx` no Word.

---

## 9. Referências

Normas e resumos (todos acessados em 13 out. 2026):

1. ASSOCIAÇÃO BRASILEIRA DE NORMAS TÉCNICAS. **ABNT NBR 10520:2023** — Informação e documentação — Citações em documentos — Apresentação. Cópia de estudo (Fiocruz): <https://coc.fiocruz.br/wp-content/uploads/2024/03/Abnt_nbr_10520_2023.pdf>.
2. ______. **ABNT NBR 14724:2024** — Informação e documentação — Trabalhos acadêmicos — Apresentação. Cópia de estudo (UFF): <https://tpp-uff.com.br/wp-content/uploads/2025/02/ABNT_NBR_14724_2024-1.pdf>.
3. ______. **ABNT NBR 6023:2025** — Informação e documentação — Referências — Elaboração. Resumo da Biblioteca da Unicamp: <https://www3.eco.unicamp.br/biblioteca/images/arquivos/NBR60232025Referencias.pdf>.
4. ______. **ABNT NBR 6027:2012** — Informação e documentação — Sumário — Apresentação. Cópia de estudo (UFSC): <https://cnm.paginas.ufsc.br/files/2020/02/ABNT-NBR-6027.pdf>.
5. ______. **ABNT NBR 6024:2012** — Informação e documentação — Numeração progressiva das seções de um documento — Apresentação. Cópia de estudo (UFSC): <https://cnm.paginas.ufsc.br/files/2020/02/ABNT-NBR-6024.pdf>.
6. ______. **ABNT NBR 6028:2021** — Informação e documentação — Resumo, resenha e recensão — Apresentação. Cópia de estudo: <https://universidadeniltonlins.com.br/wp-content/uploads/2021/09/6028-Resumo-atualizada-em-18.05.2021-.pdf>.
7. ______. **ABNT NBR 15287:2025** — Informação e documentação — Projeto de pesquisa — Apresentação. Cópia de estudo: <https://universidadeniltonlins.com.br/wp-content/uploads/2025/06/NBR-15287_2025_Projeto-de-pesquisa.pdf>.
8. ______. **ABNT NBR 5892:2019** — Informação e documentação — Representação e formatos de tempo — Datas e horas — Apresentação. Resumo (IFSP): <https://ctd.ifsp.edu.br/images/Logos_biblioteca/NBR_5892_Datas_e_horas.pdf>.
9. INSTITUTO BRASILEIRO DE GEOGRAFIA E ESTATÍSTICA. **Normas de apresentação tabular**. 3. ed. Rio de Janeiro: IBGE, 1993: <https://biblioteca.ibge.gov.br/visualizacao/livros/liv23907.pdf>.

Guias, notícias e manuais de bibliotecas:

10. BIBLIOTECAS UFU. **Atualização da norma de apresentação de trabalhos acadêmicos — ABNT NBR 14724** (NBR 14724:2024, 16 dez. 2024): <https://bibliotecas.ufu.br/acontece/2025/01/atualizacao-da-norma-de-apresentacao-de-trabalhos-academicos-abnt-nbr-14724>. Tutorial: <https://bibliotecas.ufu.br/sites/bibliotecas.ufu.br/files/media/imagem/trabalhos_academicos_dez_24.pdf>.
11. BIBLIOTECAS UFU. **Atualização da norma de apresentação de projeto de pesquisa (NBR 15287:2025)**: <https://bibliotecas.ufu.br/acontece/2025/06/atualizacao-da-norma-de-apresentacao-de-projeto-de-pesquisa-abnt-nbr-15287>.
12. UFOP/POSEDU. **Normas para citações — NBR 10520/2023** (mudanças: caixa do autor, recuo, *et al.*, pontuação): <https://posedu.ufop.br/como-fazer-cita%C3%A7%C3%B5es-abnt-de-acordo-com-nbr-105202023>.
13. UNIFOR. **ABNT NBR 10520:2023: o que mudou**: <https://unifor.br/web/bibliotecaunifor/abnt-nbr-10520-2023-saiba-o-que-mudou-com-a-atualizacao-da-norma-de-citacoes>.
14. MUNDO BIBLIOTECÁRIO. **As atualizações da NBR 10520:2023** (jul. 2023): <https://mundobibliotecario.com.br/index.php/2023/07/25/a-caixa-alta-morreu-conheca-essa-e-mais-6-outras-atualizacoes-da-norma-abnt-nbr-105202023-que-vao-te-surpreender/>.
15. RASCUNHO.APP. **ABNT 2024 — o que mudou nas normas** (14724:2024, 6023:2025, 10520:2023, 6028:2021): <https://rascunho.app/abnt-2024-mudancas>.
16. ALBERTO CLARO. **ABNT NBR 14724:2024 — mudanças na elaboração de trabalhos acadêmicos**: <https://albertoclaro.com/abntnbr147242024-elaboracao-trabalhos-academicos/>.
17. ABCD/USP. **Diretrizes para apresentação de dissertações e teses da USP — Parte I (ABNT)**, 5. ed.: <https://www.livrosabertos.abcd.usp.br/portaldelivrosUSP/catalog/book/1353>.
18. SiBi/UFPR. **Manual de normalização de documentos científicos de acordo com as normas da ABNT**: <https://bibliotecas.ufpr.br/servicos/normalizacao/> · <https://acervodigital.ufpr.br/handle/1884/88892>.
19. UNESP (Marília). **Normas da ABNT — citações e referências**: <https://www.marilia.unesp.br/#!/laboratorio-editorial/procedimentos-publicacoes/normas-da-abnt--citacoes-e-referencias/>.
20. UFMS. **Manual de citações ABNT 10520/2023**: <https://bibliotecas.ufms.br/files/2024/08/NBR-10520-de-2023.pptx.pdf>.
21. UNICAMP/IEL. **Orientações para citações em documentos (10520:2023)**: <https://www.iel.unicamp.br/wp-content/uploads/2024/09/guia_nbr10520_2023_ult.-versao.pdf>.
22. PUC MINAS. **Orientações para elaboração de citações e referências**: <https://www.pucminas.br/biblioteca/DocumentoBiblioteca/ABNT-Formatar-indicar-citacoes-e-referencia-las.pdf>.

Ferramentas:

23. abnTeX2 — <https://github.com/abntex/abntex2> · <https://ctan.org/pkg/abntex2>.
24. biblatex-abnt — <https://github.com/abntex/biblatex-abnt> · <https://ctan.org/pkg/biblatex-abnt>.
25. CSL Styles (repositório oficial; estilos ABNT) — <https://github.com/citation-style-language/styles> · Zotero: <https://www.zotero.org/styles?q=abnt>.
26. Citation.js — <https://citation.js.org/> · <https://github.com/citation-js/citation-js>.
27. Vale — <https://vale.sh/> · <https://github.com/vale-cli/vale> · docs: <https://docs.vale.sh/>.
28. textlint — <https://textlint.org/> · <https://github.com/textlint/textlint>.
29. LanguageTool — <https://languagetool.org/pt> · <https://github.com/languagetool-org/languagetool>.
30. Mettzer — <https://www.mettzer.com/> · FastFormat — <https://fastformat.co/>.
