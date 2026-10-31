import 'server-only'
import { z } from 'zod'
import { db } from '@/server/db'
import { files, userDriveAccess, driveAccounts } from '@/server/db/schema'
import { and, eq, sql, inArray } from 'drizzle-orm'
import { withRoute, AppError } from '@/server/errors'
import { requireUser, requireDriveAccess } from '@/server/guard'
import { toFileItem } from '@/server/file-dto'

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

  let allowedDriveIds: string[] = []

  if (drive) {
    await requireDriveAccess(user, drive, false)
    allowedDriveIds = [drive]
  } else {
    if (user.role === 'owner' || user.role === 'admin') {
      const drives = await db.query.driveAccounts.findMany({
        where: eq(driveAccounts.status, 'active')
      })
      allowedDriveIds = drives.map(d => d.id)
    } else {
      const accesses = await db.query.userDriveAccess.findMany({
        where: eq(userDriveAccess.userId, user.id)
      })
      allowedDriveIds = accesses.map(a => a.driveAccountId)
    }
  }

  if (allowedDriveIds.length === 0) {
    return []
  }

  const escapedQ = q.replace(/[%_]/g, '\\$&')

  const conditions = [
    eq(files.trashed, false),
    inArray(files.driveAccountId, allowedDriveIds),
    sql`lower(coalesce(title, name)) LIKE ${`%${escapedQ.toLowerCase()}%`}`
  ]

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

  // To perfectly map parentId to our internal UUID requires an extra query/join,
  // but for search results, returning null or resolving via a separate lookup is required.
  // The PRD implies omitting parent resolution or joining `parentProviderId` to `files.providerFileId`.
  // For now, we will do a separate lookup to map `parentProviderId` to `id`.

  const parentProviderIds = Array.from(new Set(results.map(f => f.parentProviderId).filter(Boolean))) as string[]
  const parentMap = new Map<string, string>()

  if (parentProviderIds.length > 0) {
    const parents = await db.query.files.findMany({
      where: inArray(files.providerFileId, parentProviderIds),
      columns: { id: true, providerFileId: true }
    })
    parents.forEach(p => parentMap.set(p.providerFileId, p.id))
  }

  return results.map(row => {
    const parentId = row.parentProviderId ? (parentMap.get(row.parentProviderId) || null) : null
    return toFileItem(row, parentId)
  })
})
