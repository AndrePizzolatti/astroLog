'use client'

import { useState } from 'react'
import { Plus, Search, FolderOpen } from 'lucide-react'
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

export default function DashboardPage() {
  const [statusFilter, setStatusFilter] = useState<string | undefined>(undefined)
  const [search, setSearch]             = useState('')
  const [createOpen, setCreateOpen]     = useState(false)

  const { data: projects, isLoading } = api.projects.list.useQuery(
    statusFilter ? { status: statusFilter as any } : undefined,
  )

  const filtered = projects?.filter(p =>
    !search || p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.targetObject.toLowerCase().includes(search.toLowerCase()),
  )

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

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        {/* Search */}
        <div className="relative flex-1 min-w-48 max-w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/30" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="input pl-8 h-9 text-sm"
            placeholder="Buscar projetos…"
          />
        </div>

        {/* Status pills */}
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
