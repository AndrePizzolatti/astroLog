import { z } from 'zod'
import { TRPCError } from '@trpc/server'
import { router, protectedProcedure } from '../trpc'
import { getSupabaseAdmin, STORAGE_BUCKET } from '@/lib/supabase'

const CalibTypeEnum = z.enum(['DARK', 'BIAS', 'MASTER_DARK', 'MASTER_BIAS'])

// Validade dos frames de calibração (dias). Espelha a regra da página da Biblioteca.
const EXPIRY_DAYS: Record<string, number> = { DARK: 180, BIAS: 365, MASTER_DARK: 180, MASTER_BIAS: 365 }
function isExpired(frameType: string, createdAt: Date): boolean {
  const days = EXPIRY_DAYS[frameType] ?? 180
  return createdAt.getTime() + days * 86_400_000 < Date.now()
}

// Acha o melhor dark e bias compatíveis e NÃO vencidos na biblioteca, para uma
// sessão. Usado no auto-link da importação. Retorna os ids a vincular.
export async function autoMatchCalibration(
  prisma: any,
  userId: string,
  p: { cameraId: string; gain?: number | null; exposureSeconds?: number | null; sensorTempC?: number | null },
): Promise<string[]> {
  if (p.gain == null) return []
  const frames = await prisma.calibrationFrame.findMany({
    where:   { userId, cameraId: p.cameraId, gain: p.gain },
    orderBy: { createdAt: 'desc' },
  })
  const tempOk = (f: any) =>
    p.sensorTempC == null || f.sensorTempC == null || Math.abs(f.sensorTempC - p.sensorTempC) <= 2

  const dark = frames.find((f: any) =>
    (f.frameType === 'MASTER_DARK' || f.frameType === 'DARK') &&
    !isExpired(f.frameType, f.createdAt) && tempOk(f) &&
    (p.exposureSeconds == null || f.exposureSeconds == null || Math.abs(f.exposureSeconds - p.exposureSeconds) <= 0.01))

  const bias = frames.find((f: any) =>
    (f.frameType === 'MASTER_BIAS' || f.frameType === 'BIAS') &&
    !isExpired(f.frameType, f.createdAt) && tempOk(f))

  const out: string[] = []
  if (dark) out.push(dark.id)
  if (bias) out.push(bias.id)
  return out
}

export const calibrationRouter = router({
  list: protectedProcedure
    .input(z.object({
      frameType: CalibTypeEnum.optional(),
      cameraId:  z.string().optional(),
      limit:     z.number().int().min(1).max(100).default(50),
      cursor:    z.string().optional(),
    }))
    .query(async ({ ctx, input }) => {
      const { frameType, cameraId, limit, cursor } = input
      const items = await ctx.prisma.calibrationFrame.findMany({
        where: {
          userId: ctx.session.user.id,
          ...(frameType && { frameType }),
          ...(cameraId  && { cameraId }),
        },
        include: { camera: { select: { id: true, name: true } } },
        orderBy: { createdAt: 'desc' },
        take: limit + 1,
        cursor: cursor ? { id: cursor } : undefined,
      })
      const hasMore = items.length > limit
      return {
        items:      hasMore ? items.slice(0, limit) : items,
        nextCursor: hasMore ? items[limit - 1].id   : null,
      }
    }),

  upload: protectedProcedure
    .input(z.object({
      cameraId:        z.string(),
      frameType:       CalibTypeEnum,
      label:           z.string().min(1).max(100),
      exposureSeconds: z.number().positive().optional(),
      gain:            z.number().int(),
      offset:          z.number().int().optional(),
      binning:         z.string().optional(),
      sensorTempC:     z.number().optional(),
      storagePath:     z.string(),
      originalName:    z.string(),
      sizeBytes:       z.number().int().positive(),
      frameCount:      z.number().int().min(1).default(1),
      notes:           z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const camera = await ctx.prisma.camera.findFirst({
        where: { id: input.cameraId, userId: ctx.session.user.id },
      })
      if (!camera) throw new TRPCError({ code: 'NOT_FOUND', message: 'Camera não encontrada' })

      const { sizeBytes, ...rest } = input
      return ctx.prisma.calibrationFrame.create({
        data: { ...rest, userId: ctx.session.user.id, sizeBytes: BigInt(sizeBytes) },
        include: { camera: { select: { id: true, name: true } } },
      })
    }),

  // Adiciona um frame por LINK (Drive) ou caminho LOCAL — sem upload (Supabase cheio).
  addLink: protectedProcedure
    .input(z.object({
      cameraId:        z.string(),
      frameType:       CalibTypeEnum,
      provider:        z.enum(['DRIVE', 'LOCAL']),
      storagePath:     z.string().min(1),
      label:           z.string().min(1).max(100),
      exposureSeconds: z.number().positive().optional(),
      gain:            z.number().int(),
      offset:          z.number().int().optional(),
      binning:         z.string().optional(),
      sensorTempC:     z.number().optional(),
      frameCount:      z.number().int().min(1).default(1),
      notes:           z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const camera = await ctx.prisma.camera.findFirst({
        where: { id: input.cameraId, userId: ctx.session.user.id },
      })
      if (!camera) throw new TRPCError({ code: 'NOT_FOUND', message: 'Camera não encontrada' })

      return ctx.prisma.calibrationFrame.create({
        data: { ...input, userId: ctx.session.user.id, originalName: input.label },
        include: { camera: { select: { id: true, name: true } } },
      })
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const frame = await ctx.prisma.calibrationFrame.findFirst({
        where: { id: input.id, userId: ctx.session.user.id },
      })
      if (!frame) throw new TRPCError({ code: 'NOT_FOUND' })

      // Só remove do bucket se de fato vive no Supabase; links Drive/Local não têm arquivo nosso
      if (frame.provider === 'SUPABASE') {
        const admin = getSupabaseAdmin()
        await admin.storage.from(STORAGE_BUCKET).remove([frame.storagePath])
      }
      await ctx.prisma.calibrationFrame.delete({ where: { id: input.id } })
      return { success: true }
    }),

  findMatches: protectedProcedure
    .input(z.object({
      setupId:         z.string().optional(),
      cameraId:        z.string().optional(),
      gain:            z.number().int(),
      exposureSeconds: z.number().positive().optional(),
      sensorTempC:     z.number().optional(),
    }))
    .query(async ({ ctx, input }) => {
      let cameraId = input.cameraId
      if (!cameraId && input.setupId) {
        const setup = await ctx.prisma.equipmentSetup.findFirst({
          where: { id: input.setupId, userId: ctx.session.user.id },
          select: { cameraId: true },
        })
        cameraId = setup?.cameraId
      }
      if (!cameraId) return []

      const candidates = await ctx.prisma.calibrationFrame.findMany({
        where: { userId: ctx.session.user.id, cameraId, gain: input.gain },
        include: { camera: { select: { name: true } } },
        orderBy: { createdAt: 'desc' },
      })

      return candidates.filter(frame => {
        // temperature tolerance ±2°C
        if (input.sensorTempC != null && frame.sensorTempC != null) {
          if (Math.abs(frame.sensorTempC - input.sensorTempC) > 2) return false
        }
        // darks require exact exposure match
        if (frame.frameType === 'DARK' || frame.frameType === 'MASTER_DARK') {
          if (input.exposureSeconds != null && frame.exposureSeconds != null) {
            if (Math.abs(frame.exposureSeconds - input.exposureSeconds) > 0.01) return false
          }
        }
        return true
      })
    }),

  attachToSession: protectedProcedure
    .input(z.object({
      sessionId:          z.string(),
      calibrationFrameId: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      const session = await ctx.prisma.imagingSession.findFirst({
        where: { id: input.sessionId, project: { userId: ctx.session.user.id } },
      })
      if (!session) throw new TRPCError({ code: 'NOT_FOUND' })

      const frame = await ctx.prisma.calibrationFrame.findFirst({
        where: { id: input.calibrationFrameId, userId: ctx.session.user.id },
      })
      if (!frame) throw new TRPCError({ code: 'NOT_FOUND' })

      return ctx.prisma.calibrationFrameUsage.upsert({
        where: {
          sessionId_calibrationFrameId: {
            sessionId:          input.sessionId,
            calibrationFrameId: input.calibrationFrameId,
          },
        },
        create: input,
        update: {},
      })
    }),

  detachFromSession: protectedProcedure
    .input(z.object({
      sessionId:          z.string(),
      calibrationFrameId: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      const usage = await ctx.prisma.calibrationFrameUsage.findUnique({
        where: { sessionId_calibrationFrameId: input },
        include: { session: { include: { project: true } } },
      })
      if (!usage || usage.session.project.userId !== ctx.session.user.id) {
        throw new TRPCError({ code: 'NOT_FOUND' })
      }
      await ctx.prisma.calibrationFrameUsage.delete({
        where: { sessionId_calibrationFrameId: input },
      })
      return { success: true }
    }),
})
