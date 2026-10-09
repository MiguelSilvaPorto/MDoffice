# Banco de dados

Especificação para recriar cada função. Formato: **NOME_PT (NOME_EN)** · `sintaxe` · regra · exemplo → resultado.
Marca: ✅ já no mdOffice · ⚠️ diverge · ❌ falta. Veja o [índice](README.md).

**Nenhuma função desta categoria existe no mdOffice ainda.**

## Como todas funcionam

Sintaxe comum: `=BDxxx(banco_de_dados; campo; critérios)`

- **banco_de_dados**: faixa com **linha de cabeçalho** e as linhas de dados (ex.: `A1:D6`).
- **campo**: qual coluna usar. Pode ser o **nome do cabeçalho entre aspas** (`"Idade"`) ou o **número da coluna** dentro do banco (`2`). Nome inexistente → `#VALOR!`.
- **critérios**: faixa com **cabeçalho igual ao do banco** na 1ª linha e condições nas linhas de baixo.
  - Condições na **mesma linha** = E. Condições em **linhas diferentes** = OU.
  - Condição aceita valor (`30`), comparação (`">25"`, `"<=40"`, `"<>Ana"`), texto que começa com (`"A"` casa "Ana"), curingas `?` e `*`; `"=Ana"` exige igualdade exata.
  - Pode comparar com fórmula: coloque um cabeçalho **diferente** (ou vazio) e uma fórmula que devolva `VERDADEIRO/FALSO` referenciando a 1ª linha de dados.
  - Faixa de critérios sem nenhuma condição (linha vazia) → seleciona todas as linhas.

Dados dos exemplos (A1:C6) e critérios (E1:F2):

| | A | B | C |
|---|---|---|---|
| 1 | Nome | Idade | Salário |
| 2 | Ana | 30 | 5000 |
| 3 | Bia | 25 | 4000 |
| 4 | Caio | 30 | 6000 |
| 5 | Dani | 20 | 3000 |
| 6 | Eli | 25 | 4500 |

Critérios `E1:E2`: `Idade` / `30` (linhas Ana e Caio). Critérios `E1:F2`: `Idade` e `Salário` com `30` e `>5500` (só Caio). Critérios em duas linhas `E1:E3` com `25` e `20` = idade 25 **ou** 20.

---

**BDSOMA (DSUM)** ❌ · soma o campo nas linhas selecionadas. `=BDSOMA(A1:C6; "Salário"; E1:E2)` → `11000`.
**BDMÉDIA (DAVERAGE)** ❌ · média. `=BDMÉDIA(A1:C6; "Salário"; E1:E2)` → `5500`.
**BDCONTAR (DCOUNT)** ❌ · conta células **numéricas** do campo. `=BDCONTAR(A1:C6; "Salário"; E1:E2)` → `2`.
**BDCONTARA (DCOUNTA)** ❌ · conta células não vazias. `=BDCONTARA(A1:C6; "Nome"; E1:E2)` → `2`.
**BDMÁX (DMAX)** ❌ · `=BDMÁX(A1:C6; "Salário"; E1:E2)` → `6000`.
**BDMÍN (DMIN)** ❌ · `=BDMÍN(A1:C6; "Salário"; E1:E2)` → `5000`.
**BDMULTIPL (DPRODUCT)** ❌ · produto. `=BDMULTIPL(A1:C6; "Idade"; E1:E2)` → `900`.
**BDEST (DSTDEV)** ❌ · desvio padrão da **amostra**. `=BDEST(A1:C6; "Salário"; E1:E2)` → `707,106781186548`.
**BDDESVPA (DSTDEVP)** ❌ · da **população**. `=BDDESVPA(A1:C6; "Salário"; E1:E2)` → `500`.
**BDVAREST (DVAR)** ❌ · variância da amostra. → `500000`.
**BDVARP (DVARP)** ❌ · da população. → `250000`.
**BDEXTRAIR (DGET)** ❌ · devolve **um único** valor; nenhuma linha → `#VALOR!`; mais de uma → `#NÚM!`.
`=BDEXTRAIR(A1:C6; "Nome"; E1:F2)` (critérios Idade 30 e Salário >5500) → `Caio`.

---

## Resumo de status

0 implementadas. Reaproveita o mecanismo de critérios de `SOMASE`/`CONT.SE` (já existente no motor). Prioridade baixa: quem precisa disso normalmente usa `SOMASES`/`CONT.SES` (ver [matemática](matematica.md) e [estatística](estatistica.md)). Ordem sugerida: `BDSOMA`, `BDCONTAR`, `BDMÉDIA`, `BDEXTRAIR`, resto.
