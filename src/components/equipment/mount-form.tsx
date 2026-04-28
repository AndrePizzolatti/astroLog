'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { api } from '@/lib/trpc'
import { useToast } from '@/components/ui/toast'
import { Modal } from '@/components/ui/modal'

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

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
}

const MOUNT_TYPE_LABELS = {
  EQ: 'Equatorial', ALT_AZ: 'Alt-azimutal', DOBSONIAN: 'Dobsonian',
  FORK: 'Fork', TRACKING: 'Plataforma equatorial',
}

export function MountForm({ open, onOpenChange }: Props) {
  const { toast } = useToast()
  const utils = api.useUtils()

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { mountType: 'EQ', hasGuidingPort: true, hasPolarScope: false },
  })

  const create = api.mounts.create.useMutation({
    onSuccess: () => {
      utils.mounts.list.invalidate()
      toast('Montagem adicionada!')
      reset()
      onOpenChange(false)
    },
    onError: (e) => toast(e.message, 'error'),
  })

  return (
    <Modal open={open} onOpenChange={onOpenChange} title="Adicionar Montagem">
      <form onSubmit={handleSubmit(d => create.mutate(d as any))} className="space-y-4">
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
            <input {...register('payloadKg')} type="number" step="0.5" className="input" placeholder="20" />
          </div>
          <div>
            <label className="input-label">Peso (kg)</label>
            <input {...register('weightKg')} type="number" step="0.1" className="input" placeholder="16" />
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
            {isSubmitting ? 'Salvando…' : 'Adicionar'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
