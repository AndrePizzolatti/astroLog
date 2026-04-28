'use client'

import { Clock, Camera, Star, Eye, Gauge } from 'lucide-react'
import { cn, formatIntegration, filterPillClass } from '@/lib/utils'
import { api } from '@/lib/trpc'

interface Props {
  projectId: string
}

export function TechSheet({ projectId }: Props) {
  const { data, isLoading } = api.projects.techSheet.useQuery({ id: projectId })

  if (isLoading) return <div className="card p-6 animate-pulse h-48" />
  if (!data) return null

  const { project, stats } = data

  return (
    <div className="card p-5 space-y-4">
      <h3 className="text-xs font-medium text-white/40 uppercase tracking-wider">Ficha Técnica</h3>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatBox icon={Camera} label="Total lights" value={String(stats.totalLights)} />
        <StatBox icon={Clock}  label="Integração"   value={formatIntegration(stats.totalIntegrationMin)} />
        <StatBox icon={Star}   label="Sessões"       value={String(stats.sessionCount)} />
        {stats.avgSeeingArcsec && (
          <StatBox icon={Eye} label="Seeing médio" value={`${stats.avgSeeingArcsec}"`} />
        )}
      </div>

      {stats.filtersUsed.length > 0 && (
        <div>
          <p className="text-xs text-white/30 uppercase tracking-wider mb-2">Filtros usados</p>
          <div className="flex flex-wrap gap-1.5">
            {stats.filtersUsed.map(f => (
              <span key={f} className={cn('filter-pill', filterPillClass(f))}>{f}</span>
            ))}
          </div>
        </div>
      )}

      {(stats.avgSqmValue || stats.avgGuidingRms) && (
        <div className="grid grid-cols-2 gap-4 pt-3 border-t border-white/5">
          {stats.avgSqmValue  && <Metric label="SQM médio"    value={String(stats.avgSqmValue)} />}
          {stats.avgGuidingRms && <Metric label="Guiagem RMS"  value={`${stats.avgGuidingRms}"`} />}
        </div>
      )}

      {stats.firstSessionDate && (
        <p className="text-xs text-white/25">
          {new Date(stats.firstSessionDate).toLocaleDateString('pt-BR')}
          {stats.lastSessionDate && stats.firstSessionDate !== stats.lastSessionDate &&
            ` → ${new Date(stats.lastSessionDate).toLocaleDateString('pt-BR')}`}
        </p>
      )}
    </div>
  )
}

function StatBox({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <div className="text-center">
      <Icon className="w-4 h-4 text-cosmos-400 mx-auto mb-1" />
      <p className="text-lg font-bold mono text-white">{value}</p>
      <p className="text-xs text-white/30">{label}</p>
    </div>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-white/30 uppercase tracking-wider mb-0.5">{label}</p>
      <p className="text-sm font-medium mono text-white/70">{value}</p>
    </div>
  )
}
