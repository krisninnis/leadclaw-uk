import { createAdminClient } from '@/lib/supabase/admin'
import { sendOpsAlert } from '@/lib/alerts'

export async function logSystemEvent(input: {
  level?: 'info' | 'warn' | 'error'
  category: string
  message: string
  meta?: Record<string, unknown>
}) {
  const admin = createAdminClient()
  if (!admin) return

  const level = input.level || 'info'

  await admin.from('system_events').insert({
    level,
    category: input.category,
    message: input.message,
    meta: input.meta || null,
  })

  if (level === 'warn' || level === 'error') {
    await sendOpsAlert({
      level,
      category: input.category,
      message: input.message,
      meta: input.meta,
    })
  }
}
