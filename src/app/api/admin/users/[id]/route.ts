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
  role: z.enum(["viewer", "editor", "admin", "owner"]).optional(),
})

export const PATCH = async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  try {
    const { id } = await ctx.params
    const user = await requireUser()

    if (user.role !== "owner" && user.role !== "admin") {
      throw new AppError("FORBIDDEN", "Admin required", 403)
    }

    const body = await req.json()
    const data = updateSchema.parse(body)

    const [targetUser] = await db.select().from(users).where(eq(users.id, id)).limit(1)
    if (!targetUser) throw new AppError("NOT_FOUND", "User not found", 404)

    if (targetUser.role === "owner" && (data.role || data.status)) {
      throw new AppError("FORBIDDEN", "Cannot modify owner", 403)
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
      await db.update(users).set(updates).where(eq(users.id, id))
      await writeAudit("user.update", id, user.id)
    }

    const [updatedUser] = await db.select().from(users).where(eq(users.id, id)).limit(1)
    return NextResponse.json({ ok: true, data: updatedUser })
  } catch (error) {
    if (error instanceof AppError) {
      log.error(`AppError: ${error.code} - ${error.message}`);
      return NextResponse.json(
        { ok: false, error: { code: error.code, message: error.message } },
        { status: error.status }
      );
    }

    log.error('Unhandled error', { error });
    return NextResponse.json(
      { ok: false, error: { code: 'UPSTREAM_ERROR', message: 'Internal Server Error' } },
      { status: 500 }
    );
  }
}
