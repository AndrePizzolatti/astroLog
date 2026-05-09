'use client'

import { useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import { useSession } from 'next-auth/react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { api } from '@/lib/trpc'
import { useToast } from '@/components/ui/toast'
import { CitySearch } from '@/components/ui/city-search'
import { MapPin, User, LocateFixed } from 'lucide-react'

// Leaflet só funciona no browser — importação dinâmica obrigatória
const LocationPicker = dynamic(
  () => import('@/components/ui/location-picker').then(m => m.LocationPicker),
  { ssr: false, loading: () => <div className="rounded-lg bg-white/3 border border-white/10 animate-pulse" style={{ height: 240 }} /> },
)

const schema = z.object({
  latitude:  z.coerce.number().min(-90).max(90).optional().or(z.literal('')).transform(v => v === '' ? undefined : Number(v)),
  longitude: z.coerce.number().min(-180).max(180).optional().or(z.literal('')).transform(v => v === '' ? undefined : Number(v)),
  timezone:  z.string().optional(),
  bio:       z.string().max(500).optional(),
})

type FormValues = z.input<typeof schema>

const TIMEZONES = [
  { value: 'America/Sao_Paulo',   label: 'America/Sao_Paulo (UTC-3)' },
  { value: 'America/Manaus',      label: 'America/Manaus (UTC-4)' },
  { value: 'America/Fortaleza',   label: 'America/Fortaleza (UTC-3, sem horário de verão)' },
  { value: 'America/Belem',       label: 'America/Belem (UTC-3)' },
  { value: 'America/Recife',      label: 'America/Recife (UTC-3)' },
  { value: 'America/Cuiaba',      label: 'America/Cuiaba (UTC-4)' },
  { value: 'America/Porto_Velho', label: 'America/Porto_Velho (UTC-4)' },
  { value: 'UTC',                 label: 'UTC' },
]

// Fallback para quando não há localização configurada (costa catarinense)
const DEFAULT_LAT = -27.6
const DEFAULT_LON = -48.5

export default function SettingsPage() {
  const { data: session } = useSession()
  const { toast } = useToast()
  const utils = api.useUtils()

  const { data: profile, isLoading } = api.user.getProfile.useQuery()

  const [gpsLoading, setGpsLoading] = useState(false)

  const {
    register, handleSubmit, reset, setValue, watch,
    formState: { isSubmitting, isDirty },
  } = useForm<FormValues>({
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

  // Coords derivadas do form — usadas pelo mapa. Tolera input parcial/inválido.
  const rawLat = watch('latitude')
  const rawLon = watch('longitude')
  const mapLat = parseFloat(String(rawLat ?? '')) || DEFAULT_LAT
  const mapLon = parseFloat(String(rawLon ?? '')) || DEFAULT_LON

  // Fonte única de atualização de coordenadas (cidade, mapa, GPS, colagem manual via onChange do input)
  function applyCoords(lat: number, lon: number) {
    const rounded = { lat: parseFloat(lat.toFixed(6)), lon: parseFloat(lon.toFixed(6)) }
    setValue('latitude',  rounded.lat as any, { shouldDirty: true })
    setValue('longitude', rounded.lon as any, { shouldDirty: true })
  }

  function handleGPS() {
    if (!navigator.geolocation) { toast('Geolocalização não suportada neste navegador', 'error'); return }
    setGpsLoading(true)
    navigator.geolocation.getCurrentPosition(
      pos => { applyCoords(pos.coords.latitude, pos.coords.longitude); setGpsLoading(false) },
      ()  => { toast('Não foi possível obter localização', 'error'); setGpsLoading(false) },
      { timeout: 8000 },
    )
  }

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

          {/* 1. Busca por cidade */}
          <div>
            <label className="input-label">Buscar por cidade</label>
            <CitySearch
              onSelect={r => applyCoords(r.latitude, r.longitude)}
              placeholder="Ex: Fraiburgo, Joinville, São José…"
            />
            <p className="text-xs text-white/25 mt-1">
              Digite ao menos 3 letras — dados via OpenStreetMap, sem cadastro.
            </p>
          </div>

          {/* 2. Mapa interativo */}
          {!isLoading && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="input-label mb-0">Mapa — clique ou arraste o pino</label>
                <button
                  type="button"
                  onClick={handleGPS}
                  disabled={gpsLoading}
                  className="flex items-center gap-1.5 text-xs text-white/40 hover:text-aurora-400 transition-colors disabled:opacity-40"
                >
                  <LocateFixed className="w-3.5 h-3.5" />
                  {gpsLoading ? 'Obtendo…' : 'Localização atual'}
                </button>
              </div>
              <LocationPicker
                latitude={mapLat}
                longitude={mapLon}
                onChange={applyCoords}
              />
            </div>
          )}

          {/* 3. Campos manuais de coordenada — reativos com o mapa */}
          {isLoading ? (
            <div className="grid grid-cols-2 gap-3">
              <div className="input h-9 animate-pulse" />
              <div className="input h-9 animate-pulse" />
            </div>
          ) : (
            <div>
              <label className="input-label">Coordenadas manuais</label>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="input-label text-white/30">Latitude</label>
                  <input
                    {...register('latitude', {
                      onChange: e => {
                        const v = parseFloat(e.target.value)
                        if (!isNaN(v) && v >= -90 && v <= 90) {
                          // trigga reatividade do mapa via watch sem chamar applyCoords
                          // (applyCoords arredondaria o que o usuário está digitando)
                        }
                      },
                    })}
                    type="number" step="any" className="input font-mono text-sm"
                    placeholder="-27.596900"
                  />
                </div>
                <div>
                  <label className="input-label text-white/30">Longitude</label>
                  <input
                    {...register('longitude')}
                    type="number" step="any" className="input font-mono text-sm"
                    placeholder="-48.549500"
                  />
                </div>
              </div>
              <p className="text-xs text-white/20 mt-1">
                Cole coordenadas do N.I.N.A., SkySafari ou Google Maps — o mapa se atualiza automaticamente.
              </p>
            </div>
          )}

          {/* Fuso */}
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
