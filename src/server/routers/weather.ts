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
    wind_speed_250hPa: number[]   // jet stream — proxy de seeing
    wind_speed_500hPa: number[]   // vento de médio nível
  }
}

interface NightScore {
  date:            string
  scoreDso:        number   // céu profundo: nuvem + vento + chuva + Lua
  labelDso:        string
  scoreDsoHiRes:   number   // idem + seeing (alvos de alta resolução)
  labelDsoHiRes:   string
  scorePlanetary:  number   // planetária/lunar: nuvem + vento + chuva + seeing (sem Lua)
  labelPlanetary:  string
  cloudCoverAvg:   number
  windAvg:         number
  precipRisk:      number
  moonIllumPct:    number   // % iluminada (fase) no meio da noite
  moonUpPct:       number   // % das horas noturnas com a Lua acima do horizonte
  moonEmoji:       string
  moonLabel:       string
  seeingLabel:     string   // rótulo do seeing estimado
  seeingDetail:    string   // "~1,4″ (7Timer)" ou "jet 120 km/h" (fallback)
  transparencyLabel: string // transparência do céu (7Timer) — '' se desconhecida
  hours:           Array<{
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

// DSO: seeing só conta no modo "alta resolução" (galáxia pequena, foco longo) — por isso
// é parâmetro opcional. Em céu profundo amplo/difuso o seeing é desprezível. Transparência
// (haze) reduz o sinal de alvos fracos — penalidade leve, só quando o 7Timer informa.
function scoreNight(hours: Array<{ cloud: number; wind: number; precip: number; precipitation: number }>, moonPenalty = 0, seeingPenalty = 0, transparencyPenalty = 0): number {
  if (hours.length === 0) return 0

  const avgCloud  = hours.reduce((s, h) => s + h.cloud, 0) / hours.length
  const avgWind   = hours.reduce((s, h) => s + h.wind, 0) / hours.length
  const avgPrecip = hours.reduce((s, h) => s + h.precip, 0) / hours.length

  // penalties: clouds 70%, wind 20%, precip 30%, Lua até 30, transparência até 20 (+ seeing se alta-res)
  const cloudPenalty  = (avgCloud / 100) * 70
  const windPenalty   = Math.min((avgWind / 50) * 20, 20)
  const precipPenalty = (avgPrecip / 100) * 30

  const raw = Math.max(0, 100 - cloudPenalty - windPenalty - precipPenalty - moonPenalty - seeingPenalty - transparencyPenalty)
  return Math.round(raw)
}

const MAX_SEEING_PENALTY       = 45   // planetária — seeing domina
const MAX_HIRES_SEEING_PENALTY = 25   // DSO alta resolução — seeing pesa, mas bem menos
const MAX_TRANSPARENCY_PENALTY = 20   // DSO — haze reduz o sinal de alvos fracos

// Fallback: seeing estimado pelo vento em altitude (jet stream a 250 hPa + 500 hPa). Jet
// forte = ar turbulento = seeing ruim. Usado quando o 7Timer não responde.
function seeingFromJet(avgJet: number, avgMid: number): { t: number; label: string } {
  const proxy = avgJet * 0.7 + avgMid * 0.3
  const t = Math.min(1, Math.max(0, (proxy - 30) / (130 - 30)))   // 30 km/h ótimo → 130 péssimo
  const label = proxy < 45 ? 'Excelente' : proxy < 75 ? 'Bom' : proxy < 110 ? 'Médio' : 'Ruim'
  return { t, label }
}

// 7Timer! ASTRO — índice de seeing/transparência feito pra astronomia (melhor que o jet cru).
// seeing: 1 (<0,5″) … 8 (>2,5″). transparency: 1 (ótima) … 8 (péssima).
interface SevenPoint { t: number; seeing: number; transparency: number }
async function fetchSevenTimer(lat: number, lon: number): Promise<SevenPoint[] | null> {
  try {
    const ctrl = new AbortController()
    const to = setTimeout(() => ctrl.abort(), 6000)
    const url = `https://www.7timer.info/bin/astro.php?lon=${lon.toFixed(3)}&lat=${lat.toFixed(3)}&ac=0&unit=metric&output=json`
    const res = await fetch(url, { signal: ctrl.signal })
    clearTimeout(to)
    if (!res.ok) return null
    const data: any = await res.json()
    const init: string = data?.init
    const series: any[] = data?.dataseries
    if (!init || !Array.isArray(series)) return null
    // init "YYYYMMDDHH" em UTC; cada ponto: timepoint = horas após o init.
    const initMs = Date.UTC(+init.slice(0, 4), +init.slice(4, 6) - 1, +init.slice(6, 8), +init.slice(8, 10))
    return series
      .filter(p => typeof p.seeing === 'number')
      .map(p => ({ t: initMs + p.timepoint * 3_600_000, seeing: p.seeing, transparency: p.transparency ?? 0 }))
  } catch { return null }
}

// índice de seeing do 7Timer (1–8) → arcsec aprox (ponto médio da faixa)
const SEEING_ARCSEC = [0, 0.4, 0.6, 0.9, 1.1, 1.4, 1.75, 2.25, 2.8]
const seeingArcsec  = (idx: number) => SEEING_ARCSEC[Math.max(1, Math.min(8, Math.round(idx)))]
const seeingLabelIdx     = (i: number) => i <= 2 ? 'Excelente' : i <= 3.5 ? 'Bom' : i <= 5.5 ? 'Médio' : 'Ruim'
const transparencyLabelIdx = (i: number) => i <= 2 ? 'Excelente' : i <= 4 ? 'Boa' : i <= 6 ? 'Média' : 'Ruim'

// Score planetário/lunar: a Lua NÃO conta (alvos brilhantes) e o seeing domina.
function scorePlanetaryNight(hours: Array<{ cloud: number; wind: number; precip: number }>, seeingPenalty = 0): number {
  if (hours.length === 0) return 0
  const avgCloud  = hours.reduce((s, h) => s + h.cloud, 0) / hours.length
  const avgWind   = hours.reduce((s, h) => s + h.wind, 0) / hours.length
  const avgPrecip = hours.reduce((s, h) => s + h.precip, 0) / hours.length

  // nuvem 60 (dá pra pegar buracos), vento de superfície 20 (vibração), chuva 30, seeing até 45
  const cloudPenalty  = (avgCloud / 100) * 60
  const windPenalty   = Math.min((avgWind / 50) * 20, 20)
  const precipPenalty = (avgPrecip / 100) * 30

  return Math.round(Math.max(0, 100 - cloudPenalty - windPenalty - precipPenalty - seeingPenalty))
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
        `&hourly=cloud_cover,wind_speed_10m,precipitation_probability,precipitation,wind_speed_250hPa,wind_speed_500hPa` +
        `&timezone=America%2FSao_Paulo&forecast_days=8`

      // Open-Meteo (nuvem/vento/chuva/jet) + 7Timer (seeing/transparência) em paralelo.
      const [res, seven] = await Promise.all([fetch(url), fetchSevenTimer(lat, lon)])
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
            date:           nightKey,
            scoreDso:       0,
            labelDso:       '',
            scoreDsoHiRes:  0,
            labelDsoHiRes:  '',
            scorePlanetary: 0,
            labelPlanetary: '',
            cloudCoverAvg:  0,
            windAvg:        0,
            precipRisk:     0,
            moonIllumPct:   0,
            moonUpPct:      0,
            moonEmoji:      '🌑',
            moonLabel:      '',
            seeingLabel:    '',
            seeingDetail:   '',
            transparencyLabel: '',
            hours:          [],
          }
          nights.push(night)
        }

        night.hours.push({
          time:  isoTime,
          cloud: data.hourly.cloud_cover[i] ?? 0,
          wind:  data.hourly.wind_speed_10m[i] ?? 0,
          precip: data.hourly.precipitation_probability[i] ?? 0,
          precipitation: data.hourly.precipitation[i] ?? 0,
          jet:   data.hourly.wind_speed_250hPa[i] ?? 0,
          mid:   data.hourly.wind_speed_500hPa[i] ?? 0,
        } as any)
      })

      nights.forEach(night => {
        const hrs           = night.hours as any[]
        const n             = hrs.length || 1
        const avgJet        = hrs.reduce((s, h) => s + (h.jet ?? 0), 0) / n
        const avgMid        = hrs.reduce((s, h) => s + (h.mid ?? 0), 0) / n
        const moon          = moonFactor(lat, lon, night.hours)

        // Seeing/transparência: 7Timer (preferido) → média dos pontos na janela da noite; jet fallback.
        let seeingT: number, seeingLabel: string, seeingDetail: string, transparencyLabel = '', trPenalty = 0
        const startMs = brt(hrs[0].time).getTime(), endMs = brt(hrs[hrs.length - 1].time).getTime()
        const pts = seven?.filter(p => p.t >= startMs - 5_400_000 && p.t <= endMs + 5_400_000) ?? []
        if (pts.length) {
          const avgSee = pts.reduce((s, p) => s + p.seeing, 0) / pts.length
          const avgTr  = pts.reduce((s, p) => s + p.transparency, 0) / pts.length
          seeingT      = Math.min(1, Math.max(0, (avgSee - 1) / 7))   // idx 1 ótimo → 8 péssimo
          seeingLabel  = seeingLabelIdx(avgSee)
          seeingDetail = `~${seeingArcsec(avgSee).toFixed(1).replace('.', ',')}″ (7Timer)`
          transparencyLabel = transparencyLabelIdx(avgTr)
          trPenalty    = Math.min(1, Math.max(0, (avgTr - 2) / 6)) * MAX_TRANSPARENCY_PENALTY   // idx ≤2 ótimo → 8 péssimo
        } else {
          const j = seeingFromJet(avgJet, avgMid)
          seeingT = j.t; seeingLabel = j.label; seeingDetail = `jet ${Math.round(avgJet)} km/h`
        }

        night.scoreDso        = scoreNight(hrs, moon.penalty, 0, trPenalty)
        night.labelDso        = scoreLabel(night.scoreDso)
        night.scoreDsoHiRes   = scoreNight(hrs, moon.penalty, seeingT * MAX_HIRES_SEEING_PENALTY, trPenalty)
        night.labelDsoHiRes   = scoreLabel(night.scoreDsoHiRes)
        night.scorePlanetary  = scorePlanetaryNight(hrs, seeingT * MAX_SEEING_PENALTY)
        night.labelPlanetary  = scoreLabel(night.scorePlanetary)
        night.cloudCoverAvg   = +(hrs.reduce((s, h) => s + h.cloud, 0) / n).toFixed(1)
        night.windAvg         = +(hrs.reduce((s, h) => s + h.wind, 0)  / n).toFixed(1)
        night.precipRisk      = +(hrs.reduce((s, h) => s + h.precip, 0) / n).toFixed(1)
        night.moonIllumPct    = moon.illumPct
        night.moonUpPct       = moon.upPct
        night.moonEmoji       = moon.emoji
        night.moonLabel       = moon.label
        night.seeingLabel     = seeingLabel
        night.seeingDetail    = seeingDetail
        night.transparencyLabel = transparencyLabel
      })

      return {
        latitude:  lat,
        longitude: lon,
        nights:    nights.slice(0, 7),
      }
    }),
})
