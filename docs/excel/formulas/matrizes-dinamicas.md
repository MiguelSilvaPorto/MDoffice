# Matrizes dinâmicas e funções do Excel 365

Especificação para recriar cada função. Formato: **NOME_PT (NOME_EN)** · `sintaxe` · regra · exemplo → resultado.
Marca: ✅ já no mdOffice · ⚠️ diverge · ❌ falta. Veja o [índice](README.md).

**Nenhuma função desta categoria existe no mdOffice.** O motor atual devolve **um único valor** por fórmula e uma faixa usada direto devolve só a primeira célula.

## Como o Excel 365 se comporta (para recriar)

- Uma fórmula pode devolver uma **matriz**; ela **derrama** nas células vizinhas (à direita e abaixo) a partir da célula da fórmula.
- Se alguma célula do caminho estiver ocupada → `#DERRAMAR!`. Matriz sem tamanho definido (`SEQUÊNCIA(INFINITO)`) → `#DERRAMAR!`.
- A faixa derramada é referenciada com `A1#` (operador de derrame).
- Operações entre matrizes agem elemento a elemento: `=A1:A3*2` devolve 3 valores. Tamanhos diferentes → completa com `#N/D`.
- No arquivo `.xlsx` a fórmula é gravada como **matriz dinâmica** (atributo `cm` + metadados), senão o Excel antigo mostra `@` e perde o derrame.
- Constantes de matriz: `{1;2;3}` (colunas separadas por `;` e linhas por `\` na região pt-BR; `,` e `;` na en-US).

Dados dos exemplos (A1:B5): `Ana 30 | Bia 25 | Caio 30 | Dani 20 | Eli 25`.

---

## Gerar

**SEQUÊNCIA (SEQUENCE)** ❌ · `=SEQUÊNCIA(linhas; [colunas]; [início]; [passo])` · `=SEQUÊNCIA(3)` → `1;2;3` (3 linhas) · `=SEQUÊNCIA(2; 3; 10; 5)` → `10 15 20 / 25 30 35`.
**MATRIZALEATÓRIA (RANDARRAY)** ❌ · `=MATRIZALEATÓRIA([linhas]; [colunas]; [mín]; [máx]; [inteiro])` · volátil. `=MATRIZALEATÓRIA(2; 2; 1; 6; VERDADEIRO)` → 2×2 de inteiros 1–6.

## Filtrar, ordenar, únicos

**FILTRO (FILTER)** ❌ · `=FILTRO(matriz; incluir; [se_vazio])` · `incluir` é matriz lógica de mesma altura (ou largura). Nenhum resultado e sem `se_vazio` → `#CALC!`.
`=FILTRO(A1:B5; B1:B5=30)` → `Ana 30 / Caio 30` · `=FILTRO(A1:B5; B1:B5>99; "nenhum")` → `nenhum`.
**CLASSIFICAR (SORT)** ❌ · `=CLASSIFICAR(matriz; [índice_ordem]; [ordem]; [por_col])` · ordem 1 crescente, −1 decrescente.
`=CLASSIFICAR(A1:B5; 2; -1)` → ordenado por idade decrescente (empates mantêm a ordem original: Ana, Caio, Bia, Eli, Dani).
**CLASSIFICARPOR (SORTBY)** ❌ · `=CLASSIFICARPOR(matriz; por_matriz1; [ordem1]; ...)` · `=CLASSIFICARPOR(A1:A5; B1:B5; -1; A1:A5; 1)` → `Ana Caio Bia Eli Dani`.
**ÚNICO (UNIQUE)** ❌ · `=ÚNICO(matriz; [por_col]; [exatamente_uma_vez])` · `=ÚNICO(B1:B5)` → `30;25;20` · `=ÚNICO(B1:B5; ; VERDADEIRO)` → `20` (aparece uma vez).
**CONT.ÚNICO:** use `=CONT.VALORES(ÚNICO(B1:B5))` → `3`.

## Combinar e reformatar

**EMPILHARV (VSTACK)** ❌ · `=EMPILHARV(A1:A2; A4:A5)` → 4 linhas. **EMPILHARH (HSTACK)** ❌ · lado a lado; alturas diferentes completam com `#N/D`.
**ESCOLHERCOLS (CHOOSECOLS)** ❌ · `=ESCOLHERCOLS(A1:B5; 2)` → só a coluna 2 (índice negativo conta do fim).
**ESCOLHERLINS (CHOOSEROWS)** ❌ · `=ESCOLHERLINS(A1:B5; 1; -1)` → 1ª e última linhas.
**TOMAR (TAKE)** ❌ · `=TOMAR(A1:B5; 2)` → 2 primeiras linhas · `=TOMAR(A1:B5; -2)` → 2 últimas · `=TOMAR(A1:B5; ; 1)` → 1ª coluna.
**DESCARTAR (DROP)** ❌ · `=DESCARTAR(A1:B5; 3)` → remove as 3 primeiras linhas.
**EXPANDIR (EXPAND)** ❌ · `=EXPANDIR(A1:B2; 3; 3; 0)` → 3×3 preenchendo o novo com `0`.
**QUEBRARLINS (WRAPROWS)** ❌ · `=QUEBRARLINS(SEQUÊNCIA(6); 3)` → 2 linhas × 3 colunas. **QUEBRARCOLS (WRAPCOLS)** ❌.
**PARACOL / PARALIN (TOCOL / TOROW)** ❌ · matriz → uma coluna/linha; opção de ignorar vazios/erros.
**TRANSPOR (TRANSPOSE)** ❌ · ver [pesquisa](pesquisa-referencia.md).
**DIVIDIRTEXTO (TEXTSPLIT)** ❌ · ver [texto](texto.md).

## Procurar (modernas)

**PROCX (XLOOKUP)** e **CORRESPX (XMATCH)** ❌ · ver [pesquisa e referência](pesquisa-referencia.md).

## Funções com LAMBDA

**LET**, **LAMBDA**, **MAP (MAP)**, **REDUCE (REDUCE)**, **SCAN (SCAN)**, **BYROW (BYROW)**, **BYCOL (BYCOL)**, **MAKEARRAY (MAKEARRAY)** ❌ · ver [lógica](logica.md).
`=MAP(B1:B5; LAMBDA(x; x*2))` → `60;50;60;40;50`.

## Conversão e outras

**MATRIZ.PARA.TEXTO (ARRAYTOTEXT)** ❌ · `=MATRIZ.PARA.TEXTO(A1:B2)` → `Ana, 30, Bia, 25`.
**VALORPARATEXTO (VALUETOTEXT)** ❌ · `=VALORPARATEXTO("a"; 1)` → `"a"`.
**IMAGEM (IMAGE)** ❌ · `=IMAGEM("https://.../logo.png"; "logo")` → imagem na célula.
**Operador `#`** ❌ · `=SOMA(A1#)` soma toda a matriz derramada a partir de A1.
**Operador `@`** ❌ · interseção implícita: `=@A1:A5` devolve o valor da linha da fórmula.

## Funções de matriz antigas (Ctrl+Shift+Enter)

`MATRIZ.DETERM`, `MATRIZ.INVERSO`, `MATRIZ.MULT`, `MUNIT`, `TRANSPOR`, `FREQÜÊNCIA`, `PROJ.LIN`, `PROJ.LOG`, `TENDÊNCIA`, `CRESCIMENTO` devolvem matriz; no Excel antigo precisavam de seleção prévia e `{=...}` (fórmula de matriz legada).

---

## Resumo de status

0 implementadas. **O que o motor precisa:** (1) valor "matriz" no avaliador (hoje `Operando` é número, texto, lógico, vazio ou erro); (2) derrame nas células vizinhas e `#DERRAMAR!`; (3) operações elemento a elemento; (4) gravar como matriz dinâmica no `.xlsx`. Ordem sugerida: `SEQUÊNCIA`, `ÚNICO`, `FILTRO`, `CLASSIFICAR`, `EMPILHARV/H`, `TOMAR/DESCARTAR`.
