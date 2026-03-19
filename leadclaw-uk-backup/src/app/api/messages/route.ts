import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { logSystemEvent } from '@/lib/ops'

export async function GET() {
  const supabase = await createClient()
  const { data: auth } = await supabase.auth.getUser()
  const user = auth.user
  if (!user) return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('client_messages')
    .select('id,sender,message,created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: true })
    .limit(200)

  if (error) {
    await logSystemEvent({ level: 'error', category: 'messages', message: error.message })
    return NextResponse.json({ ok: false, error: 'fetch_failed' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, messages: data || [] })
}

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: auth } = await supabase.auth.getUser()
  const user = auth.user
  if (!user) return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })

  const body = (await req.json()) as { message?: string }
  const text = (body.message || '').trim()
  if (!text) return NextResponse.json({ ok: false, error: 'message_required' }, { status: 400 })

  const { error } = await supabase.from('client_messages').insert({
    user_id: user.id,
    sender: 'client',
    message: text,
  })

  if (error) {
    await logSystemEvent({ level: 'error', category: 'messages', message: error.message })
    return NextResponse.json({ ok: false, error: 'insert_failed' }, { status: 500 })
  }

  // basic auto-reply placeholder
  const admin = createAdminClient()
  if (admin) {
    await admin.from('client_messages').insert({
      user_id: user.id,
      sender: 'agent',
      message: 'Got it — thanks. Our team is on this and you will get an update shortly.',
    })
  }

  return NextResponse.json({ ok: true })
}
