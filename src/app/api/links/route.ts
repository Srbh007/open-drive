import { z } from 'zod'
import { eq } from 'drizzle-orm'
import { db } from '@/server/db'
import { settings, files, links } from '@/server/db/schema'
import { withRoute } from '@/server/errors'
import { requireUser, requireDriveAccess } from '@/server/guard'
import { getOrCreateLink, hashPassword, LinkKind } from '@/server/links'

const createLinkSchema = z.object({
  fileId: z.string().uuid(),
  kind: z.enum(['edit', 'view', 'image']).optional(),
  expiresInDays: z.number().optional(),
  password: z.string().optional(),
})

export const POST = withRoute(async (req) => {
  const user = await requireUser()
  const body = await req.json().catch(() => ({}))
  const data = createLinkSchema.parse(body)

  const [file] = await db.select().from(files).where(eq(files.id, data.fileId)).limit(1)
  if (!file) throw new Error('NOT_FOUND')

  await requireDriveAccess(user, file.driveAccountId)

  let kind: LinkKind = data.kind || 'edit'
  if (!data.kind) {
    const [setting] = await db.select().from(settings).where(eq(settings.key, 'copy_link_default')).limit(1)
    if (setting?.value === 'view') {
      kind = 'view'
    }
  }

  let expiresAt = null
  if (data.expiresInDays) {
    expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + data.expiresInDays)
  }

  let passwordHash = null
  if (data.password) {
    passwordHash = await hashPassword(data.password)
  }

  const slug = await getOrCreateLink(data.fileId, kind, user.id, expiresAt, passwordHash)

  return { slug, kind }
})

export const GET = withRoute(async (req) => {
  const user = await requireUser()
  const userLinks = await db.query.links.findMany({
    where: eq(links.createdBy, user.id),
    with: {
      file: {
        with: {
          driveAccount: true
        }
      }
    },
    orderBy: (links, { desc }) => [desc(links.createdAt)]
  })

  return userLinks.map((l: any) => ({
    id: l.id,
    slug: l.slug,
    kind: l.kind,
    fileId: l.fileId,
    fileName: l.file?.name || 'Unknown',
    views: l.views,
    expiresAt: l.expiresAt,
    createdAt: l.createdAt,
    driveColor: l.file?.driveAccount?.color || '#000000'
  }))
})
