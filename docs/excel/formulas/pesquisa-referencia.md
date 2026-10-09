# Pesquisa e referência

Especificação para recriar cada função. Formato: **NOME_PT (NOME_EN)** · `sintaxe` · regra · exemplo → resultado.
Marca: ✅ já no mdOffice · ⚠️ diverge · ❌ falta. Veja o [índice](README.md).

**Nenhuma função desta categoria existe no mdOffice ainda.** É o maior bloco que falta e o que mais pesa em planilhas reais. Pré-requisitos no motor: erro `#N/D`, referências entre abas (`Plan2!A1`), e funções que devolvem **referência** (não só valor) como `ÍNDICE`, `DESLOC`, `INDIRETO`.

Tabela usada nos exemplos (A1:C4):

| | A | B | C |
|---|---|---|---|
| 1 | Código | Produto | Preço |
| 2 | 10 | Caneta | 3,5 |
| 3 | 20 | Lápis | 2 |
| 4 | 30 | Borracha | 1,5 |

---

## Procurar valores

**PROCV (VLOOKUP)** ❌ · `=PROCV(valor_procurado; matriz_tabela; núm_índice_coluna; [procurar_intervalo])` · procura na **1ª coluna** e devolve da coluna `núm_índice`. 4º argumento `FALSO`/0 = correspondência exata; `VERDADEIRO`/omitido = aproximada (exige 1ª coluna **ordenada crescente**; devolve o maior valor ≤ procurado). Aceita `?` e `*` na exata. Não achou → `#N/D`; índice > nº de colunas → `#REF!`; índice < 1 → `#VALOR!`.
`=PROCV(20; A1:C4; 2; FALSO)` → `Lápis` · `=PROCV(25; A2:C4; 3; VERDADEIRO)` → `2` · `=PROCV(99; A2:C4; 2; FALSO)` → `#N/D`.

**PROCH (HLOOKUP)** ❌ · igual, na horizontal: procura na 1ª **linha**. `=PROCH("Preço"; A1:C4; 2; FALSO)` → `3,5`.

**PROCX (XLOOKUP)** ❌ · `=PROCX(valor; matriz_procura; matriz_retorno; [se_não_encontrado]; [modo_correspondência]; [modo_pesquisa])` · modo_correspondência: 0 exata (padrão), −1 exata ou próximo menor, 1 exata ou próximo maior, 2 curinga. modo_pesquisa: 1 início→fim, −1 fim→início, 2/−2 binária. Devolve valor, linha ou coluna inteira.
`=PROCX(20; A2:A4; B2:B4)` → `Lápis` · `=PROCX(99; A2:A4; B2:B4; "n/d")` → `n/d` · `=PROCX(25; A2:A4; B2:B4; ; -1)` → `Lápis`.

**CORRESP (MATCH)** ❌ · `=CORRESP(valor; matriz; [tipo])` · posição relativa. Tipo 1 (padrão): maior ≤ valor, matriz crescente; 0 exata (aceita curingas); −1: menor ≥ valor, matriz decrescente. Não achou → `#N/D`.
`=CORRESP(30; A2:A4; 0)` → `3` · `=CORRESP(25; A2:A4; 1)` → `2`.

**CORRESPX (XMATCH)** ❌ · `=CORRESPX(valor; matriz; [modo_correspondência]; [modo_pesquisa])` · como PROCX, só a posição. `=CORRESPX(20; A2:A4)` → `2`.

**ÍNDICE (INDEX)** ❌ · forma matriz `=ÍNDICE(matriz; núm_linha; [núm_coluna])` e forma referência `=ÍNDICE(ref; linha; [coluna]; [núm_área])` · linha 0 = coluna inteira; coluna 0 = linha inteira; fora → `#REF!`. Devolve **referência** (pode ser usada em `SOMA(ÍNDICE(...):ÍNDICE(...))`).
`=ÍNDICE(A1:C4; 3; 2)` → `Lápis` · `=ÍNDICE(B2:B4; 2)` → `Lápis`.
Combinação clássica: `=ÍNDICE(B2:B4; CORRESP(30; A2:A4; 0))` → `Borracha`.

**PROC (LOOKUP)** ❌ · `=PROC(valor; vetor_proc; [vetor_result])` · aproximada, vetor ordenado. `=PROC(25; A2:A4; B2:B4)` → `Lápis`.

---

## Posição e dimensões

**LIN (ROW)** ❌ · `=LIN([ref])` · sem argumento: linha da própria célula. `=LIN(C4)` → `4`.
**COL (COLUMN)** ❌ · `=COL(C4)` → `3`.
**LINS (ROWS)** ❌ · `=LINS(A1:C4)` → `4`. **COLS (COLUMNS)** ❌ · `=COLS(A1:C4)` → `3`.
**ÁREAS (AREAS)** ❌ · quantas áreas há na referência. `=ÁREAS((A1:A2;C1:C2))` → `2`.
**ENDEREÇO (ADDRESS)** ❌ · `=ENDEREÇO(linha; col; [abs]; [a1]; [aba])` · abs 1 `$A$1`, 2 `A$1`, 3 `$A1`, 4 `A1`. `=ENDEREÇO(2; 3)` → `$C$2` · `=ENDEREÇO(2; 3; 4)` → `C2` · `=ENDEREÇO(2; 3; 1; 1; "Plan2")` → `Plan2!$C$2`.

---

## Referências dinâmicas

**DESLOC (OFFSET)** ❌ (volátil) · `=DESLOC(ref; linhas; colunas; [altura]; [largura])` · devolve um intervalo deslocado. `=DESLOC(A1; 2; 1)` → `Lápis` · `=SOMA(DESLOC(C1; 1; 0; 3; 1))` → `7`.
**INDIRETO (INDIRECT)** ❌ (volátil) · texto → referência. `=INDIRETO("B"&3)` → `Lápis` · `=INDIRETO("Plan2!A1")`. Estilo L1C1 com segundo argumento FALSO.
**ESCOLHER (CHOOSE)** ❌ · ver [lógica](logica.md). `=ESCOLHER(2; A2; A3; A4)` → `20`.
**TRANSPOR (TRANSPOSE)** ❌ · troca linhas por colunas (matriz). `=TRANSPOR(A1:C1)` → 3 linhas × 1 coluna.
**FÓRMULATEXTO (FORMULATEXT)** ❌ · `=FÓRMULATEXTO(C2)` com C2 `=B2*2` → `=B2*2`.
**HYPERLINK (HYPERLINK)** ❌ · `=HYPERLINK("https://exemplo.com"; "abrir")` → célula clicável com texto `abrir`.
**DADOSDINÂMICOS (GETPIVOTDATA)** ❌ · lê valor de tabela dinâmica. **RTD (RTD)** ❌ · dados em tempo real via COM.

---

## Funções de matriz (Excel 365)

Detalhes em [matrizes-dinamicas.md](matrizes-dinamicas.md): `FILTRO`, `CLASSIFICAR`, `ÚNICO`, `SEQUÊNCIA`, `EMPILHARV (VSTACK)`, `EMPILHARH (HSTACK)`, `ESCOLHERCOLS (CHOOSECOLS)`, `ESCOLHERLINS (CHOOSEROWS)`, `TOMAR (TAKE)`, `DESCARTAR (DROP)`, `EXPANDIR (EXPAND)`, `QUEBRARLINS (WRAPROWS)`, `QUEBRARCOLS (WRAPCOLS)`, `PARACOL (TOCOL)`, `PARALIN (TOROW)`.

---

## Resumo de status

0 implementadas. Ordem sugerida: `#N/D` e referências entre abas → `ÍNDICE` + `CORRESP`, `PROCV`, `PROCX` → `LIN`, `COL`, `LINS`, `COLS`, `ESCOLHER` → `DESLOC`, `INDIRETO` → matrizes.
