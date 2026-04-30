'use client'

import { useEffect } from 'react'
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

const TIMEZONES = [
  { value: 'America/Sao_Paulo',  label: 'America/Sao_Paulo (UTC-3)' },
  { value: 'America/Manaus',     label: 'America/Manaus (UTC-4)' },
  { value: 'America/Fortaleza',  label: 'America/Fortaleza (UTC-3, sem horário de verão)' },
  { value: 'America/Belem',      label: 'America/Belem (UTC-3)' },
  { value: 'America/Recife',     label: 'America/Recife (UTC-3)' },
  { value: 'America/Cuiaba',     label: 'America/Cuiaba (UTC-4)' },
  { value: 'America/Porto_Velho', label: 'America/Porto_Velho (UTC-4)' },
  { value: 'UTC',                label: 'UTC' },
]

export default function SettingsPage() {
  const { data: session } = useSession()
  const { toast } = useToast()
  const utils = api.useUtils()

  const { data: profile, isLoading } = api.user.getProfile.useQuery()

  const { register, handleSubmit, reset, formState: { isSubmitting, isDirty } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { timezone: 'America/Sao_Paulo' },
  })

  useEffect(() => {
    if (profile) {
      reset({
        latitude:  profile.latitude  ?? '',
        longitude: profile.longitude ?? '',
        timezone:  profile.timezone  ?? 'America/Sao_Paulo',
        bio:       profile.bio       ?? '',
      })
    }
  }, [profile]) // eslint-disable-line react-hooks/exhaustive-deps

  const update = api.user.updateProfile.useMutation({
    onSuccess: () => {
      utils.user.getProfile.invalidate()
      utils.weather.forecast.invalidate()
      toast('Configurações salvas!')
      reset(undefined, { keepValues: true })
    },
    onError: (e) => toast(e.message, 'error'),
  })

  function onSubmit(data: FormValues) {
    update.mutate({
      latitude:  typeof data.latitude  === 'number' ? data.latitude  : null,
      longitude: typeof data.longitude === 'number' ? data.longitude : null,
      timezone:  data.timezone,
      bio:       data.bio,
    })
  }

  return (
    <div className="p-8 max-w-2xl mx-auto space-y-8">
      <div className="page-header">
        <div>
          <h1 className="page-title">Configurações</h1>
          <p className="page-subtitle">Perfil e preferências de localização</p>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Profile */}
        <div className="card p-5 space-y-4">
          <div className="flex items-center gap-3">
            <User className="w-4 h-4 text-cosmos-400" />
            <h2 className="text-sm font-semibold text-white">Perfil</h2>
          </div>

          {/* Avatar + name */}
          <div className="flex items-center gap-3">
            {session?.user?.image ? (
              <img src={session.user.image} alt="" className="w-10 h-10 rounded-full" />
            ) : (
              <div className="w-10 h-10 rounded-full bg-cosmos-500/30 flex items-center justify-center text-sm font-bold text-cosmos-300">
                {session?.user?.name?.charAt(0) ?? '?'}
              </div>
            )}
            <div>
              <p className="text-sm font-medium text-white">{session?.user?.name}</p>
              <p className="text-xs text-white/40">{session?.user?.email}</p>
            </div>
          </div>

          <div>
            <label className="input-label">Bio</label>
            <textarea {...register('bio')} className="input" rows={3} placeholder="Astrofotógrafo amador na costa catarinense…" />
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
            Usada para calcular a previsão do tempo local e altitudes dos objetos celestes.
          </p>

          {isLoading ? (
            <div className="grid grid-cols-2 gap-3">
              <div className="input h-9 animate-pulse" />
              <div className="input h-9 animate-pulse" />
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="input-label">Latitude</label>
                <input
                  {...register('latitude')}
                  type="number" step="0.0001" className="input"
                  placeholder="-27.5969"
                />
              </div>
              <div>
                <label className="input-label">Longitude</label>
                <input
                  {...register('longitude')}
                  type="number" step="0.0001" className="input"
                  placeholder="-48.5495"
                />
              </div>
            </div>
          )}

          <p className="text-xs text-white/25">
            Dica: use o Google Maps para encontrar as coordenadas da sua posição habitual de observação.
          </p>

          <div>
            <label className="input-label">Fuso horário</label>
            <select {...register('timezone')} className="input">
              {TIMEZONES.map(tz => (
                <option key={tz.value} value={tz.value}>{tz.label}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            className="btn-primary"
            disabled={isSubmitting || !isDirty}
          >
            {isSubmitting ? 'Salvando…' : 'Salvar Configurações'}
          </button>
        </div>
      </form>

      <div className="card p-4">
        <p className="text-xs text-white/30 text-center">
          AstroLog — Gerenciador de Astrofotografia · v0.1.0
        </p>
      </div>
    </div>
  )
}
