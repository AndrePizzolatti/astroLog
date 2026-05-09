// Cálculo da fase lunar usando Julian Day Number.
// Zero dependências externas — preciso o suficiente para astrofotografia (~1 dia de erro).

const LUNAR_CYCLE = 29.53058867  // dias
const KNOWN_NEW_MOON_JD = 2451549.5  // Lua Nova de 6 Jan 2000

function toJulianDay(date: Date): number {
  const y = date.getUTCFullYear()
  const m = date.getUTCMonth() + 1
  const d = date.getUTCDate()

  const a = Math.floor((14 - m) / 12)
  const yy = y + 4800 - a
  const mm = m + 12 * a - 3

  return d
    + Math.floor((153 * mm + 2) / 5)
    + 365 * yy
    + Math.floor(yy / 4)
    - Math.floor(yy / 100)
    + Math.floor(yy / 400)
    - 32045
}

export interface MoonPhase {
  phase:        number   // 0–1 (0 = Lua Nova, 0.5 = Lua Cheia)
  illumination: number   // 0–100 (percentual visível)
  label:        string
  emoji:        string
}

export function getMoonPhase(date: Date): MoonPhase {
  const jd    = toJulianDay(date)
  const raw   = ((jd - KNOWN_NEW_MOON_JD) % LUNAR_CYCLE) / LUNAR_CYCLE
  const phase = ((raw % 1) + 1) % 1  // normaliza para [0, 1)

  const illumination = Math.round((1 - Math.cos(phase * 2 * Math.PI)) / 2 * 100)

  let label: string
  let emoji: string

  if (phase < 0.025 || phase >= 0.975) {
    label = 'Lua Nova';          emoji = '🌑'
  } else if (phase < 0.25) {
    label = phase < 0.125 ? 'Crescente Inicial' : 'Quarto Crescente'
    emoji = phase < 0.125 ? '🌒' : '🌓'
  } else if (phase < 0.5) {
    label = phase < 0.375 ? 'Gibosa Crescente' : 'Quase Cheia'
    emoji = phase < 0.375 ? '🌔' : '🌔'
  } else if (phase < 0.525) {
    label = 'Lua Cheia';         emoji = '🌕'
  } else if (phase < 0.75) {
    label = phase < 0.625 ? 'Gibosa Minguante' : 'Quarto Minguante'
    emoji = phase < 0.625 ? '🌖' : '🌗'
  } else {
    label = 'Minguante';         emoji = '🌘'
  }

  return { phase, illumination, label, emoji }
}
