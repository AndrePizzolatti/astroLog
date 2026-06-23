// Gerador de script PowerShell para gestão de arquivos planetários. O app é um índice —
// o processamento (AutoStakkert! → RegiStax/AstroSurface → WinJUPOS) é manual, em GUI.
// Este script só organiza o que esses programas deixam no disco:
//   inventário dos vídeos · limpeza de intermediários · arquivamento dos brutos · publicação dos finais.
// NUNCA apaga .ser/.avi brutos nem imagens finais; tudo destrutivo é dry-run por padrão.

function slug(name: string): string {
  return name.replace(/[^\w.-]+/g, '_').replace(/^_+|_+$/g, '') || 'planetaria'
}

export function generatePlanetaryScript(target: string): string {
  const s = slug(target)
  return `# AstroLog — gestão de arquivos planetários (${target})
# O processamento planetário (AutoStakkert! -> RegiStax/AstroSurface -> WinJUPOS) e manual.
# Este script NAO apaga brutos (.ser/.avi) nem imagens finais. Tudo roda em DRY-RUN ate -Execute.
#
# Exemplos:
#   Inventario (so lista os videos e o tamanho — nao mexe em nada):
#     .\\planetaria_${s}.ps1 -Root "D:\\Planetaria\\${s}"
#   Limpar intermediarios (_conv.ser/.avi, .tmp) — primeiro em dry-run, depois de verdade:
#     .\\planetaria_${s}.ps1 -Root "D:\\Planetaria\\${s}" -Clean
#     .\\planetaria_${s}.ps1 -Root "D:\\Planetaria\\${s}" -Clean -Execute
#   Arquivar brutos no SSD/externo (libera disco) e publicar os finais no Drive:
#     .\\planetaria_${s}.ps1 -Root "D:\\Planetaria\\${s}" -Archive -ArchiveDir "E:\\AstroRaw" -Publish -DriveDir "G:\\Meu Drive\\Astro" -Execute

param(
  [Parameter(Mandatory=$true)][string]$Root,
  [switch]$Clean,
  [switch]$Archive,
  [string]$ArchiveDir,
  [switch]$Publish,
  [string]$DriveDir,
  [switch]$Execute
)

$ErrorActionPreference = 'Stop'
$slug = '${s}'
if (-not (Test-Path $Root)) { Write-Error "Pasta nao encontrada: $Root"; exit 1 }
$dry = -not $Execute
if ($dry) { Write-Host "MODO DRY-RUN (nada e alterado). Adicione -Execute para aplicar." -ForegroundColor Yellow; Write-Host "" }

$rawExt = @('.ser','.avi')
$imgExt = @('.tif','.tiff','.png','.jpg','.jpeg','.fit','.fits')

# Varre uma vez, ignorando a propria lixeira
$allFiles = Get-ChildItem -Path $Root -Recurse -File | Where-Object { $_.FullName -notmatch '(?i)\\\\_astrolog_trash\\\\' }
$conv    = $allFiles | Where-Object { $_.Name -match '(?i)_conv\\.(ser|avi)$' }
$rawKeep = $allFiles | Where-Object { ($rawExt -contains $_.Extension.ToLower()) -and ($_.Name -notmatch '(?i)_conv\\.(ser|avi)$') }
$imgs    = $allFiles | Where-Object { $imgExt -contains $_.Extension.ToLower() }
$tmps    = $allFiles | Where-Object { $_.Extension.ToLower() -eq '.tmp' }

# --- Inventario ---
$rawGB = if ($rawKeep) { ($rawKeep | Measure-Object Length -Sum).Sum / 1GB } else { 0 }
Write-Host ("Brutos (.ser/.avi): {0} arquivo(s), ~{1:N1} GB" -f $rawKeep.Count, $rawGB)
$rawKeep | Sort-Object Length -Descending | ForEach-Object { Write-Host ("  {0,7:N2} GB  {1}" -f ($_.Length/1GB), $_.FullName) }
Write-Host ("Imagens (stacks/finais): {0} arquivo(s)" -f $imgs.Count)

# --- Limpeza de intermediarios (seguro: so _conv e .tmp) ---
if ($Clean) {
  $junk = @($conv) + @($tmps)
  $junkGB = if ($junk) { ($junk | Measure-Object Length -Sum).Sum / 1GB } else { 0 }
  Write-Host ""
  Write-Host ("[Clean] Intermediarios: {0} item(s), ~{1:N1} GB" -f $junk.Count, $junkGB)
  $junk | ForEach-Object { Write-Host "  - $($_.FullName)" }
  if (-not $dry -and $junk.Count -gt 0) {
    $trash = Join-Path $Root ('_astrolog_trash\\' + (Get-Date -Format 'yyyyMMdd_HHmmss'))
    New-Item -ItemType Directory -Force -Path $trash | Out-Null
    foreach ($j in $junk) { Move-Item -LiteralPath $j.FullName -Destination $trash -Force }
    Write-Host "  -> movido para $trash (apague quando tiver certeza)"
  }
}

# --- Arquivar brutos (move pro SSD/externo; preserva, so muda de lugar) ---
if ($Archive) {
  if (-not $ArchiveDir) { Write-Error "-Archive precisa de -ArchiveDir"; exit 1 }
  if (-not (Test-Path $ArchiveDir)) {
    Write-Warning "ArchiveDir indisponivel ($ArchiveDir) — pulado (SSD/externo desconectado?)"
  } else {
    $dest = Join-Path $ArchiveDir (Join-Path $slug 'raw')
    Write-Host ""
    Write-Host ("[Archive] {0} bruto(s), ~{1:N1} GB -> {2}" -f $rawKeep.Count, $rawGB, $dest)
    if (-not $dry -and $rawKeep.Count -gt 0) {
      New-Item -ItemType Directory -Force -Path $dest | Out-Null
      foreach ($r in $rawKeep) { Move-Item -LiteralPath $r.FullName -Destination $dest -Force }
      Write-Host ("  -> movido (~{0:N1} GB liberados na origem)" -f $rawGB)
    }
  }
}

# --- Publicar finais (copia imagens pro Drive sincronizado) ---
if ($Publish) {
  if (-not $DriveDir) { Write-Error "-Publish precisa de -DriveDir"; exit 1 }
  if (-not (Test-Path $DriveDir)) {
    Write-Warning "DriveDir indisponivel ($DriveDir) — pulado"
  } else {
    $dest = Join-Path $DriveDir $slug
    Write-Host ""
    Write-Host ("[Publish] {0} imagem(ns) -> {1}" -f $imgs.Count, $dest)
    if (-not $dry -and $imgs.Count -gt 0) {
      New-Item -ItemType Directory -Force -Path $dest | Out-Null
      foreach ($im in $imgs) { Copy-Item -LiteralPath $im.FullName -Destination $dest -Force }
      Write-Host "  -> copiado (registre o final em Arquivos & Links do projeto)"
    }
  }
}

if ($dry) { Write-Host ""; Write-Host "(dry-run) Reveja a lista e rode de novo com -Execute para aplicar." -ForegroundColor Yellow }
`
}
