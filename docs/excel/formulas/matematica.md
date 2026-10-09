# Matemática e trigonometria

Especificação para recriar cada função. Formato: **NOME_PT (NOME_EN)** · `sintaxe` · regra · exemplo → resultado.
Marca no fim: ✅ já no mdOffice · ⚠️ existe mas diverge · ❌ falta. Separador de argumentos em português: `;`. Veja o [índice](README.md).

Regras gerais: texto numérico (`"5"`) é convertido em número nos argumentos escalares; em faixas, texto e vazios são ignorados; lógicos escritos direto contam (`VERDADEIRO`=1). Erro em qualquer argumento propaga o erro.

---

## Somas e produtos

**SOMA (SUM)** ✅ · `=SOMA(núm1; [núm2]; ...)` · soma números e faixas (até 255 argumentos).
`=SOMA(10; 2,5; 7)` → `19,5` · `=SOMA(A1:A3)` com 10, 2,5, 7 → `19,5`.

**SOMASE (SUMIF)** ✅ · `=SOMASE(intervalo; critério; [intervalo_soma])` · soma as células que cumprem o critério. Critérios: `">5"`, `"<>0"`, `"maçã"`, curingas `*` e `?`.
`=SOMASE(A1:A4; ">5")` com 3, 8, 10, 1 → `18` · `=SOMASE(A1:A3; "x"; B1:B3)` com A=x,y,x e B=1,2,3 → `4`.

**SOMASES (SUMIFS)** ❌ · `=SOMASES(intervalo_soma; intervalo1; critério1; [intervalo2; critério2]...)` · todos os critérios (E).
`=SOMASES(C1:C4; A1:A4; "x"; B1:B4; ">1")` com A=x,x,y,x B=1,2,3,4 C=10,20,30,40 → `60`.

**PROD (PRODUCT)** ✅ · `=PROD(núm1; [núm2]; ...)` · multiplica.
`=PROD(2; 3; 4)` → `24`.

**SOMARPRODUTO (SUMPRODUCT)** ❌ · `=SOMARPRODUTO(matriz1; [matriz2]; ...)` · soma dos produtos elemento a elemento; as matrizes precisam ter o mesmo tamanho (senão `#VALOR!`); não numéricos valem 0.
`=SOMARPRODUTO(A1:A3; B1:B3)` com A=1,2,3 B=4,5,6 → `32`.

**SOMAQUAD (SUMSQ)** ❌ · `=SOMAQUAD(núm1; ...)` · soma dos quadrados.
`=SOMAQUAD(3; 4)` → `25`.

**SOMAX2DY2 (SUMX2PY2)** ❌ · `=SOMAX2DY2(matriz_x; matriz_y)` · Σ(x²+y²). `=SOMAX2DY2(A1:A2; B1:B2)` com A=1,2 e B=3,4 → `30`.
**SOMAX2SY2 (SUMX2MY2)** ❌ · Σ(x²−y²). `=SOMAX2SY2(A1:A2; B1:B2)` com A=3,4 e B=1,2 → `20`.
**SOMAXMY2 (SUMXMY2)** ❌ · Σ(x−y)². `=SOMAXMY2(A1:A2; B1:B2)` com A=3,4 e B=1,2 → `8`.

**SUBTOTAL (SUBTOTAL)** ❌ · `=SUBTOTAL(núm_função; ref1; [ref2]...)` · 1–11 inclui linhas ocultas manualmente; 101–111 as ignora. Códigos: 1 MÉDIA, 2 CONT.NÚM, 3 CONT.VALORES, 4 MÁX, 5 MÍN, 6 MULT, 7 DESVPAD, 8 DESVPADP, 9 SOMA, 10 VAR, 11 VARP. Ignora outros SUBTOTAL dentro da faixa.
`=SUBTOTAL(9; A1:A5)` com 1..5 → `15`.

**AGREGAR (AGGREGATE)** ❌ · `=AGREGAR(núm_função; opções; ref1; [ref2])` · como SUBTOTAL com 19 funções e opções (0–7) para ignorar ocultas, erros e SUBTOTAL.
`=AGREGAR(9; 6; A1:A4)` com 1, #DIV/0!, 3, 4 → `8`.

---

## Arredondamento

**ARRED (ROUND)** ✅ · `=ARRED(núm; núm_dígitos)` · arredonda (meio sempre se afasta do zero). Dígitos negativos arredondam à esquerda da vírgula.
`=ARRED(2,345; 2)` → `2,35` · `=ARRED(-2,5; 0)` → `-3` · `=ARRED(1234; -2)` → `1200`.

**ARREDONDAR.PARA.CIMA (ROUNDUP)** ⚠️ · `=ARREDONDAR.PARA.CIMA(núm; núm_dígitos)` · sempre se afasta do zero. (mdOffice ignora os dígitos.)
`=ARREDONDAR.PARA.CIMA(3,141; 2)` → `3,15` · `=ARREDONDAR.PARA.CIMA(-3,1; 0)` → `-4`.

**ARREDONDAR.PARA.BAIXO (ROUNDDOWN)** ⚠️ · idem, em direção ao zero (trunca).
`=ARREDONDAR.PARA.BAIXO(3,999; 2)` → `3,99` · `=ARREDONDAR.PARA.BAIXO(-3,9; 0)` → `-3`.

**TRUNCAR (TRUNC)** ❌ · `=TRUNCAR(núm; [núm_dígitos])` · corta casas (padrão 0).
`=TRUNCAR(8,9)` → `8` · `=TRUNCAR(-8,9)` → `-8` · `=TRUNCAR(3,14159; 3)` → `3,141`.

**INT (INT)** ✅ · `=INT(núm)` · arredonda para baixo até o inteiro (−3,2 → −4).
`=INT(8,9)` → `8` · `=INT(-8,9)` → `-9`.

**TETO (CEILING)** ⚠️ · `=TETO(núm; significância)` · arredonda para cima até o múltiplo (sinais devem coincidir, senão `#NÚM!`).
`=TETO(2,5; 1)` → `3` · `=TETO(4,42; 0,05)` → `4,45`. (mdOffice: `CEILING` só faz teto inteiro.)

**ASSOALHO (FLOOR)** ⚠️ · `=ASSOALHO(núm; significância)` · para baixo até o múltiplo.
`=ASSOALHO(3,7; 2)` → `2` · `=ASSOALHO(4,42; 0,05)` → `4,4`.

**TETO.MAT (CEILING.MATH)** ❌ · `=TETO.MAT(núm; [significância]; [modo])` · negativos vão para zero por padrão (modo≠0 afasta do zero).
`=TETO.MAT(-5,5; 2)` → `-4` · `=TETO.MAT(-5,5; 2; 1)` → `-6`.
**ASSOALHO.MAT (FLOOR.MATH)** ❌ · `=ASSOALHO.MAT(-5,5; 2)` → `-6` · com modo 1 → `-4`.
**TETO.PRECISO (CEILING.PRECISE)** ❌ · sempre para cima: `=TETO.PRECISO(-4,3)` → `-4`.
**ASSOALHO.PRECISO (FLOOR.PRECISE)** ❌ · sempre para baixo: `=ASSOALHO.PRECISO(-4,3)` → `-5`.
**ISO.CEILING (ISO.CEILING)** ❌ · igual a TETO.PRECISO.

**MARRED (MROUND)** ❌ · `=MARRED(núm; múltiplo)` · arredonda ao múltiplo mais próximo (sinais iguais).
`=MARRED(10; 3)` → `9` · `=MARRED(1,3; 0,2)` → `1,4`.

**PAR (EVEN)** ❌ · `=PAR(núm)` · próximo inteiro par, afastando de zero. `=PAR(3)` → `4` · `=PAR(-1)` → `-2`.
**ÍMPAR (ODD)** ❌ · `=ÍMPAR(2)` → `3` · `=ÍMPAR(-2)` → `-3`.

---

## Resto, divisão, potências, raízes

**RESTO (MOD)** ✅ · `=RESTO(núm; divisor)` · resultado com o sinal do divisor; divisor 0 → `#DIV/0!`.
`=RESTO(10; 3)` → `1` · `=RESTO(-3; 2)` → `1` · `=RESTO(3; -2)` → `-1`.

**QUOCIENTE (QUOTIENT)** ❌ · `=QUOCIENTE(num; den)` · parte inteira truncada. `=QUOCIENTE(7; 2)` → `3` · `=QUOCIENTE(-7; 2)` → `-3`.

**ABS (ABS)** ✅ · `=ABS(-4,5)` → `4,5`.

**SINAL (SIGN)** ❌ · `=SINAL(-7)` → `-1` · `=SINAL(0)` → `0`.

**RAIZ (SQRT)** ✅ · `=RAIZ(16)` → `4` · `=RAIZ(-1)` → `#NÚM!`.
**RAIZPI (SQRTPI)** ❌ · √(núm·π). `=RAIZPI(2)` → `2,50662827463`.

**POTÊNCIA (POWER)** ✅ · `=POTÊNCIA(núm; potência)` ou `núm^potência`. `=POTÊNCIA(2; 10)` → `1024` · `=POTÊNCIA(9; 0,5)` → `3` · `=0^0` → `#NÚM!`.

**EXP (EXP)** ❌ · e^x. `=EXP(1)` → `2,71828182845905`.
**LN (LN)** ❌ · log natural; ≤0 → `#NÚM!`. `=LN(2,71828182845905)` → `1`.
**LOG (LOG)** ❌ · `=LOG(núm; [base])` · base padrão 10. `=LOG(8; 2)` → `3` · `=LOG(100)` → `2`.
**LOG10 (LOG10)** ❌ · `=LOG10(1000)` → `3`.

**FATORIAL (FACT)** ❌ · `=FATORIAL(5)` → `120` · `=FATORIAL(0)` → `1` · negativo → `#NÚM!` (decimais são truncados).
**FATDUPLO (FACTDOUBLE)** ❌ · `=FATDUPLO(7)` → `105` (7·5·3·1).

**MDC (GCD)** ❌ · `=MDC(24; 36)` → `12`. **MMC (LCM)** ❌ · `=MMC(4; 6)` → `12`.

**COMBIN (COMBIN)** ❌ · `=COMBIN(8; 2)` → `28`. **COMBINA (COMBINA)** ❌ · com repetição: `=COMBINA(4; 3)` → `20`.
**PERMUT (PERMUT)** ❌ · `=PERMUT(5; 2)` → `20`. **PERMUTAS (PERMUTATIONA)** ❌ · com repetição: `=PERMUTAS(3; 2)` → `9`.
**MULTINOMIAL (MULTINOMIAL)** ❌ · `=MULTINOMIAL(2; 3; 4)` → `1260`.

**PI (PI)** ✅ · `=PI()` → `3,14159265358979`.

**MATRIZ.DETERM (MDETERM)** ❌ · determinante de matriz quadrada. `=MATRIZ.DETERM(A1:B2)` com A1=1, B1=2, A2=3, B2=4 → `-2`.
**MATRIZ.INVERSO (MINVERSE)** ❌ · inversa (matriz singular → `#NÚM!`). Resultado é matriz (ver [matrizes](matrizes-dinamicas.md)).
**MATRIZ.MULT (MMULT)** ❌ · produto de matrizes (colunas da 1ª = linhas da 2ª).
**MUNIT (MUNIT)** ❌ · matriz identidade: `=MUNIT(2)` → 2×2 com 1 na diagonal e 0 fora.

**ALEATÓRIO (RAND)** ❌ · `=ALEATÓRIO()` → decimal em [0;1), recalcula sempre (volátil).
**ALEATÓRIOENTRE (RANDBETWEEN)** ❌ · `=ALEATÓRIOENTRE(1; 6)` → inteiro 1–6 (volátil).
**MATRIZALEATÓRIA (RANDARRAY)** ❌ · ver [matrizes](matrizes-dinamicas.md).

**BASE (BASE)** ❌ · `=BASE(255; 16; [comprimento_mín])` → `FF` · `=BASE(5; 2; 8)` → `00000101`.
**DECIMAL (DECIMAL)** ❌ · `=DECIMAL("FF"; 16)` → `255`.
**ROMANO (ROMAN)** ❌ · `=ROMANO(1994)` → `MCMXCIV`.
**ARÁBICO (ARABIC)** ❌ · `=ARÁBICO("MCMXCIV")` → `1994`.

---

## Trigonometria (ângulos em radianos)

**SEN (SIN)** ❌ · `=SEN(PI()/2)` → `1`.  **COS (COS)** ❌ · `=COS(0)` → `1`.  **TAN (TAN)** ❌ · `=TAN(PI()/4)` → `1` (≈0,9999999999999999).
**ASEN (ASIN)** ❌ · `=ASEN(1)` → `1,5707963267949` (|x|>1 → `#NÚM!`).
**ACOS (ACOS)** ❌ · `=ACOS(0)` → `1,5707963267949`.
**ATAN (ATAN)** ❌ · `=ATAN(1)` → `0,785398163397448`.
**ATAN2 (ATAN2)** ❌ · `=ATAN2(x; y)` (atenção: x primeiro) · `=ATAN2(1; 1)` → `0,785398163397448`.
**SEC (SEC)**, **CSC (CSC)**, **COT (COT)** ❌ · 1/cos, 1/sen, 1/tan. `=SEC(0)` → `1`.
**ASEC**, **ACSC**, **ACOT (ACOT)** ❌ · `=ACOT(1)` → `0,785398163397448`.
**SENH (SINH)**, **COSH (COSH)**, **TANH (TANH)** ❌ · `=COSH(0)` → `1`.
**ASENH (ASINH)**, **ACOSH (ACOSH)**, **ATANH (ATANH)** ❌ · `=ACOSH(1)` → `0`.
**SECH**, **CSCH**, **COTH**, **ACOTH** ❌ · hiperbólicas derivadas.
**GRAUS (DEGREES)** ❌ · `=GRAUS(PI())` → `180`. **RADIANOS (RADIANS)** ❌ · `=RADIANOS(180)` → `3,14159265358979`.

---

## Resumo de status

✅ 10 · ⚠️ 4 (`ARREDONDAR.PARA.CIMA/BAIXO`, `TETO`, `ASSOALHO`) · ❌ o resto. Ordem sugerida: `SOMASES`, `TRUNCAR`, `SINAL`, `EXP/LN/LOG`, corrigir arredondamentos e `TETO/ASSOALHO`, `SOMARPRODUTO`, `SUBTOTAL`, trigonometria.
