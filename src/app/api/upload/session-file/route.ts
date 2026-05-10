import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getSupabaseAdmin, STORAGE_BUCKET, buildStoragePath } from '@/lib/supabase'

async function syncLightsCount(sessionId: string, projectId: string) {
  const lightCount = await prisma.sessionFile.count({
    where: { sessionId, fileType: 'LIGHT' as any },
  })
  await prisma.imagingSession.update({
    where: { id: sessionId },
    data: { lightsCount: lightCount },
  })
  const sessions = await prisma.imagingSession.findMany({
    where: { projectId },
    select: { lightsCount: true, exposureSeconds: true },
  })
  const totalLights = sessions.reduce((sum, s) => sum + (s.lightsCount ?? 0), 0)
  const totalIntegrationMinutes = sessions.reduce(
    (sum, s) => sum + ((s.lightsCount ?? 0) * (s.exposureSeconds ?? 0)) / 60,
    0,
  )
  await prisma.imagingProject.update({
    where: { id: projectId },
    data: { totalLights, totalIntegrationMinutes },
  })
}

export async function POST(req: NextRequest) {
  const auth = await getServerSession(authOptions)
  if (!auth?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const form = await req.formData()
  const file      = form.get('file')      as File   | null
  const sessionId = form.get('sessionId') as string | null
  const projectId = form.get('projectId') as string | null
  const fileType  = form.get('fileType')  as string | null

  if (!file || !sessionId || !projectId || !fileType) {
    return NextResponse.json({ error: 'Campos obrigatórios faltando' }, { status: 400 })
  }

  const imagingSession = await prisma.imagingSession.findFirst({
    where: { id: sessionId, projectId, project: { userId: auth.user.id } },
  })
  if (!imagingSession) return NextResponse.json({ error: 'Sessão não encontrada' }, { status: 404 })

  const filename    = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
  const storagePath = buildStoragePath(auth.user.id, projectId, sessionId, fileType, filename)

  const admin = getSupabaseAdmin()
  const buffer = await file.arrayBuffer()
  const { error } = await admin.storage.from(STORAGE_BUCKET).upload(storagePath, buffer, {
    upsert: true,
    contentType: file.type || 'application/octet-stream',
  })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const record = await prisma.sessionFile.create({
    data: {
      sessionId,
      fileType:     fileType as any,
      storagePath,
      originalName: file.name,
      sizeBytes:    BigInt(file.size),
    },
    select: { id: true, fileType: true, originalName: true },
  })

  if (fileType === 'LIGHT') {
    await syncLightsCount(sessionId, projectId)
  }

  return NextResponse.json(record)
}

export async function DELETE(req: NextRequest) {
  const auth = await getServerSession(authOptions)
  if (!auth?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()

  if (body.fileId) {
    const file = await prisma.sessionFile.findUnique({
      where: { id: body.fileId },
      include: { session: { include: { project: true } } },
    })
    if (!file || file.session.project.userId !== auth.user.id) {
      return NextResponse.json({ error: 'Não encontrado' }, { status: 404 })
    }
    const admin = getSupabaseAdmin()
    await admin.storage.from(STORAGE_BUCKET).remove([file.storagePath])
    await prisma.sessionFile.delete({ where: { id: body.fileId } })

    if (file.fileType === 'LIGHT') {
      await syncLightsCount(file.sessionId, file.session.projectId)
    }

  } else if (body.sessionId && body.fileType) {
    const files = await prisma.sessionFile.findMany({
      where: {
        sessionId: body.sessionId,
        fileType:  body.fileType,
        session:   { project: { userId: auth.user.id } },
      },
      select: { id: true, storagePath: true, session: { select: { projectId: true } } },
    })
    if (files.length > 0) {
      const admin = getSupabaseAdmin()
      await admin.storage.from(STORAGE_BUCKET).remove(files.map(f => f.storagePath))
      await prisma.sessionFile.deleteMany({ where: { id: { in: files.map(f => f.id) } } })

      if (body.fileType === 'LIGHT') {
        await syncLightsCount(body.sessionId, files[0].session.projectId)
      }
    }

  } else {
    return NextResponse.json({ error: 'fileId ou sessionId+fileType obrigatórios' }, { status: 400 })
  }

  return NextResponse.json({ success: true })
}
