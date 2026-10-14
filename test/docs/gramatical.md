# Corpus gramatical

Casos de teste para o corretor: cada caso é um documento curto com erros reais de
escrita e o texto como ele deve ficar depois da correção.

**Como o teste lê este arquivo:** cada seção `## Caso NN` tem dois blocos —
`### Errado` (o que a pessoa escreveu) e `### Esperado` (o texto correto). O runner
`scripts/testar-correcoes.mts` aplica as correções no texto errado e compara com o
esperado, caso a caso.

**Regra do corpus:** só entram erros **objetivos** — ortografia, acentuação,
pontuação obrigatória, concordância e espaçamento. Nada de reescrita estilística
(a escolha de palavras continua sendo de quem escreve).

## Caso 01 — ortografia: palavra trocada no meio da frase

### Errado
````text
O relatório foi estenso e cobriu todos os pontos.
````

### Esperado
````text
O relatório foi extenso e cobriu todos os pontos.
````

## Caso 02 — ortografia: troca de letras

### Errado
````text
A pessoa responsavo pelo projeto enviou os dados.
````

### Esperado
````text
A pessoa responsável pelo projeto enviou os dados.
````

## Caso 03 — ortografia: sílabas trocadas de lugar

### Errado
````text
Não encontrei maneria de resolver isso hoje.
````

### Esperado
````text
Não encontrei maneira de resolver isso hoje.
````

## Caso 04 — ortografia: letras faltando

### Errado
````text
A adiministracao informou pricipalmente os números do mês.
````

### Esperado
````text
A administração informou principalmente os números do mês.
````

## Caso 05 — ortografia: letras faltando no meio

### Errado
````text
O conhecimeto técnico exige atensao aos detalhes.
````

### Esperado
````text
O conhecimento técnico exige atenção aos detalhes.
````

## Caso 06 — ortografia: erro clássico

### Errado
````text
Foi uma excessao abrir esse previlegio para a equipe.
````

### Esperado
````text
Foi uma exceção abrir esse privilégio para a equipe.
````

## Caso 07 — acentuação: acentos faltando

### Errado
````text
Nao sei se voce vai receber o relatorio antes da reuniao.
````

### Esperado
````text
Não sei se você vai receber o relatório antes da reunião.
````

## Caso 08 — acentuação: acentos faltando em palavras comuns

### Errado
````text
O arquivo necessario tambem foi enviado ontem.
````

### Esperado
````text
O arquivo necessário também foi enviado ontem.
````

## Caso 09 — ortografia: letras trocadas em sequência

### Errado
````text
Isso foi improtante para resolver o poblema da equipe.
````

### Esperado
````text
Isso foi importante para resolver o problema da equipe.
````

## Caso 10 — ortografia: palavra válida mas errada no contexto

### Errado
````text
O documento ficou bastante estenso depois da revisão.
````

### Esperado
````text
O documento ficou bastante extenso depois da revisão.
````

## Caso 11 — pontuação: falta o ponto final

### Errado
````text
A reunião foi produtiva e definimos os próximos passos
````

### Esperado
````text
A reunião foi produtiva e definimos os próximos passos.
````

## Caso 12 — pontuação: falta vírgula antes de "mas"

### Errado
````text
O prazo era curto mas conseguimos entregar tudo.
````

### Esperado
````text
O prazo era curto, mas conseguimos entregar tudo.
````

## Caso 13 — pontuação: falta vírgula depois de conectivo inicial

### Errado
````text
Portanto o projeto segue conforme o planejado.
````

### Esperado
````text
Portanto, o projeto segue conforme o planejado.
````

## Caso 14 — pontuação: expressão explicativa sem vírgulas

### Errado
````text
O relatório ou seja o documento final foi aprovado.
````

### Esperado
````text
O relatório, ou seja, o documento final foi aprovado.
````

## Caso 15 — pontuação: falta ponto em vários parágrafos

### Errado
````text
Primeiro revisamos os números

Depois ajustamos o texto

Por fim enviamos para aprovação
````

### Esperado
````text
Primeiro revisamos os números.

Depois ajustamos o texto.

Por fim, enviamos para aprovação.
````

## Caso 16 — pontuação: falta vírgula antes de "porém"

### Errado
````text
O sistema funcionou bem porém ficou lento no fim do dia.
````

### Esperado
````text
O sistema funcionou bem, porém ficou lento no fim do dia.
````

## Caso 17 — pontuação: conectivo no meio sem vírgulas

### Errado
````text
O time trabalhou bastante no entanto o prazo continua apertado.
````

### Esperado
````text
O time trabalhou bastante, no entanto, o prazo continua apertado.
````

## Caso 18 — pontuação: falta vírgula antes de oração subordinada

### Errado
````text
Vamos revisar o documento pois ele precisa de ajustes.
````

### Esperado
````text
Vamos revisar o documento, pois ele precisa de ajustes.
````

## Caso 19 — concordância: plural faltando

### Errado
````text
Os documento foram arquivados no sistema antigo.
````

### Esperado
````text
Os documentos foram arquivados no sistema antigo.
````

## Caso 20 — concordância: "a gente" em texto formal

### Errado
````text
A gente vai revisar o material antes de publicar.
````

### Esperado
````text
Nós vamos revisar o material antes de publicar.
````

## Caso 21 — concordância: verbo no plural com sujeito no singular

### Errado
````text
Fazem dois anos que a equipe usa esse processo.
````

### Esperado
````text
Faz dois anos que a equipe usa esse processo.
````

## Caso 22 — registro: forma informal

### Errado
````text
Vou mandar o arquivo pra você ainda hoje.
````

### Esperado
````text
Vou mandar o arquivo para você ainda hoje.
````

## Caso 23 — registro: expressão condenada

### Errado
````text
Esse assunto foi tratado a nível de diretoria.
````

### Esperado
````text
Esse assunto foi tratado em nível de diretoria.
````

## Caso 24 — registro: rodeio que vira conectivo direto

### Errado
````text
O atraso aconteceu devido ao fato de que o servidor caiu.
````

### Esperado
````text
O atraso aconteceu porque o servidor caiu.
````

## Caso 25 — espaçamento: espaço duplo e espaço antes da vírgula

### Errado
````text
O valor  total ficou alto , mas o prazo melhorou.
````

### Esperado
````text
O valor total ficou alto, mas o prazo melhorou.
````

## Caso 26 — espaçamento: palavra repetida

### Errado
````text
O relatório de de julho já está pronto.
````

### Esperado
````text
O relatório de julho já está pronto.
````

## Caso 27 — maiúscula: início de frase depois do ponto

### Errado
````text
Aprovamos o texto. o prazo segue o mesmo.
````

### Esperado
````text
Aprovamos o texto. O prazo segue o mesmo.
````

## Caso 28 — maiúscula: início de parágrafo

### Errado
````text
o material foi revisado pela equipe técnica.
````

### Esperado
````text
O material foi revisado pela equipe técnica.
````

## Caso 29 — abreviações: escrita de internet

### Errado
````text
Vc pode ver se o arquivo está ok? Pq preciso dele hj.
````

### Esperado
````text
Você pode ver se o arquivo está ok? Porque preciso dele hoje.
````

## Caso 30 — misto: vários tipos no mesmo texto

### Errado
````text
O relatorio ficou estenso e a equipe nao conseguiu revisar mas o prazo continua
````

### Esperado
````text
O relatório ficou extenso e a equipe não conseguiu revisar, mas o prazo continua.
````

## Caso 31 — palavras coladas: faltou o espaço entre elas

### Errado
````text
O texto ficou pronto e oira verifica se segue as regras.
````

### Esperado
````text
O texto ficou pronto e o irá verifica se segue as regras.
````

## Caso 32 — palavra comum que nao pode virar duas ('aplicativo' nao e 'a plicativo')

### Errado
````text
O aplicativo nao abre o documento.
````

### Esperado
````text
O aplicativo não abre o documento.
````

## Caso 33 — acento pelo uso: 'ira' (raiva) onde era 'irá' (verbo)

### Errado
````text
O time ira viajar amanha de manha.
````

### Esperado
````text
O time irá viajar amanhã de manhã.
````

## Caso 34 — reticências: quatro pontos viram três

### Errado
````text
A pesquisa continua....
````

### Esperado
````text
A pesquisa continua...
````
