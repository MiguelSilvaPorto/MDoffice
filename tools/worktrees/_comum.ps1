# _comum.ps1 - Funcoes compartilhadas pelos scripts de tools\worktrees (use com: . "$PSScriptRoot\_comum.ps1").
#
# ASCII-only de proposito: o PowerShell 5.1 le arquivos .ps1 UTF-8 sem BOM como
# ANSI - acento em script vira mojibake. Nao "corrija" isso.

# Pastas que a worktree enxerga por JUNCTION (link para a copia principal) em vez de copia:
# dependencias e arquivos pesados que o git ignora e que o app precisa para rodar.
$script:PastasLigadas = @('node_modules', 'public\modelos', 'public\ort', 'public\dicionario', 'public\ngrams')

# Executa um comando externo sem morrer com o stderr do PS 5.1 e checa o exit code.
function Exec {
  param(
    [Parameter(Mandatory = $true)][scriptblock]$Cmd,
    [string]$Erro = 'Comando externo falhou.',
    [switch]$PermitirFalha
  )
  $ErrorActionPreference = 'Continue'
  $saida = & $Cmd 2>&1 | ForEach-Object {
    if ($_ -is [System.Management.Automation.ErrorRecord]) { $_.ToString() } else { "$_" }
  }
  if ($LASTEXITCODE -ne 0 -and -not $PermitirFalha) {
    throw "$Erro`n--- saida do comando ---`n$($saida | Out-String)"
  }
  return $saida
}

# Caminho da copia principal (a que fica na main), mesmo rodando de dentro de uma worktree.
function Get-Principal {
  $atual = Exec -PermitirFalha { git rev-parse --show-toplevel }
  $atual = "$atual".Trim()
  if (-not $atual) { throw "Nao estou dentro de um repositorio git." }
  $atual = $atual -replace '/', '\'
  return [pscustomobject]@{
    Atual     = $atual
    Principal = ($atual -replace '\\\.worktrees\\.*$', '')
    EmWorktree = ($atual -match '\\\.worktrees\\')
  }
}

# Nome da branch de uma worktree. Durante um rebase o HEAD fica "solto"
# (detached), e o nome verdadeiro esta no head-name do proprio rebase.
function Get-BranchAtual {
  param([Parameter(Mandatory = $true)][string]$Pasta)
  $gitDir = "$(Exec -PermitirFalha { git -C $Pasta rev-parse --absolute-git-dir })".Trim()
  if ($gitDir) {
    foreach ($sub in 'rebase-merge', 'rebase-apply') {
      $arquivo = Join-Path $gitDir "$sub\head-name"
      if (Test-Path $arquivo) {
        return ("$(Get-Content $arquivo -Raw)".Trim() -replace '^refs/heads/', '')
      }
    }
  }
  return "$(Exec -PermitirFalha { git -C $Pasta symbolic-ref --short HEAD })".Trim()
}

# Descricao de uma branch ("Porque"/"Proposito"), guardada no config do repo.
function Get-DescricaoBranch {
  param([Parameter(Mandatory = $true)][string]$Pasta, [string]$Branch)
  if (-not $Branch) { return '' }
  $linhas = @(Exec -PermitirFalha { git -C $Pasta config --get "branch.$Branch.description" } | Where-Object { "$_".Trim() })
  return ($linhas -join ' | ')
}

# Remove SO OS LINKS (junctions) de uma worktree, sem tocar no alvo. No Windows uma remocao
# recursiva pode seguir o link e apagar o CONTEUDO do alvo real (node_modules, modelos...).
function Remove-Ligacoes {
  param([Parameter(Mandatory = $true)][string]$Pasta)
  $alvos = @()
  foreach ($rel in $script:PastasLigadas) { $alvos += (Join-Path $Pasta $rel) }
  # qualquer link de primeiro nivel que tenha sobrado
  if (Test-Path $Pasta) {
    foreach ($it in @(Get-ChildItem $Pasta -Force -ErrorAction SilentlyContinue)) {
      if ($it.Attributes -band [System.IO.FileAttributes]::ReparsePoint) { $alvos += $it.FullName }
    }
  }
  foreach ($caminho in ($alvos | Select-Object -Unique)) {
    if (-not (Test-Path $caminho)) { continue }
    $item = Get-Item $caminho -Force -ErrorAction SilentlyContinue
    if ($item -and ($item.Attributes -band [System.IO.FileAttributes]::ReparsePoint)) {
      if ($item.PSIsContainer) { [System.IO.Directory]::Delete($item.FullName, $false) }
      else { [System.IO.File]::Delete($item.FullName) }
      Write-Host "Link removido (apenas o link; alvo intacto): $caminho"
    }
  }
}
