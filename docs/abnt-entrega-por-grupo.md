# ABNT — entrega por grupo (o que entrou e o que foi conferido)

Este documento é o registro da entrega do **motor ABNT completo**: as **38 regras** que
faltavam do catálogo (`docs/pesquisa-formalidade-abnt.md`, seção 6 — todas menos o grupo G,
que ficou de fora por pedido), mais o conserto do salvamento em pasta de rede que apareceu no
meio do caminho. Ele diz, por frente: **o que entregou, com que evidência, e em que estado ficou**.

Conferência feita em **2026-10-14**, na `main`, com o código já integrado.

## Como foi feito

1. **A base primeiro** (`f985eaa`): o motor sabia conferir padrão de texto, mas não sabia
   *onde* no documento — e as normas cobram isso. Entrou o **modelo do documento**
   (`documento.ts`: títulos, parágrafos, blocos como `referencias`/`resumo`/`sumario`), o
   **escopo de bloco** e o **tipo `estrutura`** no schema (com verificadores em
   `verificadores/`, um arquivo por grupo), o ajudante de teste e o contrato
   `docs/abnt-como-escrever-regras.md`. Sem isso, cada frente inventaria o próprio contexto
   e elas conflitariam nos mesmos arquivos.
2. **Nove frentes em paralelo**, cada uma numa worktree própria e num arquivo de
   verificador próprio (só a `main` foi ponto de encontro), cada uma obrigada a rodar os
   portões: `tsc` limpo, o teste de ouro das dez regras antigas, o corpus do corretor
   (34/34 e 34/34) e o teste próprio com **os dois lados** — o caso que acusa e o texto
   correto que **não** pode acusar.
3. **A conferência final** (este documento): bateria integrada na `main`, com tudo junto.

## Resultado por frente

| Frente | Regras | Commit | Teste próprio | Estado |
| --- | --- | --- | --- | --- |
| Base (documento, escopo, verificadores) | — | `f985eaa` | 22 checagens | ✅ |
| **E** — estrutura do trabalho | E01, E02, E03 (+ P01, 15287) | `0a2c4f1` | 40 | ✅ |
| **S** — sumário e numeração | S01–S04 | `913435f` | 35 | ✅ |
| **A** — resumo e abstract | E09, E10, A01, A02, A03 | `ef821d0` | 39 | ✅ |
| **C** — citações | C01, C03, C04, C06 | `349aeec` | 61 | ✅ |
| **R1** — lista de referências | R01, R02, R11, R12 | `650efae` | 51 | ✅ |
| **R2** — forma por tipo | R03–R10 | `8179a0c` | 50 | ✅ |
| **T** — tabelas, figuras, listas | T01, T02, E11 | `7f47bd6` | 35 | ✅ |
| **DOCX** — arquivo exportado | E04–E08, E12 | `8457e49` | 38 | ✅ |
| **Salvamento em pasta de rede** (pedido à parte) | — | `c878d4a` | 35 + `test:backup` + 30 de `cargo test` | ✅ |
| **Correção da conferência** (teste do docx) | — | `46ec4b1` | — | ✅ |

Cobertura: **41 das 44 regras do catálogo** estão ativas. No pipeline de texto são **42
regras em TOML** (as dez antigas + **32 novas**); o validador do `.docx` tem as suas **6**
(E04–E08 e E12), que rodam sobre o arquivo exportado, não sobre o texto. As três que faltam
são do grupo G — **G01, G03 e G04** —, excluídas por pedido na tarefa que originou esta
entrega (o G02 é a tipografia que já existia).

## Bateria final integrada (na `main`, com tudo junto)

Tudo rodado depois de todas as integrações (comandos e resultado literal):

| Portão | Resultado |
| --- | --- |
| `npx tsc --noEmit` | limpo |
| teste de ouro (`testar-regras-abnt.mts`) | **Tudo certo** — 42 regras, **4,0 ms** para um TCC de 57 mil caracteres |
| corpus do corretor (`testar-correcoes.mts`) | **34/34** casos corrigidos e **34/34** textos corretos preservados |
| `testar-abnt-contexto` | 22 checagens |
| `testar-abnt-estrutura` | 40 |
| `testar-abnt-numeracao` | 35 |
| `testar-abnt-resumo` | 39 |
| `testar-abnt-citacoes` | 61 |
| `testar-abnt-referencias` | 51 |
| `testar-abnt-referencias-tipos` | 50 |
| `testar-abnt-tabelas` | 35 |
| `testar-abnt-docx` | 38 |
| `testar-salvamento` | Tudo certo |
| `test:backup` (com e2e) | OK |
| `npm run build` (o pacote real, com os TOMLs) | ✓ em 25,4 s |

Medição que fica: as 42 regras sobre um TCC levam ~4–5 ms — o teto de 50 ms do projeto
segue folgado. Os testes por frente ficam nos scripts (`node scripts/testar-abnt-*.mts`) e
nos scripts do `package.json` (`test:abnt-*`).

## O que a conferência final pegou (e foi corrigido)

O grupo DOCX entregou com o teste verde. Depois, um **refactor de UI de outro trabalho**
(`14d163d`, selects nativos → menu do app) fez o construtor de diagramas importar o
`seletor`, e o exportador `src/md/docx.ts` importava `renderMermaidInto` do **índice**
`./diagram` — que reexporta o construtor. Resultado: o empacotamento do exportador passou a
carregar a UI inteira, e o teste do `.docx` (que roda no Node, sem `document`) quebrava na
importação. Corrigido em `46ec4b1`: o exportador importa direto de `./diagram/mermaid` (não
precisa da UI), sem mudança de comportamento. **É exatamente o tipo de quebra que só a
passada integrada vê** — cada frente tinha o teste verde por si.

## Limitações declaradas (conscientes, registradas no código e no histórico)

Resumo; o detalhe de cada uma está no TOML/verificador correspondente e no
`docs/historico-tecnico.md`.

- **E01/E03** cobram por título; capa, folha de rosto e folha de aprovação ficam de fora
  (variam por instituição); E02 olha só títulos de nível 1.
- **S01** cobra presença até a seção terciária e não cobra pós-textuais; **S03** não confere
  a sequência dos irmãos; **S04** é sugestão (confiança baixa do catálogo).
- **E09/A01** contam o corpo em prosa do resumo (sem código/figuras), excluindo a linha do
  rótulo; **A02** orienta 3–5 termos mas não confere a quantidade (sem consenso na norma);
  **A03** não pega citação narrativa ("Silva (2020)") para evitar falso positivo em nomes.
- **C01** usa lista fechada de sobrenomes em caixa mista (falso negativo por design; risco
  residual de palavra comum que seja sobrenome); **C03** acusa também título entre aspas
  seguido de citação; **C04** usa linhas físicas como aproximação de "mais de 3 linhas".
- **R02** só considera entradas com chave confiável (e não confere ordem por ano dentro do
  mesmo autor); **R11** só olha citação → referência (não o inverso) e casa de forma folgada
  de propósito; **R12** só acusa lista que mistura com e sem destaque.
- **R03–R10** são de conferência (sem correção automática) e cada uma tem o seu limite
  declarado (ex.: R03 não separa livro de e-book; R08 aceita sigla como instituição).
- **T01** acusa tabela sem identificação acima (é o pedido pela norma, mas é o principal
  ruído em rascunho); **T02** tem o caso da imagem sem alt engolido pela máscara (ver
  pendências); **E11** só olha a direção "lista só com itens existentes".
- **DOCX**: não resolve cadeia de estilos (`basedOn`); E08 só acusa ausência total de
  paginação; E12 só reconhece título com estilo (`Heading 1`/`Título 1`).
- **Salvamento**: a latência real de SMB não foi medida (não há share no ambiente) — o
  "fora da thread principal" é por contrato do Tauri; a lentidão foi simulada (80–150 ms por
  gravação no TS, 120 ms por leitura no Rust).

## Pendências

As que pedem trabalho futuro estão em **[docs/abnt-pendencias.md](abnt-pendencias.md)**.
