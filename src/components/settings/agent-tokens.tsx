'use client'

import { useState } from 'react'
import { Terminal, Plus, Trash2, Copy, Check, KeyRound, Download } from 'lucide-react'
import { api } from '@/lib/trpc'
import { cn, formatRelative } from '@/lib/utils'
import { useToast } from '@/components/ui/toast'

export function AgentTokens() {
  const { toast } = useToast()
  const utils = api.useUtils()
  const { data: tokens } = api.agent.listTokens.useQuery()

  const [label, setLabel] = useState('')
  const [created, setCreated] = useState<{ token: string } | null>(null)
  const [copied, setCopied] = useState(false)

  const create = api.agent.createToken.useMutation({
    onSuccess: (res) => {
      utils.agent.listTokens.invalidate()
      setCreated({ token: res.token })
      setLabel('')
    },
    onError: (e) => toast(e.message, 'error'),
  })

  const revoke = api.agent.revokeToken.useMutation({
    onSuccess: () => { utils.agent.listTokens.invalidate(); toast('Token revogado') },
    onError: (e) => toast(e.message, 'error'),
  })

  async function copy() {
    if (!created) return
    try { await navigator.clipboard.writeText(created.token); setCopied(true); setTimeout(() => setCopied(false), 1500) }
    catch { toast('Não foi possível copiar', 'error') }
  }

  return (
    <div className="card p-5 space-y-4">
      <div className="flex items-center gap-3">
        <Terminal className="w-4 h-4 text-cosmos-400" />
        <h2 className="text-sm font-semibold text-white">Agente local</h2>
      </div>
      <p className="text-xs text-white/55">
        Gere um token para o agente do Siril rodar o processamento na sua máquina e reportar de volta.
        O token aparece <strong className="text-white/60">uma única vez</strong>.
      </p>

      {/* Download do agente */}
      <div className="flex flex-wrap gap-2">
        <a href="/agent/siril-agent.mjs" download className="btn-secondary flex items-center gap-1.5 text-xs">
          <Download className="w-3.5 h-3.5" /> Baixar agente (.mjs)
        </a>
        <a href="/agent/README.md" download className="btn-ghost flex items-center gap-1.5 text-xs text-white/50">
          <Download className="w-3.5 h-3.5" /> Instruções (README)
        </a>
      </div>

      {/* Token recém-criado */}
      {created && (
        <div className="p-3 rounded-lg bg-aurora-400/8 border border-aurora-400/25 space-y-2">
          <p className="text-[11px] text-aurora-300">Copie agora — não será mostrado de novo:</p>
          <div className="flex items-center gap-2">
            <code className="flex-1 text-[11px] mono text-white/80 bg-black/30 rounded px-2 py-1.5 truncate">{created.token}</code>
            <button onClick={copy} className="btn-ghost p-1.5 text-white/50 hover:text-white/80" title="Copiar">
              {copied ? <Check className="w-3.5 h-3.5 text-aurora-400" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>
      )}

      {/* Criar token */}
      <div className="flex gap-2">
        <input
          className="input flex-1"
          value={label}
          onChange={e => setLabel(e.target.value)}
          placeholder="Nome do dispositivo (ex.: PC do observatório)"
          onKeyDown={e => { if (e.key === 'Enter' && label.trim()) create.mutate({ label: label.trim() }) }}
        />
        <button
          className="btn-primary flex items-center gap-1.5 shrink-0"
          disabled={!label.trim() || create.isPending}
          onClick={() => create.mutate({ label: label.trim() })}
        >
          <Plus className="w-4 h-4" /> Gerar
        </button>
      </div>

      {/* Lista */}
      {tokens && tokens.length > 0 && (
        <div className="space-y-1.5">
          {tokens.map(t => (
            <div key={t.id} className="flex items-center gap-3 p-2.5 rounded-lg bg-white/3 border border-white/8">
              <KeyRound className="w-3.5 h-3.5 text-white/30 shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-sm text-white/80 truncate">{t.label}</p>
                <p className="text-[10px] text-white/30">
                  {t.lastUsedAt ? `usado ${formatRelative(t.lastUsedAt)}` : 'nunca usado'}
                </p>
              </div>
              <button
                onClick={() => { if (confirm(`Revogar o token "${t.label}"?`)) revoke.mutate({ id: t.id }) }}
                className={cn('btn-ghost p-1.5 text-white/30 hover:text-red-400')}
                title="Revogar"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
