'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { FileJson, AlertCircle, Check, Sparkles, Telescope } from 'lucide-react'
import { api } from '@/lib/trpc'
import { cn, formatIntegration, filterPillClass } from '@/lib/utils'
import { parseNINASequence, totalIntegrationMin, type NINATarget } from '@/lib/nina-sequence-parser'
import { useToast } from '@/components/ui/toast'
import { Modal } from '@/components/ui/modal'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
}

type State =
  | { status: 'idle' }
  | { status: 'review'; targets: NINATarget[]; fileName: string }
  | { status: 'error'; message: string }

function raToText(ra?: number): string | null {
  if (ra == null) return null
  const h = Math.floor(ra)
  const m = Math.floor((ra - h) * 60)
  const s = Math.round(((ra - h) * 60 - m) * 60)
  return `${h}h ${m}m ${s}s`
}

function decToText(dec?: number): string | null {
  if (dec == null) return null
  const sign = dec < 0 ? '-' : '+'
  const a = Math.abs(dec)
  const d = Math.floor(a)
  const m = Math.round((a - d) * 60)
  return `${sign}${d}° ${m}′`
}

export function NINASequenceImport({ open, onOpenChange }: Props) {
  const { toast } = useToast()
  const router = useRouter()
  const utils = api.useUtils()
  const { data: setups } = api.setups.list.useQuery()

  const [state, setState]         = useState<State>({ status: 'idle' })
  const [dragging, setDragging]   = useState(false)
  const [setupId, setSetupId]     = useState<string>('')
  const [createSessions, setCreateSessions] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const createProject = api.projects.create.useMutation()
  const bulkCreate    = api.sessions.bulkCreate.useMutation()

  useEffect(() => {
    if (open && !setupId && setups?.length) {
      setSetupId(setups.find(s => s.isDefault)?.id ?? '')
    }
  }, [open, setups, setupId])

  function resetAll() {
    setState({ status: 'idle' })
    setSubmitting(false)
  }

  async function handleFile(file: File) {
    if (!/\.json$/i.test(file.name)) {
      setState({ status: 'error', message: 'Selecione um arquivo .json do Advanced Sequencer do N.I.N.A.' })
      return
    }
    try {
      const json = JSON.parse(await file.text())
      const targets = parseNINASequence(json)
      if (targets.length === 0) {
        setState({ status: 'error', message: 'Nenhum alvo com exposições reconhecido neste arquivo.' })
        return
      }
      setState({ status: 'review', targets, fileName: file.name })
    } catch {
      setState({ status: 'error', message: 'Arquivo inválido — não foi possível ler o JSON.' })
    }
  }

  function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (file) handleFile(file)
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }

  async function confirm() {
    if (state.status !== 'review') return
    setSubmitting(true)
    try {
      let firstId: string | null = null
      const nowIso = new Date().toISOString()

      for (const t of state.targets) {
        const project = await createProject.mutateAsync({
          name:         t.name,
          targetObject: t.name,
          status:       'PLANNING',
          setupId:      setupId || undefined,
          raHours:      t.ra ?? undefined,
          decDegrees:   t.dec ?? undefined,
          description:  `Importado do N.I.N.A. — ${t.exposures.length} filtro(s), ${formatIntegration(totalIntegrationMin(t))} planejado.`,
        })
        if (!firstId) firstId = project.id

        if (createSessions && t.exposures.length > 0) {
          await bulkCreate.mutateAsync({
            projectId: project.id,
            setupId:   setupId || undefined,
            sessions: t.exposures.map(e => ({
              observedAt:      nowIso,
              filterUsed:      e.filter,
              lightsCount:     0,
              exposureSeconds: e.exposureSeconds,
              gain:            e.gain,
              offset:          e.offset,
              binning:         e.binning,
              notes:           `Planejado via N.I.N.A.: ${e.count}× ${e.exposureSeconds}s`,
            })),
          })
        }
      }

      utils.projects.list.invalidate()
      toast(`${state.targets.length} projeto(s) criado(s)!`)
      resetAll()
      onOpenChange(false)
      if (firstId && state.targets.length === 1) router.push(`/dashboard/projects/${firstId}`)
    } catch (e: any) {
      toast(e.message ?? 'Erro ao importar', 'error')
      setSubmitting(false)
    }
  }

  const targets = state.status === 'review' ? state.targets : []

  return (
    <Modal
      open={open}
      onOpenChange={v => { if (!v) resetAll(); onOpenChange(v) }}
      title="Importar sequência N.I.N.A."
      description="Solte o .json do Advanced Sequencer — cria o projeto já com alvo, coordenadas e plano de captura"
      className="max-w-2xl"
    >
      {(state.status === 'idle' || state.status === 'error') && (
        <div className="space-y-3">
          <div
            onDragOver={e => { e.preventDefault(); setDragging(true) }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            onClick={() => inputRef.current?.click()}
            className={cn(
              'flex flex-col items-center justify-center gap-3 p-10 rounded-xl border border-dashed cursor-pointer transition-colors text-center',
              dragging ? 'border-aurora-400/60 bg-aurora-400/8' : 'border-white/15 bg-white/2 hover:border-white/25',
            )}
          >
            <FileJson className={cn('w-8 h-8', dragging ? 'text-aurora-400' : 'text-white/25')} />
            <p className={cn('text-sm', dragging ? 'text-aurora-300' : 'text-white/60')}>
              Arraste o arquivo .json da sequência
            </p>
            <p className="text-[11px] text-white/25">Lido localmente, sem upload</p>
            <input ref={inputRef} type="file" accept=".json,application/json" className="hidden" onChange={onPick} />
          </div>

          {state.status === 'error' && (
            <div className="flex items-start gap-3 p-3 rounded-lg bg-red-400/8 border border-red-400/20">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <p className="text-xs text-red-300 flex-1">{state.message}</p>
            </div>
          )}
        </div>
      )}

      {state.status === 'review' && (
        <div className="space-y-4">
          <p className="text-[11px] text-white/35 truncate flex items-center gap-1.5">
            <FileJson className="w-3 h-3 shrink-0" /> {state.fileName}
          </p>

          {/* Setup */}
          <div>
            <label className="input-label">Setup do projeto</label>
            <select className="input" value={setupId} onChange={e => setSetupId(e.target.value)}>
              <option value="">Nenhum</option>
              {setups?.map(s => (
                <option key={s.id} value={s.id}>{s.name}{s.isDefault ? ' ★' : ''}</option>
              ))}
            </select>
          </div>

          {/* Targets */}
          <div className="space-y-3 max-h-72 overflow-y-auto">
            {targets.map((t, i) => (
              <div key={i} className="card p-3">
                <div className="flex items-center gap-2 flex-wrap mb-2">
                  <Telescope className="w-3.5 h-3.5 text-cosmos-400 shrink-0" />
                  <span className="text-sm font-medium text-white">{t.name}</span>
                  {raToText(t.ra) && (
                    <span className="text-[10px] mono text-white/35">{raToText(t.ra)} · {decToText(t.dec)}</span>
                  )}
                  <span className="ml-auto text-[11px] mono text-aurora-300">{formatIntegration(totalIntegrationMin(t))}</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {t.exposures.map((e, j) => (
                    <span key={j} className="flex items-center gap-1 px-2 py-0.5 rounded bg-white/4 border border-white/8 text-[10px]">
                      {e.filter
                        ? <span className={cn('px-1 rounded font-mono font-bold', filterPillClass(e.filter))}>{e.filter}</span>
                        : <span className="text-white/40">—</span>}
                      <span className="mono text-white/60">{e.count}× {e.exposureSeconds}s</span>
                      {e.gain != null && <span className="mono text-white/30">G{e.gain}</span>}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Option */}
          <label className="flex items-center gap-2.5 cursor-pointer select-none">
            <span
              onClick={() => setCreateSessions(v => !v)}
              className={cn(
                'w-3.5 h-3.5 rounded border-2 flex items-center justify-center shrink-0',
                createSessions ? 'bg-aurora-400 border-aurora-400' : 'border-white/30',
              )}
            >
              {createSessions && <Check className="w-2.5 h-2.5 text-cosmos-950" />}
            </span>
            <span className="text-xs text-white/60" onClick={() => setCreateSessions(v => !v)}>
              Criar sessões planejadas (0 lights — preenchidas ao capturar)
            </span>
          </label>

          <div className="flex items-center justify-between flex-wrap gap-3 pt-1">
            <p className="text-xs text-white/50 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-aurora-400" />
              {targets.length} projeto{targets.length !== 1 ? 's' : ''} a criar
            </p>
            <div className="flex gap-2">
              <button type="button" className="btn-secondary" onClick={resetAll}>Recomeçar</button>
              <button type="button" className="btn-primary" disabled={submitting} onClick={confirm}>
                {submitting ? 'Criando…' : 'Criar projeto' + (targets.length !== 1 ? 's' : '')}
              </button>
            </div>
          </div>
        </div>
      )}
    </Modal>
  )
}
