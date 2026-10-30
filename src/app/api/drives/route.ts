import { db } from "@/server/db"
import { driveAccounts, userDriveAccess } from "@/server/db/schema"
import { requireUser } from "@/server/guard"
import { withRoute } from "@/server/errors"
import { eq, inArray } from "drizzle-orm"

export const GET = withRoute(async () => {
  const user = await requireUser()

  if (user.role === "owner" || user.role === "admin") {
    const allDrives = await db.select().from(driveAccounts)
    return allDrives
  }

  const access = await db.select({ driveAccountId: userDriveAccess.driveAccountId }).from(userDriveAccess).where(eq(userDriveAccess.userId, user.id))
  const driveIds = access.map(a => a.driveAccountId)

  if (driveIds.length === 0) {
    return []
  }

  const allowedDrives = await db.select().from(driveAccounts).where(inArray(driveAccounts.id, driveIds))
  return allowedDrives
})
