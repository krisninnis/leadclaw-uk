import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(req: Request) {
  const token = process.env.ADMIN_EXPORT_TOKEN
  const auth = req.headers.get('authorization') || ''

  if (!token || auth !== `Bearer ${token}`) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })
  }

  const admin = createAdminClient()
  if (!admin) return NextResponse.json({ ok: false, error: 'supabase_not_configured' }, { status: 400 })

  const [applications, leads, subscriptions, messages, events] = await Promise.all([
    admin.from('applications').select('*').order('created_at', { ascending: false }).limit(1000),
    admin.from('leads').select('*').order('created_at', { ascending: false }).limit(1000),
    admin.from('subscriptions').select('*').order('updated_at', { ascending: false }).limit(1000),
    admin.from('client_messages').select('*').order('created_at', { ascending: false }).limit(1000),
    admin.from('system_events').select('*').order('created_at', { ascending: false }).limit(1000),
  ])

  return NextResponse.json({
    ok: true,
    exportedAt: new Date().toISOString(),
    data: {
      applications: applications.data || [],
      leads: leads.data || [],
      subscriptions: subscriptions.data || [],
      clientMessages: messages.data || [],
      systemEvents: events.data || [],
    },
  })
}
