'use client'

import Link from 'next/link'
import { Clock, Camera, Star } from 'lucide-react'
import { cn, formatDate, formatIntegration, PROJECT_STATUS_LABELS, PROJECT_STATUS_COLORS } from '@/lib/utils'

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
  return (
    <Link href={`/dashboard/projects/${project.id}`} className="card-hover block p-5 space-y-3">
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

      <div className="grid grid-cols-3 gap-2 pt-2 border-t border-white/5">
        <div>
          <p className="text-xs text-white/25 uppercase tracking-wider">Lights</p>
          <p className="text-sm font-medium mono text-white/70">{project.totalLights}</p>
        </div>
        <div>
          <p className="text-xs text-white/25 uppercase tracking-wider">Integração</p>
          <p className="text-sm font-medium mono text-white/70">{formatIntegration(project.totalIntegrationMinutes)}</p>
        </div>
        <div>
          <p className="text-xs text-white/25 uppercase tracking-wider">Sessões</p>
          <p className="text-sm font-medium mono text-white/70">{project._count.imagingSessions}</p>
        </div>
      </div>

      <p className="text-xs text-white/20">{formatDate(project.updatedAt)}</p>
    </Link>
  )
}
