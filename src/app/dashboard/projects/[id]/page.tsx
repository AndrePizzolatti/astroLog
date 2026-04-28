'use client'

import { useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, Plus, Telescope, Camera, Clock, Trash2, Edit } from 'lucide-react'
import { api } from '@/lib/trpc'
import { cn, formatIntegration, filterPillClass, PROJECT_STATUS_LABELS, PROJECT_STATUS_COLORS } from '@/lib/utils'
import { SessionCard } from '@/components/sessions/session-card'
import { SessionForm } from '@/components/sessions/session-form'
import { TechSheet }   from '@/components/projects/tech-sheet'
import { useToast }    from '@/components/ui/toast'

export default function ProjectDetailPage() {
  const params  = useParams()
  const router  = useRouter()
  const { toast } = useToast()
  const utils   = api.useUtils()
  const [addSession, setAddSession] = useState(false)
  const id = params.id as string

  const { data: project, isLoading } = api.projects.byId.useQuery({ id })

  const del = api.projects.delete.useMutation({
    onSuccess: () => {
      toast('Projeto removido')
      router.push('/dashboard')
    },
    onError: (e) => toast(e.message, 'error'),
  })

  if (isLoading) return (
    <div className="p-8 max-w-4xl mx-auto space-y-4">
      {[...Array(3)].map((_, i) => <div key={i} className="card h-32 animate-pulse" />)}
    </div>
  )

  if (!project) return (
    <div className="p-8 text-white/40">Projeto não encontrado.</div>
  )

  const sessions = project.imagingSessions ?? []

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <button onClick={() => router.push('/dashboard')} className="btn-ghost flex items-center gap-1.5 text-xs mb-4 -ml-2">
          <ArrowLeft className="w-3.5 h-3.5" /> Projetos
        </button>
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="page-title">{project.name}</h1>
              <span className={cn('badge', PROJECT_STATUS_COLORS[project.status])}>
                {PROJECT_STATUS_LABELS[project.status]}
              </span>
            </div>
            <p className="page-subtitle">{project.targetObject}
              {project.targetType && <span className="ml-1">· {project.targetType}</span>}
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => { if (confirm('Remover projeto?')) del.mutate({ id }) }}
              className="btn-danger flex items-center gap-1.5"
            >
              <Trash2 className="w-3.5 h-3.5" /> Remover
            </button>
          </div>
        </div>
      </div>

      {/* Setup info */}
      {project.setup && (
        <div className="card p-4 flex flex-wrap gap-4">
          <div className="flex items-center gap-2 text-sm text-white/60">
            <Telescope className="w-4 h-4 text-white/30" />
            <span>{project.setup.telescope.name}</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-white/60">
            <Camera className="w-4 h-4 text-white/30" />
            <span>{project.setup.camera.name}</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-white/60">
            <Clock className="w-4 h-4 text-white/30" />
            <span className="mono">{project.totalLights} lights · {formatIntegration(project.totalIntegrationMinutes)}</span>
          </div>
        </div>
      )}

      {project.description && (
        <p className="text-sm text-white/50 leading-relaxed">{project.description}</p>
      )}

      {/* Tech sheet */}
      <TechSheet projectId={id} />

      {/* Sessions */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-white">
            Sessões <span className="text-white/30 font-normal text-sm">({sessions.length})</span>
          </h2>
          <button className="btn-primary flex items-center gap-2 text-xs" onClick={() => setAddSession(true)}>
            <Plus className="w-3.5 h-3.5" /> Nova Sessão
          </button>
        </div>

        {!sessions.length ? (
          <div className="card p-10 flex flex-col items-center text-center gap-3">
            <Clock className="w-8 h-8 text-white/10" />
            <h3 className="font-medium text-white/40">Nenhuma sessão registrada</h3>
            <p className="text-xs text-white/25 max-w-xs">Registre sua primeira noite de captura para este projeto.</p>
            <button className="btn-primary flex items-center gap-2 text-xs mt-2" onClick={() => setAddSession(true)}>
              <Plus className="w-3.5 h-3.5" /> Nova Sessão
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {sessions.map(s => <SessionCard key={s.id} session={s as any} />)}
          </div>
        )}
      </div>

      <SessionForm projectId={id} open={addSession} onOpenChange={setAddSession} />
    </div>
  )
}
