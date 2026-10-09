#Requires -Version 5.1
# instalar-monitor.ps1 - Instala (ou remove) a tarefa agendada do Windows que roda o
# monitor-push.ps1 a cada poucos minutos: quando todas as worktrees terminam, a main vai
# sozinha para o GitHub (para voce trabalhar de outro lugar).
#
# Roda como o SEU usuario, sem precisar de administrador, escondida (sem janela).
# O monitor roda do caminho desta copia principal; se mover a pasta do projeto, reinstale.
#
# Uso:
#   tools\worktrees\instalar-monitor.ps1                       (a cada 2 minutos)
#   tools\worktrees\instalar-monitor.ps1 -IntervaloMinutos 5
#   tools\worktrees\instalar-monitor.ps1 -Remover
#   tools\worktrees\instalar-monitor.ps1 -Estado               (mostra a tarefa e o fim do log)
#
# ASCII-only de proposito (PowerShell 5.1 le .ps1 UTF-8 sem BOM como ANSI).
[CmdletBinding()]
param(
  [int]$IntervaloMinutos = 2,
  [switch]$Remover,
  [switch]$Estado
)

$ErrorActionPreference = 'Stop'
. "$PSScriptRoot\_comum.ps1"

$principal = (Get-Principal).Principal
$script = Join-Path $principal 'tools\worktrees\monitor-push.ps1'
$nome = 'MDOffice-MonitorPush'

$gitCommon = "$(Exec { git -C $principal rev-parse --git-common-dir })".Trim()
if (-not [System.IO.Path]::IsPathRooted($gitCommon)) { $gitCommon = Join-Path $principal $gitCommon }
$log = Join-Path $gitCommon 'mdoffice-monitor.log'

if ($Estado) {
  $t = Get-ScheduledTask -TaskName $nome -ErrorAction SilentlyContinue
  if ($t) {
    $info = Get-ScheduledTaskInfo -TaskName $nome
    Write-Host "Tarefa '$nome': $($t.State) | ultima execucao: $($info.LastRunTime) | proxima: $($info.NextRunTime)"
  } else { Write-Host "Tarefa '$nome' NAO esta instalada." }
  if (Test-Path $log) { Write-Host "--- fim do log ($log):"; Get-Content $log -Tail 8 } else { Write-Host "(log ainda vazio: o monitor so escreve quando algo acontece)" }
  exit 0
}

if ($Remover) {
  if (Get-ScheduledTask -TaskName $nome -ErrorAction SilentlyContinue) {
    Unregister-ScheduledTask -TaskName $nome -Confirm:$false
    Write-Host "Monitor removido (tarefa '$nome')."
  } else { Write-Host "O monitor nao estava instalado." }
  exit 0
}

if (-not (Test-Path $script)) { throw "Nao encontrei o monitor em: $script" }
if ($IntervaloMinutos -lt 1) { throw "O intervalo minimo e 1 minuto." }

# conhost --headless: roda o PowerShell sem abrir janela piscando a cada ciclo
$argumentos = "--headless powershell.exe -NoProfile -ExecutionPolicy Bypass -File `"$script`""
$acao = New-ScheduledTaskAction -Execute 'conhost.exe' -Argument $argumentos -WorkingDirectory $principal
$gatilho = New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(1) -RepetitionInterval (New-TimeSpan -Minutes $IntervaloMinutos)
$config = New-ScheduledTaskSettingsSet -StartWhenAvailable -MultipleInstances IgnoreNew -ExecutionTimeLimit (New-TimeSpan -Minutes 5) -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -Hidden
$usuario = [System.Security.Principal.WindowsIdentity]::GetCurrent().Name
$principalTarefa = New-ScheduledTaskPrincipal -UserId $usuario -LogonType Interactive -RunLevel Limited

Register-ScheduledTask -TaskName $nome -Action $acao -Trigger $gatilho -Settings $config -Principal $principalTarefa -Description 'MDOffice: envia a main para o GitHub quando todas as worktrees terminam (tools\worktrees\monitor-push.ps1)' -Force | Out-Null

Write-Host "Monitor instalado: tarefa '$nome', a cada $IntervaloMinutos minuto(s), como $usuario."
Write-Host "Quando nao houver nenhuma worktree ativa e a main estiver a frente do GitHub, ele da push sozinho."
Write-Host "Log: $log"
Write-Host "Para ver o estado: instalar-monitor.ps1 -Estado   |   Para remover: instalar-monitor.ps1 -Remover"
