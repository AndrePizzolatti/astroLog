'use client'

import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Search, Loader2 } from 'lucide-react'
import { api } from '@/lib/trpc'
import { cn } from '@/lib/utils'
import { useToast } from '@/components/ui/toast'
import { Modal } from '@/components/ui/modal'
import { POPULAR_TARGETS } from '@/lib/popular-targets'

const schema = z.object({
  name:         z.string().min(2, 'Nome obrigatório'),
  targetObject: z.string().min(1, 'Objeto-alvo obrigatório'),
  targetType:   z.string().optional(),
  captureType:  z.enum(['DSO', 'PLANETARY']).default('DSO'),
  description:  z.string().optional(),
  setupId:      z.string().optional().transform(v => (v ? v : null)),
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

export type ProjectInitial = {
  id: string; name: string; targetObject: string; targetType?: string | null
  captureType?: string | null
  description?: string | null; setupId?: string | null; status: string
  visibility: string; raHours?: number | null; decDegrees?: number | null
}

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  initial?: ProjectInitial
}

export function ProjectForm({ open, onOpenChange, initial }: Props) {
  const isEdit = !!initial
  const { toast } = useToast()
  const utils = api.useUtils()
  const { data: setups } = api.setups.list.useQuery()

  const { register, handleSubmit, reset, setValue, getValues, watch, formState: { errors, isSubmitting } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { status: 'IN_PROGRESS', visibility: 'PRIVATE', captureType: 'DSO' },
  })

  const isPlanetary = watch('captureType') === 'PLANETARY'

  const resolve = api.catalog.resolve.useMutation()

  async function resolveTarget() {
    const name = (getValues('targetObject') || '').trim()
    if (!name) { toast('Digite o alvo primeiro', 'error'); return }
    try {
      const r = await resolve.mutateAsync({ name })
      if (!r) { toast(`Não encontrei "${name}" no catálogo`, 'error'); return }
      setValue('raHours', r.raHours as any, { shouldDirty: true })
      setValue('decDegrees', r.decDegrees as any, { shouldDirty: true })
      if (r.type && !(getValues('targetType') || '').trim()) setValue('targetType', r.type, { shouldDirty: true })
      toast('Coordenadas preenchidas via SIMBAD')
    } catch {
      toast('Falha ao consultar o catálogo', 'error')
    }
  }

  useEffect(() => {
    if (open) {
      reset(initial ? {
        name:         initial.name,
        targetObject: initial.targetObject,
        targetType:   initial.targetType ?? '',
        captureType:  (initial.captureType as any) ?? 'DSO',
        description:  initial.description ?? '',
        setupId:      initial.setupId ?? '',
        status:       initial.status as any,
        visibility:   initial.visibility as any,
        raHours:      initial.raHours ?? '',
        decDegrees:   initial.decDegrees ?? '',
      } : { status: 'IN_PROGRESS', visibility: 'PRIVATE', captureType: 'DSO' })
    }
  }, [open, initial?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const invalidate = () => {
    utils.projects.list.invalidate()
    if (isEdit) utils.projects.byId.invalidate({ id: initial!.id })
  }

  const create = api.projects.create.useMutation({
    onSuccess: () => { invalidate(); toast('Projeto criado!'); reset(); onOpenChange(false) },
    onError: (e) => toast(e.message, 'error'),
  })

  const update = api.projects.update.useMutation({
    onSuccess: () => { invalidate(); toast('Projeto atualizado!'); onOpenChange(false) },
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
    <Modal open={open} onOpenChange={onOpenChange}
      title={isEdit ? 'Editar Projeto' : 'Novo Projeto'}
      description={isEdit ? undefined : 'Defina o alvo e o setup para seu projeto de astrofotografia'}>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <label className="input-label">Nome do projeto *</label>
            <input {...register('name')} className="input" placeholder="Ex: M42 — Nebulosa de Orion" />
            {errors.name && <p className="input-error">{errors.name.message}</p>}
          </div>
          <div className="col-span-2">
            <label className="input-label">Tipo de captura</label>
            <div className="flex items-center gap-1 bg-white/5 p-0.5 rounded-lg w-fit">
              {(['DSO', 'PLANETARY'] as const).map(ct => (
                <button key={ct} type="button" onClick={() => setValue('captureType', ct, { shouldDirty: true })}
                  className={cn('px-3 py-1 rounded-md text-xs font-medium', (watch('captureType') ?? 'DSO') === ct ? 'bg-cosmos-500 text-white' : 'text-white/50')}>
                  {ct === 'DSO' ? 'Céu profundo (DSO)' : 'Planetária'}
                </button>
              ))}
            </div>
          </div>
          <div className="col-span-2">
            <label className="input-label">Objeto-alvo *</label>
            <div className="flex gap-2">
              <input {...register('targetObject')} list={isPlanetary ? undefined : 'popular-targets'} className="input flex-1"
                placeholder={isPlanetary ? 'Júpiter, Saturno, Lua…' : 'M42, NGC 7293, IC 5070…'} />
              {!isPlanetary && (
                <button type="button" onClick={resolveTarget} disabled={resolve.isPending}
                  className="btn-secondary flex items-center gap-1.5 shrink-0" title="Buscar coordenadas (SIMBAD)">
                  {resolve.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
                  Resolver
                </button>
              )}
            </div>
            {!isPlanetary && (
              <>
                <datalist id="popular-targets">{POPULAR_TARGETS.map(t => <option key={t} value={t} />)}</datalist>
                <p className="text-[11px] text-white/30 mt-1">Digite o nome e clique em Resolver pra preencher tipo, AR e Dec automaticamente.</p>
              </>
            )}
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
          {!isPlanetary && (
            <>
              <div>
                <label className="input-label">AR (horas)</label>
                <input {...register('raHours')} type="number" step="any" className="input" placeholder="5.589" />
              </div>
              <div>
                <label className="input-label">Dec (graus)</label>
                <input {...register('decDegrees')} type="number" step="any" className="input" placeholder="-5.391" />
              </div>
            </>
          )}
          <div className="col-span-2">
            <label className="input-label">Descrição</label>
            <textarea {...register('description')} className="input" rows={2} placeholder="Objetivos, desafios, notas…" />
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" className="btn-secondary" onClick={() => onOpenChange(false)}>Cancelar</button>
          <button type="submit" className="btn-primary" disabled={isSubmitting}>
            {isSubmitting ? 'Salvando…' : isEdit ? 'Salvar' : 'Criar Projeto'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
