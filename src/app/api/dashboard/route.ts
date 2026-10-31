import 'server-only';
import { db } from '@/server/db';
import { driveAccounts, files, syncState } from '@/server/db/schema';
import { requireUser } from '@/server/guard';
import { withRoute } from '@/server/errors';
import { and, desc, eq, inArray } from 'drizzle-orm';
import { toFileItem } from '@/server/file-dto';
import { getAccessibleDriveIds } from '@/server/access';

export const GET = withRoute(async () => {
  const user = await requireUser();

  const accessibleDriveIds = await getAccessibleDriveIds(user);

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

  // Resolve parentProviderId to our UUID or pass null to avoid leaking google IDs
  const parentProviderIds = recentFilesRows.map(r => r.parentProviderId).filter(Boolean) as string[];
  const parentMap = new Map<string, string>();
  if (parentProviderIds.length > 0) {
     const parents = await db
       .select({ providerFileId: files.providerFileId, id: files.id })
       .from(files)
       .where(inArray(files.providerFileId, parentProviderIds));
     for (const p of parents) {
       parentMap.set(p.providerFileId, p.id);
     }
  }

  const recentFiles = recentFilesRows.map((file) => {
    const parentId = file.parentProviderId ? (parentMap.get(file.parentProviderId) || null) : null;
    return toFileItem(file, parentId);
  });

  return {
    drives,
    totalStorage: { used: totalUsed, total: totalTotal },
    recentFiles,
  };
});
