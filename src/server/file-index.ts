import 'server-only'
import { sql } from 'drizzle-orm'
import { db } from '@/server/db'
import { files } from '@/server/db/schema'
import { AppError } from '@/server/errors'
import { fetchWithToken, COMMON_FIELDS } from '@/server/google/drive'
import type { GoogleFile } from '@/server/google/changes'
import { parseGoogleFile } from '@/server/sync'

export type FileRow = typeof files.$inferSelect

/** Reads a file's metadata from Google (never trusting the browser) and upserts it into the index. */
export async function indexDriveFile(driveAccountId: string, providerFileId: string, title?: string | null): Promise<{ row: FileRow; google: GoogleFile }> {
  const url = new URL(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(providerFileId)}`)
  url.searchParams.set('fields', COMMON_FIELDS)
  url.searchParams.set('supportsAllDrives', 'true')

  const res = await fetchWithToken(driveAccountId, url.toString())
  if (!res.ok) throw new AppError('UPSTREAM_ERROR', 'Could not read the uploaded file from Google Drive', 502)
  const google = (await res.json()) as GoogleFile

  const values = { ...parseGoogleFile(google, driveAccountId), title: title?.trim() || null }
  const [row] = await db
    .insert(files)
    .values(values)
    .onConflictDoUpdate({
      target: [files.driveAccountId, files.providerFileId],
      set: {
        parentProviderId: sql`EXCLUDED.parent_provider_id`,
        name: sql`EXCLUDED.name`,
        mimeType: sql`EXCLUDED.mime_type`,
        size: sql`EXCLUDED.size`,
        hasThumbnail: sql`EXCLUDED.has_thumbnail`,
        webViewLink: sql`EXCLUDED.web_view_link`,
        width: sql`EXCLUDED.width`,
        height: sql`EXCLUDED.height`,
        durationMs: sql`EXCLUDED.duration_ms`,
        modifiedAt: sql`EXCLUDED.modified_at`,
        trashed: sql`EXCLUDED.trashed`,
        version: sql`EXCLUDED.version`,
        ...(title?.trim() ? { title: title.trim() } : {}),
      },
    })
    .returning()

  if (!row) throw new AppError('UPSTREAM_ERROR', 'Could not index the uploaded file', 502)
  return { row, google }
}
