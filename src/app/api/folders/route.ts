import 'server-only'
import { z } from 'zod'
import { db } from '@/server/db'
import { files, driveAccounts } from '@/server/db/schema'
import { eq, and, desc, asc, isNull } from 'drizzle-orm'
import { withRoute, AppError } from '@/server/errors'
import { requireUser, requireDriveAccess } from '@/server/guard'

const QuerySchema = z.object({
  drive: z.string().uuid(),
  parent: z.string().optional(),
  sortKey: z.enum(['name', 'modifiedAt', 'size']).default('name'),
  sortDesc: z.enum(['true', 'false']).default('false'),
  limit: z.coerce.number().min(1).max(1000).default(1000),
  offset: z.coerce.number().min(0).default(0),
})

export const GET = withRoute(async (req: Request) => {
  const user = await requireUser()
  const url = new URL(req.url)
  const parsed = QuerySchema.safeParse(Object.fromEntries(url.searchParams))

  if (!parsed.success) {
    throw new AppError('VALIDATION', 'Invalid query parameters', 400)
  }

  const { drive: driveAccountId, parent, sortKey, sortDesc, limit, offset } = parsed.data
  await requireDriveAccess(user, driveAccountId, false)

  let parentId = parent

  if (!parentId) {
    const drive = await db.query.driveAccounts.findFirst({
      where: eq(driveAccounts.id, driveAccountId)
    })
    if (!drive) throw new AppError('NOT_FOUND', 'Drive not found', 404)
    parentId = drive.rootFolderId
  }

  const isDesc = sortDesc === 'true'
  const orderByFields = [desc(files.isFolder)]

  if (sortKey === 'name') {
    orderByFields.push(isDesc ? desc(files.name) : asc(files.name))
  } else if (sortKey === 'modifiedAt') {
    orderByFields.push(isDesc ? desc(files.modifiedAt) : asc(files.modifiedAt))
  } else if (sortKey === 'size') {
    orderByFields.push(isDesc ? desc(files.size) : asc(files.size))
  }

  const children = await db.query.files.findMany({
    where: and(
      eq(files.driveAccountId, driveAccountId),
      parentId === 'root' ? isNull(files.parentProviderId) : eq(files.parentProviderId, parentId),
      eq(files.trashed, false)
    ),
    orderBy: orderByFields,
    limit,
    offset
  })

  return children
})
