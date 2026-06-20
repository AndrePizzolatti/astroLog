'use client'

import { useMemo, useState } from 'react'
import { Download, Copy, Check, Trash2, Info, ChevronDown } from 'lucide-react'
import { generateSirilScript, generateCleanupScript, type SirilScriptOptions } from '@/lib/siril-script'
import { useToast } from '@/components/ui/toast'
import { Modal } from '@/components/ui/modal'
import { cn } from '@/lib/utils'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  target: string
  isOSCDefault: boolean
  filters: string[]
}

function download(name: string, content: string) {
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  URL.revokeObjectURL(url)
}

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: () => void; label: string }) {
  return (
    <button type="button" onClick={onChange} className="flex items-center gap-2 text-left">
      <span className={cn(
        'w-3.5 h-3.5 rounded border-2 flex items-center justify-center shrink-0',
        checked ? 'bg-aurora-400 border-aurora-400' : 'border-white/30',
      )}>
        {checked && <Check className="w-2.5 h-2.5 text-cosmos-950" />}
      </span>
      <span className="text-xs text-white/70">{label}</span>
    </button>
  )
}

export function SirilLab({ open, onOpenChange, target, isOSCDefault, filters }: Props) {
  const { toast } = useToast()
  const [isOSC, setIsOSC]   = useState(isOSCDefault)
  const [hasDarks, setDarks] = useState(true)
  const [hasFlats, setFlats] = useState(true)
  const [hasBias, setBias]   = useState(false)
  const [extractHaOIII, setExtract] = useState(false)
  const [copied, setCopied] = useState(false)
  const [agentOpen, setAgentOpen] = useState(false)

  const opts: SirilScriptOptions = { target, isOSC, filters, hasBias, hasDarks, hasFlats, extractHaOIII }
  const script  = useMemo(() => generateSirilScript(opts), [target, isOSC, hasBias, hasDarks, hasFlats, extractHaOIII, filters.join(',')]) // eslint-disable-line react-hooks/exhaustive-deps
  const cleanup = useMemo(() => generateCleanupScript(target), [target])

  const fileBase = target.replace(/[^\w.-]+/g, '_').replace(/^_+|_+$/g, '') || 'projeto'

  async function copy() {
    try {
      await navigator.clipboard.writeText(script)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch { toast('Não foi possível copiar', 'error') }
  }

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Siril — gerar script de processamento"
      description="Gera um .ssf sob medida pro projeto e um script de limpeza segura dos intermediários"
      className="max-w-2xl"
    >
      <div className="space-y-4">
        {/* Options */}
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2.5">
          <div className="flex items-center gap-1 bg-white/5 p-0.5 rounded-lg">
            <button
              type="button"
              onClick={() => setIsOSC(true)}
              className={cn('px-2.5 py-1 rounded-md text-xs font-medium', isOSC ? 'bg-cosmos-500 text-white' : 'text-white/50')}
            >Colorida (OSC)</button>
            <button
              type="button"
              onClick={() => setIsOSC(false)}
              className={cn('px-2.5 py-1 rounded-md text-xs font-medium', !isOSC ? 'bg-cosmos-500 text-white' : 'text-white/50')}
            >Mono</button>
          </div>
          <Toggle checked={hasDarks} onChange={() => setDarks(v => !v)} label="Tenho darks" />
          <Toggle checked={hasFlats} onChange={() => setFlats(v => !v)} label="Tenho flats" />
          <Toggle checked={hasBias}  onChange={() => setBias(v => !v)}  label="Tenho biases" />
          {isOSC && (
            <Toggle checked={extractHaOIII} onChange={() => setExtract(v => !v)} label="Extrair Ha/OIII (dual-band)" />
          )}
        </div>

        {!isOSC && (
          <p className="text-[11px] text-white/35">
            Modo mono: um bloco por filtro detectado{filters.length ? ` (${filters.join(', ')})` : ' — nenhum filtro registrado ainda'}.
            Organize os lights em subpastas com o nome do filtro.
          </p>
        )}

        {/* Script preview */}
        <div className="rounded-xl border border-white/8 overflow-hidden">
          <div className="flex items-center justify-between px-3 py-1.5 bg-white/3">
            <span className="text-[10px] uppercase tracking-wider text-white/35">{fileBase}.ssf</span>
            <button type="button" onClick={copy} className="btn-ghost flex items-center gap-1 text-[11px] text-white/50 hover:text-white/80">
              {copied ? <><Check className="w-3 h-3 text-aurora-400" /> Copiado</> : <><Copy className="w-3 h-3" /> Copiar</>}
            </button>
          </div>
          <pre className="text-[11px] leading-relaxed text-white/70 mono p-3 max-h-64 overflow-auto whitespace-pre">{script}</pre>
        </div>

        {/* Downloads */}
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn-primary flex items-center gap-1.5 text-xs" onClick={() => download(`${fileBase}.ssf`, script)}>
            <Download className="w-3.5 h-3.5" /> Baixar .ssf
          </button>
          <button type="button" className="btn-secondary flex items-center gap-1.5 text-xs" onClick={() => download(`limpar_${fileBase}.ps1`, cleanup)}>
            <Trash2 className="w-3.5 h-3.5" /> Baixar limpeza (.ps1)
          </button>
        </div>

        <div className="flex items-start gap-2 p-2.5 rounded-lg bg-white/3 border border-white/8">
          <Info className="w-3.5 h-3.5 text-white/30 shrink-0 mt-0.5" />
          <p className="text-[11px] text-white/45 leading-relaxed">
            A limpeza <strong className="text-white/70">nunca apaga</strong> lights, darks, flats, biases nem os resultados
            (<code className="text-white/60">*_stacked</code>, <code className="text-white/60">*starless*</code>…). Ela só move os
            intermediários da pasta <code className="text-white/60">process/</code> para uma lixeira, e só depois que confirma
            que existe um resultado final. Roda em dry-run por padrão.
          </p>
        </div>

        {/* Local agent (roadmap) */}
        <div className="rounded-lg border border-white/8">
          <button
            type="button"
            onClick={() => setAgentOpen(v => !v)}
            className="w-full flex items-center justify-between px-3 py-2.5 text-left"
          >
            <span className="text-xs font-medium text-white/70">Rodar tudo automático com o agente local</span>
            <ChevronDown className={cn('w-4 h-4 text-white/30 transition-transform', agentOpen && 'rotate-180')} />
          </button>
          {agentOpen && (
            <div className="px-3 pb-3 text-[11px] text-white/45 leading-relaxed space-y-2">
              <p>
                O app web não roda o Siril direto (é binário nativo). O <strong className="text-white/70">agente local</strong> é
                um programinha Node que roda o <code className="text-white/60">siril-cli</code> na sua máquina, faz a limpeza
                segura e reporta o resultado de volta — registrando o final como link Local no projeto.
              </p>
              <ol className="list-decimal list-inside space-y-1 text-white/50">
                <li>Gere um token em <a href="/dashboard/settings" className="text-aurora-400 hover:underline">Configurações → Agente local</a>.</li>
                <li>Baixe o agente e o README ali e crie o <code className="text-white/60">siril-agent.config.json</code>.</li>
                <li>Salve o <code className="text-white/60">.ssf</code> acima na pasta do projeto e rode:</li>
              </ol>
              <pre className="text-[10px] mono text-white/60 bg-black/30 rounded p-2 overflow-x-auto whitespace-pre">node siril-agent.mjs --project &lt;id&gt; --folder &quot;D:/Astro/{fileBase}&quot; --script &quot;{fileBase}.ssf&quot;</pre>
              <div className="flex gap-2">
                <a href="/agent/siril-agent.mjs" download className="btn-ghost flex items-center gap-1.5 text-[11px] text-white/50">
                  <Download className="w-3 h-3" /> Baixar agente
                </a>
                <a href="/dashboard/settings" className="btn-ghost flex items-center gap-1.5 text-[11px] text-aurora-400">
                  Gerar token
                </a>
              </div>
            </div>
          )}
        </div>
      </div>
    </Modal>
  )
}
