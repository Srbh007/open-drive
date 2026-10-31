import { NextResponse } from "next/server"
import { db } from "@/server/db"
import { driveAccounts } from "@/server/db/schema"
import { requireUser } from "@/server/guard"
import { AppError } from "@/server/errors"
import { writeAudit } from "@/server/audit"
import { eq } from "drizzle-orm"
import { z } from "zod"
import { log } from "@/server/log"
import { decrypt } from "@/server/crypto"
import { revokeToken } from "@/server/google/oauth"

const idSchema = z.string().uuid()

const patchSchema = z.object({
  label: z.string().min(1),
})

export const PATCH = async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  try {
    const { id } = await ctx.params
    const parsedId = idSchema.parse(id)
    const user = await requireUser()

    if (user.role !== "owner" && user.role !== "admin") {
      throw new AppError("FORBIDDEN", "Admin required", 403)
    }

    const body = await req.json()
    const data = patchSchema.parse(body)

    const [account] = await db.select().from(driveAccounts).where(eq(driveAccounts.id, parsedId)).limit(1)
    if (!account) throw new AppError("NOT_FOUND", "Drive not found", 404)

    await db.update(driveAccounts).set({ label: data.label }).where(eq(driveAccounts.id, parsedId))

    return NextResponse.json({ ok: true, data: null })
  } catch (error) {
    if (error instanceof AppError) {
      return NextResponse.json({ ok: false, error: { code: error.code, message: error.message } }, { status: error.status })
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json({ ok: false, error: { code: 'VALIDATION', message: 'Invalid input' } }, { status: 400 })
    }
    return NextResponse.json({ ok: false, error: { code: 'UPSTREAM_ERROR', message: 'Internal Server Error' } }, { status: 500 })
  }
}

export const DELETE = async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  try {
    const { id } = await ctx.params
    const parsedId = idSchema.parse(id)
    const user = await requireUser()

    if (user.role !== "owner" && user.role !== "admin") {
      throw new AppError("FORBIDDEN", "Admin required", 403)
    }

    const [account] = await db.select().from(driveAccounts).where(eq(driveAccounts.id, parsedId)).limit(1)
    if (!account) throw new AppError("NOT_FOUND", "Drive not found", 404)

    try {
      const token = decrypt(account.refreshTokenEnc)
      await revokeToken(token)
    } catch (e) {
      log.warn("Failed to revoke token during drive deletion", { error: (e as Error).message })
    }

    await db.delete(driveAccounts).where(eq(driveAccounts.id, parsedId))
    await writeAudit("drive.disconnect", parsedId, user.id)

    return NextResponse.json({ ok: true, data: null })
  } catch (error) {
    if (error instanceof AppError) {
      return NextResponse.json({ ok: false, error: { code: error.code, message: error.message } }, { status: error.status })
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json({ ok: false, error: { code: 'VALIDATION', message: 'Invalid input' } }, { status: 400 })
    }
    return NextResponse.json({ ok: false, error: { code: 'UPSTREAM_ERROR', message: 'Internal Server Error' } }, { status: 500 })
  }
}
