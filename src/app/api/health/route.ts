import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET() {
  const admin = createAdminClient()

  if (!admin) {
    return NextResponse.json({ ok: true, supabase: 'not_configured' })
  }

  const { error } = await admin.from('applications').select('id').limit(1)
  if (error) {
    return NextResponse.json({ ok: false, supabase: 'error', detail: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, supabase: 'connected' })
}
