import { z } from 'zod'
import { TRPCError } from '@trpc/server'
import { router, protectedProcedure } from '../trpc'
import { calculateTelescope } from '@/lib/utils'

// ──────────────────────────────────────────
// Ownership guard
// ──────────────────────────────────────────
async function assertOwnership(
  ctx: any,
  model: 'telescope' | 'camera' | 'mount' | 'accessory' | 'equipmentSetup',
  id: string,
) {
  const record = await (ctx.prisma[model] as any).findFirst({
    where: { id, userId: ctx.session.user.id },
  })
  if (!record) throw new TRPCError({ code: 'NOT_FOUND' })
  return record
}

const ACCESSORY_TYPES = [
  'REDUCER_FLATTENER', 'BARLOW', 'OAG', 'FILTER_WHEEL',
  'FOCUSER', 'ROTATOR', 'DEW_HEATER', 'FILTER_INDIVIDUAL', 'OTHER',
] as const

// ──────────────────────────────────────────
// Telescopes
// ──────────────────────────────────────────
export const telescopeRouter = router({
  list: protectedProcedure.query(({ ctx }) =>
    ctx.prisma.telescope.findMany({
      where: { userId: ctx.session.user.id },
      include: { _count: { select: { setups: true } } },
      orderBy: { createdAt: 'desc' },
    }),
  ),

  create: protectedProcedure
    .input(z.object({
      name:               z.string().min(2),
      brand:              z.string().optional(),
      model:              z.string().optional(),
      opticalDesign:      z.string().optional(),
      focalLengthMm:      z.number().positive(),
      apertureMm:         z.number().positive(),
      focalRatioOverride: z.number().positive().optional(),
      obstruction:        z.number().min(0).max(100).optional(),
      weightKg:           z.number().positive().optional(),
      notes:              z.string().optional(),
    }))
    .mutation(({ ctx, input }) =>
      ctx.prisma.telescope.create({
        data: { ...input, userId: ctx.session.user.id },
      }),
    ),

  update: protectedProcedure
    .input(z.object({
      id:                 z.string(),
      name:               z.string().min(2).optional(),
      brand:              z.string().optional(),
      model:              z.string().optional(),
      opticalDesign:      z.string().optional(),
      focalLengthMm:      z.number().positive().optional(),
      apertureMm:         z.number().positive().optional(),
      focalRatioOverride: z.number().positive().nullable().optional(),
      obstruction:        z.number().min(0).max(100).nullable().optional(),
      weightKg:           z.number().positive().nullable().optional(),
      notes:              z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input
      await assertOwnership(ctx, 'telescope', id)
      return ctx.prisma.telescope.update({ where: { id }, data })
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await assertOwnership(ctx, 'telescope', input.id)
      await ctx.prisma.telescope.delete({ where: { id: input.id } })
      return { success: true }
    }),
})

// ──────────────────────────────────────────
// Cameras
// ──────────────────────────────────────────
export const cameraRouter = router({
  list: protectedProcedure.query(({ ctx }) =>
    ctx.prisma.camera.findMany({
      where: { userId: ctx.session.user.id },
      include: { _count: { select: { setups: true } } },
      orderBy: { createdAt: 'desc' },
    }),
  ),

  create: protectedProcedure
    .input(z.object({
      name:             z.string().min(2),
      brand:            z.string().optional(),
      model:            z.string().optional(),
      colorType:        z.enum(['COLOR', 'MONO', 'DSLR']).default('COLOR'),
      sensorName:       z.string().optional(),
      pixelSizeUm:      z.number().positive(),
      sensorWidthPx:    z.number().int().positive(),
      sensorHeightPx:   z.number().int().positive(),
      fullWellCapacity: z.number().positive().optional(),
      readNoiseE:       z.number().positive().optional(),
      qeMax:            z.number().min(0).max(100).optional(),
      cooled:           z.boolean().default(false),
      weightKg:         z.number().positive().optional(),
      notes:            z.string().optional(),
    }))
    .mutation(({ ctx, input }) =>
      ctx.prisma.camera.create({
        data: { ...input, userId: ctx.session.user.id },
      }),
    ),

  update: protectedProcedure
    .input(z.object({
      id:               z.string(),
      name:             z.string().min(2).optional(),
      brand:            z.string().optional(),
      model:            z.string().optional(),
      colorType:        z.enum(['COLOR', 'MONO', 'DSLR']).optional(),
      sensorName:       z.string().optional(),
      pixelSizeUm:      z.number().positive().optional(),
      sensorWidthPx:    z.number().int().positive().optional(),
      sensorHeightPx:   z.number().int().positive().optional(),
      fullWellCapacity: z.number().positive().nullable().optional(),
      readNoiseE:       z.number().positive().nullable().optional(),
      qeMax:            z.number().min(0).max(100).nullable().optional(),
      cooled:           z.boolean().optional(),
      weightKg:         z.number().positive().nullable().optional(),
      notes:            z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input
      await assertOwnership(ctx, 'camera', id)
      return ctx.prisma.camera.update({ where: { id }, data })
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await assertOwnership(ctx, 'camera', input.id)
      await ctx.prisma.camera.delete({ where: { id: input.id } })
      return { success: true }
    }),
})

// ──────────────────────────────────────────
// Mounts
// ──────────────────────────────────────────
export const mountRouter = router({
  list: protectedProcedure.query(({ ctx }) =>
    ctx.prisma.mount.findMany({
      where: { userId: ctx.session.user.id },
      include: { _count: { select: { setups: true } } },
      orderBy: { createdAt: 'desc' },
    }),
  ),

  create: protectedProcedure
    .input(z.object({
      name:          z.string().min(2),
      brand:         z.string().optional(),
      model:         z.string().optional(),
      mountType:     z.enum(['EQ', 'ALT_AZ', 'DOBSONIAN', 'FORK', 'TRACKING']).default('EQ'),
      payloadKg:     z.number().positive().optional(),
      hasGuidingPort: z.boolean().default(true),
      hasPolarScope:  z.boolean().default(false),
      weightKg:      z.number().positive().optional(),
      notes:         z.string().optional(),
    }))
    .mutation(({ ctx, input }) =>
      ctx.prisma.mount.create({
        data: { ...input, userId: ctx.session.user.id },
      }),
    ),

  update: protectedProcedure
    .input(z.object({
      id:             z.string(),
      name:           z.string().min(2).optional(),
      brand:          z.string().optional(),
      model:          z.string().optional(),
      mountType:      z.enum(['EQ', 'ALT_AZ', 'DOBSONIAN', 'FORK', 'TRACKING']).optional(),
      payloadKg:      z.number().positive().nullable().optional(),
      hasGuidingPort: z.boolean().optional(),
      hasPolarScope:  z.boolean().optional(),
      weightKg:       z.number().positive().nullable().optional(),
      notes:          z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input
      await assertOwnership(ctx, 'mount', id)
      return ctx.prisma.mount.update({ where: { id }, data })
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await assertOwnership(ctx, 'mount', input.id)
      await ctx.prisma.mount.delete({ where: { id: input.id } })
      return { success: true }
    }),
})

// ──────────────────────────────────────────
// Accessories
// ──────────────────────────────────────────
export const accessoryRouter = router({
  list: protectedProcedure.query(({ ctx }) =>
    ctx.prisma.accessory.findMany({
      where: { userId: ctx.session.user.id },
      include: { _count: { select: { setupAccessories: true } } },
      orderBy: { createdAt: 'desc' },
    }),
  ),

  create: protectedProcedure
    .input(z.object({
      name:        z.string().min(2),
      type:        z.enum(ACCESSORY_TYPES),
      brand:       z.string().optional(),
      model:       z.string().optional(),
      focalFactor: z.number().positive().optional(),
      notes:       z.string().optional(),
    }))
    .mutation(({ ctx, input }) =>
      ctx.prisma.accessory.create({
        data: { ...input, userId: ctx.session.user.id },
      }),
    ),

  update: protectedProcedure
    .input(z.object({
      id:          z.string(),
      name:        z.string().min(2).optional(),
      type:        z.enum(ACCESSORY_TYPES).optional(),
      brand:       z.string().optional(),
      model:       z.string().optional(),
      focalFactor: z.number().positive().nullable().optional(),
      notes:       z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input
      await assertOwnership(ctx, 'accessory', id)
      return ctx.prisma.accessory.update({ where: { id }, data })
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await assertOwnership(ctx, 'accessory', input.id)
      await ctx.prisma.accessory.delete({ where: { id: input.id } })
      return { success: true }
    }),
})

// ──────────────────────────────────────────
// Setups
// ──────────────────────────────────────────
export const setupRouter = router({
  list: protectedProcedure.query(({ ctx }) =>
    ctx.prisma.equipmentSetup.findMany({
      where: { userId: ctx.session.user.id },
      include: {
        telescope:   true,
        camera:      true,
        mount:       true,
        accessories: { include: { accessory: true } },
        _count:      { select: { projects: true } },
      },
      orderBy: [{ isDefault: 'desc' }, { updatedAt: 'desc' }],
    }),
  ),

  byId: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const setup = await ctx.prisma.equipmentSetup.findFirst({
        where: { id: input.id, userId: ctx.session.user.id },
        include: {
          telescope:   true,
          camera:      true,
          mount:       true,
          accessories: { include: { accessory: true } },
        },
      })
      if (!setup) throw new TRPCError({ code: 'NOT_FOUND' })
      return setup
    }),

  create: protectedProcedure
    .input(z.object({
      name:             z.string().min(2),
      telescopeId:      z.string(),
      cameraId:         z.string(),
      mountId:          z.string().optional(),
      isDefault:        z.boolean().default(false),
      effectiveFocalMm: z.number().positive().optional(),
      filtersAvailable: z.array(z.string()).default([]),
      accessoryIds:     z.array(z.string()).default([]),
      notes:            z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { accessoryIds, ...data } = input
      const userId = ctx.session.user.id

      await Promise.all([
        assertOwnership(ctx, 'telescope', data.telescopeId),
        assertOwnership(ctx, 'camera', data.cameraId),
        data.mountId ? assertOwnership(ctx, 'mount', data.mountId) : Promise.resolve(),
      ])

      if (data.isDefault) {
        await ctx.prisma.equipmentSetup.updateMany({
          where: { userId, isDefault: true },
          data:  { isDefault: false },
        })
      }

      return ctx.prisma.equipmentSetup.create({
        data: {
          ...data,
          userId,
          accessories: {
            create: accessoryIds.map(accessoryId => ({ accessoryId })),
          },
        },
        include: { telescope: true, camera: true, mount: true },
      })
    }),

  update: protectedProcedure
    .input(z.object({
      id:               z.string(),
      name:             z.string().min(2).optional(),
      telescopeId:      z.string().optional(),
      cameraId:         z.string().optional(),
      mountId:          z.string().nullable().optional(),
      isDefault:        z.boolean().optional(),
      effectiveFocalMm: z.number().positive().nullable().optional(),
      filtersAvailable: z.array(z.string()).optional(),
      accessoryIds:     z.array(z.string()).optional(),
      notes:            z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { id, accessoryIds, ...data } = input
      await assertOwnership(ctx, 'equipmentSetup', id)
      const userId = ctx.session.user.id

      if (data.isDefault) {
        await ctx.prisma.equipmentSetup.updateMany({
          where: { userId, isDefault: true },
          data:  { isDefault: false },
        })
      }

      return ctx.prisma.equipmentSetup.update({
        where: { id },
        data: {
          ...data,
          ...(accessoryIds !== undefined && {
            accessories: {
              deleteMany: {},
              create: accessoryIds.map(accessoryId => ({ accessoryId })),
            },
          }),
        },
        include: { telescope: true, camera: true, mount: true },
      })
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await assertOwnership(ctx, 'equipmentSetup', input.id)
      await ctx.prisma.equipmentSetup.delete({ where: { id: input.id } })
      return { success: true }
    }),

  calculateOptics: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const setup = await ctx.prisma.equipmentSetup.findFirst({
        where: { id: input.id, userId: ctx.session.user.id },
        include: { telescope: true, camera: true },
      })
      if (!setup) throw new TRPCError({ code: 'NOT_FOUND' })

      const effectiveFocal = setup.effectiveFocalMm ?? setup.telescope.focalLengthMm

      return calculateTelescope({
        focalLengthMm:  effectiveFocal,
        apertureMm:     setup.telescope.apertureMm,
        pixelSizeUm:    setup.camera.pixelSizeUm,
        sensorWidthPx:  setup.camera.sensorWidthPx,
        sensorHeightPx: setup.camera.sensorHeightPx,
      })
    }),
})
