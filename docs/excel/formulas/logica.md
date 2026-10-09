# Lógica

Especificação para recriar cada função. Formato: **NOME_PT (NOME_EN)** · `sintaxe` · regra · exemplo → resultado.
Marca: ✅ já no mdOffice · ⚠️ diverge · ❌ falta. Veja o [índice](README.md).

Regras gerais: `VERDADEIRO`/`FALSO` são valores lógicos (VERDADEIRO=1, FALSO=0 em contas). Número ≠ 0 é verdadeiro; texto não numérico em teste lógico → `#VALOR!`. Operadores de comparação (`=`, `<>`, `<`, `>`, `<=`, `>=`) devolvem lógico; comparar texto ignora maiúsculas/minúsculas.

---

**SE (IF)** ✅ · `=SE(teste; valor_se_verdadeiro; [valor_se_falso])` · sem o 3º argumento e teste falso devolve `FALSO`; até 64 níveis aninhados.
`=SE(A1>10; "alto"; "baixo")` com A1=15 → `alto` · `=SE(A1>10; "alto")` com A1=5 → `FALSO`.

**E (AND)** ✅ · `=E(lógico1; [lógico2]; ...)` · verdadeiro se todos forem; aceita faixas (texto e vazios ignorados).
`=E(A1>0; A1<10)` com A1=5 → `VERDADEIRO`.

**OU (OR)** ✅ · verdadeiro se algum for. `=OU(A1<0; A1>10)` com A1=5 → `FALSO`.

**NÃO (NOT)** ✅ · `=NÃO(A1>3)` com A1=5 → `FALSO`.

**XOU (XOR)** ❌ · verdadeiro se um número ímpar de argumentos for verdadeiro.
`=XOU(VERDADEIRO; VERDADEIRO)` → `FALSO` · `=XOU(VERDADEIRO; FALSO; FALSO)` → `VERDADEIRO`.

**VERDADEIRO (TRUE)** ❌ · `=VERDADEIRO()` → `VERDADEIRO`.
**FALSO (FALSE)** ❌ · `=FALSO()` → `FALSO`.

**SEERRO (IFERROR)** ❌ · `=SEERRO(valor; valor_se_erro)` · captura qualquer erro (`#N/D`, `#DIV/0!`…).
`=SEERRO(10/0; "n/a")` → `n/a` · `=SEERRO(10/2; "n/a")` → `5`.

**SENÃODISP (IFNA)** ❌ · só captura `#N/D`. `=SENÃODISP(PROCV("z"; A1:B3; 2; 0); "não achou")` → `não achou`.

**SES (IFS)** ❌ · `=SES(teste1; valor1; [teste2; valor2]...)` · devolve o valor do primeiro teste verdadeiro; nenhum → `#N/D` (use `VERDADEIRO` como último teste para o "senão").
`=SES(A1>=9; "A"; A1>=7; "B"; VERDADEIRO; "C")` com A1=8 → `B`.

**ESCOLHER (CHOOSE)** ❌ · `=ESCOLHER(índice; valor1; [valor2]...)` · índice começa em 1; fora do intervalo → `#VALOR!`.
`=ESCOLHER(2; "a"; "b"; "c")` → `b`.

**PARÂMETRO (SWITCH)** ❌ · `=PARÂMETRO(expressão; valor1; resultado1; [valor2; resultado2]...; [padrão])` · sem correspondência e sem padrão → `#N/D`.
`=PARÂMETRO(A1; 1; "um"; 2; "dois"; "outro")` com A1=2 → `dois`.

**LET (LET)** ❌ · `=LET(nome1; valor1; [nome2; valor2]...; cálculo)` · nomeia valores dentro da fórmula (escopo local).
`=LET(x; 3; y; 4; RAIZ(x^2+y^2))` → `5`.

**LAMBDA (LAMBDA)** ❌ · `=LAMBDA(parâmetro1; ...; cálculo)` · função anônima; chamada com `(…)` logo após: `=LAMBDA(x; x*2)(5)` → `10`.
**MAP (MAP)**, **REDUCE (REDUCE)**, **SCAN (SCAN)**, **BYROW (BYROW)**, **BYCOL (BYCOL)**, **MAKEARRAY (MAKEARRAY)** ❌ · aplicam uma LAMBDA a cada elemento/linha/coluna; dependem de [matrizes dinâmicas](matrizes-dinamicas.md).
`=REDUCE(0; A1:A3; LAMBDA(acc; v; acc+v))` com 1,2,3 → `6`.

---

## Resumo de status

✅ 4 (`SE`, `E`, `OU`, `NÃO`) · o resto ❌. Ordem sugerida: `SEERRO`, `SES`, `ESCOLHER`, `PARÂMETRO`, `XOU`, depois `LET`/`LAMBDA` (exigem variáveis locais no avaliador).
