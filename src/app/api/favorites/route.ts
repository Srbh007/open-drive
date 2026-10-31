import 'server-only';
import { db } from '@/server/db';
import { files, userDriveAccess, annotations } from '@/server/db/schema';
import { requireUser } from '@/server/guard';
import { withRoute } from '@/server/errors';
import { and, eq, inArray, desc } from 'drizzle-orm';
import { toFileItem } from '@/server/file-dto';

export const GET = withRoute(async () => {
  const user = await requireUser();

  const accessRows = await db
    .select({ driveAccountId: userDriveAccess.driveAccountId })
    .from(userDriveAccess)
    .where(eq(userDriveAccess.userId, user.id));

  const accessibleDriveIds = accessRows.map((row) => row.driveAccountId);

  if (accessibleDriveIds.length === 0) {
    return [];
  }

  const rows = await db
    .select({ file: files })
    .from(files)
    .innerJoin(annotations, eq(files.id, annotations.fileId))
    .where(
      and(
        inArray(files.driveAccountId, accessibleDriveIds),
        eq(files.trashed, false),
        eq(annotations.favorite, true)
      )
    )
    .orderBy(desc(files.modifiedAt));

  return rows.map(r => toFileItem(r.file, r.file.parentProviderId || null));
});
