#Requires -Version 5.1
# instalar-monitor.ps1 - Instala (ou remove) as tarefas agendadas do Windows que rodam os
# monitores do repositorio a cada poucos minutos:
#   - monitor-push.ps1: quando todas as worktrees terminam, a main vai sozinha para o GitHub
#   - monitor-main.ps1: registra no log quando a copia principal fica com alteracoes soltas
#
# Roda como o SEU usuario, sem precisar de administrador, escondida (sem janela).
# Os monitores rodam do caminho desta copia principal; se mover a pasta do projeto, reinstale.
#
# Uso:
#   tools\worktrees\instalar-monitor.ps1                       (a cada 2 minutos)
#   tools\worktrees\instalar-monitor.ps1 -IntervaloMinutos 5
#   tools\worktrees\instalar-monitor.ps1 -Remover
#   tools\worktrees\instalar-monitor.ps1 -Estado               (mostra as tarefas e o fim do log)
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
$gitCommon = "$(Exec { git -C $principal rev-parse --git-common-dir })".Trim()
if (-not [System.IO.Path]::IsPathRooted($gitCommon)) { $gitCommon = Join-Path $principal $gitCommon }
$log = Join-Path $gitCommon 'mdoffice-monitor.log'

# os monitores do repositorio: um cuida do envio da main, o outro avisa quando ela fica suja
$monitores = @(
  @{ Tarefa = 'MDOffice-MonitorPush'; Script = 'monitor-push.ps1'; Descricao = 'MDOffice: envia a main para o GitHub quando todas as worktrees terminam (tools\worktrees\monitor-push.ps1)' },
  @{ Tarefa = 'MDOffice-MonitorMain'; Script = 'monitor-main.ps1'; Descricao = 'MDOffice: registra no log quando a copia principal fica com alteracoes soltas (tools\worktrees\monitor-main.ps1)' }
)

if ($Estado) {
  foreach ($m in $monitores) {
    $t = Get-ScheduledTask -TaskName $m.Tarefa -ErrorAction SilentlyContinue
    if ($t) {
      $info = Get-ScheduledTaskInfo -TaskName $m.Tarefa
      Write-Host "Tarefa '$($m.Tarefa)': $($t.State) | ultima execucao: $($info.LastRunTime) | proxima: $($info.NextRunTime)"
    } else { Write-Host "Tarefa '$($m.Tarefa)' NAO esta instalada." }
  }
  if (Test-Path $log) { Write-Host "--- fim do log ($log):"; Get-Content $log -Tail 8 } else { Write-Host "(log ainda vazio: os monitores so escrevem quando algo acontece)" }
  exit 0
}

if ($Remover) {
  foreach ($m in $monitores) {
    if (Get-ScheduledTask -TaskName $m.Tarefa -ErrorAction SilentlyContinue) {
      Unregister-ScheduledTask -TaskName $m.Tarefa -Confirm:$false
      Write-Host "Monitor removido (tarefa '$($m.Tarefa)')."
    } else { Write-Host "O monitor '$($m.Tarefa)' nao estava instalado." }
  }
  exit 0
}

if ($IntervaloMinutos -lt 1) { throw "O intervalo minimo e 1 minuto." }

foreach ($m in $monitores) {
  $script = Join-Path $principal "tools\worktrees\$($m.Script)"
  if (-not (Test-Path $script)) { throw "Nao encontrei o monitor em: $script" }
}

$usuario = [System.Security.Principal.WindowsIdentity]::GetCurrent().Name
$principalTarefa = New-ScheduledTaskPrincipal -UserId $usuario -LogonType Interactive -RunLevel Limited

foreach ($m in $monitores) {
  $script = Join-Path $principal "tools\worktrees\$($m.Script)"

  # conhost --headless: roda o PowerShell sem abrir janela piscando a cada ciclo
  $argumentos = "--headless powershell.exe -NoProfile -ExecutionPolicy Bypass -File `"$script`""
  $acao = New-ScheduledTaskAction -Execute 'conhost.exe' -Argument $argumentos -WorkingDirectory $principal
  $gatilho = New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(1) -RepetitionInterval (New-TimeSpan -Minutes $IntervaloMinutos)
  $config = New-ScheduledTaskSettingsSet -StartWhenAvailable -MultipleInstances IgnoreNew -ExecutionTimeLimit (New-TimeSpan -Minutes 5) -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -Hidden

  Register-ScheduledTask -TaskName $m.Tarefa -Action $acao -Trigger $gatilho -Settings $config -Principal $principalTarefa -Description $m.Descricao -Force | Out-Null
  Write-Host "Monitor instalado: tarefa '$($m.Tarefa)', a cada $IntervaloMinutos minuto(s), como $usuario."
}

Write-Host ""
Write-Host "MonitorPush: quando nao houver nenhuma worktree ativa e a main estiver a frente do GitHub, ele da push sozinho."
Write-Host "MonitorMain: quando a copia principal ficar com alteracoes soltas, ele registra no log (e avisa quando ela voltar a ficar limpa)."
Write-Host "Log: $log"
Write-Host "Para ver o estado: instalar-monitor.ps1 -Estado   |   Para remover: instalar-monitor.ps1 -Remover"
