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
  hasDarkFlats:  boolean     // calibram os flats (preferidos ao bias quando presentes)
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

  if (o.hasDarkFlats) {
    out.push(
      '# --- Master Dark Flat ---',
      'cd dflats',
      'convert darkflat -out=../process',
      'cd ../process',
      `stack darkflat ${REJ} -nonorm -out=../master_darkflat`,
      'cd ..',
      '',
    )
  }

  if (o.hasFlats) {
    // Calibração do flat: dark flat tem prioridade sobre bias (mais correto)
    const flatCalib =
      o.hasDarkFlats ? [`calibrate flat -dark=../master_darkflat`, `stack pp_flat ${REJ} -norm=mul -out=../master_flat`]
      : o.hasBias    ? [`calibrate flat -bias=../master_bias`,     `stack pp_flat ${REJ} -norm=mul -out=../master_flat`]
      :                [`stack flat ${REJ} -norm=mul -out=../master_flat`]
    out.push(
      '# --- Master Flat ---',
      'cd flats',
      'convert flat -out=../process',
      'cd ../process',
      ...flatCalib,
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
      [o.hasDarks ? ' ./darks' : '', o.hasFlats ? ' ./flats' : '', o.hasDarkFlats ? ' ./dflats' : '', o.hasBias ? ' ./biases' : ''].join('') ,
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
    ...buildMasters({ ...o, hasFlats: false, hasDarkFlats: false }), // flats/darkflats são por-filtro no mono
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

// ── SHO a partir de OSC dual-band (multi-sessão) ──────────────────────────────
// Fluxo do André: noites com filtro Ha+OIII e noites com SII+OIII (câmera colorida).
// Em cada noite: calibra (flats da própria noite + darks/darkflats compartilhados) e
// extrai com seqextract_HaOIII. O canal "vermelho" da noite SII+OIII É o SII.
// Depois: junta (merge) por canal entre as noites, registra e empilha. O OIII é
// empilhado de TODAS as noites (melhor SNR no canal mais fraco). Por fim compõe
// SHO/HOO/SOO. Pesos finos ficam no PixelMath (ver generateShoPixelMath).

export interface SHOOptions {
  target:        string
  haoiiiNights:  number   // nº de noites com filtro Ha+OIII
  siioiiiNights: number   // nº de noites com filtro SII+OIII
  hasDarks:      boolean
  hasDarkFlats:  boolean
  hasBias:       boolean
}

function shoSharedMasters(o: SHOOptions): string[] {
  const out: string[] = []
  if (o.hasBias) {
    out.push('# --- Master Bias (compartilhado) ---', 'cd biases', 'convert bias -out=../process', 'cd ../process',
      `stack bias ${REJ} -nonorm -out=../master_bias`, 'cd ..', '')
  }
  if (o.hasDarkFlats) {
    out.push('# --- Master Dark Flat (compartilhado) ---', 'cd darkflats', 'convert darkflat -out=../process', 'cd ../process',
      `stack darkflat ${REJ} -nonorm -out=../master_darkflat`, 'cd ..', '')
  }
  if (o.hasDarks) {
    out.push('# --- Master Dark (compartilhado) ---', 'cd darks', 'convert dark -out=../process', 'cd ../process',
      `stack dark ${REJ} -nonorm -out=../master_dark`, 'cd ..', '')
  }
  return out
}

function shoFlatCalArg(o: SHOOptions): string {
  return o.hasDarkFlats ? '-dark=../master_darkflat' : o.hasBias ? '-bias=../master_bias' : ''
}

// Bloco de uma noite: gera master flat da noite, calibra os lights e extrai Ha/OIII.
// Retorna as sequências extraídas (haSeq = canal vermelho, oiiiSeq = canal verde/azul).
function shoSessionBlock(o: SHOOptions, group: 'haoiii' | 'siioiii', i: number) {
  const tag     = `${group}${i}`
  const flatCal = shoFlatCalArg(o)
  const darkArg = o.hasDarks ? '-dark=../master_dark -cc=dark' : ''
  const label   = group === 'haoiii' ? 'Ha+OIII' : 'SII+OIII'

  const lines = [
    `# --- ${label} — noite ${i} ---`,
    `cd ${group}_${i}/flats`,
    `convert ${tag}flat -out=../../process`,
    'cd ../../process',
    ...(flatCal
      ? [`calibrate ${tag}flat ${flatCal}`, `stack pp_${tag}flat ${REJ} -norm=mul -out=../master_flat_${tag}`]
      : [`stack ${tag}flat ${REJ} -norm=mul -out=../master_flat_${tag}`]),
    'cd ..',
    `cd ${group}_${i}/lights`,
    `convert ${tag} -out=../../process`,
    'cd ../../process',
    `calibrate ${tag} ${[darkArg, `-flat=../master_flat_${tag}`, '-cfa', '-equalize_cfa', '-debayer'].filter(Boolean).join(' ')}`,
    `seqextract_HaOIII pp_${tag}`,
    'cd ..',
    '',
  ]
  return { lines, haSeq: `Ha_pp_${tag}`, oiiiSeq: `OIII_pp_${tag}` }
}

// Junta (se >1), registra e empilha um canal num resultado na raiz.
function shoChannelStack(list: string[], name: string, outName: string): string[] {
  if (list.length === 0) return []
  const lines: string[] = [`# --- Canal ${name} ---`]
  let seq: string
  if (list.length === 1) {
    seq = list[0]
  } else {
    seq = `${name}_all`
    lines.push(`merge ${list.join(' ')} ${seq}`)
  }
  lines.push(
    `register ${seq}`,
    `stack r_${seq} ${REJ} -norm=addscale -output_norm -out=../${outName}`,
    '',
  )
  return lines
}

export function generateSHOScript(o: SHOOptions): string {
  const s = slug(o.target)
  const ha = Math.max(0, Math.floor(o.haoiiiNights))
  const si = Math.max(0, Math.floor(o.siioiiiNights))

  const lines: string[] = [
    'requires 1.2.0',
    '',
    `# ===== AstroLog — SHO de OSC (multi-sessão): ${o.target} =====`,
    '# Compartilhado na raiz: ./darks' + (o.hasDarkFlats ? ' ./dflats' : '') + (o.hasBias ? ' ./biases' : ''),
    ha > 0 ? `# Noites Ha+OIII:  ./haoiii_1/lights + ./haoiii_1/flats  … até _${ha}` : '# (sem noites Ha+OIII)',
    si > 0 ? `# Noites SII+OIII: ./siioiii_1/lights + ./siioiii_1/flats … até _${si}` : '# (sem noites SII+OIII)',
    '# Flats são por noite. OIII é empilhado de TODAS as noites. Resultados na raiz.',
    '',
    ...shoSharedMasters(o),
  ]

  const haList:   string[] = []   // Ha (canal vermelho das noites Ha+OIII)
  const siiList:  string[] = []   // SII (canal vermelho das noites SII+OIII)
  const oiiiList: string[] = []   // OIII (verde/azul de TODAS as noites)

  for (let i = 1; i <= ha; i++) {
    const b = shoSessionBlock(o, 'haoiii', i)
    lines.push(...b.lines)
    haList.push(b.haSeq)
    oiiiList.push(b.oiiiSeq)
  }
  for (let i = 1; i <= si; i++) {
    const b = shoSessionBlock(o, 'siioiii', i)
    lines.push(...b.lines)
    siiList.push(b.haSeq)   // canal vermelho do SII+OIII = SII
    oiiiList.push(b.oiiiSeq)
  }

  // Merge/register/stack acontece dentro de process/ (onde estão as sequências)
  lines.push('# ===== Integração por canal =====', 'cd process', '')
  lines.push(...shoChannelStack(haList,   'Ha',   `${s}_Ha`))
  lines.push(...shoChannelStack(siiList,  'SII',  `${s}_SII`))
  lines.push(...shoChannelStack(oiiiList, 'OIII', `${s}_OIII`))
  lines.push('cd ..', '')

  // Composições rápidas (sem pesos) — ponto de partida; afine no PixelMath
  const hasHa = haList.length > 0, hasSii = siiList.length > 0, hasOiii = oiiiList.length > 0
  lines.push('# ===== Composições (RGB) =====')
  if (hasSii && hasHa && hasOiii) lines.push(`rgbcomp ${s}_SII ${s}_Ha ${s}_OIII -out=${s}_SHO`)
  if (hasHa && hasOiii)           lines.push(`rgbcomp ${s}_Ha ${s}_OIII ${s}_OIII -out=${s}_HOO`)
  if (hasSii && hasOiii)          lines.push(`rgbcomp ${s}_SII ${s}_OIII ${s}_OIII -out=${s}_SOO`)
  lines.push('', 'close', '')

  return lines.join('\n')
}

// Receita de PixelMath para SHO ponderado (PixInsight). Os pesos balanceiam o
// Ha (que domina) — começe perto destes e ajuste a gosto.
export function generateShoPixelMath(target: string, w: { s: number; h: number; o: number }): string {
  const s = slug(target)
  return `# PixelMath SHO ponderado — PixInsight (símbolos: S, H, O)
# Aponte os símbolos para as imagens: S=${s}_SII  H=${s}_Ha  O=${s}_OIII
# (Image > PixelMath, marque "Use a single RGB/K expression" desligado e use R/G/B)
R:  ${w.s.toFixed(2)}*S
G:  ${w.h.toFixed(2)}*H
B:  ${w.o.toFixed(2)}*O
# Symbols: S, H, O
# Dica: Ha costuma dominar — segure o H (<1) e realce S e O. Reajuste com SCNR/curvas depois.
`
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
