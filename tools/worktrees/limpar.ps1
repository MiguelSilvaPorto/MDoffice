#Requires -Version 5.1
# limpar.ps1 - Remove a worktree de uma tarefa (e, com -ApagarBranch, a branch local).
#
# Roda de qualquer pasta do repo (usa sempre a copia principal). Nao apaga:
#   - worktree com alteracao nao commitada          (sem -Forcar)
#   - branch com commits que a main ainda nao tem   (sem -Forcar)
#
# Uso:
#   tools\worktrees\limpar.ps1 -Nome feat/minha-tarefa
#   tools\worktrees\limpar.ps1 -Nome feat/minha-tarefa -ApagarBranch
#   tools\worktrees\limpar.ps1 -Nome feat/minha-tarefa -Forcar -ApagarBranch   (descarta TUDO)
#
# ASCII-only de proposito (PowerShell 5.1 le .ps1 UTF-8 sem BOM como ANSI).
[CmdletBinding()]
param(
  [Parameter(Mandatory = $true, Position = 0)][string]$Nome,
  [switch]$ApagarBranch,
  [switch]$Forcar
)

$ErrorActionPreference = 'Stop'
. "$PSScriptRoot\_comum.ps1"

$repo = Get-Principal
$atual = $repo.Atual
$principal = $repo.Principal

$branch = $Nome.Trim()
if ($branch -notmatch '/') { $branch = "feat/$branch" }
$slug = $branch -replace '/', '-'
$destino = Join-Path (Join-Path $principal '.worktrees') $slug

if ($atual -eq $destino) {
  throw "Voce esta com o terminal DENTRO da worktree que quer remover. Saia dela (cd $principal) e rode de novo."
}

# a branch so pode ser apagada se a main ja tem tudo dela (ou com -Forcar)
if ($ApagarBranch -and -not $Forcar) {
  $existe = "$(Exec -PermitirFalha { git -C $principal rev-parse --verify --quiet "refs/heads/$branch" })".Trim()
  if ($existe) {
    $null = Exec -PermitirFalha { git -C $principal merge-base --is-ancestor $branch main }
    if ($LASTEXITCODE -ne 0) {
      throw "A branch '$branch' tem commits que a main NAO tem - apagar perderia trabalho. Entregue com o fechar.ps1 (de dentro da worktree) ou, se puder descartar, use -Forcar."
    }
  }
}

if (-not (Test-Path $destino)) {
  Write-Host "Nao existe worktree em: $destino"
  $null = Exec -PermitirFalha { git -C $principal worktree prune }
} else {
  # remove so os LINKS (junctions) antes: remocao recursiva no Windows pode seguir o link
  # e apagar o conteudo do alvo real (node_modules, modelos... da copia principal)
  Remove-Ligacoes -Pasta $destino

  $argsRemover = @('-C', $principal, 'worktree', 'remove', $destino)
  if ($Forcar) { $argsRemover += '--force' }
  $saida = Exec -PermitirFalha { & git @argsRemover }
  if ($LASTEXITCODE -ne 0) {
    throw "git worktree remove falhou - provavelmente ha alteracoes nao commitadas ou algum terminal/processo aberto na pasta.`nDica: feche terminais nessa pasta; se as alteracoes podem ser descartadas, use -Forcar.`n--- saida ---`n$($saida | Out-String)"
  }
  Write-Host "Worktree removida: $destino"
}

if ($ApagarBranch) {
  $null = Exec -PermitirFalha { git -C $principal branch -D $branch }
  if ($LASTEXITCODE -eq 0) { Write-Host "Branch local apagada: $branch" }
  else { Write-Host "Branch local '$branch' nao existe (ja apagada)." }
} else {
  Write-Host "Branch local mantida: $branch (use -ApagarBranch para apagar)."
}

Write-Host "Worktrees atuais:"
Exec { git -C $principal worktree list } | ForEach-Object { Write-Host "  $_" }
