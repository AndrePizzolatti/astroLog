'use client'

import { useState } from 'react'
import Link from 'next/link'
import { CloudSun, Cloud, CloudRain, Wind, Eye, MapPin, ChevronDown, ChevronUp, Settings, LocateFixed, X, Telescope } from 'lucide-react'
import { api } from '@/lib/trpc'
import { CitySearch } from '@/components/ui/city-search'
import { cn } from '@/lib/utils'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'

// Modo de score: céu profundo (penaliza a Lua) vs planetária (prioriza seeing).
// hiRes = DSO de alta resolução, onde o seeing também conta.
type Mode = 'dso' | 'planetary'
const activeScore = (n: any, mode: Mode, hiRes: boolean) =>
  mode === 'planetary' ? n.scorePlanetary : hiRes ? n.scoreDsoHiRes : n.scoreDso
const activeLabel = (n: any, mode: Mode, hiRes: boolean) =>
  mode === 'planetary' ? n.labelPlanetary : hiRes ? n.labelDsoHiRes : n.labelDso

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
            <div className="flex-1 bg-white/5 rounded-sm h-1.5 min-w-0">
              <div
                className={cn('h-1.5 rounded-sm transition-all', cloudBarColor(h.cloud))}
                style={{ width: `${h.cloud}%` }}
              />
            </div>
            <span className="w-8 text-right text-white/55 mono shrink-0">{h.cloud}%</span>
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

function NightCard({ night, mode, hiRes }: { night: any; mode: Mode; hiRes: boolean }) {
  const [expanded, setExpanded] = useState(false)
  const score = activeScore(night, mode, hiRes)
  const label = activeLabel(night, mode, hiRes)
  const showSeeing = mode === 'planetary' || (mode === 'dso' && hiRes)

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
          <p className="text-2xl font-bold mono text-white">{score}</p>
          <ScoreBadge score={score} label={label} />
        </div>
      </div>

      <ScoreBar score={score} />

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

      {/* Linha(s) contextual(is): Lua (DSO) e/ou seeing (planetária / DSO alta-res) */}
      {mode === 'dso' && (
        <div className="flex items-center justify-center gap-1.5 text-[11px] pt-0.5" title={night.moonLabel}>
          <span className="text-sm leading-none">{night.moonEmoji}</span>
          <span className="mono text-white/60">{night.moonIllumPct}%</span>
          <span className="text-white/40">
            {night.moonUpPct > 0 ? `lua ${night.moonUpPct}% da noite no céu` : 'lua abaixo do horizonte'}
          </span>
        </div>
      )}
      {showSeeing && (
        <div className="flex items-center justify-center gap-1.5 text-[11px] pt-0.5"
          title={`Seeing estimado (não é medição)${night.transparencyLabel ? ` · transparência ${night.transparencyLabel}` : ''}`}>
          <Telescope className="w-3 h-3 text-white/40" />
          <span className="text-white/40">seeing {night.seeingLabel.toLowerCase()}</span>
          <span className="mono text-white/55">{night.seeingDetail}</span>
        </div>
      )}

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

  // Override de localização — temporário, não salvo no perfil
  const [override, setOverride] = useState<{ lat: number; lon: number; name: string } | null>(null)
  const [gpsLoading, setGpsLoading] = useState(false)
  const [showSearch, setShowSearch] = useState(false)
  const [mode, setMode] = useState<Mode>('dso')
  const [hiRes, setHiRes] = useState(false)

  const queryInput = override ? { latitude: override.lat, longitude: override.lon } : undefined
  const { data, isLoading, error } = api.weather.forecast.useQuery(queryInput)

  const hasProfileLocation = !!(profile?.latitude && profile?.longitude)

  function handleGPS() {
    if (!navigator.geolocation) return
    setGpsLoading(true)
    navigator.geolocation.getCurrentPosition(
      pos => {
        setOverride({
          lat:  pos.coords.latitude,
          lon:  pos.coords.longitude,
          name: 'Localização atual',
        })
        setGpsLoading(false)
        setShowSearch(false)
      },
      () => setGpsLoading(false),
      { timeout: 8000 },
    )
  }

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
        <Link href="/dashboard/settings" className="btn-ghost flex items-center gap-1.5 text-xs">
          <Settings className="w-3.5 h-3.5" /> Configurações
        </Link>
      </div>

      {/* Barra de localização */}
      <div className="card p-3 mb-6 space-y-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2 text-xs">
            <MapPin className="w-3.5 h-3.5 text-white/30 shrink-0" />
            {override ? (
              <span className="text-white/70 font-medium">{override.name}</span>
            ) : hasProfileLocation ? (
              <span className="text-white/50 mono">
                {profile!.latitude!.toFixed(4)}°, {profile!.longitude!.toFixed(4)}°
                <span className="text-white/25 ml-1.5">· perfil salvo</span>
              </span>
            ) : (
              <span className="text-amber-400/80">Sem localização — usando padrão (costa catarinense)</span>
            )}
            {data && (
              <span className="text-white/20 mono ml-1">
                ({data.latitude.toFixed(2)}°, {data.longitude.toFixed(2)}°)
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {override && (
              <button
                onClick={() => setOverride(null)}
                className="flex items-center gap-1 text-xs text-white/30 hover:text-white/60 transition-colors"
              >
                <X className="w-3 h-3" /> Usar perfil
              </button>
            )}
            <button
              onClick={handleGPS}
              disabled={gpsLoading}
              className="flex items-center gap-1.5 text-xs text-white/55 hover:text-aurora-400 transition-colors disabled:opacity-40"
            >
              <LocateFixed className="w-3.5 h-3.5" />
              {gpsLoading ? 'Obtendo…' : 'GPS'}
            </button>
            <button
              onClick={() => setShowSearch(v => !v)}
              className={cn(
                'flex items-center gap-1.5 text-xs transition-colors',
                showSearch ? 'text-aurora-400' : 'text-white/55 hover:text-white/70',
              )}
            >
              <MapPin className="w-3.5 h-3.5" />
              Buscar cidade
            </button>
          </div>
        </div>

        {showSearch && (
          <div>
            <CitySearch
              placeholder="Ex: Fraiburgo, Chapecó, Florianópolis…"
              onSelect={r => {
                setOverride({ lat: r.latitude, lon: r.longitude, name: r.name })
                setShowSearch(false)
              }}
            />
          </div>
        )}
      </div>

      {/* Nudge de configuração — só aparece sem override e sem localização salva */}
      {!override && !hasProfileLocation && (
        <div className="card p-4 mb-6 flex items-center justify-between gap-4 border-amber-500/20 bg-amber-500/5">
          <div className="flex items-center gap-3">
            <MapPin className="w-4 h-4 text-amber-400 shrink-0" />
            <p className="text-sm text-white/70">
              Salve sua localização nas configurações para previsões permanentes.
            </p>
          </div>
          <Link href="/dashboard/settings" className="btn-secondary text-xs shrink-0">
            Configurar
          </Link>
        </div>
      )}

      {/* Modo de score: céu profundo vs planetária */}
      <div className="flex items-center gap-3 mb-6 flex-wrap">
        <div className="flex items-center gap-1 bg-white/5 p-0.5 rounded-lg">
          {([['dso', 'Céu profundo'], ['planetary', 'Planetária']] as const).map(([m, label]) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={cn(
                'px-3 py-1 rounded-md text-xs font-medium transition-colors',
                mode === m ? 'bg-cosmos-500 text-white' : 'text-white/55 hover:text-white/70',
              )}
            >{label}</button>
          ))}
        </div>
        {mode === 'dso' && (
          <label className="flex items-center gap-1.5 text-[11px] text-white/55 cursor-pointer select-none">
            <input type="checkbox" checked={hiRes} onChange={e => setHiRes(e.target.checked)} className="accent-cosmos-500" />
            Alta resolução (penaliza seeing)
          </label>
        )}
        <p className="text-[11px] text-white/40">
          {mode === 'dso'
            ? (hiRes
                ? 'Alta resolução: o seeing também conta (galáxia pequena, foco longo).'
                : 'Penaliza a Lua; o seeing só conta em alta resolução.')
            : 'Prioriza o seeing (jet stream); a Lua não importa pra alvos brilhantes.'}
        </p>
      </div>

      {/* Best night highlight */}
      {data?.nights && data.nights.length > 0 && (() => {
        const best = [...data.nights].sort((a, b) => activeScore(b, mode, hiRes) - activeScore(a, mode, hiRes))[0]
        return (
          <div className="card p-5 mb-6 flex items-center justify-between">
            <div>
              <p className="text-xs text-white/55 uppercase tracking-wider mb-1">
                Melhor noite · {mode === 'dso' ? (hiRes ? 'céu profundo (alta-res)' : 'céu profundo') : 'planetária'}
              </p>
              <p className="text-lg font-semibold text-white capitalize">
                {format(new Date(best.date + 'T12:00:00'), "EEEE, d 'de' MMM", { locale: ptBR })}
              </p>
              <p className="text-xs text-white/55 mt-0.5">
                Nuvens {best.cloudCoverAvg.toFixed(0)}% · Vento {best.windAvg.toFixed(0)} km/h · Chuva {best.precipRisk.toFixed(0)}%
                {mode === 'dso' && ` · Lua ${best.moonEmoji} ${best.moonIllumPct}%`}
                {(mode === 'planetary' || (mode === 'dso' && hiRes)) && ` · Seeing ${best.seeingLabel} (${best.seeingDetail})`}
              </p>
            </div>
            <div className="text-right">
              <p className="text-3xl font-bold mono text-white">{activeScore(best, mode, hiRes)}</p>
              <ScoreBadge score={activeScore(best, mode, hiRes)} label={activeLabel(best, mode, hiRes)} />
            </div>
          </div>
        )
      })()}

      {/* 7-night grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {data?.nights.map(night => (
          <NightCard key={night.date} night={night} mode={mode} hiRes={hiRes} />
        ))}
      </div>

      <p className="text-xs text-white/20 mt-6 text-center max-w-2xl mx-auto">
        Dados: Open-Meteo + 7Timer + efeméride · <strong className="text-white/30">Céu profundo</strong>: nuvem + vento + chuva + Lua ·
        <strong className="text-white/30"> Planetária</strong>: troca a Lua pelo seeing.
        Seeing/transparência vêm do <strong className="text-white/30">7Timer</strong> (jet stream como reserva) — é
        <strong className="text-white/30"> estimativa</strong>, não medição; a real vem das suas capturas (FWHM no SharpCap/AutoStakkert).
      </p>
    </div>
  )
}
