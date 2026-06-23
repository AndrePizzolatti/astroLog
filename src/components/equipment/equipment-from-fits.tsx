'use client'

import { useState } from 'react'
import { Telescope, Camera, CheckCircle2, Plus, RotateCcw } from 'lucide-react'
import { api } from '@/lib/trpc'
import { cn } from '@/lib/utils'
import { extractEquipment, type FITSFields, type DetectedTelescope, type DetectedCamera } from '@/lib/fits-parser'
import { FITSDropZone } from '@/components/sessions/fits-drop-zone'
import { TelescopeForm, type TelescopePrefill } from '@/components/equipment/telescope-form'
import { CameraForm, type CameraPrefill } from '@/components/equipment/camera-form'
import { Modal } from '@/components/ui/modal'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
}

function matchTelescope(list: any[] | undefined, t: DetectedTelescope) {
  return list?.find(x =>
    x.name.toLowerCase() === t.name.toLowerCase() ||
    (t.focalLengthMm != null && Math.abs(x.focalLengthMm - t.focalLengthMm) <= 2 &&
     t.apertureMm != null && Math.abs(x.apertureMm - t.apertureMm) <= 2),
  )
}

function matchCamera(list: any[] | undefined, c: DetectedCamera) {
  return list?.find(x =>
    x.name.toLowerCase() === c.name.toLowerCase() ||
    (c.pixelSizeUm != null && Math.abs(x.pixelSizeUm - c.pixelSizeUm) < 0.15 &&
     c.sensorWidthPx != null && x.sensorWidthPx === c.sensorWidthPx),
  )
}

export function EquipmentFromFITS({ open, onOpenChange }: Props) {
  const { data: telescopes } = api.telescopes.list.useQuery()
  const { data: cameras }    = api.cameras.list.useQuery()

  const [detected, setDetected] = useState<ReturnType<typeof extractEquipment> | null>(null)
  const [tForm, setTForm] = useState(false)
  const [cForm, setCForm] = useState(false)

  function reset() {
    setDetected(null)
  }

  function onParsed(fields: FITSFields) {
    setDetected(extractEquipment(fields))
  }

  const tel = detected?.telescope
  const cam = detected?.camera
  const telMatch = tel ? matchTelescope(telescopes, tel) : undefined
  const camMatch = cam ? matchCamera(cameras, cam) : undefined

  const tPrefill: TelescopePrefill | undefined = tel && {
    name: tel.name, focalLengthMm: tel.focalLengthMm, apertureMm: tel.apertureMm,
  }
  const cPrefill: CameraPrefill | undefined = cam && {
    name: cam.name, pixelSizeUm: cam.pixelSizeUm,
    sensorWidthPx: cam.sensorWidthPx, sensorHeightPx: cam.sensorHeightPx, colorType: cam.colorType,
  }

  return (
    <Modal
      open={open}
      onOpenChange={v => { if (!v) reset(); onOpenChange(v) }}
      title="Importar equipamento de um frame"
      description="Lê o header de um FITS/XISF e pré-cadastra telescópio e câmera — sem redigitar"
      className="max-w-xl"
    >
      {!detected ? (
        <FITSDropZone onParsed={onParsed} />
      ) : (
        <div className="space-y-4">
          {/* Telescope */}
          <EquipCard
            icon={Telescope}
            title="Telescópio"
            detected={!!tel}
            match={telMatch}
            matchLabel={telMatch && `${telMatch.name} · ${telMatch.focalLengthMm}mm`}
            lines={tel ? [
              tel.focalLengthMm ? `Focal ${Math.round(tel.focalLengthMm)}mm` : null,
              tel.apertureMm ? `Abertura ${Math.round(tel.apertureMm)}mm` : 'abertura ausente — preencher',
            ].filter(Boolean) as string[] : []}
            onCreate={() => setTForm(true)}
          />

          {/* Camera */}
          <EquipCard
            icon={Camera}
            title="Câmera"
            detected={!!cam}
            match={camMatch}
            matchLabel={camMatch && `${camMatch.name} · ${camMatch.pixelSizeUm}µm`}
            lines={cam ? [
              cam.pixelSizeUm ? `Pixel ${cam.pixelSizeUm}µm` : 'pixel ausente — preencher',
              cam.sensorWidthPx && cam.sensorHeightPx ? `${cam.sensorWidthPx}×${cam.sensorHeightPx}px` : null,
              cam.colorType === 'COLOR' ? 'Colorida (OSC)' : 'Mono',
            ].filter(Boolean) as string[] : []}
            onCreate={() => setCForm(true)}
          />

          <button type="button" className="btn-ghost flex items-center gap-1.5 text-xs text-white/55" onClick={reset}>
            <RotateCcw className="w-3.5 h-3.5" /> Ler outro frame
          </button>
        </div>
      )}

      {/* Prefilled creation forms (nested) */}
      <TelescopeForm open={tForm} onOpenChange={setTForm} prefill={tPrefill} />
      <CameraForm    open={cForm} onOpenChange={setCForm} prefill={cPrefill} />
    </Modal>
  )
}

function EquipCard({
  icon: Icon, title, detected, match, matchLabel, lines, onCreate,
}: {
  icon: React.ComponentType<any>
  title: string
  detected: boolean
  match: any
  matchLabel?: string | false
  lines: string[]
  onCreate: () => void
}) {
  return (
    <div className="card p-4">
      <div className="flex items-center gap-2 mb-2">
        <Icon className="w-4 h-4 text-cosmos-400 shrink-0" />
        <span className="text-sm font-medium text-white">{title}</span>
        {match && (
          <span className="ml-auto flex items-center gap-1 text-[11px] text-aurora-400">
            <CheckCircle2 className="w-3.5 h-3.5" /> já cadastrado
          </span>
        )}
      </div>

      {!detected ? (
        <p className="text-xs text-white/30 italic">Nenhum dado deste tipo no header.</p>
      ) : match ? (
        <p className="text-xs text-white/50">{matchLabel}</p>
      ) : (
        <div className="flex items-end justify-between gap-3">
          <div className="flex flex-wrap gap-x-3 gap-y-0.5">
            {lines.map((l, i) => (
              <span key={i} className={cn('text-[11px] mono', /ausente/.test(l) ? 'text-amber-300/70' : 'text-white/60')}>{l}</span>
            ))}
          </div>
          <button type="button" className="btn-primary flex items-center gap-1.5 text-xs shrink-0" onClick={onCreate}>
            <Plus className="w-3.5 h-3.5" /> Revisar e criar
          </button>
        </div>
      )}
    </div>
  )
}
