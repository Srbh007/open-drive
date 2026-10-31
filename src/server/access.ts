import 'server-only';
import { db } from '@/server/db';
import { driveAccounts, userDriveAccess } from '@/server/db/schema';
import { eq } from 'drizzle-orm';
import { CurrentUser } from '@/server/guard';

export async function getAccessibleDriveIds(user: CurrentUser): Promise<string[]> {
  if (user.role === 'owner' || user.role === 'admin') {
    const allDrives = await db.select({ id: driveAccounts.id }).from(driveAccounts);
    return allDrives.map(d => d.id);
  }

  const accessRows = await db
    .select({ driveAccountId: userDriveAccess.driveAccountId })
    .from(userDriveAccess)
    .where(eq(userDriveAccess.userId, user.id));

  return accessRows.map(r => r.driveAccountId);
}
