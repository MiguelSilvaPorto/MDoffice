#Requires -Version 5.1
# limpar-agendada.ps1 - Limpeza "teimosa": espera a pasta da worktree liberar (terminal/editor
# aberto nela) e remove a worktree e a branch local, para nenhuma tarefa deixar worktree
# orfa em .worktrees\.
#
# Normalmente e chamada EM SEGUNDO PLANO pelo fechar.ps1, logo depois da entrega na main.
# Tambem serve para limpar manualmente - inclusive uma pasta "fantasma" que ficou presa no
# disco depois de uma limpeza interrompida.
#
# SEGURANCA
#   - nunca descarta alteracao nao commitada (fica PENDENTE no log)
#   - nunca apaga branch com commits que a main nao tem (o limpar.ps1 recusa)
#   - NAO encerra processo nenhum: quando algo segura a pasta, o log diz QUEM e (PID e nome)
#     e a limpeza conclui sozinha assim que a pessoa fechar esse processo
#   - links (junctions) saem como link; o alvo (node_modules etc.) nunca e tocado
#
# Uso:
#   tools\worktrees\limpar-agendada.ps1 -Nome feat/minha-tarefa
#   tools\worktrees\limpar-agendada.ps1 -Nome feat-minha-tarefa     (nome da pasta/slug)
#   tools\worktrees\limpar-agendada.ps1 -Nome feat/x -Tentativas 120 -IntervaloSegundos 5
#
# Log: .worktrees\limpeza-automatica.log (na copia principal)
#
# Este arquivo e AUTOSSUFICIENTE de proposito: o fechar.ps1 copia ele para o TEMP antes de
# disparar, porque a pasta dele some junto com a worktree.
# ASCII-only de proposito (PowerShell 5.1 le .ps1 UTF-8 sem BOM como ANSI).
[CmdletBinding()]
param(
  [Parameter(Mandatory = $true, Position = 0)][string]$Nome,
  [string]$Principal,
  [int]$Tentativas = 60,
  [int]$IntervaloSegundos = 10
)

$ErrorActionPreference = 'Continue'
$script:LeitorCarregado = $false
$script:Avisados = @{}
$script:PastasLigadas = @('node_modules', 'public\modelos', 'public\ort', 'public\dicionario', 'public\ngrams')

# -- localiza a copia principal ------------------------------------------------
if (-not $Principal) {
  $atual = & git rev-parse --show-toplevel 2>$null
  $atual = "$atual".Trim()
  if (-not $atual) { throw "Nao estou dentro de um repositorio git - rode da copia principal ou passe -Principal <caminho>." }
  $Principal = $atual
}
$Principal = ($Principal -replace '/', '\').TrimEnd('\')
if ($Principal -match '\\\.worktrees\\') { $Principal = $Principal -replace '\\\.worktrees\\.*$', '' }

# -- resolve a pasta alvo: aceita a branch ("feat/x") OU o nome da pasta --------
$baseWt = Join-Path $Principal '.worktrees'
$nome = $Nome.Trim()
$destino = $null
if ($nome -match '^[A-Za-z0-9._-]+$') {
  $candidato = Join-Path $baseWt $nome
  if (Test-Path $candidato) { $destino = $candidato }
}
if (-not $destino) {
  $branch = $nome
  if ($branch -notmatch '/') { $branch = "feat/$branch" }
  $slug = $branch -replace '/', '-'
  if ($slug -notmatch '^[A-Za-z0-9._-]+$') { throw "Nome de worktree invalido: $Nome" }
  $destino = Join-Path $baseWt $slug
}
$destino = $destino.TrimEnd('\')
$script:Alvo = $nome
$script:Log = Join-Path $baseWt 'limpeza-automatica.log'
$limpar = Join-Path $Principal 'tools\worktrees\limpar.ps1'

function Logar {
  param([string]$Texto)
  $linha = "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')  $Texto"
  $utf8 = New-Object System.Text.UTF8Encoding($false)
  [System.IO.File]::AppendAllText($script:Log, $linha + "`r`n", $utf8)
}

function PrimeiraLinha {
  param([string]$Texto)
  return ((("$Texto" -split "`n") | Where-Object { "$_".Trim() } | Select-Object -First 1) -join '').Trim()
}

# branch da worktree registrada nesta pasta (ou $null, se nao e worktree)
function BranchDaWorktree {
  $linhaAtual = $null
  foreach ($linha in @(& git -C $Principal worktree list --porcelain 2>$null)) {
    if ("$linha" -like 'worktree *') {
      $linhaAtual = "$linha".Substring(9).Trim() -replace '/', '\'
    } elseif ("$linha" -like 'branch *' -and $linhaAtual) {
      if ($linhaAtual -ieq $destino) { return ("$linha".Substring(7).Trim() -replace '^refs/heads/', '') }
      $linhaAtual = $null
    }
  }
  return $null
}

# apaga a branch local tentando as variantes do nome (feat-x -> feat/x etc.), so se ja estiver na main
function ApagarBranchPorTentativa {
  param([string]$NomeBase)
  $variantes = @($NomeBase)
  if ($NomeBase -notmatch '/') {
    $variantes += "feat/$NomeBase"
    $pos = $NomeBase.IndexOf('-')
    if ($pos -gt 0) { $variantes += ($NomeBase.Substring(0, $pos) + '/' + $NomeBase.Substring($pos + 1)) }
  }
  foreach ($v in @($variantes | Select-Object -Unique)) {
    $null = & git -C $Principal merge-base --is-ancestor $v main 2>$null
    if ($LASTEXITCODE -eq 0) { $null = & git -C $Principal branch -D $v 2>$null }
  }
}

# remove so os links (junctions) de uma pasta, sem tocar no alvo
function RemoverLigacoes {
  $alvos = @()
  foreach ($rel in $script:PastasLigadas) { $alvos += (Join-Path $destino $rel) }
  foreach ($it in @(Get-ChildItem $destino -Force -ErrorAction SilentlyContinue)) {
    if ($it.Attributes -band [System.IO.FileAttributes]::ReparsePoint) { $alvos += $it.FullName }
  }
  foreach ($caminho in ($alvos | Select-Object -Unique)) {
    if (-not (Test-Path $caminho)) { continue }
    $item = Get-Item $caminho -Force -ErrorAction SilentlyContinue
    if ($item -and ($item.Attributes -band [System.IO.FileAttributes]::ReparsePoint)) {
      if ($item.PSIsContainer) { [System.IO.Directory]::Delete($item.FullName, $false) }
      else { [System.IO.File]::Delete($item.FullName) }
    }
  }
}

# -- le o CWD de cada processo (direto do PEB) e anota no log quem segura a pasta -
function RelatarDonos {
  if (-not $script:LeitorCarregado) {
    Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
using System.Text;

public static class MdofficeCwdReader {
  [DllImport("kernel32.dll", SetLastError = true)]
  static extern IntPtr OpenProcess(int access, bool inherit, int pid);
  [DllImport("kernel32.dll")]
  static extern bool CloseHandle(IntPtr h);
  [DllImport("kernel32.dll")]
  static extern bool ReadProcessMemory(IntPtr h, IntPtr addr, byte[] buf, int size, out IntPtr lido);
  [DllImport("ntdll.dll")]
  static extern int NtQueryInformationProcess(IntPtr h, int cls, byte[] info, int len, out int ret);

  public static string GetCwd(int pid) {
    IntPtr h = OpenProcess(0x0410, false, pid);
    if (h == IntPtr.Zero) return null;
    try {
      byte[] pbi = new byte[48];
      int ret;
      if (NtQueryInformationProcess(h, 0, pbi, pbi.Length, out ret) != 0) return null;
      IntPtr peb = (IntPtr)BitConverter.ToInt64(pbi, 8);
      IntPtr lido;
      byte[] b8 = new byte[8];
      if (!ReadProcessMemory(h, (IntPtr)(peb.ToInt64() + 0x20), b8, 8, out lido)) return null;
      IntPtr pp = (IntPtr)BitConverter.ToInt64(b8, 0);
      if (!ReadProcessMemory(h, (IntPtr)(pp.ToInt64() + 0x38), b8, 2, out lido)) return null;
      int len = BitConverter.ToUInt16(b8, 0);
      if (len <= 0 || len > 4096) return null;
      if (!ReadProcessMemory(h, (IntPtr)(pp.ToInt64() + 0x40), b8, 8, out lido)) return null;
      IntPtr strBuf = (IntPtr)BitConverter.ToInt64(b8, 0);
      byte[] sb = new byte[len];
      if (!ReadProcessMemory(h, strBuf, sb, len, out lido)) return null;
      return Encoding.Unicode.GetString(sb);
    } catch { return null; } finally { CloseHandle(h); }
  }
}
'@
    $script:LeitorCarregado = $true
  }
  $prefixo = $destino + '\'
  $achou = $false
  foreach ($proc in (Get-Process -ErrorAction SilentlyContinue)) {
    if ($proc.Id -eq $PID) { continue }
    $cwd = $null
    try { $cwd = [MdofficeCwdReader]::GetCwd($proc.Id) } catch { }
    if (-not $cwd) { continue }
    $normal = $cwd.TrimEnd('\')
    if (($normal -ieq $destino) -or $normal.StartsWith($prefixo, [System.StringComparison]::OrdinalIgnoreCase)) {
      $achou = $true
      $chave = "$($proc.Id)"
      if (-not $script:Avisados.ContainsKey($chave)) {
        $script:Avisados[$chave] = $true
        Logar "MANUAL    $script:Alvo : PID $($proc.Id) ($($proc.ProcessName)) segura a pasta - nao encerro nada sozinho. Feche esse processo (terminal, editor, servidor) que a limpeza conclui."
      }
    }
  }
  if (-not $achou -and -not $script:Avisados.ContainsKey('sem-dono')) {
    $script:Avisados['sem-dono'] = $true
    Logar "SEM DONO  $script:Alvo : nenhum processo com a pasta como diretorio atual; se persistir, algum arquivo dela esta aberto (editor, antivirus, indexador)."
  }
}

if (-not (Test-Path $baseWt)) { New-Item -ItemType Directory -Path $baseWt -Force | Out-Null }
Logar "INICIO  $script:Alvo : limpeza agendada (destino: $destino)"

for ($i = 1; $i -le $Tentativas; $i++) {
  if (-not (Test-Path $destino)) {
    Logar "OK  $script:Alvo : pasta ja nao existia"
    exit 0
  }

  $branchReal = BranchDaWorktree
  $erro = ''

  if ($branchReal) {
    # worktree de verdade: nunca descarta alteracao nao commitada sozinha
    $sujo = @(& git -C $destino status --porcelain 2>$null | Where-Object { "$_".Trim() })
    if ($sujo.Count -gt 0) {
      Logar "PENDENTE  $branchReal : worktree com alteracao nao commitada; nao removo sozinho. Se puder descartar: limpar.ps1 -Nome $branchReal -Forcar -ApagarBranch"
      exit 1
    }
    try {
      $null = & $limpar -Nome $branchReal -ApagarBranch 2>&1
      if (Test-Path $destino) { throw "limpar.ps1 terminou mas a pasta continua no disco." }
      Logar "OK  $branchReal : worktree removida e branch local apagada"
      exit 0
    } catch {
      $erro = PrimeiraLinha $_.Exception.Message
      if ($erro -match 'commits que a main NAO tem') {
        Logar "PENDENTE  $branchReal : a branch tem commits que a main nao tem - nao apago. Entregue com o fechar.ps1 ou descarte com limpar.ps1 -Forcar -ApagarBranch."
        exit 1
      }
    }
  } else {
    # pasta "fantasma": o git nao a conhece mais (limpeza antiga interrompida).
    # So remove se nao houver conteudo real; junctions saem como link, nunca o alvo.
    try {
      $itens = @(Get-ChildItem $destino -Force -ErrorAction Stop)
      $temConteudoReal = $false
      foreach ($it in $itens) {
        if (-not ($it.Attributes -band [System.IO.FileAttributes]::ReparsePoint)) { $temConteudoReal = $true; break }
      }
      if ($temConteudoReal) {
        Logar "PENDENTE  $script:Alvo : pasta sem registro no git, mas com conteudo real - confira antes de apagar."
        exit 1
      }
      RemoverLigacoes
      Remove-Item $destino -Recurse -Force -ErrorAction Stop
      ApagarBranchPorTentativa $script:Alvo
      Logar "OK  $script:Alvo : pasta fantasma removida (nao era mais worktree registrada)"
      exit 0
    } catch {
      $erro = PrimeiraLinha $_.Exception.Message
    }
  }

  # falhou: registra (menos verboso) e, a partir da 2a tentativa, descobre quem segura
  if ($i -eq 1 -or ($i % 6) -eq 0) { Logar "tentativa $i/$Tentativas  $script:Alvo : $erro" }
  if ($i -ge 2 -and (($i -le 4) -or (($i % 5) -eq 0))) { try { RelatarDonos } catch { } }

  if ($i -lt $Tentativas) { Start-Sleep -Seconds $IntervaloSegundos }
}

Logar "PENDENTE  $script:Alvo : nao consegui remover apos $Tentativas tentativa(s) - pasta em uso? Feche terminais/editores nela e rode de novo: tools\worktrees\limpar-agendada.ps1 -Nome $script:Alvo"
exit 1
