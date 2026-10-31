import { z } from 'zod'
import { eq } from 'drizzle-orm'
import { db } from '@/server/db'
import { links } from '@/server/db/schema'
import { AppError, withRoute } from '@/server/errors'
import { requireUser, type CurrentUser } from '@/server/guard'
import { writeAudit } from '@/server/audit'

const updateLinkSchema = z.object({
  expiresInDays: z.number().int().min(1).max(365).nullable().optional(),
})

/** Only the link's creator, an admin or the owner may change or revoke a link. */
async function getManageableLink(user: CurrentUser, slug: string) {
  if (!/^[A-Za-z0-9_-]{21}$/.test(slug)) throw new AppError('NOT_FOUND', 'Link not found', 404)
  const [link] = await db.select().from(links).where(eq(links.slug, slug)).limit(1)
  if (!link) throw new AppError('NOT_FOUND', 'Link not found', 404)
  const isManager = user.role === 'owner' || user.role === 'admin'
  if (!isManager && link.createdBy !== user.id) throw new AppError('FORBIDDEN', 'You can only change your own links', 403)
  return link
}

export const PATCH = withRoute(async (req: Request, ctx: { params: Promise<{ slug: string }> }) => {
  const user = await requireUser()
  const { slug } = await ctx.params
  const link = await getManageableLink(user, slug)

  const parsed = updateLinkSchema.safeParse(await req.json().catch(() => ({})))
  if (!parsed.success) throw new AppError('VALIDATION', 'Invalid input', 400)

  if (parsed.data.expiresInDays !== undefined) {
    const days = parsed.data.expiresInDays
    const expiresAt = days === null ? null : new Date(Date.now() + days * 24 * 60 * 60 * 1000)
    await db.update(links).set({ expiresAt }).where(eq(links.id, link.id))
  }

  return { success: true }
})

export const DELETE = withRoute(async (_req: Request, ctx: { params: Promise<{ slug: string }> }) => {
  const user = await requireUser()
  const { slug } = await ctx.params
  const link = await getManageableLink(user, slug)

  await db.update(links).set({ revokedAt: new Date() }).where(eq(links.id, link.id))
  await writeAudit('link.revoke', link.fileId, user.id, slug)

  return { success: true }
})
