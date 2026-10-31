import { z } from 'zod'
import { eq } from 'drizzle-orm'
import { db } from '@/server/db'
import { links } from '@/server/db/schema'
import { withRoute } from '@/server/errors'
import { requireUser } from '@/server/guard'

const updateLinkSchema = z.object({
  expiresInDays: z.number().nullable().optional(),
})

export const PATCH = withRoute(async (req: Request, ctx: { params: Promise<{ slug: string }> }) => {
  await requireUser()
  const { slug } = await ctx.params
  
  const body = await req.json().catch(() => ({}))
  const data = updateLinkSchema.parse(body)

  const [link] = await db.select().from(links).where(eq(links.slug, slug)).limit(1)
  if (!link) throw new Error('NOT_FOUND')

  const updateData: Record<string, unknown> = {}
  if (data.expiresInDays !== undefined) {
    if (data.expiresInDays === null) {
      updateData.expiresAt = null
    } else {
      const expiresAt = new Date()
      expiresAt.setDate(expiresAt.getDate() + data.expiresInDays)
      updateData.expiresAt = expiresAt
    }
  }

  if (Object.keys(updateData).length > 0) {
    await db.update(links).set(updateData).where(eq(links.id, link.id))
  }

  return { success: true }
})

export const DELETE = withRoute(async (req: Request, ctx: { params: Promise<{ slug: string }> }) => {
  await requireUser()
  const { slug } = await ctx.params
  
  const [link] = await db.select().from(links).where(eq(links.slug, slug)).limit(1)
  if (!link) throw new Error('NOT_FOUND')

  await db.update(links).set({ revokedAt: new Date() }).where(eq(links.id, link.id))

  return { success: true }
})
