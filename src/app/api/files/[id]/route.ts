import 'server-only'
import { z } from 'zod'
import { db } from '@/server/db'
import { files } from '@/server/db/schema'
import { eq } from 'drizzle-orm'
import { withRoute, AppError } from '@/server/errors'
import { requireUser, requireDriveAccess } from '@/server/guard'
import { fetchWithToken, COMMON_FIELDS } from '@/server/google/drive'

const PatchSchema = z.object({
  name: z.string().optional(),
  title: z.string().optional(),
  addParents: z.string().optional(),
  removeParents: z.string().optional(),
})

export const GET = withRoute(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params
  const user = await requireUser()

  const file = await db.query.files.findFirst({
    where: eq(files.id, id)
  })

  if (!file) throw new AppError('NOT_FOUND', 'File not found', 404)

  await requireDriveAccess(user, file.driveAccountId, false)

  return file
})

export const PATCH = withRoute(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params
  const user = await requireUser()

  const file = await db.query.files.findFirst({
    where: eq(files.id, id)
  })

  if (!file) throw new AppError('NOT_FOUND', 'File not found', 404)

  await requireDriveAccess(user, file.driveAccountId, true)

  const body = await req.json()
  const parsed = PatchSchema.safeParse(body)
  if (!parsed.success) throw new AppError('VALIDATION', 'Invalid body', 400)

  const { name, title, addParents, removeParents } = parsed.data

  if (title !== undefined) {
    await db.update(files).set({ title }).where(eq(files.id, id))
  }

  if (name || addParents || removeParents) {
    const url = new URL(`https://www.googleapis.com/drive/v3/files/${file.providerFileId}`)
    url.searchParams.set('fields', COMMON_FIELDS)
    if (addParents) url.searchParams.set('addParents', addParents)
    if (removeParents) url.searchParams.set('removeParents', removeParents)

    const res = await fetchWithToken(file.driveAccountId, url.toString(), {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(name ? { name } : {})
    })

    if (!res.ok) {
      throw new AppError('UPSTREAM_ERROR', `Google Drive API error: ${res.statusText}`, res.status)
    }

    const updated = await res.json()
    await db.update(files).set({
      name: updated.name,
      parentProviderId: updated.parents?.[0] || null,
      modifiedAt: updated.modifiedTime ? new Date(updated.modifiedTime) : new Date(),
      version: updated.modifiedTime,
    }).where(eq(files.id, id))
  }

  return { success: true }
})

export const DELETE = withRoute(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params
  const user = await requireUser()

  const file = await db.query.files.findFirst({
    where: eq(files.id, id)
  })

  if (!file) throw new AppError('NOT_FOUND', 'File not found', 404)

  await requireDriveAccess(user, file.driveAccountId, true)

  const url = new URL(`https://www.googleapis.com/drive/v3/files/${file.providerFileId}`)
  const res = await fetchWithToken(file.driveAccountId, url.toString(), {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ trashed: true })
  })

  if (!res.ok) {
    throw new AppError('UPSTREAM_ERROR', `Google Drive API error: ${res.statusText}`, res.status)
  }

  await db.update(files).set({ trashed: true }).where(eq(files.id, id))

  return { success: true }
})
