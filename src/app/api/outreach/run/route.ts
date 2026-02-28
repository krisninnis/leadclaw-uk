import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { logSystemEvent } from '@/lib/ops'
import { isSuppressed, sendEmail } from '@/lib/email'

function inferBusinessContext(company: string) {
  const c = company.toLowerCase()
  if (c.includes('nail')) return { label: 'nail salon', pain: 'missed booking calls and DMs' }
  if (c.includes('skin') || c.includes('aesthetic') || c.includes('cosmetic')) return { label: 'aesthetic clinic', pain: 'missed high-intent treatment enquiries' }
  if (c.includes('lash') || c.includes('brow')) return { label: 'lash & brow studio', pain: 'missed appointment requests' }
  return { label: 'beauty clinic', pain: 'missed enquiries' }
}

function variantFromId(id: string) {
  const n = Array.from(id || '').reduce((acc, ch) => acc + ch.charCodeAt(0), 0)
  return n % 3
}

function renderMessage(lead: { id: string; company_name: string; city?: string | null }) {
  const company = lead.company_name
  const city = lead.city
  const ctx = inferBusinessContext(company)
  const v = variantFromId(lead.id)

  if (v === 0) {
    return `Hi ${company} team,\n\nQuick one — I noticed you’re a ${ctx.label}${city ? ` in ${city}` : ''}. We help clinics reduce ${ctx.pain} with a lightweight AI front desk (7-day free trial, no rebuild).\n\nWant me to send a 2-minute setup walkthrough tailored to your current process?\n\nBest,\nLeadClaw AI\n\nReply "no" to opt out.`
  }

  if (v === 1) {
    return `Hi ${company} team,\n\nMost ${ctx.label}s lose enquiries when the team is busy. We plug in a simple AI responder that captures and qualifies leads automatically${city ? ` across ${city}` : ''}.\n\nHappy to share a quick personalised demo for your business if useful.\n\nBest,\nLeadClaw AI\n\nReply "no" to opt out.`
  }

  return `Hi ${company} team,\n\nSaw your business and thought this might help: we set up an AI front desk that answers common questions, captures missed leads, and nudges rebookings for clinics like yours${city ? ` in ${city}` : ''}.\n\nIf you want, I can send the 2-minute install steps.\n\nBest,\nLeadClaw AI\n\nReply "no" to opt out.`
}

function renderHtml(lead: { id: string; company_name: string; city?: string | null }, email?: string | null) {
  const text = renderMessage(lead)
  const htmlBody = text
    .split('\n\n')
    .map((block) => `<p>${block.replace(/\n/g, '<br/>')}</p>`)
    .join('')
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://leadclawai.vercel.app'
  const unsub = email ? `${appUrl}/api/unsubscribe?email=${encodeURIComponent(email)}` : `${appUrl}/api/unsubscribe`
  return `
    <div style="font-family:Arial,sans-serif;line-height:1.5;color:#0f172a">
      ${htmlBody}
      <p style="font-size:12px;color:#64748b">To opt out, <a href="${unsub}">unsubscribe</a>.</p>
    </div>
  `
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

function normalizeEmail(raw: unknown) {
  const base = String(raw || '').trim().toLowerCase()
  if (!base) return ''
  const cleaned = base.replace(/^mailto:/, '').replace(/\s+/g, '')
  try {
    return decodeURIComponent(cleaned)
  } catch {
    return cleaned
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

  const dailyCap = Number(process.env.OUTREACH_DAILY_CAP || 20)
  const dayStart = new Date()
  dayStart.setUTCHours(0, 0, 0, 0)

  const { data: sentTodayRows } = await admin
    .from('outreach_events')
    .select('id')
    .eq('channel', 'email')
    .eq('event_type', 'sent')
    .gte('created_at', dayStart.toISOString())
    .limit(1000)

  const sentToday = (sentTodayRows || []).length
  const remaining = Math.max(0, dailyCap - sentToday)

  if (remaining === 0) {
    return NextResponse.json({ ok: true, sentCount: 0, skippedCount: 0, sent: [], skipped: [], capped: true, dailyCap, sentToday })
  }

  const { data: leads, error } = await admin
    .from('leads')
    .select('id,company_name,city,contact_email,status,score')
    .eq('status', 'new')
    .not('contact_email', 'is', null)
    .gte('score', 50)
    .order('score', { ascending: false })
    .limit(Math.min(20, remaining))

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })

  const sent: Array<{ id: string; email: string; subject: string }> = []
  const skipped: Array<{ id: string; email: string; reason: string }> = []
  const seenEmails = new Set<string>()
  let senderNotReady = false

  for (const lead of leads || []) {
    if (senderNotReady) {
      skipped.push({ id: lead.id, email: normalizeEmail(lead.contact_email), reason: 'sender_not_verified' })
      continue
    }

    const email = normalizeEmail(lead.contact_email)
    if (!email || !email.includes('@')) {
      skipped.push({ id: lead.id, email, reason: 'invalid_email' })
      await admin.from('outreach_events').insert({
        lead_id: lead.id,
        channel: 'email',
        event_type: 'skipped',
        payload: { reason: 'invalid_email' },
      })
      continue
    }

    if (seenEmails.has(email)) {
      skipped.push({ id: lead.id, email, reason: 'duplicate_email_in_batch' })
      continue
    }
    seenEmails.add(email)

    if (await isSuppressed(email)) {
      skipped.push({ id: lead.id, email, reason: 'suppressed' })
      await admin.from('outreach_events').insert({
        lead_id: lead.id,
        channel: 'email',
        event_type: 'skipped',
        payload: { reason: 'suppressed' },
      })
      continue
    }

    const subject = `Quick idea for ${lead.company_name}`
    const text = renderMessage(lead)
    const html = renderHtml(lead, email)

    const result = await sendEmail({
      to: email,
      subject,
      html,
      text,
      tags: [
        { name: 'lead_id', value: lead.id },
        { name: 'source', value: 'outreach' },
      ],
    })

    if (!result.ok) {
      const err = String(result.error || 'send_failed')
      skipped.push({ id: lead.id, email, reason: err })
      await admin.from('outreach_events').insert({
        lead_id: lead.id,
        channel: 'email',
        event_type: 'failed',
        payload: { error: err },
      })

      if (err.includes('You can only send testing emails to your own email address')) {
        senderNotReady = true
      }

      if (err.includes('rate_limit_exceeded')) {
        await sleep(700)
      }

      continue
    }

    sent.push({ id: lead.id, email, subject })

    await admin.from('outreach_events').insert({
      lead_id: lead.id,
      channel: 'email',
      event_type: 'sent',
      payload: { subject, email, email_id: result.id || null },
    })

    await admin.from('leads').update({ status: 'contacted', updated_at: new Date().toISOString() }).eq('id', lead.id)

    // Resend free tier can be strict (2 req/s). Keep a safe send pace.
    await sleep(600)
  }

  await logSystemEvent({
    level: 'info',
    category: 'outreach',
    message: `Outreach run complete: sent=${sent.length}, skipped=${skipped.length}`,
  })

  return NextResponse.json({ ok: true, sentCount: sent.length, skippedCount: skipped.length, sent, skipped, capped: sentToday + sent.length >= dailyCap, dailyCap, sentToday: sentToday + sent.length })
}
