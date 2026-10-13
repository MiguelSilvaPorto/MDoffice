# Watchdog do app (desenvolvimento)

Vigia o código e mantém o app em execução: **reinicia a cada mudança de arquivo** e **levanta de
novo se ele cair**. Foi feito para o fluxo do projeto, em que o código chega por git (fechamento
de worktrees, pull) enquanto o app roda na cópia principal — sem isto é preciso matar o processo e
rodar `npm run app` à mão a cada atualização.

## Como usar

```
tools\watchdog.cmd
```

Deixe a janela aberta (pode minimizar). O log do vigia fica em `tools\watchdog.log`; a saída do
app, em `tools\watchdog-app.log` e `tools\watchdog-app.err.log`.

> Rode na pasta que estiver com o app aberto: a cópia principal (a pasta do projeto) ou uma
> worktree em desenvolvimento. O script descobre a raiz sozinho pela pasta onde está.

## Opções úteis

| Opção | Para quê |
|---|---|
| `-Simular` | não encerra nem inicia nada; só registra o que faria (bom para conferir) |
| `-DebounceSegundos 6` | espera mais calma antes de reiniciar (levas grandes de arquivos) |
| `-EsperaAposIniciarSegundos 20` | carência maior depois de subir o app |
| `-SemLevantarSeCair` | não sobe de novo quando o app é fechado de propósito |
| `-Comando "npm.cmd run dev"` | no lugar do app inteiro, só o Vite (frontend) |
| `-Raiz "A:\outro\projeto"` | vigiar outra pasta |
| `-Vigiar src,src-tauri,index.html` | escolher o que vigiar |

## O que ele vigia

`src`, `src-tauri`, `index.html`, `package.json` e `vite.config.ts` — ignorando `node_modules`,
`dist`, `src-tauri\target`, `src-tauri\gen`, `.worktrees`, `public` e `temp`.

## Como ele se comporta

1. Tira uma "impressão" dos arquivos (caminho + data + tamanho) a cada ~1 s.
2. Quando algo muda, espera `-DebounceSegundos` (3 s) de calma — assim um `git rebase` que troca
   dezenas de arquivos gera **um** reinício, não dezenas.
3. Encerra a árvore do app (`npm run app`, o processo `mdOffice` e quem estiver na porta 1420) e
   sobe de novo com `-Comando`.
4. Depois de subir, espera `-EsperaAposIniciarSegundos` (12 s) antes de aceitar outro reinício.
5. Se o processo do app morrer sozinho, levanta de novo em 3 s (desligue com `-SemLevantarSeCair`).

Fechar a janela do watchdog **não** fecha o app: ele continua rodando como estava.
