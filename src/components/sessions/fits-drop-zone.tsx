'use client'

import { useRef, useState } from 'react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { FileImage, Loader2, CheckCircle2, AlertCircle, X } from 'lucide-react'
import { parseImageHeader, detectFileType, type FITSFields } from '@/lib/fits-parser'
import { cn } from '@/lib/utils'

interface Props {
  onParsed: (fields: FITSFields) => void
}

type State =
  | { status: 'idle' }
  | { status: 'loading'; name: string }
  | { status: 'done'; name: string; fields: FITSFields }
  | { status: 'error'; message: string }

function fieldLabel(key: keyof FITSFields, val: unknown): string {
  switch (key) {
    case 'exposureSeconds': return `${val}s`
    case 'gain':            return `Gain ${val}`
    case 'offset':          return `Offset ${val}`
    case 'binning':         return `Bin ${val}`
    case 'sensorTempC':     return `${val}°C sensor`
    case 'filterUsed':      return `Filtro ${val}`
    case 'observedAt':      return format(val as Date, "d MMM HH:mm", { locale: ptBR })
    case 'targetName':      return `Alvo: ${val}`
    case 'camera':          return `Câm: ${val}`
    case 'telescope':       return `Tel: ${val}`
    case 'ra':              return `RA ${val}`
    case 'dec':             return `Dec ${val}`
    default:                return String(val)
  }
}

export function FITSDropZone({ onParsed }: Props) {
  const [state, setState] = useState<State>({ status: 'idle' })
  const [dragging, setDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  async function process(file: File) {
    const type = detectFileType(file)
    if (type === 'unsupported') {
      setState({ status: 'error', message: 'Formato não suportado. Use .fits, .fit, .fts ou .xisf' })
      return
    }

    setState({ status: 'loading', name: file.name })

    try {
      const fields = await parseImageHeader(file)
      const hasData = Object.values(fields).some(v => v !== undefined)

      if (!hasData) {
        setState({ status: 'error', message: 'Nenhum metadado reconhecido no header deste arquivo.' })
        return
      }

      setState({ status: 'done', name: file.name, fields })
      onParsed(fields)
    } catch {
      setState({ status: 'error', message: 'Falha ao ler o arquivo. Verifique se é um FITS/XISF válido.' })
    }
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) process(file)
  }

  function onFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) process(file)
    e.target.value = ''
  }

  function reset() {
    setState({ status: 'idle' })
  }

  // Estado: sucesso — mostra resumo dos campos extraídos
  if (state.status === 'done') {
    const entries = Object.entries(state.fields).filter(([, v]) => v !== undefined) as [keyof FITSFields, unknown][]
    return (
      <div className="flex items-start gap-3 p-3 rounded-lg bg-aurora-400/8 border border-aurora-400/20">
        <CheckCircle2 className="w-4 h-4 text-aurora-400 shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-aurora-300 truncate">{state.name}</p>
          <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1">
            {entries.map(([k, v]) => (
              <span key={k} className="text-[11px] mono text-white/60">{fieldLabel(k, v)}</span>
            ))}
          </div>
        </div>
        <button
          type="button"
          onClick={reset}
          className="text-white/20 hover:text-white/50 transition-colors shrink-0"
          title="Limpar"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    )
  }

  // Estado: erro
  if (state.status === 'error') {
    return (
      <div className="flex items-start gap-3 p-3 rounded-lg bg-red-400/8 border border-red-400/20">
        <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
        <p className="text-xs text-red-300 flex-1">{state.message}</p>
        <button type="button" onClick={reset} className="text-white/20 hover:text-white/50 transition-colors shrink-0">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    )
  }

  // Estado: carregando
  if (state.status === 'loading') {
    return (
      <div className="flex items-center gap-3 p-3 rounded-lg bg-white/3 border border-white/10">
        <Loader2 className="w-4 h-4 text-white/55 animate-spin shrink-0" />
        <p className="text-xs text-white/50 truncate">Lendo header de {state.name}…</p>
      </div>
    )
  }

  // Estado: idle — drop zone
  return (
    <div
      onDragOver={e => { e.preventDefault(); setDragging(true) }}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
      onClick={() => inputRef.current?.click()}
      className={cn(
        'flex items-center gap-3 p-3 rounded-lg border border-dashed cursor-pointer transition-colors select-none',
        dragging
          ? 'border-aurora-400/60 bg-aurora-400/8'
          : 'border-white/10 bg-white/2 hover:border-white/20 hover:bg-white/4',
      )}
    >
      <FileImage className={cn('w-4 h-4 shrink-0', dragging ? 'text-aurora-400' : 'text-white/25')} />
      <div>
        <p className={cn('text-xs', dragging ? 'text-aurora-300' : 'text-white/55')}>
          Arraste um frame FITS ou XISF para preencher automaticamente
        </p>
        <p className="text-[10px] text-white/20 mt-0.5">.fits · .fit · .fts · .xisf — lido localmente, sem upload</p>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept=".fits,.fit,.fts,.xisf"
        className="hidden"
        onChange={onFileInput}
      />
    </div>
  )
}
