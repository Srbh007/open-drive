import 'server-only';
import { db } from '@/server/db';
import { annotations, files, userDriveAccess } from '@/server/db/schema';
import { requireUser } from '@/server/guard';
import { withRoute } from '@/server/errors';
import { AppError } from '@/server/errors';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';

const putSchema = z.object({
  caption: z.string().max(500).optional().nullable(),
  description: z.string().max(5000).optional().nullable(),
  tags: z.array(z.string().trim().toLowerCase().max(40)).max(20).optional(),
  favorite: z.boolean().optional(),
});

async function getFileForUser(fileId: string, user: { id: string, role: string }, needEdit: boolean) {
  const [file] = await db.select().from(files).where(eq(files.id, fileId)).limit(1);
  if (!file) throw new AppError('NOT_FOUND', 'File not found', 404);

  if (user.role === 'owner' || user.role === 'admin') return file;

  const [access] = await db
    .select()
    .from(userDriveAccess)
    .where(and(eq(userDriveAccess.userId, user.id), eq(userDriveAccess.driveAccountId, file.driveAccountId)))
    .limit(1);

  if (!access) throw new AppError('FORBIDDEN', 'No access to this file', 403);
  if (needEdit && !access.canEdit) throw new AppError('FORBIDDEN', 'Edit rights required', 403);

  return file;
}

export const GET = withRoute(async (req, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const user = await requireUser();
  await getFileForUser(id, user, false);

  const [ann] = await db.select().from(annotations).where(eq(annotations.fileId, id)).limit(1);
  return ann || { caption: null, description: null, tags: [], favorite: false };
});

export const PUT = withRoute(async (req, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const user = await requireUser();
  await getFileForUser(id, user, true);

  const body = await req.json().catch(() => ({}));
  const parsed = putSchema.safeParse(body);
  if (!parsed.success) {
    throw new AppError('VALIDATION', 'Invalid input', 400);
  }

  const { caption, description, tags, favorite } = parsed.data;

  const [ann] = await db.insert(annotations).values({
    fileId: id,
    caption,
    description,
    tags: tags || [],
    favorite: favorite || false,
    updatedBy: user.id,
    updatedAt: new Date(),
  }).onConflictDoUpdate({
    target: annotations.fileId,
    set: {
      caption: caption !== undefined ? caption : undefined,
      description: description !== undefined ? description : undefined,
      tags: tags !== undefined ? tags : undefined,
      favorite: favorite !== undefined ? favorite : undefined,
      updatedBy: user.id,
      updatedAt: new Date(),
    }
  }).returning();

  return ann;
});
