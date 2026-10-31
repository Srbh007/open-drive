import 'server-only';
import { db } from '@/server/db';
import { files, annotations } from '@/server/db/schema';
import { requireUser } from '@/server/guard';
import { withRoute } from '@/server/errors';
import { and, eq, inArray, desc } from 'drizzle-orm';
import { toFileItem } from '@/server/file-dto';
import { getAccessibleDriveIds } from '@/server/access';

export const GET = withRoute(async () => {
  const user = await requireUser();

  const accessibleDriveIds = await getAccessibleDriveIds(user);

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

  const parentProviderIds = rows.map(r => r.file.parentProviderId).filter(Boolean) as string[];
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

  return rows.map(r => {
     const parentId = r.file.parentProviderId ? (parentMap.get(r.file.parentProviderId) || null) : null;
     return toFileItem(r.file, parentId);
  });
});
