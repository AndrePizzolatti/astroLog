'use client'

import { useState } from 'react'
import { Bell, Star, Moon, Sun, Rocket, Telescope, Orbit, Sparkles } from 'lucide-react'
import { api } from '@/lib/trpc'
import { cn } from '@/lib/utils'
import { useToast } from '@/components/ui/toast'

const ALERT_TYPES = [
  { type: 'METEOR_SHOWER',     label: 'Chuva de meteoros',   icon: Sparkles,  color: 'text-star-400' },
  { type: 'ECLIPSE_SOLAR',     label: 'Eclipse solar',       icon: Sun,       color: 'text-amber-400' },
  { type: 'ECLIPSE_LUNAR',     label: 'Eclipse lunar',       icon: Moon,      color: 'text-cosmos-300' },
  { type: 'ISS_PASS',          label: 'Passagem da ISS',     icon: Rocket,    color: 'text-aurora-400' },
  { type: 'PLANET_OPPOSITION', label: 'Oposição planetária', icon: Orbit,     color: 'text-nebula-400' },
  { type: 'COMET',             label: 'Cometa',              icon: Star,      color: 'text-blue-300' },
  { type: 'CONJUNCTION',       label: 'Conjunção',           icon: Telescope, color: 'text-blue-300' },
  { type: 'APOD',              label: 'APOD do dia',         icon: Star,      color: 'text-cosmos-400' },
] as const

const ADVANCE_OPTIONS = [
  { value: 1,   label: '1h antes' },
  { value: 6,   label: '6h antes' },
  { value: 12,  label: '12h antes' },
  { value: 24,  label: '24h antes' },
  { value: 48,  label: '2 dias antes' },
  { value: 168, label: '1 semana antes' },
]

function Toggle({ checked, onChange, disabled }: { checked: boolean; onChange: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={onChange}
      disabled={disabled}
      className={cn(
        'relative inline-flex h-5 w-9 shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none',
        checked ? 'bg-aurora-400' : 'bg-white/10',
        disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer',
      )}
    >
      <span
        className={cn(
          'pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow-lg ring-0 transition-transform duration-200',
          checked ? 'translate-x-4' : 'translate-x-0',
        )}
      />
    </button>
  )
}

export default function AlertsPage() {
  const { toast } = useToast()
  const utils = api.useUtils()
  const [pending, setPending] = useState<string | null>(null)

  const { data: subscriptions, isLoading } = api.alerts.list.useQuery()

  const upsert = api.alerts.upsert.useMutation({
    onSuccess: () => { utils.alerts.list.invalidate(); setPending(null) },
    onError: (e) => { toast(e.message, 'error'); setPending(null) },
  })

  const del = api.alerts.delete.useMutation({
    onSuccess: () => { utils.alerts.list.invalidate(); setPending(null) },
    onError: (e) => { toast(e.message, 'error'); setPending(null) },
  })

  const subMap = new Map(subscriptions?.map(s => [s.eventType, s]))

  function toggleSubscription(type: string, isOn: boolean) {
    setPending(type)
    if (isOn) {
      del.mutate({ eventType: type as any })
    } else {
      upsert.mutate({ eventType: type as any })
    }
  }

  function updateAdvanceHours(type: string, hours: number) {
    upsert.mutate({ eventType: type as any, advanceHours: hours })
  }

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <div className="page-header">
        <div>
          <h1 className="page-title">Alertas Astronômicos</h1>
          <p className="page-subtitle">Notificações por e-mail para eventos do céu</p>
        </div>
      </div>

      <div className="card p-5 divide-y divide-white/5">
        {isLoading ? (
          [...Array(7)].map((_, i) => (
            <div key={i} className="flex items-center justify-between py-3 first:pt-0 last:pb-0">
              <div className="h-4 w-40 bg-white/5 rounded animate-pulse" />
              <div className="h-5 w-9 bg-white/5 rounded-full animate-pulse" />
            </div>
          ))
        ) : (
          ALERT_TYPES.map(({ type, label, icon: Icon, color }) => {
            const sub = subMap.get(type)
            const isOn = !!sub
            const isPending = pending === type

            return (
              <div key={type} className="py-3 first:pt-0 last:pb-0 space-y-2">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <Icon className={cn('w-4 h-4 shrink-0', color)} />
                    <span className="text-sm text-white/70">{label}</span>
                  </div>
                  <Toggle
                    checked={isOn}
                    onChange={() => toggleSubscription(type, isOn)}
                    disabled={isPending}
                  />
                </div>

                {isOn && (
                  <div className="flex items-center gap-2 pl-7">
                    <Bell className="w-3 h-3 text-white/25 shrink-0" />
                    <select
                      value={sub.advanceHours}
                      onChange={e => updateAdvanceHours(type, Number(e.target.value))}
                      className="input h-7 py-0 text-xs w-auto"
                    >
                      {ADVANCE_OPTIONS.map(o => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                    <span className="text-xs text-white/30">por e-mail</span>
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>

      <p className="text-xs text-white/20 mt-4 text-center">
        Envio de e-mail requer configuração de provedor SMTP nas variáveis de ambiente
      </p>
    </div>
  )
}
