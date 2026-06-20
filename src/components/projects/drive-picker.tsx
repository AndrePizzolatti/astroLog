'use client'

import { useEffect, useState } from 'react'
import { signIn } from 'next-auth/react'
import { Cloud, Folder, FileImage, File as FileIcon, Check, ChevronRight, Search, Loader2, Home } from 'lucide-react'
import { api } from '@/lib/trpc'
import { cn } from '@/lib/utils'
import { useToast } from '@/components/ui/toast'
import { Modal } from '@/components/ui/modal'

interface Props {
  projectId: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

interface Picked { id: string; name: string; link: string; isFolder: boolean }

function fileTypeFor(name: string, isFolder: boolean): 'OTHER' | 'FINAL_JPEG' | 'FINAL_TIFF' {
  if (isFolder) return 'OTHER'
  const n = name.toLowerCase()
  if (n.endsWith('.tif') || n.endsWith('.tiff')) return 'FINAL_TIFF'
  if (/\.(jpe?g|png)$/.test(n)) return 'FINAL_JPEG'
  return 'OTHER'
}

export function DrivePicker({ projectId, open, onOpenChange }: Props) {
  const { toast } = useToast()
  const utils = api.useUtils()

  const { data: status, isLoading: statusLoading } = api.drive.status.useQuery(undefined, { enabled: open })
  const connected = status?.connected

  // Navegação
  const [stack, setStack]   = useState<{ id?: string; name: string }[]>([{ name: 'Meu Drive' }])
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [picked, setPicked] = useState<Map<string, Picked>>(new Map())
  const [submitting, setSubmitting] = useState(false)

  const current = stack[stack.length - 1]

  // debounce da busca
  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput.trim()), 400)
    return () => clearTimeout(t)
  }, [searchInput])

  // reset ao fechar
  useEffect(() => {
    if (!open) {
      setStack([{ name: 'Meu Drive' }]); setSearchInput(''); setSearch(''); setPicked(new Map()); setSubmitting(false)
    }
  }, [open])

  const { data, isFetching } = api.drive.list.useQuery(
    { folderId: search ? undefined : current.id, search: search || undefined },
    { enabled: !!open && !!connected, staleTime: 30_000 },
  )

  const addFile = api.projects.addFile.useMutation()

  function toggle(item: Picked) {
    setPicked(prev => {
      const next = new Map(prev)
      if (next.has(item.id)) next.delete(item.id); else next.set(item.id, item)
      return next
    })
  }

  function openFolder(id: string, name: string) {
    setSearchInput(''); setSearch('')
    setStack(s => [...s, { id, name }])
  }

  function goTo(i: number) {
    setSearchInput(''); setSearch('')
    setStack(s => s.slice(0, i + 1))
  }

  async function confirm() {
    if (picked.size === 0) return
    setSubmitting(true)
    try {
      await Promise.all([...picked.values()].map(p =>
        addFile.mutateAsync({
          projectId,
          provider:    'DRIVE',
          storagePath: p.link,
          label:       p.name,
          fileType:    fileTypeFor(p.name, p.isFolder),
        }),
      ))
      utils.projects.byId.invalidate({ id: projectId })
      toast(`${picked.size} link(s) do Drive adicionado(s)!`)
      onOpenChange(false)
    } catch (e: any) {
      toast(e.message ?? 'Erro ao vincular', 'error')
      setSubmitting(false)
    }
  }

  return (
    <Modal open={open} onOpenChange={onOpenChange}
      title="Buscar no Google Drive"
      description="Navegue ou busque e vincule arquivos/pastas — guarda só o link"
      className="max-w-2xl">

      {statusLoading ? (
        <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 text-white/30 animate-spin" /></div>
      ) : !connected ? (
        <div className="flex flex-col items-center gap-3 py-8 text-center">
          <Cloud className="w-8 h-8 text-white/25" />
          <p className="text-sm text-white/60 max-w-sm">
            Conecte sua conta Google com permissão de leitura do Drive para navegar e vincular arquivos.
          </p>
          <button className="btn-primary flex items-center gap-2" onClick={() => signIn('google', { callbackUrl: window.location.href })}>
            <Cloud className="w-4 h-4" /> Conectar Google Drive
          </button>
          <p className="text-[11px] text-white/25 max-w-xs">
            Você será levado ao login do Google para autorizar o acesso de leitura de metadados.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/30" />
            <input
              className="input pl-8 h-9 text-sm"
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
              placeholder="Buscar no Drive…"
            />
          </div>

          {/* Breadcrumb (só no modo navegação) */}
          {!search && (
            <div className="flex items-center gap-1 text-xs text-white/40 flex-wrap">
              {stack.map((s, i) => (
                <span key={i} className="flex items-center gap-1">
                  {i > 0 && <ChevronRight className="w-3 h-3 text-white/20" />}
                  <button
                    onClick={() => goTo(i)}
                    className={cn('hover:text-white/70 flex items-center gap-1', i === stack.length - 1 && 'text-white/70')}
                  >
                    {i === 0 && <Home className="w-3 h-3" />}{s.name}
                  </button>
                </span>
              ))}
            </div>
          )}

          {/* List */}
          <div className="border border-white/8 rounded-xl overflow-hidden">
            <div className="max-h-80 overflow-y-auto divide-y divide-white/5">
              {isFetching && !data ? (
                <div className="flex justify-center py-10"><Loader2 className="w-5 h-5 text-white/30 animate-spin" /></div>
              ) : !data?.items.length ? (
                <p className="text-xs text-white/30 text-center py-10">{search ? 'Nada encontrado.' : 'Pasta vazia.'}</p>
              ) : (
                data.items.map(item => {
                  const checked = picked.has(item.id)
                  const Icon = item.isFolder ? Folder : /\.(jpe?g|png|tif|tiff|fits?)$/i.test(item.name) ? FileImage : FileIcon
                  return (
                    <div key={item.id} className={cn('flex items-center gap-2.5 px-3 py-2', checked && 'bg-aurora-400/5')}>
                      <button
                        onClick={() => toggle({ id: item.id, name: item.name, link: item.link, isFolder: item.isFolder })}
                        className={cn('w-3.5 h-3.5 rounded border-2 flex items-center justify-center shrink-0',
                          checked ? 'bg-aurora-400 border-aurora-400' : 'border-white/30')}
                      >
                        {checked && <Check className="w-2.5 h-2.5 text-cosmos-950" />}
                      </button>
                      <Icon className={cn('w-4 h-4 shrink-0', item.isFolder ? 'text-cosmos-400' : 'text-white/40')} />
                      {item.isFolder && !search ? (
                        <button onClick={() => openFolder(item.id, item.name)} className="flex-1 min-w-0 text-left text-sm text-white/80 truncate hover:text-white">
                          {item.name}
                        </button>
                      ) : (
                        <span className="flex-1 min-w-0 text-sm text-white/80 truncate">{item.name}</span>
                      )}
                      {item.isFolder && !search && <ChevronRight className="w-3.5 h-3.5 text-white/20 shrink-0" />}
                    </div>
                  )
                })
              )}
            </div>
          </div>

          <div className="flex items-center justify-between pt-1">
            <span className="text-xs text-white/40">{picked.size} selecionado(s)</span>
            <div className="flex gap-2">
              <button className="btn-secondary" onClick={() => onOpenChange(false)}>Cancelar</button>
              <button className="btn-primary" disabled={picked.size === 0 || submitting} onClick={confirm}>
                {submitting ? 'Vinculando…' : `Vincular ${picked.size || ''}`.trim()}
              </button>
            </div>
          </div>
        </div>
      )}
    </Modal>
  )
}
