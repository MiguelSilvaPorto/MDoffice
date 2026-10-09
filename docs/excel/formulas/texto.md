# Texto

Especificação para recriar cada função. Formato: **NOME_PT (NOME_EN)** · `sintaxe` · regra · exemplo → resultado.
Marca: ✅ já no mdOffice · ⚠️ diverge · ❌ falta. Veja o [índice](README.md).

Regras gerais: posições começam em 1; números viram texto com o formato geral (`2,5` → `"2,5"`); `&` junta textos; um texto pode ter até 32.767 caracteres. Exemplos usam A1 = `Ana Maria Silva`.

---

## Medir, cortar e juntar

**NÚM.CARACT (LEN)** ✅ · `=NÚM.CARACT(texto)` · `=NÚM.CARACT(A1)` → `15`.
**NÚM.CARACTB (LENB)** ❌ · bytes (idiomas de byte duplo).

**ESQUERDA (LEFT)** ✅ · `=ESQUERDA(texto; [núm_caract])` · padrão 1. `=ESQUERDA(A1; 3)` → `Ana`.
**DIREITA (RIGHT)** ✅ · `=DIREITA(A1; 5)` → `Silva`.
**EXT.TEXTO (MID)** ✅ · `=EXT.TEXTO(texto; início; núm_caract)` · `=EXT.TEXTO(A1; 5; 5)` → `Maria`.
**ESQUERDAB / DIREITAB / EXT.TEXTOB (LEFTB / RIGHTB / MIDB)** ❌ · versões por byte.

**CONCATENAR (CONCATENATE)** ✅ · `=CONCATENAR(texto1; [texto2]; ...)` · não aceita faixa. `=CONCATENAR("a"; 1; "b")` → `a1b`.
**CONCAT (CONCAT)** ✅ · como CONCATENAR, mas aceita faixas. `=CONCAT(A1:A3)` com `a`,`b`,`c` → `abc`.
**UNIRTEXTO (TEXTJOIN)** ❌ · `=UNIRTEXTO(delimitador; ignorar_vazios; texto1; ...)`.
`=UNIRTEXTO("-"; VERDADEIRO; "a"; ""; "c")` → `a-c` · com FALSO → `a--c`.

**ESPAÇOS (TRIM)** ✅ · remove espaços das pontas e reduz os do meio a um. `=ESPAÇOS("  a   b ")` → `a b`.
**TIRAR (CLEAN)** ❌ · remove caracteres de controle (códigos 0–31). `=TIRAR("a" & CARACT(7) & "b")` → `ab`.

**REPT (REPT)** ❌ · `=REPT("ab"; 3)` → `ababab` · resultado > 32.767 caracteres → `#VALOR!`.

---

## Maiúsculas, minúsculas e comparação

**MAIÚSCULA (UPPER)** ✅ · `=MAIÚSCULA("ação")` → `AÇÃO`.
**MINÚSCULA (LOWER)** ✅ · `=MINÚSCULA("AÇÃO")` → `ação`.
**PRI.MAIÚSCULA (PROPER)** ❌ · `=PRI.MAIÚSCULA("ana maria")` → `Ana Maria` (letra após qualquer não letra vira maiúscula: `"d'água"` → `D'Água`).
**EXATO (EXACT)** ❌ · diferencia maiúsculas. `=EXATO("a"; "A")` → `FALSO`.

---

## Procurar e trocar

**PROCURAR (FIND)** ❌ · `=PROCURAR(texto_procurado; no_texto; [início])` · **diferencia maiúsculas**, sem curingas; não achou → `#VALOR!`.
`=PROCURAR("Maria"; A1)` → `5`.
**LOCALIZAR (SEARCH)** ❌ · não diferencia maiúsculas; aceita `?` e `*` (use `~` para literal). `=LOCALIZAR("m*a"; A1)` → `3`.
**PROCURARB / LOCALIZARB (FINDB / SEARCHB)** ❌.

**SUBSTITUIR (SUBSTITUTE)** ❌ · `=SUBSTITUIR(texto; antigo; novo; [ocorrência])` · diferencia maiúsculas; sem a ocorrência troca todas.
`=SUBSTITUIR("a-b-c"; "-"; "/")` → `a/b/c` · `=SUBSTITUIR("a-b-c"; "-"; "/"; 2)` → `a-b/c`.
**MUDAR (REPLACE)** ❌ · `=MUDAR(texto; início; núm_caract; novo)` · `=MUDAR(A1; 1; 3; "Eva")` → `Eva Maria Silva`.
**MUDARB (REPLACEB)** ❌.

**TEXTOANTES (TEXTBEFORE)** ❌ · `=TEXTOANTES(texto; delimitador; [instância]; ...)` · `=TEXTOANTES(A1; " ")` → `Ana`.
**TEXTODEPOIS (TEXTAFTER)** ❌ · `=TEXTODEPOIS(A1; " "; -1)` → `Silva`.
**DIVIDIRTEXTO (TEXTSPLIT)** ❌ · `=DIVIDIRTEXTO(A1; " ")` → `Ana | Maria | Silva` em 3 células (ver [matrizes](matrizes-dinamicas.md)).

---

## Converter texto e número

**TEXTO (TEXT)** ⚠️ · `=TEXTO(valor; formato)` · aplica um código de formato e devolve texto. (mdOffice só junta os argumentos.)
`=TEXTO(1234,5; "0,00")` → `1234,50` · `=TEXTO(1234,5; "#.##0,00")` → `1.234,50` · `=TEXTO(0,256; "0%")` → `26%` · `=TEXTO(DATA(2026;10;9); "dd/mm/aaaa")` → `09/10/2026` · `=TEXTO(DATA(2026;10;9); "dddd")` → `sexta-feira`.
Códigos: `0` dígito obrigatório, `#` opcional, `.` milhar, `,` decimal, `%`, `dd mm aaaa hh:mm:ss`, `[h]`, `"texto"`, `;` separa positivo;negativo;zero;texto.

**VALOR (VALUE)** ❌ · texto → número. `=VALOR("1.234,5")` → `1234,5` · `=VALOR("10%")` → `0,1` · `=VALOR("abc")` → `#VALOR!`.
**VALORNUMÉRICO (NUMBERVALUE)** ❌ · `=VALORNUMÉRICO("1.234,5"; ","; ".")` → `1234,5`.

**MOEDA (DOLLAR)** ❌ · `=MOEDA(1234,567; 2)` → `R$ 1.234,57`.
**DEF.NÚM.DEC (FIXED)** ❌ · `=DEF.NÚM.DEC(1234,567; 1; FALSO)` → `1.234,6`.
**T (T)** ❌ · devolve o texto ou vazio. `=T("a")` → `a` · `=T(5)` → vazio.

**CARACT (CHAR)** ❌ · código → caractere (ANSI/Windows). `=CARACT(65)` → `A`.
**CÓDIGO (CODE)** ❌ · `=CÓDIGO("A")` → `65`.
**UNICODE (UNICODE)** ❌ · `=UNICODE("€")` → `8364`. **UNICARAC (UNICHAR)** ❌ · `=UNICARAC(8364)` → `€`.

---

## Outras

**TEXTO.REVERSO:** não existe no Excel (use VBA ou `LET` + `SEQUÊNCIA`).
**FONÉTICO (PHONETIC)** ❌ · furigana japonês. **ASC / DBCS (ASC / DBCS)** ❌ · largura de caracteres (japonês). **BAHTTEXT (BAHTTEXT)** ❌ · número por extenso em tailandês.
**MATRIZ.PARA.TEXTO (ARRAYTOTEXT) / VALORPARATEXTO (VALUETOTEXT)** ❌ · `=VALORPARATEXTO("a"; 1)` → `a` (modo 1 coloca aspas).

---

## Resumo de status

✅ 9 (`NÚM.CARACT`, `ESQUERDA`, `DIREITA`, `EXT.TEXTO`, `CONCATENAR`, `CONCAT`, `ESPAÇOS`, `MAIÚSCULA`, `MINÚSCULA`) · ⚠️ 1 (`TEXTO`) · o resto ❌. Ordem sugerida: corrigir `TEXTO` primeiro (hoje parece certo e não está), depois `UNIRTEXTO`, `PROCURAR/LOCALIZAR`, `SUBSTITUIR`, `VALOR`, `PRI.MAIÚSCULA`.
