import 'server-only'
import { getAccessToken } from './tokens'
import { fetchWithBackoff } from './limit'

export async function fetchWithToken(
  driveAccountId: string,
  url: string,
  options?: RequestInit,
): Promise<Response> {
  const token = await getAccessToken(driveAccountId)

  const headers = new Headers(options?.headers)
  headers.set('Authorization', `Bearer ${token}`)

  return fetchWithBackoff(driveAccountId, url, {
    ...options,
    headers,
  })
}

export const COMMON_FIELDS = 'id,name,mimeType,size,modifiedTime,parents,trashed,webViewLink,hasThumbnail,imageMediaMetadata,videoMediaMetadata'
