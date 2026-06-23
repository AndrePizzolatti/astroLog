import { NextRequest, NextResponse } from 'next/server'
import { authenticateAgent } from '@/lib/agent-auth'

// O agente chama isto na configuração para validar o token e a URL.
export async function GET(req: NextRequest) {
  const auth = await authenticateAgent(req)
  if (!auth) return NextResponse.json({ ok: false }, { status: 401 })
  return NextResponse.json({ ok: true })
}
