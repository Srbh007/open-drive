import { z } from 'zod'
import { AppError } from '@/server/errors'
import { requireUser } from '@/server/guard'
import { getFileForUser } from '@/server/files'
import { addGoogleEditPermission } from '@/server/google/permissions'
import { getAccessToken } from '@/server/google/tokens'
import { db } from '@/server/db'
import { auditLog } from '@/server/db/schema'

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }): Promise<Response> {
  try {
    const { id } = await ctx.params
    const fileId = z.string().uuid().parse(id)
    const user = await requireUser()

    const file = await getFileForUser(user, fileId, true)

    await addGoogleEditPermission(file.driveAccountId, file.providerFileId, user.email)

    let url = file.webViewLink
    if (!url) {
      const token = await getAccessToken(file.driveAccountId)
      const res = await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(file.providerFileId)}?fields=webViewLink&supportsAllDrives=true`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      if (res.ok) {
        const data = await res.json()
        if (data.webViewLink) {
          url = data.webViewLink
        }
      }
    }

    if (!url) {
      return Response.json({ ok: false, error: { code: 'UPSTREAM_ERROR', message: 'webViewLink not found' } }, { status: 502 })
    }

    await db.insert(auditLog).values({
      userId: user.id,
      action: 'file.google_edit',
      target: fileId,
      ip: req.headers.get('x-forwarded-for') || null,
    })

    return Response.json({ ok: true, data: { url } })

  } catch (err) {
    if (err instanceof AppError) return Response.json({ ok: false, error: { code: err.code, message: err.message } }, { status: err.status })
    if (err instanceof z.ZodError) return Response.json({ ok: false, error: { code: 'VALIDATION', message: 'Invalid file id' } }, { status: 400 })
    return Response.json({ ok: false, error: { code: 'UPSTREAM_ERROR', message: 'An unexpected error occurred' } }, { status: 502 })
  }
}
