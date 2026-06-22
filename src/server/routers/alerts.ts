import { z } from 'zod'
import { router, protectedProcedure } from '../trpc'
import { upcomingEvents } from '@/lib/astro-events'

const AlertTypeEnum = z.enum([
  'METEOR_SHOWER', 'ECLIPSE_SOLAR', 'ECLIPSE_LUNAR',
  'ISS_PASS', 'PLANET_OPPOSITION', 'COMET', 'CONJUNCTION', 'APOD',
])

export const alertsRouter = router({
  list: protectedProcedure.query(({ ctx }) =>
    ctx.prisma.alertSubscription.findMany({
      where: { userId: ctx.session.user.id },
      select: { eventType: true, advanceHours: true, emailEnabled: true },
    }),
  ),

  // Próximos eventos calculados/curados, marcados com a inscrição do usuário.
  upcoming: protectedProcedure
    .input(z.object({ days: z.number().int().min(7).max(365).default(120) }).optional())
    .query(async ({ ctx, input }) => {
      const days = input?.days ?? 120
      const subs = await ctx.prisma.alertSubscription.findMany({
        where:  { userId: ctx.session.user.id },
        select: { eventType: true },
      })
      const subscribed = new Set(subs.map(s => s.eventType))
      const isMoon = (t: string) => t === 'NEW_MOON' || t === 'FULL_MOON'

      return upcomingEvents(new Date(), days).map(e => ({
        ...e,
        daysUntil: Math.round((new Date(e.date + 'T12:00:00Z').getTime() - Date.now()) / 86_400_000),
        subscribed: isMoon(e.type) ? null : subscribed.has(e.type),
      }))
    }),

  upsert: protectedProcedure
    .input(z.object({
      eventType:    AlertTypeEnum,
      advanceHours: z.number().int().min(1).max(168).optional(),
      emailEnabled: z.boolean().optional(),
    }))
    .mutation(({ ctx, input }) =>
      ctx.prisma.alertSubscription.upsert({
        where: {
          userId_eventType: { userId: ctx.session.user.id, eventType: input.eventType },
        },
        create: {
          userId:       ctx.session.user.id,
          eventType:    input.eventType,
          advanceHours: input.advanceHours ?? 24,
          emailEnabled: input.emailEnabled ?? true,
        },
        update: {
          ...(input.advanceHours !== undefined && { advanceHours: input.advanceHours }),
          ...(input.emailEnabled !== undefined && { emailEnabled: input.emailEnabled }),
        },
        select: { eventType: true, advanceHours: true, emailEnabled: true },
      }),
    ),

  delete: protectedProcedure
    .input(z.object({ eventType: AlertTypeEnum }))
    .mutation(({ ctx, input }) =>
      ctx.prisma.alertSubscription.delete({
        where: {
          userId_eventType: { userId: ctx.session.user.id, eventType: input.eventType },
        },
      }),
    ),
})
