'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { api } from '@/lib/trpc'
import { useToast } from '@/components/ui/toast'
import { Modal } from '@/components/ui/modal'

const schema = z.object({
  name:               z.string().min(2, 'Nome obrigatório'),
  brand:              z.string().optional(),
  model:              z.string().optional(),
  opticalDesign:      z.string().optional(),
  focalLengthMm:      z.coerce.number().positive('Focal obrigatória'),
  apertureMm:         z.coerce.number().positive('Abertura obrigatória'),
  focalRatioOverride: z.coerce.number().positive().optional().or(z.literal('')).transform(v => v === '' ? undefined : Number(v)),
  obstruction:        z.coerce.number().min(0).max(100).optional().or(z.literal('')).transform(v => v === '' ? undefined : Number(v)),
  weightKg:           z.coerce.number().positive().optional().or(z.literal('')).transform(v => v === '' ? undefined : Number(v)),
  notes:              z.string().optional(),
})

type FormValues = z.input<typeof schema>

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function TelescopeForm({ open, onOpenChange }: Props) {
  const { toast } = useToast()
  const utils = api.useUtils()

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<FormValues>({
    resolver: zodResolver(schema),
  })

  const create = api.telescopes.create.useMutation({
    onSuccess: () => {
      utils.telescopes.list.invalidate()
      toast('Telescópio adicionado!')
      reset()
      onOpenChange(false)
    },
    onError: (e) => toast(e.message, 'error'),
  })

  return (
    <Modal open={open} onOpenChange={onOpenChange} title="Adicionar Telescópio">
      <form onSubmit={handleSubmit(d => create.mutate(d as any))} className="space-y-4">
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
          <div>
            <label className="input-label">f/ override</label>
            <input {...register('focalRatioOverride')} type="number" step="0.1" className="input" placeholder="10" />
          </div>
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
            {isSubmitting ? 'Salvando…' : 'Adicionar'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
