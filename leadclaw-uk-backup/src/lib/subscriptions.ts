import { createAdminClient } from '@/lib/supabase/admin'

function toIso(ts?: number | null) {
  if (!ts) return null
  return new Date(ts * 1000).toISOString()
}

export async function upsertStripeSubscription(input: {
  userId?: string | null
  email?: string | null
  customerId?: string | null
  subscriptionId: string
  priceId?: string | null
  plan?: string | null
  status?: string | null
  trialEnd?: number | null
  currentPeriodEnd?: number | null
  cancelAtPeriodEnd?: boolean
}) {
  const admin = createAdminClient()
  if (!admin) return { ok: false, reason: 'supabase_not_configured' as const }

  const row = {
    user_id: input.userId || null,
    email: input.email || null,
    stripe_customer_id: input.customerId || null,
    stripe_subscription_id: input.subscriptionId,
    stripe_price_id: input.priceId || null,
    plan: input.plan || null,
    status: input.status || null,
    trial_end: toIso(input.trialEnd),
    current_period_end: toIso(input.currentPeriodEnd),
    cancel_at_period_end: Boolean(input.cancelAtPeriodEnd),
    updated_at: new Date().toISOString(),
  }

  const { error } = await admin
    .from('subscriptions')
    .upsert(row, { onConflict: 'stripe_subscription_id' })

  if (error) return { ok: false, reason: error.message as string }
  return { ok: true as const }
}
