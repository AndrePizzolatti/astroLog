'use client'

import { useState } from 'react'
import { Plus, Search, FolderOpen, Layers, Camera, Clock, CalendarDays, Eye, Cloud, CloudRain } from 'lucide-react'
import { api } from '@/lib/trpc'
import { ProjectCard }  from '@/components/projects/project-card'
import { ProjectForm }  from '@/components/projects/project-form'
import { cn } from '@/lib/utils'

const STATUS_FILTERS = [
  { value: undefined,          label: 'Todos' },
  { value: 'IN_PROGRESS',      label: 'Em andamento' },
  { value: 'PLANNING',         label: 'Planejamento' },
  { value: 'READY_TO_PROCESS', label: 'Pronto p/ proc.' },
  { value: 'COMPLETED',        label: 'Concluídos' },
  { value: 'ARCHIVED',         label: 'Arquivados' },
] as const

function nightScoreColor(score: number) {
  if (score >= 80) return 'text-aurora-400'
  if (score >= 60) return 'text-green-400'
  if (score >= 40) return 'text-amber-400'
  if (score >= 20) return 'text-orange-400'
  return 'text-red-400'
}

function nightScoreBg(score: number) {
  if (score >= 80) return 'bg-aurora-400/10 border-aurora-400/20'
  if (score >= 60) return 'bg-green-400/10 border-green-400/20'
  if (score >= 40) return 'bg-amber-400/10 border-amber-400/20'
  if (score >= 20) return 'bg-orange-400/10 border-orange-400/20'
  return 'bg-red-400/10 border-red-400/20'
}

function formatHours(h: number) {
  if (h < 1) return `${Math.round(h * 60)}m`
  return `${h.toFixed(1)}h`
}

export default function DashboardPage() {
  const [statusFilter, setStatusFilter] = useState<string | undefined>(undefined)
  const [search, setSearch]             = useState('')
  const [createOpen, setCreateOpen]     = useState(false)

  const { data: projects, isLoading } = api.projects.list.useQuery(
    statusFilter ? { status: statusFilter as any } : undefined,
  )
  const { data: weather } = api.weather.forecast.useQuery()

  // Stats computed from projects list (all projects, not filtered)
  const allProjects = projects ?? []
  const totalSessions   = allProjects.reduce((s, p) => s + p._count.imagingSessions, 0)
  const totalLights     = allProjects.reduce((s, p) => s + p.totalLights, 0)
  const totalHours      = allProjects.reduce((s, p) => s + p.totalIntegrationMinutes, 0) / 60

  const filtered = projects?.filter(p =>
    !search || p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.targetObject.toLowerCase().includes(search.toLowerCase()),
  )

  const upcomingNights = weather?.nights.slice(0, 3) ?? []

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="page-header">
        <div>
          <h1 className="page-title">Meus Projetos</h1>
          <p className="page-subtitle">Gerencie seus projetos de astrofotografia</p>
        </div>
        <button className="btn-primary flex items-center gap-2" onClick={() => setCreateOpen(true)}>
          <Plus className="w-4 h-4" /> Novo Projeto
        </button>
      </div>

      {/* Stats strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <div className="card p-3 flex items-center gap-3">
          <Layers className="w-4 h-4 text-cosmos-400 shrink-0" />
          <div>
            <p className="text-lg font-bold mono text-white leading-none">{allProjects.length}</p>
            <p className="text-xs text-white/40 mt-0.5">projetos</p>
          </div>
        </div>
        <div className="card p-3 flex items-center gap-3">
          <CalendarDays className="w-4 h-4 text-nebula-400 shrink-0" />
          <div>
            <p className="text-lg font-bold mono text-white leading-none">{totalSessions}</p>
            <p className="text-xs text-white/40 mt-0.5">sessões</p>
          </div>
        </div>
        <div className="card p-3 flex items-center gap-3">
          <Camera className="w-4 h-4 text-aurora-400 shrink-0" />
          <div>
            <p className="text-lg font-bold mono text-white leading-none">{totalLights.toLocaleString('pt-BR')}</p>
            <p className="text-xs text-white/40 mt-0.5">frames</p>
          </div>
        </div>
        <div className="card p-3 flex items-center gap-3">
          <Clock className="w-4 h-4 text-star-400 shrink-0" />
          <div>
            <p className="text-lg font-bold mono text-white leading-none">{formatHours(totalHours)}</p>
            <p className="text-xs text-white/40 mt-0.5">integração</p>
          </div>
        </div>
      </div>

      {/* Mini weather strip */}
      {upcomingNights.length > 0 && (
        <div className="card p-3 mb-6 flex items-center gap-4 overflow-x-auto">
          <p className="text-xs text-white/30 uppercase tracking-wider shrink-0">Próximas noites</p>
          <div className="flex gap-2 flex-1">
            {upcomingNights.map(night => (
              <div
                key={night.date}
                className={cn(
                  'flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs shrink-0',
                  nightScoreBg(night.score),
                )}
              >
                {night.cloudCoverAvg < 40 ? (
                  <Eye className="w-3 h-3 text-aurora-400 shrink-0" />
                ) : night.precipRisk > 40 ? (
                  <CloudRain className="w-3 h-3 text-blue-400 shrink-0" />
                ) : (
                  <Cloud className="w-3 h-3 text-white/30 shrink-0" />
                )}
                <span className={cn('font-bold mono', nightScoreColor(night.score))}>{night.score}</span>
                <span className="text-white/30">{night.label}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <div className="relative flex-1 min-w-48 max-w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/30" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="input pl-8 h-9 text-sm"
            placeholder="Buscar projetos…"
          />
        </div>

        <div className="flex flex-wrap gap-1.5">
          {STATUS_FILTERS.map(f => (
            <button
              key={String(f.value)}
              onClick={() => setStatusFilter(f.value)}
              className={cn(
                'px-3 py-1 rounded-full text-xs font-medium transition-colors duration-150',
                statusFilter === f.value
                  ? 'bg-cosmos-500 text-white'
                  : 'bg-white/5 text-white/50 hover:bg-white/10 hover:text-white/70',
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => <div key={i} className="card h-44 animate-pulse" />)}
        </div>
      ) : !filtered?.length ? (
        <div className="card p-16 flex flex-col items-center justify-center text-center gap-3">
          <FolderOpen className="w-12 h-12 text-white/10" />
          <h3 className="font-medium text-white/50">
            {search ? 'Nenhum projeto encontrado' : 'Nenhum projeto criado'}
          </h3>
          <p className="text-sm text-white/30 max-w-xs">
            {search
              ? 'Tente outros termos de busca.'
              : 'Crie seu primeiro projeto para começar a registrar sessões de astrofotografia.'}
          </p>
          {!search && (
            <button className="btn-primary flex items-center gap-2 mt-2" onClick={() => setCreateOpen(true)}>
              <Plus className="w-4 h-4" /> Novo Projeto
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(p => <ProjectCard key={p.id} project={p as any} />)}
        </div>
      )}

      <ProjectForm open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  )
}
