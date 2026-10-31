import 'server-only'
import { z } from 'zod'
import { db } from '@/server/db'
import { files } from '@/server/db/schema'
import { and, eq, sql } from 'drizzle-orm'
import { withRoute, AppError } from '@/server/errors'
import { requireUser, requireDriveAccess } from '@/server/guard'

const SearchQuerySchema = z.object({
  q: z.string().min(1),
  drive: z.string().uuid().optional(),
  type: z.string().optional(),
})

export const GET = withRoute(async (req: Request) => {
  const user = await requireUser()
  const url = new URL(req.url)
  const parsed = SearchQuerySchema.safeParse(Object.fromEntries(url.searchParams))

  if (!parsed.success) {
    throw new AppError('VALIDATION', 'Invalid query parameters', 400)
  }

  const { q, drive, type } = parsed.data

  if (drive) {
    await requireDriveAccess(user, drive, false)
  }

  const conditions = [
    eq(files.trashed, false),
    sql`lower(coalesce(title, name)) LIKE ${`%${q.toLowerCase()}%`}`
  ]

  if (drive) {
    conditions.push(eq(files.driveAccountId, drive))
  }

  if (type) {
    if (type === 'folder') {
      conditions.push(eq(files.isFolder, true))
    } else if (type === 'file') {
      conditions.push(eq(files.isFolder, false))
    } else {
      conditions.push(eq(files.mimeType, type))
    }
  }

  const results = await db.query.files.findMany({
    where: and(...conditions),
    limit: 100,
  })

  return results
})
