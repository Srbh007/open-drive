import 'server-only'
import { db } from './db'
import { driveAccounts, files, syncState } from './db/schema'
import { eq, and, inArray, sql } from 'drizzle-orm'
import { log } from './log'
import { listScanFiles, getStartPageToken, listChanges, getDriveAbout, type GoogleFile } from './google/changes'

function parseGoogleFile(file: GoogleFile, driveAccountId: string) {
  return {
    driveAccountId,
    providerFileId: file.id,
    parentProviderId: file.parents?.[0] || null,
    name: file.name,
    title: null,
    mimeType: file.mimeType,
    isFolder: file.mimeType === 'application/vnd.google-apps.folder',
    size: parseInt(file.size || '0', 10),
    hasThumbnail: false,
    webViewLink: file.webViewLink || null,
    width: file.imageMediaMetadata?.width || null,
    height: file.imageMediaMetadata?.height || null,
    durationMs: file.videoMediaMetadata?.durationMillis ? parseInt(file.videoMediaMetadata.durationMillis, 10) : null,
    modifiedAt: file.modifiedTime ? new Date(file.modifiedTime) : new Date(),
    trashed: file.trashed || false,
    version: file.modifiedTime,
  }
}

export async function performInitialScan(driveAccountId: string, timeBudgetMs: number = 240000): Promise<void> {
  const startTime = Date.now()
  log.info(`Starting initial scan for drive: ${driveAccountId}`)

  let state = await db.query.syncState.findFirst({
    where: eq(syncState.driveAccountId, driveAccountId)
  })

  if (!state) {
    const [newState] = await db.insert(syncState).values({
      driveAccountId,
      status: 'initial',
    }).returning()
    state = newState
  }

  let pageToken = state.scanPageToken
  let hasMore = true

  try {
    while (hasMore) {
      if (Date.now() - startTime > timeBudgetMs) {
         log.info(`Time budget exceeded during initial scan for drive ${driveAccountId}, will resume next run.`)
         return
      }

      log.info(`Fetching files for drive ${driveAccountId}, pageToken: ${pageToken}`)
      const res = await listScanFiles(driveAccountId, pageToken)

      if (res.files.length > 0) {
        const fileValues = res.files.map(f => parseGoogleFile(f, driveAccountId))

        await db.insert(files).values(fileValues).onConflictDoUpdate({
          target: [files.driveAccountId, files.providerFileId],
          set: {
            parentProviderId: sql`EXCLUDED.parent_provider_id`,
            name: sql`EXCLUDED.name`,
            mimeType: sql`EXCLUDED.mime_type`,
            isFolder: sql`EXCLUDED.is_folder`,
            size: sql`EXCLUDED.size`,
            webViewLink: sql`EXCLUDED.web_view_link`,
            width: sql`EXCLUDED.width`,
            height: sql`EXCLUDED.height`,
            durationMs: sql`EXCLUDED.duration_ms`,
            modifiedAt: sql`EXCLUDED.modified_at`,
            trashed: sql`EXCLUDED.trashed`,
            version: sql`EXCLUDED.version`,
          }
        })
      }

      if (res.nextPageToken) {
        pageToken = res.nextPageToken
        await db.update(syncState)
          .set({ scanPageToken: pageToken, updatedAt: new Date() })
          .where(eq(syncState.driveAccountId, driveAccountId))
      } else {
        hasMore = false
      }
    }

    const startPageToken = await getStartPageToken(driveAccountId)
    await db.update(syncState)
      .set({
        scanPageToken: null,
        pageToken: startPageToken,
        status: 'synced',
        updatedAt: new Date(),
        error: null
      })
      .where(eq(syncState.driveAccountId, driveAccountId))

    log.info(`Initial scan complete for drive: ${driveAccountId}`)

  } catch (error: unknown) {
    log.error(`Initial scan failed for drive: ${driveAccountId}`, error)
    await db.update(syncState)
      .set({ error: (error as Error).message || 'Unknown error', updatedAt: new Date() })
      .where(eq(syncState.driveAccountId, driveAccountId))
    throw error
  }
}

export async function performIncrementalSync(driveAccountId: string, timeBudgetMs: number = 240000): Promise<void> {
  const startTime = Date.now()
  log.info(`Starting incremental sync for drive: ${driveAccountId}`)

  const state = await db.query.syncState.findFirst({
    where: eq(syncState.driveAccountId, driveAccountId)
  })

  if (!state || !state.pageToken) {
    log.info(`No page token found for incremental sync of drive ${driveAccountId}, falling back to initial scan.`)
    return performInitialScan(driveAccountId, timeBudgetMs)
  }

  let pageToken = state.pageToken
  let hasMore = true

  try {
    while (hasMore) {
      if (Date.now() - startTime > timeBudgetMs) {
        log.info(`Time budget exceeded during incremental sync for drive ${driveAccountId}, will resume next run.`)
        return
      }

      log.info(`Fetching changes for drive ${driveAccountId}, pageToken: ${pageToken}`)
      const res = await listChanges(driveAccountId, pageToken)

      const filesToUpsert: GoogleFile[] = []
      const fileIdsToRemove: string[] = []

      for (const change of res.changes) {
        if (change.type !== 'file') continue

        if (change.removed) {
          fileIdsToRemove.push(change.fileId)
        } else if (change.file) {
          filesToUpsert.push(change.file)
        }
      }

      if (filesToUpsert.length > 0) {
        const fileValues = filesToUpsert.map(f => parseGoogleFile(f, driveAccountId))
        await db.insert(files).values(fileValues).onConflictDoUpdate({
          target: [files.driveAccountId, files.providerFileId],
          set: {
            parentProviderId: sql`EXCLUDED.parent_provider_id`,
            name: sql`EXCLUDED.name`,
            mimeType: sql`EXCLUDED.mime_type`,
            isFolder: sql`EXCLUDED.is_folder`,
            size: sql`EXCLUDED.size`,
            webViewLink: sql`EXCLUDED.web_view_link`,
            width: sql`EXCLUDED.width`,
            height: sql`EXCLUDED.height`,
            durationMs: sql`EXCLUDED.duration_ms`,
            modifiedAt: sql`EXCLUDED.modified_at`,
            trashed: sql`EXCLUDED.trashed`,
            version: sql`EXCLUDED.version`,
          }
        })
      }

      if (fileIdsToRemove.length > 0) {
        await db.delete(files).where(
          and(
            eq(files.driveAccountId, driveAccountId),
            inArray(files.providerFileId, fileIdsToRemove)
          )
        )
      }

      if (res.nextPageToken) {
        pageToken = res.nextPageToken
        await db.update(syncState)
          .set({ pageToken, updatedAt: new Date() })
          .where(eq(syncState.driveAccountId, driveAccountId))
      } else if (res.newStartPageToken) {
        pageToken = res.newStartPageToken
        await db.update(syncState)
          .set({ pageToken, updatedAt: new Date() })
          .where(eq(syncState.driveAccountId, driveAccountId))
        hasMore = false
      } else {
        hasMore = false
      }
    }

    const about = await getDriveAbout(driveAccountId)
    if (about.storageQuota) {
      await db.update(driveAccounts)
        .set({
          quotaUsed: parseInt(about.storageQuota.usage, 10),
          quotaTotal: about.storageQuota.limit ? parseInt(about.storageQuota.limit, 10) : null,
          lastSyncedAt: new Date(),
        })
        .where(eq(driveAccounts.id, driveAccountId))
    }

    await db.update(syncState)
      .set({ status: 'synced', error: null, updatedAt: new Date() })
      .where(eq(syncState.driveAccountId, driveAccountId))

    log.info(`Incremental sync complete for drive: ${driveAccountId}`)

  } catch (error: unknown) {
    log.error(`Incremental sync failed for drive: ${driveAccountId}`, error)
    await db.update(syncState)
      .set({ error: (error as Error).message || 'Unknown error', updatedAt: new Date() })
      .where(eq(syncState.driveAccountId, driveAccountId))
    throw error
  }
}
