// Lê metadados de captura planetária do arquivo, client-side:
//  - .ser  → cabeçalho SER (frames, ROI, instrumento, data UTC)
//  - .txt/.log → log do FireCapture (fps, exposição, gain, ROI, frames, filtro)

export interface PlanetaryMeta {
  totalFrames?:     number
  roi?:             string
  observedAt?:      Date
  fps?:             number
  exposureMs?:      number
  gain?:            number
  filterUsed?:      string
  captureSoftware?: string
  instrument?:      string
}

// SER v3: header de 178 bytes, little-endian. (LUCAM-RECORDER)
function parseSER(buf: ArrayBuffer): PlanetaryMeta {
  if (buf.byteLength < 178) return {}
  const dv = new DataView(buf)
  const fileId = new TextDecoder('ascii').decode(new Uint8Array(buf, 0, 14))
  if (!fileId.startsWith('LUCAM-RECORDER')) return {}

  const width  = dv.getInt32(26, true)
  const height = dv.getInt32(30, true)
  const frames = dv.getInt32(38, true)
  const str = (off: number) => new TextDecoder('ascii').decode(new Uint8Array(buf, off, 40)).split('\0')[0].trim()
  const instrument = str(82)

  let observedAt: Date | undefined
  try {
    // DateTimeUTC: int64 little-endian em ticks .NET (100ns desde 0001-01-01). Lido como 2×int32
    // pra não depender de BigInt (precisão de Number sobra pra precisão de dia).
    const low  = dv.getUint32(170, true)
    const high = dv.getInt32(174, true)
    const ms = (high * 4294967296 + low) / 10000 - 62135596800000
    const d = new Date(ms)
    if (!isNaN(d.getTime()) && d.getUTCFullYear() > 1990 && d.getUTCFullYear() < 2100) observedAt = d
  } catch { /* sem data */ }

  return {
    totalFrames: frames > 0 ? frames : undefined,
    roi:         width > 0 && height > 0 ? `${width}×${height}` : undefined,
    instrument:  instrument || undefined,
    observedAt,
  }
}

// Log de texto do FireCapture (formato varia por versão — parse defensivo).
function parseFireCapture(text: string): PlanetaryMeta {
  const m: PlanetaryMeta = {}
  if (/firecapture/i.test(text)) m.captureSoftware = 'FireCapture'
  const g = (re: RegExp) => text.match(re)?.[1]

  const fps = g(/FPS\s*\(avg\.?\)?\s*[=:]\s*([\d.]+)/i) ?? g(/\bFPS\s*[=:]\s*([\d.]+)/i)
  if (fps) m.fps = parseFloat(fps)

  const expMs = g(/(?:Exposure|Shutter)\s*[=:]\s*([\d.]+)\s*ms/i)
  if (expMs) m.exposureMs = parseFloat(expMs)
  else { const s = g(/(?:Exposure|Shutter)\s*[=:]\s*([\d.]+)\s*s\b/i); if (s) m.exposureMs = parseFloat(s) * 1000 }

  const gain = g(/\bGain\s*[=:]\s*(\d+)/i);                if (gain) m.gain = parseInt(gain, 10)
  const fr   = g(/Frames\s*captured\s*[=:]\s*(\d+)/i) ?? g(/\bFrames\s*[=:]\s*(\d+)/i); if (fr) m.totalFrames = parseInt(fr, 10)
  const roi  = g(/ROI\s*[=:]\s*(\d+\s*[x×]\s*\d+)/i);      if (roi) m.roi = roi.replace(/\s/g, '').replace('x', '×')
  const filt = g(/Filter\s*[=:]\s*([^\r\n]+)/i);           if (filt && !/none/i.test(filt)) m.filterUsed = filt.trim()
  return m
}

export async function parsePlanetaryFile(file: File): Promise<PlanetaryMeta> {
  const name = file.name.toLowerCase()
  if (name.endsWith('.ser')) {
    const buf = await file.slice(0, 256).arrayBuffer()
    return parseSER(buf)
  }
  if (name.endsWith('.txt') || name.endsWith('.log')) {
    return parseFireCapture(await file.text())
  }
  return {}
}
