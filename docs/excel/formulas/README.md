# Fórmulas do Excel: especificação para recriar no mdOffice

Cada documento descreve as funções de uma categoria do Excel (cerca de 450 funções): **nome em português e em inglês, sintaxe, regras, e exemplos com o resultado esperado** — para servir de especificação e de teste de aceitação ao recriar cada uma no motor de planilhas (`src/excel/formula.ts`).

> **Leia primeiro:** o mdOffice **ainda não implementa todas essas funções**. Cada função leva uma marca (✅ já existe, ⚠️ existe mas diverge do Excel, ❌ falta) para mostrar o que já funciona e o que falta. Nenhuma função é marcada como pronta sem estar no código.
>
> **Limites desta documentação:** as regras e os exemplos vêm do comportamento conhecido do Excel e os resultados numéricos foram recalculados à mão ou em código, mas **não foram comparados com um Excel real**. As funções mais raras (distribuições, títulos, Bessel, números complexos) têm descrição e sintaxe, nem sempre exemplo. Antes de dar uma função como pronta, compare o resultado dela com o do Excel.

## Legenda

| Marca | Significado |
|---|---|
| ✅ | Implementada: o app lê e calcula; ao preencher, as referências se deslocam como no Excel. |
| ⚠️ | Existe, mas **diverge do Excel** (ver a observação da linha). |
| ❌ | Ainda não implementada: a célula mostra `#NOME?`. |

## Documentos

| Documento | Categoria | ✅ | ⚠️ |
|---|---|---|---|
| [matematica.md](matematica.md) | Matemática e trigonometria (~78) | 10 | 4 |
| [estatistica.md](estatistica.md) | Estatística | 9 | 0 |
| [logica.md](logica.md) | Lógica | 4 | 0 |
| [texto.md](texto.md) | Texto | 9 | 1 |
| [data-hora.md](data-hora.md) | Data e hora | 2 | 0 |
| [informacao.md](informacao.md) | Informação | 2 | 1 |
| [pesquisa-referencia.md](pesquisa-referencia.md) | Pesquisa e referência | 0 | 0 |
| [financeiras.md](financeiras.md) | Financeiras | 0 | 0 |
| [banco-de-dados.md](banco-de-dados.md) | Banco de dados | 0 | 0 |
| [engenharia.md](engenharia.md) | Engenharia | 0 | 0 |
| [matrizes-dinamicas.md](matrizes-dinamicas.md) | Matrizes dinâmicas e recentes | 0 | 0 |
| [operadores-e-erros.md](operadores-e-erros.md) | Operadores, referências e códigos de erro | — | — |

## Como o motor funciona (o que é verdade hoje)

O mdOffice **não depende do Excel nem de bibliotecas externas** para calcular. O caminho é todo do app:

1. **Leitura** (`quebrar`, `analisar`): o texto da fórmula vira uma árvore (AST) com números, textos, referências (`A1`, `A1:B5`), operadores e chamadas de função. Aceita nomes em português (`SOMA`) e, para parte das funções, em inglês (`SUM` ainda **não**; veja cada documento).
2. **Cálculo** (`calcular`): a árvore é avaliada contra a grade, com detecção de referência circular (`#CIRC!`) e erros no estilo do Excel (`#DIV/0!`, `#NOME?`, `#VALOR!`, `#REF!`, `#NÚM!`).
3. **Alteração ao preencher** (`deslocarFormula` em `src/excel/refs.ts`): ao preencher para baixo ou para a direita, as referências relativas se deslocam como no Excel (`=C2*D2` vira `=C3*D3`) e as presas com cifrão (`$A$1`, `A$1`) ficam fixas.
4. **Arquivo `.xlsx`**: a importação e a exportação ficam em `src/excel/xlsximport` e `src/excel/xlsxexport`; a fórmula vai como texto e o Excel recalcula ao abrir.

### O que falta para "pegar todas as fórmulas e alterar com exatidão"

- Implementar as funções marcadas ❌ (maior bloco: pesquisa e referência, financeiras, data, texto avançado, estatística avançada).
- Corrigir as divergências ⚠️.
- **Reescrever as referências ao inserir ou excluir linhas e colunas** (hoje as células se movem, mas as fórmulas não acompanham; é a lacuna mais séria para "alterar com exatidão").
- Aceitar nomes em inglês em todas as funções (hoje só alguns aliases).
- Referências entre abas (`Plan2!A1`), intervalos nomeados e matrizes.
- Um teste automático que compare o resultado de cada função com valores de referência do Excel.

A ordem sugerida de trabalho está no fim de cada documento.
