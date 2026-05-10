'use client'

import { useEffect, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { format } from 'date-fns'
import { Check, CloudSun } from 'lucide-react'
import { api } from '@/lib/trpc'
import { cn, formatIntegration } from '@/lib/utils'
import { getMoonPhase } from '@/lib/moon'
import { type FITSFields } from '@/lib/fits-parser'
import { FITSDropZone } from '@/components/sessions/fits-drop-zone'
import { useToast } from '@/components/ui/toast'
import { Modal } from '@/components/ui/modal'

const FILTERS = ['L', 'R', 'G', 'B', 'Ha', 'OIII', 'SII']

const schema = z.object({
  projectId:        z.string(),
  setupId:          z.string().optional(),
  observedAt:       z.string(),
  filterUsed:       z.string().optional(),
  lightsCount:      z.coerce.number().int().min(0).default(0),
  exposureSeconds:  z.coerce.number().positive().optional().or(z.literal('')).transform(v => v === '' ? undefined : Number(v)),
  gain:             z.coerce.number().int().optional().or(z.literal('')).transform(v => v === '' ? undefined : Number(v)),
  offset:           z.coerce.number().int().optional().or(z.literal('')).transform(v => v === '' ? undefined : Number(v)),
  binning:          z.string().optional(),
  sensorTempC:      z.coerce.number().optional().or(z.literal('')).transform(v => v === '' ? undefined : Number(v)),
  temperatureC:     z.coerce.number().optional().or(z.literal('')).transform(v => v === '' ? undefined : Number(v)),
  humidityPct:      z.coerce.number().int().min(0).max(100).optional().or(z.literal('')).transform(v => v === '' ? undefined : Number(v)),
  seeingArcsec:     z.coerce.number().positive().optional().or(z.literal('')).transform(v => v === '' ? undefined : Number(v)),
  sqmValue:         z.coerce.number().optional().or(z.literal('')).transform(v => v === '' ? undefined : Number(v)),
  bortleScale:      z.coerce.number().int().min(1).max(9).optional().or(z.literal('')).transform(v => v === '' ? undefined : Number(v)),
  cloudCoverPct:    z.coerce.number().int().min(0).max(100).optional().or(z.literal('')).transform(v => v === '' ? undefined : Number(v)),
  guidingRmsArcsec: z.coerce.number().positive().optional().or(z.literal('')).transform(v => v === '' ? undefined : Number(v)),
  rating:           z.coerce.number().int().min(1).max(5).optional().or(z.literal('')).transform(v => v === '' ? undefined : Number(v)),
  notes:            z.string().optional(),
})

type FormValues = z.input<typeof schema>

// ─── Sticky values ────────────────────────────────────────────────────────────
// Fields that persist across new-session creates (capture technique stays stable night to night)
const STICKY_KEY = 'astrolog_session_sticky'
type StickyFields = Pick<FormValues, 'setupId' | 'filterUsed' | 'gain' | 'offset' | 'binning' | 'sensorTempC' | 'exposureSeconds'>

function loadSticky(): Partial<StickyFields> {
  try {
    const raw = localStorage.getItem(STICKY_KEY)
    return raw ? (JSON.parse(raw) as StickyFields) : {}
  } catch { return {} }
}

function saveSticky(vals: FormValues) {
  const toSave: StickyFields = {
    setupId:         vals.setupId,
    filterUsed:      vals.filterUsed,
    gain:            vals.gain,
    offset:          vals.offset,
    binning:         vals.binning,
    sensorTempC:     vals.sensorTempC,
    exposureSeconds: vals.exposureSeconds,
  }
  localStorage.setItem(STICKY_KEY, JSON.stringify(toSave))
}

// ─── Types ───────────────────────────────────────────────────────────────────
export type SessionInitial = {
  id?: string  // absent = clone mode (create with pre-filled capture params)
  projectId: string; setupId?: string | null
  observedAt: Date | string; filterUsed?: string | null
  lightsCount: number; exposureSeconds?: number | null
  gain?: number | null; offset?: number | null; binning?: string | null
  sensorTempC?: number | null; temperatureC?: number | null
  humidityPct?: number | null; seeingArcsec?: number | null
  sqmValue?: number | null; bortleScale?: number | null
  cloudCoverPct?: number | null; guidingRmsArcsec?: number | null
  rating?: number | null; notes?: string | null
  calibrationFrameUsages?: Array<{ calibrationFrameId: string; calibrationFrame: { id: string; label: string; frameType: string } }>
}

interface Props {
  projectId: string
  open: boolean
  onOpenChange: (open: boolean) => void
  initial?: SessionInitial
}

export function SessionForm({ projectId, open, onOpenChange, initial }: Props) {
  const isEdit  = !!initial?.id
  const isClone = !!initial && !initial.id
  const { toast } = useToast()
  const utils = api.useUtils()
  const { data: setups }   = api.setups.list.useQuery()
  const { data: profile }  = api.user.getProfile.useQuery()

  const { register, handleSubmit, reset, watch, setValue, getValues, formState: { isSubmitting } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      projectId,
      observedAt: format(new Date(), "yyyy-MM-dd'T'HH:mm"),
      lightsCount: 0,
    },
  })

  // Calibration state
  const [selectedCalibIds, setSelectedCalibIds] = useState<Set<string>>(new Set())
  // Indicator shown when weather was auto-filled
  const [weatherFilled, setWeatherFilled] = useState(false)

  const selectedFilter = watch('filterUsed')
  const watchSetupId   = watch('setupId')
  const watchGain      = watch('gain')
  const watchExp       = watch('exposureSeconds')
  const watchTemp      = watch('sensorTempC')
  const observedAt     = watch('observedAt')
  const watchLights    = watch('lightsCount')

  const gainNum    = Number(watchGain)
  const lightsNum  = Number(watchLights)
  const expNum     = Number(watchExp)
  const hasMatchCriteria = !!watchSetupId && !isNaN(gainNum) && gainNum > 0

  // Câmera do setup selecionado — disponível porque setups.list inclui camera: true
  const selectedSetup  = (setups as any[])?.find((s: any) => s.id === watchSetupId)
  const setupCamera    = selectedSetup?.camera as { sensorWidthPx: number; sensorHeightPx: number } | undefined
  const fitsMbPerFrame = setupCamera
    ? (setupCamera.sensorWidthPx * setupCamera.sensorHeightPx * 2) / 1_000_000
    : null

  const integrationMin = lightsNum > 0 && expNum > 0 ? (lightsNum * expNum) / 60 : null
  const storageGb      = fitsMbPerFrame && lightsNum > 0 ? (lightsNum * fitsMbPerFrame) / 1000 : null

  const { data: calibMatches } = api.calibration.findMatches.useQuery(
    {
      setupId:         watchSetupId!,
      gain:            gainNum,
      exposureSeconds: Number(watchExp) || undefined,
      sensorTempC:     Number(watchTemp) || undefined,
    },
    { enabled: hasMatchCriteria, staleTime: 30_000 },
  )

  // ─── Debounced date for weather auto-fill ──────────────────────────────────
  const [debouncedDate, setDebouncedDate] = useState<string | null>(null)
  // Skip weather auto-fill in edit mode (user already has the real data)
  useEffect(() => {
    if (isEdit || !observedAt) return
    const timer = setTimeout(() => setDebouncedDate(observedAt), 1200)
    return () => clearTimeout(timer)
  }, [observedAt, isEdit])

  const { data: weatherData } = api.weather.getForDate.useQuery(
    {
      latitude:  profile?.latitude  ?? undefined,
      longitude: profile?.longitude ?? undefined,
      dateTime:  debouncedDate ?? '',
    },
    { enabled: !!debouncedDate && !isEdit, staleTime: 10 * 60_000 },
  )

  // Apply weather data only to currently-empty atmospheric fields
  const weatherApplied = useRef(false)
  useEffect(() => {
    if (!weatherData || weatherApplied.current) return
    weatherApplied.current = true
    const vals = getValues()
    if (!vals.temperatureC)  setValue('temperatureC',  weatherData.temperatureC  as any)
    if (!vals.humidityPct)   setValue('humidityPct',   weatherData.humidityPct   as any)
    if (!vals.cloudCoverPct) setValue('cloudCoverPct', weatherData.cloudCoverPct as any)
    if (weatherData.temperatureC != null) setWeatherFilled(true)
  }, [weatherData]) // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Reset form on open ───────────────────────────────────────────────────
  useEffect(() => {
    if (!open) {
      weatherApplied.current = false
      setWeatherFilled(false)
      return
    }

    if (isEdit && initial) {
      // Edit mode: restore all saved values
      reset({
        projectId:        initial.projectId,
        setupId:          initial.setupId ?? '',
        observedAt:       format(new Date(initial.observedAt), "yyyy-MM-dd'T'HH:mm"),
        filterUsed:       initial.filterUsed ?? undefined,
        lightsCount:      initial.lightsCount,
        exposureSeconds:  initial.exposureSeconds ?? '',
        gain:             initial.gain ?? '',
        offset:           initial.offset ?? '',
        binning:          initial.binning ?? '',
        sensorTempC:      initial.sensorTempC ?? '',
        temperatureC:     initial.temperatureC ?? '',
        humidityPct:      initial.humidityPct ?? '',
        seeingArcsec:     initial.seeingArcsec ?? '',
        sqmValue:         initial.sqmValue ?? '',
        bortleScale:      initial.bortleScale ?? '',
        cloudCoverPct:    initial.cloudCoverPct ?? '',
        guidingRmsArcsec: initial.guidingRmsArcsec ?? '',
        rating:           initial.rating ?? '',
        notes:            initial.notes ?? '',
      })
      const existingIds = initial.calibrationFrameUsages?.map(u => u.calibrationFrameId) ?? []
      setSelectedCalibIds(new Set(existingIds))

    } else if (isClone && initial) {
      // Clone mode: inherit capture technique, reset counts/conditions/notes
      reset({
        projectId,
        observedAt:      format(new Date(), "yyyy-MM-dd'T'HH:mm"),
        lightsCount:     0,
        setupId:         initial.setupId ?? '',
        filterUsed:      initial.filterUsed ?? undefined,
        exposureSeconds: initial.exposureSeconds ?? '',
        gain:            initial.gain ?? '',
        offset:          initial.offset ?? '',
        binning:         initial.binning ?? '',
        sensorTempC:     initial.sensorTempC ?? '',
        // atmospheric conditions reset — weather auto-fill will populate them
        temperatureC:    '',
        humidityPct:     '',
        seeingArcsec:    '',
        sqmValue:        '',
        bortleScale:     '',
        cloudCoverPct:   '',
        guidingRmsArcsec:'',
        rating:          '',
        notes:           '',
      })
      setSelectedCalibIds(new Set())

    } else {
      // New session: sticky values + default setup fallback
      const sticky          = loadSticky()
      const defaultSetupId  = setups?.find(s => s.isDefault)?.id
      reset({
        projectId,
        observedAt:      format(new Date(), "yyyy-MM-dd'T'HH:mm"),
        lightsCount:     0,
        setupId:         sticky.setupId ?? defaultSetupId ?? '',
        filterUsed:      sticky.filterUsed,
        gain:            sticky.gain,
        offset:          sticky.offset,
        binning:         sticky.binning,
        sensorTempC:     sticky.sensorTempC,
        exposureSeconds: sticky.exposureSeconds,
      })
      setSelectedCalibIds(new Set())
    }

    weatherApplied.current = false
    setWeatherFilled(false)
    setDebouncedDate(null)
  }, [open, initial?.id, isClone]) // eslint-disable-line react-hooks/exhaustive-deps

  const create       = api.sessions.create.useMutation()
  const update       = api.sessions.update.useMutation()
  const attachCalib  = api.calibration.attachToSession.useMutation()
  const detachCalib  = api.calibration.detachFromSession.useMutation()

  function invalidate() {
    utils.sessions.list.invalidate({ projectId })
    utils.projects.byId.invalidate({ id: projectId })
  }

  async function onSubmit(data: FormValues) {
    const isoDate = new Date(data.observedAt).toISOString()
    try {
      if (isEdit) {
        const updated = await update.mutateAsync({ id: initial!.id!, ...(data as any), observedAt: isoDate })
        const existingIds = new Set(initial?.calibrationFrameUsages?.map(u => u.calibrationFrameId) ?? [])
        const toAttach = [...selectedCalibIds].filter(id => !existingIds.has(id))
        const toDetach = [...existingIds].filter(id => !selectedCalibIds.has(id))
        await Promise.all([
          ...toAttach.map(id => attachCalib.mutateAsync({ sessionId: updated.id, calibrationFrameId: id })),
          ...toDetach.map(id => detachCalib.mutateAsync({ sessionId: updated.id, calibrationFrameId: id })),
        ])
        invalidate()
        toast('Sessão atualizada!')
        onOpenChange(false)
      } else {
        const created = await create.mutateAsync({ ...(data as any), observedAt: isoDate })
        if (selectedCalibIds.size > 0) {
          await Promise.all(
            [...selectedCalibIds].map(id =>
              attachCalib.mutateAsync({ sessionId: created.id, calibrationFrameId: id }),
            ),
          )
        }
        // Persist sticky values for next new-session
        saveSticky(data)
        invalidate()
        toast(isClone ? 'Sessão continuada!' : 'Sessão registrada!')
        reset()
        setSelectedCalibIds(new Set())
        onOpenChange(false)
      }
    } catch (e: any) {
      toast(e.message ?? 'Erro ao salvar sessão', 'error')
    }
  }

  function toggleCalib(id: string) {
    setSelectedCalibIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  function onFITSParsed(fields: FITSFields) {
    if (fields.observedAt      !== undefined) {
      setValue('observedAt', format(fields.observedAt, "yyyy-MM-dd'T'HH:mm"))
      // Allow weather auto-fill to re-run for the new date
      weatherApplied.current = false
      setWeatherFilled(false)
    }
    if (fields.exposureSeconds !== undefined) setValue('exposureSeconds', fields.exposureSeconds as any)
    if (fields.gain            !== undefined) setValue('gain',            fields.gain            as any)
    if (fields.offset          !== undefined) setValue('offset',          fields.offset          as any)
    if (fields.binning         !== undefined) setValue('binning',         fields.binning)
    if (fields.sensorTempC     !== undefined) setValue('sensorTempC',     fields.sensorTempC     as any)
    if (fields.filterUsed      !== undefined) setValue('filterUsed',      fields.filterUsed)
    // targetName, camera, telescope, ra, dec: exibidos no drop zone, sem campo no formulário
  }

  const title = isEdit ? 'Editar Sessão' : isClone ? 'Continuar Sessão' : 'Nova Sessão'
  const subtitle = isClone ? 'Parâmetros de captura herdados — ajuste o que mudou' : isEdit ? undefined : 'Registre uma noite de captura'

  return (
    <Modal open={open} onOpenChange={onOpenChange}
      title={title}
      description={subtitle}
      className="max-w-2xl">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">

        {/* Basic */}
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <label className="input-label">Data / Hora de observação *</label>
            <input {...register('observedAt')} type="datetime-local" className="input" />
            {/* Moon phase — calculated instantly from the selected date, no API */}
            {(() => {
              const d = observedAt ? new Date(observedAt) : null
              if (!d || isNaN(d.getTime())) return null
              const moon = getMoonPhase(d)
              const dimCls = moon.illumination > 50 ? 'text-amber-300/80' : 'text-white/35'
              return (
                <p className={cn('text-[11px] mt-1.5 flex items-center gap-1.5', dimCls)}>
                  <span>{moon.emoji}</span>
                  <span>{moon.label}</span>
                  <span className="text-white/25">·</span>
                  <span className="mono">{moon.illumination}% iluminada</span>
                  {moon.illumination > 60 && (
                    <span className="text-amber-400/60 ml-1">— céu claro pode ser afetado</span>
                  )}
                </p>
              )
            })()}
          </div>
          <div className="col-span-2">
            <label className="input-label">Setup usado</label>
            <select {...register('setupId')} className="input">
              <option value="">Setup do projeto</option>
              {setups?.map(s => (
                <option key={s.id} value={s.id}>
                  {s.name}{s.isDefault ? ' ★' : ''}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* FITS / XISF auto-fill */}
        {!isEdit && (
          <FITSDropZone onParsed={onFITSParsed} />
        )}

        {/* Capture */}
        <div>
          <p className="text-xs text-white/40 uppercase tracking-wider mb-3">Parâmetros de captura</p>
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-3">
              <label className="input-label">Filtro</label>
              <div className="flex flex-wrap gap-1.5">
                {['', ...FILTERS].map(f => (
                  <button
                    key={f || 'none'}
                    type="button"
                    onClick={() => setValue('filterUsed', f || undefined)}
                    className={`px-2 py-0.5 rounded text-xs font-mono font-bold border transition-opacity ${
                      (f === '' && !selectedFilter) || selectedFilter === f
                        ? f ? `filter-${f}` : 'bg-white/10 text-white/60 border-white/20'
                        : 'opacity-30 bg-white/5 text-white/40 border-white/10'
                    }`}
                  >
                    {f || 'Sem filtro'}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="input-label">Lights</label>
              <input {...register('lightsCount')} type="number" min="0" step="1" className="input" placeholder="120" />
            </div>
            <div>
              <label className="input-label">Exposição (s)</label>
              <input {...register('exposureSeconds')} type="number" step="0.1" className="input" placeholder="300" />
            </div>

            {/* Preview de integração e armazenamento */}
            {integrationMin !== null && (
              <div className="col-span-3 flex items-center gap-2 flex-wrap">
                <span className="text-xs font-mono text-aurora-300">
                  {formatIntegration(integrationMin)}
                </span>
                {storageGb !== null && (
                  <span className="text-xs text-white/30">
                    · ~{storageGb >= 1 ? `${storageGb.toFixed(1)} GB` : `${(storageGb * 1000).toFixed(0)} MB`} estimado
                  </span>
                )}
              </div>
            )}
            <div>
              <label className="input-label">Gain</label>
              <input {...register('gain')} type="number" step="1" className="input" placeholder="100" />
            </div>
            <div>
              <label className="input-label">Offset</label>
              <input {...register('offset')} type="number" step="1" className="input" placeholder="50" />
            </div>
            <div>
              <label className="input-label">Binning</label>
              <select {...register('binning')} className="input">
                <option value="">—</option>
                <option>1×1</option><option>2×2</option><option>3×3</option><option>4×4</option>
              </select>
            </div>
            <div>
              <label className="input-label">Temp. sensor (°C)</label>
              <input {...register('sensorTempC')} type="number" step="0.5" className="input" placeholder="-10" />
            </div>
          </div>
        </div>

        {/* Calibration library matches */}
        {hasMatchCriteria && (
          <div>
            <p className="text-xs text-white/40 uppercase tracking-wider mb-3">Calibrações compatíveis</p>
            {!calibMatches?.length ? (
              <p className="text-xs text-white/25 italic">
                Nenhum frame compatível na biblioteca para este setup/gain.
              </p>
            ) : (
              <div className="space-y-1.5">
                {calibMatches.map(frame => {
                  const checked = selectedCalibIds.has(frame.id)
                  return (
                    <label
                      key={frame.id}
                      className={cn(
                        'flex items-center gap-3 p-2.5 rounded-lg border cursor-pointer transition-colors',
                        checked
                          ? 'bg-aurora-400/10 border-aurora-400/20'
                          : 'bg-white/3 border-white/8 hover:bg-white/5',
                      )}
                    >
                      <div
                        onClick={() => toggleCalib(frame.id)}
                        className={cn(
                          'w-3.5 h-3.5 rounded border-2 flex items-center justify-center shrink-0',
                          checked ? 'bg-aurora-400 border-aurora-400' : 'border-white/30',
                        )}
                      >
                        {checked && <Check className="w-2.5 h-2.5 text-cosmos-950" />}
                      </div>
                      <div className="flex-1 min-w-0" onClick={() => toggleCalib(frame.id)}>
                        <p className="text-xs font-medium text-white/80">{frame.label}</p>
                        <p className="text-[10px] text-white/30 mono">
                          {frame.frameType} · G{frame.gain}
                          {frame.sensorTempC != null ? ` · ${frame.sensorTempC}°C` : ''}
                          {frame.exposureSeconds ? ` · ${frame.exposureSeconds}s` : ''}
                        </p>
                      </div>
                      <span className="badge bg-white/5 text-white/25 text-[10px] shrink-0">
                        {frame.frameCount} frame{frame.frameCount !== 1 ? 's' : ''}
                      </span>
                    </label>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* Alerta de calibração */}
        {lightsNum > 0 && selectedCalibIds.size === 0 && (
          <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-400/8 border border-amber-400/20">
            <span className="text-amber-400 text-sm shrink-0">⚠</span>
            <p className="text-xs text-amber-300/80">
              Sessão sem frames de calibração vinculados. Associe Darks, Flats ou Bias da biblioteca para manter o rastreamento completo.
            </p>
          </div>
        )}

        {/* Conditions */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs text-white/40 uppercase tracking-wider">Condições atmosféricas</p>
            {weatherFilled && (
              <span className="flex items-center gap-1 text-[10px] text-aurora-400/70">
                <CloudSun className="w-3 h-3" /> Preenchido via Open-Meteo
              </span>
            )}
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="input-label">Temperatura (°C)</label>
              <input {...register('temperatureC')} type="number" step="0.1" className="input" placeholder="18" />
            </div>
            <div>
              <label className="input-label">Umidade (%)</label>
              <input {...register('humidityPct')} type="number" step="1" className="input" placeholder="75" />
            </div>
            <div>
              <label className="input-label">Nuvens (%)</label>
              <input {...register('cloudCoverPct')} type="number" step="1" className="input" placeholder="0" />
            </div>
            <div>
              <label className="input-label">Seeing (")</label>
              <input {...register('seeingArcsec')} type="number" step="0.1" className="input" placeholder="2.5" />
            </div>
            <div>
              <label className="input-label">SQM</label>
              <input {...register('sqmValue')} type="number" step="0.01" className="input" placeholder="21.3" />
            </div>
            <div>
              <label className="input-label">Bortle</label>
              <select {...register('bortleScale')} className="input">
                <option value="">—</option>
                {[1,2,3,4,5,6,7,8,9].map(n => <option key={n} value={n}>Classe {n}</option>)}
              </select>
            </div>
            <div>
              <label className="input-label">Guiagem RMS (")</label>
              <input {...register('guidingRmsArcsec')} type="number" step="0.01" className="input" placeholder="0.8" />
            </div>
            <div>
              <label className="input-label">Avaliação (1-5)</label>
              <select {...register('rating')} className="input">
                <option value="">—</option>
                {[1,2,3,4,5].map(n => <option key={n} value={n}>{'★'.repeat(n)}</option>)}
              </select>
            </div>
          </div>
        </div>

        <div>
          <label className="input-label">Notas</label>
          <textarea {...register('notes')} className="input" rows={2} placeholder="Observações sobre a noite…" />
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <button type="button" className="btn-secondary" onClick={() => onOpenChange(false)}>Cancelar</button>
          <button type="submit" className="btn-primary" disabled={isSubmitting}>
            {isSubmitting ? 'Salvando…' : isEdit ? 'Salvar' : isClone ? 'Registrar Continuação' : 'Registrar Sessão'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
