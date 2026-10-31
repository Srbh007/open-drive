import { z } from 'zod'
import { eq } from 'drizzle-orm'
import { db } from '@/server/db'
import { files, settings } from '@/server/db/schema'
import { withRoute } from '@/server/errors'
import { requireUser, requireDriveAccess } from '@/server/guard'
import { getOrCreateLink, LinkKind } from '@/server/links'

const uploadCompleteSchema = z.object({
  driveAccountId: z.string().uuid(),
  providerFileId: z.string(),
  parentProviderId: z.string(),
  name: z.string(),
  mimeType: z.string(),
  size: z.number(),
  title: z.string().optional(),
})

export const POST = withRoute(async (req) => {
  const user = await requireUser()
  const body = await req.json().catch(() => ({}))
  const data = uploadCompleteSchema.parse(body)

  await requireDriveAccess(user, data.driveAccountId, true)

  const [existing] = await db
    .select()
    .from(files)
    .where(eq(files.providerFileId, data.providerFileId))
    .limit(1)

  let fileId = existing?.id
  const hasThumbnail = data.mimeType.startsWith('image/') || data.mimeType.startsWith('video/')

  if (!existing) {
    const [inserted] = await db.insert(files).values({
      driveAccountId: data.driveAccountId,
      providerFileId: data.providerFileId,
      parentProviderId: data.parentProviderId,
      name: data.name,
      title: data.title || null,
      mimeType: data.mimeType,
      isFolder: false,
      size: data.size,
      hasThumbnail,
    }).returning()
    fileId = inserted.id
  } else {
    await db.update(files).set({
      name: data.name,
      title: data.title || existing.title,
      size: data.size,
    }).where(eq(files.id, existing.id))
  }

  const [setting] = await db.select().from(settings).where(eq(settings.key, 'copy_link_default')).limit(1)
  const defaultKind: LinkKind = (setting?.value as LinkKind) || 'edit'
  
  const linkSlug = await getOrCreateLink(fileId!, defaultKind, user.id)
  
  let imageLinkSlug = null
  if (data.mimeType.startsWith('image/')) {
    imageLinkSlug = await getOrCreateLink(fileId!, 'image', user.id)
  }

  const [finalFile] = await db.select().from(files).where(eq(files.id, fileId!)).limit(1)

  return { file: finalFile, linkSlug, imageLinkSlug, defaultKind }
})
