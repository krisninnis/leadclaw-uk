import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendEmail, isSuppressed } from '@/lib/email'
import { logSystemEvent } from '@/lib/ops'
import { detectTrialStage, renderTrialEmail, type TrialStage } from '@/lib/trial-automation'

export async function POST(req: Request) {
  const tokens = [process.env.BILLING_RUN_TOKEN?.trim(), process.env.ONBOARDING_RUN_TOKEN?.trim()].filter(Boolean) as string[]
  const auth = req.headers.get('authorization') || ''
  const ua = (req.headers.get('user-agent') || '').toLowerCase()
  const isVercelCron = ua.includes('vercel-cron')
  const bearerOk = tokens.some((t) => auth === `Bearer ${t}`)
  if (!isVercelCron && !bearerOk) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })
  }

  const admin = createAdminClient()
  if (!admin) return NextResponse.json({ ok: false, error: 'supabase_not_configured' }, { status: 400 })

  const { data: subs, error } = await admin
    .from('subscriptions')
    .select('id,email,status,trial_end,plan')
    .in('status', ['trialing', 'active', 'past_due'])
    .not('trial_end', 'is', null)
    .limit(500)

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })

  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim() || 'https://leadclawai.vercel.app'
  const checkoutUrl = `${appUrl}/pricing`

  let sentCount = 0
  let skippedCount = 0

  for (const sub of subs || []) {
    const stage = detectTrialStage(sub.trial_end)
    if (!stage || !sub.email) continue

    const { data: seen } = await admin
      .from('billing_notifications')
      .select('id')
      .eq('subscription_id', sub.id)
      .eq('stage', stage)
      .limit(1)
      .maybeSingle()

    if (seen?.id) {
      skippedCount += 1
      continue
    }

    if (await isSuppressed(sub.email)) {
      await admin.from('billing_notifications').insert({
        subscription_id: sub.id,
        email: sub.email,
        stage,
        status: 'suppressed',
      })
      skippedCount += 1
      continue
    }

    const rendered = renderTrialEmail({ stage: stage as TrialStage, checkoutUrl })
    const result = await sendEmail({
      to: sub.email,
      subject: rendered.subject,
      text: rendered.text,
      html: `<p>${rendered.text.replace(/\n/g, '<br/>')}</p>`,
    })

    await admin.from('billing_notifications').insert({
      subscription_id: sub.id,
      email: sub.email,
      stage,
      status: result.ok ? 'sent' : 'failed',
      error: result.ok ? null : result.error,
    })

    if (result.ok) sentCount += 1
    else skippedCount += 1
  }

  await logSystemEvent({
    level: 'info',
    category: 'billing_trial',
    message: `Trial run complete sent=${sentCount} skipped=${skippedCount}`,
    meta: { sentCount, skippedCount },
  })

  return NextResponse.json({ ok: true, sentCount, skippedCount })
}
