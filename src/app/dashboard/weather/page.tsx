'use client'

import { useState } from 'react'
import Link from 'next/link'
import { CloudSun, Cloud, CloudRain, Wind, Eye, MapPin, ChevronDown, ChevronUp, Settings } from 'lucide-react'
import { api } from '@/lib/trpc'
import { cn } from '@/lib/utils'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'

// ─────────────────────────────── Sub-components ────

function ScoreBar({ score }: { score: number }) {
  const color =
    score >= 80 ? 'bg-aurora-400' :
    score >= 60 ? 'bg-green-400' :
    score >= 40 ? 'bg-amber-400' :
    score >= 20 ? 'bg-orange-400' : 'bg-red-400'
  return (
    <div className="w-full bg-white/5 rounded-full h-1.5 mt-1">
      <div className={cn('h-1.5 rounded-full transition-all', color)} style={{ width: `${score}%` }} />
    </div>
  )
}

function ScoreBadge({ score, label }: { score: number; label: string }) {
  const cls =
    score >= 80 ? 'bg-aurora-400/20 text-aurora-400 border-aurora-400/30' :
    score >= 60 ? 'bg-green-400/20 text-green-400 border-green-400/30' :
    score >= 40 ? 'bg-amber-400/20 text-amber-400 border-amber-400/30' :
    score >= 20 ? 'bg-orange-400/20 text-orange-400 border-orange-400/30' :
                  'bg-red-400/20 text-red-400 border-red-400/30'
  return <span className={cn('badge border font-semibold', cls)}>{label}</span>
}

function WeatherIcon({ cloud, precip }: { cloud: number; precip: number }) {
  if (precip > 40) return <CloudRain className="w-6 h-6 text-blue-400" />
  if (cloud > 70)  return <Cloud className="w-6 h-6 text-white/30" />
  if (cloud > 40)  return <CloudSun className="w-6 h-6 text-amber-400/70" />
  return <Eye className="w-6 h-6 text-aurora-400" />
}

function cloudBarColor(cloud: number) {
  if (cloud > 70) return 'bg-white/25'
  if (cloud > 40) return 'bg-amber-400/50'
  return 'bg-aurora-400/70'
}

interface HourEntry {
  time: string
  cloud: number
  wind: number
  precip: number
}

function HourlyDetail({ hours }: { hours: HourEntry[] }) {
  return (
    <div className="pt-3 mt-3 border-t border-white/5 space-y-1">
      <p className="text-[10px] text-white/25 uppercase tracking-wider mb-2">Detalhe horário</p>
      {hours.map(h => {
        const hour = new Date(h.time).getHours()
        const label = `${String(hour).padStart(2, '0')}h`
        return (
          <div key={h.time} className="flex items-center gap-2 text-[11px]">
            <span className="w-6 shrink-0 text-white/30 mono">{label}</span>
            {/* cloud cover bar */}
            <div className="flex-1 bg-white/5 rounded-sm h-1.5 min-w-0">
              <div
                className={cn('h-1.5 rounded-sm transition-all', cloudBarColor(h.cloud))}
                style={{ width: `${h.cloud}%` }}
              />
            </div>
            <span className="w-8 text-right text-white/40 mono shrink-0">{h.cloud}%</span>
            <span className="w-10 text-right text-white/25 mono shrink-0">{h.wind.toFixed(0)}km/h</span>
            {h.precip > 10 && (
              <span className="text-blue-400/70 mono shrink-0">{h.precip}%</span>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ─────────────────────────────── Night card ────

function NightCard({ night }: { night: any }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="card p-4 space-y-3">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-white capitalize">
            {format(new Date(night.date + 'T12:00:00'), "EEE, d MMM", { locale: ptBR })}
          </p>
          <p className="text-xs text-white/30">20h → 06h</p>
        </div>
        <WeatherIcon cloud={night.cloudCoverAvg} precip={night.precipRisk} />
      </div>

      <div className="flex items-end justify-between">
        <div>
          <p className="text-2xl font-bold mono text-white">{night.score}</p>
          <ScoreBadge score={night.score} label={night.label} />
        </div>
      </div>

      <ScoreBar score={night.score} />

      <div className="grid grid-cols-3 gap-2 text-xs">
        <div className="text-center">
          <Cloud className="w-3 h-3 text-white/30 mx-auto mb-0.5" />
          <p className="mono text-white/60">{night.cloudCoverAvg.toFixed(0)}%</p>
          <p className="text-white/25">nuvens</p>
        </div>
        <div className="text-center">
          <Wind className="w-3 h-3 text-white/30 mx-auto mb-0.5" />
          <p className="mono text-white/60">{night.windAvg.toFixed(0)}</p>
          <p className="text-white/25">km/h</p>
        </div>
        <div className="text-center">
          <CloudRain className="w-3 h-3 text-white/30 mx-auto mb-0.5" />
          <p className="mono text-white/60">{night.precipRisk.toFixed(0)}%</p>
          <p className="text-white/25">chuva</p>
        </div>
      </div>

      {night.hours?.length > 0 && (
        <>
          <button
            onClick={() => setExpanded(v => !v)}
            className="w-full flex items-center justify-center gap-1 text-[11px] text-white/25 hover:text-white/50 transition-colors pt-1"
          >
            {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            {expanded ? 'Ocultar' : 'Horas'}
          </button>
          {expanded && <HourlyDetail hours={night.hours} />}
        </>
      )}
    </div>
  )
}

// ─────────────────────────────── Page ────

export default function WeatherPage() {
  const { data: profile } = api.user.getProfile.useQuery()
  const { data, isLoading, error } = api.weather.forecast.useQuery()

  const hasLocation = !!(profile?.latitude && profile?.longitude)

  if (isLoading) return (
    <div className="p-8 max-w-4xl mx-auto space-y-4">
      <div className="card h-10 w-48 animate-pulse" />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {[...Array(7)].map((_, i) => <div key={i} className="card h-44 animate-pulse" />)}
      </div>
    </div>
  )

  if (error) return (
    <div className="p-8 text-red-400 text-sm">
      Falha ao carregar previsão: {error.message}
    </div>
  )

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="page-header">
        <div>
          <h1 className="page-title">Previsão do Céu</h1>
          <p className="page-subtitle">Qualidade das próximas 7 noites para astrofotografia</p>
        </div>
        <div className="flex items-center gap-3">
          {data && (
            <div className="flex items-center gap-1.5 text-xs text-white/30">
              <MapPin className="w-3 h-3" />
              <span className="mono">{data.latitude.toFixed(2)}°, {data.longitude.toFixed(2)}°</span>
            </div>
          )}
          <Link href="/dashboard/settings" className="btn-ghost flex items-center gap-1.5 text-xs">
            <Settings className="w-3.5 h-3.5" /> Localização
          </Link>
        </div>
      </div>

      {/* Location nudge */}
      {!hasLocation && (
        <div className="card p-4 mb-6 flex items-center justify-between gap-4 border-amber-500/20 bg-amber-500/5">
          <div className="flex items-center gap-3">
            <MapPin className="w-4 h-4 text-amber-400 shrink-0" />
            <p className="text-sm text-white/70">
              Configure sua localização para obter previsões exatas.
              <span className="text-white/40"> Usando padrão: costa catarinense.</span>
            </p>
          </div>
          <Link href="/dashboard/settings" className="btn-secondary text-xs shrink-0">
            Configurar
          </Link>
        </div>
      )}

      {/* Best night highlight */}
      {data?.nights && data.nights.length > 0 && (() => {
        const best = [...data.nights].sort((a, b) => b.score - a.score)[0]
        return (
          <div className="card p-5 mb-6 flex items-center justify-between">
            <div>
              <p className="text-xs text-white/40 uppercase tracking-wider mb-1">Melhor noite</p>
              <p className="text-lg font-semibold text-white capitalize">
                {format(new Date(best.date + 'T12:00:00'), "EEEE, d 'de' MMM", { locale: ptBR })}
              </p>
              <p className="text-xs text-white/40 mt-0.5">
                Nuvens {best.cloudCoverAvg.toFixed(0)}% · Vento {best.windAvg.toFixed(0)} km/h · Chuva {best.precipRisk.toFixed(0)}%
              </p>
            </div>
            <div className="text-right">
              <p className="text-3xl font-bold mono text-white">{best.score}</p>
              <ScoreBadge score={best.score} label={best.label} />
            </div>
          </div>
        )
      })()}

      {/* 7-night grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {data?.nights.map(night => (
          <NightCard key={night.date} night={night} />
        ))}
      </div>

      <p className="text-xs text-white/20 mt-6 text-center">
        Dados: Open-Meteo · Score penaliza nuvens (70%), vento (20%) e chuva (30%) das horas noturnas
      </p>
    </div>
  )
}
