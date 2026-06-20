// Geradores de script para o Siril (processamento) e de limpeza segura de
// intermediários. Tudo é texto puro — o usuário baixa e roda localmente.
// Estrutura de pastas assumida (padrão SiriLic / scripts oficiais):
//   <projeto>/lights  [/darks] [/flats] [/biases]   →  trabalho em /process,
//   resultados salvos na raiz do projeto.

export interface SirilScriptOptions {
  target:        string
  isOSC:         boolean
  filters:       string[]   // usado no modo mono (um bloco por filtro)
  hasBias:       boolean
  hasDarks:      boolean
  hasFlats:      boolean
  extractHaOIII: boolean     // OSC com filtro dual-band → separa Ha e OIII
}

// Sanitiza o nome do alvo para uso em nome de arquivo
function slug(name: string): string {
  return name.replace(/[^\w.-]+/g, '_').replace(/^_+|_+$/g, '') || 'resultado'
}

const REJ = 'rej 3 3' // winsorized sigma clipping — padrão dos scripts oficiais

function buildMasters(o: SirilScriptOptions): string[] {
  const out: string[] = []

  // Masters são salvos na RAIZ (../master_*) — assim são reutilizáveis e a
  // limpeza, que só mexe em process/, nunca os apaga.
  if (o.hasBias) {
    out.push(
      '# --- Master Bias ---',
      'cd biases',
      'convert bias -out=../process',
      'cd ../process',
      `stack bias ${REJ} -nonorm -out=../master_bias`,
      'cd ..',
      '',
    )
  }

  if (o.hasFlats) {
    out.push(
      '# --- Master Flat ---',
      'cd flats',
      'convert flat -out=../process',
      'cd ../process',
      ...(o.hasBias
        ? [`calibrate flat -bias=../master_bias`, `stack pp_flat ${REJ} -norm=mul -out=../master_flat`]
        : [`stack flat ${REJ} -norm=mul -out=../master_flat`]),
      'cd ..',
      '',
    )
  }

  if (o.hasDarks) {
    out.push(
      '# --- Master Dark ---',
      'cd darks',
      'convert dark -out=../process',
      'cd ../process',
      `stack dark ${REJ} -nonorm -out=../master_dark`,
      'cd ..',
      '',
    )
  }

  return out
}

function calibrateLightArgs(o: SirilScriptOptions, extra: string[] = []): string {
  const args: string[] = []
  if (o.hasDarks) args.push('-dark=../master_dark', '-cc=dark')
  if (o.hasFlats) args.push('-flat=../master_flat')
  return [...args, ...extra].join(' ')
}

function generateOSC(o: SirilScriptOptions): string {
  const s = slug(o.target)
  const lines: string[] = [
    'requires 1.2.0',
    '',
    `# ===== AstroLog — processamento OSC: ${o.target} =====`,
    '# Pastas esperadas na raiz do projeto: ./lights' +
      [o.hasDarks ? ' ./darks' : '', o.hasFlats ? ' ./flats' : '', o.hasBias ? ' ./biases' : ''].join('') ,
    '# Intermediários vão para ./process ; resultados ficam na raiz.',
    '',
    ...buildMasters(o),
    '# --- Lights ---',
    'cd lights',
    'convert light -out=../process',
    'cd ../process',
    // OSC: -cfa -equalize_cfa (flat OSC) + -debayer
    `calibrate light ${calibrateLightArgs(o, ['-cfa', '-equalize_cfa', '-debayer'])}`,
    '',
  ]

  if (o.extractHaOIII) {
    lines.push(
      '# Separa Ha e OIII de um filtro dual-band (ex.: L-eXtreme)',
      'seqextract_HaOIII pp_light',
      '',
      '# Ha',
      'register Ha_pp_light',
      `stack r_Ha_pp_light ${REJ} -norm=addscale -output_norm -out=../${s}_Ha_stacked`,
      '',
      '# OIII',
      'register OIII_pp_light',
      `stack r_OIII_pp_light ${REJ} -norm=addscale -output_norm -out=../${s}_OIII_stacked`,
    )
  } else {
    lines.push(
      'register pp_light',
      `stack r_pp_light ${REJ} -norm=addscale -output_norm -out=../${s}_stacked`,
    )
  }

  lines.push('', 'cd ..', 'close', '')
  return lines.join('\n')
}

function generateMono(o: SirilScriptOptions): string {
  const s = slug(o.target)
  const filters = o.filters.length ? o.filters : ['L']
  const lines: string[] = [
    'requires 1.2.0',
    '',
    `# ===== AstroLog — processamento MONO: ${o.target} =====`,
    '# Organize os lights em uma subpasta por filtro: ' + filters.join('/ , ') + '/',
    `#   (masters: ../master_dark e ../master_flat_<filtro> na raiz do projeto)`,
    '# Intermediários vão para ./process ; resultados ficam na raiz.',
    '',
    ...buildMasters({ ...o, hasFlats: false }), // flats são por-filtro no mono — tratados abaixo
  ]

  for (const f of filters) {
    lines.push(
      `# --- Filtro ${f} ---`,
      `cd ${f}`,
      `convert ${f}_light -out=../process`,
      'cd ../process',
      `calibrate ${f}_light ${[o.hasDarks ? '-dark=../master_dark -cc=dark' : '', o.hasFlats ? `-flat=../master_flat_${f}` : ''].filter(Boolean).join(' ')}`.trimEnd(),
      `register pp_${f}_light`,
      `stack r_pp_${f}_light ${REJ} -norm=addscale -output_norm -out=../${s}_${f}_stacked`,
      'cd ..',
      '',
    )
  }

  lines.push('close', '')
  return lines.join('\n')
}

export function generateSirilScript(o: SirilScriptOptions): string {
  return o.isOSC ? generateOSC(o) : generateMono(o)
}

// ── Limpeza segura (PowerShell) ──────────────────────────────────────────────
// Nunca apaga lights/darks/flats/biases nem resultados. Aborta se não houver um
// resultado final. Move para uma lixeira (não apaga de vez). Dry-run por padrão.
export function generateCleanupScript(target: string): string {
  return `# AstroLog — limpeza segura de intermediários do Siril (${target})
# Uso (mostra o que seria removido, sem apagar):
#     .\\limpar.ps1 -Root "D:\\Astro\\${slug(target)}"
# Para mover de fato para a lixeira:
#     .\\limpar.ps1 -Root "D:\\Astro\\${slug(target)}" -Force
# NADA é apagado permanentemente: tudo vai para _astrolog_trash\\ (apague quando tiver certeza).

param(
  [Parameter(Mandatory=$true)][string]$Root,
  [switch]$Force
)

$ErrorActionPreference = 'Stop'
if (-not (Test-Path $Root)) { Write-Error "Pasta nao encontrada: $Root"; exit 1 }

# 1) So limpa se existir um resultado final — protege contra rodar na pasta errada
$results = Get-ChildItem -Path $Root -File | Where-Object { $_.Name -match '(?i)(stacked|result|final|starless|starmask|stars)' }
if ($results.Count -eq 0) {
  Write-Error "Nenhum resultado final (*_stacked / *result* / *final*) em $Root. Abortado para nao apagar nada importante."
  exit 1
}

# 2) Candidatos = pasta de trabalho /process (100% regeneravel) + intermediarios soltos por prefixo do Siril.
#    lights/darks/flats/biases e os resultados NUNCA entram aqui.
$candidates = @()
$process = Join-Path $Root 'process'
if (Test-Path $process) { $candidates += Get-Item $process }
$candidates += Get-ChildItem -Path $Root -File | Where-Object {
  $_.Name -match '^(pp_|r_|bkg_|conv|light_|Ha_pp|OIII_pp).*\\.(fit|fits|fts|seq)$'
}

if ($candidates.Count -eq 0) { Write-Host "Nada a limpar — ja esta limpo."; exit 0 }

$size = ($candidates | Get-ChildItem -Recurse -File -ErrorAction SilentlyContinue | Measure-Object Length -Sum).Sum
Write-Host ("Candidatos: {0} item(s), ~{1:N1} GB" -f $candidates.Count, ($size/1GB))
$candidates | ForEach-Object { Write-Host "  - $($_.FullName)" }

if (-not $Force) { Write-Host "\`n(dry-run) Rode de novo com -Force para mover para a lixeira."; exit 0 }

$trash = Join-Path $Root ("_astrolog_trash\\" + (Get-Date -Format 'yyyyMMdd_HHmmss'))
New-Item -ItemType Directory -Force -Path $trash | Out-Null
foreach ($c in $candidates) { Move-Item -LiteralPath $c.FullName -Destination $trash }
Write-Host "\`nMovido para: $trash  (apague manualmente quando tiver certeza)."
`
}
