import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET() {
  const admin = createAdminClient()
  if (!admin) return NextResponse.json({ ok: false, error: 'supabase_not_configured' }, { status: 400 })

  const [{ count: appCount }, { count: msgCount }, { data: recentErrors }] = await Promise.all([
    admin.from('applications').select('*', { count: 'exact', head: true }),
    admin.from('client_messages').select('*', { count: 'exact', head: true }),
    admin
      .from('system_events')
      .select('id,category,message,created_at')
      .eq('level', 'error')
      .order('created_at', { ascending: false })
      .limit(10),
  ])

  return NextResponse.json({
    ok: true,
    generatedAt: new Date().toISOString(),
    metrics: {
      applicationsTotal: appCount || 0,
      messagesTotal: msgCount || 0,
      recentErrorCount: recentErrors?.length || 0,
    },
    recentErrors: recentErrors || [],
  })
}
