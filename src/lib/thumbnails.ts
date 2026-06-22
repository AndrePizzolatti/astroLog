import { getPublicUrl } from './supabase'

// Extrai o id do arquivo de um link do Google Drive (vários formatos).
export function driveFileId(url: string): string | null {
  return url.match(/\/file\/d\/([\w-]+)/)?.[1]
    ?? url.match(/[?&]id=([\w-]+)/)?.[1]
    ?? url.match(/\/d\/([\w-]+)/)?.[1]
    ?? null
}

// URL de thumbnail exibível no navegador a partir de um arquivo de capa.
// Drive → endpoint de thumbnail; Supabase → URL pública; Local → null (sem preview).
export function coverThumbUrl(file: { provider: string; storagePath: string }): string | null {
  if (file.provider === 'DRIVE') {
    const id = driveFileId(file.storagePath)
    return id ? `https://drive.google.com/thumbnail?id=${id}&sz=w1000` : null
  }
  if (file.provider === 'SUPABASE') {
    try { return getPublicUrl(file.storagePath) } catch { return null }
  }
  return null // LOCAL — o navegador não exibe caminho de disco
}
