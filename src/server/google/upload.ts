import 'server-only'
import { env } from '@/env'

type CreateResumableSessionInput = {
  accessToken: string
  name: string
  mimeType: string
  size: number
  parentId: string
  /** Set to replace an existing file's content instead of creating a new file. */
  replaceFileId?: string
}

export async function createResumableSession(input: CreateResumableSessionInput): Promise<string> {
  const { accessToken, name, mimeType, size, parentId, replaceFileId } = input
  const base = 'https://www.googleapis.com/upload/drive/v3/files'
  const url = replaceFileId
    ? `${base}/${encodeURIComponent(replaceFileId)}?uploadType=resumable&supportsAllDrives=true&fields=id,name,mimeType,size,version`
    : `${base}?uploadType=resumable&supportsAllDrives=true&fields=id,name,mimeType,size,version`

  const response = await fetch(url, {
    method: replaceFileId ? 'PATCH' : 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json; charset=UTF-8',
      'X-Upload-Content-Type': mimeType,
      'X-Upload-Content-Length': String(size),
      // Lets the browser PUT chunks to the session URL (CORS). Verify in Phase 5.
      Origin: env.NEXT_PUBLIC_APP_URL,
    },
    body: JSON.stringify(replaceFileId ? { name } : { name, parents: [parentId] }),
  })

  if (!response.ok) {
    throw new Error(`Failed to create resumable session: ${response.status}`)
  }

  const location = response.headers.get('Location')
  if (!location) throw new Error('Google did not return an upload session URL')
  return location
}
