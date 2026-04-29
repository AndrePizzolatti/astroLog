import { z } from 'zod'
import { router, protectedProcedure } from '../trpc'

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
