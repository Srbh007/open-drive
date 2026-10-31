import { z } from 'zod'
import { eq } from 'drizzle-orm'
import { db } from '@/server/db'
import { driveAccounts } from '@/server/db/schema'
import { withRoute } from '@/server/errors'
import { requireUser, requireDriveAccess } from '@/server/guard'
import { createResumableSession } from '@/server/google/upload'
import { getAccessToken } from '@/server/google/tokens'

const uploadSessionSchema = z.object({
  driveAccountId: z.string().uuid(),
  parentId: z.string(),
  name: z.string(),
  mimeType: z.string(),
  size: z.number(),
  replaceFileId: z.string().optional(),
})

export const POST = withRoute(async (req) => {
  const user = await requireUser()
  const body = await req.json().catch(() => ({}))
  const data = uploadSessionSchema.parse(body)

  await requireDriveAccess(user, data.driveAccountId, true)

  const [drive] = await db.select().from(driveAccounts).where(eq(driveAccounts.id, data.driveAccountId)).limit(1)
  if (!drive) throw new Error('NOT_FOUND')

  const token = await getAccessToken(data.driveAccountId)
  const sessionUrl = await createResumableSession({
    accessToken: token,
    name: data.name,
    mimeType: data.mimeType,
    size: data.size,
    parentId: data.parentId,
    replaceFileId: data.replaceFileId,
  })

  return { sessionUrl }
})
