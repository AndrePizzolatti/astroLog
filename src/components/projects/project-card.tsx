'use client'

import Link from 'next/link'
import { Camera } from 'lucide-react'
import { cn, formatIntegration, PROJECT_STATUS_LABELS, PROJECT_STATUS_COLORS } from '@/lib/utils'

// Visual scale: 20 h = full bar (typical deep-sky narrowband goal)
const SCALE_HOURS = 20

function integrationBarColor(hours: number) {
  if (hours >= 10) return 'bg-aurora-400'
  if (hours >= 5)  return 'bg-green-400'
  if (hours >= 2)  return 'bg-amber-400'
  return 'bg-white/20'
}

function statusBorderAccent(status: string) {
  if (status === 'IN_PROGRESS') return 'border-aurora-400/25'
  if (status === 'COMPLETED')   return 'border-green-500/20'
  return 'border-white/8'
}

interface ProjectCardProps {
  project: {
    id: string
    name: string
    targetObject: string
    targetType: string | null
    status: string
    totalLights: number
    totalIntegrationMinutes: number
    updatedAt: Date
    setup: { name: string; telescope: { name: string }; camera: { name: string } } | null
    _count: { imagingSessions: number }
  }
}

export function ProjectCard({ project }: ProjectCardProps) {
  const hours      = project.totalIntegrationMinutes / 60
  const barPct     = Math.min((hours / SCALE_HOURS) * 100, 100)
  const barColor   = integrationBarColor(hours)
  const borderCls  = statusBorderAccent(project.status)

  return (
    <Link
      href={`/dashboard/projects/${project.id}`}
      className={cn('card-hover block p-5 space-y-3 border', borderCls)}
    >
      <div className="flex items-start justify-between">
        <div className="min-w-0">
          <h3 className="font-semibold text-white truncate">{project.name}</h3>
          <p className="text-xs text-white/40 mt-0.5">{project.targetObject}
            {project.targetType && <span className="ml-1 text-white/25">· {project.targetType}</span>}
          </p>
        </div>
        <span className={cn('badge shrink-0 ml-3', PROJECT_STATUS_COLORS[project.status])}>
          {PROJECT_STATUS_LABELS[project.status]}
        </span>
      </div>

      {project.setup && (
        <div className="flex items-center gap-1.5 text-xs text-white/40">
          <Camera className="w-3 h-3" />
          <span>{project.setup.name}</span>
        </div>
      )}

      {/* Integration progress */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-xs">
          <span className="text-white/25 uppercase tracking-wider">Integração</span>
          <span className={cn('mono font-semibold', hours >= 10 ? 'text-aurora-400' : hours >= 5 ? 'text-green-400' : hours >= 2 ? 'text-amber-400' : 'text-white/50')}>
            {formatIntegration(project.totalIntegrationMinutes)}
          </span>
        </div>
        <div className="w-full bg-white/5 rounded-full h-1">
          <div
            className={cn('h-1 rounded-full transition-all duration-500', barColor)}
            style={{ width: `${barPct}%` }}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 pt-1 border-t border-white/5">
        <div>
          <p className="text-xs text-white/25 uppercase tracking-wider">Lights</p>
          <p className="text-sm font-medium mono text-white/70">{project.totalLights.toLocaleString('pt-BR')}</p>
        </div>
        <div>
          <p className="text-xs text-white/25 uppercase tracking-wider">Sessões</p>
          <p className="text-sm font-medium mono text-white/70">{project._count.imagingSessions}</p>
        </div>
      </div>
    </Link>
  )
}
