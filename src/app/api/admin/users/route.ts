import { NextResponse } from "next/server"
import { db } from "@/server/db"
import { users } from "@/server/db/schema"
import { requireUser } from "@/server/guard"
import { AppError, withRoute } from "@/server/errors"

export const GET = withRoute(async (req) => {
  const user = await requireUser()
  if (user.role !== "owner" && user.role !== "admin") {
    throw new AppError("FORBIDDEN", "Admin required", 403)
  }

  const allUsers = await db.select().from(users).orderBy(users.createdAt)
  return allUsers
})
