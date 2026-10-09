# Data e hora

Especificação para recriar cada função. Formato: **NOME_PT (NOME_EN)** · `sintaxe` · regra · exemplo → resultado.
Marca: ✅ já no mdOffice · ⚠️ diverge · ❌ falta. Veja o [índice](README.md).

## Base: número de série

O Excel guarda data como **número de série**: dias desde 1/1/1900 (série 1). A hora é a parte decimal (0,5 = 12:00). Regras para recriar:
- Série 1 = 01/01/1900; série 60 é o fictício **29/02/1900** (bug herdado do Lotus: o Excel trata 1900 como bissexto). Para datas a partir de 01/03/1900, série = dias corridos desde 30/12/1899.
- 09/10/2026 = série `46304`. 01/01/2000 = `36526`. Meio-dia de 09/10/2026 = `46304,5`.
- Datas negativas ou > 31/12/9999 (série 2.958.465) → `#NÚM!`.
- Sistema 1904 (Mac antigo) começa em 01/01/1904: opção do arquivo, a suportar na importação.
- Datas e horas só viram texto legível pelo **formato da célula** (`dd/mm/aaaa`, `hh:mm`).

---

## Data de hoje e montagem

**HOJE (TODAY)** ✅ · `=HOJE()` · série inteira da data atual (volátil). Em 09/10/2026 → `46304`.
**AGORA (NOW)** ✅ · `=AGORA()` · data e hora atuais (volátil). → `46304,5` ao meio-dia.

**DATA (DATE)** ❌ · `=DATA(ano; mês; dia)` · meses e dias fora do intervalo "rolam"; ano 0–1899 soma 1900.
`=DATA(2026; 10; 9)` → `46304` · `=DATA(2026; 14; 1)` → 01/02/2027 · `=DATA(2026; 3; 0)` → 28/02/2026.
**TEMPO (TIME)** ❌ · `=TEMPO(h; m; s)` → fração do dia. `=TEMPO(12; 0; 0)` → `0,5` · `=TEMPO(25; 0; 0)` → `0,0416666666666667` (01:00).

**VALOR.DATA (DATEVALUE)** ❌ · texto → série (depende da região). `=VALOR.DATA("09/10/2026")` → `46304`.
**VALOR.TEMPO (TIMEVALUE)** ❌ · `=VALOR.TEMPO("18:00")` → `0,75`.

---

## Extrair partes

**ANO (YEAR)** ❌ · `=ANO(46304)` → `2026`.
**MÊS (MONTH)** ❌ · `=MÊS(46304)` → `10`.
**DIA (DAY)** ❌ · `=DIA(46304)` → `9`.
**HORA (HOUR)** ❌ · `=HORA(46304,75)` → `18`.
**MINUTO (MINUTE)** ❌ · `=MINUTO(0,5104166667)` → `15` (12:15).
**SEGUNDO (SECOND)** ❌ · `=SEGUNDO(0,5104166667)` → `0`.

**DIA.DA.SEMANA (WEEKDAY)** ❌ · `=DIA.DA.SEMANA(data; [tipo])` · tipo 1 (padrão): domingo=1…sábado=7; tipo 2: segunda=1…domingo=7; tipo 3: segunda=0…domingo=6; 11–17: semana começando em segunda…domingo.
09/10/2026 é sexta: `=DIA.DA.SEMANA(46304)` → `6` · `=DIA.DA.SEMANA(46304; 2)` → `5`.
**NÚMSEMANA (WEEKNUM)** ❌ · `=NÚMSEMANA(data; [tipo])` · tipo 1 domingo, 2 segunda; semana 1 contém 1º de janeiro. `=NÚMSEMANA(DATA(2026;1;1))` → `1`.
**ISOSEMANA (ISOWEEKNUM)** ❌ · semana ISO 8601 (começa na segunda; semana 1 tem a primeira quinta). `=ISOSEMANA(DATA(2026;1;1))` → `1` · `=ISOSEMANA(DATA(2027;1;1))` → `53`.

---

## Somar e comparar datas

**DATAM (EDATE)** ❌ · `=DATAM(data; meses)` · mesmo dia; se não existe vai ao último dia. `=DATAM(DATA(2026;1;31); 1)` → 28/02/2026.
**FIMMÊS (EOMONTH)** ❌ · `=FIMMÊS(DATA(2026;2;10); 0)` → 28/02/2026 · `=FIMMÊS(DATA(2026;2;10); 1)` → 31/03/2026.

**DIAS (DAYS)** ❌ · `=DIAS(data_final; data_inicial)` · `=DIAS(DATA(2026;10;9); DATA(2026;1;1))` → `281`.
**DIAS360 (DAYS360)** ❌ · ano comercial de 360 dias; método americano padrão, europeu com VERDADEIRO. `=DIAS360(DATA(2026;1;30); DATA(2026;3;31))` → `60`.
**DATADIF (DATEDIF)** ❌ · não documentada no Excel. `=DATADIF(início; fim; unidade)` · unidades `"Y"` anos completos, `"M"` meses completos, `"D"` dias, `"MD"` dias ignorando meses, `"YM"` meses ignorando anos, `"YD"` dias ignorando anos. Fim < início → `#NÚM!`.
`=DATADIF(DATA(2000;5;20); DATA(2026;10;9); "Y")` → `26` · `"YM"` → `4` · `"MD"` → `19`.
**FRAÇÃOANO (YEARFRAC)** ❌ · `=FRAÇÃOANO(início; fim; [base])` · base 0 EUA 30/360, 1 real/real, 2 real/360, 3 real/365, 4 europeu 30/360. `=FRAÇÃOANO(DATA(2026;1;1); DATA(2026;7;1); 0)` → `0,5`.

**DIATRABALHO (WORKDAY)** ❌ · `=DIATRABALHO(início; dias; [feriados])` · pula sábado, domingo e feriados. `=DIATRABALHO(DATA(2026;10;9); 1)` → 12/10/2026 (segunda).
**DIATRABALHO.INTL (WORKDAY.INTL)** ❌ · fim de semana configurável (códigos 1–17 ou texto `"0000011"`).
**DIATRABALHOTOTAL (NETWORKDAYS)** ❌ · `=DIATRABALHOTOTAL(início; fim; [feriados])` · conta os dois extremos. `=DIATRABALHOTOTAL(DATA(2026;10;5); DATA(2026;10;9))` → `5`.
**DIATRABALHOTOTAL.INTL (NETWORKDAYS.INTL)** ❌.

---

## Resumo de status

✅ 2 (`HOJE`, `AGORA`) · o resto ❌. **Primeiro passo:** implementar conversão data ⇄ série (com o dia fictício de 29/02/1900) e a exibição pelo formato da célula; só depois `DATA`, `ANO`, `MÊS`, `DIA`, `DIAS`, `DATAM`, `FIMMÊS`, `DIA.DA.SEMANA`, `DATADIF`, dias úteis.
