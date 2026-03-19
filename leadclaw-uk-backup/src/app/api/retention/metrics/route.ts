import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(req: Request) {
  const token = process.env.RETENTION_METRICS_TOKEN?.trim() || process.env.RETENTION_RUN_TOKEN?.trim()
  const auth = req.headers.get('authorization') || ''
  if (!token || auth !== `Bearer ${token}`) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })
  }

  const admin = createAdminClient()
  if (!admin) return NextResponse.json({ ok: false, error: 'supabase_not_configured' }, { status: 400 })

  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

  const [tasksRes, eventsRes] = await Promise.all([
    admin.from('retention_tasks').select('status,behavior,created_at').gte('created_at', since).limit(5000),
    admin.from('retention_events').select('status,behavior,created_at').gte('created_at', since).limit(5000),
  ])

  if (tasksRes.error) return NextResponse.json({ ok: false, error: tasksRes.error.message }, { status: 500 })
  if (eventsRes.error) return NextResponse.json({ ok: false, error: eventsRes.error.message }, { status: 500 })

  const tasks = tasksRes.data || []
  const events = eventsRes.data || []

  const byBehavior = events.reduce<Record<string, { sent: number; skipped: number }>>((acc, e) => {
    const key = e.behavior || 'unknown'
    if (!acc[key]) acc[key] = { sent: 0, skipped: 0 }
    if (e.status === 'sent') acc[key].sent += 1
    else acc[key].skipped += 1
    return acc
  }, {})

  return NextResponse.json({
    ok: true,
    windowDays: 30,
    taskCount: tasks.length,
    eventCount: events.length,
    queued: tasks.filter((t) => t.status === 'queued').length,
    sent: events.filter((e) => e.status === 'sent').length,
    skipped: events.filter((e) => e.status !== 'sent').length,
    byBehavior,
  })
}
