import { z } from 'zod'
import { db } from '@/server/db'
import { settings } from '@/server/db/schema'
import { withRoute } from '@/server/errors'
import { requireUser } from '@/server/guard'

const updateSettingsSchema = z.object({
  copy_link_default: z.enum(['edit', 'view']).optional(),
  copy_link_expiry_days: z.number().nullable().optional(),
})

export const PATCH = withRoute(async (req) => {
  const user = await requireUser()
  const body = await req.json().catch(() => ({}))
  const data = updateSettingsSchema.parse(body)

  for (const [key, value] of Object.entries(data)) {
    if (value !== undefined) {
      await db.insert(settings)
        .values({ key, value: String(value), updatedBy: user.id })
        .onConflictDoUpdate({ target: settings.key, set: { value: String(value), updatedBy: user.id } })
    }
  }

  return { success: true }
})
