'use client'

import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { api } from '@/lib/trpc'
import { useToast } from '@/components/ui/toast'
import { Modal } from '@/components/ui/modal'
import { cn, filterPillClass, calculateTelescope } from '@/lib/utils'

const FILTERS = ['L', 'R', 'G', 'B', 'Ha', 'OIII', 'SII']

const schema = z.object({
  name:             z.string().min(2, 'Nome obrigatório'),
  telescopeId:      z.string().min(1, 'Selecione um telescópio'),
  cameraId:         z.string().min(1, 'Selecione uma câmera'),
  mountId:          z.string().optional(),
  isDefault:        z.boolean().default(false),
  effectiveFocalMm: z.coerce.number().positive().optional().or(z.literal('')).transform(v => v === '' ? undefined : Number(v)),
  filtersAvailable: z.array(z.string()).default([]),
  accessoryIds:     z.array(z.string()).default([]),
  notes:            z.string().optional(),
})

type FormValues = z.input<typeof schema>

export type SetupInitial = {
  id: string; name: string; telescopeId: string; cameraId: string
  mountId?: string | null; isDefault: boolean; effectiveFocalMm?: number | null
  filtersAvailable: string[]; notes?: string | null
  accessories: { accessoryId: string }[]
}

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  initial?: SetupInitial
}

export function SetupForm({ open, onOpenChange, initial }: Props) {
  const isEdit = !!initial
  const { toast } = useToast()
  const utils = api.useUtils()

  const { data: telescopes } = api.telescopes.list.useQuery()
  const { data: cameras }    = api.cameras.list.useQuery()
  const { data: mounts }     = api.mounts.list.useQuery()
  const { data: accessories } = api.accessories.list.useQuery()

  const { register, handleSubmit, reset, watch, setValue, formState: { errors, isSubmitting } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { filtersAvailable: [], accessoryIds: [], isDefault: false },
  })

  const selectedFilters     = watch('filtersAvailable') ?? []
  const selectedAccessories = watch('accessoryIds') ?? []
  const watchTelescopeId    = watch('telescopeId')
  const watchCameraId       = watch('cameraId')
  const watchEffectiveFocal = watch('effectiveFocalMm')

  const selectedTelescope = telescopes?.find(t => t.id === watchTelescopeId)
  const selectedCamera    = cameras?.find(c => c.id === watchCameraId)

  const optics = (() => {
    if (!selectedTelescope || !selectedCamera) return null
    const focalMm = Number(watchEffectiveFocal) || selectedTelescope.focalLengthMm
    return calculateTelescope({
      focalLengthMm:  focalMm,
      apertureMm:     selectedTelescope.apertureMm,
      pixelSizeUm:    selectedCamera.pixelSizeUm,
      sensorWidthPx:  selectedCamera.sensorWidthPx,
      sensorHeightPx: selectedCamera.sensorHeightPx,
    })
  })()

  useEffect(() => {
    if (open) {
      reset(initial ? {
        name:             initial.name,
        telescopeId:      initial.telescopeId,
        cameraId:         initial.cameraId,
        mountId:          initial.mountId ?? '',
        isDefault:        initial.isDefault,
        effectiveFocalMm: initial.effectiveFocalMm ?? '',
        filtersAvailable: initial.filtersAvailable,
        accessoryIds:     initial.accessories.map(a => a.accessoryId),
        notes:            initial.notes ?? '',
      } : { filtersAvailable: [], accessoryIds: [], isDefault: false })
    }
  }, [open, initial?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const invalidate = () => utils.setups.list.invalidate()

  const create = api.setups.create.useMutation({
    onSuccess: () => { invalidate(); toast('Setup criado!'); reset(); onOpenChange(false) },
    onError: (e) => toast(e.message, 'error'),
  })

  const update = api.setups.update.useMutation({
    onSuccess: () => { invalidate(); toast('Setup atualizado!'); onOpenChange(false) },
    onError: (e) => toast(e.message, 'error'),
  })

  function toggleFilter(f: string) {
    const cur = selectedFilters
    setValue('filtersAvailable', cur.includes(f) ? cur.filter(x => x !== f) : [...cur, f])
  }

  function toggleAccessory(id: string) {
    const cur = selectedAccessories
    setValue('accessoryIds', cur.includes(id) ? cur.filter(x => x !== id) : [...cur, id])
  }

  function onSubmit(data: FormValues) {
    if (isEdit) {
      update.mutate({ id: initial!.id, ...(data as any) })
    } else {
      create.mutate(data as any)
    }
  }

  return (
    <Modal open={open} onOpenChange={onOpenChange}
      title={isEdit ? 'Editar Setup' : 'Novo Setup'}
      description="Combinação de telescópio + câmera + montagem">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
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

          {/* Painel de óptica calculada — aparece ao selecionar telescópio + câmera */}
          {optics && (
            <div className="col-span-2 space-y-2">
              <p className="text-[10px] text-white/35 uppercase tracking-wider">Parâmetros do conjunto</p>
              <div className="grid grid-cols-4 gap-2">
                <div className="p-2.5 rounded-lg bg-white/3 border border-white/8">
                  <p className="text-[10px] text-white/35 uppercase tracking-wider mb-0.5">Escala</p>
                  <p className="text-sm font-mono font-medium text-white/80">{optics.plateScaleArcsecPx}"</p>
                  <p className="text-[10px] text-white/30">arcsec/px</p>
                </div>
                <div className="p-2.5 rounded-lg bg-white/3 border border-white/8">
                  <p className="text-[10px] text-white/35 uppercase tracking-wider mb-0.5">f/ratio</p>
                  <p className="text-sm font-mono font-medium text-white/80">f/{optics.focalRatio}</p>
                  {Number(watchEffectiveFocal) > 0 && selectedTelescope && (
                    <p className="text-[10px] text-white/30">
                      {(Number(watchEffectiveFocal) / selectedTelescope.focalLengthMm).toFixed(2)}x
                    </p>
                  )}
                </div>
                <div className="p-2.5 rounded-lg bg-white/3 border border-white/8">
                  <p className="text-[10px] text-white/35 uppercase tracking-wider mb-0.5">FoV</p>
                  <p className="text-sm font-mono font-medium text-white/80">
                    {optics.fovWidthArcmin}′
                  </p>
                  <p className="text-[10px] text-white/30">× {optics.fovHeightArcmin}′</p>
                </div>
                <div className={cn(
                  'p-2.5 rounded-lg border',
                  optics.sampling === 'optimal'       && 'bg-aurora-400/8 border-aurora-400/20',
                  optics.sampling === 'undersampled'  && 'bg-amber-400/8 border-amber-400/20',
                  optics.sampling === 'oversampled'   && 'bg-blue-400/8 border-blue-400/20',
                )}>
                  <p className="text-[10px] text-white/35 uppercase tracking-wider mb-0.5">Amostragem</p>
                  <p className={cn(
                    'text-xs font-medium',
                    optics.sampling === 'optimal'       && 'text-aurora-300',
                    optics.sampling === 'undersampled'  && 'text-amber-300',
                    optics.sampling === 'oversampled'   && 'text-blue-300',
                  )}>
                    {optics.samplingHint}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Filters */}
          <div className="col-span-2">
            <label className="input-label">Filtros disponíveis</label>
            <div className="flex flex-wrap gap-1.5 mt-1">
              {FILTERS.map(f => (
                <button key={f} type="button" onClick={() => toggleFilter(f)}
                  className={cn('filter-pill transition-opacity',
                    selectedFilters.includes(f) ? filterPillClass(f) : 'opacity-30 bg-white/5 text-white/40')}>
                  {f}
                </button>
              ))}
            </div>
          </div>

          {/* Accessories */}
          {accessories && accessories.length > 0 && (
            <div className="col-span-2">
              <label className="input-label">Acessórios</label>
              <div className="flex flex-wrap gap-1.5 mt-1">
                {accessories.map(a => {
                  const selected = selectedAccessories.includes(a.id)
                  return (
                    <button key={a.id} type="button" onClick={() => toggleAccessory(a.id)}
                      className={cn(
                        'px-2 py-0.5 rounded text-xs font-medium border transition-opacity',
                        selected
                          ? 'bg-cosmos-500/20 text-cosmos-300 border-cosmos-500/40'
                          : 'opacity-30 bg-white/5 text-white/40 border-white/10',
                      )}>
                      {a.name}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          <div className="col-span-2">
            <label className="input-label">Notas</label>
            <textarea {...register('notes')} className="input" rows={2} />
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" className="btn-secondary" onClick={() => onOpenChange(false)}>Cancelar</button>
          <button type="submit" className="btn-primary" disabled={isSubmitting}>
            {isSubmitting ? 'Salvando…' : isEdit ? 'Salvar' : 'Criar Setup'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
