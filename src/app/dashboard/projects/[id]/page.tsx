'use client'

import { useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, Plus, Telescope, Camera, Clock, Trash2, Pencil } from 'lucide-react'
import { api } from '@/lib/trpc'
import { cn, formatIntegration, PROJECT_STATUS_LABELS, PROJECT_STATUS_COLORS } from '@/lib/utils'
import { SessionCard }  from '@/components/sessions/session-card'
import { SessionForm }  from '@/components/sessions/session-form'
import { TechSheet }    from '@/components/projects/tech-sheet'
import { ProjectForm, type ProjectInitial } from '@/components/projects/project-form'
import { useToast }     from '@/components/ui/toast'

const STATUS_OPTIONS = [
  'PLANNING', 'IN_PROGRESS', 'READY_TO_PROCESS', 'PROCESSING', 'COMPLETED', 'ARCHIVED',
] as const

export default function ProjectDetailPage() {
  const params  = useParams()
  const router  = useRouter()
  const { toast } = useToast()
  const utils   = api.useUtils()
  const id = params.id as string

  const [addSession,      setAddSession]      = useState(false)
  const [editProjectOpen, setEditProjectOpen] = useState(false)
  const [editingSession,  setEditingSession]  = useState<any | null>(null)

  const { data: project, isLoading } = api.projects.byId.useQuery({ id })

  const del = api.projects.delete.useMutation({
    onSuccess: () => { toast('Projeto removido'); router.push('/dashboard') },
    onError: (e) => toast(e.message, 'error'),
  })

  const updateStatus = api.projects.update.useMutation({
    onSuccess: () => utils.projects.byId.invalidate({ id }),
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

  const projectInitial: ProjectInitial = {
    id:           project.id,
    name:         project.name,
    targetObject: project.targetObject,
    targetType:   project.targetType,
    description:  project.description,
    setupId:      project.setupId,
    status:       project.status,
    visibility:   project.visibility,
    raHours:      project.raHours,
    decDegrees:   project.decDegrees,
  }

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <button onClick={() => router.push('/dashboard')} className="btn-ghost flex items-center gap-1.5 text-xs mb-4 -ml-2">
          <ArrowLeft className="w-3.5 h-3.5" /> Projetos
        </button>
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="page-title">{project.name}</h1>
              {/* Inline status selector */}
              <select
                value={project.status}
                onChange={e => updateStatus.mutate({ id, status: e.target.value as any })}
                className={cn(
                  'badge border-0 cursor-pointer bg-transparent appearance-none pr-4',
                  PROJECT_STATUS_COLORS[project.status],
                )}
              >
                {STATUS_OPTIONS.map(s => (
                  <option key={s} value={s} className="bg-cosmos-900 text-white">
                    {PROJECT_STATUS_LABELS[s]}
                  </option>
                ))}
              </select>
            </div>
            <p className="page-subtitle">{project.targetObject}
              {project.targetType && <span className="ml-1">· {project.targetType}</span>}
            </p>
          </div>
          <div className="flex gap-2 shrink-0">
            <button onClick={() => setEditProjectOpen(true)} className="btn-secondary flex items-center gap-1.5">
              <Pencil className="w-3.5 h-3.5" /> Editar
            </button>
            <button
              onClick={() => { if (confirm('Remover projeto e todas as sessões?')) del.mutate({ id }) }}
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
            {sessions.map(s => (
              <SessionCard
                key={s.id}
                session={s as any}
                onEdit={() => setEditingSession(s)}
              />
            ))}
          </div>
        )}
      </div>

      {/* New session form */}
      <SessionForm projectId={id} open={addSession} onOpenChange={setAddSession} />

      {/* Edit session form */}
      <SessionForm
        projectId={id}
        open={!!editingSession}
        onOpenChange={v => { if (!v) setEditingSession(null) }}
        initial={editingSession ?? undefined}
      />

      {/* Edit project form */}
      <ProjectForm
        open={editProjectOpen}
        onOpenChange={setEditProjectOpen}
        initial={projectInitial}
      />
    </div>
  )
}
