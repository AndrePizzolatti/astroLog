'use client'

import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { api } from '@/lib/trpc'
import { useToast } from '@/components/ui/toast'
import { Modal } from '@/components/ui/modal'

const MOUNT_TYPE_LABELS = {
  EQ: 'Equatorial', ALT_AZ: 'Alt-azimutal', DOBSONIAN: 'Dobsonian',
  FORK: 'Fork', TRACKING: 'Plataforma equatorial',
}

const schema = z.object({
  name:           z.string().min(2, 'Nome obrigatório'),
  brand:          z.string().optional(),
  model:          z.string().optional(),
  mountType:      z.enum(['EQ', 'ALT_AZ', 'DOBSONIAN', 'FORK', 'TRACKING']).default('EQ'),
  payloadKg:      z.coerce.number().positive().optional().or(z.literal('')).transform(v => v === '' ? undefined : Number(v)),
  hasGuidingPort: z.boolean().default(true),
  hasPolarScope:  z.boolean().default(false),
  weightKg:       z.coerce.number().positive().optional().or(z.literal('')).transform(v => v === '' ? undefined : Number(v)),
  notes:          z.string().optional(),
})

type FormValues = z.input<typeof schema>

export type MountInitial = {
  id: string; name: string; brand?: string | null; model?: string | null
  mountType: 'EQ' | 'ALT_AZ' | 'DOBSONIAN' | 'FORK' | 'TRACKING'
  payloadKg?: number | null; hasGuidingPort: boolean; hasPolarScope: boolean
  weightKg?: number | null; notes?: string | null
}

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  initial?: MountInitial
}

export function MountForm({ open, onOpenChange, initial }: Props) {
  const isEdit = !!initial
  const { toast } = useToast()
  const utils = api.useUtils()

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { mountType: 'EQ', hasGuidingPort: true, hasPolarScope: false },
  })

  useEffect(() => {
    if (open) {
      reset(initial ? {
        name:           initial.name,
        brand:          initial.brand ?? '',
        model:          initial.model ?? '',
        mountType:      initial.mountType,
        payloadKg:      initial.payloadKg ?? '',
        hasGuidingPort: initial.hasGuidingPort,
        hasPolarScope:  initial.hasPolarScope,
        weightKg:       initial.weightKg ?? '',
        notes:          initial.notes ?? '',
      } : { mountType: 'EQ', hasGuidingPort: true, hasPolarScope: false })
    }
  }, [open, initial?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const invalidate = () => utils.mounts.list.invalidate()

  const create = api.mounts.create.useMutation({
    onSuccess: () => { invalidate(); toast('Montagem adicionada!'); reset(); onOpenChange(false) },
    onError: (e) => toast(e.message, 'error'),
  })

  const update = api.mounts.update.useMutation({
    onSuccess: () => { invalidate(); toast('Montagem atualizada!'); onOpenChange(false) },
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
    <Modal open={open} onOpenChange={onOpenChange} title={isEdit ? 'Editar Montagem' : 'Adicionar Montagem'}>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <label className="input-label">Nome *</label>
            <input {...register('name')} className="input" placeholder="Ex: Sky-Watcher EQ6-R Pro" />
            {errors.name && <p className="input-error">{errors.name.message}</p>}
          </div>
          <div>
            <label className="input-label">Marca</label>
            <input {...register('brand')} className="input" placeholder="Sky-Watcher" />
          </div>
          <div>
            <label className="input-label">Modelo</label>
            <input {...register('model')} className="input" placeholder="EQ6-R Pro" />
          </div>
          <div>
            <label className="input-label">Tipo *</label>
            <select {...register('mountType')} className="input">
              {Object.entries(MOUNT_TYPE_LABELS).map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="input-label">Payload máx (kg)</label>
            <input {...register('payloadKg')} type="number" step="any" className="input" placeholder="20" />
          </div>
          <div>
            <label className="input-label">Peso (kg)</label>
            <input {...register('weightKg')} type="number" step="any" className="input" placeholder="16" />
          </div>
          <div className="col-span-2 flex items-center gap-4">
            <label className="flex items-center gap-2 text-sm text-white/70">
              <input {...register('hasGuidingPort')} type="checkbox" className="rounded" />
              Porta de guiagem
            </label>
            <label className="flex items-center gap-2 text-sm text-white/70">
              <input {...register('hasPolarScope')} type="checkbox" className="rounded" />
              Polar scope
            </label>
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
