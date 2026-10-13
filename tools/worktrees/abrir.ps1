#Requires -Version 5.1
# abrir.ps1 - Cria a worktree isolada de uma tarefa (fluxo do AGENTS.md).
#
# Uso:
#   tools\worktrees\abrir.ps1 feat/minha-tarefa
#   tools\worktrees\abrir.ps1 fix/outro-bug -SemDeps
#   tools\worktrees\abrir.ps1 feat/tarefa-antiga -Reabrir   (branch que ja existe)
#   tools\worktrees\abrir.ps1 feat/x -Atualizar             (baixa a main do origin antes, se der)
#   tools\worktrees\abrir.ps1 -Branch feat/minha-tarefa -Porque "corrige o bug X" -Proposito "entregar Y"
#     (a descricao fica guardada na branch: aparece no status.ps1 e no corpo do commit do fechar.ps1)
#
# Roda da copia principal (o script recusa rodar de dentro de uma worktree).
# A copia principal NUNCA sai da branch main e nunca recebe trabalho direto.
#
# ASCII-only de proposito (PowerShell 5.1 le .ps1 UTF-8 sem BOM como ANSI).
[CmdletBinding()]
param(
  [Parameter(Position = 0)][string]$Nome,
  [string]$Branch,
  [string]$Porque,
  [string]$Proposito,
  [switch]$Reabrir,
  [switch]$SemDeps,
  [switch]$Atualizar
)

$ErrorActionPreference = 'Stop'
. "$PSScriptRoot\_comum.ps1"

$repo = Get-Principal
if ($repo.EmWorktree) {
  throw "Voce esta DENTRO de uma worktree ($($repo.Atual)). Trabalhe nela, ou rode este script fora dela."
}
$principal = $repo.Principal
$raizWorktrees = Join-Path $principal '.worktrees'

# -- normaliza e valida o nome da branch --------------------------------------
$pedido = if ($Branch) { "$Branch".Trim() } else { "$Nome".Trim() }
if (-not $pedido) {
  throw "Diga o nome da branch: abrir.ps1 feat/minha-tarefa  (ou -Branch feat/minha-tarefa)"
}
if ($Nome -and $Branch -and ("$Nome".Trim() -ne "$Branch".Trim())) {
  throw "Nome posicional ('$("$Nome".Trim())') e -Branch ('$("$Branch".Trim())') sao diferentes - use so um."
}
$branch = $pedido
if ($branch -notmatch '/') { $branch = "feat/$branch" }
if ($branch -notmatch '^(feat|fix|docs|refactor|chore|test|perf)/[a-z0-9][a-z0-9._-]*$') {
  throw "Nome de branch invalido: '$branch'. Use minusculas, sem espaco/acento, no padrao feat/alguma-coisa. Prefixos: feat, fix, docs, refactor, chore, test, perf."
}
$porque = if ($Porque) { "$Porque".Trim() } else { '' }
$proposito = if ($Proposito) { "$Proposito".Trim() } else { '' }
$slug = $branch -replace '/', '-'
$destino = Join-Path $raizWorktrees $slug
if (Test-Path $destino) { throw "Ja existe uma worktree em: $destino" }

# -- checagens da copia principal ---------------------------------------------
$branchPrincipal = "$(Exec { git -C $principal symbolic-ref --short HEAD })".Trim()
if ($branchPrincipal -ne 'main') {
  throw "A copia principal esta na branch '$branchPrincipal' - ela deve ficar sempre na main. Volte para a main antes de criar uma worktree."
}
$sujo = @(Exec { git -C $principal status --porcelain } | Where-Object {
  $_ -notmatch '^\?\? \.worktrees/'
})
if ($sujo.Count -gt 0) {
  Write-Warning "A copia principal tem alteracoes nao commitadas (provavelmente trabalho feito direto na main, o que e proibido). A worktree nasce so do que esta COMMITADO na main; essas alteracoes NAO vao junto:"
  $sujo | ForEach-Object { Write-Host "  $_" }
}

# -- base: a main local (opcionalmente atualizada pelo origin) -----------------
if ($Atualizar) {
  $temOrigin = "$(Exec -PermitirFalha { git -C $principal remote get-url origin })".Trim()
  if ($temOrigin) {
    Write-Host "Baixando a main do origin..."
    $null = Exec -PermitirFalha { git -C $principal fetch origin main --quiet }
    if ($LASTEXITCODE -eq 0 -and $sujo.Count -eq 0) {
      $null = Exec -PermitirFalha { git -C $principal merge --ff-only origin/main }
      if ($LASTEXITCODE -ne 0) { Write-Warning "A main local nao pode avancar para origin/main sem merge (ela tem commits que o origin nao tem). Seguindo com a main local." }
    }
  } else {
    Write-Host "Sem remote origin - usando a main local."
  }
}
$base = 'main'

New-Item -ItemType Directory -Force $raizWorktrees | Out-Null

$temLocal = "$(Exec -PermitirFalha { git -C $principal rev-parse --verify --quiet "refs/heads/$branch" })".Trim()
if ($Reabrir) {
  if (-not $temLocal) { throw "A branch '$branch' nao existe localmente. Sem -Reabrir ela e criada do zero." }
  $null = Exec { git -C $principal worktree add $destino $branch } "git worktree add falhou para a branch '$branch'."
} else {
  if ($temLocal) { throw "A branch '$branch' ja existe localmente. Use -Reabrir para reanexa-la numa worktree." }
  $null = Exec { git -C $principal worktree add -b $branch $destino $base } "git worktree add falhou."
}

# -- node_modules e arquivos pesados por junction (nao copia, nao reinstala) ---
$ligados = @()
if (-not $SemDeps) {
  foreach ($rel in $script:PastasLigadas) {
    $origem = Join-Path $principal $rel
    if (-not (Test-Path $origem)) { continue }
    $alvo = Join-Path $destino $rel
    $pai = Split-Path $alvo -Parent
    if (-not (Test-Path $pai)) { continue }
    if (Test-Path $alvo) { continue }
    try {
      New-Item -ItemType Junction -Path $alvo -Target $origem | Out-Null
      $ligados += $rel
    } catch {
      Write-Warning "Nao consegui ligar $rel (junction): $($_.Exception.Message)"
    }
  }
}

# -- descricao da branch: por que ela existe e o que entrega -------------------
$linhasDescricao = @()
if ($porque) { $linhasDescricao += "Porque: $porque" }
if ($proposito) { $linhasDescricao += "Proposito: $proposito" }
if ($linhasDescricao.Count -gt 0) {
  $descricao = $linhasDescricao -join "`n"
  $null = Exec { git -C $principal config "branch.$branch.description" $descricao } "Nao consegui guardar a descricao da branch."
}

$commitBase = "$(Exec { git -C $principal rev-parse --short $base })".Trim()
Write-Host ""
Write-Host "OK - worktree pronta:"
Write-Host "  branch : $branch"
Write-Host "  pasta  : $destino"
Write-Host "  base   : $base (commit $commitBase)"
if ($SemDeps) { Write-Host "  links  : nenhum (-SemDeps) - rode npm install na worktree se precisar" }
elseif ($ligados.Count -gt 0) { Write-Host "  links  : $($ligados -join ', ') (junction para a copia principal; se a tarefa mexer no package.json, remova o link de node_modules e rode npm install)" }
else { Write-Host "  links  : nada para ligar - rode npm install na worktree se precisar" }
if ($porque) { Write-Host "  porque : $porque" }
if ($proposito) { Write-Host "  proposito: $proposito" }
Write-Host ""
Write-Host "Trabalhe DENTRO dessa pasta (nunca na copia principal)."
Write-Host "Para fechar a tarefa, de dentro da worktree: tools\worktrees\fechar.ps1 -Mensagem `"...`""
