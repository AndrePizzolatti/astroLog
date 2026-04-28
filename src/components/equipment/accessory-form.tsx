'use client'

import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { api } from '@/lib/trpc'
import { useToast } from '@/components/ui/toast'
import { Modal } from '@/components/ui/modal'

export const ACCESSORY_TYPE_LABELS: Record<string, string> = {
  REDUCER_FLATTENER: 'Redutor / Flatner',
  BARLOW:            'Barlow',
  OAG:               'OAG',
  FILTER_WHEEL:      'Roda de filtros',
  FOCUSER:           'Focalizador',
  ROTATOR:           'Rotador',
  DEW_HEATER:        'Resistência antiembaçante',
  FILTER_INDIVIDUAL: 'Filtro individual',
  OTHER:             'Outro',
}

const ACCESSORY_TYPES = Object.keys(ACCESSORY_TYPE_LABELS) as [string, ...string[]]

const schema = z.object({
  name:        z.string().min(2, 'Nome obrigatório'),
  type:        z.enum(ACCESSORY_TYPES as [string, ...string[]]),
  brand:       z.string().optional(),
  model:       z.string().optional(),
  focalFactor: z.coerce.number().positive().optional().or(z.literal('')).transform(v => v === '' ? undefined : Number(v)),
  notes:       z.string().optional(),
})

type FormValues = z.input<typeof schema>

export type AccessoryInitial = {
  id: string; name: string; type: string; brand?: string | null
  model?: string | null; focalFactor?: number | null; notes?: string | null
}

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  initial?: AccessoryInitial
}

export function AccessoryForm({ open, onOpenChange, initial }: Props) {
  const isEdit = !!initial
  const { toast } = useToast()
  const utils = api.useUtils()

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { type: 'OTHER' },
  })

  useEffect(() => {
    if (open) {
      reset(initial ? {
        name:        initial.name,
        type:        initial.type,
        brand:       initial.brand ?? '',
        model:       initial.model ?? '',
        focalFactor: initial.focalFactor ?? '',
        notes:       initial.notes ?? '',
      } : { type: 'OTHER' })
    }
  }, [open, initial?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const invalidate = () => utils.accessories.list.invalidate()

  const create = api.accessories.create.useMutation({
    onSuccess: () => { invalidate(); toast('Acessório adicionado!'); reset(); onOpenChange(false) },
    onError: (e) => toast(e.message, 'error'),
  })

  const update = api.accessories.update.useMutation({
    onSuccess: () => { invalidate(); toast('Acessório atualizado!'); onOpenChange(false) },
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
    <Modal open={open} onOpenChange={onOpenChange} title={isEdit ? 'Editar Acessório' : 'Adicionar Acessório'}>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <label className="input-label">Nome *</label>
            <input {...register('name')} className="input" placeholder="Ex: Starizona Nexus 0.75×" />
            {errors.name && <p className="input-error">{errors.name.message}</p>}
          </div>
          <div className="col-span-2">
            <label className="input-label">Tipo *</label>
            <select {...register('type')} className="input">
              {Object.entries(ACCESSORY_TYPE_LABELS).map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </select>
            {errors.type && <p className="input-error">{errors.type.message}</p>}
          </div>
          <div>
            <label className="input-label">Marca</label>
            <input {...register('brand')} className="input" placeholder="Starizona" />
          </div>
          <div>
            <label className="input-label">Modelo</label>
            <input {...register('model')} className="input" placeholder="Nexus II" />
          </div>
          <div className="col-span-2">
            <label className="input-label">Fator focal</label>
            <input {...register('focalFactor')} type="number" step="0.01" className="input" placeholder="0.75 para redutor, 2.0 para barlow" />
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
