#Requires -Version 5.1
<#
.SYNOPSIS
  Vigia o código do mdOffice e mantém o app em execução (watchdog de desenvolvimento).

.DESCRIPTION
  Reinicia o app automaticamente sempre que algum arquivo vigiado muda e o levanta de novo
  se ele cair sozinho. Foi feito para o fluxo do projeto: o app roda na cópia principal e o
  código chega por git (fechamento de worktrees, pull); sem isto é preciso matar o processo
  e rodar `npm run app` à mão a cada atualização.

  O que ele faz em cada ciclo:
    1. tira uma "impressão" dos arquivos vigiados (caminho + data + tamanho);
    2. quando a impressão muda, espera alguns segundos de calma (debounce) para não reiniciar
       no meio de uma leva de arquivos (git, rebase, salvamento em massa);
    3. encerra a árvore do app (npm/tauri, processo do app e quem estiver na porta do Vite)
       e sobe de novo com o comando configurado;
    4. se o processo do app morrer por conta própria, sobe de novo (com -SemLevantarSeCair,
       essa parte fica desligada e ele só reinicia em mudanças de código);
    5. se a PÁGINA travar — processo vivo, janela de pé, conteúdo morto — reinicia o app. É o
       caso que o item 4 não pega, e acontece depois de muitos recarregamentos.

  Para saber se a página responde ele pergunta ao servidor de dev
  (http://localhost:<PortaVite>/__vivo/estado) quando foi o último aviso de vida. O aviso sai
  de src/app/batimento.ts a cada 5 s e só existe em desenvolvimento — sem servidor no ar, ele
  não julga (aí o item 4 continua valendo).

  O log fica em tools\watchdog.log (e a saída do app em tools\watchdog-app*.log).
  Nada é copiado nem commitado: é só uma ferramenta local.

.PARAMETER Raiz
  Pasta do projeto vigiada (padrão: a pasta acima de tools\).

.PARAMETER Comando
  Comando que sobe o app (padrão: "npm.cmd run app").

.PARAMETER Vigiar
  Pastas/arquivos vigiados, relativos à raiz.

.PARAMETER Ignorar
  Nomes de pasta ignorados em qualquer nível (node_modules, target, .worktrees…).

.PARAMETER IntervaloSegundos
  De quanto em quanto tempo olhar os arquivos (padrão: 1,2 s).

.PARAMETER DebounceSegundos
  Quanto tempo de calma esperar depois da última mudança antes de reiniciar (padrão: 3 s).

.PARAMETER EsperaAposIniciarSegundos
  Carência depois de subir o app, para não reiniciar no meio da subida (padrão: 12 s).

.PARAMETER PortaVite
  Porta do servidor de desenvolvimento, para liberar antes de subir de novo (padrão: 1420).

.PARAMETER ProcessoApp
  Nome do processo do app, encerrado no reinício (padrão: mdOffice).

.PARAMETER TravadoSegundos
  Quanto tempo a página pode ficar sem avisar (depois de já ter avisado uma vez) antes de
  contar como travada (padrão: 90). O aviso sai a cada 5 s; quando a janela está minimizada o
  navegador limita os timers a cerca de um por minuto, então o padrão tem folga de sobra. Use
  0 para desligar a checagem de travamento.

.PARAMETER TravadoNaSubidaSegundos
  Prazo, desde a subida do app, para a página dar o PRIMEIRO aviso (padrão: 180). É maior
  porque a página carrega dicionário e modelo antes de conseguir avisar.

.PARAMETER Simular
  Não encerra nem inicia nada: só registra o que faria. Bom para conferir a detecção.

.PARAMETER SemLevantarSeCair
  Desliga o "levantar de novo se cair": só reinicia quando o código muda. Vale também para a
  página travada — o app só é mexido quando o código muda.

.EXAMPLE
  tools\watchdog.cmd
  Vigia e mantém o app de desenvolvimento rodando.

.EXAMPLE
  tools\watchdog.cmd -Simular
  Só mostra o que faria a cada mudança (não toca no app que já está aberto).

.EXAMPLE
  tools\watchdog.cmd -DebounceSegundos 6 -IntervaloSegundos 2
  Mais calmo, para máquinas lentas ou levas grandes de arquivos.
#>
[CmdletBinding()]
param(
  [string]$Raiz = "",
  [string]$Comando = "npm.cmd run app",
  [string[]]$Vigiar = @("src", "src-tauri", "index.html", "package.json", "vite.config.ts"),
  [string[]]$Ignorar = @("node_modules", "dist", "target", "gen", ".git", ".worktrees", "public", "temp"),
  [double]$IntervaloSegundos = 1.2,
  [double]$DebounceSegundos = 3,
  [double]$EsperaAposIniciarSegundos = 12,
  [int]$PortaVite = 1420,
  [string]$ProcessoApp = "mdoffice",
  [int]$TravadoSegundos = 90,
  [int]$TravadoNaSubidaSegundos = 180,
  [string]$Log = "",
  [switch]$Simular,
  [switch]$SemLevantarSeCair
)

$ErrorActionPreference = "Continue"

# O $PSScriptRoot não existe nos valores padrão do param quando o script é chamado por caminho
# relativo (peculiaridade do PowerShell 5.1): a raiz e o log são resolvidos aqui no corpo.
if (-not $Raiz) { $Raiz = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path }
if (-not $Log) { $Log = Join-Path $PSScriptRoot "watchdog.log" }
# log grande demais (meses de uso): recomeça
try {
  if ((Test-Path -LiteralPath $Log) -and ((Get-Item -LiteralPath $Log).Length -gt 1MB)) { Remove-Item -LiteralPath $Log -Force }
} catch { }

$script:pidApp = $null

function Registrar([string]$texto) {
  $linha = "{0}  {1}" -f (Get-Date -Format "yyyy-MM-dd HH:mm:ss"), $texto
  Write-Host $linha
  try { Add-Content -LiteralPath $Log -Value $linha -Encoding UTF8 } catch { }
}

# --- impressão dos arquivos vigiados -----------------------------------------

function ArquivosVigiados {
  $itens = @()
  $base = $Raiz.TrimEnd("\")
  foreach ($rel in $Vigiar) {
    $caminho = Join-Path $base $rel
    if (Test-Path -LiteralPath $caminho -PathType Container) {
      $itens += Get-ChildItem -LiteralPath $caminho -Recurse -File -ErrorAction SilentlyContinue | Where-Object {
        # o trecho ignorado vale só DENTRO da raiz: o caminho da própria raiz pode conter
        # ".worktrees" (quando o vigia roda numa worktree), e aí nada seria vigiado
        $dentro = $_.FullName.Substring($base.Length)
        $ok = $true
        foreach ($ig in $Ignorar) {
          if ($dentro -match "\\$([regex]::Escape($ig))\\") { $ok = $false; break }
        }
        $ok
      }
    } elseif (Test-Path -LiteralPath $caminho) {
      $itens += Get-Item -LiteralPath $caminho -ErrorAction SilentlyContinue
    }
  }
  return $itens
}

function Impressao {
  $itens = ArquivosVigiados | Sort-Object FullName
  return (($itens | ForEach-Object { "{0}|{1}|{2}" -f $_.FullName, $_.LastWriteTimeUtc.Ticks, $_.Length }) -join "`n")
}

# --- app: encerrar e subir ---------------------------------------------------

function EncerrarArvore([int]$id, [string]$motivo) {
  if (-not $id) { return }
  if ($Simular) {
    Registrar "SIMULAR: encerraria o processo $id ($motivo)"
    return
  }
  & taskkill.exe /PID $id /T /F 2>$null | Out-Null
}

function PararApp {
  if ($Simular) {
    Registrar "SIMULAR: pararia o app (processo $ProcessoApp e quem estiver na porta $PortaVite)"
    return
  }
  if ($script:pidApp) { EncerrarArvore $script:pidApp "npm run app" }
  Get-Process -Name $ProcessoApp -ErrorAction SilentlyContinue | ForEach-Object { EncerrarArvore $_.Id "app" }
  try {
    Get-NetTCPConnection -LocalPort $PortaVite -State Listen -ErrorAction SilentlyContinue |
      Select-Object -ExpandProperty OwningProcess -Unique |
      ForEach-Object { EncerrarArvore $_ "porta $PortaVite" }
  } catch { }
  # espera a porta soltar (até 5 s) antes de subir de novo
  for ($i = 0; $i -lt 20; $i++) {
    Start-Sleep -Milliseconds 250
    $dono = $null
    try { $dono = Get-NetTCPConnection -LocalPort $PortaVite -State Listen -ErrorAction SilentlyContinue } catch { }
    if (-not $dono) { return }
  }
  Registrar "aviso: a porta $PortaVite continua ocupada; subindo assim mesmo"
}

function IniciarApp {
  if ($Simular) {
    Registrar "SIMULAR: iniciaria '$Comando' em $Raiz"
    return
  }
  $saida = Join-Path $PSScriptRoot "watchdog-app.log"
  $erros = Join-Path $PSScriptRoot "watchdog-app.err.log"
  $proc = Start-Process -FilePath "cmd.exe" -ArgumentList "/c", $Comando -WorkingDirectory $Raiz -PassThru -WindowStyle Minimized `
    -RedirectStandardOutput $saida -RedirectStandardError $erros
  $script:pidApp = $proc.Id
  Registrar "app iniciado (processo $($script:pidApp)): $Comando"
}

# --- a página ainda responde? -------------------------------------------------
#
# O processo vivo não quer dizer app funcionando: depois de muitos recarregamentos o
# conteúdo da janela pode morrer e a janela continuar de pé. Quem responde por isso é o
# aviso de vida que a página manda ao servidor de dev (src/app/batimento.ts).

function EstadoDaPagina {
  # Sem servidor de dev no ar não há como julgar — o "caiu" cobre esse caso.
  try {
    return Invoke-RestMethod -Uri "http://localhost:$PortaVite/__vivo/estado" -TimeoutSec 3
  } catch {
    return $null
  }
}

$script:vistoNaSubida = $null
$script:subiuEm = Get-Date
$script:ultimaPergunta = [datetime]::MinValue
$script:estadoPagina = $null

# Anota o estado do servidor no instante em que o app sobe: um aviso igual a este é
# anterior à subida e não conta como "a página está viva".
function MarcarSubida {
  $script:subiuEm = Get-Date
  $script:ultimaPergunta = [datetime]::MinValue
  $script:estadoPagina = $null
  $estado = EstadoDaPagina
  $script:vistoNaSubida = if ($estado) { $estado.vistoEm } else { $null }
}

function PaginaTravada {
  if ($TravadoSegundos -le 0) { return $false }

  # a pergunta é barata, mas não precisa ser feita a cada ciclo
  if (((Get-Date) - $script:ultimaPergunta).TotalSeconds -ge 5) {
    $script:ultimaPergunta = Get-Date
    $script:estadoPagina = EstadoDaPagina
  }
  $estado = $script:estadoPagina
  if (-not $estado) { return $false }

  if ($null -ne $estado.vistoEm -and $estado.vistoEm -ne $script:vistoNaSubida) {
    # já avisou nesta encarnação: o silêncio é que denuncia
    return ($null -ne $estado.idade -and [double]$estado.idade -gt $TravadoSegundos)
  }
  # ainda não avisou desde que subiu: pode estar carregando (dicionário, modelo)
  return (((Get-Date) - $script:subiuEm).TotalSeconds -gt $TravadoNaSubidaSegundos)
}

# --- laço principal ----------------------------------------------------------

Registrar "watchdog iniciado - raiz: $Raiz"
Registrar "vigia: $($Vigiar -join ', ')"
Registrar ("debounce: {0}s · intervalo: {1}s · carência após subir: {2}s · porta: {3}" -f $DebounceSegundos, $IntervaloSegundos, $EsperaAposIniciarSegundos, $PortaVite)
if ($TravadoSegundos -gt 0) {
  Registrar ("página travada: sem aviso por mais de {0}s (primeiro aviso: até {1}s depois de subir)" -f $TravadoSegundos, $TravadoNaSubidaSegundos)
} else {
  Registrar "checagem de página travada: desligada"
}
if ($Simular) { Registrar "modo SIMULAR: nada será encerrado nem iniciado" }
if ($SemLevantarSeCair) { Registrar "SemLevantarSeCair: só reinicia quando o código muda" }

$impressao = Impressao
$total = (ArquivosVigiados).Count
Registrar "linha de base: $total arquivo(s) vigiado(s)"

$iniciadoEm = Get-Date
MarcarSubida
IniciarApp

$ultimaMudanca = $null
$avisou = $false
try {
  while ($true) {
    Start-Sleep -Milliseconds ([int]($IntervaloSegundos * 1000))

    $nova = Impressao
    if ($nova -ne $impressao) {
      $impressao = $nova
      $ultimaMudanca = Get-Date
      if (-not $avisou) {
        Registrar "mudança no código detectada - aguardando $DebounceSegundos s de calma"
        $avisou = $true
      }
    }

    if ($ultimaMudanca) {
      $calmo = ((Get-Date) - $ultimaMudanca).TotalSeconds -ge $DebounceSegundos
      $liberado = ((Get-Date) - $iniciadoEm).TotalSeconds -ge $EsperaAposIniciarSegundos
      if ($calmo -and $liberado) {
        $ultimaMudanca = $null
        $avisou = $false
        Registrar "reiniciando o app (mudança no código)"
        PararApp
        IniciarApp
        $iniciadoEm = Get-Date
        MarcarSubida
        $impressao = Impressao
      }
    }

    if (-not $SemLevantarSeCair -and -not $Simular -and $script:pidApp) {
      if (-not (Get-Process -Id $script:pidApp -ErrorAction SilentlyContinue)) {
        Registrar "o app caiu - levantando de novo em 3 s"
        Start-Sleep -Seconds 3
        $script:pidApp = $null
        IniciarApp
        $iniciadoEm = Get-Date
        MarcarSubida
        $impressao = Impressao
      }
    }

    # A página parou de responder? (processo vivo, janela de pé, conteúdo morto)
    # Com -SemLevantarSeCair isso fica desligado: é o mesmo espírito do item 4 — o
    # watchdog só mexe no app quando o código muda.
    if (-not $SemLevantarSeCair -and ($Simular -or $script:pidApp)) {
      if (PaginaTravada) {
        Registrar "a página parou de responder - reiniciando o app"
        PararApp
        IniciarApp
        $iniciadoEm = Get-Date
        MarcarSubida
        $impressao = Impressao
      }
    }
  }
} finally {
  Registrar "watchdog encerrado (o app, se estava de pé, continua rodando)"
}
