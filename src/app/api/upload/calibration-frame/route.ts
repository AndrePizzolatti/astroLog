import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getSupabaseAdmin, STORAGE_BUCKET, buildCalibrationPath } from '@/lib/supabase'

export async function POST(req: NextRequest) {
  const auth = await getServerSession(authOptions)
  if (!auth?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const form      = await req.formData()
  const file      = form.get('file')      as File   | null
  const frameType = form.get('frameType') as string | null

  if (!file || !frameType) {
    return NextResponse.json({ error: 'file e frameType obrigatórios' }, { status: 400 })
  }

  const storagePath = buildCalibrationPath(auth.user.id, frameType, file.name)

  const admin = getSupabaseAdmin()
  const buffer = await file.arrayBuffer()
  const { error } = await admin.storage.from(STORAGE_BUCKET).upload(storagePath, buffer, {
    upsert: true,
    contentType: file.type || 'application/octet-stream',
  })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({
    storagePath,
    originalName: file.name,
    sizeBytes:    file.size,
  })
}
