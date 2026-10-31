import 'server-only';
import { db } from '@/server/db';
import { driveAccounts, files, userDriveAccess, syncState } from '@/server/db/schema';
import { requireUser } from '@/server/guard';
import { withRoute } from '@/server/errors';
import { and, desc, eq, inArray, isNotNull } from 'drizzle-orm';
import { toFileItem } from '@/server/file-dto';

export const GET = withRoute(async (req) => {
  const user = await requireUser();

  const accessRows = await db
    .select({
      driveAccountId: userDriveAccess.driveAccountId,
    })
    .from(userDriveAccess)
    .where(eq(userDriveAccess.userId, user.id));

  const accessibleDriveIds = accessRows.map((row) => row.driveAccountId);

  if (accessibleDriveIds.length === 0) {
    return { drives: [], totalStorage: { used: 0, total: 0 }, recentFiles: [] };
  }

  const drives = await db
    .select({
      id: driveAccounts.id,
      label: driveAccounts.label,
      email: driveAccounts.email,
      color: driveAccounts.color,
      quotaUsed: driveAccounts.quotaUsed,
      quotaTotal: driveAccounts.quotaTotal,
      status: syncState.status,
      lastSyncedAt: driveAccounts.lastSyncedAt,
    })
    .from(driveAccounts)
    .leftJoin(syncState, eq(driveAccounts.id, syncState.driveAccountId))
    .where(inArray(driveAccounts.id, accessibleDriveIds));

  let totalUsed = 0;
  let totalTotal = 0;
  for (const drive of drives) {
    totalUsed += Number(drive.quotaUsed);
    if (drive.quotaTotal) {
      totalTotal += Number(drive.quotaTotal);
    }
  }

  const recentFilesRows = await db
    .select()
    .from(files)
    .where(
      and(
        inArray(files.driveAccountId, accessibleDriveIds),
        eq(files.isFolder, false),
        eq(files.trashed, false)
      )
    )
    .orderBy(desc(files.modifiedAt))
    .limit(12);

  const recentFiles = recentFilesRows.map((file) => toFileItem(file, file.parentProviderId || null));

  return {
    drives,
    totalStorage: { used: totalUsed, total: totalTotal },
    recentFiles,
  };
});
