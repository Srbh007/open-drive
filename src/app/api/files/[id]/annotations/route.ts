import 'server-only';
import { db } from '@/server/db';
import { annotations } from '@/server/db/schema';
import { requireUser } from '@/server/guard';
import { withRoute, AppError } from '@/server/errors';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { getFileForUser } from '@/server/files';
import { writeAudit } from '@/server/audit';

const putSchema = z.object({
  caption: z.string().max(500).optional().nullable(),
  description: z.string().max(5000).optional().nullable(),
  tags: z.array(z.string().trim().toLowerCase().max(40)).max(20).optional(),
  favorite: z.boolean().optional(),
});

const idSchema = z.string().uuid();

export const GET = withRoute(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const parsedId = idSchema.safeParse(id);
  if (!parsedId.success) throw new AppError('VALIDATION', 'Invalid ID', 400);

  const user = await requireUser();
  await getFileForUser(user, parsedId.data, false);

  const [ann] = await db.select().from(annotations).where(eq(annotations.fileId, parsedId.data)).limit(1);
  return ann || { caption: null, description: null, tags: [], favorite: false };
});

export const PUT = withRoute(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const parsedId = idSchema.safeParse(id);
  if (!parsedId.success) throw new AppError('VALIDATION', 'Invalid ID', 400);

  const user = await requireUser();
  await getFileForUser(user, parsedId.data, true);

  const body = await req.json().catch(() => ({}));
  const parsed = putSchema.safeParse(body);
  if (!parsed.success) {
    throw new AppError('VALIDATION', 'Invalid input', 400);
  }

  const { caption, description, tags, favorite } = parsed.data;

  const [ann] = await db.insert(annotations).values({
    fileId: parsedId.data,
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

  await writeAudit('file.annotate', parsedId.data, user.id);

  return ann;
});
