#Requires -Version 5.1
# fechar.ps1 - Fecha a tarefa: commita o que faltar, integra a main na worktree, entrega o
# trabalho na MAIN (fast-forward) e agenda a limpeza da worktree e da branch local.
#
# Roda DE DENTRO da worktree (.worktrees\...). Depois de entregar na main, da PUSH
# AUTOMATICO da main no GitHub (origin) - e de la que o usuario trabalha em outro lugar.
# Se o push falhar (sem rede), nada se perde: o monitor-push.ps1 envia depois.
#
# FLUXO
#   1. commita o que estiver pendente (exige -Mensagem quando ha alteracao)
#   2. se a main andou (outra tarefa fechou antes), integra a main nesta worktree
#      CONFLITO: o script PARA, lista os arquivos e deixa o merge EM ANDAMENTO aqui.
#      Resolva, rode "git add" e execute este script de novo. Nada vai para a main
#      com conflito.
#   3. avanca a main (git merge --ff-only) - so entra na main trabalho que ja contem a main
#   4. push da main para o origin (desligue com -SemPush)
#   5. agenda em segundo plano a remocao da worktree e da branch local (log em
#      .worktrees\limpeza-automatica.log) - nenhuma tarefa deixa worktree orfa
#   6. avisa de OUTRAS worktrees paradas com pendencia
#
# Dois fechamentos ao mesmo tempo sao serializados por uma trava (.git\mdoffice-fechar.lock).
#
# Uso:
#   tools\worktrees\fechar.ps1 -Mensagem "feat(escopo): descricao"
#   tools\worktrees\fechar.ps1                  (sem pendencia: so integra e entrega)
#   tools\worktrees\fechar.ps1 -SemPush         (entrega na main mas nao envia ao GitHub agora)
#   tools\worktrees\fechar.ps1 -SemIntegrar     (so commita aqui; nao mexe na main nem limpa)
#   tools\worktrees\fechar.ps1 -ManterWorktree  (entrega na main mas nao agenda a limpeza)
#   tools\worktrees\fechar.ps1 -ParadaHoras 24  (aviso de outras worktrees paradas; padrao 12h)
#
# ASCII-only de proposito (PowerShell 5.1 le .ps1 UTF-8 sem BOM como ANSI).
[CmdletBinding()]
param(
  [string]$Mensagem,
  [switch]$SemPush,
  [switch]$SemIntegrar,
  [switch]$ManterWorktree,
  [int]$ParadaHoras = 12
)

$ErrorActionPreference = 'Stop'
. "$PSScriptRoot\_comum.ps1"

# -- confirma que estamos numa worktree de tarefa ------------------------------
$repo = Get-Principal
if (-not $repo.EmWorktree) {
  throw "Este script roda DE DENTRO de uma worktree (.worktrees\...). Aqui estamos em: $($repo.Atual)"
}
$raiz = $repo.Atual
$principal = $repo.Principal
$branch = "$(Exec { git -C $raiz symbolic-ref --short HEAD })".Trim()
if ($branch -eq 'main') { throw "A branch atual e a main - isso nao deveria acontecer numa worktree." }

# -- 0) conflito nao resolvido? (devolve o controle para resolver) --------------
$ruido = { "$_".Trim() -and ("$_" -notmatch '^\s*warning:') -and ("$_" -notmatch 'not a valid attribute name') }
$naoResolvidos = @(Exec -PermitirFalha { git -C $raiz diff --name-only --diff-filter=U } | Where-Object $ruido)
if ($naoResolvidos.Count -gt 0) {
  throw "Ainda ha conflitos NAO RESOLVIDOS nesta worktree:`n$($naoResolvidos | Out-String)`nResolva os arquivos, rode: git add <arquivos> (ou git add -A), e execute este script de novo."
}

# -- 1) commit do que faltar (ou conclusao de um merge em andamento) -----------
$null = Exec -PermitirFalha { git -C $raiz rev-parse --verify --quiet MERGE_HEAD }
$mergeEmAndamento = ($LASTEXITCODE -eq 0)
$mudancas = @(Exec { git -C $raiz status --porcelain } | Where-Object { "$_".Trim() })
if ($mudancas.Count -gt 0) {
  $msgCommit = $Mensagem
  if (-not $msgCommit -and $mergeEmAndamento) { $msgCommit = 'merge: integra a main' }
  if (-not $msgCommit) {
    throw "Ha alteracoes sem commit. Rode de novo passando a mensagem: fechar.ps1 -Mensagem `"feat(escopo): descricao`""
  }
  if ($msgCommit -notmatch '^(feat|fix|docs|refactor|chore|test|perf)(\([a-z0-9._-]+\))?: .+' -and $msgCommit -notmatch '^merge: ') {
    Write-Warning "Mensagem fora do padrao Conventional Commits (vai assim mesmo): $msgCommit"
  }
  $null = Exec { git -C $raiz add -A } "git add falhou."
  $null = Exec { git -C $raiz commit -m $msgCommit } "git commit falhou."
  Write-Host "Commit criado: $msgCommit"
} else {
  Write-Host "Nada pendente para commitar."
}

# -- trava: um fechamento por vez ----------------------------------------------
$gitCommon = "$(Exec { git -C $principal rev-parse --git-common-dir })".Trim()
if (-not [System.IO.Path]::IsPathRooted($gitCommon)) { $gitCommon = Join-Path $principal $gitCommon }
$trava = Join-Path $gitCommon 'mdoffice-fechar.lock'

function Pegar-Trava {
  for ($i = 0; $i -lt 90; $i++) {
    if (Test-Path $trava) {
      # trava velha (processo morreu): mais de 15 minutos
      $idade = (Get-Date) - (Get-Item $trava).LastWriteTime
      if ($idade.TotalMinutes -gt 15) { Remove-Item $trava -Force -ErrorAction SilentlyContinue }
    }
    try {
      $fs = [System.IO.File]::Open($trava, [System.IO.FileMode]::CreateNew, [System.IO.FileAccess]::Write, [System.IO.FileShare]::None)
      $bytes = [System.Text.Encoding]::ASCII.GetBytes("$PID $branch")
      $fs.Write($bytes, 0, $bytes.Length)
      $fs.Close()
      return
    } catch {
      if ($i -eq 0) { Write-Host "Outro fechar.ps1 esta entregando na main - aguardando a vez..." }
      Start-Sleep -Seconds 2
    }
  }
  throw "Nao consegui a trava de fechamento em 3 minutos ($trava). Se nenhum fechar.ps1 estiver rodando, apague esse arquivo."
}

if ($SemIntegrar) {
  Write-Host "Integracao pulada (-SemIntegrar): o trabalho esta commitado na branch '$branch', mas NAO foi para a main."
  Write-Host "Para entregar depois, rode este script de novo sem -SemIntegrar."
  exit 0
}

# -- 2+3) integra a main aqui e avanca a main (fast-forward) -------------------
$entregue = $false
Pegar-Trava
try {
  for ($tentativa = 1; $tentativa -le 3 -and -not $entregue; $tentativa++) {
    $null = Exec -PermitirFalha { git -C $raiz merge-base --is-ancestor main HEAD }
    if ($LASTEXITCODE -ne 0) {
      Write-Host "A main avancou - integrando na worktree (git merge main)..."
      $null = Exec -PermitirFalha { git -C $raiz merge main -m "merge: integra a main" }
      if ($LASTEXITCODE -ne 0) {
        $conflitos = @(Exec -PermitirFalha { git -C $raiz diff --name-only --diff-filter=U } | Where-Object $ruido)
        throw "CONFLITO ao integrar a main - o merge ficou EM ANDAMENTO nesta worktree.`nArquivos em conflito:`n$($conflitos | Out-String)`nResolva os arquivos, rode: git add <arquivos> (ou git add -A), e execute este script de novo. Nada foi para a main."
      }
      Write-Host "Main integrada."
    }

    # a copia principal precisa estar na main para o fast-forward valer
    $naPrincipal = "$(Exec { git -C $principal symbolic-ref --short HEAD })".Trim()
    if ($naPrincipal -ne 'main') {
      throw "A copia principal esta na branch '$naPrincipal' (deveria estar na main). Volte-a para a main e rode este script de novo."
    }
    $null = Exec -PermitirFalha { git -C $principal merge --ff-only $branch }
    if ($LASTEXITCODE -eq 0) {
      $entregue = $true
      Write-Host "Trabalho entregue na main (fast-forward)."
    } elseif ($tentativa -lt 3) {
      Write-Host "A main mudou no meio do caminho - integrando de novo..."
    } else {
      throw "Nao consegui avancar a main (git merge --ff-only $branch falhou). Se a copia principal tem alteracoes locais nos mesmos arquivos, elas barram o avanco: resolva (a main nao deveria ter alteracao solta) e rode de novo."
    }
  }
} finally {
  Remove-Item $trava -Force -ErrorAction SilentlyContinue
}

# -- 4) push automatico da main para o GitHub ---------------------------------
if (-not $SemPush) {
  $temOrigin = "$(Exec -PermitirFalha { git -C $principal remote get-url origin })".Trim()
  if (-not $temOrigin) {
    Write-Warning "Sem remote origin - nada para enviar."
  } else {
    $saidaPush = Exec -PermitirFalha { git -C $principal push origin main }
    if ($LASTEXITCODE -eq 0) {
      Write-Host "Main enviada ao GitHub (origin)."
    } else {
      Write-Warning "O push falhou (a entrega local na main ja foi feita; o monitor-push.ps1 tenta de novo quando nao houver worktrees ativas):`n$($saidaPush | Out-String)"
    }
  }
} else {
  Write-Host "Push pulado (-SemPush): a main local ficou a frente do GitHub; o monitor-push.ps1 envia quando nao houver worktrees ativas."
}

$ultimos = Exec -PermitirFalha { git -C $principal log --oneline -3 main }
Write-Host ""
Write-Host "Ultimos commits da main:"
if ($ultimos) { $ultimos | ForEach-Object { Write-Host "  $_" } }

# -- 5) limpeza automatica: nao deixar worktree orfa ---------------------------
Write-Host ""
if ($entregue -and -not $ManterWorktree) {
  $slug = $branch -replace '/', '-'
  $limpezaFonte = Join-Path $PSScriptRoot 'limpar-agendada.ps1'
  if (Test-Path $limpezaFonte) {
    # copia para o TEMP: o processo destacado nao pode depender de um arquivo
    # que vive na pasta que sera removida
    $limpezaTemp = Join-Path $env:TEMP "mdoffice-limpar-agendada-$slug.ps1"
    Copy-Item $limpezaFonte $limpezaTemp -Force
    Start-Process powershell -ArgumentList @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', $limpezaTemp, '-Nome', $branch, '-Principal', $principal) -WorkingDirectory $principal -WindowStyle Hidden
    Write-Host "Limpeza agendada: esta worktree e a branch local serao removidas em segundo plano,"
    Write-Host "assim que a pasta for liberada. Se algum terminal/editor estiver aberto nela, feche-o."
    Write-Host "Log: .worktrees\limpeza-automatica.log   (para manter a worktree: -ManterWorktree)"
  } else {
    Write-Host "Para limpar a worktree (da copia principal): tools\worktrees\limpar.ps1 -Nome $branch -ApagarBranch"
  }
} else {
  Write-Host "Para limpar a worktree (da copia principal): tools\worktrees\limpar.ps1 -Nome $branch -ApagarBranch"
}

# -- 6) varredura: worktrees paradas com pendencia (aviso para a proxima IA) ---
$limiteSegundos = $ParadaHoras * 3600
$agoraSegundos = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()

$registradas = @()
$caminhoWt = $null
foreach ($linha in @(& git -C $principal worktree list --porcelain 2>$null)) {
  if ("$linha" -like 'worktree *') {
    $caminhoWt = "$linha".Substring(9).Trim() -replace '/', '\'
  } elseif ("$linha" -like 'branch *' -and $caminhoWt) {
    $b = "$linha".Substring(7).Trim() -replace '^refs/heads/', ''
    $registradas += [pscustomobject]@{ Caminho = $caminhoWt; Branch = $b }
    $caminhoWt = $null
  }
}

$paradas = @()
$prontas = @()
$ativas = 0
foreach ($wt in $registradas) {
  if ($wt.Caminho -ieq $raiz) { continue }
  # so pastas em .worktrees entram (a copia principal tambem e uma worktree do git)
  if ($wt.Caminho -notmatch '\\\.worktrees\\') { continue }
  if (-not (Test-Path $wt.Caminho)) { continue }

  $ahead = [int]0
  $aheadTxt = & git -C $wt.Caminho rev-list --count main..HEAD 2>$null
  if ($LASTEXITCODE -eq 0) { [int]::TryParse("$aheadTxt".Trim(), [ref]$ahead) | Out-Null }
  $sujo = @(& git -C $wt.Caminho status --porcelain 2>$null | Where-Object { "$_".Trim() })

  $tsCommit = [long]0
  $ctTxt = & git -C $wt.Caminho log -1 --format=%ct 2>$null
  if ($LASTEXITCODE -eq 0) { [long]::TryParse("$ctTxt".Trim(), [ref]$tsCommit) | Out-Null }
  $tsSujo = 0
  foreach ($linhaSuja in $sujo) {
    $rel = "$linhaSuja"
    if ($rel.Length -gt 3) { $rel = $rel.Substring(3).Trim() }
    if ($rel -match ' -> ') { $rel = ($rel -split ' -> ')[-1] }
    $rel = $rel.Trim('"')
    try {
      $item = Get-Item (Join-Path $wt.Caminho $rel) -Force -ErrorAction Stop
      $ts = ([DateTimeOffset]$item.LastWriteTimeUtc).ToUnixTimeSeconds()
      if ($ts -gt $tsSujo) { $tsSujo = $ts }
    } catch { }
  }
  $ultima = [math]::Max($tsCommit, $tsSujo)
  $paradaSeg = 0
  if ($ultima -gt 0) { $paradaSeg = $agoraSegundos - $ultima }
  $paradaH = [int][math]::Floor($paradaSeg / 3600)

  if ($ahead -gt 0 -or $sujo.Count -gt 0) {
    if ($paradaSeg -ge $limiteSegundos) {
      $paradas += [pscustomobject]@{ Branch = $wt.Branch; Ahead = $ahead; Sujo = $sujo.Count; Horas = $paradaH }
    } else { $ativas++ }
  } elseif ($paradaSeg -ge $limiteSegundos) {
    $prontas += [pscustomobject]@{ Branch = $wt.Branch; Horas = $paradaH }
  }
}

$fantasmas = @()
$pastaWt = Join-Path $principal '.worktrees'
foreach ($d in @(Get-ChildItem $pastaWt -Directory -Force -ErrorAction SilentlyContinue)) {
  $achou = $false
  foreach ($wt in $registradas) { if ($wt.Caminho -ieq $d.FullName) { $achou = $true } }
  if (-not $achou) { $fantasmas += $d.Name }
}

Write-Host ""
if ($paradas.Count -gt 0 -or $fantasmas.Count -gt 0 -or $prontas.Count -gt 0) {
  Write-Host "=== ATENCAO: limpeza pendente em outras worktrees ==="
  foreach ($p in $paradas) {
    $pedacos = @()
    if ($p.Ahead -gt 0) { $pedacos += "$($p.Ahead) commit(s) fora da main" }
    if ($p.Sujo -gt 0) { $pedacos += "$($p.Sujo) alteracao(oes) sem commit" }
    Write-Host "  $($p.Branch)  (parada ha ~$($p.Horas)h)  pendencias: $($pedacos -join ' + ')"
    Write-Host "      vale entregar?  rode o fechar.ps1 DE DENTRO dessa worktree (com mensagem propria)"
    Write-Host "      nao vale?       descarte: tools\worktrees\limpar.ps1 -Nome $($p.Branch) -Forcar -ApagarBranch"
  }
  foreach ($r in $prontas) {
    Write-Host "  $($r.Branch)  (ja entregue e limpa; parada ha ~$($r.Horas)h - so a pasta sobrou)"
    Write-Host "      remova sem risco: tools\worktrees\limpar.ps1 -Nome $($r.Branch) -ApagarBranch"
  }
  foreach ($f in $fantasmas) {
    Write-Host "  pasta fantasma: .worktrees\$f  (sem registro no git - limpeza antiga interrompida)"
    Write-Host "      remova com: tools\worktrees\limpar-agendada.ps1 -Nome $f"
  }
  Write-Host "  (worktrees ativas com pendencia dentro do prazo de $ParadaHoras h: $ativas - deixe com o responsavel)"
} else {
  Write-Host "(nenhuma outra worktree parada com pendencia)"
}
