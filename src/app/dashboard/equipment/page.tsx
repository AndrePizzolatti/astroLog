'use client'

import { useState } from 'react'
import { Plus, Telescope, Camera, Compass, Layers, Zap, Package, Pencil, Trash2, FileImage } from 'lucide-react'
import { api } from '@/lib/trpc'
import { cn, calculateTelescope, filterPillClass } from '@/lib/utils'
import { TelescopeForm, type TelescopeInitial } from '@/components/equipment/telescope-form'
import { CameraForm,    type CameraInitial }    from '@/components/equipment/camera-form'
import { MountForm,     type MountInitial }     from '@/components/equipment/mount-form'
import { SetupForm,     type SetupInitial }     from '@/components/equipment/setup-form'
import { AccessoryForm, type AccessoryInitial, ACCESSORY_TYPE_LABELS } from '@/components/equipment/accessory-form'
import { EquipmentFromFITS } from '@/components/equipment/equipment-from-fits'
import { useToast } from '@/components/ui/toast'

type Tab = 'setups' | 'telescopes' | 'cameras' | 'mounts' | 'accessories'

const TABS: { id: Tab; label: string; icon: React.ComponentType<any> }[] = [
  { id: 'setups',      label: 'Meus Setups',  icon: Layers   },
  { id: 'telescopes',  label: 'Telescópios',  icon: Telescope },
  { id: 'cameras',     label: 'Câmeras',      icon: Camera   },
  { id: 'mounts',      label: 'Montagens',    icon: Compass  },
  { id: 'accessories', label: 'Acessórios',   icon: Package  },
]

export default function EquipmentPage() {
  const [tab, setTab] = useState<Tab>('setups')
  const [fromFits, setFromFits] = useState(false)

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="page-header">
        <div>
          <h1 className="page-title">Meu Equipamento</h1>
          <p className="page-subtitle">Telescópios, câmeras, montagens e setups</p>
        </div>
        <button className="btn-secondary flex items-center gap-2" onClick={() => setFromFits(true)}>
          <FileImage className="w-4 h-4" /> Importar de frame FITS
        </button>
      </div>

      <EquipmentFromFITS open={fromFits} onOpenChange={setFromFits} />

      {/* Tabs */}
      <div className="flex gap-1 bg-white/5 p-1 rounded-xl mb-8 w-fit flex-wrap">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={cn(
              'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-150',
              tab === id
                ? 'bg-cosmos-500 text-white shadow-sm'
                : 'text-white/50 hover:text-white/70',
            )}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>

      {tab === 'setups'      && <SetupsTab />}
      {tab === 'telescopes'  && <TelescopesTab />}
      {tab === 'cameras'     && <CamerasTab />}
      {tab === 'mounts'      && <MountsTab />}
      {tab === 'accessories' && <AccessoriesTab />}
    </div>
  )
}

// ─────────────────────────────── Setups ────
function SetupsTab() {
  const [open, setOpen]       = useState(false)
  const [editing, setEditing] = useState<SetupInitial | null>(null)
  const { data: setups, isLoading } = api.setups.list.useQuery()
  const { toast } = useToast()
  const utils = api.useUtils()

  const del = api.setups.delete.useMutation({
    onSuccess: () => { utils.setups.list.invalidate(); toast('Setup removido') },
    onError: (e) => toast(e.message, 'error'),
  })

  function handleEdit(s: any) {
    setEditing({
      id: s.id, name: s.name, telescopeId: s.telescopeId, cameraId: s.cameraId,
      mountId: s.mountId, isDefault: s.isDefault, effectiveFocalMm: s.effectiveFocalMm,
      filtersAvailable: s.filtersAvailable, notes: s.notes,
      accessories: s.accessories,
    })
    setOpen(true)
  }

  function handleClose(v: boolean) {
    setOpen(v)
    if (!v) setEditing(null)
  }

  if (isLoading) return <LoadingGrid />

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button className="btn-primary flex items-center gap-2" onClick={() => setOpen(true)}>
          <Plus className="w-4 h-4" /> Novo Setup
        </button>
      </div>
      {!setups?.length
        ? <EmptyState icon={Layers} title="Nenhum setup criado"
            description="Crie um setup combinando telescópio + câmera + montagem para vincular aos seus projetos." />
        : <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {setups.map(s => (
              <SetupCard key={s.id} setup={s}
                onEdit={() => handleEdit(s)}
                onDelete={() => del.mutate({ id: s.id })} />
            ))}
          </div>}
      <SetupForm open={open} onOpenChange={handleClose} initial={editing ?? undefined} />
    </div>
  )
}

function SetupCard({ setup, onEdit, onDelete }: { setup: any; onEdit: () => void; onDelete: () => void }) {
  const { data: optics } = api.setups.calculateOptics.useQuery({ id: setup.id })
  const effectiveFocal = setup.effectiveFocalMm ?? setup.telescope.focalLengthMm

  return (
    <div className={cn('card p-5 space-y-4', setup.isDefault && 'ring-1 ring-cosmos-500/50')}>
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-white">{setup.name}</h3>
            {setup.isDefault && <span className="badge bg-cosmos-500/20 text-cosmos-300">padrão</span>}
          </div>
          <p className="text-xs text-white/55 mt-0.5">
            {setup._count.projects} projeto{setup._count.projects !== 1 ? 's' : ''}
          </p>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={onEdit} className="btn-ghost p-1.5 text-white/30 hover:text-white/70">
            <Pencil className="w-3.5 h-3.5" />
          </button>
          <button onClick={onDelete} className="btn-ghost p-1.5 text-white/30 hover:text-red-400">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
          <Zap className="w-4 h-4 text-cosmos-400 ml-1" />
        </div>
      </div>

      <div className="space-y-1.5 text-sm">
        <div className="flex items-center gap-2 text-white/70">
          <Telescope className="w-3.5 h-3.5 text-white/30 shrink-0" />
          <span>{setup.telescope.name}</span>
          <span className="text-white/30 text-xs mono">
            {effectiveFocal}mm f/{(setup.telescope.focalRatioOverride ?? effectiveFocal / setup.telescope.apertureMm).toFixed(1)}
          </span>
        </div>
        <div className="flex items-center gap-2 text-white/70">
          <Camera className="w-3.5 h-3.5 text-white/30 shrink-0" />
          <span>{setup.camera.name}</span>
          <span className="text-white/30 text-xs">{setup.camera.colorType}</span>
        </div>
        {setup.mount && (
          <div className="flex items-center gap-2 text-white/70">
            <Compass className="w-3.5 h-3.5 text-white/30 shrink-0" />
            <span>{setup.mount.name}</span>
          </div>
        )}
      </div>

      {optics && (
        <div className="grid grid-cols-3 gap-3 pt-3 border-t border-white/5">
          <Metric label="Escala" value={`${optics.plateScaleArcsecPx}"/px`} />
          <Metric label="FOV" value={`${optics.fovWidthArcmin}' × ${optics.fovHeightArcmin}'`} />
          <Metric
            label="Sampling"
            value={optics.sampling === 'optimal' ? 'Ótimo' : optics.sampling === 'undersampled' ? 'Sub' : 'Super'}
            className={optics.sampling === 'optimal' ? 'text-aurora-400' : 'text-amber-400'}
          />
        </div>
      )}

      {setup.filtersAvailable.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {setup.filtersAvailable.map((f: string) => (
            <span key={f} className={cn('filter-pill', filterPillClass(f))}>{f}</span>
          ))}
        </div>
      )}
    </div>
  )
}

// ──────────────────────────── Telescopes ────
function TelescopesTab() {
  const [open, setOpen]       = useState(false)
  const [editing, setEditing] = useState<TelescopeInitial | null>(null)
  const { data, isLoading }   = api.telescopes.list.useQuery()
  const { toast } = useToast()
  const utils = api.useUtils()

  const del = api.telescopes.delete.useMutation({
    onSuccess: () => { utils.telescopes.list.invalidate(); toast('Telescópio removido') },
    onError: (e) => toast(e.message, 'error'),
  })

  function handleClose(v: boolean) { setOpen(v); if (!v) setEditing(null) }

  if (isLoading) return <LoadingGrid />

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button className="btn-primary flex items-center gap-2" onClick={() => setOpen(true)}>
          <Plus className="w-4 h-4" /> Adicionar Telescópio
        </button>
      </div>
      {!data?.length
        ? <EmptyState icon={Telescope} title="Nenhum telescópio"
            description="Cadastre seu(s) telescópio(s) para criar setups e calcular métricas ópticas." />
        : <div className="equipment-grid">
            {data.map(t => (
              <div key={t.id} className="card p-5 space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-semibold">{t.name}</h3>
                    {t.brand && <p className="text-xs text-white/55">{t.brand} {t.model}</p>}
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="badge bg-white/5 text-white/55 mr-1">{t.opticalDesign ?? 'Telescópio'}</span>
                    <button onClick={() => { setEditing(t); setOpen(true) }} className="btn-ghost p-1.5 text-white/30 hover:text-white/70">
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => del.mutate({ id: t.id })} className="btn-ghost p-1.5 text-white/30 hover:text-red-400">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <Metric label="Focal" value={`${t.focalLengthMm}mm`} />
                  <Metric label="Abertura" value={`${t.apertureMm}mm`} />
                  <Metric label="f/" value={`f/${(t.focalRatioOverride ?? t.focalLengthMm / t.apertureMm).toFixed(1)}`} />
                </div>
                <p className="text-xs text-white/30">
                  {t._count.setups} setup{t._count.setups !== 1 ? 's' : ''} vinculado{t._count.setups !== 1 ? 's' : ''}
                </p>
              </div>
            ))}
          </div>}
      <TelescopeForm open={open} onOpenChange={handleClose} initial={editing ?? undefined} />
    </div>
  )
}

// ─────────────────────────────── Cameras ────
function CamerasTab() {
  const [open, setOpen]       = useState(false)
  const [editing, setEditing] = useState<CameraInitial | null>(null)
  const { data, isLoading }   = api.cameras.list.useQuery()
  const { toast } = useToast()
  const utils = api.useUtils()

  const del = api.cameras.delete.useMutation({
    onSuccess: () => { utils.cameras.list.invalidate(); toast('Câmera removida') },
    onError: (e) => toast(e.message, 'error'),
  })

  function handleClose(v: boolean) { setOpen(v); if (!v) setEditing(null) }

  if (isLoading) return <LoadingGrid />

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button className="btn-primary flex items-center gap-2" onClick={() => setOpen(true)}>
          <Plus className="w-4 h-4" /> Adicionar Câmera
        </button>
      </div>
      {!data?.length
        ? <EmptyState icon={Camera} title="Nenhuma câmera"
            description="Cadastre câmeras para calcular escala de placa, FOV e amostragem." />
        : <div className="equipment-grid">
            {data.map(c => (
              <div key={c.id} className="card p-5 space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-semibold">{c.name}</h3>
                    {c.brand && <p className="text-xs text-white/55">{c.brand} {c.model}</p>}
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="badge bg-white/5 text-white/55">{c.colorType}</span>
                    {c.cooled && <span className="badge bg-blue-500/20 text-blue-300 ml-1">TEC</span>}
                    <button onClick={() => { setEditing(c); setOpen(true) }} className="btn-ghost p-1.5 text-white/30 hover:text-white/70">
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => del.mutate({ id: c.id })} className="btn-ghost p-1.5 text-white/30 hover:text-red-400">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Metric label="Pixel" value={`${c.pixelSizeUm}µm`} />
                  <Metric label="Resolução" value={`${c.sensorWidthPx}×${c.sensorHeightPx}`} />
                </div>
                {c.sensorName && <p className="text-xs text-white/30 mono">Sensor: {c.sensorName}</p>}
                {(c.readNoiseE || c.fullWellCapacity) && (
                  <div className="grid grid-cols-2 gap-3 pt-2 border-t border-white/5">
                    {c.readNoiseE && <Metric label="Read noise" value={`${c.readNoiseE}e⁻`} />}
                    {c.fullWellCapacity && <Metric label="Full well" value={`${(c.fullWellCapacity / 1000).toFixed(0)}ke⁻`} />}
                  </div>
                )}
                <CameraCalibHealth cameraId={c.id} />
              </div>
            ))}
          </div>}
      <CameraForm open={open} onOpenChange={handleClose} initial={editing ?? undefined} />
    </div>
  )
}

// ──────────────────────────────── Mounts ────
function MountsTab() {
  const [open, setOpen]       = useState(false)
  const [editing, setEditing] = useState<MountInitial | null>(null)
  const { data, isLoading }   = api.mounts.list.useQuery()
  const { toast } = useToast()
  const utils = api.useUtils()

  const del = api.mounts.delete.useMutation({
    onSuccess: () => { utils.mounts.list.invalidate(); toast('Montagem removida') },
    onError: (e) => toast(e.message, 'error'),
  })

  function handleClose(v: boolean) { setOpen(v); if (!v) setEditing(null) }

  if (isLoading) return <LoadingGrid />

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button className="btn-primary flex items-center gap-2" onClick={() => setOpen(true)}>
          <Plus className="w-4 h-4" /> Adicionar Montagem
        </button>
      </div>
      {!data?.length
        ? <EmptyState icon={Compass} title="Nenhuma montagem" description="Cadastre suas montagens para completar os setups." />
        : <div className="equipment-grid">
            {data.map(m => (
              <div key={m.id} className="card p-5 space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-semibold">{m.name}</h3>
                    {m.brand && <p className="text-xs text-white/55">{m.brand} {m.model}</p>}
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => { setEditing(m); setOpen(true) }} className="btn-ghost p-1.5 text-white/30 hover:text-white/70">
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => del.mutate({ id: m.id })} className="btn-ghost p-1.5 text-white/30 hover:text-red-400">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Metric label="Tipo" value={m.mountType} />
                  {m.payloadKg && <Metric label="Payload" value={`${m.payloadKg}kg`} />}
                </div>
                <div className="flex gap-2">
                  {m.hasGuidingPort && <span className="badge bg-green-500/10 text-green-400">Guiagem</span>}
                  {m.hasPolarScope  && <span className="badge bg-blue-500/10 text-blue-400">Polar scope</span>}
                </div>
              </div>
            ))}
          </div>}
      <MountForm open={open} onOpenChange={handleClose} initial={editing ?? undefined} />
    </div>
  )
}

// ─────────────────────────── Accessories ────
function AccessoriesTab() {
  const [open, setOpen]       = useState(false)
  const [editing, setEditing] = useState<AccessoryInitial | null>(null)
  const { data, isLoading }   = api.accessories.list.useQuery()
  const { toast } = useToast()
  const utils = api.useUtils()

  const del = api.accessories.delete.useMutation({
    onSuccess: () => { utils.accessories.list.invalidate(); toast('Acessório removido') },
    onError: (e) => toast(e.message, 'error'),
  })

  function handleClose(v: boolean) { setOpen(v); if (!v) setEditing(null) }

  if (isLoading) return <LoadingGrid />

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button className="btn-primary flex items-center gap-2" onClick={() => setOpen(true)}>
          <Plus className="w-4 h-4" /> Adicionar Acessório
        </button>
      </div>
      {!data?.length
        ? <EmptyState icon={Package} title="Nenhum acessório"
            description="Cadastre redutores, barlows, OAGs e outros acessórios para associar aos seus setups." />
        : <div className="equipment-grid">
            {data.map(a => (
              <div key={a.id} className="card p-5 space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-semibold">{a.name}</h3>
                    {a.brand && <p className="text-xs text-white/55">{a.brand} {a.model}</p>}
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="badge bg-white/5 text-white/55 mr-1 text-[10px]">
                      {ACCESSORY_TYPE_LABELS[a.type] ?? a.type}
                    </span>
                    <button onClick={() => { setEditing(a); setOpen(true) }} className="btn-ghost p-1.5 text-white/30 hover:text-white/70">
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => del.mutate({ id: a.id })} className="btn-ghost p-1.5 text-white/30 hover:text-red-400">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
                {a.focalFactor && (
                  <Metric label="Fator focal" value={`×${a.focalFactor}`} />
                )}
                <p className="text-xs text-white/30">
                  {a._count.setupAccessories} setup{a._count.setupAccessories !== 1 ? 's' : ''} vinculado{a._count.setupAccessories !== 1 ? 's' : ''}
                </p>
              </div>
            ))}
          </div>}
      <AccessoryForm open={open} onOpenChange={handleClose} initial={editing ?? undefined} />
    </div>
  )
}

// ────────────────────────── Calibration health ────

const CALIB_EXPIRY_DAYS: Record<string, number> = {
  DARK: 180, BIAS: 365, MASTER_DARK: 180, MASTER_BIAS: 365,
}
const CALIB_SHORT: Record<string, string> = {
  DARK: 'Dark', BIAS: 'Bias', MASTER_DARK: 'M.Dark', MASTER_BIAS: 'M.Bias',
}

function calibDaysLeft(frameType: string, createdAt: Date | string): number {
  const maxDays = CALIB_EXPIRY_DAYS[frameType] ?? 180
  const expiresAt = new Date(new Date(createdAt).getTime() + maxDays * 24 * 60 * 60 * 1000)
  return Math.ceil((expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
}

function CameraCalibHealth({ cameraId }: { cameraId: string }) {
  const { data } = api.calibration.list.useQuery({ cameraId, limit: 50 })
  const frames = data?.items ?? []

  if (!frames.length) return (
    <div className="pt-2 border-t border-white/5">
      <p className="text-[10px] text-white/20 uppercase tracking-wider">Calibração — sem frames</p>
    </div>
  )

  // most-recent frame per type
  const latest: Record<string, (typeof frames)[0]> = {}
  for (const f of frames) {
    const prev = latest[f.frameType]
    if (!prev || new Date(f.createdAt) > new Date(prev.createdAt)) latest[f.frameType] = f
  }

  const show = (['MASTER_DARK', 'MASTER_BIAS', 'DARK', 'BIAS'] as const).filter(t => latest[t])

  return (
    <div className="pt-2 border-t border-white/5">
      <p className="text-[10px] text-white/25 uppercase tracking-wider mb-1.5">Calibração</p>
      <div className="flex flex-wrap gap-1.5">
        {show.map(t => {
          const days = calibDaysLeft(t, latest[t].createdAt)
          const expired = days < 0
          const soon    = days >= 0 && days < 30
          return (
            <span key={t} className={cn(
              'text-[10px] font-medium px-1.5 py-0.5 rounded border',
              expired ? 'bg-red-500/15 text-red-300 border-red-500/25' :
              soon    ? 'bg-amber-500/15 text-amber-300 border-amber-500/25' :
                        'bg-white/5 text-white/50 border-white/10',
            )}>
              {CALIB_SHORT[t]}{expired ? ' !' : soon ? ` ${days}d` : ''}
            </span>
          )
        })}
      </div>
    </div>
  )
}

// ─────────────────────────────── Shared ────
function Metric({ label, value, className }: { label: string; value: string; className?: string }) {
  return (
    <div>
      <p className="text-xs text-white/30 uppercase tracking-wider mb-0.5">{label}</p>
      <p className={cn('text-sm font-medium mono', className ?? 'text-white/80')}>{value}</p>
    </div>
  )
}

function EmptyState({ icon: Icon, title, description }: { icon: any; title: string; description: string }) {
  return (
    <div className="card p-12 flex flex-col items-center justify-center text-center gap-3">
      <Icon className="w-10 h-10 text-white/10" />
      <h3 className="font-medium text-white/50">{title}</h3>
      <p className="text-sm text-white/30 max-w-xs">{description}</p>
    </div>
  )
}

function LoadingGrid() {
  return (
    <div className="equipment-grid">
      {[...Array(4)].map((_, i) => <div key={i} className="card p-5 h-40 animate-pulse" />)}
    </div>
  )
}
