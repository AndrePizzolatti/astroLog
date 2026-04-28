'use client'

import { useSession } from 'next-auth/react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { api } from '@/lib/trpc'
import { useToast } from '@/components/ui/toast'
import { MapPin, User } from 'lucide-react'

const schema = z.object({
  latitude:  z.coerce.number().min(-90).max(90).optional().or(z.literal('')).transform(v => v === '' ? undefined : Number(v)),
  longitude: z.coerce.number().min(-180).max(180).optional().or(z.literal('')).transform(v => v === '' ? undefined : Number(v)),
  timezone:  z.string().optional(),
  bio:       z.string().max(500).optional(),
})

type FormValues = z.input<typeof schema>

export default function SettingsPage() {
  const { data: session } = useSession()
  const { toast } = useToast()

  const { register, handleSubmit, formState: { isSubmitting } } = useForm<FormValues>({
    resolver: zodResolver(schema),
  })

  return (
    <div className="p-8 max-w-2xl mx-auto space-y-8">
      <div className="page-header">
        <div>
          <h1 className="page-title">Configurações</h1>
          <p className="page-subtitle">Perfil e preferências de localização</p>
        </div>
      </div>

      {/* Profile */}
      <div className="card p-5 space-y-4">
        <div className="flex items-center gap-3">
          <User className="w-4 h-4 text-cosmos-400" />
          <h2 className="text-sm font-semibold text-white">Perfil</h2>
        </div>
        <div className="flex items-center gap-3">
          {session?.user?.image && (
            <img src={session.user.image} alt="" className="w-10 h-10 rounded-full" />
          )}
          <div>
            <p className="text-sm font-medium text-white">{session?.user?.name}</p>
            <p className="text-xs text-white/40">{session?.user?.email}</p>
          </div>
        </div>
        <div>
          <label className="input-label">Bio</label>
          <textarea {...register('bio')} className="input" rows={3} placeholder="Astrofotógrafo amador…" />
          <p className="text-xs text-white/25 mt-1">Aparece no perfil público (se publicado)</p>
        </div>
      </div>

      {/* Location */}
      <div className="card p-5 space-y-4">
        <div className="flex items-center gap-3">
          <MapPin className="w-4 h-4 text-cosmos-400" />
          <h2 className="text-sm font-semibold text-white">Localização</h2>
        </div>
        <p className="text-xs text-white/40">
          Usada para calcular a previsão do tempo local e objetos visíveis da sua posição.
        </p>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="input-label">Latitude</label>
            <input {...register('latitude')} type="number" step="0.0001" className="input" placeholder="-27.5969" />
          </div>
          <div>
            <label className="input-label">Longitude</label>
            <input {...register('longitude')} type="number" step="0.0001" className="input" placeholder="-48.5495" />
          </div>
        </div>
        <div>
          <label className="input-label">Fuso horário</label>
          <select {...register('timezone')} className="input">
            <option value="America/Sao_Paulo">America/Sao_Paulo (UTC-3)</option>
            <option value="America/Manaus">America/Manaus (UTC-4)</option>
            <option value="America/Fortaleza">America/Fortaleza (UTC-3, sem horário de verão)</option>
            <option value="UTC">UTC</option>
          </select>
        </div>
        <div className="flex justify-end">
          <button className="btn-primary" disabled={isSubmitting}>
            {isSubmitting ? 'Salvando…' : 'Salvar Configurações'}
          </button>
        </div>
      </div>

      <div className="card p-4">
        <p className="text-xs text-white/30 text-center">
          AstroLog — Gerenciador de Astrofotografia · v0.1.0
        </p>
      </div>
    </div>
  )
}
