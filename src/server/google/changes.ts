import 'server-only'
import { fetchWithToken, COMMON_FIELDS } from './drive'
import { AppError } from '@/server/errors'

export interface GoogleFile {
  id: string
  name: string
  mimeType: string
  size?: string
  modifiedTime?: string
  parents?: string[]
  trashed?: boolean
  webViewLink?: string
  imageMediaMetadata?: { width: number; height: number }
  videoMediaMetadata?: { durationMillis: string }
}

export interface DriveFileListResponse {
  files: GoogleFile[]
  nextPageToken?: string
}

export async function listScanFiles(
  driveAccountId: string,
  pageToken?: string | null,
): Promise<DriveFileListResponse> {
  const url = new URL('https://www.googleapis.com/drive/v3/files')
  url.searchParams.set('q', "'me' in owners or sharedWithMe = false")
  url.searchParams.set('pageSize', '1000')
  url.searchParams.set('fields', `nextPageToken,files(${COMMON_FIELDS})`)
  if (pageToken) {
    url.searchParams.set('pageToken', pageToken)
  }

  const res = await fetchWithToken(driveAccountId, url.toString())
  if (!res.ok) {
    throw new AppError('UPSTREAM_ERROR', `Failed to list files: ${res.statusText}`, res.status)
  }
  return res.json() as Promise<DriveFileListResponse>
}

export async function getStartPageToken(driveAccountId: string): Promise<string> {
  const url = new URL('https://www.googleapis.com/drive/v3/changes/startPageToken')
  const res = await fetchWithToken(driveAccountId, url.toString())
  if (!res.ok) {
    throw new AppError('UPSTREAM_ERROR', `Failed to get startPageToken: ${res.statusText}`, res.status)
  }
  const data = await res.json() as { startPageToken: string }
  return data.startPageToken
}

export interface DriveChange {
  type: 'file' | 'drive'
  time: string
  removed: boolean
  fileId: string
  file?: GoogleFile
}

export interface DriveChangesListResponse {
  nextPageToken?: string
  newStartPageToken?: string
  changes: DriveChange[]
}

export async function listChanges(
  driveAccountId: string,
  pageToken: string,
): Promise<DriveChangesListResponse> {
  const url = new URL('https://www.googleapis.com/drive/v3/changes')
  url.searchParams.set('pageToken', pageToken)
  url.searchParams.set('includeRemoved', 'true')
  url.searchParams.set('pageSize', '1000')
  url.searchParams.set('fields', `nextPageToken,newStartPageToken,changes(type,time,removed,fileId,file(${COMMON_FIELDS}))`)

  const res = await fetchWithToken(driveAccountId, url.toString())
  if (!res.ok) {
    throw new AppError('UPSTREAM_ERROR', `Failed to list changes: ${res.statusText}`, res.status)
  }
  return res.json() as Promise<DriveChangesListResponse>
}

export async function getDriveAbout(driveAccountId: string): Promise<{
  user: { emailAddress: string }
  storageQuota: { usage: string; limit?: string }
}> {
  const url = new URL('https://www.googleapis.com/drive/v3/about')
  url.searchParams.set('fields', 'user(emailAddress),storageQuota(usage,limit)')

  const res = await fetchWithToken(driveAccountId, url.toString())
  if (!res.ok) {
    throw new AppError('UPSTREAM_ERROR', `Failed to get Drive about: ${res.statusText}`, res.status)
  }
  return res.json() as Promise<{
    user: { emailAddress: string }
    storageQuota: { usage: string; limit?: string }
  }>
}
