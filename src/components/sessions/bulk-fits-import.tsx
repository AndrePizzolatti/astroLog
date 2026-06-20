'use client'

import { useEffect, useRef, useState } from 'react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { FolderUp, FileUp, Loader2, AlertCircle, Check, Sparkles } from 'lucide-react'
import { api } from '@/lib/trpc'
import { cn, formatIntegration, filterPillClass } from '@/lib/utils'
import { parseImageHeader, detectFileType, parseFilename } from '@/lib/fits-parser'
import { groupFrames, type ParsedFrame, type GroupingResult } from '@/lib/frame-grouping'
import { useToast } from '@/components/ui/toast'
import { Modal } from '@/components/ui/modal'

interface Props {
  projectId: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

type State =
  | { status: 'idle' }
  | { status: 'parsing'; done: number; total: number }
  | { status: 'review'; result: GroupingResult }
  | { status: 'empty' }

// Lê arquivos de um drop, descendo em pastas (webkitGetAsEntry).
async function filesFromDrop(dt: DataTransfer): Promise<File[]> {
  const items = dt.items
  const hasEntryApi = items && items.length && typeof items[0].webkitGetAsEntry === 'function'
  if (!hasEntryApi) return Array.from(dt.files)

  const roots: any[] = []
  for (let i = 0; i < items.length; i++) {
    const entry = items[i].webkitGetAsEntry?.()
    if (entry) roots.push(entry)
  }

  const out: File[] = []
  async function walk(entry: any): Promise<void> {
    if (entry.isFile) {
      await new Promise<void>(res => entry.file((f: File) => { out.push(f); res() }, () => res()))
    } else if (entry.isDirectory) {
      const reader = entry.createReader()
      await new Promise<void>(res => {
        const read = () => reader.readEntries(async (ents: any[]) => {
          if (!ents.length) return res()
          for (const e of ents) await walk(e)
          read()
        }, () => res())
        read()
      })
    }
  }
  for (const r of roots) await walk(r)
  return out
}

export function BulkFITSImport({ projectId, open, onOpenChange }: Props) {
  const { toast } = useToast()
  const utils = api.useUtils()
  const { data: setups } = api.setups.list.useQuery()

  const [state, setState]       = useState<State>({ status: 'idle' })
  const [dragging, setDragging] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [setupId, setSetupId]   = useState<string>('')
  const [submitting, setSubmitting] = useState(false)

  const folderRef = useRef<HTMLInputElement>(null)
  const filesRef  = useRef<HTMLInputElement>(null)

  const bulkCreate = api.sessions.bulkCreate.useMutation()

  // Pré-seleciona o setup padrão
  useEffect(() => {
    if (open && !setupId && setups?.length) {
      setSetupId(setups.find(s => s.isDefault)?.id ?? '')
    }
  }, [open, setups, setupId])

  // Marca o input de pasta como seletor de diretório (atributo não-padrão)
  useEffect(() => {
    if (folderRef.current) {
      folderRef.current.setAttribute('webkitdirectory', 'true')
      folderRef.current.setAttribute('directory', 'true')
    }
  }, [state])

  function resetAll() {
    setState({ status: 'idle' })
    setSelected(new Set())
    setSubmitting(false)
  }

  async function handleFiles(all: File[]) {
    const supported = all.filter(f => detectFileType(f) !== 'unsupported')
    if (supported.length === 0) {
      setState({ status: 'empty' })
      return
    }

    setState({ status: 'parsing', done: 0, total: supported.length })

    const frames: ParsedFrame[] = []
    let done = 0
    let idx = 0
    const concurrency = 6

    async function worker() {
      while (idx < supported.length) {
        const i = idx++
        const file = supported[i]
        let header: Awaited<ReturnType<typeof parseImageHeader>> = {}
        try { header = await parseImageHeader(file) } catch { /* ignore */ }

        // header tem prioridade; nome do arquivo preenche lacunas
        const merged: ParsedFrame = { fileName: file.name, ...parseFilename(file.name), ...header }

        // data: header → nome (não tem) → data de modificação do arquivo
        if (!(merged.observedAt instanceof Date) || isNaN(merged.observedAt.getTime())) {
          merged.observedAt = new Date(file.lastModified)
        }
        frames.push(merged)
        done++
        if (done % 5 === 0 || done === supported.length) {
          setState({ status: 'parsing', done, total: supported.length })
        }
      }
    }

    await Promise.all(Array.from({ length: concurrency }, worker))

    const result = groupFrames(frames)
    if (result.groups.length === 0) {
      setState({ status: 'empty' })
      return
    }
    setSelected(new Set(result.groups.map(g => g.key)))
    setState({ status: 'review', result })
  }

  function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files ? Array.from(e.target.files) : []
    e.target.value = ''
    if (files.length) handleFiles(files)
  }

  async function onDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragging(false)
    const files = await filesFromDrop(e.dataTransfer)
    if (files.length) handleFiles(files)
  }

  function toggle(key: string) {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key); else next.add(key)
      return next
    })
  }

  async function confirm() {
    if (state.status !== 'review') return
    const chosen = state.result.groups.filter(g => selected.has(g.key))
    if (chosen.length === 0) { toast('Selecione ao menos um grupo', 'error'); return }

    setSubmitting(true)
    try {
      const res = await bulkCreate.mutateAsync({
        projectId,
        setupId: setupId || undefined,
        sessions: chosen.map(g => ({
          observedAt:      g.observedAt,
          filterUsed:      g.filterUsed,
          lightsCount:     g.lightsCount,
          exposureSeconds: g.exposureSeconds,
          gain:            g.gain,
          offset:          g.offset,
          binning:         g.binning,
          sensorTempC:     g.sensorTempC,
          notes:           'Importado via pasta de FITS',
        })),
      })
      utils.sessions.list.invalidate({ projectId })
      utils.projects.byId.invalidate({ id: projectId })
      toast(`${res.count} sessão${res.count !== 1 ? 'ões' : ''} importada${res.count !== 1 ? 's' : ''}!`)
      resetAll()
      onOpenChange(false)
    } catch (e: any) {
      toast(e.message ?? 'Erro ao importar', 'error')
      setSubmitting(false)
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────
  const review = state.status === 'review' ? state.result : null
  const chosenGroups = review?.groups.filter(g => selected.has(g.key)) ?? []
  const totalLights = chosenGroups.reduce((s, g) => s + g.lightsCount, 0)
  const totalMin    = chosenGroups.reduce((s, g) => s + g.integrationMin, 0)

  return (
    <Modal
      open={open}
      onOpenChange={v => { if (!v) resetAll(); onOpenChange(v) }}
      title="Importar pasta de FITS"
      description="Solte uma noite inteira — o app lê os headers e cria as sessões agrupadas por filtro"
      className="max-w-3xl"
    >
      {/* Drop / pickers */}
      {(state.status === 'idle' || state.status === 'empty') && (
        <div className="space-y-3">
          <div
            onDragOver={e => { e.preventDefault(); setDragging(true) }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            className={cn(
              'flex flex-col items-center justify-center gap-3 p-10 rounded-xl border border-dashed transition-colors text-center',
              dragging ? 'border-aurora-400/60 bg-aurora-400/8' : 'border-white/15 bg-white/2',
            )}
          >
            <FolderUp className={cn('w-8 h-8', dragging ? 'text-aurora-400' : 'text-white/25')} />
            <div>
              <p className={cn('text-sm', dragging ? 'text-aurora-300' : 'text-white/60')}>
                Arraste a pasta da noite aqui
              </p>
              <p className="text-[11px] text-white/25 mt-1">
                .fits · .fit · .fts · .xisf — lidos localmente, sem upload. Calibrações são detectadas e ignoradas.
              </p>
            </div>
            <div className="flex gap-2 mt-1">
              <button type="button" className="btn-secondary flex items-center gap-1.5 text-xs" onClick={() => folderRef.current?.click()}>
                <FolderUp className="w-3.5 h-3.5" /> Selecionar pasta
              </button>
              <button type="button" className="btn-secondary flex items-center gap-1.5 text-xs" onClick={() => filesRef.current?.click()}>
                <FileUp className="w-3.5 h-3.5" /> Selecionar arquivos
              </button>
            </div>
            <input ref={folderRef} type="file" multiple className="hidden" onChange={onPick} />
            <input ref={filesRef}  type="file" multiple accept=".fits,.fit,.fts,.xisf" className="hidden" onChange={onPick} />
          </div>

          {state.status === 'empty' && (
            <div className="flex items-start gap-3 p-3 rounded-lg bg-amber-400/8 border border-amber-400/20">
              <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <p className="text-xs text-amber-300/90">
                Nenhum frame de luz reconhecido. Verifique se a pasta contém arquivos .fits/.xisf com lights.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Parsing */}
      {state.status === 'parsing' && (
        <div className="flex flex-col items-center justify-center gap-4 py-12">
          <Loader2 className="w-7 h-7 text-aurora-400 animate-spin" />
          <div className="w-full max-w-sm">
            <div className="flex justify-between text-xs text-white/40 mb-1.5">
              <span>Lendo headers…</span>
              <span className="mono">{state.done} / {state.total}</span>
            </div>
            <div className="h-1.5 rounded-full bg-white/8 overflow-hidden">
              <div
                className="h-full bg-aurora-400 transition-all duration-150"
                style={{ width: `${state.total ? (state.done / state.total) * 100 : 0}%` }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Review */}
      {review && (
        <div className="space-y-4">
          {/* Setup selector */}
          <div>
            <label className="input-label">Setup usado nesta noite</label>
            <select className="input" value={setupId} onChange={e => setSetupId(e.target.value)}>
              <option value="">Setup do projeto</option>
              {setups?.map(s => (
                <option key={s.id} value={s.id}>{s.name}{s.isDefault ? ' ★' : ''}</option>
              ))}
            </select>
          </div>

          {/* Ignored summary */}
          {(review.ignored.darks + review.ignored.flats + review.ignored.bias) > 0 && (
            <p className="text-[11px] text-white/35">
              Ignorados (calibração): {review.ignored.darks} darks · {review.ignored.flats} flats · {review.ignored.bias} bias.
              Use a Biblioteca para gerenciar masters reutilizáveis.
            </p>
          )}

          {/* Groups table */}
          <div className="border border-white/8 rounded-xl overflow-hidden">
            <div className="grid grid-cols-[auto_1fr_auto_auto_auto_auto] gap-2 px-3 py-2 bg-white/3 text-[10px] uppercase tracking-wider text-white/35">
              <span></span>
              <span>Noite</span>
              <span className="text-center">Filtro</span>
              <span className="text-right">Lights</span>
              <span className="text-right">Exp.</span>
              <span className="text-right">Integr.</span>
            </div>
            <div className="max-h-72 overflow-y-auto divide-y divide-white/5">
              {review.groups.map(g => {
                const checked = selected.has(g.key)
                return (
                  <button
                    type="button"
                    key={g.key}
                    onClick={() => toggle(g.key)}
                    className={cn(
                      'w-full grid grid-cols-[auto_1fr_auto_auto_auto_auto] gap-2 px-3 py-2.5 items-center text-left transition-colors',
                      checked ? 'bg-aurora-400/5 hover:bg-aurora-400/10' : 'opacity-50 hover:opacity-80 hover:bg-white/3',
                    )}
                  >
                    <span className={cn(
                      'w-3.5 h-3.5 rounded border-2 flex items-center justify-center shrink-0',
                      checked ? 'bg-aurora-400 border-aurora-400' : 'border-white/30',
                    )}>
                      {checked && <Check className="w-2.5 h-2.5 text-cosmos-950" />}
                    </span>
                    <span className="text-xs text-white/70 min-w-0">
                      {format(new Date(g.nightOf + 'T12:00:00'), "d MMM yyyy", { locale: ptBR })}
                      <span className="text-white/25 ml-1.5 mono">
                        {format(new Date(g.observedAt), 'HH:mm')}
                        {g.gain != null ? ` · G${g.gain}` : ''}
                        {g.binning ? ` · ${g.binning}` : ''}
                        {g.sensorTempC != null ? ` · ${g.sensorTempC}°C` : ''}
                      </span>
                    </span>
                    <span className="text-center">
                      {g.filterUsed
                        ? <span className={cn('px-1.5 py-0.5 rounded text-[10px] font-mono font-bold', filterPillClass(g.filterUsed))}>{g.filterUsed}</span>
                        : <span className="text-[10px] text-white/25">—</span>}
                    </span>
                    <span className="text-right text-xs mono text-white/80">{g.lightsCount}</span>
                    <span className="text-right text-xs mono text-white/50">{g.exposureSeconds ? `${g.exposureSeconds}s` : '—'}</span>
                    <span className="text-right text-xs mono text-aurora-300">{formatIntegration(g.integrationMin)}</span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Totals + actions */}
          <div className="flex items-center justify-between flex-wrap gap-3 pt-1">
            <p className="text-xs text-white/50 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-aurora-400" />
              {chosenGroups.length} sessão{chosenGroups.length !== 1 ? 'ões' : ''} ·{' '}
              <span className="mono text-white/70">{totalLights}</span> lights ·{' '}
              <span className="mono text-aurora-300">{formatIntegration(totalMin)}</span>
            </p>
            <div className="flex gap-2">
              <button type="button" className="btn-secondary" onClick={resetAll}>Recomeçar</button>
              <button type="button" className="btn-primary" disabled={submitting || chosenGroups.length === 0} onClick={confirm}>
                {submitting ? 'Importando…' : `Importar ${chosenGroups.length} sessão${chosenGroups.length !== 1 ? 'ões' : ''}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </Modal>
  )
}
