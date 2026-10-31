import 'server-only'
import { FileItem } from '@/lib/types'
import { files } from './db/schema'

type FileRow = typeof files.$inferSelect

export function toFileItem(row: FileRow, parentId: string | null): FileItem {
  return {
    id: row.id,
    driveAccountId: row.driveAccountId,
    name: row.name,
    title: row.title,
    mimeType: row.mimeType,
    isFolder: row.isFolder,
    size: row.size,
    hasThumbnail: row.hasThumbnail,
    webViewLink: row.webViewLink,
    width: row.width,
    height: row.height,
    durationMs: row.durationMs,
    modifiedAt: row.modifiedAt,
    version: row.version,
    trashed: row.trashed,
    parentId
  }
}
