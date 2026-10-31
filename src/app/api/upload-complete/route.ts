import { z } from 'zod'
import { eq } from 'drizzle-orm'
import { db } from '@/server/db'
import { settings } from '@/server/db/schema'
import { AppError, withRoute } from '@/server/errors'
import { requireUser, requireDriveAccess } from '@/server/guard'
import { getOrCreateLink, type LinkKind } from '@/server/links'
import { indexDriveFile } from '@/server/file-index'
import { toFileItem } from '@/server/file-dto'
import { writeAudit } from '@/server/audit'

// providerFileId is the id Google itself returned to the browser at the end of the upload;
// the server re-reads the file from Google instead of trusting any other field.
const completeSchema = z.object({
  driveAccountId: z.string().uuid(),
  providerFileId: z.string().regex(/^[A-Za-z0-9_-]{10,200}$/),
  title: z.string().trim().max(500).optional(),
})

export const POST = withRoute(async (req: Request) => {
  const user = await requireUser()
  const parsed = completeSchema.safeParse(await req.json().catch(() => ({})))
  if (!parsed.success) throw new AppError('VALIDATION', 'Invalid input', 400)
  const data = parsed.data

  await requireDriveAccess(user, data.driveAccountId, true)

  const { row } = await indexDriveFile(data.driveAccountId, data.providerFileId, data.title)
  await writeAudit('upload', row.id, user.id)

  const [setting] = await db.select().from(settings).where(eq(settings.key, 'copy_link_default')).limit(1)
  const defaultKind: LinkKind = setting?.value === 'view' ? 'view' : 'edit'

  const linkSlug = await getOrCreateLink(row.id, defaultKind, user.id)
  const imageLinkSlug = row.mimeType.startsWith('image/') ? await getOrCreateLink(row.id, 'image', user.id) : null

  return { file: toFileItem(row, null), linkSlug, imageLinkSlug, defaultKind }
})
