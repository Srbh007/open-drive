import { z } from 'zod'
import { desc, eq, sql } from 'drizzle-orm'
import { db } from '@/server/db'
import { settings, links, files, driveAccounts } from '@/server/db/schema'
import { AppError, withRoute } from '@/server/errors'
import { requireUser, requireDriveAccess } from '@/server/guard'
import { getFileForUser } from '@/server/files'
import { getOrCreateLink, hashPassword, type LinkKind } from '@/server/links'

const createLinkSchema = z.object({
  fileId: z.string().uuid(),
  kind: z.enum(['edit', 'view', 'image']).optional(),
  expiresInDays: z.number().int().min(1).max(365).optional(),
  password: z.string().min(8).max(128).optional(),
})

async function defaultLinkKind(): Promise<LinkKind> {
  const [setting] = await db.select().from(settings).where(eq(settings.key, 'copy_link_default')).limit(1)
  return setting?.value === 'view' ? 'view' : 'edit'
}

export const POST = withRoute(async (req: Request) => {
  const user = await requireUser()
  const parsed = createLinkSchema.safeParse(await req.json().catch(() => ({})))
  if (!parsed.success) throw new AppError('VALIDATION', 'Invalid input', 400)
  const data = parsed.data

  const file = await getFileForUser(user, data.fileId)

  let kind: LinkKind = data.kind ?? (await defaultLinkKind())
  if (kind === 'edit') {
    try {
      await requireDriveAccess(user, file.driveAccountId, true)
    } catch (err) {
      // An explicit edit request without edit rights is refused; the default quietly falls back to view.
      if (data.kind === 'edit' || !(err instanceof AppError) || err.status !== 403) throw err
      kind = 'view'
    }
  }

  if (kind === 'image' && (file.isFolder || !file.mimeType.startsWith('image/'))) {
    throw new AppError('VALIDATION', 'Image links are only for image files', 400)
  }

  const expiresAt = data.expiresInDays ? new Date(Date.now() + data.expiresInDays * 24 * 60 * 60 * 1000) : null
  const passwordHash = data.password ? await hashPassword(data.password) : null

  const slug = await getOrCreateLink(file.id, kind, user.id, expiresAt, passwordHash)
  return { slug, kind }
})

export const GET = withRoute(async () => {
  const user = await requireUser()

  return db
    .select({
      id: links.id,
      slug: links.slug,
      kind: links.kind,
      fileId: links.fileId,
      fileName: sql<string>`coalesce(${files.title}, ${files.name})`,
      views: links.views,
      expiresAt: links.expiresAt,
      revokedAt: links.revokedAt,
      createdAt: links.createdAt,
      driveColor: driveAccounts.color,
    })
    .from(links)
    .innerJoin(files, eq(links.fileId, files.id))
    .innerJoin(driveAccounts, eq(files.driveAccountId, driveAccounts.id))
    .where(eq(links.createdBy, user.id))
    .orderBy(desc(links.createdAt))
})
