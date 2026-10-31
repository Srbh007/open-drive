import 'server-only'
import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '@/server/db'
import { settings } from '@/server/db/schema'
import { AppError } from '@/server/errors'

export const DEFAULT_MAX_UPLOAD_BYTES = 5 * 1024 * 1024 * 1024 // 5 GB

// Executable and script types are refused on public edit-link uploads (docs/RULES.md §5).
export const BLOCKED_EXTENSIONS = ['exe', 'bat', 'cmd', 'msi', 'scr', 'ps1', 'sh', 'com', 'vbs', 'js'] as const

export const FileNameSchema = z
  .string()
  .trim()
  .min(1)
  .max(255)
  .refine((name) => !/[\\/]/.test(name), 'File name must not contain path separators')

export const UploadInputSchema = z.object({
  name: FileNameSchema,
  mimeType: z.string().trim().max(255).default('application/octet-stream'),
  size: z.number().int().positive(),
})

export type UploadInput = z.infer<typeof UploadInputSchema>

export function hasBlockedExtension(name: string): boolean {
  const dot = name.lastIndexOf('.')
  if (dot === -1) return false
  const ext = name.slice(dot + 1).toLowerCase()
  return (BLOCKED_EXTENSIONS as readonly string[]).includes(ext)
}

export async function getMaxUploadBytes(): Promise<number> {
  const [row] = await db.select().from(settings).where(eq(settings.key, 'upload_max_bytes')).limit(1)
  const parsed = row ? Number(row.value) : NaN
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_MAX_UPLOAD_BYTES
}

/** Parses and checks an upload request body. `publicUpload` adds the executable-type block. */
export async function parseUploadInput(body: unknown, publicUpload: boolean): Promise<UploadInput> {
  const parsed = UploadInputSchema.safeParse(body)
  if (!parsed.success) throw new AppError('VALIDATION', 'Invalid file name, type or size', 400)

  const input = parsed.data
  if (publicUpload && hasBlockedExtension(input.name)) {
    throw new AppError('VALIDATION', 'This file type cannot be uploaded through a shared link', 400)
  }
  if (input.size > (await getMaxUploadBytes())) {
    throw new AppError('VALIDATION', 'File is larger than the upload limit', 400)
  }
  return input
}
