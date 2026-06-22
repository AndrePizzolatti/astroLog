import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { authenticateAgent } from '@/lib/agent-auth'

const FileEntry = z.object({
  label:       z.string().max(120),
  provider:    z.enum(['LOCAL', 'DRIVE', 'SUPABASE']).default('LOCAL'),
  storagePath: z.string().max(1000),
  fileType:    z.enum(['STACK', 'MASTER_DARK', 'MASTER_FLAT', 'FINAL_JPEG', 'FINAL_TIFF', 'OTHER']).default('STACK'),
  isFinal:     z.boolean().default(false),
})

const Schema = z.object({
  projectId:   z.string(),
  status:      z.enum(['processing', 'done', 'error']),
  // Manifesto de arquivamento — caminhos finais (SSD, pasta do Drive sincronizado…)
  files:       z.array(FileEntry).max(50).optional(),
  // Compat: resultado único
  resultPath:  z.string().max(1000).optional(),
  resultLabel: z.string().max(120).optional(),
  log:         z.string().max(4000).optional(),
})

// Recebe o status do processamento do agente local (sem cookie de sessão —
// autenticado por Bearer token). Em "done", registra o resultado como ProjectFile
// LOCAL e move o projeto para "Pronto p/ processar".
export async function POST(req: NextRequest) {
  const auth = await authenticateAgent(req)
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: z.infer<typeof Schema>
  try {
    body = Schema.parse(await req.json())
  } catch {
    return NextResponse.json({ error: 'Bad request' }, { status: 400 })
  }

  const project = await prisma.imagingProject.findFirst({
    where:  { id: body.projectId, userId: auth.userId },
    select: { id: true },
  })
  if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 })

  if (body.status === 'processing') {
    await prisma.imagingProject.update({ where: { id: project.id }, data: { status: 'PROCESSING' } })
  } else if (body.status === 'done') {
    const files = body.files?.length
      ? body.files
      : body.resultPath
        ? [{ label: body.resultLabel ?? 'Resultado (agente Siril)', provider: 'LOCAL' as const, storagePath: body.resultPath, fileType: 'STACK' as const, isFinal: true }]
        : []
    for (const f of files) {
      await prisma.projectFile.create({
        data: {
          projectId:   project.id,
          fileType:    f.fileType,
          provider:    f.provider,
          storagePath: f.storagePath,
          label:       f.label,
          isFinal:     f.isFinal,
        },
      })
    }
    await prisma.imagingProject.update({ where: { id: project.id }, data: { status: 'READY_TO_PROCESS' } })
  }
  // status === 'error': sem mudança estrutural; o agente mantém o próprio log

  return NextResponse.json({ ok: true })
}
