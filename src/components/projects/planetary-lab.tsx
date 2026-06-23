'use client'

import { useMemo, useState } from 'react'
import { Download, Copy, Check, Info, HardDriveDownload, UploadCloud, Trash2 } from 'lucide-react'
import { generatePlanetaryScript } from '@/lib/planetary-files'
import { useToast } from '@/components/ui/toast'
import { Modal } from '@/components/ui/modal'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  target: string
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

// O que guardar x o que pode descartar no fluxo planetário.
const KEEP = [
  'Os melhores .ser/.avi brutos (de bom seeing) — arquive no SSD/externo',
  'O TIFF empilhado do AutoStakkert!',
  'O resultado final (RegiStax/AstroSurface/WinJUPOS)',
]
const DROP = [
  '_conv.ser / _conv.avi (cópia reconvertida do AutoStakkert! — refazível)',
  'Arquivos .tmp e sobras de processamento',
  'SERs de seeing ruim que você já descartou na análise',
]

export function PlanetaryLab({ open, onOpenChange, target }: Props) {
  const { toast } = useToast()
  const [copied, setCopied] = useState<string | null>(null)

  const fileBase = target.replace(/[^\w.-]+/g, '_').replace(/^_+|_+$/g, '') || 'planetaria'
  const script = useMemo(() => generatePlanetaryScript(target), [target])

  async function copy(text: string, key: string) {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(key)
      setTimeout(() => setCopied(null), 1500)
    } catch { toast('Não foi possível copiar', 'error') }
  }

  const examples: { label: string; cmd: string }[] = [
    { label: 'Inventário (só lista os vídeos e o tamanho)', cmd: `.\\planetaria_${fileBase}.ps1 -Root "D:\\Planetaria\\${fileBase}"` },
    { label: 'Limpar intermediários (dry-run → executar)', cmd: `.\\planetaria_${fileBase}.ps1 -Root "D:\\Planetaria\\${fileBase}" -Clean -Execute` },
    { label: 'Arquivar brutos + publicar finais', cmd: `.\\planetaria_${fileBase}.ps1 -Root "D:\\Planetaria\\${fileBase}" -Archive -ArchiveDir "E:\\AstroRaw" -Publish -DriveDir "G:\\Meu Drive\\Astro" -Execute` },
  ]

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Planetária — gestão de arquivos"
      description="Inventaria os vídeos, limpa intermediários e arquiva os brutos com segurança (offline, PowerShell)"
      className="max-w-2xl"
    >
      <div className="space-y-4">
        {/* Fluxo + o que guardar */}
        <div className="grid sm:grid-cols-2 gap-3">
          <div className="p-3 rounded-lg bg-white/3 border border-white/8">
            <p className="text-[11px] uppercase tracking-wider text-aurora-300/80 mb-2 flex items-center gap-1.5">
              <HardDriveDownload className="w-3.5 h-3.5" /> Guardar
            </p>
            <ul className="space-y-1.5">
              {KEEP.map((k, i) => <li key={i} className="text-[11px] text-white/55 leading-snug flex gap-1.5"><Check className="w-3 h-3 text-aurora-400 shrink-0 mt-0.5" />{k}</li>)}
            </ul>
          </div>
          <div className="p-3 rounded-lg bg-white/3 border border-white/8">
            <p className="text-[11px] uppercase tracking-wider text-white/40 mb-2 flex items-center gap-1.5">
              <Trash2 className="w-3.5 h-3.5" /> Pode descartar
            </p>
            <ul className="space-y-1.5">
              {DROP.map((d, i) => <li key={i} className="text-[11px] text-white/45 leading-snug flex gap-1.5"><span className="text-white/25 shrink-0">·</span>{d}</li>)}
            </ul>
          </div>
        </div>

        <p className="text-[11px] text-white/40 leading-relaxed">
          Fluxo manual: <strong className="text-white/60">AutoStakkert!</strong> (empilha) →
          <strong className="text-white/60"> RegiStax/AstroSurface</strong> (wavelets) →
          <strong className="text-white/60"> WinJUPOS</strong> (derotação). O app não processa vídeo —
          este script só arruma o que esses programas deixam no disco.
        </p>

        {/* Script preview */}
        <div className="rounded-xl border border-white/8 overflow-hidden">
          <div className="flex items-center justify-between px-3 py-1.5 bg-white/3">
            <span className="text-[10px] uppercase tracking-wider text-white/35">planetaria_{fileBase}.ps1</span>
            <button type="button" onClick={() => copy(script, 'script')} className="btn-ghost flex items-center gap-1 text-[11px] text-white/50 hover:text-white/80">
              {copied === 'script' ? <><Check className="w-3 h-3 text-aurora-400" /> Copiado</> : <><Copy className="w-3 h-3" /> Copiar</>}
            </button>
          </div>
          <pre className="text-[11px] leading-relaxed text-white/70 mono p-3 max-h-64 overflow-auto whitespace-pre">{script}</pre>
        </div>

        <button type="button" className="btn-primary flex items-center gap-1.5 text-xs"
          onClick={() => download(`planetaria_${fileBase}.ps1`, script)}>
          <Download className="w-3.5 h-3.5" /> Baixar script (.ps1)
        </button>

        {/* Exemplos de uso */}
        <div className="space-y-2">
          <p className="text-[11px] uppercase tracking-wider text-white/35 flex items-center gap-1.5">
            <UploadCloud className="w-3.5 h-3.5" /> Como usar
          </p>
          {examples.map((ex, i) => (
            <div key={i}>
              <p className="text-[11px] text-white/45 mb-1">{ex.label}</p>
              <div className="flex items-center gap-2 bg-black/30 rounded-lg px-2.5 py-1.5">
                <code className="text-[10px] mono text-white/60 flex-1 overflow-x-auto whitespace-pre">{ex.cmd}</code>
                <button type="button" onClick={() => copy(ex.cmd, `ex${i}`)} className="btn-ghost text-white/40 hover:text-white/70 shrink-0">
                  {copied === `ex${i}` ? <Check className="w-3.5 h-3.5 text-aurora-400" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="flex items-start gap-2 p-2.5 rounded-lg bg-white/3 border border-white/8">
          <Info className="w-3.5 h-3.5 text-white/30 shrink-0 mt-0.5" />
          <p className="text-[11px] text-white/45 leading-relaxed">
            Seguro por padrão: <strong className="text-white/70">nunca apaga</strong> os brutos (.ser/.avi) nem as imagens
            finais. A limpeza só toca em <code className="text-white/60">_conv</code> e <code className="text-white/60">.tmp</code>,
            movendo para uma lixeira local. <strong className="text-white/70">Arquivar</strong> move os brutos pro SSD/externo
            (preserva, só muda de lugar) e <strong className="text-white/70">publicar</strong> copia os finais pra pasta do Drive.
            Tudo roda em dry-run até você adicionar <code className="text-white/60">-Execute</code>.
          </p>
        </div>
      </div>
    </Modal>
  )
}
