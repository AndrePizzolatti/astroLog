'use client'

import { useMemo, useState } from 'react'
import {
  startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval,
  addMonths, format, isSameMonth, isSameDay, differenceInCalendarDays,
} from 'date-fns'
import { ptBR } from 'date-fns/locale'
import Link from 'next/link'
import { ChevronLeft, ChevronRight, MapPin, Sparkles, Sun, Moon, Orbit } from 'lucide-react'
import { api } from '@/lib/trpc'
import { cn } from '@/lib/utils'
import { getMoonPhase } from '@/lib/moon'
import { upcomingEvents, type AstroEvent } from '@/lib/astro-events'
import { nightBounds, planetVisibility } from '@/lib/sky'

const DEFAULT_LAT = -27.6, DEFAULT_LON = -48.5
const WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
const DARK_SKY_MAX = 25   // % iluminada — abaixo disso a noite é boa pra céu profundo

function scoreColor(s: number): string {
  return s >= 80 ? 'bg-aurora-400' : s >= 60 ? 'bg-green-400' : s >= 40 ? 'bg-amber-400' : s >= 20 ? 'bg-orange-400' : 'bg-red-400'
}

const TYPE_DOT: Record<string, string> = {
  METEOR_SHOWER: 'bg-star-400', ECLIPSE_SOLAR: 'bg-amber-400',
  ECLIPSE_LUNAR: 'bg-cosmos-300', PLANET_OPPOSITION: 'bg-nebula-400',
}
const TYPE_ICON: Record<string, React.ComponentType<any>> = {
  METEOR_SHOWER: Sparkles, ECLIPSE_SOLAR: Sun, ECLIPSE_LUNAR: Moon,
  PLANET_OPPOSITION: Orbit, NEW_MOON: Moon, FULL_MOON: Moon,
}

export default function CalendarPage() {
  const { data: profile } = api.user.getProfile.useQuery()
  const lat = profile?.latitude ?? DEFAULT_LAT
  const lon = profile?.longitude ?? DEFAULT_LON

  const [view, setView] = useState(() => new Date())
  const [selected, setSelected] = useState(() => new Date())

  // Previsão (próximas ~7 noites) cruzada com o calendário — score DSO por dia.
  const { data: forecast } = api.weather.forecast.useQuery(undefined, { staleTime: 30 * 60 * 1000 })
  const scoreByDay = useMemo(() => {
    const m = new Map<string, { score: number; label: string }>()
    for (const n of forecast?.nights ?? []) m.set(n.date, { score: n.scoreDso, label: n.labelDso })
    return m
  }, [forecast])

  const gridStart = startOfWeek(startOfMonth(view), { weekStartsOn: 0 })
  const gridEnd   = endOfWeek(endOfMonth(view), { weekStartsOn: 0 })
  const days      = eachDayOfInterval({ start: gridStart, end: gridEnd })

  // Eventos do intervalo visível, agrupados por dia
  const eventsByDay = useMemo(() => {
    const span = differenceInCalendarDays(gridEnd, gridStart) + 1
    const evs = upcomingEvents(gridStart, span)
    const map = new Map<string, AstroEvent[]>()
    for (const e of evs) {
      const arr = map.get(e.date) ?? []
      arr.push(e); map.set(e.date, arr)
    }
    return map
  }, [gridStart.getTime(), gridEnd.getTime()]) // eslint-disable-line react-hooks/exhaustive-deps

  const monthEvents = useMemo(
    () => upcomingEvents(startOfMonth(view), 31).filter(e => isSameMonth(new Date(e.date + 'T12:00:00'), view)),
    [view],
  )

  const dayKey = (d: Date) => format(d, 'yyyy-MM-dd')
  const selectedEvents = eventsByDay.get(dayKey(selected)) ?? monthEvents.filter(e => e.date === dayKey(selected))

  const planets = useMemo(() => {
    const b = nightBounds(selected, lat, lon)
    return planetVisibility(selected, lat, lon, b)
  }, [selected, lat, lon])

  const selMoon = getMoonPhase(selected)

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-6">
      <div className="page-header">
        <div>
          <h1 className="page-title">Calendário Astronômico</h1>
          <p className="page-subtitle">Eventos do mês e visibilidade dos planetas por noite</p>
        </div>
        <div className="text-xs text-white/50 flex items-center gap-1.5 self-center">
          <MapPin className="w-3.5 h-3.5" /> {lat.toFixed(2)}, {lon.toFixed(2)}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Grade do mês */}
        <div className="lg:col-span-2 card p-4">
          <div className="flex items-center justify-between mb-3">
            <button onClick={() => setView(addMonths(view, -1))} className="btn-ghost p-1.5"><ChevronLeft className="w-4 h-4" /></button>
            <h2 className="text-sm font-semibold text-white capitalize">{format(view, 'MMMM yyyy', { locale: ptBR })}</h2>
            <button onClick={() => setView(addMonths(view, 1))} className="btn-ghost p-1.5"><ChevronRight className="w-4 h-4" /></button>
          </div>

          <div className="grid grid-cols-7 gap-1 text-center mb-1">
            {WEEKDAYS.map(d => <div key={d} className="text-[10px] text-white/30 uppercase tracking-wider py-1">{d}</div>)}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {days.map(d => {
              const inMonth = isSameMonth(d, view)
              const isSel   = isSameDay(d, selected)
              const isToday = isSameDay(d, new Date())
              const moon    = getMoonPhase(d)
              const dark    = inMonth && moon.illumination <= DARK_SKY_MAX
              const sc      = scoreByDay.get(dayKey(d))
              const dots    = (eventsByDay.get(dayKey(d)) ?? []).filter(e => e.type !== 'NEW_MOON' && e.type !== 'FULL_MOON')
              return (
                <button
                  key={d.toISOString()}
                  onClick={() => setSelected(d)}
                  title={sc ? `Céu profundo: ${sc.score} · ${sc.label}` : dark ? 'Noite escura (boa pra céu profundo)' : undefined}
                  className={cn(
                    'relative overflow-hidden aspect-square rounded-lg p-1 flex flex-col items-center justify-between text-xs transition-colors border',
                    isSel ? 'bg-cosmos-500/25 border-cosmos-500/40'
                      : dark ? 'border-transparent bg-aurora-400/[0.06] hover:bg-white/5'
                      : 'border-transparent hover:bg-white/5',
                    !inMonth && 'opacity-30',
                  )}
                >
                  <span className={cn('self-end leading-none', isToday ? 'text-aurora-400 font-bold' : 'text-white/70')}>{format(d, 'd')}</span>
                  <span className="text-sm leading-none" title={`${moon.illumination}% iluminada`}>{moon.emoji}</span>
                  <span className="flex gap-0.5 h-1.5">
                    {dots.slice(0, 3).map((e, i) => <span key={i} className={cn('w-1.5 h-1.5 rounded-full', TYPE_DOT[e.type] ?? 'bg-white/40')} />)}
                  </span>
                  {sc && <span className={cn('absolute bottom-0 left-0 right-0 h-1', scoreColor(sc.score))} />}
                </button>
              )
            })}
          </div>

          {/* Legenda */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-3 text-[10px] text-white/35">
            <span className="flex items-center gap-1.5"><span className="w-3 h-1 rounded bg-aurora-400" /> barra = previsão do céu (DSO, próx. {forecast?.nights?.length ?? 7} noites)</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-aurora-400/[0.12]" /> noite escura (Lua &lt; {DARK_SKY_MAX}%)</span>
          </div>
        </div>

        {/* Painel do dia selecionado */}
        <div className="space-y-4">
          <div className="card p-4">
            <h3 className="text-sm font-semibold text-white">{format(selected, "EEEE, d 'de' MMMM", { locale: ptBR })}</h3>
            <p className="text-xs text-white/55 mt-0.5 flex items-center gap-1.5">
              <span>{selMoon.emoji}</span> {selMoon.label} · {selMoon.illumination}% iluminada
            </p>
            {(() => {
              const sc = scoreByDay.get(dayKey(selected))
              return sc ? (
                <p className="text-xs mt-1.5 flex items-center gap-1.5 flex-wrap">
                  <span className={cn('inline-block w-2 h-2 rounded-full shrink-0', scoreColor(sc.score))} />
                  <span className="text-white/55">Céu profundo: <span className="text-white font-medium">{sc.score}</span> · {sc.label}</span>
                  <Link href="/dashboard/weather" className="text-aurora-400 hover:underline">previsão →</Link>
                </p>
              ) : null
            })()}

            {selectedEvents.length > 0 && (
              <div className="mt-3 space-y-1.5">
                {selectedEvents.map((e, i) => {
                  const Icon = TYPE_ICON[e.type] ?? Sparkles
                  return (
                    <div key={i} className="flex items-start gap-2 text-xs">
                      <Icon className="w-3.5 h-3.5 text-cosmos-300 shrink-0 mt-0.5" />
                      <div>
                        <span className="text-white/80">{e.name}</span>
                        {e.note && <span className="text-white/30"> — {e.note}</span>}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Visibilidade dos planetas */}
          <div className="card p-4">
            <h3 className="text-sm font-semibold text-white mb-2 flex items-center gap-2"><Orbit className="w-4 h-4 text-nebula-400" /> Planetas nesta noite</h3>
            <div className="space-y-1.5">
              {planets.map(pl => (
                <div key={pl.name} className="flex items-center justify-between text-xs">
                  <span className={cn(pl.visible ? 'text-white/80' : 'text-white/30')}>{pl.name}</span>
                  {pl.visible && pl.from && pl.to ? (
                    <span className="text-white/50 mono">
                      {format(pl.from, 'HH:mm')}–{format(pl.to, 'HH:mm')} · {pl.maxAlt}°
                    </span>
                  ) : (
                    <span className="text-white/25">não visível</span>
                  )}
                </div>
              ))}
            </div>
            <p className="text-[10px] text-white/25 mt-2">Janela acima de 10° entre o pôr e o nascer do Sol.</p>
          </div>
        </div>
      </div>

      {/* Eventos do mês */}
      {monthEvents.length > 0 && (
        <div className="card p-5">
          <h2 className="text-sm font-semibold text-white mb-3 capitalize">Eventos de {format(view, 'MMMM', { locale: ptBR })}</h2>
          <div className="space-y-1.5">
            {monthEvents.map((e, i) => {
              const Icon = TYPE_ICON[e.type] ?? Sparkles
              return (
                <button key={i} onClick={() => setSelected(new Date(e.date + 'T12:00:00'))}
                  className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-white/5 text-left">
                  <span className="text-xs text-white/55 mono w-12 shrink-0">{format(new Date(e.date + 'T12:00:00'), 'dd/MM')}</span>
                  <Icon className="w-3.5 h-3.5 text-cosmos-300 shrink-0" />
                  <span className="text-sm text-white/80 flex-1 truncate">{e.name}</span>
                  {e.note && <span className="text-[11px] text-white/30 truncate hidden sm:block">{e.note}</span>}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
