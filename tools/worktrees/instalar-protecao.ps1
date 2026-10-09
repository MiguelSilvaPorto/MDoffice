#Requires -Version 5.1
# instalar-protecao.ps1 - Instala (ou remove) o hook que bloqueia commit direto na branch main.
#
# Recomendado: com varias IAs no mesmo repositorio, e o que impede de verdade o trabalho
# direto na main. O hook vale para TODAS as worktrees deste clone.
# Quem entrega na main e o fechar.ps1 (fast-forward), que nao dispara o pre-commit.
# Excecao consciente (humano): $env:MDOFFICE_PERMITIR_MAIN = '1' libera um commit na main.
#
# Uso:
#   tools\worktrees\instalar-protecao.ps1
#   tools\worktrees\instalar-protecao.ps1 -Desinstalar
#
# ASCII-only de proposito (PowerShell 5.1 le .ps1 UTF-8 sem BOM como ANSI).
[CmdletBinding()]
param(
  [switch]$Desinstalar
)

$ErrorActionPreference = 'Stop'
. "$PSScriptRoot\_comum.ps1"

$principal = (Get-Principal).Principal
$origem = Join-Path $principal 'tools\worktrees\hooks\pre-commit'

# O diretorio de hooks e compartilhado por todas as worktrees (git-common-dir).
$gitCommon = "$(Exec { git -C $principal rev-parse --git-common-dir })".Trim()
if (-not [System.IO.Path]::IsPathRooted($gitCommon)) { $gitCommon = Join-Path $principal $gitCommon }
$pastaHooks = Join-Path $gitCommon 'hooks'
$destino = Join-Path $pastaHooks 'pre-commit'

if ($Desinstalar) {
  if (Test-Path $destino) { Remove-Item $destino -Force; Write-Host "Hook removido: $destino" }
  else { Write-Host "Nao havia hook em: $destino" }
  exit 0
}

if (-not (Test-Path $origem)) { throw "Nao encontrei o hook em: $origem" }
New-Item -ItemType Directory -Force $pastaHooks | Out-Null
if (Test-Path $destino) { Write-Host "Ja existe um hook em: $destino - substituindo pelo hook de protecao da main..." }
Copy-Item $origem $destino -Force
Write-Host "Hook instalado: $destino"
Write-Host ""
Write-Host "A partir de agora, commit direto na branch main e bloqueado (neste clone inteiro,"
Write-Host "inclusive dentro das worktrees). Para desinstalar: instalar-protecao.ps1 -Desinstalar"
