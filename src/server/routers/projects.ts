import { z } from 'zod'
import { TRPCError } from '@trpc/server'
import { router, protectedProcedure } from '../trpc'

async function assertProjectOwnership(ctx: any, projectId: string) {
  const project = await ctx.prisma.imagingProject.findFirst({
    where: { id: projectId, userId: ctx.session.user.id },
  })
  if (!project) throw new TRPCError({ code: 'NOT_FOUND' })
  return project
}

export const projectsRouter = router({
  list: protectedProcedure
    .input(z.object({
      status: z.enum(['PLANNING','IN_PROGRESS','READY_TO_PROCESS','PROCESSING','COMPLETED','ARCHIVED']).optional(),
    }).optional())
    .query(({ ctx, input }) =>
      ctx.prisma.imagingProject.findMany({
        where: {
          userId: ctx.session.user.id,
          ...(input?.status && { status: input.status }),
        },
        include: {
          setup: { include: { telescope: true, camera: true } },
          _count: { select: { imagingSessions: true, projectFiles: true } },
        },
        orderBy: [{ status: 'asc' }, { updatedAt: 'desc' }],
      }),
    ),

  // Integração agregada por ano a partir das SESSÕES (observedAt),
  // não de updatedAt do projeto. Soma lightsCount × exposureSeconds das
  // sessões cujo observedAt cai no ano pedido.
  statsByYear: protectedProcedure
    .input(z.object({
      year: z.number().int().min(1970).max(3000).optional(),
    }).optional())
    .query(async ({ ctx, input }) => {
      const year  = input?.year ?? new Date().getFullYear()
      const start = new Date(year, 0, 1)
      const end   = new Date(year + 1, 0, 1)

      const sessions = await ctx.prisma.imagingSession.findMany({
        where: {
          project:    { userId: ctx.session.user.id },
          observedAt: { gte: start, lt: end },
        },
        select: { lightsCount: true, exposureSeconds: true },
      })

      const integrationSeconds = sessions.reduce(
        (sum, s) => sum + (s.lightsCount ?? 0) * (s.exposureSeconds ?? 0),
        0,
      )

      return {
        year,
        sessionCount:       sessions.length,
        totalLights:        sessions.reduce((sum, s) => sum + (s.lightsCount ?? 0), 0),
        integrationMinutes: integrationSeconds / 60,
        integrationHours:   integrationSeconds / 3600,
      }
    }),

  byId: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const project = await ctx.prisma.imagingProject.findFirst({
        where: { id: input.id, userId: ctx.session.user.id },
        include: {
          setup: { include: { telescope: true, camera: true, mount: true } },
          imagingSessions: {
            include: {
              setup:  { include: { telescope: true, camera: true } },
              files:  true,
              calibrationFrameUsages: {
                include: {
                  calibrationFrame: {
                    select: { id: true, label: true, frameType: true },
                  },
                },
              },
            },
            orderBy: { observedAt: 'desc' },
          },
          projectFiles: { orderBy: { createdAt: 'desc' } },
        },
      })
      if (!project) throw new TRPCError({ code: 'NOT_FOUND' })
      return project
    }),

  create: protectedProcedure
    .input(z.object({
      name:         z.string().min(2),
      targetObject: z.string().min(1),
      targetType:   z.string().optional(),
      description:  z.string().optional(),
      setupId:      z.string().optional(),
      status:       z.enum(['PLANNING','IN_PROGRESS','READY_TO_PROCESS','PROCESSING','COMPLETED','ARCHIVED']).default('IN_PROGRESS'),
      visibility:   z.enum(['PRIVATE','FRIENDS','PUBLIC']).default('PRIVATE'),
      raHours:      z.number().min(0).max(24).optional(),
      decDegrees:   z.number().min(-90).max(90).optional(),
      startedAt:    z.string().datetime().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      if (input.setupId) {
        const setup = await ctx.prisma.equipmentSetup.findFirst({
          where: { id: input.setupId, userId: ctx.session.user.id },
        })
        if (!setup) throw new TRPCError({ code: 'NOT_FOUND', message: 'Setup not found' })
      }
      return ctx.prisma.imagingProject.create({
        data: {
          ...input,
          startedAt: input.startedAt ? new Date(input.startedAt) : undefined,
          userId: ctx.session.user.id,
        },
        include: { setup: true },
      })
    }),

  update: protectedProcedure
    .input(z.object({
      id:           z.string(),
      name:         z.string().min(2).optional(),
      targetObject: z.string().min(1).optional(),
      targetType:   z.string().optional(),
      description:  z.string().optional(),
      setupId:      z.string().nullable().optional(),
      status:       z.enum(['PLANNING','IN_PROGRESS','READY_TO_PROCESS','PROCESSING','COMPLETED','ARCHIVED']).optional(),
      visibility:   z.enum(['PRIVATE','FRIENDS','PUBLIC']).optional(),
      raHours:      z.number().min(0).max(24).nullable().optional(),
      decDegrees:   z.number().min(-90).max(90).nullable().optional(),
      completedAt:  z.string().datetime().nullable().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { id, completedAt, ...data } = input
      await assertProjectOwnership(ctx, id)
      return ctx.prisma.imagingProject.update({
        where: { id },
        data: {
          ...data,
          ...(completedAt !== undefined && {
            completedAt: completedAt ? new Date(completedAt) : null,
          }),
        },
        include: { setup: true },
      })
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await assertProjectOwnership(ctx, input.id)
      await ctx.prisma.imagingProject.delete({ where: { id: input.id } })
      return { success: true }
    }),

  techSheet: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const project = await ctx.prisma.imagingProject.findFirst({
        where: { id: input.id, userId: ctx.session.user.id },
        include: {
          setup: {
            include: { telescope: true, camera: true, mount: true },
          },
          imagingSessions: {
            include: {
              setup: { include: { telescope: true, camera: true } },
            },
            orderBy: { observedAt: 'asc' },
          },
        },
      })
      if (!project) throw new TRPCError({ code: 'NOT_FOUND' })

      const sessions = project.imagingSessions
      const filters = [...new Set(sessions.flatMap(s => s.filterUsed ? [s.filterUsed] : []))]
      const avgSeeing = sessions.filter(s => s.seeingArcsec).reduce((a, s, _, arr) =>
        a + (s.seeingArcsec ?? 0) / arr.filter(x => x.seeingArcsec).length, 0)
      const avgSqm = sessions.filter(s => s.sqmValue).reduce((a, s, _, arr) =>
        a + (s.sqmValue ?? 0) / arr.filter(x => x.sqmValue).length, 0)
      const avgGuiding = sessions.filter(s => s.guidingRmsArcsec).reduce((a, s, _, arr) =>
        a + (s.guidingRmsArcsec ?? 0) / arr.filter(x => x.guidingRmsArcsec).length, 0)

      return {
        project,
        stats: {
          sessionCount:        sessions.length,
          totalLights:         project.totalLights,
          totalIntegrationMin: project.totalIntegrationMinutes,
          filtersUsed:         filters,
          avgSeeingArcsec:     avgSeeing > 0 ? +avgSeeing.toFixed(2) : null,
          avgSqmValue:         avgSqm > 0 ? +avgSqm.toFixed(2) : null,
          avgGuidingRms:       avgGuiding > 0 ? +avgGuiding.toFixed(2) : null,
          firstSessionDate:    sessions[0]?.observedAt ?? null,
          lastSessionDate:     sessions[sessions.length - 1]?.observedAt ?? null,
        },
      }
    }),

  addFile: protectedProcedure
    .input(z.object({
      projectId:   z.string(),
      fileType:    z.enum(['STACK','MASTER_DARK','MASTER_FLAT','FINAL_JPEG','FINAL_TIFF','OTHER']),
      provider:    z.enum(['SUPABASE','DRIVE','LOCAL']).default('SUPABASE'),
      storagePath: z.string().min(1),   // chave Supabase, URL do Drive, ou caminho local
      label:       z.string().min(1),
      isFinal:     z.boolean().default(false),
      sizeBytes:   z.number().int().positive().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      await assertProjectOwnership(ctx, input.projectId)
      return ctx.prisma.projectFile.create({
        data: {
          ...input,
          sizeBytes: input.sizeBytes ? BigInt(input.sizeBytes) : null,
        },
      })
    }),

  deleteFile: protectedProcedure
    .input(z.object({ fileId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const file = await ctx.prisma.projectFile.findUnique({
        where:   { id: input.fileId },
        include: { project: { select: { userId: true } } },
      })
      if (!file || file.project.userId !== ctx.session.user.id) {
        throw new TRPCError({ code: 'NOT_FOUND' })
      }
      await ctx.prisma.projectFile.delete({ where: { id: input.fileId } })
      return { provider: file.provider, storagePath: file.storagePath }
    }),

  // Edita o registro de um arquivo (ex.: quando você move o arquivo de lugar)
  updateFile: protectedProcedure
    .input(z.object({
      fileId:      z.string(),
      label:       z.string().min(1).optional(),
      provider:    z.enum(['SUPABASE', 'DRIVE', 'LOCAL']).optional(),
      storagePath: z.string().min(1).optional(),
      isFinal:     z.boolean().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { fileId, ...data } = input
      const file = await ctx.prisma.projectFile.findUnique({
        where:   { id: fileId },
        include: { project: { select: { userId: true } } },
      })
      if (!file || file.project.userId !== ctx.session.user.id) {
        throw new TRPCError({ code: 'NOT_FOUND' })
      }
      return ctx.prisma.projectFile.update({ where: { id: fileId }, data })
    }),
})
