// Client-side FITS/XISF header parser — zero upload, zero dependencies.
// Lê apenas o início do arquivo (200 KB), suficiente para qualquer header.

export interface FITSFields {
  exposureSeconds?: number
  gain?:            number
  offset?:          number
  binning?:         string   // "1×1" | "2×2" | "3×3" | "4×4"
  sensorTempC?:     number
  filterUsed?:      string   // normalizado para os filtros do app
  // ── Metadados extras do N.I.N.A. / PixInsight ─────────────────────────────
  observedAt?:      Date     // DATE-OBS
  targetName?:      string   // OBJECT
  camera?:          string   // INSTRUME
  telescope?:       string   // TELESCOP
  ra?:              string   // RA / OBJCTRA
  dec?:             string   // DEC / OBJCTDEC
  imageType?:       FrameType // IMAGETYP / FRAME
  // ── Equipamento (para auto-cadastro) ──────────────────────────────────────
  focalLengthMm?:   number   // FOCALLEN
  apertureMm?:      number   // APTDIA / APERTURE
  pixelSizeUm?:     number   // XPIXSZ (tamanho do pixel, possivelmente já com binning aplicado)
  naxis1?:          number   // NAXIS1 (largura do frame em px)
  naxis2?:          number   // NAXIS2 (altura do frame em px)
  bayerPattern?:    string   // BAYERPAT — presença indica sensor colorido (OSC)
  focalRatio?:      number   // FOCRATIO
}

export type FrameType = 'LIGHT' | 'DARK' | 'FLAT' | 'BIAS' | 'UNKNOWN'

// Normaliza o tipo de frame (IMAGETYP) — "Light Frame", "DARK", "Flat Field"…
function normalizeImageType(raw: string): FrameType {
  const k = raw.toLowerCase()
  if (k.includes('light')) return 'LIGHT'
  if (k.includes('flat'))  return 'FLAT'   // "Dark Flat" cai aqui — calibração, ignorada de qualquer forma
  if (k.includes('bias'))  return 'BIAS'
  if (k.includes('dark'))  return 'DARK'
  return 'UNKNOWN'
}

// ── Filtros: normaliza variações de nome para os tokens do app ──────────────
const FILTER_MAP: Record<string, string> = {
  // Luminance
  luminance: 'L', lum: 'L', l: 'L',
  // RGB
  red: 'R', r: 'R',
  green: 'G', g: 'G',
  blue: 'B', b: 'B',
  // Narrowband
  ha: 'Ha', halpha: 'Ha', 'h-alpha': 'Ha', 'h_alpha': 'Ha', hydrogen: 'Ha',
  oiii: 'OIII', o3: 'OIII', 'o-iii': 'OIII',
  sii: 'SII', s2: 'SII', 'sulphur-ii': 'SII', 'sulfur-ii': 'SII',
}

function normalizeFilter(raw: string): string | undefined {
  const key = raw.toLowerCase().replace(/\s+/g, '')
  return FILTER_MAP[key] ?? (raw.length <= 6 ? raw : undefined)
}

// ── FITS ────────────────────────────────────────────────────────────────────
// Header: blocos de 2880 bytes, cada bloco tem 36 registros de 80 chars.
// Keyword ocupa os primeiros 8 chars; '=' na posição 8 indica campo com valor.

function parseFITS(buffer: ArrayBuffer): FITSFields {
  const bytes   = new Uint8Array(buffer)
  const decoder = new TextDecoder('ascii')
  const fields: FITSFields = {}

  let pos = 0
  outer: while (pos + 2880 <= bytes.length) {
    const block = decoder.decode(bytes.slice(pos, pos + 2880))
    pos += 2880

    for (let i = 0; i < 36; i++) {
      const rec = block.substring(i * 80, (i + 1) * 80)
      const kw  = rec.substring(0, 8).trimEnd()

      if (kw === 'END') break outer
      if (rec[8] !== '=') continue

      // Valor: tudo depois de '= ', antes do comentário '/'
      const rawVal = rec.substring(10).split('/')[0].trim()
      const num    = parseFloat(rawVal)
      const str    = rawVal.replace(/'/g, '').trim()

      switch (kw) {
        case 'EXPTIME':
        case 'EXPOSURE':
          if (!isNaN(num) && num > 0) fields.exposureSeconds = num
          break
        case 'GAIN':
          if (!isNaN(num)) fields.gain = Math.round(num)
          break
        case 'OFFSET':
        case 'BLKLEVEL':
        case 'PEDESTAL':
          if (!isNaN(num)) fields.offset = Math.round(num)
          break
        case 'XBINNING': {
          const b = Math.round(num)
          if (b >= 1 && b <= 4) fields.binning = `${b}×${b}`
          break
        }
        case 'CCD-TEMP':
        case 'SET-TEMP':
        case 'CAMERATEMP':
          if (!isNaN(num)) fields.sensorTempC = Math.round(num * 10) / 10
          break
        case 'FILTER':
          if (str) fields.filterUsed = normalizeFilter(str) ?? str
          break
        case 'DATE-OBS': {
          const d = new Date(str)
          if (!isNaN(d.getTime())) fields.observedAt = d
          break
        }
        case 'OBJECT':
          if (str) fields.targetName = str
          break
        case 'INSTRUME':
          if (str) fields.camera = str
          break
        case 'TELESCOP':
          if (str) fields.telescope = str
          break
        case 'RA':
        case 'OBJCTRA':
          if (str && !fields.ra) fields.ra = str
          break
        case 'DEC':
        case 'OBJCTDEC':
          if (str && !fields.dec) fields.dec = str
          break
        case 'IMAGETYP':
        case 'FRAME':
          if (str) fields.imageType = normalizeImageType(str)
          break
        case 'FOCALLEN':
          if (!isNaN(num) && num > 0) fields.focalLengthMm = num
          break
        case 'APTDIA':
          if (!isNaN(num) && num > 0) fields.apertureMm = num
          break
        case 'APERTURE':
          if (!isNaN(num) && num > 0 && fields.apertureMm === undefined) fields.apertureMm = num
          break
        case 'XPIXSZ':
          if (!isNaN(num) && num > 0) fields.pixelSizeUm = num
          break
        case 'NAXIS1':
          if (!isNaN(num) && num > 0) fields.naxis1 = Math.round(num)
          break
        case 'NAXIS2':
          if (!isNaN(num) && num > 0) fields.naxis2 = Math.round(num)
          break
        case 'BAYERPAT':
          if (str) fields.bayerPattern = str
          break
        case 'FOCRATIO':
          if (!isNaN(num) && num > 0) fields.focalRatio = num
          break
      }
    }
  }

  return fields
}

// ── XISF ────────────────────────────────────────────────────────────────────
// Estrutura: 8 bytes magic | 4 bytes header-length (LE uint32) | 4 bytes reservado | XML

function parseXISF(buffer: ArrayBuffer): FITSFields {
  if (buffer.byteLength < 16) return {}

  const view      = new DataView(buffer)
  const headerLen = view.getUint32(8, true)
  if (headerLen === 0 || 16 + headerLen > buffer.byteLength) return {}

  const xml    = new TextDecoder('utf-8').decode(new Uint8Array(buffer.slice(16, 16 + headerLen)))
  const fields: FITSFields = {}

  // 1) FITSKeyword elements — presente em arquivos gerados pelo N.I.N.A. / PI com keywords FITS
  const kwRe = /FITSKeyword[^>]*\bname="([^"]+)"[^>]*\bvalue="([^"]+)"/g
  let m: RegExpExecArray | null
  while ((m = kwRe.exec(xml)) !== null) {
    applyKV(m[1], m[2], fields)
  }

  // 2) Property elements — metadados nativos do PixInsight
  const propRe = /Property[^>]*\bid="([^"]+)"[^>]*\bvalue="([^"]+)"/g
  while ((m = propRe.exec(xml)) !== null) {
    const [, id, value] = m
    const num = parseFloat(value)
    switch (id) {
      case 'Instrument:ExposureTime':
        if (!isNaN(num) && num > 0) fields.exposureSeconds = num; break
      case 'Instrument:Camera:Gain':
        if (!isNaN(num)) fields.gain = Math.round(num); break
      case 'Instrument:Camera:Offset':
        if (!isNaN(num)) fields.offset = Math.round(num); break
      case 'Instrument:Camera:Temperature':
        if (!isNaN(num)) fields.sensorTempC = Math.round(num * 10) / 10; break
      case 'Instrument:Filter:Name':
        if (value) fields.filterUsed = normalizeFilter(value.replace(/'/g, '').trim()) ?? value; break
      case 'Instrument:Camera:XBinning': {
        const b = Math.round(num)
        if (b >= 1 && b <= 4) fields.binning = `${b}×${b}`; break
      }
      case 'Observation:Time:Start': {
        const d = new Date(value.replace(/'/g, '').trim())
        if (!isNaN(d.getTime())) fields.observedAt = d; break
      }
      case 'Observation:Object:Name':
        if (value) fields.targetName = value.replace(/'/g, '').trim(); break
      case 'Instrument:Camera:Name':
        if (value) fields.camera = value.replace(/'/g, '').trim(); break
      case 'Instrument:Telescope:Name':
        if (value) fields.telescope = value.replace(/'/g, '').trim(); break
      case 'Observation:Center:RA':
        if (!isNaN(num)) fields.ra = String(num); break
      case 'Observation:Center:Dec':
        if (!isNaN(num)) fields.dec = String(num); break
    }
  }

  return fields
}

function applyKV(name: string, value: string, fields: FITSFields) {
  const num = parseFloat(value)
  const str = value.replace(/'/g, '').trim()
  switch (name) {
    case 'EXPTIME': case 'EXPOSURE':
      if (!isNaN(num) && num > 0) fields.exposureSeconds = num; break
    case 'GAIN':
      if (!isNaN(num)) fields.gain = Math.round(num); break
    case 'OFFSET': case 'BLKLEVEL':
      if (!isNaN(num)) fields.offset = Math.round(num); break
    case 'XBINNING': { const b = Math.round(num); if (b >= 1 && b <= 4) fields.binning = `${b}×${b}`; break }
    case 'CCD-TEMP': case 'SET-TEMP':
      if (!isNaN(num)) fields.sensorTempC = Math.round(num * 10) / 10; break
    case 'FILTER':
      if (str) fields.filterUsed = normalizeFilter(str) ?? str; break
    case 'DATE-OBS': { const d = new Date(str); if (!isNaN(d.getTime())) fields.observedAt = d; break }
    case 'OBJECT':   if (str) fields.targetName = str; break
    case 'INSTRUME': if (str) fields.camera    = str; break
    case 'TELESCOP': if (str) fields.telescope = str; break
    case 'RA':       case 'OBJCTRA':   if (str && !fields.ra)  fields.ra  = str; break
    case 'DEC':      case 'OBJCTDEC':  if (str && !fields.dec) fields.dec = str; break
    case 'IMAGETYP': case 'FRAME':     if (str) fields.imageType = normalizeImageType(str); break
    case 'FOCALLEN': if (!isNaN(num) && num > 0) fields.focalLengthMm = num; break
    case 'APTDIA':   if (!isNaN(num) && num > 0) fields.apertureMm = num; break
    case 'APERTURE': if (!isNaN(num) && num > 0 && fields.apertureMm === undefined) fields.apertureMm = num; break
    case 'XPIXSZ':   if (!isNaN(num) && num > 0) fields.pixelSizeUm = num; break
    case 'NAXIS1':   if (!isNaN(num) && num > 0) fields.naxis1 = Math.round(num); break
    case 'NAXIS2':   if (!isNaN(num) && num > 0) fields.naxis2 = Math.round(num); break
    case 'BAYERPAT': if (str) fields.bayerPattern = str; break
    case 'FOCRATIO': if (!isNaN(num) && num > 0) fields.focalRatio = num; break
  }
}

// ── Entrada pública ──────────────────────────────────────────────────────────

export type SupportedFileType = 'fits' | 'xisf' | 'unsupported'

export function detectFileType(file: File): SupportedFileType {
  const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
  if (['fits', 'fit', 'fts'].includes(ext)) return 'fits'
  if (ext === 'xisf') return 'xisf'
  return 'unsupported'
}

export async function parseImageHeader(file: File): Promise<FITSFields> {
  const type = detectFileType(file)
  if (type === 'unsupported') return {}

  // Lê apenas os primeiros 200 KB — suficiente para qualquer header
  const slice  = file.slice(0, 200 * 1024)
  const buffer = await slice.arrayBuffer()

  // Verificação rápida de magic bytes
  const magic = new TextDecoder('ascii').decode(new Uint8Array(buffer.slice(0, 8)))
  if (type === 'xisf' && magic.startsWith('XISF')) return parseXISF(buffer)
  if (type === 'fits' && magic.startsWith('SIMPLE'))  return parseFITS(buffer)

  // Fallback: tenta FITS mesmo sem extensão correta
  if (magic.startsWith('SIMPLE')) return parseFITS(buffer)

  return {}
}

// ── Fallback por nome de arquivo (opção "Image File Pattern" do N.I.N.A.) ─────
// Quando o header não traz metadados (ou o arquivo não é FITS/XISF), tenta extrair
// filtro / exposição / gain / temperatura / tipo do próprio nome do arquivo.
// Ex.: "NGC3372_Ha_300s_Gain100_-10C.fits", "M42_Light_120.00s_G100_-10C_001.fit"

export function parseFilename(name: string): FITSFields {
  const base   = name.replace(/\.[^.]+$/, '')               // remove extensão
  const fields: FITSFields = {}

  // Exposição: "300s", "120.00s", "300sec", "_300_" (último recurso)
  const exp = base.match(/(\d+(?:[.,]\d+)?)\s*s(?:ec)?\b/i)
  if (exp) {
    const v = parseFloat(exp[1].replace(',', '.'))
    if (!isNaN(v) && v > 0) fields.exposureSeconds = v
  }

  // Gain: "Gain100", "G100", "gain_100"
  const gain = base.match(/\bgain[_-]?(\d+)\b/i) ?? base.match(/\bG(\d{2,4})\b/)
  if (gain) fields.gain = parseInt(gain[1], 10)

  // Offset: "Offset50", "O50"
  const off = base.match(/\boffset[_-]?(\d+)\b/i)
  if (off) fields.offset = parseInt(off[1], 10)

  // Temperatura: "-10C", "-10.0C", "_10C" (assume negativa só se vier o sinal)
  const temp = base.match(/(-?\d+(?:[.,]\d+)?)\s*C\b/)
  if (temp) {
    const v = parseFloat(temp[1].replace(',', '.'))
    if (!isNaN(v) && v >= -50 && v <= 50) fields.sensorTempC = Math.round(v * 10) / 10
  }

  // Binning: "bin1", "1x1", "2×2"
  const bin = base.match(/\bbin[_-]?(\d)\b/i) ?? base.match(/\b(\d)\s*[x×]\s*\1\b/i)
  if (bin) { const b = parseInt(bin[1], 10); if (b >= 1 && b <= 4) fields.binning = `${b}×${b}` }

  // Tipo de frame por palavra no nome
  if (/\b(light)\b/i.test(base))      fields.imageType = 'LIGHT'
  else if (/\b(flat)\b/i.test(base))  fields.imageType = 'FLAT'
  else if (/\b(bias)\b/i.test(base))  fields.imageType = 'BIAS'
  else if (/\b(dark)\b/i.test(base))  fields.imageType = 'DARK'

  // Filtro: procura tokens conhecidos delimitados por _ - ou espaço
  for (const token of base.split(/[\s_\-.]+/)) {
    const norm = normalizeFilter(token)
    if (norm && /^(L|R|G|B|Ha|OIII|SII)$/.test(norm)) { fields.filterUsed = norm; break }
  }

  return fields
}

// ── Extração de equipamento (para auto-cadastro) ─────────────────────────────
// Deriva telescópio e câmera a partir dos metadados de um frame. Os valores são
// um ponto de partida — o usuário revisa antes de salvar.

export interface DetectedTelescope {
  name:           string
  focalLengthMm?: number
  apertureMm?:    number
}

export interface DetectedCamera {
  name:           string
  pixelSizeUm?:   number
  sensorWidthPx?: number
  sensorHeightPx?: number
  colorType:      'COLOR' | 'MONO'
}

function binFactor(binning?: string): number {
  if (!binning) return 1
  const m = binning.match(/^(\d)/)
  return m ? Math.max(1, parseInt(m[1], 10)) : 1
}

export function extractEquipment(f: FITSFields): { telescope?: DetectedTelescope; camera?: DetectedCamera } {
  const bin = binFactor(f.binning)
  const result: { telescope?: DetectedTelescope; camera?: DetectedCamera } = {}

  // ── Telescópio ──
  if (f.focalLengthMm) {
    // Abertura: direta, ou derivada da razão focal quando ausente
    const aperture = f.apertureMm ?? (f.focalRatio ? Math.round(f.focalLengthMm / f.focalRatio) : undefined)
    result.telescope = {
      name:          f.telescope?.trim() || `${Math.round(f.focalLengthMm)}mm`,
      focalLengthMm: f.focalLengthMm,
      apertureMm:    aperture,
    }
  }

  // ── Câmera ──
  if (f.camera || f.pixelSizeUm || (f.naxis1 && f.naxis2)) {
    // Recupera dimensões e pixel físicos quando o frame foi capturado com binning
    const width  = f.naxis1 ? f.naxis1 * bin : undefined
    const height = f.naxis2 ? f.naxis2 * bin : undefined
    const pixel  = f.pixelSizeUm ? (bin > 1 ? Math.round((f.pixelSizeUm / bin) * 100) / 100 : f.pixelSizeUm) : undefined
    result.camera = {
      name:           f.camera?.trim() || 'Câmera',
      pixelSizeUm:    pixel,
      sensorWidthPx:  width,
      sensorHeightPx: height,
      colorType:      f.bayerPattern ? 'COLOR' : 'MONO',
    }
  }

  return result
}
