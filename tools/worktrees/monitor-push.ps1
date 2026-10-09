#Requires -Version 5.1
# monitor-push.ps1 - Envia a main para o GitHub quando todos os agentes terminaram.
#
# "Terminaram" = nao existe mais nenhuma worktree de tarefa registrada (todas fecharam e
# foram limpas). Nesse momento, se a main local esta a frente do origin, ele da push.
# Ele NAO olha o que cada tarefa fez: so confere se ha trabalho a enviar e se ninguem mais
# esta trabalhando. E a rede de seguranca do push automatico do fechar.ps1 (cobre push que
# falhou por falta de rede e fechamentos com -SemPush).
#
# Roda sozinho, a cada poucos minutos, por uma tarefa agendada do Windows (instale com
# tools\worktrees\instalar-monitor.ps1). Pode ser rodado a mao: tools\worktrees\monitor-push.ps1
#
# Nunca faz force push, nunca mexe em arquivos, nunca troca de branch. Se a main local e o
# origin divergiram (alguem enviou commits de outro lugar), ele NAO envia: registra no log e
# espera voce resolver (git pull).
#
# Log: .git\mdoffice-monitor.log (aparece so quando algo acontece; uma linha por evento)
#
# ASCII-only de proposito (PowerShell 5.1 le .ps1 UTF-8 sem BOM como ANSI).
[CmdletBinding()]
param(
  [switch]$Simular
)

$ErrorActionPreference = 'Continue'

# a copia principal e a pasta pai de tools\worktrees
$principal = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path.TrimEnd('\')

function Git { & git -C $principal @args 2>&1 | ForEach-Object { "$_" } }

$gitCommon = ("$(& git -C $principal rev-parse --git-common-dir 2>$null)").Trim()
if (-not $gitCommon) { exit 0 }
if (-not [System.IO.Path]::IsPathRooted($gitCommon)) { $gitCommon = Join-Path $principal $gitCommon }
$log = Join-Path $gitCommon 'mdoffice-monitor.log'
$estado = Join-Path $gitCommon 'mdoffice-monitor.estado'

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
$mutex = New-Object System.Threading.Mutex($false, 'Global\mdoffice-monitor-push')
if (-not $mutex.WaitOne(0)) { exit 0 }
try {
  # 1) alguem ainda trabalhando? (worktree registrada alem da principal, ou fechar.ps1 em andamento)
  $ativas = 0
  foreach ($linha in @(& git -C $principal worktree list --porcelain 2>$null)) {
    if ("$linha" -like 'worktree *') {
      $caminho = ("$linha".Substring(9).Trim() -replace '/', '\').TrimEnd('\')
      if ($caminho -ine $principal) { $ativas++ }
    }
  }
  if ($ativas -gt 0) { LogarMudanca "aguardando-$ativas" "AGUARDANDO  $ativas worktree(s) ativa(s) - envio quando todas terminarem"; exit 0 }
  if (Test-Path (Join-Path $gitCommon 'mdoffice-fechar.lock')) { exit 0 }

  # 2) o repositorio esta no estado esperado?
  $branch = ("$(& git -C $principal symbolic-ref --short HEAD 2>$null)").Trim()
  if ($branch -ne 'main') { LogarMudanca "fora-da-main" "IGNORADO    a copia principal esta na branch '$branch', nao na main - nada enviado"; exit 0 }
  $origin = ("$(& git -C $principal remote get-url origin 2>$null)").Trim()
  if (-not $origin) { exit 0 }

  # 3) ha o que enviar?
  $null = & git -C $principal fetch origin main --quiet 2>&1
  if ($LASTEXITCODE -ne 0) { LogarMudanca "sem-rede" "SEM REDE     nao consegui consultar o origin - tento de novo no proximo ciclo"; exit 0 }
  $cont = ("$(& git -C $principal rev-list --left-right --count 'origin/main...main' 2>$null)").Trim() -split '\s+'
  if ($cont.Count -lt 2) { exit 0 }
  $atras = [int]$cont[0]
  $frente = [int]$cont[1]
  if ($frente -eq 0) { LogarMudanca "em-dia" "EM DIA       main e origin/main iguais - nada a enviar"; exit 0 }
  if ($atras -gt 0) {
    LogarMudanca "divergiu-$atras-$frente" "DIVERGIU     main tem $frente commit(s) novo(s) e o origin tem $atras que a main nao tem - NAO enviei. Rode 'git pull' na copia principal e resolva."
    exit 0
  }

  # 4) envia
  if ($Simular) { Write-Host "SIMULACAO: enviaria $frente commit(s) da main para o origin."; exit 0 }
  $saida = & git -C $principal push origin main 2>&1 | ForEach-Object { ("$_" -replace '://[^@\s]+@', '://***@') }
  if ($LASTEXITCODE -eq 0) {
    Logar "ENVIADO      $frente commit(s) da main foram para o GitHub (nenhuma worktree ativa)"
    Set-Content -Path $estado -Value 'enviado' -Encoding ASCII
  } else {
    LogarMudanca "push-falhou" "FALHOU      push da main recusado: $((@($saida) | Select-Object -First 2) -join ' | ') - tento de novo no proximo ciclo"
  }
} finally {
  $mutex.ReleaseMutex()
  $mutex.Dispose()
}
