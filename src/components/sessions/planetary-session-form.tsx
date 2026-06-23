'use client'

import { useEffect, useRef } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { format } from 'date-fns'
import { FileUp } from 'lucide-react'
import { api } from '@/lib/trpc'
import { getMoonPhase } from '@/lib/moon'
import { cn } from '@/lib/utils'
import { parsePlanetaryFile } from '@/lib/planetary-meta'
import { useToast } from '@/components/ui/toast'
import { Modal } from '@/components/ui/modal'

const optNum = z.coerce.number().positive().optional().or(z.literal('')).transform(v => v === '' ? undefined : Number(v))
const optInt = z.coerce.number().int().min(0).optional().or(z.literal('')).transform(v => v === '' ? undefined : Number(v))

const schema = z.object({
  observedAt:      z.string(),
  setupId:         z.string().optional(),
  filterUsed:      z.string().optional(),
  captureSoftware: z.string().optional(),
  videoFormat:     z.string().optional(),
  fps:             optNum,
  exposureMs:      optNum,
  totalFrames:     optInt,
  stackedPct:      z.coerce.number().int().min(0).max(100).optional().or(z.literal('')).transform(v => v === '' ? undefined : Number(v)),
  roi:             z.string().optional(),
  gain:            z.coerce.number().int().optional().or(z.literal('')).transform(v => v === '' ? undefined : Number(v)),
  seeingArcsec:    optNum,
  rating:          z.coerce.number().int().min(1).max(5).optional().or(z.literal('')).transform(v => v === '' ? undefined : Number(v)),
  notes:           z.string().optional(),
})
type FormValues = z.input<typeof schema>

export type PlanetaryInitial = {
  id?: string
  observedAt: Date | string; setupId?: string | null; filterUsed?: string | null
  captureSoftware?: string | null; videoFormat?: string | null
  fps?: number | null; exposureMs?: number | null; totalFrames?: number | null
  stackedPct?: number | null; roi?: string | null; gain?: number | null
  seeingArcsec?: number | null; rating?: number | null; notes?: string | null
}

interface Props { projectId: string; open: boolean; onOpenChange: (o: boolean) => void; initial?: PlanetaryInitial }

export function PlanetarySessionForm({ projectId, open, onOpenChange, initial }: Props) {
  const isEdit = !!initial?.id
  const { toast } = useToast()
  const utils = api.useUtils()
  const { data: setups } = api.setups.list.useQuery()

  const { register, handleSubmit, reset, watch, setValue, formState: { isSubmitting } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { observedAt: format(new Date(), "yyyy-MM-dd'T'HH:mm") },
  })
  const observedAt = watch('observedAt')
  const metaRef = useRef<HTMLInputElement>(null)

  async function onMetaFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (!f) return
    const m = await parsePlanetaryFile(f).catch(() => null)
    if (!m || !Object.values(m).some(v => v !== undefined)) { toast('Nenhum metadado reconhecido no arquivo', 'error'); return }
    if (m.observedAt)          setValue('observedAt', format(m.observedAt, "yyyy-MM-dd'T'HH:mm"))
    if (m.totalFrames != null) setValue('totalFrames', m.totalFrames as any)
    if (m.roi)                 setValue('roi', m.roi)
    if (m.fps != null)         setValue('fps', m.fps as any)
    if (m.exposureMs != null)  setValue('exposureMs', m.exposureMs as any)
    if (m.gain != null)        setValue('gain', m.gain as any)
    if (m.filterUsed)          setValue('filterUsed', m.filterUsed)
    if (m.captureSoftware)     setValue('captureSoftware', m.captureSoftware)
    toast('Preenchido a partir do arquivo')
  }

  useEffect(() => {
    if (!open) return
    reset(initial ? {
      observedAt:      format(new Date(initial.observedAt), "yyyy-MM-dd'T'HH:mm"),
      setupId:         initial.setupId ?? '',
      filterUsed:      initial.filterUsed ?? '',
      captureSoftware: initial.captureSoftware ?? '',
      videoFormat:     initial.videoFormat ?? '',
      fps:             initial.fps ?? '',
      exposureMs:      initial.exposureMs ?? '',
      totalFrames:     initial.totalFrames ?? '',
      stackedPct:      initial.stackedPct ?? '',
      roi:             initial.roi ?? '',
      gain:            initial.gain ?? '',
      seeingArcsec:    initial.seeingArcsec ?? '',
      rating:          initial.rating ?? '',
      notes:           initial.notes ?? '',
    } : { observedAt: format(new Date(), "yyyy-MM-dd'T'HH:mm") })
  }, [open, initial?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const create = api.sessions.create.useMutation()
  const update = api.sessions.update.useMutation()

  function invalidate() {
    utils.sessions.list.invalidate({ projectId })
    utils.projects.byId.invalidate({ id: projectId })
  }

  async function onSubmit(data: FormValues) {
    const iso = new Date(data.observedAt).toISOString()
    try {
      if (isEdit) {
        await update.mutateAsync({ id: initial!.id!, ...(data as any), observedAt: iso })
        toast('Sessão atualizada!')
      } else {
        await create.mutateAsync({ projectId, ...(data as any), observedAt: iso })
        toast('Sessão registrada!')
        reset()
      }
      invalidate()
      onOpenChange(false)
    } catch (e: any) {
      toast(e.message ?? 'Erro ao salvar', 'error')
    }
  }

  const frames = Number(watch('totalFrames')), pct = Number(watch('stackedPct'))
  const kept = frames > 0 && pct > 0 ? Math.round(frames * pct / 100) : null

  return (
    <Modal open={open} onOpenChange={onOpenChange}
      title={isEdit ? 'Editar Sessão' : 'Nova Sessão (Planetária)'}
      description="Lucky imaging / captura de vídeo de alto FPS" className="max-w-2xl">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <label className="input-label">Data / Hora *</label>
            <input {...register('observedAt')} type="datetime-local" className="input" />
            {(() => {
              const d = observedAt ? new Date(observedAt) : null
              if (!d || isNaN(d.getTime())) return null
              const m = getMoonPhase(d)
              return <p className="text-[11px] text-white/50 mt-1.5">{m.emoji} {m.label} · {m.illumination}%</p>
            })()}
          </div>
          <div className="col-span-2">
            <label className="input-label">Setup usado</label>
            <select {...register('setupId')} className="input">
              <option value="">Setup do projeto</option>
              {setups?.map(s => <option key={s.id} value={s.id}>{s.name}{s.isDefault ? ' ★' : ''}</option>)}
            </select>
          </div>
        </div>

        {/* Import automático de metadados */}
        <div className="flex items-center gap-2 p-2.5 rounded-lg border border-dashed border-white/10 bg-white/2">
          <FileUp className="w-4 h-4 text-white/30 shrink-0" />
          <p className="text-[11px] text-white/55 flex-1">Importe um <strong className="text-white/60">.ser</strong> ou o <strong className="text-white/60">log .txt do FireCapture</strong> pra preencher automaticamente</p>
          <input ref={metaRef} type="file" accept=".ser,.txt,.log" className="hidden" onChange={onMetaFile} />
          <button type="button" className="btn-secondary text-xs shrink-0" onClick={() => metaRef.current?.click()}>Importar</button>
        </div>

        <div>
          <p className="text-xs text-white/55 uppercase tracking-wider mb-3">Captura</p>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="input-label">Software</label>
              <input {...register('captureSoftware')} className="input" placeholder="FireCapture" list="planet-sw" />
              <datalist id="planet-sw"><option value="FireCapture" /><option value="SharpCap" /><option value="ASICap" /></datalist>
            </div>
            <div>
              <label className="input-label">Formato</label>
              <select {...register('videoFormat')} className="input">
                <option value="">—</option><option>SER</option><option>AVI</option><option>MOV</option>
              </select>
            </div>
            <div>
              <label className="input-label">Filtro</label>
              <input {...register('filterUsed')} className="input" placeholder="IR/UV, RGB, OSC…" />
            </div>
            <div>
              <label className="input-label">FPS</label>
              <input {...register('fps')} type="number" step="1" className="input" placeholder="120" />
            </div>
            <div>
              <label className="input-label">Exposição (ms)</label>
              <input {...register('exposureMs')} type="number" step="0.1" className="input" placeholder="8" />
            </div>
            <div>
              <label className="input-label">Gain</label>
              <input {...register('gain')} type="number" step="1" className="input" placeholder="300" />
            </div>
            <div>
              <label className="input-label">Total de frames</label>
              <input {...register('totalFrames')} type="number" step="1" className="input" placeholder="10000" />
            </div>
            <div>
              <label className="input-label">% empilhado</label>
              <input {...register('stackedPct')} type="number" step="1" min="0" max="100" className="input" placeholder="25" />
            </div>
            <div>
              <label className="input-label">ROI</label>
              <input {...register('roi')} className="input" placeholder="640×480" />
            </div>
            {kept !== null && (
              <p className="col-span-3 text-xs text-aurora-300 mono">~{kept.toLocaleString('pt-BR')} frames empilhados</p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="input-label">Seeing (")</label>
            <input {...register('seeingArcsec')} type="number" step="0.1" className="input" placeholder="2.5" />
          </div>
          <div>
            <label className="input-label">Avaliação (1-5)</label>
            <select {...register('rating')} className="input">
              <option value="">—</option>{[1, 2, 3, 4, 5].map(n => <option key={n} value={n}>{'★'.repeat(n)}</option>)}
            </select>
          </div>
          <div className="col-span-2">
            <label className="input-label">Notas</label>
            <textarea {...register('notes')} className="input" rows={2} placeholder="Seeing, derotação (WinJUPOS), filtros…" />
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <button type="button" className={cn('btn-secondary')} onClick={() => onOpenChange(false)}>Cancelar</button>
          <button type="submit" className="btn-primary" disabled={isSubmitting}>
            {isSubmitting ? 'Salvando…' : isEdit ? 'Salvar' : 'Registrar Sessão'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
