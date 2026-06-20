import { prisma } from '@/lib/prisma'

// Valida o Bearer token enviado pelo agente local. Retorna o dono do token
// (e atualiza lastUsedAt em segundo plano) ou null se inválido.
export async function authenticateAgent(req: Request): Promise<{ userId: string; tokenId: string } | null> {
  const header = req.headers.get('authorization') ?? ''
  const token = header.replace(/^Bearer\s+/i, '').trim()
  if (token.length < 16) return null

  const rec = await prisma.agentToken.findUnique({
    where:  { token },
    select: { id: true, userId: true },
  })
  if (!rec) return null

  // fire-and-forget — não bloqueia a resposta
  prisma.agentToken.update({ where: { id: rec.id }, data: { lastUsedAt: new Date() } }).catch(() => {})
  return { userId: rec.userId, tokenId: rec.id }
}
