'use client'

import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { api } from '@/lib/trpc'
import { useToast } from '@/components/ui/toast'
import { Modal } from '@/components/ui/modal'

const schema = z.object({
  name:             z.string().min(2, 'Nome obrigatório'),
  brand:            z.string().optional(),
  model:            z.string().optional(),
  colorType:        z.enum(['COLOR', 'MONO', 'DSLR']).default('COLOR'),
  sensorName:       z.string().optional(),
  pixelSizeUm:      z.coerce.number().positive('Pixel size obrigatório'),
  sensorWidthPx:    z.coerce.number().int().positive('Largura obrigatória'),
  sensorHeightPx:   z.coerce.number().int().positive('Altura obrigatória'),
  fullWellCapacity: z.coerce.number().positive().optional().or(z.literal('')).transform(v => v === '' ? undefined : Number(v)),
  readNoiseE:       z.coerce.number().positive().optional().or(z.literal('')).transform(v => v === '' ? undefined : Number(v)),
  qeMax:            z.coerce.number().min(0).max(100).optional().or(z.literal('')).transform(v => v === '' ? undefined : Number(v)),
  cooled:           z.boolean().default(false),
  weightKg:         z.coerce.number().positive().optional().or(z.literal('')).transform(v => v === '' ? undefined : Number(v)),
  notes:            z.string().optional(),
})

type FormValues = z.input<typeof schema>

export type CameraInitial = {
  id: string; name: string; brand?: string | null; model?: string | null
  colorType: 'COLOR' | 'MONO' | 'DSLR'; sensorName?: string | null
  pixelSizeUm: number; sensorWidthPx: number; sensorHeightPx: number
  fullWellCapacity?: number | null; readNoiseE?: number | null
  qeMax?: number | null; cooled: boolean; weightKg?: number | null
  notes?: string | null
}

export type CameraPrefill = {
  name?: string; brand?: string; model?: string
  colorType?: 'COLOR' | 'MONO' | 'DSLR'; sensorName?: string
  pixelSizeUm?: number; sensorWidthPx?: number; sensorHeightPx?: number; cooled?: boolean
}

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  initial?: CameraInitial
  prefill?: CameraPrefill   // cria já preenchido (sem id) — ex.: detectado do header FITS
}

export function CameraForm({ open, onOpenChange, initial, prefill }: Props) {
  const isEdit = !!initial
  const { toast } = useToast()
  const utils = api.useUtils()

  const { register, handleSubmit, reset, watch, formState: { errors, isSubmitting } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { colorType: 'COLOR', cooled: false },
  })

  const px = Number(watch('pixelSizeUm'))
  const w  = Number(watch('sensorWidthPx'))
  const h  = Number(watch('sensorHeightPx'))
  const canComputeSensor = px > 0 && w > 0 && h > 0

  useEffect(() => {
    if (open) {
      reset(initial ? {
        name:             initial.name,
        brand:            initial.brand ?? '',
        model:            initial.model ?? '',
        colorType:        initial.colorType,
        sensorName:       initial.sensorName ?? '',
        pixelSizeUm:      initial.pixelSizeUm,
        sensorWidthPx:    initial.sensorWidthPx,
        sensorHeightPx:   initial.sensorHeightPx,
        fullWellCapacity: initial.fullWellCapacity ?? '',
        readNoiseE:       initial.readNoiseE ?? '',
        qeMax:            initial.qeMax ?? '',
        cooled:           initial.cooled,
        weightKg:         initial.weightKg ?? '',
        notes:            initial.notes ?? '',
      } : prefill ? {
        name:           prefill.name ?? '',
        brand:          prefill.brand ?? '',
        model:          prefill.model ?? '',
        colorType:      prefill.colorType ?? 'COLOR',
        sensorName:     prefill.sensorName ?? '',
        cooled:         prefill.cooled ?? false,
        ...(prefill.pixelSizeUm    != null && { pixelSizeUm:    prefill.pixelSizeUm }),
        ...(prefill.sensorWidthPx  != null && { sensorWidthPx:  prefill.sensorWidthPx }),
        ...(prefill.sensorHeightPx != null && { sensorHeightPx: prefill.sensorHeightPx }),
      } : { colorType: 'COLOR', cooled: false })
    }
  }, [open, initial?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const invalidate = () => utils.cameras.list.invalidate()

  const create = api.cameras.create.useMutation({
    onSuccess: () => { invalidate(); toast('Câmera adicionada!'); reset(); onOpenChange(false) },
    onError: (e) => toast(e.message, 'error'),
  })

  const update = api.cameras.update.useMutation({
    onSuccess: () => { invalidate(); toast('Câmera atualizada!'); onOpenChange(false) },
    onError: (e) => toast(e.message, 'error'),
  })

  function onSubmit(data: FormValues) {
    if (isEdit) {
      update.mutate({ id: initial!.id, ...(data as any) })
    } else {
      create.mutate(data as any)
    }
  }

  return (
    <Modal open={open} onOpenChange={onOpenChange} title={isEdit ? 'Editar Câmera' : 'Adicionar Câmera'}>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <label className="input-label">Nome *</label>
            <input {...register('name')} className="input" placeholder="Ex: ZWO ASI2600MM" />
            {errors.name && <p className="input-error">{errors.name.message}</p>}
          </div>
          <div>
            <label className="input-label">Marca</label>
            <input {...register('brand')} className="input" placeholder="ZWO" />
          </div>
          <div>
            <label className="input-label">Modelo</label>
            <input {...register('model')} className="input" placeholder="ASI2600MM Pro" />
          </div>
          <div>
            <label className="input-label">Tipo *</label>
            <select {...register('colorType')} className="input">
              <option value="MONO">Mono</option>
              <option value="COLOR">Color (OSC)</option>
              <option value="DSLR">DSLR</option>
            </select>
          </div>
          <div>
            <label className="input-label">Sensor</label>
            <input {...register('sensorName')} className="input" placeholder="IMX571" />
          </div>
          <div>
            <label className="input-label">Pixel size (µm) *</label>
            <input {...register('pixelSizeUm')} type="number" step="0.01" className="input" placeholder="3.76" />
            {errors.pixelSizeUm && <p className="input-error">{errors.pixelSizeUm.message}</p>}
          </div>
          <div>
            <label className="input-label">Largura (px) *</label>
            <input {...register('sensorWidthPx')} type="number" step="1" className="input" placeholder="6248" />
            {errors.sensorWidthPx && <p className="input-error">{errors.sensorWidthPx.message}</p>}
          </div>
          <div>
            <label className="input-label">Altura (px) *</label>
            <input {...register('sensorHeightPx')} type="number" step="1" className="input" placeholder="4176" />
            {errors.sensorHeightPx && <p className="input-error">{errors.sensorHeightPx.message}</p>}
          </div>

          {/* Parâmetros do sensor calculados automaticamente */}
          {canComputeSensor && (
            <div className="col-span-2 grid grid-cols-3 gap-2">
              <div className="p-2.5 rounded-lg bg-white/3 border border-white/8">
                <p className="text-[10px] text-white/50 uppercase tracking-wider mb-0.5">Megapixels</p>
                <p className="text-sm font-mono font-medium text-white/80">{(w * h / 1_000_000).toFixed(1)} MP</p>
              </div>
              <div className="p-2.5 rounded-lg bg-white/3 border border-white/8">
                <p className="text-[10px] text-white/50 uppercase tracking-wider mb-0.5">Sensor (mm)</p>
                <p className="text-sm font-mono font-medium text-white/80">
                  {(w * px / 1000).toFixed(1)} × {(h * px / 1000).toFixed(1)}
                </p>
              </div>
              <div className="p-2.5 rounded-lg bg-white/3 border border-white/8">
                <p className="text-[10px] text-white/50 uppercase tracking-wider mb-0.5">FITS 16-bit</p>
                <p className="text-sm font-mono font-medium text-white/80">~{(w * h * 2 / 1_000_000).toFixed(0)} MB</p>
              </div>
            </div>
          )}
          <div>
            <label className="input-label">Read noise (e⁻)</label>
            <input {...register('readNoiseE')} type="number" step="0.1" className="input" placeholder="3.3" />
          </div>
          <div>
            <label className="input-label">Full well (e⁻)</label>
            <input {...register('fullWellCapacity')} type="number" step="100" className="input" placeholder="50000" />
          </div>
          <div>
            <label className="input-label">QE máx (%)</label>
            <input {...register('qeMax')} type="number" step="1" className="input" placeholder="91" />
          </div>
          <div>
            <label className="input-label">Peso (kg)</label>
            <input {...register('weightKg')} type="number" step="0.1" className="input" placeholder="0.8" />
          </div>
          <div className="col-span-2 flex items-center gap-2">
            <input {...register('cooled')} type="checkbox" id="cooled" className="rounded" />
            <label htmlFor="cooled" className="text-sm text-white/70">Câmera resfriada (TEC)</label>
          </div>
          <div className="col-span-2">
            <label className="input-label">Notas</label>
            <textarea {...register('notes')} className="input" rows={2} placeholder="Observações…" />
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" className="btn-secondary" onClick={() => onOpenChange(false)}>Cancelar</button>
          <button type="submit" className="btn-primary" disabled={isSubmitting}>
            {isSubmitting ? 'Salvando…' : isEdit ? 'Salvar' : 'Adicionar'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
