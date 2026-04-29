import { z } from 'zod'
import { router, protectedProcedure } from '../trpc'

export const userRouter = router({
  getProfile: protectedProcedure.query(({ ctx }) =>
    ctx.prisma.user.findUnique({
      where: { id: ctx.session.user.id },
      select: { latitude: true, longitude: true, timezone: true, bio: true, name: true, email: true, image: true },
    }),
  ),

  updateProfile: protectedProcedure
    .input(z.object({
      latitude:  z.number().min(-90).max(90).nullable().optional(),
      longitude: z.number().min(-180).max(180).nullable().optional(),
      timezone:  z.string().optional(),
      bio:       z.string().max(500).optional(),
    }))
    .mutation(({ ctx, input }) =>
      ctx.prisma.user.update({
        where: { id: ctx.session.user.id },
        data: input,
        select: { latitude: true, longitude: true, timezone: true, bio: true },
      }),
    ),
})
