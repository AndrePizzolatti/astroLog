// Client-side FITS/XISF header parser — zero upload, zero dependencies.
// Lê apenas o início do arquivo (200 KB), suficiente para qualquer header.

export interface FITSFields {
  exposureSeconds?: number
  gain?:            number
  offset?:          number
  binning?:         string   // "1×1" | "2×2" | "3×3" | "4×4"
  sensorTempC?:     number
  filterUsed?:      string   // normalizado para os filtros do app
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
