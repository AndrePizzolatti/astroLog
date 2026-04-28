'use client'

import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { api } from '@/lib/trpc'
import { useToast } from '@/components/ui/toast'
import { Modal } from '@/components/ui/modal'
import { cn, filterPillClass } from '@/lib/utils'

const FILTERS = ['L', 'R', 'G', 'B', 'Ha', 'OIII', 'SII']

const schema = z.object({
  name:             z.string().min(2, 'Nome obrigatório'),
  telescopeId:      z.string().min(1, 'Selecione um telescópio'),
  cameraId:         z.string().min(1, 'Selecione uma câmera'),
  mountId:          z.string().optional(),
  isDefault:        z.boolean().default(false),
  effectiveFocalMm: z.coerce.number().positive().optional().or(z.literal('')).transform(v => v === '' ? undefined : Number(v)),
  filtersAvailable: z.array(z.string()).default([]),
  notes:            z.string().optional(),
})

type FormValues = z.input<typeof schema>

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function SetupForm({ open, onOpenChange }: Props) {
  const { toast } = useToast()
  const utils = api.useUtils()

  const { data: telescopes } = api.telescopes.list.useQuery()
  const { data: cameras }    = api.cameras.list.useQuery()
  const { data: mounts }     = api.mounts.list.useQuery()

  const { register, handleSubmit, reset, control, watch, setValue, formState: { errors, isSubmitting } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { filtersAvailable: [], isDefault: false },
  })

  const selectedFilters = watch('filtersAvailable') ?? []

  const create = api.setups.create.useMutation({
    onSuccess: () => {
      utils.setups.list.invalidate()
      toast('Setup criado!')
      reset()
      onOpenChange(false)
    },
    onError: (e) => toast(e.message, 'error'),
  })

  function toggleFilter(f: string) {
    const cur = selectedFilters
    setValue(
      'filtersAvailable',
      cur.includes(f) ? cur.filter(x => x !== f) : [...cur, f],
    )
  }

  return (
    <Modal open={open} onOpenChange={onOpenChange} title="Novo Setup" description="Combinação de telescópio + câmera + montagem">
      <form onSubmit={handleSubmit(d => create.mutate(d as any))} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <label className="input-label">Nome do setup *</label>
            <input {...register('name')} className="input" placeholder="Ex: Deep Sky NB" />
            {errors.name && <p className="input-error">{errors.name.message}</p>}
          </div>
          <div className="col-span-2">
            <label className="input-label">Telescópio *</label>
            <select {...register('telescopeId')} className="input">
              <option value="">Selecione…</option>
              {telescopes?.map(t => (
                <option key={t.id} value={t.id}>
                  {t.name} — {t.focalLengthMm}mm f/{(t.focalRatioOverride ?? t.focalLengthMm / t.apertureMm).toFixed(1)}
                </option>
              ))}
            </select>
            {errors.telescopeId && <p className="input-error">{errors.telescopeId.message}</p>}
          </div>
          <div className="col-span-2">
            <label className="input-label">Câmera *</label>
            <select {...register('cameraId')} className="input">
              <option value="">Selecione…</option>
              {cameras?.map(c => (
                <option key={c.id} value={c.id}>
                  {c.name} — {c.pixelSizeUm}µm {c.sensorWidthPx}×{c.sensorHeightPx}
                </option>
              ))}
            </select>
            {errors.cameraId && <p className="input-error">{errors.cameraId.message}</p>}
          </div>
          <div className="col-span-2">
            <label className="input-label">Montagem</label>
            <select {...register('mountId')} className="input">
              <option value="">Nenhuma</option>
              {mounts?.map(m => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="input-label">Focal efetiva (mm)</label>
            <input {...register('effectiveFocalMm')} type="number" step="1" className="input" placeholder="Com redutor/barlow" />
          </div>
          <div className="flex items-end pb-2">
            <label className="flex items-center gap-2 text-sm text-white/70">
              <input {...register('isDefault')} type="checkbox" className="rounded" />
              Setup padrão
            </label>
          </div>
          <div className="col-span-2">
            <label className="input-label">Filtros disponíveis</label>
            <div className="flex flex-wrap gap-1.5 mt-1">
              {FILTERS.map(f => (
                <button
                  key={f}
                  type="button"
                  onClick={() => toggleFilter(f)}
                  className={cn(
                    'filter-pill transition-opacity',
                    selectedFilters.includes(f) ? filterPillClass(f) : 'opacity-30 bg-white/5 text-white/40',
                  )}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>
          <div className="col-span-2">
            <label className="input-label">Notas</label>
            <textarea {...register('notes')} className="input" rows={2} />
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" className="btn-secondary" onClick={() => onOpenChange(false)}>Cancelar</button>
          <button type="submit" className="btn-primary" disabled={isSubmitting}>
            {isSubmitting ? 'Criando…' : 'Criar Setup'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
