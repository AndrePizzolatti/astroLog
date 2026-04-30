import { z } from 'zod'
import { TRPCError } from '@trpc/server'
import { router, protectedProcedure } from '../trpc'
import { getSupabaseAdmin, STORAGE_BUCKET } from '@/lib/supabase'

const CalibTypeEnum = z.enum(['DARK', 'BIAS', 'MASTER_DARK', 'MASTER_BIAS'])

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

  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const frame = await ctx.prisma.calibrationFrame.findFirst({
        where: { id: input.id, userId: ctx.session.user.id },
      })
      if (!frame) throw new TRPCError({ code: 'NOT_FOUND' })

      const admin = getSupabaseAdmin()
      await admin.storage.from(STORAGE_BUCKET).remove([frame.storagePath])
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
