import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { logSystemEvent } from '@/lib/ops'

function normalizeEmail(raw: unknown) {
  const s = String(raw || '').trim().toLowerCase().replace(/^mailto:/, '').replace(/\s+/g, '')
  try {
    return decodeURIComponent(s)
  } catch {
    return s
  }
}

export async function POST(req: Request) {
  const token = process.env.OUTREACH_RUN_TOKEN?.trim()
  const auth = req.headers.get('authorization') || ''
  if (!token || auth !== `Bearer ${token}`) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })
  }

  const admin = createAdminClient()
  if (!admin) return NextResponse.json({ ok: false, error: 'supabase_not_configured' }, { status: 400 })

  const { data: leads, error } = await admin
    .from('leads')
    .select('id,contact_email,status,company_name,updated_at')
    .order('updated_at', { ascending: false })
    .limit(2000)

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })

  let cleaned = 0
  let invalid = 0
  let deduped = 0
  const seen = new Map<string, string>()

  for (const lead of leads || []) {
    const email = normalizeEmail(lead.contact_email)
    if (!email || !email.includes('@')) {
      if (lead.contact_email) {
        await admin.from('leads').update({ contact_email: null, updated_at: new Date().toISOString() }).eq('id', lead.id)
        invalid += 1
      }
      continue
    }

    if (email !== lead.contact_email) {
      await admin.from('leads').update({ contact_email: email, updated_at: new Date().toISOString() }).eq('id', lead.id)
      cleaned += 1
    }

    const key = `${(lead.company_name || '').trim().toLowerCase()}|${email}`
    if (seen.has(key)) {
      await admin.from('leads').update({ status: 'duplicate', updated_at: new Date().toISOString() }).eq('id', lead.id)
      deduped += 1
    } else {
      seen.set(key, lead.id)
    }
  }

  await logSystemEvent({
    level: 'info',
    category: 'automation',
    message: `Lead hygiene run: cleaned=${cleaned} invalid=${invalid} deduped=${deduped}`,
    meta: { cleaned, invalid, deduped },
  })

  return NextResponse.json({ ok: true, cleaned, invalid, deduped })
}
