'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Images, Clock, Telescope } from 'lucide-react'
import { api } from '@/lib/trpc'
import { cn, formatIntegration, PROJECT_STATUS_LABELS, PROJECT_STATUS_COLORS } from '@/lib/utils'
import { coverThumbUrl } from '@/lib/thumbnails'

function Cover({ file, alt }: { file: { provider: string; storagePath: string } | null; alt: string }) {
  const [err, setErr] = useState(false)
  const url = file ? coverThumbUrl(file) : null

  if (!url || err) {
    return (
      <div className="w-full aspect-video bg-gradient-to-br from-cosmos-900 to-cosmos-950 flex items-center justify-center">
        <Telescope className="w-8 h-8 text-white/10" />
      </div>
    )
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={url}
      alt={alt}
      loading="lazy"
      onError={() => setErr(true)}
      className="w-full aspect-video object-cover"
      referrerPolicy="no-referrer"
    />
  )
}

export default function PortfolioPage() {
  const { data: items, isLoading } = api.projects.gallery.useQuery()

  const withCover = items?.filter(p => p.cover) ?? []
  const without   = items?.filter(p => !p.cover) ?? []

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="page-header">
        <div>
          <h1 className="page-title">Portfólio</h1>
          <p className="page-subtitle">Galeria visual das suas astrofotografias</p>
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => <div key={i} className="card aspect-video animate-pulse" />)}
        </div>
      ) : !items?.length ? (
        <div className="card p-16 flex flex-col items-center text-center gap-3">
          <Images className="w-12 h-12 text-white/10" />
          <h3 className="font-medium text-white/55">Nenhum projeto ainda</h3>
          <p className="text-sm text-white/25 max-w-xs">Crie projetos e vincule a imagem final pra montar seu portfólio.</p>
        </div>
      ) : (
        <div className="space-y-8">
          {withCover.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {withCover.map(p => (
                <Link key={p.id} href={`/dashboard/projects/${p.id}`}
                  className="card overflow-hidden group hover:ring-1 hover:ring-cosmos-500/40 transition">
                  <Cover file={p.cover} alt={p.name} />
                  <div className="p-3">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="text-sm font-medium text-white truncate group-hover:text-cosmos-300">{p.name}</h3>
                      <span className={cn('badge text-[10px] shrink-0', PROJECT_STATUS_COLORS[p.status])}>
                        {PROJECT_STATUS_LABELS[p.status]}
                      </span>
                    </div>
                    <p className="text-xs text-white/55 truncate mt-0.5">{p.targetObject}</p>
                    <p className="text-[11px] text-white/30 mono mt-1 flex items-center gap-1">
                      <Clock className="w-3 h-3" /> {formatIntegration(p.totalIntegrationMinutes)} · {p.totalLights} lights
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          )}

          {without.length > 0 && (
            <div>
              <p className="text-xs text-white/30 uppercase tracking-wider mb-3">Sem imagem final ainda</p>
              <div className="flex flex-wrap gap-2">
                {without.map(p => (
                  <Link key={p.id} href={`/dashboard/projects/${p.id}`}
                    className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/8 text-xs text-white/50 hover:text-white/80 hover:bg-white/10">
                    {p.name}
                  </Link>
                ))}
              </div>
              <p className="text-[11px] text-white/25 mt-2">
                Vincule a imagem final (Drive) em <span className="text-white/55">Arquivos &amp; Links</span> do projeto pra ela aparecer aqui.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
