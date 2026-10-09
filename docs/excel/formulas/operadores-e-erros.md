# Operadores, referências e códigos de erro

Legenda: ✅ implementado · ⚠️ diverge do Excel · ❌ ainda não. Veja o [índice](README.md).

## Operadores

| Operador | Significado | Status |
|---|---|---|
| `+` `-` `*` `/` | Aritmética | ✅ |
| `^` | Potência | ✅ |
| `%` | Porcentagem (`15%` = `0,15`) | ✅ |
| `&` | Concatenar textos | ✅ |
| `=` `<>` `<` `>` `<=` `>=` | Comparação | ✅ |
| `-` unário | Sinal negativo | ✅ |
| `:` | Faixa (`A1:B5`) | ✅ |
| `;` `,` | Separador de argumentos | ✅ |
| (espaço) | Interseção de faixas | ❌ |
| `,` entre faixas como união (`A1:A3,C1:C3`) | União | ❌ |
| `@` | Interseção implícita | ❌ |
| `#` | Derrame (ver [matrizes dinâmicas](matrizes-dinamicas.md)) | ❌ |

## Referências

| Recurso | Status | Observação |
|---|---|---|
| Relativa `A1` | ✅ | Desloca ao preencher |
| Absoluta e mista `$A$1`, `A$1`, `$A1` | ✅ | Ficam presas ao preencher (`deslocarFormula`) |
| Faixa `A1:B5` | ✅ | |
| Coluna/linha inteira (`A:A`, `1:1`) | ❌ | |
| Outra aba `Plan2!A1` | ❌ | |
| Outro arquivo `[Livro.xlsx]Plan1!A1` | ❌ | |
| Nome definido (`Vendas`) | ❌ | |
| Tabela estruturada (`Tabela1[Coluna]`) | ❌ | |
| Referência que sai da grade ao preencher (`=A1` arrastada para cima da linha 1) | ✅ | Vira `#REF!` |

## Valores de texto e números

| Recurso | Status | Observação |
|---|---|---|
| Número com vírgula decimal (`2,5`) | ✅ | |
| Texto entre aspas, aspas duplicadas (`""`) | ✅ | Preservado ao preencher |
| `VERDADEIRO` / `FALSO` | ✅ | |
| Datas como número de série | ❌ | Ver [data-hora.md](data-hora.md) |
| Notação científica | ⚠️ | A conferir contra o Excel |

## Códigos de erro

| Erro | Quando | Status |
|---|---|---|
| `#DIV/0!` | Divisão por zero | ✅ |
| `#NOME?` | Função ou nome desconhecido | ✅ (é o que ❌ mostra) |
| `#VALOR!` | Tipo de argumento errado | ✅ |
| `#REF!` | Referência inválida | ✅ |
| `#NÚM!` | Número inválido (`RAIZ(-1)`) | ✅ |
| `#CIRC!` | Referência circular | ✅ (o Excel mostra um aviso e `0`; aqui o erro fica na célula) |
| `#ERRO!` | Fórmula que não foi possível ler | ✅ (código do app, não existe no Excel) |
| `#N/D` | Valor não disponível | ❌ |
| `#NULO!` | Interseção vazia | ❌ |
| `#DERRAMAR!` | Matriz sem espaço | ❌ |
| `#CALC!` / `#CAMPO!` / `#BUSY!` | Erros do Excel 365 | ❌ |

## Alterações exatas (preencher, inserir, excluir)

| Ação | Status | Observação |
|---|---|---|
| Preencher para baixo/direita com alça | ✅ | |
| Copiar e colar | ⚠️ | Cola o texto como está; não desloca as referências como o Excel faz ao colar fórmulas |
| Inserir linha/coluna: reescrever as referências das fórmulas | ❌ | Hoje as células **se movem, mas as fórmulas continuam apontando para o endereço antigo** (o Excel ajusta as referências) |
| Excluir linha/coluna: ajustar referências e gerar `#REF!` | ❌ | Mesmo problema: as células sobem, as referências não acompanham |
| Recalcular só o que mudou | ⚠️ | Cache por célula; ainda não há grafo de dependências |
