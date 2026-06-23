import { z } from 'zod'
import { randomBytes } from 'crypto'
import { TRPCError } from '@trpc/server'
import { router, protectedProcedure } from '../trpc'

// Tokens de API usados pelo agente local (script Siril / watcher N.I.N.A.).
export const agentRouter = router({
  listTokens: protectedProcedure.query(({ ctx }) =>
    ctx.prisma.agentToken.findMany({
      where:   { userId: ctx.session.user.id },
      select:  { id: true, label: true, createdAt: true, lastUsedAt: true },
      orderBy: { createdAt: 'desc' },
    }),
  ),

  createToken: protectedProcedure
    .input(z.object({ label: z.string().min(1).max(60) }))
    .mutation(async ({ ctx, input }) => {
      // Token forte e aleatório — devolvido em texto puro UMA única vez
      const token = randomBytes(32).toString('hex')
      const rec = await ctx.prisma.agentToken.create({
        data: { userId: ctx.session.user.id, label: input.label, token },
        select: { id: true, label: true, createdAt: true },
      })
      return { ...rec, token }
    }),

  revokeToken: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const rec = await ctx.prisma.agentToken.findFirst({
        where: { id: input.id, userId: ctx.session.user.id },
      })
      if (!rec) throw new TRPCError({ code: 'NOT_FOUND' })
      await ctx.prisma.agentToken.delete({ where: { id: input.id } })
      return { success: true }
    }),
})
