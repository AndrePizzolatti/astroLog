'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { api } from '@/lib/trpc'
import { useToast } from '@/components/ui/toast'
import { Modal } from '@/components/ui/modal'

const schema = z.object({
  name:         z.string().min(2, 'Nome obrigatório'),
  targetObject: z.string().min(1, 'Objeto-alvo obrigatório'),
  targetType:   z.string().optional(),
  description:  z.string().optional(),
  setupId:      z.string().optional(),
  status:       z.enum(['PLANNING','IN_PROGRESS','READY_TO_PROCESS','PROCESSING','COMPLETED','ARCHIVED']).default('IN_PROGRESS'),
  visibility:   z.enum(['PRIVATE','FRIENDS','PUBLIC']).default('PRIVATE'),
  raHours:      z.coerce.number().min(0).max(24).optional().or(z.literal('')).transform(v => v === '' ? undefined : Number(v)),
  decDegrees:   z.coerce.number().min(-90).max(90).optional().or(z.literal('')).transform(v => v === '' ? undefined : Number(v)),
})

type FormValues = z.input<typeof schema>

const STATUS_OPTIONS = [
  { value: 'PLANNING',         label: 'Planejamento' },
  { value: 'IN_PROGRESS',      label: 'Em andamento' },
  { value: 'READY_TO_PROCESS', label: 'Pronto p/ processar' },
  { value: 'PROCESSING',       label: 'Processando' },
  { value: 'COMPLETED',        label: 'Concluído' },
  { value: 'ARCHIVED',         label: 'Arquivado' },
]

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ProjectForm({ open, onOpenChange }: Props) {
  const { toast } = useToast()
  const utils = api.useUtils()
  const { data: setups } = api.setups.list.useQuery()

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { status: 'IN_PROGRESS', visibility: 'PRIVATE' },
  })

  const create = api.projects.create.useMutation({
    onSuccess: () => {
      utils.projects.list.invalidate()
      toast('Projeto criado!')
      reset()
      onOpenChange(false)
    },
    onError: (e) => toast(e.message, 'error'),
  })

  return (
    <Modal open={open} onOpenChange={onOpenChange} title="Novo Projeto" description="Defina o alvo e o setup para seu projeto de astrofotografia">
      <form onSubmit={handleSubmit(d => create.mutate(d as any))} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <label className="input-label">Nome do projeto *</label>
            <input {...register('name')} className="input" placeholder="Ex: M42 — Nebulosa de Orion" />
            {errors.name && <p className="input-error">{errors.name.message}</p>}
          </div>
          <div className="col-span-2">
            <label className="input-label">Objeto-alvo *</label>
            <input {...register('targetObject')} className="input" placeholder="M42, NGC 7293, IC 5070…" />
            {errors.targetObject && <p className="input-error">{errors.targetObject.message}</p>}
          </div>
          <div>
            <label className="input-label">Tipo de objeto</label>
            <input {...register('targetType')} className="input" placeholder="Nebulosa, Galáxia, Cluster…" />
          </div>
          <div>
            <label className="input-label">Setup</label>
            <select {...register('setupId')} className="input">
              <option value="">Sem setup</option>
              {setups?.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div>
            <label className="input-label">Status</label>
            <select {...register('status')} className="input">
              {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <div>
            <label className="input-label">Visibilidade</label>
            <select {...register('visibility')} className="input">
              <option value="PRIVATE">Privado</option>
              <option value="FRIENDS">Amigos</option>
              <option value="PUBLIC">Público</option>
            </select>
          </div>
          <div>
            <label className="input-label">AR (horas)</label>
            <input {...register('raHours')} type="number" step="0.001" className="input" placeholder="5.589" />
          </div>
          <div>
            <label className="input-label">Dec (graus)</label>
            <input {...register('decDegrees')} type="number" step="0.001" className="input" placeholder="-5.391" />
          </div>
          <div className="col-span-2">
            <label className="input-label">Descrição</label>
            <textarea {...register('description')} className="input" rows={2} placeholder="Objetivos, desafios, notas…" />
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" className="btn-secondary" onClick={() => onOpenChange(false)}>Cancelar</button>
          <button type="submit" className="btn-primary" disabled={isSubmitting}>
            {isSubmitting ? 'Criando…' : 'Criar Projeto'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
