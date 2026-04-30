'use client'

import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Star, Trash2, Pencil } from 'lucide-react'
import { cn, filterPillClass, formatIntegration } from '@/lib/utils'
import { api } from '@/lib/trpc'
import { useToast } from '@/components/ui/toast'

interface SessionCardProps {
  session: {
    id: string
    projectId: string
    observedAt: Date
    filterUsed: string | null
    lightsCount: number
    exposureSeconds: number | null
    gain: number | null
    offset: number | null
    binning: string | null
    sensorTempC: number | null
    temperatureC: number | null
    humidityPct: number | null
    seeingArcsec: number | null
    sqmValue: number | null
    bortleScale: number | null
    cloudCoverPct: number | null
    guidingRmsArcsec: number | null
    rating: number | null
    notes: string | null
    setup: { name: string } | null
    files: Array<{ id: string; fileType: string; originalName: string }>
  }
  onEdit?: () => void
}

export function SessionCard({ session, onEdit }: SessionCardProps) {
  const { toast } = useToast()
  const utils = api.useUtils()

  const del = api.sessions.delete.useMutation({
    onSuccess: () => {
      utils.sessions.list.invalidate({ projectId: session.projectId })
      utils.projects.byId.invalidate()
      toast('Sessão removida')
    },
    onError: (e) => toast(e.message, 'error'),
  })

  const integrationMin = ((session.lightsCount ?? 0) * (session.exposureSeconds ?? 0)) / 60
  const filesByType = session.files.reduce<Record<string, number>>((acc, f) => {
    acc[f.fileType] = (acc[f.fileType] ?? 0) + 1
    return acc
  }, {})

  return (
    <div className="card p-4 space-y-3">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-white">
            {format(new Date(session.observedAt), "d 'de' MMM yyyy", { locale: ptBR })}
          </p>
          {session.setup && <p className="text-xs text-white/40">{session.setup.name}</p>}
        </div>
        <div className="flex items-center gap-1.5">
          {session.filterUsed && (
            <span className={cn('filter-pill', filterPillClass(session.filterUsed))}>{session.filterUsed}</span>
          )}
          {onEdit && (
            <button onClick={onEdit} className="text-white/20 hover:text-white/60 transition-colors p-1">
              <Pencil className="w-3.5 h-3.5" />
            </button>
          )}
          <button
            onClick={() => { if (confirm('Remover sessão?')) del.mutate({ id: session.id }) }}
            className="text-white/20 hover:text-red-400 transition-colors p-1"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Capture params */}
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs mono text-white/60">
        {session.lightsCount > 0 && (
          <span>{session.lightsCount}× {session.exposureSeconds}s
            {integrationMin > 0 && <span className="text-white/30"> ({formatIntegration(integrationMin)})</span>}
          </span>
        )}
        {session.gain != null && <span>Gain {session.gain}</span>}
        {session.binning && <span>Bin {session.binning}</span>}
        {session.sensorTempC != null && <span>{session.sensorTempC}°C sensor</span>}
      </div>

      {/* Conditions */}
      {(session.seeingArcsec || session.sqmValue || session.bortleScale || session.guidingRmsArcsec) && (
        <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-white/40 pt-2 border-t border-white/5">
          {session.seeingArcsec    && <span>Seeing {session.seeingArcsec}"</span>}
          {session.sqmValue        && <span>SQM {session.sqmValue}</span>}
          {session.bortleScale     && <span>Bortle {session.bortleScale}</span>}
          {session.guidingRmsArcsec && <span>Guiagem {session.guidingRmsArcsec}"</span>}
          {session.temperatureC != null && <span>{session.temperatureC}°C</span>}
          {session.humidityPct != null  && <span>{session.humidityPct}% umidade</span>}
        </div>
      )}

      {/* Files */}
      {Object.keys(filesByType).length > 0 && (
        <div className="flex flex-wrap gap-1.5 pt-2 border-t border-white/5">
          {Object.entries(filesByType).map(([type, count]) => (
            <span key={type} className="badge bg-white/5 text-white/40">{count} {type}</span>
          ))}
        </div>
      )}

      {/* Rating */}
      {session.rating && (
        <div className="flex gap-0.5">
          {[...Array(5)].map((_, i) => (
            <Star key={i} className={cn('w-3 h-3', i < session.rating! ? 'text-star-400 fill-star-400' : 'text-white/10')} />
          ))}
        </div>
      )}

      {session.notes && <p className="text-xs text-white/30 italic">{session.notes}</p>}
    </div>
  )
}
