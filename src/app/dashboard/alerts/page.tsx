'use client'

import { Bell, Star, Moon, Sun, Rocket } from 'lucide-react'

const ALERT_TYPES = [
  { type: 'METEOR_SHOWER',    label: 'Chuva de meteoros',   icon: Star,   color: 'text-star-400' },
  { type: 'ECLIPSE_SOLAR',    label: 'Eclipse solar',       icon: Sun,    color: 'text-amber-400' },
  { type: 'ECLIPSE_LUNAR',    label: 'Eclipse lunar',       icon: Moon,   color: 'text-cosmos-300' },
  { type: 'ISS_PASS',         label: 'Passagem da ISS',     icon: Rocket, color: 'text-aurora-400' },
  { type: 'PLANET_OPPOSITION',label: 'Oposição planetária', icon: Star,   color: 'text-nebula-400' },
  { type: 'CONJUNCTION',      label: 'Conjunção',           icon: Star,   color: 'text-blue-300' },
  { type: 'APOD',             label: 'APOD do dia',         icon: Star,   color: 'text-cosmos-400' },
]

export default function AlertsPage() {
  return (
    <div className="p-8 max-w-3xl mx-auto">
      <div className="page-header">
        <div>
          <h1 className="page-title">Alertas Astronômicos</h1>
          <p className="page-subtitle">Configure notificações para eventos do céu</p>
        </div>
      </div>

      <div className="card p-5 space-y-1 divide-y divide-white/5">
        {ALERT_TYPES.map(({ type, label, icon: Icon, color }) => (
          <div key={type} className="flex items-center justify-between py-3 first:pt-0 last:pb-0">
            <div className="flex items-center gap-3">
              <Icon className={`w-4 h-4 ${color}`} />
              <span className="text-sm text-white/70">{label}</span>
            </div>
            <div className="flex items-center gap-2 text-xs text-white/30">
              <Bell className="w-3 h-3" />
              <span>Em breve</span>
            </div>
          </div>
        ))}
      </div>

      <p className="text-xs text-white/20 mt-4 text-center">
        Alertas via e-mail serão implementados na próxima versão
      </p>
    </div>
  )
}
