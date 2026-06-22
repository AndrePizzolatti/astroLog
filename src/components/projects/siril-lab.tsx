'use client'

import { useMemo, useState } from 'react'
import { Download, Copy, Check, Trash2, Info, ChevronDown } from 'lucide-react'
import {
  generateSirilScript, generateCleanupScript, generateSHOScript, generateShoPixelMath,
  type SirilScriptOptions,
} from '@/lib/siril-script'
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

type Mode = 'osc' | 'mono' | 'sho'

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
  const [mode, setMode] = useState<Mode>(isOSCDefault ? 'osc' : 'mono')

  const [hasDarks, setDarks] = useState(true)
  const [hasFlats, setFlats] = useState(true)
  const [hasBias, setBias]   = useState(false)
  const [hasDarkFlats, setDarkFlats] = useState(true)
  const [extractHaOIII, setExtract] = useState(false)

  // SHO
  const [haoiiiNights, setHaoiii]   = useState(1)
  const [siioiiiNights, setSiioiii] = useState(1)
  const [wS, setWS] = useState(1.2)
  const [wH, setWH] = useState(0.7)
  const [wO, setWO] = useState(1.0)

  const [copied, setCopied] = useState(false)
  const [agentOpen, setAgentOpen] = useState(false)

  const fileBase = target.replace(/[^\w.-]+/g, '_').replace(/^_+|_+$/g, '') || 'projeto'

  const script = useMemo(() => {
    if (mode === 'sho') {
      return generateSHOScript({ target, haoiiiNights, siioiiiNights, hasDarks, hasDarkFlats, hasBias })
    }
    const opts: SirilScriptOptions = {
      target, isOSC: mode === 'osc', filters, hasBias, hasDarks, hasFlats, hasDarkFlats, extractHaOIII,
    }
    return generateSirilScript(opts)
  }, [mode, target, haoiiiNights, siioiiiNights, hasBias, hasDarks, hasFlats, hasDarkFlats, extractHaOIII, filters.join(',')]) // eslint-disable-line react-hooks/exhaustive-deps

  const pixelMath = useMemo(
    () => mode === 'sho' ? generateShoPixelMath(target, { s: wS, h: wH, o: wO }) : '',
    [mode, target, wS, wH, wO],
  )
  const cleanup = useMemo(() => generateCleanupScript(target), [target])

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch { toast('Não foi possível copiar', 'error') }
  }

  const MODES: { id: Mode; label: string }[] = [
    { id: 'osc',  label: 'Colorida (OSC)' },
    { id: 'mono', label: 'Mono' },
    { id: 'sho',  label: 'SHO (OSC)' },
  ]

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Siril — gerar script de processamento"
      description="Gera um .ssf sob medida pro projeto e um script de limpeza segura dos intermediários"
      className="max-w-2xl"
    >
      <div className="space-y-4">
        {/* Mode + calibration toggles */}
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2.5">
          <div className="flex items-center gap-1 bg-white/5 p-0.5 rounded-lg">
            {MODES.map(m => (
              <button
                key={m.id}
                type="button"
                onClick={() => setMode(m.id)}
                className={cn('px-2.5 py-1 rounded-md text-xs font-medium', mode === m.id ? 'bg-cosmos-500 text-white' : 'text-white/50')}
              >{m.label}</button>
            ))}
          </div>
          <Toggle checked={hasDarks} onChange={() => setDarks(v => !v)} label="Tenho darks" />
          {mode !== 'sho' && <Toggle checked={hasFlats} onChange={() => setFlats(v => !v)} label="Tenho flats" />}
          <Toggle checked={hasDarkFlats} onChange={() => setDarkFlats(v => !v)} label="Tenho dark flats" />
          <Toggle checked={hasBias}  onChange={() => setBias(v => !v)}  label="Tenho biases" />
          {mode === 'osc' && (
            <Toggle checked={extractHaOIII} onChange={() => setExtract(v => !v)} label="Extrair Ha/OIII (dual-band)" />
          )}
        </div>

        {mode === 'mono' && (
          <p className="text-[11px] text-white/35">
            Modo mono: um bloco por filtro detectado{filters.length ? ` (${filters.join(', ')})` : ' — nenhum filtro registrado ainda'}.
            Organize os lights em subpastas com o nome do filtro.
          </p>
        )}

        {/* SHO controls */}
        {mode === 'sho' && (
          <div className="space-y-3 p-3 rounded-lg bg-white/3 border border-white/8">
            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="input-label">Noites com Ha+OIII</span>
                <input type="number" min={0} max={20} value={haoiiiNights}
                  onChange={e => setHaoiii(Math.max(0, parseInt(e.target.value) || 0))} className="input h-9 text-sm" />
              </label>
              <label className="block">
                <span className="input-label">Noites com SII+OIII</span>
                <input type="number" min={0} max={20} value={siioiiiNights}
                  onChange={e => setSiioiii(Math.max(0, parseInt(e.target.value) || 0))} className="input h-9 text-sm" />
              </label>
            </div>
            <p className="text-[11px] text-white/35">
              Flats são por noite (<code className="text-white/55">haoiii_1/flats</code>…). O <strong className="text-white/60">OIII é
              empilhado de todas as noites</strong> (Ha+OIII e SII+OIII juntos) para o melhor SNR.
            </p>
            <div>
              <span className="input-label">Pesos do SHO (PixelMath)</span>
              <div className="grid grid-cols-3 gap-2">
                {([['SII', wS, setWS], ['Ha', wH, setWH], ['OIII', wO, setWO]] as const).map(([lbl, val, set]) => (
                  <label key={lbl} className="flex items-center gap-1.5">
                    <span className="text-[11px] text-white/50 w-8">{lbl}</span>
                    <input type="number" step={0.05} min={0} max={3} value={val}
                      onChange={e => set(parseFloat(e.target.value) || 0)} className="input h-8 text-xs mono" />
                  </label>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Script preview */}
        <div className="rounded-xl border border-white/8 overflow-hidden">
          <div className="flex items-center justify-between px-3 py-1.5 bg-white/3">
            <span className="text-[10px] uppercase tracking-wider text-white/35">{fileBase}{mode === 'sho' ? '_SHO' : ''}.ssf</span>
            <button type="button" onClick={() => copy(script)} className="btn-ghost flex items-center gap-1 text-[11px] text-white/50 hover:text-white/80">
              {copied ? <><Check className="w-3 h-3 text-aurora-400" /> Copiado</> : <><Copy className="w-3 h-3" /> Copiar</>}
            </button>
          </div>
          <pre className="text-[11px] leading-relaxed text-white/70 mono p-3 max-h-64 overflow-auto whitespace-pre">{script}</pre>
        </div>

        {/* Downloads */}
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn-primary flex items-center gap-1.5 text-xs"
            onClick={() => download(`${fileBase}${mode === 'sho' ? '_SHO' : ''}.ssf`, script)}>
            <Download className="w-3.5 h-3.5" /> Baixar .ssf
          </button>
          {mode === 'sho' && (
            <button type="button" className="btn-secondary flex items-center gap-1.5 text-xs"
              onClick={() => download(`${fileBase}_SHO_pixelmath.txt`, pixelMath)}>
              <Download className="w-3.5 h-3.5" /> Receita PixelMath
            </button>
          )}
          <button type="button" className="btn-secondary flex items-center gap-1.5 text-xs" onClick={() => download(`limpar_${fileBase}.ps1`, cleanup)}>
            <Trash2 className="w-3.5 h-3.5" /> Baixar limpeza (.ps1)
          </button>
        </div>

        {/* PixelMath preview (SHO) */}
        {mode === 'sho' && (
          <div className="rounded-xl border border-white/8 overflow-hidden">
            <div className="flex items-center justify-between px-3 py-1.5 bg-white/3">
              <span className="text-[10px] uppercase tracking-wider text-white/35">PixelMath SHO (PixInsight)</span>
              <button type="button" onClick={() => copy(pixelMath)} className="btn-ghost flex items-center gap-1 text-[11px] text-white/50 hover:text-white/80">
                <Copy className="w-3 h-3" /> Copiar
              </button>
            </div>
            <pre className="text-[11px] leading-relaxed text-white/70 mono p-3 max-h-40 overflow-auto whitespace-pre">{pixelMath}</pre>
          </div>
        )}

        <div className="flex items-start gap-2 p-2.5 rounded-lg bg-white/3 border border-white/8">
          <Info className="w-3.5 h-3.5 text-white/30 shrink-0 mt-0.5" />
          <p className="text-[11px] text-white/45 leading-relaxed">
            A limpeza <strong className="text-white/70">nunca apaga</strong> lights, darks, flats, biases nem os resultados
            (<code className="text-white/60">*_stacked</code>, <code className="text-white/60">*starless*</code>…). Ela só move os
            intermediários da pasta <code className="text-white/60">process/</code> para uma lixeira, e só depois que confirma
            que existe um resultado final. Roda em dry-run por padrão.
          </p>
        </div>

        {/* Local agent */}
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
