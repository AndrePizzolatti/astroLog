import { fetchRequestHandler } from '@trpc/server/adapters/fetch'
import { type NextRequest } from 'next/server'
import { appRouter } from '@/server/root'
import { createTRPCContext } from '@/server/trpc'

const handler = (req: NextRequest) =>
  fetchRequestHandler({
    endpoint: '/api/trpc',
    req,
    router: appRouter,
    createContext: createTRPCContext,
    onError:
      process.env.NODE_ENV === 'development'
        ? ({ path, error }) => console.error(`tRPC error on ${path}:`, error)
        : undefined,
  })

export { handler as GET, handler as POST }
