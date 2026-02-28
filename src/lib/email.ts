import { createAdminClient } from '@/lib/supabase/admin'

export async function isSuppressed(email: string) {
  const admin = createAdminClient()
  if (!admin) return false
  const { data } = await admin.from('email_suppressions').select('id').eq('email', email.toLowerCase()).maybeSingle()
  return Boolean(data?.id)
}

export async function suppressEmail(email: string, reason = 'unsubscribe') {
  const admin = createAdminClient()
  if (!admin) return
  await admin.from('email_suppressions').upsert({ email: email.toLowerCase(), reason }, { onConflict: 'email' })
}

export async function sendEmail(input: {
  to: string
  subject: string
  html: string
  text?: string
  tags?: Array<{ name: string; value: string }>
}) {
  const apiKey = process.env.RESEND_API_KEY
  const from = process.env.RESEND_FROM_EMAIL || 'LeadClaw AI <noreply@leadclawai.com>'

  if (!apiKey) {
    return { ok: false as const, error: 'resend_not_configured' }
  }

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to: [input.to],
      subject: input.subject,
      html: input.html,
      text: input.text,
      tags: input.tags,
    }),
  })

  const raw = await res.text()
  if (!res.ok) {
    return { ok: false as const, error: raw || 'send_failed' }
  }

  let id: string | null = null
  try {
    const json = JSON.parse(raw)
    id = typeof json?.id === 'string' ? json.id : null
  } catch {}

  return { ok: true as const, id }
}
