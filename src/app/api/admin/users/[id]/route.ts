import { NextResponse } from "next/server"
import { db } from "@/server/db"
import { users } from "@/server/db/schema"
import { requireUser } from "@/server/guard"
import { AppError } from "@/server/errors"
import { writeAudit } from "@/server/audit"
import { eq } from "drizzle-orm"
import { z } from "zod"
import { log } from "@/server/log"

const updateSchema = z.object({
  status: z.enum(["pending", "approved", "suspended"]).optional(),
  role: z.enum(["viewer", "editor", "admin"]).optional(), // No "owner" allowed via API
})

const idSchema = z.string().uuid()

export const PATCH = async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  try {
    const { id } = await ctx.params
    const parsedId = idSchema.parse(id)
    const user = await requireUser()

    if (user.role !== "owner" && user.role !== "admin") {
      throw new AppError("FORBIDDEN", "Admin required", 403)
    }

    const body = await req.json()
    const data = updateSchema.parse(body)

    if (user.id === parsedId && (data.role || data.status)) {
      throw new AppError("FORBIDDEN", "Cannot modify own role or status", 403)
    }

    const [targetUser] = await db.select().from(users).where(eq(users.id, parsedId)).limit(1)
    if (!targetUser) throw new AppError("NOT_FOUND", "User not found", 404)

    if (targetUser.role === "owner" && (data.role || data.status)) {
      throw new AppError("FORBIDDEN", "Cannot modify owner", 403)
    }

    if (targetUser.role === "admin" && user.role !== "owner" && (data.role || data.status)) {
      throw new AppError("FORBIDDEN", "Only owner can modify admin", 403)
    }

    const updates: Partial<typeof users.$inferInsert> = {}
    if (data.status) {
      updates.status = data.status
      if (data.status === "approved" && targetUser.status !== "approved") {
        updates.approvedBy = user.id
        updates.approvedAt = new Date()
      }
    }
    if (data.role) {
      updates.role = data.role
    }

    if (Object.keys(updates).length > 0) {
      await db.update(users).set(updates).where(eq(users.id, parsedId))
      await writeAudit("user.update", parsedId, user.id)
    }

    const [updatedUser] = await db.select().from(users).where(eq(users.id, parsedId)).limit(1)
    return NextResponse.json({ ok: true, data: updatedUser })
  } catch (error) {
    if (error instanceof AppError) {
      log.error(`AppError: ${error.code} - ${error.message}`);
      return NextResponse.json(
        { ok: false, error: { code: error.code, message: error.message } },
        { status: error.status }
      );
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json({ ok: false, error: { code: 'VALIDATION', message: 'Invalid input' } }, { status: 400 })
    }

    log.error('Unhandled error', { error });
    return NextResponse.json(
      { ok: false, error: { code: 'UPSTREAM_ERROR', message: 'Internal Server Error' } },
      { status: 500 }
    );
  }
}
