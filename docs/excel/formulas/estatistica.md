# Estatística

Especificação para recriar cada função. Formato: **NOME_PT (NOME_EN)** · `sintaxe` · regra · exemplo → resultado.
Marca: ✅ já no mdOffice · ⚠️ diverge · ❌ falta. Veja o [índice](README.md).

Regras gerais: nas funções de faixa, **texto, lógicos e vazios dentro de faixas são ignorados** (nas versões com `A` no fim, como MÉDIAA, texto vale 0 e VERDADEIRO vale 1). Argumentos escritos direto aceitam número, lógico e texto numérico. Exemplos usam A1:A5 = 2, 4, 4, 6, 9 salvo indicação.

---

## Contagem

**CONT.NÚM (COUNT)** ✅ · `=CONT.NÚM(valor1; [valor2]; ...)` · conta números (e datas).
`=CONT.NÚM(A1:A5)` → `5` · `=CONT.NÚM(1; "a"; 3)` → `2`.

**CONT.VALORES (COUNTA)** ✅ · conta células não vazias (inclui texto, erros, `""` vindo de fórmula).
`=CONT.VALORES(A1:A5)` → `5`.

**CONTAR.VAZIO (COUNTBLANK)** ❌ · conta vazias e `""`.
`=CONTAR.VAZIO(B1:B5)` com B1 e B3 vazias → `2`.

**CONT.SE (COUNTIF)** ✅ · `=CONT.SE(intervalo; critério)` · critério: valor, `">4"`, `"<>"` (não vazio), `"a*"`, `"?b"`.
`=CONT.SE(A1:A5; 4)` → `2` · `=CONT.SE(A1:A5; ">4")` → `2`.

**CONT.SES (COUNTIFS)** ❌ · `=CONT.SES(int1; crit1; [int2; crit2]...)` · todos os critérios; faixas do mesmo tamanho.
`=CONT.SES(A1:A5; ">2"; A1:A5; "<9")` → `3`.

---

## Médias e extremos

**MÉDIA (AVERAGE)** ✅ · `=MÉDIA(núm1; ...)` · soma/quantidade de números; nenhum número → `#DIV/0!`.
`=MÉDIA(A1:A5)` → `5` · `=MÉDIA(2; 4)` → `3`.

**MÉDIAA (AVERAGEA)** ❌ · texto conta 0, VERDADEIRO 1. com A1=2, A2="x", A3=4: `=MÉDIAA(A1:A3)` → `2` (texto vale 0).

**MÉDIASE (AVERAGEIF)** ❌ · `=MÉDIASE(intervalo; critério; [intervalo_média])`.
`=MÉDIASE(A1:A5; ">3")` → `5,75`.

**MÉDIASES (AVERAGEIFS)** ❌ · `=MÉDIASES(int_média; int1; crit1; ...)` · `#DIV/0!` se nada cumpre.

**MÁXIMO (MAX)** ✅ (mdOffice grafa `MÁX`) · maior número; sem números → `0`.
`=MÁXIMO(A1:A5)` → `9`.

**MÍNIMO (MIN)** ✅ (`MÍN`) · `=MÍNIMO(A1:A5)` → `2`.

**MÁXIMOA (MAXA)** / **MÍNIMOA (MINA)** ❌ · incluem texto (0) e lógicos.

**MÁXIMOSES (MAXIFS)** ❌ · `=MÁXIMOSES(int_máx; int1; crit1; ...)` · `=MÁXIMOSES(A1:A5; A1:A5; "<9")` → `6`.
**MÍNIMOSES (MINIFS)** ❌ · `=MÍNIMOSES(A1:A5; A1:A5; ">2")` → `4`.

**MAIOR (LARGE)** ❌ · `=MAIOR(matriz; k)` · k-ésimo maior (k=1 é o máximo); k fora do intervalo → `#NÚM!`.
`=MAIOR(A1:A5; 2)` → `6`.
**MENOR (SMALL)** ❌ · `=MENOR(A1:A5; 2)` → `4`.

**MED (MEDIAN)** ✅ · mediana. `=MED(A1:A5)` → `4` · `=MED(1; 2; 3; 4)` → `2,5`.

**MODO (MODE)** / **MODO.ÚNICO (MODE.SNGL)** ❌ · valor mais frequente (primeiro em caso de empate); sem repetição → `#N/D`.
`=MODO(A1:A5)` → `4`.
**MODO.MULT (MODE.MULT)** ❌ · matriz com todas as modas.

**MÉDIA.GEOMÉTRICA (GEOMEAN)** ❌ · `=MÉDIA.GEOMÉTRICA(4; 9)` → `6`.
**MÉDIA.HARMÔNICA (HARMEAN)** ❌ · `=MÉDIA.HARMÔNICA(1; 4; 4)` → `2`.
**MÉDIA.INTERNA (TRIMMEAN)** ❌ · `=MÉDIA.INTERNA(matriz; porcentagem)` · descarta a % total de pontos nas pontas.
`=MÉDIA.INTERNA(A1:A5; 0,4)` → `4,66666666666667`.

---

## Dispersão e forma

**DESVPAD (STDEV)** ✅ · desvio padrão da amostra (n−1); precisa de ≥2 números.
`=DESVPAD(A1:A5)` → `2,64575131106459` (√7).
**DESVPAD.A (STDEV.S)** ❌ · igual a DESVPAD. **DESVPAD.P / DESVPADP (STDEV.P / STDEVP)** ✅(`DESVPADP`) · população (n).
`=DESVPADP(A1:A5)` → `2,36643191323985` (√5,6).
**DESVPADA (STDEVA)** / **DESVPADPA (STDEVPA)** ❌ · versões com texto/lógicos.

**VAR.A (VAR.S) / VAR (VAR)** ❌ · variância da amostra. `=VAR.A(A1:A5)` → `7`.
**VAR.P / VARP (VAR.P / VARP)** ❌ · da população. `=VAR.P(A1:A5)` → `5,6`.
**VARA (VARA)** / **VARPA (VARPA)** ❌.

**DESV.MÉDIO (AVEDEV)** ❌ · média dos desvios absolutos. `=DESV.MÉDIO(A1:A5)` → `2`.
**DESVQ (DEVSQ)** ❌ · soma dos quadrados dos desvios. `=DESVQ(A1:A5)` → `28`.

**DISTORÇÃO (SKEW)** ❌ · assimetria (≥3 pontos). **DISTORÇÃO.P (SKEW.P)** ❌.
**CURT (KURT)** ❌ · curtose (≥4 pontos).

---

## Posição relativa e ranking

**ORDEM.EQ / ORDEM (RANK.EQ / RANK)** ❌ · `=ORDEM.EQ(núm; ref; [ordem])` · ordem 0/omitida = decrescente (maior é 1); empates recebem a mesma posição.
`=ORDEM.EQ(4; A1:A5)` → `3`.
**ORDEM.MÉD (RANK.AVG)** ❌ · empates recebem a média das posições. `=ORDEM.MÉD(4; A1:A5)` → `3,5`.

**QUARTIL.INC / QUARTIL (QUARTILE.INC / QUARTILE)** ❌ · `=QUARTIL.INC(matriz; quarto)` · 0 mín, 1, 2 mediana, 3, 4 máx; interpola em k=(n−1)·p+1.
`=QUARTIL.INC(A1:A5; 1)` → `4`. **QUARTIL.EXC (QUARTILE.EXC)** ❌ · exclui extremos: `=QUARTIL.EXC(A1:A5; 1)` → `3`.

**PERCENTIL.INC / PERCENTIL (PERCENTILE.INC)** ❌ · `=PERCENTIL.INC(A1:A5; 0,25)` → `4`. **PERCENTIL.EXC** ❌.

**ORDEM.PORCENTUAL.INC / ORDEM.PORCENTUAL (PERCENTRANK.INC)** ❌ · `=ORDEM.PORCENTUAL.INC(A1:A5; 6)` → `0,75`. **ORDEM.PORCENTUAL.EXC** ❌.

**FREQÜÊNCIA (FREQUENCY)** ❌ · `=FREQÜÊNCIA(dados; compartimentos)` · matriz com contagens (n+1 resultados).
Dados 1,2,3,4,5 e limites 2, 4 → `2; 2; 1`.

**PADRONIZAR (STANDARDIZE)** ❌ · `=PADRONIZAR(x; média; desvio)` · `=PADRONIZAR(42; 40; 1,5)` → `1,33333333333333`.

---

## Correlação e regressão

Usam duas faixas de mesmo tamanho: y em B1:B5 e x em A1:A5 nos exemplos abaixo (x=1..5, y=2,4,5,4,5).

**CORREL (CORREL)** ❌ · coeficiente de Pearson. `=CORREL(A1:A5; B1:B5)` → `0,774596669241483`.
**PEARSON (PEARSON)** ❌ · igual. **RQUAD (RSQ)** ❌ · quadrado: → `0,6`.
**COVAR / COVARIAÇÃO.P (COVARIANCE.P)** ❌ · população: → `1,2`. **COVARIAÇÃO.S (COVARIANCE.S)** ❌ · amostra: → `1,5`.
**INCLINAÇÃO (SLOPE)** ❌ · `=INCLINAÇÃO(B1:B5; A1:A5)` → `0,6`.
**INTERCEPÇÃO (INTERCEPT)** ❌ · `=INTERCEPÇÃO(B1:B5; A1:A5)` → `2,2`.
**EPADYX (STEYX)** ❌ · erro padrão da regressão: → `0,894427190999916`.
**PROJ.LIN (LINEST)** ❌ · `=PROJ.LIN(y; x; [const]; [estat])` · matriz [inclinação, intercepção…].
**PROJ.LOG (LOGEST)** ❌ · regressão exponencial.
**TENDÊNCIA (TREND)** ❌ · valores y de uma reta ajustada. `=TENDÊNCIA(B1:B5; A1:A5; 6)` → `5,8`.
**CRESCIMENTO (GROWTH)** ❌ · versão exponencial de TENDÊNCIA.
**PREVISÃO.LINEAR / PREVISÃO (FORECAST.LINEAR / FORECAST)** ❌ · `=PREVISÃO.LINEAR(6; B1:B5; A1:A5)` → `5,8`.
**PREVISÃO.ETS (FORECAST.ETS)** (e `.CONFINT`, `.SAZONALIDADE`, `.ESTATÍSTICA`) ❌ · suavização exponencial tripla (AAA).

---

## Distribuições de probabilidade

Convenção: a versão `.DIST` tem argumento `cumulativo` (VERDADEIRO = função de distribuição, FALSO = densidade/massa).

**DIST.NORM.N (NORM.DIST)** ❌ · `=DIST.NORM.N(x; média; desvpad; cumulativo)` · `=DIST.NORM.N(42; 40; 1,5; VERDADEIRO)` → `0,908788780274132`.
**INV.NORM.N (NORM.INV)** ❌ · `=INV.NORM.N(0,908789; 40; 1,5)` → `≈42`.
**DIST.NORMP.N (NORM.S.DIST)** ❌ · `=DIST.NORMP.N(1,333333; VERDADEIRO)` → `0,908788780274132`. **INV.NORMP.N (NORM.S.INV)** ❌ · `=INV.NORMP.N(0,975)` → `1,95996398454005`.
**DIST.LOGNORMAL.N / INV.LOGNORMAL (LOGNORM.DIST / LOGNORM.INV)** ❌.
**DIST.BINOM.N (BINOM.DIST)** ❌ · `=DIST.BINOM.N(6; 10; 0,5; FALSO)` → `0,205078125`.
**DIST.BINOM.INTERVALO (BINOM.DIST.RANGE)** ❌ · **INV.BINOM (BINOM.INV)** ❌ · **DIST.BINOM.NEG.N (NEGBINOM.DIST)** ❌.
**DIST.POISSON (POISSON.DIST)** ❌ · `=DIST.POISSON(2; 5; FALSO)` → `0,0842243...`.
**DIST.EXP.N (EXPON.DIST)** ❌ · `=DIST.EXP.N(0,2; 10; VERDADEIRO)` → `0,864664716763387`.
**DIST.GAMA.N / INV.GAMA / LNGAMA / LNGAMA.PRECISO / GAMA (GAMMA.DIST / GAMMA.INV / GAMMALN / GAMMALN.PRECISE / GAMMA)** ❌ · `=GAMA(5)` → `24`.
**DIST.BETA.N / INV.BETA.N (BETA.DIST / BETA.INV)** ❌.
**DIST.WEIBULL (WEIBULL.DIST)** ❌. **DIST.HIPERGEOM.N (HYPGEOM.DIST)** ❌.
**DIST.T / DIST.T.2C / DIST.T.CD / INV.T / INV.T.2C (T.DIST …)** ❌ · `=INV.T.2C(0,05; 10)` → `2,22813885198627`.
**DIST.QUIQUA / DIST.QUIQUA.CD / INV.QUIQUA / INV.QUIQUA.CD (CHISQ.DIST …)** ❌ · `=INV.QUIQUA.CD(0,05; 1)` → `3,84145882069413`.
**DIST.F / DIST.F.CD / INV.F / INV.F.CD (F.DIST …)** ❌.
**FISHER / FISHERINV (FISHER / FISHERINV)** ❌.
**PROB (PROB)** ❌ · soma de probabilidades num intervalo.
**GAUSS (GAUSS)** ❌ · `=GAUSS(2)` → `0,477249868051821`. **PHI (PHI)** ❌ · densidade normal padrão.

---

## Testes de hipótese e intervalos

**TESTE.T (T.TEST)** ❌ · `=TESTE.T(matriz1; matriz2; caudas; tipo)` · tipo 1 pareado, 2 variâncias iguais, 3 diferentes.
**TESTE.Z (Z.TEST)** ❌. **TESTE.F (F.TEST)** ❌. **TESTE.QUIQUA (CHISQ.TEST)** ❌.
**INT.CONFIANÇA.NORM (CONFIDENCE.NORM)** ❌ · `=INT.CONFIANÇA.NORM(0,05; 2,5; 50)` → `0,692952...`. **INT.CONFIANÇA.T (CONFIDENCE.T)** ❌.

---

## Funções antigas (compatibilidade)

Existem no Excel apenas por compatibilidade; o mdOffice deve aceitá-las como apelido da versão nova:
`DISTNORM`→DIST.NORM.N, `INV.NORM`→INV.NORM.N, `DISTT`→DIST.T.CD, `INVT`→INV.T.2C, `DISTF`, `INVF`, `DIST.QUI`, `INV.QUI`, `TESTE.QUI`, `DISTBETA`, `DISTGAMA`, `DISTEXPON`, `DIST.BIN` (BINOMDIST), `CRIT.BINOM`, `DISTWEIBULL`, `DIST.HIPERGEOM`, `DIST.LOGNORMAL`, `DIST.NORMP`, `INV.NORMP`, `CONFIANÇA`, `TESTEZ`, `TESTET`, `TESTEF`, `MODO`, `ORDEM`, `QUARTIL`, `PERCENTIL`, `ORDEM.PORCENTUAL`, `DESVPAD`, `DESVPADP`, `VAR`, `VARP`, `COVAR`, `PREVISÃO`.

---

## Resumo de status

✅ 9 (`CONT.NÚM`, `CONT.VALORES`, `CONT.SE`, `MÉDIA`, `MÍN`, `MÁX`, `MED`, `DESVPAD`, `DESVPADP`) · o resto ❌. Ordem sugerida: `CONT.SES`, `MÉDIASE(S)`, `MÁXIMOSES/MÍNIMOSES`, `CONTAR.VAZIO`, `MAIOR/MENOR`, `ORDEM`, `QUARTIL/PERCENTIL`, `MODO`, `VAR`, regressão, distribuições.
