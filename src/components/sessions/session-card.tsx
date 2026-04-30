'use client'

import { useRef, useState } from 'react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Star, Trash2, Pencil, Upload, X, Plus, Loader2 } from 'lucide-react'
import { cn, filterPillClass, formatIntegration } from '@/lib/utils'
import { api } from '@/lib/trpc'
import { useToast } from '@/components/ui/toast'

const FILE_TYPES = ['LIGHT', 'DARK', 'FLAT', 'BIAS', 'MASTER_DARK', 'MASTER_FLAT', 'MASTER_BIAS'] as const

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
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [uploadOpen, setUploadOpen]   = useState(false)
  const [uploadType, setUploadType]   = useState<string>('LIGHT')
  const [uploading, setUploading]     = useState(false)
  const [deletingType, setDeletingType] = useState<string | null>(null)

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

  async function handleUpload(files: FileList) {
    setUploading(true)
    try {
      for (const file of Array.from(files)) {
        const fd = new FormData()
        fd.append('file',      file)
        fd.append('sessionId', session.id)
        fd.append('projectId', session.projectId)
        fd.append('fileType',  uploadType)
        const res = await fetch('/api/upload/session-file', { method: 'POST', body: fd })
        if (!res.ok) {
          const { error } = await res.json().catch(() => ({}))
          toast(error ?? 'Erro ao enviar arquivo', 'error')
          return
        }
      }
      utils.projects.byId.invalidate()
      setUploadOpen(false)
    } catch {
      toast('Erro ao enviar arquivo', 'error')
    } finally {
      setUploading(false)
    }
  }

  async function handleDeleteType(fileType: string) {
    setDeletingType(fileType)
    try {
      const res = await fetch('/api/upload/session-file', {
        method:  'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ sessionId: session.id, fileType }),
      })
      if (!res.ok) {
        const { error } = await res.json().catch(() => ({}))
        toast(error ?? 'Erro ao remover', 'error')
        return
      }
      utils.projects.byId.invalidate()
    } finally {
      setDeletingType(null)
    }
  }

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
        {session.gain      != null && <span>Gain {session.gain}</span>}
        {session.binning              && <span>Bin {session.binning}</span>}
        {session.sensorTempC != null && <span>{session.sensorTempC}°C sensor</span>}
      </div>

      {/* Conditions */}
      {(session.seeingArcsec || session.sqmValue || session.bortleScale || session.guidingRmsArcsec) && (
        <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-white/40 pt-2 border-t border-white/5">
          {session.seeingArcsec     && <span>Seeing {session.seeingArcsec}"</span>}
          {session.sqmValue         && <span>SQM {session.sqmValue}</span>}
          {session.bortleScale      && <span>Bortle {session.bortleScale}</span>}
          {session.guidingRmsArcsec && <span>Guiagem {session.guidingRmsArcsec}"</span>}
          {session.temperatureC != null && <span>{session.temperatureC}°C</span>}
          {session.humidityPct  != null && <span>{session.humidityPct}% umidade</span>}
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

      {/* Files section */}
      <div className="pt-2 border-t border-white/5 space-y-2">
        {/* Grouped file badges */}
        {Object.keys(filesByType).length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {Object.entries(filesByType).map(([type, count]) => (
              <div key={type} className="flex items-center gap-1 badge bg-white/5 text-white/40 pr-1">
                <span className="mono">{count} {type}</span>
                <button
                  onClick={() => handleDeleteType(type)}
                  disabled={deletingType === type}
                  className="text-white/20 hover:text-red-400 transition-colors disabled:opacity-40"
                  title={`Remover todos ${type}`}
                >
                  {deletingType === type
                    ? <Loader2 className="w-2.5 h-2.5 animate-spin" />
                    : <X className="w-2.5 h-2.5" />}
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Upload form */}
        {uploadOpen ? (
          <div className="flex items-center gap-2 flex-wrap">
            <select
              value={uploadType}
              onChange={e => setUploadType(e.target.value)}
              className="input h-7 py-0 text-xs w-auto"
            >
              {FILE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              onChange={e => e.target.files && handleUpload(e.target.files)}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="flex items-center gap-1 text-xs btn-secondary h-7 px-2"
            >
              {uploading
                ? <><Loader2 className="w-3 h-3 animate-spin" /> Enviando…</>
                : <><Upload className="w-3 h-3" /> Escolher</>}
            </button>
            <button
              onClick={() => setUploadOpen(false)}
              className="text-xs text-white/30 hover:text-white/60 transition-colors"
            >
              Cancelar
            </button>
          </div>
        ) : (
          <button
            onClick={() => setUploadOpen(true)}
            className="flex items-center gap-1 text-[10px] text-white/25 hover:text-white/50 transition-colors"
          >
            <Plus className="w-3 h-3" /> Arquivo
          </button>
        )}
      </div>
    </div>
  )
}
