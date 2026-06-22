'use client'

import { useMemo, useState } from 'react'
import {
  startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval,
  addMonths, format, isSameMonth, isSameDay, differenceInCalendarDays,
} from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { ChevronLeft, ChevronRight, MapPin, Sparkles, Sun, Moon, Orbit } from 'lucide-react'
import { api } from '@/lib/trpc'
import { cn } from '@/lib/utils'
import { getMoonPhase } from '@/lib/moon'
import { upcomingEvents, type AstroEvent } from '@/lib/astro-events'
import { nightBounds, planetVisibility } from '@/lib/sky'

const DEFAULT_LAT = -27.6, DEFAULT_LON = -48.5
const WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

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
        <div className="text-xs text-white/35 flex items-center gap-1.5 self-center">
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
              const dots    = (eventsByDay.get(dayKey(d)) ?? []).filter(e => e.type !== 'NEW_MOON' && e.type !== 'FULL_MOON')
              return (
                <button
                  key={d.toISOString()}
                  onClick={() => setSelected(d)}
                  className={cn(
                    'aspect-square rounded-lg p-1 flex flex-col items-center justify-between text-xs transition-colors border',
                    isSel ? 'bg-cosmos-500/25 border-cosmos-500/40'
                      : 'border-transparent hover:bg-white/5',
                    !inMonth && 'opacity-30',
                  )}
                >
                  <span className={cn('self-end leading-none', isToday ? 'text-aurora-400 font-bold' : 'text-white/70')}>{format(d, 'd')}</span>
                  <span className="text-sm leading-none" title={`${moon.illumination}% iluminada`}>{moon.emoji}</span>
                  <span className="flex gap-0.5 h-1.5">
                    {dots.slice(0, 3).map((e, i) => <span key={i} className={cn('w-1.5 h-1.5 rounded-full', TYPE_DOT[e.type] ?? 'bg-white/40')} />)}
                  </span>
                </button>
              )
            })}
          </div>
        </div>

        {/* Painel do dia selecionado */}
        <div className="space-y-4">
          <div className="card p-4">
            <h3 className="text-sm font-semibold text-white">{format(selected, "EEEE, d 'de' MMMM", { locale: ptBR })}</h3>
            <p className="text-xs text-white/40 mt-0.5 flex items-center gap-1.5">
              <span>{selMoon.emoji}</span> {selMoon.label} · {selMoon.illumination}% iluminada
            </p>

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
                  <span className="text-xs text-white/40 mono w-12 shrink-0">{format(new Date(e.date + 'T12:00:00'), 'dd/MM')}</span>
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
