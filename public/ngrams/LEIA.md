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

- **Sem estes arquivos o app funciona** — o corretor e a sugestão (*ghost*) apenas rodam **sem o
  modelo** (a qualidade das sugestões cai; nada quebra).
- Numa **worktree** não precisa gerar de novo: `tools\worktrees\abrir.ps1` liga esta pasta à cópia
  principal por *junction* (como faz com `public/ort` e `public/dicionario`).
- Num **clone novo**, rode `npm run corpus` uma vez antes de contar com o corretor — ou copie a
  pasta de outra cópia (os arquivos são os mesmos).
