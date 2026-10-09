# Informação

Especificação para recriar cada função. Formato: **NOME_PT (NOME_EN)** · `sintaxe` · regra · exemplo → resultado.
Marca: ✅ já no mdOffice · ⚠️ diverge · ❌ falta. Veja o [índice](README.md).

Regras gerais: as funções `É...` (IS...) **recebem o erro como argumento** em vez de propagá-lo, e sempre devolvem lógico.

---

## Testes de tipo

**ÉCÉL.VAZIA (ISBLANK)** ⚠️ · `=ÉCÉL.VAZIA(valor)` · verdadeiro só para célula realmente vazia (`""` vindo de fórmula não conta). No mdOffice o nome é `VAZIO`/`ISBLANK`.
`=ÉCÉL.VAZIA(A1)` com A1 vazia → `VERDADEIRO` · com A1=`""` por fórmula → `FALSO`.
**ÉNÚM (ISNUMBER)** ✅ (mdOffice: `É.NÚMERO`) · data e hora também são número. `=ÉNÚM(5)` → `VERDADEIRO` · `=ÉNÚM("5")` → `FALSO`.
**ÉTEXTO (ISTEXT)** ❌ · `=ÉTEXTO("a")` → `VERDADEIRO`.
**ÉNÃO.TEXTO (ISNONTEXT)** ❌ · célula vazia conta como não texto. `=ÉNÃO.TEXTO(A1)` com A1 vazia → `VERDADEIRO`.
**ÉLÓGICO (ISLOGICAL)** ❌ · `=ÉLÓGICO(VERDADEIRO)` → `VERDADEIRO`.
**ÉERRO (ISERROR)** ✅ · qualquer erro. `=ÉERRO(1/0)` → `VERDADEIRO`.
**ÉERROS (ISERR)** ❌ · qualquer erro **menos** `#N/D`. `=ÉERROS(NÃO.DISP())` → `FALSO`.
**É.NÃO.DISP (ISNA)** ❌ · só `#N/D`. `=É.NÃO.DISP(NÃO.DISP())` → `VERDADEIRO`.
**ÉPAR (ISEVEN) / ÉIMPAR (ISODD)** ❌ · trunca decimais; texto → `#VALOR!`. `=ÉPAR(4)` → `VERDADEIRO` · `=ÉIMPAR(4)` → `FALSO`.
**ÉREF (ISREF)** ❌ · verdadeiro se for referência. `=ÉREF(A1)` → `VERDADEIRO` · `=ÉREF("A1")` → `FALSO`.
**ÉFÓRMULA (ISFORMULA)** ❌ · `=ÉFÓRMULA(A1)` com A1 `=1+1` → `VERDADEIRO`.

---

## Tipos e conversões

**TIPO (TYPE)** ❌ · 1 número, 2 texto, 4 lógico, 16 erro, 64 matriz. `=TIPO("a")` → `2` · `=TIPO(1/0)` → `16`.
**TIPO.ERRO (ERROR.TYPE)** ❌ · `#NULO!`=1, `#DIV/0!`=2, `#VALOR!`=3, `#REF!`=4, `#NOME?`=5, `#NÚM!`=6, `#N/D`=7, `#OBTENDO_DADOS`=8, `#DERRAMAR!`=9, `#CALC!`=14; sem erro → `#N/D`. `=TIPO.ERRO(1/0)` → `2`.
**N (N)** ❌ · número → ele; data → série; VERDADEIRO → 1; texto → 0. `=N(VERDADEIRO)` → `1` · `=N("a")` → `0`.
**NÃO.DISP (NA)** ❌ · gera `#N/D`. `=NÃO.DISP()` → `#N/D`.

---

## Célula e ambiente

**CÉL (CELL)** ❌ · `=CÉL(tipo_info; [ref])` · `"endereço"` → `$A$1` · `"col"` → número da coluna · `"linha"` · `"conteúdo"` · `"tipo"` (`b` vazio, `l` texto, `v` valor) · `"formato"` · `"largura"` · `"nomearq"` · `"cor"` · `"parênteses"` · `"prefixo"` · `"proteger"`.
`=CÉL("endereço"; B3)` → `$B$3`.
**INFORMAÇÃO (INFO)** ❌ · `=INFORMAÇÃO("sistema")` → `pcdos`; também `"versãosis"`, `"númarquivo"`, `"diretório"`, `"origem"`, `"recalc"`.
**PLAN (SHEET)** ❌ · número da aba. `=PLAN()` na 2ª aba → `2`.
**PLANS (SHEETS)** ❌ · quantidade de abas (ou de abas de uma referência 3D). `=PLANS()` → total.
**LIN (ROW) / COL (COLUMN) / LINS (ROWS) / COLS (COLUMNS)** ❌ · ver [pesquisa e referência](pesquisa-referencia.md).

---

## Resumo de status

✅ 2 (`ÉERRO`, `É.NÚMERO`) · ⚠️ 1 (`VAZIO`, nome oficial é `ÉCÉL.VAZIA`) · o resto ❌. Ordem sugerida: `ÉCÉL.VAZIA`, `ÉTEXTO`, `ÉNÃO.TEXTO`, `ÉLÓGICO`, `NÃO.DISP`, `É.NÃO.DISP` (junto com o erro `#N/D`), `TIPO`, `N`, depois o resto.
