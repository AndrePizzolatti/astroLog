'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { format } from 'date-fns'
import { LineChart, Line, XAxis, YAxis, ReferenceLine, ResponsiveContainer, Tooltip } from 'recharts'
import { CalendarDays, MapPin, Moon, Search, Loader2, ArrowUp, Clock } from 'lucide-react'
import { api } from '@/lib/trpc'
import { cn } from '@/lib/utils'
import { nightBounds, planTarget, quickMax } from '@/lib/sky'
import { useToast } from '@/components/ui/toast'

const DEFAULT_LAT = -27.6, DEFAULT_LON = -48.5

function todayLocal() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export default function PlannerPage() {
  const { toast } = useToast()
  const { data: profile } = api.user.getProfile.useQuery()
  const { data: projects } = api.projects.list.useQuery()

  const lat = profile?.latitude  ?? DEFAULT_LAT
  const lon = profile?.longitude ?? DEFAULT_LON

  const withCoords = (projects ?? []).filter(p => p.raHours != null && p.decDegrees != null)

  const [date, setDate]       = useState(todayLocal())
  const [targetKey, setKey]   = useState<string>('')   // projectId | '__custom'
  const [customName, setName] = useState('')
  const [custom, setCustom]   = useState<{ raH: number; decDeg: number } | null>(null)

  const resolve = api.catalog.resolve.useMutation()

  const dateObj = useMemo(() => new Date(date + 'T12:00:00'), [date])
  const bounds  = useMemo(() => nightBounds(dateObj, lat, lon), [dateObj, lat, lon])

  // alvo efetivo
  const proj = withCoords.find(p => p.id === targetKey)
  const target = targetKey === '__custom'
    ? (custom ? { raH: custom.raH, decDeg: custom.decDeg, name: customName || 'Alvo' } : null)
    : proj ? { raH: proj.raHours!, decDeg: proj.decDegrees!, name: proj.name } : null

  const plan = useMemo(
    () => target ? planTarget(target.raH, target.decDeg, lat, lon, bounds) : null,
    [target?.raH, target?.decDeg, lat, lon, bounds], // eslint-disable-line react-hooks/exhaustive-deps
  )

  const ranking = useMemo(() =>
    withCoords
      .map(p => ({ p, ...quickMax(p.raHours!, p.decDegrees!, lat, lon, bounds) }))
      .sort((a, b) => b.maxAlt - a.maxAlt),
    [withCoords, lat, lon, bounds], // eslint-disable-line react-hooks/exhaustive-deps
  )

  async function doResolve() {
    if (!customName.trim()) { toast('Digite o alvo', 'error'); return }
    const r = await resolve.mutateAsync({ name: customName.trim() }).catch(() => null)
    if (!r) { toast('Não encontrei esse objeto', 'error'); return }
    setCustom({ raH: r.raHours, decDeg: r.decDegrees })
    toast('Alvo resolvido')
  }

  const chartData = plan?.samples.map(s => ({ t: format(new Date(s.t), 'HH:mm'), alt: Math.max(0, s.alt) })) ?? []

  function verdict() {
    if (!plan) return null
    if (plan.maxAlt < 30) return { txt: 'Mal posicionado essa noite', cls: 'text-red-400' }
    if (plan.moonIllum > 60 && plan.moonSep < 60 && plan.moonAlt > 0)
      return { txt: 'A Lua atrapalha (próxima e iluminada)', cls: 'text-amber-400' }
    if (plan.maxAlt >= 50 && plan.hoursVisible >= 3) return { txt: 'Ótima janela', cls: 'text-aurora-400' }
    return { txt: 'Boa janela', cls: 'text-green-400' }
  }
  const v = verdict()

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-6">
      <div className="page-header">
        <div>
          <h1 className="page-title">Planejador de Sessão</h1>
          <p className="page-subtitle">Altitude na noite, Lua e melhores alvos pra data escolhida</p>
        </div>
      </div>

      {/* Controles */}
      <div className="card p-4 flex flex-wrap items-end gap-4">
        <div>
          <label className="input-label flex items-center gap-1.5"><CalendarDays className="w-3.5 h-3.5" /> Noite de</label>
          <input type="date" value={date} onChange={e => setDate(e.target.value)} className="input h-9 text-sm" />
        </div>
        <div className="flex-1 min-w-52">
          <label className="input-label">Alvo</label>
          <select value={targetKey} onChange={e => setKey(e.target.value)} className="input h-9 text-sm">
            <option value="">Selecionar…</option>
            {withCoords.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            <option value="__custom">Outro (buscar)…</option>
          </select>
        </div>
        {targetKey === '__custom' && (
          <div className="flex items-end gap-2">
            <div>
              <label className="input-label">Nome do objeto</label>
              <input value={customName} onChange={e => setName(e.target.value)} className="input h-9 text-sm" placeholder="M31, NGC 7000…" />
            </div>
            <button onClick={doResolve} disabled={resolve.isPending} className="btn-secondary h-9 flex items-center gap-1.5">
              {resolve.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />} Resolver
            </button>
          </div>
        )}
        <div className="text-xs text-white/35 flex items-center gap-1.5">
          <MapPin className="w-3.5 h-3.5" /> {lat.toFixed(2)}, {lon.toFixed(2)}
        </div>
      </div>

      {!target ? (
        <div className="card p-12 text-center text-sm text-white/40">
          Escolha um alvo {withCoords.length === 0 && '(seus projetos precisam de AR/Dec — preencha no projeto com o botão Resolver)'}.
        </div>
      ) : plan && (
        <>
          {/* Gráfico de altitude */}
          <div className="card p-4">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-sm font-semibold text-white">{target.name} — altitude na noite</h2>
              {v && <span className={cn('text-sm font-medium', v.cls)}>{v.txt}</span>}
            </div>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={chartData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                <XAxis dataKey="t" tick={{ fontSize: 10, fill: 'rgba(255,255,255,0.4)' }} interval={Math.ceil(chartData.length / 8)} />
                <YAxis domain={[0, 90]} ticks={[0, 30, 60, 90]} tick={{ fontSize: 10, fill: 'rgba(255,255,255,0.4)' }} />
                <ReferenceLine y={30} stroke="rgba(245,200,80,0.4)" strokeDasharray="3 3" />
                <Tooltip
                  contentStyle={{ background: '#0f1424', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, fontSize: 12 }}
                  labelStyle={{ color: 'rgba(255,255,255,0.6)' }}
                  formatter={(val: any) => [`${val}°`, 'altitude']}
                />
                <Line type="monotone" dataKey="alt" stroke="#8b9cff" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
            <p className="text-[11px] text-white/25 mt-1">Linha tracejada = 30° (mínimo recomendado). Janela: {format(bounds.sunset, 'HH:mm')} → {format(bounds.sunrise, 'HH:mm')}.</p>
          </div>

          {/* Métricas */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Metric icon={ArrowUp}  label="Altitude máx." value={`${plan.maxAlt}°`} hint={plan.transit ? `trânsito ${format(plan.transit, 'HH:mm')}` : ''} />
            <Metric icon={Clock}    label="Acima de 30°" value={`${plan.hoursVisible} h`} />
            <Metric icon={Moon}     label="Lua iluminada" value={`${plan.moonIllum}%`} hint={plan.moonAlt > 0 ? 'acima do horizonte' : 'abaixo do horizonte'} />
            <Metric icon={Moon}     label="Separação da Lua" value={`${plan.moonSep}°`} hint={plan.moonSep < 40 ? 'perto — cuidado' : 'ok'} />
          </div>
        </>
      )}

      {/* Melhores alvos da noite */}
      {ranking.length > 0 && (
        <div className="card p-5">
          <h2 className="text-sm font-semibold text-white mb-3">Melhores alvos nesta noite</h2>
          <div className="space-y-1.5">
            {ranking.map(({ p, maxAlt, transit, hoursVisible }) => (
              <Link key={p.id} href={`/dashboard/projects/${p.id}`}
                className={cn('flex items-center gap-3 p-2.5 rounded-lg border transition-colors',
                  maxAlt < 30 ? 'bg-white/2 border-white/5 opacity-60' : 'bg-white/3 border-white/8 hover:bg-white/5')}>
                <span className={cn('text-sm font-mono w-12 shrink-0', maxAlt >= 50 ? 'text-aurora-300' : maxAlt >= 30 ? 'text-green-400' : 'text-white/40')}>
                  {Math.round(maxAlt)}°
                </span>
                <span className="text-sm text-white/80 flex-1 truncate">{p.name}</span>
                <span className="text-[11px] text-white/30 mono shrink-0">
                  {transit ? `trânsito ${format(transit, 'HH:mm')}` : ''} · {hoursVisible}h
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function Metric({ icon: Icon, label, value, hint }: { icon: React.ComponentType<any>; label: string; value: string; hint?: string }) {
  return (
    <div className="card p-3">
      <p className="text-[10px] text-white/35 uppercase tracking-wider flex items-center gap-1"><Icon className="w-3 h-3" /> {label}</p>
      <p className="text-lg font-bold mono text-white leading-tight mt-1">{value}</p>
      {hint && <p className="text-[10px] text-white/30">{hint}</p>}
    </div>
  )
}
