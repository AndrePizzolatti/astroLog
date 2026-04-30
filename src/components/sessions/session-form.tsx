'use client'

import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { format } from 'date-fns'
import { api } from '@/lib/trpc'
import { useToast } from '@/components/ui/toast'
import { Modal } from '@/components/ui/modal'

const FILTERS = ['L', 'R', 'G', 'B', 'Ha', 'OIII', 'SII']

const schema = z.object({
  projectId:        z.string(),
  setupId:          z.string().optional(),
  observedAt:       z.string(),
  filterUsed:       z.string().optional(),
  lightsCount:      z.coerce.number().int().min(0).default(0),
  exposureSeconds:  z.coerce.number().positive().optional().or(z.literal('')).transform(v => v === '' ? undefined : Number(v)),
  gain:             z.coerce.number().int().optional().or(z.literal('')).transform(v => v === '' ? undefined : Number(v)),
  offset:           z.coerce.number().int().optional().or(z.literal('')).transform(v => v === '' ? undefined : Number(v)),
  binning:          z.string().optional(),
  sensorTempC:      z.coerce.number().optional().or(z.literal('')).transform(v => v === '' ? undefined : Number(v)),
  temperatureC:     z.coerce.number().optional().or(z.literal('')).transform(v => v === '' ? undefined : Number(v)),
  humidityPct:      z.coerce.number().int().min(0).max(100).optional().or(z.literal('')).transform(v => v === '' ? undefined : Number(v)),
  seeingArcsec:     z.coerce.number().positive().optional().or(z.literal('')).transform(v => v === '' ? undefined : Number(v)),
  sqmValue:         z.coerce.number().optional().or(z.literal('')).transform(v => v === '' ? undefined : Number(v)),
  bortleScale:      z.coerce.number().int().min(1).max(9).optional().or(z.literal('')).transform(v => v === '' ? undefined : Number(v)),
  cloudCoverPct:    z.coerce.number().int().min(0).max(100).optional().or(z.literal('')).transform(v => v === '' ? undefined : Number(v)),
  guidingRmsArcsec: z.coerce.number().positive().optional().or(z.literal('')).transform(v => v === '' ? undefined : Number(v)),
  rating:           z.coerce.number().int().min(1).max(5).optional().or(z.literal('')).transform(v => v === '' ? undefined : Number(v)),
  notes:            z.string().optional(),
})

type FormValues = z.input<typeof schema>

export type SessionInitial = {
  id: string; projectId: string; setupId?: string | null
  observedAt: Date | string; filterUsed?: string | null
  lightsCount: number; exposureSeconds?: number | null
  gain?: number | null; offset?: number | null; binning?: string | null
  sensorTempC?: number | null; temperatureC?: number | null
  humidityPct?: number | null; seeingArcsec?: number | null
  sqmValue?: number | null; bortleScale?: number | null
  cloudCoverPct?: number | null; guidingRmsArcsec?: number | null
  rating?: number | null; notes?: string | null
}

interface Props {
  projectId: string
  open: boolean
  onOpenChange: (open: boolean) => void
  initial?: SessionInitial
}

export function SessionForm({ projectId, open, onOpenChange, initial }: Props) {
  const isEdit = !!initial
  const { toast } = useToast()
  const utils = api.useUtils()
  const { data: setups } = api.setups.list.useQuery()

  const { register, handleSubmit, reset, watch, setValue, formState: { errors, isSubmitting } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      projectId,
      observedAt: format(new Date(), "yyyy-MM-dd'T'HH:mm"),
      lightsCount: 0,
    },
  })

  const selectedFilter = watch('filterUsed')

  useEffect(() => {
    if (open) {
      reset(initial ? {
        projectId:        initial.projectId,
        setupId:          initial.setupId ?? '',
        observedAt:       format(new Date(initial.observedAt), "yyyy-MM-dd'T'HH:mm"),
        filterUsed:       initial.filterUsed ?? undefined,
        lightsCount:      initial.lightsCount,
        exposureSeconds:  initial.exposureSeconds ?? '',
        gain:             initial.gain ?? '',
        offset:           initial.offset ?? '',
        binning:          initial.binning ?? '',
        sensorTempC:      initial.sensorTempC ?? '',
        temperatureC:     initial.temperatureC ?? '',
        humidityPct:      initial.humidityPct ?? '',
        seeingArcsec:     initial.seeingArcsec ?? '',
        sqmValue:         initial.sqmValue ?? '',
        bortleScale:      initial.bortleScale ?? '',
        cloudCoverPct:    initial.cloudCoverPct ?? '',
        guidingRmsArcsec: initial.guidingRmsArcsec ?? '',
        rating:           initial.rating ?? '',
        notes:            initial.notes ?? '',
      } : {
        projectId,
        observedAt: format(new Date(), "yyyy-MM-dd'T'HH:mm"),
        lightsCount: 0,
      })
    }
  }, [open, initial?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const invalidate = () => {
    utils.sessions.list.invalidate({ projectId })
    utils.projects.byId.invalidate({ id: projectId })
  }

  const create = api.sessions.create.useMutation({
    onSuccess: () => { invalidate(); toast('Sessão registrada!'); reset(); onOpenChange(false) },
    onError: (e) => toast(e.message, 'error'),
  })

  const update = api.sessions.update.useMutation({
    onSuccess: () => { invalidate(); toast('Sessão atualizada!'); onOpenChange(false) },
    onError: (e) => toast(e.message, 'error'),
  })

  function onSubmit(data: FormValues) {
    const isoDate = new Date(data.observedAt).toISOString()
    if (isEdit) {
      update.mutate({ id: initial!.id, ...(data as any), observedAt: isoDate })
    } else {
      create.mutate({ ...(data as any), observedAt: isoDate })
    }
  }

  return (
    <Modal open={open} onOpenChange={onOpenChange}
      title={isEdit ? 'Editar Sessão' : 'Nova Sessão'}
      description={isEdit ? undefined : 'Registre uma noite de captura'}
      className="max-w-2xl">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">

        {/* Basic */}
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <label className="input-label">Data / Hora de observação *</label>
            <input {...register('observedAt')} type="datetime-local" className="input" />
          </div>
          <div className="col-span-2">
            <label className="input-label">Setup usado</label>
            <select {...register('setupId')} className="input">
              <option value="">Setup do projeto</option>
              {setups?.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
        </div>

        {/* Capture */}
        <div>
          <p className="text-xs text-white/40 uppercase tracking-wider mb-3">Parâmetros de captura</p>
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-3">
              <label className="input-label">Filtro</label>
              <div className="flex flex-wrap gap-1.5">
                {['', ...FILTERS].map(f => (
                  <button
                    key={f || 'none'}
                    type="button"
                    onClick={() => setValue('filterUsed', f || undefined)}
                    className={`px-2 py-0.5 rounded text-xs font-mono font-bold border transition-opacity ${
                      (f === '' && !selectedFilter) || selectedFilter === f
                        ? f ? `filter-${f}` : 'bg-white/10 text-white/60 border-white/20'
                        : 'opacity-30 bg-white/5 text-white/40 border-white/10'
                    }`}
                  >
                    {f || 'Sem filtro'}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="input-label">Lights</label>
              <input {...register('lightsCount')} type="number" min="0" step="1" className="input" placeholder="120" />
            </div>
            <div>
              <label className="input-label">Exposição (s)</label>
              <input {...register('exposureSeconds')} type="number" step="0.1" className="input" placeholder="300" />
            </div>
            <div>
              <label className="input-label">Gain</label>
              <input {...register('gain')} type="number" step="1" className="input" placeholder="100" />
            </div>
            <div>
              <label className="input-label">Offset</label>
              <input {...register('offset')} type="number" step="1" className="input" placeholder="50" />
            </div>
            <div>
              <label className="input-label">Binning</label>
              <select {...register('binning')} className="input">
                <option value="">—</option>
                <option>1×1</option><option>2×2</option><option>3×3</option><option>4×4</option>
              </select>
            </div>
            <div>
              <label className="input-label">Temp. sensor (°C)</label>
              <input {...register('sensorTempC')} type="number" step="0.5" className="input" placeholder="-10" />
            </div>
          </div>
        </div>

        {/* Conditions */}
        <div>
          <p className="text-xs text-white/40 uppercase tracking-wider mb-3">Condições atmosféricas</p>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="input-label">Temperatura (°C)</label>
              <input {...register('temperatureC')} type="number" step="0.5" className="input" placeholder="18" />
            </div>
            <div>
              <label className="input-label">Umidade (%)</label>
              <input {...register('humidityPct')} type="number" step="1" className="input" placeholder="75" />
            </div>
            <div>
              <label className="input-label">Nuvens (%)</label>
              <input {...register('cloudCoverPct')} type="number" step="1" className="input" placeholder="0" />
            </div>
            <div>
              <label className="input-label">Seeing (")</label>
              <input {...register('seeingArcsec')} type="number" step="0.1" className="input" placeholder="2.5" />
            </div>
            <div>
              <label className="input-label">SQM</label>
              <input {...register('sqmValue')} type="number" step="0.01" className="input" placeholder="21.3" />
            </div>
            <div>
              <label className="input-label">Bortle</label>
              <select {...register('bortleScale')} className="input">
                <option value="">—</option>
                {[1,2,3,4,5,6,7,8,9].map(n => <option key={n} value={n}>Classe {n}</option>)}
              </select>
            </div>
            <div>
              <label className="input-label">Guiagem RMS (")</label>
              <input {...register('guidingRmsArcsec')} type="number" step="0.01" className="input" placeholder="0.8" />
            </div>
            <div>
              <label className="input-label">Avaliação (1-5)</label>
              <select {...register('rating')} className="input">
                <option value="">—</option>
                {[1,2,3,4,5].map(n => <option key={n} value={n}>{'★'.repeat(n)}</option>)}
              </select>
            </div>
          </div>
        </div>

        <div>
          <label className="input-label">Notas</label>
          <textarea {...register('notes')} className="input" rows={2} placeholder="Observações sobre a noite…" />
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <button type="button" className="btn-secondary" onClick={() => onOpenChange(false)}>Cancelar</button>
          <button type="submit" className="btn-primary" disabled={isSubmitting}>
            {isSubmitting ? 'Salvando…' : isEdit ? 'Salvar' : 'Registrar Sessão'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
