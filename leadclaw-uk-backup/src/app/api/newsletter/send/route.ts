import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isSuppressed, sendEmail } from '@/lib/email'

export async function POST(req: Request) {
  const token = process.env.OUTREACH_RUN_TOKEN
  const auth = req.headers.get('authorization') || ''
  if (!token || auth !== `Bearer ${token}`) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })
  }

  const admin = createAdminClient()
  if (!admin) return NextResponse.json({ ok: false, error: 'supabase_not_configured' }, { status: 400 })

  const body = (await req.json().catch(() => ({}))) as { subject?: string; content?: string }
  const subject = body.subject || 'LeadClaw Weekly Update'
  const content = body.content || 'This week: product updates, wins, and what is shipping next.'

  const { data: subs } = await admin.from('newsletter_subscribers').select('email,name').eq('status', 'active').limit(200)

  let sent = 0
  let skipped = 0

  for (const sub of subs || []) {
    const email = String(sub.email || '').toLowerCase()
    if (!email) continue

    if (await isSuppressed(email)) {
      skipped++
      continue
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://leadclawai.vercel.app'
    const unsub = `${appUrl}/api/unsubscribe?email=${encodeURIComponent(email)}`

    const result = await sendEmail({
      to: email,
      subject,
      html: `<div style="font-family:Arial"><p>Hi ${sub.name || 'there'},</p><p>${content}</p><p>- LeadClaw AI</p><p style="font-size:12px"><a href="${unsub}">Unsubscribe</a></p></div>`,
      text: `${content}\n\nUnsubscribe: ${unsub}`,
    })

    if (result.ok) sent++
    else skipped++
  }

  await admin.from('newsletter_issues').insert({
    subject,
    content_markdown: content,
    status: 'sent',
    sent_at: new Date().toISOString(),
  })

  return NextResponse.json({ ok: true, sent, skipped })
}
