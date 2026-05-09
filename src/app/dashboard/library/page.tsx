'use client'

import { useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Plus, Trash2, Upload, Loader2, Library } from 'lucide-react'
import { api } from '@/lib/trpc'
import { cn, formatFileSize } from '@/lib/utils'
import { Modal } from '@/components/ui/modal'
import { useToast } from '@/components/ui/toast'

// ─── Types & constants ────────────────────────────────────────────────────────

const CALIB_TYPES = ['DARK', 'BIAS', 'MASTER_DARK', 'MASTER_BIAS'] as const
type CalibType = typeof CALIB_TYPES[number]

const TYPE_LABELS: Record<CalibType, string> = {
  DARK:        'Dark',
  BIAS:        'Bias',
  MASTER_DARK: 'Master Dark',
  MASTER_BIAS: 'Master Bias',
}

const TYPE_COLORS: Record<CalibType, string> = {
  DARK:        'bg-cosmos-500/20 text-cosmos-300 border-cosmos-500/30',
  BIAS:        'bg-blue-500/20 text-blue-300 border-blue-500/30',
  MASTER_DARK: 'bg-cosmos-500/30 text-cosmos-200 border-cosmos-500/40',
  MASTER_BIAS: 'bg-blue-500/30 text-blue-200 border-blue-500/40',
}

function typeColor(t: string) {
  return TYPE_COLORS[t as CalibType] ?? 'bg-white/10 text-white/40 border-white/20'
}

// days until expiry: Bias 365d, Darks 180d
const EXPIRY_DAYS: Record<CalibType, number> = {
  DARK: 180, BIAS: 365, MASTER_DARK: 180, MASTER_BIAS: 365,
}

function calibDaysLeft(frameType: string, createdAt: Date | string): number {
  const maxDays = EXPIRY_DAYS[frameType as CalibType] ?? 180
  const created = new Date(createdAt)
  const expiresAt = new Date(created.getTime() + maxDays * 24 * 60 * 60 * 1000)
  return Math.ceil((expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
}

function ExpiryBadge({ frameType, createdAt }: { frameType: string; createdAt: Date | string }) {
  const days = calibDaysLeft(frameType, createdAt)
  if (days < 0) return (
    <span className="badge border bg-red-500/20 text-red-300 border-red-500/30">Vencido</span>
  )
  if (days < 30) return (
    <span className="badge border bg-amber-500/20 text-amber-300 border-amber-500/30">{days}d</span>
  )
  return null
}

function buildAutoLabel(
  frameType: string,
  gain: string | number,
  exposureSeconds?: string | number,
  sensorTempC?: string | number,
  frameCount?: string | number,
): string {
  const type = TYPE_LABELS[frameType as CalibType] ?? frameType
  const parts: string[] = [type]
  if ((frameType === 'DARK' || frameType === 'MASTER_DARK') && exposureSeconds && exposureSeconds !== '') {
    parts.push(`${exposureSeconds}s`)
  }
  if (gain !== '' && gain != null) parts.push(`G${gain}`)
  if (sensorTempC !== '' && sensorTempC != null) parts.push(`${sensorTempC}°C`)
  const fc = Number(frameCount)
  if (!isNaN(fc) && fc > 1) parts.push(`×${fc}`)
  return parts.join(' ')
}

// ─── Upload modal form schema ─────────────────────────────────────────────────

const uploadSchema = z.object({
  cameraId:        z.string().min(1, 'Selecione uma câmera'),
  frameType:       z.enum(['DARK', 'BIAS', 'MASTER_DARK', 'MASTER_BIAS']),
  label:           z.string().min(1).max(100),
  gain:            z.coerce.number().int(),
  offset:          z.coerce.number().int().optional().or(z.literal('')).transform(v => v === '' ? undefined : Number(v)),
  binning:         z.string().optional(),
  exposureSeconds: z.coerce.number().positive().optional().or(z.literal('')).transform(v => v === '' ? undefined : Number(v)),
  sensorTempC:     z.coerce.number().optional().or(z.literal('')).transform(v => v === '' ? undefined : Number(v)),
  frameCount:      z.coerce.number().int().min(1).default(1),
  notes:           z.string().optional(),
})

type UploadForm = z.input<typeof uploadSchema>

// ─── Sub-components ───────────────────────────────────────────────────────────

function CalibBadge({ type }: { type: string }) {
  return (
    <span className={cn('badge border text-[10px]', typeColor(type))}>
      {TYPE_LABELS[type as CalibType] ?? type}
    </span>
  )
}

function CalibCard({ frame, onDelete }: { frame: any; onDelete: () => void }) {
  const [confirming, setConfirming] = useState(false)
  return (
    <div className="card p-4 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-medium text-white truncate">{frame.label}</p>
          <p className="text-xs text-white/40">{frame.camera.name}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <ExpiryBadge frameType={frame.frameType} createdAt={frame.createdAt} />
          <CalibBadge type={frame.frameType} />
          {confirming ? (
            <div className="flex gap-1">
              <button onClick={onDelete} className="text-[10px] text-red-400 hover:text-red-300 px-1">Confirmar</button>
              <button onClick={() => setConfirming(false)} className="text-[10px] text-white/30 hover:text-white/60 px-1">×</button>
            </div>
          ) : (
            <button onClick={() => setConfirming(true)} className="text-white/20 hover:text-red-400 transition-colors p-1">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs mono text-white/50">
        <span>G {frame.gain}</span>
        {frame.exposureSeconds != null && <span>{frame.exposureSeconds}s</span>}
        {frame.sensorTempC    != null && <span>{frame.sensorTempC}°C sensor</span>}
        {frame.binning                && <span>Bin {frame.binning}</span>}
        {frame.offset         != null && <span>Off {frame.offset}</span>}
      </div>

      <div className="flex items-center justify-between text-xs text-white/25">
        <span>{frame.frameCount} frame{frame.frameCount !== 1 ? 's' : ''}</span>
        <span>{formatFileSize(frame.sizeBytes)}</span>
      </div>

      {frame.notes && <p className="text-xs text-white/30 italic">{frame.notes}</p>}
    </div>
  )
}

// ─── Upload modal ─────────────────────────────────────────────────────────────

function UploadModal({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const { toast } = useToast()
  const utils = api.useUtils()
  const fileRef = useRef<HTMLInputElement>(null)

  const { data: cameras } = api.cameras.list.useQuery()

  const [uploading, setUploading] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)

  const { register, handleSubmit, watch, setValue, reset, formState: { errors } } = useForm<UploadForm>({
    resolver: zodResolver(uploadSchema),
    defaultValues: { frameType: 'DARK', gain: 100, frameCount: 1 },
  })

  const wType   = watch('frameType')
  const wGain   = watch('gain')
  const wExp    = watch('exposureSeconds')
  const wTemp   = watch('sensorTempC')
  const wCount  = watch('frameCount')
  const autoLabel = buildAutoLabel(wType, wGain, wExp, wTemp, wCount)

  const upload = api.calibration.upload.useMutation({
    onSuccess: () => {
      utils.calibration.list.invalidate()
      toast('Frame adicionado à biblioteca!')
      reset()
      setSelectedFile(null)
      onOpenChange(false)
    },
    onError: (e) => toast(e.message, 'error'),
  })

  async function onSubmit(data: UploadForm) {
    if (!selectedFile) { toast('Selecione um arquivo', 'error'); return }

    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('file',      selectedFile)
      fd.append('frameType', data.frameType)
      const res = await fetch('/api/upload/calibration-frame', { method: 'POST', body: fd })
      if (!res.ok) {
        const { error } = await res.json().catch(() => ({}))
        toast(error ?? 'Erro no upload', 'error')
        return
      }
      const { storagePath, originalName, sizeBytes } = await res.json()
      upload.mutate({ ...data as any, storagePath, originalName, sizeBytes })
    } finally {
      setUploading(false)
    }
  }

  const isDark = wType === 'DARK' || wType === 'MASTER_DARK'

  return (
    <Modal open={open} onOpenChange={v => { if (!v) { reset(); setSelectedFile(null) } onOpenChange(v) }}
      title="Adicionar à Biblioteca" description="Calibração reutilizável por câmera e parâmetros" className="max-w-lg">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">

        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <label className="input-label">Câmera *</label>
            <select {...register('cameraId')} className="input">
              <option value="">Selecionar…</option>
              {cameras?.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            {errors.cameraId && <p className="text-xs text-red-400 mt-1">{errors.cameraId.message}</p>}
          </div>

          <div className="col-span-2">
            <label className="input-label">Tipo</label>
            <div className="flex gap-2 flex-wrap">
              {CALIB_TYPES.map(t => (
                <button
                  key={t} type="button"
                  onClick={() => setValue('frameType', t)}
                  className={cn('px-2.5 py-1 rounded-md text-xs font-medium border transition-opacity',
                    wType === t ? typeColor(t) : 'bg-white/5 text-white/40 border-white/10 opacity-60 hover:opacity-100')}
                >
                  {TYPE_LABELS[t]}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="input-label">Gain *</label>
            <input {...register('gain')} type="number" step="1" className="input" placeholder="100" />
          </div>
          <div>
            <label className="input-label">Offset</label>
            <input {...register('offset')} type="number" step="1" className="input" placeholder="50" />
          </div>

          {isDark && (
            <div>
              <label className="input-label">Exposição (s)</label>
              <input {...register('exposureSeconds')} type="number" step="0.1" className="input" placeholder="300" />
            </div>
          )}
          <div>
            <label className="input-label">Temp. sensor (°C)</label>
            <input {...register('sensorTempC')} type="number" step="0.5" className="input" placeholder="-10" />
          </div>
          <div>
            <label className="input-label">Binning</label>
            <select {...register('binning')} className="input">
              <option value="">—</option>
              <option>1×1</option><option>2×2</option><option>3×3</option><option>4×4</option>
            </select>
          </div>
          <div>
            <label className="input-label">Nº de frames</label>
            <input {...register('frameCount')} type="number" step="1" min="1" className="input" placeholder="1" />
          </div>
        </div>

        <div>
          <label className="input-label">Rótulo</label>
          <input {...register('label')} className="input" placeholder={autoLabel} />
          <p className="text-[10px] text-white/25 mt-1">Sugerido: {autoLabel}</p>
        </div>

        <div>
          <label className="input-label">Notas</label>
          <textarea {...register('notes')} className="input" rows={2} />
        </div>

        {/* File picker */}
        <div>
          <label className="input-label">Arquivo *</label>
          <input ref={fileRef} type="file" className="hidden" onChange={e => setSelectedFile(e.target.files?.[0] ?? null)} />
          <button type="button" onClick={() => fileRef.current?.click()}
            className={cn('w-full border-2 border-dashed rounded-lg p-4 text-sm text-center transition-colors',
              selectedFile
                ? 'border-aurora-400/40 text-aurora-400 bg-aurora-400/5'
                : 'border-white/10 text-white/30 hover:border-white/20 hover:text-white/50')}>
            {selectedFile
              ? <><Upload className="w-4 h-4 inline mr-2" />{selectedFile.name} ({formatFileSize(selectedFile.size)})</>
              : <><Upload className="w-4 h-4 inline mr-2" />Escolher arquivo</>}
          </button>
        </div>

        <div className="flex justify-end gap-2 pt-1">
          <button type="button" className="btn-secondary" onClick={() => onOpenChange(false)}>Cancelar</button>
          <button type="submit" disabled={uploading || upload.isPending} className="btn-primary flex items-center gap-2">
            {(uploading || upload.isPending) && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            {uploading ? 'Enviando…' : upload.isPending ? 'Salvando…' : 'Adicionar'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function LibraryPage() {
  const { toast } = useToast()
  const utils = api.useUtils()

  const [typeFilter,   setTypeFilter]   = useState<CalibType | undefined>(undefined)
  const [cameraFilter, setCameraFilter] = useState<string | undefined>(undefined)
  const [addOpen,      setAddOpen]      = useState(false)

  const { data, isLoading } = api.calibration.list.useQuery({
    frameType: typeFilter,
    cameraId:  cameraFilter,
  })

  const { data: cameras } = api.cameras.list.useQuery()

  const del = api.calibration.delete.useMutation({
    onSuccess: () => { utils.calibration.list.invalidate(); toast('Frame removido') },
    onError: (e) => toast(e.message, 'error'),
  })

  const items = data?.items ?? []

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="page-header">
        <div>
          <h1 className="page-title">Biblioteca de Calibração</h1>
          <p className="page-subtitle">Frames reutilizáveis por câmera — darks, biases, masters</p>
        </div>
        <button className="btn-primary flex items-center gap-2" onClick={() => setAddOpen(true)}>
          <Plus className="w-4 h-4" /> Adicionar Frame
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <div className="flex gap-1.5 flex-wrap">
          <button
            onClick={() => setTypeFilter(undefined)}
            className={cn('px-3 py-1 rounded-full text-xs font-medium transition-colors',
              !typeFilter ? 'bg-cosmos-500 text-white' : 'bg-white/5 text-white/50 hover:bg-white/10')}
          >Todos</button>
          {CALIB_TYPES.map(t => (
            <button key={t}
              onClick={() => setTypeFilter(typeFilter === t ? undefined : t)}
              className={cn('px-3 py-1 rounded-full text-xs font-medium transition-colors',
                typeFilter === t ? 'bg-cosmos-500 text-white' : 'bg-white/5 text-white/50 hover:bg-white/10')}
            >{TYPE_LABELS[t]}</button>
          ))}
        </div>

        {cameras && cameras.length > 1 && (
          <select
            value={cameraFilter ?? ''}
            onChange={e => setCameraFilter(e.target.value || undefined)}
            className="input h-8 py-0 text-xs w-auto"
          >
            <option value="">Todas as câmeras</option>
            {cameras.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        )}
      </div>

      {/* Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => <div key={i} className="card h-36 animate-pulse" />)}
        </div>
      ) : !items.length ? (
        <div className="card p-16 flex flex-col items-center text-center gap-3">
          <Library className="w-12 h-12 text-white/10" />
          <h3 className="font-medium text-white/40">Biblioteca vazia</h3>
          <p className="text-sm text-white/25 max-w-xs">
            Adicione darks e biases capturados com sua câmera para reutilizar em múltiplos projetos.
          </p>
          <button className="btn-primary flex items-center gap-2 mt-2" onClick={() => setAddOpen(true)}>
            <Plus className="w-4 h-4" /> Adicionar Frame
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map(frame => (
            <CalibCard
              key={frame.id}
              frame={frame}
              onDelete={() => del.mutate({ id: frame.id })}
            />
          ))}
        </div>
      )}

      {data?.nextCursor && (
        <p className="text-xs text-white/25 text-center mt-6">
          Mostrando {items.length} frames — refine os filtros para ver mais.
        </p>
      )}

      <UploadModal open={addOpen} onOpenChange={setAddOpen} />
    </div>
  )
}
