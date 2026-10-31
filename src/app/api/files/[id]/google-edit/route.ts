import { z } from 'zod'
import { AppError } from '@/server/errors'
import { requireUser } from '@/server/guard'
import { getFileForUser } from '@/server/files'
import { addGoogleEditPermission } from '@/server/google/permissions'
import { db } from '@/server/db'
import { auditLog } from '@/server/db/schema'

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }): Promise<Response> {
  try {
    const { id } = await ctx.params
    const fileId = z.string().uuid().parse(id)
    const user = await requireUser()

    const file = await getFileForUser(user, fileId, true)

    await addGoogleEditPermission(file.driveAccountId, file.providerFileId, user.email)

    await db.insert(auditLog).values({
      userId: user.id,
      action: 'file.google_edit',
      target: fileId,
      ip: req.headers.get('x-forwarded-for') || null,
    })

    return Response.json({ ok: true, data: { url: file.webViewLink } })

  } catch (err) {
    if (err instanceof AppError) return Response.json({ ok: false, error: { code: err.code, message: err.message } }, { status: err.status })
    if (err instanceof z.ZodError) return Response.json({ ok: false, error: { code: 'VALIDATION', message: 'Invalid file id' } }, { status: 400 })
    return Response.json({ ok: false, error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' } }, { status: 500 })
  }
}
