'use client'

import { useEffect, useRef, useState } from 'react'
import { Search, MapPin, Loader2 } from 'lucide-react'

interface NominatimResult {
  place_id: number
  display_name: string
  lat: string
  lon: string
}

interface Props {
  onSelect: (result: { name: string; latitude: number; longitude: number }) => void
  placeholder?: string
}

export function CitySearch({ onSelect, placeholder = 'Buscar cidade ou localização…' }: Props) {
  const [query,   setQuery]   = useState('')
  const [results, setResults] = useState<NominatimResult[]>([])
  const [loading, setLoading] = useState(false)
  const [open,    setOpen]    = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  // Debounced Nominatim search (min 3 chars)
  useEffect(() => {
    if (query.length < 3) {
      setResults([])
      setOpen(false)
      return
    }
    const timer = setTimeout(async () => {
      setLoading(true)
      try {
        const url = `https://nominatim.openstreetmap.org/search` +
          `?q=${encodeURIComponent(query)}&format=json&limit=5&accept-language=pt-BR`
        const res  = await fetch(url)
        const data = (await res.json()) as NominatimResult[]
        setResults(data)
        setOpen(data.length > 0)
      } catch {
        setResults([])
      } finally {
        setLoading(false)
      }
    }, 420)
    return () => clearTimeout(timer)
  }, [query])

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  function select(r: NominatimResult) {
    const name = r.display_name.split(',').slice(0, 3).join(',').trim()
    onSelect({ name, latitude: parseFloat(r.lat), longitude: parseFloat(r.lon) })
    setQuery('')
    setResults([])
    setOpen(false)
  }

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        {loading
          ? <Loader2 className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/30 animate-spin pointer-events-none" />
          : <Search  className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/30 pointer-events-none" />
        }
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          onFocus={() => results.length > 0 && setOpen(true)}
          className="input pl-9"
          placeholder={placeholder}
          autoComplete="off"
          spellCheck={false}
        />
      </div>

      {open && results.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-cosmos-900 border border-white/10 rounded-lg shadow-2xl overflow-hidden">
          {results.map(r => (
            <button
              key={r.place_id}
              type="button"
              onClick={() => select(r)}
              className="w-full flex items-start gap-2.5 px-3 py-2.5 text-left hover:bg-white/5 transition-colors border-b border-white/5 last:border-0"
            >
              <MapPin className="w-3.5 h-3.5 text-white/25 mt-0.5 shrink-0" />
              <span className="text-xs text-white/60 leading-relaxed">{r.display_name}</span>
            </button>
          ))}
          <p className="px-3 py-1.5 text-[10px] text-white/20 border-t border-white/5">
            © OpenStreetMap / Nominatim
          </p>
        </div>
      )}
    </div>
  )
}
