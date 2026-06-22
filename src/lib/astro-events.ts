// Motor de eventos astronômicos. Luas e chuvas de meteoros são calculadas/tabeladas;
// eclipses e oposições agora são CALCULADOS pela astronomy-engine (qualquer ano, sem
// tabela pra manter). Datas em UTC, precisão de ~1 dia.
import * as Astronomy from 'astronomy-engine'

export type EventType =
  | 'METEOR_SHOWER' | 'ECLIPSE_SOLAR' | 'ECLIPSE_LUNAR'
  | 'PLANET_OPPOSITION' | 'NEW_MOON' | 'FULL_MOON'

export interface AstroEvent {
  type: EventType
  name: string
  date: string      // 'YYYY-MM-DD'
  note?: string
}

// ── Lua (Julian Day — mesma base do moon.ts) ──────────────────────────────────
const LUNAR_CYCLE = 29.53058867
const KNOWN_NEW_MOON_JD = 2451549.5

function toJulianDay(date: Date): number {
  const y = date.getUTCFullYear(), m = date.getUTCMonth() + 1, d = date.getUTCDate()
  const a = Math.floor((14 - m) / 12), yy = y + 4800 - a, mm = m + 12 * a - 3
  return d + Math.floor((153 * mm + 2) / 5) + 365 * yy
    + Math.floor(yy / 4) - Math.floor(yy / 100) + Math.floor(yy / 400) - 32045
}
function fromJulianDay(jd: number): Date {
  const J = Math.floor(jd + 0.5)
  const f = J + 1401 + Math.floor((Math.floor((4 * J + 274277) / 146097) * 3) / 4) - 38
  const e = 4 * f + 3
  const g = Math.floor((e % 1461) / 4)
  const h = 5 * g + 2
  const day = Math.floor((h % 153) / 5) + 1
  const month = ((Math.floor(h / 153) + 2) % 12) + 1
  const year = Math.floor(e / 1461) - 4716 + Math.floor((14 - month) / 12)
  return new Date(Date.UTC(year, month - 1, day))
}
const iso = (d: Date) => d.toISOString().slice(0, 10)

// ── Chuvas de meteoros (pico ~fixo todo ano) ──────────────────────────────────
const SHOWERS = [
  { name: 'Quadrântidas', month: 1, day: 3, zhr: 110 }, { name: 'Líridas', month: 4, day: 22, zhr: 18 },
  { name: 'Eta Aquáridas', month: 5, day: 6, zhr: 50 }, { name: 'Delta Aquáridas', month: 7, day: 30, zhr: 25 },
  { name: 'Perseidas', month: 8, day: 12, zhr: 100 }, { name: 'Oriônidas', month: 10, day: 21, zhr: 20 },
  { name: 'Leônidas', month: 11, day: 17, zhr: 15 }, { name: 'Gemínidas', month: 12, day: 14, zhr: 120 },
  { name: 'Ursídeas', month: 12, day: 22, zhr: 10 },
]

function meteorOccurrences(from: Date, to: Date): AstroEvent[] {
  const out: AstroEvent[] = []
  for (let y = from.getUTCFullYear(); y <= to.getUTCFullYear(); y++) {
    for (const s of SHOWERS) {
      const d = new Date(Date.UTC(y, s.month - 1, s.day))
      if (d >= from && d <= to) out.push({ type: 'METEOR_SHOWER', name: `${s.name} (pico)`, date: iso(d), note: `~${s.zhr} meteoros/h no pico` })
    }
  }
  return out
}

function moonOccurrences(from: Date, to: Date): AstroEvent[] {
  const out: AstroEvent[] = []
  const start = Math.floor((toJulianDay(from) - KNOWN_NEW_MOON_JD) / LUNAR_CYCLE)
  for (let i = 0; i < 60; i++) {
    const dNew = fromJulianDay(KNOWN_NEW_MOON_JD + (start + i) * LUNAR_CYCLE)
    const dFull = fromJulianDay(KNOWN_NEW_MOON_JD + (start + i + 0.5) * LUNAR_CYCLE)
    if (dNew > to) break
    if (dNew >= from) out.push({ type: 'NEW_MOON', name: 'Lua Nova', date: iso(dNew), note: 'Melhor janela pra céu profundo' })
    if (dFull >= from && dFull <= to) out.push({ type: 'FULL_MOON', name: 'Lua Cheia', date: iso(dFull), note: 'Evite céu profundo; bom pra lunar' })
  }
  return out
}

// ── Eclipses (calculados) ──────────────────────────────────────────────────────
function eclipseKindPt(k: Astronomy.EclipseKind): string {
  if (k === Astronomy.EclipseKind.Total)     return 'total'
  if (k === Astronomy.EclipseKind.Annular)   return 'anular'
  if (k === Astronomy.EclipseKind.Partial)   return 'parcial'
  if (k === Astronomy.EclipseKind.Penumbral) return 'penumbral'
  return ''
}

function eclipseOccurrences(from: Date, to: Date): AstroEvent[] {
  const out: AstroEvent[] = []
  try {
    let le = Astronomy.SearchLunarEclipse(from)
    for (let i = 0; i < 12; i++) {
      const d = le.peak.date
      if (d > to) break
      if (d >= from) out.push({ type: 'ECLIPSE_LUNAR', name: `Eclipse lunar ${eclipseKindPt(le.kind)}`, date: iso(d) })
      le = Astronomy.NextLunarEclipse(le.peak)
    }
    let se = Astronomy.SearchGlobalSolarEclipse(from)
    for (let i = 0; i < 12; i++) {
      const d = se.peak.date
      if (d > to) break
      if (d >= from) {
        const note = se.latitude != null && se.longitude != null
          ? `Centralidade ~${se.latitude.toFixed(0)}°, ${se.longitude.toFixed(0)}°` : undefined
        out.push({ type: 'ECLIPSE_SOLAR', name: `Eclipse solar ${eclipseKindPt(se.kind)}`, date: iso(d), note })
      }
      se = Astronomy.NextGlobalSolarEclipse(se.peak)
    }
  } catch { /* ignore — efeméride fora de alcance */ }
  return out
}

// ── Oposições dos planetas externos (calculadas) ───────────────────────────────
const OUTER: { body: Astronomy.Body; name: string }[] = [
  { body: Astronomy.Body.Mars, name: 'Marte' }, { body: Astronomy.Body.Jupiter, name: 'Júpiter' },
  { body: Astronomy.Body.Saturn, name: 'Saturno' }, { body: Astronomy.Body.Uranus, name: 'Urano' },
  { body: Astronomy.Body.Neptune, name: 'Netuno' },
]

function oppositionOccurrences(from: Date, to: Date): AstroEvent[] {
  const out: AstroEvent[] = []
  // Oposição de um planeta externo = longitude eclíptica relativa à Terra (vista do Sol) = 0°.
  for (const p of OUTER) {
    try {
      let t = Astronomy.SearchRelativeLongitude(p.body, 0, from)
      for (let i = 0; i < 4; i++) {
        const d = t.date
        if (d > to) break
        if (d >= from) out.push({ type: 'PLANET_OPPOSITION', name: `${p.name} em oposição`, date: iso(d), note: 'Melhor época pra observar' })
        t = Astronomy.SearchRelativeLongitude(p.body, 0, new Date(d.getTime() + 30 * 86_400_000))
      }
    } catch { /* ignore */ }
  }
  return out
}

// ── Máxima elongação dos planetas internos (melhor visibilidade — análogo à oposição) ──
const INNER: { body: Astronomy.Body; name: string }[] = [
  { body: Astronomy.Body.Mercury, name: 'Mercúrio' },
  { body: Astronomy.Body.Venus,   name: 'Vênus' },
]

function elongationOccurrences(from: Date, to: Date): AstroEvent[] {
  const out: AstroEvent[] = []
  for (const p of INNER) {
    try {
      let e = Astronomy.SearchMaxElongation(p.body, from)
      for (let i = 0; i < 8; i++) {
        const d = e.time.date
        if (d > to) break
        if (d >= from) {
          const quando = e.visibility === 'morning' ? 'matutina' : 'vespertina'
          out.push({
            type: 'PLANET_OPPOSITION',   // mesmo tratamento/sinalização da oposição
            name: `${p.name} — máxima elongação ${quando}`,
            date: iso(d),
            note: `${e.elongation.toFixed(0)}° do Sol — melhor visibilidade`,
          })
        }
        e = Astronomy.SearchMaxElongation(p.body, new Date(d.getTime() + 10 * 86_400_000))
      }
    } catch { /* ignore */ }
  }
  return out
}

// Brilho máximo de Vênus (greatest brilliancy) — entre a elongação e a conjunção inferior.
function venusBrilliancy(from: Date, to: Date): AstroEvent[] {
  const out: AstroEvent[] = []
  try {
    let e = Astronomy.SearchPeakMagnitude(Astronomy.Body.Venus, from)
    for (let i = 0; i < 6; i++) {
      const d = e.time.date
      if (d > to) break
      if (d >= from) out.push({ type: 'PLANET_OPPOSITION', name: 'Vênus — brilho máximo', date: iso(d), note: `mag ${e.mag.toFixed(1)} — pico de brilho` })
      e = Astronomy.SearchPeakMagnitude(Astronomy.Body.Venus, new Date(d.getTime() + 30 * 86_400_000))
    }
  } catch { /* ignore */ }
  return out
}

// Eventos dos próximos `days` dias, ordenados por data.
export function upcomingEvents(from: Date, days: number): AstroEvent[] {
  const start = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate()))
  const end = new Date(start.getTime() + days * 86_400_000)
  return [
    ...meteorOccurrences(start, end),
    ...moonOccurrences(start, end),
    ...eclipseOccurrences(start, end),
    ...oppositionOccurrences(start, end),
    ...elongationOccurrences(start, end),
    ...venusBrilliancy(start, end),
  ].sort((a, b) => a.date.localeCompare(b.date))
}
