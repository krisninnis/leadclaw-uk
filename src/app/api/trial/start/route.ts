import { randomBytes } from 'crypto'
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { logSystemEvent } from '@/lib/ops'
import { AUTONOMOUS_TASK_ORDER, normalizeDomain } from '@/lib/onboarding'

export async function POST() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  if (!admin) return NextResponse.json({ ok: false, error: 'supabase_not_configured' }, { status: 400 })

  const email = (user.email || '').trim().toLowerCase()
  if (!email) return NextResponse.json({ ok: false, error: 'missing_email' }, { status: 400 })

  const now = new Date()
  const trialEnd = new Date(now)
  trialEnd.setDate(trialEnd.getDate() + 7)

  const trialSubscriptionId = `trial_${user.id}`

  const row = {
    user_id: user.id,
    email,
    stripe_customer_id: null,
    stripe_subscription_id: trialSubscriptionId,
    stripe_price_id: null,
    plan: 'starter',
    status: 'trialing',
    trial_end: trialEnd.toISOString(),
    current_period_end: null,
    cancel_at_period_end: true,
    updated_at: new Date().toISOString(),
  }

  const { error } = await admin.from('subscriptions').upsert(row, { onConflict: 'stripe_subscription_id' })
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })

  // Auto-provision onboarding package from latest application (signup-and-go)
  let siteId: string | null = null
  try {
    const { data: latestApp } = await admin
      .from('applications')
      .select('clinic_name,website,services,city')
      .eq('email', email)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    const website = String(latestApp?.website || '').trim()
    const domain = website ? normalizeDomain(website) : null
    const clinicName = String(latestApp?.clinic_name || 'Clinic Client').trim()

    const { data: existingClient } = await admin
      .from('onboarding_clients')
      .select('id')
      .eq('contact_email', email)
      .maybeSingle()

    let clientId = existingClient?.id as string | undefined
    if (!clientId) {
      const { data: insertedClient } = await admin
        .from('onboarding_clients')
        .insert({
          client_name: clinicName,
          business_name: clinicName,
          contact_email: email,
          status: 'intake_received',
        })
        .select('id')
        .single()
      clientId = insertedClient?.id as string | undefined
    }

    if (clientId && domain) {
      const { data: existingSite } = await admin
        .from('onboarding_sites')
        .select('id')
        .eq('onboarding_client_id', clientId)
        .eq('domain', domain)
        .maybeSingle()

      siteId = (existingSite?.id as string | undefined) || null

      if (!siteId) {
        const { data: insertedSite } = await admin
          .from('onboarding_sites')
          .insert({
            onboarding_client_id: clientId,
            domain,
            platform: 'custom',
            settings: {
              services: latestApp?.services ? String(latestApp.services).split(',').map((s) => s.trim()).filter(Boolean) : [],
              city: latestApp?.city || null,
              signup_mode: 'autonomous_trial',
            },
            status: 'pending_install',
          })
          .select('id')
          .single()

        siteId = insertedSite?.id as string | null

        if (siteId) {
          await admin.from('widget_tokens').insert({
            onboarding_site_id: siteId,
            token: randomBytes(24).toString('hex'),
            status: 'active',
          })

          await admin.from('onboarding_tasks').insert(
            AUTONOMOUS_TASK_ORDER.map((taskType, idx) => ({
              onboarding_site_id: siteId,
              task_type: taskType,
              status: 'queued',
              sequence: idx + 1,
            }))
          )
        }
      }
    }
  } catch (e) {
    await logSystemEvent({
      level: 'warn',
      category: 'onboarding',
      message: 'Trial started but onboarding auto-provision encountered an issue',
      meta: { email, error: e instanceof Error ? e.message : 'unknown' },
    })
  }

  await logSystemEvent({
    level: 'info',
    category: 'billing_trial',
    message: `No-card trial started for ${email}`,
    meta: { userId: user.id, email, trialEnd: trialEnd.toISOString(), siteId },
  })

  return NextResponse.json({ ok: true, trialEnd: trialEnd.toISOString(), siteId })
}
