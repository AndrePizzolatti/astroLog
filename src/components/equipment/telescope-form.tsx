'use client'

import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { api } from '@/lib/trpc'
import { useToast } from '@/components/ui/toast'
import { Modal } from '@/components/ui/modal'

const schema = z.object({
  name:          z.string().min(2, 'Nome obrigatório'),
  brand:         z.string().optional(),
  model:         z.string().optional(),
  opticalDesign: z.string().optional(),
  focalLengthMm: z.coerce.number().positive('Focal obrigatória'),
  apertureMm:    z.coerce.number().positive('Abertura obrigatória'),
  obstruction:   z.coerce.number().min(0).max(100).optional().or(z.literal('')).transform(v => v === '' ? undefined : Number(v)),
  weightKg:      z.coerce.number().positive().optional().or(z.literal('')).transform(v => v === '' ? undefined : Number(v)),
  notes:         z.string().optional(),
})

type FormValues = z.input<typeof schema>

export type TelescopeInitial = {
  id: string; name: string; brand?: string | null; model?: string | null
  opticalDesign?: string | null; focalLengthMm: number; apertureMm: number
  focalRatioOverride?: number | null; obstruction?: number | null
  weightKg?: number | null; notes?: string | null
}

export type TelescopePrefill = {
  name?: string; brand?: string; model?: string; opticalDesign?: string
  focalLengthMm?: number; apertureMm?: number
}

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  initial?: TelescopeInitial
  prefill?: TelescopePrefill   // cria já preenchido (sem id) — ex.: detectado do header FITS
}

export function TelescopeForm({ open, onOpenChange, initial, prefill }: Props) {
  const isEdit = !!initial
  const { toast } = useToast()
  const utils = api.useUtils()

  const { register, handleSubmit, reset, watch, formState: { errors, isSubmitting } } = useForm<FormValues>({
    resolver: zodResolver(schema),
  })

  const fl = Number(watch('focalLengthMm'))
  const ap = Number(watch('apertureMm'))
  const canCompute = fl > 0 && ap > 0

  useEffect(() => {
    if (open) {
      reset(initial ? {
        name:          initial.name,
        brand:         initial.brand ?? '',
        model:         initial.model ?? '',
        opticalDesign: initial.opticalDesign ?? '',
        focalLengthMm: initial.focalLengthMm,
        apertureMm:    initial.apertureMm,
        obstruction:   initial.obstruction ?? '',
        weightKg:      initial.weightKg ?? '',
        notes:         initial.notes ?? '',
      } : prefill ? {
        name:          prefill.name ?? '',
        brand:         prefill.brand ?? '',
        model:         prefill.model ?? '',
        opticalDesign: prefill.opticalDesign ?? '',
        ...(prefill.focalLengthMm != null && { focalLengthMm: prefill.focalLengthMm }),
        ...(prefill.apertureMm    != null && { apertureMm:    prefill.apertureMm }),
      } : {})
    }
  }, [open, initial?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const invalidate = () => utils.telescopes.list.invalidate()

  const create = api.telescopes.create.useMutation({
    onSuccess: () => { invalidate(); toast('Telescópio adicionado!'); reset(); onOpenChange(false) },
    onError: (e) => toast(e.message, 'error'),
  })

  const update = api.telescopes.update.useMutation({
    onSuccess: () => { invalidate(); toast('Telescópio atualizado!'); onOpenChange(false) },
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
    <Modal open={open} onOpenChange={onOpenChange} title={isEdit ? 'Editar Telescópio' : 'Adicionar Telescópio'}>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <label className="input-label">Nome *</label>
            <input {...register('name')} className="input" placeholder="Ex: Celestron C8" />
            {errors.name && <p className="input-error">{errors.name.message}</p>}
          </div>
          <div>
            <label className="input-label">Marca</label>
            <input {...register('brand')} className="input" placeholder="Celestron" />
          </div>
          <div>
            <label className="input-label">Modelo</label>
            <input {...register('model')} className="input" placeholder="C8 XLT" />
          </div>
          <div>
            <label className="input-label">Design óptico</label>
            <input {...register('opticalDesign')} className="input" placeholder="SCT, Refrator, Newton…" />
          </div>
          <div>
            <label className="input-label">Focal (mm) *</label>
            <input {...register('focalLengthMm')} type="number" step="1" className="input" placeholder="2032" />
            {errors.focalLengthMm && <p className="input-error">{errors.focalLengthMm.message}</p>}
          </div>
          <div>
            <label className="input-label">Abertura (mm) *</label>
            <input {...register('apertureMm')} type="number" step="1" className="input" placeholder="203" />
            {errors.apertureMm && <p className="input-error">{errors.apertureMm.message}</p>}
          </div>

          {/* Parâmetros ópticos calculados automaticamente */}
          {canCompute && (
            <div className="col-span-2 grid grid-cols-2 gap-2">
              <div className="p-2.5 rounded-lg bg-white/3 border border-white/8">
                <p className="text-[10px] text-white/35 uppercase tracking-wider mb-0.5">Razão Focal</p>
                <p className="text-sm font-mono font-medium text-white/80">f/{(fl / ap).toFixed(1)}</p>
              </div>
              <div className="p-2.5 rounded-lg bg-white/3 border border-white/8">
                <p className="text-[10px] text-white/35 uppercase tracking-wider mb-0.5">Limite de Dawes</p>
                <p className="text-sm font-mono font-medium text-white/80">{(116 / ap).toFixed(2)}"</p>
              </div>
            </div>
          )}

          <div>
            <label className="input-label">Obstrução (%)</label>
            <input {...register('obstruction')} type="number" step="1" className="input" placeholder="33" />
          </div>
          <div>
            <label className="input-label">Peso (kg)</label>
            <input {...register('weightKg')} type="number" step="0.1" className="input" placeholder="5.4" />
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
