#Requires -Version 5.1
# monitor-main.ps1 - Registra no log quando a copia principal fica com alteracoes soltas.
#
# O hook pre-commit (instalar-protecao.ps1) bloqueia o COMMIT na main, mas nao impede as
# EDICOES: arquivos editados direto na copia principal so apareceriam quando alguem rodasse
# o status.ps1. Este monitor fecha esse ponto cego: a cada poucos minutos ele olha o estado
# da copia principal e registra no log quando aparece - e quando some - alteracao sem commit.
# E o irmao do monitor-push.ps1 (que cuida do envio da main para o GitHub).
#
# Roda sozinho, a cada poucos minutos, por uma tarefa agendada do Windows (instale com
# tools\worktrees\instalar-monitor.ps1). Pode ser rodado a mao: tools\worktrees\monitor-main.ps1
#
# Nunca mexe em arquivos, nunca commita, nunca troca de branch: so olha e registra.
# Log: .git\mdoffice-monitor.log (o mesmo do monitor de push; uma linha por evento)
#
# ASCII-only de proposito (PowerShell 5.1 le .ps1 UTF-8 sem BOM como ANSI).
[CmdletBinding()]
param(
  # pasta a olhar (padrao: a copia principal) - permite testar o monitor sem sujar a main
  [string]$Pasta
)

$ErrorActionPreference = 'Continue'

# a copia principal e a pasta pai de tools\worktrees, mesmo rodando de dentro de uma worktree
$principal = ((Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path.TrimEnd('\') -replace '\\\.worktrees\\.*$', '')
if (-not $Pasta) { $Pasta = $principal }
if (-not (Test-Path $Pasta)) { exit 0 }
$Pasta = (Resolve-Path $Pasta).Path.TrimEnd('\')

$gitCommon = ("$(& git -C $principal rev-parse --git-common-dir 2>$null)").Trim()
if (-not $gitCommon) { exit 0 }
if (-not [System.IO.Path]::IsPathRooted($gitCommon)) { $gitCommon = Join-Path $principal $gitCommon }
$log = Join-Path $gitCommon 'mdoffice-monitor.log'
$estado = Join-Path $gitCommon 'mdoffice-monitor-main.estado'

function Logar([string]$Texto) {
  $utf8 = New-Object System.Text.UTF8Encoding($false)
  [System.IO.File]::AppendAllText($log, "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')  $Texto`r`n", $utf8)
}

# so loga quando o motivo muda (o monitor roda a cada poucos minutos; sem isso o log encheria)
function LogarMudanca([string]$Chave, [string]$Texto) {
  $antes = ''
  if (Test-Path $estado) { $antes = (Get-Content $estado -Raw -ErrorAction SilentlyContinue) }
  if ("$antes".Trim() -ne $Chave) {
    Logar $Texto
    Set-Content -Path $estado -Value $Chave -Encoding ASCII
  }
}

# um monitor por vez
$mutex = New-Object System.Threading.Mutex($false, 'Global\mdoffice-monitor-main')
if (-not $mutex.WaitOne(0)) { exit 0 }
try {
  $quem = if ($Pasta -ieq $principal) { 'a copia principal' } else { "a pasta $Pasta" }
  $onde = if ($Pasta -ieq $principal) { 'na copia principal' } else { "na pasta $Pasta" }

  # alteracoes soltas (a pasta .worktrees e os logs sao ignorados pelo .gitignore)
  $soltas = @(& git -C $Pasta status --porcelain 2>$null | Where-Object { "$_".Trim() })
  if ($LASTEXITCODE -ne 0) { LogarMudanca 'erro' "IGNORADO     nao consegui olhar $quem (git status falhou)"; exit 0 }

  if ($soltas.Count -eq 0) {
    LogarMudanca 'limpa' "LIMPA        $quem esta sem alteracoes soltas"
    exit 0
  }

  $nomes = @($soltas | ForEach-Object { "$_".Substring(3).Trim() })
  $mostra = (@($nomes | Select-Object -First 6) -join ', ')
  $extra = if ($nomes.Count -gt 6) { " (+$($nomes.Count - 6))" } else { '' }
  LogarMudanca "suja-$($nomes -join '|')" "MAIN SUJA    $($soltas.Count) alteracao(oes) solta(s) $onde`: $mostra$extra - trabalho direto na main e proibido (use uma worktree)"
} finally {
  $mutex.ReleaseMutex()
  $mutex.Dispose()
}
