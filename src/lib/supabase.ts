import { createClient } from '@supabase/supabase-js'

const supabaseUrl  = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnon)

export function getSupabaseAdmin() {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!serviceKey) throw new Error('SUPABASE_SERVICE_ROLE_KEY not set')
  return createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

export const STORAGE_BUCKET = 'astrolog-files'

export function buildCalibrationPath(userId: string, frameType: string, filename: string): string {
  const safe = filename.replace(/[^a-zA-Z0-9._-]/g, '_')
  return `${userId}/calibration-library/${frameType}/${safe}`
}

export function buildStoragePath(
  userId: string,
  projectId: string,
  sessionId: string,
  fileType: string,
  filename: string,
): string {
  return `${userId}/${projectId}/${sessionId}/${fileType}/${filename}`
}

export function getPublicUrl(path: string): string {
  const { data } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(path)
  return data.publicUrl
}

export async function uploadFile(
  path: string,
  file: File,
): Promise<{ path: string }> {
  const admin = getSupabaseAdmin()
  const { error } = await admin.storage.from(STORAGE_BUCKET).upload(path, file, {
    upsert: false,
    contentType: file.type,
  })
  if (error) throw new Error(error.message)
  return { path }
}

export async function deleteFile(path: string): Promise<void> {
  const admin = getSupabaseAdmin()
  const { error } = await admin.storage.from(STORAGE_BUCKET).remove([path])
  if (error) throw new Error(error.message)
}
