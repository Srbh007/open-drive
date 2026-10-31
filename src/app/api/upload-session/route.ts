import { z } from 'zod'
import { and, eq } from 'drizzle-orm'
import { db } from '@/server/db'
import { driveAccounts, files } from '@/server/db/schema'
import { AppError, withRoute } from '@/server/errors'
import { requireUser, requireDriveAccess } from '@/server/guard'
import { createResumableSession } from '@/server/google/upload'
import { getAccessToken } from '@/server/google/tokens'
import { parseUploadInput } from '@/server/upload-rules'

const targetSchema = z.object({
  driveAccountId: z.string().uuid(),
  folderId: z.string().uuid().optional(),
  replaceFileId: z.string().uuid().optional(),
})

export const POST = withRoute(async (req: Request) => {
  const user = await requireUser()
  const body: unknown = await req.json().catch(() => ({}))

  const target = targetSchema.safeParse(body)
  if (!target.success) throw new AppError('VALIDATION', 'Invalid upload target', 400)
  const { driveAccountId, folderId, replaceFileId } = target.data

  await requireDriveAccess(user, driveAccountId, true)
  const input = await parseUploadInput(body, false)

  const [drive] = await db.select().from(driveAccounts).where(eq(driveAccounts.id, driveAccountId)).limit(1)
  if (!drive) throw new AppError('NOT_FOUND', 'Drive not found', 404)
  if (drive.status !== 'active') throw new AppError('CONFLICT', 'This Drive needs to be reconnected', 409)
  if (drive.quotaTotal !== null && drive.quotaUsed + input.size > drive.quotaTotal) {
    throw new AppError('CONFLICT', 'Not enough free space in this Drive', 409)
  }

  // Resolve our ids to Google ids on the server; the browser never sends Google ids.
  let parentProviderId = drive.rootFolderId
  if (folderId) {
    const [folder] = await db
      .select()
      .from(files)
      .where(and(eq(files.id, folderId), eq(files.driveAccountId, driveAccountId), eq(files.isFolder, true), eq(files.trashed, false)))
      .limit(1)
    if (!folder) throw new AppError('NOT_FOUND', 'Folder not found in this Drive', 404)
    parentProviderId = folder.providerFileId
  }

  let replaceProviderId: string | undefined
  if (replaceFileId) {
    const [existing] = await db
      .select()
      .from(files)
      .where(and(eq(files.id, replaceFileId), eq(files.driveAccountId, driveAccountId), eq(files.isFolder, false), eq(files.trashed, false)))
      .limit(1)
    if (!existing) throw new AppError('NOT_FOUND', 'File not found in this Drive', 404)
    replaceProviderId = existing.providerFileId
  }

  const sessionUrl = await createResumableSession({
    accessToken: await getAccessToken(driveAccountId),
    name: input.name,
    mimeType: input.mimeType,
    size: input.size,
    parentId: parentProviderId,
    replaceFileId: replaceProviderId,
  })

  return { sessionUrl }
})
