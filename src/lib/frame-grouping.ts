// Agrupa frames lidos (header FITS/XISF ou nome de arquivo) em "sessões" do AstroLog.
// Convenção: uma sessão = uma noite + um filtro + um conjunto de parâmetros de captura.
// Frames de calibração (dark/flat/bias) não viram sessão — são apenas contabilizados.

import type { FITSFields } from './fits-parser'

export interface ParsedFrame extends FITSFields {
  fileName: string
}

export interface SessionGroup {
  key:             string
  nightOf:         string   // 'yyyy-MM-dd' — noite de referência
  observedAt:      string   // ISO — primeiro frame do grupo
  filterUsed?:     string
  exposureSeconds?: number
  gain?:           number
  offset?:         number
  binning?:        string
  sensorTempC?:    number
  lightsCount:     number
  integrationMin:  number
}

export interface GroupingResult {
  groups:  SessionGroup[]
  ignored: { darks: number; flats: number; bias: number }
  total:   number
}

// Noite-de: frames até as 12h pertencem à noite que começou no dia anterior.
// Subtrair 12h e pegar a data resolve isso (20h–05h caem na mesma "noite").
function nightOfDate(d: Date): string {
  const shifted = new Date(d.getTime() - 12 * 60 * 60 * 1000)
  const y = shifted.getFullYear()
  const m = String(shifted.getMonth() + 1).padStart(2, '0')
  const day = String(shifted.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function groupFrames(frames: ParsedFrame[]): GroupingResult {
  const ignored = { darks: 0, flats: 0, bias: 0 }
  const map = new Map<string, { group: SessionGroup; times: number[]; temps: number[] }>()

  for (const f of frames) {
    // Calibração não vira sessão
    if (f.imageType === 'DARK') { ignored.darks++; continue }
    if (f.imageType === 'FLAT') { ignored.flats++; continue }
    if (f.imageType === 'BIAS') { ignored.bias++;  continue }
    // LIGHT explícito ou UNKNOWN/ausente → tratado como light

    const when = f.observedAt instanceof Date && !isNaN(f.observedAt.getTime())
      ? f.observedAt
      : null
    if (!when) continue // sem data utilizável — pulado (o chamador garante fallback)

    const night = nightOfDate(when)
    const exp   = f.exposureSeconds ?? 0
    const key   = [
      night,
      f.filterUsed ?? '',
      exp,
      f.gain ?? '',
      f.binning ?? '',
    ].join('|')

    let entry = map.get(key)
    if (!entry) {
      entry = {
        group: {
          key,
          nightOf:         night,
          observedAt:      when.toISOString(),
          filterUsed:      f.filterUsed,
          exposureSeconds: f.exposureSeconds,
          gain:            f.gain,
          offset:          f.offset,
          binning:         f.binning,
          sensorTempC:     undefined,
          lightsCount:     0,
          integrationMin:  0,
        },
        times: [],
        temps: [],
      }
      map.set(key, entry)
    }

    entry.group.lightsCount++
    entry.times.push(when.getTime())
    if (typeof f.sensorTempC === 'number') entry.temps.push(f.sensorTempC)
    if (entry.group.offset === undefined && f.offset !== undefined) entry.group.offset = f.offset
  }

  const groups: SessionGroup[] = []
  for (const { group, times, temps } of map.values()) {
    const earliest = Math.min(...times)
    group.observedAt = new Date(earliest).toISOString()
    group.integrationMin = ((group.exposureSeconds ?? 0) * group.lightsCount) / 60
    if (temps.length) {
      const avg = temps.reduce((s, t) => s + t, 0) / temps.length
      group.sensorTempC = Math.round(avg * 10) / 10
    }
    groups.push(group)
  }

  // Ordena por noite (desc) e depois por filtro
  groups.sort((a, b) =>
    b.nightOf.localeCompare(a.nightOf) || (a.filterUsed ?? '').localeCompare(b.filterUsed ?? ''),
  )

  return { groups, ignored, total: frames.length }
}
