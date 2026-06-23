import { z } from 'zod'
import * as Astronomy from 'astronomy-engine'
import { router, protectedProcedure } from '../trpc'
import { getMoonPhase } from '@/lib/moon'

interface OpenMeteoResponse {
  hourly: {
    time: string[]
    cloud_cover: number[]
    wind_speed_10m: number[]
    precipitation_probability: number[]
    precipitation: number[]
  }
}

interface NightScore {
  date:          string
  score:         number
  label:         string
  cloudCoverAvg: number
  windAvg:       number
  precipRisk:    number
  moonIllumPct:  number   // % iluminada (fase) no meio da noite
  moonUpPct:     number   // % das horas noturnas com a Lua acima do horizonte
  moonEmoji:     string
  moonLabel:     string
  hours:         Array<{
    time:  string
    cloud: number
    wind:  number
    precip: number
  }>
}

// Open-Meteo devolve horários no fuso pedido (America/Sao_Paulo) sem offset.
// O Brasil não tem mais horário de verão → UTC−3 o ano todo; anexamos pra obter o
// instante UTC correto ao calcular a posição da Lua.
function brt(time: string): Date {
  return new Date(time + '-03:00')
}

const MAX_MOON_PENALTY = 30

// Impacto da Lua na noite: iluminação (fase) × fração da noite acima do horizonte.
// Lua nova ou abaixo do horizonte → ~0; Lua cheia alta a noite toda → penalidade máxima.
function moonFactor(lat: number, lon: number, hours: Array<{ time: string }>) {
  if (hours.length === 0) return { illumPct: 0, upPct: 0, penalty: 0, emoji: '🌑', label: '' }
  const obs = new Astronomy.Observer(lat, lon, 0)
  const phase = getMoonPhase(brt(hours[Math.floor(hours.length / 2)].time))

  let up = 0
  for (const h of hours) {
    const d  = brt(h.time)
    const eq = Astronomy.Equator(Astronomy.Body.Moon, d, obs, true, true)
    if (Astronomy.Horizon(d, obs, eq.ra, eq.dec, 'normal').altitude > 0) up++
  }
  const upFraction = up / hours.length
  const penalty = (phase.illumination / 100) * upFraction * MAX_MOON_PENALTY
  return { illumPct: phase.illumination, upPct: Math.round(upFraction * 100), penalty, emoji: phase.emoji, label: phase.label }
}

function scoreNight(hours: Array<{ cloud: number; wind: number; precip: number; precipitation: number }>, moonPenalty = 0): number {
  if (hours.length === 0) return 0

  const avgCloud  = hours.reduce((s, h) => s + h.cloud, 0) / hours.length
  const avgWind   = hours.reduce((s, h) => s + h.wind, 0) / hours.length
  const avgPrecip = hours.reduce((s, h) => s + h.precip, 0) / hours.length

  // penalties: clouds 70%, wind 20%, precip 30%, Lua até 30 — depois normaliza
  const cloudPenalty  = (avgCloud / 100) * 70
  const windPenalty   = Math.min((avgWind / 50) * 20, 20)
  const precipPenalty = (avgPrecip / 100) * 30

  const raw = Math.max(0, 100 - cloudPenalty - windPenalty - precipPenalty - moonPenalty)
  return Math.round(raw)
}

function scoreLabel(score: number): string {
  if (score >= 80) return 'Excelente'
  if (score >= 60) return 'Bom'
  if (score >= 40) return 'Razoável'
  if (score >= 20) return 'Ruim'
  return 'Péssimo'
}

interface OpenMeteoHistoricalResponse {
  hourly: {
    time: string[]
    temperature_2m: number[]
    relative_humidity_2m: number[]
    cloud_cover: number[]
  }
}

export const weatherRouter = router({
  // Returns atmospheric conditions for a specific date/hour from the user's location.
  // Uses forecast API (past_days=14) for recent dates, archive API for older ones.
  getForDate: protectedProcedure
    .input(z.object({
      latitude:  z.number().min(-90).max(90).optional(),
      longitude: z.number().min(-180).max(180).optional(),
      dateTime:  z.string(), // "YYYY-MM-DDTHH:mm" in local (BRT) time
    }))
    .query(async ({ ctx, input }) => {
      const user = await ctx.prisma.user.findUnique({
        where:  { id: ctx.session.user.id },
        select: { latitude: true, longitude: true },
      })

      const lat = input.latitude  ?? user?.latitude  ?? -27.6
      const lon = input.longitude ?? user?.longitude ?? -48.5

      const dateStr    = input.dateTime.substring(0, 10)  // "YYYY-MM-DD"
      const targetHour = parseInt(input.dateTime.substring(11, 13))

      const inputDate  = new Date(input.dateTime)
      const now        = new Date()

      // Refuse future dates beyond 7-day forecast window
      if (inputDate.getTime() > now.getTime() + 7 * 24 * 60 * 60 * 1000) return null

      const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000)
      const useArchive = inputDate < fourteenDaysAgo

      let url: string
      if (useArchive) {
        url = `https://archive-api.open-meteo.com/v1/archive` +
          `?latitude=${lat}&longitude=${lon}` +
          `&hourly=temperature_2m,relative_humidity_2m,cloud_cover` +
          `&timezone=America%2FSao_Paulo` +
          `&start_date=${dateStr}&end_date=${dateStr}`
      } else {
        url = `https://api.open-meteo.com/v1/forecast` +
          `?latitude=${lat}&longitude=${lon}` +
          `&hourly=temperature_2m,relative_humidity_2m,cloud_cover` +
          `&timezone=America%2FSao_Paulo&past_days=14&forecast_days=7`
      }

      try {
        const res = await fetch(url)
        if (!res.ok) return null
        const data = (await res.json()) as OpenMeteoHistoricalResponse

        const idx = data.hourly.time.findIndex(t =>
          t.startsWith(dateStr) && parseInt(t.substring(11, 13)) === targetHour,
        )
        if (idx === -1) return null

        return {
          temperatureC:  data.hourly.temperature_2m[idx]         ?? null,
          humidityPct:   Math.round(data.hourly.relative_humidity_2m[idx] ?? 0),
          cloudCoverPct: Math.round(data.hourly.cloud_cover[idx]           ?? 0),
        }
      } catch {
        return null
      }
    }),

  forecast: protectedProcedure
    .input(z.object({
      latitude:  z.number().min(-90).max(90),
      longitude: z.number().min(-180).max(180),
    }).optional())
    .query(async ({ ctx, input }) => {
      const user = await ctx.prisma.user.findUnique({
        where: { id: ctx.session.user.id },
        select: { latitude: true, longitude: true },
      })

      const lat = input?.latitude  ?? user?.latitude  ?? -27.6
      const lon = input?.longitude ?? user?.longitude ?? -48.5

      const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
        `&hourly=cloud_cover,wind_speed_10m,precipitation_probability,precipitation` +
        `&timezone=America%2FSao_Paulo&forecast_days=8`

      const res = await fetch(url)
      if (!res.ok) throw new Error('Open-Meteo fetch failed')

      const data = (await res.json()) as OpenMeteoResponse

      const nights: NightScore[] = []

      data.hourly.time.forEach((isoTime, i) => {
        const dt    = new Date(isoTime)
        const hour  = dt.getHours()
        const date  = isoTime.substring(0, 10)

        // nighttime: 20h–06h (next morning)
        const isNight = hour >= 20 || hour < 6
        if (!isNight) return

        // group by "night of" — hours before 6 belong to prior date's night
        const nightKey = hour < 6
          ? new Date(dt.getTime() - 86_400_000).toISOString().substring(0, 10)
          : date

        let night = nights.find(n => n.date === nightKey)
        if (!night) {
          night = {
            date:          nightKey,
            score:         0,
            label:         '',
            cloudCoverAvg: 0,
            windAvg:       0,
            precipRisk:    0,
            moonIllumPct:  0,
            moonUpPct:     0,
            moonEmoji:     '🌑',
            moonLabel:     '',
            hours:         [],
          }
          nights.push(night)
        }

        night.hours.push({
          time:  isoTime,
          cloud: data.hourly.cloud_cover[i] ?? 0,
          wind:  data.hourly.wind_speed_10m[i] ?? 0,
          precip: data.hourly.precipitation_probability[i] ?? 0,
          precipitation: data.hourly.precipitation[i] ?? 0,
        } as any)
      })

      nights.forEach(night => {
        const moon          = moonFactor(lat, lon, night.hours)
        night.score         = scoreNight(night.hours as any, moon.penalty)
        night.label         = scoreLabel(night.score)
        night.cloudCoverAvg = +(night.hours.reduce((s, h) => s + h.cloud, 0) / (night.hours.length || 1)).toFixed(1)
        night.windAvg       = +(night.hours.reduce((s, h) => s + h.wind, 0)  / (night.hours.length || 1)).toFixed(1)
        night.precipRisk    = +(night.hours.reduce((s, h) => s + h.precip, 0) / (night.hours.length || 1)).toFixed(1)
        night.moonIllumPct  = moon.illumPct
        night.moonUpPct     = moon.upPct
        night.moonEmoji     = moon.emoji
        night.moonLabel     = moon.label
      })

      return {
        latitude:  lat,
        longitude: lon,
        nights:    nights.slice(0, 7),
      }
    }),
})
