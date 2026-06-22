import { z } from 'zod'
import { TRPCError } from '@trpc/server'
import { router, protectedProcedure } from '../trpc'
import { autoMatchCalibration } from './calibration'

async function assertSessionOwnership(ctx: any, sessionId: string) {
  const session = await ctx.prisma.imagingSession.findFirst({
    where: { id: sessionId, project: { userId: ctx.session.user.id } },
    include: { project: true },
  })
  if (!session) throw new TRPCError({ code: 'NOT_FOUND' })
  return session
}

async function recalcProjectMetrics(ctx: any, projectId: string) {
  const sessions = await ctx.prisma.imagingSession.findMany({
    where: { projectId },
    select: { lightsCount: true, exposureSeconds: true },
  })

  const totalLights = sessions.reduce((sum: number, s: any) => sum + (s.lightsCount ?? 0), 0)
  const totalIntegrationMinutes = sessions.reduce(
    (sum: number, s: any) => sum + ((s.lightsCount ?? 0) * (s.exposureSeconds ?? 0)) / 60,
    0,
  )

  await ctx.prisma.imagingProject.update({
    where: { id: projectId },
    data: { totalLights, totalIntegrationMinutes },
  })
}

export const sessionsRouter = router({
  list: protectedProcedure
    .input(z.object({ projectId: z.string() }))
    .query(async ({ ctx, input }) => {
      const project = await ctx.prisma.imagingProject.findFirst({
        where: { id: input.projectId, userId: ctx.session.user.id },
      })
      if (!project) throw new TRPCError({ code: 'NOT_FOUND' })

      return ctx.prisma.imagingSession.findMany({
        where: { projectId: input.projectId },
        include: {
          setup: { include: { telescope: true, camera: true } },
          files: true,
        },
        orderBy: { observedAt: 'desc' },
      })
    }),

  create: protectedProcedure
    .input(z.object({
      projectId:       z.string(),
      setupId:         z.string().optional(),
      observedAt:      z.string().datetime(),
      temperatureC:    z.number().optional(),
      humidityPct:     z.number().int().min(0).max(100).optional(),
      seeingArcsec:    z.number().positive().optional(),
      sqmValue:        z.number().optional(),
      cloudCoverPct:   z.number().int().min(0).max(100).optional(),
      bortleScale:     z.number().int().min(1).max(9).optional(),
      filterUsed:      z.string().optional(),
      lightsCount:     z.number().int().min(0).default(0),
      exposureSeconds: z.number().positive().optional(),
      gain:            z.number().int().optional(),
      offset:          z.number().int().optional(),
      binning:         z.string().optional(),
      sensorTempC:     z.number().optional(),
      guidingRmsArcsec: z.number().positive().optional(),
      // Planetária
      captureSoftware: z.string().optional(),
      videoFormat:     z.string().optional(),
      fps:             z.number().positive().optional(),
      exposureMs:      z.number().positive().optional(),
      totalFrames:     z.number().int().min(0).optional(),
      stackedPct:      z.number().int().min(0).max(100).optional(),
      roi:             z.string().optional(),
      notes:           z.string().optional(),
      rating:          z.number().int().min(1).max(5).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const project = await ctx.prisma.imagingProject.findFirst({
        where: { id: input.projectId, userId: ctx.session.user.id },
      })
      if (!project) throw new TRPCError({ code: 'NOT_FOUND' })

      if (input.setupId) {
        const setup = await ctx.prisma.equipmentSetup.findFirst({
          where: { id: input.setupId, userId: ctx.session.user.id },
        })
        if (!setup) throw new TRPCError({ code: 'NOT_FOUND', message: 'Setup not found' })
      }

      const session = await ctx.prisma.imagingSession.create({
        data: { ...input, observedAt: new Date(input.observedAt) },
        include: { setup: true, files: true },
      })

      await recalcProjectMetrics(ctx, input.projectId)
      return session
    }),

  // Cria várias sessões de uma vez (import de pasta de FITS / sequência N.I.N.A.)
  bulkCreate: protectedProcedure
    .input(z.object({
      projectId: z.string(),
      setupId:   z.string().optional(),
      sessions: z.array(z.object({
        observedAt:      z.string().datetime(),
        filterUsed:      z.string().optional(),
        lightsCount:     z.number().int().min(0).default(0),
        exposureSeconds: z.number().positive().optional(),
        gain:            z.number().int().optional(),
        offset:          z.number().int().optional(),
        binning:         z.string().optional(),
        sensorTempC:     z.number().optional(),
        notes:           z.string().optional(),
      })).min(1).max(500),
    }))
    .mutation(async ({ ctx, input }) => {
      const project = await ctx.prisma.imagingProject.findFirst({
        where: { id: input.projectId, userId: ctx.session.user.id },
      })
      if (!project) throw new TRPCError({ code: 'NOT_FOUND' })

      let cameraId: string | undefined
      if (input.setupId) {
        const setup = await ctx.prisma.equipmentSetup.findFirst({
          where:  { id: input.setupId, userId: ctx.session.user.id },
          select: { id: true, cameraId: true },
        })
        if (!setup) throw new TRPCError({ code: 'NOT_FOUND', message: 'Setup not found' })
        cameraId = setup.cameraId
      }

      // Cria individualmente (precisamos dos ids para o auto-link da calibração)
      let autoLinked = 0
      for (const s of input.sessions) {
        const created = await ctx.prisma.imagingSession.create({
          data:   { projectId: input.projectId, setupId: input.setupId, ...s, observedAt: new Date(s.observedAt) },
          select: { id: true },
        })
        if (cameraId) {
          const matches = await autoMatchCalibration(ctx.prisma, ctx.session.user.id, {
            cameraId, gain: s.gain, exposureSeconds: s.exposureSeconds, sensorTempC: s.sensorTempC,
          })
          for (const cfId of matches) {
            await ctx.prisma.calibrationFrameUsage.create({
              data: { sessionId: created.id, calibrationFrameId: cfId },
            })
            autoLinked++
          }
        }
      }

      await recalcProjectMetrics(ctx, input.projectId)
      return { count: input.sessions.length, autoLinked }
    }),

  update: protectedProcedure
    .input(z.object({
      id:              z.string(),
      setupId:         z.string().nullable().optional(),
      observedAt:      z.string().datetime().optional(),
      temperatureC:    z.number().nullable().optional(),
      humidityPct:     z.number().int().min(0).max(100).nullable().optional(),
      seeingArcsec:    z.number().positive().nullable().optional(),
      sqmValue:        z.number().nullable().optional(),
      cloudCoverPct:   z.number().int().min(0).max(100).nullable().optional(),
      bortleScale:     z.number().int().min(1).max(9).nullable().optional(),
      filterUsed:      z.string().nullable().optional(),
      lightsCount:     z.number().int().min(0).optional(),
      exposureSeconds: z.number().positive().nullable().optional(),
      gain:            z.number().int().nullable().optional(),
      offset:          z.number().int().nullable().optional(),
      binning:         z.string().nullable().optional(),
      sensorTempC:     z.number().nullable().optional(),
      guidingRmsArcsec: z.number().positive().nullable().optional(),
      // Planetária
      captureSoftware: z.string().nullable().optional(),
      videoFormat:     z.string().nullable().optional(),
      fps:             z.number().positive().nullable().optional(),
      exposureMs:      z.number().positive().nullable().optional(),
      totalFrames:     z.number().int().min(0).nullable().optional(),
      stackedPct:      z.number().int().min(0).max(100).nullable().optional(),
      roi:             z.string().nullable().optional(),
      notes:           z.string().nullable().optional(),
      rating:          z.number().int().min(1).max(5).nullable().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { id, observedAt, ...data } = input
      const existing = await assertSessionOwnership(ctx, id)

      const updated = await ctx.prisma.imagingSession.update({
        where: { id },
        data: {
          ...data,
          ...(observedAt && { observedAt: new Date(observedAt) }),
        },
        include: { setup: true, files: true },
      })

      await recalcProjectMetrics(ctx, existing.projectId)
      return updated
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const session = await assertSessionOwnership(ctx, input.id)
      await ctx.prisma.imagingSession.delete({ where: { id: input.id } })
      await recalcProjectMetrics(ctx, session.projectId)
      return { success: true }
    }),

  addFile: protectedProcedure
    .input(z.object({
      sessionId:    z.string(),
      fileType:     z.enum(['LIGHT','DARK','FLAT','BIAS','MASTER_DARK','MASTER_FLAT','MASTER_BIAS']),
      storagePath:  z.string(),
      originalName: z.string(),
      sizeBytes:    z.number().int().positive(),
      exifData:     z.any().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      await assertSessionOwnership(ctx, input.sessionId)
      return ctx.prisma.sessionFile.create({
        data: { ...input, sizeBytes: BigInt(input.sizeBytes) },
      })
    }),

  deleteFile: protectedProcedure
    .input(z.object({ fileId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const file = await ctx.prisma.sessionFile.findUnique({
        where: { id: input.fileId },
        include: { session: { include: { project: true } } },
      })
      if (!file || file.session.project.userId !== ctx.session.user.id) {
        throw new TRPCError({ code: 'NOT_FOUND' })
      }
      await ctx.prisma.sessionFile.delete({ where: { id: input.fileId } })
      return { storagePath: file.storagePath }
    }),
})
