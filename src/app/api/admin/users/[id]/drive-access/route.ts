import { NextResponse } from "next/server"
import { db } from "@/server/db"
import { userDriveAccess, driveAccounts } from "@/server/db/schema"
import { requireUser } from "@/server/guard"
import { AppError } from "@/server/errors"
import { writeAudit } from "@/server/audit"
import { eq } from "drizzle-orm"
import { z } from "zod"
import { log } from "@/server/log"

const idSchema = z.string().uuid()

const accessListSchema = z.array(z.object({
  driveAccountId: z.string().uuid(),
  canSee: z.boolean(),
  canEdit: z.boolean(),
}))

export const GET = async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  try {
    const { id } = await ctx.params
    const parsedId = idSchema.parse(id)
    const user = await requireUser()

    if (user.role !== "owner" && user.role !== "admin") {
      throw new AppError("FORBIDDEN", "Admin required", 403)
    }

    const drives = await db.select({
      id: driveAccounts.id,
      label: driveAccounts.label,
      email: driveAccounts.email,
    }).from(driveAccounts)

    const access = await db.select().from(userDriveAccess).where(eq(userDriveAccess.userId, parsedId))

    const mapped = drives.map(d => {
      const a = access.find(acc => acc.driveAccountId === d.id)
      return {
        driveAccountId: d.id,
        label: d.label,
        email: d.email,
        canSee: !!a,
        canEdit: a?.canEdit || false,
      }
    })

    return NextResponse.json({ ok: true, data: mapped })
  } catch (error) {
    if (error instanceof AppError) {
      log.error(`AppError: ${error.code} - ${error.message}`)
      return NextResponse.json({ ok: false, error: { code: error.code, message: error.message } }, { status: error.status })
    }
    return NextResponse.json({ ok: false, error: { code: 'UPSTREAM_ERROR', message: 'Internal Server Error' } }, { status: 500 })
  }
}

export const PUT = async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  try {
    const { id } = await ctx.params
    const parsedId = idSchema.parse(id)
    const user = await requireUser()

    if (user.role !== "owner" && user.role !== "admin") {
      throw new AppError("FORBIDDEN", "Admin required", 403)
    }

    const body = await req.json()
    const accesses = accessListSchema.parse(body)

    await db.transaction(async (tx) => {
      await tx.delete(userDriveAccess).where(eq(userDriveAccess.userId, parsedId))

      const insertData = accesses
        .filter(a => a.canSee)
        .map(a => ({
          userId: parsedId,
          driveAccountId: a.driveAccountId,
          canEdit: a.canEdit
        }))

      if (insertData.length > 0) {
        await tx.insert(userDriveAccess).values(insertData)
      }
    })

    await writeAudit("user.drive_access", parsedId, user.id)

    return NextResponse.json({ ok: true, data: null })
  } catch (error) {
    if (error instanceof AppError) {
      log.error(`AppError: ${error.code} - ${error.message}`)
      return NextResponse.json({ ok: false, error: { code: error.code, message: error.message } }, { status: error.status })
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json({ ok: false, error: { code: 'VALIDATION', message: 'Invalid input' } }, { status: 400 })
    }
    return NextResponse.json({ ok: false, error: { code: 'UPSTREAM_ERROR', message: 'Internal Server Error' } }, { status: 500 })
  }
}
