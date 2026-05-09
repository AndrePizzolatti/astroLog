'use client'

import { useEffect } from 'react'
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

// Webpack quebra a resolução de assets do ícone padrão do Leaflet —
// apontamos explicitamente para o CDN da versão instalada.
delete (L.Icon.Default.prototype as any)._getIconUrl
L.Icon.Default.mergeOptions({
  iconUrl:       'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl:     'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

interface Props {
  latitude:  number
  longitude: number
  onChange:  (lat: number, lon: number) => void
}

// Move o centro do mapa quando lat/lon mudam via prop (cidade, GPS, digitação)
function MapSync({ latitude, longitude }: { latitude: number; longitude: number }) {
  const map = useMap()
  useEffect(() => {
    map.setView([latitude, longitude], map.getZoom(), { animate: true })
  }, [latitude, longitude]) // eslint-disable-line react-hooks/exhaustive-deps
  return null
}

// Clique no mapa → atualiza posição
function ClickHandler({ onChange }: { onChange: (lat: number, lon: number) => void }) {
  useMapEvents({
    click(e) { onChange(e.latlng.lat, e.latlng.lng) },
  })
  return null
}

export function LocationPicker({ latitude, longitude, onChange }: Props) {
  return (
    <div className="rounded-lg overflow-hidden border border-white/10" style={{ height: 240 }}>
      <MapContainer
        center={[latitude, longitude]}
        zoom={11}
        style={{ height: '100%', width: '100%', background: '#0d0d1a' }}
        scrollWheelZoom={false}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='© <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a>'
        />
        <Marker
          position={[latitude, longitude]}
          draggable
          eventHandlers={{
            dragend(e) {
              const { lat, lng } = (e.target as L.Marker).getLatLng()
              onChange(parseFloat(lat.toFixed(6)), parseFloat(lng.toFixed(6)))
            },
          }}
        />
        <MapSync latitude={latitude} longitude={longitude} />
        <ClickHandler onChange={onChange} />
      </MapContainer>
    </div>
  )
}
