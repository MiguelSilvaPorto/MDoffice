#Requires -Version 5.1
# status.ps1 - Painel do fluxo: worktrees ativas, estado da main, branches locais de tarefa
# e limpeza pendente. Somente leitura.
#
# Uso: tools\worktrees\status.ps1
#
# ASCII-only de proposito (PowerShell 5.1 le .ps1 UTF-8 sem BOM como ANSI).
[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
. "$PSScriptRoot\_comum.ps1"

$repo = Get-Principal
$principal = $repo.Principal

Write-Host "== Worktrees =="
Exec { git -C $principal worktree list } | ForEach-Object { Write-Host "  $_" }

Write-Host ""
Write-Host "== Copia principal =="
$naPrincipal = "$(Exec { git -C $principal symbolic-ref --short HEAD })".Trim()
if ($naPrincipal -ne 'main') { Write-Host "  ATENCAO: esta na branch '$naPrincipal' - deveria estar sempre na main." }
else { Write-Host "  na main (correto)" }
$sujo = @(Exec { git -C $principal status --porcelain } | Where-Object { $_ -notmatch '^\?\? \.worktrees/' })
if ($sujo.Count -gt 0) { Write-Host "  ATENCAO: $($sujo.Count) alteracao(oes) solta(s) na main - trabalho direto na main e proibido (use uma worktree)." }
else { Write-Host "  limpa (sem alteracoes soltas)" }

Write-Host ""
Write-Host "== Main vs origin =="
$temOrigin = "$(Exec -PermitirFalha { git -C $principal remote get-url origin })".Trim()
if ($temOrigin) {
  $cont = Exec -PermitirFalha { git -C $principal rev-list --left-right --count 'origin/main...main' }
  if ("$cont".Trim()) {
    $p = "$cont".Trim() -split '\s+'
    Write-Host ("  main esta {0} commit(s) a frente e {1} atras do origin/main (ultimo fetch)" -f $p[1], $p[0])
    if ([int]$p[1] -gt 0) { Write-Host "  (o fechar.ps1 e o monitor-push.ps1 enviam sozinhos)" }
  } else {
    Write-Host "  (sem origin/main baixado - rode git fetch para comparar)"
  }
} else {
  Write-Host "  (sem remote origin)"
}

Write-Host ""
Write-Host "== Branches locais de tarefa =="
$branches = @(Exec -PermitirFalha { git -C $principal branch --list 'feat/*' 'fix/*' 'docs/*' 'refactor/*' 'chore/*' 'test/*' 'perf/*' } | Where-Object { "$_".Trim() })
if ($branches.Count -gt 0) { $branches | ForEach-Object { Write-Host "  $_" } } else { Write-Host "  (nenhuma)" }

Write-Host ""
Write-Host "== Limpeza pendente =="
$registradas = @()
foreach ($linha in @(Exec -PermitirFalha { git -C $principal worktree list --porcelain })) {
  if ("$linha" -like 'worktree *') {
    $caminho = "$linha".Substring(9).Trim() -replace '/', '\'
    if ($caminho -ine $principal) { $registradas += $caminho }
  }
}
$pendencias = @()
foreach ($caminho in $registradas) {
  if (Test-Path $caminho) {
    $s = @(& git -C $caminho status --porcelain 2>$null | Where-Object { "$_".Trim() })
    $null = & git -C $caminho merge-base --is-ancestor HEAD main 2>$null
    if ($s.Count -eq 0 -and $LASTEXITCODE -eq 0) {
      $pendencias += "PODE LIMPAR : $(Split-Path $caminho -Leaf)  (limpa e ja entregue na main; limpar.ps1 -Nome <branch> -ApagarBranch)"
    } elseif ($s.Count -gt 0) {
      $pendencias += "EM ANDAMENTO: $(Split-Path $caminho -Leaf)  ($($s.Count) alteracao(oes) sem commit)"
    } else {
      $pendencias += "A ENTREGAR  : $(Split-Path $caminho -Leaf)  (commits que a main ainda nao tem - fechar.ps1)"
    }
  }
}
$pastaWt = Join-Path $principal '.worktrees'
foreach ($d in @(Get-ChildItem $pastaWt -Directory -Force -ErrorAction SilentlyContinue)) {
  $ehRegistrada = $false
  foreach ($c in $registradas) { if ($c -ieq $d.FullName) { $ehRegistrada = $true } }
  if (-not $ehRegistrada) { $pendencias += "FANTASMA    : $($d.Name)  (pasta sem registro no git; limpar-agendada.ps1 -Nome $($d.Name) resolve)" }
}
if ($pendencias.Count -gt 0) { $pendencias | ForEach-Object { Write-Host "  $_" } } else { Write-Host "  (nada pendente - tudo limpo)" }
