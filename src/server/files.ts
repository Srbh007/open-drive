import 'server-only'
import { eq, and } from 'drizzle-orm'
import { db } from '@/server/db'
import { files } from '@/server/db/schema'
import { AppError } from '@/server/errors'
import { requireDriveAccess, CurrentUser } from '@/server/guard'

export async function getFileForUser(user: CurrentUser, fileId: string, needEdit = false) {
  const [file] = await db
    .select()
    .from(files)
    .where(and(eq(files.id, fileId), eq(files.trashed, false)))
    .limit(1)

  if (!file) throw new AppError('NOT_FOUND', 'File not found', 404)

  await requireDriveAccess(user, file.driveAccountId, needEdit)
  return file
}
