import { z } from 'zod'
import { router, protectedProcedure } from '../trpc'

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
  hours:         Array<{
    time:  string
    cloud: number
    wind:  number
    precip: number
  }>
}

function scoreNight(hours: Array<{ cloud: number; wind: number; precip: number; precipitation: number }>): number {
  if (hours.length === 0) return 0

  const avgCloud  = hours.reduce((s, h) => s + h.cloud, 0) / hours.length
  const avgWind   = hours.reduce((s, h) => s + h.wind, 0) / hours.length
  const avgPrecip = hours.reduce((s, h) => s + h.precip, 0) / hours.length

  // penalties: clouds 70%, wind 20%, precip 30% — then normalize
  const cloudPenalty  = (avgCloud / 100) * 70
  const windPenalty   = Math.min((avgWind / 50) * 20, 20)
  const precipPenalty = (avgPrecip / 100) * 30

  const raw = Math.max(0, 100 - cloudPenalty - windPenalty - precipPenalty)
  return Math.round(raw)
}

function scoreLabel(score: number): string {
  if (score >= 80) return 'Excelente'
  if (score >= 60) return 'Bom'
  if (score >= 40) return 'Razoável'
  if (score >= 20) return 'Ruim'
  return 'Péssimo'
}

export const weatherRouter = router({
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
      const seen = new Set<string>()

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
        night.score         = scoreNight(night.hours as any)
        night.label         = scoreLabel(night.score)
        night.cloudCoverAvg = +(night.hours.reduce((s, h) => s + h.cloud, 0) / (night.hours.length || 1)).toFixed(1)
        night.windAvg       = +(night.hours.reduce((s, h) => s + h.wind, 0)  / (night.hours.length || 1)).toFixed(1)
        night.precipRisk    = +(night.hours.reduce((s, h) => s + h.precip, 0) / (night.hours.length || 1)).toFixed(1)
      })

      return {
        latitude:  lat,
        longitude: lon,
        nights:    nights.slice(0, 7),
      }
    }),
})
