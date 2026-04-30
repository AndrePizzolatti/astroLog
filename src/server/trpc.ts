import { initTRPC, TRPCError } from '@trpc/server'
import { getServerSession } from 'next-auth'
import superjson from 'superjson'
import { ZodError } from 'zod'
import { type Session } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export type TRPCContext = {
  prisma: typeof prisma
  session: Session | null
}

export async function createTRPCContext(_opts: unknown): Promise<TRPCContext> {
  const session = await getServerSession(authOptions)
  return { prisma, session }
}

const t = initTRPC.context<TRPCContext>().create({
  transformer: superjson,
  errorFormatter({ shape, error }) {
    return {
      ...shape,
      data: {
        ...shape.data,
        zodError: error.cause instanceof ZodError ? error.cause.flatten() : null,
      },
    }
  },
})

export const router            = t.router
export const publicProcedure   = t.procedure

export const protectedProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.session?.user?.id) {
    throw new TRPCError({ code: 'UNAUTHORIZED' })
  }
  return next({
    ctx: {
      ...ctx,
      session: ctx.session as Session & { user: { id: string } },
    },
  })
})
