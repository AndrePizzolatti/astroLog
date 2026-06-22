// Motor de eventos astronômicos — calcula o que dá pra calcular (luas e chuvas de
// meteoros) e usa uma tabela curada (e verificada) pros eventos datados (eclipses,
// oposições). Sem dependências externas. Datas em UTC, precisão de ~1 dia (suficiente).

export type EventType =
  | 'METEOR_SHOWER' | 'ECLIPSE_SOLAR' | 'ECLIPSE_LUNAR'
  | 'PLANET_OPPOSITION' | 'NEW_MOON' | 'FULL_MOON'

export interface AstroEvent {
  type: EventType
  name: string
  date: string      // 'YYYY-MM-DD'
  note?: string
}

// ── Julian Day (mesma base do moon.ts) ───────────────────────────────────────
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
  const day   = Math.floor((h % 153) / 5) + 1
  const month = ((Math.floor(h / 153) + 2) % 12) + 1
  const year  = Math.floor(e / 1461) - 4716 + Math.floor((14 - month) / 12)
  return new Date(Date.UTC(year, month - 1, day))
}

const iso = (d: Date) => d.toISOString().slice(0, 10)

// ── Chuvas de meteoros (pico ~fixo todo ano) ──────────────────────────────────
const SHOWERS = [
  { name: 'Quadrântidas',    month: 1,  day: 3,  zhr: 110 },
  { name: 'Líridas',         month: 4,  day: 22, zhr: 18  },
  { name: 'Eta Aquáridas',   month: 5,  day: 6,  zhr: 50  },
  { name: 'Delta Aquáridas', month: 7,  day: 30, zhr: 25  },
  { name: 'Perseidas',       month: 8,  day: 12, zhr: 100 },
  { name: 'Oriônidas',       month: 10, day: 21, zhr: 20  },
  { name: 'Leônidas',        month: 11, day: 17, zhr: 15  },
  { name: 'Gemínidas',       month: 12, day: 14, zhr: 120 },
  { name: 'Ursídeas',        month: 12, day: 22, zhr: 10  },
]

// ── Eventos datados (verificados — timeanddate / starwalk, jun/2026) ───────────
const CURATED: AstroEvent[] = [
  { type: 'ECLIPSE_SOLAR',     name: 'Eclipse solar total',     date: '2026-08-12', note: 'Visível na Europa/Ártico' },
  { type: 'ECLIPSE_LUNAR',     name: 'Eclipse lunar parcial',   date: '2026-08-28' },
  { type: 'PLANET_OPPOSITION', name: 'Netuno em oposição',      date: '2026-09-26' },
  { type: 'PLANET_OPPOSITION', name: 'Saturno em oposição',     date: '2026-10-04', note: 'Ótima época pra Saturno' },
  { type: 'PLANET_OPPOSITION', name: 'Urano em oposição',       date: '2026-11-25' },
  { type: 'ECLIPSE_SOLAR',     name: 'Eclipse solar anular',    date: '2027-02-06' },
  { type: 'PLANET_OPPOSITION', name: 'Marte em oposição',       date: '2027-02-19', note: 'Melhor época pra Marte' },
  { type: 'ECLIPSE_LUNAR',     name: 'Eclipse lunar penumbral', date: '2027-02-20' },
  { type: 'ECLIPSE_LUNAR',     name: 'Eclipse lunar penumbral', date: '2027-07-18' },
  { type: 'ECLIPSE_SOLAR',     name: 'Eclipse solar total',     date: '2027-08-02', note: 'Visível no N. da África/Oriente Médio' },
  { type: 'ECLIPSE_LUNAR',     name: 'Eclipse lunar penumbral', date: '2027-08-17' },
]

function meteorOccurrences(from: Date, to: Date): AstroEvent[] {
  const out: AstroEvent[] = []
  for (let y = from.getUTCFullYear(); y <= to.getUTCFullYear(); y++) {
    for (const s of SHOWERS) {
      const d = new Date(Date.UTC(y, s.month - 1, s.day))
      if (d >= from && d <= to) {
        out.push({ type: 'METEOR_SHOWER', name: `${s.name} (pico)`, date: iso(d), note: `~${s.zhr} meteoros/h no pico` })
      }
    }
  }
  return out
}

function moonOccurrences(from: Date, to: Date): AstroEvent[] {
  const out: AstroEvent[] = []
  const start = Math.floor((toJulianDay(from) - KNOWN_NEW_MOON_JD) / LUNAR_CYCLE)
  for (let i = 0; i < 60; i++) {
    const dNew  = fromJulianDay(KNOWN_NEW_MOON_JD + (start + i) * LUNAR_CYCLE)
    const dFull = fromJulianDay(KNOWN_NEW_MOON_JD + (start + i + 0.5) * LUNAR_CYCLE)
    if (dNew > to) break
    if (dNew >= from)  out.push({ type: 'NEW_MOON',  name: 'Lua Nova',  date: iso(dNew),  note: 'Melhor janela pra céu profundo' })
    if (dFull >= from && dFull <= to) out.push({ type: 'FULL_MOON', name: 'Lua Cheia', date: iso(dFull), note: 'Evite céu profundo; bom pra lunar' })
  }
  return out
}

// Eventos dos próximos `days` dias, ordenados por data.
export function upcomingEvents(from: Date, days: number): AstroEvent[] {
  const start = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate()))
  const end   = new Date(start.getTime() + days * 86_400_000)
  const curated = CURATED.filter(e => {
    const d = new Date(e.date + 'T00:00:00Z')
    return d >= start && d <= end
  })
  return [...meteorOccurrences(start, end), ...moonOccurrences(start, end), ...curated]
    .sort((a, b) => a.date.localeCompare(b.date))
}
