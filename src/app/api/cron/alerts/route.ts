import { NextRequest, NextResponse } from 'next/server'
import { timingSafeEqual } from 'crypto'
import { prisma } from '@/lib/prisma'
import { isEmailConfigured } from '@/lib/email'
import { processAlertDigests } from '@/lib/alert-digest'

// Comparação em tempo constante (evita timing attack no segredo do cron).
function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a), bb = Buffer.from(b)
  return ab.length === bb.length && timingSafeEqual(ab, bb)
}

export const dynamic = 'force-dynamic'
export const maxDuration = 60

// Cron diário (Vercel Cron → ver vercel.json). A Vercel envia automaticamente o header
// Authorization: Bearer ${CRON_SECRET} quando a env CRON_SECRET está definida. Em produção
// exigimos esse segredo; em dev, sem CRON_SECRET, liberamos para teste manual.
function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return process.env.NODE_ENV !== 'production'
  return safeEqual(req.headers.get('authorization') ?? '', `Bearer ${secret}`)
}

async function handle(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!isEmailConfigured()) {
    return NextResponse.json({ error: 'RESEND_API_KEY não configurada' }, { status: 503 })
  }
  try {
    const result = await processAlertDigests({ prisma })
    return NextResponse.json({ ok: true, ...result })
  } catch (e) {
    console.error('[cron/alerts] erro:', e)
    return NextResponse.json({ error: 'Falha ao processar alertas' }, { status: 500 })
  }
}

// Vercel Cron chama via GET; POST liberado pra disparo manual/teste.
export const GET = handle
export const POST = handle
