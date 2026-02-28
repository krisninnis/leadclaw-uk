import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import LogoutButton from '@/components/logout-button'
import PortalChat from '@/components/portal-chat'
import PortalTrialCta from '@/components/portal-trial-cta'
import PortalPlanUpgrade from '@/components/portal-plan-upgrade'
import { createAdminClient } from '@/lib/supabase/admin'
import { buildWidgetSnippet } from '@/lib/onboarding'

const mockLeads = [
  { name: 'Sophie', service: 'Botox', status: 'New' },
  { name: 'Aisha', service: 'Teeth Whitening', status: 'Follow-up' },
]

export default async function PortalPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const params = (await searchParams) || {}
  const trialStarted = params.trial === 'started'

  const admin = createAdminClient()
  let subStatus = 'No active subscription found'
  let rawSubscriptionStatus = 'none'
  let activePlan = 'starter'
  let trialEnd: string | null = null
  let hasActiveSubscription = false
  let isTrialing = false
  if (admin) {
    const { data } = await admin
      .from('subscriptions')
      .select('status,plan,trial_end,current_period_end')
      .eq('email', user.email || '')
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (data?.status) {
      rawSubscriptionStatus = String(data.status).toLowerCase()
      const planLabel = data.plan ? `${String(data.plan).toUpperCase()} • ` : ''
      subStatus = `${planLabel}${data.status}`
      hasActiveSubscription = ['trialing', 'active', 'past_due'].includes(rawSubscriptionStatus)
      isTrialing = rawSubscriptionStatus === 'trialing'
      activePlan = String(data.plan || 'starter')
      trialEnd = data.trial_end || null
    }
  }

  let onboarding: { domain: string; siteStatus: string; widgetSnippet: string } | null = null
  if (admin && user.email) {
    const { data: client } = await admin
      .from('onboarding_clients')
      .select('id')
      .eq('contact_email', user.email)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (client?.id) {
      const { data: site } = await admin
        .from('onboarding_sites')
        .select('id,domain,status')
        .eq('onboarding_client_id', client.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (site?.id) {
        const { data: tokenRow } = await admin
          .from('widget_tokens')
          .select('token')
          .eq('onboarding_site_id', site.id)
          .eq('status', 'active')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()

        if (tokenRow?.token) {
          const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim() || 'https://leadclaw.uk'
          onboarding = {
            domain: site.domain,
            siteStatus: String(site.status || 'pending_install'),
            widgetSnippet: buildWidgetSnippet(appUrl, tokenRow.token),
          }
        }
      }
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Client Portal (MVP)</h1>
          <p className="text-sm text-slate-600">Signed in as {user.email}</p>
        </div>
        <LogoutButton />
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-xl border bg-white p-4"><p className="text-sm text-slate-500">Subscription</p><p className="text-xl font-semibold">{subStatus}</p></div>
        <div className="rounded-xl border bg-white p-4"><p className="text-sm text-slate-500">Leads this week</p><p className="text-xl font-semibold">12</p></div>
        <div className="rounded-xl border bg-white p-4"><p className="text-sm text-slate-500">Avg response time</p><p className="text-xl font-semibold">42 sec</p></div>
      </div>
      {trialStarted && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
          ✅ Free trial started. Your setup section is now active below.
        </div>
      )}

      {!hasActiveSubscription && <PortalTrialCta />}

      {isTrialing && (
        <>
          <div className="rounded-xl border bg-white p-6 space-y-3">
            <h2 className="text-lg font-semibold">Free Trial Setup Section</h2>
            <p className="text-sm text-slate-600">
              Trial status: <strong>{rawSubscriptionStatus}</strong>
              {trialEnd ? ` • Trial ends: ${new Date(trialEnd).toLocaleString()}` : ''}
            </p>
            {onboarding ? (
              <>
                <p className="text-sm text-slate-700">Site: <strong>{onboarding.domain}</strong> • Setup status: <strong>{onboarding.siteStatus}</strong></p>
                <div className="rounded border bg-slate-50 p-3 text-xs overflow-x-auto">
                  <div className="mb-1 font-medium">Install snippet (paste before &lt;/body&gt;):</div>
                  <code>{onboarding.widgetSnippet}</code>
                </div>
              </>
            ) : (
              <p className="text-sm text-slate-600">Setup package is preparing. Refresh in a few seconds.</p>
            )}
          </div>
          <PortalPlanUpgrade email={user.email} />
        </>
      )}

      {!isTrialing && hasActiveSubscription && (
        <div className="rounded-xl border bg-white p-6">
          <h2 className="text-lg font-semibold">Subscribed Package Section</h2>
          <p className="text-sm text-slate-600">You are on the <strong>{activePlan.toUpperCase()}</strong> package. Manage usage and support from this portal.</p>
        </div>
      )}

      <div className="rounded-xl border bg-white p-6">
        <h2 className="mb-3 text-lg font-semibold">Lead inbox</h2>
        <table className="w-full text-left text-sm">
          <thead><tr className="border-b"><th className="py-2">Name</th><th>Service</th><th>Status</th></tr></thead>
          <tbody>
            {mockLeads.map((lead) => (
              <tr key={lead.name} className="border-b last:border-0">
                <td className="py-2">{lead.name}</td><td>{lead.service}</td><td>{lead.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <PortalChat />
    </div>
  )
}
