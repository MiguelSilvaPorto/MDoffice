# Modelo de linguagem do corretor (não versionado)

Os `.json` desta pasta são **gerados**, não versionados: cada regeneração reescreve ~9 MB e isso
incharia o histórico do git a cada commit (o histórico antigo desses arquivos foi removido do
repositório em 2026-10-14).

## Como gerar

```
npm run corpus
```

A cadeia (`scripts/regerar-ngrams.mjs`) baixa o corpus da Wikipédia (retomável), conta os
n-gramas (`scripts/build-ngrams.mjs` → `pt.json`), deriva o contexto do corretor
(`scripts/gerar-contexto.mjs` → `ctx-pt.json`) e a frequência (`scripts/gerar-frequencia.mjs` →
`freq-pt.json`). O `syn-pt.json` (sinônimos, a MEDIA do thesaurus) vem do dicionário aberto do
LibreOffice.

Depois de gerar, o juiz é o harness: `node scripts/avaliar-correcao.mts` (com e sem
`--sem-modelo`) e `npm run test:correcao`.

## O que esperar

- Sem estes arquivos o app **funciona** — o corretor/ghost apenas trabalha sem o modelo (a
  qualidade da sugestão cai).
- Quem trabalha em worktree não precisa gerar de novo: `tools\worktrees\abrir.ps1` liga esta
  pasta à cópia principal por *junction* (como faz com `public/ort` e `public/modelos`).
