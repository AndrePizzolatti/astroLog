import { prisma } from './prisma'

const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token'
const DRIVE_API = 'https://www.googleapis.com/drive/v3/files'
const FOLDER_MIME = 'application/vnd.google-apps.folder'

export async function getGoogleAccount(userId: string) {
  return prisma.account.findFirst({ where: { userId, provider: 'google' } })
}

export function hasDriveScope(account: { scope?: string | null } | null): boolean {
  return !!account?.scope?.includes('drive')
}

// Retorna um access_token válido, renovando via refresh_token se necessário.
export async function getGoogleAccessToken(userId: string): Promise<string | null> {
  const account = await getGoogleAccount(userId)
  if (!account) return null

  const now = Math.floor(Date.now() / 1000)
  if (account.access_token && account.expires_at && account.expires_at > now + 60) {
    return account.access_token
  }
  if (!account.refresh_token) return account.access_token ?? null

  const res = await fetch(GOOGLE_TOKEN_URL, {
    method:  'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body:    new URLSearchParams({
      client_id:     process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      refresh_token: account.refresh_token,
      grant_type:    'refresh_token',
    }),
  })
  if (!res.ok) return null

  const data = (await res.json()) as { access_token: string; expires_in: number }
  await prisma.account.update({
    where: { id: account.id },
    data:  { access_token: data.access_token, expires_at: now + data.expires_in },
  })
  return data.access_token
}

export interface DriveItem {
  id:            string
  name:          string
  mimeType:      string
  isFolder:      boolean
  link:          string
  modifiedTime?: string
}

export async function listDrive(
  accessToken: string,
  opts: { folderId?: string; search?: string; pageToken?: string },
): Promise<{ items: DriveItem[]; nextPageToken?: string }> {
  const parts = ['trashed = false']
  if (opts.search) parts.push(`name contains '${opts.search.replace(/['\\]/g, '')}'`)
  else parts.push(`'${(opts.folderId || 'root').replace(/['\\]/g, '')}' in parents`)

  const url = new URL(DRIVE_API)
  url.searchParams.set('q', parts.join(' and '))
  url.searchParams.set('fields', 'nextPageToken, files(id,name,mimeType,modifiedTime)')
  url.searchParams.set('orderBy', 'folder,name')
  url.searchParams.set('pageSize', '100')
  url.searchParams.set('spaces', 'drive')
  if (opts.pageToken) url.searchParams.set('pageToken', opts.pageToken)

  const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } })
  if (!res.ok) throw new Error(`Drive API ${res.status}`)

  const data = (await res.json()) as { nextPageToken?: string; files: any[] }
  const items: DriveItem[] = (data.files ?? []).map(f => {
    const isFolder = f.mimeType === FOLDER_MIME
    return {
      id:           f.id,
      name:         f.name,
      mimeType:     f.mimeType,
      isFolder,
      // Link construído pelo id — robusto, não depende de webViewLink no scope de metadados
      link:         isFolder
        ? `https://drive.google.com/drive/folders/${f.id}`
        : `https://drive.google.com/file/d/${f.id}/view`,
      modifiedTime: f.modifiedTime,
    }
  })
  return { items, nextPageToken: data.nextPageToken }
}
