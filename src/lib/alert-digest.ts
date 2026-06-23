// Monta e envia o "digest" diário de alertas: junta os eventos do céu em que o usuário
// está inscrito e que entram na janela de antecedência (advanceHours), evita reenviar
// (AlertNotification) e dispara um único e-mail por usuário. Pensado para um cron diário.
import type { PrismaClient } from '@prisma/client'
import { upcomingEvents, type AstroEvent } from '@/lib/astro-events'
import { sendEmail } from '@/lib/email'

// ── Formatação (sem dependências — é usado em rota de servidor) ────────────────
const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']
function fmtDate(isoDate: string): string {
  const [y, m, d] = isoDate.split('-').map(Number)
  return `${d} de ${MESES[(m ?? 1) - 1]} de ${y}`
}
function whenLabel(daysUntil: number): string {
  if (daysUntil <= 0) return 'hoje'
  if (daysUntil === 1) return 'amanhã'
  return `em ${daysUntil} dias`
}

const TYPE_EMOJI: Record<string, string> = {
  METEOR_SHOWER:     '☄️',
  ECLIPSE_SOLAR:     '☀️',
  ECLIPSE_LUNAR:     '🌙',
  PLANET_OPPOSITION: '🪐',
}

// ── Seleção dos eventos "devidos" ──────────────────────────────────────────────
export interface DigestItem {
  type: string; name: string; date: string; note?: string
  daysUntil: number; eventKey: string
}

export interface SubInfo { advanceHours: number; emailEnabled: boolean }

export function eventKey(e: Pick<AstroEvent, 'type' | 'date' | 'name'>): string {
  return `${e.type}:${e.date}:${e.name}`
}

// Eventos cuja data já caiu dentro da janela de antecedência do usuário, ainda não
// avisados e não muito no passado. (Luas não têm inscrição → caem fora naturalmente.)
export function selectDueEvents(
  events: AstroEvent[],
  subs: Map<string, SubInfo>,
  sentKeys: Set<string>,
  now: Date,
): DigestItem[] {
  const out: DigestItem[] = []
  for (const e of events) {
    const sub = subs.get(e.type)
    if (!sub || !sub.emailEnabled) continue
    const t = new Date(e.date + 'T12:00:00Z').getTime()
    const hoursUntil = (t - now.getTime()) / 3_600_000
    if (hoursUntil > sub.advanceHours) continue   // ainda longe demais
    if (hoursUntil < -24) continue                // já passou faz mais de um dia
    const key = eventKey(e)
    if (sentKeys.has(key)) continue
    out.push({ type: e.type, name: e.name, date: e.date, note: e.note, daysUntil: Math.round(hoursUntil / 24), eventKey: key })
  }
  return out
}

// ── APOD do dia (opcional, se inscrito em APOD) ────────────────────────────────
export interface ApodData { title: string; date: string; explanation: string; url: string; hdurl: string | null; mediaType: string }

export async function fetchApod(): Promise<ApodData | null> {
  try {
    const key = process.env.NASA_API_KEY || 'DEMO_KEY'
    const res = await fetch(`https://api.nasa.gov/planetary/apod?api_key=${key}`)
    if (!res.ok) return null
    const d: any = await res.json()
    return { title: d.title ?? '', date: d.date ?? '', explanation: d.explanation ?? '', url: d.url ?? '', hdurl: d.hdurl ?? null, mediaType: d.media_type ?? 'image' }
  } catch { return null }
}

// ── Render do e-mail ───────────────────────────────────────────────────────────
const esc = (s: string) => s
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;')

export function renderDigestEmail(opts: {
  items: DigestItem[]
  apod?: ApodData | null
  baseUrl: string
  name?: string | null
}): { subject: string; html: string; text: string } {
  const { items, apod, baseUrl, name } = opts
  const greeting = name ? `Olá, ${esc(name.split(' ')[0])}` : 'Olá'

  const eventRows = items.map(i => {
    const emoji = TYPE_EMOJI[i.type] ?? '✦'
    const note = i.note ? `<div style="color:#8b8fa3;font-size:13px;margin-top:2px">${esc(i.note)}</div>` : ''
    return `<tr><td style="padding:12px 0;border-bottom:1px solid #23263a">
      <div style="font-size:15px;color:#e8eaf2"><span style="margin-right:6px">${emoji}</span>${esc(i.name)}</div>
      ${note}
      <div style="color:#6b6f85;font-size:12px;margin-top:4px">${fmtDate(i.date)} · ${whenLabel(i.daysUntil)}</div>
    </td></tr>`
  }).join('')

  const eventsBlock = items.length ? `
    <p style="color:#e8eaf2;font-size:16px;margin:0 0 8px">Eventos do céu chegando</p>
    <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px">${eventRows}</table>` : ''

  const apodBlock = apod ? `
    <p style="color:#e8eaf2;font-size:16px;margin:0 0 8px">🌌 Imagem astronômica do dia</p>
    <div style="border:1px solid #23263a;border-radius:10px;overflow:hidden;margin:0 0 24px">
      ${apod.mediaType === 'image' && apod.url ? `<img src="${esc(apod.url)}" alt="${esc(apod.title)}" style="display:block;width:100%;max-height:300px;object-fit:cover" />` : ''}
      <div style="padding:14px">
        <div style="color:#e8eaf2;font-size:14px;font-weight:600">${esc(apod.title)}</div>
        <div style="color:#8b8fa3;font-size:13px;margin-top:6px;line-height:1.5">${esc(apod.explanation.slice(0, 320))}${apod.explanation.length > 320 ? '…' : ''}</div>
        <a href="${esc(apod.hdurl || apod.url)}" style="color:#7c9cff;font-size:13px;text-decoration:none;display:inline-block;margin-top:8px">Ver em alta resolução →</a>
      </div>
    </div>` : ''

  const html = `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#0b0d17">
    <div style="max-width:560px;margin:0 auto;padding:32px 24px;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif">
      <div style="color:#7c9cff;font-size:13px;letter-spacing:1px;text-transform:uppercase;margin-bottom:4px">AstroLog</div>
      <h1 style="color:#fff;font-size:20px;margin:0 0 20px;font-weight:600">${greeting} 🔭</h1>
      ${eventsBlock}
      ${apodBlock}
      <div style="margin-top:8px">
        <a href="${esc(baseUrl)}/dashboard/calendar" style="display:inline-block;background:#7c9cff;color:#0b0d17;font-size:14px;font-weight:600;text-decoration:none;padding:10px 18px;border-radius:8px">Abrir o calendário</a>
      </div>
      <p style="color:#4b4f63;font-size:11px;margin-top:28px;line-height:1.6">
        Você recebe isto porque ativou alertas no AstroLog.
        Ajuste suas inscrições em <a href="${esc(baseUrl)}/dashboard/alerts" style="color:#6b6f85">Alertas</a>.
      </p>
    </div>
  </body></html>`

  const textLines = [
    items.length ? 'Eventos do céu chegando:' : '',
    ...items.map(i => `- ${i.name} — ${fmtDate(i.date)} (${whenLabel(i.daysUntil)})${i.note ? ` · ${i.note}` : ''}`),
    apod ? `\nImagem do dia: ${apod.title} — ${apod.hdurl || apod.url}` : '',
    `\nCalendário: ${baseUrl}/dashboard/calendar`,
  ].filter(Boolean)
  const text = textLines.join('\n')

  const subject = items.length === 1 && !apod
    ? `🔭 ${items[0].name} — ${whenLabel(items[0].daysUntil)}`
    : items.length
      ? `🔭 ${items.length} evento(s) do céu chegando`
      : '🌌 Imagem astronômica do dia'

  return { subject, html, text }
}

// ── Orquestração ────────────────────────────────────────────────────────────────
export interface DigestResult { users: number; sent: number; errors: number }

export async function processAlertDigests(opts: {
  prisma: PrismaClient
  now?: Date
  baseUrl?: string
}): Promise<DigestResult> {
  const { prisma } = opts
  const now = opts.now ?? new Date()
  const baseUrl = (opts.baseUrl || process.env.NEXTAUTH_URL || '').replace(/\/$/, '')

  // Poda avisos antigos pra manter a tabela enxuta (eventos já passaram).
  await prisma.alertNotification.deleteMany({
    where: { sentAt: { lt: new Date(now.getTime() - 180 * 86_400_000) } },
  }).catch(() => {})

  const users = await prisma.user.findMany({
    where:  { alertSubscriptions: { some: { emailEnabled: true } } },
    select: {
      id: true, email: true, name: true,
      alertSubscriptions: { select: { eventType: true, advanceHours: true, emailEnabled: true } },
    },
  })

  const events = upcomingEvents(now, 14)   // janela cobre a antecedência máxima (168h)
  const today = now.toISOString().slice(0, 10)
  let sent = 0, errors = 0

  for (const u of users) {
    if (!u.email) continue
    const subs = new Map<string, SubInfo>(
      u.alertSubscriptions.map(s => [s.eventType as string, { advanceHours: s.advanceHours, emailEnabled: s.emailEnabled }]),
    )
    const sentRecs = await prisma.alertNotification.findMany({ where: { userId: u.id }, select: { eventKey: true } })
    const sentKeys = new Set(sentRecs.map(r => r.eventKey))

    const due = selectDueEvents(events, subs, sentKeys, now)

    // APOD diário (se inscrito e ainda não enviado hoje)
    let apod: ApodData | null = null
    const apodKey = `APOD:${today}`
    if (subs.get('APOD')?.emailEnabled && !sentKeys.has(apodKey)) {
      apod = await fetchApod()
    }

    if (!due.length && !apod) continue

    const { subject, html, text } = renderDigestEmail({ items: due, apod, baseUrl, name: u.name })
    try {
      await sendEmail({ to: u.email, subject, html, text })
      const keys = due.map(d => d.eventKey)
      if (apod) keys.push(apodKey)
      await prisma.alertNotification.createMany({
        data: keys.map(k => ({ userId: u.id, eventKey: k })),
        skipDuplicates: true,
      })
      sent++
    } catch (e) {
      errors++
      console.error(`[alert-digest] falha ao enviar para ${u.email}:`, e instanceof Error ? e.message : e)
    }
  }

  return { users: users.length, sent, errors }
}
