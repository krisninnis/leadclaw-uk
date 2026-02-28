import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { logSystemEvent } from '@/lib/ops'
import { defaultRetentionRules, type AutonomousTaskType } from '@/lib/onboarding'

type ParsedClient = {
  id?: string
  client_name?: string | null
  contact_email?: string | null
}

function plusHours(hours: number) {
  return new Date(Date.now() + hours * 60 * 60 * 1000).toISOString()
}

export async function POST(req: Request) {
  const token = process.env.ONBOARDING_RUN_TOKEN?.trim()
  const auth = req.headers.get('authorization') || ''
  if (!token || auth !== `Bearer ${token}`) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })
  }

  const admin = createAdminClient()
  if (!admin) return NextResponse.json({ ok: false, error: 'supabase_not_configured' }, { status: 400 })

  const { data: rows, error } = await admin
    .from('onboarding_tasks')
    .select('id,task_type,onboarding_site_id,onboarding_sites(id,domain,platform,settings,onboarding_client_id,onboarding_clients(id,client_name,contact_email))')
    .eq('status', 'queued')
    .order('sequence', { ascending: true })
    .limit(100)

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })

  const completed: string[] = []
  const failed: Array<{ id: string; reason: string }> = []

  for (const row of rows || []) {
    const site = Array.isArray(row.onboarding_sites) ? row.onboarding_sites[0] : row.onboarding_sites
    const rawClient = site && Array.isArray(site.onboarding_clients) ? site.onboarding_clients[0] : site?.onboarding_clients
    const client = (rawClient || null) as ParsedClient | null

    if (!site) {
      failed.push({ id: row.id, reason: 'site_not_found' })
      await admin.from('onboarding_tasks').update({ status: 'failed', error: 'site_not_found' }).eq('id', row.id)
      continue
    }

    const taskType = row.task_type as AutonomousTaskType

    try {
      if (taskType === 'create_client_workspace') {
        await admin.from('onboarding_sites').update({ status: 'workspace_ready' }).eq('id', site.id)
      }

      if (taskType === 'generate_widget_token') {
        const { data: tokenRow } = await admin
          .from('widget_tokens')
          .select('id')
          .eq('onboarding_site_id', site.id)
          .eq('status', 'active')
          .limit(1)
          .maybeSingle()
        if (!tokenRow?.id) throw new Error('widget_token_missing')
      }

      if (taskType === 'store_settings') {
        await admin.from('onboarding_sites').update({ status: 'settings_stored' }).eq('id', site.id)
      }

      if (taskType === 'run_validation_tests') {
        await admin.from('onboarding_sites').update({ status: 'validation_pending_client_test' }).eq('id', site.id)
      }

      if (taskType === 'schedule_retention_automations') {
        const settings = (site.settings || {}) as { services?: string[] }
        const primaryService = settings.services?.[0] || 'beauty treatment'
        const key = `${site.domain}:${client?.contact_email || 'no-email'}`

        const { data: retentionClient } = await admin
          .from('retention_clients')
          .upsert(
            {
              external_key: key,
              client_name: client?.client_name || site.domain,
              email: client?.contact_email || null,
              service: primaryService,
              clinic_name: client?.client_name || site.domain,
              updated_at: new Date().toISOString(),
            },
            { onConflict: 'external_key' }
          )
          .select('id')
          .single()

        if (!retentionClient?.id) throw new Error('retention_client_upsert_failed')

        const rules = defaultRetentionRules()
        await admin.from('retention_tasks').insert(
          rules.map((r) => ({
            retention_client_id: retentionClient.id,
            behavior: r.behavior,
            due_at: plusHours(r.delayHours),
            status: 'queued',
          }))
        )
      }

      if (taskType === 'generate_handover_report') {
        await admin.from('onboarding_reports').insert({
          onboarding_site_id: site.id,
          report_type: 'handover',
          content: {
            domain: site.domain,
            platform: site.platform,
            rollback: 'Remove script/plugin/tag and purge cache/CDN.',
            status: 'ready_for_client_confirmation',
          },
        })
        await admin.from('onboarding_sites').update({ status: 'handover_ready' }).eq('id', site.id)
      }

      await admin.from('onboarding_tasks').update({ status: 'done', completed_at: new Date().toISOString(), error: null }).eq('id', row.id)
      completed.push(row.id)
    } catch (err) {
      const reason = err instanceof Error ? err.message : 'task_failed'
      failed.push({ id: row.id, reason })
      await admin.from('onboarding_tasks').update({ status: 'failed', error: reason }).eq('id', row.id)
    }
  }

  await logSystemEvent({
    level: failed.length > 0 ? 'warn' : 'info',
    category: 'onboarding',
    message: `Onboarding run complete: done=${completed.length} failed=${failed.length}`,
    meta: { completed, failed },
  })

  return NextResponse.json({ ok: true, doneCount: completed.length, failedCount: failed.length, completed, failed })
}
