import { randomBytes } from 'crypto'
import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { logSystemEvent } from '@/lib/ops'
import {
  AUTONOMOUS_TASK_ORDER,
  buildGtmSnippet,
  buildWelcomeEmail,
  buildWidgetSnippet,
  normalizeDomain,
  type SitePlatform,
} from '@/lib/onboarding'

type IntakePayload = {
  clientName?: string
  businessName?: string
  domain?: string
  platform?: SitePlatform
  contactEmail?: string
  goals?: string[]
  hours?: string
  services?: string[]
  pricingRanges?: string[]
  handoffMethod?: string
}

export async function POST(req: Request) {
  const token = process.env.ONBOARDING_API_TOKEN?.trim()
  const auth = req.headers.get('authorization') || ''
  if (!token || auth !== `Bearer ${token}`) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })
  }

  const body = (await req.json()) as IntakePayload
  const domainRaw = body.domain?.trim() || ''
  if (!domainRaw) return NextResponse.json({ ok: false, error: 'domain_required' }, { status: 400 })

  const platform = body.platform || 'custom'
  const domain = normalizeDomain(domainRaw)
  const admin = createAdminClient()
  if (!admin) return NextResponse.json({ ok: false, error: 'supabase_not_configured' }, { status: 400 })

  const onboardingSettings = {
    goals: body.goals || [],
    hours: body.hours || null,
    services: body.services || [],
    pricingRanges: body.pricingRanges || [],
    handoffMethod: body.handoffMethod || null,
  }

  const { data: existingClient } = await admin
    .from('onboarding_clients')
    .select('id')
    .eq('contact_email', body.contactEmail || '')
    .maybeSingle()

  let clientId = existingClient?.id as string | undefined
  if (!clientId) {
    const { data: inserted, error } = await admin
      .from('onboarding_clients')
      .insert({
        client_name: body.clientName || body.businessName || domain,
        business_name: body.businessName || body.clientName || domain,
        contact_email: body.contactEmail || null,
        status: 'intake_received',
      })
      .select('id')
      .single()

    if (error || !inserted?.id) return NextResponse.json({ ok: false, error: error?.message || 'client_insert_failed' }, { status: 500 })
    clientId = inserted.id
  }

  const { data: siteInserted, error: siteError } = await admin
    .from('onboarding_sites')
    .insert({
      onboarding_client_id: clientId,
      domain,
      platform,
      settings: onboardingSettings,
      status: 'pending_install',
    })
    .select('id')
    .single()

  if (siteError || !siteInserted?.id) return NextResponse.json({ ok: false, error: siteError?.message || 'site_insert_failed' }, { status: 500 })

  const siteId = siteInserted.id as string
  const widgetToken = randomBytes(24).toString('hex')

  await admin.from('widget_tokens').insert({
    onboarding_site_id: siteId,
    token: widgetToken,
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

  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim() || 'https://leadclawai.vercel.app'
  const widgetSnippet = buildWidgetSnippet(appUrl, widgetToken)
  const gtmSnippet = buildGtmSnippet(appUrl, widgetToken)

  const supportEmail = process.env.SUPPORT_CONTACT_EMAIL?.trim() || null

  const welcomeEmail = buildWelcomeEmail({
    clientName: body.clientName || body.businessName || 'there',
    domain,
    settingsUrl: `${appUrl}/portal`,
    widgetSnippet,
    supportEmail,
  })

  await logSystemEvent({
    level: 'info',
    category: 'onboarding',
    message: `Intake created for ${domain}`,
    meta: { siteId, platform },
  })

  return NextResponse.json({
    ok: true,
    siteId,
    platform,
    widgetToken,
    installPackage: {
      preferredMethod: 'script_embed',
      scriptEmbed: widgetSnippet,
      gtm: gtmSnippet,
      rollback: 'Remove the injected widget script/tag and clear cache.',
      requiredPermissions:
        platform === 'wordpress'
          ? 'WP header/footer edit permission OR temporary admin with plugin install rights.'
          : 'Code injection permissions for site settings or GTM publish rights.',
    },
    welcomeEmail,
  })
}
