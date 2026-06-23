import { z } from 'zod'
import { TRPCError } from '@trpc/server'
import { router, protectedProcedure } from '../trpc'
import { getGoogleAccount, hasDriveScope, getGoogleAccessToken, listDrive } from '@/lib/google-drive'

export const driveRouter = router({
  // O usuário conectou o Google com o escopo do Drive?
  status: protectedProcedure.query(async ({ ctx }) => {
    const account = await getGoogleAccount(ctx.session.user.id)
    return {
      connected: hasDriveScope(account) && !!(account?.refresh_token || account?.access_token),
    }
  }),

  // Navega/busca arquivos e pastas do Drive do usuário.
  list: protectedProcedure
    .input(z.object({
      folderId:  z.string().optional(),
      search:    z.string().optional(),
      pageToken: z.string().optional(),
    }))
    .query(async ({ ctx, input }) => {
      const token = await getGoogleAccessToken(ctx.session.user.id)
      if (!token) throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Google Drive não conectado' })
      try {
        return await listDrive(token, input)
      } catch (e: any) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: `Falha ao acessar o Drive: ${e.message}` })
      }
    }),
})
