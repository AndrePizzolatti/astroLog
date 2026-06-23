'use client'

import { useEffect, useState } from 'react'
import {
  Link2, HardDrive, ExternalLink, Trash2, Plus, Copy, Check, Cloud, FolderOpen, Pencil,
} from 'lucide-react'
import { api } from '@/lib/trpc'
import { cn, formatFileSize } from '@/lib/utils'
import { useToast } from '@/components/ui/toast'
import { Modal } from '@/components/ui/modal'
import { DrivePicker } from '@/components/projects/drive-picker'

const FILE_TYPES = [
  { value: 'FINAL_JPEG',  label: 'Resultado (JPEG)' },
  { value: 'FINAL_TIFF',  label: 'Resultado (TIFF)' },
  { value: 'STACK',       label: 'Stack final' },
  { value: 'MASTER_DARK', label: 'Master dark' },
  { value: 'MASTER_FLAT', label: 'Master flat' },
  { value: 'OTHER',       label: 'Outro (pasta de brutos…)' },
] as const

interface ProjectFile {
  id: string
  fileType: string
  provider: 'SUPABASE' | 'DRIVE' | 'LOCAL'
  storagePath: string
  label: string
  isFinal: boolean
  sizeBytes: bigint | number | null
}

const PROVIDER_META = {
  DRIVE:    { icon: Cloud,     label: 'Drive',    cls: 'text-aurora-400' },
  LOCAL:    { icon: HardDrive, label: 'Local',    cls: 'text-amber-300' },
  SUPABASE: { icon: Cloud,     label: 'Upload',   cls: 'text-cosmos-400' },
} as const

export function ProjectLinks({ projectId, files }: { projectId: string; files: ProjectFile[] }) {
  const { toast } = useToast()
  const utils = api.useUtils()
  const [addOpen, setAddOpen] = useState(false)
  const [driveOpen, setDriveOpen] = useState(false)
  const [editing, setEditing] = useState<ProjectFile | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const del = api.projects.deleteFile.useMutation({
    onSuccess: () => { utils.projects.byId.invalidate({ id: projectId }); toast('Link removido') },
    onError: (e) => toast(e.message, 'error'),
  })

  async function copyPath(f: ProjectFile) {
    try {
      await navigator.clipboard.writeText(f.storagePath)
      setCopiedId(f.id)
      setTimeout(() => setCopiedId(null), 1500)
    } catch { toast('Não foi possível copiar', 'error') }
  }

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-base font-semibold text-white flex items-center gap-2">
          <FolderOpen className="w-4 h-4 text-white/40" /> Arquivos & Links
        </h2>
        <div className="flex gap-2">
          <button className="btn-secondary flex items-center gap-1.5 text-xs" onClick={() => setDriveOpen(true)}>
            <Cloud className="w-3.5 h-3.5" /> Buscar no Drive
          </button>
          <button className="btn-secondary flex items-center gap-1.5 text-xs" onClick={() => setAddOpen(true)}>
            <Plus className="w-3.5 h-3.5" /> Adicionar link
          </button>
        </div>
      </div>

      {!files.length ? (
        <p className="text-xs text-white/30">
          Vincule o resultado final, masters ou a <strong className="text-white/50">pasta de brutos no Drive</strong> — sem re-upload, só o link.
        </p>
      ) : (
        <div className="space-y-1.5">
          {files.map(f => {
            const meta = PROVIDER_META[f.provider] ?? PROVIDER_META.SUPABASE
            const Icon = meta.icon
            const isUrl = /^https?:\/\//i.test(f.storagePath)
            return (
              <div key={f.id} className="flex items-center gap-3 p-2.5 rounded-lg bg-white/3 border border-white/8">
                <Icon className={cn('w-4 h-4 shrink-0', meta.cls)} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-white/80 truncate">{f.label}</span>
                    {f.isFinal && <span className="badge bg-aurora-400/15 text-aurora-300 text-[10px]">final</span>}
                    <span className="text-[10px] text-white/25 uppercase tracking-wider shrink-0">{meta.label}</span>
                  </div>
                  <p className="text-[11px] text-white/30 mono truncate">{f.storagePath}</p>
                </div>
                {f.sizeBytes != null && (
                  <span className="text-[10px] text-white/25 mono shrink-0">{formatFileSize(f.sizeBytes)}</span>
                )}
                {f.provider === 'DRIVE' && isUrl ? (
                  <a href={f.storagePath} target="_blank" rel="noopener noreferrer"
                     className="btn-ghost p-1.5 text-white/30 hover:text-aurora-400" title="Abrir no Drive">
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                ) : (
                  <button onClick={() => copyPath(f)} className="btn-ghost p-1.5 text-white/30 hover:text-white/70" title="Copiar caminho">
                    {copiedId === f.id ? <Check className="w-3.5 h-3.5 text-aurora-400" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                )}
                <button onClick={() => setEditing(f)} className="btn-ghost p-1.5 text-white/30 hover:text-white/70" title="Editar">
                  <Pencil className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => del.mutate({ fileId: f.id })} className="btn-ghost p-1.5 text-white/30 hover:text-red-400" title="Remover">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            )
          })}
        </div>
      )}

      <AddLinkModal projectId={projectId} open={addOpen} onOpenChange={setAddOpen} />
      <DrivePicker projectId={projectId} open={driveOpen} onOpenChange={setDriveOpen} />
      <EditLinkModal projectId={projectId} file={editing} onClose={() => setEditing(null)} />
    </div>
  )
}

function EditLinkModal({ projectId, file, onClose }: { projectId: string; file: ProjectFile | null; onClose: () => void }) {
  const { toast } = useToast()
  const utils = api.useUtils()
  const [label, setLabel]         = useState('')
  const [reference, setReference] = useState('')
  const [isFinal, setIsFinal]     = useState(false)

  useEffect(() => {
    if (file) { setLabel(file.label); setReference(file.storagePath); setIsFinal(file.isFinal) }
  }, [file])

  const upd = api.projects.updateFile.useMutation({
    onSuccess: () => { utils.projects.byId.invalidate({ id: projectId }); toast('Atualizado!'); onClose() },
    onError: (e) => toast(e.message, 'error'),
  })

  function submit() {
    if (!label.trim() || !reference.trim()) { toast('Preencha nome e caminho', 'error'); return }
    upd.mutate({ fileId: file!.id, label: label.trim(), storagePath: reference.trim(), isFinal })
  }

  return (
    <Modal open={!!file} onOpenChange={v => { if (!v) onClose() }}
      title="Editar arquivo" description="Atualize o nome ou o caminho/link (ex.: depois de mover o arquivo)">
      <div className="space-y-4">
        <div>
          <label className="input-label">Nome</label>
          <input className="input" value={label} onChange={e => setLabel(e.target.value)} />
        </div>
        <div>
          <label className="input-label">Caminho / link</label>
          <input className="input" value={reference} onChange={e => setReference(e.target.value)} />
        </div>
        <label className="flex items-center gap-2 cursor-pointer select-none">
          <span onClick={() => setIsFinal(v => !v)}
            className={cn('w-3.5 h-3.5 rounded border-2 flex items-center justify-center shrink-0', isFinal ? 'bg-aurora-400 border-aurora-400' : 'border-white/30')}>
            {isFinal && <Check className="w-2.5 h-2.5 text-cosmos-950" />}
          </span>
          <span className="text-xs text-white/60" onClick={() => setIsFinal(v => !v)}>Resultado final</span>
        </label>
        <div className="flex justify-end gap-2">
          <button className="btn-secondary" onClick={onClose}>Cancelar</button>
          <button className="btn-primary" disabled={upd.isPending} onClick={submit}>Salvar</button>
        </div>
      </div>
    </Modal>
  )
}

function AddLinkModal({ projectId, open, onOpenChange }: { projectId: string; open: boolean; onOpenChange: (v: boolean) => void }) {
  const { toast } = useToast()
  const utils = api.useUtils()
  const [provider, setProvider] = useState<'DRIVE' | 'LOCAL'>('DRIVE')
  const [label, setLabel]       = useState('')
  const [fileType, setFileType] = useState<string>('FINAL_JPEG')
  const [reference, setReference] = useState('')
  const [isFinal, setIsFinal]   = useState(false)

  const add = api.projects.addFile.useMutation({
    onSuccess: () => {
      utils.projects.byId.invalidate({ id: projectId })
      toast('Link adicionado!')
      reset()
      onOpenChange(false)
    },
    onError: (e) => toast(e.message, 'error'),
  })

  function reset() {
    setProvider('DRIVE'); setLabel(''); setFileType('FINAL_JPEG'); setReference(''); setIsFinal(false)
  }

  function submit() {
    if (!label.trim())     { toast('Dê um nome ao arquivo', 'error'); return }
    if (!reference.trim()) { toast('Cole o link ou caminho', 'error'); return }
    if (provider === 'DRIVE' && !/^https?:\/\//i.test(reference.trim())) {
      toast('Link do Drive deve começar com http(s)://', 'error'); return
    }
    add.mutate({
      projectId,
      provider,
      fileType: fileType as any,
      storagePath: reference.trim(),
      label: label.trim(),
      isFinal,
    })
  }

  return (
    <Modal open={open} onOpenChange={v => { if (!v) reset(); onOpenChange(v) }}
      title="Adicionar link" description="Vincule um arquivo do Drive ou um caminho local — sem upload">
      <div className="space-y-4">
        {/* Provider */}
        <div className="flex items-center gap-1 bg-white/5 p-0.5 rounded-lg w-fit">
          <button type="button" onClick={() => setProvider('DRIVE')}
            className={cn('flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium', provider === 'DRIVE' ? 'bg-cosmos-500 text-white' : 'text-white/50')}>
            <Cloud className="w-3.5 h-3.5" /> Google Drive
          </button>
          <button type="button" onClick={() => setProvider('LOCAL')}
            className={cn('flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium', provider === 'LOCAL' ? 'bg-cosmos-500 text-white' : 'text-white/50')}>
            <HardDrive className="w-3.5 h-3.5" /> Local
          </button>
        </div>

        <div>
          <label className="input-label">Nome *</label>
          <input className="input" value={label} onChange={e => setLabel(e.target.value)}
            placeholder={provider === 'DRIVE' ? 'Resultado final SHO' : 'Pasta de brutos — HD externo'} />
        </div>

        <div>
          <label className="input-label">Tipo</label>
          <select className="input" value={fileType} onChange={e => setFileType(e.target.value)}>
            {FILE_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </div>

        <div>
          <label className="input-label">{provider === 'DRIVE' ? 'Link do Drive *' : 'Caminho local *'}</label>
          <input className="input" value={reference} onChange={e => setReference(e.target.value)}
            placeholder={provider === 'DRIVE' ? 'https://drive.google.com/…' : 'D:\\Astro\\NGC3372\\…'} />
          <p className="text-[11px] text-white/30 mt-1">
            {provider === 'DRIVE'
              ? 'Cole o link de compartilhamento do arquivo ou pasta.'
              : 'O caminho fica registrado para referência (o navegador não abre arquivos locais).'}
          </p>
        </div>

        <label className="flex items-center gap-2 cursor-pointer select-none">
          <span onClick={() => setIsFinal(v => !v)}
            className={cn('w-3.5 h-3.5 rounded border-2 flex items-center justify-center shrink-0', isFinal ? 'bg-aurora-400 border-aurora-400' : 'border-white/30')}>
            {isFinal && <Check className="w-2.5 h-2.5 text-cosmos-950" />}
          </span>
          <span className="text-xs text-white/60" onClick={() => setIsFinal(v => !v)}>Marcar como resultado final</span>
        </label>

        <div className="flex justify-end gap-2 pt-1">
          <button type="button" className="btn-secondary" onClick={() => onOpenChange(false)}>Cancelar</button>
          <button type="button" className="btn-primary flex items-center gap-1.5" disabled={add.isPending} onClick={submit}>
            <Link2 className="w-3.5 h-3.5" /> {add.isPending ? 'Salvando…' : 'Adicionar'}
          </button>
        </div>
      </div>
    </Modal>
  )
}
