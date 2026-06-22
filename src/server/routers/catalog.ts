import { z } from 'zod'
import { router, protectedProcedure } from '../trpc'

// Mapeia códigos de tipo do SIMBAD para rótulos amigáveis (PT).
const TYPE_PT: Record<string, string> = {
  G: 'Galáxia', GiG: 'Galáxia', GiC: 'Galáxia', AGN: 'Galáxia (AGN)', Sy: 'Galáxia (Seyfert)',
  GlC: 'Aglomerado globular', OpC: 'Aglomerado aberto', Cl: 'Aglomerado', 'Cl*': 'Aglomerado',
  HII: 'Nebulosa de emissão', EmO: 'Nebulosa de emissão', RNe: 'Nebulosa de reflexão',
  PN: 'Nebulosa planetária', SNR: 'Remanescente de supernova', DNe: 'Nebulosa escura', Neb: 'Nebulosa',
}

function friendlyType(code?: string): string | null {
  if (!code) return null
  const c = code.trim()
  return TYPE_PT[c] ?? c
}

export const catalogRouter = router({
  // Imagem astronômica do dia (NASA APOD).
  apod: protectedProcedure.query(async () => {
    try {
      const key = process.env.NASA_API_KEY || 'DEMO_KEY'
      const res = await fetch(`https://api.nasa.gov/planetary/apod?api_key=${key}`)
      if (!res.ok) return null
      const d: any = await res.json()
      return {
        title:       d.title ?? '',
        date:        d.date ?? '',
        explanation: d.explanation ?? '',
        url:         d.url ?? '',
        hdurl:       d.hdurl ?? null,
        mediaType:   d.media_type ?? 'image',
        copyright:   d.copyright ?? null,
      }
    } catch {
      return null
    }
  }),

  // Resolve um nome de objeto (M/NGC/IC/nome comum) → AR/Dec + tipo, via Sésame (CDS/SIMBAD).
  resolve: protectedProcedure
    .input(z.object({ name: z.string().min(1).max(100) }))
    .mutation(async ({ input }) => {
      try {
        const url = `https://cds.unistra.fr/cgi-bin/nph-sesame/-oI?${encodeURIComponent(input.name)}`
        const res = await fetch(url, { headers: { 'User-Agent': 'AstroLog/0.1 (astrophotography log)' } })
        if (!res.ok) return null
        const text = await res.text()

        // %J <RA_graus> <Dec_graus>
        const j = text.match(/%J\s+([+-]?\d+(?:\.\d+)?)\s+([+-]?\d+(?:\.\d+)?)/)
        if (!j) return null
        const raDeg = parseFloat(j[1]), decDeg = parseFloat(j[2])
        if (isNaN(raDeg) || isNaN(decDeg)) return null

        // %C.<n> <código de tipo> — best effort
        const c = text.match(/%C(?:\.\d+)?\s+(\S+)/)

        return {
          raHours:    +(raDeg / 15).toFixed(4),
          decDegrees: +decDeg.toFixed(4),
          type:       friendlyType(c?.[1]),
        }
      } catch {
        return null
      }
    }),
})
