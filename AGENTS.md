# MDOffice

## Visão geral

O MDOffice é um projeto de suíte de produtividade inspirado no Microsoft Office, desenvolvido com o objetivo de oferecer uma experiência abrangente de criação, edição e gerenciamento de documentos e outros tipos de conteúdo.

A proposta é combinar funcionalidades de escritório com assistência de inteligência artificial integrada, permitindo que o usuário realize tarefas de maneira mais simples, eficiente e intuitiva, sem depender exclusivamente da execução manual de cada operação.

O projeto busca oferecer uma alternativa acessível, na qual a assistência de IA faça parte da experiência do produto sem exigir uma cobrança adicional específica por esse recurso.

## Como trabalhar

> **Nunca se trabalha diretamente na `main`.** Toda tarefa — funcionalidade, correção, documentação — acontece numa **worktree própria**, com a própria branch. A cópia principal do repositório fica permanentemente na `main`, limpa. É isso que permite vários agentes trabalharem ao mesmo tempo sem atrapalhar uns aos outros.

As ferramentas ficam em `tools\worktrees\` (PowerShell) e são de uso **obrigatório** para todos:

1. **Abrir** (na cópia principal): `tools\worktrees\abrir.ps1 feat/minha-tarefa -Porque "por que a tarefa existe" -Proposito "o que ela entrega"`
   Cria `.worktrees\feat-minha-tarefa` a partir da `main`, com `node_modules` e os arquivos pesados ligados por *junction*. Prefixos de branch: `feat`, `fix`, `docs`, `refactor`, `chore`, `test`, `perf`. Uma worktree por tarefa; solicitação nova, worktree nova. `-Porque` e `-Proposito` (opcionais, também aceitam `-Branch nome`) ficam guardados na branch: aparecem no `status.ps1` e no corpo do commit do `fechar.ps1`.
2. **Trabalhar** só dentro da worktree: editar, validar (`npx tsc --noEmit`) e commitar acontecem lá, nunca na cópia principal.
3. **Fechar** (de dentro da worktree): `tools\worktrees\fechar.ps1 -Mensagem "feat(escopo): descrição"`
   Commita o que faltar, integra a `main` na worktree (por **rebase**, então a história fica linear, sem commit de merge), entrega o trabalho na `main`, envia a `main` ao GitHub e agenda a remoção da worktree e da branch local. Aceita `-Porque`/`-Proposito` (completam a descrição da branch, que vai no corpo do commit) e `-Branch nome` (confere se é a worktree certa). **Sempre use o `fechar.ps1`** — ele resolve sozinho os problemas comuns (main que andou, trava entre fechamentos simultâneos, links de `node_modules`, pasta presa, worktree órfã). Não improvise `git merge`, `git checkout main` ou remoção manual da pasta.

### Regras

- **Nada de commit, edição ou `checkout` na cópia principal.** Se você se pegar na `main` com alterações, pare: copie o trabalho para uma worktree.
- **Nunca deixe worktree órfã.** Terminou ou desistiu? Rode o `fechar.ps1` (ou `limpar.ps1 -Nome <branch> -Forcar -ApagarBranch` para descartar).
- **Conflito:** o `fechar.ps1` para, lista os arquivos e deixa a integração (rebase) em andamento na worktree. Resolva, rode `git add` e execute o `fechar.ps1` de novo — ele continua o rebase sozinho.
- **O push é automático — não o faça à mão.** O `fechar.ps1` já envia a `main` ao GitHub depois de entregar. Se o envio falhar, ou se alguém fechar com `-SemPush`, o monitor (`monitor-push.ps1`, tarefa agendada instalada por `instalar-monitor.ps1`) envia quando todas as worktrees tiverem terminado. Ele nunca força push: se a `main` e o GitHub divergirem, avisa no log (`.git\mdoffice-monitor.log`) e espera o usuário resolver.
- **Não mexa em worktree de outro agente.** `tools\worktrees\status.ps1` mostra worktrees, estado da `main` e limpeza pendente.
- **Proteção opcional:** `tools\worktrees\instalar-protecao.ps1` instala um hook que bloqueia commit direto na `main`.
