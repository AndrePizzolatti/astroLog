// Efeméride para o planejador — envolve a astronomy-engine (offline, sem API).
// RA em horas, Dec em graus (J2000) — mesmo formato que guardamos no projeto.
import * as Astronomy from 'astronomy-engine'

export interface AltSample { t: number; alt: number }  // t = epoch ms

export interface NightBounds { sunset: Date; sunrise: Date }

export interface TargetPlan {
  samples:      AltSample[]
  maxAlt:       number
  transit:      Date | null
  hoursVisible: number   // acima de minAlt durante a noite
  moonIllum:    number   // 0–100 (% iluminada)
  moonSep:      number   // graus (no trânsito do alvo)
  moonAlt:      number   // altitude da Lua no trânsito do alvo
}

function obs(lat: number, lon: number) {
  return new Astronomy.Observer(lat, lon, 0)
}

// Separação angular entre dois pontos (RA horas, Dec graus) em graus.
export function separation(ra1h: number, dec1: number, ra2h: number, dec2: number): number {
  const d2r = Math.PI / 180
  const a1 = ra1h * 15 * d2r, a2 = ra2h * 15 * d2r, d1 = dec1 * d2r, d2 = dec2 * d2r
  const c = Math.sin(d1) * Math.sin(d2) + Math.cos(d1) * Math.cos(d2) * Math.cos(a1 - a2)
  return Math.acos(Math.min(1, Math.max(-1, c))) / d2r
}

// Pôr e nascer do Sol em torno da noite da data informada (horário local do navegador).
export function nightBounds(date: Date, lat: number, lon: number): NightBounds {
  const o = obs(lat, lon)
  const noon = new Date(date); noon.setHours(12, 0, 0, 0)
  const sunset  = Astronomy.SearchRiseSet(Astronomy.Body.Sun, o, -1, noon, 1)?.date   ?? new Date(noon.getTime() + 6 * 3_600_000)
  const sunrise = Astronomy.SearchRiseSet(Astronomy.Body.Sun, o, +1, sunset, 1)?.date ?? new Date(sunset.getTime() + 10 * 3_600_000)
  return { sunset, sunrise }
}

function altAt(date: Date, o: Astronomy.Observer, raH: number, decDeg: number): number {
  return Astronomy.Horizon(date, o, raH, decDeg, 'normal').altitude
}

// Curva de altitude do alvo ao longo da noite + métricas + Lua.
export function planTarget(
  raH: number, decDeg: number, lat: number, lon: number, bounds: NightBounds, minAlt = 30,
): TargetPlan {
  const o = obs(lat, lon)
  const stepMs = 10 * 60 * 1000
  const samples: AltSample[] = []
  let maxAlt = -90, transit: Date | null = null

  for (let t = bounds.sunset.getTime(); t <= bounds.sunrise.getTime(); t += stepMs) {
    const d = new Date(t)
    const alt = altAt(d, o, raH, decDeg)
    samples.push({ t, alt: Math.round(alt * 10) / 10 })
    if (alt > maxAlt) { maxAlt = alt; transit = d }
  }

  const hoursVisible = samples.filter(s => s.alt >= minAlt).length * (stepMs / 3_600_000)
  const when = transit ?? new Date((bounds.sunset.getTime() + bounds.sunrise.getTime()) / 2)
  const moonIllum = Math.round(Astronomy.Illumination(Astronomy.Body.Moon, when).phase_fraction * 100)
  const moonEq = Astronomy.Equator(Astronomy.Body.Moon, when, o, true, true)
  const moonSep = separation(raH, decDeg, moonEq.ra, moonEq.dec)
  const moonAlt = altAt(when, o, moonEq.ra, moonEq.dec)

  return {
    samples,
    maxAlt:       Math.round(maxAlt * 10) / 10,
    transit,
    hoursVisible: Math.round(hoursVisible * 10) / 10,
    moonIllum,
    moonSep:      Math.round(moonSep),
    moonAlt:      Math.round(moonAlt),
  }
}

// Versão leve para ranquear vários alvos: só máximo de altitude + trânsito + horas visíveis.
export function quickMax(
  raH: number, decDeg: number, lat: number, lon: number, bounds: NightBounds, minAlt = 30,
): { maxAlt: number; transit: Date | null; hoursVisible: number } {
  const o = obs(lat, lon)
  const stepMs = 20 * 60 * 1000
  let maxAlt = -90, transit: Date | null = null, above = 0
  for (let t = bounds.sunset.getTime(); t <= bounds.sunrise.getTime(); t += stepMs) {
    const d = new Date(t)
    const alt = altAt(d, o, raH, decDeg)
    if (alt > maxAlt) { maxAlt = alt; transit = d }
    if (alt >= minAlt) above++
  }
  return { maxAlt: Math.round(maxAlt * 10) / 10, transit, hoursVisible: Math.round(above * (stepMs / 3_600_000) * 10) / 10 }
}
