import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET() {
  const admin = createAdminClient()
  if (!admin) return NextResponse.json({ ok: false, error: 'supabase_not_configured' }, { status: 400 })

  const { data, error } = await admin
    .from('leads')
    .select('id,niche,company_name,city,source,score,status,created_at')
    .order('score', { ascending: false })
    .limit(200)

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, leads: data || [] })
}
